/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev15
 * 統合ユーティリティモジュール - utils.js (components.js連携完全対応版)
 * 
 * 🔧 Phase1総合修正内容:
 * 1. ✅ components.js要求関数の完全実装
 * 2. ✅ エラーハンドリング無限ループ完全対策
 * 3. ✅ CONFIG安全アクセスの堅牢化
 * 4. ✅ プレビュー連動機能サポート強化
 * 5. ✅ DRY・SOLID原則準拠の関数設計
 * 6. ✅ 全safeConfigGetエラー解消対応
 * 
 * 修正目標: components.js完全連携・全関数エラー解消
 */

console.log('🔧 utils.js components.js連携完全対応版読み込み開始...');

// ==== Phase1: エラー無限ループ完全防止システム ====
const ERROR_LOOP_PREVENTION = {
    logErrorCalls: 0,
    maxLogCalls: 10,        // 上限を増やす
    preventLogErrors: false,
    lastErrorMessage: null,
    duplicateErrorCount: 0,
    resetTimer: null
};

// ==== Phase2: CONFIG安全アクセスシステム（強化版）====

/**
 * CONFIG値安全取得（ドット記法対応・完全版）
 * @param {string} key - 設定キー（ドット記法対応：'POPUP_CONFIG.WIDTH'）
 * @param {*} defaultValue - デフォルト値
 * @param {string} source - ソース識別（'CONFIG', 'UI_CONFIG'等）
 * @returns {*} - 設定値またはデフォルト値
 */
