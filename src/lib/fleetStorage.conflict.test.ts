import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Blob answers two different ways when another write wins the race: 412 (ETag mismatch)
// and 409 (a conflicting operation still in flight). Both must be retried, not reported
// as an outage.
vi.mock('@vercel/blob', async () => {
  const actual = await vi.importActual<typeof import('@vercel/blob')>('@vercel/blob');
  return { ...actual, put: vi.fn() };
});

import { BlobError, BlobPreconditionFailedError, put } from '@vercel/blob';
import { FleetStorageConflictError, FleetStorageUnavailableError, getFleetStorage } from './fleetStorage';

describe('Blob backend save conflicts', () => {
  beforeEach(() => {
    process.env.BLOB_STORE_ID = 'store_test';
  });
  afterEach(() => {
    delete process.env.BLOB_STORE_ID;
    vi.mocked(put).mockReset();
  });

  it('treats an ETag mismatch (412) as a conflict', async () => {
    vi.mocked(put).mockRejectedValue(new BlobPreconditionFailedError());
    await expect(getFleetStorage().save('{}', { ifMatch: '"a"' })).rejects.toBeInstanceOf(FleetStorageConflictError);
  });

  it('treats a concurrent conflicting operation (409) as a conflict', async () => {
    vi.mocked(put).mockRejectedValue(
      new BlobError('The conditional request cannot succeed due to a conflicting operation against this resource.')
    );
    await expect(getFleetStorage().save('{}', { ifMatch: '"a"' })).rejects.toBeInstanceOf(FleetStorageConflictError);
  });

  it('still reports other write failures as unavailable', async () => {
    vi.mocked(put).mockRejectedValue(new BlobError('Bad request'));
    await expect(getFleetStorage().save('{}', { ifMatch: '"a"' })).rejects.toBeInstanceOf(FleetStorageUnavailableError);
  });
});
