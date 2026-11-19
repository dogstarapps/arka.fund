export interface CreateArkaMandateAssetOption {
  contract: string | null;
  label: string;
}

export interface CreateArkaMandateChip {
  contract: string;
  label: string;
  locked: boolean;
}

function normalizeContract(value: string): string {
  return value.trim();
}

function uniqueContracts(contracts: string[]): string[] {
  return Array.from(new Set(contracts.map(normalizeContract).filter(Boolean)));
}

function resolveChipLabel(
  contract: string,
  options: CreateArkaMandateAssetOption[],
  fallbackLabel: (contract: string) => string,
): string {
  return options.find((option) => option.contract === contract)?.label ?? fallbackLabel(contract);
}

export function buildCreateArkaMandateChips(
  params: {
    denominationContract: string;
    whitelistContracts: string[];
    options: CreateArkaMandateAssetOption[];
  },
  fallbackLabel: (contract: string) => string = (contract) => contract,
): { denomination: CreateArkaMandateChip | null; allowed: CreateArkaMandateChip[] } {
  const denominationContract = normalizeContract(params.denominationContract);
  const denomination = denominationContract
    ? {
        contract: denominationContract,
        label: resolveChipLabel(denominationContract, params.options, fallbackLabel),
        locked: true,
      }
    : null;
  const allowed = uniqueContracts(params.whitelistContracts)
    .filter((contract) => contract !== denominationContract)
    .map((contract) => ({
      contract,
      label: resolveChipLabel(contract, params.options, fallbackLabel),
      locked: false,
    }));

  return { denomination, allowed };
}
