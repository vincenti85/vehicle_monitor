// Action registry: maps each API action type to its domain function and permissions.
import { clearDemoState, resetDemoState } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import type { ActionRequest, ActionType } from '@/lib/actionSchemas';
import { resolveDriverId } from '@/lib/driverToken';
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
  warnEmployee,
} from './admin';
import { ActionContext, ActionOutcome, refuse } from './core';
import { simulateCrashOrDrop, simulateUnauthorizedStart, togglePermissionEvasion } from './demo';
import {
  approveDispatch,
  autoReturnVehicle,
  quickStartDispatch,
  rejectDispatch,
  requestDispatch,
  returnVehicle,
  startDispatch,
  submitLateReason,
} from './dispatch';
import { recordTripPosition } from './trip';

type PayloadOf<T extends ActionType> = Extract<ActionRequest, { type: T }>['payload'];

interface ActionSpec<T extends ActionType> {
  /** Requires a valid admin PIN (checked by the route before any read). */
  admin?: boolean;
  /** Allowed only while the database holds demo data. */
  demoOnly?: boolean;
  /**
   * Driver action: the employee who must be sending it (undefined = target not found, left
   * to the action to refuse). In LIVE mode a non-admin caller needs that employee's phone token.
   */
  driver?: (db: FleetDatabaseSchema, payload: PayloadOf<T>) => string | null | undefined;
  run: (db: FleetDatabaseSchema, payload: PayloadOf<T>, ctx: ActionContext) => ActionOutcome;
}

const bookingDriver = (db: FleetDatabaseSchema, p: { reservationId: string }) =>
  db.reservations.find((r) => r.id === p.reservationId)?.employeeId;
const vehicleDriver = (db: FleetDatabaseSchema, p: { vehicleId: string }) =>
  db.vehicles.find((v) => v.id === p.vehicleId)?.currentDriverId;

const ACTIONS: { [T in ActionType]: ActionSpec<T> } = {
  'dispatch.request': { driver: (_db, p) => p.employeeId, run: requestDispatch },
  'dispatch.approve': { admin: true, run: approveDispatch },
  'dispatch.reject': { admin: true, run: rejectDispatch },
  'dispatch.start': { driver: bookingDriver, run: startDispatch },
  'dispatch.quickStart': { driver: (_db, p) => p.employeeId, run: quickStartDispatch },
  'dispatch.return': { driver: bookingDriver, run: returnVehicle },
  'dispatch.autoReturn': { driver: vehicleDriver, run: autoReturnVehicle },
  'dispatch.lateReason': { driver: vehicleDriver, run: submitLateReason },
  'trip.position': { driver: bookingDriver, run: recordTripPosition },
  'vehicle.import': { admin: true, run: importVehicles },
  'vehicle.updatePairing': { admin: true, run: updatePairing },
  'vehicle.toggleLock': { admin: true, run: toggleVehicleLock },
  'vehicle.auditOdometer': { admin: true, run: auditOdometer },
  'employee.add': { admin: true, run: addEmployee },
  'employee.import': { admin: true, run: importEmployees },
  'employee.toggleDispatch': { admin: true, run: toggleEmployeeDispatch },
  'employee.warn': { admin: true, run: warnEmployee },
  'incident.resolve': { admin: true, run: resolveIncident },
  'policy.update': { admin: true, run: updatePolicy },
  'demo.unauthorizedStart': { demoOnly: true, run: simulateUnauthorizedStart },
  'demo.crashOrDrop': { demoOnly: true, run: simulateCrashOrDrop },
  'demo.permissionToggle': { demoOnly: true, run: togglePermissionEvasion },
  'admin.clearDemo': {
    admin: true,
    run: (db, p) => {
      if (db.dataMode === 'LIVE') return refuse(db, '이미 실운영 모드입니다. 데모 기록 정리는 한 번만 할 수 있습니다.');
      const { db: next, result } = clearDemoState(db, p.removeDemoEmployees);
      const kept = result.keptDemoEmployeesBecauseNoRealOnes ? ' 실제 임직원이 아직 없어 데모 임직원은 유지했습니다.' : '';
      return {
        db: next,
        result: {
          ok: true,
          message: `실운영 모드로 전환했습니다. 데모 배차·사고·운행일지·알림을 비우고 차량을 모두 차고지 대기로 되돌렸습니다. 데모 임직원 ${result.removedDemoEmployees}명 삭제.${kept}`,
        },
      };
    },
  },
  'admin.resetDemo': {
    admin: true,
    run: (db) =>
      db.dataMode === 'LIVE'
        ? refuse(db, '실운영 데이터가 보호 중이라 데모 초기화를 할 수 없습니다.')
        : { db: resetDemoState(db), result: { ok: true, message: '데모 데이터로 초기화했습니다.' } },
  },
};

export function requiresAdmin(type: ActionType): boolean {
  return ACTIONS[type].admin === true;
}

/** Applies one validated action to the given state (pure; no I/O). */
export function runAction(db: FleetDatabaseSchema, action: ActionRequest, ctx: ActionContext): ActionOutcome {
  const spec = ACTIONS[action.type] as ActionSpec<typeof action.type>;
  if (spec.demoOnly && db.dataMode === 'LIVE') {
    return refuse(db, '센서·무단 시뮬레이션은 데모 모드에서만 사용할 수 있습니다.');
  }
  const identityRefusal = checkDriverIdentity(db, spec, action.payload as never, ctx);
  if (identityRefusal) return refuse(db, identityRefusal);
  return spec.run(db, action.payload as never, ctx);
}

/** Refusal message when a LIVE driver action does not come from that driver's enrolled phone. */
function checkDriverIdentity<T extends ActionType>(
  db: FleetDatabaseSchema,
  spec: ActionSpec<T>,
  payload: PayloadOf<T>,
  ctx: ActionContext
): string | null {
  // DEMO data stays open so the demo works without enrolling phones
  if (!spec.driver || ctx.isAdmin || db.dataMode !== 'LIVE') return null;
  const required = spec.driver(db, payload);
  if (required === undefined) return null;
  const caller = resolveDriverId(db, ctx.driverToken);
  if (!caller) return '이 휴대폰은 기기 등록이 되어 있지 않습니다. 관리자에게 기기 등록 링크를 받아 여세요.';
  if (required !== caller) return '등록된 운전자 본인의 배차·차량만 조작할 수 있습니다.';
  return null;
}
