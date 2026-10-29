'use client';

import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { Vehicle, VehicleReservation } from '@/types/fleet';
import { DispatchResult } from '@/utils/dispatchRules';
import {
  MAX_FLEET_SIZE,
  ParsedVehicleCsv,
  VehicleCsvRow,
  VehicleImportMode,
  VehicleImportPlan,
  parseVehicleCsv,
  planVehicleImport,
} from '@/utils/vehicleImport';

interface VehicleImportPanelProps {
  vehicles: Vehicle[];
  reservations: VehicleReservation[];
  dataMode: 'DEMO' | 'LIVE';
  onImportVehicles: (rows: VehicleCsvRow[], mode: VehicleImportMode, source: string) => Promise<DispatchResult>;
  onClearDemoData: (removeDemoEmployees: boolean) => Promise<{ ok: boolean; message: string }>;
}

const CSV_HEADERS = [
  'fleetNumber',
  'plateNumber',
  'modelName',
  'btMacAddress',
  'bleBeaconUuid',
  'cumulativeGpsKm',
  'parkingZone',
] as const;

const MAX_ERRORS_SHOWN = 8;

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(fileName: string, lines: string[]) {
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function describePlan(plan: VehicleImportPlan, mode: VehicleImportMode): string {
  const parts = [`신규 ${plan.added.length}대`, `갱신 ${plan.updated.length}대`];
  if (mode === 'REPLACE') parts.push(`삭제 ${plan.removed.length}대`);
  return parts.join(' · ');
}

export const VehicleImportPanel: React.FC<VehicleImportPanelProps> = ({
  vehicles,
  reservations,
  dataMode,
  onImportVehicles,
  onClearDemoData,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedVehicleCsv | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [removeDemoEmployees, setRemoveDemoEmployees] = useState<boolean>(true);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);

  const protectBusy = dataMode === 'LIVE';
  const plans = useMemo(() => {
    if (!parsed || parsed.rows.length === 0) return null;
    const ts = new Date().toTimeString().slice(0, 8);
    return {
      REPLACE: planVehicleImport(vehicles, reservations, parsed.rows, 'REPLACE', protectBusy, ts),
      UPSERT: planVehicleImport(vehicles, reservations, parsed.rows, 'UPSERT', protectBusy, ts),
    };
  }, [parsed, vehicles, reservations, protectBusy]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileName(file.name);
      setParsed(parseVehicleCsv(String(evt.target?.result ?? '')));
      setResult(null);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleApply = async (mode: VehicleImportMode) => {
    if (!parsed || !plans) return;
    setApplying(true);
    // The server recomputes the plan against the latest data and is the final word
    const res = await onImportVehicles(parsed.rows, mode, `CSV ${fileName}`);
    setApplying(false);
    setResult(
      res.ok
        ? { ok: true, message: `✅ ${res.message}. 차량 정보가 바뀌었으면 QR 키고리 시트를 다시 인쇄하세요.` }
        : res
    );
    if (res.ok) setParsed(null);
  };

  const handleClearDemo = async () => {
    setClearing(true);
    const res = await onClearDemoData(removeDemoEmployees);
    setClearing(false);
    setConfirmClear(false);
    setResult(res);
  };

  const errors = parsed?.errors ?? [];
  const replaceBlocked =
    !plans || errors.length > 0 || plans.REPLACE.plateConflicts.length > 0;
  const upsertBlocked = !plans || plans.UPSERT.plateConflicts.length > 0;

  return (
    <div className="rounded-xl border border-[#3E6AE1]/30 bg-[#EFF6FF] p-4 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="hidden"
        data-testid="vehicle-csv-input"
      />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#1D4ED8]" />
            실제 차량 정보 등록 (CSV)
            {dataMode === 'DEMO' ? (
              <span className="px-2 py-0.5 rounded-full bg-[#F79009]/15 text-[#B45309] text-[10px] font-mono">
                현재: 샘플(더미) 데이터
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#047857] text-[10px] font-mono">
                현재: 실운영 데이터
              </span>
            )}
          </h4>
          <p className="text-xs text-[#52525B]">
            {dataMode === 'DEMO'
              ? `빈 양식 작성 → 업로드·미리보기 → 전체 교체 → 실운영 전환. 호차 번호(1~${MAX_FLEET_SIZE})가 QR 기준입니다.`
              : '목록을 내보내 고친 뒤 다시 업로드하세요. 운행중 차량은 보호됩니다.'}
          </p>
          <p
            className="text-[11px] font-mono text-[#71717A]"
            title={`열: ${CSV_HEADERS.join(', ')} · MAC 형식 A4:C1:38:7F:01:03`}
          >
            필수 열: fleetNumber, plateNumber, modelName
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadCsv('차량등록_빈양식_FleetGuard30.csv', [CSV_HEADERS.join(',')])}
            className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/5 border border-black/15 text-xs text-[#0A0A0A] flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#1D4ED8]" />
            빈 CSV 양식
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv('차량목록_현재_FleetGuard30.csv', [
                CSV_HEADERS.join(','),
                ...[...vehicles]
                  .sort((a, b) => a.fleetNumber - b.fleetNumber)
                  .map((v) =>
                    [v.fleetNumber, v.plateNumber, v.modelName, v.btMacAddress, v.bleBeaconUuid, v.lastVerifiedOdometerKm, v.parkingZone]
                      .map(csvCell)
                      .join(',')
                  ),
              ])
            }
            className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/5 border border-black/15 text-xs text-[#0A0A0A] flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#1D4ED8]" />
            현재 목록 내보내기
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            CSV 업로드 (미리보기)
          </button>
        </div>
      </div>

      {parsed && (
        <div className="rounded-lg bg-[#FFFFFF] border border-black/10 p-3 space-y-2 text-xs" data-testid="vehicle-import-preview">
          <div className="font-semibold text-[#0A0A0A]">
            미리보기: {fileName} · 정상 {parsed.rows.length}행 · 오류 {errors.length}행
          </div>

          {errors.length > 0 && (
            <ul className="space-y-0.5 text-[#DC2626]">
              {errors.slice(0, MAX_ERRORS_SHOWN).map((err) => (
                <li key={`${err.line}-${err.message}`}>
                  {err.line}행: {err.message}
                </li>
              ))}
              {errors.length > MAX_ERRORS_SHOWN && <li>외 {errors.length - MAX_ERRORS_SHOWN}건</li>}
            </ul>
          )}

          {plans && (
            <div className="grid md:grid-cols-2 gap-2">
              {(['REPLACE', 'UPSERT'] as const).map((mode) => {
                const plan = plans[mode];
                const blocked = mode === 'REPLACE' ? replaceBlocked : upsertBlocked;
                return (
                  <div key={mode} className="rounded-md bg-[#F4F4F5] p-2.5 space-y-1">
                    <div className="font-semibold text-[#0A0A0A]">
                      {mode === 'REPLACE' ? 'CSV로 전체 교체' : '추가·갱신만 (나머지 유지)'}
                    </div>
                    <div className="text-[#52525B]">{describePlan(plan, mode)}</div>
                    {mode === 'REPLACE' && plan.removed.length > 0 && (
                      <div className="text-[#B45309]">
                        삭제 대상: {plan.removed.map((v) => `#${v.fleetNumber}`).join(', ')}
                      </div>
                    )}
                    {plan.blockedRemovals.length > 0 && (
                      <div className="text-[#B45309]">
                        운행중·예약 있어 유지: {plan.blockedRemovals.map((v) => `#${v.fleetNumber}`).join(', ')}
                      </div>
                    )}
                    {plan.odometerSkipped.length > 0 && (
                      <div className="text-[#B45309]">
                        운행중이라 계기판 미반영: {plan.odometerSkipped.map((n) => `#${n}`).join(', ')}
                      </div>
                    )}
                    {plan.missingOdometer.length > 0 && (
                      <div className="text-[#B45309]">
                        계기판 미입력(0km로 등록, 실사 대조 필요): {plan.missingOdometer.map((n) => `#${n}`).join(', ')}
                      </div>
                    )}
                    {plan.plateConflicts.length > 0 && (
                      <div className="text-[#DC2626]">번호판 충돌: {plan.plateConflicts.join(', ')}</div>
                    )}
                    {mode === 'REPLACE' && errors.length > 0 && (
                      <div className="text-[#DC2626]">오류 행이 있으면 전체 교체할 수 없습니다 (해당 차량이 삭제될 수 있음).</div>
                    )}
                    <button
                      type="button"
                      disabled={blocked || applying}
                      onClick={() => void handleApply(mode)}
                      className={`mt-1 px-3 py-1.5 rounded-md text-xs font-semibold ${
                        blocked
                          ? 'bg-[#E4E4E7] text-[#A1A1AA] cursor-not-allowed'
                          : mode === 'REPLACE'
                            ? 'bg-[#0A0A0A] text-[#FAFAFA] hover:bg-[#27272A]'
                            : 'bg-[#3E6AE1] text-white hover:bg-[#3259C7]'
                      }`}
                    >
                      {mode === 'REPLACE' ? '전체 교체 적용' : '추가·갱신 적용'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button type="button" onClick={() => setParsed(null)} className="text-[11px] underline text-[#52525B]">
            취소
          </button>
        </div>
      )}

      {dataMode === 'DEMO' && (
        <div className="rounded-lg bg-[#FFFFFF] border border-[#F79009]/40 p-3 space-y-2 text-xs">
          <div className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B45309]" />
            데모 기록 정리 후 실운영 전환 (1회)
          </div>
          <p className="text-[#52525B]">
            샘플 기록을 모두 지우고 차량을 차고지 대기로 돌립니다. 되돌릴 수 없습니다.
          </p>
          <label className="flex items-center gap-1.5 text-[#0A0A0A]">
            <input
              type="checkbox"
              checked={removeDemoEmployees}
              onChange={(e) => setRemoveDemoEmployees(e.target.checked)}
            />
            샘플 임직원도 삭제 (실제 임직원이 있을 때만)
          </label>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[#DC2626] font-semibold">정말 실운영으로 전환할까요?</span>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearDemo}
                className="px-3 py-1.5 rounded-md bg-[#DC2626] text-white font-semibold"
              >
                {clearing ? '전환 중…' : '전환 확인'}
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="underline text-[#52525B]">
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-3 py-1.5 rounded-md bg-[#F79009] hover:bg-[#B45309] text-white font-semibold"
            >
              데모 기록 정리 후 실운영 전환
            </button>
          )}
        </div>
      )}

      {result && (
        <div
          role="status"
          className={`rounded-lg p-2.5 text-xs flex items-start gap-1.5 ${
            result.ok ? 'bg-[#10B981]/10 text-[#047857]' : 'bg-[#FF5B4F]/10 text-[#DC2626]'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
};
