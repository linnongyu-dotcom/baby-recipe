import { UserSettings, Recipe, WeeklyPlan, DayPlan, AgeGroup, MealPlan, MealType, DishType, DAYS_OF_WEEK, DayOfWeek, ProteinSource } from '../types';
import { recipes } from '../data/recipes';
import { lookupFoodCategory, isMeatOrEggLike, isVegetableCategory, FoodCategory } from './foodDictionary';
import { getAgeRule, isAge12Plus, isOver2 } from './ageRules';
import {
  isRecipeAgeCompatible,
  isYolkOnlyRecipe,
  inferProteinSource,
  hasDuplicateStaple,
  filterAgeIncompatible,
  removeDuplicateStaples,
  reduceProteinSources,
  limitDishCount,
  getMealDishLimit,
  getRecipeTexture,
  checkMealMandatory,
  hasStapleIngredients,
  getProteinType,
  ProteinType,
  sortByLunchProtein,
  sortByDinnerProtein,
  isEasyDigest,
  getRepeatedProteinCategories,
  Digestibility,
} from './mealValidator';

// 根据用户设置生成一周食谱
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

  // 周营养目标保障：确保每周各类食物达到推荐次数
  if (settings.babyAge) {
    ensureWeeklyCoverage(plan, availableRecipes, settings.babyAge, weekUsedIds);
    removeWeeklyProteinIngredientRepeats(plan, availableRecipes, settings.babyAge);
    ensureLunchRedMeat(plan, availableRecipes, settings.babyAge);
    removeDinnerRedMeatStacking(plan, availableRecipes);
    removeSoupWithSoupyStaples(plan, availableRecipes);
    ensureBreakfastProtein(plan, availableRecipes, settings.babyAge);
    // 必须放在所有可能补菜的后处理之后，否则补入的兜底蔬菜会再次造成全天重复。
    diversifyDailyVegetables(plan, availableRecipes, settings.babyAge);
    // 最后确认早餐蛋白质和午餐肉菜；候选优先不含蔬菜，不破坏去重结果。
    ensureBreakfastProtein(plan, availableRecipes, settings.babyAge);
    ensureLunchRedMeat(plan, availableRecipes, settings.babyAge);
  }

  // 最终全周数量修剪
  trimWeeklyDishCount(plan, settings.babyAge);

  return plan;
}

function ensureBreakfastProtein(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
): void {
  if (!isAge12Plus(age)) return;
  const candidates = [...availableRecipes.egg, ...availableRecipes.meat]
    .filter(recipe => !recipe.name.includes('蛋黄') && !hasStapleIngredients(recipe))
    .sort((a, b) => Number(getVegetableIngredients(a).length > 0) - Number(getVegetableIngredients(b).length > 0));
  for (const day of DAYS_OF_WEEK) {
    const breakfast = plan[day].breakfast;
    if (!breakfast.dishes.some(dish => dish.dishType === 'staple')) {
      const staple = availableRecipes.staple.find(recipe => !isLunchDinnerOnlyStaple(recipe));
      if (staple) {
        const replaceIndex = breakfast.dishes.findIndex(dish => dish.dishType === 'vegetable' || dish.dishType === 'soup');
        if (replaceIndex >= 0) breakfast.dishes[replaceIndex] = staple;
        else breakfast.dishes.unshift(staple);
      }
    }
    if (breakfast.dishes.some(dish => inferProteinSource(dish) !== 'none')) continue;
    const replacement = candidates.find(candidate =>
      getRepeatedProteinCategories([...breakfast.dishes, candidate]).length === 0
    );
    if (!replacement) continue;
    const replaceIndex = breakfast.dishes.findIndex(dish => dish.dishType === 'vegetable' || dish.dishType === 'soup');
    if (replaceIndex >= 0) breakfast.dishes[replaceIndex] = replacement;
    else breakfast.dishes.push(replacement);
    breakfast.dishes = limitDishCount(breakfast.dishes, getMealDishLimit(age, 'breakfast').max);
  }
}

/** 粥、汤面、馄饨等带汤水主食不再搭配独立汤品，早餐也必须遵守。 */
function removeSoupWithSoupyStaples(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
): void {
  for (const day of DAYS_OF_WEEK) {
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const meal = plan[day][mealType];
      if (!meal.dishes.some(isSoupyStaple)) continue;
      meal.dishes = meal.dishes.map(dish => {
        if (dish.dishType !== 'soup') return dish;
        const otherDishes = meal.dishes.filter(other => other !== dish);
        const needsProtein = inferProteinSource(dish) !== 'none';
        const originalProteinType = getProteinType(dish);
        const replacementPool = needsProtein
          ? [...availableRecipes.egg, ...availableRecipes.meat]
          : availableRecipes.vegetable;
        const isSafeReplacement = (candidate: Recipe) =>
          !hasStapleIngredients(candidate) &&
          (!candidate.mealSuitable || candidate.mealSuitable.includes(mealType)) &&
          (mealType === 'breakfast' || !isBreakfastOnly(candidate)) &&
          getRepeatedProteinCategories([...otherDishes, candidate]).length === 0;
        const replacement = replacementPool.find(candidate =>
          isSafeReplacement(candidate) &&
          (!needsProtein || getProteinType(candidate) === originalProteinType)
        ) || (needsProtein
          ? [...availableRecipes.egg, ...availableRecipes.meat].find(isSafeReplacement)
          : null);
        return replacement || dish;
      }).filter(dish => dish.dishType !== 'soup');
    }
  }
}

/**
 * 1 岁以上午餐尽量固定一份红肉。若当前午餐只有蛋、豆、禽或鱼虾，
 * 用红肉替换主要蛋白质菜，而不是在原组合上继续追加，避免蛋白质堆叠。
 */
function ensureLunchRedMeat(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
): void {
  if (!isAge12Plus(age)) return;
  const redMeatPool = [...availableRecipes.meat, ...availableRecipes.soup]
    .filter(recipe =>
      getProteinType(recipe) === 'red_meat' &&
      !isBreakfastOnly(recipe) &&
      !hasStapleIngredients(recipe)
    )
    .sort((a, b) => Number(getVegetableIngredients(a).length > 0) - Number(getVegetableIngredients(b).length > 0));
  if (redMeatPool.length === 0) return;

  for (const day of DAYS_OF_WEEK) {
    const breakfastHasBeef = plan[day].breakfast.dishes.some(dish =>
      inferProteinSource(dish) === 'beef'
    );
    const lunch = plan[day].lunch;
    const finalizeLunch = () => {
      const kept: Recipe[] = [];
      for (const dish of lunch.dishes) {
        if (getRepeatedProteinCategories([...kept, dish]).length === 0) kept.push(dish);
      }
      const minimum = getMealDishLimit(age, 'lunch').min;
      while (kept.length < minimum) {
        const vegetable = availableRecipes.vegetable.find(candidate =>
          inferProteinSource(candidate) === 'none' &&
          !kept.some(dish => dish.id === candidate.id) &&
          getRepeatedProteinCategories([...kept, candidate]).length === 0
        );
        if (!vegetable) break;
        kept.push(vegetable);
      }
      lunch.dishes = kept;
    };
    const currentRedIndex = lunch.dishes.findIndex(dish => getProteinType(dish) === 'red_meat');
    const currentRed = currentRedIndex >= 0 ? lunch.dishes[currentRedIndex] : null;
    if (currentRed && (!breakfastHasBeef || inferProteinSource(currentRed) !== 'beef')) continue;
    const proteinIndex = currentRedIndex >= 0 ? currentRedIndex : lunch.dishes.findIndex(dish =>
      getProteinType(dish) !== 'none' && dish.dishType !== 'staple'
    );
    if (proteinIndex < 0) continue;
    const otherDishes = lunch.dishes.filter((_, index) => index !== proteinIndex);
    const existingPorkDish = otherDishes.find(dish => inferProteinSource(dish) === 'pork');
    if (breakfastHasBeef && existingPorkDish) {
      const vegetableReplacement = availableRecipes.vegetable.find(candidate =>
        inferProteinSource(candidate) === 'none' &&
        hasVegetables(candidate) &&
        getRepeatedProteinCategories([...otherDishes, candidate]).length === 0
      );
      if (vegetableReplacement) lunch.dishes[proteinIndex] = vegetableReplacement;
      finalizeLunch();
      continue;
    }
    const differentRedMeatPool = redMeatPool.filter(candidate =>
      !breakfastHasBeef || inferProteinSource(candidate) !== 'beef'
    );
    const nonBeefProteinPool = [...availableRecipes.meat, ...availableRecipes.egg, ...availableRecipes.soup].filter(candidate =>
      inferProteinSource(candidate) !== 'beef' &&
      inferProteinSource(candidate) !== 'none' &&
      !isBreakfastOnly(candidate) &&
      !hasStapleIngredients(candidate)
    );
    const replacementPool = differentRedMeatPool.length > 0
      ? differentRedMeatPool
      : (breakfastHasBeef && nonBeefProteinPool.length > 0 ? nonBeefProteinPool : redMeatPool);
    const replacement = replacementPool.find(candidate =>
      !lunch.dishes.some(dish => dish.id === candidate.id) &&
      (breakfastHasBeef || getRepeatedProteinCategories([...otherDishes, candidate]).length === 0)
    );
    if (replacement) lunch.dishes[proteinIndex] = replacement;
    finalizeLunch();
  }
}

