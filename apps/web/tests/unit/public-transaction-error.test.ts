import { describe, expect, it } from "vitest";
import { describePublicTransactionError } from "@/lib/workflows/publicTransactionError";

describe("public transaction errors", () => {
  it('asks for a fresh review if the execution quote no longer meets the approved minimum',()=>{
    const message=describePublicTransactionError(new Error('SWAP_REVIEW_MINIMUM_CHANGED'),'The swap could not be completed.');
    expect(message).toMatch(/no longer meets the minimum you reviewed/i);
    expect(message).toMatch(/before signing/i);
    expect(message).not.toContain('SWAP_REVIEW_MINIMUM_CHANGED');
  });
  it("turns wallet failures into clear recovery guidance", () => {
    expect(
      describePublicTransactionError(
        new Error("Wallet signing timed out after 30000ms"),
        "The deposit could not be completed.",
      ),
    ).toMatch(/check the wallet window and try again/i);
    expect(
      describePublicTransactionError(
        new Error("Selected wallet provider disconnected"),
        "The deposit could not be completed.",
      ),
    ).toMatch(/reconnect it and try again/i);
  });

  it("never exposes Soroban host or debug details", () => {
    const message = describePublicTransactionError(
      new Error("Deposit simulation failed: HostError: Error(Budget, ExceededLimit) DebugInfo not available"),
      "The deposit could not be completed.",
    );

    expect(message).toBe(
      "The deposit could not be completed. No funds were moved. Please try again.",
    );
    expect(message).not.toMatch(/HostError|BudgetExceeded|DebugInfo|simulation/i);
  });

  it("explains when an asset cannot be valued before signing", () => {
    const message = describePublicTransactionError(
      new Error("Deposit simulation failed: HostError: Error(Contract, #40)"),
      "The deposit could not be completed.",
    );

    expect(message).toMatch(/live valuation is not available/i);
    expect(message).toMatch(/choose an asset marked available/i);
    expect(message).not.toMatch(/HostError|Contract|#40/i);
  });

  it("does not echo unknown internal errors", () => {
    expect(
      describePublicTransactionError(
        new Error("unexpected internal implementation detail"),
        "The swap could not be completed.",
      ),
    ).toBe("The swap could not be completed.");
  });
});
