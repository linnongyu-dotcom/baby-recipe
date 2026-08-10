import { AlertTriangle } from 'lucide-react';

interface FeedingDisclaimerProps {
  compact?: boolean;
  className?: string;
}

export function FeedingDisclaimer({ compact = false, className = '' }: FeedingDisclaimerProps) {
  if (compact) {
    return (
      <p className={`text-xs leading-relaxed text-amber-700 ${className}`}>
        <span className="font-semibold">仅供参考：</span>
        食谱、食材用量、奶量及营养分析不替代医生或营养师的个体化建议，请结合宝宝实际情况调整。
      </p>
    );
  }

  return (
    <aside
      aria-label="喂养安全提示"
      className={`rounded-xl border border-amber-200 bg-amber-50/90 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-amber-900">重要提示 · 以下内容仅供参考</h2>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            月龄阶段、食谱搭配、食材用量、奶量和营养分析均为通用信息，不能替代儿科医生或注册营养师的诊断与个体化建议。
            请结合宝宝的生长发育、吞咽能力、疾病史及医嘱调整；首次尝试食材应少量、单独添加并留意过敏反应。
            如出现呼吸困难、面唇肿胀、持续呕吐或精神状态异常，请立即停止喂食并及时就医。
          </p>
        </div>
      </div>
    </aside>
  );
}
