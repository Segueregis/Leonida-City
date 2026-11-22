import "server-only";
import { prisma } from "@leonidaplay/db";

/** Sem sinal do relay há mais que isso → o console aparece como Offline, seja qual for o status gravado. */
const STALE_MS = 3 * 60_000;

export type ShowcaseStatus = "AVAILABLE" | "BUSY" | "OFFLINE";

/** Consoles anunciados na região ativa, com status efetivo, do mais disponível para o menos. */
export async function getShowcase() {
  const region = await prisma.region.findFirst({
    where: { active: true },
    select: { id: true, name: true, packages: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, durationMinutes: true, priceMinor: true } } },
  });
  if (!region) return { region: null, consoles: [], packages: [] };

  const now = new Date();
  const rows = await prisma.console.findMany({
    where: {
      regionId: region.id,
      listed: true,
      host: { status: "ACTIVE", OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: now } }] },
    },
    select: {
      id: true,
      nickname: true,
      model: true,
      status: true,
      gameTitle: true,
      characterSummary: true,
      measuredUploadMbps: true,
      lastSeenAt: true,
      _count: { select: { sessions: { where: { status: { in: ["ENDED"] } } } } },
    },
  });

  const consoles = rows
    .map((c) => {
      const fresh = c.lastSeenAt && now.getTime() - c.lastSeenAt.getTime() < STALE_MS;
      const status: ShowcaseStatus = !fresh || c.status === "OFFLINE" || c.status === "MAINTENANCE"
        ? "OFFLINE"
        : c.status === "IDLE"
          ? "AVAILABLE"
          : "BUSY"; // PREPARING / IN_SESSION
      return { ...c, status, sessionsDone: c._count.sessions };
    })
    .sort((a, b) => rank(a.status) - rank(b.status) || (b.measuredUploadMbps ?? 0) - (a.measuredUploadMbps ?? 0));

  return { region, consoles, packages: region.packages };
}

const rank = (s: ShowcaseStatus) => (s === "AVAILABLE" ? 0 : s === "BUSY" ? 1 : 2);

/** Qualidade estimada do streaming pelo upload medido do anfitrião. */
export function uploadQuality(mbps: number | null) {
  if (mbps == null) return null;
  if (mbps >= 30) return { label: "Excelente (1080p 60fps)", tone: "good" as const };
  if (mbps >= 20) return { label: "Ótima (1080p)", tone: "good" as const };
  if (mbps >= 12) return { label: "Boa (720p)", tone: "ok" as const };
  return { label: "Básica", tone: "weak" as const };
}
