'use client';

import React, { useState } from 'react';
import { Car, Smartphone, Sparkles } from 'lucide-react';
import { AppLang } from '@/utils/i18n';

interface HotspotItem {
  id: 'QR_KEY' | 'BT_AUDIO' | 'IMU_MOUNT' | 'ODOMETER_GEOFENCE';
  stepNumber: string;
  badgeKor: string;
  badgeEng: string;
  titleKor: string;
  titleEng: string;
  subtitleKor: string;
  subtitleEng: string;
  xPercent: number;
  yPercent: number;
  color: string;
  actionStepsKor: string[];
  actionStepsEng: string[];
  zeroHardwarePointKor: string;
  zeroHardwarePointEng: string;
}

const HOTSPOTS: HotspotItem[] = [
  {
    id: 'QR_KEY',
    stepNumber: '01',
    badgeKor: '방식 A · 무설정 1초 연결 (권장)',
    badgeEng: 'Method A · Zero-Config 1-Sec Scan (Recommended)',
    titleKor: '자동차 스마트키 QR 태그 스캔 (페어링 불필요)',
    titleEng: 'Vehicle Key-Fob QR Scan (No Pairing Required)',
    subtitleKor: '운전석 탑승 후 차키 고리의 QR 코드를 스마트폰 카메라로 스캔',
    subtitleEng: 'Scan the QR tag on the car key-fob with your smartphone camera',
    xPercent: 36,
    yPercent: 64,
    color: '#047857',
    actionStepsKor: [
      '4400 Northpark Dr 키보관함에서 배정된 차량 키(QR 키링 부착)를 수령합니다.',
      '스마트폰 기본 카메라(또는 임직원 웹앱 상단 [⚡ 차키 QR 1초 출발])로 차키 QR을 비춥니다.',
      '블루투스 수동 검색·페어링 없이 #01~#30호차 차량 번호판(AL 41)과 운전자가 1초 만에 자동 매칭됩니다.',
    ],
    actionStepsEng: [
      'Pick up the assigned vehicle key (with QR key-tag attached) from the 4400 Northpark Dr keybox.',
      'Scan the key QR tag using your phone camera or tap [⚡ 1-Sec Key QR Start] at the top of the app.',
      'Instantly matches Unit #01~#30 (AL 41 plate) with the driver in 1 second without manual Bluetooth pairing.',
    ],
    zeroHardwarePointKor:
      '차량에 별도 단말기를 달지 않고, 인쇄된 QR 스티커 1장으로 초기 블루투스 설정 복잡도를 100% 제거합니다.',
    zeroHardwarePointEng:
      'Eliminates 100% of Bluetooth setup complexity using a printed QR key-tag with zero in-car hardware.',
  },
  {
    id: 'BT_AUDIO',
    stepNumber: '02',
    badgeKor: '방식 B · 시동 연동 자동 매칭',
    badgeEng: 'Method B · Ignition Auto-Match',
    titleKor: '차량 대시보드 순정 블루투스 오디오 (RSSI 신호 판별)',
    titleEng: 'In-Car Factory Bluetooth Audio (RSSI Driver Attribution)',
    subtitleKor: '최초 1회 차량 오디오 연결 후 시동(ACC ON) 시 무조작 자동 인식',
    subtitleEng: 'Pair once with factory audio; auto-connects on every ignition (ACC ON)',
    xPercent: 52,
    yPercent: 48,
    color: '#3E6AE1',
    actionStepsKor: [
      '차량 시동(ACC ON) 후 순정 오디오 화면에서 [Setup → Bluetooth → Add New]를 최초 1회만 연결합니다.',
      '이후 탑승부터는 주머니에 휴대폰을 넣은 채 시동만 걸어도 차량 블루투스 MAC과 자동 연결됩니다.',
      '동승 직원이 함께 타더라도 운전석 신호강도(RSSI -52dBm) + 걸음걸이 센서로 실제 운전자를 정확히 식별합니다.',
    ],
    actionStepsEng: [
      'Turn ignition ON and pair your phone once via [Setup → Bluetooth → Add New] on the car screen.',
      'On all future trips, simply starting the engine automatically links your phone to the vehicle MAC.',
      'Distinguishes the driver from co-passengers using driver-side RSSI (-52dBm) and door-entry gait sensors.',
    ],
    zeroHardwarePointKor:
      '별도 비콘(Beacon) 구매 없이 모든 법인차량에 기본 내장된 순정 핸즈프리 블루투스 오디오를 그대로 활용합니다.',
    zeroHardwarePointEng:
      'Uses existing factory hands-free Bluetooth audio built into every corporate vehicle ($0 beacon cost).',
  },
  {
    id: 'IMU_MOUNT',
    stepNumber: '03',
    badgeKor: '블랙박스 대체 · 6축 센서 퓨전',
    badgeEng: 'Dashcam Replacement · 6-Axis Sensor Fusion',
    titleKor: '센터페시아 스마트폰 거치 & 6축 IMU 사고 감지',
    titleEng: 'Smartphone Cradle & 6-Axis IMU Crash Reconstruction',
    subtitleKor: '차량 내 블랙박스 0대 환경에서 3축 가속도(G) + 3축 자이로(°/s) 작동',
    subtitleEng: '3-Axis Accelerometer (G) + 3-Axis Gyroscope (°/s) with 0 in-car dashcams',
    xPercent: 56,
    yPercent: 32,
    color: '#B45309',
    actionStepsKor: [
      '운행 시작과 동시에 스마트폰 내장 6축 IMU(가속도계 + 자이로스코프)와 GPS가 백그라운드에서 켜집니다.',
      '주행 중 2.5G 이상 충격 + 자이로 회전(≥25°/s) + 2초 내 급감속(Δv ≤ -20km/h) 동시 발생 시 실제 차량 충돌 사고로 자동 재구성합니다.',
      '단순히 거치대에서 휴대폰이 바닥에 떨어진 경우(속도 변화 Δv = 0km/h)는 오탐 필터가 자동으로 걸러냅니다.',
    ],
    actionStepsEng: [
      'Phone 6-axis IMU (accelerometer + gyroscope) and GPS activate automatically when the trip starts.',
      'Reconstructs real crashes when ≥2.5G shock + ≥25°/s yaw rotation + sudden deceleration (Δv ≤ -20km/h) occur together.',
      'Automatically filters out false positives such as dropping the phone inside the cabin (Δv = 0km/h).',
    ],
    zeroHardwarePointKor:
      '대당 $300~$500의 블랙박스 및 OBD-II 장비를 30대 모두 제거하고 임직원 스마트폰 센서로 100% 대체합니다.',
    zeroHardwarePointEng:
      'Replaces $300~$500 dashcams and OBD-II dongles across all 30 vehicles using employee smartphone sensors.',
  },
  {
    id: 'ODOMETER_GEOFENCE',
    stepNumber: '04',
    badgeKor: '차고지 자동 반납 & 프라이버시',
    badgeEng: 'Auto-Return & Privacy Guard',
    titleKor: '계기판 Odometer 교차검증 & 150m 차고지 자동 반납',
    titleEng: 'Odometer Cross-Audit & 150m HQ Geofence Auto-Return',
    subtitleKor: '4400 Northpark Dr 복귀·시동 OFF 시 무조작 반납 및 GPS 즉시 차단',
    subtitleEng: 'Hands-free return upon entering 4400 Northpark Dr (150m) & turning engine OFF',
    xPercent: 42,
    yPercent: 36,
    color: '#7E22CE',
    actionStepsKor: [
      '운행 종료 후 4400 Northpark Dr(Opelika, AL) 차고지 반경 150m 내 진입 후 시동을 끄면 버튼을 누르지 않아도 [자동 반납] 됩니다.',
      '반납과 동시에 출발~도착 주행거리(km)가 사내 법인차량 운행기록부(내부 관리·회계 비용증빙용 CSV, 외부 기관 자동전송 없음)에 자동 기입됩니다.',
      '하차 즉시 스마트폰 GPS 수집이 물리적으로 완전 차단(0 패킷)되어 퇴근 후 개인 사생활을 100% 보호합니다.',
    ],
    actionStepsEng: [
      'Entering the 150m geofence at 4400 Northpark Dr (Opelika, AL) and turning off the ignition automatically returns the vehicle.',
      'Start/end mileage (km) is logged to the internal corporate mileage CSV (stored internally only; never sent externally).',
      'GPS collection is physically terminated (0 packets) the moment you exit the vehicle, protecting off-duty privacy 100%.',
    ],
    zeroHardwarePointKor:
      '누군가 블루투스를 끄고 몰래 타더라도 다음 사용자의 계기판 주행거리(Odometer) 실사 차이로 유령 주행을 100% 적발합니다.',
    zeroHardwarePointEng:
      'Even if someone disables Bluetooth, odometer gap auditing between trips detects 100% of ghost trips.',
  },
];

