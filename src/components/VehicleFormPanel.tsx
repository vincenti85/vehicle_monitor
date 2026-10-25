'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, PencilLine, Plus } from 'lucide-react';
import { Vehicle, VehicleReservation } from '@/types/fleet';
import { DispatchResult } from '@/utils/dispatchRules';
import {
  MAX_FLEET_SIZE,
  VehicleImportMode,
  VehicleInputValues,
  VehicleCsvRow,
  planVehicleImport,
  validateVehicleInput,
} from '@/utils/vehicleImport';

interface VehicleFormPanelProps {
  vehicles: Vehicle[];
  reservations: VehicleReservation[];
  dataMode: 'DEMO' | 'LIVE';
  onImportVehicles: (rows: VehicleCsvRow[], mode: VehicleImportMode, source: string) => Promise<DispatchResult>;
}

const NEW_VEHICLE = 'NEW';
const EMPTY_FORM: VehicleInputValues = {
  fleetNumber: '',
  plateNumber: '',
  modelName: '',
  btMacAddress: '',
  bleBeaconUuid: '',
  cumulativeGpsKm: '',
  parkingZone: '',
};

const inputClass =
  'w-full rounded-md bg-[#FFFFFF] border border-black/15 px-2.5 py-1.5 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#3E6AE1]';

function formFromVehicle(v: Vehicle): VehicleInputValues {
  return {
    fleetNumber: String(v.fleetNumber),
    plateNumber: v.plateNumber,
    modelName: v.modelName,
    btMacAddress: v.btMacAddress,
    bleBeaconUuid: v.bleBeaconUuid,
    // Blank = keep current odometer; prefilling would overwrite the GPS total on save
    cumulativeGpsKm: '',
    parkingZone: v.parkingZone,
  };
}

