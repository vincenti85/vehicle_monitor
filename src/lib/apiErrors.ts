// Maps server-side failures to HTTP responses shared by the fleet API routes.
import { NextResponse } from 'next/server';
import { AdminPinNotConfiguredError } from './adminAuth';
import { FleetStorageUnavailableError, LiveDataProtectedError } from './fleetDatabase';

export function fleetErrorResponse(err: unknown) {
  if (err instanceof FleetStorageUnavailableError) {
    console.error('Fleet storage unavailable:', err.cause ?? err);
    return NextResponse.json(
      { ok: false, message: '서버 저장소에 일시적으로 연결할 수 없습니다. 아무것도 저장되지 않았습니다. 잠시 후 다시 시도하세요.', error: err.message },
      { status: 503 }
    );
  }
  if (err instanceof LiveDataProtectedError) {
    return NextResponse.json({ ok: false, message: err.message, error: err.message }, { status: 409 });
  }
  if (err instanceof AdminPinNotConfiguredError) {
    return NextResponse.json({ ok: false, message: '서버에 관리자 PIN이 설정되지 않았습니다.', error: err.message }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : 'Request failed';
  return NextResponse.json({ ok: false, message, error: message }, { status: 400 });
}
