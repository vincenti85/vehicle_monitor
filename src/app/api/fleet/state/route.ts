import { NextRequest, NextResponse } from 'next/server';
import {
  FleetStorageUnavailableError,
  LiveDataProtectedError,
  clearDemoData,
  getStorageBackendName,
  readFleetDatabase,
  resetFleetDatabase,
  writeFleetDatabase,
} from '@/lib/fleetDatabase';
import { FleetStateRequestSchema } from '@/lib/fleetSchemas';
import { AdminPinNotConfiguredError, isAdminRequest } from '@/lib/adminAuth';
import { enforceVehicleMaster } from '@/lib/vehicleMaster';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';

export const dynamic = 'force-dynamic';

// Treats a server without FLEET_ADMIN_PIN as "no admin" instead of failing every save
function isAdminRequestSafe(req: NextRequest): boolean {
  try {
    return isAdminRequest(req);
  } catch (err) {
    if (err instanceof AdminPinNotConfiguredError) return false;
    throw err;
  }
}

function errorResponse(err: unknown) {
  if (err instanceof FleetStorageUnavailableError) {
    console.error('Fleet storage unavailable:', err.cause ?? err);
    return NextResponse.json(
      { ok: false, error: 'Fleet database is temporarily unavailable. Nothing was saved.' },
      { status: 503 }
    );
  }
  if (err instanceof LiveDataProtectedError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
  }
  if (err instanceof AdminPinNotConfiguredError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
  }
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : 'Request failed' },
    { status: 400 }
  );
}

// GET /api/fleet/state — Fetch complete persistent fleet state from backend DB
export async function GET() {
  try {
    const db = await readFleetDatabase();
    return NextResponse.json({ ok: true, storage: getStorageBackendName(), data: db });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/fleet/state — Persist validated partial fleet state updates to backend DB.
// RESET_SEED, CLEAR_DEMO and policyConfig changes are admin-only (x-admin-pin header).
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
        JSON.stringify((await readFleetDatabase()).policyConfig);
    const needsAdmin =
      body.action === 'RESET_SEED' || body.action === 'CLEAR_DEMO' || policyChanged;

    if (needsAdmin && !isAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Admin PIN required for this operation' },
        { status: 401 }
      );
    }

    if (body.action === 'RESET_SEED') {
      const resetDb = await resetFleetDatabase();
      return NextResponse.json({
        ok: true,
        message: 'Backend database reset to Opelika AL initial seed state.',
        data: resetDb,
      });
    }

    if (body.action === 'CLEAR_DEMO') {
      const result = await clearDemoData(body.removeDemoEmployees ?? true);
      return NextResponse.json({
        ok: true,
        message: 'Demo history cleared. The database is now in LIVE mode.',
        removedDemoEmployees: result.removedDemoEmployees,
        keptDemoEmployeesBecauseNoRealOnes: result.keptDemoEmployeesBecauseNoRealOnes,
        data: result.db,
      });
    }

    // Vehicle master data (plate, model, pairing IDs, lock, fleet list) is admin-only.
    // Non-admin patches keep syncing operational fields; master changes are ignored.
    const patch = { ...(body.patch || {}) } as Partial<FleetDatabaseSchema>;
    let vehicleMasterProtected = false;
    if (patch.vehicles && !isAdminRequestSafe(req)) {
      const stored = await readFleetDatabase();
      const guarded = enforceVehicleMaster(patch.vehicles, stored.vehicles);
      patch.vehicles = guarded.vehicles;
      vehicleMasterProtected = guarded.overridden;
    }

    const updatedDb = await writeFleetDatabase(patch);
    return NextResponse.json({
      ok: true,
      lastUpdatedAt: updatedDb.lastUpdatedAt,
      vehicleMasterProtected,
      data: updatedDb,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
