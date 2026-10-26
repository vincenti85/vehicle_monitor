import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import { VehicleReservation } from '@/types/fleet';
import { reconcileTrackingTarget } from './useTripPositionReporter';

const base = createSeedDatabase().reservations[0];
const trip = (id: string, stage: VehicleReservation['stage']): VehicleReservation => ({
  ...base,
  id,
  vehicleId: 'veh-8',
  employeeId: 'emp-06',
  stage,
});
const target = { vehicleId: 'veh-8', employeeId: 'emp-06' };

describe('reconcileTrackingTarget', () => {
  it('pins the trip id once the started trip shows up as IN_USE', () => {
    expect(reconcileTrackingTarget(target, [trip('old', 'RETURNED'), trip('new', 'IN_USE')])).toEqual({ ...target, reservationId: 'new' });
  });

  it('keeps waiting right after start, even if an older trip on the same car was returned', () => {
    expect(reconcileTrackingTarget(target, [trip('old', 'RETURNED')])).toBe(target);
  });

  it('clears the device once its trip was returned on another device', () => {
    expect(reconcileTrackingTarget({ ...target, reservationId: 'new' }, [trip('new', 'RETURNED')])).toBeNull();
  });

  it('keeps the target while the trip is unknown (state not loaded yet)', () => {
    const pinned = { ...target, reservationId: 'new' };
    expect(reconcileTrackingTarget(pinned, [])).toBe(pinned);
  });

  it('leaves an unchanged target as the same object', () => {
    const pinned = { ...target, reservationId: 'new' };
    expect(reconcileTrackingTarget(pinned, [trip('new', 'IN_USE')])).toBe(pinned);
    expect(reconcileTrackingTarget(null, [trip('new', 'IN_USE')])).toBeNull();
  });
});
