import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { formatBRL } from "@leonidaplay/ledger";
import { getCurrentUser } from "@/lib/auth";
import { getShowcase, uploadQuality, type ShowcaseStatus } from "@/lib/consoles";
import { getLocale } from "../dictionaries";
import { PingTest } from "./PingTest";

// Fora do menu e do Google até o lançamento.
export const metadata: Metadata = { title: "Consoles disponíveis · LeonidaPlay", robots: { index: false } };

const MODEL: Record<string, string> = { PS5: "PS5", PS5_DIGITAL: "PS5 Digital", PS5_PRO: "PS5 Pro" };
const GAME: Record<string, string> = { GTA6_ONLINE: "GTA 6 Online" };
const STATUS: Record<ShowcaseStatus, { label: string; dot: string; text: string }> = {
  AVAILABLE: { label: "Disponível", dot: "bg-cyan animate-pulse", text: "text-cyan" },
  BUSY: { label: "Em uso", dot: "bg-sun", text: "text-sun" },
  OFFLINE: { label: "Offline", dot: "bg-muted/50", text: "text-muted" },
};
const duration = (min: number) => (min < 60 ? `${min} min` : `${min / 60} ${min === 60 ? "hora" : "horas"}`);

export default async function ConsolesPage() {
  const locale = await getLocale();
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,rgb(121_40_202/0.25),transparent_55%)]">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno */}
          <img src="/logo.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span>
            <span className="text-fg">Leonida</span>
            <span className="bg-gradient-to-r from-pink to-cyan bg-clip-text text-transparent">Play</span>
          </span>
        </Link>
        <Suspense fallback={null}>
          <AccountLink locale={locale} />
        </Suspense>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 sm:px-6">
        <section className="pt-4">
          <h1 className="font-display text-3xl font-bold text-fg sm:text-4xl">Consoles disponíveis</h1>
          <p className="mt-2 max-w-2xl text-muted">
            PS5 de verdade, na casa de anfitriões, prontos para você jogar pelo navegador. Veja quem está online e teste sua conexão
            antes de pagar qualquer coisa.
          </p>
        </section>

        <PingTest />

        <Suspense fallback={<p className="text-muted">Procurando consoles…</p>}>
          <Showcase locale={locale} />
        </Suspense>
      </main>
    </div>
  );
}

async function AccountLink({ locale }: { locale: string }) {
  const user = await getCurrentUser();
  return (
    <Link
      href={`/${locale}/${user ? "carteira" : "entrar"}`}
      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-fg hover:border-cyan hover:text-cyan"
    >
      {user ? "Minha carteira" : "Entrar"}
    </Link>
  );
}

async function Showcase({ locale }: { locale: string }) {
  await connection();
  const { consoles, packages } = await getShowcase();
  const available = consoles.filter((c) => c.status === "AVAILABLE").length;

  return (
    <>
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-fg">
            {consoles.length === 0 ? "Nenhum console cadastrado ainda" : `${available} de ${consoles.length} disponíveis agora`}
          </h2>
        </div>

        {consoles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line p-10 text-center">
            <p className="font-display text-lg font-semibold text-fg">Os primeiros PS5 estão chegando</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Estamos ativando os consoles dos primeiros anfitriões. Entre na lista de espera e avisamos você assim que tiver PS5
              online.
            </p>
            <Link href={`/${locale}#lista`} className="mt-5 inline-block rounded-xl bg-gradient-to-r from-pink to-purple px-6 py-3 font-semibold text-white">
              Entrar na lista de espera
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {consoles.map((c) => {
              const s = STATUS[c.status];
              const q = uploadQuality(c.measuredUploadMbps);
              return (
                <li key={c.id} className={`flex flex-col rounded-3xl border bg-panel p-5 ${c.status === "AVAILABLE" ? "border-cyan/40" : "border-line"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`flex items-center gap-2 text-xs font-semibold ${s.text}`}>
                      <span className={`size-2 rounded-full ${s.dot}`} aria-hidden />
                      {s.label}
                    </span>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{MODEL[c.model] ?? c.model}</span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-fg">{c.nickname}</h3>
                  <p className="text-sm text-muted">{GAME[c.gameTitle] ?? c.gameTitle}</p>
                  <dl className="mt-4 grid gap-2 text-sm">
                    {c.characterSummary && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Personagem</dt>
                        <dd className="text-right text-fg">{c.characterSummary}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Qualidade</dt>
                      <dd className={`text-right ${q?.tone === "weak" ? "text-sun" : "text-fg"}`}>{q?.label ?? "Ainda não medida"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Sessões concluídas</dt>
                      <dd className="text-right tabular-nums text-fg">{c.sessionsDone}</dd>
                    </div>
                  </dl>
                  <button
                    disabled
                    className="mt-5 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted"
                    title="As sessões de jogo abrem no lançamento"
                  >
                    {c.status === "AVAILABLE" ? "Jogar — em breve" : c.status === "BUSY" ? "Em uso agora" : "Offline"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {packages.length > 0 && (
        <section className="rounded-3xl border border-line bg-panel p-6">
          <h2 className="font-display text-lg font-semibold text-fg">Quanto custa</h2>
          <p className="mt-1 text-sm text-muted">Mesmo preço em qualquer console. O tempo só começa a contar quando o jogo aparece na tela.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {packages.map((p) => (
              <li key={p.code} className="rounded-2xl border border-line p-4 text-center">
                <p className="text-sm text-muted">{duration(p.durationMinutes)}</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-fg">{formatBRL(p.priceMinor)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
