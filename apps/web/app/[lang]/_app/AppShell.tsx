import Link from "next/link";
import { paymentMode } from "@/lib/mercadopago";
import { logoutAction } from "./actions";

/** Moldura das telas logadas/login: logo, aviso de modo de teste e (opcional) botão Sair. */
export function AppShell({ locale, email, children }: { locale: string; email?: string; children: React.ReactNode }) {
  const mode = paymentMode();
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,rgb(121_40_202/0.25),transparent_55%)]">
      {mode !== "live" && (
        <p className="bg-sun/15 px-4 py-1.5 text-center text-xs font-semibold text-sun">
          Modo de teste ({mode === "mock" ? "Pix simulado" : "sandbox Mercado Pago"}) — nenhum dinheiro real é cobrado
        </p>
      )}
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno */}
          <img src="/logo.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span>
            <span className="text-fg">Leonida</span>
            <span className="bg-gradient-to-r from-pink to-cyan bg-clip-text text-transparent">Play</span>
          </span>
        </Link>
        {email && (
          <form action={logoutAction} className="flex min-w-0 items-center gap-3">
            <input type="hidden" name="locale" value={locale} />
            <span className="hidden truncate text-sm text-muted sm:inline">{email}</span>
            <button className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:border-cyan hover:text-cyan">
              Sair
            </button>
          </form>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
