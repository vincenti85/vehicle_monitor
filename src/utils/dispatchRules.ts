// One active dispatch per vehicle. Time windows are free text, so overlap cannot be
// computed; any open reservation (or a vehicle not parked) blocks another one.
import { Vehicle, VehicleReservation } from '@/types/fleet';

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

/**
 * Returns a user-facing reason when the vehicle cannot take another dispatch, else null.
 * ignoreReservationId excludes the reservation being approved/started itself.
 */
export function findDispatchConflict(
  vehicle: Vehicle,
  reservations: VehicleReservation[],
  blockingStages: ReadonlySet<Stage>,
  ignoreReservationId?: string
): string | null {
  const unit = `#${vehicle.fleetNumber}호차(${vehicle.plateNumber})`;
  const other = reservations.find(
    (r) =>
      r.vehicleId === vehicle.id && r.id !== ignoreReservationId && blockingStages.has(r.stage)
  );
  if (other) {
    return `${unit}는 이미 배차가 진행 중입니다 — ${shortName(other.employeeName)} · ${STAGE_LABEL[other.stage]} · ${other.plannedTimeWindow}. 반납 후 신청하거나 다른 차량을 선택하세요.`;
  }
  if (vehicle.status !== 'IDLE') {
    return `${unit}는 현재 ${VEHICLE_STATUS_LABEL[vehicle.status]} 상태라 배차할 수 없습니다. 차고지 반납 후 다시 시도하세요.`;
  }
  return null;
}
