// Time-window booking rules. Instants are stored as UTC ISO strings; people enter and read
// them in fleet local time (America/Chicago), so every wall-clock conversion goes through
// FLEET_TIME_ZONE and durations are measured in real elapsed time (DST-safe).
import { localDate, localTime } from '@/domain/clock';
import { ReservationStage, SystemPolicyConfig, VehicleReservation } from '@/types/fleet';

export interface BookingPolicy {
  maxAdvanceBookingDays: number;
  bookingBufferMinutes: number;
  earlyStartGraceMinutes: number;
}

/** Half-open real-time interval [startMs, endMs). */
export interface Interval {
  startMs: number;
  endMs: number;
}

export const DEFAULT_BOOKING_POLICY: Readonly<BookingPolicy> = Object.freeze({
  maxAdvanceBookingDays: 14,
  bookingBufferMinutes: 15,
  earlyStartGraceMinutes: 30,
});

export const MIN_BOOKING_MINUTES = 15;
export const MAX_BOOKING_HOURS = 72;
/** A start up to this many minutes in the past is still accepted (form filled a bit slowly). */
export const PAST_START_GRACE_MINUTES = 5;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Booking values from a stored policy, defaulting any field an older document lacks. */
export function bookingPolicyOf(cfg: Partial<SystemPolicyConfig> | undefined): BookingPolicy {
  return {
    maxAdvanceBookingDays: cfg?.maxAdvanceBookingDays ?? DEFAULT_BOOKING_POLICY.maxAdvanceBookingDays,
    bookingBufferMinutes: cfg?.bookingBufferMinutes ?? DEFAULT_BOOKING_POLICY.bookingBufferMinutes,
    earlyStartGraceMinutes: cfg?.earlyStartGraceMinutes ?? DEFAULT_BOOKING_POLICY.earlyStartGraceMinutes,
  };
}

