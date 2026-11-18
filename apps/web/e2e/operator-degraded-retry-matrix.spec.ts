import { expect, test, type Page } from "@playwright/test";
import {
  OPERATOR_SURFACE_BROWSER_PROJECTS,
  OPERATOR_SURFACE_ROUTES,
  getOperatorSurfaceMatrixSummary,
  validateOperatorSurfaceMatrix,
} from "../src/lib/qa/operatorSurfaceMatrix";
import { OPERATOR_CONSOLE_NAV } from "../src/lib/workflows/productNavigation";
import { enableOperatorMode } from "./helpers/operator-mode";

const VALID_CONTRACT_ID =
  "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
const VALID_HASH = "ab".repeat(32);

test.describe.configure({ timeout: 90_000 });

async function expectNoPageHorizontalOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const offenders = Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          testId: element.getAttribute("data-testid") ?? "",
          width: Math.round(box.width),
          left: Math.round(box.left),
          right: Math.round(box.right),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.left < -1 ||
            entry.right > window.innerWidth + 1 ||
            entry.scrollWidth > entry.clientWidth + 1),
      )
      .slice(0, 8);

    return {
      ok: overflow <= 1,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow,
      offenders,
    };
  });

  expect(report, JSON.stringify(report, null, 2)).toMatchObject({ ok: true });
}

async function countViewportClippedControls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [role="button"]',
      ),
    );
    return controls.filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return false;
      return box.left < -1 || box.right > window.innerWidth + 1;
    }).length;
  });
}

async function expectRouteLoaded(page: Page, route: (typeof OPERATOR_SURFACE_ROUTES)[number]) {
  await page.getByTestId("product-canvas").waitFor({
    state: "attached",
    timeout: 15_000,
  });
  await expect(page.getByTestId(route.loadedAnchorTestId)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(route.activeTestId)).toHaveClass(
    /chrome-utility-link-active/,
  );
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
}

function buildReadyHealthPayload() {
  return {
    app: "ok",
    catalog: {
      configured: true,
      reachable: true,
      healthy: true,
      degraded: false,
      statusCode: 200,
      evaluatedAt: "2026-05-19T10:00:00.000Z",
    },
    protocols: {
      balanced: {
        supportStatus: "blocked",
        laneMode: "undeclared",
        blockingReasons: ["Balanced AUTO surface not wired."],
      },
    },
    routing: {
      mode: "backend_solver_with_local_fallback",
      planEndpoint: "/api/routing/rebalance/plan",
      fallbackMode: "local_workflow_solver",
      backendAvailable: true,
      generatedAt: "2026-05-19T10:00:00.000Z",
      balancedPlannerAdmission: "blocked",
      balancedManualExecutionEligible: false,
      balancedComparableQuote: false,
      balancedSupportStatus: "blocked",
      balancedLaneMode: "undeclared",
      balancedAutoSurfaceReady: false,
      balancedAutoSurfaceReason: "Official surface pending",
      note: "Backend solver reachable.",
    },
    oracle: {
      source: "deployments",
      metrics: {
        ranking: "catalog_rank",
        nav: "reflector_oracle_guard",
        profit: "reflector_oracle_guard",
        volume: "catalog_volume_or_activity",
        activityFallbackWindowEvents: 60,
      },
      oracle: {
        mode: "oracle_guard",
        validatedAt: "2026-05-19T10:00:00.000Z",
        network: "testnet",
        rpcUrl: "https://soroban-testnet.stellar.org",
        oracleGuard: "CORACLE",
        primaryOracle: "CREFLECTOR",
        secondaryOracle: null,
        primaryProvider: "Reflector",
        secondaryProvider: null,
        validationAsset: "XLM",
        selectedSourceUnderDivergence: null,
        source: "deployments",
      },
      deployment: {
        targetNetwork: "testnet",
        deploymentsPath: "/tmp/deployments.testnet.json",
        pathSource: "env_path",
        fileFound: true,
        networkMismatch: false,
        readError: null,
      },
    },
  };
}