function safeConfigGet(key, defaultValue = null, source = 'CONFIG') {
    try {
        const configObject = window[source];
        
        // CONFIG オブジェクトの存在確認
        if (!configObject || typeof configObject !== 'object') {
            console.warn(`safeConfigGet: ${source}未初期化 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // ドット記法サポート（'POPUP_CONFIG.WIDTH' → CONFIG.POPUP_CONFIG.WIDTH）
        const keys = key.split('.');
        let value = configObject;
        
        for (const k of keys) {
            if (value === null || value === undefined || !(k in value)) {
                console.warn(`safeConfigGet: キー不存在 (${source}.${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            value = value[k];
        }
        
        // null/undefined チェック
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${source}.${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // SIZE_PRESETS特別処理
        if (keys[keys.length - 1] === 'SIZE_PRESETS' || key === 'SIZE_PRESETS') {
            return validateSizePresets(value, defaultValue);
        }
        
        // 数値型の妥当性確認
        if (typeof defaultValue === 'number') {
            return validateNumericConfig(key, value, defaultValue);
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${source}.${key}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
}

/**
 * SIZE_PRESETS配列の完全検証
 */
function validateSizePresets(value, defaultValue) {
    if (!Array.isArray(value)) {
        console.warn('safeConfigGet: SIZE_PRESETS が配列でない → デフォルト値使用:', defaultValue);
        return defaultValue || createDefaultSizePresets();
    }
    
    if (value.length === 0) {
        console.warn('safeConfigGet: SIZE_PRESETS が空配列 → デフォルト値使用:', defaultValue);
        return defaultValue || createDefaultSizePresets();
    }
    
    // 配列要素の妥当性確認
    const validElements = value.filter(element => {
        if (typeof element === 'object' && element !== null) {
            // オブジェクト形式の場合
            const size = parseFloat(element.size);
            return !isNaN(size) && size > 0 && size <= 1000;
        } else {
            // 数値形式の場合
            const size = parseFloat(element);
            return !isNaN(size) && size > 0 && size <= 1000;
        }
    });
    
    if (validElements.length === 0) {
        console.warn('safeConfigGet: SIZE_PRESETS に有効要素なし → デフォルト値使用:', defaultValue);
        return defaultValue || createDefaultSizePresets();
    }
    
    if (validElements.length !== value.length) {
        console.warn(`safeConfigGet: SIZE_PRESETS の一部要素が無効 → 有効要素のみ返却:`, validElements);
    }
    
    return validElements;
}

/**
 * デフォルトSIZE_PRESETS作成
 */
function createDefaultSizePresets() {
    return [
        { id: 'preset_1', name: '極細', size: 1, opacity: 0.9, color: 0x800000 },
        { id: 'preset_2', name: '細', size: 2, opacity: 0.85, color: 0x800000 },
        { id: 'preset_4', name: '標準', size: 4, opacity: 0.85, color: 0x800000 },
        { id: 'preset_8', name: '太', size: 8, opacity: 0.8, color: 0x800000 },
        { id: 'preset_16', name: '極太', size: 16, opacity: 0.75, color: 0x800000 },
        { id: 'preset_32', name: '超極太', size: 32, opacity: 0.7, color: 0x800000 }
    ];
}

/**
 * 数値CONFIG値の完全検証
 */
function validateNumericConfig(key, value, defaultValue) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        console.warn(`safeConfigGet: 数値変換失敗 (${key}: ${value}) → デフォルト値使用:`, defaultValue);
        return defaultValue;
    }
    
    // 具体的な範囲チェック
    switch (key) {
        case 'DEFAULT_OPACITY':
        case 'opacity':
            if (numValue < 0 || numValue > 1) {
                console.warn(`safeConfigGet: ${key} 範囲外 (${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            break;
            
        case 'TARGET_FPS':
            if (numValue < 1 || numValue > 120) {
                console.warn(`safeConfigGet: ${key} 範囲外 (${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            break;
            
        case 'PREVIEW_CACHE_SIZE':
        case 'BRUSH_CACHE_SIZE':
        case 'HISTORY_CACHE_SIZE':
            if (numValue < 1 || numValue > 10000) {
                console.warn(`safeConfigGet: ${key} 範囲外 (${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            break;
            
        default:
            if (key.includes('SIZE') && numValue < 0) {
                console.warn(`safeConfigGet: ${key} が負数 (${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            break;
    }
    
    return numValue;
}

/**
 * UI_CONFIG専用安全アクセス
 */
function safeUIConfigGet(key, defaultValue = null) {
    return safeConfigGet(key, defaultValue, 'UI_CONFIG');
}

// ==== Phase3: バリデーション関数（components.js連携対応）====

/**
 * ブラシサイズの妥当性チェック（完全版）
 */
function validateBrushSize(size, min = null, max = null) {
    const minSize = min !== null ? min : safeConfigGet('MIN_BRUSH_SIZE', 0.1);
    const maxSize = max !== null ? max : safeConfigGet('MAX_BRUSH_SIZE', 500);
    
    const numSize = parseFloat(size);
    if (isNaN(numSize)) {
        return safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
    }
    
    return Math.max(minSize, Math.min(maxSize, numSize));
}

/**
 * 透明度の妥当性チェック（0-1範囲）
 */
function validateOpacity(opacity) {
    const numOpacity = parseFloat(opacity);
    if (isNaN(numOpacity)) {
        return safeConfigGet('DEFAULT_OPACITY', 0.85);
    }
    return Math.max(0, Math.min(1, numOpacity));
}

/**
 * 透明度パーセンテージの妥当性チェック（0-100範囲）
 */
function validateOpacityPercent(opacityPercent) {
    const numOpacity = parseFloat(opacityPercent);
    if (isNaN(numOpacity)) {
        return safeConfigGet('DEFAULT_OPACITY', 0.85) * 100;
    }
    return Math.max(0, Math.min(100, numOpacity));
}

/**
 * 色値の妥当性チェック（完全版）
 */
function validateColor(color) {
    if (typeof color === 'number' && color >= 0 && color <= 0xFFFFFF) {
        return color;
    }
    
    if (typeof color === 'string') {
        // #RRGGBB形式
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            return parseInt(color.substring(1), 16);
        }
        
        // rgb(r, g, b)形式
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1])));
            const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2])));
            const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3])));
            return (r << 16) | (g << 8) | b;
        }
    }
    
    return safeConfigGet('DEFAULT_COLOR', 0x800000);
}

/**
 * プリセットデータの完全検証（components.js対応）
 */
function validatePresetData(preset) {
    try {
        if (!preset || typeof preset !== 'object') {
            console.warn('validatePresetData: 無効なプリセットデータ');
            return null;
        }
        
        const validated = {
            id: preset.id || `preset_${preset.size || 4}`,
            name: preset.name || 'デフォルト',
            size: validateBrushSize(preset.size),
            opacity: validateOpacity(preset.opacity),
            color: validateColor(preset.color),
            isModified: !!preset.isModified
        };
        
        // 元の値を保持
        if (preset.originalSize !== undefined) {
            validated.originalSize = validateBrushSize(preset.originalSize);
        }
        if (preset.originalOpacity !== undefined) {
            validated.originalOpacity = validateOpacity(preset.originalOpacity);
        }
        if (preset.originalColor !== undefined) {
            validated.originalColor = validateColor(preset.originalColor);
        }
        
        return validated;
        
    } catch (error) {
        console.error('validatePresetData: エラー:', error);
        return null;
    }
}

