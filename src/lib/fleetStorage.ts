// Storage backends for the single-document fleet JSON database.
// - VERCEL_BLOB: durable private blob (production on Vercel; needs BLOB_READ_WRITE_TOKEN)
// - LOCAL_FILE: data/fleet-db.json on disk (local dev / on-prem server)
// - EPHEMERAL_TMP: os.tmpdir() on Vercel without a Blob store (data resets per instance)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { get, put } from '@vercel/blob';

export type StorageBackendName = 'VERCEL_BLOB' | 'LOCAL_FILE' | 'EPHEMERAL_TMP';

export interface FleetStorageBackend {
  name: StorageBackendName;
  /** Returns the stored JSON text, or null when no database has been created yet. */
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
}

/** Thrown when the store exists but cannot be read; callers must not fall back to seed data. */
export class FleetStorageUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FleetStorageUnavailableError';
  }
}

const BLOB_PATHNAME = 'fleetguard30/fleet-db.json';
const DB_FILE_NAME = 'fleet-db.json';

function createBlobBackend(): FleetStorageBackend {
  return {
    name: 'VERCEL_BLOB',
    async load() {
      try {
        const result = await get(BLOB_PATHNAME, { access: 'private', useCache: false });
        if (!result) return null;
        if (result.statusCode !== 200) {
          throw new Error(`Unexpected blob status ${result.statusCode}`);
        }
        return await new Response(result.stream).text();
      } catch (err) {
        throw new FleetStorageUnavailableError('Vercel Blob read failed', { cause: err });
      }
    },
    async save(json) {
      try {
        await put(BLOB_PATHNAME, json, {
          access: 'private',
          allowOverwrite: true,
          addRandomSuffix: false,
          contentType: 'application/json',
          cacheControlMaxAge: 60,
        });
      } catch (err) {
        throw new FleetStorageUnavailableError('Vercel Blob write failed', { cause: err });
      }
    },
  };
}

function createFileBackend(dir: string, name: StorageBackendName): FleetStorageBackend {
  const filePath = path.join(dir, DB_FILE_NAME);
  return {
    name,
    async load() {
      try {
        return await fs.promises.readFile(filePath, 'utf-8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw new FleetStorageUnavailableError(`Cannot read ${filePath}`, { cause: err });
      }
    },
    async save(json) {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        // Write-then-rename so a crash mid-write never leaves a truncated database
        const tmpPath = `${filePath}.${process.pid}.tmp`;
        await fs.promises.writeFile(tmpPath, json, 'utf-8');
        await fs.promises.rename(tmpPath, filePath);
      } catch (err) {
        throw new FleetStorageUnavailableError(`Cannot write ${filePath}`, { cause: err });
      }
    },
  };
}

export function getFleetStorage(): FleetStorageBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    return createBlobBackend();
  }
  if (process.env.VERCEL) {
    return createFileBackend(os.tmpdir(), 'EPHEMERAL_TMP');
  }
  return createFileBackend(path.join(process.cwd(), 'data'), 'LOCAL_FILE');
}