async function installMigrationsInspectRoute(page: Page, failFirst = false) {
  let inspectRequests = 0;
  await page.route("**/api/migrations/inspect**", async (route) => {
    inspectRequests += 1;
    if (failFirst && inspectRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Factory inspection offline.",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        snapshot: {
          factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
          registryId: VALID_CONTRACT_ID,
          sourceArka: VALID_CONTRACT_ID,
          targetArka: VALID_CONTRACT_ID,
          implementationGetterSupported: true,
          currentImplementation: VALID_HASH,
          registryGetterSupported: true,
          currentRegistry: VALID_CONTRACT_ID,
          currentShareTokenImplementation: VALID_HASH,
          migratedTo: "",
          migratedFrom: "",
          sourceShareToken: VALID_CONTRACT_ID,
          targetShareToken: VALID_CONTRACT_ID,
        },
      }),
    });
  });
  return () => inspectRequests;
}

test("T14 matrix is canonical and every operator route stays gated until verified", async ({
  page,
}, testInfo) => {
  expect(validateOperatorSurfaceMatrix()).toEqual([]);
  expect(OPERATOR_SURFACE_ROUTES.map((route) => route.path)).toEqual(
    OPERATOR_CONSOLE_NAV.map((item) => item.href),
  );
  expect(OPERATOR_SURFACE_BROWSER_PROJECTS).toContain(testInfo.project.name);
  expect(getOperatorSurfaceMatrixSummary()).toMatchObject({
    routeCount: 8,
    stateCount: 6,
  });

  for (const route of OPERATOR_SURFACE_ROUTES) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("operator-route-gate")).toBeVisible();
    await expect(page.getByTestId("operator-route-gate")).toContainText(
      route.label,
    );
    await expect(page.getByTestId(route.loadedAnchorTestId)).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
    expect(await countViewportClippedControls(page)).toBe(0);
  }

  await enableOperatorMode(page);

  for (const route of OPERATOR_SURFACE_ROUTES) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expectRouteLoaded(page, route);
  }
});

test("T14 status, settings and contracts degrade safely without empty operator UI", async ({
  page,
}) => {
  let healthRequests = 0;
  let mutationRequests = 0;
  let storageRequests = 0;

  await enableOperatorMode(page);
  await page.route("**/api/health", async (route) => {
    healthRequests += 1;
    await route.fulfill({
      status: healthRequests === 1 ? 500 : 200,
      contentType: "application/json",
      body:
        healthRequests === 1
          ? JSON.stringify({ error: "health offline" })
          : JSON.stringify(buildReadyHealthPayload()),
    });
  });
  await page.route("**/api/routing/rebalance/benchmark", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "routing_benchmark",
        generatedAt: "2026-05-19T10:00:00.000Z",
        benchmark: {
          overallPassed: true,
          resultCount: 1,
          passedCount: 1,
          worstEfficiencyBps: 10_000,
          results: [
            {
              id: "operator-matrix-route",
              label: "Operator matrix route",
              mode: "single_route",
              passed: true,
              minEfficiencyBps: 9_850,
              plannerEfficiencyBps: 10_000,
              amountBase: 1_000_000,
              plannerEstimatedOutBase: 1_100_000,
              oracleEstimatedOutBase: 1_100_000,
              plannerSelectedProtocol: "SOROSWAP",
              plannerSelectedPath: "CAAA -> CBBB",
              splitStatus: "single_route_optimal",
              splitAllocationCount: 1,
              candidateUniverseSize: 2,
              quotedPathCount: 2,
              exhaustivePathCount: 2,
              comparedRouteCount: 2,
              oracleModel: "exhaustive_route_enumeration",
              oraclePathCount: 2,
              quoteBudget: 2,
              maxHops: 2,
              maxIntermediaries: 1,
              quoteCoveragePpm: 1_000_000,
              note: "T14 fixture.",
            },
          ],
        },
      }),
    });
  });

  await page.goto("/status", { waitUntil: "domcontentloaded" });
  await expectRouteLoaded(
    page,
    OPERATOR_SURFACE_ROUTES.find((route) => route.key === "status")!,
  );
  await expect(page.getByTestId("status-health-error")).toContainText(
    /runtime health api is unavailable/i,
  );
  await page.getByTestId("status-health-refresh-button").click();
  await expect(page.getByTestId("status-runtime-health-posture")).toContainText(
    "Runtime health loaded",
  );
  await expect(page.getByTestId("status-health-error")).toHaveCount(0);

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expectRouteLoaded(
    page,
    OPERATOR_SURFACE_ROUTES.find((route) => route.key === "settings")!,
  );
  await page.getByTestId("settings-workspace-tab-guardrails").click();
  await expect(page.getByTestId("settings-guardrails-panel")).toBeVisible();

  await page.route("**/api/contracts/mutation-matrix", async (route) => {
    mutationRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "mutation matrix offline" }),
    });
  });
  await page.route("**/api/contracts/storage-lifecycle", async (route) => {
    storageRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "storage lifecycle offline" }),
    });
  });

  await page.goto("/contracts", { waitUntil: "domcontentloaded" });
  await expectRouteLoaded(
    page,
    OPERATOR_SURFACE_ROUTES.find((route) => route.key === "contracts")!,
  );
  await expect(page.getByTestId("contracts-mutation-matrix-panel")).toContainText(
    /critical mutation matrix/i,
  );
  await expect(page.getByTestId("contracts-storage-lifecycle-panel")).toContainText(
    /storage lifecycle hardening/i,
  );
  await page.getByTestId("contracts-raw-contract-input").fill(VALID_CONTRACT_ID);
  await page.getByTestId("contracts-raw-method-input").fill("set_governor");
  await page.getByTestId("contracts-raw-args-input").fill("[]");
  await page.getByTestId("contracts-raw-write-button").click();
  await expect(page.getByTestId("contracts-confirm-button")).toBeVisible();
  await page.getByTestId("contracts-confirm-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(
    /dao policy|governance/i,
  );
  await expect(page.getByTestId("contracts-raw-contract-input")).toHaveValue(
    VALID_CONTRACT_ID,
  );
  await expect(page.getByTestId("contracts-raw-method-input")).toHaveValue(
    "set_governor",
  );
  await expect.poll(() => mutationRequests).toBeGreaterThan(0);
  await expect.poll(() => storageRequests).toBeGreaterThan(0);
});

