import { expect, test, type Locator, type Page } from "@playwright/test";
import { OPERATOR_CONSOLE_NAV } from "../src/lib/workflows/productNavigation";
import { enableOperatorMode } from "./helpers/operator-mode";

const OPERATOR_ROUTE_EXPECTATIONS = [
  {
    path: "/governance/console",
    label: "DAO Console",
    heading: /^governance console$/i,
    activeTestId: "chrome-utility-dao-console",
    panel: "governance-composer-panel",
  },
  {
    path: "/integrations/operator",
    label: "Integration Ops",
    heading: /^integrations operator$/i,
    activeTestId: "chrome-utility-integration-ops",
    panel: "integrations-workspace-summary",
  },
  {
    path: "/migrations",
    label: "Migrations",
    heading: /^migration workspace$/i,
    activeTestId: "chrome-utility-migrations",
    panel: "migration-plan-panel",
  },
  {
    path: "/ops",
    label: "Ops",
    heading: /^operations$/i,
    activeTestId: "chrome-utility-ops",
    panel: "ops-workspace-summary",
  },
  {
    path: "/contracts",
    label: "Contracts",
    heading: /^contract control center$/i,
    activeTestId: "chrome-utility-contracts",
    panel: "contracts-preset-panel",
  },
  {
    path: "/settings",
    label: "Settings",
    heading: /^settings$/i,
    activeTestId: "chrome-utility-settings",
    panel: "settings-config-panel",
  },
  {
    path: "/status",
    label: "Status",
    heading: /^status$/i,
    activeTestId: "chrome-utility-status",
    panel: "status-baseline-panel",
  },
  {
    path: "/tiers",
    label: "Tiers",
    heading: /^manager tiers$/i,
    activeTestId: "chrome-utility-tiers",
    panel: "tiers-workspace-summary",
  },
] as const;

test.describe.configure({ timeout: 60_000 });

async function hasHorizontalOverflow(locator: Locator): Promise<boolean> {
  return locator.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
}

async function expectNoPageHorizontalOverflow(page: Page) {
  let lastReport: unknown = null;
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const report = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const offenders = Array.from(
        document.querySelectorAll<HTMLElement>("body *"),
      )
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            testId: element.getAttribute("data-testid") ?? "",
            className: String(element.getAttribute("class") ?? ""),
            width: Math.round(box.width),
            left: Math.round(box.left),
            right: Math.round(box.right),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            overflowAmount: Math.max(
              Math.round(box.right - window.innerWidth),
              Math.round(-box.left),
              element.scrollWidth - element.clientWidth,
            ),
          };
        })
        .filter(
          (entry) =>
            entry.width > 0 &&
            (entry.right > window.innerWidth + 1 ||
              entry.left < -1 ||
              entry.scrollWidth > entry.clientWidth + 1),
        )
        .sort((left, right) => right.overflowAmount - left.overflowAmount)
        .slice(0, 8);

      return {
        ok: overflow <= 1,
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow,
        path: window.location.pathname,
        offenders,
      };
    });
    lastReport = report;
    if (report.ok) return;
    await page.waitForTimeout(250);
  }

  throw new Error(
    `Horizontal overflow detected:\n${JSON.stringify(lastReport, null, 2)}`,
  );
}

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
  await expect(page.getByTestId(panelByWorkspace[id])).toBeVisible({
    timeout: 15_000,
  });
}

type OperatorRouteSettlement = "content" | "verified" | "ready";

async function installE2EWalletProfile(
  page: Page,
  profile: "holder" | "manager",
): Promise<string> {
  const response = await page.request.get(`/api/e2e-wallet?profile=${profile}`);
  expect(response.ok(), `${profile} E2E wallet must resolve`).toBeTruthy();
  const wallet = (await response.json()) as { address?: string; profile?: string };
  expect(wallet.address).toMatch(/^G[A-Z0-9]{55}$/);
  await page.addInitScript(
    ({ selectedProfile, selectedAddress }) => {
      window.localStorage.setItem("e2e-wallet-profile", selectedProfile);
      window.localStorage.setItem("wallet:pubkey", selectedAddress);
      window.localStorage.removeItem("arkafund.operatorSession");
      window.localStorage.removeItem("arkafund.operatorMode");
    },
    {
      selectedProfile: profile,
      selectedAddress: wallet.address ?? "",
    },
  );
  return wallet.address ?? "";
}

