import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { createDriverToken } from '@/lib/driverToken';
import { toClientView } from '@/lib/clientView';
import { runAction } from './actions';
import { issueDriverToken } from './admin';
import { ActionContext } from './core';
import { approveDispatch, quickStartDispatch, requestDispatch, startDispatch } from './dispatch';
import { applyTelemetry } from './telemetry';

const NOW = new Date('2026-10-25T21:12:22Z');
const ctx = (extra: Partial<ActionContext> = {}): ActionContext => ({ now: NOW, isAdmin: false, ...extra });

const withVehicle = (db: FleetDatabaseSchema, id: string, patch: object): FleetDatabaseSchema => ({
  ...db,
  vehicles: db.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
});
const withEmployee = (db: FleetDatabaseSchema, id: string, patch: object): FleetDatabaseSchema => ({
  ...db,
  employees: db.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});
const withPolicy = (db: FleetDatabaseSchema, patch: object): FleetDatabaseSchema => ({
  ...db,
  policyConfig: { ...db.policyConfig, ...patch },
});

/** emp-06 holds an APPROVED booking on veh-8 (seed state otherwise). */
function approvedBooking(base: FleetDatabaseSchema = createSeedDatabase()) {
  const requested = requestDispatch(
    base,
    { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00 ~ 23:00', notes: '' },
    ctx()
  ).db;
  const resId = requested.reservations.find((r) => r.vehicleId === 'veh-8' && r.stage === 'REQUESTED')!.id;
  return { db: approveDispatch(requested, { reservationId: resId }, ctx({ isAdmin: true })).db, resId };
}

/** Enrolls a phone for the employee and returns the database plus the token the phone keeps. */
function enroll(db: FleetDatabaseSchema, employeeId: string) {
  const { token, hash } = createDriverToken(employeeId);
  const issued = issueDriverToken(db, { employeeId, tokenHash: hash }, ctx({ isAdmin: true }));
  expect(issued.result.ok).toBe(true);
  return { db: issued.db, token };
}

describe('startDispatch re-checks driver eligibility and vehicle lock (finding 4)', () => {
  it('refuses to start when the employee was suspended after approval', () => {
    const { db, resId } = approvedBooking();
    const suspended = withEmployee(db, 'emp-06', { dispatchAllowed: false });
    const { db: after, result } = startDispatch(suspended, { reservationId: resId }, ctx());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/배차 자격이 일시 정지/);
    expect(after.reservations.find((r) => r.id === resId)?.stage).toBe('APPROVED');
  });

  it('refuses to start when an admin locked the vehicle after approval', () => {
    const { db, resId } = approvedBooking();
    const locked = withVehicle(db, 'veh-8', { isLockedByAdmin: true });
    const { result } = startDispatch(locked, { reservationId: resId }, ctx());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/잠근 차량/);
  });

  it('applies the same checks on the quick-start path for an approved booking', () => {
    const { db } = approvedBooking();
    const locked = withVehicle(db, 'veh-8', { isLockedByAdmin: true });
    const payload = { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' as const };
    expect(quickStartDispatch(locked, payload, ctx()).result.ok).toBe(false);
    const suspended = withEmployee(db, 'emp-06', { dispatchAllowed: false });
    expect(quickStartDispatch(suspended, payload, ctx()).result.ok).toBe(false);
  });
});

describe('quickStartDispatch honours autoApproveWhenManagerAway (finding 5)', () => {
  const payload = { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' as const };

  it('refuses an unbooked quick start while the manager approves bookings', () => {
    const db = withPolicy(createSeedDatabase(), { autoApproveWhenManagerAway: false });
    const { db: after, result } = quickStartDispatch(db, payload, ctx());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/관리자 승인/);
    expect(after.reservations.filter((r) => r.vehicleId === 'veh-8')).toHaveLength(0);
  });

  it('allows an unbooked quick start when auto-approval is on', () => {
    const db = withPolicy(createSeedDatabase(), { autoApproveWhenManagerAway: true });
    expect(quickStartDispatch(db, payload, ctx()).result.ok).toBe(true);
  });

  it('still starts an already-approved booking when auto-approval is off', () => {
    const { db } = approvedBooking(withPolicy(createSeedDatabase(), { autoApproveWhenManagerAway: false }));
    expect(quickStartDispatch(db, payload, ctx()).result.ok).toBe(true);
  });
});

