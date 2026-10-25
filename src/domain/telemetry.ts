// Phone telemetry evaluation (crash vs phone drop, unauthorized driving) and persistence.
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import type { TelemetryPayload } from '@/lib/fleetSchemas';
import { IncidentEvent } from '@/types/fleet';
import { getDistanceFromOpelikaHq } from '@/utils/realDeviceSensors';
import { localTime } from './clock';
import { ActionContext, newId } from './core';

export type IncidentVerdict = 'NONE' | 'CONFIRMED_CRASH' | 'FILTERED_PHONE_DROP';

export interface TelemetryEvaluation {
  hqDistanceMeters: number;
  inGarageGeofence: boolean;
  isUnauthorizedDriving: boolean;
  incidentVerdict: IncidentVerdict;
}

export function evaluateTelemetry(db: FleetDatabaseSchema, body: TelemetryPayload): TelemetryEvaluation {
  const policy = db.policyConfig;
  const hqDistanceMeters = getDistanceFromOpelikaHq(body.lat, body.lng);
  let incidentVerdict: IncidentVerdict = 'NONE';
  if (body.gForce >= policy.crashGForceThreshold) {
    incidentVerdict =
      Math.abs(body.deltaSpeedKmh) >= 25 || body.gyroYawDegPerSec >= 25 ? 'CONFIRMED_CRASH' : 'FILTERED_PHONE_DROP';
  }
  return {
    hqDistanceMeters,
    inGarageGeofence: hqDistanceMeters <= policy.garageGeofenceRadiusM,
    isUnauthorizedDriving: !body.hasActiveApproval && body.speedKmh >= policy.unauthorizedSpeedThresholdKmh,
    incidentVerdict,
  };
}

/** Evaluates a packet and, when persistToDb is set, records vehicle state and crash incidents. */
export function applyTelemetry(
  db: FleetDatabaseSchema,
  body: TelemetryPayload,
  ctx: ActionContext
): { db: FleetDatabaseSchema; result: TelemetryEvaluation } {
  const result = evaluateTelemetry(db, body);
  if (!body.persistToDb) return { db, result };

  const emp = db.employees.find((e) => e.id === body.employeeId) || db.employees[0];
  const crashed = result.incidentVerdict === 'CONFIRMED_CRASH';
  const vehicles = db.vehicles.map((v) =>
    v.id === body.vehicleId
      ? {
          ...v,
          status: crashed ? ('INCIDENT' as const) : result.isUnauthorizedDriving ? ('UNAUTHORIZED' as const) : v.status,
          speedKmh: crashed ? 0 : body.speedKmh,
          currentGForce: body.gForce,
          currentDriverId: emp?.id ?? v.currentDriverId,
          lat: body.lat,
          lng: body.lng,
        }
      : v
  );
  if (!crashed) return { db: { ...db, vehicles }, result };

  const incident: IncidentEvent = {
    id: newId('inc-api', ctx.now),
    vehicleId: body.vehicleId,
    plateNumber: body.plateNumber,
    driverId: emp?.id ?? null,
    driverName: emp ? `${emp.name} (${emp.department})` : '미상',
    coPassengerNames: [],
    eventType: 'IMPACT_SHOCK',
    title: `💥 [텔레메트리 수신] 스마트폰 ${body.gForce}G 충격 감지`,
    description: `스마트폰에서 ${body.gForce}G 가속도, 자이로 ${body.gyroYawDegPerSec}°/s 회전, Δv=${body.deltaSpeedKmh}km/h 급정차가 수신되어 자동 기록되었습니다.`,
    gForce: body.gForce,
    deltaSpeedKmh: body.deltaSpeedKmh,
    gyroYawDegPerSec: body.gyroYawDegPerSec,
    impactDirection: '스마트폰 6축 IMU 실시간 수신',
    speedTrace: [body.speedKmh, 0],
    locationLabel: `Opelika, AL (${body.lat.toFixed(4)}, ${body.lng.toFixed(4)})`,
    occurredAt: localTime(ctx.now),
    resolved: false,
    sensorFusionVerdict: 'CONFIRMED_CRASH',
  };
  return { db: { ...db, vehicles, incidents: [incident, ...db.incidents] }, result };
}