async function waitForOperatorRouteSettlement(
  page: Page,
  panelTestId?: string,
  heading?: RegExp,
): Promise<OperatorRouteSettlement> {
  await page
    .getByTestId("product-canvas")
    .waitFor({ state: "attached", timeout: 10_000 });
  const settled = await page
    .waitForFunction(
      ({ panelTestId: candidatePanelTestId, headingSource, headingFlags }) => {
        const isVisible = (element: Element | null): boolean => {
          if (!element) return false;
          const style = window.getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            box.width > 0 &&
            box.height > 0
          );
        };

        if (
          candidatePanelTestId &&
          isVisible(
            document.querySelector(`[data-testid="${candidatePanelTestId}"]`),
          )
        ) {
          return "content";
        }

        if (headingSource) {
          const matcher = new RegExp(headingSource, headingFlags);
          const routeHeading = Array.from(
            document.querySelectorAll("h1, h2, [role='heading']"),
          ).find((element) => matcher.test(element.textContent ?? ""));
          if (isVisible(routeHeading ?? null)) {
            return "content";
          }
        }

        if (
          isVisible(
            document.querySelector("[data-testid='advanced-console-status']"),
          )
        ) {
          return "verified";
        }

        const enableButton = document.querySelector<HTMLButtonElement>(
          "[data-testid='operator-route-enable']",
        );
        if (enableButton && isVisible(enableButton) && !enableButton.disabled) {
          return "ready";
        }

        return null;
      },
      {
        panelTestId,
        headingSource: heading?.source ?? "",
        headingFlags: heading?.flags ?? "",
      },
      { timeout: 15_000 },
    )
    .then(
      (handle) => handle.jsonValue() as Promise<OperatorRouteSettlement | null>,
    );

  if (!settled) {
    throw new Error(
      "Operator route did not settle into content, verified or ready state",
    );
  }
  return settled;
}

async function gotoOperatorRoute(
  page: Page,
  path: string,
  panelTestId?: string,
  heading?: RegExp,
) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  const enableButton = page.getByTestId("operator-route-enable");
  const gate = page.getByTestId("operator-route-gate");
  const settled = await waitForOperatorRouteSettlement(
    page,
    panelTestId,
    heading,
  );

  if (settled !== "ready") {
    return;
  }

  if (await enableButton.isVisible().catch(() => false)) {
    await page.evaluate(() =>
      window.localStorage.setItem("e2e-wallet-profile", "manager"),
    );
    await expect(enableButton).toBeEnabled({ timeout: 10_000 });
    await enableButton.click();
    await expect(gate).toHaveCount(0, {
      timeout: 10_000,
    });
  }
}

async function gotoWithBindingAbortRetry(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("interrupted by another navigation")) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }
    if (!message.includes("NS_BINDING_ABORTED")) throw error;
    await page.waitForTimeout(250);
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
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
      evaluatedAt: "2026-05-02T18:00:00.000Z",
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
      generatedAt: "2026-05-02T18:00:00.000Z",
      balancedPlannerAdmission: "blocked",
      balancedManualExecutionEligible: false,
      balancedComparableQuote: false,
      balancedSupportStatus: "blocked",
      balancedLaneMode: "undeclared",
      balancedAutoSurfaceReady: false,
      balancedAutoSurfaceReason: "Not wired",
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
        validatedAt: "2026-05-02T18:00:00.000Z",
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

async function countViewportClippedControls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [role="button"]',
      ),
    );
    return controls.filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return false;
      return box.left < -1 || box.right > window.innerWidth + 1;
    }).length;
  });
}

