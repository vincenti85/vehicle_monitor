import { NextRequest, NextResponse } from 'next/server';
import { AdminPinNotConfiguredError } from '@/lib/adminAuth';
import { checkAdminHeader } from '@/lib/adminPinGuard';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { toClientView } from '@/lib/clientView';
import { getStorageBackendName, readFleetDatabaseCached } from '@/lib/fleetDatabase';

export const dynamic = 'force-dynamic';

// GET /api/fleet/state[?rev=N] — full fleet state; 204 when the client already has revision N.
// Polled every 15 s by visible screens, so reads go through a short per-instance cache.
// Employee phone numbers are included only for a request with a valid x-admin-pin header.
export async function GET(req: NextRequest) {
  try {
    const db = await readFleetDatabaseCached();
    const rev = req.nextUrl.searchParams.get('rev');
    if (rev !== null && Number(rev) === db.revision) {
      return new NextResponse(null, { status: 204 });
    }
    const isAdmin = await isVerifiedAdmin(req);
    return NextResponse.json({
      ok: true,
      storage: getStorageBackendName(),
      revision: db.revision,
      data: toClientView(db, { isAdmin }),
    });
  } catch (err) {
    return fleetErrorResponse(err);
  }
}

async function isVerifiedAdmin(req: NextRequest): Promise<boolean> {
  try {
    return (await checkAdminHeader(req))?.status === 'OK';
  } catch (err) {
    if (err instanceof AdminPinNotConfiguredError) return false;
    throw err;
  }
}

// Whole-state writes are retired: they let a stale device overwrite everyone else's work.
export async function POST() {
  return NextResponse.json(
    { ok: false, message: 'This endpoint no longer accepts writes. Use POST /api/fleet/actions.' },
    { status: 410 }
  );
}
