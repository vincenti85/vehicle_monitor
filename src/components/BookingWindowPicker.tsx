'use client';

import React from 'react';
import { occupancyForDay } from '@/utils/bookingWindow';
import { BookingSelection } from '@/utils/bookingSelection';
import { VehicleReservation } from '@/types/fleet';
import { OccupancyBar } from './OccupancyBar';

interface BookingWindowPickerProps {
  value: BookingSelection;
  onChange: (next: BookingSelection) => void;
  /** Selected vehicle's bookings are drawn for the start date. */
  vehicleId: string;
  reservations: VehicleReservation[];
  bufferMinutes: number;
  /** UTC instants of the current selection (from evaluateSelection), for the highlight. */
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  /** Reason the selection would be refused; shown under the bar. */
  problem: string | null;
  isEng?: boolean;
}

const inputClass = 'rounded-md bg-[#FAFAFA] px-2 py-1.5 text-xs text-[#0A0A0A] min-h-9';
const inputStyle = { boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' };

/** Date + start/end time in fleet local time (America/Chicago) with the vehicle's day occupancy. */
export const BookingWindowPicker: React.FC<BookingWindowPickerProps> = ({
  value,
  onChange,
  vehicleId,
  reservations,
  bufferMinutes,
  plannedStartAt,
  plannedEndAt,
  problem,
  isEng = false,
}) => {
  const occupancy = occupancyForDay(reservations, vehicleId, value.startDate);
  const set = (patch: Partial<BookingSelection>) => onChange({ ...value, ...patch });
  // Highlight only the part of the selection that falls on the drawn day
  const selected: VehicleReservation[] =
    plannedStartAt && plannedEndAt
      ? [{ id: 'selection', vehicleId, stage: 'REQUESTED', employeeName: '', plannedStartAt, plannedEndAt } as VehicleReservation]
      : [];
  const selection = occupancyForDay(selected, vehicleId, value.startDate).segments[0] ?? null;

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-[10px] text-[#52525B] space-y-0.5">
          <span className="block">{isEng ? 'Start' : '시작'}</span>
          <input
            type="date"
            aria-label={isEng ? 'Start date' : '시작 날짜'}
            value={value.startDate}
            onChange={(e) => set({ startDate: e.target.value, endDate: value.endDate < e.target.value ? e.target.value : value.endDate })}
            className={`${inputClass} w-full`}
            style={inputStyle}
          />
          <input type="time" step={900} aria-label={isEng ? 'Start time' : '시작 시간'} value={value.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`${inputClass} w-full`} style={inputStyle} />
        </label>
        <label className="text-[10px] text-[#52525B] space-y-0.5">
          <span className="block">{isEng ? 'End' : '종료'}</span>
          <input type="date" aria-label={isEng ? 'End date' : '종료 날짜'} value={value.endDate} min={value.startDate} onChange={(e) => set({ endDate: e.target.value })} className={`${inputClass} w-full`} style={inputStyle} />
          <input type="time" step={900} aria-label={isEng ? 'End time' : '종료 시간'} value={value.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`${inputClass} w-full`} style={inputStyle} />
        </label>
      </div>
      <OccupancyBar occupancy={occupancy} selection={selection} bufferMinutes={bufferMinutes} isEng={isEng} />
      <p className="text-[10px] text-[#71717A]">{isEng ? 'Times are Opelika local (Central).' : '시간은 오펠라이카 현지(중부) 기준입니다.'}</p>
      {problem && (
        <p role="alert" className="text-[11px] text-[#B91C1C]">
          {problem}
        </p>
      )}
    </div>
  );
};
