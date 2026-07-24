/**
 * 饭小宝食谱标签体系 - 全面测试
 * 覆盖：全量食谱回归 + 边界条件 + 标签规则合规性
 */
import { deriveNutritionTags } from '../src/utils/mealValidator';
import { lookupFoodCategory, FoodCategory, FOOD_CATEGORY_META } from '../src/utils/foodDictionary';
import { recipes } from '../src/data/recipes';
import type { Recipe, NutritionTag } from '../src/types';

// ============================================================
// 工具函数
// ============================================================

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`  ❌ ${message}`);
  }
}

function makeRecipe(
  id: string,
  name: string,
  mainIngredients: string[],
  dishType: string = 'meat'
): Recipe {
  return {
    id, name,
    ingredients: mainIngredients.map(n => ({ name: n, amount: '适量' })),
    steps: [],
    ageGroups: ['1-2y'],
    tags: [],
    category: '',
    dishType: dishType as Recipe['dishType'],
    nutrition: '',
    mainIngredients,
  };
}

// ============================================================
// 测试套件 1：规则合规性（需求文档逐条验证）
// ============================================================
console.log('\n📋 测试套件1：标签规则合规性');
console.log('='.repeat(60));

// 1.1 所有食谱必须有至少1个标签
{
  console.log('\n1.1 标签数量检查（全量食谱）...');
  let emptyCount = 0;
  let over3Count = 0;
  const countDistribution: Record<number, number> = {};

  for (const recipe of recipes) {
    const tags = deriveNutritionTags(recipe);
    const tagCount = tags.length;
    countDistribution[tagCount] = (countDistribution[tagCount] || 0) + 1;

    if (tagCount === 0) emptyCount++;
    if (tagCount > 3) over3Count++;
  }

  console.log(`  食谱总数: ${recipes.length}`);
  console.log(`  标签分布: 1个=${countDistribution[1] || 0}, 2个=${countDistribution[2] || 0}, 3个=${countDistribution[3] || 0}`);

  assert(emptyCount === 0, `空标签食谱数: ${emptyCount} (应为0)`);
  assert(over3Count === 0, `超过3个标签的食谱数: ${over3Count} (应为0)`);
}

// 1.2 标签类型验证：不应出现旧的功能性标签
{
  console.log('\n1.2 无旧标签验证...');
  const forbiddenTags = ['补铁推荐', '补钙推荐', 'DHA来源', '健脑', '增强免疫', '补脑',
    '主食补能', '多彩蔬菜', '清淡易消化', '维生素丰富', '1岁适龄'];

  let forbiddenFound = 0;
  for (const recipe of recipes) {
    const tags = deriveNutritionTags(recipe);
    const found = tags.filter(t => forbiddenTags.includes(t as string));
    if (found.length > 0) {
      forbiddenFound++;
      console.log(`  ⚠️ ${recipe.name}: 包含旧标签 [${found.join(', ')}]`);
    }
  }
  assert(forbiddenFound === 0, `包含旧标签的食谱数: ${forbiddenFound} (应为0)`);
}

// 1.3 烹饪特点标签不能作为唯一标签
{
  console.log('\n1.3 烹饪标签不作为唯一标签...');
  const cookingTags = ['蒸制', '炖煮', '少油烹饪', '易咀嚼'];
  let cookingOnlyCount = 0;

  for (const recipe of recipes) {
    const tags = deriveNutritionTags(recipe);
    if (tags.length === 1 && cookingTags.includes(tags[0])) {
      cookingOnlyCount++;
      console.log(`  ⚠️ ${recipe.name}: 仅有烹饪标签 "${tags[0]}"`);
    }
  }
  assert(cookingOnlyCount === 0, `仅有烹饪标签的食谱数: ${cookingOnlyCount} (应为0)`);
}

