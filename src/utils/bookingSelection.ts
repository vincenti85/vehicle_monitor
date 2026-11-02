// Client-side check of a booking form selection: same rules as the server (which stays final),
// so the form can disable submit and say why before the request is sent (AC-M7).
import { localDate } from '@/domain/clock';
import { SystemPolicyConfig, Vehicle, VehicleReservation } from '@/types/fleet';
import { bookingPolicyOf, toInterval, validateWindow, zonedDateTimeToIso } from './bookingWindow';
import { CREATE_BLOCKING_STAGES, findDispatchConflict } from './dispatchRules';

export interface BookingSelection {
  startDate: string; // YYYY-MM-DD, fleet local
  startTime: string; // HH:MM
  endDate: string;
  endTime: string;
}

export interface EvaluatedSelection {
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  /** Why the request would be refused, or null when it can be sent. */
  problem: string | null;
}

/** Default form value: tomorrow 09:00-11:00 local, nudging people to book ahead. */
export function defaultSelection(now: Date): BookingSelection {
  const tomorrow = localDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return { startDate: tomorrow, startTime: '09:00', endDate: tomorrow, endTime: '11:00' };
}

export function evaluateSelection(
  sel: BookingSelection,
  vehicle: Vehicle | undefined,
  reservations: VehicleReservation[],
  now: Date,
  policyConfig: Partial<SystemPolicyConfig>
): EvaluatedSelection {
  const plannedStartAt = zonedDateTimeToIso(sel.startDate, sel.startTime);
  const plannedEndAt = zonedDateTimeToIso(sel.endDate, sel.endTime);
  if (!plannedStartAt || !plannedEndAt) return { plannedStartAt, plannedEndAt, problem: '날짜와 시간을 모두 선택하세요.' };
  const policy = bookingPolicyOf(policyConfig);
  const invalid = validateWindow(plannedStartAt, plannedEndAt, now, policy);
  if (invalid) return { plannedStartAt, plannedEndAt, problem: invalid };
  if (!vehicle) return { plannedStartAt, plannedEndAt, problem: '차량을 선택하세요.' };
  if (vehicle.isLockedByAdmin) return { plannedStartAt, plannedEndAt, problem: `#${vehicle.fleetNumber}호차는 잠긴 차량(점검)이라 신청할 수 없습니다.` };
  const window = toInterval({ plannedStartAt, plannedEndAt });
  const conflict = window
    ? findDispatchConflict(vehicle, reservations, CREATE_BLOCKING_STAGES, undefined, { window, bufferMinutes: policy.bookingBufferMinutes, now })
    : null;
  return { plannedStartAt, plannedEndAt, problem: conflict };
}
