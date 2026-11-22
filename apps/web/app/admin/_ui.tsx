import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Lista de espera" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/anfitrioes", label: "Anfitriões" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
] as const;

export function AdminNav({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-panel p-1 text-sm" aria-label="Seções do painel">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-xl px-4 py-2 font-semibold ${t.href === active ? "bg-line text-fg" : "text-muted hover:text-fg"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Kpi({ label, value, hint, dot }: { label: string; value: number | string; hint?: string; dot?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="flex items-center gap-2 text-xs text-muted">
        {dot && <span className="size-2.5 rounded-full" style={{ background: dot }} aria-hidden />}
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const th = "whitespace-nowrap pb-2 pr-4 text-left text-xs font-medium text-muted";
export const td = "whitespace-nowrap py-2.5 pr-4 align-top";