/** 晚餐已有鱼虾禽蛋豆时，移除或替换额外的红肉配菜。 */
function removeDinnerRedMeatStacking(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
): void {
  const lightTypes: ProteinType[] = ['fish', 'shrimp', 'poultry', 'egg', 'tofu'];
  for (const day of DAYS_OF_WEEK) {
    const dinner = plan[day].dinner;
    const hasLightProtein = dinner.dishes.some(dish => lightTypes.includes(getProteinType(dish)));
    if (!hasLightProtein) continue;
    dinner.dishes = dinner.dishes.flatMap(dish => {
      if (getProteinType(dish) !== 'red_meat') return [dish];
      if (!hasVegetables(dish)) return [];
      const otherDishes = dinner.dishes.filter(other => other !== dish);
      const replacement = availableRecipes.vegetable.find(candidate =>
        inferProteinSource(candidate) === 'none' &&
        hasVegetables(candidate) &&
        getRepeatedProteinCategories([...otherDishes, candidate]).length === 0
      );
      return replacement ? [replacement] : [];
    });
  }
}

/** 取出菜品中真正承担蔬菜角色的食材（不把米饭、肉类等算进来）。 */
function getVegetableIngredients(recipe: Recipe): string[] {
  return recipe.mainIngredients.filter(ingredient =>
    isVegetableCategory(lookupFoodCategory(ingredient))
  );
}

/**
 * 同一天尽量不重复同一种蔬菜。食谱 ID 不同不代表食材不同，例如
 * “蒜蓉西兰花”“西兰花虾仁”“清炒西兰花”实际都在重复西兰花。
 */
function diversifyDailyVegetables(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
): void {
  for (const day of DAYS_OF_WEEK) {
    const usedVegetables = new Set<string>();
    const usedDishIds = new Set<string>();

    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const meal = plan[day][mealType];
      for (let index = 0; index < meal.dishes.length; index++) {
        const dish = meal.dishes[index];
        const vegetables = getVegetableIngredients(dish);
        const repeatsEarlierMeal = vegetables.some(vegetable => usedVegetables.has(vegetable));

        if ((repeatsEarlierMeal && vegetables.length > 0) || usedDishIds.has(dish.id)) {
          const sameTypePool = availableRecipes[dish.dishType];
          const otherMealDishes = meal.dishes.filter((_, dishIndex) => dishIndex !== index);
          const originalHasProtein = inferProteinSource(dish) !== 'none';
          const originalProteinType = getProteinType(dish);
          const replacement = sameTypePool.find(candidate => {
            const candidateVegetables = getVegetableIngredients(candidate);
            return candidate.id !== dish.id &&
              !usedDishIds.has(candidate.id) &&
              (dish.dishType !== 'vegetable' || candidateVegetables.length > 0) &&
              (candidateVegetables.length > 0 || otherMealDishes.some(hasVegetables)) &&
              (!candidate.mealSuitable || candidate.mealSuitable.includes(mealType)) &&
              (mealType === 'breakfast' ? !isLunchDinnerOnlyStaple(candidate) : !isBreakfastOnly(candidate)) &&
              !(mealType === 'lunch' && isOver2(age) && candidate.dishType === 'staple' && candidate.name.includes('粥')) &&
              !(isSoupyStaple(candidate) && otherMealDishes.some(other => other.dishType === 'soup')) &&
              (originalHasProtein
                ? getProteinType(candidate) === originalProteinType
                : inferProteinSource(candidate) === 'none') &&
              candidateVegetables.every(vegetable => !usedVegetables.has(vegetable)) &&
              getRepeatedProteinCategories([...otherMealDishes, candidate]).length === 0;
          });

          if (replacement) {
            meal.dishes[index] = replacement;
          }
        }

        const finalDish = meal.dishes[index];
        usedDishIds.add(finalDish.id);
        for (const vegetable of getVegetableIngredients(finalDish)) {
          usedVegetables.add(vegetable);
        }
      }
    }

    // 若复合菜（如鸡肉丸子汤）中的蔬菜无法在同类型候选中替换，回头替换
    // 当天较早出现的独立素菜，避免因候选角色受限而残留同种蔬菜。
    const vegetableCounts = new Map<string, number>();
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      for (const dish of plan[day][mealType].dishes) {
        for (const vegetable of new Set(getVegetableIngredients(dish))) {
          vegetableCounts.set(vegetable, (vegetableCounts.get(vegetable) || 0) + 1);
        }
      }
    }
    for (const [repeatedVegetable, count] of vegetableCounts) {
      if (count <= 1) continue;
      let resolved = false;
      for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
        const meal = plan[day][mealType];
        const index = meal.dishes.findIndex(dish =>
          dish.dishType === 'vegetable' && getVegetableIngredients(dish).includes(repeatedVegetable)
        );
        if (index < 0) continue;
        const replacement = availableRecipes.vegetable.find(candidate => {
          const vegetables = getVegetableIngredients(candidate);
          return vegetables.length > 0 &&
            inferProteinSource(candidate) === 'none' &&
            !usedDishIds.has(candidate.id) &&
            (!candidate.mealSuitable || candidate.mealSuitable.includes(mealType)) &&
            vegetables.every(vegetable => !vegetableCounts.has(vegetable));
        });
        if (replacement) {
          meal.dishes[index] = replacement;
          usedDishIds.add(replacement.id);
          for (const vegetable of getVegetableIngredients(replacement)) {
            vegetableCounts.set(vegetable, 1);
          }
          resolved = true;
        }
        if (resolved) break;
      }
      if (!resolved) {
        for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
          const meal = plan[day][mealType];
          const index = meal.dishes.findIndex(dish =>
            getVegetableIngredients(dish).includes(repeatedVegetable)
          );
          if (index < 0) continue;
          const original = meal.dishes[index];
          const originalProteinType = getProteinType(original);
          const rolePool = originalProteinType === 'none'
            ? availableRecipes[original.dishType]
            : [...availableRecipes.meat, ...availableRecipes.egg, ...availableRecipes.soup];
          const otherDishes = meal.dishes.filter((_, dishIndex) => dishIndex !== index);
          const replacement = rolePool.find(candidate => {
            const vegetables = getVegetableIngredients(candidate);
            return candidate.id !== original.id &&
              !usedDishIds.has(candidate.id) &&
              getProteinType(candidate) === originalProteinType &&
              (!candidate.mealSuitable || candidate.mealSuitable.includes(mealType)) &&
              (mealType === 'breakfast' ? !isLunchDinnerOnlyStaple(candidate) : !isBreakfastOnly(candidate)) &&
              (vegetables.length > 0 || otherDishes.some(hasVegetables)) &&
              vegetables.every(vegetable => !vegetableCounts.has(vegetable)) &&
              getRepeatedProteinCategories([...otherDishes, candidate]).length === 0;
          });
          if (replacement) {
            meal.dishes[index] = replacement;
            usedDishIds.add(replacement.id);
            resolved = true;
          }
          if (resolved) break;
        }
      }
    }

    const finalVegetables = new Set<string>();
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      for (const dish of plan[day][mealType].dishes) {
        getVegetableIngredients(dish).forEach(vegetable => finalVegetables.add(vegetable));
      }
    }
    if (finalVegetables.size < 2) {
      for (const mealType of ['lunch', 'dinner', 'breakfast'] as MealType[]) {
        const meal = plan[day][mealType];
        const index = meal.dishes.findIndex(dish =>
          dish.dishType === 'vegetable' && getVegetableIngredients(dish).length === 0
        );
        if (index < 0) continue;
        const replacement = availableRecipes.vegetable.find(candidate => {
          const vegetables = getVegetableIngredients(candidate);
          return vegetables.length > 0 &&
            inferProteinSource(candidate) === 'none' &&
            vegetables.every(vegetable => !finalVegetables.has(vegetable));
        });
        if (replacement) meal.dishes[index] = replacement;
        break;
      }
    }
  }
}

