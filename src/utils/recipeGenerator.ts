import { UserSettings, Recipe, WeeklyPlan, DayPlan, AgeGroup, MealPlan, MealType, DishType } from '../types';
import { recipes } from '../data/recipes';

// 根据用户设置生成一周食谱
export function generateWeeklyPlan(settings: UserSettings): WeeklyPlan {
  const availableRecipes = filterRecipes(settings);
  const weekUsedIds = new Set<string>();

  return {
    monday: createDayPlan(availableRecipes, settings, 'monday', weekUsedIds),
    tuesday: createDayPlan(availableRecipes, settings, 'tuesday', weekUsedIds),
    wednesday: createDayPlan(availableRecipes, settings, 'wednesday', weekUsedIds),
    thursday: createDayPlan(availableRecipes, settings, 'thursday', weekUsedIds),
    friday: createDayPlan(availableRecipes, settings, 'friday', weekUsedIds),
    saturday: createDayPlan(availableRecipes, settings, 'saturday', weekUsedIds),
    sunday: createDayPlan(availableRecipes, settings, 'sunday', weekUsedIds),
  };
}

// 筛选符合条件的食谱
function filterRecipes(settings: UserSettings): Record<DishType, Recipe[]> {
  const { babyAge, allergies, dislikes, likes } = settings;

  if (!babyAge) {
    return { staple: [], meat: [], vegetable: [], soup: [], egg: [], dessert: [] };
  }

  // 1. 根据年龄段筛选
  let filtered = recipes.filter(recipe => recipe.ageGroups.includes(babyAge));

  // 2. 排除过敏食物相关食谱
  if (allergies.length > 0) {
    filtered = filtered.filter(recipe => {
      return !recipe.mainIngredients.some(ingredient =>
        allergies.some(allergy =>
          ingredient.includes(allergy) || allergy.includes(ingredient)
        )
      );
    });
  }

  // 3. 根据喜好调整权重
  const weighted = filtered.map(recipe => {
    let weight = 1;

    // 降低不喜欢的食物权重
    if (dislikes.length > 0) {
      const hasDisliked = recipe.mainIngredients.some(ingredient =>
        dislikes.some(dislike =>
          ingredient.includes(dislike) || dislike.includes(ingredient)
        )
      );
      if (hasDisliked) weight *= 0.3;
    }

    // 提高喜欢的食物权重
    if (likes.length > 0) {
      const hasLiked = recipe.mainIngredients.some(ingredient =>
        likes.some(like =>
          ingredient.includes(like) || like.includes(ingredient)
        )
      );
      if (hasLiked) weight *= 2;
    }

    return { recipe, weight };
  });

  // 按菜品类型分组
  const grouped: Record<DishType, Recipe[]> = {
    staple: [],
    meat: [],
    vegetable: [],
    soup: [],
    egg: [],
    dessert: [],
  };

  for (const item of weighted) {
    grouped[item.recipe.dishType].push(item.recipe);
  }

  // 按权重排序
  for (const key of Object.keys(grouped) as DishType[]) {
    grouped[key].sort((a, b) => {
      const wA = weighted.find(w => w.recipe.id === a.id)!.weight;
      const wB = weighted.find(w => w.recipe.id === b.id)!.weight;
      return wB - wA;
    });
  }

  return grouped;
}

// 为一天创建三顿饭
function createDayPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  settings: UserSettings,
  dayKey: string,
  weekUsedIds: Set<string>
): DayPlan {
  const age = settings.babyAge!;
  const breakfast = createMealPlan(availableRecipes, 'breakfast', weekUsedIds, age);
  const lunch = createMealPlan(availableRecipes, 'lunch', weekUsedIds, age);
  const dinner = createMealPlan(availableRecipes, 'dinner', weekUsedIds, age);

  return { breakfast, lunch, dinner };
}

