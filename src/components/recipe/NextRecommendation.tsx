import { motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { FoodRecord, FoodRecommendation, FOOD_CATEGORY_INFO } from '../../types';
import { recommendNextFood, getProgressSummary } from '../../utils/foodIntroductionEngine';
import { Button } from '../common/Button';

interface NextRecommendationProps {
  babyMonth: number;
  foodRecords: FoodRecord[];
  onAddFood: () => void;
}

export function NextRecommendation({ babyMonth, foodRecords, onAddFood }: NextRecommendationProps) {
  const recommendation = recommendNextFood(babyMonth, foodRecords);
  const progress = getProgressSummary(foodRecords, babyMonth);

  const acceptedRecords = foodRecords.filter(r => r.status === 'accepted');
  const tryingRecords = foodRecords.filter(r => r.status === 'trying');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-5 sm:p-6"
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">➡️</span>
        <h2 className="text-lg font-semibold text-gray-800">下一步建议</h2>
      </div>

      {/* 宝宝当前状态 */}
      <div className="mb-4 p-3 bg-purple-50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {babyMonth}m
          </div>
          <div>
            <p className="font-medium text-gray-800 text-sm">{babyMonth}个月 · {progress.stageLabel}</p>
            <p className="text-xs text-gray-500">{progress.stageDescription}</p>
          </div>
        </div>
      </div>

      {/* 已完成食材 */}
      {acceptedRecords.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">已完成</p>
          <div className="flex flex-wrap gap-1.5">
            {acceptedRecords.map(r => (
              <span
                key={r.name}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs"
              >
                ✅ {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 推荐 */}
      {recommendation ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">{FOOD_CATEGORY_INFO[recommendation.category].emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-base">{recommendation.name}</p>
              <p className="text-sm text-gray-600 mt-0.5">{recommendation.reason}</p>
              <div className="mt-2 p-2 bg-white/70 rounded-lg">
                <p className="text-xs text-gray-500 leading-relaxed">{recommendation.addMethod}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : tryingRecords.length > 0 ? (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-700">
            正在尝试 {tryingRecords.map(r => r.name).join('、')}，观察2-3天后确认结果
          </p>
        </div>
      ) : progress.completedCurrentStage ? (
        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <p className="text-sm text-green-700">
            当前阶段食材已全部尝试完毕！进入下一阶段继续探索
          </p>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">
            尚未开始添加辅食，从强化铁米粉开始吧
          </p>
        </div>
      )}

      {/* 进度条 */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>添加进度</span>
          <span>{progress.acceptedCount + progress.tryingCount}/{progress.totalExpected}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress.totalExpected > 0 ? ((progress.acceptedCount + progress.tryingCount) / progress.totalExpected) * 100 : 0}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
