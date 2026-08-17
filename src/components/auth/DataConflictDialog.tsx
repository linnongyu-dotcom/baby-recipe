import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useSyncStore } from '@/stores/syncStore';
import { resolveConflict } from '@/services/syncCoordinator';

const Summary = ({ title, babies, recipes, time }: { title: string; babies: number; recipes: number; time: number }) => <div className="p-3 bg-purple-50 rounded-xl text-sm"><div className="font-semibold text-gray-700">{title}</div><div className="text-gray-500 mt-1">宝宝 {babies} 个 · 我的食谱 {recipes} 个</div><div className="text-xs text-gray-400 mt-1">最后更新：{time ? new Date(time).toLocaleString() : '未知'}</div></div>;
export function DataConflictDialog() {
  const conflict = useSyncStore(s => s.conflict); const [confirmLocal, setConfirmLocal] = useState(false); const [busy, setBusy] = useState(false);
  if (!conflict) return null;
  const choose = async (choice: 'cloud' | 'local') => { setBusy(true); try { await resolveConflict(choice); } finally { setBusy(false); setConfirmLocal(false); } };
  return <Modal isOpen title="发现两份饭小宝数据" onClose={() => undefined}><div className="space-y-4">
    <p className="text-sm text-gray-600">本机和云端都保存了数据，请选择这次使用哪一份。</p>
    <Summary title="本机数据" babies={conflict.localSummary.babyCount} recipes={conflict.localSummary.recipeCount} time={conflict.localSummary.updatedAt} />
    <Summary title="云端数据" babies={conflict.cloudSummary.babyCount} recipes={conflict.cloudSummary.recipeCount} time={conflict.cloudSummary.updatedAt} />
    {!confirmLocal ? <div className="space-y-2"><Button disabled={busy} className="w-full" onClick={() => void choose('cloud')}>使用云端数据</Button><Button disabled={busy} variant="outline" className="w-full" onClick={() => setConfirmLocal(true)}>使用本机数据并覆盖云端</Button></div>
      : <div className="p-3 border border-red-200 bg-red-50 rounded-xl"><p className="text-sm text-red-700 mb-3">这会覆盖当前云端数据，且本期不自动合并。确定继续吗？</p><div className="flex gap-2"><Button disabled={busy} onClick={() => void choose('local')}>确认覆盖</Button><Button variant="outline" onClick={() => setConfirmLocal(false)}>取消</Button></div></div>}
  </div></Modal>;
}
