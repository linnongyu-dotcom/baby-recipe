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

// ===== 宝宝成长档案 =====

// 成长阶段
export type GrowthStage = 'infant_feeding' | 'complementary_start' | 'complementary_advance' | 'toddler_diet';

// 成长阶段信息
export const GROWTH_STAGE_INFO: Record<GrowthStage, { label: string; emoji: string; description: string }> = {
  infant_feeding: { label: '婴儿喂养期', emoji: '🍼', description: '奶量知识 · 辅食准备' },
  complementary_start: { label: '辅食添加期', emoji: '🌱', description: '逐步尝试辅食' },
  complementary_advance: { label: '辅食进阶期', emoji: '🍚', description: '辅食逐渐丰富' },
  toddler_diet: { label: '幼儿饮食期', emoji: '🥗', description: '规律三餐饮食' },
};

// 宝宝档案
export interface BabyProfile {
  id: string;
  birthDate: string; // ISO date string YYYY-MM-DD
  nickname?: string;
  // 后续扩展预留
  triedFoods?: string[];
  allergyRecords?: string[];
  foodPreferences?: string[];
  growthRecords?: { date: string; height?: number; weight?: number }[];
}

// 年龄计算结果
export interface BabyAgeInfo {
  totalMonths: number;
  totalDays: number;
  displayText: string; // "9个月12天" 或 "1岁3个月"
  ageGroup: AgeGroup | null; // null 表示 0-5 月龄，暂无对应食谱年龄组
  growthStage: GrowthStage;
  isUnderOneYear: boolean;
}

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

// 蛋白质来源类型
export type ProteinSource = 'pork' | 'beef' | 'chicken' | 'fish' | 'shrimp' | 'egg' | 'tofu' | 'mixed' | 'none';

// 食物形态
export type TextureLevel = 'puree' | 'paste' | 'chunky' | 'family';

// 营养标签类型
export type NutritionTag = '优质蛋白' | '主食补能' | '多彩蔬菜' | 'DHA来源' | '补铁推荐' | '补钙推荐' | '1岁适龄' | '清淡易消化' | '维生素丰富';

// 营养标签图标映射
export const NUTRITION_TAG_ICONS: Record<NutritionTag, string> = {
  '优质蛋白': '🥩',
  '主食补能': '🌾',
  '多彩蔬菜': '🌈',
  'DHA来源': '🧠',
  '补铁推荐': '🦴',
  '补钙推荐': '🥛',
  '1岁适龄': '👶',
  '清淡易消化': '🍃',
  '维生素丰富': '🍊',
};

// 食物形态显示名称
export const TEXTURE_LABELS: Record<TextureLevel, string> = {
  puree: '泥状',
  paste: '糊状',
  chunky: '碎末/小块',
  family: '家庭餐',
};

// 一餐中菜品的角色分类（用于结构校验）
export type MealDishRole = 'staple' | 'protein' | 'vegetable' | 'fruit';

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
  proteinSource?: ProteinSource; // 主要蛋白质来源，用于推荐去重
  textureLevel?: TextureLevel; // 食物形态，用于月龄适配
  /** 在一餐结构中的角色（主食/蛋白质/蔬菜/水果），用于推荐过滤 */
  mealRole?: MealDishRole;
  /** 适合出现在哪些餐次（早/午/晚），不指定则不限 */
  mealSuitable?: ('breakfast' | 'lunch' | 'dinner')[];
}

// 各年龄段允许的食物形态
export const AGE_TEXTURE_RULES: Record<AgeGroup, { allowed: TextureLevel[]; forbidden: TextureLevel[] }> = {
  '6-8m': { allowed: ['puree', 'paste'], forbidden: ['chunky', 'family'] },
  '9-11m': { allowed: ['chunky', 'paste'], forbidden: [] },
  '1-2y': { allowed: ['chunky', 'family'], forbidden: ['puree', 'paste'] },
  '2-3y': { allowed: ['chunky', 'family'], forbidden: ['puree', 'paste'] },
  '3-5y': { allowed: ['family'], forbidden: ['puree', 'paste'] },
};

