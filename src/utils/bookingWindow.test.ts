import { describe, expect, it } from 'vitest';
import { VehicleReservation } from '@/types/fleet';
import {
  DEFAULT_BOOKING_POLICY,
  bookingPolicyOf,
  formatWindowKo,
  occupancyForDay,
  overlaps,
  toInterval,
  validateWindow,
  withinStartWindow,
  zonedDateTimeToIso,
} from './bookingWindow';

// All instants below were checked with Intl/zoneinfo for America/Chicago:
// 2026-11-01 02:00 CDT fell back to 01:00 CST, so 01:30 happens twice (06:30Z and 07:30Z).
// 2026-03-08 02:00 CST sprang forward to 03:00 CDT, so 02:30 does not exist that day.
const at = (iso: string) => new Date(iso).getTime();
const iv = (start: string, end: string) => ({ startMs: at(start), endMs: at(end) });
const policy = DEFAULT_BOOKING_POLICY;
const NOW = new Date('2026-11-01T16:00:00Z'); // 2026-11-01 10:00 CST (after fall-back)

const booking = (id: string, start: string | undefined, end: string | undefined, extra: Partial<VehicleReservation> = {}) =>
  ({
    id,
    vehicleId: 'veh-8',
    stage: 'APPROVED',
    employeeName: '김민수 과장 (M.S. Kim)',
    plannedTimeWindow: 'legacy text',
    plannedStartAt: start,
    plannedEndAt: end,
    ...extra,
  }) as VehicleReservation;

describe('overlaps', () => {
  const existing = iv('2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z'); // 10:00-12:00 CST

  it('overlaps is half-open: touching intervals do not overlap', () => {
    expect(overlaps(existing, iv('2026-11-05T18:00:00Z', '2026-11-05T19:00:00Z'), 0)).toBe(false);
    expect(overlaps(iv('2026-11-05T15:00:00Z', '2026-11-05T16:00:00Z'), existing, 0)).toBe(false);
    expect(overlaps(existing, iv('2026-11-05T17:59:00Z', '2026-11-05T19:00:00Z'), 0)).toBe(true);
  });

  it('overlaps applies buffer on both sides', () => {
    // after: 12:10 start is inside 12:00 + 15 min; 12:15 is the first free minute
    expect(overlaps(iv('2026-11-05T18:10:00Z', '2026-11-05T19:00:00Z'), existing, 15)).toBe(true);
    expect(overlaps(iv('2026-11-05T18:15:00Z', '2026-11-05T19:00:00Z'), existing, 15)).toBe(false);
    // before: ending 09:50 is inside 10:00 - 15 min; ending 09:45 is free
    expect(overlaps(iv('2026-11-05T15:00:00Z', '2026-11-05T15:50:00Z'), existing, 15)).toBe(true);
    expect(overlaps(iv('2026-11-05T15:00:00Z', '2026-11-05T15:45:00Z'), existing, 15)).toBe(false);
  });
});

describe('validateWindow', () => {
  it('validateWindow rejects end<=start, <15min, >72h', () => {
    expect(validateWindow('2026-11-05T19:00:00Z', '2026-11-05T19:00:00Z', NOW, policy)).toMatch(/종료 시각은 시작 시각보다/);
    expect(validateWindow('2026-11-05T19:00:00Z', '2026-11-05T19:14:00Z', NOW, policy)).toMatch(/최소 15분/);
    expect(validateWindow('2026-11-05T19:00:00Z', '2026-11-08T19:01:00Z', NOW, policy)).toMatch(/최대 3일/);
    expect(validateWindow('2026-11-05T19:00:00Z', '2026-11-08T19:00:00Z', NOW, policy)).toBeNull();
    expect(validateWindow('not-a-date', '2026-11-05T19:00:00Z', NOW, policy)).toMatch(/형식/);
  });

  it('validateWindow enforces max advance days and 5-minute past grace', () => {
    // AC-M2 with now = 11/01 10:00 local
    expect(validateWindow('2026-11-15T16:01:00Z', '2026-11-15T17:00:00Z', NOW, policy)).toMatch(/14일 이내/);
    expect(validateWindow('2026-11-01T15:50:00Z', '2026-11-01T17:00:00Z', NOW, policy)).toMatch(/지난 시각/);
    expect(validateWindow('2026-11-15T16:00:00Z', '2026-11-15T17:00:00Z', NOW, policy)).toBeNull();
    expect(validateWindow('2026-11-01T15:56:00Z', '2026-11-01T17:00:00Z', NOW, policy)).toBeNull();
    expect(validateWindow('2026-11-04T16:00:00Z', '2026-11-04T17:00:00Z', NOW, { ...policy, maxAdvanceBookingDays: 2 })).toMatch(/2일 이내/);
  });

  it('validateWindow is correct across DST fall-back (2026-11-01)', () => {
    const before = new Date('2026-11-01T05:00:00Z'); // 00:00 CDT
    // 01:30 CDT -> 01:30 CST is 60 real minutes although the wall clock shows 0
    expect(validateWindow('2026-11-01T01:30:00-05:00', '2026-11-01T01:30:00-06:00', before, policy)).toBeNull();
    // 01:50 CDT -> 01:00 CST looks backwards on the wall clock but is 10 real minutes: too short
    expect(validateWindow('2026-11-01T01:50:00-05:00', '2026-11-01T01:00:00-06:00', before, policy)).toMatch(/최소 15분/);
    // 01:30 CST -> 01:30 CDT is backwards in real time
    expect(validateWindow('2026-11-01T01:30:00-06:00', '2026-11-01T01:30:00-05:00', before, policy)).toMatch(/종료 시각은 시작 시각보다/);
  });
});

