import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { localDate, localTime } from './clock';
import { ActionContext } from './core';
import {
  approveDispatch,
  autoReturnVehicle,
  quickStartDispatch,
  rejectDispatch,
  requestDispatch,
  returnVehicle,
  startDispatch,
} from './dispatch';

const NOW = new Date('2026-10-25T21:12:22Z'); // 16:12:22 CDT in Opelika
const ctx = (extra: Partial<ActionContext> = {}): ActionContext => ({ now: NOW, isAdmin: false, ...extra });

// Seed: veh-8 is parked with no reservations; veh-2 has demo res-101 (REQUESTED);
// emp-03 and emp-07 are suspended; emp-06 is allowed.
const seed = (): FleetDatabaseSchema => createSeedDatabase();
const request = (db: FleetDatabaseSchema, employeeId: string, vehicleId: string) =>
  requestDispatch(
    db,
    { employeeId, vehicleId, purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00 ~ 23:00', notes: '' },
    ctx()
  );
const openOn = (db: FleetDatabaseSchema, vehicleId: string) =>
  db.reservations.filter((r) => r.vehicleId === vehicleId && ['REQUESTED', 'APPROVED', 'IN_USE'].includes(r.stage));

describe('clock (America/Chicago)', () => {
  it('formats Opelika local time and date, not UTC', () => {
    expect(localTime(NOW)).toBe('16:12:22');
    expect(localDate(NOW)).toBe('2026-10-25');
    const lateEvening = new Date('2026-10-26T03:00:05Z');
    expect([localDate(lateEvening), localTime(lateEvening)]).toEqual(['2026-10-25', '22:00:05']);
    expect(localTime(new Date('2026-12-01T15:30:00Z'))).toBe('09:30:00');
  });
});

describe('requestDispatch', () => {
  it('creates a pending request stamped with local time and notifies the manager', () => {
    const { db, result } = request(seed(), 'emp-06', 'veh-8');
    expect(result.ok).toBe(true);
    const created = openOn(db, 'veh-8');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ stage: 'REQUESTED', employeeId: 'emp-06', requestedAt: '16:12:22' });
    expect(db.pushStream[0].message).toMatch(/배차 승인 요청/);
  });

  it('blocks a duplicate on the same vehicle and posts a notice without adding a reservation', () => {
    const first = request(seed(), 'emp-06', 'veh-8').db;
    const { db, result } = request(first, 'emp-01', 'veh-8');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/이미 배차가 진행 중/);
    expect(openOn(db, 'veh-8')).toHaveLength(1);
    expect(db.pushStream[0].message).toMatch(/중복 배차 신청 차단/);
  });

  it('blocks suspended employees and locked vehicles', () => {
    expect(request(seed(), 'emp-03', 'veh-8').result.message).toMatch(/배차 자격이 일시 정지/);
    const locked = { ...seed() };
    locked.vehicles = locked.vehicles.map((v) => (v.id === 'veh-8' ? { ...v, isLockedByAdmin: true } : v));
    expect(request(locked, 'emp-06', 'veh-8').result.message).toMatch(/잠근 차량/);
  });

  it('auto-approves when the policy says the manager is away', () => {
    const db = seed();
    const away = { ...db, policyConfig: { ...db.policyConfig, autoApproveWhenManagerAway: true } };
    expect(openOn(request(away, 'emp-06', 'veh-8').db, 'veh-8')[0].stage).toBe('APPROVED');
  });
});

