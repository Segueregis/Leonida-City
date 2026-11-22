import "server-only";
import { prisma } from "@leonidaplay/db";
import { CHECKLIST } from "./host-checklist";

/** Estado do anfitrião para a tela de cadastro: perfil, 1º console e o que falta. */
export async function getHostState(userId: string) {
  const host = await prisma.hostProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      legalName: true,
      pixKeyType: true,
      pixKeyLast4: true,
      documentHash: true,
      suspendedUntil: true,
      consoles: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          nickname: true,
          model: true,
          secondaryOnlineId: true,
          characterSummary: true,
          measuredUploadMbps: true,
          listed: true,
          status: true,
          lastSeenAt: true,
          checklistVerifiedAt: true,
          checkSpendingLimitZero: true,
          checkCommsRestricted: true,
          checkConsoleSharingOn: true,
          checkRestModeNetworkOn: true,
          checkRemotePlayOn: true,
          checkPsPlusActive: true,
        },
      },
    },
  });
  const terms = await prisma.termsAcceptance.findFirst({
    where: { userId, document: "HOST_INTERMEDIATION_AGREEMENT" },
    orderBy: { acceptedAt: "desc" },
    select: { version: true, acceptedAt: true },
  });
  const console = host?.consoles[0] ?? null;
  const checklistDone = console ? CHECKLIST.every((c) => console[c.field]) : false;

  return {
    host,
    console,
    terms,
    steps: {
      payout: Boolean(host?.legalName && host.documentHash && host.pixKeyType && terms),
      console: Boolean(console),
      checklist: checklistDone,
    },
  };
}
export type HostState = Awaited<ReturnType<typeof getHostState>>;
