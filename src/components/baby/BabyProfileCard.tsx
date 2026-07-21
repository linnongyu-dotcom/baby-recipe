import { motion } from 'framer-motion';
import { BabyProfile, GROWTH_STAGE_INFO, BabyAgeInfo } from '@/types';
import { calcAge } from '@/utils/babyProfile';

interface BabyProfileCardProps {
  baby: BabyProfile;
  onClick?: () => void;
  compact?: boolean;
}

export function BabyProfileCard({ baby, onClick, compact = false }: BabyProfileCardProps) {
  const ageInfo: BabyAgeInfo = calcAge(baby.birthDate);
  const stageInfo = GROWTH_STAGE_INFO[ageInfo.growthStage];
  const displayName = baby.nickname || '宝宝';

  if (compact) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-2 bg-white/70 backdrop-blur rounded-xl border border-purple-100 hover:border-purple-300 transition-all shadow-sm"
      >
        <span className="text-2xl">{ageInfo.growthStage === 'infant_feeding' ? '👶' : ageInfo.growthStage === 'complementary_start' ? '🍼' : ageInfo.growthStage === 'complementary_advance' ? '😊' : '🧒'}</span>
        <div className="text-left min-w-0">
          <div className="font-semibold text-gray-800 text-sm truncate">{displayName}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{ageInfo.displayText}</span>
            <span className="text-purple-400">·</span>
            <span>{stageInfo.emoji} {stageInfo.label}</span>
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-3xl flex-shrink-0">
          {ageInfo.growthStage === 'infant_feeding' ? '👶' : ageInfo.growthStage === 'complementary_start' ? '🍼' : ageInfo.growthStage === 'complementary_advance' ? '😊' : '🧒'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-gray-800 text-lg">{displayName}</div>
          <div className="text-sm text-purple-600 font-medium mt-0.5">
            {ageInfo.displayText}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm">{stageInfo.emoji}</span>
            <span className="text-xs text-gray-500">{stageInfo.label}</span>
            <span className="text-xs text-gray-400">· {stageInfo.description}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
