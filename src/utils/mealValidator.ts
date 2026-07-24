import { Recipe, AgeGroup, MealType, ProteinSource, TextureLevel, AGE_TEXTURE_RULES, AGE_EGG_RULES, AGE_MEAL_STRUCTURE, NutritionTag } from '../types';
import { lookupFoodCategory, isMeatOrEggLike, isVegetableCategory, FoodCategory } from './foodDictionary';
import { isAge12Plus, is6to8m, is9to11m, isOver2 } from './ageRules';

// ============================================================
// 食物形态推断
// ============================================================

/** 从食谱名称和食材推断食物形态 */
export function inferTextureLevel(recipe: Recipe): TextureLevel {
  const name = recipe.name;
  // 泥状
  if (name.includes('泥') && !name.includes('土豆泥') && !name.includes('土豆')) return 'puree';
  // 糊状
  if (name.includes('糊') || name.includes('米糊')) return 'paste';
  // 小块/碎末（9-11月龄常见）
  if (name.includes('末') || name.includes('碎') || name.includes('丁') || name.includes('块')) return 'chunky';
  // 默认家庭餐形式
  return 'family';
}

// ============================================================
// 年龄适配检查
// ============================================================

/** 获取食谱的实际食物质地 */
export function getRecipeTexture(recipe: Recipe): TextureLevel {
  return recipe.textureLevel || inferTextureLevel(recipe);
}

/** 判断食物质地是否适合当前年龄段 */
export function isTextureAllowedForAge(recipe: Recipe, age: AgeGroup): boolean {
  const texture = getRecipeTexture(recipe);
  const rule = AGE_TEXTURE_RULES[age];
  if (!rule) return true;
  // 如果明确在禁止列表中
  if (rule.forbidden.includes(texture)) return false;
  return true;
}

/** 判断是否为单独蛋黄类食谱（6-11月龄适用，12个月以上禁止） */
export function isYolkOnlyRecipe(recipe: Recipe): boolean {
  const name = recipe.name;
  if (name === '蛋黄泥') return true;
  // 名字含"蛋黄"但属于全蛋做法时不判为蛋黄专属
  if (name.includes('蛋黄') &&
      !name.includes('炒蛋') && !name.includes('蒸蛋羹') &&
      !name.includes('番茄炒蛋') && !name.includes('蛋花') &&
      !name.includes('蛋羹') && !name.includes('全蛋')) {
    return true;
  }
  return false;
}

/** 判断食谱是否适合宝宝当前年龄段的鸡蛋规则 */
export function isEggAllowedForAge(recipe: Recipe, age: AgeGroup): boolean {
  // 不含鸡蛋的食谱不受限
  if (!recipe.mainIngredients.includes('鸡蛋') && !recipe.mainIngredients.includes('蛋')) return true;

  const eggRule = AGE_EGG_RULES[age];
  const isYolkOnly = isYolkOnlyRecipe(recipe);

  if (eggRule === 'yolk_only') {
    // 6-11月：允许蛋黄泥、蒸蛋羹等
    return true; // 这个阶段蛋黄和全蛋都可以，不做限制
  }
  if (eggRule === 'whole_egg' || eggRule === 'full_egg_dishes') {
    // 1岁以上：禁止单独蛋黄类食谱
    if (isYolkOnly) return false;
    return true;
  }
  return true;
}

/** 综合判断食谱是否适合当前年龄段（形态+鸡蛋规则） */
export function isRecipeAgeCompatible(recipe: Recipe, age: AgeGroup): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // 检查食物质地
  if (!isTextureAllowedForAge(recipe, age)) {
    const texture = getRecipeTexture(recipe);
    reasons.push(`食物质地"${texture}"不适合${age}年龄段`);
  }

  // 检查鸡蛋规则
  if (!isEggAllowedForAge(recipe, age)) {
    reasons.push(`蛋黄类食谱不适合${age}年龄段，应使用全蛋料理`);
  }

  return { compatible: reasons.length === 0, reasons };
}

// ============================================================
// 蛋白质来源推断
// ============================================================

const PROTEIN_KEYWORDS: Record<string, ProteinSource> = {
  '猪肉': 'pork', '排骨': 'pork', '猪肝': 'pork', '猪蹄': 'pork', '火腿': 'pork', '肉末': 'pork',
  '牛肉': 'beef', '牛腩': 'beef',
  '鸡肉': 'chicken', '鸡': 'chicken',
  '鱼': 'fish', '三文鱼': 'fish', '鳕鱼': 'fish', '鲈鱼': 'fish', '龙利鱼': 'fish', '带鱼': 'fish',
  '虾': 'shrimp', '虾仁': 'shrimp',
  '鸡蛋': 'egg', '蛋': 'egg',
  '豆腐': 'tofu', '豆腐干': 'tofu', '腐竹': 'tofu',
};

