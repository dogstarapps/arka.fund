import { expect, test, type Page } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

async function expectNoPageHorizontalOverflow(page: Page) {
  const diagnostics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const overflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid"),
          className: String(element.getAttribute("class") ?? ""),
          right: rect.right,
          width: rect.width,
        };
      })
      .filter((entry) => entry.width > 0 && entry.right > viewportWidth + 1)
      .slice(0, 8);
    return { viewportWidth, scrollWidth: document.documentElement.scrollWidth, overflow, offenders };
  });

  expect(
    diagnostics.overflow,
    `Horizontal overflow detected: ${JSON.stringify(diagnostics, null, 2)}`,
  ).toBeLessThanOrEqual(2);
}

async function expectNoClippedSurfaceControls(page: Page) {
  const clipped = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("button, a, input, select, textarea"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          testId: element.getAttribute("data-testid"),
          label: element.textContent?.trim().slice(0, 80) ?? "",
          width: rect.width,
          height: rect.height,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          entry.height > 0 &&
          (entry.scrollWidth - entry.clientWidth > 2 || entry.scrollHeight - entry.clientHeight > 2),
      )
      .slice(0, 10),
  );

  expect(
    clipped,
    `Clipped interactive controls detected: ${JSON.stringify(clipped, null, 2)}`,
  ).toHaveLength(0);
}

test.beforeEach(async ({ page }) => {
  await enableOperatorMode(page);
});

