import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Search, ChefHat, Heart } from 'lucide-react';
import { Recipe, DishType, DISH_TYPE_LABELS, DISH_TYPE_ICONS, UserSettings, FoodRecord } from '@/types';
import { recipes } from '@/data/recipes';
import { createCustomRecipe } from '@/utils/recipeGenerator';
import { Button } from '@/components/common/Button';
import { useStore } from '@/store/useStore';

interface AddDishModalProps {
  onAdd: (recipe: Recipe) => void;
  onCancel: () => void;
  usedIds: Set<string>;
}

type Step = 'category' | 'recommend' | 'custom';

const CATEGORIES: { type: DishType; icon: string; label: string; color: string }[] = [
  { type: 'staple', icon: '🍚', label: '主食', color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { type: 'meat', icon: '🍖', label: '荤菜', color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
  { type: 'vegetable', icon: '🥬', label: '素菜', color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { type: 'soup', icon: '🍲', label: '汤品', color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { type: 'egg', icon: '🥚', label: '蛋类', color: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' },
  { type: 'dessert', icon: '🍮', label: '点心', color: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100' },
];

function filterAvailable(dishType: DishType, settings: UserSettings, usedIds: Set<string>, customRecipes: Recipe[]): Recipe[] {
  const { babyAge, allergies, dislikes } = settings;
  if (!babyAge) return [];

  const allRecipes = [...recipes, ...customRecipes];

  return allRecipes.filter(r => {
    if (r.dishType !== dishType) return false;
    if (!r.ageGroups.includes(babyAge)) return false;
    if (usedIds.has(r.id)) return false;
    if (allergies.length > 0 && r.mainIngredients.some(ing =>
      allergies.some(a => ing.includes(a) || a.includes(ing))
    )) return false;
    if (dislikes.length > 0 && (
      r.ingredients.some(ing =>
        dislikes.some(d => ing.name.includes(d) || d.includes(ing.name))
      ) ||
      r.mainIngredients.some(ing =>
        dislikes.some(d => ing.includes(d) || d.includes(ing))
      )
    )) return false;
    return true;
  });
}

// 计算食谱与宝宝已接受食材的匹配度
function scoreByAcceptedFoods(recipe: Recipe, acceptedFoodNames: string[]): number {
  if (acceptedFoodNames.length === 0) return 0;
  let score = 0;
  for (const ing of recipe.mainIngredients) {
    if (acceptedFoodNames.some(f => ing.includes(f) || f.includes(ing))) {
      score += 1;
    }
  }
  return score;
}

export function AddDishModal({ onAdd, onCancel, usedIds }: AddDishModalProps) {
  const { settings, customRecipes, addCustomRecipe, favoriteIds, toggleFavorite, foodRecords } = useStore();
  const [step, setStep] = useState<Step>('category');
  const [selectedType, setSelectedType] = useState<DishType>('meat');
  const [searchText, setSearchText] = useState('');
  const [listMode, setListMode] = useState<'all' | 'favorites'>('all');

  const [customName, setCustomName] = useState('');
  const [customIngredients, setCustomIngredients] = useState('');
  const [customSteps, setCustomSteps] = useState('');

  // 已接受的食材名称
  const acceptedFoodNames = useMemo(() => {
    return foodRecords
      .filter(r => r.status === 'accepted')
      .map(r => r.name);
  }, [foodRecords]);

  const availableRecipes = useMemo(
    () => {
      const filtered = filterAvailable(selectedType, settings, usedIds, customRecipes);
      // 按已接受食材匹配度排序：匹配度高的优先
      if (acceptedFoodNames.length > 0) {
        return [...filtered].sort(
          (a, b) => scoreByAcceptedFoods(b, acceptedFoodNames) - scoreByAcceptedFoods(a, acceptedFoodNames)
        );
      }
      return filtered;
    },
    [selectedType, settings, usedIds, customRecipes, acceptedFoodNames]
  );

  const favRecipes = useMemo(() => {
    if (listMode !== 'favorites') return [];
    const allRecipes = [...recipes, ...customRecipes];
    const { babyAge, allergies, dislikes } = settings;
    if (!babyAge) return [];
    return allRecipes.filter(r => {
      if (r.dishType !== selectedType) return false;
      if (!r.ageGroups.includes(babyAge)) return false;
      if (!favoriteIds.includes(r.id)) return false;
      if (allergies.length > 0 && r.mainIngredients.some(ing =>
        allergies.some(a => ing.includes(a) || a.includes(ing))
      )) return false;
      if (dislikes.length > 0 && (
        r.ingredients.some(ing =>
          dislikes.some(d => ing.name.includes(d) || d.includes(ing.name))
        ) ||
        r.mainIngredients.some(ing =>
          dislikes.some(d => ing.includes(d) || d.includes(ing))
        )
      )) return false;
      return true;
    });
  }, [listMode, selectedType, settings, favoriteIds, customRecipes]);

  const displayRecipes = useMemo(() => {
    const pool = listMode === 'favorites' ? favRecipes : availableRecipes;
    if (!searchText.trim()) return pool;
    const q = searchText.toLowerCase();
    return pool.filter(r =>
      r.name.includes(q) || r.mainIngredients.some(i => i.includes(q))
    );
  }, [favRecipes, availableRecipes, searchText, listMode]);

  const favAvailableCount = useMemo(
    () => favRecipes.length,
    [favRecipes]
  );

  const filteredRecipes = displayRecipes;

  const handleCategorySelect = (type: DishType) => {
    setSelectedType(type);
    setStep('recommend');
    setSearchText('');
    setListMode('all');
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    onAdd(recipe);
  };

  const handleCustomSave = () => {
    if (!customName.trim()) {
      alert('请填写菜名');
      return;
    }
    if (!settings.babyAge) {
      alert('请先设置宝宝年龄');
      return;
    }
    const recipe = createCustomRecipe(
      customName,
      customIngredients,
      customSteps,
      settings.babyAge,
      selectedType
    );
    addCustomRecipe(recipe);
    onAdd(recipe);
  };

  return (
    <div className="min-h-[400px] max-h-[70vh] flex flex-col">
      {/* 类别选择 */}
      {step === 'category' && (
        <>
          <p className="text-sm text-gray-500 mb-4">选择要添加的菜品类型</p>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => {
              const count = filterAvailable(cat.type, settings, usedIds, customRecipes).length;
              return (
                <motion.button
                  key={cat.type}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleCategorySelect(cat.type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${cat.color}`}
                >
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="font-medium">{cat.label}</span>
                  <span className="text-xs opacity-60">系统{count}道可选</span>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              选择一个分类后，可以选用系统推荐或自己输入
            </p>
          </div>
        </>
      )}

      {/* 系统推荐 */}
      {step === 'recommend' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setStep('category')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-3xl">{DISH_TYPE_ICONS[selectedType]}</span>
            <span className="font-semibold text-gray-800">{DISH_TYPE_LABELS[selectedType]}</span>
            <span className="text-sm text-gray-400">
              {listMode === 'favorites' ? favAvailableCount : availableRecipes.length} 道可选
            </span>
          </div>

          {/* 全部 / 我的喜欢 切换 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setListMode('all'); setSearchText(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                listMode === 'all'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              系统推荐
            </button>
            <button
              onClick={() => { setListMode('favorites'); setSearchText(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                listMode === 'favorites'
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={listMode === 'favorites' ? 'currentColor' : 'none'} />
              我的喜欢
              {favAvailableCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  listMode === 'favorites' ? 'bg-red-100' : 'bg-gray-200'
                }`}>
                  {favAvailableCount}
                </span>
              )}
            </button>
          </div>

          {/* 搜索 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索菜名或食材..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
          </div>

          {/* 推荐菜品列表 */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 max-h-[200px]">
            {filteredRecipes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">
                {listMode === 'favorites'
                  ? `暂无喜欢的${DISH_TYPE_LABELS[selectedType]}，点击 ❤️ 收藏喜欢的菜品吧`
                  : availableRecipes.length === 0
                    ? `当前无可用${DISH_TYPE_LABELS[selectedType]}，试试"自己输入"`
                    : '没有匹配的菜品'}
              </p>
            ) : (
              filteredRecipes.slice(0, 30).map((recipe) => {
                const matchedCount = scoreByAcceptedFoods(recipe, acceptedFoodNames);
                return (
                <div key={recipe.id} className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelectRecipe(recipe)}
                    className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 truncate">{recipe.name}</span>
                        {matchedCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-xs flex-shrink-0">
                            已尝试食材
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {recipe.mainIngredients.slice(0, 3).map((ing) => (
                          <span key={ing} className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                            {ing}
                          </span>
                        ))}
                        {recipe.mainIngredients.length > 3 && (
                          <span className="text-xs text-gray-400">+{recipe.mainIngredients.length - 3}</span>
                        )}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id); }}
                    className={`p-1.5 rounded flex-shrink-0 transition-colors ${
                      favoriteIds.includes(recipe.id)
                        ? 'text-red-400 hover:bg-red-50'
                        : 'text-gray-300 hover:text-red-300 hover:bg-red-50'
                    }`}
                    title={favoriteIds.includes(recipe.id) ? '取消收藏' : '收藏'}
                  >
                    <Heart className="w-4 h-4" fill={favoriteIds.includes(recipe.id) ? 'currentColor' : 'none'} />
                  </motion.button>
                </div>
                );
              })
            )}
          </div>

          {/* 自己输入按钮 */}
          <button
            onClick={() => {
              setCustomName('');
              setCustomIngredients('');
              setCustomSteps('');
              setStep('custom');
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all"
          >
            <ChefHat className="w-4 h-4" />
            <span className="text-sm">自己输入{DISH_TYPE_LABELS[selectedType]}</span>
          </button>
        </>
      )}

      {/* 自定义输入 */}
      {step === 'custom' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setStep('recommend')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-3xl">{DISH_TYPE_ICONS[selectedType]}</span>
            <span className="font-semibold text-gray-800">自定义{DISH_TYPE_LABELS[selectedType]}</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">菜名</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="例如：番茄炒蛋"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                食材（选填，每行一个，格式：食材名,用量）
              </label>
              <textarea
                value={customIngredients}
                onChange={(e) => setCustomIngredients(e.target.value)}
                placeholder="番茄,1个&#10;鸡蛋,2个&#10;盐,适量"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                烹饪步骤（选填，每行一步）
              </label>
              <textarea
                value={customSteps}
                onChange={(e) => setCustomSteps(e.target.value)}
                placeholder="番茄切块&#10;鸡蛋打散炒熟盛出&#10;锅中放油，炒番茄&#10;加入鸡蛋翻炒"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
            <Button onClick={handleCustomSave} variant="primary" className="flex-1">
              保存
            </Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">
              取消
            </Button>
          </div>
        </>
      )}

      {/* 底部取消（仅类别选择页） */}
      {step === 'category' && (
        <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
          <Button onClick={onCancel} variant="outline" className="flex-1">
            取消
          </Button>
        </div>
      )}
    </div>
  );
}
