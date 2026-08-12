import type { BabyProfile, Recipe, UserRecipe, UserSettings, WeeklyPlan, FoodRecord } from '@/types';

export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncableData {
  babies: BabyProfile[];
  currentBabyId: string | null;
  userRecipes: UserRecipe[];
  customRecipes: Recipe[];
  favoriteIds: string[];
  weeklyPlan: WeeklyPlan | null;
  settings: UserSettings;
  isSetupComplete: boolean;
  babyName: string;
  foodRecords: FoodRecord[];
  feedingMonth: 6 | 7 | 8;
}

export interface UserSpaceDocument extends SyncableData {
  _id?: string;
  userId: string;
  schemaVersion: 1;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface DataSummary {
  babyCount: number;
  recipeCount: number;
  updatedAt: number;
}

export interface DataConflict {
  local: SyncableData;
  cloud: UserSpaceDocument;
  localSummary: DataSummary;
  cloudSummary: DataSummary;
}
