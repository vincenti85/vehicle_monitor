import { describe, expect, it } from 'vitest';
import { Vehicle, VehicleReservation } from '@/types/fleet';
import { CONFIRM_BLOCKING_STAGES, CREATE_BLOCKING_STAGES, findDispatchConflict } from './dispatchRules';

const veh = (extra: Partial<Vehicle> = {}) =>
  ({ id: 'veh-8', fleetNumber: 8, plateNumber: 'AL A22A20', status: 'IDLE', ...extra }) as Vehicle;
const res = (id: string, stage: VehicleReservation['stage'], extra: Partial<VehicleReservation> = {}) =>
  ({
    id,
    vehicleId: 'veh-8',
    stage,
    employeeName: '한소희 대리 (S.H. Han)',
    plannedTimeWindow: '21:00 ~ 23:00',
    ...extra,
  }) as VehicleReservation;

describe('findDispatchConflict', () => {
  it('allows a parked vehicle with only closed reservations', () => {
    expect(findDispatchConflict(veh(), [res('r0', 'RETURNED'), res('r1', 'REJECTED')], CREATE_BLOCKING_STAGES)).toBeNull();
  });

  it('blocks a new request when the vehicle already has a pending one', () => {
    const msg = findDispatchConflict(veh(), [res('r1', 'REQUESTED')], CREATE_BLOCKING_STAGES);
    expect(msg).toMatch(/#8호차\(AL A22A20\)는 이미 배차가 진행 중/);
    expect(msg).toMatch(/한소희 대리 · 승인대기 · 21:00 ~ 23:00/);
  });

  it('blocks a new request when approved or in use', () => {
    expect(findDispatchConflict(veh(), [res('r1', 'APPROVED')], CREATE_BLOCKING_STAGES)).not.toBeNull();
    expect(findDispatchConflict(veh(), [res('r1', 'IN_USE')], CREATE_BLOCKING_STAGES)).not.toBeNull();
  });

  it('ignores reservations on other vehicles', () => {
    expect(findDispatchConflict(veh(), [res('r1', 'REQUESTED', { vehicleId: 'veh-2' })], CREATE_BLOCKING_STAGES)).toBeNull();
  });

  it('blocks a vehicle that is not parked even without a reservation', () => {
    expect(findDispatchConflict(veh({ status: 'UNAUTHORIZED' }), [], CREATE_BLOCKING_STAGES)).toMatch(/미승인 운행중/);
    expect(findDispatchConflict(veh({ status: 'INCIDENT' }), [], CREATE_BLOCKING_STAGES)).toMatch(/사고 처리중/);
  });

  it('approve: another pending request does not block, a confirmed one does', () => {
    expect(findDispatchConflict(veh(), [res('r1', 'REQUESTED'), res('r2', 'REQUESTED')], CONFIRM_BLOCKING_STAGES, 'r1')).toBeNull();
    expect(findDispatchConflict(veh(), [res('r1', 'APPROVED'), res('r2', 'REQUESTED')], CONFIRM_BLOCKING_STAGES, 'r2')).toMatch(/승인완료/);
  });

  it('approve/start ignores the reservation itself', () => {
    expect(findDispatchConflict(veh(), [res('r1', 'APPROVED')], CONFIRM_BLOCKING_STAGES, 'r1')).toBeNull();
  });
});
