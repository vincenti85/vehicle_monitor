'use client';

import React, { useState } from 'react';
import {
  Bluetooth,
  Car,
  CheckCircle2,
  Cpu,
  KeyRound,
  Lock,
  MapPin,
  QrCode,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';

interface HotspotItem {
  id: 'QR_KEY' | 'BT_AUDIO' | 'IMU_MOUNT' | 'ODOMETER_GEOFENCE';
  stepNumber: string;
  badge: string;
  title: string;
  subtitle: string;
  xPercent: number;
  yPercent: number;
  color: string;
  actionSteps: string[];
  zeroHardwarePoint: string;
}

const HOTSPOTS: HotspotItem[] = [
  {
    id: 'QR_KEY',
    stepNumber: '01',
    badge: '방식 A · 무설정 1초 연결 (권장)',
    title: '자동차 스마트키 QR 태그 스캔 (페어링 불필요)',
    subtitle: '운전석 탑승 후 차키 고리의 QR 코드를 스마트폰 카메라로 스캔',
    xPercent: 36,
    yPercent: 64,
    color: '#32D583',
    actionSteps: [
      '4400 Northpark Dr 키보관함에서 배정된 차량 키(QR 키링 부착)를 수령합니다.',
      '스마트폰 기본 카메라(또는 임직원 웹앱 상단 [⚡ 무설정 1초 탑승: QR 스캔])로 차키 QR을 비춥니다.',
      '블루투스 수동 검색·페어링 없이 #01~#30호차 차량 번호판(AL 41)과 운전자가 1초 만에 자동 매칭됩니다.',
    ],
    zeroHardwarePoint:
      '차량에 별도 단말기를 달지 않고, 인쇄된 QR 스티커 1장으로 초기 블루투스 설정 복잡도를 100% 제거합니다.',
  },
  {
    id: 'BT_AUDIO',
    stepNumber: '02',
    badge: '방식 B · 시동 연동 자동 매칭',
    title: '차량 대시보드 순정 블루투스 오디오 (RSSI 신호 판별)',
    subtitle: '최초 1회 차량 오디오 연결 후 시동(ACC ON) 시 무조작 자동 인식',
    xPercent: 52,
    yPercent: 48,
    color: '#3E6AE1',
    actionSteps: [
      '차량 시동(ACC ON) 후 순정 오디오 화면에서 [Setup → Bluetooth → Add New]를 최초 1회만 연결합니다.',
      '이후 탑승부터는 주머니에 휴대폰을 넣은 채 시동만 걸어도 차량 블루투스 MAC과 자동 연결됩니다.',
      '동승 직원이 함께 타더라도 운전석 신호강도(RSSI -52dBm) + 걸음걸이 센서(운전석 도어 충격)로 실제 운전자를 정확히 식별합니다.',
    ],
    zeroHardwarePoint:
      '별도 비콘(Beacon) 구매 없이 모든 법인차량에 기본 내장된 순정 핸즈프리 블루투스 오디오를 그대로 활용합니다.',
  },
  {
    id: 'IMU_MOUNT',
    stepNumber: '03',
    badge: '블랙박스 대체 · 6축 센서 퓨전',
    title: '센터페시아 스마트폰 거치 & 6축 IMU 사고 감지',
    subtitle: '차량 내 블랙박스 0대 환경에서 3축 가속도(G) + 3축 자이로(°/s) 작동',
    xPercent: 56,
    yPercent: 32,
    color: '#F79009',
    actionSteps: [
      '운행 시작과 동시에 스마트폰 내장 6축 IMU(가속도계 + 자이로스코프)와 GPS가 백그라운드에서 켜집니다.',
      '주행 중 2.5G 이상 충격 + 자이로 회전(≥25°/s) + 2초 내 급감속(Δv ≤ -20km/h) 동시 발생 시 실제 차량 충돌 사고로 자동 재구성합니다.',
      '단순히 거치대에서 휴대폰이 바닥에 떨어진 경우(속도 변화 Δv = 0km/h)는 오탐 필터가 자동으로 걸러냅니다.',
    ],
    zeroHardwarePoint:
      '대당 $300~$500의 블랙박스 및 OBD-II 장비를 30대 모두 제거하고 임직원 스마트폰 센서로 100% 대체합니다.',
  },
  {
    id: 'ODOMETER_GEOFENCE',
    stepNumber: '04',
    badge: '차고지 자동 반납 & 프라이버시',
    title: '계기판 Odometer 교차검증 & 150m 차고지 자동 반납',
    subtitle: '4400 Northpark Dr 복귀·시동 OFF 시 무조작 반납 및 GPS 즉시 차단',
    xPercent: 42,
    yPercent: 36,
    color: '#A855F7',
    actionSteps: [
      '운행 종료 후 4400 Northpark Dr(Opelika, AL) 차고지 반경 150m 내 진입 후 시동을 끄면 버튼을 누르지 않아도 [자동 반납] 됩니다.',
      '반납과 동시에 출발~도착 주행거리(km)가 사내 법인차량 운행기록부(내부 관리·회계 비용증빙용 CSV, 외부 기관 자동전송 없음)에 자동 기입됩니다.',
      '하차 즉시 스마트폰 GPS 수집이 물리적으로 완전 차단(0 패킷)되어 퇴근 후 개인 사생활을 100% 보호합니다.',
    ],
    zeroHardwarePoint:
      '누군가 블루투스를 끄고 몰래 타더라도 다음 사용자의 계기판 주행거리(Odometer) 실사 차이로 유령 주행을 100% 적발합니다.',
  },
];

export const VehiclePhoneSetupInfographic: React.FC = () => {
  const [activeHotspotId, setActiveHotspotId] = useState<HotspotItem['id']>('QR_KEY');
  const [phoneOsTab, setPhoneOsTab] = useState<'IOS' | 'ANDROID'>('IOS');

  const activeHotspot =
    HOTSPOTS.find((h) => h.id === activeHotspotId) || HOTSPOTS[0];

  return (
    <section className="rounded-2xl bg-[#131720] border border-white/10 p-5 lg:p-6 space-y-6">
      {/* Top Infographic Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#3E6AE1]/20 text-[#9BC1FF] border border-[#3E6AE1]/40">
              VEHICLE ↔ SMARTPHONE INFOGRAPHIC GUIDE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#12B76A]/20 text-[#32D583] border border-[#12B76A]/40">
              차량 내 블랙박스 0대 · OBD 단말기 0대
            </span>
          </div>
          <h2 className="text-base lg:text-lg font-bold text-[#F4F6F8] mt-1.5 flex items-center gap-2">
            <Car className="w-5 h-5 text-[#3E6AE1]" />
            법인차량 ↔ 임직원 스마트폰 초기 연결 & 센서 작동 인포그래픽 가이드
          </h2>
          <p className="text-xs text-[#9BA3B0] mt-0.5">
            아래 차량 이미지의 <strong>①~④번 포인트</strong>를 클릭하면 차량과 휴대폰이 어떻게 연결되고 신청·운행·반납되는지 한눈에 확인할 수 있습니다.
          </p>
        </div>

        {/* Quick 4-Button Selector */}
        <div className="flex flex-wrap gap-1.5">
          {HOTSPOTS.map((spot) => {
            const isSelected = spot.id === activeHotspotId;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => setActiveHotspotId(spot.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                  isSelected
                    ? 'bg-[#3E6AE1] text-white border-[#688FF5] shadow-lg shadow-[#3E6AE1]/25'
                    : 'bg-[#0B0D10] text-[#9BA3B0] border-white/10 hover:text-white hover:border-white/25'
                }`}
              >
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-black/30">
                  {spot.stepNumber}
                </span>
                <span>{spot.title.split(' (')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Visual Infographic Grid: Left Interactive Vehicle Cutaway Image + Right Detailed Step Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Interactive Vehicle Cutaway SVG Diagram */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-b from-[#0B0D10] via-[#0F141E] to-[#0B0D10] border border-white/10 p-4 relative overflow-hidden flex flex-col justify-between min-h-[390px]">
          {/* Top Legend Bar inside Diagram */}
          <div className="flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A] animate-ping" />
              <span className="text-xs font-mono text-[#DBE6FF]">
                OPELIKA AL FLEET #01~#30 · 차량 내부 투시 인포그래픽
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#9BA3B0]">
              차량 위 번호(①~④)를 클릭해 보세요
            </span>
          </div>

          {/* Center Vehicle Top-Down Cutaway SVG Illustration */}
          <div className="relative my-2 flex items-center justify-center select-none">
            <svg
              viewBox="0 0 800 400"
              className="w-full h-auto max-h-[310px] drop-shadow-[0_16px_36px_rgba(62,106,225,0.22)]"
              role="img"
              aria-label="법인차량과 스마트폰 센서 연결 인포그래픽"
            >
              <defs>
                <linearGradient id="carBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#162033" />
                  <stop offset="50%" stopColor="#1E2B45" />
                  <stop offset="100%" stopColor="#131B2E" />
                </linearGradient>
                <linearGradient id="cabinGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0B0F19" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#162238" stopOpacity="0.88" />
                </linearGradient>
                <radialGradient id="geofencePulse" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3E6AE1" stopOpacity="0.22" />
                  <stop offset="70%" stopColor="#12B76A" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#12B76A" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Outer 150m Geofence Radar Rings */}
              <ellipse
                cx="400"
                cy="200"
                rx="370"
                ry="175"
                fill="url(#geofencePulse)"
                stroke="#3E6AE1"
                strokeWidth="1"
                strokeDasharray="6 6"
                opacity="0.6"
              />
              <ellipse
                cx="400"
                cy="200"
                rx="300"
                ry="140"
                fill="none"
                stroke="#12B76A"
                strokeWidth="1"
                strokeDasharray="4 6"
                opacity="0.45"
              />

              {/* Geofence Label */}
              <text
                x="400"
                y="36"
                textAnchor="middle"
                fill="#7EA0FF"
                fontSize="11"
                fontFamily="monospace"
              >
                📡 4400 Northpark Dr 차고지 지오펜스 (반경 150m 진입 · 시동 OFF 시 자동 반납)
              </text>

              {/* 4 Wheels */}
              <rect x="205" y="68" width="76" height="24" rx="8" fill="#090B0E" stroke="#475467" strokeWidth="2" />
              <rect x="515" y="68" width="76" height="24" rx="8" fill="#090B0E" stroke="#475467" strokeWidth="2" />
              <rect x="205" y="308" width="76" height="24" rx="8" fill="#090B0E" stroke="#475467" strokeWidth="2" />
              <rect x="515" y="308" width="76" height="24" rx="8" fill="#090B0E" stroke="#475467" strokeWidth="2" />

              {/* Main Vehicle Body Silhouette (Facing Right -> Front is Right side, or Left is Front; let's make Left = Front Hood so Driver Seat is Left-Bottom / US Left-Hand Drive!) */}
              {/* Wait: If Front of Car is on the LEFT (x=120), then facing Left (-X), US Left-Hand Drive Driver Seat is at the BOTTOM-LEFT (y=245, x=330) and Passenger Seat is TOP-LEFT (y=155, x=330). Let's label FRONT clearly! */}
              <path
                d="M 135 140
                   Q 115 200 135 260
                   L 185 295
                   Q 220 312 280 312
                   L 560 312
                   Q 635 312 660 275
                   Q 678 200 660 125
                   Q 635 88 560 88
                   L 280 88
                   Q 220 88 185 105
                   Z"
                fill="url(#carBodyGrad)"
                stroke="#688FF5"
                strokeWidth="2.5"
              />

              {/* Headlights (Left = Front of Vehicle) */}
              <path
                d="M 136 142 L 158 122 L 166 145 Z"
                fill="#9BC1FF"
                opacity="0.9"
              />
              <path
                d="M 136 258 L 158 278 L 166 255 Z"
                fill="#9BC1FF"
                opacity="0.9"
              />
              {/* Headlight Beams */}
              <polygon
                points="135,140 55,105 55,160"
                fill="#3E6AE1"
                opacity="0.18"
              />
              <polygon
                points="135,260 55,240 55,295"
                fill="#3E6AE1"
                opacity="0.18"
              />

              {/* Taillights (Right = Rear of Vehicle) */}
              <rect x="655" y="122" width="10" height="36" rx="4" fill="#E82127" />
              <rect x="655" y="242" width="10" height="36" rx="4" fill="#E82127" />

              {/* Front Hood Lines */}
              <line x1="165" y1="150" x2="255" y2="135" stroke="#3E6AE1" strokeWidth="1" opacity="0.45" />
              <line x1="165" y1="250" x2="255" y2="265" stroke="#3E6AE1" strokeWidth="1" opacity="0.45" />
              <text x="195" y="204" textAnchor="middle" fill="#9BC1FF" fontSize="11" fontFamily="monospace" fontWeight="bold">
                FRONT (전방)
              </text>

              {/* Cabin Interior Cutaway Glass Area */}
              <path
                d="M 255 122
                   L 315 106
                   L 535 106
                   L 585 126
                   L 585 274
                   L 535 294
                   L 315 294
                   L 255 278
                   Z"
                fill="url(#cabinGlassGrad)"
                stroke="#475467"
                strokeWidth="2"
              />

              {/* Dashboard & Infotainment Console (x=275..315) */}
              <rect
                x="275"
                y="115"
                width="36"
                height="170"
                rx="10"
                fill="#192338"
                stroke="#688FF5"
                strokeWidth="1.5"
              />

              {/* Steering Wheel & Driver Odometer Cluster (US Left-Hand Drive = Bottom Side y=235) */}
              <circle
                cx="315"
                cy="245"
                r="20"
                fill="none"
                stroke="#9BC1FF"
                strokeWidth="4"
              />
              <line x1="295" y1="245" x2="335" y2="245" stroke="#9BC1FF" strokeWidth="2.5" />
              <line x1="315" y1="245" x2="315" y2="265" stroke="#9BC1FF" strokeWidth="2.5" />

              {/* Driver Seat (Bottom Front: x=345..425, y=215..280) */}
              <rect
                x="350"
                y="214"
                width="74"
                height="64"
                rx="12"
                fill="#1D2939"
                stroke="#32D583"
                strokeWidth="2"
              />
              <text x="387" y="246" textAnchor="middle" fill="#32D583" fontSize="11" fontWeight="bold">
                운전석 (Driver)
              </text>
              <text x="387" y="261" textAnchor="middle" fill="#9BA3B0" fontSize="9" fontFamily="monospace">
                RSSI -52dBm
              </text>

              {/* Front Passenger Seat (Top Front: x=350..424, y=122..186) */}
              <rect
                x="350"
                y="122"
                width="74"
                height="64"
                rx="12"
                fill="#161E2E"
                stroke="#475467"
                strokeWidth="1.5"
              />
              <text x="387" y="154" textAnchor="middle" fill="#9BA3B0" fontSize="11">
                조수석 (동승석)
              </text>
              <text x="387" y="168" textAnchor="middle" fill="#636B78" fontSize="9" fontFamily="monospace">
                동승 자동분리
              </text>

              {/* Rear Seats (x=465..535) */}
              <rect
                x="468"
                y="122"
                width="65"
                height="156"
                rx="12"
                fill="#141B29"
                stroke="#344054"
                strokeWidth="1.5"
              />
              <text x="500" y="204" textAnchor="middle" fill="#636B78" fontSize="11">
                뒷좌석
              </text>

              {/* Center Console Bluetooth Audio & Smartphone Cradle (x=310..355, y=184..216) */}
              <rect
                x="302"
                y="182"
                width="48"
                height="36"
                rx="6"
                fill="#0F172A"
                stroke="#3E6AE1"
                strokeWidth="2"
              />
              <text x="326" y="203" textAnchor="middle" fill="#9BC1FF" fontSize="9" fontFamily="monospace">
                BT·거치대
              </text>

              {/* Bluetooth & Sensor Wave Lines Connecting Dashboard <-> Driver Smartphone */}
              <path
                d="M 326 200 Q 355 225 375 240"
                fill="none"
                stroke="#32D583"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* License Plate Badge at Rear */}
              <rect x="600" y="176" width="52" height="48" rx="6" fill="#0B0D10" stroke="#3E6AE1" strokeWidth="1.5" />
              <text x="626" y="196" textAnchor="middle" fill="#9BC1FF" fontSize="9" fontFamily="monospace" fontWeight="bold">
                AL 41A
              </text>
              <text x="626" y="210" textAnchor="middle" fill="#F4F6F8" fontSize="9" fontFamily="monospace">
                #01~#30
              </text>
            </svg>

            {/* Interactive Overlay Hotspot Buttons (① ~ ④) */}
            {HOTSPOTS.map((spot) => {
              const isSelected = spot.id === activeHotspotId;
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => setActiveHotspotId(spot.id)}
                  style={{
                    left: `${spot.xPercent}%`,
                    top: `${spot.yPercent}%`,
                  }}
                  className={`-translate-x-1/2 -translate-y-1/2 absolute z-20 group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#3E6AE1] text-white ring-4 ring-[#3E6AE1]/40 scale-110 shadow-xl'
                      : 'bg-[#0B0D10]/90 text-[#F4F6F8] border border-white/30 hover:scale-105 hover:border-[#3E6AE1]'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-black"
                    style={{ backgroundColor: spot.color }}
                  >
                    {spot.stepNumber}
                  </span>
                  <span className="hidden sm:inline whitespace-nowrap text-[11px]">
                    {spot.id === 'QR_KEY'
                      ? '차키 QR 스캔'
                      : spot.id === 'BT_AUDIO'
                        ? '차량 블루투스'
                        : spot.id === 'IMU_MOUNT'
                          ? '스마트폰 6축센서'
                          : '계기판·자동반납'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Quick Summary Strip inside Diagram */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-[11px]">
            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[#32D583] font-mono font-bold">① QR 키링 스캔</span>
              <p className="text-[#9BA3B0] text-[10px] mt-0.5">페어링 없이 1초 차량 매칭</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[#9BC1FF] font-mono font-bold">② 순정 BT 오디오</span>
              <p className="text-[#9BA3B0] text-[10px] mt-0.5">시동 시 운전석 자동 판별</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[#FDB022] font-mono font-bold">③ 스마트폰 6축센서</span>
              <p className="text-[#9BA3B0] text-[10px] mt-0.5">무블랙박스 충돌·회전 감지</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[#D8B4FE] font-mono font-bold">④ 150m 차고지 복귀</span>
              <p className="text-[#9BA3B0] text-[10px] mt-0.5">시동 OFF 자동반납·GPS차단</p>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Active Hotspot Step-by-Step Guide + Smartphone Permission Card */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {/* Selected Hotspot Detail Card */}
          <div className="rounded-2xl bg-[#0B0D10] border border-[#3E6AE1]/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#3E6AE1]/20 text-[#9BC1FF] border border-[#3E6AE1]/40">
                POINT {activeHotspot.stepNumber} · {activeHotspot.badge}
              </span>
              <span className="text-[11px] font-mono text-[#32D583]">
                하드웨어 추가 비용 $0
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#F4F6F8]">
                {activeHotspot.title}
              </h3>
              <p className="text-xs text-[#9BA3B0] mt-1">{activeHotspot.subtitle}</p>
            </div>

            <div className="space-y-2.5">
              {activeHotspot.actionSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#131720] border border-white/10 flex items-start gap-2.5 text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-[#3E6AE1]/25 text-[#9BC1FF] font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-[#F4F6F8] leading-relaxed">{step}</span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 text-xs text-[#A6F4C5] flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#32D583] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#32D583]">핵심 작동 원리: </span>
                {activeHotspot.zeroHardwarePoint}
              </div>
            </div>
          </div>

          {/* Quick OS Switcher Preview Card inside Right Column */}
          <div className="rounded-2xl bg-[#0B0D10] border border-white/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#3E6AE1]" />
                <h4 className="text-xs font-bold text-[#F4F6F8]">
                  스마트폰 기종별 상세 설정 모드 선택
                </h4>
              </div>
              <div className="flex rounded-lg bg-[#131720] p-0.5 border border-white/10 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPhoneOsTab('IOS')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    phoneOsTab === 'IOS'
                      ? 'bg-[#3E6AE1] text-white'
                      : 'text-[#9BA3B0] hover:text-white'
                  }`}
                >
                  🍎 iPhone (Safari)
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneOsTab('ANDROID')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    phoneOsTab === 'ANDROID'
                      ? 'bg-[#12B76A] text-white'
                      : 'text-[#9BA3B0] hover:text-white'
                  }`}
                >
                  🤖 Android (Chrome)
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#9BA3B0]">
              아래 상세 박스에는 <strong>{phoneOsTab === 'IOS' ? 'iPhone (iOS Safari)' : 'Android (Galaxy · Chrome)'}</strong> 기준 <strong>① 웹앱 설치 → ② 3대 센서·근처기기 권한 허용 → ③ 차량 탑승 시 자동 연결(QR / 블루투스)</strong>의 실제 휴대폰 메뉴 경로와 팝업창 조작법이 단계별로 정리되어 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Full-Width Detailed Smartphone 1-Time Setup Guide (Expanded Step-by-Step for iOS & Android) */}
      <div className="rounded-2xl bg-[#0B0D10] border border-[#3E6AE1]/40 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3E6AE1]/20 border border-[#3E6AE1]/40 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-[#9BC1FF]" />
            </div>
            <div>
              <h3 className="text-sm lg:text-base font-bold text-[#F4F6F8]">
                📱 핸드폰 최초 1회 설정 상세 매뉴얼 (입사/최초 탑승 시 딱 1번 · 30초 완료)
              </h3>
              <p className="text-xs text-[#9BA3B0]">
                별도 앱스토어 검색 없이 사내 배포 URL 접속만으로 설치되며, 아래 3단계를 최초 1회만 완료하면 이후에는 무조작으로 작동합니다.
              </p>
            </div>
          </div>

          <div className="flex rounded-xl bg-[#131720] p-1 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setPhoneOsTab('IOS')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
                phoneOsTab === 'IOS'
                  ? 'bg-[#3E6AE1] text-white shadow'
                  : 'text-[#9BA3B0] hover:text-white'
              }`}
            >
              🍎 iPhone (iOS · Safari) 상세 보기
            </button>
            <button
              type="button"
              onClick={() => setPhoneOsTab('ANDROID')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
                phoneOsTab === 'ANDROID'
                  ? 'bg-[#12B76A] text-white shadow'
                  : 'text-[#9BA3B0] hover:text-white'
              }`}
            >
              🤖 Android (Galaxy · Chrome) 상세 보기
            </button>
          </div>
        </div>

        {phoneOsTab === 'ANDROID' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            {/* Android Step 1 */}
            <div className="p-4 rounded-xl bg-[#131720] border border-[#12B76A]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#12B76A]/20 text-[#32D583] font-mono font-bold text-[11px]">
                  STEP 1 · 웹앱 설치 (10초)
                </span>
                <span className="text-[11px] font-mono text-[#9BA3B0]">Chrome 브라우저</span>
              </div>
              <h4 className="text-sm font-bold text-[#32D583]">
                1. 홈 화면에 웹앱(PWA) 아이콘 설치
              </h4>
              <ol className="space-y-1.5 text-[#D0D5DD] list-decimal list-inside leading-relaxed">
                <li>
                  안드로이드 <strong>Chrome(크롬)</strong> 앱에서 사내 차량 관제 웹앱 URL에 접속합니다.
                </li>
                <li>
                  우측 상단 <strong>점 3개 메뉴 <code className="px-1 py-0.5 rounded bg-black/50 text-[#F4F6F8]">[⋮]</code></strong> 를 터치합니다.
                </li>
                <li>
                  메뉴에서 <strong>[홈 화면에 추가]</strong> 또는 <strong>[앱 설치 (Install App)]</strong>를 선택하면 바탕화면에 전용 앱 아이콘이 생성됩니다.
                </li>
              </ol>
              <div className="p-2.5 rounded-lg bg-[#0B0D10] border border-white/5 text-[11px] text-[#9BA3B0]">
                💡 <strong>왜 설치하나요?</strong> 일반 브라우저 탭보다 백그라운드 센서 유지력이 높아져 주행 중 화면이 꺼져도 끊김이 없습니다.
              </div>
            </div>

            {/* Android Step 2 */}
            <div className="p-4 rounded-xl bg-[#131720] border border-[#3E6AE1]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#3E6AE1]/20 text-[#9BC1FF] font-mono font-bold text-[11px]">
                  STEP 2 · 3대 권한 허용 (10초)
                </span>
                <span className="text-[11px] font-mono text-[#9BA3B0]">위치 · 블루투스 · 동작센서</span>
              </div>
              <h4 className="text-sm font-bold text-[#9BC1FF]">
                2. 근처 기기(블루투스) · 위치 · 신체활동 허용
              </h4>
              <ol className="space-y-1.5 text-[#D0D5DD] list-decimal list-inside leading-relaxed">
                <li>
                  임직원 모바일 화면 상단의 <strong>[📡 실제 휴대폰 센서(GPS·6축 IMU) 연결]</strong> 버튼을 터치합니다.
                </li>
                <li>
                  팝업창이 뜨면 <strong>① 위치 권한: [앱 사용 중에만 허용]</strong>을 누릅니다.
                </li>
                <li>
                  이어서 <strong>[🔵 블루투스 연결]</strong> 터치 시 뜨는 <strong>② 근처 기기(Nearby devices) 허용</strong> 및 <strong>③ 신체 활동(가속도·자이로 센서) 허용</strong>을 누릅니다.
                </li>
              </ol>
              <div className="p-2.5 rounded-lg bg-[#0B0D10] border border-white/5 text-[11px] text-[#9BA3B0]">
                🔧 <strong>실수로 팝업을 닫았을 때:</strong> 주소창 왼쪽 <code className="px-1 py-0.5 rounded bg-black/50 text-[#F4F6F8]">[자물쇠/설정 아이콘]</code> → <strong>[권한]</strong> → 위치·근처 기기·동작 센서를 <strong>[허용]</strong>으로 켜주세요.
              </div>
            </div>

            {/* Android Step 3 */}
            <div className="p-4 rounded-xl bg-[#131720] border border-[#F79009]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#F79009]/20 text-[#FDB022] font-mono font-bold text-[11px]">
                  STEP 3 · 탑승 시 자동 연결 (10초)
                </span>
                <span className="text-[11px] font-mono text-[#9BA3B0]">QR 스캔 또는 BT 연동</span>
              </div>
              <h4 className="text-sm font-bold text-[#FDB022]">
                3. 차량 탑승 시 1초 연결 (2가지 방식 중 택1)
              </h4>
              <ul className="space-y-1.5 text-[#D0D5DD] leading-relaxed">
                <li>
                  ✅ <strong>방식 A (가장 쉬움 · 차키 QR 스캔):</strong> 블루투스 페어링 없이 자동차 키고리에 붙은 <strong>QR 스티커를 휴대폰 카메라로 스캔</strong>(또는 앱 상단 <strong>[⚡ 무설정 1초 탑승]</strong> 클릭)하면 차량 번호판과 즉시 매칭되어 출발 처리됩니다.
                </li>
                <li>
                  ✅ <strong>방식 B (차량 순정 블루투스 자동연결):</strong> 차량 오디오 화면에서 최초 1회 휴대폰 블루투스를 연결해 두면, 이후에는 <strong>시동(ACC ON)만 걸어도 자동 매칭</strong>되며 차고지(4400 Northpark Dr) 복귀 후 시동을 끄면 자동 반납됩니다.
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            {/* iOS Step 1 */}
            <div className="p-4 rounded-xl bg-[#131720] border border-[#3E6AE1]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#3E6AE1]/20 text-[#9BC1FF] font-mono font-bold text-[11px]">
                  STEP 1 · 홈 화면에 추가 (10초)
                </span>
                <span className="text-[11px] font-mono text-[#9BA3B0]">iOS Safari 전용</span>
              </div>
              <h4 className="text-sm font-bold text-[#9BC1FF]">
                1. Safari에서 [홈 화면에 추가]로 웹앱 설치
              </h4>
              <ol className="space-y-1.5 text-[#D0D5DD] list-decimal list-inside leading-relaxed">
                <li>
                  아이폰 기본 브라우저인 <strong>Safari(사파리)</strong>로 사내 차량 관제 URL을 엽니다.
                </li>
                <li>
                  화면 하단 중앙의 <strong>[공유 아이콘 <code className="px-1 py-0.5 rounded bg-black/50 text-[#F4F6F8]">↑</code>]</strong> 을 터치합니다.
                </li>
                <li>
                  메뉴를 아래로 내려 <strong>[홈 화면에 추가 (Add to Home Screen)] → 우측 상단 [추가]</strong>를 누르면 아이폰 바탕화면에 전용 앱이 생성됩니다.
                </li>
              </ol>
              <div className="p-2.5 rounded-lg bg-[#0B0D10] border border-white/5 text-[11px] text-[#9BA3B0]">
                💡 <strong>주의:</strong> 카카오톡 인앱 브라우저가 아닌 <strong>Safari</strong>에서 열어야 6축 가속도·자이로 센서가 정상 작동합니다.
              </div>
            </div>

            {/* iOS Step 2 */}
            <div className="p-4 rounded-xl bg-[#131720] border border-[#12B76A]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#12B76A]/20 text-[#32D583] font-mono font-bold text-[11px]">
                  STEP 2 · 센서 권한 허용 (10초)
                </span>
                <span className="text-[11px] font-mono text-[#9BA3B0]">위치 · 동작 및 방향</span>
              </div>
              <h4 className="text-sm font-bold text-[#32D583]">
                2. 위치(GPS) 및 동작·방향(6축 센서) 권한 허용
              </h4>
              <ol className="space-y-1.5 text-[#D0D5DD] list-decimal list-inside leading-relaxed">
                <li>
                  바탕화면에 설치된 웹앱을 열고 상단의 <strong>[📡 실제 휴대폰 센서(GPS·6축 IMU) 연결]</strong> 버튼을 터치합니다.
                </li>
                <li>
                  아이폰 시스템 팝업에서 <strong>① &quot;동작 및 방향 접근을 허용하시겠습니까?&quot; → [허용]</strong>을 누릅니다. (블랙박스 대체 6축 충돌 감지용)
                </li>
                <li>
                  이어서 <strong>② &quot;위치 정보 접근&quot; → [앱을 사용하는 동안 허용]</strong>을 누릅니다.
                </li>
              </ol>
              <div className="p-2.5 rounded-lg bg-[#0B0D10] border border-white/5 text-[11px] text-[#9BA3B0]">
                🔧 <strong>권한 재설정 경로:</strong> 아이폰 <strong>[설정 → 개인정보 보호 및 보안 → 위치 서비스 → Safari 웹사이트 → 앱을 사용하는 동안]</strong>
              </div>
            </div>

            {/* iOS Step 3 */}
            <div className="p-4 rounded-xl bg-[#131720] border border-[#F79009]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#F79009]/20 text-[#FDB022] font-mono font-bold text-[11px]">
                  STEP 3 · 탑승 시 1초 연결 (10초)
                </span>
                <span className="text-[11px] font-mono text-[#9BA3B0]">차키 QR 스캔 권장</span>
              </div>
              <h4 className="text-sm font-bold text-[#FDB022]">
                3. 차키 QR 스캔 또는 차량 블루투스로 즉시 출발
              </h4>
              <ul className="space-y-1.5 text-[#D0D5DD] leading-relaxed">
                <li>
                  ✅ <strong>방식 A (아이폰 권장 · 1초 QR 스캔):</strong> iOS 보안 정책상 웹 블루투스 수동 검색 대신, <strong>자동차 키고리의 QR 태그를 아이폰 기본 카메라로 비추면</strong> 1초 만에 해당 호차(`#01~#30호차`) 배차 승인 + 센서 연동이 동시에 켜집니다.
                </li>
                <li>
                  ✅ <strong>방식 B (차고지 복귀 시 자동 반납):</strong> 운행을 마치고 본사 차고지(<strong>4400 Northpark Dr</strong> 반경 150m)에 주차하면 자동으로 반납 처리되며, 퇴근 후 개인 이동 위치는 일절 수집되지 않습니다.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
