export const MEAL_RULES_REVISION = 2;
export const MEAL_PLAN_STORAGE_KEY = 'baby-recipe-storage';

interface PersistedMealState {
  state?: {
    weeklyPlan?: unknown;
    mealRulesRevision?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Invalidates only a plan produced by older meal rules. This deliberately uses
 * a revision inside the persisted state instead of Zustand's schema version,
 * so it also works when an older dev server has already written the current
 * schema version.
 */
export function invalidateStaleMealPlan(storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  const raw = storage.getItem(MEAL_PLAN_STORAGE_KEY);
  if (!raw) return false;

  let persisted: PersistedMealState;
  try {
    persisted = JSON.parse(raw) as PersistedMealState;
  } catch {
    return false;
  }

  if (!persisted.state || persisted.state.mealRulesRevision === MEAL_RULES_REVISION) return false;

  storage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify({
    ...persisted,
    state: {
      ...persisted.state,
      weeklyPlan: null,
      mealRulesRevision: MEAL_RULES_REVISION,
    },
  }));
  return true;
}

export function invalidateBrowserMealPlan(): boolean {
  if (typeof window === 'undefined') return false;
  return invalidateStaleMealPlan(window.localStorage);
}

// This module is imported before App, so the cache is fixed before useStore is evaluated.
invalidateBrowserMealPlan();
