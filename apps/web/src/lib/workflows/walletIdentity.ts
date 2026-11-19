export function normalizeWalletPubkey(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveWalletChangedPubkey(
  detail: unknown,
  storedPubkey: string | null | undefined,
): string {
  if (typeof detail === "string") {
    return normalizeWalletPubkey(detail);
  }
  return normalizeWalletPubkey(storedPubkey);
}

export function shouldPauseWalletAutoHydration(pubkey: unknown): boolean {
  return normalizeWalletPubkey(pubkey).length === 0;
}
