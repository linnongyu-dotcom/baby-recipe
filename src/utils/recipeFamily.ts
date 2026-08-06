import { CookingForm, Recipe } from '../types';

/** 只维护已确认的同菜家族，避免用“肉丝/丸子/排骨”等关键词误合并汤和主食。 */
const RECIPE_FAMILY_BY_NAME: Readonly<Record<string, string>> = {
  清蒸狮子头: 'lion_head',
  红烧狮子头: 'lion_head',
  糖醋排骨: 'pork_ribs',
  红烧排骨: 'pork_ribs',
  蒜香排骨: 'pork_ribs',
  番茄牛腩: 'tomato_beef_brisket',
  番茄牛腩煲: 'tomato_beef_brisket',
};

const COOKING_FORM_BY_NAME: Readonly<Record<string, CookingForm>> = {
  清蒸狮子头: 'meatball',
  红烧狮子头: 'meatball',
  红烧肉丸: 'meatball',
  鸡肉丸子: 'meatball',
  糖醋排骨: 'ribs',
  红烧排骨: 'ribs',
  蒜香排骨: 'ribs',
  鱼香肉丝: 'shredded',
  青椒肉丝: 'shredded',
  香干肉丝: 'shredded',
  番茄牛腩: 'whole_piece',
  番茄牛腩煲: 'whole_piece',
};

export function getRecipeFamily(recipe: Recipe): string {
  return recipe.mealFamily || RECIPE_FAMILY_BY_NAME[recipe.name] || recipe.id;
}

export function getRecipeCookingForm(recipe: Recipe): CookingForm {
  return recipe.cookingForm || COOKING_FORM_BY_NAME[recipe.name] || 'other';
}
