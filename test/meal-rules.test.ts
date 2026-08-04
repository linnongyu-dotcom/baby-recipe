import type { DishType, Recipe } from '../src/types';
import { invalidateStaleMealPlan, MEAL_RULES_REVISION } from '../src/utils/mealPlanCache';
import {
  checkMealMandatory,
  getMealSuitable,
  getRepeatedProteinCategories,
  getRepeatedVegetableIngredients,
  getVegetableIngredients,
  isIndependentProteinDish,
  isSoupyStaple,
  validateMealForContext,
} from '../src/utils/mealValidator';

function dish(name: string, mainIngredients: string[], dishType: DishType): Recipe {
  return { id: name, name, mainIngredients, dishType, ingredients: [], steps: [], ageGroups: ['2-3y'], tags: [], category: '', nutrition: '' };
}

let passed = 0;
const failures: string[] = [];
function test(name: string, condition: boolean): void {
  if (condition) passed++;
  else failures.push(name);
}

const rice = dish('白米饭', ['大米'], 'staple');
const vegetableA = dish('炒西葫芦', ['西葫芦'], 'vegetable');
const vegetableB = dish('清炒时蔬', ['青菜'], 'vegetable');

test('早餐粥不能再配独立汤', isSoupyStaple(dish('小米粥', ['小米'], 'staple')));
test('小米粥不能搭配西红柿蛋汤', !validateMealForContext(
  [dish('小米粥', ['小米'], 'staple'), dish('西红柿蛋汤', ['西红柿', '鸡蛋'], 'soup')],
  '2-3y',
  'breakfast',
).valid);

const profile = { babies: [{ id: 'baby-1' }], settings: { allergies: ['蛋'] }, weeklyPlan: { monday: {} } };
let stored = JSON.stringify({ state: profile, version: 42 });
const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
test('同 schema 版本的旧规则餐单仍会失效', invalidateStaleMealPlan(storage));
const invalidated = JSON.parse(stored);
test('规则修订只清餐单并保留档案设置', invalidated.state.weeklyPlan === null
  && JSON.stringify(invalidated.state.babies) === JSON.stringify(profile.babies)
  && JSON.stringify(invalidated.state.settings) === JSON.stringify(profile.settings)
  && invalidated.state.mealRulesRevision === MEAL_RULES_REVISION);
test('相同规则修订不会重复迁移', !invalidateStaleMealPlan(storage));
test('馄饨和汤面是带汤主食', ['鲜肉馄饨', '番茄汤面'].every(name => isSoupyStaple(dish(name, ['面条'], 'staple'))));
test('干拌面和炒面不是带汤主食', ['葱油拌面', '鸡蛋炒面'].every(name => !isSoupyStaple(dish(name, ['面条'], 'staple'))));

const tomatoEggSoup = dish('西红柿鸡蛋汤', ['西红柿', '鸡蛋'], 'soup');
test('番茄鸡蛋汤不是独立蛋白质', !checkMealMandatory([rice, tomatoEggSoup, vegetableA, vegetableB], '2-3y', 'lunch').proteinOk);
test('鱼丸汤不是独立蛋白质', !checkMealMandatory([rice, dish('鱼丸汤', ['鱼丸'], 'soup'), vegetableA, vegetableB], '2-3y', 'lunch').proteinOk);
test('红烧肉满足独立蛋白质', checkMealMandatory([rice, dish('红烧肉', ['猪肉'], 'meat'), vegetableA], '2-3y', 'lunch').proteinOk);
test('水煮蛋和番茄鸡蛋汤蛋类重复', getRepeatedProteinCategories([dish('水煮蛋', ['鸡蛋'], 'egg'), tomatoEggSoup]).includes('egg'));
test('红烧肉和排骨汤红肉重复', getRepeatedProteinCategories([dish('红烧肉', ['猪肉'], 'meat'), dish('排骨汤', ['排骨'], 'soup')]).includes('red_meat'));
test('西兰花虾仁和清炒西兰花蔬菜重复', getRepeatedVegetableIngredients([dish('西兰花虾仁', ['西兰花', '虾仁'], 'meat'), dish('清炒西兰花', ['西兰花'], 'vegetable')]).includes('西兰花'));
test('两道西兰花蔬菜重复', getRepeatedVegetableIngredients([dish('清炒西兰花', ['西兰花'], 'vegetable'), dish('番茄炒西兰花', ['番茄', '西兰花'], 'vegetable')]).includes('西兰花'));

test('蔬菜提取排除米饭肉蛋和调味料', JSON.stringify(getVegetableIngredients(dish('混合', ['西兰花', '大米', '猪肉', '鸡蛋', '酱油'], 'vegetable'))) === JSON.stringify(['西兰花']));
test('汤菜不能伪装独立蛋白质', !isIndependentProteinDish(dish('肉末汤', ['肉末'], 'soup')));
test('早餐蛋和正餐菜餐次适配', getMealSuitable(dish('白煮蛋', ['鸡蛋'], 'egg')).every(meal => meal === 'breakfast') && !getMealSuitable(dish('宫保鸡丁', ['鸡肉'], 'meat')).includes('breakfast'));

if (failures.length) {
  console.error(`失败 ${failures.length} 项：\n${failures.map(name => `- ${name}`).join('\n')}`);
  process.exit(1);
}
console.log(`通过 ${passed} 项确定性膳食规则测试。`);
