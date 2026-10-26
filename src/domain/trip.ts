// Trip GPS: the driver's phone reports its position while a trip is IN_USE, so the
// dashboard map, speed and GPS distance follow real movement instead of standing still.
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { TripGpsTrack, Vehicle } from '@/types/fleet';
import { calculateHaversineMeters } from '@/utils/realDeviceSensors';
import { ActionContext, ActionOutcome, refuse } from './core';

export interface TripPositionPayload {
  reservationId: string;
  employeeId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  headingDeg: number | null;
  accuracyM: number;
}

/** Phones report every 10 minutes; the dashboard warns after this long without a fix. */
export const TRIP_FIX_INTERVAL_MINUTES = 10;
export const STALE_FIX_MINUTES = 25;
export const MAX_FIX_ACCURACY_M = 100;
const MIN_FIX_GAP_MS = 60_000;
const MAX_PLAUSIBLE_KMH = 250;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function recordTripPosition(db: FleetDatabaseSchema, p: TripPositionPayload, ctx: ActionContext): ActionOutcome {
  const res = db.reservations.find((r) => r.id === p.reservationId);
  if (!res || res.stage !== 'IN_USE') return refuse(db, '운행중인 배차 건에만 위치를 기록할 수 있습니다.');
  if (res.employeeId !== p.employeeId) return refuse(db, '이 운행의 운전자 휴대폰만 위치를 보낼 수 있습니다.');
  if (p.accuracyM > MAX_FIX_ACCURACY_M) {
    return refuse(db, `GPS 정확도가 낮아(±${Math.round(p.accuracyM)}m) 기록하지 않았습니다. 하늘이 보이는 곳에서 다시 시도하세요.`);
  }

  const prev = res.gpsTrack;
  const elapsedMs = prev ? ctx.now.getTime() - Date.parse(prev.lastFixAt) : 0;
  if (prev && elapsedMs < MIN_FIX_GAP_MS) {
    return { db, result: { ok: true, message: '방금 기록된 위치가 있어 건너뛰었습니다.' } };
  }

  const km = prev ? calculateHaversineMeters(prev.lastLat, prev.lastLng, p.lat, p.lng) / 1000 : 0;
  const impliedKmh = prev ? km / (elapsedMs / 3_600_000) : 0;
  if (impliedKmh > MAX_PLAUSIBLE_KMH) {
    return refuse(db, `비정상 위치 이동(${Math.round(impliedKmh)}km/h 상당)이라 기록하지 않았습니다.`);
  }

  const speedKmh = round1(p.speedKmh ?? impliedKmh);
  const fixAt = ctx.now.toISOString();
  const gpsTrack: TripGpsTrack = {
    fixCount: (prev?.fixCount ?? 0) + 1,
    gpsKm: round1((prev?.gpsKm ?? 0) + km),
    maxSpeedKmh: Math.max(prev?.maxSpeedKmh ?? 0, speedKmh),
    lastLat: p.lat,
    lastLng: p.lng,
    lastFixAt: fixAt,
  };
  const reservations = db.reservations.map((r) => (r.id === res.id ? { ...r, gpsTrack } : r));
  const vehicles = db.vehicles.map((v) =>
    v.id === res.vehicleId
      ? {
          ...v,
          lat: p.lat,
          lng: p.lng,
          speedKmh,
          headingDeg: p.headingDeg ?? v.headingDeg,
          cumulativeGpsKm: round1(v.cumulativeGpsKm + km),
          lastFixAt: fixAt,
          lastFixAccuracyM: Math.round(p.accuracyM),
        }
      : v
  );
  return {
    db: { ...db, reservations, vehicles },
    result: { ok: true, message: `#${res.fleetNumber}호차 위치 기록 (GPS 누적 ${gpsTrack.gpsKm} km)` },
  };
}

/** Human summary of a trip's GPS track for the return note. */
export function describeGpsTrack(track: TripGpsTrack | undefined): string {
  if (!track || track.fixCount === 0) return 'GPS 기록 없음 — 계기판 주행거리 확인 필요';
  return `GPS ${track.fixCount}회 · 직선거리 ${track.gpsKm}km · 최고 ${Math.round(track.maxSpeedKmh)}km/h`;
}

export type TripSignalState = 'PARKED' | 'NO_FIX' | 'LIVE' | 'STALE';

/** Freshness of a vehicle's phone GPS while it is out on a trip. */
export function tripSignal(v: Vehicle, nowMs: number): { state: TripSignalState; minutesAgo: number | null } {
  if (v.status === 'IDLE' || !v.tripStartedAt) return { state: 'PARKED', minutesAgo: null };
  if (!v.lastFixAt) return { state: 'NO_FIX', minutesAgo: null };
  const minutesAgo = Math.max(0, Math.floor((nowMs - Date.parse(v.lastFixAt)) / 60_000));
  return { state: minutesAgo >= STALE_FIX_MINUTES ? 'STALE' : 'LIVE', minutesAgo };
}
