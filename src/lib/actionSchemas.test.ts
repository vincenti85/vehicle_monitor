import { describe, expect, it } from 'vitest';
import { DEFAULT_INSPECTION_TEMPLATE } from '@/domain/inspection';
import { INITIAL_POLICY_CONFIG } from '@/data/initialFleetData';
import { ActionRequestSchema } from './actionSchemas';

const base = { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', notes: '' };
const req = (payload: Record<string, unknown>) => ActionRequestSchema.safeParse({ type: 'dispatch.request', payload: { ...base, ...payload } });
const messages = (r: ReturnType<typeof ActionRequestSchema.safeParse>) => (r.success ? [] : r.error.issues.map((i) => i.message));

const items = () => DEFAULT_INSPECTION_TEMPLATE.map((t) => ({ itemId: t.id, passed: true, note: '' }));
const gps = { startedAt: '2026-10-25T21:11:30.000Z', startLat: 32.69, startLng: -85.33, submitLat: null, submitLng: null, accuracyM: null };
const submit = (payload: Record<string, unknown>) =>
  ActionRequestSchema.safeParse({
    type: 'inspection.submit',
    payload: { reservationId: 'res-1', employeeId: 'emp-06', kind: 'PRE_TRIP', items: items(), ...gps, ...payload },
  });

describe('dispatch.request booking window schema', () => {
  it('schema accepts legacy payload with plannedTimeWindow only', () => {
    expect(req({ plannedTimeWindow: '21:00 ~ 23:00' }).success).toBe(true);
  });

  it('accepts ISO times with an offset or Z and no free text', () => {
    expect(req({ plannedStartAt: '2026-11-05T13:00:00-06:00', plannedEndAt: '2026-11-05T16:00:00-06:00' }).success).toBe(true);
    expect(req({ plannedStartAt: '2026-11-05T19:00:00Z', plannedEndAt: '2026-11-05T22:00:00.000Z' }).success).toBe(true);
  });

  it('rejects end<=start, <15 min, >72 h with Korean reasons (AC-M1)', () => {
    expect(messages(req({ plannedStartAt: '2026-11-05T19:00:00Z', plannedEndAt: '2026-11-05T19:00:00Z' }))).toContain('종료 시각은 시작 시각보다 늦어야 합니다.');
    expect(messages(req({ plannedStartAt: '2026-11-05T19:00:00Z', plannedEndAt: '2026-11-05T19:10:00Z' }))[0]).toMatch(/최소 15분/);
    expect(messages(req({ plannedStartAt: '2026-11-05T19:00:00Z', plannedEndAt: '2026-11-09T19:00:00Z' }))[0]).toMatch(/최대 3일/);
  });

  it('rejects a half window, a missing window and non-ISO times', () => {
    expect(messages(req({ plannedStartAt: '2026-11-05T19:00:00Z' }))[0]).toMatch(/함께/);
    expect(messages(req({}))[0]).toMatch(/예약 시간/);
    expect(req({ plannedStartAt: '11/05 13:00', plannedEndAt: '11/05 16:00' }).success).toBe(false);
    expect(req({ plannedStartAt: '2026-11-05T13:00:00', plannedEndAt: '2026-11-05T16:00:00' }).success).toBe(false); // no zone
  });
});

describe('inspection action schemas', () => {
  it('accepts a full checklist with or without GPS', () => {
    expect(submit({}).success).toBe(true);
    expect(submit({ submitLat: 32.7, submitLng: -85.3, accuracyM: 5 }).success).toBe(true);
  });

  it('schema rejects failed item without note and >20 items', () => {
    const failedNoNote = items().map((i, n) => (n === 0 ? { ...i, passed: false, note: '  ' } : i));
    expect(messages(submit({ items: failedNoNote }))[0]).toMatch(/불합격 항목은 메모/);
    const many = Array.from({ length: 21 }, (_, n) => ({ itemId: `item-${n}`, passed: true, note: '' }));
    expect(submit({ items: many }).success).toBe(false);
    expect(submit({ items: [] }).success).toBe(false);
    expect(submit({ items: items().map((i, n) => (n === 0 ? { ...i, note: 'x'.repeat(201) } : i)) }).success).toBe(false);
  });

  it('rejects duplicate item ids, bad coordinates and unknown kinds', () => {
    expect(submit({ items: [...items(), items()[0]] }).success).toBe(false);
    expect(submit({ submitLat: 91 }).success).toBe(false);
    expect(submit({ kind: 'MID_TRIP' }).success).toBe(false);
    expect(submit({ startedAt: 'yesterday' }).success).toBe(false);
  });

  it('validates resolve and the optional inspection on dispatch.return', () => {
    expect(ActionRequestSchema.safeParse({ type: 'inspection.resolve', payload: { inspectionId: 'i1', resolution: '교체 완료' } }).success).toBe(true);
    expect(ActionRequestSchema.safeParse({ type: 'inspection.resolve', payload: { inspectionId: 'i1', resolution: ' ' } }).success).toBe(false);
    const ret = { reservationId: 'res-1', parkingZone: 'Lot A', keyReturnedToBox: true };
    expect(ActionRequestSchema.safeParse({ type: 'dispatch.return', payload: ret }).success).toBe(true);
    expect(ActionRequestSchema.safeParse({ type: 'dispatch.return', payload: { ...ret, inspection: { items: items(), ...gps } } }).success).toBe(true);
    expect(ActionRequestSchema.safeParse({ type: 'dispatch.return', payload: { ...ret, inspection: { items: [], ...gps } } }).success).toBe(false);
  });
});

describe('policy.update schema', () => {
  const policy = (extra: Record<string, unknown>) =>
    ActionRequestSchema.safeParse({ type: 'policy.update', payload: { policyConfig: { ...INITIAL_POLICY_CONFIG, ...extra } } });

  it('accepts the full default policy and an older policy without the new fields', () => {
    expect(policy({}).success).toBe(true);
    const {
      maxAdvanceBookingDays: _a, bookingBufferMinutes: _b, earlyStartGraceMinutes: _c,
      inspectionTemplate: _d, requirePreTripInspection: _e, requirePostTripInspection: _f, ...older
    } = INITIAL_POLICY_CONFIG;
    expect(ActionRequestSchema.safeParse({ type: 'policy.update', payload: { policyConfig: older } }).success).toBe(true);
  });

  it('range-checks booking values and the inspection template (1-20 items, labels <= 40)', () => {
    expect(policy({ maxAdvanceBookingDays: 0 }).success).toBe(false);
    expect(policy({ bookingBufferMinutes: -1 }).success).toBe(false);
    expect(policy({ earlyStartGraceMinutes: 1.5 }).success).toBe(false);
    expect(policy({ inspectionTemplate: [] }).success).toBe(false);
    expect(policy({ inspectionTemplate: [{ id: 'a', label: 'x'.repeat(41), critical: true }] }).success).toBe(false);
    const twentyOne = Array.from({ length: 21 }, (_, n) => ({ id: `i${n}`, label: `항목${n}`, critical: false }));
    expect(policy({ inspectionTemplate: twentyOne }).success).toBe(false);
    expect(policy({ inspectionTemplate: [{ id: 'a', label: 'A', critical: true }, { id: 'a', label: 'B', critical: false }] }).success).toBe(false);
    expect(policy({ inspectionTemplate: [{ id: 'oil', label: '엔진오일', critical: true }] }).success).toBe(true);
  });
});
