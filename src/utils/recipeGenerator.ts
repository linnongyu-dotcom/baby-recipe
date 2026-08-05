import { UserSettings, Recipe, WeeklyPlan, DayPlan, AgeGroup, MealPlan, MealType, DishType, DAYS_OF_WEEK, DayOfWeek, ProteinSource, MILK_RECOMMENDATIONS } from '../types';
import { recipes } from '../data/recipes';
import { lookupFoodCategory, isMeatOrEggLike, isVegetableCategory, FoodCategory } from './foodDictionary';
import { getAgeRule, isAge12Plus, is6to8m, is9to11m, isOver2 } from './ageRules';
import {
  isRecipeAgeCompatible,
  isYolkOnlyRecipe,
  inferProteinSource,
  filterAgeIncompatible,
  removeDuplicateStaples,
  reduceProteinSources,
  limitDishCount,
  getMealDishLimit,
  getRecipeTexture,
  checkMealMandatory,
  hasStapleIngredients,
  getProteinType,
  sortByLunchProtein,
  sortByDinnerProtein,
  isEasyDigest,
  getMealSuitable,
  getFoodType,
  getDifficulty,
  getVegetableColor,
  getProteinSourceType,
  isSoupyStaple,
  getRepeatedProteinCategories,
  getRepeatedVegetableIngredients,
  getVegetableIngredients,
  isIndependentProteinDish,
  isIndependentLunchMeatDish,
  getIngredientProteinCategories,
  validateMealForContext,
} from './mealValidator';
import { validateDayPlan } from './dayPlanValidator';

// ============================================================
// 主入口：生成一周食谱
// ============================================================

export function generateWeeklyPlan(settings: UserSettings, customRecipes: Recipe[] = []): WeeklyPlan {
  const availableRecipes = filterRecipes(settings, customRecipes);
  const weekUsedIds = new Set<string>();

  const plan: WeeklyPlan = {
    monday: createDayPlan(availableRecipes, settings, 'monday', weekUsedIds),
    tuesday: createDayPlan(availableRecipes, settings, 'tuesday', weekUsedIds),
    wednesday: createDayPlan(availableRecipes, settings, 'wednesday', weekUsedIds),
    thursday: createDayPlan(availableRecipes, settings, 'thursday', weekUsedIds),
    friday: createDayPlan(availableRecipes, settings, 'friday', weekUsedIds),
    saturday: createDayPlan(availableRecipes, settings, 'saturday', weekUsedIds),
    sunday: createDayPlan(availableRecipes, settings, 'sunday', weekUsedIds),
  };

  // 周营养目标保障
  if (settings.babyAge) {
    ensureWeeklyCoverage(plan, availableRecipes, settings.babyAge, weekUsedIds);
  }

  // 最终全周数量修剪
  trimWeeklyDishCount(plan, settings.babyAge);

  // ===== 全天校验与修正（在周覆盖和修剪之后执行，确保最终质量）=====
  if (settings.babyAge && isAge12Plus(settings.babyAge)) {
    for (const day of DAYS_OF_WEEK) {
      validateAndFixDayPlan(plan[day], availableRecipes, weekUsedIds, settings.babyAge, new Set<string>());
    }
  }

  // ===== 最终防线：确保每餐都有主食，然后修剪到限制 =====
  if (settings.babyAge && isAge12Plus(settings.babyAge)) {
    for (const day of DAYS_OF_WEEK) {
      for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
        const mealPlan = plan[day][mealType];
        if (mealPlan.dishes.length === 0) continue;
        const hasStaple = mealPlan.dishes.some(d => d.dishType === 'staple');
        if (!hasStaple) {
          // 从所有可用主食中强制添加一个
          const anyStaple = pickWeightedRecipe(
            availableRecipes.staple.filter(r => !isYolkOnlyRecipe(r))
          );
          if (anyStaple) {
            mealPlan.dishes.push(anyStaple);
            weekUsedIds.add(anyStaple.id);
            // 添加后修剪到限制数量
            const limit = getMealDishLimit(settings.babyAge!, mealType);
            if (mealPlan.dishes.filter(d => d.dishType !== 'dessert').length > limit.max) {
              mealPlan.dishes = limitDishCount(mealPlan.dishes, limit.max);
            }
          }
        }
      }
    }
  }

  // ===== 汤品保障：早餐和午餐必须配汤，晚餐可选 =====
  if (settings.babyAge && isAge12Plus(settings.babyAge)) {
    for (const day of DAYS_OF_WEEK) {
      for (const mealType of ['breakfast', 'lunch'] as MealType[]) {
        const mealPlan = plan[day][mealType];
        if (mealPlan.dishes.length === 0) continue;
        const hasSoup = mealPlan.dishes.some(d => d.dishType === 'soup');
        // 如果主食本身是带汤水的（馄饨、汤面、粥等），也算有汤
        const hasSoupyStaple = mealPlan.dishes.some(d => d.dishType === 'staple' && isSoupyStaple(d));
        if (!hasSoup && !hasSoupyStaple) {
          // 优先选含蛋白质的汤（一举两得），其次选任意汤
          let soupCandidates = availableRecipes.soup.filter(r =>
            !weekUsedIds.has(r.id) && inferProteinSource(r) !== 'none'
          );
          if (soupCandidates.length === 0) {
            soupCandidates = availableRecipes.soup.filter(r => !weekUsedIds.has(r.id));
          }
          if (soupCandidates.length === 0) {
            soupCandidates = availableRecipes.soup;
          }
          const soup = pickWeightedRecipe(soupCandidates);
          if (soup) {
            mealPlan.dishes.push(soup);
            weekUsedIds.add(soup.id);
            // 修剪到限制
            const limit = getMealDishLimit(settings.babyAge!, mealType);
            if (mealPlan.dishes.filter(d => d.dishType !== 'dessert').length > limit.max) {
              mealPlan.dishes = limitDishCount(mealPlan.dishes, limit.max);
            }
          }
        }
      }
    }
  }

  // 午餐结构的最终校验必须晚于周覆盖、通用修正、主食/汤品补充和数量修剪。
  // 这些通用步骤都可能挤掉独立蛋白菜，或引入同类蛋白质重复。
  if (settings.babyAge && isAge12Plus(settings.babyAge)) {
    for (const day of DAYS_OF_WEEK) {
      plan[day].lunch = enforceLunchRules(
        plan[day].lunch,
        availableRecipes,
        settings.babyAge,
        weekUsedIds,
        plan[day].breakfast.dishes,
      );
      plan[day].dinner = enforceDinnerRules(
        plan[day].dinner,
        availableRecipes,
        settings.babyAge,
        weekUsedIds,
        plan[day].lunch.dishes,
      );
      enforceVegetableDiversityRules(plan[day], availableRecipes, settings.babyAge, weekUsedIds);

      // Vegetable repair may add a side after the meal structure has already
      // converged. Re-run the structural passes once (not a retry loop), and
      // remove an independent soup that a previous generic soup pass left next
      // to a soupy breakfast staple.
      const breakfast = plan[day].breakfast.dishes;
      if (breakfast.some(dish => dish.dishType === 'staple' && isSoupyStaple(dish))) {
        plan[day].breakfast.dishes = breakfast.filter(dish => dish.dishType !== 'soup');
      }
      // Keep the first occurrence of each real protein category. Generic soup
      // completion previously produced combinations such as pork staple + beef
      // soup (both red meat).
      const breakfastProteins = new Set<string>();
      plan[day].breakfast.dishes = plan[day].breakfast.dishes.filter(dish => {
        const categories = getIngredientProteinCategories(dish);
        if (categories.some(category => breakfastProteins.has(category))) return false;
        categories.forEach(category => breakfastProteins.add(category));
        return true;
      });
      if (!plan[day].breakfast.dishes.some(dish => inferProteinSource(dish) !== 'none')) {
        const current = plan[day].breakfast.dishes;
        const candidates = [...availableRecipes.egg, ...availableRecipes.meat, ...availableRecipes.soup]
          .filter(dish => getMealSuitable(dish).includes('breakfast'))
          .filter(dish => inferProteinSource(dish) !== 'none' && !hasStapleIngredients(dish))
          .filter(dish => getRepeatedProteinCategories([...current, dish]).length === 0)
          .filter(dish => !(current.some(item => isSoupyStaple(item)) && dish.dishType === 'soup'));
        const protein = pickWeightedRecipe(candidates.filter(dish => !weekUsedIds.has(dish.id)))
          || pickWeightedRecipe(candidates);
        if (protein) {
          current.push(protein);
          weekUsedIds.add(protein.id);
        }
      }
      if (getRepeatedVegetableIngredients(plan[day].breakfast.dishes).length > 0) {
        const staple = plan[day].breakfast.dishes.find(dish => dish.dishType === 'staple');
        const base = staple ? [staple] : [];
        const existingProtein = plan[day].breakfast.dishes.find(dish =>
          dish !== staple
          && inferProteinSource(dish) !== 'none'
          && getRepeatedProteinCategories([...base, dish]).length === 0
          && getRepeatedVegetableIngredients([...base, dish]).length === 0
        );
        if (existingProtein) base.push(existingProtein);
        if (!base.some(dish => inferProteinSource(dish) !== 'none')) {
          const compatible = [...availableRecipes.egg, ...availableRecipes.meat, ...availableRecipes.soup]
            .filter(dish => getMealSuitable(dish).includes('breakfast'))
            .filter(dish => inferProteinSource(dish) !== 'none' && !hasStapleIngredients(dish))
            .filter(dish => getRepeatedProteinCategories([...base, dish]).length === 0)
            .filter(dish => getRepeatedVegetableIngredients([...base, dish]).length === 0)
            .filter(dish => !(base.some(item => isSoupyStaple(item)) && dish.dishType === 'soup'));
          const replacement = pickWeightedRecipe(compatible.filter(dish => !weekUsedIds.has(dish.id)))
            || pickWeightedRecipe(compatible);
          if (replacement) base.push(replacement);
        }
        plan[day].breakfast.dishes = base;
      }
      plan[day].breakfast.dishes = plan[day].breakfast.dishes.slice(
        0,
        getMealDishLimit(settings.babyAge, 'breakfast').max,
      );
      if (!plan[day].breakfast.dishes.some(dish => inferProteinSource(dish) !== 'none')) {
        const staple = plan[day].breakfast.dishes.find(dish => dish.dishType === 'staple');
        const base = staple ? [staple] : [];
        const compatible = [...availableRecipes.egg, ...availableRecipes.meat, ...availableRecipes.soup]
          .filter(dish => getMealSuitable(dish).includes('breakfast'))
          .filter(dish => inferProteinSource(dish) !== 'none' && !hasStapleIngredients(dish))
          .filter(dish => getRepeatedProteinCategories([...base, dish]).length === 0)
          .filter(dish => getRepeatedVegetableIngredients([...base, dish]).length === 0)
          .filter(dish => !(base.some(item => isSoupyStaple(item)) && dish.dishType === 'soup'));
        const protein = pickWeightedRecipe(compatible.filter(dish => !weekUsedIds.has(dish.id)))
          || pickWeightedRecipe(compatible);
        if (protein) base.push(protein);
        plan[day].breakfast.dishes = base;
      }
      plan[day].lunch = enforceLunchRules(
        plan[day].lunch,
        availableRecipes,
        settings.babyAge,
        weekUsedIds,
        plan[day].breakfast.dishes,
      );
      plan[day].dinner = enforceDinnerRules(
        plan[day].dinner,
        availableRecipes,
        settings.babyAge,
        weekUsedIds,
        plan[day].lunch.dishes,
      );
    }
  }

  return plan;
}

