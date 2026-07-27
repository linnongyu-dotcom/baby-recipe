import { Recipe, NUTRITION_TAG_ICONS, NUTRITION_VALUE_TAGS, COOKING_METHOD_TAGS } from '@/types';
import { Heart } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { deriveNutritionTags } from '@/utils/mealValidator';

interface RecipeDetailProps {
  recipe: Recipe;
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const { favoriteIds, toggleFavorite } = useStore();
  const isFav = favoriteIds.includes(recipe.id);
  const allTags = deriveNutritionTags(recipe);

  // 分组：营养特点（最多3个）+ 制作特点（最多2个）
  const nutritionTags = allTags.filter(t => NUTRITION_VALUE_TAGS.includes(t)).slice(0, 3);
  const cookingTags = allTags.filter(t => COOKING_METHOD_TAGS.includes(t)).slice(0, 2);

  return (
    <div className="space-y-6">
      {/* 食谱信息 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm">
          {recipe.category}
        </span>
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

      {/* 营养特点 */}
      {nutritionTags.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="text-base">🥗</span>
            营养特点
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {nutritionTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-sm flex items-center gap-1"
              >
                <span>{NUTRITION_TAG_ICONS[tag]}</span>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 制作特点 */}
      {cookingTags.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="text-base">👨‍🍳</span>
            制作特点
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {cookingTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-sm flex items-center gap-1"
              >
                <span>{NUTRITION_TAG_ICONS[tag]}</span>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

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