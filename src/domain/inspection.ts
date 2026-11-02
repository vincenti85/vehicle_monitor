// Pre/post-trip inspection checklist. A failed critical item locks the vehicle until an admin
// records the fix (resolveInspection). All functions are pure and return new objects.
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import { DEFAULT_INSPECTION_TEMPLATE } from '@/data/inspectionTemplate';
import {
  InspectionItemResult,
  InspectionKind,
  InspectionTemplateItem,
  Vehicle,
  VehicleInspection,
} from '@/types/fleet';
import { ActionContext, ActionOutcome, alert, newId, refuse, shortName, withAlerts } from './core';

export { DEFAULT_INSPECTION_TEMPLATE };

/** Checklist answers plus the GPS stamp, as sent with inspection.submit or dispatch.return. */
export interface InspectionAnswers {
  items: InspectionItemResult[];
  startedAt: string;
  startLat: number | null;
  startLng: number | null;
  submitLat: number | null;
  submitLng: number | null;
  accuracyM: number | null;
}

export interface InspectionSubmitPayload extends InspectionAnswers {
  reservationId: string;
  employeeId: string;
  kind: InspectionKind;
}

export interface ResolvePayload {
  inspectionId: string;
  resolution: string;
}

export const INSPECTION_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const REQUIRED_STAGE: Record<InspectionKind, 'APPROVED' | 'IN_USE'> = { PRE_TRIP: 'APPROVED', POST_TRIP: 'IN_USE' };
const KIND_LABEL: Record<InspectionKind, string> = { PRE_TRIP: '운행 전', POST_TRIP: '운행 후' };

export function templateOf(db: FleetDatabaseSchema): readonly InspectionTemplateItem[] {
  const t = db.policyConfig.inspectionTemplate;
  return Array.isArray(t) && t.length > 0 ? t : DEFAULT_INSPECTION_TEMPLATE;
}

export function summarizeInspection(items: InspectionItemResult[], template: readonly InspectionTemplateItem[]) {
  const byId = new Map(template.map((t) => [t.id, t]));
  const failed = items.filter((i) => !i.passed);
  return {
    failedItems: failed.length,
    criticalFailed: failed.some((i) => byId.get(i.itemId)?.critical === true),
    failedLabels: failed.map((i) => byId.get(i.itemId)?.label ?? i.itemId),
  };
}

/** Every template item answered exactly once, nothing else. */
function answersMatchTemplate(items: InspectionItemResult[], template: readonly InspectionTemplateItem[]): boolean {
  const answered = new Set(items.map((i) => i.itemId));
  return answered.size === items.length && items.length === template.length && template.every((t) => answered.has(t.id));
}

/** The booking has a PRE_TRIP without a critical failure (a failed one must be redone after the fix). */
export function hasPreTripInspection(db: Pick<FleetDatabaseSchema, 'inspections'>, reservationId: string): boolean {
  return (db.inspections ?? []).some((i) => i.reservationId === reservationId && i.kind === 'PRE_TRIP' && !i.criticalFailed);
}

/** Keeps the last `days` days; an unresolved critical failure stays because it still holds a lock. */
export function pruneInspections(list: VehicleInspection[], now: Date, days = INSPECTION_RETENTION_DAYS): VehicleInspection[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return list.filter((i) => Date.parse(i.submittedAt) >= cutoff || (i.criticalFailed && !i.resolvedAt));
}

const lockVehicle = (v: Vehicle, inspectionId: string): Vehicle => ({
  ...v,
  isLockedByAdmin: true,
  lockReason: 'INSPECTION_FAILED',
  lockInspectionId: inspectionId,
});