// 为一餐创建多道菜组合
function createMealPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  mealType: MealType,
  usedIds: Set<string>,
  babyAge: AgeGroup
): MealPlan {
  const dishes: Recipe[] = [];

  // 根据餐次和年龄选择菜品类型（科学控制每日肉蛋菜总量）
  let requiredTypes: DishType[] = [];
  let optionalTypes: DishType[] = [];
  let optionalProbability = 0.5;

  // 年龄段分组
  const isBaby = babyAge === '6-8m' || babyAge === '9-11m';
  const isToddler = babyAge === '1-2y';

  if (mealType === 'breakfast') {
    if (isBaby) {
      // 婴儿早餐：主食为主，蛋类可选（每日最多1个蛋）
      requiredTypes = ['staple'];
      optionalTypes = ['egg'];
      optionalProbability = 0.5;
    } else {
      // 幼儿及以上：主食+蛋（每日固定1个蛋），蔬果/点心最多选1种
      requiredTypes = ['staple', 'egg'];
      optionalTypes = ['dessert', 'vegetable'];
    }
  } else if (mealType === 'lunch') {
    if (isBaby) {
      // 婴儿午餐：主食为主，荤菜和素菜可选
      requiredTypes = ['staple'];
      optionalTypes = ['meat', 'vegetable'];
      optionalProbability = 0.5;
    } else if (isToddler) {
      // 1-2岁午餐：主食+荤菜+素菜+汤（标配），蛋可选
      requiredTypes = ['staple', 'meat', 'vegetable', 'soup'];
      optionalTypes = ['egg'];
      optionalProbability = 0.25;
    } else {
      // 2岁以上午餐：主食+荤菜+素菜+汤（标配），蛋可选
      requiredTypes = ['staple', 'meat', 'vegetable', 'soup'];
      optionalTypes = ['egg'];
      optionalProbability = 0.3;
    }
  } else {
    // 晚餐
    if (isBaby) {
      // 婴儿晚餐：主食为主，素菜可选，荤菜偶尔（每日最多1次荤）
      requiredTypes = ['staple'];
      optionalTypes = ['vegetable', 'meat'];
      optionalProbability = 0.3;
    } else if (isToddler) {
      // 1-2岁晚餐：主食+素菜，荤菜可选（午餐已吃荤，晚餐清淡）
      requiredTypes = ['staple', 'vegetable'];
      optionalTypes = ['meat', 'soup'];
      optionalProbability = 0.3;
    } else {
      // 2岁以上晚餐：主食+荤菜+素菜，汤较常见
      requiredTypes = ['staple', 'meat', 'vegetable'];
      optionalTypes = ['soup'];
      optionalProbability = 0.4;
    }
  }

  // 过滤掉整周已使用的食谱
  // 早餐专属食物：泥糊类、水果类、典型早餐（不应出现在午晚餐）
  const isBreakfastOnly = (r: Recipe) => {
    const name = r.name;
    if (name.includes('泥') || name.includes('糊') || r.category === '水果') return true;
    // 典型早餐专属：面点、简单蛋类、甜点
    const breakfastOnlyNames = [
      '鸡蛋饼', '葱油饼', '豆浆', '豆腐脑', '茶叶蛋', '蛋卷',
      '小馒头', '馒头', '花卷',           // 面点
      '白煮蛋', '水煮蛋', '蒸蛋', '鸡蛋羹', '蒸蛋羹', // 简单蛋类
      '南瓜饼', '紫薯饼', '山药糕', '红豆沙', '绿豆糕', // 点心甜食
      '包子',                             // 早餐面点
    ];
    if (breakfastOnlyNames.includes(name)) return true;
    // 粥类：仅当食谱不适合6-8m/9-11m婴儿时（即1岁以上专属），才从午晚餐排除
    // 因为小婴儿全天都需要粥
    if (name.includes('粥')) {
      const isBabyRecipe = r.ageGroups.some(ag => ag === '6-8m' || ag === '9-11m');
      if (!isBabyRecipe) return true;
    }
    return false;
  };

  // 午晚餐专属主食：米饭类、炒饭类、复杂面类（不应出现在早餐）
  const isLunchDinnerOnlyStaple = (r: Recipe) => {
    const name = r.name;
    if ((name.includes('米饭') || name.endsWith('饭')) && !name.includes('粥')) return true;
    if (name.includes('炒饭')) return true;
    if (name.includes('拌面') || name.includes('炸酱') || name.includes('凉面') ||
        name.includes('肉酱面') || name.includes('牛肉面') || name.includes('阳春面') ||
        name.includes('鸡丝面') || name.includes('肉丝面') || name.includes('番茄面') ||
        name.includes('番茄鸡蛋面') || name.includes('番茄牛肉面') || name.includes('肉末粉丝')) return true;
    return false;
  };

  // 判断主食是否为"复合主食"（本身含肉/鱼/蛋/豆腐，无需额外配荤菜）
const MEAT_INGREDIENTS = ['猪肉', '牛肉', '鸡肉', '羊肉', '虾仁', '虾', '虾皮', '鱼', '鳕鱼', '三文鱼',
  '猪肝', '鸡肝', '排骨', '牛腩', '肉末', '肉', '火腿', '鸭肉', '香肠',
  '鸡蛋', '蛋', '豆腐', '豆腐干', '虾皮'];
const VEGETABLE_INGREDIENTS = ['白菜', '青菜', '菠菜', '油菜', '生菜', '西兰花', '菜花', '胡萝卜',
  '白萝卜', '土豆', '番茄', '西红柿', '黄瓜', '茄子', '南瓜', '冬瓜', '丝瓜', '苦瓜',
  '芹菜', '韭菜', '豆芽', '青椒', '彩椒', '洋葱', '玉米', '豌豆', '毛豆', '四季豆',
  '山药', '红薯', '紫薯', '芋头', '莲藕', '蘑菇', '香菇', '木耳', '银耳', '海带',
  '紫菜', '西葫芦', '芦笋', '茭白', '秋葵', '空心菜', '娃娃菜', '油麦菜', '菜心', '菜'];

const isCompositeStaple = (r: Recipe): boolean => {
  return r.mainIngredients.some(ing => MEAT_INGREDIENTS.some(mi => ing.includes(mi)));
};

const hasVegetables = (r: Recipe): boolean => {
  return r.mainIngredients.some(ing => VEGETABLE_INGREDIENTS.some(vi => ing.includes(vi)));
};

// 构建过滤后的各类型菜品列表
  const filterByMeal = (recipes: Recipe[]) => {
    const filtered = recipes.filter(r => {
      if (usedIds.has(r.id)) return false;
      if (mealType === 'breakfast' && isLunchDinnerOnlyStaple(r)) return false;
      if (mealType !== 'breakfast' && isBreakfastOnly(r)) return false;
      return true;
    });
    // 婴儿阶段（6-8m, 9-11m）食谱池小，过滤后为空时允许复用
    if (filtered.length === 0 && isBaby) {
      return recipes.filter(r => {
        if (mealType === 'breakfast' && isLunchDinnerOnlyStaple(r)) return false;
        if (mealType !== 'breakfast' && isBreakfastOnly(r)) return false;
        return true;
      });
    }
    return filtered;
  };

  const dayFiltered: Record<DishType, Recipe[]> = {
    staple: filterByMeal(availableRecipes.staple),
    meat: filterByMeal(availableRecipes.meat),
    vegetable: filterByMeal(availableRecipes.vegetable),
    soup: filterByMeal(availableRecipes.soup),
    egg: filterByMeal(availableRecipes.egg),
    dessert: filterByMeal(availableRecipes.dessert),
  };

  // 先选主食，检测是否为复合主食（含肉/蛋/豆腐）
  let hasCompositeStaple = false;
  let stapleHasVeggie = false;
  const stapleRecipe = pickWeightedRecipe(dayFiltered.staple, usedIds);
  if (stapleRecipe) {
    dishes.push(stapleRecipe);
    usedIds.add(stapleRecipe.id);
    hasCompositeStaple = isCompositeStaple(stapleRecipe);
    stapleHasVeggie = hasVegetables(stapleRecipe);
  }

  // 如果主食已经含荤（馄饨、饺子、包子、炒饭、肉面等），跳过荤菜
  if (hasCompositeStaple && mealType !== 'breakfast') {
    requiredTypes = requiredTypes.filter(t => t !== 'meat');
    optionalTypes = optionalTypes.filter(t => t !== 'meat');
  }
  // 如果主食已含蔬菜（春卷、菜肉馄饨等），素菜改为可选
  if (stapleHasVeggie && mealType !== 'breakfast') {
    if (requiredTypes.includes('vegetable')) {
      requiredTypes = requiredTypes.filter(t => t !== 'vegetable');
      if (!optionalTypes.includes('vegetable')) {
        optionalTypes.push('vegetable');
      }
    }
  }
  // 午餐补偿：复合主食减少了菜品，用蛋类补位保持丰盛
  if (mealType === 'lunch' && hasCompositeStaple) {
    if (!requiredTypes.includes('egg') && !optionalTypes.includes('egg')) {
      if (stapleHasVeggie) {
        requiredTypes.push('egg');
      } else {
        optionalTypes.push('egg');
        optionalProbability = 0.6;
      }
    }
  }
  // 晚餐补偿：复合主食时汤变必选，保证至少有汤配主食
  if (mealType === 'dinner' && hasCompositeStaple) {
    if (optionalTypes.includes('soup')) {
      optionalTypes = optionalTypes.filter(t => t !== 'soup');
      if (!requiredTypes.includes('soup')) {
        requiredTypes.push('soup');
      }
    }
  }

  // 剩余必需菜品
  for (const type of requiredTypes) {
    if (type === 'staple') continue; // 主食已选
    const recipe = pickWeightedRecipe(dayFiltered[type], usedIds);
    if (recipe) {
      dishes.push(recipe);
      usedIds.add(recipe.id);
    }
  }

  // 可选菜品（按概率添加）
  // 早餐：可选蔬果和点心，但最多只选一种，避免营养过剩
  if (mealType === 'breakfast' && optionalTypes.length > 0) {
    if (Math.random() < 0.5) {
      // 从可选中随机选一种
      const shuffled = [...optionalTypes].sort(() => Math.random() - 0.5);
      for (const type of shuffled) {
        const recipe = pickWeightedRecipe(dayFiltered[type], usedIds);
        if (recipe) {
          dishes.push(recipe);
          usedIds.add(recipe.id);
          break; // 只选一种
        }
      }
    }
  } else {
    for (const type of optionalTypes) {
      if (Math.random() < optionalProbability) {
        const recipe = pickWeightedRecipe(dayFiltered[type], usedIds);
        if (recipe) {
          dishes.push(recipe);
          usedIds.add(recipe.id);
        }
      }
    }
  }

  return { dishes };
}

