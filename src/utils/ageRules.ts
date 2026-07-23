import { AgeGroup, AgeStage, TextureLevel, MealStructureRule } from '../types';
import { FoodCategory } from './foodDictionary';

// ============================================================
// 各年龄段阶段定位
// ============================================================

export interface AgeStageMeta {
  stageLabel: string;
  stageDescription: string; // 阶段定位
  goalDescription: string;  // 推荐目标
  textureDescription: string; // 食物质地特征
  eggDescription: string;   // 鸡蛋推荐说明
}

export const AGE_STAGE_META: Record<AgeGroup, AgeStageMeta> = {
  '6-8m': {
    stageLabel: '辅食添加期',
    stageDescription: '宝宝刚接触辅食，奶仍是主要营养来源',
    goalDescription: '尝试新食材、建立吞咽能力、观察食物接受情况',
    textureDescription: '泥状、糊状、细腻碎末。推荐菜泥、肉泥、蛋黄泥',
    eggDescription: '从1/4蛋黄开始，观察3-5天无过敏再加量',
  },
  '9-11m': {
    stageLabel: '辅食进阶期',
    stageDescription: '辅食逐渐丰富，从泥糊向碎末过渡',
    goalDescription: '增加食物种类、练习咀嚼、丰富食物质地',
    textureDescription: '碎末、小颗粒、软烂块。推荐胡萝卜碎、肉末粥、软烂面条',
    eggDescription: '蛋黄碎、蒸蛋羹，每日不超过1个蛋黄',
  },
  '1-2y': {
    stageLabel: '家庭饮食过渡期',
    stageDescription: '从辅食正式过渡到宝宝三餐',
    goalDescription: '建立规律三餐习惯，适应家庭饮食',
    textureDescription: '软饭、小块食物、家庭菜改良版。禁止推荐菜泥、肉泥、蛋黄泥',
    eggDescription: '全蛋料理：鸡蛋羹、番茄炒蛋、鸡蛋面等。不再推荐单独蛋黄类',
  },
  '2-3y': {
    stageLabel: '自主进食培养期',
    stageDescription: '培养独立吃饭能力，饮食接近家庭化',
    goalDescription: '培养独立吃饭、增加食物多样性、养成自主选择习惯',
    textureDescription: '正常家庭菜、小块食物。如鸡肉丁代替鸡肉碎',
    eggDescription: '各种全蛋料理：番茄炒蛋、蛋花汤、虾仁蒸蛋等',
  },
  '3-5y': {
    stageLabel: '儿童家庭餐阶段',
    stageDescription: '已完全融入家庭饮食',
    goalDescription: '建立长期健康饮食习惯，控制盐糖和油炸食品',
    textureDescription: '接近成人家庭餐。米饭套餐、家常菜、面食、饺子等',
    eggDescription: '丰富蛋类做法：煎蛋、炒蛋、蒸蛋、蛋汤等，每日1个全蛋',
  },
};

// ============================================================
// 年龄阶段的营养检查项
// ============================================================

export interface DailyCheckItem {
  key: string;
  name: string;
  icon: string;
  category: FoodCategory;
  required: boolean;
  suggestion: string;
}

export interface WeeklyCheckItem {
  key: string;
  name: string;
  icon: string;
  category: FoodCategory;
  dailyTarget: number;
  suggestion: string;
}

export interface AgeRule {
  dailyChecks: DailyCheckItem[];
  weeklyChecks: WeeklyCheckItem[];
}

