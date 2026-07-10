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
  2: {message:"Unauthorized"},
  3: {message:"InvalidBootstrapAdmin"},
  4: {message:"InvalidVenueStatus"},
  5: {message:"VenueNotConfigured"}
}

export type DataKey = {tag: "BootstrapAdmin", values: void} | {tag: "BootstrapAdminExpiresAt", values: void} | {tag: "Governor", values: void} | {tag: "Guardian", values: void} | {tag: "Venue", values: readonly [string]} | {tag: "Venues", values: void} | {tag: "LastWasmHash", values: void};


export interface VenueConfig {
  status: u32;
  updated_at: u64;
  updated_by: string;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin, governor, expires_at}: {admin: string, governor: Option<string>, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a venues transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  venues: ({offset, limit}: {offset: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  governor: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a guardian transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  guardian: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a is_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_allowed: ({venue}: {venue: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_governor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_governor: ({caller, governor}: {caller: string, governor: Option<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_guardian transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_guardian: ({caller, guardian}: {caller: string, guardian: Option<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a venue_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  venue_config: ({venue}: {venue: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<VenueConfig>>>

  /**
   * Construct and simulate a disable_venue transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  disable_venue: ({caller, venue}: {caller: string, venue: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_configured transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_configured: ({venue}: {venue: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a last_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  last_wasm_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a bootstrap_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bootstrap_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a is_auto_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_auto_allowed: ({venue}: {venue: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_venue_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_venue_status: ({caller, venue, status}: {caller: string, venue: string, status: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAEaW5pdAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZ292ZXJub3IAAAPoAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAGdmVudWVzAAAAAAACAAAAAAAAAAZvZmZzZXQAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPqAAAAEw==",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAACAAAAAAAAABVJbnZhbGlkQm9vdHN0cmFwQWRtaW4AAAAAAAADAAAAAAAAABJJbnZhbGlkVmVudWVTdGF0dXMAAAAAAAQAAAAAAAAAElZlbnVlTm90Q29uZmlndXJlZAAAAAAABQ==",
        "AAAAAAAAAAAAAAAIZ292ZXJub3IAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAIZ3VhcmRpYW4AAAAAAAAAAQAAA+gAAAAT",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAADkJvb3RzdHJhcEFkbWluAAAAAAAAAAAAAAAAABdCb290c3RyYXBBZG1pbkV4cGlyZXNBdAAAAAAAAAAAAAAAAAhHb3Zlcm5vcgAAAAAAAAAAAAAACEd1YXJkaWFuAAAAAQAAAAAAAAAFVmVudWUAAAAAAAABAAAAEwAAAAAAAAAAAAAABlZlbnVlcwAAAAAAAAAAAAAAAAAMTGFzdFdhc21IYXNo",
        "AAAAAAAAAAAAAAAKaXNfYWxsb3dlZAAAAAAAAQAAAAAAAAAFdmVudWUAAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAMc2V0X2dvdmVybm9yAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhnb3Zlcm5vcgAAA+gAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAMc2V0X2d1YXJkaWFuAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhndWFyZGlhbgAAA+gAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAMdmVudWVfY29uZmlnAAAAAQAAAAAAAAAFdmVudWUAAAAAAAATAAAAAQAAA+gAAAfQAAAAC1ZlbnVlQ29uZmlnAA==",
        "AAAAAAAAAAAAAAANZGlzYWJsZV92ZW51ZQAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFdmVudWUAAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANaXNfY29uZmlndXJlZAAAAAAAAAEAAAAAAAAABXZlbnVlAAAAAAAAEwAAAAEAAAAB",
        "AAAAAQAAAAAAAAAAAAAAC1ZlbnVlQ29uZmlnAAAAAAMAAAAAAAAABnN0YXR1cwAAAAAABAAAAAAAAAAKdXBkYXRlZF9hdAAAAAAABgAAAAAAAAAKdXBkYXRlZF9ieQAAAAAAEw==",
        "AAAAAAAAAAAAAAAObGFzdF93YXNtX2hhc2gAAAAAAAAAAAABAAAD6AAAA+4AAAAg",
        "AAAAAAAAAAAAAAAPYm9vdHN0cmFwX2FkbWluAAAAAAAAAAABAAAD6AAAABM=",
        "AAAAAAAAAAAAAAAPaXNfYXV0b19hbGxvd2VkAAAAAAEAAAAAAAAABXZlbnVlAAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAAQc2V0X3ZlbnVlX3N0YXR1cwAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFdmVudWUAAAAAAAATAAAAAAAAAAZzdGF0dXMAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAATc2V0X2Jvb3RzdHJhcF9hZG1pbgAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAVY2xlYXJfYm9vdHN0cmFwX2FkbWluAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAWYm9vdHN0cmFwX2FkbWluX2FjdGl2ZQAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAaYm9vdHN0cmFwX2FkbWluX2V4cGlyZXNfYXQAAAAAAAAAAAABAAAD6AAAAAY=" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<null>,
        venues: this.txFromJSON<Array<string>>,
        upgrade: this.txFromJSON<null>,
        governor: this.txFromJSON<Option<string>>,
        guardian: this.txFromJSON<Option<string>>,
        is_allowed: this.txFromJSON<boolean>,
        set_governor: this.txFromJSON<null>,
        set_guardian: this.txFromJSON<null>,
        venue_config: this.txFromJSON<Option<VenueConfig>>,
        disable_venue: this.txFromJSON<null>,
        is_configured: this.txFromJSON<boolean>,
        last_wasm_hash: this.txFromJSON<Option<Buffer>>,
        bootstrap_admin: this.txFromJSON<Option<string>>,
        is_auto_allowed: this.txFromJSON<boolean>,
        set_venue_status: this.txFromJSON<null>,
        set_bootstrap_admin: this.txFromJSON<null>,
        clear_bootstrap_admin: this.txFromJSON<null>,
        bootstrap_admin_active: this.txFromJSON<boolean>,
        bootstrap_admin_expires_at: this.txFromJSON<Option<u64>>
  }
}