/**
 * 周覆盖补菜、午晚餐互换蛋白等后处理都可能改变原本的单餐组合。
 * 在最终裁剪前按实际食材做一次全周清理，避免“肉酱面 + 肉末蔬菜”这类
 * 主菜名称不同、实际蛋白质重复的组合。
 */
function removeWeeklyProteinIngredientRepeats(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
): void {
  if (!isAge12Plus(age)) return;
  for (const day of DAYS_OF_WEEK) {
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const meal = plan[day][mealType];

      const kept: Recipe[] = [];
      for (const dish of meal.dishes) {
        if (getRepeatedProteinCategories([...kept, dish]).length === 0) {
          kept.push(dish);
          continue;
        }

        // 若重复菜同时承担唯一蔬菜角色，用不重复蛋白质的纯蔬菜替换，
        // 而不是直接删除后留下“有主食、有肉、没蔬菜”的餐单。
        if (hasVegetables(dish) && !kept.some(hasVegetables)) {
          const replacement = availableRecipes.vegetable.find(candidate =>
            candidate.id !== dish.id &&
            getRepeatedProteinCategories([...kept, candidate]).length === 0
          );
          if (replacement) kept.push(replacement);
        }
      }

      // 清理重复食材后仍要满足本餐的数量下限；优先补一份不重复蛋白质的蔬菜，
      // 避免修复“重复吃肉”时又制造只有一道早餐或两道正餐的新问题。
      const minimum = getMealDishLimit(age, mealType).min;
      while (kept.filter(d => d.dishType !== 'dessert').length < minimum) {
        const supplement = availableRecipes.vegetable.find(candidate =>
          !kept.some(d => d.id === candidate.id) &&
          (!candidate.mealSuitable || candidate.mealSuitable.includes(mealType)) &&
          getRepeatedProteinCategories([...kept, candidate]).length === 0
        );
        if (!supplement) break;
        kept.push(supplement);
      }
      meal.dishes = kept;
    }
  }
}

// 最终修剪：确保每餐菜品数量不超标
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

