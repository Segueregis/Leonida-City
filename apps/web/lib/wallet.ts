import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, Prisma, type LedgerAccountType, type LedgerTransactionKind } from "@leonidaplay/db";
import { pixFee, topUpFeeLegs, topUpLegs, type Leg } from "@leonidaplay/ledger";
import { createPixOrder, getOrder, orderAmountMinor, orderOutcome, paymentMode, PIX_EXPIRES_MIN, pixData, testPaymentsAllowed, type MpOrder } from "./mercadopago";

type Tx = Prisma.TransactionClient;
const USER_ACCOUNTS = new Set<LedgerAccountType>(["PLAYER_WALLET", "PLAYER_HOLD", "HOST_PENDING", "HOST_AVAILABLE"]);

export const MAX_TOPUP_MINOR = 50_000; // R$ 500 por recarga no teste
export const TOPUP_PRESETS = [750, 1250, 2000, 5000, 10000];

async function accountId(tx: Tx, type: LedgerAccountType, userId: string | null) {
  if (userId) {
    const acc = await tx.ledgerAccount.upsert({
      where: { type_userId_currency: { type, userId, currency: "BRL" } },
      create: { type, userId, currency: "BRL" },
      update: {},
      select: { id: true },
    });
    return acc.id;
  }
  const acc = await tx.ledgerAccount.findFirst({ where: { type, userId: null, currency: "BRL" }, select: { id: true } });
  if (!acc) throw new Error(`ledger: conta de sistema ${type} não existe — rode o seed`);
  return acc.id;
}

/** Grava uma transação de partidas dobradas. Idempotente pela chave: repetir não lança duas vezes. */
async function post(tx: Tx, opts: { kind: LedgerTransactionKind; key: string; legs: Leg[]; userId: string; topUpId?: string; description?: string }) {
  if (!opts.legs.length) return;
  const exists = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: opts.key }, select: { id: true } });
  if (exists) return;
  const entries = [];
  for (const leg of opts.legs) {
    entries.push({ accountId: await accountId(tx, leg.account, USER_ACCOUNTS.has(leg.account) ? opts.userId : null), amountMinor: leg.amountMinor });
  }
  await tx.ledgerTransaction.create({
    data: { kind: opts.kind, idempotencyKey: opts.key, topUpId: opts.topUpId, description: opts.description, entries: { create: entries } },
  });
}

/** Saldo da carteira = soma dos lançamentos (nunca uma coluna). */
export async function walletBalance(userId: string) {
  const r = await prisma.ledgerEntry.aggregate({
    where: { account: { type: "PLAYER_WALLET", userId } },
    _sum: { amountMinor: true },
  });
  return r._sum.amountMinor ?? 0;
}

/** Cria a recarga e o Pix (no MP, ou de mentira no modo mock). */
export async function createTopUp(user: { id: string; email: string }, amountMinor: number) {
  if (paymentMode() !== "live" && !testPaymentsAllowed()) {
    throw new Error("Pix em modo de teste num servidor publicado: configure MP_ACCESS_TOKEN ou PAYMENTS_TEST_MODE=1");
  }
  const expiresAt = new Date(Date.now() + PIX_EXPIRES_MIN * 60_000);
  const topUp = await prisma.topUp.create({
    data: { userId: user.id, amountMinor, currency: "BRL", method: "PIX", provider: "MERCADO_PAGO", expiresAt },
  });

  try {
    if (paymentMode() === "mock") {
      const fakeId = `mock_${randomBytes(6).toString("hex")}`;
      return prisma.topUp.update({
        where: { id: topUp.id },
        data: { providerPaymentId: fakeId, pixCopyPaste: `00020126MODO-TESTE-LEONIDAPLAY-${fakeId}-${(amountMinor / 100).toFixed(2)}6304TEST` },
      });
    }
    const order = await createPixOrder({ topUpId: topUp.id, amountMinor, email: user.email });
    const pix = pixData(order);
    if (!pix?.qr_code) throw new Error(`order ${order.id} sem QR Pix (status ${order.status}/${order.status_detail})`);
    return prisma.topUp.update({
      where: { id: topUp.id },
      data: { providerPaymentId: order.id, pixCopyPaste: pix.qr_code, pixQrCodeBase64: pix.qr_code_base64 },
    });
  } catch (err) {
    await prisma.topUp.update({ where: { id: topUp.id }, data: { status: "FAILED" } });
    throw err;
  }
}

