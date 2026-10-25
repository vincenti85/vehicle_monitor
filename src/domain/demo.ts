// Demo-only sensor simulations (the phone app's "센서 · 무단 테스트" tab). The actions API
// allows these only while the database is in DEMO mode.
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { IncidentEvent } from '@/types/fleet';
import { localTime } from './clock';
import { ActionContext, ActionOutcome, alert, demoPositionNearHq, newId, refuse, withAlerts } from './core';

export function simulateUnauthorizedStart(
  db: FleetDatabaseSchema,
  p: { employeeId: string; vehicleId: string; coPassengerId: string | null },
  ctx: ActionContext
): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  const coEmp = p.coPassengerId ? db.employees.find((e) => e.id === p.coPassengerId) : undefined;
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!emp || !veh) return refuse(db, '운전자 또는 차량 정보를 찾을 수 없습니다.');
  const time = localTime(ctx.now);
  const policy = db.policyConfig;
  const reason = coEmp
    ? `다인 탑승 감지(${emp.name}, ${coEmp.name}) → 키보관함 BLE(${policy.keyboxBleRadiusM}m) 선진입 및 운전석 핸즈프리 주 연결로 [${emp.name}] 주 운전자 특정`
    : `키보관함(${policy.keyboxBleRadiusM}m) 접근 후 ${veh.plateNumber} 블루투스 + 시속 ${policy.unauthorizedSpeedThresholdKmh}km/h 초과 주행 감지`;

  const vehicles = db.vehicles.map((v) =>
    v.id === veh.id
      ? {
          ...v,
          status: 'UNAUTHORIZED' as const,
          speedKmh: 64,
          currentGForce: 1.18,
          rssiDbm: -46,
          currentDriverId: emp.id,
          coPassengerIds: coEmp ? [coEmp.id] : [],
          driverSelectionReason: reason,
          tripPurpose: '미입력(무단반출)' as const,
          tripStartedAt: time,
          parkingZone: '🚨 4400 Northpark Dr 무단 이탈 → I-85 주행중',
          ...demoPositionNearHq(0.014),
        }
      : v
  );
  const incident: IncidentEvent = {
    id: newId('inc', ctx.now),
    vehicleId: veh.id,
    plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
    driverId: emp.id,
    driverName: `${emp.name} (${emp.department})`,
    coPassengerNames: coEmp ? [`${coEmp.name} (동승자 자동분류)`] : [],
    eventType: 'UNAUTHORIZED_START',
    title: `🚨 보고 없이 자동차키 무단 반출 및 주행 포착 (${veh.fleetNumber}호차 · ${veh.plateNumber})`,
    description: reason,
    gForce: 1.18,
    deltaSpeedKmh: 34,
    gyroYawDegPerSec: 3.8,
    impactDirection: '정상 주행 궤적 (충돌 없음)',
    speedTrace: [0, 12, 19, 31, 45, 54, 60, 63, 64, 62, 65, 64],
    locationLabel: '4400 Northpark Dr, Opelika, AL 36801 이탈 → I-85 진입',
    occurredAt: time,
    resolved: false,
    sensorFusionVerdict: 'N/A',
  };
  const geofence = {
    id: newId('geo', ctx.now),
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    zoneType: 'KEYBOX_3M' as const,
    action: 'ENTER' as const,
    timestamp: time,
    permissionState: emp.permissionStatus,
    note: `관리자 부재 중 앱 미등록 상태로 키 보관함 접근 후 ${veh.fleetNumber}호차 시동·출발`,
  };
  return {
    db: withAlerts(
      {
        ...db,
        vehicles,
        incidents: [incident, ...db.incidents],
        geofenceLogs: [geofence, ...db.geofenceLogs],
      },
      alert(ctx, 'MANAGER', 'CRITICAL', `🚨 [Red Alert · 무단 운행] ${emp.name}님이 사전 보고 없이 ${veh.fleetNumber}호차(${veh.plateNumber})를 끌고 나갔습니다!`),
      alert(ctx, 'DRIVER', 'CRITICAL', `⚠️ [운전자 경고] ${emp.name}님, ${veh.plateNumber} 미승인 운행이 관리자에게 실시간 보고되었습니다. 즉시 사유를 입력하세요.`)
    ),
    result: { ok: true, message: `#${veh.fleetNumber}호차 무단 출발 시뮬레이션` },
  };
}

