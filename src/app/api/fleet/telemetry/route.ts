import { NextRequest, NextResponse } from 'next/server';
import { getDistanceFromOpelikaHq } from '@/utils/realDeviceSensors';
import { readFleetDatabase, writeFleetDatabase } from '@/lib/fleetDatabase';
import { IncidentEvent } from '@/types/fleet';

interface TelemetryPayload {
  employeeId: string;
  vehicleId: string;
  plateNumber: string;
  lat: number;
  lng: number;
  speedKmh: number;
  deltaSpeedKmh: number;
  gForce: number;
  gyroYawDegPerSec: number;
  hasActiveApproval: boolean;
  persistToDb?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TelemetryPayload;
    const db = readFleetDatabase();
    const policy = db.policyConfig;

    const distanceFromHqM = getDistanceFromOpelikaHq(body.lat, body.lng);
    const inGarageGeofence = distanceFromHqM <= policy.garageGeofenceRadiusM;

    // 1. Evaluate No-Dashcam 6-Axis IMU Sensor Fusion (Crash vs Phone Drop)
    let incidentVerdict: 'NONE' | 'CONFIRMED_CRASH' | 'FILTERED_PHONE_DROP' = 'NONE';
    if (body.gForce >= policy.crashGForceThreshold) {
      if (Math.abs(body.deltaSpeedKmh) >= 25 || body.gyroYawDegPerSec >= 25) {
        incidentVerdict = 'CONFIRMED_CRASH';
      } else {
        incidentVerdict = 'FILTERED_PHONE_DROP';
      }
    }

    // 2. Evaluate Unauthorized Driving (Speed >= threshold without active approval)
    const isUnauthorizedDriving =
      !body.hasActiveApproval &&
      body.speedKmh >= policy.unauthorizedSpeedThresholdKmh;

    // 3. Optionally persist telemetry & auto-generated incident directly into backend DB
    if (body.persistToDb) {
      const nowTime = new Date().toTimeString().slice(0, 8);
      const emp =
        db.employees.find((e) => e.id === body.employeeId) || db.employees[0];

      const nextVehicles = db.vehicles.map((v) =>
        v.id === body.vehicleId
          ? {
              ...v,
              status:
                incidentVerdict === 'CONFIRMED_CRASH'
                  ? ('INCIDENT' as const)
                  : isUnauthorizedDriving
                    ? ('UNAUTHORIZED' as const)
                    : v.status,
              speedKmh: incidentVerdict === 'CONFIRMED_CRASH' ? 0 : body.speedKmh,
              currentGForce: body.gForce,
              currentDriverId: emp.id,
              lat: body.lat,
              lng: body.lng,
            }
          : v
      );

      let nextIncidents = db.incidents;
      if (incidentVerdict === 'CONFIRMED_CRASH') {
        const crashInc: IncidentEvent = {
          id: `inc-api-${Date.now()}`,
          vehicleId: body.vehicleId,
          plateNumber: body.plateNumber,
          driverId: emp.id,
          driverName: `${emp.name} (${emp.department})`,
          coPassengerNames: [],
          eventType: 'IMPACT_SHOCK',
          title: `💥 [API 텔레메트리 수신] 무블랙박스 스마트폰 ${body.gForce}G 충격 감지`,
          description: `스마트폰 API 패킷으로 ${body.gForce}G 가속도, 자이로 ${body.gyroYawDegPerSec}°/s 회전, Δv=${body.deltaSpeedKmh}km/h 급정차가 DB에 자동 기록되었습니다.`,
          gForce: body.gForce,
          deltaSpeedKmh: body.deltaSpeedKmh,
          gyroYawDegPerSec: body.gyroYawDegPerSec,
          impactDirection: '스마트폰 6축 IMU API 실시간 수신',
          speedTrace: [64, 62, 60, 58, 52, 14, 0, 0],
          locationLabel: `Opelika, AL (${body.lat.toFixed(4)}, ${body.lng.toFixed(4)})`,
          occurredAt: nowTime,
          resolved: false,
          sensorFusionVerdict: 'CONFIRMED_CRASH',
        };
        nextIncidents = [crashInc, ...db.incidents];
      }

      writeFleetDatabase({
        vehicles: nextVehicles,
        incidents: nextIncidents,
      });
    }

    return NextResponse.json({
      accepted: true,
      evaluatedAt: new Date().toISOString(),
      hqDistanceMeters: distanceFromHqM,
      inGarageGeofence,
      isUnauthorizedDriving,
      incidentVerdict,
      alertAction: isUnauthorizedDriving
        ? 'TRIGGER_BILATERAL_RED_ALERT'
        : incidentVerdict === 'CONFIRMED_CRASH'
          ? 'TRIGGER_EMERGENCY_IMU_RECONSTRUCTION'
          : 'NORMAL_TELEMETRY_LOGGED',
    });
  } catch (err) {
    return NextResponse.json(
      { accepted: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}
