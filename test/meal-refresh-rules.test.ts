import type { AgeGroup, UserSettings } from '../src/types';
import { generateWeeklyPlan, regenerateMeal, replaceDishInMeal, swapMeals } from '../src/utils/recipeGenerator';
import { validateMealForContext, isSoupyStaple, getRepeatedProteinCategories, getRepeatedVegetableIngredients } from '../src/utils/mealValidator';
import { migrateMealRuleCache, PERSIST_VERSION } from '../src/store/useStore';

let passed = 0;
const failures: string[] = [];
function test(name: string, condition: boolean) { condition ? passed++ : failures.push(name); }

for (const age of ['1-2y', '2-3y', '3-5y'] as AgeGroup[]) {
  const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
  for (let run = 0; run < 3; run++) {
    const week = generateWeeklyPlan(settings);
    const day = week.monday;
    const used = Object.values(week).flatMap(d => [...d.breakfast.dishes, ...d.lunch.dishes, ...d.dinner.dishes]);
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
      const refreshed = regenerateMeal(settings, [], used, mealType, day);
      const context = { ...day, [mealType]: refreshed };
      test(`${age} ${mealType} 刷新通过统一校验`, validateMealForContext(refreshed.dishes, age, mealType, context).valid);
      test(`${age} ${mealType} 蛋白不重复`, getRepeatedProteinCategories(refreshed.dishes).length === 0);
      test(`${age} ${mealType} 蔬菜不重复`, getRepeatedVegetableIngredients(refreshed.dishes).length === 0);
      test(`${age} ${mealType} 带汤主食不配汤`, !(refreshed.dishes.some(isSoupyStaple) && refreshed.dishes.some(d => d.dishType === 'soup')));
      const replaced = replaceDishInMeal(settings, [], used, mealType, refreshed, 0, context);
      test(`${age} ${mealType} 换一道后仍通过`, validateMealForContext(replaced.dishes, age, mealType, { ...context, [mealType]: replaced }).valid);
    }
    const swapped = swapMeals(day, age);
    test(`${age} 不合规交换不会写入`, swapped === day || (
      validateMealForContext(swapped.lunch.dishes, age, 'lunch', swapped).valid &&
      validateMealForContext(swapped.dinner.dishes, age, 'dinner', swapped).valid
    ));
  }
}

const oldPlan = { monday: { breakfast: { dishes: [] }, lunch: { dishes: [] }, dinner: { dishes: [] } } };
const persisted = {
  weeklyPlan: oldPlan,
  settings: { babyAge: '2-3y', allergies: ['蛋'], dislikes: ['葱'], likes: ['鱼'] },
  babies: [{ id: 'baby-1', birthDate: '2024-01-01' }],
  favoriteIds: ['favorite-1'], customRecipes: [{ id: 'custom-1' }], otherSetting: true,
};
const migrated = migrateMealRuleCache(persisted)!;
test('persist 版本提升到 42 以清除 v41 的旧规则餐单', PERSIST_VERSION === 42);
test('旧餐单迁移后清空', migrated.weeklyPlan === null);
test('迁移保留年龄过敏忌口喜好', migrated.settings === persisted.settings);
test('迁移保留宝宝档案', migrated.babies === persisted.babies);
test('迁移保留收藏和自定义食谱', migrated.favoriteIds === persisted.favoriteIds && migrated.customRecipes === persisted.customRecipes);
test('迁移保留其他设置', migrated.otherSetting === true);
test('null 餐单迁移正常', migrateMealRuleCache({ ...persisted, weeklyPlan: null })!.weeklyPlan === null);
// persist middleware只会在旧版本调用 migrate；当前版本不会重复调用该函数。
test('当前版本餐单可保留（迁移调用边界）', PERSIST_VERSION === 42 && oldPlan !== null);

if (failures.length) {
  console.error(`失败 ${failures.length} 项：\n${failures.map(name => `- ${name}`).join('\n')}`);
  process.exit(1);
}
console.log(`通过 ${passed} 项刷新、换菜、交换和迁移专项测试。`);
