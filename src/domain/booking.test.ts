// Advance booking with time windows: request / approve / start rules (spec fleetguard30--advance-booking-time-slots).
import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { VehicleReservation } from '@/types/fleet';
import { ActionContext } from './core';
import { approveDispatch, requestDispatch, startDispatch } from './dispatch';

const NOW = new Date('2026-11-01T16:00:00Z'); // 2026-11-01 10:00 CST (DST ended 02:00 that day)
const ctx = (now: Date = NOW, extra: Partial<ActionContext> = {}): ActionContext => ({ now, isAdmin: false, ...extra });
const admin = (now: Date = NOW) => ctx(now, { isAdmin: true });
// Booking rules only; the inspection gate has its own tests
const seed = (): FleetDatabaseSchema => {
  const db = createSeedDatabase();
  return { ...db, policyConfig: { ...db.policyConfig, requirePreTripInspection: false, requirePostTripInspection: false } };
};
const book = (db: FleetDatabaseSchema, employeeId: string, vehicleId: string, start: string, end: string, now: Date = NOW) =>
  requestDispatch(
    db,
    { employeeId, vehicleId, purpose: '거래처방문', destination: 'HMMA', plannedStartAt: start, plannedEndAt: end, notes: '' },
    ctx(now)
  );
const open = (db: FleetDatabaseSchema, vehicleId: string) =>
  db.reservations.filter((r) => r.vehicleId === vehicleId && ['REQUESTED', 'APPROVED', 'IN_USE'].includes(r.stage));
const only = (db: FleetDatabaseSchema, vehicleId: string): VehicleReservation => open(db, vehicleId)[0];