// 筛选符合条件的食谱
function filterRecipes(settings: UserSettings, customRecipes: Recipe[] = []): Record<DishType, Recipe[]> {
  const { babyAge, allergies, dislikes, likes } = settings;

  if (!babyAge) {
    return { staple: [], meat: [], vegetable: [], soup: [], egg: [], dessert: [] };
  }

  // 1. 根据年龄段筛选
  let filtered = recipes.filter(recipe => recipe.ageGroups.includes(babyAge));

  // 1.5 合并用户自定义菜谱（匹配当前年龄段的）
  const matchingCustom = customRecipes.filter(r => r.ageGroups.includes(babyAge));
  filtered = [...filtered, ...matchingCustom];

  // 1.6 根据年龄阶段过滤不适合的食物形态和蛋黄类食谱
  filtered = filterAgeIncompatible(filtered, babyAge);

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

  // 3. 降权不喜欢，提权喜欢
  const weighted: { recipe: Recipe; weight: number }[] = [];
  for (const recipe of filtered) {
    let weight = 1;

    // 不喜欢：直接排除，不在候选池中出现
    if (dislikes.length > 0) {
      const hasDisliked = recipe.ingredients.some(ing =>
        dislikes.some(dislike =>
          ing.name.includes(dislike) || dislike.includes(ing.name)
        )
      ) || recipe.mainIngredients.some(ingredient =>
        dislikes.some(dislike =>
          ingredient.includes(dislike) || dislike.includes(ingredient)
        )
      );
      if (hasDisliked) continue; // 跳过不喜欢食材的食谱
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

    weighted.push({ recipe, weight });
  }

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

// ============================================================
// 质量兜底：确保每餐满足必选项，不满足则直接补全
// ============================================================
function ensureMealMandatory(
  mealPlan: MealPlan,
  mealType: MealType,
  availableRecipes: Record<DishType, Recipe[]>,
  weekUsedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
  maxRetries: number,
): void {
  if (!isAge12Plus(age) || mealPlan.dishes.length === 0) return;

  const check = checkMealMandatory(mealPlan.dishes, age, mealType);
  if (check.allOk) return;

  // 缺蛋白质：直接插入一个蛋类或肉类
    if (!check.proteinOk) {
      const hasStaple = mealPlan.dishes.some(d => d.dishType === 'staple');
      if (hasStaple) {
        // 尝试替换主食为含蛋白的（排除同天已用的主食名）
        const proteinStaples = availableRecipes.staple.filter(
          r => inferProteinSource(r) !== 'none' && !dayUsedStapleNames.has(r.name)
        );
        const newStaple = pickWeightedRecipe(proteinStaples.length > 0 ? proteinStaples : availableRecipes.staple.filter(
          r => inferProteinSource(r) !== 'none'
        ));
        if (newStaple) {
          const idx = mealPlan.dishes.findIndex(d => d.dishType === 'staple');
          if (idx >= 0) {
            // 从同天记录中移除旧主食名，添加新主食名
            const oldName = mealPlan.dishes[idx].name;
            dayUsedStapleNames.delete(oldName);
            mealPlan.dishes[idx] = newStaple;
            dayUsedStapleNames.add(newStaple.name);
            weekUsedIds.add(newStaple.id);
          }
        } else {
        // 主食替换失败，直接补蛋肉
        const protein = pickWeightedRecipe([
          ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
          ...availableRecipes.meat,
        ]);
        if (protein && !mealPlan.dishes.some(d => d.id === protein.id)) {
          mealPlan.dishes.push(protein);
          weekUsedIds.add(protein.id);
        }
      }
    }
  }

  // 缺蔬菜：直接补蔬菜或替换主食为含蔬菜的
  const check2 = checkMealMandatory(mealPlan.dishes, age, mealType);
  if (!check2.vegetableOk) {
    const veg = pickWeightedRecipe(
      availableRecipes.vegetable.filter(r =>
        getRepeatedProteinCategories([...mealPlan.dishes, r]).length === 0
      )
    );
    if (veg && !mealPlan.dishes.some(d => d.id === veg.id)) {
      mealPlan.dishes.push(veg);
      weekUsedIds.add(veg.id);
    } else {
      // 蔬菜池空，替换主食为含蔬菜的（排除同天已用的主食名）
      const vegStaples = availableRecipes.staple.filter(
        r => hasVegetables(r) && !dayUsedStapleNames.has(r.name)
      );
      const newStaple = pickWeightedRecipe(vegStaples.length > 0 ? vegStaples : availableRecipes.staple.filter(hasVegetables));
      if (newStaple) {
        const idx = mealPlan.dishes.findIndex(d => d.dishType === 'staple');
        if (idx >= 0) {
          const oldName = mealPlan.dishes[idx].name;
          dayUsedStapleNames.delete(oldName);
          mealPlan.dishes[idx] = newStaple;
          dayUsedStapleNames.add(newStaple.name);
          weekUsedIds.add(newStaple.id);
        }
      }
    }
  }

  // 控制菜品数量不超标
  const dishLimit = getMealDishLimit(age, mealType);
  if (mealPlan.dishes.filter(d => d.dishType !== 'dessert').length > dishLimit.max) {
    mealPlan.dishes = limitDishCount(mealPlan.dishes, dishLimit.max);
  }
}

// 为一天创建食谱（依年龄不同：6-8m为1-2餐辅食，9-11m及以上为三餐）
function createDayPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  settings: UserSettings,
  dayKey: string,
  weekUsedIds: Set<string>
): DayPlan {
  const age = settings.babyAge!;
  const dayUsedStapleNames = new Set<string>();
  const is6to8m = age === '6-8m';

  // 6-8 月龄：1-2 餐辅食，每餐仅 1 道食物，晚餐为空
  if (is6to8m) {
    const breakfast = createSimpleBabyMeal(availableRecipes, weekUsedIds);
    // 第二餐辅食 50% 概率，不强制避免一次引入过多食物
    const lunch = Math.random() < 0.5
      ? createSimpleBabyMeal(availableRecipes, weekUsedIds)
      : { dishes: [] };
    const dinner: MealPlan = { dishes: [] };
    return { breakfast, lunch, dinner };
  }

  const breakfast = createMealPlan(availableRecipes, 'breakfast', weekUsedIds, age, dayUsedStapleNames, dayKey as DayOfWeek);
  const lunch = createMealPlan(availableRecipes, 'lunch', weekUsedIds, age, dayUsedStapleNames, dayKey as DayOfWeek);
  // 9-11 月龄：2 餐辅食，晚餐为空
  const dinner: MealPlan = age === '9-11m' ? { dishes: [] }
    : createMealPlan(availableRecipes, 'dinner', weekUsedIds, age, dayUsedStapleNames, dayKey as DayOfWeek);

  // 1岁以上：午晚餐蛋白质互补（晚餐避免和午餐用同一种蛋白质）
  if (isAge12Plus(age)) {
    applyComplementaryDinner(lunch, dinner, availableRecipes, weekUsedIds, age, dayUsedStapleNames);
  }

  // 质量兜底：强制检查每餐是否有缺失项，最多重试2次
  ensureMealMandatory(breakfast, 'breakfast', availableRecipes, weekUsedIds, age, dayUsedStapleNames, 2);
  ensureMealMandatory(lunch, 'lunch', availableRecipes, weekUsedIds, age, dayUsedStapleNames, 2);
  if (age !== '9-11m') {
    ensureMealMandatory(dinner, 'dinner', availableRecipes, weekUsedIds, age, dayUsedStapleNames, 2);
  }

  const dayPlan = { breakfast, lunch, dinner };
  return dayPlan;
}

// 6-8 月龄简易辅食生成：从食谱池中随机选 1 道食物
// 辅食初期核心目标是保证铁来源（肉泥、蛋黄、高铁米粉），适当偏重蛋白质类
function createSimpleBabyMeal(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
): MealPlan {
  // 蛋白质/铁来源类：肉、蛋
  const proteinPool = [
    ...availableRecipes.meat,
    ...availableRecipes.egg,
  ];
  // 其他类：主食、蔬菜（甜品已移除，统一由加餐建议提供）
  const otherPool = [
    ...availableRecipes.staple,
    ...availableRecipes.vegetable,
  ];

  // 合并并过滤已使用的
  const allRecipes = [...proteinPool, ...otherPool];
  let available = allRecipes.filter(r => !usedIds.has(r.id));
  if (available.length === 0) available = allRecipes;

  // 分离可用池中的蛋白质类和其他类（蛋白质不足时回退复用）
  const availProtein = available.filter(r => proteinPool.includes(r));
  const availOther = available.filter(r => otherPool.includes(r));

  // 40% 概率选蛋白质/铁来源（肉泥、蛋黄），60% 选其他
  // 蛋白质池耗尽时允许复用本周已用过的蛋白质食谱
  let recipe: Recipe | null = null;
  if (availProtein.length > 0 && Math.random() < 0.4) {
    recipe = pickWeightedRecipe(availProtein);
  }
  // 未命中蛋白质或蛋白质池已空，允许回退复用蛋白质
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

// 9-11 月龄复合主食生成：每餐一道主食+动物蛋白+蔬菜
// 优先选择已组合好三要素的食谱，降低妈妈做饭压力
function createCompositeMeal(
  availableRecipes: Record<DishType, Recipe[]>,
  usedIds: Set<string>,
): MealPlan {
  // 分离复合主食（同时含蛋白质+蔬菜）和简单主食
  const compositeStaples: Recipe[] = [];
  const simpleStaples: Recipe[] = [];
  for (const r of availableRecipes.staple) {
    const cats = r.mainIngredients.map(ing => lookupFoodCategory(ing));
    const hasProtein = cats.some(c => ['egg', 'fishSeafood', 'redMeat', 'poultry'].includes(c));
    const hasVeg = cats.some(c => ['darkVeg', 'lightVeg'].includes(c));
    if (hasProtein && hasVeg) {
      compositeStaples.push(r);
    } else {
      simpleStaples.push(r);
    }
  }

  // 70% 优先选复合主食，30% 允许简单主食（保证多样性）
  const preferComposite = Math.random() < 0.7;
  let pool: Recipe[];
  if (preferComposite && compositeStaples.length > 0) {
    pool = compositeStaples;
  } else {
    pool = [...compositeStaples, ...simpleStaples];
  }

  // 过滤已使用的，低龄池不足时允许复用
  let filtered = pool.filter(r => !usedIds.has(r.id));
  if (filtered.length === 0) {
    filtered = pool;
  }

  const recipe = pickWeightedRecipe(filtered);
  if (recipe) {
    usedIds.add(recipe.id);
    return { dishes: [recipe] };
  }
  return { dishes: [] };
}

// 收集一周中某分类出现的次数
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

/** 统计一周中有蔬菜（深色或浅色）的天数 */
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

// 查找食谱池中覆盖指定分类的菜品
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

// 找到一个该分类缺失的日期
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

// 周营养目标保障：确保每周各类食物达到推荐次数
function ensureWeeklyCoverage(
  plan: WeeklyPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  age: AgeGroup,
  weekUsedIds: Set<string>,
): void {
  const rule = getAgeRule(age);
  if (!rule) return;

  // 追踪已被保障的分类，防止后续替换破坏之前的成果
  const protectedCategories = new Set<FoodCategory>();

  for (const check of rule.weeklyChecks) {
    // 蔬菜：统计深色+浅色蔬菜的总覆盖天数
    const currentCount = check.key === 'vegetable'
      ? countVegDaysInWeek(plan)
      : countCategoryInWeek(plan, check.category);
    const target = check.dailyTarget;

    // 水果和奶制品已由加餐建议覆盖，不在正餐中补齐
    if (check.key === 'fruit' || check.key === 'dairy') {
      protectedCategories.add(check.category);
      continue;
    }

    // 蔬菜：同时保护深浅蔬菜
    if (check.key === 'vegetable') {
      protectedCategories.add('darkVeg');
      protectedCategories.add('lightVeg');
    }

    // 已达到目标，跳过
    if (currentCount >= target) {
      if (check.key !== 'vegetable') {
        protectedCategories.add(check.category);
      }
      continue;
    }

    // 需要补齐的缺口
    const gap = target - currentCount;

    // 蔬菜：合并深浅蔬菜候选
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

      // 蔬菜：查找缺少任何蔬菜的天数
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
        // 甜品/点心不替换到主餐
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
        // 优先尝试替换不含已保障分类的菜品
        let replaced = false;
        const meals: ('breakfast' | 'lunch')[] = ['breakfast', 'lunch'];
        const shuffled = [...meals].sort(() => Math.random() - 0.5);
        for (const mealType of shuffled) {
          if (dayPlan[mealType].dishes.length === 0) continue;
          const existingDish = dayPlan[mealType].dishes[0];
          // 检查替换是否会移除已保障的分类
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
        // 如果无法替换（无安全替换位置或候选不是主食），追加一道菜
        if (!replaced) {
          // 甜品/点心不追加到主餐
          if (recipe.dishType === 'dessert') continue;
          const targetMeal = dayPlan.breakfast.dishes.length <= dayPlan.lunch.dishes.length
            ? dayPlan.breakfast : dayPlan.lunch;
          if (!targetMeal.dishes.some(d => d.id === recipe.id)) {
            // 避免重复带汤水主食
            if (isSoupyStaple(recipe) && targetMeal.dishes.some(d => isSoupyStaple(d))) {
              continue;
            }
            targetMeal.dishes.push(recipe);
            weekUsedIds.add(recipe.id);
            filled++;
          }
        }
      } else {
        // 1 岁以上：追加菜品，遵循家庭餐结构规则
        // 甜品/点心不追加到午晚餐（应放在加餐）
        if (recipe.dishType === 'dessert') continue;
        const targetMeal = dayPlan.lunch.dishes.length <= dayPlan.dinner.dishes.length
          ? dayPlan.lunch : dayPlan.dinner;
        if (!targetMeal.dishes.some(d => d.id === recipe.id)) {
          // 避免重复主食
          if (recipe.dishType === 'staple') {
            const existingStaples = targetMeal.dishes.filter(d => d.dishType === 'staple');
            if (existingStaples.length > 0) continue; // 已有主食，不追加
            // 检查同天其他餐是否已有同名主食
            const dayAllDishes = [
              ...dayPlan.breakfast.dishes,
              ...dayPlan.lunch.dishes,
              ...dayPlan.dinner.dishes,
            ];
            if (dayAllDishes.some(d => d.dishType === 'staple' && d.name === recipe.name)) continue;
          }
          // 避免重复带汤水主食
          if (isSoupyStaple(recipe) && targetMeal.dishes.some(d => isSoupyStaple(d))) {
            continue;
          }
          // 该餐已有带汤水主食，不追加汤和银耳羹
          const hasSoupyStaple = targetMeal.dishes.some(d => isSoupyStaple(d));
          if (hasSoupyStaple && recipe.dishType === 'soup') continue;
          if (hasSoupyStaple && (recipe.name.includes('银耳') || recipe.name.includes('羹'))) continue;
          // 避免蛋白质过度堆叠
          const testDishes = [...targetMeal.dishes, recipe];
          const reduced = reduceProteinSources(testDishes);
          if (reduced.length < testDishes.length) continue; // 蛋白质来源冲突，跳过
          // 主要蛋白不同也可能共用同一种配料（如虾仁滑蛋 + 番茄炒蛋）。
          // 从实际食材分类再检查一次，避免蛋类或肉类在同餐重复。
          if (getRepeatedProteinCategories(testDishes).length > 0) continue;
          // 避免同一蛋白来源重复（如已有蛋类主食，不再追加蛋类菜）
          const newProtein = inferProteinSource(recipe);
          if (newProtein !== 'none' && newProtein !== 'mixed') {
            const existingProteins = targetMeal.dishes.map(d => inferProteinSource(d));
            if (existingProteins.includes(newProtein)) continue; // 已有同类蛋白，跳过
          }
          // 控制数量（根据年龄段）
          const limit = getMealDishLimit(age, 'lunch'); // 午晚餐同样的限制
          if (targetMeal.dishes.length >= limit.max) continue;
          targetMeal.dishes.push(recipe);
          weekUsedIds.add(recipe.id);
          filled++;
        }
      }
    }

    // 标记该分类已保障
    if (filled >= gap) {
      protectedCategories.add(check.category);
    }
  }
}

// 早餐专属食物：泥糊类、水果类、典型早餐（不应出现在午晚餐）
function isBreakfastOnly(r: Recipe): boolean {
  const name = r.name;
  if (name.includes('泥') || name.includes('糊') || r.category === '水果') return true;
  const breakfastOnlyNames = [
    '鸡蛋饼', '葱油饼', '豆浆', '豆腐脑', '茶叶蛋', '蛋卷',
    '小馒头', '馒头', '花卷',
    '白煮蛋', '水煮蛋', '蒸蛋', '鸡蛋羹', '蒸蛋羹',
    '南瓜饼', '紫薯饼', '山药糕', '红豆沙', '绿豆糕',
    '包子',
  ];
  if (breakfastOnlyNames.includes(name)) return true;
  if (name.includes('粥')) {
    const isBabyRecipe = r.ageGroups.some(ag => ag === '6-8m' || ag === '9-11m');
    if (!isBabyRecipe) return true;
  }
  return false;
}

// 午晚餐专属主食：米饭类、炒饭类、复杂面类（不应出现在早餐）
function isLunchDinnerOnlyStaple(r: Recipe): boolean {
  const name = r.name;
  if ((name.includes('米饭') || name.endsWith('饭')) && !name.includes('粥')) return true;
  if (name.includes('炒饭')) return true;
  if (name.includes('拌面') || name.includes('炸酱') || name.includes('凉面') ||
      name.includes('肉酱面') || name.includes('牛肉面') || name.includes('阳春面') ||
      name.includes('鸡丝面') || name.includes('肉丝面') || name.includes('番茄面') ||
      name.includes('番茄鸡蛋面') || name.includes('番茄牛肉面') || name.includes('肉末粉丝')) return true;
  return false;
}

// 判断食谱是否含蔬菜（包括根茎类常作蔬菜的食材）
const VEGGIE_LIKE_STAPLES = ['土豆', '山药', '红薯', '南瓜', '紫薯', '玉米'];
function hasVegetables(r: Recipe): boolean {
  return r.mainIngredients.some(ing => {
    const cat = lookupFoodCategory(ing);
    if (isVegetableCategory(cat)) return true;
    if (cat === 'staple' && VEGGIE_LIKE_STAPLES.includes(ing)) return true;
    return false;
  });
}

// 判断主食是否带汤水（馄饨、粥、汤面、疙瘩汤等）
function isSoupyStaple(r: Recipe): boolean {
  if (r.dishType !== 'staple') return false;
  const name = r.name;
  if (name.includes('馄饨')) return true;
  if (name.includes('粥')) return true;
  if (name.includes('汤')) return true;
  if (name.includes('面')) {
    const dryNoodleKeywords = ['拌面', '炸酱', '肉酱面', '凉面', '炒面'];
    if (!dryNoodleKeywords.some(k => name.includes(k))) return true;
  }
  return false;
}

// 为一餐创建多道菜组合
function createMealPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  mealType: MealType,
  usedIds: Set<string>,
  babyAge: AgeGroup,
  dayUsedStapleNames: Set<string>,
  dayKey?: DayOfWeek,
): MealPlan {
  // 9-11 月龄：每餐一道复合主食（主食+动物蛋白+蔬菜），不做分散式搭配
  if (babyAge === '9-11m') {
    return createCompositeMeal(availableRecipes, usedIds);
  }

  // 12个月以上：家庭餐结构 = 主食x1 + 蛋白质x1 + 蔬菜x1-2 + 可选水果
  return createFamilyMealPlan(availableRecipes, mealType, usedIds, babyAge, dayUsedStapleNames, dayKey);
}

