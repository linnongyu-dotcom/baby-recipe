import type { SyncableData } from '@/types/cloudSync';

export const LEGACY_STORAGE_KEY = 'baby-recipe-storage';
export const GUEST_STORAGE_KEY = 'fanxiaobao:guest';
export const LOCAL_MIGRATION_KEY = 'fanxiaobao:migration-version';
export const LOCAL_MIGRATION_VERSION = 1;

let activeUid: string | null = null;

export const storageKeyFor = (uid: string | null) => uid ? `fanxiaobao:user:${uid}` : GUEST_STORAGE_KEY;
export const getActiveUid = () => activeUid;
export const setActiveUid = (uid: string | null) => { activeUid = uid; };

export function migrateLegacyStorage(storage: Storage = localStorage): boolean {
  if (Number(storage.getItem(LOCAL_MIGRATION_KEY)) >= LOCAL_MIGRATION_VERSION) return false;
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacy && !storage.getItem(GUEST_STORAGE_KEY)) storage.setItem(GUEST_STORAGE_KEY, legacy);
  storage.setItem(LOCAL_MIGRATION_KEY, String(LOCAL_MIGRATION_VERSION));
  return Boolean(legacy);
}

export const identityStorage = {
  getItem: (name: string) => { void name; return localStorage.getItem(storageKeyFor(activeUid)); },
  setItem: (_name: string, value: string) => localStorage.setItem(storageKeyFor(activeUid), value),
  removeItem: (name: string) => { void name; localStorage.removeItem(storageKeyFor(activeUid)); },
};

const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;

/** Repair IDs once during hydration; the repaired value is persisted by Zustand. */
export function normalizeStableIds<T extends Partial<SyncableData>>(data: T): T {
  return {
    ...data,
    babies: (data.babies || []).map(baby => ({ ...baby, id: baby.id || id('baby') })),
    userRecipes: (data.userRecipes || []).map(recipe => ({ ...recipe, id: recipe.id || id('recipe') })),
    customRecipes: (data.customRecipes || []).map(recipe => ({ ...recipe, id: recipe.id || id('custom') })),
  } as T;
}
