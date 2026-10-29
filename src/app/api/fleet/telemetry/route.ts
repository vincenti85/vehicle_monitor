import { NextRequest, NextResponse } from 'next/server';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { DRIVER_TOKEN_HEADER, resolveDriverId } from '@/lib/driverToken';
import { mutateFleetDatabase, readFleetDatabaseCached } from '@/lib/fleetDatabase';
import { TelemetryPayloadSchema } from '@/lib/fleetSchemas';
import { UnknownEmployeeError, applyTelemetry } from '@/domain/telemetry';

export const dynamic = 'force-dynamic';

// POST /api/fleet/telemetry — evaluate a phone sensor packet; persist it when persistToDb is set.
// In LIVE mode the packet must come from the employee's enrolled phone (x-driver-token).
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
    if (!known.employees.some((e) => e.id === body.employeeId)) {
      return NextResponse.json({ accepted: false, error: `Unknown employeeId: ${body.employeeId}` }, { status: 404 });
    }
    if (known.dataMode === 'LIVE' && resolveDriverId(known, req.headers.get(DRIVER_TOKEN_HEADER)) !== body.employeeId) {
      return NextResponse.json(
        { accepted: false, error: 'This phone is not enrolled for that employee. Ask an admin for a device link.' },
        { status: 401 }
      );
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
    if (err instanceof UnknownEmployeeError) {
      return NextResponse.json({ accepted: false, error: err.message }, { status: 404 });
    }
    return fleetErrorResponse(err);
  }
}