/** 从食谱推断主要蛋白质来源 */
export function inferProteinSource(recipe: Recipe): ProteinSource {
  if (recipe.proteinSource && recipe.proteinSource !== 'none') {
    return recipe.proteinSource;
  }

  const sources = new Set<ProteinSource>();
  for (const ing of recipe.mainIngredients) {
    for (const [keyword, source] of Object.entries(PROTEIN_KEYWORDS)) {
      if (ing.includes(keyword)) {
        sources.add(source);
      }
    }
  }

  if (sources.size === 0) return 'none';
  if (sources.size === 1) return [...sources][0];
  return 'mixed';
}

// ============================================================
// 单餐结构校验
// ============================================================

/** 获取该年龄段单餐推荐菜品数量 */
export function getMealDishLimit(age: AgeGroup, mealType: MealType): { min: number; max: number } {
  const structure = AGE_MEAL_STRUCTURE[age];
  if (!structure) return { min: 1, max: 1 };

  // 1岁以下每餐只有1道菜（复合主食或单一辅食）
  if (is6to8m(age) || is9to11m(age)) return { min: 1, max: 1 };

  return { min: structure.minTotalDishes, max: structure.maxTotalDishes };
}

// ============================================================
// 主食重复检测
// ============================================================

/** 判断两个主食是否属于同一子类（导致重复） */
function getStapleSubCategory(name: string): string {
  // 面食类
  if (name.includes('面') && !name.includes('面包')) return 'noodle';
  // 粥类
  if (name.includes('粥') || name.includes('米糊')) return 'porridge';
  // 米饭类
  if (name.includes('米饭') || name.endsWith('饭')) return 'rice';
  // 馒头/饼/卷
  if (name.includes('馒头') || name.includes('花卷') || name.includes('饼') || name.includes('卷')) return 'bun';
  // 饺子/馄饨/包子
  if (name.includes('饺子') || name.includes('馄饨') || name.includes('包子')) return 'dumpling';
  // 薯类主食
  if (name.includes('红薯') || name.includes('紫薯') || name.includes('土豆泥')) return 'tuber';
  return 'other_staple';
}

/** 检测同餐中是否存在重复主食 */
export function hasDuplicateStaple(dishes: Recipe[]): { conflict: boolean; stapleNames: string[] } {
  const stapleDishes = dishes.filter(d => d.dishType === 'staple');
  if (stapleDishes.length <= 1) return { conflict: false, stapleNames: [] };

  const subCategories = stapleDishes.map(d => getStapleSubCategory(d.name));
  const seen = new Set<string>();
  const dupNames: string[] = [];

  for (let i = 0; i < stapleDishes.length; i++) {
    const sub = subCategories[i];
    if (seen.has(sub)) {
      dupNames.push(stapleDishes[i].name);
    } else {
      seen.add(sub);
    }
  }

  return { conflict: dupNames.length > 0, stapleNames: dupNames };
}

// ============================================================
// 蛋白质堆叠检测
// ============================================================

/** 检测同餐中蛋白质来源是否过度堆叠 */
export function hasExcessiveProtein(dishes: Recipe[]): { overloaded: boolean; proteinSources: ProteinSource[] } {
  const sources = new Set<ProteinSource>();
  for (const dish of dishes) {
    const source = inferProteinSource(dish);
    if (source !== 'none') {
      sources.add(source);
    }
  }

  const stapleHasProtein = dishes.some(d => d.dishType === 'staple' && inferProteinSource(d) !== 'none');

  if (stapleHasProtein && sources.size > 2) {
    return { overloaded: true, proteinSources: [...sources] };
  }
  if (!stapleHasProtein && sources.size > 1) {
    return { overloaded: true, proteinSources: [...sources] };
  }

  return { overloaded: false, proteinSources: [...sources] };
}

// ============================================================
// 综合校验（支持全年龄段）
// ============================================================

