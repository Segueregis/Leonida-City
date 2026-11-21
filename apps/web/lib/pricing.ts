// Tabela do MVP (região BR-SP). Manter igual a packages/db/prisma/seed.ts.
export const HOST_SHARE = 0.8;

export const packages = [
  { code: "TEST_15", minutes: 15, priceBRL: 7.5 },
  { code: "MIN_30", minutes: 30, priceBRL: 12.5 },
  { code: "H1", minutes: 60, priceBRL: 20 },
  { code: "H3", minutes: 180, priceBRL: 50 },
] as const;

export const hostEarningPerHourBRL = 20 * HOST_SHARE; // pacote de 1 h

export const brl = (v: number, locale: string) =>
  new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", { style: "currency", currency: "BRL" }).format(v);