// 1.4 所有蔬菜类食谱必须有蔬菜标签
{
  console.log('\n1.4 蔬菜标签全覆盖...');
  let vegNoLabel = 0;
  let lightVegNoLabel = 0;

  for (const recipe of recipes) {
    const cats = recipe.mainIngredients.map(i => lookupFoodCategory(i));
    const hasDarkVeg = cats.includes('darkVeg');
    const hasLightVeg = cats.includes('lightVeg');
    const tags = deriveNutritionTags(recipe);
    const hasVegTag = tags.includes('深色蔬菜') || tags.includes('蔬菜来源');

    if ((hasDarkVeg || hasLightVeg) && !hasVegTag) {
      vegNoLabel++;
      console.log(`  ⚠️ ${recipe.name}: 含蔬菜但无蔬菜标签 (食材: ${recipe.mainIngredients.join(', ')})`);
    }
    if (hasLightVeg && !hasDarkVeg && !tags.includes('蔬菜来源')) {
      lightVegNoLabel++;
      console.log(`  ⚠️ ${recipe.name}: 纯浅色蔬菜但无"蔬菜来源"标签`);
    }
  }
  assert(vegNoLabel === 0, `含蔬菜但无标签的食谱数: ${vegNoLabel} (应为0)`);
  assert(lightVegNoLabel === 0, `浅色蔬菜无"蔬菜来源"标签数: ${lightVegNoLabel} (应为0)`);
}

// 1.5 主食类食谱必须有主食标签
{
  console.log('\n1.5 主食标签覆盖...');
  let stapleNoLabel = 0;
  for (const recipe of recipes) {
    const tags = deriveNutritionTags(recipe);
    if (recipe.dishType === 'staple' && !tags.includes('主食来源')) {
      stapleNoLabel++;
      console.log(`  ⚠️ ${recipe.name}: 主食类但无"主食来源"标签`);
    }
  }
  assert(stapleNoLabel === 0, `主食类无标签的食谱数: ${stapleNoLabel} (应为0)`);
}

// 1.6 蛋白质类食谱必须有优质蛋白标签
{
  console.log('\n1.6 蛋白质标签覆盖...');
  let proteinNoLabel = 0;
  for (const recipe of recipes) {
    const cats = recipe.mainIngredients.map(i => lookupFoodCategory(i));
    const hasProtein = cats.some(c => ['egg', 'fishSeafood', 'redMeat', 'poultry', 'soyProduct'].includes(c));
    const tags = deriveNutritionTags(recipe);
    if (hasProtein && !tags.includes('优质蛋白')) {
      proteinNoLabel++;
      console.log(`  ⚠️ ${recipe.name}: 含蛋白质但无"优质蛋白"标签`);
    }
  }
  assert(proteinNoLabel === 0, `含蛋白质但无标签的食谱数: ${proteinNoLabel} (应为0)`);
}

// 1.7 红肉类：含铁食材应在标签数未满时出现（复合菜品可能因优先级被裁剪）
{
  console.log('\n1.7 含铁食材标签...');
  let redMeatNoIron = 0;
  let redMeatTrimmed = 0;
  for (const recipe of recipes) {
    const cats = recipe.mainIngredients.map(i => lookupFoodCategory(i));
    const tags = deriveNutritionTags(recipe);
    if (cats.includes('redMeat') && !tags.includes('含铁食材')) {
      // 检查是否因为核心标签已满而被裁剪
      const hasStaple = recipe.dishType === 'staple' || cats.includes('staple');
      const hasAnyVeg = cats.some(c => c === 'darkVeg' || c === 'lightVeg');
      if (hasStaple && hasAnyVeg && tags.length === 3) {
        // 复合菜品：主食+蛋白质+蔬菜，3个核心标签已满，含铁食材被正确裁剪
        redMeatTrimmed++;
      } else {
        redMeatNoIron++;
        console.log(`  ⚠️ ${recipe.name}: 含红肉但无"含铁食材"标签 (非裁剪场景)`);
      }
    }
  }
  console.log(`  纯红肉菜品均含含铁标签: ${redMeatNoIron === 0 ? '✓' : '✗'} (缺失${redMeatNoIron}个)`);
  console.log(`  复合菜品因优先级裁剪: ${redMeatTrimmed}个 (预期行为)`);
  assert(redMeatNoIron === 0, `非裁剪场景缺失含铁标签: ${redMeatNoIron} (应为0)`);
}

// 1.8 水果类必须有水果标签
{
  console.log('\n1.8 水果标签覆盖...');
  let fruitNoLabel = 0;
  for (const recipe of recipes) {
    const cats = recipe.mainIngredients.map(i => lookupFoodCategory(i));
    const tags = deriveNutritionTags(recipe);
    if (cats.includes('fruit') && !tags.includes('水果来源')) {
      fruitNoLabel++;
      console.log(`  ⚠️ ${recipe.name}: 含水果但无"水果来源"标签`);
    }
  }
  assert(fruitNoLabel === 0, `水果无标签的食谱数: ${fruitNoLabel} (应为0)`);
}