interface VehiclePhoneSetupInfographicProps {
  lang?: AppLang;
}

export const VehiclePhoneSetupInfographic: React.FC<VehiclePhoneSetupInfographicProps> = ({
  lang = 'KOR',
}) => {
  const isEng = lang === 'ENG';
  const [activeHotspotId, setActiveHotspotId] = useState<HotspotItem['id']>('QR_KEY');
  const [phoneOsTab, setPhoneOsTab] = useState<'IOS' | 'ANDROID'>('IOS');

  const activeHotspot =
    HOTSPOTS.find((h) => h.id === activeHotspotId) || HOTSPOTS[0];

  return (
    <section
      className="rounded-xl bg-[#FAFAFA] p-5 space-y-5"
      style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px' }}
    >
      {/* Top Infographic Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <h2 className="text-base font-semibold text-[#0A0A0A] flex items-center gap-2">
            <Car className="w-4 h-4 text-[#0A72EF]" />
            {isEng
              ? 'Vehicle ↔ Smartphone Initial Setup & Sensor Infographic'
              : '법인차량 ↔ 임직원 스마트폰 초기 연결 & 센서 인포그래픽'}
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            {isEng
              ? 'Click points ①~④ on the vehicle diagram to inspect QR boarding, Bluetooth attribution, 6-axis IMU crash sensing, and auto-return.'
              : '차량 이미지의 ①~④번 포인트를 클릭하여 차키 QR 스캔, 블루투스 자동 매칭, 6축 충격 센서, 차고지 자동 반납 원리를 확인하세요.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {HOTSPOTS.map((spot) => {
            const isSelected = spot.id === activeHotspotId;
            const title = isEng ? spot.titleEng : spot.titleKor;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => setActiveHotspotId(spot.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                  isSelected
                    ? 'bg-[#0A0A0A] text-[#FAFAFA] font-semibold'
                    : 'bg-[#FFFFFF] text-[#52525B] hover:text-[#0A0A0A]'
                }`}
              >
                <span className="font-mono text-[11px]">{spot.stepNumber}</span>
                <span>{title.split(' (')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Visual Infographic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 7 Cols: Interactive Vehicle Cutaway SVG Diagram */}
        <div
          className="lg:col-span-7 rounded-xl bg-[#FFFFFF] p-4 relative overflow-hidden flex flex-col justify-between min-h-[370px]"
          style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
        >
          <div className="flex items-center justify-between text-xs font-mono text-[#52525B] z-10">
            <span>OPELIKA AL FLEET #01~#30</span>
            <span>{isEng ? 'Click ①~④ on vehicle' : '차량 위 ①~④ 클릭'}</span>
          </div>

          <div className="relative my-2 flex items-center justify-center select-none">
            <svg
              viewBox="0 0 800 400"
              className="w-full h-auto max-h-[300px]"
              role="img"
              aria-label="Vehicle Sensor Infographic"
            >
              <defs>
                <linearGradient id="carBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EEF2FF" />
                  <stop offset="50%" stopColor="#E0E7FF" />
                  <stop offset="100%" stopColor="#EEF2FF" />
                </linearGradient>
                <linearGradient id="cabinGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0.88" />
                </linearGradient>
              </defs>

              <ellipse
                cx="400"
                cy="200"
                rx="370"
                ry="175"
                fill="none"
                stroke="#3E6AE1"
                strokeWidth="1"
                strokeDasharray="6 6"
                opacity="0.5"
              />

              <text
                x="400"
                y="36"
                textAnchor="middle"
                fill="#1D4ED8"
                fontSize="11"
                fontFamily="monospace"
              >
                {isEng
                  ? '4400 Northpark Dr HQ Geofence (150m Radius · Auto-Return on Engine OFF)'
                  : '4400 Northpark Dr 차고지 지오펜스 (반경 150m 진입 · 시동 OFF 시 자동 반납)'}
              </text>

              <rect x="205" y="68" width="76" height="24" rx="8" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="2" />
              <rect x="515" y="68" width="76" height="24" rx="8" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="2" />
              <rect x="205" y="308" width="76" height="24" rx="8" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="2" />
              <rect x="515" y="308" width="76" height="24" rx="8" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="2" />

              <path
                d="M 135 140 Q 115 200 135 260 L 185 295 Q 220 312 280 312 L 560 312 Q 635 312 660 275 Q 678 200 660 125 Q 635 88 560 88 L 280 88 Q 220 88 185 105 Z"
                fill="url(#carBodyGrad)"
                stroke="#3B82F6"
                strokeWidth="2.5"
              />

              <text x="195" y="204" textAnchor="middle" fill="#1D4ED8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                FRONT
              </text>

              <path
                d="M 255 122 L 315 106 L 535 106 L 585 126 L 585 274 L 535 294 L 315 294 L 255 278 Z"
                fill="url(#cabinGlassGrad)"
                stroke="#A1A1AA"
                strokeWidth="2"
              />

              <rect x="275" y="115" width="36" height="170" rx="10" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" />
              <circle cx="315" cy="245" r="20" fill="none" stroke="#3B82F6" strokeWidth="4" />

              <rect x="350" y="214" width="74" height="64" rx="12" fill="#ECFDF5" stroke="#10B981" strokeWidth="2" />
              <text x="387" y="246" textAnchor="middle" fill="#047857" fontSize="11" fontWeight="bold">
                {isEng ? 'Driver' : '운전석'}
              </text>
              <text x="387" y="261" textAnchor="middle" fill="#52525B" fontSize="9" fontFamily="monospace">
                RSSI -52dBm
              </text>

              <rect x="350" y="122" width="74" height="64" rx="12" fill="#F1F5F9" stroke="#A1A1AA" strokeWidth="1.5" />
              <text x="387" y="154" textAnchor="middle" fill="#52525B" fontSize="11">
                {isEng ? 'Passenger' : '조수석'}
              </text>

              <rect x="468" y="122" width="65" height="156" rx="12" fill="#F1F5F9" stroke="#D4D4D8" strokeWidth="1.5" />
              <rect x="302" y="182" width="48" height="36" rx="6" fill="#EFF6FF" stroke="#3E6AE1" strokeWidth="2" />
              <text x="326" y="203" textAnchor="middle" fill="#1D4ED8" fontSize="9" fontFamily="monospace">
                BT·IMU
              </text>
            </svg>

            {HOTSPOTS.map((spot) => {
              const isSelected = spot.id === activeHotspotId;
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => setActiveHotspotId(spot.id)}
                  style={{ left: `${spot.xPercent}%`, top: `${spot.yPercent}%` }}
                  className={`-translate-x-1/2 -translate-y-1/2 absolute z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#0A0A0A] text-[#FAFAFA] scale-110 shadow-xl'
                      : 'bg-[#FAFAFA]/90 text-[#0A0A0A] border border-black/30 hover:scale-105'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
                    style={{ backgroundColor: spot.color }}
                  >
                    {spot.stepNumber}
                  </span>
                  <span className="hidden sm:inline whitespace-nowrap text-[11px]">
                    {spot.id === 'QR_KEY'
                      ? isEng
                        ? 'Key QR'
                        : '차키 QR'
                      : spot.id === 'BT_AUDIO'
                        ? isEng
                          ? 'Car BT'
                          : '블루투스'
                        : spot.id === 'IMU_MOUNT'
                          ? isEng
                            ? '6-Axis IMU'
                            : '6축센서'
                          : isEng
                            ? 'Auto-Return'
                            : '자동반납'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Active Hotspot Detail */}
        <div
          className="lg:col-span-5 rounded-xl bg-[#FFFFFF] p-4 flex flex-col justify-between space-y-3"
          style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
        >
          <div className="space-y-3">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.06] text-[#1D4ED8]">
              POINT {activeHotspot.stepNumber} ·{' '}
              {isEng ? activeHotspot.badgeEng : activeHotspot.badgeKor}
            </span>

            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A]">
                {isEng ? activeHotspot.titleEng : activeHotspot.titleKor}
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                {isEng ? activeHotspot.subtitleEng : activeHotspot.subtitleKor}
              </p>
            </div>

            <div className="space-y-2">
              {(isEng ? activeHotspot.actionStepsEng : activeHotspot.actionStepsKor).map(
                (step, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#FAFAFA] flex items-start gap-2 text-xs"
                    style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
                  >
                    <span className="font-mono text-[#1D4ED8] font-bold">{idx + 1}.</span>
                    <span className="text-[#3F3F46] leading-relaxed">{step}</span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#10B981]/10 text-xs text-[#047857] flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {isEng ? activeHotspot.zeroHardwarePointEng : activeHotspot.zeroHardwarePointKor}
            </span>
          </div>
        </div>
      </div>

      {/* 1-Time Smartphone Setup Guide (iOS / Android) */}
      <div
        className="rounded-xl bg-[#FFFFFF] p-4 space-y-3"
        style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0A72EF]" />
            <h3 className="text-xs font-semibold text-[#0A0A0A]">
              {isEng
                ? '1-Time Smartphone Setup Guide (30 Seconds)'
                : '핸드폰 최초 1회 설정 매뉴얼 (30초 완료)'}
            </h3>
          </div>

          <div className="flex rounded-lg bg-[#FAFAFA] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPhoneOsTab('IOS')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                phoneOsTab === 'IOS'
                  ? 'bg-[#0A0A0A] text-[#FAFAFA]'
                  : 'text-[#71717A] hover:text-[#0A0A0A]'
              }`}
            >
              🍎 iPhone (Safari)
            </button>
            <button
              type="button"
              onClick={() => setPhoneOsTab('ANDROID')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                phoneOsTab === 'ANDROID'
                  ? 'bg-[#0A0A0A] text-[#FAFAFA]'
                  : 'text-[#71717A] hover:text-[#0A0A0A]'
              }`}
            >
              🤖 Android (Chrome)
            </button>
          </div>
        </div>

        {phoneOsTab === 'ANDROID' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#047857]">
                {isEng ? '1. Install Web App' : '1. 웹앱 설치'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Open URL in Chrome → Tap top-right [⋮] → Select [Add to Home screen / Install app].'
                  : 'Chrome 접속 → 우측 상단 [⋮] 터치 → [홈 화면에 추가 / 앱 설치] 선택'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#1D4ED8]">
                {isEng ? '2. Allow Permissions' : '2. 근처 기기·위치 허용'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Tap [Connect Phone Sensors] → Allow Location (While using app), Nearby devices (Bluetooth), and Motion sensors.'
                  : '[휴대폰 센서 연결] 터치 → 위치(앱 사용 중) + 근처 기기(블루투스) + 동작 센서 [허용]'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#B45309]">
                {isEng ? '3. Auto-Connect on Boarding' : '3. 탑승 시 자동 연결'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Scan the Key QR tag (1 sec) or start engine (ACC ON) for automatic Bluetooth matching.'
                  : '차키 QR 스캔(1초) 또는 시동(ACC ON) 시 블루투스 즉시 자동 매칭'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#1D4ED8]">
                {isEng ? '1. Add to Home Screen' : '1. 홈 화면에 추가'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Open URL in iOS Safari → Tap bottom [Share ↑] → Select [Add to Home Screen].'
                  : 'Safari 접속 → 하단 [공유 ↑] 터치 → [홈 화면에 추가] 선택'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#047857]">
                {isEng ? '2. Allow Motion & Location' : '2. 센서 권한 허용'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Tap [Connect Phone Sensors] → Allow Motion & Orientation (6-axis IMU) and Location.'
                  : '[휴대폰 센서 연결] 터치 → 동작 및 방향(6축 센서) + 위치 [허용]'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#B45309]">
                {isEng ? '3. 1-Sec Key QR Boarding' : '3. 탑승 시 QR 스캔'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Scan the car key-fob QR tag (or tap [⚡ 1-Sec Key QR Start]) to start driving immediately.'
                  : '차키 QR 태그 스캔(또는 [⚡ 차키 QR 1초 출발]) 후 즉시 운행 시작'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
