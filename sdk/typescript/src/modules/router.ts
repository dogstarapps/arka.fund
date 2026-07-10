import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import {
  createClientOptions,
  mergeCallOptions,
  type ArkafundCallOptions,
  type ArkafundSdkConfig,
  type SubmittedTransaction,
} from "../core/config.js";
import { submitTransaction } from "../core/rpc.js";
import {
  ensureNonNegativeInt128,
  ensurePositiveInt128,
  ensureSorobanAddress,
  ensureUint128,
  type IntLike,
} from "../core/validation.js";
import { Client as RouterContractClient } from "../generated/router.js";

export interface SwapStepInput {
  adapter: string;
  poolId: IntLike;
  amountIn: IntLike;
  minOut: IntLike;
  assetOut: string;
}

export interface ExecuteRouteInput {
  caller: string;
  steps: readonly SwapStepInput[];
}

export interface ExecuteRouteForInput extends ExecuteRouteInput {
  receiver: string;
}

export class RouterModule {
  private readonly client: RouterContractClient;

  constructor(
    private readonly config: ArkafundSdkConfig,
    contractId: string,
  ) {
    this.client = new RouterContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async buildExecute(
    input: ExecuteRouteInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.execute(
      {
        caller: ensureSorobanAddress(input.caller, "caller"),
        steps: normalizeSteps(input.steps),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async execute(
    input: ExecuteRouteInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    const assembled = await this.buildExecute(input, options);
    return submitTransaction(this.config, assembled);
  }

  async buildExecuteFor(
    input: ExecuteRouteForInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.execute_for(
      {
        caller: ensureSorobanAddress(input.caller, "caller"),
        receiver: ensureSorobanAddress(input.receiver, "receiver"),
        steps: normalizeSteps(input.steps),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async executeFor(
    input: ExecuteRouteForInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    const assembled = await this.buildExecuteFor(input, options);
    return submitTransaction(this.config, assembled);
  }
}

function normalizeSteps(steps: readonly SwapStepInput[]) {
  if (steps.length === 0) {
    throw new Error("steps must include at least one swap");
  }
  return steps.map((step, index) => {
    const amountIn = index === 0
      ? ensurePositiveInt128(step.amountIn, `steps[${index}].amountIn`)
      : ensureNonNegativeInt128(step.amountIn, `steps[${index}].amountIn`);
    return {
      adapter: ensureSorobanAddress(step.adapter, `steps[${index}].adapter`),
      pool_id: ensureUint128(step.poolId, `steps[${index}].poolId`),
      amount_in: amountIn,
      min_out: ensurePositiveInt128(step.minOut, `steps[${index}].minOut`),
      asset_out: {
        contract: ensureSorobanAddress(step.assetOut, `steps[${index}].assetOut`),
      },
    };
  });
}
