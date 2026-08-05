import type { DishType, Recipe } from '../src/types';
import { enforceLunchRules, generateWeeklyPlan, weeklyPlanNeedsLunchRepair } from '../src/utils/recipeGenerator';
import {
  checkMealMandatory,
  getIngredientProteinCategories,
  isIndependentLunchMeatDish,
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
const cornRice = dish('玉米饭', ['玉米', '大米'], 'staple');
const vegetableNoodles = dish('蔬菜面条', ['面条', '青菜'], 'staple');
const beef = dish('红烧牛肉', ['牛肉'], 'meat');
const pork = dish('清炖猪肉', ['猪肉'], 'meat');
const fish = dish('清蒸鲈鱼', ['鲈鱼'], 'meat');
const eggCake = dish('鸡蛋饼', ['面粉', '鸡蛋'], 'egg');
const eggSoup = dish('番茄蛋花汤', ['番茄', '鸡蛋'], 'soup');
const fishBallSoup = dish('鱼丸汤', ['鱼丸'], 'soup');
const seaweedShrimpSoup = dish('紫菜虾皮汤', ['紫菜', '虾皮'], 'soup');
const tofuPudding = dish('豆腐脑', ['豆腐'], 'egg');
const boiledEgg = dish('水煮蛋', ['鸡蛋'], 'egg');
const vegetable = dish('清炒西兰花', ['西兰花'], 'vegetable');

const pools: Record<DishType, Recipe[]> = {
  staple: [rice, cornRice, vegetableNoodles],
  meat: [beef, pork, fish],
  vegetable: [vegetable],
  soup: [eggSoup, fishBallSoup, seaweedShrimpSoup],
  egg: [eggCake, tofuPudding, boiledEgg],
  dessert: [],
};

let passed = 0;
const failures: string[] = [];
function test(name: string, condition: boolean): void {
  if (condition) passed++;
  else failures.push(name);
}

const repairedEggCakeLunch = enforceLunchRules(
  { dishes: [rice, eggCake, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('午餐红豆饭一类主食不能再叠鸡蛋饼当蛋白', repairedEggCakeLunch.dishes.some(isIndependentLunchMeatDish));

test('鸡蛋饼不是午餐独立肉类', !isIndependentLunchMeatDish(eggCake));
test('水煮蛋不是午餐独立肉类', !isIndependentLunchMeatDish(boiledEgg));
test('鱼丸汤不是午餐独立肉类', !isIndependentLunchMeatDish(fishBallSoup));
test('紫菜虾皮汤不是午餐独立肉类', !isIndependentLunchMeatDish(seaweedShrimpSoup));
test('红烧牛肉是午餐独立肉类', isIndependentLunchMeatDish(beef));

const repairedNoodles = enforceLunchRules(
  { dishes: [vegetableNoodles, fishBallSoup, vegetable] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('蔬菜面条这类汤面不再搭配鱼丸汤', !repairedNoodles.dishes.some(item => item.name === fishBallSoup.name));
test('蔬菜面条午餐修复后仍有独立肉菜', repairedNoodles.dishes.some(isIndependentLunchMeatDish));

const repairedMeatlessLunch = enforceLunchRules(
  { dishes: [cornRice, seaweedShrimpSoup, tofuPudding] },
  pools,
  '2-3y',
  new Set(),
  [],
);
test('玉米饭、紫菜虾皮汤和豆腐脑不能组成无肉午餐', repairedMeatlessLunch.dishes.some(item =>
  getIngredientProteinCategories(item).includes('red_meat')
));
test('修复后的午餐必须通过午餐硬性规则', checkMealMandatory(repairedMeatlessLunch.dishes, '2-3y', 'lunch').allOk);

const stalePlan = generateWeeklyPlan({ babyAge: '2-3y', allergies: [], dislikes: [], likes: [] });
stalePlan.monday.lunch = { dishes: [rice, eggSoup, vegetable] };
test('运行时能识别已缓存的无肉午餐并要求重建', weeklyPlanNeedsLunchRepair(stalePlan, '2-3y'));

if (failures.length) {
  console.error(`失败 ${failures.length} 项：\n${failures.map(name => `- ${name}`).join('\n')}`);
  process.exit(1);
}
console.log(`通过 ${passed} 项午餐独立肉类回归测试。`);
