import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyOracleInspection,
  multiplyByOraclePrice,
  resolveAssetIdentity,
  usdParityPrice,
  type ArkaCatalogEntry,
  buildSnapshot,
} from "../../src/index.js";
import type {
  AssetInspection,
  AssetPolicy,
} from "../../src/generated/oracle-guard.js";

const XLM = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const USDC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const OBSERVED_AT = "2026-07-19T12:00:00.000Z";

const policy: AssetPolicy = {
  divergence_mode: 0,
  has_secondary: true,
  max_deviation_bps: 300,
  max_price_age: 900n,
  primary: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  require_secondary: true,
  secondary: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
};

function inspection(overrides: Partial<AssetInspection> = {}): AssetInspection {
  const timestamp = BigInt(Math.floor(Date.parse(OBSERVED_AT) / 1_000) - 30);
  return {
    deviation_bps: 20,
    diverged: false,
    price: 19_079_182_705_615n,
    primary_price: 19_080_000_000_000n,
    primary_timestamp: timestamp,
    primary_usable: true,
    secondary_configured: true,
    secondary_price: 19_078_000_000_000n,
    secondary_timestamp: timestamp,
    secondary_usable: true,
    selected_source: 1,
    timestamp,
    ...overrides,
  };
}

function arka(denominationContract: string, nav: string): ArkaCatalogEntry {
  return {
    arkaId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    manager: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    curated: true,
    delisted: false,
    nav,
    denominationContract,
    whitelistContracts: [denominationContract],
    shareToken: null,
    fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
    assets: [],
    syncedAt: OBSERVED_AT,
  };
}

test("classifyOracleInspection preserves a verified OracleGuard price", () => {
  const result = classifyOracleInspection({
    assetContract: XLM,
    inspection: inspection(),
    policy,
    paused: false,
    oracleDecimals: 14,
    observedAt: OBSERVED_AT,
  });
  assert.equal(result.oracleStatus, "verified");
  assert.equal(result.priceUsd, "19079182705615");
  assert.equal(result.decimals, 14);
  assert.equal(result.unavailableReason, null);
});

test("classifyOracleInspection distinguishes paused, stale, and missing prices", () => {
  const staleTimestamp = BigInt(Math.floor(Date.parse(OBSERVED_AT) / 1_000) - 1_000);
  const stale = classifyOracleInspection({
    assetContract: XLM,
    inspection: inspection({
      price: 0n,
      timestamp: 0n,
      primary_timestamp: staleTimestamp,
      secondary_timestamp: staleTimestamp,
      primary_usable: false,
      secondary_usable: false,
    }),
    policy,
    paused: false,
    oracleDecimals: 14,
    observedAt: OBSERVED_AT,
  });
  assert.equal(stale.oracleStatus, "stale_price");
  assert.equal(stale.priceUsd, null);

  const paused = classifyOracleInspection({
    assetContract: XLM,
    inspection: inspection(),
    policy,
    paused: true,
    oracleDecimals: 14,
    observedAt: OBSERVED_AT,
  });
  assert.equal(paused.oracleStatus, "policy_paused");

  const missing = classifyOracleInspection({
    assetContract: XLM,
    inspection: inspection({
      price: 0n,
      timestamp: 0n,
      primary_timestamp: 0n,
      secondary_timestamp: 0n,
      primary_usable: false,
      secondary_usable: false,
    }),
    policy: null,
    paused: false,
    oracleDecimals: 14,
    observedAt: OBSERVED_AT,
  });
  assert.equal(missing.oracleStatus, "missing_price");
});

test("oracle prices convert exact seven-decimal asset amounts into USD base units", () => {
  assert.equal(multiplyByOraclePrice("10000000", "19079182705615", 14), "1907918");
});

test("snapshot economics value XLM through OracleGuard and USDC through parity", () => {
  const xlmPrice = classifyOracleInspection({
    assetContract: XLM,
    inspection: inspection(),
    policy,
    paused: false,
    oracleDecimals: 14,
    observedAt: OBSERVED_AT,
  });
  const snapshot = buildSnapshot(
    [arka(XLM, "10000000"), { ...arka(USDC, "25000000"), arkaId: `${arka(USDC, "0").arkaId.slice(0, -1)}D` }],
    [],
    OBSERVED_AT,
    [xlmPrice, usdParityPrice(USDC, OBSERVED_AT)],
  );
  assert.equal(snapshot.arkas[0].economics?.navUsdEstimate, "25000000");
  assert.equal(snapshot.arkas[1].economics?.navUsdEstimate, "1907918");
  assert.equal(snapshot.arkas[1].economics?.valuationSource, "oracle_verified");
});

test("the canonical registry resolves every launch asset without exposing raw unknown labels", () => {
  assert.equal(resolveAssetIdentity(XLM)?.symbol, "XLM");
  assert.equal(resolveAssetIdentity(USDC)?.symbol, "USDC");
  assert.equal(
    resolveAssetIdentity("CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY")?.symbol,
    "BLND",
  );
});