export const VehicleFormPanel: React.FC<VehicleFormPanelProps> = ({
  vehicles,
  reservations,
  dataMode,
  onImportVehicles,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [target, setTarget] = useState<string>(NEW_VEHICLE);
  const [form, setForm] = useState<VehicleInputValues>(EMPTY_FORM);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const sorted = useMemo(
    () => [...vehicles].sort((a, b) => a.fleetNumber - b.fleetNumber),
    [vehicles]
  );
  const freeNumbers = useMemo(() => {
    const used = new Set(vehicles.map((v) => v.fleetNumber));
    return Array.from({ length: MAX_FLEET_SIZE }, (_, i) => i + 1).filter((n) => !used.has(n));
  }, [vehicles]);
  const editing = target === NEW_VEHICLE ? undefined : vehicles.find((v) => v.id === target);

  const selectTarget = (value: string) => {
    setTarget(value);
    setResult(null);
    const veh = vehicles.find((v) => v.id === value);
    setForm(veh ? formFromVehicle(veh) : { ...EMPTY_FORM, fleetNumber: String(freeNumbers[0] ?? '') });
  };

  const setField = (key: keyof VehicleInputValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = editing ? { ...form, fleetNumber: String(editing.fleetNumber) } : form;
    const { row, error } = validateVehicleInput(values);
    if (!row) {
      setResult({ ok: false, message: error ?? '입력값을 확인하세요.' });
      return;
    }
    if (!editing && vehicles.some((v) => v.fleetNumber === row.fleetNumber)) {
      setResult({ ok: false, message: `#${row.fleetNumber}호차는 이미 등록되어 있습니다. 수정으로 선택하세요.` });
      return;
    }

    const plan = planVehicleImport(
      vehicles,
      reservations,
      [row],
      'UPSERT',
      dataMode === 'LIVE',
      new Date().toTimeString().slice(0, 8)
    );
    if (plan.plateConflicts.length > 0) {
      setResult({ ok: false, message: `번호판이 다른 차량과 중복됩니다: ${plan.plateConflicts.join(', ')}` });
      return;
    }

    const unit = `#${row.fleetNumber.toString().padStart(2, '0')}호차`;
    const action = editing ? '정보 수정' : '신규 등록';
    setSaving(true);
    const res = await onImportVehicles([row], 'UPSERT', `관리자 직접 입력: ${unit} ${action} (${row.plateNumber} · ${row.modelName})`);
    setSaving(false);
    if (!res.ok) {
      setResult(res);
      return;
    }

    const notes = [
      plan.odometerSkipped.length > 0 ? '운행중이라 계기판 값은 반영하지 않았습니다.' : '',
      plan.missingOdometer.length > 0 ? '계기판 미입력으로 0km 등록됨 — 실사 대조로 입력하세요.' : '',
      '번호판이 바뀌었으면 QR 키고리 시트를 다시 인쇄하세요.',
    ].filter(Boolean);
    setResult({ ok: true, message: `✅ ${unit} ${action} 완료. ${notes.join(' ')}` });

    const saved = plan.next.find((v) => v.fleetNumber === row.fleetNumber);
    if (saved) {
      setTarget(saved.id);
      setForm(formFromVehicle(saved));
    }
  };

  return (
    <div className="rounded-xl border border-black/10 bg-[#FFFFFF] p-4 space-y-3" data-testid="vehicle-form-panel">
      <button
        type="button"
        onClick={() => {
          setOpen((p) => !p);
          if (open) return;
          // Fleet full: start on the first vehicle for editing instead of a disabled "new" form
          const initial =
            target === NEW_VEHICLE && freeNumbers.length === 0 && sorted[0] ? sorted[0].id : target;
          selectTarget(initial);
        }}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
          <PencilLine className="w-4 h-4 text-[#1D4ED8]" />
          차량 정보 직접 등록 · 수정 (관리자)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[#52525B]" /> : <ChevronDown className="w-4 h-4 text-[#52525B]" />}
      </button>

      {open && (
        <form onSubmit={handleSave} className="space-y-3" data-testid="vehicle-form">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="text-[#52525B]" htmlFor="vehicle-form-target">대상</label>
            <select
              id="vehicle-form-target"
              value={target}
              onChange={(e) => selectTarget(e.target.value)}
              className="rounded-md bg-[#FFFFFF] border border-black/15 px-2.5 py-1.5 text-xs text-[#0A0A0A]"
            >
              <option value={NEW_VEHICLE} disabled={freeNumbers.length === 0}>
                ＋ 신규 차량 등록{freeNumbers.length === 0 ? ` (최대 ${MAX_FLEET_SIZE}대 등록됨)` : ''}
              </option>
              {sorted.map((v) => (
                <option key={v.id} value={v.id}>
                  #{v.fleetNumber.toString().padStart(2, '0')}호차 · {v.plateNumber} 수정
                </option>
              ))}
            </select>
            {editing && editing.status !== 'IDLE' && (
              <span className="text-[#B45309]">운행중 차량: 계기판 값은 반납 후 반영됩니다.</span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <label className="space-y-1">
              <span className="text-[#52525B]">호차 번호 *</span>
              {editing ? (
                <input value={`#${editing.fleetNumber}호차 (QR 연결, 변경 불가)`} disabled className={`${inputClass} bg-[#F4F4F5] text-[#52525B]`} />
              ) : (
                <select value={form.fleetNumber} onChange={setField('fleetNumber')} className={inputClass} required>
                  {freeNumbers.map((n) => (
                    <option key={n} value={n}>#{n.toString().padStart(2, '0')}호차</option>
                  ))}
                </select>
              )}
            </label>
            <label className="space-y-1">
              <span className="text-[#52525B]">번호판 *</span>
              <input value={form.plateNumber} onChange={setField('plateNumber')} placeholder="AL 41A-2237" className={inputClass} required maxLength={20} />
            </label>
            <label className="space-y-1 col-span-2">
              <span className="text-[#52525B]">차종 *</span>
              <input value={form.modelName} onChange={setField('modelName')} placeholder="2025 Hyundai Santa Fe XRT" className={inputClass} required maxLength={60} />
            </label>
            <label className="space-y-1">
              <span className="text-[#52525B]">계기판 주행거리 (km)</span>
              <input
                value={form.cumulativeGpsKm}
                onChange={setField('cumulativeGpsKm')}
                inputMode="decimal"
                placeholder={editing ? `현재 ${editing.lastVerifiedOdometerKm} · 비우면 유지` : '예: 18250.4'}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[#52525B]">지정 주차면</span>
              <input value={form.parkingZone} onChange={setField('parkingZone')} placeholder="Northpark Lot A #08" className={inputClass} maxLength={60} />
            </label>
            <label className="space-y-1">
              <span className="text-[#52525B]">순정 블루투스 MAC</span>
              <input value={form.btMacAddress} onChange={setField('btMacAddress')} placeholder="A4:C1:38:7F:01:03" className={`${inputClass} font-mono`} />
            </label>
            <label className="space-y-1">
              <span className="text-[#52525B]">키 태그 ID</span>
              <input value={form.bleBeaconUuid} onChange={setField('bleBeaconUuid')} placeholder="비우면 FG30-NN 자동" className={`${inputClass} font-mono`} />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              {editing ? <PencilLine className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {editing ? '수정 저장' : '신규 등록'}
            </button>
            <span className="text-[11px] text-[#71717A]">* 필수 · CSV 업로드와 같은 규칙으로 검증합니다</span>
          </div>
        </form>
      )}

      {result && (
        <div
          role="status"
          className={`rounded-lg p-2.5 text-xs flex items-start gap-1.5 ${
            result.ok ? 'bg-[#10B981]/10 text-[#047857]' : 'bg-[#FF5B4F]/10 text-[#DC2626]'
          }`}
        >
          {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
};
