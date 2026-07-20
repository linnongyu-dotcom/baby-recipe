// 年龄段类型
export type AgeGroup = '6-8m' | '9-11m' | '1-2y' | '2-3y' | '3-5y';

// 年龄段显示名称
export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  '6-8m': '6-8个月（辅食初期）',
  '9-11m': '9-11个月（辅食进阶）',
  '1-2y': '1-2岁',
  '2-3y': '2-3岁',
  '3-5y': '3-5岁',
};

// 年龄段副标题（设置页展示）
export const AGE_GROUP_SUBTITLES: Record<AgeGroup, string> = {
  '6-8m': '开始尝试辅食',
  '9-11m': '辅食逐渐丰富',
  '1-2y': '自主进食期',
  '2-3y': '规律饮食期',
  '3-5y': '多样化饮食期',
};

// 喂养阶段类型
export type AgeStage = 'growth_check' | 'coverage_check' | 'balance_check';

// 根据年龄获取喂养阶段
export function getAgeStage(age: AgeGroup): AgeStage {
  if (age === '6-8m') return 'growth_check';
  if (age === '9-11m') return 'coverage_check';
  return 'balance_check';
}

// 营养检查标题
export const NUTRITION_CHECK_TITLES: Record<AgeStage, { title: string; icon: string; hint: string }> = {
  growth_check: { title: '今日辅食成长', icon: '🌱', hint: '6-8个月宝宝仍以奶为主要营养来源，辅食重点是逐步尝试和建立饮食习惯。' },
  coverage_check: { title: '今日营养覆盖检查', icon: '✅', hint: '' },
  balance_check: { title: '今日营养是否均衡', icon: '✅', hint: '' },
};

// 食材类型
export interface Ingredient {
  name: string;
  amount: string;
}

// 菜品类型（荤菜/素菜/主食/汤/蛋）
export type DishType = 'staple' | 'meat' | 'vegetable' | 'soup' | 'egg' | 'dessert';

// 菜品类型显示名称
export const DISH_TYPE_LABELS: Record<DishType, string> = {
  staple: '主食',
  meat: '荤菜',
  vegetable: '素菜',
  soup: '汤品',
  egg: '蛋类',
  dessert: '点心',
};

// 菜品类型图标
export const DISH_TYPE_ICONS: Record<DishType, string> = {
  staple: '🍚',
  meat: '🍖',
  vegetable: '🥬',
  soup: '🍲',
  egg: '🥚',
  dessert: '🍮',
};

// 食谱类型
export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  steps: string[];
  ageGroups: AgeGroup[];
  tags: string[];
  category: string;
  dishType: DishType; // 菜品类型
  nutrition: string;
  mainIngredients: string[]; // 主要食材，用于过敏检测
}

// 每日餐次（包含多道菜）
export interface MealPlan {
  dishes: Recipe[]; // 多道菜组合
}

// 每日食谱
export interface DayPlan {
  breakfast: MealPlan;
  lunch: MealPlan;
  dinner: MealPlan;
}

// 用户设置
export interface UserSettings {
  babyAge: AgeGroup | null;
  allergies: string[];
  dislikes: string[];
  likes: string[];
}

// 一周食谱
export interface WeeklyPlan {
  monday: DayPlan;
  tuesday: DayPlan;
  wednesday: DayPlan;
  thursday: DayPlan;
  friday: DayPlan;
  saturday: DayPlan;
  sunday: DayPlan;
}

// 周几
export type DayOfWeek = keyof WeeklyPlan;

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: '周一',
  tuesday: '周二',
  wednesday: '周三',
  thursday: '周四',
  friday: '周五',
  saturday: '周六',
  sunday: '周日',
};

// 餐次
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};

// 常见过敏食物
export const COMMON_ALLERGIES: string[] = [
  '鸡蛋', '牛奶', '虾', '花生', '鱼', '海鲜', '坚果', '小麦',
];

// 常见食物列表（用于不喜欢/喜欢）
export const COMMON_FOODS: string[] = [
  '胡萝卜', '西兰花', '菠菜', '番茄', '黄瓜', '白菜', '土豆', '南瓜',
  '猪肉', '牛肉', '鸡肉', '排骨',
  '三文鱼', '鳕鱼', '虾',
  '鸡蛋',
  '大米', '面条', '馒头', '饺子',
  '苹果', '香蕉', '梨', '橙子', '西瓜',
  '豆腐',
];