// 根据权重选择食谱（加权随机选择，让偏好食物更易出现）
// 如果 filteredList 为空（所有食谱都已使用过），则返回 null
function pickWeightedRecipe(filteredList: Recipe[], usedIds: Set<string>): Recipe | null {
  if (filteredList.length === 0) return null;
  // 对候选列表进行洗牌，然后从中随机选一个
  const shuffled = [...filteredList].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

// 根据用户提供的食材，搜索匹配的食谱并按匹配度排序
export function findRecipesByIngredients(
  settings: UserSettings,
  ingredientNames: string[]
): Recipe[] {
  const availableRecipes = filterRecipes(settings);
  const allRecipes = [
    ...availableRecipes.staple,
    ...availableRecipes.meat,
    ...availableRecipes.vegetable,
    ...availableRecipes.soup,
    ...availableRecipes.egg,
    ...availableRecipes.dessert,
  ];

  // 计算每个食谱与输入食材的匹配度
  const scored = allRecipes.map(r => {
    const matchCount = ingredientNames.filter(ing =>
      r.mainIngredients.some(mi => mi.includes(ing)) ||
      r.ingredients.some(i => i.name.includes(ing))
    ).length;
    return { recipe: r, score: matchCount };
  });

  // 过滤至少匹配一个食材的，按匹配度降序排列
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.recipe);
}

