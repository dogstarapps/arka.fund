import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Sodax, StellarRawSpokeProvider, getTransactionPackets } from "@/lib/server/sodaxStellarTransport";

const wallet = "GCWBC4RHJBDQWIZ2747BLJ35U5P6JPNXFAGKYWRNLDOIEBUPQ4AWSXEO";
const token = { symbol: "XLM", name: "Stellar Lumens", decimals: 7, address: "CXLM", chainKey: "stellar", hubAsset: "0xasset", vault: "0xvault" };
const wireIntent = { intentId: "1", creator: "0xcreator", inputToken: "0xin", outputToken: "0xout", inputAmount: "1000000000", minOutputAmount: "200000000", deadline: "1791306944", allowPartialFill: false, srcChain: "27", dstChain: "27", srcAddress: "0xsrc", dstAddress: "0xdst", solver: "0x0000000000000000000000000000000000000000", data: "0x" };
const tx = { from: wallet, to: "CINTENT", value: "0", data: "unsigned-xdr" };
const packet = { src_chain_id: 27, src_tx_hash: "sourcehash", src_address: "src", status: "executed", dst_chain_id: 146, conn_sn: 7216, dst_address: "dst", dst_tx_hash: "0xcanonical" };
let replies: Record<string, unknown>;
let calls: { url: string; body: Record<string, unknown>; headers: Headers; redirect: RequestRedirect | undefined }[];

