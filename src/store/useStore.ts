import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings, WeeklyPlan, Recipe, DayOfWeek, MealType, MealPlan } from '../types';
import { generateWeeklyPlan, regenerateMeal, regenerateDish, swapMeals } from '../utils/recipeGenerator';

interface AppState {
  // 用户设置
  settings: UserSettings;
  // 一周食谱
  weeklyPlan: WeeklyPlan | null;
  // 是否已完成设置
  isSetupComplete: boolean;

  // 操作方法
  setBabyAge: (age: UserSettings['babyAge']) => void;
  setAllergies: (allergies: string[]) => void;
  setDislikes: (dislikes: string[]) => void;
  setLikes: (likes: string[]) => void;
  generatePlan: () => void;
  regenerateMeal: (day: DayOfWeek, mealType: MealType) => void;
  regenerateDish: (day: DayOfWeek, mealType: MealType, dishIndex: number) => void;
  removeDish: (day: DayOfWeek, mealType: MealType, dishIndex: number) => void;
  swapMeals: (day: DayOfWeek) => void;
  setCustomMeal: (day: DayOfWeek, mealType: MealType, mealPlan: MealPlan) => void;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  babyAge: null,
  allergies: [],
  dislikes: [],
  likes: [],
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      weeklyPlan: null,
      isSetupComplete: false,

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

      generatePlan: () => {
        const { settings } = get();
        if (!settings.babyAge) return;

        const plan = generateWeeklyPlan(settings);
        set({ weeklyPlan: plan, isSetupComplete: true });
      },

      regenerateMeal: (day, mealType) => {
        const { weeklyPlan, settings } = get();
        if (!weeklyPlan || !settings.babyAge) return;

        // 收集所有已使用的食谱
        const usedRecipes: Recipe[] = [];
        for (const d of Object.keys(weeklyPlan) as DayOfWeek[]) {
          usedRecipes.push(...weeklyPlan[d].breakfast.dishes);
          usedRecipes.push(...weeklyPlan[d].lunch.dishes);
          usedRecipes.push(...weeklyPlan[d].dinner.dishes);
        }

        // 重新生成
        const newMeal = regenerateMeal(settings, usedRecipes, mealType);

        set((state) => ({
          weeklyPlan: {
            ...state.weeklyPlan!,
            [day]: {
              ...state.weeklyPlan![day],
              [mealType]: newMeal,
            },
          },
        }));
      },

      regenerateDish: (day, mealType, dishIndex) => {
        const { weeklyPlan, settings } = get();
        if (!weeklyPlan || !settings.babyAge) return;

        const dayPlan = weeklyPlan[day];
        const mealPlan = dayPlan[mealType];
        const targetDish = mealPlan.dishes[dishIndex];
        if (!targetDish) return;

        // 收集整周已使用的食谱（排除当前要替换的）
        const usedRecipes: Recipe[] = [];
        for (const d of Object.keys(weeklyPlan) as DayOfWeek[]) {
          for (const m of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
            weeklyPlan[d][m].dishes.forEach((dish, idx) => {
              if (!(d === day && m === mealType && idx === dishIndex)) {
                usedRecipes.push(dish);
              }
            });
          }
        }

        const newDish = regenerateDish(settings, usedRecipes, targetDish.dishType);
        if (!newDish) return;

        const newDishes = [...mealPlan.dishes];
        newDishes[dishIndex] = newDish;

        set((state) => ({
          weeklyPlan: {
            ...state.weeklyPlan!,
            [day]: {
              ...state.weeklyPlan![day],
              [mealType]: {
                ...state.weeklyPlan![day][mealType],
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

      resetSettings: () => set({
        settings: defaultSettings,
        weeklyPlan: null,
        isSetupComplete: false,
      }),
    }),
    {
      name: 'baby-recipe-storage',
      version: 6,
      migrate: (persistedState: any, version: number) => {
        // 旧版本数据不兼容，清空重新生成
        if (version < 6) {
          return {
            settings: persistedState?.settings || defaultSettings,
            weeklyPlan: null,
            isSetupComplete: false,
          };
        }
        return persistedState;
      },
    }
  )
);