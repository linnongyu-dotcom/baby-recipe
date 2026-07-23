/**
 * 资深测试人员自测：12个月以上宝宝三餐推荐合理性
 * 覆盖所有验收标准和边界情况
 */
import { generateWeeklyPlan, regenerateMeal, swapMeals } from '../src/utils/recipeGenerator';
import { UserSettings, AgeGroup, Recipe, MealType } from '../src/types';
import { inferProteinSource, isTextureForbiddenForAge12Plus, checkMealMandatory } from '../src/utils/mealValidator';
import { lookupFoodCategory } from '../src/utils/foodDictionary';

// ============================================================
// 工具函数
// ============================================================
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MEALS = ['breakfast', 'lunch', 'dinner'] as const;

function isSoupyStapleName(name: string): boolean {
  if (name.includes('馄饨')) return true;
  if (name.includes('粥')) return true;
  if (name.includes('汤')) return true;
  if (name.includes('面')) {
    const dry = ['拌面', '炸酱', '肉酱面', '凉面', '炒面'];
    if (!dry.some(k => name.includes(k))) return true;
  }
  return false;
}

function getStapleSubCategory(name: string): string {
  if (name.includes('面') && !name.includes('面包')) return 'noodle';
  if (name.includes('粥') || name.includes('米糊')) return 'porridge';
  if (name.includes('米饭') || name.endsWith('饭')) return 'rice';
  if (name.includes('馒头') || name.includes('花卷') || name.includes('饼') || name.includes('卷')) return 'bun';
  if (name.includes('饺子') || name.includes('馄饨') || name.includes('包子')) return 'dumpling';
  if (name.includes('红薯') || name.includes('紫薯') || name.includes('土豆泥')) return 'tuber';
  return 'other';
}

// ============================================================
// 测试用例
// ============================================================
interface TestFailure {
  location: string;
  rule: string;
  detail: string;
}

class TestSuite {
  failures: TestFailure[] = [];
  totalChecks = 0;
  passedChecks = 0;

  check(condition: boolean, location: string, rule: string, detail: string) {
    this.totalChecks++;
    if (condition) {
      this.passedChecks++;
    } else {
      this.failures.push({ location, rule, detail });
    }
  }

  summary(): string {
    const lines: string[] = [];
    lines.push(`=`.repeat(60));
    lines.push(`总计检查 ${this.totalChecks} 项`);
    lines.push(`通过: ${this.passedChecks} | 失败: ${this.failures.length}`);
    if (this.failures.length > 0) {
      lines.push(`\n失败详情:`);
      for (const f of this.failures) {
        lines.push(`  [${f.rule}] ${f.location}: ${f.detail}`);
      }
    }
    lines.push(`=`.repeat(60));
    return lines.join('\n');
  }
}

