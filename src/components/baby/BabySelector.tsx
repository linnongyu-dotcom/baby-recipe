import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { calcAge } from '@/utils/babyProfile';
import { GROWTH_STAGE_INFO } from '@/types';

interface BabySelectorProps {
  onNavigateToProfile: () => void;
}

export function BabySelector({ onNavigateToProfile }: BabySelectorProps) {
  const { babies, currentBabyId, setCurrentBaby } = useStore();
  const [open, setOpen] = useState(false);
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);

  const currentBaby = babies.find(b => b.id === currentBabyId);
  if (!currentBaby) return null;

  const ageInfo = calcAge(currentBaby.birthDate);
  const stageInfo = GROWTH_STAGE_INFO[ageInfo.growthStage];

  const handleToggle = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setBtnRect(rect);
    setOpen(!open);
  };

  // 计算下拉框安全定位，避免溢出视口边缘
  const DROPDOWN_W = 256; // w-64
  const GAP = 8;
  const PADDING = 8;

  let dropdownStyle: React.CSSProperties = {};
  if (btnRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const estimatedHeight = 400;

    // 默认右对齐：下拉框右边缘 = 按钮右边缘
    const right = vw - btnRect.right;
    const leftEdge = btnRect.right - DROPDOWN_W;

    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
    };

    // 上下：按钮下方空间不够则翻到上方
    if (btnRect.bottom + GAP + estimatedHeight > vh && btnRect.top - estimatedHeight > GAP) {
      style.bottom = vh - btnRect.top + GAP;
    } else {
      style.top = btnRect.bottom + GAP;
    }

    // 左右：溢出则贴近对应边缘
    if (right < PADDING) {
      style.right = PADDING;
    } else if (leftEdge < PADDING) {
      style.left = PADDING;
    } else {
      style.right = right;
    }

    dropdownStyle = style;
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleToggle}
        className="flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur rounded-xl border border-purple-100 hover:border-purple-300 transition-all shadow-sm"
      >
        <span className="text-xl">
          {ageInfo.growthStage === 'infant_feeding' ? '👶' : ageInfo.growthStage === 'complementary_start' ? '🍼' : ageInfo.growthStage === 'complementary_advance' ? '😊' : '🧒'}
        </span>
        <div className="text-left min-w-0">
          <div className="font-semibold text-gray-800 text-sm truncate max-w-[100px]">
            {currentBaby.nickname || '宝宝'}
          </div>
          <div className="text-xs text-gray-500">
            {ageInfo.displayText}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </motion.button>

      {open &&
        btnRect &&
        createPortal(
          <AnimatePresence>
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9998]"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                style={dropdownStyle}
                className="w-64 bg-white rounded-xl shadow-xl border border-purple-100 overflow-hidden z-[9999]"
              >
                <div className="p-2">
                  <div className="text-xs text-gray-400 px-3 py-1.5 font-medium">我的宝宝</div>
                  {babies.map((baby) => {
                    const info = calcAge(baby.birthDate);
                    const stage = GROWTH_STAGE_INFO[info.growthStage];
                    const isCurrent = baby.id === currentBabyId;
                    return (
                      <motion.button
                        key={baby.id}
                        whileHover={{ backgroundColor: 'rgba(167,139,250,0.05)' }}
                        onClick={() => {
                          setCurrentBaby(baby.id);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isCurrent ? 'bg-purple-50' : ''
                        }`}
                      >
                        <span className="text-xl flex-shrink-0">
                          {info.growthStage === 'infant_feeding' ? '👶' : info.growthStage === 'complementary_start' ? '🍼' : info.growthStage === 'complementary_advance' ? '😊' : '🧒'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {baby.nickname || '宝宝'}
                            {isCurrent && <span className="text-purple-500 ml-1 text-xs">✓</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {info.displayText} · {stage.emoji} {stage.label}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="border-t border-gray-100 p-2">
                  <motion.button
                    whileHover={{ backgroundColor: 'rgba(167,139,250,0.05)' }}
                    onClick={() => {
                      setOpen(false);
                      onNavigateToProfile();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">管理宝宝档案</span>
                  </motion.button>
                </div>
              </motion.div>
            </>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
