import { describe, expect, it } from "vitest";
import { deriveOperatorWalletBinding } from "@/lib/operatorAccessClient";

describe("operatorAccessClient", () => {
  it("accepts a stored operator session only when the wallet identity matches", () => {
    expect(
      deriveOperatorWalletBinding({
        sessionPubkey: " gdemo ",
        walletPubkey: "GDEMO",
      }),
    ).toEqual({
      valid: true,
      pubkey: "GDEMO",
    });
  });

  it("fails closed when the connected wallet is missing or mismatched", () => {
    expect(
      deriveOperatorWalletBinding({
        sessionPubkey: "GDEMO",
        walletPubkey: "",
      }),
    ).toMatchObject({
      valid: false,
      error: "Reconnect the authorized operator wallet to unlock advanced routes.",
    });

    expect(
      deriveOperatorWalletBinding({
        sessionPubkey: "GDEMO",
        walletPubkey: "GOTHER",
      }),
    ).toMatchObject({
      valid: false,
      error: "Connected wallet does not match the stored operator session.",
    });
  });
});
