'use client';

import React from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { TRIP_FIX_INTERVAL_MINUTES } from '@/domain/trip';
import type { TripReporter } from '@/hooks/useTripPositionReporter';
import { VehicleReservation } from '@/types/fleet';

interface TripGpsStatusProps {
  reservation: VehicleReservation;
  reporter: TripReporter;
  isEng: boolean;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Driver phone card line: whether this device is sending GPS for the trip. */
export const TripGpsStatus: React.FC<TripGpsStatusProps> = ({ reservation, reporter, isEng }) => {
  if (reporter.reservationId !== reservation.id) {
    return (
      <button
        type="button"
        onClick={() => reporter.startTracking(reservation.vehicleId, reservation.employeeId)}
        className="w-full py-1 rounded bg-[#0A72EF]/10 text-[#1D4ED8] text-[11px] font-medium flex items-center justify-center gap-1"
        data-testid="trip-gps-start"
      >
        <MapPin className="w-3 h-3" />
        {isEng ? 'Send this phone’s location for this trip' : '이 휴대폰으로 운행 위치 전송 시작'}
      </button>
    );
  }

  const sent = reporter.lastSentAt
    ? isEng
      ? `last sent ${clock(reporter.lastSentAt)}`
      : `마지막 전송 ${clock(reporter.lastSentAt)}`
    : isEng
      ? 'getting first fix…'
      : '첫 위치 확인 중…';
  return (
    <div className="rounded bg-[#10B981]/10 px-2 py-1.5 text-[11px] space-y-0.5" data-testid="trip-gps-status">
      <div className="flex items-center justify-between gap-1 text-[#047857]">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {isEng
            ? `Sending GPS every ${TRIP_FIX_INTERVAL_MINUTES} min · ${sent}`
            : `위치 전송 중 (${TRIP_FIX_INTERVAL_MINUTES}분마다) · ${sent}`}
        </span>
        <button type="button" onClick={reporter.stopTracking} className="text-[#52525B] hover:underline flex items-center gap-0.5">
          <MapPinOff className="w-3 h-3" />
          {isEng ? 'Stop' : '중지'}
        </button>
      </div>
      <div className="text-[#52525B]">
        {reporter.wakeLock
          ? isEng
            ? 'Screen kept on. Keep this page open while driving.'
            : '화면 꺼짐 방지 중 · 운행 중 이 화면을 닫지 마세요.'
          : isEng
            ? 'Keep the screen on and this page open — GPS stops when the screen is off.'
            : '화면을 켜 두고 이 페이지를 열어 두세요 · 화면이 꺼지면 위치 전송이 멈춥니다.'}
      </div>
      {reporter.error && <div className="text-[#DC2626]">{reporter.error}</div>}
    </div>
  );
};
