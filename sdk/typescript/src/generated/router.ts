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
  1: {message:"AlreadyInitialized"},
  2: {message:"Unauthorized"},
  3: {message:"InvalidBootstrapAdmin"}
}

export type DataKey = {tag: "BootstrapAdmin", values: void} | {tag: "BootstrapAdminExpiresAt", values: void} | {tag: "Governor", values: void} | {tag: "LastWasmHash", values: void};


export interface SwapStep {
  adapter: string;
  amount_in: i128;
  asset_out: Asset;
  min_out: i128;
  pool_id: u128;
}

export interface Client {
  /**
   * Construct and simulate a execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute: ({caller, steps}: {caller: string, steps: Array<SwapStep>}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a execute_for transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute_for: ({caller, receiver, steps}: {caller: string, receiver: string, steps: Array<SwapStep>}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_governor: ({caller, governor}: {caller: string, governor: Option<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a last_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  last_wasm_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_bootstrap_admin: ({caller, admin, expires_at}: {caller: string, admin: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a clear_bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_bootstrap_admin: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_admin_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_active: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a init_upgrade_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init_upgrade_authority: ({admin, governor, expires_at}: {admin: string, governor: Option<string>, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bootstrap_admin_expires_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin_expires_at: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u64>>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAHZXhlY3V0ZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABXN0ZXBzAAAAAAAD6gAAB9AAAAAIU3dhcFN0ZXAAAAABAAAACw==",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAABUFzc2V0AAAAAAAAAQAAAAAAAAAIY29udHJhY3QAAAAT",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAwAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAACAAAAAAAAABVJbnZhbGlkQm9vdHN0cmFwQWRtaW4AAAAAAAAD",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAADkJvb3RzdHJhcEFkbWluAAAAAAAAAAAAAAAAABdCb290c3RyYXBBZG1pbkV4cGlyZXNBdAAAAAAAAAAAAAAAAAhHb3Zlcm5vcgAAAAAAAAAAAAAADExhc3RXYXNtSGFzaA==",
        "AAAAAQAAAAAAAAAAAAAACFN3YXBTdGVwAAAABQAAAAAAAAAHYWRhcHRlcgAAAAATAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAlhc3NldF9vdXQAAAAAAAfQAAAABUFzc2V0AAAAAAAAAAAAAAdtaW5fb3V0AAAAAAsAAAAAAAAAB3Bvb2xfaWQAAAAACg==",
        "AAAAAAAAAAAAAAALZXhlY3V0ZV9mb3IAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAABXN0ZXBzAAAAAAAD6gAAB9AAAAAIU3dhcFN0ZXAAAAABAAAACw==",
        "AAAAAAAAAAAAAAAMc2V0X2dvdmVybm9yAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhnb3Zlcm5vcgAAA+gAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAObGFzdF93YXNtX2hhc2gAAAAAAAAAAAABAAAD6AAAA+4AAAAg",
        "AAAAAAAAAAAAAAAPYm9vdHN0cmFwX2FkbWluAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAAAAAAAATc2V0X2Jvb3RzdHJhcF9hZG1pbgAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAVY2xlYXJfYm9vdHN0cmFwX2FkbWluAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAWYm9vdHN0cmFwX2FkbWluX2FjdGl2ZQAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAWaW5pdF91cGdyYWRlX2F1dGhvcml0eQAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhnb3Zlcm5vcgAAA+gAAAATAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAaYm9vdHN0cmFwX2FkbWluX2V4cGlyZXNfYXQAAAAAAAAAAAABAAAD6AAAAAY=" ]),
      options
    )
  }
  public readonly fromJSON = {
    execute: this.txFromJSON<i128>,
        upgrade: this.txFromJSON<null>,
        execute_for: this.txFromJSON<i128>,
        set_governor: this.txFromJSON<null>,
        last_wasm_hash: this.txFromJSON<Option<Buffer>>,
        bootstrap_admin: this.txFromJSON<Option<string>>,
        set_bootstrap_admin: this.txFromJSON<null>,
        clear_bootstrap_admin: this.txFromJSON<null>,
        bootstrap_admin_active: this.txFromJSON<boolean>,
        init_upgrade_authority: this.txFromJSON<null>,
        bootstrap_admin_expires_at: this.txFromJSON<Option<u64>>
  }
}