describe('requestDispatch with a time window', () => {
  it('requestDispatch stores ISO times and derived plannedTimeWindow', () => {
    const { db, result } = book(seed(), 'emp-06', 'veh-8', '2026-11-05T13:00:00-06:00', '2026-11-05T16:00:00-06:00');
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/11\/05 13:00 ~ 16:00/);
    expect(only(db, 'veh-8')).toMatchObject({
      stage: 'REQUESTED',
      plannedStartAt: '2026-11-05T19:00:00.000Z',
      plannedEndAt: '2026-11-05T22:00:00.000Z',
      plannedTimeWindow: '11/05 13:00 ~ 16:00',
    });
  });

  it('lets two non-overlapping bookings share one vehicle and refuses one inside the buffer (AC-M3a)', () => {
    let db = book(seed(), 'emp-06', 'veh-8', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z').db; // 10:00-12:00
    db = approveDispatch(db, { reservationId: only(db, 'veh-8').id }, admin()).db;

    const clash = book(db, 'emp-01', 'veh-8', '2026-11-05T18:10:00Z', '2026-11-05T19:00:00Z');
    expect(clash.result.ok).toBe(false);
    expect(clash.result.message).toMatch(/10:00 ~ 12:00\(\+버퍼 15분\) 한소희 대리 승인완료와 겹칩니다/);
    expect(clash.db.pushStream[0].message).toMatch(/중복 배차 신청 차단/);
    expect(open(clash.db, 'veh-8')).toHaveLength(1);

    const fine = book(db, 'emp-01', 'veh-8', '2026-11-05T18:15:00Z', '2026-11-05T19:00:00Z');
    expect(fine.result.ok).toBe(true);
    expect(open(fine.db, 'veh-8')).toHaveLength(2);
  });

  it('enforces the advance limit and the past grace (AC-M2)', () => {
    expect(book(seed(), 'emp-06', 'veh-8', '2026-11-15T16:01:00Z', '2026-11-15T17:00:00Z').result.message).toMatch(/14일 이내/);
    expect(book(seed(), 'emp-06', 'veh-8', '2026-11-01T15:50:00Z', '2026-11-01T17:00:00Z').result.message).toMatch(/지난 시각/);
    expect(book(seed(), 'emp-06', 'veh-8', '2026-11-15T16:00:00Z', '2026-11-15T17:00:00Z').result.ok).toBe(true);
    expect(book(seed(), 'emp-06', 'veh-8', '2026-11-01T15:56:00Z', '2026-11-01T17:00:00Z').result.ok).toBe(true);
  });

  it('keeps the legacy blocking rule for a vehicle with an untimed open request (AC-M6, seed res-101)', () => {
    const { db, result } = book(seed(), 'emp-01', 'veh-2', '2026-11-10T16:00:00Z', '2026-11-10T17:00:00Z');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/이미 배차가 진행 중입니다 — 한소희 대리 · 승인대기 · 20:30 ~ 22:30/);
    expect(open(db, 'veh-2')).toHaveLength(1);
  });

  it('allows a future booking on a vehicle that is driving now (AC-M4)', () => {
    // 09:00-11:00 trip running at 10:00
    let db = book(seed(), 'emp-06', 'veh-8', '2026-11-01T15:00:00Z', '2026-11-01T17:00:00Z', new Date('2026-11-01T14:50:00Z')).db;
    const id = only(db, 'veh-8').id;
    db = approveDispatch(db, { reservationId: id }, admin()).db;
    db = startDispatch(db, { reservationId: id }, ctx()).db;
    expect(db.vehicles.find((v) => v.id === 'veh-8')?.status).toBe('AUTHORIZED');

    expect(book(db, 'emp-01', 'veh-8', '2026-11-02T15:00:00Z', '2026-11-02T16:00:00Z').result.ok).toBe(true);
    expect(book(db, 'emp-01', 'veh-8', '2026-11-01T16:00:00Z', '2026-11-01T16:30:00Z').result.message).toMatch(/겹칩니다|운행중/);
  });

  it('still accepts a legacy payload with only plannedTimeWindow, and refuses an empty one', () => {
    const legacy = requestDispatch(seed(), { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00 ~ 23:00', notes: '' }, ctx());
    expect(legacy.result.ok).toBe(true);
    expect(only(legacy.db, 'veh-8')).toMatchObject({ plannedTimeWindow: '21:00 ~ 23:00' });
    expect(only(legacy.db, 'veh-8').plannedStartAt).toBeUndefined();
    const empty = requestDispatch(seed(), { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', notes: '' }, ctx());
    expect(empty.result.ok).toBe(false);
  });
});

describe('approveDispatch with time windows', () => {
  it('approveDispatch rechecks overlap against APPROVED/IN_USE only', () => {
    // Two overlapping pending requests (e.g. stored before this rule): first approval wins
    const base = book(seed(), 'emp-06', 'veh-8', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z').db;
    const first = only(base, 'veh-8');
    const second: VehicleReservation = { ...first, id: 'res-dup', employeeId: 'emp-01', employeeName: '김민수 과장 (M.S. Kim)' };
    const db = { ...base, reservations: [second, ...base.reservations] };

    const approved = approveDispatch(db, { reservationId: first.id }, admin());
    expect(approved.result.ok).toBe(true);
    const refused = approveDispatch(approved.db, { reservationId: 'res-dup' }, admin());
    expect(refused.result.ok).toBe(false);
    expect(refused.result.message).toMatch(/겹칩니다/);
  });

  it('refuses to approve a booking whose time has already passed', () => {
    const db = book(seed(), 'emp-06', 'veh-8', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z').db;
    const late = approveDispatch(db, { reservationId: only(db, 'veh-8').id }, admin(new Date('2026-11-05T18:00:00Z')));
    expect(late.result.ok).toBe(false);
    expect(late.result.message).toMatch(/예약 시간이 지났/);
  });
});

describe('startDispatch departure window', () => {
  it('startDispatch refuses before early-start grace and after planned end', () => {
    // AC-M5: approved 11/05 13:00-16:00
    let db = book(seed(), 'emp-06', 'veh-8', '2026-11-05T19:00:00Z', '2026-11-05T22:00:00Z').db;
    const id = only(db, 'veh-8').id;
    db = approveDispatch(db, { reservationId: id }, admin()).db;

    const early = startDispatch(db, { reservationId: id }, ctx(new Date('2026-11-05T18:20:00Z')));
    expect(early.result.ok).toBe(false);
    expect(early.result.message).toBe('12:30부터 출발할 수 있습니다.');
    expect(startDispatch(db, { reservationId: id }, ctx(new Date('2026-11-05T22:01:00Z'))).result.ok).toBe(false);
    const onTime = startDispatch(db, { reservationId: id }, ctx(new Date('2026-11-05T18:30:00Z')));
    expect(onTime.result.ok).toBe(true);
    expect(only(onTime.db, 'veh-8').stage).toBe('IN_USE');
  });

  it('blocks the next booking from leaving while the earlier trip is still out', () => {
    let db = book(seed(), 'emp-06', 'veh-8', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z').db;
    const a = only(db, 'veh-8').id;
    db = book(db, 'emp-01', 'veh-8', '2026-11-05T19:00:00Z', '2026-11-05T20:00:00Z').db;
    const b = open(db, 'veh-8').find((r) => r.id !== a)!.id;
    db = approveDispatch(db, { reservationId: a }, admin()).db;
    db = approveDispatch(db, { reservationId: b }, admin()).db;
    // a is still out (not returned) at 13:00, so b cannot leave yet
    db = startDispatch(db, { reservationId: a }, ctx(new Date('2026-11-05T16:00:00Z'))).db;
    const blocked = startDispatch(db, { reservationId: b }, ctx(new Date('2026-11-05T19:00:00Z')));
    expect(blocked.result.ok).toBe(false);
  });
});
