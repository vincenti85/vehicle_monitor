import { describe, expect, it } from 'vitest';
import { INITIAL_POLICY_CONFIG } from '@/data/initialFleetData';
import { Vehicle, VehicleReservation } from '@/types/fleet';
import { defaultSelection, evaluateSelection } from './bookingSelection';

const NOW = new Date('2026-11-01T16:00:00Z'); // 11/01 10:00 CST
const veh = (extra: Partial<Vehicle> = {}) => ({ id: 'veh-8', fleetNumber: 8, plateNumber: 'AL A22A20', status: 'IDLE', ...extra }) as Vehicle;
const booked = [
  {
    id: 'r1', vehicleId: 'veh-8', stage: 'APPROVED', employeeName: '김민수 과장 (M.S. Kim)', plannedTimeWindow: '11/05 10:00 ~ 12:00',
    plannedStartAt: '2026-11-05T16:00:00.000Z', plannedEndAt: '2026-11-05T18:00:00.000Z',
  } as VehicleReservation,
];
const sel = (startTime: string, endTime: string, date = '2026-11-05') => ({ startDate: date, startTime, endDate: date, endTime });

describe('evaluateSelection (form-side check, AC-M7)', () => {
  it('converts local inputs to UTC and accepts a free slot', () => {
    expect(evaluateSelection(sel('13:00', '16:00'), veh(), booked, NOW, INITIAL_POLICY_CONFIG)).toEqual({
      plannedStartAt: '2026-11-05T19:00:00.000Z',
      plannedEndAt: '2026-11-05T22:00:00.000Z',
      problem: null,
    });
  });

  it('explains an overlap, a bad window, a locked or missing vehicle and empty inputs', () => {
    expect(evaluateSelection(sel('11:30', '13:00'), veh(), booked, NOW, INITIAL_POLICY_CONFIG).problem).toMatch(/김민수 과장 승인완료와 겹칩니다/);
    expect(evaluateSelection(sel('13:00', '12:00'), veh(), booked, NOW, INITIAL_POLICY_CONFIG).problem).toMatch(/종료 시각/);
    expect(evaluateSelection(sel('13:00', '16:00'), veh({ isLockedByAdmin: true }), booked, NOW, INITIAL_POLICY_CONFIG).problem).toMatch(/잠긴 차량/);
    expect(evaluateSelection(sel('13:00', '16:00'), undefined, booked, NOW, INITIAL_POLICY_CONFIG).problem).toMatch(/차량을 선택/);
    expect(evaluateSelection(sel('', '16:00'), veh(), booked, NOW, INITIAL_POLICY_CONFIG).problem).toMatch(/날짜와 시간/);
  });

  it('defaults to tomorrow 09:00-11:00 in fleet local time', () => {
    // 2026-11-02 03:30Z is still 11/01 evening in Opelika
    expect(defaultSelection(new Date('2026-11-02T03:30:00Z'))).toEqual(sel('09:00', '11:00', '2026-11-02'));
  });
});
