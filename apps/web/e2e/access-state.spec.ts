import { expect, test } from "@playwright/test";
import { createOperatorSessionPayload, enableOperatorMode } from "./helpers/operator-mode";

test("direct operator route stays gated until an operator wallet is verified", async ({
  page,
}) => {
  await page.goto("/contracts");

  await expect(page.getByTestId("operator-route-gate")).toBeVisible();
  await expect(page.getByTestId("advanced-console-guard")).toBeVisible();
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveCount(0);

  await page.evaluate(() => window.localStorage.setItem("e2e-wallet-profile", "manager"));
  await page.getByTestId("operator-route-enable").click();

  await expect(
    page.getByRole("heading", { name: /^contract control center$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  await expect(page.getByTestId("product-canvas")).toContainText(
    "Full on-chain control lane",
  );
});

test("persisted operator session fails closed when the wallet mirror is absent", async ({
  page,
}) => {
  const session = await createOperatorSessionPayload(page);

  await page.addInitScript((operatorSession) => {
    window.localStorage.setItem("arkafund.operatorSession", JSON.stringify(operatorSession));
    window.localStorage.removeItem("wallet:pubkey");
    window.localStorage.removeItem("arkafund.operatorMode");
  }, session);

  await page.goto("/contracts");

  await expect(page.getByTestId("operator-route-gate")).toBeVisible();
  await expect(page.getByTestId("operator-route-gate")).toContainText(
    "Reconnect the authorized operator wallet",
  );
  await expect(page.getByTestId("advanced-console-guard")).toBeVisible();
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveCount(0);
});

test("verified operator access persists across direct utility-route navigation", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/governance/console");

  await expect(
    page.getByRole("heading", { name: /^governance console$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("advanced-console-status")).toContainText(
    "Operator wallet verified",
  );

  await page.goto("/migrations");
  await expect(
    page.getByRole("heading", { name: /^migration workspace$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("chrome-utility-migrations")).toHaveClass(
    /chrome-utility-link-active/,
  );
});

test("public routes keep the operator rail hidden until explicitly opened", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/dashboard");

  await expect(page.getByTestId("product-rail")).toHaveClass(
    /chrome-rail-screen-cutover/,
  );
  const publicRailWidth = await page
    .getByTestId("product-rail")
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(publicRailWidth).toBeGreaterThanOrEqual(284);
  expect(publicRailWidth).toBeLessThanOrEqual(340);
  await expect(page.getByTestId("advanced-console-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveCount(0);

  await page.getByTestId("advanced-console-toggle").click();
  await expect(page.getByTestId("advanced-console-status")).toContainText(
    "Operator wallet verified",
  );
  await expect(page.getByTestId("chrome-utility-contracts")).toBeVisible();
  await expect(page.getByTestId("chrome-utility-migrations")).toBeVisible();
  await expect(page.getByTestId("chrome-nav-governance")).toBeVisible();
});

test("integrations public surface does not leak operator diagnostics while operator route stays gated", async ({
  page,
}) => {
  await page.goto("/integrations");

  await expect(
    page.getByRole("heading", { name: /^integrations$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  await expect(page.getByTestId("integrations-public-surface")).toBeVisible();
  await expect(page.getByTestId("integrations-product-catalog")).toContainText(
    "Supported protocols",
  );
  await expect(page.getByTestId("integrations-workspace-tabs")).toHaveCount(0);
  await expect(page.getByTestId("integrations-routing-table")).toHaveCount(0);
  await expect(page.getByTestId("integrations-actions-panel")).toHaveCount(0);
  await expect(
    page.getByTestId("integrations-product-card-balanced-operator-link"),
  ).toHaveCount(0);
  await expect(page.getByTestId("integrations-product-catalog")).toContainText(
    "View Arkas",
  );

  await page.goto("/integrations/operator");
  await expect(page.getByTestId("operator-route-gate")).toBeVisible();
  await expect(page.getByTestId("operator-route-gate")).toContainText(
    "Integration Ops",
  );
});

test("verified operator can inspect integrations diagnostics on the operator route", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/integrations/operator");

  await expect(
    page.getByRole("heading", { name: /^integrations operator$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  await expect(page.getByTestId("integrations-operator-surface")).toBeVisible();
  await expect(page.getByTestId("integrations-workspace-tabs")).toBeVisible();
  await expect(page.getByTestId("integrations-routing-table")).toContainText(
    "Configured route",
  );
  await page.goto("/integrations/operator?workspace=sodax");
  await expect(page.getByTestId("integrations-workspace-tab-sodax")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("integrations-sodax-panel")).toBeVisible();
  await expect(
    page.getByTestId("integrations-balanced-intent-surface-panel"),
  ).toContainText(/quote|status|confirmation/i);
});

test("locking the advanced console clears the server operator session", async ({
  page,
}) => {
  await enableOperatorMode(page);
  await page.goto("/contracts");

  await expect(
    page.getByRole("heading", { name: /^contract control center$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("advanced-console-status")).toContainText(
    "Operator wallet verified",
  );

  await page.getByTestId("advanced-console-disable-focus").click();
  await expect(page.getByTestId("operator-route-gate")).toBeVisible();

  await expect
    .poll(
      async () => {
        return page.evaluate(async () => {
          const response = await fetch("/api/contracts/mutation-matrix", {
            cache: "no-store",
            credentials: "same-origin",
          });
          return response.status;
        });
      },
      { timeout: 10_000 },
    )
    .toBe(401);
});
