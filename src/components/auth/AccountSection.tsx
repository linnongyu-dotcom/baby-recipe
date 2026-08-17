import { useState } from 'react';
import { Cloud, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { isCloudBaseConfigured } from '@/lib/cloudbase';
import { logoutUser, syncNow } from '@/services/syncCoordinator';
import { LoginDialog } from './LoginDialog';
import { SyncStatus } from './SyncStatus';

const maskEmail = (email?: string) => {
  if (!email) return '已登录账号'; const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${name.length > 2 ? '***' : '*'}@${domain}`;
};
export function AccountSection() {
  const [login, setLogin] = useState(false); const user = useAuthStore(s => s.user);
  const dirty = useSyncStore(s => s.dirty); const configured = isCloudBaseConfigured();
  const logout = async () => { if (dirty && !confirm('仍有修改等待同步。现在退出，修改仍会保存在本机。确定退出吗？')) return; await logoutUser(); };
  return <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100 mb-6">
    <div className="flex items-start gap-3"><div className="p-2 bg-purple-100 rounded-xl"><Cloud className="w-5 h-5 text-purple-600" /></div>
      <div className="flex-1"><h2 className="font-bold text-gray-800">账号与云同步</h2>
        {!user ? <><p className="text-sm text-gray-500 mt-1">登录后可在不同设备保存宝宝档案、个人食谱和计划</p>
          <Button className="mt-4" disabled={!configured} onClick={() => setLogin(true)}>开启云同步</Button>
          {!configured && <p className="text-xs text-amber-600 mt-2">CloudBase 尚未配置，当前保持纯本地模式</p>}</>
          : <><p className="text-sm text-gray-600 mt-1">{maskEmail(user.email)}</p><div className="mt-3"><SyncStatus /></div>
            <div className="flex gap-2 mt-4"><Button size="sm" variant="outline" onClick={() => void syncNow()}><RefreshCw className="w-4 h-4" />立即同步</Button>
              <Button size="sm" variant="outline" onClick={() => void logout()}><LogOut className="w-4 h-4" />退出登录</Button></div></>}
      </div></div><LoginDialog open={login} onClose={() => setLogin(false)} />
  </section>;
}
