import { describe, expect, it } from 'vitest';
import { Vehicle } from '@/types/fleet';
import { parseVehicleCsv, planVehicleImport, splitCsvLine, validateVehicleInput } from './vehicleImport';

const seedVeh = (n: number, extra: Partial<Vehicle> = {}): Vehicle => ({
  id: `veh-${n}`,
  fleetNumber: n,
  plateNumber: `AL 41A-${1000 + n}`,
  modelName: 'Demo',
  btMacAddress: 'A4:C1:38:7F:01:03',
  bleBeaconUuid: `FG30-AL41-${n}`,
  status: 'IDLE',
  speedKmh: 0,
  currentGForce: 1,
  rssiDbm: -95,
  currentDriverId: null,
  coPassengerIds: [],
  driverSelectionReason: null,
  tripPurpose: null,
  tripStartedAt: null,
  cumulativeGpsKm: 100 * n,
  lastVerifiedOdometerKm: 100 * n,
  parkingZone: `Lot A #${n}`,
  lat: 0,
  lng: 0,
  headingDeg: 0,
  ...extra,
});
const demoFleet = [1, 2, 3, 4, 5].map((n) => seedVeh(n));
const TS = '10:00:00';

describe('splitCsvLine', () => {
  it('handles quoted commas and escaped quotes', () => {
    expect(splitCsvLine('1,"Lot A, row 2","say ""hi"""')).toEqual(['1', 'Lot A, row 2', 'say "hi"']);
  });
});

describe('parseVehicleCsv', () => {
  it('maps header columns in any order and leaves blanks undefined', () => {
    const { rows, errors } = parseVehicleCsv('﻿plateNumber,fleetNumber,modelName,cumulativeGpsKm\nAL 41X-0001,3,Kia K5,\n');
    expect(errors).toHaveLength(0);
    expect(rows[0]).toEqual({
      fleetNumber: 3,
      plateNumber: 'AL 41X-0001',
      modelName: 'Kia K5',
      btMacAddress: undefined,
      bleBeaconUuid: undefined,
      cumulativeGpsKm: undefined,
      parkingZone: undefined,
    });
  });

  it('rejects bad fleet numbers, missing fields, bad MAC/odometer and duplicates', () => {
    const csv = [
      'fleetNumber,plateNumber,modelName,btMacAddress,bleBeaconUuid,cumulativeGpsKm,parkingZone',
      '31,AL 1,M,,,,',
      '2,,M,,,,',
      '3,AL 3,,,,,',
      '4,AL 4,M,ZZ:11,,,',
      '5,AL 5,M,,,-3,',
      '6,AL 6,M,,,"12,345",',
      '6,AL 7,M,,,,',
      '7,al 6,M,,,,',
    ].join('\n');
    const { rows, errors } = parseVehicleCsv(csv);
    expect(rows.map((r) => r.fleetNumber)).toEqual([6]);
    expect(rows[0].cumulativeGpsKm).toBe(12345);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 8, 9]);
  });
});

describe('validateVehicleInput (shared by CSV and the admin form)', () => {
  it('trims values and enforces required fields and MAC format', () => {
    expect(validateVehicleInput({ fleetNumber: '8', plateNumber: ' ', modelName: 'X' }).error).toMatch(/번호판/);
    expect(validateVehicleInput({ fleetNumber: '8', plateNumber: 'AL 8', modelName: 'X', btMacAddress: 'nope' }).error).toMatch(/MAC/);
    const { row } = validateVehicleInput({ fleetNumber: '8', plateNumber: ' AL 8 ', modelName: 'Kia', btMacAddress: 'a4:c1:38:90:00:08', cumulativeGpsKm: '' });
    expect([row?.fleetNumber, row?.plateNumber, row?.btMacAddress, row?.cumulativeGpsKm]).toEqual([8, 'AL 8', 'A4:C1:38:90:00:08', undefined]);
  });
});

