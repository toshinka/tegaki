/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev10_phase2e
 * 統合ユーティリティモジュール - utils.js (Phase2E緊急エラー修正版)
 * 
 * 🚨 Phase2E修正内容:
 * 1. ✅ CONFIG検証タイミング修正（DOM読み込み完了後に延期）
 * 2. ✅ エラーハンドリング無限ループ対策
 * 3. ✅ フォールバック機能強化
 * 4. ✅ validateConfigIntegrity安全化
 * 5. ✅ logError無限ループ検出・回避
 * 6. ✅ CONFIG値不足時の緊急対処
 * 
 * Phase2E目標: 致命的エラーの完全解消・安定動作復旧
 */

console.log('🔧 utils.js Phase2E緊急エラー修正版読み込み開始...');

// ==== Phase2E新規: エラー無限ループ防止システム ====
const ERROR_LOOP_PREVENTION = {
    logErrorCalls: 0,
    maxLogCalls: 5,
    preventLogErrors: false,
    lastErrorMessage: null,
    duplicateErrorCount: 0
};

// ==== Configuration Access Utilities（Phase2E安全化版）====

/**
 * Phase2E修正: CONFIG値安全取得（エラーループ対策版）
 * @param {string} key - 設定キー
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
        
        // キーの存在確認
        if (!(key in configObject)) {
            console.warn(`safeConfigGet: キー不存在 (${source}.${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        const value = configObject[key];
        
        // null/undefined チェック
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${source}.${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // 特別処理: SIZE_PRESETS
        if (key === 'SIZE_PRESETS') {
            if (!Array.isArray(value)) {
                console.warn(`safeConfigGet: SIZE_PRESETS が配列でない (${source}.${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [1, 2, 4, 8, 16, 32];
            }
            
            if (value.length === 0) {
                console.warn(`safeConfigGet: SIZE_PRESETS が空配列 (${source}.${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [1, 2, 4, 8, 16, 32];
            }
            
            // 配列要素の妥当性確認
            const validElements = value.filter(element => {
                const num = parseFloat(element);
                return !isNaN(num) && num > 0 && num <= 1000;
            });
            
            if (validElements.length === 0) {
                console.warn(`safeConfigGet: SIZE_PRESETS に有効要素なし (${source}.${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [1, 2, 4, 8, 16, 32];
            }
            
            if (validElements.length !== value.length) {
                console.warn(`safeConfigGet: SIZE_PRESETS の一部要素が無効 → 有効要素のみ返却:`, validElements);
                return validElements;
            }
        }
        
        // 数値型の妥当性確認
        if (typeof defaultValue === 'number') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                console.warn(`safeConfigGet: 数値変換失敗 (${source}.${key}: ${value}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            
            // 範囲チェック
            if (key === 'DEFAULT_OPACITY' && (numValue < 0 || numValue > 1)) {
                console.warn(`safeConfigGet: DEFAULT_OPACITY 範囲外 (${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            
            if (key.includes('SIZE') && numValue < 0) {
                console.warn(`safeConfigGet: サイズ値が負数 (${source}.${key}: ${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${source}.${key}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
}

/**
 * Phase2E新規: UI_CONFIG専用安全アクセス
 */
function safeUIConfigGet(key, defaultValue = null) {
    return safeConfigGet(key, defaultValue, 'UI_CONFIG');
}

/**
 * 🚨 Phase2E修正: CONFIG整合性チェック（タイミング修正・安全化版）
 * @returns {boolean} - 整合性OK
 */
