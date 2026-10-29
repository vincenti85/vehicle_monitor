import { NextRequest, NextResponse } from 'next/server';
import { AdminPinNotConfiguredError } from '@/lib/adminAuth';
import { checkAdminPin, pinLockedResponse } from '@/lib/adminPinGuard';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { AdminPinRequestSchema } from '@/lib/fleetSchemas';

export const dynamic = 'force-dynamic';

// POST /api/admin/verify-pin — Server-side check of the Admin Console security PIN.
// Wrong PINs are counted per client IP; too many lock that IP out for a while.
export async function POST(req: NextRequest) {
  const parsed = AdminPinRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'PIN must be 4-12 digits' }, { status: 400 });
  }
  try {
    const check = await checkAdminPin(req, parsed.data.pin);
    if (check.status === 'LOCKED') return pinLockedResponse(check.retryAfterSec);
    if (check.status === 'INVALID') {
      return NextResponse.json({ ok: false, error: 'Invalid PIN', attemptsLeft: check.attemptsLeft }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminPinNotConfiguredError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    return fleetErrorResponse(err);
  }
}
