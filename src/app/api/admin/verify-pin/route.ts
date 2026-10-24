import { NextRequest, NextResponse } from 'next/server';
import { AdminPinNotConfiguredError, verifyAdminPin } from '@/lib/adminAuth';
import { AdminPinRequestSchema } from '@/lib/fleetSchemas';

export const dynamic = 'force-dynamic';

// POST /api/admin/verify-pin — Server-side check of the Admin Console security PIN
export async function POST(req: NextRequest) {
  try {
    const parsed = AdminPinRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'PIN must be 4 digits' }, { status: 400 });
    }
    if (!verifyAdminPin(parsed.data.pin)) {
      return NextResponse.json({ ok: false, error: 'Invalid PIN' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminPinNotConfiguredError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
}
