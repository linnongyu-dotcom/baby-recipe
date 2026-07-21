import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings, WeeklyPlan, Recipe, DayOfWeek, MealType, MealPlan, FoodRecord, BabyProfile, AgeGroup } from '../types';
import { generateWeeklyPlan, regenerateMeal, regenerateDish, swapMeals } from '../utils/recipeGenerator';
import { calcAge, generateBabyId, estimateBirthDateFromAgeGroup } from '../utils/babyProfile';

interface AppState {
  // 用户设置
  settings: UserSettings;
  // 一周食谱
  weeklyPlan: WeeklyPlan | null;
  // 是否已完成设置
  isSetupComplete: boolean;
  // 用户自定义菜谱库
  customRecipes: Recipe[];
  // 收藏的菜谱ID
  favoriteIds: string[];
  // 宝宝姓名（兼容旧版，新架构中存储在 BabyProfile.nickname 中）
  babyName: string;
  // 食材添加记录（6-8月龄）
  foodRecords: FoodRecord[];
  // 当前辅食月龄 6/7/8
  feedingMonth: 6 | 7 | 8;

  // ===== 宝宝成长档案 =====
  // 宝宝列表
  babies: BabyProfile[];
  // 当前选中的宝宝ID
  currentBabyId: string | null;

  // 操作方法
  setBabyAge: (age: UserSettings['babyAge']) => void;
  setAllergies: (allergies: string[]) => void;
  setDislikes: (dislikes: string[]) => void;
  setLikes: (likes: string[]) => void;
  setBabyName: (name: string) => void;
  generatePlan: () => void;
  regenerateMeal: (day: DayOfWeek, mealType: MealType) => void;
  regenerateDish: (day: DayOfWeek, mealType: MealType, dishIndex: number) => void;
  removeDish: (day: DayOfWeek, mealType: MealType, dishIndex: number) => void;
  swapMeals: (day: DayOfWeek) => void;
  setCustomMeal: (day: DayOfWeek, mealType: MealType, mealPlan: MealPlan) => void;
  addDish: (day: DayOfWeek, mealType: MealType, dish: Recipe) => void;
  addCustomRecipe: (recipe: Recipe) => void;
  removeCustomRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  resetSettings: () => void;
  // 食材添加记录操作
  addFoodRecord: (record: FoodRecord) => void;
  updateFoodRecord: (name: string, updates: Partial<FoodRecord>) => void;
  removeFoodRecord: (name: string) => void;
  setFeedingMonth: (month: 6 | 7 | 8) => void;

  // ===== 宝宝档案操作 =====
  addBaby: (birthDate: string, nickname?: string) => string;
  updateBaby: (id: string, updates: Partial<BabyProfile>) => void;
  removeBaby: (id: string) => void;
  setCurrentBaby: (id: string) => void;
}

const defaultSettings: UserSettings = {
  babyAge: null,
  allergies: [],
  dislikes: [],
  likes: [],
};

