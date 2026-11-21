import Link from "next/link";
import { brl, packages } from "@/lib/pricing";
import { getDictionary, getLocale } from "./dictionaries";
import { EarningsCalculator } from "./_components/EarningsCalculator";
import { WaitlistForm } from "./_components/WaitlistForm";

function Palm({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 220" className={className} aria-hidden fill="currentColor">
      <path d="M58 220c2-50 4-95 2-138l6-1c3 44 1 89-2 139z" />
      <path d="M62 84C48 62 22 56 2 66c20-2 40 4 54 22zM62 84c6-24 28-38 52-36-20 6-36 18-46 40zM62 84C40 72 16 80 6 98c14-10 34-14 52-10zM62 84c20-12 44-8 56 8-16-6-36-6-52 6zM62 84c-6-22-2-44 14-58-8 18-10 38-8 58z" />
    </svg>
  );
}

export default async function Home() {
  const t = await getDictionary();
  const locale = await getLocale();
  const other = locale === "pt" ? "en" : "pt";
  const year = 2026;

  const priceLabel = (code: string) =>
    code === "TEST_15" ? t.prices.test : code === "H1" ? t.prices.popular : code === "H3" ? t.prices.combo : null;
  const duration = (min: number) =>
    min < 60 ? `${min} ${t.prices.minutes}` : `${min / 60} ${min === 60 ? t.prices.hour : t.prices.hours}`;

  return (
    <>
      {/* Navegação */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-ink/70 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno */}
            <img src="/logo.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
            <span><span className="text-fg">Leonida</span>
            <span className="bg-gradient-to-r from-pink to-cyan bg-clip-text text-transparent">Play</span></span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#como-funciona" className="hover:text-fg">{t.nav.how}</a>
            <a href="#precos" className="hover:text-fg">{t.nav.prices}</a>
            <a href="#anfitriao" className="hover:text-fg">{t.nav.host}</a>
            <a href="#duvidas" className="hover:text-fg">{t.nav.faq}</a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${other}`}
              hrefLang={other === "pt" ? "pt-BR" : "en"}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold uppercase text-muted hover:border-cyan hover:text-cyan"
            >
              {other === "pt" ? "PT" : "EN"}
            </Link>
            <a href="#lista" className="whitespace-nowrap rounded-full bg-pink px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-pink/30 hover:bg-pink/90 sm:px-4 sm:text-sm">
              {t.nav.cta}
            </a>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden pt-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgb(121_40_202/0.35),transparent_60%)]" />
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan">
              <span className="size-1.5 animate-pulse rounded-full bg-cyan" />
              {t.hero.badge}
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="block text-fg">{t.hero.title1}</span>
              <span className="glow-text block bg-gradient-to-r from-sun via-pink to-purple bg-clip-text text-transparent">
                {t.hero.title2}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg">{t.hero.subtitle}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#lista-jogador" className="w-full rounded-2xl bg-gradient-to-r from-pink to-purple px-7 py-4 font-semibold text-white shadow-xl shadow-pink/25 transition hover:scale-[1.02] sm:w-auto">
                {t.hero.ctaPlayer}
              </a>
              <a href="#lista-anfitriao" className="w-full rounded-2xl border border-cyan/50 px-7 py-4 font-semibold text-cyan transition hover:bg-cyan/10 sm:w-auto">
                {t.hero.ctaHost}
              </a>
            </div>
            <p className="mt-4 text-xs text-muted/70">{t.hero.note}</p>
          </div>

          {/* Horizonte: sol, palmeiras e grade */}
          <div className="relative mx-auto h-56 max-w-6xl sm:h-72" aria-hidden>
            <div className="sun absolute bottom-12 left-1/2 size-56 -translate-x-1/2 rounded-full sm:bottom-16 sm:size-72" />
            <Palm className="absolute bottom-11 left-[calc(50%-9.5rem)] h-44 text-ink sm:bottom-[3.75rem] sm:left-[calc(50%-12.5rem)] sm:h-60" />
            <Palm className="absolute bottom-11 right-[calc(50%-8.5rem)] h-32 -scale-x-100 text-ink sm:bottom-[3.75rem] sm:right-[calc(50%-11rem)] sm:h-44" />
            <Palm className="absolute bottom-11 left-[8%] hidden h-36 text-purple/40 sm:bottom-[3.75rem] sm:block" />
            <Palm className="absolute bottom-11 right-[6%] hidden h-28 -scale-x-100 text-purple/30 sm:bottom-[3.75rem] sm:block" />
            <div className="absolute inset-x-0 bottom-12 h-px bg-gradient-to-r from-transparent via-pink to-transparent sm:bottom-16" />
          </div>
          <div className="relative -mt-12 h-40 overflow-hidden sm:-mt-16" aria-hidden>
            <div className="grid-floor absolute -inset-x-1/2 top-0 h-[200%]" />
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t.how.title}</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {t.how.steps.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-line bg-panel/70 p-7">
                <span className="font-display text-5xl font-extrabold text-transparent [-webkit-text-stroke:1px_var(--color-pink)]">
                  0{i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Preços */}
        <section id="precos" className="scroll-mt-20 border-y border-white/5 bg-panel/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t.prices.title}</h2>
            <p className="mt-3 max-w-2xl text-muted">{t.prices.subtitle}</p>
            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {packages.map((p) => {
                const featured = p.code === "H1";
                const label = priceLabel(p.code);
                return (
                  <div
                    key={p.code}
                    className={`relative rounded-3xl p-px ${featured ? "bg-gradient-to-b from-pink via-purple to-cyan" : "bg-line"}`}
                  >
                    <div className="flex h-full flex-col rounded-[23px] bg-ink p-5 sm:p-6">
                      {label && (
                        <span className={`mb-3 self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${featured ? "bg-pink text-white" : "bg-white/5 text-muted"}`}>
                          {label}
                        </span>
                      )}
                      <p className="text-sm text-muted">{duration(p.minutes)}</p>
                      <p className="mt-1 font-display text-2xl font-bold text-fg sm:text-3xl">{brl(p.priceBRL, locale)}</p>
                      <p className="mt-auto pt-4 text-xs text-muted/70">
                        {brl((p.priceBRL / p.minutes) * 60, locale)}/{t.prices.hour}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Anfitrião */}
        <section id="anfitriao" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{t.host.title}</h2>
            <p className="mt-4 text-muted">{t.host.subtitle}</p>
            <ul className="mt-8 grid gap-3">
              {t.host.points.map((pt) => (
                <li key={pt} className="flex items-start gap-3 text-fg">
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-cyan/15 text-xs text-cyan">✓</span>
                  {pt}
                </li>
              ))}
            </ul>
            <a href="#lista-anfitriao" className="mt-8 inline-block rounded-2xl border border-cyan/50 px-6 py-3 font-semibold text-cyan hover:bg-cyan/10">
              {t.hero.ctaHost}
            </a>
          </div>
          <EarningsCalculator locale={locale} t={t.host} />
        </section>

        {/* Lista de espera */}
        <section id="lista" className="relative scroll-mt-20 overflow-hidden border-t border-white/5">
          <span id="lista-jogador" className="absolute -top-20" aria-hidden />
          <span id="lista-anfitriao" className="absolute -top-20" aria-hidden />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,rgb(255_42_133/0.18),transparent_60%)]" />
          <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
            <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">{t.form.title}</h2>
            <p className="mt-3 text-center text-muted">{t.form.subtitle}</p>
            <div className="mt-10 rounded-3xl border border-line bg-panel/80 p-5 shadow-2xl shadow-purple/10 sm:p-8">
              <WaitlistForm t={t.form} locale={locale} />
            </div>
          </div>
        </section>

        {/* Dúvidas */}
        <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t.faq.title}</h2>
          <div className="mt-8 divide-y divide-line rounded-3xl border border-line bg-panel/60">
            {t.faq.items.map((item) => (
              <details key={item.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg">
                  {item.q}
                  <span className="text-xl text-pink transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
          <p className="font-display font-bold text-fg">
            Leonida<span className="text-pink">Play</span>
          </p>
          <p className="mt-2">{t.footer.tagline}</p>
          <p className="mt-6 max-w-3xl text-xs text-muted/70">{t.footer.disclaimer}</p>
          <p className="mt-4 text-xs text-muted/50">
            © {year} LeonidaPlay. {t.footer.rights}
          </p>
        </div>
      </footer>
    </>
  );
}
