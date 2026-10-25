import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFileBackend, setFleetStorageForTests } from '@/lib/fleetStorage';
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

describe('POST /api/fleet/actions', () => {
  let dir: string;
  beforeAll(() => {
    process.env.FLEET_ADMIN_PIN = PIN;
  });
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-actions-'));
    setFleetStorageForTests(createFileBackend(dir, 'LOCAL_FILE'));
  });
  afterEach(() => {
    setFleetStorageForTests(null);
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
