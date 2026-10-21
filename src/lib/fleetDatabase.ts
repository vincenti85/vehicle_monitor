import fs from 'fs';
import path from 'path';
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

export interface PushAlertItem {
  id: string;
  time: string;
  target: 'MANAGER' | 'DRIVER';
  message: string;
  level: 'CRITICAL' | 'INFO';
}

export interface FleetDatabaseSchema {
  version: string;
  lastUpdatedAt: string;
  storageEngine: 'PERSISTENT_JSON_DB' | 'SUPABASE_POSTGRES';
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

import os from 'os';

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? os.tmpdir() : path.join(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'fleet-db.json');

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
    version: '1.1.0',
    lastUpdatedAt: new Date().toISOString(),
    storageEngine: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? 'SUPABASE_POSTGRES'
      : 'PERSISTENT_JSON_DB',
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

export function readFleetDatabase(): FleetDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      const seed = createSeedDatabase();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(raw) as FleetDatabaseSchema;
  } catch {
    return createSeedDatabase();
  }
}

export function writeFleetDatabase(
  nextState: Partial<FleetDatabaseSchema>
): FleetDatabaseSchema {
  const current = readFleetDatabase();
  const merged: FleetDatabaseSchema = {
    ...current,
    ...nextState,
    lastUpdatedAt: new Date().toISOString(),
  };
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    // Fallback for read-only serverless environments where /tmp is used
  }
  return merged;
}

export function resetFleetDatabase(): FleetDatabaseSchema {
  const seed = createSeedDatabase();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
  } catch {
    // Ignore write error in read-only environment
  }
  return seed;
}
