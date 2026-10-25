// Storage backends for the single-document fleet JSON database.
// - VERCEL_BLOB: durable private blob (production on Vercel; needs BLOB_READ_WRITE_TOKEN)
// - LOCAL_FILE: data/fleet-db.json on disk (local dev / on-prem server)
// - EPHEMERAL_TMP: os.tmpdir() on Vercel without a Blob store (data resets per instance)
//
// Every write is compare-and-swap: save() only succeeds when the stored ETag still matches
// the one that was read, so two devices can never overwrite each other's changes.
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BlobPreconditionFailedError, get, put } from '@vercel/blob';

export type StorageBackendName = 'VERCEL_BLOB' | 'LOCAL_FILE' | 'EPHEMERAL_TMP';

export interface StoredDocument {
  json: string;
  etag: string;
}

export interface FleetStorageBackend {
  name: StorageBackendName;
  /** Returns the document, null when it does not exist yet, or NOT_MODIFIED for a matching ifNoneMatch. */
  load(options?: { ifNoneMatch?: string }): Promise<StoredDocument | null | 'NOT_MODIFIED'>;
  /** Writes only if the stored ETag equals ifMatch (null = create only). Returns the new ETag. */
  save(json: string, options: { ifMatch: string | null }): Promise<string>;
  /** Optional in-process serialization (single-server backends) to avoid needless retries. */
  exclusive?<T>(fn: () => Promise<T>): Promise<T>;
}

/** Thrown when the store exists but cannot be read; callers must not fall back to seed data. */
export class FleetStorageUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FleetStorageUnavailableError';
  }
}

/** Thrown when another writer changed the document since it was read. */
export class FleetStorageConflictError extends Error {
  constructor() {
    super('Fleet database changed concurrently');
    this.name = 'FleetStorageConflictError';
  }
}

const BLOB_PATHNAME = 'fleetguard30/fleet-db.json';
const DB_FILE_NAME = 'fleet-db.json';

function createBlobBackend(): FleetStorageBackend {
  return {
    name: 'VERCEL_BLOB',
    async load(options) {
      try {
        const result = await get(BLOB_PATHNAME, {
          access: 'private',
          useCache: false,
          ...(options?.ifNoneMatch ? { ifNoneMatch: options.ifNoneMatch } : {}),
        });
        if (!result) return null;
        if (result.statusCode === 304) return 'NOT_MODIFIED';
        return { json: await new Response(result.stream).text(), etag: result.blob.etag };
      } catch (err) {
        throw new FleetStorageUnavailableError('Vercel Blob read failed', { cause: err });
      }
    },
    async save(json, { ifMatch }) {
      try {
        const result = await put(BLOB_PATHNAME, json, {
          access: 'private',
          addRandomSuffix: false,
          contentType: 'application/json',
          cacheControlMaxAge: 60,
          ...(ifMatch ? { ifMatch } : { allowOverwrite: false }),
        });
        return result.etag;
      } catch (err) {
        // ETag mismatch, or another instance created the document first
        if (err instanceof BlobPreconditionFailedError || ifMatch === null) {
          throw new FleetStorageConflictError();
        }
        throw new FleetStorageUnavailableError('Vercel Blob write failed', { cause: err });
      }
    },
  };
}

const fileLocks = new Map<string, Promise<unknown>>();

/** Runs fn after every earlier call for the same key has settled (per-process mutex). */
function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  fileLocks.set(key, run.catch(() => undefined));
  return run;
}

const hashOf = (text: string) => crypto.createHash('sha1').update(text).digest('hex');

export function createFileBackend(dir: string, name: StorageBackendName): FleetStorageBackend {
  const filePath = path.join(dir, DB_FILE_NAME);

  const readRaw = async (): Promise<string | null> => {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new FleetStorageUnavailableError(`Cannot read ${filePath}`, { cause: err });
    }
  };

  return {
    name,
    async load(options) {
      const raw = await readRaw();
      if (raw === null) return null;
      const etag = hashOf(raw);
      if (options?.ifNoneMatch === etag) return 'NOT_MODIFIED';
      return { json: raw, etag };
    },
    async save(json, { ifMatch }) {
      const current = await readRaw();
      if ((current === null ? null : hashOf(current)) !== ifMatch) {
        throw new FleetStorageConflictError();
      }
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        // Write-then-rename so a crash mid-write never leaves a truncated database
        const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await fs.promises.writeFile(tmpPath, json, 'utf-8');
        await fs.promises.rename(tmpPath, filePath);
      } catch (err) {
        throw new FleetStorageUnavailableError(`Cannot write ${filePath}`, { cause: err });
      }
      return hashOf(json);
    },
    exclusive(fn) {
      return withFileLock(filePath, fn);
    },
  };
}

let testOverride: FleetStorageBackend | null = null;

/** Test hook: route all database access to the given backend (null restores the default). */
export function setFleetStorageForTests(backend: FleetStorageBackend | null) {
  testOverride = backend;
}

export function getFleetStorage(): FleetStorageBackend {
  if (testOverride) return testOverride;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    return createBlobBackend();
  }
  if (process.env.VERCEL) {
    return createFileBackend(os.tmpdir(), 'EPHEMERAL_TMP');
  }
  return createFileBackend(path.join(process.cwd(), 'data'), 'LOCAL_FILE');
}
