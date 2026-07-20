import { AgeGroup } from '../types';
import { FoodCategory } from './foodDictionary';

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

const AGE_GROUP_KEY: Record<AgeGroup, '6-8m' | '9-11m' | '1-2y' | '3-5y'> = {
  '6-8m': '6-8m',
  '9-11m': '9-11m',
  '1-2y': '1-2y',
  '2-3y': '3-5y',
  '3-5y': '3-5y',
};

export const AGE_RULES: Record<'6-8m' | '9-11m' | '1-2y' | '3-5y', AgeRule> = {
  // ========================================================
  // 6-8 个月（辅食初期）：辅食成长检查
  // 核心目标：建立辅食习惯、引入不同食物、保证铁来源
  // 不要求每日覆盖完整营养结构，奶仍是主要营养来源
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
  // 核心目标：逐步覆盖主食、蛋白质、蔬菜、水果、奶类
  // ========================================================
  '9-11m': {
    dailyChecks: [
      { key: 'staple',    name: '主食',     icon: '🍚', category: 'staple',    required: true, suggestion: '米粉、粥或软饭' },
      { key: 'protein',   name: '蛋白质',   icon: '🥩', category: 'egg',       required: true, suggestion: '蛋黄、肉泥或鱼泥' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true, suggestion: '深色蔬菜营养更丰富' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true, suggestion: '补充维生素' },
      { key: 'dairy',     name: '奶类',     icon: '🥛', category: 'dairy',     required: false, suggestion: '母乳或配方奶为主，每日约600mL' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '建议每天蛋黄逐步增量' },
      { key: 'meat',     name: '肉类',     icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周安排肉类' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 7, suggestion: '建议每日安排深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
    ],
  },

  // ========================================================
  // 1-2 岁：营养均衡检查
  // ========================================================
  '1-2y': {
    dailyChecks: [
      { key: 'staple',    name: '谷薯类',   icon: '🍚', category: 'staple',    required: true,  suggestion: '建议搭配主食（软饭、面条等）' },
      { key: 'egg',       name: '蛋类',     icon: '🥚', category: 'egg',       required: true,  suggestion: '建议每天1个鸡蛋' },
      { key: 'meatFish',  name: '畜禽鱼肉', icon: '🥩', category: 'redMeat',   required: true,  suggestion: '建议搭配肉类或水产（约50-75g）' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true,  suggestion: '建议搭配深色蔬菜（如菠菜、西兰花、胡萝卜）' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'dairy',     name: '奶制品',   icon: '🥛', category: 'dairy',     required: true,  suggestion: '建议每日400-500mL奶制品' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true,  suggestion: '建议每日50-100g水果' },
      { key: 'soy',       name: '豆制品',   icon: '🫘', category: 'soyProduct', required: false, suggestion: '建议近期补充（约50g豆腐），提高食物多样性' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '建议每日1个鸡蛋' },
      { key: 'meat',     name: '肉类',     icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周5-7次畜禽肉' },
      { key: 'soy',      name: '豆制品',   icon: '🫘', category: 'soyProduct',   dailyTarget: 3, suggestion: '建议每周安排豆制品，增加食物多样性' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 5, suggestion: '建议每周大部分天数有深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
      { key: 'dairy',    name: '奶制品',   icon: '🥛', category: 'dairy',        dailyTarget: 7, suggestion: '建议每日饮用奶制品' },
    ],
  },

  // ========================================================
  // 2-3 岁 / 3-5 岁：营养均衡检查
  // ========================================================
  '3-5y': {
    dailyChecks: [
      { key: 'staple',    name: '谷薯类',   icon: '🍚', category: 'staple',    required: true,  suggestion: '建议搭配主食（150-200g/天）' },
      { key: 'egg',       name: '蛋类',     icon: '🥚', category: 'egg',       required: true,  suggestion: '建议每天1个鸡蛋' },
      { key: 'meatFish',  name: '畜禽鱼肉', icon: '🥩', category: 'redMeat',   required: true,  suggestion: '建议搭配肉类或水产（50-75g/天）' },
      { key: 'darkVeg',   name: '深色蔬菜', icon: '🥦', category: 'darkVeg',   required: true,  suggestion: '建议搭配深色蔬菜（如菠菜、西兰花、胡萝卜）' },
      { key: 'lightVeg',  name: '浅色蔬菜', icon: '🥬', category: 'lightVeg',  required: false, suggestion: '可搭配浅色蔬菜丰富种类' },
      { key: 'dairy',     name: '奶制品',   icon: '🥛', category: 'dairy',     required: true,  suggestion: '建议每日350-500mL奶制品' },
      { key: 'fruit',     name: '水果',     icon: '🍎', category: 'fruit',     required: true,  suggestion: '建议每日150-200g水果' },
      { key: 'soy',       name: '豆制品',   icon: '🫘', category: 'soyProduct', required: false, suggestion: '建议近期补充（约75g北豆腐或250mL豆浆），提高食物多样性' },
    ],
    weeklyChecks: [
      { key: 'fish',     name: '鱼类',     icon: '🐟', category: 'fishSeafood', dailyTarget: 3, suggestion: '建议每周2-3次鱼类' },
      { key: 'egg',      name: '鸡蛋',     icon: '🥚', category: 'egg',          dailyTarget: 7, suggestion: '建议每日1个鸡蛋' },
      { key: 'meat',     name: '畜禽肉',   icon: '🥩', category: 'redMeat',      dailyTarget: 5, suggestion: '建议每周5-7次畜禽肉，搭配鱼虾禽肉' },
      { key: 'soy',      name: '豆制品',   icon: '🫘', category: 'soyProduct',   dailyTarget: 3, suggestion: '建议每周安排豆制品，增加食物多样性' },
      { key: 'darkVeg',  name: '深色蔬菜', icon: '🥦', category: 'darkVeg',      dailyTarget: 5, suggestion: '建议每周大部分天数有深色蔬菜' },
      { key: 'fruit',    name: '水果',     icon: '🍎', category: 'fruit',        dailyTarget: 7, suggestion: '建议每日安排水果' },
      { key: 'dairy',    name: '奶制品',   icon: '🥛', category: 'dairy',        dailyTarget: 7, suggestion: '建议每日饮用奶制品' },
    ],
  },
};

export function getAgeRule(age: AgeGroup): AgeRule {
  const key = AGE_GROUP_KEY[age];
  return AGE_RULES[key];
}