describe('planVehicleImport', () => {
  it('REPLACE makes the CSV the fleet and keeps ids of matched fleet numbers', () => {
    const { rows } = parseVehicleCsv('fleetNumber,plateNumber,modelName,cumulativeGpsKm\n2,AL REAL-2,Real Sonata,5000\n9,AL REAL-9,Real Tucson,\n');
    const plan = planVehicleImport(demoFleet, [], rows, 'REPLACE', false, TS);
    expect(plan.next.map((v) => v.fleetNumber)).toEqual([2, 9]);
    expect(plan.next[0]).toMatchObject({ id: 'veh-2', plateNumber: 'AL REAL-2', cumulativeGpsKm: 5000 });
    expect(plan.next[1]).toMatchObject({ id: 'veh-9', btMacAddress: '', cumulativeGpsKm: 0 });
    expect(plan.missingOdometer).toEqual([9]);
    expect(plan.removed.map((v) => v.fleetNumber)).toEqual([1, 3, 4, 5]);
    expect(demoFleet).toHaveLength(5);
  });

  it('UPSERT keeps other vehicles and existing values for blank cells', () => {
    const { rows } = parseVehicleCsv('fleetNumber,plateNumber,modelName\n3,AL NEW-3,Genesis\n');
    const plan = planVehicleImport(demoFleet, [], rows, 'UPSERT', false, TS);
    expect(plan.next).toHaveLength(5);
    expect(plan.next.find((v) => v.fleetNumber === 3)).toMatchObject({
      plateNumber: 'AL NEW-3',
      btMacAddress: 'A4:C1:38:7F:01:03',
      cumulativeGpsKm: 300,
      parkingZone: 'Lot A #3',
    });
  });

  it('LIVE protection keeps busy vehicles and their odometer', () => {
    const fleet = [seedVeh(1, { status: 'AUTHORIZED' }), seedVeh(2), seedVeh(3)];
    const reservations = [{ id: 'r1', vehicleId: 'veh-3', stage: 'APPROVED' }] as never[];
    const { rows } = parseVehicleCsv('fleetNumber,plateNumber,modelName,cumulativeGpsKm\n1,AL 41A-1001,Demo,99999\n');
    const plan = planVehicleImport(fleet, reservations, rows, 'REPLACE', true, TS);
    expect(plan.blockedRemovals.map((v) => v.fleetNumber)).toEqual([3]);
    expect(plan.removed.map((v) => v.fleetNumber)).toEqual([2]);
    expect(plan.next.map((v) => v.fleetNumber)).toEqual([1, 3]);
    expect(plan.next[0].cumulativeGpsKm).toBe(100);
    expect(plan.odometerSkipped).toEqual([1]);
  });

  it('DEMO REPLACE does not inherit sample values for blank cells', () => {
    const { rows } = parseVehicleCsv('fleetNumber,plateNumber,modelName,btMacAddress,bleBeaconUuid,cumulativeGpsKm,parkingZone\n3,AL REAL-3,Real Tucson,,,,\n');
    const plan = planVehicleImport(demoFleet, [], rows, 'REPLACE', false, TS);
    expect(plan.next[0]).toMatchObject({
      id: 'veh-3',
      btMacAddress: '',
      bleBeaconUuid: 'FG30-03',
      parkingZone: '주차면 미지정',
      cumulativeGpsKm: 0,
      lastVerifiedOdometerKm: 0,
    });
    expect(plan.missingOdometer).toEqual([3]);
  });

  it('LIVE REPLACE keeps existing real values for blank cells', () => {
    const { rows } = parseVehicleCsv('fleetNumber,plateNumber,modelName\n3,AL 41A-1003,Demo\n');
    const plan = planVehicleImport(demoFleet, [], rows, 'REPLACE', true, TS);
    expect(plan.next[0]).toMatchObject({ btMacAddress: 'A4:C1:38:7F:01:03', cumulativeGpsKm: 300, parkingZone: 'Lot A #3' });
  });

  it('edit with blank odometer keeps the GPS total (ghost-trip evidence)', () => {
    const fleet = [seedVeh(1, { cumulativeGpsKm: 1050, lastVerifiedOdometerKm: 1000 })];
    const { row } = validateVehicleInput({ fleetNumber: '1', plateNumber: 'AL NEW', modelName: 'Real' });
    const plan = planVehicleImport(fleet, [], [row!], 'UPSERT', true, TS);
    expect(plan.next[0]).toMatchObject({ plateNumber: 'AL NEW', cumulativeGpsKm: 1050, lastVerifiedOdometerKm: 1000 });
  });

  it('reports a plate already used by a vehicle that stays in the fleet', () => {
    const { rows } = parseVehicleCsv('fleetNumber,plateNumber,modelName\n9,AL 41A-1004,Dup\n');
    expect(planVehicleImport(demoFleet, [], rows, 'UPSERT', false, TS).plateConflicts).toHaveLength(1);
  });
});