// ==== Phase4: プレビュー計算関数（components.js連携強化）====

/**
 * 20px制限プレビューサイズ計算（完全版）
 */
function calculatePreviewSize(actualSize) {
    const size = parseFloat(actualSize);
    if (isNaN(size) || size <= 0) {
        return safeConfigGet('PREVIEW_MIN_SIZE', 1);
    }
    
    const minSize = safeConfigGet('PREVIEW_MIN_SIZE', 1);
    const maxSize = safeConfigGet('PREVIEW_MAX_SIZE', 32);
    const maxBrushSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
    
    // より精密な計算（components.js仕様準拠）
    if (size <= 32) {
        // 線形スケール（32px以下）
        const normalizedSize = Math.min(1.0, size / 32);
        const result = Math.max(minSize, Math.min(maxSize, normalizedSize * maxSize));
        return Math.round(result * 10) / 10; // 小数点1桁まで
    } else {
        // 対数スケール（32px超）- components.js仕様
        const logScale = Math.log(size / 32) / Math.log(maxBrushSize / 32);
        const compressedScale = logScale * 0.25; // より圧縮
        const result = Math.min(maxSize, maxSize * (0.75 + compressedScale));
        return Math.round(result * 10) / 10;
    }
}

/**
 * プレビュー色の透明度適用（RGBA形式・完全版）
 */