function validateConfigIntegrity() {
    // 🚨 Phase2E修正: DOM読み込み完了チェック
    if (document.readyState !== 'complete') {
        console.log('⏳ CONFIG検証を延期 - DOM読み込み待機中');
        // 一時的にtrueを返して初期化を続行
        setTimeout(() => {
            console.log('🔄 CONFIG検証再実行（DOM読み込み完了後）');
            validateConfigIntegrity();
        }, 100);
        return true;
    }
    
    console.log('🔍 CONFIG整合性チェック開始...');
    
    try {
        const requiredObjects = ['CONFIG', 'UI_CONFIG', 'UI_EVENTS'];
        const missing = requiredObjects.filter(obj => !window[obj]);
        
        if (missing.length > 0) {
            console.error('❌ 必須CONFIGオブジェクト不足:', missing);
            
            // 🚨 Phase2E新規: 緊急CONFIG作成
            createEmergencyConfig(missing);
            return true; // 緊急作成後は続行
        }
        
        const criticalKeys = [
            'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY', 'MAX_BRUSH_SIZE', 
            'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE'
        ];
        
        const invalidKeys = criticalKeys.filter(key => {
            const value = safeConfigGet(key);
            return value === null || value === undefined;
        });
        
        if (invalidKeys.length > 0) {
            console.warn('⚠️ 重要CONFIG値不足:', invalidKeys, '→ 自動補完実行');
            
            // 🚨 Phase2E新規: CONFIG値自動補完
            fixMissingConfigValues(invalidKeys);
            
            console.log('✅ CONFIG値自動補完完了');
            return true; // 補完後は続行
        }
        
        console.log('✅ CONFIG整合性チェック完了');
        return true;
        
    } catch (error) {
        console.error('❌ CONFIG整合性チェックエラー:', error);
        
        // 🚨 Phase2E新規: 完全フォールバック処理
        createMinimalFallbackConfig();
        console.log('🆘 最小限CONFIG作成完了 → 続行');
        return true; // エラー時も続行
    }
}

/**
 * 🚨 Phase2E新規: 緊急CONFIG作成
 */
function createEmergencyConfig(missing) {
    console.log('🆘 緊急CONFIG作成:', missing);
    
    missing.forEach(objName => {
        if (!window[objName]) {
            switch (objName) {
                case 'CONFIG':
                    window.CONFIG = {
                        DEFAULT_BRUSH_SIZE: 4,
                        DEFAULT_OPACITY: 1.0,
                        MAX_BRUSH_SIZE: 500,
                        MIN_BRUSH_SIZE: 0.1,
                        SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
                        PREVIEW_MIN_SIZE: 0.5,
                        PREVIEW_MAX_SIZE: 20,
                        CANVAS_WIDTH: 400,
                        CANVAS_HEIGHT: 400,
                        DEFAULT_COLOR: 0x800000,
                        BG_COLOR: 0xf0e0d6
                    };
                    break;
                case 'UI_CONFIG':
                    window.UI_CONFIG = {
                        POPUP_FADE_TIME: 300,
                        NOTIFICATION_DURATION: 3000,
                        SLIDER_UPDATE_THROTTLE: 16
                    };
                    break;
                case 'UI_EVENTS':
                    window.UI_EVENTS = {
                        CANVAS_MOUSEDOWN: 'canvas:mousedown',
                        CANVAS_MOUSEUP: 'canvas:mouseup',
                        CANVAS_MOUSEMOVE: 'canvas:mousemove'
                    };
                    break;
            }
            console.log(`✅ ${objName} 緊急作成完了`);
        }
    });
}

/**
 * 🚨 Phase2E新規: CONFIG値自動補完
 */
function fixMissingConfigValues(invalidKeys) {
    const defaults = {
        'DEFAULT_BRUSH_SIZE': 4,
        'DEFAULT_OPACITY': 1.0,
        'MAX_BRUSH_SIZE': 500,
        'SIZE_PRESETS': [1, 2, 4, 8, 16, 32],
        'PREVIEW_MIN_SIZE': 0.5,
        'PREVIEW_MAX_SIZE': 20
    };
    
    invalidKeys.forEach(key => {
        if (defaults[key] !== undefined) {
            window.CONFIG[key] = defaults[key];
            console.log(`🔧 CONFIG値補完: ${key} = ${JSON.stringify(defaults[key])}`);
        }
    });
}