/**
 * Detect persisted or manually edited plans that predate/bypass the current
 * lunch rules. The page uses this as a runtime safety net after Zustand has
 * hydrated, so a stale meatless lunch can never remain on screen.
 */
export function weeklyPlanNeedsLunchRepair(plan: WeeklyPlan, age: AgeGroup): boolean {
  if (!isAge12Plus(age)) return false;
  return DAYS_OF_WEEK.some(day =>
    !validateMealForContext(plan[day].lunch.dishes, age, 'lunch', plan[day]).valid
  );
}

function trimWeeklyDishCount(plan: WeeklyPlan, babyAge: AgeGroup | null): void {
  if (!babyAge || !isAge12Plus(babyAge)) return;
  for (const day of DAYS_OF_WEEK) {
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const mealPlan = plan[day][mealType];
      const limit = getMealDishLimit(babyAge, mealType);
      const mainCount = mealPlan.dishes.filter(d => d.dishType !== 'dessert').length;
      if (mainCount > limit.max) {
        mealPlan.dishes = limitDishCount(mealPlan.dishes, limit.max);
      }
    }
  }
}

// ============================================================
// 食谱过滤
// ============================================================

function filterRecipes(settings: UserSettings, customRecipes: Recipe[] = []): Record<DishType, Recipe[]> {
  const { babyAge, allergies, dislikes, likes } = settings;
  if (!babyAge) return { staple: [], meat: [], vegetable: [], soup: [], egg: [], dessert: [] };

  let filtered = recipes.filter(recipe => recipe.ageGroups.includes(babyAge));

  // 合并自定义菜谱
  const matchingCustom = customRecipes.filter(r => r.ageGroups.includes(babyAge));
  filtered = [...filtered, ...matchingCustom];

  // 过滤不适合的食物形态
  filtered = filterAgeIncompatible(filtered, babyAge);

  // 排除过敏食物
  if (allergies.length > 0) {
    filtered = filtered.filter(recipe => {
      return !recipe.mainIngredients.some(ingredient =>
        allergies.some(allergy =>
          ingredient.includes(allergy) || allergy.includes(ingredient)
        )
      );
    });
  }

  // 降权不喜欢
  const weighted: { recipe: Recipe; weight: number }[] = [];
  for (const recipe of filtered) {
    let weight = 1;
    if (dislikes.length > 0) {
      const hasDisliked = recipe.ingredients.some(ing =>
        dislikes.some(dislike => ing.name.includes(dislike) || dislike.includes(ing.name))
      ) || recipe.mainIngredients.some(ingredient =>
        dislikes.some(dislike => ingredient.includes(dislike) || dislike.includes(ingredient))
      );
      if (hasDisliked) continue;
    }
    if (likes.length > 0) {
      const hasLiked = recipe.mainIngredients.some(ingredient =>
        likes.some(like => ingredient.includes(like) || like.includes(ingredient))
      );
      if (hasLiked) weight *= 2;
    }
    weighted.push({ recipe, weight });
  }

  // 按菜品类型分组
  const grouped: Record<DishType, Recipe[]> = { staple: [], meat: [], vegetable: [], soup: [], egg: [], dessert: [] };
  for (const item of weighted) {
    grouped[item.recipe.dishType].push(item.recipe);
  }
  for (const key of Object.keys(grouped) as DishType[]) {
    grouped[key].sort((a, b) => {
      const wA = weighted.find(w => w.recipe.id === a.id)!.weight;
      const wB = weighted.find(w => w.recipe.id === b.id)!.weight;
      return wB - wA;
    });
  }
  return grouped;
}

// ============================================================
// 为一天创建食谱
// ============================================================

function createDayPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  settings: UserSettings,
  dayKey: string,
  weekUsedIds: Set<string>
): DayPlan {
  const age = settings.babyAge!;
  const dayUsedStapleNames = new Set<string>();

  // 6-8 月龄：1-2 餐辅食，保持原有逻辑
  if (is6to8m(age)) {
    const breakfast = createSimpleBabyMeal(availableRecipes, weekUsedIds);
    const lunch = Math.random() < 0.5
      ? createSimpleBabyMeal(availableRecipes, weekUsedIds)
      : { dishes: [] };
    const dinner: MealPlan = { dishes: [] };
    return { breakfast, lunch, dinner };
  }

  // 9-11 月龄：复合主食模式（原有逻辑）
  if (is9to11m(age)) {
    const breakfast = createCompositeMeal(availableRecipes, weekUsedIds, 'breakfast');
    const lunch = createCompositeMeal(availableRecipes, weekUsedIds, 'lunch');
    const dinner: MealPlan = { dishes: [] };
    return { breakfast, lunch, dinner };
  }

  // ========================================================
  // 1岁以上：三餐定位优化（新逻辑）
  // ========================================================

  // 顺序：午餐（最重要） -> 晚餐（清淡互补） -> 早餐（简单快速）
  // 追踪全天已使用的蛋白质类型
  const usedProteinTypes = new Set<string>();

  const lunch = createLunchPlan(availableRecipes, weekUsedIds, age, dayUsedStapleNames, usedProteinTypes);
  const dinner = createDinnerPlan(availableRecipes, weekUsedIds, age, dayUsedStapleNames, lunch, usedProteinTypes);
  const breakfast = createBreakfastPlan(availableRecipes, weekUsedIds, age, dayUsedStapleNames, usedProteinTypes);

  return { breakfast, lunch, dinner };
}

// ============================================================
// 早餐生成（简单、快速、营养密度高）
// 结构：主食 + 蛋白质
// ============================================================

function createBreakfastPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
  usedProteinTypes: Set<string>,
): MealPlan {
  const filterUnused = (pool: Recipe[]): Recipe[] => {
    const filtered = pool.filter(r => !usedIds.has(r.id));
    return filtered.length > 0 ? filtered : pool;
  };

  // 过滤：只选适合早餐的
  const suitableForBreakfast = (pool: Recipe[]): Recipe[] =>
    pool.filter(r => getMealSuitable(r).includes('breakfast'));

  // 过滤不含主食类型食材的
  const nonStaple = (pool: Recipe[]): Recipe[] =>
    pool.filter(r => !hasStapleIngredients(r));

  // 食物池
  const allStaples = availableRecipes.staple;

  // 构建优先级多层的主食候选池
  const breakfastSuitable = allStaples.filter(r => getMealSuitable(r).includes('breakfast'));
  const simpleStaples = breakfastSuitable.filter(r => getDifficulty(r) === '简单');
  const unusedSimple = simpleStaples.filter(r => !usedIds.has(r.id) && !dayUsedStapleNames.has(r.name));

  // 按优先级尝试：未用的简单主食 > 未用的早餐主食 > 所有早餐主食 > 任何主食
  let staplePool = unusedSimple.length > 0 ? unusedSimple
    : simpleStaples.filter(r => !dayUsedStapleNames.has(r.name)).length > 0
      ? simpleStaples.filter(r => !dayUsedStapleNames.has(r.name))
      : simpleStaples.length > 0 ? simpleStaples
      : breakfastSuitable.length > 0 ? breakfastSuitable
      : allStaples;

  const eggPool = suitableForBreakfast(filterUnused(availableRecipes.egg.filter(r => !r.name.includes('蛋黄'))));
  // 早餐肉类只选简单制作的
  const meatPool = suitableForBreakfast(
    filterUnused(availableRecipes.meat).filter(r => getDifficulty(r) === '简单')
  );
  const soupPool = suitableForBreakfast(filterUnused(availableRecipes.soup));

  const selected: Recipe[] = [];

  // ===== 步骤1：选主食（必须） =====
  const staple = pickWeightedRecipe(staplePool);
  // 如果主食选择失败，用最终兜底
  if (!staple) {
    // 从所有可用主食中无条件选择
    const anyStaple = pickWeightedRecipe(availableRecipes.staple.filter(r => !isYolkOnlyRecipe(r)));
    if (anyStaple) {
      selected.push(anyStaple);
      usedIds.add(anyStaple.id);
      dayUsedStapleNames.add(anyStaple.name);
    }
  } else {
    selected.push(staple);
    usedIds.add(staple.id);
    dayUsedStapleNames.add(staple.name);
  }

  // 主食属性
  const stapleHasProtein = staple ? inferProteinSource(staple) !== 'none' : false;
  // 如果主食本身含蛋白质，记录类型
  if (staple && stapleHasProtein) {
    const pt = getProteinSourceType(staple);
    if (pt !== 'none') usedProteinTypes.add(pt);
  }

  // ===== 步骤2：选蛋白质（主食不含蛋白时补充） =====
  if (!stapleHasProtein) {
    // 优先级：蛋类 > 肉类 > 含蛋白汤
    let proteinCandidates: Recipe[] = [
      ...nonStaple(eggPool),
      ...nonStaple(meatPool),
      ...nonStaple(soupPool.filter(r => inferProteinSource(r) !== 'none')),
    ];
    // 避免与午餐/晚餐蛋白质类型重复
    if (usedProteinTypes.size > 0) {
      proteinCandidates = proteinCandidates.filter(r => !usedProteinTypes.has(getProteinSourceType(r)));
      // 过滤后如果没有真正的蛋白质来源（只有none类型的），清空以触发兜底
      if (proteinCandidates.length > 0 && proteinCandidates.every(r => getProteinSourceType(r) === 'none')) {
        proteinCandidates = [];
      }
    }
    if (proteinCandidates.length === 0) {
      proteinCandidates = [
        ...nonStaple(eggPool),
        ...nonStaple(meatPool),
        ...nonStaple(soupPool.filter(r => inferProteinSource(r) !== 'none')),
      ];
    }
    proteinCandidates = proteinCandidates.filter(r => !selected.some(d => d.id === r.id));

    let protein = pickWeightedRecipe(proteinCandidates);

    // 兜底
    if (!protein) {
      protein = pickWeightedRecipe([
        ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
        ...availableRecipes.meat,
      ]);
    }

    if (protein && !selected.some(d => d.id === protein.id)) {
      selected.push(protein);
      usedIds.add(protein.id);
      const pt = getProteinSourceType(protein);
      if (pt !== 'none') usedProteinTypes.add(pt);
    }
  }

  // 确保至少2个菜（主食+蛋白质），但早餐最多2道主菜
  const limit = getMealDishLimit(age, 'breakfast');
  const mainDishes = selected.filter(d => d.dishType !== 'dessert');
  if (mainDishes.length > limit.max) {
    return { dishes: limitDishCount(selected, limit.max) };
  }

  // 最终防线：确保有蛋白质
  const hasProtein = selected.some(d => {
    if (d.dishType === 'meat' || d.dishType === 'egg') return true;
    if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
    return false;
  });

  if (!hasProtein && selected.length > 0) {
    const fallbackProtein = pickWeightedRecipe([
      ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
    ]);
    if (fallbackProtein && !selected.some(d => d.id === fallbackProtein.id)) {
      selected.push(fallbackProtein);
      usedIds.add(fallbackProtein.id);
    }
  }

  return { dishes: selected };
}

// ============================================================
// 午餐生成（一天中营养最完整的一餐）
// 结构：主食 + 蛋白质 + 蔬菜
// 优先：肉类/鱼类/蛋类/豆制品 + 深色蔬菜
// ============================================================

function createLunchPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
  usedProteinTypes: Set<string>,
): MealPlan {
  const filterUnused = (pool: Recipe[]): Recipe[] => {
    const filtered = pool.filter(r => !usedIds.has(r.id));
    return filtered.length > 0 ? filtered : pool;
  };

  const isOver2 = age === '2-3y' || age === '3-5y';

  const allStaples = availableRecipes.staple;
  const lunchDinnerStaples = allStaples.filter(r => {
    const meals = getMealSuitable(r);
    return meals.includes('lunch') || meals.includes('dinner');
  }).filter(r => !isYolkOnlyRecipe(r));

  // 2岁以上午餐不喝粥
  const ageFiltered = isOver2
    ? lunchDinnerStaples.filter(r => !r.name.includes('粥'))
    : lunchDinnerStaples;

  // 米饭优先
  const riceStaples = ageFiltered.filter(r => r.name.includes('米饭') || r.name.endsWith('饭'));

  // 优先级：未用米饭 > 未用其他 > 所有午餐主食
  let staplePool = riceStaples.filter(r => !usedIds.has(r.id)).length > 0
    ? riceStaples.filter(r => !usedIds.has(r.id))
    : ageFiltered.filter(r => !usedIds.has(r.id) && !dayUsedStapleNames.has(r.name)).length > 0
      ? ageFiltered.filter(r => !usedIds.has(r.id) && !dayUsedStapleNames.has(r.name))
      : ageFiltered;

  const nonStaple = (pool: Recipe[]): Recipe[] =>
    pool.filter(r => !hasStapleIngredients(r));

  const meatPool = filterUnused(availableRecipes.meat).filter(r => {
    const s = getMealSuitable(r);
    return s.includes('lunch') || s.includes('dinner');
  });
  const eggPool = filterUnused(availableRecipes.egg.filter(r => !r.name.includes('蛋黄'))).filter(r => {
    const s = getMealSuitable(r);
    return s.includes('lunch') || s.includes('dinner');
  });
  const vegPool = filterUnused(availableRecipes.vegetable).filter(r => {
    const s = getMealSuitable(r);
    return s.includes('lunch') || s.includes('dinner');
  });
  // 深色蔬菜优先
  const darkVeg = vegPool.filter(r => getVegetableColor(r) === '深色');
  const lightVeg = vegPool.filter(r => getVegetableColor(r) === '浅色');

  const selected: Recipe[] = [];

  // ===== 步骤1：选主食 =====
  const staple = pickWeightedRecipe(staplePool);
  if (staple) {
    selected.push(staple);
    usedIds.add(staple.id);
    dayUsedStapleNames.add(staple.name);
  }

  const stapleHasVeggie = staple ? hasVegetables(staple) : false;
  // 如果主食含蛋白质，记录类型
  if (staple && inferProteinSource(staple) !== 'none') {
    const pt = getProteinSourceType(staple);
    if (pt !== 'none') usedProteinTypes.add(pt);
  }

  // ===== 步骤2：选蛋白质（优先红肉/鱼虾） =====
  {
    let proteinCandidates: Recipe[] = [
      ...nonStaple(meatPool),
      ...nonStaple(eggPool),
    ].filter(isIndependentProteinDish);
    proteinCandidates = proteinCandidates.filter(r => !selected.some(d => d.id === r.id));

    let protein = pickLunchProtein(proteinCandidates, usedIds, selected, false);

    // 兜底
    if (!protein) {
      protein = pickLunchProtein([
        ...availableRecipes.meat,
        ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
      ], usedIds, selected, false);
    }

    if (protein && !selected.some(d => d.id === protein.id)) {
      selected.push(protein);
      usedIds.add(protein.id);
      const pt = getProteinSourceType(protein);
      if (pt !== 'none') usedProteinTypes.add(pt);
    }
  }

  // ===== 步骤3：选蔬菜（1-2道，优先深色） =====
  const needVegCount = stapleHasVeggie ? 1 : 2;
  const vegCandidates = darkVeg.length > 0 ? [...darkVeg, ...lightVeg] : vegPool;

  for (let i = 0; i < needVegCount; i++) {
    const vegCandidate = vegCandidates.filter(r => !selected.some(d => d.id === r.id));
    const veg = pickWeightedRecipe(vegCandidate.length > 0 ? vegCandidate : availableRecipes.vegetable);
    if (veg && !selected.some(d => d.id === veg.id)) {
      selected.push(veg);
      usedIds.add(veg.id);
    }
  }

  // ===== 最终防线 =====
  const limit = getMealDishLimit(age, 'lunch');
  let final = selected.filter(d => d.dishType !== 'dessert');

  // 确保有蛋白质
  const hasProtein = final.some(d => {
    if (d.dishType === 'meat' || d.dishType === 'egg') return true;
    if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
    return false;
  });
  if (!hasProtein) {
    const fallback = pickWeightedRecipe([...availableRecipes.meat, ...availableRecipes.egg]);
    if (fallback && !final.some(d => d.id === fallback.id)) {
      final.push(fallback);
      usedIds.add(fallback.id);
    }
  }

  // 确保有蔬菜
  const hasVeg = final.some(d => {
    if (d.dishType === 'vegetable') return true;
    return hasVegetables(d);
  });
  if (!hasVeg) {
    const fallbackVeg = pickWeightedRecipe(availableRecipes.vegetable);
    if (fallbackVeg && !final.some(d => d.id === fallbackVeg.id)) {
      final.push(fallbackVeg);
      usedIds.add(fallbackVeg.id);
    }
  }

  if (final.length > limit.max) final = limitDishCount(final, limit.max);

  return enforceLunchRules({ dishes: final }, availableRecipes, age, usedIds, []);
}

// ============================================================
// 晚餐生成（清淡、易消化）
// 结构：主食 + 蛋白质 + 蔬菜
// 优先：蒸/炖/煮，避免油腻和复杂制作
// ============================================================

function createDinnerPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
  lunchPlan: MealPlan,
  usedProteinTypes: Set<string>,
): MealPlan {
  const filterUnused = (pool: Recipe[]): Recipe[] => {
    const filtered = pool.filter(r => !usedIds.has(r.id));
    return filtered.length > 0 ? filtered : pool;
  };

  const isLunchOrDinner = (r: Recipe) => {
    const m = getMealSuitable(r);
    return m.includes('lunch') || m.includes('dinner');
  };

  const lunchDinnerStaples = availableRecipes.staple.filter(r => {
    const m = getMealSuitable(r);
    return m.includes('lunch') || m.includes('dinner');
  });

  let staplePool = lunchDinnerStaples.filter(r => !usedIds.has(r.id) && !isYolkOnlyRecipe(r));
  // 晚餐排除重口味主食
  staplePool = staplePool.filter(r =>
    !r.name.includes('炸酱') && !r.name.includes('红烧') && !r.name.includes('糖醋') && !r.name.includes('烤')
  );
  // 排除同天已用主食名（米饭除外）
  staplePool = staplePool.filter(r => {
    const isRice = r.name.includes('米饭') || r.name === '白米饭';
    if (isRice) return true;
    return !dayUsedStapleNames.has(r.name);
  });
  // 兜底：如果过滤后为空，用所有非蛋黄主食
  if (staplePool.length === 0) {
    staplePool = availableRecipes.staple.filter(r => !isYolkOnlyRecipe(r));
  }

  const nonStaple = (pool: Recipe[]): Recipe[] =>
    pool.filter(r => !hasStapleIngredients(r));

  const eggPool = filterUnused(availableRecipes.egg.filter(r => !r.name.includes('蛋黄'))).filter(isLunchOrDinner);
  // 晚餐肉类排除红烧/炸/糖醋/烤
  const meatPool = filterUnused(
    availableRecipes.meat.filter(r =>
      !r.name.includes('红烧') && !r.name.includes('炸') &&
      !r.name.includes('糖醋') && !r.name.includes('烤')
    )
  ).filter(isLunchOrDinner);
  const vegPool = filterUnused(availableRecipes.vegetable).filter(isLunchOrDinner);
  // 晚餐素菜也排除红烧/油炸
  const safeVegPool = vegPool.filter(r =>
    !r.name.includes('红烧') && !r.name.includes('炸') &&
    !r.name.includes('糖醋') && !r.name.includes('烤')
  );
  // 排除午餐已用的蛋白质来源
  const lunchProteins = new Set<string>();
  for (const dish of lunchPlan.dishes) {
    const pt = getProteinSourceType(dish);
    if (pt !== 'none') lunchProteins.add(pt);
  }

  const selected: Recipe[] = [];

  // ===== 步骤1：选主食 =====
  const staple = pickWeightedRecipe(staplePool);
  if (staple) {
    selected.push(staple);
    usedIds.add(staple.id);
    dayUsedStapleNames.add(staple.name);
  }

  const stapleHasVeggie = staple ? hasVegetables(staple) : false;
  // 如果主食含蛋白质，记录类型
  if (staple && inferProteinSource(staple) !== 'none') {
    const pt = getProteinSourceType(staple);
    if (pt !== 'none') usedProteinTypes.add(pt);
  }

  // ===== 步骤2：主食中的少量肉蛋不能替代独立轻蛋白菜 =====
  {
    let proteinCandidates: Recipe[] = [
      ...nonStaple(eggPool),
      ...nonStaple(meatPool.filter(r => isEasyDigest(r))),
      ...nonStaple(safeVegPool.filter(r => isEasyDigest(r))),
    ].filter(isIndependentProteinDish);
    // 排除午餐已用的蛋白质类型 和 全天已追踪的类型
    proteinCandidates = proteinCandidates.filter(r => {
      const pt = getProteinSourceType(r);
      return !lunchProteins.has(pt) && !usedProteinTypes.has(pt);
    });
    if (proteinCandidates.length === 0) {
      proteinCandidates = [
        ...nonStaple(eggPool),
        ...nonStaple(meatPool.filter(r => isEasyDigest(r))),
      ];
    }

    proteinCandidates = sortByDinnerProtein(proteinCandidates);
    proteinCandidates = proteinCandidates.filter(r => !selected.some(d => d.id === r.id));

    const bestType = proteinCandidates[0] ? getProteinType(proteinCandidates[0]) : 'none';
    let protein = pickWeightedRecipe(proteinCandidates.filter(r => getProteinType(r) === bestType));

    // 兜底
    if (!protein) {
      const fallbackPool = sortByDinnerProtein([
        ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
        ...availableRecipes.meat.filter(r => isEasyDigest(r)),
        ...availableRecipes.vegetable.filter(r => isEasyDigest(r)),
      ].filter(isIndependentProteinDish));
      const fallbackType = fallbackPool[0] ? getProteinType(fallbackPool[0]) : 'none';
      protein = pickWeightedRecipe(fallbackPool.filter(r => getProteinType(r) === fallbackType));
    }

    if (protein && !selected.some(d => d.id === protein.id)) {
      selected.push(protein);
      usedIds.add(protein.id);
      const pt = getProteinSourceType(protein);
      if (pt !== 'none') usedProteinTypes.add(pt);
    }
  }

  // ===== 步骤3：选蔬菜（1道，深浅搭配） =====
  const needVegCount = stapleHasVeggie ? 1 : 1; // 晚餐蔬菜量少于午餐
  for (let i = 0; i < needVegCount; i++) {
    const vegCandidate = safeVegPool.filter(r => !selected.some(d => d.id === r.id));
    const veg = pickWeightedRecipe(vegCandidate.length > 0 ? vegCandidate : availableRecipes.vegetable);
    if (veg && !selected.some(d => d.id === veg.id)) {
      selected.push(veg);
      usedIds.add(veg.id);
    }
  }

  // ===== 最终防线 =====
  const limit = getMealDishLimit(age, 'dinner');
  let final = selected.filter(d => d.dishType !== 'dessert');

  const hasProtein = final.some(d => {
    if (d.dishType === 'meat' || d.dishType === 'egg') return true;
    if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
    return false;
  });
  if (!hasProtein) {
    const fallback = pickWeightedRecipe(availableRecipes.egg.filter(r => !r.name.includes('蛋黄')));
    if (fallback && !final.some(d => d.id === fallback.id)) {
      final.push(fallback);
      usedIds.add(fallback.id);
    }
  }

  const hasVeg = final.some(d => d.dishType === 'vegetable' || hasVegetables(d));
  if (!hasVeg) {
    const fallbackVeg = pickWeightedRecipe(availableRecipes.vegetable);
    if (fallbackVeg && !final.some(d => d.id === fallbackVeg.id)) {
      final.push(fallbackVeg);
      usedIds.add(fallbackVeg.id);
    }
  }

  if (final.length > limit.max) final = limitDishCount(final, limit.max);

  return enforceDinnerRules({ dishes: final }, availableRecipes, age, usedIds, lunchPlan.dishes);
}

// ============================================================
// 全天搭配校验与自动修正
// ============================================================

function validateAndFixDayPlan(
  dayPlan: DayPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  weekUsedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
): void {
  const result = validateDayPlan(dayPlan, age);
  if (result.valid && result.warnings.length === 0) return; // 完美，无需修正

  // 如果有食材重复、蛋白质分布、蔬菜多样性问题，尝试修正
  if (result.ingredientRepeat && result.ingredientRepeat.length > 0) {
    // 尝试替换晚餐中的重复食材菜品
    tryFixIngredientRepeat(dayPlan, availableRecipes, weekUsedIds, age, dayUsedStapleNames);
  }

  // 如果蛋类过度集中，尝试调整
  if (result.proteinDistribution && !result.proteinDistribution.ok) {
    tryFixProteinDistribution(dayPlan, availableRecipes, weekUsedIds, age);
  }

  // 如果缺少蔬菜多样性
  if (result.vegetableDiversity && !result.vegetableDiversity.ok) {
    tryFixVegDiversity(dayPlan, availableRecipes, weekUsedIds, age);
  }
}

/** 尝试修正食材重复问题：替换晚餐中与早餐/午餐重复的菜品 */
function tryFixIngredientRepeat(
  dayPlan: DayPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  weekUsedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
): void {
  const breakfastIngredients = dayPlan.breakfast.dishes.flatMap(
    d => d.mainIngredients.filter(ing => lookupFoodCategory(ing) !== 'other')
  );
  const lunchIngredients = dayPlan.lunch.dishes.flatMap(
    d => d.mainIngredients.filter(ing => lookupFoodCategory(ing) !== 'other')
  );

  // 找晚餐中与早餐/午餐重复食材超过2个的菜品
  const dinnerDishes = [...dayPlan.dinner.dishes];
  for (let i = dinnerDishes.length - 1; i >= 0; i--) {
    const dish = dinnerDishes[i];
    if (dish.dishType === 'staple') continue; // 不替换主食

    const dishIngredients = dish.mainIngredients.filter(
      ing => lookupFoodCategory(ing) !== 'other' && !['大米', '面条', '面粉', '小米'].includes(ing)
    );
    const overlapWithBreakfast = dishIngredients.filter(ing => breakfastIngredients.includes(ing));
    const overlapWithLunch = dishIngredients.filter(ing => lunchIngredients.includes(ing));

    if (overlapWithBreakfast.length >= 2 || overlapWithLunch.length >= 2) {
      // 尝试找同类型不同食材的菜品替换
      const existingIds = new Set(dinnerDishes.map((d, idx) => idx !== i ? d.id : ''));
      const sameTypePool = availableRecipes[dish.dishType].filter(r => {
        if (weekUsedIds.has(r.id)) return false;
        if (existingIds.has(r.id)) return false;
        const newIngredients = r.mainIngredients.filter(
          ing => lookupFoodCategory(ing) !== 'other' && !['大米', '面条', '面粉', '小米'].includes(ing)
        );
        const newOverlapB = newIngredients.filter(ing => breakfastIngredients.includes(ing));
        const newOverlapL = newIngredients.filter(ing => lunchIngredients.includes(ing));
        return newOverlapB.length < 2 && newOverlapL.length < 2;
      });

      if (sameTypePool.length > 0) {
        const replacement = pickWeightedRecipe(sameTypePool);
        if (replacement) {
          weekUsedIds.delete(dish.id);
          weekUsedIds.add(replacement.id);
          dinnerDishes[i] = replacement;
        }
      }
    }
  }
  dayPlan.dinner.dishes = dinnerDishes;
}