// 各年龄段推荐的食物质地示例
export const AGE_TEXTURE_EXAMPLES: Record<AgeGroup, { good: string[]; avoid: string[] }> = {
  '6-8m': { good: ['菜泥', '肉泥', '蛋黄泥', '米糊', '果泥'], avoid: ['块状食物', '整颗食物'] },
  '9-11m': { good: ['胡萝卜碎', '胡萝卜软块', '鸡肉末', '软烂面条', '粥'], avoid: ['胡萝卜泥', '长期泥状'] },
  '1-2y': { good: ['软饭', '小块食物', '家庭菜改良版', '鸡蛋羹', '番茄炒蛋'], avoid: ['菜泥', '肉泥', '蛋黄泥', '蛋黄粥', '蛋黄面条'] },
  '2-3y': { good: ['正常家庭菜', '鸡肉丁', '米饭套餐', '饺子'], avoid: ['泥状食物', '单独蛋黄'] },
  '3-5y': { good: ['米饭套餐', '家常菜', '面食', '饺子'], avoid: ['高盐', '高糖', '油炸'] },
};

// 各年龄段单餐结构规则
export interface MealStructureRule {
  staples: number;    // 主食数量
  proteins: number;   // 蛋白质来源数量
  vegetables: { min: number; max: number }; // 蔬菜数量范围
  fruitOptional: boolean; // 水果是否可选
  maxTotalDishes: number; // 最大总菜品数
  minTotalDishes: number; // 最小总菜品数
}

export const AGE_MEAL_STRUCTURE: Record<AgeGroup, MealStructureRule> = {
  '6-8m': { staples: 1, proteins: 1, vegetables: { min: 0, max: 1 }, fruitOptional: true, maxTotalDishes: 1, minTotalDishes: 1 },
  '9-11m': { staples: 1, proteins: 1, vegetables: { min: 0, max: 1 }, fruitOptional: true, maxTotalDishes: 1, minTotalDishes: 1 },
  '1-2y': { staples: 1, proteins: 1, vegetables: { min: 1, max: 2 }, fruitOptional: true, maxTotalDishes: 4, minTotalDishes: 2 },
  '2-3y': { staples: 1, proteins: 1, vegetables: { min: 1, max: 2 }, fruitOptional: true, maxTotalDishes: 5, minTotalDishes: 3 },
  '3-5y': { staples: 1, proteins: 1, vegetables: { min: 1, max: 2 }, fruitOptional: true, maxTotalDishes: 5, minTotalDishes: 3 },
};

// 各年龄段鸡蛋推荐规则
export type EggRule = 'yolk_only' | 'whole_egg' | 'full_egg_dishes';

export const AGE_EGG_RULES: Record<AgeGroup, EggRule> = {
  '6-8m': 'yolk_only',
  '9-11m': 'yolk_only',
  '1-2y': 'whole_egg',
  '2-3y': 'full_egg_dishes',
  '3-5y': 'full_egg_dishes',
};

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

// ===== 宝宝食材添加记录 =====

// 食材添加状态
export type FoodStatus = 'untried' | 'trying' | 'accepted' | 'unsuitable';

// 食材分类
export type FoodIntroCategory = 'grain' | 'vegetable' | 'fruit' | 'protein';

// 食材分类信息
export const FOOD_CATEGORY_INFO: Record<FoodIntroCategory, { label: string; emoji: string }> = {
  grain: { label: '谷物类', emoji: '🌾' },
  vegetable: { label: '蔬菜类', emoji: '🥕' },
  fruit: { label: '水果类', emoji: '🍎' },
  protein: { label: '肉蛋类', emoji: '🥩' },
};

// 观察结果（尝试中阶段的记录）
export type FoodObservation = 'good' | 'disliked' | 'abnormal';

// 单条食材记录
export interface FoodRecord {
  name: string;
  category: FoodIntroCategory;
  status: FoodStatus;
  tryDate?: string;       // 开始尝试日期 ISO string
  acceptedDate?: string;  // 已接受日期 ISO string
  note?: string;          // 备注
  observation?: FoodObservation; // 尝试中的观察结果
}

// 推荐食材
export interface FoodRecommendation {
  name: string;
  category: FoodIntroCategory;
  reason: string;        // 推荐原因
  suggestedMonth: number; // 建议添加月龄 6/7/8
  addMethod: string;     // 添加方式建议
}