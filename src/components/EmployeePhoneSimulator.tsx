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
import { AppLang, formatDeptName, formatEmpName } from '@/utils/i18n';

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
            <h3 className="text-sm font-semibold text-[#FAFAFA]">
              {isEng ? 'Employee Mobile App' : '임직원 모바일 앱'}
            </h3>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              isDrivingThisCar
                ? 'bg-[#0A72EF]/15 text-[#60A5FA]'
                : 'bg-[#10B981]/15 text-[#34D399]'
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

        {/* 1-Click QR Boarding & Sensor Bar */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose);
              setSimFeedback(
                isEng
                  ? `Unit #${currentVeh.fleetNumber} QR Boarding · Trip Started`
                  : `#${currentVeh.fleetNumber}호차 QR 탑승 · 운행 시작`
              );
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#FAFAFA] hover:bg-[#E4E4E7] text-[#0A0A0A] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
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
                  : 'bg-[#111111] hover:bg-white/[0.06] text-[#A1A1AA]'
              }`}
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
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
              className="py-1.5 px-2.5 rounded-lg bg-[#111111] hover:bg-white/[0.06] text-[11px] text-[#A1A1AA] flex items-center justify-center gap-1 transition"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <Bluetooth className="w-3 h-3 text-[#0A72EF]" />
              {isEng ? 'Pair Bluetooth' : '블루투스 연결'}
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
            <label className="text-[10px] font-mono text-[#71717A] block mb-1">
              {isEng ? 'Driver' : '운전자'}
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full rounded-lg bg-[#111111] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:outline-none"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
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
              className="w-full rounded-lg bg-[#111111] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:outline-none"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
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
            {isEng ? 'Request · Return' : '신청 · 반납'}
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
            {isEng ? 'Sensor · Alert Test' : '센서 · 무단 테스트'}
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
              <span className="text-[11px] font-mono text-[#A1A1AA] block">
                {isEng ? '1. Request Vehicle' : '1. 배차 신청'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as TripPurpose)}
                  className="rounded-md bg-[#0A0A0A] px-2 py-1.5 text-xs text-[#FAFAFA]"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
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
                  className="rounded-md bg-[#0A0A0A] px-2 py-1.5 text-xs text-[#FAFAFA]"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                  placeholder={isEng ? 'Time Window' : '시간'}
                />
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="flex-1 rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-xs text-[#FAFAFA]"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                  placeholder={isEng ? 'Destination' : '행선지'}
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
                      notes: isEng ? 'Mobile Request' : '모바일 신청',
                    });
                    setSimFeedback(
                      isEng
                        ? `Unit #${currentVeh.fleetNumber} Requested`
                        : `#${currentVeh.fleetNumber}호차 배차 신청 완료`
                    );
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-medium shrink-0 transition"
                >
                  {isEng ? 'Request' : '신청'}
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
                      className="p-2 rounded-md bg-[#0A0A0A] space-y-1.5 text-xs"
                      style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-[#FAFAFA]">
                          {isEng
                            ? `Unit #${res.fleetNumber} · ${res.plateNumber}`
                            : `#${res.fleetNumber}호차 · ${res.plateNumber}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-[#A1A1AA]">
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
                          <span className="text-[11px] text-[#FBBF24] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {isEng ? 'Pending' : '승인대기'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onApproveRequest(res.id);
                              setSimFeedback(
                                isEng
                                  ? `Unit #${res.fleetNumber} Approved`
                                  : `#${res.fleetNumber}호차 승인 완료`
                              );
                            }}
                            className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#34D399] text-[11px]"
                          >
                            {isEng ? 'Approve Now' : '즉시 승인'}
                          </button>
                        </div>
                      )}

                      {res.stage === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            onStartUsingVehicle(res.id);
                            setSimFeedback(
                              isEng
                                ? `Unit #${res.fleetNumber} Trip Started`
                                : `#${res.fleetNumber}호차 운행 시작`
                            );
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
                              setSimFeedback(
                                isEng
                                  ? `Unit #${res.fleetNumber} Returned`
                                  : `#${res.fleetNumber}호차 반납 완료`
                              );
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
                  onAutoReturnToGarage(selectedVehId);
                  setSimFeedback(
                    isEng
                      ? `Unit #${currentVeh.fleetNumber} Auto-Returned to Garage`
                      : `#${currentVeh.fleetNumber}호차 차고지 자동반납 완료`
                  );
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
              className="p-2.5 rounded-lg bg-[#111111] flex items-center justify-between gap-2"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-xs text-[#FAFAFA] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0A72EF]" />
                {isEng ? '1-Tap Authorized Start' : '자율 반출 출발'}
              </span>
              <button
                type="button"
                onClick={() => {
                  onAuthorizedCheckout(selectedEmpId, selectedVehId, selectedPurpose);
                  setSimFeedback(
                    isEng
                      ? `Unit #${currentVeh.fleetNumber} Authorized Start`
                      : `#${currentVeh.fleetNumber}호차 자율 반출 완료`
                  );
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
                <span className="text-[#FF5B4F] font-medium">
                  {isEng ? 'Unauthorized Key Start' : '미승인 무단 시동·출발'}
                </span>
                <label className="flex items-center gap-1 text-[11px] text-[#A1A1AA]">
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
                  className="w-full rounded bg-[#0A0A0A] px-2 py-1 text-[11px] text-[#FAFAFA]"
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
                    onUnauthorizedKeyTheft(
                      selectedEmpId,
                      selectedVehId,
                      includeCoPassenger ? coPassengerId : null
                    );
                    setSimFeedback(
                      isEng
                        ? `Unit #${currentVeh.fleetNumber} Unauthorized Alert`
                        : `#${currentVeh.fleetNumber}호차 무단운행 감지 (Red Alert)`
                    );
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
                      onLateReasonSubmit(selectedVehId, selectedPurpose);
                      setSimFeedback(isEng ? 'Late reason submitted' : '사후 사유 입력됨');
                    }}
                    className="px-2.5 py-1.5 rounded bg-[#111111] text-[#FAFAFA] text-[11px]"
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
                  onSimulateCrashOrDrop(selectedVehId, true);
                  setSimFeedback(isEng ? '3.24G Impact Detected' : '3.24G 충돌 감지됨');
                }}
                className="py-2 px-2 rounded-lg bg-[#111111] text-[#FBBF24] text-xs font-medium flex items-center justify-center gap-1"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
              >
                <Zap className="w-3.5 h-3.5" />
                {isEng ? '3.2G Crash' : '3.2G 충돌'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSimulateCrashOrDrop(selectedVehId, false);
                  setSimFeedback(isEng ? 'Phone Drop Filtered' : '단순 낙하 제외됨');
                }}
                className="py-2 px-2 rounded-lg bg-[#111111] text-[#A1A1AA] text-xs font-medium"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
              >
                {isEng ? 'Phone Drop' : '휴대폰 낙하'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onTogglePermissionEvasion(selectedEmpId);
                setSimFeedback(isEng ? 'BT Permission Toggled' : '블루투스 권한 토글됨');
              }}
              className="w-full py-1.5 rounded-lg bg-[#111111] text-xs text-[#A1A1AA] flex items-center justify-center gap-1.5"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <BluetoothOff className="w-3.5 h-3.5 text-[#FBBF24]" />
              {isEng ? 'Toggle BT Permission ON/OFF' : '블루투스 권한 ON/OFF'}
            </button>
          </div>
        )}
      </div>

      {/* Compact 1-Line Status Footer */}
      <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
        <span>{isEng ? 'STATUS' : '상태'}</span>
        <span className="text-[#A1A1AA] truncate max-w-[230px]">
          {simFeedback || (isEng ? 'Ready' : '대기 중')}
        </span>
      </div>
    </div>
  );
};