// ============================================================
// 测试主函数
// ============================================================
function runFullTest(age: AgeGroup, rounds: number): TestSuite {
  const suite = new TestSuite();
  const is12Plus = age === '1-2y' || age === '2-3y' || age === '3-5y';
  const isBaby = age === '6-8m' || age === '9-11m';

  for (let r = 0; r < rounds; r++) {
    const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
    const plan = generateWeeklyPlan(settings);

    for (let di = 0; di < DAYS.length; di++) {
      const dayPlan = plan[DAYS[di]];
      const dayName = DAY_NAMES[di];

      // 当日主食名称追踪（同天不重复）
      const dayStapleNames: string[] = [];

      for (const mealType of MEALS) {
        const meal = dayPlan[mealType];
        const dishes = meal.dishes;
        const loc = `${dayName}${mealType === 'breakfast' ? '早餐' : mealType === 'lunch' ? '午餐' : '晚餐'} R${r + 1}`;

        // ----- 通用检查 -----
        // 6-8m: 晚餐为空，午餐50%为空
        if (isBaby && dishes.length === 0) continue;

        // =========================================
        // 12个月以上专项检查
        // =========================================
        if (is12Plus) {
          // ✅ 检查1：不出现泥/糊/蛋黄
          for (const d of dishes) {
            suite.check(
              !isTextureForbiddenForAge12Plus(d),
              loc, '禁止泥糊蛋黄', `${d.name}属于泥/糊/蛋黄类`
            );
          }

          // ✅ 检查2：不出现两个主食同时作为一餐
          const staples = dishes.filter(d => d.dishType === 'staple');
          suite.check(
            staples.length <= 1,
            loc, '主食不重复', `同餐出现${staples.length}个主食: ${staples.map(s => s.name).join(',')}`
          );

          // ✅ 检查3：蛋白质不过度堆叠
          const proteinSources = new Set(dishes.map(d => inferProteinSource(d)).filter(s => s !== 'none'));
          suite.check(
            proteinSources.size <= 2,
            loc, '蛋白质不过度堆叠', `蛋白质来源: ${[...proteinSources].join(',')}`
          );

          // ✅ 检查4：数量控制
          const mainDishes = dishes.filter(d => d.dishType !== 'dessert');
          const ageLimits: Record<AgeGroup, Record<string, number>> = {
            '6-8m': { breakfast: 1, lunch: 1, dinner: 1 },
            '9-11m': { breakfast: 1, lunch: 1, dinner: 1 },
            '1-2y': { breakfast: 3, lunch: 4, dinner: 4 },
            '2-3y': { breakfast: 3, lunch: 5, dinner: 5 },
            '3-5y': { breakfast: 3, lunch: 5, dinner: 5 },
          };
          const limits = ageLimits[age];
          const max = limits[mealType];
          suite.check(
            mainDishes.length <= max,
            loc, '菜品数量', `主菜品${mainDishes.length}道（限制${max}道）`
          );

          // ✅ 检查5：带汤水主食不配汤
          const staple = dishes.find(d => d.dishType === 'staple');
          if (staple && isSoupyStapleName(staple.name)) {
            const soups = dishes.filter(d => d.dishType === 'soup');
            suite.check(
              soups.length === 0,
              loc, '汤水面食不配汤', `${staple.name}不应配汤(${soups.map(s => s.name).join(',')})`
            );
            const desserts = dishes.filter(d => d.dishType === 'dessert');
            const silverEar = desserts.filter(d => d.name.includes('银耳') || d.name.includes('羹'));
            suite.check(
              silverEar.length === 0,
              loc, '汤水面食不配银耳', `${staple.name}不应配${silverEar.map(s => s.name).join(',')}`
            );
          }

          // ✅ 检查6：主食+蛋白质+蔬菜结构
          const mandatory = checkMealMandatory(dishes, age, mealType);
          const hasStaple = mandatory.stapleOk;
          const hasVeg = mandatory.vegetableOk;
          const hasProtein = dishes.some(d => {
            const types: string[] = ['meat', 'egg'];
            if (types.includes(d.dishType)) return true;
            if (d.dishType === 'staple' && inferProteinSource(d) !== 'none') return true;
            if (d.dishType === 'soup' && inferProteinSource(d) !== 'none') return true;
            return false;
          });

          suite.check(
            hasStaple,
            loc, '有主食', '缺少主食'
          );
          suite.check(
            hasProtein,
            loc, '有蛋白质', '缺少蛋白质来源'
          );
          // 早餐蔬菜可选（婴儿早餐允许主食+蛋白质即可），午晚餐需要蔬菜
          if (mealType !== 'breakfast') {
            suite.check(
              hasVeg,
              loc, '有蔬菜', '缺少蔬菜'
            );
          }

          // ✅ 检查7：同天不出现同类主食重复（米饭除外）
          if (staple) {
            const isRice = staple.name.includes('米饭') || staple.name === '白米饭';
            if (!isRice) {
              dayStapleNames.push(staple.name);
            }
          }

          // ✅ 检查8：2岁以上午餐不喝粥
          if (mealType === 'lunch' && (age === '2-3y' || age === '3-5y')) {
            const hasCongee = dishes.some(d => d.name.includes('粥') && d.dishType === 'staple');
            suite.check(
              !hasCongee,
              loc, '2岁+午餐不喝粥', '出现粥类主食'
            );
          }

          // ✅ 检查9：午晚餐至少2道主菜（不含甜品）
          if (mealType !== 'breakfast') {
            suite.check(
              mainDishes.length >= 2,
              loc, '午晚餐至少2道主菜', `仅${mainDishes.length}道`
            );
          }
        }

        // =========================================
        // 6-8m 检查
        // =========================================
        if (age === '6-8m') {
          suite.check(
            dishes.length === 1,
            loc, '6-8m每餐1道', `${dishes.length}道菜`
          );
        }

        // =========================================
        // 9-11m 检查（ensureBabyDailyCoverage会补水果，每餐最多2道）
        // =========================================
        if (age === '9-11m') {
          suite.check(
            dishes.length >= 1 && dishes.length <= 3,
            loc, '9-11m每餐1-3道', `${dishes.length}道菜`
          );
        }
      }

      // 同天主食不重复（6-8m、9-11m除外）
      if (!isBaby && dayStapleNames.length > 1) {
        const unique = new Set(dayStapleNames);
        suite.check(
          unique.size === dayStapleNames.length,
          dayName + '全天', '同天主食不重复', `重复: ${dayStapleNames.filter((n, i, a) => a.indexOf(n) !== i).join(',')}`
        );
      }
    }
  }

  // =========================================
  // 边界测试：regenerateMeal（重新生成单餐）
  // =========================================
  if (is12Plus) {
    const settings: UserSettings = { babyAge: age, allergies: [], dislikes: [], likes: [] };
    const plan = generateWeeklyPlan(settings);

    for (const mealType of MEALS) {
      const meal = plan.monday[mealType];
      const usedRecipes = [
        ...plan.monday.breakfast.dishes,
        ...plan.monday.lunch.dishes,
        ...plan.monday.dinner.dishes,
      ].filter(d => !meal.dishes.some(md => md.id === d.id));

      const regenerated = regenerateMeal(settings, [], usedRecipes, mealType);
      const rd = regenerated.dishes;

      if (rd.length === 0) continue;

      // 同检查逻辑
      for (const d of rd) {
        suite.check(
          !isTextureForbiddenForAge12Plus(d),
          `regenerate ${mealType}`, '禁止泥糊蛋黄', `${d.name}`
        );
      }
      const rStaples = rd.filter(d => d.dishType === 'staple');
      suite.check(
        rStaples.length <= 1,
        `regenerate ${mealType}`, '主食不重复', `${rStaples.length}个主食`
      );
      const rMain = rd.filter(d => d.dishType !== 'dessert');
      const rLimits: Record<string, number> = { breakfast: 3, lunch: 4, dinner: 4 };
      suite.check(
        rMain.length <= rLimits[mealType],
        `regenerate ${mealType}`, '菜品数量', `${rMain.length}道`
      );
    }

    // 边界测试：swapMeals
    const swapped = swapMeals(plan.monday);
    const origLunchIds = plan.monday.lunch.dishes.map(d => d.id).sort().join(',');
    const swappedDinnerIds = swapped.dinner.dishes.map(d => d.id).sort().join(',');
    suite.check(
      origLunchIds === swappedDinnerIds,
      'swapMeals', '午晚餐互换正确', '午餐未换到晚餐位置'
    );
  }

  return suite;
}

