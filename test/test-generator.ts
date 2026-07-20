import { generateWeeklyPlan } from '../src/utils/recipeGenerator';
import { UserSettings, AgeGroup, Recipe, DishType } from '../src/types';

const AGES: AgeGroup[] = ['6-8m', '9-11m', '1-2y', '2-3y', '3-5y'];

interface TestResult {
  age: AgeGroup;
  run: number;
  errors: string[];
  stats: {
    totalMeals: number;
    emptyMeals: number;
    singleDishMeals: number;
    breakfastSingleDish: number;
    soupWithSoupyStaple: number;
    eggWithMeatEgg: number;
    dessertWithSoupyStaple: number;
    lunchCongeeOver2: number;
    stapleRepeatSameDay: number;
  };
}

function isSoupyStapleName(name: string): boolean {
  if (name.includes('馄饨')) return true;
  if (name.includes('粥')) return true;
  if (name.includes('汤')) return true;
  if (name.includes('面')) {
    const dryNoodleKeywords = ['拌面', '炸酱', '肉酱面', '凉面', '炒面'];
    if (!dryNoodleKeywords.some(k => name.includes(k))) return true;
  }
  return false;
}

function testPlan(settings: UserSettings, runNum: number): TestResult {
  const errors: string[] = [];
  const stats = {
    totalMeals: 0,
    emptyMeals: 0,
    singleDishMeals: 0,
    breakfastSingleDish: 0,
    soupWithSoupyStaple: 0,
    eggWithMeatEgg: 0,
    dessertWithSoupyStaple: 0,
    lunchCongeeOver2: 0,
    stapleRepeatSameDay: 0,
  };

  const plan = generateWeeklyPlan(settings);
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const dayPlan = plan[day];
    const dayName = dayNames[di];

    // Check each meal
    const meals: { label: string; plan: typeof dayPlan.breakfast }[] = [
      { label: '早餐', plan: dayPlan.breakfast },
      { label: '午餐', plan: dayPlan.lunch },
      { label: '晚餐', plan: dayPlan.dinner },
    ];

    // Track staples used in this day
    const dayStapleNames: string[] = [];

    for (const meal of meals) {
      stats.totalMeals++;
      const dishes = meal.plan.dishes;

      // Check empty meal
      if (dishes.length === 0) {
        stats.emptyMeals++;
        // 6-8 月龄：晚餐始终为空，午餐 50% 概率为空（1-2餐辅食模式）
        // 9-11 月龄：晚餐始终为空（2餐辅食模式）
        if (settings.babyAge === '6-8m' || settings.babyAge === '9-11m') {
          continue;
        }
        errors.push(`${dayName}${meal.label}：无菜品`);
        continue;
      }

      // Check single dish meals (only concerning for non-breakfast or breakfast with soupy staple)
      if (dishes.length === 1) {
        stats.singleDishMeals++;
        // 6-8 月龄：每餐仅 1 道菜是正常设计
        if (settings.babyAge === '6-8m') {
          continue;
        }
        if (meal.label === '早餐') {
          stats.breakfastSingleDish++;
        }
      }

      // Check duplicate dish types in same meal (two 素菜, two 荤菜 etc.)
      const typeCounts: Record<string, number> = {};
      for (const d of dishes) {
        typeCounts[d.dishType] = (typeCounts[d.dishType] || 0) + 1;
      }
      for (const [type, count] of Object.entries(typeCounts)) {
        if (type !== 'staple' && type !== 'dessert' && count > 1) {
          errors.push(`${dayName}${meal.label}：重复${type}类型菜品(${dishes.filter(d => d.dishType === type).map(d => d.name).join(',')})`);
        }
      }

      const staple = dishes.find(d => d.dishType === 'staple');
      const soups = dishes.filter(d => d.dishType === 'soup');
      const eggs = dishes.filter(d => d.dishType === 'egg');
      const meats = dishes.filter(d => d.dishType === 'meat');
      const desserts = dishes.filter(d => d.dishType === 'dessert');

      // Check lunch congee for 2+ years
      const isOver2 = settings.babyAge === '2-3y' || settings.babyAge === '3-5y';
      if (meal.label === '午餐' && isOver2) {
        const hasCongee = dishes.some(d => d.name.includes('粥') && d.dishType === 'staple');
        if (hasCongee) {
          stats.lunchCongeeOver2++;
          errors.push(`${dayName}午餐：2岁以上午餐出现粥`);
        }
        // 2+ 午餐必须有荤菜（含肉蛋的主食也算）
        const hasProtein = dishes.some(d =>
          d.dishType === 'meat' ||
          (d.dishType === 'staple' && d.mainIngredients.some(ing =>
            ['猪肉', '牛肉', '鸡肉', '羊肉', '虾', '鱼', '鳕鱼', '三文鱼', '排骨', '蛋', '鸡蛋'].some(m => ing.includes(m))
          ))
        );
        if (!hasProtein) {
          errors.push(`${dayName}午餐：2岁以上午餐无肉类`);
        }
      }

      // Check soup with soupy staple
      if (staple && isSoupyStapleName(staple.name) && soups.length > 0) {
        stats.soupWithSoupyStaple++;
        errors.push(`${dayName}${meal.label}：${staple.name}配汤(${soups.map(s => s.name).join(',')})`);
      }

      // Check dessert (银耳类) with soupy staple
      if (staple && isSoupyStapleName(staple.name)) {
        const silverEarDesserts = desserts.filter(d =>
          d.name.includes('银耳') || d.name.includes('羹')
        );
        if (silverEarDesserts.length > 0) {
          stats.dessertWithSoupyStaple++;
          errors.push(`${dayName}${meal.label}：${staple.name}配银耳/羹(${silverEarDesserts.map(s => s.name).join(',')})`);
        }
      }

      // Check egg with meat-containing-egg dish (same meal should not have both egg dish and meat dish that contains egg)
      const meatWithEgg = meats.filter(m =>
        m.mainIngredients.some(ing => ing.includes('蛋'))
      );
      if (meatWithEgg.length > 0 && eggs.length > 0) {
        stats.eggWithMeatEgg++;
        errors.push(`${dayName}${meal.label}：含蛋荤菜(${meatWithEgg.map(m => m.name).join(',')})和蛋类(${eggs.map(e => e.name).join(',')})重复`);
      }

      // Track staples
      if (staple) {
        dayStapleNames.push(staple.name);
      }
    }

    // Check same-day staple repetition (rice exempt; skip for baby stages with small pools)
    if (settings.babyAge !== '6-8m' && settings.babyAge !== '9-11m') {
      const riceExempt = dayStapleNames.filter(n => {
        const isRice = n.includes('米饭') || n === '白米饭';
        return !isRice;
      });
      const uniqueStaples = new Set(riceExempt);
      if (uniqueStaples.size < riceExempt.length) {
        stats.stapleRepeatSameDay++;
        const dup = riceExempt.filter((n, i, arr) => arr.indexOf(n) !== i);
        errors.push(`${dayName}：主食重复(${[...new Set(dup)].join(',')})`);
      }
    }
  }

  return { age: settings.babyAge!, run: runNum, errors, stats };
}

