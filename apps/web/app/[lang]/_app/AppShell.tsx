import Link from "next/link";
import { paymentMode } from "@/lib/mercadopago";
import { logoutAction } from "./actions";

const NAV = [
  { key: "carteira", label: "Carteira" },
  { key: "consoles", label: "Consoles" },
  { key: "anfitriao", label: "Anfitrião" },
] as const;
export type AppSection = (typeof NAV)[number]["key"];

/** Moldura das telas logadas/login: logo, aviso de modo de teste, navegação da conta e botão Sair. */
export function AppShell({ locale, email, active, children }: { locale: string; email?: string; active?: AppSection; children: React.ReactNode }) {
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
      {email && <AccountNav locale={locale} active={active} />}
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}

/** Abas da conta (jogador e anfitrião na mesma conta). */
export function AccountNav({ locale, active, wide }: { locale: string; active?: AppSection; wide?: boolean }) {
  return (
    <nav aria-label="Minha conta" className={`mx-auto px-4 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-panel/80 p-1 text-sm">
        {NAV.map((n) => (
          <Link
            key={n.key}
            href={`/${locale}/${n.key}`}
            aria-current={n.key === active ? "page" : undefined}
            className={`rounded-xl px-3 py-2 text-center font-semibold transition ${
              n.key === active ? "bg-gradient-to-r from-pink/25 to-purple/25 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