test("coverage surface keeps product context and fund controls together", async ({
  page,
}) => {
  await page.goto("/coverage");

  await expect(
    page.getByRole("heading", { name: /^coverage reserve$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("coverage-overview-panel")).toContainText(
    "Total reserve",
  );
  await expect(
    page.getByTestId("coverage-workspace-tab-state"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("coverage-workspace-tab-member").click();
  await expect(
    page.getByTestId("coverage-workspace-tab-member"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("coverage-member-panel")).toContainText("Available");
  await expect(page.getByTestId("coverage-member-panel")).toContainText("Rewards");
  await page.getByTestId("coverage-workspace-tab-actions").click();
  await expect(
    page.getByTestId("coverage-workspace-tab-actions"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("coverage-actions-panel")).toContainText(
    "Stake, unstake or claim rewards",
  );
  await expect(page.getByTestId("coverage-actions-panel")).toHaveClass(
    /coverage-actions-frame-cutover/,
  );
  await expect(page.getByTestId("coverage-actions-panel")).toContainText("Manage coverage");
  await expect(page.getByTestId("coverage-command-grid")).toContainText("Claim rewards");
  await expect(page.getByTestId("coverage-command-grid")).toHaveClass(
    /coverage-command-grid/,
  );
  const coverageActionGeometry = await page
    .getByTestId("coverage-command-grid")
    .evaluate((element) => {
      const cards = Array.from(
        element.querySelectorAll<HTMLElement>(":scope > .surface-entry-card"),
      );
      const first = cards[0]?.getBoundingClientRect();
      const second = cards[1]?.getBoundingClientRect();
      return {
        cardCount: cards.length,
        overflow: element.scrollWidth - element.clientWidth,
        isStacked:
          Boolean(first && second) &&
          second!.top >= first!.bottom - 1 &&
          second!.left >= element.getBoundingClientRect().left - 1,
      };
    });
  expect(coverageActionGeometry.cardCount).toBeGreaterThanOrEqual(2);
  expect(coverageActionGeometry.overflow).toBeLessThanOrEqual(1);
  expect(coverageActionGeometry.isStacked).toBe(true);
  await expectNoPageHorizontalOverflow(page);
  await expectNoClippedSurfaceControls(page);
});

test("public governance keeps proposal review and voting understandable", async ({
  page,
}) => {
  await page.goto("/governance");

  await expect(
    page.getByRole("heading", { name: /^governance$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("governance-overview-panel")).toContainText(
    /proposal/i,
  );
  await expect(page.getByTestId("governance-public-vote-panel")).toContainText("Your vote");
  await expect(page.getByTestId("governance-proposal-id-input")).toBeVisible();
  await expect(page.getByTestId("governance-support-select")).toHaveValue("1");
  await expect(page.getByTestId("governance-vote-button")).toBeVisible();
  await expect(page.getByTestId("governance-settings-table")).toHaveCount(0);
  await expect(page.getByTestId("governance-actions-panel")).toHaveCount(0);
  await expect(page.getByTestId("governance-composer-panel")).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
  await expectNoClippedSurfaceControls(page);
});

test("governance composer hands off a governed package into the contracts lane", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/governance/console");

  await expect(
    page.getByTestId("governance-composer-product-decision"),
  ).toContainText("Curated governed packages only");
  await expect(
    page.getByTestId("governance-composer-generic-batch-state"),
  ).toContainText("Generic batch: not supported");

  await expect(
    page.getByTestId("governance-composer-handoff-link"),
  ).toBeDisabled();
  await expect(
    page.getByTestId("governance-composer-handoff-link"),
  ).not.toHaveAttribute("href", /.+/);

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("allowed-venues");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page
    .getByTestId("governance-composer-field-allowed_routers")
    .fill(`${validAddress},${validAddress}`);
  await page
    .getByTestId("governance-composer-field-allowed_adapters")
    .fill(`${validAddress},${validAddress}`);
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_allowed_venues");
  await expect(page.getByTestId("governance-composer-status")).toContainText(
    "Governed package ready",
  );
  await expect(
    page.getByTestId("governance-composer-handoff-link"),
  ).toHaveAttribute("href", "/contracts?draft=governed-action");

  await page.getByTestId("governance-composer-handoff-link").click();

  await expect(page).toHaveURL(/\/contracts(?:\?|$)/);
  await expect(page.getByTestId("contracts-action-select")).toHaveValue(
    "arka-set-allowed-venues",
  );
  await expect(page.getByTestId("contracts-contract-id-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-field-allowed_routers")).toHaveValue(
    `${validAddress},${validAddress}`,
  );
  await expect(
    page.getByTestId("contracts-field-allowed_adapters"),
  ).toHaveValue(`${validAddress},${validAddress}`);
  await expect(page.getByTestId("contracts-preset-status")).toContainText(
    "Loaded governed action draft",
  );
});

test("governance composer stages a publication candidate and restores it inside governance", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/governance/console");

  await expect(
    page.getByTestId("governance-publication-handoff-link"),
  ).toBeDisabled();
  await expect(
    page.getByTestId("governance-publication-handoff-link"),
  ).not.toHaveAttribute("href", /.+/);

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("coverage-treasury");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page.getByTestId("governance-composer-field-treasury").fill("");
  await page.getByTestId("governance-composer-build-button").click();
  await page.getByTestId("governance-composer-queue-button").click();

  await expect(page.getByTestId("governance-composer-status")).toContainText(
    "staged in Governance",
  );
  await expect(
    page.getByTestId("governance-publication-package-json"),
  ).toContainText("set_treasury");
  await expect(
    page.getByTestId("governance-publication-handoff-link"),
  ).toHaveAttribute("href", "/contracts?draft=governed-action");

  await page.reload();

  await expect(page.getByTestId("governance-publication-panel")).toContainText(
    "set_treasury",
  );
  await page.getByTestId("governance-publication-restore-button").click();
  await expect(page.getByTestId("governance-composer-status")).toContainText(
    "Coverage treasury",
  );
  await expect(
    page.getByTestId("governance-composer-template-select"),
  ).toHaveValue("coverage-treasury");

  await page.getByTestId("governance-publication-handoff-link").click();

  await expect(page).toHaveURL(/\/contracts$/);
  await expect(page.getByTestId("contracts-action-select")).toHaveValue(
    "coverage-fund-set-treasury",
  );
});

test("governance composer authors coverage policy packages and hands them off", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/governance/console");

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("coverage-covered-vault-policy");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page.getByTestId("governance-composer-field-vault").fill(validAddress);
  await page
    .getByTestId("governance-composer-field-annual_premium_bps")
    .fill("3.50");
  await page
    .getByTestId("governance-composer-field-coverage_limit")
    .fill("25000000");
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_covered_vault_policy");
  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText('"type": "i128"');

  await page.getByTestId("governance-composer-handoff-link").click();

  await expect(page).toHaveURL(/\/contracts$/);
  await expect(page.getByTestId("contracts-action-select")).toHaveValue(
    "coverage-fund-set-covered-vault-policy",
  );
  await expect(page.getByTestId("contracts-contract-id-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-field-vault")).toHaveValue(
    validAddress,
  );
  await expect(
    page.getByTestId("contracts-field-annual_premium_bps"),
  ).toHaveValue("3.50");
  await expect(page.getByTestId("contracts-field-coverage_limit")).toHaveValue(
    "25000000",
  );
});

test("governance composer authors factory creation-fee and coverage treasury clear packages", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/governance/console");

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("factory-creation-fee");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-token").fill(validAddress);
  await page.getByTestId("governance-composer-field-amount").fill("15000000");
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_creation_fee");
  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText('"type": "i128"');

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("coverage-treasury");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page.getByTestId("governance-composer-field-treasury").fill("");
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_treasury");
  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText('"type": "void"');

  await page.getByTestId("governance-composer-handoff-link").click();

  await expect(page).toHaveURL(/\/contracts$/);
  await expect(page.getByTestId("contracts-action-select")).toHaveValue(
    "coverage-fund-set-treasury",
  );
  await expect(page.getByTestId("contracts-contract-id-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-field-caller")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-field-treasury")).toHaveValue("");
});

test("governance composer authors manager-tier thresholds and executor governor clear packages", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/governance/console");

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("manager-tier-thresholds");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page
    .getByTestId("governance-composer-field-tier1_threshold")
    .fill("100");
  await page
    .getByTestId("governance-composer-field-tier2_threshold")
    .fill("500");
  await page
    .getByTestId("governance-composer-field-tier3_threshold")
    .fill("1000");
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_thresholds");
  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText('"type": "i128"');

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("executor-governor");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page.getByTestId("governance-composer-field-governor").fill("");
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_governor");
  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText('"type": "void"');

  await page.getByTestId("governance-composer-handoff-link").click();

  await expect(page).toHaveURL(/\/contracts$/);
  await expect(page.getByTestId("contracts-action-select")).toHaveValue(
    "executor-set-governor",
  );
  await expect(page.getByTestId("contracts-contract-id-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-field-caller")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-field-governor")).toHaveValue("");
});

test("governance composer authors credit-market and oracle-guard policy packages", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/governance/console");

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("credit-market-config");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  await page.getByTestId("governance-composer-field-caller").fill(validAddress);
  await page
    .getByTestId("governance-composer-field-protocol")
    .selectOption("Blend");
  await page.getByTestId("governance-composer-field-market_id").fill("7");
  await page
    .getByTestId("governance-composer-field-adapter")
    .fill(validAddress);
  await page
    .getByTestId("governance-composer-field-allow_borrow")
    .selectOption("false");
  await page
    .getByTestId("governance-composer-field-allow_withdraw")
    .selectOption("false");
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("configure_credit_market");
  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText('"type": "symbol"');

  await page
    .getByTestId("governance-composer-template-select")
    .selectOption("oracle-guard-stellar-asset-policy");
  await page
    .getByTestId("governance-composer-contract-input")
    .fill(validAddress);
  for (const fieldId of ["caller", "asset", "primary", "secondary"]) {
    await page
      .getByTestId(`governance-composer-field-${fieldId}`)
      .fill(validAddress);
  }
  await page.getByTestId("governance-composer-build-button").click();

  await expect(
    page.getByTestId("governance-composer-package-json"),
  ).toContainText("set_stellar_asset_policy");
});

test("integrations operator surface keeps router wiring and execution posture together", async ({
  page,
}) => {
  await page.goto("/integrations/operator");

  await expect(
    page.getByRole("heading", { name: /^integrations operator$/i }),
  ).toBeVisible();
  await expect(
    page.getByTestId("integrations-workspace-tab-routing"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("integrations-product-catalog")).toContainText(
    "Supported protocols",
  );
  await expect(page.getByTestId("integrations-product-card-grid")).toContainText(
    "Blend",
  );
  await expect(page.getByTestId("integrations-product-card-soroswap")).toContainText(
    "SoroSwap",
  );
  await expect(
    page.getByTestId("integrations-product-card-soroswap-link"),
  ).toHaveAttribute("href", "/arkas");
  await expect(page.getByTestId("integrations-product-card-balanced")).toContainText(
    "SODAX",
  );
  await expect(page.getByTestId("integrations-public-metric-deck")).toContainText(
    "Protocol coverage",
  );
  await expect(page.getByTestId("integrations-public-metric-auto")).toContainText(
    "AUTO venues",
  );
  await expect(
    page.getByTestId("integrations-workspace-summary"),
  ).toContainText("Protocol map");
  await expect(page.getByTestId("integrations-command-deck")).toContainText(
    "Balanced / SODAX",
  );
  await expect(page.getByTestId("integrations-command-deck")).toHaveClass(
    /integrations-command-deck-cutover/,
  );
  await expect(page.getByTestId("integrations-command-amm")).toContainText(
    "SoroSwap + Aquarius + Phoenix",
  );
  await expect(page.getByTestId("integrations-command-amm-link")).toHaveAttribute(
    "href",
    "/arkas",
  );
  await expect(page.getByTestId("integrations-routing-table")).toContainText(
    "Balanced adapter",
  );
  await expect(page.getByTestId("integrations-routing-panel")).toHaveClass(
    /integrations-workspace-frame-cutover/,
  );
  await expect(page.getByTestId("integrations-routing-table")).toHaveClass(
    /integrations-routing-table-cutover/,
  );
  await expect(page.getByTestId("integrations-routing-table")).toContainText(
    "Aquarius adapter",
  );
  await expect(page.getByTestId("integrations-routing-table")).toContainText(
    "SoroSwap adapter",
  );
  await expect(page.getByTestId("integrations-routing-panel")).toContainText(
    "Blend adapter",
  );
  await expect(
    page.getByTestId("integrations-routing-view-venues"),
  ).toBeVisible();
  await page.getByTestId("integrations-routing-view-venues").click();
  await expect(
    page.getByTestId("integrations-venue-model-table"),
  ).toContainText("Intent route");
  await expect(
    page.getByTestId("integrations-venue-model-table"),
  ).toContainText(/Arka-routed|Route not ready/);
  await expect(
    page.getByTestId("integrations-venue-model-table"),
  ).toContainText("Transaction hash + refreshed state");
  await expect(page.getByTestId("integrations-venue-model-table")).toHaveClass(
    /integrations-routing-table-cutover/,
  );
  await page.getByTestId("integrations-routing-view-balanced").click();
  await expect(
    page.getByTestId("integrations-intent-source-table"),
  ).toContainText("Balanced / SODAX");
  await expect(
    page.getByTestId("integrations-intent-source-table"),
  ).toContainText(/Verified|Partial|Unverified/);
  await expect(
    page.getByTestId("integrations-intent-driver-table"),
  ).toContainText("Balanced / SODAX");
  await expect(
    page.getByTestId("integrations-intent-driver-table"),
  ).toContainText(/Manual execution|Execution unavailable/i);
  await expect(
    page.getByTestId("integrations-intent-handoff-table"),
  ).toContainText("Balanced / SODAX intent flow");
  await expect(
    page.getByTestId("integrations-intent-handoff-table"),
  ).toContainText(/Official app discovery|Execution|Confirmation/i);
  await page.getByTestId("integrations-workspace-tab-execution").click();
  await expect(
    page.getByTestId("integrations-workspace-tab-execution"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("integrations-controls-table")).toContainText(
    "Execution signs through the connected wallet",
  );
  await expect(page.getByTestId("integrations-controls-panel")).toContainText(
    "Route checks",
  );
  await expect(page.getByTestId("integrations-controls-panel")).toHaveClass(
    /integrations-workspace-frame-cutover/,
  );
  await page.getByTestId("integrations-workspace-tab-actions").click();
  await expect(
    page.getByTestId("integrations-workspace-tab-actions"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("integrations-actions-panel")).toContainText(
    "Balanced is handled as a SODAX intent venue",
  );
  await expect(page.getByTestId("integrations-actions-panel")).toContainText(
    /execution is blocked|Execution blocked/i,
  );
  await expect(
    page.getByTestId("integrations-balanced-lane-note"),
  ).toContainText(/minimum out|execution is blocked/i);
  await expect(
    page.getByTestId("integrations-balanced-module-note"),
  ).toContainText(
    /Validated module has not been promoted yet|Canonical module promoted/i,
  );
  await expect(
    page.getByTestId("integrations-balanced-official-note"),
  ).toContainText(/SODAX Intents|Official Stellar topology/i);
  await expect(
    page.getByTestId("integrations-balanced-capability-note"),
  ).toContainText(/Tokens|Quote|Execution|Best execution/i);
  await expect(
    page.getByTestId("integrations-balanced-driver-note"),
  ).toContainText(/Connection .* Quote .* Execution .* Confirm .* Status/i);
  await expect(
    page.getByTestId("integrations-balanced-quote-status-note"),
  ).toContainText(/Quote endpoint:|Status surface:|Cancel window:/i);
  await expect(
    page.getByTestId("integrations-balanced-handoff-note"),
  ).toContainText(/manual intent flow|discovery only|blocked/i);
  await expect(
    page.getByTestId("integrations-balanced-handoff-route"),
  ).toContainText(
    /Official app discovery|Arka adapter execution|Execution blocked/i,
  );
  await expect(
    page.getByTestId("integrations-balanced-handoff-checks"),
  ).toContainText(
    /Official discovery:|Quote capture:|Execution:|Confirmation:/i,
  );
  await expect(
    page.getByTestId("integrations-balanced-handoff-links"),
  ).toContainText(
    /Official app|Recent Activity|Stellar page|Trade blog|No official handoff links/i,
  );
  await expect(
    page.getByTestId("integrations-balanced-source-note"),
  ).toContainText(/SODAX Intents|read quotes and status|comparable quote and status/i);
  await expect(
    page.getByTestId("integrations-balanced-source-links"),
  ).toContainText(/Official app|Stellar page|Trade blog/i);
  await expect(
    page.getByTestId("integrations-balanced-confirmation-note"),
  ).toContainText(/submitted transaction hash|External intent receipts/i);
  await expect(
    page.getByTestId("integrations-mainnet-gate-note"),
  ).toContainText(/Mainnet publication gate/i);
  await expect(page.getByTestId("integrations-actions-panel")).toContainText(
    "Run Balanced",
  );
  await expect(page.getByTestId("integrations-actions-panel")).toContainText(
    "Phoenix, Aquarius and SoroSwap stay available through the manager-owned Arka execution flow",
  );
  await expect(page.getByTestId("integrations-actions-panel")).toContainText(
    "Run Blend",
  );
  await expect(page.getByTestId("integrations-actions-panel")).toContainText(
    "Ready to review",
  );
  await page.getByTestId("integrations-workspace-tab-sodax").click();
  await expect(
    page.getByTestId("integrations-workspace-tab-sodax"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("integrations-balanced-intent-surface-panel"),
  ).toContainText("Balanced / SODAX public surface");
  await expect(
    page.getByTestId("integrations-balanced-intent-surface-panel"),
  ).not.toContainText("not wired");
  await expect(
    page.getByTestId("integrations-balanced-intent-surface-panel"),
  ).toContainText(/SODAX|Quote:/i);

  await expect(
    page.getByTestId("integrations-balanced-intent-quote-button"),
  ).toBeDisabled();
  await expect(
    page.getByTestId("integrations-balanced-intent-status-button"),
  ).toBeDisabled();
  await expect(
    page.getByTestId("integrations-balanced-intent-confirm-button"),
  ).toBeDisabled();
  await expect(
    page.getByTestId("integrations-balanced-intent-action-readiness"),
  ).toContainText("Load the SODAX token catalog first.");
  await page.getByTestId("integrations-balanced-intent-load-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-token-catalog"),
  ).toContainText("bnUSD", { timeout: 30000 });
  await expect(
    page.getByTestId("integrations-balanced-intent-token-catalog"),
  ).toContainText("USDC", { timeout: 30000 });
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-button"),
  ).toBeEnabled();
  await expect(
    page.getByTestId("integrations-balanced-intent-action-readiness"),
  ).toContainText("Ready to request the official SODAX quote.");
  await page.getByTestId("integrations-balanced-intent-quote-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-quote-result"),
  ).toContainText(/Quote (ready|unavailable)/i, { timeout: 30000 });
  await page
    .getByTestId("integrations-balanced-intent-status-input")
    .fill("0xintent");
  await expect(
    page.getByTestId("integrations-balanced-intent-confirm-button"),
  ).toBeEnabled();
  await page.getByTestId("integrations-balanced-intent-confirm-button").click();
  await expect(
    page.getByTestId("integrations-balanced-intent-confirm-result"),
  ).toContainText(
    /Confirm (confirmed|pending|failed|not_found)|Confirmation unavailable/i,
    { timeout: 30000 },
  );
});

test("create surface exposes deployment profile and post-create entrypoints", async ({
  page,
}) => {
  await page.goto("/factory/create");

  await expect(
    page.getByRole("heading", { name: /create your arka/i }),
  ).toBeVisible();
  await expect(page.getByTestId("create-arka-display-name")).toBeVisible();
  await expect(page.getByTestId("create-arka-description")).toBeVisible();
  await expect(page.getByTestId("create-manager-display-name")).toBeVisible();
  await expect(
    page.getByTestId("create-arka-denomination-panel"),
  ).toContainText("XTAR");
  await expect(page.getByTestId("create-step-next")).toContainText("Next");
  await expect(page.getByTestId("create-step-state-basics")).toContainText(
    "Current",
  );
  await page.getByTestId("create-step-next").click();
  await expect(page.getByTestId("create-fees-panel")).toBeVisible();
  await page.getByTestId("create-step-basics").click();
  await page.getByTestId("create-step-assets").click();
  await expect(
    page.getByTestId("create-assets-management-panel"),
  ).toContainText("After creation");
  await expect(page.getByTestId("create-arka-setup-intent")).toBeVisible();
  await page.getByTestId("create-step-review").click();
  await expect(page.getByTestId("create-actions-table")).toContainText(
    "Create Arka",
  );
  await expect(page.getByTestId("create-review-panel")).toContainText(
    "Create Arka",
  );
  await expect(page.getByTestId("create-arka-review-card")).toContainText(
    /denomination|allowed assets/i,
  );
  await expect(page.getByTestId("create-arka-submit-button")).toBeVisible();
  await expect(page.getByTestId("create-stepper-rail")).toContainText(
    "Creation flow",
  );
  await expect(page.getByTestId("create-step-assets")).toContainText(
    "After creation",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/factory/create?denomination=BLND&asset=XTAR&step=assets");
  await expect(page.getByTestId("create-assets-management-panel")).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
  await expectNoClippedSurfaceControls(page);
});

test("settings surface keeps grouped config and guardrails in the same control room", async ({
  page,
}) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: /^settings$/i }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveClass(/secondary-operator-shell-cutover/);
  await expect(page.getByTestId("settings-workspace-summary")).toHaveClass(
    /secondary-operator-summary-cutover/,
  );
  await expect(page.getByTestId("settings-workspace-tabs")).toHaveClass(
    /secondary-operator-tabs-cutover/,
  );
  await expect(page.getByTestId("settings-network-table")).toContainText(
    "Network passphrase",
  );
  await expect(page.getByTestId("settings-network-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await expect(page.getByTestId("settings-utility-grid")).toHaveClass(
    /settings-utility-grid/,
  );
  await expect(page.getByTestId("settings-utility-grid")).toHaveClass(
    /secondary-operator-stage-cutover/,
  );
  await expect(page.getByTestId("settings-config-panel")).toContainText(
    "Control deck",
  );
  await expect(page.getByTestId("settings-config-panel")).toHaveClass(
    /settings-config-workspace-panel/,
  );
  await expect(page.getByTestId("settings-config-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("settings-config-panel")).toContainText(
    "Guardrail profile",
  );
  await expect(page.getByTestId("settings-config-panel")).toContainText(
    /module pending|module promoted/i,
  );
  await page.getByTestId("settings-workspace-tab-guardrails").click();
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Fallback ready",
  );
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Path constraints",
  );
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Emergency pause",
  );
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Source: Runtime environment",
  );
  await expect(page.getByTestId("settings-guardrails-table")).not.toContainText(
    "DAO-governed input ceiling",
  );
  await expect(page.getByTestId("settings-guardrail-source-summary")).toContainText(
    "11 required",
  );
  await expect(page.getByTestId("settings-guardrail-source-table")).toContainText(
    "Contract storage required",
  );
  await expect(
    page.getByTestId("settings-guardrail-source-emergency-pause-swap"),
  ).toContainText("DAO storage migration required");
  await expect(page.getByTestId("settings-guardrails-panel")).toHaveClass(
    /settings-guardrails-workspace-panel/,
  );
  await expect(page.getByTestId("settings-guardrails-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("settings-guardrails-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await page.getByTestId("settings-workspace-tab-raw").click();
  await expect(page.getByTestId("settings-raw-panel")).toContainText(
    "MAX_REBALANCE_SLIPPAGE_PCT",
  );
  await expect(page.getByTestId("settings-raw-panel")).toContainText(
    "REBALANCE_DAILY_TURNOVER_CAP_BPS",
  );
  await expect(page.getByTestId("settings-raw-panel")).toHaveClass(
    /settings-raw-workspace-panel/,
  );
  await expect(page.getByTestId("settings-raw-panel")).toHaveClass(
    /secondary-operator-code-panel-cutover/,
  );
  await expectNoPageHorizontalOverflow(page);
  await expectNoClippedSurfaceControls(page);
});

test("status surface keeps baseline, operator checklist and references aligned", async ({
  page,
}) => {
  await page.goto("/status");

  await expect(page.getByRole("heading", { name: /^status$/i })).toBeVisible();
  await expect(page.locator("main")).toHaveClass(/secondary-operator-shell-cutover/);
  await expect(page.getByTestId("status-workspace-summary")).toHaveClass(
    /secondary-operator-summary-cutover/,
  );
  await expect(page.getByTestId("status-workspace-tabs")).toHaveClass(
    /secondary-operator-tabs-cutover/,
  );
  await expect(page.getByTestId("status-utility-grid")).toHaveClass(
    /status-utility-grid/,
  );
  await expect(page.getByTestId("status-utility-grid")).toHaveClass(
    /secondary-operator-stage-cutover/,
  );
  await expect(page.getByTestId("status-baseline-table")).toContainText(
    "Validated scope",
  );
  await expect(page.getByTestId("status-baseline-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await expect(page.getByTestId("status-baseline-panel")).toContainText(
    "Baseline deck",
  );
  await expect(page.getByTestId("status-baseline-panel")).toContainText(
    "Operator posture",
  );
  await expect(page.getByTestId("status-baseline-panel")).toHaveClass(
    /status-baseline-workspace-panel/,
  );
  await expect(page.getByTestId("status-baseline-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await page.getByTestId("status-workspace-tab-operator").click();
  await expect(page.getByTestId("status-operator-table")).toContainText(
    "Operator check",
  );
  await expect(page.getByTestId("status-operator-panel")).toHaveClass(
    /status-operator-workspace-panel/,
  );
  await expect(page.getByTestId("status-operator-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("status-operator-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await page.getByTestId("status-workspace-tab-limits").click();
  await expect(page.getByTestId("status-limitations-table")).toContainText(
    "Known limit",
  );
  await expect(page.getByTestId("status-limitations-panel")).toHaveClass(
    /status-limits-workspace-panel/,
  );
  await expect(page.getByTestId("status-limitations-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("status-limitations-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await page.getByTestId("status-workspace-tab-oracle").click();
  await expect(page.getByTestId("status-oracle-table")).toContainText(
    "Target network",
  );
  await expect(page.getByTestId("status-oracle-table")).toContainText(
    "Oracle provider",
  );
  await expect(page.getByTestId("status-oracle-panel")).toContainText(
    /Cutover|Oracle cutover/i,
  );
  await expect(page.getByTestId("status-oracle-panel")).toHaveClass(
    /status-oracle-workspace-panel/,
  );
  await expect(page.getByTestId("status-oracle-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("status-oracle-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await page.getByTestId("status-workspace-tab-routing").click();
  await expect(page.getByTestId("status-routing-solver-panel")).toContainText(
    /Routing solver/i,
  );
  await expect(page.getByTestId("status-routing-solver-panel")).toHaveClass(
    /status-routing-workspace-panel/,
  );
  await expect(page.getByTestId("status-routing-solver-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("status-routing-solver-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await expect(page.getByTestId("status-routing-solver-table")).toContainText(
    "Balanced best-execution status",
  );
  await expect(page.getByTestId("status-routing-solver-table")).toContainText(
    "Balanced AUTO surface gate",
  );
  await page.getByTestId("status-workspace-tab-links").click();
  await expect(page.getByTestId("status-links-table")).toContainText(
    "Contracts repository",
  );
  await expect(page.getByTestId("status-links-panel")).toHaveClass(
    /status-links-workspace-panel/,
  );
  await expect(page.getByTestId("status-links-panel")).toHaveClass(
    /secondary-operator-panel-cutover/,
  );
  await expect(page.getByTestId("status-links-table")).toHaveClass(
    /secondary-operator-table-cutover/,
  );
  await expectNoPageHorizontalOverflow(page);
  await expectNoClippedSurfaceControls(page);
});

test("status surface reflects oracle cutover ready, blocked and mismatch states", async ({
  page,
}) => {
  const mainnetReflectorDex =
    "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
  const mainnetReflectorExternal =
    "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";
  type OracleScenario = {
    id: string;
    expectedPill: "Ready" | "Blocked";
    oracle: {
      mode: "oracle_guard" | "unverified";
      network: string | null;
      oracleGuard: string | null;
      primaryOracle: string | null;
      secondaryOracle: string | null;
      primaryProvider: string | null;
      secondaryProvider: string | null;
      provider: string | null;
      maxOracleAgeSeconds: number | null;
      maxDivergenceBps: number | null;
      minProviderCount: number | null;
    };
    deployment: {
      targetNetwork: "mainnet";
      fileFound: boolean;
      networkMismatch: boolean;
      readError: string | null;
    };
    gateCode:
      | "ready"
      | "manifest_missing"
      | "network_mismatch"
      | "contracts_incomplete"
      | "provider_unverified"
      | "thresholds_unconfigured";
    expectedDetail: RegExp;
  };

  const scenarios: OracleScenario[] = [
    {
      id: "ready",
      expectedPill: "Ready",
      oracle: {
        mode: "oracle_guard",
        network: "mainnet",
        oracleGuard: "CORACLEGUARD",
        primaryOracle: mainnetReflectorDex,
        secondaryOracle: mainnetReflectorExternal,
        primaryProvider: "Reflector DEX Oracle",
        secondaryProvider: "Reflector External CEX/DEX Oracle",
        provider: "Reflector Network",
        maxOracleAgeSeconds: 300,
        maxDivergenceBps: 100,
        minProviderCount: 2,
      },
      deployment: {
        targetNetwork: "mainnet",
        fileFound: true,
        networkMismatch: false,
        readError: null,
      },
      gateCode: "ready",
      expectedDetail:
        /verified for the active runtime target|oracle guard lane/i,
    },
    {
      id: "blocked-missing",
      expectedPill: "Blocked",
      oracle: {
        mode: "unverified",
        network: null,
        oracleGuard: null,
        primaryOracle: null,
        secondaryOracle: null,
        primaryProvider: null,
        secondaryProvider: null,
        provider: null,
        maxOracleAgeSeconds: null,
        maxDivergenceBps: null,
        minProviderCount: null,
      },
      deployment: {
        targetNetwork: "mainnet",
        fileFound: false,
        networkMismatch: false,
        readError: "ENOENT",
      },
      gateCode: "manifest_missing",
      expectedDetail: /manifest is missing/i,
    },
    {
      id: "blocked-mismatch",
      expectedPill: "Blocked",
      oracle: {
        mode: "unverified",
        network: "testnet",
        oracleGuard: "CORACLEGUARD",
        primaryOracle: mainnetReflectorDex,
        secondaryOracle: mainnetReflectorExternal,
        primaryProvider: "Reflector DEX Oracle",
        secondaryProvider: "Reflector External CEX/DEX Oracle",
        provider: "Reflector Network",
        maxOracleAgeSeconds: 300,
        maxDivergenceBps: 100,
        minProviderCount: 2,
      },
      deployment: {
        targetNetwork: "mainnet",
        fileFound: true,
        networkMismatch: true,
        readError: null,
      },
      gateCode: "network_mismatch",
      expectedDetail: /does not match|mismatch/i,
    },
  ];

  let currentScenario = scenarios[0]!;
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
          evaluatedAt: "2026-04-16T12:00:00.000Z",
        },
        protocols: {
          balanced: {},
        },
        routing: {
          mode: "backend_solver_with_local_fallback",
          planEndpoint: "/api/routing/rebalance/plan",
          fallbackMode: "local_workflow_solver",
          backendAvailable: true,
          generatedAt: "2026-04-16T12:00:00.000Z",
          balancedPlannerAdmission: "blocked",
          balancedManualExecutionEligible: false,
          balancedComparableQuote: false,
          balancedSupportStatus: "blocked",
          balancedLaneMode: "legacy_comet",
          balancedAutoSurfaceReady: false,
          balancedAutoSurfaceReason:
            "Balanced AUTO surface is blocked in this mocked scenario.",
          note: "routing fallback",
        },
        oracle: {
          source: "deployments",
          metrics: {
            ranking: "catalog_rank",
            nav: "catalog_nav",
            profit: "catalog_profit_or_activity",
            volume: "catalog_volume_or_activity",
            activityFallbackWindowEvents: 60,
          },
          oracle: {
            mode: currentScenario.oracle.mode,
            validatedAt: "2026-04-16",
            network: currentScenario.oracle.network,
            rpcUrl: "https://rpc.invalid",
            oracleGuard: currentScenario.oracle.oracleGuard,
            primaryOracle: currentScenario.oracle.primaryOracle,
            secondaryOracle: currentScenario.oracle.secondaryOracle,
            primaryProvider: currentScenario.oracle.primaryProvider,
            secondaryProvider: currentScenario.oracle.secondaryProvider,
            provider: currentScenario.oracle.provider,
            validationAsset: "native:XLM",
            maxOracleAgeSeconds: currentScenario.oracle.maxOracleAgeSeconds,
            maxDivergenceBps: currentScenario.oracle.maxDivergenceBps,
            minProviderCount: currentScenario.oracle.minProviderCount,
            selectedSourceUnderDivergence: 1,
            source: "deployments",
          },
          deployment: {
            targetNetwork: currentScenario.deployment.targetNetwork,
            deploymentsPath: "/tmp/deployments.mainnet.json",
            pathSource: "env_path",
            fileFound: currentScenario.deployment.fileFound,
            networkMismatch: currentScenario.deployment.networkMismatch,
            readError: currentScenario.deployment.readError,
          },
        },
        releaseGate: {
          oracleCutover: {
            status:
              currentScenario.expectedPill === "Ready" ? "ready" : "blocked",
            code: currentScenario.gateCode,
            targetNetwork: "mainnet",
            ready: currentScenario.expectedPill === "Ready",
            detail:
              currentScenario.expectedPill === "Ready"
                ? "Mainnet target is active and oracle guard with primary/secondary feeds is verified."
                : "Mainnet cutover remains blocked.",
            checks: {
              manifestFound: currentScenario.deployment.fileFound,
              networkMismatch: currentScenario.deployment.networkMismatch,
              oracleMode: currentScenario.oracle.mode,
              hasOracleGuard: Boolean(currentScenario.oracle.oracleGuard),
              hasPrimaryOracle: Boolean(currentScenario.oracle.primaryOracle),
              hasSecondaryOracle: Boolean(
                currentScenario.oracle.secondaryOracle,
              ),
              providersVerified: currentScenario.expectedPill === "Ready",
              thresholdsConfigured: currentScenario.expectedPill === "Ready",
              noTestnetProviderFallback: true,
            },
          },
          balancedAutoSurface: {
            status: "blocked",
            code: "support_blocked",
            targetNetwork: "mainnet",
            ready: false,
            detail:
              "Balanced AUTO surface remains blocked in the mocked status scenario.",
            checks: {
              plannerAdmission: "blocked",
              planningEnabled: false,
              supportStatus: "blocked",
              manualExecutionEligible: false,
              hasAdapterContract: false,
              hasPoolId: false,
              laneReady: false,
              quoteProvider: "unknown",
              hasPublicQuoteEndpoint: false,
              hasPublicStatusEndpoint: false,
              hasPublicReceiptEndpoint: false,
              surfaceReady: false,
            },
          },
        },
      }),
    });
  });

  for (const scenario of scenarios) {
    currentScenario = scenario;
    await page.goto(`/status?gate-case=${scenario.id}`);
    await page.getByTestId("status-workspace-tab-oracle").click();
    await expect(page.getByTestId("status-oracle-panel")).toContainText(
      new RegExp(`Cutover ${scenario.expectedPill}`, "i"),
    );
    await expect(page.getByTestId("status-oracle-table")).toContainText(
      scenario.expectedDetail,
    );
  }
});
