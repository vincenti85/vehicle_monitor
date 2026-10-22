'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardPlus,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Employee,
  ReservationStage,
  TripPurpose,
  Vehicle,
  VehicleReservation,
} from '@/types/fleet';
import { AppLang, formatDeptName, formatEmpName, formatTripPurpose } from '@/utils/i18n';

interface ReservationWorkflowPanelProps {
  reservations: VehicleReservation[];
  vehicles: Vehicle[];
  employees: Employee[];
  autoApproveWhenManagerAway: boolean;
  onToggleAutoApprove: () => void;
  onCreateRequest: (payload: {
    employeeId: string;
    vehicleId: string;
    purpose: TripPurpose;
    destination: string;
    plannedTimeWindow: string;
    notes: string;
  }) => void;
  onApproveRequest: (reservationId: string) => void;
  onRejectRequest: (reservationId: string) => void;
  onStartUsingVehicle: (reservationId: string) => void;
  onReturnVehicle: (
    reservationId: string,
    parkingZone: string,
    keyReturnedToBox: boolean
  ) => void;
  lang?: AppLang;
}

export const ReservationWorkflowPanel: React.FC<ReservationWorkflowPanelProps> = ({
  reservations,
  vehicles,
  employees,
  autoApproveWhenManagerAway,
  onToggleAutoApprove,
  onCreateRequest,
  onApproveRequest,
  onRejectRequest,
  onStartUsingVehicle,
  onReturnVehicle,
  lang = 'KOR',
}) => {
  const isEng = lang === 'ENG';
  const [stageFilter, setStageFilter] = useState<'ALL' | ReservationStage>('ALL');
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);

  const [empId, setEmpId] = useState<string>('emp-04');
  const [vehId, setVehId] = useState<string>('veh-8');
  const [purpose, setPurpose] = useState<TripPurpose>('거래처방문');
  const [destination, setDestination] = useState<string>('HMMA Montgomery, AL');
  const [timeWindow, setTimeWindow] = useState<string>('21:30 ~ 23:30');
  const [notes, setNotes] = useState<string>('');

  const [returnZoneMap, setReturnZoneMap] = useState<Record<string, string>>({});

  const stageCounts = {
    REQUESTED: reservations.filter((r) => r.stage === 'REQUESTED').length,
    APPROVED: reservations.filter((r) => r.stage === 'APPROVED').length,
    IN_USE: reservations.filter((r) => r.stage === 'IN_USE').length,
    RETURNED: reservations.filter((r) => r.stage === 'RETURNED').length,
  };

  const filteredReservations =
    stageFilter === 'ALL'
      ? reservations
      : reservations.filter((r) => r.stage === stageFilter);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateRequest({
      employeeId: empId,
      vehicleId: vehId,
      purpose,
      destination,
      plannedTimeWindow: timeWindow,
      notes,
    });
    setShowRequestForm(false);
  };

  return (
    <div className="p-4 space-y-3 bg-[#0A0A0A]">
      {/* Minimal Filter & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-1">
          {[
            {
              id: 'ALL' as const,
              label: isEng ? `All ${reservations.length}` : `전체 ${reservations.length}`,
            },
            {
              id: 'REQUESTED' as const,
              label: isEng
                ? `Pending ${stageCounts.REQUESTED}`
                : `승인대기 ${stageCounts.REQUESTED}`,
            },
            {
              id: 'APPROVED' as const,
              label: isEng
                ? `Approved ${stageCounts.APPROVED}`
                : `승인완료 ${stageCounts.APPROVED}`,
            },
            {
              id: 'IN_USE' as const,
              label: isEng
                ? `In Use ${stageCounts.IN_USE}`
                : `운행중 ${stageCounts.IN_USE}`,
            },
            {
              id: 'RETURNED' as const,
              label: isEng
                ? `Returned ${stageCounts.RETURNED}`
                : `반납완료 ${stageCounts.RETURNED}`,
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStageFilter(item.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
                stageFilter === item.id
                  ? 'bg-[#FAFAFA] text-[#0A0A0A] font-semibold'
                  : 'bg-[#111111] text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleAutoApprove}
            className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1 transition ${
              autoApproveWhenManagerAway
                ? 'bg-[#10B981]/15 text-[#34D399]'
                : 'bg-[#111111] text-[#71717A]'
            }`}
            style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {autoApproveWhenManagerAway
              ? isEng
                ? 'Auto-Approve ON'
                : '자동승인 ON'
              : isEng
                ? 'Manual Approval'
                : '수동승인'}
          </button>

          <button
            type="button"
            onClick={() => setShowRequestForm((p) => !p)}
            className="px-3 py-1 rounded-md bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-medium flex items-center gap-1 transition"
          >
            <ClipboardPlus className="w-3.5 h-3.5" />
            {isEng ? 'New Request' : '배차 신청'}
          </button>
        </div>
      </div>

      {/* Compact New Request Form */}
      {showRequestForm && (
        <form
          onSubmit={handleFormSubmit}
          className="p-3 rounded-lg bg-[#111111] space-y-2.5"
          style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className="rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-[#FAFAFA]"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {formatEmpName(e.name, lang)} ({formatDeptName(e.department, lang)})
                </option>
              ))}
            </select>

            <select
              value={vehId}
              onChange={(e) => setVehId(e.target.value)}
              className="rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-[#FAFAFA]"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {isEng
                    ? `Unit #${v.fleetNumber} · ${v.plateNumber}`
                    : `#${v.fleetNumber}호차 · ${v.plateNumber}`}
                </option>
              ))}
            </select>

            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as TripPurpose)}
              className="rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-[#FAFAFA]"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <option value="거래처방문">{isEng ? 'Client Visit' : '거래처방문'}</option>
              <option value="일반업무/외근">{isEng ? 'Field Business' : '일반업무/외근'}</option>
              <option value="긴급출동/현장지원">
                {isEng ? 'Urgent Support' : '긴급출동/현장지원'}
              </option>
              <option value="출퇴근(승인)">
                {isEng ? 'Approved Commute' : '출퇴근(승인)'}
              </option>
            </select>

            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-[#FAFAFA]"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
              placeholder={isEng ? 'Destination' : '행선지'}
              required
            />

            <div className="flex gap-1.5">
              <input
                type="text"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full rounded-md bg-[#0A0A0A] px-2 py-1.5 text-[#FAFAFA]"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                placeholder={isEng ? 'Time' : '시간'}
                required
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-[#FAFAFA] text-[#0A0A0A] font-semibold shrink-0"
              >
                {isEng ? 'Submit' : '등록'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Compact Reservation Rows */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filteredReservations.map((res) => {
          const defaultZone =
            returnZoneMap[res.id] ||
            `Northpark Lot A #${res.fleetNumber.toString().padStart(2, '0')}`;

          return (
            <div
              key={res.id}
              className="p-3 rounded-lg bg-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    res.stage === 'REQUESTED'
                      ? 'bg-[#FBBF24]/15 text-[#FBBF24]'
                      : res.stage === 'APPROVED'
                        ? 'bg-[#0A72EF]/15 text-[#60A5FA]'
                        : res.stage === 'IN_USE'
                          ? 'bg-[#0A72EF] text-white'
                          : res.stage === 'RETURNED'
                            ? 'bg-[#10B981]/15 text-[#34D399]'
                            : 'bg-[#FF5B4F]/15 text-[#FF5B4F]'
                  }`}
                >
                  {res.stage === 'REQUESTED'
                    ? isEng
                      ? 'Pending'
                      : '승인대기'
                    : res.stage === 'APPROVED'
                      ? isEng
                        ? 'Approved'
                        : '승인완료'
                      : res.stage === 'IN_USE'
                        ? isEng
                          ? 'In Use'
                          : '운행중'
                        : res.stage === 'RETURNED'
                          ? isEng
                            ? 'Returned'
                            : '반납완료'
                          : isEng
                            ? 'Rejected'
                            : '반려'}
                </span>

                <span className="font-mono font-semibold text-[#FAFAFA]">
                  {isEng
                    ? `Unit #${res.fleetNumber} · ${res.plateNumber}`
                    : `#${res.fleetNumber}호차 · ${res.plateNumber}`}
                </span>
                <span className="text-[#FAFAFA]">
                  {formatEmpName(res.employeeName, lang)}
                </span>
                <span className="text-[#71717A]">·</span>
                <span className="text-[#A1A1AA]">{res.destination}</span>
                <span className="text-[11px] font-mono text-[#71717A]">
                  ({formatTripPurpose(res.purpose, lang)} · {res.plannedTimeWindow})
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {res.stage === 'REQUESTED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onApproveRequest(res.id)}
                      className="px-2.5 py-1 rounded-md bg-[#10B981] text-white text-xs font-medium flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {isEng ? 'Approve' : '승인'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectRequest(res.id)}
                      className="px-2.5 py-1 rounded-md bg-[#FF5B4F]/15 text-[#FF5B4F] text-xs font-medium flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      {isEng ? 'Reject' : '반려'}
                    </button>
                  </>
                )}

                {res.stage === 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => onStartUsingVehicle(res.id)}
                    className="px-3 py-1 rounded-md bg-[#0A72EF] text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    {isEng ? 'Start Trip' : '운행 시작'}
                  </button>
                )}

                {res.stage === 'IN_USE' && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={defaultZone}
                      onChange={(e) =>
                        setReturnZoneMap((prev) => ({ ...prev, [res.id]: e.target.value }))
                      }
                      className="rounded-md bg-[#0A0A0A] px-2 py-1 text-[11px] text-[#FAFAFA]"
                      style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                    >
                      <option
                        value={`Northpark Lot A #${res.fleetNumber.toString().padStart(2, '0')}`}
                      >
                        Lot A #{res.fleetNumber.toString().padStart(2, '0')}
                      </option>
                      <option
                        value={`Northpark Lot B #${res.fleetNumber.toString().padStart(2, '0')}`}
                      >
                        Lot B #{res.fleetNumber.toString().padStart(2, '0')}
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onReturnVehicle(res.id, defaultZone, true)}
                      className="px-2.5 py-1 rounded-md bg-[#10B981] text-white text-xs font-medium flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {isEng ? 'Return' : '반납 완료'}
                    </button>
                  </div>
                )}

                {res.stage === 'RETURNED' && (
                  <span className="text-[11px] font-mono text-[#34D399]">
                    {res.endOdometerKm
                      ? `+${(res.endOdometerKm - res.startOdometerKm).toFixed(1)}km`
                      : isEng
                        ? 'Returned'
                        : '반납됨'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
