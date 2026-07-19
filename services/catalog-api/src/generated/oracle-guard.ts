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
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidPolicy"},
  5: {message:"InvalidGuardian"},
  6: {message:"InvalidBootstrapAdmin"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Governor", values: void} | {tag: "BootstrapAdminExpiresAt", values: void} | {tag: "Guardian", values: void} | {tag: "GuardianExpiresAt", values: void} | {tag: "Policy", values: readonly [OracleAsset]} | {tag: "ProviderAsset", values: readonly [OracleAsset, string]} | {tag: "Paused", values: readonly [OracleAsset]} | {tag: "LastWasmHash", values: void};


export interface AssetPolicy {
  divergence_mode: u32;
  has_secondary: boolean;
  max_deviation_bps: u32;
  max_price_age: u64;
  primary: string;
  require_secondary: boolean;
  secondary: string;
}

export type OracleAsset = {tag: "Stellar", values: readonly [string]} | {tag: "Other", values: readonly [string]};


export interface GuardianConfig {
  active: boolean;
  expires_at: u64;
  guardian: Option<string>;
}


export interface AssetInspection {
  deviation_bps: u32;
  diverged: boolean;
  price: i128;
  primary_price: i128;
  primary_timestamp: u64;
  primary_usable: boolean;
  secondary_configured: boolean;
  secondary_price: i128;
  secondary_timestamp: u64;
  secondary_usable: boolean;
  selected_source: u32;
  timestamp: u64;
}


export interface OraclePriceData {
  price: i128;
  timestamp: u64;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a guardian transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  guardian: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a lastprice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  lastprice: ({asset}: {asset: OracleAsset}, options?: MethodOptions) => Promise<AssembledTransaction<OraclePriceData>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({caller, admin}: {caller: string, admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_governor: ({caller, governor}: {caller: string, governor: Option<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_guardian transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_guardian: ({caller, guardian, expires_at}: {caller: string, guardian: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_guardian transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_guardian: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a inspect_symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  inspect_symbol: ({symbol}: {symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<AssetInspection>>

  /**
   * Construct and simulate a last_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  last_wasm_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a guardian_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  guardian_config: (options?: MethodOptions) => Promise<AssembledTransaction<GuardianConfig>>

  /**
   * Construct and simulate a inspect_stellar transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  inspect_stellar: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<AssetInspection>>

  /**
   * Construct and simulate a is_guardian_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_guardian_active: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a guardian_expires_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  guardian_expires_at: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u64>>>

  /**
   * Construct and simulate a symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol_asset_policy: ({symbol}: {symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<AssetPolicy>>>

  /**
   * Construct and simulate a stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  stellar_asset_policy: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<AssetPolicy>>>

  /**
   * Construct and simulate a symbol_provider_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol_provider_asset: ({symbol, provider}: {symbol: string, provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<OracleAsset>>>

  /**
   * Construct and simulate a bootstrap_admin_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_active: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a stellar_provider_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  stellar_provider_asset: ({asset, provider}: {asset: string, provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<OracleAsset>>>

  /**
   * Construct and simulate a set_symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_symbol_asset_policy: ({caller, symbol, primary, secondary, has_secondary, max_price_age, max_deviation_bps, require_secondary, divergence_mode}: {caller: string, symbol: string, primary: string, secondary: string, has_secondary: boolean, max_price_age: u64, max_deviation_bps: u32, require_secondary: boolean, divergence_mode: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_stellar_asset_policy: ({caller, asset, primary, secondary, has_secondary, max_price_age, max_deviation_bps, require_secondary, divergence_mode}: {caller: string, asset: string, primary: string, secondary: string, has_secondary: boolean, max_price_age: u64, max_deviation_bps: u32, require_secondary: boolean, divergence_mode: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_symbol_asset_policy: ({caller, symbol}: {caller: string, symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a pause_symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause_symbol_asset_policy: ({caller, symbol}: {caller: string, symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_symbol_provider_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_symbol_provider_asset: ({caller, symbol, provider, provider_asset}: {caller: string, symbol: string, provider: string, provider_asset: OracleAsset}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_admin_expires_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_expires_at: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u64>>>

  /**
   * Construct and simulate a clear_stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_stellar_asset_policy: ({caller, asset}: {caller: string, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a pause_stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause_stellar_asset_policy: ({caller, asset}: {caller: string, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a resume_symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume_symbol_asset_policy: ({caller, symbol}: {caller: string, symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_bootstrap_admin_expiry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_bootstrap_admin_expiry: ({caller, expires_at}: {caller: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_stellar_provider_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_stellar_provider_asset: ({caller, asset, provider, provider_asset}: {caller: string, asset: string, provider: string, provider_asset: OracleAsset}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a symbol_asset_policy_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol_asset_policy_paused: ({symbol}: {symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a clear_symbol_provider_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_symbol_provider_asset: ({caller, symbol, provider}: {caller: string, symbol: string, provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a resume_stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume_stellar_asset_policy: ({caller, asset}: {caller: string, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a stellar_asset_policy_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  stellar_asset_policy_paused: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a clear_bootstrap_admin_expiry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_bootstrap_admin_expiry: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_stellar_provider_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_stellar_provider_asset: ({caller, asset, provider}: {caller: string, asset: string, provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAEaW5pdAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAANSW52YWxpZFBvbGljeQAAAAAAAAQAAAAAAAAAD0ludmFsaWRHdWFyZGlhbgAAAAAFAAAAAAAAABVJbnZhbGlkQm9vdHN0cmFwQWRtaW4AAAAAAAAG",
        "AAAAAAAAAAAAAAAIZ3VhcmRpYW4AAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAJbGFzdHByaWNlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAfQAAAAC09yYWNsZUFzc2V0AAAAAAEAAAfQAAAAD09yYWNsZVByaWNlRGF0YQA=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAIR292ZXJub3IAAAAAAAAAAAAAABdCb290c3RyYXBBZG1pbkV4cGlyZXNBdAAAAAAAAAAAAAAAAAhHdWFyZGlhbgAAAAAAAAAAAAAAEUd1YXJkaWFuRXhwaXJlc0F0AAAAAAAAAQAAAAAAAAAGUG9saWN5AAAAAAABAAAH0AAAAAtPcmFjbGVBc3NldAAAAAABAAAAAAAAAA1Qcm92aWRlckFzc2V0AAAAAAAAAgAAB9AAAAALT3JhY2xlQXNzZXQAAAAAEwAAAAEAAAAAAAAABlBhdXNlZAAAAAAAAQAAB9AAAAALT3JhY2xlQXNzZXQAAAAAAAAAAAAAAAAMTGFzdFdhc21IYXNo",
        "AAAAAAAAAAAAAAAMc2V0X2dvdmVybm9yAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhnb3Zlcm5vcgAAA+gAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAMc2V0X2d1YXJkaWFuAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhndWFyZGlhbgAAABMAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAA",
        "AAAAAQAAAAAAAAAAAAAAC0Fzc2V0UG9saWN5AAAAAAcAAAAAAAAAD2RpdmVyZ2VuY2VfbW9kZQAAAAAEAAAAAAAAAA1oYXNfc2Vjb25kYXJ5AAAAAAAAAQAAAAAAAAARbWF4X2RldmlhdGlvbl9icHMAAAAAAAAEAAAAAAAAAA1tYXhfcHJpY2VfYWdlAAAAAAAABgAAAAAAAAAHcHJpbWFyeQAAAAATAAAAAAAAABFyZXF1aXJlX3NlY29uZGFyeQAAAAAAAAEAAAAAAAAACXNlY29uZGFyeQAAAAAAABM=",
        "AAAAAgAAAAAAAAAAAAAAC09yYWNsZUFzc2V0AAAAAAIAAAABAAAAAAAAAAdTdGVsbGFyAAAAAAEAAAATAAAAAQAAAAAAAAAFT3RoZXIAAAAAAAABAAAAEQ==",
        "AAAAAAAAAAAAAAAOY2xlYXJfZ3VhcmRpYW4AAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAOaW5zcGVjdF9zeW1ib2wAAAAAAAEAAAAAAAAABnN5bWJvbAAAAAAAEQAAAAEAAAfQAAAAD0Fzc2V0SW5zcGVjdGlvbgA=",
        "AAAAAAAAAAAAAAAObGFzdF93YXNtX2hhc2gAAAAAAAAAAAABAAAD6AAAA+4AAAAg",
        "AAAAAAAAAAAAAAAPZ3VhcmRpYW5fY29uZmlnAAAAAAAAAAABAAAH0AAAAA5HdWFyZGlhbkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAPaW5zcGVjdF9zdGVsbGFyAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAfQAAAAD0Fzc2V0SW5zcGVjdGlvbgA=",
        "AAAAAQAAAAAAAAAAAAAADkd1YXJkaWFuQ29uZmlnAAAAAAADAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAAAAAACGd1YXJkaWFuAAAD6AAAABM=",
        "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",
        "AAAAAAAAAAAAAAAaYm9vdHN0cmFwX2FkbWluX2V4cGlyZXNfYXQAAAAAAAAAAAABAAAD6AAAAAY=",
        "AAAAAAAAAAAAAAAaY2xlYXJfc3RlbGxhcl9hc3NldF9wb2xpY3kAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAacGF1c2Vfc3RlbGxhcl9hc3NldF9wb2xpY3kAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAacmVzdW1lX3N5bWJvbF9hc3NldF9wb2xpY3kAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAA==",
        "AAAAAAAAAAAAAAAac2V0X2Jvb3RzdHJhcF9hZG1pbl9leHBpcnkAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAac2V0X3N0ZWxsYXJfcHJvdmlkZXJfYXNzZXQAAAAAAAQAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAADnByb3ZpZGVyX2Fzc2V0AAAAAAfQAAAAC09yYWNsZUFzc2V0AAAAAAA=",
        "AAAAAAAAAAAAAAAac3ltYm9sX2Fzc2V0X3BvbGljeV9wYXVzZWQAAAAAAAEAAAAAAAAABnN5bWJvbAAAAAAAEQAAAAEAAAAB",
        "AAAAAAAAAAAAAAAbY2xlYXJfc3ltYm9sX3Byb3ZpZGVyX2Fzc2V0AAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAAAAAAhwcm92aWRlcgAAABMAAAAA",
        "AAAAAAAAAAAAAAAbcmVzdW1lX3N0ZWxsYXJfYXNzZXRfcG9saWN5AAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAbc3RlbGxhcl9hc3NldF9wb2xpY3lfcGF1c2VkAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAAcY2xlYXJfYm9vdHN0cmFwX2FkbWluX2V4cGlyeQAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAcY2xlYXJfc3RlbGxhcl9wcm92aWRlcl9hc3NldAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhwcm92aWRlcgAAABMAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<null>,
        admin: this.txFromJSON<string>,
        upgrade: this.txFromJSON<null>,
        guardian: this.txFromJSON<Option<string>>,
        lastprice: this.txFromJSON<OraclePriceData>,
        set_admin: this.txFromJSON<null>,
        set_governor: this.txFromJSON<null>,
        set_guardian: this.txFromJSON<null>,
        clear_guardian: this.txFromJSON<null>,
        inspect_symbol: this.txFromJSON<AssetInspection>,
        last_wasm_hash: this.txFromJSON<Option<Buffer>>,
        guardian_config: this.txFromJSON<GuardianConfig>,
        inspect_stellar: this.txFromJSON<AssetInspection>,
        is_guardian_active: this.txFromJSON<boolean>,
        guardian_expires_at: this.txFromJSON<Option<u64>>,
        symbol_asset_policy: this.txFromJSON<Option<AssetPolicy>>,
        stellar_asset_policy: this.txFromJSON<Option<AssetPolicy>>,
        symbol_provider_asset: this.txFromJSON<Option<OracleAsset>>,
        bootstrap_admin_active: this.txFromJSON<boolean>,
        stellar_provider_asset: this.txFromJSON<Option<OracleAsset>>,
        set_symbol_asset_policy: this.txFromJSON<null>,
        set_stellar_asset_policy: this.txFromJSON<null>,
        clear_symbol_asset_policy: this.txFromJSON<null>,
        pause_symbol_asset_policy: this.txFromJSON<null>,
        set_symbol_provider_asset: this.txFromJSON<null>,
        bootstrap_admin_expires_at: this.txFromJSON<Option<u64>>,
        clear_stellar_asset_policy: this.txFromJSON<null>,
        pause_stellar_asset_policy: this.txFromJSON<null>,
        resume_symbol_asset_policy: this.txFromJSON<null>,
        set_bootstrap_admin_expiry: this.txFromJSON<null>,
        set_stellar_provider_asset: this.txFromJSON<null>,
        symbol_asset_policy_paused: this.txFromJSON<boolean>,
        clear_symbol_provider_asset: this.txFromJSON<null>,
        resume_stellar_asset_policy: this.txFromJSON<null>,
        stellar_asset_policy_paused: this.txFromJSON<boolean>,
        clear_bootstrap_admin_expiry: this.txFromJSON<null>,
        clear_stellar_provider_asset: this.txFromJSON<null>
  }
}