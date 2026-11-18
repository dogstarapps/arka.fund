import { StrKey } from '@stellar/stellar-sdk';
import { fetchCatalog } from './api';
import type { Page, RankedArkaCatalogEntry } from './types';
import { readArkaShares, readArkaTotalShares } from '@/lib/soroban';
import { SIM_ACCOUNT } from '@/lib/config';

export interface WalletPosition { fund: RankedArkaCatalogEntry; sharesBase: number; totalSharesBase: number | null; }
export interface WalletPositionsResult { positions: WalletPosition[]; scanned: number; failed: number; truncated: boolean; }
export const isPublicWalletAddress = (value: string) => StrKey.isValidEd25519PublicKey(value);

// Ownership is shares_of, not manager identity or legacy share-token balances.
// Bounded catalog scan is explicit until a canonical holder-to-funds index exists.
export async function loadWalletPositions(wallet: string, signal?: AbortSignal): Promise<WalletPositionsResult> {
  if (!isPublicWalletAddress(wallet)) throw new Error('Enter a valid Stellar public address beginning with G.');
  const funds: RankedArkaCatalogEntry[] = [];
  let total = Infinity;
  for (let offset = 0; offset < total && offset < 1000; offset += 100) {
    signal?.throwIfAborted();
    const page = await fetchCatalog<Page<RankedArkaCatalogEntry>>('/v1/arkas', { limit: 100, offset }, { signal });
    total = page.total;
    funds.push(...page.items);
    if (page.items.length === 0) break;
  }
  const uniqueFunds = [...new Map(funds.map(fund => [fund.arkaId, fund])).values()];
  const result: WalletPositionsResult = { positions: [], scanned: 0, failed: 0, truncated: uniqueFunds.length < total };
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, uniqueFunds.length) }, async () => {
    while (cursor < uniqueFunds.length) {
      signal?.throwIfAborted();
      const fund = uniqueFunds[cursor++]!;
      try {
        const shares = await readArkaShares(fund.arkaId, SIM_ACCOUNT, wallet);
        signal?.throwIfAborted();
        if (!Number.isSafeInteger(shares) || shares < 0) throw new Error('Ownership unavailable');
        if (shares > 0) {
          const totalShares = await readArkaTotalShares(fund.arkaId).catch(() => null);
          result.positions.push({ fund, sharesBase: shares, totalSharesBase: totalShares });
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        result.failed++;
      }
      result.scanned++;
    }
  }));
  signal?.throwIfAborted();
  result.positions.sort((a,b) => a.fund.arkaId.localeCompare(b.fund.arkaId));
  return result;
}
