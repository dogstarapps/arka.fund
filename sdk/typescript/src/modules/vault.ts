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
  ensurePositiveInt128,
  ensureSorobanAddress,
  ensureUint128,
} from "../core/validation.js";
import {
  Client as ArkaContractClient,
  type Asset,
  type BlendMarketStatus,
  type CreditMarketStatus,
  type CreditProtocol,
  type FeeStructure,
  type SwapStep,
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

export interface RebalanceStepInput {
  adapter: string;
  router: string;
  poolId: bigint | number | string;
  assetIn: string;
  assetOut: string;
  amountIn: bigint | number | string;
  minOut: bigint | number | string;
}

export interface RebalanceInput {
  manager: string;
  steps: readonly RebalanceStepInput[];
}

export interface BlendActionInput {
  manager: string;
  adapter: string;
  marketId: bigint | number | string;
  asset: string;
  amount: bigint | number | string;
}

export interface CreditActionInput {
  manager: string;
  protocol: CreditProtocol;
  marketId: bigint | number | string;
  asset: string;
  amount: bigint | number | string;
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

  async buildRebalance(
    input: RebalanceInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.rebalance(
      {
        manager: ensureSorobanAddress(input.manager, "manager"),
        steps: normalizeRebalanceSteps(input.steps),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async rebalance(
    input: RebalanceInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    return submitTransaction(this.config, await this.buildRebalance(input, options));
  }

  buildBlendLend(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.buildBlendAction("blend_lend", input, options);
  }

  blendLend(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.submitBlendAction("blend_lend", input, options);
  }

  buildBlendWithdraw(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.buildBlendAction("blend_withdraw", input, options);
  }

  blendWithdraw(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.submitBlendAction("blend_withdraw", input, options);
  }

  buildBlendBorrow(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.buildBlendAction("blend_borrow", input, options);
  }

  blendBorrow(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.submitBlendAction("blend_borrow", input, options);
  }

  buildBlendRepay(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.buildBlendAction("blend_repay", input, options);
  }

  blendRepay(input: BlendActionInput, options?: ArkafundCallOptions) {
    return this.submitBlendAction("blend_repay", input, options);
  }

  buildCreditSupply(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.buildCreditAction("credit_supply", input, options);
  }

  creditSupply(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.submitCreditAction("credit_supply", input, options);
  }

  buildCreditWithdraw(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.buildCreditAction("credit_withdraw", input, options);
  }

  creditWithdraw(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.submitCreditAction("credit_withdraw", input, options);
  }

  buildCreditBorrow(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.buildCreditAction("credit_borrow", input, options);
  }

  creditBorrow(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.submitCreditAction("credit_borrow", input, options);
  }

  buildCreditRepay(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.buildCreditAction("credit_repay", input, options);
  }

  creditRepay(input: CreditActionInput, options?: ArkafundCallOptions) {
    return this.submitCreditAction("credit_repay", input, options);
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

  private async buildBlendAction(
    action: "blend_lend" | "blend_withdraw" | "blend_borrow" | "blend_repay",
    input: BlendActionInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client[action](
      {
        manager: ensureSorobanAddress(input.manager, "manager"),
        adapter: ensureSorobanAddress(input.adapter, "adapter"),
        market_id: ensurePositiveInt(input.marketId, "marketId"),
        asset: ensureSorobanAddress(input.asset, "asset"),
        amount: ensurePositiveInt(input.amount, "amount"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  private async submitBlendAction(
    action: "blend_lend" | "blend_withdraw" | "blend_borrow" | "blend_repay",
    input: BlendActionInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    return submitTransaction(this.config, await this.buildBlendAction(action, input, options));
  }

  private async buildCreditAction(
    action: "credit_supply" | "credit_withdraw" | "credit_borrow" | "credit_repay",
    input: CreditActionInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client[action](
      {
        manager: ensureSorobanAddress(input.manager, "manager"),
        protocol: input.protocol,
        market_id: ensurePositiveInt(input.marketId, "marketId"),
        asset: ensureSorobanAddress(input.asset, "asset"),
        amount: ensurePositiveInt(input.amount, "amount"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  private async submitCreditAction(
    action: "credit_supply" | "credit_withdraw" | "credit_borrow" | "credit_repay",
    input: CreditActionInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    return submitTransaction(this.config, await this.buildCreditAction(action, input, options));
  }
}

function normalizeRebalanceSteps(steps: readonly RebalanceStepInput[]): SwapStep[] {
  if (steps.length === 0) {
    throw new Error("steps must include at least one swap");
  }
  return steps.map((step, index) => ({
    adapter: ensureSorobanAddress(step.adapter, `steps[${index}].adapter`),
    router_addr: ensureSorobanAddress(step.router, `steps[${index}].router`),
    pool_id: ensureUint128(step.poolId, `steps[${index}].poolId`),
    asset_in: { contract: ensureSorobanAddress(step.assetIn, `steps[${index}].assetIn`) },
    asset_out: { contract: ensureSorobanAddress(step.assetOut, `steps[${index}].assetOut`) },
    amount_in: ensurePositiveInt128(step.amountIn, `steps[${index}].amountIn`),
    min_out: ensurePositiveInt128(step.minOut, `steps[${index}].minOut`),
  }));
}
