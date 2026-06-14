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
} from "../core/validation.js";
import {
  Client as ArkaContractClient,
  type Asset,
  type BlendMarketStatus,
  type CreditMarketStatus,
  type CreditProtocol,
  type FeeStructure,
} from "../generated/arka.js";

export interface DepositInput {
  user: string;
  asset: Asset;
  amount: bigint | number | string;
}

export interface RedeemInput {
  user: string;
  shares: bigint | number | string;
}

export class VaultModule {
  private readonly client: ArkaContractClient;

  constructor(
    private readonly config: ArkafundSdkConfig,
    contractId: string,
  ) {
    this.client = new ArkaContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async nav(): Promise<bigint> {
    const assembled = await this.client.nav(mergeCallOptions(this.config, undefined, true));
    return expectSimulationResult(assembled, "nav");
  }

  async manager(): Promise<string> {
    const assembled = await this.client.manager(mergeCallOptions(this.config, undefined, true));
    return expectSimulationResult(assembled, "manager");
  }

  async router(): Promise<string> {
    const assembled = await this.client.router(mergeCallOptions(this.config, undefined, true));
    return expectSimulationResult(assembled, "router");
  }

  async shareToken(): Promise<string | null> {
    const assembled = await this.client.share_token(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "share_token");
  }

  async fees(): Promise<FeeStructure> {
    const assembled = await this.client.fees(mergeCallOptions(this.config, undefined, true));
    return expectSimulationResult(assembled, "fees");
  }

  async whitelist(): Promise<Asset[]> {
    const assembled = await this.client.whitelist(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "whitelist");
  }

  async buildDeposit(
    input: DepositInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.deposit(
      {
        user: ensureSorobanAddress(input.user, "user"),
        asset: input.asset,
        amount: ensurePositiveInt(input.amount, "amount"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async deposit(
    input: DepositInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    const assembled = await this.buildDeposit(input, options);
    return submitTransaction(this.config, assembled);
  }

  async buildRedeem(
    input: RedeemInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.redeem(
      {
        user: ensureSorobanAddress(input.user, "user"),
        shares: ensurePositiveInt(input.shares, "shares"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async redeem(
    input: RedeemInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    const assembled = await this.buildRedeem(input, options);
    return submitTransaction(this.config, assembled);
  }

  async blendMarketStatus(marketId: bigint | number | string): Promise<BlendMarketStatus | null> {
    const assembled = await this.client.blend_market_status(
      { market_id: ensurePositiveInt(marketId, "marketId") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "blend_market_status");
  }

  async creditMarketStatus(
    protocol: CreditProtocol,
    marketId: bigint | number | string,
  ): Promise<CreditMarketStatus | null> {
    const assembled = await this.client.credit_market_status(
      {
        protocol,
        market_id: ensurePositiveInt(marketId, "marketId"),
      },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "credit_market_status");
  }
}
