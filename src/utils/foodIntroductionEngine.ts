import { FoodRecord, FoodRecommendation, FoodIntroCategory } from '../types';
import { FOOD_INTRODUCTION_LIST, findFoodDef, getFoodsUpToMonth, FoodItemDef } from '../data/foodIntroduction';

// 根据宝宝月龄(6/7/8)和已尝试食材，推荐下一步该尝试的食材
// 规则：
// 1. 只推荐当前月龄及之前未尝试过的食材
// 2. 按推荐月龄和优先级排序
// 3. 跳过已标记为"不适合"的食材
// 4. 跳过正在尝试中的食材
// 5. 每次只推荐一种新的
export function recommendNextFood(
  babyMonth: number, // 6/7/8
  records: FoodRecord[],
): FoodRecommendation | null {
  if (babyMonth < 6 || babyMonth > 8) return null;

  const triedNames = new Set(records.map(r => r.name));
  const tryingNames = new Set(records.filter(r => r.status === 'trying').map(r => r.name));
  const unsuitableNames = new Set(records.filter(r => r.status === 'unsuitable').map(r => r.name));
  const acceptedNames = new Set(records.filter(r => r.status === 'accepted').map(r => r.name));

  // 获取当前月龄及之前应尝试的所有食材
  const candidates = getFoodsUpToMonth(babyMonth);

  for (const food of candidates) {
    // 跳过已尝试（接受/不适合/正在尝试）的
    if (triedNames.has(food.name)) continue;
    if (unsuitableNames.has(food.name)) continue;
    if (tryingNames.has(food.name)) continue;
    // 跳过已接受的（不重复推荐）
    if (acceptedNames.has(food.name)) continue;

    return {
      name: food.name,
      category: food.category,
      reason: food.reason,
      suggestedMonth: food.recommendedMonth,
      addMethod: food.addMethod,
    };
  }

  // 如果当前月龄及之前的都已尝试，检查是否有下一个月龄的食材且宝宝月份已到
  if (babyMonth >= 6) {
    const nextMonthFoods = FOOD_INTRODUCTION_LIST
      .filter(f => f.recommendedMonth === babyMonth + 1 && !triedNames.has(f.name))
      .sort((a, b) => a.priority - b.priority);

    for (const food of nextMonthFoods) {
      if (unsuitableNames.has(food.name)) continue;
      if (tryingNames.has(food.name)) continue;
      return {
        name: food.name,
        category: food.category,
        reason: food.reason,
        suggestedMonth: food.recommendedMonth,
        addMethod: food.addMethod,
      };
    }
  }

  return null;
}

// 获取添加进度摘要
export function getProgressSummary(records: FoodRecord[], babyMonth: number): {
  acceptedCount: number;
  tryingCount: number;
  totalExpected: number;
  stageLabel: string;
  stageDescription: string;
  currentStageFoods: FoodItemDef[];
  completedCurrentStage: boolean;
} {
  const acceptedCount = records.filter(r => r.status === 'accepted').length;
  const tryingCount = records.filter(r => r.status === 'trying').length;
  const totalExpected = getFoodsUpToMonth(babyMonth).length;

  // 判断当前阶段
  const acceptedGrains = records.filter(r => r.status === 'accepted' && r.category === 'grain').length;
  const acceptedProtein = records.filter(r => r.status === 'accepted' && r.category === 'protein').length;

  let stageLabel: string;
  let stageDescription: string;

  if (babyMonth <= 6 && acceptedGrains < 1) {
    stageLabel = '辅食启动期';
    stageDescription = '从强化铁米粉开始，逐步建立进食习惯';
  } else if (babyMonth <= 6 && acceptedCount < 4) {
    stageLabel = '单一食材期';
    stageDescription = '每次添加一种新食材，观察宝宝适应情况';
  } else if (babyMonth <= 7 && acceptedProtein < 1) {
    stageLabel = '食材扩展期';
    stageDescription = '逐步丰富蔬菜种类，准备添加蛋白质';
  } else if (babyMonth <= 7 && acceptedProtein < 3) {
    stageLabel = '蛋白质添加期';
    stageDescription = '引入肉类和鱼类，关注铁和蛋白质摄入';
  } else if (babyMonth >= 8) {
    stageLabel = '多样化尝试期';
    stageDescription = '增加食材种类，可尝试组合搭配';
  } else {
    stageLabel = '食材扩展期';
    stageDescription = '按节奏逐步丰富食物种类';
  }

  const currentStageFoods = getFoodsUpToMonth(babyMonth);
  const completedCurrentStage = currentStageFoods.every(
    f => records.some(r => r.name === f.name && (r.status === 'accepted' || r.status === 'unsuitable'))
  );

  return {
    acceptedCount,
    tryingCount,
    totalExpected,
    stageLabel,
    stageDescription,
    currentStageFoods,
    completedCurrentStage,
  };
}

// 按分类整理食材记录
export function groupRecordsByCategory(records: FoodRecord[]): Record<FoodIntroCategory, FoodRecord[]> {
  const grouped: Record<FoodIntroCategory, FoodRecord[]> = {
    grain: [],
    vegetable: [],
    fruit: [],
    protein: [],
  };

  // 先加入已有记录的食材
  for (const record of records) {
    if (grouped[record.category]) {
      grouped[record.category].push(record);
    }
  }

  // 补充数据库中存在但尚未记录的食材（状态为 untried）
  // 按当前宝宝月龄筛选，只显示该月龄及之前应尝试的食材
  // 这里由调用方传入 babyMonth 来决定要显示的范围
  // 默认显示全部 6-8个月的食材
  return grouped;
}

// 获取指定分类下所有食材（含未尝试的），按推荐顺序排列
export function getCategoryFoodsWithStatus(
  category: FoodIntroCategory,
  records: FoodRecord[],
  babyMonth: number,
): { food: FoodItemDef; status: FoodRecord['status']; record?: FoodRecord }[] {
  const recordMap = new Map(records.map(r => [r.name, r]));

  const foodsInCategory = getFoodsUpToMonth(babyMonth)
    .filter(f => f.category === category);

  return foodsInCategory.map(food => ({
    food,
    status: recordMap.get(food.name)?.status || 'untried',
    record: recordMap.get(food.name),
  }));
}