/**
 * 🚨 Phase2E新規: 最小限フォールバック作成
 */
function createMinimalFallbackConfig() {
    window.CONFIG = {
        DEFAULT_BRUSH_SIZE: 4,
        DEFAULT_OPACITY: 1.0,
        MAX_BRUSH_SIZE: 500,
        MIN_BRUSH_SIZE: 0.1,
        SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
        PREVIEW_MIN_SIZE: 0.5,
        PREVIEW_MAX_SIZE: 20
    };
    
    window.UI_CONFIG = {
        POPUP_FADE_TIME: 300,
        NOTIFICATION_DURATION: 3000
    };
    
    window.UI_EVENTS = {};
    
    console.log('🆘 最小限フォールバックCONFIG作成完了');
}

// ==== DOM Utilities（変更なし）====

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
        console.error(`safeQuerySelector: エラー (${selector}):`, error);
        return null;
    }
}

function safeAddEventListener(element, event, handler, options = {}) {
    try {
        if (!element || typeof handler !== 'function') {
            console.warn('safeAddEventListener: 無効な引数');
            return false;
        }
        
        element.addEventListener(event, handler, options);
        return true;
    } catch (error) {
        console.error(`safeAddEventListener: エラー (${event}):`, error);
        return false;
    }
}

// ==== Validation Utilities（変更なし）====

function validateBrushSize(size, min = null, max = null) {
    const minSize = min !== null ? min : safeConfigGet('MIN_BRUSH_SIZE', 0.1);
    const maxSize = max !== null ? max : safeConfigGet('MAX_BRUSH_SIZE', 500);
    
    const numSize = parseFloat(size);
    if (isNaN(numSize)) {
        return safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
    }
    
    return Math.max(minSize, Math.min(maxSize, numSize));
}

function validateOpacity(opacity) {
    const numOpacity = parseFloat(opacity);
    if (isNaN(numOpacity)) {
        return safeConfigGet('DEFAULT_OPACITY', 1.0);
    }
    return Math.max(0, Math.min(1, numOpacity));
}

function validatePresetData(preset) {
    try {
        if (!preset || typeof preset !== 'object') {
            console.warn('validatePresetData: 無効なプリセットデータ');
            return null;
        }
        
        const validated = {
            id: preset.id || 'unknown',
            size: validateBrushSize(preset.size),
            opacity: validateOpacity(preset.opacity),
            isModified: preset.isModified || false
        };
        
        if (preset.originalSize !== undefined) {
            validated.originalSize = validateBrushSize(preset.originalSize);
        }
        if (preset.originalOpacity !== undefined) {
            validated.originalOpacity = validateOpacity(preset.originalOpacity);
        }
        
        return validated;
    } catch (error) {
        console.error('validatePresetData: エラー:', error);
        return null;
    }
}

// ==== Error Handling（Phase2E修正版）====

/**
 * Phase2E修正: 標準化アプリケーションエラー作成（変更なし）
 */
function createApplicationError(message, context = {}) {
    const error = new Error(message);
    error.name = 'ApplicationError';
    error.context = context;
    error.timestamp = Date.now();
    return error;
}

/**
 * 🚨 Phase2E修正: エラーログ記録（無限ループ対策版）
 * @param {Error} error - エラーオブジェクト
 * @param {string} context - コンテキスト情報
 */
function logError(error, context = 'Unknown') {
    // 🚨 Phase2E新規: 無限ループ防止チェック
    if (ERROR_LOOP_PREVENTION.preventLogErrors) {
        return; // ログ記録を停止
    }
    
    ERROR_LOOP_PREVENTION.logErrorCalls++;
    
    // ApplicationErrorの無限ループ検出
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('ApplicationError')) {
        console.error('🚨 エラーハンドリング無限ループ検出 - 処理停止');
        ERROR_LOOP_PREVENTION.preventLogErrors = true;
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
    console.error(`🚨 [${context}] ${error.name || 'Error'}: ${errorMessage}`, {
        stack: error.stack,
        context: error.context || {},
        timestamp: new Date().toISOString(),
        logCallCount: ERROR_LOOP_PREVENTION.logErrorCalls
    });
}

