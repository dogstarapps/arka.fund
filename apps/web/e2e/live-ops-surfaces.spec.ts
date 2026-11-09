import { expect, test, type Page } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.beforeEach(async ({ page }) => {
  await enableOperatorMode(page);
});

async function openArkaWorkspace(
  page: Page,
  id: "state" | "flow" | "rebalance" | "credit",
) {
  const panelByWorkspace = {
    state: "arka-state-panel",
    flow: "arka-flow-panel",
    rebalance: "arka-rebalance-panel",
    credit: "arka-credit-panel",
  } as const;
  const tab = page.getByTestId(`arka-workspace-tab-${id}`);
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.getByTestId(panelByWorkspace[id])).toBeVisible();
}

async function showAdvancedSwapDetails(page: Page) {
  const advanced = page.getByRole("checkbox", { name: "Advanced" });
  if (!(await advanced.isChecked())) {
    await advanced.check();
  }
  await expect(page.getByTestId("rebalance-route-candidates")).toBeVisible();
}

async function routeIndexedRebalanceActivity(page: Page) {
  const liveAt = new Date(Date.now() - 60_000).toISOString();
  const staleAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  await page.route("**/api/catalog/**/activity**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total: 5,
        offset: 0,
        limit: 200,
        items: [
          {
            eventId: "borrow-live",
            cursor: "borrow-live",
            arkaId: "TEST_BLEND_VAULT",
            manager: "GMANAGER7777777777777777777777777777777777777777777777777777",
            kind: "borrow",
            ledger: 100,
            ledgerClosedAt: liveAt,
            txHash: "TX_BORROW",
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            user: null,
            assetContract: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
            marketId: "7",
            amount: "300000",
            shares: null,
            netOut: null,
            stepCount: 1,
          },
          {
            eventId: "withdraw-live",
            cursor: "withdraw-live",
            arkaId: "TEST_BLEND_VAULT",
            manager: "GMANAGER7777777777777777777777777777777777777777777777777777",
            kind: "withdraw",
            ledger: 101,
            ledgerClosedAt: liveAt,
            txHash: "TX_WITHDRAW",
            transactionIndex: 0,
            operationIndex: 1,
            inSuccessfulContractCall: true,
            user: null,
            assetContract: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
            marketId: "7",
            amount: null,
            shares: null,
            netOut: "200000",
            stepCount: 1,
          },
          {
            eventId: "deposit-ignored",
            cursor: "deposit-ignored",
            arkaId: "TEST_BLEND_VAULT",
            manager: "GMANAGER7777777777777777777777777777777777777777777777777777",
            kind: "deposit",
            ledger: 102,
            ledgerClosedAt: liveAt,
            txHash: "TX_DEPOSIT",
            transactionIndex: 0,
            operationIndex: 2,
            inSuccessfulContractCall: true,
            user: "GACCOUNT77777777777777777777777777777777777777777777777777",
            assetContract: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
            marketId: null,
            amount: "99000000",
            shares: "99000000",
            netOut: null,
            stepCount: 1,
          },
          {
            eventId: "failed-ignored",
            cursor: "failed-ignored",
            arkaId: "TEST_BLEND_VAULT",
            manager: "GMANAGER7777777777777777777777777777777777777777777777777777",
            kind: "borrow",
            ledger: 103,
            ledgerClosedAt: liveAt,
            txHash: "TX_FAILED",
            transactionIndex: 0,
            operationIndex: 3,
            inSuccessfulContractCall: false,
            user: null,
            assetContract: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
            marketId: "7",
            amount: "5000000",
            shares: null,
            netOut: null,
            stepCount: 1,
          },
          {
            eventId: "stale-ignored",
            cursor: "stale-ignored",
            arkaId: "TEST_BLEND_VAULT",
            manager: "GMANAGER7777777777777777777777777777777777777777777777777777",
            kind: "repay",
            ledger: 104,
            ledgerClosedAt: staleAt,
            txHash: "TX_STALE",
            transactionIndex: 0,
            operationIndex: 4,
            inSuccessfulContractCall: true,
            user: null,
            assetContract: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
            marketId: "7",
            amount: "11000000",
            shares: null,
            netOut: null,
            stepCount: 1,
          },
        ],
      }),
    });
  });
}

