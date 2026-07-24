import { DayPlan, WeeklyPlan, DAYS_OF_WEEK, AgeGroup, getAgeStage } from '../types';
import { lookupFoodCategory, FoodCategory } from './foodDictionary';
import { getAgeRule } from './ageRules';

export interface DailyCoveredItem {
  key: string;
  label: string;
  icon: string;
}

export interface DayNutritionResult {
  /** ✅ 已覆盖的类别 */
  covered: DailyCoveredItem[];
  /** 📌 今日搭配评价 */
  todayEvaluation: string;
  /** 💡 明日搭配建议 */
  tomorrowSuggestion: string;
  /** 总结文案 */
  summary: string;
}

export interface WeekNutritionItem {
  key: string;
  name: string;
  icon: string;
  count: number;
  display: string;
  suggestion: string;
  /** 子项（如动物性蛋白下的鱼类、肉类、鸡蛋） */
  subItems?: WeekNutritionItem[];
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

export function generateSnacks(age: AgeGroup, dayIndex: number = 0): { items: SnackItem[]; coveredKeys: string[] } {
  const fruits: Record<string, { name: string; icon: string }[]> = {
    '6-8m': [{ name: '苹果泥', icon: '🍎' }, { name: '香蕉泥', icon: '🍌' }, { name: '梨泥', icon: '🍐' }, { name: '牛油果泥', icon: '🥑' }],
    '9-11m': [{ name: '香蕉', icon: '🍌' }, { name: '梨', icon: '🍐' }, { name: '苹果', icon: '🍎' }, { name: '牛油果', icon: '🥑' }],
    '1-2y': [{ name: '苹果', icon: '🍎' }, { name: '香蕉', icon: '🍌' }, { name: '梨', icon: '🍐' }, { name: '蓝莓', icon: '🫐' }],
    '2-3y': [{ name: '苹果', icon: '🍎' }, { name: '蓝莓', icon: '🫐' }, { name: '香蕉', icon: '🍌' }, { name: '橘子', icon: '🍊' }],
    '3-5y': [{ name: '苹果', icon: '🍎' }, { name: '橘子', icon: '🍊' }, { name: '香蕉', icon: '🍌' }, { name: '草莓', icon: '🍓' }],
  };
  const dairies: Record<string, { name: string; icon: string }[]> = {
    '9-11m': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }],
    '1-2y': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }, { name: '牛奶', icon: '🥛' }],
    '2-3y': [{ name: '酸奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }, { name: '牛奶', icon: '🥛' }],
    '3-5y': [{ name: '酸奶', icon: '🥛' }, { name: '牛奶', icon: '🥛' }, { name: '奶酪', icon: '🧀' }],
  };

  const fruitPool = fruits[age] || fruits['3-5y'];
  const dairyPool = dairies[age] || [];

  // 按天变化（用质数哈希保证7天各有不同组合，且同一天稳定不变）
  const fruitSeed = (dayIndex * 17 + 5) % 100;
  const dairySeed = (dayIndex * 13 + 11) % 100;
  const fruit = fruitPool[fruitSeed % fruitPool.length];
  const dairy = dairyPool.length > 0 ? dairyPool[dairySeed % dairyPool.length] : null;

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

// ============================================================
// 全天饮食总结：6大食物类别
// ============================================================

/** 全天六大食物分类（合并后的精简版） */
const DAILY_CATEGORIES = [
  { key: 'staple',        label: '谷薯类',      icon: '🍚', ingredientCats: ['staple'] as FoodCategory[] },
  { key: 'animalProtein', label: '动物性蛋白',   icon: '🥩', ingredientCats: ['egg', 'fishSeafood', 'redMeat', 'poultry'] as FoodCategory[] },
  { key: 'vegetable',     label: '蔬菜',         icon: '🥬', ingredientCats: ['darkVeg', 'lightVeg'] as FoodCategory[] },
  { key: 'fruit',         label: '水果',         icon: '🍎', ingredientCats: ['fruit'] as FoodCategory[] },
  { key: 'dairy',         label: '奶制品',       icon: '🥛', ingredientCats: ['dairy'] as FoodCategory[] },
  { key: 'soy',           label: '豆制品',       icon: '🫘', ingredientCats: ['soyProduct'] as FoodCategory[] },
];

// ============================================================
// 今日搭配评价 & 明日建议（年龄适配）
// ============================================================

function buildTodayEvaluation(coveredKeys: Set<string>, age: AgeGroup): string {
  const hasStaple = coveredKeys.has('staple');
  const hasProtein = coveredKeys.has('animalProtein');
  const hasVeg = coveredKeys.has('vegetable');
  const hasFruit = coveredKeys.has('fruit');
  const hasDairy = coveredKeys.has('dairy');
  const hasSoy = coveredKeys.has('soy');

  const allCore = hasStaple && hasProtein && hasVeg && hasFruit;

  // 1-2岁：关注食物多样、动物性食物、奶制品
  if (age === '1-2y') {
    if (allCore && hasDairy) {
      return '今天食物种类较丰富，主食、优质蛋白、蔬菜和水果均有安排，整体搭配较合理。';
    }
    if (hasStaple && hasProtein && hasVeg) {
      if (!hasFruit) return '今天主食、蛋白质和蔬菜搭配较好，建议加餐时安排一份水果，丰富维生素来源。';
      if (!hasDairy) return '今天主食、蛋白质和蔬菜搭配较好，建议安排适量奶制品，为宝宝补钙助力成长。';
      return '今天主食、蛋白质和蔬菜搭配较好，可以继续丰富食物种类。';
    }
    if (hasStaple && hasVeg && !hasProtein) {
      return '今天主食和蔬菜搭配较好，建议增加肉、鱼、蛋等动物性蛋白，助力宝宝生长发育。';
    }
    if (hasStaple && hasProtein) {
      return '今天主食和蛋白质搭配较好，建议增加蔬菜种类，让宝宝接触更多食物。';
    }
    return '今天基础搭配已完成，建议逐步丰富食物种类，让宝宝尝试更多样化的食材。';
  }

  // 2-3岁：关注自主进食、家庭饮食过渡
  if (age === '2-3y') {
    if (allCore && hasDairy) {
      return '今天食物种类较丰富，主食、蛋白质、蔬菜和水果搭配均衡，适合宝宝自主进食练习。';
    }
    if (hasStaple && hasProtein && hasVeg) {
      if (!hasFruit) return '今天主食、蛋白质和蔬菜搭配合理，加餐时可以安排一份水果，培养多样化饮食习惯。';
      if (!hasDairy) return '今天主食、蛋白质和蔬菜搭配合理，建议安排适量奶制品，帮助宝宝保持钙摄入。';
      return '今天主食、蛋白质和蔬菜搭配合理，适合宝宝向家庭饮食过渡。';
    }
    if (hasStaple && hasVeg && !hasProtein) {
      return '今天主食和蔬菜搭配较好，建议增加肉、鱼、蛋或豆制品，丰富蛋白质来源，支持自主进食。';
    }
    if (hasStaple && hasProtein) {
      return '今天主食和蛋白质搭配较好，建议增加蔬菜种类，培养宝宝接受不同食物。';
    }
    return '今天基础搭配已完成，可以逐步丰富食材，帮助宝宝建立多样化饮食习惯。';
  }

  // 3-5岁：关注均衡搭配、粗细粮结合、多样化饮食
  if (allCore && hasDairy) {
    return '今天食物种类较丰富，主食、蛋白质、蔬菜和水果均有安排，整体搭配均衡合理。';
  }
  if (hasStaple && hasProtein && hasVeg) {
    if (!hasFruit) return '今天主食、蛋白质和蔬菜搭配均衡，建议补充一份水果，增加维生素摄入。';
    if (!hasDairy) return '今天主食、蛋白质和蔬菜搭配均衡，建议安排奶制品，保障钙质摄入。';
    return '今天主食、蛋白质和蔬菜搭配均衡，可以继续尝试不同粗细粮组合。';
  }
  if (hasStaple && hasVeg && !hasProtein) {
    return '今天主食和蔬菜搭配较好，建议增加鱼、肉、蛋、虾或豆制品，丰富蛋白质来源。';
  }
  if (hasStaple && hasProtein) {
    return '今天主食和蛋白质搭配较好，建议增加蔬菜种类，均衡膳食结构。';
  }
  return '今天基础搭配已完成，可以进一步丰富食物种类，实现多样化饮食。';
}

function buildTomorrowSuggestion(coveredKeys: Set<string>, age: AgeGroup, dayPlan: DayPlan): string {
  const hasProtein = coveredKeys.has('animalProtein');
  const hasVeg = coveredKeys.has('vegetable');
  const hasFruit = coveredKeys.has('fruit');
  const hasDairy = coveredKeys.has('dairy');
  const hasSoy = coveredKeys.has('soy');
  const hasStaple = coveredKeys.has('staple');

  const allCore = hasStaple && hasProtein && hasVeg && hasFruit && hasDairy;

  // 获取实际食材类别，用于更精准的建议
  const allIngredientCats = collectDishes(dayPlan).flatMap(d => d.mainIngredients.map(ing => lookupFoodCategory(ing)));
  const hasFish = allIngredientCats.includes('fishSeafood');
  const hasRedMeat = allIngredientCats.includes('redMeat');
  const hasPoultry = allIngredientCats.includes('poultry');
  const hasEgg = allIngredientCats.includes('egg');
  const hasDarkVeg = allIngredientCats.includes('darkVeg');
  const hasLightVeg = allIngredientCats.includes('lightVeg');

  // 1-2岁
  if (age === '1-2y') {
    if (allCore) {
      return '今天饮食搭配较丰富，明天可以继续保持，尝试不同食材组合。';
    }
    if (!hasProtein) {
      return '今天蛋白质来源较少，明天可以安排鱼类、肉类或豆制品，丰富蛋白质来源。';
    }
    // 只有红肉没有鱼
    if (hasRedMeat && !hasFish && !hasPoultry && !hasEgg) {
      return '今天以红肉为主，明天可以尝试鱼肉或鸡肉，丰富蛋白质种类。';
    }
    if (!hasVeg && hasProtein) {
      return '今天蔬菜种类较少，明天可以尝试不同颜色的蔬菜，增加食物多样性。';
    }
    if (hasDarkVeg && !hasLightVeg && hasVeg) {
      return '今天蔬菜以深色蔬菜为主，明天可以搭配浅色蔬菜，丰富蔬菜种类。';
    }
    if (!hasFruit) {
      return '今天水果安排较少，明天可以安排一份水果加餐，补充维生素。';
    }
    if (!hasDairy) {
      return '今天奶制品较少，明天可以安排酸奶或奶酪，补充钙质。';
    }
    return '今天搭配整体不错，明天可以继续丰富食物种类，帮助宝宝建立均衡饮食习惯。';
  }

  // 2-3岁
  if (age === '2-3y') {
    if (allCore) {
      return '今天饮食搭配较丰富，明天可以继续保持，尝试不同食材组合，培养自主进食。';
    }
    if (!hasProtein) {
      return '今天蛋白质来源较少，明天可以安排鱼类、肉类或豆制品，丰富蛋白质种类。';
    }
    if (hasRedMeat && !hasFish && !hasPoultry && !hasEgg) {
      return '今天以红肉为主，明天可以尝试鱼、虾或鸡肉，丰富蛋白质种类。';
    }
    if (!hasVeg && hasProtein) {
      return '今天蔬菜种类较少，明天可以尝试不同种类的蔬菜，让宝宝接触更多食物。';
    }
    if (hasDarkVeg && !hasLightVeg && hasVeg) {
      return '今天蔬菜以深色蔬菜为主，明天可以搭配浅色蔬菜，丰富蔬菜选择。';
    }
    if (!hasFruit) {
      return '今天水果较少，明天可以安排一份水果，培养宝宝吃水果的习惯。';
    }
    if (!hasDairy) {
      return '今天奶制品安排较少，明天可以补充酸奶或牛奶，帮助钙质摄入。';
    }
    return '今天搭配整体不错，明天可以继续丰富食物种类，帮助宝宝向家庭饮食过渡。';
  }

  // 3-5岁
  if (allCore) {
    return '今天饮食搭配较丰富，明天可以继续保持，尝试不同食材组合和粗细粮搭配。';
  }
  if (!hasProtein) {
    return '今天蛋白质来源较少，明天可以安排鱼、虾、肉或豆制品，丰富蛋白质来源。';
  }
  if (hasRedMeat && !hasFish && !hasPoultry && !hasEgg) {
    return '今天以红肉为主，明天可以尝试鱼类或虾类，丰富蛋白质种类，补充DHA。';
  }
  if (!hasVeg && hasProtein) {
    return '今天蔬菜种类较少，明天可以尝试不同颜色蔬菜，增加食物多样性。';
  }
  if (hasDarkVeg && !hasLightVeg && hasVeg) {
    return '今天蔬菜以深色蔬菜为主，明天可以搭配浅色蔬菜，让蔬菜种类更丰富。';
  }
  if (!hasFruit) {
    return '今天水果安排较少，明天可以安排一份新鲜水果，补充维生素和膳食纤维。';
  }
  if (!hasDairy) {
    return '今天奶制品较少，明天可以安排牛奶或酸奶，保障每日钙摄入。';
  }
  return '今天搭配整体不错，明天可以继续丰富食材种类，实现均衡多样化饮食。';
}

export function analyzeDayNutrition(dayPlan: DayPlan, age: AgeGroup): DayNutritionResult {
  const allDishes = collectDishes(dayPlan);

  // 主菜类型（水果和奶制品不应从这些菜中统计）
  const mainDishTypes = ['staple', 'meat', 'vegetable', 'soup', 'egg'];

  // 从非主菜中收集食材（仅用于判断水果和奶制品）
  const nonMainDishes = allDishes.filter(d => !mainDishTypes.includes(d.dishType));
  const nonMainIngredientCats = nonMainDishes.flatMap(d => d.mainIngredients.map(ing => lookupFoodCategory(ing)));

  // 从主菜中收集食材（用于谷薯类、动物性蛋白、蔬菜、豆制品）
  const mainIngredientCats = allDishes.flatMap(d => d.mainIngredients.map(ing => lookupFoodCategory(ing)));

  // ✅ 已覆盖
  const covered: DailyCoveredItem[] = [];
  const coveredKeys = new Set<string>();

  for (const cat of DAILY_CATEGORIES) {
    let isCovered: boolean;
    if (cat.key === 'fruit' || cat.key === 'dairy') {
      // 水果和奶制品仅从加餐/点心类统计，不统计正餐中作为配料出现的情况
      // 同时检查是否有 mealRole 为 fruit 的菜品
      if (cat.key === 'fruit') {
        isCovered = cat.ingredientCats.some(c => nonMainIngredientCats.includes(c))
          || allDishes.some(d => d.mealRole === 'fruit');
      } else {
        isCovered = cat.ingredientCats.some(c => nonMainIngredientCats.includes(c));
      }
    } else {
      isCovered = cat.ingredientCats.some(c => mainIngredientCats.includes(c));
    }
    if (isCovered) {
      covered.push({ key: cat.key, label: cat.label, icon: cat.icon });
      coveredKeys.add(cat.key);
    }
  }

  // 📌 今日搭配评价
  const todayEvaluation = buildTodayEvaluation(coveredKeys, age);

  // 💡 明日搭配建议
  const tomorrowSuggestion = buildTomorrowSuggestion(coveredKeys, age, dayPlan);

  // 总结文案
  const summary = buildDaySummary(covered.length, age);

  return { covered, todayEvaluation, tomorrowSuggestion, summary };
}

function buildDaySummary(coveredCount: number, age: AgeGroup): string {
  if (age === '1-2y') {
    if (coveredCount >= 5) return '今日食物种类较丰富，继续保持多样化饮食习惯。';
    if (coveredCount >= 4) return '今日基础搭配较完整，可以继续丰富食物种类。';
    return '今日搭配了基础食材，可以通过水果、奶制品等进一步丰富。';
  }
  if (age === '2-3y') {
    if (coveredCount >= 5) return '今日食物种类丰富，多种食材组合有利于培养自主进食习惯。';
    if (coveredCount >= 4) return '今日搭配较完整，可以尝试更多食材组合。';
    return '今日基础饮食搭配较好，可以进一步丰富食材组合。';
  }
  // 3-5y
  if (coveredCount >= 5) return '今日饮食均衡丰富，粗细搭配合理，继续保持良好饮食习惯。';
  if (coveredCount >= 4) return '今日搭配整体均衡，可适当增加食物多样性。';
  return '今日基础饮食搭配较完整，可以通过水果、奶制品等进一步丰富。';
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

export function analyzeWeekNutrition(weeklyPlan: WeeklyPlan, age: AgeGroup): WeekNutritionResult {
  const rule = getAgeRule(age);
  if (!rule) {
    return { items: [], uniqueIngredients: 0, diversity: '请先完成设置', summary: '请先完成宝宝信息设置。' };
  }

  // 谷薯类：统计每周主食覆盖天数
  let stapleCount = 0;
  for (const day of DAYS_OF_WEEK) {
    const dayPlan = weeklyPlan[day];
    if (!dayPlan) continue;
    if (anyDayDishCovers(dayPlan, 'staple')) stapleCount++;
  }

  // 蔬菜：统计覆盖天数、种类数、深色蔬菜天数
  let vegetableDays = 0;
  let darkVegDays = 0;
  const allVegIngredients = new Set<string>();
  for (const day of DAYS_OF_WEEK) {
    const dayPlan = weeklyPlan[day];
    if (!dayPlan) continue;
    const dishes = collectDishes(dayPlan);
    const hasVeg = dishes.some(d =>
      d.mainIngredients.some(ing => {
        const cat = lookupFoodCategory(ing);
        return cat === 'darkVeg' || cat === 'lightVeg';
      })
    );
    if (hasVeg) vegetableDays++;
    if (anyDayDishCovers(dayPlan, 'darkVeg')) darkVegDays++;
    // 收集蔬菜种类
    for (const dish of dishes) {
      for (const ing of dish.mainIngredients) {
        const cat = lookupFoodCategory(ing);
        if (cat === 'darkVeg' || cat === 'lightVeg') {
          allVegIngredients.add(ing);
        }
      }
    }
  }
  const vegVariety = allVegIngredients.size;

  const animalProteinKeys = new Set(['fish', 'egg', 'meat']);
  const rawItems: WeekNutritionItem[] = rule.weeklyChecks.map(check => {
    let count = 0;
    for (const day of DAYS_OF_WEEK) {
      const dayPlan = weeklyPlan[day];
      if (!dayPlan) continue;
      if (check.key === 'meat') {
        if (anyDayDishCoversAny(dayPlan, ['redMeat', 'poultry'])) count++;
      } else if (check.key === 'vegetable') {
        // 蔬菜天数已在前面预计算，此处跳过逐天统计
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
    if (check.key === 'fruit') {
      count = 7;
      display = '每日加餐';
    } else if (check.key === 'dairy') {
      display = '关注摄入';
    } else if (check.key === 'vegetable') {
      count = vegetableDays;
      display = `覆盖${count}天，${vegVariety}种蔬菜`;
    } else if (count >= check.dailyTarget) {
      display = `${count}次`;
    } else if (count <= 1) {
      display = '建议增加';
    } else {
      display = `${count}次`;
    }

    return {
      key: check.key,
      name: check.name,
      icon: check.icon,
      count,
      display,
      suggestion: check.key === 'dairy'
        ? '建议关注每日奶制品摄入（约350-500mL）'
        : check.key === 'fruit'
        ? '每日加餐已安排水果'
        : check.key === 'vegetable'
        ? `深色蔬菜占${darkVegDays}天，${check.suggestion}`
        : check.suggestion,
    };
  });

  // 动物性蛋白分组：鱼类、肉类、鸡蛋
  const animalItems = rawItems.filter(i => animalProteinKeys.has(i.key));
  const otherItems = rawItems.filter(i => !animalProteinKeys.has(i.key));

  // 动物性蛋白聚合建议
  const animalSuggestion = animalItems
    .filter(i => i.count < 3)
    .map(i => i.suggestion)
    .join('；') || '动物性蛋白搭配合理';

  const items: WeekNutritionItem[] = [
    // 谷薯类（始终在最前）
    {
      key: 'staple',
      name: '谷薯类',
      icon: '🍚',
      count: stapleCount,
      display: stapleCount >= 7 ? '覆盖7天' : `${stapleCount}天`,
      suggestion: '建议每日搭配主食，粗细搭配更健康',
    },
    // 动物性蛋白聚合
    ...(animalItems.length > 0 ? [{
      key: 'animalProtein',
      name: '动物性蛋白',
      icon: '🥩',
      count: 0,
      display: '',
      suggestion: animalSuggestion,
      subItems: animalItems,
    }] : []),
    // 其他项
    ...otherItems,
  ];

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
    diversity = '食物种类丰富';
  } else if (uniqueCount >= 25) {
    diversity = '食物种类较丰富';
  } else {
    diversity = '可进一步提升';
  }

  // 统计各项达标情况（仅统计原 weeklyChecks 中的项）
  const checkItems = rawItems.filter(i => !animalProteinKeys.has(i.key));
  const goodCount = checkItems.filter(i => {
    const target = rule.weeklyChecks.find(c => c.key === i.key)?.dailyTarget ?? 0;
    return i.count >= target;
  }).length + (animalItems.length > 0 ? (animalItems.filter(i => i.count >= 3).length >= 2 ? 1 : 0) : 0);
  const total = checkItems.length + (animalItems.length > 0 ? 1 : 0);
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
