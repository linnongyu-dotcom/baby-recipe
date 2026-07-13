import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ChefHat, Settings, Download, ChevronDown, Loader2, Share2, Check } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { DAYS_OF_WEEK, DAY_LABELS, DayOfWeek, AGE_GROUP_LABELS, AgeGroup, WeeklyPlan } from '@/types';
import { downloadRecipePDF } from '@/utils/pdfGenerator';
import { encodeShareData, decodeShareData } from '@/utils/shareUtils';

interface NutritionGuide {
  title: string;
  dailyNeeds: string[];
  tips: string[];
  avoid: string[];
}

function getNutritionGuide(age: AgeGroup): NutritionGuide {
  const guides: Record<AgeGroup, NutritionGuide> = {
    '6-8m': {
      title: '6-8个月 辅食添加初期',
      dailyNeeds: [
        '奶量：600-800ml/天（母乳或配方奶为主）',
        '辅食：1-2餐，从1勺开始逐步加量',
        '铁强化米粉为首选，逐步添加单一食材泥',
        '每次只添加一种新食物，观察3-5天',
      ],
      tips: [
        '食物形态：细腻泥糊状，无颗粒',
        '不加盐、糖、蜂蜜、酱油',
        '优先补铁：高铁米粉、红肉泥、肝泥',
        '蛋黄从1/4个开始，逐步增至1个',
      ],
      avoid: ['蜂蜜（肉毒杆菌风险）', '整颗坚果', '盐和糖', '鲜牛奶', '果汁'],
    },
    '9-11m': {
      title: '9-11个月 咀嚼练习期',
      dailyNeeds: [
        '奶量：600ml/天',
        '辅食：2-3餐，逐步过渡到碎末状',
        '每日谷物40-70g、蔬菜40-50g、水果40-50g',
        '每日肉/鱼/禽25-50g、蛋黄1个',
      ],
      tips: [
        '食物形态：碎末、小颗粒，锻炼咀嚼',
        '可添加少量植物油（2-5g/天）',
        '鼓励宝宝自己用手抓食物',
        '逐步引入手指食物（蒸熟的蔬菜条）',
      ],
      avoid: ['蜂蜜', '整颗坚果', '盐和糖', '鲜牛奶', '容易呛噎的食物'],
    },
    '1-2y': {
      title: '1-2岁 自主进食期',
      dailyNeeds: [
        '奶量：400-500ml/天',
        '三餐两点，定时定量',
        '每日谷物50-100g、蔬菜50-100g、水果50-100g',
        '每日肉/鱼/禽50-75g、蛋1个',
      ],
      tips: [
        '食物形态：软饭、碎菜、小肉丁',
        '少盐少油（盐<1.5g/天，油10-15g/天）',
        '培养自主进食，不追喂',
        '奶类可选配方奶、纯牛奶、酸奶',
      ],
      avoid: ['整颗坚果', '果冻', '大块硬食物', '含糖饮料', '蜂蜜'],
    },
    '2-3y': {
      title: '2-3岁 规律饮食期',
      dailyNeeds: [
        '奶量：350-500ml/天',
        '三餐两点，与家人共餐',
        '每日谷物75-125g、蔬菜100-150g、水果100-150g',
        '每日肉/鱼/禽50-75g、蛋1个',
      ],
      tips: [
        '食物形态：接近成人，但仍需切小',
        '清淡少盐（盐<2g/天）',
        '鼓励多样化饮食，不挑食',
        '培养餐桌礼仪，定时定点就餐',
      ],
      avoid: ['整颗坚果（可磨粉）', '果冻', '含糖饮料', '过多零食'],
    },
    '3-4y': {
      title: '3-4岁 多样化饮食期',
      dailyNeeds: [
        '奶量：300-400ml/天',
        '三餐一点，食物多样化',
        '每日谷物100-150g、蔬菜150-200g、水果150-200g',
        '每日肉/鱼/禽50-75g、蛋1个',
      ],
      tips: [
        '食物形态：正常饮食，注意切块大小',
        '盐<3g/天，油20-25g/天',
        '每天食物种类达12种以上',
        '鼓励参与食物制作，增加兴趣',
      ],
      avoid: ['整颗坚果（需监督）', '果冻', '含糖饮料', '暴饮暴食'],
    },
  };
  return guides[age];
}

