import { DayPlan, WeeklyPlan, DAYS_OF_WEEK, AgeGroup, getAgeStage } from '../types';
import { lookupFoodCategory, FoodCategory } from './foodDictionary';
import { getAgeRule } from './ageRules';

export interface NutritionItem {
  key: string;
  name: string;
  icon: string;
  covered: boolean;
  suggestion: string;
  /** 补充建议的具体食物 */
  supplementFoods?: string[];
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

// 营养分类对应的补充食物建议（按年龄段区分）
const SUPPLEMENT_FOODS_BY_AGE: Record<AgeGroup, Record<string, string[]>> = {
  '6-8m': {
    staple: ['强化铁米粉', '小米糊'],
    protein: ['蛋黄泥', '鸡肉泥', '猪肉泥'],
    meatFish: ['鸡肉泥', '鳕鱼泥', '牛肉泥'],
    darkVeg: ['菠菜泥', '西兰花泥', '胡萝卜泥'],
    lightVeg: ['冬瓜泥', '白萝卜泥'],
    fruit: ['苹果泥', '香蕉泥', '梨泥'],
    dairy: ['母乳或配方奶仍是重要营养来源'],
    egg: ['蛋黄羹', '蒸蛋羹'],
    iron: ['强化铁米粉', '猪肝泥', '牛肉泥'],
    vegetable: ['西兰花泥', '菠菜泥', '南瓜泥'],
    newFood: ['尝试一种新蔬菜或新水果'],
    soy: ['嫩豆腐泥'],
  },
  '9-11m': {
    staple: ['软饭', '碎菜粥', '小面条'],
    protein: ['蛋黄碎', '鸡肉末', '猪肉末'],
    meatFish: ['鸡肉末', '鳕鱼碎', '牛肉末'],
    darkVeg: ['菠菜碎', '西兰花小朵', '胡萝卜丁'],
    lightVeg: ['冬瓜碎', '白萝卜碎'],
    fruit: ['苹果条', '香蕉段', '梨条'],
    dairy: ['母乳或配方奶仍是重要营养来源'],
    egg: ['蒸蛋羹', '炒蛋碎'],
    iron: ['牛肉末', '猪肝泥'],
    vegetable: ['西兰花小朵', '菠菜碎', '南瓜块'],
    soy: ['嫩豆腐块', '豆腐脑'],
  },
  '1-2y': {
    staple: ['软米饭', '小馄饨', '面条'],
    protein: ['炒鸡蛋', '鸡肉丁', '肉末蒸蛋'],
    meatFish: ['鸡肉丁', '清蒸鳕鱼', '牛肉末'],
    darkVeg: ['菠菜炒蛋', '西兰花炒肉', '胡萝卜炒蛋'],
    lightVeg: ['冬瓜肉末汤', '白萝卜排骨汤'],
    fruit: ['苹果块', '香蕉', '梨块'],
    dairy: ['每日适量奶类，根据宝宝饮食情况调整'],
    egg: ['番茄炒蛋', '蒸蛋羹', '蛋花汤'],
    iron: ['牛肉末', '猪肝炒菠菜'],
    vegetable: ['西兰花炒肉', '菠菜炒蛋', '南瓜小米粥'],
    soy: ['番茄豆腐', '鱼肉豆腐羹'],
  },
  '2-3y': {
    staple: ['米饭', '馒头', '饺子'],
    protein: ['炒鸡蛋', '红烧肉末', '清蒸鱼'],
    meatFish: ['宫保鸡丁', '清蒸鲈鱼', '红烧牛肉'],
    darkVeg: ['蒜蓉西兰花', '菠菜炒蛋', '胡萝卜炒肉丝'],
    lightVeg: ['冬瓜排骨汤', '白萝卜炖肉', '清炒西葫芦'],
    fruit: ['苹果', '香蕉', '橙子', '蓝莓'],
    dairy: ['每日适量奶类或酸奶，保持钙摄入'],
    egg: ['番茄炒蛋', '蛋花汤', '蒸蛋羹'],
    iron: ['牛肉炖土豆', '猪肝炒洋葱'],
    vegetable: ['清炒西兰花', '菠菜蛋花汤', '南瓜蒸排骨'],
    soy: ['家常豆腐', '豆腐鱼汤'],
  },
  '3-5y': {
    staple: ['米饭', '面条', '饺子', '包子'],
    protein: ['番茄炒蛋', '红烧鸡翅', '清蒸鱼块'],
    meatFish: ['糖醋里脊', '清蒸鲈鱼', '土豆炖牛肉'],
    darkVeg: ['蒜蓉西兰花', '菠菜蛋花汤', '胡萝卜炒肉片'],
    lightVeg: ['冬瓜排骨汤', '白萝卜炖牛腩', '蚝油生菜'],
    fruit: ['苹果', '香蕉', '橙子', '草莓', '蓝莓'],
    dairy: ['每日适量奶类，培养良好饮食习惯'],
    egg: ['番茄炒蛋', '虾仁蒸蛋', '蛋花汤'],
    iron: ['牛肉炒洋葱', '猪肝炒木耳'],
    vegetable: ['清炒时蔬', '菠菜拌粉丝', '南瓜小米粥'],
    soy: ['麻婆豆腐（微辣或不辣）', '鲫鱼豆腐汤'],
  },
};

// 食材丰富建议描述文案（按年龄段）
export function getSupplementDescription(age: AgeGroup): string {
  switch (age) {
    case '6-8m':
      return '帮助宝宝逐步尝试不同食材，观察接受情况';
    case '9-11m':
      return '丰富食材种类，同时练习不同食物质地';
    case '1-2y':
      return '丰富家庭餐搭配，帮助宝宝建立均衡饮食习惯';
    default:
      return '丰富家庭餐搭配，培养多样化饮食习惯';
  }
}

export function getSupplementFoods(key: string, age: AgeGroup): string[] {
  const ageFoods = SUPPLEMENT_FOODS_BY_AGE[age];
  if (!ageFoods) return [];
  return ageFoods[key] || [];
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
