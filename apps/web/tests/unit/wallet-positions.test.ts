import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({catalog:vi.fn(),shares:vi.fn(),total:vi.fn()}));
vi.mock('@/lib/catalog/api',()=>({fetchCatalog:mocks.catalog}));
vi.mock('@/lib/soroban',()=>({readArkaShares:mocks.shares,readArkaTotalShares:mocks.total}));
import { loadWalletPositions } from '@/lib/catalog/walletPositions';
const wallet='GAOQF3U3JVZV3IYO7YYG7PKTEU7CQJP5ELYTND6IP5Z5MD6OUME5YV4F';
describe('canonical wallet investments',()=>{
  beforeEach(()=>{vi.resetAllMocks();mocks.total.mockResolvedValue(100);});
  it('includes a holder who is not the manager and excludes a managed fund with zero shares',async()=>{
    mocks.catalog.mockResolvedValue({total:2,items:[{arkaId:'CHOLDER',manager:'OTHER'},{arkaId:'CMANAGED',manager:wallet}]});
    mocks.shares.mockImplementation(async(id)=>id==='CHOLDER'?10:0);
    const result=await loadWalletPositions(wallet);
    expect(result.positions.map(p=>p.fund.arkaId)).toEqual(['CHOLDER']);
    expect(result.failed).toBe(0);expect(result.scanned).toBe(2);
    expect(mocks.shares).toHaveBeenCalledWith('CHOLDER',expect.any(String),wallet);
  });
  it('reports failed ownership reads instead of declaring an empty wallet',async()=>{
    mocks.catalog.mockResolvedValue({total:1,items:[{arkaId:'CFAIL'}]});mocks.shares.mockRejectedValue(new Error('RPC failed'));
    const result=await loadWalletPositions(wallet);expect(result.failed).toBe(1);expect(result.positions).toEqual([]);
  });
  it('does not lose a holding when only the value is unavailable',async()=>{
    mocks.catalog.mockResolvedValue({total:1,items:[{arkaId:'CHOLDER'}]});mocks.shares.mockResolvedValue(10);mocks.total.mockResolvedValue(null);
    expect((await loadWalletPositions(wallet)).positions[0].totalSharesBase).toBeNull();
  });
  it('validates public addresses and honours cancellation without a false empty result',async()=>{
    await expect(loadWalletPositions('SSECRET')).rejects.toThrow('public address');
    const controller=new AbortController();controller.abort();await expect(loadWalletPositions(wallet,controller.signal)).rejects.toThrow();
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it('flags an incomplete catalog scan',async()=>{
    mocks.catalog.mockResolvedValueOnce({total:101,items:[{arkaId:'CONE'}]}).mockResolvedValueOnce({total:101,items:[]});mocks.shares.mockResolvedValue(1);
    expect((await loadWalletPositions(wallet)).truncated).toBe(true);
  });
});