test("operator-only routes stay gated until a verified operator wallet opens them", async ({
  page,
}) => {
  expect(OPERATOR_ROUTE_EXPECTATIONS.map((route) => route.path)).toEqual(
    OPERATOR_CONSOLE_NAV.map((item) => item.href),
  );

  for (const route of OPERATOR_ROUTE_EXPECTATIONS) {
    await page.goto(route.path);
    await expect(page.getByTestId("operator-route-gate")).toBeVisible();
    await expect(page.getByTestId("operator-route-gate")).toContainText(
      route.label,
    );
    await expect(page.getByTestId("advanced-console-guard")).toBeVisible();
    await expect(page.getByTestId("operator-route-enable")).toBeVisible();
  }
});

test("connected non-operator wallet cannot unlock protected operational routes", async ({
  page,
}) => {
  await installE2EWalletProfile(page, "holder");

  for (const route of OPERATOR_ROUTE_EXPECTATIONS) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("operator-route-gate")).toBeVisible();
    await expect(page.getByTestId("operator-route-gate")).toContainText(
      route.label,
    );
    await expect(page.getByTestId("operator-route-enable")).toBeEnabled({
      timeout: 10_000,
    });

    await page.getByTestId("operator-route-enable").click();

    await expect(page.getByTestId("operator-route-gate")).toContainText(
      /wallet_not_authorized|not authorized|operator/i,
      { timeout: 10_000 },
    );
    await expect(page.getByTestId(route.panel)).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
    expect(await countViewportClippedControls(page)).toBe(0);
  }
});

test("public transactional utility routes remain reachable without operator access", async ({
  page,
}) => {
  const publicUtilityRoutes = [
    {
      path: "/factory/create",
      heading: /^create your arka$/i,
      panel: "create-profile-panel",
    },
    {
      path: "/governance",
      heading: /^governance$/i,
      panel: "governance-overview-panel",
    },
    {
      path: "/coverage",
      heading: /^coverage reserve$/i,
      panel: "coverage-overview-panel",
    },
  ];

  for (const route of publicUtilityRoutes) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    await expect(page.getByTestId(route.panel)).toBeVisible();
    await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  }
});

test("verified operator access unlocks every utility route across route changes", async ({
  page,
}) => {
  await enableOperatorMode(page);

  for (const route of OPERATOR_ROUTE_EXPECTATIONS) {
    await gotoOperatorRoute(page, route.path, route.panel, route.heading);
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    await expect(page.getByTestId("advanced-console-status")).toContainText(
      "Operator wallet verified",
    );
    await expect(page.getByTestId(route.activeTestId)).toHaveClass(
      /chrome-utility-link-active/,
    );
  }
});

test("operator write route locks on disconnect, rejects holder switch and recovers with operator wallet", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await gotoOperatorRoute(
    page,
    "/contracts",
    "contracts-preset-panel",
    /^contract control center$/i,
  );

  await expect(page.getByTestId("contracts-preset-panel")).toBeVisible();
  await expect(page.getByTestId("advanced-console-status")).toContainText(
    "Operator wallet verified",
  );
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveClass(
    /chrome-utility-link-active/,
  );

  await page.evaluate(() => {
    window.localStorage.removeItem("wallet:pubkey");
    window.dispatchEvent(
      new CustomEvent("wallet:pubkey-changed", { detail: "" }),
    );
  });

  await expect(page.getByTestId("operator-route-gate")).toContainText(
    /reconnect the authorized operator wallet/i,
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("contracts-preset-panel")).toHaveCount(0);
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);

  const holderResponse = await page.request.get("/api/e2e-wallet?profile=holder");
  expect(holderResponse.ok(), "holder E2E wallet must resolve").toBeTruthy();
  const holderWallet = (await holderResponse.json()) as { address?: string };
  expect(holderWallet.address).toMatch(/^G[A-Z0-9]{55}$/);
  await page.evaluate((holderAddress) => {
    window.localStorage.setItem("e2e-wallet-profile", "holder");
    window.localStorage.setItem("wallet:pubkey", holderAddress);
    window.dispatchEvent(
      new CustomEvent("wallet:pubkey-changed", { detail: holderAddress }),
    );
  }, holderWallet.address ?? "");

  await expect(page.getByTestId("operator-route-enable")).toBeEnabled({
    timeout: 10_000,
  });
  await page.getByTestId("operator-route-enable").click();
  await expect(page.getByTestId("operator-route-gate")).toContainText(
    /wallet_not_authorized|not authorized|operator/i,
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("contracts-preset-panel")).toHaveCount(0);

  const managerResponse = await page.request.get("/api/e2e-wallet?profile=manager");
  expect(managerResponse.ok(), "manager E2E wallet must resolve").toBeTruthy();
  const managerWallet = (await managerResponse.json()) as { address?: string };
  expect(managerWallet.address).toMatch(/^G[A-Z0-9]{55}$/);
  await page.evaluate((managerAddress) => {
    window.localStorage.setItem("e2e-wallet-profile", "manager");
    window.localStorage.setItem("wallet:pubkey", managerAddress);
    window.dispatchEvent(
      new CustomEvent("wallet:pubkey-changed", { detail: managerAddress }),
    );
  }, managerWallet.address ?? "");

  await expect(page.getByTestId("operator-route-enable")).toBeEnabled({
    timeout: 10_000,
  });
  await page.getByTestId("operator-route-enable").click();

  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("contracts-preset-panel")).toBeVisible();
  await expect(page.getByTestId("advanced-console-status")).toContainText(
    "Operator wallet verified",
  );
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveClass(
    /chrome-utility-link-active/,
  );
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
});

