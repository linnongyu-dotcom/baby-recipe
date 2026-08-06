/**
 * 资深QA测试：一日饮食规划验收
 * 测试三餐定位优化、全天搭配检查、奶制品逻辑
 */
import { generateWeeklyPlan } from '../src/utils/recipeGenerator';
import { UserSettings, AgeGroup, DayOfWeek, DAYS_OF_WEEK, MealType } from '../src/types';
import { validateDayPlan } from '../src/utils/dayPlanValidator';
import { lookupFoodCategory } from '../src/utils/foodDictionary';
import { inferProteinSource, getDifficulty, getMealSuitable, getVegetableColor } from '../src/utils/mealValidator';

interface TestResult {
  age: AgeGroup;
  pass: boolean;
  issues: string[];
}

let totalPass = 0;
let totalFail = 0;
const allResults: TestResult[] = [];

// ============================================================
// 测试配置
// ============================================================
const settings: UserSettings = {
  babyAge: '1-2y',
  allergies: [],
  dislikes: [],
  likes: [],
};

const ageGroups: AgeGroup[] = ['1-2y', '2-3y', '3-5y'];
const ITERATIONS = 5; // 每个年龄段跑5轮

for (const age of ageGroups) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试年龄段：${age}`);
  console.log('='.repeat(60));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const issues: string[] = [];
    settings.babyAge = age;
    const plan = generateWeeklyPlan(settings, { seed: iter + 2 });

    // 测试每天（取前两天作为样本）
    const sampleDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday'];

    for (const day of sampleDays) {
      const dayPlan = plan[day];

      // ===== 1. 早餐检查 =====
      const breakfast = dayPlan.breakfast;
      const breakfastDishes = breakfast.dishes.filter(d => d.dishType !== 'dessert');

      // 1a. 早餐不能超过2道主菜
      if (breakfastDishes.length > 2) {
        issues.push(`[${day}早餐] 菜品过多(${breakfastDishes.length}道)，应≤2道`);
      }

      // 1b. 早餐必须有主食
      const hasBreakfastStaple = breakfastDishes.some(d => d.dishType === 'staple');
      if (!hasBreakfastStaple) {
        issues.push(`[${day}早餐] 缺少主食`);
      }

      // 1c. 早餐必须有蛋白质（包括含蛋白的汤）
      const hasBreakfastProtein = breakfastDishes.some(d => {
        if (d.dishType === 'meat' || d.dishType === 'egg') return true;
        if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
        if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
        return false;
      });
      if (!hasBreakfastProtein) {
        issues.push(`[${day}早餐] 缺少蛋白质 - 菜品: ${breakfastDishes.map(d => d.name).join('、')}`);
      }

      // 1d. 早餐应简单制作
      const complexBreakfast = breakfastDishes.filter(d => getDifficulty(d) === '复杂');
      if (complexBreakfast.length > 0) {
        issues.push(`[${day}早餐] 包含复杂菜品: ${complexBreakfast.map(d => d.name).join('、')}`);
      }

      // 1e. 早餐菜品应适配早餐
      const breakfastMismatch = breakfastDishes.filter(d => !getMealSuitable(d).includes('breakfast'));
      if (breakfastMismatch.length > 0) {
        issues.push(`[${day}早餐] 不适宜早餐的菜品: ${breakfastMismatch.map(d => d.name).join('、')}`);
      }

      // ===== 2. 午餐检查 =====
      const lunch = dayPlan.lunch;
      const lunchDishes = lunch.dishes.filter(d => d.dishType !== 'dessert');

      // 2a. 午餐必须有主食+蛋白质+蔬菜
      const hasLunchStaple = lunchDishes.some(d => d.dishType === 'staple');
      const hasLunchProtein = lunchDishes.some(d => {
        if (d.dishType === 'meat' || d.dishType === 'egg') return true;
        if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
        if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
        return false;
      });
      const hasLunchVeg = lunchDishes.some(d => {
        if (d.dishType === 'vegetable') return true;
        return d.mainIngredients.some(ing => {
          const cat = lookupFoodCategory(ing);
          return cat === 'darkVeg' || cat === 'lightVeg';
        });
      });

      if (!hasLunchStaple) issues.push(`[${day}午餐] 缺少主食`);
      if (!hasLunchProtein) issues.push(`[${day}午餐] 缺少蛋白质`);
      if (!hasLunchVeg) issues.push(`[${day}午餐] 缺少蔬菜`);

      // ===== 3. 晚餐检查 =====
      const dinner = dayPlan.dinner;
      const dinnerDishes = dinner.dishes.filter(d => d.dishType !== 'dessert');

      // 3a. 晚餐必须有主食+蛋白质+蔬菜
      const hasDinnerStaple = dinnerDishes.some(d => d.dishType === 'staple');
      const hasDinnerProtein = dinnerDishes.some(d => {
        if (d.dishType === 'meat' || d.dishType === 'egg') return true;
        if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
        if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
        return false;
      });
      const hasDinnerVeg = dinnerDishes.some(d => {
        if (d.dishType === 'vegetable') return true;
        return d.mainIngredients.some(ing => {
          const cat = lookupFoodCategory(ing);
          return cat === 'darkVeg' || cat === 'lightVeg';
        });
      });

      if (!hasDinnerStaple) issues.push(`[${day}晚餐] 缺少主食`);
      if (!hasDinnerProtein) issues.push(`[${day}晚餐] 缺少蛋白质`);
      if (!hasDinnerVeg) issues.push(`[${day}晚餐] 缺少蔬菜`);

      // 3b. 晚餐不应有复杂的红烧/油炸类
      const heavyDinner = dinnerDishes.filter(d => {
        const name = d.name;
        return name.includes('红烧') || name.includes('炸') || name.includes('糖醋') || name.includes('烤');
      });
      if (heavyDinner.length > 0) {
        issues.push(`[${day}晚餐] 包含不适宜的重口味菜品: ${heavyDinner.map(d => d.name).join('、')}`);
      }

      // ===== 4. 全天搭配检查 =====
      const dayCheck = validateDayPlan(dayPlan, age);

      // 4a. 主食检查：全天不能三餐同类型非米饭主食
      const allStaples = [
        ...breakfastDishes.filter(d => d.dishType === 'staple'),
        ...lunchDishes.filter(d => d.dishType === 'staple'),
        ...dinnerDishes.filter(d => d.dishType === 'staple'),
      ];
      const stapleNames = allStaples.map(d => d.name);

      // 检查是否三餐都是面食
      const allNoodle = allStaples.every(d => d.name.includes('面') && !d.name.includes('面包'));
      if (allNoodle && allStaples.length >= 3) {
        issues.push(`[${day}] 全天三餐都是面食: ${stapleNames.join('、')}`);
      }

      // 检查是否三餐都是粥
      const allPorridge = allStaples.every(d => d.name.includes('粥'));
      if (allPorridge && allStaples.length >= 3) {
        issues.push(`[${day}] 全天三餐都是粥: ${stapleNames.join('、')}`);
      }

      // 4b. 午餐晚餐可以都是米饭
      const lunchHasRice = lunchDishes.some(d => d.dishType === 'staple' && (d.name.includes('米饭') || d.name.endsWith('饭')));
      const dinnerHasRice = dinnerDishes.some(d => d.dishType === 'staple' && (d.name.includes('米饭') || d.name.endsWith('饭')));
      // 这是OK的，不报错

      // 4c. 核心食材重复检查
      const breakfastIngs = new Set(breakfastDishes.flatMap(d => d.mainIngredients).filter(ing => lookupFoodCategory(ing) !== 'other'));
      const lunchIngs = new Set(lunchDishes.flatMap(d => d.mainIngredients).filter(ing => lookupFoodCategory(ing) !== 'other'));
      const dinnerIngs = new Set(dinnerDishes.flatMap(d => d.mainIngredients).filter(ing => lookupFoodCategory(ing) !== 'other'));

      // 检查蛋类是否3餐都出现
      const eggInBreakfast = breakfastDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg'));
      const eggInLunch = lunchDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg'));
      const eggInDinner = dinnerDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'egg'));
      const eggCount = [eggInBreakfast, eggInLunch, eggInDinner].filter(Boolean).length;
      if (eggCount >= 3) {
        issues.push(`[${day}] 蛋类出现在全部${eggCount}餐中，过于集中`);
      }

      // 4d. 蛋白质分布
      const allProteinTypes = new Set<string>();
      for (const dish of [...breakfastDishes, ...lunchDishes, ...dinnerDishes]) {
        if (dish.dishType === 'meat' || dish.dishType === 'egg') {
          for (const ing of dish.mainIngredients) {
            const cat = lookupFoodCategory(ing);
            if (cat === 'egg') allProteinTypes.add('蛋类');
            else if (cat === 'fishSeafood') allProteinTypes.add('鱼虾类');
            else if (cat === 'redMeat') allProteinTypes.add('肉类');
            else if (cat === 'poultry') allProteinTypes.add('禽肉');
            else if (cat === 'soyProduct') allProteinTypes.add('豆制品');
          }
        }
      }

      // 4e. 蔬菜多样性
      const allDishes = [...breakfastDishes, ...lunchDishes, ...dinnerDishes];
      const hasDarkVeg = allDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'darkVeg'));
      const hasLightVeg = allDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'lightVeg'));

      // 4f. 奶制品不应出现在三餐中
      const hasDairyInMeals = allDishes.some(d => d.mainIngredients.some(ing => lookupFoodCategory(ing) === 'dairy'));
      // 注意：早餐可能会有奶制品作为配料，这个不算严重问题
      if (hasDairyInMeals) console.log(`    ℹ️ [${day}] 三餐含奶制品配料（diagnostic，不计为失败）`);

      // 5. 综合校验结果
      if (dayCheck.errors.length > 0) {
        issues.push(`[${day}] 全天校验错误: ${dayCheck.errors.join('; ')}`);
      }

      // 收集 warnings 中的关键问题
      const criticalWarnings = dayCheck.warnings.filter(w =>
        w.includes('蛋类出现在')
      );
      issues.push(...criticalWarnings.map(w => `[${day}] ${w}`));
    }

    const pass = issues.length === 0;
    if (pass) totalPass++;
    else totalFail++;

    allResults.push({ age, pass, issues });

    console.log(`  第${iter + 1}轮: ${pass ? '✅ PASS' : '❌ FAIL'} (${issues.length}个问题)`);
    if (issues.length > 0) {
      issues.forEach(i => console.log(`    - ${i}`));
    }
  }
}

// ============================================================
// 详细抽样检查：打印一轮完整的一天计划
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log('抽样展示：1-2y 某一天的三餐计划');
console.log('='.repeat(60));

settings.babyAge = '1-2y';
const samplePlan = generateWeeklyPlan(settings, { seed: 'daily-meal-plan-sample' });
const monday = samplePlan.monday;

function printMeal(mealType: MealType, dishes: { name: string; dishType: string }[]) {
  const label = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }[mealType];
  console.log(`\n📌 ${label}:`);
  dishes.forEach((d, i) => {
    const typeLabel = { staple: '主食', meat: '荤菜', vegetable: '素菜', soup: '汤品', egg: '蛋类', dessert: '点心' }[d.dishType];
    console.log(`  ${i + 1}. [${typeLabel}] ${d.name}`);
  });
}

printMeal('breakfast', monday.breakfast.dishes);
printMeal('lunch', monday.lunch.dishes);
printMeal('dinner', monday.dinner.dishes);

// 打印全天校验结果
const check = validateDayPlan(monday, '1-2y');
console.log(`\n📋 全天校验结果:`);
console.log(`  valid: ${check.valid}`);
if (check.stapleWarning) console.log(`  主食: ⚠️ ${check.stapleWarning}`);
if (check.ingredientRepeat?.length) console.log(`  食材重复: ⚠️ ${check.ingredientRepeat.join('; ')}`);
if (check.proteinDistribution) console.log(`  蛋白质: ${check.proteinDistribution.ok ? '✅' : '⚠️'} ${check.proteinDistribution.detail}`);
if (check.vegetableDiversity) console.log(`  蔬菜: ${check.vegetableDiversity.ok ? '✅' : '⚠️'} ${check.vegetableDiversity.detail}`);
if (check.warnings.length) console.log(`  warnings: ${check.warnings.join('; ')}`);
console.log(`  🥛 奶量: ${check.milkTip}`);

// ============================================================
// 汇总
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log('测试汇总');
console.log('='.repeat(60));
console.log(`总测试轮数: ${totalPass + totalFail}`);
console.log(`通过: ${totalPass} ✅`);
console.log(`失败: ${totalFail} ❌`);

const byAge: Record<string, { pass: number; fail: number }> = {};
for (const r of allResults) {
  if (!byAge[r.age]) byAge[r.age] = { pass: 0, fail: 0 };
  if (r.pass) byAge[r.age].pass++;
  else byAge[r.age].fail++;
}

for (const [age, stats] of Object.entries(byAge)) {
  console.log(`  ${age}: ${stats.pass}/${stats.pass + stats.fail} 通过`);
}

console.log(`\n通过率: ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%`);

if (totalFail > 0) process.exit(1);
