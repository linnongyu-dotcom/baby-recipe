import assert from 'node:assert/strict';
import { recipes } from '../src/data/recipes';
import { generateWeeklyPlan } from '../src/utils/recipeGenerator';
import { auditWeeklyPlan } from '../src/utils/weeklyPlanAudit';

const settings = { babyAge: '2-3y' as const, allergies: [] as string[], dislikes: [] as string[], likes: [] as string[] };
const first = generateWeeklyPlan(settings, { seed: 20260806 });
const second = generateWeeklyPlan(settings, { seed: 20260806 });
assert.deepEqual(first, second, '同一随机种子应生成完全相同的周餐单');
assert.notDeepEqual(generateWeeklyPlan(settings, { seed: 1 }), generateWeeklyPlan(settings, { seed: 2 }), '不同种子应允许不同结果');

const randomBefore = Math.random;
generateWeeklyPlan(settings, { seed: 37 });
assert.equal(Math.random, randomBefore, '确定性生成不得替换全局 Math.random');

const report = auditWeeklyPlan(first, { ageGroup: '2-3y', availableRecipes: recipes });
assert.equal(report.valid, true, report.errors.map(item => item.code).join(','));

const missingMeat = structuredClone(first);
missingMeat.monday.lunch.dishes = missingMeat.monday.lunch.dishes.filter(recipe => recipe.dishType !== 'meat');
assert.ok(auditWeeklyPlan(missingMeat, { ageGroup: '2-3y' }).errors.some(item => item.code === 'LUNCH_MISSING_INDEPENDENT_MEAT'));

const missingSoup = structuredClone(first);
missingSoup.monday.lunch.dishes = missingSoup.monday.lunch.dishes.filter(recipe => recipe.dishType !== 'soup');
const soupReport = auditWeeklyPlan(missingSoup, { ageGroup: '2-3y' });
assert.ok(soupReport.warnings.some(item => item.code === 'LUNCH_MISSING_SOUP'));
assert.ok(!soupReport.errors.some(item => item.code === 'LUNCH_MISSING_SOUP'));

console.log('weekly plan audit tests passed');

for (const ageGroup of ['1-2y', '2-3y', '3-5y'] as const) {
  for (const profile of [
    { allergies: [] as string[], dislikes: [] as string[] },
    { allergies: ['鱼', '虾'], dislikes: ['牛肉'] },
  ]) {
    for (let seed = 1; seed <= 10; seed++) {
      const batchSettings = { babyAge: ageGroup, likes: [] as string[], ...profile };
      const plan = generateWeeklyPlan(batchSettings, { seed });
      const batchReport = auditWeeklyPlan(plan, {
        ageGroup,
        allergies: profile.allergies,
        avoidances: profile.dislikes,
      });
      assert.equal(batchReport.valid, true, `age=${ageGroup} profile=${JSON.stringify(profile)} seed=${seed}: ${batchReport.errors.map(item => item.code).join(',')}`);
      assert.deepEqual(plan, generateWeeklyPlan(batchSettings, { seed }), `age=${ageGroup} seed=${seed} 不可重复`);
    }
  }
}
