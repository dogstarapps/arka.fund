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
  ensureNonEmptyString,
  ensureSorobanAddress,
  ensureUint32,
} from "../core/validation.js";
import { Client as RegistryContractClient } from "../generated/arka-registry.js";

export interface PaginationInput {
  offset?: number;
  limit?: number;
}

export interface RegistryWriteInput {
  caller: string;
  manager: string;
  arka: string;
}

export class RegistryModule {
  private readonly client: RegistryContractClient;

  constructor(
    private readonly config: ArkafundSdkConfig,
    contractId: string,
  ) {
    this.client = new RegistryContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async initAdmin(
    admin: string,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildInitAdmin(admin, options);
    return submitTransaction(this.config, assembled);
  }

  buildInitAdmin(
    admin: string,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.init_admin(
      { admin: ensureSorobanAddress(admin, "admin") },
      mergeCallOptions(this.config, options),
    );
  }

  async setRegistrar(
    caller: string,
    registrar: string,
    allowed: boolean,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildSetRegistrar(caller, registrar, allowed, options);
    return submitTransaction(this.config, assembled);
  }

  buildSetRegistrar(
    caller: string,
    registrar: string,
    allowed: boolean,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.set_registrar(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        registrar: ensureSorobanAddress(registrar, "registrar"),
        allowed,
      },
      mergeCallOptions(this.config, options),
    );
  }

  async registerArka(
    input: RegistryWriteInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildRegisterArka(input, options);
    return submitTransaction(this.config, assembled);
  }

  buildRegisterArka(
    input: RegistryWriteInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.register(
      {
        caller: ensureSorobanAddress(input.caller, "caller"),
        manager: ensureSorobanAddress(input.manager, "manager"),
        arka: ensureSorobanAddress(input.arka, "arka"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async registerLegacyArka(
    input: RegistryWriteInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.client.register_admin(
      {
        caller: ensureSorobanAddress(input.caller, "caller"),
        manager: ensureSorobanAddress(input.manager, "manager"),
        arka: ensureSorobanAddress(input.arka, "arka"),
      },
      mergeCallOptions(this.config, options),
    );
    return submitTransaction(this.config, assembled);
  }

  async setDelisted(
    caller: string,
    arka: string,
    delisted: boolean,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.client.set_delisted(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        arka: ensureSorobanAddress(arka, "arka"),
        delisted,
      },
      mergeCallOptions(this.config, options),
    );
    return submitTransaction(this.config, assembled);
  }

  async setManagerCurated(
    caller: string,
    manager: string,
    curated: boolean,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.client.set_manager_curated(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        manager: ensureSorobanAddress(manager, "manager"),
        curated,
      },
      mergeCallOptions(this.config, options),
    );
    return submitTransaction(this.config, assembled);
  }

  async listArkas(pagination: PaginationInput = {}): Promise<string[]> {
    const assembled = await this.client.get_arkas(
      normalizePagination(pagination),
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_arkas");
  }

  async listArkasByManager(manager: string, pagination: PaginationInput = {}): Promise<string[]> {
    const assembled = await this.client.get_arkas_by_manager(
      {
        manager: ensureSorobanAddress(manager, "manager"),
        ...normalizePagination(pagination),
      },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "get_arkas_by_manager");
  }

  async count(): Promise<number> {
    const assembled = await this.client.count(mergeCallOptions(this.config, undefined, true));
    return expectSimulationResult(assembled, "count");
  }

  async countByManager(manager: string): Promise<number> {
    const assembled = await this.client.count_by_manager(
      { manager: ensureSorobanAddress(manager, "manager") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "count_by_manager");
  }

  async isRegistrar(registrar: string): Promise<boolean> {
    const assembled = await this.client.is_registrar(
      { registrar: ensureSorobanAddress(registrar, "registrar") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "is_registrar");
  }

  async isManagerCurated(manager: string): Promise<boolean> {
    const assembled = await this.client.is_manager_curated(
      { manager: ensureSorobanAddress(manager, "manager") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "is_manager_curated");
  }

  async isDelisted(arka: string): Promise<boolean> {
    const assembled = await this.client.is_delisted(
      { arka: ensureSorobanAddress(arka, "arka") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "is_delisted");
  }
}

function normalizePagination(pagination: PaginationInput): { offset: number; limit: number } {
  return {
    offset: ensureUint32(pagination.offset ?? 0, "offset"),
    limit: ensureUint32(pagination.limit ?? 50, "limit"),
  };
}

export function assertContractId(value: string): string {
  return ensureNonEmptyString(value, "contractId");
}