test("migration workspace inspects factory state and hands off governance authoring", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
  const validHash = "ab".repeat(32);

  await page.route("**/api/migrations/inspect**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        snapshot: {
          factoryId:
            "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
          registryId: validAddress,
          sourceArka: validAddress,
          targetArka: validAddress,
          implementationGetterSupported: true,
          currentImplementation: validHash,
          registryGetterSupported: true,
          currentRegistry: validAddress,
          currentShareTokenImplementation: validHash,
          migratedTo: "",
          migratedFrom: "",
          sourceShareToken: validAddress,
          targetShareToken: validAddress,
        },
      }),
    });
  });
  await page.route("**/api/migrations/simulate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_migrations_simulate",
        sourceAccount: "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
        summary: {
          total: 3,
          simulated: 3,
          failed: 0,
        },
        entries: [
          {
            id: "factory-implementation",
            title: "Factory implementation",
            method: "set_implementation",
            contractId: validAddress,
            status: "Simulated",
            tone: "positive",
            detail:
              "RPC accepted the contract invocation and assembled a prepared transaction from the current ledger state.",
            xdrBytes: 512,
            argCount: 1,
          },
          {
            id: "factory-share-token-implementation",
            title: "Share token implementation",
            method: "set_share_token_implementation",
            contractId: validAddress,
            status: "Simulated",
            tone: "positive",
            detail:
              "RPC accepted the contract invocation and assembled a prepared transaction from the current ledger state.",
            xdrBytes: 516,
            argCount: 1,
          },
          {
            id: "factory-registry-binding",
            title: "Factory registry binding",
            method: "set_registry",
            contractId: validAddress,
            status: "Simulated",
            tone: "positive",
            detail:
              "RPC accepted the contract invocation and assembled a prepared transaction from the current ledger state.",
            xdrBytes: 488,
            argCount: 1,
          },
        ],
      }),
    });
  });

  await page.goto("/migrations");

  await expect(page.locator("main")).toHaveClass(/migrations-fidelity-shell/);
  await expect(page.locator("main")).toHaveClass(/secondary-operator-shell-cutover/);
  await expect(
    page.getByRole("heading", { name: /^migration workspace$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("migrations-workspace-panel")).toHaveClass(
    /migrations-utility-grid/,
  );
  await expect(page.getByTestId("migrations-workspace-panel")).toHaveClass(
    /secondary-operator-stage-cutover/,
  );
  await expect(page.getByTestId("migration-plan-panel")).toHaveClass(
    /migration-plan-workspace-panel/,
  );
  await expect(page.getByTestId("migration-plan-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("migration-inspection-panel")).toHaveClass(
    /migration-inspection-workspace-panel/,
  );
  await expect(page.getByTestId("migration-inspection-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("migration-status")).toContainText(
    "Migration inspection refreshed.",
  );
  await expect(page.getByTestId("migration-preflight-table")).toContainText(
    "Share-token implementation",
  );
  await expect(page.getByTestId("migration-preflight-table")).toContainText(
    "Factory implementation",
  );
  await expect(page.getByTestId("migration-preflight-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );

  await page.getByTestId("migrations-workspace-tab-export").click();
  await expect(page.getByTestId("migration-export-panel")).toHaveClass(
    /migration-export-workspace-panel/,
  );
  await expect(page.getByTestId("migration-export-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("migration-handoff-panel")).toHaveClass(
    /migration-handoff-workspace-panel/,
  );
  await expect(page.getByTestId("migration-handoff-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("migration-bundle-table")).toContainText(
    "Factory implementation",
  );
  await expect(
    page.getByTestId("migration-open-implementation-governance"),
  ).toBeDisabled();
  await expect(
    page.getByTestId("migration-open-implementation-governance"),
  ).not.toHaveAttribute("href", /.+/);

  await page.getByTestId("migrations-workspace-tab-plan").click();
  await page
    .getByTestId("migration-implementation-hash-input")
    .fill(validHash);
  await page
    .getByTestId("migration-share-token-hash-input")
    .fill(validHash);
  await page.getByTestId("migrations-workspace-tab-verify").click();
  await expect(page.getByTestId("migration-verification-panel")).toHaveClass(
    /migration-verification-workspace-panel/,
  );
  await expect(page.getByTestId("migration-verification-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("migration-dry-run-panel")).toHaveClass(
    /migration-dry-run-workspace-panel/,
  );
  await expect(page.getByTestId("migration-dry-run-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("migration-verification-row-share-token-implementation")).toContainText(
    "Aligned",
  );
  await expect(page.getByTestId("migration-dry-run-row-bundle-admission")).toContainText(
    "Ready to verify",
  );
  await expect(page.getByTestId("migration-dry-run-row-share-token-post-check")).toContainText(
    "Already aligned",
  );
  await page.getByTestId("migrations-workspace-tab-simulate").click();
  await expect(page.getByTestId("migration-simulation-panel")).toHaveClass(
    /migration-simulation-workspace-panel/,
  );
  await expect(page.getByTestId("migration-simulation-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await page.getByTestId("migration-simulate-button").click();
  await expect(page.getByTestId("migration-simulation-status")).toContainText(
    "Simulated 3/3 governed migration writes.",
  );
  await expect(
    page.getByTestId("migration-simulation-row-factory-implementation"),
  ).toContainText("512 bytes / 1 args");
  await expect(page.getByTestId("migration-simulation-source-note")).toContainText(
    "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
  );
  await page.getByTestId("migrations-workspace-tab-export").click();
  await expect(page.getByTestId("migration-bundle-row-factory-implementation")).toContainText(
    "Ready",
  );
  await expect(
    page.getByTestId("migration-open-implementation-governance"),
  ).toHaveAttribute("href", "/governance/console?draft=governed-composer");
  await expect(page.getByTestId("migration-bundle-json")).toContainText(
    '"templateId": "factory-implementation"',
  );
  await page
    .getByTestId("migration-open-implementation-governance")
    .click();

  await expect(page).toHaveURL(
    /\/governance\/console(?:\?draft=governed-composer)?$/,
  );
  const enableOperatorModeButton = page.getByRole("button", {
    name: /verify operator wallet/i,
  });
  if (await enableOperatorModeButton.isVisible().catch(() => false)) {
    await enableOperatorModeButton.click();
  }
  await expect(
    page.getByTestId("governance-composer-review-card"),
  ).toBeVisible();
  await page.waitForSelector(
    '[data-testid="governance-composer-template-select"]',
  );
  await expect(
    page.getByTestId("governance-composer-template-select"),
  ).toHaveValue("factory-implementation");
  await expect(
    page.getByTestId("governance-composer-field-impl_wasm_hash"),
  ).toHaveValue(validHash);
});

test("ops surface groups live checks into an operational control room", async ({ page }) => {
  await page.goto("/ops");

  await expect(page.locator("main")).toHaveClass(/ops-fidelity-shell/);
  await expect(page.locator("main")).toHaveClass(/secondary-operator-shell-cutover/);
  await expect(page.getByRole("heading", { name: /^operations$/i })).toBeVisible();
  await expect(page.getByTestId("ops-workspace-summary")).toContainText("Health");
  await expect(page.getByTestId("ops-health-panel")).toContainText("Ops deck");
  await expect(page.getByTestId("ops-health-panel")).toHaveClass(
    /ops-health-workspace-panel/,
  );
  await expect(page.getByTestId("ops-workspace-summary")).toHaveClass(
    /secondary-operator-summary-cutover/,
  );
  await expect(page.getByTestId("ops-workspace-panel")).toHaveClass(
    /secondary-operator-stage-cutover/,
  );
  await expect(page.getByTestId("ops-health-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("ops-health-panel")).toContainText("Governor readability");
  await page.getByTestId("ops-workspace-tab-routing").click();
  await expect(page.getByTestId("ops-routing-panel")).toContainText("Balanced adapter route");
  await expect(page.getByTestId("ops-routing-panel")).toHaveClass(
    /ops-routing-workspace-panel/,
  );
  await expect(page.getByTestId("ops-routing-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("ops-routing-panel")).toContainText("Aquarius adapter route");
  await expect(page.getByTestId("ops-routing-panel")).toContainText("Blend adapter route");
  await page.getByTestId("ops-workspace-tab-runbook").click();
  await expect(page.getByTestId("ops-runbook-table")).toContainText("Governance baseline");
  await expect(page.getByTestId("ops-runbook-panel")).toHaveClass(
    /ops-runbook-workspace-panel/,
  );
  await expect(page.getByTestId("ops-runbook-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("ops-runbook-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await expect(page.getByTestId("ops-runbook-panel")).toContainText("Adapter wiring");
  await expect(page.getByTestId("ops-runbook-panel")).toContainText("Reserve gate");
  await expect(page.getByTestId("ops-refresh-button")).toBeVisible();
});

test("tiers surface exposes scorecard and governed action workflow", async ({ page }) => {
  await page.goto("/tiers");

  await expect(page.locator("main")).toHaveClass(/tiers-fidelity-shell/);
  await expect(page.locator("main")).toHaveClass(/secondary-operator-shell-cutover/);
  await expect(page.getByRole("heading", { name: /^manager tiers$/i })).toBeVisible();
  await expect(page.getByTestId("tiers-workspace-summary")).toContainText("Scorecard");
  await expect(page.getByTestId("tiers-runtime-read-posture")).toHaveClass(
    /tiers-command-card/,
  );
  await expect(page.getByTestId("tiers-runtime-read-posture")).toHaveClass(
    /secondary-operator-runtime-card-cutover/,
  );
  await expect(page.getByTestId("tiers-state-panel")).toContainText("Score deck");
  await expect(page.getByTestId("tiers-state-panel")).toHaveClass(
    /tiers-scorecard-workspace-panel/,
  );
  await expect(page.getByTestId("tiers-workspace-summary")).toHaveClass(
    /secondary-operator-summary-cutover/,
  );
  await expect(page.getByTestId("tiers-workspace-panel")).toHaveClass(
    /secondary-operator-stage-cutover/,
  );
  await expect(page.getByTestId("tiers-state-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("tiers-scorecard-table")).toContainText("Threshold ladder");
  await page.getByTestId("tiers-workspace-tab-ladder").click();
  await expect(page.getByTestId("tiers-ladder-panel")).toContainText("Tier 1");
  await expect(page.getByTestId("tiers-ladder-panel")).toHaveClass(
    /tiers-ladder-workspace-panel/,
  );
  await expect(page.getByTestId("tiers-ladder-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("tiers-ladder-panel")).toContainText("Tier 3");
  await page.getByTestId("tiers-workspace-tab-update").click();
  await expect(page.getByTestId("tiers-actions-table")).toContainText("Authorization model");
  await expect(page.getByTestId("tiers-actions-panel")).toHaveClass(
    /tiers-actions-workspace-panel/,
  );
  await expect(page.getByTestId("tiers-actions-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("tiers-actions-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await expect(page.getByTestId("tiers-actions-panel")).toContainText("Governed deck");
  await expect(page.getByTestId("tiers-actions-panel")).toContainText("Add points");
  await expect(page.getByTestId("tiers-actions-panel")).toContainText("Current wallet");
  await expect(page.getByTestId("tiers-manager-input")).toBeVisible();
});

test("live vault detail keeps execution and manager controls in the same visual language", async ({ page }) => {
  await page.goto("/arkas/TEST_BLEND_VAULT");

  await expect(page.getByTestId("arka-stage-panel")).toContainText("Arka");
  await expect(page.getByRole("heading", { name: /^TEST_BLEND_VAULT$/i })).toBeVisible();
  await expect(page.getByTestId("arka-stage-summary-list")).toContainText("Vault value");
  await expect(page.getByTestId("arka-stage-summary-list")).toContainText("My ownership");
  await expect(page.getByTestId("arka-stage-summary-list")).toContainText("Blend position");
  await expect(page.getByTestId("arka-state-panel")).toContainText("Arka details");
  await openArkaWorkspace(page, "flow");
  await expect(page.getByTestId("arka-flow-panel")).toContainText("Deposit and redeem");
  await expect(page.getByTestId("arka-flow-panel")).toContainText(/connected wallet/i);
  await expect(page.getByTestId("arka-asset-select")).toBeVisible();
  await expect(page.getByTestId("arka-asset-select")).toContainText(/available/i);
  await expect(page.getByTestId("arka-amount-input")).toBeVisible();
  await expect(page.getByTestId("arka-deposit-button")).toBeVisible();
  await expect(page.getByTestId("arka-redeem-button")).toBeVisible();
  await openArkaWorkspace(page, "rebalance");
  await expect(page.getByTestId("rebalance-protocol-select")).toContainText("Best execution");
  await expect(page.getByTestId("rebalance-asset-in-select")).toBeVisible();
  await expect(page.getByTestId("rebalance-asset-out-select")).toBeVisible();
  await expect(page.getByTestId("rebalance-amount-input")).toBeVisible();
  await expect(page.getByTestId("rebalance-route-summary")).toBeVisible();
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Est. receive");
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Minimum receive");
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Price impact");
  await showAdvancedSwapDetails(page);
  await expect(page.getByTestId("rebalance-route-search")).toContainText(
    "Markets compared",
  );
  await openArkaWorkspace(page, "credit");
  await expect(page.getByTestId("arka-credit-panel")).toContainText("Blend");
  await expect(page.getByTestId("arka-credit-panel")).toContainText("Supplied to Blend");
  await expect(page.getByTestId("arka-credit-panel")).toContainText("Borrowed");
  await expect(page.getByTestId("credit-health-factor")).toBeVisible();
});

test("live vault detail admits Balanced in the planner when canonical health is ready", async ({ page }) => {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        app: "ok",
        catalog: {
          configured: true,
          reachable: true,
          healthy: true,
          degraded: false,
          statusCode: 200,
          evaluatedAt: "2026-04-07",
        },
        protocols: {
          balanced: {
            validatedAt: "2026-04-07",
            adapterBalanced: "CBALANCEDREADY",
            poolId: 11,
            supportStatus: "ready",
            readyForDappExecution: true,
            laneMode: "expected_router",
            blockingReasons: [],
            observedRouter: "CROUTER",
            expectedRouter: "CROUTER",
            poolSupported: true,
            pairConfigured: false,
            validatedModule: {
              present: true,
              validatedAt: "2026-04-07",
              router: "CROUTER",
              poolId: 11,
              sourceValidations: ["balancedReadiness"],
              source: "deployments",
            },
            officialSurface: {
              validatedAt: "2026-04-07",
              officialSources: {
                app: "https://app.balanced.network",
                bundle: "https://app.balanced.network/assets/index.js",
                stellarPage: "https://balanced.network/stellar/",
                swapDocs: "https://docs.sodax.com/developers/packages",
                tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
                q3Blog: "https://blog.balanced.network/q3-2025/",
              },
              topology: "intent_based",
              swapModel: "sodax_intents",
              liquidityModel: "legacy_exchange_only",
              intentAdapter: {
                quoteProvider: "sodax",
                quoteVisibleInApp: true,
                quoteComparableForArka: false,
                publicQuoteEndpoint: null,
                statusSurface: "recent_activity",
                publicStatusEndpoint: null,
                publicReceiptEndpoint: null,
                cancellationWindowSeconds: 300,
              },
              publicRouterContractId: null,
              supportsPublicStellarTestnet: false,
              canonicalRouterCutoverPossible: false,
              stellarMainnetAddresses: {
                connection: "CCONNECTION",
                assetManager: "CASSET",
                xTokenManager: null,
                rateLimit: "CRATELIMIT",
              },
              findings: ["Official Stellar swaps are powered by SODAX Intents."],
              source: "deployments",
            },
            source: "deployments",
          },
        },
      }),
    });
  });
  await page.route("**/api/routing/rebalance/plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_routing_solver",
        generatedAt: "2026-04-16T12:00:00.000Z",
        plan: {
          requestedProtocol: "BALANCED",
          selectedProtocol: "BALANCED",
          selectedCandidate: {
            routeId: "BALANCED_DIRECT",
            protocol: "BALANCED",
            venueFamily: "intent_execution",
            quoteModel: "manual_lane",
            settlementModel: "intent_settlement",
            pathModel: "adapter_gated",
            confirmationModel: "transaction_hash_plus_refresh",
            title: "Balanced direct",
            estimatedOutBase: 0,
            minOutBase: 9700000,
            available: true,
            admitted: true,
            autoEligible: false,
            note: "Balanced is promoted, but still needs a comparable public quote before AUTO can use it. This remains manual execution.",
            pathAssets: [
              "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
              "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
            ],
            pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
            hops: 1,
            routeScoreBase: 0,
            routeScoreLabel: "manual route (no live quote)",
            executionKind: "balanced_adapter",
            steps: [
              {
                protocol: "BALANCED",
                tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              },
            ],
            adapterId: "CBALANCEDREADY",
            poolId: 11,
          },
          estimatedOutBase: 0,
          minOutBase: 9700000,
          note: "Balanced selected. Balanced direct on a direct route.",
          candidates: [
            {
              routeId: "BALANCED_DIRECT",
              protocol: "BALANCED",
              venueFamily: "intent_execution",
              quoteModel: "manual_lane",
              settlementModel: "intent_settlement",
              pathModel: "adapter_gated",
              confirmationModel: "transaction_hash_plus_refresh",
              title: "Balanced direct",
              estimatedOutBase: 0,
              minOutBase: 9700000,
              available: true,
              admitted: true,
              autoEligible: false,
              note: "manual route (no live quote)",
              pathAssets: [
                "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              ],
              pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
              hops: 1,
              routeScoreBase: 0,
              routeScoreLabel: "manual route (no live quote)",
              executionKind: "balanced_adapter",
              steps: [
                {
                  protocol: "BALANCED",
                  tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                  tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
                },
              ],
              adapterId: "CBALANCEDREADY",
              poolId: 11,
            },
          ],
        },
      }),
    });
  });

  await page.goto("/arkas/TEST_BLEND_VAULT");

  await openArkaWorkspace(page, "rebalance");
  await expect(page.getByTestId("rebalance-protocol-select")).toContainText("Balanced");
  await page.getByTestId("rebalance-protocol-select").selectOption("BALANCED");
  await showAdvancedSwapDetails(page);
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Balanced selected");
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Balanced: Ready");
  await expect(page.getByTestId("rebalance-intent-handoff-summary")).toContainText(
    /Balanced intent route/i,
  );
  await expect(page.getByTestId("rebalance-intent-handoff-route")).toContainText(
    /Balanced uses intent execution/i,
  );
  await expect(page.getByTestId("rebalance-intent-handoff-steps")).toContainText(
    /Official discovery:|Quote capture:|Execution:|Confirmation:/i,
  );
  await expect(page.getByTestId("rebalance-intent-handoff-links")).toContainText(
    /Official app|Recent Activity|Stellar page|Trade blog/i,
  );
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Manual review");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Balanced direct");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("receive");
});

test("live vault detail shows Balanced AUTO route when comparable quote is available", async ({ page }) => {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        app: "ok",
        catalog: {
          configured: true,
          reachable: true,
          healthy: true,
          degraded: false,
          statusCode: 200,
          evaluatedAt: "2026-04-16",
        },
        protocols: {
          balanced: {
            validatedAt: "2026-04-16",
            adapterBalanced: "CBALANCEDREADY",
            poolId: 11,
            supportStatus: "ready",
            readyForDappExecution: true,
            laneMode: "expected_router",
            blockingReasons: [],
            observedRouter: "CROUTER",
            expectedRouter: "CROUTER",
            poolSupported: true,
            pairConfigured: true,
            validatedModule: {
              present: true,
              validatedAt: "2026-04-16",
              router: "CROUTER",
              poolId: 11,
              sourceValidations: ["balancedReadiness"],
              source: "deployments",
            },
            officialSurface: {
              validatedAt: "2026-04-16",
              officialSources: {
                app: "https://app.balanced.network",
                bundle: "https://app.balanced.network/assets/index.js",
                stellarPage: "https://balanced.network/stellar/",
                swapDocs: "https://balanced.network/",
                tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
                q3Blog: "https://blog.balanced.network/q3-2025/",
              },
              topology: "intent_based",
              swapModel: "sodax_intents",
              liquidityModel: "legacy_exchange_only",
              intentAdapter: {
                quoteProvider: "sodax",
                quoteVisibleInApp: true,
                quoteComparableForArka: true,
                publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
                publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
                publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
                publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
                statusSurface: "recent_activity",
                publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
                publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
                publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
                publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
                cancellationWindowSeconds: 300,
              },
              publicRouterContractId: null,
              supportsPublicStellarTestnet: false,
              canonicalRouterCutoverPossible: false,
              stellarMainnetAddresses: {
                connection: "CCONNECTION",
                assetManager: "CASSET",
                xTokenManager: null,
                rateLimit: "CRATELIMIT",
              },
              findings: ["Official Stellar swaps are powered by SODAX Intents."],
              source: "deployments",
            },
            source: "deployments",
          },
        },
      }),
    });
  });
  await page.route("**/api/routing/rebalance/plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_routing_solver",
        generatedAt: "2026-04-16T12:30:00.000Z",
        plan: {
          requestedProtocol: "AUTO",
          selectedProtocol: "BALANCED",
          selectedCandidate: {
            routeId: "BALANCED_DIRECT",
            protocol: "BALANCED",
            venueFamily: "intent_execution",
            quoteModel: "public_intent_quote",
            settlementModel: "intent_settlement",
            pathModel: "adapter_gated",
            confirmationModel: "transaction_hash_plus_refresh",
            title: "Balanced direct",
            estimatedOutBase: 11450000,
            minOutBase: 11220000,
            available: true,
            admitted: true,
            autoEligible: true,
            note: "Balanced intent routing is live through sodax_sdk quote/status and can participate in AUTO.",
            pathAssets: [
              "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
              "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
            ],
            pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
            hops: 1,
            routeScoreBase: 11450000,
            routeScoreLabel: "score = est. output",
            executionKind: "balanced_adapter",
            steps: [
              {
                protocol: "BALANCED",
                tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              },
            ],
            adapterId: "CBALANCEDREADY",
            poolId: 11,
          },
          estimatedOutBase: 11450000,
          minOutBase: 11220000,
          note: "Auto-selected Balanced direct from 3 live routes. Balanced direct on a direct route.",
          candidates: [
            {
              routeId: "BALANCED_DIRECT",
              protocol: "BALANCED",
              venueFamily: "intent_execution",
              quoteModel: "public_intent_quote",
              settlementModel: "intent_settlement",
              pathModel: "adapter_gated",
              confirmationModel: "transaction_hash_plus_refresh",
              title: "Balanced direct",
              estimatedOutBase: 11450000,
              minOutBase: 11220000,
              available: true,
              admitted: true,
              autoEligible: true,
              note: "Balanced intent routing is live through sodax_sdk quote/status and can participate in AUTO.",
              pathAssets: [
                "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              ],
              pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
              hops: 1,
              routeScoreBase: 11450000,
              routeScoreLabel: "score = est. output",
              executionKind: "balanced_adapter",
              steps: [
                {
                  protocol: "BALANCED",
                  tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                  tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
                },
              ],
              adapterId: "CBALANCEDREADY",
              poolId: 11,
            },
          ],
        },
      }),
    });
  });

  await page.goto("/arkas/TEST_BLEND_VAULT");
  await openArkaWorkspace(page, "rebalance");
  await page.getByTestId("rebalance-protocol-select").selectOption("AUTO");
  await showAdvancedSwapDetails(page);

  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Best execution selected Balanced");
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Balanced: Ready");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Balanced direct");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Quoted");
});