const parseInstant = (iso: unknown): number | null => {
  if (typeof iso !== 'string' || !iso.includes('T')) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/** The booking's real-time interval, or null for legacy (free-text) or unparsable rows. */
export function toInterval(res: Pick<VehicleReservation, 'plannedStartAt' | 'plannedEndAt'>): Interval | null {
  const startMs = parseInstant(res.plannedStartAt);
  const endMs = parseInstant(res.plannedEndAt);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  return { startMs, endMs };
}

/** True when a, widened by the buffer on both sides, intersects b. Touching edges do not overlap. */
export function overlaps(a: Interval, b: Interval, bufferMinutes: number): boolean {
  const buffer = bufferMinutes * MINUTE_MS;
  return a.startMs - buffer < b.endMs && b.startMs < a.endMs + buffer;
}

/** Shape rules that need no clock (AC-M1): order, minimum and maximum length. */
export function windowShapeError(startMs: number, endMs: number): string | null {
  if (endMs <= startMs) return '종료 시각은 시작 시각보다 늦어야 합니다.';
  if (endMs - startMs < MIN_BOOKING_MINUTES * MINUTE_MS) return `예약은 최소 ${MIN_BOOKING_MINUTES}분 이상이어야 합니다.`;
  if (endMs - startMs > MAX_BOOKING_HOURS * 60 * MINUTE_MS) return '예약은 최대 3일(72시간)까지 가능합니다.';
  return null;
}

/** Full request check (AC-M1, AC-M2). The advance limit counts real elapsed days. */
export function validateWindow(startIso: string, endIso: string, now: Date, policy: BookingPolicy): string | null {
  const startMs = parseInstant(startIso);
  const endMs = parseInstant(endIso);
  if (startMs === null || endMs === null) return '시작·종료 시각 형식이 올바르지 않습니다.';
  const shape = windowShapeError(startMs, endMs);
  if (shape) return shape;
  if (startMs < now.getTime() - PAST_START_GRACE_MINUTES * MINUTE_MS) return '이미 지난 시각으로는 예약할 수 없습니다.';
  if (startMs > now.getTime() + policy.maxAdvanceBookingDays * DAY_MS) {
    return `시작 시각은 지금부터 ${policy.maxAdvanceBookingDays}일 이내여야 합니다.`;
  }
  return null;
}

/** Departure check for an approved booking (AC-M5); legacy bookings are not restricted. */
export function withinStartWindow(
  res: Pick<VehicleReservation, 'plannedStartAt' | 'plannedEndAt'>,
  now: Date,
  policy: BookingPolicy
): string | null {
  const interval = toInterval(res);
  if (!interval) return null;
  const earliest = interval.startMs - policy.earlyStartGraceMinutes * MINUTE_MS;
  if (now.getTime() < earliest) return `${localTime(new Date(earliest)).slice(0, 5)}부터 출발할 수 있습니다.`;
  if (now.getTime() > interval.endMs) return '예약 종료 시각이 지나 출발할 수 없습니다. 새로 신청하세요.';
  return null;
}

const monthDay = (ms: number) => localDate(new Date(ms)).slice(5).replace('-', '/');
const hourMinute = (ms: number) => localTime(new Date(ms)).slice(0, 5);

/** Display / tax-log text, e.g. "11/05 13:00 ~ 16:00" or "11/05 13:00 ~ 11/06 09:00". */
export function formatWindowKo(startIso: string, endIso: string): string {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  const endText = localDate(new Date(startMs)) === localDate(new Date(endMs)) ? hourMinute(endMs) : `${monthDay(endMs)} ${hourMinute(endMs)}`;
  return `${monthDay(startMs)} ${hourMinute(startMs)} ~ ${endText}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Fleet-local wall time -> UTC ISO. A repeated time on the fall-back day resolves to its
 * first occurrence (daylight time); a skipped spring-forward time moves later by the gap.
 */
export function zonedDateTimeToIso(date: string, time: string): string | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const wallAsUtc = Date.UTC(y, m - 1, day, Number(t[1]), Number(t[2]));
  // Reject dates that Date.UTC would roll over (2026-02-30, month 13)
  if (new Date(wallAsUtc).toISOString().slice(0, 10) !== date) return null;
  const offsetAt = (ms: number) => Date.parse(`${localDate(new Date(ms))}T${localTime(new Date(ms))}Z`) - ms;
  const candidates = [offsetAt(wallAsUtc - DAY_MS), offsetAt(wallAsUtc + DAY_MS)]
    .map((offset) => wallAsUtc - offset)
    .filter((ms) => localDate(new Date(ms)) === date && localTime(new Date(ms)).slice(0, 5) === time)
    .sort((a, b) => a - b);
  const resolved = candidates[0] ?? wallAsUtc - offsetAt(wallAsUtc - DAY_MS);
  return new Date(resolved).toISOString();
}

/** The next calendar date after YYYY-MM-DD. */
export function nextDate(date: string): string {
  const d = DATE_RE.exec(date);
  if (!d) return date;
  return new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]) + 1)).toISOString().slice(0, 10);
}

export interface OccupancySegment {
  reservationId: string;
  stage: ReservationStage;
  who: string;
  /** Minutes after local midnight (a fall-back day has 1500). */
  startMin: number;
  endMin: number;
  /** Wall-clock labels (correct on DST days, where minutes != clock time). */
  startLabel: string;
  endLabel: string;
}

export interface DayOccupancy {
  dayMinutes: number;
  segments: OccupancySegment[];
  /** Open bookings without times: they block the whole vehicle (legacy rule). */
  legacyBlockers: VehicleReservation[];
}

const OPEN_STAGES: ReadonlySet<ReservationStage> = new Set<ReservationStage>(['REQUESTED', 'APPROVED', 'IN_USE']);

/** Open bookings of one vehicle on one local day, for the occupancy bar (AC-M7). */
export function occupancyForDay(reservations: VehicleReservation[], vehicleId: string, day: string): DayOccupancy {
  const dayStart = Date.parse(zonedDateTimeToIso(day, '00:00') ?? '');
  const dayEnd = Date.parse(zonedDateTimeToIso(nextDate(day), '00:00') ?? '');
  const open = reservations.filter((r) => r.vehicleId === vehicleId && OPEN_STAGES.has(r.stage));
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd)) return { dayMinutes: 0, segments: [], legacyBlockers: [] };
  const segments = open
    .map((r) => ({ r, interval: toInterval(r) }))
    .filter(({ interval }) => interval && interval.startMs < dayEnd && interval.endMs > dayStart)
    .map(({ r, interval }) => ({
      reservationId: r.id,
      stage: r.stage,
      who: r.employeeName.split(' (')[0],
      startMin: Math.round((Math.max(interval!.startMs, dayStart) - dayStart) / MINUTE_MS),
      endMin: Math.round((Math.min(interval!.endMs, dayEnd) - dayStart) / MINUTE_MS),
      startLabel: hourMinute(Math.max(interval!.startMs, dayStart)),
      endLabel: interval!.endMs >= dayEnd ? '24:00' : hourMinute(interval!.endMs),
    }))
    .sort((a, b) => a.startMin - b.startMin);
  return {
    dayMinutes: Math.round((dayEnd - dayStart) / MINUTE_MS),
    segments,
    legacyBlockers: open.filter((r) => toInterval(r) === null),
  };
}
