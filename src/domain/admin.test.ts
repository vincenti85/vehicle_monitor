import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/lib/fleetDatabase';
import { ActionContext } from './core';
import {
  addEmployee,
  auditOdometer,
  importEmployees,
  importVehicles,
  resolveIncident,
  toggleEmployeeDispatch,
  toggleVehicleLock,
  updatePairing,
  updatePolicy,
} from './admin';
import { simulateCrashOrDrop, simulateUnauthorizedStart, togglePermissionEvasion } from './demo';
import { applyTelemetry } from './telemetry';

const ctx: ActionContext = { now: new Date('2026-10-25T21:12:22Z'), isAdmin: true };
const veh = (db: ReturnType<typeof createSeedDatabase>, id: string) => db.vehicles.find((v) => v.id === id)!;

describe('vehicle administration', () => {
  it('imports vehicles server-side with the shared plan (UPSERT keeps the rest)', () => {
    const rows = [{ fleetNumber: 8, plateNumber: 'AL A22A20', modelName: 'Kia Sportage Hybrid SX-P' }];
    const { db, result } = importVehicles(createSeedDatabase(), { rows, mode: 'UPSERT', source: '직접 입력' }, ctx);
    expect(result.ok).toBe(true);
    expect(db.vehicles).toHaveLength(30);
    expect(veh(db, 'veh-8')).toMatchObject({ plateNumber: 'AL A22A20', modelName: 'Kia Sportage Hybrid SX-P' });
    expect(db.pushStream[0].message).toMatch(/차량 정보 등록/);
  });

  it('refuses an import whose plate collides with a vehicle that stays', () => {
    const rows = [{ fleetNumber: 8, plateNumber: veh(createSeedDatabase(), 'veh-9').plateNumber, modelName: 'X' }];
    const { result } = importVehicles(createSeedDatabase(), { rows, mode: 'UPSERT', source: 'CSV' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/번호판/);
  });

  it('validates MAC on pairing updates and toggles the admin lock', () => {
    expect(updatePairing(createSeedDatabase(), { vehicleId: 'veh-8', btMacAddress: 'bad', bleBeaconUuid: 'X' }, ctx).result.ok).toBe(false);
    const ok = updatePairing(createSeedDatabase(), { vehicleId: 'veh-8', btMacAddress: 'a4:c1:38:90:08:aa', bleBeaconUuid: 'FG30-08' }, ctx);
    expect(veh(ok.db, 'veh-8').btMacAddress).toBe('A4:C1:38:90:08:AA');
    const locked = toggleVehicleLock(createSeedDatabase(), { vehicleId: 'veh-8' }, ctx);
    expect(veh(locked.db, 'veh-8').isLockedByAdmin).toBe(true);
  });

  it('flags a ghost trip when the odometer exceeds the GPS total by 5 km or more', () => {
    const seed = createSeedDatabase();
    const gps = veh(seed, 'veh-8').cumulativeGpsKm;
    const small = auditOdometer(seed, { vehicleId: 'veh-8', actualOdometerKm: gps + 2 }, ctx);
    expect(small.db.ghostTrips).toHaveLength(seed.ghostTrips.length);
    const big = auditOdometer(seed, { vehicleId: 'veh-8', actualOdometerKm: gps + 12 }, ctx);
    expect(big.db.ghostTrips).toHaveLength(seed.ghostTrips.length + 1);
    expect(big.db.ghostTrips[0]).toMatchObject({ vehicleId: 'veh-8', unaccountedKm: 12 });
    expect(veh(big.db, 'veh-8')).toMatchObject({ lastVerifiedOdometerKm: gps + 12, lastOdometerAuditAt: '16:12:22' });
  });
});

describe('employee administration', () => {
  it('adds, imports (upsert by name/phone) and toggles dispatch rights', () => {
    const added = addEmployee(createSeedDatabase(), { name: '홍길동 사원 (G.D. Hong)', role: '사원', department: 'QA', phone: '(334) 555-0001' }, ctx);
    expect(added.db.employees).toHaveLength(9);
    const imported = importEmployees(added.db, {
      rows: [
        { name: '홍길동 사원 (G.D. Hong)', role: '대리', department: 'QA', phone: '(334) 555-0001', dispatchAllowed: true },
        { name: '김신규 사원', role: '사원', department: '물류', phone: '(334) 555-0002', dispatchAllowed: false },
      ],
    }, ctx);
    expect(imported.db.employees).toHaveLength(10);
    expect(imported.db.employees.find((e) => e.name.startsWith('홍길동'))?.role).toBe('대리');
    const toggled = toggleEmployeeDispatch(imported.db, { employeeId: 'emp-03' }, ctx);
    expect(toggled.db.employees.find((e) => e.id === 'emp-03')?.dispatchAllowed).toBe(true);
  });

  it('resolves an incident and can suspend the driver', () => {
    const seed = createSeedDatabase();
    const inc = seed.incidents.find((i) => i.driverId)!;
    const { db } = resolveIncident(seed, { incidentId: inc.id, resolutionNote: '확인 완료', suspendDriver: true }, ctx);
    expect(db.incidents.find((i) => i.id === inc.id)).toMatchObject({ resolved: true, managerResolutionNote: '확인 완료' });
    expect(db.employees.find((e) => e.id === inc.driverId)?.dispatchAllowed).toBe(false);
  });

  it('updates the policy', () => {
    const seed = createSeedDatabase();
    const { db } = updatePolicy(seed, { policyConfig: { ...seed.policyConfig, autoApproveWhenManagerAway: true } }, ctx);
    expect(db.policyConfig.autoApproveWhenManagerAway).toBe(true);
  });
});

describe('demo sensor simulations', () => {
  it('records an unauthorized start with an incident, geofence log and two alerts', () => {
    const seed = createSeedDatabase();
    const { db, result } = simulateUnauthorizedStart(seed, { employeeId: 'emp-01', vehicleId: 'veh-8', coPassengerId: null }, ctx);
    expect(result.ok).toBe(true);
    expect(veh(db, 'veh-8')).toMatchObject({ status: 'UNAUTHORIZED', currentDriverId: 'emp-01' });
    expect(db.incidents[0]).toMatchObject({ vehicleId: 'veh-8', eventType: 'UNAUTHORIZED_START' });
    expect(db.geofenceLogs).toHaveLength(seed.geofenceLogs.length + 1);
    expect(db.pushStream.slice(0, 2).map((p) => p.target)).toEqual(['MANAGER', 'DRIVER']);
  });

  it('distinguishes a crash from a phone drop', () => {
    const crash = simulateCrashOrDrop(createSeedDatabase(), { vehicleId: 'veh-1', isRealCrash: true }, ctx);
    expect(veh(crash.db, 'veh-1').status).toBe('INCIDENT');
    const drop = simulateCrashOrDrop(createSeedDatabase(), { vehicleId: 'veh-1', isRealCrash: false }, ctx);
    expect(veh(drop.db, 'veh-1').status).not.toBe('INCIDENT');
    expect(drop.db.pushStream[0].message).toMatch(/휴대폰 낙하/);
  });

  it('toggles permission evasion and logs it inside the garage', () => {
    const { db } = togglePermissionEvasion(createSeedDatabase(), { employeeId: 'emp-06' }, ctx);
    expect(db.employees.find((e) => e.id === 'emp-06')?.permissionStatus).toBe('BT_OFF');
    expect(db.geofenceLogs[0]).toMatchObject({ employeeId: 'emp-06', action: 'PERMISSION_DISABLED_IN_ZONE' });
  });
});

describe('telemetry', () => {
  const base = { employeeId: 'emp-06', vehicleId: 'veh-8', plateNumber: 'AL 41B-3196', lat: 32.70, lng: -85.31, speedKmh: 60, hasActiveApproval: true };

  it('records a confirmed crash as an incident and marks the vehicle', () => {
    const { db, result } = applyTelemetry(createSeedDatabase(), { ...base, gForce: 3.2, deltaSpeedKmh: -30, gyroYawDegPerSec: 40, persistToDb: true }, ctx);
    expect(result.incidentVerdict).toBe('CONFIRMED_CRASH');
    expect(veh(db, 'veh-8')).toMatchObject({ status: 'INCIDENT', speedKmh: 0 });
    expect(db.incidents[0]).toMatchObject({ vehicleId: 'veh-8', eventType: 'IMPACT_SHOCK', occurredAt: '16:12:22' });
  });

  it('filters a phone drop and does not write when persistToDb is false', () => {
    const seed = createSeedDatabase();
    const { db, result } = applyTelemetry(seed, { ...base, speedKmh: 0, gForce: 3.2, deltaSpeedKmh: 0, gyroYawDegPerSec: 5 }, ctx);
    expect(result.incidentVerdict).toBe('FILTERED_PHONE_DROP');
    expect(db).toBe(seed);
  });
});
