'use client';

import { readFix } from './useTripPositionReporter';

export interface GpsStamp {
  lat: number;
  lng: number;
  accuracyM: number;
}

/**
 * One position for an inspection stamp. Resolves null when permission is denied, there is no
 * fix in time, or the browser has no geolocation: a missing stamp never blocks the checklist.
 */
export async function captureGpsStamp(timeoutMs = 8_000): Promise<GpsStamp | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    });
    const pos = await Promise.race([readFix(), timeout]);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Math.min(pos.coords.accuracy, 100_000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
