import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { formatBRL } from "@leonidaplay/ledger";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { TZ } from "@/lib/admin-data";
import { getPayments } from "@/lib/admin-finance";
import { canSimulatePayments, paymentMode } from "@/lib/mercadopago";
import { adminSimulatePaid } from "../actions";
import { AdminNav, Card, Kpi, td, th } from "../_ui";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Aguardando", cls: "text-sun" },
  PAID: { label: "Pago", cls: "text-cyan" },
  EXPIRED: { label: "Expirado", cls: "text-muted" },
  FAILED: { label: "Falhou", cls: "text-pink" },
  REFUNDED: { label: "Devolvido", cls: "text-muted" },
};
const MODE = { mock: "Teste (Pix simulado, sem Mercado Pago)", sandbox: "Sandbox Mercado Pago (TEST-)", live: "Produção — dinheiro real" };

export default function PaymentsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-muted">Carregando pagamentos…</p>}>
        <Payments />
      </Suspense>
    </main>
  );
}

async function Payments() {
  await connection();
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();
  const { topUps, kpis, ledger, webhooks } = await getPayments();
  const mode = paymentMode();
  const simulate = canSimulatePayments();

  return (
    <div className="grid gap-6">
      <AdminNav active="/admin/pagamentos" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">Pagamentos Pix</h1>
          <p className="mt-1 text-sm text-muted">Recargas da carteira via Mercado Pago</p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${mode === "live" ? "border-cyan/50 text-cyan" : "border-sun/50 text-sun"}`}>
          Modo: {MODE[mode]}
        </span>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Recebido (Pix pagos)" value={formatBRL(kpis.receivedMinor)} hint={`${kpis.paidCount} recarga(s)`} />
        <Kpi label="Pix aguardando" value={kpis.pendingCount} />
        <Kpi label="Saldo nas carteiras" value={formatBRL(kpis.walletsMinor)} hint="dívida com jogadores" />
        <Kpi label="Taxas Mercado Pago" value={formatBRL(kpis.feesMinor)} />
        <Kpi label="Receita da plataforma" value={formatBRL(kpis.revenueMinor)} hint="comissões − taxas" />
        <Kpi
          label="Ledger"
          value={ledger.sum === 0 ? "OK" : "ERRO"}
          hint={ledger.sum === 0 ? `${ledger.entries} lançamentos somam zero` : `soma ${ledger.sum} ≠ 0 — investigar`}
        />
      </section>

      <Card title={`Recargas (${topUps.length})`} subtitle={simulate ? "No modo de teste dá para aprovar um Pix pendente sem pagar" : "Mais recentes primeiro"}>
        {topUps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhuma recarga ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Criada", "Usuário", "Valor", "Taxa", "Status", "Pago em", "ID Mercado Pago", ""].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topUps.map((t) => (
                  <tr key={t.id} className="border-t border-line/60">
                    <td className={`${td} tabular-nums text-muted`}>{dateFmt.format(t.createdAt)}</td>
                    <td className={`${td} text-fg`}>{t.user.email}</td>
                    <td className={`${td} font-semibold tabular-nums text-fg`}>{formatBRL(t.amountMinor)}</td>
                    <td className={`${td} tabular-nums text-muted`}>{t.feeMinor == null ? "—" : formatBRL(t.feeMinor)}</td>
                    <td className={`${td} text-xs font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</td>
                    <td className={`${td} tabular-nums text-muted`}>{t.paidAt ? dateFmt.format(t.paidAt) : "—"}</td>
                    <td className={`${td} font-mono text-xs text-muted`}>{t.providerPaymentId ?? "—"}</td>
                    <td className={td}>
                      {simulate && t.status === "PENDING" && (
                        <form action={adminSimulatePaid}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="rounded-lg border border-dashed border-sun/60 px-2.5 py-1 text-xs font-semibold text-sun hover:bg-sun/10">
                            Simular pago
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Notificações do Mercado Pago" subtitle="Últimos webhooks recebidos (só chegam com o site publicado em HTTPS)">
        {webhooks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhuma notificação recebida.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {webhooks.map((w) => (
              <li key={w.id} className="flex flex-wrap justify-between gap-2 border-t border-line/60 pt-2">
                <span className="text-fg">{w.type}</span>
                <span className={`text-xs ${w.error ? "text-pink" : w.processedAt ? "text-cyan" : "text-sun"}`}>
                  {w.error ?? (w.processedAt ? "processado" : "pendente")} · {dateFmt.format(w.receivedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
