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
import { ensureSorobanAddress, ensureUint32 } from "../core/validation.js";
import {
  Client as VenueRegistryContractClient,
  type VenueConfig,
} from "../generated/venue-registry.js";

export const VenueStatus = {
  Disabled: 0,
  ManualOnly: 1,
  Auto: 2,
  Deprecated: 3,
} as const;

export type VenueStatus = (typeof VenueStatus)[keyof typeof VenueStatus];

export interface VenuePaginationInput {
  offset?: number;
  limit?: number;
}

export class VenueRegistryModule {
  private readonly client: VenueRegistryContractClient;

  constructor(
    private readonly config: ArkafundSdkConfig,
    contractId: string,
  ) {
    this.client = new VenueRegistryContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async list(pagination: VenuePaginationInput = {}): Promise<string[]> {
    const assembled = await this.client.venues(
      normalizePagination(pagination),
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "venues");
  }

  async configFor(venue: string): Promise<VenueConfig | null> {
    const assembled = await this.client.venue_config(
      { venue: ensureSorobanAddress(venue, "venue") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "venue_config");
  }

  async isConfigured(venue: string): Promise<boolean> {
    return this.readBoolean("is_configured", venue);
  }

  async isAllowed(venue: string): Promise<boolean> {
    return this.readBoolean("is_allowed", venue);
  }

  async isAutoAllowed(venue: string): Promise<boolean> {
    return this.readBoolean("is_auto_allowed", venue);
  }

  async buildSetStatus(
    caller: string,
    venue: string,
    status: VenueStatus,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    assertVenueStatus(status);
    return this.client.set_venue_status(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        venue: ensureSorobanAddress(venue, "venue"),
        status,
      },
      mergeCallOptions(this.config, options),
    );
  }

  async setStatus(
    caller: string,
    venue: string,
    status: VenueStatus,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildSetStatus(caller, venue, status, options);
    return submitTransaction(this.config, assembled);
  }

  async buildDisable(
    caller: string,
    venue: string,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.disable_venue(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        venue: ensureSorobanAddress(venue, "venue"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async disable(
    caller: string,
    venue: string,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildDisable(caller, venue, options);
    return submitTransaction(this.config, assembled);
  }

  private async readBoolean(
    method: "is_configured" | "is_allowed" | "is_auto_allowed",
    venue: string,
  ): Promise<boolean> {
    const assembled = await this.client[method](
      { venue: ensureSorobanAddress(venue, "venue") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, method);
  }
}

function normalizePagination(pagination: VenuePaginationInput): { offset: number; limit: number } {
  return {
    offset: ensureUint32(pagination.offset ?? 0, "offset"),
    limit: ensureUint32(pagination.limit ?? 50, "limit"),
  };
}

function assertVenueStatus(status: number): asserts status is VenueStatus {
  if (!Number.isInteger(status) || status < VenueStatus.Disabled || status > VenueStatus.Deprecated) {
    throw new Error("status must be a supported venue status");
  }
}
