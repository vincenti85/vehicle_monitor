import { NextRequest, NextResponse } from 'next/server';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { mutateFleetDatabase, readFleetDatabaseCached } from '@/lib/fleetDatabase';
import { TelemetryPayloadSchema } from '@/lib/fleetSchemas';
import { applyTelemetry } from '@/domain/telemetry';

export const dynamic = 'force-dynamic';

// POST /api/fleet/telemetry — evaluate a phone sensor packet; persist it when persistToDb is set.
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ accepted: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = TelemetryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { accepted: false, error: 'Invalid telemetry payload', issues: parsed.error.issues.slice(0, 10) },
      { status: 400 }
    );
  }
  const body = parsed.data;

  try {
    const known = await readFleetDatabaseCached();
    if (!known.vehicles.some((v) => v.id === body.vehicleId)) {
      return NextResponse.json({ accepted: false, error: `Unknown vehicleId: ${body.vehicleId}` }, { status: 404 });
    }
    const now = new Date();
    const { result } = await mutateFleetDatabase((db) => applyTelemetry(db, body, { now, isAdmin: false }));
    return NextResponse.json({
      accepted: true,
      evaluatedAt: now.toISOString(),
      ...result,
      alertAction: result.isUnauthorizedDriving
        ? 'TRIGGER_BILATERAL_RED_ALERT'
        : result.incidentVerdict === 'CONFIRMED_CRASH'
          ? 'TRIGGER_EMERGENCY_IMU_RECONSTRUCTION'
          : 'NORMAL_TELEMETRY_LOGGED',
    });
  } catch (err) {
    return fleetErrorResponse(err);
  }
}
