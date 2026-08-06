import type { AgeGroup, DishType, Recipe, UserSettings } from '../src/types';
import { generateWeeklyPlan, regenerateMeal } from '../src/utils/recipeGenerator';
import { validateMealForContext } from '../src/utils/mealValidator';
import { withSeed } from './helpers/seededRandom';

const ages: AgeGroup[] = ['1-2y', '2-3y', '3-5y'];
const failures: string[] = [];
let checks = 0;

function recipe(name: string, dishType: DishType, mainIngredients: string[]): Recipe {
  return { id: `test-${name}`, name, dishType, mainIngredients, ingredients: [], steps: [], ageGroups: ages, tags: [], category: '', nutrition: '' };
}

function expect(name: string, condition: boolean): void {
  checks++;
  if (!condition) failures.push(name);
}

const porridge = recipe('小米粥', 'staple', ['小米']);
const wonton = recipe('小馄饨', 'staple', ['面粉', '猪肉']);
const soupNoodle = recipe('鸡汤面', 'staple', ['面条', '鸡肉']);
const dryNoodle = recipe('芝麻干拌面', 'staple', ['面条', '芝麻']);
const stirNoodle = recipe('蔬菜炒面', 'staple', ['面条', '青菜']);
const egg = recipe('水煮蛋', 'egg', ['鸡蛋']);
const eggSoup = recipe('蛋花汤', 'soup', ['鸡蛋']);
const soup = recipe('青菜汤', 'soup', ['青菜']);

for (const staple of [porridge, wonton, soupNoodle]) {
  expect(`${staple.name}不配独立汤`, !validateMealForContext([staple, soup], '2-3y', 'breakfast').valid);
}
expect('干拌面不误判为带汤主食', !validateMealForContext([dryNoodle, egg], '2-3y', 'breakfast').errors.includes('带汤主食不能搭配独立汤'));
expect('炒面不误判为带汤主食', !validateMealForContext([stirNoodle, egg], '2-3y', 'breakfast').errors.includes('带汤主食不能搭配独立汤'));
expect('水煮蛋和蛋花汤不合格', !validateMealForContext([dryNoodle, egg, eggSoup], '2-3y', 'breakfast').valid);

for (const age of ages) {
  for (let seed = 1; seed <= 5; seed++) {
    const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
    const plan = withSeed(seed, () => generateWeeklyPlan(settings));
    for (const [day, dayPlan] of Object.entries(plan)) {
      const result = validateMealForContext(dayPlan.breakfast.dishes, age, 'breakfast', dayPlan);
      checks++;
      if (!result.valid) failures.push(`seed=${seed} age=${age} round=1 day=${day} meal=breakfast dishes=${JSON.stringify(dayPlan.breakfast.dishes.map(d => ({ name: d.name, dishType: d.dishType, mainIngredients: d.mainIngredients })))} rules=${result.errors.join('；')}`);
    }
    const refreshed = withSeed(seed + 1000, () => regenerateMeal(settings, [], [], 'breakfast', plan.monday));
    const refreshedResult = validateMealForContext(refreshed.dishes, age, 'breakfast', { ...plan.monday, breakfast: refreshed });
    checks++;
    if (!refreshedResult.valid) failures.push(`seed=${seed + 1000} age=${age} round=1 day=monday meal=breakfast dishes=${JSON.stringify(refreshed.dishes.map(d => ({ name: d.name, dishType: d.dishType, mainIngredients: d.mainIngredients })))} rules=${refreshedResult.errors.join('；')}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
} else console.log(`通过 ${checks} 项早餐规则测试（seed 1-5；刷新 seed 1001-1005）。`);