// ============================================================
// 运行
// ============================================================
console.log('╔══════════════════════════════════════════════════╗');
console.log('║  资深测试人员自测：宝宝食谱推荐合理性          ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const allAges: { age: AgeGroup; rounds: number }[] = [
  { age: '6-8m', rounds: 3 },
  { age: '9-11m', rounds: 3 },
  { age: '1-2y', rounds: 5 },
  { age: '2-3y', rounds: 5 },
  { age: '3-5y', rounds: 5 },
];

let totalFailures = 0;
let totalChecks = 0;

for (const { age, rounds } of allAges) {
  console.log(`\n--- [${age}] ${rounds}轮测试 ---`);
  const suite = runFullTest(age, rounds);
  console.log(suite.summary());
  totalFailures += suite.failures.length;
  totalChecks += suite.totalChecks;
}

console.log(`\n╔══════════════════════════════════════════════════╗`);
console.log(`║  总计: ${totalChecks}项检查, ${totalChecks - totalFailures}通过, ${totalFailures}失败`);
if (totalFailures === 0) {
  console.log(`║  ✅ 全部通过！`);
} else {
  console.log(`║  ❌ 存在 ${totalFailures} 项失败，需修复`);
}
console.log(`╚══════════════════════════════════════════════════╝`);

if (totalFailures > 0) process.exit(1);
