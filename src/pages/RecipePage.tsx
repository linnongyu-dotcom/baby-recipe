import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ChefHat, Settings, Download, ChevronDown } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { DAYS_OF_WEEK, DAY_LABELS, DayOfWeek, MealType, AGE_GROUP_LABELS, DISH_TYPE_LABELS, AgeGroup } from '@/types';

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
  const { weeklyPlan, settings, regenerateMeal, regenerateDish, removeDish, swapMeals, setCustomMeal } = useStore();

  if (!weeklyPlan) {
    navigate('/setup');
    return null;
  }

  const handleDownload = () => {
    if (!weeklyPlan) return;

    const MEAL_LABELS: Record<MealType, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
    let text = '宝宝一周营养食谱\n';
    text += `宝宝年龄：${ageLabel}\n`;
    text += `生成日期：${new Date().toLocaleDateString('zh-CN')}\n`;
    text += '='.repeat(40) + '\n\n';

    for (const day of DAYS_OF_WEEK) {
      const dayPlan = weeklyPlan[day];
      text += `【${DAY_LABELS[day]}】\n`;
      for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
        const mealPlan = dayPlan[meal];
        text += `  ${MEAL_LABELS[meal]}（${mealPlan.dishes.length}道菜）：\n`;
        for (const dish of mealPlan.dishes) {
          text += `    - ${dish.name}`;
          const ingredients = dish.ingredients.map(i => `${i.name}${i.amount}`).join('、');
          text += ` | 食材：${ingredients}`;
          text += ` | 做法：${dish.steps.join(' → ')}\n`;
        }
      }
      text += '\n';
    }

    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `宝宝食谱_${ageLabel}_${new Date().toLocaleDateString('zh-CN')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ageLabel = settings.babyAge ? AGE_GROUP_LABELS[settings.babyAge] : '';
  const [showNutritionGuide, setShowNutritionGuide] = useState(false);

  const nutritionGuide = settings.babyAge ? getNutritionGuide(settings.babyAge) : null;

  // 计算一天营养统计
  const getDayNutritionSummary = (day: DayOfWeek) => {
    const dayPlan = weeklyPlan[day];
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
        {/* 标题栏 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ChefHat className="w-8 h-8 text-purple-500" />
              一周营养食谱
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              宝宝年龄：{ageLabel} · 共 7 天 × 3 餐 = 21 餐
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => navigate('/setup')} variant="outline" size="sm">
              <Settings className="w-4 h-4" />
              重新设置
            </Button>
            <Button onClick={handleDownload} variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              下载食谱
            </Button>
          </div>
        </motion.div>

        {/* 营养科学指南 */}
        {nutritionGuide && (
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-3 bg-white/40 backdrop-blur rounded-xl border border-gray-100"
        >
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>💡 点击菜品展开食材做法</span>
            <span>🔄 换单道菜</span>
            <span>✕ 删除菜品</span>
            <span>💡 食材灵感</span>
            <span>📝 自定义</span>
            <span>⇅ 午晚餐互换</span>
          </div>
        </motion.div>

        {/* 一周食谱 */}
        <div className="space-y-6">
          {DAYS_OF_WEEK.map((day, dayIndex) => {
            const dayPlan = weeklyPlan[day];
            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIndex * 0.05 }}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                {/* 日期标题 */}
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

                {/* 早中晚三餐 */}
                <div className="grid md:grid-cols-3 gap-4">
                  <RecipeCard
                    mealPlan={dayPlan.breakfast}
                    mealType="breakfast"
                    day={day}
                    onRefresh={() => regenerateMeal(day, 'breakfast')}
                    onReplaceDish={(idx) => regenerateDish(day, 'breakfast', idx)}
                    onRemoveDish={(idx) => removeDish(day, 'breakfast', idx)}
                    onInspiration={(recipe) =>
                      setCustomMeal(day, 'breakfast', { dishes: [...dayPlan.breakfast.dishes, recipe] })
                    }
                    onCustom={(plan) => setCustomMeal(day, 'breakfast', plan)}
                  />
                  <div className="space-y-2">
                    <RecipeCard
                      mealPlan={dayPlan.lunch}
                      mealType="lunch"
                      day={day}
                      onRefresh={() => regenerateMeal(day, 'lunch')}
                      onReplaceDish={(idx) => regenerateDish(day, 'lunch', idx)}
                      onRemoveDish={(idx) => removeDish(day, 'lunch', idx)}
                      onInspiration={(recipe) =>
                        setCustomMeal(day, 'lunch', { dishes: [...dayPlan.lunch.dishes, recipe] })
                      }
                      onSwap={() => swapMeals(day)}
                      onCustom={(plan) => setCustomMeal(day, 'lunch', plan)}
                    />
                  </div>
                  <div className="space-y-2">
                    <RecipeCard
                      mealPlan={dayPlan.dinner}
                      mealType="dinner"
                      day={day}
                      onRefresh={() => regenerateMeal(day, 'dinner')}
                      onReplaceDish={(idx) => regenerateDish(day, 'dinner', idx)}
                      onRemoveDish={(idx) => removeDish(day, 'dinner', idx)}
                      onInspiration={(recipe) =>
                        setCustomMeal(day, 'dinner', { dishes: [...dayPlan.dinner.dishes, recipe] })
                      }
                      onSwap={() => swapMeals(day)}
                      onCustom={(plan) => setCustomMeal(day, 'dinner', plan)}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 底部提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-center text-gray-500 text-sm"
        >
          <p>💡 点击菜品查看详细做法，点击 🔄 换单道菜，点击"全部换一换"刷新整餐</p>
          <p className="mt-1">📝 点击"添加自定义"可以输入自己的菜谱</p>
        </motion.div>
      </div>
    </div>
  );
}