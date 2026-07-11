import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lightbulb, Check } from 'lucide-react';
import { Recipe, DISH_TYPE_LABELS } from '@/types';
import { useStore } from '@/store/useStore';
import { findRecipesByIngredients } from '@/utils/recipeGenerator';

interface IngredientInspirationProps {
  onSelect: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function IngredientInspiration({ onSelect, onCancel }: IngredientInspirationProps) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { settings, customRecipes } = useStore();

  const handleSearch = () => {
    if (!input.trim() || !settings.babyAge) return;
    const ingredients = input.split(/[,，、\s]+/).filter(Boolean);
    const found = findRecipesByIngredients(settings, customRecipes, ingredients);
    setResults(found);
    setSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleConfirm = () => {
    const recipe = results.find(r => r.id === selectedId);
    if (recipe) onSelect(recipe);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        输入家里现有的食材，系统帮你匹配最合适的宝宝食谱（支持多个食材，用逗号或空格分隔）
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：胡萝卜、鸡蛋、西兰花"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
          autoFocus
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSearch}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors flex items-center gap-1.5"
        >
          <Search className="w-4 h-4" />
          搜索
        </motion.button>
      </div>

      <AnimatePresence>
        {searched && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            {results.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">没有找到匹配的食谱</p>
                <p className="text-xs mt-1">试试输入更常见的食材，或调整年龄设置</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400">
                  找到 {results.length} 个匹配食谱，点击选择后确认
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {results.slice(0, 20).map((recipe) => (
                    <motion.div
                      key={recipe.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => setSelectedId(selectedId === recipe.id ? null : recipe.id)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                        selectedId === recipe.id
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-gray-50 border-gray-100 hover:bg-purple-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 text-sm truncate">
                            {recipe.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {DISH_TYPE_LABELS[recipe.dishType]} · {recipe.mainIngredients.join('、')}
                          </div>
                        </div>
                        {selectedId === recipe.id && (
                          <Check className="w-4 h-4 text-purple-500 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={!selectedId}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 ${
                      selectedId
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4" />
                    设为这道菜
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}