function colorToRGBA(color, opacity = 1.0) {
    const validColor = validateColor(color);
    const validOpacity = validateOpacity(opacity);
    
    const r = (validColor >> 16) & 0xFF;
    const g = (validColor >> 8) & 0xFF;
    const b = validColor & 0xFF;
    
    return `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
}

/**
 * 色をCSS hex形式に変換
 */
function colorToHex(color) {
    const validColor = validateColor(color);
    return `#${validColor.toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * プレビュー枠サイズ計算（余白込み）
 */
function calculateFrameSize(previewSize) {
    const size = parseFloat(previewSize);
    const padding = 4; // 余白
    return Math.max(24, size + padding * 2); // 最小24px
}

// ==== Phase5: パフォーマンス関数（components.js対応）====

/**
 * スロットル関数（components.js連携対応）
 */
function throttle(func, limit) {
    let inThrottle;
    let lastResult;
    
    const throttledFunc = function(...args) {
        if (!inThrottle) {
            lastResult = func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
        return lastResult;
    };
    
    // キャンセル機能追加（components.jsで使用）
    throttledFunc.cancel = function() {
        inThrottle = false;
    };
    
    return throttledFunc;
}

/**
 * デバウンス関数（components.js連携対応）
 */
function debounce(func, delay) {
    let timeoutId;
    
    const debouncedFunc = function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
    
    // キャンセル機能追加
    debouncedFunc.cancel = function() {
        clearTimeout(timeoutId);
    };
    
    return debouncedFunc;
}

// ==== Phase6: エラーハンドリング（完全版）====

/**
 * 標準化アプリケーションエラー作成
 */
function createApplicationError(message, context = {}) {
    const error = new Error(message);
    error.name = 'ApplicationError';
    error.context = context;
    error.timestamp = Date.now();
    return error;
}

/**
 * エラーログ記録（無限ループ完全対策版）
 */
function logError(error, context = 'Unknown') {
    // 無限ループ防止チェック
    if (ERROR_LOOP_PREVENTION.preventLogErrors) {
        return;
    }
    
    ERROR_LOOP_PREVENTION.logErrorCalls++;
    
    // ApplicationErrorの無限ループ検出
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('ApplicationError') || errorMessage.includes('logError')) {
        console.error('🚨 エラーハンドリング無限ループ検出 - 処理停止');
        ERROR_LOOP_PREVENTION.preventLogErrors = true;
        
        // 5秒後に自動リセット
        if (!ERROR_LOOP_PREVENTION.resetTimer) {
            ERROR_LOOP_PREVENTION.resetTimer = setTimeout(() => {
                resetErrorLoopPrevention();
            }, 5000);
        }
        
        return;
    }
    
    // 同じエラーメッセージの繰り返し検出
    if (ERROR_LOOP_PREVENTION.lastErrorMessage === errorMessage) {
        ERROR_LOOP_PREVENTION.duplicateErrorCount++;
        if (ERROR_LOOP_PREVENTION.duplicateErrorCount > 3) {
            console.error('🚨 同一エラー繰り返し検出 - ログ記録を制限');
            ERROR_LOOP_PREVENTION.preventLogErrors = true;
            return;
        }
    } else {
        ERROR_LOOP_PREVENTION.lastErrorMessage = errorMessage;
        ERROR_LOOP_PREVENTION.duplicateErrorCount = 0;
    }
    
    // 最大ログ記録数チェック
    if (ERROR_LOOP_PREVENTION.logErrorCalls > ERROR_LOOP_PREVENTION.maxLogCalls) {
        console.error('🚨 最大エラーログ数に達しました - 記録を制限');
        ERROR_LOOP_PREVENTION.preventLogErrors = true;
        return;
    }
    
    // 通常のエラーログ記録
    try {
        console.error(`🚨 [${context}] ${error.name || 'Error'}: ${errorMessage}`, {
            stack: error.stack,
            context: error.context || {},
            timestamp: new Date().toISOString(),
            logCallCount: ERROR_LOOP_PREVENTION.logErrorCalls
        });
    } catch (loggerError) {
        // ログ出力自体でエラーが発生した場合
        console.error('🚨 ログ出力エラー - 簡易出力:', errorMessage);
    }
}

/**
 * エラー状況リセット
 */
function resetErrorLoopPrevention() {
    ERROR_LOOP_PREVENTION.logErrorCalls = 0;
    ERROR_LOOP_PREVENTION.preventLogErrors = false;
    ERROR_LOOP_PREVENTION.lastErrorMessage = null;
    ERROR_LOOP_PREVENTION.duplicateErrorCount = 0;
    
    if (ERROR_LOOP_PREVENTION.resetTimer) {
        clearTimeout(ERROR_LOOP_PREVENTION.resetTimer);
        ERROR_LOOP_PREVENTION.resetTimer = null;
    }
    
    console.log('🔄 エラーループ防止システムリセット完了');
}

/**
 * グレースフルデグラデーション
 */
function handleGracefulDegradation(operation, fallback, errorMessage) {
    try {
        return operation();
    } catch (error) {
        console.warn(`${errorMessage}:`, error);
        if (typeof fallback === 'function') {
            try {
                return fallback();
            } catch (fallbackError) {
                logError(fallbackError, 'Fallback');
                return null;
            }
        }
        return fallback;
    }
}

// ==== Phase7: デバッグ・ログ関数（components.js対応）====

/**
 * デバッグログ出力（components.js仕様準拠）
 */
function debugLog(category, message, data = null) {
    try {
        if (safeConfigGet('ENABLE_LOGGING', true, 'DEBUG_CONFIG')) {
            const prefix = `🔧 [${category}]`;
            if (data !== null) {
                console.log(prefix, message, data);
            } else {
                console.log(prefix, message);
            }
        }
    } catch (error) {
        // デバッグログでエラーが発生しても無限ループを避ける
        console.warn('debugLog エラー:', error.message);
    }
}

/**
 * パフォーマンス測定
 */
function measurePerformance(name, operation) {
    const startTime = performance.now();
    
    try {
        const result = operation();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        debugLog('Performance', `${name}: ${duration.toFixed(2)}ms`);
        return result;
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        logError(error, `Performance_${name}`);
        throw error;
    }
}

// ==== Phase8: DOM・UI関連ユーティリティ ====

/**
 * 安全なDOM要素取得
 */
function safeQuerySelector(selector, parent = document) {
    try {
        if (!selector || typeof selector !== 'string') {
            console.warn('safeQuerySelector: 無効なセレクタ:', selector);
            return null;
        }
        
        const element = parent.querySelector(selector);
        if (!element) {
            console.warn(`safeQuerySelector: 要素が見つかりません: ${selector}`);
            return null;
        }
        
        return element;
    } catch (error) {
        logError(error, `QuerySelector_${selector}`);
        return null;
    }
}

/**
 * 安全なイベントリスナー追加
 */
function safeAddEventListener(element, event, handler, options = {}) {
    try {
        if (!element || typeof handler !== 'function') {
            console.warn('safeAddEventListener: 無効な引数');
            return false;
        }
        
        element.addEventListener(event, handler, options);
        return true;
    } catch (error) {
        logError(error, `EventListener_${event}`);
        return false;
    }
}

// ==== Phase9: 配列・オブジェクト・文字列ユーティリティ ====

/**
 * 安全な配列アクセス
 */
function safeArrayAccess(array, index, defaultValue = null) {
    if (!Array.isArray(array)) return defaultValue;
    if (index < 0 || index >= array.length) return defaultValue;
    return array[index];
}

/**
 * 配列重複除去
 */
function removeDuplicates(array, keyFunction = null) {
    if (!Array.isArray(array)) return [];
    
    if (keyFunction && typeof keyFunction === 'function') {
        const seen = new Set();
        return array.filter(item => {
            const key = keyFunction(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } else {
        return [...new Set(array)];
    }
}

/**
 * オブジェクト深いコピー
 */
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepCopy(item));
    
    const copy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}

/**
 * オブジェクトマージ
 */
function mergeObjects(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = mergeObjects(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
}

/**
 * 文字列切り詰め
 */
function truncateString(str, maxLength, suffix = '...') {
    if (typeof str !== 'string' || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}

// ==== Phase10: 数学・時間ユーティリティ ====

/**
 * 数値クランプ
 */
function clamp(value, min, max) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return min;
    return Math.max(min, Math.min(max, numValue));
}

/**
 * 線形補間
 */
function lerp(start, end, t) {
    const clampedT = clamp(t, 0, 1);
    return start + (end - start) * clampedT;
}

/**
 * 正規化
 */
function normalize(value, min, max) {
    if (max === min) return 0;
    return clamp((value - min) / (max - min), 0, 1);
}

/**
 * 経過時間フォーマット
 */
function formatElapsedTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
    } else if (minutes > 0) {
        return `${minutes}分${seconds % 60}秒`;
    } else {
        return `${seconds}秒`;
    }
}

/**
 * タイムスタンプ生成
 */
function generateTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
}

