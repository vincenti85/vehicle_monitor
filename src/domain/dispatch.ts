// Dispatch lifecycle on the server: request -> approve/reject -> start -> return.
// Rules are evaluated against the latest stored state, so two devices cannot both win.
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { TaxLogEntry, TripPurpose, Vehicle, VehicleReservation } from '@/types/fleet';
import {
  CONFIRM_BLOCKING_STAGES,
  CREATE_BLOCKING_STAGES,
  findDispatchConflict,
} from '@/utils/dispatchRules';
import { localDate, localTime } from './clock';
import {
  ActionContext,
  ActionOutcome,
  alert,
  demoPositionNearHq,
  garageSlot,
  newId,
  refuse,
  refuseWithNotice,
  shortName,
  withAlerts,
} from './core';

export interface RequestPayload {
  employeeId: string;
  vehicleId: string;
  purpose: TripPurpose;
  destination: string;
  plannedTimeWindow: string;
  notes: string;
}
export interface ReservationRef {
  reservationId: string;
}
export interface QuickStartPayload {
  employeeId: string;
  vehicleId: string;
  purpose: TripPurpose;
}
export interface ReturnPayload {
  reservationId: string;
  parkingZone: string;
  keyReturnedToBox: boolean;
}
export interface VehicleRef {
  vehicleId: string;
}
export interface LateReasonPayload {
  vehicleId: string;
  purpose: TripPurpose;
}

const mapVehicle = (db: FleetDatabaseSchema, id: string, fn: (v: Vehicle) => Vehicle) =>
  db.vehicles.map((v) => (v.id === id ? fn(v) : v));
const mapReservation = (db: FleetDatabaseSchema, id: string, fn: (r: VehicleReservation) => VehicleReservation) =>
  db.reservations.map((r) => (r.id === id ? fn(r) : r));

/** Vehicle state while driving. LIVE mode keeps real values; DEMO shows a plausible trip. */
function drivingState(db: FleetDatabaseSchema, v: Vehicle, demoSpeed: number, spread: number) {
  return db.dataMode === 'LIVE'
    ? { speedKmh: 0, lat: v.lat, lng: v.lng }
    : { speedKmh: demoSpeed, ...demoPositionNearHq(spread) };
}

function parkedState(v: Vehicle, parkingZone: string, odometerKm?: number): Vehicle {
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
    ...(odometerKm !== undefined ? { cumulativeGpsKm: odometerKm, lastVerifiedOdometerKm: odometerKm } : {}),
    parkingZone,
    ...garageSlot(v.fleetNumber),
  };
}

export function requestDispatch(db: FleetDatabaseSchema, p: RequestPayload, ctx: ActionContext): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!emp || !veh) return refuse(db, '운전자 또는 차량 정보를 찾을 수 없습니다.');

  if (emp.dispatchAllowed === false) {
    return refuseWithNotice(
      db, ctx, 'DRIVER',
      `🚫 [배차 신청 차단됨] ${shortName(emp.name)}님은 권한 미준수 또는 무단반출 이력으로 관리자에 의해 배차 자격이 일시 정지되었습니다.`,
      '배차 자격이 일시 정지되어 신청할 수 없습니다. 관리자에게 문의하세요.'
    );
  }
  if (veh.isLockedByAdmin) {
    return refuseWithNotice(
      db, ctx, 'DRIVER',
      `🚫 [차량 잠금 상태] #${veh.fleetNumber}호차(${veh.plateNumber})는 관리자에 의해 배차 차단(점검) 상태입니다.`,
      `#${veh.fleetNumber}호차는 관리자가 잠근 차량(점검)이라 신청할 수 없습니다.`
    );
  }
  const conflict = findDispatchConflict(veh, db.reservations, CREATE_BLOCKING_STAGES);
  if (conflict) {
    return refuseWithNotice(db, ctx, 'DRIVER', `🚫 [중복 배차 신청 차단] ${shortName(emp.name)}님의 신청을 막았습니다. ${conflict}`, conflict);
  }

  const time = localTime(ctx.now);
  const autoApprove = db.policyConfig.autoApproveWhenManagerAway;
  const reservation: VehicleReservation = {
    id: newId('res', ctx.now),
    vehicleId: veh.id,
    fleetNumber: veh.fleetNumber,
    plateNumber: veh.plateNumber,
    modelName: veh.modelName,
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    purpose: p.purpose,
    destination: p.destination,
    plannedTimeWindow: p.plannedTimeWindow,
    stage: autoApprove ? 'APPROVED' : 'REQUESTED',
    requestedAt: time,
    approvedAt: autoApprove ? time : null,
    approvedBy: autoApprove ? '관리자 부재 중 자동승인 (Auto-Approve)' : null,
    startedAt: null,
    returnedAt: null,
    startOdometerKm: veh.cumulativeGpsKm,
    endOdometerKm: null,
    returnParkingZone: null,
    keyReturnedToBox: false,
    notes: p.notes,
  };
  const notice = autoApprove
    ? alert(ctx, 'DRIVER', 'INFO', `✅ [배차 자동 승인] ${shortName(emp.name)}님, #${veh.fleetNumber}호차(${veh.plateNumber}) 신청이 자동 승인되었습니다. 키보관함에서 키를 수령해 운행을 시작하세요.`)
    : alert(ctx, 'MANAGER', 'INFO', `📋 [배차 승인 요청] ${shortName(emp.name)}님이 #${veh.fleetNumber}호차(${veh.plateNumber}) 배차를 신청했습니다. (행선지: ${p.destination})`);

  return {
    db: withAlerts({ ...db, reservations: [reservation, ...db.reservations] }, notice),
    result: {
      ok: true,
      message: autoApprove
        ? `#${veh.fleetNumber}호차 신청이 자동 승인되었습니다. 키를 수령해 운행을 시작하세요.`
        : `#${veh.fleetNumber}호차 배차 신청 완료 — 관리자 승인을 기다리세요.`,
    },
  };
}

