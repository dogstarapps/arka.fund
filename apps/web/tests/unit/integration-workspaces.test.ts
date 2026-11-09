import { describe, expect, it } from "vitest";
import {
  buildIntegrationProtocolCatalogCards,
  buildIntegrationProtocolCommandDeck,
  buildIntegrationPublicMetricDeck,
  buildIntegrationSurfaceAccessModel,
  buildIntegrationWorkspaceSignals,
  buildIntegrationWorkspaceState,
  INTEGRATION_WORKSPACE_TABS,
  isIntegrationOperatorSurface,
  resolveIntegrationWorkspaceId,
  type IntegrationWorkspaceId,
  type IntegrationWorkspaceSnapshot,
} from "@/lib/workflows/integrationWorkspaces";
import type { ExecutionVenueDescriptor } from "@/lib/workflows/executionVenues";

const SNAPSHOT: IntegrationWorkspaceSnapshot = {
  walletLabel: "GCFLOW...4WX",
  canAct: true,
  loadedRoutes: 4,
  totalRoutes: 5,
  balancedLabel: "Blocked",
  balancedTone: "warning",
  aquariusLabel: "Healthy",
  aquariusTone: "positive",
  soroswapLabel: "Healthy",
  soroswapTone: "positive",
  sushiLabel: "Healthy",
  sushiTone: "positive",
  blendLabel: "Healthy",
  blendTone: "positive",
  balancedIntentTokensLoaded: 3,
  balancedQuoteReason: "Ready to request the official SODAX quote.",
  balancedStatusReason: "Ready to request status.",
  balancedConfirmationReason: "Ready to check confirmation.",
  balancedDriverSummary: "Source verified · Quote public · Execute manual",
  balancedLaneReady: false,
  balancedLaneDetail: "Balanced is blocked by the current environment.",
  mainnetGateReady: false,
  mainnetGateDetail: "Target deployments manifest missing.",
  blendAction: "Borrow",
  blendAmount: "0.0001",
  executionReceiptReady: false,
};

const VENUES: ExecutionVenueDescriptor[] = [
  {
    id: "BALANCED",
    title: "Balanced",
    family: "intent_execution",
    quoteModel: "public_quote_surface_manual_execution",
    settlementModel: "intent_settlement",
    pathModel: "adapter_gated",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: false,
    manualExecutionEligible: false,
    plannerAdmission: "blocked",
    comparableQuote: false,
    statusLabel: "Blocked",
    statusTone: "warning",
    summary: "Balanced is not admitted yet.",
    detail: "Balanced waits for a complete public quote/status/confirm lane.",
    confirmationDetail: "Adapter transaction hash plus refreshed state.",
    capabilityDetail: "Official intent source is incomplete.",
  },
  {
    id: "BLEND",
    title: "Blend",
    family: "credit_market",
    quoteModel: "not_applicable",
    settlementModel: "credit_position",
    pathModel: "credit_command",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: false,
    manualExecutionEligible: true,
    plannerAdmission: "manual_only",
    comparableQuote: false,
    statusLabel: "Healthy",
    statusTone: "positive",
    summary: "Blend credit is available.",
    detail: "Blend stays available as a direct credit command lane.",
    confirmationDetail: "Transaction hash plus refreshed credit state.",
    capabilityDetail: "Credit market, not a swap venue.",
  },
  {
    id: "SOROSWAP",
    title: "SoroSwap",
    family: "amm_router",
    quoteModel: "live_router_quote",
    settlementModel: "onchain_router",
    pathModel: "router_multi_hop",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: true,
    manualExecutionEligible: true,
    plannerAdmission: "auto",
    comparableQuote: true,
    statusLabel: "Healthy",
    statusTone: "positive",
    summary: "SoroSwap AMM is available.",
    detail: "SoroSwap supports multi-hop routing.",
    confirmationDetail: "Transaction hash plus refreshed vault state.",
    capabilityDetail: "Comparable router quote.",
  },
  {
    id: "AQUARIUS",
    title: "Aquarius",
    family: "amm_router",
    quoteModel: "live_router_quote",
    settlementModel: "onchain_router",
    pathModel: "router_direct",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: true,
    manualExecutionEligible: true,
    plannerAdmission: "auto",
    comparableQuote: true,
    statusLabel: "Healthy",
    statusTone: "positive",
    summary: "Aquarius AMM is available.",
    detail: "Aquarius supports direct routing.",
    confirmationDetail: "Transaction hash plus refreshed vault state.",
    capabilityDetail: "Comparable router quote.",
  },
  {
    id: "SUSHI",
    title: "Sushi",
    family: "amm_router",
    quoteModel: "live_router_quote",
    settlementModel: "onchain_adapter",
    pathModel: "adapter_gated",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: true,
    manualExecutionEligible: true,
    plannerAdmission: "auto",
    comparableQuote: true,
    statusLabel: "Healthy",
    statusTone: "positive",
    summary: "Sushi pool is available.",
    detail: "Sushi supports governed direct pool routing.",
    confirmationDetail: "Transaction hash plus refreshed vault state.",
    capabilityDetail: "Comparable pool quote.",
  },
];

