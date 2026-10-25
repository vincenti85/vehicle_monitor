import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FleetStorageBackend,
  FleetStorageConflictError,
  StoredDocument,
  createFileBackend,
  setFleetStorageForTests,
} from './fleetStorage';
import { FleetStorageUnavailableError, mutateFleetDatabase, readFleetDatabase } from './fleetDatabase';

const alert = (id: string) => ({ id, time: '00:00:00', target: 'MANAGER' as const, message: id, level: 'INFO' as const });

/** In-memory backend with ETags and random latency, like Blob across serverless instances. */
function createFakeCasBackend(): FleetStorageBackend & { saves: number } {
  let doc: StoredDocument | null = null;
  let version = 0;
  const jitter = () => new Promise((r) => setTimeout(r, Math.random() * 15));
  return {
    name: 'VERCEL_BLOB',
    saves: 0,
    async load() {
      await jitter();
      return doc ? { ...doc } : null;
    },
    async save(json, { ifMatch }) {
      await jitter();
      if ((doc?.etag ?? null) !== ifMatch) throw new FleetStorageConflictError();
      version += 1;
      doc = { json, etag: `etag-${version}` };
      this.saves += 1;
      return doc.etag;
    },
  };
}

describe('fleet database on the local file backend', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetdb-'));
    setFleetStorageForTests(createFileBackend(dir, 'LOCAL_FILE'));
  });
  afterEach(() => {
    setFleetStorageForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('seeds the demo database once with revision 0', async () => {
    const db = await readFleetDatabase();
    expect(db.revision).toBe(0);
    expect(db.dataMode).toBe('DEMO');
    expect(fs.existsSync(path.join(dir, 'fleet-db.json'))).toBe(true);
  });

  it('increments the revision on every write and skips no-op mutations', async () => {
    await readFleetDatabase();
    const first = await mutateFleetDatabase((db) => ({ db: { ...db, pushStream: [alert('a')] }, result: 1 }));
    expect(first.db.revision).toBe(1);
    const noop = await mutateFleetDatabase((db) => ({ db, result: 2 }));
    expect(noop.db.revision).toBe(1);
    expect((await readFleetDatabase()).revision).toBe(1);
  });

  it('keeps every one of 20 concurrent writes (no lost update)', async () => {
    await readFleetDatabase();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        mutateFleetDatabase((db) => ({ db: { ...db, pushStream: [alert(`c${i}`), ...db.pushStream] }, result: i }))
      )
    );
    const db = await readFleetDatabase();
    expect(db.revision).toBe(20);
    for (let i = 0; i < 20; i += 1) expect(db.pushStream.some((p) => p.id === `c${i}`)).toBe(true);
  });

  it('refuses to treat a corrupt file as empty (no silent reseed)', async () => {
    fs.writeFileSync(path.join(dir, 'fleet-db.json'), '{ corrupt');
    await expect(readFleetDatabase()).rejects.toBeInstanceOf(FleetStorageUnavailableError);
    await expect(mutateFleetDatabase((db) => ({ db, result: 0 }))).rejects.toBeInstanceOf(FleetStorageUnavailableError);
    expect(fs.readFileSync(path.join(dir, 'fleet-db.json'), 'utf-8')).toBe('{ corrupt');
  });
});

describe('fleet database on a compare-and-swap backend (Blob semantics)', () => {
  afterEach(() => setFleetStorageForTests(null));

  it('never loses a write that reported success', async () => {
    const backend = createFakeCasBackend();
    setFleetStorageForTests(backend);
    await readFleetDatabase();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        mutateFleetDatabase((db) => ({ db: { ...db, pushStream: [alert(`b${i}`), ...db.pushStream] }, result: i }))
      )
    );
    const succeeded = outcomes.flatMap((o, i) => (o.status === 'fulfilled' ? [i] : []));
    const db = await readFleetDatabase();
    expect(succeeded.length).toBeGreaterThan(0);
    for (const i of succeeded) expect(db.pushStream.some((p) => p.id === `b${i}`)).toBe(true);
    expect(db.revision).toBe(succeeded.length);
    for (const o of outcomes) {
      if (o.status === 'rejected') expect(o.reason).toBeInstanceOf(FleetStorageUnavailableError);
    }
  });
});
