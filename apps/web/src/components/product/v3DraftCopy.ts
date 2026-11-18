/** Candidate-only UI copy. Raw backend diagnostics remain in archived receipts. */
export function draftCheckError(code:string):string{
 switch(code){
  case 'EXPLICIT_PUBLIC_MANAGER_REQUIRED':return 'Enter a valid public account.';
  case 'PROFILE_ASSET_SET_MISMATCH':
  case 'PROFILE_NOT_QUALIFIED_FOR_SELECTED_DENOMINATION_OR_ROUTER':return 'This preview supports XLM with XLM and USDC assets.';
  case 'INVALID_EXISTING_FEE_BPS':return 'Check the fees before continuing.';
  case 'EXISTING_MANAGED_REDEEM_FEE_GUARD':return 'A withdrawal fee is not supported for this setup.';
  default:return 'Draft check unavailable. Refresh and try again.';
 }
}
