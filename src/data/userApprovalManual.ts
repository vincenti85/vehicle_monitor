// Comprehensive User Request & Manager Approval Manual for FleetGuard 30 (Opelika, AL)

export const USER_APPROVAL_MANUAL_MARKDOWN = `# FleetGuard 30 법인차량 신청 · 승인 · 사용 · 반납 통합 운영 매뉴얼

- **적용 사업장:** 4400 Northpark Dr, Opelika, AL 36801 (Lee County, Alabama, USA)
- **관리 대상:** 법인차량 30대 (AL 41A-2237 ~ AL 41F-6210)
- **시스템 특성:** 차량 내 블랙박스 0대 · OBD 단말기 0대 · 100% 임직원 스마트폰(BYOD) 6축 센서 및 순정 블루투스 기반
- **관리자 콘솔 보안 인증:** 4자리 보안 PIN (총무팀/차량관리자 전용 비공개 코드)

---

## 제1장. 사용자(임직원/운전자) 차량 신청 · 사용 · 반납 매뉴얼

### 1. 사전 준비 (최초 1회)
1. 스마트폰(iPhone Safari 또는 Android Chrome)으로 사내 배포 URL에 접속합니다.
2. **[홈 화면에 추가(Add to Home Screen)]**를 눌러 앱 아이콘(\`FleetGuard 30\`)을 설치합니다.
3. **[실제 휴대폰 센서 연동 시작]** 버튼을 눌러 필수 권한 3가지를 허용합니다:
   - **위치(GPS) 권한:** \`항상 허용\` (운행 중 경로 및 속도 측정용)
   - **블루투스(근처 기기) 권한:** \`허용\` (차량 순정 핸즈프리 MAC 및 키보관함 3m 비콘 인식용)
   - **모션 및 방향(6축 가속도/자이로) 센서:** \`허용\` (차량 내 블랙박스를 대체하여 2.5G 이상 충격 시 사고 자동 재구성용)
   > ⚠️ **주의:** 본사 차고지(4400 Northpark Dr 반경 150m) 내에서 블루투스나 GPS 권한을 임의로 끌 경우, 관리자에게 **[권한 회피 경고]**가 즉시 발송되며 배차 신청 자격이 정지될 수 있습니다.

---

### 2. 정식 배차 4단계 프로세스 (\`신청 → 승인 → 사용 → 반납\`)

#### [1단계] 차량 배차 신청 (\`REQUESTED\`)
1. 스마트폰 앱의 **[정식 배차 (신청·사용·반납)]** 탭을 엽니다.
2. **신청자(본인)**와 **차고지 대기 중인 차량(IDLE)**을 선택합니다. (관리자가 잠금 처리한 차량은 선택 불가)
3. **운행 목적**(고객사 방문, Auburn 연구소 미팅, 자재/부품 수령, 공항 픽업 등), **행선지**(예: \`Auburn Technology Park, AL\`), **사용 예정 시간대**를 입력합니다.
4. **[1단계: 차량 사용 신청하기]** 버튼을 누르면 관리자에게 실시간 승인 요청 푸시가 전송됩니다.

#### [2단계] 관리자 승인 확인 (\`APPROVED\`)
1. 관리자가 신청 내역을 검토 후 **[승인]**하면 운전자 스마트폰으로 \`✅ [배차 승인 완료]\` 푸시 알림이 도착합니다.
2. 만약 관리자가 외근·부재 중이어서 **[관리자 부재 시 자동 승인 모드]**를 켜둔 경우, 신청 즉시 자동으로 \`APPROVED\` 상태로 전환됩니다.

#### [3단계] 자동차키 수령 및 운행 개시 (\`IN_USE\`)
1. 승인 완료 카드를 확인한 후 \`4400 Northpark Dr\` 본사 총무팀 **키 보관함(반경 3m)**에서 해당 호차의 자동차키를 수령합니다.
2. 스마트폰 앱에서 **[🔑 키 수령 및 사용(운행) 시작]** 버튼을 누르고 차량 시동을 걸면 차량 순정 블루투스(\`MAC\`)가 자동 매칭되며 정상 운행(\`AUTHORIZED\`) 상태로 전환됩니다.

#### [4단계] 차량 및 자동차키 반납 (\`RETURNED\`)
1. 외근 복귀 후 본사 지정 주차구역(\`Northpark Lot A #01~#30\`)에 주차하고 시동을 끕니다.
2. **수동 반납:** 스마트폰 앱에서 주차 구역 입력 및 **[키보관함 반납 완료]** 체크 후 **[🅿️ 차량 및 자동차키 반납 완료]** 버튼을 누릅니다.
3. **무조작 자동 반납:** 바쁜 업무로 앱 반납 버튼을 누르지 못하더라도, 차량이 \`4400 Northpark Dr\` 차고지 지오펜스(150m) 내부로 진입하고 차량 블루투스 연결이 끊어지면(시동 OFF) 시스템이 자동으로 반납 처리하고 **세무용 법인차량 운행기록부**를 생성합니다.

---

### 3. 긴급 외근 시 『1초 원터치 자율 반출』 및 『선출발 후보고』 안내
- 키 관리자가 자리에 없을 때 긴급히 나가야 하는 경우, 앱에서 **[1초 원터치 자율 반출]** 버튼을 누르고 나가면 정상 운행으로 인정됩니다.
- 만약 앱 조작조차 잊고 키를 가지고 출발하더라도, 시속 \`15km/h\` 이상 주행 시 휴대폰으로 **⚠️ [미승인 운행 경고 알림]**이 울립니다. 이때 알림창에서 **[사후 사유 입력(선출발 후보고)]** 버튼을 눌러 목적을 선택하면 무단 반출 해명 이력으로 전환됩니다.

---

## 제2장. 관리자(Fleet Admin) 승인 · 관제 · CSV 등록 매뉴얼

### 1. 관리자 화면 접속 (보안 PIN 인증)
1. 상단 우측의 **[솔루션 관리자 화면 (Admin Console)]** 버튼을 클릭합니다.
2. 보안 키패드 모달이 나타나면 관리자에게 부여된 **4자리 전용 보안 PIN 번호(\`••••\`)**를 입력해 잠금을 해제합니다.
3. 자리를 비울 때는 관리자 콘솔 우측 상단의 **[🔒 관리자 화면 잠금]** 버튼을 눌러 다시 보호할 수 있습니다.

### 2. 배차 신청 승인 및 반려 처리
1. **[실시간 통합 관제 & 배차]** 화면의 **[📋 차량 신청·승인·사용·반납 (4단계)]** 탭에서 \`1. 승인 대기 (REQUESTED)\` 목록을 확인합니다.
2. 신청자, 행선지, 운행 목적, 시간대를 확인한 후 **[승인 (Approve)]** 또는 **[반려 (Reject)]** 버튼을 클릭합니다.
3. 처리 결과는 즉시 백엔드 데이터베이스에 영구 저장되며 신청자 휴대폰으로 푸시 통보됩니다.

### 3. 사용자(임직원) 및 차량 정보 CSV 일괄 입력 방법
1. 관리자 화면(보안 PIN 인증)으로 진입합니다.
2. **차량 30대 CSV 일괄 입력 (\`🚗 차량 30대 · 계기판 실사\` 탭):**
   - **[📥 차량 CSV 양식 다운로드]** 버튼을 눌러 샘플 양식(\`fleetNumber,plateNumber,modelName,btMacAddress,bleBeaconUuid,cumulativeGpsKm,parkingZone\`)을 내려받습니다.
   - 엑셀이나 메모장에서 차량 정보를 수정/추가한 뒤 **[📤 차량 CSV 업로드]** 버튼으로 파일을 선택하면 기존 호차 업데이트 및 신규 차량 추가가 일괄 반영됩니다.
3. **사용자(임직원) CSV 일괄 입력 (\`👥 임직원 자격 · 권한 통제\` 탭):**
   - **[📥 사용자 CSV 양식 다운로드]** 버튼을 눌러 샘플 양식(\`name,role,department,phone,dispatchAllowed\`)을 내려받습니다.
   - 임직원 명단을 작성한 뒤 **[📤 사용자 CSV 업로드]** 버튼으로 업로드하면 즉시 전체 임직원 DB에 반영됩니다.

### 4. 무블랙박스 사고 재구성 판정 및 유령 주행(Ghost Trip) 감사
1. **무블랙박스 사고 판정:** 차량에 블랙박스가 없으므로 스마트폰 6축 IMU 센서(가속도 G-Force + 자이로 회전각 \`°/s\` + 30초 속도 변화 \`Δv\`) 리포트를 검토하여 조치 내역을 입력하고 필요 시 과실 운전자의 배차 자격을 즉시 정지합니다.
2. **실제 계기판 실사 대조:** 주 1회 차량 점검 시 실제 계기판 주행거리(km)를 입력해 **[실사 대조]**를 누르면, 앱 누적 주행거리와 \`+5km\` 이상 차이 날 경우 해당 시간대 차고지 출입자 및 권한 OFF 직원을 교차 분석하여 **유령 주행 용의자**를 자동 특정합니다.
`;