export interface MealValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMeal(
  dishes: Recipe[],
  age: AgeGroup,
  mealType: MealType,
): MealValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (dishes.length === 0) {
    errors.push('该餐暂无菜品推荐');
    return { valid: false, errors, warnings };
  }

  // 检查1：年龄适配 - 食物质地
  for (const dish of dishes) {
    const textureCheck = isRecipeAgeCompatible(dish, age);
    if (!textureCheck.compatible) {
      errors.push(...textureCheck.reasons.map(r => `"${dish.name}"：${r}`));
    }
  }

  // 检查2：鸡蛋规则 - 1岁以上禁止单独蛋黄
  if (isAge12Plus(age)) {
    for (const dish of dishes) {
      if (isYolkOnlyRecipe(dish)) {
        errors.push(`"${dish.name}"为蛋黄类食谱，${age}宝宝应使用全蛋料理，请替换`);
      }
    }
  }

  // 检查3：主食重复（1岁以上适用）
  if (isAge12Plus(age)) {
    const stapleCheck = hasDuplicateStaple(dishes);
    if (stapleCheck.conflict) {
      errors.push(`同餐出现重复主食：${stapleCheck.stapleNames.join('、')}，请保留一个主食（每餐主食×1）`);
    }
  }

  // 检查4：蛋白质堆叠（1岁以上适用）
  if (isAge12Plus(age)) {
    const proteinCheck = hasExcessiveProtein(dishes);
    if (proteinCheck.overloaded) {
      errors.push(`蛋白质来源过多（${proteinCheck.proteinSources.join('、')}），建议每餐选择1种主要蛋白质`);
    }
  }

  // 检查5：一餐数量检查
  const limit = getMealDishLimit(age, mealType);
  const mainDishes = dishes.filter(d => d.dishType !== 'dessert');
  if (mainDishes.length > limit.max) {
    errors.push(`菜品数量(${mainDishes.length}道)超过${age}年龄段${mealType === 'breakfast' ? '早餐' : '正餐'}限制(${limit.max}道)，请精简`);
  }
  if (!is6to8m(age) && !is9to11m(age) && mainDishes.length < limit.min) {
    warnings.push(`菜品偏少(${mainDishes.length}道)，建议至少${limit.min}道菜以保证营养`);
  }

  // 检查6：1岁以上检查单餐主食数量
  if (isAge12Plus(age)) {
    const stapleCount = dishes.filter(d => d.dishType === 'staple').length;
    if (stapleCount > 1) {
      errors.push(`同餐主食数量(${stapleCount}个)超过限制，每餐仅需1个主食`);
    }
    if (stapleCount === 0) {
      errors.push('该餐缺少主食，每餐应包含1个主食');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// 自动修正辅助函数
// ============================================================

/** 从菜品列表中移除不适合当前年龄段的菜品 */
export function filterAgeIncompatible(dishes: Recipe[], age: AgeGroup): Recipe[] {
  return dishes.filter(d => isRecipeAgeCompatible(d, age).compatible);
}

/** 从菜品列表中移除重复主食，保留第一个 */
export function removeDuplicateStaples(dishes: Recipe[]): Recipe[] {
  const result: Recipe[] = [];
  const seenSubCat = new Set<string>();

  for (const dish of dishes) {
    if (dish.dishType === 'staple') {
      const sub = getStapleSubCategory(dish.name);
      if (seenSubCat.has(sub)) continue;
      seenSubCat.add(sub);
    }
    result.push(dish);
  }

  return result;
}

/** 减少蛋白质来源到1种，优先保留复合主食自带的蛋白质 */
export function reduceProteinSources(dishes: Recipe[]): Recipe[] {
  const sources = new Map<ProteinSource, Recipe[]>();
  for (const dish of dishes) {
    const source = inferProteinSource(dish);
    if (source !== 'none') {
      const existing = sources.get(source) || [];
      existing.push(dish);
      sources.set(source, existing);
    }
  }

  if (sources.size <= 1) return dishes;

  const stapleSource = dishes.find(d => d.dishType === 'staple' && inferProteinSource(d) !== 'none');
  let keepSource: ProteinSource | null = null;

  if (stapleSource) {
    keepSource = inferProteinSource(stapleSource);
  } else {
    const proteinDish = dishes.find(d =>
      d.dishType === 'meat' || d.dishType === 'egg' || d.dishType === 'soup'
    );
    if (proteinDish) {
      keepSource = inferProteinSource(proteinDish);
    }
  }

  if (!keepSource) return dishes;

  return dishes.filter(d => {
    const s = inferProteinSource(d);
    if (s !== 'none' && s !== keepSource) {
      if (d.dishType === 'staple') return true;
      return false;
    }
    return true;
  });
}

/** 控制菜品数量，超出限制时优先移除甜品，其次移除汤品 */
export function limitDishCount(dishes: Recipe[], maxCount: number): Recipe[] {
  const mainDishes = dishes.filter(d => d.dishType !== 'dessert');

  if (mainDishes.length <= maxCount) return dishes;

  const removalPriority: Record<string, number> = {
    dessert: 0,
    soup: 1,
    vegetable: 2,
    egg: 3,
  };

  const sorted = [...dishes].sort((a, b) => {
    const pa = removalPriority[a.dishType] ?? 10;
    const pb = removalPriority[b.dishType] ?? 10;
    return pa - pb;
  });

  return sorted.slice(0, maxCount);
}

// ============================================================
// 向后兼容的旧接口（保持已有引用不报错）
// ============================================================

/** @deprecated 使用 validateMeal 代替 */
export function validateMealFor12Plus(
  dishes: Recipe[],
  mealType: MealType,
): MealValidationResult {
  // 使用1-2y作为默认12+年龄段
  return validateMeal(dishes, '1-2y', mealType);
}

/** @deprecated 使用 isRecipeAgeCompatible 代替 */
export function isTextureForbiddenForAge12Plus(recipe: Recipe): boolean {
  return !isRecipeAgeCompatible(recipe, '1-2y').compatible;
}

/** @deprecated 使用 filterAgeIncompatible 代替 */
export function filterForbiddenDishes(dishes: Recipe[]): Recipe[] {
  return filterAgeIncompatible(dishes, '1-2y');
}

// ============================================================
// 营养标签派生
// ============================================================

/**
 * 食物类型标签优先级（数字越小越优先保留）
 * 蔬菜标签必须保留（用户需求：所有蔬菜都应有标签）
 * 含铁食材/谷豆搭配等为次级标签，空间不足时可被裁剪
 */
const FOOD_TAG_PRIORITY: Record<NutritionTag, number> = {
  '主食来源': 1,
  '优质蛋白': 1,
  '深色蔬菜': 1,   // 必须保留
  '蔬菜来源': 1,   // 必须保留
  '水果来源': 1,
  '奶类来源': 1,
  '含铁食材': 2,   // 次级，可裁剪
  '谷豆搭配': 2,   // 次级，可裁剪
  '蒸制': 0,
  '炖煮': 0,
  '少油烹饪': 0,
  '易咀嚼': 0,
};

/** 从食谱数据派生出营养标签（1-3个） */
export function deriveNutritionTags(recipe: Recipe): NutritionTag[] {
  const name = recipe.name;
  const ingredientCats = recipe.mainIngredients.map(ing => lookupFoodCategory(ing));

  const hasStaple = recipe.dishType === 'staple' || ingredientCats.includes('staple');
  const hasRedMeat = ingredientCats.includes('redMeat');
  const hasPoultry = ingredientCats.includes('poultry');
  const hasFish = ingredientCats.includes('fishSeafood');
  const hasEgg = ingredientCats.includes('egg');
  const hasTofu = ingredientCats.includes('soyProduct');
  const hasProtein = hasRedMeat || hasPoultry || hasFish || hasEgg || hasTofu;
  const hasDarkVeg = ingredientCats.includes('darkVeg');
  const hasLightVeg = ingredientCats.includes('lightVeg');
  const hasAnyVeg = hasDarkVeg || hasLightVeg;
  const hasFruit = ingredientCats.includes('fruit');
  const hasDairy = ingredientCats.includes('dairy');

  // ============================================================
  // 第一步：收集所有候选食物类型标签
  // ============================================================
  const candidates: NutritionTag[] = [];

  if (hasStaple) candidates.push('主食来源');
  if (hasProtein) candidates.push('优质蛋白');
  if (hasRedMeat) candidates.push('含铁食材');

  // 蔬菜（深色优先）
  if (hasDarkVeg) {
    candidates.push('深色蔬菜');
  } else if (hasLightVeg) {
    candidates.push('蔬菜来源');
  }

  if (hasFruit) candidates.push('水果来源');
  if (hasDairy) candidates.push('奶类来源');
  if (hasStaple && hasTofu) candidates.push('谷豆搭配');

  // ============================================================
  // 第二步：按优先级裁剪至最多3个
  //   核心标签（优先级1）不可裁剪：主食来源/优质蛋白/蔬菜/水果/奶类
  //   次级标签（优先级2）可裁剪：含铁食材/谷豆搭配
  // ============================================================
  let foodTags: NutritionTag[];
  if (candidates.length <= 3) {
    foodTags = candidates;
  } else {
    // 先保留所有优先级1的标签
    const priority1 = candidates.filter(t => FOOD_TAG_PRIORITY[t] === 1);
    const priority2 = candidates.filter(t => FOOD_TAG_PRIORITY[t] === 2);

    if (priority1.length >= 3) {
      // 核心标签已满3个，舍弃所有次级标签
      foodTags = priority1.slice(0, 3);
    } else {
      // 核心标签不足3个，用次级标签填充
      const slotsLeft = 3 - priority1.length;
      foodTags = [...priority1, ...priority2.slice(0, slotsLeft)];
    }
  }

  // ============================================================
  // 第三步：兜底 - 没有任何食物标签时按 dishType 补充
  // ============================================================
  if (foodTags.length === 0) {
    if (recipe.dishType === 'staple') {
      foodTags.push('主食来源');
    } else if (recipe.dishType === 'meat' || recipe.dishType === 'egg') {
      foodTags.push('优质蛋白');
    } else if (recipe.dishType === 'vegetable') {
      foodTags.push('蔬菜来源');
    } else if (recipe.dishType === 'soup') {
      foodTags.push('优质蛋白');
    } else if (recipe.dishType === 'dessert') {
      foodTags.push('水果来源');
    }
  }

  // ============================================================
  // 第四步：补充烹饪特点标签（辅助标签，填满余位）
  // ============================================================
  const tags = [...foodTags];

  if (tags.length < 3) {
    if (name.includes('蒸')) {
      tags.push('蒸制');
    } else if (name.includes('炖') || name.includes('煲')) {
      tags.push('炖煮');
    } else if (
      (name.includes('清炒') || name.includes('白灼') || name.includes('凉拌') ||
       name.includes('煮') || name.includes('焯')) &&
      !name.includes('红烧') && !name.includes('炸')
    ) {
      tags.push('少油烹饪');
    } else if (
      recipe.textureLevel === 'puree' || recipe.textureLevel === 'paste' ||
      name.includes('泥') || name.includes('糊') || name.includes('羹')
    ) {
      tags.push('易咀嚼');
    }
  }

  // 烹饪标签不能是唯一标签：补充食物类型
  if (tags.length === 1) {
    const cookingTags: NutritionTag[] = ['蒸制', '炖煮', '少油烹饪', '易咀嚼'];
    if (cookingTags.includes(tags[0])) {
      const fallback = recipe.dishType === 'staple' ? '主食来源'
        : recipe.dishType === 'vegetable' ? '蔬菜来源'
        : recipe.dishType === 'dessert' ? '水果来源'
        : recipe.dishType === 'soup' ? '优质蛋白'
        : '优质蛋白';
      tags.unshift(fallback as NutritionTag);
    }
  }

  return tags.slice(0, 3);
}

// ============================================================
// 必选项检查（每餐必须包含的营养模块）
// ============================================================

export interface MealMandatoryCheck {
  stapleOk: boolean;     // 主食 ✅
  proteinOk: boolean;    // 蛋白质 ✅
  vegetableOk: boolean;  // 蔬菜 ✅
  allOk: boolean;
  missingLabels: string[];
  /** 早餐：奶/水果推荐建议（非必须） */
  breakfastSuggestions: string[];
}

/** 检查一餐是否满足必选营养模块 */
export function checkMealMandatory(dishes: Recipe[], age: AgeGroup, mealType: MealType): MealMandatoryCheck {
  const isBreakfast = mealType === 'breakfast';
  const isOver1 = isAge12Plus(age);

  // 1岁以下不做此检查（辅食模式不同）
  if (!isOver1) {
    return { stapleOk: true, proteinOk: true, vegetableOk: true, allOk: true, missingLabels: [], breakfastSuggestions: [] };
  }

  const stapleOk = dishes.some(d => d.dishType === 'staple');

  const proteinOk = dishes.some(d => {
    if (d.dishType === 'meat' || d.dishType === 'egg') return true;
    if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
    if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
    return false;
  });

  const vegetableOk = dishes.some(d => {
    // 任何 vegetable 类型的菜品即算蔬菜（包括土豆丝、烧豆腐等）
    if (d.dishType === 'vegetable') return true;
    // 或食材中包含深色/浅色蔬菜、或常用作蔬菜的食材
    return d.mainIngredients.some(ing => {
      const cat = lookupFoodCategory(ing);
      if (isVegetableCategory(cat)) return true;
      // 土豆、山药、红薯、南瓜等虽分类为staple但常作蔬菜用
      if (cat === 'staple' && ['土豆', '山药', '红薯', '南瓜', '紫薯', '玉米'].includes(ing)) return true;
      return false;
    });
  });

  // 早餐推荐建议（非必须）：检查奶/水果
  const breakfastSuggestions: string[] = [];
  if (isBreakfast) {
    const hasFruit = dishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'fruit'));
    const hasDairy = dishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'dairy'));
    if (!hasDairy && !hasFruit) {
      breakfastSuggestions.push('建议搭配奶制品或水果，提高早餐丰富度');
    } else if (!hasDairy) {
      breakfastSuggestions.push('建议搭配奶制品（牛奶/酸奶），补充钙质');
    } else if (!hasFruit) {
      breakfastSuggestions.push('建议搭配水果，补充维生素');
    }
  }

  const missingLabels: string[] = [];
  if (!stapleOk) missingLabels.push('主食');
  if (!proteinOk) missingLabels.push('蛋白质');
  if (!vegetableOk) missingLabels.push('蔬菜');

  return {
    stapleOk,
    proteinOk,
    vegetableOk,
    allOk: missingLabels.length === 0,
    missingLabels,
    breakfastSuggestions,
  };
}

