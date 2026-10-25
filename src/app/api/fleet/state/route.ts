import { NextRequest, NextResponse } from 'next/server';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { getStorageBackendName, readFleetDatabaseCached } from '@/lib/fleetDatabase';

export const dynamic = 'force-dynamic';

// GET /api/fleet/state[?rev=N] — full fleet state; 204 when the client already has revision N.
// Polled every 15 s by visible screens, so reads go through a short per-instance cache.
export async function GET(req: NextRequest) {
  try {
    const db = await readFleetDatabaseCached();
    const rev = req.nextUrl.searchParams.get('rev');
    if (rev !== null && Number(rev) === db.revision) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ ok: true, storage: getStorageBackendName(), revision: db.revision, data: db });
  } catch (err) {
    return fleetErrorResponse(err);
  }
}

// Whole-state writes are retired: they let a stale device overwrite everyone else's work.
export async function POST() {
  return NextResponse.json(
    { ok: false, message: 'This endpoint no longer accepts writes. Use POST /api/fleet/actions.' },
    { status: 410 }
  );
}