test("live vault detail keeps Balanced manual when quote/status/confirm surface is incomplete", async ({ page }) => {
  await page.route("**/api/routing/rebalance/plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_routing_solver",
        generatedAt: "2026-04-17T09:00:00.000Z",
        plan: {
          requestedProtocol: "AUTO",
          selectedProtocol: "AQUARIUS",
          selectedCandidate: {
            routeId: "AQUARIUS_DIRECT",
            protocol: "AQUARIUS",
            venueFamily: "amm_router",
            quoteModel: "live_router_quote",
            settlementModel: "onchain_router",
            pathModel: "router_direct",
            confirmationModel: "transaction_hash_plus_refresh",
            title: "Aquarius direct",
            estimatedOutBase: 10120000,
            minOutBase: 9980000,
            available: true,
            admitted: true,
            autoEligible: true,
            note: "Live router quote available for direct path.",
            pathAssets: [
              "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
              "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
            ],
            pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
            hops: 1,
            routeScoreBase: 10090000,
            routeScoreLabel: "score 10,090,000 (price 10,120,000 · fee 0.20% · fill 0.12% · slip 0.35% · hop 0.00%)",
            executionKind: "aquarius_single_pool",
            steps: [],
          },
          estimatedOutBase: 10120000,
          minOutBase: 9980000,
          note: "Auto-selected Aquarius direct from 2 live routes. Aquarius direct on a direct route.",
          candidates: [
            {
              routeId: "BALANCED_DIRECT",
              protocol: "BALANCED",
              venueFamily: "intent_execution",
              quoteModel: "manual_lane",
              settlementModel: "intent_settlement",
              pathModel: "adapter_gated",
              confirmationModel: "transaction_hash_plus_refresh",
              title: "Balanced direct",
              estimatedOutBase: 0,
              minOutBase: 9700000,
              available: true,
              admitted: true,
              autoEligible: false,
              note: "Balanced quote data is visible, but status and confirmation are not complete enough for AUTO. Keeping this route manual.",
              pathAssets: [
                "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              ],
              pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
              hops: 1,
              routeScoreBase: 0,
              routeScoreLabel: "manual route (no live quote)",
              executionKind: "balanced_adapter",
              steps: [],
              adapterId: "CBALANCEDREADY",
              poolId: 11,
            },
          ],
        },
      }),
    });
  });

  await page.goto("/arkas/TEST_BLEND_VAULT");
  await openArkaWorkspace(page, "rebalance");
  await page.getByTestId("rebalance-protocol-select").selectOption("AUTO");
  await showAdvancedSwapDetails(page);

  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Best execution selected Aquarius");
  await expect(page.getByTestId("rebalance-route-summary")).not.toContainText("Best execution selected Balanced");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Manual review");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Balanced direct");
});

