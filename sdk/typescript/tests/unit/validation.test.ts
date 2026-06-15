import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureBps,
  ensurePositiveInt,
  ensureSorobanAddress,
} from "../../src/index.js";

test("ensurePositiveInt normalizes numbers, strings, and bigint", () => {
  assert.equal(ensurePositiveInt(7, "amount"), 7n);
  assert.equal(ensurePositiveInt("8", "amount"), 8n);
  assert.equal(ensurePositiveInt(9n, "amount"), 9n);
});

test("ensurePositiveInt rejects zero and negative values", () => {
  assert.throws(() => ensurePositiveInt(0, "amount"), /greater than zero/);
  assert.throws(() => ensurePositiveInt(-1, "amount"), /greater than zero/);
});

test("ensureBps enforces basis point boundaries", () => {
  assert.equal(ensureBps(0, "bps"), 0);
  assert.equal(ensureBps(10_000, "bps"), 10_000);
  assert.throws(() => ensureBps(10_001, "bps"), /between 0 and 10000/);
});

test("ensureSorobanAddress validates strkey-shaped account and contract ids", () => {
  const valid = `C${"A".repeat(55)}`.replace(/A/g, "B");
  assert.equal(ensureSorobanAddress(valid, "address"), valid);
  assert.throws(() => ensureSorobanAddress("not-an-address", "address"), /Soroban address/);
});
