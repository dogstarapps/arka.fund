import { NextRequest, NextResponse } from 'next/server';
import { UX_REVIEW_PREVIEW, PREVIEW_READ_ONLY_MESSAGE, isReadOnlyRpcPayload } from '@/lib/previewSafety';

export async function middleware(request: NextRequest) {
  if (!UX_REVIEW_PREVIEW || request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return NextResponse.next();
  const path = request.nextUrl.pathname;
  // This single loopback-only endpoint mutates an in-memory native test host,
  // never blockchain state. Its route independently validates every action.
  const host = request.headers.get('host') ?? '';
  if (process.env.ARKA_MANAGED_PREVIEW === '1' && request.method === 'POST'
      && (path === '/api/managed-withdrawals-preview' || (process.env.ARKA_MANAGED_INTEGRATION === '1' && path === '/api/managed-withdrawals-preview/wallet')) && /^127\.0\.0\.1:\d+$/.test(host)
      && request.headers.get('origin') === `http://${host}`
      && request.headers.get('x-arka-local-preview') === '1') return NextResponse.next();
  // These endpoints only estimate. All mutation/profile/intent submission endpoints stay blocked.
  if (request.method === 'POST' && ['/api/routing/rebalance/plan', '/api/intents/balanced/quote'].includes(path)) {
    try {
      const body = await request.clone().json();
      if (body && typeof body === 'object' && !Array.isArray(body) && !body.intentTxHash) return NextResponse.next();
    } catch { /* reject malformed estimation requests */ }
  }
  if (request.method === 'POST' && path === '/api/soroban/rpc') {
    try { if (isReadOnlyRpcPayload(await request.clone().json())) return NextResponse.next(); } catch { /* reject malformed input */ }
  }
  return NextResponse.json({ error: { code: -32601, message: PREVIEW_READ_ONLY_MESSAGE } }, { status: 403 });
}

export const config = { matcher: '/api/:path*' };
