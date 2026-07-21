import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit3, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FoodRecord, FoodIntroCategory, FoodStatus, FOOD_CATEGORY_INFO } from '../../types';
import { getCategoryFoodsWithStatus } from '../../utils/foodIntroductionEngine';
import { findFoodDef } from '../../data/foodIntroduction';
import { AddFoodModal } from './AddFoodModal';

interface FoodTrackerProps {
  babyMonth: number;
  foodRecords: FoodRecord[];
  onSaveFood: (record: FoodRecord) => void;
  openAddModal?: boolean;
  onModalClosed?: () => void;
}

const STATUS_STYLE: Record<FoodStatus, { bg: string; text: string; icon: string }> = {
  untried: { bg: 'bg-gray-100', text: 'text-gray-400', icon: '⬜' },
  trying: { bg: 'bg-blue-50', text: 'text-blue-600', icon: '🔄' },
  accepted: { bg: 'bg-green-50', text: 'text-green-600', icon: '✅' },
  unsuitable: { bg: 'bg-red-50', text: 'text-red-500', icon: '⚠️' },
};

export function FoodTracker({ babyMonth, foodRecords, onSaveFood, openAddModal, onModalClosed }: FoodTrackerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodRecord | undefined>(undefined);

  // 外部触发打开弹窗
  useEffect(() => {
    if (openAddModal) {
      setIsModalOpen(true);
    }
  }, [openAddModal]);

  // 按分类整理食材（含未尝试的）
  const categories = useMemo(() => {
    const cats: FoodIntroCategory[] = ['grain', 'vegetable', 'fruit', 'protein'];
    return cats.map(cat => ({
      category: cat,
      foods: getCategoryFoodsWithStatus(cat, foodRecords, babyMonth),
    }));
  }, [foodRecords, babyMonth]);

  const handleEdit = (record: FoodRecord) => {
    setEditingFood(record);
    setIsModalOpen(true);
  };

  const handleSave = (record: FoodRecord) => {
    onSaveFood(record);
    setEditingFood(undefined);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingFood(undefined);
    onModalClosed?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-5 sm:p-6"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥣</span>
          <h2 className="text-lg font-semibold text-gray-800">宝宝添加记录</h2>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white rounded-full text-sm font-medium hover:bg-purple-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          添加食材
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-5">记录宝宝尝试过的每一种食材，科学安排添加顺序</p>

      {/* 按分类展示 */}
      <div className="space-y-5">
        {categories.map(({ category, foods }) => {
          if (foods.length === 0) return null;
          const info = FOOD_CATEGORY_INFO[category];

          return (
            <div key={category}>
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <span>{info.emoji}</span>
                <span>{info.label}</span>
              </h3>

              <div className="space-y-1.5">
                {foods.map(({ food, status, record }) => {
                  const style = STATUS_STYLE[status];
                  const isTrying = status === 'trying' && record?.tryDate;
                  const isAccepted = status === 'accepted' && record?.acceptedDate;

                  return (
                    <div
                      key={food.name}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl ${style.bg} transition-all`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{style.icon}</span>
                        <span className={`text-sm ${status === 'untried' ? 'text-gray-400' : 'text-gray-800'}`}>
                          {food.name}
                        </span>
                        {isTrying && (
                          <span className="text-xs text-blue-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            观察中
                          </span>
                        )}
                        {isAccepted && (
                          <span className="text-xs text-green-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            已尝试
                          </span>
                        )}
                        {status === 'unsuitable' && (
                          <span className="text-xs text-red-400 flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            暂不添加
                          </span>
                        )}
                      </div>

                      {status !== 'untried' && record ? (
                        <button
                          onClick={() => handleEdit(record)}
                          className="text-gray-400 hover:text-purple-500 transition-colors p-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const newRecord: FoodRecord = {
                              name: food.name,
                              category,
                              status: 'trying',
                              tryDate: new Date().toISOString().slice(0, 10),
                              observation: 'good',
                            };
                            onSaveFood(newRecord);
                          }}
                          className="text-gray-300 hover:text-purple-500 transition-colors p-1"
                          title="快速添加"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AddFoodModal
        isOpen={isModalOpen}
        onClose={handleClose}
        existingRecord={editingFood}
        onSave={handleSave}
      />
    </motion.div>
  );
}
