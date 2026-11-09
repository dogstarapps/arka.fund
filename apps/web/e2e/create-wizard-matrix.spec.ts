import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolveCatalogFixture } from "../src/lib/catalog/testFixtures";

type CreateStepExpectation = {
  id: "start" | "basics" | "fees" | "assets" | "review";
  panelTestId: string;
  stageTitle: RegExp;
  stateLabel: RegExp;
};

const CREATE_STEP_EXPECTATIONS: CreateStepExpectation[] = [
  {
    id: "start",
    panelTestId: "create-start-panel",
    stageTitle: /connect wallet/i,
    stateLabel: /current/i,
  },
  {
    id: "basics",
    panelTestId: "create-profile-panel",
    stageTitle: /basics/i,
    stateLabel: /current/i,
  },
  {
    id: "fees",
    panelTestId: "create-fees-panel",
    stageTitle: /fees/i,
    stateLabel: /current/i,
  },
  {
    id: "assets",
    panelTestId: "create-assets-management-panel",
    stageTitle: /after creation/i,
    stateLabel: /current/i,
  },
  {
    id: "review",
    panelTestId: "create-review-panel",
    stageTitle: /review and create/i,
    stateLabel: /current/i,
  },
];

const RESPONSIVE_VIEWPORTS = [
  { label: "desktop", width: 1440, height: 1050 },
  { label: "tablet", width: 834, height: 1120 },
  { label: "mobile", width: 390, height: 900 },
] as const;

async function mockCatalogApi(page: Page): Promise<void> {
  await page.route("**/api/catalog/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    await route.fulfill({
      status: pathname.startsWith("/v1/") ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function resolveE2EWalletAddress(
  page: Page,
  profile: "holder" | "manager",
): Promise<string> {
  const response = await page.request.get(`/api/e2e-wallet?profile=${profile}`);
  expect(response.ok()).toBeTruthy();
  const wallet = (await response.json()) as { address?: string };
  expect(wallet.address).toMatch(/^G[A-Z0-9]{55}$/);
  return wallet.address ?? "";
}

async function installHolderWallet(page: Page): Promise<string> {
  const address = await resolveE2EWalletAddress(page, "holder");

  await page.addInitScript((address) => {
    window.localStorage.setItem("e2e-wallet-profile", "holder");
    window.localStorage.setItem("wallet:pubkey", address);
  }, address);

  return address;
}

async function gotoCreateWizard(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
    // WebKit can leave non-critical font/image requests pending; the visible
    // wizard assertions below are the authoritative readiness check.
  });
}

async function expectNoUnresolvedSurfaceCopy(locator: Locator): Promise<void> {
  const text = await locator.innerText();
  expect(text).not.toMatch(/\b(undefined|null|NaN|TODO|lorem|fake|stub|skeleton)\b/i);
}

async function expectNoPageHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollWidth - root.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoViewportClippedControls(page: Page): Promise<void> {
  const offenders = await page
    .locator(
      [
        "button",
        "a[href]",
        "input",
        "select",
        "textarea",
        "[role='button']",
      ].join(","),
    )
    .evaluateAll((nodes) => {
      const width = window.innerWidth;
      return nodes
        .filter((node) => {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0 ||
            element.getAttribute("aria-hidden") === "true"
          ) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            return false;
          }
          if (rect.bottom < -2 || rect.top > window.innerHeight + 2) {
            return false;
          }
          return (
            rect.left < -2 ||
            rect.right > width + 2 ||
            rect.top < -2
          );
        })
        .map((node) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          return {
            testId: element.getAttribute("data-testid"),
            label:
              element.getAttribute("aria-label") ??
              element.getAttribute("title") ??
              element.textContent?.trim().slice(0, 80) ??
              element.tagName,
            rect: {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
            },
          };
        })
        .slice(0, 8);
    });

  expect(offenders).toEqual([]);
}

async function expectCreateStepSurface(
  page: Page,
  step: CreateStepExpectation,
): Promise<void> {
  await expect(page.getByTestId("create-page-heading")).toBeVisible();
  await expect(page.getByTestId(step.panelTestId)).toBeVisible();
  await expect(page.getByTestId(`create-step-${step.id}`)).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByTestId(`create-step-state-${step.id}`)).toContainText(
    step.stateLabel,
  );
  await expect(page.getByTestId("create-stepper-progress")).toContainText(
    /ready to create/i,
  );
  await expect(page.getByTestId("create-progress-summary")).toContainText(/\d+\/5 complete/i);
  await expect(page.locator(".create-active-stage-heading")).toContainText(step.stageTitle);
  if (step.id === "review") {
    await expect(page.getByTestId("create-arka-review-card")).toContainText(
      /create transaction/i,
    );
    await expect(page.getByTestId("create-arka-submit-button")).toBeVisible();
  }
  if (step.id === "start") {
    await expect(page.getByTestId("create-wallet-connect-button")).toBeVisible();
    await expect(page.getByTestId("create-wallet-choice-freighter")).toContainText(
      /freighter/i,
    );
    await expect(page.getByTestId("create-wallet-choice-albedo")).toContainText(
      /albedo/i,
    );
    await expect(page.getByTestId("create-wallet-choice-xbull")).toContainText(/xbull/i);
  }
  await expectNoUnresolvedSurfaceCopy(page.getByTestId(step.panelTestId));
}

