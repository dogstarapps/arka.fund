import {
  BlobError, BlobPreconditionFailedError, get, put,
} from '@vercel/blob';

export function createBlobHistoryClient(storeId) {
  if (!/^store_[a-zA-Z0-9]+$/.test(storeId ?? '')) throw new Error('Testnet history store is not configured');
  const common = { access: 'private', storeId };
  return {
    async get(path, etag) {
      const result = await get(path, { ...common, useCache: false, ifNoneMatch: etag, abortSignal: AbortSignal.timeout(12000) });
      if (!result) return null;
      if (result.statusCode === 304) return { unchanged: true };
      if (result.blob.pathname !== path || !result.blob.etag) throw new Error('Unexpected Testnet history object');
      return { etag: result.blob.etag, bytes: Buffer.from(await new Response(result.stream).arrayBuffer()) };
    },
    async put(path, bytes, etag) {
      const result = await put(path, bytes, {
        ...common, allowOverwrite: Boolean(etag), ifMatch: etag, addRandomSuffix: false,
        contentType: 'application/gzip', cacheControlMaxAge: 60, abortSignal: AbortSignal.timeout(12000),
      });
      if (result.pathname !== path || !result.etag) throw new Error('Unexpected Testnet history write');
      return result.etag;
    },
    isConflict(error) {
      return error instanceof BlobPreconditionFailedError ||
        (error instanceof BlobError && /already exists/i.test(error.message));
    },
  };
}
