import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import {
  createClientOptions,
  expectSimulationResult,
  mergeCallOptions,
  type ArkafundCallOptions,
  type ArkafundSdkConfig,
  type SubmittedTransaction,
} from "../core/config.js";
import { submitTransaction } from "../core/rpc.js";
import {
  ensurePositiveInt,
  ensureSorobanAddress,
  ensureUint32,
} from "../core/validation.js";
import { Client as TokenContractClient } from "../generated/token.js";

export interface TokenApprovalInput {
  owner: string;
  spender: string;
  amount: bigint | number | string;
  expirationLedger: number;
}

export class TokenModule {
  private readonly client: TokenContractClient;

  constructor(private readonly config: ArkafundSdkConfig, contractId: string) {
    this.client = new TokenContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async balance(account: string): Promise<bigint> {
    const assembled = await this.client.balance(
      { owner: ensureSorobanAddress(account, "account") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "balance");
  }

  async allowance(owner: string, spender: string): Promise<bigint> {
    const assembled = await this.client.allowance(
      {
        owner: ensureSorobanAddress(owner, "owner"),
        spender: ensureSorobanAddress(spender, "spender"),
      },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "allowance");
  }

  buildApprove(
    input: TokenApprovalInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.approve(
      {
        owner: ensureSorobanAddress(input.owner, "owner"),
        spender: ensureSorobanAddress(input.spender, "spender"),
        amount: ensurePositiveInt(input.amount, "amount"),
        expiration_ledger: ensureUint32(input.expirationLedger, "expirationLedger"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async approve(
    input: TokenApprovalInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    return submitTransaction(this.config, await this.buildApprove(input, options));
  }
}
