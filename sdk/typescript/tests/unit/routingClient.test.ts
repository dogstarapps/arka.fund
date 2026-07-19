import test from "node:test";
import assert from "node:assert/strict";
import {
  RoutingApiError,
  RoutingClient,
  type RoutingPlanResponse,
} from "../../src/index.js";

const TOKEN_IN = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const TOKEN_OUT = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

test("RoutingClient posts a typed AUTO best-execution request", async () => {
  let received: Record<string, unknown> | null = null;
  const response: RoutingPlanResponse = {
    ok: true,
    source: "api_routing_solver",
    generatedAt: "2026-07-19T12:00:00.000Z",
    plan: {
      requestedProtocol: "AUTO",
      selectedProtocol: "PHOENIX",
      selectedCandidate: null,
      estimatedOutBase: 20,
      minOutBase: 19,
      note: "Phoenix selected.",
      candidates: [],
    },
  };
  const client = new RoutingClient({
    baseUrl: "https://app.example",
    fetchImpl: async (_url, init) => {
      received = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await client.plan({
    requestedProtocol: "AUTO",
    amountBase: 10,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    slippagePct: 0.5,
  });
  assert.equal(result.plan.selectedProtocol, "PHOENIX");
  const posted = received as Record<string, unknown> | null;
  assert.equal(posted?.amountBase, 10);
  assert.equal(posted?.manualMinOutBase, 0);
});

test("RoutingClient rejects unsafe numbers and surfaces server failures", async () => {
  const client = new RoutingClient({
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: "unavailable" }), { status: 503 }),
  });
  await assert.rejects(
    client.plan({
      requestedProtocol: "AUTO",
      amountBase: Number.MAX_SAFE_INTEGER + 1,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      slippagePct: 0.5,
    }),
    /safe integer/,
  );
  await assert.rejects(
    client.plan({
      requestedProtocol: "AUTO",
      amountBase: 10,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      slippagePct: 0.5,
    }),
    RoutingApiError,
  );
});
