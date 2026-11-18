import { findCoreStellarAssetByLookup } from "@/lib/catalog/coreStellarAssetRegistry";

export interface CreateArkaPrefillAssetOption {
  key: string;
  contract: string | null;
  label: string;
  registryId: string | null;
  selectable: boolean;
}

export interface CreateArkaPrefillSelection {
  contract: string;
  label: string;
}

export interface CreateArkaPrefillResult {
  applied: boolean;
  denomination: CreateArkaPrefillSelection | null;
  whitelist: CreateArkaPrefillSelection[];
  search: string;
  unresolved: string[];
}

const CONTRACT_ID_RE = /^C[A-Z0-9]{20,}$/;

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function splitParamList(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function dedupeSelections(selections: CreateArkaPrefillSelection[]): CreateArkaPrefillSelection[] {
  const byContract = new Map<string, CreateArkaPrefillSelection>();
  for (const selection of selections) {
    byContract.set(selection.contract, selection);
  }
  return [...byContract.values()];
}

export function resolveCreateArkaPrefillAsset(
  value: string | null | undefined,
  options: CreateArkaPrefillAssetOption[],
): CreateArkaPrefillSelection | null {
  const rawValue = value?.trim();
  if (!rawValue) return null;
  const normalized = normalizeLookup(rawValue);
  const option = options.find((asset) => {
    const keys = [asset.contract ?? "", asset.registryId ?? "", asset.label, asset.key];
    return keys.some((key) => normalizeLookup(key) === normalized);
  });
  if (option?.selectable && option.contract) {
    return { contract: option.contract, label: option.label };
  }

  const coreAsset = findCoreStellarAssetByLookup(rawValue);
  if (coreAsset?.selectableContract) {
    return { contract: coreAsset.selectableContract, label: coreAsset.symbol };
  }

  if (CONTRACT_ID_RE.test(rawValue)) {
    return { contract: rawValue, label: rawValue };
  }

  return null;
}

export function resolveCreateArkaPrefill(
  params: URLSearchParams,
  options: CreateArkaPrefillAssetOption[],
): CreateArkaPrefillResult {
  const denominationQuery = params.get("denomination") ?? params.get("denom");
  const assetQueries = splitParamList([
    ...params.getAll("asset"),
    ...params.getAll("assets"),
    ...params.getAll("whitelist"),
  ]);
  const denomination = resolveCreateArkaPrefillAsset(denominationQuery, options);
  const whitelist = dedupeSelections(
    assetQueries
      .map((query) => resolveCreateArkaPrefillAsset(query, options))
      .filter((selection): selection is CreateArkaPrefillSelection => Boolean(selection)),
  );
  const unresolved = [
    ...(denominationQuery && !denomination ? [denominationQuery] : []),
    ...assetQueries.filter((query) => !resolveCreateArkaPrefillAsset(query, options)),
  ];
  const applied = Boolean(denomination || whitelist.length > 0 || unresolved.length > 0);
  const search = whitelist[0]?.label ?? denomination?.label ?? assetQueries[0] ?? denominationQuery ?? "";

  return {
    applied,
    denomination,
    whitelist,
    search,
    unresolved,
  };
}
