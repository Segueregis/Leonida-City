import { test } from "node:test";
import assert from "node:assert/strict";
import { assertBalanced, pixFee, topUpFeeLegs, topUpLegs } from "./index.ts";

test("recarga soma zero e credita a carteira", () => {
  const legs = topUpLegs(5000);
  assert.equal(legs.reduce((s, l) => s + l.amountMinor, 0), 0);
  assert.deepEqual(legs.find((l) => l.account === "PLAYER_WALLET"), { account: "PLAYER_WALLET", amountMinor: 5000 });
});

test("taxa Pix 0,99%", () => {
  assert.equal(pixFee(5000), 50); // exemplo da ARQUITETURA.md
  assert.equal(pixFee(750), 7);
  assert.deepEqual(topUpFeeLegs(0), []);
  assert.equal(topUpFeeLegs(50).reduce((s, l) => s + l.amountMinor, 0), 0);
});

test("rejeita transação desbalanceada, fracionada ou recarga inválida", () => {
  assert.throws(() => assertBalanced([{ account: "PLAYER_WALLET", amountMinor: 1 }, { account: "EXTERNAL_PIX_IN", amountMinor: 0 }]));
  assert.throws(() => assertBalanced([{ account: "PLAYER_WALLET", amountMinor: 10 }, { account: "EXTERNAL_PIX_IN", amountMinor: -9 }]));
  assert.throws(() => assertBalanced([{ account: "PLAYER_WALLET", amountMinor: 1.5 }, { account: "EXTERNAL_PIX_IN", amountMinor: -1.5 }]));
  assert.throws(() => topUpLegs(-100));
});
