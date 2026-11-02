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

describe('findDispatchConflict with booking windows', () => {
  // 11/05 10:00-12:00 CST booked; buffer 15 min; now = 11/01 10:00 CST
  const NOW = new Date('2026-11-01T16:00:00Z');
  const timed = (id: string, stage: VehicleReservation['stage'], start: string, end: string) =>
    res(id, stage, { plannedStartAt: start, plannedEndAt: end, plannedTimeWindow: '11/05 10:00 ~ 12:00' });
  const win = (start: string, end: string) => ({ startMs: new Date(start).getTime(), endMs: new Date(end).getTime() });
  const opts = (start: string, end: string) => ({ window: win(start, end), bufferMinutes: 15, now: NOW });
  const booked = [timed('r1', 'APPROVED', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z')];

  it('findDispatchConflict: non-overlapping future bookings coexist', () => {
    expect(findDispatchConflict(veh(), booked, CREATE_BLOCKING_STAGES, undefined, opts('2026-11-05T18:15:00Z', '2026-11-05T19:00:00Z'))).toBeNull();
    expect(findDispatchConflict(veh(), booked, CREATE_BLOCKING_STAGES, undefined, opts('2026-11-06T16:00:00Z', '2026-11-06T18:00:00Z'))).toBeNull();
  });

  it('refuses a window inside the buffer and names the other booking', () => {
    const msg = findDispatchConflict(veh(), booked, CREATE_BLOCKING_STAGES, undefined, opts('2026-11-05T18:10:00Z', '2026-11-05T19:00:00Z'));
    expect(msg).toMatch(/#8호차\(AL A22A20\)는 11\/05 10:00 ~ 12:00\(\+버퍼 15분\) 한소희 대리 승인완료와 겹칩니다/);
  });

  it('ignores closed bookings in the same slot (AC-M3b)', () => {
    const closed = [timed('r1', 'REJECTED', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z'), timed('r2', 'RETURNED', '2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z')];
    expect(findDispatchConflict(veh(), closed, CREATE_BLOCKING_STAGES, undefined, opts('2026-11-05T16:00:00Z', '2026-11-05T18:00:00Z'))).toBeNull();
  });

  it('findDispatchConflict: legacy reservation without times still blocks', () => {
    const msg = findDispatchConflict(veh(), [res('r9', 'REQUESTED')], CREATE_BLOCKING_STAGES, undefined, opts('2026-11-10T16:00:00Z', '2026-11-10T17:00:00Z'));
    expect(msg).toMatch(/이미 배차가 진행 중입니다 — 한소희 대리 · 승인대기 · 21:00 ~ 23:00/);
  });

  it('a request without a window keeps the old rule against timed bookings', () => {
    expect(findDispatchConflict(veh(), booked, CREATE_BLOCKING_STAGES)).toMatch(/이미 배차가 진행 중/);
  });

  it('findDispatchConflict: vehicle IN_USE blocks only windows overlapping now', () => {
    const driving = veh({ status: 'AUTHORIZED' });
    // today 09:00-11:00 trip running; tomorrow 09:00-10:00 is fine
    const trip = [timed('r1', 'IN_USE', '2026-11-01T15:00:00Z', '2026-11-01T17:00:00Z')];
    expect(findDispatchConflict(driving, trip, CREATE_BLOCKING_STAGES, undefined, opts('2026-11-02T15:00:00Z', '2026-11-02T16:00:00Z'))).toBeNull();
    expect(findDispatchConflict(driving, [], CREATE_BLOCKING_STAGES, undefined, opts('2026-11-01T16:00:00Z', '2026-11-01T16:30:00Z'))).toMatch(/운행중 상태라 배차할 수 없습니다/);
  });

  it('an overdue IN_USE trip keeps blocking until it is returned', () => {
    // planned 08:00-09:00 but still out at 10:00: 10:05-11:00 is inside now + buffer
    const late = [timed('r1', 'IN_USE', '2026-11-01T14:00:00Z', '2026-11-01T15:00:00Z')];
    expect(findDispatchConflict(veh(), late, CREATE_BLOCKING_STAGES, undefined, opts('2026-11-01T16:05:00Z', '2026-11-01T17:00:00Z'))).toMatch(/겹칩니다/);
  });
});
