// Request schema for POST /api/fleet/actions: one { type, payload } shape per action.
import { z } from 'zod';
import { windowShapeError } from '@/utils/bookingWindow';
import { MAX_FLEET_SIZE } from '@/utils/vehicleImport';
import { PolicyConfigSchema, TripPurposeSchema } from './fleetSchemas';

const id = z.string().min(1).max(100);
const text = (max: number) => z.string().max(max);
const action = <T extends string, P extends z.ZodTypeAny>(type: T, payload: P) =>
  z.object({ type: z.literal(type), payload }).strict();

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const accuracy = z.number().min(0).max(100_000);
const isoDateTime = z.string().datetime({ offset: true });

/** Booking window (AC-M1): ISO start/end together, or legacy free text alone. */
function refineBookingWindow(
  p: { plannedTimeWindow?: string; plannedStartAt?: string; plannedEndAt?: string },
  ctx: z.RefinementCtx
) {
  if (p.plannedStartAt && p.plannedEndAt) {
    const reason = windowShapeError(Date.parse(p.plannedStartAt), Date.parse(p.plannedEndAt));
    if (reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plannedEndAt'], message: reason });
  } else if (p.plannedStartAt || p.plannedEndAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plannedStartAt'], message: '시작·종료 시각을 함께 입력하세요.' });
  } else if (!p.plannedTimeWindow) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plannedStartAt'], message: '예약 시간(시작·종료)을 입력하세요.' });
  }
}

const InspectionItemSchema = z
  .object({ itemId: z.string().min(1).max(40), passed: z.boolean(), note: z.string().trim().max(200) })
  .strict()
  .refine((i) => i.passed || i.note.length > 0, { message: '불합격 항목은 메모가 필요합니다.', path: ['note'] });

/** Checklist answers + GPS stamp; coordinates are null when location is unavailable (never blocks). */
const InspectionAnswersSchema = z.object({
  items: z
    .array(InspectionItemSchema)
    .min(1)
    .max(20)
    .refine((items) => new Set(items.map((i) => i.itemId)).size === items.length, '점검 항목이 중복되었습니다.'),
  startedAt: isoDateTime,
  startLat: latitude.nullable(),
  startLng: longitude.nullable(),
  submitLat: latitude.nullable(),
  submitLng: longitude.nullable(),
  accuracyM: accuracy.nullable(),
});

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
    plannedTimeWindow: z.string().trim().min(1).max(60).optional(),
    plannedStartAt: isoDateTime.optional(),
    plannedEndAt: isoDateTime.optional(),
    notes: text(200),
  }).superRefine(refineBookingWindow)),
  action('dispatch.approve', z.object({ reservationId: id })),
  action('dispatch.reject', z.object({ reservationId: id })),
  action('dispatch.start', z.object({ reservationId: id })),
  // Driver phone GPS while a trip is IN_USE
  action('trip.position', z.object({
    reservationId: id,
    employeeId: id,
    lat: latitude,
    lng: longitude,
    speedKmh: z.number().min(0).max(400).nullable(),
    headingDeg: z.number().min(0).max(360).nullable(),
    accuracyM: accuracy,
  })),
  // Pre/post-trip checklist (driver) and fix record that clears an inspection lock (admin)
  action('inspection.submit', InspectionAnswersSchema.extend({
    reservationId: id,
    employeeId: id,
    kind: z.enum(['PRE_TRIP', 'POST_TRIP']),
  })),
  action('inspection.resolve', z.object({ inspectionId: id, resolution: z.string().trim().min(1).max(300) })),
  action('dispatch.quickStart', z.object({ employeeId: id, vehicleId: id, purpose: TripPurposeSchema })),
  action('dispatch.return', z.object({
    reservationId: id,
    parkingZone: z.string().trim().min(1).max(80),
    keyReturnedToBox: z.boolean(),
    inspection: InspectionAnswersSchema.optional(),
  })),
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