describe('approve / reject / start', () => {
  it('approves a pending request and refuses non-pending ones', () => {
    const requested = request(seed(), 'emp-06', 'veh-8').db;
    const resId = openOn(requested, 'veh-8')[0].id;
    const approved = approveDispatch(requested, { reservationId: resId }, ctx({ isAdmin: true }));
    expect(approved.result.ok).toBe(true);
    expect(approved.db.reservations.find((r) => r.id === resId)).toMatchObject({ stage: 'APPROVED', approvedAt: '16:12:22' });
    expect(approveDispatch(approved.db, { reservationId: resId }, ctx({ isAdmin: true })).result.ok).toBe(false);
  });

  it('refuses to approve a second booking once one is confirmed', () => {
    const db = seed();
    const pair = {
      ...db,
      reservations: [
        { ...db.reservations.find((r) => r.id === 'res-101')!, id: 'dup-a', vehicleId: 'veh-8', stage: 'REQUESTED' as const },
        { ...db.reservations.find((r) => r.id === 'res-101')!, id: 'dup-b', vehicleId: 'veh-8', stage: 'REQUESTED' as const },
      ],
    };
    const first = approveDispatch(pair, { reservationId: 'dup-a' }, ctx({ isAdmin: true }));
    expect(first.result.ok).toBe(true);
    const second = approveDispatch(first.db, { reservationId: 'dup-b' }, ctx({ isAdmin: true }));
    expect(second.result.ok).toBe(false);
    expect(second.db.reservations.find((r) => r.id === 'dup-b')?.stage).toBe('REQUESTED');
  });

  it('rejects a pending request', () => {
    const { db, result } = rejectDispatch(seed(), { reservationId: 'res-101' }, ctx({ isAdmin: true }));
    expect(result.ok).toBe(true);
    expect(db.reservations.find((r) => r.id === 'res-101')?.stage).toBe('REJECTED');
  });

  it('starts an approved trip; in LIVE mode no simulated speed or position is invented', () => {
    let db = request(seed(), 'emp-06', 'veh-8').db;
    const resId = openOn(db, 'veh-8')[0].id;
    db = approveDispatch(db, { reservationId: resId }, ctx({ isAdmin: true })).db;
    const before = db.vehicles.find((v) => v.id === 'veh-8')!;
    const live = startDispatch({ ...db, dataMode: 'LIVE' }, { reservationId: resId }, ctx());
    expect(live.result.ok).toBe(true);
    const veh = live.db.vehicles.find((v) => v.id === 'veh-8')!;
    expect(veh).toMatchObject({ status: 'AUTHORIZED', currentDriverId: 'emp-06', speedKmh: 0, lat: before.lat, lng: before.lng });
    expect(live.db.reservations.find((r) => r.id === resId)).toMatchObject({ stage: 'IN_USE', startedAt: '16:12:22' });
  });
});

describe('quickStartDispatch (1-second start)', () => {
  it("starts the driver's own approved booking instead of creating another", () => {
    let db = request(seed(), 'emp-06', 'veh-8').db;
    const resId = openOn(db, 'veh-8')[0].id;
    db = approveDispatch(db, { reservationId: resId }, ctx({ isAdmin: true })).db;
    const { db: after, result } = quickStartDispatch(db, { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' }, ctx());
    expect(result.ok).toBe(true);
    expect(openOn(after, 'veh-8')).toEqual([expect.objectContaining({ id: resId, stage: 'IN_USE' })]);
  });

  it('blocks when someone else holds the vehicle', () => {
    const base = seed();
    const db = request({ ...base, policyConfig: { ...base.policyConfig, autoApproveWhenManagerAway: true } }, 'emp-06', 'veh-8').db;
    const { db: after, result } = quickStartDispatch(db, { employeeId: 'emp-01', vehicleId: 'veh-8', purpose: '거래처방문' }, ctx());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/이미 배차가 진행 중/);
    expect(openOn(after, 'veh-8')).toHaveLength(1);
  });
});

describe('returns', () => {
  it('returns a trip, logs distance from the GPS total and dates the tax log in local time', () => {
    let db = request(seed(), 'emp-06', 'veh-8').db;
    const resId = openOn(db, 'veh-8')[0].id;
    db = approveDispatch(db, { reservationId: resId }, ctx({ isAdmin: true })).db;
    db = startDispatch(db, { reservationId: resId }, ctx()).db;
    const start = db.reservations.find((r) => r.id === resId)!.startOdometerKm;
    db = { ...db, vehicles: db.vehicles.map((v) => (v.id === 'veh-8' ? { ...v, cumulativeGpsKm: start + 12.3 } : v)) };
    const lateEvening = { now: new Date('2026-10-26T03:00:05Z'), isAdmin: false };
    const { db: after, result } = returnVehicle(db, { reservationId: resId, parkingZone: 'Northpark Lot A #08', keyReturnedToBox: true }, lateEvening);
    expect(result.ok).toBe(true);
    expect(after.reservations.find((r) => r.id === resId)).toMatchObject({ stage: 'RETURNED', returnedAt: '22:00:05' });
    expect(after.vehicles.find((v) => v.id === 'veh-8')?.status).toBe('IDLE');
    expect(after.taxLogs[0]).toMatchObject({ date: '2026-10-25', distanceKm: 12.3 });
  });

  it('refuses to return a trip that is not in use', () => {
    expect(returnVehicle(seed(), { reservationId: 'res-101', parkingZone: 'Lot', keyReturnedToBox: true }, ctx()).result.ok).toBe(false);
  });

  it('auto-returns the active trip of a vehicle', () => {
    const { db, result } = autoReturnVehicle(seed(), { vehicleId: 'veh-1' }, ctx());
    expect(result.ok).toBe(true);
    expect(db.vehicles.find((v) => v.id === 'veh-1')?.status).toBe('IDLE');
    expect(db.reservations.find((r) => r.id === 'res-104')?.stage).toBe('RETURNED');
  });
});
