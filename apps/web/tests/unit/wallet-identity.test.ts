import { describe, expect, it } from "vitest";
import {
  normalizeWalletPubkey,
  resolveWalletChangedPubkey,
  shouldPauseWalletAutoHydration,
} from "@/lib/workflows/walletIdentity";

describe("wallet identity workflow helpers", () => {
  it("normalizes wallet pubkeys without inventing identity values", () => {
    expect(normalizeWalletPubkey("  GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX  ")).toBe(
      "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    );
    expect(normalizeWalletPubkey(null)).toBe("");
    expect(normalizeWalletPubkey(undefined)).toBe("");
    expect(normalizeWalletPubkey({ address: "G" })).toBe("");
  });

  it("treats explicit empty wallet events as disconnects instead of falling back to stale storage", () => {
    expect(
      resolveWalletChangedPubkey(
        "",
        "GSTALE7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      ),
    ).toBe("");
    expect(
      resolveWalletChangedPubkey(
        "  GNEW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX  ",
        "GSTALE7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      ),
    ).toBe("GNEW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX");
  });

  it("falls back to storage only when the wallet event does not carry an explicit detail", () => {
    expect(
      resolveWalletChangedPubkey(
        undefined,
        "GSTORED7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      ),
    ).toBe("GSTORED7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX");
  });

  it("pauses auto hydration only while the wallet lane is explicitly empty", () => {
    expect(shouldPauseWalletAutoHydration("")).toBe(true);
    expect(shouldPauseWalletAutoHydration("  ")).toBe(true);
    expect(
      shouldPauseWalletAutoHydration(
        "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      ),
    ).toBe(false);
  });
});
