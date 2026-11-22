import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Mercado Pago — Pix via API de Orders (/v1/orders), sem SDK.
// (A API de Payments virou "legacy": sem novidades, só correções. Orders é o caminho recomendado.)
// Modos, pelo MP_ACCESS_TOKEN:
//   (vazio)   → "mock": Pix de mentira gerado aqui; dá para testar o fluxo sem conta no MP.
//   TEST-...  → "sandbox": API real de testes do MP (QR de teste, não aceita pagamento de verdade).
//   APP_USR-… → "live": dinheiro real.
// Em mock e sandbox o painel e a tela do Pix mostram "Simular pagamento aprovado".

export type PaymentMode = "mock" | "sandbox" | "live";

export function paymentMode(): PaymentMode {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) return "mock";
  return t.startsWith("TEST-") ? "sandbox" : "live";
}
/** Em servidor publicado (NODE_ENV=production), modo de teste só com PAYMENTS_TEST_MODE=1 — evita crédito grátis por esquecimento. */
export const testPaymentsAllowed = () => process.env.NODE_ENV !== "production" || process.env.PAYMENTS_TEST_MODE === "1";
export const canSimulatePayments = () => paymentMode() !== "live" && testPaymentsAllowed();

const API = "https://api.mercadopago.com";
export const PIX_EXPIRES_MIN = 30; // mínimo aceito pelo MP para Pix em Orders

export type MpOrder = {
  id: string; // "ORD01..."
  status: string; // created | processing | action_required | processed | canceled | failed | refunded | charged_back
  status_detail?: string; // waiting_transfer | accredited | expired | canceled | failed | ...
  total_amount: string; // "20.00"
  external_reference?: string | null;
  transactions?: {
    payments?: {
      id?: string;
      status?: string;
      status_detail?: string;
      payment_method?: { id?: string; qr_code?: string; qr_code_base64?: string; ticket_url?: string };
    }[];
  };
};

export class MpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function mp<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MpError(res.status, `Mercado Pago ${res.status} em ${path}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

const money = (minor: number) => (minor / 100).toFixed(2); // 2000 → "20.00"

/** Cria a order Pix. O webhook é configurado no painel da aplicação (Orders não aceita notification_url por pedido). */
export async function createPixOrder(input: { topUpId: string; amountMinor: number; email: string }) {
  const amount = money(input.amountMinor);
  const body = {
    type: "online",
    processing_mode: "automatic",
    total_amount: amount,
    external_reference: input.topUpId,
    payer: { email: input.email },
    transactions: {
      payments: [{ amount, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: `PT${PIX_EXPIRES_MIN}M` }],
    },
  };
  return mp<MpOrder>("/v1/orders", { method: "POST", body: JSON.stringify(body), idempotencyKey: input.topUpId });
}

export const getOrder = (id: string) => mp<MpOrder>(`/v1/orders/${encodeURIComponent(id)}`);

export const pixData = (o: MpOrder) => o.transactions?.payments?.[0]?.payment_method;
export const orderAmountMinor = (o: MpOrder) => Math.round(Number(o.total_amount) * 100);

/** Traduz o status da order para o nosso: pago, expirado, falhou ou ainda aguardando. */
export function orderOutcome(o: MpOrder): "PAID" | "EXPIRED" | "FAILED" | "PENDING" | "OTHER" {
  if (o.status === "processed") return "PAID"; // accredited ou partially_refunded: o dinheiro entrou
  if ((o.status === "canceled" || o.status === "failed") && o.status_detail === "expired") return "EXPIRED";
  if (o.status === "canceled" || o.status === "failed") return "FAILED";
  if (o.status === "created" || o.status === "processing" || o.status === "action_required") return "PENDING";
  return "OTHER"; // refunded / charged_back: tratar manualmente por enquanto
}

/**
 * Valida o header x-signature do webhook ("ts=...,v1=...").
 * Manifesto do MP: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com HMAC-SHA256 da chave secreta.
 * A doc de Orders não diz se o id vai em minúsculas (regra da API de Payments), então aceitamos as duas formas.
 */
export function verifyWebhookSignature(opts: { signature: string | null; requestId: string | null; dataId: string | null; secret: string }) {
  if (!opts.signature) return false;
  const parts = Object.fromEntries(
    opts.signature.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  // Rejeita notificações velhas (replay): 10 minutos de tolerância.
  const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60_000) return false;

  const given = Buffer.from(v1);
  const ids = opts.dataId ? [...new Set([opts.dataId, opts.dataId.toLowerCase()])] : [null];
  return ids.some((id) => {
    let manifest = "";
    if (id) manifest += `id:${id};`;
    if (opts.requestId) manifest += `request-id:${opts.requestId};`;
    manifest += `ts:${ts};`;
    const expected = Buffer.from(createHmac("sha256", opts.secret).update(manifest).digest("hex"));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}