export function submitInspection(db: FleetDatabaseSchema, p: InspectionSubmitPayload, ctx: ActionContext): ActionOutcome {
  const res = db.reservations.find((r) => r.id === p.reservationId);
  if (!res) return refuse(db, '배차 건을 찾을 수 없습니다.');
  if (res.employeeId !== p.employeeId) return refuse(db, '본인 배차 건만 점검을 제출할 수 있습니다.');
  if (res.stage !== REQUIRED_STAGE[p.kind]) {
    return refuse(db, p.kind === 'PRE_TRIP' ? '승인완료 상태에서만 운행 전 점검을 제출할 수 있습니다.' : '운행중인 건만 운행 후 점검을 제출할 수 있습니다.');
  }
  const veh = db.vehicles.find((v) => v.id === res.vehicleId);
  if (!veh) return refuse(db, '차량을 찾을 수 없습니다.');
  const template = templateOf(db);
  if (!answersMatchTemplate(p.items, template)) return refuse(db, '모든 점검 항목에 한 번씩 합격/불합격을 선택하세요.');

  const summary = summarizeInspection(p.items, template);
  const record: VehicleInspection = {
    id: newId('insp', ctx.now),
    kind: p.kind,
    reservationId: res.id,
    vehicleId: veh.id,
    employeeId: res.employeeId,
    items: p.items.map((i) => ({ itemId: i.itemId, passed: i.passed, note: i.passed ? '' : i.note.trim() })),
    failedItems: summary.failedItems,
    criticalFailed: summary.criticalFailed,
    startedAt: p.startedAt,
    submittedAt: ctx.now.toISOString(),
    startLat: p.startLat,
    startLng: p.startLng,
    submitLat: p.submitLat,
    submitLng: p.submitLng,
    accuracyM: p.accuracyM,
    gpsUnavailable: p.submitLat === null || p.submitLng === null,
  };
  const next: FleetDatabaseSchema = {
    ...db,
    inspections: pruneInspections([record, ...(db.inspections ?? [])], ctx.now),
    vehicles: summary.criticalFailed ? db.vehicles.map((v) => (v.id === veh.id ? lockVehicle(v, record.id) : v)) : db.vehicles,
  };
  const who = `${shortName(res.employeeName)}님 #${veh.fleetNumber}호차(${veh.plateNumber}) ${KIND_LABEL[p.kind]} 점검`;
  const failedText = summary.failedLabels.join(', ');
  if (summary.criticalFailed) {
    return {
      db: withAlerts(next, alert(ctx, 'MANAGER', 'CRITICAL', `🔒 [점검 불합격 · 자동 잠금] ${who}에서 핵심 항목 불합격(${failedText}). 조치 후 [점검]에서 잠금을 해제하세요.`)),
      // PRE_TRIP: the trip must not start; the record and lock are still saved
      result: { ok: p.kind === 'POST_TRIP', message: `#${veh.fleetNumber}호차가 점검 불합격으로 잠겼습니다. 관리자에게 연락하세요.` },
    };
  }
  if (summary.failedItems > 0) {
    return {
      db: withAlerts(next, alert(ctx, 'MANAGER', 'INFO', `🔧 [점검 경미 불합격] ${who}: ${failedText}. 운행은 가능합니다.`)),
      result: { ok: true, message: `점검 제출 완료 — 불합격 ${summary.failedItems}건이 관리자에게 전달되었습니다.` },
    };
  }
  return { db: next, result: { ok: true, message: `점검 완료 — ${p.kind === 'PRE_TRIP' ? '운행 시작 가능' : '이상 없음'}` } };
}

export function resolveInspection(db: FleetDatabaseSchema, p: ResolvePayload, ctx: ActionContext): ActionOutcome {
  const insp = (db.inspections ?? []).find((i) => i.id === p.inspectionId);
  if (!insp) return refuse(db, '점검 기록을 찾을 수 없습니다.');
  if (insp.failedItems === 0) return refuse(db, '불합격 항목이 있는 점검만 조치 완료로 처리할 수 있습니다.');
  if (insp.resolvedAt) return refuse(db, '이미 조치 완료된 점검입니다.');
  const inspections = db.inspections.map((i) =>
    i.id === insp.id ? { ...i, resolvedAt: ctx.now.toISOString(), resolvedBy: '차량총괄관리자 (Fleet Admin)', resolution: p.resolution.trim() } : i
  );
  const vehicles = db.vehicles.map((v) => {
    if (v.lockReason !== 'INSPECTION_FAILED' || v.lockInspectionId !== insp.id) return v;
    const { lockReason: _reason, lockInspectionId: _id, ...rest } = v;
    return { ...rest, isLockedByAdmin: false };
  });
  const veh = vehicles.find((v) => v.id === insp.vehicleId);
  const unlocked = veh && !veh.isLockedByAdmin;
  return {
    db: { ...db, inspections, vehicles },
    result: {
      ok: true,
      message: `점검 조치 완료 기록${unlocked ? ` — #${veh!.fleetNumber}호차 잠금 해제` : ''}`,
    },
  };
}
