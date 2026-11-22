import { formatBRL } from "@leonidaplay/ledger";
import type { HostEarnings } from "@/lib/host-earnings";

const TZ = "America/Sao_Paulo";
const dayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const SETTLEMENT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Processando", cls: "text-muted" },
  HOLD: { label: "Em retenção (24 h)", cls: "text-sun" },
  DISPUTED: { label: "Em análise", cls: "text-pink" },
  SETTLED: { label: "Liberado", cls: "text-cyan" },
  REVERSED: { label: "Estornado", cls: "text-pink" },
  NOT_APPLICABLE: { label: "Sem ganho", cls: "text-muted" },
};
const PAYOUT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Agendado", cls: "text-sun" },
  SENT: { label: "Pago", cls: "text-cyan" },
  FAILED: { label: "Falhou", cls: "text-pink" },
  CANCELLED: { label: "Cancelado", cls: "text-muted" },
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const minutes = (s: number | null) => (s == null ? "—" : `${Math.round(s / 60)} min`);

/** Painel de ganhos (server component). */
export function EarningsPanel({ e }: { e: HostEarnings }) {
  const belowMin = e.available > 0 && e.available < e.minPayoutMinor;
  return (
    <section className="mt-6 grid gap-4">
      <div className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-lg font-semibold text-fg">Seus ganhos</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Disponível para repasse" value={formatBRL(e.available)} accent />
          <Stat label={`Em retenção (${e.holdHours} h)`} value={formatBRL(e.pending)} />
          <Stat label="Últimos 30 dias" value={formatBRL(e.last30.earned)} hint={`${e.last30.sessions} sessões · ${e.last30.hours.toFixed(1).replace(".", ",")} h`} />
          <Stat label="Total já recebido" value={formatBRL(e.paidTotal)} />
        </div>
        <p className="mt-4 rounded-2xl border border-cyan/30 bg-cyan/5 px-4 py-3 text-sm text-fg">
          Próximo repasse: <b>{capitalize(dayFmt.format(e.nextPayout))}</b>, por Pix — inclui as sessões encerradas até quinta às 23h59.
          {belowMin && (
            <span className="mt-1 block text-xs text-sun">
              Abaixo do mínimo de {formatBRL(e.minPayoutMinor)}: o valor acumula para a próxima sexta.
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-panel p-6">
          <h3 className="font-display font-semibold text-fg">Sessões recentes</h3>
          {e.sessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma sessão ainda. Quando alguém jogar no seu console, aparece aqui.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60 text-sm">
              {e.sessions.map((s) => {
                const st = SETTLEMENT[s.settlementStatus];
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="tabular-nums text-fg">{s.endedAt ? dateFmt.format(s.endedAt) : "—"} · {minutes(s.billableSeconds)}</p>
                      <p className={`text-xs ${st.cls}`}>{s.status === "HOST_FAILED" ? "Não iniciou (falha do console)" : st.label}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-fg">{formatBRL(s.hostEarningMinor ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-line bg-panel p-6">
          <h3 className="font-display font-semibold text-fg">Repasses</h3>
          {e.payouts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhum repasse ainda. Eles são enviados toda sexta, a partir de {formatBRL(e.minPayoutMinor)}.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60 text-sm">
              {e.payouts.map((p) => {
                const st = PAYOUT[p.status];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="tabular-nums text-fg">{dateFmt.format(p.sentAt ?? p.createdAt)}</p>
                      <p className="text-xs text-muted">Pix {p.destinationMasked}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-fg">{formatBRL(p.amountMinor)}</p>
                      <p className={`text-xs ${st.cls}`}>{st.label}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-cyan/40 bg-cyan/5" : "border-line"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold tabular-nums ${accent ? "text-cyan" : "text-fg"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