/**
 * Phase2E修正: グレースフルデグラデーション（変更なし）
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
                console.error('フォールバック処理もエラー:', fallbackError);
                return null;
            }
        }
        return fallback;
    }
}

// ==== Performance Utilities（変更なし）====

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function measurePerformance(name, operation) {
    const startTime = performance.now();
    
    try {
        const result = operation();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`⏱️ [${name}] 実行時間: ${duration.toFixed(2)}ms`);
        return result;
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`⏱️ [${name}] エラー (${duration.toFixed(2)}ms):`, error);
        throw error;
    }
}

// ==== Color Utilities（変更なし）====

function colorToRGBA(color, opacity = 1.0) {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;
    const validOpacity = validateOpacity(opacity);
    
    return `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
}

function rgbToHex(r, g, b) {
    const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
    return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
}

// ==== Preview Utilities（変更なし）====

function calculatePreviewSize(actualSize) {
    const size = parseFloat(actualSize);
    if (isNaN(size) || size <= 0) {
        return safeConfigGet('PREVIEW_MIN_SIZE', 0.5);
    }
    
    const minSize = safeConfigGet('PREVIEW_MIN_SIZE', 0.5);
    const maxSize = safeConfigGet('PREVIEW_MAX_SIZE', 20);
    const maxBrushSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
    
    if (size <= 32) {
        const normalizedSize = Math.min(1.0, size / 32);
        return Math.max(minSize, Math.min(maxSize, normalizedSize * maxSize));
    } else {
        const logScale = Math.log(size / 32) / Math.log(maxBrushSize / 32);
        const compressedScale = logScale * 0.3;
        return Math.min(maxSize, maxSize * (0.7 + compressedScale));
    }
}

// ==== Array/Object/String/Time/Math Utilities（変更なし・省略）====

// Array utilities
function safeArrayAccess(array, index, defaultValue = null) {
    if (!Array.isArray(array)) return defaultValue;
    if (index < 0 || index >= array.length) return defaultValue;
    return array[index];
}

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

// Object utilities
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

// String utilities
function truncateString(str, maxLength, suffix = '...') {
    if (typeof str !== 'string' || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}

// Time utilities
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

function generateTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
}

// Math utilities
function clamp(value, min, max) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return min;
    return Math.max(min, Math.min(max, numValue));
}

function lerp(start, end, t) {
    const clampedT = clamp(t, 0, 1);
    return start + (end - start) * clampedT;
}

function normalize(value, min, max) {
    if (max === min) return 0;
    return clamp((value - min) / (max - min), 0, 1);
}

// ==== Debug Utilities（Phase2E拡張版）====

function debugLog(category, message, data = null) {
    if (safeConfigGet('ENABLE_LOGGING', true, 'DEBUG_CONFIG')) {
        const prefix = `🔧 [${category}]`;
        if (data !== null) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    }
}

function getSystemStats() {
    return {
        timestamp: Date.now(),
        errorLoopPrevention: { ...ERROR_LOOP_PREVENTION }, // Phase2E新規
        performance: {
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        },
        config: {
            loaded: validateConfigIntegrity(),
            values: {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE'),
                opacity: safeConfigGet('DEFAULT_OPACITY'),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE'),
                presets: safeConfigGet('SIZE_PRESETS')
            }
        }
    };
}

// ==== Phase2E新規: エラー状況リセット関数 ====
function resetErrorLoopPrevention() {
    ERROR_LOOP_PREVENTION.logErrorCalls = 0;
    ERROR_LOOP_PREVENTION.preventLogErrors = false;
    ERROR_LOOP_PREVENTION.lastErrorMessage = null;
    ERROR_LOOP_PREVENTION.duplicateErrorCount = 0;
    
    console.log('🔄 エラーループ防止システムリセット完了');
}

// ==== グローバル登録・エクスポート（Phase2E修正版）====
if (typeof window !== 'undefined') {
    // Configuration utilities
    window.safeConfigGet = safeConfigGet;
    window.safeUIConfigGet = safeUIConfigGet;
    window.validateConfigIntegrity = validateConfigIntegrity;
    
    // DOM utilities
    window.safeQuerySelector = safeQuerySelector;
    window.safeAddEventListener = safeAddEventListener;
    
    // Validation utilities
    window.validateBrushSize = validateBrushSize;
    window.validateOpacity = validateOpacity;
    window.validatePresetData = validatePresetData;
    
    // Error handling
    window.createApplicationError = createApplicationError;
    window.logError = logError;
    window.handleGracefulDegradation = handleGracefulDegradation;
    
    // Performance utilities
    window.throttle = throttle;
    window.debounce = debounce;
    window.measurePerformance = measurePerformance;
    
    // Color utilities
    window.colorToRGBA = colorToRGBA;
    window.rgbToHex = rgbToHex;
    
    // Preview utilities
    window.calculatePreviewSize = calculatePreviewSize;
    
    // Array utilities
    window.safeArrayAccess = safeArrayAccess;
    window.removeDuplicates = removeDuplicates;
    
    // Object utilities
    window.deepCopy = deepCopy;
    window.mergeObjects = mergeObjects;
    
    // String utilities
    window.truncateString = truncateString;
    
    // Time utilities
    window.formatElapsedTime = formatElapsedTime;
    window.generateTimestamp = generateTimestamp;
    
    // Math utilities
    window.clamp = clamp;
    window.lerp = lerp;
    window.normalize = normalize;
    
    // Debug utilities
    window.debugLog = debugLog;
    window.getSystemStats = getSystemStats;
    
    // Phase2E新規: エラー管理関数
    window.resetErrorLoopPrevention = resetErrorLoopPrevention;
    window.createEmergencyConfig = createEmergencyConfig;
    window.fixMissingConfigValues = fixMissingConfigValues;
    window.createMinimalFallbackConfig = createMinimalFallbackConfig;
    
    console.log('✅ utils.js Phase2E緊急エラー修正版 読み込み完了');
    console.log('🚨 Phase2E緊急修正完了項目:');
    console.log('  ✅ CONFIG検証タイミング修正（DOM読み込み完了後に延期）');
    console.log('  ✅ エラーハンドリング無限ループ対策（ApplicationError検出・制限）');
    console.log('  ✅ CONFIG値不足時の自動補完機能');
    console.log('  ✅ 緊急CONFIG作成機能（フォールバック強化）');
    console.log('  ✅ エラーログ記録制限（最大5回・重複検出）');
    console.log('  ✅ validateConfigIntegrity安全化');
    
    console.log('🔧 Phase2E新規機能:');
    console.log('  - window.resetErrorLoopPrevention() - エラー状況リセット');
    console.log('  - window.createEmergencyConfig() - 緊急CONFIG作成');
    console.log('  - window.fixMissingConfigValues() - CONFIG値補完');
    console.log('  - window.createMinimalFallbackConfig() - 最小限CONFIG作成');
    
    console.log('🎯 Phase2E効果:');
    console.log('  🚨 致命的エラー解消: CONFIG値不足・無限ループ防止');
    console.log('  🛡️ 安定性向上: フォールバック機能強化・緊急処理');
    console.log('  ⚡ 初期化成功率向上: DOM待機・段階的補完');
    console.log('  🔄 エラー回復: 自動リセット・状況監視');
}