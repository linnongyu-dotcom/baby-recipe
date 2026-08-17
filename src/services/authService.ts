/* eslint-disable @typescript-eslint/no-explicit-any -- Auth response shapes vary across supported CloudBase Web SDK releases. */
import { getCloudBaseApp } from '@/lib/cloudbase';

export interface AuthUser { uid: string; email?: string }

function authApi(): any {
  const app = getCloudBaseApp();
  if (!app) throw new Error('CloudBase 尚未配置');
  return app.auth();
}

const userOf = (raw: any): AuthUser | null => {
  const user = raw?.user || raw;
  const uid = user?.uid || user?.id;
  return uid ? { uid, email: user.email } : null;
};

export async function restoreSession(): Promise<AuthUser | null> {
  const app = getCloudBaseApp();
  if (!app) return null;
  const auth: any = app.auth();
  return userOf(await auth.getLoginState?.());
}

export async function sendEmailCode(email: string): Promise<void> {
  const auth = authApi();
  if (typeof auth.sendEmailVerificationCode !== 'function') {
    throw new Error('当前 CloudBase Web SDK/环境未提供邮箱验证码登录，请在控制台启用邮箱验证码认证并升级 Web SDK。');
  }
  await auth.sendEmailVerificationCode(email);
}

export async function signInWithEmailCode(email: string, code: string): Promise<AuthUser> {
  const auth = authApi();
  if (typeof auth.signInWithEmailVerificationCode !== 'function') {
    throw new Error('当前 CloudBase Web SDK/环境不支持邮箱验证码登录，未自动改用其他登录方式。');
  }
  const result = await auth.signInWithEmailVerificationCode(email, code);
  const user = userOf(result) || userOf(await auth.getLoginState?.());
  if (!user) throw new Error('登录成功但未取得 CloudBase uid');
  return { ...user, email: user.email || email };
}

export async function signOut(): Promise<void> { await authApi().signOut(); }
