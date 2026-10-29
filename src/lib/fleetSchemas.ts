// Zod schemas validating every payload that crosses the API boundary.
// Keeps data/fleet-db.json structurally sound even if a client sends garbage.
import { z } from 'zod';

const vehicleStatus = z.enum(['IDLE', 'AUTHORIZED', 'UNAUTHORIZED', 'INCIDENT']);
const permissionStatus = z.enum(['OK', 'BT_OFF', 'GPS_OFF', 'STALE']);
const reservationStage = z.enum(['REQUESTED', 'APPROVED', 'IN_USE', 'RETURNED', 'REJECTED']);
const tripPurpose = z.enum([
  '일반업무/외근',
  '거래처방문',
  '긴급출동/현장지원',
  '출퇴근(승인)',
  '미입력(무단반출)',
]);
export const TripPurposeSchema = tripPurpose;
const nullableStr = z.string().nullable();

export const VehicleSchema = z
  .object({
    id: z.string().min(1),
    fleetNumber: z.number().int().min(1).max(30),
    plateNumber: z.string().min(1),
    modelName: z.string(),
    btMacAddress: z.string(),
    bleBeaconUuid: z.string(),
    status: vehicleStatus,
    speedKmh: z.number().min(0),
    currentGForce: z.number(),
    rssiDbm: z.number(),
    currentDriverId: nullableStr,
    coPassengerIds: z.array(z.string()),
    driverSelectionReason: nullableStr,
    tripPurpose: tripPurpose.nullable(),
    tripStartedAt: nullableStr,
    cumulativeGpsKm: z.number().min(0),
    lastVerifiedOdometerKm: z.number().min(0),
    parkingZone: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    headingDeg: z.number(),
    isLockedByAdmin: z.boolean().optional(),
    lastOdometerAuditAt: z.string().optional(),
  })
  .passthrough();

export const EmployeeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string(),
    department: z.string(),
    phone: z.string(),
    permissionStatus,
    lastHeartbeatAt: z.string(),
    inGarageGeofence: z.boolean(),
    lastKeyboxAccessAt: nullableStr,
    dispatchAllowed: z.boolean().optional(),
    violationCount: z.number().int().min(0).optional(),
  })
  .passthrough();

export const ReservationSchema = z
  .object({
    id: z.string().min(1),
    vehicleId: z.string().min(1),
    fleetNumber: z.number().int(),
    plateNumber: z.string(),
    modelName: z.string(),
    employeeId: z.string().min(1),
    employeeName: z.string(),
    department: z.string(),
    purpose: tripPurpose,
    destination: z.string(),
    plannedTimeWindow: z.string(),
    stage: reservationStage,
    requestedAt: z.string(),
    approvedAt: nullableStr,
    approvedBy: nullableStr,
    startedAt: nullableStr,
    returnedAt: nullableStr,
    startOdometerKm: z.number().min(0),
    endOdometerKm: z.number().min(0).nullable(),
    returnParkingZone: nullableStr,
    keyReturnedToBox: z.boolean(),
    notes: z.string(),
  })
  .passthrough();

export const IncidentSchema = z
  .object({
    id: z.string().min(1),
    vehicleId: z.string().min(1),
    plateNumber: z.string(),
    driverId: nullableStr,
    driverName: z.string(),
    coPassengerNames: z.array(z.string()),
    eventType: z.enum([
      'UNAUTHORIZED_START',
      'IMPACT_SHOCK',
      'HARD_BRAKE',
      'GHOST_TRIP_SUSPECT',
      'PERMISSION_EVASION',
    ]),
    title: z.string(),
    description: z.string(),
    gForce: z.number().nullable(),
    deltaSpeedKmh: z.number().nullable(),
    speedTrace: z.array(z.number()),
    locationLabel: z.string(),
    occurredAt: z.string(),
    resolved: z.boolean(),
  })
  .passthrough();

