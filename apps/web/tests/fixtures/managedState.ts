import {StrKey} from '@stellar/stellar-sdk';
import type {ManagedState} from '@/lib/managedWithdrawals';
export const contract=(n:number)=>StrKey.encodeContract(Buffer.alloc(32,n));
export const account=(n:number)=>StrKey.encodeEd25519PublicKey(Buffer.alloc(32,n));
export function managedState(overrides:Partial<ManagedState>={}):ManagedState{return{
 engine:'wasm-factory-soroban-host',engineId:'local-test-1',revision:0,network:'none',authorization:'mocked-local-only',clock:1020,decimals:7,currency:'USDC',fund:contract(1),factory:contract(2),token:contract(3),router:contract(4),
 factoryTemplateHash:'ab'.repeat(32),wallets:{a:account(1),b:account(2),manager:account(3),executor:account(4)},funds:[{index:0,address:contract(1),label:'Arka test'}],
 policy:{epochSeconds:60,managerWindow:3600,bufferBps:1000,minRequestShares:'1',exitFeeBps:0},nav:'1000',totalShares:'1000',cash:'200',settleCapacity:'111',reserved:'0',pendingShares:'900',pendingCount:1,head:1,nextId:2,headEligibleAt:1020,headPendingShares:'900',recoveryNeeded:'710',recoveryAvailable:'710',recoveryPublicAt:4620,poolCash:'800',accounts:[],requests:[],...overrides};}
