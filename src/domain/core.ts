// Shared types and helpers for server-side fleet actions. Every action is a pure function
// (db, payload, ctx) -> { db, result } so it can run inside a compare-and-swap retry loop.
import type { FleetDatabaseSchema, PushAlertItem } from '@/lib/fleetDatabase';
import { DispatchResult } from '@/utils/dispatchRules';
import { localTime } from './clock';

export interface ActionContext {
  now: Date;
  isAdmin: boolean;
}

export interface ActionOutcome {
  db: FleetDatabaseSchema;
  result: DispatchResult;
}

export const HQ_LAT = 32.6912;
export const HQ_LNG = -85.3298;

export const shortName = (name: string) => name.split(' (')[0];

/** Unique id: millisecond time plus a random suffix (several records may share a millisecond). */
export function newId(prefix: string, now: Date): string {
  return `${prefix}-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function alert(
  ctx: ActionContext,
  target: PushAlertItem['target'],
  level: PushAlertItem['level'],
  message: string
): PushAlertItem {
  return { id: newId('push', ctx.now), time: localTime(ctx.now), target, message, level };
}

/** Prepends alerts (newest first) without mutating the input. */
export function withAlerts(db: FleetDatabaseSchema, ...alerts: PushAlertItem[]): FleetDatabaseSchema {
  return { ...db, pushStream: [...alerts, ...db.pushStream] };
}

/** Refusal that changes nothing. */
export function refuse(db: FleetDatabaseSchema, message: string): ActionOutcome {
  return { db, result: { ok: false, message } };
}

/** Refusal that also posts a notice to the alert feed. */
export function refuseWithNotice(
  db: FleetDatabaseSchema,
  ctx: ActionContext,
  target: PushAlertItem['target'],
  notice: string,
  message: string
): ActionOutcome {
  return { db: withAlerts(db, alert(ctx, target, 'CRITICAL', notice)), result: { ok: false, message } };
}

export function garageSlot(fleetNumber: number) {
  return {
    lat: HQ_LAT + ((fleetNumber % 6) - 2.5) * 0.0012,
    lng: HQ_LNG + (Math.floor(fleetNumber / 6) - 2.5) * 0.0014,
  };
}

/** Demo-only: a plausible position near HQ for the map. LIVE mode never invents positions. */
export function demoPositionNearHq(spread: number) {
  return {
    lat: HQ_LAT + (Math.random() - 0.5) * spread,
    lng: HQ_LNG + (Math.random() - 0.5) * spread,
  };
}
