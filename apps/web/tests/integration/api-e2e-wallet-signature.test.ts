// @vitest-environment node

import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

const SEP_53_PREFIX = Buffer.from("Stellar Signed Message:\n", "utf8");

describe("E2E wallet message signing", () => {
  const keypair = Keypair.random();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_E2E_WALLET", "1");
    vi.stubEnv("E2E_WALLET_SECRET", keypair.secret());
    vi.stubEnv("ARKAFUND_DEPLOYMENT_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs the SEP-53 message hash used by real Stellar wallets", async () => {
    const { POST } = await import("@/app/api/e2e-wallet/route");
    const message = '{"action":"identity.update"}';
    const response = await POST(
      new Request("http://localhost/api/e2e-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    );
    const body = (await response.json()) as { signedMessage: string };
    const hash = createHash("sha256")
      .update(SEP_53_PREFIX)
      .update(Buffer.from(message, "utf8"))
      .digest();

    expect(response.status).toBe(200);
    expect(keypair.verify(hash, Buffer.from(body.signedMessage, "base64"))).toBe(true);
    expect(keypair.verify(Buffer.from(message, "utf8"), Buffer.from(body.signedMessage, "base64"))).toBe(false);
  });
});