// ============================================================
// 蛋白质类型 & 易消化度
// ============================================================

/** 蛋白质类型（用于推荐排序） */
export type ProteinType = 'red_meat' | 'poultry' | 'fish' | 'shrimp' | 'egg' | 'tofu' | 'none';

/** 从食谱推导蛋白质类型 */
export function getProteinType(recipe: Recipe): ProteinType {
  const protein = inferProteinSource(recipe);
  switch (protein) {
    case 'beef':
    case 'pork':
      return 'red_meat';
    case 'chicken':
      return 'poultry';
    case 'fish':
      return 'fish';
    case 'shrimp':
      return 'shrimp';
    case 'egg':
      return 'egg';
    case 'tofu':
      return 'tofu';
    default:
      return 'none';
  }
}

/** 易消化度 */
export type Digestibility = 'easy' | 'medium' | 'heavy';

/** 午餐蛋白质优先级（高到低）：红肉 > 鱼虾 > 蛋类 > 豆制品 > 禽肉 */
const LUNCH_PROTEIN_PRIORITY: Record<ProteinType, number> = {
  red_meat: 5,
  fish: 4,
  shrimp: 4,
  egg: 3,
  tofu: 2,
  poultry: 1,
  none: 0,
};

/** 晚餐蛋白质优先级（高到低）：蛋类 > 鱼类 > 豆制品 > 禽肉 > 红肉碎末 > 大块红肉 */
const DINNER_PROTEIN_PRIORITY: Record<ProteinType, number> = {
  egg: 5,
  fish: 4,
  tofu: 4,
  shrimp: 3,
  poultry: 3,
  red_meat: 1, // 红肉优先级最低，但允许碎末
  none: 0,
};

