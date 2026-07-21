import { AgeGroup, GrowthStage, BabyProfile, BabyAgeInfo } from '../types';

/**
 * 根据出生日期计算精确年龄
 */
export function calcAge(birthDate: string): BabyAgeInfo {
  const birth = new Date(birthDate);
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    // 获取上个月的最后一天
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;
  const totalDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const isUnderOneYear = years < 1;

  // 显示文本
  const displayText = isUnderOneYear
    ? `${totalMonths}个月${days}天`
    : `${years}岁${months}个月`;

  // 映射到 AgeGroup
  const ageGroup = getAgeGroup(totalMonths);

  // 映射到 GrowthStage
  const growthStage = getGrowthStage(totalMonths);

  return {
    totalMonths,
    totalDays,
    displayText,
    ageGroup,
    growthStage,
    isUnderOneYear,
  };
}

/**
 * 根据月龄获取 AgeGroup
 */
export function getAgeGroup(totalMonths: number): AgeGroup | null {
  if (totalMonths < 6) return null;
  if (totalMonths <= 8) return '6-8m';
  if (totalMonths <= 11) return '9-11m';
  if (totalMonths <= 23) return '1-2y';
  if (totalMonths <= 35) return '2-3y';
  return '3-5y';
}

/**
 * 根据月龄获取成长阶段
 */
export function getGrowthStage(totalMonths: number): GrowthStage {
  if (totalMonths < 6) return 'infant_feeding';
  if (totalMonths <= 8) return 'complementary_start';
  if (totalMonths <= 11) return 'complementary_advance';
  return 'toddler_diet';
}

/**
 * 根据是否满1岁返回餐次名称
 */
export function getMealLabels(isUnderOneYear: boolean): {
  breakfast: string;
  lunch: string;
  dinner: string;
} {
  if (isUnderOneYear) {
    return {
      breakfast: '第一餐辅食',
      lunch: '第二餐辅食',
      dinner: '第三餐辅食',
    };
  }
  return {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
  };
}

/**
 * 根据是否满1岁返回餐次图标
 */
export function getMealIcons(isUnderOneYear: boolean): {
  breakfast: string;
  lunch: string;
  dinner: string;
} {
  if (isUnderOneYear) {
    return {
      breakfast: '🥣',
      lunch: '🥄',
      dinner: '🍽️',
    };
  }
  return {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
  };
}

/**
 * 生成唯一宝宝 ID
 */
export function generateBabyId(): string {
  return `baby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 从已有用户设置估算出生日期（用于迁移）
 */
export function estimateBirthDateFromAgeGroup(ageGroup: AgeGroup): string {
  const now = new Date();
  let monthsAgo: number;
  switch (ageGroup) {
    case '6-8m': monthsAgo = 7; break;
    case '9-11m': monthsAgo = 10; break;
    case '1-2y': monthsAgo = 18; break;
    case '2-3y': monthsAgo = 30; break;
    case '3-5y': monthsAgo = 48; break;
  }
  const birth = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 15);
  return birth.toISOString().slice(0, 10);
}

/**
 * 获取当前宝宝的年龄信息
 */
export function getCurrentBabyAgeInfo(babies: BabyProfile[], currentBabyId: string | null): BabyAgeInfo | null {
  if (!currentBabyId) return null;
  const currentBaby = babies.find(b => b.id === currentBabyId);
  if (!currentBaby) return null;
  return calcAge(currentBaby.birthDate);
}
