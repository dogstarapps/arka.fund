import fs from 'node:fs';
import {createHash} from 'node:crypto';

export function loadMainnetPresignReceipt(releaseId:string){
 const file=process.env.ARKA_MAINNET_PRESIGN_RECEIPT,expected=process.env.ARKA_MAINNET_PRESIGN_RECEIPT_SHA;
 if(!file||!expected)throw Error('PRESIGN_RECEIPT_UNAVAILABLE');
 const bytes=fs.readFileSync(file);
 if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('PRESIGN_RECEIPT_CHANGED');
 const value=JSON.parse(bytes.toString());
 if(value.releaseId!==releaseId||value.readyForSignature!==false||value.canSubmit!==false||value.signaturesCreated!==0||value.transactionsSubmitted!==0)throw Error('PRESIGN_RECEIPT_IDENTITY_MISMATCH');
 return value;
}
