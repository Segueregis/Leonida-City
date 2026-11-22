import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@leonidaplay/db";
import { formatBRL } from "@leonidaplay/ledger";
import { getCurrentUser } from "@/lib/auth";
import { canSimulatePayments } from "@/lib/mercadopago";
import { getLocale } from "../../../dictionaries";
import { AppShell } from "../../../_app/AppShell";
import { PixWatcher } from "./PixWatcher";

export const metadata: Metadata = { title: "Pagar com Pix · LeonidaPlay", robots: { index: false } };

export default async function PixPage({ params }: PageProps<"/[lang]/carteira/pix/[id]">) {
  const locale = await getLocale();
  return (
    <Suspense fallback={<AppShell locale={locale}><p className="mt-10 text-muted">Carregando Pix…</p></AppShell>}>
      <Pix locale={locale} params={params} />
    </Suspense>
  );
}

async function Pix({ locale, params }: { locale: string; params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/entrar`);
  const { id } = await params;
  const t = await prisma.topUp.findFirst({ where: { id, userId: user.id } });
  if (!t) notFound();

  return (
    <AppShell locale={locale} email={user.email}>
      <Link href={`/${locale}/carteira`} className="mt-4 inline-block text-sm text-muted hover:text-fg">
        ← Voltar para a carteira
      </Link>
      <section className="mt-4 rounded-3xl border border-line bg-panel p-6 text-center sm:p-8">
        <p className="text-sm text-muted">Recarga de</p>
        <p className="font-display text-4xl font-bold tabular-nums text-fg">{formatBRL(t.amountMinor)}</p>
        <PixWatcher
          locale={locale}
          id={t.id}
          initialStatus={t.status}
          qrBase64={t.pixQrCodeBase64}
          copyPaste={t.pixCopyPaste}
          expiresAt={t.expiresAt?.toISOString() ?? null}
          canSimulate={canSimulatePayments()}
        />
      </section>
    </AppShell>
  );
}
