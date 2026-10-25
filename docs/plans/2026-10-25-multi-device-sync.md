# 다중 기기 동기화 설계 — 항목별 저장 API + 자동 새로고침

> 작성: 2026-10-25 · 상태: **설계안 (승인 전, 코드 변경 없음)** · 기준 커밋: `aef0cda`

## 0. 결론

**저장 방식을 "화면이 가진 장부 전체를 덮어쓰기"에서 "서버에 한 건씩 요청하고, 서버가 최신 장부에 적용"으로 바꾼다.** 각 화면은 15초마다(그리고 화면 복귀 시) 서버의 변경 여부만 가볍게 확인해 최신 상태를 받아온다.

비유: 지금은 직원마다 엑셀 사본을 고친 뒤 공유폴더에 통째로 덮어쓰는 구조다. 바꾼 뒤에는 모두가 창구 한 곳에 "#8 신청합니다" 같은 요청서를 내고, 창구 담당(서버)이 원본 장부에 순서대로 기록한다.

## 1. 현재 문제 (2026-10-25 로컬 재현)

| # | 문제 | 근거 |
|---|---|---|
| P1 | **기기 간 데이터 유실** | B 기기 #9 신청 → 서버 저장 확인 → 먼저 열려 있던 A 기기가 다른 신청 저장 → **#9 신청 소멸** |
| P2 | 다른 기기 변경이 안 보임 | 페이지 열 때 1회만 `GET /api/fleet/state`. 주기적 갱신 코드 없음 |
| P3 | 중복 차단이 화면 범위에서만 동작 | `dispatchRules`는 클라이언트 메모리 기준. 두 기기가 동시에 같은 차량 신청 시 서로 못 봄 |
| P4 | 승인·반려를 PIN 없이 누구나 가능 | 배차 목록·휴대폰 `즉시 승인` 버튼에 권한 검사 없음 |
| P5 | 시각이 기기 시계 기준 | `nowTimeStr()`가 브라우저 시각 사용 |

원인은 하나다: `page.tsx`의 자동 저장(`POST /api/fleet/state { patch: { reservations, vehicles, … } }`)이 **배열 전체를 교체**한다(`writeFleetDatabase`의 `{...current, ...nextState}`).

## 2. 목표 동작

1. 어떤 기기에서 한 행동도 다른 기기의 저장 결과를 지우지 않는다.
2. 같은 차량 동시 신청은 **서버에서** 1건만 성공하고 나머지는 "이미 배차 진행 중" 안내를 받는다.
3. 다른 기기의 변경이 **최대 15초 내**(화면 전환·복귀 시 즉시) 반영된다.
4. 승인·반려·차량/정책 변경 등 관리자 행동은 서버가 PIN을 검사한다.
5. 기록 시각은 서버가 Opelika 현지 시각(America/Chicago)으로 찍는다.

## 3. 설계

### 3-1. 단일 행동 API — `POST /api/fleet/actions`

```jsonc
// 요청
{ "type": "dispatch.request", "payload": { "employeeId": "emp-06", "vehicleId": "veh-8", ... } }
// 응답 (성공·차단 모두 200; 검증 실패 400, 권한 401, 저장소 장애 503)
{ "ok": false, "message": "#8호차는 이미 배차가 진행 중입니다 — …", "revision": 42, "data": { /* 최신 전체 상태 */ } }
```

- 경로 하나 + `type`별 zod 판별 유니온(discriminated union). 인증·동시성·로그를 한 곳에서 처리하려고 경로를 21개로 쪼개지 않는다.
- 응답에 **최신 전체 상태**(현재 약 30KB)를 돌려줘 요청한 화면은 즉시 최신화된다.
- 차단(중복·잠금·자격정지)은 `ok:false` + 안내 문구. 지금 화면에 붙인 빨간 안내를 그대로 재사용한다.

### 3-2. 행동 목록과 권한

