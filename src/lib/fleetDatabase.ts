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
import {
  FleetStorageConflictError,
  FleetStorageUnavailableError,
  getFleetStorage,
  getFleetStorageGeneration,
} from '@/lib/fleetStorage';

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
  /** Incremented on every write; clients poll with it to detect changes. */
  revision: number;
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
    revision: 0,
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

/** Thrown when a demo-only operation is attempted on a database already holding real data. */
export class LiveDataProtectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveDataProtectedError';
  }
}

const MAX_WRITE_ATTEMPTS = 5;
const READ_CACHE_TTL_MS = 3000;
export const PUSH_STREAM_LIMIT = 200;

interface LoadedDatabase {
  db: FleetDatabaseSchema;
  etag: string | null;
}

function parseDatabase(json: string): FleetDatabaseSchema {
  try {
    const parsed = JSON.parse(json) as Partial<FleetDatabaseSchema>;
    return {
      ...parsed,
      dataMode: parsed.dataMode ?? 'DEMO',
      revision: parsed.revision ?? 0,
    } as FleetDatabaseSchema;
  } catch (err) {
    throw new FleetStorageUnavailableError('Fleet database is not valid JSON', { cause: err });
  }
}

/** Loads the current document; a missing document is reported as the (unsaved) demo seed. */
async function loadDatabase(): Promise<LoadedDatabase> {
  const doc = await getFleetStorage().load();
  if (doc === 'NOT_MODIFIED') throw new FleetStorageUnavailableError('Unexpected 304 without ifNoneMatch');
  if (doc === null) return { db: createSeedDatabase(), etag: null };
  return { db: parseDatabase(doc.json), etag: doc.etag };
}

// Per-instance cache so frequent polling does not read the store on every request
let readCache: { db: FleetDatabaseSchema; etag: string; fetchedAt: number; generation: number } | null = null;

function rememberRead(db: FleetDatabaseSchema, etag: string) {
  readCache = { db, etag, fetchedAt: Date.now(), generation: getFleetStorageGeneration() };
}

function currentCache() {
  return readCache && readCache.generation === getFleetStorageGeneration() ? readCache : null;
}

/**
 * Latest document for a write. Revalidates the cached copy with ifNoneMatch, so an
 * unchanged store costs a 304 instead of a full download and JSON parse. Mutators are
 * pure, so handing them the cached object is safe; the save still checks the ETag.
 */
async function loadDatabaseForWrite(): Promise<LoadedDatabase> {
  const cached = currentCache();
  if (!cached) return loadDatabase();
  const doc = await getFleetStorage().load({ ifNoneMatch: cached.etag });
  if (doc === 'NOT_MODIFIED') return { db: cached.db, etag: cached.etag };
  if (doc === null) return { db: createSeedDatabase(), etag: null };
  const db = parseDatabase(doc.json);
  rememberRead(db, doc.etag);
  return { db, etag: doc.etag };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Mutation<R> {
  db: FleetDatabaseSchema;
  result: R;
}

/**
 * Read-modify-write with optimistic concurrency: applies the mutator to the latest stored
 * document and saves only if nobody wrote in between, retrying on conflict. Returning the
 * same db object means "no change" and skips the write. Errors thrown by the mutator
 * (e.g. LiveDataProtectedError) propagate without writing.
 */
export async function mutateFleetDatabase<R>(
  mutator: (db: FleetDatabaseSchema) => Mutation<R> | Promise<Mutation<R>>
): Promise<Mutation<R>> {
  const storage = getFleetStorage();
  const attemptAll = async (): Promise<Mutation<R>> => {
    // First try saves straight onto the cached copy: the ETag check rejects it if anyone
    // wrote since, so the common case costs one storage round trip instead of two.
    let useCache = true;
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
      const cached = useCache ? currentCache() : null;
      useCache = false;
      const { db, etag } = cached ? { db: cached.db, etag: cached.etag } : await loadDatabaseForWrite();
      const outcome = await mutator(db);
      if (outcome.db === db && etag !== null) {
        // A refusal decided on unverified cached data is re-checked against the store
        if (cached) {
          attempt -= 1;
          continue;
        }
        return outcome;
      }

      const next: FleetDatabaseSchema = {
        ...outcome.db,
        // A brand-new seed is revision 0; any change (including one applied to a fresh seed) bumps it
        revision: etag === null ? (outcome.db === db ? 0 : 1) : db.revision + 1,
        lastUpdatedAt: new Date().toISOString(),
        pushStream: outcome.db.pushStream.slice(0, PUSH_STREAM_LIMIT),
      };
      try {
        // Compact JSON: about a third smaller than indented, so every read and write moves less
        const newEtag = await storage.save(JSON.stringify(next), { ifMatch: etag });
        rememberRead(next, newEtag);
        return { db: next, result: outcome.result };
      } catch (err) {
        if (!(err instanceof FleetStorageConflictError)) throw err;
        await sleep(attempt * (20 + Math.random() * 60));
      }
    }
    throw new FleetStorageUnavailableError('Fleet database is busy; please retry');
  };
  return storage.exclusive ? storage.exclusive(attemptAll) : attemptAll();
}

