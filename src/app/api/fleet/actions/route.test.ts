import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFileBackend, setFleetStorageForTests } from '@/lib/fleetStorage';
import { setPinThrottleStorageForTests } from '@/lib/adminPinGuard';
import { POST } from './route';
import { GET } from '../state/route';

const PIN = '4400';

function post(body: unknown, pin?: string) {
  return POST(
    new NextRequest('http://localhost/api/fleet/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(pin ? { 'x-admin-pin': pin } : {}) },
      body: JSON.stringify(body),
    })
  );
}
const request8 = (employeeId: string) => ({
  type: 'dispatch.request',
  payload: { employeeId, vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00 ~ 23:00', notes: '' },
});

const CHECKLIST = ['tires', 'lights', 'glass-wipers', 'body-damage', 'fuel', 'warning-lights', 'brakes', 'interior'];
const preTrip = (reservationId: string, employeeId: string, failed: Record<string, string> = {}) => ({
  type: 'inspection.submit',
  payload: {
    reservationId,
    employeeId,
    kind: 'PRE_TRIP',
    items: CHECKLIST.map((itemId) => ({ itemId, passed: !failed[itemId], note: failed[itemId] ?? '' })),
    startedAt: new Date().toISOString(),
    startLat: null, startLng: null, submitLat: null, submitLng: null, accuracyM: null,
  },
});
/** A booking window starting `hoursAhead` from now (the route stamps the real clock). */
const timed8 = (employeeId: string, hoursAhead: number, lengthMin = 60) => {
  const start = new Date(Date.now() + hoursAhead * 3_600_000);
  start.setUTCSeconds(0, 0);
  const end = new Date(start.getTime() + lengthMin * 60_000);
  return {
    type: 'dispatch.request',
    payload: { employeeId, vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedStartAt: start.toISOString(), plannedEndAt: end.toISOString(), notes: '' },
  };
};
const openOn8 = (data: { reservations: { vehicleId: string; stage: string }[] }) =>
  data.reservations.filter((r) => r.vehicleId === 'veh-8' && ['REQUESTED', 'APPROVED', 'IN_USE'].includes(r.stage));

describe('POST /api/fleet/actions', () => {
  let dir: string;
  beforeAll(() => {
    process.env.FLEET_ADMIN_PIN = PIN;
  });
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-actions-'));
    setFleetStorageForTests(createFileBackend(dir, 'LOCAL_FILE'));
    setPinThrottleStorageForTests(createFileBackend(dir, 'LOCAL_FILE', 'pin-throttle.json'));
  });
  afterEach(() => {
    setFleetStorageForTests(null);
    setPinThrottleStorageForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs an employee action and returns the result with the new state and revision', async () => {
    const res = await post(request8('emp-06'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, revision: 1 });
    expect(body.data.reservations.some((r: { vehicleId: string; stage: string }) => r.vehicleId === 'veh-8' && r.stage === 'REQUESTED')).toBe(true);
  });

  it('lets exactly one of two simultaneous requests for the same vehicle win', async () => {
    const [a, b] = await Promise.all([post(request8('emp-06')), post(request8('emp-01'))]);
    const results = [await a.json(), await b.json()];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)[0].message).toMatch(/이미 배차가 진행 중/);
    const final = results.reduce((x, y) => (x.revision > y.revision ? x : y)).data;
    expect(final.reservations.filter((r: { vehicleId: string; stage: string }) => r.vehicleId === 'veh-8' && r.stage === 'REQUESTED')).toHaveLength(1);
  });

  it('keeps both devices’ changes when they act on different vehicles at the same time', async () => {
    const other = { ...request8('emp-02'), payload: { ...request8('emp-02').payload, vehicleId: 'veh-9' } };
    await Promise.all([post(request8('emp-06')), post(other)]);
    const state = await (await GET(new NextRequest('http://localhost/api/fleet/state'))).json();
    const open = state.data.reservations.filter((r: { stage: string }) => r.stage === 'REQUESTED').map((r: { vehicleId: string }) => r.vehicleId);
    expect(open).toEqual(expect.arrayContaining(['veh-8', 'veh-9']));
  });

  it('requires the admin PIN to approve', async () => {
    const created = await (await post(request8('emp-06'))).json();
    const resId = created.data.reservations.find((r: { vehicleId: string }) => r.vehicleId === 'veh-8').id;
    const denied = await post({ type: 'dispatch.approve', payload: { reservationId: resId } });
    expect(denied.status).toBe(401);
    expect((await denied.json()).message).toMatch(/관리자/);
    const wrong = await post({ type: 'dispatch.approve', payload: { reservationId: resId } }, '0000');
    expect(wrong.status).toBe(401);
    const approved = await (await post({ type: 'dispatch.approve', payload: { reservationId: resId } }, PIN)).json();
    expect(approved.ok).toBe(true);
  });

  it('records the driver phone position on an IN_USE trip and shows it in polled state', async () => {
    const created = await (await post(request8('emp-06'))).json();
    const resId = created.data.reservations.find((r: { vehicleId: string }) => r.vehicleId === 'veh-8').id;
    await post({ type: 'dispatch.approve', payload: { reservationId: resId } }, PIN);
    await post(preTrip(resId, 'emp-06'));
    await post({ type: 'dispatch.start', payload: { reservationId: resId } });

    const ping = { reservationId: resId, employeeId: 'emp-06', lat: 32.65, lng: -85.38, speedKmh: 55, headingDeg: 180, accuracyM: 8 };
    const sent = await (await post({ type: 'trip.position', payload: ping })).json();
    expect(sent.ok).toBe(true);

    const state = await (await GET(new NextRequest('http://localhost/api/fleet/state'))).json();
    const veh = state.data.vehicles.find((v: { id: string }) => v.id === 'veh-8');
    expect(veh).toMatchObject({ lat: 32.65, lng: -85.38, speedKmh: 55 });
    expect(typeof veh.lastFixAt).toBe('string');

    expect((await post({ type: 'trip.position', payload: { ...ping, lat: 999 } })).status).toBe(400);
    const stranger = await (await post({ type: 'trip.position', payload: { ...ping, employeeId: 'emp-01' } })).json();
    expect(stranger.ok).toBe(false);
  });

  it('rejects malformed actions with 400', async () => {
    expect((await post({ type: 'dispatch.request', payload: { vehicleId: 'veh-8' } })).status).toBe(400);
    expect((await post({ type: 'nope', payload: {} })).status).toBe(400);
  });

  it('allows demo simulations only in DEMO mode', async () => {
    const demo = { type: 'demo.crashOrDrop', payload: { vehicleId: 'veh-1', isRealCrash: true } };
    expect((await (await post(demo)).json()).ok).toBe(true);
    await post({ type: 'admin.clearDemo', payload: { removeDemoEmployees: false } }, PIN);
    const live = await (await post(demo)).json();
    expect(live.ok).toBe(false);
    expect(live.message).toMatch(/데모 모드/);
  });
});

