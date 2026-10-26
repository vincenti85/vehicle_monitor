import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { ActionContext } from './core';
import { approveDispatch, requestDispatch, returnVehicle, startDispatch } from './dispatch';
import { STALE_FIX_MINUTES, TripPositionPayload, recordTripPosition, tripSignal } from './trip';

const T0 = new Date('2026-10-25T21:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const ctx = (now: Date = T0, extra: Partial<ActionContext> = {}): ActionContext => ({ now, isAdmin: false, ...extra });

// 0.01° of latitude is ~1.11 km
const HQ = { lat: 32.6912, lng: -85.3298 };

/** veh-8 on an IN_USE trip by emp-06; returns the db and reservation id. */
function onTrip(dataMode: 'DEMO' | 'LIVE' = 'LIVE'): { db: FleetDatabaseSchema; resId: string } {
  let db: FleetDatabaseSchema = { ...createSeedDatabase(), dataMode };
  db = requestDispatch(
    db,
    { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '16:00 ~ 18:00', notes: '' },
    ctx()
  ).db;
  const resId = db.reservations.find((r) => r.vehicleId === 'veh-8' && r.stage === 'REQUESTED')!.id;
  db = approveDispatch(db, { reservationId: resId }, ctx(T0, { isAdmin: true })).db;
  db = startDispatch(db, { reservationId: resId }, ctx()).db;
  return { db, resId };
}

const fix = (resId: string, over: Partial<TripPositionPayload> = {}): TripPositionPayload => ({
  reservationId: resId,
  employeeId: 'emp-06',
  lat: HQ.lat,
  lng: HQ.lng,
  speedKmh: null,
  headingDeg: null,
  accuracyM: 12,
  ...over,
});

const veh8 = (db: FleetDatabaseSchema) => db.vehicles.find((v) => v.id === 'veh-8')!;
const res = (db: FleetDatabaseSchema, id: string) => db.reservations.find((r) => r.id === id)!;

describe('recordTripPosition', () => {
  it('anchors the first fix: moves the vehicle on the map without adding distance', () => {
    const { db, resId } = onTrip();
    const before = veh8(db).cumulativeGpsKm;
    const out = recordTripPosition(db, fix(resId, { lat: 32.70, lng: -85.33, speedKmh: 42, headingDeg: 90 }), ctx(at(1)));
    expect(out.result.ok).toBe(true);
    expect(veh8(out.db)).toMatchObject({ lat: 32.70, lng: -85.33, speedKmh: 42, headingDeg: 90, lastFixAt: at(1).toISOString() });
    expect(veh8(out.db).cumulativeGpsKm).toBe(before);
    expect(res(out.db, resId).gpsTrack).toMatchObject({ fixCount: 1, gpsKm: 0, maxSpeedKmh: 42 });
  });

  it('accumulates straight-line distance and derives speed when the phone gives none', () => {
    const { db, resId } = onTrip();
    const first = recordTripPosition(db, fix(resId), ctx(at(0))).db;
    const before = veh8(first).cumulativeGpsKm;
    const out = recordTripPosition(first, fix(resId, { lat: HQ.lat + 0.1 }), ctx(at(10))); // ~11.1 km in 10 min
    const track = res(out.db, resId).gpsTrack!;
    expect(track.fixCount).toBe(2);
    expect(track.gpsKm).toBeCloseTo(11.1, 0);
    expect(veh8(out.db).speedKmh).toBeCloseTo(66.7, 0);
    expect(veh8(out.db).cumulativeGpsKm).toBeCloseTo(before + 11.1, 0);
    expect(out.result.message).toMatch(/11\.1 ?km/);
  });

  it('skips a write when the previous fix is under a minute old', () => {
    const { db, resId } = onTrip();
    const first = recordTripPosition(db, fix(resId), ctx(at(0))).db;
    const again = recordTripPosition(first, fix(resId, { lat: HQ.lat + 0.001 }), ctx(new Date(at(0).getTime() + 30_000)));
    expect(again.result.ok).toBe(true);
    expect(again.db).toBe(first);
  });

  it('rejects inaccurate fixes and impossible jumps without changing anything', () => {
    const { db, resId } = onTrip();
    const blurry = recordTripPosition(db, fix(resId, { accuracyM: 500 }), ctx(at(1)));
    expect(blurry.result.ok).toBe(false);
    expect(blurry.db).toBe(db);

    const first = recordTripPosition(db, fix(resId), ctx(at(0))).db;
    const teleport = recordTripPosition(first, fix(resId, { lat: HQ.lat + 1 }), ctx(at(2))); // ~111 km in 2 min
    expect(teleport.result.ok).toBe(false);
    expect(teleport.result.message).toMatch(/비정상/);
    expect(teleport.db).toBe(first);
  });

  it('accepts only the driver of an IN_USE trip', () => {
    const { db, resId } = onTrip();
    expect(recordTripPosition(db, fix(resId, { employeeId: 'emp-01' }), ctx(at(1))).result.ok).toBe(false);
    expect(recordTripPosition(db, fix('res-missing'), ctx(at(1))).result.ok).toBe(false);

    const returned = returnVehicle(db, { reservationId: resId, parkingZone: 'Lot A', keyReturnedToBox: true }, ctx(at(5))).db;
    const late = recordTripPosition(returned, fix(resId), ctx(at(6)));
    expect(late.result.ok).toBe(false);
    expect(late.db).toBe(returned);
  });
});

describe('trip start and return with GPS', () => {
  it('does not write made-up G-force or Bluetooth signal values in LIVE mode', () => {
    const { db } = onTrip('LIVE');
    const parked = createSeedDatabase().vehicles.find((v) => v.id === 'veh-8')!;
    expect(veh8(db).currentGForce).toBe(parked.currentGForce);
    expect(veh8(db).rssiDbm).toBe(parked.rssiDbm);
  });

  it('records GPS distance on return and summarizes the track', () => {
    const { db, resId } = onTrip();
    const startKm = res(db, resId).startOdometerKm;
    let next = recordTripPosition(db, fix(resId), ctx(at(0))).db;
    next = recordTripPosition(next, fix(resId, { lat: HQ.lat + 0.05 }), ctx(at(10))).db;
    const out = returnVehicle(next, { reservationId: resId, parkingZone: 'Lot A', keyReturnedToBox: true }, ctx(at(20)));
    const done = res(out.db, resId);
    expect(done.endOdometerKm! - startKm).toBeCloseTo(5.6, 0);
    expect(done.notes).toMatch(/GPS 2회/);
  });

  it('flags a return with no GPS fixes so the odometer gets checked', () => {
    const { db, resId } = onTrip();
    const out = returnVehicle(db, { reservationId: resId, parkingZone: 'Lot A', keyReturnedToBox: true }, ctx(at(20)));
    expect(res(out.db, resId).notes).toMatch(/GPS 기록 없음/);
  });
});

describe('tripSignal', () => {
  it('reports live, stale and missing GPS for a vehicle on a trip', () => {
    const { db, resId } = onTrip();
    expect(tripSignal(veh8(db), at(3).getTime())).toEqual({ state: 'NO_FIX', minutesAgo: null });
    const fixed = recordTripPosition(db, fix(resId), ctx(at(0))).db;
    expect(tripSignal(veh8(fixed), at(4).getTime())).toEqual({ state: 'LIVE', minutesAgo: 4 });
    expect(tripSignal(veh8(fixed), at(STALE_FIX_MINUTES + 1).getTime()).state).toBe('STALE');
  });

  it('is not applicable to parked vehicles', () => {
    const parked = createSeedDatabase().vehicles.find((v) => v.id === 'veh-8')!;
    expect(tripSignal(parked, T0.getTime()).state).toBe('PARKED');
  });
});
