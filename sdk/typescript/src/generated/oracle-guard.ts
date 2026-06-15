import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
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
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidPolicy"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Policy", values: readonly [OracleAsset]};


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
  init: ({admin}: {admin: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a lastprice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  lastprice: ({asset}: {asset: OracleAsset}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<OraclePriceData>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({caller, admin}: {caller: string, admin: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a inspect_symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  inspect_symbol: ({symbol}: {symbol: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<AssetInspection>>

  /**
   * Construct and simulate a inspect_stellar transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  inspect_stellar: ({asset}: {asset: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<AssetInspection>>

  /**
   * Construct and simulate a symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol_asset_policy: ({symbol}: {symbol: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Option<AssetPolicy>>>

  /**
   * Construct and simulate a stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  stellar_asset_policy: ({asset}: {asset: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Option<AssetPolicy>>>

  /**
   * Construct and simulate a set_symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_symbol_asset_policy: ({caller, symbol, primary, secondary, has_secondary, max_price_age, max_deviation_bps, require_secondary, divergence_mode}: {caller: string, symbol: string, primary: string, secondary: string, has_secondary: boolean, max_price_age: u64, max_deviation_bps: u32, require_secondary: boolean, divergence_mode: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_stellar_asset_policy: ({caller, asset, primary, secondary, has_secondary, max_price_age, max_deviation_bps, require_secondary, divergence_mode}: {caller: string, asset: string, primary: string, secondary: string, has_secondary: boolean, max_price_age: u64, max_deviation_bps: u32, require_secondary: boolean, divergence_mode: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_symbol_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_symbol_asset_policy: ({caller, symbol}: {caller: string, symbol: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_stellar_asset_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_stellar_asset_policy: ({caller, asset}: {caller: string, asset: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

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
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABAAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAANSW52YWxpZFBvbGljeQAAAAAAAAQ=",
        "AAAAAAAAAAAAAAAJbGFzdHByaWNlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAfQAAAAC09yYWNsZUFzc2V0AAAAAAEAAAfQAAAAD09yYWNsZVByaWNlRGF0YQA=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAQAAAAAAAAAGUG9saWN5AAAAAAABAAAH0AAAAAtPcmFjbGVBc3NldAA=",
        "AAAAAQAAAAAAAAAAAAAAC0Fzc2V0UG9saWN5AAAAAAcAAAAAAAAAD2RpdmVyZ2VuY2VfbW9kZQAAAAAEAAAAAAAAAA1oYXNfc2Vjb25kYXJ5AAAAAAAAAQAAAAAAAAARbWF4X2RldmlhdGlvbl9icHMAAAAAAAAEAAAAAAAAAA1tYXhfcHJpY2VfYWdlAAAAAAAABgAAAAAAAAAHcHJpbWFyeQAAAAATAAAAAAAAABFyZXF1aXJlX3NlY29uZGFyeQAAAAAAAAEAAAAAAAAACXNlY29uZGFyeQAAAAAAABM=",
        "AAAAAgAAAAAAAAAAAAAAC09yYWNsZUFzc2V0AAAAAAIAAAABAAAAAAAAAAdTdGVsbGFyAAAAAAEAAAATAAAAAQAAAAAAAAAFT3RoZXIAAAAAAAABAAAAEQ==",
        "AAAAAAAAAAAAAAAOaW5zcGVjdF9zeW1ib2wAAAAAAAEAAAAAAAAABnN5bWJvbAAAAAAAEQAAAAEAAAfQAAAAD0Fzc2V0SW5zcGVjdGlvbgA=",
        "AAAAAAAAAAAAAAAPaW5zcGVjdF9zdGVsbGFyAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAfQAAAAD0Fzc2V0SW5zcGVjdGlvbgA=",
        "AAAAAQAAAAAAAAAAAAAAD0Fzc2V0SW5zcGVjdGlvbgAAAAAMAAAAAAAAAA1kZXZpYXRpb25fYnBzAAAAAAAABAAAAAAAAAAIZGl2ZXJnZWQAAAABAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAADXByaW1hcnlfcHJpY2UAAAAAAAALAAAAAAAAABFwcmltYXJ5X3RpbWVzdGFtcAAAAAAAAAYAAAAAAAAADnByaW1hcnlfdXNhYmxlAAAAAAABAAAAAAAAABRzZWNvbmRhcnlfY29uZmlndXJlZAAAAAEAAAAAAAAAD3NlY29uZGFyeV9wcmljZQAAAAALAAAAAAAAABNzZWNvbmRhcnlfdGltZXN0YW1wAAAAAAYAAAAAAAAAEHNlY29uZGFyeV91c2FibGUAAAABAAAAAAAAAA9zZWxlY3RlZF9zb3VyY2UAAAAABAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==",
        "AAAAAQAAAAAAAAAAAAAAD09yYWNsZVByaWNlRGF0YQAAAAACAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAY=",
        "AAAAAAAAAAAAAAATc3ltYm9sX2Fzc2V0X3BvbGljeQAAAAABAAAAAAAAAAZzeW1ib2wAAAAAABEAAAABAAAD6AAAB9AAAAALQXNzZXRQb2xpY3kA",
        "AAAAAAAAAAAAAAAUc3RlbGxhcl9hc3NldF9wb2xpY3kAAAABAAAAAAAAAAVhc3NldAAAAAAAABMAAAABAAAD6AAAB9AAAAALQXNzZXRQb2xpY3kA",
        "AAAAAAAAAAAAAAAXc2V0X3N5bWJvbF9hc3NldF9wb2xpY3kAAAAACQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZzeW1ib2wAAAAAABEAAAAAAAAAB3ByaW1hcnkAAAAAEwAAAAAAAAAJc2Vjb25kYXJ5AAAAAAAAEwAAAAAAAAANaGFzX3NlY29uZGFyeQAAAAAAAAEAAAAAAAAADW1heF9wcmljZV9hZ2UAAAAAAAAGAAAAAAAAABFtYXhfZGV2aWF0aW9uX2JwcwAAAAAAAAQAAAAAAAAAEXJlcXVpcmVfc2Vjb25kYXJ5AAAAAAAAAQAAAAAAAAAPZGl2ZXJnZW5jZV9tb2RlAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAYc2V0X3N0ZWxsYXJfYXNzZXRfcG9saWN5AAAACQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAAB3ByaW1hcnkAAAAAEwAAAAAAAAAJc2Vjb25kYXJ5AAAAAAAAEwAAAAAAAAANaGFzX3NlY29uZGFyeQAAAAAAAAEAAAAAAAAADW1heF9wcmljZV9hZ2UAAAAAAAAGAAAAAAAAABFtYXhfZGV2aWF0aW9uX2JwcwAAAAAAAAQAAAAAAAAAEXJlcXVpcmVfc2Vjb25kYXJ5AAAAAAAAAQAAAAAAAAAPZGl2ZXJnZW5jZV9tb2RlAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAZY2xlYXJfc3ltYm9sX2Fzc2V0X3BvbGljeQAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAA==",
        "AAAAAAAAAAAAAAAaY2xlYXJfc3RlbGxhcl9hc3NldF9wb2xpY3kAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<null>,
        admin: this.txFromJSON<string>,
        lastprice: this.txFromJSON<OraclePriceData>,
        set_admin: this.txFromJSON<null>,
        inspect_symbol: this.txFromJSON<AssetInspection>,
        inspect_stellar: this.txFromJSON<AssetInspection>,
        symbol_asset_policy: this.txFromJSON<Option<AssetPolicy>>,
        stellar_asset_policy: this.txFromJSON<Option<AssetPolicy>>,
        set_symbol_asset_policy: this.txFromJSON<null>,
        set_stellar_asset_policy: this.txFromJSON<null>,
        clear_symbol_asset_policy: this.txFromJSON<null>,
        clear_stellar_asset_policy: this.txFromJSON<null>
  }
}