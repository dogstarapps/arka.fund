import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Account, TransactionBuilder, Operation, StrKey } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/lib/config";
const source=StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(8));
const UNSIGNED_XDR=new TransactionBuilder(new Account(source,"0"),{fee:"100",networkPassphrase:NETWORK_PASSPHRASE}).addOperation(Operation.manageData({name:"test",value:"fixture"})).setTimeout(0).build().toXDR();
const SIGNED_XDR=UNSIGNED_XDR; // RPC boundary is mocked; signature validation has separate ephemeral-key tests.
import { signXdr, submitSignedTx } from "@/lib/tx";

const freighterMocks = vi.hoisted(() => ({
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: freighterMocks.signTransaction,
}));

describe("tx signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails closed when the selected wallet provider disconnects", async () => {
    const kit = {
      signTransaction: vi.fn(async () => {
        throw new Error("Wallet provider disconnected");
      }),
    };
    freighterMocks.signTransaction.mockResolvedValue({
      signedTxXdr: "DIRECT_FREIGHTER_XDR",
    });

    await expect(signXdr(kit as never, UNSIGNED_XDR)).rejects.toThrow(
      /wallet signature unavailable: wallet provider disconnected/i,
    );
    expect(kit.signTransaction).toHaveBeenCalledWith(UNSIGNED_XDR, {
      networkPassphrase: expect.any(String),
      submit: false,
    });
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
  });

  it("fails closed with the selected provider error only", async () => {
    const kit = {
      signTransaction: vi.fn(async () => {
        throw new Error("Wallet provider disconnected");
      }),
    };
    freighterMocks.signTransaction.mockRejectedValue(
      new Error("Freighter not available"),
    );

    await expect(signXdr(kit as never, UNSIGNED_XDR)).rejects.toThrow(
      /wallet signature unavailable: wallet provider disconnected/i,
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
  });

  it("fails closed when no selected wallet signer is available", async () => {
    const kit = {};
    freighterMocks.signTransaction.mockResolvedValue({});

    await expect(signXdr(kit as never, UNSIGNED_XDR)).rejects.toThrow(
      /wallet signature unavailable: wallet kit signer is unavailable/i,
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
  });

  it("does not fall back to Freighter when the selected wallet returns a malformed signature", async () => {
    const kit = {
      signTransaction: vi.fn(async () => ({})),
    };
    freighterMocks.signTransaction.mockResolvedValue({
      signedTxXdr: "DIRECT_FREIGHTER_XDR",
    });

    await expect(signXdr(kit as never, UNSIGNED_XDR)).rejects.toThrow(
      /wallet signature unavailable: wallet kit signature missing/i,
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
  });

  it("fails closed when the selected wallet signer never resolves", async () => {
    vi.useFakeTimers();
    const kit = {
      signTransaction: vi.fn(() => new Promise<unknown>(() => undefined)),
    };
    const signing = signXdr(kit as never, UNSIGNED_XDR);
    const assertion = expect(signing).rejects.toThrow(
      /wallet signature unavailable: wallet signing timed out after 30000ms/i,
    );

    await vi.advanceTimersByTimeAsync(30_001);

    await assertion;
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
  });

  it("fails closed immediately when no selected signer exists even if Freighter would hang", async () => {
    const kit = {};
    freighterMocks.signTransaction.mockImplementation(
      () => new Promise<unknown>(() => undefined),
    );
    await expect(signXdr(kit as never, UNSIGNED_XDR)).rejects.toThrow(
      /wallet signature unavailable: wallet kit signer is unavailable/i,
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
  });

  it("returns the transaction hash when RPC accepts the signed transaction", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            status: "PENDING",
            hash: "abc123",
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitSignedTx(SIGNED_XDR)).resolves.toBe("abc123");
  });

  it("fails immediately when RPC returns ERROR even if a hash is present", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            status: "ERROR",
            hash: "abc123",
            errorResultXdr: "AAAAAAAAAAD////wAAAAAA==",
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitSignedTx(SIGNED_XDR)).rejects.toThrow(
      /sendtransaction failed with status error/i,
    );
  });
});
