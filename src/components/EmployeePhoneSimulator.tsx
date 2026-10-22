'use client';

import React, { useRef, useState } from 'react';
import {
  AlertOctagon,
  Bluetooth,
  BluetoothOff,
  Car,
  CheckCircle2,
  Clock,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Smartphone,
  Zap,
} from 'lucide-react';
import { Employee, TripPurpose, Vehicle, VehicleReservation } from '@/types/fleet';
import {
  RealDeviceTelemetrySnapshot,
  scanRealVehicleBluetooth,
  startRealDeviceSensors,
} from '@/utils/realDeviceSensors';

interface EmployeePhoneSimulatorProps {
  vehicles: Vehicle[];
  employees: Employee[];
  reservations: VehicleReservation[];
  onCreateRequest: (payload: {
    employeeId: string;
    vehicleId: string;
    purpose: TripPurpose;
    destination: string;
    plannedTimeWindow: string;
    notes: string;
  }) => void;
  onApproveRequest: (reservationId: string) => void;
  onStartUsingVehicle: (reservationId: string) => void;
  onReturnVehicle: (
    reservationId: string,
    parkingZone: string,
    keyReturnedToBox: boolean
  ) => void;
  onAuthorizedCheckout: (employeeId: string, vehicleId: string, purpose: TripPurpose) => void;
  onUnauthorizedKeyTheft: (
    employeeId: string,
    vehicleId: string,
    coPassengerId: string | null
  ) => void;
  onLateReasonSubmit: (vehicleId: string, purpose: TripPurpose) => void;
  onSimulateCrashOrDrop: (vehicleId: string, isRealCrash: boolean) => void;
  onTogglePermissionEvasion: (employeeId: string) => void;
  onAutoReturnToGarage: (vehicleId: string) => void;
}

