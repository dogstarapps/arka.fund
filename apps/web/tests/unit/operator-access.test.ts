// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  createOperatorChallenge,
  createOperatorSession,
  OPERATOR_SESSION_COOKIE_NAME,
  resolveOperatorSessionFromRequest,
  resolveOperatorSessionTokenFromRequest,
  resolveOperatorRole,
  verifyOperatorChallenge,
  verifyOperatorMessageSignature,
  verifyOperatorSession,
} from "@/lib/server/operatorAccess";
import { deriveOperatorWalletBinding } from "@/lib/operatorAccessClient";
import {
  OPERATOR_TEST_KEYPAIR,
  OUTSIDER_TEST_KEYPAIR,
} from "../helpers/operator-auth";

describe("operator access gate", () => {
  const operator = OPERATOR_TEST_KEYPAIR;
  const outsider = OUTSIDER_TEST_KEYPAIR;

  beforeEach(() => {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", "unit-test-operator-secret");
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", operator.publicKey());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues and verifies wallet-bound operator challenges", () => {
    const challenge = createOperatorChallenge(operator.publicKey(), 1_000);

    expect(challenge?.role).toBe("operator");
    expect(challenge?.challenge).toMatch(/^arkafund-operator-access:/);
    expect(verifyOperatorChallenge(operator.publicKey(), challenge?.challenge ?? "", 1_001)).toBe(
      "operator",
    );
  });

  it("rejects wallets outside the operator allowlist", () => {
    expect(resolveOperatorRole(outsider.publicKey())).toBeNull();
    expect(createOperatorChallenge(outsider.publicKey(), 1_000)).toBeNull();
  });

  it("verifies Stellar message signatures for authorized wallets", () => {
    const challenge = createOperatorChallenge(operator.publicKey(), 1_000);
    const signature = operator
      .sign(Buffer.from(challenge?.challenge ?? "", "utf8"))
      .toString("base64");

    expect(
      verifyOperatorMessageSignature(
        operator.publicKey(),
        challenge?.challenge ?? "",
        signature,
      ),
    ).toBe(true);
    expect(
      verifyOperatorMessageSignature(
        outsider.publicKey(),
        challenge?.challenge ?? "",
        signature,
      ),
    ).toBe(false);
  });

  it("accepts SEP-53 wallet challenges without accepting other messages or wallets", () => {
    const challenge = createOperatorChallenge(operator.publicKey(), 1_000)?.challenge ?? "";
    const hash = createHash("sha256").update("Stellar Signed Message:\n").update(challenge).digest();
    const signature = operator.sign(hash).toString("base64");
    expect(verifyOperatorMessageSignature(operator.publicKey(), challenge, signature)).toBe(true);
    expect(verifyOperatorMessageSignature(operator.publicKey(), challenge + "changed", signature)).toBe(false);
    expect(verifyOperatorMessageSignature(outsider.publicKey(), challenge, signature)).toBe(false);
    expect(verifyOperatorMessageSignature(operator.publicKey(), challenge, "invalid")).toBe(false);
  });

  it("matches the official SEP-53 ASCII and multilingual test vectors", () => {
    const publicKey = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";
    expect(verifyOperatorMessageSignature(publicKey, "Hello, World!", "fO5dbYhXUhBMhe6kId/cuVq/AfEnHRHEvsP8vXh03M1uLpi5e46yO2Q8rEBzu3feXQewcQE5GArp88u6ePK6BA==")).toBe(true);
    expect(verifyOperatorMessageSignature(publicKey, "こんにちは、世界！", "CDU265Xs8y3OWbB/56H9jPgUss5G9A0qFuTqH2zs2YDgTm+++dIfmAEceFqB7bhfN3am59lCtDXrCtwH2k1GBA==")).toBe(true);
  });

  it("keeps operator sessions fail-closed when expired", () => {
    const session = createOperatorSession(operator.publicKey(), "operator", 2_000);

    expect(verifyOperatorSession(session?.token ?? "", 2_001)?.pubkey).toBe(
      operator.publicKey(),
    );
    expect(verifyOperatorSession(session?.token ?? "", 2_000 + 9 * 60 * 60 * 1_000)).toBeNull();
  });

  it("resolves sessions from bearer headers, explicit headers and httpOnly cookie mirrors", () => {
    const session = createOperatorSession(operator.publicKey(), "operator", 2_000);
    expect(session?.token).toBeTruthy();

    const bearerRequest = new Request("http://localhost/api/contracts", {
      headers: { authorization: `Bearer ${session?.token}` },
    });
    expect(resolveOperatorSessionFromRequest(bearerRequest, 2_001)?.pubkey).toBe(
      operator.publicKey(),
    );

    const explicitHeaderRequest = new Request("http://localhost/api/contracts", {
      headers: { "x-operator-session": session?.token ?? "" },
    });
    expect(resolveOperatorSessionTokenFromRequest(explicitHeaderRequest)).toBe(
      session?.token,
    );

    const cookieRequest = new Request("http://localhost/api/contracts", {
      headers: {
        cookie: [
          "theme=dark",
          `${OPERATOR_SESSION_COOKIE_NAME}=${encodeURIComponent(session?.token ?? "")}`,
        ].join("; "),
      },
    });
    expect(resolveOperatorSessionFromRequest(cookieRequest, 2_001)?.role).toBe(
      "operator",
    );
  });

  it("classifies operator wallet disconnects and provider switches as fail-closed bindings", () => {
    const pubkey = operator.publicKey();

    expect(
      deriveOperatorWalletBinding({
        sessionPubkey: pubkey.toLowerCase(),
        walletPubkey: `  ${pubkey.toLowerCase()}  `,
      }),
    ).toEqual({
      valid: true,
      pubkey,
    });

    expect(
      deriveOperatorWalletBinding({
        sessionPubkey: pubkey,
        walletPubkey: "",
      }),
    ).toEqual({
      valid: false,
      error: "Reconnect the authorized operator wallet to unlock advanced routes.",
    });

    expect(
      deriveOperatorWalletBinding({
        sessionPubkey: pubkey,
        walletPubkey: outsider.publicKey(),
      }),
    ).toEqual({
      valid: false,
      error: "Connected wallet does not match the stored operator session.",
    });
  });
});