test("migrations workspace remains stable cross-browser with inspection and verification data", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
  const validHash = "ab".repeat(32);

  await enableOperatorMode(page);
  await page.route("**/api/migrations/inspect**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        snapshot: {
          factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
          registryId: validAddress,
          sourceArka: validAddress,
          targetArka: validAddress,
          currentShareTokenImplementation: validHash,
          migratedTo: "",
          migratedFrom: "",
          sourceShareToken: validAddress,
          targetShareToken: validAddress,
        },
      }),
    });
  });

  await gotoOperatorRoute(
    page,
    "/migrations",
    "migration-plan-panel",
    /^migration workspace$/i,
  );

  await expect(
    page.getByRole("heading", { name: /^migration workspace$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("migration-preflight-table")).toContainText(
    "Share-token implementation",
  );
  await expect(page.getByTestId("migrations-workspace-tab-plan")).toHaveAttribute(
    "aria-controls",
    "migrations-workspace-panel-plan",
  );
  await expect(page.getByTestId("migrations-workspace-panel")).toHaveAttribute(
    "id",
    "migrations-workspace-panel-plan",
  );
  await page.getByTestId("migration-share-token-hash-input").fill(validHash);
  await page.getByTestId("migrations-workspace-tab-verify").click();
  await expect(page.getByTestId("migrations-workspace-panel")).toHaveAttribute(
    "id",
    "migrations-workspace-panel-verify",
  );
  await expect(
    page.getByTestId("migration-verification-row-share-token-implementation"),
  ).toContainText("Aligned");
  await page.getByTestId("migrations-workspace-tab-export").click();
  await expect(page.getByTestId("migrations-workspace-panel")).toHaveAttribute(
    "id",
    "migrations-workspace-panel-export",
  );
  await expect(page.getByTestId("migration-bundle-table")).toContainText(
    "Factory implementation",
  );
});

test("migrations workspace handles degraded inspection and retry cross-browser", async ({
  page,
}) => {
  let requestCount = 0;

  await enableOperatorMode(page);
  await page.route("**/api/migrations/inspect**", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Factory inspection offline.",
        }),
      });
      return;
    }

    const validAddress =
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
    const validHash = "ab".repeat(32);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        snapshot: {
          factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
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

  await gotoOperatorRoute(
    page,
    "/migrations",
    "migration-plan-panel",
    /^migration workspace$/i,
  );

  await expect(page.getByTestId("migration-error")).toContainText(
    "Factory inspection offline.",
  );
  await expect(
    page.getByTestId("migration-inspection-mode-note"),
  ).toContainText("Factory inspection is currently unavailable");

  await page.getByTestId("migration-inspect-button").click();

  await expect(page.getByTestId("migration-status")).toContainText(
    "Migration inspection refreshed.",
  );
  await expect(
    page.getByTestId("migration-inspection-mode-note"),
  ).toContainText("Latest factory inspection is live.");
});

