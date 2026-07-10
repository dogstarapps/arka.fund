import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





export interface Asset {
  contract: string;
}

export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"AlreadyInitialized"},
  3: {message:"OnlyManager"},
  4: {message:"AmountZero"},
  5: {message:"AssetNotWhitelisted"},
  6: {message:"SharesZero"},
  7: {message:"InsufficientUserShares"},
  8: {message:"InsufficientShares"},
  9: {message:"RouterNotSet"},
  10: {message:"InvalidFeeBps"},
  11: {message:"UnauthorizedPolicy"},
  12: {message:"InsufficientLiquidity"},
  13: {message:"InvalidBlendPosition"},
  14: {message:"BlendAssetMismatch"},
  15: {message:"InvalidBlendRiskPolicy"},
  16: {message:"BlendOracleStale"},
  17: {message:"BlendHealthFactorTooLow"},
  18: {message:"BlendNavUnavailable"},
  19: {message:"BlendOracleInvalid"},
  20: {message:"CreditMarketNotConfigured"},
  21: {message:"CreditActionNotAllowed"},
  22: {message:"InvalidProtocolFeeBps"},
  23: {message:"InvalidSwapRiskPolicy"},
  24: {message:"SwapVenueNotAllowed"},
  25: {message:"SwapTradeSizeExceeded"},
  26: {message:"SwapOracleNotConfigured"},
  27: {message:"SwapOracleStale"},
  28: {message:"SwapOracleInvalid"},
  29: {message:"SwapPriceImpactExceeded"},
  30: {message:"SwapSlippageExceeded"},
  31: {message:"SwapTwapDeviationExceeded"},
  32: {message:"InvalidBootstrapAdmin"}
}

export type DataKey = {tag: "Denomination", values: void} | {tag: "TotalShares", values: void} | {tag: "ShareToken", values: void} | {tag: "Aum", values: void} | {tag: "Fees", values: void} | {tag: "ProtocolTreasury", values: void} | {tag: "ProtocolFeePolicy", values: void} | {tag: "FeeState", values: void} | {tag: "Whitelist", values: void} | {tag: "Manager", values: void} | {tag: "Governor", values: void} | {tag: "Router", values: void} | {tag: "Balance", values: readonly [string]} | {tag: "TrackedAssets", values: void} | {tag: "LiquidBalance", values: readonly [string]} | {tag: "BlendMarkets", values: void} | {tag: "BlendMarketAssets", values: readonly [u128]} | {tag: "BlendPosition", values: readonly [u128, string]} | {tag: "BlendAdapter", values: readonly [u128]} | {tag: "BlendRiskPolicy", values: readonly [u128]} | {tag: "BlendExternalDiagnostics", values: readonly [u128]} | {tag: "CreditProtocols", values: void} | {tag: "CreditMarkets", values: readonly [CreditProtocol]} | {tag: "CreditMarketConfig", values: readonly [CreditProtocol, u128]} | {tag: "SwapRiskPolicy", values: void} | {tag: "SwapOracle", values: void} | {tag: "AllowedRouters", values: void} | {tag: "AllowedAdapters", values: void} | {tag: "VenueRegistry", values: void} | {tag: "BootstrapAdmin", values: void} | {tag: "BootstrapAdminExpiresAt", values: void} | {tag: "LastWasmHash", values: void};


export interface FeeState {
  cumulative_management_shares: i128;
  cumulative_manager_shares: i128;
  cumulative_performance_shares: i128;
  cumulative_protocol_shares: i128;
  high_water_mark: i128;
  last_settlement_ts: u64;
}


export interface SwapStep {
  adapter: string;
  amount_in: i128;
  asset_in: Asset;
  asset_out: Asset;
  min_out: i128;
  pool_id: u128;
  router_addr: string;
}


export interface RouterStep {
  adapter: string;
  amount_in: i128;
  asset_out: Asset;
  min_out: i128;
  pool_id: u128;
}

export type BlendAction = {tag: "Lend", values: void} | {tag: "Borrow", values: void} | {tag: "Repay", values: void} | {tag: "Withdraw", values: void};

export type OracleAsset = {tag: "Stellar", values: readonly [string]} | {tag: "Other", values: readonly [string]};


export interface BlendRequest {
  address: string;
  amount: i128;
  request_type: u32;
}


export interface BlendReserve {
  asset: string;
  config: BlendReserveConfig;
  data: BlendReserveData;
  scalar: i128;
}

export type CreditAction = {tag: "Supply", values: void} | {tag: "Borrow", values: void} | {tag: "Repay", values: void} | {tag: "Withdraw", values: void};


export interface FeeStructure {
  deposit_bps: i32;
  mgmt_bps: i32;
  perf_bps: i32;
  redeem_bps: i32;
}


export interface BlendPosition {
  asset: string;
  collateral_amount: i128;
  debt_amount: i128;
  market_id: u128;
}


export interface FeeSettlement {
  high_water_mark_after: i128;
  high_water_mark_before: i128;
  management_fee_shares: i128;
  management_fee_value: i128;
  manager_fee_shares: i128;
  nav: i128;
  performance_fee_shares: i128;
  performance_fee_value: i128;
  protocol_fee_shares: i128;
  share_price_after: i128;
  share_price_before: i128;
  timestamp: u64;
  total_shares_after: i128;
  total_shares_before: i128;
}


export interface CreditPosition {
  asset: string;
  collateral_amount: i128;
  debt_amount: i128;
  market_id: u128;
}

export type CreditProtocol = {tag: "Blend", values: void};


export interface SwapRiskPolicy {
  enabled: boolean;
  max_oracle_age_seconds: u64;
  max_price_impact_bps: i32;
  max_slippage_bps: i32;
  max_trade_size_bps: i32;
  max_twap_deviation_bps: i32;
  oracle_checks_enabled: boolean;
}


export interface BlendPoolConfig {
  bstop_rate: u32;
  max_positions: u32;
  min_collateral: i128;
  oracle: string;
  status: u32;
}


export interface BlendRiskPolicy {
  fail_close_actions: boolean;
  fail_close_nav: boolean;
  market_id: u128;
  max_oracle_age: u64;
  min_health_factor: i128;
}


export interface OraclePriceData {
  price: i128;
  timestamp: u64;
}


export interface BlendMarketValue {
  collateral_value: i128;
  debt_value: i128;
  health_factor: i128;
  market_id: u128;
  net_value: i128;
  oracle_timestamp: u64;
}


export interface BlendReserveData {
  b_rate: i128;
  b_supply: i128;
  backstop_credit: i128;
  d_rate: i128;
  d_supply: i128;
  ir_mod: i128;
  last_time: u64;
}


export interface CreditRiskPolicy {
  fail_close_actions: boolean;
  fail_close_nav: boolean;
  market_id: u128;
  max_oracle_age: u64;
  min_health_factor: i128;
}


export interface BlendMarketStatus {
  debt_value: i128;
  has_disabled_reserve: boolean;
  has_future_oracle_timestamp: boolean;
  has_invalid_oracle_data: boolean;
  has_live_pricing: boolean;
  has_stale_oracle: boolean;
  health_factor: i128;
  market_id: u128;
  max_oracle_age: u64;
  min_health_factor: i128;
  nav_blocked: boolean;
  oracle_age: u64;
  pool_status: u32;
  risky_actions_blocked: boolean;
}


export interface CreditMarketValue {
  collateral_value: i128;
  debt_value: i128;
  health_factor: i128;
  market_id: u128;
  net_value: i128;
  oracle_timestamp: u64;
}


export interface ProtocolFeePolicy {
  mgmt_protocol_bps: i32;
  perf_protocol_bps: i32;
}


