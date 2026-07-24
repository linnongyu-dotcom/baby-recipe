import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ArrowUpDown, Plus, Eye, X, Lightbulb, Heart } from 'lucide-react';
import { Recipe, MealType, MealPlan, AgeGroup, NUTRITION_TAG_ICONS } from '@/types';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { RecipeDetail } from './RecipeDetail';
import { AddDishModal } from './AddDishModal';
import { IngredientInspiration } from './IngredientInspiration';
import { useStore } from '@/store/useStore';
import { deriveNutritionTags } from '@/utils/mealValidator';

interface RecipeCardProps {
  mealPlan: MealPlan;
  mealType: MealType;
  ageGroup?: AgeGroup;
  onRefresh: () => void;
  onReplaceDish: (dishIndex: number) => void;
  onRemoveDish: (dishIndex: number) => void;
  onSwap?: () => void;
  onAddDish: (recipe: Recipe) => void;
  onInspiration: (recipe: Recipe) => void;
  readOnly?: boolean;
  /** 可选餐次标题，覆盖默认的"早餐/午餐/晚餐" */
  mealTitle?: string;
  /** 可选餐次图标，配合 mealTitle 使用 */
  mealEmoji?: string;
}

export function RecipeCard({
  mealPlan,
  mealType,
  ageGroup: _ageGroup,
  onRefresh,
  onReplaceDish,
  onRemoveDish,
  onSwap,
  onAddDish,
  onInspiration,
  readOnly,
  mealTitle,
  mealEmoji,
}: RecipeCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showAddDish, setShowAddDish] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { favoriteIds, toggleFavorite } = useStore();

  const mealIcon = mealEmoji || (mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : '🌙');
  const mealLabel = mealTitle || (mealType === 'breakfast' ? '早餐' : mealType === 'lunch' ? '午餐' : '晚餐');

  const handleViewDetail = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowDetail(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* 餐次标题 */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{mealIcon}</span>
            <h3 className="text-lg font-semibold text-gray-800">{mealLabel}</h3>
          </div>
          {onSwap && mealType !== 'breakfast' && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onSwap}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              title="午晚餐互换"
            >
              <ArrowUpDown className="w-4 h-4" />
            </motion.button>
          )}
        </div>

        {/* 菜品列表 */}
        <div className="space-y-1.5 mb-4">
          {mealPlan.dishes.map((recipe) => {
                const isExpanded = expandedIds.has(recipe.id);
                const globalIndex = mealPlan.dishes.indexOf(recipe);
                const nutritionTags = deriveNutritionTags(recipe);
                return (
                  <div
                    key={recipe.id}
                    className="bg-gray-50 rounded-lg overflow-hidden ml-5"
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 p-2 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(recipe.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">
                          {recipe.name}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {nutritionTags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-xs flex items-center gap-0.5"
                            >
                              <span className="text-[10px]">{NUTRITION_TAG_ICONS[tag]}</span>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!readOnly && (<>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReplaceDish(globalIndex);
                        }}
                        className="p-1 rounded hover:bg-orange-100 text-orange-500 flex-shrink-0"
                        title="换一道"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(recipe);
                        }}
                        className="p-1 rounded hover:bg-purple-100 text-purple-500 flex-shrink-0"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveDish(globalIndex);
                        }}
                        className="p-1 rounded hover:bg-red-100 text-red-400 flex-shrink-0"
                        title="删除"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                      </>)}
                      {readOnly && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(recipe);
                          }}
                          className="p-1 rounded hover:bg-purple-100 text-purple-500 flex-shrink-0"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.8 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(recipe.id);
                        }}
                        className={`p-1 rounded flex-shrink-0 transition-colors ${
                          favoriteIds.includes(recipe.id)
                            ? 'text-red-400 hover:bg-red-50'
                            : 'text-gray-300 hover:text-red-300 hover:bg-red-50'
                        }`}
                        title={favoriteIds.includes(recipe.id) ? '取消收藏' : '收藏'}
                      >
                        <Heart className="w-3.5 h-3.5" fill={favoriteIds.includes(recipe.id) ? 'currentColor' : 'none'} />
                      </motion.button>
                    </motion.div>

                    {/* 展开的做法 */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-200 bg-white"
                        >
                          <div className="p-3 space-y-3 text-sm">
                            {/* 食材 */}
                            <div>
                              <div className="font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                                🥗 食材
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {recipe.ingredients.map((ing, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                                  >
                                    {ing.name} {ing.amount}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* 做法 */}
                            <div>
                              <div className="font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                                👨‍🍳 做法
                              </div>
                              <ol className="space-y-1 text-gray-600 pl-1">
                                {recipe.steps.map((step, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-purple-500 font-medium flex-shrink-0">
                                      {i + 1}.
                                    </span>
                                    <span className="flex-1">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
          </div>

        {/* 操作按钮 */}
        {!readOnly && (
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-gradient-to-r from-orange-100 to-orange-200 text-orange-600 rounded-lg text-sm hover:from-orange-200 hover:to-orange-300 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            全部换
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddDish(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-gradient-to-r from-green-100 to-green-200 text-green-600 rounded-lg text-sm hover:from-green-200 hover:to-green-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加菜品
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowInspiration(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-600 rounded-lg text-sm hover:from-purple-200 hover:to-purple-300 transition-all"
          >
            <Lightbulb className="w-4 h-4" />
            食材找食谱
          </motion.button>
        </div>
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title={selectedRecipe?.name}
      >
        {selectedRecipe && <RecipeDetail recipe={selectedRecipe} />}
      </Modal>

      {/* 添加菜品弹窗 */}
      <Modal
        isOpen={showAddDish}
        onClose={() => setShowAddDish(false)}
        title="添加菜品"
      >
        <AddDishModal
          onAdd={(recipe) => {
            onAddDish(recipe);
            setShowAddDish(false);
          }}
          onCancel={() => setShowAddDish(false)}
          usedIds={new Set(mealPlan.dishes.map(d => d.id))}
        />
      </Modal>

      {/* 食材找食谱弹窗 */}
      <Modal
        isOpen={showInspiration}
        onClose={() => setShowInspiration(false)}
        title="食材找食谱"
      >
        <IngredientInspiration
          onSelect={(recipe) => {
            onInspiration(recipe);
            setShowInspiration(false);
          }}
          onCancel={() => setShowInspiration(false)}
        />
      </Modal>
    </>
  );
}