test("migrations governed write simulation degrades, invalidates stale rows and retries cross-browser", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
  const validHash = "ab".repeat(32);
  let simulateRequests = 0;

  await enableOperatorMode(page);
  await page.route("**/api/migrations/inspect**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        snapshot: {
          factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
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
            detail: "RPC simulation accepted the governed implementation write.",
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
            detail: "RPC simulation accepted the governed share-token write.",
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
            detail: "RPC simulation accepted the governed registry write.",
            xdrBytes: 488,
            argCount: 1,
          },
        ],
      }),
    });
  });

  await gotoOperatorRoute(
    page,
    "/migrations",
    "migration-plan-panel",
    /^migration workspace$/i,
  );

  await page.getByTestId("migration-implementation-hash-input").fill(validHash);
  await page.getByTestId("migration-share-token-hash-input").fill(validHash);
  await page.getByTestId("migrations-workspace-tab-simulate").click();

  await page.getByTestId("migration-simulate-button").click();
  await expect(page.getByTestId("migration-simulation-error")).toContainText(
    "Migration simulation offline.",
  );
  await expect(page.getByTestId("migration-simulation-empty")).toContainText(
    "Run a write simulation",
  );
  await expect(page.getByTestId("migration-simulate-button")).toBeEnabled();

  await page.getByTestId("migration-simulate-button").click();
  await expect(page.getByTestId("migration-simulation-status")).toContainText(
    "Simulated 3/3 governed migration writes.",
  );
  await expect(
    page.getByTestId("migration-simulation-row-factory-implementation"),
  ).toContainText("512 bytes / 1 args");

  await page.getByTestId("migrations-workspace-tab-plan").click();
  await page.getByTestId("migration-share-token-hash-input").fill("cd".repeat(32));
  await page.getByTestId("migrations-workspace-tab-simulate").click();
  await expect(page.getByTestId("migration-simulation-error")).toContainText(
    "Migration plan changed after the last simulation.",
  );
  await expect(
    page.getByTestId("migration-simulation-row-factory-implementation"),
  ).toHaveCount(0);
  await expect(page.getByTestId("migration-simulation-source-note")).toContainText(
    "Pending simulation",
  );

  await expect.poll(() => simulateRequests).toBe(2);
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
});

