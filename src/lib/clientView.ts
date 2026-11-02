// What the fleet state looks like when it leaves the server. Device token hashes never
// leave; employee phone numbers and inspection notes/coordinates go only to a verified admin.
import type { VehicleInspection } from '@/types/fleet';
import type { FleetDatabaseSchema } from './fleetDatabase';

export function toClientView(db: FleetDatabaseSchema, { isAdmin }: { isAdmin: boolean }): FleetDatabaseSchema {
  return {
    ...db,
    employees: db.employees.map(({ deviceTokenHash: _hash, ...e }) => (isAdmin ? e : { ...e, phone: '' })),
    inspections: isAdmin ? db.inspections : (db.inspections ?? []).map(withoutInspectionDetails),
  };
}

/** Non-admins see pass/fail and counts only: no free-text notes and no GPS coordinates. */
function withoutInspectionDetails(i: VehicleInspection): VehicleInspection {
  return {
    ...i,
    items: i.items.map((item) => ({ ...item, note: '' })),
    startLat: null,
    startLng: null,
    submitLat: null,
    submitLng: null,
    accuracyM: null,
  };
}
