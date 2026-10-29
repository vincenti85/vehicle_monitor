'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bluetooth,
  BookOpen,
  Car,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Globe,
  KeyRound,
  MapPin,
  Sparkles,
  Smartphone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { downloadManualAsHtml } from '@/data/userApprovalManual';
import { AppLang } from '@/utils/i18n';

interface NewUserOnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDispatchTab: () => void;
  onOpenAdminConsole: () => void;
  onOpenFullManual: () => void;
  lang?: AppLang;
}

export const NewUserOnboardingGuide: React.FC<NewUserOnboardingGuideProps> = ({
  isOpen,
  onClose,
  onSelectDispatchTab,
  onOpenAdminConsole,
  onOpenFullManual,
  lang = 'KOR',
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);
  const [modalLang, setModalLang] = useState<AppLang>(lang);

  useEffect(() => {
    setModalLang(lang);
  }, [lang, isOpen]);

  const isEng = modalLang === 'ENG';

  if (!isOpen) return null;

  const markStepComplete = (step: 1 | 2 | 3) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
    if (step < 3) {
      setActiveStep((step + 1) as 1 | 2 | 3);
    }
  };

  const steps = isEng
    ? [
        {
          step: 1 as const,
          badge: 'STEP 1 · Initial Setup (1 Min)',
          title: 'Smartphone Web App & 3 Sensors',
          subtitle: 'Auto-pair vehicles via phone sensors (No Dashcam)',
          icon: Smartphone,
        },
        {
          step: 2 as const,
          badge: 'STEP 2 · Dispatch & Driving',
          title: 'Request → Approve → Key Fob Start',
          subtitle: '4-Stage Dispatch & 1-Sec QR Express Start',
          icon: Car,
        },
        {
          step: 3 as const,
          badge: 'STEP 3 · Return & Admin Console',
          title: 'Auto-Return · CSV Import · Audit',
          subtitle: 'Hands-free Garage Return & Admin PIN',
          icon: KeyRound,
        },
      ]
    : [
        {
          step: 1 as const,
          badge: 'STEP 1 · 초기 세팅 (1분)',
          title: '스마트폰 웹앱 & 3대 센서 연결',
          subtitle: '블랙박스 없이 휴대폰 센서로 차량 매칭',
          icon: Smartphone,
        },
        {
          step: 2 as const,
          badge: 'STEP 2 · 배차 및 운행',
          title: '차량 신청 → 승인 → 키 수령 출발',
          subtitle: '정식 4단계 배차 & 1초 자율 반출',
          icon: Car,
        },
        {
          step: 3 as const,
          badge: 'STEP 3 · 반납 및 관리자 콘솔',
          title: '자동 반납 · CSV 등록 · 사고 관제',
          subtitle: '차고지 자동반납 & 관리자 PIN 운영',
          icon: KeyRound,
        },
      ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-[#FAFAFA] border border-black/15 flex flex-col overflow-hidden"
        style={{
          boxShadow:
            'rgba(0, 0, 0, 0.14) 0px 24px 60px, rgba(0, 0, 0, 0.1) 0px 0px 0px 1px',
        }}
      >
        {/* Top Modal Header */}
        <div className="p-5 bg-[#F4F4F5] border-b border-black/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A72EF] to-[#10B981] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#0A0A0A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#0A0A0A]">
                  {isEng
                    ? 'New User 3-Step Quick Start Guide'
                    : '신규 이용자를 위한 3단계 빠른 시작 가이드 (Quick Start)'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#0A72EF]/20 text-[#1D4ED8] border border-[#0A72EF]/40">
                  3-STEP ONBOARDING
                </span>
              </div>
              <p className="text-xs text-[#52525B]">
                {isEng
                  ? '4400 Northpark Dr, Opelika, AL · 30 Corporate Vehicles · 0 Dashcams (100% Smartphone Sensor Telemetry)'
                  : '4400 Northpark Dr, Opelika, AL 법인차량 30대 · 무블랙박스 스마트폰 센서 기반 배차 및 관제 솔루션'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-black/5 border border-black/15 text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#047857]" />
              {isEng ? 'Download Guide (.HTML)' : '가이드/매뉴얼 다운로드'}
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

        {/* 3-Step Progress Stepper Bar */}
        <div className="px-6 pt-5 pb-3 bg-[#FAFAFA] border-b border-black/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {steps.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeStep === item.step;
              const isDone = completedSteps.includes(item.step);
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveStep(item.step)}
                  className={`text-left p-3.5 rounded-xl border transition flex items-start gap-3 ${
                    isCurrent
                      ? 'bg-[#0A72EF]/15 border-[#0A72EF]'
                      : isDone
                        ? 'bg-[#10B981]/10 border-[#10B981]/40 hover:border-[#10B981]'
                        : 'bg-[#FFFFFF] border-black/10 hover:border-black/25'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isCurrent
                        ? 'bg-[#0A72EF] text-white'
                        : isDone
                          ? 'bg-[#10B981] text-white'
                          : 'bg-[#F4F4F5] text-[#52525B]'
                    }`}
                  >
                    {isDone && !isCurrent ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] font-mono uppercase block ${
                        isCurrent
                          ? 'text-[#1D4ED8]'
                          : isDone
                            ? 'text-[#047857]'
                            : 'text-[#52525B]'
                      }`}
                    >
                      {item.badge}
                    </span>
                    <p className="text-xs font-semibold text-[#0A0A0A] truncate mt-0.5">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#52525B] truncate">{item.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#3F3F46]">
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#0A72EF]/30 space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0A72EF]/20 text-[#1D4ED8]">
                  {isEng ? 'STEP 1 OBJECTIVE' : '1단계 핵심 목표'}
                </span>
                <h3 className="text-base font-semibold text-[#0A0A0A]">
                  {isEng
                    ? 'Zero In-Car Dashcams or OBD Dongles — Start with Only Your Smartphone'
                    : '차량 내 블랙박스·OBD 단말기 없이 스마트폰 하나로 시작합니다'}
                </h3>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      FleetGuard 30 tracks all 30 corporate vehicles with <strong>$0 hardware & $0 monthly subscription cost</strong> by combining your smartphone&apos;s <strong>Factory Bluetooth MAC + 6-Axis IMU (Accelerometer/Gyroscope) + Conditional GPS</strong>.
                    </>
                  ) : (
                    <>
                      FleetGuard 30은 별도의 차량 하드웨어나 월 구독료($0) 없이, 임직원 스마트폰의 <strong>순정 블루투스 연결 + 6축 가속도·자이로 센서 + 조건부 GPS</strong>만으로 법인차량 30대를 추적합니다.
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <div className="flex items-center gap-2 text-[#1D4ED8] font-semibold">
                    <Smartphone className="w-4 h-4" />
                    {isEng ? '① Add to Home Screen' : '① 모바일 홈 화면에 추가'}
                  </div>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Open the web URL on <strong>Safari (iPhone)</strong> or <strong>Chrome (Android)</strong> and tap <strong>[Add to Home Screen]</strong> to run FleetGuard 30 like a native mobile app.
                      </>
                    ) : (
                      <>
                        스마트폰(Safari / Chrome)으로 배포 주소에 접속한 뒤 <strong>[홈 화면에 추가]</strong>를 누르면 일반 네이티브 앱처럼 전체 화면으로 작동합니다.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <div className="flex items-center gap-2 text-[#047857] font-semibold">
                    <Bluetooth className="w-4 h-4" />
                    {isEng ? '② Allow Bluetooth & GPS' : '② 블루투스 · 위치 권한 허용'}
                  </div>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        When the engine starts, the app automatically matches the car&apos;s factory hands-free Bluetooth (MAC) and the HQ Keybox (3m BLE) to identify <strong>who is driving which unit</strong>.
                      </>
                    ) : (
                      <>
                        차량 시동 시 순정 핸즈프리 블루투스(MAC)와 총무팀 키보관함(3m BLE)을 자동 인식하여 <strong>누가 몇 호차를 운전하는지</strong> 100% 자동으로 매칭합니다.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <div className="flex items-center gap-2 text-[#B45309] font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    {isEng ? '③ 6-Axis IMU Crash Sensor' : '③ 무블랙박스 6축 센서 활성화'}
                  </div>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Replaces physical dashcams by detecting <code>≥2.5G</code> impact shock, gyroscope yaw rotation (<code>°/s</code>), and sudden deceleration to reconstruct the 30-second crash trace.
                      </>
                    ) : (
                      <>
                        블랙박스가 없는 차량에서 <code>2.5G</code> 이상 충돌 충격과 자이로 회전(<code>°/s</code>), 급정차가 감지되면 사고 당시 30초 궤적을 자동 박제합니다.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#047857]">
                  {isEng ? (
                    <>
                      💡 You can test live phone sensor pairing and vehicle requests directly in the <strong>[Employee Mobile App]</strong> on Tab 1.
                    </>
                  ) : (
                    <>
                      💡 운영화면 좌측의 <strong>[임직원 스마트폰 앱]</strong>에서 실제 휴대폰 센서 연동과 배차 신청을 바로 테스트할 수 있습니다.
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => markStepComplete(1)}
                  className="px-4 py-2 rounded-lg bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {isEng
                    ? 'Next: Step 2 (Request, Approval & Start)'
                    : '2단계(차량 신청·승인·운행) 보기'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#10B981]/30 space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/20 text-[#047857]">
                  {isEng ? 'STEP 2 OBJECTIVE' : '2단계 핵심 목표'}
                </span>
                <h3 className="text-base font-semibold text-[#0A0A0A]">
                  {isEng
                    ? 'Request Vehicle → Manager Approval → Pick Up Key & Drive (Plus 1-Sec QR Start)'
                    : '차량 신청 → 관리자 승인 → 키 수령 후 사용 (긴급 시 1초 자율 반출 지원)'}
                </h3>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  {isEng
                    ? 'Learn the standard 4-stage dispatch workflow, 1-second QR checkout when the manager is away, and how unreported departures are handled.'
                    : '정상적인 사전 배차 신청부터 키 관리자가 자리를 비웠을 때의 자율 반출, 그리고 미승인 출발 시의 경고 대응까지 한눈에 익힙니다.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FBBF24]/20 text-[#B45309]">
                    {isEng ? 'Method A · Standard 4-Stage' : '방법 A · 정식 4단계 배차'}
                  </span>
                  <p className="text-xs font-semibold text-[#0A0A0A]">
                    {isEng
                      ? 'REQUESTED → APPROVED → IN_USE'
                      : '신청(REQUESTED) → 승인(APPROVED)'}
                  </p>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Select your vehicle, destination (Auburn, Montgomery, etc.), and purpose. Once the manager clicks <strong>[Approve]</strong>, pick up the key fob and tap <strong>[Start Trip]</strong>.
                      </>
                    ) : (
                      <>
                        휴대폰에서 차량·행선지(Auburn, Montgomery 등)·목적을 선택해 신청하고, 관리자가 <strong>[승인]</strong>하면 키보관함에서 키를 수령해 <strong>[사용 시작]</strong>을 누릅니다.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0A72EF]/20 text-[#1D4ED8]">
                    {isEng ? 'Method B · Manager Away' : '방법 B · 관리자 부재 시 긴급 외근'}
                  </span>
                  <p className="text-xs font-semibold text-[#0A0A0A]">
                    {isEng ? '1-Sec Key QR Start' : '1초 원터치 자율 반출'}
                  </p>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Need a car urgently while the manager is away? Tap <strong>[⚡ 1-Sec Key QR Start]</strong> in the mobile app and drive out—your trip is immediately logged as authorized.
                      </>
                    ) : (
                      <>
                        키 관리자가 부재 중일 때 급히 나가야 한다면 앱에서 <strong>[1초 원터치 자율 반출]</strong>을 누르고 출발하세요. 즉시 정상 승인 운행으로 기록됩니다.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E82127]/20 text-[#DC2626]">
                    {isEng ? 'Caution · Unreported Key Theft' : '주의 · 보고 없이 키만 가지고 출발 시'}
                  </span>
                  <p className="text-xs font-semibold text-[#0A0A0A]">
                    {isEng ? 'Instant Red Alert at >15 km/h' : '15km/h 도달 즉시 양방향 Red Alert'}
                  </p>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Driving out without registering triggers a bilateral Red Alert. Tap <strong>[Submit Late Reason]</strong> on your phone&apos;s warning banner to log your purpose retroactively.
                      </>
                    ) : (
                      <>
                        앱 신청 없이 키를 가져가 주행하면 관리자와 운전자 모두에게 경고가 울립니다. 이때 휴대폰 경고창에서 <strong>[사후 사유 입력]</strong>을 누르면 해명 처리됩니다.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0A72EF]/10 border border-[#0A72EF]/30 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onSelectDispatchTab();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#FFFFFF] hover:bg-black/5 border border-black/15 text-xs font-medium text-[#1D4ED8] flex items-center gap-1.5 transition"
                >
                  {isEng
                    ? '📋 Open Dispatch Request & Return Screen'
                    : '📋 배차 신청·승인 워크플로우 화면 바로 열기'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => markStepComplete(2)}
                  className="px-4 py-2 rounded-lg bg-[#0A72EF] hover:bg-[#0060DF] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {isEng
                    ? 'Next: Step 3 (Auto-Return & Admin Console)'
                    : '3단계(자동 반납 & 관리자 콘솔) 보기'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E82127]/30 space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E82127]/20 text-[#DC2626]">
                  {isEng ? 'STEP 3 OBJECTIVE' : '3단계 핵심 목표'}
                </span>
                <h3 className="text-base font-semibold text-[#0A0A0A]">
                  {isEng
                    ? 'Hands-Free Garage Auto-Return & PIN-Protected Admin Console'
                    : '차고지 복귀 시 자동 반납 & 관리자 전용 콘솔(보안 PIN)로 완벽 통제'}
                </h3>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  {isEng ? (
                    <>
                      Drivers simply park at the HQ garage to auto-generate IRS mileage logs, while Fleet Managers unlock the Admin Console with a <strong>4-digit Security PIN (<code>••••</code>)</strong> for CSV bulk imports and audits.
                    </>
                  ) : (
                    <>
                      운전자는 복귀 후 주차만 하면 운행일지가 자동 생성되며, 관리자는 <strong>4자리 전용 보안 PIN(<code>••••</code>)</strong>을 입력해 사용자·차량 CSV 일괄 등록과 사고/유령주행 감사를 수행합니다.
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <div className="flex items-center gap-2 text-[#047857] font-semibold">
                    <MapPin className="w-4 h-4" />
                    {isEng ? '① Hands-Free Garage Auto-Return' : '① 차고지 복귀 무조작 자동 반납'}
                  </div>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Returning to the <code>4400 Northpark Dr</code> garage (150m geofence) and turning off the ignition (Bluetooth disconnect) automatically completes the return and logs IRS Sec. 274(d) mileage.
                      </>
                    ) : (
                      <>
                        <code>4400 Northpark Dr</code> 차고지(150m)로 복귀해 시동을 끄면(블루투스 해제) 앱 버튼을 누르지 않아도 자동 반납되며 <strong>세무용 운행기록부 CSV</strong>에 적산됩니다.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <div className="flex items-center gap-2 text-[#DC2626] font-semibold">
                    <KeyRound className="w-4 h-4" />
                    {isEng ? '② Admin Console Security PIN' : '② 관리자 화면 보안 PIN 접속'}
                  </div>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Click <strong>[3. Admin Console (PIN)]</strong> and enter the private 4-digit PIN (<code className="text-[#B45309] font-mono">••••</code>) to perform physical odometer audits, resolve incidents, or suspend drivers.
                      </>
                    ) : (
                      <>
                        상단 <strong>[관리자 › 설정]</strong> 클릭 후 관리자 전용 4자리 보안 PIN(<code className="text-[#B45309] font-mono">••••</code>)을 입력하면 계기판 실사 대조(유령 주행 색출), 사고 처분, 임직원 자격 정지가 가능합니다.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] border border-black/10 space-y-2">
                  <div className="flex items-center gap-2 text-[#1D4ED8] font-semibold">
                    <FileSpreadsheet className="w-4 h-4" />
                    {isEng ? '③ Vehicle & Employee CSV Import' : '③ 차량 · 임직원 CSV 일괄 입력'}
                  </div>
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    {isEng ? (
                      <>
                        Download the <strong>[Vehicle CSV Template]</strong> or <strong>[Employee CSV Template]</strong> in the Admin Console, edit in Excel, and upload to batch-register records.
                      </>
                    ) : (
                      <>
                        관리자 콘솔에서 <strong>[차량 CSV 양식]</strong> 및 <strong>[사용자 CSV 양식]</strong>을 내려받아 엑셀로 작성 후 업로드하면 한 번에 등록·수정됩니다.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-black/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdminConsole();
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#E82127] hover:bg-[#C91B20] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {isEng ? 'Open Admin Console (PIN)' : '관리자 콘솔(PIN 인증) 바로 열기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFullManual();
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#F4F4F5] hover:bg-black/5 border border-black/15 text-[#0A0A0A] text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    {isEng ? 'Open Full Manual' : '전체 상세 매뉴얼 보기'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    markStepComplete(3);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isEng ? 'Complete Onboarding & Start' : '3단계 온보딩 완료 및 시작하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
