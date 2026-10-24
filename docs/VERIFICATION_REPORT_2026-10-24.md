# FleetGuard 30 — 기능 검증 및 개선 점검 보고서

> 점검일: 2026-10-24 · 대상: `C:\dev\GPS` (main, 48bcc86 + 미커밋 변경) · 점검자: Claude Code
> 방법: 소스 정적 분석 + `npm run build` / `tsc` 실행 + 로컬 dev 서버(`:3005`)에서 브라우저 실제 조작 + API curl 직접 호출

---

## 0. 한 줄 결론

**4개 기능의 화면 흐름은 모두 동작하지만, "관리자 차량 설정이 DB에 저장되지 않는 버그"와 "인증·검증 없는 전체 상태 덮어쓰기 API" 두 가지가 실사용 투입 전 반드시 고쳐야 할 결함이다.** 현재 구조는 단일 브라우저 데모용 아키텍처(클라이언트가 전체 DB를 통째로 POST)이며, 다중 사용자·Vercel 배포 환경에서는 데이터가 유실된다.

---

## 1. 빌드·정적 검증 증거

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입 검사 | `npx tsc --noEmit` | **exit 0, 0 errors** |
| 프로덕션 빌드 | `npx next build` | **✓ Compiled successfully, exit 0** (`/` 147 kB First Load JS, API 3개 Dynamic) |
| 린트 | `npx next lint` | **ESLint 미설정** — 대화형 설정 프롬프트가 뜨고 종료됨 (`.eslintrc` 없음) |
| 브라우저 콘솔 | 전 탭 조작 중 | **에러 0건** |

---

## 2. 기능별 실제 동작 검증 결과

### 2-1. 차량 설정 (관리자 콘솔 → 🚗 차량 30대 · 계기판 실사)

| 시나리오 | 결과 | 증거 |
|---|---|---|
| PIN `4400` 입력 → 관리자 콘솔 진입 | ✅ PASS | 키패드/직접입력 모두 동작 |
| 30대 차량 목록·검색·CSV 업로드 버튼 렌더 | ✅ PASS | 1440px 뷰포트 스크린샷 |
| #2호차 MAC 수정(`AA:BB:CC:DD:EE:02`) → 화면 반영 | ✅ PASS (UI) | 화면에 새 MAC 표시 |
| **MAC 수정 후 백엔드 DB 반영** | ❌ **FAIL** | `GET /api/fleet/state` → `mac A4:C1:38:7F:02:06` (원래 값), `lastUpdatedAt` 변동 없음 |
| **배차 잠금 토글 후 백엔드 DB 반영** | ❌ **FAIL** | `isLockedByAdmin: undefined` |
| 좁은 뷰포트(~800px)에서 관리자 콘솔 레이아웃 | ⚠️ 깨짐 | 좌측 칼럼이 글자 단위로 줄바꿈, 탭 하이라이트가 "2. 관제"에 남음 |

