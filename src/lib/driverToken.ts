// Driver phone identity: an admin issues a per-employee device link carrying a random token
// "<employeeId>.<secret>". Only its SHA-256 hash is stored on the employee, so a database
// read never reveals a usable token, and issuing a new link revokes the previous phone.
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { FleetDatabaseSchema } from './fleetDatabase';

export const DRIVER_TOKEN_HEADER = 'x-driver-token';

export const hashDriverToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createDriverToken(employeeId: string): { token: string; hash: string } {
  const token = `${employeeId}.${randomBytes(24).toString('base64url')}`;
  return { token, hash: hashDriverToken(token) };
}

/** The employee this token belongs to, or null when it is missing, forged or revoked. */
export function resolveDriverId(db: FleetDatabaseSchema, token: string | null | undefined): string | null {
  if (!token) return null;
  const employeeId = token.slice(0, token.lastIndexOf('.'));
  const stored = db.employees.find((e) => e.id === employeeId)?.deviceTokenHash;
  if (!employeeId || !stored) return null;
  const given = Buffer.from(hashDriverToken(token));
  const expected = Buffer.from(stored);
  return given.length === expected.length && timingSafeEqual(given, expected) ? employeeId : null;
}
