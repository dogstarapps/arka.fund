import { gzipSync, gunzipSync } from 'node:zlib';

const archiveVersion = 1;
const catalogSchema = 3;
const samplingMs = 5 * 60_000;
const lookupCacheMs = 15_000;
const maxArchiveBytes = 128 * 1024 * 1024;

export class BlobCatalogHistory {
  #cached;
  #client;
  #registry;
  #network;
  #path;
  #initialize;

  constructor({ client, network, registry, initialize = false }) {
    if (!/^C[A-Z2-7]{55}$/.test(registry) || network !== 'Test SDF Network ; September 2015') {
      throw new Error('Invalid Testnet history identity');
    }
    this.#client = client;
    this.#network = network;
    this.#registry = registry;
    this.#path = 'catalog-history/v1/testnet/' + registry + '/history.json.gz';
    this.#initialize = initialize;
  }

  #validate(archive) {
    if (archive.kind !== 'arka-testnet-catalog-history' || archive.version !== archiveVersion ||
        archive.network !== this.#network || archive.registry !== this.#registry ||
        !Array.isArray(archive.runs) || !Array.isArray(archive.importedPoints)) {
      throw new Error('Unexpected Testnet history archive');
    }
    return archive;
  }

  #initial() {
    if (!this.#initialize) throw new Error('Persistent Testnet history has not been initialized');
    return this.#validate({
      kind: 'arka-testnet-catalog-history',
      version: archiveVersion,
      network: this.#network,
      registry: this.#registry,
      runs: [],
      importedPoints: [],
    });
  }

  async #record(fresh = false) {
    const current = this.#cached;
    if (!fresh && current && Date.now() - current.readAt < lookupCacheMs) return current;
    const result = await this.#client.get(this.#path, current?.etag);
    if (!result) {
      if (current) throw new Error('Persistent Testnet history disappeared');
      return null;
    }
    if (result.unchanged) {
      if (!current) throw new Error('Unexpected Testnet history ETag');
      current.readAt = Date.now();
      return current;
    }
    const archive = this.#validate(JSON.parse(gunzipSync(result.bytes, { maxOutputLength: maxArchiveBytes }).toString('utf8')));
    return this.#cached = { archive, etag: result.etag, readAt: Date.now() };
  }

  async read() {
    const record = await this.#record();
    if (!record) throw new Error('Persistent Testnet history has not been initialized');
    const runs = record.archive.runs;
    return { schemaVersion: catalogSchema, retentionLimit: runs.length || 1, updatedAt: runs.at(-1)?.syncedAt ?? new Date(0).toISOString(), runs };
  }

  async append(snapshot) {
    if (!/Z$/.test(snapshot.syncedAt) || !Number.isFinite(Date.parse(snapshot.syncedAt)) ||
        !Array.isArray(snapshot.arkas) || !snapshot.arkas.length || snapshot.failures.length ||
        !snapshot.arkas.every(arka => arka.nav != null)) {
      if (!await this.#record()) throw new Error('Initial Testnet history requires a complete observation');
      return this.read();
    }
    const observedAt = Date.parse(snapshot.syncedAt);
    const slot = Math.floor(observedAt / samplingMs);
    for (let attempt = 0; attempt < 6; attempt++) {
      const record = await this.#record(true);
      const current = record?.archive ?? this.#initial();
      if (record && current.runs.some(run => Math.floor(Date.parse(run.syncedAt) / samplingMs) === slot)) return this.read();
      const archive = {
        ...current,
        runs: [...current.runs, snapshot].sort((a, b) => a.syncedAt.localeCompare(b.syncedAt)),
      };
      const raw = JSON.stringify(archive);
      if (Buffer.byteLength(raw) > maxArchiveBytes) throw new Error('Testnet history archive exceeds its segment size');
      try {
        const etag = await this.#client.put(this.#path, gzipSync(raw), record?.etag);
        this.#cached = { archive, etag, readAt: Date.now() };
        return this.read();
      } catch (error) {
        // Retry the merge when another instance appended first, including creation.
        if (!this.#client.isConflict(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new Error('Testnet history compare-and-set retries exhausted');
  }

  async page(arkaId, basePage, query) {
    const record = await this.#record();
    if (!record) throw new Error('Persistent Testnet history has not been initialized');
    const min = query.from ? Date.parse(query.from) : -Infinity;
    const max = query.to ? Date.parse(query.to) : Infinity;
    const merged = new Map();
    for (const point of record.archive.importedPoints) {
      const at = Date.parse(point.syncedAt);
      if (point.arkaId === arkaId && at >= min && at <= max) merged.set(point.syncedAt, point);
    }
    for (const point of basePage.items) merged.set(point.syncedAt, point);
    const ordered = [...merged.values()].sort((a, b) =>
      (query.order === 'asc' ? 1 : -1) * a.syncedAt.localeCompare(b.syncedAt));
    const limit = query.limit ?? (ordered.length || 25);
    return { total: ordered.length, offset: 0, limit, items: ordered.slice(0, limit) };
  }
}
