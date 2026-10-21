-- FleetGuard 30 Production Database Schema (Supabase PostgreSQL + Realtime)
-- Location: 4400 Northpark Dr, Opelika, AL 36801 (Lee County AL 41 Fleet)
-- Premise: 0 In-Car Dashcams, 0 OBD Hardware, 100% Smartphone 6-Axis IMU + Bluetooth Telemetry

create extension if not exists "uuid-ossp";

-- 1. Corporate Vehicles Master (30 Vehicles)
create table if not exists public.vehicles (
  id text primary key,
  fleet_number int not null unique check (fleet_number between 1 and 30),
  plate_number text not null unique, -- e.g. 'AL 41A-9012'
  model_name text not null,
  bt_mac_address text not null,
  ble_beacon_uuid text not null,
  status text not null default 'IDLE' check (status in ('IDLE', 'AUTHORIZED', 'UNAUTHORIZED', 'INCIDENT')),
  speed_kmh numeric(5,1) not null default 0,
  current_g_force numeric(4,2) not null default 1.00,
  rssi_dbm int not null default -95,
  current_driver_id text,
  co_passenger_ids text[] default '{}',
  driver_selection_reason text,
  trip_purpose text,
  trip_started_at timestamptz,
  cumulative_gps_km numeric(10,1) not null default 0,
  last_verified_odometer_km numeric(10,1) not null default 0,
  parking_zone text not null default 'Northpark Lot A',
  lat double precision not null default 32.6912,
  lng double precision not null default -85.3298,
  is_locked_by_admin boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2. Employees & Permission Heartbeat Governance
create table if not exists public.employees (
  id text primary key,
  name text not null,
  role text not null,
  department text not null,
  phone text not null,
  permission_status text not null default 'OK' check (permission_status in ('OK', 'BT_OFF', 'GPS_OFF', 'STALE')),
  last_heartbeat_at timestamptz not null default now(),
  in_garage_geofence boolean not null default false,
  last_keybox_access_at timestamptz,
  dispatch_allowed boolean not null default true,
  violation_count int not null default 0
);

-- 3. 4-Stage Vehicle Dispatch Reservations (Request -> Approve -> In Use -> Returned)
create table if not exists public.vehicle_reservations (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  fleet_number int not null,
  plate_number text not null,
  model_name text not null,
  employee_id text not null references public.employees(id),
  employee_name text not null,
  department text not null,
  purpose text not null,
  destination text not null,
  planned_time_window text not null,
  stage text not null default 'REQUESTED' check (stage in ('REQUESTED', 'APPROVED', 'IN_USE', 'RETURNED', 'REJECTED')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  started_at timestamptz,
  returned_at timestamptz,
  start_odometer_km numeric(10,1) not null,
  end_odometer_km numeric(10,1),
  return_parking_zone text,
  key_returned_to_box boolean not null default false,
  notes text
);

-- 4. No-Dashcam Smartphone 6-Axis IMU Incident Reconstruction Log
create table if not exists public.incident_events (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  plate_number text not null,
  driver_id text references public.employees(id),
  driver_name text not null,
  co_passenger_names text[] default '{}',
  event_type text not null check (event_type in ('UNAUTHORIZED_START', 'IMPACT_SHOCK', 'HARD_BRAKE', 'GHOST_TRIP_SUSPECT', 'PERMISSION_EVASION')),
  title text not null,
  description text not null,
  g_force numeric(4,2),
  delta_speed_kmh numeric(5,1),
  gyro_yaw_deg_per_sec numeric(5,1),
  impact_direction text,
  speed_trace numeric[] default '{}',
  location_label text not null,
  occurred_at timestamptz not null default now(),
  resolved boolean not null default false,
  manager_resolution_note text,
  sensor_fusion_verdict text default 'N/A'
);

-- 5. Tax & Audit Vehicle Logbook
create table if not exists public.tax_logs (
  id text primary key,
  drive_date date not null default current_date,
  plate_number text not null,
  model_name text not null,
  department text not null,
  driver_name text not null,
  auth_type text not null,
  purpose text not null,
  start_time text not null,
  end_time text not null,
  start_odometer_km numeric(10,1) not null,
  end_odometer_km numeric(10,1) not null,
  distance_km numeric(10,1) not null,
  auto_return_verified boolean not null default true,
  created_at timestamptz not null default now()
);

-- Enable Supabase Realtime on live tables
alter publication supabase_realtime add table public.vehicles;
alter publication supabase_realtime add table public.vehicle_reservations;
alter publication supabase_realtime add table public.incident_events;
alter publication supabase_realtime add table public.employees;
