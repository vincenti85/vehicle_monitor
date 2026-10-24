import { NextRequest, NextResponse } from 'next/server';
import {
  readFleetDatabase,
  resetFleetDatabase,
  writeFleetDatabase,
} from '@/lib/fleetDatabase';
import { FleetStateRequestSchema } from '@/lib/fleetSchemas';
import { AdminPinNotConfiguredError, isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/fleet/state — Fetch complete persistent fleet state from backend DB
export async function GET() {
  const db = readFleetDatabase();
  return NextResponse.json({
    ok: true,
    data: db,
  });
}

// POST /api/fleet/state — Persist validated partial fleet state updates to backend DB.
// RESET_SEED and policyConfig changes are admin-only (x-admin-pin header).
export async function POST(req: NextRequest) {
  try {
    const parsed = FleetStateRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid fleet state payload', issues: parsed.error.issues.slice(0, 10) },
        { status: 400 }
      );
    }
    const body = parsed.data;
    // Clients echo the whole state back; only an actual policy change needs the admin PIN.
    const policyChanged =
      body.patch?.policyConfig !== undefined &&
      JSON.stringify(body.patch.policyConfig) !==
        JSON.stringify(readFleetDatabase().policyConfig);
    const needsAdmin = body.action === 'RESET_SEED' || policyChanged;

    if (needsAdmin && !isAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Admin PIN required for this operation' },
        { status: 401 }
      );
    }

    if (body.action === 'RESET_SEED') {
      const resetDb = resetFleetDatabase();
      return NextResponse.json({
        ok: true,
        message: 'Backend database reset to Opelika AL initial seed state.',
        data: resetDb,
      });
    }

    const updatedDb = writeFleetDatabase(body.patch || {});
    return NextResponse.json({
      ok: true,
      lastUpdatedAt: updatedDb.lastUpdatedAt,
      data: updatedDb,
    });
  } catch (err) {
    if (err instanceof AdminPinNotConfiguredError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Write failed' },
      { status: 400 }
    );
  }
}