/** 按午餐蛋白质优先级排序 */
export function sortByLunchProtein(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    const pa = LUNCH_PROTEIN_PRIORITY[getProteinType(a)];
    const pb = LUNCH_PROTEIN_PRIORITY[getProteinType(b)];
    return pb - pa;
  });
}

/** 按晚餐蛋白质优先级排序 */
export function sortByDinnerProtein(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    const pa = DINNER_PROTEIN_PRIORITY[getProteinType(a)];
    const pb = DINNER_PROTEIN_PRIORITY[getProteinType(b)];
    return pb - pa;
  });
}

/** 判断食谱是否易消化（晚餐优先） */
export function isEasyDigest(recipe: Recipe): boolean {
  const name = recipe.name;
  // 蒸、煮、羹、粥类 → 易消化
  if (name.includes('蒸') || name.includes('煮') || name.includes('羹') || name.includes('粥')) return true;
  if (name.includes('清炒') || name.includes('清蒸')) return true;
  if (recipe.dishType === 'soup') return true;
  // 红烧、炸、煎、烤 → 不易消化
  if (name.includes('红烧') || name.includes('炸') || name.includes('煎') || name.includes('烤') || name.includes('糖醋')) return false;
  // 默认中等
  return true;
}

/** 推断食谱的消化负担程度 */
export function getDigestibility(recipe: Recipe): Digestibility {
  if (isEasyDigest(recipe)) return 'easy';
  const name = recipe.name;
  if (name.includes('红烧') || name.includes('糖醋') || name.includes('焖')) return 'medium';
  if (name.includes('炸') || name.includes('煎') || name.includes('烤')) return 'heavy';
  return 'medium';
}

