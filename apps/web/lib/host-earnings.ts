import "server-only";
import { prisma } from "@leonidaplay/db";

const TZ = "America/Sao_Paulo";

/** Próxima sexta-feira (dia do repasse) no fuso de SP. Se hoje é sexta, é hoje. */
export function nextPayoutDate(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const days = (5 - idx + 7) % 7;
  return new Date(now.getTime() + days * 864e5);
}

async function balance(userId: string, type: "HOST_PENDING" | "HOST_AVAILABLE") {
  const r = await prisma.ledgerEntry.aggregate({ where: { account: { type, userId } }, _sum: { amountMinor: true } });
  return r._sum.amountMinor ?? 0;
}

/** Painel de ganhos do anfitrião: saldos do ledger, sessões e repasses. */
export async function getHostEarnings(userId: string, hostId: string) {
  const since30 = new Date(Date.now() - 30 * 864e5);
  const [pending, available, paid, last30, sessions, payouts, region] = await Promise.all([
    balance(userId, "HOST_PENDING"),
    balance(userId, "HOST_AVAILABLE"),
    prisma.payout.aggregate({ where: { hostId, status: "SENT" }, _sum: { amountMinor: true } }),
    prisma.gameSession.aggregate({ where: { hostId, endedAt: { gte: since30 } }, _sum: { hostEarningMinor: true, billableSeconds: true }, _count: true }),
    prisma.gameSession.findMany({
      where: { hostId, status: { in: ["ENDED", "ENDED_EARLY", "HOST_FAILED"] } },
      orderBy: { endedAt: "desc" },
      take: 15,
      select: { id: true, status: true, endedAt: true, billableSeconds: true, purchasedSeconds: true, hostEarningMinor: true, settlementStatus: true },
    }),
    prisma.payout.findMany({
      where: { hostId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, amountMinor: true, status: true, sentAt: true, createdAt: true, destinationMasked: true },
    }),
    prisma.region.findFirst({ where: { active: true }, select: { minPayoutMinor: true, settlementHoldHours: true } }),
  ]);
  return {
    pending,
    available,
    paidTotal: paid._sum.amountMinor ?? 0,
    last30: { earned: last30._sum.hostEarningMinor ?? 0, hours: (last30._sum.billableSeconds ?? 0) / 3600, sessions: last30._count },
    sessions,
    payouts,
    nextPayout: nextPayoutDate(),
    minPayoutMinor: region?.minPayoutMinor ?? 2000,
    holdHours: region?.settlementHoldHours ?? 24,
  };
}
export type HostEarnings = Awaited<ReturnType<typeof getHostEarnings>>;
