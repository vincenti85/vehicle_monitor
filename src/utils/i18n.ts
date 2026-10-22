import { TripPurpose } from '@/types/fleet';

export type AppLang = 'KOR' | 'ENG';

/**
 * Extracts English name if formatted as "박성훈 대리 (Dave Park)", or returns original
 */
export function formatEmpName(rawName: string, lang: AppLang): string {
  if (!rawName) return lang === 'ENG' ? 'Unassigned' : '미탑승';
  if (lang === 'KOR') {
    return rawName.split(' (')[0];
  }
  const match = rawName.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1];
  }
  return rawName;
}

/**
 * Extracts English department if formatted as "영업1팀 (Sales 1)", or translates common terms
 */
export function formatDeptName(rawDept: string, lang: AppLang): string {
  if (!rawDept) return '';
  if (lang === 'KOR') {
    return rawDept.split(' (')[0];
  }
  const match = rawDept.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1];
  }
  const map: Record<string, string> = {
    영업1팀: 'Sales 1',
    영업2팀: 'Sales 2',
    품질보증팀: 'Quality Assurance',
    생산기술팀: 'Production Eng',
    물류구매팀: 'Logistics & Purchasing',
    경영지원팀: 'Admin & HR',
    연구개발팀: 'R&D Center',
  };
  return map[rawDept] || rawDept;
}

/**
 * Formats TripPurpose into English when lang === 'ENG'
 */
export function formatTripPurpose(purpose: TripPurpose | string | null, lang: AppLang): string {
  if (!purpose) return lang === 'ENG' ? 'General Business' : '일반업무/외근';
  if (lang === 'KOR') return purpose;
  const map: Record<string, string> = {
    거래처방문: 'Client Visit',
    '일반업무/외근': 'Field Business',
    '긴급출동/현장지원': 'Urgent Field Support',
    '출퇴근(승인)': 'Approved Commute',
    미등록운행: 'Unregistered Trip',
  };
  return map[purpose] || purpose;
}

/**
 * Formats parkingZone or status text for English display
 */
export function formatParkingZone(zone: string, lang: AppLang): string {
  if (!zone || lang === 'KOR') return zone;
  return zone
    .replace('자동반납 완료', 'Auto-Returned')
    .replace('반납완료', 'Returned')
    .replace('무단 반출 운행중', 'Unauthorized Driving')
    .replace('정식 배차 운행중', 'Authorized Driving')
    .replace('무블랙박스 스마트폰', 'Smartphone 6-Axis IMU')
    .replace('충격 감지 후 비상정차 중', 'Impact Detected · Emergency Stop')
    .replace('호차', '');
}
