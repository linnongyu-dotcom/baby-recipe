import { AGE_TEXTURE_RULES, AgeGroup, Recipe } from '../types';
import { getMealSuitable, getProteinType, hasStapleIngredients, isIndependentLunchMeatDish } from './mealValidator';
import { getRecipeCookingForm, getRecipeFamily } from './recipeFamily';

export const LUNCH_AUDIT_AGES: AgeGroup[] = ['1-2y', '2-3y', '3-5y'];
export type AuditedProtein = 'red_meat' | 'poultry' | 'fish' | 'shrimp' | 'none';

export interface LunchProteinAudit {
  ageGroup: AgeGroup;
  total: number;
  proteins: Record<AuditedProtein, number>;
  familiesByProtein: Record<AuditedProtein, number>;
  familyCount: number;
  cookingFormCount: number;
  missingMealSuitable: number;
  missingTextureLevel: number;
  missingMealRole: number;
  missingFamilyOrForm: number;
}

/** This is the production lunch candidate predicate, exposed so reports cannot drift from generation. */
export function isAuditableLunchProtein(recipe: Recipe, age: AgeGroup): boolean {
  return recipe.ageGroups.includes(age)
    && getMealSuitable(recipe).includes('lunch')
    && isIndependentLunchMeatDish(recipe)
    && !hasStapleIngredients(recipe);
}

export function auditLunchProteinPool(allRecipes: Recipe[], ageGroup: AgeGroup): LunchProteinAudit {
  const candidates = allRecipes.filter(recipe => isAuditableLunchProtein(recipe, ageGroup));
  const proteins: LunchProteinAudit['proteins'] = { red_meat: 0, poultry: 0, fish: 0, shrimp: 0, none: 0 };
  const familySets = Object.fromEntries(Object.keys(proteins).map(key => [key, new Set<string>()])) as Record<AuditedProtein, Set<string>>;
  for (const recipe of candidates) {
    const protein = getProteinType(recipe) as AuditedProtein;
    proteins[protein]++;
    familySets[protein].add(getRecipeFamily(recipe));
  }
  return {
    ageGroup,
    total: candidates.length,
    proteins,
    familiesByProtein: Object.fromEntries(Object.entries(familySets).map(([key, value]) => [key, value.size])) as Record<AuditedProtein, number>,
    familyCount: new Set(candidates.map(getRecipeFamily)).size,
    cookingFormCount: new Set(candidates.map(getRecipeCookingForm)).size,
    missingMealSuitable: candidates.filter(recipe => !recipe.mealSuitable).length,
    missingTextureLevel: candidates.filter(recipe => !recipe.textureLevel).length,
    missingMealRole: candidates.filter(recipe => !recipe.mealRole).length,
    missingFamilyOrForm: candidates.filter(recipe => !recipe.mealFamily || !recipe.cookingForm).length,
  };
}

export function validateLunchProteinRecipe(recipe: Recipe): string[] {
  const errors: string[] = [];
  if (!recipe.id || !recipe.name) errors.push('missing identity');
  if (!recipe.ingredients.length || !recipe.mainIngredients.length || !recipe.steps.length) errors.push('empty recipe content');
  if (!recipe.ageGroups.length) errors.push('missing age group');
  if (!recipe.mealSuitable?.includes('lunch')) errors.push('not explicitly lunch suitable');
  if (recipe.mealRole !== 'protein') errors.push('meal role is not protein');
  if (!recipe.proteinSource || recipe.proteinSource === 'none' || getProteinType(recipe) === 'none') errors.push('unknown protein');
  if (!recipe.proteinSourceType || recipe.proteinSourceType === 'none') errors.push('unknown protein source type');
  if (!recipe.mealFamily || !recipe.cookingForm) errors.push('missing family/form');
  if (!isIndependentLunchMeatDish(recipe)) errors.push('not independent animal protein');
  if (recipe.dishType === 'soup' || hasStapleIngredients(recipe)) errors.push('soup or staple recipe');
  if (!recipe.textureLevel || recipe.ageGroups.some(age => AGE_TEXTURE_RULES[age].forbidden.includes(recipe.textureLevel!))) errors.push('age-incompatible texture');
  return errors;
}
