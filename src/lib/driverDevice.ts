'use client';

// This phone's driver identity: the token from the admin's device link, kept in localStorage
// and sent as x-driver-token with every driver action and telemetry packet.
const STORAGE_KEY = 'fleetguard.driverToken';
export const ENROLL_QUERY_PARAM = 'enroll';

export function getDriverToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Employee this phone is enrolled as (the token starts with "<employeeId>."). */
export function getEnrolledEmployeeId(): string | null {
  const token = getDriverToken();
  const dot = token?.lastIndexOf('.') ?? -1;
  return token && dot > 0 ? token.slice(0, dot) : null;
}

export function driverHeaders(): Record<string, string> {
  const token = getDriverToken();
  return token ? { 'x-driver-token': token } : {};
}

/** Saves a token from ?enroll=… and removes it from the address bar. Returns the employee id. */
export function captureEnrollmentFromUrl(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(ENROLL_QUERY_PARAM);
  if (!token || token.lastIndexOf('.') <= 0) return null;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    return null;
  }
  url.searchParams.delete(ENROLL_QUERY_PARAM);
  window.history.replaceState(null, '', url.toString());
  return getEnrolledEmployeeId();
}

export function enrollmentLink(token: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set(ENROLL_QUERY_PARAM, token);
  return url.toString();
}
