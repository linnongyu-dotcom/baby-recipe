/// <reference types="vite/client" />

interface ImportMetaEnv { readonly VITE_CLOUDBASE_ENV_ID?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loaded from the official CDN at runtime
interface Window { cloudbase?: { init(options: { env: string }): any } }
