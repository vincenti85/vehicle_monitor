// Core TypeScript definitions for FleetGuard 30 (Zero-Hardware / No-Dashcam Smartphone Fleet Telemetry)

export type VehicleStatus = 'IDLE' | 'AUTHORIZED' | 'UNAUTHORIZED' | 'INCIDENT';

export type PermissionStatus = 'OK' | 'BT_OFF' | 'GPS_OFF' | 'STALE';

export type TripAuthType = 'PRE_REGISTERED' | 'LATE_REGISTERED' | 'UNAUTHORIZED';

export type TripPurpose =
  | '일반업무/외근'
  | '거래처방문'
  | '긴급출동/현장지원'
  | '출퇴근(승인)'
  | '미입력(무단반출)';

export type ReservationStage = 'REQUESTED' | 'APPROVED' | 'IN_USE' | 'RETURNED' | 'REJECTED';

export type IncidentType =
  | 'UNAUTHORIZED_START'
  | 'IMPACT_SHOCK'
  | 'HARD_BRAKE'
  | 'GHOST_TRIP_SUSPECT'
  | 'PERMISSION_EVASION';

export interface Vehicle {
  id: string;
  fleetNumber: number; // 1 to 30
  plateNumber: string;
  modelName: string;
  btMacAddress: string;
  bleBeaconUuid: string;
  status: VehicleStatus;
  speedKmh: number;
  currentGForce: number;
  rssiDbm: number;
  currentDriverId: string | null;
  coPassengerIds: string[];
  driverSelectionReason: string | null;
  tripPurpose: TripPurpose | null;
  tripStartedAt: string | null;
  cumulativeGpsKm: number;
  lastVerifiedOdometerKm: number;
  parkingZone: string;
  lat: number;
  lng: number;
  headingDeg: number;
  isLockedByAdmin?: boolean;
  lastOdometerAuditAt?: string;
  lastFixAt?: string; // ISO time of the latest phone GPS fix on a trip
  lastFixAccuracyM?: number;
  /** Why the vehicle is locked; missing on locks set before 1.3.0 (treated as ADMIN). */
  lockReason?: VehicleLockReason;
  /** Inspection that caused an INSPECTION_FAILED lock. */
  lockInspectionId?: string;
}

export type VehicleLockReason = 'ADMIN' | 'INSPECTION_FAILED';

export interface VehicleReservation {
  id: string;
  vehicleId: string;
  fleetNumber: number;
  plateNumber: string;
  modelName: string;
  employeeId: string;
  employeeName: string;
  department: string;
  purpose: TripPurpose;
  destination: string;
  /** Display text. Legacy rows hold free text; timed bookings derive it from the ISO times. */
  plannedTimeWindow: string;
  /** Booking start (UTC ISO 8601). Missing on legacy rows, which keep the block-everything rule. */
  plannedStartAt?: string;
  /** Booking end (UTC ISO 8601), exclusive. */
  plannedEndAt?: string;
  stage: ReservationStage;
  requestedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  startedAt: string | null;
  returnedAt: string | null;
  startOdometerKm: number;
  endOdometerKm: number | null;
  returnParkingZone: string | null;
  keyReturnedToBox: boolean;
  notes: string;
  gpsTrack?: TripGpsTrack;
}

/** Running summary of the driver's phone GPS fixes for one trip. */
export interface TripGpsTrack {
  fixCount: number;
  gpsKm: number; // sum of straight lines between fixes (shorter than the road distance)
  maxSpeedKmh: number;
  lastLat: number;
  lastLng: number;
  lastFixAt: string; // ISO
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  permissionStatus: PermissionStatus;
  lastHeartbeatAt: string;
  inGarageGeofence: boolean;
  lastKeyboxAccessAt: string | null;
  dispatchAllowed?: boolean;
  violationCount?: number;
  /** SHA-256 of the enrolled phone's driver token (server only; stripped from responses). */
  deviceTokenHash?: string;
  /** When the current phone link was issued (ISO). */
  deviceEnrolledAt?: string;
}

