// Vehicle master data (identity, registration, pairing IDs, admin lock) may only be
// changed by the admin. Non-admin clients still sync operational fields (status, driver,
// location, odometer) through the same state patch.
import { Vehicle } from '@/types/fleet';

export const VEHICLE_MASTER_FIELDS = [
  'fleetNumber',
  'plateNumber',
  'modelName',
  'btMacAddress',
  'bleBeaconUuid',
  'isLockedByAdmin',
] as const satisfies readonly (keyof Vehicle)[];

export interface MasterGuardResult {
  vehicles: Vehicle[];
  /** True when the incoming list tried to change master data and was overridden. */
  overridden: boolean;
}

function masterOf(v: Vehicle): Pick<Vehicle, (typeof VEHICLE_MASTER_FIELDS)[number]> {
  return {
    fleetNumber: v.fleetNumber,
    plateNumber: v.plateNumber,
    modelName: v.modelName,
    btMacAddress: v.btMacAddress,
    bleBeaconUuid: v.bleBeaconUuid,
    isLockedByAdmin: v.isLockedByAdmin,
  };
}

/**
 * Keeps the stored vehicle set and master fields, taking only operational fields from
 * the incoming list. Vehicles added or removed by a non-admin client are ignored.
 */
export function enforceVehicleMaster(incoming: Vehicle[], stored: Vehicle[]): MasterGuardResult {
  const incomingById = new Map(incoming.map((v) => [v.id, v]));
  let overridden =
    incoming.length !== stored.length || incoming.some((v) => !stored.some((s) => s.id === v.id));

  const vehicles = stored.map((s) => {
    const next = incomingById.get(s.id);
    if (!next) return s;
    const master = masterOf(s);
    if (VEHICLE_MASTER_FIELDS.some((key) => (next[key] ?? null) !== (master[key] ?? null))) {
      overridden = true;
    }
    return { ...next, ...master };
  });

  return { vehicles, overridden };
}
