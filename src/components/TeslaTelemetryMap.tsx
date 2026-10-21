'use client';

import React from 'react';
import {
  AlertTriangle,
  Bluetooth,
  Compass,
  Navigation,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { Employee, IncidentEvent, Vehicle } from '@/types/fleet';

interface TeslaTelemetryMapProps {
  vehicles: Vehicle[];
  employees: Employee[];
  selectedVehicle: Vehicle;
  onSelectVehicle: (vehicle: Vehicle) => void;
  latestIncidentForSelected?: IncidentEvent;
}

export const TeslaTelemetryMap: React.FC<TeslaTelemetryMapProps> = ({
  vehicles,
  employees,
  selectedVehicle,
  onSelectVehicle,
  latestIncidentForSelected,
}) => {
  const getEmployeeName = (empId: string | null): string => {
    if (!empId) return '미탑승 (대기중)';
    const found = employees.find((e) => e.id === empId);
    return found ? `${found.name} (${found.department})` : empId;
  };

  // Convert lat/lng around HQ (4400 Northpark Dr, Opelika, AL 36801: 32.6912, -85.3298) into percentage coordinates for the radar viewport
  const toCanvasCoords = (lat: number, lng: number) => {
    const centerLat = 32.6912;
    const centerLng = -85.3298;
    const y = 52 - (lat - centerLat) * 1650;
    const x = 48 + (lng - centerLng) * 1450;
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(10, Math.min(88, y)),
    };
  };

  const activeVehicles = vehicles.filter((v) => v.status !== 'IDLE');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Left 8 cols: Tesla Dark Vector Navigation & Geofence Radar */}
      <div
        className="xl:col-span-8 relative h-[430px] rounded-xl overflow-hidden bg-[#080A0E] select-none"
        style={{
          boxShadow:
            'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.6) 0px 12px 24px -8px',
        }}
      >
        {/* Subtle Automotive Telemetry Grid SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="tesla-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#262E3D"
                strokeWidth="0.75"
              />
            </pattern>
            <radialGradient id="hq-glow" cx="48%" cy="52%" r="42%">
              <stop offset="0%" stopColor="#3E6AE1" stopOpacity="0.22" />
              <stop offset="65%" stopColor="#12B76A" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#080A0E" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#tesla-grid)" />
          <rect width="100%" height="100%" fill="url(#hq-glow)" />

          {/* Simulated arterial roads */}
          <path
            d="M 0 220 Q 320 215 680 180 T 1000 120"
            fill="none"
            stroke="#1E2532"
            strokeWidth="10"
          />
          <path
            d="M 380 0 L 420 460"
            fill="none"
            stroke="#1E2532"
            strokeWidth="8"
          />
          <path
            d="M 120 420 L 760 40"
            fill="none"
            stroke="#1A202C"
            strokeWidth="5"
            strokeDasharray="6 6"
          />
        </svg>

        {/* Top HUD Overlay Bar */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
          <div className="flex items-center gap-2.5 bg-[#131720]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
            <Radio className="w-4 h-4 text-[#3E6AE1] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#F4F6F8]">
              OPELIKA HQ RADAR · 4400 NORTHPARK DR, OPELIKA, AL 36801 (150m GEOFENCE)
            </span>
          </div>

          <div className="flex items-center gap-3 bg-[#131720]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-[#E82127]">
              <span className="w-2 h-2 rounded-full bg-[#E82127] animate-ping" />
              무단/사고 {vehicles.filter((v) => v.status === 'UNAUTHORIZED' || v.status === 'INCIDENT').length}대
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5 text-[#3E6AE1]">
              <span className="w-2 h-2 rounded-full bg-[#3E6AE1]" />
              정상운행 {vehicles.filter((v) => v.status === 'AUTHORIZED').length}대
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5 text-[#12B76A]">
              <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
              차고지대기 {vehicles.filter((v) => v.status === 'IDLE').length}대
            </span>
          </div>
        </div>

        {/* HQ Garage Geofence (150m) & Keybox Zone (3m) */}
        <div
          className="absolute rounded-full border border-dashed border-[#12B76A]/45 bg-[#12B76A]/[0.04] flex items-center justify-center pointer-events-none"
          style={{
            width: '170px',
            height: '170px',
            left: '48%',
            top: '52%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-14 h-14 rounded-full border border-[#3E6AE1]/50 bg-[#3E6AE1]/10 flex flex-col items-center justify-center">
            <span className="text-[10px] font-mono text-[#3E6AE1] font-semibold">KEYBOX</span>
            <span className="text-[9px] font-mono text-[#9BA3B0]">BLE 3m</span>
          </div>
          <span className="absolute -bottom-5 text-[10px] font-mono text-[#12B76A]/90 tracking-tight whitespace-nowrap">
            4400 Northpark Dr 지오펜스 (반경 150m · 대기 {vehicles.filter((v) => v.status === 'IDLE').length}대)
          </span>
        </div>

        {/* Plot Active Vehicles on Radar */}
        {activeVehicles.map((veh) => {
          const pos = toCanvasCoords(veh.lat, veh.lng);
          const isSelected = selectedVehicle.id === veh.id;
          const isAlert = veh.status === 'UNAUTHORIZED' || veh.status === 'INCIDENT';
          const badgeColor =
            veh.status === 'INCIDENT'
              ? 'bg-[#E82127] text-white border-[#FF6B6B]'
              : veh.status === 'UNAUTHORIZED'
                ? 'bg-[#E82127]/95 text-white border-[#E82127]'
                : 'bg-[#3E6AE1] text-white border-[#688FF5]';

          return (
            <button
              key={veh.id}
              type="button"
              onClick={() => onSelectVehicle(veh)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 z-20 ${
                isSelected ? 'scale-110 z-30' : 'hover:scale-105'
              }`}
            >
              {isAlert && (
                <span className="absolute -inset-2.5 rounded-full bg-[#E82127]/35 animate-ping pointer-events-none" />
              )}
              <div
                className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono shadow-lg ${badgeColor} ${
                  isSelected ? 'ring-2 ring-white' : ''
                }`}
              >
                {veh.status === 'INCIDENT' ? (
                  <Zap className="w-3.5 h-3.5 text-yellow-200 animate-bounce" />
                ) : veh.status === 'UNAUTHORIZED' ? (
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
                <span className="font-semibold">{veh.fleetNumber}호차</span>
                <span className="text-[10px] opacity-90 tabular-nums">{veh.speedKmh}km/h</span>
              </div>
              <div className="mt-1 px-2 py-0.5 rounded bg-[#0B0D10]/90 border border-white/10 text-[10px] text-[#F4F6F8] whitespace-nowrap font-mono">
                {veh.plateNumber} · {getEmployeeName(veh.currentDriverId).split(' ')[0]}
              </div>
            </button>
          );
        })}

        {/* Bottom Legend & Privacy Assurance Pill */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-[#131720]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-[#9BA3B0]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#12B76A]" />
            <span>
              프라이버시 보호 활성: 법인차량 블루투스 미감지 직원의 개인 이동 경로는 수집되지 않습니다 (패킷 0건)
            </span>
          </div>
          <div className="bg-[#131720]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[11px] font-mono text-[#9BA3B0]">
            HARDWARE COST: <span className="text-[#12B76A] font-semibold">$0 / MO</span>
          </div>
        </div>
      </div>

      {/* Right 4 cols: Selected Vehicle Telemetry Cockpit Pod */}
      <div
        className="xl:col-span-4 rounded-xl bg-[#131720] p-4 flex flex-col justify-between"
        style={{
          boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px',
        }}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-white/10 text-[#F4F6F8]">
                  #{selectedVehicle.fleetNumber.toString().padStart(2, '0')}호차
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-[#F4F6F8]">
                  {selectedVehicle.plateNumber}
                </h3>
              </div>
              <p className="text-xs text-[#9BA3B0] mt-0.5">{selectedVehicle.modelName}</p>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium ${
                selectedVehicle.status === 'INCIDENT'
                  ? 'bg-[#E82127]/20 text-[#FF6B6B] border border-[#E82127]/50'
                  : selectedVehicle.status === 'UNAUTHORIZED'
                    ? 'bg-[#E82127]/20 text-[#FF6B6B] border border-[#E82127]/50'
                    : selectedVehicle.status === 'AUTHORIZED'
                      ? 'bg-[#3E6AE1]/20 text-[#7EA0FF] border border-[#3E6AE1]/40'
                      : 'bg-[#12B76A]/15 text-[#32D583] border border-[#12B76A]/30'
              }`}
            >
              {selectedVehicle.status === 'INCIDENT'
                ? '💥 충격/사고 감지'
                : selectedVehicle.status === 'UNAUTHORIZED'
                  ? '🚨 미승인 무단운행'
                  : selectedVehicle.status === 'AUTHORIZED'
                    ? '정상 승인 운행'
                    : '차고지 대기중'}
            </span>
          </div>

          {/* Digital Speedometer & G-Force Readout */}
          <div className="grid grid-cols-3 gap-2.5 my-3.5">
            <div className="bg-[#191E2A] rounded-lg p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-[#9BA3B0] block">SPEED</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold font-mono tabular-nums text-[#F4F6F8]">
                  {selectedVehicle.speedKmh}
                </span>
                <span className="text-[11px] font-mono text-[#636B78]">km/h</span>
              </div>
            </div>

            <div className="bg-[#191E2A] rounded-lg p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-[#9BA3B0] block">G-SENSOR</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={`text-2xl font-semibold font-mono tabular-nums ${
                    selectedVehicle.currentGForce >= 2.5 ? 'text-[#E82127]' : 'text-[#F4F6F8]'
                  }`}
                >
                  {selectedVehicle.currentGForce.toFixed(2)}
                </span>
                <span className="text-[11px] font-mono text-[#636B78]">G</span>
              </div>
            </div>

            <div className="bg-[#191E2A] rounded-lg p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-[#9BA3B0] block">BT RSSI</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-semibold font-mono tabular-nums text-[#3E6AE1]">
                  {selectedVehicle.rssiDbm}
                </span>
                <span className="text-[11px] font-mono text-[#636B78]">dBm</span>
              </div>
            </div>
          </div>

          {/* Driver & Co-Passenger Attribution Box */}
          <div className="bg-[#191E2A] rounded-lg p-3 border border-white/5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#9BA3B0] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#3E6AE1]" />
                주 운전자 (책임자)
              </span>
              <span className="font-medium text-[#F4F6F8]">
                {getEmployeeName(selectedVehicle.currentDriverId)}
              </span>
            </div>

            {selectedVehicle.coPassengerIds.length > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[#9BA3B0]">동승자 감지</span>
                <span className="text-[#F79009] font-mono">
                  {selectedVehicle.coPassengerIds.map((id) => getEmployeeName(id)).join(', ')}
                </span>
              </div>
            )}

            {selectedVehicle.driverSelectionReason && (
              <div className="pt-1.5 border-t border-white/5 text-[11px] text-[#9BA3B0] leading-relaxed">
                <span className="text-[#3E6AE1] font-mono font-semibold mr-1">[운전자 판별 근거]</span>
                {selectedVehicle.driverSelectionReason}
              </div>
            )}

            <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[#636B78]">
              <span className="flex items-center gap-1">
                <Bluetooth className="w-3 h-3 text-[#3E6AE1]" />
                MAC: {selectedVehicle.btMacAddress}
              </span>
              <span>GPS 누적: {selectedVehicle.cumulativeGpsKm.toLocaleString()}km</span>
            </div>
          </div>
        </div>

        {/* 30-Second Smartphone IMU Speed & Impact Trace (No In-Car Dashcam) */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#9BA3B0] mb-1.5">
            <span className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-[#3E6AE1]" />
              무블랙박스 스마트폰 6축 센서 속도·충격 재구성 (30초)
            </span>
            {latestIncidentForSelected?.gForce && (
              <span className="text-[#E82127] font-semibold">
                PEAK {latestIncidentForSelected.gForce}G
              </span>
            )}
          </div>
          <div className="h-14 bg-[#0B0D10] rounded-lg p-2 flex items-end gap-1 border border-white/5">
            {(latestIncidentForSelected?.speedTrace || [18, 28, 35, 42, 48, 52, 54, 53, 55, 52, 50, selectedVehicle.speedKmh]).map(
              (spd, i) => {
                const heightPct = Math.max(10, Math.min(100, (spd / 80) * 100));
                const isCrashDrop =
                  latestIncidentForSelected?.eventType === 'IMPACT_SHOCK' && i >= 7;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-sm transition-all ${
                        isCrashDrop
                          ? 'bg-[#E82127]'
                          : selectedVehicle.status === 'UNAUTHORIZED'
                            ? 'bg-[#F79009]'
                            : 'bg-[#3E6AE1]'
                      }`}
                    />
                  </div>
                );
              }
            )}
          </div>
          <p className="text-[11px] text-[#9BA3B0] mt-1.5 truncate">
            위치: {selectedVehicle.parkingZone}
          </p>
        </div>
      </div>
    </div>
  );
};