test("tiers surface stays reachable and readable for verified operator access across browsers", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await gotoOperatorRoute(
    page,
    "/tiers",
    "tiers-workspace-summary",
    /^manager tiers$/i,
  );

  await expect(
    page.getByRole("heading", { name: /^manager tiers$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("tiers-runtime-read-posture")).toContainText(
    /Tier snapshot|Tier read|Tier runtime reads/i,
  );
  await expect(page.getByTestId("tiers-refresh-button")).toBeVisible();
  await expect(page.getByTestId("tiers-state-panel")).toContainText(
    "Score deck",
  );
  await expect(page.getByTestId("tiers-scorecard-table")).toContainText(
    "Threshold ladder",
  );
  await expect(page.getByTestId("tiers-workspace-tab-scorecard")).toHaveAttribute(
    "aria-controls",
    "tiers-workspace-panel-scorecard",
  );
  await expect(page.getByTestId("tiers-workspace-panel")).toHaveAttribute(
    "id",
    "tiers-workspace-panel-scorecard",
  );
  await page.getByTestId("tiers-workspace-tab-update").click();
  await expect(page.getByTestId("tiers-workspace-panel")).toHaveAttribute(
    "id",
    "tiers-workspace-panel-update",
  );
  await expect(page.getByTestId("tiers-actions-panel")).toContainText(
    "Governed deck",
  );
});

test("status runtime health degrades and retries cross-browser", async ({
  page,
}) => {
  let healthRequests = 0;

  await enableOperatorMode(page);
  await page.route("**/api/health", async (route) => {
    healthRequests += 1;
    if (healthRequests === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "health offline" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildReadyHealthPayload()),
    });
  });
  await page.route("**/api/routing/rebalance/benchmark", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "routing_benchmark",
        generatedAt: "2026-05-05T08:00:00.000Z",
        benchmark: {
          overallPassed: true,
          resultCount: 2,
          passedCount: 2,
          worstEfficiencyBps: 10_000,
          results: [
            {
              id: "bounded_exhaustive_deep_path",
              label: "Bounded exhaustive deep-path benchmark",
              mode: "single_route",
              passed: true,
              minEfficiencyBps: 9_850,
              plannerEfficiencyBps: 10_000,
              amountBase: 1_000_000,
              plannerEstimatedOutBase: 1_300_000,
              oracleEstimatedOutBase: 1_300_000,
              plannerSelectedProtocol: "SOROSWAP",
              plannerSelectedPath: "CAAA -> C10 -> C09 -> C08 -> C07 -> CBBB",
              splitStatus: "single_route_optimal",
              splitAllocationCount: 1,
              candidateUniverseSize: 5_861,
              quotedPathCount: 64,
              exhaustivePathCount: 5_861,
              comparedRouteCount: 5_862,
              oracleModel: "exhaustive_route_enumeration",
              oraclePathCount: 5_861,
              quoteBudget: 64,
              maxHops: 5,
              maxIntermediaries: 10,
              quoteCoveragePpm: 10_920,
              note: "Benchmark fixture.",
            },
            {
              id: "chunked_split_route",
              label: "Chunked split-route benchmark",
              mode: "split_route",
              passed: true,
              minEfficiencyBps: 9_850,
              plannerEfficiencyBps: 10_000,
              amountBase: 1_000_000,
              plannerEstimatedOutBase: 1_190_000,
              oracleEstimatedOutBase: 1_190_000,
              plannerSelectedProtocol: "SOROSWAP",
              plannerSelectedPath: "CAAA -> CBBB",
              splitStatus: "recommended",
              splitAllocationCount: 3,
              candidateUniverseSize: 3,
              quotedPathCount: 3,
              exhaustivePathCount: 3,
              comparedRouteCount: 3,
              oracleModel: "exhaustive_chunk_assignment",
              oraclePathCount: 3,
              quoteBudget: 6,
              maxHops: 2,
              maxIntermediaries: 2,
              quoteCoveragePpm: 1_000_000,
              note: "Benchmark fixture.",
            },
          ],
        },
      }),
    });
  });

  await gotoOperatorRoute(
    page,
    "/status",
    "status-baseline-panel",
    /^status$/i,
  );

  await expect(page.getByTestId("status-health-error")).toContainText(
    /runtime health api is unavailable/i,
  );
  await expect(page.getByTestId("status-runtime-health-posture")).toContainText(
    "Runtime fallback active",
  );

  await page.getByTestId("status-health-refresh-button").click();

  await expect(page.getByTestId("status-runtime-health-posture")).toContainText(
    "Runtime health loaded",
  );
  await expect(page.getByTestId("status-health-error")).toHaveCount(0);
  await page.getByTestId("status-workspace-tab-routing").click();
  await expect(page.getByTestId("status-routing-solver-table")).toContainText(
    "Online",
  );
  await expect(page.getByTestId("status-routing-benchmark")).toContainText(
    "Benchmark passing",
  );
  await expect(page.getByTestId("status-routing-benchmark-table")).toContainText(
    "Chunked split-route benchmark",
  );
  await expect.poll(() => healthRequests).toBe(2);
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
});

