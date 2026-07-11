import { generateWeeklyPlan } from '../src/utils/recipeGenerator';
import { UserSettings } from '../src/types';

const DISLIKE_TESTS: { name: string; dislike: string }[] = [
  { name: '番茄', dislike: '番茄' },
  { name: '鸡蛋', dislike: '鸡蛋' },
  { name: '猪肉', dislike: '猪肉' },
  { name: '虾', dislike: '虾' },
  { name: '胡萝卜', dislike: '胡萝卜' },
  { name: '黄瓜', dislike: '黄瓜' },
];

console.log('='.repeat(60));
console.log('不喜欢食材排除 - 专项测试');
console.log('='.repeat(60));

let totalErrors = 0;

for (const test of DISLIKE_TESTS) {
  const errors: string[] = [];

  for (let run = 0; run < 20; run++) {
    const settings: UserSettings = {
      babyAge: '3-4y',
      allergies: [],
      dislikes: [test.dislike],
      likes: [],
    };

    const plan = generateWeeklyPlan(settings);
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    for (let di = 0; di < days.length; di++) {
      const day = days[di];
      const dayName = dayNames[di];
      const meals: { label: string; dishes: typeof plan.monday.breakfast.dishes }[] = [
        { label: '早餐', dishes: plan[day].breakfast.dishes },
        { label: '午餐', dishes: plan[day].lunch.dishes },
        { label: '晚餐', dishes: plan[day].dinner.dishes },
      ];

      for (const meal of meals) {
        for (const dish of meal.dishes) {
          const allText = [
            dish.name,
            ...dish.mainIngredients,
            ...dish.ingredients.map(i => i.name),
          ].join(' ');

          if (allText.includes(test.dislike)) {
            errors.push(`  第${run + 1}轮 ${dayName}${meal.label}：${dish.name}`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    totalErrors += errors.length;
    console.log(`\n✗ "${test.dislike}" 出现在食谱中 (${errors.length}处)：`);
    for (const err of errors) {
      console.log(err);
    }
  } else {
    console.log(`✓ "${test.dislike}" 完全排除 (20轮x21餐=420餐，0次出现)`);
  }
}

console.log('\n' + '='.repeat(60));
if (totalErrors === 0) {
  console.log('全部通过 ✓ - 不喜欢食材完全被排除');
} else {
  console.log(`FAIL - 共 ${totalErrors} 次泄露`);
  process.exit(1);
}
console.log('='.repeat(60));
