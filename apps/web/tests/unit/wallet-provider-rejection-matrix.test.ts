import { describe, expect, it, vi } from "vitest";
import {
  WALLET_PROVIDER_FAILURE_SCENARIOS,
  WALLET_WRITE_LANES,
  buildWalletProviderRejectionMatrix,
  classifyWalletProviderFailure,
  extractSignedTransactionXdr,
  requireSignedTransactionXdr,
  summarizeWalletProviderRejectionMatrix,
  validateWalletProviderRejectionMatrix,
  withWalletSigningTimeout,
} from "@/lib/workflows/walletProviderRejectionMatrix";

describe("wallet provider rejection matrix", () => {
  it("covers every wallet-backed write lane and every rejection scenario", () => {
    const cases = buildWalletProviderRejectionMatrix();
    const validation = validateWalletProviderRejectionMatrix(cases);
    const summary = summarizeWalletProviderRejectionMatrix(cases);

    expect(validation.ok).toBe(true);
    expect(summary.lanes).toBe(7);
    expect(summary.scenarios).toBe(5);
    expect(summary.cases).toBe(35);
    expect(summary.failClosedCases).toBe(35);
    expect(summary.holderLanes).toBeGreaterThanOrEqual(3);
    expect(summary.managerLanes).toBeGreaterThanOrEqual(2);
    expect(summary.operatorLanes).toBeGreaterThanOrEqual(1);

    for (const lane of WALLET_WRITE_LANES) {
      for (const scenario of WALLET_PROVIDER_FAILURE_SCENARIOS) {
        expect(cases).toContainEqual(
          expect.objectContaining({
            id: `${lane.id}:${scenario.id}`,
            lane,
            scenario,
            expectedOutcome: expect.objectContaining({
              failClosed: true,
              preservesFormState: true,
              submitsTransaction: false,
            }),
          }),
        );
      }
      expect(lane.writeActionTestIds.length).toBeGreaterThan(0);
      expect(lane.preservedStateTestIds.length).toBeGreaterThan(0);
      expect(lane.noSubmitGuard).toMatch(/submit|sendTransaction|Swap|Governor/i);
    }
  });

  it("classifies wallet failures with the same categories used by the matrix", () => {
    expect(classifyWalletProviderFailure(new Error("Wallet signature rejected by user"))).toBe(
      "user_rejected",
    );
    expect(classifyWalletProviderFailure("Selected wallet provider disconnected")).toBe(
      "provider_disconnected",
    );
    expect(classifyWalletProviderFailure("Wallet kit signature missing")).toBe(
      "malformed_signature",
    );
    expect(classifyWalletProviderFailure("Wallet signing timed out after 30000ms")).toBe(
      "signing_timeout",
    );
    expect(classifyWalletProviderFailure({ unexpected: true })).toBe("unknown");
  });

  it("accepts only non-empty signed transaction payloads", () => {
    expect(extractSignedTransactionXdr("SIGNED_XDR")).toBe("SIGNED_XDR");
    expect(extractSignedTransactionXdr({ signedTxXdr: "SIGNED_OBJECT_XDR" })).toBe(
      "SIGNED_OBJECT_XDR",
    );
    expect(extractSignedTransactionXdr({ signedTxXdr: "" })).toBeNull();
    expect(extractSignedTransactionXdr({ ok: true })).toBeNull();

    expect(requireSignedTransactionXdr({ signedTxXdr: "SIGNED_OBJECT_XDR" }, "Wallet kit")).toBe(
      "SIGNED_OBJECT_XDR",
    );
    expect(() => requireSignedTransactionXdr({ ok: true }, "Wallet kit")).toThrow(
      /wallet kit signature missing/i,
    );
  });

  it("converts a stalled signing promise into a fail-closed timeout", async () => {
    vi.useFakeTimers();
    const stalled = withWalletSigningTimeout(new Promise<string>(() => undefined), 25);
    const assertion = expect(stalled).rejects.toThrow(
      /wallet signing timed out after 25ms/i,
    );
    await vi.advanceTimersByTimeAsync(26);
    await assertion;
    vi.useRealTimers();
  });
});
