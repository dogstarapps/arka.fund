import * as sdk from '@stellar/stellar-sdk';
export {sdk};
export const NETWORK='Public Global Stellar Network ; September 2015';
export const instanceKey=id=>new sdk.Contract(id).getFootprint().toXDR('base64');
export const plain=v=>v===undefined?null:JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x instanceof Map?Object.fromEntries([...x].map(([k,v])=>[Buffer.isBuffer(k)?'hex:'+k.toString('hex'):String(k),v])):Buffer.isBuffer(x)?x.toString('hex'):x));
