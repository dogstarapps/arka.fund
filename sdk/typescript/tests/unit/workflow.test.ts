import test from "node:test";
import assert from "node:assert/strict";
import {
  ARKAFUND_MAINNET_CONTRACTS,
  ArkaWorkflow,
  createMainnetConfig,
  parsePercentageToBasisPoints,
  type RoutingPlanResponse,
} from "../../src/index.js";

const TOKEN_IN = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const TOKEN_OUT = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function routingResponse(): RoutingPlanResponse {
  return {
    ok: true,
    source: "api_routing_solver",
    generatedAt: "2026-07-19T12:00:00.000Z",
    plan: {
      requestedProtocol: "AUTO",
      selectedProtocol: "PHOENIX",
      selectedCandidate: {
        routeId: "phoenix-1",
        protocol: "PHOENIX",
        title: "Phoenix",
        estimatedOutBase: 20_000_000,
        minOutBase: 19_900_000,
        available: true,
        admitted: true,
        autoEligible: true,
        pathAssets: [TOKEN_IN, TOKEN_OUT],
        hops: 1,
        adapterId: ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix,
        poolId: 1,
        note: "Live route.",
      },
      estimatedOutBase: 20_000_000,
      minOutBase: 19_900_000,
      note: "Phoenix selected.",
      candidates: [],
      guardrails: {
        status: "passed",
        blockedReasons: [],
        checks: [
          { id: "post_trade_deviation_bps", status: "passed", detail: "Within limit." },
          { id: "daily_turnover_cap_bps", status: "passed", detail: "Within limit." },
        ],
      },
    },
  };
}

test("human percentages convert exactly to contract basis points", () => {
  assert.equal(parsePercentageToBasisPoints("1.5"), 150);
  assert.equal(parsePercentageToBasisPoints("15.25"), 1525);
  assert.throws(() => parsePercentageToBasisPoints("1.234"), /two decimal/);
});

test("ArkaWorkflow converts human amounts and turns the chosen route into vault steps", async () => {
  let request: Record<string, unknown> | null = null;
  const workflow = new ArkaWorkflow(createMainnetConfig({ publicKey: ACCOUNT }), {
    routing: {
      plan: async (input: object) => {
        request = input as Record<string, unknown>;
        return routingResponse();
      },
    } as never,
  });
  const prepared = await workflow.planRebalance({
    amount: "1.25",
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    slippagePercent: 0.5,
    readerPubKey: ACCOUNT,
    projectedAllocationShiftPercent: "1.25",
  });
  const submittedRequest = request as Record<string, unknown> | null;
  assert.equal(submittedRequest?.amountBase, 12_500_000);
  assert.equal(submittedRequest?.projectedPostTradeDeviationBps, 125);
  assert.deepEqual(submittedRequest?.requiredStatefulGuardrails, [
    "post_trade_deviation_bps",
    "daily_turnover_cap_bps",
  ]);
  const steps = (workflow as unknown as {
    executionSteps(input: typeof prepared): Array<Record<string, unknown>>;
  }).executionSteps(prepared);
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.adapter, ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix);
  assert.equal(steps[0]?.amountIn, 12_500_000);
  assert.equal(steps[0]?.minOut, 19_900_000);
});

