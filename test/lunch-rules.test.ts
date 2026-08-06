import type { AgeGroup, DishType, Recipe, UserSettings } from '../src/types';
import { enforceLunchRules, generateWeeklyPlan, regenerateMeal } from '../src/utils/recipeGenerator';
import {
  checkMealMandatory,
  getIngredientProteinCategories,
  getVegetableIngredients,
  isIndependentLunchMeatDish,
  isIndependentProteinDish,
} from '../src/utils/mealValidator';

function dish(name: string, mainIngredients: string[], dishType: DishType): Recipe {
  return {
    id: name,
    name,
    mainIngredients,
    dishType,
    ingredients: [],
    steps: [],
    ageGroups: ['1-2y', '2-3y', '3-5y'],
    tags: [],
    category: '',
    nutrition: '',
  };
}

const rice = dish('白米饭', ['大米'], 'staple');
const beefRice = dish('牛肉焖饭', ['大米', '牛肉'], 'staple');
const porkRice = dish('猪肉焖饭', ['大米', '猪肉'], 'staple');
const beef = dish('红烧牛肉', ['牛肉'], 'meat');
const pork = dish('清炖猪肉', ['猪肉'], 'meat');
const fish = dish('清蒸鲈鱼', ['鲈鱼'], 'meat');
const egg = dish('番茄炒蛋', ['番茄', '鸡蛋'], 'egg');
const boiledEgg = dish('水煮蛋', ['鸡蛋'], 'egg');
const eggSoup = dish('番茄蛋花汤', ['番茄', '鸡蛋'], 'soup');
const fishBallSoup = dish('鱼丸汤', ['鱼丸'], 'soup');
const vegetable = dish('清炒西兰花', ['西兰花'], 'vegetable');
const pools: Record<DishType, Recipe[]> = {
  staple: [rice, beefRice, porkRice],
  meat: [beef, pork, fish],
  vegetable: [vegetable],
  soup: [eggSoup],
  egg: [egg],
  dessert: [],
};

let passed = 0;
const failures: string[] = [];
function test(name: string, condition: boolean): void {
  if (condition) passed++;
  else failures.push(name);
}

const repaired = enforceLunchRules(
  { dishes: [beefRice, eggSoup, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('含肉主食和汤不能替代独立蛋白菜', repaired.dishes.some(isIndependentProteinDish));
test('最终午餐包含主食、独立蛋白菜和蔬菜', checkMealMandatory(repaired.dishes, '2-3y', 'lunch').allOk);
test('最终午餐蔬菜来自真实主要食材', repaired.dishes.some(item => getVegetableIngredients(item).length > 0));

const porkWithPorkStaple = enforceLunchRules(
  { dishes: [porkRice, pork, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('主食含猪肉时保留独立猪肉菜', porkWithPorkStaple.dishes.some(item => item.id === pork.id));
test('同类猪肉可搭配后午餐仍结构合规', checkMealMandatory(porkWithPorkStaple.dishes, '2-3y', 'lunch').allOk);

const beefWithBeefStaple = enforceLunchRules(
  { dishes: [beefRice, beef, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('无早餐牛肉避让时，主食含牛肉仍保留独立牛肉菜', beefWithBeefStaple.dishes.some(item => item.id === beef.id));
test('同类牛肉可搭配后午餐仍有主食、独立肉菜和真实蔬菜',
  checkMealMandatory(beefWithBeefStaple.dishes, '2-3y', 'lunch').allOk);

const afterBeefBreakfast = enforceLunchRules(
  { dishes: [beefRice, beef, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [dish('早餐牛肉饼', ['牛肉'], 'meat')],
);
test('早餐有牛肉时午餐避开牛肉', !afterBeefBreakfast.dishes.some(item => item.mainIngredients.includes('牛肉')));

const fallback = enforceLunchRules(
  { dishes: [rice, vegetable] },
  pools,
  '2-3y',
  new Set([beef.id, pork.id]),
  [],
);
test('未使用红肉耗尽后回退完整合规池', fallback.dishes.some(item => item.id === beef.id || item.id === pork.id));

const repairedBoiledEggLunch = enforceLunchRules(
  { dishes: [rice, boiledEgg, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('午餐水煮蛋会被红肉菜替换', repairedBoiledEggLunch.dishes.some(item =>
  isIndependentProteinDish(item) && getIngredientProteinCategories(item).includes('red_meat')
));

const vegetableNoodles = dish('蔬菜面条', ['面条', '小白菜'], 'staple');
const repairedNoodleLunch = enforceLunchRules(
  { dishes: [vegetableNoodles, fishBallSoup, beef] },
  { ...pools, soup: [fishBallSoup] },
  '2-3y',
  new Set(),
  [],
);
test('带汤的蔬菜面条不再搭配鱼丸汤', !repairedNoodleLunch.dishes.some(item => item.id === fishBallSoup.id));

const redBeanRice = dish('红豆饭', ['大米', '红豆'], 'staple');
const eggPancake = dish('鸡蛋饼', ['面粉', '鸡蛋'], 'staple');
const repairedRedBeanLunch = enforceLunchRules(
  { dishes: [redBeanRice, eggPancake, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('红豆饭午餐不再搭配鸡蛋饼', repairedRedBeanLunch.dishes.some(item => item.id === redBeanRice.id)
  && !repairedRedBeanLunch.dishes.some(item => item.id === eggPancake.id));
test('鸡蛋饼不能代替午餐肉菜', repairedRedBeanLunch.dishes.some(item =>
  isIndependentLunchMeatDish(item)
));

const cornRice = dish('玉米饭', ['大米', '玉米'], 'staple');
const seaweedShrimpSoup = dish('紫菜虾皮汤', ['紫菜', '虾皮'], 'soup');
const tofuPudding = dish('豆腐脑', ['豆腐'], 'egg');
const repairedMeatlessLunch = enforceLunchRules(
  { dishes: [cornRice, seaweedShrimpSoup, tofuPudding] },
  { ...pools, soup: [seaweedShrimpSoup], egg: [tofuPudding] },
  '2-3y',
  new Set(),
  [],
);
test('玉米饭、紫菜虾皮汤和豆腐脑不能组成无肉午餐', repairedMeatlessLunch.dishes.some(item =>
  getIngredientProteinCategories(item).includes('red_meat')
));

for (const age of ['1-2y', '2-3y', '3-5y'] as AgeGroup[]) {
  const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
  for (let run = 0; run < 4; run++) {
    const plan = generateWeeklyPlan(settings);
    for (const day of Object.values(plan)) {
      test(`${age} 周计划午餐结构合规`, checkMealMandatory(day.lunch.dishes, age, 'lunch').allOk);
      test(`${age} 周计划午餐有独立蛋白菜`, day.lunch.dishes.some(isIndependentProteinDish));
      test(`${age} 周计划午餐优先红肉`, day.lunch.dishes.some(item => getIngredientProteinCategories(item).includes('red_meat')));
    }
    const context = plan.monday;
    const used = Object.values(plan).flatMap(day => [
      ...day.breakfast.dishes,
      ...day.lunch.dishes,
      ...day.dinner.dishes,
    ]);
    const refreshed = regenerateMeal(settings, [], used, 'lunch', context);
    test(`${age} 午餐刷新结构合规`, checkMealMandatory(refreshed.dishes, age, 'lunch').allOk);
  }
}

if (failures.length) {
  console.error(`失败 ${failures.length} 项：\n${failures.map(name => `- ${name}`).join('\n')}`);
  process.exit(1);
}
console.log(`通过 ${passed} 项午餐专项规则测试。`);