// 重新生成单个菜品（同一类型替换）
export function regenerateDish(
  settings: UserSettings,
  usedRecipes: Recipe[],
  dishType: DishType
): Recipe | null {
  const availableRecipes = filterRecipes(settings);
  const usedIds = new Set(usedRecipes.map(r => r.id));

  const pool = availableRecipes[dishType].filter(r => !usedIds.has(r.id));
  return pickWeightedRecipe(pool, usedIds);
}

// 重新生成单餐食谱
export function regenerateMeal(
  settings: UserSettings,
  usedRecipes: Recipe[],
  mealType: MealType
): MealPlan {
  const availableRecipes = filterRecipes(settings);
  const usedIds = new Set(usedRecipes.map(r => r.id));

  // 从可用食谱中过滤掉已使用的
  const filtered: Record<DishType, Recipe[]> = {
    staple: availableRecipes.staple.filter(r => !usedIds.has(r.id)),
    meat: availableRecipes.meat.filter(r => !usedIds.has(r.id)),
    vegetable: availableRecipes.vegetable.filter(r => !usedIds.has(r.id)),
    soup: availableRecipes.soup.filter(r => !usedIds.has(r.id)),
    egg: availableRecipes.egg.filter(r => !usedIds.has(r.id)),
    dessert: availableRecipes.dessert.filter(r => !usedIds.has(r.id)),
  };

  return createMealPlan(filtered, mealType, usedIds, settings.babyAge!);
}

// 交换午餐和晚餐
export function swapMeals(dayPlan: DayPlan): DayPlan {
  return {
    ...dayPlan,
    lunch: dayPlan.dinner,
    dinner: dayPlan.lunch,
  };
}

// 创建自定义食谱
export function createCustomRecipe(
  name: string,
  ingredients: string,
  steps: string,
  ageGroup: AgeGroup,
  dishType: DishType = 'meat'
): Recipe {
  // 解析食材
  const ingredientList = ingredients.split('\n').filter(line => line.trim()).map(line => {
    const parts = line.split(/[,，:：]/);
    return {
      name: parts[0]?.trim() || line.trim(),
      amount: parts[1]?.trim() || '适量',
    };
  });

  // 解析步骤
  const stepList = steps.split('\n').filter(line => line.trim());

  return {
    id: `custom-${Date.now()}`,
    name: name.trim(),
    ingredients: ingredientList,
    steps: stepList,
    ageGroups: [ageGroup],
    tags: ['自定义'],
    category: '自定义',
    dishType,
    nutrition: '自定义食谱',
    mainIngredients: ingredientList.map(i => i.name),
  };
}