async function waitForCreateStageAssetImage(page: Page): Promise<void> {
  const image = page.locator(".create-figma-stage-asset-image").first();
  await expect(image).toBeVisible();
  await image.evaluate(async (node: HTMLImageElement) => {
    if (node.complete && node.naturalWidth > 0 && node.naturalHeight > 0) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeout);
        node.removeEventListener("load", onLoad);
        node.removeEventListener("error", onError);
      };
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Create stage image failed to load."));
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Create stage image did not finish loading."));
      }, 10_000);
      node.addEventListener("load", onLoad, { once: true });
      node.addEventListener("error", onError, { once: true });
    });
    if (typeof node.decode === "function") {
      await node.decode().catch(() => undefined);
    }
  });
}

async function expectCreateFigmaGeometry(page: Page): Promise<void> {
  await waitForCreateStageAssetImage(page);
  const geometry = await page.evaluate(() => {
    const stageShell = document.querySelector<HTMLElement>(
      '[data-testid="create-figma-stage-shell"]',
    );
    const createShell = document.querySelector<HTMLElement>(".chrome-shell-create");
    const productCanvas = document.querySelector<HTMLElement>('[data-testid="product-canvas"]');
    const searchForm = document.querySelector<HTMLElement>(".chrome-search-form-create");
    const stageArt = document.querySelector<HTMLElement>(".create-figma-stage-art");
    const stageAssetFrame = document.querySelector<HTMLElement>(
      '[data-testid="create-stage-figma-asset-frame"]',
    );
    const stageAssetImage = document.querySelector<HTMLImageElement>(
      ".create-figma-stage-asset-image",
    );
    const activeHeader = document.querySelector<HTMLElement>(
      ".create-assistant-active-header",
    );
    const stepperShell = document.querySelector<HTMLElement>(".create-stepper-shell");
    const progress = document.querySelector<HTMLElement>(
      '[data-testid="create-stepper-progress"]',
    );
    const actions = document.querySelector<HTMLElement>(".create-stepper-actions");
    const tabline = document.querySelector<HTMLElement>(".create-assistant-tabline");
    const tabLabel = document.querySelector<HTMLElement>(".create-assistant-tab");
    const stepperTitle = document.querySelector<HTMLElement>(".create-stepper-title");
    const stageBanner = document.querySelector<HTMLElement>(".create-stage-banner");
    const stageBannerIcon = document.querySelector<HTMLElement>(".create-stage-banner-icon");
    const stepperItems = Array.from(
      document.querySelectorAll<HTMLElement>(".create-stepper-item"),
    );
    const stepperStates = Array.from(
      document.querySelectorAll<HTMLElement>(".create-stepper-state"),
    );
    const stepperDetail = document.querySelector<HTMLElement>(
      ".create-stepper-content > .surface-note",
    );
    const currentBullet = document.querySelector<HTMLElement>(
      ".create-stepper-item-current .create-stepper-bullet",
    );
    const policyCards = Array.from(
      document.querySelectorAll<HTMLElement>(".create-assistant-policy-card"),
    );
    const policyArts = Array.from(
      document.querySelectorAll<HTMLElement>(".create-assistant-policy-art"),
    );
    const policyNotes = Array.from(
      document.querySelectorAll<HTMLElement>(".create-assistant-policy-content .surface-note"),
    );
    const policyTitles = Array.from(
      document.querySelectorAll<HTMLElement>(".create-assistant-policy-content .surface-entry-title"),
    );
    const policyActions = Array.from(
      document.querySelectorAll<HTMLElement>(".create-assistant-policy-action"),
    );
    const policyArtImages = Array.from(
      document.querySelectorAll<HTMLImageElement>(".create-assistant-policy-art-image"),
    );
    const isAssetsPanel = Boolean(
      document.querySelector('[data-testid="create-assets-management-panel"]'),
    );

    const shellRect = createShell?.getBoundingClientRect();
    const canvasRect = productCanvas?.getBoundingClientRect();
    const searchRect = searchForm?.getBoundingClientRect();
    const stageRect = stageShell?.getBoundingClientRect();
    const stageArtRect = stageArt?.getBoundingClientRect();
    const stageAssetFrameRect = stageAssetFrame?.getBoundingClientRect();
    const stageAssetImageRect = stageAssetImage?.getBoundingClientRect();
    const stepperRect = stepperShell?.getBoundingClientRect();
    const progressRect = progress?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const tablineRect = tabline?.getBoundingClientRect();
    const tabLabelRect = tabLabel?.getBoundingClientRect();
    const stepperTitleRect = stepperTitle?.getBoundingClientRect();
    const stageBannerRect = stageBanner?.getBoundingClientRect();
    const stageBannerIconRect = stageBannerIcon?.getBoundingClientRect();
    const bulletRect = currentBullet?.getBoundingClientRect();
    const policyCardRects = policyCards.map((card) => card.getBoundingClientRect());
    const policyArtRects = policyArts.map((art) => art.getBoundingClientRect());
    const policyActionRects = policyActions.map((action) => action.getBoundingClientRect());
    const policyImageRects = policyArtImages.map((image) => image.getBoundingClientRect());
    const mandateBoard = document.querySelector<HTMLElement>(".create-mandate-visual-board");
    const mandateRect = mandateBoard?.getBoundingClientRect();
    const policyMarkline = document.querySelector<HTMLElement>(
      ".create-policy-markline, .create-assistant-markline",
    );
    const assetSearchField = document
      .querySelector<HTMLElement>("#create-arka-asset-search")
      ?.closest<HTMLElement>(".ops-field");
    const progressNote = progress?.querySelector<HTMLElement>(".surface-note");
    const policyMarklineRect = policyMarkline?.getBoundingClientRect();
    const assetSearchRect = assetSearchField?.getBoundingClientRect();
    const progressNoteDisplay = progressNote
      ? window.getComputedStyle(progressNote).display
      : "missing";
    const lastPolicyCardBottom = policyCardRects.length
      ? Math.max(...policyCardRects.map((rect) => Math.round(rect.bottom)))
      : 0;
    const policyArtRatios = policyCardRects.map((cardRect, index) => {
      const artRect = policyArtRects[index];
      return artRect && cardRect.width > 0 ? artRect.width / cardRect.width : 0;
    });
    const policyNoteMaxLines = policyNotes.reduce((maxLines, note) => {
      const rect = note.getBoundingClientRect();
      const computed = window.getComputedStyle(note);
      const lineHeight = Number.parseFloat(computed.lineHeight) || 1;
      return Math.max(maxLines, Math.ceil(rect.height / lineHeight));
    }, 0);
    const policyTitleMaxLines = policyTitles.reduce((maxLines, title) => {
      const rect = title.getBoundingClientRect();
      const computed = window.getComputedStyle(title);
      const lineHeight = Number.parseFloat(computed.lineHeight) || 1;
      return Math.max(maxLines, Math.ceil(rect.height / lineHeight));
    }, 0);
    const policyActionsInsideCards = policyActions.every((action) => {
      const card = action.closest<HTMLElement>(".create-assistant-policy-card");
      if (!card) return false;
      const actionRect = action.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return (
        actionRect.left >= cardRect.left - 1 &&
        actionRect.right <= cardRect.right + 1 &&
        actionRect.top >= cardRect.top - 1 &&
        actionRect.bottom <= cardRect.bottom + 1
      );
    });
    const policyImagesInsideArtFrames = policyArtImages.every((image) => {
      const frame = image.closest<HTMLElement>(".create-assistant-policy-art");
      if (!frame) return false;
      const imageRect = image.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      return (
        imageRect.left <= frameRect.left + 1 &&
        imageRect.right >= frameRect.right - 1 &&
        imageRect.top <= frameRect.top + 1 &&
        imageRect.bottom >= frameRect.bottom - 1
      );
    });
    const policyCardsConsistentHeight =
      policyCardRects.length < 2
        ? true
        : Math.max(...policyCardRects.map((rect) => rect.height)) -
            Math.min(...policyCardRects.map((rect) => rect.height)) <=
          2;
    const policyImageFrameHeightDeltas = policyImageRects.map((imageRect, index) => {
      const artRect = policyArtRects[index];
      return artRect ? Math.round(Math.abs(imageRect.height - artRect.height)) : 0;
    });

    return {
      viewport: window.innerWidth,
      shellLeft: shellRect ? Math.round(shellRect.left) : 0,
      shellWidth: shellRect ? Math.round(shellRect.width) : 0,
      canvasTop: canvasRect ? Math.round(canvasRect.top) : 0,
      canvasLeft: canvasRect ? Math.round(canvasRect.left) : 0,
      searchTop: searchRect ? Math.round(searchRect.top) : 0,
      searchBottom: searchRect ? Math.round(searchRect.bottom) : 0,
      searchRight: searchRect ? Math.round(window.innerWidth - searchRect.right) : 0,
      activeHeaderDisplay: activeHeader
        ? window.getComputedStyle(activeHeader).display
        : "missing",
      stepperDetailDisplay: stepperDetail
        ? window.getComputedStyle(stepperDetail).display
        : "missing",
      stageHeight: stageRect ? Math.round(stageRect.height) : 0,
      stageFrameFamily: stageShell?.dataset.figmaFrameFamily ?? "",
      stageFrameSource: stageShell?.dataset.figmaFrameSource ?? "",
      stageFrameAsset: stageShell?.dataset.figmaFrameAsset ?? "",
      stageArtDisplay: stageArt ? window.getComputedStyle(stageArt).display : "missing",
      stageArtWidth: stageArtRect ? Math.round(stageArtRect.width) : 0,
      stageArtHeight: stageArtRect ? Math.round(stageArtRect.height) : 0,
      stageAssetFrameWidth: stageAssetFrameRect ? Math.round(stageAssetFrameRect.width) : 0,
      stageAssetFrameHeight: stageAssetFrameRect ? Math.round(stageAssetFrameRect.height) : 0,
      stageAssetImageComplete: Boolean(
        stageAssetImage?.complete &&
          stageAssetImage.naturalWidth > 0 &&
          stageAssetImage.naturalHeight > 0,
      ),
      stageAssetImageInsideFrame:
        stageAssetFrameRect && stageAssetImageRect
          ? stageAssetImageRect.left <= stageAssetFrameRect.left + 1 &&
            stageAssetImageRect.right >= stageAssetFrameRect.right - 1 &&
            stageAssetImageRect.top <= stageAssetFrameRect.top + 1 &&
            stageAssetImageRect.bottom >= stageAssetFrameRect.bottom - 1
          : false,
      stageUsesLegacyCssWalletPlate: Boolean(
        document.querySelector(".create-figma-wallet-plate"),
      ),
      policyArtCount: policyArts.length,
      policyArtImageCount: policyArtImages.length,
      policyArtImagesComplete: policyArtImages.every(
        (image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      ),
      policyArtImagePositions: policyArtImages.map(
        (image) => window.getComputedStyle(image).objectPosition,
      ),
      isAssetsPanel,
      isBasicsPanel: Boolean(
        document.querySelector('[data-testid="create-profile-panel"]'),
      ),
      isDepositsPanel: Boolean(
        document.querySelector('[data-testid="create-deposits-panel"]'),
      ),
      isRedemptionsPanel: Boolean(
        document.querySelector('[data-testid="create-redemptions-panel"]'),
      ),
      policyArtUsesImageUrl: policyArts.some((art) =>
        window.getComputedStyle(art).backgroundImage.includes("url("),
      ),
      narrowestPolicyArtRatio: policyArtRatios.length
        ? Math.min(...policyArtRatios)
        : 0,
      shortestPolicyCardHeight: policyCardRects.length
        ? Math.min(...policyCardRects.map((rect) => Math.round(rect.height)))
        : 0,
      tallestPolicyCardHeight: policyCardRects.length
        ? Math.max(...policyCardRects.map((rect) => Math.round(rect.height)))
        : 0,
      policyMarklineVisible: Boolean(
        policyMarklineRect &&
          policyMarklineRect.width > 24 &&
          policyMarklineRect.height > 12,
      ),
      policyNoteMaxLines,
      policyTitleMaxLines,
      policyActionsInsideCards,
      policyImagesInsideArtFrames,
      policyCardsConsistentHeight,
      policyImageFrameHeightDeltas,
      mandateTop: mandateRect ? Math.round(mandateRect.top) : 0,
      lastPolicyCardBottom,
      policyActionMinWidth: policyActionRects.length
        ? Math.min(...policyActionRects.map((rect) => Math.round(rect.width)))
        : 0,
      tablineTop: tablineRect ? Math.round(tablineRect.top) : 0,
      stageTop: stageRect ? Math.round(stageRect.top) : 0,
      stepperItemCount: stepperItems.length,
      stepperTitleText: stepperTitle?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      stepperTitleFontSize: stepperTitle
        ? Number.parseFloat(window.getComputedStyle(stepperTitle).fontSize)
        : 0,
      stepperTitleLineHeight: stepperTitle
        ? Number.parseFloat(window.getComputedStyle(stepperTitle).lineHeight)
        : 0,
      stepperTitleLines:
        stepperTitle && stepperTitleRect
          ? Math.ceil(
              stepperTitleRect.height /
                (Number.parseFloat(window.getComputedStyle(stepperTitle).lineHeight) || 1),
            )
          : 0,
      visibleStepperStateCount: stepperStates.filter((state) => {
        const rect = state.getBoundingClientRect();
        return rect.width > 4 || rect.height > 4;
      }).length,
      currentBulletWidth: bulletRect ? Math.round(bulletRect.width) : 0,
      currentBulletHeight: bulletRect ? Math.round(bulletRect.height) : 0,
      progressBeforeActions:
        progressRect && actionsRect ? progressRect.bottom <= actionsRect.top + 1 : false,
      actionsInsideStepper:
        stepperRect && actionsRect
          ? actionsRect.bottom <= stepperRect.bottom + 1 &&
            actionsRect.left >= stepperRect.left - 1 &&
            actionsRect.right <= stepperRect.right + 1
          : false,
      actionsBottom: actionsRect ? Math.round(actionsRect.bottom) : 0,
      viewportHeight: window.innerHeight,
      progressNoteDisplay,
      assetSearchTop: assetSearchRect ? Math.round(assetSearchRect.top) : 0,
      tabLabelFontSize: tabLabel
        ? Number.parseFloat(window.getComputedStyle(tabLabel).fontSize)
        : 0,
      tabLabelBackground: tabLabel
        ? window.getComputedStyle(tabLabel).backgroundImage
        : "missing",
      tabLabelBorderTopWidth: tabLabel
        ? Number.parseFloat(window.getComputedStyle(tabLabel).borderTopWidth)
        : -1,
      tabLabelWidth: tabLabelRect ? Math.round(tabLabelRect.width) : 0,
      stageBannerPresent: Boolean(stageBanner),
      stageBannerHeight: stageBannerRect ? Math.round(stageBannerRect.height) : 0,
      stageBannerBorderColor: stageBanner
        ? window.getComputedStyle(stageBanner).borderTopColor
        : "missing",
      stageBannerColumnCount: stageBanner
        ? window.getComputedStyle(stageBanner).gridTemplateColumns.split(" ").length
        : 0,
      stageBannerIconWidth: stageBannerIconRect ? Math.round(stageBannerIconRect.width) : 0,
      stageBannerIconHeight: stageBannerIconRect ? Math.round(stageBannerIconRect.height) : 0,
    };
  });

  expect(geometry.activeHeaderDisplay).toBe("none");
  expect(geometry.stageTop).toBeGreaterThan(geometry.tablineTop);
  if (geometry.viewport >= 1024) {
    const sharedChromeWidth = Math.min(1520, geometry.viewport - 45);
    const sharedChromeLeft = Math.round((geometry.viewport - sharedChromeWidth) / 2);
    expect(Math.abs(geometry.shellLeft - sharedChromeLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.shellWidth - sharedChromeWidth)).toBeLessThanOrEqual(2);
    expect(geometry.canvasLeft).toBeGreaterThanOrEqual(geometry.shellLeft - 1);
    if (geometry.isDepositsPanel || geometry.isRedemptionsPanel) {
      expect(geometry.canvasTop).toBeGreaterThanOrEqual(112);
      expect(geometry.canvasTop).toBeLessThanOrEqual(174);
    } else {
      expect(geometry.canvasTop).toBeGreaterThanOrEqual(104);
    }
    expect(geometry.searchTop).toBeLessThan(geometry.canvasTop);
    expect(geometry.searchBottom).toBeLessThanOrEqual(geometry.canvasTop - 8);
    expect(geometry.searchRight).toBeGreaterThanOrEqual(310);
    expect(geometry.tabLabelFontSize).toBeGreaterThanOrEqual(16);
    expect(geometry.tabLabelFontSize).toBeLessThanOrEqual(23);
    expect(geometry.tabLabelBackground).not.toBe("none");
    expect(geometry.tabLabelBorderTopWidth).toBeGreaterThanOrEqual(1);
    expect(geometry.tabLabelWidth).toBeGreaterThanOrEqual(170);
    expect(geometry.tabLabelWidth).toBeLessThanOrEqual(250);
    if (geometry.stageBannerPresent) {
      expect(geometry.stageBannerHeight).toBeGreaterThanOrEqual(56);
      expect(geometry.stageBannerBorderColor).toContain("255, 211, 0");
      expect(geometry.stageBannerColumnCount).toBe(2);
      expect(geometry.stageBannerIconWidth).toBeGreaterThanOrEqual(30);
      expect(geometry.stageBannerIconHeight).toBeGreaterThanOrEqual(30);
    }
    expect(geometry.stageHeight).toBeLessThanOrEqual(245);
    expect(geometry.stageFrameFamily).toMatch(/^create-/);
    expect(geometry.stageFrameSource).toMatch(/figma_asset|extension_frame/);
    expect(geometry.stageFrameAsset).toMatch(/^\/figma\/create\/.+\.png$/);
    expect(geometry.stageArtDisplay).not.toBe("none");
    expect(geometry.stageArtWidth).toBeGreaterThanOrEqual(180);
    expect(geometry.stageArtHeight).toBeGreaterThanOrEqual(120);
    expect(geometry.stageAssetFrameWidth).toBeGreaterThanOrEqual(140);
    expect(geometry.stageAssetFrameHeight).toBeGreaterThanOrEqual(96);
    expect(geometry.stageAssetImageComplete).toBe(true);
    expect(geometry.stageAssetImageInsideFrame).toBe(true);
    expect(geometry.stageUsesLegacyCssWalletPlate).toBe(false);
    expect(geometry.stepperItemCount).toBe(7);
    expect(geometry.stepperTitleText).toBe("Create your Arka");
    expect(geometry.stepperTitleFontSize).toBeGreaterThanOrEqual(18);
    expect(geometry.stepperTitleFontSize).toBeLessThanOrEqual(26);
    expect(geometry.stepperTitleLineHeight).toBeLessThanOrEqual(28);
    expect(geometry.stepperTitleLines).toBe(1);
    expect(geometry.visibleStepperStateCount).toBe(0);
    expect(geometry.currentBulletWidth).toBeGreaterThanOrEqual(38);
    expect(geometry.currentBulletHeight).toBeGreaterThanOrEqual(38);
    expect(
      Math.abs(geometry.currentBulletWidth - geometry.currentBulletHeight),
    ).toBeLessThanOrEqual(1);
    expect(geometry.stepperDetailDisplay).toBe("none");
    if (geometry.policyArtCount > 0) {
      expect(geometry.policyArtUsesImageUrl).toBe(false);
      expect(geometry.policyArtImageCount).toBe(geometry.policyArtCount);
      expect(geometry.policyArtImagesComplete).toBe(true);
      if (geometry.isAssetsPanel || geometry.isBasicsPanel) {
        expect(geometry.policyArtImagePositions.every((position) => position === "82% 50%")).toBe(
          true,
        );
      } else {
        expect(geometry.policyArtImagePositions.every((position) => position === "100% 50%")).toBe(
          true,
        );
      }
      if (
        geometry.isDepositsPanel ||
        geometry.isRedemptionsPanel ||
        geometry.isBasicsPanel ||
        geometry.isAssetsPanel
      ) {
        expect(geometry.narrowestPolicyArtRatio).toBeGreaterThanOrEqual(0.29);
        expect(geometry.narrowestPolicyArtRatio).toBeLessThanOrEqual(0.46);
        expect(geometry.shortestPolicyCardHeight).toBeGreaterThanOrEqual(145);
        expect(geometry.tallestPolicyCardHeight).toBeLessThanOrEqual(212);
        if (geometry.isDepositsPanel || geometry.isRedemptionsPanel || geometry.isBasicsPanel) {
          expect(geometry.policyMarklineVisible).toBe(true);
        }
      } else {
        expect(geometry.narrowestPolicyArtRatio).toBeGreaterThanOrEqual(0.38);
        expect(geometry.shortestPolicyCardHeight).toBeGreaterThanOrEqual(210);
      }
      expect(geometry.policyActionsInsideCards).toBe(true);
      expect(geometry.policyImagesInsideArtFrames).toBe(true);
      if (
        geometry.isDepositsPanel ||
        geometry.isRedemptionsPanel ||
        geometry.isBasicsPanel ||
        geometry.isAssetsPanel
      ) {
        expect(geometry.policyCardsConsistentHeight).toBe(true);
        expect(
          geometry.policyImageFrameHeightDeltas.every((delta: number) => delta <= 2),
        ).toBe(true);
        expect(geometry.policyTitleMaxLines).toBeLessThanOrEqual(2);
        expect(geometry.policyNoteMaxLines).toBeLessThanOrEqual(
          geometry.isRedemptionsPanel ? 4 : 5,
        );
        expect(geometry.policyActionMinWidth).toBeGreaterThanOrEqual(145);
        expect(geometry.mandateTop - geometry.lastPolicyCardBottom).toBeGreaterThanOrEqual(82);
      }
    }
    expect(geometry.progressBeforeActions).toBe(true);
    expect(geometry.actionsInsideStepper).toBe(true);
    expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.viewportHeight + 4);
    expect(geometry.progressNoteDisplay).toBe("none");
    if (geometry.isBasicsPanel) {
      expect(geometry.assetSearchTop).toBeGreaterThanOrEqual(700);
    }
  }
}