describe('zonedDateTimeToIso (America/Chicago input)', () => {
  it('converts local wall time to UTC on normal days in both offsets', () => {
    expect(zonedDateTimeToIso('2026-11-05', '13:00')).toBe('2026-11-05T19:00:00.000Z');
    expect(zonedDateTimeToIso('2026-10-25', '16:12')).toBe('2026-10-25T21:12:00.000Z');
  });

  it('picks the first (CDT) occurrence of the repeated 01:30 on 2026-11-01', () => {
    expect(zonedDateTimeToIso('2026-11-01', '01:30')).toBe('2026-11-01T06:30:00.000Z');
    expect(zonedDateTimeToIso('2026-11-01', '02:00')).toBe('2026-11-01T08:00:00.000Z');
  });

  it('moves a skipped spring-forward time (2026-03-08 02:30) one hour later', () => {
    expect(zonedDateTimeToIso('2026-03-08', '02:30')).toBe('2026-03-08T08:30:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(zonedDateTimeToIso('2026-13-01', '10:00')).toBeNull();
    expect(zonedDateTimeToIso('2026-11-05', '25:00')).toBeNull();
    expect(zonedDateTimeToIso('', '')).toBeNull();
  });
});

describe('formatWindowKo', () => {
  it('formatWindowKo renders legacy plannedTimeWindow text', () => {
    expect(formatWindowKo('2026-11-05T19:00:00Z', '2026-11-05T22:00:00Z')).toBe('11/05 13:00 ~ 16:00');
    expect(formatWindowKo('2026-11-05T19:00:00Z', '2026-11-06T15:00:00Z')).toBe('11/05 13:00 ~ 11/06 09:00');
  });
});

describe('toInterval and legacy rows', () => {
  it('returns null for legacy or unparsable times instead of throwing', () => {
    expect(toInterval(booking('r1', undefined, undefined))).toBeNull();
    expect(toInterval(booking('r1', '2026-11-05T19:00:00Z', undefined))).toBeNull();
    expect(toInterval(booking('r1', '21:00 ~ 23:00', 'garbage'))).toBeNull();
    expect(toInterval(booking('r1', '2026-11-05T19:00:00Z', '2026-11-05T22:00:00Z'))).toEqual(iv('2026-11-05T19:00:00Z', '2026-11-05T22:00:00Z'));
  });
});

describe('withinStartWindow (AC-M5)', () => {
  const res = booking('r1', '2026-11-05T19:00:00Z', '2026-11-05T22:00:00Z'); // 13:00-16:00 CST
  it('allows departure from 30 minutes before start until the planned end', () => {
    expect(withinStartWindow(res, new Date('2026-11-05T18:20:00Z'), policy)).toMatch(/12:30부터 출발할 수 있습니다/);
    expect(withinStartWindow(res, new Date('2026-11-05T18:30:00Z'), policy)).toBeNull();
    expect(withinStartWindow(res, new Date('2026-11-05T22:00:00Z'), policy)).toBeNull();
    expect(withinStartWindow(res, new Date('2026-11-05T22:01:00Z'), policy)).toMatch(/종료 시각/);
  });
  it('does not restrict legacy bookings', () => {
    expect(withinStartWindow(booking('r2', undefined, undefined), NOW, policy)).toBeNull();
  });
});

describe('occupancyForDay (AC-M7 bar data)', () => {
  const list = [
    booking('a', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z'), // 10:00-12:00
    booking('b', '2026-11-05T22:00:00Z', '2026-11-06T08:00:00Z', { stage: 'REQUESTED' }), // 16:00-02:00 next day
    booking('c', '2026-11-05T19:00:00Z', '2026-11-05T20:00:00Z', { stage: 'REJECTED' }),
    booking('d', '2026-11-05T19:00:00Z', '2026-11-05T20:00:00Z', { vehicleId: 'veh-2' }),
    booking('legacy', undefined, undefined, { stage: 'REQUESTED' }),
  ];

  it('clips open bookings to the local day and lists legacy blockers separately', () => {
    const day = occupancyForDay(list, 'veh-8', '2026-11-05');
    expect(day.dayMinutes).toBe(1440);
    expect(day.segments.map((s) => [s.reservationId, s.startMin, s.endMin, s.who])).toEqual([
      ['a', 600, 720, '김민수 과장'],
      ['b', 960, 1440, '김민수 과장'],
    ]);
    expect(day.legacyBlockers.map((r) => r.id)).toEqual(['legacy']);
    expect(day.segments[1]).toMatchObject({ startLabel: '16:00', endLabel: '24:00' });
  });

  it('has 25 hours on the fall-back day', () => {
    const day = occupancyForDay([booking('x', '2026-11-01T07:30:00Z', '2026-11-01T08:30:00Z')], 'veh-8', '2026-11-01');
    expect(day.dayMinutes).toBe(1500);
    // 01:30 CST is 150 real minutes after local midnight (00:00 CDT)
    expect(day.segments[0]).toMatchObject({ startMin: 150, endMin: 210, startLabel: '01:30', endLabel: '02:30' });
  });
});

describe('bookingPolicyOf', () => {
  it('fills missing values from defaults (older stored policies)', () => {
    expect(bookingPolicyOf({})).toEqual(DEFAULT_BOOKING_POLICY);
    expect(bookingPolicyOf({ bookingBufferMinutes: 0 }).bookingBufferMinutes).toBe(0);
    expect(DEFAULT_BOOKING_POLICY).toEqual({ maxAdvanceBookingDays: 14, bookingBufferMinutes: 15, earlyStartGraceMinutes: 30 });
  });
});