// 每周轮换蛋白质重点：红肉主要放午餐，鱼虾和禽肉更多放晚餐，
// 同时穿插蛋、豆，避免“优先红肉”退化为一周七天午餐都吃红肉。
const LUNCH_PROTEIN_ROTATION: ProteinType[] = [
  'red_meat', 'red_meat', 'red_meat', 'red_meat', 'red_meat', 'red_meat', 'red_meat',
];
const DINNER_PROTEIN_ROTATION: ProteinType[] = [
  'fish', 'shrimp', 'poultry', 'fish', 'tofu', 'shrimp', 'poultry',
];

function pickMealProtein(
  recipes: Recipe[],
  mealType: MealType,
  dayKey?: DayOfWeek,
): Recipe | null {
  if (recipes.length === 0) return null;
  const rotation = mealType === 'lunch' ? LUNCH_PROTEIN_ROTATION : DINNER_PROTEIN_ROTATION;
  const dayIndex = dayKey ? DAYS_OF_WEEK.indexOf(dayKey) : 0;
  const preferred = rotation[Math.max(0, dayIndex)];
  const preferredPool = recipes.filter(recipe => getProteinType(recipe) === preferred);
  if (preferredPool.length > 0) return pickWeightedRecipe(preferredPool);

  // 当前偏好受过敏、忌口或候选耗尽影响时，仍按餐次营养重点降级选择。
  const fallbackOrder: ProteinType[] = mealType === 'lunch'
    ? ['red_meat', 'poultry', 'egg', 'tofu', 'fish', 'shrimp']
    : ['fish', 'shrimp', 'poultry', 'tofu', 'egg', 'red_meat'];
  for (const proteinType of fallbackOrder) {
    const sameType = recipes.filter(recipe => getProteinType(recipe) === proteinType);
    if (sameType.length > 0) return pickWeightedRecipe(sameType);
  }
  return pickWeightedRecipe(recipes);
}

