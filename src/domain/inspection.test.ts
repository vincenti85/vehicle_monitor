// Pre/post-trip inspection checklist (spec fleetguard30--trip-inspection-checklist).
import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { InspectionItemResult, VehicleInspection } from '@/types/fleet';
import { ActionContext } from './core';
import { createDriverToken } from '@/lib/driverToken';
import { requiresAdmin, runAction } from './actions';
import { issueDriverToken, toggleVehicleLock } from './admin';
import { approveDispatch, quickStartDispatch, requestDispatch, returnVehicle, startDispatch } from './dispatch';
import {
  DEFAULT_INSPECTION_TEMPLATE,
  InspectionSubmitPayload,
  hasPreTripInspection,
  pruneInspections,
  resolveInspection,
  submitInspection,
  summarizeInspection,
} from './inspection';

const NOW = new Date('2026-10-25T21:12:22Z'); // 16:12:22 CDT
const ctx = (extra: Partial<ActionContext> = {}): ActionContext => ({ now: NOW, isAdmin: false, ...extra });
const admin = ctx({ isAdmin: true });

const allPass = (): InspectionItemResult[] => DEFAULT_INSPECTION_TEMPLATE.map((t) => ({ itemId: t.id, passed: true, note: '' }));
const failing = (fails: Record<string, string>): InspectionItemResult[] =>
  allPass().map((i) => (fails[i.itemId] ? { ...i, passed: false, note: fails[i.itemId] } : i));
const gps = { startLat: 32.69, startLng: -85.33, submitLat: 32.6901, submitLng: -85.3301, accuracyM: 6 };
const noGps = { startLat: null, startLng: null, submitLat: null, submitLng: null, accuracyM: null };

