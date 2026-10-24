import {
  Employee,
  GeofenceLog,
  GhostTripCase,
  IncidentEvent,
  SystemPolicyConfig,
  TaxLogEntry,
  Vehicle,
  VehicleReservation,
} from '@/types/fleet';
import {
  INITIAL_EMPLOYEES,
  INITIAL_GEOFENCE_LOGS,
  INITIAL_GHOST_TRIPS,
  INITIAL_INCIDENTS,
  INITIAL_POLICY_CONFIG,
  INITIAL_RESERVATIONS,
  INITIAL_TAX_LOGS,
  INITIAL_VEHICLES,
} from '@/data/initialFleetData';
import { FleetStorageUnavailableError, getFleetStorage } from '@/lib/fleetStorage';

export { FleetStorageUnavailableError } from '@/lib/fleetStorage';

export interface PushAlertItem {
  id: string;
  time: string;
  target: 'MANAGER' | 'DRIVER';
  message: string;
  level: 'CRITICAL' | 'INFO';
}

// DEMO: seeded sample fleet (simulated telemetry allowed). LIVE: real fleet data only.
export type FleetDataMode = 'DEMO' | 'LIVE';

export interface FleetDatabaseSchema {
  version: string;
  lastUpdatedAt: string;
  storageEngine: 'PERSISTENT_JSON_DB' | 'SUPABASE_POSTGRES';
  dataMode: FleetDataMode;
  vehicles: Vehicle[];
  employees: Employee[];
  reservations: VehicleReservation[];
  incidents: IncidentEvent[];
  geofenceLogs: GeofenceLog[];
  ghostTrips: GhostTripCase[];
  taxLogs: TaxLogEntry[];
  policyConfig: SystemPolicyConfig;
  pushStream: PushAlertItem[];
}

export const DEMO_EMPLOYEE_IDS: ReadonlySet<string> = new Set(INITIAL_EMPLOYEES.map((e) => e.id));

const HQ_LAT = 32.6912;
const HQ_LNG = -85.3298;

const DEFAULT_PUSH_STREAM: PushAlertItem[] = [
  {
    id: 'push-0',
    time: '20:22:05',
    target: 'MANAGER',
    message:
      '📋 [배차 승인 요청] 이정우 사원이 4호차(AL 41D-2648) 배차를 신청했습니다. (행선지: Auburn Technology Park)',
    level: 'INFO',
  },
  {
    id: 'push-1',
    time: '20:18:42',
    target: 'MANAGER',
    message:
      '💥 [무블랙박스 사고 재구성] 7호차(AL 41B-4821 · 김민수 과장) US-280 & Gateway Dr(Opelika, AL)에서 스마트폰 6축 센서 3.18G 충격 + 자이로 42.5°/s 회전 + 급정차가 감지되었습니다.',
    level: 'CRITICAL',
  },
  {
    id: 'push-2',
    time: '20:15:30',
    target: 'MANAGER',
    message:
      '🚨 [미승인 운행 포착] 박성훈 대리가 사전 등록 없이 4400 Northpark Dr에서 3호차(AL 41A-9012) 운행을 시작했습니다.',
    level: 'CRITICAL',
  },
  {
    id: 'push-3',
    time: '20:15:31',
    target: 'DRIVER',
    message:
      '⚠️ [운전자 경고] 박성훈 대리님, 3호차(AL 41A-9012) 미등록 운행이 관리자에게 자동 통보되었습니다. 즉시 운행 목적을 선택해 주세요.',
    level: 'CRITICAL',
  },
];

export function createSeedDatabase(): FleetDatabaseSchema {
  return {
    version: '1.2.0',
    lastUpdatedAt: new Date().toISOString(),
    storageEngine: 'PERSISTENT_JSON_DB',
    dataMode: 'DEMO',
    vehicles: INITIAL_VEHICLES,
    employees: INITIAL_EMPLOYEES,
    reservations: INITIAL_RESERVATIONS,
    incidents: INITIAL_INCIDENTS,
    geofenceLogs: INITIAL_GEOFENCE_LOGS,
    ghostTrips: INITIAL_GHOST_TRIPS,
    taxLogs: INITIAL_TAX_LOGS,
    policyConfig: INITIAL_POLICY_CONFIG,
    pushStream: DEFAULT_PUSH_STREAM,
  };
}