console.log('='.repeat(60));
console.log('宝宝食谱生成器 - 资深工程师测试');
console.log('='.repeat(60));

const allErrors: string[] = [];
const runsPerAge = 5;

for (const age of AGES) {
  console.log(`\n--- ${age} ---`);
  const ageErrors: string[] = [];

  for (let run = 0; run < runsPerAge; run++) {
    const settings: UserSettings = {
      babyAge: age,
      allergies: [],
      dislikes: [],
      likes: [],
    };

    const result = testPlan(settings, run + 1);

    if (result.errors.length > 0) {
      ageErrors.push(...result.errors);
    }
  }

  if (ageErrors.length === 0) {
    console.log(`  ✓ 全部 ${runsPerAge} 轮测试通过`);
  } else {
    console.log(`  ✗ 发现 ${ageErrors.length} 个问题：`);
    for (const err of ageErrors) {
      console.log(`    - ${err}`);
    }
  }
  allErrors.push(...ageErrors);
}

console.log('\n' + '='.repeat(60));
console.log(`测试完成：共 ${AGES.length * runsPerAge} 轮，${allErrors.length > 0 ? `发现 ${allErrors.length} 个问题` : '全部通过 ✓'}`);
console.log('='.repeat(60));

if (allErrors.length > 0) {
  process.exit(1);
}
