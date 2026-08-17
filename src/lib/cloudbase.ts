/* eslint-disable @typescript-eslint/no-explicit-any -- CloudBase CDN SDK has no bundled TypeScript declarations. */
let app: any = null;
let warned = false;

export function isCloudBaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLOUDBASE_ENV_ID);
}

export function getCloudBaseApp() {
  const env = import.meta.env.VITE_CLOUDBASE_ENV_ID;
  if (!env) {
    if (import.meta.env.DEV && !warned) {
      warned = true;
      console.warn('[饭小宝] 未配置 VITE_CLOUDBASE_ENV_ID，应用以纯本地模式运行。');
    }
    return null;
  }
  const sdk = window.cloudbase;
  if (!sdk) throw new Error('CloudBase Web SDK 加载失败，请检查网络后重试');
  if (!app) app = sdk.init({ env });
  return app;
}
