import {
  createClientOptions,
  expectSimulationResult,
  mergeCallOptions,
  type NetworkConfig,
} from "./clientOptions.js";
import type { CatalogAssetPrice, CatalogOracleStatus } from "./types.js";
import {
  Client as OracleGuardClient,
  type AssetInspection,
  type AssetPolicy,
} from "./generated/oracle-guard.js";

export const ORACLE_GUARD_PRICE_DECIMALS = 14;

export interface OraclePriceReader {
  read(assetContract: string, observedAt: string): Promise<CatalogAssetPrice>;
}

export interface OracleGuardPriceReaderOptions extends NetworkConfig {
  oracleGuardContractId: string;
  oracleDecimals?: number;
}

export class OracleGuardPriceReader implements OraclePriceReader {
  private readonly client: OracleGuardClient;
  private readonly oracleDecimals: number;

  constructor(options: OracleGuardPriceReaderOptions) {
    this.client = new OracleGuardClient(
      createClientOptions(options, options.oracleGuardContractId),
    );
    this.oracleDecimals = options.oracleDecimals ?? ORACLE_GUARD_PRICE_DECIMALS;
  }

  async read(assetContract: string, observedAt: string): Promise<CatalogAssetPrice> {
    const inspectionTx = await this.client.inspect_stellar(
      { asset: assetContract },
      mergeCallOptions(undefined, true),
    );
    const policyTx = await this.client.stellar_asset_policy(
      { asset: assetContract },
      mergeCallOptions(undefined, true),
    );
    const pausedTx = await this.client.stellar_asset_policy_paused(
      { asset: assetContract },
      mergeCallOptions(undefined, true),
    );
    return classifyOracleInspection({
      assetContract,
      inspection: expectSimulationResult(inspectionTx, "inspect_stellar"),
      policy: expectSimulationResult(policyTx, "stellar_asset_policy"),
      paused: expectSimulationResult(pausedTx, "stellar_asset_policy_paused"),
      oracleDecimals: this.oracleDecimals,
      observedAt,
    });
  }
}

export interface OracleInspectionInput {
  assetContract: string;
  inspection: AssetInspection;
  policy: AssetPolicy | null;
  paused: boolean;
  oracleDecimals: number;
  observedAt: string;
}

export function classifyOracleInspection(input: OracleInspectionInput): CatalogAssetPrice {
  const { inspection } = input;
  const price = BigInt(inspection.price);
  const timestamp = BigInt(inspection.timestamp);
  const oracleStatus = classifyStatus(input, price, timestamp);
  return {
    assetContract: input.assetContract.trim().toUpperCase(),
    priceUsd: oracleStatus === "verified" ? price.toString() : null,
    decimals: input.oracleDecimals,
    timestamp: timestamp > 0n ? timestamp.toString() : null,
    oracleStatus,
    valuationSource: oracleStatus === "verified" ? "oracle_verified" : "unavailable",
    primaryUsable: inspection.primary_usable,
    secondaryUsable: inspection.secondary_configured ? inspection.secondary_usable : null,
    unavailableReason: unavailableReason(oracleStatus),
    observedAt: input.observedAt,
  };
}

export function unavailableOraclePrice(
  assetContract: string,
  observedAt: string,
  reason = "oracle_read_failed",
): CatalogAssetPrice {
  return {
    assetContract: assetContract.trim().toUpperCase(),
    priceUsd: null,
    decimals: ORACLE_GUARD_PRICE_DECIMALS,
    timestamp: null,
    oracleStatus: "missing_price",
    valuationSource: "unavailable",
    primaryUsable: null,
    secondaryUsable: null,
    unavailableReason: reason,
    observedAt,
  };
}

export function usdParityPrice(
  assetContract: string,
  observedAt: string,
): CatalogAssetPrice {
  return {
    assetContract: assetContract.trim().toUpperCase(),
    priceUsd: "10000000",
    decimals: 7,
    timestamp: null,
    oracleStatus: "not_required_usd_stablecoin",
    valuationSource: "usd_stablecoin_parity",
    primaryUsable: null,
    secondaryUsable: null,
    unavailableReason: null,
    observedAt,
  };
}

function classifyStatus(
  input: OracleInspectionInput,
  price: bigint,
  timestamp: bigint,
): CatalogOracleStatus {
  if (input.paused) return "policy_paused";
  if (!input.policy) return "missing_price";
  if (price < 0n) return "invalid_price";
  if (price > 0n && timestamp > 0n) return "verified";

  const latestProviderTimestamp = maxBigInt(
    BigInt(input.inspection.primary_timestamp),
    BigInt(input.inspection.secondary_timestamp),
  );
  if (latestProviderTimestamp <= 0n) return "missing_price";

  const observedSeconds = BigInt(Math.floor(Date.parse(input.observedAt) / 1_000));
  const maxAge = BigInt(input.policy.max_price_age);
  if (observedSeconds > latestProviderTimestamp + maxAge) return "stale_price";
  return "invalid_price";
}

function unavailableReason(status: CatalogOracleStatus): string | null {
  switch (status) {
    case "verified":
    case "not_required_usd_stablecoin":
      return null;
    case "policy_paused":
      return "oracle_policy_paused";
    case "stale_price":
      return "oracle_price_stale";
    case "invalid_price":
      return "oracle_price_invalid";
    case "missing_price":
      return "oracle_price_unavailable";
  }
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}
