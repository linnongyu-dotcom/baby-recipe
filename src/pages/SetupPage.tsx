import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Heart, ThumbsDown, Plus, X, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Tag } from '@/components/common/Tag';
import { BabyProfileCard } from '@/components/baby/BabyProfileCard';
import { COMMON_ALLERGIES, COMMON_FOODS, GROWTH_STAGE_INFO } from '@/types';
import { calcAge } from '@/utils/babyProfile';
import { setPageTitle } from '@/config/brand';

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
    babies,
    currentBabyId,
    isSetupComplete,
    setAllergies,
    setDislikes,
    setLikes,
    addBaby,
    generatePlan,
  } = useStore();

  const hasBabies = babies.length > 0;
  const currentBaby = babies.find(b => b.id === currentBabyId);
  const isOnboarding = !hasBabies;
  const babyAgeInfo = currentBaby ? calcAge(currentBaby.birthDate) : null;
  const isInfantFeeding = babyAgeInfo?.growthStage === 'infant_feeding';
  const is6to8mActual = babyAgeInfo?.ageGroup === '6-8m';

  // 新建宝宝表单
  const [birthDate, setBirthDate] = useState('');
  const [nickname, setNickname] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isOnboarding) {
      setPageTitle('创建宝宝档案');
    } else {
      setPageTitle(isSetupComplete ? '设置' : undefined);
    }
  }, [isOnboarding, isSetupComplete]);

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

  const handleCreateBaby = () => {
    if (!birthDate) return;
    const id = addBaby(birthDate, nickname || undefined);
    setBirthDate('');
    setNickname('');
    // 创建后直接进入食谱
    generatePlan();
    navigate('/recipe');
  };

  const handleGenerate = () => {
    if (isInfantFeeding) {
      navigate('/recipe');
      return;
    }
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
          {isOnboarding ? (
            <>
              <div className="text-5xl mb-4">👶</div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                创建宝宝成长档案
              </h1>
              <p className="text-gray-600">
                为了给宝宝推荐适合年龄的内容，请填写宝宝出生日期
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                ⚙️ 设置
              </h1>
              <p className="text-gray-600">
                完善宝宝信息，推荐会越来越符合宝宝的饮食习惯。
              </p>
            </>
          )}
        </motion.div>

        {/* 首次进入：创建宝宝档案 */}
        {isOnboarding && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card hoverable={false} className="p-6">
              {/* 出生日期（必填） */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-gray-800">
                    宝宝出生日期 <span className="text-purple-500">*</span>
                  </h2>
                </div>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={today}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-gray-700 text-lg transition-colors"
                />
              </div>

              {/* 昵称（可选） */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-gray-800">
                    宝宝昵称 <span className="text-gray-400 text-sm font-normal">(可选)</span>
                  </h2>
                  {nickname && (
                    <span className="text-xs text-gray-400">{nickname.length}/8</span>
                  )}
                </div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 8))}
                  placeholder="输入宝宝的名字或小名"
                  maxLength={8}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-gray-700 text-lg transition-colors"
                />
              </div>

              {/* 预览 */}
              {birthDate && (() => {
                try {
                  const preview = calcAge(birthDate);
                  const previewStage = GROWTH_STAGE_INFO[preview.growthStage];
                  return (
                    <div className="p-4 bg-purple-50 rounded-xl mb-2">
                      <div className="text-sm text-purple-700 font-medium mb-1">当前阶段</div>
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <span>{previewStage.emoji}</span>
                        <span>{previewStage.label}</span>
                        <span className="text-purple-400">·</span>
                        <span>{preview.displayText}</span>
                      </div>
                      <div className="text-xs text-purple-400 mt-1">{previewStage.description}</div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}
            </Card>

            <div className="text-center mt-6">
              <Button
                onClick={handleCreateBaby}
                disabled={!birthDate}
                size="lg"
                className="px-12"
              >
                ✨ 开始使用
              </Button>
            </div>
          </motion.div>
        )}

        {/* 已有宝宝：显示设置 */}
        {!isOnboarding && (
          <>
            {/* 当前宝宝信息 */}
            {currentBaby && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <BabyProfileCard
                  baby={currentBaby}
                  onClick={() => navigate('/baby-profile')}
                />
                <div className="text-center mt-2">
                  <button
                    onClick={() => navigate('/baby-profile')}
                    className="text-sm text-purple-500 hover:text-purple-600 transition-colors"
                  >
                    管理宝宝档案 →
                  </button>
                </div>
              </motion.div>
            )}

            {/* 过敏食物选择 */}
            {!isInfantFeeding && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
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
            )}

            {/* 不喜欢的食物 */}
            {!isInfantFeeding && !is6to8mActual && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
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

            {/* 喜欢的食物 */}
            {!isInfantFeeding && !is6to8mActual && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
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
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <Button
                onClick={handleGenerate}
                size="lg"
                className="px-12"
              >
                {isInfantFeeding
                  ? '🍼 进入'
                  : isSetupComplete
                  ? '✨ 重新生成食谱'
                  : '✨ 生成食谱'}
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