test("live vault detail surfaces risk-aware tie-break selection in AUTO mode", async ({ page }) => {
  await page.route("**/api/routing/rebalance/plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_routing_solver",
        generatedAt: "2026-04-17T09:30:00.000Z",
        plan: {
          requestedProtocol: "AUTO",
          selectedProtocol: "AQUARIUS",
          selectedCandidate: {
            routeId: "AQUARIUS_DIRECT",
            protocol: "AQUARIUS",
            venueFamily: "amm_router",
            quoteModel: "live_router_quote",
            settlementModel: "onchain_router",
            pathModel: "router_direct",
            confirmationModel: "transaction_hash_plus_refresh",
            title: "Aquarius direct",
            estimatedOutBase: 10180000,
            minOutBase: 10068000,
            available: true,
            admitted: true,
            autoEligible: true,
            note: "Live router quote available for direct path.",
            pathAssets: [
              "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
              "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
            ],
            pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
            hops: 1,
            routeScoreBase: 10111794,
            routeScoreLabel: "score 10,111,794 (price 10,180,000 · fee 0.20% · fill 0.12% · slip 0.35% · hop 0.00%)",
            routeScoreComponents: {
              estimatedOutBase: 10180000,
              feePenaltyBps: 20,
              fillRiskPenaltyBps: 12,
              slippagePenaltyBps: 35,
              hopPenaltyBps: 0,
              biasBps: 0,
              effectivePenaltyBps: 67,
            },
            executionKind: "aquarius_single_pool",
            steps: [],
          },
          estimatedOutBase: 10180000,
          minOutBase: 10068000,
          note: "Auto-selected Aquarius direct from 2 live routes. Aquarius direct on a direct route.",
          candidates: [
            {
              routeId: "SOROSWAP_0",
              protocol: "SOROSWAP",
              venueFamily: "amm_router",
              quoteModel: "live_router_quote",
              settlementModel: "onchain_router",
              pathModel: "router_direct",
              confirmationModel: "transaction_hash_plus_refresh",
              title: "SoroSwap direct",
              estimatedOutBase: 10200000,
              minOutBase: 10088000,
              available: true,
              admitted: true,
              autoEligible: true,
              note: "Live router quote available for direct path.",
              pathAssets: [
                "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              ],
              pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
              hops: 1,
              routeScoreBase: 10115340,
              routeScoreLabel: "score 10,115,340 (price 10,200,000 · fee 0.30% · fill 0.18% · slip 0.35% · hop 0.00%)",
              routeScoreComponents: {
                estimatedOutBase: 10200000,
                feePenaltyBps: 30,
                fillRiskPenaltyBps: 18,
                slippagePenaltyBps: 35,
                hopPenaltyBps: 0,
                biasBps: 0,
                effectivePenaltyBps: 83,
              },
              executionKind: "soroswap_path",
              steps: [],
            },
            {
              routeId: "AQUARIUS_DIRECT",
              protocol: "AQUARIUS",
              venueFamily: "amm_router",
              quoteModel: "live_router_quote",
              settlementModel: "onchain_router",
              pathModel: "router_direct",
              confirmationModel: "transaction_hash_plus_refresh",
              title: "Aquarius direct",
              estimatedOutBase: 10180000,
              minOutBase: 10068000,
              available: true,
              admitted: true,
              autoEligible: true,
              note: "Live router quote available for direct path.",
              pathAssets: [
                "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              ],
              pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
              hops: 1,
              routeScoreBase: 10111794,
              routeScoreLabel: "score 10,111,794 (price 10,180,000 · fee 0.20% · fill 0.12% · slip 0.35% · hop 0.00%)",
              routeScoreComponents: {
                estimatedOutBase: 10180000,
                feePenaltyBps: 20,
                fillRiskPenaltyBps: 12,
                slippagePenaltyBps: 35,
                hopPenaltyBps: 0,
                biasBps: 0,
                effectivePenaltyBps: 67,
              },
              executionKind: "aquarius_single_pool",
              steps: [],
            },
          ],
        },
      }),
    });
  });

  await page.goto("/arkas/TEST_BLEND_VAULT");
  await openArkaWorkspace(page, "rebalance");
  await page.getByTestId("rebalance-protocol-select").selectOption("AUTO");
  await showAdvancedSwapDetails(page);

  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Best execution selected Aquarius");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("SoroSwap direct");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Aquarius direct");
  await expect(page.getByTestId("rebalance-route-candidates")).toContainText("Quoted");
});