test("contracts surface keeps raw validation guardrails and dao blocking cross-browser", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await enableOperatorMode(page);
  await gotoOperatorRoute(
    page,
    "/contracts",
    "contracts-preset-panel",
    /^contract control center$/i,
  );

  await expect(
    page.getByRole("heading", { name: /^contract control center$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("contracts-preset-panel")).toContainText(
    "Typed actions",
  );
  await expect(page.getByTestId("contracts-raw-panel")).toContainText(
    "Raw invoke",
  );

  await page.getByTestId("contracts-raw-contract-input").fill("");
  await page.getByTestId("contracts-raw-method-input").fill("");
  await page.getByTestId("contracts-raw-args-input").fill("[]");
  await page.getByTestId("contracts-raw-read-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(
    /raw contract id is required/i,
  );

  await page.getByTestId("contracts-raw-contract-input").fill(validAddress);
  await page.getByTestId("contracts-raw-method-input").fill("");
  await page.getByTestId("contracts-raw-read-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(
    /raw method is required/i,
  );

  await page.getByTestId("contracts-raw-method-input").fill("set_governor");
  await page.getByTestId("contracts-raw-args-input").fill("[]");
  await expect(page.getByTestId("contracts-raw-contract-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-raw-method-input")).toHaveValue(
    "set_governor",
  );
  await expect(page.getByTestId("contracts-raw-args-input")).toHaveValue("[]");
  await expect(page.getByTestId("contracts-raw-dao-guard-note")).toContainText(
    /governance/i,
  );
  await page.getByTestId("contracts-raw-write-button").click();
  await expect(page.getByTestId("contracts-confirm-button")).toBeVisible();
  await page.getByTestId("contracts-confirm-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(
    /dao policy|governance/i,
  );
});

test("contracts surface keeps runtime matrix fallbacks safe when operator APIs are degraded", async ({
  page,
}) => {
  let mutationRequests = 0;
  let storageRequests = 0;

  await enableOperatorMode(page);
  await page.route("**/api/contracts/mutation-matrix", async (route) => {
    mutationRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "mutation_matrix_runtime_unavailable",
      }),
    });
  });
  await page.route("**/api/contracts/storage-lifecycle", async (route) => {
    storageRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "storage_lifecycle_runtime_unavailable",
      }),
    });
  });

  await gotoOperatorRoute(
    page,
    "/contracts",
    "contracts-preset-panel",
    /^contract control center$/i,
  );

  await expect(page.getByTestId("contracts-mutation-matrix-panel")).toContainText(
    /critical mutation matrix/i,
  );
  await expect(page.getByTestId("contracts-mutation-matrix-panel")).toContainText(
    /wallet lane|dao lane/i,
  );
  await expect(page.getByTestId("contracts-storage-lifecycle-panel")).toContainText(
    /storage lifecycle hardening/i,
  );
  await expect(page.getByTestId("contracts-storage-lifecycle-panel")).toContainText(
    /ready|blocked/i,
  );
  await expect
    .poll(() => mutationRequests, { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(() => storageRequests, { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
});

test("integrations Balanced SODAX intent surface degrades and retries cross-browser", async ({
  page,
}) => {
  let catalogRequests = 0;
  let quoteRequests = 0;
  let statusRequests = 0;
  let confirmRequests = 0;

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
            ? JSON.stringify({
                error: "SODAX token catalog unavailable.",
              })
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
              amountInBase: "10000000",
              quotedAmountBase: "9975000",
              quoteType: "exact_input",
            }),
    });
  });
  await page.route("**/api/intents/balanced/status", async (route) => {
    statusRequests += 1;
    await route.fulfill({
      status: statusRequests === 1 ? 503 : 200,
      contentType: "application/json",
      body:
        statusRequests === 1
          ? JSON.stringify({ error: "SODAX status unavailable." })
          : JSON.stringify({
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
    confirmRequests += 1;
    await route.fulfill({
      status: confirmRequests === 1 ? 504 : 200,
      contentType: "application/json",
      body:
        confirmRequests === 1
          ? JSON.stringify({ error: "SODAX confirmation unavailable." })
          : JSON.stringify({
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
              detail:
                "Intent solved and settlement hash confirmed from SODAX status.",
            }),
    });
  });

  await gotoOperatorRoute(
    page,
    "/integrations/operator?workspace=sodax",
    "integrations-workspace-summary",
    /^integrations$/i,
  );
  await expect(page.getByTestId("integrations-workspace-tab-sodax")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("integrations-sodax-panel")).toBeVisible();

  await page.getByTestId("integrations-balanced-intent-load-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-error"),
  ).toContainText("SODAX token catalog unavailable.");
  await expect(
    page.getByTestId("integrations-balanced-intent-token-catalog"),
  ).toContainText("Catalog not loaded yet.");
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-button"),
  ).toBeDisabled();

  await page.getByTestId("integrations-balanced-intent-load-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-token-catalog"),
  ).toContainText("Catalog loaded: bnUSD, USDC");
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-button"),
  ).toBeEnabled();

  await page.getByTestId("integrations-balanced-intent-quote-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-error"),
  ).toContainText("SODAX quote unavailable.");
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-result"),
  ).toContainText("No quote requested yet.");

  await page.getByTestId("integrations-balanced-intent-quote-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-result"),
  ).toContainText("Quote ready");

  await page
    .getByTestId("integrations-balanced-intent-status-input")
    .fill("0xintent");
  await page.getByTestId("integrations-balanced-intent-status-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-error"),
  ).toContainText("SODAX status unavailable.");
  await page.getByTestId("integrations-balanced-intent-status-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-status-result"),
  ).toContainText("Status SOLVED");

  await page.getByTestId("integrations-balanced-intent-confirm-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-confirm-result"),
  ).toContainText("Confirmation unavailable");
  await expect(
    page.getByTestId("integrations-balanced-intent-error"),
  ).toContainText("SODAX confirmation unavailable.");

  await page.getByTestId("integrations-balanced-intent-confirm-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-confirm-result"),
  ).toContainText("Confirm confirmed");

  await expect.poll(() => catalogRequests).toBe(2);
  await expect.poll(() => quoteRequests).toBe(2);
  await expect.poll(() => statusRequests).toBe(2);
  await expect.poll(() => confirmRequests).toBe(2);
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
});

