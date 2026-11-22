// Regras de dinheiro puras (sem banco). Valores sempre em centavos inteiros.
// Ver docs/ARQUITETURA.md §4.

export type AccountType =
  | "PLAYER_WALLET"
  | "PLAYER_HOLD"
  | "HOST_PENDING"
  | "HOST_AVAILABLE"
  | "PLATFORM_REVENUE"
  | "PLATFORM_PROMO"
  | "EXTERNAL_PIX_IN"
  | "EXTERNAL_PIX_OUT"
  | "EXTERNAL_PSP_FEES"
  | "EXTERNAL_REFUNDS";

/** Lançamento ainda sem conta resolvida: `account` é o tipo; contas de usuário são resolvidas pelo chamador. */
export type Leg = { account: AccountType; amountMinor: number };

/** Taxa do Mercado Pago no Pix: 0,99%, arredondada para o centavo mais próximo. */
export const PIX_FEE_BPS = 99;
export const pixFee = (amountMinor: number) => Math.round((amountMinor * PIX_FEE_BPS) / 10_000);

/** Regra de ouro: toda transação soma zero e só tem valores inteiros diferentes de zero. */
export function assertBalanced(legs: Leg[]) {
  if (legs.length < 2) throw new Error("ledger: transação precisa de pelo menos 2 lançamentos");
  let sum = 0;
  for (const l of legs) {
    if (!Number.isSafeInteger(l.amountMinor) || l.amountMinor === 0) {
      throw new Error(`ledger: valor inválido ${l.amountMinor} em ${l.account}`);
    }
    sum += l.amountMinor;
  }
  if (sum !== 0) throw new Error(`ledger: transação desbalanceada (soma ${sum})`);
  return legs;
}

/** Recarga Pix paga: dinheiro entra no sistema e vira saldo do jogador. */
export function topUpLegs(amountMinor: number): Leg[] {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("ledger: recarga deve ser positiva");
  return assertBalanced([
    { account: "EXTERNAL_PIX_IN", amountMinor: -amountMinor },
    { account: "PLAYER_WALLET", amountMinor },
  ]);
}

/** Taxa do PSP sobre a recarga: despesa da plataforma (o jogador recebe o valor cheio). */
export function topUpFeeLegs(feeMinor: number): Leg[] {
  if (feeMinor <= 0) return [];
  return assertBalanced([
    { account: "PLATFORM_REVENUE", amountMinor: -feeMinor },
    { account: "EXTERNAL_PSP_FEES", amountMinor: feeMinor },
  ]);
}

/** Formata centavos em reais: 1250 → "R$ 12,50". */
export const formatBRL = (minor: number) =>
  (minor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