/** 尝试修正蛋白质分布：替换集中过度的蛋类，或增加蛋白质多样性 */
function tryFixProteinDistribution(
  dayPlan: DayPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  weekUsedIds: Set<string>,
  age: AgeGroup,
): void {
  const allDishes = [
    ...dayPlan.breakfast.dishes,
    ...dayPlan.lunch.dishes,
    ...dayPlan.dinner.dishes,
  ].filter(d => d.dishType !== 'dessert');

  // 检查蛋类是否过度集中
  const eggDishes = allDishes.filter(d =>
    d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg')
  );

  if (eggDishes.length >= 3 && dayPlan.dinner.dishes.length > 0) {
    // 先尝试替换晚餐中的独立蛋类（非主食）
    let dinnerDish = dayPlan.dinner.dishes.find(d =>
      d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg') && d.dishType !== 'staple'
    );
    // 如果没有独立蛋类，尝试替换含蛋主食
    if (!dinnerDish) {
      dinnerDish = dayPlan.dinner.dishes.find(d =>
        d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg') && d.dishType === 'staple'
      );
    }
    if (dinnerDish) {
      const replacementCandidates = [
        ...availableRecipes.meat.filter(r => isEasyDigest(r)),
      ].filter(r => {
        const pt = getProteinSourceType(r);
        return pt === '鱼类' || pt === '豆制品';
      });

      if (replacementCandidates.length > 0) {
        const replacement = pickWeightedRecipe(replacementCandidates);
        if (replacement) {
          weekUsedIds.delete(dinnerDish.id);
          weekUsedIds.add(replacement.id);
          const idx = dayPlan.dinner.dishes.indexOf(dinnerDish);
          if (idx >= 0) {
            dayPlan.dinner.dishes[idx] = replacement;
          }
        }
      }
    }
  }

  // 检查蛋白质来源是否单一（只有1种非staple蛋白）
  const proteinDishes = allDishes.filter(d => {
    if (d.dishType === 'meat' || d.dishType === 'egg') return true;
    if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
    return false;
  });
  if (proteinDishes.length >= 2) {
    const proteinTypes = new Set(proteinDishes.map(d => getProteinSourceType(d)));
    if (proteinTypes.size <= 1 && dayPlan.dinner.dishes.length > 0) {
      // 尝试替换晚餐的蛋白质为不同类型
      const dinnerProtein = dayPlan.dinner.dishes.find(d => {
        if (d.dishType === 'meat' || d.dishType === 'egg') return true;
        if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
        return false;
      });
      if (dinnerProtein) {
        const existingType = getProteinSourceType(dinnerProtein);
        const replacementCandidates = [
          ...availableRecipes.meat.filter(r => isEasyDigest(r)),
          ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
        ].filter(r => {
          const pt = getProteinSourceType(r);
          return pt !== 'none' && pt !== existingType;
        });

        if (replacementCandidates.length > 0) {
          const replacement = pickWeightedRecipe(replacementCandidates);
          if (replacement) {
            weekUsedIds.delete(dinnerProtein.id);
            weekUsedIds.add(replacement.id);
            const idx = dayPlan.dinner.dishes.indexOf(dinnerProtein);
            if (idx >= 0) {
              dayPlan.dinner.dishes[idx] = replacement;
            }
          }
        }
      }
    }
  }
}

/** 尝试修正蔬菜多样性 */
function tryFixVegDiversity(
  dayPlan: DayPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  weekUsedIds: Set<string>,
  age: AgeGroup,
): void {
  enforceVegetableDiversityRules(dayPlan, availableRecipes, age, weekUsedIds, true);
}

const VEGETABLE_FIX_MAX_ATTEMPTS = 12;

function isReplaceableVegetable(recipe: Recipe): boolean {
  return recipe.dishType === 'vegetable'
    && getVegetableIngredients(recipe).length > 0
    && getIngredientProteinCategories(recipe).length === 0
    && !hasStapleIngredients(recipe);
}

/**
 * Final vegetable pass: first removes real-ingredient collisions within meals and
 * across a day, then covers the missing colour by replacing an existing side.
 * Core dishes are never removed, and bounded attempts make a restricted pool a
 * deliberate fallback rather than a retry loop.
 */
export function enforceVegetableDiversityRules(
  dayPlan: DayPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
  usedIds: Set<string> = new Set(),
  colorOnly = false,
): void {
  if (!isAge12Plus(age)) return;
  const order: MealType[] = ['dinner', 'lunch', 'breakfast'];
  let attempts = 0;

  const replaceSide = (mealType: MealType, index: number, forbidden: Set<string>, wanted?: FoodCategory): boolean => {
    if (attempts++ >= VEGETABLE_FIX_MAX_ATTEMPTS) return false;
    const dishes = dayPlan[mealType].dishes;
    const old = dishes[index];
    if (!old || !isReplaceableVegetable(old)) return false;
    const otherIds = new Set(dishes.filter((_, i) => i !== index).map(d => d.id));
    const candidates = availableRecipes.vegetable.filter(candidate => {
      const vegetables = getVegetableIngredients(candidate);
      return isReplaceableVegetable(candidate)
        && getMealSuitable(candidate).includes(mealType)
        && !otherIds.has(candidate.id)
        && vegetables.every(vegetable => !forbidden.has(vegetable))
        && (!wanted || vegetables.some(vegetable => lookupFoodCategory(vegetable) === wanted));
    });
    const replacement = pickWeightedRecipe(candidates.filter(candidate => !usedIds.has(candidate.id)))
      || pickWeightedRecipe(candidates);
    if (!replacement) return false;
    dishes[index] = replacement;
    usedIds.delete(old.id);
    usedIds.add(replacement.id);
    return true;
  };

  const replaceComposite = (mealType: MealType, index: number, forbidden: Set<string>): boolean => {
    if (attempts++ >= VEGETABLE_FIX_MAX_ATTEMPTS) return false;
    const dishes = dayPlan[mealType].dishes;
    const old = dishes[index];
    if (!old || old.dishType === 'staple' || isReplaceableVegetable(old)) return false;
    const oldProteins = getIngredientProteinCategories(old).sort().join(',');
    const pool = availableRecipes[old.dishType].filter(candidate =>
      candidate.id !== old.id
      && getMealSuitable(candidate).includes(mealType)
      && getVegetableIngredients(candidate).every(vegetable => !forbidden.has(vegetable))
      && getIngredientProteinCategories(candidate).sort().join(',') === oldProteins
      && getRepeatedProteinCategories(dishes.map((dish, i) => i === index ? candidate : dish)).length === 0
    );
    const replacement = pickWeightedRecipe(pool.filter(candidate => !usedIds.has(candidate.id)))
      || pickWeightedRecipe(pool);
    if (!replacement) return false;
    dishes[index] = replacement;
    usedIds.delete(old.id);
    usedIds.add(replacement.id);
    return true;
  };

  if (!colorOnly) {
    // Hard rule: collisions between any two dishes in one meal.
    for (const mealType of order) {
      while (attempts < VEGETABLE_FIX_MAX_ATTEMPTS) {
        const dishes = dayPlan[mealType].dishes;
        const repeated = new Set(getRepeatedVegetableIngredients(dishes));
        if (repeated.size === 0) break;
        const index = dishes.findIndex(dish => isReplaceableVegetable(dish)
          && getVegetableIngredients(dish).some(vegetable => repeated.has(vegetable)));
        const forbidden = new Set(dishes.filter((_, i) => i !== index).flatMap(getVegetableIngredients));
        if (index >= 0 && replaceSide(mealType, index, forbidden)) continue;
        const compositeIndex = dishes.findIndex(dish => dish.dishType !== 'staple'
          && getVegetableIngredients(dish).some(vegetable => repeated.has(vegetable)));
        const compositeForbidden = new Set(dishes.filter((_, i) => i !== compositeIndex).flatMap(getVegetableIngredients));
        if (compositeIndex < 0 || !replaceComposite(mealType, compositeIndex, compositeForbidden)) break;
      }
    }

    // Strong daily preference. Dinner sides yield first, then lunch and breakfast.
    const claimed = new Set<string>();
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const dishes = dayPlan[mealType].dishes;
      const overlap = new Set(dishes.flatMap(getVegetableIngredients).filter(v => claimed.has(v)));
      if (overlap.size) {
        const index = dishes.findIndex(dish => isReplaceableVegetable(dish)
          && getVegetableIngredients(dish).some(v => overlap.has(v)));
        const allOther = new Set(order.flatMap(type => dayPlan[type].dishes)
          .filter(dish => dish !== dishes[index]).flatMap(getVegetableIngredients));
        if (index >= 0) {
          replaceSide(mealType, index, allOther);
        } else {
          // The later occurrence is in a protected composite protein dish. Move
          // the earlier standalone side instead of sacrificing that protein.
          for (const earlierType of ['lunch', 'breakfast'] as MealType[]) {
            if (earlierType === mealType) continue;
            const earlier = dayPlan[earlierType].dishes;
            const earlierIndex = earlier.findIndex(dish => isReplaceableVegetable(dish)
              && getVegetableIngredients(dish).some(v => overlap.has(v)));
            if (earlierIndex < 0) continue;
            const forbidden = new Set(order.flatMap(type => dayPlan[type].dishes)
              .filter(dish => dish !== earlier[earlierIndex]).flatMap(getVegetableIngredients));
            if (replaceSide(earlierType, earlierIndex, forbidden)) break;
          }
        }
      }
      dishes.flatMap(getVegetableIngredients).forEach(v => claimed.add(v));
    }
  }

  // Cover dark/light without growing a meal: replace a standalone side only.
  const allVegetables = () => order.flatMap(type => dayPlan[type].dishes).flatMap(getVegetableIngredients);
  const categories = new Set(allVegetables().map(lookupFoodCategory));
  const wanted: FoodCategory | undefined = !categories.has('darkVeg') ? 'darkVeg'
    : !categories.has('lightVeg') ? 'lightVeg' : undefined;
  if (wanted) {
    for (const mealType of order) {
      const dishes = dayPlan[mealType].dishes;
      const index = dishes.findIndex(isReplaceableVegetable);
      if (index < 0) continue;
      const forbidden = new Set(order.flatMap(type => dayPlan[type].dishes)
        .filter(dish => dish !== dishes[index]).flatMap(getVegetableIngredients));
      if (replaceSide(mealType, index, forbidden, wanted)) break;
    }
  }
}

