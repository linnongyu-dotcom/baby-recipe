import type { AgeGroup, DayPlan, DishType, Recipe, UserSettings } from '../src/types';
import { enforceVegetableDiversityRules, generateWeeklyPlan, regenerateMeal } from '../src/utils/recipeGenerator';
import { checkMealMandatory, getRepeatedVegetableIngredients, getVegetableIngredients, validateDinnerRules } from '../src/utils/mealValidator';

function dish(name: string, mainIngredients: string[], dishType: DishType = 'vegetable'): Recipe {
  return { id: name, name, mainIngredients, dishType, ingredients: [], steps: [], ageGroups: ['1-2y', '2-3y', '3-5y'], tags: [], category: '', nutrition: '', mealSuitable: ['breakfast', 'lunch', 'dinner'] };
}
const rice = dish('米饭', ['大米'], 'staple');
const pork = dish('胡萝卜炒肉', ['胡萝卜', '猪肉'], 'meat');
const fish = dish('清蒸鲈鱼', ['鲈鱼'], 'meat');
const broccoli = dish('清炒西兰花', ['西兰花']);
const tomatoBroccoli = dish('番茄炒西兰花', ['番茄', '西兰花']);
const garlicBroccoli = dish('蒜蓉西兰花', ['西兰花', '蒜']);
const shrimpBroccoli = dish('西兰花虾仁', ['西兰花', '虾仁'], 'meat');
const tomatoEgg = dish('番茄炒蛋', ['番茄', '鸡蛋'], 'egg');
const tomatoSoup = dish('西红柿鸡蛋汤', ['西红柿', '鸡蛋'], 'soup');
const cucumberEgg = dish('黄瓜炒蛋', ['黄瓜', '鸡蛋'], 'egg');
const cucumber = dish('清炒黄瓜', ['黄瓜']);
const carrot = dish('蒸胡萝卜条', ['胡萝卜']);
const spinachSoup = dish('菠菜鸡蛋汤', ['菠菜', '鸡蛋'], 'soup');
const spinach = dish('清炒菠菜', ['菠菜']);
const cabbage = dish('清炒白菜', ['白菜']);
const celery = dish('清炒芹菜', ['芹菜']);

const failures: string[] = [];
function test(name: string, ok: boolean): void { if (!ok) failures.push(name); }
for (const [name, dishes] of [
  ['清炒西兰花 + 番茄炒西兰花', [broccoli, tomatoBroccoli]],
  ['西兰花虾仁 + 清炒西兰花', [shrimpBroccoli, broccoli]],
  ['蒜蓉西兰花 + 清炒西兰花', [garlicBroccoli, broccoli]],
  ['番茄和西红柿归一化', [tomatoEgg, tomatoSoup]],
  ['黄瓜炒蛋 + 清炒黄瓜', [cucumberEgg, cucumber]],
  ['胡萝卜炒肉 + 蒸胡萝卜条', [pork, carrot]],
  ['菠菜鸡蛋汤 + 清炒菠菜', [spinachSoup, spinach]],
] as [string, Recipe[]][]) test(name, getRepeatedVegetableIngredients(dishes).length > 0);

const pools: Record<DishType, Recipe[]> = { staple: [rice], meat: [pork, fish], vegetable: [broccoli, cabbage, celery, spinach, cucumber, carrot], soup: [], egg: [], dessert: [] };
function plan(lunch: Recipe[], dinner: Recipe[]): DayPlan { return { breakfast: { dishes: [rice] }, lunch: { dishes: lunch }, dinner: { dishes: dinner } }; }
const sameMeal = plan([rice, pork, carrot], [rice, fish, broccoli]);
enforceVegetableDiversityRules(sameMeal, pools, '2-3y', new Set());
test('优先替换午餐素菜并保留红肉', sameMeal.lunch.dishes.includes(pork) && getRepeatedVegetableIngredients(sameMeal.lunch.dishes).length === 0);
test('优先替换晚餐素菜并保留轻蛋白', sameMeal.dinner.dishes.includes(fish) && getRepeatedVegetableIngredients(sameMeal.dinner.dishes).length === 0);

const dayRepeat = plan([rice, pork, broccoli], [rice, fish, broccoli]);
enforceVegetableDiversityRules(dayRepeat, pools, '2-3y', new Set());
const lunchVeg = new Set(dayRepeat.lunch.dishes.flatMap(getVegetableIngredients));
test('有候选时全天西兰花去重', !dayRepeat.dinner.dishes.flatMap(getVegetableIngredients).some(v => lunchVeg.has(v)));
test('深浅色覆盖且不增加菜品', dayRepeat.lunch.dishes.length === 3 && dayRepeat.dinner.dishes.length === 3
  && dayRepeat.lunch.dishes.concat(dayRepeat.dinner.dishes).flatMap(getVegetableIngredients).some(v => ['白菜', '芹菜', '黄瓜'].includes(v)));

const restrictedPools = { ...pools, vegetable: [broccoli] };
const restricted = plan([rice, pork, broccoli], [rice, fish, broccoli]);
enforceVegetableDiversityRules(restricted, restrictedPools, '2-3y', new Set());
test('候选不足合理回退且保留核心菜', restricted.lunch.dishes.includes(pork) && restricted.dinner.dishes.includes(fish));

for (const age of ['1-2y', '2-3y', '3-5y'] as AgeGroup[]) {
  const fixed = plan([rice, pork, carrot], [rice, fish, broccoli]);
  enforceVegetableDiversityRules(fixed, pools, age, new Set());
  test(`${age} 同餐真实蔬菜不重复`, [fixed.breakfast, fixed.lunch, fixed.dinner].every(meal => !getRepeatedVegetableIngredients(meal.dishes).length));

  const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
  for (let run = 0; run < 2; run++) {
    const week = generateWeeklyPlan(settings);
    for (const day of Object.values(week)) {
      test(`${age} 随机周同餐蔬菜不重复`, [day.breakfast, day.lunch, day.dinner]
        .every(meal => getRepeatedVegetableIngredients(meal.dishes).length === 0));
      test(`${age} 随机周午餐结构`, checkMealMandatory(day.lunch.dishes, age, 'lunch').allOk);
      test(`${age} 随机周晚餐结构`, validateDinnerRules(day.dinner.dishes, age, day.lunch.dishes, true).valid);
    }
    const used = Object.values(week).flatMap(day => [day.breakfast, day.lunch, day.dinner].flatMap(meal => meal.dishes));
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
      const refreshed = regenerateMeal(settings, [], used, mealType, week.monday);
      test(`${age} ${mealType} 刷新同餐蔬菜不重复`, getRepeatedVegetableIngredients(refreshed.dishes).length === 0);
      if (mealType === 'lunch') test(`${age} 午餐刷新结构`, checkMealMandatory(refreshed.dishes, age, 'lunch').allOk);
      if (mealType === 'dinner') test(`${age} 晚餐刷新结构`, validateDinnerRules(refreshed.dishes, age, week.monday.lunch.dishes, true).valid);
    }
  }
}

if (failures.length) {
  console.error(`失败 ${failures.length} 项：\n${failures.map(name => `- ${name}`).join('\n')}`);
  process.exit(1);
}
console.log('通过蔬菜真实食材去重、全天去重、深浅色覆盖专项测试。');