export function approveDispatch(db: FleetDatabaseSchema, p: ReservationRef, ctx: ActionContext): ActionOutcome {
  const res = db.reservations.find((r) => r.id === p.reservationId);
  const veh = res && db.vehicles.find((v) => v.id === res.vehicleId);
  if (!res || !veh) return refuse(db, '배차 건 또는 차량을 찾을 수 없습니다.');
  if (res.stage !== 'REQUESTED') return refuse(db, '승인대기 상태의 건만 승인할 수 있습니다.');
  const conflict = findDispatchConflict(veh, db.reservations, CONFIRM_BLOCKING_STAGES, res.id);
  if (conflict) {
    return refuseWithNotice(db, ctx, 'MANAGER', `⚠️ [중복 배차 승인 차단] ${shortName(res.employeeName)}님 신청을 승인하지 않았습니다. ${conflict}`, conflict);
  }
  const reservations = mapReservation(db, res.id, (r) => ({
    ...r,
    stage: 'APPROVED',
    approvedAt: localTime(ctx.now),
    approvedBy: '차량총괄관리자 (Fleet Admin)',
    notes: '관리자 승인 완료 — 4400 Northpark Dr 키보관함 수령 가능',
  }));
  return {
    db: withAlerts(
      { ...db, reservations },
      alert(ctx, 'DRIVER', 'INFO', `✅ [배차 승인 완료] ${shortName(res.employeeName)}님, 신청하신 #${res.fleetNumber}호차(${res.plateNumber}) 배차가 승인되었습니다. 키 수령 후 사용을 시작하세요.`)
    ),
    result: { ok: true, message: `#${res.fleetNumber}호차 승인 완료` },
  };
}

export function rejectDispatch(db: FleetDatabaseSchema, p: ReservationRef, ctx: ActionContext): ActionOutcome {
  const res = db.reservations.find((r) => r.id === p.reservationId);
  if (!res) return refuse(db, '배차 건을 찾을 수 없습니다.');
  if (res.stage !== 'REQUESTED') return refuse(db, '승인대기 상태의 건만 반려할 수 있습니다.');
  const reservations = mapReservation(db, res.id, (r) => ({
    ...r,
    stage: 'REJECTED',
    notes: '관리자 반려 (타 부서 긴급 일정 중복 또는 권한 미충족)',
  }));
  return {
    db: withAlerts(
      { ...db, reservations },
      alert(ctx, 'DRIVER', 'CRITICAL', `❌ [배차 반려 알림] ${shortName(res.employeeName)}님, #${res.fleetNumber}호차(${res.plateNumber}) 배차 신청이 반려되었습니다.`)
    ),
    result: { ok: true, message: `#${res.fleetNumber}호차 신청 반려` },
  };
}