// ============================================================
// 餐次分类展示分组（UI 用）
// ============================================================

export interface MealCategoryGroup {
  staple: Recipe[];
  protein: Recipe[];
  vegetable: Recipe[];
  soup: Recipe[];
  fruit: Recipe[];
  snack: Recipe[];
}

/** 将菜品按展示类别分组 */
export function groupDishesByMealCategory(dishes: Recipe[]): MealCategoryGroup {
  const groups: MealCategoryGroup = { staple: [], protein: [], vegetable: [], soup: [], fruit: [], snack: [] };

  for (const dish of dishes) {
    const foodType = inferFoodType(dish);
    if (foodType === '主食') {
      groups.staple.push(dish);
    } else if (foodType === '蛋白质') {
      groups.protein.push(dish);
    } else if (foodType === '蔬菜') {
      groups.vegetable.push(dish);
    } else if (foodType === '水果') {
      groups.fruit.push(dish);
    } else if (foodType === '奶类' || foodType === '点心') {
      groups.snack.push(dish);
    } else {
      groups.soup.push(dish);
    }
  }

  return groups;
}

// ============================================================
// 食物营养类型与双主食检测
// ============================================================

/** 食物营养角色 */
export type FoodType = '主食' | '蛋白质' | '蔬菜' | '水果' | '奶类' | '点心';

/** 从食谱推导其核心营养角色 */
export function inferFoodType(recipe: Recipe): FoodType {
  // 甜品优先按 dishType 判断
  if (recipe.dishType === 'dessert') return '点心';

  // 按 dishType 推导（正餐中 dishType 为准，配料不影响分类）
  if (recipe.dishType === 'staple') return '主食';
  if (recipe.dishType === 'meat') return '蛋白质';
  if (recipe.dishType === 'egg') return '蛋白质';
  if (recipe.dishType === 'vegetable') return '蔬菜';

  // 汤品：根据食材推导
  if (recipe.dishType === 'soup') {
    const cats = recipe.mainIngredients.map(ing => lookupFoodCategory(ing));
    if (cats.some(c => isMeatOrEggLike(c))) return '蛋白质';
    if (cats.some(c => isVegetableCategory(c))) return '蔬菜';
    return '点心';
  }

  // 无明确 dishType 时，根据食材推导
  const cats = recipe.mainIngredients.map(ing => lookupFoodCategory(ing));
  if (cats.includes('fruit')) return '水果';
  if (cats.includes('dairy')) return '奶类';
  return '点心';
}

