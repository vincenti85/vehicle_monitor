// Server-side admin PIN gate. The PIN lives only in FLEET_ADMIN_PIN (never in the bundle).
import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

export const ADMIN_PIN_HEADER = 'x-admin-pin';

export class AdminPinNotConfiguredError extends Error {
  constructor() {
    super('FLEET_ADMIN_PIN is not configured on the server');
  }
}

function getConfiguredPin(): string {
  const pin = process.env.FLEET_ADMIN_PIN;
  if (!pin) {
    throw new AdminPinNotConfiguredError();
  }
  return pin;
}

export function verifyAdminPin(candidate: string | null | undefined): boolean {
  const expected = getConfiguredPin();
  if (!candidate || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

export function isAdminRequest(req: NextRequest): boolean {
  return verifyAdminPin(req.headers.get(ADMIN_PIN_HEADER));
}

/** Like isAdminRequest, but a server without FLEET_ADMIN_PIN simply has no admins. */
export function isAdminRequestSafe(req: NextRequest): boolean {
  try {
    return isAdminRequest(req);
  } catch (err) {
    if (err instanceof AdminPinNotConfiguredError) return false;
    throw err;
  }
}
