'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  KeyRound,
  MapPin,
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
}) => {
  const [stageFilter, setStageFilter] = useState<'ALL' | ReservationStage>('ALL');
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);

  // New request form state
  const [empId, setEmpId] = useState<string>('emp-04');
  const [vehId, setVehId] = useState<string>('veh-8');
  const [purpose, setPurpose] = useState<TripPurpose>('거래처방문');
  const [destination, setDestination] = useState<string>(
    'HMMA (Hyundai Motor Mfg Alabama, Montgomery, AL)'
  );
  const [timeWindow, setTimeWindow] = useState<string>('21:30 ~ 23:30');
  const [notes, setNotes] = useState<string>('부품 품질 승인 건 고객사 방문');

  // Return modal/inline state per reservation
  const [returnZoneMap, setReturnZoneMap] = useState<Record<string, string>>({});
  const [keyBoxCheckMap, setKeyBoxCheckMap] = useState<Record<string, boolean>>({});

  const stageCounts = {
    REQUESTED: reservations.filter((r) => r.stage === 'REQUESTED').length,
    APPROVED: reservations.filter((r) => r.stage === 'APPROVED').length,
    IN_USE: reservations.filter((r) => r.stage === 'IN_USE').length,
    RETURNED: reservations.filter((r) => r.stage === 'RETURNED').length,
    REJECTED: reservations.filter((r) => r.stage === 'REJECTED').length,
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
    <div className="p-4 space-y-4">
      {/* Top 4-Stage Pipeline Bar & Auto-Approve Toggle */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-white/10">
        {/* 4-Step Pipeline Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStageFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
              stageFilter === 'ALL'
                ? 'bg-[#3E6AE1] text-white font-semibold'
                : 'bg-[#191E2A] text-[#9BA3B0] hover:text-white'
            }`}
          >
            전체 ({reservations.length})
          </button>

          <button
            type="button"
            onClick={() => setStageFilter('REQUESTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition ${
              stageFilter === 'REQUESTED'
                ? 'bg-[#F79009]/25 border-[#F79009] text-[#FDB022] font-semibold'
                : 'bg-[#191E2A] border-white/5 text-[#9BA3B0] hover:text-white'
            }`}
          >
            <span>1. 배차 신청(승인대기)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#F79009]/30 text-[#FDB022] text-[10px]">
              {stageCounts.REQUESTED}
            </span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-[#636B78] hidden sm:inline" />

          <button
            type="button"
            onClick={() => setStageFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition ${
              stageFilter === 'APPROVED'
                ? 'bg-[#3E6AE1]/25 border-[#3E6AE1] text-[#9BC1FF] font-semibold'
                : 'bg-[#191E2A] border-white/5 text-[#9BA3B0] hover:text-white'
            }`}
          >
            <span>2. 승인 완료(키수령대기)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#3E6AE1]/30 text-[#9BC1FF] text-[10px]">
              {stageCounts.APPROVED}
            </span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-[#636B78] hidden sm:inline" />

          <button
            type="button"
            onClick={() => setStageFilter('IN_USE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition ${
              stageFilter === 'IN_USE'
                ? 'bg-[#3E6AE1] border-[#688FF5] text-white font-semibold'
                : 'bg-[#191E2A] border-white/5 text-[#9BA3B0] hover:text-white'
            }`}
          >
            <span>3. 차량 사용중(운행중)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px]">
              {stageCounts.IN_USE}
            </span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-[#636B78] hidden sm:inline" />

          <button
            type="button"
            onClick={() => setStageFilter('RETURNED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition ${
              stageFilter === 'RETURNED'
                ? 'bg-[#12B76A]/25 border-[#12B76A] text-[#32D583] font-semibold'
                : 'bg-[#191E2A] border-white/5 text-[#9BA3B0] hover:text-white'
            }`}
          >
            <span>4. 반납 완료</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#12B76A]/30 text-[#32D583] text-[10px]">
              {stageCounts.RETURNED}
            </span>
          </button>
        </div>

        {/* Right Controls: Auto-Approve Toggle & New Request Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutoApprove}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition ${
              autoApproveWhenManagerAway
                ? 'bg-[#12B76A]/15 border-[#12B76A]/50 text-[#32D583]'
                : 'bg-[#191E2A] border-white/10 text-[#9BA3B0]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {autoApproveWhenManagerAway
              ? '관리자 부재 시 자동승인: ON'
              : '관리자 수동승인 모드: ON'}
          </button>

          <button
            type="button"
            onClick={() => setShowRequestForm((p) => !p)}
            className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-medium flex items-center gap-1.5 transition"
          >
            <ClipboardPlus className="w-3.5 h-3.5" />
            + 신규 차량 배차 신청
          </button>
        </div>
      </div>

      {/* Collapsible New Vehicle Request Form */}
      {showRequestForm && (
        <form
          onSubmit={handleFormSubmit}
          className="p-4 rounded-xl bg-[#191E2A] border border-[#3E6AE1]/40 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5">
              <ClipboardPlus className="w-4 h-4 text-[#3E6AE1]" />
              신규 법인차량 배차 신청서 작성 (4400 Northpark Dr, Opelika, AL)
            </h4>
            <span className="text-[11px] font-mono text-[#9BA3B0]">
              {autoApproveWhenManagerAway
                ? '⚡ 현재 자동승인 모드가 켜져 있어 신청 즉시 [승인 완료] 처리됩니다'
                : '관리자 승인 대기열(REQUESTED)로 등록됩니다'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                신청 직원 (운전자)
              </label>
              <select
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                신청 차량 (Lee County AL 41 플릿)
              </label>
              <select
                value={vehId}
                onChange={(e) => setVehId(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    #{v.fleetNumber}호차 · {v.plateNumber} ({v.modelName}) [{v.status}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                운행 목적
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as TripPurpose)}
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
              >
                <option value="거래처방문">거래처방문</option>
                <option value="일반업무/외근">일반업무/외근</option>
                <option value="긴급출동/현장지원">긴급출동/현장지원</option>
                <option value="출퇴근(승인)">출퇴근(승인)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                행선지 (미국 앨라배마/조지아 권역)
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
                placeholder="예: HMMA Montgomery / Kia Georgia / Auburn"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                예정 사용 시간
              </label>
              <input
                type="text"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
                placeholder="예: 21:30 ~ 23:30"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                상세 업무 메모
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
                placeholder="배차 사유 메모"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="px-3 py-1.5 rounded-lg bg-[#0B0D10] text-[#9BA3B0] text-xs border border-white/10"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold"
            >
              배차 신청 등록
            </button>
          </div>
        </form>
      )}

      {/* Reservation Cards List */}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {filteredReservations.map((res) => {
          const defaultZone =
            returnZoneMap[res.id] ||
            `Northpark Lot A #${res.fleetNumber.toString().padStart(2, '0')}`;
          const isKeyChecked = keyBoxCheckMap[res.id] ?? true;

          return (
            <div
              key={res.id}
              className={`p-3.5 rounded-xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                res.stage === 'REQUESTED'
                  ? 'bg-[#F79009]/10 border-[#F79009]/40'
                  : res.stage === 'APPROVED'
                    ? 'bg-[#3E6AE1]/10 border-[#3E6AE1]/40'
                    : res.stage === 'IN_USE'
                      ? 'bg-[#191E2A] border-[#3E6AE1]'
                      : res.stage === 'RETURNED'
                        ? 'bg-[#191E2A]/70 border-white/10'
                        : 'bg-[#E82127]/10 border-[#E82127]/30 opacity-75'
              }`}
            >
              {/* Left Info */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Stage Pill */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                      res.stage === 'REQUESTED'
                        ? 'bg-[#F79009]/25 text-[#FDB022] border border-[#F79009]/50'
                        : res.stage === 'APPROVED'
                          ? 'bg-[#3E6AE1]/25 text-[#9BC1FF] border border-[#3E6AE1]/50'
                          : res.stage === 'IN_USE'
                            ? 'bg-[#3E6AE1] text-white'
                            : res.stage === 'RETURNED'
                              ? 'bg-[#12B76A]/20 text-[#32D583] border border-[#12B76A]/40'
                              : 'bg-[#E82127]/25 text-[#FF8080]'
                    }`}
                  >
                    {res.stage === 'REQUESTED'
                      ? '1단계 · 승인 대기 (REQUESTED)'
                      : res.stage === 'APPROVED'
                        ? '2단계 · 승인 완료 / 키수령 대기 (APPROVED)'
                        : res.stage === 'IN_USE'
                          ? '3단계 · 차량 사용중 / 운행중 (IN_USE)'
                          : res.stage === 'RETURNED'
                            ? '4단계 · 차량·키 반납 완료 (RETURNED)'
                            : '반려됨 (REJECTED)'}
                  </span>

                  <span className="text-xs font-mono font-semibold text-[#F4F6F8]">
                    #{res.fleetNumber}호차 · {res.plateNumber}
                  </span>
                  <span className="text-xs text-[#9BA3B0]">({res.modelName})</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-[#F4F6F8]">
                    {res.purpose}
                  </span>
                </div>

                <div className="text-xs text-[#F4F6F8] font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>신청자: {res.employeeName}</span>
                  <span className="text-[#9BA3B0]">부서: {res.department}</span>
                  <span className="text-[#9BC1FF] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    행선지: {res.destination}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-[#9BA3B0] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    예정 시간: {res.plannedTimeWindow}
                  </span>
                  <span>신청시각: {res.requestedAt}</span>
                  {res.approvedAt && (
                    <span className="text-[#32D583]">
                      승인: {res.approvedAt} ({res.approvedBy})
                    </span>
                  )}
                  {res.startedAt && <span className="text-[#9BC1FF]">출발: {res.startedAt}</span>}
                  {res.returnedAt && (
                    <span className="text-[#32D583]">
                      반납: {res.returnedAt} · 주차: {res.returnParkingZone} · 키반납:{' '}
                      {res.keyReturnedToBox ? '완료' : '미확인'}
                    </span>
                  )}
                </div>

                {res.notes && (
                  <p className="text-[11px] text-[#9BA3B0] italic">💬 {res.notes}</p>
                )}
              </div>

              {/* Right Stage Action Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {res.stage === 'REQUESTED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onApproveRequest(res.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#12B76A] hover:bg-[#0E9F5A] text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      승인 (Approve)
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectRequest(res.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#E82127]/20 hover:bg-[#E82127]/35 border border-[#E82127]/50 text-[#FF8080] text-xs font-medium flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      반려
                    </button>
                  </>
                )}

                {res.stage === 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => onStartUsingVehicle(res.id)}
                    className="px-3.5 py-2 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-[#3E6AE1]/25"
                  >
                    <Play className="w-3.5 h-3.5" />
                    키 수령 및 차량 사용 시작 (운행 개시)
                  </button>
                )}

                {res.stage === 'IN_USE' && (
                  <div className="flex flex-wrap items-center gap-2 bg-[#0B0D10] p-2 rounded-xl border border-white/10">
                    <select
                      value={defaultZone}
                      onChange={(e) =>
                        setReturnZoneMap((prev) => ({ ...prev, [res.id]: e.target.value }))
                      }
                      className="rounded-lg bg-[#191E2A] border border-white/10 px-2 py-1 text-[11px] text-[#F4F6F8]"
                    >
                      <option
                        value={`Northpark Lot A #${res.fleetNumber.toString().padStart(2, '0')}`}
                      >
                        Northpark Lot A #{res.fleetNumber.toString().padStart(2, '0')}
                      </option>
                      <option
                        value={`Northpark Lot B #${res.fleetNumber.toString().padStart(2, '0')}`}
                      >
                        Northpark Lot B #{res.fleetNumber.toString().padStart(2, '0')}
                      </option>
                      <option
                        value={`Northpark Lot C #${res.fleetNumber.toString().padStart(2, '0')}`}
                      >
                        Northpark Lot C #{res.fleetNumber.toString().padStart(2, '0')}
                      </option>
                    </select>

                    <label className="flex items-center gap-1 text-[11px] text-[#9BA3B0] cursor-pointer px-1">
                      <input
                        type="checkbox"
                        checked={isKeyChecked}
                        onChange={(e) =>
                          setKeyBoxCheckMap((prev) => ({
                            ...prev,
                            [res.id]: e.target.checked,
                          }))
                        }
                        className="rounded bg-[#191E2A] border-white/20"
                      />
                      <KeyRound className="w-3 h-3 text-[#12B76A]" />
                      <span>키보관함 반납</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => onReturnVehicle(res.id, defaultZone, isKeyChecked)}
                      className="px-3 py-1.5 rounded-lg bg-[#12B76A] hover:bg-[#0E9F5A] text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      차량·키 반납 완료
                    </button>
                  </div>
                )}

                {res.stage === 'RETURNED' && (
                  <div className="px-3 py-1.5 rounded-lg bg-[#12B76A]/15 border border-[#12B76A]/30 text-[#32D583] text-xs font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    반납 및 세무일지 기록 완료 (
                    {res.endOdometerKm
                      ? `${(res.endOdometerKm - res.startOdometerKm).toFixed(1)}km`
                      : '완료'}
                    )
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
