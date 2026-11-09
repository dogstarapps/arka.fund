import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BarList,
  CatalogOfflineState,
  LoadingState,
  SurfaceLoadStatus,
} from "@/components/product/surfacePrimitives";

afterEach(() => {
  cleanup();
});

describe("surface primitives", () => {
  it("describes product data outages without exposing implementation details", () => {
    render(<CatalogOfflineState testId="catalog-offline" onRetry={vi.fn()} />);

    expect(screen.getByTestId("catalog-offline")).toHaveTextContent(
      "Product data is not available",
    );
    expect(screen.getByTestId("catalog-offline")).toHaveTextContent(
      "could not load current product data",
    );
    expect(screen.getByTestId("catalog-offline")).not.toHaveTextContent(
      "Soroban-backed on-chain catalog fallback",
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open status/i })).toHaveAttribute(
      "href",
      "/status",
    );
  });

  it("renders loading states as real status announcements instead of skeleton placeholders", () => {
    render(
      <>
        <LoadingState
          testId="initial-loading"
          title="Loading catalog"
          body="Resolving indexed data."
        />
        <SurfaceLoadStatus
          testId="refresh-loading"
          title="Refreshing visible data"
          body="Current rows stay visible while the latest query resolves."
        />
      </>,
    );

    expect(screen.getByTestId("initial-loading")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByTestId("initial-loading")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByTestId("refresh-loading")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByTestId("refresh-loading")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByTestId("refresh-loading")).toHaveTextContent(
      "Current rows stay visible",
    );
  });

  it("renders linked bar rows as real navigation controls when href is provided", () => {
    render(
      <BarList
        testId="bars"
        items={[
          {
            id: "asset-1",
            label: "USDC",
            value: "42%",
            meta: "1.2M NAV",
            widthPct: 42,
            href: "/assets/CUSDC",
            ariaLabel: "Open USDC asset",
            testId: "asset-bar-link",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("bars")).toHaveTextContent("USDC");
    expect(screen.getByTestId("asset-bar-link")).toHaveAttribute(
      "href",
      "/assets/CUSDC",
    );
    expect(screen.getByRole("link", { name: "Open USDC asset" })).toBeInTheDocument();
  });
});
