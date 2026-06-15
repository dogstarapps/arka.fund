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
  ensurePositiveInt,
  ensureSorobanAddress,
  ensureUint32,
} from "../core/validation.js";
import {
  Client as OracleGuardContractClient,
  type OracleAsset,
  type AssetInspection,
  type AssetPolicy,
  type OraclePriceData,
} from "../generated/oracle-guard.js";

export const DivergenceMode = {
  FailClosed: 0,
  UseSecondary: 1,
  UseLowerPrice: 2,
} as const;

export type DivergenceMode =
  (typeof DivergenceMode)[keyof typeof DivergenceMode];

export interface StellarAssetPolicyInput {
  caller: string;
  asset: string;
  primary: string;
  secondary: string;
  hasSecondary: boolean;
  maxPriceAge: bigint | number | string;
  maxDeviationBps: number;
  requireSecondary: boolean;
  divergenceMode: DivergenceMode;
}

export interface SymbolAssetPolicyInput extends Omit<StellarAssetPolicyInput, "asset"> {
  symbol: string;
}

export class OracleGuardModule {
  private readonly client: OracleGuardContractClient;

  constructor(
    private readonly config: ArkafundSdkConfig,
    contractId: string,
  ) {
    this.client = new OracleGuardContractClient(
      createClientOptions(config, ensureSorobanAddress(contractId, "contractId")),
    );
  }

  async init(
    admin: string,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildInit(admin, options);
    return submitTransaction(this.config, assembled);
  }

  buildInit(
    admin: string,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.init(
      { admin: ensureSorobanAddress(admin, "admin") },
      mergeCallOptions(this.config, options),
    );
  }

  async admin(): Promise<string> {
    const assembled = await this.client.admin(mergeCallOptions(this.config, undefined, true));
    return expectSimulationResult(assembled, "admin");
  }

  async setStellarPolicy(
    input: StellarAssetPolicyInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.buildSetStellarPolicy(input, options);
    return submitTransaction(this.config, assembled);
  }

  buildSetStellarPolicy(
    input: StellarAssetPolicyInput,
    options?: ArkafundCallOptions,
  ): Promise<AssembledTransaction<null>> {
    validatePolicyInput(input);
    return this.client.set_stellar_asset_policy(
      {
        caller: ensureSorobanAddress(input.caller, "caller"),
        asset: ensureSorobanAddress(input.asset, "asset"),
        primary: ensureSorobanAddress(input.primary, "primary"),
        secondary: ensureSorobanAddress(input.secondary, "secondary"),
        has_secondary: input.hasSecondary,
        max_price_age: ensurePositiveInt(input.maxPriceAge, "maxPriceAge"),
        max_deviation_bps: ensureBps(input.maxDeviationBps, "maxDeviationBps"),
        require_secondary: input.requireSecondary,
        divergence_mode: ensureUint32(input.divergenceMode, "divergenceMode"),
      },
      mergeCallOptions(this.config, options),
    );
  }

  async setSymbolPolicy(
    input: SymbolAssetPolicyInput,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    validatePolicyInput(input);
    const assembled = await this.client.set_symbol_asset_policy(
      {
        caller: ensureSorobanAddress(input.caller, "caller"),
        symbol: input.symbol,
        primary: ensureSorobanAddress(input.primary, "primary"),
        secondary: ensureSorobanAddress(input.secondary, "secondary"),
        has_secondary: input.hasSecondary,
        max_price_age: ensurePositiveInt(input.maxPriceAge, "maxPriceAge"),
        max_deviation_bps: ensureBps(input.maxDeviationBps, "maxDeviationBps"),
        require_secondary: input.requireSecondary,
        divergence_mode: ensureUint32(input.divergenceMode, "divergenceMode"),
      },
      mergeCallOptions(this.config, options),
    );
    return submitTransaction(this.config, assembled);
  }

  async clearStellarPolicy(
    caller: string,
    asset: string,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.client.clear_stellar_asset_policy(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        asset: ensureSorobanAddress(asset, "asset"),
      },
      mergeCallOptions(this.config, options),
    );
    return submitTransaction(this.config, assembled);
  }

  async clearSymbolPolicy(
    caller: string,
    symbol: string,
    options?: ArkafundCallOptions,
  ): Promise<SubmittedTransaction<null>> {
    const assembled = await this.client.clear_symbol_asset_policy(
      {
        caller: ensureSorobanAddress(caller, "caller"),
        symbol,
      },
      mergeCallOptions(this.config, options),
    );
    return submitTransaction(this.config, assembled);
  }

  async stellarAssetPolicy(asset: string): Promise<AssetPolicy | null> {
    const assembled = await this.client.stellar_asset_policy(
      { asset: ensureSorobanAddress(asset, "asset") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "stellar_asset_policy");
  }

  async symbolAssetPolicy(symbol: string): Promise<AssetPolicy | null> {
    const assembled = await this.client.symbol_asset_policy(
      { symbol },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "symbol_asset_policy");
  }

  async inspectStellar(asset: string): Promise<AssetInspection> {
    const assembled = await this.client.inspect_stellar(
      { asset: ensureSorobanAddress(asset, "asset") },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "inspect_stellar");
  }

  async inspectSymbol(symbol: string): Promise<AssetInspection> {
    const assembled = await this.client.inspect_symbol(
      { symbol },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "inspect_symbol");
  }

  async lastPrice(asset: OracleAsset): Promise<OraclePriceData> {
    const assembled = await this.client.lastprice(
      { asset },
      mergeCallOptions(this.config, undefined, true),
    );
    return expectSimulationResult(assembled, "lastprice");
  }
}

function validatePolicyInput(
  input: Pick<
    StellarAssetPolicyInput,
    "hasSecondary" | "requireSecondary" | "divergenceMode" | "maxDeviationBps"
  >,
): void {
  ensureBps(input.maxDeviationBps, "maxDeviationBps");
  ensureUint32(input.divergenceMode, "divergenceMode");
  if (input.requireSecondary && !input.hasSecondary) {
    throw new Error("requireSecondary cannot be true when hasSecondary is false");
  }
}
