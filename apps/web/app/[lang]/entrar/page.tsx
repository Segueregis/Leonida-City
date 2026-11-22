import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "../dictionaries";
import { AppShell } from "../_app/AppShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · LeonidaPlay", robots: { index: false } };

export default async function LoginPage() {
  const locale = await getLocale();
  return (
    <AppShell locale={locale}>
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-line bg-panel/80 p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-fg">Entrar ou criar conta</h1>
        <p className="mt-2 text-sm text-muted">Sem senha: enviamos um código de 6 dígitos para o seu e-mail.</p>
        <Suspense>
          <AlreadyIn locale={locale} />
        </Suspense>
        <LoginForm locale={locale} />
      </div>
    </AppShell>
  );
}

/** Quem já está logado vai direto para a carteira. */
async function AlreadyIn({ locale }: { locale: string }) {
  if (await getCurrentUser()) redirect(`/${locale}/carteira`);
  return null;
}