/** Seed with emp-06's approved legacy booking on veh-8. */
function approvedBooking(): { db: FleetDatabaseSchema; id: string } {
  let db = requestDispatch(
    createSeedDatabase(),
    { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00 ~ 23:00', notes: '' },
    ctx()
  ).db;
  const id = db.reservations.find((r) => r.vehicleId === 'veh-8' && r.stage === 'REQUESTED')!.id;
  db = approveDispatch(db, { reservationId: id }, admin).db;
  return { db, id };
}
const pre = (id: string, items: InspectionItemResult[], extra: Partial<InspectionSubmitPayload> = {}): InspectionSubmitPayload => ({
  reservationId: id,
  employeeId: 'emp-06',
  kind: 'PRE_TRIP',
  items,
  startedAt: '2026-10-25T21:11:30.000Z',
  ...gps,
  ...extra,
});
const veh8 = (db: FleetDatabaseSchema) => db.vehicles.find((v) => v.id === 'veh-8')!;
const latest = (db: FleetDatabaseSchema): VehicleInspection => db.inspections[0];

describe('summarizeInspection', () => {
  it('summarizeInspection counts failed items and flags critical', () => {
    const s = summarizeInspection(failing({ tires: '앞 타이어 마모', interior: '시트 얼룩' }), DEFAULT_INSPECTION_TEMPLATE);
    expect(s).toMatchObject({ failedItems: 2, criticalFailed: true });
    expect(s.failedLabels).toEqual(['타이어', '실내 상태']);
    expect(summarizeInspection(allPass(), DEFAULT_INSPECTION_TEMPLATE)).toMatchObject({ failedItems: 0, criticalFailed: false });
  });

  it('ships 8 default items with tires, warning lights and brakes as critical (AC-M1)', () => {
    expect(DEFAULT_INSPECTION_TEMPLATE).toHaveLength(8);
    expect(DEFAULT_INSPECTION_TEMPLATE.filter((t) => t.critical).map((t) => t.id).sort()).toEqual(['brakes', 'tires', 'warning-lights']);
    expect(createSeedDatabase().policyConfig.inspectionTemplate).toEqual(DEFAULT_INSPECTION_TEMPLATE);
  });
});

describe('submitInspection', () => {
  it('submitInspection stores server time and GPS stamp', () => {
    const { db, id } = approvedBooking();
    const out = submitInspection(db, pre(id, allPass()), ctx());
    expect(out.result.ok).toBe(true);
    expect(latest(out.db)).toMatchObject({
      kind: 'PRE_TRIP', reservationId: id, vehicleId: 'veh-8', employeeId: 'emp-06',
      failedItems: 0, criticalFailed: false, gpsUnavailable: false,
      submittedAt: NOW.toISOString(), startedAt: '2026-10-25T21:11:30.000Z',
      startLat: 32.69, startLng: -85.33, submitLat: 32.6901, submitLng: -85.3301, accuracyM: 6,
    });
    expect(hasPreTripInspection(out.db, id)).toBe(true);
    expect(db.inspections).toHaveLength(0); // input untouched
  });

  it('submitInspection records gpsUnavailable when coordinates missing', () => {
    const { db, id } = approvedBooking();
    const rec = latest(submitInspection(db, pre(id, allPass(), noGps), ctx()).db);
    expect(rec).toMatchObject({ gpsUnavailable: true, submitLat: null, submitLng: null, accuracyM: null });
  });

  it('critical failure locks vehicle with INSPECTION_FAILED and alerts manager', () => {
    const { db, id } = approvedBooking();
    const out = submitInspection(db, pre(id, failing({ 'warning-lights': '엔진 경고등 점등' })), ctx());
    expect(out.result.ok).toBe(false);
    expect(out.result.message).toMatch(/#8호차가 점검 불합격으로 잠겼습니다/);
    const rec = latest(out.db);
    expect(veh8(out.db)).toMatchObject({ isLockedByAdmin: true, lockReason: 'INSPECTION_FAILED', lockInspectionId: rec.id });
    const managerAlerts = out.db.pushStream.slice(0, out.db.pushStream.length - db.pushStream.length);
    expect(managerAlerts).toHaveLength(1);
    expect(managerAlerts[0]).toMatchObject({ target: 'MANAGER', level: 'CRITICAL' });
    // AC-M6: request and start are both refused with the existing lock message
    expect(startDispatch(out.db, { reservationId: id }, ctx()).result.message).toMatch(/관리자가 잠근 차량/);
    const again = requestDispatch(out.db, { employeeId: 'emp-01', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'X', plannedTimeWindow: 'x', notes: '' }, ctx());
    expect(again.result.message).toMatch(/관리자가 잠근 차량/);
    expect(hasPreTripInspection(out.db, id)).toBe(false);
  });

  it('non-critical failure does not lock and sends INFO alert', () => {
    const { db, id } = approvedBooking();
    const out = submitInspection(db, pre(id, failing({ interior: '뒷좌석 오염' })), ctx());
    expect(out.result.ok).toBe(true);
    expect(veh8(out.db).isLockedByAdmin).toBeFalsy();
    expect(out.db.pushStream[0]).toMatchObject({ target: 'MANAGER', level: 'INFO' });
    expect(latest(out.db).failedItems).toBe(1);
    expect(hasPreTripInspection(out.db, id)).toBe(true);
  });

  it('submitInspection refuses a reservation not owned by the employee', () => {
    const { db, id } = approvedBooking();
    const out = submitInspection(db, pre(id, allPass(), { employeeId: 'emp-01' }), ctx());
    expect(out.result.ok).toBe(false);
    expect(out.db).toBe(db);
  });

  it('submitInspection refuses PRE_TRIP unless reservation is APPROVED', () => {
    const pending = requestDispatch(createSeedDatabase(), { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'X', plannedTimeWindow: 'x', notes: '' }, ctx()).db;
    const id = pending.reservations.find((r) => r.vehicleId === 'veh-8')!.id;
    expect(submitInspection(pending, pre(id, allPass()), ctx()).result.ok).toBe(false);
    expect(submitInspection(pending, pre('nope', allPass()), ctx()).result.ok).toBe(false);
    const { db, id: approvedId } = approvedBooking();
    expect(submitInspection(db, pre(approvedId, allPass(), { kind: 'POST_TRIP' }), ctx()).result.ok).toBe(false);
  });

  it('refuses answers that do not match the template', () => {
    const { db, id } = approvedBooking();
    expect(submitInspection(db, pre(id, allPass().slice(1)), ctx()).result.message).toMatch(/모든 점검 항목/);
    expect(submitInspection(db, pre(id, [...allPass().slice(1), { itemId: 'unknown', passed: true, note: '' }]), ctx()).result.ok).toBe(false);
  });
});

describe('dispatch gates', () => {
  it('startDispatch refuses without PRE_TRIP when policy on', () => {
    const { db, id } = approvedBooking();
    const out = startDispatch(db, { reservationId: id }, ctx());
    expect(out.result.ok).toBe(false);
    expect(out.result.message).toMatch(/운행 전 점검을 먼저 제출하세요/);
    const inspected = submitInspection(db, pre(id, allPass()), ctx()).db;
    expect(startDispatch(inspected, { reservationId: id }, ctx()).result.ok).toBe(true);
  });

  it('quickStart cannot skip the checklist: unbooked start refused, own approved booking still gated', () => {
    const autoOn = (db: FleetDatabaseSchema) => ({ ...db, policyConfig: { ...db.policyConfig, autoApproveWhenManagerAway: true } });
    const unbooked = quickStartDispatch(autoOn(createSeedDatabase()), { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' }, ctx());
    expect(unbooked.result.ok).toBe(false);
    expect(unbooked.db.reservations.filter((r) => r.vehicleId === 'veh-8')).toHaveLength(0);
    const { db } = approvedBooking();
    expect(quickStartDispatch(db, { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문' }, ctx()).result.message).toMatch(/운행 전 점검을 먼저/);
  });

  it('startDispatch unchanged when policy off', () => {
    const { db, id } = approvedBooking();
    const off = { ...db, policyConfig: { ...db.policyConfig, requirePreTripInspection: false } };
    expect(startDispatch(off, { reservationId: id }, ctx()).result.ok).toBe(true);
  });

  it('returnVehicle with inspection saves both in one outcome', () => {
    const { db, id } = approvedBooking();
    const running = startDispatch(submitInspection(db, pre(id, allPass()), ctx()).db, { reservationId: id }, ctx()).db;
    const post = { items: failing({ 'body-damage': '뒷범퍼 긁힘' }), startedAt: '2026-10-25T21:12:00.000Z', ...gps };
    const out = returnVehicle(running, { reservationId: id, parkingZone: 'Lot A #08', keyReturnedToBox: true, inspection: post }, ctx());
    expect(out.result.ok).toBe(true);
    expect(out.db.reservations.find((r) => r.id === id)?.stage).toBe('RETURNED');
    expect(latest(out.db)).toMatchObject({ kind: 'POST_TRIP', reservationId: id, failedItems: 1, criticalFailed: false });
    expect(out.db.taxLogs.length).toBe(running.taxLogs.length + 1);
  });

  it('a critical POST_TRIP failure still returns the car but locks it', () => {
    const { db, id } = approvedBooking();
    const running = startDispatch(submitInspection(db, pre(id, allPass()), ctx()).db, { reservationId: id }, ctx()).db;
    const post = { items: failing({ brakes: '제동 시 소음' }), startedAt: '2026-10-25T21:12:00.000Z', ...noGps };
    const out = returnVehicle(running, { reservationId: id, parkingZone: 'Lot A #08', keyReturnedToBox: true, inspection: post }, ctx());
    expect(out.result.ok).toBe(true);
    expect(out.result.message).toMatch(/잠겼습니다/);
    expect(veh8(out.db)).toMatchObject({ status: 'IDLE', isLockedByAdmin: true, lockReason: 'INSPECTION_FAILED' });
  });

  it('returnVehicle refuses without POST_TRIP when policy on', () => {
    const { db, id } = approvedBooking();
    const running = startDispatch(submitInspection(db, pre(id, allPass()), ctx()).db, { reservationId: id }, ctx()).db;
    const out = returnVehicle(running, { reservationId: id, parkingZone: 'Lot A #08', keyReturnedToBox: true }, ctx());
    expect(out.result.ok).toBe(false);
    expect(out.result.message).toMatch(/운행 후 점검/);
    expect(out.db).toBe(running);
    // A bad checklist refuses the whole return (no partial save)
    const bad = returnVehicle(running, { reservationId: id, parkingZone: 'Lot A #08', keyReturnedToBox: true, inspection: { items: allPass().slice(2), startedAt: NOW.toISOString(), ...gps } }, ctx());
    expect(bad.result.ok).toBe(false);
    expect(bad.db).toBe(running);
  });
});

describe('locks and resolution', () => {
  const lockedByInspection = () => {
    const { db, id } = approvedBooking();
    const out = submitInspection(db, pre(id, failing({ tires: '펑크' })), ctx());
    return { db: out.db, inspectionId: latest(out.db).id };
  };

  it('toggleVehicleLock cannot clear INSPECTION_FAILED lock', () => {
    const { db } = lockedByInspection();
    const out = toggleVehicleLock(db, { vehicleId: 'veh-8' }, admin);
    expect(out.result.ok).toBe(false);
    expect(out.result.message).toMatch(/점검 조치 완료/);
    expect(veh8(out.db).isLockedByAdmin).toBe(true);
    // A manual lock is tagged and can still be toggled both ways
    const manual = toggleVehicleLock(createSeedDatabase(), { vehicleId: 'veh-8' }, admin).db;
    expect(veh8(manual)).toMatchObject({ isLockedByAdmin: true, lockReason: 'ADMIN' });
    const unlocked = toggleVehicleLock(manual, { vehicleId: 'veh-8' }, admin).db;
    expect(veh8(unlocked).isLockedByAdmin).toBe(false);
    expect(veh8(unlocked).lockReason).toBeUndefined();
  });

  it('lets a manual unlock through when the referenced inspection no longer exists', () => {
    const { db } = lockedByInspection();
    const orphan = { ...db, inspections: [] };
    expect(toggleVehicleLock(orphan, { vehicleId: 'veh-8' }, admin).result.ok).toBe(true);
  });

  it('resolveInspection unlocks, records resolution, is admin-only', () => {
    const { db, inspectionId } = lockedByInspection();
    // The route refuses non-admins before runAction (see route.test.ts); the registry marks it admin-only
    expect(requiresAdmin('inspection.resolve')).toBe(true);
    expect(requiresAdmin('inspection.submit')).toBe(false);
    const out = resolveInspection(db, { inspectionId, resolution: '타이어 교체 완료' }, admin);
    expect(out.result.ok).toBe(true);
    expect(veh8(out.db).isLockedByAdmin).toBe(false);
    expect(veh8(out.db).lockReason).toBeUndefined();
    expect(veh8(out.db).lockInspectionId).toBeUndefined();
    expect(out.db.inspections.find((i) => i.id === inspectionId)).toMatchObject({ resolution: '타이어 교체 완료', resolvedAt: NOW.toISOString() });
    expect(resolveInspection(out.db, { inspectionId, resolution: 'again' }, admin).result.ok).toBe(false);
    expect(resolveInspection(out.db, { inspectionId: 'missing', resolution: 'x' }, admin).result.ok).toBe(false);
  });

  it('does not unlock a vehicle locked by a different, later inspection', () => {
    const { db, inspectionId } = lockedByInspection();
    const relocked = { ...db, vehicles: db.vehicles.map((v) => (v.id === 'veh-8' ? { ...v, lockInspectionId: 'insp-other' } : v)) };
    const out = resolveInspection(relocked, { inspectionId, resolution: '조치' }, admin);
    expect(out.result.ok).toBe(true);
    expect(veh8(out.db).isLockedByAdmin).toBe(true);
  });

  it('refuses to resolve a clean inspection', () => {
    const { db, id } = approvedBooking();
    const clean = submitInspection(db, pre(id, allPass()), ctx()).db;
    expect(resolveInspection(clean, { inspectionId: latest(clean).id, resolution: 'x' }, admin).result.ok).toBe(false);
  });
});

describe('pruneInspections', () => {
  const rec = (id: string, submittedAt: string, extra: Partial<VehicleInspection> = {}) =>
    ({ id, submittedAt, failedItems: 0, criticalFailed: false, ...extra }) as VehicleInspection;

  it('pruneInspections keeps last 90 days immutably', () => {
    const list = [
      rec('new', '2026-10-20T00:00:00.000Z'),
      rec('edge', '2026-07-27T21:12:22.000Z'), // exactly 90 days before NOW
      rec('old', '2026-07-01T00:00:00.000Z'),
      rec('old-open-lock', '2026-06-01T00:00:00.000Z', { failedItems: 1, criticalFailed: true }),
    ];
    const copy = structuredClone(list);
    expect(pruneInspections(list, NOW).map((r) => r.id)).toEqual(['new', 'edge', 'old-open-lock']);
    expect(list).toEqual(copy);
  });
});

describe('driver identity on inspection.submit (AC-M2b)', () => {
  it("refuses another driver's booking in LIVE mode and accepts the owner's phone", () => {
    const { db: booked, id } = approvedBooking();
    const live = { ...booked, dataMode: 'LIVE' as const };
    const enroll = (db: FleetDatabaseSchema, employeeId: string) => {
      const { token, hash } = createDriverToken(employeeId);
      return { db: issueDriverToken(db, { employeeId, tokenHash: hash }, admin).db, token };
    };
    const a = enroll(live, 'emp-01');
    const b = enroll(a.db, 'emp-06');
    const action = { type: 'inspection.submit' as const, payload: pre(id, allPass()) };
    // emp-01 (driver A) sends emp-06's (driver B) booking: refused even when naming B
    expect(runAction(b.db, action, ctx({ driverToken: a.token })).result.message).toMatch(/본인/);
    expect(runAction(b.db, action, ctx({ driverToken: null })).result.ok).toBe(false);
    expect(runAction(b.db, action, ctx({ driverToken: b.token })).result.ok).toBe(true);
  });
});