// ============================================================
// 6-8 月龄简易辅食
// ============================================================

function createSimpleBabyMeal(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
): MealPlan {
  const proteinPool = [...availableRecipes.meat, ...availableRecipes.egg];
  const otherPool = [...availableRecipes.staple, ...availableRecipes.vegetable];
  const allRecipes = [...proteinPool, ...otherPool];
  let available = allRecipes.filter(r => !usedIds.has(r.id));
  if (available.length === 0) available = allRecipes;

  const availProtein = available.filter(r => proteinPool.includes(r));
  const availOther = available.filter(r => otherPool.includes(r));

  let recipe: Recipe | null = null;
  if (availProtein.length > 0 && Math.random() < 0.4) {
    recipe = pickWeightedRecipe(availProtein);
  }
  if (!recipe && Math.random() < 0.4 && proteinPool.length > 0) {
    recipe = pickWeightedRecipe(proteinPool);
  }
  if (!recipe && availOther.length > 0) {
    recipe = pickWeightedRecipe(availOther);
  }
  if (!recipe) {
    recipe = pickWeightedRecipe(available);
  }

  if (recipe) {
    usedIds.add(recipe.id);
    return { dishes: [recipe] };
  }
  return { dishes: [] };
}

// ============================================================
// 9-11 月龄复合主食
// ============================================================

function createCompositeMeal(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
  mealType: MealType,
): MealPlan {
  const composites: Recipe[] = [];
  const simples: Recipe[] = [];

  for (const r of availableRecipes.staple) {
    // 检查是否适配该餐次
    const suitable = getMealSuitable(r);
    if (!suitable.includes(mealType)) continue;

    const cats = r.mainIngredients.map(ing => lookupFoodCategory(ing));
    const hasProtein = cats.some(c => ['egg', 'fishSeafood', 'redMeat', 'poultry'].includes(c));
    const hasVeg = cats.some(c => ['darkVeg', 'lightVeg'].includes(c));
    if (hasProtein && hasVeg) {
      composites.push(r);
    } else {
      simples.push(r);
    }
  }

  const preferComposite = Math.random() < 0.7;
  let pool: Recipe[];
  if (preferComposite && composites.length > 0) {
    pool = composites;
  } else {
    pool = [...composites, ...simples];
  }

  let filtered = pool.filter(r => !usedIds.has(r.id));
  if (filtered.length === 0) filtered = pool;

  const recipe = pickWeightedRecipe(filtered);
  if (recipe) {
    usedIds.add(recipe.id);
    return { dishes: [recipe] };
  }
  return { dishes: [] };
}

// ============================================================
// 周营养目标保障
// ============================================================

function countCategoryInWeek(plan: WeeklyPlan, category: FoodCategory): number {
  let count = 0;
  for (const day of DAYS_OF_WEEK) {
    const dayPlan = plan[day];
    const allDishes = [
      ...dayPlan.breakfast.dishes,
      ...dayPlan.lunch.dishes,
      ...dayPlan.dinner.dishes,
    ];
    if (allDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === category))) {
      count++;
    }
  }
  return count;
}

function countVegDaysInWeek(plan: WeeklyPlan): number {
  let count = 0;
  for (const day of DAYS_OF_WEEK) {
    const dayPlan = plan[day];
    const allDishes = [
      ...dayPlan.breakfast.dishes,
      ...dayPlan.lunch.dishes,
      ...dayPlan.dinner.dishes,
    ];
    if (allDishes.some(d =>
      d.mainIngredients.some(ing => {
        const cat = lookupFoodCategory(ing);
        return cat === 'darkVeg' || cat === 'lightVeg';
      })
    )) {
      count++;
    }
  }
  return count;
}

function findRecipesForCategory(
  availableRecipes: Record<DishType, Recipe[]>,
  category: FoodCategory,
  excludeIds: Set<string>,
): Recipe[] {
  const allRecipes = [
    ...availableRecipes.staple,
    ...availableRecipes.meat,
    ...availableRecipes.vegetable,
    ...availableRecipes.soup,
    ...availableRecipes.egg,
    ...availableRecipes.dessert,
  ];
  return allRecipes.filter(r =>
    r.mainIngredients.some(ing => lookupFoodCategory(ing) === category) &&
    !excludeIds.has(r.id)
  );
}

function findDayMissingCategory(plan: WeeklyPlan, category: FoodCategory): DayOfWeek | null {
  const shuffled = [...DAYS_OF_WEEK].sort(() => Math.random() - 0.5);
  for (const day of shuffled) {
    const dayPlan = plan[day];
    const allDishes = [
      ...dayPlan.breakfast.dishes,
      ...dayPlan.lunch.dishes,
      ...dayPlan.dinner.dishes,
    ];
    if (!allDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === category))) {
      return day;
    }
  }
  return null;
}

function hasVegetables(r: Recipe): boolean {
  const VEGGIE_LIKE_STAPLES = ['土豆', '山药', '红薯', '南瓜', '紫薯', '玉米'];
  return r.mainIngredients.some(ing => {
    const cat = lookupFoodCategory(ing);
    if (isVegetableCategory(cat)) return true;
    if (cat === 'staple' && VEGGIE_LIKE_STAPLES.includes(ing)) return true;
    return false;
  });
}

function ensureWeeklyCoverage(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
  weekUsedIds: Set<string>,
): void {
  const rule = getAgeRule(age);
  if (!rule) return;

  const protectedCategories = new Set<FoodCategory>();

  for (const check of rule.weeklyChecks) {
    const currentCount = check.key === 'vegetable'
      ? countVegDaysInWeek(plan)
      : countCategoryInWeek(plan, check.category);
    const target = check.dailyTarget;

    if (check.key === 'fruit' || check.key === 'dairy') {
      protectedCategories.add(check.category);
      continue;
    }

    if (check.key === 'vegetable') {
      protectedCategories.add('darkVeg');
      protectedCategories.add('lightVeg');
    }

    if (currentCount >= target) {
      if (check.key !== 'vegetable') {
        protectedCategories.add(check.category);
      }
      continue;
    }

    const gap = target - currentCount;
    let candidates: Recipe[];
    if (check.key === 'vegetable') {
      candidates = [
        ...findRecipesForCategory(availableRecipes, 'darkVeg', weekUsedIds),
        ...findRecipesForCategory(availableRecipes, 'lightVeg', weekUsedIds),
      ];
    } else {
      candidates = findRecipesForCategory(availableRecipes, check.category, weekUsedIds);
    }
    if (candidates.length === 0) continue;

    let filled = 0;
    for (const recipe of candidates) {
      if (filled >= gap) break;

      let missingDay: DayOfWeek | null;
      if (check.key === 'vegetable') {
        const shuffled = [...DAYS_OF_WEEK].sort(() => Math.random() - 0.5);
        missingDay = shuffled.find(day => {
          const dp = plan[day];
          const allDishes = [...dp.breakfast.dishes, ...dp.lunch.dishes, ...dp.dinner.dishes];
          return !allDishes.some(d =>
            d.mainIngredients.some(ing => {
              const cat = lookupFoodCategory(ing);
              return cat === 'darkVeg' || cat === 'lightVeg';
            })
          );
        }) || null;
      } else {
        missingDay = findDayMissingCategory(plan, check.category);
      }
      if (!missingDay) break;

      const dayPlan = plan[missingDay];

      if (age === '6-8m') {
        if (recipe.dishType === 'dessert') continue;
        const meals: ('breakfast' | 'lunch')[] = ['breakfast', 'lunch'];
        for (const mealType of meals) {
          if (dayPlan[mealType].dishes.length > 0) {
            dayPlan[mealType] = { dishes: [recipe] };
            weekUsedIds.add(recipe.id);
            filled++;
            break;
          }
        }
      } else if (age === '9-11m') {
        let replaced = false;
        const meals: ('breakfast' | 'lunch')[] = ['breakfast', 'lunch'];
        const shuffled = [...meals].sort(() => Math.random() - 0.5);
        for (const mealType of shuffled) {
          if (dayPlan[mealType].dishes.length === 0) continue;
          const existingDish = dayPlan[mealType].dishes[0];
          const wouldLoseProtected = existingDish.mainIngredients.some(
            ing => protectedCategories.has(lookupFoodCategory(ing))
          );
          if (!wouldLoseProtected && recipe.dishType === 'staple') {
            weekUsedIds.delete(existingDish.id);
            dayPlan[mealType] = { dishes: [recipe] };
            weekUsedIds.add(recipe.id);
            filled++;
            replaced = true;
            break;
          }
        }
        if (!replaced) {
          if (recipe.dishType === 'dessert') continue;
          const targetMeal = dayPlan.breakfast.dishes.length <= dayPlan.lunch.dishes.length
            ? dayPlan.breakfast : dayPlan.lunch;
          if (!targetMeal.dishes.some(d => d.id === recipe.id)) {
            if (isSoupyStaple(recipe) && targetMeal.dishes.some(d => isSoupyStaple(d))) continue;
            targetMeal.dishes.push(recipe);
            weekUsedIds.add(recipe.id);
            filled++;
          }
        }
      } else {
        if (recipe.dishType === 'dessert') continue;
        const targetMeal = dayPlan.lunch.dishes.length <= dayPlan.dinner.dishes.length
          ? dayPlan.lunch : dayPlan.dinner;
        if (!targetMeal.dishes.some(d => d.id === recipe.id)) {
          if (recipe.dishType === 'staple') {
            const existingStaples = targetMeal.dishes.filter(d => d.dishType === 'staple');
            if (existingStaples.length > 0) continue;
          }
          if (isSoupyStaple(recipe) && targetMeal.dishes.some(d => isSoupyStaple(d))) continue;
          const hasSoupyStaple = targetMeal.dishes.some(d => isSoupyStaple(d));
          if (hasSoupyStaple && recipe.dishType === 'soup') continue;
          if (hasSoupyStaple && (recipe.name.includes('银耳') || recipe.name.includes('羹'))) continue;
          const testDishes = [...targetMeal.dishes, recipe];
          const reduced = reduceProteinSources(testDishes);
          if (reduced.length < testDishes.length) continue;
          const newProtein = inferProteinSource(recipe);
          if (newProtein !== 'none' && newProtein !== 'mixed') {
            const existingProteins = targetMeal.dishes.map(d => inferProteinSource(d));
            if (existingProteins.includes(newProtein)) continue;
          }
          const limit = getMealDishLimit(age, 'lunch');
          if (targetMeal.dishes.length >= limit.max) continue;
          targetMeal.dishes.push(recipe);
          weekUsedIds.add(recipe.id);
          filled++;
        }
      }
    }

    if (filled >= gap) {
      protectedCategories.add(check.category);
    }
  }
}