| 구분 | type | 현재 핸들러 | 권한 |
|---|---|---|---|
| 배차 | `dispatch.request` | handleCreateRequest | 직원 |
| | `dispatch.approve` / `dispatch.reject` | handleApproveRequest / handleRejectRequest | **관리자 PIN** (결정 필요 ①) |
| | `dispatch.start` | handleStartUsingVehicle | 직원(본인 건) |
| | `dispatch.quickStart` | handleAuthorizedCheckout (1초 출발) | 직원 |
| | `dispatch.return` / `dispatch.autoReturn` | handleReturnVehicle / handleAutoReturnToGarage | 직원 |
| | `dispatch.lateReason` | handleLateReasonSubmit | 직원 |
| 차량 | `vehicle.import` (CSV·직접입력 공통) | handleApplyVehicleImport | 관리자 |
| | `vehicle.updatePairing` / `vehicle.toggleLock` / `vehicle.auditOdometer` | handleUpdateVehicleMac / handleToggleVehicleLock / handleAuditVehicleOdometer | 관리자 |
| 임직원 | `employee.add` / `employee.import` / `employee.toggleDispatch` / `employee.warn` | 동명 핸들러 | 관리자 |
| 사고·정책 | `incident.resolve` / `policy.update` | handleResolveIncident / setPolicyConfig | 관리자 |
| 데모 시뮬 | `demo.unauthorizedStart` / `demo.crash` / `demo.permissionToggle` | 센서·무단 테스트 탭 | **데모 모드에서만** 허용 |
| 운영 | `admin.clearDemo` / `admin.resetDemo` | 기존 `CLEAR_DEMO` / `RESET_SEED` | 관리자 (현행 유지) |

텔레메트리(`POST /api/fleet/telemetry`)도 같은 저장 경로(3-4)를 쓰도록 바꾼다.

### 3-3. 업무 규칙을 서버로 이동 (`src/domain/`)

- `page.tsx` 핸들러 21개의 로직을 **순수 함수**로 옮긴다: `apply(db, payload, ctx) → { db, result }`. `ctx = { now, actorIsAdmin }`.
- 파일: `domain/dispatch.ts`, `domain/vehicles.ts`, `domain/employees.ts`, `domain/incidents.ts`, `domain/demo.ts`, `domain/clock.ts`.
- 기존 `utils/dispatchRules.ts`, `utils/vehicleImport.ts`, `lib/vehicleMaster.ts`는 그대로 재사용한다.
- 클라이언트는 규칙을 계산하지 않고 결과만 표시한다. 규칙이 한 곳에만 있어 화면과 서버의 판단이 어긋나지 않는다.
- `page.tsx`는 약 2,780줄에서 1,900줄 안팎으로 줄어들 것으로 예상한다(핸들러 본문 제거).
- 시각: `domain/clock.ts`에서 `Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago' })`로 `HH:MM:SS`·`YYYY-MM-DD`를 만든다(Vercel 서버는 UTC).

### 3-4. 동시성 — 낙관적 잠금 + 재시도

```
1. 읽기: Blob get(useCache:false) → 본문 + ETag
2. 적용: domain.apply(최신 db, payload)          ← 중복 검사가 서버 최신 상태 기준
3. 쓰기: Blob put(ifMatch: ETag) + revision += 1
4. 다른 요청이 먼저 썼으면 BlobPreconditionFailedError → 1부터 다시 (최대 3회, 50~200ms 지터)
5. 3회 모두 실패 → 503 "잠시 후 다시 시도" (아무것도 저장 안 됨)
```

- DB에 `revision` 정수 필드를 추가한다(쓰기마다 +1).
- 로컬 파일 저장소(개발·사내 서버)는 ETag가 없으므로 **프로세스 내 뮤텍스** + revision 비교로 같은 효과를 낸다.
- 2단계에서 다시 계산하므로, 동시에 들어온 #8 신청 2건 중 늦은 쪽은 재시도 때 앞선 건을 보고 차단된다(P3 해결).

### 3-5. 자동 새로고침 — `useFleetSync` 훅

- `GET /api/fleet/state?rev=42` → 변경 없으면 **204 No Content**, 있으면 전체 상태 + 새 revision.
- 주기: **화면이 보일 때 15초**. 숨겨지면(`visibilitychange`) 멈추고, 다시 보이거나 창이 포커스되면 즉시 1회.
- 행동 직후에는 응답에 최신 상태가 오므로 따로 조회하지 않는다.
- 상단 칩: `DB 동기화 · 5초 전`. 연속 실패 시 빨간 "연결 끊김 · 다시 시도".
- 자동 저장 `useEffect`(전체 배열 POST)는 **삭제**한다. `POST /api/fleet/state`의 `patch` 경로는 마지막 단계에서 제거한다(GET·관리자 액션만 남김).
- 데모 모의 주행(2.5초 진동)은 지금처럼 화면 전용으로 두고, 동기화 받은 값 위에 덮어 그리기만 한다.

