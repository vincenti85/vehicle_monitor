import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFileBackend, setFleetStorageForTests } from '@/lib/fleetStorage';
import { MAX_PIN_FAILURES, setPinThrottleStorageForTests } from '@/lib/adminPinGuard';
import { POST as verifyPin } from './admin/verify-pin/route';
import { POST as issueDriverLink } from './admin/driver-token/route';
import { POST as postAction } from './fleet/actions/route';
import { GET as getState } from './fleet/state/route';
import { POST as postTelemetry } from './fleet/telemetry/route';

const PIN = '44005521';

function req(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
const fromIp = (ip: string, extra: Record<string, string> = {}) => ({ 'x-forwarded-for': ip, ...extra });
const tryPin = (pin: string, ip: string) => verifyPin(req('/api/admin/verify-pin', { pin }, fromIp(ip)));

describe('security of the fleet API routes', () => {
  let dir: string;
  beforeAll(() => {
    process.env.FLEET_ADMIN_PIN = PIN;
  });
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-security-'));
    setFleetStorageForTests(createFileBackend(dir, 'LOCAL_FILE'));
    setPinThrottleStorageForTests(createFileBackend(dir, 'LOCAL_FILE', 'pin-throttle.json'));
  });
  afterEach(() => {
    setFleetStorageForTests(null);
    setPinThrottleStorageForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('admin PIN brute force (finding 1)', () => {
    it('locks an IP out after repeated wrong PINs, even for the right PIN', async () => {
      for (let i = 0; i < MAX_PIN_FAILURES; i += 1) {
        expect((await tryPin('1111', '203.0.113.7')).status).toBe(401);
      }
      const locked = await tryPin(PIN, '203.0.113.7');
      expect(locked.status).toBe(429);
      expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0);
      // Another client is unaffected
      expect((await tryPin(PIN, '198.51.100.2')).status).toBe(200);
    });

    it('persists the failure count in the store, not in process memory', async () => {
      for (let i = 0; i < MAX_PIN_FAILURES; i += 1) await tryPin('2222', '203.0.113.8');
      expect(fs.existsSync(path.join(dir, 'pin-throttle.json'))).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'pin-throttle.json'), 'utf-8')).toContain('203.0.113.8');
    });

    it('counts wrong x-admin-pin headers on actions and then answers 429', async () => {
      const action = { type: 'vehicle.toggleLock', payload: { vehicleId: 'veh-8' } };
      for (let i = 0; i < MAX_PIN_FAILURES; i += 1) {
        expect((await postAction(req('/api/fleet/actions', action, fromIp('203.0.113.9', { 'x-admin-pin': '9999' })))).status).toBe(401);
      }
      const locked = await postAction(req('/api/fleet/actions', action, fromIp('203.0.113.9', { 'x-admin-pin': PIN })));
      expect(locked.status).toBe(429);
    });

    it('accepts PINs longer than 4 digits', async () => {
      expect((await tryPin(PIN, '198.51.100.3')).status).toBe(200);
    });
  });

  describe('phone numbers in fleet state (finding 6)', () => {
    it('hides phone numbers from anonymous readers and action responses', async () => {
      const anon = await (await getState(new NextRequest('http://localhost/api/fleet/state'))).json();
      expect(anon.data.employees.every((e: { phone: string }) => e.phone === '')).toBe(true);
      const action = {
        type: 'dispatch.request',
        payload: { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00', notes: '' },
      };
      const acted = await (await postAction(req('/api/fleet/actions', action))).json();
      expect(acted.data.employees.every((e: { phone: string }) => e.phone === '')).toBe(true);
    });

    it('shows phone numbers to a verified admin', async () => {
      const admin = await (
        await getState(new NextRequest('http://localhost/api/fleet/state', { headers: { 'x-admin-pin': PIN } }))
      ).json();
      expect(admin.data.employees.some((e: { phone: string }) => /\d/.test(e.phone))).toBe(true);
    });
  });

  describe('driver enrollment and telemetry (findings 2 and 3)', () => {
    const packet = (employeeId: string) => ({
      employeeId,
      vehicleId: 'veh-8',
      plateNumber: 'AL 41B-3196',
      lat: 32.7,
      lng: -85.31,
      speedKmh: 0,
      deltaSpeedKmh: 0,
      gForce: 1,
      gyroYawDegPerSec: 0,
      persistToDb: true,
    });
    const goLive = () => postAction(req('/api/fleet/actions', { type: 'admin.clearDemo', payload: { removeDemoEmployees: false } }, { 'x-admin-pin': PIN }));

    it('issues a device link only to admins', async () => {
      expect((await issueDriverLink(req('/api/admin/driver-token', { employeeId: 'emp-06' }))).status).toBe(401);
      const issued = await (await issueDriverLink(req('/api/admin/driver-token', { employeeId: 'emp-06' }, { 'x-admin-pin': PIN }))).json();
      expect(issued.ok).toBe(true);
      expect(issued.token).toMatch(/^emp-06\./);
    });

    it('rejects telemetry for unknown employees', async () => {
      const res = await postTelemetry(req('/api/fleet/telemetry', packet('emp-nobody')));
      expect(res.status).toBe(404);
    });

    it('requires the enrolled phone for telemetry in LIVE mode', async () => {
      await goLive();
      expect((await postTelemetry(req('/api/fleet/telemetry', packet('emp-06')))).status).toBe(401);
      const { token } = await (await issueDriverLink(req('/api/admin/driver-token', { employeeId: 'emp-06' }, { 'x-admin-pin': PIN }))).json();
      const other = await (await issueDriverLink(req('/api/admin/driver-token', { employeeId: 'emp-01' }, { 'x-admin-pin': PIN }))).json();
      expect((await postTelemetry(req('/api/fleet/telemetry', packet('emp-06'), { 'x-driver-token': other.token }))).status).toBe(401);
      expect((await postTelemetry(req('/api/fleet/telemetry', packet('emp-06'), { 'x-driver-token': token }))).status).toBe(200);
    });

    it('accepts a driver action carrying the enrolled token in LIVE mode', async () => {
      await goLive();
      const { token } = await (await issueDriverLink(req('/api/admin/driver-token', { employeeId: 'emp-06' }, { 'x-admin-pin': PIN }))).json();
      const action = {
        type: 'dispatch.request',
        payload: { employeeId: 'emp-06', vehicleId: 'veh-8', purpose: '거래처방문', destination: 'HMMA', plannedTimeWindow: '21:00', notes: '' },
      };
      expect((await (await postAction(req('/api/fleet/actions', action))).json()).ok).toBe(false);
      expect((await (await postAction(req('/api/fleet/actions', action, { 'x-driver-token': token }))).json()).ok).toBe(true);
    });
  });
});
