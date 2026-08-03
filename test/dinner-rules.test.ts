import type { AgeGroup, DishType, Recipe, UserSettings } from '../src/types';
import { enforceDinnerRules, generateWeeklyPlan, regenerateMeal } from '../src/utils/recipeGenerator';
import {
  getMealDishLimit,
  getRepeatedProteinCategories,
  getVegetableIngredients,
  isIndependentProteinDish,
  isSoupyStaple,
  validateDinnerRules,
} from '../src/utils/mealValidator';

function dish(name: string, mainIngredients: string[], dishType: DishType): Recipe {
  return { id: name, name, mainIngredients, dishType, ingredients: [], steps: [], ageGroups: ['1-2y', '2-3y', '3-5y'], tags: [], category: '', nutrition: '' };
}
const rice = dish('白米饭', ['大米'], 'staple');
const friedRice = dish('蔬菜炒饭', ['大米', '青菜'], 'staple');
const chickenNoodles = dish('鸡丝面', ['面条', '鸡肉'], 'staple');
const shrimpPorridge = dish('鲜虾粥', ['大米', '虾仁'], 'staple');
const wonton = dish('小馄饨', ['面粉', '猪肉'], 'staple');
const fish = dish('清蒸鲈鱼', ['鲈鱼'], 'meat');
const shrimp = dish('西兰花虾仁', ['西兰花', '虾仁'], 'meat');
const chicken = dish('清蒸鸡肉', ['鸡肉'], 'meat');
const tofu = dish('香菇豆腐', ['香菇', '豆腐'], 'vegetable');
const pork = dish('红烧肉', ['猪肉'], 'meat');
const vegA = dish('清炒青菜', ['青菜'], 'vegetable');
const vegB = dish('清炒白菜', ['白菜'], 'vegetable');
const fishBallSoup = dish('鱼丸汤', ['鱼丸'], 'soup');
const shrimpSkinSoup = dish('紫菜虾皮汤', ['紫菜', '虾皮'], 'soup');
const egg = dish('番茄炒蛋', ['番茄', '鸡蛋'], 'egg');
const eggSoup = dish('紫菜蛋花汤', ['紫菜', '鸡蛋'], 'soup');
const plainSoup = dish('冬瓜汤', ['冬瓜'], 'soup');

let passed = 0;
const failures: string[] = [];
function test(name: string, condition: boolean): void {
  if (condition) passed++;
  else failures.push(name);
}
function valid(ds: Recipe[], lunch: Recipe[] = []) { return validateDinnerRules(ds, '2-3y', lunch, true); }

for (const [name, ds] of [
  ['蔬菜炒饭加蔬菜缺蛋白', [friedRice, vegA]],
  ['白饭加两素菜缺蛋白', [rice, vegA, vegB]],
  ['鱼丸汤不能充当蛋白', [rice, fishBallSoup, vegA]],
  ['虾皮汤不能充当蛋白', [rice, shrimpSkinSoup, vegA]],
] as [string, Recipe[]][]) test(name, valid(ds).errors.some(e => e.includes('缺少独立轻蛋白')));
for (const [name, protein] of [['鱼', fish], ['虾', shrimp], ['禽肉', chicken], ['豆腐', tofu]] as [string, Recipe][]) {
  test(`白饭+${name}+蔬菜通过`, valid([rice, protein, vegA]).valid);
}
test('有轻蛋白候选时红肉不合规', !valid([rice, pork, vegA]).valid);
test('轻蛋白与红肉堆叠被识别', valid([rice, fish, pork, vegA]).errors.some(e => e.includes('堆叠')));
test('两道含蛋菜被识别', valid([rice, egg, eggSoup]).errors.some(e => e.includes('最多一道含蛋')));
test('鸡丝面和鸡肉菜真实蛋白重复', valid([chickenNoodles, chicken, vegA]).errors.some(e => e.includes('重复')));
test('鲜虾粥和虾仁菜真实蛋白重复', valid([shrimpPorridge, shrimp, vegA]).errors.some(e => e.includes('重复')));
test('馄饨和独立汤冲突', valid([wonton, fish, plainSoup]).errors.some(e => e.includes('带汤主食')));
test('午晚餐同为鱼触发互补提示', valid([rice, fish, vegA], [fish]).lunchProteinOverlap.includes('fish'));
test('午餐红肉晚餐轻蛋白互补通过', valid([rice, fish, vegA], [pork]).lunchProteinOverlap.length === 0);

const pools: Record<DishType, Recipe[]> = { staple: [rice], meat: [fish, shrimp, chicken, pork], vegetable: [vegA, vegB, tofu], soup: [plainSoup], egg: [egg], dessert: [] };
const trimmed = enforceDinnerRules({ dishes: [rice, fish, vegA, vegB, plainSoup] }, pools, '2-3y', new Set(), []);
test('超限优先保留主食轻蛋白和蔬菜', trimmed.dishes.length === 3 && trimmed.dishes.includes(rice) && trimmed.dishes.includes(fish) && trimmed.dishes.some(d => getVegetableIngredients(d).length));

const allLightUsed = new Set([fish.id, shrimp.id, chicken.id, tofu.id, egg.id]);
const reusedLight = enforceDinnerRules({ dishes: [rice, pork, vegA] }, pools, '2-3y', allLightUsed, []);
test('轻蛋白菜均已使用时回退完整轻蛋白池', reusedLight.dishes.some(d => [fish, shrimp, chicken, tofu, egg].includes(d)));
test('轻蛋白菜均已使用时不退化为红肉', !reusedLight.dishes.some(d => d === pork));
test('轻蛋白菜均已使用时不退化为纯素晚餐', reusedLight.dishes.some(isIndependentProteinDish));

for (const age of ['1-2y', '2-3y', '3-5y'] as AgeGroup[]) {
  const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
  for (let run = 0; run < 4; run++) {
    const plan = generateWeeklyPlan(settings);
    for (const day of Object.values(plan)) {
      const check = validateDinnerRules(day.dinner.dishes, age, day.lunch.dishes, true);
      test(`${age} 周晚餐最终结构`, check.valid);
      test(`${age} 周晚餐独立轻蛋白`, day.dinner.dishes.some(isIndependentProteinDish));
      test(`${age} 周晚餐真实蔬菜`, day.dinner.dishes.some(d => getVegetableIngredients(d).length > 0));
      test(`${age} 周晚餐蛋白不重复`, getRepeatedProteinCategories(day.dinner.dishes).length === 0);
      test(`${age} 周晚餐汤水不冲突`, !(day.dinner.dishes.some(isSoupyStaple) && day.dinner.dishes.some(d => d.dishType === 'soup')));
      test(`${age} 周晚餐数量`, day.dinner.dishes.filter(d => d.dishType !== 'dessert').length <= getMealDishLimit(age, 'dinner').max);
    }
    const used = Object.values(plan).flatMap(day => [...day.breakfast.dishes, ...day.lunch.dishes, ...day.dinner.dishes]);
    const refreshed = regenerateMeal(settings, [], used, 'dinner', plan.monday);
    test(`${age} 晚餐刷新仍合规`, validateDinnerRules(refreshed.dishes, age, plan.monday.lunch.dishes, true).valid);
  }
}

if (failures.length) {
  console.error(`失败 ${failures.length} 项：\n${failures.map(name => `- ${name}`).join('\n')}`);
  process.exit(1);
}
console.log(`通过 ${passed} 项晚餐专项规则测试。`);
