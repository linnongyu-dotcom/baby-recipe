import { DayPlan, AgeGroup, Recipe, MealType, MILK_RECOMMENDATIONS, DayPlanCheckResult } from '../types';
import { lookupFoodCategory, isVegetableCategory } from './foodDictionary';
import { inferProteinSource, getStapleSubCategory } from './mealValidator';

// ============================================================
// 全天搭配检查（三餐生成完成后执行）
// ============================================================

/** 收集一天所有菜品 */
function collectAllDishes(dayPlan: DayPlan): Recipe[] {
  return [
    ...(dayPlan.breakfast?.dishes || []),
    ...(dayPlan.lunch?.dishes || []),
    ...(dayPlan.dinner?.dishes || []),
  ];
}

/** 获取一餐的菜品 */
function getMealDishes(dayPlan: DayPlan, mealType: MealType): Recipe[] {
  return dayPlan[mealType]?.dishes || [];
}

// ============================================================
// 1. 主食检查：避免连续三餐同类型主食
// ============================================================

function checkStapleDiversity(dayPlan: DayPlan): { warning?: string } {
  const breakfastStaples = getMealDishes(dayPlan, 'breakfast').filter(d => d.dishType === 'staple');
  const lunchStaples = getMealDishes(dayPlan, 'lunch').filter(d => d.dishType === 'staple');
  const dinnerStaples = getMealDishes(dayPlan, 'dinner').filter(d => d.dishType === 'staple');

  // 收集三餐的主食类型
  const stapleTypes = new Set<string>();
  for (const dish of [...breakfastStaples, ...lunchStaples, ...dinnerStaples]) {
    stapleTypes.add(getStapleSubCategory(dish.name));
  }

  // 米饭类允许午晚餐重复（符合中国家庭习惯）
  // 只检查非米饭类是否三餐相同
  const nonRiceTypes = [...stapleTypes].filter(t => t !== 'rice');

  // 如果三餐都是面食（noodle）、粥（porridge）等，警告
  if (stapleTypes.size === 1) {
    const onlyType = [...stapleTypes][0];
    if (onlyType === 'rice') return {}; // 全天米饭 OK
    if (onlyType === 'noodle') {
      return { warning: '全天三餐都是面食类主食，建议午晚餐其中一餐换成米饭，增加主食多样性' };
    }
    if (onlyType === 'porridge') {
      return { warning: '全天三餐都是粥类主食，建议午餐换成米饭，保证能量摄入' };
    }
    return { warning: '全天三餐都是同类型主食，建议适当变化' };
  }

  return {};
}

// ============================================================
// 2. 核心食材重复检查
// ============================================================

/** 从菜名提取核心食材 */
function extractCoreIngredients(recipe: Recipe): string[] {
  // 用主食材作为核心食材
  return recipe.mainIngredients.filter(ing => {
    const cat = lookupFoodCategory(ing);
    // 排除调味品和淀粉类配料
    if (cat === 'other') return false;
    return true;
  });
}

/** 检查各餐之间是否有高频重复的核心食材 */
function checkIngredientRepeat(dayPlan: DayPlan): string[] {
  const repeats: string[] = [];

  const meals: { mealType: MealType; ingredients: string[] }[] = [
    { mealType: 'breakfast', ingredients: getMealDishes(dayPlan, 'breakfast').flatMap(extractCoreIngredients) },
    { mealType: 'lunch', ingredients: getMealDishes(dayPlan, 'lunch').flatMap(extractCoreIngredients) },
    { mealType: 'dinner', ingredients: getMealDishes(dayPlan, 'dinner').flatMap(extractCoreIngredients) },
  ];

  // 检查每对餐次
  for (let i = 0; i < meals.length; i++) {
    for (let j = i + 1; j < meals.length; j++) {
      const common = meals[i].ingredients.filter(ing =>
        meals[j].ingredients.includes(ing) &&
        // 米饭、面条等主食类允许重复
        !['大米', '面条', '面粉', '小米', '米饭'].includes(ing)
      );
      if (common.length >= 2) {
        const mealLabels: Record<MealType, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
        repeats.push(
          `${mealLabels[meals[i].mealType]}和${mealLabels[meals[j].mealType]}重复使用：${common.join('、')}`
        );
      }
    }
  }

  return repeats;
}

// ============================================================
// 3. 蛋白质分布检查
// ============================================================

