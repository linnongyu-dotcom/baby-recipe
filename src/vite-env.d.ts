/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV_ID?: string
  readonly VITE_POSTHOG_PROJECT_TOKEN?: string
  readonly VITE_POSTHOG_HOST?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loaded from the official CDN at runtime
interface Window { cloudbase?: { init(options: { env: string }): any } }
