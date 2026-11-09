export interface ManagedRequest {
  id: string; owner: string; requested_shares: string; pending_shares: string;
  settled_shares: string; cancelled_shares: string; claimable_assets: string;
  claimed_assets: string; created_at: string; eligible_at: string; last_settled_at: string;
}
export interface ManagedProjectionInput {
  fundId: string; totalShares: string; nav: string | null; reservedAssets: string;
  balances: {owner: string; shares: string}[]; requests: ManagedRequest[];
  historyComplete: boolean; holdersComplete: boolean;
}
export interface ManagedObservation extends Omit<ManagedProjectionInput, "fundId"> {
  schemaVersion: 1; arkaId: string; wasmHash: string; ledger: number;
  observedAt: string; fromLedger: number; toLedger: number;
  /** Proven registry registration by the configured factory, when available. */
  creationLedger?: number;
  /** Missing/unsupported protection pauses deposits, not existing withdrawal rights. */
  depositProtectionVersion?: 1 | null;
}
export interface ManagedInvestor {
  owner: string; freeSharesRaw: string; pendingSharesRaw: string;
  economicSharesRaw: string; ownershipBps: number; claimableAssetsRaw: string;
  paidAssetsRaw: string; shareValueRaw: string | null; positionValueRaw: string | null;
}
export interface ManagedProjection {
  schema: 1; scope: "candidate-v3-read-model"; fundId: string; complete: true;
  navAvailable: boolean; denominationValuesOnly: true; investors: ManagedInvestor[];
  excludedEscrowSharesRaw: string; reservedAssetsRaw: string; historicalRequests: number;
}
export interface ManagedCodeIdentity {kind: "legacy" | "v3" | "unknown"; codeHash: string; ledger: number;}
export interface ManagedSnapshotSource {
  identify(arka: import("./types.js").ArkaCatalogEntry): Promise<ManagedCodeIdentity>;
  read(arka: import("./types.js").ArkaCatalogEntry, identity: ManagedCodeIdentity): Promise<ManagedObservation>;
}
export interface ManagedCatalogState {
  version: 3 | null; status: "verified" | "unavailable"; codeHash: string | null;
  observationId?: string; ledger?: number; indexedAt?: string;
  pendingShares?: string; reservedAssets?: string; unavailableReason?: string;
  /** A live capability probe, separate from the immutable financial observation. */
  depositProtectionVersion?: 1 | null;
}
export class ManagedCatalogUnavailable extends Error {
  readonly statusCode = 503;
  constructor(readonly code = "managed_withdrawals_unavailable") {super(code);}
}
