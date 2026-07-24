import { Recipe, NUTRITION_TAG_ICONS } from '@/types';
import { Heart } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { deriveNutritionTags } from '@/utils/mealValidator';

interface RecipeDetailProps {
  recipe: Recipe;
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const { favoriteIds, toggleFavorite } = useStore();
  const isFav = favoriteIds.includes(recipe.id);
  const nutritionTags = deriveNutritionTags(recipe);

  return (
    <div className="space-y-6">
      {/* 食谱信息 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm">
          {recipe.category}
        </span>
        {nutritionTags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs flex items-center gap-0.5"
          >
            <span className="text-[10px]">{NUTRITION_TAG_ICONS[tag]}</span>
            {tag}
          </span>
        ))}
        <button
          onClick={() => toggleFavorite(recipe.id)}
          className={`ml-auto p-2 rounded-full transition-colors ${
            isFav
              ? 'text-red-400 bg-red-50 hover:bg-red-100'
              : 'text-gray-300 hover:text-red-300 hover:bg-red-50'
          }`}
          title={isFav ? '取消收藏' : '收藏'}
        >
          <Heart className="w-5 h-5" fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* 营养价值 */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
        <h4 className="font-medium text-gray-800 mb-2">💡 营养价值</h4>
        <p className="text-gray-600">{recipe.nutrition}</p>
      </div>

      {/* 食材清单 */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-lg">🥗</span>
          食材清单
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {recipe.ingredients.map((ingredient, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
            >
              <span className="text-gray-700">{ingredient.name}</span>
              <span className="text-gray-500 text-sm">{ingredient.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 烹饪步骤 */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-lg">👨‍🍳</span>
          烹饪步骤
        </h4>
        <div className="space-y-3">
          {recipe.steps.map((step, index) => (
            <div
              key={index}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <p className="text-gray-600 flex-1">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}