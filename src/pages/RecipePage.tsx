import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { Settings, Download, ChevronDown, Loader2, Share2, Check, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { ComplementaryFeedingPlan } from '@/components/recipe/ComplementaryFeedingPlan';
import { FoodTracker } from '@/components/recipe/FoodTracker';
import { BabySelector } from '@/components/baby/BabySelector';
import { MilkKnowledge } from '@/components/baby/MilkKnowledge';
import { DAYS_OF_WEEK, DAY_LABELS, DayOfWeek, AGE_GROUP_LABELS, AgeGroup, WeeklyPlan, FoodRecord } from '@/types';
import { calcAge, getMealLabels, getMealIcons } from '@/utils/babyProfile';
import { downloadRecipePDF } from '@/utils/pdfGenerator';
import { encodeShareData, decodeShareData } from '@/utils/shareUtils';
import { analyzeDayNutrition, analyzeWeekNutrition, generateSnacks } from '@/utils/nutritionEngine';
import { BRAND, SHARE, BRAND_ASSETS, setPageTitle } from '@/config/brand';

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
    '3-5y': {
      title: '3-5岁 多样化饮食期',
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
  const { weeklyPlan, settings, babyName, babies, currentBabyId, regenerateMeal, regenerateDish, removeDish, swapMeals, setCustomMeal, addDish,
    foodRecords, feedingMonth, addFoodRecord, setFeedingMonth } = store;

  const shareParam = searchParams.get('share');
  const [sharedData, setSharedData] = useState<{ weeklyPlan: WeeklyPlan; ageLabel: string; ageGroup?: AgeGroup } | null>(null);
  const [showNutritionGuide, setShowNutritionGuide] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // 从宝宝档案计算年龄
  const currentBaby = babies.find(b => b.id === currentBabyId);
  const babyAgeInfo = currentBaby ? calcAge(currentBaby.birthDate) : null;
  const effectiveAgeGroup = babyAgeInfo?.ageGroup ?? settings.babyAge;
  const isInfantFeeding = babyAgeInfo?.growthStage === 'infant_feeding'; // 0-5月
  const isUnderOneYear = babyAgeInfo?.isUnderOneYear ?? true;
  const mealLabels = getMealLabels(isUnderOneYear);
  const mealIcons = getMealIcons(isUnderOneYear);

  // 阶段标识
  const is6to8m = effectiveAgeGroup === '6-8m';
  const is9to11m = effectiveAgeGroup === '9-11m';
  const isTwoMeal = is6to8m || is9to11m;

  // 6-8月龄自动匹配当前月份
  useEffect(() => {
    if (is6to8m && babyAgeInfo) {
      const m = babyAgeInfo.totalMonths;
      if (m >= 6 && m <= 8) {
        setFeedingMonth(m as 6 | 7 | 8);
      }
    }
  }, [is6to8m, babyAgeInfo?.totalMonths]);

  useEffect(() => {
    if (shareParam) {
      const decoded = decodeShareData(shareParam);
      if (decoded) {
        setSharedData(decoded);
        if (decoded.ageGroup) {
          store.setBabyAge(decoded.ageGroup);
        }
      }
    }
  }, [shareParam]);

  const isShareMode = !!sharedData;

  useEffect(() => {
    if (isShareMode) {
      setPageTitle('分享食谱');
    } else if (currentBaby) {
      const name = currentBaby.nickname || '宝宝';
      setPageTitle(`${name}的食谱`);
    } else if (babyName) {
      setPageTitle(`${babyName}的食谱`);
    } else {
      setPageTitle('今日食谱');
    }
  }, [currentBaby, babyName, isShareMode]);

  const displayPlan = sharedData?.weeklyPlan || weeklyPlan;
  const displayAgeLabel = sharedData?.ageLabel || (effectiveAgeGroup ? AGE_GROUP_LABELS[effectiveAgeGroup] : '');

  const todayDay = useMemo((): DayOfWeek => {
    const jsDay = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
      5: 'friday', 6: 'saturday', 0: 'sunday',
    };
    return map[jsDay];
  }, []);

  const todayNutrition = useMemo(() => {
    if (!displayPlan || !effectiveAgeGroup) return null;
    return analyzeDayNutrition(displayPlan[todayDay], effectiveAgeGroup);
  }, [displayPlan, todayDay, effectiveAgeGroup]);

  const snackSuggestions = useMemo(() => {
    if (!effectiveAgeGroup) return null;
    return generateSnacks(effectiveAgeGroup).items;
  }, [effectiveAgeGroup]);

  const weekNutrition = useMemo(() => {
    if (!displayPlan || !effectiveAgeGroup) return null;
    return analyzeWeekNutrition(displayPlan, effectiveAgeGroup);
  }, [displayPlan, effectiveAgeGroup]);

  // 无宝宝时跳转到创建页
  if (!weeklyPlan && !isShareMode && !isInfantFeeding) {
    if (babies.length === 0) {
      return <Navigate to="/setup" replace />;
    }
    // 有宝宝但没有食谱，跳转到设置页生成
    if (effectiveAgeGroup) {
      return <Navigate to="/setup" replace />;
    }
  }

  const handleShare = async () => {
    if (!weeklyPlan) return;
    const ageLabel = effectiveAgeGroup ? AGE_GROUP_LABELS[effectiveAgeGroup] : '宝宝';
    const encoded = encodeShareData(weeklyPlan, ageLabel, effectiveAgeGroup!);
    const url = `${window.location.origin}/recipe?share=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      prompt('复制以下链接分享给家人：', url);
    }
  };

  const handleDownload = async (targetDay?: DayOfWeek | null) => {
    if (!displayPlan) return;
    setShowDownloadModal(false);
    setDownloading(true);
    try {
      await downloadRecipePDF(displayPlan, effectiveAgeGroup, targetDay);
    } catch (e) {
      console.error('PDF生成失败', e);
      alert('PDF生成失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadToday = () => handleDownload(todayDay);
  const handleDownloadWeek = () => handleDownload(null);

  const handleAddFood = (record: FoodRecord) => {
    addFoodRecord(record);
  };

  const nutritionGuide = effectiveAgeGroup ? getNutritionGuide(effectiveAgeGroup) : null;

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

  // 统一的餐次标题和图标（用于 RecipeCard）
  const getMealTitle = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
    return isUnderOneYear ? mealLabels[mealType] : undefined;
  };
  const getMealEmoji = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
    return isUnderOneYear ? mealIcons[mealType] : undefined;
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
              <p className="font-semibold text-green-800">📋 家人分享的{BRAND.name}食谱</p>
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
              <img src={BRAND_ASSETS.logo} alt={BRAND.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />
              {isShareMode ? (
                <span className="whitespace-nowrap">分享食谱</span>
              ) : (
                <span className="whitespace-nowrap">
                  {currentBaby
                    ? `${currentBaby.nickname || '宝宝'} 今天吃什么？`
                    : babyName
                    ? `${babyName} 今天吃什么？`
                    : '今天吃什么？'}
                </span>
              )}
            </h1>
            {isShareMode ? (
              <p className="text-gray-600 mt-1 text-xs sm:text-sm">
                {displayAgeLabel} · 共 7 天 × 3 餐 = 21 餐
              </p>
            ) : isInfantFeeding ? (
              <p className="text-gray-600 mt-1 text-xs sm:text-sm">🍼 当前阶段：婴儿喂养期 · 专注奶量</p>
            ) : isTwoMeal ? (
              <p className="text-gray-600 mt-1 text-xs sm:text-sm">每日2餐辅食 · 逐步丰富食物种类</p>
            ) : (
              <p className="text-gray-600 mt-1 text-xs sm:text-sm">{SHARE.description}</p>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {/* 宝宝选择器 */}
            {!isShareMode && currentBaby && (
              <BabySelector onNavigateToProfile={() => navigate('/baby-profile')} />
            )}
            {!currentBaby && !isShareMode && babies.length > 0 && (
              <Button onClick={() => navigate('/baby-profile')} variant="outline" size="sm">
                <User className="w-4 h-4" />
                选择宝宝
              </Button>
            )}
            {!isShareMode && (
              <>
                <Button onClick={() => navigate('/setup')} variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                  设置
                </Button>
                {!isInfantFeeding && (
                  <Button onClick={handleShare} variant="outline" size="sm">
                    {shareCopied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                    {shareCopied ? '已复制' : '分享'}
                  </Button>
                )}
              </>
            )}
            {!is6to8m && !isInfantFeeding && (
            <Button onClick={() => setShowDownloadModal(true)} variant="secondary" size="sm" disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? '生成中…' : '下载'}
            </Button>
            )}
          </div>
        </motion.div>

        {/* 0-5月龄：婴儿喂养期 */}
        {!isShareMode && isInfantFeeding && (
          <MilkKnowledge />
        )}

        {/* 营养科学指南（非婴儿喂养期）*/}
        {!isShareMode && nutritionGuide && !isInfantFeeding && (
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
        {!isShareMode && !is6to8m && !isInfantFeeding && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-3 bg-white/40 backdrop-blur rounded-xl border border-gray-100"
        >
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>💡 点击菜品展开食材做法</span>
            <span>🔄 换单道菜</span>
            <span>✕ 删除菜品</span>
            {!isTwoMeal && <span>⇅ 午晚餐互换</span>}
          </div>
        </motion.div>
        )}

        {/* 6-8 月龄：辅食添加参考计划 */}
        {is6to8m && !isInfantFeeding && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">📋</span>
              <h2 className="text-xl font-semibold text-gray-800">辅食添加计划参考</h2>
            </div>
            <div className="flex gap-2 mb-6">
              {([6, 7, 8] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFeedingMonth(m)}
                  className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                    feedingMonth === m
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m}个月
                </button>
              ))}
            </div>
            <ComplementaryFeedingPlan month={feedingMonth} />
          </motion.div>
        )}

        {/* 宝宝添加记录（6-8 月龄） */}
         {is6to8m && !isInfantFeeding && (
           <FoodTracker
             babyMonth={feedingMonth}
             foodRecords={foodRecords}
             onSaveFood={handleAddFood}
           />
         )}

        {/* 今日推荐（非 6-8m 且非婴儿喂养期） */}
        {displayPlan && !is6to8m && !isInfantFeeding && (
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
            {isTwoMeal ? (
              /* 两餐布局 */
              <div className="grid md:grid-cols-2 gap-4">
                <RecipeCard
                  mealPlan={displayPlan[todayDay].breakfast}
                  mealType="breakfast"
                  mealTitle={getMealTitle('breakfast')}
                  mealEmoji={getMealEmoji('breakfast')}
                  onRefresh={() => regenerateMeal(todayDay, 'breakfast')}
                  onReplaceDish={(idx) => regenerateDish(todayDay, 'breakfast', idx)}
                  onRemoveDish={(idx) => removeDish(todayDay, 'breakfast', idx)}
                  onInspiration={(recipe) =>
                    setCustomMeal(todayDay, 'breakfast', { dishes: [...displayPlan[todayDay].breakfast.dishes, recipe] })
                  }
                  onAddDish={(recipe) => addDish(todayDay, 'breakfast', recipe)}
                  readOnly={isShareMode}
                />
                {displayPlan[todayDay].lunch.dishes.length > 0 && (
                  <RecipeCard
                    mealPlan={displayPlan[todayDay].lunch}
                    mealType="lunch"
                    mealTitle={getMealTitle('lunch')}
                    mealEmoji={getMealEmoji('lunch')}
                    onRefresh={() => regenerateMeal(todayDay, 'lunch')}
                    onReplaceDish={(idx) => regenerateDish(todayDay, 'lunch', idx)}
                    onRemoveDish={(idx) => removeDish(todayDay, 'lunch', idx)}
                    onInspiration={(recipe) =>
                      setCustomMeal(todayDay, 'lunch', { dishes: [...displayPlan[todayDay].lunch.dishes, recipe] })
                    }
                    onAddDish={(recipe) => addDish(todayDay, 'lunch', recipe)}
                    readOnly={isShareMode}
                  />
                )}
              </div>
            ) : (
              /* 三餐布局 */
              <div className="grid md:grid-cols-3 gap-4">
                <RecipeCard
                  mealPlan={displayPlan[todayDay].breakfast}
                  mealType="breakfast"
                  mealTitle={getMealTitle('breakfast')}
                  mealEmoji={getMealEmoji('breakfast')}
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
                    mealTitle={getMealTitle('lunch')}
                    mealEmoji={getMealEmoji('lunch')}
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
                    mealTitle={getMealTitle('dinner')}
                    mealEmoji={getMealEmoji('dinner')}
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
            )}
          </motion.div>
        )}

        {/* 加餐建议 */}
        {displayPlan && snackSuggestions && snackSuggestions.length > 0 && !isTwoMeal && !isInfantFeeding && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="mb-6 bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🍪</span>
              <h2 className="text-xl font-semibold text-gray-800">加餐建议</h2>
              <span className="text-xs text-gray-400">两餐之间</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {snackSuggestions.map((snack, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm"
                >
                  <span>{snack.icon}</span>
                  <span className="text-xs text-purple-400">{snack.time}</span>
                  <span>{snack.name}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* 今日营养检查 */}
        {displayPlan && todayNutrition && !is6to8m && !isInfantFeeding && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">
                {todayNutrition.checkType === 'growth' ? '🌱' : '✅'}
              </span>
              <h2 className="text-xl font-semibold text-gray-800">
                {todayNutrition.checkType === 'growth'
                  ? '今日辅食成长'
                  : todayNutrition.checkType === 'coverage'
                  ? '今日营养覆盖检查'
                  : '今日营养是否均衡'}
              </h2>
            </div>

            {todayNutrition.checkType === 'growth' && (
              <p className="text-sm text-purple-600 mb-4 bg-purple-50 rounded-lg px-4 py-2">
                6-8个月宝宝仍以奶为主要营养来源，辅食重点是逐步尝试和建立饮食习惯。
              </p>
            )}

            {todayNutrition.covered.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-green-600 mb-2">
                  {todayNutrition.checkType === 'growth' ? '今日已尝试' : '已覆盖'}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {todayNutrition.covered.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm"
                    >
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {todayNutrition.optimization.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-purple-600 mb-2">
                  {todayNutrition.checkType === 'growth' ? '可以尝试' : '温馨提醒'}
                </h3>
                <div className="space-y-2">
                  {todayNutrition.optimization.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center px-4 py-2 bg-purple-50 rounded-xl"
                    >
                      <span className="text-sm text-purple-700 flex items-center gap-1.5">
                        <span>{item.icon}</span>
                        <span>{item.suggestion}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {todayNutrition.summary && (
              <p className="mt-4 text-sm text-gray-400 italic">{todayNutrition.summary}</p>
            )}
          </motion.div>
        )}

        {/* 本周推荐 */}
        {displayPlan && !is6to8m && !isInfantFeeding && (
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
                  {isTwoMeal ? '已为宝宝准备好本周2餐辅食，点击即可查看' : '已为宝宝准备好本周食谱，点击即可查看'}
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
                          {isTwoMeal ? (
                            <div className="grid md:grid-cols-2 gap-4">
                              <RecipeCard
                                mealPlan={dayPlan.breakfast}
                                mealType="breakfast"
                                mealTitle={getMealTitle('breakfast')}
                                mealEmoji={getMealEmoji('breakfast')}
                                onRefresh={() => regenerateMeal(day, 'breakfast')}
                                onReplaceDish={(idx) => regenerateDish(day, 'breakfast', idx)}
                                onRemoveDish={(idx) => removeDish(day, 'breakfast', idx)}
                                onInspiration={(recipe) =>
                                  setCustomMeal(day, 'breakfast', { dishes: [...dayPlan.breakfast.dishes, recipe] })
                                }
                                onAddDish={(recipe) => addDish(day, 'breakfast', recipe)}
                                readOnly={isShareMode}
                              />
                              {dayPlan.lunch.dishes.length > 0 && (
                                <RecipeCard
                                  mealPlan={dayPlan.lunch}
                                  mealType="lunch"
                                  mealTitle={getMealTitle('lunch')}
                                  mealEmoji={getMealEmoji('lunch')}
                                  onRefresh={() => regenerateMeal(day, 'lunch')}
                                  onReplaceDish={(idx) => regenerateDish(day, 'lunch', idx)}
                                  onRemoveDish={(idx) => removeDish(day, 'lunch', idx)}
                                  onInspiration={(recipe) =>
                                    setCustomMeal(day, 'lunch', { dishes: [...dayPlan.lunch.dishes, recipe] })
                                  }
                                  onAddDish={(recipe) => addDish(day, 'lunch', recipe)}
                                  readOnly={isShareMode}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="grid md:grid-cols-3 gap-4">
                            <RecipeCard
                              mealPlan={dayPlan.breakfast}
                              mealType="breakfast"
                              mealTitle={getMealTitle('breakfast')}
                              mealEmoji={getMealEmoji('breakfast')}
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
                                mealTitle={getMealTitle('lunch')}
                                mealEmoji={getMealEmoji('lunch')}
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
                                mealTitle={getMealTitle('dinner')}
                                mealEmoji={getMealEmoji('dinner')}
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
                          )}
                        </motion.div>
                      );
                    })}

                    {/* 本周营养概览 */}
                    {weekNutrition && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl p-5 shadow-sm border-2 border-purple-100"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">📊</span>
                          <h2 className="text-lg font-semibold text-gray-800">本周营养概览</h2>
                        </div>
                        <p className="text-xs text-gray-400 mb-4">
                          🥗 食物多样性：
                          <span className={weekNutrition.diversity === '优秀' ? 'text-green-600 font-medium' : weekNutrition.diversity === '良好' ? 'text-blue-600 font-medium' : 'text-amber-600'}>
                            {weekNutrition.diversity}
                          </span>
                          （本周共 {weekNutrition.uniqueIngredients} 种食材）
                        </p>
                        <div className="space-y-3">
                          {weekNutrition.items.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between px-4 py-2 bg-purple-50/50 rounded-xl"
                            >
                              <span className="text-sm text-gray-700 flex items-center gap-2">
                                <span>{item.icon}</span>
                                <span>{item.name}：</span>
                                <span className={item.display === '建议增加' ? 'text-amber-600' : item.display === '搭配良好' ? 'text-green-600 font-medium' : 'text-gray-800'}>
                                  {item.display}
                                </span>
                              </span>
                              <span className="text-xs text-gray-400">{item.suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
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
          className="mt-8 text-center text-gray-400 text-xs"
        >
          <p>营养数据参考</p>
          <p>《中国居民膳食指南（2022）》《中国居民膳食营养素参考摄入量（DRIs）》</p>
          <p>《中国学龄前儿童膳食指南（2022）》《中国7～24月龄婴幼儿喂养指南（2022）》</p>
        </motion.div>
        )}

        {/* 下载选择弹窗 */}
        <Modal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          title="选择下载内容"
        >
          <div className="space-y-3">
            <button
              onClick={handleDownloadToday}
              className="w-full p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-left flex items-center gap-4"
            >
              <span className="text-3xl">📋</span>
              <div>
                <div className="font-semibold text-gray-800">下载今日食谱</div>
                <div className="text-sm text-gray-500">
                  {DAY_LABELS[todayDay]} · {isTwoMeal ? '2餐辅食' : '早中晚三餐'}
                </div>
              </div>
            </button>
            <button
              onClick={handleDownloadWeek}
              className="w-full p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-left flex items-center gap-4"
            >
              <span className="text-3xl">📅</span>
              <div>
                <div className="font-semibold text-gray-800">下载一周食谱</div>
                <div className="text-sm text-gray-500">
                  {isTwoMeal ? '7天 × 2餐辅食' : '7天 × 21餐完整食谱'}
                </div>
              </div>
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