export function startDispatch(db: FleetDatabaseSchema, p: ReservationRef, ctx: ActionContext): ActionOutcome {
  const res = db.reservations.find((r) => r.id === p.reservationId);
  const veh = res && db.vehicles.find((v) => v.id === res.vehicleId);
  if (!res || !veh) return refuse(db, '배차 건 또는 차량을 찾을 수 없습니다.');
  if (res.stage !== 'APPROVED') return refuse(db, '승인완료 상태의 건만 운행을 시작할 수 있습니다.');
  const conflict = findDispatchConflict(veh, db.reservations, CONFIRM_BLOCKING_STAGES, res.id);
  if (conflict) {
    return refuseWithNotice(db, ctx, 'DRIVER', `🚫 [운행 시작 차단] ${shortName(res.employeeName)}님 운행 시작을 막았습니다. ${conflict}`, conflict);
  }
  const time = localTime(ctx.now);
  const reservations = mapReservation(db, res.id, (r) => ({
    ...r,
    stage: 'IN_USE',
    startedAt: time,
    notes: `운행 시작 (${res.destination} 방면 이동 중)`,
  }));
  const vehicles = mapVehicle(db, veh.id, (v) => ({
    ...v,
    status: 'AUTHORIZED',
    currentGForce: 1.01,
    rssiDbm: -48,
    currentDriverId: res.employeeId,
    coPassengerIds: [],
    driverSelectionReason: `정식 배차 승인(${res.id}) + 4400 Northpark Dr 키 수령`,
    tripPurpose: res.purpose,
    tripStartedAt: time,
    parkingZone: `${res.destination} 방면 운행중`,
    ...drivingState(db, v, 58, 0.016),
  }));
  return {
    db: withAlerts(
      { ...db, reservations, vehicles },
      alert(ctx, 'MANAGER', 'INFO', `🚗 [차량 사용 시작] ${shortName(res.employeeName)}님이 승인된 #${res.fleetNumber}호차(${res.plateNumber}) 키를 수령해 운행을 개시했습니다.`)
    ),
    result: { ok: true, message: `#${res.fleetNumber}호차 운행 시작` },
  };
}

export function quickStartDispatch(db: FleetDatabaseSchema, p: QuickStartPayload, ctx: ActionContext): ActionOutcome {
  const emp = db.employees.find((e) => e.id === p.employeeId);
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!emp || !veh) return refuse(db, '운전자 또는 차량 정보를 찾을 수 없습니다.');

  // Driver already holds an approved booking for this car: start it instead of a new one
  const ownApproved = db.reservations.find(
    (r) => r.vehicleId === veh.id && r.employeeId === emp.id && r.stage === 'APPROVED'
  );
  if (ownApproved) return startDispatch(db, { reservationId: ownApproved.id }, ctx);

  if (emp.dispatchAllowed === false) {
    return refuse(db, '배차 자격이 일시 정지되어 출발할 수 없습니다. 관리자에게 문의하세요.');
  }
  if (veh.isLockedByAdmin) {
    return refuse(db, `#${veh.fleetNumber}호차는 관리자가 잠근 차량(점검)이라 출발할 수 없습니다.`);
  }
  const conflict = findDispatchConflict(veh, db.reservations, CREATE_BLOCKING_STAGES);
  if (conflict) {
    return refuseWithNotice(db, ctx, 'DRIVER', `🚫 [중복 출발 차단] ${shortName(emp.name)}님의 1초 출발을 막았습니다. ${conflict}`, conflict);
  }

  const time = localTime(ctx.now);
  const reservation: VehicleReservation = {
    id: newId('res', ctx.now),
    vehicleId: veh.id,
    fleetNumber: veh.fleetNumber,
    plateNumber: veh.plateNumber,
    modelName: veh.modelName,
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    purpose: p.purpose,
    destination: 'I-85 Opelika Corridor (원터치 자율반출)',
    plannedTimeWindow: `${time.slice(0, 5)} ~ 당일복귀`,
    stage: 'IN_USE',
    requestedAt: time,
    approvedAt: time,
    approvedBy: '원터치 자율반출 자동승인',
    startedAt: time,
    returnedAt: null,
    startOdometerKm: veh.cumulativeGpsKm,
    endOdometerKm: null,
    returnParkingZone: null,
    keyReturnedToBox: false,
    notes: '관리자 부재 시 1초 원터치 자율 반출로 즉시 운행 개시',
  };
  const vehicles = mapVehicle(db, veh.id, (v) => ({
    ...v,
    status: 'AUTHORIZED',
    currentGForce: 1.02,
    rssiDbm: -48,
    currentDriverId: emp.id,
    coPassengerIds: [],
    driverSelectionReason: '1초 원터치 자율 반출',
    tripPurpose: p.purpose,
    tripStartedAt: time,
    parkingZone: `외근 운행중 (${p.purpose})`,
    ...drivingState(db, v, 46, 0.015),
  }));
  return {
    db: withAlerts(
      { ...db, reservations: [reservation, ...db.reservations], vehicles },
      alert(ctx, 'MANAGER', 'INFO', `✅ [원터치 자율 반출] ${emp.name}님이 ${veh.fleetNumber}호차(${veh.plateNumber})를 [${p.purpose}] 목적으로 반출했습니다.`)
    ),
    result: { ok: true, message: `#${veh.fleetNumber}호차 1초 출발 — 운행이 기록되었습니다.` },
  };
}

