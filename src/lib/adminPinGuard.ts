// Brute-force guard for the admin PIN: counts wrong PINs per client IP in a small document
// next to the fleet database (Blob in production), so the count survives serverless restarts
// and is shared by every instance. After MAX_PIN_FAILURES wrong tries the IP is locked out,
// and while locked even the right PIN is not evaluated.
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_PIN_HEADER, verifyAdminPin } from './adminAuth';
import {
  FleetStorageBackend,
  FleetStorageConflictError,
  FleetStorageUnavailableError,
  createDocumentStorage,
} from './fleetStorage';

export const MAX_PIN_FAILURES = 5;
export const PIN_LOCKOUT_MS = 15 * 60_000;
const MAX_WRITE_ATTEMPTS = 5;

interface ThrottleEntry {
  failures: number;
  lastFailureAt: number;
  lockedUntil: number | null;
}
export type PinThrottleState = Record<string, ThrottleEntry>;

export type AdminPinCheck =
  | { status: 'OK' }
  | { status: 'INVALID'; attemptsLeft: number }
  | { status: 'LOCKED'; retryAfterSec: number };

/** Milliseconds this key stays locked (0 when it may try). */
export function lockRemainingMs(state: PinThrottleState, key: string, nowMs: number): number {
  const lockedUntil = state[key]?.lockedUntil ?? null;
  return lockedUntil !== null && lockedUntil > nowMs ? lockedUntil - nowMs : 0;
}

/** Records one wrong PIN; failures older than the lockout window no longer count. */
export function withFailure(state: PinThrottleState, key: string, nowMs: number): PinThrottleState {
  const prev = state[key];
  const recent = prev && nowMs - prev.lastFailureAt < PIN_LOCKOUT_MS ? prev.failures : 0;
  const failures = recent + 1;
  const lockedUntil = failures >= MAX_PIN_FAILURES ? nowMs + PIN_LOCKOUT_MS : null;
  return { ...pruned(state, nowMs), [key]: { failures, lastFailureAt: nowMs, lockedUntil } };
}

/** Drops entries that can no longer lock anyone, so the document stays small. */
function pruned(state: PinThrottleState, nowMs: number): PinThrottleState {
  return Object.fromEntries(
    Object.entries(state).filter(
      ([, e]) => nowMs - e.lastFailureAt < PIN_LOCKOUT_MS || (e.lockedUntil ?? 0) > nowMs
    )
  );
}

const withoutKey = (state: PinThrottleState, key: string): PinThrottleState =>
  Object.fromEntries(Object.entries(state).filter(([k]) => k !== key));

let testOverride: FleetStorageBackend | null = null;

/** Test hook: route the throttle document to the given backend (null restores the default). */
export function setPinThrottleStorageForTests(backend: FleetStorageBackend | null) {
  testOverride = backend;
}

function storage(): FleetStorageBackend {
  return testOverride ?? createDocumentStorage('fleetguard30/pin-throttle.json', 'pin-throttle.json');
}

async function load(backend: FleetStorageBackend): Promise<{ state: PinThrottleState; etag: string | null }> {
  const doc = await backend.load();
  if (doc === null) return { state: {}, etag: null };
  if (doc === 'NOT_MODIFIED') throw new FleetStorageUnavailableError('Unexpected 304 without ifNoneMatch');
  try {
    return { state: JSON.parse(doc.json) as PinThrottleState, etag: doc.etag };
  } catch {
    // A corrupt counter file must not lock admins out forever; start counting again
    return { state: {}, etag: doc.etag };
  }
}

/** Compare-and-swap update of the throttle document; returns the state that was saved. */
async function update(
  backend: FleetStorageBackend,
  fn: (state: PinThrottleState) => PinThrottleState
): Promise<PinThrottleState> {
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    const { state, etag } = await load(backend);
    const next = fn(state);
    try {
      await backend.save(JSON.stringify(next), { ifMatch: etag });
      return next;
    } catch (err) {
      if (!(err instanceof FleetStorageConflictError)) throw err;
    }
  }
  throw new FleetStorageUnavailableError('PIN throttle store is busy; please retry');
}

/** Client IP as seen by Vercel's edge (it overwrites x-forwarded-for, so it is not spoofable there). */
export function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.ip || forwarded || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Checks a PIN candidate with lockout. Throws AdminPinNotConfiguredError when the server
 * has no PIN, and FleetStorageUnavailableError when the counter cannot be read or saved.
 */
export async function checkAdminPin(req: NextRequest, candidate: string): Promise<AdminPinCheck> {
  const backend = storage();
  const run = async (): Promise<AdminPinCheck> => {
    const key = clientKey(req);
    const { state } = await load(backend);
    const nowMs = Date.now();
    const remaining = lockRemainingMs(state, key, nowMs);
    if (remaining > 0) return { status: 'LOCKED', retryAfterSec: Math.ceil(remaining / 1000) };

    if (verifyAdminPin(candidate)) {
      if (state[key]) await update(backend, (s) => withoutKey(s, key));
      return { status: 'OK' };
    }
    const saved = await update(backend, (s) => withFailure(s, key, Date.now()));
    return { status: 'INVALID', attemptsLeft: Math.max(0, MAX_PIN_FAILURES - (saved[key]?.failures ?? 0)) };
  };
  return backend.exclusive ? backend.exclusive(run) : run();
}

/** Admin check for API routes: null when the request carries no PIN header. */
export async function checkAdminHeader(req: NextRequest): Promise<AdminPinCheck | null> {
  const candidate = req.headers.get(ADMIN_PIN_HEADER);
  return candidate === null ? null : checkAdminPin(req, candidate);
}

export function pinLockedResponse(retryAfterSec: number) {
  const minutes = Math.ceil(retryAfterSec / 60);
  return NextResponse.json(
    {
      ok: false,
      message: `PIN을 여러 번 틀려 ${minutes}분 동안 잠겼습니다. 잠시 후 다시 시도하세요.`,
      error: 'Too many wrong PINs',
      retryAfterSec,
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}
