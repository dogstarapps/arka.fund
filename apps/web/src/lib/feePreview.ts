// Accounting validation only. No fee policy, rate, cap or financial action.
export const feeFields=['timestamp','nav','total_shares_before','share_price_before','management_fee_value','management_fee_shares','performance_fee_value','performance_fee_shares','manager_fee_shares','protocol_fee_shares','total_shares_after','share_price_after','high_water_mark_before','high_water_mark_after'] as const;
export type FeePreview=Record<typeof feeFields[number],string>;
export function feePreview(value:unknown,total:string,nav:string,time:number):FeePreview{
 const fail=()=>{throw Error('FEE_PREVIEW_RECONCILIATION_FAILED');};
 if(!value||typeof value!=='object'||Array.isArray(value))return fail();
 const source=value as Record<string,unknown>,out={} as FeePreview;
 for(const key of feeFields){const raw=source[key];if((typeof raw!=='string'&&typeof raw!=='bigint')||!/^(0|[1-9]\d*)$/.test(String(raw))||BigInt(String(raw))>BigInt('170141183460469231731687303715884105727'))return fail();out[key]=String(raw);}
 if(!Number.isSafeInteger(time)||time<0||out.timestamp!==String(time)||out.nav!==nav||out.total_shares_before!==total)return fail();
 const n=(key:typeof feeFields[number])=>BigInt(out[key]);
 if(n('total_shares_after')!==n('total_shares_before')+n('management_fee_shares')+n('performance_fee_shares')||n('manager_fee_shares')+n('protocol_fee_shares')!==n('management_fee_shares')+n('performance_fee_shares'))return fail();
 return out;
}