// ============================================================
// 测试套件 2：边界条件测试
// ============================================================
console.log('\n\n📋 测试套件2：边界条件与异常测试');
console.log('='.repeat(60));

// 2.1 空食材列表
{
  console.log('\n2.1 空食材...');
  const recipe = makeRecipe('t-empty', '未知菜品', []);
  const tags = deriveNutritionTags(recipe);
  assert(tags.length >= 1, `空食材应至少有1个标签，实际: ${tags.length}`);
  assert(tags.length <= 3, `空食材标签不应超过3个，实际: ${tags.length}`);
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.2 未知食材（不在字典中）
{
  console.log('\n2.2 未知食材...');
  const recipe = makeRecipe('t-unknown', '神秘菜品', ['未知食物X', '未知食物Y']);
  const tags = deriveNutritionTags(recipe);
  assert(tags.length >= 1, `未知食材应至少有1个兜底标签，实际: ${tags.length}`);
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.3 纯蒸制菜品（无食材分类匹配）
{
  console.log('\n2.3 纯蒸制（兜底场景）...');
  const recipe = makeRecipe('t-steam', '蒸制神秘物', ['未知食材']);
  const tags = deriveNutritionTags(recipe);
  const cookingTags = ['蒸制', '炖煮', '少油烹饪', '易咀嚼'];
  const isCookingOnly = tags.length === 1 && cookingTags.includes(tags[0]);
  assert(!isCookingOnly, `纯蒸制+未知食材不应只有烹饪标签，实际: [${tags.join(', ')}]`);
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.4 同时含深色+浅色蔬菜
{
  console.log('\n2.4 深浅蔬菜混合...');
  const recipe = makeRecipe('t-mixed-veg', '蔬菜拼盘', ['西兰花', '白菜'], 'vegetable');
  const tags = deriveNutritionTags(recipe);
  assert(tags.includes('深色蔬菜'), `含深色蔬菜应优先显示"深色蔬菜"，实际: [${tags.join(', ')}]`);
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.5 主食+蛋白质+蔬菜的复合菜品
{
  console.log('\n2.5 复合菜品（max 3 tags，蔬菜优先于含铁食材）...');
  const recipe = makeRecipe('t-combo', '牛肉番茄面', ['面条', '牛肉', '番茄'], 'staple');
  const tags = deriveNutritionTags(recipe);
  assert(tags.length <= 3, `复合菜品不应超过3个标签，实际: ${tags.length}`);
  assert(tags.includes('主食来源'), '复合菜品应包含主食标签');
  assert(tags.includes('优质蛋白'), '复合菜品应包含蛋白质标签');
  assert(tags.includes('深色蔬菜'), '复合菜品应包含蔬菜标签（优先级高于含铁食材）');
  // 含铁食材为次级标签，4个候选标签中被正确裁剪
  console.log(`  结果: [${tags.join(', ')}] (含铁食材因核心标签满额被裁剪 ✓)`);
}

// 2.6 纯豆腐菜品
{
  console.log('\n2.6 纯豆制品...');
  const recipe = makeRecipe('t-tofu', '家常豆腐', ['豆腐'], 'meat');
  const tags = deriveNutritionTags(recipe);
  assert(tags.includes('优质蛋白'), '豆制品应有"优质蛋白"标签');
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.7 纯水果（dessert类）
{
  console.log('\n2.7 纯水果...');
  const recipe = makeRecipe('t-fruit', '苹果', ['苹果'], 'dessert');
  const tags = deriveNutritionTags(recipe);
  assert(tags.includes('水果来源'), '水果应有"水果来源"标签');
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.8 奶制品标签
{
  console.log('\n2.8 奶制品...');
  const recipe = makeRecipe('t-milk', '牛奶麦片', ['牛奶', '燕麦'], 'staple');
  const tags = deriveNutritionTags(recipe);
  // 牛奶在字典中归为 dairy，燕麦归为 staple
  const dairyCat = recipe.mainIngredients.map(i => lookupFoodCategory(i));
  console.log(`  食材分类: ${dairyCat.join(', ')}`);
  if (dairyCat.includes('dairy')) {
    assert(tags.includes('奶类来源'), '含奶制品应有"奶类来源"标签');
  }
  console.log(`  结果: [${tags.join(', ')}]`);
}

// 2.9 谷豆搭配（主食+豆制品）
{
  console.log('\n2.9 谷豆搭配...');
  const recipe = makeRecipe('t-graindou', '豆腐盖饭', ['大米', '豆腐'], 'staple');
  const tags = deriveNutritionTags(recipe);
  console.log(`  结果: [${tags.join(', ')}]`);
  // 大米=staple, 豆腐=soyProduct → 应触发谷豆搭配
  const hasStaple = recipe.mainIngredients.map(i => lookupFoodCategory(i)).includes('staple');
  const hasTofu = recipe.mainIngredients.map(i => lookupFoodCategory(i)).includes('soyProduct');
  if (hasStaple && hasTofu && tags.length < 3) {
    assert(tags.includes('谷豆搭配'), '主食+豆腐应触发"谷豆搭配"标签');
  }
}

// ============================================================
// 测试套件 3：需求文档示例验证
// ============================================================
console.log('\n\n📋 测试套件3：需求文档示例精确验证');
console.log('='.repeat(60));

const specTestCases: { name: string; ings: string[]; dt: string; expected: string[] }[] = [
  { name: '肉末蒸蛋', ings: ['猪肉', '鸡蛋'], dt: 'meat', expected: ['优质蛋白', '含铁食材', '蒸制'] },
  { name: '清炒小白菜', ings: ['小白菜'], dt: 'vegetable', expected: ['蔬菜来源'] },
  { name: '清炒黄瓜片', ings: ['黄瓜'], dt: 'vegetable', expected: ['蔬菜来源'] },
  { name: '红豆饭', ings: ['大米', '红豆'], dt: 'staple', expected: ['主食来源'] },
];

for (const tc of specTestCases) {
  const recipe = makeRecipe(tc.name, tc.name, tc.ings, tc.dt);
  const tags = deriveNutritionTags(recipe);
  const missingExpected = tc.expected.filter(e => !tags.includes(e as NutritionTag));
  const status = missingExpected.length === 0 ? '✓' : '✗';
  console.log(`  ${status} ${tc.name}: [${tags.join(', ')}] ${missingExpected.length > 0 ? '(缺失: ' + missingExpected.join(', ') + ')' : ''}`);
  assert(missingExpected.length === 0, `${tc.name} 缺少预期标签: [${missingExpected.join(', ')}]`);
}

// ============================================================
// 测试套件 4：分类统计
// ============================================================
console.log('\n\n📋 测试套件4：全量食谱标签分类统计');
console.log('='.repeat(60));

const tagStats: Record<string, number> = {};
const allValidTags: NutritionTag[] = [
  '主食来源', '优质蛋白', '含铁食材', '蔬菜来源', '深色蔬菜',
  '水果来源', '奶类来源', '谷豆搭配',
  '蒸制', '炖煮', '少油烹饪', '易咀嚼',
];

for (const t of allValidTags) tagStats[t] = 0;

for (const recipe of recipes) {
  const tags = deriveNutritionTags(recipe);
  for (const t of tags) {
    tagStats[t] = (tagStats[t] || 0) + 1;
  }
}

console.log('\n  标签分布:');;
for (const t of allValidTags) {
  if (tagStats[t] > 0) {
    const icon = { '主食来源': '🌾', '优质蛋白': '🥩', '含铁食材': '🔴', '蔬菜来源': '🥬',
      '深色蔬菜': '🥦', '水果来源': '🍎', '奶类来源': '🥛', '谷豆搭配': '🫘',
      '蒸制': '🍃', '炖煮': '🍲', '少油烹饪': '🌿', '易咀嚼': '👶' }[t];
    console.log(`  ${icon} ${t}: ${tagStats[t]}次`);
  }
}

// ============================================================
// 结果汇总
// ============================================================
console.log(`\n\n${'='.repeat(60)}`);
console.log(`测试结果汇总`);
console.log(`${'='.repeat(60)}`);
console.log(`  ✅ 通过: ${passed}`);
console.log(`  ❌ 失败: ${failed}`);
console.log(`  📊 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (errors.length > 0) {
  console.log(`\n失败详情:`);
  for (const err of errors) {
    console.log(err);
  }
}

console.log('\n');

// 退出码
process.exit(failed > 0 ? 1 : 0);
