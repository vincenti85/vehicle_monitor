// Vehicle master CSV import: strict parsing (no invented values) and a merge plan keyed
// by fleet number, so real vehicle data replaces the sample fleet predictably.
import { Vehicle, VehicleReservation } from '@/types/fleet';

export const MAX_FLEET_SIZE = 30;
const MAC_PATTERN = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
const ACTIVE_STAGES: ReadonlySet<VehicleReservation['stage']> = new Set<
  VehicleReservation['stage']
>(['REQUESTED', 'APPROVED', 'IN_USE']);

/** One validated CSV row. Optional fields are undefined when the cell was blank. */
export interface VehicleCsvRow {
  fleetNumber: number;
  plateNumber: string;
  modelName: string;
  btMacAddress?: string;
  bleBeaconUuid?: string;
  cumulativeGpsKm?: number;
  parkingZone?: string;
}

export interface CsvRowError {
  line: number;
  message: string;
}

export interface ParsedVehicleCsv {
  rows: VehicleCsvRow[];
  errors: CsvRowError[];
}

type ColumnKey = keyof VehicleCsvRow;
const COLUMN_ORDER: ColumnKey[] = [
  'fleetNumber',
  'plateNumber',
  'modelName',
  'btMacAddress',
  'bleBeaconUuid',
  'cumulativeGpsKm',
  'parkingZone',
];

/** Splits one CSV line, honoring double-quoted cells that contain commas or "" escapes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function resolveColumns(header: string[]): ColumnKey[] {
  const normalized = header.map((h) => h.replace(/\s+/g, '').toLowerCase());
  if (!normalized.includes('fleetnumber')) return COLUMN_ORDER;
  return normalized.map(
    (h) => COLUMN_ORDER.find((key) => key.toLowerCase() === h) ?? ('' as ColumnKey)
  );
}

function parseRow(
  cells: string[],
  columns: ColumnKey[]
): { row?: VehicleCsvRow; error?: string } {
  const cell = (key: ColumnKey) => {
    const idx = columns.indexOf(key);
    const value = idx >= 0 ? cells[idx] ?? '' : '';
    return value === '' ? undefined : value;
  };

  const fleetRaw = cell('fleetNumber');
  const fleetNumber = fleetRaw ? Number(fleetRaw.replace(/[^0-9]/g, '')) : NaN;
  if (!Number.isInteger(fleetNumber) || fleetNumber < 1 || fleetNumber > MAX_FLEET_SIZE) {
    return { error: `호차 번호(fleetNumber)는 1~${MAX_FLEET_SIZE} 사이 정수여야 합니다 (입력: "${fleetRaw ?? ''}")` };
  }
  const plateNumber = cell('plateNumber');
  if (!plateNumber) return { error: '번호판(plateNumber)이 비어 있습니다' };
  const modelName = cell('modelName');
  if (!modelName) return { error: '차종(modelName)이 비어 있습니다' };

  const btMacAddress = cell('btMacAddress');
  if (btMacAddress && !MAC_PATTERN.test(btMacAddress)) {
    return { error: `블루투스 MAC 형식이 올바르지 않습니다 (예: A4:C1:38:7F:01:03, 입력: "${btMacAddress}")` };
  }

  const odometerRaw = cell('cumulativeGpsKm');
  let cumulativeGpsKm: number | undefined;
  if (odometerRaw !== undefined) {
    cumulativeGpsKm = Number(odometerRaw.replace(/[,\s]/g, ''));
    if (!Number.isFinite(cumulativeGpsKm) || cumulativeGpsKm < 0) {
      return { error: `계기판 주행거리(cumulativeGpsKm)는 0 이상 숫자여야 합니다 (입력: "${odometerRaw}")` };
    }
  }

  return {
    row: {
      fleetNumber,
      plateNumber,
      modelName,
      btMacAddress: btMacAddress?.toUpperCase(),
      bleBeaconUuid: cell('bleBeaconUuid'),
      cumulativeGpsKm,
      parkingZone: cell('parkingZone'),
    },
  };
}

/** Parses vehicle CSV text (first line = header). Invalid or duplicate rows become errors. */
export function parseVehicleCsv(text: string): ParsedVehicleCsv {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const rows: VehicleCsvRow[] = [];
  const errors: CsvRowError[] = [];
  const firstContent = lines.findIndex((l) => l.trim() !== '');
  if (firstContent < 0) return { rows, errors: [{ line: 1, message: '빈 파일입니다' }] };

  const columns = resolveColumns(splitCsvLine(lines[firstContent]));
  const seenFleet = new Map<number, number>();
  const seenPlate = new Map<string, number>();

  for (let i = firstContent + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue;
    const lineNo = i + 1;
    const { row, error } = parseRow(splitCsvLine(lines[i]), columns);
    if (!row) {
      errors.push({ line: lineNo, message: error ?? '알 수 없는 오류' });
      continue;
    }
    const plateKey = row.plateNumber.toUpperCase();
    if (seenFleet.has(row.fleetNumber)) {
      errors.push({ line: lineNo, message: `#${row.fleetNumber}호차가 ${seenFleet.get(row.fleetNumber)}행과 중복됩니다` });
      continue;
    }
    if (seenPlate.has(plateKey)) {
      errors.push({ line: lineNo, message: `번호판 ${row.plateNumber}이(가) ${seenPlate.get(plateKey)}행과 중복됩니다` });
      continue;
    }
    seenFleet.set(row.fleetNumber, lineNo);
    seenPlate.set(plateKey, lineNo);
    rows.push(row);
  }
  return { rows, errors };
}

