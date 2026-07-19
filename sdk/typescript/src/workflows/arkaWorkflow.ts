import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { CatalogClient } from "../api/catalogClient.js";
import type { CatalogArka } from "../api/types.js";
import {
  RoutingClient,
  type RoutingClientOptions,
  type RoutingPlanRequest,
  type RoutingPlanResponse,
  type RoutingProtocol,
} from "../api/routingClient.js";
import type {
  ArkafundCallOptions,
  ArkafundSdkConfig,
  SubmittedTransaction,
} from "../core/config.js";
import {
  parseAssetAmount,
  parsePercentageToBasisPoints,
} from "../core/format.js";
import { ensureSorobanAddress } from "../core/validation.js";
import { FactoryModule, type CreateArkaInput } from "../modules/factory.js";
import { TokenModule } from "../modules/token.js";
import {
  VaultModule,
  type BlendActionInput,
  type CreditActionInput,
  type RebalanceStepInput,
} from "../modules/vault.js";
import type { CreditProtocol } from "../generated/arka.js";
import {
  ARKAFUND_MAINNET_CONTRACTS,
  type ArkafundContractAddresses,
} from "../networks/mainnet.js";

export interface ArkaWorkflowOptions {
  contracts?: ArkafundContractAddresses;
  catalog?: CatalogClient;
  routing?: RoutingClient;
  routingOptions?: RoutingClientOptions;
}

export interface HumanCreateArkaInput {
  salt?: Uint8Array;
  manager?: string;
  denomination: string;
  managementFeePercent: string;
  performanceFeePercent: string;
  depositFeePercent: string;
  redemptionFeePercent: string;
  whitelist: readonly string[];
}

export interface HumanAmountInput {
  arkaId: string;
  account: string;
  assetContract: string;
  amount: string;
  decimals?: number;
}

export interface HumanRedeemInput {
  arkaId: string;
  account: string;
  shares: string;
  shareDecimals?: number;
}

export interface HumanBlendActionInput {
  arkaId: string;
  manager?: string;
  adapter: string;
  marketId: bigint | number | string;
  assetContract: string;
  amount: string;
  decimals?: number;
}

export interface HumanCreditActionInput extends Omit<HumanBlendActionInput, "adapter"> {
  protocol: CreditProtocol;
}

export interface HumanRoutingInput {
  protocol?: RoutingProtocol;
  amount: string;
  decimals?: number;
  tokenIn: string;
  tokenOut: string;
  slippagePercent: number;
  manualMinimumOut?: string;
  routingAssets?: string[];
  readerPubKey?: string;
  vaultNav?: string;
  dailyTurnoverUsed?: string;
  projectedAllocationShiftPercent?: string;
  requireStatefulGuardrails?: boolean;
}

export interface PreparedRebalance {
  amountBase: number;
  tokenIn: string;
  tokenOut: string;
  response: RoutingPlanResponse;
}

export class ArkaWorkflow {
  readonly catalog: CatalogClient;
  readonly routing: RoutingClient;
  readonly contracts: ArkafundContractAddresses;
  private readonly factory: FactoryModule;

  constructor(private readonly config: ArkafundSdkConfig, options: ArkaWorkflowOptions = {}) {
    this.contracts = options.contracts ?? ARKAFUND_MAINNET_CONTRACTS;
    this.catalog = options.catalog ?? new CatalogClient();
    this.routing = options.routing ?? new RoutingClient(options.routingOptions);
    this.factory = new FactoryModule(config, this.contracts.arkaFactory);
  }

  async inspectArka(arkaId: string): Promise<{
    indexed: CatalogArka;
    onChain: { manager: string; nav: string };
    consistent: boolean;
  }> {
    const indexed = await this.catalog.arka(ensureSorobanAddress(arkaId, "arkaId"));
    const vault = new VaultModule(this.config, arkaId);
    const [manager, nav] = await Promise.all([vault.manager(), vault.nav()]);
    return {
      indexed,
      onChain: { manager, nav: nav.toString() },
      consistent: indexed.manager === manager && indexed.nav === nav.toString(),
    };
  }

  creationFee() {
    return this.factory.creationFee();
  }

