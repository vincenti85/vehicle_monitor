import { NextRequest, NextResponse } from 'next/server';
import { ActionRequestSchema } from '@/lib/actionSchemas';
import { AdminPinNotConfiguredError } from '@/lib/adminAuth';
import { AdminPinCheck, checkAdminHeader, pinLockedResponse } from '@/lib/adminPinGuard';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { toClientView } from '@/lib/clientView';
import { DRIVER_TOKEN_HEADER } from '@/lib/driverToken';
import { mutateFleetDatabase } from '@/lib/fleetDatabase';
import { requiresAdmin, runAction } from '@/domain/actions';

export const dynamic = 'force-dynamic';

// POST /api/fleet/actions — apply one user action to the latest stored state.
// The server evaluates every rule (duplicates, locks, permissions) against fresh data and
// saves with compare-and-swap, so concurrent devices never overwrite each other.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const parsed = ActionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '요청 값이 올바르지 않습니다.', issues: parsed.error.issues.slice(0, 10) },
      { status: 400 }
    );
  }

  const action = parsed.data;
  try {
    let admin: AdminPinCheck | null = null;
    try {
      admin = await checkAdminHeader(req);
    } catch (err) {
      // A server without FLEET_ADMIN_PIN simply has no admins
      if (!(err instanceof AdminPinNotConfiguredError)) throw err;
    }
    if (admin?.status === 'LOCKED') return pinLockedResponse(admin.retryAfterSec);
    const isAdmin = admin?.status === 'OK';
    if (requiresAdmin(action.type) && !isAdmin) {
      return NextResponse.json(
        { ok: false, message: '관리자만 할 수 있는 작업입니다. 상단 [관리자] 메뉴에서 PIN 인증 후 다시 시도하세요.' },
        { status: 401 }
      );
    }

    const now = new Date();
    const driverToken = req.headers.get(DRIVER_TOKEN_HEADER);
    const { db, result } = await mutateFleetDatabase((current) => runAction(current, action, { now, isAdmin, driverToken }));
    return NextResponse.json({ ok: result.ok, message: result.message, revision: db.revision, data: toClientView(db, { isAdmin }) });
  } catch (err) {
    return fleetErrorResponse(err);
  }
}
