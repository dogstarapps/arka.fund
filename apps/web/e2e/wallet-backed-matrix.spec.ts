import { expect, test, type Locator, type Page } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";
import {
  WALLET_WRITE_LANES,
  validateWalletProviderRejectionMatrix,
} from "../src/lib/workflows/walletProviderRejectionMatrix";

const depositArkaId =
  process.env.E2E_DEPOSIT_ARKA_ID ??
  "CC7FKBATS5RSDMHELHXX6U257Q6KXKV53UUN4JLHKJF5Q3TIN5NDZ5DQ";
const depositTokenId =
  process.env.E2E_DEPOSIT_TOKEN_ID ??
  "CATEHH24BDDCEKDH2PNLBMMH42L5MUNQF4DCG474CP4FCSVFMVOONBTK";
const coverageVaultId =
  process.env.NEXT_PUBLIC_COVERAGE_VAULT ??
  "CCLEUWT6NSMIP2QFGHRIERDM453X24GC56ZNZH7VVEDVQ5JRNNRFB5BL";
const managerTierId =
  process.env.NEXT_PUBLIC_MANAGER_TIER ??
  "CDQVWIBJDX3K3XS4OLL4HFFSG2KKQGOZU7TIFCLMXFDCJDRDOQLB6FGR";
const arkaRegistryId =
  process.env.NEXT_PUBLIC_ARKA_REGISTRY ??
  "CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW";
const oracleGuardId =
  process.env.NEXT_PUBLIC_ORACLE_GUARD ??
  "CBVIUEY2C627QSVCKNC4XSVSHRH3DTRK6HQOBOQVJBIXKUKJDH5E22BZ";

const OPERATOR_ROUTES = [
  {
    path: "/contracts",
    heading: /contract control center/i,
    panel: "contracts-preset-panel",
    actionProbe: "contracts-action-select",
  },
  {
    path: "/integrations/operator",
    heading: /integrations operator/i,
    panel: "integrations-workspace-summary",
    actionProbe: "integrations-workspace-tabs",
  },
  {
    path: "/settings",
    heading: /^settings$/i,
    panel: "settings-workspace-summary",
    actionProbe: "settings-workspace-tabs",
  },
  {
    path: "/ops",
    heading: /^operations$/i,
    panel: "ops-workspace-summary",
    actionProbe: "ops-workspace-tabs",
  },
  {
    path: "/migrations",
    heading: /migration workspace/i,
    panel: "migrations-workspace-summary",
    actionProbe: "migrations-workspace-tabs",
  },
  {
    path: "/status",
    heading: /^status$/i,
    panel: "status-workspace-summary",
    actionProbe: "status-workspace-tabs",
  },
  {
    path: "/tiers",
    heading: /manager tiers/i,
    panel: "tiers-workspace-summary",
    actionProbe: "tiers-workspace-tabs",
  },
] as const;

const PUBLIC_WALLET_ROUTES = [
  {
    path: "/coverage",
    heading: /^coverage reserve$/i,
    panel: "coverage-overview-panel",
    actionProbe: "coverage-workspace-tabs",
  },
  {
    path: "/governance",
    heading: /^governance$/i,
    panel: "governance-public-vote-panel",
    actionProbe: "governance-vote-button",
  },
  {
    path: "/factory/create",
    heading: /create/i,
    panel: "create-arka-denomination-panel",
    actionProbe: "create-stepper-rail",
  },
  {
    path: `/arkas/${depositArkaId}`,
    heading: /arka|vault/i,
    panel: "arka-stage-panel",
    actionProbe: "arka-workspace-tabs",
  },
] as const;

type E2EWalletProfile = "holder" | "manager";

type MatrixPayload = {
  ok: boolean;
  entries: Array<{
    id: string;
    title: string;
    severity: "critical" | "high" | "medium";
    writeActionId: string;
    readActionId: string;
    rollbackActionId: string | null;
    status:
      | "ready"
      | "blocked_missing_contract"
      | "blocked_manual_runbook";
    executionLane:
      | "wallet_backed"
      | "dao_executor"
      | "blocked_missing_contract"
      | "blocked_manual_runbook";
    daoExecutorRequired: boolean;
  }>;
  summary: {
    total: number;
    ready: number;
    blocked: number;
    daoExecutorRequired: number;
    walletBackedExecutable: number;
  };
};

test.describe.configure({ timeout: 120_000 });