test("T14 integrations and migrations retry degraded APIs while preserving operator inputs", async ({
  page,
}) => {
  let catalogRequests = 0;
  let quoteRequests = 0;
  let simulateRequests = 0;

  await enableOperatorMode(page);
  await page.route("**/api/intents/balanced/quote", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      catalogRequests += 1;
      await route.fulfill({
        status: catalogRequests === 1 ? 503 : 200,
        contentType: "application/json",
        body:
          catalogRequests === 1
            ? JSON.stringify({ error: "SODAX token catalog unavailable." })
            : JSON.stringify({
                provider: "sodax_sdk",
                chainId: "stellar",
                tokens: [
                  {
                    symbol: "bnUSD",
                    name: "Balanced Dollar",
                    decimals: 7,
                    address: "CBNUSD",
                    chainId: "stellar",
                  },
                  {
                    symbol: "USDC",
                    name: "USD Coin",
                    decimals: 7,
                    address: "CUSDC",
                    chainId: "stellar",
                  },
                ],
              }),
      });
      return;
    }

    quoteRequests += 1;
    await route.fulfill({
      status: quoteRequests === 1 ? 502 : 200,
      contentType: "application/json",
      body:
        quoteRequests === 1
          ? JSON.stringify({ error: "SODAX quote unavailable." })
          : JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              tokenIn: {
                symbol: "bnUSD",
                name: "Balanced Dollar",
                decimals: 7,
                address: "CBNUSD",
                chainId: "stellar",
              },
              tokenOut: {
                symbol: "USDC",
                name: "USD Coin",
                decimals: 7,
                address: "CUSDC",
                chainId: "stellar",
              },
              amountInBase: "1234567",
              quotedAmountBase: "1220000",
              quoteType: "exact_input",
            }),
    });
  });
  await page.route("**/api/intents/balanced/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        provider: "sodax_sdk",
        intentTxHash: "0xintent",
        statusCode: 3,
        statusLabel: "SOLVED",
        fillTxHash: "0xfill",
        terminal: true,
      }),
    });
  });
  await page.route("**/api/intents/balanced/confirm", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        provider: "sodax_sdk",
        intentTxHash: "0xintent",
        statusCode: 3,
        statusLabel: "SOLVED",
        terminal: true,
        fillTxHash: "0xfill",
        confirmationTxHash: "0xfill",
        confirmed: true,
        confirmationState: "confirmed",
      }),
    });
  });

  await page.goto("/integrations/operator", { waitUntil: "domcontentloaded" });
  await expectRouteLoaded(
    page,
    OPERATOR_SURFACE_ROUTES.find(
      (route) => route.key === "integrations-operator",
    )!,
  );
  await page.getByTestId("integrations-workspace-tab-sodax").click();
  await page.getByTestId("integrations-balanced-intent-amount").fill("0.1234567");
  await page.getByTestId("integrations-balanced-intent-load-button").click();
  await expect(page.getByTestId("integrations-balanced-intent-error")).toContainText(
    "SODAX token catalog unavailable.",
  );
  await expect(page.getByTestId("integrations-balanced-intent-amount")).toHaveValue(
    "0.1234567",
  );
  await page.getByTestId("integrations-balanced-intent-load-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-token-catalog"),
  ).toContainText("Catalog loaded: bnUSD, USDC");
  await expect(page.getByTestId("integrations-balanced-intent-quote-button")).toBeEnabled();
  await page.getByTestId("integrations-balanced-intent-quote-button").click();
  await expect(page.getByTestId("integrations-balanced-intent-error")).toContainText(
    "SODAX quote unavailable.",
  );
  await expect(page.getByTestId("integrations-balanced-intent-amount")).toHaveValue(
    "0.1234567",
  );
  await page.getByTestId("integrations-balanced-intent-quote-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-result"),
  ).toContainText("Quote ready");

  const inspectRequests = await installMigrationsInspectRoute(page, true);
  await page.route("**/api/migrations/simulate", async (route) => {
    simulateRequests += 1;
    if (simulateRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Migration simulation offline.",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_migrations_simulate",
        sourceAccount:
          "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
        summary: {
          total: 1,
          simulated: 1,
          failed: 0,
        },
        entries: [
          {
            id: "factory-implementation",
            title: "Factory implementation",
            method: "set_implementation",
            contractId: VALID_CONTRACT_ID,
            status: "Simulated",
            tone: "positive",
            detail: "RPC simulation accepted the governed implementation write.",
            xdrBytes: 512,
            argCount: 1,
          },
        ],
      }),
    });
  });

  await page.goto("/migrations", { waitUntil: "domcontentloaded" });
  await expectRouteLoaded(
    page,
    OPERATOR_SURFACE_ROUTES.find((route) => route.key === "migrations")!,
  );
  await expect(page.getByTestId("migration-error")).toContainText(
    "Factory inspection offline.",
  );
  await page.getByTestId("migration-source-input").fill(VALID_CONTRACT_ID);
  await page.getByTestId("migration-target-input").fill(VALID_CONTRACT_ID);
  await page.getByTestId("migration-registry-input").fill(VALID_CONTRACT_ID);
  await page.getByTestId("migration-implementation-hash-input").fill(VALID_HASH);
  await page.getByTestId("migration-share-token-hash-input").fill(VALID_HASH);
  await page.getByTestId("migration-inspect-button").click();
  await expect(page.getByTestId("migration-status")).toContainText(
    "Migration inspection refreshed.",
  );
  await page.getByTestId("migrations-workspace-tab-simulate").click();
  await page.getByTestId("migration-simulate-button").click();
  await expect(page.getByTestId("migration-simulation-error")).toContainText(
    "Migration simulation offline.",
  );
  await page.getByTestId("migrations-workspace-tab-plan").click();
  await expect(page.getByTestId("migration-implementation-hash-input")).toHaveValue(
    VALID_HASH,
  );
  await page.getByTestId("migrations-workspace-tab-simulate").click();
  await page.getByTestId("migration-simulate-button").click();
  await expect(page.getByTestId("migration-simulation-status")).toContainText(
    "Simulated 1/1 governed migration writes.",
  );
  await page.getByTestId("migrations-workspace-tab-plan").click();
  await page.getByTestId("migration-share-token-hash-input").fill("cd".repeat(32));
  await page.getByTestId("migrations-workspace-tab-simulate").click();
  await expect(page.getByTestId("migration-simulation-error")).toContainText(
    "Migration plan changed after the last simulation.",
  );
  await expect.poll(inspectRequests).toBe(2);
  await expect.poll(() => simulateRequests).toBe(2);
});
