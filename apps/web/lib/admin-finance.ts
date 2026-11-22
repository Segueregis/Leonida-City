import "server-only";
import { prisma } from "@leonidaplay/db";

/** Usuários com saldo e total recarregado (exclui a conta técnica do admin). */
export async function getUsers() {
  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      id: true,
      email: true,
      countryCode: true,
      emailVerified: true,
      blockedAt: true,
      createdAt: true,
      authSessions: { select: { expires: true }, orderBy: { expires: "desc" }, take: 1 },
      _count: { select: { topUps: true } },
    },
  });
  const ids = users.map((u) => u.id);
  const [balances, paid] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ["accountId"],
      where: { account: { type: "PLAYER_WALLET", userId: { in: ids } } },
      _sum: { amountMinor: true },
    }),
    prisma.topUp.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "PAID" }, _sum: { amountMinor: true } }),
  ]);
  const accounts = await prisma.ledgerAccount.findMany({
    where: { id: { in: balances.map((b) => b.accountId) } },
    select: { id: true, userId: true },
  });
  const balanceByUser = new Map(accounts.map((a) => [a.userId, balances.find((b) => b.accountId === a.id)?._sum.amountMinor ?? 0]));
  const paidByUser = new Map(paid.map((p) => [p.userId, p._sum.amountMinor ?? 0]));

  return users.map((u) => ({
    ...u,
    balanceMinor: balanceByUser.get(u.id) ?? 0,
    paidMinor: paidByUser.get(u.id) ?? 0,
    lastSessionExpires: u.authSessions[0]?.expires ?? null,
  }));
}

/** Quantos itens foram criados nos últimos N dias. */
export const countSince = (rows: { createdAt: Date }[], days: number) => {
  const since = Date.now() - days * 864e5;
  return rows.filter((r) => r.createdAt.getTime() >= since).length;
};

export async function getPayments() {
  const [topUps, byStatus, systemBalances, totalSum, webhooks] = await Promise.all([
    prisma.topUp.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, amountMinor: true, feeMinor: true, status: true, providerPaymentId: true, createdAt: true, paidAt: true, user: { select: { email: true } } },
    }),
    prisma.topUp.groupBy({ by: ["status"], _count: true, _sum: { amountMinor: true } }),
    prisma.ledgerEntry.groupBy({ by: ["accountId"], _sum: { amountMinor: true } }),
    prisma.ledgerEntry.aggregate({ _sum: { amountMinor: true }, _count: true }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 20, select: { id: true, type: true, receivedAt: true, processedAt: true, error: true } }),
  ]);

  const accounts = await prisma.ledgerAccount.findMany({ select: { id: true, type: true, userId: true } });
  const byType = new Map<string, number>();
  for (const b of systemBalances) {
    const acc = accounts.find((a) => a.id === b.accountId);
    if (acc) byType.set(acc.type, (byType.get(acc.type) ?? 0) + (b._sum.amountMinor ?? 0));
  }
  const status = (s: string) => byStatus.find((x) => x.status === s);

  return {
    topUps,
    webhooks,
    kpis: {
      receivedMinor: status("PAID")?._sum.amountMinor ?? 0,
      paidCount: status("PAID")?._count ?? 0,
      pendingCount: status("PENDING")?._count ?? 0,
      walletsMinor: byType.get("PLAYER_WALLET") ?? 0,
      feesMinor: byType.get("EXTERNAL_PSP_FEES") ?? 0,
      revenueMinor: byType.get("PLATFORM_REVENUE") ?? 0,
    },
    // Saúde do ledger: a soma de TODOS os lançamentos precisa ser zero.
    ledger: { sum: totalSum._sum.amountMinor ?? 0, entries: totalSum._count },
  };
}

/** Conta técnica que assina as ações do painel no AdminAuditLog (o login do painel é Basic Auth, não um usuário). */
export async function adminActorId() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase() ?? "admin@painel.local";
  const u = await prisma.user.upsert({ where: { email }, create: { email, isAdmin: true }, update: { isAdmin: true }, select: { id: true } });
  return u.id;
}