/** Marca a recarga como paga e credita a carteira, tudo numa transação. Seguro para chamar várias vezes. */
export async function markTopUpPaid(topUpId: string, opts: { feeMinor?: number | null; paidAt?: Date; source: string }) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.topUp.findUnique({ where: { id: topUpId } });
    if (!t) throw new Error(`recarga ${topUpId} não existe`);
    if (t.status === "PAID" || t.status === "REFUNDED") return t;

    const fee = opts.feeMinor ?? pixFee(t.amountMinor);
    // Só um processo vence a troca de status (webhook e consulta podem chegar juntos).
    const won = await tx.topUp.updateMany({
      where: { id: t.id, status: { in: ["PENDING", "EXPIRED", "FAILED"] } },
      data: { status: "PAID", paidAt: opts.paidAt ?? new Date(), feeMinor: fee },
    });
    if (won.count === 0) return tx.topUp.findUniqueOrThrow({ where: { id: t.id } });

    await post(tx, { kind: "TOPUP", key: `topup:${t.id}:paid`, legs: topUpLegs(t.amountMinor), userId: t.userId, topUpId: t.id, description: `Recarga Pix (${opts.source})` });
    await post(tx, { kind: "TOPUP_FEE", key: `topup:${t.id}:fee`, legs: topUpFeeLegs(fee), userId: t.userId, topUpId: t.id, description: "Taxa Mercado Pago" });
    return tx.topUp.findUniqueOrThrow({ where: { id: t.id } });
  });
}

/** Aplica o estado de uma order do MP à recarga correspondente. Usado pelo webhook e pela consulta da tela. */
export async function applyMpOrder(o: MpOrder) {
  const topUp = await prisma.topUp.findFirst({
    where: { OR: [{ providerPaymentId: o.id }, ...(o.external_reference ? [{ id: o.external_reference }] : [])] },
  });
  if (!topUp) return { ignored: "recarga não encontrada" as const };
  if (orderAmountMinor(o) !== topUp.amountMinor) {
    throw new Error(`valor divergente na recarga ${topUp.id}: MP ${o.total_amount} × ${topUp.amountMinor}`);
  }
  const outcome = orderOutcome(o);
  // Taxa: a doc de Orders não garante um campo de taxa para Pix — usamos a tabela (0,99%).
  if (outcome === "PAID") return markTopUpPaid(topUp.id, { source: "mercadopago" });
  if ((outcome === "EXPIRED" || outcome === "FAILED") && topUp.status === "PENDING") {
    return prisma.topUp.update({ where: { id: topUp.id }, data: { status: outcome } });
  }
  if (outcome === "OTHER") console.warn(`pix: order ${o.id} em ${o.status}/${o.status_detail} — conferir no painel do MP`);
  return topUp;
}

/** Status atual para a tela do Pix. Se ainda pendente, consulta o MP (cobre localhost, onde o webhook não chega). */
export async function refreshTopUp(topUpId: string, userId: string) {
  let t = await prisma.topUp.findFirst({ where: { id: topUpId, userId } });
  if (!t) return null;
  if (t.status !== "PENDING") return t;

  if (t.expiresAt && t.expiresAt < new Date() && paymentMode() === "mock") {
    return prisma.topUp.update({ where: { id: t.id }, data: { status: "EXPIRED" } });
  }
  if (paymentMode() !== "mock" && t.providerPaymentId) {
    try {
      await applyMpOrder(await getOrder(t.providerPaymentId));
      t = await prisma.topUp.findUniqueOrThrow({ where: { id: t.id } });
    } catch (err) {
      console.error("pix: falha ao consultar MP", err);
    }
  }
  return t;
}
