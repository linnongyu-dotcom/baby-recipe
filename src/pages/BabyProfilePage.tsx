import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Calendar, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { GROWTH_STAGE_INFO, BabyProfile } from '@/types';
import { calcAge } from '@/utils/babyProfile';
import { BRAND, setPageTitle } from '@/config/brand';

export function BabyProfilePage() {
  const navigate = useNavigate();
  const { babies, currentBabyId, addBaby, updateBaby, removeBaby, setCurrentBaby, isSetupComplete, generatePlan } = useStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingBaby, setEditingBaby] = useState<BabyProfile | null>(null);

  // 新建表单
  const [birthDate, setBirthDate] = useState('');
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    setPageTitle('宝宝档案');
  }, []);

  const handleCreate = () => {
    if (!birthDate) return;
    const id = addBaby(birthDate, nickname || undefined);
    setShowCreateModal(false);
    resetForm();
    // 如果是第一个宝宝，生成食谱并进入
    if (babies.length === 0) {
      setCurrentBaby(id);
      generatePlan();
      navigate('/recipe');
    }
  };

  const handleUpdate = () => {
    if (!editingBaby || !birthDate) return;
    updateBaby(editingBaby.id, {
      birthDate,
      nickname: nickname || undefined,
    });
    setEditingBaby(null);
    resetForm();
  };

  const handleDelete = (id: string) => {
    removeBaby(id);
    setShowDeleteConfirm(null);
  };

  const openEdit = (baby: BabyProfile) => {
    setEditingBaby(baby);
    setBirthDate(baby.birthDate);
    setNickname(baby.nickname || '');
  };

  const resetForm = () => {
    setBirthDate('');
    setNickname('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  // 获取今日日期作为 max（不能选择未来日期）
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <button
            onClick={() => navigate(isSetupComplete ? '/recipe' : '/setup')}
            className="p-2 rounded-xl hover:bg-white/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">👶 宝宝成长档案</h1>
            <p className="text-sm text-gray-500 mt-0.5">管理宝宝信息，精准推荐合适内容</p>
          </div>
        </motion.div>

        {/* 宝宝列表 */}
        <div className="space-y-3 mb-6">
          {babies.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 bg-white rounded-2xl border border-purple-100"
            >
              <div className="text-5xl mb-4">👶</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">还没有宝宝档案</h2>
              <p className="text-gray-500 text-sm mb-6">创建第一个宝宝档案，开始科学喂养之旅</p>
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4" />
                创建宝宝档案
              </Button>
            </motion.div>
          ) : (
            <>
              {babies.map((baby) => {
                const ageInfo = calcAge(baby.birthDate);
                const stageInfo = GROWTH_STAGE_INFO[ageInfo.growthStage];
                const isCurrent = baby.id === currentBabyId;
                return (
                  <motion.div
                    key={baby.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-2xl p-5 shadow-sm border-2 transition-all ${
                      isCurrent ? 'border-purple-400' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-3xl flex-shrink-0">
                        {ageInfo.growthStage === 'infant_feeding' ? '👶' : ageInfo.growthStage === 'complementary_start' ? '🍼' : ageInfo.growthStage === 'complementary_advance' ? '😊' : '🧒'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-800 text-lg">
                          {baby.nickname || '宝宝'}
                          {isCurrent && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">当前</span>
                          )}
                        </div>
                        <div className="text-sm text-purple-600 font-medium mt-0.5">
                          {ageInfo.displayText}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm">{stageInfo.emoji}</span>
                          <span className="text-xs text-gray-500">{stageInfo.label}</span>
                          <span className="text-xs text-gray-400">· {stageInfo.description}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          出生日期：{baby.birthDate}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!isCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentBaby(baby.id)}
                          >
                            切换
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(baby)}
                        >
                          编辑
                        </Button>
                        <button
                          onClick={() => setShowDeleteConfirm(baby.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* 添加宝宝 */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={openCreateModal}
                className="w-full p-4 border-2 border-dashed border-purple-200 rounded-2xl text-purple-500 hover:border-purple-400 hover:bg-purple-50/50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">添加宝宝</span>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* 创建/编辑宝宝弹窗 */}
      <Modal
        isOpen={showCreateModal || !!editingBaby}
        onClose={() => {
          setShowCreateModal(false);
          setEditingBaby(null);
          resetForm();
        }}
        title={editingBaby ? '编辑宝宝档案' : '👶 创建宝宝成长档案'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            为了给宝宝推荐适合年龄的内容，请填写宝宝出生日期
          </p>

          {/* 昵称 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 text-purple-500" />
              宝宝昵称 <span className="text-gray-400 font-normal">(可选)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 8))}
              placeholder="输入宝宝的名字或小名"
              maxLength={8}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-gray-700 transition-colors"
            />
            {nickname && (
              <p className="text-xs text-gray-400 mt-1">{nickname.length}/8</p>
            )}
          </div>

          {/* 出生日期 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              宝宝出生日期 <span className="text-purple-500">*</span>
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={today}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-gray-700 transition-colors"
            />
          </div>

          {/* 预览（仅在日期有效时显示） */}
          {birthDate && (() => {
            try {
              const preview = calcAge(birthDate);
              const previewStage = GROWTH_STAGE_INFO[preview.growthStage];
              return (
                <div className="p-4 bg-purple-50 rounded-xl">
                  <div className="text-sm text-purple-700 font-medium mb-1">当前阶段预览</div>
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

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowCreateModal(false);
                setEditingBaby(null);
                resetForm();
              }}
            >
              取消
            </Button>
            <Button
              className="flex-1"
              disabled={!birthDate}
              onClick={editingBaby ? handleUpdate : handleCreate}
            >
              {editingBaby ? '保存修改' : '开始使用'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="确认删除"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            删除宝宝档案后，相关数据将无法恢复。确定要删除吗？
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(null)}
            >
              取消
            </Button>
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
