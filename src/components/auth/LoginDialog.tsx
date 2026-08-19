import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { authErrorMessage, sendEmailCode, signInWithEmailCode, type EmailVerificationInfo } from '@/services/authService';
import { activateUser } from '@/services/syncCoordinator';

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [verificationInfo, setVerificationInfo] = useState<EmailVerificationInfo | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); } };
  return <Modal isOpen={open} onClose={onClose} title="开启云同步"><div className="space-y-4">
    <p className="text-sm text-gray-500">使用邮箱验证码登录，在不同设备恢复宝宝档案、个人食谱和计划。</p>
    <input type="email" value={email} onChange={e => { setEmail(e.target.value); setVerificationInfo(null); setCode(''); }} placeholder="邮箱地址" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none" />
    {verificationInfo && <input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} placeholder="邮箱验证码" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none" />}
    {error && <p className="text-sm text-red-500">{error}</p>}
    {!verificationInfo ? <Button className="w-full" disabled={busy || !email} onClick={() => void run(async () => { setVerificationInfo(await sendEmailCode(email)); })}>{busy ? '发送中…' : '发送验证码'}</Button>
      : <Button className="w-full" disabled={busy || !code} onClick={() => void run(async () => { const user = await signInWithEmailCode(email, code, verificationInfo); await activateUser(user); onClose(); })}>{busy ? '登录中…' : '登录并开启同步'}</Button>}
    <p className="text-xs text-gray-400 text-center">登录为可选项，不影响本机使用。我们不会使用匿名身份代替您登录。</p>
  </div></Modal>;
}
