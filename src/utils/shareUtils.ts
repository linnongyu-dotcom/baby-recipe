import { gzip, ungzip } from 'pako';
import { WeeklyPlan, Recipe, DAYS_OF_WEEK, MealType } from '@/types';
import { recipes } from '@/data/recipes';

// 精简版分享数据结构 - 使用单字母字段名压缩体积
interface SharePlan {
  a: string;                       // ageLabel
  p: Record<string, Record<string, string[]>>; // plan: day -> meal -> [recipeIds]
  c?: CompactRecipe[];             // custom recipes (only if any)
}

// 自定义食谱的精简表示 - 单字母键名大幅减少链接长度
interface CompactRecipe {
  i: string;    // id
  n: string;    // name
  d: string;    // dishType
  m: string[];  // mainIngredients
  g: string[];  // ingredient names (drop amounts for share)
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

export function encodeShareData(weeklyPlan: WeeklyPlan, ageLabel: string): string {
  const customList: CompactRecipe[] = [];

  const p: Record<string, Record<string, string[]>> = {};
  for (const day of DAYS_OF_WEEK) {
    p[day] = {};
    for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      p[day][meal] = weeklyPlan[day][meal].dishes.map(d => {
        if (d.id.startsWith('custom-')) {
          customList.push(compactRecipe(d));
        }
        return d.id;
      });
    }
  }

  const data: SharePlan = { a: ageLabel, p };
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
    tags: ['分享'],
    category: '',
    nutrition: '',
  };
}

export function decodeShareData(encoded: string): { weeklyPlan: WeeklyPlan; ageLabel: string } | null {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decompressed = ungzip(bytes);
    const data = JSON.parse(new TextDecoder().decode(decompressed)) as SharePlan;

    if (!data.p || typeof data.a !== 'string') return null;

    const recipeMap = new Map<string, Recipe>();
    for (const r of recipes) recipeMap.set(r.id, r);

    // 解码自定义食谱 - 兼容新旧格式
    const customData = data.c;
    if (customData && customData.length > 0) {
      for (const cr of customData) {
        if ('i' in cr && 'n' in cr) {
          const c = cr as CompactRecipe;
          recipeMap.set(c.i, expandCompactRecipe(c));
        } else if ('id' in cr && 'name' in cr) {
          const legacy = cr as unknown as Recipe;
          recipeMap.set(legacy.id, legacy);
        }
      }
    }

    const weeklyPlan = {} as WeeklyPlan;
    for (const day of DAYS_OF_WEEK) {
      const dayData = data.p[day];
      if (!dayData) return null;
      weeklyPlan[day] = { breakfast: { dishes: [] }, lunch: { dishes: [] }, dinner: { dishes: [] } };
      for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
        const ids = dayData[meal] as string[] | undefined;
        if (!Array.isArray(ids)) return null;
        const dishes: Recipe[] = [];
        for (const id of ids) {
          const recipe = recipeMap.get(id);
          if (recipe) dishes.push(recipe);
        }
        weeklyPlan[day][meal] = { dishes };
      }
    }

    return { weeklyPlan, ageLabel: data.a };
  } catch {
    return null;
  }
}