### 3-6. 버튼 동작

- 누르면 즉시 비활성화 + 스피너 → 응답 후 결과 안내(초록/빨강). 서버 왕복은 보통 0.2~0.5초.
- 낙관적 미리 반영(먼저 화면을 바꾸고 나중에 되돌리기)은 하지 않는다. 차단이 자주 일어나는 도메인이라 되돌림이 더 혼란스럽다.

## 4. 비용·한도 (배포 전 확인 필요)

- 폴링 1회 = 서버에서 Blob 읽기 최대 1회. 각 서버 인스턴스에 **3초 메모리 캐시**와 `ifNoneMatch`(변경 없으면 본문 없이 304)를 둬서 줄인다.
- 추정: 화면 10대 × 15초 간격 × 하루 8시간 화면 켜짐 ≈ 하루 19,200회 확인, 월 약 40만~60만 회(캐시 적중에 따라 감소).
- Vercel 문서 색인에서 Blob 무료 한도 수치를 찾지 못했다. **구현 전에 Vercel 대시보드 → Usage → Blob에서 현재 플랜의 월간 작업 한도를 확인**하고, 부족하면 간격을 30초로 늘리거나 revision만 Edge Config에 두는 방안을 검토한다.

## 5. 단계별 작업과 검증

각 단계는 테스트 → 로컬 브라우저 검증 → 커밋 순서로 진행한다. 운영 배포는 P5 완료 후 한 번에 한다(중간 상태가 섞이지 않도록).

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **P0** | 테스트 러너 도입(vitest, 7일 경과 버전) — 스크래치 테스트 22개를 `src/**/*.test.ts`로 이관 | `npm test` 22개 통과 |
| **P1** | 저장소: `revision`, Blob `ifMatch` + 재시도, 파일 뮤텍스 | 병렬 쓰기 20건 시뮬레이션에서 유실 0건 |
| **P2** | `domain/dispatch.ts` + `domain/clock.ts` (배차 7개 행동) | 행동별 단위 테스트, 서버 시각 Chicago 확인 |
| **P3** | `POST /api/fleet/actions` (배차 7개) + zod + 권한 | API 테스트: 승인 PIN 401, 동시 신청 2건 중 1건만 성공 |
| **P4** | 클라이언트: 배차 버튼을 API 호출로 교체, `useFleetSync` 폴링, 배차 자동저장 제거 | **두 탭 재현 테스트 통과**(#9 유지), 15초 내 반영 |
| **P5** | 관리자·임직원·사고·정책·데모 행동 이관, `patch` 경로 제거, 텔레메트리 경로 통합 | 전체 기능 회귀(앞서 검증한 CSV·폼·QR·실운영 전환) 재통과, 빌드 |
| **P6** | 운영 배포 + 운영 스모크(health, 두 기기 신청, 폴링 응답 204) | 배포 READY, 운영에서 두 기기 테스트 통과 |

예상 규모: 신규 약 10개 파일, 수정 약 8개 파일. P0~P5 작업량은 지금까지의 개별 기능 3~4개 분량이다.

## 6. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 핸들러 이관 중 동작 차이 | 이관 전 핸들러별 현재 결과를 테스트로 고정(특성 테스트)한 뒤 옮긴다 |
| 단일 JSON 문서라 쓰기가 몰리면 재시도 증가 | 30대·수십 명 규모에선 충분. 초당 수십 건이 되면 테이블형 DB(Postgres)로 전환 — 지금 범위 아님 |
| 직원 신원은 여전히 드롭다운 선택(로그인 없음) | 이번 범위 아님. 본인 건 판단은 선택된 직원 기준임을 명시 |
| 운영에 미리 들어가 있는 데모 중복(#2 2건) | 승인 단계 서버 검사로 걸러짐. 실운영 전환 시 정리 |

## 7. 결정이 필요한 사항

1. **승인·반려에 관리자 PIN을 요구할까?** (권장: 예. 휴대폰 `즉시 승인` 버튼은 데모 모드에서만 표시)
2. **폴링 간격**: 15초(권장) / 30초(비용 절감)
3. **테스트 러너(vitest) 도입** 동의 여부 (권장: 예 — 이관 중 회귀 방지에 필요)
4. **배포 방식**: P5 완료 후 일괄 배포(권장) / 단계별 배포