export function downloadManualAsMarkdown() {
  const blob = new Blob([USER_APPROVAL_MANUAL_MARKDOWN], {
    type: 'text/markdown;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FleetGuard30_사용자신청_관리자승인_매뉴얼_Opelika_AL.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadManualAsHtml() {
  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>FleetGuard 30 사용자 신청 · 관리자 승인 매뉴얼 (4400 Northpark Dr, Opelika, AL)</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif;
      background: #0B0D10;
      color: #F4F6F8;
      line-height: 1.65;
      max-width: 920px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    .header-box {
      background: #131720;
      border: 1px solid rgba(62, 106, 225, 0.4);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 28px;
    }
    .badge {
      display: inline-block;
      background: rgba(232, 33, 39, 0.2);
      color: #FF8080;
      border: 1px solid rgba(232, 33, 39, 0.4);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    h1 { color: #FFFFFF; font-size: 24px; margin: 12px 0 8px; }
    h2 {
      color: #7EA0FF;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      padding-bottom: 8px;
      margin-top: 32px;
      font-size: 19px;
    }
    h3 { color: #32D583; font-size: 15px; margin-top: 20px; }
    .card {
      background: #131720;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 16px;
    }
    code {
      background: #191E2A;
      color: #FDB022;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid rgba(255,255,255,0.12);
      padding: 10px 12px;
      text-align: left;
    }
    th { background: #191E2A; color: #9BC1FF; }
    @media print {
      body { background: #FFFFFF; color: #111111; }
      .header-box, .card { background: #F9FAFB; border-color: #D1D5DB; }
      h1, h2, h3 { color: #111111; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <span class="badge">FLEETGUARD 30 · OPELIKA AL</span>
    <span class="badge" style="background:rgba(18,183,106,0.2);color:#32D583;border-color:rgba(18,183,106,0.4);">차량 내 블랙박스 0대 · 스마트폰 센서 기반</span>
    <h1>법인차량 30대 사용자 신청 · 관리자 승인 · CSV 운영 매뉴얼</h1>
    <p style="color:#9BA3B0;font-size:13px;margin:0;">
      본사 주소: 4400 Northpark Dr, Opelika, AL 36801 (Lee County AL 41 번호판) | 관리자 콘솔 보안 PIN: <code>•••• (비공개)</code>
    </p>
  </div>

  <h2>1. 사용자(임직원) 차량 배차 신청 · 사용 · 반납 4단계 절차</h2>
  <table>
    <thead>
      <tr>
        <th>단계</th>
        <th>상태 코드</th>
        <th>사용자(운전자) 행동 요령</th>
        <th>관리자 / 시스템 자동 처리</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1단계: 신청</strong></td>
        <td><code>REQUESTED</code></td>
        <td>앱에서 본인 이름, 대기 차량, 운행 목적, 행선지(예: Auburn, Montgomery), 사용 시간 입력 후 신청</td>
        <td>관리자 화면에 실시간 승인 대기 알림 표시 (부재 시 자동 승인 모드 가능)</td>
      </tr>
      <tr>
        <td><strong>2단계: 승인</strong></td>
        <td><code>APPROVED</code></td>
        <td>스마트폰으로 <code>배차 승인 완료</code> 푸시 수신 후 총무팀 키보관함(3m) 이동</td>
        <td>관리자 원클릭 <strong>[승인]</strong> 또는 <strong>[반려]</strong></td>
      </tr>
      <tr>
        <td><strong>3단계: 사용</strong></td>
        <td><code>IN_USE</code></td>
        <td>키 수령 후 앱에서 <strong>[키 수령 및 사용 시작]</strong> 클릭 및 시동 (차량 블루투스 자동 매칭)</td>
        <td>관제 지도에서 파란색(정상 배차 운행)으로 실시간 추적 및 6축 IMU 사고 감지 가동</td>
      </tr>
      <tr>
        <td><strong>4단계: 반납</strong></td>
        <td><code>RETURNED</code></td>
        <td>복귀 후 주차구역(Northpark Lot A/B) 및 키보관함 반납 체크 (또는 차고지 복귀 시 무조작 자동 반납)</td>
        <td>차량 상태 <code>IDLE</code> 복귀 + 국세청/IRS 세무용 운행기록부 자동 생성</td>
      </tr>
    </tbody>
  </table>

  <h2>2. 관리자(Fleet Admin) 보안 접속 및 승인 매뉴얼</h2>
  <div class="card">
    <h3>① 관리자 콘솔 보안 PIN 잠금 해제</h3>
    <p>상단 <strong>[솔루션 관리자 화면 (Admin Console)]</strong> 클릭 시 보안 모달이 표시됩니다. 관리자에게 부여된 전용 <strong>4자리 보안 PIN(<code>••••</code>)</strong>을 입력하면 잠금이 해제됩니다.</p>
    <h3>② 사용자(임직원) 및 차량 30대 CSV 일괄 등록</h3>
    <p>관리자 화면의 <strong>[차량 30대 · 계기판 실사]</strong> 탭과 <strong>[임직원 자격 · 권한 통제]</strong> 탭에서 각각 <strong>[CSV 양식 다운로드]</strong>를 받아 엑셀로 편집한 후 <strong>[CSV 업로드]</strong>를 수행하면 즉시 서버 DB에 일괄 반영됩니다.</p>
    <h3>③ 무블랙박스 스마트폰 6축 센서 사고 판정 및 유령 주행 실사</h3>
    <p>차량 내 블랙박스가 없으므로 스마트폰 가속도(G-Force) + 자이로 회전각(°/s) + 30초 감속 데이터를 기반으로 재구성된 사고 리포트를 검토하고, 정기 계기판 실사 대조(+5km 이상 오차)로 유령 주행 용의자를 특정합니다.</p>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], {
    type: 'text/html;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FleetGuard30_사용자신청_관리자승인_매뉴얼_인쇄용_Opelika_AL.html`;
  a.click();
  URL.revokeObjectURL(url);
}
