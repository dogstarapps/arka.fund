import type { CatalogAssetPrice } from "@/lib/catalog/types";

export function isCatalogAssetPriceUsable(
  price: CatalogAssetPrice | null | undefined,
): price is CatalogAssetPrice & { priceUsd: string } {
  return (
    Boolean(price?.priceUsd && /^\d+$/.test(price.priceUsd)) &&
    BigInt(price?.priceUsd ?? "0") > BigInt(0) &&
    (price?.oracleStatus === "verified" ||
      price?.oracleStatus === "not_required_usd_stablecoin") &&
    Number.isSafeInteger(price?.decimals) &&
    (price?.decimals ?? -1) >= 0
  );
}
