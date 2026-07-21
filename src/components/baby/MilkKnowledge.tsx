import { motion } from 'framer-motion';

export function MilkKnowledge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🍼</span>
        <h2 className="text-xl font-semibold text-gray-800">婴儿喂养期</h2>
      </div>

      <p className="text-sm text-purple-600 mb-6 bg-purple-50 rounded-lg px-4 py-3">
        0-5个月宝宝以母乳或配方奶为唯一营养来源，辅食添加从满6个月开始。此阶段请专注奶量喂养和辅食准备知识。
      </p>

      {/* 奶量知识 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>🥛</span> 每日奶量参考
        </h3>
        <div className="grid gap-3">
          {[
            { age: '0-1个月', amount: '约500-750ml/天', detail: '按需喂养，约8-12次/天，每次60-90ml' },
            { age: '1-2个月', amount: '约600-800ml/天', detail: '约6-8次/天，每次90-120ml' },
            { age: '2-4个月', amount: '约800-900ml/天', detail: '约5-7次/天，每次120-180ml' },
            { age: '4-5个月', amount: '约800-1000ml/天', detail: '约4-6次/天，每次150-220ml' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between px-4 py-3 bg-purple-50/50 rounded-xl"
            >
              <span className="text-sm font-medium text-gray-700">{item.age}</span>
              <div className="text-right">
                <div className="text-sm font-semibold text-purple-600">{item.amount}</div>
                <div className="text-xs text-gray-400">{item.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 辅食准备知识 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>📋</span> 辅食添加准备
        </h3>
        <div className="space-y-3">
          {[
            { icon: '⏰', title: '开始时间', content: '足月宝宝满6个月（180天）是添加辅食的最佳时间。最早不早于4个月，最晚不晚于8个月。' },
            { icon: '✅', title: '添加信号', content: '能够稳定抬头、独坐或靠坐、对食物表现出兴趣、挺舌反射消失、喂奶后仍饥饿。' },
            { icon: '🥣', title: '第一口辅食', content: '推荐强化铁米粉（单一谷物），用母乳或配方奶调成稀糊状。从1勺开始，逐步加量。' },
            { icon: '⚠️', title: '添加原则', content: '由少到多、由稀到稠、由细到粗、由单一到多样。每次只添加一种新食物，观察3-5天。' },
            { icon: '🚫', title: '禁忌食物', content: '1岁前避免蜂蜜、盐、糖、整颗坚果、鲜牛奶、果汁。' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-3 p-4 bg-white rounded-xl border border-gray-100"
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{item.content}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 温馨提示 */}
      <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
        <div className="flex items-start gap-2">
          <span className="text-sm mt-0.5">💛</span>
          <div>
            <h4 className="text-sm font-semibold text-yellow-700 mb-1">温馨提示</h4>
            <ul className="text-sm text-yellow-600 space-y-1">
              <li>母乳喂养的宝宝，妈妈继续保持均衡营养饮食。</li>
              <li>配方奶喂养请严格按照说明书冲泡，不过浓不过稀。</li>
              <li>每天补充维生素D 400IU，直到1岁。</li>
              <li>定期体检，关注宝宝生长发育曲线。</li>
              <li>辅食添加计划将在宝宝满6个月时自动开启。</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
