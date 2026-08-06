import type { AgeGroup, DishType, Recipe, UserSettings } from '../src/types';
import { enforceLunchRules, generateWeeklyPlan, regenerateMeal, weeklyPlanNeedsLunchRepair } from '../src/utils/recipeGenerator';
import {
  checkMealMandatory,
  getIngredientProteinCategories,
  getVegetableIngredients,
  isIndependentLunchMeatDish,
  isIndependentProteinDish,
} from '../src/utils/mealValidator';
import { getRecipeCookingForm, getRecipeFamily } from '../src/utils/recipeFamily';

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
const chicken = dish('清蒸鸡肉', ['鸡肉'], 'meat');
const shrimp = dish('清炒虾仁', ['虾仁'], 'meat');
const egg = dish('番茄炒蛋', ['番茄', '鸡蛋'], 'egg');
const boiledEgg = dish('水煮蛋', ['鸡蛋'], 'egg');
const eggSoup = dish('番茄蛋花汤', ['番茄', '鸡蛋'], 'soup');
const fishBallSoup = dish('鱼丸汤', ['鱼丸'], 'soup');
const clearSoup = dish('冬瓜汤', ['冬瓜'], 'soup');
const vegetable = dish('清炒西兰花', ['西兰花'], 'vegetable');
const pools: Record<DishType, Recipe[]> = {
  staple: [rice, beefRice, porkRice],
  meat: [beef, pork, fish, chicken, shrimp],
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

const steamedLionHead = dish('清蒸狮子头', ['猪肉', '荸荠'], 'meat');
const braisedLionHead = dish('红烧狮子头', ['猪肉', '荸荠'], 'meat');
const braisedMeatball = dish('红烧肉丸', ['猪肉'], 'meat');
test('两种狮子头属于同一家族和肉丸形态',
  getRecipeFamily(steamedLionHead) === getRecipeFamily(braisedLionHead)
  && getRecipeCookingForm(steamedLionHead) === 'meatball'
  && getRecipeCookingForm(braisedLionHead) === 'meatball');
test('红烧肉丸与狮子头家族不同但形态相同',
  getRecipeFamily(braisedMeatball) !== getRecipeFamily(steamedLionHead)
  && getRecipeCookingForm(braisedMeatball) === 'meatball');
test('番茄牛腩两种名称属于同一家族',
  getRecipeFamily(dish('番茄牛腩', ['牛肉', '番茄'], 'meat'))
  === getRecipeFamily(dish('番茄牛腩煲', ['牛肉', '番茄'], 'meat')));
test('三种独立排骨菜属于同一家族但排骨汤不会被关键词归类',
  ['糖醋排骨', '红烧排骨', '蒜香排骨'].map(name => getRecipeFamily(dish(name, ['排骨'], 'meat'))).every(family => family === 'pork_ribs')
  && getRecipeFamily(dish('排骨汤', ['排骨'], 'soup')) !== 'pork_ribs');
test('未配置食谱稳定回退到 ID，不会因肉丝关键词误合并',
  getRecipeFamily(dish('自定义肉丝甲', ['猪肉'], 'meat')) === '自定义肉丝甲'
  && getRecipeFamily(dish('自定义肉丝乙', ['猪肉'], 'meat')) === '自定义肉丝乙');

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
test('主食含猪肉时仍保留独立动物性肉菜', porkWithPorkStaple.dishes.some(isIndependentLunchMeatDish));
test('同类猪肉可搭配后午餐仍结构合规', checkMealMandatory(porkWithPorkStaple.dishes, '2-3y', 'lunch').allOk);

const beefWithBeefStaple = enforceLunchRules(
  { dishes: [beefRice, beef, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('无早餐牛肉避让时，主食含牛肉仍保留独立动物性肉菜', beefWithBeefStaple.dishes.some(isIndependentLunchMeatDish));
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
test('红肉已使用后优先回退未使用的其他动物性肉菜', fallback.dishes.some(item =>
  item.id === fish.id || item.id === chicken.id || item.id === shrimp.id
));

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

const weeklyProteinHistory: Recipe[] = [];
const weeklyLunches: Recipe[][] = [];
for (let day = 0; day < 7; day++) {
  const lunch = enforceLunchRules(
    { dishes: [rice, vegetable] },
    { ...pools, staple: [rice], soup: [clearSoup, eggSoup, fishBallSoup] },
    '2-3y',
    new Set(weeklyProteinHistory.map(item => item.id)),
    [],
    weeklyProteinHistory,
  );
  weeklyLunches.push(lunch.dishes);
  const protein = lunch.dishes.find(isIndependentLunchMeatDish);
  if (protein) weeklyProteinHistory.push(protein);
}
const lunchProteinCategories = weeklyProteinHistory.map(item => getIngredientProteinCategories(item)[0]);
const redCount = lunchProteinCategories.filter(category => category === 'red_meat').length;
test('候选充足时七天红肉为2至3次', redCount >= 2 && redCount <= 3);
test('候选充足时至少安排一次禽肉', lunchProteinCategories.includes('poultry'));
test('候选充足时至少安排一次鱼虾', lunchProteinCategories.some(category => category === 'fish' || category === 'shrimp'));
test('同一道独立肉菜不连续两天出现', weeklyProteinHistory.every((item, index) =>
  index === 0 || item.id !== weeklyProteinHistory[index - 1].id
));
test('普通午餐有汤候选时包含且最多一道汤', weeklyLunches.every(items =>
  items.filter(item => item.dishType === 'soup').length === 1
));
test('有清淡无蛋白汤时优先于蛋白汤', weeklyLunches[0].some(item => item.id === clearSoup.id));

const proteinSoupLunch = enforceLunchRules(
  { dishes: [rice, beef, vegetable] },
  { ...pools, staple: [rice], soup: [eggSoup] },
  '2-3y',
  new Set(),
  [],
);
test('已有独立肉菜时蛋花汤可进入且不能替代肉菜',
  proteinSoupLunch.dishes.some(item => item.id === eggSoup.id)
  && proteinSoupLunch.dishes.some(isIndependentLunchMeatDish));

const staleLunchWeek = Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => [day, {
    breakfast: { dishes: [rice, boiledEgg] },
    lunch: { dishes: [rice, pork, vegetable] },
    dinner: { dishes: [rice, fish, vegetable] },
  }]),
) as ReturnType<typeof generateWeeklyPlan>;
test('旧缓存午餐没有汤时会触发整周重建', weeklyPlanNeedsLunchRepair(staleLunchWeek, '2-3y'));

for (const day of Object.values(staleLunchWeek)) day.lunch.dishes.push(clearSoup);
test('旧缓存整周重复同一道肉菜时会触发整周重建', weeklyPlanNeedsLunchRepair(staleLunchWeek, '2-3y'));

for (const age of ['1-2y', '2-3y', '3-5y'] as AgeGroup[]) {
  const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
  for (let run = 0; run < 4; run++) {
    const plan = generateWeeklyPlan(settings);
    for (const day of Object.values(plan)) {
      test(`${age} 周计划午餐结构合规`, checkMealMandatory(day.lunch.dishes, age, 'lunch').allOk);
      test(`${age} 周计划午餐有独立蛋白菜`, day.lunch.dishes.some(isIndependentProteinDish));
    }
    const proteins = Object.values(plan).flatMap(day => day.lunch.dishes.filter(isIndependentLunchMeatDish));
    const explicitFamilies = proteins.map(getRecipeFamily).filter(family =>
      ['lion_head', 'pork_ribs', 'tomato_beef_brisket'].includes(family));
    test(`${age} 候选充足时明确午餐家族周内不重复`,
      new Set(explicitFamilies).size === explicitFamilies.length);
    const forms = proteins.map(getRecipeCookingForm);
    test(`${age} 午餐烹饪形态不连续三天`,
      !forms.some((form, index) => index >= 2 && form !== 'other'
        && form === forms[index - 1] && form === forms[index - 2]));
    const generatedRedCount = proteins.filter(item => getIngredientProteinCategories(item).includes('red_meat')).length;
    test(`${age} 候选充足时周红肉保持2至3次`, generatedRedCount >= 2 && generatedRedCount <= 3);
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
