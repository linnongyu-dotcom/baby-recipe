import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Baby, AlertTriangle, Heart, ThumbsDown, Plus, X, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Tag } from '@/components/common/Tag';
import { AGE_GROUP_LABELS, AgeGroup, COMMON_ALLERGIES, COMMON_FOODS } from '@/types';

interface FoodSelectorProps {
  title: string;
  icon: React.ReactNode;
  presetItems: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onAdd: (item: string) => void;
  variant?: 'default' | 'success' | 'warning';
}

function FoodSelector({
  title,
  icon,
  presetItems,
  selected,
  onToggle,
  onAdd,
  variant = 'default',
}: FoodSelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onAdd(trimmed);
      setCustomInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCustom();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-semibold text-gray-800">
          {title} <span className="text-gray-400 text-sm">(可选)</span>
        </h2>
      </div>

      {/* 已选标签 */}
      {selected.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="text-xs text-gray-500 mb-2">已选择：</div>
          <div className="flex flex-wrap gap-2">
            {selected.map((item) => (
              <motion.button
                key={item}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => onToggle(item)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  variant === 'warning'
                    ? 'bg-orange-500 text-white'
                    : variant === 'success'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-700 text-white'
                }`}
              >
                {item}
                <X className="w-3.5 h-3.5 ml-1" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* 预设标签 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {presetItems
          .filter(item => !selected.includes(item))
          .map((item) => (
            <Tag
              key={item}
              selected={false}
              onClick={() => onToggle(item)}
              variant={variant}
            >
              {item}
            </Tag>
          ))}
      </div>

      {/* 自定义输入 */}
      <div className="mt-4">
        {!showInput ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowInput(true)}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-full text-gray-500 hover:border-purple-300 hover:text-purple-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加自定义
          </motion.button>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入食物名称..."
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-full focus:border-purple-500 focus:outline-none text-gray-700"
              maxLength={10}
            />
            <Button
              onClick={handleAddCustom}
              size="sm"
              disabled={!customInput.trim()}
            >
              添加
            </Button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setShowInput(false);
                setCustomInput('');
              }}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const {
    settings,
    babyName,
    isSetupComplete,
    setBabyAge,
    setAllergies,
    setDislikes,
    setLikes,
    setBabyName,
    generatePlan,
  } = useStore();

  const isSettingsMode = isSetupComplete;

  const handleAgeSelect = (age: AgeGroup) => {
    setBabyAge(age);
  };

  const handleAllergyToggle = (item: string) => {
    const current = settings.allergies;
    if (current.includes(item)) {
      setAllergies(current.filter(i => i !== item));
    } else {
      setAllergies([...current, item]);
    }
  };

  const handleDislikeToggle = (item: string) => {
    const current = settings.dislikes;
    if (current.includes(item)) {
      setDislikes(current.filter(i => i !== item));
    } else {
      setDislikes([...current, item]);
    }
  };

  const handleLikeToggle = (item: string) => {
    const current = settings.likes;
    if (current.includes(item)) {
      setLikes(current.filter(i => i !== item));
    } else {
      setLikes([...current, item]);
    }
  };

  const handleGenerate = () => {
    if (!settings.babyAge) return;
    generatePlan();
    navigate('/recipe');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {isSettingsMode ? (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                ⚙️ 设置
              </h1>
              <p className="text-gray-600">
                完善宝宝信息，推荐会越来越符合宝宝的饮食习惯。
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                少一点纠结，多一点陪伴。
              </h1>
              <p className="text-gray-600">
                根据宝宝年龄、饮食需求和过敏信息，为你安排每一餐，让科学喂养变得简单。
              </p>
            </>
          )}
        </motion.div>

        {/* 年龄选择 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card hoverable={false} className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Baby className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-800">
                宝宝年龄 <span className="text-purple-500">*</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map((age) => (
                <motion.button
                  key={age}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAgeSelect(age)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    settings.babyAge === age
                      ? 'border-purple-500 bg-purple-50 text-purple-600 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                  }`}
                >
                  <div className="text-lg font-medium">{AGE_GROUP_LABELS[age]}</div>
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* 宝宝姓名 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <Card hoverable={false} className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-800">
                宝宝姓名 <span className="text-gray-400 text-sm">(可选)</span>
              </h2>
              {babyName && (
                <span className="text-xs text-gray-400">{babyName.length}/8</span>
              )}
            </div>
            <input
              type="text"
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
              placeholder="输入宝宝的名字或小名"
              maxLength={8}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-gray-700 text-lg transition-colors"
            />
          </Card>
        </motion.div>

        {/* 过敏食物选择 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <Card hoverable={false} className="p-6">
            <FoodSelector
              title="过敏食物"
              icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
              presetItems={COMMON_ALLERGIES}
              selected={settings.allergies}
              onToggle={handleAllergyToggle}
              onAdd={handleAllergyToggle}
              variant="warning"
            />
          </Card>
        </motion.div>

        {/* 不喜欢的食物（仅设置模式） */}
        {isSettingsMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <Card hoverable={false} className="p-6">
              <FoodSelector
                title="不喜欢的食物"
                icon={<ThumbsDown className="w-5 h-5 text-gray-500" />}
                presetItems={COMMON_FOODS}
                selected={settings.dislikes}
                onToggle={handleDislikeToggle}
                onAdd={handleDislikeToggle}
                variant="default"
              />
            </Card>
          </motion.div>
        )}

        {/* 喜欢的食物（仅设置模式） */}
        {isSettingsMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <Card hoverable={false} className="p-6">
              <FoodSelector
                title="喜欢的食物"
                icon={<Heart className="w-5 h-5 text-purple-500" />}
                presetItems={COMMON_FOODS}
                selected={settings.likes}
                onToggle={handleLikeToggle}
                onAdd={handleLikeToggle}
                variant="success"
              />
            </Card>
          </motion.div>
        )}

        {/* 生成按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <Button
            onClick={handleGenerate}
            disabled={!settings.babyAge}
            size="lg"
            className="px-12"
          >
            {isSettingsMode ? '✨ 重新生成食谱' : '✨ 开始推荐'}
          </Button>
          {!settings.babyAge && (
            <p className="text-sm text-gray-500 mt-2">请先选择宝宝年龄</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}