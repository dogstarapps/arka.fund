import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArkasIndex from "@/app/arkas/page";
import VaultLeaderboardSurface from "@/components/product/VaultLeaderboardSurface";
import { fixtureArkasPage, resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import {
  buildCatalogDerivedMetrics,
  normalizeVaultSortMetric,
  normalizeVaultSortOrder,
  pickDerivedMetricsForEntries,
  rankVaultLeaderboardEntries,
} from "@/lib/catalog/leaderboardArkas";
import type { VaultLeaderboardResolvedPageResponse } from "@/lib/catalog/types";

const ALPHA_ARKA_ID = "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";
const BETA_ARKA_ID = "CA7BETAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";

function installCatalogFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL
          ? input
          : new URL(input.url);

    if (url.pathname === "/api/leaderboard/arkas") {
      const sortMetric = normalizeVaultSortMetric(url.searchParams.get("sortMetric"));
      const sortOrder = normalizeVaultSortOrder(sortMetric, url.searchParams.get("sortOrder"));
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
      const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
      const curatedOnly = url.searchParams.get("curatedOnly");
      const page = fixtureArkasPage({
        search: url.searchParams.get("search") ?? undefined,
        curated: curatedOnly === "false" || curatedOnly === "0" ? undefined : true,
        limit: 24,
      });
      const derivedMetrics = buildCatalogDerivedMetrics(page.items);
      const rankedItems = rankVaultLeaderboardEntries(
        page.items,
        sortMetric,
        sortOrder,
        derivedMetrics,
      );
      const pagedItems = rankedItems.slice(offset, offset + limit);
      const payload: VaultLeaderboardResolvedPageResponse = {
        ok: true,
        source: "api_vault_leaderboard",
        generatedAt: "2026-04-16T12:00:00.000Z",
        query: {
          search: url.searchParams.get("search"),
          curatedOnly: !(curatedOnly === "false" || curatedOnly === "0"),
          sortMetric,
          sortOrder,
          limit,
          offset,
          activityFallbackLimit: 60,
        },
        page: { total: rankedItems.length, offset, limit, items: pagedItems },
        derivedMetrics: pickDerivedMetricsForEntries(pagedItems, derivedMetrics),
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    const status = typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("vault entrypoints", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("renders economic metrics and separate profile and action links", async () => {
    installCatalogFetchMock();
    render(<VaultLeaderboardSurface />);

    await screen.findByRole("heading", { name: /arkas leaderboard/i });
    expect(screen.getByTestId("vaults-total-nav")).toHaveTextContent("Valuation unavailable");
    expect(screen.getByTestId("vaults-total-nav")).toHaveTextContent("needs USD pricing");
    expect(screen.getByTestId("vault-public-metric-profit")).toHaveTextContent("$0.09");
    expect(screen.getByTestId("vault-public-metric-volume")).toHaveTextContent("$0.61");
    expect(screen.getAllByTestId("vault-leaderboard-card")).toHaveLength(4);
    expect(screen.getAllByTestId("vault-row-arka-id")[0]).toHaveAttribute(
      "title",
      expect.stringContaining("CA7ALPHA"),
    );
    expect(screen.getAllByTestId("vault-row-manager-id")[0]).toHaveAttribute(
      "data-full-value",
      expect.stringContaining("GCAALPHA"),
    );
    expect(screen.getAllByTestId("vault-row-base-contract")[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Denomination asset"),
    );
    expect(screen.getAllByTestId("vault-open-profile-link")[0]).toHaveAttribute(
      "href",
      `/vaults/${ALPHA_ARKA_ID}`,
    );
    expect(screen.getAllByTestId("vault-open-ops-link")[0]).toHaveAttribute(
      "href",
      `/arkas/${ALPHA_ARKA_ID}`,
    );
    expect(screen.queryByTestId("vault-sort-pill")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vaults-boundary-panel")).not.toBeInTheDocument();
  });

  it("orders the leaderboard by profit and volume", async () => {
    const user = userEvent.setup();
    installCatalogFetchMock();
    render(<VaultLeaderboardSurface />);

    await screen.findByRole("heading", { name: /arkas leaderboard/i });
    await user.selectOptions(screen.getByTestId("vaults-sort-metric"), "profit");
    await waitFor(() =>
      expect(screen.getAllByTestId("vault-open-profile-link")[0]).toHaveAttribute(
        "href",
        `/vaults/${BETA_ARKA_ID}`,
      ),
    );
    expect(screen.getAllByTestId("vault-leaderboard-card")[0]).toHaveTextContent("P/L $");

    await user.selectOptions(screen.getByTestId("vaults-sort-metric"), "volume");
    await waitFor(() =>
      expect(screen.getAllByTestId("vault-open-profile-link")[0]).toHaveAttribute(
        "href",
        `/vaults/${ALPHA_ARKA_ID}`,
      ),
    );
    expect(screen.getAllByTestId("vault-leaderboard-card")[0]).toHaveTextContent("Volume $");
  });

  it("restores filters from the URL and writes user changes back", async () => {
    const user = userEvent.setup();
    installCatalogFetchMock();
    window.history.replaceState(
      null,
      "",
      "/vaults?q=beta&curated=0&sort=profit&feature=volume&window=latest",
    );
    render(<VaultLeaderboardSurface />);

    await screen.findByRole("heading", { name: /arkas leaderboard/i });
    const searchInput = screen.getByTestId("vaults-search-input");
    expect(searchInput).toHaveValue("beta");
    expect(screen.getByTestId("vaults-sort-metric")).toHaveValue("profit");
    expect(screen.getByTestId("vaults-featured-tab-volume")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("vaults-window-latest")).toHaveAttribute("aria-pressed", "true");

    await user.click(searchInput);
    await user.type(searchInput, "x");
    expect(searchInput).toHaveFocus();
    expect(window.location.search).toContain("q=betax");
    await user.click(screen.getByTestId("vaults-featured-tab-profit"));
    expect(window.location.search).toContain("feature=profit");
    await user.click(screen.getByTestId("vaults-window-all"));
    expect(window.location.search).not.toContain("window=");
  });

  it("keeps search focused while refreshed results replace the ranking", async () => {
    const user = userEvent.setup();
    installCatalogFetchMock();
    render(<VaultLeaderboardSurface />);

    const searchInput = await screen.findByTestId("vaults-search-input");
    await user.click(searchInput);
    await user.type(searchInput, "beta");
    await waitFor(() =>
      expect(
        within(screen.getByTestId("vaults-leaderboard-panel")).getByTestId(
          "vault-open-profile-link",
        ),
      ).toHaveAttribute("href", `/vaults/${BETA_ARKA_ID}`),
    );
    expect(searchInput).toHaveFocus();
    expect(screen.queryByTestId("vaults-loading")).not.toBeInTheDocument();
  });

  it("uses the same canonical leaderboard on the Arkas route", async () => {
    installCatalogFetchMock();
    render(<ArkasIndex />);

    await screen.findByRole("heading", { name: /arkas leaderboard/i });
    expect(screen.getByTestId("vaults-fidelity-shell")).toBeInTheDocument();
    expect(screen.getAllByTestId("vault-open-profile-link")[0]).toHaveAttribute(
      "href",
      `/vaults/${ALPHA_ARKA_ID}`,
    );
    expect(screen.getAllByTestId("vault-open-ops-link")[0]).toHaveAttribute(
      "href",
      `/arkas/${ALPHA_ARKA_ID}`,
    );
    expect(screen.queryByTestId("vault-ops-registry-status")).not.toBeInTheDocument();
  });

  it("filters to curated Arkas without exposing internal registry controls", async () => {
    const user = userEvent.setup();
    installCatalogFetchMock();
    render(<VaultLeaderboardSurface />);

    await screen.findByRole("heading", { name: /arkas leaderboard/i });
    expect(screen.getAllByTestId("vault-leaderboard-card")).toHaveLength(4);
    await user.click(screen.getByTestId("vaults-curated-toggle"));
    await waitFor(() =>
      expect(screen.getAllByTestId("vault-leaderboard-card")).toHaveLength(3),
    );
    expect(screen.queryByTestId("vault-ops-id-input")).not.toBeInTheDocument();
    expect(screen.queryByText(/registry lookup failed/i)).not.toBeInTheDocument();
  });
});