export const GeofenceLogSchema = z
  .object({
    id: z.string().min(1),
    employeeId: z.string(),
    employeeName: z.string(),
    department: z.string(),
    zoneType: z.enum(['GARAGE_150M', 'KEYBOX_3M']),
    action: z.enum(['ENTER', 'EXIT', 'PERMISSION_DISABLED_IN_ZONE']),
    timestamp: z.string(),
    permissionState: permissionStatus,
    note: z.string(),
  })
  .passthrough();

export const GhostTripSchema = z
  .object({
    id: z.string().min(1),
    vehicleId: z.string(),
    plateNumber: z.string(),
    modelName: z.string(),
    windowStart: z.string(),
    windowEnd: z.string(),
    unaccountedKm: z.number(),
    parkingZoneChangedFrom: z.string(),
    parkingZoneChangedTo: z.string(),
    status: z.enum(['OPEN_INVESTIGATION', 'CONFIRMED_DRIVER']),
    suspectEmployees: z.array(
      z.object({
        employeeId: z.string(),
        name: z.string(),
        department: z.string(),
        confidenceScore: z.number(),
        evidence: z.array(z.string()),
      })
    ),
  })
  .passthrough();

export const TaxLogSchema = z
  .object({
    id: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    plateNumber: z.string(),
    modelName: z.string(),
    department: z.string(),
    driverName: z.string(),
    authType: z.enum(['PRE_REGISTERED', 'LATE_REGISTERED', 'UNAUTHORIZED']),
    purpose: tripPurpose,
    startTime: z.string(),
    endTime: z.string(),
    startOdometerKm: z.number().min(0),
    endOdometerKm: z.number().min(0),
    distanceKm: z.number().min(0),
    autoReturnVerified: z.boolean(),
  })
  .passthrough();

export const PolicyConfigSchema = z.object({
  hqAddress: z.string().min(1),
  garageGeofenceRadiusM: z.number().min(10).max(5000),
  keyboxBleRadiusM: z.number().min(1).max(100),
  unauthorizedSpeedThresholdKmh: z.number().min(1).max(200),
  crashGForceThreshold: z.number().min(1).max(20),
  autoReturnIdleMinutes: z.number().int().min(1).max(1440),
  autoApproveWhenManagerAway: z.boolean(),
  blockDispatchWhenPermissionOff: z.boolean(),
  afterHoursAlertEnabled: z.boolean(),
});

export const PushAlertSchema = z.object({
  id: z.string().min(1),
  time: z.string(),
  target: z.enum(['MANAGER', 'DRIVER']),
  message: z.string(),
  level: z.enum(['CRITICAL', 'INFO']),
});

export const FleetStatePatchSchema = z
  .object({
    vehicles: z.array(VehicleSchema).min(1).max(30),
    employees: z.array(EmployeeSchema).min(1),
    reservations: z.array(ReservationSchema),
    incidents: z.array(IncidentSchema),
    geofenceLogs: z.array(GeofenceLogSchema),
    ghostTrips: z.array(GhostTripSchema),
    taxLogs: z.array(TaxLogSchema),
    policyConfig: PolicyConfigSchema,
    pushStream: z.array(PushAlertSchema).max(500),
  })
  .partial()
  .strict();

export const FleetStateRequestSchema = z
  .object({
    action: z.enum(['SYNC_STATE', 'RESET_SEED', 'CLEAR_DEMO']).optional(),
    patch: FleetStatePatchSchema.optional(),
    removeDemoEmployees: z.boolean().optional(),
  })
  .strict();

export const TelemetryPayloadSchema = z.object({
  employeeId: z.string().min(1),
  vehicleId: z.string().min(1),
  plateNumber: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(300),
  deltaSpeedKmh: z.number().min(-300).max(300),
  gForce: z.number().min(0).max(50),
  gyroYawDegPerSec: z.number().min(0).max(2000),
  /** Ignored: approval is worked out on the server from reservations. Kept for old clients. */
  hasActiveApproval: z.boolean().optional(),
  persistToDb: z.boolean().optional(),
});

export const AdminPinRequestSchema = z.object({
  pin: z.string().regex(/^\d{4,12}$/),
});

export type FleetStatePatch = z.infer<typeof FleetStatePatchSchema>;
export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;
