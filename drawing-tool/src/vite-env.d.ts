/// <reference types="vite/client" />

// Vite環境変数の型定義
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  // その他の環境変数をここに追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// グローバル型定義
declare global {
  const __DEV__: boolean;
}

export {};