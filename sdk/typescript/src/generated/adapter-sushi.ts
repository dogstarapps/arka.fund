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




export type DataKey = {tag: "Admin", values: void} | {tag: "Factory", values: void} | {tag: "Route", values: readonly [u128]} | {tag: "Caller", values: readonly [string]};


export interface SwapResult {
  amount0: i128;
  amount1: i128;
  liquidity: u128;
  sqrt_price_x96: u256;
  tick: i32;
}


export interface OracleHints {
  checkpoint: u32;
  checkpoint_min: u32;
  slot: u128;
}


export interface SushiPoolRoute {
  fee: u32;
  pool: string;
  token_in: string;
  token_out: string;
}

export interface Client {
  /**
   * Construct and simulate a execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Existing Arka internal-router ABI. Input is prefunded atomically by the
   * vault; output is measured, then only that new output is returned.
   */
  execute: ({caller, pool_id, amount_in, min_out, receiver}: {caller: string, pool_id: u128, amount_in: i128, min_out: i128, receiver: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a factory transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  factory: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_caller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_caller: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a pool_route transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pool_route: ({pool_id}: {pool_id: u128}, options?: MethodOptions) => Promise<AssembledTransaction<SushiPoolRoute>>

  /**
   * Construct and simulate a set_caller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_caller: ({admin, caller, allowed}: {admin: string, caller: string, allowed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_pool_route transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_pool_route: ({caller, pool_id, route}: {caller: string, pool_id: u128, route: SushiPoolRoute}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, factory}: {admin: string, factory: string},
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
    return ContractClient.deploy({admin, factory}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAIlFeGlzdGluZyBBcmthIGludGVybmFsLXJvdXRlciBBQkkuIElucHV0IGlzIHByZWZ1bmRlZCBhdG9taWNhbGx5IGJ5IHRoZQp2YXVsdDsgb3V0cHV0IGlzIG1lYXN1cmVkLCB0aGVuIG9ubHkgdGhhdCBuZXcgb3V0cHV0IGlzIHJldHVybmVkLgAAAAAAAAdleGVjdXRlAAAAAAUAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAKAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAAdtaW5fb3V0AAAAAAsAAAAAAAAACHJlY2VpdmVyAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAHZmFjdG9yeQAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAJaXNfY2FsbGVyAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAAAE=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAHRmFjdG9yeQAAAAABAAAAAAAAAAVSb3V0ZQAAAAAAAAEAAAAKAAAAAQAAAAAAAAAGQ2FsbGVyAAAAAAABAAAAEw==",
        "AAAAAAAAAAAAAAAKcG9vbF9yb3V0ZQAAAAAAAQAAAAAAAAAHcG9vbF9pZAAAAAAKAAAAAQAAB9AAAAAOU3VzaGlQb29sUm91dGUAAA==",
        "AAAAAAAAAAAAAAAKc2V0X2NhbGxlcgAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB2FsbG93ZWQAAAAAAQAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAClN3YXBSZXN1bHQAAAAAAAUAAAAAAAAAB2Ftb3VudDAAAAAACwAAAAAAAAAHYW1vdW50MQAAAAALAAAAAAAAAAlsaXF1aWRpdHkAAAAAAAAKAAAAAAAAAA5zcXJ0X3ByaWNlX3g5NgAAAAAADAAAAAAAAAAEdGljawAAAAU=",
        "AAAAAAAAAI5JbW11dGFibGUgY29kZSBhbmQgZmFjdG9yeS4gQWRtaW4gbWF5IGJlIGEgZ292ZXJuYW5jZSBjb250cmFjdDsgdGhlcmUgaXMKbm8gdXBncmFkZSBlbnRyeXBvaW50LCBib290c3RyYXAgYnlwYXNzLCBhbGxvd2FuY2Ugb3IgaW1wbGljaXQgb3duZXIuAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHZmFjdG9yeQAAAAATAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAAC09yYWNsZUhpbnRzAAAAAAMAAAAAAAAACmNoZWNrcG9pbnQAAAAAAAQAAAAAAAAADmNoZWNrcG9pbnRfbWluAAAAAAAEAAAAAAAAAARzbG90AAAACg==",
        "AAAAAAAAAAAAAAAOc2V0X3Bvb2xfcm91dGUAAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAKAAAAAAAAAAVyb3V0ZQAAAAAAB9AAAAAOU3VzaGlQb29sUm91dGUAAAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAADlN1c2hpUG9vbFJvdXRlAAAAAAAEAAAAAAAAAANmZWUAAAAABAAAAAAAAAAEcG9vbAAAABMAAAAAAAAACHRva2VuX2luAAAAEwAAAAAAAAAJdG9rZW5fb3V0AAAAAAAAEw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    execute: this.txFromJSON<i128>,
        factory: this.txFromJSON<string>,
        is_caller: this.txFromJSON<boolean>,
        pool_route: this.txFromJSON<SushiPoolRoute>,
        set_caller: this.txFromJSON<null>,
        set_pool_route: this.txFromJSON<null>
  }
}