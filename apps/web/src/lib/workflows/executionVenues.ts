import { NETWORK_PASSPHRASE } from '@/lib/config';
import { protocolVenueAllowed, venueStatusLabel, type ProtocolId, type VenueSnapshot } from './protocolLifecycle';
import type { BalancedProtocolHealthPayload } from "@/lib/runtime/appHealth";
import type {
  IntegrationHealth,
  SurfaceStatusTone,
} from "@/lib/workflows/productFlows";
import {
  buildBalancedIntentExecutionDriver,
  formatIntentExecutionDriverExecutionCapabilityLabel,
  formatIntentExecutionDriverQuoteCapabilityLabel,
} from "@/lib/workflows/intentExecutionDrivers";

export type ExecutionVenueId =
  | "SOROSWAP"
  | "AQUARIUS"
  | "PHOENIX"
  | "SUSHI"
  | "BALANCED"
  | "BLEND"
  | "SPLIT_ROUTE";
export type ExecutionVenueFamily =
  | "amm_router"
  | "intent_execution"
  | "credit_market";
export type ExecutionVenueQuoteModel =
  | "live_router_quote"
  | "public_intent_quote"
  | "public_quote_surface_manual_execution"
  | "manual_lane"
  | "intent_surface_unverified"
  | "not_applicable";
export type ExecutionVenueSettlementModel =
  | "onchain_router"
  | "onchain_adapter"
  | "intent_settlement"
  | "credit_position";
export type ExecutionVenuePathModel =
  | "router_direct"
  | "router_multi_hop"
  | "adapter_gated"
  | "credit_command";
export type ExecutionVenueConfirmationModel =
  | "transaction_hash"
  | "transaction_hash_plus_refresh";
export type ExecutionVenuePlannerAdmission =
  | "auto"
  | "manual_only"
  | "blocked";

export interface ExecutionVenueDescriptor {
  id: ExecutionVenueId;
  title: string;
  family: ExecutionVenueFamily;
  quoteModel: ExecutionVenueQuoteModel;
  settlementModel: ExecutionVenueSettlementModel;
  pathModel: ExecutionVenuePathModel;
  confirmationModel: ExecutionVenueConfirmationModel;
  autoRoutingEligible: boolean;
  manualExecutionEligible: boolean;
  plannerAdmission: ExecutionVenuePlannerAdmission;
  comparableQuote: boolean;
  statusLabel: string;
  statusTone: SurfaceStatusTone;
  summary: string;
  detail: string;
  confirmationDetail: string;
  capabilityDetail: string;
}

export function formatExecutionVenueFamilyLabel(
  family: ExecutionVenueFamily,
): string {
  if (family === "amm_router") return "AMM router";
  if (family === "credit_market") return "Credit market";
  return "Intent route";
}

export function formatExecutionVenueQuoteModelLabel(
  model: ExecutionVenueQuoteModel,
): string {
  if (model === "live_router_quote") return "Live router quote";
  if (model === "public_intent_quote") return "Public intent quote";
  if (model === "public_quote_surface_manual_execution") {
    return "Public quote surface";
  }
  if (model === "manual_lane") return "Manual action";
  if (model === "not_applicable") return "Not applicable";
  return "Intent route";
}

export function formatExecutionVenueSettlementModelLabel(
  model: ExecutionVenueSettlementModel,
): string {
  if (model === "onchain_router") return "On-chain router";
  if (model === "onchain_adapter") return "Arka-routed";
  if (model === "credit_position") return "Credit position";
  return "Intent settlement";
}

export function formatExecutionVenuePathModelLabel(
  model: ExecutionVenuePathModel,
): string {
  if (model === "router_direct") return "Router-direct";
  if (model === "router_multi_hop") return "Router multi-hop";
  if (model === "credit_command") return "Credit command";
  return "Arka-routed";
}

export function formatExecutionVenueConfirmationModelLabel(
  model: ExecutionVenueConfirmationModel,
): string {
  if (model === "transaction_hash_plus_refresh") {
    return "Transaction hash + refreshed state";
  }
  return "Transaction hash";
}

export function formatExecutionVenuePlannerAdmissionLabel(
  admission: ExecutionVenuePlannerAdmission,
): string {
  if (admission === "auto") return "AUTO";
  if (admission === "manual_only") return "Manual only";
  return "Not ready";
}

