import { prisma } from "@leonidaplay/db";
import { isUF } from "./ufs";

export const TZ = "America/Sao_Paulo";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD no fuso de SP

const select = {
  id: true,
  kind: true,
  email: true,
  name: true,
  city: true,
  state: true,
  countryCode: true,
  ipCity: true,
  ipRegion: true,
  device: true,
  consoleModel: true,
  hasGame: true,
  uploadMbps: true,
  hoursPerDay: true,
  betaTester: true,
  whatsapp: true,
  utmSource: true,
  locale: true,
  createdAt: true,
} as const;

export async function getWaitlist() {
  return prisma.waitlistEntry.findMany({ select, orderBy: { createdAt: "desc" }, take: 20000 });
}
export type Entry = Awaited<ReturnType<typeof getWaitlist>>[number];

/** UF/cidade para análise: o que a pessoa escreveu; se vazio, a aproximação pelo IP. */
export const ufOf = (e: Entry) => e.state ?? (e.countryCode === "BR" && isUF(e.ipRegion) ? e.ipRegion : null);
export const cityOf = (e: Entry) => e.city ?? (e.countryCode === "BR" ? e.ipCity : null);

function countBy<T>(items: T[], key: (x: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

export function analyze(rows: Entry[], days = 30) {
  const players = rows.filter((r) => r.kind === "PLAYER");
  const hosts = rows.filter((r) => r.kind === "HOST");
  const now = Date.now();
  const today = dayKey.format(now);
  const since7 = now - 7 * 864e5;

  // Série diária (últimos N dias, fuso de SP)
  const daily: { day: string; players: number; hosts: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey.format(now - i * 864e5);
    if (!idx.has(d)) {
      idx.set(d, daily.length);
      daily.push({ day: d, players: 0, hosts: 0 });
    }
  }
  for (const r of rows) {
    const i = idx.get(dayKey.format(r.createdAt));
    if (i !== undefined) daily[i][r.kind === "PLAYER" ? "players" : "hosts"]++;
  }

  // Oferta x demanda por UF
  const byUf = new Map<string, { uf: string; players: number; hosts: number }>();
  for (const r of rows) {
    const uf = ufOf(r) ?? "?";
    const cur = byUf.get(uf) ?? { uf, players: 0, hosts: 0 };
    cur[r.kind === "PLAYER" ? "players" : "hosts"]++;
    byUf.set(uf, cur);
  }
  const states = [...byUf.values()].sort((a, b) => b.players + b.hosts - (a.players + a.hosts));

  const cityLabel = (r: Entry) => {
    const c = cityOf(r);
    const uf = ufOf(r);
    return c ? (uf ? `${c} · ${uf}` : c) : null;
  };

  return {
    total: rows.length,
    players: players.length,
    hosts: hosts.length,
    today: rows.filter((r) => dayKey.format(r.createdAt) === today).length,
    last7: rows.filter((r) => r.createdAt.getTime() >= since7).length,
    hostsWithGame: hosts.filter((h) => h.hasGame).length,
    betaHosts: hosts.filter((h) => h.betaTester).length,
    hostsWithWhatsapp: hosts.filter((h) => h.whatsapp).length,
    daily,
    states,
    playerCities: countBy(players, cityLabel).slice(0, 10),
    hostCities: countBy(hosts, cityLabel).slice(0, 10),
    devices: countBy(players, (p) => p.device),
    consoles: countBy(hosts, (h) => h.consoleModel),
    uploads: countBy(hosts, (h) => h.uploadMbps),
    hours: countBy(hosts, (h) => (h.hoursPerDay == null ? null : h.hoursPerDay >= 12 ? "12h+" : h.hoursPerDay >= 6 ? "6–11h" : h.hoursPerDay >= 3 ? "3–5h" : "0–2h")),
    sources: countBy(rows, (r) => r.utmSource ?? "direto / sem UTM"),
    locales: countBy(rows, (r) => (r.locale === "en" ? "Inglês" : "Português")),
  };
}

/** Link do WhatsApp: só dígitos; número BR sem DDI ganha 55. */
export function whatsappLink(raw: string | null) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 ? `https://wa.me/${d}` : null;
}