test("live vault detail renders route score breakdown terms in the execution deck", async ({ page }) => {
  await routeIndexedRebalanceActivity(page);
  await page.route("**/api/routing/rebalance/plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_routing_solver",
        generatedAt: "2026-04-16T13:00:00.000Z",
        plan: {
          requestedProtocol: "AUTO",
          selectedProtocol: "SOROSWAP",
          selectedCandidate: {
            routeId: "SOROSWAP_0",
            protocol: "SOROSWAP",
            venueFamily: "amm_router",
            quoteModel: "live_router_quote",
            settlementModel: "onchain_router",
            pathModel: "router_direct",
            confirmationModel: "transaction_hash_plus_refresh",
            title: "SoroSwap direct",
            estimatedOutBase: 10100000,
            minOutBase: 10000000,
            available: true,
            admitted: true,
            autoEligible: true,
            note: "Live router quote available for direct path.",
            pathAssets: [
              "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
              "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
            ],
            pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
            hops: 1,
            routeScoreBase: 10055545,
            routeScoreLabel: "score 10,055,545 (price 10,100,000 · fee 0.30% · fill 0.18% · slip 0.34% · hop 0.00%)",
            routeScoreComponents: {
              estimatedOutBase: 10100000,
              feePenaltyBps: 30,
              fillRiskPenaltyBps: 18,
              slippagePenaltyBps: 34,
              hopPenaltyBps: 0,
              biasBps: 0,
              effectivePenaltyBps: 82,
            },
            executionKind: "soroswap_path",
            steps: [
              {
                protocol: "SOROSWAP",
                tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
              },
            ],
          },
          estimatedOutBase: 10100000,
          minOutBase: 10000000,
          note: "Auto-selected SoroSwap direct from 2 live routes. SoroSwap direct on a direct route.",
          candidates: [],
          splitRoute: {
            status: "recommended",
            strategy: "chunked_global_best_execution",
            executable: true,
            allocationCount: 2,
            chunkCount: 2,
            routeCountCompared: 2,
            totalAmountInBase: 10000000,
            totalEstimatedOutBase: 10300000,
            totalMinOutBase: 10100000,
            singleRouteEstimatedOutBase: 10100000,
            estimatedImprovementBase: 200000,
            estimatedImprovementBps: 198,
            note: "Split-route optimizer globally evaluated 3 executable chunk distributions and recommends 2 allocations across 2 live AMM routes.",
            allocations: [
              {
                routeId: "SOROSWAP_0",
                protocol: "SOROSWAP",
                title: "SoroSwap direct",
                amountInBase: 5000000,
                amountShareBps: 5000,
                estimatedOutBase: 5200000,
                minOutBase: 5100000,
                pathAssets: [
                  "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                  "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
                ],
                pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
                hops: 1,
                routeScoreBase: 5180000,
                routeScoreLabel: "score 5,180,000",
                note: "Chunk routed through SoroSwap.",
              },
              {
                routeId: "AQUARIUS_DIRECT",
                protocol: "AQUARIUS",
                title: "Aquarius direct",
                amountInBase: 5000000,
                amountShareBps: 5000,
                estimatedOutBase: 5100000,
                minOutBase: 5000000,
                pathAssets: [
                  "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
                  "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
                ],
                pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
                hops: 1,
                poolIndexHex: "ab".repeat(32),
                routeScoreBase: 5080000,
                routeScoreLabel: "score 5,080,000",
                note: "Chunk routed through Aquarius.",
              },
            ],
          },
        },
      }),
    });
  });

  await page.goto("/arkas/TEST_BLEND_VAULT");
  await openArkaWorkspace(page, "rebalance");
  await page.getByTestId("rebalance-protocol-select").selectOption("AUTO");
  await showAdvancedSwapDetails(page);
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Best execution selected SoroSwap");
  await expect(page.getByTestId("rebalance-route-summary")).toContainText("Est. receive");
  await expect(page.getByTestId("rebalance-split-route")).toContainText(
    "Execution plan",
  );
  await expect(page.getByTestId("rebalance-split-route")).toContainText("Recommended across");
  await expect(page.getByTestId("rebalance-split-route")).toContainText("SoroSwap");
  await expect(page.getByTestId("rebalance-split-route")).toContainText("Aquarius");
  await expect(page.getByTestId("rebalance-guardrail-state-source")).toContainText(
    "Turnover window",
  );
});
test("live vault execution blocks wallet handoff when required turnover state is unavailable", async ({ page }) => {
  let sawPreSignRequest = false;
  const candidate = {
    routeId: "SOROSWAP_0",
    protocol: "SOROSWAP",
    venueFamily: "amm_router",
    quoteModel: "live_router_quote",
    settlementModel: "onchain_router",
    pathModel: "router_direct",
    confirmationModel: "transaction_hash_plus_refresh",
    title: "SoroSwap direct",
    estimatedOutBase: 10100000,
    minOutBase: 10000000,
    available: true,
    admitted: true,
    autoEligible: true,
    note: "Live router quote available for direct path.",
    pathAssets: [
      "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
      "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
    ],
    pathLabel: "CAFQXW...NVME -> CC6X3E...XTYS",
    hops: 1,
    routeScoreBase: 10055545,
    routeScoreLabel: "score 10,055,545 (price 10,100,000 · fee 0.30% · fill 0.18% · slip 0.34% · hop 0.00%)",
    executionKind: "soroswap_path",
    steps: [
      {
        protocol: "SOROSWAP",
        tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
        tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
      },
    ],
  };

  await page.route("**/api/catalog/**/activity**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "activity unavailable" }),
    });
  });
  await page.route("**/api/routing/rebalance/plan", async (route) => {
    const payload = route.request().postDataJSON() as {
      requiredStatefulGuardrails?: string[];
    };
    const requiresPostTrade =
      payload.requiredStatefulGuardrails?.includes("post_trade_deviation_bps") ??
      false;
    const requiresTurnover =
      payload.requiredStatefulGuardrails?.includes("daily_turnover_cap_bps") ??
      false;
    const preSign = requiresPostTrade && requiresTurnover;
    sawPreSignRequest = sawPreSignRequest || preSign;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_routing_solver",
        generatedAt: "2026-05-18T12:00:00.000Z",
        plan: {
          requestedProtocol: "AUTO",
          selectedProtocol: "SOROSWAP",
          selectedCandidate: preSign ? null : candidate,
          estimatedOutBase: preSign ? 0 : candidate.estimatedOutBase,
          minOutBase: preSign ? 0 : candidate.minOutBase,
          note: preSign
            ? "Rebalance blocked by phase-2 swap guardrails: Daily turnover cap requires indexed activity."
            : "Auto-selected SoroSwap direct from 1 live route.",
          candidates: [candidate],
          guardrails: {
            status: preSign ? "blocked" : "passed",
            blockedReasons: preSign
              ? [
                  "Post-trade deviation: Execution surface must provide projected post-trade allocation drift for a final pre-sign check.",
                  "Daily turnover cap: Execution surface must provide vault NAV and used daily turnover for the final cap check.",
                ]
              : [],
            policy: {
              maxNotionalPerSwapBase: 5000000000,
              maxPathLength: 6,
              forbidRouteCycles: true,
              chunkingThresholdBase: 100000000,
              maxChunkSizeBase: 50000000,
              postTradeDeviationBps: 250,
              dailyTurnoverCapBps: 1000,
              emergencyPauseSwap: false,
            },
            checks: [
              {
                id: "post_trade_deviation_bps",
                label: "Post-trade deviation",
                status: preSign ? "requires_state" : "passed",
                value: preSign ? "state required" : "0.75%",
                limit: "2.50%",
                detail: "Execution surface must provide projected post-trade allocation drift for a final pre-sign check.",
                evidence: preSign
                  ? {
                      source: "missing_state",
                      amountBase: 10_000_000,
                      vaultNavBase: 152_000_000,
                    }
                  : {
                      source: "route_quote_nav",
                      amountBase: 10_000_000,
                      routeId: "SOROSWAP_0",
                      routeEstimatedOutBase: 10_100_000,
                      vaultNavBase: 152_000_000,
                      projectedNavDeltaBase: 100_000,
                      splitRouteUsed: false,
                    },
              },
              {
                id: "daily_turnover_cap_bps",
                label: "Daily turnover cap",
                status: preSign ? "requires_state" : "passed",
                value: preSign ? "state required" : "10,500,000 notional",
                limit: "10.00% of NAV",
                detail: "Execution surface must provide vault NAV and used daily turnover for the final cap check.",
                evidence: preSign
                  ? {
                      source: "missing_state",
                      amountBase: 10_000_000,
                      vaultNavBase: 152_000_000,
                    }
                  : {
                      source: "catalog_activity_nav",
                      amountBase: 10_000_000,
                      vaultNavBase: 152_000_000,
                      dailyTurnoverUsedBase: 500_000,
                      projectedTurnoverBase: 10_500_000,
                      turnoverCapBase: 15_200_000,
                    },
              },
            ],
          },
        },
      }),
    });
  });

  await page.goto("/arkas/TEST_BLEND_VAULT");
  await openArkaWorkspace(page, "rebalance");
  await page.getByTestId("rebalance-protocol-select").selectOption("AUTO");
  await showAdvancedSwapDetails(page);
  await expect(page.getByTestId("rebalance-route-summary")).toContainText(
    "Best execution selected SoroSwap",
  );
  await expect(page.getByTestId("rebalance-guardrail-evaluation")).toContainText(
    "Trade limits",
  );
  await expect(page.getByTestId("rebalance-guardrail-state-source")).toContainText(
    "Turnover limits refresh",
  );
  const preSignResponse = await page.evaluate(async () => {
    const response = await fetch("/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
        tokenOut: "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        routingAssets: [
          "CAFQXWQHP4IP4HN7L2V5QTYAPSEWAQJ3Q4PH7KVZ2SY3FGTXXCTSNVME",
          "CC6X3EXAMHOFD4XSRQIYDVZ2EMWKL4LQJ7A5SDSJ7SLMKGJX6V3PXTYS",
        ],
        vaultNavBase: 152_000_000,
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
      }),
    });
    return response.json();
  });
  expect(preSignResponse.plan.guardrails.status).toBe("blocked");
  expect(preSignResponse.plan.selectedCandidate).toBeNull();
  expect(preSignResponse.plan.guardrails.blockedReasons.join(" ")).toMatch(
    /Post-trade deviation.*Daily turnover cap/i,
  );
  expect(
    preSignResponse.plan.guardrails.checks.find(
      (check: { id: string }) => check.id === "post_trade_deviation_bps",
    )?.evidence,
  ).toMatchObject({ source: "missing_state", vaultNavBase: 152_000_000 });
  expect(sawPreSignRequest).toBe(true);
});