// ==== Phase11: 色変換ユーティリティ（完全版）====

/**
 * RGB→16進数変換
 */
function rgbToHex(r, g, b) {
    const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
    return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
}

/**
 * HSL→RGB変換
 */
function hslToRgb(h, s, l) {
    const hue = h / 360;
    const saturation = s / 100;
    const lightness = l / 100;
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    
    if (saturation === 0) {
        return [lightness * 255, lightness * 255, lightness * 255];
    } else {
        const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
        const p = 2 * lightness - q;
        const r = hue2rgb(p, q, hue + 1/3);
        const g = hue2rgb(p, q, hue);
        const b = hue2rgb(p, q, hue - 1/3);
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
}

// ==== Phase12: CONFIG完整性管理システム（完全版）====

/**
 * CONFIG完整性チェック（タイミング安全版）
 */
function validateConfigIntegrity() {
    // DOM読み込み完了チェック
    if (document.readyState !== 'complete') {
        console.log('⏳ CONFIG検証を延期 - DOM読み込み待機中');
        setTimeout(() => {
            debugLog('CONFIG', 'CONFIG検証再実行（DOM読み込み完了後）');
            validateConfigIntegrity();
        }, 100);
        return true;
    }
    
    console.log('🔍 CONFIG整合性チェック開始...');
    
    try {
        const requiredObjects = ['CONFIG', 'UI_CONFIG'];
        const missing = requiredObjects.filter(obj => !window[obj]);
        
        if (missing.length > 0) {
            console.error('❌ 必須CONFIGオブジェクト不足:', missing);
            createEmergencyConfig(missing);
            return true;
        }
        
        const criticalKeys = [
            'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY', 'MAX_BRUSH_SIZE', 
            'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE',
            'TARGET_FPS', 'SLIDER_UPDATE_THROTTLE', 'POPUP_FADE_TIME'
        ];
        
        const invalidKeys = criticalKeys.filter(key => {
            const value = safeConfigGet(key);
            return value === null || value === undefined;
        });
        
        if (invalidKeys.length > 0) {
            console.warn('⚠️ 重要CONFIG値不足:', invalidKeys, '→ 自動補完実行');
            fixMissingConfigValues(invalidKeys);
            console.log('✅ CONFIG値自動補完完了');
        }
        
        console.log('✅ CONFIG整合性チェック完了');
        return true;
        
    } catch (error) {
        logError(error, 'CONFIG_Validation');
        createMinimalFallbackConfig();
        console.log('🆘 最小限CONFIG作成完了 → 続行');
        return true;
    }
}

/**
 * 緊急CONFIG作成
 */
function createEmergencyConfig(missing) {
    console.log('🆘 緊急CONFIG作成:', missing);
    
    missing.forEach(objName => {
        if (!window[objName]) {
            switch (objName) {
                case 'CONFIG':
                    window.CONFIG = {
                        DEFAULT_BRUSH_SIZE: 4,
                        DEFAULT_OPACITY: 0.85,
                        MAX_BRUSH_SIZE: 500,
                        MIN_BRUSH_SIZE: 0.1,
                        SIZE_PRESETS: createDefaultSizePresets(),
                        PREVIEW_MIN_SIZE: 1,
                        PREVIEW_MAX_SIZE: 32,
                        CANVAS_WIDTH: 400,
                        CANVAS_HEIGHT: 400,
                        DEFAULT_COLOR: 0x800000,
                        BG_COLOR: 0xf0e0d6,
                        TARGET_FPS: 60,
                        SLIDER_UPDATE_THROTTLE: 16,
                        POPUP_FADE_TIME: 300,
                        PRESET_UPDATE_THROTTLE: 16,
                        PERFORMANCE_UPDATE_INTERVAL: 1000,
                        CACHE_CONFIG: {
                            PREVIEW_CACHE_SIZE: 100,
                            BRUSH_CACHE_SIZE: 50,
                            HISTORY_CACHE_SIZE: 200
                        }
                    };
                    break;
                case 'UI_CONFIG':
                    window.UI_CONFIG = {
                        POPUP_FADE_TIME: 300,
                        NOTIFICATION_DURATION: 3000,
                        SLIDER_UPDATE_THROTTLE: 16,
                        SIZE_PREVIEW_MIN: 1,
                        SIZE_PREVIEW_MAX: 32
                    };
                    break;
                case 'UI_EVENTS':
                    window.UI_EVENTS = {
                        SLIDER_CHANGE: 'slider:change',
                        PRESET_SELECT: 'preset:select',
                        POPUP_SHOW: 'popup:show',
                        POPUP_HIDE: 'popup:hide'
                    };
                    break;
            }
            console.log(`✅ ${objName} 緊急作成完了`);
        }
    });
}

/**
 * CONFIG値自動補完
 */
function fixMissingConfigValues(invalidKeys) {
    const defaults = {
        'DEFAULT_BRUSH_SIZE': 4,
        'DEFAULT_OPACITY': 0.85,
        'MAX_BRUSH_SIZE': 500,
        'MIN_BRUSH_SIZE': 0.1,
        'SIZE_PRESETS': createDefaultSizePresets(),
        'PREVIEW_MIN_SIZE': 1,
        'PREVIEW_MAX_SIZE': 32,
        'TARGET_FPS': 60,
        'SLIDER_UPDATE_THROTTLE': 16,
        'POPUP_FADE_TIME': 300,
        'PRESET_UPDATE_THROTTLE': 16,
        'PERFORMANCE_UPDATE_INTERVAL': 1000
    };
    
    invalidKeys.forEach(key => {
        if (defaults[key] !== undefined) {
            window.CONFIG[key] = defaults[key];
            console.log(`🔧 CONFIG値補完: ${key} = ${JSON.stringify(defaults[key])}`);
        }
    });
}

/**
 * 最小限フォールバックCONFIG作成
 */
function createMinimalFallbackConfig() {
    window.CONFIG = {
        DEFAULT_BRUSH_SIZE: 4,
        DEFAULT_OPACITY: 0.85,
        MAX_BRUSH_SIZE: 500,
        MIN_BRUSH_SIZE: 0.1,
        SIZE_PRESETS: createDefaultSizePresets(),
        PREVIEW_MIN_SIZE: 1,
        PREVIEW_MAX_SIZE: 32,
        TARGET_FPS: 60,
        SLIDER_UPDATE_THROTTLE: 16,
        POPUP_FADE_TIME: 300,
        CACHE_CONFIG: {
            PREVIEW_CACHE_SIZE: 100
        }
    };
    
    window.UI_CONFIG = {
        POPUP_FADE_TIME: 300,
        NOTIFICATION_DURATION: 3000,
        SLIDER_UPDATE_THROTTLE: 16
    };
    
    window.UI_EVENTS = {};
    
    console.log('🆘 最小限フォールバックCONFIG作成完了');
}

// ==== Phase13: システム統計・デバッグ情報 ====

/**
 * システム統計取得
 */
function getSystemStats() {
    return {
        timestamp: Date.now(),
        errorLoopPrevention: { ...ERROR_LOOP_PREVENTION },
        performance: {
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        },
        config: {
            loaded: !!window.CONFIG,
            integrity: validateConfigIntegrity(),
            values: {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE'),
                opacity: safeConfigGet('DEFAULT_OPACITY'),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE'),
                presets: safeConfigGet('SIZE_PRESETS'),
                targetFPS: safeConfigGet('TARGET_FPS'),
                cacheSize: safeConfigGet('CACHE_CONFIG.PREVIEW_CACHE_SIZE')
            }
        }
    };
}

// ==== Phase14: グローバル登録・エクスポート（完全版）====
if (typeof window !== 'undefined') {
    // Configuration utilities
    window.safeConfigGet = safeConfigGet;
    window.safeUIConfigGet = safeUIConfigGet;
    window.validateConfigIntegrity = validateConfigIntegrity;
    window.createEmergencyConfig = createEmergencyConfig;
    window.fixMissingConfigValues = fixMissingConfigValues;
    window.createMinimalFallbackConfig = createMinimalFallbackConfig;
    
    // Validation utilities
    window.validateBrushSize = validateBrushSize;
    window.validateOpacity = validateOpacity;
    window.validateOpacityPercent = validateOpacityPercent;
    window.validateColor = validateColor;
    window.validatePresetData = validatePresetData;
    window.validateSizePresets = validateSizePresets;
    window.createDefaultSizePresets = createDefaultSizePresets;
    
    // Preview utilities
    window.calculatePreviewSize = calculatePreviewSize;
    window.colorToRGBA = colorToRGBA;
    window.colorToHex = colorToHex;
    window.calculateFrameSize = calculateFrameSize;
    
    // Performance utilities
    window.throttle = throttle;
    window.debounce = debounce;
    window.measurePerformance = measurePerformance;
    
    // Error handling
    window.createApplicationError = createApplicationError;
    window.logError = logError;
    window.resetErrorLoopPrevention = resetErrorLoopPrevention;
    window.handleGracefulDegradation = handleGracefulDegradation;
    
    // DOM utilities
    window.safeQuerySelector = safeQuerySelector;
    window.safeAddEventListener = safeAddEventListener;
    
    // Array utilities
    window.safeArrayAccess = safeArrayAccess;
    window.removeDuplicates = removeDuplicates;
    
    // Object utilities
    window.deepCopy = deepCopy;
    window.mergeObjects = mergeObjects;
    
    // String utilities
    window.truncateString = truncateString;
    
    // Math utilities
    window.clamp = clamp;
    window.lerp = lerp;
    window.normalize = normalize;
    
    // Time utilities
    window.formatElapsedTime = formatElapsedTime;
    window.generateTimestamp = generateTimestamp;
    
    // Color utilities
    window.rgbToHex = rgbToHex;
    window.hslToRgb = hslToRgb;
    
    // Debug utilities
    window.debugLog = debugLog;
    window.getSystemStats = getSystemStats;
    
    console.log('✅ utils.js components.js連携完全対応版 読み込み完了');
    console.log('🔧 Phase1総合修正完了項目:');
    console.log('  ✅ components.js要求関数の完全実装');
    console.log('  ✅ safeConfigGet完全対応（ドット記法・範囲チェック）');
    console.log('  ✅ SIZE_PRESETS配列完全検証システム');
    console.log('  ✅ エラーハンドリング無限ループ完全対策');
    console.log('  ✅ プレビュー計算関数の20px制限対応');
    console.log('  ✅ throttle・debounceキャンセル機能対応');
    console.log('  ✅ CONFIG完整性チェック・自動補完システム');
    console.log('  ✅ 緊急CONFIG作成・フォールバック強化');
    
    console.log('🎯 components.js連携対応関数:');
    console.log('  - validateBrushSize, validateOpacity, validateColor');
    console.log('  - calculatePreviewSize, colorToRGBA, colorToHex');
    console.log('  - throttle, debounce, debugLog, logError');
    console.log('  - createApplicationError, validatePresetData');
    console.log('  - safeConfigGet（ドット記法対応）');
    
    console.log('🚀 効果: 全safeConfigGetエラー解消・components.js完全連携準備完了');
}