import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { analyze, cityOf, getWaitlist, TZ, ufOf, whatsappLink, type Entry } from "@/lib/admin-data";
import { AdminNav, Card, Kpi, td, th } from "./_ui";

// Cores das séries (validadas para daltonismo no fundo escuro): jogador = rosa, anfitrião = turquesa.
const C_PLAYER = "#FF2A85";
const C_HOST = "#1AA7B5";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dayFmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const LABELS: Record<string, string> = {
  PC: "PC",
  NOTEBOOK: "Notebook",
  CELULAR: "Celular",
  TABLET: "Tablet",
  TV: "Smart TV",
  PS5: "PS5 (com leitor)",
  PS5_DIGITAL: "PS5 Digital",
  PS5_PRO: "PS5 Pro",
  "<10": "< 10 Mbps",
  "10-20": "10–20 Mbps",
  "20-50": "20–50 Mbps",
  "50+": "50+ Mbps",
  unknown: "Não sabe",
};
const L = (k: string | null | undefined) => (k ? (LABELS[k] ?? k) : "—");

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-muted">Carregando painel…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  // Defesa em profundidade: o proxy já pediu a senha, mas a página confere de novo.
  await connection();
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();

  const rows = await getWaitlist();
  const a = analyze(rows);
  const hosts = rows.filter((r) => r.kind === "HOST");
  const players = rows.filter((r) => r.kind === "PLAYER");
  const ratio = a.hosts ? (a.players / a.hosts).toFixed(1).replace(".", ",") : "—";

  return (
    <div className="grid gap-6">
      <AdminNav active="/admin" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">LeonidaPlay</p>
          <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">Painel de gestão</h1>
          <p className="mt-1 text-sm text-muted">Lista de espera · atualizado agora ({dateFmt.format(new Date())})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/export?tipo=anfitriao" download className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-fg hover:border-cyan">
            Baixar anfitriões (CSV)
          </a>
          <a href="/admin/export?tipo=jogador" download className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-fg hover:border-cyan">
            Baixar jogadores (CSV)
          </a>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Jogadores na fila" value={a.players} dot={C_PLAYER} />
        <Kpi label="Anfitriões" value={a.hosts} dot={C_HOST} />
        <Kpi label="Jogadores por anfitrião" value={ratio} hint="demanda ÷ oferta" />
        <Kpi label="Cadastros hoje" value={a.today} />
        <Kpi label="Últimos 7 dias" value={a.last7} />
        <Kpi label="Anfitriões com GTA 6" value={`${a.hostsWithGame}/${a.hosts}`} hint={`${a.betaHosts} querem testar · ${a.hostsWithWhatsapp} com WhatsApp`} />
      </section>

      <Card title="Cadastros por dia" subtitle="Últimos 30 dias (horário de Brasília)">
        <Legend />
        <DailyChart data={a.daily} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Oferta × demanda por estado" subtitle="Onde falta anfitrião para atender a fila">
          <StatesTable states={a.states} />
        </Card>
        <div className="grid gap-6 sm:grid-cols-2">
          <Card title="Cidades · jogadores">
            <BarList items={a.playerCities} color={C_PLAYER} />
          </Card>
          <Card title="Cidades · anfitriões">
            <BarList items={a.hostCities} color={C_HOST} />
          </Card>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Onde o jogador vai jogar">
          <BarList items={a.devices.map((x) => ({ ...x, label: L(x.label) }))} color={C_PLAYER} />
        </Card>
        <Card title="Modelo do PS5">
          <BarList items={a.consoles.map((x) => ({ ...x, label: L(x.label) }))} color={C_HOST} />
        </Card>
        <Card title="Upload do anfitrião" subtitle="Ideal: 20 Mbps ou mais">
          <BarList items={a.uploads.map((x) => ({ ...x, label: L(x.label) }))} color={C_HOST} />
        </Card>
        <Card title="Horas livres por dia">
          <BarList items={a.hours} color={C_HOST} />
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card title="Origem dos cadastros" subtitle="utm_source dos links (Instagram, etc.)">
          <BarList items={a.sources} color="#8b8fa3" />
        </Card>
        <Card title="Idioma do site">
          <BarList items={a.locales} color="#8b8fa3" />
        </Card>
      </div>

      <Card title={`Anfitriões (${hosts.length})`} subtitle="Contato para ativar os primeiros consoles">
        <HostsTable rows={hosts} />
      </Card>

      <Card title={`Jogadores (${players.length})`} subtitle={players.length > 300 ? "Mostrando os 300 mais recentes — baixe o CSV para ver todos" : "Ordem de chegada na fila (mais recentes primeiro)"}>
        <PlayersTable rows={players.slice(0, 300)} />
      </Card>
    </div>
  );
}

/* ---------- peças ---------- */

function Legend() {
  return (
    <div className="mb-3 flex gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: C_PLAYER }} /> Jogadores
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: C_HOST }} /> Anfitriões
      </span>
    </div>
  );
}