export const AGE_RULES: Record<AgeGroup, AgeRule> = {
  // ========================================================
  // 6-8 个月（辅食初期）：辅食成长检查
  // ========================================================
  '6-8m': {
    dailyChecks: [
      { key: 'iron',      name: '铁来源',   icon: '🩸', category: 'redMeat', required: false, suggestion: '强化铁米粉或肉泥是铁的良好来源' },
      { key: 'vegetable', name: '蔬菜尝试', icon: '🥬', category: 'darkVeg', required: false, suggestion: '今天给宝宝尝试蔬菜泥了吗？' },
      { key: 'fruit',     name: '水果尝试', icon: '🍎', category: 'fruit',   required: false, suggestion: '果泥是很好的维生素来源' },
      { key: 'newFood',   name: '新食物体验', icon: '🌟', category: 'other', required: false, suggestion: '每次只添加一种新食物，观察3-5天' },
    ],
    weeklyChecks: [
      { key: 'iron',      name: '铁来源',   icon: '🩸', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周多次安排含铁辅食' },
      { key: 'vegetable', name: '蔬菜尝试', icon: '🥬', category: 'darkVeg',      dailyTarget: 5, suggestion: '每周尝试多种蔬菜泥' },
      { key: 'fruit',     name: '水果尝试', icon: '🍎', category: 'fruit',        dailyTarget: 5, suggestion: '每周安排水果泥' },
    ],
  },

  // ========================================================
  // 9-11 个月（辅食进阶）：营养覆盖检查
  // ========================================================
  '9-11m': {
    dailyChecks: [
      { key: 'staple',    name: '主食',     icon: '🍚', category: 'staple',    required: true, suggestion: '米粉、粥或软饭' },
      { key: 'protein',   name: '蛋白质',   icon: '🥩', category: 'egg',       required: true, suggestion: '蛋黄、肉末或鱼碎' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true, suggestion: '深色蔬菜营养更丰富' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true, suggestion: '补充维生素' },
      { key: 'dairy',     name: '奶类',     icon: '🥛', category: 'dairy',     required: false, suggestion: '母乳或配方奶仍是重要营养来源' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类，补充DHA' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '已适应鸡蛋后，可逐渐增加不同做法' },
      { key: 'meat',     name: '肉类',     icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周安排多种肉类，补充铁和蛋白质' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 7, suggestion: '建议每日安排深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
    ],
  },

  // ========================================================
  // 1-2 岁：家庭饮食过渡期
  // ========================================================
  '1-2y': {
    dailyChecks: [
      { key: 'staple',    name: '谷薯类',   icon: '🍚', category: 'staple',    required: true,  suggestion: '建议搭配主食（软饭、面条等）' },
      { key: 'egg',       name: '蛋类',     icon: '🥚', category: 'egg',       required: true,  suggestion: '每日1个全蛋，可变换做法：鸡蛋羹、番茄炒蛋等' },
      { key: 'meatFish',  name: '畜禽鱼肉', icon: '🥩', category: 'redMeat',   required: true,  suggestion: '建议搭配肉类或水产（约50-75g）' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true,  suggestion: '建议搭配深色蔬菜（如菠菜、西兰花、胡萝卜）' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'dairy',     name: '奶制品',   icon: '🥛', category: 'dairy',     required: true,  suggestion: '建议每日400-500mL奶制品' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true,  suggestion: '建议每日50-100g水果' },
      { key: 'soy',       name: '豆制品',   icon: '🫘', category: 'soyProduct', required: false, suggestion: '建议近期补充（约50g豆腐），提高食物多样性' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类，丰富蛋白质来源' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '建议保持适量全蛋摄入，可变换多种做法' },
      { key: 'meat',     name: '肉类',     icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周5-7次畜禽肉' },
      { key: 'soy',      name: '豆制品',   icon: '🫘', category: 'soyProduct',   dailyTarget: 3, suggestion: '建议每周安排豆制品，增加食物多样性' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 5, suggestion: '建议每周大部分天数有深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
      { key: 'dairy',    name: '奶制品',   icon: '🥛', category: 'dairy',        dailyTarget: 7, suggestion: '建议每日饮用奶制品' },
    ],
  },

  // ========================================================
  // 2-3 岁：自主进食培养期
  // ========================================================
  '2-3y': {
    dailyChecks: [
      { key: 'staple',    name: '谷薯类',   icon: '🍚', category: 'staple',    required: true,  suggestion: '建议搭配主食（米饭、馒头、饺子等）' },
      { key: 'egg',       name: '蛋类',     icon: '🥚', category: 'egg',       required: true,  suggestion: '建议每天1个全蛋，可变换多种做法' },
      { key: 'meatFish',  name: '畜禽鱼肉', icon: '🥩', category: 'redMeat',   required: true,  suggestion: '建议搭配肉类或水产（50-75g/天）' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true,  suggestion: '建议搭配深色蔬菜（如菠菜、西兰花、胡萝卜）' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'dairy',     name: '奶制品',   icon: '🥛', category: 'dairy',     required: true,  suggestion: '建议每日350-500mL奶制品' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true,  suggestion: '建议每日150-200g水果' },
      { key: 'soy',       name: '豆制品',   icon: '🫘', category: 'soyProduct', required: false, suggestion: '建议近期补充（约75g豆腐），提高食物多样性' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类，变换不同鱼种' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '建议每天变换鸡蛋做法，如炒蛋、蒸蛋、蛋汤等' },
      { key: 'meat',     name: '畜禽肉',   icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周5-7次畜禽肉，搭配鱼虾禽肉' },
      { key: 'soy',      name: '豆制品',   icon: '🫘', category: 'soyProduct',   dailyTarget: 3, suggestion: '建议每周安排豆制品，增加食物多样性' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 5, suggestion: '建议每周大部分天数有深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
      { key: 'dairy',    name: '奶制品',   icon: '🥛', category: 'dairy',        dailyTarget: 7, suggestion: '建议每日饮用奶制品' },
    ],
  },

  // ========================================================
  // 3-5 岁：儿童家庭餐阶段
  // ========================================================
  '3-5y': {
    dailyChecks: [
      { key: 'staple',    name: '谷薯类',   icon: '🍚', category: 'staple',    required: true,  suggestion: '建议搭配主食（150-200g/天）' },
      { key: 'egg',       name: '蛋类',     icon: '🥚', category: 'egg',       required: true,  suggestion: '建议每天1个全蛋，可变换多种做法' },
      { key: 'meatFish',  name: '畜禽鱼肉', icon: '🥩', category: 'redMeat',   required: true,  suggestion: '建议搭配肉类或水产（50-75g/天）' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true,  suggestion: '建议搭配深色蔬菜（如菠菜、西兰花、胡萝卜）' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'dairy',     name: '奶制品',   icon: '🥛', category: 'dairy',     required: true,  suggestion: '建议每日350-500mL奶制品' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true,  suggestion: '建议每日150-200g水果' },
      { key: 'soy',       name: '豆制品',   icon: '🫘', category: 'soyProduct', required: false, suggestion: '建议近期补充（约75g北豆腐或250mL豆浆），提高食物多样性' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类，变换不同鱼种' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '建议每天变换鸡蛋做法，如炒蛋、蒸蛋、蛋汤等' },
      { key: 'meat',     name: '畜禽肉',   icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周5-7次畜禽肉，搭配鱼虾禽肉' },
      { key: 'soy',      name: '豆制品',   icon: '🫘', category: 'soyProduct',   dailyTarget: 3, suggestion: '建议每周安排豆制品，增加食物多样性' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 5, suggestion: '建议每周大部分天数有深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
      { key: 'dairy',    name: '奶制品',   icon: '🥛', category: 'dairy',        dailyTarget: 7, suggestion: '建议每日饮用奶制品' },
    ],
  },
};

export function getAgeRule(age: AgeGroup): AgeRule {
  return AGE_RULES[age];
}

export function getAgeStageMeta(age: AgeGroup): AgeStageMeta {
  return AGE_STAGE_META[age];
}

// ============================================================
// 辅助判断函数
// ============================================================

/** 是否为12个月以上（1岁以上） */
export function isAge12Plus(age: AgeGroup): boolean {
  return ['1-2y', '2-3y', '3-5y'].includes(age);
}

/** 是否为6-8月龄 */
export function is6to8m(age: AgeGroup): boolean {
  return age === '6-8m';
}

/** 是否为9-11月龄 */
export function is9to11m(age: AgeGroup): boolean {
  return age === '9-11m';
}

/** 是否超过2岁 */
export function isOver2(age: AgeGroup): boolean {
  return ['2-3y', '3-5y'].includes(age);
}
