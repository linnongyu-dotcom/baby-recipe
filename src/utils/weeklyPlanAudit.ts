import { AgeGroup, DAYS_OF_WEEK, DayOfWeek, MealType, Recipe, UserSettings, WeeklyPlan } from '../types';
import {
  getIngredientProteinCategories,
  getMealSuitable,
  getVegetableIngredients,
  isIndependentLunchMeatDish,
  isRecipeAgeCompatible,
  isSoupyStaple,
} from './mealValidator';
import { getRecipeCookingForm, getRecipeFamily } from './recipeFamily';

export type AuditIssueSeverity = 'error' | 'warning';

export interface AuditIssue {
  code: string;
  severity: AuditIssueSeverity;
  day?: DayOfWeek;
  mealType?: MealType;
  recipeIds?: string[];
  ingredients?: string[];
  message: string;
}

export interface WeeklyPlanAuditStats {
  lunchCount: number;
  lunchWithIndependentMeatCount: number;
  lunchWithVegetableCount: number;
  regularLunchWithSoupCount: number;
  soupyStapleLunchCount: number;
  lunchProteinCounts: Record<'red_meat' | 'poultry' | 'fish' | 'shrimp' | 'egg' | 'tofu', number>;
  repeatedLunchRecipeIds: string[];
  repeatedLunchFamilies: string[];
  consecutiveLunchFamilies: string[];
  consecutiveLunchForms: string[];
}

export interface AuditContext {
  ageGroup: AgeGroup;
  allergies?: string[];
  avoidances?: string[];
  /** Age/profile-compatible candidates. Used only to decide whether a soft target is achievable. */
  availableRecipes?: Recipe[];
  /** IDs used by the previously generated week, when cross-week repetition is relevant. */
  previousWeekLunchRecipeIds?: string[];
}

export interface WeeklyPlanAuditReport {
  valid: boolean;
  errors: AuditIssue[];
  warnings: AuditIssue[];
  stats: WeeklyPlanAuditStats;
}

const includesFood = (value: string, constraint: string): boolean =>
  value.includes(constraint) || constraint.includes(value);

function conflicts(recipe: Recipe, constraints: string[]): string[] {
  const ingredients = [...recipe.mainIngredients, ...recipe.ingredients.map(item => item.name)];
  return [...new Set(ingredients.filter(ingredient => constraints.some(item => includesFood(ingredient, item))))];
}

function issue(
  target: AuditIssue[], code: string, severity: AuditIssueSeverity, message: string,
  extra: Partial<AuditIssue> = {},
): void {
  target.push({ code, severity, message, ...extra });
}