test.describe("Create Arka wizard matrix", () => {
  test.setTimeout(150_000);

  test.beforeEach(async ({ page }) => {
    await mockCatalogApi(page);
    await installHolderWallet(page);
  });

  test("keeps every Figma wizard checkpoint routed, readable and stateful", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1050 });

    for (const step of CREATE_STEP_EXPECTATIONS) {
      await test.step(`step ${step.id}`, async () => {
        await gotoCreateWizard(page, `/factory/create?step=${step.id}&denomination=BLND&asset=XTAR`);
        await expectCreateStepSurface(page, step);
        await expectNoPageHorizontalOverflow(page);
        await expectNoViewportClippedControls(page);
      });
    }
  });

  test("keeps critical wizard breakpoints free of horizontal overflow and clipped controls", async ({
    page,
  }) => {
    for (const viewport of RESPONSIVE_VIEWPORTS) {
      for (const step of CREATE_STEP_EXPECTATIONS) {
        await test.step(`${viewport.label} ${step.id}`, async () => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await gotoCreateWizard(page, `/factory/create?step=${step.id}&denomination=BLND&asset=XTAR`);
          await expectCreateStepSurface(page, step);
          await expectNoPageHorizontalOverflow(page);
          await expectNoViewportClippedControls(page);
        });
      }
    }
  });

  test("persists selected assets and Blend handoff through reload and wizard back navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1050 });
    await gotoCreateWizard(
      page,
      "/factory/create?step=assets-management&denomination=BLND&asset=XTAR&intent=blend",
    );

    await expect(page.getByTestId("create-assets-management-panel")).toBeVisible();
    await expect(page).toHaveURL(/step=assets/);
    await expect(page).toHaveURL(/intent=blend/);
    await expect(page.getByTestId("create-arka-setup-intent")).toHaveValue("BLEND");
    await expect(page.getByTestId("create-assets-management-panel")).toContainText(
      /open after creation/i,
    );
    await expectNoUnresolvedSurfaceCopy(page.getByTestId("create-assets-management-panel"));

    await page.getByTestId("create-step-review").click();
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page).toHaveURL(/step=review/);
    await expect(page).toHaveURL(/intent=blend/);
    await expect(page.getByTestId("create-arka-review-card")).toContainText(
      /open after creation: blend/i,
    );
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/BLND/i);
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/XTAR/i);
    await expectNoUnresolvedSurfaceCopy(page.getByTestId("create-review-panel"));

    await page.reload();
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-review-card")).toContainText(
      /open after creation: blend/i,
    );
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/BLND/i);
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/XTAR/i);
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled({
      timeout: 30_000,
    });

    await page.getByTestId("create-step-back").click();
    await expect(page.getByTestId("create-assets-management-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-setup-intent")).toHaveValue("BLEND");
    await expectNoPageHorizontalOverflow(page);
    await expectNoViewportClippedControls(page);
  });

  test("lists the required core Stellar assets in Create denomination and whitelist lanes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1050 });
    await gotoCreateWizard(page, "/factory/create?step=basics");

    const denominationPanel = page.getByTestId("create-arka-denomination-panel");
    const whitelistPanel = page.getByTestId("create-arka-whitelist-panel");
    await expect(denominationPanel).toBeVisible();

    for (const symbol of [
      "XLM",
      "USDC",
      "EURC",
      "AQUA",
      "XTAR",
      "BLND",
      "SHX",
      "XRF",
      "VELO",
      "YBX",
    ]) {
      await expect(denominationPanel).toContainText(symbol);
      await expect(whitelistPanel).toContainText(symbol);
    }

    await expect(whitelistPanel.locator("[data-icon-source]").first()).toBeVisible();
    await expect(whitelistPanel.locator("[data-toml-state]").first()).toBeVisible();
    await expectNoUnresolvedSurfaceCopy(denominationPanel);
    await expectNoUnresolvedSurfaceCopy(whitelistPanel);
    await expectNoPageHorizontalOverflow(page);
  });

  test("supports create confirmation cancel and retry after deterministic build failure", async ({
    page,
  }) => {
    let buildAttempts = 0;
    await page.route("**/api/factory/create/build", async (route) => {
      buildAttempts += 1;
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "factory builder unavailable for e2e retry coverage",
      });
    });

    await gotoCreateWizard(page, "/factory/create?step=review&denomination=BLND&asset=XTAR");
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled({
      timeout: 30_000,
    });

    await page.getByTestId("create-arka-submit-button").click();
    await expect(page.getByRole("dialog")).toContainText(/create a new arka/i);
    await expect(page.getByTestId("create-arka-confirm-button")).toBeVisible();
    await expect(page.getByTestId("create-arka-cancel-button")).toBeVisible();
    await page.getByTestId("create-arka-cancel-button").click();

    await expect(page.getByTestId("create-arka-confirm-button")).toHaveCount(0);
    await expect(page.getByTestId("create-arka-error")).toHaveCount(0);
    expect(buildAttempts).toBe(0);

    await page.getByTestId("create-arka-submit-button").click();
    await page.getByTestId("create-arka-confirm-button").click();
    await expect(page.getByTestId("create-arka-error")).toContainText(
      /factory builder unavailable/i,
      { timeout: 30_000 },
    );
    expect(buildAttempts).toBe(1);

    await expect(page.locator(".create-active-stage-heading")).toContainText(
      /review and create/i,
    );
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/BLND/i);
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/XTAR|BLND/i);

    await page.getByTestId("create-arka-submit-button").click();
    await page.getByTestId("create-arka-confirm-button").click();
    await expect(page.getByTestId("create-arka-error")).toContainText(
      /factory builder unavailable/i,
      { timeout: 30_000 },
    );
    expect(buildAttempts).toBe(2);
  });

  test("keeps wallet signer rejection explicit and retryable on the final deployment lane", async ({
    page,
  }) => {
    let buildAttempts = 0;

    await page.route("**/api/factory/create/build", async (route) => {
      buildAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          xdrB64: "AAAAAgAAAAD7",
          predictedAddress:
            "CDEMOARKA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("e2e-wallet-signing-failure", "reject");
    });

    await gotoCreateWizard(page, "/factory/create?step=review&denomination=BLND&asset=XTAR");
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled({
      timeout: 30_000,
    });

    await page.getByTestId("create-arka-submit-button").click();
    await expect(page.getByRole("dialog")).toContainText(/create a new arka/i);
    await page.getByTestId("create-arka-confirm-button").click();

    await expect(page.getByTestId("create-arka-error")).toContainText(
      /e2e wallet signer unavailable/i,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("create-arka-status")).toHaveCount(0);
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled();
    await expect(page.locator(".create-active-stage-heading")).toContainText(
      /review and create/i,
    );
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/BLND/i);
    expect(buildAttempts).toBe(1);

    await page.getByTestId("create-arka-submit-button").click();
    await page.getByTestId("create-arka-confirm-button").click();
    await expect(page.getByTestId("create-arka-error")).toContainText(
      /e2e wallet signer unavailable/i,
      { timeout: 30_000 },
    );
    expect(buildAttempts).toBe(2);
  });

  test("blocks deployment on wallet disconnect and re-enables after provider switch", async ({
    page,
  }) => {
    const managerWallet = await resolveE2EWalletAddress(page, "manager");

    await gotoCreateWizard(page, "/factory/create?step=review&denomination=BLND&asset=XTAR");
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled({
      timeout: 30_000,
    });
    await expect(page.getByTestId("create-arka-review-card")).toContainText(
      /Wallet: G[A-Z0-9]{55}/,
    );

    await page.evaluate(() => {
      window.localStorage.removeItem("wallet:pubkey");
      window.dispatchEvent(
        new CustomEvent("wallet:pubkey-changed", { detail: "" }),
      );
    });

    await expect(page.getByTestId("create-arka-review-card")).toContainText(
      /wallet: offline/i,
    );
    await expect(page.getByTestId("create-submit-blocker")).toContainText(/wallet/i);
    await expect(page.getByTestId("create-arka-submit-button")).toBeDisabled();
    await expect(page.getByTestId("create-arka-confirm-button")).toHaveCount(0);

    await page.evaluate((address) => {
      window.localStorage.setItem("e2e-wallet-profile", "manager");
      window.localStorage.setItem("wallet:pubkey", address);
      window.dispatchEvent(
        new CustomEvent("wallet:pubkey-changed", { detail: address }),
      );
    }, managerWallet);

    await expect(page.getByTestId("create-arka-review-card")).toContainText(managerWallet);
    await expect(page.getByTestId("create-submit-blocker")).toHaveCount(0);
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled();
    await expectNoUnresolvedSurfaceCopy(page.getByTestId("create-review-panel"));
    await expectNoPageHorizontalOverflow(page);
    await expectNoViewportClippedControls(page);
  });

  test("fails closed when wallet signing times out on the final deployment lane", async ({
    page,
  }) => {
    let buildAttempts = 0;

    await page.route("**/api/factory/create/build", async (route) => {
      buildAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          xdrB64: "AAAAAgAAAAD7",
          predictedAddress:
            "CTIMEOUTARKA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPQ",
        }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("e2e-wallet-signing-failure", "timeout");
    });

    await gotoCreateWizard(page, "/factory/create?step=review&denomination=BLND&asset=XTAR");
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled({
      timeout: 30_000,
    });

    await page.getByTestId("create-arka-submit-button").click();
    await expect(page.getByRole("dialog")).toContainText(/create a new arka/i);
    await page.getByTestId("create-arka-confirm-button").click();

    await expect(page.getByTestId("create-arka-error")).toContainText(
      /wallet signing timed out/i,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("create-arka-status")).toHaveCount(0);
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled();
    await expect(page.locator(".create-active-stage-heading")).toContainText(
      /review and create/i,
    );
    await expect(page.getByTestId("create-arka-review-card")).toContainText(/BLND/i);
    expect(buildAttempts).toBe(1);
  });

  test("fails closed when the final deployment signer returns no signed XDR", async ({
    page,
  }) => {
    let buildAttempts = 0;
    let malformedSignerAttempts = 0;

    await page.route("**/api/factory/create/build", async (route) => {
      buildAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          xdrB64: "AAAAAgAAAAD7",
          predictedAddress:
            "CFAILCLOSED7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
        }),
      });
    });

    await page.route("**/api/e2e-wallet**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      malformedSignerAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await gotoCreateWizard(page, "/factory/create?step=review&denomination=BLND&asset=XTAR");
    await expect(page.getByTestId("create-review-panel")).toBeVisible();
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled({
      timeout: 30_000,
    });

    await page.getByTestId("create-arka-submit-button").click();
    await expect(page.getByRole("dialog")).toContainText(/create a new arka/i);
    await page.getByTestId("create-arka-confirm-button").click();

    await expect(page.getByTestId("create-arka-error")).toContainText(
      /e2e wallet signature missing|wallet signature unavailable/i,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("create-arka-status")).toHaveCount(0);
    await expect(page.getByTestId("create-arka-submit-button")).toBeEnabled();
    await expect(page.locator(".create-active-stage-heading")).toContainText(
      /review and create/i,
    );
    expect(buildAttempts).toBe(1);
    expect(malformedSignerAttempts).toBe(1);
  });
});
