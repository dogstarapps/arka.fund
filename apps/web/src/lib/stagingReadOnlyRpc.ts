import { Networks, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { isReadOnlyRpcPayload } from './previewSafety';

export const STAGING_PUBLIC_RPC = 'https://rpc.lightsail.network/';
export const STAGING_RPC_BODY_LIMIT = 64 * 1024;

const SIMULATION_READS = new Set([
  'allowance', 'balance', 'credit_borrow_policy', 'credit_market_assets',
  'credit_market_configs', 'credit_market_status', 'credit_market_value',
  'credit_position_values', 'credit_protocols', 'credit_risk_policy',
  'blend_v2_risk_source', 'denomination', 'estimate_swap', 'fee', 'factory',
  'get_amounts_out', 'get_pool', 'get_pools', 'is_caller', 'is_paused',
  'liquid_balance', 'managed_routes', 'manager', 'nav', 'pool_route',
  'quote_exact_input', 'router', 'router_get_amounts_out', 'share_token',
  'shares_of', 'token0', 'token1', 'total_shares', 'venue_config',
  'venue_registry', 'whitelist',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isAllowedStagingRpcRequest(body: unknown): boolean {
  if (!isRecord(body) || body.jsonrpc !== '2.0' ||
      (typeof body.id !== 'string' && typeof body.id !== 'number') ||
      !isReadOnlyRpcPayload(body)) return false;
  if (body.method !== 'simulateTransaction') return true;
  if (!isRecord(body.params) ||
      Object.entries(body.params).some(([key, value]) => key !== 'transaction' && value !== undefined) ||
      typeof body.params.transaction !== 'string' ||
      body.params.transaction.length > STAGING_RPC_BODY_LIMIT) return false;
  try {
    const transaction = TransactionBuilder.fromXDR(body.params.transaction, Networks.PUBLIC);
    if (!(transaction instanceof Transaction) || transaction.signatures.length !== 0 ||
        transaction.operations.length !== 1) return false;
    const operation = transaction.operations[0];
    return operation.type === 'invokeHostFunction' && (operation.auth?.length ?? 0) === 0 &&
      operation.func.switch().name === 'hostFunctionTypeInvokeContract' &&
      SIMULATION_READS.has(operation.func.invokeContract().functionName().toString());
  } catch {
    return false;
  }
}
