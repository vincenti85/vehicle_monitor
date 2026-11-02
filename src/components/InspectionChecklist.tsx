'use client';

import React, { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { InspectionAnswers } from '@/domain/inspection';
import { captureGpsStamp, GpsStamp } from '@/hooks/gpsStamp';
import { InspectionKind, InspectionTemplateItem } from '@/types/fleet';

interface InspectionChecklistProps {
  kind: InspectionKind;
  template: readonly InspectionTemplateItem[];
  /** Receives the answers and GPS stamp; the parent sends the action. */
  onSubmit: (answers: InspectionAnswers) => void | Promise<unknown>;
  submitLabel: string;
  /** Extra condition from the parent (e.g. key returned). */
  disabled?: boolean;
  isEng?: boolean;
}

type Answer = { passed: boolean | null; note: string };

/** Every item starts unanswered so the driver must choose each one (no one-tap "all pass"). */
export const InspectionChecklist: React.FC<InspectionChecklistProps> = ({
  kind,
  template,
  onSubmit,
  submitLabel,
  disabled = false,
  isEng = false,
}) => {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [opened, setOpened] = useState<{ at: string; stamp: GpsStamp | null } | null>(null);
  const [sending, setSending] = useState(false);

  // Opening the checklist records when and where the inspection started
  useEffect(() => {
    let cancelled = false;
    const at = new Date().toISOString();
    void captureGpsStamp().then((stamp) => {
      if (!cancelled) setOpened({ at, stamp });
    });
    setOpened({ at, stamp: null });
    return () => {
      cancelled = true;
    };
  }, []);

  const answer = (id: string): Answer => answers[id] ?? { passed: null, note: '' };
  const set = (id: string, patch: Partial<Answer>) => setAnswers((prev) => ({ ...prev, [id]: { ...answer(id), ...patch } }));
  const missing = template.filter((t) => {
    const a = answer(t.id);
    return a.passed === null || (a.passed === false && a.note.trim() === '');
  });
  const criticalFailed = template.some((t) => t.critical && answer(t.id).passed === false);

  const submit = async () => {
    if (missing.length > 0 || sending) return;
    setSending(true);
    try {
      const stamp = await captureGpsStamp();
      await onSubmit({
        items: template.map((t) => ({ itemId: t.id, passed: answer(t.id).passed === true, note: answer(t.id).note.trim() })),
        startedAt: opened?.at ?? new Date().toISOString(),
        startLat: opened?.stamp?.lat ?? null,
        startLng: opened?.stamp?.lng ?? null,
        submitLat: stamp?.lat ?? null,
        submitLng: stamp?.lng ?? null,
        accuracyM: stamp?.accuracyM ?? null,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-md bg-[#FFFFFF] p-2" style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}>
      <span className="flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A]">
        <ClipboardCheck className="w-3.5 h-3.5" />
        {kind === 'PRE_TRIP' ? (isEng ? 'Pre-trip inspection' : '운행 전 점검') : isEng ? 'Post-trip inspection' : '운행 후 점검'}
        <span className="ml-auto font-mono text-[10px] text-[#71717A]">
          {template.length - missing.length}/{template.length}
        </span>
      </span>
      <ul className="space-y-1">
        {template.map((t) => {
          const a = answer(t.id);
          return (
            <li key={t.id} className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="flex-1 text-[#0A0A0A]">
                  {t.label}
                  {t.critical && <span className="ml-1 text-[10px] text-[#DC2626]">{isEng ? 'critical' : '핵심'}</span>}
                </span>
                <button
                  type="button"
                  aria-pressed={a.passed === true}
                  onClick={() => set(t.id, { passed: true })}
                  className={`min-h-8 px-2 rounded text-[11px] ${a.passed === true ? 'bg-[#10B981] text-white' : 'bg-[#F4F4F5] text-[#52525B]'}`}
                >
                  {isEng ? 'Pass' : '합격'}
                </button>
                <button
                  type="button"
                  aria-pressed={a.passed === false}
                  onClick={() => set(t.id, { passed: false })}
                  className={`min-h-8 px-2 rounded text-[11px] ${a.passed === false ? 'bg-[#DC2626] text-white' : 'bg-[#F4F4F5] text-[#52525B]'}`}
                >
                  {isEng ? 'Fail' : '불합격'}
                </button>
              </div>
              {a.passed === false && (
                <input
                  type="text"
                  maxLength={200}
                  value={a.note}
                  onChange={(e) => set(t.id, { note: e.target.value })}
                  placeholder={isEng ? 'What is wrong? (required)' : '이상 내용 (필수)'}
                  aria-label={`${t.label} ${isEng ? 'note' : '메모'}`}
                  className="w-full rounded bg-[#FEF2F2] px-2 py-1 text-[11px] text-[#0A0A0A]"
                />
              )}
            </li>
          );
        })}
      </ul>
      {criticalFailed && (
        <p className="text-[10px] text-[#B91C1C]">
          {isEng ? 'A failed critical item locks this vehicle until a manager clears it.' : '핵심 항목 불합격 시 차량이 잠기고 관리자 조치 후 해제됩니다.'}
        </p>
      )}
      <button
        type="button"
        disabled={disabled || sending || missing.length > 0}
        onClick={() => void submit()}
        className="w-full min-h-9 rounded bg-[#0A72EF] text-white text-xs font-medium disabled:opacity-50"
      >
        {sending ? (isEng ? 'Sending…' : '전송 중…') : submitLabel}
      </button>
    </div>
  );
};
