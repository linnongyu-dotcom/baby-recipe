export type FoodCategory =
  | 'staple'
  | 'egg'
  | 'fishSeafood'
  | 'redMeat'
  | 'poultry'
  | 'soyProduct'
  | 'dairy'
  | 'darkVeg'
  | 'lightVeg'
  | 'fruit'
  | 'other';

export interface FoodCategoryMeta {
  category: FoodCategory;
  name: string;
  icon: string;
  isProtein: boolean;
}

export const FOOD_CATEGORY_META: Record<FoodCategory, FoodCategoryMeta> = {
  staple:           { category: 'staple',       name: '谷薯类',   icon: '🍚', isProtein: false },
  egg:              { category: 'egg',           name: '蛋类',     icon: '🥚', isProtein: true },
  fishSeafood:      { category: 'fishSeafood',   name: '鱼虾水产', icon: '🐟', isProtein: true },
  redMeat:          { category: 'redMeat',       name: '畜禽肉',   icon: '🥩', isProtein: true },
  poultry:          { category: 'poultry',        name: '禽肉',     icon: '🍗', isProtein: true },
  soyProduct:       { category: 'soyProduct',    name: '豆制品',   icon: '🫘', isProtein: true },
  dairy:            { category: 'dairy',          name: '奶制品',   icon: '🥛', isProtein: false },
  darkVeg:          { category: 'darkVeg',        name: '深色蔬菜', icon: '🥦', isProtein: false },
  lightVeg:         { category: 'lightVeg',       name: '浅色蔬菜', icon: '🥬', isProtein: false },
  fruit:            { category: 'fruit',           name: '水果',     icon: '🍎', isProtein: false },
  other:            { category: 'other',           name: '其他',     icon: '📦', isProtein: false },
};

const FOOD_MAP: Record<string, FoodCategory> = {};

function def(category: FoodCategory, ...names: string[]) {
  for (const name of names) {
    FOOD_MAP[name] = category;
  }
}

def('staple',
  '大米', '小米', '面条', '馒头', '饺子', '面包', '面粉', '糯米', '糯米粉',
  '燕麦', '糙米', '藜麦', '红薯', '土豆', '紫薯', '玉米', '紫米', '山药',
  '红豆', '绿豆', '粉丝',
);

def('egg', '鸡蛋', '蛋');

def('fishSeafood',
  '三文鱼', '鳕鱼', '鲈鱼', '龙利鱼', '带鱼', '草鱼', '鲤鱼', '银鱼',
  '鱼肉', '鱼', '虾', '虾仁', '蟹',
);

def('redMeat',
  '猪肉', '牛肉', '排骨', '猪肝', '猪蹄', '羊肉', '火腿', '牛腩', '肉末', '肉',
);

def('poultry', '鸡肉');

def('soyProduct',
  '豆腐', '豆腐干', '腐竹', '豆浆', '黄豆', '毛豆',
);

def('dairy', '牛奶', '酸奶', '芝士', '奶酪');

def('darkVeg',
  '菠菜', '西兰花', '胡萝卜', '番茄', '南瓜', '紫菜', '茄子',
  '木耳', '香菇', '海带', '海苔', '青椒', '西红柿', '菜花',
);

def('lightVeg',
  '白菜', '黄瓜', '白萝卜', '冬瓜', '豆角', '西葫芦',
  '莲藕', '丝瓜', '小白菜', '韭菜', '芹菜', '芦笋', '荷兰豆',
  '油菜', '油麦菜', '娃娃菜', '生菜', '空心菜', '青菜',
  '豌豆', '秋葵', '苦瓜', '四季豆', '豆芽', '萝卜', '蘑菇',
  '菜心', '菜', '洋葱', '彩椒', '芋头', '茭白',
);

def('fruit',
  '苹果', '香蕉', '梨', '橙子', '草莓', '芒果', '木瓜', '牛油果', '蓝莓', '橘子', '西瓜',
);

def('other',
  '黑芝麻', '核桃', '花生', '莲子', '红枣', '冰糖', '白糖', '葱', '大葱', '酱油',
  '蜂蜜', '坚果', '小麦', '藕粉', '银耳',
);

export function lookupFoodCategory(ingredient: string): FoodCategory {
  return FOOD_MAP[ingredient] || 'other';
}

export function isProteinCategory(cat: FoodCategory): boolean {
  return FOOD_CATEGORY_META[cat]?.isProtein ?? false;
}

export function isMeatOrEggLike(cat: FoodCategory): boolean {
  return cat === 'egg' || cat === 'fishSeafood' || cat === 'redMeat' || cat === 'poultry' || cat === 'soyProduct';
}

export function isVegetableCategory(cat: FoodCategory): boolean {
  return cat === 'darkVeg' || cat === 'lightVeg';
}

export function getDishCategories(dish: { mainIngredients: string[]; category?: string }): FoodCategory[] {
  const cats = new Set<FoodCategory>();
  for (const ing of dish.mainIngredients) {
    cats.add(lookupFoodCategory(ing));
  }
  return [...cats];
}

export function dishHasCategory(dish: { mainIngredients: string[]; category?: string }, cat: FoodCategory): boolean {
  return dish.mainIngredients.some(ing => lookupFoodCategory(ing) === cat);
}