// 获取当前有效的 AgeGroup（优先从 baby 档案计算，回退到 settings）
function getEffectiveBabyAge(state: { babies: BabyProfile[]; currentBabyId: string | null; settings: UserSettings }): AgeGroup | null {
  if (state.currentBabyId) {
    const baby = state.babies.find(b => b.id === state.currentBabyId);
    if (baby) {
      const ageInfo = calcAge(baby.birthDate);
      return ageInfo.ageGroup;
    }
  }
  return state.settings.babyAge;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      weeklyPlan: null,
      isSetupComplete: false,
      customRecipes: [],
      favoriteIds: [],
      babyName: '',
      foodRecords: [],
      feedingMonth: 6,
      babies: [],
      currentBabyId: null,

      setBabyAge: (age) => set((state) => ({
        settings: { ...state.settings, babyAge: age },
      })),

      setAllergies: (allergies) => set((state) => ({
        settings: { ...state.settings, allergies },
      })),

      setDislikes: (dislikes) => set((state) => ({
        settings: { ...state.settings, dislikes },
      })),

      setLikes: (likes) => set((state) => ({
        settings: { ...state.settings, likes },
      })),

      setBabyName: (name) => set({ babyName: name }),

      generatePlan: () => {
        const state = get();
        const effectiveAge = getEffectiveBabyAge(state);
        if (!effectiveAge) return;

        const plan = generateWeeklyPlan(
          { ...state.settings, babyAge: effectiveAge },
          state.customRecipes
        );
        // 同步 settings.babyAge
        set({
          weeklyPlan: plan,
          isSetupComplete: true,
          settings: { ...state.settings, babyAge: effectiveAge },
        });
      },

      regenerateMeal: (day, mealType) => {
        const state = get();
        const effectiveAge = getEffectiveBabyAge(state);
        if (!state.weeklyPlan || !effectiveAge) return;

        const usedRecipes: Recipe[] = [];
        for (const d of Object.keys(state.weeklyPlan) as DayOfWeek[]) {
          usedRecipes.push(...state.weeklyPlan[d].breakfast.dishes);
          usedRecipes.push(...state.weeklyPlan[d].lunch.dishes);
          usedRecipes.push(...state.weeklyPlan[d].dinner.dishes);
        }

        const newMeal = regenerateMeal(
          { ...state.settings, babyAge: effectiveAge },
          state.customRecipes,
          usedRecipes,
          mealType
        );

        set((s) => ({
          weeklyPlan: {
            ...s.weeklyPlan!,
            [day]: {
              ...s.weeklyPlan![day],
              [mealType]: newMeal,
            },
          },
        }));
      },

      regenerateDish: (day, mealType, dishIndex) => {
        const state = get();
        const effectiveAge = getEffectiveBabyAge(state);
        if (!state.weeklyPlan || !effectiveAge) return;

        const dayPlan = state.weeklyPlan[day];
        const mealPlan = dayPlan[mealType];
        const targetDish = mealPlan.dishes[dishIndex];
        if (!targetDish) return;

        const usedRecipes: Recipe[] = [];
        for (const d of Object.keys(state.weeklyPlan) as DayOfWeek[]) {
          for (const m of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
            state.weeklyPlan[d][m].dishes.forEach((dish, idx) => {
              if (!(d === day && m === mealType && idx === dishIndex)) {
                usedRecipes.push(dish);
              }
            });
          }
        }

        const newDish = regenerateDish(
          { ...state.settings, babyAge: effectiveAge },
          state.customRecipes,
          usedRecipes,
          targetDish.dishType
        );
        if (!newDish) return;

        const newDishes = [...mealPlan.dishes];
        newDishes[dishIndex] = newDish;

        set((s) => ({
          weeklyPlan: {
            ...s.weeklyPlan!,
            [day]: {
              ...s.weeklyPlan![day],
              [mealType]: {
                ...s.weeklyPlan![day][mealType],
                dishes: newDishes,
              },
            },
          },
        }));
      },

      removeDish: (day, mealType, dishIndex) => {
        set((state) => {
          if (!state.weeklyPlan) return state;
          const mealPlan = state.weeklyPlan[day][mealType];
          const newDishes = mealPlan.dishes.filter((_, i) => i !== dishIndex);
          return {
            weeklyPlan: {
              ...state.weeklyPlan,
              [day]: {
                ...state.weeklyPlan[day],
                [mealType]: {
                  ...mealPlan,
                  dishes: newDishes,
                },
              },
            },
          };
        });
      },

      swapMeals: (day) => {
        const { weeklyPlan } = get();
        if (!weeklyPlan) return;

        const dayPlan = weeklyPlan[day];
        const swapped = swapMeals(dayPlan);

        set((state) => ({
          weeklyPlan: {
            ...state.weeklyPlan!,
            [day]: swapped,
          },
        }));
      },

      setCustomMeal: (day, mealType, mealPlan) => {
        set((state) => ({
          weeklyPlan: {
            ...state.weeklyPlan!,
            [day]: {
              ...state.weeklyPlan![day],
              [mealType]: mealPlan,
            },
          },
        }));
      },

      addDish: (day, mealType, dish) => {
        set((state) => {
          if (!state.weeklyPlan) return state;
          const mealPlan = state.weeklyPlan[day][mealType];
          return {
            weeklyPlan: {
              ...state.weeklyPlan,
              [day]: {
                ...state.weeklyPlan[day],
                [mealType]: {
                  dishes: [...mealPlan.dishes, dish],
                },
              },
            },
          };
        });
      },

      addCustomRecipe: (recipe) => set((state) => {
        const exists = state.customRecipes.some(r => r.id === recipe.id);
        if (exists) return state;
        return { customRecipes: [...state.customRecipes, recipe] };
      }),

      removeCustomRecipe: (id) => set((state) => ({
        customRecipes: state.customRecipes.filter(r => r.id !== id),
      })),

      toggleFavorite: (id) => set((state) => {
        const exists = state.favoriteIds.includes(id);
        return {
          favoriteIds: exists
            ? state.favoriteIds.filter(fid => fid !== id)
            : [...state.favoriteIds, id],
        };
      }),

      addFoodRecord: (record) => set((state) => {
        const exists = state.foodRecords.find(r => r.name === record.name);
        if (exists) {
          return {
            foodRecords: state.foodRecords.map(r =>
              r.name === record.name ? record : r
            ),
          };
        }
        return { foodRecords: [...state.foodRecords, record] };
      }),

      updateFoodRecord: (name, updates) => set((state) => ({
        foodRecords: state.foodRecords.map(r =>
          r.name === name ? { ...r, ...updates } : r
        ),
      })),

      removeFoodRecord: (name) => set((state) => ({
        foodRecords: state.foodRecords.filter(r => r.name !== name),
      })),

      setFeedingMonth: (month) => set({ feedingMonth: month }),

      resetSettings: () => set({
        settings: defaultSettings,
        weeklyPlan: null,
        isSetupComplete: false,
        customRecipes: [],
        favoriteIds: [],
        babyName: '',
        foodRecords: [],
        feedingMonth: 6,
        babies: [],
        currentBabyId: null,
      }),

      // ===== 宝宝档案操作 =====

      addBaby: (birthDate, nickname) => {
        const id = generateBabyId();
        const baby: BabyProfile = { id, birthDate, ...(nickname ? { nickname } : {}) };
        set((state) => ({
          babies: [...state.babies, baby],
          currentBabyId: state.currentBabyId || id,
        }));
        return id;
      },

      updateBaby: (id, updates) => set((state) => ({
        babies: state.babies.map(b =>
          b.id === id ? { ...b, ...updates } : b
        ),
      })),

      removeBaby: (id) => set((state) => {
        const newBabies = state.babies.filter(b => b.id !== id);
        const newCurrentId = state.currentBabyId === id
          ? (newBabies.length > 0 ? newBabies[0].id : null)
          : state.currentBabyId;
        // 如果没有宝宝了，清空相关数据
        if (newBabies.length === 0) {
          return {
            babies: [],
            currentBabyId: null,
            settings: defaultSettings,
            weeklyPlan: null,
            isSetupComplete: false,
            babyName: '',
          };
        }
        return { babies: newBabies, currentBabyId: newCurrentId };
      }),

      setCurrentBaby: (id) => {
        const state = get();
        const baby = state.babies.find(b => b.id === id);
        if (!baby) return;

        // 切换宝宝时重新计算年龄并清空旧食谱
        const ageInfo = calcAge(baby.birthDate);
        set({
          currentBabyId: id,
          weeklyPlan: null,
          settings: {
            ...state.settings,
            babyAge: ageInfo.ageGroup,
          },
        });
      },
    }),
    {
      name: 'baby-recipe-storage',
      version: 37,
      migrate: (persistedState: any, version: number) => {
        if (version < 30) {
          return {
            settings: persistedState?.settings || defaultSettings,
            weeklyPlan: null,
            isSetupComplete: false,
            customRecipes: persistedState?.customRecipes || [],
            favoriteIds: persistedState?.favoriteIds || [],
            babyName: persistedState?.babyName || '',
          };
        }
        if (version < 31) {
          return {
            ...persistedState,
            favoriteIds: persistedState?.favoriteIds || [],
            babyName: persistedState?.babyName || '',
          };
        }
        if (version < 32) {
          return {
            ...persistedState,
            babyName: persistedState?.babyName || '',
          };
        }
        // v33: 6-8 月龄改为 1-2 餐辅食模式，清空旧的三餐数据强制重新生成
        if (version < 33) {
          return {
            ...persistedState,
            weeklyPlan: null,
          };
        }
        // v35: 9-11 月龄改为复合主食模式，清空旧数据
        if (version < 35) {
          return {
            ...persistedState,
            weeklyPlan: null,
          };
        }
        // v36: 新增 foodRecords、feedingMonth
        if (version < 36) {
          return {
            ...persistedState,
            foodRecords: persistedState?.foodRecords || [],
            feedingMonth: persistedState?.feedingMonth || 6,
          };
        }
        // v37: 新增宝宝成长档案（babies、currentBabyId）
        // 迁移已有用户：如果已有 babyAge 设置，自动生成一个宝宝档案
        if (version < 37) {
          const babies: BabyProfile[] = persistedState?.babies || [];
          let currentBabyId: string | null = persistedState?.currentBabyId || null;

          // 如果有旧数据但没有宝宝档案，自动创建
          if (babies.length === 0 && persistedState?.settings?.babyAge) {
            const birthDate = estimateBirthDateFromAgeGroup(persistedState.settings.babyAge);
            const id = generateBabyId();
            const nickname = persistedState?.babyName || undefined;
            babies.push({ id, birthDate, ...(nickname ? { nickname } : {}) });
            currentBabyId = id;
          }

          return {
            ...persistedState,
            babies,
            currentBabyId,
          };
        }
        return persistedState;
      },
    }
  )
);
