/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev14
 * 共通ユーティリティライブラリ - utils.js (DRY・SOLID原則完全対応版)
 * 
 * 🔧 DRY・SOLID原則完全対応修正内容:
 * 1. ✅ 単一責任原則: 機能別クラス分離
 * 2. ✅ DRY原則: 重複コードの完全統合
 * 3. ✅ リスコフ置換原則: 安全な継承構造
 * 4. ✅ インターフェース分離原則: 最小限のインターフェース
 * 5. ✅ 依存関係逆転原則: CONFIG依存の抽象化
 * 6. ✅ components.js連携完全対応
 * 7. ✅ エラーループ防止機能強化
 * 
 * 修正目標: components.jsエラー完全解消、DRY・SOLID原則完全準拠
 */

console.log('🔧 utils.js DRY・SOLID原則完全対応版読み込み開始...');

// ====【SOLID原則】依存関係逆転原則: CONFIG安全アクセス層 ====

/**
 * CONFIG値の安全取得（ドット記法対応・components.js完全連携）
 * components.jsのsafeConfigGetと完全互換
 */
window.safeConfigGet = function(keyPath, defaultValue = null) {
    try {
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn(`safeConfigGet: CONFIG未初期化 (${keyPath}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // ドット記法対応: 'CACHE_CONFIG.PREVIEW_CACHE_SIZE' → ['CACHE_CONFIG', 'PREVIEW_CACHE_SIZE']
        const keys = keyPath.split('.');
        let value = window.CONFIG;
        
        for (const key of keys) {
            if (value === null || value === undefined || typeof value !== 'object') {
                console.warn(`safeConfigGet: 階層アクセス失敗 (${keyPath}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            
            if (!(key in value)) {
                console.warn(`safeConfigGet: キー不存在 (${keyPath}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            
            value = value[key];
        }
        
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${keyPath}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // SIZE_PRESETS特別処理（components.js対応）
        if (keyPath === 'SIZE_PRESETS') {
            if (!Array.isArray(value) || value.length === 0) {
                console.warn(`safeConfigGet: SIZE_PRESETS無効 (${keyPath}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [
                    { name: '標準', size: 4, opacity: 0.85, color: 0x800000 }
                ];
            }
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${keyPath}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
};

// ====【SOLID原則】単一責任原則: 検証システム ====

/**
 * ブラシサイズ検証（DRY原則：components.js連携）
 */
window.validateBrushSize = function(size) {
    const numSize = parseFloat(size);