function taxRow(
  ctx: ActionContext,
  fields: Omit<TaxLogEntry, 'id' | 'date' | 'endTime' | 'autoReturnVerified'>
): TaxLogEntry {
  return {
    id: newId('tax', ctx.now),
    date: localDate(ctx.now),
    endTime: localTime(ctx.now).slice(0, 5),
    autoReturnVerified: true,
    ...fields,
  };
}

export function returnVehicle(db: FleetDatabaseSchema, p: ReturnPayload, ctx: ActionContext): ActionOutcome {
  const res = db.reservations.find((r) => r.id === p.reservationId);
  if (!res) return refuse(db, '배차 건을 찾을 수 없습니다.');
  if (res.stage !== 'IN_USE') return refuse(db, '운행중인 건만 반납할 수 있습니다.');
  const veh = db.vehicles.find((v) => v.id === res.vehicleId);
  // Distance accumulated since trip start (never negative)
  const endOdometer = Number(Math.max(veh?.cumulativeGpsKm ?? res.startOdometerKm, res.startOdometerKm).toFixed(1));
  const drivenKm = Number((endOdometer - res.startOdometerKm).toFixed(1));
  const time = localTime(ctx.now);

  const reservations = mapReservation(db, res.id, (r) => ({
    ...r,
    stage: 'RETURNED',
    returnedAt: time,
    endOdometerKm: endOdometer,
    returnParkingZone: p.parkingZone,
    keyReturnedToBox: p.keyReturnedToBox,
    notes: `반납 완료 (${p.parkingZone} 주차 · 키보관함 반납: ${p.keyReturnedToBox ? '완료' : '미확인'} · +${drivenKm}km)`,
  }));
  const vehicles = mapVehicle(db, res.vehicleId, (v) => parkedState(v, `${p.parkingZone} (반납 완료)`, endOdometer));
  const log = taxRow(ctx, {
    plateNumber: `${res.plateNumber} (${res.fleetNumber}호차)`,
    modelName: veh?.modelName || res.modelName,
    department: res.department.split(' (')[0],
    driverName: res.employeeName,
    authType: 'PRE_REGISTERED',
    purpose: res.purpose,
    startTime: (res.startedAt || time).slice(0, 5),
    startOdometerKm: res.startOdometerKm,
    endOdometerKm: endOdometer,
    distanceKm: drivenKm,
  });
  return {
    db: withAlerts(
      { ...db, reservations, vehicles, taxLogs: [log, ...db.taxLogs] },
      alert(ctx, 'MANAGER', 'INFO', `🅿️ [차량·키 반납 완료] ${shortName(res.employeeName)}님이 #${res.fleetNumber}호차(${res.plateNumber})를 ${p.parkingZone}에 반납했습니다. (+${drivenKm}km 운행기록부 자동 생성)`)
    ),
    result: { ok: true, message: `#${res.fleetNumber}호차 반납 완료 (+${drivenKm}km)` },
  };
}

