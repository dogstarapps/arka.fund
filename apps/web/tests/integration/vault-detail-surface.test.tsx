import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import VaultDetailSurface from "@/components/product/VaultDetailSurface";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: vi.fn(() => ({
    getAddress: vi.fn(async () => ({ address: "GMANAGERTEST" })),
    signMessage: vi.fn(async () => ({ signedMessage: "signed-message" })),
  })),
  connectWallet: vi.fn(async () => "GMANAGERTEST"),
  signMessageWithWallet: vi.fn(async () => "signed-message"),
}));

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
    const status = typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

const ARKA_ID = "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";

describe("VaultDetailSurface", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the public profile and switches across portfolio, activity and policies", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    render(<VaultDetailSurface arkaId={ARKA_ID} />);

    await waitFor(() => expect(screen.getByTestId("vault-detail-hero")).toBeInTheDocument());
    expect(screen.getByTestId("vault-detail-hero")).toHaveTextContent("CA7ALPHA");
    expect(screen.getByRole("link", { name: "Deposit or withdraw" })).toHaveAttribute(
      "href",
      `/arkas/${ARKA_ID}?workspace=flow`,
    );
    expect(screen.getByRole("link", { name: "Manage fund assets" })).toHaveAttribute("href", `/arkas/${ARKA_ID}?workspace=rebalance`);
    expect(screen.getByRole("link", { name: "Back to discover" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.getByTestId("vault-detail-public-metric-deck")).toHaveClass(
      "public-detail-metric-deck-cutover",
    );
    expect(screen.getByTestId("vault-detail-nav")).toHaveTextContent("$");
    expect(screen.getByTestId("vault-detail-trend")).toHaveTextContent("+4.41%");
    expect(screen.getByTestId("vault-detail-fees")).toHaveTextContent(
      "Management 2.00% · Performance 12.00%",
    );
    expect(screen.getByTestId("vault-detail-metric-activity")).toHaveTextContent(
      "4 of 4 recent actions confirmed",
    );
    expect(screen.getByTestId("vault-edit-profile")).toBeInTheDocument();
    expect(screen.queryByTestId("vault-detail-command-deck")).not.toBeInTheDocument();

    expect(screen.getByTestId("vault-overview-tab")).toHaveClass("public-detail-tab-panel-cutover");
    expect(screen.getByTestId("vault-history-panel")).toHaveTextContent("Value over time");
    expect(screen.getByTestId("vault-profile-table")).toHaveTextContent("Denomination");
    expect(screen.getByTestId("vault-profile-table")).toHaveTextContent("primary accounting asset");

    await user.click(screen.getByRole("button", { name: "Portfolio" }));
    expect(screen.getByTestId("vault-portfolio-tab")).toHaveClass("public-detail-tab-panel-cutover");
    expect(screen.getByTestId("vault-portfolio-panel")).toHaveTextContent("Current value contribution by asset");
    expect(screen.getByTestId("vault-assets-table")).toHaveTextContent("value contribution");
    expect(screen.getByTestId("vault-assets-table")).not.toHaveTextContent("base units");

    await user.click(screen.getByRole("button", { name: "Activity" }));
    expect(screen.getByTestId("vault-activity-tab")).toHaveClass("public-detail-tab-panel-cutover");
    expect(screen.getByTestId("vault-activity-summary-panel")).toHaveTextContent("Activity mix");
    expect(screen.getByTestId("vault-activity-table")).toHaveTextContent("deposit");
    expect(screen.getAllByTestId("vault-activity-card").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Policies" }));
    expect(screen.getByTestId("vault-policies-tab")).toHaveClass("public-detail-tab-panel-cutover");
    expect(screen.getByTestId("vault-policies-table")).toHaveTextContent("Management fee");
    expect(screen.getByTestId("vault-policies-table")).toHaveTextContent("2%");
    expect(screen.getByTestId("vault-whitelist-table")).toHaveTextContent("Included in the Arka mandate");
    expect(screen.getByTestId("vault-whitelist-table")).not.toHaveTextContent("BPS");
  });
});