export interface IncidentEvent {
  id: string;
  vehicleId: string;
  plateNumber: string;
  driverId: string | null;
  driverName: string;
  coPassengerNames: string[];
  eventType: IncidentType;
  title: string;
  description: string;
  gForce: number | null;
  deltaSpeedKmh: number | null;
  gyroYawDegPerSec?: number | null; // Smartphone gyroscope yaw rotation (replaces dashcam video)
  impactDirection?: string | null; // Estimated impact vector from 6-axis phone IMU
  speedTrace: number[]; // 30-second GPS speed trace around the event
  locationLabel: string;
  occurredAt: string;
  resolved: boolean;
  managerResolutionNote?: string;
  sensorFusionVerdict?: 'CONFIRMED_CRASH' | 'FILTERED_PHONE_DROP' | 'N/A';
}

export interface GeofenceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  zoneType: 'GARAGE_150M' | 'KEYBOX_3M';
  action: 'ENTER' | 'EXIT' | 'PERMISSION_DISABLED_IN_ZONE';
  timestamp: string;
  permissionState: PermissionStatus;
  note: string;
}

export interface GhostTripCase {
  id: string;
  vehicleId: string;
  plateNumber: string;
  modelName: string;
  windowStart: string;
  windowEnd: string;
  unaccountedKm: number;
  parkingZoneChangedFrom: string;
  parkingZoneChangedTo: string;
  suspectEmployees: {
    employeeId: string;
    name: string;
    department: string;
    confidenceScore: number;
    evidence: string[];
  }[];
  status: 'OPEN_INVESTIGATION' | 'CONFIRMED_DRIVER';
}

export interface TaxLogEntry {
  id: string;
  date: string;
  plateNumber: string;
  modelName: string;
  department: string;
  driverName: string;
  authType: TripAuthType;
  purpose: TripPurpose;
  startTime: string;
  endTime: string;
  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  autoReturnVerified: boolean;
}

export interface SystemPolicyConfig {
  hqAddress: string;
  garageGeofenceRadiusM: number;
  keyboxBleRadiusM: number;
  unauthorizedSpeedThresholdKmh: number;
  crashGForceThreshold: number;
  autoReturnIdleMinutes: number;
  autoApproveWhenManagerAway: boolean;
  blockDispatchWhenPermissionOff: boolean;
  afterHoursAlertEnabled: boolean;
  /** Advance booking: latest start, in days from now. */
  maxAdvanceBookingDays: number;
  /** Gap kept free before and after every booking of the same vehicle. */
  bookingBufferMinutes: number;
  /** How early before the booked start a driver may leave. */
  earlyStartGraceMinutes: number;
  inspectionTemplate: InspectionTemplateItem[];
  requirePreTripInspection: boolean;
  requirePostTripInspection: boolean;
}

export type InspectionKind = 'PRE_TRIP' | 'POST_TRIP';

export interface InspectionTemplateItem {
  id: string;
  label: string;
  /** A failed critical item locks the vehicle. */
  critical: boolean;
}

export interface InspectionItemResult {
  itemId: string;
  passed: boolean;
  /** Required (<= 200 chars) when the item failed. */
  note: string;
}

export interface VehicleInspection {
  id: string;
  kind: InspectionKind;
  reservationId: string;
  vehicleId: string;
  employeeId: string;
  items: InspectionItemResult[];
  failedItems: number;
  criticalFailed: boolean;
  /** Client-reported ISO time the checklist was opened (informational). */
  startedAt: string;
  /** Server time (ISO) the checklist was saved: the evidence time. */
  submittedAt: string;
  startLat: number | null;
  startLng: number | null;
  submitLat: number | null;
  submitLng: number | null;
  accuracyM: number | null;
  /** Location permission denied or no fix; never blocks the submission. */
  gpsUnavailable: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}
