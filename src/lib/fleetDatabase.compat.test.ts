// Backward compatibility of stored documents (1.2.0 -> 1.3.0) and what leaves the server.
import { describe, expect, it } from 'vitest';
import { DEFAULT_INSPECTION_TEMPLATE } from '@/domain/inspection';
import { updatePolicy } from '@/domain/admin';
import { requestDispatch } from '@/domain/dispatch';
import { toClientView } from './clientView';
import { clearDemoState, createSeedDatabase, parseDatabase } from './fleetDatabase';
import type { FleetDatabaseSchema } from './fleetDatabase';

/** A document as written by 1.2.0: no inspections, no booking/inspection policy, free-text windows only. */
function legacyDocument(): Record<string, unknown> {
  const seed = createSeedDatabase();
  const {
    maxAdvanceBookingDays: _a, bookingBufferMinutes: _b, earlyStartGraceMinutes: _c,
    inspectionTemplate: _d, requirePreTripInspection: _e, requirePostTripInspection: _f, ...policyConfig
  } = seed.policyConfig;
  const { inspections: _i, ...rest } = seed;
  return { ...rest, version: '1.2.0', policyConfig };
}

describe('parseDatabase', () => {
  it('parseDatabase fills booking policy defaults immutably', () => {
    const doc = legacyDocument();
    const json = JSON.stringify(doc);
    const db = parseDatabase(json);
    expect(db.policyConfig).toMatchObject({ maxAdvanceBookingDays: 14, bookingBufferMinutes: 15, earlyStartGraceMinutes: 30 });
    // Stored values win over defaults
    const custom = parseDatabase(JSON.stringify({ ...doc, policyConfig: { ...(doc.policyConfig as object), bookingBufferMinutes: 0 } }));
    expect(custom.policyConfig.bookingBufferMinutes).toBe(0);
    expect(custom.policyConfig.autoApproveWhenManagerAway).toBe(false);
    expect(JSON.stringify(doc)).toBe(json);
  });

  it('parseDatabase defaults inspections and template for legacy docs', () => {
    const db = parseDatabase(JSON.stringify(legacyDocument()));
    expect(db.inspections).toEqual([]);
    expect(db.policyConfig).toMatchObject({ inspectionTemplate: DEFAULT_INSPECTION_TEMPLATE, requirePreTripInspection: true, requirePostTripInspection: true });
    expect(db.version).toBe('1.2.0'); // the stored version is reported as-is; the next write keeps the filled fields
  });

  it('loads free-text and malformed time windows as legacy bookings without crashing', () => {
    const doc = legacyDocument();
    const broken = {
      ...(doc.reservations as object[])[0],
      id: 'res-broken',
      vehicleId: 'veh-8',
      plannedTimeWindow: '오후 반차 후 ~ 퇴근 전',
      plannedStartAt: 'tomorrow afternoon',
      plannedEndAt: null,
    };
    const db = parseDatabase(JSON.stringify({ ...doc, reservations: [broken, ...(doc.reservations as object[])] }));
    expect(db.reservations[0].plannedTimeWindow).toBe('오후 반차 후 ~ 퇴근 전');
    // Treated like any untimed open booking: the vehicle stays blocked with the legacy message
    const out = requestDispatch(
      db,
      { employeeId: 'emp-01', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'X', plannedStartAt: '2026-11-05T19:00:00Z', plannedEndAt: '2026-11-05T20:00:00Z', notes: '' },
      { now: new Date('2026-11-01T16:00:00Z'), isAdmin: false }
    );
    expect(out.result.ok).toBe(false);
    expect(out.result.message).toMatch(/이미 배차가 진행 중입니다 — .* · 오후 반차 후 ~ 퇴근 전/);
  });

  it('still rejects documents that are not JSON', () => {
    expect(() => parseDatabase('{oops')).toThrow(/not valid JSON/);
  });

  it('seeds new databases as 1.3.0 with empty inspections', () => {
    const seed = createSeedDatabase();
    expect(seed.version).toBe('1.3.0');
    expect(seed.inspections).toEqual([]);
  });
});

describe('policy.update keeps fields an older client does not send', () => {
  it('merges onto the stored policy', () => {
    const db: FleetDatabaseSchema = { ...createSeedDatabase() };
    const stored = { ...db, policyConfig: { ...db.policyConfig, bookingBufferMinutes: 5, requirePreTripInspection: false } };
    const { bookingBufferMinutes: _b, requirePreTripInspection: _r, ...older } = stored.policyConfig;
    const out = updatePolicy(stored, { policyConfig: { ...older, autoApproveWhenManagerAway: true } }, { now: new Date(), isAdmin: true });
    expect(out.db.policyConfig).toMatchObject({ bookingBufferMinutes: 5, requirePreTripInspection: false, autoApproveWhenManagerAway: true });
  });
});

describe('inspections in client views and demo cleanup', () => {
  const withInspection = (): FleetDatabaseSchema => ({
    ...createSeedDatabase(),
    inspections: [
      {
        id: 'insp-1', kind: 'POST_TRIP', reservationId: 'res-1', vehicleId: 'veh-8', employeeId: 'emp-06',
        items: [{ itemId: 'body-damage', passed: false, note: '뒷범퍼 긁힘' }],
        failedItems: 1, criticalFailed: false, startedAt: 'x', submittedAt: 'y',
        startLat: 32.69, startLng: -85.33, submitLat: 32.7, submitLng: -85.3, accuracyM: 5, gpsUnavailable: false,
      },
    ],
  });

  it('hides notes and coordinates from non-admins but keeps the pass/fail summary', () => {
    const anon = toClientView(withInspection(), { isAdmin: false }).inspections[0];
    expect(anon).toMatchObject({ id: 'insp-1', failedItems: 1, startLat: null, submitLat: null, accuracyM: null });
    expect(anon.items[0]).toEqual({ itemId: 'body-damage', passed: false, note: '' });
    const adminView = toClientView(withInspection(), { isAdmin: true }).inspections[0];
    expect(adminView.items[0].note).toBe('뒷범퍼 긁힘');
    expect(adminView.submitLat).toBe(32.7);
  });

  it('clears sample inspections when switching to LIVE and releases inspection locks', () => {
    const db = withInspection();
    const locked = { ...db, vehicles: db.vehicles.map((v) => (v.id === 'veh-8' ? { ...v, isLockedByAdmin: true, lockReason: 'INSPECTION_FAILED' as const, lockInspectionId: 'insp-1' } : v)) };
    const live = clearDemoState(locked, false).db;
    expect(live.inspections).toEqual([]);
    expect(live.vehicles.find((v) => v.id === 'veh-8')).toMatchObject({ isLockedByAdmin: false });
    expect(live.vehicles.find((v) => v.id === 'veh-8')?.lockReason).toBeUndefined();
  });
});
