'use client';

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Bell,
  Bluetooth,
  BookOpen,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  FileSpreadsheet,
  Gauge,
  Lock,
  Plus,
  QrCode,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Unlock,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import {
  Employee,
  IncidentEvent,
  SystemPolicyConfig,
  Vehicle,
  VehicleReservation,
} from '@/types/fleet';
import { VehicleImportPanel } from '@/components/VehicleImportPanel';
import { VehicleFormPanel } from '@/components/VehicleFormPanel';
import { buildVehicleDeepLink, createQrSvg, resolveAppBaseUrl } from '@/utils/vehicleQr';
import type { EmployeeCsvRow } from '@/domain/admin';
import { DispatchResult } from '@/utils/dispatchRules';
import { VehicleCsvRow, VehicleImportMode } from '@/utils/vehicleImport';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface AdminManagementConsoleProps {
  vehicles: Vehicle[];
  employees: Employee[];
  incidents: IncidentEvent[];
  policyConfig: SystemPolicyConfig;
  onUpdateVehicleMac: (vehicleId: string, newMac: string, newBleUuid: string) => void;
  onAuditVehicleOdometer: (vehicleId: string, actualOdometerKm: number) => void;
  onToggleVehicleLock: (vehicleId: string) => void;
  onToggleEmployeeDispatch: (employeeId: string) => void;
  /** Issues a device link that binds the employee's phone (revokes the previous phone). */
  onIssueDeviceLink: (employeeId: string) => void;
  onSendPermissionWarningPush: (employeeId: string) => void;
  onAddEmployee: (emp: { name: string; role: string; department: string; phone: string }) => void;
  reservations: VehicleReservation[];
  dataMode: 'DEMO' | 'LIVE';
  onImportVehicles: (rows: VehicleCsvRow[], mode: VehicleImportMode, source: string) => Promise<DispatchResult>;
  onClearDemoData: (removeDemoEmployees: boolean) => Promise<{ ok: boolean; message: string }>;
  onBulkImportEmployees: (rows: EmployeeCsvRow[]) => void;
  onResolveIncident: (incidentId: string, resolutionNote: string, suspendDriver: boolean) => void;
  onUpdatePolicyConfig: (nextConfig: SystemPolicyConfig) => void;
  onLockAdminConsole: () => void;
  onOpenManual: () => void;
}

type AdminSection =
  | 'VEHICLE_MASTER'
  | 'EMPLOYEE_GOVERNANCE'
  | 'NO_DASHCAM_INCIDENTS'
  | 'SYSTEM_POLICY';

