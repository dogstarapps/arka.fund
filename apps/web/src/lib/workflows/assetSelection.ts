import {
  CORE_STELLAR_ASSET_REGISTRY,
  findCoreStellarAssetByLookup,
  type CoreStellarAssetDefinition,
} from "@/lib/catalog/coreStellarAssetRegistry";
import { resolveAssetPresentation } from "@/lib/catalog/assetPresentation";
import { formatContractLabel } from "@/lib/catalog/format";

export type ExecutionAssetSource = "core_registry" | "vault_contract";

export interface ExecutionAssetOption {
  id: string;
  contract: string;
  label: string;
  symbol: string;
  description: string;
  source: ExecutionAssetSource;
  kind: "native" | "classic" | "contract";
  iconUrl: string | null;
  fallbackIconUrl: string | null;
  walletBalanceBase: number;
  vaultBalanceBase: number;
  walletBalanceLabel: string;
  vaultBalanceLabel: string;
  selectableForWallet: boolean;
  selectableForVault: boolean;
  coreAssetId: string | null;
}

export interface ExecutionAssetUniverseSummary {
  totalAssets: number;
  coreAssets: number;
  walletFundedAssets: number;
  vaultFundedAssets: number;
  routeAssetLabels: string[];
}

function normalizeContract(value: string): string {
  return value.trim();
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function formatBaseUnitBalance(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0000000";
  }
  return (value / 1e7).toFixed(7);
}

function resolveCoreAsset(contract: string): CoreStellarAssetDefinition | null {
  const direct = findCoreStellarAssetByLookup(contract);
  if (direct) return direct;

  return (
    CORE_STELLAR_ASSET_REGISTRY.find((entry) =>
      [entry.metadataContract, entry.selectableContract, ...entry.aliases]
        .filter(Boolean)
        .some((candidate) => normalizeLookup(candidate ?? "") === normalizeLookup(contract)),
    ) ?? null
  );
}

function buildFallbackAssetDescription(contract: string): string {
  return `Arka-supported asset ${formatContractLabel(contract, 10, 6)} available from the current allowed list or credit market.`;
}

function buildOptionId(contract: string, core: CoreStellarAssetDefinition | null): string {
  if (core) {
    return `core-${core.id}`;
  }
  return `asset-${contract.replace(/[^A-Za-z0-9]/g, "").slice(0, 18).toLowerCase()}`;
}

function resolveAssetSortRank(option: ExecutionAssetOption, originalIndex: number): number {
  const coreIndex = CORE_STELLAR_ASSET_REGISTRY.findIndex(
    (entry) => entry.id === option.coreAssetId,
  );
  if (coreIndex >= 0) {
    return coreIndex;
  }
  return CORE_STELLAR_ASSET_REGISTRY.length + originalIndex;
}

export function buildExecutionAssetOptions(input: {
  contracts: string[];
  walletBalances?: Record<string, number>;
  vaultBalances?: Record<string, number>;
}): ExecutionAssetOption[] {
  const seen = new Set<string>();
  const options = input.contracts
    .map(normalizeContract)
    .filter(Boolean)
    .filter((contract) => {
      const normalized = normalizeLookup(contract);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((contract): ExecutionAssetOption => {
      const core = resolveCoreAsset(contract);
      const presentation = resolveAssetPresentation(contract);
      const walletBalanceBase = input.walletBalances?.[contract] ?? 0;
      const vaultBalanceBase = input.vaultBalances?.[contract] ?? 0;
      const label = core?.symbol ?? presentation.label;

      return {
        id: buildOptionId(contract, core),
        contract,
        label,
        symbol: core?.symbol ?? presentation.symbol,
        description: core?.description ?? buildFallbackAssetDescription(contract),
        source: core ? "core_registry" : "vault_contract",
        kind: core?.kind ?? "contract",
        iconUrl: core?.fallbackIconUrl ?? null,
        fallbackIconUrl: core?.fallbackIconUrl ?? null,
        walletBalanceBase,
        vaultBalanceBase,
        walletBalanceLabel: formatBaseUnitBalance(walletBalanceBase),
        vaultBalanceLabel: formatBaseUnitBalance(vaultBalanceBase),
        selectableForWallet: walletBalanceBase > 0,
        selectableForVault: vaultBalanceBase > 0,
        coreAssetId: core?.id ?? null,
      };
    });

  return options
    .map((option, index) => ({ option, rank: resolveAssetSortRank(option, index) }))
    .sort((left, right) => left.rank - right.rank || left.option.label.localeCompare(right.option.label))
    .map(({ option }) => option);
}

export function getExecutionAssetOption(
  options: ExecutionAssetOption[],
  contract: string | null | undefined,
): ExecutionAssetOption | null {
  if (!contract) return null;
  const normalized = normalizeLookup(contract);
  return (
    options.find((option) => normalizeLookup(option.contract) === normalized) ?? null
  );
}

export function resolveDistinctExecutionAsset(
  options: ExecutionAssetOption[],
  selectedContract: string,
  fallbackContract = "",
): string {
  return (
    options.find((option) => option.contract !== selectedContract)?.contract ??
    fallbackContract
  );
}

export function summarizeExecutionAssetUniverse(
  options: ExecutionAssetOption[],
): ExecutionAssetUniverseSummary {
  return {
    totalAssets: options.length,
    coreAssets: options.filter((option) => option.source === "core_registry").length,
    walletFundedAssets: options.filter((option) => option.walletBalanceBase > 0).length,
    vaultFundedAssets: options.filter((option) => option.vaultBalanceBase > 0).length,
    routeAssetLabels: options.slice(0, 4).map((option) => option.label),
  };
}
