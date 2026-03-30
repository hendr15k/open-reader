/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JULES_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}