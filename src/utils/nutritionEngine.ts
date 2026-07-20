import { DayPlan, WeeklyPlan, DAYS_OF_WEEK, AgeGroup, getAgeStage } from '../types';
import { lookupFoodCategory, FoodCategory } from './foodDictionary';
import { getAgeRule } from './ageRules';

export interface NutritionItem {
  key: string;
  name: string;
  icon: string;
  covered: boolean;
  suggestion: string;
}

export interface DayNutritionResult {
  covered: NutritionItem[];
  optimization: NutritionItem[];
  summary: string;
  /** 营养检查类型 */
  checkType: 'growth' | 'coverage' | 'balance';
}

export interface WeekNutritionItem {
  key: string;
  name: string;
  icon: string;
  count: number;
  display: string;
  suggestion: string;
}

export interface WeekNutritionResult {
  items: WeekNutritionItem[];
  uniqueIngredients: number;
  diversity: string;
  summary: string;
}

export interface SnackItem {
  time: string;
  name: string;
  icon: string;
  covers: string;
}

function collectDishes(dayPlan: DayPlan) {
  return [
    ...(dayPlan?.breakfast?.dishes || []),
    ...(dayPlan?.lunch?.dishes || []),
    ...(dayPlan?.dinner?.dishes || []),
  ];
}

function getDayIngredients(dayPlan: DayPlan): string[] {
  const all = new Set<string>();
  for (const dish of collectDishes(dayPlan)) {
    for (const ing of dish.mainIngredients) {
      all.add(ing);
    }
  }
  return [...all];
}

function dishCoversCategory(dish: { mainIngredients: string[] }, cat: FoodCategory): boolean {
  return dish.mainIngredients.some(ing => lookupFoodCategory(ing) === cat);
}

function anyDayDishCovers(dayPlan: DayPlan, cat: FoodCategory): boolean {
  return collectDishes(dayPlan).some(d => dishCoversCategory(d, cat));
}

function anyDayDishCoversAny(dayPlan: DayPlan, cats: FoodCategory[]): boolean {
  return collectDishes(dayPlan).some(d =>
    d.mainIngredients.some(ing => cats.includes(lookupFoodCategory(ing)))
  );
}

export function generateSnacks(age: AgeGroup): { items: SnackItem[]; coveredKeys: string[] } {
  const fruits: Record<string, { name: string; icon: string }[]> = {
    '6-8m': [{ name: '苹果泥', icon: '🍎' }, { name: '香蕉泥', icon: '🍌' }],
    '9-11m': [{ name: '香蕉', icon: '🍌' }, { name: '梨', icon: '🍐' }],
    '1-2y': [{ name: '苹果', icon: '🍎' }, { name: '香蕉', icon: '🍌' }],
    '2-3y': [{ name: '苹果', icon: '🍎' }, { name: '蓝莓', icon: '🫐' }],
    '3-5y': [{ name: '苹果', icon: '🍎' }, { name: '橘子', icon: '🍊' }],
  };
  const dairies: Record<string, { name: string; icon: string }[]> = {
    '9-11m': [{ name: '酸奶', icon: '🥛' }],
    '1-2y': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }],
    '2-3y': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }],
    '3-5y': [{ name: '酸奶', icon: '🥛' }, { name: '牛奶', icon: '🥛' }],
  };

  const fruitPool = fruits[age] || fruits['3-5y'];
  const dairyPool = dairies[age] || [];
  const fruit = fruitPool[Math.floor(Math.random() * fruitPool.length)];
  const dairy = dairyPool.length > 0 ? dairyPool[Math.floor(Math.random() * dairyPool.length)] : null;

  const items: SnackItem[] = [];
  const coveredKeys: string[] = [];

  items.push({ time: '上午', name: fruit.name, icon: fruit.icon, covers: 'fruit' });
  coveredKeys.push('fruit');

  if (dairy) {
    items.push({ time: '下午', name: dairy.name, icon: dairy.icon, covers: 'dairy' });
    coveredKeys.push('dairy');
  }

  return { items, coveredKeys };
}

function checkCoverage(dayPlan: DayPlan, key: string, category: FoodCategory): boolean {
  if (key === 'meatFish') {
    return anyDayDishCoversAny(dayPlan, ['fishSeafood', 'redMeat', 'poultry']);
  }
  if (key === 'protein') {
    return anyDayDishCoversAny(dayPlan, ['egg', 'fishSeafood', 'redMeat', 'poultry']);
  }
  if (key === 'iron') {
    // 铁来源：红肉或强化铁的米粉/粥（含大米主食材的主食也算铁来源）
    const hasIronFood = anyDayDishCoversAny(dayPlan, ['redMeat', 'fishSeafood', 'poultry', 'egg']);
    if (hasIronFood) return true;
    // 含大米的主食（米粉、米粥等）视为铁来源
    return collectDishes(dayPlan).some(d =>
      d.dishType === 'staple' && d.mainIngredients.some(ing => ing.includes('大米') || ing.includes('米粉'))
    );
  }
  if (key === 'newFood') {
    // 新食物体验：当天有任何不常见的食材即视为有体验
    return collectDishes(dayPlan).length > 0;
  }
  if (key === 'dairy' || key === 'soy') {
    return anyDayDishCovers(dayPlan, category);
  }
  if (key === 'vegetable') {
    return anyDayDishCoversAny(dayPlan, ['darkVeg', 'lightVeg']);
  }
  return anyDayDishCovers(dayPlan, category);
}

