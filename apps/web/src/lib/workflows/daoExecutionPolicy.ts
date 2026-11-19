export const DAO_GUARDED_MUTATIONS = new Set([
  "add_points",
  "configure_credit_market",
  "clear_stellar_asset_policy",
  "register",
  "register_admin",
  "register_covered_vault",
  "remove_covered_vault",
  "upgrade",
  "mint_governed",
  "admin_burn_governed",
  "clear_bootstrap_admin",
  "clear_bootstrap_admin_expiry",
  "clear_guardian",
  "pause_stellar_asset_policy",
  "resume_stellar_asset_policy",
  "resume_symbol_asset_policy",
]);

export function methodRequiresDaoExecutor(method: string): boolean {
  const normalized = method.trim();
  if (!normalized) return false;
  return (
    normalized.startsWith("set_") ||
    normalized.startsWith("resume_") ||
    DAO_GUARDED_MUTATIONS.has(normalized)
  );
}

export function shouldBlockTypedWrite(
  mode: "write" | "read",
  domain: string,
  method: string,
): boolean {
  if (mode !== "write") return false;
  if (domain === "GovernanceExecutor") return false;
  return methodRequiresDaoExecutor(method);
}

export function shouldBlockRawWrite(input: {
  mode: "write" | "read";
  method: string;
  contractId: string;
  governanceExecutorId: string;
}): boolean {
  if (input.mode !== "write") return false;
  if (!methodRequiresDaoExecutor(input.method)) return false;
  const executorId = input.governanceExecutorId.trim();
  if (!executorId) return true;
  return input.contractId.trim() !== executorId;
}