export interface BlendPoolPositions {
  collateral: Map<u32, i128>;
  liabilities: Map<u32, i128>;
  supply: Map<u32, i128>;
}


export interface BlendPositionValue {
  asset: string;
  c_factor: u32;
  collateral_amount: i128;
  collateral_shares: i128;
  collateral_value: i128;
  debt_amount: i128;
  debt_shares: i128;
  debt_value: i128;
  health_factor: i128;
  market_id: u128;
  net_value: i128;
  oracle_timestamp: u64;
  price: i128;
}


export interface BlendReserveConfig {
  c_factor: u32;
  decimals: u32;
  enabled: boolean;
  index: u32;
  l_factor: u32;
  max_util: u32;
  r_base: u32;
  r_one: u32;
  r_three: u32;
  r_two: u32;
  reactivity: u32;
  supply_cap: i128;
  util: u32;
}


export interface CreditMarketConfig {
  adapter: string;
  allow_borrow: boolean;
  allow_repay: boolean;
  allow_supply: boolean;
  allow_withdraw: boolean;
  enabled: boolean;
  market_id: u128;
  protocol: CreditProtocol;
}


export interface CreditMarketStatus {
  debt_value: i128;
  has_disabled_reserve: boolean;
  has_future_oracle_timestamp: boolean;
  has_invalid_oracle_data: boolean;
  has_live_pricing: boolean;
  has_stale_oracle: boolean;
  health_factor: i128;
  market_id: u128;
  max_oracle_age: u64;
  min_health_factor: i128;
  nav_blocked: boolean;
  oracle_age: u64;
  pool_status: u32;
  risky_actions_blocked: boolean;
}


export interface CreditPositionValue {
  asset: string;
  c_factor: u32;
  collateral_amount: i128;
  collateral_shares: i128;
  collateral_value: i128;
  debt_amount: i128;
  debt_shares: i128;
  debt_value: i128;
  health_factor: i128;
  market_id: u128;
  net_value: i128;
  oracle_timestamp: u64;
  price: i128;
}