/** 判断一道菜是否在营养上属于“含大量碳水的主食”（即使 dishType 不是 staple） */
export function hasStapleIngredients(recipe: Recipe): boolean {
  // dishType 直接是主食
  if (recipe.dishType === 'staple') return true;
  // 食材中含有高碳水原料（面粉、土豆、红薯、米粉等）
  return recipe.mainIngredients.some(ing => {
    const cat = lookupFoodCategory(ing);
    if (cat !== 'staple') return false;
    // 谷物/薯类类食材 = 碳水来源
    const carbIngredients = ['面粉', '土豆', '红薯', '紫薯', '玉米', '糯米', '糯米粉', '大米', '小米', '面条', '馒头', '面包'];
    return carbIngredients.some(c => ing.includes(c));
  });
}

/** 检测一餐中是否存在双主食 */
export function detectDualStaples(dishes: Recipe[]): { isDualStaple: boolean; stapleDishes: Recipe[]; warning: string } {
  const stapleDishes = dishes.filter(d => hasStapleIngredients(d));
  if (stapleDishes.length < 2) return { isDualStaple: false, stapleDishes: [], warning: '' };

  const names = stapleDishes.map(d => d.name);
  return {
    isDualStaple: true,
    stapleDishes,
    warning: `本餐主食较丰富（${names.join('、')}），建议减少一种主食，增加奶类或水果，让营养搭配更均衡。`,
  };
}

// ============================================================
// 综合营养结构检查（全年龄段）
// ============================================================

export interface CategoryStatus {
  ok: boolean;
  label: string;
  detail: string;
}

export interface NutritionCheckResult {
  /** 各分类状态 */
  staple: CategoryStatus;
  protein: CategoryStatus;
  vegetable: CategoryStatus;
  fruit: CategoryStatus;
  dairy: CategoryStatus;
  /** 是否整体均衡 */
  isBalanced: boolean;
  /** 双主食警告 */
  dualStapleWarning: string;
  /** 优化建议列表 */
  suggestions: string[];
  /** 年龄阶段提示 */
  ageNote: string;
}