function uniqueRecipes(recipes: Recipe[]): Recipe[] {
  return [...new Map(recipes.map(recipe => [recipe.id, recipe])).values()];
}

// ============================================================
// 12个月以上家庭餐推荐生成
// 流程：主食 → 蛋白质 → 蔬菜 → 水果 → 校验修正
// ============================================================
function createFamilyMealPlan(
  availableRecipes: Record<DishType, Recipe[]>,
  mealType: MealType,
  usedIds: Set<string>,
  babyAge: AgeGroup,
  dayUsedStapleNames: Set<string>,
  dayKey?: DayOfWeek,
): MealPlan {
  const isBreakfast = mealType === 'breakfast';
  const isOver2 = babyAge === '2-3y' || babyAge === '3-5y';
  const dishLimit = getMealDishLimit(babyAge, mealType);

  // 过滤掉整周已使用的食谱
  const filterUnused = (pool: Recipe[]): Recipe[] => {
    const filtered = pool.filter(r => !usedIds.has(r.id));
    if (filtered.length === 0) return pool; // 池耗尽时复用
    return filtered;
  };

  // 过滤不适合本餐的食谱
  const filterByMealTime = (pool: Recipe[], mt: MealType): Recipe[] => {
    if (mt === 'breakfast') {
      // 早餐排除午晚餐专属主食（米饭、炒饭等）
      return pool.filter(r => !isLunchDinnerOnlyStaple(r));
    }
    // 午晚餐排除早餐专属（泥糊、水果、典型早餐面点）
    return pool.filter(r => !isBreakfastOnly(r));
  };

  // 各类型可用池（过滤已使用 + 餐次适配）
  const pool = {
    staple: filterByMealTime(filterUnused(availableRecipes.staple), mealType),
    meat: filterByMealTime(filterUnused(availableRecipes.meat), mealType),
    vegetable: filterByMealTime(filterUnused(availableRecipes.vegetable), mealType),
    soup: filterByMealTime(filterUnused(availableRecipes.soup), mealType),
    egg: filterByMealTime(filterUnused(availableRecipes.egg), mealType),
    dessert: filterByMealTime(filterUnused(availableRecipes.dessert), mealType),
  };

  // 过滤掉当天已用主食（米饭除外）
  let staplePool = pool.staple.filter(r => {
    const isRice = r.name.includes('米饭') || r.name === '白米饭';
    if (isRice) return true;
    return !dayUsedStapleNames.has(r.name);
  });

  // 2岁以上午餐不喝粥（1-2岁可以偶尔喝）
  if (mealType === 'lunch' && isOver2) {
    staplePool = staplePool.filter(r => !r.name.includes('粥'));
  }

  // 1岁以上：排除蛋黄类主食（如蛋黄蔬菜面、蛋黄面条、蛋黄粥），全蛋时代不应单吃蛋黄
  if (isAge12Plus(babyAge)) {
    staplePool = staplePool.filter(r => !isYolkOnlyRecipe(r));
  }

  // 午晚餐优先使用纯主食，把肉鱼蛋豆作为清晰、足量的独立菜品；
  // 避免“面里有一点肉末”就被当成整餐的主要蛋白质。
  if (!isBreakfast) {
    const plainStaples = staplePool.filter(r => inferProteinSource(r) === 'none');
    if (plainStaples.length > 0) staplePool = plainStaples;
  }

  // ========== 步骤1：选主食 × 1 ==========
  const stapleRecipe = pickWeightedRecipe(staplePool.length > 0 ? staplePool : pool.staple);
  const selected: Recipe[] = [];

  if (stapleRecipe) {
    selected.push(stapleRecipe);
    usedIds.add(stapleRecipe.id);
    dayUsedStapleNames.add(stapleRecipe.name);
  }

  // 判断主食属性
  const stapleHasProtein = stapleRecipe ? inferProteinSource(stapleRecipe) !== 'none' : false;
  const stapleIsSoupy = stapleRecipe ? isSoupyStaple(stapleRecipe) : false;

  // 带汤水主食不配汤、不配银耳羹
  const filteredSoupPool = stapleIsSoupy ? [] : pool.soup;

  // ========== 步骤2：选蛋白质 × 1（按餐次适配） ==========
  // 辅助：过滤掉含主食食材的蛋白质候选（避免双主食，如面条+鸡蛋饼）
  const filterNonStaple = (recipes: Recipe[]): Recipe[] =>
    recipes.filter(r => !hasStapleIngredients(r));

  if (isBreakfast) {
    // 早餐蛋白质：蛋类优先 → 肉类 → 含蛋白汤 → 豆制品
    if (!stapleHasProtein) {
      let proteinPools = sortByLunchProtein(filterNonStaple(pool.egg.filter(r => !r.name.includes('蛋黄'))));
      if (proteinPools.length === 0) proteinPools = sortByLunchProtein(pool.meat);
      if (proteinPools.length === 0) proteinPools = filteredSoupPool.filter(r => inferProteinSource(r) !== 'none');
      let proteinRecipe = pickWeightedRecipe(proteinPools);
      // 兜底
      if (!proteinRecipe) {
        const fallback = sortByLunchProtein([
          ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
          ...availableRecipes.meat,
          ...availableRecipes.soup.filter(r => inferProteinSource(r) !== 'none'),
        ]);
        proteinRecipe = pickWeightedRecipe(fallback);
      }
      if (proteinRecipe) {
        selected.push(proteinRecipe);
        usedIds.add(proteinRecipe.id);
      }
    }
  } else if (mealType === 'lunch') {
    // ===== 午餐：主食 + 优质蛋白 + 蔬菜（一天重点餐） =====
    // 蛋白质优先级：红肉 > 鱼虾 > 蛋类 > 豆制品 > 禽肉
    if (!stapleHasProtein) {
      // 构建蛋白质候选池，按午餐优先级排序
      let proteinCandidates: Recipe[] = [
        ...pool.meat,
        ...filterNonStaple(pool.egg.filter(r => !r.name.includes('蛋黄'))),
        ...filteredSoupPool.filter(r => inferProteinSource(r) !== 'none'),
        // 周内同类菜品用完时仍保留各蛋白质类型，避免后半周午餐退化成素餐。
        ...availableRecipes.meat.filter(r => !isBreakfastOnly(r)),
        ...filterNonStaple(availableRecipes.egg.filter(r => !r.name.includes('蛋黄') && !isBreakfastOnly(r))),
        ...(stapleIsSoupy ? [] : availableRecipes.soup.filter(r => inferProteinSource(r) !== 'none' && !isBreakfastOnly(r))),
      ];
      proteinCandidates = sortByLunchProtein(uniqueRecipes(proteinCandidates));
      let proteinRecipe = pickMealProtein(proteinCandidates, 'lunch', dayKey);

      // 兜底：从原始可用池选
      if (!proteinRecipe) {
        proteinCandidates = sortByLunchProtein([
          ...availableRecipes.meat,
          ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
          ...(stapleIsSoupy ? [] : availableRecipes.soup.filter(r => inferProteinSource(r) !== 'none')),
        ]);
        proteinRecipe = pickMealProtein(proteinCandidates, 'lunch', dayKey);
      }

      if (proteinRecipe) {
        selected.push(proteinRecipe);
        usedIds.add(proteinRecipe.id);
      }
    }
    // 午餐必须强制有蛋白：如果主食含蛋白质但类型不好（如仅含蛋的面条），不跳过独立蛋白质
    // 主食含蛋白且已经是红肉/鱼虾，则不需要额外补
  } else {
    // ===== 晚餐：主食 + 易消化蛋白质 + 蔬菜 =====
    // 蛋白质优先级：蛋类 > 鱼类 > 豆制品 > 禽肉 > 红肉（仅碎末）
    if (!stapleHasProtein) {
      // 构建蛋白质候选池，按晚餐优先级排序，优先易消化
      let proteinCandidates: Recipe[] = [
        ...filterNonStaple(pool.egg.filter(r => !r.name.includes('蛋黄'))),
        ...pool.meat,
        ...filteredSoupPool.filter(r => inferProteinSource(r) !== 'none' && isEasyDigest(r)),
        ...filterNonStaple(availableRecipes.egg.filter(r => !r.name.includes('蛋黄') && !isBreakfastOnly(r))),
        ...availableRecipes.meat.filter(r => !isBreakfastOnly(r) && !r.name.includes('炸')),
        ...(stapleIsSoupy ? [] : availableRecipes.soup.filter(r => inferProteinSource(r) !== 'none' && isEasyDigest(r) && !isBreakfastOnly(r))),
      ];
      proteinCandidates = sortByDinnerProtein(uniqueRecipes(proteinCandidates));

      // 补充：不太易消化但可接受的候选
      if (proteinCandidates.length === 0) {
        proteinCandidates = sortByDinnerProtein([
          ...filterNonStaple(pool.egg.filter(r => !r.name.includes('蛋黄'))),
          ...pool.meat,
          ...filteredSoupPool.filter(r => inferProteinSource(r) !== 'none'),
        ]);
      }

      let proteinRecipe = pickMealProtein(proteinCandidates, 'dinner', dayKey);

      // 兜底：从原始可用池选（排除明显不适合晚餐的重口味）
      if (!proteinRecipe) {
        proteinCandidates = sortByDinnerProtein([
          ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
          ...availableRecipes.meat.filter(r => !r.name.includes('红烧') && !r.name.includes('炸')),
          ...(stapleIsSoupy ? [] : availableRecipes.soup.filter(r => inferProteinSource(r) !== 'none' && !r.name.includes('红烧') && !r.name.includes('炸'))),
        ]);
        proteinRecipe = pickMealProtein(proteinCandidates, 'dinner', dayKey);
      }

      if (proteinRecipe) {
        selected.push(proteinRecipe);
        usedIds.add(proteinRecipe.id);
      }
    }
  }

  // ========== 步骤3：选蔬菜 × 1-2 ==========
  const existingIds = new Set(selected.map(d => d.id));
  const isDinner = mealType === 'dinner';

  // 蔬菜候选池：午餐含汤品，晚餐不含汤（汤品尽量安排在午餐）
  const vegPool = [
    ...pool.vegetable,
    ...(isDinner ? [] : filteredSoupPool.filter(r => hasVegetables(r))),
  ].filter(r =>
    !existingIds.has(r.id) &&
    getRepeatedProteinCategories([...selected, r]).length === 0
  );

  // 早餐蔬菜可选；午晚餐安排一道蔬菜即可。不同颜色和品种放到“全天/全周”
  // 维度轮换，而不是机械拆成两道素菜，减少家庭每顿的开火数量。
  const needVegCount = isBreakfast
    ? (Math.random() < 0.5 ? 1 : 0)
    : 1;

  for (let i = 0; i < needVegCount; i++) {
    let vegRecipe = pickWeightedRecipe(vegPool);
    // 兜底：从原始可用池选蔬菜（晚餐也不选汤）
    if (!vegRecipe) {
      const fallbackVeg = [
        ...availableRecipes.vegetable,
        ...(isDinner ? [] : filteredSoupPool.filter(r => hasVegetables(r))),
      ].filter(r =>
        !existingIds.has(r.id) &&
        getRepeatedProteinCategories([...selected, r]).length === 0
      );
      vegRecipe = pickWeightedRecipe(fallbackVeg);
    }
    if (vegRecipe) {
      selected.push(vegRecipe);
      usedIds.add(vegRecipe.id);
      existingIds.add(vegRecipe.id);
      const idx = vegPool.indexOf(vegRecipe);
      if (idx > -1) vegPool.splice(idx, 1);
    }
  }

  // ========== 步骤4.5：最终兜底补全 ==========
  if (isBreakfast) {
    // 早餐确保有蛋白质（主食不含蛋白质时补蛋/肉，或换含蛋白主食）
    const hasBreakfastProtein = selected.some(d => {
      return inferProteinSource(d) !== 'none';
    });
    if (!hasBreakfastProtein && selected.length > 0) {
      const anyProtein = pickWeightedRecipe([
        ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
        ...availableRecipes.meat,
      ]);
      if (anyProtein && !selected.some(d => d.id === anyProtein.id)) {
        selected.push(anyProtein);
        usedIds.add(anyProtein.id);
      } else {
        // 蛋肉池耗尽：尝试将主食替换为含蛋白质的主食（允许复用已用的）
        const stapleIdx = selected.findIndex(d => d.dishType === 'staple');
        if (stapleIdx >= 0) {
          // 优先未使用过的含蛋白主食，其次允许复用
          let proteinStaples = availableRecipes.staple.filter(
            r => inferProteinSource(r) !== 'none' && !selected.some(d => d.id === r.id)
          );
          if (proteinStaples.length === 0) {
            proteinStaples = availableRecipes.staple.filter(
              r => inferProteinSource(r) !== 'none'
            );
          }
          const newStaple = pickWeightedRecipe(proteinStaples);
          if (newStaple) {
            selected[stapleIdx] = newStaple;
            usedIds.add(newStaple.id);
          }
        }
      }
    }
  } else {
    // 确保午餐/晚餐至少有一个蛋白质来源
    const hasProteinNow = selected.some(d => {
      if (d.dishType === 'meat' || d.dishType === 'egg') return true;
      if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
      if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
      return false;
    });
    if (!hasProteinNow) {
      const anyProtein = pickWeightedRecipe([
        ...availableRecipes.meat,
        ...availableRecipes.egg.filter(r => !r.name.includes('蛋黄')),
      ]);
      if (anyProtein && !selected.some(d => d.id === anyProtein.id)) {
        selected.push(anyProtein);
        usedIds.add(anyProtein.id);
      }
    }

    // 确保午餐/晚餐至少有一个蔬菜
    const hasVegNow = selected.some(d => {
      if (d.dishType === 'vegetable') return true;
      return hasVegetables(d);
    });
    if (!hasVegNow) {
      const anyVeg = pickWeightedRecipe(
        availableRecipes.vegetable.filter(r =>
          getRepeatedProteinCategories([...selected, r]).length === 0
        )
      );
      if (anyVeg && !selected.some(d => d.id === anyVeg.id)) {
        selected.push(anyVeg);
        usedIds.add(anyVeg.id);
      } else {
        // 蔬菜池耗尽：尝试将主食替换为含蔬菜的主食
        const stapleIdx = selected.findIndex(d => d.dishType === 'staple');
        if (stapleIdx >= 0) {
          const veggieStaples = availableRecipes.staple.filter(
            r => hasVegetables(r) && !selected.some(d => d.id === r.id)
          );
          const newStaple = pickWeightedRecipe(veggieStaples.length > 0 ? veggieStaples : availableRecipes.staple.filter(hasVegetables));
          if (newStaple) {
            selected[stapleIdx] = newStaple;
            usedIds.add(newStaple.id);
          }
        }
      }
    }
  }

  // ========== 步骤5：校验与修正 ==========
  let finalDishes = [...selected];

  // 5.1 移除重复主食
  if (hasDuplicateStaple(finalDishes).conflict) {
    finalDishes = removeDuplicateStaples(finalDishes);
  }

  // 5.2 精简蛋白质来源
  finalDishes = reduceProteinSources(finalDishes);

  // 5.3 控制菜品数量
  finalDishes = limitDishCount(finalDishes, dishLimit.max);

  // 5.4 午晚餐保底：至少达到最低数量
  if (!isBreakfast && finalDishes.length < dishLimit.min) {
    const existingAllIds = new Set(finalDishes.map(d => d.id));
    // 优先补素菜
    const extraVeg = pickWeightedRecipe(pool.vegetable.filter(r => !existingAllIds.has(r.id)));
    if (extraVeg) {
      finalDishes.push(extraVeg);
      usedIds.add(extraVeg.id);
    }
  }

  // 5.5 最终防线：带汤水主食移除所有汤和银耳
  if (stapleIsSoupy) {
    finalDishes = finalDishes.filter(
      d => d.dishType !== 'soup' && !d.name.includes('银耳') && !d.name.includes('羹')
    );
  }

  return { dishes: finalDishes };
}

