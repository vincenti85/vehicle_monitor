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
import { EmployeePhoneSimulator, QrScanResult } from '@/components/EmployeePhoneSimulator';
import { hasUnitParam, parseUnitParam } from '@/utils/vehicleQr';
import type { FleetDataMode, FleetDatabaseSchema } from '@/lib/fleetDatabase';
import type { ActionRequest } from '@/lib/actionSchemas';
import type { EmployeeCsvRow } from '@/domain/admin';
import { useFleetSync } from '@/hooks/useFleetSync';
import { useTripPositionReporter } from '@/hooks/useTripPositionReporter';
import { TripSignalBadge } from '@/components/TripSignalBadge';
import { VehicleCsvRow, VehicleImportMode } from '@/utils/vehicleImport';
import { DispatchResult } from '@/utils/dispatchRules';
import { ReservationWorkflowPanel } from '@/components/ReservationWorkflowPanel';
import { AdminManagementConsole } from '@/components/AdminManagementConsole';
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
  // Default initial screen is the driver screen (차량 이용)
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

  // Monitoring and settings are admin screens behind one PIN unlock; the PIN modal
  // remembers which of the two was asked for and opens it after verification.
  type AdminView = 'LIVE_MONITOR' | 'ADMIN_CONSOLE';
  const [pendingAdminView, setPendingAdminView] = useState<AdminView>('ADMIN_CONSOLE');
  const openAdminView = (target: AdminView) => {
    if (isAdminUnlocked) {
      setViewMode(target);
      return;
    }
    setPendingAdminView(target);
    setPinInput('');
    setPinError(null);
    setShowPinModal(true);
  };
  const handleOpenAdminConsole = () => openAdminView('ADMIN_CONSOLE');

  // PIN is verified server-side (FLEET_ADMIN_PIN env) and kept in memory only to
  // sign admin-only writes (policy changes, DB reset) with the x-admin-pin header.
  const [adminPin, setAdminPin] = useState<string | null>(null);

  const handleVerifyAdminPin = async (candidatePin?: string) => {
    const code = (candidatePin ?? pinInput).trim();
    if (code.length !== 4) return;
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      if (res.ok) {
        setAdminPin(code);
        setIsAdminUnlocked(true);
        setShowPinModal(false);
        setPinInput('');
        setPinError(null);
        setViewMode(pendingAdminView);
        return;
      }
      setPinError(
        res.status === 503
          ? '서버에 관리자 PIN이 설정되지 않았습니다.'
          : 'PIN이 일치하지 않습니다.'
      );
    } catch {
      setPinError('서버에 연결할 수 없습니다. 다시 시도하세요.');
    }
    setTimeout(() => setPinInput(''), 350);
  };

  const handleDigitClick = (digit: string) => {
    setPinError(null);
    const next = (pinInput + digit).slice(0, 4);
    setPinInput(next);
    if (next.length === 4) {
      void handleVerifyAdminPin(next);
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

  const [dataMode, setDataMode] = useState<FleetDataMode>('DEMO');
  const [dbLastUpdated, setDbLastUpdated] = useState<string>('');
  // Outcome of the latest admin/background action, shown under the top bar
  const [actionNotice, setActionNotice] = useState<DispatchResult | null>(null);

  // Applies a full server snapshot to client state (initial load, polling, action responses)
  const applyDbSnapshot = (db: FleetDatabaseSchema) => {
    if (Array.isArray(db.vehicles) && db.vehicles.length > 0) setVehicles(db.vehicles);
    if (Array.isArray(db.employees) && db.employees.length > 0) setEmployees(db.employees);
    if (Array.isArray(db.reservations)) setReservations(db.reservations);
    if (Array.isArray(db.incidents)) setIncidents(db.incidents);
    if (Array.isArray(db.geofenceLogs)) setGeofenceLogs(db.geofenceLogs);
    if (Array.isArray(db.ghostTrips)) setGhostTrips(db.ghostTrips);
    if (Array.isArray(db.taxLogs)) setTaxLogs(db.taxLogs);
    if (db.policyConfig) setPolicyConfig(db.policyConfig);
    if (Array.isArray(db.pushStream)) setPushStream(db.pushStream);
    setDataMode(db.dataMode === 'LIVE' ? 'LIVE' : 'DEMO');
    setDbLastUpdated(db.lastUpdatedAt ? new Date(db.lastUpdatedAt).toLocaleTimeString() : '방금 전');
  };

  // Server is the source of truth: every write is one action; screens poll every 15 s
  const sync = useFleetSync(applyDbSnapshot, adminPin);
  const runAction = sync.runAction;
  // This device reports GPS for trips it started from the employee phone screen
  const tripReporter = useTripPositionReporter(reservations, runAction);

  /** Runs an action and reports failures (and, if asked, successes) in the page notice. */
  const runAndNotify = async (action: ActionRequest, notifySuccess = false): Promise<DispatchResult> => {
    const result = await runAction(action);
    if (!result.ok || notifySuccess) setActionNotice(result);
    return result;
  };

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  // 1-b. Vehicle key-tag QR deep link (?unit=NN): once hydrated, preselect that vehicle
  const [qrScan, setQrScan] = useState<QrScanResult | null>(null);
  const qrHandledRef = useRef<boolean>(false);
  useEffect(() => {
    if (!sync.hydrated || qrHandledRef.current) return;
    qrHandledRef.current = true;
    const { search, pathname, hash } = window.location;
    if (!hasUnitParam(search)) return;

    const unit = parseUnitParam(search);
    const veh = unit === null ? undefined : vehicles.find((v) => v.fleetNumber === unit);
    setQrScan({ unit, vehicleId: veh?.id ?? null, scannedAt: Date.now() });
    if (veh) setSelectedVehicleId(veh.id);
    setViewMode('EMPLOYEE_OPS');
    // Drop the param so a reload does not re-apply the scan
    window.history.replaceState(null, '', `${pathname}${hash}`);
  }, [sync.hydrated, vehicles]);

  const effectiveView: TopViewMode =
    (viewMode === 'LIVE_MONITOR' || viewMode === 'ADMIN_CONSOLE') && !isAdminUnlocked
      ? 'EMPLOYEE_OPS'
      : viewMode;

  const handleResetDatabase = async () => {
    await runAndNotify({ type: 'admin.resetDemo', payload: {} }, true);
  };

  // Admin: switch from the sample fleet to real operations (clears all demo history)
  const handleClearDemoData = (removeDemoEmployees: boolean) =>
    runAction({ type: 'admin.clearDemo', payload: { removeDemoEmployees } });

  // Keep the selected vehicle valid when the fleet list is replaced by real data
  useEffect(() => {
    if (vehicles.length > 0 && !vehicles.some((v) => v.id === selectedVehicleId)) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Subtle simulated telemetry for the DEMO fleet only. In LIVE mode positions and
  // mileage must come from real devices, never from random values.
  const isMonitorVisible = effectiveView === 'LIVE_MONITOR';
  useEffect(() => {
    if (!liveTelemetryTick || dataMode === 'LIVE' || !isMonitorVisible) return;
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
  }, [liveTelemetryTick, dataMode, isMonitorVisible]);

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

  const driverAlerts = useMemo(() => pushStream.filter((p) => p.target === 'DRIVER'), [pushStream]);

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

  // ============================================================================
  // ACTIONS — each user action is applied on the server against the latest data.
  // The server enforces every rule; these wrappers only add UI follow-ups.
  // ============================================================================

  // 4-stage dispatch lifecycle: 신청(REQUESTED) -> 승인(APPROVED) -> 사용(IN_USE) -> 반납(RETURNED)
  const handleCreateRequest = async (payload: {
    employeeId: string;
    vehicleId: string;
    purpose: TripPurpose;
    destination: string;
    plannedTimeWindow: string;
    notes: string;
  }): Promise<DispatchResult> => {
    const result = await runAction({ type: 'dispatch.request', payload });
    if (result.ok) setActiveTab('DISPATCH_WORKFLOW');
    return result;
  };

  const handleApproveRequest = (reservationId: string) =>
    runAction({ type: 'dispatch.approve', payload: { reservationId } });

  const handleRejectRequest = (reservationId: string) =>
    runAction({ type: 'dispatch.reject', payload: { reservationId } });

  const handleStartUsingVehicle = async (reservationId: string): Promise<DispatchResult> => {
    const vehicleId = reservations.find((r) => r.id === reservationId)?.vehicleId;
    const result = await runAction({ type: 'dispatch.start', payload: { reservationId } });
    if (result.ok && vehicleId) setSelectedVehicleId(vehicleId);
    return result;
  };

  /** Phone-screen start: also makes this device the trip's GPS reporter. */
  const handlePhoneStartUsingVehicle = async (reservationId: string): Promise<DispatchResult> => {
    const res = reservations.find((r) => r.id === reservationId);
    const result = await handleStartUsingVehicle(reservationId);
    if (result.ok && res) tripReporter.startTracking(res.vehicleId, res.employeeId);
    return result;
  };

  const handleReturnVehicle = async (reservationId: string, parkingZone: string, keyReturnedToBox: boolean) => {
    const tracked = tripReporter.reservationId === reservationId;
    // Final position before parking, without holding the return up for a slow GPS
    if (tracked) await Promise.race([tripReporter.sendNow(), new Promise((r) => setTimeout(r, 8_000))]);
    const result = await runAction({ type: 'dispatch.return', payload: { reservationId, parkingZone, keyReturnedToBox } });
    if (result.ok && tracked) tripReporter.stopTracking();
    return result;
  };

  const handleAuthorizedCheckout = async (
    employeeId: string,
    vehicleId: string,
    purpose: TripPurpose
  ): Promise<DispatchResult> => {
    const result = await runAction({ type: 'dispatch.quickStart', payload: { employeeId, vehicleId, purpose } });
    if (result.ok) {
      setSelectedVehicleId(vehicleId);
      tripReporter.startTracking(vehicleId, employeeId);
    }
    return result;
  };

  const handleLateReasonSubmit = (vehicleId: string, purpose: TripPurpose) =>
    runAction({ type: 'dispatch.lateReason', payload: { vehicleId, purpose } });

  const handleAutoReturnToGarage = async (vehicleId: string) => {
    const result = await runAction({ type: 'dispatch.autoReturn', payload: { vehicleId } });
    if (result.ok && tripReporter.target?.vehicleId === vehicleId) tripReporter.stopTracking();
    return result;
  };

  // Admin console (server checks the PIN on every call)
  const handleUpdateVehicleMac = (vehicleId: string, newMac: string, newBleUuid: string) =>
    runAndNotify({ type: 'vehicle.updatePairing', payload: { vehicleId, btMacAddress: newMac, bleBeaconUuid: newBleUuid } });

  const handleAuditVehicleOdometer = (vehicleId: string, actualOdometerKm: number) =>
    runAndNotify({ type: 'vehicle.auditOdometer', payload: { vehicleId, actualOdometerKm } }, true);

  const handleToggleVehicleLock = (vehicleId: string) =>
    runAndNotify({ type: 'vehicle.toggleLock', payload: { vehicleId } });

  const handleToggleEmployeeDispatch = (employeeId: string) =>
    runAndNotify({ type: 'employee.toggleDispatch', payload: { employeeId } });

  const handleSendPermissionWarningPush = (employeeId: string) =>
    runAndNotify({ type: 'employee.warn', payload: { employeeId } }, true);

  const handleAddEmployee = (empData: { name: string; role: string; department: string; phone: string }) =>
    runAndNotify({ type: 'employee.add', payload: empData }, true);

  const handleImportVehicles = (rows: VehicleCsvRow[], mode: VehicleImportMode, source: string) =>
    runAction({ type: 'vehicle.import', payload: { rows, mode, source } });

  const handleBulkImportEmployees = (rows: EmployeeCsvRow[]) =>
    runAndNotify({ type: 'employee.import', payload: { rows } }, true);

  const handleResolveIncident = (incidentId: string, resolutionNote: string, suspendDriver: boolean) =>
    runAndNotify({ type: 'incident.resolve', payload: { incidentId, resolutionNote, suspendDriver } });

  const handleUpdatePolicy = (nextConfig: SystemPolicyConfig) =>
    runAndNotify({ type: 'policy.update', payload: { policyConfig: nextConfig } });

  // Demo sensor simulations (server allows them only in DEMO mode)
  const handleUnauthorizedKeyTheft = async (
    employeeId: string,
    vehicleId: string,
    coPassengerId: string | null
  ): Promise<DispatchResult> => {
    const result = await runAction({ type: 'demo.unauthorizedStart', payload: { employeeId, vehicleId, coPassengerId } });
    if (result.ok) setSelectedVehicleId(vehicleId);
    return result;
  };

  const handleSimulateCrashOrDrop = async (vehicleId: string, isRealCrash: boolean): Promise<DispatchResult> => {
    const result = await runAction({ type: 'demo.crashOrDrop', payload: { vehicleId, isRealCrash } });
    if (result.ok && isRealCrash) {
      setSelectedVehicleId(vehicleId);
      setActiveTab('NO_DASHCAM_INCIDENTS');
    }
    return result;
  };

  const handleTogglePermissionEvasion = async (employeeId: string): Promise<DispatchResult> => {
    const turningOff = employees.find((e) => e.id === employeeId)?.permissionStatus === 'OK';
    const result = await runAction({ type: 'demo.permissionToggle', payload: { employeeId } });
    if (result.ok && turningOff) setActiveTab('ANTI_EVASION');
    return result;
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
    <div className="min-h-screen bg-[#FFFFFF] text-[#0A0A0A] pb-12">
      {/* Vercel Geist Minimal Header with 4 Separated Tabs + KOR/ENG Toggle */}
      <header
        className="sticky top-0 z-40 bg-[#FFFFFF]/90 backdrop-blur-xl px-4 lg:px-8 py-2.5"
        style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 1px 0px 0px' }}
      >
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Minimal Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0A0A0A] flex items-center justify-center">
              <Radar className="w-4 h-4 text-[#FAFAFA]" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-[#0A0A0A]">
              FLEETGUARD 30
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#FFFFFF] text-[#52525B]">
              Opelika, AL
            </span>
          </div>

          {/* Center: driver screen, then the PIN-protected admin screens */}
          <nav
            aria-label={isEng ? 'Main menu' : '메인 메뉴'}
            className="flex flex-wrap items-center bg-[#FAFAFA] p-1 rounded-lg gap-1"
            style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
          >
            <button
              type="button"
              onClick={() => setViewMode('EMPLOYEE_OPS')}
              aria-current={effectiveView === 'EMPLOYEE_OPS' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                effectiveView === 'EMPLOYEE_OPS'
                  ? 'bg-[#0A0A0A] text-[#FAFAFA] font-semibold'
                  : 'text-[#52525B] hover:text-[#0A0A0A]'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              {isEng ? 'Use a Car' : '차량 이용'}
            </button>
            <span className="mx-1 h-4 w-px bg-black/15" aria-hidden />
            <span className="pl-1 pr-0.5 text-[10px] font-mono text-[#71717A] flex items-center gap-1">
              {isAdminUnlocked ? (
                <ShieldCheck className="w-3 h-3 text-[#047857]" />
              ) : (
                <Lock className="w-3 h-3 text-[#B45309]" />
              )}
              {isEng ? 'Admin' : '관리자'}
            </span>
            <button
              type="button"
              onClick={() => openAdminView('LIVE_MONITOR')}
              aria-current={effectiveView === 'LIVE_MONITOR' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                effectiveView === 'LIVE_MONITOR'
                  ? 'bg-[#0A0A0A] text-[#FAFAFA] font-semibold'
                  : 'text-[#52525B] hover:text-[#0A0A0A]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {isEng ? 'Monitor' : '관제'}
              {counts.pendingApproval > 0 && (
                <span className="px-1.5 rounded-full bg-[#FBBF24] text-[#0A0A0A] text-[10px] font-mono">
                  {counts.pendingApproval}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => openAdminView('ADMIN_CONSOLE')}
              aria-current={effectiveView === 'ADMIN_CONSOLE' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                effectiveView === 'ADMIN_CONSOLE'
                  ? 'bg-[#0A0A0A] text-[#FAFAFA] font-semibold'
                  : 'text-[#52525B] hover:text-[#0A0A0A]'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              {isEng ? 'Settings' : '설정'}
            </button>
          </nav>

          {/* Right: KOR / ENG Toggle + Minimal Status Controls */}
          <div className="flex items-center gap-1.5">
            {/* Top-Level KOR / ENG Language Switcher */}
            <div
              className="flex items-center bg-[#FAFAFA] p-0.5 rounded-md text-[11px] font-mono"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.14) 0px 0px 0px 1px' }}
              role="group"
              aria-label="Language Selector"
            >
              <Globe className="w-3 h-3 text-[#71717A] ml-1.5 mr-1" />
              <button
                type="button"
                onClick={() => setLang('KOR')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  lang === 'KOR'
                    ? 'bg-[#0A0A0A] text-[#FAFAFA]'
                    : 'text-[#71717A] hover:text-[#0A0A0A]'
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
                    : 'text-[#71717A] hover:text-[#0A0A0A]'
                }`}
              >
                ENG
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('GUIDE_MANUAL')}
              aria-current={effectiveView === 'GUIDE_MANUAL' ? 'page' : undefined}
              className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 transition ${
                effectiveView === 'GUIDE_MANUAL'
                  ? 'bg-[#0A0A0A] text-[#FAFAFA]'
                  : 'bg-[#FAFAFA] text-[#0A0A0A] hover:bg-black/[0.06]'
              }`}
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              <BookOpen className="w-3 h-3" />
              {isEng ? 'Help' : '도움말'}
            </button>

            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAFAFA] text-[11px] font-mono"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sync.status === 'ERROR'
                    ? 'bg-[#DC2626]'
                    : sync.status === 'SAVING' || sync.status === 'HYDRATING'
                      ? 'bg-[#FBBF24] animate-pulse'
                      : 'bg-[#10B981]'
                }`}
              />
              <span
                className={sync.status === 'ERROR' ? 'text-[#DC2626] font-semibold' : 'text-[#52525B]'}
                title={sync.error ?? (dbLastUpdated ? `last change ${dbLastUpdated}` : undefined)}
              >
                {sync.status === 'ERROR'
                  ? sync.hydrated
                    ? isEng
                      ? 'Save failed'
                      : '저장 실패'
                    : isEng
                      ? 'Load failed'
                      : '불러오기 실패'
                  : sync.status === 'HYDRATING'
                    ? isEng
                      ? 'Loading'
                      : '불러오는 중'
                    : sync.status === 'SAVING'
                      ? isEng
                        ? 'Saving'
                        : '저장중'
                      : isEng
                        ? 'Synced'
                        : '동기화됨'}
              </span>
              {sync.status === 'ERROR' && (
                <button
                  type="button"
                  onClick={() => void sync.refresh()}
                  className="ml-1 text-[#DC2626] underline"
                >
                  {isEng ? 'Retry' : '다시 시도'}
                </button>
              )}
              {dataMode === 'DEMO' && isAdminUnlocked && sync.status !== 'ERROR' && (
                <button
                  type="button"
                  onClick={handleResetDatabase}
                  title={isEng ? 'Reset demo data' : '데모 데이터 초기화'}
                  className="ml-1 text-[#71717A] hover:text-[#0A0A0A]"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>

            {dataMode === 'LIVE' ? (
              <span
                className="px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1 bg-[#0A72EF]/10 text-[#1D4ED8]"
                title={
                  isEng
                    ? 'Real fleet data. Simulated telemetry and demo reset are disabled.'
                    : '실제 차량 데이터 운영 중. 모의 주행·데모 초기화가 꺼져 있습니다.'
                }
              >
                <ShieldCheck className="w-3 h-3" />
                {isEng ? 'LIVE DATA' : '실운영'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLiveTelemetryTick((p) => !p)}
                title={isEng ? 'Simulated telemetry (demo data)' : '모의 주행 시뮬레이션 (데모 데이터)'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1 transition ${
                  liveTelemetryTick
                    ? 'bg-[#10B981]/15 text-[#047857]'
                    : 'bg-[#FAFAFA] text-[#71717A]'
                }`}
                style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
              >
                <Activity className="w-3 h-3" />
                {liveTelemetryTick ? (isEng ? 'DEMO' : '데모') : isEng ? 'PAUSED' : '정지'}
              </button>
            )}

          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 pt-4 space-y-4">
        {actionNotice && (
          <div
            role="alert"
            data-testid="action-notice"
            className={`px-3 py-2 rounded-lg text-xs flex items-start justify-between gap-2 ${
              actionNotice.ok ? 'bg-[#10B981]/10 text-[#047857]' : 'bg-[#FF5B4F]/10 text-[#DC2626]'
            }`}
          >
            <span>{actionNotice.ok ? '✅ ' : '🚫 '}{actionNotice.message}</span>
            <button type="button" onClick={() => setActionNotice(null)} className="shrink-0 underline">
              {isEng ? 'Close' : '닫기'}
            </button>
          </div>
        )}

        {/* ============================================================================
            TAB 1 (DEFAULT): 임직원 차량 신청 · 반납 운영화면 (설명 문구 제거 · 초간결 UI)
            ============================================================================ */}
        {effectiveView === 'EMPLOYEE_OPS' ? (
          <div className="space-y-4">
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
                  onStartUsingVehicle={handlePhoneStartUsingVehicle}
                  onReturnVehicle={handleReturnVehicle}
                  onAuthorizedCheckout={handleAuthorizedCheckout}
                  tripReporter={tripReporter}
                  onUnauthorizedKeyTheft={handleUnauthorizedKeyTheft}
                  onLateReasonSubmit={handleLateReasonSubmit}
                  onSimulateCrashOrDrop={handleSimulateCrashOrDrop}
                  onTogglePermissionEvasion={handleTogglePermissionEvasion}
                  onAutoReturnToGarage={handleAutoReturnToGarage}
                  qrScan={qrScan}
                  dataMode={dataMode}
                  isAdmin={isAdminUnlocked}
                />
              </div>

              {/* Right 8 Cols: Reservation Board + Compact Feed */}
              <div className="lg:col-span-8 space-y-4">
                <div
                  className="rounded-xl bg-[#FAFAFA] overflow-hidden"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <div className="px-4 py-2.5 border-b border-black/[0.08] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0A0A0A]">
                      {isEng ? 'Dispatch Board' : '배차 현황'}
                    </span>
                    <span className="text-[11px] font-mono text-[#047857]">
                      {isEng ? `${counts.idle} available` : `대기 ${counts.idle}대`}
                    </span>
                  </div>
                  <ReservationWorkflowPanel
                    lang={lang}
                    isAdmin={isAdminUnlocked}
                    showRequestButton={false}
                    reservations={reservations}
                    vehicles={vehicles}
                    employees={employees}
                    autoApproveWhenManagerAway={policyConfig.autoApproveWhenManagerAway}
                    onToggleAutoApprove={() =>
                      void handleUpdatePolicy({
                        ...policyConfig,
                        autoApproveWhenManagerAway: !policyConfig.autoApproveWhenManagerAway,
                      })
                    }
                    onCreateRequest={handleCreateRequest}
                    onApproveRequest={handleApproveRequest}
                    onRejectRequest={handleRejectRequest}
                    onStartUsingVehicle={handleStartUsingVehicle}
                    onReturnVehicle={handleReturnVehicle}
                  />
                </div>

                {/* Driver alerts only; manager alerts stay on the admin monitor */}
                {driverAlerts.length > 0 && (
                <div
                  className="rounded-xl bg-[#FAFAFA] p-3.5"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-black/[0.08] text-xs">
                    <span className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-[#059669]" />
                      {isEng ? 'Driver Alerts' : '운전자 알림'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 max-h-[130px] overflow-y-auto">
                    {driverAlerts.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="px-2.5 py-1.5 rounded-md bg-[#FFFFFF] flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-[#3F3F46] truncate">{item.message}</span>
                        <span className="text-[10px] font-mono text-[#71717A] shrink-0">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        ) : effectiveView === 'GUIDE_MANUAL' ? (
          /* ============================================================================
             TAB 4 (SEPARATED MENU): 가이드 · 매뉴얼 · 차량 연결 인포그래픽 전용 화면
             ============================================================================ */
          <div className="space-y-4">
            {/* Quick Action Cards for Manuals & Test Scenarios */}
            <div
              className="rounded-xl bg-[#FAFAFA] p-4 flex flex-wrap items-center justify-between gap-3"
              style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
            >
              <div>
                <h2 className="text-sm font-semibold text-[#0A0A0A]">
                  {isEng ? 'Help' : '도움말'}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 transition"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
                  {isEng ? 'First-time Guide' : '처음 사용하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#0A72EF] hover:bg-[#0060DF] text-xs font-medium text-white flex items-center gap-1.5 transition"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {isEng ? 'Manual' : '매뉴얼'}
                </button>
                <a
                  href={isEng ? '/test-scenarios-en.html' : '/test-scenarios.html'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-xs font-medium text-white flex items-center gap-1.5 transition"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {isEng ? 'Test Scenarios' : '테스트 시나리오'}
                </a>
                <a
                  href={
                    isEng
                      ? '/admin-guide/Admin_Setup_Guide_ENG.html'
                      : '/admin-guide/Admin_Setup_Guide_KOR.html'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 transition"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#B45309]" />
                  {isEng ? 'Admin Setup' : '관리자 초기 세팅'}
                </a>
                <a
                  href="/admin-guide/Vehicle_QR_Setup_OnePager_KOR.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 transition"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <Download className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  {isEng ? 'QR Setup (PDF, KOR)' : 'QR 셋업 (PDF)'}
                </a>
              </div>
            </div>

            {/* Vehicle-to-Smartphone Infographic */}
            <VehiclePhoneSetupInfographic lang={lang} />
          </div>
        ) : effectiveView === 'ADMIN_CONSOLE' ? (
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
            reservations={reservations}
            dataMode={dataMode}
            onImportVehicles={handleImportVehicles}
            onClearDemoData={handleClearDemoData}
            onBulkImportEmployees={handleBulkImportEmployees}
            onResolveIncident={handleResolveIncident}
            onUpdatePolicyConfig={handleUpdatePolicy}
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
                className="text-left rounded-xl bg-[#FAFAFA] p-3.5 hover:bg-[#FFFFFF] transition"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#DC2626]">
                  <span>{isEng ? 'Unauthorized' : '무단운행'}</span>
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
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
                className="text-left rounded-xl bg-[#FAFAFA] p-3.5 hover:bg-[#FFFFFF] transition"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#B45309]">
                  <span>{isEng ? 'Incidents' : '사고'}</span>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
                    {counts.incident}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng
                      ? `· perm. off ${counts.permissionEvasion}`
                      : `건 · 권한OFF ${counts.permissionEvasion}`}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('DISPATCH_WORKFLOW')}
                className="text-left rounded-xl bg-[#FAFAFA] p-3.5 hover:bg-[#FFFFFF] transition"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#1D4ED8]">
                  <span>{isEng ? 'Active' : '운행중'}</span>
                  <Car className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
                    {counts.authorized}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng
                      ? `· pending ${counts.pendingApproval}`
                      : `대 · 승인대기 ${counts.pendingApproval}`}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('IDLE');
                  setActiveTab('FLEET_MATRIX');
                }}
                className="text-left rounded-xl bg-[#FAFAFA] p-3.5 hover:bg-[#FFFFFF] transition"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#047857]">
                  <span>{isEng ? 'Parked' : '차고지 대기'}</span>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
                    {counts.idle}
                  </span>
                  <span className="text-xs font-mono text-[#71717A]">
                    {isEng ? `/ ${vehicles.length} units` : `/ ${vehicles.length}대`}
                  </span>
                </div>
              </button>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 8 Cols */}
              <div className="lg:col-span-8 space-y-4">
                <TeslaTelemetryMap
                        showGpsSignal={dataMode === 'LIVE'}
                  lang={lang}
                  vehicles={vehicles}
                  employees={employees}
                  selectedVehicle={selectedVehicle}
                  onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
                  latestIncidentForSelected={latestIncidentForSelected}
                />

                {/* Minimal Cockpit Tabs */}
                <div
                  className="rounded-xl bg-[#FAFAFA] overflow-hidden"
                  style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2.5 border-b border-black/[0.08]">
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
                          label: isEng ? `Vehicles (${vehicles.length})` : `차량 (${vehicles.length})`,
                        },
                        {
                          id: 'NO_DASHCAM_INCIDENTS' as CockpitTab,
                          label: isEng
                            ? `Incidents (${incidents.length})`
                            : `사고 (${incidents.length})`,
                        },
                        {
                          id: 'ANTI_EVASION' as CockpitTab,
                          label: isEng
                            ? `Ghost Trips (${ghostTrips.length})`
                            : `유령주행 (${ghostTrips.length})`,
                        },
                        {
                          id: 'TAX_LOGBOOK' as CockpitTab,
                          label: isEng ? `Mileage Log (${taxLogs.length})` : `운행일지 (${taxLogs.length})`,
                        },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
                            activeTab === tab.id
                              ? 'border-[#3E6AE1] text-[#0A0A0A] bg-[#F4F4F5]/60'
                              : 'border-transparent text-[#52525B] hover:text-[#0A0A0A]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {activeTab === 'FLEET_MATRIX' && (
                      <div className="flex items-center gap-1 pb-2">
                        <Filter className="w-3.5 h-3.5 text-[#52525B] mr-1" />
                        {(
                          [
                            { key: 'ALL', label: isEng ? 'All' : '전체' },
                            { key: 'UNAUTHORIZED', label: isEng ? 'Unauth' : '무단운행' },
                            { key: 'INCIDENT', label: isEng ? 'Incident' : '사고' },
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
                                : 'bg-[#F4F4F5] text-[#52525B] hover:text-[#0A0A0A]'
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
                      isAdmin
                      reservations={reservations}
                      vehicles={vehicles}
                      employees={employees}
                      autoApproveWhenManagerAway={policyConfig.autoApproveWhenManagerAway}
                      onToggleAutoApprove={() =>
                      void handleUpdatePolicy({
                        ...policyConfig,
                        autoApproveWhenManagerAway: !policyConfig.autoApproveWhenManagerAway,
                      })
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
                                : 'bg-[#F4F4F5] border-black/5 hover:border-black/20';

                        return (
                          <button
                            key={veh.id}
                            type="button"
                            onClick={() => setSelectedVehicleId(veh.id)}
                            className={`text-left p-2.5 rounded-xl border transition flex flex-col justify-between ${cardStyle} ${
                              isSelected ? 'ring-2 ring-[#0A0A0A]' : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-semibold text-[#52525B]">
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
                              <div className="text-xs font-semibold text-[#0A0A0A] mt-1">
                                {veh.plateNumber}
                              </div>
                              <div className="text-[10px] text-[#52525B] truncate">
                                {veh.modelName}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[11px] font-mono">
                              <span className="truncate max-w-[90px] text-[#0A0A0A]">
                                {driver
                                  ? formatEmpName(driver.name, lang)
                                  : isEng
                                    ? 'Standby'
                                    : '대기중'}
                              </span>
                              <span
                                className={`tabular-nums ${
                                  veh.status === 'UNAUTHORIZED' || veh.status === 'INCIDENT'
                                    ? 'text-[#DC2626] font-semibold'
                                    : 'text-[#52525B]'
                                }`}
                              >
                                {veh.speedKmh > 0 ? `${veh.speedKmh}km/h` : '0km/h'}
                              </span>
                            </div>
                            {dataMode === 'LIVE' && <TripSignalBadge vehicle={veh} isEng={isEng} className="mt-1.5" />}
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
                          className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E82127]/20 text-[#DC2626] border border-[#E82127]/40">
                                {inc.occurredAt}
                              </span>
                              <span className="text-xs font-mono font-semibold text-[#3E6AE1]">
                                {inc.plateNumber}
                              </span>
                              <span className="text-xs font-semibold text-[#0A0A0A]">
                                {isEng ? 'Driver:' : '운전자:'} {formatEmpName(inc.driverName, lang)}
                              </span>
                              {inc.coPassengerNames.length > 0 && (
                                <span className="text-[11px] text-[#B45309] font-mono">
                                  + {inc.coPassengerNames.join(', ')}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-[#0A0A0A]">{inc.title}</h4>
                            <p className="text-xs text-[#52525B] leading-relaxed">{inc.description}</p>
                            <div className="text-[11px] font-mono text-[#6B7280] pt-1">
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
                              className="px-3 py-1.5 rounded-lg bg-[#3E6AE1]/20 hover:bg-[#3E6AE1]/30 text-[#1D4ED8] border border-[#3E6AE1]/40 text-xs font-mono"
                            >
                              {isEng ? 'Show on map' : '지도에서 보기'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewMode('ADMIN_CONSOLE')}
                              className="px-3 py-1 rounded-lg bg-black/[0.03] hover:bg-black/5 text-[#52525B] text-[11px] font-mono"
                            >
                              {isEng ? 'Resolve' : '처분하기'}
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
                              <AlertTriangle className="w-4 h-4 text-[#B45309]" />
                              <span className="text-xs font-semibold text-[#B45309]">
                                {isEng
                                  ? `Ghost Trip Detected: ${gt.plateNumber} (${gt.modelName})`
                                  : `유령 주행 의심: ${gt.plateNumber} (${gt.modelName})`}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-[#B45309]">
                              {isEng
                                ? `Gap: ${gt.windowStart} ~ ${gt.windowEnd} · Unaccounted +${gt.unaccountedKm}km`
                                : `${gt.windowStart} ~ ${gt.windowEnd} · 미기록 +${gt.unaccountedKm}km`}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {gt.suspectEmployees.map((sus) => (
                              <div
                                key={sus.employeeId}
                                className="p-2.5 rounded-lg bg-[#FAFAFA]/90 border border-black/10"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[#0A0A0A]">
                                    {formatEmpName(sus.name, lang)} ({formatDeptName(sus.department, lang)})
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                                      sus.confidenceScore >= 80
                                        ? 'bg-[#E82127]/20 text-[#DC2626]'
                                        : 'bg-black/5 text-[#52525B]'
                                    }`}
                                  >
                                    {isEng ? `Match ${sus.confidenceScore}%` : `일치율 ${sus.confidenceScore}%`}
                                  </span>
                                </div>
                                <ul className="mt-1.5 space-y-1 text-[11px] text-[#52525B] list-disc list-inside">
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
                        <div className="p-3 rounded-xl bg-[#F4F4F5] border border-black/5">
                          <h4 className="text-xs font-mono uppercase text-[#52525B] mb-2 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#3E6AE1]" />
                            {isEng ? 'App Permissions' : '앱 권한 상태'}
                          </h4>
                          <div className="space-y-1.5">
                            {employees.map((emp) => (
                              <div
                                key={emp.id}
                                className="flex items-center justify-between text-xs py-1 border-b border-black/5 last:border-none"
                              >
                                <span>
                                  {formatEmpName(emp.name, lang)}{' '}
                                  <span className="text-[11px] text-[#52525B]">
                                    ({formatDeptName(emp.department, lang)})
                                  </span>
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                                    emp.permissionStatus === 'OK'
                                      ? 'bg-[#12B76A]/15 text-[#047857]'
                                      : 'bg-[#E82127]/20 text-[#DC2626]'
                                  }`}
                                >
                                  {emp.permissionStatus} · {emp.lastHeartbeatAt}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#F4F4F5] border border-black/5">
                          <h4 className="text-xs font-mono uppercase text-[#52525B] mb-2 flex items-center gap-1.5">
                            <Bluetooth className="w-3.5 h-3.5 text-[#059669]" />
                            {isEng ? 'Garage & Keybox Log' : '차고지 · 키보관함 기록'}
                          </h4>
                          <div className="space-y-2">
                            {geofenceLogs.slice(0, 5).map((log) => (
                              <div key={log.id} className="text-[11px] border-b border-black/5 pb-1.5">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="text-[#0A0A0A] font-semibold">
                                    [{log.timestamp}] {formatEmpName(log.employeeName, lang)} ({log.zoneType})
                                  </span>
                                  <span
                                    className={
                                      log.permissionState === 'OK' ? 'text-[#059669]' : 'text-[#E82127]'
                                    }
                                  >
                                    {log.permissionState}
                                  </span>
                                </div>
                                <p className="text-[#52525B] mt-0.5">{log.note}</p>
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
                        <p className="text-xs text-[#52525B]">
                          {isEng ? 'Recorded automatically on return.' : '반납 시 자동 기록됩니다.'}
                        </p>
                        <button
                          type="button"
                          onClick={handleExportTaxCsv}
                          className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-medium flex items-center gap-1.5 shrink-0"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          {isEng ? 'CSV' : 'CSV 다운로드'}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-black/10 text-[11px] font-mono text-[#52525B]">
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
                          <tbody className="divide-y divide-black/5 font-mono">
                            {taxLogs.map((row) => (
                              <tr key={row.id} className="hover:bg-black/[0.02]">
                                <td className="py-2 px-2 text-[#52525B]">{row.date}</td>
                                <td className="py-2 px-2 text-[#0A0A0A] font-semibold">
                                  {row.plateNumber}
                                </td>
                                <td className="py-2 px-2 font-sans">
                                  {formatEmpName(row.driverName, lang)} ({formatDeptName(row.department, lang)})
                                </td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] ${
                                      row.authType === 'PRE_REGISTERED'
                                        ? 'bg-[#12B76A]/15 text-[#047857]'
                                        : row.authType === 'LATE_REGISTERED'
                                          ? 'bg-[#F79009]/20 text-[#B45309]'
                                          : 'bg-[#E82127]/20 text-[#DC2626]'
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
                                <td className="py-2 px-2 text-[#52525B]">
                                  {row.startTime}~{row.endTime}
                                </td>
                                <td className="py-2 px-2 text-right text-[#0A0A0A] tabular-nums">
                                  {row.distanceKm.toFixed(1)} km
                                </td>
                                <td className="py-2 px-2 text-center text-[#059669]">
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

              {/* Right 4 Cols: Live alert stream */}
              <div className="lg:col-span-4 space-y-5">
                {/* Bilateral Real-Time Alert Stream */}
                <div
                  className="rounded-xl bg-[#FFFFFF] p-4 border border-black/10"
                  style={{
                    boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px',
                  }}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-black/10">
                    <span className="text-xs font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-[#E82127]" />
                      {isEng ? 'Live Alerts' : '실시간 알림'}
                    </span>
                    <span className="text-[10px] font-mono text-[#52525B]">
                      {pushStream.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 max-h-[640px] overflow-y-auto pr-1">
                    {pushStream.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          item.level === 'CRITICAL'
                            ? 'bg-[#E82127]/10 border-[#E82127]/30 text-[#B91C1C]'
                            : 'bg-[#F4F4F5] border-black/5 text-[#3F3F46]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              item.target === 'MANAGER'
                                ? 'bg-[#3E6AE1]/30 text-[#1D4ED8]'
                                : 'bg-[#F79009]/30 text-[#B45309]'
                            }`}
                          >
                            {item.target === 'MANAGER'
                              ? isEng
                                ? 'Manager'
                                : '관리자'
                              : isEng
                                ? 'Driver'
                                : '운전자'}
                          </span>
                          <span className="text-[#52525B]">{item.time}</span>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] border border-black/15 p-6 space-y-5"
            style={{
              boxShadow:
                'rgba(0, 0, 0, 0.14) 0px 24px 60px, rgba(0, 0, 0, 0.1) 0px 0px 0px 1px',
            }}
          >
            <div className="text-center space-y-1.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E82127]/20 border border-[#E82127]/40 flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5 text-[#E82127]" />
              </div>
              <h3 className="text-base font-semibold text-[#0A0A0A]">
                {isEng ? 'Admin PIN' : '관리자 PIN'}
              </h3>
              <p className="text-xs text-[#52525B]">
                {isEng ? 'Unlocks Monitor and Settings.' : '관제 · 설정 화면을 엽니다.'}
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
                placeholder={isEng ? '4-digit PIN' : 'PIN 4자리'}
                className="w-full text-center tracking-[0.8em] text-xl font-mono font-semibold rounded-xl bg-[#FAFAFA] border border-black/15 py-3 text-[#0A0A0A] focus:outline-none focus:border-[#3E6AE1]"
              />

              {pinError && (
                <p className="text-center text-xs text-[#DC2626] font-medium">
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
                    className="py-3 rounded-xl bg-[#F4F4F5] hover:bg-black/5 border border-black/10 text-base font-mono font-semibold text-[#0A0A0A] transition active:scale-95"
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
                  className="py-3 rounded-xl bg-[#F4F4F5] hover:bg-black/5 border border-black/10 text-xs font-mono text-[#52525B] transition"
                >
                  {isEng ? 'Clear' : '지우기'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDigitClick('0')}
                  className="py-3 rounded-xl bg-[#F4F4F5] hover:bg-black/5 border border-black/10 text-base font-mono font-semibold text-[#0A0A0A] transition active:scale-95"
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

            <div className="pt-2 border-t border-black/10 flex justify-end text-[11px] text-[#52525B]">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-[#52525B] hover:text-[#0A0A0A] underline"
              >
                {isEng ? 'Cancel' : '취소'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Request & Manager Approval Manual Modal */}
      <UserApprovalManualModal
        lang={lang}
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      {/* New User 3-Step Interactive Onboarding Guide Modal */}
      <NewUserOnboardingGuide
        lang={lang}
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
