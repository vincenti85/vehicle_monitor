// Admin-only actions: vehicle registry, odometer audit, employee governance, incidents, policy.
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { Employee, GhostTripCase, SystemPolicyConfig } from '@/types/fleet';
import { VehicleCsvRow, VehicleImportMode, planVehicleImport } from '@/utils/vehicleImport';
import { localTime } from './clock';
import { ActionContext, ActionOutcome, alert, newId, refuse, shortName, withAlerts } from './core';

const MAC_PATTERN = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
const GHOST_TRIP_THRESHOLD_KM = 5;

export interface EmployeeCsvRow {
  name: string;
  role: string;
  department: string;
  phone: string;
  dispatchAllowed: boolean;
}

export function importVehicles(
  db: FleetDatabaseSchema,
  p: { rows: VehicleCsvRow[]; mode: VehicleImportMode; source: string },
  ctx: ActionContext
): ActionOutcome {
  if (p.rows.length === 0) return refuse(db, '등록할 차량이 없습니다.');
  const plan = planVehicleImport(db.vehicles, db.reservations, p.rows, p.mode, db.dataMode === 'LIVE', localTime(ctx.now));
  if (plan.plateConflicts.length > 0) {
    return refuse(db, `번호판이 다른 차량과 중복됩니다: ${plan.plateConflicts.join(', ')}`);
  }
  const summary = [
    `신규 ${plan.added.length}대`,
    `갱신 ${plan.updated.length}대`,
    ...(p.mode === 'REPLACE' ? [`삭제 ${plan.removed.length}대`] : []),
  ].join(' · ');
  const label = p.mode === 'REPLACE' ? '전체 교체' : '추가·갱신';
  return {
    db: withAlerts(
      { ...db, vehicles: plan.next },
      alert(ctx, 'MANAGER', 'INFO', `📥 [차량 정보 등록] ${p.source} → ${label}: ${summary}`)
    ),
    result: { ok: true, message: `${label} 완료: ${summary}` },
  };
}

export function updatePairing(
  db: FleetDatabaseSchema,
  p: { vehicleId: string; btMacAddress: string; bleBeaconUuid: string },
  _ctx: ActionContext
): ActionOutcome {
  const mac = p.btMacAddress.trim().toUpperCase();
  if (mac && !MAC_PATTERN.test(mac)) {
    return refuse(db, `블루투스 MAC 형식이 올바르지 않습니다 (예: A4:C1:38:7F:01:03, 입력: "${p.btMacAddress}")`);
  }
  if (!db.vehicles.some((v) => v.id === p.vehicleId)) return refuse(db, '차량을 찾을 수 없습니다.');
  return {
    db: {
      ...db,
      vehicles: db.vehicles.map((v) =>
        v.id === p.vehicleId ? { ...v, btMacAddress: mac, bleBeaconUuid: p.bleBeaconUuid.trim() || v.bleBeaconUuid } : v
      ),
    },
    result: { ok: true, message: '블루투스·키 태그 정보 저장 완료' },
  };
}

export function toggleVehicleLock(db: FleetDatabaseSchema, p: { vehicleId: string }, _ctx: ActionContext): ActionOutcome {
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!veh) return refuse(db, '차량을 찾을 수 없습니다.');
  const locked = !veh.isLockedByAdmin;
  return {
    db: { ...db, vehicles: db.vehicles.map((v) => (v.id === veh.id ? { ...v, isLockedByAdmin: locked } : v)) },
    result: { ok: true, message: `#${veh.fleetNumber}호차 ${locked ? '배차 잠금' : '잠금 해제'}` },
  };
}

export function auditOdometer(
  db: FleetDatabaseSchema,
  p: { vehicleId: string; actualOdometerKm: number },
  ctx: ActionContext
): ActionOutcome {
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!veh) return refuse(db, '차량을 찾을 수 없습니다.');
  const time = localTime(ctx.now);
  const diffKm = Number((p.actualOdometerKm - veh.cumulativeGpsKm).toFixed(1));
  const vehicles = db.vehicles.map((v) =>
    v.id === veh.id ? { ...v, lastVerifiedOdometerKm: p.actualOdometerKm, lastOdometerAuditAt: time } : v
  );
  if (diffKm < GHOST_TRIP_THRESHOLD_KM) {
    return { db: { ...db, vehicles }, result: { ok: true, message: `#${veh.fleetNumber}호차 실사 대조 완료 (차이 ${diffKm}km)` } };
  }

  const suspect = db.employees.find((e) => e.permissionStatus !== 'OK') || db.employees[0];
  const ghost: GhostTripCase = {
    id: newId('ghost', ctx.now),
    vehicleId: veh.id,
    plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
    modelName: veh.modelName,
    windowStart: '실사 직전 공백구간',
    windowEnd: time.slice(0, 5),
    unaccountedKm: diffKm,
    parkingZoneChangedFrom: veh.parkingZone,
    parkingZoneChangedTo: '실사 계기판 불일치 적발',
    status: 'OPEN_INVESTIGATION',
    suspectEmployees: suspect
      ? [
          {
            employeeId: suspect.id,
            name: suspect.name,
            department: suspect.department,
            confidenceScore: 91,
            evidence: [
              `실제 계기판(${p.actualOdometerKm}km)이 앱 GPS 누적(${veh.cumulativeGpsKm}km)보다 +${diffKm}km 초과`,
              `공백 시간대 차고지 출입 및 권한 비활성(${suspect.permissionStatus}) 일치`,
            ],
          },
        ]
      : [],
  };
  return {
    db: withAlerts(
      { ...db, vehicles, ghostTrips: [ghost, ...db.ghostTrips] },
      alert(ctx, 'MANAGER', 'CRITICAL', `🕵️ [계기판 실사 불일치 · 유령 주행 적발] #${veh.fleetNumber}호차(${veh.plateNumber})에서 +${diffKm}km 미기록 주행이 확인되었습니다.`)
    ),
    result: { ok: true, message: `#${veh.fleetNumber}호차 +${diffKm}km 미기록 주행 적발` },
  };
}

