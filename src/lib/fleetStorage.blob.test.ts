import { describe, expect, it } from 'vitest';
import { getFleetStorage, toStrongEtag } from './fleetStorage';
import { mutateFleetDatabase, readFleetDatabase } from './fleetDatabase';

describe('toStrongEtag', () => {
  it('strips the weak prefix Blob adds to compressed responses', () => {
    expect(toStrongEtag('W/"9863d5ff"')).toBe('"9863d5ff"');
  });

  it('leaves strong ETags unchanged', () => {
    expect(toStrongEtag('"9863d5ff"')).toBe('"9863d5ff"');
  });
});

// Real Vercel Blob round trip. Opt-in and for a dev-only test store: it overwrites
// fleetguard30/fleet-db.json in whatever store BLOB_READ_WRITE_TOKEN points at.
const runAgainstBlob = process.env.FLEET_BLOB_INTEGRATION === '1' && Boolean(process.env.BLOB_READ_WRITE_TOKEN);

describe.skipIf(!runAgainstBlob)('fleet database on real Vercel Blob', () => {
  const stamp = (tag: string) => ({ id: tag, time: '00:00:00', target: 'MANAGER' as const, message: tag, level: 'INFO' as const });

  it('commits sequential writes on a compressed (weak ETag) document', async () => {
    const before = await readFleetDatabase();
    for (let i = 0; i < 3; i += 1) {
      await mutateFleetDatabase((db) => ({ db: { ...db, pushStream: [stamp(`seq-${Date.now()}-${i}`), ...db.pushStream] }, result: i }));
    }
    expect((await readFleetDatabase()).revision).toBe(before.revision + 3);
  }, 60_000);

  it('keeps every concurrent write', async () => {
    const before = await readFleetDatabase();
    const tags = Array.from({ length: 4 }, (_, i) => `par-${Date.now()}-${i}`);
    await Promise.all(
      tags.map((tag) => mutateFleetDatabase((db) => ({ db: { ...db, pushStream: [stamp(tag), ...db.pushStream] }, result: tag })))
    );
    const after = await readFleetDatabase();
    expect(after.revision).toBe(before.revision + tags.length);
    for (const tag of tags) expect(after.pushStream.some((p) => p.id === tag)).toBe(true);
  }, 120_000);

  it('answers NOT_MODIFIED to the normalized ETag', async () => {
    const storage = getFleetStorage();
    const doc = await storage.load();
    expect(doc && doc !== 'NOT_MODIFIED').toBeTruthy();
    if (!doc || doc === 'NOT_MODIFIED') return;
    expect(doc.json.length).toBeGreaterThan(10_000);
    expect(await storage.load({ ifNoneMatch: doc.etag })).toBe('NOT_MODIFIED');
  }, 30_000);
});
