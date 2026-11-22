import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@leonidaplay/db";
import { formatBRL } from "@leonidaplay/ledger";
import { getCurrentUser } from "@/lib/auth";
import { TOPUP_PRESETS, walletBalance } from "@/lib/wallet";
import { getLocale } from "../dictionaries";
import { AppShell } from "../_app/AppShell";
import { TopUpForm } from "./TopUpForm";

export const metadata: Metadata = { title: "Carteira · LeonidaPlay", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Aguardando Pix", cls: "text-sun" },
  PAID: { label: "Pago", cls: "text-cyan" },
  EXPIRED: { label: "Expirado", cls: "text-muted" },
  FAILED: { label: "Falhou", cls: "text-pink" },
  REFUNDED: { label: "Devolvido", cls: "text-muted" },
};

export default async function WalletPage() {
  const locale = await getLocale();
  return (
    <Suspense fallback={<AppShell locale={locale}><p className="mt-10 text-muted">Carregando…</p></AppShell>}>
      <Wallet locale={locale} />
    </Suspense>
  );
}

async function Wallet({ locale }: { locale: string }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/entrar`);

  const [balance, topUps, region] = await Promise.all([
    walletBalance(user.id),
    prisma.topUp.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.region.findFirst({ where: { active: true }, select: { minTopUpMinor: true } }),
  ]);

  return (
    <AppShell locale={locale} email={user.email}>
      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-panel p-6 sm:p-8">
        <p className="text-sm text-muted">Seu saldo</p>
        <p className="mt-1 font-display text-4xl font-bold tabular-nums text-fg sm:text-5xl">{formatBRL(balance)}</p>
        <p className="mt-2 text-sm text-muted">Use os créditos para alugar tempo de jogo. Eles não expiram.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/${locale}/consoles`} className="rounded-xl border border-cyan/50 px-5 py-2.5 text-sm font-semibold text-cyan hover:bg-cyan/10">
            Ver consoles disponíveis →
          </Link>
          <Link href={`/${locale}/anfitriao`} className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-muted hover:border-pink hover:text-fg">
            Tem um PS5? Ganhe com ele
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-panel p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-fg">Adicionar créditos com Pix</h2>
        <p className="mt-1 text-sm text-muted">O saldo entra assim que o Pix é confirmado, normalmente em segundos.</p>
        <TopUpForm locale={locale} presets={TOPUP_PRESETS} minMinor={region?.minTopUpMinor ?? 750} />
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-panel p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-fg">Histórico de recargas</h2>
        {topUps.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma recarga ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60">
            {topUps.map((t) => {
              const s = STATUS[t.status];
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold tabular-nums text-fg">{formatBRL(t.amountMinor)}</p>
                    <p className="text-xs text-muted">{dateFmt.format(t.createdAt)}</p>
                  </div>
                  {t.status === "PENDING" ? (
                    <Link href={`/${locale}/carteira/pix/${t.id}`} className="rounded-full border border-sun/40 px-3 py-1 text-xs font-semibold text-sun hover:bg-sun/10">
                      Ver Pix
                    </Link>
                  ) : (
                    <span className={`text-xs font-semibold ${s.cls}`}>{s.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