/** Garage parking coordinates near HQ, spread by fleet number so markers do not overlap. */
export function garageSlotCoordinates(fleetNumber: number): { lat: number; lng: number } {
  return {
    lat: HQ_LAT + ((fleetNumber % 6) - 2.5) * 0.0012,
    lng: HQ_LNG + (Math.floor(fleetNumber / 6) - 2.5) * 0.0014,
  };
}

export function getStorageBackendName() {
  return getFleetStorage().name;
}

async function persist(db: FleetDatabaseSchema): Promise<FleetDatabaseSchema> {
  await getFleetStorage().save(JSON.stringify(db, null, 2));
  return db;
}

/**
 * Reads the database. Creates the demo seed only when no database exists yet.
 * Throws FleetStorageUnavailableError when the store exists but cannot be read or parsed,
 * so callers never mistake an outage for an empty database and overwrite real data.
 */
export async function readFleetDatabase(): Promise<FleetDatabaseSchema> {
  const raw = await getFleetStorage().load();
  if (raw === null) {
    return persist(createSeedDatabase());
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FleetDatabaseSchema>;
    return { ...parsed, dataMode: parsed.dataMode ?? 'DEMO' } as FleetDatabaseSchema;
  } catch (err) {
    throw new FleetStorageUnavailableError('Fleet database is not valid JSON', { cause: err });
  }
}

export async function writeFleetDatabase(
  nextState: Partial<FleetDatabaseSchema>
): Promise<FleetDatabaseSchema> {
  const current = await readFleetDatabase();
  return persist({
    ...current,
    ...nextState,
    dataMode: current.dataMode,
    lastUpdatedAt: new Date().toISOString(),
  });
}

/** Restores the demo seed. Refused once real data is live, so a stray click cannot wipe it. */
export async function resetFleetDatabase(): Promise<FleetDatabaseSchema> {
  const current = await readFleetDatabase();
  if (current.dataMode === 'LIVE') {
    throw new LiveDataProtectedError('Live data is protected; demo reset is disabled.');
  }
  return persist(createSeedDatabase());
}

function resetVehicleOperationalState(v: Vehicle): Vehicle {
  return {
    ...v,
    status: 'IDLE',
    speedKmh: 0,
    currentGForce: 1.0,
    rssiDbm: -95,
    currentDriverId: null,
    coPassengerIds: [],
    driverSelectionReason: null,
    tripPurpose: null,
    tripStartedAt: null,
    headingDeg: 0,
    ...garageSlotCoordinates(v.fleetNumber),
  };
}

/** Thrown when a demo-only operation is attempted on a database already holding real data. */
export class LiveDataProtectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveDataProtectedError';
  }
}

export interface ClearDemoResult {
  db: FleetDatabaseSchema;
  removedDemoEmployees: number;
  keptDemoEmployeesBecauseNoRealOnes: boolean;
}

/**
 * Switches to LIVE mode: keeps the vehicle master data, clears all sample history
 * (reservations, incidents, ghost trips, geofence logs, tax logs, alerts) and puts every
 * vehicle back in the garage. Demo employees are removed only if real ones exist.
 */
export async function clearDemoData(removeDemoEmployees: boolean): Promise<ClearDemoResult> {
  const current = await readFleetDatabase();
  if (current.dataMode === 'LIVE') {
    throw new LiveDataProtectedError('Demo data was already cleared; live records are kept.');
  }
  const realEmployees = current.employees.filter((e) => !DEMO_EMPLOYEE_IDS.has(e.id));
  const canRemoveDemo = removeDemoEmployees && realEmployees.length > 0;
  const employees = canRemoveDemo ? realEmployees : current.employees;

  const db = await persist({
    ...current,
    dataMode: 'LIVE',
    lastUpdatedAt: new Date().toISOString(),
    vehicles: current.vehicles.map(resetVehicleOperationalState),
    employees: employees.map((e) => ({ ...e, violationCount: 0 })),
    reservations: [],
    incidents: [],
    geofenceLogs: [],
    ghostTrips: [],
    taxLogs: [],
    pushStream: [],
  });

  return {
    db,
    removedDemoEmployees: current.employees.length - employees.length,
    keptDemoEmployeesBecauseNoRealOnes: removeDemoEmployees && !canRemoveDemo,
  };
}
