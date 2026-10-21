'use client';

import React, { useRef, useState } from 'react';
import {
  AlertOctagon,
  Bluetooth,
  BluetoothOff,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  KeyRound,
  Lock,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
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
  const [destination, setDestination] = useState<string>(
    'HMMA Montgomery Plant (I-85 S)'
  );
  const [plannedWindow, setPlannedWindow] = useState<string>('21:00 ~ 23:00');
  const [returnLot, setReturnLot] = useState<string>('Northpark Lot A');
  const [coPassengerId, setCoPassengerId] = useState<string>('emp-01');
  const [includeCoPassenger, setIncludeCoPassenger] = useState<boolean>(true);
  const [simFeedback, setSimFeedback] = useState<string>(
    '직원 스마트폰에서 [차량 신청 → 승인 확인 → 사용 시작 → 반납] 전 과정을 바로 실행할 수 있습니다.'
  );
  const [realSensorActive, setRealSensorActive] = useState<boolean>(false);
  const [liveSnapshot, setLiveSnapshot] =
    useState<RealDeviceTelemetrySnapshot | null>(null);
  const stopSensorRef = useRef<(() => void) | null>(null);

  const handleToggleRealSensors = async () => {
    if (realSensorActive) {
      stopSensorRef.current?.();
      stopSensorRef.current = null;
      setRealSensorActive(false);
      setSimFeedback('🛑 실제 스마트폰 센서(GPS · 6축 IMU) 스트리밍을 중지했습니다.');
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
    setSimFeedback(
      '📡 실제 스마트폰 GPS 및 6축 IMU(가속도·자이로) 센서 연동이 시작되었습니다!'
    );
  };

  const handleBluetoothPairing = async () => {
    const deviceName = await scanRealVehicleBluetooth();
    if (deviceName) {
      setSimFeedback(`🔵 실제 차량 블루투스 기기 [${deviceName}] 페어링이 확인되었습니다.`);
    } else {
      setSimFeedback(
        'ℹ️ 브라우저 블루투스 스캔이 취소되었거나 모바일 Chrome/Edge 환경이 아닙니다.'
      );
    }
  };

  const currentEmp = employees.find((e) => e.id === selectedEmpId) || employees[0];
  const currentVeh = vehicles.find((v) => v.id === selectedVehId) || vehicles[0];
  const isDrivingThisCar = currentVeh.status !== 'IDLE';

  // Active reservations for the selected employee
  const myReservations = reservations.filter((r) => r.employeeId === selectedEmpId);

  return (
    <div
      className="rounded-2xl bg-[#131720] p-4 border border-white/10 flex flex-col justify-between"
      style={{
        boxShadow:
          'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.5) 0px 16px 32px -12px',
      }}
    >
      <div>
        {/* Top Phone Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#3E6AE1]/20 border border-[#3E6AE1]/40 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-[#3E6AE1]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F4F6F8]">
                임직원 모바일 앱 (Opelika AL BYOD)
              </h3>
              <p className="text-[11px] text-[#9BA3B0]">
                차량 신청·승인·사용·반납 및 백그라운드 센서 연동
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#191E2A] text-[#9BA3B0] border border-white/10">
            MOBILE APP
          </span>
        </div>

        {/* Real Smartphone Sensor Bridge & 1-Click Zero-Config QR Boarding Bar */}
        <div className="mt-2.5 p-2.5 rounded-xl bg-[#0B0D10] border border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => {
              onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose);
              setSimFeedback(
                `📷 [무설정 QR 스캔 탑승 완료] 블루투스 수동 페어링 없이 #${currentVeh.fleetNumber}호차(${currentVeh.plateNumber}) 키고리 QR을 스캔하여 배차 승인 + 센서 연동 + 운행 시작이 1초 만에 완료되었습니다!`
              );
            }}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-[#3E6AE1] to-[#12B76A] hover:opacity-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition"
          >
            <QrCode className="w-3.5 h-3.5" />
            ⚡ 무설정 1초 탑승: 자동차키 QR 스캔으로 바로 출발
          </button>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleToggleRealSensors}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
                realSensorActive
                  ? 'bg-[#12B76A] text-white'
                  : 'bg-[#191E2A] hover:bg-white/10 text-[#9BC1FF] border border-[#3E6AE1]/40'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${realSensorActive ? 'animate-ping' : ''}`} />
              {realSensorActive
                ? '실제 휴대폰 센서 연동중 (클릭시 중지)'
                : '실제 휴대폰 센서(GPS·6축 IMU) 연결'}
            </button>
            <button
              type="button"
              onClick={handleBluetoothPairing}
              className="py-1.5 px-2.5 rounded-lg bg-[#191E2A] hover:bg-white/10 border border-white/10 text-[11px] text-[#F4F6F8] flex items-center gap-1 transition"
            >
              <Bluetooth className="w-3.5 h-3.5 text-[#3E6AE1]" />
              블루투스 연결
            </button>
          </div>
          {realSensorActive && liveSnapshot && (
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] font-mono text-center">
              <div className="p-1 rounded bg-[#131720] text-[#32D583]">
                속도: {liveSnapshot.speedKmh} km/h
              </div>
              <div className="p-1 rounded bg-[#131720] text-[#FDB022]">
                충격: {liveSnapshot.gForce} G
              </div>
              <div className="p-1 rounded bg-[#131720] text-[#9BC1FF]">
                회전: {liveSnapshot.gyroYawDegPerSec}°/s
              </div>
            </div>
          )}
        </div>

        {/* Mode Switch Tabs inside Employee Phone */}
        <div className="grid grid-cols-2 gap-1.5 mt-3 p-1 rounded-xl bg-[#0B0D10] border border-white/10">
          <button
            type="button"
            onClick={() => setPhoneTab('WORKFLOW')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition ${
              phoneTab === 'WORKFLOW'
                ? 'bg-[#3E6AE1] text-white shadow'
                : 'text-[#9BA3B0] hover:text-white'
            }`}
          >
            📋 신청 · 승인 · 사용 · 반납
          </button>
          <button
            type="button"
            onClick={() => setPhoneTab('SENSOR_TEST')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition ${
              phoneTab === 'SENSOR_TEST'
                ? 'bg-[#E82127] text-white shadow'
                : 'text-[#9BA3B0] hover:text-white'
            }`}
          >
            🚨 무단반출 · 사고센서 테스트
          </button>
        </div>

        {/* Privacy Status Indicator Banner */}
        <div
          className={`mt-2.5 p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            isDrivingThisCar
              ? 'bg-[#3E6AE1]/15 border-[#3E6AE1]/40 text-[#DBE6FF]'
              : 'bg-[#12B76A]/10 border-[#12B76A]/30 text-[#A6F4C5]'
          }`}
        >
          {isDrivingThisCar ? (
            <Bluetooth className="w-4 h-4 text-[#3E6AE1] shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <Lock className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed">
            <div className="font-semibold">
              {isDrivingThisCar
                ? `📡 ${currentVeh.plateNumber} 블루투스 매칭됨 — 주행 텔레메트리 작동중`
                : '🔒 개인 프라이버시 보호 중 (현재 GPS 위치 미수집 · 패킷 0건)'}
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">
              {isDrivingThisCar
                ? `MAC ${currentVeh.btMacAddress} 연결로 주행거리 및 충격 자동 기록 중`
                : '법인차량 블루투스 감지 시에만 작동하며 퇴근 후 개인 이동은 수집하지 않습니다.'}
            </p>
          </div>
        </div>

        {/* Selectors: Employee & Target Vehicle */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div>
            <label className="text-[11px] font-mono text-[#9BA3B0] block mb-1">
              로그인 직원 (스마트폰 사용자)
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full rounded-lg bg-[#191E2A] border border-white/10 px-2.5 py-2 text-xs text-[#F4F6F8] focus:outline-none focus:border-[#3E6AE1]"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name.split(' (')[0]} ({emp.department.split(' (')[0]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-[#9BA3B0] block mb-1">
              대상 법인차량 (AL 41 플릿)
            </label>
            <select
              value={selectedVehId}
              onChange={(e) => setSelectedVehId(e.target.value)}
              className="w-full rounded-lg bg-[#191E2A] border border-white/10 px-2.5 py-2 text-xs text-[#F4F6F8] focus:outline-none focus:border-[#3E6AE1]"
            >
              {vehicles.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  #{veh.fleetNumber}호차 · {veh.plateNumber} ({veh.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB A: Official 4-Stage Lifecycle (Request -> Approve -> Use -> Return) */}
        {phoneTab === 'WORKFLOW' && (
          <div className="mt-3 space-y-3">
            {/* Step 1: Submit New Dispatch Request */}
            <div className="p-3 rounded-xl bg-[#191E2A] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#3E6AE1]" />
                  1단계: 차량 배차 신청하기
                </span>
                <span className="text-[10px] font-mono text-[#9BA3B0]">4400 Northpark Dr</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as TripPurpose)}
                  className="rounded-lg bg-[#0B0D10] border border-white/10 px-2 py-1.5 text-xs text-[#F4F6F8]"
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
                  className="rounded-lg bg-[#0B0D10] border border-white/10 px-2 py-1.5 text-xs text-[#F4F6F8]"
                  placeholder="시간 (예: 21:00~23:00)"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="flex-1 rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-1.5 text-xs text-[#F4F6F8]"
                  placeholder="행선지 입력 (예: HMMA Montgomery)"
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
                      notes: '모바일 앱에서 배차 신청',
                    });
                    setSimFeedback(
                      `📋 [1단계 신청 완료] ${currentEmp.name.split(' (')[0]}님이 #${currentVeh.fleetNumber}호차(${currentVeh.plateNumber}) 배차를 신청했습니다.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold shrink-0 transition"
                >
                  배차 신청
                </button>
              </div>
            </div>

            {/* Step 2, 3, 4: My Active Reservations Lifecycle Control */}
            <div className="p-3 rounded-xl bg-[#191E2A] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-[#12B76A]" />
                  2·3·4단계: 내 배차 승인 · 사용 시작 · 반납 처리
                </span>
                <span className="text-[10px] font-mono text-[#9BA3B0]">
                  {myReservations.length}건
                </span>
              </div>

              {myReservations.length === 0 ? (
                <p className="text-xs text-[#9BA3B0] py-2">
                  현재 선택된 직원의 배차 내역이 없습니다. 위 [배차 신청] 버튼을 눌러 신청하세요.
                </p>
              ) : (
                <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                  {myReservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-2.5 rounded-lg bg-[#0B0D10] border border-white/10 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#F4F6F8]">
                          #{res.fleetNumber}호차 · {res.plateNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            res.stage === 'REQUESTED'
                              ? 'bg-[#F79009]/25 text-[#FDB022]'
                              : res.stage === 'APPROVED'
                                ? 'bg-[#3E6AE1]/25 text-[#9BC1FF]'
                                : res.stage === 'IN_USE'
                                  ? 'bg-[#3E6AE1] text-white'
                                  : res.stage === 'RETURNED'
                                    ? 'bg-[#12B76A]/20 text-[#32D583]'
                                    : 'bg-[#E82127]/20 text-[#FF8080]'
                          }`}
                        >
                          {res.stage === 'REQUESTED'
                            ? '1. 승인대기'
                            : res.stage === 'APPROVED'
                              ? '2. 승인완료'
                              : res.stage === 'IN_USE'
                                ? '3. 사용중(운행중)'
                                : res.stage === 'RETURNED'
                                  ? '4. 반납완료'
                                  : '반려됨'}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#9BA3B0] truncate">
                        행선지: {res.destination} ({res.purpose})
                      </div>

                      {/* Stage-specific action inside the employee's phone */}
                      {res.stage === 'REQUESTED' && (
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-[11px] text-[#FDB022] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 관리자 승인 대기 중...
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onApproveRequest(res.id);
                              setSimFeedback(
                                `✅ [2단계 승인 완료] #${res.fleetNumber}호차(${res.plateNumber}) 배차가 승인되었습니다. 이제 [키 수령 & 사용 시작]을 누르세요.`
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-[#12B76A]/20 hover:bg-[#12B76A]/35 text-[#32D583] border border-[#12B76A]/40 text-[11px] font-medium"
                          >
                            즉시 승인 처리(관리자)
                          </button>
                        </div>
                      )}

                      {res.stage === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            onStartUsingVehicle(res.id);
                            setSimFeedback(
                              `🚗 [3단계 사용 시작] ${res.employeeName.split(' (')[0]}님이 4400 Northpark Dr 키보관함에서 키를 수령해 #${res.fleetNumber}호차 운행을 시작했습니다.`
                            );
                          }}
                          className="w-full py-1.5 px-3 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          3단계: 키 수령 & 차량 사용 시작 (운행 개시)
                        </button>
                      )}

                      {res.stage === 'IN_USE' && (
                        <div className="flex gap-1.5 pt-1 border-t border-white/5">
                          <select
                            value={returnLot}
                            onChange={(e) => setReturnLot(e.target.value)}
                            className="rounded bg-[#191E2A] border border-white/10 px-2 py-1 text-[11px] text-[#F4F6F8]"
                          >
                            <option value="Northpark Lot A">Northpark Lot A</option>
                            <option value="Northpark Lot B">Northpark Lot B</option>
                            <option value="Northpark Lot C">Northpark Lot C</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const fullZone = `${returnLot} #${res.fleetNumber
                                .toString()
                                .padStart(2, '0')}`;
                              onReturnVehicle(res.id, fullZone, true);
                              setSimFeedback(
                                `🅿️ [4단계 반납 완료] #${res.fleetNumber}호차(${res.plateNumber})가 ${fullZone}에 주차 및 키보관함 반납 처리되고 세무 운행일지에 등록되었습니다.`
                              );
                            }}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#12B76A] hover:bg-[#0E9F5A] text-white text-xs font-semibold flex items-center justify-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            4단계: 차량·키 반납 완료
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB B: Unauthorized Key Theft & G-Sensor Test Scenarios */}
        {phoneTab === 'SENSOR_TEST' && (
          <div className="mt-3 space-y-2.5">
            {/* Scenario 1: 1-Touch Self-Checkout */}
            <div className="p-3 rounded-xl bg-[#191E2A] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3E6AE1]" />
                  관리자 부재 시 1초 원터치 자율 반출
                </span>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as TripPurpose)}
                  className="flex-1 rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-1.5 text-xs text-[#F4F6F8]"
                >
                  <option value="일반업무/외근">일반업무/외근</option>
                  <option value="거래처방문">거래처방문</option>
                  <option value="긴급출동/현장지원">긴급출동/현장지원</option>
                  <option value="출퇴근(승인)">출퇴근(승인)</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose);
                    setSimFeedback(
                      `✅ ${currentEmp.name.split(' (')[0]}님이 #${currentVeh.fleetNumber}호차(${currentVeh.plateNumber})를 원터치 정상 반출했습니다.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-medium transition"
                >
                  원터치 출발
                </button>
              </div>
            </div>

            {/* Scenario 2 & 3: Unreported Key Theft */}
            <div className="p-3 rounded-xl bg-[#E82127]/10 border border-[#E82127]/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#FF8080] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#E82127]" />
                  보고 없이 몰래 키 가지고 출발 (무단 운행)
                </span>
                <span className="text-[10px] font-mono text-[#FF8080]">Red Alert 발동</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#9BA3B0]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCoPassenger}
                    onChange={(e) => setIncludeCoPassenger(e.target.checked)}
                    className="rounded border-white/20 bg-[#0B0D10]"
                  />
                  <span>동승자 함께 탑승 (운전자 판별)</span>
                </label>
                {includeCoPassenger && (
                  <select
                    value={coPassengerId}
                    onChange={(e) => setCoPassengerId(e.target.value)}
                    className="rounded bg-[#0B0D10] border border-white/10 px-2 py-0.5 text-[11px] text-[#F4F6F8]"
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
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUnauthorizedKeyTheft(
                      selectedEmpId,
                      selectedVehId,
                      includeCoPassenger ? coPassengerId : null
                    );
                    setSimFeedback(
                      `🚨 [미승인 운행 포착] ${currentEmp.name.split(' (')[0]}님이 배차 신청·승인 없이 #${currentVeh.fleetNumber}호차(${currentVeh.plateNumber})를 몰고 나가 Red Alert가 발령되었습니다!`
                    );
                  }}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#E82127] hover:bg-[#C91B20] text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  보고 없이 시동·출발 (15km/h+)
                </button>

                {currentVeh.status === 'UNAUTHORIZED' && (
                  <button
                    type="button"
                    onClick={() => {
                      onLateReasonSubmit(selectedVehId, selectedPurpose);
                      setSimFeedback(
                        `📝 #${currentVeh.fleetNumber}호차 미승인 운행자가 사후 사유(${selectedPurpose})를 자진 입력했습니다.`
                      );
                    }}
                    className="px-2.5 py-2 rounded-lg bg-[#191E2A] hover:bg-white/10 text-[#F4F6F8] border border-white/15 text-[11px] font-medium"
                  >
                    사후 사유 입력
                  </button>
                )}
              </div>
            </div>

            {/* Scenario 4: No-Dashcam Smartphone 6-Axis IMU Crash vs Phone Drop */}
            <div className="p-3 rounded-xl bg-[#191E2A] border border-white/5 space-y-2">
              <span className="text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#F79009]" />
                무블랙박스 스마트폰 6축 센서 충격 vs 휴대폰 낙하
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSimulateCrashOrDrop(selectedVehId, true);
                    setSimFeedback(
                      `💥 [무블랙박스 사고 재구성] #${currentVeh.fleetNumber}호차(${currentVeh.plateNumber})에서 스마트폰 6축 센서 3.24G 충격 + 자이로 회전(38.4°/s) + 급정차가 기록되었습니다!`
                    );
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-[#F79009]/20 hover:bg-[#F79009]/30 border border-[#F79009]/50 text-[#FDB022] text-xs font-medium"
                >
                  💥 3.2G 충돌 + 급정차
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSimulateCrashOrDrop(selectedVehId, false);
                    setSimFeedback(
                      `🛡️ [오탐 필터] 휴대폰 낙하(3.4G)가 감지되었으나 속도 변화(Δv=0)가 없어 자동 제외했습니다.`
                    );
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-[#0B0D10] hover:bg-white/5 border border-white/10 text-[#9BA3B0] text-xs font-medium"
                >
                  📱 거치대 휴대폰 낙하
                </button>
              </div>
            </div>

            {/* Scenario 5 & 6 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onTogglePermissionEvasion(selectedEmpId);
                  setSimFeedback(
                    `🕵️ ${currentEmp.name.split(' (')[0]}님의 블루투스 권한 상태를 토글했습니다.`
                  );
                }}
                className="py-2 px-2.5 rounded-xl bg-[#191E2A] hover:bg-white/10 border border-white/10 text-xs text-[#F4F6F8] flex items-center justify-center gap-1.5"
              >
                <BluetoothOff className="w-3.5 h-3.5 text-[#F79009]" />
                블루투스 권한 끄기/켜기
              </button>

              <button
                type="button"
                onClick={() => {
                  onAutoReturnToGarage(selectedVehId);
                  setSimFeedback(
                    `🅿️ #${currentVeh.fleetNumber}호차(${currentVeh.plateNumber})가 4400 Northpark Dr 차고지 복귀 및 시동 OFF로 자동 반납되었습니다.`
                  );
                }}
                className="py-2 px-2.5 rounded-xl bg-[#12B76A]/20 hover:bg-[#12B76A]/30 border border-[#12B76A]/40 text-xs text-[#32D583] font-medium flex items-center justify-center gap-1.5"
              >
                <Car className="w-3.5 h-3.5" />
                차고지 복귀 자동반납
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Simulator Feedback Console */}
      <div className="mt-3 p-2.5 rounded-lg bg-[#0B0D10] border border-white/10 text-[11px] font-mono text-[#9BA3B0] flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#3E6AE1] shrink-0 mt-0.5" />
        <span>{simFeedback}</span>
      </div>
    </div>
  );
};
