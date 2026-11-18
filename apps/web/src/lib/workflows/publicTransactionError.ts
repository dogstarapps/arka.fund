import {
  classifyWalletProviderFailure,
  describeWalletError,
} from "./walletProviderRejectionMatrix";

export function describePublicTransactionError(
  error: unknown,
  fallback: string,
): string {
  const message = describeWalletError(error);

  if (/read-only UX preview/i.test(message)) return message;
  if (message === 'SWAP_REVIEW_MINIMUM_CHANGED') {
    return 'The quote changed and no longer meets the minimum you reviewed. Review the updated quote before signing.';
  }
  if (/redeem|redemption|withdrawal/i.test(fallback) && /Error\(Contract,\s*#12\)|contract error #12/i.test(message)) {
    return 'The fund does not have enough cash in its withdrawal asset for this amount. Try a smaller amount or ask the manager to restore liquidity. This is not a request to deposit more money.';
  }
  if (/redeem|redemption|withdrawal/i.test(fallback) && /Error\(Contract,\s*#7\)|contract error #7/i.test(message)) {
    return 'This amount exceeds your shares in the fund. Refresh your position and choose a smaller amount.';
  }

  if (/Error\(Contract,\s*#40\)|contract error #40/i.test(message)) {
    return "A live valuation is not available for this asset, so it cannot be deposited yet. Choose an asset marked available.";
  }

  if (
    /HostError|BudgetExceeded|DebugInfo not available|simulation failed|Error\(Contract|contract error #|rpc error|jsonrpc/i.test(
      message,
    )
  ) {
    return `${fallback} No funds were moved. Please try again.`;
  }

  const walletFailure = classifyWalletProviderFailure(error);

  if (walletFailure === "signing_timeout") {
    return "Your wallet did not respond in time. Check the wallet window and try again.";
  }
  if (walletFailure === "user_rejected") {
    return "The request was cancelled in your wallet. You can try again when ready.";
  }
  if (walletFailure === "provider_disconnected") {
    return "The connected wallet is unavailable. Reconnect it and try again.";
  }
  if (walletFailure === "malformed_signature") {
    return "The wallet response could not be verified. Reconnect your wallet and try again.";
  }
  if (/not enough balance|insufficient (token )?balance/i.test(message)) {
    return "Your wallet does not have enough of the selected asset for this transaction.";
  }
  if (/not enough allowance|approval is missing|allowance/i.test(message)) {
    return "Token approval is still required. Approve the asset in your wallet and try again.";
  }
  if (/invalid amount|positive amount/i.test(message)) {
    return "Enter an amount greater than zero.";
  }
  if (/amount exceeds wallet balance/i.test(message)) {
    return "The amount is higher than the available wallet balance.";
  }
  if (/no shares/i.test(message)) {
    return "There are no shares available to redeem.";
  }
  if (
    /^(Current vault risk checks|Credit market configuration|Credit action is not enabled|Borrowing is not enabled|Credit market risk policy|There is no outstanding|Enter no more than the outstanding debt|Token approval is not confirmed)/i.test(
      message,
    )
  ) {
    return message;
  }

  return fallback;
}
