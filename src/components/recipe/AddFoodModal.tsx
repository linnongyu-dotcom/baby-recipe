import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FoodRecord, FoodStatus, FoodIntroCategory, FoodObservation, FOOD_CATEGORY_INFO } from '../../types';
import { findFoodDef } from '../../data/foodIntroduction';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecord?: FoodRecord;
  onSave: (record: FoodRecord) => void;
}

const FOOD_NAMES_BY_CATEGORY: Record<FoodIntroCategory, string[]> = {
  grain: ['强化铁米粉', '小米粥', '大米粥', '红薯', '燕麦'],
  vegetable: ['南瓜', '胡萝卜', '土豆', '西兰花', '菠菜', '山药'],
  fruit: ['苹果', '梨', '香蕉'],
  protein: ['猪肉', '牛肉', '鱼肉', '蛋黄', '鸡肉', '豆腐'],
};

const STATUS_OPTIONS: { value: FoodStatus; label: string; icon: string }[] = [
  { value: 'trying', label: '尝试中', icon: '🔄' },
  { value: 'accepted', label: '已接受', icon: '✅' },
  { value: 'unsuitable', label: '不适合', icon: '⚠️' },
];

const OBSERVATION_OPTIONS: { value: FoodObservation; label: string }[] = [
  { value: 'good', label: '接受良好' },
  { value: 'disliked', label: '不太喜欢' },
  { value: 'abnormal', label: '出现异常' },
];

export function AddFoodModal({ isOpen, onClose, existingRecord, onSave }: AddFoodModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<FoodIntroCategory>(existingRecord?.category || 'grain');
  const [selectedFood, setSelectedFood] = useState<string>(existingRecord?.name || '');
  const [status, setStatus] = useState<FoodStatus>(existingRecord?.status || 'trying');
  const [observation, setObservation] = useState<FoodObservation>(existingRecord?.observation || 'good');
  const [note, setNote] = useState(existingRecord?.note || '');

  const foodDef = selectedFood ? findFoodDef(selectedFood) : null;
  const isTrying = status === 'trying';

  const handleSave = () => {
    if (!selectedFood) return;

    const now = new Date().toISOString().slice(0, 10);
    const record: FoodRecord = {
      name: selectedFood,
      category: selectedCategory,
      status,
      ...(status === 'trying' && !existingRecord?.tryDate ? { tryDate: now } : existingRecord?.tryDate ? { tryDate: existingRecord.tryDate } : {}),
      ...(status === 'accepted' ? { acceptedDate: existingRecord?.acceptedDate || now } : {}),
      ...(isTrying ? { observation } : {}),
      ...(note ? { note } : {}),
    };

    onSave(record);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSelectedFood('');
    setStatus('trying');
    setObservation('good');
    setNote('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={existingRecord ? '更新食材状态' : '添加新食材'}>
      <div className="space-y-5">
        {/* 步骤1：选择分类 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">食材分类</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(FOOD_CATEGORY_INFO) as [FoodIntroCategory, typeof FOOD_CATEGORY_INFO['grain']][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => { setSelectedCategory(key); setSelectedFood(''); }}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === key
                    ? 'bg-purple-500 text-white shadow'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 步骤2：选择食材 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">选择食材</label>
          <div className="flex flex-wrap gap-2">
            {FOOD_NAMES_BY_CATEGORY[selectedCategory].map(food => (
              <button
                key={food}
                onClick={() => setSelectedFood(food)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  selectedFood === food
                    ? 'bg-purple-500 text-white shadow'
                    : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                }`}
              >
                {food}
              </button>
            ))}
          </div>
        </div>

        {/* 步骤3：选择状态 */}
        {selectedFood && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">当前状态</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                      status === opt.value
                        ? opt.value === 'unsuitable'
                          ? 'bg-red-500 text-white shadow'
                          : 'bg-purple-500 text-white shadow'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 尝试中：选择观察结果 */}
            {isTrying && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className="text-sm font-medium text-gray-700 mb-2 block">记录宝宝情况</label>
                <div className="flex gap-2">
                  {OBSERVATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setObservation(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm transition-all ${
                        observation === opt.value
                          ? 'bg-purple-500 text-white shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 食材信息和备注 */}
            {foodDef && (
              <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
                {isTrying ? (
                  <>
                    <p className="font-medium mb-1">{foodDef.addMethod}</p>
                    <p className="text-amber-600">建议单独尝试，观察2-3天</p>
                  </>
                ) : status === 'unsuitable' ? (
                  <p className="text-red-700">⚠ 该食材后续推荐时降低优先级</p>
                ) : (
                  <p className="text-green-700">✅ 宝宝已接受该食材！</p>
                )}
              </div>
            )}

            {/* 备注 */}
            {status === 'unsuitable' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">备注（选填）</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：出现皮疹、腹泻等不适情况..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-purple-300 focus:ring-1 focus:ring-purple-300 resize-none"
                  rows={2}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* 保存按钮 */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleClose} variant="outline" className="flex-1">
            取消
          </Button>
          <Button onClick={handleSave} variant="primary" className="flex-1" disabled={!selectedFood}>
            {existingRecord ? '更新' : '确认添加'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
