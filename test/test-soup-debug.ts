import { generateMeal } from '../src/utils/recipeGenerator';
import { UserSettings, Recipe, DishType } from '../src/types';
import { recipes } from '../src/data/recipes';

// 诊断3-4岁午餐为什么缺汤
const settings: UserSettings = {
  babyAge: '3-4y',
  allergies: [],
  dislikes: [],
  likes: [],
};

// 模拟一周初始状态
const allFiltered = recipes.filter(r => r.ageGroups.includes('3-4y'));
const soups = allFiltered.filter(r => r.dishType === 'soup');
console.log('3-4y汤总数:', soups.length);
console.log('汤列表:', soups.map(s => s.name).join(', '));
console.log();

// 生成一周并追踪
const plan = generateWeeklyPlan(settings);
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

for (const day of days) {
  const lunch = plan[day].lunch.dishes;
  const hasSoup = lunch.some(d => d.dishType === 'soup');
  const types = lunch.map(d => `${d.name}(${d.dishType})`);
  console.log(`${day} 午餐 [${types.join(', ')}] ${hasSoup ? '✓有汤' : '✗无汤'}`);
}