async function resolveE2EWalletAddress(
  page: Page,
  profile: E2EWalletProfile,
): Promise<string> {
  const response = await page.request.get(`/api/e2e-wallet?profile=${profile}`);
  expect(response.ok(), `${profile} E2E wallet must be available`).toBe(true);
  const payload = (await response.json()) as {
    address?: string;
    profile?: string;
  };
  expect(payload.address).toMatch(/^G[A-Z0-9]{55}$/);
  expect(payload.profile).toBe(profile);
  return payload.address ?? "";
}

async function installWalletProfile(
  page: Page,
  profile: E2EWalletProfile,
): Promise<string> {
  const address = await resolveE2EWalletAddress(page, profile);
  await page.addInitScript(
    ({ selectedProfile, selectedAddress }) => {
      window.localStorage.setItem("e2e-wallet-profile", selectedProfile);
      window.localStorage.setItem("wallet:pubkey", selectedAddress);
    },
    {
      selectedProfile: profile,
      selectedAddress: address,
    },
  );
  return address;
}

function shortWalletPattern(address: string): RegExp {
  return new RegExp(`${address.slice(0, 6)}.*${address.slice(-4)}`, "i");
}

async function expectNoUnresolvedSurfaceCopy(locator: Locator): Promise<void> {
  const text = await locator.innerText();
  expect(text).not.toMatch(
    /\b(undefined|null|NaN|TODO|lorem|fake|stub|placeholder)\b/i,
  );
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const report = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const offenders = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [role="button"], [data-testid="product-canvas"]',
      ),
    )
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid") ?? "",
          className: element.getAttribute("class") ?? "",
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.left < -1 || entry.right > window.innerWidth + 1),
      )
      .slice(0, 8);

    return {
      ok: overflow <= 1 && offenders.length === 0,
      overflow,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });

  expect(report, `Horizontal overflow report: ${JSON.stringify(report)}`).toMatchObject({
    ok: true,
  });
}

async function waitForSettledSurface(
  page: Page,
  panelTestId: string,
  heading: RegExp,
): Promise<void> {
  await page.getByTestId("product-canvas").waitFor({
    state: "attached",
    timeout: 15_000,
  });

  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ candidatePanelTestId, headingSource, headingFlags }) => {
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

            const panel = document.querySelector(
              `[data-testid="${candidatePanelTestId}"]`,
            );
            if (isVisible(panel)) return "panel";

            const matcher = new RegExp(headingSource, headingFlags);
            const matchedHeading = Array.from(
              document.querySelectorAll("h1, h2, [role='heading']"),
            ).find((element) => matcher.test(element.textContent ?? ""));
            if (isVisible(matchedHeading ?? null)) return "heading";

            return "pending";
          },
          {
            candidatePanelTestId: panelTestId,
            headingSource: heading.source,
            headingFlags: heading.flags,
          },
        ),
      { timeout: 15_000 },
    )
    .not.toBe("pending");
}

async function fillContractsField(
  page: Page,
  key: string,
  value: string,
): Promise<void> {
  const field = page.getByTestId(`contracts-field-${key}`);
  await expect(field, `Expected field ${key} to be visible`).toBeVisible();
  const isSelect = await field.evaluate(
    (element) => element.tagName.toLowerCase() === "select",
  );
  if (isSelect) {
    await field.selectOption(value);
    return;
  }
  await field.fill(value);
}

async function confirmContractsIfVisible(page: Page): Promise<void> {
  const confirm = page.getByTestId("contracts-confirm-button");
  if (await confirm.count()) {
    await confirm.click();
  }
}

async function runContractsPreset(page: Page): Promise<string> {
  await page.getByTestId("contracts-run-preset-button").click();
  await confirmContractsIfVisible(page);

  const readFeedbackText = async (testId: string): Promise<string> => {
    const locator = page.getByTestId(testId);
    if ((await locator.count()) === 0) return "";
    return ((await locator.textContent()) ?? "").trim();
  };

  await expect
    .poll(
      async () => {
        const status = await readFeedbackText("contracts-preset-status");
        const error = await readFeedbackText("contracts-preset-error");
        return `${status} ${error}`.trim();
      },
      { timeout: 45_000 },
    )
    .not.toBe("");

  const statusText = await readFeedbackText("contracts-preset-status");
  const errorText = await readFeedbackText("contracts-preset-error");
  return `${statusText} ${errorText}`.trim();
}

