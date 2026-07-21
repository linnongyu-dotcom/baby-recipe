import { FoodIntroCategory } from '../types';

// 食材定义：name, category, recommendedMonth（建议添加月龄）, priority（同月龄推荐顺序，越小越优先）
export interface FoodItemDef {
  name: string;
  category: FoodIntroCategory;
  recommendedMonth: number; // 6/7/8
  priority: number;
  reason: string;
  addMethod: string;
}

// 6-8个月食材添加顺序（按科学喂养指南）
// priority: 越小越优先推荐
export const FOOD_INTRODUCTION_LIST: FoodItemDef[] = [
  // ===== 6个月 =====
  { name: '强化铁米粉', category: 'grain', recommendedMonth: 6, priority: 1,
    reason: '首选辅食，富含铁元素，满足6个月后铁需求', addMethod: '从1勺开始，用母乳或配方奶调成稀糊状' },
  { name: '南瓜', category: 'vegetable', recommendedMonth: 6, priority: 2,
    reason: '口感细腻微甜，富含β-胡萝卜素，宝宝容易接受', addMethod: '蒸熟后压成泥，单独尝试观察2-3天' },
  { name: '胡萝卜', category: 'vegetable', recommendedMonth: 6, priority: 3,
    reason: '富含胡萝卜素和膳食纤维，营养丰富', addMethod: '蒸熟后打成泥，建议滴几滴植物油帮助吸收' },
  { name: '土豆', category: 'vegetable', recommendedMonth: 6, priority: 4,
    reason: '质地细腻，含钾和维生素C，不易过敏', addMethod: '蒸熟压成泥，可加少量母乳/配方奶调稀' },
  { name: '苹果', category: 'fruit', recommendedMonth: 6, priority: 5,
    reason: '温和水果，含果胶助消化，不易过敏', addMethod: '蒸熟刮泥或直接刮成泥喂食' },
  { name: '梨', category: 'fruit', recommendedMonth: 6, priority: 6,
    reason: '清甜多汁，润肺止咳，含丰富水分', addMethod: '蒸熟刮泥喂食，也可榨汁稀释后喂' },

  // ===== 7个月 =====
  { name: '小米粥', category: 'grain', recommendedMonth: 7, priority: 1,
    reason: '养胃健脾，含B族维生素，容易消化', addMethod: '煮至软烂无颗粒，从稀到稠逐步过渡' },
  { name: '大米粥', category: 'grain', recommendedMonth: 7, priority: 2,
    reason: '基础谷物，含碳水化合物提供能量', addMethod: '煮至米粒开花软烂，可搭配已尝试蔬菜泥' },
  { name: '西兰花', category: 'vegetable', recommendedMonth: 7, priority: 3,
    reason: '富含维生素C和钙，营养密度高', addMethod: '蒸熟剁成碎末，单独尝试观察2-3天' },
  { name: '菠菜', category: 'vegetable', recommendedMonth: 7, priority: 4,
    reason: '富含铁和叶酸，但需焯水去除草酸', addMethod: '开水焯烫后剁碎，单独尝试观察大便情况' },
  { name: '猪肉', category: 'protein', recommendedMonth: 7, priority: 5,
    reason: '富含血红素铁和优质蛋白质', addMethod: '选瘦肉剁成肉泥蒸熟，建议单独尝试观察2-3天' },
  { name: '牛肉', category: 'protein', recommendedMonth: 7, priority: 6,
    reason: '铁含量高且吸收率好，增强免疫力', addMethod: '选里脊部位剁成泥，充分蒸熟后喂食' },
  { name: '鱼肉', category: 'protein', recommendedMonth: 7, priority: 7,
    reason: '富含DHA和优质蛋白，促进大脑发育', addMethod: '选刺少的鱼（如鳕鱼），蒸熟去刺碾碎' },

  // ===== 8个月 =====
  { name: '蛋黄', category: 'protein', recommendedMonth: 8, priority: 1,
    reason: '含卵磷脂和铁，从1/4个开始逐步增加', addMethod: '水煮蛋取蛋黄压碎，用奶或米糊调稀喂食' },
  { name: '山药', category: 'vegetable', recommendedMonth: 8, priority: 2,
    reason: '健脾养胃，口感绵软，易消化吸收', addMethod: '蒸熟压成泥，可搭配已尝试的谷物' },
  { name: '红薯', category: 'grain', recommendedMonth: 8, priority: 3,
    reason: '富含膳食纤维和β-胡萝卜素，天然甜味', addMethod: '蒸熟压成泥，注意量不宜过多以免胀气' },
  { name: '香蕉', category: 'fruit', recommendedMonth: 8, priority: 4,
    reason: '含钾和天然果糖，口感软糯易接受', addMethod: '用勺子刮泥直接喂食，选熟透的香蕉' },
  { name: '鸡肉', category: 'protein', recommendedMonth: 8, priority: 5,
    reason: '低脂肪高蛋白，肉质细嫩易消化', addMethod: '选鸡胸肉剁成泥蒸熟，单独尝试观察2-3天' },
  { name: '豆腐', category: 'protein', recommendedMonth: 8, priority: 6,
    reason: '植物蛋白来源，含钙丰富，口感嫩滑', addMethod: '选嫩豆腐压碎蒸熟，可与已接受的蔬菜搭配' },
  { name: '燕麦', category: 'grain', recommendedMonth: 8, priority: 7,
    reason: '富含膳食纤维和B族维生素', addMethod: '煮成软烂燕麦糊，可搭配已尝试的水果泥' },
];

// 快速查找食材定义
export function findFoodDef(name: string): FoodItemDef | undefined {
  return FOOD_INTRODUCTION_LIST.find(f => f.name === name);
}

// 获取指定月龄的食材列表（按优先级排序）
export function getFoodsByMonth(month: number): FoodItemDef[] {
  return FOOD_INTRODUCTION_LIST
    .filter(f => f.recommendedMonth === month)
    .sort((a, b) => a.priority - b.priority);
}

// 获取指定月龄之前的所有食材（用于判断当前阶段）
export function getFoodsUpToMonth(month: number): FoodItemDef[] {
  return FOOD_INTRODUCTION_LIST
    .filter(f => f.recommendedMonth <= month)
    .sort((a, b) => a.recommendedMonth - b.recommendedMonth || a.priority - b.priority);
}
