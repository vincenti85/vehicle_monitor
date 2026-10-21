import { NextRequest, NextResponse } from 'next/server';
import {
  FleetDatabaseSchema,
  readFleetDatabase,
  resetFleetDatabase,
  writeFleetDatabase,
} from '@/lib/fleetDatabase';

export const dynamic = 'force-dynamic';

// GET /api/fleet/state — Fetch complete persistent fleet state from backend DB
export async function GET() {
  const db = readFleetDatabase();
  return NextResponse.json({
    ok: true,
    data: db,
  });
}

// POST /api/fleet/state — Persist partial or full fleet state updates to backend DB
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'SYNC_STATE' | 'RESET_SEED';
      patch?: Partial<FleetDatabaseSchema>;
    };

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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Write failed' },
      { status: 400 }
    );
  }
}
