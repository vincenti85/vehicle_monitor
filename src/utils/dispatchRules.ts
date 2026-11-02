// Dispatch conflicts per vehicle. A booking with ISO times (plannedStartAt/EndAt) only
// conflicts with open bookings whose time overlaps (plus a buffer). Legacy rows have free-text
// windows, so overlap cannot be computed: any open legacy reservation still blocks everything,
// and a request without times keeps the old one-open-dispatch-per-vehicle rule.
import { Vehicle, VehicleReservation } from '@/types/fleet';
import { Interval, formatWindowKo, overlaps, toInterval } from './bookingWindow';

export interface DispatchResult {
  ok: boolean;
  message: string;
}

type Stage = VehicleReservation['stage'];

/** Creating a request or a 1-second start: any open reservation conflicts. */
export const CREATE_BLOCKING_STAGES: ReadonlySet<Stage> = new Set<Stage>(['REQUESTED', 'APPROVED', 'IN_USE']);
/** Approving or starting: only a confirmed or running reservation conflicts. */
export const CONFIRM_BLOCKING_STAGES: ReadonlySet<Stage> = new Set<Stage>(['APPROVED', 'IN_USE']);

const STAGE_LABEL: Record<Stage, string> = {
  REQUESTED: '승인대기',
  APPROVED: '승인완료',
  IN_USE: '운행중',
  RETURNED: '반납완료',
  REJECTED: '반려',
};

const VEHICLE_STATUS_LABEL: Record<Vehicle['status'], string> = {
  IDLE: '대기',
  AUTHORIZED: '운행중',
  UNAUTHORIZED: '미승인 운행중',
  INCIDENT: '사고 처리중',
};

const shortName = (name: string) => name.split(' (')[0];

export interface WindowCheck {
  /** The booking being created/approved/started; omit for the legacy rule. */
  window: Interval;
  bufferMinutes: number;
  now: Date;
}

/**
 * Returns a user-facing reason when the vehicle cannot take another dispatch, else null.
 * ignoreReservationId excludes the reservation being approved/started itself.
 */
export function findDispatchConflict(
  vehicle: Vehicle,
  reservations: VehicleReservation[],
  blockingStages: ReadonlySet<Stage>,
  ignoreReservationId?: string,
  check?: WindowCheck
): string | null {
  const unit = `#${vehicle.fleetNumber}호차(${vehicle.plateNumber})`;
  const others = reservations.filter(
    (r) => r.vehicleId === vehicle.id && r.id !== ignoreReservationId && blockingStages.has(r.stage)
  );
  const legacyBlock = (other: VehicleReservation) =>
    `${unit}는 이미 배차가 진행 중입니다 — ${shortName(other.employeeName)} · ${STAGE_LABEL[other.stage]} · ${other.plannedTimeWindow}. 반납 후 신청하거나 다른 차량을 선택하세요.`;
  if (!check) {
    if (others[0]) return legacyBlock(others[0]);
  } else {
    const clash = others.find((r) => clashes(r, check));
    if (clash) {
      const interval = toInterval(clash);
      return interval
        ? `${unit}는 ${formatWindowKo(clash.plannedStartAt!, clash.plannedEndAt!)}(+버퍼 ${check.bufferMinutes}분) ${shortName(clash.employeeName)} ${STAGE_LABEL[clash.stage]}와 겹칩니다. 다른 시간이나 차량을 선택하세요.`
        : legacyBlock(clash);
    }
  }
  // The vehicle's live state only matters for a booking that overlaps the present (AC-M4)
  const now = check && { startMs: check.now.getTime(), endMs: check.now.getTime() };
  const touchesNow = !check || overlaps(check.window, now!, check.bufferMinutes);
  if (vehicle.status !== 'IDLE' && touchesNow) {
    return `${unit}는 현재 ${VEHICLE_STATUS_LABEL[vehicle.status]} 상태라 배차할 수 없습니다. 차고지 반납 후 다시 시도하세요.`;
  }
  return null;
}

/** Legacy rows always clash; a trip still out past its planned end occupies the car until now. */
function clashes(other: VehicleReservation, check: WindowCheck): boolean {
  const interval = toInterval(other);
  if (!interval) return true;
  const effective =
    other.stage === 'IN_USE' ? { ...interval, endMs: Math.max(interval.endMs, check.now.getTime()) } : interval;
  return overlaps(check.window, effective, check.bufferMinutes);
}
