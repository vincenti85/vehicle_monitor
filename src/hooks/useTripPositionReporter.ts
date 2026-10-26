'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionRequest } from '@/lib/actionSchemas';
import { TRIP_FIX_INTERVAL_MINUTES } from '@/domain/trip';
import { VehicleReservation } from '@/types/fleet';
import { DispatchResult } from '@/utils/dispatchRules';

const STORAGE_KEY = 'fg30.tripTracking';
const INTERVAL_MS = TRIP_FIX_INTERVAL_MINUTES * 60_000;

interface TrackingTarget {
  vehicleId: string;
  employeeId: string;
  /** Known once the started trip appears as IN_USE in synced state */
  reservationId?: string;
}

export interface TripReporterStatus {
  lastSentAt: number | null;
  lastMessage: string | null;
  error: string | null;
  wakeLock: boolean;
}

// The device that started a trip remembers it, so a reload or screen-off keeps reporting
function loadTarget(): TrackingTarget | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof parsed?.vehicleId !== 'string' || typeof parsed?.employeeId !== 'string') return null;
    return {
      vehicleId: parsed.vehicleId,
      employeeId: parsed.employeeId,
      ...(typeof parsed.reservationId === 'string' ? { reservationId: parsed.reservationId } : {}),
    };
  } catch {
    return null;
  }
}

function saveTarget(target: TrackingTarget | null) {
  try {
    if (target) localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): tracking still works until the page reloads
  }
}

function readFix(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 30_000,
    });
  });
}

function fixErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) return '위치 권한이 거부되었습니다. 브라우저 설정에서 이 사이트의 위치 접근을 허용하세요.';
  if (code === 3) return 'GPS 신호를 받지 못했습니다. 다음 주기에 다시 시도합니다.';
  if ((err as Error | undefined)?.message === 'UNSUPPORTED') return '이 브라우저는 위치 기능을 지원하지 않습니다.';
  return '현재 위치를 확인할 수 없습니다.';
}

/**
 * Pins the target to its trip once it is IN_USE, and releases the device when that trip
 * has ended anywhere (e.g. returned from the admin PC). Returns the same object if unchanged.
 */
export function reconcileTrackingTarget(
  target: TrackingTarget | null,
  reservations: VehicleReservation[]
): TrackingTarget | null {
  if (!target) return null;
  const active = reservations.find(
    (r) => r.stage === 'IN_USE' && r.vehicleId === target.vehicleId && r.employeeId === target.employeeId
  );
  if (active) return target.reservationId === active.id ? target : { ...target, reservationId: active.id };
  // Just started: the trip has not reached this device's synced state yet
  if (!target.reservationId) return target;
  const known = reservations.find((r) => r.id === target.reservationId);
  return known && known.stage !== 'IN_USE' ? null : target;
}

const finiteOrNull = (n: number | null) => (n === null || Number.isNaN(n) ? null : n);

/**
 * Sends the driver's phone position for the trip this device started: once right away,
 * then every TRIP_FIX_INTERVAL_MINUTES while the page is open, keeping the screen awake.
 */
export function useTripPositionReporter(
  reservations: VehicleReservation[],
  runAction: (action: ActionRequest) => Promise<DispatchResult>
) {
  const [target, setTarget] = useState<TrackingTarget | null>(null);
  const [status, setStatus] = useState<TripReporterStatus>({ lastSentAt: null, lastMessage: null, error: null, wakeLock: false });
  const lastSentRef = useRef<number | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => setTarget(loadTarget()), []);

  const active = target
    ? reservations.find((r) => r.stage === 'IN_USE' && r.vehicleId === target.vehicleId && r.employeeId === target.employeeId)
    : undefined;
  const activeRef = useRef(active);
  activeRef.current = active;
  const activeId = active?.id ?? null;

  useEffect(() => {
    const next = reconcileTrackingTarget(target, reservations);
    if (next === target) return;
    saveTarget(next);
    setTarget(next);
    if (!next) {
      lastSentRef.current = null;
      setStatus({ lastSentAt: null, lastMessage: null, error: null, wakeLock: false });
    }
  }, [target, reservations]);

  const sendNow = useCallback(async () => {
    const res = activeRef.current;
    if (!res || sendingRef.current) return;
    sendingRef.current = true;
    try {
      const { latitude, longitude, speed, heading, accuracy } = (await readFix()).coords;
      const metersPerSec = finiteOrNull(speed);
      const result = await runAction({
        type: 'trip.position',
        payload: {
          reservationId: res.id,
          employeeId: res.employeeId,
          lat: latitude,
          lng: longitude,
          speedKmh: metersPerSec === null ? null : Math.min(400, Math.round(metersPerSec * 36) / 10),
          headingDeg: finiteOrNull(heading),
          accuracyM: accuracy,
        },
      });
      lastSentRef.current = Date.now();
      setStatus((s) => ({ ...s, lastSentAt: Date.now(), lastMessage: result.message, error: result.ok ? null : result.message }));
    } catch (err) {
      setStatus((s) => ({ ...s, error: fixErrorMessage(err) }));
    } finally {
      sendingRef.current = false;
    }
  }, [runAction]);

  useEffect(() => {
    if (!activeId) return;
    let lock: WakeLockSentinel | null = null;
    const acquireWakeLock = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
        lock?.addEventListener('release', () => setStatus((s) => ({ ...s, wakeLock: false })));
        setStatus((s) => ({ ...s, wakeLock: Boolean(lock) }));
      } catch {
        setStatus((s) => ({ ...s, wakeLock: false }));
      }
    };
    // Browsers pause timers in the background: catch up as soon as the page is visible again
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void acquireWakeLock();
      if (!lastSentRef.current || Date.now() - lastSentRef.current >= INTERVAL_MS) void sendNow();
    };

    void acquireWakeLock();
    void sendNow();
    const timer = setInterval(() => void sendNow(), INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [activeId, sendNow]);

  const startTracking = useCallback((vehicleId: string, employeeId: string) => {
    const next = { vehicleId, employeeId };
    saveTarget(next);
    setTarget(next);
  }, []);

  const stopTracking = useCallback(() => {
    saveTarget(null);
    setTarget(null);
    lastSentRef.current = null;
    setStatus({ lastSentAt: null, lastMessage: null, error: null, wakeLock: false });
  }, []);

  return { reservationId: activeId, target, ...status, sendNow, startTracking, stopTracking };
}

export type TripReporter = ReturnType<typeof useTripPositionReporter>;
