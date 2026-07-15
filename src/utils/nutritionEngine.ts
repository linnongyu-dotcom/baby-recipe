import { DayPlan, WeeklyPlan, DAYS_OF_WEEK, AgeGroup } from '../types';
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
    '3-4y': [{ name: '苹果', icon: '🍎' }, { name: '橘子', icon: '🍊' }],
  };
  const dairies: Record<string, { name: string; icon: string }[]> = {
    '9-11m': [{ name: '酸奶', icon: '🥛' }],
    '1-2y': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }],
    '2-3y': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }],
    '3-4y': [{ name: '酸奶', icon: '🥛' }, { name: '牛奶', icon: '🥛' }],
  };

  const fruitPool = fruits[age] || fruits['3-4y'];
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

export function analyzeDayNutrition(dayPlan: DayPlan, age: AgeGroup): DayNutritionResult {
  const rule = getAgeRule(age);

  const covered: NutritionItem[] = [];
  const optimization: NutritionItem[] = [];

  for (const check of rule.dailyChecks) {
    let isCovered: boolean;

    if (check.key === 'meatFish') {
      isCovered = anyDayDishCoversAny(dayPlan, ['fishSeafood', 'redMeat', 'poultry']);
    } else if (check.key === 'dairy') {
      isCovered = anyDayDishCovers(dayPlan, 'dairy');
    } else if (check.key === 'soy') {
      isCovered = anyDayDishCovers(dayPlan, 'soyProduct');
    } else {
      isCovered = anyDayDishCovers(dayPlan, check.category);
    }

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

  const summary = buildDaySummary(covered, optimization);

  return { covered, optimization, summary };
}

function buildDaySummary(
  covered: NutritionItem[],
  optimization: NutritionItem[],
): string {
  if (optimization.length === 0) {
    return '今日饮食搭配很全面，已覆盖主要营养类别，继续保持哦~';
  }

  const coveredCount = covered.length;
  const total = covered.length + optimization.length;

  const parts: string[] = [];

  if (coveredCount >= total * 0.6) {
    parts.push('今日饮食整体较均衡');
  } else {
    parts.push('今日已覆盖部分营养类别');
  }

  const names = optimization.map(o => o.name).join('、');
  parts.push(`建议补充${names}`);

  parts.push('提高食物多样性');
  return parts.join('，') + '。';
}

export function analyzeWeekNutrition(weeklyPlan: WeeklyPlan, age: AgeGroup): WeekNutritionResult {
  const rule = getAgeRule(age);

  const items: WeekNutritionItem[] = rule.weeklyChecks.map(check => {
    let count = 0;
    for (const day of DAYS_OF_WEEK) {
      const dayPlan = weeklyPlan[day];
      if (!dayPlan) continue;
      if (check.key === 'meat') {
        if (anyDayDishCoversAny(dayPlan, ['redMeat', 'poultry'])) count++;
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
