import { isStagingReadOnlyRpcEnabled, PREVIEW_READ_ONLY_MESSAGE } from '@/lib/previewSafety';
import { isAllowedStagingRpcRequest, STAGING_PUBLIC_RPC, STAGING_RPC_BODY_LIMIT } from '@/lib/stagingReadOnlyRpc';

export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store', 'content-type': 'application/json' };

export async function POST(request: Request): Promise<Response> {
  if (!isStagingReadOnlyRpcEnabled()) {
    return Response.json({ error: 'Snapshot-only candidate. Direct RPC is disabled.' }, { status: 403, headers });
  }
  if (Number(request.headers.get('content-length')) > STAGING_RPC_BODY_LIMIT) {
    return Response.json({ error: 'RPC request is too large.' }, { status: 413, headers });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > STAGING_RPC_BODY_LIMIT) {
      return Response.json({ error: 'RPC request is too large.' }, { status: 413, headers });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid RPC request.' }, { status: 400, headers });
  }
  if (!isAllowedStagingRpcRequest(body)) {
    return Response.json({ error: { code: -32601, message: PREVIEW_READ_ONLY_MESSAGE } }, { status: 403, headers });
  }
  try {
    const upstream = await fetch(STAGING_PUBLIC_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      return Response.json({ error: 'Stellar RPC is temporarily unavailable.' }, { status: 502, headers });
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: 'Stellar RPC is temporarily unavailable.' }, { status: 502, headers });
  }
}