export function simulateCrashOrDrop(
  db: FleetDatabaseSchema,
  p: { vehicleId: string; isRealCrash: boolean },
  ctx: ActionContext
): ActionOutcome {
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!veh) return refuse(db, '차량을 찾을 수 없습니다.');
  if (!p.isRealCrash) {
    return {
      db: withAlerts(
        db,
        alert(ctx, 'MANAGER', 'INFO', `🛡️ [Sensor Fusion 오탐 필터] ${veh.fleetNumber}호차에서 3.4G 단발 충격이 감지되었으나 주행 속도 변화가 없어 '거치대 휴대폰 낙하'로 자동 제외했습니다.`)
      ),
      result: { ok: true, message: '휴대폰 낙하로 판정되어 사고에서 제외' },
    };
  }
  const emp = db.employees.find((e) => e.id === veh.currentDriverId) || db.employees[0];
  if (!emp) return refuse(db, '운전자 정보를 찾을 수 없습니다.');
  const time = localTime(ctx.now);
  const vehicles = db.vehicles.map((v) =>
    v.id === veh.id
      ? {
          ...v,
          status: 'INCIDENT' as const,
          speedKmh: 0,
          currentGForce: 3.24,
          currentDriverId: emp.id,
          parkingZone: '💥 스마트폰 3.24G 충격 감지 후 비상정차 중',
        }
      : v
  );
  const incident: IncidentEvent = {
    id: newId('inc', ctx.now),
    vehicleId: veh.id,
    plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
    driverId: emp.id,
    driverName: `${emp.name} (${emp.department})`,
    coPassengerNames: [],
    eventType: 'IMPACT_SHOCK',
    title: `💥 [스마트폰 6축 센서 재구성] 3.24G 충돌 가속도 및 급정차 감지 (${veh.fleetNumber}호차)`,
    description: `운전자(${emp.name}) 스마트폰의 6축 센서(피크 3.24G + 자이로 38.4°/s)와 2초 내 -44km/h 급감속 정차를 결합해 접촉사고를 재구성했습니다.`,
    gForce: 3.24,
    deltaSpeedKmh: -44,
    gyroYawDegPerSec: 38.4,
    impactDirection: '좌측 전방 25° 추돌 벡터 (스마트폰 6축 IMU 역산)',
    speedTrace: [52, 54, 56, 55, 53, 50, 44, 8, 0, 0, 0, 0],
    locationLabel: 'I-85 Exit 64 / Northpark Dr 인근, Opelika, AL 36801',
    occurredAt: time,
    resolved: false,
    sensorFusionVerdict: 'CONFIRMED_CRASH',
  };
  return {
    db: withAlerts(
      { ...db, vehicles, incidents: [incident, ...db.incidents] },
      alert(ctx, 'MANAGER', 'CRITICAL', `💥 [무블랙박스 사고 재구성] ${veh.fleetNumber}호차(${emp.name}) 스마트폰에서 3.24G 충격 + 자이로 회전 + 급정차가 감지되었습니다!`)
    ),
    result: { ok: true, message: `#${veh.fleetNumber}호차 충돌 감지 시뮬레이션` },
  };
}

export function togglePermissionEvasion(
  db: FleetDatabaseSchema,
  p: { employeeId: string },
  ctx: ActionContext
): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  if (!emp) return refuse(db, '임직원을 찾을 수 없습니다.');
  const time = localTime(ctx.now);
  const turningOff = emp.permissionStatus === 'OK';
  const employees = db.employees.map((e) =>
    e.id === emp.id
      ? {
          ...e,
          permissionStatus: turningOff ? ('BT_OFF' as const) : ('OK' as const),
          lastHeartbeatAt: turningOff ? `${time} (차고지 내 BT 강제 OFF)` : '방금 전 (정상 복구)',
        }
      : e
  );
  if (!turningOff) {
    return { db: { ...db, employees }, result: { ok: true, message: `${emp.name} 권한 정상 복구` } };
  }
  const geofence = {
    id: newId('geo', ctx.now),
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    zoneType: 'GARAGE_150M' as const,
    action: 'PERMISSION_DISABLED_IN_ZONE' as const,
    timestamp: time,
    permissionState: 'BT_OFF' as const,
    note: '⚠️ 차고지 지오펜스 내부에서 블루투스 권한 강제 OFF 감지 (우회 시도 주의)',
  };
  return {
    db: withAlerts(
      { ...db, employees, geofenceLogs: [geofence, ...db.geofenceLogs] },
      alert(ctx, 'MANAGER', 'CRITICAL', `🕵️ [권한 회피 감지] ${emp.name}(${emp.department})님의 앱 블루투스 권한이 차고지 인근에서 꺼졌습니다.`)
    ),
    result: { ok: true, message: `${emp.name} 블루투스 권한 OFF 감지` },
  };
}
