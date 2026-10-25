'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { AppLang, formatDeptName, formatEmpName } from '@/utils/i18n';
import { DispatchResult } from '@/utils/dispatchRules';

// Result of opening the app from a vehicle key-tag QR (?unit=NN)
export interface QrScanResult {
  unit: number | null;
  vehicleId: string | null;
  scannedAt: number;
}

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
  }) => Promise<DispatchResult>;
  onApproveRequest: (reservationId: string) => Promise<DispatchResult>;
  onStartUsingVehicle: (reservationId: string) => Promise<DispatchResult>;
  onReturnVehicle: (
    reservationId: string,
    parkingZone: string,
    keyReturnedToBox: boolean
  ) => Promise<DispatchResult>;
  onAuthorizedCheckout: (employeeId: string, vehicleId: string, purpose: TripPurpose) => Promise<DispatchResult>;
  onUnauthorizedKeyTheft: (
    employeeId: string,
    vehicleId: string,
    coPassengerId: string | null
  ) => Promise<DispatchResult>;
  onLateReasonSubmit: (vehicleId: string, purpose: TripPurpose) => Promise<DispatchResult>;
  onSimulateCrashOrDrop: (vehicleId: string, isRealCrash: boolean) => Promise<DispatchResult>;
  onTogglePermissionEvasion: (employeeId: string) => Promise<DispatchResult>;
  onAutoReturnToGarage: (vehicleId: string) => Promise<DispatchResult>;
  qrScan?: QrScanResult | null;
  dataMode?: 'DEMO' | 'LIVE';
  lang?: AppLang;
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
  qrScan = null,
  dataMode = 'DEMO',
  lang = 'KOR',
}) => {
  const isEng = lang === 'ENG';
  const [phoneTab, setPhoneTab] = useState<'WORKFLOW' | 'SENSOR_TEST'>('WORKFLOW');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('emp-06');
  const [selectedVehId, setSelectedVehId] = useState<string>('veh-2');
  const [selectedPurpose, setSelectedPurpose] = useState<TripPurpose>('거래처방문');
  const [destination, setDestination] = useState<string>('HMMA Montgomery Plant');
  const [plannedWindow, setPlannedWindow] = useState<string>('21:00 ~ 23:00');
  const [returnLot, setReturnLot] = useState<string>('Northpark Lot A');
  const [coPassengerId, setCoPassengerId] = useState<string>('emp-01');
  const [includeCoPassenger, setIncludeCoPassenger] = useState<boolean>(true);
  const [simFeedback, setSimFeedback] = useState<string>('');
  const [realSensorActive, setRealSensorActive] = useState<boolean>(false);
  const [liveSnapshot, setLiveSnapshot] =
    useState<RealDeviceTelemetrySnapshot | null>(null);
  const stopSensorRef = useRef<(() => void) | null>(null);
  const [dispatchNotice, setDispatchNotice] = useState<DispatchResult | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  // Waits for the server and shows the real outcome; ignores clicks while a request is in flight
  const showDispatchResult = async (pending: Promise<DispatchResult>) => {
    setBusy(true);
    try {
      const result = await pending;
      setDispatchNotice(result);
      setSimFeedback(result.message);
    } finally {
      setBusy(false);
    }
  };

  // Defaults point at sample records; snap to real ones once the fleet/roster is replaced
  useEffect(() => {
    if (vehicles.length > 0 && !vehicles.some((v) => v.id === selectedVehId)) {
      setSelectedVehId(vehicles[0].id);
    }
  }, [vehicles, selectedVehId]);
  useEffect(() => {
    if (employees.length === 0) return;
    if (!employees.some((e) => e.id === selectedEmpId)) setSelectedEmpId(employees[0].id);
    if (!employees.some((e) => e.id === coPassengerId)) {
      setCoPassengerId((employees.find((e) => e.id !== selectedEmpId) ?? employees[0]).id);
    }
  }, [employees, selectedEmpId, coPassengerId]);

  // Key-tag QR scan: preselect the scanned vehicle (never starts a trip by itself)
  useEffect(() => {
    if (!qrScan) return;
    if (qrScan.vehicleId) {
      setSelectedVehId(qrScan.vehicleId);
      setPhoneTab('WORKFLOW');
    }
  }, [qrScan]);

  const handleToggleRealSensors = async () => {
    if (realSensorActive) {
      stopSensorRef.current?.();
      stopSensorRef.current = null;
      setRealSensorActive(false);
      setSimFeedback(isEng ? 'Sensors stopped' : '센서 연결 중지됨');
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
            plateNumber:
              vehicles.find((v) => v.id === selectedVehId)?.plateNumber ?? 'UNKNOWN',
            hasActiveApproval: reservations.some(
              (r) =>
                r.vehicleId === selectedVehId &&
                r.employeeId === selectedEmpId &&
                (r.stage === 'APPROVED' || r.stage === 'IN_USE')
            ),
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
    setSimFeedback(isEng ? 'GPS · 6-Axis IMU Connected' : 'GPS · 6축 센서 연결됨');
  };

  const handleBluetoothPairing = async () => {
    const deviceName = await scanRealVehicleBluetooth();
    if (deviceName) {
      setSimFeedback(isEng ? `BT Paired: ${deviceName}` : `블루투스 연결됨: ${deviceName}`);
    } else {
      setSimFeedback(isEng ? 'BT Scan Cancelled' : '블루투스 스캔 취소');
    }
  };

  const currentVeh = vehicles.find((v) => v.id === selectedVehId) || vehicles[0];
  const isDrivingThisCar = currentVeh.status !== 'IDLE';
  const myReservations = reservations.filter((r) => r.employeeId === selectedEmpId);
  const qrVeh = qrScan?.vehicleId ? vehicles.find((v) => v.id === qrScan.vehicleId) : undefined;

  return (
    <div
      aria-busy={busy}
      className={`rounded-xl bg-[#FAFAFA] p-4 flex flex-col justify-between ${busy ? 'pointer-events-none opacity-70' : ''}`}
      style={{
        boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px',
      }}
    >
      <div className="space-y-3">
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.08]">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0A72EF]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">
              {isEng ? 'Employee Mobile App' : '임직원 모바일 앱'}
            </h3>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              isDrivingThisCar
                ? 'bg-[#0A72EF]/15 text-[#1D4ED8]'
                : 'bg-[#10B981]/15 text-[#047857]'
            }`}
          >
            {isDrivingThisCar
              ? isEng
                ? `${currentVeh.plateNumber} Active`
                : `${currentVeh.plateNumber} 운행중`
              : isEng
                ? 'GPS Off (Privacy Safe)'
                : 'GPS 미수집 (보호중)'}
          </span>
        </div>

        {qrScan && (
          <div
            role="status"
            className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${
              qrVeh
                ? 'bg-[#10B981]/10 text-[#047857]'
                : 'bg-[#FF5B4F]/10 text-[#DC2626]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {qrVeh
                ? isEng
                  ? `Key QR recognized: Unit #${qrVeh.fleetNumber} (${qrVeh.plateNumber}) selected. Pick your name, then request or start.`
                  : `차키 QR 인식: #${qrVeh.fleetNumber}호차(${qrVeh.plateNumber})가 선택되었습니다. 운전자를 확인한 뒤 신청 또는 출발하세요.`
                : isEng
                  ? `Unrecognized key QR${qrScan.unit ? ` (Unit #${qrScan.unit})` : ''}. Select the vehicle manually or ask the fleet admin.`
                  : `등록되지 않은 차키 QR입니다${qrScan.unit ? ` (#${qrScan.unit}호차)` : ''}. 차량을 직접 선택하거나 관리자에게 문의하세요.`}
            </span>
          </div>
        )}

        {dispatchNotice && (
          <div
            role="alert"
            data-testid="dispatch-notice"
            className={`px-3 py-2 rounded-lg text-xs flex items-start justify-between gap-2 ${
              dispatchNotice.ok ? 'bg-[#10B981]/10 text-[#047857]' : 'bg-[#FF5B4F]/10 text-[#DC2626]'
            }`}
          >
            <span>{dispatchNotice.ok ? '✅ ' : '🚫 '}{dispatchNotice.message}</span>
            <button type="button" onClick={() => setDispatchNotice(null)} className="shrink-0 underline">
              {isEng ? 'Close' : '닫기'}
            </button>
          </div>
        )}

        {/* 1-Click QR Boarding & Sensor Bar */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              void showDispatchResult(onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose));
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#0A0A0A] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <QrCode className="w-3.5 h-3.5" />
            {isEng
              ? `⚡ 1-Sec Key QR Start (Unit #${currentVeh.fleetNumber})`
              : `⚡ 차키 QR 1초 출발 (#${currentVeh.fleetNumber}호차)`}
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleToggleRealSensors}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition ${
                realSensorActive
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#FFFFFF] hover:bg-black/[0.06] text-[#52525B]'
              }`}
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              <Radio className={`w-3 h-3 ${realSensorActive ? 'animate-ping' : ''}`} />
              {realSensorActive
                ? isEng
                  ? 'Sensors ON'
                  : '센서 ON'
                : isEng
                  ? 'Connect Phone Sensors'
                  : '휴대폰 센서 연결'}
            </button>
            <button
              type="button"
              onClick={handleBluetoothPairing}
              className="py-1.5 px-2.5 rounded-lg bg-[#FFFFFF] hover:bg-black/[0.06] text-[11px] text-[#52525B] flex items-center justify-center gap-1 transition"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              <Bluetooth className="w-3 h-3 text-[#0A72EF]" />
              {isEng ? 'Pair Bluetooth' : '블루투스 연결'}
            </button>
          </div>

          {realSensorActive && liveSnapshot && (
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
              <div className="p-1 rounded bg-[#FFFFFF] text-[#047857]">
                {liveSnapshot.speedKmh} km/h
              </div>
              <div className="p-1 rounded bg-[#FFFFFF] text-[#B45309]">
                {liveSnapshot.gForce} G
              </div>
              <div className="p-1 rounded bg-[#FFFFFF] text-[#1D4ED8]">
                {liveSnapshot.gyroYawDegPerSec}°/s
              </div>
            </div>
          )}
        </div>

        {/* Employee & Vehicle Selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-mono text-[#71717A] block mb-1">
              {isEng ? 'Driver' : '운전자'}
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full rounded-lg bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#0A0A0A] focus:outline-none"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {formatEmpName(emp.name, lang)} ({formatDeptName(emp.department, lang)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#71717A] block mb-1">
              {isEng ? 'Vehicle' : '차량'}
            </label>
            <select
              value={selectedVehId}
              onChange={(e) => setSelectedVehId(e.target.value)}
              className="w-full rounded-lg bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#0A0A0A] focus:outline-none"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              {vehicles.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  {isEng
                    ? `Unit #${veh.fleetNumber} · ${veh.plateNumber}`
                    : `#${veh.fleetNumber}호차 · ${veh.plateNumber}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode Switch Tabs */}
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#FFFFFF]"
          style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
        >
          <button
            type="button"
            onClick={() => setPhoneTab('WORKFLOW')}
            className={`py-1.5 rounded-md text-xs font-medium transition ${
              phoneTab === 'WORKFLOW'
                ? 'bg-[#E4E4E7] text-[#0A0A0A]'
                : 'text-[#71717A] hover:text-[#0A0A0A]'
            }`}
          >
            {isEng ? 'Request · Return' : '신청 · 반납'}
          </button>
          <button
            type="button"
            onClick={() => setPhoneTab('SENSOR_TEST')}
            className={`py-1.5 rounded-md text-xs font-medium transition ${
              phoneTab === 'SENSOR_TEST'
                ? 'bg-[#E4E4E7] text-[#0A0A0A]'
                : 'text-[#71717A] hover:text-[#0A0A0A]'
            }`}
          >
            {isEng ? 'Sensor · Alert Test' : '센서 · 무단 테스트'}
          </button>
        </div>

        {/* TAB 1: WORKFLOW */}
        {phoneTab === 'WORKFLOW' && (
          <div className="space-y-2.5">
            {/* Step 1: Request */}
            <div
              className="p-3 rounded-lg bg-[#FFFFFF] space-y-2"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-[11px] font-mono text-[#52525B] block">
                {isEng ? '1. Request Vehicle' : '1. 배차 신청'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as TripPurpose)}
                  className="rounded-md bg-[#FAFAFA] px-2 py-1.5 text-xs text-[#0A0A0A]"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <option value="거래처방문">
                    {isEng ? 'Client Visit' : '거래처방문'}
                  </option>
                  <option value="일반업무/외근">
                    {isEng ? 'Field Business' : '일반업무/외근'}
                  </option>
                  <option value="긴급출동/현장지원">
                    {isEng ? 'Urgent Support' : '긴급출동/현장지원'}
                  </option>
                  <option value="출퇴근(승인)">
                    {isEng ? 'Approved Commute' : '출퇴근(승인)'}
                  </option>
                </select>
                <input
                  type="text"
                  value={plannedWindow}
                  onChange={(e) => setPlannedWindow(e.target.value)}
                  className="rounded-md bg-[#FAFAFA] px-2 py-1.5 text-xs text-[#0A0A0A]"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                  placeholder={isEng ? 'Time Window' : '시간'}
                />
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="flex-1 rounded-md bg-[#FAFAFA] px-2.5 py-1.5 text-xs text-[#0A0A0A]"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                  placeholder={isEng ? 'Destination' : '행선지'}
                />
                <button
                  type="button"
                  onClick={() => {
                    void showDispatchResult(onCreateRequest({
                      employeeId: selectedEmpId,
                      vehicleId: selectedVehId,
                      purpose: selectedPurpose,
                      destination,
                      plannedTimeWindow: plannedWindow,
                      notes: isEng ? 'Mobile Request' : '모바일 신청',
                    }));
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-medium shrink-0 transition"
                >
                  {isEng ? 'Request' : '신청'}
                </button>
              </div>
            </div>

            {/* Step 2~4: Active Reservations & Return */}
            <div
              className="p-3 rounded-lg bg-[#FFFFFF] space-y-2"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#52525B]">
                  {isEng ? '2. My Dispatch · Start · Return' : '2. 내 배차 · 출발 · 반납'}
                </span>
                <span className="text-[10px] font-mono text-[#71717A]">
                  {myReservations.length}
                </span>
              </div>

              {myReservations.length > 0 && (
                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                  {myReservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-2 rounded-md bg-[#FAFAFA] space-y-1.5 text-xs"
                      style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-[#0A0A0A]">
                          {isEng
                            ? `Unit #${res.fleetNumber} · ${res.plateNumber}`
                            : `#${res.fleetNumber}호차 · ${res.plateNumber}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/[0.06] text-[#52525B]">
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
                                : isEng
                                  ? 'Returned'
                                  : '반납완료'}
                        </span>
                      </div>

                      {res.stage === 'REQUESTED' && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-[#B45309] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {isEng ? 'Pending' : '승인대기'}
                          </span>
                          {dataMode === 'DEMO' && (
                            <button
                              type="button"
                              onClick={() => {
                                void showDispatchResult(onApproveRequest(res.id));
                              }}
                              className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#047857] text-[11px]"
                            >
                              {isEng ? 'Approve Now' : '즉시 승인'}
                            </button>
                          )}
                        </div>
                      )}

                      {res.stage === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            void showDispatchResult(onStartUsingVehicle(res.id));
                          }}
                          className="w-full py-1.5 rounded bg-[#0A72EF] text-white text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          {isEng ? 'Start Driving' : '운행 시작'}
                        </button>
                      )}

                      {res.stage === 'IN_USE' && (
                        <div className="flex gap-1.5 pt-1">
                          <select
                            value={returnLot}
                            onChange={(e) => setReturnLot(e.target.value)}
                            className="rounded bg-[#FFFFFF] px-2 py-1 text-[11px] text-[#0A0A0A]"
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
                              void showDispatchResult(onReturnVehicle(res.id, fullZone, true));
                            }}
                            className="flex-1 py-1 rounded bg-[#10B981] text-white text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {isEng ? 'Return Vehicle' : '반납 완료'}
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
                  void showDispatchResult(onAutoReturnToGarage(selectedVehId));
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Car className="w-3.5 h-3.5" />
                {isEng
                  ? `Auto-Return to HQ Garage (Unit #${currentVeh.fleetNumber})`
                  : `차고지 복귀 자동반납 (#${currentVeh.fleetNumber}호차)`}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SENSOR TEST */}
        {phoneTab === 'SENSOR_TEST' && (
          <div className="space-y-2">
            <div
              className="p-2.5 rounded-lg bg-[#FFFFFF] flex items-center justify-between gap-2"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-xs text-[#0A0A0A] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0A72EF]" />
                {isEng ? '1-Tap Authorized Start' : '자율 반출 출발'}
              </span>
              <button
                type="button"
                onClick={() => {
                  void showDispatchResult(onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose));
                }}
                className="px-2.5 py-1 rounded bg-[#0A72EF] text-white text-xs"
              >
                {isEng ? 'Start' : '원터치 출발'}
              </button>
            </div>

            <div
              className="p-2.5 rounded-lg bg-[#FF5B4F]/10 space-y-2"
              style={{ boxShadow: 'rgba(255, 91, 79, 0.25) 0px 0px 0px 1px' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#DC2626] font-medium">
                  {isEng ? 'Unauthorized Key Start' : '미승인 무단 시동·출발'}
                </span>
                <label className="flex items-center gap-1 text-[11px] text-[#52525B]">
                  <input
                    type="checkbox"
                    checked={includeCoPassenger}
                    onChange={(e) => setIncludeCoPassenger(e.target.checked)}
                  />
                  {isEng ? 'With Co-Passenger' : '동승자 포함'}
                </label>
              </div>
              {includeCoPassenger && (
                <select
                  value={coPassengerId}
                  onChange={(e) => setCoPassengerId(e.target.value)}
                  className="w-full rounded bg-[#FAFAFA] px-2 py-1 text-[11px] text-[#0A0A0A]"
                >
                  {employees
                    .filter((e) => e.id !== selectedEmpId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {isEng ? 'Co-Passenger: ' : '동승: '}
                        {formatEmpName(emp.name, lang)}
                      </option>
                    ))}
                </select>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void showDispatchResult(onUnauthorizedKeyTheft(
                      selectedEmpId,
                      selectedVehId,
                      includeCoPassenger ? coPassengerId : null
                    ));
                  }}
                  className="flex-1 py-1.5 rounded bg-[#FF5B4F] text-white text-xs font-medium flex items-center justify-center gap-1"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  {isEng ? 'Unauthorized Start' : '무단 출발'}
                </button>
                {currentVeh.status === 'UNAUTHORIZED' && (
                  <button
                    type="button"
                    onClick={() => {
                      void showDispatchResult(onLateReasonSubmit(selectedVehId, selectedPurpose));
                    }}
                    className="px-2.5 py-1.5 rounded bg-[#FFFFFF] text-[#0A0A0A] text-[11px]"
                  >
                    {isEng ? 'Submit Reason' : '사후 사유'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void showDispatchResult(onSimulateCrashOrDrop(selectedVehId, true));
                }}
                className="py-2 px-2 rounded-lg bg-[#FFFFFF] text-[#B45309] text-xs font-medium flex items-center justify-center gap-1"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
              >
                <Zap className="w-3.5 h-3.5" />
                {isEng ? '3.2G Crash' : '3.2G 충돌'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void showDispatchResult(onSimulateCrashOrDrop(selectedVehId, false));
                }}
                className="py-2 px-2 rounded-lg bg-[#FFFFFF] text-[#52525B] text-xs font-medium"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
              >
                {isEng ? 'Phone Drop' : '휴대폰 낙하'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                void showDispatchResult(onTogglePermissionEvasion(selectedEmpId));
              }}
              className="w-full py-1.5 rounded-lg bg-[#FFFFFF] text-xs text-[#52525B] flex items-center justify-center gap-1.5"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
            >
              <BluetoothOff className="w-3.5 h-3.5 text-[#B45309]" />
              {isEng ? 'Toggle BT Permission ON/OFF' : '블루투스 권한 ON/OFF'}
            </button>
          </div>
        )}
      </div>

      {/* Compact 1-Line Status Footer */}
      <div className="mt-3 pt-2 border-t border-black/[0.06] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
        <span>{isEng ? 'STATUS' : '상태'}</span>
        <span className="text-[#52525B] truncate max-w-[230px]">
          {simFeedback || (isEng ? 'Ready' : '대기 중')}
        </span>
      </div>
    </div>
  );
};
