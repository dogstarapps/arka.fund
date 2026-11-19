import { expect, test } from "@playwright/test";

test("balanced official evidence surface exposes SODAX lifecycle posture", async ({
  request,
}) => {
  const response = await request.get("/api/intents/balanced/evidence");
  const payload = await response.json();

  expect(response.status()).toBe(200);
  expect(payload.provider).toBe("sodax_sdk");
  expect(payload.architecture).toBe("intent_interchain");
  expect(payload.evidence.surface).toBe(
    "quote_build_relay_submit_status_receipt_refund_expiry",
  );
  expect(payload.evidence.checks.noPublicRouterContractId).toBe(true);
  for (const endpoint of [
    "quote",
    "build",
    "relay",
    "submit",
    "status",
    "receipt",
    "expiry",
    "refund",
  ]) {
    expect(payload.evidence.endpoints).toHaveProperty(endpoint);
  }
  expect(
    payload.evidence.machineConsumableActions.map(
      (action: { action: string; method: string; provider: string }) => ({
        action: action.action,
        method: action.method,
        provider: action.provider,
      }),
    ),
  ).toEqual([
    {
      action: "quote",
      method: "Sodax.swaps.getQuote",
      provider: "sodax_sdk",
    },
    {
      action: "build",
      method: "Sodax.swaps.createIntent",
      provider: "sodax_sdk",
    },
    {
      action: "relay",
      method: "Sodax.swaps.submitIntent",
      provider: "sodax_sdk",
    },
    {
      action: "submit",
      method: "Sodax.swaps.postExecution",
      provider: "sodax_sdk",
    },
    {
      action: "status",
      method: "Sodax.swaps.getStatus",
      provider: "sodax_sdk",
    },
    {
      action: "receipt",
      method: "Sodax.swaps.getSolvedIntentPacket",
      provider: "sodax_sdk",
    },
    {
      action: "expiry",
      method: "Sodax.swaps.getIntent",
      provider: "sodax_sdk",
    },
    {
      action: "refund",
      method: "Sodax.swaps.cancelIntent",
      provider: "sodax_sdk",
    },
  ]);
  expect(payload.autoSurface).toEqual(
    expect.objectContaining({
      plannerAdmission: expect.stringMatching(/^(auto|manual_only|blocked)$/),
      laneReady: expect.any(Boolean),
      surfaceReady: expect.any(Boolean),
      officialEvidenceReady: expect.any(Boolean),
      officialAutoComparable: expect.any(Boolean),
      autoReady: expect.any(Boolean),
    }),
  );
});

test("balanced intent public surface enforces deterministic validation guards", async ({ request }) => {
  const quoteResponse = await request.post("/api/intents/balanced/quote", {
    data: {
      tokenIn: "CAAA",
      tokenOut: "CBBB",
      amountInBase: "0",
    },
  });
  const quotePayload = await quoteResponse.json();
  expect(quoteResponse.status()).toBe(400);
  expect(String(quotePayload.error || "")).toMatch(/positive integer string/i);

  const statusResponse = await request.post("/api/intents/balanced/status", {
    data: {
      intentTxHash: "invalid-hash",
    },
  });
  const statusPayload = await statusResponse.json();
  expect(statusResponse.status()).toBe(400);
  expect(String(statusPayload.error || "")).toMatch(/0x-prefixed hex hash/i);

  const confirmResponse = await request.post("/api/intents/balanced/confirm", {
    data: {
      intentTxHash: "invalid-hash",
    },
  });
  const confirmPayload = await confirmResponse.json();
  expect(confirmResponse.status()).toBe(400);
  expect(String(confirmPayload.error || "")).toMatch(/0x-prefixed hex hash/i);

  const statusGetResponse = await request.get(
    "/api/intents/balanced/status?intentTxHash=invalid-hash",
  );
  const statusGetPayload = await statusGetResponse.json();
  expect(statusGetResponse.status()).toBe(400);
  expect(String(statusGetPayload.error || "")).toMatch(/0x-prefixed hex hash/i);

  const confirmGetResponse = await request.get(
    "/api/intents/balanced/confirm?intentTxHash=invalid-hash",
  );
  const confirmGetPayload = await confirmGetResponse.json();
  expect(confirmGetResponse.status()).toBe(400);
  expect(String(confirmGetPayload.error || "")).toMatch(/0x-prefixed hex hash/i);

  const routingStatusResponse = await request.get(
    "/api/routing/rebalance/status?intentTxHash=invalid-hash",
  );
  const routingStatusPayload = await routingStatusResponse.json();
  expect(routingStatusResponse.status()).toBe(400);
  expect(routingStatusPayload.ok).toBe(false);
  expect(String(routingStatusPayload.error || "")).toMatch(/0x-prefixed hex hash/i);
});
