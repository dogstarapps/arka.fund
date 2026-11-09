import { expect, test } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test("home exposes product and operations surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("product-rail")).toBeVisible();
  await expect(page.locator('a[href="/vaults"]').first()).toBeVisible();
  await expect(page.locator('a[href="/discover"]').first()).toBeVisible();
  await expect(page.getByTestId("advanced-console-toggle")).toHaveCount(0);
  await expect(page.locator('a[href="/integrations"]').first()).toBeVisible();
  await expect(page.locator('a[href="/integrations/operator"]').first()).toHaveCount(0);

  await enableOperatorMode(page);
  await page.goto("/integrations/operator");
  await expect(page.locator('a[href="/integrations/operator"]').first()).toBeVisible();
  await expect(page.locator('a[href="/contracts"]').first()).toBeVisible();
  await expect(page.locator('a[href="/governance"]').first()).toBeVisible();
  await expect(page.getByTestId("chrome-search-input")).toBeVisible();
});

test("global search routes product keywords and asset symbols to real surfaces", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await page.getByTestId("chrome-search-input").fill("assets");
  await page.getByTestId("chrome-search-input").press("Enter");
  await expect(page).toHaveURL(/\/assets$/);

  await page.getByTestId("chrome-search-input").fill("BLND");
  await page.getByTestId("chrome-search-input").press("Enter");
  await expect(page).toHaveURL(
    /\/assets\/CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY$/,
  );

  await page.goto("/dashboard");
  await page.getByTestId("chrome-search-input").fill("phoenix");
  await page.getByTestId("chrome-search-input").press("Enter");
  await expect(page).toHaveURL(/\/discover\?q=phoenix(?:&feature=fresh)?$/);
});

test("governance page exposes executable lifecycle controls", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/governance/console");

  await expect(
    page.getByRole("heading", { name: /^governance console$/i }),
  ).toBeVisible();
  await expect(
    page.getByTestId("governance-proposal-kind-select"),
  ).toBeVisible();
  await expect(page.getByTestId("governance-proposal-id-input")).toBeVisible();
  await expect(page.getByTestId("governance-propose-button")).toBeVisible();
  await expect(page.getByTestId("governance-vote-button")).toBeVisible();
  await expect(page.getByTestId("governance-close-button")).toBeVisible();
  await expect(page.getByTestId("governance-execute-button")).toBeVisible();
});

test("create page shows post-create protocol activation guidance", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/factory/create?denomination=BLND&asset=XTAR&step=assets&intent=blend");

  await expect(page.getByTestId("create-page-heading")).toBeVisible();
  await expect(page.getByTestId("create-assets-management-panel")).toBeVisible();
  await expect(page.getByTestId("create-arka-setup-intent")).toHaveValue("BLEND");
  await expect(page.getByTestId("create-assets-management-panel")).toContainText(
    /Open after creation: Blend/i,
  );
  await expect(page.getByTestId("create-progress-summary")).toContainText(/5\/5 complete/i);
  await expect(page.getByTestId("create-stepper-progress")).toContainText(
    /Ready to create/i,
  );
  await page.getByTestId("create-step-basics").click();
  await expect(page.getByTestId("create-profile-panel")).toBeVisible();
  await expect(page.getByTestId("create-arka-prefill-notice")).toContainText(
    /BLND/i,
  );
  await expect(page.getByTestId("create-arka-prefill-notice")).toContainText(
    /XTAR/i,
  );
  await expect(page.getByTestId("create-arka-denom-summary")).toContainText(
    /BLND/i,
  );
  await expect(page.getByTestId("create-arka-whitelist-summary")).toContainText(
    /XTAR/i,
  );
  await page.getByTestId("create-arka-clear-asset-search").click();
  await expect(page.getByTestId("create-arka-asset-search")).toHaveValue("");
  await expect(page.getByTestId("create-stepper-rail")).toContainText(
    /After creation/i,
  );
  await expect(page.getByTestId("create-stepper-rail")).not.toContainText(
    /not configured yet/i,
  );
  await page.getByTestId("create-step-assets").click();
  await expect(page.getByTestId("create-arka-setup-intent")).toBeVisible();
  await expect(page.getByTestId("create-arka-setup-intent")).toHaveValue("BLEND");
  await expect(page.getByTestId("create-arka-setup-intent")).toContainText(/Blend/i);
  await page.getByTestId("create-step-fees").click();
  await page.getByTestId("create-arka-mgmt-input").fill("101");
  await expect(page.getByTestId("create-fees-panel")).toContainText(
    /Management fee cannot exceed 100%/i,
  );
  await expect(page.getByTestId("create-progress-summary")).toContainText(/3\/5 complete · 60%/i);
  await expect(page.getByTestId("create-stepper-progress")).toContainText(
    /Management fee cannot exceed 100%/i,
  );
  await page.getByTestId("create-step-review").click();
  await expect(page.getByTestId("create-arka-submit-button")).toBeDisabled();
  await expect(page.getByTestId("create-submit-blocker")).toContainText(
    /Management fee cannot exceed 100%/i,
  );
});

test("settings exposes the active slippage profile and guardrails", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: /^settings$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("settings-config-panel")).toContainText(
    "Rebalance profile",
  );
  await page.getByTestId("settings-workspace-tab-raw").click();
  await expect(page.getByTestId("settings-raw-panel")).toContainText(
    "DEFAULT_REBALANCE_SLIPPAGE_PCT",
  );
  await expect(page.getByTestId("settings-raw-panel")).toContainText(
    "MAX_REBALANCE_SLIPPAGE_PCT",
  );
  await expect(page.getByTestId("settings-raw-panel")).toContainText(
    "REBALANCE_MAX_PATH_LENGTH",
  );
  await page.getByTestId("settings-workspace-tab-guardrails").click();
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Max notional per swap",
  );
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Emergency pause",
  );
  await expect(page.getByTestId("settings-guardrails-table")).toContainText(
    "Source: Runtime environment",
  );
  await expect(page.getByTestId("settings-guardrail-source-table")).toContainText(
    "Contract storage required",
  );
});

test("status documents micro-liquidity profile as opt-in only", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/status");

  await expect(page.getByRole("heading", { name: /^status$/i })).toBeVisible();
  await page.getByTestId("status-workspace-tab-operator").click();
  await expect(page.getByTestId("status-operator-panel")).toContainText(
    "micro_liquidity",
  );
  await expect(page.getByTestId("status-operator-panel")).toContainText(
    "standard",
  );
});

test("arka detail exposes credit positions as a vault-owned workflow", async ({
  page,
}) => {
  await page.goto("/arkas/TEST_BLEND_VAULT");

  await expect(page.getByTestId("arka-workspace-tab-credit")).toBeVisible();
  await page.getByTestId("arka-workspace-tab-credit").click();
  await expect(
    page.getByTestId("arka-credit-panel").getByRole("heading", { name: "Blend" }),
  ).toBeVisible();
  await expect(page.getByTestId("arka-credit-panel")).toContainText(
    /using this Arka's funds/i,
  );
  await expect(page.getByTestId("credit-collateral-live")).toBeVisible();
  await expect(page.getByTestId("credit-debt-live")).toBeVisible();
  await expect(page.getByTestId("credit-health-factor")).toBeVisible();
  await expect(page.getByTestId("credit-action-picker")).toHaveCount(0);
  await expect(page.getByTestId("credit-run-button")).toHaveCount(0);
});