test("ArkaWorkflow refuses blocked and intent routes as AMM vault transactions", async () => {
  const workflow = new ArkaWorkflow(createMainnetConfig({ publicKey: ACCOUNT }));
  const prepared = {
    amountBase: 10,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    response: routingResponse(),
  };
  prepared.response.plan.guardrails = {
    status: "blocked",
    blockedReasons: ["Venue paused."],
    checks: [],
  };
  const execute = (workflow as unknown as {
    executionSteps(input: typeof prepared): unknown;
  }).executionSteps.bind(workflow);

  prepared.response.plan.guardrails = undefined;
  assert.throws(() => execute(prepared), /required risk checks/);

  prepared.response = routingResponse();
  prepared.response.plan.guardrails!.checks = [];
  assert.throws(() => execute(prepared), /omitted required risk checks/);

  prepared.response = routingResponse();
  prepared.response.plan.guardrails = {
    status: "blocked",
    blockedReasons: ["Venue paused."],
    checks: [],
  };
  assert.throws(() => execute(prepared), /Venue paused/);

  prepared.response = routingResponse();
  prepared.response.plan.selectedProtocol = "BALANCED";
  assert.throws(() => execute(prepared), /SODAX intent lifecycle/);

  prepared.response = routingResponse();
  prepared.response.plan.guardrails = {
    status: "passed",
    blockedReasons: [],
    checks: [
      {
        id: "post_trade_deviation_bps",
        status: "passed",
        detail: "Within limit.",
      },
      {
        id: "daily_turnover_cap_bps",
        status: "requires_state",
        detail: "Vault NAV is required.",
      },
    ],
  };
  assert.throws(() => execute(prepared), /requires current vault state/);
});

test("ArkaWorkflow normalizes human-readable Blend and credit amounts", () => {
  const workflow = new ArkaWorkflow(createMainnetConfig({ publicKey: ACCOUNT }));
  const blend = (workflow as unknown as {
    normalizeBlendAction(input: object): { action: Record<string, unknown> };
  }).normalizeBlendAction({
    arkaId: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
    adapter: ARKAFUND_MAINNET_CONTRACTS.adapterBlendFixedXlmUsdc,
    marketId: 1,
    assetContract: TOKEN_IN,
    amount: "25.5",
  });
  assert.equal(blend.action.manager, ACCOUNT);
  assert.equal(blend.action.amount, 255_000_000n);

  const credit = (workflow as unknown as {
    normalizeCreditAction(input: object): { action: Record<string, unknown> };
  }).normalizeCreditAction({
    arkaId: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
    protocol: { tag: "Blend", values: undefined },
    marketId: 1,
    assetContract: TOKEN_IN,
    amount: "0.125",
  });
  assert.equal(credit.action.amount, 1_250_000n);
});

test("ArkaWorkflow approves the vault before depositing when allowance is insufficient", async () => {
  const workflow = new ArkaWorkflow(createMainnetConfig({ publicKey: ACCOUNT }));
  const calls: Array<{ method: string; input?: unknown }> = [];
  const approval = { hash: "approval", simulationResult: null };
  const deposit = { hash: "deposit", simulationResult: 100_000n };

  Object.assign(workflow as unknown as Record<string, unknown>, {
    tokenModule: () => ({
      balance: async () => 1_000_000n,
      allowance: async () => 0n,
      approve: async (input: unknown) => {
        calls.push({ method: "approve", input });
        return approval;
      },
    }),
    vaultModule: () => ({
      deposit: async (input: unknown) => {
        calls.push({ method: "deposit", input });
        return deposit;
      },
    }),
  });

  const result = await workflow.depositWithApproval({
    arkaId: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
    account: ACCOUNT,
    assetContract: TOKEN_IN,
    amount: "0.01",
  }, 123_456);

  assert.equal(result.approval, approval);
  assert.equal(result.deposit, deposit);
  assert.deepEqual(calls, [
    {
      method: "approve",
      input: {
        owner: ACCOUNT,
        spender: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
        amount: 100_000n,
        expirationLedger: 123_456,
      },
    },
    {
      method: "deposit",
      input: {
        user: ACCOUNT,
        asset: { contract: TOKEN_IN },
        amount: 100_000n,
      },
    },
  ]);
});

test("ArkaWorkflow rejects a deposit before approval when token balance is insufficient", async () => {
  const workflow = new ArkaWorkflow(createMainnetConfig({ publicKey: ACCOUNT }));
  Object.assign(workflow as unknown as Record<string, unknown>, {
    tokenModule: () => ({
      balance: async () => 99_999n,
      allowance: async () => 0n,
    }),
  });

  await assert.rejects(
    workflow.depositWithApproval({
      arkaId: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
      account: ACCOUNT,
      assetContract: TOKEN_IN,
      amount: "0.01",
    }, 123_456),
    /not have enough balance/,
  );
});