beforeEach(() => {
  calls = [];
  replies = {
    "/v1/swaps/tokens/stellar": [token],
    "/v1/swaps/quote": { quotedAmount: "213288894" },
    "/v1/swaps/deadline": { deadline: wireIntent.deadline },
    "/v1/swaps/intents": { tx, intent: wireIntent, relayData: { address: "0xrelay", payload: "0xpayload" } },
    "/v1/swaps/intents/hash": { hash: "0xintenthash" },
    "/v1/swaps/intents/0xcanonical": wireIntent,
    "/v1/swaps/intents/status": { status: 3, fillTxHash: "fillhash" },
    "/v1/swaps/intents/cancel": { tx },
    "/v1/swaps/intents/submit": { result: { success: true, message: "submitted" } },
    "/v1/intent/execute": { answer: "OK", intent_hash: "0xintenthash" },
    "/": { success: true, data: [packet] },
  };
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const path = new URL(url).pathname;
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {}, headers: new Headers(init?.headers), redirect: init?.redirect });
    if (!(path in replies)) throw new Error(`Unexpected endpoint ${path}`);
    return new Response(JSON.stringify(replies[path]), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("official SODAX v2 Stellar transport compatibility", () => {
  it("preserves supported tokens and exact-input quotes with base-unit precision", async () => {
    const sdk = new Sodax();
    expect(await sdk.initialize()).toMatchObject({ ok: true });
    expect(sdk.config.getSupportedSwapTokensByChainId("stellar")).toEqual([token]);
    expect(await sdk.swaps.getQuote({ token_src: "CXLM", token_dst: "CUSDC", token_src_blockchain_id: "stellar", token_dst_blockchain_id: "stellar", amount: BigInt(1000000000), quote_type: "exact_input" })).toEqual({ ok: true, value: { quoted_amount: BigInt(213288894) } });
    expect(calls.at(-1)?.body).toEqual({ tokenSrc: "CXLM", tokenDst: "CUSDC", tokenSrcChainKey: "stellar", tokenDstChainKey: "stellar", amount: "1000000000", quoteType: "exact_input" });
  });

  it("builds only unsigned Stellar transactions and restores hub intent numeric fields", async () => {
    const sdk = new Sodax();
    const response = await sdk.swaps.createIntent({ intentParams: { inputToken: "CXLM", outputToken: "CUSDC", inputAmount: BigInt(1000000000), minOutputAmount: BigInt(200000000), deadline: BigInt(1791306944), allowPartialFill: false, srcChain: "stellar", dstChain: "stellar", srcAddress: wallet, dstAddress: wallet, solver: wireIntent.solver, data: "0x" }, spokeProvider: new StellarRawSpokeProvider(wallet, {}), raw: true, skipSimulation: false });
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("Build failed");
    const [raw, intent, payload] = response.value;
    expect(raw).toEqual({ ...tx, value: BigInt(0) });
    expect(intent).toMatchObject({ srcChain: BigInt(27), dstChain: BigInt(27), inputAmount: BigInt(1000000000) });
    expect(payload).toBe("0xpayload");
    expect(await sdk.swaps.getIntentHash(intent)).toBe("0xintenthash");
    expect(calls.at(-1)?.body.intent).toEqual(wireIntent);
    expect(calls.every(call => !call.url.includes("sendTransaction"))).toBe(true);
  });

  it("preserves relay acceptance separately from canonical packet and solver settlement", async () => {
    const sdk = new Sodax();
    expect(await sdk.swaps.submitIntent({ action: "submit", params: { chain_id: "27", tx_hash: "sourcehash" } })).toEqual({ ok: true, value: { success: true, message: "submitted" } });
    expect(calls.at(-1)?.body).toEqual({ chainId: "27", txHash: "sourcehash" });
    expect(await getTransactionPackets({ action: "get_transaction_packets", params: { chain_id: "27", tx_hash: "sourcehash" } }, sdk.relayerApiEndpoint)).toEqual({ success: true, data: [packet] });
    expect(await sdk.swaps.postExecution({ intent_tx_hash: "0xcanonical" })).toEqual({ ok: true, value: { answer: "OK", intent_hash: "0xintenthash" } });
    expect(await sdk.swaps.getStatus({ intent_tx_hash: "0xcanonical" })).toEqual({ ok: true, value: { status: 3, fill_tx_hash: "fillhash" } });
  });

  it("keeps expiry and cancellation usable for existing stored intent snapshots", async () => {
    const sdk = new Sodax();
    expect(await sdk.swaps.getSwapDeadline(BigInt(300))).toBe(BigInt(1791306944));
    const intent = await sdk.swaps.getIntent("0xcanonical");
    expect(await sdk.swaps.cancelIntent(intent, new StellarRawSpokeProvider(wallet, {}), true)).toEqual({ ok: true, value: { ...tx, value: BigInt(0) } });
    expect(calls.at(-1)?.body).toEqual({ srcChainKey: "stellar", intent: wireIntent });
  });

  it("maps receipt packets back to Arka's established snake-case representation", async () => {
    replies["/v1/swaps/intents/packet"] = { srcChainId: 27, srcTxHash: "sourcehash", srcAddress: "src", status: "executed", dstChainId: 146, connSn: 7216, dstAddress: "dst", dstTxHash: "0xcanonical", signatures: [], payload: "0x" };
    const sdk = new Sodax();
    expect(await sdk.swaps.getSolvedIntentPacket({ chainId: "stellar", fillTxHash: "fillhash", timeout: 2500 })).toEqual({ ok: true, value: packet });
  });

  it("rejects mismatching cancellation wallets and malformed relay responses", async () => {
    const sdk = new Sodax();
    const intent = await sdk.swaps.getIntent("0xcanonical");
    expect(await sdk.swaps.cancelIntent(intent, new StellarRawSpokeProvider("GOTHER", {}), true)).toMatchObject({ ok: false, error: { detail: { message: expect.stringMatching(/source does not match/) } } });
    replies["/"] = { success: true, data: [{ ...packet, conn_sn: "7216" }] };
    await expect(getTransactionPackets({ action: "get_transaction_packets", params: { chain_id: "27", tx_hash: "sourcehash" } }, sdk.relayerApiEndpoint)).rejects.toThrow("conn_sn");
    await expect(getTransactionPackets({ action: "get_transaction_packets", params: { chain_id: "27", tx_hash: "sourcehash" } }, "https://untrusted.example")).rejects.toThrow("Untrusted");
  });

  it("validates quote responses and never retries rejected mutations", async () => {
    const sdk = new Sodax();
    replies["/v1/swaps/quote"] = { quotedAmount: 12 };
    expect(await sdk.swaps.getQuote({ token_src: "CXLM", token_dst: "CUSDC", token_src_blockchain_id: "stellar", token_dst_blockchain_id: "stellar", amount: BigInt(1000000000), quote_type: "exact_input" })).toMatchObject({ ok: false });
    replies["/v1/swaps/intents/submit"] = { result: { success: false, message: "rejected" } };
    expect(await sdk.swaps.submitIntent({ action: "submit", params: { chain_id: "27", tx_hash: "sourcehash" } })).toMatchObject({ ok: false });
    expect(calls.filter(call => call.url.endsWith("/swaps/intents/submit"))).toHaveLength(1);
  });

  it("does not forward API keys to relay hosts or follow redirects", async () => {
    vi.stubEnv("SODAX_API_KEY", "test-only-secret");
    const sdk = new Sodax();
    await sdk.initialize();
    expect(calls[0].headers.get("x-api-key")).toBe("test-only-secret");
    expect(calls[0].redirect).toBe("error");
    await getTransactionPackets({ action: "get_transaction_packets", params: { chain_id: "27", tx_hash: "sourcehash" } }, sdk.relayerApiEndpoint);
    expect(calls.at(-1)?.headers.get("x-api-key")).toBeNull();
    expect(calls.at(-1)?.redirect).toBe("error");
  });
});
