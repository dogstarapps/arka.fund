export type ProtocolId = 'SOROSWAP' | 'AQUARIUS' | 'SUSHI' | 'PHOENIX' | 'BALANCED' | 'BLEND';
export type VenueStatus = 0 | 1 | 2 | 3;
export type VenueAction = 'manual_swap' | 'auto_swap' | 'supply' | 'borrow' | 'withdraw' | 'repay';
export type VenueSnapshot = {
  registry: string; venue: string; network: string; status: VenueStatus;
  updatedAt: string; updatedBy: string; observedAt: number;
};
export const PROTOCOL_LABELS: Record<ProtocolId, string> = {SOROSWAP:'SoroSwap',AQUARIUS:'Aquarius',SUSHI:'Sushi',PHOENIX:'Phoenix',BALANCED:'Balanced',BLEND:'Blend'};
export const LAUNCH_SWAP_PROTOCOLS = ['SOROSWAP', 'AQUARIUS', 'SUSHI', 'BALANCED'] as const;

export function protocolVenueAllowed(protocol: ProtocolId, snapshot: VenueSnapshot | null | undefined, action: VenueAction, network: string, now=Date.now()): boolean {
  if(protocol === 'PHOENIX' || !snapshot || snapshot.network !== network || !Number.isFinite(snapshot.observedAt) || now < snapshot.observedAt || now-snapshot.observedAt>30_000) return false;
  if(action === 'withdraw' || action === 'repay') return snapshot.status===1 || snapshot.status===2 || snapshot.status===3;
  if(action === 'auto_swap') return snapshot.status===2;
  return snapshot.status===1 || snapshot.status===2;
}
export function venueStatusLabel(status: VenueStatus | null | undefined): string {
  return status===0?'Paused':status===1?'Manual only':status===2?'Available':status===3?'Withdrawals only':'Permissions unavailable';
}
export function venueFingerprint(snapshot: VenueSnapshot): string {
  return JSON.stringify([snapshot.network,snapshot.registry,snapshot.venue,snapshot.status,snapshot.updatedAt,snapshot.updatedBy]);
}
export function assertVenueReviewUnchanged(before: VenueSnapshot, after: VenueSnapshot, protocol: ProtocolId, action: VenueAction, network: string): void {
  if(!protocolVenueAllowed(protocol,after,action,network)||venueFingerprint(before)!==venueFingerprint(after)) throw new Error('Protocol availability changed. Refresh and review this operation again.');
}
