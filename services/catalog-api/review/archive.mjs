import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {sdk,NETWORK} from './sdk.mjs';import {buildIntentOperation} from './core.mjs';
const digest=review=>createHash('sha256').update(JSON.stringify(review)).digest('hex');
export function archiveReview(review){return {schema:1,review,payloadSha256:digest(review)};}
export function restoreReview(archive,profile,operations){
 assert(archive.schema===1&&archive.payloadSha256===digest(archive.review),'ARCHIVED_REVIEW_CHANGED');const r=archive.review;
 assert(r.network===NETWORK&&r.releaseId===profile.releaseId&&r.codeHash===profile.v3Wasm&&r.canSubmit===false&&r.readyForSignature===false,'ARCHIVED_REVIEW_IDENTITY');
 const tx=sdk.TransactionBuilder.fromXDR(r.unsignedEnvelope,NETWORK);assert(tx instanceof sdk.Transaction&&tx.signatures.length===0&&tx.source===r.source&&tx.operations.length===1&&tx.hash().toString('hex')===r.id&&tx.sequence===r.sequence&&tx.fee===r.totalFeeRaw&&BigInt(tx.fee)<=10000000n,'ARCHIVED_REVIEW_BODY');
 assert(tx.memo.type==='none'&&Number(tx.timeBounds.maxTime)*1000===r.expiresAt,'ARCHIVED_REVIEW_TIME_OR_MEMO');
 // Restoration is of a tiny review record only, never of a ledger or database.
 // Old review expiry does not make an ambiguous transaction safe to resend.
 assert(sdk.StrKey.isValidContract(r.fund)&&!profile.legacyIds.includes(r.fund),'ARCHIVED_LEGACY_FUND_DENIED');
 const operation=r.intent.action==='portfolio-swap'?operations.managedSpotOperation(r.fund,r.source,r.intent.step):r.intent.action==='recover-spot'?operations.managedSpotRecoveryOperation(r.fund,r.source,r.intent.step):buildIntentOperation(r.intent,r.source,profile,operations,r.ledger);
 assert.equal(tx.operations[0].func.toXDR('base64'),operation.body().invokeHostFunctionOp().hostFunction().toXDR('base64'),'ARCHIVED_REVIEW_INTENT');
 return Object.freeze(r);
}
