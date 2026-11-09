import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiscoverSurface from "@/components/product/DiscoverSurface";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";

function installCatalogFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL
          ? input
          : new URL(input.url);
    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    return new Response(JSON.stringify(body), {
      status: pathname.startsWith("/v1/") ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("DiscoverSurface", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("renders a focused public discovery board and filters real Arka cards", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    render(<DiscoverSurface />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^discover$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId("discover-fidelity-shell")).toHaveClass("public-screen-safe-zone");
    expect(screen.getByTestId("discover-command-board")).toHaveClass("public-hero-board-cutover");
    expect(screen.getByTestId("discover-public-metric-board")).toHaveClass("public-hero-metric-lane-cutover");
    expect(screen.getByTestId("discover-summary-grid")).toHaveClass("public-hero-metric-deck-cutover");
    expect(screen.getByTestId("discover-public-collection-board")).toHaveClass("public-hero-collection-lane-cutover");
    expect(screen.getByTestId("discover-figma-preview-grid")).toHaveClass("public-hero-card-grid-cutover");
    expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(3);
    expect(screen.getByTestId("discover-stage-metric-nav")).toHaveTextContent("TVL");
    expect(screen.getByTestId("discover-stage-metric-nav")).not.toHaveTextContent("base units");
    expect(screen.getByTestId("discover-stage-metric-managers")).toHaveTextContent("Managers");
    expect(screen.getByTestId("discover-stage-metric-assets")).toHaveTextContent("Assets");

    const firstCard = screen.getAllByTestId("discover-figma-preview-card")[0]!;
    expect(within(firstCard).getByText("Assets")).toBeInTheDocument();
    expect(within(firstCard).getByText("Manager")).toBeInTheDocument();
    expect(within(firstCard).getByText("Updated")).toBeInTheDocument();
    expect(within(firstCard).getByRole("link", { name: "Open profile" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/vaults\/C/),
    );
    expect(screen.queryByTestId("discover-section-command-deck")).not.toBeInTheDocument();
    expect(screen.queryByTestId("discover-arkas-table")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("discover-market-popular"));
    await user.click(screen.getByTestId("discover-feature-tab-profit"));
    expect(screen.getByTestId("discover-feature-tab-profit")).toHaveAttribute("aria-pressed", "true");

    await user.type(screen.getByTestId("discover-search-input"), "gamma");
    await waitFor(() =>
      expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(1),
    );
    expect(screen.getByTestId("discover-figma-preview-grid")).toHaveTextContent("CA7GAMMAQF");
    expect(window.location.search).toContain("q=gamma");
  });

  it("restores public filters from the URL without dropping search focus", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/discover?q=gamma&curated=0&feature=search");
    render(<DiscoverSurface />);

    const searchInput = await screen.findByTestId("discover-search-input");
    await waitFor(() => expect(searchInput).toHaveValue("gamma"));
    expect(screen.getByTestId("discover-feature-tab-search")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("discover-curated-toggle")).not.toBeChecked();

    await user.click(searchInput);
    await user.type(searchInput, "x");
    expect(searchInput).toHaveFocus();
    expect(window.location.search).toContain("q=gammax");
    expect(new URLSearchParams(window.location.search).has("curated")).toBe(false);
  });

  it("keeps current cards visible while a search refresh is in flight", async () => {
    const pendingResolvers: Array<() => void> = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? new URL(input, "http://localhost")
          : input instanceof URL
            ? input
            : new URL(input.url);
      const pathname = url.pathname.replace("/api/catalog", "");
      const body = resolveCatalogFixture(pathname, url.searchParams);
      if (url.searchParams.get("search") === "gamma") {
        await new Promise<void>((resolve) => pendingResolvers.push(resolve));
      }
      return new Response(JSON.stringify(body), {
        status: pathname.startsWith("/v1/") ? 200 : 404,
        headers: { "content-type": "application/json" },
      });
    });
    render(<DiscoverSurface />);

    await waitFor(() =>
      expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(3),
    );
    fireEvent.change(screen.getByTestId("discover-search-input"), {
      target: { value: "gamma" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("discover-refresh-status")).toHaveTextContent("Refreshing visible data"),
    );
    expect(screen.getByTestId("discover-fidelity-shell")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(3);

    pendingResolvers.splice(0).forEach((resolve) => resolve());
    await waitFor(() =>
      expect(screen.queryByTestId("discover-refresh-status")).not.toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(1);
    expect(screen.getByTestId("discover-figma-preview-grid")).toHaveTextContent("CA7GAMMAQF");
  });

  it("routes configuration failures to user-facing recovery copy", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ error: "catalog_not_configured", message: "Catalog API base URL is not configured." }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );
    render(<DiscoverSurface />);

    await waitFor(() => expect(screen.getByTestId("discover-catalog-offline")).toBeInTheDocument());
    expect(screen.getByTestId("discover-catalog-offline")).toHaveTextContent("Discovery data is not available");
    expect(screen.getByTestId("discover-catalog-offline")).toHaveTextContent("could not be loaded right now");
    expect(screen.getByTestId("discover-catalog-offline")).not.toHaveTextContent("base URL");
  });
});
