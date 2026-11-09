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




export const Errors = {
  1: {message:"ImplNotSet"},
  2: {message:"GovernorNotSet"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidBootstrapAdmin"},
  5: {message:"InvalidSwapRiskPolicy"},
  6: {message:"InvalidValuationOracle"},
  7: {message:"ManagedCreationDisabled"},
  8: {message:"InvalidManagedTemplate"}
}

export type DataKey = {tag: "Implementation", values: void} | {tag: "ShareTokenImplementation", values: void} | {tag: "LastArka", values: void} | {tag: "Governor", values: void} | {tag: "AllArkas", values: void} | {tag: "ManagerArkas", values: readonly [string]} | {tag: "Registry", values: void} | {tag: "ProtocolTreasury", values: void} | {tag: "ProtocolMgmtFeeBps", values: void} | {tag: "ProtocolPerfFeeBps", values: void} | {tag: "CreationFeeToken", values: void} | {tag: "CreationFeeAmount", values: void} | {tag: "DefaultVenueRegistry", values: void} | {tag: "DefaultSwapOracle", values: void} | {tag: "DefaultValuationOracle", values: void} | {tag: "DefaultAllowedRouters", values: void} | {tag: "DefaultAllowedAdapters", values: void} | {tag: "DefaultSwapRiskPolicy", values: void} | {tag: "MigratedTo", values: readonly [string]} | {tag: "MigratedFrom", values: readonly [string]} | {tag: "ShareTokenByArka", values: readonly [string]} | {tag: "BootstrapAdmin", values: void} | {tag: "BootstrapAdminExpiresAt", values: void} | {tag: "LastWasmHash", values: void} | {tag: "ManagedTemplate", values: void} | {tag: "ManagedPortfolioTemplate", values: void} | {tag: "ManagedRoutesTemplate", values: void};

export type ManagedRouteFamily = {tag: "Soroswap", values: void} | {tag: "Aquarius", values: void} | {tag: "AquariusVault", values: void} | {tag: "SoroswapVault", values: void} | {tag: "Sushi", values: void};


export interface ManagedRouteBinding {
  adapter: string;
  config_hash: Buffer;
  executor: string;
  family: ManagedRouteFamily;
  path: Array<string>;
  pool_id: u128;
  venue: string;
}


/**
 * Wire-compatible with Arka's ManagedPolicy. Configuration is governed and
 * activated inside creation, before ownership/governance handoff or registration.
 */
export interface ManagedPolicy {
  blend_adapter: Option<string>;
  blend_market_id: u128;
  buffer_bps: u32;
  epoch_seconds: u64;
  manager_window: u64;
  min_request_shares: i128;
}


export interface ManagedTemplate {
  denomination: string;
  enabled: boolean;
  policy: ManagedPolicy;
}


export interface ManagedSpotRoute {
  asset: string;
  router: string;
}


export interface AtomicAuxiliaries {
  aquarius_route: string;
  oracle_guard: string;
  venue_registry: string;
}


export interface ManagedCreateConfig {
  denomination: string;
  deposit_bps: i32;
  mgmt_bps: i32;
  perf_bps: i32;
  router: string;
  template_hash: Buffer;
}


export interface DefaultSwapRiskPolicy {
  enabled: boolean;
  max_oracle_age_seconds: u64;
  max_price_impact_bps: i32;
  max_slippage_bps: i32;
  max_trade_size_bps: i32;
  max_twap_deviation_bps: i32;
  oracle_checks_enabled: boolean;
}


export interface DefaultValuationOracle {
  max_price_age: u64;
  oracle: string;
}


export interface ManagedPortfolioPolicy {
  auto_payout: boolean;
  cancel_lock_seconds: u64;
  instant_cash: boolean;
  max_slippage_bps: u32;
  routes: Array<ManagedSpotRoute>;
}

export interface Client {
  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_arkas transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_arkas: ({offset, limit}: {offset: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a create_managed_routes transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_managed_routes: ({salt, manager, config}: {salt: Buffer, manager: string, config: ManagedCreateConfig}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a managed_routes_template transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  managed_routes_template: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Array<ManagedRouteBinding>>>>

  /**
   * Construct and simulate a set_managed_routes_template transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Same governance authority as the existing managed/portfolio templates.
   * No external adapter, oracle, registry, policy or current fund is changed.
   */
  set_managed_routes_template: ({caller, bindings}: {caller: string, bindings: Array<ManagedRouteBinding>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a managed_routes_template_digest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Separate digest: a routed review pins both the old configuration and the
   * complete directional bindings. Existing V2/legacy digests keep their ABI.
   */
  managed_routes_template_digest: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a create_arka transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_arka: ({salt, manager}: {salt: Buffer, manager: string}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a migrated_to transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  migrated_to: ({old_arka}: {old_arka: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a migrate_arka transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  migrate_arka: ({old_arka, salt, manager, denomination, mgmt_bps, perf_bps, deposit_bps, redeem_bps, whitelist, router}: {old_arka: string, salt: Buffer, manager: string, denomination: string, mgmt_bps: i32, perf_bps: i32, deposit_bps: i32, redeem_bps: i32, whitelist: Array<string>, router: string}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_governor: ({governor}: {governor: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_registry: ({registry}: {registry: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a migrated_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  migrated_from: ({new_arka}: {new_arka: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a create_managed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_managed: ({salt, manager, config}: {salt: Buffer, manager: string, config: ManagedCreateConfig}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a last_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  last_wasm_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a share_token_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  share_token_of: ({arka}: {arka: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a create_and_init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_and_init: ({salt, manager, denomination, mgmt_bps, perf_bps, deposit_bps, redeem_bps, whitelist, router}: {salt: Buffer, manager: string, denomination: string, mgmt_bps: i32, perf_bps: i32, deposit_bps: i32, redeem_bps: i32, whitelist: Array<string>, router: string}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_creation_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_creation_fee: ({token, amount}: {token: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_implementation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the WASM hash used when the factory creates a new Arka.
   */
  get_implementation: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a set_implementation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_implementation: ({impl_wasm_hash}: {impl_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_bootstrap_admin: ({caller, admin, expires_at}: {caller: string, admin: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_arkas_by_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_arkas_by_manager: ({manager, offset, limit}: {manager: string, offset: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a set_managed_template transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_managed_template: ({caller, template}: {caller: string, template: ManagedTemplate}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_auxiliaries transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create the three constructor-only auxiliary implementations atomically.
   * Code identities are fixed; this is not an arbitrary privileged executor.
   */
  bootstrap_auxiliaries: ({guard_salt, registry_salt, route_salt, router, expires_at}: {guard_salt: Buffer, registry_salt: Buffer, route_salt: Buffer, router: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<AtomicAuxiliaries>>

  /**
   * Construct and simulate a clear_bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_bootstrap_admin: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_protocol_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_protocol_treasury: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_protocol_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_protocol_treasury: ({treasury}: {treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_admin_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_active: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_creation_fee_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_creation_fee_token: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_portfolio_template transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_portfolio_template: ({caller, portfolio}: {caller: string, portfolio: Option<ManagedPortfolioPolicy>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_creation_fee_amount transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_creation_fee_amount: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_default_swap_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_default_swap_oracle: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a managed_template_digest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  managed_template_digest: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a set_default_swap_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_default_swap_oracle: ({oracle}: {oracle: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_protocol_fee_splits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_protocol_fee_splits: ({mgmt_protocol_bps, perf_protocol_bps}: {mgmt_protocol_bps: i32, perf_protocol_bps: i32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_default_swap_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_default_swap_oracle: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_protocol_mgmt_fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_protocol_mgmt_fee_bps: (options?: MethodOptions) => Promise<AssembledTransaction<i32>>

  /**
   * Construct and simulate a get_protocol_perf_fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_protocol_perf_fee_bps: (options?: MethodOptions) => Promise<AssembledTransaction<i32>>

  /**
   * Construct and simulate a managed_creation_template transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  managed_creation_template: (options?: MethodOptions) => Promise<AssembledTransaction<Option<ManagedTemplate>>>

  /**
   * Construct and simulate a set_share_impl_controlled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_share_impl_controlled: ({caller, impl_wasm_hash}: {caller: string, impl_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_admin_expires_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_expires_at: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u64>>>

  /**
   * Construct and simulate a get_default_venue_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_default_venue_registry: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_default_allowed_venues transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_default_allowed_venues: ({allowed_routers, allowed_adapters}: {allowed_routers: Array<string>, allowed_adapters: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_default_venue_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_default_venue_registry: ({registry}: {registry: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_default_allowed_routers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_default_allowed_routers: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a portfolio_creation_template transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  portfolio_creation_template: (options?: MethodOptions) => Promise<AssembledTransaction<Option<ManagedPortfolioPolicy>>>

  /**
   * Construct and simulate a clear_default_venue_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_default_venue_registry: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_default_allowed_adapters transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_default_allowed_adapters: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a get_default_swap_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_default_swap_risk_policy: (options?: MethodOptions) => Promise<AssembledTransaction<Option<DefaultSwapRiskPolicy>>>

  /**
   * Construct and simulate a get_default_valuation_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_default_valuation_oracle: (options?: MethodOptions) => Promise<AssembledTransaction<Option<DefaultValuationOracle>>>

  /**
   * Construct and simulate a set_default_swap_risk_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_default_swap_risk_policy: ({enabled, oracle_checks_enabled, max_price_impact_bps, max_slippage_bps, max_twap_deviation_bps, max_oracle_age_seconds, max_trade_size_bps}: {enabled: boolean, oracle_checks_enabled: boolean, max_price_impact_bps: i32, max_slippage_bps: i32, max_twap_deviation_bps: i32, max_oracle_age_seconds: u64, max_trade_size_bps: i32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_default_valuation_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_default_valuation_oracle: ({oracle, max_price_age}: {oracle: string, max_price_age: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_implementation_controlled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_implementation_controlled: ({caller, impl_wasm_hash}: {caller: string, impl_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_default_valuation_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_default_valuation_oracle: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_share_token_implementation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_share_token_implementation: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a set_share_token_implementation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_share_token_implementation: ({impl_wasm_hash}: {impl_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {governor}: {governor: string},
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
    return ContractClient.deploy({governor}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAAKSW1wbE5vdFNldAAAAAAAAQAAAAAAAAAOR292ZXJub3JOb3RTZXQAAAAAAAIAAAAAAAAADFVuYXV0aG9yaXplZAAAAAMAAAAAAAAAFUludmFsaWRCb290c3RyYXBBZG1pbgAAAAAAAAQAAAAAAAAAFUludmFsaWRTd2FwUmlza1BvbGljeQAAAAAAAAUAAAAAAAAAFkludmFsaWRWYWx1YXRpb25PcmFjbGUAAAAAAAYAAAAAAAAAF01hbmFnZWRDcmVhdGlvbkRpc2FibGVkAAAAAAcAAAAAAAAAFkludmFsaWRNYW5hZ2VkVGVtcGxhdGUAAAAAAAg=",
        "AAAAAAAAAAAAAAAJZ2V0X2Fya2FzAAAAAAAAAgAAAAAAAAAGb2Zmc2V0AAAAAAAEAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6gAAABM=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAGwAAAAAAAAAAAAAADkltcGxlbWVudGF0aW9uAAAAAAAAAAAAAAAAABhTaGFyZVRva2VuSW1wbGVtZW50YXRpb24AAAAAAAAAAAAAAAhMYXN0QXJrYQAAAAAAAAAAAAAACEdvdmVybm9yAAAAAAAAAAAAAAAIQWxsQXJrYXMAAAABAAAAAAAAAAxNYW5hZ2VyQXJrYXMAAAABAAAAEwAAAAAAAAAAAAAACFJlZ2lzdHJ5AAAAAAAAAAAAAAAQUHJvdG9jb2xUcmVhc3VyeQAAAAAAAAAAAAAAElByb3RvY29sTWdtdEZlZUJwcwAAAAAAAAAAAAAAAAASUHJvdG9jb2xQZXJmRmVlQnBzAAAAAAAAAAAAAAAAABBDcmVhdGlvbkZlZVRva2VuAAAAAAAAAAAAAAARQ3JlYXRpb25GZWVBbW91bnQAAAAAAAAAAAAAAAAAABREZWZhdWx0VmVudWVSZWdpc3RyeQAAAAAAAAAAAAAAEURlZmF1bHRTd2FwT3JhY2xlAAAAAAAAAAAAAAAAAAAWRGVmYXVsdFZhbHVhdGlvbk9yYWNsZQAAAAAAAAAAAAAAAAAVRGVmYXVsdEFsbG93ZWRSb3V0ZXJzAAAAAAAAAAAAAAAAAAAWRGVmYXVsdEFsbG93ZWRBZGFwdGVycwAAAAAAAAAAAAAAAAAVRGVmYXVsdFN3YXBSaXNrUG9saWN5AAAAAAAAAQAAAAAAAAAKTWlncmF0ZWRUbwAAAAAAAQAAABMAAAABAAAAAAAAAAxNaWdyYXRlZEZyb20AAAABAAAAEwAAAAEAAAAAAAAAEFNoYXJlVG9rZW5CeUFya2EAAAABAAAAEwAAAAAAAAAAAAAADkJvb3RzdHJhcEFkbWluAAAAAAAAAAAAAAAAABdCb290c3RyYXBBZG1pbkV4cGlyZXNBdAAAAAAAAAAAAAAAAAxMYXN0V2FzbUhhc2gAAAAAAAAAAAAAAA9NYW5hZ2VkVGVtcGxhdGUAAAAAAAAAAAAAAAAYTWFuYWdlZFBvcnRmb2xpb1RlbXBsYXRlAAAAAAAAAAAAAAAVTWFuYWdlZFJvdXRlc1RlbXBsYXRlAAAA",
        "AAAAAgAAAAAAAAAAAAAAEk1hbmFnZWRSb3V0ZUZhbWlseQAAAAAABQAAAAAAAAAAAAAACFNvcm9zd2FwAAAAAAAAAAAAAAAIQXF1YXJpdXMAAAAAAAAAAAAAAA1BcXVhcml1c1ZhdWx0AAAAAAAAAAAAAAAAAAANU29yb3N3YXBWYXVsdAAAAAAAAAAAAAAAAAAABVN1c2hpAAAA",
        "AAAAAAAAAAAAAAAVY3JlYXRlX21hbmFnZWRfcm91dGVzAAAAAAAAAwAAAAAAAAAEc2FsdAAAAA4AAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAGY29uZmlnAAAAAAfQAAAAE01hbmFnZWRDcmVhdGVDb25maWcAAAAAAQAAABM=",
        "AAAAAQAAAAAAAAAAAAAAE01hbmFnZWRSb3V0ZUJpbmRpbmcAAAAABwAAAAAAAAAHYWRhcHRlcgAAAAATAAAAAAAAAAtjb25maWdfaGFzaAAAAAPuAAAAIAAAAAAAAAAIZXhlY3V0b3IAAAATAAAAAAAAAAZmYW1pbHkAAAAAB9AAAAASTWFuYWdlZFJvdXRlRmFtaWx5AAAAAAAAAAAABHBhdGgAAAPqAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAKAAAAAAAAAAV2ZW51ZQAAAAAAABM=",
        "AAAAAAAAAAAAAAAXbWFuYWdlZF9yb3V0ZXNfdGVtcGxhdGUAAAAAAAAAAAEAAAPoAAAD6gAAB9AAAAATTWFuYWdlZFJvdXRlQmluZGluZwA=",
        "AAAAAAAAAJBTYW1lIGdvdmVybmFuY2UgYXV0aG9yaXR5IGFzIHRoZSBleGlzdGluZyBtYW5hZ2VkL3BvcnRmb2xpbyB0ZW1wbGF0ZXMuCk5vIGV4dGVybmFsIGFkYXB0ZXIsIG9yYWNsZSwgcmVnaXN0cnksIHBvbGljeSBvciBjdXJyZW50IGZ1bmQgaXMgY2hhbmdlZC4AAAAbc2V0X21hbmFnZWRfcm91dGVzX3RlbXBsYXRlAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAIYmluZGluZ3MAAAPqAAAH0AAAABNNYW5hZ2VkUm91dGVCaW5kaW5nAAAAAAA=",
        "AAAAAAAAAJJTZXBhcmF0ZSBkaWdlc3Q6IGEgcm91dGVkIHJldmlldyBwaW5zIGJvdGggdGhlIG9sZCBjb25maWd1cmF0aW9uIGFuZCB0aGUKY29tcGxldGUgZGlyZWN0aW9uYWwgYmluZGluZ3MuIEV4aXN0aW5nIFYyL2xlZ2FjeSBkaWdlc3RzIGtlZXAgdGhlaXIgQUJJLgAAAAAAHm1hbmFnZWRfcm91dGVzX3RlbXBsYXRlX2RpZ2VzdAAAAAAAAAAAAAEAAAPoAAAD7gAAACA=",
        "AAAAAAAAAAAAAAALY3JlYXRlX2Fya2EAAAAAAgAAAAAAAAAEc2FsdAAAAA4AAAAAAAAAB21hbmFnZXIAAAAAEwAAAAEAAAAT",
        "AAAAAAAAAAAAAAALbWlncmF0ZWRfdG8AAAAAAQAAAAAAAAAIb2xkX2Fya2EAAAATAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAMbWlncmF0ZV9hcmthAAAACgAAAAAAAAAIb2xkX2Fya2EAAAATAAAAAAAAAARzYWx0AAAADgAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAxkZW5vbWluYXRpb24AAAATAAAAAAAAAAhtZ210X2JwcwAAAAUAAAAAAAAACHBlcmZfYnBzAAAABQAAAAAAAAALZGVwb3NpdF9icHMAAAAABQAAAAAAAAAKcmVkZWVtX2JwcwAAAAAABQAAAAAAAAAJd2hpdGVsaXN0AAAAAAAD6gAAABMAAAAAAAAABnJvdXRlcgAAAAAAEwAAAAEAAAAT",
        "AAAAAAAAAAAAAAAMc2V0X2dvdmVybm9yAAAAAQAAAAAAAAAIZ292ZXJub3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANbWlncmF0ZWRfZnJvbQAAAAAAAAEAAAAAAAAACG5ld19hcmthAAAAEwAAAAEAAAPoAAAAEw==",
        "AAAAAAAAANFOZXcgaW5zdGFuY2VzIGFyZSBvd25lZCBpbnNpZGUgdGhlIGhvc3QncyBhdG9taWMgY3JlYXRlIGludm9jYXRpb24uCk5vIHB1YmxpYyBwb3N0LWRlcGxveW1lbnQgaW5pdGlhbGl6YXRpb24gb3IgaW1wbGljaXQgZGVwbG95ZXIgcHJpdmlsZWdlLgpBIHNlcGFyYXRlIGdvdmVybm9yIGlzIHN1cHBvcnRlZCwgYnV0IG11c3QgYXV0aG9yaXplIGl0cyBhc3NpZ25tZW50LgAAAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAQAAAAAAAAAIZ292ZXJub3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAOY3JlYXRlX21hbmFnZWQAAAAAAAMAAAAAAAAABHNhbHQAAAAOAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAAAAAAABmNvbmZpZwAAAAAH0AAAABNNYW5hZ2VkQ3JlYXRlQ29uZmlnAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAObGFzdF93YXNtX2hhc2gAAAAAAAAAAAABAAAD6AAAA+4AAAAg",
        "AAAAAAAAAAAAAAAOc2hhcmVfdG9rZW5fb2YAAAAAAAEAAAAAAAAABGFya2EAAAATAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAPYm9vdHN0cmFwX2FkbWluAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAAAAAAAAPY3JlYXRlX2FuZF9pbml0AAAAAAkAAAAAAAAABHNhbHQAAAAOAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAAAAAAADGRlbm9taW5hdGlvbgAAABMAAAAAAAAACG1nbXRfYnBzAAAABQAAAAAAAAAIcGVyZl9icHMAAAAFAAAAAAAAAAtkZXBvc2l0X2JwcwAAAAAFAAAAAAAAAApyZWRlZW1fYnBzAAAAAAAFAAAAAAAAAAl3aGl0ZWxpc3QAAAAAAAPqAAAAEwAAAAAAAAAGcm91dGVyAAAAAAATAAAAAQAAABM=",
        "AAAAAQAAAJhXaXJlLWNvbXBhdGlibGUgd2l0aCBBcmthJ3MgTWFuYWdlZFBvbGljeS4gQ29uZmlndXJhdGlvbiBpcyBnb3Zlcm5lZCBhbmQKYWN0aXZhdGVkIGluc2lkZSBjcmVhdGlvbiwgYmVmb3JlIG93bmVyc2hpcC9nb3Zlcm5hbmNlIGhhbmRvZmYgb3IgcmVnaXN0cmF0aW9uLgAAAAAAAAANTWFuYWdlZFBvbGljeQAAAAAAAAYAAAAAAAAADWJsZW5kX2FkYXB0ZXIAAAAAAAPoAAAAEwAAAAAAAAAPYmxlbmRfbWFya2V0X2lkAAAAAAoAAAAAAAAACmJ1ZmZlcl9icHMAAAAAAAQAAAAAAAAADWVwb2NoX3NlY29uZHMAAAAAAAAGAAAAAAAAAA5tYW5hZ2VyX3dpbmRvdwAAAAAABgAAAAAAAAASbWluX3JlcXVlc3Rfc2hhcmVzAAAAAAAL",
        "AAAAAAAAAAAAAAAQc2V0X2NyZWF0aW9uX2ZlZQAAAAIAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAAD01hbmFnZWRUZW1wbGF0ZQAAAAADAAAAAAAAAAxkZW5vbWluYXRpb24AAAATAAAAAAAAAAdlbmFibGVkAAAAAAEAAAAAAAAABnBvbGljeQAAAAAH0AAAAA1NYW5hZ2VkUG9saWN5AAAA",
        "AAAAAAAAAD9SZXR1cm5zIHRoZSBXQVNNIGhhc2ggdXNlZCB3aGVuIHRoZSBmYWN0b3J5IGNyZWF0ZXMgYSBuZXcgQXJrYS4AAAAAEmdldF9pbXBsZW1lbnRhdGlvbgAAAAAAAAAAAAEAAAPoAAAD7gAAACA=",
        "AAAAAAAAAAAAAAASc2V0X2ltcGxlbWVudGF0aW9uAAAAAAABAAAAAAAAAA5pbXBsX3dhc21faGFzaAAAAAAD7gAAACAAAAAA",
        "AAAAAQAAAAAAAAAAAAAAEE1hbmFnZWRTcG90Um91dGUAAAACAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABnJvdXRlcgAAAAAAEw==",
        "AAAAAAAAAAAAAAATc2V0X2Jvb3RzdHJhcF9hZG1pbgAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEUF0b21pY0F1eGlsaWFyaWVzAAAAAAAAAwAAAAAAAAAOYXF1YXJpdXNfcm91dGUAAAAAABMAAAAAAAAADG9yYWNsZV9ndWFyZAAAABMAAAAAAAAADnZlbnVlX3JlZ2lzdHJ5AAAAAAAT",
        "AAAAAAAAAAAAAAAUZ2V0X2Fya2FzX2J5X21hbmFnZXIAAAADAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAAAAAAABm9mZnNldAAAAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+oAAAAT",
        "AAAAAAAAAAAAAAAUc2V0X21hbmFnZWRfdGVtcGxhdGUAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACHRlbXBsYXRlAAAH0AAAAA9NYW5hZ2VkVGVtcGxhdGUAAAAAAA==",
        "AAAAAAAAAJBDcmVhdGUgdGhlIHRocmVlIGNvbnN0cnVjdG9yLW9ubHkgYXV4aWxpYXJ5IGltcGxlbWVudGF0aW9ucyBhdG9taWNhbGx5LgpDb2RlIGlkZW50aXRpZXMgYXJlIGZpeGVkOyB0aGlzIGlzIG5vdCBhbiBhcmJpdHJhcnkgcHJpdmlsZWdlZCBleGVjdXRvci4AAAAVYm9vdHN0cmFwX2F1eGlsaWFyaWVzAAAAAAAABQAAAAAAAAAKZ3VhcmRfc2FsdAAAAAAD7gAAACAAAAAAAAAADXJlZ2lzdHJ5X3NhbHQAAAAAAAPuAAAAIAAAAAAAAAAKcm91dGVfc2FsdAAAAAAD7gAAACAAAAAAAAAABnJvdXRlcgAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAEAAAfQAAAAEUF0b21pY0F1eGlsaWFyaWVzAAAA",
        "AAAAAAAAAAAAAAAVY2xlYXJfYm9vdHN0cmFwX2FkbWluAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAVZ2V0X3Byb3RvY29sX3RyZWFzdXJ5AAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAAAAAAAVc2V0X3Byb3RvY29sX3RyZWFzdXJ5AAAAAAAAAQAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAAE01hbmFnZWRDcmVhdGVDb25maWcAAAAABgAAAAAAAAAMZGVub21pbmF0aW9uAAAAEwAAAAAAAAALZGVwb3NpdF9icHMAAAAABQAAAAAAAAAIbWdtdF9icHMAAAAFAAAAAAAAAAhwZXJmX2JwcwAAAAUAAAAAAAAABnJvdXRlcgAAAAAAEwAAAAAAAAANdGVtcGxhdGVfaGFzaAAAAAAAA+4AAAAg",
        "AAAAAAAAAAAAAAAWYm9vdHN0cmFwX2FkbWluX2FjdGl2ZQAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAWZ2V0X2NyZWF0aW9uX2ZlZV90b2tlbgAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAAAAAAAWc2V0X3BvcnRmb2xpb190ZW1wbGF0ZQAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAlwb3J0Zm9saW8AAAAAAAPoAAAH0AAAABZNYW5hZ2VkUG9ydGZvbGlvUG9saWN5AAAAAAAA",
        "AAAAAAAAAAAAAAAXZ2V0X2NyZWF0aW9uX2ZlZV9hbW91bnQAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAAXZ2V0X2RlZmF1bHRfc3dhcF9vcmFjbGUAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAAAAAAAXbWFuYWdlZF90ZW1wbGF0ZV9kaWdlc3QAAAAAAAAAAAEAAAPoAAAD7gAAACA=",
        "AAAAAAAAAAAAAAAXc2V0X2RlZmF1bHRfc3dhcF9vcmFjbGUAAAAAAQAAAAAAAAAGb3JhY2xlAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAXc2V0X3Byb3RvY29sX2ZlZV9zcGxpdHMAAAAAAgAAAAAAAAARbWdtdF9wcm90b2NvbF9icHMAAAAAAAAFAAAAAAAAABFwZXJmX3Byb3RvY29sX2JwcwAAAAAAAAUAAAAA",
        "AAAAAQAAAAAAAAAAAAAAFURlZmF1bHRTd2FwUmlza1BvbGljeQAAAAAAAAcAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAAAAAAWbWF4X29yYWNsZV9hZ2Vfc2Vjb25kcwAAAAAABgAAAAAAAAAUbWF4X3ByaWNlX2ltcGFjdF9icHMAAAAFAAAAAAAAABBtYXhfc2xpcHBhZ2VfYnBzAAAABQAAAAAAAAASbWF4X3RyYWRlX3NpemVfYnBzAAAAAAAFAAAAAAAAABZtYXhfdHdhcF9kZXZpYXRpb25fYnBzAAAAAAAFAAAAAAAAABVvcmFjbGVfY2hlY2tzX2VuYWJsZWQAAAAAAAAB",
        "AAAAAQAAAAAAAAAAAAAAFkRlZmF1bHRWYWx1YXRpb25PcmFjbGUAAAAAAAIAAAAAAAAADW1heF9wcmljZV9hZ2UAAAAAAAAGAAAAAAAAAAZvcmFjbGUAAAAAABM=",
        "AAAAAQAAAAAAAAAAAAAAFk1hbmFnZWRQb3J0Zm9saW9Qb2xpY3kAAAAAAAUAAAAAAAAAC2F1dG9fcGF5b3V0AAAAAAEAAAAAAAAAE2NhbmNlbF9sb2NrX3NlY29uZHMAAAAABgAAAAAAAAAMaW5zdGFudF9jYXNoAAAAAQAAAAAAAAAQbWF4X3NsaXBwYWdlX2JwcwAAAAQAAAAAAAAABnJvdXRlcwAAAAAD6gAAB9AAAAAQTWFuYWdlZFNwb3RSb3V0ZQ==",
        "AAAAAAAAAAAAAAAZY2xlYXJfZGVmYXVsdF9zd2FwX29yYWNsZQAAAAAAAAAAAAAA",
        "AAAAAAAAAAAAAAAZZ2V0X3Byb3RvY29sX21nbXRfZmVlX2JwcwAAAAAAAAAAAAABAAAABQ==",
        "AAAAAAAAAAAAAAAZZ2V0X3Byb3RvY29sX3BlcmZfZmVlX2JwcwAAAAAAAAAAAAABAAAABQ==",
        "AAAAAAAAAAAAAAAZbWFuYWdlZF9jcmVhdGlvbl90ZW1wbGF0ZQAAAAAAAAAAAAABAAAD6AAAB9AAAAAPTWFuYWdlZFRlbXBsYXRlAA==",
        "AAAAAAAAAAAAAAAZc2V0X3NoYXJlX2ltcGxfY29udHJvbGxlZAAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAOaW1wbF93YXNtX2hhc2gAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAAAAAAAAaYm9vdHN0cmFwX2FkbWluX2V4cGlyZXNfYXQAAAAAAAAAAAABAAAD6AAAAAY=",
        "AAAAAAAAAAAAAAAaZ2V0X2RlZmF1bHRfdmVudWVfcmVnaXN0cnkAAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAAAAAAAAac2V0X2RlZmF1bHRfYWxsb3dlZF92ZW51ZXMAAAAAAAIAAAAAAAAAD2FsbG93ZWRfcm91dGVycwAAAAPqAAAAEwAAAAAAAAAQYWxsb3dlZF9hZGFwdGVycwAAA+oAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAac2V0X2RlZmF1bHRfdmVudWVfcmVnaXN0cnkAAAAAAAEAAAAAAAAACHJlZ2lzdHJ5AAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAbZ2V0X2RlZmF1bHRfYWxsb3dlZF9yb3V0ZXJzAAAAAAAAAAABAAAD6gAAABM=",
        "AAAAAAAAAAAAAAAbcG9ydGZvbGlvX2NyZWF0aW9uX3RlbXBsYXRlAAAAAAAAAAABAAAD6AAAB9AAAAAWTWFuYWdlZFBvcnRmb2xpb1BvbGljeQAA",
        "AAAAAAAAAAAAAAAcY2xlYXJfZGVmYXVsdF92ZW51ZV9yZWdpc3RyeQAAAAAAAAAA",
        "AAAAAAAAAAAAAAAcZ2V0X2RlZmF1bHRfYWxsb3dlZF9hZGFwdGVycwAAAAAAAAABAAAD6gAAABM=",
        "AAAAAAAAAAAAAAAcZ2V0X2RlZmF1bHRfc3dhcF9yaXNrX3BvbGljeQAAAAAAAAABAAAD6AAAB9AAAAAVRGVmYXVsdFN3YXBSaXNrUG9saWN5AAAA",
        "AAAAAAAAAAAAAAAcZ2V0X2RlZmF1bHRfdmFsdWF0aW9uX29yYWNsZQAAAAAAAAABAAAD6AAAB9AAAAAWRGVmYXVsdFZhbHVhdGlvbk9yYWNsZQAA",
        "AAAAAAAAAAAAAAAcc2V0X2RlZmF1bHRfc3dhcF9yaXNrX3BvbGljeQAAAAcAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAAAAAAVb3JhY2xlX2NoZWNrc19lbmFibGVkAAAAAAAAAQAAAAAAAAAUbWF4X3ByaWNlX2ltcGFjdF9icHMAAAAFAAAAAAAAABBtYXhfc2xpcHBhZ2VfYnBzAAAABQAAAAAAAAAWbWF4X3R3YXBfZGV2aWF0aW9uX2JwcwAAAAAABQAAAAAAAAAWbWF4X29yYWNsZV9hZ2Vfc2Vjb25kcwAAAAAABgAAAAAAAAASbWF4X3RyYWRlX3NpemVfYnBzAAAAAAAFAAAAAA==",
        "AAAAAAAAAAAAAAAcc2V0X2RlZmF1bHRfdmFsdWF0aW9uX29yYWNsZQAAAAIAAAAAAAAABm9yYWNsZQAAAAAAEwAAAAAAAAANbWF4X3ByaWNlX2FnZQAAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAAdc2V0X2ltcGxlbWVudGF0aW9uX2NvbnRyb2xsZWQAAAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADmltcGxfd2FzbV9oYXNoAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAAAAAAAeY2xlYXJfZGVmYXVsdF92YWx1YXRpb25fb3JhY2xlAAAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAeZ2V0X3NoYXJlX3Rva2VuX2ltcGxlbWVudGF0aW9uAAAAAAAAAAAAAQAAA+gAAAPuAAAAIA==",
        "AAAAAAAAAAAAAAAec2V0X3NoYXJlX3Rva2VuX2ltcGxlbWVudGF0aW9uAAAAAAABAAAAAAAAAA5pbXBsX3dhc21faGFzaAAAAAAD7gAAACAAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    upgrade: this.txFromJSON<null>,
        get_arkas: this.txFromJSON<Array<string>>,
        create_managed_routes: this.txFromJSON<string>,
        managed_routes_template: this.txFromJSON<Option<Array<ManagedRouteBinding>>>,
        set_managed_routes_template: this.txFromJSON<null>,
        managed_routes_template_digest: this.txFromJSON<Option<Buffer>>,
        create_arka: this.txFromJSON<string>,
        migrated_to: this.txFromJSON<Option<string>>,
        migrate_arka: this.txFromJSON<string>,
        set_governor: this.txFromJSON<null>,
        set_registry: this.txFromJSON<null>,
        migrated_from: this.txFromJSON<Option<string>>,
        create_managed: this.txFromJSON<string>,
        last_wasm_hash: this.txFromJSON<Option<Buffer>>,
        share_token_of: this.txFromJSON<Option<string>>,
        bootstrap_admin: this.txFromJSON<Option<string>>,
        create_and_init: this.txFromJSON<string>,
        set_creation_fee: this.txFromJSON<null>,
        get_implementation: this.txFromJSON<Option<Buffer>>,
        set_implementation: this.txFromJSON<null>,
        set_bootstrap_admin: this.txFromJSON<null>,
        get_arkas_by_manager: this.txFromJSON<Array<string>>,
        set_managed_template: this.txFromJSON<null>,
        bootstrap_auxiliaries: this.txFromJSON<AtomicAuxiliaries>,
        clear_bootstrap_admin: this.txFromJSON<null>,
        get_protocol_treasury: this.txFromJSON<Option<string>>,
        set_protocol_treasury: this.txFromJSON<null>,
        bootstrap_admin_active: this.txFromJSON<boolean>,
        get_creation_fee_token: this.txFromJSON<Option<string>>,
        set_portfolio_template: this.txFromJSON<null>,
        get_creation_fee_amount: this.txFromJSON<i128>,
        get_default_swap_oracle: this.txFromJSON<Option<string>>,
        managed_template_digest: this.txFromJSON<Option<Buffer>>,
        set_default_swap_oracle: this.txFromJSON<null>,
        set_protocol_fee_splits: this.txFromJSON<null>,
        clear_default_swap_oracle: this.txFromJSON<null>,
        get_protocol_mgmt_fee_bps: this.txFromJSON<i32>,
        get_protocol_perf_fee_bps: this.txFromJSON<i32>,
        managed_creation_template: this.txFromJSON<Option<ManagedTemplate>>,
        set_share_impl_controlled: this.txFromJSON<null>,
        bootstrap_admin_expires_at: this.txFromJSON<Option<u64>>,
        get_default_venue_registry: this.txFromJSON<Option<string>>,
        set_default_allowed_venues: this.txFromJSON<null>,
        set_default_venue_registry: this.txFromJSON<null>,
        get_default_allowed_routers: this.txFromJSON<Array<string>>,
        portfolio_creation_template: this.txFromJSON<Option<ManagedPortfolioPolicy>>,
        clear_default_venue_registry: this.txFromJSON<null>,
        get_default_allowed_adapters: this.txFromJSON<Array<string>>,
        get_default_swap_risk_policy: this.txFromJSON<Option<DefaultSwapRiskPolicy>>,
        get_default_valuation_oracle: this.txFromJSON<Option<DefaultValuationOracle>>,
        set_default_swap_risk_policy: this.txFromJSON<null>,
        set_default_valuation_oracle: this.txFromJSON<null>,
        set_implementation_controlled: this.txFromJSON<null>,
        clear_default_valuation_oracle: this.txFromJSON<null>,
        get_share_token_implementation: this.txFromJSON<Option<Buffer>>,
        set_share_token_implementation: this.txFromJSON<null>
  }
}