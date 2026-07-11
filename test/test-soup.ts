import { generateWeeklyPlan } from '../src/utils/recipeGenerator';
import { UserSettings } from '../src/types';

const AGES = ['1-2y', '2-3y', '3-4y'] as const;

console.log('午餐缺汤诊断');
console.log('='.repeat(50));

for (const age of AGES) {
  let totalLunch = 0;
  let lunchWithoutSoup = 0;

  for (let run = 0; run < 10; run++) {
    const plan = generateWeeklyPlan({
      babyAge: age,
      allergies: [],
      dislikes: [],
      likes: [],
    });

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    for (const day of days) {
      totalLunch++;
      const hasSoup = plan[day].lunch.dishes.some(d => d.dishType === 'soup');
      if (!hasSoup) {
        lunchWithoutSoup++;
        console.log(`  ${age} 第${run + 1}轮 ${day} 午餐无汤: [${plan[day].lunch.dishes.map(d => `${d.name}(${d.dishType})`).join(', ')}]`);
      }
    }
  }

  const pct = ((lunchWithoutSoup / totalLunch) * 100).toFixed(1);
  console.log(`\n${age}: ${lunchWithoutSoup}/${totalLunch} 次午餐无汤 (${pct}%)`);
}

console.log('\n' + '='.repeat(50));
