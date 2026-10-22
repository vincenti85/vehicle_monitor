'use client';

import React from 'react';
import { Navigation, ShieldAlert, Zap } from 'lucide-react';
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
  const getEmployeeShortName = (empId: string | null): string => {
    if (!empId) return '대기';
    const found = employees.find((e) => e.id === empId);
    return found ? found.name.split(' (')[0] : empId;
  };

  const toCanvasCoords = (lat: number, lng: number) => {
    const centerLat = 32.6912;
    const centerLng = -85.3298;
    const y = 52 - (lat - centerLat) * 1650;
    const x = 48 + (lng - centerLng) * 1450;
    return {
      x: Math.max(10, Math.min(90, x)),
      y: Math.max(14, Math.min(86, y)),
    };
  };

  const activeVehicles = vehicles.filter((v) => v.status !== 'IDLE');
  const alertCount = vehicles.filter(
    (v) => v.status === 'UNAUTHORIZED' || v.status === 'INCIDENT'
  ).length;
  const activeCount = vehicles.filter((v) => v.status === 'AUTHORIZED').length;
  const idleCount = vehicles.filter((v) => v.status === 'IDLE').length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
      {/* Left 8 Cols: Vercel Geist Minimalist Map */}
      <div
        className="xl:col-span-8 relative h-[320px] rounded-xl overflow-hidden bg-[#0A0A0A] select-none"
        style={{
          boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px',
        }}
      >
        {/* Minimalist Subtle Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geist-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="#262626"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geist-grid)" />
          <path d="M 0 170 Q 340 165 900 130" fill="none" stroke="#1F1F1F" strokeWidth="6" />
          <path d="M 390 0 L 415 360" fill="none" stroke="#1F1F1F" strokeWidth="5" />
        </svg>

        {/* Minimal Top Pill Header */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
          <span
            className="px-2.5 py-1 rounded-full bg-[#111111]/90 text-[11px] font-mono text-[#A1A1AA]"
            style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
          >
            4400 Northpark Dr · 150m Geofence
          </span>

          <div
            className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#111111]/90 text-[11px] font-mono"
            style={{ boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px' }}
          >
            <span className="flex items-center gap-1 text-[#FF5B4F]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5B4F]" />
              이상 {alertCount}
            </span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1 text-[#0A72EF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A72EF]" />
              운행 {activeCount}
            </span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1 text-[#10B981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              대기 {idleCount}
            </span>
          </div>
        </div>

        {/* Minimal Center Geofence Ring */}
        <div
          className="absolute rounded-full border border-dashed border-white/15 flex items-center justify-center pointer-events-none"
          style={{
            width: '130px',
            height: '130px',
            left: '48%',
            top: '52%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="text-[10px] font-mono text-[#71717A]">
            HQ ({idleCount}대 대기)
          </span>
        </div>

        {/* Active Vehicles as Compact Geist Pills */}
        {activeVehicles.map((veh) => {
          const pos = toCanvasCoords(veh.lat, veh.lng);
          const isSelected = selectedVehicle.id === veh.id;
          const isAlert = veh.status === 'UNAUTHORIZED' || veh.status === 'INCIDENT';

          return (
            <button
              key={veh.id}
              type="button"
              onClick={() => onSelectVehicle(veh)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all z-20 ${
                isSelected ? 'scale-110 z-30' : 'hover:scale-105'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium ${
                  isAlert
                    ? 'bg-[#FF5B4F] text-white'
                    : 'bg-[#0A72EF] text-white'
                } ${isSelected ? 'ring-2 ring-white' : ''}`}
              >
                {veh.status === 'INCIDENT' ? (
                  <Zap className="w-3 h-3" />
                ) : veh.status === 'UNAUTHORIZED' ? (
                  <ShieldAlert className="w-3 h-3" />
                ) : (
                  <Navigation className="w-2.5 h-2.5" />
                )}
                <span>#{veh.fleetNumber}</span>
                <span className="opacity-85 tabular-nums">{veh.speedKmh}km/h</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right 4 Cols: Minimalist Selected Vehicle Card */}
      <div
        className="xl:col-span-4 rounded-xl bg-[#0A0A0A] p-4 flex flex-col justify-between"
        style={{
          boxShadow: 'rgba(255, 255, 255, 0.08) 0px 0px 0px 1px',
        }}
      >
        <div className="space-y-3">
          {/* Row 1: Vehicle ID & Status Pill */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#A1A1AA]">
                  #{selectedVehicle.fleetNumber.toString().padStart(2, '0')}호차
                </span>
                <h3 className="text-base font-semibold tracking-tight text-[#FAFAFA] font-mono">
                  {selectedVehicle.plateNumber}
                </h3>
              </div>
              <p className="text-xs text-[#71717A] mt-0.5">{selectedVehicle.modelName}</p>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                selectedVehicle.status === 'INCIDENT' ||
                selectedVehicle.status === 'UNAUTHORIZED'
                  ? 'bg-[#FF5B4F]/15 text-[#FF5B4F]'
                  : selectedVehicle.status === 'AUTHORIZED'
                    ? 'bg-[#0A72EF]/15 text-[#60A5FA]'
                    : 'bg-[#10B981]/15 text-[#34D399]'
              }`}
            >
              {selectedVehicle.status === 'INCIDENT'
                ? '사고감지'
                : selectedVehicle.status === 'UNAUTHORIZED'
                  ? '무단운행'
                  : selectedVehicle.status === 'AUTHORIZED'
                    ? '정상운행'
                    : '대기중'}
            </span>
          </div>

          {/* Row 2: 3 Key Numbers (Speed · Distance · Sensor) */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-lg bg-[#111111] p-2.5"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-[10px] font-mono text-[#71717A] block">속도</span>
              <span className="text-lg font-semibold font-mono tabular-nums text-[#FAFAFA]">
                {selectedVehicle.speedKmh}
                <small className="text-[10px] text-[#71717A] ml-0.5">km/h</small>
              </span>
            </div>

            <div
              className="rounded-lg bg-[#111111] p-2.5"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-[10px] font-mono text-[#71717A] block">누적거리</span>
              <span className="text-lg font-semibold font-mono tabular-nums text-[#FAFAFA]">
                {selectedVehicle.cumulativeGpsKm.toLocaleString()}
                <small className="text-[10px] text-[#71717A] ml-0.5">km</small>
              </span>
            </div>

            <div
              className="rounded-lg bg-[#111111] p-2.5"
              style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
            >
              <span className="text-[10px] font-mono text-[#71717A] block">충격센서</span>
              <span
                className={`text-lg font-semibold font-mono tabular-nums ${
                  selectedVehicle.currentGForce >= 2.5 ? 'text-[#FF5B4F]' : 'text-[#34D399]'
                }`}
              >
                {selectedVehicle.currentGForce >= 2.5
                  ? `${selectedVehicle.currentGForce.toFixed(1)}G`
                  : '정상'}
              </span>
            </div>
          </div>

          {/* Row 3: Compact 3-Line Metadata */}
          <div
            className="rounded-lg bg-[#111111] p-3 space-y-1.5 text-xs"
            style={{ boxShadow: 'rgba(255, 255, 255, 0.06) 0px 0px 0px 1px' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[#71717A]">운전자</span>
              <span className="font-medium text-[#FAFAFA]">
                {getEmployeeShortName(selectedVehicle.currentDriverId)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#71717A]">위치/상태</span>
              <span className="text-[#A1A1AA] truncate max-w-[180px]">
                {selectedVehicle.parkingZone}
              </span>
            </div>
            {latestIncidentForSelected && (
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[#FF5B4F]">
                <span>최근 이벤트</span>
                <span className="font-mono text-[11px]">
                  PEAK {latestIncidentForSelected.gForce}G ({latestIncidentForSelected.occurredAt})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Minimal Speed Bar Sparkline */}
        <div className="pt-2">
          <div className="h-9 bg-[#111111] rounded-lg px-2 py-1.5 flex items-end gap-1">
            {(
              latestIncidentForSelected?.speedTrace || [
                20, 32, 40, 46, 50, 52, 54, 52, 50, selectedVehicle.speedKmh,
              ]
            ).map((spd, i) => {
              const heightPct = Math.max(15, Math.min(100, (spd / 80) * 100));
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-[#0A72EF]/70"
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
