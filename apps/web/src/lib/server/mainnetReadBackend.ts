export function mainnetReadBackendOrigin(value: string | undefined): string {
 const endpoint = new URL(value ?? '');
 const local = endpoint.protocol === 'http:' && endpoint.hostname === '127.0.0.1' && !!endpoint.port;
 if ((!local && endpoint.protocol !== 'https:') || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw Error('BACKEND');
 return endpoint.origin;
}

export function trustedMainnetReadRequest(request: Request): boolean {
 try {
 const page = new URL(request.url), host = request.headers.get('host'), origin = request.headers.get('origin');
 if (!host || page.host !== host || (origin && origin !== page.origin)) return false;
 if (page.protocol === 'http:' && /^127\.0\.0\.1:\d+$/.test(host)) return true;
 if (page.protocol !== 'https:') return false;
 return (process.env.ARKA_REVIEW_PUBLIC_ORIGINS ?? '').split(',').map(v => v.trim()).filter(Boolean).some(value => {
  const allowed = new URL(value);
  return allowed.protocol === 'https:' && !allowed.username && !allowed.password && allowed.pathname === '/' && !allowed.search && !allowed.hash && allowed.origin === page.origin;
 });
 } catch { return false; }
}
