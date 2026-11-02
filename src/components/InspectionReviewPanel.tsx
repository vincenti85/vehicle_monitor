'use client';

import React, { useState } from 'react';
import { ClipboardCheck, Lock, MapPin } from 'lucide-react';
import { Employee, InspectionTemplateItem, Vehicle, VehicleInspection } from '@/types/fleet';
import { DispatchResult } from '@/utils/dispatchRules';
import { localDate, localTime } from '@/domain/clock';

interface InspectionReviewPanelProps {
  inspections: VehicleInspection[];
  vehicles: Vehicle[];
  employees: Employee[];
  template: readonly InspectionTemplateItem[];
  onResolve: (inspectionId: string, resolution: string) => Promise<DispatchResult>;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${localDate(d).slice(5).replace('-', '/')} ${localTime(d).slice(0, 5)}`;
};

/** Admin review of submitted checklists: failed ones first, fix note clears an inspection lock. */
export const InspectionReviewPanel: React.FC<InspectionReviewPanelProps> = ({ inspections, vehicles, employees, template, onResolve }) => {
  const [failedOnly, setFailedOnly] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<DispatchResult | null>(null);
  const [busy, setBusy] = useState(false);

  const label = (itemId: string) => template.find((t) => t.id === itemId)?.label ?? itemId;
  const unit = (vehicleId: string) => vehicles.find((v) => v.id === vehicleId);
  const driver = (employeeId: string) => employees.find((e) => e.id === employeeId)?.name.split(' (')[0] ?? employeeId;
  const shown = inspections.filter((i) => !failedOnly || i.failedItems > 0);

  const resolve = async (id: string) => {
    setBusy(true);
    try {
      const result = await onResolve(id, (notes[id] ?? '').trim());
      setNotice(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[#FFFFFF] p-5 border border-black/10 space-y-3">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/10">
        <h3 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#3E6AE1]" />
          운행 전·후 점검
        </h3>
        <label className="flex items-center gap-1.5 text-xs text-[#52525B]">
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
          불합격만
        </label>
      </div>
      {notice && <p className={`text-xs ${notice.ok ? 'text-[#047857]' : 'text-[#B91C1C]'}`}>{notice.message}</p>}
      {shown.length === 0 && <p className="text-xs text-[#71717A]">표시할 점검 기록이 없습니다.</p>}
      <ul className="space-y-2">
        {shown.map((i) => {
          const v = unit(i.vehicleId);
          const holdsLock = v?.lockReason === 'INSPECTION_FAILED' && v.lockInspectionId === i.id;
          const open = openId === i.id;
          return (
            <li key={i.id} className="rounded-lg bg-[#FAFAFA] p-3 text-xs space-y-2" style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}>
              <button type="button" onClick={() => setOpenId(open ? null : i.id)} className="w-full flex flex-wrap items-center gap-2 text-left">
                <span className="font-mono font-medium text-[#0A0A0A]">#{v?.fleetNumber ?? '?'}호차</span>
                <span>{i.kind === 'PRE_TRIP' ? '운행 전' : '운행 후'}</span>
                <span className="text-[#52525B]">{driver(i.employeeId)}</span>
                <span className="text-[#71717A]">{when(i.submittedAt)}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono ${i.failedItems === 0 ? 'bg-[#10B981]/15 text-[#047857]' : i.criticalFailed ? 'bg-[#DC2626]/15 text-[#B91C1C]' : 'bg-[#F59E0B]/15 text-[#B45309]'}`}>
                  {i.failedItems === 0 ? '이상 없음' : `불합격 ${i.failedItems}${i.criticalFailed ? ' · 핵심' : ''}`}
                </span>
                {holdsLock && <Lock className="w-3.5 h-3.5 text-[#DC2626]" aria-label="잠금 중" />}
                {i.resolvedAt && <span className="text-[10px] text-[#047857]">조치 완료</span>}
              </button>
              {open && (
                <div className="space-y-2">
                  <ul className="space-y-0.5">
                    {i.items.filter((item) => !item.passed).map((item) => (
                      <li key={item.itemId} className="text-[#B91C1C]">✕ {label(item.itemId)} — {item.note}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#52525B] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {i.gpsUnavailable || i.submitLat === null
                      ? '위치 정보 없음(권한 거부 또는 측위 실패)'
                      : `${i.submitLat.toFixed(5)}, ${i.submitLng?.toFixed(5)} (±${Math.round(i.accuracyM ?? 0)}m, 참고용)`}
                    {' · '}서버 기록 {when(i.submittedAt)}
                  </p>
                  {i.resolvedAt ? (
                    <p className="text-[11px] text-[#047857]">조치: {i.resolution} ({when(i.resolvedAt)})</p>
                  ) : (
                    i.failedItems > 0 && (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          maxLength={300}
                          value={notes[i.id] ?? ''}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [i.id]: e.target.value }))}
                          placeholder="조치 내용 (필수)"
                          aria-label="조치 내용"
                          className="flex-1 rounded bg-[#FFFFFF] px-2 py-1 text-xs"
                          style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
                        />
                        <button
                          type="button"
                          disabled={busy || !(notes[i.id] ?? '').trim()}
                          onClick={() => void resolve(i.id)}
                          className="px-3 py-1 rounded bg-[#3E6AE1] text-white text-xs disabled:opacity-50"
                        >
                          {holdsLock ? '조치 완료 · 잠금 해제' : '조치 완료'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