/** 综合营养结构检查 */
export function checkNutritionStructure(
  dishes: Recipe[],
  age: AgeGroup,
  mealType: MealType,
  /** 当天已覆盖的分类集合（用于全天平衡判断） */
  dailyCoveredCategories?: Set<FoodType>,
): NutritionCheckResult {
  const isBreakfast = mealType === 'breakfast';

  // 收集本餐各类食物
  const foodTypes = dishes.map(d => inferFoodType(d));
  // 食材级别的补充覆盖：一道菜可能有多个营养角色（如秋葵蒸蛋=蛋白质+蔬菜）
  const allIngredientCats = dishes.flatMap(d => d.mainIngredients.map(ing => lookupFoodCategory(ing)));
  const hasVegIngredient = allIngredientCats.some(c => isVegetableCategory(c));
  const hasFruitIngredient = allIngredientCats.includes('fruit');
  const hasDairyIngredient = allIngredientCats.includes('dairy');

  const hasStaple = foodTypes.includes('主食');
  const hasProtein = foodTypes.includes('蛋白质');
  const hasVegetable = foodTypes.includes('蔬菜') || hasVegIngredient;
  const hasFruit = foodTypes.includes('水果') || hasFruitIngredient;
  const hasDairy = foodTypes.includes('奶类') || hasDairyIngredient;

  // 双主食检测
  const dualStaple = detectDualStaples(dishes);

  // ========================================================
  // 6-8 月龄：不进行严格结构判断，关注食材尝试和铁来源
  // ========================================================
  if (is6to8m(age)) {
    const hasIron = dishes.some(d =>
      d.mainIngredients.some(ing => ['redMeat', 'egg'].includes(lookupFoodCategory(ing)))
    );
    const suggestions: string[] = [];
    if (!hasIron) suggestions.push('建议安排含铁辅食（强化铁米粉或肉泥）');
    if (foodTypes.length === 0) suggestions.push('今天给宝宝尝试新食材了吗？');

    return {
      staple: { ok: hasStaple, label: '主食', detail: hasStaple ? '有安排' : '可尝试' },
      protein: { ok: hasIron, label: '铁/蛋白质', detail: hasIron ? '有安排' : '建议安排' },
      vegetable: { ok: hasVegetable, label: '蔬菜', detail: hasVegetable ? '有尝试' : '可尝试' },
      fruit: { ok: hasFruit, label: '水果', detail: hasFruit ? '有尝试' : '可尝试' },
      dairy: { ok: true, label: '奶类', detail: '奶是主要营养来源' },
      isBalanced: true,
      dualStapleWarning: '',
      suggestions,
      ageNote: '6-8月龄宝宝仍以奶为主要营养来源，辅食重点是逐步尝试和建立饮食习惯。',
    };
  }

  // ========================================================
  // 9-11 月龄：检查主食+蛋白质+蔬菜，奶仍重要
  // ========================================================
  if (is9to11m(age)) {
    const suggestions: string[] = [];
    if (!hasStaple) suggestions.push('建议搭配主食（米粉、粥或软饭）');
    if (!hasProtein) suggestions.push('建议添加蛋黄、肉末或鱼碎');
    if (!hasVegetable) suggestions.push('建议搭配蔬菜');

    return {
      staple: { ok: hasStaple, label: '主食', detail: hasStaple ? '已满足' : '建议补充' },
      protein: { ok: hasProtein, label: '蛋白质', detail: hasProtein ? '已满足' : '建议补充' },
      vegetable: { ok: hasVegetable, label: '蔬菜', detail: hasVegetable ? '已满足' : '建议补充' },
      fruit: { ok: hasFruit, label: '水果', detail: hasFruit ? '有安排' : '当天其他时间安排' },
      dairy: { ok: true, label: '奶类', detail: '母乳/配方奶仍是重要营养来源' },
      isBalanced: hasStaple && hasProtein && hasVegetable,
      dualStapleWarning: '',
      suggestions,
      ageNote: '9-11月龄辅食逐渐丰富，从泥糊向碎末过渡。',
    };
  }

  // ========================================================
  // 1 岁以上：完整餐食结构检查
  // ========================================================
  const suggestions: string[] = [];

  // 双主食警告
  if (dualStaple.isDualStaple) {
    suggestions.push(dualStaple.warning);
  }

  // 水果：全天平衡判断
  let fruitOk = hasFruit;
  let fruitDetail = '';
  if (hasFruit) {
    fruitDetail = '已安排';
  } else if (dailyCoveredCategories?.has('水果')) {
    fruitOk = true;
    fruitDetail = '今天其他餐次已安排';
  } else {
    fruitDetail = '建议当天安排';
    if (!isBreakfast) {
      // 正餐不强制要求水果，建议加餐安排
      fruitOk = true;
    }
  }

  // 奶类：非必须每餐都包含
  let dairyOk = hasDairy;
  let dairyDetail = '';
  if (hasDairy) {
    dairyDetail = '已安排';
  } else if (dailyCoveredCategories?.has('奶类')) {
    dairyOk = true;
    dairyDetail = '当天已覆盖';
  } else {
    dairyDetail = isBreakfast ? '建议早餐搭配奶制品' : '建议当天安排';
    dairyOk = true; // 不强制每餐含奶
  }

  // 主食
  if (!hasStaple) suggestions.push('建议搭配主食');
  // 蛋白质
  if (!hasProtein) suggestions.push('建议添加蛋白质（蛋/肉/鱼/豆腐）');
  // 蔬菜
  if (!hasVegetable) suggestions.push('建议搭配蔬菜');

  // 早餐特别建议
  if (isBreakfast) {
    if (!hasDairy && !dailyCoveredCategories?.has('奶类')) {
      suggestions.push('建议早餐搭配奶制品（牛奶/酸奶），补充钙质');
    }
    if (!fruitOk) {
      suggestions.push('建议搭配水果，补充维生素');
    }
  }

  // 整体均衡：主食+蛋白质+蔬菜齐全为均衡
  const isBalanced = hasStaple && hasProtein && hasVegetable && !dualStaple.isDualStaple;

  // 年龄段提示
  let ageNote = '';
  if (isOver2(age)) {
    ageNote = '接近家庭餐，关注食物多样性与营养均衡。';
  } else {
    ageNote = '建立规律三餐习惯，逐步适应家庭饮食。';
  }

  return {
    staple: { ok: hasStaple, label: '主食', detail: hasStaple ? '已满足' : '建议补充' },
    protein: { ok: hasProtein, label: '蛋白质', detail: hasProtein ? '已满足' : '建议补充' },
    vegetable: { ok: hasVegetable, label: '蔬菜', detail: hasVegetable ? '已满足' : '建议补充' },
    fruit: { ok: fruitOk, label: '水果', detail: fruitDetail || (hasFruit ? '已安排' : '建议当天安排') },
    dairy: { ok: dairyOk, label: '奶类', detail: dairyDetail || (hasDairy ? '已安排' : '建议当天安排') },
    isBalanced,
    dualStapleWarning: dualStaple.warning,
    suggestions,
    ageNote,
  };
}