**원인:** [page.tsx:231-271](../src/app/page.tsx#L231) 자동 저장 `useEffect`의 의존성 배열에 `vehicles`가 빠져 있다. `patch` 본문에는 `vehicles`가 포함되지만 effect 자체가 트리거되지 않아, 차량만 바뀌는 조작(MAC 수정, 잠금, 계기판 실사 중 유령주행 미발생 케이스)은 **다른 상태가 바뀔 때까지 저장되지 않고, 새로고침 시 유실**된다. (2.5초 텔레메트리 진동 때문에 의도적으로 뺀 것으로 보이나, 결과적으로 관리자 설정 저장을 막는다.)

### 2-2. 휴대폰 동기화 (임직원 모바일 앱 → 휴대폰 센서 연결 / 블루투스 연결)

| 시나리오 | 결과 | 증거 |
|---|---|---|
| "휴대폰 센서 연결" 클릭 (데스크톱, 센서 없음) | ⚠️ **거짓 양성** | 센서가 없는 PC에서도 `GPS · 6축 센서 연결됨` 표시 |
| 375px 모바일 뷰포트 렌더 | ✅ PASS | 가로 스크롤 없음(`scrollW 375 == innerW 375`) |
| 서버 텔레메트리 API 판정 (충돌/낙하/무단운행) | ✅ PASS | `CONFIRMED_CRASH` / `FILTERED_PHONE_DROP` / `TRIGGER_BILATERAL_RED_ALERT` 각각 정확 |
| **정상 주행 중 위치·속도 서버 전송** | ❌ **없음** | [EmployeePhoneSimulator.tsx:100-118](../src/components/EmployeePhoneSimulator.tsx#L100): `gForce > 2.5`일 때만 `/api/fleet/telemetry` 호출. 평시 하트비트·위치 동기화 경로가 존재하지 않음 |
| 폰에서 보낸 데이터가 관제 화면에 반영 | ❌ **없음** | 관제 화면 차량 위치는 [page.tsx:301-323](../src/app/page.tsx#L301) 난수 진동. 다른 브라우저(폰)가 쓴 DB를 다시 읽는 폴링/구독 코드 없음 (마운트 시 1회 hydrate만) |

**원인:** [realDeviceSensors.ts](../src/utils/realDeviceSensors.ts) `startRealDeviceSensors`는 `requestPermission` 결과(`denied`)와 `watchPosition` 오류 콜백을 모두 무시하고, 호출 측은 무조건 `setRealSensorActive(true)`로 표시한다. 또한 Web Bluetooth는 iOS Safari에서 지원되지 않아, PWA 전제(iOS/Android BYOD)와 충돌한다.

### 2-3. 법인 차량 신청 / 승인 / 운행 / 반납

| 시나리오 | 결과 | 증거 (`GET /api/fleet/state`) |
|---|---|---|
| 신청 (한소희 · #2호차 · HMMA) | ✅ PASS | `res-1792856301127 REQUESTED`, 승인대기 2→3 |
| 관리자 승인 → 운행 시작 | ✅ PASS | `IN_USE`, `veh-2 AUTHORIZED emp-06` |
| 반납 (Lot A #02) | ✅ PASS | `RETURNED`, `veh-2 IDLE`, 운행기록부 3→4건 |
| 관리자 부재 자동승인 토글 | ✅ PASS (코드 확인) | `autoApproveWhenManagerAway` → `APPROVED`로 생성 |
| **동일 차량 중복 신청 차단** | ❌ **없음** | #2호차에 `res-101 REQUESTED`가 남아 있는 상태에서 같은 차량·같은 직원 신청이 추가 생성됨. 운행중 차량에도 신청 가능 |
| **운행거리 실측** | ❌ **고정값** | [page.tsx:583](../src/app/page.tsx#L583) `drivenKm = 22.8` 하드코딩 → 모든 반납이 +22.8km |
| **운행기록부 날짜** | ❌ **고정값** | [page.tsx:630](../src/app/page.tsx#L630) `date: '2026-10-20'` 하드코딩 (점검일 10-24에도 10-20으로 기록) |
| 시각 저장 형식 | ⚠️ | `startedAt: "10:39:00"` — 날짜·타임존 없는 `HH:MM:SS` 문자열. Supabase 스키마는 `timestamptz`라 그대로 이관 불가 |
| 승인자 식별 | ⚠️ | `approvedBy: '차량총괄관리자 (Fleet Admin)'` 고정 문자열. 로그인/세션 개념이 없어 누가 승인했는지 기록 불가 |

### 2-4. 전체 차량 모니터링 (2. 30대 실시간 관제)

| 시나리오 | 결과 |
|---|---|
| KPI(무단 1 / 출격 1 / 정식 4 / 대기 24), 지도, 차량 상세 패널 렌더 | ✅ PASS |
| 상태 필터·차량 선택·사고 재구성 탭 | ✅ PASS (코드·UI 확인) |
| **표시되는 속도·좌표의 출처** | ❌ 난수 | `LIVE` 토글 시 2.5초마다 `Math.random()`으로 속도/좌표 진동. 실제 폰 데이터 아님 |
| 다른 사용자가 만든 변경 실시간 반영 | ❌ 없음 | 새로고침해야 보임 |

---

## 3. API 보안·무결성 검증 (curl)

| 요청 | 기대 | 실제 |
|---|---|---|
| `POST /api/fleet/telemetry` `{"foo":"bar"}` | 400 | **200 accepted:true** (`hqDistanceMeters: null`) — 입력 검증 없음 |
| `POST /api/fleet/state` `{"patch":{"vehicles":"NOT_AN_ARRAY"}}` | 400 | **200 ok:true** → DB에 `vehicles:"NOT_AN_ARRAY"` 저장, `/api/health` 차량 수 **12**(문자열 길이)로 표시. **DB 파손됨** |
| `POST /api/fleet/state` `{"action":"RESET_SEED"}` 인증 없이 | 401 | **200** — 누구나 전체 DB 초기화 가능 |
| 관리자 PIN | 서버 검증 | **클라이언트 하드코딩** `'4400'` ([page.tsx:122](../src/app/page.tsx#L122)), 번들 JS에 평문 노출. API는 PIN과 무관하게 열려 있음 |

---

## 4. 결함 목록 (심각도순)

| # | 심각도 | 결함 | 위치 |
|---|---|---|---|
| D1 | **CRITICAL** | 관리자 차량 설정(MAC/BLE·잠금·실사)이 DB에 저장되지 않음 — `vehicles` 의존성 누락 | `page.tsx:262-271` |
| D2 | **CRITICAL** | `/api/fleet/state` POST가 무인증·무검증으로 전체 DB 덮어쓰기/초기화 허용 | `api/fleet/state/route.ts` |
| D3 | **HIGH** | 클라이언트가 전체 상태를 통째로 POST(last-write-wins). 관리자 PC와 직원 폰이 동시에 쓰면 서로 덮어씀 | `page.tsx:231-271` |
| D4 | **HIGH** | Vercel 배포 시 `/tmp` 사용 → 콜드스타트·인스턴스마다 DB가 시드로 되돌아감. Supabase 스키마는 있으나 **클라이언트 코드 0줄** | `fleetDatabase.ts:49-51` |
| D5 | **HIGH** | 폰 → 서버 평시 동기화 경로 없음(충격 2.5G 초과 시만 전송). 관제 화면은 난수 | `EmployeePhoneSimulator.tsx:100`, `page.tsx:301` |
| D6 | MEDIUM | 동일 차량 중복/운행중 신청 허용 | `page.tsx:362` |
| D7 | MEDIUM | 반납 거리 22.8km, 운행일지 날짜 `2026-10-20` 하드코딩 | `page.tsx:583, 630` |
| D8 | MEDIUM | 센서 권한 거부/미지원에도 "연결됨" 표시 | `realDeviceSensors.ts:84-99`, `EmployeePhoneSimulator.tsx:121` |
| D9 | MEDIUM | 텔레메트리 API 입력 검증 없음 (NaN 좌표도 200) | `api/fleet/telemetry/route.ts` |
| D10 | LOW | 런타임 DB `data/fleet-db.json`이 git 추적 대상 → 앱을 켤 때마다 워킹트리가 더러워짐 | `.gitignore` |
| D11 | LOW | ESLint 미설정, 테스트 0건 | `package.json` |
| D12 | LOW | ~800px 이하 관리자 콘솔 레이아웃 붕괴 | `AdminManagementConsole.tsx` |
| D13 | LOW | `page.tsx` 2,567줄 단일 파일(규칙 800줄 초과), 핸들러 20+개 | `page.tsx` |

---

## 5. 개선 사항

### 5-1. 데이터 업데이트 (동기화 모델)

현재: "브라우저 한 대가 장부 전체를 들고 있다가 350ms마다 통째로 서버에 복사" 방식. 비유하면 **사무실 전 직원이 각자 엑셀 사본을 수정한 뒤 공유폴더에 덮어쓰는 것**과 같다.

| 단계 | 조치 |
|---|---|
| 즉시 | D1 수정 — `vehicles`를 의존성에 넣되, 텔레메트리 진동 필드(`speedKmh/lat/lng/currentGForce/cumulativeGpsKm`)는 저장 대상에서 제외하거나 진동을 별도 `liveOverlay` 상태로 분리 |
| 단기 | 전체 상태 POST → **엔티티별 액션 API**로 전환: `POST /api/reservations`(신청), `PATCH /api/reservations/:id/approve|start|return`, `PATCH /api/vehicles/:id`(MAC/잠금), `POST /api/vehicles/:id/odometer-audit` |
| 단기 | 서버에 `updatedAt`/버전 번호를 두고 **낙관적 잠금**(If-Match) 적용 → 동시 수정 충돌 시 409 반환 |
| 중기 | Supabase Realtime 구독 또는 최소 10초 폴링으로 **타 클라이언트 변경 수신** (현재 마운트 1회 hydrate뿐) |

### 5-2. 사용자 신청 절차

| 항목 | 현재 | 개선 |
|---|---|---|
| 신청자 식별 | 드롭다운에서 아무 직원이나 선택 | **로그인(Supabase Auth, 사번+PIN 또는 매직링크)** → 본인 명의로만 신청 |
| 차량 가용성 | 중복·운행중 차량 신청 허용 | 신청 시 `vehicleId`에 `REQUESTED/APPROVED/IN_USE` 건이 있으면 차단, 시간대 겹침 검사(`plannedTimeWindow`를 자유 텍스트 → `startAt/endAt timestamptz`로 변경) |
| 승인자 | 고정 문자열 | 승인자 계정 ID + 서버 타임스탬프 기록, 관리자 역할(RLS)만 승인 가능 |
| 운행거리 | 22.8km 고정 | 반납 시 계기판 사진/수치 입력 필수 또는 폰 GPS 누적값 사용, 둘 다 없으면 `null` + "미확인" 플래그 |
| 자동반납 | 버튼 시뮬레이션 | 폰 하트비트가 차고지 150m 이내 + 속도 0 + N분 유지 시 서버가 `RETURNED` 전이 |
| 알림 | 화면 내 push 스트림(`pushStream` 배열) | Web Push(VAPID) 또는 SMS/이메일로 실제 발송, 서버 측 `notifications` 테이블로 전환 |

### 5-3. 백엔드 데이터 구성

| 항목 | 현재 | 개선 |
|---|---|---|
| 저장소 | 단일 JSON 파일(30 KB, 전체 read→merge→write) | **Supabase PostgreSQL 실제 연동**. `001_fleetguard30_schema.sql`이 이미 있으므로 `@supabase/supabase-js` 서버 클라이언트(`SUPABASE_SERVICE_ROLE_KEY`)를 `fleetDatabase.ts`에 어댑터로 추가 |
| 스키마 누락 | `geofence_logs`, `ghost_trip_cases`, `policy_config`, `push_stream` 테이블 없음 | 마이그레이션 002로 추가. `ghost_trip_cases.suspect_employees`는 jsonb 또는 별도 테이블 |
| 시각 | `"HH:MM:SS"` 문자열, 날짜 없음 | 전부 ISO 8601 UTC `timestamptz`; 화면에서 `America/Chicago`로 포맷 |
| 비정규화 | 예약에 `plateNumber/modelName/employeeName/department` 복사 | 조회용이면 뷰(`v_reservations`)로, 저장은 FK만 |
| 텔레메트리 이력 | 차량 레코드에 최신값만 덮어씀 | `telemetry_points`(append-only, `vehicle_id, employee_id, ts, lat, lng, speed, g, gyro`) 추가 → 사고 전후 30초 trace를 실제 데이터로 재구성 가능 |
| 입력 검증 | 없음 | **zod 스키마**를 모든 route에 적용 (`TelemetryPayloadSchema`, `ReservationCreateSchema`), 실패 시 400 |
| 감사 추적 | 없음 | `audit_log(actor_id, action, entity, before, after, at)` — 정책 변경·승인·잠금은 필수 기록 |
| 시드 분리 | 시드가 코드에 672줄 + git 추적 JSON | `data/fleet-db.json`을 `.gitignore`, 시드는 `supabase/seed.sql`로 |

### 5-4. 웹서버 구축

| 항목 | 현재 | 개선 |
|---|---|---|
| 인증 | 클라이언트 PIN `4400`, API 무인증 | Supabase Auth + Next.js middleware로 `/api/*` 보호. 역할: `driver` / `fleet_admin`. PIN은 폐기하거나 서버 측 2차 확인으로만 |
| 상태 저장 | Vercel `/tmp` (휘발) | Supabase 연동 완료 전까지는 **Vercel 배포 금지** 또는 Vercel KV/Blob 임시 사용. 현 상태로 배포하면 재배포·콜드스타트마다 데이터 초기화 |
| 보안 헤더 | `vercel.json`에 4종 | `Content-Security-Policy`, `Strict-Transport-Security` 추가. `X-Frame-Options: DENY`는 PWA엔 적합 |
| 레이트 리밋 | 없음 | 텔레메트리 엔드포인트에 Upstash/Vercel 레이트 리밋 (폰 30대 × 1Hz 가정) |
| 헬스체크 | 레코드 수·HQ 좌표 등 내부 정보 노출 | 인증 없는 `/api/health`는 `status/version`만, 상세는 관리자 토큰 필요 |
| 품질 게이트 | lint 미설정, 테스트 0 | `eslint-config-next` 설정, 핵심 로직(센서 융합 판정, 예약 상태 전이, 중복 검사) Vitest 단위 테스트, GitHub Actions에 `tsc + lint + test + build` |
| 코드 구조 | `page.tsx` 2,567줄 | 핸들러를 `src/features/reservations/`, `src/features/admin/` 훅으로 분리, 상태는 `useReducer` 또는 Zustand |
| PWA | manifest만 존재 | 서비스워커 없음 → 오프라인 큐(텔레메트리 버퍼링 후 재전송) 추가. iOS는 Web Bluetooth 불가 → BLE 매칭은 "iOS: 수동 확인 / Android: 자동" 이중 경로 설계 |

---

## 6. 권고 우선순위

1. **이번 주:** D1(vehicles 영속), D2/D9(zod 검증 + 최소 API 키 인증), D7(하드코딩 제거), D10(`.gitignore`) — 모두 소규모 변경
2. **다음 스프린트:** Supabase 실제 연동(D4) + 엔티티별 API(D3) + 로그인(5-2)
3. **그 다음:** 폰 하트비트·Realtime(D5), 중복 신청 검사(D6), 테스트/CI(D11)

> 참고: D1·D2·D7·D10은 파일 2~3개 수정으로 끝나며 기존 UI를 바꾸지 않는다. 나머지는 아키텍처 변경이므로 `/plan`으로 설계 승인 후 진행을 권장한다.