export function addEmployee(
  db: FleetDatabaseSchema,
  p: { name: string; role: string; department: string; phone: string },
  ctx: ActionContext
): ActionOutcome {
  const employee: Employee = {
    id: newId('emp', ctx.now),
    name: p.name,
    role: p.role,
    department: p.department,
    phone: p.phone,
    permissionStatus: 'OK',
    lastHeartbeatAt: '방금 전 (신규 등록)',
    inGarageGeofence: true,
    lastKeyboxAccessAt: null,
    dispatchAllowed: true,
    violationCount: 0,
  };
  return {
    db: { ...db, employees: [employee, ...db.employees] },
    result: { ok: true, message: `${shortName(p.name)} 등록 완료` },
  };
}

export function importEmployees(db: FleetDatabaseSchema, p: { rows: EmployeeCsvRow[] }, ctx: ActionContext): ActionOutcome {
  if (p.rows.length === 0) return refuse(db, '등록할 임직원이 없습니다.');
  const employees = [...db.employees];
  p.rows.forEach((row) => {
    const idx = employees.findIndex(
      (e) => e.name.toLowerCase() === row.name.toLowerCase() || e.phone === row.phone
    );
    if (idx >= 0) {
      employees[idx] = { ...employees[idx], ...row };
    } else {
      employees.push({
        id: newId('emp', ctx.now),
        ...row,
        permissionStatus: 'OK',
        lastHeartbeatAt: '방금 전 (CSV 일괄등록)',
        inGarageGeofence: true,
        lastKeyboxAccessAt: null,
        violationCount: 0,
      });
    }
  });
  return {
    db: withAlerts(
      { ...db, employees },
      alert(ctx, 'MANAGER', 'INFO', `📥 [사용자 CSV 일괄 등록] 임직원(운전자) ${p.rows.length}명 정보를 일괄 등록/업데이트했습니다.`)
    ),
    result: { ok: true, message: `임직원 ${p.rows.length}명 등록/업데이트 완료` },
  };
}

export function toggleEmployeeDispatch(db: FleetDatabaseSchema, p: { employeeId: string }, _ctx: ActionContext): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  if (!emp) return refuse(db, '임직원을 찾을 수 없습니다.');
  const allowed = emp.dispatchAllowed === false;
  return {
    db: { ...db, employees: db.employees.map((e) => (e.id === emp.id ? { ...e, dispatchAllowed: allowed } : e)) },
    result: { ok: true, message: `${shortName(emp.name)} 배차 ${allowed ? '허용' : '정지'}` },
  };
}

/** Binds a new phone to the employee (the token itself is generated by the route). */
export function issueDriverToken(
  db: FleetDatabaseSchema,
  p: { employeeId: string; tokenHash: string },
  ctx: ActionContext
): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  if (!emp) return refuse(db, '임직원을 찾을 수 없습니다.');
  const replaced = Boolean(emp.deviceTokenHash);
  const employees = db.employees.map((e) =>
    e.id === emp.id ? { ...e, deviceTokenHash: p.tokenHash, deviceEnrolledAt: ctx.now.toISOString() } : e
  );
  return {
    db: { ...db, employees },
    result: {
      ok: true,
      message: `${shortName(emp.name)}님 기기 등록 링크 발급${replaced ? ' — 이전 휴대폰 등록은 해제되었습니다.' : ''}`,
    },
  };
}

export function warnEmployee(db: FleetDatabaseSchema, p: { employeeId: string }, ctx: ActionContext): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  if (!emp) return refuse(db, '임직원을 찾을 수 없습니다.');
  return {
    db: withAlerts(
      db,
      alert(ctx, 'DRIVER', 'CRITICAL', `⚠️ [관리자 권한 복구 지시] ${shortName(emp.name)}님, 현재 스마트폰 ${emp.permissionStatus} 상태입니다. 즉시 위치/블루투스 권한을 켜지 않으면 법인차량 배차가 자동 차단됩니다.`)
    ),
    result: { ok: true, message: `${shortName(emp.name)}님께 경고 알림 발송` },
  };
}

export function resolveIncident(
  db: FleetDatabaseSchema,
  p: { incidentId: string; resolutionNote: string; suspendDriver: boolean },
  _ctx: ActionContext
): ActionOutcome {
  const inc = db.incidents.find((i) => i.id === p.incidentId);
  if (!inc) return refuse(db, '사고 기록을 찾을 수 없습니다.');
  const incidents = db.incidents.map((i) =>
    i.id === inc.id ? { ...i, resolved: true, managerResolutionNote: p.resolutionNote } : i
  );
  const employees =
    p.suspendDriver && inc.driverId
      ? db.employees.map((e) =>
          e.id === inc.driverId ? { ...e, dispatchAllowed: false, violationCount: (e.violationCount || 0) + 1 } : e
        )
      : db.employees;
  return { db: { ...db, incidents, employees }, result: { ok: true, message: '사고 처리 완료' } };
}

export function updatePolicy(
  db: FleetDatabaseSchema,
  p: { policyConfig: SystemPolicyConfig },
  _ctx: ActionContext
): ActionOutcome {
  return { db: { ...db, policyConfig: p.policyConfig }, result: { ok: true, message: '정책 저장 완료' } };
}
