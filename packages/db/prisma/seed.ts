import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type LedgerAccountType } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Tabela de preços do MVP (split 80/20). Valores em centavos.
const BR_PACKAGES = [
  { code: "TEST_15", durationMinutes: 15, priceMinor: 750, sortOrder: 1 },
  { code: "MIN_30", durationMinutes: 30, priceMinor: 1250, sortOrder: 2 },
  { code: "H1", durationMinutes: 60, priceMinor: 2000, sortOrder: 3 },
  { code: "H3", durationMinutes: 180, priceMinor: 5000, sortOrder: 4 },
] as const;

const SYSTEM_ACCOUNTS: LedgerAccountType[] = [
  "PLATFORM_REVENUE",
  "PLATFORM_PROMO",
  "EXTERNAL_PIX_IN",
  "EXTERNAL_PIX_OUT",
  "EXTERNAL_PSP_FEES",
  "EXTERNAL_REFUNDS",
];

async function main() {
  const region = await prisma.region.upsert({
    where: { code: "BR-SP" },
    update: {},
    create: {
      code: "BR-SP",
      name: "Brasil (São Paulo)",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      countryCodes: ["BR", "PY", "UY", "AR"],
      paymentMethods: ["PIX"],
      payoutMethod: "PIX",
      payoutWeekday: 5,
      payoutCutoffWeekday: 4,
      minPayoutMinor: 2000,
      settlementHoldHours: 24,
      minTopUpMinor: 750,
      strikeThreshold: 3,
      strikeWindowDays: 7,
      active: true,
    },
  });

  for (const p of BR_PACKAGES) {
    await prisma.package.upsert({
      where: { regionId_code: { regionId: region.id, code: p.code } },
      update: { priceMinor: p.priceMinor, durationMinutes: p.durationMinutes },
      create: { ...p, regionId: region.id, hostShareBps: 8000 },
    });
  }

  // Contas de sistema (userId nulo) — findFirst porque NULL não participa do UNIQUE
  for (const type of SYSTEM_ACCOUNTS) {
    const exists = await prisma.ledgerAccount.findFirst({
      where: { type, userId: null, currency: "BRL" },
    });
    if (!exists) await prisma.ledgerAccount.create({ data: { type, currency: "BRL" } });
  }

  console.log(`Seed ok: região ${region.code}, ${BR_PACKAGES.length} pacotes, contas de sistema.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
