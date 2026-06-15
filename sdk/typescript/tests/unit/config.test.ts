import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";

import {
  createKeypairSigner,
  mergeCallOptions,
  requireSigner,
} from "../../src/index.js";

test("mergeCallOptions inherits sdk defaults and allows overrides", () => {
  const config = {
    rpcUrl: "https://example.invalid/rpc",
    networkPassphrase: "Test SDF Network ; September 2015",
    fee: 250,
    timeoutInSeconds: 90,
  };

  assert.deepEqual(mergeCallOptions(config, undefined, true), {
    fee: 250,
    timeoutInSeconds: 90,
    simulate: true,
  });
  assert.deepEqual(mergeCallOptions(config, { fee: 500, simulate: false }, true), {
    fee: 500,
    timeoutInSeconds: 90,
    simulate: false,
  });
});

test("requireSigner rejects unsigned configuration", () => {
  assert.throws(
    () =>
      requireSigner({
        rpcUrl: "https://example.invalid/rpc",
        networkPassphrase: "Test SDF Network ; September 2015",
      }),
    /requires both publicKey and signTransaction/,
  );
});

test("createKeypairSigner derives a public key", () => {
  const secret = Keypair.random().secret();
  const signer = createKeypairSigner(
    secret,
    "Test SDF Network ; September 2015",
  );
  assert.match(signer.publicKey, /^G[A-Z2-7]{55}$/);
});
