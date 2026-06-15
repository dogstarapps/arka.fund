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




export type DataKey = {tag: "All", values: void} | {tag: "ByManager", values: readonly [string]} | {tag: "CuratedManager", values: readonly [string]} | {tag: "Delisted", values: readonly [string]} | {tag: "Registrar", values: readonly [string]} | {tag: "Admin", values: void};

export interface Client {
  /**
   * Construct and simulate a count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  count: (options?: {
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
  }) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register: ({caller, manager, arka}: {caller: string, manager: string, arka: string}, options?: {
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
   * Construct and simulate a get_arkas transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_arkas: ({offset, limit}: {offset: u32, limit: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a init_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init_admin: ({admin}: {admin: string}, options?: {
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
   * Construct and simulate a is_delisted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_delisted: ({arka}: {arka: string}, options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a is_registrar transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_registrar: ({registrar}: {registrar: string}, options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_delisted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_delisted: ({caller, arka, delisted}: {caller: string, arka: string, delisted: boolean}, options?: {
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
   * Construct and simulate a set_registrar transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_registrar: ({caller, registrar, allowed}: {caller: string, registrar: string, allowed: boolean}, options?: {
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
   * Construct and simulate a register_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_admin: ({caller, manager, arka}: {caller: string, manager: string, arka: string}, options?: {
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
   * Construct and simulate a count_by_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  count_by_manager: ({manager}: {manager: string}, options?: {
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
  }) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a is_manager_curated transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_manager_curated: ({manager}: {manager: string}, options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_manager_curated transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_manager_curated: ({caller, manager, curated}: {caller: string, manager: string, curated: boolean}, options?: {
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
   * Construct and simulate a get_arkas_by_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_arkas_by_manager: ({manager, offset, limit}: {manager: string, offset: u32, limit: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Array<string>>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAFY291bnQAAAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIcmVnaXN0ZXIAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAEYXJrYQAAABMAAAAA",
        "AAAAAAAAAAAAAAAJZ2V0X2Fya2FzAAAAAAAAAgAAAAAAAAAGb2Zmc2V0AAAAAAAEAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6gAAABM=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAAA0FsbAAAAAABAAAAAAAAAAlCeU1hbmFnZXIAAAAAAAABAAAAEwAAAAEAAAAAAAAADkN1cmF0ZWRNYW5hZ2VyAAAAAAABAAAAEwAAAAEAAAAAAAAACERlbGlzdGVkAAAAAQAAABMAAAABAAAAAAAAAAlSZWdpc3RyYXIAAAAAAAABAAAAEwAAAAAAAAAAAAAABUFkbWluAAAA",
        "AAAAAAAAAAAAAAAKaW5pdF9hZG1pbgAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAALaXNfZGVsaXN0ZWQAAAAAAQAAAAAAAAAEYXJrYQAAABMAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAMaXNfcmVnaXN0cmFyAAAAAQAAAAAAAAAJcmVnaXN0cmFyAAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAAMc2V0X2RlbGlzdGVkAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAARhcmthAAAAEwAAAAAAAAAIZGVsaXN0ZWQAAAABAAAAAA==",
        "AAAAAAAAAAAAAAANc2V0X3JlZ2lzdHJhcgAAAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJcmVnaXN0cmFyAAAAAAAAEwAAAAAAAAAHYWxsb3dlZAAAAAABAAAAAA==",
        "AAAAAAAAAAAAAAAOcmVnaXN0ZXJfYWRtaW4AAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAARhcmthAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAQY291bnRfYnlfbWFuYWdlcgAAAAEAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAEAAAAE",
        "AAAAAAAAAAAAAAASaXNfbWFuYWdlcl9jdXJhdGVkAAAAAAABAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAATc2V0X21hbmFnZXJfY3VyYXRlZAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB21hbmFnZXIAAAAAEwAAAAAAAAAHY3VyYXRlZAAAAAABAAAAAA==",
        "AAAAAAAAAAAAAAAUZ2V0X2Fya2FzX2J5X21hbmFnZXIAAAADAAAAAAAAAAdtYW5hZ2VyAAAAABMAAAAAAAAABm9mZnNldAAAAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+oAAAAT" ]),
      options
    )
  }
  public readonly fromJSON = {
    count: this.txFromJSON<u32>,
        register: this.txFromJSON<null>,
        get_arkas: this.txFromJSON<Array<string>>,
        init_admin: this.txFromJSON<null>,
        is_delisted: this.txFromJSON<boolean>,
        is_registrar: this.txFromJSON<boolean>,
        set_delisted: this.txFromJSON<null>,
        set_registrar: this.txFromJSON<null>,
        register_admin: this.txFromJSON<null>,
        count_by_manager: this.txFromJSON<u32>,
        is_manager_curated: this.txFromJSON<boolean>,
        set_manager_curated: this.txFromJSON<null>,
        get_arkas_by_manager: this.txFromJSON<Array<string>>
  }
}