// ============================================================
// 午晚餐蛋白质互补：晚餐避免和午餐用同一种蛋白质
// ============================================================
function applyComplementaryDinner(
  lunch: MealPlan,
  dinner: MealPlan,
  availableRecipes: Record<DishType, Recipe[]>,
  weekUsedIds: Set<string>,
  age: AgeGroup,
  dayUsedStapleNames: Set<string>,
): void {
  // 收集午餐的蛋白质来源
  const lunchProteins = new Set<ProteinSource>();
  for (const dish of lunch.dishes) {
    const p = inferProteinSource(dish);
    if (p !== 'none' && p !== 'mixed') lunchProteins.add(p);
  }

  // 收集晚餐的蛋白质来源
  const dinnerProteins = new Set<ProteinSource>();
  for (const dish of dinner.dishes) {
    const p = inferProteinSource(dish);
    if (p !== 'none' && p !== 'mixed') dinnerProteins.add(p);
  }

  // 检查是否重叠（午餐和晚餐有相同蛋白质来源）
  const overlap = [...lunchProteins].filter(p => dinnerProteins.has(p));
  if (overlap.length === 0) return; // 没有重叠，无需调整

  // 尝试替换晚餐中的重叠蛋白质菜品
  for (const overlapProtein of overlap) {
    // 找到晚餐中属于该蛋白质的菜品
    const dishToReplace = dinner.dishes.find(d => {
      const p = inferProteinSource(d);
      return p === overlapProtein && d.dishType !== 'staple';
    });
    if (!dishToReplace) continue;

    // 构建替换候选池：荤菜+蛋类中不同于午餐蛋白质的
    const replaceCandidates = [
      ...availableRecipes.meat,
      ...availableRecipes.egg,
    ].filter(r => {
      const p = inferProteinSource(r);
      const remainingDinner = dinner.dishes.filter(d => d !== dishToReplace);
      return p !== 'none' &&
        p !== overlapProtein &&
        !lunchProteins.has(p) &&
        getRepeatedProteinCategories([...remainingDinner, r]).length === 0;
    });

    const replacement = pickWeightedRecipe(replaceCandidates);
    if (replacement) {
      // 替换
      const idx = dinner.dishes.indexOf(dishToReplace);
      if (idx >= 0) {
        const newDishes = [...dinner.dishes];
        newDishes[idx] = replacement;
        dinner.dishes = newDishes;
        // 更新已用 ID
        weekUsedIds.delete(dishToReplace.id);
        weekUsedIds.add(replacement.id);
      }
    }
  }
}

