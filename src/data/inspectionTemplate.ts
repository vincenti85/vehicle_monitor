// Default pre/post-trip checklist (8 items). Admins can replace it through policy.update.
import { InspectionTemplateItem } from '@/types/fleet';

export const DEFAULT_INSPECTION_TEMPLATE: readonly InspectionTemplateItem[] = Object.freeze([
  { id: 'tires', label: '타이어', critical: true },
  { id: 'lights', label: '등화류', critical: false },
  { id: 'glass-wipers', label: '유리·와이퍼', critical: false },
  { id: 'body-damage', label: '외관 손상', critical: false },
  { id: 'fuel', label: '연료 1/4 이상', critical: false },
  { id: 'warning-lights', label: '계기판 경고등', critical: true },
  { id: 'brakes', label: '브레이크 감', critical: true },
  { id: 'interior', label: '실내 상태', critical: false },
]);
