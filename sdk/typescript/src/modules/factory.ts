import { Buffer } from "buffer";
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
  ensureBps,
  ensureNonEmptyBytes,
  ensureSorobanAddress,
  ensureUint32,
} from "../core/validation.js";
import {
  Client as FactoryContractClient,
  type DefaultSwapRiskPolicy,
} from "../generated/arka-factory.js";

export interface FactoryPaginationInput {
  offset?: number;
  limit?: number;
}

export interface CreateArkaInput {
  salt: Uint8Array;
  manager: string;
  denomination: string;
  managementFeeBps: number;
  performanceFeeBps: number;
  depositFeeBps: number;
  redemptionFeeBps: number;
  whitelist: readonly string[];
  router: string;
}

export interface FactoryCreationFee {
  token: string | null;
  amount: bigint;
}

export class FactoryModule {
  private readonly client: FactoryContractClient;

  constructor(
    private readonly config: ArkafundSdkConfig,
    contractId: string,
  ) {
    this.client = new FactoryContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async listArkas(pagination: FactoryPaginationInput = {}): Promise<string[]> {
    const assembled = await this.client.get_arkas(
      normalizePagination(pagination),
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_arkas");
  }

  async listArkasByManager(
    manager: string,
    pagination: FactoryPaginationInput = {},
  ): Promise<string[]> {
    const assembled = await this.client.get_arkas_by_manager(
      {
        manager: ensureSorobanAddress(manager, "manager"),
        ...normalizePagination(pagination),
      },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_arkas_by_manager");
  }

  async creationFee(): Promise<FactoryCreationFee> {
    const [token, amount] = await Promise.all([
      this.client.get_creation_fee_token(mergeCallOptions(this.config, undefined, true)),
      this.client.get_creation_fee_amount(mergeCallOptions(this.config, undefined, true)),
    ]);
    return {
      token: expectSimulationResult(token, "get_creation_fee_token"),
      amount: expectSimulationResult(amount, "get_creation_fee_amount"),
    };
  }

  async defaultVenueRegistry(): Promise<string | null> {
    const assembled = await this.client.get_default_venue_registry(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_default_venue_registry");
  }

  async defaultSwapOracle(): Promise<string | null> {
    const assembled = await this.client.get_default_swap_oracle(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_default_swap_oracle");
  }

  async defaultAllowedRouters(): Promise<string[]> {
    const assembled = await this.client.get_default_allowed_routers(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_default_allowed_routers");
  }

  async defaultAllowedAdapters(): Promise<string[]> {
    const assembled = await this.client.get_default_allowed_adapters(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_default_allowed_adapters");
  }

  async defaultSwapRiskPolicy(): Promise<DefaultSwapRiskPolicy | null> {
    const assembled = await this.client.get_default_swap_risk_policy(
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_default_swap_risk_policy");
  }

  async shareTokenOf(arka: string): Promise<string | null> {
    const assembled = await this.client.share_token_of(
      { arka: ensureSorobanAddress(arka, "arka") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "share_token_of");
  }

  async buildCreateAndInitialize(
    input: CreateArkaInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<string>> {
    return this.client.create_and_init(
      normalizeCreateArkaInput(input),
      mergeCallOptions(this.config, options),
    );
  }

  async createAndInitialize(
    input: CreateArkaInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<string>> {
    const assembled = await this.buildCreateAndInitialize(input, options);
    return submitTransaction(this.config, assembled);
  }
}

function normalizePagination(pagination: FactoryPaginationInput): { offset: number; limit: number } {
  return {
    offset: ensureUint32(pagination.offset ?? 0, "offset"),
    limit: ensureUint32(pagination.limit ?? 50, "limit"),
  };
}

function normalizeCreateArkaInput(input: CreateArkaInput) {
  if (input.whitelist.length === 0) {
    throw new Error("whitelist must include at least one asset");
  }
  return {
    salt: Buffer.from(ensureNonEmptyBytes(input.salt, "salt")),
    manager: ensureSorobanAddress(input.manager, "manager"),
    denomination: ensureSorobanAddress(input.denomination, "denomination"),
    mgmt_bps: ensureBps(input.managementFeeBps, "managementFeeBps"),
    perf_bps: ensureBps(input.performanceFeeBps, "performanceFeeBps"),
    deposit_bps: ensureBps(input.depositFeeBps, "depositFeeBps"),
    redeem_bps: ensureBps(input.redemptionFeeBps, "redemptionFeeBps"),
    whitelist: input.whitelist.map((asset, index) =>
      ensureSorobanAddress(asset, `whitelist[${index}]`),
    ),
    router: ensureSorobanAddress(input.router, "router"),
  };
}