// 根据权重选择食谱（加权随机选择，让偏好食物更易出现）
// 如果 filteredList 为空（所有食谱都已使用过），则返回 null
function pickWeightedRecipe(filteredList: Recipe[]): Recipe | null {
  if (filteredList.length === 0) return null;
  // 对候选列表进行洗牌，然后从中随机选一个
  const shuffled = [...filteredList].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

// 根据用户提供的食材，搜索匹配的食谱并按匹配度排序
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
  customRecipes: Recipe[],
  usedRecipes: Recipe[],
  dishType: DishType
): Recipe | null {
  const availableRecipes = filterRecipes(settings, customRecipes);
  const usedIds = new Set(usedRecipes.map(r => r.id));

  const pool = availableRecipes[dishType].filter(r => !usedIds.has(r.id));
  return pickWeightedRecipe(pool);
}

// 重新生成单餐食谱
export function regenerateMeal(
  settings: UserSettings,
  customRecipes: Recipe[],
  usedRecipes: Recipe[],
  mealType: MealType
): MealPlan {
  const age = settings.babyAge!;

  // 6-8 月龄：简易辅食模式
  if (age === '6-8m') {
    const availableRecipes = filterRecipes(settings, customRecipes);
    const usedIds = new Set(usedRecipes.map(r => r.id));
    return createSimpleBabyMeal(availableRecipes, usedIds);
  }

  const availableRecipes = filterRecipes(settings, customRecipes);
  const usedRecipeIds = usedRecipes.map(r => r.id);

  // 传入完整合规池，由 createFamilyMealPlan 优先过滤已使用菜品并在某一营养
  // 类型耗尽时回退完整池。若先在这里永久删掉已使用红肉，刷新午餐到后半周
  // 就可能只剩“蛋花汤 + 两道素菜”，绕过午餐红肉优先规则。
  // 随机候选仍可能偶发形成同餐蔬菜重复等上下文冲突，因此刷新结果必须先
  // 通过与单菜替换相同的整餐校验，不能生成一次后未经验证直接写入状态。
  for (let attempt = 0; attempt < 12; attempt++) {
    const meal = createMealPlan(
      availableRecipes,
      mealType,
      new Set(usedRecipeIds),
      age,
      new Set<string>()
    );
    if (isMealSuitableForContext(meal, mealType, age)) return meal;
  }

  // 食谱池受严重过敏/忌口限制时保留最后一次生成结果，由 UI 继续允许用户调整。
  return createMealPlan(availableRecipes, mealType, new Set(usedRecipeIds), age, new Set<string>());
}

/** 用户手动“换一道”后检查组合是否仍满足该餐次的硬规则。 */
export function isMealSuitableForContext(
  mealPlan: MealPlan,
  mealType: MealType,
  age: AgeGroup,
): boolean {
  if (!isAge12Plus(age)) return true;
  const dishes = mealPlan.dishes;
  if (getRepeatedProteinCategories(dishes).length > 0) return false;
  const vegetables = dishes.flatMap(getVegetableIngredients);
  if (new Set(vegetables).size !== vegetables.length) return false;
  if (dishes.some(isSoupyStaple) && dishes.some(dish => dish.dishType === 'soup')) return false;
  const mandatory = checkMealMandatory(dishes, age, mealType);
  if (!mandatory.stapleOk || !mandatory.proteinOk) return false;
  if (mealType !== 'breakfast' && !mandatory.vegetableOk) return false;

  if (mealType === 'lunch') {
    return dishes.some(dish => dish.dishType !== 'staple' && getProteinType(dish) === 'red_meat');
  }
  if (mealType === 'dinner') {
    const lightTypes: ProteinType[] = ['fish', 'shrimp', 'poultry', 'egg', 'tofu'];
    return dishes.some(dish => dish.dishType !== 'staple' && lightTypes.includes(getProteinType(dish))) &&
      !dishes.some(dish => getProteinType(dish) === 'red_meat');
  }
  return true;
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
  ageGroup: AgeGroup | null,
  dishType: DishType = 'meat'
): Recipe {
  const fallbackAge: AgeGroup = ageGroup || '3-5y';
  // 解析食材（选填）
  const ingredientList = ingredients
    ? ingredients.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.split(/[,，:：]/);
        return {
          name: parts[0]?.trim() || line.trim(),
          amount: parts[1]?.trim() || '适量',
        };
      })
    : [];

  // 解析步骤（选填）
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
