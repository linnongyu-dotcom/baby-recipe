import { recipes } from '../src/data/recipes';
import { AgeGroup, DAY_LABELS, DAYS_OF_WEEK, Recipe, UserSettings } from '../src/types';
import { generateWeeklyPlan } from '../src/utils/recipeGenerator';
import { auditWeeklyPlan, AuditIssue } from '../src/utils/weeklyPlanAudit';

const ages: AgeGroup[] = ['1-2y', '2-3y', '3-5y'];
const profiles: Array<{ name: string; allergies: string[]; dislikes: string[] }> = [
  { name: 'standard', allergies: [], dislikes: [] },
  { name: 'avoid-beef', allergies: [], dislikes: ['牛肉'] },
  { name: 'avoid-pork', allergies: [], dislikes: ['猪肉'] },
  { name: 'aquatic-allergy', allergies: ['鱼', '虾'], dislikes: [] },
  { name: 'egg-allergy', allergies: ['鸡蛋'], dislikes: [] },
  { name: 'multi-restricted', allergies: ['鱼', '虾'], dislikes: ['牛肉'] },
];

function compatibleCandidates(settings: UserSettings): Recipe[] {
  return recipes.filter(recipe => recipe.ageGroups.includes(settings.babyAge!)).filter(recipe =>
    !recipe.mainIngredients.some(ingredient =>
      [...settings.allergies, ...settings.dislikes].some(item => ingredient.includes(item) || item.includes(ingredient)),
    ),
  );
}

function failure(age: AgeGroup, profile: typeof profiles[number], seed: number, issue: AuditIssue, plan: ReturnType<typeof generateWeeklyPlan>): string {
  const day = issue.day ?? DAYS_OF_WEEK[0];
  const lunch = plan[day].lunch.dishes.map(recipe => `${recipe.dishType}: ${recipe.name}`).join('\n  ');
  const proteins = DAYS_OF_WEEK.map(key => `${DAY_LABELS[key]}: ${plan[key].lunch.dishes.find(recipe => recipe.dishType === 'meat')?.name ?? '无'}`).join('\n  ');
  return `[FAIL]\nageGroup: ${age}\nprofile: ${profile.name}\nconstraints: allergies=${profile.allergies.join(',') || 'none'}; avoidances=${profile.dislikes.join(',') || 'none'}\nseed: ${seed}\nissueCode: ${issue.code}\nday: ${day}\n${issue.ingredients?.length ? `ingredients: ${issue.ingredients.join(',')}\n` : ''}lunch:\n  ${lunch}\nweekLunchProteins:\n  ${proteins}`;
}

let hardFailures = 0;
let missingMeat = 0;
let ageConflicts = 0;
let allergyConflicts = 0;
let repeatedLionHeads = 0;
let redWarnings = 0;
let regularLunches = 0;
let regularLunchesWithSoup = 0;
const samples: string[] = [];

for (const age of ages) for (const profile of profiles) for (let seed = 1; seed <= 100; seed++) {
  const settings: UserSettings = { babyAge: age, allergies: profile.allergies, dislikes: profile.dislikes, likes: [] };
  const plan = generateWeeklyPlan(settings, { seed });
  const report = auditWeeklyPlan(plan, { ageGroup: age, allergies: profile.allergies, avoidances: profile.dislikes, availableRecipes: compatibleCandidates(settings) });
  hardFailures += report.errors.length;
  missingMeat += report.errors.filter(item => item.code === 'LUNCH_MISSING_INDEPENDENT_MEAT').length;
  ageConflicts += report.errors.filter(item => item.code === 'RECIPE_AGE_MISMATCH').length;
  allergyConflicts += report.errors.filter(item => item.code === 'RECIPE_ALLERGY_CONFLICT').length;
  repeatedLionHeads += report.stats.repeatedLunchFamilies.filter(item => item === 'lion_head').length;
  redWarnings += report.warnings.filter(item => item.code.startsWith('LUNCH_RED_MEAT_')).length;
  regularLunches += report.stats.lunchCount - report.stats.soupyStapleLunchCount;
  regularLunchesWithSoup += report.stats.regularLunchWithSoupCount;
  if (report.errors.length && samples.length < 5) samples.push(failure(age, profile, seed, report.errors[0], plan));
}

console.log(`Meal plan audit\n\nProfiles: ${profiles.length}\nAge groups: ${ages.length}\nSeeds per profile: 100\nTotal weekly plans: ${profiles.length * ages.length * 100}\n\nHard failures: ${hardFailures}\nLunches without independent meat: ${missingMeat}\nAge conflicts: ${ageConflicts}\nAllergy conflicts: ${allergyConflicts}\nRepeated lion-head families: ${repeatedLionHeads}\nRed-meat target warnings: ${redWarnings}\nSoup coverage: ${regularLunches ? (regularLunchesWithSoup / regularLunches * 100).toFixed(1) : '100.0'}%\n\nResult: ${hardFailures ? 'FAIL' : 'PASS'}`);
if (samples.length) console.error(`\n${samples.join('\n\n')}`);
process.exitCode = hardFailures ? 1 : 0;
