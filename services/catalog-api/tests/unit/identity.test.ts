import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import { createSep53MessageHash } from "../../src/identity.js";

test("SEP-53 message hashing verifies the official Stellar test vector", () => {
  const publicKey = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";
  const signature =
    "fO5dbYhXUhBMhe6kId/cuVq/AfEnHRHEvsP8vXh03M1uLpi5e46yO2Q8rEBzu3feXQewcQE5GArp88u6ePK6BA==";

  assert.equal(
    Keypair.fromPublicKey(publicKey).verify(
      createSep53MessageHash("Hello, World!"),
      Buffer.from(signature, "base64"),
    ),
    true,
  );
});

// Cryptographic cases require the explicit contained ephemeral-key test profile.
const cryptoTest = process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS === '1' ? test : test.skip;
cryptoTest("SEP-53 signatures are not interchangeable with raw-message signatures", () => {
  const keypair = Keypair.random();
  const message = "Arka identity update";
  const rawSignature = keypair.sign(Buffer.from(message, "utf8"));

  assert.equal(keypair.verify(createSep53MessageHash(message), rawSignature), false);
});
