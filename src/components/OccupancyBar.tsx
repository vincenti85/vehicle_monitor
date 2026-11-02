'use client';

import React from 'react';
import { DayOccupancy } from '@/utils/bookingWindow';

interface OccupancyBarProps {
  occupancy: DayOccupancy;
  /** The window being chosen, in minutes after local midnight. */
  selection?: { startMin: number; endMin: number } | null;
  bufferMinutes: number;
  isEng?: boolean;
}

const pct = (min: number, total: number) => `${Math.min(100, Math.max(0, (min / total) * 100))}%`;

/** One local day of a vehicle: booked spans (with buffer shading) and the chosen window. */
export const OccupancyBar: React.FC<OccupancyBarProps> = ({ occupancy, selection, bufferMinutes, isEng = false }) => {
  const total = occupancy.dayMinutes || 1440;
  const blockedAllDay = occupancy.legacyBlockers.length > 0;
  return (
    <div className="space-y-1" aria-label={isEng ? 'Vehicle occupancy for the day' : '해당일 차량 점유'}>
      <div className="relative h-4 rounded bg-[#ECFDF5]" style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}>
        {blockedAllDay && <div className="absolute inset-0 rounded bg-[#F4F4F5] bg-[repeating-linear-gradient(45deg,#E4E4E7_0,#E4E4E7_4px,transparent_4px,transparent_8px)]" />}
        {occupancy.segments.map((s) => (
          <React.Fragment key={s.reservationId}>
            <div
              className="absolute top-0 h-full bg-[#FDE68A]/70"
              style={{ left: pct(s.startMin - bufferMinutes, total), width: pct(s.endMin - s.startMin + 2 * bufferMinutes, total) }}
            />
            <div
              className={`absolute top-0 h-full ${s.stage === 'REQUESTED' ? 'bg-[#F59E0B]' : 'bg-[#DC2626]'}`}
              style={{ left: pct(s.startMin, total), width: pct(s.endMin - s.startMin, total) }}
              title={`${s.who} · ${s.stage}`}
            />
          </React.Fragment>
        ))}
        {selection && selection.endMin > selection.startMin && (
          <div
            className="absolute -top-0.5 h-5 rounded-sm border-2 border-[#0A72EF]"
            style={{ left: pct(selection.startMin, total), width: pct(selection.endMin - selection.startMin, total) }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-[#71717A]">
        <span>0</span><span>6</span><span>12</span><span>18</span><span>24</span>
      </div>
      {(occupancy.segments.length > 0 || blockedAllDay) && (
        <ul className="text-[10px] text-[#52525B] space-y-0.5">
          {occupancy.segments.map((s) => (
            <li key={s.reservationId}>
              {s.startLabel}–{s.endLabel} · {s.who} · {s.stage === 'REQUESTED' ? (isEng ? 'pending' : '승인대기') : isEng ? 'booked' : '확정'}
            </li>
          ))}
          {blockedAllDay && (
            <li className="text-[#B45309]">
              {isEng ? 'An untimed request blocks this vehicle until it is closed.' : '시간 미지정(이전 방식) 신청이 있어 종료 전까지 이 차량은 신청할 수 없습니다.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
