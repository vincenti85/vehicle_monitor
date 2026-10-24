'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  Globe,
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
import { AppLang } from '@/utils/i18n';

interface UserApprovalManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: AppLang;
}

export const UserApprovalManualModal: React.FC<UserApprovalManualModalProps> = ({
  isOpen,
  onClose,
  lang = 'KOR',
}) => {
  const [modalLang, setModalLang] = useState<AppLang>(lang);

  useEffect(() => {
    setModalLang(lang);
  }, [lang, isOpen]);

  const isEng = modalLang === 'ENG';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-4xl max-h-[88vh] rounded-2xl bg-[#FAFAFA] border border-black/15 flex flex-col overflow-hidden"
        style={{
          boxShadow:
            'rgba(0, 0, 0, 0.14) 0px 24px 60px, rgba(0, 0, 0, 0.1) 0px 0px 0px 1px',
        }}
      >
        {/* Modal Header */}
        <div className="p-5 bg-[#F4F4F5] border-b border-black/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A72EF]/20 border border-[#0A72EF]/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#1D4ED8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#0A0A0A]">
                  {isEng
                    ? 'FleetGuard 30 User Request & Manager Approval Manual'
                    : 'FleetGuard 30 사용자 신청 · 관리자 승인 통합 매뉴얼'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#10B981]/15 text-[#047857] border border-[#10B981]/30">
                  4400 Northpark Dr, Opelika, AL 36801
                </span>
              </div>
              <p className="text-xs text-[#52525B]">
                {isEng
                  ? '4-Stage Employee Dispatch Workflow, Manager Security PIN Authentication & CSV Bulk Registration Guide'
                  : '임직원 차량 신청·사용·반납 4단계 가이드 및 관리자 보안 PIN 인증 · CSV 일괄 등록 지침서'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Modal Language Switcher (KOR / ENG) */}
            <div
              className="flex items-center bg-[#FFFFFF] p-0.5 rounded-md text-[11px] font-mono border border-black/10"
              role="group"
            >
              <Globe className="w-3 h-3 text-[#71717A] ml-1.5 mr-1" />
              <button
                type="button"
                onClick={() => setModalLang('KOR')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  modalLang === 'KOR'
                    ? 'bg-[#0A0A0A] text-[#FAFAFA]'
                    : 'text-[#71717A] hover:text-[#0A0A0A]'
                }`}
              >
                KOR
              </button>
              <button
                type="button"
                onClick={() => setModalLang('ENG')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  modalLang === 'ENG'
                    ? 'bg-[#0A72EF] text-white'
                    : 'text-[#71717A] hover:text-[#0A0A0A]'
                }`}
              >
                ENG
              </button>
            </div>

            <button
              type="button"
              onClick={() => downloadManualAsHtml(modalLang)}
              className="px-3 py-1.5 rounded-lg bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              {isEng ? 'Printable Manual (.HTML)' : '인쇄용 매뉴얼(.HTML) 다운로드'}
            </button>
            <button
              type="button"
              onClick={() => downloadManualAsMarkdown(modalLang)}
              className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/5 border border-black/15 text-[#0A0A0A] text-xs font-medium flex items-center gap-1.5 transition"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#047857]" />
              {isEng ? 'Markdown (.MD)' : '마크다운(.MD) 다운로드'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-black/[0.03] hover:bg-black/[0.07] text-[#52525B] hover:text-[#0A0A0A] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Manual Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#3F3F46]">
          {/* Section 1: 4-Stage User Workflow */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#0A72EF]" />
              {isEng
                ? 'Chapter 1. Employee (Driver) 4-Stage Request · Dispatch · Return Manual'
                : '제1장. 사용자(임직원/운전자) 차량 신청 · 사용 · 반납 4단계 매뉴얼'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#F59E0B]/30 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FBBF24]/20 text-[#B45309]">
                  {isEng ? 'STEP 1 · REQUESTED' : 'STEP 1 · 신청 (REQUESTED)'}
                </span>
                <p className="font-semibold text-[#0A0A0A]">
                  {isEng ? 'Submit Dispatch Request' : '배차 신청서 제출'}
                </p>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      In the mobile app&apos;s <strong>[1. Request Vehicle]</strong> tab, select your name, an available vehicle (<code>IDLE</code>), trip purpose, destination (Auburn, Montgomery, etc.), and time window.
                    </>
                  ) : (
                    <>
                      휴대폰 앱의 <strong>[1. 차량 신청]</strong> 탭에서 본인 성명, 대기 차량(IDLE), 운행 목적, 행선지(Auburn, Montgomery 등), 사용 시간대를 입력 후 신청합니다.
                    </>
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#0A72EF]/30 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0A72EF]/20 text-[#1D4ED8]">
                  {isEng ? 'STEP 2 · APPROVED' : 'STEP 2 · 승인 (APPROVED)'}
                </span>
                <p className="font-semibold text-[#0A0A0A]">
                  {isEng ? 'Receive Approval Push' : '관리자 승인 알림 수신'}
                </p>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      Once approved by the Fleet Manager, an instant push notification arrives on your phone. (If <strong>Auto-Approve ON</strong> is active, requests are approved immediately.)
                    </>
                  ) : (
                    <>
                      관리자가 승인하면 휴대폰으로 즉시 푸시 알림이 도착합니다. (관리자 부재 중 자동 승인 모드 시 신청 즉시 승인 완료)
                    </>
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#10B981]/30 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/20 text-[#047857]">
                  {isEng ? 'STEP 3 · IN_USE' : 'STEP 3 · 사용 (IN_USE)'}
                </span>
                <p className="font-semibold text-[#0A0A0A]">
                  {isEng ? 'Pick Up Key & Pair Bluetooth' : '키 수령 및 블루투스 매칭'}
                </p>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      Pick up the physical key fob from the HQ Keybox (3m BLE), tap <strong>[Start Trip]</strong>, and start the engine. The car&apos;s factory Bluetooth (MAC) connects automatically.
                    </>
                  ) : (
                    <>
                      총무팀 키보관함(3m)에서 자동차키를 수령하고 <strong>[키 수령 및 사용 시작]</strong>을 누른 뒤 시동을 걸면 순정 블루투스가 자동 연결됩니다.
                    </>
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-black/15 space-y-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/5 text-[#0A0A0A]">
                  {isEng ? 'STEP 4 · RETURNED' : 'STEP 4 · 반납 (RETURNED)'}
                </span>
                <p className="font-semibold text-[#0A0A0A]">
                  {isEng ? 'Return & Auto Tax Logbook' : '반납 및 세무일지 자동 생성'}
                </p>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      Select your parking spot (Northpark Lot A/B) and check key return, or simply enter the <code>4400 Northpark Dr</code> 150m garage geofence and turn off the ignition for hands-free auto-return.
                    </>
                  ) : (
                    <>
                      복귀 후 주차구역(Northpark Lot A/B) 및 키보관함 반납을 체크하거나, 4400 Northpark Dr 차고지(150m) 진입 + 시동 OFF 시 무조작 자동 반납됩니다.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Manager Approval & PIN Security */}
          <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-3">
            <h3 className="text-sm font-semibold text-[#0A0A0A] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#E82127]" />
              {isEng
                ? 'Chapter 2. Fleet Manager Approval · Security PIN · CSV Bulk Registration Manual'
                : '제2장. 관리자(Fleet Admin) 승인 · 보안 PIN 접속 · CSV 일괄 등록 매뉴얼'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[#FFFFFF] border border-black/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[#DC2626] font-semibold">
                  <KeyRound className="w-3.5 h-3.5" />
                  {isEng
                    ? '1. Private 4-Digit Security PIN'
                    : '1. 관리자 전용 보안 PIN 접속'}
                </div>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      Clicking <strong>[3. Admin Console (PIN)]</strong> requires the <strong>4-digit private security PIN (<code className="text-[#B45309] font-mono">••••</code>)</strong> assigned exclusively to Fleet Managers.
                    </>
                  ) : (
                    <>
                      상단 <strong>[3. 관리자 설정 (PIN)]</strong> 클릭 시 총무팀/차량관리자에게만 부여된 <strong>4자리 보안 PIN 번호(<code className="text-[#B45309] font-mono">••••</code>)</strong>를 입력해야 관리자 콘솔에 진입할 수 있습니다.
                    </>
                  )}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#FFFFFF] border border-black/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[#047857] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isEng
                    ? '2. One-Click Approve & Auto-Approve'
                    : '2. 원클릭 승인 · 반려 및 부재 모드'}
                </div>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      Click <strong>[Approve]</strong> or <strong>[Reject]</strong> on pending requests in the Dispatch Board, or toggle <strong>[Auto-Approve ON]</strong> when the manager is away.
                    </>
                  ) : (
                    <>
                      배차 워크플로우 패널에서 대기 중인 신청 건을 원클릭 <strong>[승인]</strong> 또는 <strong>[반려]</strong>하며, 외근 시에는 <strong>[자동승인 ON]</strong>을 켤 수 있습니다.
                    </>
                  )}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#FFFFFF] border border-black/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[#1D4ED8] font-semibold">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {isEng
                    ? '3. Vehicle & Employee CSV Import'
                    : '3. 사용자 · 차량 CSV 일괄 입력'}
                </div>
                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      In the Admin Console&apos;s <strong>[30-Fleet]</strong> and <strong>[Employee Governance]</strong> tabs, click <strong>[Download CSV Template]</strong>, edit in Excel, and upload to bulk-sync records.
                    </>
                  ) : (
                    <>
                      관리자 콘솔의 <strong>[차량 30대]</strong> 및 <strong>[임직원 통제]</strong> 탭에서 <strong>[CSV 양식 다운로드]</strong> 후 엑셀로 편집해 업로드하면 다수의 차량·사용자가 즉시 일괄 등록됩니다.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: No-Dashcam Smartphone Sensor Guide */}
          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#10B981]/30 space-y-2">
            <h3 className="text-sm font-semibold text-[#047857] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {isEng
                ? 'Chapter 3. No-Dashcam Smartphone 6-Axis IMU Crash Reconstruction & Audit Rules'
                : '제3장. 무블랙박스(No-Dashcam) 스마트폰 6축 센서 사고 감지 및 무단운행 감사 수칙'}
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-[#3F3F46]">
              {isEng ? (
                <>
                  <li>
                    <strong>No-Dashcam Crash Reconstruction:</strong> When <code>≥2.5G</code> impact shock, gyroscope yaw rotation (<code>≥28°/s</code>), and sudden deceleration (<code>Δv</code>) occur simultaneously, the system locks the timestamp, US street coordinates, and 30-second speed trace.
                  </li>
                  <li>
                    <strong>Phone Drop False-Positive Filter:</strong> If a high G-Force spike occurs while vehicle speed remains constant (<code>Δv = 0 km/h</code>), Sensor Fusion automatically filters it out as a harmless cabin phone drop.
                  </li>
                  <li>
                    <strong>Unauthorized Key Theft Detection:</strong> Driving over <code>15 km/h</code> without prior approval matches the car&apos;s factory Bluetooth MAC and 3m Keybox BLE history to identify the primary driver and trigger a bilateral Red Alert.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>블랙박스 미장착 차량 사고 재구성:</strong> 운행 중 <code>2.5G</code> 이상 충격 가속도와 자이로 회전각(<code>28°/s</code> 이상) 및 급정차(<code>Δv</code>)가 동시 발생하면 서버가 사고 시각·미국 도로명 좌표·속도 곡선을 자동 박제합니다.
                  </li>
                  <li>
                    <strong>거치대 휴대폰 낙하 오탐 자동 제외:</strong> 충격이 감지되어도 주행 속도 변화(<code>Δv = 0km/h</code>)가 없으면 거치대 단순 낙하로 판별하여 경보를 울리지 않습니다.
                  </li>
                  <li>
                    <strong>무단 키 반출 색출:</strong> 사전 승인 없이 키를 가져가 시속 <code>15km/h</code> 이상 주행하면 차량 블루투스 MAC과 키보관함 BLE(3m) 이력으로 주 운전자를 특정해 즉시 양방향 경고음을 발송합니다.
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#F4F4F5] border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-[#52525B]">
            {isEng
              ? 'Document Version: v1.3 (KOR/ENG) · Opelika AL Corporate Fleet Operations'
              : '문서 버전: v1.3 (한/영 통합) · Opelika AL Corporate Fleet Operations'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadManualAsHtml(modalLang)}
              className="px-3.5 py-1.5 rounded-lg bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {isEng ? 'Download Manual (.HTML)' : '매뉴얼 다운로드 (.HTML)'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/[0.07] text-[#0A0A0A] text-xs font-medium"
            >
              {isEng ? 'Close' : '닫기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
