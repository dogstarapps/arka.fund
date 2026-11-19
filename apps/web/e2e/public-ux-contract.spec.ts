import { expect, test, type Page } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/dashboard",
  "/discover",
  "/arkas",
  "/assets",
  "/managers",
  "/integrations",
  "/governance",
  "/coverage",
  "/factory/create",
] as const;

const INTERNAL_COPY = [
  "base units",
  "needs attention",
  "action required",
  "telemetry",
  "canonical",
  "control deck",
  "command deck",
  "current query",
  "proof points",
  "live mandate",
  "execution ready",
  "credit plan",
  "fallback",
  "planner",
  "canary",
  "validation",
  "handoff",
  "n/a",
  "wallet posture",
  "manager controls unlocked",
  "manager controls locked",
  "share token pending",
  "post-create execution",
  "curation posture",
] as const;

async function expectPublicSurfaceContract(page: Page) {
  const body = page.locator("body");
  await expect(body).toBeVisible();
  const visibleCopy = (await body.innerText()).toLowerCase();
  for (const forbidden of INTERNAL_COPY) {
    expect(visibleCopy, `visible public copy contains '${forbidden}'`).not.toContain(forbidden);
  }
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  const clippedControls = await page
    .locator("button:visible, input:visible, select:visible, textarea:visible")
    .evaluateAll((controls) =>
      controls
        .filter((control) => !control.closest("nextjs-portal"))
        .filter((control) => control.getAttribute("aria-label") !== "Open Next.js Dev Tools")
        .filter((control) => control.scrollWidth > control.clientWidth + 1 || control.scrollHeight > control.clientHeight + 1)
        .map((control) => ({
          tag: control.tagName,
          text: (control.textContent ?? "").trim(),
          testId: control.getAttribute("data-testid"),
        })),
    );
  expect(clippedControls, "visible controls contain clipped content").toEqual([]);
}

for (const route of PUBLIC_ROUTES) {
  test(`${route} keeps the public UX contract`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expectPublicSurfaceContract(page);
  });
}

test("Arka actions remain readable across every workspace", async ({ page }) => {
  await page.goto("/arkas", { waitUntil: "domcontentloaded" });
  const href = await page.locator('a[href^="/arkas/"]').first().getAttribute("href");
  expect(href).toBeTruthy();

  for (const workspace of ["state", "flow", "rebalance", "credit"] as const) {
    await page.goto(`${href}?workspace=${workspace}`, { waitUntil: "domcontentloaded" });
    await expectPublicSurfaceContract(page);
    await expect(page.getByTestId(`arka-workspace-tab-${workspace}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    if (workspace === "rebalance") {
      const routeSummary = page.getByTestId("rebalance-route-summary");
      await expect(routeSummary).toBeVisible();
      expect(await routeSummary.innerText()).not.toMatch(/\b\d+\.\d{5,}\b/);
    }
  }

  await expect(page.getByTestId("arka-workspace-tab-state")).toHaveText("Overview");
  await expect(page.getByTestId("arka-workspace-tab-flow")).toHaveText("Deposit & redeem");
  await expect(page.getByTestId("arka-workspace-tab-rebalance")).toHaveText("Swap");
  await expect(page.getByTestId("arka-workspace-tab-credit")).toHaveText("Blend");
  await expect(page.getByTestId("arka-stage-panel")).not.toContainText(/Contract C[A-Z0-9]+/);
});

test("Arka operational layouts do not compress forms or transaction feedback", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/arkas", { waitUntil: "domcontentloaded" });
  const href = await page.locator('a[href^="/arkas/"]').first().getAttribute("href");
  expect(href).toBeTruthy();

  for (const workspace of ["flow", "rebalance", "credit"] as const) {
    await page.goto(`${href}?workspace=${workspace}`, { waitUntil: "domcontentloaded" });
    const panel = page.getByTestId(`arka-${workspace === "flow" ? "flow" : workspace === "rebalance" ? "rebalance" : "credit"}-panel`);
    await expect(panel).toBeVisible();

    const narrowFields = await panel.locator(".ops-field:visible").evaluateAll((fields) =>
      fields
        .filter((field) => field.getBoundingClientRect().width < 260)
        .map((field) => ({
          width: Math.round(field.getBoundingClientRect().width),
          label: field.querySelector("label")?.textContent?.trim() ?? "",
        })),
    );
    expect(narrowFields, `${workspace} contains compressed operational fields`).toEqual([]);

    const feedback = panel.locator('[data-testid$="-status"], [data-testid$="-error"]');
    for (const item of await feedback.all()) {
      if (!(await item.isVisible())) continue;
      const box = await item.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(520);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${href}?workspace=rebalance`, { waitUntil: "domcontentloaded" });
  const formColumns = await page.locator('[data-testid="arka-rebalance-panel"] .ops-form-grid').evaluate((form) =>
    window.getComputedStyle(form).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(formColumns).toBe(1);
});

test("public economic labels remain human readable", async ({ page }) => {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("assets-list")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bunits\b/i);

  await page.goto("/arkas", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("vault-leaderboard-card").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("TVL in denomination");
  await expect(page.locator("body")).toContainText("Estimated profit");
  await expect(page.locator("body")).toContainText("Trading volume");

  for (const route of ["/dashboard", "/discover", "/arkas", "/assets", "/managers"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const copy = await page.locator("body").innerText();
    expect(copy).not.toMatch(/\bIndexed\b/);
    expect(copy).not.toMatch(/\b(?:mgmt|perf)\b/i);
    expect(copy).not.toMatch(/\b\d+\.\d{5,}\b/);
  }

  await page.goto("/factory/create", { waitUntil: "domcontentloaded" });
  await page.getByTestId("create-step-fees").click();
  await expect(page.getByTestId("create-fees-panel")).toContainText("Management fee (%)");
  await expect(page.getByTestId("create-fees-panel")).toContainText("Performance fee (%)");
  await expect(page.getByTestId("create-fees-panel")).toContainText("Deposit fee (%)");
  await expect(page.getByTestId("create-fees-panel")).toContainText("Redemption fee (%)");
  await expect(page.getByTestId("create-fees-panel")).not.toContainText(/\b(?:mgmt|perf)\b/i);
});

test("the public chrome exposes one wallet action", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-testid="connect-wallet-chrome"], [data-testid="disconnect-wallet-chrome"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-testid="chrome-wallet-card"]')).toHaveCount(0);
  await expect(page.getByText("Wallet access", { exact: true })).toHaveCount(0);
});

test("Curated Arkas never falls back to non-curated results", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await page.getByTestId("discover-market-curated").click();
  await expect(page.getByTestId("discover-market-curated")).toHaveAttribute("aria-pressed", "true");

  const cards = page.getByTestId("discover-figma-preview-card");
  if ((await cards.count()) === 0) {
    await expect(page.getByTestId("discover-empty")).toContainText(
      "No curated Arkas match the current search.",
    );
    return;
  }

  for (const card of await cards.all()) {
    await expect(card).toContainText("Curated");
    await expect(card).not.toContainText("Listed");
  }
});

test("asset and manager view selectors look and behave like controls", async ({ page }) => {
  for (const [route, tabsId, activeId] of [
    ["/assets", "assets-spotlight-tabs", "assets-spotlight-tab-balance-sheet"],
    ["/managers", "managers-spotlight-tabs", "managers-spotlight-tab-curated"],
  ] as const) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const tabs = page.getByTestId(tabsId);
    await expect(tabs).toBeVisible();
    const active = page.getByTestId(activeId);
    const border = await active.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { style: style.borderStyle, width: style.borderWidth };
    });
    expect(border.style).not.toBe("none");
    expect(border.width).not.toBe("0px");
    await active.click();
    await expect(active).toHaveAttribute("aria-pressed", "true");
  }
});

