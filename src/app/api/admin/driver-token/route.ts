import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdminHeader, pinLockedResponse } from '@/lib/adminPinGuard';
import { fleetErrorResponse } from '@/lib/apiErrors';
import { toClientView } from '@/lib/clientView';
import { createDriverToken } from '@/lib/driverToken';
import { mutateFleetDatabase } from '@/lib/fleetDatabase';
import { issueDriverToken } from '@/domain/admin';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ employeeId: z.string().min(1).max(100) }).strict();

// POST /api/admin/driver-token — admin issues a device link for one employee's phone.
// The token is returned once; only its hash is stored, and the previous phone is revoked.
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: '요청 값이 올바르지 않습니다.' }, { status: 400 });
  }
  try {
    const admin = await checkAdminHeader(req);
    if (admin?.status === 'LOCKED') return pinLockedResponse(admin.retryAfterSec);
    if (admin?.status !== 'OK') {
      return NextResponse.json({ ok: false, message: '관리자만 기기 등록 링크를 발급할 수 있습니다.' }, { status: 401 });
    }
    const { token, hash } = createDriverToken(parsed.data.employeeId);
    const now = new Date();
    const { db, result } = await mutateFleetDatabase((current) =>
      issueDriverToken(current, { employeeId: parsed.data.employeeId, tokenHash: hash }, { now, isAdmin: true })
    );
    return NextResponse.json(
      { ok: result.ok, message: result.message, ...(result.ok ? { token } : {}), revision: db.revision, data: toClientView(db, { isAdmin: true }) },
      { status: result.ok ? 200 : 404 }
    );
  } catch (err) {
    return fleetErrorResponse(err);
  }
}