export function autoReturnVehicle(db: FleetDatabaseSchema, p: VehicleRef, ctx: ActionContext): ActionOutcome {
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!veh) return refuse(db, '차량을 찾을 수 없습니다.');
  if (veh.status === 'IDLE') return refuse(db, `#${veh.fleetNumber}호차는 이미 차고지 대기 상태입니다.`);
  const emp = db.employees.find((e) => e.id === veh.currentDriverId) || db.employees[0];
  const activeRes = db.reservations.find((r) => r.vehicleId === veh.id && r.stage === 'IN_USE');
  const endKm = Number(veh.cumulativeGpsKm.toFixed(1));
  const startKm = Number(Math.min(activeRes?.startOdometerKm ?? veh.lastVerifiedOdometerKm, endKm).toFixed(1));
  const tripDistance = Number((endKm - startKm).toFixed(1));
  const autoLot = `Northpark Lot A #${veh.fleetNumber.toString().padStart(2, '0')}`;
  const time = localTime(ctx.now);

  const reservations = db.reservations.map((r) =>
    r.vehicleId === veh.id && r.stage === 'IN_USE'
      ? {
          ...r,
          stage: 'RETURNED' as const,
          returnedAt: time,
          endOdometerKm: endKm,
          returnParkingZone: autoLot,
          keyReturnedToBox: true,
          notes: `차고지 지오펜스 복귀로 자동 반납 완료 (+${tripDistance}km)`,
        }
      : r
  );
  const log = taxRow(ctx, {
    plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
    modelName: veh.modelName,
    department: emp ? emp.department.split(' (')[0] : '',
    driverName: emp ? emp.name : '미상',
    authType: veh.status === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'PRE_REGISTERED',
    purpose: veh.tripPurpose || '일반업무/외근',
    startTime: (veh.tripStartedAt || time).slice(0, 5),
    startOdometerKm: startKm,
    endOdometerKm: endKm,
    distanceKm: tripDistance,
  });
  const vehicles = mapVehicle(db, veh.id, (v) => ({
    ...parkedState(v, `${autoLot} (자동반납 완료)`),
    lastVerifiedOdometerKm: endKm,
  }));
  return {
    db: withAlerts(
      { ...db, reservations, vehicles, taxLogs: [log, ...db.taxLogs] },
      alert(ctx, 'MANAGER', 'INFO', `🅿️ [무조작 자동 반납] ${veh.fleetNumber}호차(${veh.plateNumber})가 4400 Northpark Dr 차고지 복귀로 자동 반납되었습니다.`)
    ),
    result: { ok: true, message: `#${veh.fleetNumber}호차 자동 반납 완료` },
  };
}

export function submitLateReason(db: FleetDatabaseSchema, p: LateReasonPayload, ctx: ActionContext): ActionOutcome {
  const veh = db.vehicles.find((v) => v.id === p.vehicleId);
  if (!veh) return refuse(db, '차량을 찾을 수 없습니다.');
  if (veh.status !== 'UNAUTHORIZED') return refuse(db, '미승인 운행중인 차량에만 사후 사유를 입력할 수 있습니다.');
  const emp = db.employees.find((e) => e.id === veh.currentDriverId) || db.employees[0];
  if (!emp) return refuse(db, '운전자 정보를 찾을 수 없습니다.');
  const time = localTime(ctx.now);
  const reservation: VehicleReservation = {
    id: newId('res', ctx.now),
    vehicleId: veh.id,
    fleetNumber: veh.fleetNumber,
    plateNumber: veh.plateNumber,
    modelName: veh.modelName,
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    purpose: p.purpose,
    destination: '선출발 후보고 전환 운행',
    plannedTimeWindow: `${time.slice(0, 5)} ~ 당일복귀`,
    stage: 'IN_USE',
    requestedAt: time,
    approvedAt: time,
    approvedBy: '선출발 후보고 (경고 알림 응답)',
    startedAt: veh.tripStartedAt || time,
    returnedAt: null,
    startOdometerKm: veh.cumulativeGpsKm,
    endOdometerKm: null,
    returnParkingZone: null,
    keyReturnedToBox: false,
    notes: '미승인 출발 경고 수신 후 운행 목적 사후 등록',
  };
  const vehicles = mapVehicle(db, veh.id, (v) => ({
    ...v,
    status: 'AUTHORIZED',
    tripPurpose: p.purpose,
    parkingZone: `선출발 후보고 전환 (${p.purpose})`,
  }));
  return {
    db: withAlerts(
      { ...db, reservations: [reservation, ...db.reservations], vehicles },
      alert(ctx, 'MANAGER', 'INFO', `📝 [사후 사유 입력됨] ${veh.fleetNumber}호차(${veh.plateNumber}) 운전자가 [${p.purpose}] 사유를 사후 등록했습니다. ('선출발 후보고' 이력 보존)`)
    ),
    result: { ok: true, message: `#${veh.fleetNumber}호차 사후 사유 등록 완료` },
  };
}