function DailyChart({ data }: { data: { day: string; players: number; hosts: number }[] }) {
  const W = 900;
  const H = 220;
  const pad = { l: 28, r: 8, t: 8, b: 24 };
  const max = Math.max(1, ...data.map((d) => Math.max(d.players, d.hosts)));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const slot = (W - pad.l - pad.r) / data.length;
  const bw = Math.max(2, Math.min(10, (slot - 6) / 2));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const base = y(0);

  // Barra com topo arredondado (4px) e base reta no eixo.
  const bar = (x: number, v: number) => {
    if (v === 0) return "";
    const yt = y(v);
    const r = Math.min(4, bw / 2, base - yt);
    return `M${x},${base}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${yt + r}V${base}Z`;
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Cadastros por dia, jogadores e anfitriões">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(step * i)} y2={y(step * i)} stroke="currentColor" className="text-line" strokeDasharray={i ? "2 4" : undefined} />
            <text x={pad.l - 6} y={y(step * i) + 4} textAnchor="end" className="fill-muted text-[10px]">
              {step * i}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = pad.l + i * slot + (slot - (bw * 2 + 2)) / 2;
          return (
            <g key={d.day} className="group">
              <title>{`${dayFmt(d.day)}: ${d.players} jogador(es), ${d.hosts} anfitrião(ões)`}</title>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} className="fill-transparent group-hover:fill-white/5" />
              <path d={bar(x0, d.players)} fill={C_PLAYER} />
              <path d={bar(x0 + bw + 2, d.hosts)} fill={C_HOST} />
              {(i % 5 === 0 || i === data.length - 1) && (
                <text x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">
                  {dayFmt(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarList({ items, color }: { items: { label: string; value: number }[]; color: string }) {
  if (!items.length) return <Empty />;
  const max = Math.max(...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="grid gap-2.5">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${i.value} (${Math.round((i.value / total) * 100)}%)`}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate text-fg">{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {i.value} <span className="text-muted/60">· {Math.round((i.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-line/50">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatesTable({ states }: { states: { uf: string; players: number; hosts: number }[] }) {
  if (!states.length) return <Empty />;
  const max = Math.max(...states.map((s) => Math.max(s.players, s.hosts)));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="pb-2 font-medium">UF</th>
          <th className="pb-2 font-medium">Jogadores</th>
          <th className="pb-2 font-medium">Anfitriões</th>
          <th className="pb-2 text-right font-medium">Situação</th>
        </tr>
      </thead>
      <tbody>
        {states.map((s) => {
          const status = s.hosts === 0 ? (s.players ? "Sem anfitrião" : "—") : s.players / s.hosts > 8 ? "Falta anfitrião" : "Equilibrado";
          return (
            <tr key={s.uf} className="border-t border-line/60">
              <td className="py-2 font-semibold text-fg">{s.uf === "?" ? "Não informado" : s.uf}</td>
              <td className="py-2 pr-3">
                <Mini value={s.players} max={max} color={C_PLAYER} />
              </td>
              <td className="py-2 pr-3">
                <Mini value={s.hosts} max={max} color={C_HOST} />
              </td>
              <td className={`py-2 text-right text-xs ${status === "Equilibrado" ? "text-muted" : "font-semibold text-sun"}`}>
                {status !== "Equilibrado" && status !== "—" && <span aria-hidden>⚠ </span>}
                {status}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Mini({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-line/50">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="tabular-nums text-fg">{value}</span>
    </div>
  );
}

function Place({ e }: { e: Entry }) {
  const city = cityOf(e);
  const uf = ufOf(e);
  const fromIp = !e.city && city;
  return (
    <span title={e.ipCity ? `IP: ${e.ipCity}${e.ipRegion ? ` · ${e.ipRegion}` : ""}` : undefined}>
      {city ? `${city}${uf ? ` · ${uf}` : ""}` : (uf ?? "—")}
      {fromIp && <span className="ml-1 text-[10px] text-muted">(IP)</span>}
    </span>
  );
}

function HostsTable({ rows }: { rows: Entry[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {["Data", "Nome", "Contato", "Local", "PS5", "GTA 6", "Upload", "Horas/dia", "Beta"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const wa = whatsappLink(r.whatsapp);
            return (
              <tr key={r.id} className="border-t border-line/60">
                <td className={`${td} tabular-nums text-muted`}>{dateFmt.format(r.createdAt)}</td>
                <td className={`${td} text-fg`}>{r.name ?? "—"}</td>
                <td className={td}>
                  <a href={`mailto:${r.email}`} className="text-fg underline decoration-line underline-offset-2 hover:decoration-cyan">
                    {r.email}
                  </a>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="ml-2 rounded-md border border-line px-1.5 py-0.5 text-xs text-cyan hover:border-cyan">
                      WhatsApp
                    </a>
                  )}
                </td>
                <td className={`${td} text-fg`}>
                  <Place e={r} />
                </td>
                <td className={`${td} text-fg`}>{L(r.consoleModel)}</td>
                <td className={`${td} text-fg`}>{r.hasGame == null ? "—" : r.hasGame ? "Sim" : "Não"}</td>
                <td className={`${td} text-fg`}>{L(r.uploadMbps)}</td>
                <td className={`${td} tabular-nums text-fg`}>{r.hoursPerDay ?? "—"}</td>
                <td className={`${td} text-fg`}>{r.betaTester ? "Sim" : "Não"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayersTable({ rows }: { rows: Entry[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {["Data", "Nome", "E-mail", "Local", "Dispositivo", "Origem"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line/60">
              <td className={`${td} tabular-nums text-muted`}>{dateFmt.format(r.createdAt)}</td>
              <td className={`${td} text-fg`}>{r.name ?? "—"}</td>
              <td className={`${td} text-fg`}>{r.email}</td>
              <td className={`${td} text-fg`}>
                <Place e={r} />
              </td>
              <td className={`${td} text-fg`}>{L(r.device)}</td>
              <td className={`${td} text-muted`}>{r.utmSource ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted">Ainda sem cadastros.</p>;
}
