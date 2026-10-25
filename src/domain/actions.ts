// Action registry: maps each API action type to its domain function and permissions.
import { clearDemoState, resetDemoState } from '@/lib/fleetDatabase';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import type { ActionRequest, ActionType } from '@/lib/actionSchemas';
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

type PayloadOf<T extends ActionType> = Extract<ActionRequest, { type: T }>['payload'];

interface ActionSpec<T extends ActionType> {
  /** Requires a valid admin PIN (checked by the route before any read). */
  admin?: boolean;
  /** Allowed only while the database holds demo data. */
  demoOnly?: boolean;
  run: (db: FleetDatabaseSchema, payload: PayloadOf<T>, ctx: ActionContext) => ActionOutcome;
}

const ACTIONS: { [T in ActionType]: ActionSpec<T> } = {
  'dispatch.request': { run: requestDispatch },
  'dispatch.approve': { admin: true, run: approveDispatch },
  'dispatch.reject': { admin: true, run: rejectDispatch },
  'dispatch.start': { run: startDispatch },
  'dispatch.quickStart': { run: quickStartDispatch },
  'dispatch.return': { run: returnVehicle },
  'dispatch.autoReturn': { run: autoReturnVehicle },
  'dispatch.lateReason': { run: submitLateReason },
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
  return spec.run(db, action.payload as never, ctx);
}
