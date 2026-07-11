import { gzip, ungzip } from 'pako';
import { WeeklyPlan, Recipe, DAYS_OF_WEEK, MealType } from '@/types';
import { recipes } from '@/data/recipes';

interface SharePlan {
  a: string;
  p: Record<string, Record<string, string[]>>;
  c: Recipe[];
}

function trimRecipe(r: Recipe): Recipe {
  return {
    id: r.id,
    name: r.name,
    dishType: r.dishType,
    ingredients: r.ingredients,
    steps: r.steps,
    mainIngredients: r.mainIngredients,
    ageGroups: r.ageGroups,
    tags: r.tags,
    category: r.category,
    nutrition: r.nutrition,
  };
}

export function encodeShareData(weeklyPlan: WeeklyPlan, ageLabel: string): string {
  const customMap = new Map<string, Recipe>();

  const p: Record<string, Record<string, string[]>> = {};
  for (const day of DAYS_OF_WEEK) {
    p[day] = {};
    for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      p[day][meal] = weeklyPlan[day][meal].dishes.map(d => {
        if (d.id.startsWith('custom-')) {
          customMap.set(d.id, trimRecipe(d));
        }
        return d.id;
      });
    }
  }

  const data: SharePlan = { a: ageLabel, p, c: Array.from(customMap.values()) };
  const json = JSON.stringify(data);
  const compressed = gzip(new TextEncoder().encode(json));

  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
    const data: SharePlan = JSON.parse(new TextDecoder().decode(decompressed));

    if (!data.p || typeof data.a !== 'string') return null;

    const recipeMap = new Map<string, Recipe>();
    for (const r of recipes) recipeMap.set(r.id, r);
    if (data.c) {
      for (const cr of data.c) recipeMap.set(cr.id, cr);
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
