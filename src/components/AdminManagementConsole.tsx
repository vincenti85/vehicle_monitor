'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Bell,
  Bluetooth,
  Car,
  CheckCircle2,
  Compass,
  Gauge,
  Lock,
  Plus,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Unlock,
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
} from '@/types/fleet';

interface AdminManagementConsoleProps {
  vehicles: Vehicle[];
  employees: Employee[];
  incidents: IncidentEvent[];
  policyConfig: SystemPolicyConfig;
  onUpdateVehicleMac: (vehicleId: string, newMac: string, newBleUuid: string) => void;
  onAuditVehicleOdometer: (vehicleId: string, actualOdometerKm: number) => void;
  onToggleVehicleLock: (vehicleId: string) => void;
  onToggleEmployeeDispatch: (employeeId: string) => void;
  onSendPermissionWarningPush: (employeeId: string) => void;
  onAddEmployee: (emp: { name: string; role: string; department: string; phone: string }) => void;
  onResolveIncident: (incidentId: string, resolutionNote: string, suspendDriver: boolean) => void;
  onUpdatePolicyConfig: (nextConfig: SystemPolicyConfig) => void;
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
  onSendPermissionWarningPush,
  onAddEmployee,
  onResolveIncident,
  onUpdatePolicyConfig,
}) => {
  const [section, setSection] = useState<AdminSection>('VEHICLE_MASTER');
  const [vehSearch, setVehSearch] = useState<string>('');
  const [editingVehId, setEditingVehId] = useState<string | null>(null);
  const [macInput, setMacInput] = useState<string>('');
  const [bleInput, setBleInput] = useState<string>('');
  const [odometerInputs, setOdometerInputs] = useState<Record<string, string>>({});

  // New Employee Form State
  const [showAddEmp, setShowAddEmp] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('대리');
  const [newEmpDept, setNewEmpDept] = useState<string>('품질보증팀 (QA)');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('(334) 550-');

  // Incident resolution note state
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // Policy draft state
  const [draftPolicy, setDraftPolicy] = useState<SystemPolicyConfig>(policyConfig);
  const [policySavedBanner, setPolicySavedBanner] = useState<boolean>(false);

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(vehSearch.toLowerCase()) ||
      v.modelName.toLowerCase().includes(vehSearch.toLowerCase()) ||
      `${v.fleetNumber}호차`.includes(vehSearch)
  );

  return (
    <div className="space-y-5">
      {/* Top Admin Console Banner: Explaining No-Dashcam + Smartphone-Only Management */}
      <div
        className="rounded-2xl bg-[#131720] p-5 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{
          boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px',
        }}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#3E6AE1]/20 text-[#9BC1FF] border border-[#3E6AE1]/40">
              FLEET ADMIN CONSOLE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#12B76A]/15 text-[#32D583] border border-[#12B76A]/30">
              차량 내 블랙박스·OBD 단말기 0대 (100% 스마트폰 센서 재구성)
            </span>
          </div>
          <h2 className="text-lg font-semibold text-[#F4F6F8]">
            법인차량 30대 통합 관리자 운영 콘솔 (4400 Northpark Dr, Opelika, AL 36801)
          </h2>
          <p className="text-xs text-[#9BA3B0]">
            차량 순정 블루투스 등록·실사 계기판 대조(유령 주행 적발), 임직원 운전 자격 및 권한 통제, 무블랙박스 스마트폰 6축 센서 사고 재구성 및 행정 처분, 지오펜스·자동승인 정책을 한 화면에서 관리합니다.
          </p>
        </div>

        {/* 4 Admin Sub-Navigation Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-[#0B0D10] p-1.5 rounded-xl border border-white/10 shrink-0">
          {[
            {
              id: 'VEHICLE_MASTER' as AdminSection,
              label: '🚗 차량 30대 · 계기판 실사',
              icon: Car,
            },
            {
              id: 'EMPLOYEE_GOVERNANCE' as AdminSection,
              label: '👥 임직원 자격 · 권한 통제',
              icon: Users,
            },
            {
              id: 'NO_DASHCAM_INCIDENTS' as AdminSection,
              label: '📱 무블랙박스 사고 재구성·처분',
              icon: Smartphone,
            },
            {
              id: 'SYSTEM_POLICY' as AdminSection,
              label: '⚙️ 지오펜스 · 센서 · 승인 정책',
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
                    : 'text-[#9BA3B0] hover:text-white'
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
        <div className="rounded-2xl bg-[#131720] p-5 border border-white/10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-[#F4F6F8] flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#3E6AE1]" />
                법인차량 30대 블루투스 MAC 매핑 및 실제 계기판(Odometer) 실사 대조
              </h3>
              <p className="text-xs text-[#9BA3B0] mt-0.5">
                차량에 블랙박스나 GPS 단말기가 없으므로, 정기 점검 시 실제 계기판 수치를 입력해 스마트폰 GPS 합산 주행거리와의 오차(유령 주행)를 즉시 색출합니다.
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-[#9BA3B0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vehSearch}
                onChange={(e) => setVehSearch(e.target.value)}
                placeholder="호차, 번호판(AL 41...), 차종 검색"
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 pl-8 pr-3 py-1.5 text-xs text-[#F4F6F8]"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#0F131B] border-b border-white/10 text-[11px] font-mono text-[#9BA3B0]">
                <tr>
                  <th className="py-2.5 px-3">호차 / 번호판</th>
                  <th className="py-2.5 px-3">차종 (Opelika AL 플릿)</th>
                  <th className="py-2.5 px-3">순정 블루투스 MAC / BLE</th>
                  <th className="py-2.5 px-3">현재 상태 / 위치</th>
                  <th className="py-2.5 px-3 text-right">앱 GPS 누적거리</th>
                  <th className="py-2.5 px-3">실제 계기판 실사 대조 (유령주행 검증)</th>
                  <th className="py-2.5 px-3 text-center">차량 잠금(배차차단)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredVehicles.map((veh) => {
                  const isEditing = editingVehId === veh.id;
                  const gapKm = Number(
                    (veh.lastVerifiedOdometerKm - veh.cumulativeGpsKm).toFixed(1)
                  );
                  const hasGhostDiscrepancy = Math.abs(gapKm) >= 5;

                  return (
                    <tr key={veh.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-[#9BA3B0] mr-1.5">
                          #{veh.fleetNumber.toString().padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-[#F4F6F8]">{veh.plateNumber}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#D0D5DD]">{veh.modelName}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={macInput}
                              onChange={(e) => setMacInput(e.target.value)}
                              className="w-32 rounded bg-[#0B0D10] border border-[#3E6AE1] px-1.5 py-0.5 text-[11px] text-white"
                            />
                            <input
                              type="text"
                              value={bleInput}
                              onChange={(e) => setBleInput(e.target.value)}
                              className="w-28 rounded bg-[#0B0D10] border border-[#3E6AE1] px-1.5 py-0.5 text-[11px] text-white"
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
                            <span className="text-[#9BC1FF]">{veh.btMacAddress}</span>
                            <span className="text-[#636B78]">({veh.bleBeaconUuid})</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVehId(veh.id);
                                setMacInput(veh.btMacAddress);
                                setBleInput(veh.bleBeaconUuid);
                              }}
                              className="text-[10px] text-[#9BA3B0] underline hover:text-white"
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
                              ? 'bg-[#E82127]/20 text-[#FF8080]'
                              : veh.status === 'AUTHORIZED'
                                ? 'bg-[#3E6AE1]/20 text-[#9BC1FF]'
                                : 'bg-[#12B76A]/15 text-[#32D583]'
                          }`}
                        >
                          {veh.status}
                        </span>
                        <span className="text-[11px] text-[#9BA3B0]">{veh.parkingZone}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4F6F8]">
                        {veh.cumulativeGpsKm.toFixed(1)} km
                        {hasGhostDiscrepancy && (
                          <span className="block text-[10px] text-[#F79009]">
                            ⚠️ 실사오차 +{gapKm}km
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
                            className="w-24 rounded bg-[#0B0D10] border border-white/10 px-2 py-1 text-xs font-mono text-[#F4F6F8]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = parseFloat(
                                odometerInputs[veh.id] || `${veh.cumulativeGpsKm + 15}`
                              );
                              if (!isNaN(val)) {
                                onAuditVehicleOdometer(veh.id, val);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-[#191E2A] hover:bg-[#3E6AE1] text-[#F4F6F8] border border-white/10 text-[11px] font-mono transition"
                          >
                            실사 대조
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleVehicleLock(veh.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono inline-flex items-center gap-1 border transition ${
                            veh.isLockedByAdmin
                              ? 'bg-[#E82127]/20 border-[#E82127]/50 text-[#FF8080]'
                              : 'bg-[#191E2A] border-white/10 text-[#32D583]'
                          }`}
                        >
                          {veh.isLockedByAdmin ? (
                            <>
                              <Lock className="w-3 h-3" /> 사용차단됨
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" /> 배차가용
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
        <div className="rounded-2xl bg-[#131720] p-5 border border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-[#F4F6F8] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#12B76A]" />
                임직원 운전 자격 · 스마트폰 권한 하트비트 감사 · 배차 차단 관리
              </h3>
              <p className="text-xs text-[#9BA3B0] mt-0.5">
                블루투스/위치 권한을 고의로 끄거나 무단 반출 이력이 있는 직원의 배차 신청 자격을 즉시 정지하거나 권한 복구 푸시를 발송합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddEmp((p) => !p)}
              className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-medium flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + 신규 임직원(운전자) 등록
            </button>
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
              className="p-4 rounded-xl bg-[#191E2A] border border-[#3E6AE1]/40 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end"
            >
              <div>
                <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">성명</label>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="예: 장민호 과장 (M.H. Jang)"
                  className="w-full rounded bg-[#0B0D10] border border-white/10 px-2.5 py-1.5 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">직급</label>
                <input
                  type="text"
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full rounded bg-[#0B0D10] border border-white/10 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">부서</label>
                <input
                  type="text"
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                  className="w-full rounded bg-[#0B0D10] border border-white/10 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#9BA3B0] mb-1">
                  미국 연락처 (334)
                </label>
                <input
                  type="text"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full rounded bg-[#0B0D10] border border-white/10 px-2.5 py-1.5 text-white"
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
                        : 'bg-[#191E2A] border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#F4F6F8]">{emp.name}</span>
                        <span className="text-xs text-[#9BA3B0]">{emp.phone}</span>
                      </div>
                      <p className="text-xs text-[#9BA3B0] mt-0.5">{emp.department}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        emp.permissionStatus === 'OK'
                          ? 'bg-[#12B76A]/20 text-[#32D583]'
                          : 'bg-[#E82127]/25 text-[#FF8080]'
                      }`}
                    >
                      앱 권한: {emp.permissionStatus}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-[#9BA3B0] flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <span>최근 하트비트: {emp.lastHeartbeatAt}</span>
                    <span>
                      키보관함(3m) 접근: {emp.lastKeyboxAccessAt || '기록 없음'} · 위반:{' '}
                      <strong className="text-[#FDB022]">{emp.violationCount || 0}회</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {emp.permissionStatus !== 'OK' && (
                      <button
                        type="button"
                        onClick={() => onSendPermissionWarningPush(emp.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#F79009]/20 hover:bg-[#F79009]/35 border border-[#F79009]/50 text-[#FDB022] text-xs flex items-center gap-1"
                      >
                        <Bell className="w-3 h-3" />
                        권한 복구 독촉 푸시
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onToggleEmployeeDispatch(emp.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                        isAllowed
                          ? 'bg-[#E82127]/20 hover:bg-[#E82127]/35 border border-[#E82127]/40 text-[#FF8080]'
                          : 'bg-[#12B76A] hover:bg-[#0E9F5A] text-white'
                      }`}
                    >
                      {isAllowed ? (
                        <>
                          <Ban className="w-3 h-3" /> 배차 자격 정지시키기
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> 배차 자격 복구하기
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
        <div className="rounded-2xl bg-[#131720] p-5 border border-white/10 space-y-4">
          <div className="pb-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-[#F4F6F8] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#E82127]" />
              무블랙박스 스마트폰 6축 IMU 센서 기반 사고·무단운행 재구성 및 행정 처분 대장
            </h3>
            <p className="text-xs text-[#9BA3B0] mt-0.5">
              차량에 블랙박스 카메라가 없어도 스마트폰의 가속도계(G-Force) + 자이로스코프(차체 회전 각속도 °/s) + 충격 전후 30초 GPS 속도 급감 그래프 + 블루투스 신호 강도(RSSI)를 결합해 사고 당시의 운전자와 충격 방향을 100% 재구성합니다.
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
                      ? 'bg-[#191E2A]/50 border-white/10'
                      : 'bg-[#191E2A] border-[#E82127]/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          inc.resolved
                            ? 'bg-[#12B76A]/20 text-[#32D583]'
                            : 'bg-[#E82127] text-white'
                        }`}
                      >
                        {inc.resolved ? '조치 완료 (RESOLVED)' : '미결 · 관리자 조치 필요'}
                      </span>
                      <span className="text-xs font-mono text-[#9BA3B0]">{inc.occurredAt}</span>
                      <span className="text-xs font-mono font-semibold text-[#9BC1FF]">
                        {inc.plateNumber}
                      </span>
                      <span className="text-xs font-semibold text-[#F4F6F8]">
                        운전자: {inc.driverName}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-[#9BA3B0]">
                      📍 {inc.locationLabel}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-[#F4F6F8]">{inc.title}</h4>
                  <p className="text-xs text-[#9BA3B0] leading-relaxed">{inc.description}</p>

                  {/* Smartphone 6-Axis IMU Telemetry Reconstruction Box (Replacing Dashcam) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#0B0D10] border border-white/5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#636B78] block">
                        스마트폰 가속도 피크 / 속도변화
                      </span>
                      <span className="text-[#FF8080] font-semibold">
                        {inc.gForce ? `${inc.gForce}G (Δv=${inc.deltaSpeedKmh}km/h)` : '해당 없음'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#636B78] block">
                        스마트폰 자이로 회전각 (Yaw Rate)
                      </span>
                      <span className="text-[#FDB022] font-semibold">
                        {inc.gyroYawDegPerSec ? `${inc.gyroYawDegPerSec}°/sec` : '정상 범위'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#636B78] block">
                        6축 센서 역산 충격 벡터 추정
                      </span>
                      <span className="text-[#9BC1FF]">
                        {inc.impactDirection || '주행/지오펜스 이벤트'}
                      </span>
                    </div>
                  </div>

                  {/* Admin Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <input
                      type="text"
                      value={currentNote}
                      onChange={(e) =>
                        setNoteInputs((prev) => ({ ...prev, [inc.id]: e.target.value }))
                      }
                      placeholder="관리자 감사 및 사후 조치 코멘트 입력 (예: 경위서 수령, 범퍼 수리비 청구 등)"
                      className="flex-1 rounded-lg bg-[#0B0D10] border border-white/10 px-3 py-1.5 text-xs text-[#F4F6F8]"
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
                            className="px-3 py-1.5 rounded-lg bg-[#E82127]/20 hover:bg-[#E82127]/35 border border-[#E82127]/50 text-[#FF8080] text-xs font-medium"
                          >
                            운전자 배차정지 + 마감
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
                            조치 완료 승인
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

      {/* SECTION 4: Geofence, Sensor Sensitivity & Auto-Approve Policy Settings */}
      {section === 'SYSTEM_POLICY' && (
        <div className="rounded-2xl bg-[#131720] p-5 border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-[#F4F6F8] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#3E6AE1]" />
                솔루션 운영 정책 및 센서 임계치 설정 (Opelika AL HQ)
              </h3>
              <p className="text-xs text-[#9BA3B0] mt-0.5">
                본사 차고지 지오펜스 반경, 키보관함 BLE 감지 거리, 무단 운행 판단 속도, 무블랙박스 G-센서 사고 민감도, 관리자 부재 시 자동 승인 규칙을 설정합니다.
              </p>
            </div>
            {policySavedBanner && (
              <span className="px-3 py-1 rounded-full bg-[#12B76A]/20 text-[#32D583] text-xs font-mono">
                ✅ 정책 설정이 즉시 적용되었습니다
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/5 space-y-1.5">
              <label className="font-mono text-[#9BA3B0] block">
                본사 차고지 지오펜스 기준 주소
              </label>
              <input
                type="text"
                value={draftPolicy.hqAddress}
                onChange={(e) =>
                  setDraftPolicy({ ...draftPolicy, hqAddress: e.target.value })
                }
                className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-2.5 py-2 text-[#F4F6F8]"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/5 space-y-1.5">
              <label className="font-mono text-[#9BA3B0] block">
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

            <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/5 space-y-1.5">
              <label className="font-mono text-[#9BA3B0] block">
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

            <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/5 space-y-1.5">
              <label className="font-mono text-[#9BA3B0] block">
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

            <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/5 space-y-1.5">
              <label className="font-mono text-[#9BA3B0] block">
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

            <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/5 space-y-1.5">
              <label className="font-mono text-[#9BA3B0] block">
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
            <label className="p-3 rounded-xl bg-[#191E2A] border border-white/5 flex items-center justify-between cursor-pointer">
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

            <label className="p-3 rounded-xl bg-[#191E2A] border border-white/5 flex items-center justify-between cursor-pointer">
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

            <label className="p-3 rounded-xl bg-[#191E2A] border border-white/5 flex items-center justify-between cursor-pointer">
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
              관리자 정책 설정 저장 및 전체 30대 적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
