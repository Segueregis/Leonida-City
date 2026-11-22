import Link from "next/link";

export const CONTACT_EMAIL = "contato@leonidaplay.com.br";
export const LEGAL_UPDATED = "22 de novembro de 2026";

/** Moldura simples para páginas de texto (termos, privacidade). */
export function LegalPage({ locale, title, children }: { locale: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno */}
          <img src="/logo.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span>
            <span className="text-fg">Leonida</span>
            <span className="bg-gradient-to-r from-pink to-cyan bg-clip-text text-transparent">Play</span>
          </span>
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h1 className="mt-6 font-display text-3xl font-bold text-fg">{title}</h1>
        <p className="mt-2 text-sm text-muted">Última atualização: {LEGAL_UPDATED}</p>
        <article className="legal mt-8 grid gap-4 text-[15px] leading-relaxed text-fg/90">{children}</article>
        <nav className="mt-12 flex gap-6 border-t border-line pt-6 text-sm text-muted">
          <Link href={`/${locale}/termos`} className="hover:text-fg">Termos de Uso</Link>
          <Link href={`/${locale}/privacidade`} className="hover:text-fg">Política de Privacidade</Link>
        </nav>
      </main>
    </div>
  );
}

export const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-6 font-display text-lg font-semibold text-fg">{children}</h2>
);
export const UL = ({ children }: { children: React.ReactNode }) => <ul className="grid list-disc gap-1.5 pl-5">{children}</ul>;