export function auditWeeklyPlan(plan: WeeklyPlan, context: AuditContext): WeeklyPlanAuditReport {
  const errors: AuditIssue[] = [];
  const warnings: AuditIssue[] = [];
  const stats: WeeklyPlanAuditStats = {
    lunchCount: 0,
    lunchWithIndependentMeatCount: 0,
    lunchWithVegetableCount: 0,
    regularLunchWithSoupCount: 0,
    soupyStapleLunchCount: 0,
    lunchProteinCounts: { red_meat: 0, poultry: 0, fish: 0, shrimp: 0, egg: 0, tofu: 0 },
    repeatedLunchRecipeIds: [], repeatedLunchFamilies: [], consecutiveLunchFamilies: [], consecutiveLunchForms: [],
  };
  const lunchIds = new Map<string, number>();
  const families: string[] = [];
  const forms: string[] = [];
  const familyCounts = new Map<string, number>();

  for (const day of DAYS_OF_WEEK) {
    const dayIds = new Set<string>();
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const dishes = plan[day][mealType].dishes;
      for (const recipe of dishes) {
        if (dayIds.has(recipe.id)) issue(errors, 'MEAL_RECIPE_DUPLICATED', 'error', '同一天出现重复食谱。', { day, mealType, recipeIds: [recipe.id] });
        dayIds.add(recipe.id);
        if (!isRecipeAgeCompatible(recipe, context.ageGroup).compatible) issue(errors, 'RECIPE_AGE_MISMATCH', 'error', '食谱与年龄不适配。', { day, mealType, recipeIds: [recipe.id] });
        const allergyHits = conflicts(recipe, context.allergies ?? []);
        if (allergyHits.length) issue(errors, 'RECIPE_ALLERGY_CONFLICT', 'error', '食谱命中过敏食材。', { day, mealType, recipeIds: [recipe.id], ingredients: allergyHits });
        const avoidanceHits = conflicts(recipe, context.avoidances ?? []);
        if (avoidanceHits.length) issue(errors, 'RECIPE_AVOIDANCE_CONFLICT', 'error', '食谱命中明确忌口。', { day, mealType, recipeIds: [recipe.id], ingredients: avoidanceHits });
      }
    }

    const dishes = plan[day].lunch.dishes;
    if (!dishes.length) continue;
    stats.lunchCount++;
    const staple = dishes.find(recipe => recipe.dishType === 'staple');
    const meat = dishes.find(isIndependentLunchMeatDish);
    // “真实蔬菜”按实际食材判断，而不是按 dishType 标签判断；肉菜和复合主食
    // 中的西葫芦、番茄等同样是真实蔬菜，不能被审计器误报为缺失。
    const vegetable = dishes.find(recipe => getVegetableIngredients(recipe).length > 0);
    const soup = dishes.find(recipe => recipe.dishType === 'soup');
    const soupyStaple = staple && isSoupyStaple(staple);
    if (!staple) issue(errors, 'LUNCH_MISSING_STAPLE', 'error', '午餐缺少主食。', { day, mealType: 'lunch' });
    if (!meat) issue(errors, 'LUNCH_MISSING_INDEPENDENT_MEAT', 'error', '午餐缺少独立动物性肉菜。', { day, mealType: 'lunch' });
    else stats.lunchWithIndependentMeatCount++;
    if (!vegetable) issue(errors, 'LUNCH_MISSING_VEGETABLE', 'error', '午餐缺少真实蔬菜。', { day, mealType: 'lunch' });
    else stats.lunchWithVegetableCount++;
    if (soupyStaple) {
      stats.soupyStapleLunchCount++;
      if (soup) issue(errors, 'LUNCH_SOUP_WITH_SOUPY_STAPLE', 'error', '带汤主食不应再搭配独立汤。', { day, mealType: 'lunch', recipeIds: [staple.id, soup.id] });
    } else if (soup) stats.regularLunchWithSoupCount++;
    else {
      const soupAvailable = context.availableRecipes?.some(recipe => recipe.dishType === 'soup' && getMealSuitable(recipe).includes('lunch')) ?? true;
      if (soupAvailable) issue(warnings, 'LUNCH_MISSING_SOUP', 'warning', '普通午餐未搭配可用汤品。', { day, mealType: 'lunch' });
    }
    if (dishes.some(recipe => recipe.dishType === 'soup' && isIndependentLunchMeatDish(recipe))) {
      issue(errors, 'LUNCH_SOUP_AS_INDEPENDENT_MEAT', 'error', '汤不能作为独立肉菜。', { day, mealType: 'lunch' });
    }
    for (const recipe of dishes) {
      lunchIds.set(recipe.id, (lunchIds.get(recipe.id) ?? 0) + 1);
      if (!getMealSuitable(recipe).includes('lunch')) issue(errors, 'LUNCH_RECIPE_NOT_SUITABLE', 'error', '食谱不适合午餐。', { day, mealType: 'lunch', recipeIds: [recipe.id] });
    }
    if (meat) {
      for (const category of getIngredientProteinCategories(meat)) if (category !== 'none') stats.lunchProteinCounts[category]++;
      const family = getRecipeFamily(meat);
      const form = getRecipeCookingForm(meat);
      if (!meat.mealFamily) issue(warnings, 'LUNCH_FAMILY_METADATA_MISSING', 'warning', '午餐肉菜缺少 family 元数据。', { day, mealType: 'lunch', recipeIds: [meat.id] });
      if (!meat.cookingForm) issue(warnings, 'LUNCH_FORM_METADATA_MISSING', 'warning', '午餐肉菜缺少 cooking form 元数据。', { day, mealType: 'lunch', recipeIds: [meat.id] });
      families.push(family); forms.push(form);
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    } else { families.push(''); forms.push(''); }
  }

  stats.repeatedLunchRecipeIds = [...lunchIds].filter(([, count]) => count > 1).map(([id]) => id);
  stats.repeatedLunchFamilies = [...familyCounts].filter(([, count]) => count > 1).map(([family]) => family);
  for (const id of stats.repeatedLunchRecipeIds) issue(warnings, 'LUNCH_RECIPE_REPEATED', 'warning', '同一道午餐菜在一周内重复。', { recipeIds: [id] });
  for (const family of stats.repeatedLunchFamilies) issue(warnings, 'LUNCH_FAMILY_REPEATED', 'warning', '同一午餐菜品家族在一周内重复。', { recipeIds: [family] });
  for (let index = 1; index < families.length; index++) if (families[index] && families[index] === families[index - 1]) {
    stats.consecutiveLunchFamilies.push(families[index]);
    issue(warnings, 'LUNCH_FAMILY_CONSECUTIVE', 'warning', '同一菜品家族连续出现。');
  }
  for (let index = 2; index < forms.length; index++) if (forms[index] && forms[index] === forms[index - 1] && forms[index] === forms[index - 2]) {
    stats.consecutiveLunchForms.push(forms[index]);
    issue(warnings, 'LUNCH_FORM_CONSECUTIVE', 'warning', '同一烹饪形态连续三天出现。');
  }
  const redMeat = stats.lunchProteinCounts.red_meat;
  const candidates = context.availableRecipes ?? [];
  const hasCandidate = (categories: string[]) => candidates.some(recipe => isIndependentLunchMeatDish(recipe) && getIngredientProteinCategories(recipe).some(category => categories.includes(category)));
  if (redMeat > 3 && hasCandidate(['poultry', 'fish', 'shrimp'])) issue(warnings, 'LUNCH_RED_MEAT_OVER_TARGET', 'warning', '红肉超过每周三次。');
  if (redMeat < 2 && hasCandidate(['red_meat'])) issue(warnings, 'LUNCH_RED_MEAT_UNDER_TARGET', 'warning', '候选充足但红肉少于每周两次。');
  if (!stats.lunchProteinCounts.poultry && hasCandidate(['poultry'])) issue(warnings, 'LUNCH_POULTRY_MISSING', 'warning', '本周午餐未出现禽肉。');
  if (!(stats.lunchProteinCounts.fish + stats.lunchProteinCounts.shrimp) && hasCandidate(['fish', 'shrimp'])) issue(warnings, 'LUNCH_AQUATIC_MISSING', 'warning', '本周午餐未出现鱼虾。');
  for (const id of context.previousWeekLunchRecipeIds ?? []) if (lunchIds.has(id)) issue(warnings, 'LUNCH_RECIPE_CROSS_WEEK_REPEATED', 'warning', '午餐菜品跨周重复。', { recipeIds: [id] });
  return { valid: errors.length === 0, errors, warnings, stats };
}

export function auditContextFromSettings(settings: UserSettings, availableRecipes?: Recipe[]): AuditContext {
  if (!settings.babyAge) throw new Error('审计需要明确的年龄段');
  return { ageGroup: settings.babyAge, allergies: settings.allergies, avoidances: settings.dislikes, availableRecipes };
}
