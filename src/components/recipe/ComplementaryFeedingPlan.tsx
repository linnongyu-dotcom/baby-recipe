import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Info, Target, ChefHat, AlertTriangle } from 'lucide-react';
import { MONTHLY_PLANS, MonthPlanData, WeekPlanItem } from '@/data/complementaryFeedingPlan';

interface Props {
  month: 6 | 7 | 8;
}

function WeekCard({ week, isExpanded, onToggle }: { week: WeekPlanItem; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-purple-50/30 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-gray-800">{week.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{week.goal}</p>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-4">
              {/* 推荐食材 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ChefHat className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700">推荐添加</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {week.recommended.map((item, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* 示例搭配 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-base">🍽️</span>
                  <span className="text-sm font-semibold text-gray-700">示例搭配</span>
                </div>
                <ul className="space-y-1.5">
                  {week.examples.map((ex, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-purple-300">•</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 添加目标 */}
              <div className="flex items-start gap-2 px-3 py-2 bg-purple-50 rounded-lg">
                <Target className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-purple-700">{week.goal}</p>
              </div>

              {/* 注意事项 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-gray-700">注意事项</span>
                </div>
                <ul className="space-y-1">
                  {week.notes.map((note, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-amber-400">{i + 1}.</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ComplementaryFeedingPlan({ month }: Props) {
  const plan = MONTHLY_PLANS.find(p => p.month === month);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);

  if (!plan) {
    return (
      <div className="p-8 text-center text-gray-400">暂无该月龄的辅食添加计划</div>
    );
  }

  const toggleWeek = (week: number) => {
    setExpandedWeek(expandedWeek === week ? null : week);
  };

  return (
    <div className="space-y-4">
      {/* 免责声明 */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <Info className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          以下为参考计划，宝宝实际添加进度需根据接受情况调整。每次只添加一种新食物，连续观察 2-3 天，确认无过敏反应后再添加下一种。
        </p>
      </div>

      {/* 本月重点 */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">📌</span>
          <h2 className="text-lg font-semibold text-gray-800">{plan.title} · 本月重点</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{plan.focus}</p>
      </div>

      {/* 4 周卡片 */}
      <div className="space-y-3">
        {plan.weeks.map((week) => (
          <motion.div
            key={week.week}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: week.week * 0.05 }}
          >
            <WeekCard
              week={week}
              isExpanded={expandedWeek === week.week}
              onToggle={() => toggleWeek(week.week)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
