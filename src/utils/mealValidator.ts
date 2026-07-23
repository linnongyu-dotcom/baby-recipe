import { Recipe, AgeGroup, MealType, ProteinSource, TextureLevel, AGE_TEXTURE_RULES, AGE_EGG_RULES, AGE_MEAL_STRUCTURE, NutritionTag } from '../types';
import { lookupFoodCategory, isMeatOrEggLike, isVegetableCategory, FoodCategory } from './foodDictionary';
import { isAge12Plus, is6to8m, is9to11m } from './ageRules';

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

/** 从食谱数据派生出营养标签 */
export function deriveNutritionTags(recipe: Recipe): NutritionTag[] {
  const tags: NutritionTag[] = [];
  const name = recipe.name;

  // 主食类 → 主食补能
  if (recipe.dishType === 'staple') tags.push('主食补能');

  // 蛋白质来源
  const protein = inferProteinSource(recipe);
  if (protein === 'fish' || protein === 'shrimp') tags.push('DHA来源');
  if (protein === 'beef' || protein === 'pork') tags.push('补铁推荐');
  if (protein === 'egg' || protein === 'chicken') tags.push('优质蛋白');
  if (protein === 'tofu') {
    tags.push('优质蛋白');
    tags.push('补钙推荐');
  }

  // 蔬菜类
  const hasDarkVeg = recipe.mainIngredients.some(ing => {
    const cat = lookupFoodCategory(ing);
    return cat === 'darkVeg';
  });
  if (hasDarkVeg) tags.push('多彩蔬菜');

  // 清淡易消化（粥、蒸、煮类）
  if (name.includes('粥') || name.includes('蒸') || name.includes('煮') || name.includes('羹')) {
    tags.push('清淡易消化');
  }

  // 维生素丰富（水果、深色蔬菜）
  const hasFruitVeg = recipe.mainIngredients.some(ing => {
    const cat = lookupFoodCategory(ing);
    return cat === 'fruit' || cat === 'darkVeg';
  });
  if (hasFruitVeg && !tags.includes('多彩蔬菜')) tags.push('维生素丰富');

  return tags;
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
// 餐次分类展示分组（UI 用）
// ============================================================

export interface MealCategoryGroup {
  staple: Recipe[];
  protein: Recipe[];
  vegetable: Recipe[];
  soup: Recipe[];
  fruit: Recipe[];
}

/** 将菜品按展示类别分组 */
export function groupDishesByMealCategory(dishes: Recipe[]): MealCategoryGroup {
  const groups: MealCategoryGroup = { staple: [], protein: [], vegetable: [], soup: [], fruit: [] };

  for (const dish of dishes) {
    if (dish.dishType === 'staple') {
      groups.staple.push(dish);
    } else if (dish.dishType === 'meat' || dish.dishType === 'egg') {
      groups.protein.push(dish);
    } else if (dish.dishType === 'soup') {
      groups.soup.push(dish);
    } else if (dish.dishType === 'dessert') {
      groups.fruit.push(dish);
    } else if (dish.dishType === 'vegetable') {
      // 如果素菜含蛋，归为蛋白质；否则归为蔬菜
      if (dish.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg')) {
        groups.protein.push(dish);
      } else {
        groups.vegetable.push(dish);
      }
    }
  }

  return groups;
}