function buildAmmVenueDescriptor(input: {
  id: "SOROSWAP" | "AQUARIUS" | "PHOENIX" | "SUSHI";
  title: string;
  health: IntegrationHealth;
  plannerReady?: boolean;
  plannerDetail?: string;
  adapterDetail?: string;
  detail: string;
  settlementModel?: ExecutionVenueSettlementModel;
  pathModel?: ExecutionVenuePathModel;
}): ExecutionVenueDescriptor {
  const plannerReady = input.plannerReady ?? input.health.matched;
  const adapterReady = input.health.matched;
  const admitted = plannerReady && adapterReady;
  const statusLabel = admitted
    ? input.health.label
    : plannerReady
      ? "Route not ready"
      : adapterReady
        ? "Quote not ready"
        : input.health.label;
  const statusTone: SurfaceStatusTone = admitted
    ? input.health.tone
    : plannerReady || adapterReady
      ? "warning"
      : input.health.tone;
  const detail = admitted
    ? input.detail
    : plannerReady
      ? `${input.title} has a live comparable quote, but the Arka adapter is not ready yet. ${input.adapterDetail ?? "Review the adapter before admitting it to AUTO."}`
      : adapterReady
        ? `${input.title} adapter is visible, but the planner could not obtain a live comparable quote for the configured asset pair. ${input.plannerDetail ?? "Keep it out of AUTO until quote discovery succeeds."}`
        : `${input.detail} ${input.adapterDetail ?? "Adapter health is unavailable."} ${input.plannerDetail ?? "Quote discovery is unavailable."}`;

  return {
    id: input.id,
    title: input.title,
    family: "amm_router",
    quoteModel: "live_router_quote",
    settlementModel: input.settlementModel ?? "onchain_router",
    pathModel: input.pathModel ?? "router_direct",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: admitted,
    manualExecutionEligible: admitted,
    plannerAdmission: admitted ? "auto" : "blocked",
    comparableQuote: plannerReady,
    statusLabel,
    statusTone,
    summary: `${input.title} is a live AMM router venue.`,
    detail,
    confirmationDetail:
      "Execution is confirmed from the submitted transaction hash and the refreshed vault balances.",
    capabilityDetail: admitted
      ? "Comparable live quotes and the common adapter router() health check are both green, so this venue can participate directly in best execution."
      : plannerReady
        ? "Comparable live quotes are available, but AUTO stays pending until the adapter exposes the configured router."
        : "AUTO stays pending until the planner can obtain a live comparable quote and the adapter exposes the configured router.",
  };
}

function buildBlendVenueDescriptor(
  health: IntegrationHealth,
): ExecutionVenueDescriptor {
  return {
    id: "BLEND",
    title: "Blend",
    family: "credit_market",
    quoteModel: "not_applicable",
    settlementModel: "credit_position",
    pathModel: "credit_command",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: false,
    manualExecutionEligible: health.matched,
    plannerAdmission: health.matched ? "manual_only" : "blocked",
    comparableQuote: false,
    statusLabel: health.label,
    statusTone: health.tone,
    summary: "Blend is a credit venue, not a swap router.",
    detail:
      "Blend remains outside best execution for swaps. It stays available for supply, borrow, repay and withdraw flows.",
    confirmationDetail:
      "Execution is confirmed from the transaction hash and the refreshed credit position state.",
    capabilityDetail:
      "Blend stays available for credit actions only. It does not expose a comparable swap quote surface for best execution.",
  };
}

function buildBalancedVenueDescriptor(
  support: BalancedProtocolHealthPayload,
): ExecutionVenueDescriptor {
  const driver = buildBalancedIntentExecutionDriver(support);
  const ready = driver.manualExecutionEligible;
  const blockedReason =
    driver.plannerDetail ||
    support.blockingReasons[0] ||
    (support.supportStatus === "inactive"
      ? "Balanced is inactive in the current deployment."
      : "Balanced/SODAX is waiting for production readiness.");

  return {
    id: "BALANCED",
    title: "Balanced",
    family: "intent_execution",
    quoteModel:
      driver.quoteCapability === "comparable_public_quote"
        ? "public_intent_quote"
        : support.officialSurface.intentAdapter.publicQuoteEndpoint
          ? "public_quote_surface_manual_execution"
        : ready
          ? "manual_lane"
          : "intent_surface_unverified",
    settlementModel: "intent_settlement",
    pathModel: "adapter_gated",
    confirmationModel: "transaction_hash_plus_refresh",
    autoRoutingEligible: driver.plannerAdmission === "auto",
    manualExecutionEligible: ready,
    plannerAdmission: driver.plannerAdmission,
    comparableQuote: driver.comparableQuote,
    statusLabel:
      support.supportStatus === "ready"
        ? support.validatedModule.present
          ? "Ready"
          : "Review required"
        : support.supportStatus === "inactive"
          ? "Inactive"
          : "Not ready",
    statusTone:
      support.supportStatus === "ready"
        ? support.validatedModule.present
          ? "positive"
          : "warning"
        : support.supportStatus === "inactive"
          ? "neutral"
          : "warning",
    summary: ready
      ? "Balanced is available as a SODAX intent route."
      : "Balanced is not available for live execution yet.",
    detail: ready
      ? support.officialSurface.intentAdapter.publicQuoteEndpoint
        ? "Balanced uses SODAX Intents. Arka can read quote and status data, while AUTO waits for execution status to match the other routes."
        : "Balanced uses SODAX Intents, so AUTO waits until comparable quote and status data are available."
      : blockedReason,
    confirmationDetail:
      "Confirmation uses the submitted transaction hash plus refreshed post-trade state. Intent receipts must be available before AUTO can use this route.",
    capabilityDetail: `${driver.source.detail} ${driver.summary} ${driver.plannerDetail} Quote: ${formatIntentExecutionDriverQuoteCapabilityLabel(driver.quoteCapability)}. Execute: ${formatIntentExecutionDriverExecutionCapabilityLabel(driver.executionCapability)}.`,
  };
}