test("asset and manager pages expose one primary result collection", async ({ page }) => {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("assets-list")).toHaveCount(1);
  await expect(page.locator('[data-testid="assets-telemetry-panel"]')).toHaveCount(0);

  await page.goto("/managers", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("managers-list")).toHaveCount(1);
  await expect(page.getByTestId("managers-search-input")).toHaveAttribute(
    "placeholder",
    "Search managers",
  );
  await expect(page.locator('[data-testid="managers-sort-status"]')).toHaveCount(0);
});

test("manager detail paginates managed Arkas without hiding the collection", async ({ page }) => {
  await page.goto("/managers", { waitUntil: "domcontentloaded" });
  const managerHref = await page
    .locator('a[href^="/managers/"]')
    .first()
    .getAttribute("href");
  expect(managerHref).toBeTruthy();

  await page.goto(managerHref!, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("manager-detail-arkas-table")).toBeVisible();
  const cards = page.getByTestId("manager-detail-arka-card");
  await expect(cards.first()).toBeVisible();
  const firstPageCount = await cards.count();
  expect(firstPageCount).toBeGreaterThan(0);
  expect(firstPageCount).toBeLessThanOrEqual(6);

  const pagination = page.getByTestId("manager-detail-arkas-pagination");
  if (await pagination.count()) {
    await expect(pagination).toContainText("Page 1");
    await pagination.getByText("Next").click();
    await expect(pagination).toContainText("Page 2");
    expect(await cards.count()).toBeLessThanOrEqual(6);
  }
});

test("Create Arka exposes one five-step form", async ({ page }) => {
  await page.goto("/factory/create", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("create-stepper-rail")).toBeVisible();
  await expect(page.locator('.create-stepper-list button[data-testid^="create-step-"]')).toHaveCount(5);
  await expect(page.getByTestId("create-step-deposits")).toHaveCount(0);
  await expect(page.getByTestId("create-step-redemptions")).toHaveCount(0);
});

test("mobile public routes do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/discover", "/arkas", "/assets", "/managers", "/factory/create"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expectPublicSurfaceContract(page);
  }
});
