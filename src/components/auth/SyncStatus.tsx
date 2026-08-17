import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useSyncStore } from '@/stores/syncStore';
import { syncNow } from '@/services/syncCoordinator';

const labels = { 'local-only': '已保存到本机', syncing: '正在同步', synced: '已同步', offline: '网络不可用，数据已保存到本机', error: '同步失败，点击重试' };
export function SyncStatus() {
  const { status, error } = useSyncStore();
  return <button type="button" onClick={() => status === 'error' && void syncNow()} className="flex items-center gap-2 text-sm text-gray-500">
    {status === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin" /> : status === 'offline' || status === 'error' ? <CloudOff className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
    <span>{labels[status]}</span>{status === 'error' && <RefreshCw className="w-3.5 h-3.5" />}
    {error && <span className="sr-only">{error}</span>}
  </button>;
}
