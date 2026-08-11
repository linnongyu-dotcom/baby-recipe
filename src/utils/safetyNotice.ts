import type { AgeGroup, GrowthStage } from '../types';

export const SAFETY_NOTICE_STORAGE_PREFIX = 'baby-recipe:safety-notice-read';

/** 使用项目现有分龄结果生成稳定标识，确保同一宝宝进入新阶段时重新告知。 */
export function getSafetyNoticeKey(
  babyId: string,
  ageGroup: AgeGroup | null,
  growthStage: GrowthStage,
): string {
  const stage = ageGroup ?? growthStage;
  return `${SAFETY_NOTICE_STORAGE_PREFIX}:${babyId}:${stage}`;
}

export function hasReadSafetyNotice(storage: Pick<Storage, 'getItem'>, key: string): boolean {
  return storage.getItem(key) === 'true';
}

export function markSafetyNoticeRead(storage: Pick<Storage, 'setItem'>, key: string): void {
  storage.setItem(key, 'true');
}