function checkProteinDistribution(dayPlan: DayPlan): { ok: boolean; detail: string } {
  const allDishes = collectAllDishes(dayPlan).filter(d => d.dishType !== 'dessert');
  const proteinTypes = new Set<string>();

  for (const dish of allDishes) {
    const ps = inferProteinSource(dish);
    if (ps !== 'none' && ps !== 'mixed') {
      proteinTypes.add(ps);
    }
    // 也检查 dishType
    if (dish.dishType === 'meat' || dish.dishType === 'egg') {
      for (const ing of dish.mainIngredients) {
        const cat = lookupFoodCategory(ing);
        if (cat === 'egg') proteinTypes.add('蛋类');
        else if (cat === 'fishSeafood') proteinTypes.add('鱼虾类');
        else if (cat === 'redMeat') proteinTypes.add('肉类');
        else if (cat === 'poultry') proteinTypes.add('禽肉');
        else if (cat === 'soyProduct') proteinTypes.add('豆制品');
      }
    }
  }

  // 检查蛋类是否过度集中
  const eggDishes = allDishes.filter(d => {
    return d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg');
  });
  if (eggDishes.length >= 3) {
    return {
      ok: false,
      detail: `蛋类出现在${eggDishes.length}餐中，过于集中。建议将其中1-2餐的蛋类替换为肉类、鱼类或豆制品`,
    };
  }

  // 检查是否只有单一蛋白来源
  const uniqueProteins = proteinTypes.size;
  if (uniqueProteins <= 1 && allDishes.filter(d => d.dishType !== 'staple').length >= 2) {
    return {
      ok: false,
      detail: `全天蛋白质来源单一（仅${uniqueProteins}种），建议增加肉类、鱼类、蛋类、豆制品的搭配`,
    };
  }

  // 理想：覆盖肉类+鱼类+蛋类+豆制品中的2-3种
  if (uniqueProteins >= 2) {
    return { ok: true, detail: `全天覆盖${uniqueProteins}种蛋白质来源，分布合理` };
  }

  return { ok: true, detail: '蛋白质分布基本合理' };
}

// ============================================================
// 4. 蔬菜多样性检查
// ============================================================

function checkVegetableDiversity(dayPlan: DayPlan): { ok: boolean; darkCount: number; lightCount: number; detail: string } {
  const allDishes = collectAllDishes(dayPlan);
  let darkCount = 0;
  let lightCount = 0;
  const darkVeggies = new Set<string>();
  const lightVeggies = new Set<string>();

  for (const dish of allDishes) {
    for (const ing of dish.mainIngredients) {
      const cat = lookupFoodCategory(ing);
      if (cat === 'darkVeg') {
        darkCount++;
        darkVeggies.add(ing);
      } else if (cat === 'lightVeg') {
        lightCount++;
        lightVeggies.add(ing);
      }
    }
  }

  if (darkCount === 0 && lightCount === 0) {
    return { ok: false, darkCount: 0, lightCount: 0, detail: '全天未安排蔬菜，建议午晚餐至少各安排一种蔬菜' };
  }

  if (darkCount > 0 && lightCount === 0) {
    return {
      ok: true,
      darkCount: darkVeggies.size,
      lightCount: 0,
      detail: `全天蔬菜以深色蔬菜为主（${[...darkVeggies].join('、')}），建议搭配一些浅色蔬菜丰富种类`,
    };
  }

  if (darkCount === 0 && lightCount > 0) {
    return {
      ok: true,
      darkCount: 0,
      lightCount: lightVeggies.size,
      detail: `全天蔬菜以浅色蔬菜为主（${[...lightVeggies].join('、')}），建议增加深色蔬菜（如西兰花、菠菜、胡萝卜），营养更丰富`,
    };
  }

  return {
    ok: true,
    darkCount: darkVeggies.size,
    lightCount: lightVeggies.size,
    detail: `深浅蔬菜搭配合理（深色${darkVeggies.size}种、浅色${lightVeggies.size}种），继续保持`,
  };
}

// ============================================================
// 5. 综合校验入口
// ============================================================

export function validateDayPlan(dayPlan: DayPlan, age: AgeGroup): DayPlanCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 主食多样性检查（仅1岁以上）
  const stapleResult = checkStapleDiversity(dayPlan);
  if (stapleResult.warning) {
    warnings.push(stapleResult.warning);
  }

  // 2. 核心食材重复检查
  const ingredientRepeats = checkIngredientRepeat(dayPlan);
  if (ingredientRepeats.length > 0) {
    warnings.push(...ingredientRepeats.map(r => `食材重复：${r}`));
  }

  // 3. 蛋白质分布检查（仅1岁以上）
  const proteinResult = checkProteinDistribution(dayPlan);
  if (!proteinResult.ok) {
    warnings.push(proteinResult.detail);
  }

  // 4. 蔬菜多样性检查
  const vegResult = checkVegetableDiversity(dayPlan);
  if (!vegResult.ok) {
    warnings.push(vegResult.detail);
  }

  // 5. 奶量提示
  const milkInfo = MILK_RECOMMENDATIONS[age];
  const milkTip = milkInfo
    ? `今日奶制品建议：${milkInfo.amount}/天。${milkInfo.description}。请结合宝宝实际饮奶情况安排。`
    : '请根据宝宝月龄合理安排奶制品摄入。';

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stapleWarning: stapleResult.warning,
    ingredientRepeat: ingredientRepeats,
    proteinDistribution: proteinResult,
    vegetableDiversity: vegResult,
    milkTip,
  };
}

// 导出子检查函数供 recipeGenerator 使用
export { checkStapleDiversity, checkIngredientRepeat, checkProteinDistribution, checkVegetableDiversity };