// ============================================================
// 工具函数
// ============================================================

function pickWeightedRecipe(filteredList: Recipe[]): Recipe | null {
  if (filteredList.length === 0) return null;
  const shuffled = [...filteredList].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

function containsBeef(recipe: Recipe): boolean {
  return recipe.mainIngredients.some(ingredient => ingredient.includes('牛'));
}

/** 午餐的必选蛋白质必须是独立的肉/禽/鱼/虾菜，蛋和豆制品不能代替。 */
function isLunchMeatDish(recipe: Recipe): boolean {
  return isIndependentLunchMeatDish(recipe);
}

/**
 * 从合规的独立蛋白菜中选午餐蛋白质。
 * 未使用红肉优先；该小池耗尽后回到完整合规池，而不是返回空结果。
 */
function pickLunchProtein(
  candidates: Recipe[],
  usedIds: Set<string>,
  companions: Recipe[],
  avoidBeef: boolean,
): Recipe | null {
  let compliant = candidates.filter(recipe =>
    isLunchMeatDish(recipe)
    && getMealSuitable(recipe).includes('lunch')
    && !hasStapleIngredients(recipe)
    && getRepeatedProteinCategories([...companions, recipe]).length === 0
    && getRepeatedVegetableIngredients([...companions, recipe]).length === 0
  );
  if (avoidBeef && compliant.some(recipe => !containsBeef(recipe))) {
    compliant = compliant.filter(recipe => !containsBeef(recipe));
  }

  const unusedRedMeat = compliant.filter(recipe =>
    !usedIds.has(recipe.id) && getProteinType(recipe) === 'red_meat'
  );
  const pool = unusedRedMeat.length > 0 ? unusedRedMeat : sortByLunchProtein(compliant);
  if (pool.length === 0) return null;
  const bestPriority = getProteinType(pool[0]);
  const best = pool.filter(recipe => getProteinType(recipe) === bestPriority);
  return pickWeightedRecipe(best);
}

/** 最终收敛午餐为：一份主食、一道独立蛋白菜、至少一道真实蔬菜，且蛋白食材不重复。 */
export function enforceLunchRules(
  meal: MealPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
  usedIds: Set<string>,
  breakfastDishes: Recipe[],
): MealPlan {
  const avoidBeef = breakfastDishes.some(containsBeef);
  const suitable = (recipe: Recipe): boolean => getMealSuitable(recipe).includes('lunch');
  const original = meal.dishes.filter(dish => dish.dishType !== 'dessert' && suitable(dish));

  let staple = original.find(dish => dish.dishType === 'staple' && (!avoidBeef || !containsBeef(dish)));
  if (!staple) {
    let staples = availableRecipes.staple.filter(recipe =>
      suitable(recipe) && !isYolkOnlyRecipe(recipe)
      && (!(age === '2-3y' || age === '3-5y') || !recipe.name.includes('粥'))
    );
    if (avoidBeef && staples.some(recipe => !containsBeef(recipe))) {
      staples = staples.filter(recipe => !containsBeef(recipe));
    }
    staple = pickWeightedRecipe(staples.filter(recipe => !usedIds.has(recipe.id)))
      || pickWeightedRecipe(staples)
      || undefined;
  }

  const base = staple ? [staple] : [];
  const lunchProteinCandidates = availableRecipes.meat.filter(dish =>
    suitable(dish) && isLunchMeatDish(dish) && !hasStapleIngredients(dish)
  );
  const hasRedCandidate = lunchProteinCandidates.some(dish =>
    getProteinType(dish) === 'red_meat' && (!avoidBeef || !containsBeef(dish))
  );
  let protein = original.find(dish =>
    isLunchMeatDish(dish)
    && (!avoidBeef || !containsBeef(dish))
    && (!hasRedCandidate || getProteinType(dish) === 'red_meat')
    && getRepeatedProteinCategories([...base, dish]).length === 0
    && getRepeatedVegetableIngredients([...base, dish]).length === 0
  );
  if (!protein) {
    protein = pickLunchProtein(
      lunchProteinCandidates,
      usedIds,
      base,
      avoidBeef,
    ) || undefined;
  }
  if (protein) base.push(protein);

  let vegetable = original.find(dish =>
    getVegetableIngredients(dish).length > 0
    && getIngredientProteinCategories(dish).length === 0
    && !base.some(selected => selected.id === dish.id)
    && getRepeatedProteinCategories([...base, dish]).length === 0
    && getRepeatedVegetableIngredients([...base, dish]).length === 0
  );
  if (!vegetable) {
    const vegetables = availableRecipes.vegetable.filter(dish =>
      suitable(dish)
      && getVegetableIngredients(dish).length > 0
      && getRepeatedProteinCategories([...base, dish]).length === 0
      && getRepeatedVegetableIngredients([...base, dish]).length === 0
    );
    vegetable = pickWeightedRecipe(vegetables.filter(dish => !usedIds.has(dish.id)))
      || pickWeightedRecipe(vegetables)
      || undefined;
  }
  if (vegetable) base.push(vegetable);

  const limit = getMealDishLimit(age, 'lunch').max;
  for (const dish of original) {
    if (base.length >= limit || base.some(selected => selected.id === dish.id)) continue;
    if (dish.dishType === 'staple' || isIndependentProteinDish(dish)) continue;
    if (base.some(item => item.dishType === 'staple' && isSoupyStaple(item)) && dish.dishType === 'soup') continue;
    // Optional soup/sides must not introduce a third protein source after the
    // staple and the required independent protein have been selected.
    if (inferProteinSource(dish) !== 'none') continue;
    if (getRepeatedProteinCategories([...base, dish]).length > 0) continue;
    if (getRepeatedVegetableIngredients([...base, dish]).length > 0) continue;
    base.push(dish);
  }

  for (const dish of base) usedIds.add(dish.id);
  return { dishes: base };
}

const LIGHT_DINNER_TYPES = new Set(['fish', 'shrimp', 'poultry', 'tofu', 'egg']);

function isLightDinnerProtein(recipe: Recipe): boolean {
  const categories = getIngredientProteinCategories(recipe);
  return isIndependentProteinDish(recipe)
    && categories.length > 0
    && categories.every(category => LIGHT_DINNER_TYPES.has(category));
}

function pickDinnerProtein(candidates: Recipe[], usedIds: Set<string>, companions: Recipe[]): Recipe | null {
  const compliant = candidates.filter(recipe =>
    isLightDinnerProtein(recipe)
    && getMealSuitable(recipe).includes('dinner')
    && !hasStapleIngredients(recipe)
    && getRepeatedProteinCategories([...companions, recipe]).length === 0
  );
  // 优先本周未使用；耗尽后必须回到完整轻蛋白池，不能退化成红肉或纯素晚餐。
  const unused = compliant.filter(recipe => !usedIds.has(recipe.id));
  const ranked = sortByDinnerProtein(unused.length > 0 ? unused : compliant);
  if (ranked.length === 0) return null;
  const bestType = getProteinType(ranked[0]);
  return pickWeightedRecipe(ranked.filter(recipe => getProteinType(recipe) === bestType));
}

/**
 * 所有通用后处理完成后的晚餐唯一保障入口。
 * 收敛为主食 + 独立轻蛋白菜 + 真蔬菜，并在轻蛋白完全不可用时才允许清淡红肉兜底。
 */
export function enforceDinnerRules(
  meal: MealPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
  usedIds: Set<string>,
  lunchDishes: Recipe[] = [],
): MealPlan {
  if (!isAge12Plus(age)) return meal;
  const suitable = (recipe: Recipe): boolean => getMealSuitable(recipe).includes('dinner');
  const original = meal.dishes.filter(dish => dish.dishType !== 'dessert' && suitable(dish));
  const allLight = [...availableRecipes.meat, ...availableRecipes.egg, ...availableRecipes.vegetable]
    .filter(recipe => suitable(recipe) && isLightDinnerProtein(recipe) && isEasyDigest(recipe));

  // 优先保留不含蛋白质的主食，为独立轻蛋白菜留出不重复的空间。
  let staple = original.find(dish =>
    dish.dishType === 'staple' && getIngredientProteinCategories(dish).length === 0
  );
  if (!staple) {
    const staples = availableRecipes.staple.filter(recipe => suitable(recipe) && !isYolkOnlyRecipe(recipe));
    staple = pickWeightedRecipe(staples.filter(recipe =>
      !usedIds.has(recipe.id) && getIngredientProteinCategories(recipe).length === 0
    )) || pickWeightedRecipe(staples.filter(recipe => getIngredientProteinCategories(recipe).length === 0))
      || original.find(dish => dish.dishType === 'staple')
      || pickWeightedRecipe(staples) || undefined;
  }

  let base: Recipe[] = staple ? [staple] : [];
  const lunchTypes = new Set(lunchDishes.flatMap(getIngredientProteinCategories));
  let protein = original.find(dish =>
    isLightDinnerProtein(dish)
    && getRepeatedProteinCategories([...base, dish]).length === 0
    && !getIngredientProteinCategories(dish).some(type => lunchTypes.has(type))
  );
  if (!protein) {
    const complementary = allLight.filter(dish =>
      !getIngredientProteinCategories(dish).some(type => lunchTypes.has(type))
    );
    protein = pickDinnerProtein(complementary, usedIds, base)
      || pickDinnerProtein(allLight, usedIds, base)
      || undefined;
  }

  // 极端受限时才用清淡红肉，且仍必须是独立菜而非汤或主食配料。
  if (!protein && allLight.length === 0) {
    const redFallback = availableRecipes.meat.filter(recipe =>
      suitable(recipe) && isIndependentProteinDish(recipe)
      && getProteinType(recipe) === 'red_meat' && isEasyDigest(recipe)
      && getRepeatedProteinCategories([...base, recipe]).length === 0
    );
    protein = pickWeightedRecipe(redFallback.filter(recipe => !usedIds.has(recipe.id)))
      || pickWeightedRecipe(redFallback) || undefined;
  }
  if (protein) base.push(protein);

  let vegetable = original.find(dish =>
    dish.dishType !== 'staple' && !isIndependentProteinDish(dish)
    && getVegetableIngredients(dish).length > 0
    && !getIngredientProteinCategories(dish).includes('red_meat')
    && getRepeatedProteinCategories([...base, dish]).length === 0
    && getRepeatedVegetableIngredients([...base, dish]).length === 0
  );
  if (!vegetable) {
    const vegetables = availableRecipes.vegetable.filter(dish =>
      suitable(dish) && getVegetableIngredients(dish).length > 0
      && getIngredientProteinCategories(dish).length === 0
      && getRepeatedVegetableIngredients([...base, dish]).length === 0
    );
    vegetable = pickWeightedRecipe(vegetables.filter(dish => !usedIds.has(dish.id)))
      || pickWeightedRecipe(vegetables) || undefined;
  }
  if (vegetable) base.push(vegetable);

  // max=3 时自然舍弃汤和额外素菜，永不挤掉唯一主食、轻蛋白或蔬菜。
  base = base.slice(0, getMealDishLimit(age, 'dinner').max);
  for (const dish of base) usedIds.add(dish.id);
  return { dishes: base };
}

// ============================================================
// 公共API（保持向后兼容）
// ============================================================

export function findRecipesByIngredients(
  settings: UserSettings,
  customRecipes: Recipe[],
  ingredientNames: string[]
): Recipe[] {
  const availableRecipes = filterRecipes(settings, customRecipes);
  const allRecipes = [
    ...availableRecipes.staple,
    ...availableRecipes.meat,
    ...availableRecipes.vegetable,
    ...availableRecipes.soup,
    ...availableRecipes.egg,
    ...availableRecipes.dessert,
  ];
  const scored = allRecipes.map(r => {
    const matchCount = ingredientNames.filter(ing =>
      r.mainIngredients.some(mi => mi.includes(ing)) ||
      r.ingredients.some(i => i.name.includes(ing))
    ).length;
    return { recipe: r, score: matchCount };
  });
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.recipe);
}

