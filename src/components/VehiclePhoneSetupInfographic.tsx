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
    badgeKor: '방식 A · 권장',
    badgeEng: 'Method A · Recommended',
    titleKor: '차키 QR 스캔',
    titleEng: 'Key-Tag QR Scan',
    subtitleKor: '휴대폰 카메라로 차키 QR을 스캔',
    subtitleEng: 'Scan the key-tag QR with your phone camera',
    xPercent: 36,
    yPercent: 64,
    color: '#047857',
    actionStepsKor: [
      '키보관함에서 차키를 받습니다.',
      '카메라로 차키 QR을 비추면 앱에서 해당 차량이 선택됩니다.',
      '[⚡ 바로 출발]을 누르면 운행이 시작됩니다.',
    ],
    actionStepsEng: [
      'Pick up the key from the keybox.',
      'Scan the key QR; the app selects that vehicle.',
      'Tap [⚡ Start now] to begin the trip.',
    ],
    zeroHardwarePointKor:
      '차량 단말기 없이 QR 스티커 1장으로 끝납니다.',
    zeroHardwarePointEng:
      'No in-car hardware: one printed QR tag.',
  },
  {
    id: 'BT_AUDIO',
    stepNumber: '02',
    badgeKor: '방식 B · 시동 연동',
    badgeEng: 'Method B · Ignition',
    titleKor: '차량 블루투스 자동 연결',
    titleEng: 'Car Bluetooth Auto-Connect',
    subtitleKor: '한 번 연결하면 시동 시 자동 인식',
    subtitleEng: 'Pair once; auto-connects at ignition',
    xPercent: 52,
    yPercent: 48,
    color: '#3E6AE1',
    actionStepsKor: [
      '시동 후 차량 화면 [Setup → Bluetooth → Add New]에서 1회 연결합니다.',
      '다음부터는 시동만 걸면 자동 연결됩니다.',
      '동승자가 있어도 운전석 신호 세기로 운전자를 구분합니다.',
    ],
    actionStepsEng: [
      'Pair once via [Setup → Bluetooth → Add New] on the car screen.',
      'After that, starting the engine connects automatically.',
      'Driver-side signal strength tells the driver from passengers.',
    ],
    zeroHardwarePointKor:
      '별도 비콘 없이 순정 블루투스를 씁니다.',
    zeroHardwarePointEng:
      'Uses the factory Bluetooth; no beacons.',
  },
  {
    id: 'IMU_MOUNT',
    stepNumber: '03',
    badgeKor: '블랙박스 대체',
    badgeEng: 'Dashcam Replacement',
    titleKor: '휴대폰 거치 · 사고 감지',
    titleEng: 'Phone Mount · Crash Detection',
    subtitleKor: '휴대폰 충격·회전 센서 사용',
    subtitleEng: 'Uses the phone motion sensors',
    xPercent: 56,
    yPercent: 32,
    color: '#B45309',
    actionStepsKor: [
      '운행을 시작하면 센서와 GPS가 켜집니다.',
      '2.5G 이상 충격 + 회전 + 급감속이 함께 오면 사고로 기록합니다.',
      '휴대폰 낙하(속도 변화 없음)는 걸러냅니다.',
    ],
    actionStepsEng: [
      'Sensors and GPS turn on when the trip starts.',
      '≥2.5G shock + rotation + hard braking together is logged as a crash.',
      'A dropped phone (no speed change) is filtered out.',
    ],
    zeroHardwarePointKor:
      '대당 $300~$500 블랙박스가 필요 없습니다.',
    zeroHardwarePointEng:
      'No $300~$500 dashcam per vehicle.',
  },
  {
    id: 'ODOMETER_GEOFENCE',
    stepNumber: '04',
    badgeKor: '자동 반납 · 사생활 보호',
    badgeEng: 'Auto-Return · Privacy',
    titleKor: '차고지 자동 반납',
    titleEng: 'Garage Auto-Return',
    subtitleKor: '차고지(150m)에서 시동을 끄면 반납',
    subtitleEng: 'Engine off within 150m of the garage returns the car',
    xPercent: 42,
    yPercent: 36,
    color: '#7E22CE',
    actionStepsKor: [
      '차고지 150m 안에서 시동을 끄면 자동 반납됩니다.',
      '주행거리가 운행일지(사내용)에 자동 기록됩니다.',
      '반납 후에는 GPS를 수집하지 않습니다.',
    ],
    actionStepsEng: [
      'Engine off within 150m of the garage returns the vehicle.',
      'Mileage goes into the internal log automatically.',
      'No GPS is collected after the return.',
    ],
    zeroHardwarePointKor:
      '몰래 탄 운행도 계기판 실사 차이로 드러납니다.',
    zeroHardwarePointEng:
      'Odometer audits reveal unlogged trips.',
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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/[0.08]">
        <div>
          <h2 className="text-base font-semibold text-[#0A0A0A] flex items-center gap-2">
            <Car className="w-4 h-4 text-[#0A72EF]" />
            {isEng
              ? 'Car ↔ Phone Setup'
              : '차량 ↔ 휴대폰 연결'}
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            {isEng
              ? 'Tap ①~④ on the car.'
              : '차량의 ①~④를 눌러 보세요.'}
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
                  : '차고지 150m · 시동 OFF 시 자동 반납'}
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
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-black/[0.06] text-[#1D4ED8]">
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
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-black/[0.08]">
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
                  : 'Chrome [⋮] → [홈 화면에 추가]'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#1D4ED8]">
                {isEng ? '2. Allow Permissions' : '2. 근처 기기·위치 허용'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? '[Sensors] → allow Location, Nearby devices, Motion'
                  : '[센서 연결] → 위치·근처 기기·동작 [허용]'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#B45309]">
                {isEng ? '3. Auto-Connect on Boarding' : '3. 탑승 시 자동 연결'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Scan the Key QR tag (1 sec) or start engine (ACC ON) for automatic Bluetooth matching.'
                  : '차키 QR 스캔 또는 시동 시 자동 연결'}
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
                  : 'Safari [공유 ↑] → [홈 화면에 추가]'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#047857]">
                {isEng ? '2. Allow Motion & Location' : '2. 센서 권한 허용'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? '[Sensors] → allow Motion and Location'
                  : '[센서 연결] → 동작·위치 [허용]'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAFAFA] space-y-1">
              <div className="font-semibold text-[#B45309]">
                {isEng ? '3. Scan Key QR' : '3. 탑승 시 QR 스캔'}
              </div>
              <p className="text-[#52525B]">
                {isEng
                  ? 'Scan the key QR, then [⚡ Start now]'
                  : '차키 QR 스캔 후 [⚡ 바로 출발]'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