async function selectContractsAction(
  page: Page,
  actionId: string,
  contractId: string,
): Promise<void> {
  await page.getByTestId("contracts-action-select").selectOption(actionId);
  await page.getByTestId("contracts-contract-id-input").fill(contractId);
}

async function expectAnyVisibleTestId(
  page: Page,
  testIds: readonly string[],
  message: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        for (const testId of testIds) {
          const locator = page.getByTestId(testId).first();
          if ((await locator.count()) === 0) continue;
          if (await locator.isVisible().catch(() => false)) return testId;
        }
        return "";
      },
      { timeout: 20_000, message },
    )
    .not.toBe("");
}

async function openWalletLaneSurface(page: Page, laneId: string): Promise<void> {
  if (laneId === "create") {
    await installWalletProfile(page, "holder");
    await page.goto("/factory/create?step=review&denomination=BLND&asset=XTAR", {
      waitUntil: "domcontentloaded",
    });
    await waitForSettledSurface(page, "create-review-panel", /create/i);
    return;
  }

  if (laneId === "deposit" || laneId === "redeem") {
    await installWalletProfile(page, "holder");
    await page.goto(`/arkas/${depositArkaId}?workspace=flow`, { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, "arka-stage-panel", /arka|vault/i);
    await expect(page.getByTestId("arka-workspace-tab-flow")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    return;
  }

  if (laneId === "rebalance") {
    await installWalletProfile(page, "manager");
    await page.goto(`/arkas/${depositArkaId}?workspace=rebalance`, { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, "arka-stage-panel", /arka|vault/i);
    await expect(page.getByTestId("arka-workspace-tab-rebalance")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    return;
  }

  if (laneId === "coverage") {
    await installWalletProfile(page, "holder");
    await page.goto("/coverage?workspace=actions", { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, "coverage-actions-panel", /^coverage reserve$/i);
    await expect(page.getByTestId("coverage-workspace-tab-actions")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("coverage-actions-panel")).toBeVisible();
    return;
  }

  if (laneId === "governance") {
    await installWalletProfile(page, "manager");
    await page.goto("/governance", { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, "governance-public-vote-panel", /^governance$/i);
    return;
  }

  if (laneId === "contracts") {
    await enableOperatorMode(page);
    await page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, "contracts-preset-panel", /contract control center/i);
    return;
  }

  throw new Error(`Unknown wallet lane ${laneId}`);
}

test("holder wallet survives the public product paths that require real account context", async ({
  page,
}) => {
  const holderAddress = await installWalletProfile(page, "holder");
  const shortHolder = shortWalletPattern(holderAddress);

  for (const route of PUBLIC_WALLET_ROUTES) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, route.panel, route.heading);
    await expect(page.getByTestId(route.actionProbe).first()).toBeVisible();
    await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("/governance", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("wallet-badge-chrome")).toContainText(shortHolder);

  await page.goto("/factory/create?step=start", { waitUntil: "domcontentloaded" });
  await waitForSettledSurface(page, "create-start-panel", /create/i);
  await expect(page.getByTestId("create-arka-wallet").first()).toContainText(
    shortHolder,
  );

  await page.goto(`/arkas/${depositArkaId}?workspace=flow`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("arka-stage-panel")).toBeVisible();
  await expect(page.getByTestId("arka-workspace-tab-flow")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("arka-asset-select")).toBeVisible();
  await expect(page.getByTestId("arka-amount-input")).toBeVisible();
});

test("wallet provider rejection matrix maps every write lane to a visible product surface", async ({
  page,
}) => {
  const validation = validateWalletProviderRejectionMatrix();
  expect(validation.summary.cases).toBe(35);
  expect(validation.summary.failClosedCases).toBe(35);

  for (const lane of WALLET_WRITE_LANES) {
    await openWalletLaneSurface(page, lane.id);
    await expectAnyVisibleTestId(
      page,
      lane.visibleSurfaceTestIds,
      `${lane.id} must expose at least one canonical wallet-backed surface`,
    );
    await expectAnyVisibleTestId(
      page,
      lane.writeActionTestIds,
      `${lane.id} must expose a canonical write action for rejection coverage`,
    );
    await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
    await expectNoHorizontalOverflow(page);
  }
});

test("verified operator wallet opens every protected operational surface across browsers", async ({
  page,
}) => {
  await enableOperatorMode(page);

  for (const route of OPERATOR_ROUTES) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await waitForSettledSurface(page, route.panel, route.heading);
    await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
    await expect(page.getByTestId("operator-session-strip")).toContainText(
      /verified operator wallet/i,
    );
    await expect(page.getByTestId(route.actionProbe).first()).toBeVisible();
    await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
    await expectNoHorizontalOverflow(page);
  }
});

test("contracts mutation matrix is machine-consumable and wired to visible actions", async ({
  page,
}) => {
  await enableOperatorMode(page);
  const response = await page.request.get("/api/contracts/mutation-matrix");
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as MatrixPayload;

  expect(payload.ok).toBe(true);
  expect(payload.summary.total).toBe(payload.entries.length);
  expect(payload.summary.total).toBeGreaterThanOrEqual(48);
  expect(payload.summary.ready + payload.summary.blocked).toBe(
    payload.summary.total,
  );
  expect(payload.summary.daoExecutorRequired).toBeGreaterThan(0);

  await page.goto("/contracts", { waitUntil: "domcontentloaded" });
  await waitForSettledSurface(
    page,
    "contracts-preset-panel",
    /contract control center/i,
  );
  await expect(page.getByTestId("contracts-mutation-matrix-panel")).toBeVisible();

  const availableActions = new Set(
    await page
      .getByTestId("contracts-action-select")
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter((value) => value.length > 0),
      ),
  );

  for (const entry of payload.entries) {
    expect(
      availableActions.has(entry.writeActionId),
      `${entry.id} write action ${entry.writeActionId} must be exposed`,
    ).toBe(true);
    expect(
      availableActions.has(entry.readActionId),
      `${entry.id} read action ${entry.readActionId} must be exposed`,
    ).toBe(true);
    if (entry.rollbackActionId) {
      expect(
        availableActions.has(entry.rollbackActionId),
        `${entry.id} rollback action ${entry.rollbackActionId} must be exposed`,
      ).toBe(true);
    }

    const row = page.getByTestId(`contracts-mutation-matrix-row-${entry.id}`);
    await expect(row).toContainText(entry.title);
    await expect(row).toContainText(entry.writeActionId);
    await expect(row).toContainText(entry.readActionId);
  }
});

test("contracts typed reads and DAO-only writes keep the same behavior across browsers", async ({
  page,
}) => {
  await enableOperatorMode(page);
  const managerAddress = await resolveE2EWalletAddress(page, "manager");
  const holderAddress = await resolveE2EWalletAddress(page, "holder");

  await page.goto("/contracts", { waitUntil: "domcontentloaded" });
  await waitForSettledSurface(
    page,
    "contracts-preset-panel",
    /contract control center/i,
  );

  const readableActions = [
    {
      actionId: "manager-tier-read-thresholds",
      contractId: managerTierId,
    },
    {
      actionId: "arka-registry-read-count",
      contractId: arkaRegistryId,
    },
    {
      actionId: "coverage-vault-read-governor",
      contractId: coverageVaultId,
    },
  ] as const;

  for (const read of readableActions) {
    await selectContractsAction(page, read.actionId, read.contractId);
    const detail = await runContractsPreset(page);
    expect(detail).toMatch(/read call completed/i);
    await expect(page.getByTestId("contracts-preset-read-result")).toContainText(
      /\S/,
    );
  }

  const blockedWrites = [
    {
      actionId: "arka-set-governor",
      contractId: depositArkaId,
      fields: [
        { key: "caller", value: managerAddress },
        { key: "governor", value: holderAddress },
      ],
    },
    {
      actionId: "coverage-vault-set-lock-bps",
      contractId: coverageVaultId,
      fields: [
        { key: "caller", value: managerAddress },
        { key: "lock_bps", value: "30.01" },
      ],
    },
    {
      actionId: "oracle-guard-clear-stellar-asset-policy",
      contractId: oracleGuardId,
      fields: [
        { key: "caller", value: managerAddress },
        { key: "asset", value: depositTokenId },
      ],
    },
  ] as const;

  for (const write of blockedWrites) {
    await selectContractsAction(page, write.actionId, write.contractId);
    for (const field of write.fields) {
      await fillContractsField(page, field.key, field.value);
    }
    const detail = await runContractsPreset(page);
    expect(detail.toLowerCase()).toMatch(
      /dao policy|governance mutation|blocked/,
    );
  }
});
