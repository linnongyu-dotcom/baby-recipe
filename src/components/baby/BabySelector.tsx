import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { calcAge } from '@/utils/babyProfile';
import { GROWTH_STAGE_INFO } from '@/types';

interface BabySelectorProps {
  onNavigateToProfile: () => void;
}

export function BabySelector({ onNavigateToProfile }: BabySelectorProps) {
  const { babies, currentBabyId, setCurrentBaby } = useStore();
  const [open, setOpen] = useState(false);

  const currentBaby = babies.find(b => b.id === currentBabyId);
  if (!currentBaby) return null;

  const ageInfo = calcAge(currentBaby.birthDate);
  const stageInfo = GROWTH_STAGE_INFO[ageInfo.growthStage];

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
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

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute top-full mt-2 right-0 w-64 bg-white rounded-xl shadow-xl border border-purple-100 overflow-hidden z-20"
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
        )}
      </AnimatePresence>
    </div>
  );
}