  async createArka(
    input: HumanCreateArkaInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<string>> {
    return this.factory.createAndInitialize(this.normalizeCreateInput(input), options);
  }

  async createArkaWithFeeApproval(
    input: HumanCreateArkaInput,
    expirationLedger: number,
    options?: ArkafundCallOptions,
  ): Promise<{
    approval: SubmittedTransaction<null> | null;
    creation: SubmittedTransaction<string>;
  }> {
    const manager = this.resolveManager(input.manager);
    const fee = await this.factory.creationFee();
    let approval: SubmittedTransaction<null> | null = null;
    if (fee.token && fee.amount > 0n) {
      const token = new TokenModule(this.config, fee.token);
      const balance = await token.balance(manager);
      if (balance < fee.amount) {
        throw new Error("The connected wallet does not have enough balance for the Arka creation fee");
      }
      const allowance = await token.allowance(manager, this.contracts.arkaFactory);
      if (allowance < fee.amount) {
        approval = await token.approve({
          owner: manager,
          spender: this.contracts.arkaFactory,
          amount: fee.amount,
          expirationLedger,
        }, options);
      }
    }
    const creation = await this.createArka({ ...input, manager }, options);
    return { approval, creation };
  }

  buildDeposit(
    input: HumanAmountInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return new VaultModule(this.config, input.arkaId).buildDeposit({
      user: input.account,
      asset: { contract: input.assetContract },
      amount: parseAssetAmount(input.amount, input.decimals ?? 7),
    }, options);
  }

  deposit(input: HumanAmountInput, options?: ArkafundCallOptions) {
    return new VaultModule(this.config, input.arkaId).deposit({
      user: input.account,
      asset: { contract: input.assetContract },
      amount: parseAssetAmount(input.amount, input.decimals ?? 7),
    }, options);
  }

  buildRedeem(
    input: HumanRedeemInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return new VaultModule(this.config, input.arkaId).buildRedeem({
      user: input.account,
      shares: parseAssetAmount(input.shares, input.shareDecimals ?? 7),
    }, options);
  }

  redeem(input: HumanRedeemInput, options?: ArkafundCallOptions) {
    return new VaultModule(this.config, input.arkaId).redeem({
      user: input.account,
      shares: parseAssetAmount(input.shares, input.shareDecimals ?? 7),
    }, options);
  }

  buildBlendLend(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.buildBlendLend(action, options);
  }

  blendLend(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.blendLend(action, options);
  }

  buildBlendWithdraw(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.buildBlendWithdraw(action, options);
  }

  blendWithdraw(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.blendWithdraw(action, options);
  }

  buildBlendBorrow(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.buildBlendBorrow(action, options);
  }

  blendBorrow(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.blendBorrow(action, options);
  }

  buildBlendRepay(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.buildBlendRepay(action, options);
  }

  blendRepay(input: HumanBlendActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeBlendAction(input);
    return vault.blendRepay(action, options);
  }

  buildCreditSupply(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.buildCreditSupply(action, options);
  }

  creditSupply(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.creditSupply(action, options);
  }

  buildCreditWithdraw(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.buildCreditWithdraw(action, options);
  }

  creditWithdraw(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.creditWithdraw(action, options);
  }

  buildCreditBorrow(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.buildCreditBorrow(action, options);
  }

  creditBorrow(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.creditBorrow(action, options);
  }

  buildCreditRepay(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.buildCreditRepay(action, options);
  }

  creditRepay(input: HumanCreditActionInput, options?: ArkafundCallOptions) {
    const { vault, action } = this.normalizeCreditAction(input);
    return vault.creditRepay(action, options);
  }

  async planRebalance(input: HumanRoutingInput): Promise<PreparedRebalance> {
    const decimals = input.decimals ?? 7;
    const amountBase = safeNumber(parseAssetAmount(input.amount, decimals), "amount");
    const request: RoutingPlanRequest = {
      requestedProtocol: input.protocol ?? "AUTO",
      amountBase,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      slippagePct: input.slippagePercent,
      manualMinOutBase: input.manualMinimumOut
        ? safeNumber(parseAssetAmount(input.manualMinimumOut, decimals), "manualMinimumOut")
        : 0,
      routingAssets: input.routingAssets,
      readerPubKey: input.readerPubKey,
      vaultNavBase: input.vaultNav
        ? safeNumber(parseAssetAmount(input.vaultNav, decimals), "vaultNav")
        : undefined,
      dailyTurnoverUsedBase: input.dailyTurnoverUsed
        ? safeNumber(parseAssetAmount(input.dailyTurnoverUsed, decimals), "dailyTurnoverUsed")
        : undefined,
      projectedPostTradeDeviationBps: input.projectedAllocationShiftPercent
        ? parsePercentageToBasisPoints(input.projectedAllocationShiftPercent)
        : undefined,
      requiredStatefulGuardrails: input.requireStatefulGuardrails === false
        ? []
        : ["post_trade_deviation_bps", "daily_turnover_cap_bps"],
    };
    return {
      amountBase,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      response: await this.routing.plan(request),
    };
  }

  buildPlannedRebalance(
    arkaId: string,
    manager: string,
    prepared: PreparedRebalance,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return new VaultModule(this.config, arkaId).buildRebalance({
      manager,
      steps: this.executionSteps(prepared),
    }, options);
  }

  rebalance(
    arkaId: string,
    manager: string,
    prepared: PreparedRebalance,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<bigint>> {
    return new VaultModule(this.config, arkaId).rebalance({
      manager,
      steps: this.executionSteps(prepared),
    }, options);
  }

  private normalizeCreateInput(input: HumanCreateArkaInput): CreateArkaInput {
    return {
      salt: input.salt ?? crypto.getRandomValues(new Uint8Array(32)),
      manager: this.resolveManager(input.manager),
      denomination: input.denomination,
      managementFeeBps: parsePercentageToBasisPoints(input.managementFeePercent),
      performanceFeeBps: parsePercentageToBasisPoints(input.performanceFeePercent),
      depositFeeBps: parsePercentageToBasisPoints(input.depositFeePercent),
      redemptionFeeBps: parsePercentageToBasisPoints(input.redemptionFeePercent),
      whitelist: input.whitelist,
      router: this.contracts.router,
    };
  }

  private resolveManager(manager?: string): string {
    const resolved = manager ?? this.config.publicKey;
    if (!resolved) throw new Error("manager is required when the SDK has no connected wallet");
    return ensureSorobanAddress(resolved, "manager");
  }

  private normalizeBlendAction(input: HumanBlendActionInput): {
    vault: VaultModule;
    action: BlendActionInput;
  } {
    return {
      vault: new VaultModule(this.config, input.arkaId),
      action: {
        manager: this.resolveManager(input.manager),
        adapter: input.adapter,
        marketId: input.marketId,
        asset: input.assetContract,
        amount: parseAssetAmount(input.amount, input.decimals ?? 7),
      },
    };
  }

  private normalizeCreditAction(input: HumanCreditActionInput): {
    vault: VaultModule;
    action: CreditActionInput;
  } {
    return {
      vault: new VaultModule(this.config, input.arkaId),
      action: {
        manager: this.resolveManager(input.manager),
        protocol: input.protocol,
        marketId: input.marketId,
        asset: input.assetContract,
        amount: parseAssetAmount(input.amount, input.decimals ?? 7),
      },
    };
  }

  private executionSteps(prepared: PreparedRebalance): RebalanceStepInput[] {
    const plan = prepared.response.plan;
    if (!plan.guardrails) {
      throw new Error("Rebalance blocked: the routing response did not include the required risk checks");
    }
    if (plan.guardrails?.status === "blocked") {
      throw new Error(`Rebalance blocked: ${plan.guardrails.blockedReasons.join(" ")}`);
    }
    const requiredChecks = [
      "post_trade_deviation_bps",
      "daily_turnover_cap_bps",
    ];
    const missingChecks = requiredChecks.filter(
      (id) => !plan.guardrails?.checks.some((check) => check.id === id),
    );
    if (missingChecks.length > 0) {
      throw new Error(
        `Rebalance blocked: the routing response omitted required risk checks: ${missingChecks.join(", ")}`,
      );
    }
    const unresolvedChecks = plan.guardrails?.checks.filter(
      (check) => check.status === "requires_state",
    ) ?? [];
    if (unresolvedChecks.length > 0) {
      throw new Error(
        `Rebalance requires current vault state: ${unresolvedChecks.map((check) => check.id).join(", ")}`,
      );
    }
    if (plan.selectedProtocol === "BALANCED") {
      throw new Error("Balanced routes use the SODAX intent lifecycle and cannot be submitted as vault AMM steps");
    }
    const split = plan.splitRoute;
    if (split?.executable && split.status === "recommended" && split.allocations.length > 1) {
      return split.allocations.map((allocation) => this.toExecutionStep({
        protocol: allocation.protocol,
        amountInBase: allocation.amountInBase,
        minOutBase: allocation.minOutBase,
        pathAssets: allocation.pathAssets,
        adapterId: allocation.adapterId,
        poolId: allocation.poolId,
      }));
    }
    const candidate = plan.selectedCandidate;
    if (!candidate || !candidate.available || !candidate.admitted) {
      throw new Error("No executable admitted route is available");
    }
    return [this.toExecutionStep({
      protocol: candidate.protocol as Exclude<typeof candidate.protocol, "BALANCED">,
      amountInBase: prepared.amountBase,
      minOutBase: plan.minOutBase,
      pathAssets: candidate.pathAssets,
      adapterId: candidate.adapterId,
      poolId: candidate.poolId,
    })];
  }

  private toExecutionStep(input: {
    protocol: "SOROSWAP" | "AQUARIUS" | "PHOENIX";
    amountInBase: number;
    minOutBase: number;
    pathAssets: string[];
    adapterId?: string;
    poolId?: number;
  }): RebalanceStepInput {
    if (input.pathAssets.length < 2) throw new Error("Executable route must include input and output assets");
    if (input.protocol !== "SOROSWAP" && input.pathAssets.length !== 2) {
      throw new Error("Vault multi-hop execution is supported only for SoroSwap routes");
    }
    const adapters = {
      SOROSWAP: this.contracts.adapterSoroswap,
      AQUARIUS: this.contracts.adapterAquarius,
      PHOENIX: this.contracts.adapterPhoenix,
    } as const;
    return {
      adapter: input.adapterId ?? adapters[input.protocol],
      router: this.contracts.router,
      poolId: input.poolId ?? 1,
      assetIn: input.pathAssets[0],
      assetOut: input.pathAssets[input.pathAssets.length - 1],
      amountIn: input.amountInBase,
      minOut: input.minOutBase,
    };
  }
}

function safeNumber(value: bigint, name: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${name} exceeds the routing API safe integer range`);
  }
  return Number(value);
}
