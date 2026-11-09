import { expect, test, type Page } from "@playwright/test";
import {
  fixtureArkasPage,
  fixtureManagersPage,
  resolveCatalogFixture,
} from "../src/lib/catalog/testFixtures";
import {
  buildCatalogDerivedMetrics,
  normalizeVaultSortMetric,
  normalizeVaultSortOrder,
  pickDerivedMetricsForEntries,
  rankVaultLeaderboardEntries,
} from "../src/lib/catalog/leaderboardArkas";
import {
  normalizeManagerSortMetric,
  normalizeManagerSortOrder,
  rankManagerLeaderboardEntries,
} from "../src/lib/catalog/leaderboardManagers";

type ControlledSearch =
  | "discover-gamma"
  | "assets-usdc"
  | "managers-beta"
  | "vaults-beta";

type PendingHold = {
  key: ControlledSearch;
  resolve: () => void;
};

const CORE_REGISTRY_BODY = {
  generatedAt: "2026-04-25T18:00:00.000Z",
  items: [
    {
      id: "xlm",
      label: "Stellar Lumens",
      symbol: "XLM",
      kind: "native",
      description: "Native Stellar asset available as an Arka denomination and route asset.",
      homeDomain: null,
      classicCode: "XLM",
      classicIssuer: null,
      metadataContract:
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      selectableContract:
        "CXLMCOREA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      iconUrl: "/assets/core/xlm.png",
      fallbackIconUrl: "/assets/core/xlm.png",
      iconSource: "registry_png",
      lookupKeys: ["xlm", "CXLMCOREA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV"],
    },
    {
      id: "usdc",
      label: "USD Coin",
      symbol: "USDC",
      kind: "classic",
      description: "Circle-issued dollar stablecoin.",
      homeDomain: "circle.com",
      classicCode: "USDC",
      classicIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      metadataContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      selectableContract: "CDENOMUSDC7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      iconUrl: "https://cdn.circle.com/usdc.png",
      fallbackIconUrl: "/assets/core/usdc.png",
      iconSource: "stellar_toml",
      lookupKeys: [
        "usdc",
        "CDENOMUSDC7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      ],
    },
    {
      id: "aqua",
      label: "Aqua",
      symbol: "AQUA",
      kind: "classic",
      description: "Aquarius ecosystem token.",
      homeDomain: "aqua.network",
      classicCode: "AQUA",
      classicIssuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
      metadataContract: "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
      selectableContract: "CAQUAASST7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      iconUrl: "https://cdn.aqua.network/aqua.png",
      fallbackIconUrl: "/assets/core/aqua.png",
      iconSource: "stellar_toml",
      lookupKeys: ["aqua", "CAQUAASST7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV"],
    },
    {
      id: "xtar",
      label: "Dogstar",
      symbol: "XTAR",
      kind: "classic",
      description: "Dogstar token.",
      homeDomain: "dogstarcoin.com",
      classicCode: "XTAR",
      classicIssuer: "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
      metadataContract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      selectableContract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      iconUrl: "https://cdn.dogstarcoin.com/xtar.png",
      fallbackIconUrl: "/assets/core/xtar.png",
      iconSource: "stellar_toml",
      lookupKeys: ["xtar", "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY"],
    },
    {
      id: "blnd",
      label: "Blend",
      symbol: "BLND",
      kind: "classic",
      description: "Blend governance token.",
      homeDomain: null,
      classicCode: "BLND",
      classicIssuer: "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
      metadataContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      selectableContract: "CBLNDASSET7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      iconUrl: "/assets/core/blnd.png",
      fallbackIconUrl: "/assets/core/blnd.png",
      iconSource: "registry_png",
      lookupKeys: ["blnd", "CBLNDASSET7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV"],
    },
  ],
};

function buildArkaLeaderboardResponse(url: URL) {
  const sortMetric = normalizeVaultSortMetric(url.searchParams.get("sortMetric"));
  const sortOrder = normalizeVaultSortOrder(
    sortMetric,
    url.searchParams.get("sortOrder"),
  );
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
  const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const curatedOnly = url.searchParams.get("curatedOnly");
  const pageData = fixtureArkasPage({
    search: url.searchParams.get("search") ?? undefined,
    curated: curatedOnly === "false" || curatedOnly === "0" ? undefined : true,
    limit: 24,
  });
  const metrics = buildCatalogDerivedMetrics(pageData.items);
  const rankedItems = rankVaultLeaderboardEntries(
    pageData.items,
    sortMetric,
    sortOrder,
    metrics,
  );
  const pagedItems = rankedItems.slice(offset, offset + limit);

  return {
    ok: true,
    source: "api_vault_leaderboard",
    generatedAt: "2026-04-16T12:00:00.000Z",
    query: {
      search: url.searchParams.get("search"),
      curatedOnly: curatedOnly === "false" || curatedOnly === "0" ? false : true,
      sortMetric,
      sortOrder,
      limit,
      offset,
      activityFallbackLimit: 60,
    },
    page: {
      total: rankedItems.length,
      offset,
      limit,
      items: pagedItems,
    },
    derivedMetrics: pickDerivedMetricsForEntries(pagedItems, metrics),
  };
}

function buildManagerLeaderboardResponse(url: URL) {
  const sortMetric = normalizeManagerSortMetric(url.searchParams.get("sortMetric"));
  const sortOrder = normalizeManagerSortOrder(
    sortMetric,
    url.searchParams.get("sortOrder"),
  );
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
  const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const pageData = fixtureManagersPage({
    search: url.searchParams.get("search") ?? undefined,
    limit: 24,
  });
  const rankedItems = rankManagerLeaderboardEntries(
    pageData.items,
    sortMetric,
    sortOrder,
  );
  const pagedItems = rankedItems.slice(offset, offset + limit);

  return {
    ok: true,
    source: "api_manager_leaderboard",
    generatedAt: "2026-04-16T12:00:00.000Z",
    query: {
      search: url.searchParams.get("search"),
      sortMetric,
      sortOrder,
      limit,
      offset,
    },
    page: {
      total: rankedItems.length,
      offset,
      limit,
      items: pagedItems,
    },
  };
}

async function maybeHold(
  pendingHolds: PendingHold[],
  activeHolds: Set<ControlledSearch>,
  key: ControlledSearch,
) {
  if (!activeHolds.has(key)) {
    return;
  }
  await new Promise<void>((resolve) => pendingHolds.push({ key, resolve }));
}

async function mockPublicLoadingApi(page: Page) {
  const activeHolds = new Set<ControlledSearch>();
  const pendingHolds: PendingHold[] = [];

  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CORE_REGISTRY_BODY),
    });
  });

  await page.route("**/api/leaderboard/source", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "deployments",
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-04-16",
          network: "testnet",
          rpcUrl: "https://soroban-testnet.stellar.org",
          oracleGuard: "CORACLEGUARD7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          primaryOracle: "CPRIMARY07RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          secondaryOracle: "CSECONDAR7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          primaryProvider: "reflector",
          secondaryProvider: "twap_guard",
          provider: "twap_guard",
          validationAsset: "CASSET0007RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          selectedSourceUnderDivergence: 2,
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
      }),
    });
  });

  await page.route("**/api/leaderboard/arkas**", async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get("search")?.toLowerCase();
    if (search === "beta") {
      await maybeHold(pendingHolds, activeHolds, "vaults-beta");
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildArkaLeaderboardResponse(url)),
    });
  });

  await page.route("**/api/leaderboard/managers**", async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get("search")?.toLowerCase();
    if (search === "beta") {
      await maybeHold(pendingHolds, activeHolds, "managers-beta");
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildManagerLeaderboardResponse(url)),
    });
  });

  await page.route("**/api/catalog/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/catalog", "");
    const search = url.searchParams.get("search")?.toLowerCase();
    if (pathname === "/v1/arkas" && search === "gamma") {
      await maybeHold(pendingHolds, activeHolds, "discover-gamma");
    }
    if (pathname === "/v1/assets" && search === "usdc") {
      await maybeHold(pendingHolds, activeHolds, "assets-usdc");
    }
    const body = resolveCatalogFixture(pathname, url.searchParams);
    const status =
      typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return {
    hold(key: ControlledSearch) {
      activeHolds.add(key);
    },
    release(key: ControlledSearch) {
      activeHolds.delete(key);
      for (const pending of pendingHolds.splice(0)) {
        if (pending.key === key) {
          pending.resolve();
        } else {
          pendingHolds.push(pending);
        }
      }
    },
  };
}

