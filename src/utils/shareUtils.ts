import { gzip, ungzip } from 'pako';
import { WeeklyPlan, Recipe, DAYS_OF_WEEK, MealType, AgeGroup } from '@/types';
import { recipes } from '@/data/recipes';

// ============================================================
// 新版分享格式 - 用数组替代嵌套JSON，大幅压缩链接长度
//
// 结构：{a: ageLabel, g: ageGroup, p: ["ids","ids",...21项固定顺序], c?: [compactRecipes]}
// p 数组顺序：周1早、周1午、周1晚、周2早、...、周日晚（共21项）
// 每项是逗号分隔的菜谱ID，空白表示无菜
// 相比旧版嵌套对象格式减少约50%+的结构开销
// ============================================================

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

interface NewSharePlan {
  a: string;        // ageLabel
  g: AgeGroup;      // ageGroup for nutrition analysis
  p: string[];      // 21项固定顺序：每项逗号分隔的菜谱ID
  c?: CompactRecipe[]; // 自定义菜谱
}

// 旧版兼容格式
interface OldSharePlan {
  a: string;
  p: Record<string, Record<string, string[]>>;
  c?: (CompactRecipe | Recipe)[];
}

interface CompactRecipe {
  i: string;    // id
  n: string;    // name
  d: string;    // dishType
  m: string[];  // mainIngredients
  g: string[];  // ingredient names
  t: string[];  // steps
}

function compactRecipe(r: Recipe): CompactRecipe {
  return {
    i: r.id,
    n: r.name,
    d: r.dishType,
    m: r.mainIngredients,
    g: r.ingredients.map(ing => ing.name),
    t: r.steps,
  };
}

export function encodeShareData(weeklyPlan: WeeklyPlan, ageLabel: string, ageGroup: AgeGroup): string {
  const customList: CompactRecipe[] = [];

  // 固定顺序的21项平面数组，替代嵌套对象
  const p: string[] = [];
  for (const day of DAYS_OF_WEEK) {
    for (const meal of MEAL_ORDER) {
      const ids = weeklyPlan[day][meal].dishes.map(d => {
        if (d.id.startsWith('custom-')) {
          customList.push(compactRecipe(d));
        }
        return d.id;
      });
      p.push(ids.join(','));
    }
  }

  const data: NewSharePlan = { a: ageLabel, g: ageGroup, p };
  if (customList.length > 0) {
    data.c = customList;
  }

  const json = JSON.stringify(data);
  const compressed = gzip(new TextEncoder().encode(json));

  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function expandCompactRecipe(c: CompactRecipe): Recipe {
  return {
    id: c.i,
    name: c.n,
    dishType: c.d as Recipe['dishType'],
    mainIngredients: c.m,
    ingredients: c.g.map(name => ({ name, amount: '适量' })),
    steps: c.t,
    ageGroups: [],
    tags: [],
    category: '',
    nutrition: '',
  };
}

function isNewFormat(data: any): data is NewSharePlan {
  return Array.isArray(data.p);
}

function isOldFormat(data: any): data is OldSharePlan {
  return typeof data.p === 'object' && !Array.isArray(data.p);
}

function isCompactRecipe(c: any): c is CompactRecipe {
  return typeof c.i === 'string' && typeof c.n === 'string';
}

function decodeCustomRecipes(
  recipeMap: Map<string, Recipe>,
  customData: (CompactRecipe | Recipe)[] | undefined,
) {
  if (!customData) return;
  for (const cr of customData) {
    if (isCompactRecipe(cr)) {
      recipeMap.set(cr.i, expandCompactRecipe(cr));
    } else {
      recipeMap.set((cr as Recipe).id, cr as Recipe);
    }
  }
}

function decodeOldPlan(oldP: OldSharePlan['p']): WeeklyPlan {
  const weeklyPlan = {} as WeeklyPlan;
  for (const day of DAYS_OF_WEEK) {
    const dayData = oldP[day];
    if (!dayData) continue;
    weeklyPlan[day] = { breakfast: { dishes: [] }, lunch: { dishes: [] }, dinner: { dishes: [] } };
    for (const meal of MEAL_ORDER) {
      const ids = dayData[meal] as string[] | undefined;
      if (!Array.isArray(ids)) continue;
      const dishes: Recipe[] = [];
      for (const id of ids) {
        const recipe = recipes.find(r => r.id === id);
        if (recipe) dishes.push(recipe);
      }
      weeklyPlan[day][meal] = { dishes };
    }
  }
  return weeklyPlan;
}

function decodeNewPlan(newP: string[], recipeMap: Map<string, Recipe>): WeeklyPlan {
  const weeklyPlan = {} as WeeklyPlan;
  let idx = 0;
  for (const day of DAYS_OF_WEEK) {
    weeklyPlan[day] = { breakfast: { dishes: [] }, lunch: { dishes: [] }, dinner: { dishes: [] } };
    for (const meal of MEAL_ORDER) {
      const idStr = newP[idx++] || '';
      const ids = idStr ? idStr.split(',') : [];
      const dishes: Recipe[] = [];
      for (const id of ids) {
        const recipe = recipeMap.get(id);
        if (recipe) dishes.push(recipe);
      }
      weeklyPlan[day][meal] = { dishes };
    }
  }
  return weeklyPlan;
}

export function decodeShareData(encoded: string): { weeklyPlan: WeeklyPlan; ageLabel: string; ageGroup?: AgeGroup } | null {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decompressed = ungzip(bytes);
    const data = JSON.parse(new TextDecoder().decode(decompressed));

    if (!data.p || typeof data.a !== 'string') return null;

    const recipeMap = new Map<string, Recipe>();
    for (const r of recipes) recipeMap.set(r.id, r);

    let weeklyPlan: WeeklyPlan;

    if (isNewFormat(data)) {
      // 新版平面数组格式
      decodeCustomRecipes(recipeMap, data.c);
      weeklyPlan = decodeNewPlan(data.p, recipeMap);
    } else if (isOldFormat(data)) {
      // 旧版嵌套对象格式
      decodeCustomRecipes(recipeMap, data.c);
      weeklyPlan = decodeOldPlan(data.p);
    } else {
      return null;
    }

    return { weeklyPlan, ageLabel: data.a, ageGroup: (data as NewSharePlan).g };
  } catch {
    return null;
  }
}
