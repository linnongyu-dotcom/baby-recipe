interface FeedingDisclaimerProps {
  className?: string;
  onShowSafetyNotice: () => void;
}

/** 首页底部的低视觉权重免责声明；完整内容由统一的安全说明弹窗承载。 */
export function FeedingDisclaimer({ className = '', onShowSafetyNotice }: FeedingDisclaimerProps) {
  return (
    <p className={`text-xs leading-relaxed text-gray-400 ${className}`}>
      食谱仅供家庭饮食参考，不替代医生或营养师的个体化建议。
      <button
        type="button"
        onClick={onShowSafetyNotice}
        className="ml-1 text-gray-500 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
      >
        查看安全说明
      </button>
    </p>
  );
}