test.describe("public loading state matrix", () => {
  test("Discover keeps real results visible while a slower catalog filter refreshes", async ({
    page,
  }) => {
    const catalog = await mockPublicLoadingApi(page);

    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: /^discover$/i })).toBeVisible();
    await expect(page.getByTestId("discover-figma-preview-grid")).toContainText(
      /Arka #1|CA7ALPHA/,
    );

    catalog.hold("discover-gamma");
    await page.getByTestId("discover-search-input").fill("gamma");

    await expect(page.getByTestId("discover-refresh-status")).toBeVisible();
    await expect(page.getByTestId("discover-refresh-status")).toHaveAttribute(
      "role",
      "status",
    );
    await expect(page.getByTestId("discover-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByTestId("discover-figma-preview-grid")).toContainText(
      /Arka #1|CA7ALPHA/,
    );

    catalog.release("discover-gamma");

    await expect(page.getByTestId("discover-refresh-status")).toHaveCount(0);
    await expect(page.getByTestId("discover-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByTestId("discover-figma-preview-grid")).toContainText(
      /CA7GAMMA|GCCGAMM/,
    );
  });

  test("Assets keeps the indexed table visible during a slower core asset search", async ({
    page,
  }) => {
    const catalog = await mockPublicLoadingApi(page);

    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: /^assets$/i })).toBeVisible();
    await expect(page.getByTestId("assets-list-panel")).toContainText("USDC");

    catalog.hold("assets-usdc");
    await page.getByTestId("assets-search-input").fill("usdc");

    await expect(page.getByTestId("assets-refresh-status")).toBeVisible();
    await expect(page.getByTestId("assets-refresh-status")).toHaveAttribute(
      "role",
      "status",
    );
    await expect(page.getByTestId("assets-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByTestId("assets-list-panel")).toContainText("USDC");
    await expect(page.getByTestId("asset-card").first()).toBeVisible();

    catalog.release("assets-usdc");

    await expect(page.getByTestId("assets-refresh-status")).toHaveCount(0);
    await expect(page.getByTestId("assets-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByTestId("assets-list-panel")).toContainText("USDC");
  });

  test("Managers preserves current ranking while a slower manager search resolves", async ({
    page,
  }) => {
    const catalog = await mockPublicLoadingApi(page);

    await page.goto("/managers");
    await expect(
      page.getByRole("heading", { name: /managers leaderboard/i }),
    ).toBeVisible();
    await expect(page.getByTestId("managers-list-panel")).toContainText(
      "GCAALPHA",
    );

    catalog.hold("managers-beta");
    await page.getByTestId("managers-search-input").fill("beta");

    await expect(page.getByTestId("managers-refresh-status")).toBeVisible();
    await expect(page.getByTestId("managers-refresh-status")).toHaveAttribute(
      "role",
      "status",
    );
    await expect(page.getByTestId("managers-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByTestId("managers-list-panel")).toContainText(
      "GCAALPHA",
    );

    catalog.release("managers-beta");

    await expect(page.getByTestId("managers-refresh-status")).toHaveCount(0);
    await expect(page.getByTestId("managers-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByTestId("managers-list-panel")).toContainText(
      "GCBBETA",
    );
  });

  test("Arkas leaderboard keeps ranked cards visible while a slower vault search resolves", async ({
    page,
  }) => {
    const catalog = await mockPublicLoadingApi(page);

    await page.goto("/vaults");
    await expect(
      page.getByRole("heading", { name: /arkas leaderboard/i }),
    ).toBeVisible();
    await expect(page.getByTestId("vaults-leaderboard-panel")).toContainText(
      "CA7ALPHA",
    );

    catalog.hold("vaults-beta");
    await page.getByTestId("vaults-search-input").fill("beta");

    await expect(page.getByTestId("vaults-refresh-note")).toBeVisible();
    await expect(page.getByTestId("vaults-refresh-note")).toHaveAttribute(
      "role",
      "status",
    );
    await expect(page.getByTestId("vaults-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByTestId("vaults-leaderboard-panel")).toContainText(
      "CA7ALPHA",
    );

    catalog.release("vaults-beta");

    await expect(page.getByTestId("vaults-refresh-note")).toHaveCount(0);
    await expect(page.getByTestId("vaults-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByTestId("vaults-leaderboard-panel")).toContainText(
      "CA7BETA",
    );
  });
});
