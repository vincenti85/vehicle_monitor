# FleetGuard 30 — Opelika, AL Corporate Vehicle Dispatch & No-Dashcam Telemetry Cockpit

**본사 차고지:** `4400 Northpark Dr, Opelika, AL 36801` (Lee County, Alabama, USA · `32.6912° N, -85.3298° W`)  
**관리 대상:** 법인차량 30대 (`AL 41A-2237` ~ `AL 41F-6210`, Lee County Prefix `41`)  
**핵심 전제:** 차량 내 블랙박스 0대 · 상용 OBD 하드웨어 0대 · 월 구독료 $0 · **100% 임직원 스마트폰(BYOD) 6축 IMU 센서 + 차량 순정 블루투스/BLE 기반**

---

## 주요 기능 (Core Features)

1. **법인차량 4단계 배차 라이프사이클 (`신청 → 승인 → 사용 → 반납`)**
   - **1단계 신청 (`REQUESTED`):** 임직원이 차량·행선지(Auburn, Montgomery I-85 등)·시간·목적을 선택해 신청
   - **2단계 승인 (`APPROVED` / `REJECTED`):** 관리자가 원클릭 승인 또는 반려 (관리자 부재 시 자동 승인 모드 지원)
   - **3단계 사용 (`IN_USE`):** 키보관함(`3m`) 키 수령 및 차량 순정 블루투스 매칭으로 운행 개시
   - **4단계 반납 (`RETURNED`):** 주차 구역(`Northpark Lot A/B`) 및 키보관함 반납 체크 (또는 차고지 `150m` 지오펜스 복귀 시 무조작 자동 반납) + 세무 운행기록부 자동 생성

2. **키 관리자 부재 시 무단 반출(`UNAUTHORIZED`) 실시간 색출**
   - 사전 승인 없이 키를 가져가 시동을 걸고 주행(`≥ 15km/h`)하면 차량 블루투스(`MAC`) + 키보관함 BLE(`3m`) + GPS 속도를 결합하여 **주 운전자(동승자 분리 포함)**를 특정하고 양방향 Red Alert를 발송합니다.

3. **무블랙박스(`No-Dashcam`) 스마트폰 6축 IMU 사고 자동 재구성**
   - 차량에 블랙박스가 없는 환경에서 스마트폰 **가속도계(G-Force) + 자이로스코프 회전각(`°/s`) + 충돌 전후 30초 GPS 급감속($\Delta v$)** 데이터를 결합해 실제 접촉사고를 재구성합니다.
   - **Sensor Fusion 오탐 필터:** 주행 속도 변화($\Delta v = 0\text{km/h}$) 없는 단발 충격은 거치대 휴대폰 낙하로 자동 분류하여 오탐을 차단합니다.

4. **솔루션 관리자 화면 (`Admin Management Console`)**
   - **차량 30대 마스터 & 계기판 실사:** 블루투스 MAC/BLE 수정, 실제 계기판(km) 실사 대조($+5\text{km}$ 이상 오차 시 유령 주행 용의자 자동 역산), 차량 배차 잠금/해제
   - **임직원 권한 & 블랙리스트 통제:** 권한(`BT/GPS`) 미준수자 강제 푸시 발송, 배차 신청 자격 일시 정지/복원, 신규 임직원 등록
   - **무블랙박스 사고 판정 & 종결:** 6축 센서 리포트 검토 후 조치 내역 기록 및 과실 운전자 즉시 배차 정지
   - **시스템 감지·승인 정책 설정:** 무단 운행 판정 속도, 충격 G-Force 임계값, 지오펜스 반경 실시간 제어

---

## 기술 스택 & 백엔드 구조

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Design System:** Tesla Telemetry & Fleet Cockpit Dark UI (`#0B0D10`, `#131720`, `#E82127`, `#3E6AE1`)
- **Backend API & Persistence:**
  - `GET / POST /api/fleet/state`: 전체 법인차량·배차·사고·정책 상태 영구 동기화 (`src/lib/fleetDatabase.ts`)
  - `POST /api/fleet/telemetry`: 스마트폰 6축 IMU 원시 센서 수신 및 Sensor Fusion 사고 판정
  - `GET /api/health`: 스토리지 엔진 및 레코드 건수 상태 점검
  - `supabase/migrations/001_fleetguard30_schema.sql`: Supabase PostgreSQL + Realtime 확장 DDL

---

## 로컬 실행 및 Vercel 배포

```bash
npm install
npm run dev     # http://localhost:3005
npm run build   # Production build verification
```