export function RecipePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const store = useStore();
  const { weeklyPlan, settings, babyName, regenerateMeal, regenerateDish, removeDish, swapMeals, setCustomMeal, addDish } = store;

  const shareParam = searchParams.get('share');
  const [sharedData, setSharedData] = useState<{ weeklyPlan: WeeklyPlan; ageLabel: string } | null>(null);
  const [showNutritionGuide, setShowNutritionGuide] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);

  useEffect(() => {
    if (shareParam) {
      const decoded = decodeShareData(shareParam);
      if (decoded) setSharedData(decoded);
    }
  }, [shareParam]);

  const isShareMode = !!sharedData;
  const displayPlan = sharedData?.weeklyPlan || weeklyPlan;
  const displayAgeLabel = sharedData?.ageLabel || (settings.babyAge ? AGE_GROUP_LABELS[settings.babyAge] : '');

  const todayDay = useMemo((): DayOfWeek => {
    const jsDay = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
      5: 'friday', 6: 'saturday', 0: 'sunday',
    };
    return map[jsDay];
  }, []);

  if (!weeklyPlan && !isShareMode) {
    navigate('/setup');
    return null;
  }

  const handleShare = async () => {
    if (!weeklyPlan) return;
    const ageLabel = settings.babyAge ? AGE_GROUP_LABELS[settings.babyAge] : '宝宝';
    const encoded = encodeShareData(weeklyPlan, ageLabel);
    const url = `${window.location.origin}/recipe?share=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      prompt('复制以下链接分享给家人：', url);
    }
  };

  const handleDownload = async () => {
    if (!displayPlan) return;
    setDownloading(true);
    try {
      await downloadRecipePDF(displayPlan, settings.babyAge);
    } catch (e) {
      console.error('PDF生成失败', e);
      alert('PDF生成失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  const nutritionGuide = settings.babyAge ? getNutritionGuide(settings.babyAge) : null;

  // 计算一天营养统计
  const getDayNutritionSummary = (day: DayOfWeek) => {
    const dayPlan = displayPlan[day];
    if (!dayPlan || !dayPlan.breakfast || !dayPlan.lunch || !dayPlan.dinner) {
      return '0道菜';
    }
    const allDishes = [
      ...(dayPlan.breakfast.dishes || []),
      ...(dayPlan.lunch.dishes || []),
      ...(dayPlan.dinner.dishes || []),
    ];
    return `${allDishes.length}道菜`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 分享模式提示 */}
        {isShareMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between"
          >
            <div>
              <p className="font-semibold text-green-800">📋 家人分享的宝宝食谱</p>
              <p className="text-sm text-green-600">{displayAgeLabel}</p>
            </div>
            <p className="text-xs text-green-500">只读模式 · 仅供参考</p>
          </motion.div>
        )}

        {/* 标题栏 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
        >
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ChefHat className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 flex-shrink-0" />
              {babyName && !isShareMode && <span className="text-purple-600 truncate">{babyName} </span>}
              <span className="whitespace-nowrap">{isShareMode ? '分享食谱' : '一周营养食谱'}</span>
            </h1>
            <p className="text-gray-600 mt-1 text-xs sm:text-sm">
              {displayAgeLabel} · 共 7 天 × 3 餐 = 21 餐
            </p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {!isShareMode && (
              <>
                <Button onClick={() => navigate('/setup')} variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                  设置
                </Button>
                <Button onClick={handleShare} variant="outline" size="sm">
                  {shareCopied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                  {shareCopied ? '已复制' : '分享'}
                </Button>
              </>
            )}
            <Button onClick={handleDownload} variant="secondary" size="sm" disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? '生成中…' : '下载'}
            </Button>
          </div>
        </motion.div>

        {/* 营养科学指南 */}
        {!isShareMode && nutritionGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 bg-white/60 backdrop-blur rounded-xl border border-purple-100 overflow-hidden"
          >
            <button
              onClick={() => setShowNutritionGuide(!showNutritionGuide)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-purple-50/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <span className="font-semibold text-gray-800">{nutritionGuide.title} 营养科学指南</span>
              </div>
              <motion.div
                animate={{ rotate: showNutritionGuide ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showNutritionGuide && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-purple-600 mb-2">每日营养需求</h4>
                      <ul className="space-y-1">
                        {nutritionGuide.dailyNeeds.map((item, i) => (
                          <li key={i} className="text-sm text-gray-600 flex gap-2">
                            <span className="text-purple-400">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-orange-600 mb-2">喂养建议</h4>
                      <ul className="space-y-1">
                        {nutritionGuide.tips.map((item, i) => (
                          <li key={i} className="text-sm text-gray-600 flex gap-2">
                            <span className="text-orange-400">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2">避免食用</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {nutritionGuide.avoid.map((item, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs">
                            ✕ {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 快捷说明 */}
        {!isShareMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-3 bg-white/40 backdrop-blur rounded-xl border border-gray-100"
        >
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>💡 点击菜品展开食材做法</span>
            <span>🔄 换单道菜</span>
            <span>✕ 删除菜品</span>
            <span>⇅ 午晚餐互换</span>
          </div>
        </motion.div>
        )}

        {/* 今日推荐 */}
        {displayPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🍽</span>
              <h2 className="text-xl font-semibold text-gray-800">今日推荐</h2>
              <span className="text-sm text-gray-500">{DAY_LABELS[todayDay]}</span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <RecipeCard
                mealPlan={displayPlan[todayDay].breakfast}
                mealType="breakfast"
                onRefresh={() => regenerateMeal(todayDay, 'breakfast')}
                onReplaceDish={(idx) => regenerateDish(todayDay, 'breakfast', idx)}
                onRemoveDish={(idx) => removeDish(todayDay, 'breakfast', idx)}
                onInspiration={(recipe) =>
                  setCustomMeal(todayDay, 'breakfast', { dishes: [...displayPlan[todayDay].breakfast.dishes, recipe] })
                }
                onAddDish={(recipe) => addDish(todayDay, 'breakfast', recipe)}
                readOnly={isShareMode}
              />
              <div className="space-y-2">
                <RecipeCard
                  mealPlan={displayPlan[todayDay].lunch}
                  mealType="lunch"
                  onRefresh={() => regenerateMeal(todayDay, 'lunch')}
                  onReplaceDish={(idx) => regenerateDish(todayDay, 'lunch', idx)}
                  onRemoveDish={(idx) => removeDish(todayDay, 'lunch', idx)}
                  onInspiration={(recipe) =>
                    setCustomMeal(todayDay, 'lunch', { dishes: [...displayPlan[todayDay].lunch.dishes, recipe] })
                  }
                  onSwap={() => swapMeals(todayDay)}
                  onAddDish={(recipe) => addDish(todayDay, 'lunch', recipe)}
                  readOnly={isShareMode}
                />
              </div>
              <div className="space-y-2">
                <RecipeCard
                  mealPlan={displayPlan[todayDay].dinner}
                  mealType="dinner"
                  onRefresh={() => regenerateMeal(todayDay, 'dinner')}
                  onReplaceDish={(idx) => regenerateDish(todayDay, 'dinner', idx)}
                  onRemoveDish={(idx) => removeDish(todayDay, 'dinner', idx)}
                  onInspiration={(recipe) =>
                    setCustomMeal(todayDay, 'dinner', { dishes: [...displayPlan[todayDay].dinner.dishes, recipe] })
                  }
                  onSwap={() => swapMeals(todayDay)}
                  onAddDish={(recipe) => addDish(todayDay, 'dinner', recipe)}
                  readOnly={isShareMode}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* 本周推荐 折叠 */}
        {displayPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6 bg-white/60 backdrop-blur rounded-2xl border border-purple-100 overflow-hidden shadow-sm"
          >
            <button
              onClick={() => setShowWeeklyPlan(!showWeeklyPlan)}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-purple-50/50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <span className="font-semibold text-gray-800 text-lg">本周推荐</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  已为宝宝准备好本周食谱，点击即可查看
                </p>
              </div>
              <motion.div
                animate={{ rotate: showWeeklyPlan ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showWeeklyPlan && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-6 border-t border-gray-100 pt-5">
                    {DAYS_OF_WEEK.map((day, dayIndex) => {
                      const dayPlan = displayPlan[day];
                      return (
                        <motion.div
                          key={day}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: dayIndex * 0.03 }}
                          className="bg-white rounded-xl p-5 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                              <span className="w-8 h-8 bg-gradient-to-r from-purple-400 to-purple-500 text-white rounded-full flex items-center justify-center text-sm">
                                {dayIndex + 1}
                              </span>
                              {DAY_LABELS[day]}
                              <span className="text-sm text-gray-500 font-normal">
                                ({getDayNutritionSummary(day)})
                              </span>
                            </h2>
                          </div>
                          <div className="grid md:grid-cols-3 gap-4">
                            <RecipeCard
                              mealPlan={dayPlan.breakfast}
                              mealType="breakfast"
                              onRefresh={() => regenerateMeal(day, 'breakfast')}
                              onReplaceDish={(idx) => regenerateDish(day, 'breakfast', idx)}
                              onRemoveDish={(idx) => removeDish(day, 'breakfast', idx)}
                              onInspiration={(recipe) =>
                                setCustomMeal(day, 'breakfast', { dishes: [...dayPlan.breakfast.dishes, recipe] })
                              }
                              onAddDish={(recipe) => addDish(day, 'breakfast', recipe)}
                              readOnly={isShareMode}
                            />
                            <div className="space-y-2">
                              <RecipeCard
                                mealPlan={dayPlan.lunch}
                                mealType="lunch"
                                onRefresh={() => regenerateMeal(day, 'lunch')}
                                onReplaceDish={(idx) => regenerateDish(day, 'lunch', idx)}
                                onRemoveDish={(idx) => removeDish(day, 'lunch', idx)}
                                onInspiration={(recipe) =>
                                  setCustomMeal(day, 'lunch', { dishes: [...dayPlan.lunch.dishes, recipe] })
                                }
                                onSwap={() => swapMeals(day)}
                                onAddDish={(recipe) => addDish(day, 'lunch', recipe)}
                                readOnly={isShareMode}
                              />
                            </div>
                            <div className="space-y-2">
                              <RecipeCard
                                mealPlan={dayPlan.dinner}
                                mealType="dinner"
                                onRefresh={() => regenerateMeal(day, 'dinner')}
                                onReplaceDish={(idx) => regenerateDish(day, 'dinner', idx)}
                                onRemoveDish={(idx) => removeDish(day, 'dinner', idx)}
                                onInspiration={(recipe) =>
                                  setCustomMeal(day, 'dinner', { dishes: [...dayPlan.dinner.dishes, recipe] })
                                }
                                onSwap={() => swapMeals(day)}
                                onAddDish={(recipe) => addDish(day, 'dinner', recipe)}
                                readOnly={isShareMode}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 底部提示 */}
        {!isShareMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-center text-gray-500 text-sm"
        >
          <p>💡 点击菜品查看详细做法，点击 🔄 换单道菜，点击"全部换一换"刷新整餐</p>
          <p className="mt-1">📝 点击"添加自定义"可以输入自己的菜谱</p>
        </motion.div>
        )}
      </div>
    </div>
  );
}