export interface Client {
  /**
   * Construct and simulate a nav transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  nav: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  fees: (options?: MethodOptions) => Promise<AssembledTransaction<FeeStructure>>

  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({denomination_contract, mgmt_bps, perf_bps, deposit_bps, redeem_bps, whitelist_contracts, manager}: {denomination_contract: string, mgmt_bps: i32, perf_bps: i32, deposit_bps: i32, redeem_bps: i32, whitelist_contracts: Array<string>, manager: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  redeem: ({user, shares}: {user: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a router transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  router: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: ({user, asset, amount}: {user: string, asset: Asset, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  manager: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  governor: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_fees: ({caller, mgmt_bps, perf_bps, deposit_bps, redeem_bps}: {caller: string, mgmt_bps: i32, perf_bps: i32, deposit_bps: i32, redeem_bps: i32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a fee_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  fee_state: (options?: MethodOptions) => Promise<AssembledTransaction<FeeState>>

  /**
   * Construct and simulate a rebalance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  rebalance: ({manager, steps}: {manager: string, steps: Array<SwapStep>}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a shares_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  shares_of: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a whitelist transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  whitelist: (options?: MethodOptions) => Promise<AssembledTransaction<Array<Asset>>>

  /**
   * Construct and simulate a blend_lend transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_lend: ({manager, adapter, market_id, asset, amount}: {manager: string, adapter: string, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_router transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_router: ({caller, router}: {caller: string, router: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_repay: ({manager, adapter, market_id, asset, amount}: {manager: string, adapter: string, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a settle_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  settle_fees: (options?: MethodOptions) => Promise<AssembledTransaction<FeeSettlement>>

  /**
   * Construct and simulate a set_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_manager: ({caller, manager}: {caller: string, manager: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a share_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  share_token: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a swap_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  swap_oracle: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a blend_borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_borrow: ({manager, adapter, market_id, asset, amount}: {manager: string, adapter: string, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a credit_repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_repay: ({manager, protocol, market_id, asset, amount}: {manager: string, protocol: CreditProtocol, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a denomination transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  denomination: (options?: MethodOptions) => Promise<AssembledTransaction<Asset>>

  /**
   * Construct and simulate a set_governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_governor: ({caller, governor}: {caller: string, governor: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_markets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_markets: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u128>>>

  /**
   * Construct and simulate a credit_borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_borrow: ({manager, protocol, market_id, asset, amount}: {manager: string, protocol: CreditProtocol, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a credit_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_supply: ({manager, protocol, market_id, asset, amount}: {manager: string, protocol: CreditProtocol, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_whitelist transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_whitelist: ({caller, whitelist_contracts}: {caller: string, whitelist_contracts: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_position: ({market_id, asset}: {market_id: u128, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<BlendPosition>>>

  /**
   * Construct and simulate a blend_withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_withdraw: ({manager, adapter, market_id, asset, amount}: {manager: string, adapter: string, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a credit_markets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_markets: ({protocol}: {protocol: CreditProtocol}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u128>>>

  /**
   * Construct and simulate a last_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  last_wasm_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a liquid_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  liquid_balance: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a venue_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  venue_registry: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a allowed_routers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  allowed_routers: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a blend_positions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_positions: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Array<BlendPosition>>>

  /**
   * Construct and simulate a bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a credit_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_position: ({protocol, market_id, asset}: {protocol: CreditProtocol, market_id: u128, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CreditPosition>>>

  /**
   * Construct and simulate a credit_withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_withdraw: ({manager, protocol, market_id, asset, amount}: {manager: string, protocol: CreditProtocol, market_id: u128, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_share_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_share_token: ({caller, share_token}: {caller: string, share_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_swap_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_swap_oracle: ({caller, oracle}: {caller: string, oracle: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a allowed_adapters transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  allowed_adapters: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a credit_positions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_positions: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Array<CreditPosition>>>

  /**
   * Construct and simulate a credit_protocols transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_protocols: (options?: MethodOptions) => Promise<AssembledTransaction<Array<CreditProtocol>>>

  /**
   * Construct and simulate a swap_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  swap_risk_policy: (options?: MethodOptions) => Promise<AssembledTransaction<SwapRiskPolicy>>

  /**
   * Construct and simulate a blend_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_risk_policy: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<BlendRiskPolicy>>

  /**
   * Construct and simulate a protocol_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  protocol_treasury: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a blend_market_value transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_market_value: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<BlendMarketValue>>>

  /**
   * Construct and simulate a credit_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_risk_policy: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<CreditRiskPolicy>>

  /**
   * Construct and simulate a set_allowed_venues transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_allowed_venues: ({caller, allowed_routers, allowed_adapters}: {caller: string, allowed_routers: Array<string>, allowed_adapters: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_venue_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_venue_registry: ({caller, registry}: {caller: string, registry: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_health_factor: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<i128>>>

  /**
   * Construct and simulate a blend_market_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_market_assets: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a blend_market_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_market_status: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<BlendMarketStatus>>>

  /**
   * Construct and simulate a credit_market_value transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_market_value: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CreditMarketValue>>>

  /**
   * Construct and simulate a protocol_fee_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  protocol_fee_policy: (options?: MethodOptions) => Promise<AssembledTransaction<ProtocolFeePolicy>>

  /**
   * Construct and simulate a set_bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_bootstrap_admin: ({caller, admin, expires_at}: {caller: string, admin: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_position_value transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_position_value: ({market_id, asset}: {market_id: u128, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<BlendPositionValue>>>

  /**
   * Construct and simulate a clear_venue_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_venue_registry: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a credit_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_health_factor: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<i128>>>

  /**
   * Construct and simulate a credit_market_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_market_assets: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a credit_market_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_market_config: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CreditMarketConfig>>>

  /**
   * Construct and simulate a credit_market_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_market_status: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CreditMarketStatus>>>

  /**
   * Construct and simulate a set_swap_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_swap_risk_policy: ({caller, enabled, oracle_checks_enabled, max_price_impact_bps, max_slippage_bps, max_twap_deviation_bps, max_oracle_age_seconds, max_trade_size_bps}: {caller: string, enabled: boolean, oracle_checks_enabled: boolean, max_price_impact_bps: i32, max_slippage_bps: i32, max_twap_deviation_bps: i32, max_oracle_age_seconds: u64, max_trade_size_bps: i32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_position_values transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_position_values: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Array<BlendPositionValue>>>

  /**
   * Construct and simulate a clear_bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_bootstrap_admin: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a credit_market_configs transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_market_configs: ({protocol}: {protocol: CreditProtocol}, options?: MethodOptions) => Promise<AssembledTransaction<Array<CreditMarketConfig>>>

  /**
   * Construct and simulate a credit_position_value transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_position_value: ({protocol, market_id, asset}: {protocol: CreditProtocol, market_id: u128, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CreditPositionValue>>>

  /**
   * Construct and simulate a set_blend_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_blend_risk_policy: ({caller, market_id, max_oracle_age, min_health_factor, fail_close_nav, fail_close_actions}: {caller: string, market_id: u128, max_oracle_age: u64, min_health_factor: i128, fail_close_nav: boolean, fail_close_actions: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_admin_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_active: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a credit_position_values transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  credit_position_values: ({protocol, market_id}: {protocol: CreditProtocol, market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<Array<CreditPositionValue>>>

  /**
   * Construct and simulate a preview_fee_settlement transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  preview_fee_settlement: (options?: MethodOptions) => Promise<AssembledTransaction<FeeSettlement>>

  /**
   * Construct and simulate a configure_credit_market transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  configure_credit_market: ({caller, protocol, market_id, adapter, allow_supply, allow_borrow, allow_repay, allow_withdraw, enabled}: {caller: string, protocol: CreditProtocol, market_id: u128, adapter: string, allow_supply: boolean, allow_borrow: boolean, allow_repay: boolean, allow_withdraw: boolean, enabled: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_protocol_fee_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_protocol_fee_policy: ({caller, treasury, mgmt_protocol_bps, perf_protocol_bps}: {caller: string, treasury: string, mgmt_protocol_bps: i32, perf_protocol_bps: i32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a blend_external_diagnostics transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  blend_external_diagnostics: ({market_id}: {market_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a bootstrap_admin_expires_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_expires_at: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u64>>>

  /**
   * Construct and simulate a set_bootstrap_admin_expiry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_bootstrap_admin_expiry: ({caller, expires_at}: {caller: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_blend_external_diagnostics transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_blend_external_diagnostics: ({caller, market_id, enabled}: {caller: string, market_id: u128, enabled: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAADbmF2AAAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAAEZmVlcwAAAAAAAAABAAAH0AAAAAxGZWVTdHJ1Y3R1cmU=",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAcAAAAAAAAAFWRlbm9taW5hdGlvbl9jb250cmFjdAAAAAAAABMAAAAAAAAACG1nbXRfYnBzAAAABQAAAAAAAAAIcGVyZl9icHMAAAAFAAAAAAAAAAtkZXBvc2l0X2JwcwAAAAAFAAAAAAAAAApyZWRlZW1fYnBzAAAAAAAFAAAAAAAAABN3aGl0ZWxpc3RfY29udHJhY3RzAAAAA+oAAAATAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAGcmVkZWVtAAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAGcm91dGVyAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAfQAAAABUFzc2V0AAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAACw==",
        "AAAAAAAAAAAAAAAHbWFuYWdlcgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAABUFzc2V0AAAAAAAAAQAAAAAAAAAIY29udHJhY3QAAAAT",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAIAAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAALT25seU1hbmFnZXIAAAAAAwAAAAAAAAAKQW1vdW50WmVybwAAAAAABAAAAAAAAAATQXNzZXROb3RXaGl0ZWxpc3RlZAAAAAAFAAAAAAAAAApTaGFyZXNaZXJvAAAAAAAGAAAAAAAAABZJbnN1ZmZpY2llbnRVc2VyU2hhcmVzAAAAAAAHAAAAAAAAABJJbnN1ZmZpY2llbnRTaGFyZXMAAAAAAAgAAAAAAAAADFJvdXRlck5vdFNldAAAAAkAAAAAAAAADUludmFsaWRGZWVCcHMAAAAAAAAKAAAAAAAAABJVbmF1dGhvcml6ZWRQb2xpY3kAAAAAAAsAAAAAAAAAFUluc3VmZmljaWVudExpcXVpZGl0eQAAAAAAAAwAAAAAAAAAFEludmFsaWRCbGVuZFBvc2l0aW9uAAAADQAAAAAAAAASQmxlbmRBc3NldE1pc21hdGNoAAAAAAAOAAAAAAAAABZJbnZhbGlkQmxlbmRSaXNrUG9saWN5AAAAAAAPAAAAAAAAABBCbGVuZE9yYWNsZVN0YWxlAAAAEAAAAAAAAAAXQmxlbmRIZWFsdGhGYWN0b3JUb29Mb3cAAAAAEQAAAAAAAAATQmxlbmROYXZVbmF2YWlsYWJsZQAAAAASAAAAAAAAABJCbGVuZE9yYWNsZUludmFsaWQAAAAAABMAAAAAAAAAGUNyZWRpdE1hcmtldE5vdENvbmZpZ3VyZWQAAAAAAAAUAAAAAAAAABZDcmVkaXRBY3Rpb25Ob3RBbGxvd2VkAAAAAAAVAAAAAAAAABVJbnZhbGlkUHJvdG9jb2xGZWVCcHMAAAAAAAAWAAAAAAAAABVJbnZhbGlkU3dhcFJpc2tQb2xpY3kAAAAAAAAXAAAAAAAAABNTd2FwVmVudWVOb3RBbGxvd2VkAAAAABgAAAAAAAAAFVN3YXBUcmFkZVNpemVFeGNlZWRlZAAAAAAAABkAAAAAAAAAF1N3YXBPcmFjbGVOb3RDb25maWd1cmVkAAAAABoAAAAAAAAAD1N3YXBPcmFjbGVTdGFsZQAAAAAbAAAAAAAAABFTd2FwT3JhY2xlSW52YWxpZAAAAAAAABwAAAAAAAAAF1N3YXBQcmljZUltcGFjdEV4Y2VlZGVkAAAAAB0AAAAAAAAAFFN3YXBTbGlwcGFnZUV4Y2VlZGVkAAAAHgAAAAAAAAAZU3dhcFR3YXBEZXZpYXRpb25FeGNlZWRlZAAAAAAAAB8AAAAAAAAAFUludmFsaWRCb290c3RyYXBBZG1pbgAAAAAAACA=",
        "AAAAAAAAAAAAAAAIZ292ZXJub3IAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAIc2V0X2ZlZXMAAAAFAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACG1nbXRfYnBzAAAABQAAAAAAAAAIcGVyZl9icHMAAAAFAAAAAAAAAAtkZXBvc2l0X2JwcwAAAAAFAAAAAAAAAApyZWRlZW1fYnBzAAAAAAAFAAAAAA==",
        "AAAAAAAAAAAAAAAJZmVlX3N0YXRlAAAAAAAAAAAAAAEAAAfQAAAACEZlZVN0YXRl",
        "AAAAAAAAAAAAAAAJcmViYWxhbmNlAAAAAAAAAgAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAVzdGVwcwAAAAAAA+oAAAfQAAAACFN3YXBTdGVwAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAJc2hhcmVzX29mAAAAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAJd2hpdGVsaXN0AAAAAAAAAAAAAAEAAAPqAAAH0AAAAAVBc3NldAAAAA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAIAAAAAAAAAAAAAAADERlbm9taW5hdGlvbgAAAAAAAAAAAAAAC1RvdGFsU2hhcmVzAAAAAAAAAAAAAAAAClNoYXJlVG9rZW4AAAAAAAAAAAAAAAAAA0F1bQAAAAAAAAAAAAAAAARGZWVzAAAAAAAAAAAAAAAQUHJvdG9jb2xUcmVhc3VyeQAAAAAAAAAAAAAAEVByb3RvY29sRmVlUG9saWN5AAAAAAAAAAAAAAAAAAAIRmVlU3RhdGUAAAAAAAAAAAAAAAlXaGl0ZWxpc3QAAAAAAAAAAAAAAAAAAAdNYW5hZ2VyAAAAAAAAAAAAAAAACEdvdmVybm9yAAAAAAAAAAAAAAAGUm91dGVyAAAAAAABAAAAAAAAAAdCYWxhbmNlAAAAAAEAAAATAAAAAAAAAAAAAAANVHJhY2tlZEFzc2V0cwAAAAAAAAEAAAAAAAAADUxpcXVpZEJhbGFuY2UAAAAAAAABAAAAEwAAAAAAAAAAAAAADEJsZW5kTWFya2V0cwAAAAEAAAAAAAAAEUJsZW5kTWFya2V0QXNzZXRzAAAAAAAAAQAAAAoAAAABAAAAAAAAAA1CbGVuZFBvc2l0aW9uAAAAAAAAAgAAAAoAAAATAAAAAQAAAAAAAAAMQmxlbmRBZGFwdGVyAAAAAQAAAAoAAAABAAAAAAAAAA9CbGVuZFJpc2tQb2xpY3kAAAAAAQAAAAoAAAABAAAAAAAAABhCbGVuZEV4dGVybmFsRGlhZ25vc3RpY3MAAAABAAAACgAAAAAAAAAAAAAAD0NyZWRpdFByb3RvY29scwAAAAABAAAAAAAAAA1DcmVkaXRNYXJrZXRzAAAAAAAAAQAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAEAAAAAAAAAEkNyZWRpdE1hcmtldENvbmZpZwAAAAAAAgAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAoAAAAAAAAAAAAAAA5Td2FwUmlza1BvbGljeQAAAAAAAAAAAAAAAAAKU3dhcE9yYWNsZQAAAAAAAAAAAAAAAAAOQWxsb3dlZFJvdXRlcnMAAAAAAAAAAAAAAAAAD0FsbG93ZWRBZGFwdGVycwAAAAAAAAAAAAAAAA1WZW51ZVJlZ2lzdHJ5AAAAAAAAAAAAAAAAAAAOQm9vdHN0cmFwQWRtaW4AAAAAAAAAAAAAAAAAF0Jvb3RzdHJhcEFkbWluRXhwaXJlc0F0AAAAAAAAAAAAAAAADExhc3RXYXNtSGFzaA==",
        "AAAAAAAAAAAAAAAKYmxlbmRfbGVuZAAAAAAABQAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAdhZGFwdGVyAAAAABMAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAKc2V0X3JvdXRlcgAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZyb3V0ZXIAAAAAABMAAAAA",
        "AAAAAQAAAAAAAAAAAAAACEZlZVN0YXRlAAAABgAAAAAAAAAcY3VtdWxhdGl2ZV9tYW5hZ2VtZW50X3NoYXJlcwAAAAsAAAAAAAAAGWN1bXVsYXRpdmVfbWFuYWdlcl9zaGFyZXMAAAAAAAALAAAAAAAAAB1jdW11bGF0aXZlX3BlcmZvcm1hbmNlX3NoYXJlcwAAAAAAAAsAAAAAAAAAGmN1bXVsYXRpdmVfcHJvdG9jb2xfc2hhcmVzAAAAAAALAAAAAAAAAA9oaWdoX3dhdGVyX21hcmsAAAAACwAAAAAAAAASbGFzdF9zZXR0bGVtZW50X3RzAAAAAAAG",
        "AAAAAQAAAAAAAAAAAAAACFN3YXBTdGVwAAAABwAAAAAAAAAHYWRhcHRlcgAAAAATAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAhhc3NldF9pbgAAB9AAAAAFQXNzZXQAAAAAAAAAAAAACWFzc2V0X291dAAAAAAAB9AAAAAFQXNzZXQAAAAAAAAAAAAAB21pbl9vdXQAAAAACwAAAAAAAAAHcG9vbF9pZAAAAAAKAAAAAAAAAAtyb3V0ZXJfYWRkcgAAAAAT",
        "AAAAAAAAAAAAAAALYmxlbmRfcmVwYXkAAAAABQAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAdhZGFwdGVyAAAAABMAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAALc2V0dGxlX2ZlZXMAAAAAAAAAAAEAAAfQAAAADUZlZVNldHRsZW1lbnQAAAA=",
        "AAAAAAAAAAAAAAALc2V0X21hbmFnZXIAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAAA",
        "AAAAAAAAAAAAAAALc2hhcmVfdG9rZW4AAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAAAAAAALc3dhcF9vcmFjbGUAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAAAAAAAMYmxlbmRfYm9ycm93AAAABQAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAdhZGFwdGVyAAAAABMAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAMY3JlZGl0X3JlcGF5AAAABQAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAACw==",
        "AAAAAAAAAAAAAAAMZGVub21pbmF0aW9uAAAAAAAAAAEAAAfQAAAABUFzc2V0AAAA",
        "AAAAAAAAAAAAAAAMc2V0X2dvdmVybm9yAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhnb3Zlcm5vcgAAABMAAAAA",
        "AAAAAQAAAAAAAAAAAAAAClJvdXRlclN0ZXAAAAAAAAUAAAAAAAAAB2FkYXB0ZXIAAAAAEwAAAAAAAAAJYW1vdW50X2luAAAAAAAACwAAAAAAAAAJYXNzZXRfb3V0AAAAAAAH0AAAAAVBc3NldAAAAAAAAAAAAAAHbWluX291dAAAAAALAAAAAAAAAAdwb29sX2lkAAAAAAo=",
        "AAAAAAAAAAAAAAANYmxlbmRfbWFya2V0cwAAAAAAAAAAAAABAAAD6gAAAAo=",
        "AAAAAAAAAAAAAAANY3JlZGl0X2JvcnJvdwAAAAAAAAUAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAIcHJvdG9jb2wAAAfQAAAADkNyZWRpdFByb3RvY29sAAAAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAANY3JlZGl0X3N1cHBseQAAAAAAAAUAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAIcHJvdG9jb2wAAAfQAAAADkNyZWRpdFByb3RvY29sAAAAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAANc2V0X3doaXRlbGlzdAAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAATd2hpdGVsaXN0X2NvbnRyYWN0cwAAAAPqAAAAEwAAAAA=",
        "AAAAAgAAAAAAAAAAAAAAC0JsZW5kQWN0aW9uAAAAAAQAAAAAAAAAAAAAAARMZW5kAAAAAAAAAAAAAAAGQm9ycm93AAAAAAAAAAAAAAAAAAVSZXBheQAAAAAAAAAAAAAAAAAACFdpdGhkcmF3",
        "AAAAAgAAAAAAAAAAAAAAC09yYWNsZUFzc2V0AAAAAAIAAAABAAAAAAAAAAdTdGVsbGFyAAAAAAEAAAATAAAAAQAAAAAAAAAFT3RoZXIAAAAAAAABAAAAEQ==",
        "AAAAAAAAAAAAAAAOYmxlbmRfcG9zaXRpb24AAAAAAAIAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAPoAAAH0AAAAA1CbGVuZFBvc2l0aW9uAAAA",
        "AAAAAAAAAAAAAAAOYmxlbmRfd2l0aGRyYXcAAAAAAAUAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAHYWRhcHRlcgAAAAATAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAOY3JlZGl0X21hcmtldHMAAAAAAAEAAAAAAAAACHByb3RvY29sAAAH0AAAAA5DcmVkaXRQcm90b2NvbAAAAAAAAQAAA+oAAAAK",
        "AAAAAAAAAAAAAAAObGFzdF93YXNtX2hhc2gAAAAAAAAAAAABAAAD6AAAA+4AAAAg",
        "AAAAAAAAAAAAAAAObGlxdWlkX2JhbGFuY2UAAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAOdmVudWVfcmVnaXN0cnkAAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAQAAAAAAAAAAAAAADEJsZW5kUmVxdWVzdAAAAAMAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAxyZXF1ZXN0X3R5cGUAAAAE",
        "AAAAAQAAAAAAAAAAAAAADEJsZW5kUmVzZXJ2ZQAAAAQAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGY29uZmlnAAAAAAfQAAAAEkJsZW5kUmVzZXJ2ZUNvbmZpZwAAAAAAAAAAAARkYXRhAAAH0AAAABBCbGVuZFJlc2VydmVEYXRhAAAAAAAAAAZzY2FsYXIAAAAAAAs=",
        "AAAAAgAAAAAAAAAAAAAADENyZWRpdEFjdGlvbgAAAAQAAAAAAAAAAAAAAAZTdXBwbHkAAAAAAAAAAAAAAAAABkJvcnJvdwAAAAAAAAAAAAAAAAAFUmVwYXkAAAAAAAAAAAAAAAAAAAhXaXRoZHJhdw==",
        "AAAAAQAAAAAAAAAAAAAADEZlZVN0cnVjdHVyZQAAAAQAAAAAAAAAC2RlcG9zaXRfYnBzAAAAAAUAAAAAAAAACG1nbXRfYnBzAAAABQAAAAAAAAAIcGVyZl9icHMAAAAFAAAAAAAAAApyZWRlZW1fYnBzAAAAAAAF",
        "AAAAAAAAAAAAAAAPYWxsb3dlZF9yb3V0ZXJzAAAAAAAAAAABAAAD6gAAABM=",
        "AAAAAAAAAAAAAAAPYmxlbmRfcG9zaXRpb25zAAAAAAEAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAABAAAD6gAAB9AAAAANQmxlbmRQb3NpdGlvbgAAAA==",
        "AAAAAAAAAAAAAAAPYm9vdHN0cmFwX2FkbWluAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAAAAAAAAPY3JlZGl0X3Bvc2l0aW9uAAAAAAMAAAAAAAAACHByb3RvY29sAAAH0AAAAA5DcmVkaXRQcm90b2NvbAAAAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAAVhc3NldAAAAAAAABMAAAABAAAD6AAAB9AAAAAOQ3JlZGl0UG9zaXRpb24AAA==",
        "AAAAAAAAAAAAAAAPY3JlZGl0X3dpdGhkcmF3AAAAAAUAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAIcHJvdG9jb2wAAAfQAAAADkNyZWRpdFByb3RvY29sAAAAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAPc2V0X3NoYXJlX3Rva2VuAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAALc2hhcmVfdG9rZW4AAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPc2V0X3N3YXBfb3JhY2xlAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAGb3JhY2xlAAAAAAATAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAADUJsZW5kUG9zaXRpb24AAAAAAAAEAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAAEWNvbGxhdGVyYWxfYW1vdW50AAAAAAAACwAAAAAAAAALZGVidF9hbW91bnQAAAAACwAAAAAAAAAJbWFya2V0X2lkAAAAAAAACg==",
        "AAAAAQAAAAAAAAAAAAAADUZlZVNldHRsZW1lbnQAAAAAAAAOAAAAAAAAABVoaWdoX3dhdGVyX21hcmtfYWZ0ZXIAAAAAAAALAAAAAAAAABZoaWdoX3dhdGVyX21hcmtfYmVmb3JlAAAAAAALAAAAAAAAABVtYW5hZ2VtZW50X2ZlZV9zaGFyZXMAAAAAAAALAAAAAAAAABRtYW5hZ2VtZW50X2ZlZV92YWx1ZQAAAAsAAAAAAAAAEm1hbmFnZXJfZmVlX3NoYXJlcwAAAAAACwAAAAAAAAADbmF2AAAAAAsAAAAAAAAAFnBlcmZvcm1hbmNlX2ZlZV9zaGFyZXMAAAAAAAsAAAAAAAAAFXBlcmZvcm1hbmNlX2ZlZV92YWx1ZQAAAAAAAAsAAAAAAAAAE3Byb3RvY29sX2ZlZV9zaGFyZXMAAAAACwAAAAAAAAARc2hhcmVfcHJpY2VfYWZ0ZXIAAAAAAAALAAAAAAAAABJzaGFyZV9wcmljZV9iZWZvcmUAAAAAAAsAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAAEnRvdGFsX3NoYXJlc19hZnRlcgAAAAAACwAAAAAAAAATdG90YWxfc2hhcmVzX2JlZm9yZQAAAAAL",
        "AAAAAAAAAAAAAAAQYWxsb3dlZF9hZGFwdGVycwAAAAAAAAABAAAD6gAAABM=",
        "AAAAAAAAAAAAAAAQY3JlZGl0X3Bvc2l0aW9ucwAAAAIAAAAAAAAACHByb3RvY29sAAAH0AAAAA5DcmVkaXRQcm90b2NvbAAAAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAQAAA+oAAAfQAAAADkNyZWRpdFBvc2l0aW9uAAA=",
        "AAAAAAAAAAAAAAAQY3JlZGl0X3Byb3RvY29scwAAAAAAAAABAAAD6gAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAA==",
        "AAAAAAAAAAAAAAAQc3dhcF9yaXNrX3BvbGljeQAAAAAAAAABAAAH0AAAAA5Td2FwUmlza1BvbGljeQAA",
        "AAAAAQAAAAAAAAAAAAAADkNyZWRpdFBvc2l0aW9uAAAAAAAEAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAAEWNvbGxhdGVyYWxfYW1vdW50AAAAAAAACwAAAAAAAAALZGVidF9hbW91bnQAAAAACwAAAAAAAAAJbWFya2V0X2lkAAAAAAAACg==",
        "AAAAAgAAAAAAAAAAAAAADkNyZWRpdFByb3RvY29sAAAAAAABAAAAAAAAAAAAAAAFQmxlbmQAAAA=",
        "AAAAAQAAAAAAAAAAAAAADlN3YXBSaXNrUG9saWN5AAAAAAAHAAAAAAAAAAdlbmFibGVkAAAAAAEAAAAAAAAAFm1heF9vcmFjbGVfYWdlX3NlY29uZHMAAAAAAAYAAAAAAAAAFG1heF9wcmljZV9pbXBhY3RfYnBzAAAABQAAAAAAAAAQbWF4X3NsaXBwYWdlX2JwcwAAAAUAAAAAAAAAEm1heF90cmFkZV9zaXplX2JwcwAAAAAABQAAAAAAAAAWbWF4X3R3YXBfZGV2aWF0aW9uX2JwcwAAAAAABQAAAAAAAAAVb3JhY2xlX2NoZWNrc19lbmFibGVkAAAAAAAAAQ==",
        "AAAAAAAAAAAAAAARYmxlbmRfcmlza19wb2xpY3kAAAAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAQAAB9AAAAAPQmxlbmRSaXNrUG9saWN5AA==",
        "AAAAAAAAAAAAAAARcHJvdG9jb2xfdHJlYXN1cnkAAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAQAAAAAAAAAAAAAAD0JsZW5kUG9vbENvbmZpZwAAAAAFAAAAAAAAAApic3RvcF9yYXRlAAAAAAAEAAAAAAAAAA1tYXhfcG9zaXRpb25zAAAAAAAABAAAAAAAAAAObWluX2NvbGxhdGVyYWwAAAAAAAsAAAAAAAAABm9yYWNsZQAAAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAAE",
        "AAAAAQAAAAAAAAAAAAAAD0JsZW5kUmlza1BvbGljeQAAAAAFAAAAAAAAABJmYWlsX2Nsb3NlX2FjdGlvbnMAAAAAAAEAAAAAAAAADmZhaWxfY2xvc2VfbmF2AAAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAA5tYXhfb3JhY2xlX2FnZQAAAAAABgAAAAAAAAARbWluX2hlYWx0aF9mYWN0b3IAAAAAAAAL",
        "AAAAAQAAAAAAAAAAAAAAD09yYWNsZVByaWNlRGF0YQAAAAACAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAY=",
        "AAAAAAAAAAAAAAASYmxlbmRfbWFya2V0X3ZhbHVlAAAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAQAAA+gAAAfQAAAAEEJsZW5kTWFya2V0VmFsdWU=",
        "AAAAAAAAAAAAAAASY3JlZGl0X3Jpc2tfcG9saWN5AAAAAAACAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAfQAAAAEENyZWRpdFJpc2tQb2xpY3k=",
        "AAAAAAAAAAAAAAASc2V0X2FsbG93ZWRfdmVudWVzAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAD2FsbG93ZWRfcm91dGVycwAAAAPqAAAAEwAAAAAAAAAQYWxsb3dlZF9hZGFwdGVycwAAA+oAAAATAAAAAA==",
        "AAAAAAAAAAAAAAASc2V0X3ZlbnVlX3JlZ2lzdHJ5AAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACHJlZ2lzdHJ5AAAAEwAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEEJsZW5kTWFya2V0VmFsdWUAAAAGAAAAAAAAABBjb2xsYXRlcmFsX3ZhbHVlAAAACwAAAAAAAAAKZGVidF92YWx1ZQAAAAAACwAAAAAAAAANaGVhbHRoX2ZhY3RvcgAAAAAAAAsAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAACW5ldF92YWx1ZQAAAAAAAAsAAAAAAAAAEG9yYWNsZV90aW1lc3RhbXAAAAAG",
        "AAAAAQAAAAAAAAAAAAAAEEJsZW5kUmVzZXJ2ZURhdGEAAAAHAAAAAAAAAAZiX3JhdGUAAAAAAAsAAAAAAAAACGJfc3VwcGx5AAAACwAAAAAAAAAPYmFja3N0b3BfY3JlZGl0AAAAAAsAAAAAAAAABmRfcmF0ZQAAAAAACwAAAAAAAAAIZF9zdXBwbHkAAAALAAAAAAAAAAZpcl9tb2QAAAAAAAsAAAAAAAAACWxhc3RfdGltZQAAAAAAAAY=",
        "AAAAAQAAAAAAAAAAAAAAEENyZWRpdFJpc2tQb2xpY3kAAAAFAAAAAAAAABJmYWlsX2Nsb3NlX2FjdGlvbnMAAAAAAAEAAAAAAAAADmZhaWxfY2xvc2VfbmF2AAAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAA5tYXhfb3JhY2xlX2FnZQAAAAAABgAAAAAAAAARbWluX2hlYWx0aF9mYWN0b3IAAAAAAAAL",
        "AAAAAAAAAAAAAAATYmxlbmRfaGVhbHRoX2ZhY3RvcgAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAQAAA+gAAAAL",
        "AAAAAAAAAAAAAAATYmxlbmRfbWFya2V0X2Fzc2V0cwAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAQAAA+oAAAAT",
        "AAAAAAAAAAAAAAATYmxlbmRfbWFya2V0X3N0YXR1cwAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAQAAA+gAAAfQAAAAEUJsZW5kTWFya2V0U3RhdHVzAAAA",
        "AAAAAAAAAAAAAAATY3JlZGl0X21hcmtldF92YWx1ZQAAAAACAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAPoAAAH0AAAABFDcmVkaXRNYXJrZXRWYWx1ZQAAAA==",
        "AAAAAAAAAAAAAAATcHJvdG9jb2xfZmVlX3BvbGljeQAAAAAAAAAAAQAAB9AAAAARUHJvdG9jb2xGZWVQb2xpY3kAAAA=",
        "AAAAAAAAAAAAAAATc2V0X2Jvb3RzdHJhcF9hZG1pbgAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEUJsZW5kTWFya2V0U3RhdHVzAAAAAAAADgAAAAAAAAAKZGVidF92YWx1ZQAAAAAACwAAAAAAAAAUaGFzX2Rpc2FibGVkX3Jlc2VydmUAAAABAAAAAAAAABtoYXNfZnV0dXJlX29yYWNsZV90aW1lc3RhbXAAAAAAAQAAAAAAAAAXaGFzX2ludmFsaWRfb3JhY2xlX2RhdGEAAAAAAQAAAAAAAAAQaGFzX2xpdmVfcHJpY2luZwAAAAEAAAAAAAAAEGhhc19zdGFsZV9vcmFjbGUAAAABAAAAAAAAAA1oZWFsdGhfZmFjdG9yAAAAAAAACwAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAAAAAAObWF4X29yYWNsZV9hZ2UAAAAAAAYAAAAAAAAAEW1pbl9oZWFsdGhfZmFjdG9yAAAAAAAACwAAAAAAAAALbmF2X2Jsb2NrZWQAAAAAAQAAAAAAAAAKb3JhY2xlX2FnZQAAAAAABgAAAAAAAAALcG9vbF9zdGF0dXMAAAAABAAAAAAAAAAVcmlza3lfYWN0aW9uc19ibG9ja2VkAAAAAAAAAQ==",
        "AAAAAQAAAAAAAAAAAAAAEUNyZWRpdE1hcmtldFZhbHVlAAAAAAAABgAAAAAAAAAQY29sbGF0ZXJhbF92YWx1ZQAAAAsAAAAAAAAACmRlYnRfdmFsdWUAAAAAAAsAAAAAAAAADWhlYWx0aF9mYWN0b3IAAAAAAAALAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAAluZXRfdmFsdWUAAAAAAAALAAAAAAAAABBvcmFjbGVfdGltZXN0YW1wAAAABg==",
        "AAAAAQAAAAAAAAAAAAAAEVByb3RvY29sRmVlUG9saWN5AAAAAAAAAgAAAAAAAAARbWdtdF9wcm90b2NvbF9icHMAAAAAAAAFAAAAAAAAABFwZXJmX3Byb3RvY29sX2JwcwAAAAAAAAU=",
        "AAAAAAAAAAAAAAAUYmxlbmRfcG9zaXRpb25fdmFsdWUAAAACAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAAVhc3NldAAAAAAAABMAAAABAAAD6AAAB9AAAAASQmxlbmRQb3NpdGlvblZhbHVlAAA=",
        "AAAAAAAAAAAAAAAUY2xlYXJfdmVudWVfcmVnaXN0cnkAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAUY3JlZGl0X2hlYWx0aF9mYWN0b3IAAAACAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAPoAAAACw==",
        "AAAAAAAAAAAAAAAUY3JlZGl0X21hcmtldF9hc3NldHMAAAACAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAPqAAAAEw==",
        "AAAAAAAAAAAAAAAUY3JlZGl0X21hcmtldF9jb25maWcAAAACAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAPoAAAH0AAAABJDcmVkaXRNYXJrZXRDb25maWcAAA==",
        "AAAAAAAAAAAAAAAUY3JlZGl0X21hcmtldF9zdGF0dXMAAAACAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAPoAAAH0AAAABJDcmVkaXRNYXJrZXRTdGF0dXMAAA==",
        "AAAAAAAAAAAAAAAUc2V0X3N3YXBfcmlza19wb2xpY3kAAAAIAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAAAAAAVb3JhY2xlX2NoZWNrc19lbmFibGVkAAAAAAAAAQAAAAAAAAAUbWF4X3ByaWNlX2ltcGFjdF9icHMAAAAFAAAAAAAAABBtYXhfc2xpcHBhZ2VfYnBzAAAABQAAAAAAAAAWbWF4X3R3YXBfZGV2aWF0aW9uX2JwcwAAAAAABQAAAAAAAAAWbWF4X29yYWNsZV9hZ2Vfc2Vjb25kcwAAAAAABgAAAAAAAAASbWF4X3RyYWRlX3NpemVfYnBzAAAAAAAFAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAAEkJsZW5kUG9vbFBvc2l0aW9ucwAAAAAAAwAAAAAAAAAKY29sbGF0ZXJhbAAAAAAD7AAAAAQAAAALAAAAAAAAAAtsaWFiaWxpdGllcwAAAAPsAAAABAAAAAsAAAAAAAAABnN1cHBseQAAAAAD7AAAAAQAAAAL",
        "AAAAAQAAAAAAAAAAAAAAEkJsZW5kUG9zaXRpb25WYWx1ZQAAAAAADQAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjX2ZhY3RvcgAAAAQAAAAAAAAAEWNvbGxhdGVyYWxfYW1vdW50AAAAAAAACwAAAAAAAAARY29sbGF0ZXJhbF9zaGFyZXMAAAAAAAALAAAAAAAAABBjb2xsYXRlcmFsX3ZhbHVlAAAACwAAAAAAAAALZGVidF9hbW91bnQAAAAACwAAAAAAAAALZGVidF9zaGFyZXMAAAAACwAAAAAAAAAKZGVidF92YWx1ZQAAAAAACwAAAAAAAAANaGVhbHRoX2ZhY3RvcgAAAAAAAAsAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAACW5ldF92YWx1ZQAAAAAAAAsAAAAAAAAAEG9yYWNsZV90aW1lc3RhbXAAAAAGAAAAAAAAAAVwcmljZQAAAAAAAAs=",
        "AAAAAQAAAAAAAAAAAAAAEkJsZW5kUmVzZXJ2ZUNvbmZpZwAAAAAADQAAAAAAAAAIY19mYWN0b3IAAAAEAAAAAAAAAAhkZWNpbWFscwAAAAQAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAAAAAAhsX2ZhY3RvcgAAAAQAAAAAAAAACG1heF91dGlsAAAABAAAAAAAAAAGcl9iYXNlAAAAAAAEAAAAAAAAAAVyX29uZQAAAAAAAAQAAAAAAAAAB3JfdGhyZWUAAAAABAAAAAAAAAAFcl90d28AAAAAAAAEAAAAAAAAAApyZWFjdGl2aXR5AAAAAAAEAAAAAAAAAApzdXBwbHlfY2FwAAAAAAALAAAAAAAAAAR1dGlsAAAABA==",
        "AAAAAQAAAAAAAAAAAAAAEkNyZWRpdE1hcmtldENvbmZpZwAAAAAACAAAAAAAAAAHYWRhcHRlcgAAAAATAAAAAAAAAAxhbGxvd19ib3Jyb3cAAAABAAAAAAAAAAthbGxvd19yZXBheQAAAAABAAAAAAAAAAxhbGxvd19zdXBwbHkAAAABAAAAAAAAAA5hbGxvd193aXRoZHJhdwAAAAAAAQAAAAAAAAAHZW5hYmxlZAAAAAABAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAA==",
        "AAAAAQAAAAAAAAAAAAAAEkNyZWRpdE1hcmtldFN0YXR1cwAAAAAADgAAAAAAAAAKZGVidF92YWx1ZQAAAAAACwAAAAAAAAAUaGFzX2Rpc2FibGVkX3Jlc2VydmUAAAABAAAAAAAAABtoYXNfZnV0dXJlX29yYWNsZV90aW1lc3RhbXAAAAAAAQAAAAAAAAAXaGFzX2ludmFsaWRfb3JhY2xlX2RhdGEAAAAAAQAAAAAAAAAQaGFzX2xpdmVfcHJpY2luZwAAAAEAAAAAAAAAEGhhc19zdGFsZV9vcmFjbGUAAAABAAAAAAAAAA1oZWFsdGhfZmFjdG9yAAAAAAAACwAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAAAAAAObWF4X29yYWNsZV9hZ2UAAAAAAAYAAAAAAAAAEW1pbl9oZWFsdGhfZmFjdG9yAAAAAAAACwAAAAAAAAALbmF2X2Jsb2NrZWQAAAAAAQAAAAAAAAAKb3JhY2xlX2FnZQAAAAAABgAAAAAAAAALcG9vbF9zdGF0dXMAAAAABAAAAAAAAAAVcmlza3lfYWN0aW9uc19ibG9ja2VkAAAAAAAAAQ==",
        "AAAAAAAAAAAAAAAVYmxlbmRfcG9zaXRpb25fdmFsdWVzAAAAAAAAAQAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAEAAAPqAAAH0AAAABJCbGVuZFBvc2l0aW9uVmFsdWUAAA==",
        "AAAAAAAAAAAAAAAVY2xlYXJfYm9vdHN0cmFwX2FkbWluAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAVY3JlZGl0X21hcmtldF9jb25maWdzAAAAAAAAAQAAAAAAAAAIcHJvdG9jb2wAAAfQAAAADkNyZWRpdFByb3RvY29sAAAAAAABAAAD6gAAB9AAAAASQ3JlZGl0TWFya2V0Q29uZmlnAAA=",
        "AAAAAAAAAAAAAAAVY3JlZGl0X3Bvc2l0aW9uX3ZhbHVlAAAAAAAAAwAAAAAAAAAIcHJvdG9jb2wAAAfQAAAADkNyZWRpdFByb3RvY29sAAAAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAPoAAAH0AAAABNDcmVkaXRQb3NpdGlvblZhbHVlAA==",
        "AAAAAAAAAAAAAAAVc2V0X2JsZW5kX3Jpc2tfcG9saWN5AAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAltYXJrZXRfaWQAAAAAAAAKAAAAAAAAAA5tYXhfb3JhY2xlX2FnZQAAAAAABgAAAAAAAAARbWluX2hlYWx0aF9mYWN0b3IAAAAAAAALAAAAAAAAAA5mYWlsX2Nsb3NlX25hdgAAAAAAAQAAAAAAAAASZmFpbF9jbG9zZV9hY3Rpb25zAAAAAAABAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAAE0NyZWRpdFBvc2l0aW9uVmFsdWUAAAAADQAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjX2ZhY3RvcgAAAAQAAAAAAAAAEWNvbGxhdGVyYWxfYW1vdW50AAAAAAAACwAAAAAAAAARY29sbGF0ZXJhbF9zaGFyZXMAAAAAAAALAAAAAAAAABBjb2xsYXRlcmFsX3ZhbHVlAAAACwAAAAAAAAALZGVidF9hbW91bnQAAAAACwAAAAAAAAALZGVidF9zaGFyZXMAAAAACwAAAAAAAAAKZGVidF92YWx1ZQAAAAAACwAAAAAAAAANaGVhbHRoX2ZhY3RvcgAAAAAAAAsAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAACW5ldF92YWx1ZQAAAAAAAAsAAAAAAAAAEG9yYWNsZV90aW1lc3RhbXAAAAAGAAAAAAAAAAVwcmljZQAAAAAAAAs=",
        "AAAAAAAAAAAAAAAWYm9vdHN0cmFwX2FkbWluX2FjdGl2ZQAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAWY3JlZGl0X3Bvc2l0aW9uX3ZhbHVlcwAAAAAAAgAAAAAAAAAIcHJvdG9jb2wAAAfQAAAADkNyZWRpdFByb3RvY29sAAAAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAABAAAD6gAAB9AAAAATQ3JlZGl0UG9zaXRpb25WYWx1ZQA=",
        "AAAAAAAAAAAAAAAWcHJldmlld19mZWVfc2V0dGxlbWVudAAAAAAAAAAAAAEAAAfQAAAADUZlZVNldHRsZW1lbnQAAAA=",
        "AAAAAAAAAAAAAAAXY29uZmlndXJlX2NyZWRpdF9tYXJrZXQAAAAACQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhwcm90b2NvbAAAB9AAAAAOQ3JlZGl0UHJvdG9jb2wAAAAAAAAAAAAJbWFya2V0X2lkAAAAAAAACgAAAAAAAAAHYWRhcHRlcgAAAAATAAAAAAAAAAxhbGxvd19zdXBwbHkAAAABAAAAAAAAAAxhbGxvd19ib3Jyb3cAAAABAAAAAAAAAAthbGxvd19yZXBheQAAAAABAAAAAAAAAA5hbGxvd193aXRoZHJhdwAAAAAAAQAAAAAAAAAHZW5hYmxlZAAAAAABAAAAAA==",
        "AAAAAAAAAAAAAAAXc2V0X3Byb3RvY29sX2ZlZV9wb2xpY3kAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAEW1nbXRfcHJvdG9jb2xfYnBzAAAAAAAABQAAAAAAAAARcGVyZl9wcm90b2NvbF9icHMAAAAAAAAFAAAAAA==",
        "AAAAAAAAAAAAAAAaYmxlbmRfZXh0ZXJuYWxfZGlhZ25vc3RpY3MAAAAAAAEAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAaYm9vdHN0cmFwX2FkbWluX2V4cGlyZXNfYXQAAAAAAAAAAAABAAAD6AAAAAY=",
        "AAAAAAAAAAAAAAAac2V0X2Jvb3RzdHJhcF9hZG1pbl9leHBpcnkAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAec2V0X2JsZW5kX2V4dGVybmFsX2RpYWdub3N0aWNzAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACW1hcmtldF9pZAAAAAAAAAoAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    nav: this.txFromJSON<i128>,
        fees: this.txFromJSON<FeeStructure>,
        init: this.txFromJSON<null>,
        redeem: this.txFromJSON<i128>,
        router: this.txFromJSON<string>,
        deposit: this.txFromJSON<i128>,
        manager: this.txFromJSON<string>,
        upgrade: this.txFromJSON<null>,
        governor: this.txFromJSON<Option<string>>,
        set_fees: this.txFromJSON<null>,
        fee_state: this.txFromJSON<FeeState>,
        rebalance: this.txFromJSON<i128>,
        shares_of: this.txFromJSON<i128>,
        whitelist: this.txFromJSON<Array<Asset>>,
        blend_lend: this.txFromJSON<i128>,
        set_router: this.txFromJSON<null>,
        blend_repay: this.txFromJSON<i128>,
        settle_fees: this.txFromJSON<FeeSettlement>,
        set_manager: this.txFromJSON<null>,
        share_token: this.txFromJSON<Option<string>>,
        swap_oracle: this.txFromJSON<Option<string>>,
        blend_borrow: this.txFromJSON<i128>,
        credit_repay: this.txFromJSON<i128>,
        denomination: this.txFromJSON<Asset>,
        set_governor: this.txFromJSON<null>,
        blend_markets: this.txFromJSON<Array<u128>>,
        credit_borrow: this.txFromJSON<i128>,
        credit_supply: this.txFromJSON<i128>,
        set_whitelist: this.txFromJSON<null>,
        blend_position: this.txFromJSON<Option<BlendPosition>>,
        blend_withdraw: this.txFromJSON<i128>,
        credit_markets: this.txFromJSON<Array<u128>>,
        last_wasm_hash: this.txFromJSON<Option<Buffer>>,
        liquid_balance: this.txFromJSON<i128>,
        venue_registry: this.txFromJSON<Option<string>>,
        allowed_routers: this.txFromJSON<Array<string>>,
        blend_positions: this.txFromJSON<Array<BlendPosition>>,
        bootstrap_admin: this.txFromJSON<Option<string>>,
        credit_position: this.txFromJSON<Option<CreditPosition>>,
        credit_withdraw: this.txFromJSON<i128>,
        set_share_token: this.txFromJSON<null>,
        set_swap_oracle: this.txFromJSON<null>,
        allowed_adapters: this.txFromJSON<Array<string>>,
        credit_positions: this.txFromJSON<Array<CreditPosition>>,
        credit_protocols: this.txFromJSON<Array<CreditProtocol>>,
        swap_risk_policy: this.txFromJSON<SwapRiskPolicy>,
        blend_risk_policy: this.txFromJSON<BlendRiskPolicy>,
        protocol_treasury: this.txFromJSON<Option<string>>,
        blend_market_value: this.txFromJSON<Option<BlendMarketValue>>,
        credit_risk_policy: this.txFromJSON<CreditRiskPolicy>,
        set_allowed_venues: this.txFromJSON<null>,
        set_venue_registry: this.txFromJSON<null>,
        blend_health_factor: this.txFromJSON<Option<i128>>,
        blend_market_assets: this.txFromJSON<Array<string>>,
        blend_market_status: this.txFromJSON<Option<BlendMarketStatus>>,
        credit_market_value: this.txFromJSON<Option<CreditMarketValue>>,
        protocol_fee_policy: this.txFromJSON<ProtocolFeePolicy>,
        set_bootstrap_admin: this.txFromJSON<null>,
        blend_position_value: this.txFromJSON<Option<BlendPositionValue>>,
        clear_venue_registry: this.txFromJSON<null>,
        credit_health_factor: this.txFromJSON<Option<i128>>,
        credit_market_assets: this.txFromJSON<Array<string>>,
        credit_market_config: this.txFromJSON<Option<CreditMarketConfig>>,
        credit_market_status: this.txFromJSON<Option<CreditMarketStatus>>,
        set_swap_risk_policy: this.txFromJSON<null>,
        blend_position_values: this.txFromJSON<Array<BlendPositionValue>>,
        clear_bootstrap_admin: this.txFromJSON<null>,
        credit_market_configs: this.txFromJSON<Array<CreditMarketConfig>>,
        credit_position_value: this.txFromJSON<Option<CreditPositionValue>>,
        set_blend_risk_policy: this.txFromJSON<null>,
        bootstrap_admin_active: this.txFromJSON<boolean>,
        credit_position_values: this.txFromJSON<Array<CreditPositionValue>>,
        preview_fee_settlement: this.txFromJSON<FeeSettlement>,
        configure_credit_market: this.txFromJSON<null>,
        set_protocol_fee_policy: this.txFromJSON<null>,
        blend_external_diagnostics: this.txFromJSON<boolean>,
        bootstrap_admin_expires_at: this.txFromJSON<Option<u64>>,
        set_bootstrap_admin_expiry: this.txFromJSON<null>,
        set_blend_external_diagnostics: this.txFromJSON<null>
  }
}