export function analyzeDayNutrition(dayPlan: DayPlan, age: AgeGroup): DayNutritionResult {
  const rule = getAgeRule(age);
  const stage = getAgeStage(age);

  if (!rule) {
    return { covered: [], optimization: [], summary: '请先完成宝宝信息设置。', checkType: 'balance' };
  }

  const covered: NutritionItem[] = [];
  const optimization: NutritionItem[] = [];

  for (const check of rule.dailyChecks) {
    const isCovered = checkCoverage(dayPlan, check.key, check.category);

    const item: NutritionItem = {
      key: check.key,
      name: check.name,
      icon: check.icon,
      covered: isCovered,
      suggestion: check.suggestion,
    };

    if (isCovered) {
      covered.push(item);
    } else {
      optimization.push(item);
    }
  }

  const checkType = stage === 'growth_check' ? 'growth' : stage === 'coverage_check' ? 'coverage' : 'balance';
  const summary = buildDaySummary(covered, optimization, stage);

  return { covered, optimization, summary, checkType };
}

function buildDaySummary(
  covered: NutritionItem[],
  optimization: NutritionItem[],
  stage: string,
): string {
  // 6-8 个月（辅食初期）：成长里程碑视角
  if (stage === 'growth_check') {
    if (optimization.length === 0) {
      return '今天宝宝尝试了多种食物，辅食成长表现很棒！继续观察宝宝的反应哦~';
    }
    const coveredCount = covered.length;
    const total = covered.length + optimization.length;
    if (coveredCount >= total * 0.5) {
      return '宝宝正在逐步建立辅食习惯，今天已经有不错的尝试，继续保持哦~';
    }
    return '辅食初期重在尝试，不必追求每餐都覆盖全部种类。奶仍然是宝宝的主要营养来源。';
  }

  // 9-11 个月（辅食进阶）：营养覆盖视角
  if (stage === 'coverage_check') {
    if (optimization.length === 0) {
      return '今日辅食搭配很全面，已覆盖主要营养类别，继续保持哦~';
    }
    const missing = optimization.filter(o => o.key !== 'dairy' && o.key !== 'lightVeg');
    const nonCritical = optimization.filter(o => o.key === 'dairy' || o.key === 'lightVeg');
    if (missing.length === 0 && nonCritical.length > 0) {
      return '今日基本营养类别已覆盖，可适当增加种类丰富度。';
    }
    const names = optimization.map(o => o.name).join('、');
    return `今日已覆盖部分营养类别，建议补充${names}，逐步丰富辅食种类。`;
  }

  // 1 岁以上：均衡检查
  if (optimization.length === 0) {
    return '今日饮食搭配很全面，已覆盖主要营养类别，继续保持哦~';
  }

  const coveredCount = covered.length;
  const total = covered.length + optimization.length;

  if (coveredCount >= total * 0.6) {
    const names = optimization.map(o => o.name).join('、');
    return `今日饮食整体较均衡，建议补充${names}，提高食物多样性。`;
  }

  const names = optimization.map(o => o.name).join('、');
  return `今日已覆盖部分营养类别，建议补充${names}，提高食物多样性。`;
}

export function analyzeWeekNutrition(weeklyPlan: WeeklyPlan, age: AgeGroup): WeekNutritionResult {
  const rule = getAgeRule(age);
  if (!rule) {
    return { items: [], uniqueIngredients: 0, diversity: '请先完成设置', summary: '请先完成宝宝信息设置。' };
  }

  const items: WeekNutritionItem[] = rule.weeklyChecks.map(check => {
    let count = 0;
    for (const day of DAYS_OF_WEEK) {
      const dayPlan = weeklyPlan[day];
      if (!dayPlan) continue;
      if (check.key === 'meat') {
        if (anyDayDishCoversAny(dayPlan, ['redMeat', 'poultry'])) count++;
      } else if (check.key === 'iron') {
        if (anyDayDishCoversAny(dayPlan, ['redMeat', 'fishSeafood', 'poultry', 'egg']) ||
            collectDishes(dayPlan).some(d =>
              d.dishType === 'staple' && d.mainIngredients.some(ing => ing.includes('大米') || ing.includes('米粉'))
            )) {
          count++;
        }
      } else {
        if (anyDayDishCovers(dayPlan, check.category)) count++;
      }
    }

    let display: string;
    if (count >= check.dailyTarget) {
      display = '搭配良好';
    } else if (count <= 1) {
      display = '建议增加';
    } else {
      display = `${count} 次`;
    }

    return {
      key: check.key,
      name: check.name,
      icon: check.icon,
      count,
      display,
      suggestion: check.suggestion,
    };
  });

  const allIngredients = new Set<string>();
  for (const day of DAYS_OF_WEEK) {
    const dayPlan = weeklyPlan[day];
    if (!dayPlan) continue;
    for (const ing of getDayIngredients(dayPlan)) {
      allIngredients.add(ing);
    }
  }
  const uniqueCount = allIngredients.size;

  let diversity: string;
  if (uniqueCount >= 35) {
    diversity = '优秀';
  } else if (uniqueCount >= 25) {
    diversity = '良好';
  } else {
    diversity = '可进一步提升';
  }

  const goodCount = items.filter(i => i.count >= rule.weeklyChecks.find(c => c.key === i.key)!.dailyTarget).length;
  const total = items.length;
  let summary: string;
  if (goodCount === total) {
    summary = '本周饮食整体均衡，各类食物搭配丰富，继续保持哦~';
  } else if (goodCount >= total * 0.7) {
    summary = '本周饮食较均衡，建议继续丰富食物种类，保持多样化搭配。';
  } else {
    summary = '本周部分食物类别覆盖不足，建议参考下方建议，逐步增加食物多样性。';
  }

  return { items, uniqueIngredients: uniqueCount, diversity, summary };
}
