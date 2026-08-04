import type { AgeGroup, MealType, UserSettings } from '../src/types';
import { DAYS_OF_WEEK } from '../src/types';
import { generateWeeklyPlan, regenerateMeal } from '../src/utils/recipeGenerator';
import { validateMealForContext } from '../src/utils/mealValidator';
import { withSeed } from './helpers/seededRandom';

const ages: AgeGroup[] = ['1-2y', '2-3y', '3-5y'];
const meals: MealType[] = ['breakfast', 'lunch', 'dinner'];
const rounds = Number(process.env.MEAL_STRESS_ROUNDS || 100);
const refreshRounds = Number(process.env.MEAL_REFRESH_ROUNDS || 50);
const seedOffset = Number(process.env.MEAL_SEED_OFFSET || 0);
let checks = 0;
const failures: string[] = [];

function detail(seed: number, age: AgeGroup, round: number, day: string, meal: MealType, dishes: ReturnType<typeof generateWeeklyPlan>['monday']['breakfast']['dishes'], rules: string[]): string {
  return `seed=${seed} age=${age} round=${round} day=${day} meal=${meal} dishes=${JSON.stringify(dishes.map(d => ({ name: d.name, dishType: d.dishType, mainIngredients: d.mainIngredients })))} rules=${rules.join('；')}`;
}

for (let ageIndex = 0; ageIndex < ages.length && failures.length === 0; ageIndex++) {
  const age = ages[ageIndex];
  const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
  const start = seedOffset + 100000 + ageIndex * 10000;
  for (let round = 0; round < rounds && failures.length === 0; round++) {
    const seed = start + round;
    const plan = withSeed(seed, () => generateWeeklyPlan(settings));
    for (const day of DAYS_OF_WEEK) for (const meal of meals) {
      const result = validateMealForContext(plan[day][meal].dishes, age, meal, plan[day]);
      checks++;
      if (!result.valid) failures.push(detail(seed, age, round + 1, day, meal, plan[day][meal].dishes, result.errors));
    }
  }

  for (let round = 0; round < refreshRounds && failures.length === 0; round++) {
    const seed = seedOffset + 500000 + ageIndex * 10000 + round;
    const plan = withSeed(seed, () => generateWeeklyPlan(settings));
    for (const meal of meals) {
      const refreshSeed = seed + meals.indexOf(meal) * 1000;
      const refreshed = withSeed(refreshSeed, () => regenerateMeal(settings, [], [], meal, plan.monday));
      const context = { ...plan.monday, [meal]: refreshed };
      const result = validateMealForContext(refreshed.dishes, age, meal, context);
      checks++;
      if (!result.valid) failures.push(detail(refreshSeed, age, round + 1, 'monday', meal, refreshed.dishes, result.errors));
    }
  }
}

if (failures.length) {
  console.error(`压力测试失败（完成 ${checks} 项检查）：\n${failures.join('\n')}`);
  process.exit(1);
} else {
  console.log(`压力测试通过：周计划 ${ages.length * rounds} 轮，刷新 ${ages.length * refreshRounds * meals.length} 次，共 ${checks} 项餐次检查；seed offset=${seedOffset}。`);
}
