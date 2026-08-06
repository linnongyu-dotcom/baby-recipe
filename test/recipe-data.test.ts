import { recipes } from '../src/data/recipes';
import { LUNCH_AUDIT_AGES, auditLunchProteinPool, isAuditableLunchProtein, validateLunchProteinRecipe } from '../src/utils/recipeDataAudit';

const targets = {
  '1-2y': { red_meat: 6, poultry: 4, fish: 4, shrimp: 2, total: 16 },
  '2-3y': { red_meat: 8, poultry: 5, fish: 5, shrimp: 3, total: 21 },
  '3-5y': { red_meat: 10, poultry: 6, fish: 6, shrimp: 3, total: 25 },
} as const;
const addedIds = Array.from({ length: 9 }, (_, index) => `r${336 + index}`);

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const ids = recipes.map(recipe => recipe.id);
assert(new Set(ids).size === ids.length, '食谱 ID 必须唯一');
const added = recipes.filter(recipe => addedIds.includes(recipe.id));
assert(added.length === addedIds.length, '新增食谱不完整');
const existingNames = new Set(recipes.filter(recipe => !addedIds.includes(recipe.id)).map(recipe => recipe.name.replace(/\s+/g, '')));
for (const recipe of added) {
  assert(!existingNames.has(recipe.name.replace(/\s+/g, '')), `${recipe.name}: 与既有食谱重名`);
  assert(validateLunchProteinRecipe(recipe).length === 0, `${recipe.name}: ${validateLunchProteinRecipe(recipe).join(', ')}`);
  assert(recipe.ageGroups.every(age => isAuditableLunchProtein(recipe, age)), `${recipe.name}: 未进入声明年龄的真实候选池`);
}

for (const age of LUNCH_AUDIT_AGES) {
  const audit = auditLunchProteinPool(recipes, age);
  const target = targets[age as keyof typeof targets];
  console.log(JSON.stringify(audit));
  assert(audit.total >= target.total, `${age}: 独立肉菜 ${audit.total} < ${target.total}`);
  for (const protein of ['red_meat', 'poultry', 'fish', 'shrimp'] as const) {
    assert(audit.proteins[protein] >= target[protein], `${age}: ${protein} ${audit.proteins[protein]} < ${target[protein]}`);
  }
}

const toddler = auditLunchProteinPool(recipes, '1-2y');
assert(toddler.familiesByProtein.red_meat >= 4, '1-2y 红肉 family 少于 4');
assert(toddler.familiesByProtein.poultry >= 3, '1-2y 禽肉 family 少于 3');
assert(toddler.familiesByProtein.fish >= 3, '1-2y 鱼类 family 少于 3');
assert(toddler.cookingFormCount >= 6, '1-2y cooking form 少于 6');
console.log('recipe data audit passed');
