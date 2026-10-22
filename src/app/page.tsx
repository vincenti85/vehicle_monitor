'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  Bluetooth,
  BookOpen,
  Car,
  CheckCircle,
  ClipboardList,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  Radar,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  AppLang,
  formatDeptName,
  formatEmpName,
  formatTripPurpose,
} from '@/utils/i18n';
import {
  Employee,
  GeofenceLog,
  GhostTripCase,
  IncidentEvent,
  SystemPolicyConfig,
  TaxLogEntry,
  TripPurpose,
  Vehicle,
  VehicleReservation,
  VehicleStatus,
} from '@/types/fleet';
import {
  INITIAL_EMPLOYEES,
  INITIAL_GEOFENCE_LOGS,
  INITIAL_GHOST_TRIPS,
  INITIAL_INCIDENTS,
  INITIAL_POLICY_CONFIG,
  INITIAL_RESERVATIONS,
  INITIAL_TAX_LOGS,
  INITIAL_VEHICLES,
} from '@/data/initialFleetData';
import { TeslaTelemetryMap } from '@/components/TeslaTelemetryMap';
import { EmployeePhoneSimulator } from '@/components/EmployeePhoneSimulator';
import { ReservationWorkflowPanel } from '@/components/ReservationWorkflowPanel';
import {
  AdminManagementConsole,
  EmployeeCsvRow,
  VehicleCsvRow,
} from '@/components/AdminManagementConsole';
import { UserApprovalManualModal } from '@/components/UserApprovalManualModal';
import { NewUserOnboardingGuide } from '@/components/NewUserOnboardingGuide';
import { VehiclePhoneSetupInfographic } from '@/components/VehiclePhoneSetupInfographic';

type TopViewMode = 'EMPLOYEE_OPS' | 'LIVE_MONITOR' | 'ADMIN_CONSOLE' | 'GUIDE_MANUAL';

type CockpitTab =
  | 'DISPATCH_WORKFLOW'
  | 'FLEET_MATRIX'
  | 'NO_DASHCAM_INCIDENTS'
  | 'ANTI_EVASION'
  | 'TAX_LOGBOOK';