export type VehicleImportMode = 'REPLACE' | 'UPSERT';

export interface VehicleImportPlan {
  next: Vehicle[];
  added: number[];
  updated: number[];
  removed: Vehicle[];
  /** Vehicles that cannot be removed because they have a live trip or open reservation. */
  blockedRemovals: Vehicle[];
  /** Fleet numbers whose odometer was not applied because the vehicle is currently in use. */
  odometerSkipped: number[];
  /** New vehicles registered without an odometer reading (should be audited). */
  missingOdometer: number[];
  /** Plates in the CSV already used by a different vehicle that stays in the fleet. */
  plateConflicts: string[];
}

function isVehicleBusy(v: Vehicle, reservations: VehicleReservation[]): boolean {
  return (
    v.status !== 'IDLE' ||
    reservations.some((r) => r.vehicleId === v.id && ACTIVE_STAGES.has(r.stage))
  );
}

function garageSlot(fleetNumber: number) {
  return {
    lat: 32.6912 + ((fleetNumber % 6) - 2.5) * 0.0012,
    lng: -85.3298 + (Math.floor(fleetNumber / 6) - 2.5) * 0.0014,
  };
}

function newVehicleFromRow(row: VehicleCsvRow, id: string, timestamp: string): Vehicle {
  const unit = row.fleetNumber.toString().padStart(2, '0');
  const odometer = row.cumulativeGpsKm ?? 0;
  return {
    id,
    fleetNumber: row.fleetNumber,
    plateNumber: row.plateNumber,
    modelName: row.modelName,
    btMacAddress: row.btMacAddress ?? '',
    bleBeaconUuid: row.bleBeaconUuid ?? `FG30-${unit}`,
    status: 'IDLE',
    speedKmh: 0,
    headingDeg: 0,
    currentGForce: 1.0,
    rssiDbm: -95,
    currentDriverId: null,
    coPassengerIds: [],
    driverSelectionReason: null,
    tripPurpose: null,
    tripStartedAt: null,
    cumulativeGpsKm: odometer,
    lastVerifiedOdometerKm: odometer,
    parkingZone: row.parkingZone ?? '주차면 미지정',
    ...garageSlot(row.fleetNumber),
    isLockedByAdmin: false,
    lastOdometerAuditAt: row.cumulativeGpsKm !== undefined ? timestamp : undefined,
  };
}

/**
 * inheritBlanks: true keeps existing values for blank optional cells (partial update or
 * live data). false treats the CSV row as the full definition, used when replacing the
 * sample fleet so no sample MAC/zone/odometer survives on a real vehicle.
 */
