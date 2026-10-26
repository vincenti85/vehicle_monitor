// Request schema for POST /api/fleet/actions: one { type, payload } shape per action.
import { z } from 'zod';
import { MAX_FLEET_SIZE } from '@/utils/vehicleImport';
import { PolicyConfigSchema, TripPurposeSchema } from './fleetSchemas';

const id = z.string().min(1).max(100);
const text = (max: number) => z.string().max(max);
const action = <T extends string, P extends z.ZodTypeAny>(type: T, payload: P) =>
  z.object({ type: z.literal(type), payload }).strict();

const VehicleRowSchema = z
  .object({
    fleetNumber: z.number().int().min(1).max(MAX_FLEET_SIZE),
    plateNumber: z.string().trim().min(1).max(20),
    modelName: z.string().trim().min(1).max(60),
    btMacAddress: text(17).optional(),
    bleBeaconUuid: text(40).optional(),
    cumulativeGpsKm: z.number().min(0).max(5_000_000).optional(),
    parkingZone: text(80).optional(),
  })
  .strict();

const EmployeeRowSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    role: text(30),
    department: text(80),
    phone: text(30),
    dispatchAllowed: z.boolean(),
  })
  .strict();

export const ActionRequestSchema = z.discriminatedUnion('type', [
  // Dispatch lifecycle
  action('dispatch.request', z.object({
    employeeId: id,
    vehicleId: id,
    purpose: TripPurposeSchema,
    destination: z.string().trim().min(1).max(120),
    plannedTimeWindow: z.string().trim().min(1).max(60),
    notes: text(200),
  })),
  action('dispatch.approve', z.object({ reservationId: id })),
  action('dispatch.reject', z.object({ reservationId: id })),
  action('dispatch.start', z.object({ reservationId: id })),
  // Driver phone GPS while a trip is IN_USE
  action('trip.position', z.object({
    reservationId: id,
    employeeId: id,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speedKmh: z.number().min(0).max(400).nullable(),
    headingDeg: z.number().min(0).max(360).nullable(),
    accuracyM: z.number().min(0).max(100_000),
  })),
  action('dispatch.quickStart', z.object({ employeeId: id, vehicleId: id, purpose: TripPurposeSchema })),
  action('dispatch.return', z.object({ reservationId: id, parkingZone: z.string().trim().min(1).max(80), keyReturnedToBox: z.boolean() })),
  action('dispatch.autoReturn', z.object({ vehicleId: id })),
  action('dispatch.lateReason', z.object({ vehicleId: id, purpose: TripPurposeSchema })),
  // Vehicles (admin)
  action('vehicle.import', z.object({
    rows: z.array(VehicleRowSchema).min(1).max(MAX_FLEET_SIZE),
    mode: z.enum(['REPLACE', 'UPSERT']),
    source: text(120),
  })),
  action('vehicle.updatePairing', z.object({ vehicleId: id, btMacAddress: text(17), bleBeaconUuid: text(40) })),
  action('vehicle.toggleLock', z.object({ vehicleId: id })),
  action('vehicle.auditOdometer', z.object({ vehicleId: id, actualOdometerKm: z.number().min(0).max(5_000_000) })),
  // Employees, incidents, policy (admin)
  action('employee.add', z.object({ name: z.string().trim().min(1).max(60), role: text(30), department: text(80), phone: text(30) })),
  action('employee.import', z.object({ rows: z.array(EmployeeRowSchema).min(1).max(500) })),
  action('employee.toggleDispatch', z.object({ employeeId: id })),
  action('employee.warn', z.object({ employeeId: id })),
  action('incident.resolve', z.object({ incidentId: id, resolutionNote: text(500), suspendDriver: z.boolean() })),
  action('policy.update', z.object({ policyConfig: PolicyConfigSchema })),
  // Demo simulations (DEMO mode only)
  action('demo.unauthorizedStart', z.object({ employeeId: id, vehicleId: id, coPassengerId: id.nullable() })),
  action('demo.crashOrDrop', z.object({ vehicleId: id, isRealCrash: z.boolean() })),
  action('demo.permissionToggle', z.object({ employeeId: id })),
  // Data mode (admin)
  action('admin.clearDemo', z.object({ removeDemoEmployees: z.boolean() })),
  action('admin.resetDemo', z.object({})),
]);

export type ActionRequest = z.infer<typeof ActionRequestSchema>;
export type ActionType = ActionRequest['type'];