export function regenerateDish(
  settings: UserSettings,
  customRecipes: Recipe[],
  usedRecipes: Recipe[],
  dishType: DishType
): Recipe | null {
  const availableRecipes = filterRecipes(settings, customRecipes);
  const usedIds = new Set(usedRecipes.map(r => r.id));
  const pool = availableRecipes[dishType].filter(r => !usedIds.has(r.id));
  return pickWeightedRecipe(pool);
}

export function regenerateMeal(
  settings: UserSettings,
  customRecipes: Recipe[],
  usedRecipes: Recipe[],
  mealType: MealType,
  mealContext?: Partial<DayPlan>,
): MealPlan {
  const age = settings.babyAge!;
  if (is6to8m(age)) {
    const availableRecipes = filterRecipes(settings, customRecipes);
    const usedIds = new Set(usedRecipes.map(r => r.id));
    return createSimpleBabyMeal(availableRecipes, usedIds);
  }

  const availableRecipes = filterRecipes(settings, customRecipes);
  const originalUsedIds = new Set(usedRecipes.map(r => r.id));
  const dayUsedStapleNames = new Set<string>();

  if (is9to11m(age)) {
    return createCompositeMeal(availableRecipes, originalUsedIds, mealType);
  }

  // 1岁以上：有限重试。每次使用独立 usedIds，失败候选不会污染下一轮。
  const MAX_REFRESH_ATTEMPTS = 8;
  for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt++) {
    const usedIds = new Set(originalUsedIds);
    let regenerated: MealPlan;
    switch (mealType) {
    case 'breakfast':
      regenerated = createBreakfastPlan(availableRecipes, usedIds, age, dayUsedStapleNames, new Set<string>());
      break;
    case 'lunch':
      regenerated = enforceLunchRules(
        createLunchPlan(availableRecipes, usedIds, age, dayUsedStapleNames, new Set<string>()),
        availableRecipes,
        age,
        usedIds,
        mealContext?.breakfast?.dishes || [],
      );
      break;
    case 'dinner':
      regenerated = createDinnerPlan(
        availableRecipes,
        usedIds,
        age,
        dayUsedStapleNames,
        mealContext?.lunch || { dishes: [] },
        new Set<string>(),
      );
      break;
    }
    const context: DayPlan = {
    breakfast: mealType === 'breakfast' ? regenerated : mealContext?.breakfast || { dishes: [] },
    lunch: mealType === 'lunch' ? regenerated : mealContext?.lunch || { dishes: [] },
    dinner: mealType === 'dinner' ? regenerated : mealContext?.dinner || { dishes: [] },
    };
    enforceVegetableDiversityRules(context, availableRecipes, age, usedIds);
    const hasRedMeat = [...availableRecipes.meat, ...availableRecipes.egg].some(r =>
      getMealSuitable(r).includes('lunch') && isIndependentProteinDish(r) && getProteinType(r) === 'red_meat');
    const hasLightProtein = [...availableRecipes.meat, ...availableRecipes.egg, ...availableRecipes.vegetable].some(isLightDinnerProtein);
    if (validateMealForContext(context[mealType].dishes, age, mealType, context, { hasRedMeat, hasLightProtein }).valid) {
      return context[mealType];
    }
  }
  // 明确安全兜底：沿用当前已验证的餐，而不是把失败的随机候选写回 store。
  const existing = mealContext?.[mealType];
  if (existing && validateMealForContext(existing.dishes, age, mealType, mealContext).valid) return { dishes: [...existing.dishes] };
  throw new Error(`无法生成符合${mealType}上下文规则的安全餐单`);
}

/** 尝试单菜替换；只有临时整餐通过统一上下文校验才返回，否则安全重生成整餐。 */
export function replaceDishInMeal(
  settings: UserSettings,
  customRecipes: Recipe[],
  usedRecipes: Recipe[],
  mealType: MealType,
  meal: MealPlan,
  dishIndex: number,
  dayContext: Partial<DayPlan>,
): MealPlan {
  const target = meal.dishes[dishIndex];
  if (!target || !settings.babyAge) return meal;
  const available = filterRecipes(settings, customRecipes);
  const usedIds = new Set(usedRecipes.map(r => r.id));
  const pool = available[target.dishType];
  const ordered = [...pool.filter(r => !usedIds.has(r.id)), ...pool.filter(r => usedIds.has(r.id))];
  const seen = new Set<string>();
  for (const candidate of ordered) {
    if (seen.has(candidate.id) || candidate.id === target.id) continue;
    seen.add(candidate.id);
    const dishes = meal.dishes.map((dish, index) => index === dishIndex ? candidate : dish);
    const context = { ...dayContext, [mealType]: { dishes } };
    if (validateMealForContext(dishes, settings.babyAge, mealType, context).valid) return { dishes };
  }
  return regenerateMeal(settings, customRecipes, usedRecipes, mealType, dayContext);
}

export function swapMeals(dayPlan: DayPlan, age?: AgeGroup): DayPlan {
  const swapped = { ...dayPlan, lunch: dayPlan.dinner, dinner: dayPlan.lunch };
  if (!age) return swapped;
  const lunch = validateMealForContext(swapped.lunch.dishes, age, 'lunch', swapped);
  const dinner = validateMealForContext(swapped.dinner.dishes, age, 'dinner', swapped);
  return lunch.valid && dinner.valid ? swapped : dayPlan;
}

export function createCustomRecipe(
  name: string,
  ingredients: string,
  steps: string,
  ageGroup: AgeGroup | null,
  dishType: DishType = 'meat'
): Recipe {
  const fallbackAge: AgeGroup = ageGroup || '3-5y';
  const ingredientList = ingredients
    ? ingredients.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.split(/[,，:：]/);
        return { name: parts[0]?.trim() || line.trim(), amount: parts[1]?.trim() || '适量' };
      })
    : [];
  const stepList = steps ? steps.split('\n').filter(line => line.trim()) : [];
  return {
    id: `custom-${Date.now()}`,
    name: name.trim(),
    ingredients: ingredientList,
    steps: stepList,
    ageGroups: [fallbackAge],
    tags: ['自定义'],
    category: '自定义',
    dishType,
    nutrition: '自定义食谱',
    mainIngredients: ingredientList.map(i => i.name),
  };
}