function updateVehicleFromRow(
  v: Vehicle,
  row: VehicleCsvRow,
  canApplyOdometer: boolean,
  inheritBlanks: boolean,
  timestamp: string
): Vehicle {
  const unit = row.fleetNumber.toString().padStart(2, '0');
  const blankOdometer = inheritBlanks ? undefined : 0;
  const odometer = canApplyOdometer ? row.cumulativeGpsKm ?? blankOdometer : undefined;
  return {
    ...v,
    plateNumber: row.plateNumber,
    modelName: row.modelName,
    btMacAddress: row.btMacAddress ?? (inheritBlanks ? v.btMacAddress : ''),
    bleBeaconUuid: row.bleBeaconUuid ?? (inheritBlanks ? v.bleBeaconUuid : `FG30-${unit}`),
    parkingZone: row.parkingZone ?? (inheritBlanks ? v.parkingZone : '주차면 미지정'),
    ...(odometer !== undefined
      ? {
          cumulativeGpsKm: odometer,
          lastVerifiedOdometerKm: odometer,
          lastOdometerAuditAt: row.cumulativeGpsKm !== undefined ? timestamp : undefined,
        }
      : {}),
  };
}

/**
 * Builds the resulting fleet without mutating inputs.
 * REPLACE: the CSV becomes the whole fleet (vehicles absent from it are removed).
 * UPSERT: CSV rows are added or updated; other vehicles stay.
 * protectBusy: when true (live data), busy vehicles are never removed and the plan reports them.
 */
export function planVehicleImport(
  existing: Vehicle[],
  reservations: VehicleReservation[],
  rows: VehicleCsvRow[],
  mode: VehicleImportMode,
  protectBusy: boolean,
  timestamp: string
): VehicleImportPlan {
  const byFleet = new Map(existing.map((v) => [v.fleetNumber, v]));
  const csvFleet = new Set(rows.map((r) => r.fleetNumber));
  const removed = mode === 'REPLACE' ? existing.filter((v) => !csvFleet.has(v.fleetNumber)) : [];
  const blockedRemovals = protectBusy ? removed.filter((v) => isVehicleBusy(v, reservations)) : [];
  const kept =
    mode === 'REPLACE'
      ? existing.filter((v) => !csvFleet.has(v.fleetNumber) && blockedRemovals.includes(v))
      : existing.filter((v) => !csvFleet.has(v.fleetNumber));

  const keptPlates = new Map(kept.map((v) => [v.plateNumber.toUpperCase(), v.fleetNumber]));
  const plateConflicts = rows
    .filter((r) => keptPlates.has(r.plateNumber.toUpperCase()))
    .map((r) => `${r.plateNumber} (#${keptPlates.get(r.plateNumber.toUpperCase())}호차가 사용 중)`);

  const usedIds = new Set(existing.map((v) => v.id));
  const added: number[] = [];
  const updated: number[] = [];
  const odometerSkipped: number[] = [];
  const missingOdometer: number[] = [];

  // Replacing the sample fleet (not live): CSV rows fully define each vehicle
  const inheritBlanks = mode === 'UPSERT' || protectBusy;
  const fromCsv = rows.map((row) => {
    const current = byFleet.get(row.fleetNumber);
    if (current) {
      const busy = isVehicleBusy(current, reservations);
      if (busy && row.cumulativeGpsKm !== undefined && protectBusy) {
        odometerSkipped.push(row.fleetNumber);
      }
      if (!inheritBlanks && row.cumulativeGpsKm === undefined) {
        missingOdometer.push(row.fleetNumber);
      }
      updated.push(row.fleetNumber);
      return updateVehicleFromRow(current, row, !(busy && protectBusy), inheritBlanks, timestamp);
    }
    let id = `veh-${row.fleetNumber}`;
    if (usedIds.has(id)) id = `veh-${row.fleetNumber}-${Date.now()}`;
    usedIds.add(id);
    added.push(row.fleetNumber);
    if (row.cumulativeGpsKm === undefined) missingOdometer.push(row.fleetNumber);
    return newVehicleFromRow(row, id, timestamp);
  });

  return {
    next: [...kept, ...fromCsv].sort((a, b) => a.fleetNumber - b.fleetNumber),
    added,
    updated,
    removed: removed.filter((v) => !blockedRemovals.includes(v)),
    blockedRemovals,
    odometerSkipped,
    missingOdometer,
    plateConflicts,
  };
}
