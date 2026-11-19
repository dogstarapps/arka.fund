import * as freighter from '@stellar/freighter-api';
import {StrKey} from '@stellar/stellar-sdk';
import {MANAGED_LOCAL_NETWORK,type ManagedWallet} from './managedWalletFlow';
const ACCOUNT_TIMEOUT='Freighter did not confirm the account in time. No transaction was submitted. Reconnect your local test wallet before trying again.';
async function boundedWalletRead<T>(read:Promise<T>,timeoutMessage:string){
 // This reads/authorizes the public account only; it never signs or submits.
 // Bound waiting even when an extension window is left unanswered. A late
 // response cannot resume the caller after the timeout has rejected it.
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([read,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(timeoutMessage)),15000);})]);}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
const accountAccess=()=>boundedWalletRead(freighter.requestAccess(),ACCOUNT_TIMEOUT);
function verifiedAddress(result:{address:string;error?:unknown}){
 if(result.error)throw Error('Freighter could not confirm account access. Nothing was submitted. Check the local test account in the extension and reconnect.');
 if(!StrKey.isValidEd25519PublicKey(result.address))throw Error('Freighter did not return a valid public address. Nothing was submitted. Reconnect your local test wallet.');
 return result.address;
}
export async function localWalletNetwork(){
 const n=await boundedWalletRead(freighter.getNetworkDetails(),'Freighter did not confirm the local network in time. No transaction was submitted. Reconnect your local test wallet.');
 if(n.error||n.networkPassphrase!==MANAGED_LOCAL_NETWORK||!['http://127.0.0.1:8000/rpc','http://localhost:8000/rpc'].includes(n.sorobanRpcUrl??''))throw Error('Switch Freighter to the local Standalone network at 127.0.0.1:8000/rpc. Mainnet and testnet are disabled.');
 return n.networkPassphrase;
}
export const productWallet:ManagedWallet={
 getAddress:async()=>{
  const result=await freighter.getAddress();
  // freighter-api 5.0.0 resolves REQUEST_PUBLIC_KEY with an empty address
  // after 2 seconds, without an error. Never mistake that for a locked wallet,
  // nor trust localStorage/the previous connection as the current identity.
  if(result.error||result.address)return verifiedAddress(result);
  // Recover public account access first, as in connectProductWallet. Asking for
  // network details before this refresh can prevent the recovery from running
  // at all when the read-only SDK request timed out. This never signs/submits;
  // a fresh, strictly local network check remains mandatory before returning.
  const fresh=verifiedAddress(await accountAccess());
  await localWalletNetwork();
  return fresh;
 },
 getNetworkPassphrase:localWalletNetwork,
 signTransaction:async(xdr,options)=>{
  // freighter-api 5 exposes `address`, but its bundled submitTransaction reads
  // `accountToSign`. Supply both and independently check the returned identity.
  const signOptions={...options,accountToSign:options.address};
  let result:Awaited<ReturnType<typeof freighter.signTransaction>>;
  try{result=await freighter.signTransaction(xdr,signOptions);}catch{throw Error('Freighter could not complete the signature. Nothing was submitted. Check the wallet request before reviewing again.');}
  if(result.error){
   if(result.error.code===-4)throw Error('Freighter reported that the signing request was declined or closed. Nothing was submitted.');
   const code=Number.isInteger(result.error.code)?` (wallet code ${result.error.code})`:'';
   throw Error(`Freighter could not complete the signature${code}. Nothing was submitted. Check the wallet request before reviewing again.`);
  }
  if(!result.signedTxXdr)throw Error('Freighter returned no signature. Nothing was submitted.');
  if(result.signerAddress&&result.signerAddress!==options.address)throw Error('Freighter signed with a different account. Nothing was submitted. Reconnect the reviewed account.');
  return result.signedTxXdr;
 },
};
export async function connectProductWallet(){
 const result=await accountAccess();await localWalletNetwork();
 return verifiedAddress(result);
}