export const AdminManagementConsole: React.FC<AdminManagementConsoleProps> = ({
  vehicles,
  employees,
  incidents,
  policyConfig,
  onUpdateVehicleMac,
  onAuditVehicleOdometer,
  onToggleVehicleLock,
  onToggleEmployeeDispatch,
  onIssueDeviceLink,
  onSendPermissionWarningPush,
  onAddEmployee,
  reservations,
  dataMode,
  onImportVehicles,
  onClearDemoData,
  onBulkImportEmployees,
  onResolveIncident,
  onUpdatePolicyConfig,
  onLockAdminConsole,
  onOpenManual,
}) => {
  const [section, setSection] = useState<AdminSection>('VEHICLE_MASTER');
  const [vehSearch, setVehSearch] = useState<string>('');
  const [editingVehId, setEditingVehId] = useState<string | null>(null);
  const [macInput, setMacInput] = useState<string>('');
  const [bleInput, setBleInput] = useState<string>('');
  const [odometerInputs, setOdometerInputs] = useState<Record<string, string>>({});

  // CSV Upload Refs & Status Banner
  const employeeCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  // New Employee Form State
  const [showAddEmp, setShowAddEmp] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('대리');
  const [newEmpDept, setNewEmpDept] = useState<string>('품질보증팀 (QA)');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('(334) 550-');

  // Incident resolution note state
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // Policy draft state & 1-Click Preset state
  const [draftPolicy, setDraftPolicy] = useState<SystemPolicyConfig>(policyConfig);
  const [policySavedBanner, setPolicySavedBanner] = useState<boolean>(false);
  const [showAdvancedPolicy, setShowAdvancedPolicy] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<'AUTONOMOUS' | 'STANDARD' | 'STRICT'>(
    policyConfig.autoApproveWhenManagerAway ? 'AUTONOMOUS' : 'STANDARD'
  );

  const handleApplyPreset = (preset: 'AUTONOMOUS' | 'STANDARD' | 'STRICT') => {
    setActivePreset(preset);
    let nextCfg: SystemPolicyConfig;
    if (preset === 'AUTONOMOUS') {
      nextCfg = {
        hqAddress: '4400 Northpark Dr, Opelika, AL 36801',
        garageGeofenceRadiusM: 150,
        keyboxBleRadiusM: 3,
        unauthorizedSpeedThresholdKmh: 15,
        crashGForceThreshold: 2.5,
        autoApproveWhenManagerAway: true,
        blockDispatchWhenPermissionOff: true,
        afterHoursAlertEnabled: true,
        autoReturnIdleMinutes: 3,
      };
    } else if (preset === 'STANDARD') {
      nextCfg = {
        hqAddress: '4400 Northpark Dr, Opelika, AL 36801',
        garageGeofenceRadiusM: 150,
        keyboxBleRadiusM: 3,
        unauthorizedSpeedThresholdKmh: 15,
        crashGForceThreshold: 2.5,
        autoApproveWhenManagerAway: false,
        blockDispatchWhenPermissionOff: true,
        afterHoursAlertEnabled: true,
        autoReturnIdleMinutes: 3,
      };
    } else {
      nextCfg = {
        hqAddress: '4400 Northpark Dr, Opelika, AL 36801',
        garageGeofenceRadiusM: 120,
        keyboxBleRadiusM: 2,
        unauthorizedSpeedThresholdKmh: 10,
        crashGForceThreshold: 2.0,
        autoApproveWhenManagerAway: false,
        blockDispatchWhenPermissionOff: true,
        afterHoursAlertEnabled: true,
        autoReturnIdleMinutes: 1,
      };
    }
    setDraftPolicy(nextCfg);
    onUpdatePolicyConfig(nextCfg);
    setPolicySavedBanner(true);
    setTimeout(() => setPolicySavedBanner(false), 3500);
  };

  const handleDownloadPrintableQrSheet = () => {
    const baseUrl = resolveAppBaseUrl();
    const isLocalBase = /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(baseUrl);
    const cardsHtml = [...vehicles]
      .sort((a, b) => a.fleetNumber - b.fleetNumber)
      .map((v) => {
        const unit = v.fleetNumber.toString().padStart(2, '0');
        const deepLink = buildVehicleDeepLink(baseUrl, v.fleetNumber);
        return `
      <div class="qr-card">
        <div class="qr-top">FLEETGUARD 30 · OPELIKA AL</div>
        <div class="qr-num">#${unit}호차 · ${escapeHtml(v.plateNumber)}</div>
        <div class="qr-model">${escapeHtml(v.modelName)}</div>
        <div class="qr-img">${createQrSvg(deepLink)}</div>
        <div class="qr-hint">휴대폰 카메라로 스캔 → 앱에서 #${unit}호차 자동 선택</div>
        <div class="qr-meta">ID ${escapeHtml(v.bleBeaconUuid)} · ${escapeHtml(v.parkingZone)}</div>
      </div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>법인차량 30대 키고리 QR 태그 시트 (4400 Northpark Dr, Opelika, AL)</title>
  <style>
    @page { size: letter; margin: 0.4in; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif; margin: 0; background: #fff; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media screen { body { padding: 24px; } }
    h1 { font-size: 14px; margin: 0 0 3px; }
    p { font-size: 10px; color: #555; margin: 0 0 3px; }
    .base { font-family: monospace; font-size: 9px; color: #1D4ED8; margin-bottom: 8px; }
    .warn { font-size: 10px; color: #B91C1C; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 5px 8px; margin: 4px 0 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .qr-card { min-width: 0; border: 1.5px solid #111; border-radius: 8px; padding: 5px 5px 4px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .qr-top { font-size: 7px; font-weight: 700; color: #3E6AE1; letter-spacing: .04em; }
    .qr-num { font-size: 12px; font-weight: 800; margin-top: 1px; }
    .qr-model { font-size: 8.5px; color: #444; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .qr-img svg { width: 1in; height: 1in; display: block; margin: 0 auto; }
    .qr-hint { font-size: 8px; font-weight: 600; color: #111; margin-top: 2px; }
    .qr-meta { font-size: 7px; color: #666; margin-top: 2px; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <h1>법인차량 30대 키고리 QR 태그 시트 (4400 Northpark Dr, Opelika, AL 36801)</h1>
  <p>카드를 오려 코팅한 뒤 호차 번호·번호판이 일치하는 차키 고리에 부착하세요. 운전자가 휴대폰 카메라로 스캔하면 FleetGuard 30 앱이 열리고 해당 차량이 자동 선택됩니다 (운행은 앱에서 신청·출발해야 시작됩니다).</p>
  <div class="base">QR 연결 주소: ${escapeHtml(baseUrl)}/?unit=NN</div>
  ${
    isLocalBase
      ? '<div class="warn">⚠ 개발용 주소(localhost)로 생성되었습니다. 이 QR은 휴대폰에서 열리지 않습니다. 운영 주소(예: https://vehiclemonitor.vercel.app)에서 다시 인쇄하거나 NEXT_PUBLIC_APP_URL을 설정하세요.</div>'
      : ''
  }
  <div class="grid">${cardsHtml}</div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '법인차량30대_무설정_QR키고리시트_Opelika_AL.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadEmployeeCsvTemplate = () => {
    const headers = ['name', 'role', 'department', 'phone', 'dispatchAllowed'];
    const sampleRows = [
      ['김태호 과장 (T.H. Kim)', '과장', '북미부품영업1팀 (Opelika Sales)', '(334) 550-0191', 'Y'],
      ['최유진 대리 (Y.J. Choi)', '대리', '품질보증팀 (QA Engineering)', '(334) 550-0192', 'Y'],
      ['정현우 사원 (H.W. Jung)', '사원', '생산기술팀 (Manufacturing)', '(334) 550-0193', 'Y'],
    ];
    const csv = '\uFEFF' + [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '사용자_임직원_일괄등록_양식_Opelika_AL.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmployeeCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '').replace(/^\uFEFF/, '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length <= 1) return;

      const parsed: EmployeeCsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (!cols[0]) continue;
        const allowRaw = (cols[4] || 'Y').toUpperCase();
        parsed.push({
          name: cols[0],
          role: cols[1] || '사원',
          department: cols[2] || '일반업무팀 (Opelika HQ)',
          phone: cols[3] || '(334) 550-0100',
          dispatchAllowed: allowRaw !== 'N' && allowRaw !== 'FALSE' && allowRaw !== '0',
        });
      }

      if (parsed.length > 0) {
        onBulkImportEmployees(parsed);
        setCsvFeedback(`✅ 사용자 CSV 파일(${file.name})에서 총 ${parsed.length}명의 임직원(운전자) 정보를 일괄 등록/업데이트했습니다.`);
        setTimeout(() => setCsvFeedback(null), 6000);
      }
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  };

  const unresolvedCount = incidents.filter((inc) => !inc.resolved).length;

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(vehSearch.toLowerCase()) ||
      v.modelName.toLowerCase().includes(vehSearch.toLowerCase()) ||
      `${v.fleetNumber}호차`.includes(vehSearch)
  );

  return (
    <div className="space-y-5">
      {/* Hidden File Inputs for Vehicle & Employee CSV Import */}
      <input
        ref={employeeCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleEmployeeCsvFileChange}
        className="hidden"
      />

      {csvFeedback && (
        <div className="p-3.5 rounded-xl bg-[#12B76A]/15 border border-[#12B76A]/40 text-xs text-[#047857] flex items-center justify-between">
          <span className="font-medium">{csvFeedback}</span>
          <button
            type="button"
            onClick={() => setCsvFeedback(null)}
            className="text-[11px] underline text-black/80 hover:text-[#0A0A0A]"
          >
            닫기
          </button>
        </div>
      )}

      {/* Top Admin Console Banner: Explaining No-Dashcam + Smartphone-Only Management */}
      <div
        className="rounded-2xl bg-[#FFFFFF] p-5 border border-black/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{
          boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px',
        }}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenManual}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F4F4F5] hover:bg-black/5 text-[#0A0A0A] border border-black/15 inline-flex items-center gap-1 transition"
            >
              <BookOpen className="w-3 h-3 text-[#1D4ED8]" />
              매뉴얼
            </button>
            <button
              type="button"
              onClick={onLockAdminConsole}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#E82127]/20 hover:bg-[#E82127]/35 text-[#DC2626] border border-[#E82127]/40 inline-flex items-center gap-1 transition"
            >
              <Lock className="w-3 h-3" />
              잠금
            </button>
          </div>
          <h2 className="text-lg font-semibold text-[#0A0A0A]">관리 설정</h2>
        </div>

        {/* 4 Admin Sub-Navigation Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-[#FAFAFA] p-1.5 rounded-xl border border-black/10 shrink-0">
          {[
            {
              id: 'VEHICLE_MASTER' as AdminSection,
              label: '차량',
              icon: Car,
            },
            {
              id: 'EMPLOYEE_GOVERNANCE' as AdminSection,
              label: '임직원',
              icon: Users,
            },
            {
              id: 'NO_DASHCAM_INCIDENTS' as AdminSection,
              label: `사고 처분${unresolvedCount > 0 ? ` ${unresolvedCount}` : ''}`,
              icon: Smartphone,
            },
            {
              id: 'SYSTEM_POLICY' as AdminSection,
              label: '정책',
              icon: Settings,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                  section === tab.id
                    ? 'bg-[#3E6AE1] text-white shadow'
                    : 'text-[#52525B] hover:text-[#0A0A0A]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: 30-Vehicle Master & Physical Odometer Audit */}
      {section === 'VEHICLE_MASTER' && (
        <div className="rounded-2xl bg-[#FFFFFF] p-5 border border-black/10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-black/10">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#3E6AE1]" />
                차량 · 계기판 실사
              </h3>
              <p className="text-xs text-[#52525B] mt-0.5">
                실제 계기판 값을 입력하면 앱 GPS 거리와의 오차를 찾습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPrintableQrSheet}
                className="px-2.5 py-1.5 rounded-lg bg-[#12B76A]/20 hover:bg-[#12B76A]/35 border border-[#12B76A]/40 text-xs font-semibold text-[#047857] flex items-center gap-1.5 transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR 키고리 인쇄
              </button>
              <div className="relative w-full md:w-60">
                <Search className="w-3.5 h-3.5 text-[#52525B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={vehSearch}
                  onChange={(e) => setVehSearch(e.target.value)}
                  placeholder="호차, 번호판(AL 41...), 차종 검색"
                  className="w-full rounded-lg bg-[#FAFAFA] border border-black/10 pl-8 pr-3 py-1.5 text-xs text-[#0A0A0A]"
                />
              </div>
            </div>
          </div>

          <VehicleFormPanel
            vehicles={vehicles}
            reservations={reservations}
            dataMode={dataMode}
            onImportVehicles={onImportVehicles}
          />

          <VehicleImportPanel
            vehicles={vehicles}
            reservations={reservations}
            dataMode={dataMode}
            onImportVehicles={onImportVehicles}
            onClearDemoData={onClearDemoData}
          />

          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#F8FAFC] border-b border-black/10 text-[11px] font-mono text-[#52525B]">
                <tr>
                  <th className="py-2.5 px-3">호차</th>
                  <th className="py-2.5 px-3">차종</th>
                  <th className="py-2.5 px-3">블루투스 MAC</th>
                  <th className="py-2.5 px-3">상태 / 위치</th>
                  <th className="py-2.5 px-3 text-right">GPS 거리</th>
                  <th className="py-2.5 px-3">계기판 실사</th>
                  <th className="py-2.5 px-3 text-center">배차</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredVehicles.map((veh) => {
                  const isEditing = editingVehId === veh.id;
                  const gapKm = Number(
                    (veh.lastVerifiedOdometerKm - veh.cumulativeGpsKm).toFixed(1)
                  );
                  const hasGhostDiscrepancy = Math.abs(gapKm) >= 5;

                  return (
                    <tr key={veh.id} className="hover:bg-black/[0.02]">
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-[#52525B] mr-1.5">
                          #{veh.fleetNumber.toString().padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-[#0A0A0A]">{veh.plateNumber}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#3F3F46]">{veh.modelName}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={macInput}
                              onChange={(e) => setMacInput(e.target.value)}
                              className="w-32 rounded bg-[#FAFAFA] border border-[#3E6AE1] px-1.5 py-0.5 text-[11px] text-[#0A0A0A]"
                            />
                            <input
                              type="text"
                              value={bleInput}
                              onChange={(e) => setBleInput(e.target.value)}
                              className="w-28 rounded bg-[#FAFAFA] border border-[#3E6AE1] px-1.5 py-0.5 text-[11px] text-[#0A0A0A]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateVehicleMac(veh.id, macInput, bleInput);
                                setEditingVehId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-[#12B76A] text-white text-[10px]"
                            >
                              저장
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[#1D4ED8]">{veh.btMacAddress}</span>
                            <span className="text-[#6B7280]">({veh.bleBeaconUuid})</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVehId(veh.id);
                                setMacInput(veh.btMacAddress);
                                setBleInput(veh.bleBeaconUuid);
                              }}
                              className="text-[10px] text-[#52525B] underline hover:text-[#0A0A0A]"
                            >
                              수정
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono mr-2 ${
                            veh.status === 'UNAUTHORIZED' || veh.status === 'INCIDENT'
                              ? 'bg-[#E82127]/20 text-[#DC2626]'
                              : veh.status === 'AUTHORIZED'
                                ? 'bg-[#3E6AE1]/20 text-[#1D4ED8]'
                                : 'bg-[#12B76A]/15 text-[#047857]'
                          }`}
                        >
                          {veh.status}
                        </span>
                        <span className="text-[11px] text-[#52525B]">{veh.parkingZone}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#0A0A0A]">
                        {veh.cumulativeGpsKm.toFixed(1)} km
                        {hasGhostDiscrepancy && (
                          <span className="block text-[10px] text-[#B45309]">
                            ⚠️ 오차 {gapKm > 0 ? '+' : ''}{gapKm}km
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            placeholder={`${veh.lastVerifiedOdometerKm.toFixed(1)}`}
                            value={odometerInputs[veh.id] ?? ''}
                            onChange={(e) =>
                              setOdometerInputs((prev) => ({
                                ...prev,
                                [veh.id]: e.target.value,
                              }))
                            }
                            className="w-24 rounded bg-[#FAFAFA] border border-black/10 px-2 py-1 text-xs font-mono text-[#0A0A0A]"
                          />
                          <button
                            type="button"
                            disabled={!odometerInputs[veh.id]}
                            onClick={() => {
                              // Only a value the admin actually read off the odometer is audited
                              const val = parseFloat(odometerInputs[veh.id] ?? '');
                              if (!isNaN(val)) {
                                onAuditVehicleOdometer(veh.id, val);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-[#F4F4F5] hover:bg-[#3E6AE1] disabled:opacity-40 disabled:hover:bg-[#F4F4F5] text-[#0A0A0A] border border-black/10 text-[11px] font-mono transition"
                          >
                            실사
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleVehicleLock(veh.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono inline-flex items-center gap-1 border transition ${
                            veh.isLockedByAdmin
                              ? 'bg-[#E82127]/20 border-[#E82127]/50 text-[#DC2626]'
                              : 'bg-[#F4F4F5] border-black/10 text-[#047857]'
                          }`}
                        >
                          {veh.isLockedByAdmin ? (
                            <>
                              <Lock className="w-3 h-3" /> 차단
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" /> 가용
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: Employee Governance & Permission Control */}
      {section === 'EMPLOYEE_GOVERNANCE' && (
        <div className="rounded-2xl bg-[#FFFFFF] p-5 border border-black/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/10">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#059669]" />
                임직원 자격 · 권한
              </h3>
              <p className="text-xs text-[#52525B] mt-0.5">
                권한을 끈 직원의 배차를 정지하거나 복구 알림을 보냅니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadEmployeeCsvTemplate}
                className="px-2.5 py-1.5 rounded-lg bg-[#F4F4F5] hover:bg-black/5 border border-black/15 text-xs text-[#0A0A0A] flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-[#047857]" />
                CSV 양식
              </button>
              <button
                type="button"
                onClick={() => employeeCsvInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#12B76A] hover:bg-[#0E9F5C] text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                CSV 업로드
              </button>
              <button
                type="button"
                onClick={() => setShowAddEmp((p) => !p)}
                className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-medium flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + 직원 추가
              </button>
            </div>
          </div>

          {showAddEmp && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newEmpName.trim()) return;
                onAddEmployee({
                  name: newEmpName,
                  role: newEmpRole,
                  department: newEmpDept,
                  phone: newEmpPhone,
                });
                setNewEmpName('');
                setShowAddEmp(false);
              }}
              className="p-4 rounded-xl bg-[#F4F4F5] border border-[#3E6AE1]/40 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end"
            >
              <div>
                <label className="block text-[11px] font-mono text-[#52525B] mb-1">성명</label>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="예: 장민호 과장 (M.H. Jang)"
                  className="w-full rounded bg-[#FAFAFA] border border-black/10 px-2.5 py-1.5 text-[#0A0A0A]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#52525B] mb-1">직급</label>
                <input
                  type="text"
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full rounded bg-[#FAFAFA] border border-black/10 px-2.5 py-1.5 text-[#0A0A0A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#52525B] mb-1">부서</label>
                <input
                  type="text"
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                  className="w-full rounded bg-[#FAFAFA] border border-black/10 px-2.5 py-1.5 text-[#0A0A0A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#52525B] mb-1">
                  연락처
                </label>
                <input
                  type="text"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full rounded bg-[#FAFAFA] border border-black/10 px-2.5 py-1.5 text-[#0A0A0A]"
                />
              </div>
              <button
                type="submit"
                className="py-1.5 px-3 rounded bg-[#12B76A] text-white font-semibold"
              >
                운전자 추가
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {employees.map((emp) => {
              const isAllowed = emp.dispatchAllowed !== false;
              return (
                <div
                  key={emp.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                    !isAllowed
                      ? 'bg-[#E82127]/10 border-[#E82127]/40'
                      : emp.permissionStatus !== 'OK'
                        ? 'bg-[#F79009]/10 border-[#F79009]/40'
                        : 'bg-[#F4F4F5] border-black/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{emp.name}</span>
                        <span className="text-xs text-[#52525B]">{emp.phone}</span>
                      </div>
                      <p className="text-xs text-[#52525B] mt-0.5">{emp.department}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        emp.permissionStatus === 'OK'
                          ? 'bg-[#12B76A]/20 text-[#047857]'
                          : 'bg-[#E82127]/25 text-[#DC2626]'
                      }`}
                    >
                      권한 {emp.permissionStatus}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-[#52525B] flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5">
                    <span>최근 {emp.lastHeartbeatAt}</span>
                    <span>
                      키함 {emp.lastKeyboxAccessAt || '-'} · 위반{' '}
                      <strong className="text-[#B45309]">{emp.violationCount || 0}회</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {emp.permissionStatus !== 'OK' && (
                      <button
                        type="button"
                        onClick={() => onSendPermissionWarningPush(emp.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#F79009]/20 hover:bg-[#F79009]/35 border border-[#F79009]/50 text-[#B45309] text-xs flex items-center gap-1"
                      >
                        <Bell className="w-3 h-3" />
                        복구 알림
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onIssueDeviceLink(emp.id)}
                      title={emp.deviceEnrolledAt ? `등록: ${new Date(emp.deviceEnrolledAt).toLocaleString()}` : '등록된 휴대폰 없음'}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-black/5 border border-black/15 text-[#0A0A0A] text-xs flex items-center gap-1"
                    >
                      <Smartphone className="w-3 h-3" />
                      {emp.deviceEnrolledAt ? '기기 재등록' : '기기 등록 링크'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleEmployeeDispatch(emp.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                        isAllowed
                          ? 'bg-[#E82127]/20 hover:bg-[#E82127]/35 border border-[#E82127]/40 text-[#DC2626]'
                          : 'bg-[#12B76A] hover:bg-[#0E9F5A] text-white'
                      }`}
                    >
                      {isAllowed ? (
                        <>
                          <Ban className="w-3 h-3" /> 배차 정지
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> 배차 복구
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: No-Dashcam Smartphone Telemetry Incident Reconstruction & Resolution */}
      {section === 'NO_DASHCAM_INCIDENTS' && (
        <div className="rounded-2xl bg-[#FFFFFF] p-5 border border-black/10 space-y-4">
          <div className="pb-3 border-b border-black/10">
            <h3 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#E82127]" />
              사고 · 무단운행 처분
            </h3>
            <p className="text-xs text-[#52525B] mt-0.5">
              휴대폰 센서(충격·회전·속도)로 재구성한 기록입니다.
            </p>
          </div>

          <div className="space-y-3">
            {incidents.map((inc) => {
              const currentNote =
                noteInputs[inc.id] ?? inc.managerResolutionNote ?? '';
              return (
                <div
                  key={inc.id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    inc.resolved
                      ? 'bg-[#F4F4F5]/50 border-black/10'
                      : 'bg-[#F4F4F5] border-[#E82127]/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          inc.resolved
                            ? 'bg-[#12B76A]/20 text-[#047857]'
                            : 'bg-[#E82127] text-white'
                        }`}
                      >
                        {inc.resolved ? '완료' : '조치 필요'}
                      </span>
                      <span className="text-xs font-mono text-[#52525B]">{inc.occurredAt}</span>
                      <span className="text-xs font-mono font-semibold text-[#1D4ED8]">
                        {inc.plateNumber}
                      </span>
                      <span className="text-xs font-semibold text-[#0A0A0A]">
                        운전자: {inc.driverName}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-[#52525B]">
                      📍 {inc.locationLabel}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-[#0A0A0A]">{inc.title}</h4>
                  <p className="text-xs text-[#52525B] leading-relaxed">{inc.description}</p>

                  {/* Smartphone 6-Axis IMU Telemetry Reconstruction Box (Replacing Dashcam) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#FAFAFA] border border-black/5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">
                        충격 / 속도변화
                      </span>
                      <span className="text-[#DC2626] font-semibold">
                        {inc.gForce ? `${inc.gForce}G (Δv=${inc.deltaSpeedKmh}km/h)` : '해당 없음'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">
                        회전
                      </span>
                      <span className="text-[#B45309] font-semibold">
                        {inc.gyroYawDegPerSec ? `${inc.gyroYawDegPerSec}°/sec` : '정상 범위'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">
                        충격 방향
                      </span>
                      <span className="text-[#1D4ED8]">
                        {inc.impactDirection || '주행/지오펜스 이벤트'}
                      </span>
                    </div>
                  </div>

                  {/* Admin Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-black/10">
                    <input
                      type="text"
                      value={currentNote}
                      onChange={(e) =>
                        setNoteInputs((prev) => ({ ...prev, [inc.id]: e.target.value }))
                      }
                      placeholder="조치 메모 (예: 경위서 수령)"
                      className="flex-1 rounded-lg bg-[#FAFAFA] border border-black/10 px-3 py-1.5 text-xs text-[#0A0A0A]"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      {!inc.resolved && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onResolveIncident(
                                inc.id,
                                currentNote || '운전자 배차 정지 및 경위서 징구 처분',
                                true
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#E82127]/20 hover:bg-[#E82127]/35 border border-[#E82127]/50 text-[#DC2626] text-xs font-medium"
                          >
                            배차정지 + 마감
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onResolveIncident(
                                inc.id,
                                currentNote || '관리자 확인 및 현장 조치 완료',
                                false
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#12B76A] hover:bg-[#0E9F5A] text-white text-xs font-semibold"
                          >
                            조치 완료
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: 1-Click Zero-Config Preset Mode + Collapsible Advanced Settings */}
      {section === 'SYSTEM_POLICY' && (
        <div className="rounded-2xl bg-[#FFFFFF] p-5 border border-black/10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/10">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#047857]" />
                <h3 className="text-sm font-semibold text-[#0A0A0A]">
                  운영 모드 선택
                </h3>
              </div>
              <p className="text-xs text-[#52525B] mt-0.5">
                카드 1개를 누르면 세부 설정이 모두 적용됩니다.
              </p>
            </div>
            {policySavedBanner && (
              <span className="px-3 py-1 rounded-full bg-[#12B76A]/20 text-[#047857] text-xs font-mono">
                ✅ 전체 차량에 적용됨
              </span>
            )}
          </div>

          {/* 3 One-Click Preset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleApplyPreset('AUTONOMOUS')}
              className={`text-left p-4 rounded-2xl border transition space-y-2 ${
                activePreset === 'AUTONOMOUS'
                  ? 'bg-[#12B76A]/15 border-[#12B76A] shadow-lg shadow-[#12B76A]/10'
                  : 'bg-[#F4F4F5] border-black/10 hover:border-black/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#12B76A] text-white">
                  추천
                </span>
                {activePreset === 'AUTONOMOUS' && (
                  <CheckCircle2 className="w-4 h-4 text-[#047857]" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-[#0A0A0A]">
                🟢 A: 자동 승인
              </h4>
              <p className="text-xs text-[#52525B] leading-relaxed">
                신청 즉시 승인. 앱 없이 출발(<code>15km/h+</code>)만 경보.
              </p>
              <div className="pt-1 text-[10px] font-mono text-[#047857]">
                자동승인 ON · 무단감지 15km/h · 충격 2.5G · 차고지 150m 자동반납
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('STANDARD')}
              className={`text-left p-4 rounded-2xl border transition space-y-2 ${
                activePreset === 'STANDARD'
                  ? 'bg-[#3E6AE1]/15 border-[#3E6AE1] shadow-lg shadow-[#3E6AE1]/10'
                  : 'bg-[#F4F4F5] border-black/10 hover:border-black/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#3E6AE1]/30 text-[#1D4ED8]">
                  표준
                </span>
                {activePreset === 'STANDARD' && (
                  <CheckCircle2 className="w-4 h-4 text-[#1D4ED8]" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-[#0A0A0A]">
                🔵 B: 사전 승인
              </h4>
              <p className="text-xs text-[#52525B] leading-relaxed">
                관리자가 승인한 뒤 키를 받아 출발.
              </p>
              <div className="pt-1 text-[10px] font-mono text-[#1D4ED8]">
                사전승인 필수 · 무단감지 15km/h · 충격 2.5G · 차고지 150m 자동반납
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('STRICT')}
              className={`text-left p-4 rounded-2xl border transition space-y-2 ${
                activePreset === 'STRICT'
                  ? 'bg-[#E82127]/15 border-[#E82127] shadow-lg shadow-[#E82127]/10'
                  : 'bg-[#F4F4F5] border-black/10 hover:border-black/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#E82127]/30 text-[#DC2626]">
                  고보안
                </span>
                {activePreset === 'STRICT' && (
                  <CheckCircle2 className="w-4 h-4 text-[#DC2626]" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-[#0A0A0A]">
                🔴 C: 엄격 감사
              </h4>
              <p className="text-xs text-[#52525B] leading-relaxed">
                <code>10km/h+</code> 이동, <code>2.0G+</code> 접촉까지 경보.
              </p>
              <div className="pt-1 text-[10px] font-mono text-[#DC2626]">
                사전승인 필수 · 민감감지 10km/h · 충격 2.0G · 복귀 1분 자동반납
              </div>
            </button>
          </div>

          {/* Collapsible Advanced Sliders Toggle */}
          <div className="pt-2 border-t border-black/10">
            <button
              type="button"
              onClick={() => setShowAdvancedPolicy((p) => !p)}
              className="px-3.5 py-2 rounded-xl bg-[#FAFAFA] hover:bg-black/[0.03] border border-black/10 text-xs font-medium text-[#52525B] hover:text-[#0A0A0A] flex items-center gap-2 transition"
            >
              <Settings className="w-3.5 h-3.5 text-[#3E6AE1]" />
              {showAdvancedPolicy
                ? '고급 설정 접기'
                : '고급 설정 (선택)'}
              {showAdvancedPolicy ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {showAdvancedPolicy && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/5 space-y-1.5">
                  <label className="font-mono text-[#52525B] block">
                    본사 차고지 지오펜스 기준 주소
                  </label>
                  <input
                    type="text"
                    value={draftPolicy.hqAddress}
                    onChange={(e) =>
                      setDraftPolicy({ ...draftPolicy, hqAddress: e.target.value })
                    }
                    className="w-full rounded-lg bg-[#FAFAFA] border border-black/10 px-2.5 py-2 text-[#0A0A0A]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/5 space-y-1.5">
                  <label className="font-mono text-[#52525B] block">
                    차고지 지오펜스 반경 (m) — 현재 {draftPolicy.garageGeofenceRadiusM}m
                  </label>
                  <input
                    type="range"
                    min={80}
                    max={300}
                    step={10}
                    value={draftPolicy.garageGeofenceRadiusM}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        garageGeofenceRadiusM: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/5 space-y-1.5">
                  <label className="font-mono text-[#52525B] block">
                    키 보관함 BLE 근접 판별 반경 (m) — 현재 {draftPolicy.keyboxBleRadiusM}m
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={draftPolicy.keyboxBleRadiusM}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        keyboxBleRadiusM: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/5 space-y-1.5">
                  <label className="font-mono text-[#52525B] block">
                    미승인 출발 감지 임계 속도 — {draftPolicy.unauthorizedSpeedThresholdKmh} km/h
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={30}
                    step={5}
                    value={draftPolicy.unauthorizedSpeedThresholdKmh}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        unauthorizedSpeedThresholdKmh: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/5 space-y-1.5">
                  <label className="font-mono text-[#52525B] block">
                    무블랙박스 사고 감지 충격 임계치 — {draftPolicy.crashGForceThreshold.toFixed(1)} G
                  </label>
                  <input
                    type="range"
                    min={1.8}
                    max={4.0}
                    step={0.1}
                    value={draftPolicy.crashGForceThreshold}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        crashGForceThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-black/5 space-y-1.5">
                  <label className="font-mono text-[#52525B] block">
                    차고지 복귀 후 자동 반납 대기 시간 — {draftPolicy.autoReturnIdleMinutes}분
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={draftPolicy.autoReturnIdleMinutes}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        autoReturnIdleMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                <label className="p-3 rounded-xl bg-[#F4F4F5] border border-black/5 flex items-center justify-between cursor-pointer">
                  <span>관리자 부재 시 배차 신청 자동 승인</span>
                  <input
                    type="checkbox"
                    checked={draftPolicy.autoApproveWhenManagerAway}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        autoApproveWhenManagerAway: e.target.checked,
                      })
                    }
                  />
                </label>

                <label className="p-3 rounded-xl bg-[#F4F4F5] border border-black/5 flex items-center justify-between cursor-pointer">
                  <span>블루투스/GPS 권한 꺼진 직원 배차 자동 차단</span>
                  <input
                    type="checkbox"
                    checked={draftPolicy.blockDispatchWhenPermissionOff}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        blockDispatchWhenPermissionOff: e.target.checked,
                      })
                    }
                  />
                </label>

                <label className="p-3 rounded-xl bg-[#F4F4F5] border border-black/5 flex items-center justify-between cursor-pointer">
                  <span>심야/주말(업무시간 외) 키 반출 시 즉시 최고경보</span>
                  <input
                    type="checkbox"
                    checked={draftPolicy.afterHoursAlertEnabled}
                    onChange={(e) =>
                      setDraftPolicy({
                        ...draftPolicy,
                        afterHoursAlertEnabled: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePolicyConfig(draftPolicy);
                    setPolicySavedBanner(true);
                    setTimeout(() => setPolicySavedBanner(false), 3000);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-[#3E6AE1]/25"
                >
                  <Save className="w-3.5 h-3.5" />
                  세부 커스텀 설정 저장 및 적용
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