describe("integration workspaces", () => {
  it("declares a hard public/operator access split for the Integrations surface", () => {
    const publicModel = buildIntegrationSurfaceAccessModel("public");
    const operatorModel = buildIntegrationSurfaceAccessModel("operator");

    expect(publicModel.publicRoute).toBe("/integrations");
    expect(publicModel.operatorRoute).toBe("/integrations/operator");
    expect(publicModel.publicSections).toEqual(["catalog", "metrics"]);
    expect(publicModel.operatorOnlyTestIds).toEqual(
      expect.arrayContaining([
        "integrations-workspace-tabs",
        "integrations-routing-table",
        "integrations-balanced-intent-surface-panel",
        "integrations-actions-panel",
      ]),
    );
    expect(publicModel.publicSummary).toMatch(/swap assets or manage a lending position/i);
    expect(operatorModel.operatorSummary).toMatch(/quote, status, confirmation/i);
    expect(isIntegrationOperatorSurface("public")).toBe(false);
    expect(isIntegrationOperatorSurface("operator")).toBe(true);
  });

  it("declares the operator workspaces without duplicating the whole console", () => {
    expect(INTEGRATION_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      "routing",
      "sodax",
      "execution",
      "actions",
    ]);
    expect(resolveIntegrationWorkspaceId("actions")).toBe("actions");
    expect(resolveIntegrationWorkspaceId("unknown")).toBe("routing");
  });

  it.each<IntegrationWorkspaceId>(["routing", "sodax", "execution", "actions"])(
    "builds labelled signals for %s",
    (workspace) => {
      const state = buildIntegrationWorkspaceState(SNAPSHOT, workspace);

      expect(state.tab.id).toBe(workspace);
      expect(state.signals.length).toBeGreaterThanOrEqual(3);
      expect(
        state.signals.every((signal) => signal.label && signal.value),
      ).toBe(true);
    },
  );

  it("keeps routing signals tied to observed adapter health", () => {
    const signals = buildIntegrationWorkspaceSignals(SNAPSHOT, "routing");

    expect(signals).toContainEqual(
      expect.objectContaining({
        id: "routes-loaded",
        value: "4/5",
        tone: "warning",
      }),
    );
    expect(signals).toContainEqual(
      expect.objectContaining({
        id: "balanced",
        value: "Not ready",
        tone: "warning",
      }),
    );
  });

  it("keeps SODAX readiness tied to catalog and public quote state", () => {
    const signals = buildIntegrationWorkspaceSignals(SNAPSHOT, "sodax");

    expect(signals[0]).toMatchObject({
      id: "catalog",
      value: "3 loaded",
      tone: "positive",
    });
    expect(signals[1]).toMatchObject({
      id: "quote",
      tone: "positive",
    });
  });

  it("does not mark sensitive action lanes ready when gates are blocked", () => {
    const signals = buildIntegrationWorkspaceSignals(SNAPSHOT, "actions");

    expect(signals).toContainEqual(
      expect.objectContaining({
        id: "balanced-lane",
        value: "Review",
        tone: "warning",
      }),
    );
    expect(signals).toContainEqual(
      expect.objectContaining({
        id: "mainnet-gate",
        value: "Review",
        tone: "warning",
      }),
    );
  });

  it("builds a protocol command deck with truthful destinations and no inert actions", () => {
    const commands = buildIntegrationProtocolCommandDeck({
      venues: VENUES,
      loadedRoutes: 4,
      totalRoutes: 5,
      walletLabel: "GCFLOW...4WX",
    });

    expect(commands.map((command) => command.id)).toEqual([
      "balanced",
      "amm",
      "blend",
      "checks",
    ]);
    expect(commands.find((command) => command.id === "balanced")).toMatchObject({
      workspace: "sodax",
      value: "Not ready",
      ctaLabel: "Inspect SODAX",
    });
    expect(commands.find((command) => command.id === "amm")).toMatchObject({
      href: "/arkas",
      value: "3/3 AUTO",
      ctaLabel: "Open Arka actions",
    });
    expect(commands.find((command) => command.id === "checks")).toMatchObject({
      workspace: "execution",
      value: "4/5",
      tone: "warning",
    });
    expect(commands.map((command) => command.detail).join(" ")).not.toMatch(
      /\b(fake|stub|placeholder|not implemented)\b/i,
    );
  });

  it("builds navigable protocol catalog cards from execution venues", () => {
    const cards = buildIntegrationProtocolCatalogCards(VENUES);
    const byId = new Map(cards.map((card) => [card.id, card]));

    expect(cards.map((card) => card.id)).toEqual([
      "BLEND",
      "SOROSWAP",
      "AQUARIUS",
      "SUSHI",
      "BALANCED",
    ]);
    expect(byId.get("SOROSWAP")).toMatchObject({
      href: "/manage",
      ctaLabel: "Choose a fund to manage",
      postureLabel: "Auto comparison",
      statusTone: "positive",
    });
    expect(byId.get("AQUARIUS")).toMatchObject({
      href: "/manage",
      ctaLabel: "Choose a fund to manage",
      postureLabel: "Auto comparison",
    });
    expect(byId.get("SUSHI")).toMatchObject({
      href: "/manage",
      ctaLabel: "Choose a fund to manage",
      postureLabel: "Auto comparison",
      statusTone: "positive",
    });
    expect(byId.get("BALANCED")).toMatchObject({
      workspace: "routing",
      ctaLabel: "Choose a fund to manage",
      postureLabel: "Unavailable",
      statusTone: "warning",
    });
    expect(byId.get("BLEND")).toMatchObject({
      workspace: "actions",
      ctaLabel: "Choose a fund to manage",
      postureLabel: "Manager review",
    });
    expect(JSON.stringify(cards)).not.toMatch(
      /\b(fake|stub|placeholder|not implemented|undefined|NaN)\b/i,
    );
  });

  it("builds public integration metric cards from runtime snapshot and venue admission", () => {
    const tiles = buildIntegrationPublicMetricDeck({
      snapshot: SNAPSHOT,
      venues: VENUES,
    });
    const byId = new Map(tiles.map((tile) => [tile.id, tile]));

    expect(tiles.map((tile) => tile.id)).toEqual([
      "routes",
      "auto",
      "sodax",
      "wallet",
      "balanced",
      "mainnet",
    ]);
    expect(byId.get("routes")).toMatchObject({
      label: "Protocol coverage",
      value: "4/5",
      tone: "warning",
    });
    expect(byId.get("auto")).toMatchObject({
      label: "AUTO venues",
      value: "3/5",
      tone: "positive",
    });
    expect(byId.get("sodax")).toMatchObject({
      value: "3 tokens",
      tone: "positive",
    });
    expect(byId.get("wallet")).toMatchObject({
      value: "GCFLOW...4WX",
      tone: "positive",
    });
    expect(byId.get("balanced")).toMatchObject({
      label: "Balanced / SODAX",
      value: "Review",
      tone: "warning",
    });
    expect(byId.get("mainnet")).toMatchObject({
      label: "Mainnet readiness",
      value: "Review",
    });
    expect(byId.get("mainnet")?.detail).toContain(
      "4/5 venues have execution posture",
    );
    expect(JSON.stringify(tiles)).not.toMatch(
      /\b(fake|stub|placeholder|not implemented|undefined|NaN)\b/i,
    );
  });
});
