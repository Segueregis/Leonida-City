import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHostState } from "@/lib/host";
import { getHostEarnings } from "@/lib/host-earnings";
import { EarningsPanel } from "./EarningsPanel";
import { getLocale } from "../dictionaries";
import { AppShell } from "../_app/AppShell";
import { ChecklistForm, ConsoleForm, ListedToggle, PayoutForm } from "./HostForms";

export const metadata: Metadata = { title: "Seja anfitrião · LeonidaPlay", robots: { index: false } };

export default async function HostPage() {
  const locale = await getLocale();
  return (
    <Suspense fallback={<AppShell locale={locale}><p className="mt-10 text-muted">Carregando…</p></AppShell>}>
      <Host locale={locale} />
    </Suspense>
  );
}

const HOST_STATUS: Record<string, { label: string; text: string; cls: string }> = {
  PENDING_ONBOARDING: { label: "Em análise", text: "Assim que você completar os passos, analisamos seu cadastro (normalmente em até 1 dia) e liberamos o anúncio.", cls: "border-sun/40 bg-sun/10 text-sun" },
  ACTIVE: { label: "Aprovado", text: "Seu cadastro está aprovado. Anuncie o console quando ele estiver livre.", cls: "border-cyan/40 bg-cyan/10 text-cyan" },
  SUSPENDED: { label: "Suspenso", text: "Seu cadastro está suspenso temporariamente por falhas em sessões. Fale com o suporte.", cls: "border-pink/40 bg-pink/10 text-pink" },
  BANNED: { label: "Encerrado", text: "Seu cadastro foi encerrado.", cls: "border-pink/40 bg-pink/10 text-pink" },
};

async function Host({ locale }: { locale: string }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/entrar?next=/${locale}/anfitriao`);
  const s = await getHostState(user.id);
  const done = [s.steps.payout, s.steps.console, s.steps.checklist].filter(Boolean).length;
  const status = s.host ? HOST_STATUS[s.host.status] : null;
  // Painel de ganhos a partir da aprovação (antes disso não há o que mostrar).
  const earnings = s.host && s.host.status !== "PENDING_ONBOARDING" ? await getHostEarnings(user.id, s.host.id) : null;

  return (
    <AppShell locale={locale} email={user.email} active="anfitriao">
      <section className="mt-6">
        <h1 className="font-display text-3xl font-bold text-fg">Ganhe com seu PS5</h1>
        <p className="mt-2 text-muted">
          Você fica com <b className="text-fg">80% de cada sessão</b>, recebido por Pix toda sexta. Seu PS5 continua na sua casa — os
          jogadores usam uma conta secundária, sem acesso à sua conta, cartões ou compras.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-line/60">
            <div className="h-full rounded-full bg-gradient-to-r from-pink to-cyan transition-all" style={{ width: `${(done / 3) * 100}%` }} />
          </div>
          <span className="text-sm tabular-nums text-muted">{done} de 3 passos</span>
        </div>
      </section>

      {status && done === 3 && (
        <div className={`mt-6 rounded-2xl border px-5 py-4 ${status.cls}`}>
          <p className="font-semibold">Status do cadastro: {status.label}</p>
          <p className="mt-1 text-sm text-fg/80">{status.text}</p>
        </div>
      )}

      {earnings && <EarningsPanel e={earnings} />}

      {done === 3 && <h2 className="mt-10 font-display text-xl font-semibold text-fg">Seu cadastro</h2>}

      <Step n={1} title="Dados para receber" done={s.steps.payout}>
        <PayoutForm
          locale={locale}
          saved={s.host?.legalName ? { legalName: s.host.legalName, pixKeyType: s.host.pixKeyType, pixKeyLast4: s.host.pixKeyLast4 } : null}
        />
      </Step>

      <Step n={2} title="Seu console" done={s.steps.console} locked={!s.steps.payout}>
        <ConsoleForm
          locale={locale}
          saved={
            s.console
              ? {
                  nickname: s.console.nickname,
                  model: s.console.model,
                  secondaryOnlineId: s.console.secondaryOnlineId ?? "",
                  characterSummary: s.console.characterSummary ?? "",
                  uploadMbps: s.console.measuredUploadMbps ?? undefined,
                }
              : null
          }
        />
      </Step>

      <Step n={3} title="Checklist de segurança" done={s.steps.checklist} locked={!s.steps.console}>
        <ChecklistForm
          locale={locale}
          values={s.console ? Object.fromEntries(Object.entries(s.console).filter(([k]) => k.startsWith("check"))) as Record<string, boolean> : {}}
        />
      </Step>

      {done === 3 && s.console && (
        <section className="mt-6 rounded-3xl border border-line bg-panel p-6">
          <h2 className="font-display text-lg font-semibold text-fg">Anúncio na vitrine</h2>
          <ListedToggle locale={locale} listed={s.console.listed} canList={s.host?.status === "ACTIVE"} />
          <p className="mt-3 text-xs text-muted">
            O console só aparece como <b>Disponível</b> quando o PS5 está ligado (ou em repouso) e conectado ao nosso servidor. Veja como
            ele aparece em <Link href={`/${locale}/consoles`} className="text-cyan underline">Consoles disponíveis</Link>.
          </p>
        </section>
      )}
    </AppShell>
  );
}

function Step({ n, title, done, locked, children }: { n: number; title: string; done: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <section className={`mt-6 rounded-3xl border bg-panel p-6 ${done ? "border-cyan/30" : "border-line"} ${locked ? "opacity-50" : ""}`}>
      <h2 className="flex items-center gap-3 font-display text-lg font-semibold text-fg">
        <span className={`grid size-7 place-items-center rounded-full text-sm ${done ? "bg-cyan/15 text-cyan" : "bg-line text-muted"}`}>{done ? "✓" : n}</span>
        {title}
      </h2>
      {locked ? <p className="mt-3 text-sm text-muted">Complete o passo anterior primeiro.</p> : <div className="mt-4">{children}</div>}
    </section>
  );
}
