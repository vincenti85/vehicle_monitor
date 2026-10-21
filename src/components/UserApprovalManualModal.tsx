'use client';

import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  KeyRound,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  downloadManualAsHtml,
  downloadManualAsMarkdown,
} from '@/data/userApprovalManual';

interface UserApprovalManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserApprovalManualModal: React.FC<UserApprovalManualModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-4xl max-h-[88vh] rounded-2xl bg-[#131720] border border-white/15 flex flex-col overflow-hidden"
        style={{
          boxShadow: 'rgba(0, 0, 0, 0.75) 0px 24px 60px, rgba(255, 255, 255, 0.1) 0px 0px 0px 1px',
        }}
      >
        {/* Modal Header */}
        <div className="p-5 bg-[#0F131B] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3E6AE1]/20 border border-[#3E6AE1]/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#7EA0FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#F4F6F8]">
                  FleetGuard 30 사용자 신청 · 관리자 승인 통합 매뉴얼
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#12B76A]/15 text-[#32D583] border border-[#12B76A]/30">
                  4400 Northpark Dr, Opelika, AL 36801
                </span>
              </div>
              <p className="text-xs text-[#9BA3B0]">
                임직원 차량 신청·사용·반납 4단계 가이드 및 관리자 보안 PIN 인증 · CSV 일괄 등록 지침서
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadManualAsHtml}
              className="px-3 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              인쇄용 매뉴얼(.HTML) 다운로드
            </button>
            <button
              type="button"
              onClick={downloadManualAsMarkdown}
              className="px-3 py-1.5 rounded-lg bg-[#191E2A] hover:bg-white/10 border border-white/15 text-[#F4F6F8] text-xs font-medium flex items-center gap-1.5 transition"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#32D583]" />
              마크다운(.MD) 다운로드
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#9BA3B0] hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Manual Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#D0D5DD]">
          {/* Section 1: 4-Stage User Workflow */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#F4F6F8] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#3E6AE1]" />
              제1장. 사용자(임직원/운전자) 차량 신청 · 사용 · 반납 4단계 매뉴얼
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#191E2A] border border-[#F79009]/30 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F79009]/20 text-[#FDB022]">
                  STEP 1 · 신청 (REQUESTED)
                </span>
                <p className="font-semibold text-[#F4F6F8]">배차 신청서 제출</p>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  휴대폰 앱의 <strong>[정식 배차]</strong> 탭에서 본인 성명, 대기 차량(IDLE), 운행 목적, 행선지(Auburn, Montgomery 등), 사용 시간대를 입력 후 신청합니다.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#191E2A] border border-[#3E6AE1]/30 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#3E6AE1]/20 text-[#9BC1FF]">
                  STEP 2 · 승인 (APPROVED)
                </span>
                <p className="font-semibold text-[#F4F6F8]">관리자 승인 알림 수신</p>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  관리자가 승인하면 휴대폰으로 즉시 푸시 알림이 도착합니다. (관리자 부재 중 자동 승인 모드 시 신청 즉시 승인 완료)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#191E2A] border border-[#12B76A]/30 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#12B76A]/20 text-[#32D583]">
                  STEP 3 · 사용 (IN_USE)
                </span>
                <p className="font-semibold text-[#F4F6F8]">키 수령 및 블루투스 매칭</p>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  총무팀 키보관함(3m)에서 자동차키를 수령하고 <strong>[키 수령 및 사용 시작]</strong>을 누른 뒤 시동을 걸면 순정 블루투스가 자동 연결됩니다.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#191E2A] border border-white/15 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-[#F4F6F8]">
                  STEP 4 · 반납 (RETURNED)
                </span>
                <p className="font-semibold text-[#F4F6F8]">반납 및 세무일지 자동 생성</p>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  복귀 후 주차구역(Northpark Lot A/B) 및 키보관함 반납을 체크하거나, 4400 Northpark Dr 차고지(150m) 진입 + 시동 OFF 시 무조작 자동 반납됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Manager Approval & PIN Security */}
          <div className="p-4 rounded-xl bg-[#0F131B] border border-white/10 space-y-3">
            <h3 className="text-sm font-semibold text-[#F4F6F8] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#E82127]" />
              제2장. 관리자(Fleet Admin) 승인 · 보안 PIN 접속 · CSV 일괄 등록 매뉴얼
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[#131720] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[#FF8080] font-semibold">
                  <KeyRound className="w-3.5 h-3.5" />
                  1. 관리자 전용 보안 PIN 접속
                </div>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  상단 <strong>[솔루션 관리자 화면]</strong> 클릭 시 총무팀/차량관리자에게만 부여된 <strong>4자리 보안 PIN 번호(<code className="text-[#FDB022] font-mono">••••</code>)</strong>를 입력해야 관리자 콘솔에 진입할 수 있습니다.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#131720] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[#32D583] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  2. 원클릭 승인 · 반려 및 부재 모드
                </div>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  배차 워크플로우 패널에서 대기 중인 신청 건을 원클릭 <strong>[승인]</strong> 또는 <strong>[반려]</strong>하며, 외근 시에는 관리자 정책 탭에서 <strong>[관리자 부재 시 자동 승인]</strong>을 켤 수 있습니다.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#131720] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[#9BC1FF] font-semibold">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  3. 사용자 · 차량 CSV 일괄 입력
                </div>
                <p className="text-[11px] text-[#9BA3B0] leading-relaxed">
                  관리자 콘솔의 <strong>[차량 30대]</strong> 및 <strong>[임직원 통제]</strong> 탭에서 <strong>[CSV 양식 다운로드]</strong> 후 엑셀로 편집해 업로드하면 다수의 차량·사용자가 즉시 일괄 등록됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: No-Dashcam Smartphone Sensor Guide */}
          <div className="p-4 rounded-xl bg-[#191E2A] border border-[#12B76A]/30 space-y-2">
            <h3 className="text-sm font-semibold text-[#32D583] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              제3장. 무블랙박스(No-Dashcam) 스마트폰 6축 센서 사고 감지 및 무단운행 감사 수칙
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-[#D0D5DD]">
              <li>
                <strong>블랙박스 미장착 차량 사고 재구성:</strong> 운행 중 <code>2.5G</code> 이상 충격 가속도와 자이로 회전각(<code>28°/s</code> 이상) 및 급정차(<code>Δv</code>)가 동시 발생하면 서버가 사고 시각·미국 도로명 좌표·속도 곡선을 자동 박제합니다.
              </li>
              <li>
                <strong>거치대 휴대폰 낙하 오탐 자동 제외:</strong> 충격이 감지되어도 주행 속도 변화(<code>Δv = 0km/h</code>)가 없으면 거치대 단순 낙하로 판별하여 경보를 울리지 않습니다.
              </li>
              <li>
                <strong>무단 키 반출 색출:</strong> 사전 승인 없이 키를 가져가 시속 <code>15km/h</code> 이상 주행하면 차량 블루투스 MAC과 키보관함 BLE(3m) 이력으로 주 운전자를 특정해 즉시 양방향 경고음을 발송합니다.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#0F131B] border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-[#9BA3B0]">
            문서 버전: v1.2 · Opelika AL Corporate Fleet Operations
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadManualAsHtml}
              className="px-3.5 py-1.5 rounded-lg bg-[#3E6AE1] hover:bg-[#3259C7] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              매뉴얼 다운로드 (.HTML)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
