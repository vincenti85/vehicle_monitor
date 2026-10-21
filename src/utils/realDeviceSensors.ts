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

export interface RealDeviceTelemetrySnapshot {
  lat: number | null;
  lng: number | null;
  speedKmh: number;
  gForce: number;
  gyroYawDegPerSec: number;
  timestamp: string;
}

export async function scanRealVehicleBluetooth(): Promise<string | null> {
  return requestRealBluetoothVehicleScan();
}

export async function startRealDeviceSensors(
  onUpdate: (snapshot: RealDeviceTelemetrySnapshot) => void
): Promise<() => void> {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Request iOS 13+ DeviceMotionEvent permission if required
  try {
    const dmAny = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof dmAny?.requestPermission === 'function') {
      await dmAny.requestPermission();
    }
  } catch {
    // Non-iOS or already granted
  }

  let latestLat: number | null = 32.6912;
  let latestLng: number | null = -85.3298;
  let latestSpeedKmh = 0;
  let latestGForce = 1.0;
  let latestGyroYaw = 0;

  let watchId: number | null = null;
  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latestLat = pos.coords.latitude;
        latestLng = pos.coords.longitude;
        latestSpeedKmh = pos.coords.speed
          ? Math.max(0, Math.round(pos.coords.speed * 3.6))
          : 0;
        onUpdate({
          lat: latestLat,
          lng: latestLng,
          speedKmh: latestSpeedKmh,
          gForce: latestGForce,
          gyroYawDegPerSec: latestGyroYaw,
          timestamp: new Date().toISOString(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }

  const handleMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
      const totalAccel = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      latestGForce = Number((totalAccel / 9.81).toFixed(2));
    }
    if (event.rotationRate && event.rotationRate.alpha !== null) {
      latestGyroYaw = Number(Math.abs(event.rotationRate.alpha).toFixed(1));
    }
    onUpdate({
      lat: latestLat,
      lng: latestLng,
      speedKmh: latestSpeedKmh,
      gForce: latestGForce,
      gyroYawDegPerSec: latestGyroYaw,
      timestamp: new Date().toISOString(),
    });
  };

  window.addEventListener('devicemotion', handleMotion);

  return () => {
    if (watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    window.removeEventListener('devicemotion', handleMotion);
  };
}
