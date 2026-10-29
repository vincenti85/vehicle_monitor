'use client';

// Keeps every open screen in step with the server: loads once, polls every 15 s while the
// page is visible (and immediately when it becomes visible again), and sends user actions
// to POST /api/fleet/actions. Snapshots older than what the screen already shows are ignored.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FleetDatabaseSchema } from '@/lib/fleetDatabase';
import type { ActionRequest } from '@/lib/actionSchemas';
import { driverHeaders } from '@/lib/driverDevice';
import { DispatchResult } from '@/utils/dispatchRules';

export const POLL_INTERVAL_MS = 15_000;

export type FleetSyncStatus = 'HYDRATING' | 'SYNCED' | 'SAVING' | 'ERROR';

interface FleetSyncState {
  status: FleetSyncStatus;
  /** True once the first successful load has been applied. */
  hydrated: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  revision: number | null;
}

export function useFleetSync(
  applySnapshot: (db: FleetDatabaseSchema) => void,
  adminPin: string | null
) {
  const [state, setState] = useState<FleetSyncState>({
    status: 'HYDRATING',
    hydrated: false,
    error: null,
    lastSyncedAt: null,
    revision: null,
  });
  const revisionRef = useRef<number | null>(null);
  const applyRef = useRef(applySnapshot);
  applyRef.current = applySnapshot;
  const pendingActions = useRef(0);

  const accept = useCallback((db: FleetDatabaseSchema) => {
    if (revisionRef.current !== null && db.revision < revisionRef.current) return;
    revisionRef.current = db.revision;
    applyRef.current(db);
    setState((s) => ({
      ...s,
      hydrated: true,
      error: null,
      revision: db.revision,
      lastSyncedAt: Date.now(),
      status: pendingActions.current > 0 ? 'SAVING' : 'SYNCED',
    }));
  }, []);

  // Admins see employee phone numbers, so a fresh PIN forces a full reload instead of a 204
  useEffect(() => {
    revisionRef.current = null;
  }, [adminPin]);

  const refresh = useCallback(async () => {
    const rev = revisionRef.current;
    try {
      const res = await fetch(`/api/fleet/state${rev === null ? '' : `?rev=${rev}`}`, {
        cache: 'no-store',
        headers: adminPin ? { 'x-admin-pin': adminPin } : {},
      });
      if (res.status === 204) {
        setState((s) => ({ ...s, error: null, lastSyncedAt: Date.now(), status: pendingActions.current > 0 ? 'SAVING' : 'SYNCED' }));
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`);
      accept(body.data as FleetDatabaseSchema);
    } catch (err) {
      setState((s) => ({ ...s, status: 'ERROR', error: err instanceof Error ? err.message : 'DB load failed' }));
    }
  }, [accept, adminPin]);

  // Initial load, 15 s polling while visible, immediate refresh when the user comes back
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  const runAction = useCallback(
    async (action: ActionRequest): Promise<DispatchResult> => {
      pendingActions.current += 1;
      setState((s) => ({ ...s, status: 'SAVING' }));
      try {
        const res = await fetch('/api/fleet/actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...driverHeaders(),
            ...(adminPin ? { 'x-admin-pin': adminPin } : {}),
          },
          body: JSON.stringify(action),
        });
        const body = await res.json().catch(() => null);
        if (body?.data) accept(body.data as FleetDatabaseSchema);
        if (res.status >= 500) {
          setState((s) => ({ ...s, status: 'ERROR', error: body?.message ?? `HTTP ${res.status}` }));
        }
        return { ok: Boolean(res.ok && body?.ok), message: body?.message ?? `요청 실패 (HTTP ${res.status})` };
      } catch {
        setState((s) => ({ ...s, status: 'ERROR', error: '서버에 연결할 수 없습니다.' }));
        return { ok: false, message: '서버에 연결할 수 없습니다. 네트워크를 확인한 뒤 다시 시도하세요.' };
      } finally {
        pendingActions.current -= 1;
        setState((s) => (s.status === 'SAVING' && pendingActions.current === 0 ? { ...s, status: 'SYNCED' } : s));
      }
    },
    [accept, adminPin]
  );

  return { ...state, refresh, runAction };
}