describe('booking windows and inspections over the API', () => {
  let dir: string;
  beforeAll(() => {
    process.env.FLEET_ADMIN_PIN = PIN;
  });
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-booking-'));
    setFleetStorageForTests(createFileBackend(dir, 'LOCAL_FILE'));
    setPinThrottleStorageForTests(createFileBackend(dir, 'LOCAL_FILE', 'pin-throttle.json'));
  });
  afterEach(() => {
    setFleetStorageForTests(null);
    setPinThrottleStorageForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lets exactly one of two simultaneous overlapping bookings win', async () => {
    const [a, b] = await Promise.all([post(timed8('emp-06', 24)), post(timed8('emp-01', 24.5))]);
    const results = [await a.json(), await b.json()];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)[0].message).toMatch(/겹칩니다/);
    const final = results.reduce((x, y) => (x.revision > y.revision ? x : y)).data;
    expect(openOn8(final)).toHaveLength(1);
  });

  it('keeps both of two simultaneous non-overlapping bookings on one vehicle', async () => {
    await Promise.all([post(timed8('emp-06', 24)), post(timed8('emp-01', 48))]);
    const state = await (await GET(new NextRequest('http://localhost/api/fleet/state'))).json();
    expect(openOn8(state.data)).toHaveLength(2);
  });

  it('answers 400 with a Korean reason for a bad window', async () => {
    const bad = timed8('emp-06', 24);
    const res = await post({ ...bad, payload: { ...bad.payload, plannedEndAt: bad.payload.plannedStartAt } });
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0].message).toBe('종료 시각은 시작 시각보다 늦어야 합니다.');
  });

  it('requires the admin PIN to change booking/inspection policy and to resolve an inspection', async () => {
    const state = await (await GET(new NextRequest('http://localhost/api/fleet/state'))).json();
    const policy = { type: 'policy.update', payload: { policyConfig: { ...state.data.policyConfig, bookingBufferMinutes: 0, requirePreTripInspection: false } } };
    expect((await post(policy)).status).toBe(401);
    expect((await post({ type: 'inspection.resolve', payload: { inspectionId: 'x', resolution: '조치' } })).status).toBe(401);
    const saved = await (await post(policy, PIN)).json();
    expect(saved.data.policyConfig).toMatchObject({ bookingBufferMinutes: 0, requirePreTripInspection: false });
  });

  it('locks the vehicle in the same response on a critical PRE_TRIP failure and then refuses the start', async () => {
    const created = await (await post(request8('emp-06'))).json();
    const resId = created.data.reservations.find((r: { vehicleId: string }) => r.vehicleId === 'veh-8').id;
    await post({ type: 'dispatch.approve', payload: { reservationId: resId } }, PIN);
    const failed = await (await post(preTrip(resId, 'emp-06', { 'warning-lights': '엔진 경고등' }))).json();
    expect(failed.ok).toBe(false);
    expect(failed.data.vehicles.find((v: { id: string }) => v.id === 'veh-8')).toMatchObject({ isLockedByAdmin: true, lockReason: 'INSPECTION_FAILED' });
    // Notes and coordinates are hidden from the anonymous response
    expect(failed.data.inspections[0].items.find((i: { itemId: string }) => i.itemId === 'warning-lights').note).toBe('');
    const start = await (await post({ type: 'dispatch.start', payload: { reservationId: resId } })).json();
    expect(start.ok).toBe(false);
    expect(start.message).toMatch(/잠근 차량/);

    const inspectionId = failed.data.inspections[0].id;
    const resolved = await (await post({ type: 'inspection.resolve', payload: { inspectionId, resolution: '경고등 원인 수리' } }, PIN)).json();
    expect(resolved.ok).toBe(true);
    expect(resolved.data.inspections[0].items.find((i: { itemId: string }) => i.itemId === 'warning-lights').note).toBe('엔진 경고등');
    await post(preTrip(resId, 'emp-06'));
    expect((await (await post({ type: 'dispatch.start', payload: { reservationId: resId } })).json()).ok).toBe(true);
  });
});

describe('GET /api/fleet/state polling', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-poll-'));
    setFleetStorageForTests(createFileBackend(dir, 'LOCAL_FILE'));
  });
  afterEach(() => {
    setFleetStorageForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('answers 204 when the client already has the current revision', async () => {
    const first = await (await GET(new NextRequest('http://localhost/api/fleet/state'))).json();
    const same = await GET(new NextRequest(`http://localhost/api/fleet/state?rev=${first.data.revision}`));
    expect(same.status).toBe(204);
    const stale = await GET(new NextRequest('http://localhost/api/fleet/state?rev=-1'));
    expect(stale.status).toBe(200);
  });
});