describe('driver identity on driver actions in LIVE mode (finding 2)', () => {
  const live = (db: FleetDatabaseSchema): FleetDatabaseSchema => ({ ...db, dataMode: 'LIVE' });

  it('refuses a driver action from a phone that is not enrolled', () => {
    const { db, resId } = approvedBooking();
    const { result } = runAction(live(db), { type: 'dispatch.start', payload: { reservationId: resId } }, ctx());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/기기 등록/);
  });

  it("refuses another employee's phone acting on someone else's booking", () => {
    const { db: booked, resId } = approvedBooking();
    const { db, token } = enroll(live(booked), 'emp-01');
    const { result } = runAction(db, { type: 'dispatch.start', payload: { reservationId: resId } }, ctx({ driverToken: token }));
    expect(result.ok).toBe(false);
  });

  it("accepts the booking owner's enrolled phone", () => {
    const { db: booked, resId } = approvedBooking();
    const { db, token } = enroll(live(booked), 'emp-06');
    const { result } = runAction(db, { type: 'dispatch.start', payload: { reservationId: resId } }, ctx({ driverToken: token }));
    expect(result.ok).toBe(true);
  });

  it('rejects a forged token that only names the employee', () => {
    const { db: booked, resId } = approvedBooking();
    const { db } = enroll(live(booked), 'emp-06');
    const { result } = runAction(db, { type: 'dispatch.start', payload: { reservationId: resId } }, ctx({ driverToken: 'emp-06.forged' }));
    expect(result.ok).toBe(false);
  });

  it('revokes the old phone when a new link is issued', () => {
    const { db: booked, resId } = approvedBooking();
    const first = enroll(live(booked), 'emp-06');
    const second = enroll(first.db, 'emp-06');
    const action = { type: 'dispatch.start' as const, payload: { reservationId: resId } };
    expect(runAction(second.db, action, ctx({ driverToken: first.token })).result.ok).toBe(false);
    expect(runAction(second.db, action, ctx({ driverToken: second.token })).result.ok).toBe(true);
  });

  it('requires the enrolled employee for request, quickStart and trip.position too', () => {
    const { db, token } = enroll(live(withPolicy(createSeedDatabase(), { autoApproveWhenManagerAway: true })), 'emp-01');
    const asEmp01 = ctx({ driverToken: token });
    const request = {
      type: 'dispatch.request' as const,
      payload: { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' as const, destination: 'HMMA', plannedTimeWindow: '21:00', notes: '' },
    };
    expect(runAction(db, request, asEmp01).result.ok).toBe(false);
    const quick = { type: 'dispatch.quickStart' as const, payload: { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' as const } };
    expect(runAction(db, quick, asEmp01).result.ok).toBe(false);
    expect(runAction(db, { ...quick, payload: { ...quick.payload, employeeId: 'emp-01' } }, asEmp01).result.ok).toBe(true);
  });

  it('lets an admin act for any driver and keeps DEMO mode open', () => {
    const { db, resId } = approvedBooking();
    const action = { type: 'dispatch.start' as const, payload: { reservationId: resId } };
    expect(runAction(live(db), action, ctx({ isAdmin: true })).result.ok).toBe(true);
    expect(runAction(db, action, ctx()).result.ok).toBe(true);
  });
});

describe('telemetry trusts only server state (finding 3)', () => {
  const packet = {
    vehicleId: 'veh-8',
    plateNumber: 'AL 41B-3196',
    lat: 32.7,
    lng: -85.31,
    speedKmh: 60,
    gForce: 1,
    deltaSpeedKmh: 0,
    gyroYawDegPerSec: 0,
    persistToDb: true,
  };

  it('flags unauthorized driving even when the client claims an approval', () => {
    const { result } = applyTelemetry(createSeedDatabase(), { ...packet, employeeId: 'emp-06', hasActiveApproval: true }, ctx());
    expect(result.isUnauthorizedDriving).toBe(true);
  });

  it('treats an approved or in-use booking on the server as approval', () => {
    const { db } = approvedBooking();
    const { result } = applyTelemetry(db, { ...packet, employeeId: 'emp-06', hasActiveApproval: false }, ctx());
    expect(result.isUnauthorizedDriving).toBe(false);
  });

  it('never blames another employee for an unknown employee id', () => {
    expect(() => applyTelemetry(createSeedDatabase(), { ...packet, employeeId: 'emp-nobody' }, ctx())).toThrow(/Unknown employeeId/);
  });
});

describe('client view hides contact data (finding 6)', () => {
  it('strips phone numbers and token hashes for non-admin viewers', () => {
    const { db } = enroll(createSeedDatabase(), 'emp-06');
    const view = toClientView(db, { isAdmin: false });
    expect(view.employees.every((e) => e.phone === '')).toBe(true);
    expect(view.employees.some((e) => 'deviceTokenHash' in e)).toBe(false);
  });

  it('keeps phone numbers for admins but never the token hash', () => {
    const { db } = enroll(createSeedDatabase(), 'emp-06');
    const view = toClientView(db, { isAdmin: true });
    expect(view.employees.find((e) => e.id === 'emp-06')?.phone).toMatch(/\d/);
    expect(view.employees.some((e) => 'deviceTokenHash' in e)).toBe(false);
    expect(view.employees.find((e) => e.id === 'emp-06')?.deviceEnrolledAt).toBeTruthy();
  });
});