export const EmployeePhoneSimulator: React.FC<EmployeePhoneSimulatorProps> = ({
  vehicles,
  employees,
  reservations,
  onCreateRequest,
  onApproveRequest,
  onStartUsingVehicle,
  onReturnVehicle,
  onAuthorizedCheckout,
  onUnauthorizedKeyTheft,
  onLateReasonSubmit,
  onSimulateCrashOrDrop,
  onTogglePermissionEvasion,
  onAutoReturnToGarage,
}) => {
  const [phoneTab, setPhoneTab] = useState<'WORKFLOW' | 'SENSOR_TEST'>('WORKFLOW');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('emp-06');
  const [selectedVehId, setSelectedVehId] = useState<string>('veh-2');
  const [selectedPurpose, setSelectedPurpose] = useState<TripPurpose>('거래처방문');
  const [destination, setDestination] = useState<string>('HMMA Montgomery Plant');
  const [plannedWindow, setPlannedWindow] = useState<string>('21:00 ~ 23:00');
  const [returnLot, setReturnLot] = useState<string>('Northpark Lot A');
  const [coPassengerId, setCoPassengerId] = useState<string>('emp-01');
  const [includeCoPassenger, setIncludeCoPassenger] = useState<boolean>(true);
  const [simFeedback, setSimFeedback] = useState<string>('대기 중');
  const [realSensorActive, setRealSensorActive] = useState<boolean>(false);
  const [liveSnapshot, setLiveSnapshot] =
    useState<RealDeviceTelemetrySnapshot | null>(null);
  const stopSensorRef = useRef<(() => void) | null>(null);

  const handleToggleRealSensors = async () => {
    if (realSensorActive) {
      stopSensorRef.current?.();
      stopSensorRef.current = null;
      setRealSensorActive(false);
      setSimFeedback('센서 연결 중지됨');
      return;
    }

    const cleanup = await startRealDeviceSensors((snap) => {
      setLiveSnapshot(snap);
      if (snap.gForce > 2.5) {
        fetch('/api/fleet/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleId: selectedVehId,
            employeeId: selectedEmpId,
            lat: snap.lat ?? 32.6912,
            lng: snap.lng ?? -85.3298,
            speedKmh: snap.speedKmh,
            gForce: snap.gForce,
            gyroYawDegPerSec: snap.gyroYawDegPerSec,
            deltaSpeedKmh: -30,
            persistToDb: true,
          }),
        }).catch(() => {});
      }
    });

    stopSensorRef.current = cleanup;
    setRealSensorActive(true);
    setSimFeedback('GPS · 6축 센서 연결됨');
  };

  const handleBluetoothPairing = async () => {
    const deviceName = await scanRealVehicleBluetooth();
    if (deviceName) {
      setSimFeedback(`블루투스 연결됨: ${deviceName}`);
    } else {
      setSimFeedback('블루투스 스캔 취소');
    }
  };

  const currentEmp = employees.find((e) => e.id === selectedEmpId) || employees[0];
  const currentVeh = vehicles.find((v) => v.id === selectedVehId) || vehicles[0];
  const isDrivingThisCar = currentVeh.status !== 'IDLE';
  const myReservations = reservations.filter((r) => r.employeeId === selectedEmpId);

  return (
    <div
      className="rounded-xl bg-[#0A0A0A] p-4 flex flex-col justify-between"
      style={{
        boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px',
      }}
    >
      <div className="space-y-3">
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0A72EF]" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">임직원 모바일 앱</h3>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              isDrivingThisCar
                ? 'bg-[#0A72EF]/15 text-[#60A5FA]'
                : 'bg-[#10B981]/15 text-[#34D399]'
            }`}
          >
            {isDrivingThisCar ? `${currentVeh.plateNumber} 운행중` : 'GPS 미수집 (보호중)'}
          </span>
        </div>

        {/* 1-Click QR Boarding & Sensor Bar */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose);
              setSimFeedback(`#${currentVeh.fleetNumber}호차 QR 탑승 · 운행 시작`);
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#FAFAFA] hover:bg-[#E4E4E7] text-[#0A0A0A] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <QrCode className="w-3.5 h-3.5" />
            ⚡ 차키 QR 1초 출발 (#{currentVeh.fleetNumber}호차)
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleToggleRealSensors}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition ${
                realSensorActive
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#111111] hover:bg-white/[0.06] text-[#A1A1AA]'
              }`}
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <Radio className={`w-3 h-3 ${realSensorActive ? 'animate-ping' : ''}`} />
              {realSensorActive ? '센서 ON' : '휴대폰 센서 연결'}
            </button>
            <button
              type="button"
              onClick={handleBluetoothPairing}
              className="py-1.5 px-2.5 rounded-lg bg-[#111111] hover:bg-white/[0.06] text-[11px] text-[#A1A1AA] flex items-center justify-center gap-1 transition"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <Bluetooth className="w-3 h-3 text-[#0A72EF]" />
              블루투스 연결
            </button>
          </div>

          {realSensorActive && liveSnapshot && (
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
              <div className="p-1 rounded bg-[#111111] text-[#34D399]">
                {liveSnapshot.speedKmh} km/h
              </div>
              <div className="p-1 rounded bg-[#111111] text-[#FBBF24]">
                {liveSnapshot.gForce} G
              </div>
              <div className="p-1 rounded bg-[#111111] text-[#60A5FA]">
                {liveSnapshot.gyroYawDegPerSec}°/s
              </div>
            </div>
          )}
        </div>

        {/* Employee & Vehicle Selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-mono text-[#71717A] block mb-1">운전자</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full rounded-lg bg-[#111111] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:outline-none"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name.split(' (')[0]} ({emp.department.split(' (')[0]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#71717A] block mb-1">차량</label>
            <select
              value={selectedVehId}
              onChange={(e) => setSelectedVehId(e.target.value)}
              className="w-full rounded-lg bg-[#111111] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:outline-none"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              {vehicles.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  #{veh.fleetNumber}호차 · {veh.plateNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode Switch Tabs */}
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#111111]"
          style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
        >
          <button
            type="button"
            onClick={() => setPhoneTab('WORKFLOW')}
            className={`py-1.5 rounded-md text-xs font-medium transition ${
              phoneTab === 'WORKFLOW'
                ? 'bg-[#27272A] text-[#FAFAFA]'
                : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            신청 · 반납
          </button>
          <button
            type="button"
            onClick={() => setPhoneTab('SENSOR_TEST')}
            className={`py-1.5 rounded-md text-xs font-medium transition ${
              phoneTab === 'SENSOR_TEST'
                ? 'bg-[#27272A] text-[#FAFAFA]'
                : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            센서 · 무단 테스트
          </button>
        </div>

        {/* TAB 1: WORKFLOW */}
        {phoneTab === 'WORKFLOW' && (
          <div className="space-y-2.5">
            {/* Step 1: Request */}
            <div
              className="p-3 rounded-lg bg-[#111111] space-y-2"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-[11px] font-mono text-[#A1A1AA] block">1. 배차 신청</span>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as TripPurpose)}
                  className="rounded-md bg-[#0A0A0A] px-2 py-1.5 text-xs text-[#FAFAFA]"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                >
                  <option value="거래처방문">거래처방문</option>
                  <option value="일반업무/외근">일반업무/외근</option>
                  <option value="긴급출동/현장지원">긴급출동/현장지원</option>
                  <option value="출퇴근(승인)">출퇴근(승인)</option>
                </select>
                <input
                  type="text"
                  value={plannedWindow}
                  onChange={(e) => setPlannedWindow(e.target.value)}
                  className="rounded-md bg-[#0A0A0A] px-2 py-1.5 text-xs text-[#FAFAFA]"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                  placeholder="시간"
                />
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="flex-1 rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-xs text-[#FAFAFA]"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                  placeholder="행선지"
                />
                <button
                  type="button"
                  onClick={() => {
                    onCreateRequest({
                      employeeId: selectedEmpId,
                      vehicleId: selectedVehId,
                      purpose: selectedPurpose,
                      destination,
                      plannedTimeWindow: plannedWindow,
                      notes: '모바일 신청',
                    });
                    setSimFeedback(`#${currentVeh.fleetNumber}호차 배차 신청 완료`);
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-medium shrink-0 transition"
                >
                  신청
                </button>
              </div>
            </div>

            {/* Step 2~4: Active Reservations & Return */}
            <div
              className="p-3 rounded-lg bg-[#111111] space-y-2"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#A1A1AA]">
                  2. 내 배차 · 출발 · 반납
                </span>
                <span className="text-[10px] font-mono text-[#71717A]">
                  {myReservations.length}건
                </span>
              </div>

              {myReservations.length > 0 && (
                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                  {myReservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-2 rounded-md bg-[#0A0A0A] space-y-1.5 text-xs"
                      style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-[#FAFAFA]">
                          #{res.fleetNumber}호차 · {res.plateNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-[#A1A1AA]">
                          {res.stage === 'REQUESTED'
                            ? '승인대기'
                            : res.stage === 'APPROVED'
                              ? '승인완료'
                              : res.stage === 'IN_USE'
                                ? '운행중'
                                : '반납완료'}
                        </span>
                      </div>

                      {res.stage === 'REQUESTED' && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-[#FBBF24] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 승인대기
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onApproveRequest(res.id);
                              setSimFeedback(`#${res.fleetNumber}호차 승인 완료`);
                            }}
                            className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#34D399] text-[11px]"
                          >
                            즉시 승인
                          </button>
                        </div>
                      )}

                      {res.stage === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            onStartUsingVehicle(res.id);
                            setSimFeedback(`#${res.fleetNumber}호차 운행 시작`);
                          }}
                          className="w-full py-1.5 rounded bg-[#0A72EF] text-white text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          운행 시작
                        </button>
                      )}

                      {res.stage === 'IN_USE' && (
                        <div className="flex gap-1.5 pt-1">
                          <select
                            value={returnLot}
                            onChange={(e) => setReturnLot(e.target.value)}
                            className="rounded bg-[#111111] px-2 py-1 text-[11px] text-[#FAFAFA]"
                          >
                            <option value="Northpark Lot A">Lot A</option>
                            <option value="Northpark Lot B">Lot B</option>
                            <option value="Northpark Lot C">Lot C</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const fullZone = `${returnLot} #${res.fleetNumber
                                .toString()
                                .padStart(2, '0')}`;
                              onReturnVehicle(res.id, fullZone, true);
                              setSimFeedback(`#${res.fleetNumber}호차 반납 완료`);
                            }}
                            className="flex-1 py-1 rounded bg-[#10B981] text-white text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            반납 완료
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Direct 1-Click Garage Return */}
              <button
                type="button"
                onClick={() => {
                  onAutoReturnToGarage(selectedVehId);
                  setSimFeedback(`#${currentVeh.fleetNumber}호차 차고지 자동반납 완료`);
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Car className="w-3.5 h-3.5" />
                차고지 복귀 자동반납 (#{currentVeh.fleetNumber}호차)
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SENSOR TEST */}
        {phoneTab === 'SENSOR_TEST' && (
          <div className="space-y-2">
            <div
              className="p-2.5 rounded-lg bg-[#111111] flex items-center justify-between gap-2"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-xs text-[#FAFAFA] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0A72EF]" />
                자율 반출 출발
              </span>
              <button
                type="button"
                onClick={() => {
                  onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose);
                  setSimFeedback(`#${currentVeh.fleetNumber}호차 자율 반출 완료`);
                }}
                className="px-2.5 py-1 rounded bg-[#0A72EF] text-white text-xs"
              >
                원터치 출발
              </button>
            </div>

            <div
              className="p-2.5 rounded-lg bg-[#FF5B4F]/10 space-y-2"
              style={{ boxShadow: 'rgba(255, 91, 79, 0.25) 0px 0px 0px 1px' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#FF5B4F] font-medium">미승인 무단 시동·출발</span>
                <label className="flex items-center gap-1 text-[11px] text-[#A1A1AA]">
                  <input
                    type="checkbox"
                    checked={includeCoPassenger}
                    onChange={(e) => setIncludeCoPassenger(e.target.checked)}
                  />
                  동승자 포함
                </label>
              </div>
              {includeCoPassenger && (
                <select
                  value={coPassengerId}
                  onChange={(e) => setCoPassengerId(e.target.value)}
                  className="w-full rounded bg-[#0A0A0A] px-2 py-1 text-[11px] text-[#FAFAFA]"
                >
                  {employees
                    .filter((e) => e.id !== selectedEmpId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        동승: {emp.name.split(' (')[0]}
                      </option>
                    ))}
                </select>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onUnauthorizedKeyTheft(
                      selectedEmpId,
                      selectedVehId,
                      includeCoPassenger ? coPassengerId : null
                    );
                    setSimFeedback(`#${currentVeh.fleetNumber}호차 무단운행 감지 (Red Alert)`);
                  }}
                  className="flex-1 py-1.5 rounded bg-[#FF5B4F] text-white text-xs font-medium flex items-center justify-center gap-1"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  무단 출발
                </button>
                {currentVeh.status === 'UNAUTHORIZED' && (
                  <button
                    type="button"
                    onClick={() => {
                      onLateReasonSubmit(selectedVehId, selectedPurpose);
                      setSimFeedback('사후 사유 입력됨');
                    }}
                    className="px-2.5 py-1.5 rounded bg-[#111111] text-[#FAFAFA] text-[11px]"
                  >
                    사후 사유
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onSimulateCrashOrDrop(selectedVehId, true);
                  setSimFeedback('3.24G 충돌 감지됨');
                }}
                className="py-2 px-2 rounded-lg bg-[#111111] text-[#FBBF24] text-xs font-medium flex items-center justify-center gap-1"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
              >
                <Zap className="w-3.5 h-3.5" />
                3.2G 충돌
              </button>
              <button
                type="button"
                onClick={() => {
                  onSimulateCrashOrDrop(selectedVehId, false);
                  setSimFeedback('단순 낙하 제외됨');
                }}
                className="py-2 px-2 rounded-lg bg-[#111111] text-[#A1A1AA] text-xs font-medium"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
              >
                휴대폰 낙하
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onTogglePermissionEvasion(selectedEmpId);
                setSimFeedback('블루투스 권한 토글됨');
              }}
              className="w-full py-1.5 rounded-lg bg-[#111111] text-xs text-[#A1A1AA] flex items-center justify-center gap-1.5"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <BluetoothOff className="w-3.5 h-3.5 text-[#FBBF24]" />
              블루투스 권한 ON/OFF
            </button>
          </div>
        )}
      </div>

      {/* Compact 1-Line Status Footer */}
      <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
        <span>상태</span>
        <span className="text-[#A1A1AA] truncate max-w-[230px]">{simFeedback}</span>
      </div>
    </div>
  );
};
