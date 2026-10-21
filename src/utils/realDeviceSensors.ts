// Real Smartphone Sensor Integration (Web Geolocation, 6-Axis DeviceMotion IMU, Web Bluetooth)
// Used when employees access the deployed HTTPS web app / PWA on their physical smartphones.

export interface LivePhoneSensorReading {
  gpsActive: boolean;
  lat: number | null;
  lng: number | null;
  speedKmh: number;
  distanceFromHqMeters: number | null;
  inOpelikaGarageGeofence: boolean;
  gForce: number;
  gyroYawDegPerSec: number;
  bluetoothSupported: boolean;
  matchedBluetoothDeviceName: string | null;
  lastUpdated: string;
}

// 4400 Northpark Dr, Opelika, AL 36801 coordinates
const OPELIKA_HQ_LAT = 32.6912;
const OPELIKA_HQ_LNG = -85.3298;

export function calculateHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function requestRealBluetoothVehicleScan(): Promise<string | null> {
  if (typeof window === 'undefined' || !('bluetooth' in navigator)) {
    return null;
  }
  try {
    // Request nearby Bluetooth / BLE devices (requires HTTPS + user gesture on Chrome Android)
    const navBt = (navigator as unknown as {
      bluetooth: {
        requestDevice: (opts: { acceptAllDevices: boolean }) => Promise<{ name?: string; id?: string }>;
      };
    }).bluetooth;
    const device = await navBt.requestDevice({ acceptAllDevices: true });
    return device.name || device.id || 'Detected-Vehicle-BT';
  } catch {
    return null;
  }
}

export function getDistanceFromOpelikaHq(lat: number, lng: number): number {
  return calculateHaversineMeters(OPELIKA_HQ_LAT, OPELIKA_HQ_LNG, lat, lng);
}
