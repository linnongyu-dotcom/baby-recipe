/* eslint-disable @typescript-eslint/no-explicit-any -- Auth response shapes vary across supported CloudBase Web SDK releases. */
import { getCloudBaseApp } from '@/lib/cloudbase';

export interface AuthUser { uid: string; email?: string }
export type EmailVerificationInfo = Record<string, unknown>;
let authInstance: any = null;

function authApi(): any {
  const app = getCloudBaseApp();
  if (!app) throw new Error('CloudBase 尚未配置');
  // CloudBase requires exactly one auth object per app instance. Recreating it
  // for session restore, verification and sign-in produces INVALID_OPERATION.
  if (!authInstance) authInstance = app.auth();
  return authInstance;
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const detail = error as Record<string, unknown>;
    const message = detail.message || detail.error_description || detail.msg;
    if (typeof message === 'string' && message) return message;
    if (typeof detail.code === 'string' && detail.code) return `CloudBase 请求失败：${detail.code}`;
  }
  return 'CloudBase 请求失败，请检查网络与认证配置后重试';
}

const userOf = (raw: any): AuthUser | null => {
  const user = raw?.user || raw;
  const uid = user?.uid || user?.id;
  return uid ? { uid, email: user.email } : null;
};

export async function restoreSession(): Promise<AuthUser | null> {
  const app = getCloudBaseApp();
  if (!app) return null;
  const auth = authApi();
  return userOf(await auth.getLoginState?.());
}

export async function sendEmailCode(email: string): Promise<EmailVerificationInfo> {
  const auth = authApi();
  if (typeof auth.getVerification !== 'function') {
    throw new Error('当前 CloudBase Web SDK/环境未提供邮箱验证码登录，请在控制台启用邮箱验证码认证并升级 Web SDK。');
  }
  return await auth.getVerification({ email });
}

export async function signInWithEmailCode(email: string, code: string, verificationInfo: EmailVerificationInfo): Promise<AuthUser> {
  const auth = authApi();
  if (typeof auth.signInWithEmail !== 'function') {
    throw new Error('当前 CloudBase Web SDK/环境不支持邮箱验证码登录，未自动改用其他登录方式。');
  }
  const result = await auth.signInWithEmail({ email, verificationInfo, verificationCode: code });
  const user = userOf(result) || userOf(await auth.getLoginState?.());
  if (!user) throw new Error('登录成功但未取得 CloudBase uid');
  return { ...user, email: user.email || email };
}

export async function signOut(): Promise<void> { await authApi().signOut(); }
