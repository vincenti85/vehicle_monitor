// What the fleet state looks like when it leaves the server. Device token hashes never
// leave; employee phone numbers go only to a verified admin.
import type { FleetDatabaseSchema } from './fleetDatabase';

export function toClientView(db: FleetDatabaseSchema, { isAdmin }: { isAdmin: boolean }): FleetDatabaseSchema {
  return {
    ...db,
    employees: db.employees.map(({ deviceTokenHash: _hash, ...e }) => (isAdmin ? e : { ...e, phone: '' })),
  };
}