test("operator surfaces stay responsive on tablet and mobile without clipped controls", async ({
  page,
}) => {
  await enableOperatorMode(page);

  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of OPERATOR_ROUTE_EXPECTATIONS) {
      await gotoOperatorRoute(page, route.path, route.panel, route.heading);
      await expectNoPageHorizontalOverflow(page);
      await expect(page.getByTestId(route.panel)).toBeVisible();
      expect(await countViewportClippedControls(page)).toBe(0);
      expect(
        await hasHorizontalOverflow(page.getByTestId("product-rail")),
      ).toBeFalsy();
    }
  }
});

test("live vault execution stays responsive and keeps manager-only rebalance blocked without wallet cross-browser", async ({
  page,
}) => {
  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await gotoWithBindingAbortRetry(page, "/arkas/TEST_BLEND_VAULT?workspace=state");

    await expect(page.getByTestId("arka-stage-panel")).toContainText("Arka");
    await expect(
      page.getByRole("heading", { name: /^TEST_BLEND_VAULT$/i }),
    ).toBeVisible();
    await openArkaWorkspace(page, "flow");
    await expect(page.getByTestId("arka-flow-panel")).toContainText(
      "Deposit and redeem",
    );
    await expect(page.getByTestId("arka-deposit-button")).toBeVisible();
    await expect(page.getByTestId("arka-redeem-button")).toBeVisible();
    await openArkaWorkspace(page, "rebalance");
    await expect(page.getByTestId("arka-rebalance-panel")).toContainText(
      "Connect the manager wallet to make a swap",
    );
    await expect(page.getByTestId("rebalance-run-button")).toBeDisabled();
    await openArkaWorkspace(page, "credit");
    await expect(page.getByTestId("arka-credit-panel")).toContainText(
      "Blend",
    );
    await expect(page.getByTestId("arka-credit-panel")).toContainText(
      "Connect the manager wallet to use Blend",
    );
    await expect(page.getByTestId("credit-run-button")).toHaveCount(0);
    await expect(page.getByTestId("credit-action-picker")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
    expect(await countViewportClippedControls(page)).toBe(0);
  }
});
