'use client';

import React, { useEffect, useState } from 'react';
import { STALE_FIX_MINUTES, tripSignal } from '@/domain/trip';
import { Vehicle } from '@/types/fleet';

interface TripSignalBadgeProps {
  vehicle: Vehicle;
  isEng: boolean;
  className?: string;
}

const STYLES = {
  LIVE: 'bg-[#10B981]/15 text-[#047857]',
  STALE: 'bg-[#FF5B4F]/15 text-[#DC2626]',
  NO_FIX: 'bg-[#F59E0B]/15 text-[#B45309]',
} as const;

/** Freshness of the driver's phone GPS for a vehicle out on a trip (nothing when parked). */
export const TripSignalBadge: React.FC<TripSignalBadgeProps> = ({ vehicle, isEng, className = '' }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { state, minutesAgo } = tripSignal(vehicle, now);
  if (state === 'PARKED') return null;

  const label =
    state === 'NO_FIX'
      ? isEng
        ? 'No phone GPS yet'
        : 'GPS 미수신'
      : state === 'STALE'
        ? isEng
          ? `GPS lost · ${minutesAgo} min`
          : `GPS 끊김 · ${minutesAgo}분 전`
        : isEng
          ? `GPS ${minutesAgo} min ago`
          : `GPS ${minutesAgo}분 전`;
  const title = isEng
    ? `Driver phone reports every 10 min; flagged after ${STALE_FIX_MINUTES} min without a fix`
    : `운전자 휴대폰이 10분마다 위치를 보냅니다. ${STALE_FIX_MINUTES}분 이상 수신이 없으면 끊김으로 표시합니다.`;
  return (
    <span
      title={title}
      className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-mono ${STYLES[state]} ${className}`}
      data-testid="trip-signal-badge"
    >
      {label}
    </span>
  );
};