export default function FleetGuardCockpitPage() {
  // Default initial screen is now EMPLOYEE_OPS (임직원 차량 신청·반납 운영화면)
  const [viewMode, setViewMode] = useState<TopViewMode>('EMPLOYEE_OPS');
  const [lang, setLang] = useState<AppLang>('KOR');
  const isEng = lang === 'ENG';
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [reservations, setReservations] =
    useState<VehicleReservation[]>(INITIAL_RESERVATIONS);
  const [incidents, setIncidents] = useState<IncidentEvent[]>(INITIAL_INCIDENTS);
  const [geofenceLogs, setGeofenceLogs] = useState<GeofenceLog[]>(INITIAL_GEOFENCE_LOGS);
  const [ghostTrips, setGhostTrips] = useState<GhostTripCase[]>(INITIAL_GHOST_TRIPS);
  const [taxLogs, setTaxLogs] = useState<TaxLogEntry[]>(INITIAL_TAX_LOGS);
  const [policyConfig, setPolicyConfig] =
    useState<SystemPolicyConfig>(INITIAL_POLICY_CONFIG);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('veh-3');
  const [activeTab, setActiveTab] = useState<CockpitTab>('DISPATCH_WORKFLOW');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VehicleStatus>('ALL');
  const [liveTelemetryTick, setLiveTelemetryTick] = useState<boolean>(true);

  // Admin PIN 4400 Gate, Manual Modal & 3-Step Onboarding Guide State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [showQuickGuideBar, setShowQuickGuideBar] = useState<boolean>(true);

  const handleOpenAdminConsole = () => {
    if (isAdminUnlocked) {
      setViewMode('ADMIN_CONSOLE');
    } else {
      setPinInput('');
      setPinError(null);
      setShowPinModal(true);
    }
  };

  const handleVerifyAdminPin = (candidatePin?: string) => {
    const code = (candidatePin ?? pinInput).trim();
    if (code === '4400') {
      setIsAdminUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError(null);
      setViewMode('ADMIN_CONSOLE');
    } else {
      setPinError('보안 PIN 번호가 일치하지 않습니다. 관리자에게 문의하세요.');
      setPinInput('');
    }
  };

  const handleDigitClick = (digit: string) => {
    setPinError(null);
    const next = (pinInput + digit).slice(0, 4);
    setPinInput(next);
    if (next.length === 4) {
      if (next === '4400') {
        setIsAdminUnlocked(true);
        setShowPinModal(false);
        setPinInput('');
        setViewMode('ADMIN_CONSOLE');
      } else {
        setPinError('보안 PIN 번호가 일치하지 않습니다. 관리자에게 문의하세요.');
        setTimeout(() => setPinInput(''), 350);
      }
    }
  };

  const [pushStream, setPushStream] = useState<
    {
      id: string;
      time: string;
      target: 'MANAGER' | 'DRIVER';
      message: string;
      level: 'CRITICAL' | 'INFO';
    }[]
  >([
    {
      id: 'push-0',
      time: '20:22:05',
      target: 'MANAGER',
      message:
        '📋 [배차 승인 요청] 이정우 사원이 4호차(AL 41D-2648) 배차를 신청했습니다. (행선지: Auburn Technology Park)',
      level: 'INFO',
    },
    {
      id: 'push-1',
      time: '20:18:42',
      target: 'MANAGER',
      message:
        '💥 [무블랙박스 사고 재구성] 7호차(AL 41B-4821 · 김민수 과장) US-280 & Gateway Dr(Opelika, AL)에서 스마트폰 6축 센서 3.18G 충격 + 자이로 42.5°/s 회전 + 급정차가 감지되었습니다.',
      level: 'CRITICAL',
    },
    {
      id: 'push-2',
      time: '20:15:30',
      target: 'MANAGER',
      message:
        '🚨 [미승인 운행 포착] 박성훈 대리가 사전 등록 없이 4400 Northpark Dr에서 3호차(AL 41A-9012) 운행을 시작했습니다.',
      level: 'CRITICAL',
    },
    {
      id: 'push-3',
      time: '20:15:31',
      target: 'DRIVER',
      message:
        '⚠️ [운전자 경고] 박성훈 대리님, 3호차(AL 41A-9012) 미등록 운행이 관리자에게 자동 통보되었습니다. 즉시 운행 목적을 선택해 주세요.',
      level: 'CRITICAL',
    },
  ]);

  const [dbSyncState, setDbSyncState] = useState<'HYDRATING' | 'SYNCED' | 'SAVING'>('HYDRATING');
  const [dbLastUpdated, setDbLastUpdated] = useState<string>('');
  const isHydratedRef = useRef<boolean>(false);

  // 1. Hydrate state from persistent backend DB (/api/fleet/state) on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/fleet/state')
      .then((res) => res.json())
      .then((resData) => {
        if (cancelled || !resData?.data) return;
        const db = resData.data;
        if (Array.isArray(db.vehicles) && db.vehicles.length > 0) setVehicles(db.vehicles);
        if (Array.isArray(db.employees) && db.employees.length > 0) setEmployees(db.employees);
        if (Array.isArray(db.reservations)) setReservations(db.reservations);
        if (Array.isArray(db.incidents)) setIncidents(db.incidents);
        if (Array.isArray(db.geofenceLogs)) setGeofenceLogs(db.geofenceLogs);
        if (Array.isArray(db.ghostTrips)) setGhostTrips(db.ghostTrips);
        if (Array.isArray(db.taxLogs)) setTaxLogs(db.taxLogs);
        if (db.policyConfig) setPolicyConfig(db.policyConfig);
        if (Array.isArray(db.pushStream) && db.pushStream.length > 0) {
          setPushStream(db.pushStream);
        }
        setDbLastUpdated(db.lastUpdatedAt ? new Date(db.lastUpdatedAt).toLocaleTimeString() : '방금 전');
        isHydratedRef.current = true;
        setDbSyncState('SYNCED');
      })
      .catch(() => {
        isHydratedRef.current = true;
        setDbSyncState('SYNCED');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Automatically persist business state mutations to backend DB (data/fleet-db.json)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    setDbSyncState('SAVING');
    const timer = setTimeout(() => {
      fetch('/api/fleet/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patch: {
            vehicles,
            employees,
            reservations,
            incidents,
            geofenceLogs,
            ghostTrips,
            taxLogs,
            policyConfig,
            pushStream,
          },
        }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData?.data?.lastUpdatedAt) {
            setDbLastUpdated(new Date(resData.data.lastUpdatedAt).toLocaleTimeString());
          }
          setDbSyncState('SYNCED');
        })
        .catch(() => setDbSyncState('SYNCED'));
    }, 350);
    return () => clearTimeout(timer);
  }, [
    employees,
    reservations,
    incidents,
    geofenceLogs,
    ghostTrips,
    taxLogs,
    policyConfig,
    pushStream,
  ]);

  const handleResetDatabase = async () => {
    setDbSyncState('SAVING');
    try {
      const res = await fetch('/api/fleet/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_SEED' }),
      });
      const resData = await res.json();
      if (resData?.data) {
        const db = resData.data;
        setVehicles(db.vehicles);
        setEmployees(db.employees);
        setReservations(db.reservations);
        setIncidents(db.incidents);
        setGeofenceLogs(db.geofenceLogs);
        setGhostTrips(db.ghostTrips);
        setTaxLogs(db.taxLogs);
        setPolicyConfig(db.policyConfig);
        setPushStream(db.pushStream);
        setDbLastUpdated(new Date(db.lastUpdatedAt).toLocaleTimeString());
      }
    } finally {
      setDbSyncState('SYNCED');
    }
  };

  // Subtle live telemetry oscillation for active vehicles
  useEffect(() => {
    if (!liveTelemetryTick) return;
    const timer = setInterval(() => {
      setVehicles((prev) =>
        prev.map((veh) => {
          if (veh.status === 'IDLE' || veh.status === 'INCIDENT') return veh;
          const deltaSpd = Math.floor(Math.random() * 7) - 3;
          const nextSpeed = Math.max(18, Math.min(88, veh.speedKmh + deltaSpd));
          const nextLat = veh.lat + (Math.random() - 0.48) * 0.0005;
          const nextLng = veh.lng + (Math.random() - 0.48) * 0.0005;
          return {
            ...veh,
            speedKmh: nextSpeed,
            currentGForce: Number((0.95 + Math.random() * 0.25).toFixed(2)),
            cumulativeGpsKm: Number((veh.cumulativeGpsKm + 0.03).toFixed(1)),
            lat: nextLat,
            lng: nextLng,
          };
        })
      );
    }, 2500);
    return () => clearInterval(timer);
  }, [liveTelemetryTick]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0],
    [vehicles, selectedVehicleId]
  );

  const latestIncidentForSelected = useMemo(
    () => incidents.find((inc) => inc.vehicleId === selectedVehicle.id),
    [incidents, selectedVehicle]
  );

  const filteredVehicles = useMemo(() => {
    if (statusFilter === 'ALL') return vehicles;
    return vehicles.filter((v) => v.status === statusFilter);
  }, [vehicles, statusFilter]);

  const counts = useMemo(() => {
    return {
      unauthorized: vehicles.filter((v) => v.status === 'UNAUTHORIZED').length,
      incident: vehicles.filter((v) => v.status === 'INCIDENT').length,
      authorized: vehicles.filter((v) => v.status === 'AUTHORIZED').length,
      idle: vehicles.filter((v) => v.status === 'IDLE').length,
      permissionEvasion: employees.filter((e) => e.permissionStatus !== 'OK').length,
      pendingApproval: reservations.filter((r) => r.stage === 'REQUESTED').length,
      approvedReady: reservations.filter((r) => r.stage === 'APPROVED').length,
      unresolvedIncidents: incidents.filter((i) => !i.resolved).length,
    };
  }, [vehicles, employees, reservations, incidents]);

  const nowTimeStr = () => {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  };

  // ============================================================================
  // 4-STAGE LIFECYCLE HANDLERS: 1.신청(REQUESTED) -> 2.승인(APPROVED) -> 3.사용(IN_USE) -> 4.반납(RETURNED)
  // ============================================================================

  const handleCreateRequest = (payload: {
    employeeId: string;
    vehicleId: string;
    purpose: TripPurpose;
    destination: string;
    plannedTimeWindow: string;
    notes: string;
  }) => {
    const emp = employees.find((e) => e.id === payload.employeeId);
    const veh = vehicles.find((v) => v.id === payload.vehicleId);
    if (!emp || !veh) return;

    const timestamp = nowTimeStr();

    // Check if employee is blocked by Admin or if vehicle is locked
    if (emp.dispatchAllowed === false) {
      setPushStream((prev) => [
        {
          id: `push-blk-${Date.now()}`,
          time: timestamp,
          target: 'DRIVER',
          message: `🚫 [배차 신청 차단됨] ${emp.name.split(' (')[0]}님은 권한 미준수 또는 무단반출 이력으로 관리자에 의해 배차 자격이 일시 정지되었습니다.`,
          level: 'CRITICAL',
        },
        ...prev,
      ]);
      return;
    }

    if (veh.isLockedByAdmin) {
      setPushStream((prev) => [
        {
          id: `push-vlk-${Date.now()}`,
          time: timestamp,
          target: 'DRIVER',
          message: `🚫 [차량 잠금 상태] #${veh.fleetNumber}호차(${veh.plateNumber})는 관리자에 의해 배차 차단(점검) 상태입니다.`,
          level: 'CRITICAL',
        },
        ...prev,
      ]);
      return;
    }

    const autoApprove = policyConfig.autoApproveWhenManagerAway;
    const initialStage = autoApprove ? 'APPROVED' : 'REQUESTED';

    const newRes: VehicleReservation = {
      id: `res-${Date.now()}`,
      vehicleId: veh.id,
      fleetNumber: veh.fleetNumber,
      plateNumber: veh.plateNumber,
      modelName: veh.modelName,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      purpose: payload.purpose,
      destination: payload.destination,
      plannedTimeWindow: payload.plannedTimeWindow,
      stage: initialStage,
      requestedAt: timestamp,
      approvedAt: autoApprove ? timestamp : null,
      approvedBy: autoApprove ? '관리자 부재 중 자동승인 (Auto-Approve)' : null,
      startedAt: null,
      returnedAt: null,
      startOdometerKm: veh.cumulativeGpsKm,
      endOdometerKm: null,
      returnParkingZone: null,
      keyReturnedToBox: false,
      notes: payload.notes,
    };

    setReservations((prev) => [newRes, ...prev]);
    setActiveTab('DISPATCH_WORKFLOW');

    if (autoApprove) {
      setPushStream((prev) => [
        {
          id: `push-a-${Date.now()}`,
          time: timestamp,
          target: 'DRIVER',
          message: `✅ [배차 자동 승인] ${emp.name.split(' (')[0]}님, #${veh.fleetNumber}호차(${veh.plateNumber}) 신청이 자동 승인되었습니다. 키보관함에서 키를 수령해 운행을 시작하세요.`,
          level: 'INFO',
        },
        ...prev,
      ]);
    } else {
      setPushStream((prev) => [
        {
          id: `push-r-${Date.now()}`,
          time: timestamp,
          target: 'MANAGER',
          message: `📋 [배차 승인 요청] ${emp.name.split(' (')[0]}님이 #${veh.fleetNumber}호차(${veh.plateNumber}) 배차를 신청했습니다. (행선지: ${payload.destination})`,
          level: 'INFO',
        },
        ...prev,
      ]);
    }
  };

  const handleApproveRequest = (reservationId: string) => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return;
    const timestamp = nowTimeStr();

    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              stage: 'APPROVED',
              approvedAt: timestamp,
              approvedBy: '차량총괄관리자 (Fleet Admin)',
              notes: '관리자 승인 완료 — 4400 Northpark Dr 키보관함 수령 가능',
            }
          : r
      )
    );

    setPushStream((prev) => [
      {
        id: `push-ap-${Date.now()}`,
        time: timestamp,
        target: 'DRIVER',
        message: `✅ [배차 승인 완료] ${res.employeeName.split(' (')[0]}님, 신청하신 #${res.fleetNumber}호차(${res.plateNumber}) 배차가 승인되었습니다. 키 수령 후 사용을 시작하세요.`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleRejectRequest = (reservationId: string) => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return;
    const timestamp = nowTimeStr();

    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              stage: 'REJECTED',
              notes: '관리자 반려 (타 부서 긴급 일정 중복 또는 권한 미충족)',
            }
          : r
      )
    );

    setPushStream((prev) => [
      {
        id: `push-rj-${Date.now()}`,
        time: timestamp,
        target: 'DRIVER',
        message: `❌ [배차 반려 알림] ${res.employeeName.split(' (')[0]}님, #${res.fleetNumber}호차(${res.plateNumber}) 배차 신청이 반려되었습니다.`,
        level: 'CRITICAL',
      },
      ...prev,
    ]);
  };

  const handleStartUsingVehicle = (reservationId: string) => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return;
    const timestamp = nowTimeStr();

    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              stage: 'IN_USE',
              startedAt: timestamp,
              notes: `운행 시작 (${res.destination} 방면 이동 중 · 블루투스 자동 매칭 완료)`,
            }
          : r
      )
    );

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === res.vehicleId
          ? {
              ...v,
              status: 'AUTHORIZED',
              speedKmh: 58,
              currentGForce: 1.01,
              rssiDbm: -48,
              currentDriverId: res.employeeId,
              coPassengerIds: [],
              driverSelectionReason: `정식 배차 승인(${res.id}) + 4400 Northpark Dr 키 수령 및 순정 블루투스 매칭`,
              tripPurpose: res.purpose,
              tripStartedAt: timestamp,
              parkingZone: `${res.destination} 방면 정상 운행중`,
              lat: 32.6912 + (Math.random() - 0.5) * 0.016,
              lng: -85.3298 + (Math.random() - 0.5) * 0.016,
            }
          : v
      )
    );

    setSelectedVehicleId(res.vehicleId);
    setPushStream((prev) => [
      {
        id: `push-st-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `🚗 [차량 사용 시작] ${res.employeeName.split(' (')[0]}님이 승인된 #${res.fleetNumber}호차(${res.plateNumber}) 키를 수령해 운행을 개시했습니다.`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleReturnVehicle = (
    reservationId: string,
    parkingZone: string,
    keyReturnedToBox: boolean
  ) => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return;
    const veh = vehicles.find((v) => v.id === res.vehicleId);
    const timestamp = nowTimeStr();
    const drivenKm = 22.8;
    const endOdometer = Number((res.startOdometerKm + drivenKm).toFixed(1));

    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              stage: 'RETURNED',
              returnedAt: timestamp,
              endOdometerKm: endOdometer,
              returnParkingZone: parkingZone,
              keyReturnedToBox,
              notes: `반납 완료 (${parkingZone} 주차 · 키보관함 반납: ${
                keyReturnedToBox ? '완료' : '미확인'
              } · +${drivenKm}km)`,
            }
          : r
      )
    );

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === res.vehicleId
          ? {
              ...v,
              status: 'IDLE',
              speedKmh: 0,
              currentGForce: 1.0,
              rssiDbm: -95,
              currentDriverId: null,
              coPassengerIds: [],
              driverSelectionReason: null,
              tripPurpose: null,
              tripStartedAt: null,
              cumulativeGpsKm: endOdometer,
              lastVerifiedOdometerKm: endOdometer,
              parkingZone: `${parkingZone} (반납 완료)`,
              lat: 32.6912 + ((v.fleetNumber % 6) - 2.5) * 0.0012,
              lng: -85.3298 + (Math.floor(v.fleetNumber / 6) - 2.5) * 0.0014,
            }
          : v
      )
    );

    const newTaxRow: TaxLogEntry = {
      id: `tax-${Date.now()}`,
      date: '2026-10-20',
      plateNumber: `${res.plateNumber} (${res.fleetNumber}호차)`,
      modelName: veh?.modelName || res.modelName,
      department: res.department.split(' (')[0],
      driverName: res.employeeName,
      authType: 'PRE_REGISTERED',
      purpose: res.purpose,
      startTime: (res.startedAt || '20:00').slice(0, 5),
      endTime: timestamp.slice(0, 5),
      startOdometerKm: res.startOdometerKm,
      endOdometerKm: endOdometer,
      distanceKm: drivenKm,
      autoReturnVerified: true,
    };

    setTaxLogs((prev) => [newTaxRow, ...prev]);
    setPushStream((prev) => [
      {
        id: `push-rt-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `🅿️ [차량·키 반납 완료] ${res.employeeName.split(' (')[0]}님이 #${res.fleetNumber}호차(${res.plateNumber})를 ${parkingZone}에 반납하고 키보관함 거치를 완료했습니다. (+${drivenKm}km 운행기록부 자동 생성)`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  // ============================================================================
  // ADMIN CONSOLE HANDLERS (Vehicle Registry, Odometer Audit, Employee Governance, Incident Resolution)
  // ============================================================================

  const handleUpdateVehicleMac = (
    vehicleId: string,
    newMac: string,
    newBleUuid: string
  ) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? { ...v, btMacAddress: newMac, bleBeaconUuid: newBleUuid }
          : v
      )
    );
  };

  const handleAuditVehicleOdometer = (
    vehicleId: string,
    actualOdometerKm: number
  ) => {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) return;
    const timestamp = nowTimeStr();
    const diffKm = Number((actualOdometerKm - veh.cumulativeGpsKm).toFixed(1));

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              lastVerifiedOdometerKm: actualOdometerKm,
              lastOdometerAuditAt: timestamp,
            }
          : v
      )
    );

    if (diffKm >= 5) {
      const suspectEmp =
        employees.find((e) => e.permissionStatus !== 'OK') || employees[2];
      const newGhost: GhostTripCase = {
        id: `ghost-${Date.now()}`,
        vehicleId: veh.id,
        plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
        modelName: veh.modelName,
        windowStart: '실사 직전 공백구간',
        windowEnd: timestamp.slice(0, 5),
        unaccountedKm: diffKm,
        parkingZoneChangedFrom: veh.parkingZone,
        parkingZoneChangedTo: '실사 계기판 불일치 적발',
        status: 'OPEN_INVESTIGATION',
        suspectEmployees: [
          {
            employeeId: suspectEmp.id,
            name: suspectEmp.name,
            department: suspectEmp.department,
            confidenceScore: 91,
            evidence: [
              `실제 계기판(${actualOdometerKm}km)이 앱 GPS 누적(${veh.cumulativeGpsKm}km)보다 +${diffKm}km 초과`,
              `공백 시간대 4400 Northpark Dr 차고지 출입 및 권한 비활성(${suspectEmp.permissionStatus}) 일치`,
            ],
          },
        ],
      };
      setGhostTrips((prev) => [newGhost, ...prev]);
      setPushStream((prev) => [
        {
          id: `push-gh-${Date.now()}`,
          time: timestamp,
          target: 'MANAGER',
          message: `🕵️ [계기판 실사 불일치 · 유령 주행 적발] #${veh.fleetNumber}호차(${veh.plateNumber})에서 +${diffKm}km 미기록 주행이 확인되어 유력 용의자(${suspectEmp.name})를 특정했습니다!`,
          level: 'CRITICAL',
        },
        ...prev,
      ]);
    }
  };

  const handleToggleVehicleLock = (vehicleId: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, isLockedByAdmin: !v.isLockedByAdmin } : v
      )
    );
  };

  const handleToggleEmployeeDispatch = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId
          ? { ...e, dispatchAllowed: e.dispatchAllowed === false ? true : false }
          : e
      )
    );
  };

  const handleSendPermissionWarningPush = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const timestamp = nowTimeStr();
    setPushStream((prev) => [
      {
        id: `push-pw-${Date.now()}`,
        time: timestamp,
        target: 'DRIVER',
        message: `⚠️ [관리자 권한 복구 지시] ${emp.name.split(' (')[0]}님, 현재 스마트폰 ${emp.permissionStatus} 상태입니다. 즉시 위치/블루투스 권한을 켜지 않으면 법인차량 배차가 자동 차단됩니다.`,
        level: 'CRITICAL',
      },
      ...prev,
    ]);
  };

  const handleAddEmployee = (empData: {
    name: string;
    role: string;
    department: string;
    phone: string;
  }) => {
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: empData.name,
      role: empData.role,
      department: empData.department,
      phone: empData.phone,
      permissionStatus: 'OK',
      lastHeartbeatAt: '방금 전 (신규 등록)',
      inGarageGeofence: true,
      lastKeyboxAccessAt: null,
      dispatchAllowed: true,
      violationCount: 0,
    };
    setEmployees((prev) => [newEmp, ...prev]);
  };

  const handleBulkImportVehicles = (rows: VehicleCsvRow[]) => {
    const timestamp = nowTimeStr();
    setVehicles((prev) => {
      const next = [...prev];
      rows.forEach((row) => {
        const idx = next.findIndex(
          (v) =>
            v.fleetNumber === row.fleetNumber ||
            v.plateNumber.toLowerCase() === row.plateNumber.toLowerCase()
        );
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            plateNumber: row.plateNumber,
            modelName: row.modelName,
            btMacAddress: row.btMacAddress,
            bleBeaconUuid: row.bleBeaconUuid,
            cumulativeGpsKm: row.cumulativeGpsKm,
            lastVerifiedOdometerKm: row.cumulativeGpsKm,
            parkingZone: row.parkingZone,
          };
        } else {
          next.push({
            id: `veh-csv-${Date.now()}-${row.fleetNumber}`,
            fleetNumber: row.fleetNumber,
            plateNumber: row.plateNumber,
            modelName: row.modelName,
            btMacAddress: row.btMacAddress,
            bleBeaconUuid: row.bleBeaconUuid,
            status: 'IDLE',
            speedKmh: 0,
            headingDeg: 0,
            currentGForce: 1.0,
            rssiDbm: -95,
            currentDriverId: null,
            coPassengerIds: [],
            driverSelectionReason: null,
            tripPurpose: null,
            tripStartedAt: null,
            cumulativeGpsKm: row.cumulativeGpsKm,
            lastVerifiedOdometerKm: row.cumulativeGpsKm,
            parkingZone: row.parkingZone,
            lat: 32.6912 + ((row.fleetNumber % 6) - 2.5) * 0.0012,
            lng: -85.3298 + (Math.floor(row.fleetNumber / 6) - 2.5) * 0.0014,
            isLockedByAdmin: false,
            lastOdometerAuditAt: timestamp,
          });
        }
      });
      return next.sort((a, b) => a.fleetNumber - b.fleetNumber);
    });

    setPushStream((prev) => [
      {
        id: `push-vcsv-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `📥 [차량 CSV 일괄 등록] 관리자가 CSV 업로드로 차량 ${rows.length}대 정보를 일괄 등록/업데이트했습니다.`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleBulkImportEmployees = (rows: EmployeeCsvRow[]) => {
    const timestamp = nowTimeStr();
    setEmployees((prev) => {
      const next = [...prev];
      rows.forEach((row, index) => {
        const idx = next.findIndex(
          (e) =>
            e.name.toLowerCase() === row.name.toLowerCase() ||
            e.phone === row.phone
        );
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            name: row.name,
            role: row.role,
            department: row.department,
            phone: row.phone,
            dispatchAllowed: row.dispatchAllowed,
          };
        } else {
          next.push({
            id: `emp-csv-${Date.now()}-${index}`,
            name: row.name,
            role: row.role,
            department: row.department,
            phone: row.phone,
            permissionStatus: 'OK',
            lastHeartbeatAt: '방금 전 (CSV 일괄등록)',
            inGarageGeofence: true,
            lastKeyboxAccessAt: null,
            dispatchAllowed: row.dispatchAllowed,
            violationCount: 0,
          });
        }
      });
      return next;
    });

    setPushStream((prev) => [
      {
        id: `push-ecsv-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `📥 [사용자 CSV 일괄 등록] 관리자가 CSV 업로드로 임직원(운전자) ${rows.length}명 정보를 일괄 등록/업데이트했습니다.`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleResolveIncident = (
    incidentId: string,
    resolutionNote: string,
    suspendDriver: boolean
  ) => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (!inc) return;

    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              resolved: true,
              managerResolutionNote: resolutionNote,
            }
          : i
      )
    );

    if (suspendDriver && inc.driverId) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === inc.driverId
            ? {
                ...e,
                dispatchAllowed: false,
                violationCount: (e.violationCount || 0) + 1,
              }
            : e
        )
      );
    }
  };

  // ============================================================================
  // SENSOR & UNAUTHORIZED HANDLERS (No In-Car Dashcam — 100% Smartphone IMU)
  // ============================================================================

  const handleAuthorizedCheckout = (
    employeeId: string,
    vehicleId: string,
    purpose: TripPurpose
  ) => {
    const emp = employees.find((e) => e.id === employeeId);
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!emp || !veh) return;

    const timestamp = nowTimeStr();
    const quickRes: VehicleReservation = {
      id: `res-${Date.now()}`,
      vehicleId: veh.id,
      fleetNumber: veh.fleetNumber,
      plateNumber: veh.plateNumber,
      modelName: veh.modelName,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      purpose,
      destination: 'I-85 Opelika Corridor (원터치 자율반출)',
      plannedTimeWindow: `${timestamp.slice(0, 5)} ~ 당일복귀`,
      stage: 'IN_USE',
      requestedAt: timestamp,
      approvedAt: timestamp,
      approvedBy: '원터치 자율반출 자동승인',
      startedAt: timestamp,
      returnedAt: null,
      startOdometerKm: veh.cumulativeGpsKm,
      endOdometerKm: null,
      returnParkingZone: null,
      keyReturnedToBox: false,
      notes: '관리자 부재 시 1초 원터치 자율 반출로 즉시 운행 개시',
    };

    setReservations((prev) => [quickRes, ...prev]);
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              status: 'AUTHORIZED',
              speedKmh: 46,
              currentGForce: 1.02,
              rssiDbm: -48,
              currentDriverId: employeeId,
              coPassengerIds: [],
              driverSelectionReason:
                '1초 원터치 자율 반출 사전 등록 + 차량 순정 블루투스 자동 매칭',
              tripPurpose: purpose,
              tripStartedAt: timestamp,
              parkingZone: `I-85 Opelika Corridor 정상 외근 주행중 (${purpose})`,
              lat: 32.6912 + (Math.random() - 0.5) * 0.015,
              lng: -85.3298 + (Math.random() - 0.5) * 0.015,
            }
          : v
      )
    );
    setSelectedVehicleId(vehicleId);
    setPushStream((prev) => [
      {
        id: `push-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `✅ [원터치 자율 반출] ${emp.name}님이 ${veh.fleetNumber}호차(${veh.plateNumber})를 [${purpose}] 목적으로 정상 반출했습니다.`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleUnauthorizedKeyTheft = (
    employeeId: string,
    vehicleId: string,
    coPassengerId: string | null
  ) => {
    const emp = employees.find((e) => e.id === employeeId);
    const coEmp = coPassengerId ? employees.find((e) => e.id === coPassengerId) : null;
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!emp || !veh) return;

    const timestamp = nowTimeStr();
    const reason = coEmp
      ? `차량 내 블랙박스 없이 다인 탑승 감지(${emp.name}, ${coEmp.name}) → 1순위 키보관함 BLE(${policyConfig.keyboxBleRadiusM}m) 선진입 및 2순위 운전석 핸즈프리 주 연결(-46dBm vs -74dBm)로 [${emp.name}] 주 운전자 자동 특정`
      : `차량 내 블랙박스 없이 키보관함(${policyConfig.keyboxBleRadiusM}m) 접근 후 ${veh.plateNumber} 블루투스(-46dBm) + 시속 ${policyConfig.unauthorizedSpeedThresholdKmh}km/h 초과 주행 감지`;

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              status: 'UNAUTHORIZED',
              speedKmh: 64,
              currentGForce: 1.18,
              rssiDbm: -46,
              currentDriverId: employeeId,
              coPassengerIds: coEmp ? [coEmp.id] : [],
              driverSelectionReason: reason,
              tripPurpose: '미입력(무단반출)',
              tripStartedAt: timestamp,
              parkingZone:
                '🚨 4400 Northpark Dr 무단 이탈 → I-85 주행중 (실시간 추적 활성)',
              lat: 32.6912 + (Math.random() - 0.5) * 0.014,
              lng: -85.3298 + (Math.random() - 0.5) * 0.014,
            }
          : v
      )
    );

    const newIncident: IncidentEvent = {
      id: `inc-${Date.now()}`,
      vehicleId,
      plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
      driverId: emp.id,
      driverName: `${emp.name} (${emp.department})`,
      coPassengerNames: coEmp ? [`${coEmp.name} (동승자 자동분류)`] : [],
      eventType: 'UNAUTHORIZED_START',
      title: `🚨 보고 없이 자동차키 무단 반출 및 주행 포착 (${veh.fleetNumber}호차 · ${veh.plateNumber})`,
      description: reason,
      gForce: 1.18,
      deltaSpeedKmh: 34,
      gyroYawDegPerSec: 3.8,
      impactDirection: '정상 주행 궤적 (충돌 없음)',
      speedTrace: [0, 12, 19, 31, 45, 54, 60, 63, 64, 62, 65, 64],
      locationLabel: '4400 Northpark Dr, Opelika, AL 36801 이탈 → I-85 진입',
      occurredAt: timestamp,
      resolved: false,
      sensorFusionVerdict: 'N/A',
    };

    setIncidents((prev) => [newIncident, ...prev]);
    setGeofenceLogs((prev) => [
      {
        id: `geo-${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        zoneType: 'KEYBOX_3M',
        action: 'ENTER',
        timestamp,
        permissionState: emp.permissionStatus,
        note: `관리자 부재 중 앱 미등록 상태로 키 보관함 접근 후 ${veh.fleetNumber}호차 시동·출발`,
      },
      ...prev,
    ]);
    setSelectedVehicleId(vehicleId);
    setPushStream((prev) => [
      {
        id: `push-m-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `🚨 [Red Alert · 무단 운행] ${emp.name}님이 사전 보고 없이 ${veh.fleetNumber}호차(${veh.plateNumber})를 끌고 나갔습니다!`,
        level: 'CRITICAL',
      },
      {
        id: `push-d-${Date.now() + 1}`,
        time: timestamp,
        target: 'DRIVER',
        message: `⚠️ [운전자 경고] ${emp.name}님, ${veh.plateNumber} 미승인 운행이 관리자에게 실시간 보고되었습니다. 즉시 사유를 입력하세요.`,
        level: 'CRITICAL',
      },
      ...prev,
    ]);
  };

  const handleLateReasonSubmit = (vehicleId: string, purpose: TripPurpose) => {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) return;
    const emp =
      employees.find((e) => e.id === veh.currentDriverId) || employees[0];
    const timestamp = nowTimeStr();

    const lateRes: VehicleReservation = {
      id: `res-${Date.now()}`,
      vehicleId: veh.id,
      fleetNumber: veh.fleetNumber,
      plateNumber: veh.plateNumber,
      modelName: veh.modelName,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      purpose,
      destination: '선출발 후보고 전환 운행',
      plannedTimeWindow: `${timestamp.slice(0, 5)} ~ 당일복귀`,
      stage: 'IN_USE',
      requestedAt: timestamp,
      approvedAt: timestamp,
      approvedBy: '선출발 후보고 (경고 알림 응답)',
      startedAt: veh.tripStartedAt || timestamp,
      returnedAt: null,
      startOdometerKm: veh.cumulativeGpsKm,
      endOdometerKm: null,
      returnParkingZone: null,
      keyReturnedToBox: false,
      notes: '미승인 출발 경고 수신 후 운행 목적 사후 등록',
    };

    setReservations((prev) => [lateRes, ...prev]);
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              status: 'AUTHORIZED',
              tripPurpose: purpose,
              parkingZone: `선출발 후보고 전환 (${purpose})`,
            }
          : v
      )
    );
    setPushStream((prev) => [
      {
        id: `push-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `📝 [사후 사유 입력됨] ${veh.fleetNumber}호차(${veh.plateNumber}) 운전자가 경고 알림 확인 후 [${purpose}] 사유를 사후 등록했습니다. ('선출발 후보고' 이력 보존)`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleSimulateCrashOrDrop = (vehicleId: string, isRealCrash: boolean) => {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) return;
    const emp = employees.find((e) => e.id === veh.currentDriverId) || employees[0];
    const timestamp = nowTimeStr();

    if (isRealCrash) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                status: 'INCIDENT',
                speedKmh: 0,
                currentGForce: 3.24,
                currentDriverId: emp.id,
                parkingZone: '💥 무블랙박스 스마트폰 3.24G 충격 감지 후 비상정차 중',
              }
            : v
        )
      );

      const crashEvent: IncidentEvent = {
        id: `inc-${Date.now()}`,
        vehicleId,
        plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
        driverId: emp.id,
        driverName: `${emp.name} (${emp.department})`,
        coPassengerNames: [],
        eventType: 'IMPACT_SHOCK',
        title: `💥 [무블랙박스 스마트폰 6축 센서 재구성] 3.24G 충돌 가속도 및 급정차 감지 (${veh.fleetNumber}호차)`,
        description: `차량에 블랙박스가 없는 상태에서 운전자(${emp.name}) 스마트폰의 6축 IMU 센서(피크 3.24G + 자이로 요잉 38.4°/s 좌전방 충격 벡터)와 2초 내 -44km/h 급감속 정차를 결합해 실제 차량 접촉사고를 자동 재구성했습니다.`,
        gForce: 3.24,
        deltaSpeedKmh: -44,
        gyroYawDegPerSec: 38.4,
        impactDirection: '좌측 전방 25° 추돌 벡터 (스마트폰 6축 IMU 역산)',
        speedTrace: [52, 54, 56, 55, 53, 50, 44, 8, 0, 0, 0, 0],
        locationLabel:
          'I-85 Exit 64 / Northpark Dr 인근, Opelika, AL 36801 (GPS 좌표 자동 박제)',
        occurredAt: timestamp,
        resolved: false,
        sensorFusionVerdict: 'CONFIRMED_CRASH',
      };

      setIncidents((prev) => [crashEvent, ...prev]);
      setSelectedVehicleId(vehicleId);
      setActiveTab('NO_DASHCAM_INCIDENTS');
      setPushStream((prev) => [
        {
          id: `push-${Date.now()}`,
          time: timestamp,
          target: 'MANAGER',
          message: `💥 [무블랙박스 사고 재구성] ${veh.fleetNumber}호차(${emp.name}) 스마트폰에서 3.24G 충격 + 자이로 회전(38.4°/s) + 급정차가 감지되었습니다!`,
          level: 'CRITICAL',
        },
        ...prev,
      ]);
    } else {
      setPushStream((prev) => [
        {
          id: `push-${Date.now()}`,
          time: timestamp,
          target: 'MANAGER',
          message: `🛡️ [Sensor Fusion 오탐 필터] ${veh.fleetNumber}호차에서 3.4G 단발 충격이 감지되었으나 주행 속도(Δv=0km/h)가 일정하여 '거치대 휴대폰 낙하'로 자동 제외했습니다.`,
          level: 'INFO',
        },
        ...prev,
      ]);
    }
  };

  const handleTogglePermissionEvasion = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const timestamp = nowTimeStr();
    const nextStatus = emp.permissionStatus === 'OK' ? 'BT_OFF' : 'OK';

    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId
          ? {
              ...e,
              permissionStatus: nextStatus,
              lastHeartbeatAt:
                nextStatus === 'BT_OFF'
                  ? `${timestamp} (차고지 내 BT 강제 OFF)`
                  : '방금 전 (정상 복구)',
            }
          : e
      )
    );

    if (nextStatus === 'BT_OFF') {
      setGeofenceLogs((prev) => [
        {
          id: `geo-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          department: emp.department,
          zoneType: 'GARAGE_150M',
          action: 'PERMISSION_DISABLED_IN_ZONE',
          timestamp,
          permissionState: 'BT_OFF',
          note: `⚠️ 차고지 지오펜스 내부에서 블루투스 권한 강제 OFF 감지 (우회 시도 주의)`,
        },
        ...prev,
      ]);
      setActiveTab('ANTI_EVASION');
      setPushStream((prev) => [
        {
          id: `push-${Date.now()}`,
          time: timestamp,
          target: 'MANAGER',
          message: `🕵️ [권한 회피 감지] ${emp.name}(${emp.department})님의 앱 블루투스 권한이 차고지 인근에서 꺼졌습니다. 유령 주행 감시 대상에 등록됩니다.`,
          level: 'CRITICAL',
        },
        ...prev,
      ]);
    }
  };

  const handleAutoReturnToGarage = (vehicleId: string) => {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) return;
    const emp = employees.find((e) => e.id === veh.currentDriverId) || employees[0];
    const timestamp = nowTimeStr();
    const tripDistance = 16.4;
    const startKm = Number((veh.cumulativeGpsKm - tripDistance).toFixed(1));
    const endKm = Number(veh.cumulativeGpsKm.toFixed(1));
    const autoLot = `Northpark Lot A #${veh.fleetNumber.toString().padStart(2, '0')}`;

    setReservations((prev) =>
      prev.map((r) =>
        r.vehicleId === vehicleId && r.stage === 'IN_USE'
          ? {
              ...r,
              stage: 'RETURNED',
              returnedAt: timestamp,
              endOdometerKm: endKm,
              returnParkingZone: autoLot,
              keyReturnedToBox: true,
              notes: `차고지 지오펜스 복귀 + 블루투스 해제로 무조작 자동 반납 완료 (+${tripDistance}km)`,
            }
          : r
      )
    );

    const newTaxRow: TaxLogEntry = {
      id: `tax-${Date.now()}`,
      date: '2026-10-20',
      plateNumber: `${veh.plateNumber} (${veh.fleetNumber}호차)`,
      modelName: veh.modelName,
      department: emp.department.split(' (')[0],
      driverName: emp.name,
      authType: veh.status === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'PRE_REGISTERED',
      purpose: veh.tripPurpose || '일반업무/외근',
      startTime: veh.tripStartedAt?.slice(0, 5) || '19:50',
      endTime: timestamp.slice(0, 5),
      startOdometerKm: startKm,
      endOdometerKm: endKm,
      distanceKm: tripDistance,
      autoReturnVerified: true,
    };

    setTaxLogs((prev) => [newTaxRow, ...prev]);
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              status: 'IDLE',
              speedKmh: 0,
              currentGForce: 1.0,
              rssiDbm: -95,
              currentDriverId: null,
              coPassengerIds: [],
              driverSelectionReason: null,
              tripPurpose: null,
              tripStartedAt: null,
              lastVerifiedOdometerKm: endKm,
              parkingZone: `${autoLot} (자동반납 완료)`,
              lat: 32.6912 + ((v.fleetNumber % 6) - 2.5) * 0.0012,
              lng: -85.3298 + (Math.floor(v.fleetNumber / 6) - 2.5) * 0.0014,
            }
          : v
      )
    );
    setPushStream((prev) => [
      {
        id: `push-${Date.now()}`,
        time: timestamp,
        target: 'MANAGER',
        message: `🅿️ [무조작 자동 반납] ${veh.fleetNumber}호차(${veh.plateNumber})가 4400 Northpark Dr(Opelika, AL) 차고지 복귀 및 시동 종료되어 자동 반납되었습니다.`,
        level: 'INFO',
      },
      ...prev,
    ]);
  };

  const handleExportTaxCsv = () => {
    const headers = [
      '운행일자',
      '차량번호',
      '차종',
      '부서',
      '운전자',
      '반출유형',
      '운행목적',
      '출발시각',
      '도착시각',
      '출발주행거리(km)',
      '도착주행거리(km)',
      '주행거리(km)',
      '차고지자동반납검증',
    ];
    const rows = taxLogs.map((row) => [
      row.date,
      row.plateNumber,
      row.modelName,
      row.department,
      row.driverName,
      row.authType,
      row.purpose,
      row.startTime,
      row.endTime,
      row.startOdometerKm,
      row.endOdometerKm,
      row.distanceKm,
      row.autoReturnVerified ? 'Y' : 'N',
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `법인차량30대_운행기록부_Opelika_AL_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#FAFAFA] pb-12">
      {/* Vercel Geist Minimal Header with 4 Separated Tabs + KOR/ENG Toggle */}
      <header
        className="sticky top-0 z-40 bg-[#000000]/90 backdrop-blur-xl px-4 lg:px-8 py-2.5"
        style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 1px 0px 0px' }}
      >
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Minimal Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FAFAFA] flex items-center justify-center">
              <Radar className="w-4 h-4 text-[#000000]" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-[#FAFAFA]">
              FLEETGUARD 30
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#111111] text-[#A1A1AA]">
              Opelika, AL
            </span>
          </div>

          {/* Center: 4 Primary Navigation Tabs */}
          <div
            className="flex flex-wrap items-center bg-[#0A0A0A] p-1 rounded-lg gap-1"
            style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
          >
            <button
              type="button"
              onClick={() => setViewMode('EMPLOYEE_OPS')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'EMPLOYEE_OPS'
                  ? 'bg-[#FAFAFA] text-[#0A0A0A] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              {isEng ? '1. Request & Return' : '1. 차량 신청 · 반납'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIVE_MONITOR')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'LIVE_MONITOR'
                  ? 'bg-[#FAFAFA] text-[#0A0A0A] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {isEng ? '2. 30-Fleet Telemetry' : '2. 30대 실시간 관제'}
            </button>
            <button
              type="button"
              onClick={handleOpenAdminConsole}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'ADMIN_CONSOLE'
                  ? 'bg-[#FAFAFA] text-[#0A0A0A] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              {isAdminUnlocked ? (
                <Settings2 className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-[#FBBF24]" />
              )}
              {isEng
                ? `3. Admin Console ${isAdminUnlocked ? '' : '(PIN)'}`
                : `3. 관리자 설정 ${isAdminUnlocked ? '' : '(PIN)'}`}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GUIDE_MANUAL')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'GUIDE_MANUAL'
                  ? 'bg-[#FAFAFA] text-[#0A0A0A] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isEng ? '4. Guide & Manual' : '4. 가이드 · 매뉴얼'}
            </button>
          </div>

          {/* Right: KOR / ENG Toggle + Minimal Status Controls */}
          <div className="flex items-center gap-1.5">
            {/* Top-Level KOR / ENG Language Switcher */}
            <div
              className="flex items-center bg-[#0A0A0A] p-0.5 rounded-md text-[11px] font-mono"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.14) 0px 0px 0px 1px' }}
              role="group"
              aria-label="Language Selector"
            >
              <Globe className="w-3 h-3 text-[#71717A] ml-1.5 mr-1" />
              <button
                type="button"
                onClick={() => setLang('KOR')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  lang === 'KOR'
                    ? 'bg-[#FAFAFA] text-[#0A0A0A]'
                    : 'text-[#71717A] hover:text-[#FAFAFA]'
                }`}
              >
                KOR
              </button>
              <button
                type="button"
                onClick={() => setLang('ENG')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  lang === 'ENG'
                    ? 'bg-[#0A72EF] text-white'
                    : 'text-[#71717A] hover:text-[#FAFAFA]'
                }`}
              >
                ENG
              </button>
            </div>

            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0A0A0A] text-[11px] font-mono"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  dbSyncState === 'SAVING' ? 'bg-[#FBBF24] animate-pulse' : 'bg-[#10B981]'
                }`}
              />
              <span className="text-[#A1A1AA]">
                {dbSyncState === 'SAVING'
                  ? isEng
                    ? 'Saving'
                    : '저장중'
                  : isEng
                    ? 'DB Synced'
                    : 'DB 동기화'}
              </span>
              <button
                type="button"
                onClick={handleResetDatabase}
                title={isEng ? 'Reset DB' : 'DB 초기화'}
                className="ml-1 text-[#71717A] hover:text-[#FAFAFA]"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLiveTelemetryTick((p) => !p)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1 transition ${
                liveTelemetryTick
                  ? 'bg-[#10B981]/15 text-[#34D399]'
                  : 'bg-[#0A0A0A] text-[#71717A]'
              }`}
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <Activity className="w-3 h-3" />
              {liveTelemetryTick ? 'LIVE' : 'PAUSED'}
            </button>

            <button
              type="button"
              onClick={handleExportTaxCsv}
              className="px-2.5 py-1 rounded-md bg-[#0A0A0A] hover:bg-white/[0.06] text-[11px] font-mono text-[#FAFAFA] flex items-center gap-1 transition"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <Download className="w-3 h-3 text-[#0A72EF]" />
              CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 pt-4 space-y-4">
        {/* ============================================================================
            TAB 1 (DEFAULT): 임직원 차량 신청 · 반납 운영화면 (설명 문구 제거 · 초간결 UI)
            ============================================================================ */}
        {viewMode === 'EMPLOYEE_OPS' ? (
          <div className="space-y-4">
            {/* Single-Line Compact Status Bar */}
            <div
              className="rounded-xl bg-[#0A0A0A] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <div className="flex flex-wrap items-center gap-3 font-mono">
                <span className="text-[#FAFAFA] font-semibold font-sans">
                  {isEng
                    ? 'Employee Vehicle Request & Return'
                    : '임직원 차량 신청 · 반납'}
                </span>
                <span className="text-white/15">|</span>
                <span className="text-[#34D399]">
                  {isEng ? `Available ${counts.idle}` : `대기 ${counts.idle}대`}
                </span>
                <span className="text-[#FBBF24]">
                  {isEng ? `Pending ${counts.pendingApproval}` : `승인대기 ${counts.pendingApproval}건`}
                </span>
                <span className="text-[#60A5FA]">
                  {isEng ? `Approved ${counts.approvedReady}` : `승인완료 ${counts.approvedReady}건`}
                </span>
                <span className="text-[#A1A1AA]">
                  {isEng ? `In Use ${counts.authorized}` : `운행중 ${counts.authorized}대`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setViewMode('GUIDE_MANUAL')}
                className="text-xs font-mono text-[#60A5FA] hover:underline flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {isEng
                  ? 'View Vehicle Pairing Infographic & Manual →'
                  : '차량 연결 인포그래픽 · 매뉴얼 보기 →'}
              </button>
            </div>

            {/* 2-Column Minimal Operations Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left 4 Cols: Employee Mobile App */}
              <div className="lg:col-span-4">
                <EmployeePhoneSimulator
                  lang={lang}
                  vehicles={vehicles}
                  employees={employees}
                  reservations={reservations}
                  onCreateRequest={handleCreateRequest}
                  onApproveRequest={handleApproveRequest}
                  onStartUsingVehicle={handleStartUsingVehicle}
                  onReturnVehicle={handleReturnVehicle}
                  onAuthorizedCheckout={handleAuthorizedCheckout}
                  onUnauthorizedKeyTheft={handleUnauthorizedKeyTheft}
                  onLateReasonSubmit={handleLateReasonSubmit}
                  onSimulateCrashOrDrop={handleSimulateCrashOrDrop}
                  onTogglePermissionEvasion={handleTogglePermissionEvasion}
                  onAutoReturnToGarage={handleAutoReturnToGarage}
                />
              </div>

              {/* Right 8 Cols: Reservation Board + Compact Feed */}
              <div className="lg:col-span-8 space-y-4">
                <div
                  className="rounded-xl bg-[#0A0A0A] overflow-hidden"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                >
                  <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#FAFAFA]">
                      {isEng
                        ? 'Dispatch Request · Approval · Active · Return Board'
                        : '배차 신청 · 승인 · 운행 · 반납 목록'}
                    </span>
                    <span className="text-[11px] font-mono text-[#71717A]">
                      {isEng ? `Total ${reservations.length}` : `총 ${reservations.length}건`}
                    </span>
                  </div>
                  <ReservationWorkflowPanel
                    lang={lang}
                    reservations={reservations}
                    vehicles={vehicles}
                    employees={employees}
                    autoApproveWhenManagerAway={policyConfig.autoApproveWhenManagerAway}
                    onToggleAutoApprove={() =>
                      setPolicyConfig((prev) => ({
                        ...prev,
                        autoApproveWhenManagerAway: !prev.autoApproveWhenManagerAway,
                      }))
                    }
                    onCreateRequest={handleCreateRequest}
                    onApproveRequest={handleApproveRequest}
                    onRejectRequest={handleRejectRequest}
                    onStartUsingVehicle={handleStartUsingVehicle}
                    onReturnVehicle={handleReturnVehicle}
                  />
                </div>

                {/* Compact 3-Item Recent Log */}
                <div
                  className="rounded-xl bg-[#0A0A0A] p-3.5"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] text-xs">
                    <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-[#10B981]" />
                      {isEng ? 'Recent Notifications' : '최근 알림'}
                    </span>
                    <span className="text-[10px] font-mono text-[#71717A]">
                      {isEng ? `${pushStream.length} events` : `${pushStream.length}건`}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 max-h-[130px] overflow-y-auto">
                    {pushStream.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="px-2.5 py-1.5 rounded-md bg-[#111111] flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-[#D4D4D8] truncate">{item.message}</span>
                        <span className="text-[10px] font-mono text-[#71717A] shrink-0">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'GUIDE_MANUAL' ? (
          /* ============================================================================
             TAB 4 (SEPARATED MENU): 가이드 · 매뉴얼 · 차량 연결 인포그래픽 전용 화면
             ============================================================================ */
          <div className="space-y-4">
            {/* Quick Action Cards for Manuals & Test Scenarios */}
            <div
              className="rounded-xl bg-[#0A0A0A] p-4 flex flex-wrap items-center justify-between gap-3"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
            >
              <div>
                <h2 className="text-sm font-semibold text-[#FAFAFA]">
                  {isEng
                    ? 'Guide · Manual · Test Scenario Center'
                    : '가이드 · 매뉴얼 · 테스트 시나리오 센터'}
                </h2>
                <p className="text-xs text-[#71717A] mt-0.5">
                  {isEng
                    ? 'Interactive Vehicle-to-Smartphone Pairing Infographic, 3-Step Onboarding Guide, Dispatch Manual & Test Scenarios.'
                    : '차량 ↔ 핸드폰 초기 연결 인포그래픽, 3단계 온보딩 가이드, 신청·승인 매뉴얼 및 실전 테스트 시나리오를 한곳에서 확인합니다.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#111111] hover:bg-white/[0.08] text-xs font-medium text-[#FAFAFA] flex items-center gap-1.5 transition"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#34D399]" />
                  {isEng ? 'New User 3-Step Guide' : '신규 이용자 3단계 가이드'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#0A72EF] hover:bg-[#0060DF] text-xs font-medium text-white flex items-center gap-1.5 transition"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {isEng ? 'Request & Approval Manual' : '신청·승인 매뉴얼 다운로드'}
                </button>
                <a
                  href="/test-scenarios.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-xs font-medium text-white flex items-center gap-1.5 transition"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {isEng ? 'Test Scenarios (.HTML / Notion)' : '실전 테스트 시나리오 (.HTML / Notion)'}
                </a>
              </div>
            </div>

            {/* Vehicle-to-Smartphone Infographic */}
            <VehiclePhoneSetupInfographic lang={lang} />
          </div>
        ) : viewMode === 'ADMIN_CONSOLE' && isAdminUnlocked ? (
          /* ============================================================================
             TAB 3: 시스템 관리자 설정 콘솔 (Requires Security PIN)
             ============================================================================ */
          <AdminManagementConsole
            vehicles={vehicles}
            employees={employees}
            incidents={incidents}
            policyConfig={policyConfig}
            onUpdateVehicleMac={handleUpdateVehicleMac}
            onAuditVehicleOdometer={handleAuditVehicleOdometer}
            onToggleVehicleLock={handleToggleVehicleLock}
            onToggleEmployeeDispatch={handleToggleEmployeeDispatch}
            onSendPermissionWarningPush={handleSendPermissionWarningPush}
            onAddEmployee={handleAddEmployee}
            onBulkImportVehicles={handleBulkImportVehicles}
            onBulkImportEmployees={handleBulkImportEmployees}
            onResolveIncident={handleResolveIncident}
            onUpdatePolicyConfig={(nextCfg) => setPolicyConfig(nextCfg)}
            onLockAdminConsole={() => {
              setIsAdminUnlocked(false);
              setViewMode('EMPLOYEE_OPS');
            }}
            onOpenManual={() => setIsManualOpen(true)}
          />
        ) : (
          /* ============================================================================
             TAB 2: 관리자용 30대 실시간 관제 대시보드 (Vercel Geist Minimal)
             ============================================================================ */
          <div className="space-y-4">
            {/* Compact 4-Metric Geist Bar */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('UNAUTHORIZED');
                  setActiveTab('FLEET_MATRIX');
                }}
                className="text-left rounded-xl bg-[#0A0A0A] p-3.5 hover:bg-[#111111] transition"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#FF5B4F]">
                  <span>{isEng ? 'Unauthorized Trips' : '미승인 무단운행'}</span>
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#FAFAFA]">
                    {counts.unauthorized}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng ? 'units' : '대'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NO_DASHCAM_INCIDENTS')}
                className="text-left rounded-xl bg-[#0A0A0A] p-3.5 hover:bg-[#111111] transition"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#FBBF24]">
                  <span>{isEng ? 'Crash & Permission Audit' : '충격·권한 감사'}</span>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#FAFAFA]">
                    {counts.incident}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng
                      ? `events (BT/GPS OFF: ${counts.permissionEvasion})`
                      : `건 (권한OFF ${counts.permissionEvasion}명)`}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('DISPATCH_WORKFLOW')}
                className="text-left rounded-xl bg-[#0A0A0A] p-3.5 hover:bg-[#111111] transition"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#60A5FA]">
                  <span>{isEng ? 'Authorized Active' : '정식 승인 운행'}</span>
                  <Car className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#FAFAFA]">
                    {counts.authorized}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng
                      ? `units (Pending: ${counts.pendingApproval})`
                      : `대 (대기 ${counts.pendingApproval}건)`}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('IDLE');
                  setActiveTab('FLEET_MATRIX');
                }}
                className="text-left rounded-xl bg-[#0A0A0A] p-3.5 hover:bg-[#111111] transition"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#34D399]">
                  <span>{isEng ? 'Parked in Garage' : '차고지 대기중'}</span>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#FAFAFA]">
                    {counts.idle}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng ? '/ 30 units' : '/ 30대'}
                  </span>
                </div>
              </button>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 8 Cols */}
              <div className="lg:col-span-8 space-y-4">
                <TeslaTelemetryMap
                  lang={lang}
                  vehicles={vehicles}
                  employees={employees}
                  selectedVehicle={selectedVehicle}
                  onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
                  latestIncidentForSelected={latestIncidentForSelected}
                />

                {/* Minimal Cockpit Tabs */}
                <div
                  className="rounded-xl bg-[#0A0A0A] overflow-hidden"
                  style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2.5 border-b border-white/[0.08]">
                    <div className="flex flex-wrap gap-1">
                      {[
                        {
                          id: 'DISPATCH_WORKFLOW' as CockpitTab,
                          label: isEng
                            ? `Dispatch (${reservations.length})`
                            : `배차 (${reservations.length})`,
                        },
                        {
                          id: 'FLEET_MATRIX' as CockpitTab,
                          label: isEng
                            ? `30 Vehicles (${vehicles.length})`
                            : `30대 차량 (${vehicles.length})`,
                        },
                        {
                          id: 'NO_DASHCAM_INCIDENTS' as CockpitTab,
                          label: isEng
                            ? `Incidents (${incidents.length})`
                            : `사고·무단 (${incidents.length})`,
                        },
                        {
                          id: 'ANTI_EVASION' as CockpitTab,
                          label: isEng
                            ? `Ghost Trips (${ghostTrips.length})`
                            : `유령주행 (${ghostTrips.length})`,
                        },
                        {
                          id: 'TAX_LOGBOOK' as CockpitTab,
                          label: isEng
                            ? `IRS Mileage Log (${taxLogs.length})`
                            : `운행일지 (${taxLogs.length})`,
                        },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
                            activeTab === tab.id
                              ? 'border-[#3E6AE1] text-[#F4F6F8] bg-[#191E2A]/60'
                              : 'border-transparent text-[#9BA3B0] hover:text-[#F4F6F8]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {activeTab === 'FLEET_MATRIX' && (
                      <div className="flex items-center gap-1 pb-2">
                        <Filter className="w-3.5 h-3.5 text-[#9BA3B0] mr-1" />
                        {(
                          [
                            { key: 'ALL', label: isEng ? 'All 30' : '전체 30대' },
                            { key: 'UNAUTHORIZED', label: isEng ? 'Unauth' : '무단운행' },
                            { key: 'INCIDENT', label: isEng ? 'Incident' : '사고/충격' },
                            { key: 'AUTHORIZED', label: isEng ? 'Active' : '정상운행' },
                            { key: 'IDLE', label: isEng ? 'Idle' : '대기중' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setStatusFilter(f.key)}
                            className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                              statusFilter === f.key
                                ? 'bg-[#3E6AE1] text-white'
                                : 'bg-[#191E2A] text-[#9BA3B0] hover:text-white'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* TAB 0: 4-Stage Dispatch Workflow */}
                  {activeTab === 'DISPATCH_WORKFLOW' && (
                    <ReservationWorkflowPanel
                      lang={lang}
                      reservations={reservations}
                      vehicles={vehicles}
                      employees={employees}
                      autoApproveWhenManagerAway={policyConfig.autoApproveWhenManagerAway}
                      onToggleAutoApprove={() =>
                        setPolicyConfig((prev) => ({
                          ...prev,
                          autoApproveWhenManagerAway: !prev.autoApproveWhenManagerAway,
                        }))
                      }
                      onCreateRequest={handleCreateRequest}
                      onApproveRequest={handleApproveRequest}
                      onRejectRequest={handleRejectRequest}
                      onStartUsingVehicle={handleStartUsingVehicle}
                      onReturnVehicle={handleReturnVehicle}
                    />
                  )}

                  {/* TAB 1: 30-Vehicle Matrix */}
                  {activeTab === 'FLEET_MATRIX' && (
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 max-h-[420px] overflow-y-auto">
                      {filteredVehicles.map((veh) => {
                        const isSelected = veh.id === selectedVehicle.id;
                        const driver = employees.find((e) => e.id === veh.currentDriverId);
                        const cardStyle =
                          veh.status === 'INCIDENT'
                            ? 'bg-[#E82127]/15 border-[#E82127]'
                            : veh.status === 'UNAUTHORIZED'
                              ? 'bg-[#E82127]/10 border-[#E82127]/80'
                              : veh.status === 'AUTHORIZED'
                                ? 'bg-[#3E6AE1]/10 border-[#3E6AE1]/50'
                                : 'bg-[#191E2A] border-white/5 hover:border-white/20';

                        return (
                          <button
                            key={veh.id}
                            type="button"
                            onClick={() => setSelectedVehicleId(veh.id)}
                            className={`text-left p-2.5 rounded-xl border transition flex flex-col justify-between ${cardStyle} ${
                              isSelected ? 'ring-2 ring-white' : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-semibold text-[#9BA3B0]">
                                  {isEng
                                    ? `Unit #${veh.fleetNumber.toString().padStart(2, '0')}`
                                    : `#${veh.fleetNumber.toString().padStart(2, '0')}호차`}
                                </span>
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    veh.status === 'INCIDENT' || veh.status === 'UNAUTHORIZED'
                                      ? 'bg-[#E82127] animate-ping'
                                      : veh.status === 'AUTHORIZED'
                                        ? 'bg-[#3E6AE1]'
                                        : 'bg-[#12B76A]'
                                  }`}
                                />
                              </div>
                              <div className="text-xs font-semibold text-[#F4F6F8] mt-1">
                                {veh.plateNumber}
                              </div>
                              <div className="text-[10px] text-[#9BA3B0] truncate">
                                {veh.modelName}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                              <span className="truncate max-w-[90px] text-[#F4F6F8]">
                                {driver
                                  ? formatEmpName(driver.name, lang)
                                  : isEng
                                    ? 'Standby'
                                    : '대기중'}
                              </span>
                              <span
                                className={`tabular-nums ${
                                  veh.status === 'UNAUTHORIZED' || veh.status === 'INCIDENT'
                                    ? 'text-[#FF8080] font-semibold'
                                    : 'text-[#9BA3B0]'
                                }`}
                              >
                                {veh.speedKmh > 0 ? `${veh.speedKmh}km/h` : '0km/h'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB 2: No-Dashcam Smartphone Incident Timeline */}
                  {activeTab === 'NO_DASHCAM_INCIDENTS' && (
                    <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                      {incidents.map((inc) => (
                        <div
                          key={inc.id}
                          className="p-3.5 rounded-xl bg-[#191E2A] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E82127]/20 text-[#FF8080] border border-[#E82127]/40">
                                {inc.occurredAt}
                              </span>
                              <span className="text-xs font-mono font-semibold text-[#3E6AE1]">
                                {inc.plateNumber}
                              </span>
                              <span className="text-xs font-semibold text-[#F4F6F8]">
                                {isEng ? 'Driver:' : '운전자:'} {formatEmpName(inc.driverName, lang)}
                              </span>
                              {inc.coPassengerNames.length > 0 && (
                                <span className="text-[11px] text-[#F79009] font-mono">
                                  + {inc.coPassengerNames.join(', ')}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-[#F4F6F8]">{inc.title}</h4>
                            <p className="text-xs text-[#9BA3B0] leading-relaxed">{inc.description}</p>
                            <div className="text-[11px] font-mono text-[#636B78] pt-1">
                              📍 {inc.locationLabel}
                              {inc.gForce &&
                                ` · IMU: ${inc.gForce}G (Δv=${inc.deltaSpeedKmh}km/h, Yaw=${inc.gyroYawDegPerSec || 0}°/s)`}
                            </div>
                          </div>

                          <div className="flex md:flex-col items-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVehicleId(inc.vehicleId);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#3E6AE1]/20 hover:bg-[#3E6AE1]/30 text-[#7EA0FF] border border-[#3E6AE1]/40 text-xs font-mono"
                            >
                              {isEng ? 'Focus Telemetry' : '차량 텔레메트리 보기'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAdminConsole()}
                              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#9BA3B0] text-[11px] font-mono"
                            >
                              {isEng ? 'Admin Action' : '관리자 처분 화면 이동'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: 3-Layer Anti-Evasion & Ghost Trip Suspect Correlation */}
                  {activeTab === 'ANTI_EVASION' && (
                    <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
                      {ghostTrips.map((gt) => (
                        <div
                          key={gt.id}
                          className="p-3.5 rounded-xl bg-[#F79009]/10 border border-[#F79009]/40 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-[#F79009]" />
                              <span className="text-xs font-semibold text-[#FDB022]">
                                {isEng
                                  ? `Ghost Trip Detected: ${gt.plateNumber} (${gt.modelName})`
                                  : `유령 주행(Ghost Trip) 자동 탐지: ${gt.plateNumber} (${gt.modelName})`}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-[#FDB022]">
                              {isEng
                                ? `Gap: ${gt.windowStart} ~ ${gt.windowEnd} · Unaccounted +${gt.unaccountedKm}km`
                                : `공백 시간: ${gt.windowStart} ~ ${gt.windowEnd} · 미기록 주행거리 +${gt.unaccountedKm}km`}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {gt.suspectEmployees.map((sus) => (
                              <div
                                key={sus.employeeId}
                                className="p-2.5 rounded-lg bg-[#0B0D10]/90 border border-white/10"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[#F4F6F8]">
                                    {formatEmpName(sus.name, lang)} ({formatDeptName(sus.department, lang)})
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                                      sus.confidenceScore >= 80
                                        ? 'bg-[#E82127]/20 text-[#FF8080]'
                                        : 'bg-white/10 text-[#9BA3B0]'
                                    }`}
                                  >
                                    {isEng ? `Match ${sus.confidenceScore}%` : `일치율 ${sus.confidenceScore}%`}
                                  </span>
                                </div>
                                <ul className="mt-1.5 space-y-1 text-[11px] text-[#9BA3B0] list-disc list-inside">
                                  {sus.evidence.map((ev, i) => (
                                    <li key={i}>{ev}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[#191E2A] border border-white/5">
                          <h4 className="text-xs font-mono uppercase text-[#9BA3B0] mb-2 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#3E6AE1]" />
                            {isEng ? 'Driver App Permission Heartbeat' : '운전자 앱 권한 하트비트 감시 현황'}
                          </h4>
                          <div className="space-y-1.5">
                            {employees.map((emp) => (
                              <div
                                key={emp.id}
                                className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-none"
                              >
                                <span>
                                  {formatEmpName(emp.name, lang)}{' '}
                                  <span className="text-[11px] text-[#9BA3B0]">
                                    ({formatDeptName(emp.department, lang)})
                                  </span>
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                                    emp.permissionStatus === 'OK'
                                      ? 'bg-[#12B76A]/15 text-[#32D583]'
                                      : 'bg-[#E82127]/20 text-[#FF8080]'
                                  }`}
                                >
                                  {emp.permissionStatus} · {emp.lastHeartbeatAt}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#191E2A] border border-white/5">
                          <h4 className="text-xs font-mono uppercase text-[#9BA3B0] mb-2 flex items-center gap-1.5">
                            <Bluetooth className="w-3.5 h-3.5 text-[#12B76A]" />
                            {isEng
                              ? '4400 Northpark Dr (150m) & Keybox (3m) Logs'
                              : '4400 Northpark Dr (150m) · 키보관함 (3m) 출입 로그'}
                          </h4>
                          <div className="space-y-2">
                            {geofenceLogs.slice(0, 5).map((log) => (
                              <div key={log.id} className="text-[11px] border-b border-white/5 pb-1.5">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="text-[#F4F6F8] font-semibold">
                                    [{log.timestamp}] {formatEmpName(log.employeeName, lang)} ({log.zoneType})
                                  </span>
                                  <span
                                    className={
                                      log.permissionState === 'OK' ? 'text-[#12B76A]' : 'text-[#E82127]'
                                    }
                                  >
                                    {log.permissionState}
                                  </span>
                                </div>
                                <p className="text-[#9BA3B0] mt-0.5">{log.note}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Auto-Generated Tax & Audit Logbook */}
                  {activeTab === 'TAX_LOGBOOK' && (
                    <div className="p-4 max-h-[420px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-[#9BA3B0]">
                          {isEng
                            ? 'IRS Sec. 274(d) compliant mileage logbook automatically generated upon garage geofence return.'
                            : '차량 반납(수동 반납 또는 4400 Northpark Dr 차고지 복귀 자동 반납) 시 GPS 주행거리가 자동 적산되어 기록됩니다.'}
                        </p>
                        <button
                          type="button"
                          onClick={handleExportTaxCsv}
                          className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-medium flex items-center gap-1.5 shrink-0"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          {isEng ? 'Download CSV' : '엑셀(CSV) 다운로드'}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/10 text-[11px] font-mono text-[#9BA3B0]">
                              <th className="py-2 px-2">{isEng ? 'Date' : '일자'}</th>
                              <th className="py-2 px-2">{isEng ? 'Vehicle' : '차량번호'}</th>
                              <th className="py-2 px-2">{isEng ? 'Driver / Dept' : '부서 / 운전자'}</th>
                              <th className="py-2 px-2">{isEng ? 'Auth Type' : '반출유형'}</th>
                              <th className="py-2 px-2">{isEng ? 'Purpose' : '운행목적'}</th>
                              <th className="py-2 px-2">{isEng ? 'Time' : '시간'}</th>
                              <th className="py-2 px-2 text-right">{isEng ? 'Distance' : '주행거리'}</th>
                              <th className="py-2 px-2 text-center">{isEng ? 'Verified' : '반납검증'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-mono">
                            {taxLogs.map((row) => (
                              <tr key={row.id} className="hover:bg-white/[0.02]">
                                <td className="py-2 px-2 text-[#9BA3B0]">{row.date}</td>
                                <td className="py-2 px-2 text-[#F4F6F8] font-semibold">
                                  {row.plateNumber}
                                </td>
                                <td className="py-2 px-2 font-sans">
                                  {formatEmpName(row.driverName, lang)} ({formatDeptName(row.department, lang)})
                                </td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] ${
                                      row.authType === 'PRE_REGISTERED'
                                        ? 'bg-[#12B76A]/15 text-[#32D583]'
                                        : row.authType === 'LATE_REGISTERED'
                                          ? 'bg-[#F79009]/20 text-[#FDB022]'
                                          : 'bg-[#E82127]/20 text-[#FF8080]'
                                    }`}
                                  >
                                    {row.authType === 'PRE_REGISTERED'
                                      ? isEng
                                        ? 'Approved'
                                        : '사전승인'
                                      : row.authType === 'LATE_REGISTERED'
                                        ? isEng
                                          ? 'Late Entry'
                                          : '선출발후보고'
                                        : isEng
                                          ? 'Unauth'
                                          : '무단반출'}
                                  </span>
                                </td>
                                <td className="py-2 px-2 font-sans">
                                  {formatTripPurpose(row.purpose, lang)}
                                </td>
                                <td className="py-2 px-2 text-[#9BA3B0]">
                                  {row.startTime}~{row.endTime}
                                </td>
                                <td className="py-2 px-2 text-right text-[#F4F6F8] tabular-nums">
                                  {row.distanceKm.toFixed(1)} km
                                </td>
                                <td className="py-2 px-2 text-center text-[#12B76A]">
                                  <CheckCircle className="w-3.5 h-3.5 inline" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 4 Cols: Interactive BYOD Employee Smartphone Simulator + Live Push Stream */}
              <div className="lg:col-span-4 space-y-5">
                <EmployeePhoneSimulator
                  lang={lang}
                  vehicles={vehicles}
                  employees={employees}
                  reservations={reservations}
                  onCreateRequest={handleCreateRequest}
                  onApproveRequest={handleApproveRequest}
                  onStartUsingVehicle={handleStartUsingVehicle}
                  onReturnVehicle={handleReturnVehicle}
                  onAuthorizedCheckout={handleAuthorizedCheckout}
                  onUnauthorizedKeyTheft={handleUnauthorizedKeyTheft}
                  onLateReasonSubmit={handleLateReasonSubmit}
                  onSimulateCrashOrDrop={handleSimulateCrashOrDrop}
                  onTogglePermissionEvasion={handleTogglePermissionEvasion}
                  onAutoReturnToGarage={handleAutoReturnToGarage}
                />

                {/* Bilateral Real-Time Alert Stream */}
                <div
                  className="rounded-xl bg-[#131720] p-4 border border-white/10"
                  style={{
                    boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px',
                  }}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                    <span className="text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-[#E82127]" />
                      {isEng
                        ? 'Live Push Stream (Manager ↔ Driver)'
                        : '실시간 양방향 푸시 알림 스트림 (관리자 ↔ 운전자)'}
                    </span>
                    <span className="text-[10px] font-mono text-[#9BA3B0]">
                      {pushStream.length} EVENTS
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {pushStream.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          item.level === 'CRITICAL'
                            ? 'bg-[#E82127]/10 border-[#E82127]/30 text-[#FFD6D6]'
                            : 'bg-[#191E2A] border-white/5 text-[#D0D5DD]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              item.target === 'MANAGER'
                                ? 'bg-[#3E6AE1]/30 text-[#9BC1FF]'
                                : 'bg-[#F79009]/30 text-[#FDB022]'
                            }`}
                          >
                            {item.target === 'MANAGER'
                              ? isEng
                                ? 'TO MANAGER'
                                : '관리자 수신'
                              : isEng
                                ? 'TO DRIVER'
                                : '운전자 휴대폰 알림'}
                          </span>
                          <span className="text-[#9BA3B0]">{item.time}</span>
                        </div>
                        <p className="leading-relaxed">{item.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Admin Security PIN 4400 Keypad Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-[#131720] border border-white/15 p-6 space-y-5"
            style={{
              boxShadow:
                'rgba(0, 0, 0, 0.85) 0px 24px 60px, rgba(255, 255, 255, 0.1) 0px 0px 0px 1px',
            }}
          >
            <div className="text-center space-y-1.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E82127]/20 border border-[#E82127]/40 flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5 text-[#E82127]" />
              </div>
              <h3 className="text-base font-semibold text-[#F4F6F8]">
                {isEng ? 'Admin Console Security PIN' : '관리자 콘솔 보안 PIN 인증'}
              </h3>
              <p className="text-xs text-[#9BA3B0]">
                {isEng
                  ? 'Enter the 4-digit security PIN to access the Admin Console.'
                  : '관리자 화면(차량·임직원 CSV 등록, 사고 처분, 정책 변경) 접속을 위해 4자리 보안 PIN을 입력하세요.'}
              </p>
            </div>

            {/* 4-Digit PIN Indicator Dots + Direct Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyAdminPin();
              }}
              className="space-y-3"
            >
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                  setPinInput(val);
                  setPinError(null);
                  if (val.length === 4) {
                    handleVerifyAdminPin(val);
                  }
                }}
                placeholder={isEng ? '4-Digit PIN' : 'PIN 4자리 입력'}
                className="w-full text-center tracking-[0.8em] text-xl font-mono font-semibold rounded-xl bg-[#0B0D10] border border-white/15 py-3 text-[#F4F6F8] focus:outline-none focus:border-[#3E6AE1]"
              />

              {pinError && (
                <p className="text-center text-xs text-[#FF8080] font-medium">
                  {pinError}
                </p>
              )}

              {/* Interactive Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigitClick(digit)}
                    className="py-3 rounded-xl bg-[#191E2A] hover:bg-white/10 border border-white/10 text-base font-mono font-semibold text-[#F4F6F8] transition active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError(null);
                  }}
                  className="py-3 rounded-xl bg-[#191E2A] hover:bg-white/10 border border-white/10 text-xs font-mono text-[#9BA3B0] transition"
                >
                  {isEng ? 'Clear' : '지우기'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDigitClick('0')}
                  className="py-3 rounded-xl bg-[#191E2A] hover:bg-white/10 border border-white/10 text-base font-mono font-semibold text-[#F4F6F8] transition active:scale-95"
                >
                  0
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl bg-[#E82127] hover:bg-[#C91B20] text-xs font-semibold text-white transition"
                >
                  {isEng ? 'Verify' : '확인'}
                </button>
              </div>
            </form>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#9BA3B0]">
              <span className="font-mono">
                {isEng ? 'Role: Fleet Admin (Private PIN)' : '보안 등급: Fleet Admin (비공개 PIN)'}
              </span>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-[#9BA3B0] hover:text-white underline"
              >
                {isEng ? 'Cancel & Close' : '취소 및 닫기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Request & Manager Approval Manual Modal */}
      <UserApprovalManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      {/* New User 3-Step Interactive Onboarding Guide Modal */}
      <NewUserOnboardingGuide
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSelectDispatchTab={() => {
          setViewMode('EMPLOYEE_OPS');
          setActiveTab('DISPATCH_WORKFLOW');
        }}
        onOpenAdminConsole={handleOpenAdminConsole}
        onOpenFullManual={() => setIsManualOpen(true)}
      />
    </div>
  );
}