/**
 * Reads the database, creating the demo seed only when none exists yet.
 * Throws FleetStorageUnavailableError when the store cannot be read or parsed, so callers
 * never mistake an outage for an empty database and overwrite real data.
 */
export async function readFleetDatabase(): Promise<FleetDatabaseSchema> {
  const { db, etag } = await loadDatabase();
  if (etag !== null) {
    rememberRead(db, etag);
    return db;
  }
  return (await mutateFleetDatabase((seed) => ({ db: seed, result: null }))).db;
}

/** Polling read: serves a fresh-enough cached copy and revalidates with ifNoneMatch. */
export async function readFleetDatabaseCached(): Promise<FleetDatabaseSchema> {
  const cached = currentCache();
  if (cached && Date.now() - cached.fetchedAt < READ_CACHE_TTL_MS) return cached.db;
  if (!cached) return readFleetDatabase();
  const doc = await getFleetStorage().load({ ifNoneMatch: cached.etag });
  if (doc === 'NOT_MODIFIED') {
    rememberRead(cached.db, cached.etag);
    return cached.db;
  }
  if (doc === null) return readFleetDatabase();
  const db = parseDatabase(doc.json);
  rememberRead(db, doc.etag);
  return db;
}

/** Pure: the demo seed in place of the current state. Throws once real data is live. */
export function resetDemoState(current: FleetDatabaseSchema): FleetDatabaseSchema {
  if (current.dataMode === 'LIVE') {
    throw new LiveDataProtectedError('Live data is protected; demo reset is disabled.');
  }
  return { ...createSeedDatabase(), revision: current.revision };
}

/** Restores the demo seed. Refused once real data is live, so a stray click cannot wipe it. */
export async function resetFleetDatabase(): Promise<FleetDatabaseSchema> {
  return (await mutateFleetDatabase((current) => ({ db: resetDemoState(current), result: null }))).db;
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
export function clearDemoState(
  current: FleetDatabaseSchema,
  removeDemoEmployees: boolean
): { db: FleetDatabaseSchema; result: Omit<ClearDemoResult, 'db'> } {
  if (current.dataMode === 'LIVE') {
    throw new LiveDataProtectedError('Demo data was already cleared; live records are kept.');
  }
  const realEmployees = current.employees.filter((e) => !DEMO_EMPLOYEE_IDS.has(e.id));
  const canRemoveDemo = removeDemoEmployees && realEmployees.length > 0;
  const employees = canRemoveDemo ? realEmployees : current.employees;
  return {
    db: {
      ...current,
      dataMode: 'LIVE',
      vehicles: current.vehicles.map(resetVehicleOperationalState),
      employees: employees.map((e) => ({ ...e, violationCount: 0 })),
      reservations: [],
      incidents: [],
      geofenceLogs: [],
      ghostTrips: [],
      taxLogs: [],
      pushStream: [],
    },
    result: {
      removedDemoEmployees: current.employees.length - employees.length,
      keptDemoEmployeesBecauseNoRealOnes: removeDemoEmployees && !canRemoveDemo,
    },
  };
}

export async function clearDemoData(removeDemoEmployees: boolean): Promise<ClearDemoResult> {
  const { db, result } = await mutateFleetDatabase((current) => clearDemoState(current, removeDemoEmployees));
  return { db, ...result };
}
