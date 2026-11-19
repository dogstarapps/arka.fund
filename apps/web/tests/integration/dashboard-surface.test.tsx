import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardSurface from "@/components/product/DashboardSurface";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";

function installCatalogFetchMock(options: { noCuratedArkas?: boolean } = {}) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL
          ? input
          : new URL(input.url);
    const pathname = url.pathname.replace("/api/catalog", "");
    const fixtureBody = resolveCatalogFixture(pathname, url.searchParams) as
      | ({ items?: Array<Record<string, unknown>> } & Record<string, unknown>)
      | null;
    const body =
      options.noCuratedArkas && pathname === "/v1/arkas"
        ? {
            ...(fixtureBody ?? {}),
            items:
              fixtureBody && Array.isArray(fixtureBody.items)
                ? fixtureBody.items.map((item) => ({ ...item, curated: false }))
                : [],
          }
        : fixtureBody;
    return new Response(JSON.stringify(body), {
      status: pathname.startsWith("/v1/") ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("DashboardSurface", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("renders one public dashboard layer with real metrics and Arka actions", async () => {
    installCatalogFetchMock();
    window.history.replaceState(null, "", "/dashboard");
    render(<DashboardSurface />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId("dashboard-fidelity-shell")).toHaveClass("public-screen-safe-zone");
    expect(screen.getByTestId("dashboard-arkas-panel")).toHaveClass("public-hero-board-cutover");
    expect(screen.getByTestId("dashboard-figma-metric-deck")).toHaveClass("public-hero-metric-deck-cutover");
    expect(screen.getByTestId("dashboard-figma-metric-nav")).toHaveTextContent("$1.11");
    expect(screen.getByTestId("dashboard-figma-metric-nav")).toHaveTextContent("total value in USD");
    expect(screen.getByTestId("dashboard-figma-metric-managers")).toHaveTextContent("Managers");
    expect(screen.getByTestId("dashboard-figma-metric-assets")).toHaveTextContent("Assets");
    expect(screen.getByTestId("dashboard-figma-metric-activity")).toHaveTextContent("Recent actions");
    expect(screen.getByTestId("dashboard-figma-metric-activity")).toHaveTextContent("wallets involved");
    expect(screen.getByTestId("dashboard-figma-metric-health")).toHaveTextContent("Health");
    expect(screen.getByTestId("dashboard-spotlight-tabs")).toHaveTextContent("Popular Arkas");
    expect(screen.getAllByTestId("dashboard-spotlight-card")).toHaveLength(3);

    const firstCard = screen.getAllByTestId("dashboard-spotlight-card")[0]!;
    expect(within(firstCard).getByText("Assets")).toBeInTheDocument();
    expect(within(firstCard).getAllByText("TVL").length).toBeGreaterThan(0);
    await waitFor(() => expect(firstCard).toHaveTextContent("2 investors"));
    expect(within(firstCard).getByText("Manager")).toBeInTheDocument();
    expect(within(firstCard).getByRole("link", { name: "Open Arka" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/arkas\/C/),
    );
    expect(screen.getByTestId("dashboard-view-all-arkas")).toHaveAttribute("href", "/arkas");
    expect(screen.queryByText(/^n\/a$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current view|linked page|latest arka update/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-stage-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-section-tabs")).not.toBeInTheDocument();
  });

  it("switches featured Arka views and keeps the selection bookmarkable", async () => {
    installCatalogFetchMock();
    window.history.replaceState(null, "", "/dashboard?feature=curated");
    render(<DashboardSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-featured-tab-curated")).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByTestId("dashboard-arkas-table")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dashboard-featured-tab-fresh"));
    expect(screen.getByTestId("dashboard-featured-tab-fresh")).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("feature=fresh");
    fireEvent.click(screen.getByTestId("dashboard-featured-tab-ranked"));
    expect(window.location.search).not.toContain("feature=");
  });

  it("renders honest empty copy when a featured lane has no entries", async () => {
    installCatalogFetchMock({ noCuratedArkas: true });
    render(<DashboardSurface />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("dashboard-featured-tab-curated"));
    expect(screen.queryByTestId("dashboard-arkas-table")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-featured-empty")).toHaveTextContent("No curated Arkas");
    expect(screen.getByTestId("dashboard-featured-empty")).toHaveTextContent("No curated Arkas are available yet");
  });

  it("routes the former My Arkas lane to holdings, not managed funds", async () => {
    installCatalogFetchMock();
    window.localStorage.setItem(
      "wallet:pubkey",
      "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    );
    render(<DashboardSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-featured-tab-mine")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("dashboard-featured-tab-mine"));

    expect(await screen.findByRole('heading', { name: 'My investments' })).toBeInTheDocument();
    expect(screen.getByText('Your holdings in funds, whether or not you manage them.')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-arkas-table')).not.toBeInTheDocument();
  });

  it("uses user-facing recovery copy for catalog configuration failures", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          error: "catalog_not_configured",
          message: "Set CATALOG_API_BASE_URL or NEXT_PUBLIC_CATALOG_API_BASE_URL.",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );
    render(<DashboardSurface />);
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-catalog-offline")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("dashboard-catalog-offline")).toHaveTextContent("Dashboard data is not available");
    expect(screen.getByTestId("dashboard-catalog-offline")).toHaveTextContent("could not be loaded right now");
    expect(screen.getByTestId("dashboard-catalog-offline")).not.toHaveTextContent("CATALOG_API_BASE_URL");
  });
});
