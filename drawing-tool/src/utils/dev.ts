/**
 * 開発環境判定ユーティリティ
 * Vite環境変数への安全なアクセス
 */

/**
 * 開発環境かどうかを判定
 * @returns 開発環境の場合true
 */
export function isDevelopment(): boolean {
  try {
    // Vite環境変数チェック
    if (typeof import !== 'undefined' && import.meta?.env?.DEV) {
      return true;
    }
    
    // Node.js環境チェック
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }
    
    // その他の開発環境判定
    if (typeof location !== 'undefined' && location.hostname === 'localhost') {
      return true;
    }
    
    return false;
  } catch (error) {
    // エラー時は本番環境として扱う
    return false;
  }
}

/**
 * 本番環境かどうかを判定
 * @returns 本番環境の場合true
 */
export function isProduction(): boolean {
  return !isDevelopment();
}

/**
 * 開発環境でのみ実行する関数
 * @param callback 開発環境でのみ実行したい処理
 */
export function devOnly(callback: () => void): void {
  if (isDevelopment()) {
    callback();
  }
}

/**
 * 本番環境でのみ実行する関数
 * @param callback 本番環境でのみ実行したい処理
 */
export function prodOnly(callback: () => void): void {
  if (isProduction()) {
    callback();
  }
}

/**
 * 開発環境のログ出力
 * @param args ログ引数
 */
export function devLog(...args: any[]): void {
  devOnly(() => {
    console.log('[DEV]', ...args);
  });
}

/**
 * 開発環境の警告出力
 * @param args 警告引数
 */
export function devWarn(...args: any[]): void {
  devOnly(() => {
    console.warn('[DEV]', ...args);
  });
}

/**
 * 開発環境のエラー出力
 * @param args エラー引数
 */
export function devError(...args: any[]): void {
  devOnly(() => {
    console.error('[DEV]', ...args);
  });
}