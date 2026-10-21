import { NextResponse } from 'next/server';
import { readFleetDatabase } from '@/lib/fleetDatabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = readFleetDatabase();
  return NextResponse.json({
    status: 'ok',
    service: 'fleet-guard-30-opelika-al',
    version: db.version,
    storageEngine: db.storageEngine,
    lastUpdatedAt: db.lastUpdatedAt,
    recordCounts: {
      vehicles: db.vehicles.length,
      employees: db.employees.length,
      reservations: db.reservations.length,
      incidents: db.incidents.length,
      geofenceLogs: db.geofenceLogs.length,
      ghostTrips: db.ghostTrips.length,
      taxLogs: db.taxLogs.length,
      pushStream: db.pushStream.length,
    },
    hqLocation: {
      address: db.policyConfig.hqAddress,
      county: 'Lee County, AL (Prefix 41)',
      lat: 32.6912,
      lng: -85.3298,
      garageGeofenceRadiusM: db.policyConfig.garageGeofenceRadiusM,
      keyboxBleRadiusM: db.policyConfig.keyboxBleRadiusM,
    },
    architecture: {
      inCarDashcamRequired: false,
      obdHardwareRequired: false,
      monthlySubscriptionUsd: 0,
      telemetrySource: 'Smartphone 6-Axis IMU + Vehicle Bluetooth/BLE + Conditional GPS',
    },
    timestamp: new Date().toISOString(),
  });
}