export function buildExecutionVenueCatalog(input: {
  balancedSupport: BalancedProtocolHealthPayload;
  aquariusHealth: IntegrationHealth;
  phoenixHealth?: IntegrationHealth;
  sushiHealth?: IntegrationHealth;
  sushiPlannerReady?: boolean;
  sushiPlannerDetail?: string;
  sushiAdapterDetail?: string;
  venueStates?: Partial<Record<ProtocolId, VenueSnapshot>>;
  soroswapHealth: IntegrationHealth;
  blendHealth: IntegrationHealth;
  aquariusPlannerReady?: boolean;
  phoenixPlannerReady?: boolean;
  soroswapPlannerReady?: boolean;
  aquariusPlannerDetail?: string;
  phoenixPlannerDetail?: string;
  soroswapPlannerDetail?: string;
  aquariusAdapterDetail?: string;
  phoenixAdapterDetail?: string;
  soroswapAdapterDetail?: string;
}): ExecutionVenueDescriptor[] {
  const sushiHealth =
    input.sushiHealth ?? {
      matched: false,
      label: "Blocked",
      tone: "warning" as SurfaceStatusTone,
    };
  const catalog = [
    buildBalancedVenueDescriptor(input.balancedSupport),
    buildBlendVenueDescriptor(input.blendHealth),
    buildAmmVenueDescriptor({
      id: "SOROSWAP",
      title: "SoroSwap",
      health: input.soroswapHealth,
      plannerReady: input.soroswapPlannerReady,
      plannerDetail: input.soroswapPlannerDetail,
      adapterDetail: input.soroswapAdapterDetail,
      detail:
        "SoroSwap stays in the competitive routing set with live quotes, direct paths and multi-hop planning.",
    }),
    buildAmmVenueDescriptor({
      id: "AQUARIUS",
      title: "Aquarius",
      health: input.aquariusHealth,
      plannerReady: input.aquariusPlannerReady,
      plannerDetail: input.aquariusPlannerDetail,
      adapterDetail: input.aquariusAdapterDetail,
      detail:
        "Aquarius stays in the competitive routing set as a direct AMM route backed by its configured pool index.",
    }),
    buildAmmVenueDescriptor({
      id: "SUSHI",
      title: "Sushi",
      health: sushiHealth,
      plannerReady: input.sushiPlannerReady,
      plannerDetail: input.sushiPlannerDetail,
      adapterDetail: input.sushiAdapterDetail,
      settlementModel: "onchain_adapter",
      pathModel: "adapter_gated",
      detail:
        "Sushi uses a pinned Stellar V3 pool route with a live exact-input quote.",
    }),
  ];
  return catalog.map(venue=>{
    const protocol=venue.id as ProtocolId,state=input.venueStates?.[protocol];
    const manual=protocolVenueAllowed(protocol,state,protocol==='BLEND'?'supply':'manual_swap',NETWORK_PASSPHRASE);
    const auto=protocolVenueAllowed(protocol,state,'auto_swap',NETWORK_PASSPHRASE);
    return {...venue,manualExecutionEligible:venue.manualExecutionEligible&&manual,autoRoutingEligible:venue.autoRoutingEligible&&auto,
      plannerAdmission:venue.autoRoutingEligible&&auto?'auto':venue.manualExecutionEligible&&manual?'manual_only':'blocked',
      statusLabel:!manual?venueStatusLabel(state?.status):venue.statusLabel,
      statusTone:!manual?'warning':venue.statusTone,
      capabilityDetail:!manual?'Verified protocol permissions are required before new exposure. Existing holdings remain visible.':venue.capabilityDetail};
  });
}
