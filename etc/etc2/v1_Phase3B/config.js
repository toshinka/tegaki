/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev14
 * 設定統一管理システム - config.js (CONFIG統合・完全修正版)
 * 
 * 🔧 Phase1総合修正内容:
 * 1. ✅ 不足CONFIG項目の完全追加（SLIDER_UPDATE_THROTTLE, POPUP_FADE_TIME等）
 * 2. ✅ SIZE_PRESETS配列形式の正規化
 * 3. ✅ PREVIEW_CACHE_SIZE等のキャッシュ関連設定追加
 * 4. ✅ PixiJS拡張ライブラリ統合設定の強化
 * 5. ✅ DRY・SOLID原則に基づく設定階層の最適化
 * 6. ✅ safeConfigGet完全対応構造
 * 
 * 修正目標: 全safeConfigGetエラー解消・PixiJS拡張ライブラリ完全統合
 */

console.log('🔧 config.js CONFIG統合・完全修正版読み込み開始...');

// ==== Phase1: 基本CONFIG定義（完全版）====
window.CONFIG = {
    // 🚨 緊急修正: components.js要求項目（ログエラー解消）
    SLIDER_UPDATE_THROTTLE: 16,   // 60fps相当のスライダー更新
    POPUP_FADE_TIME: 300,         // ポップアップフェード時間（ms）
    SIZE_PRESETS: [               // ペンサイズプリセット配列
        { id: 'preset_1', name: '極細', size: 1, opacity: 90, color: 0x800000 },
        { id: 'preset_2', name: '細', size: 2, opacity: 85, color: 0x800000 },
        { id: 'preset_4', name: '標準', size: 4, opacity: 85, color: 0x800000 },
        { id: 'preset_8', name: '太', size: 8, opacity: 80, color: 0x800000 },
        { id: 'preset_16', name: '極太', size: 16, opacity: 75, color: 0x800000 },
        { id: 'preset_32', name: '超極太', size: 32, opacity: 70, color: 0x800000 }
    ],
    
    // 🚨 緊急修正: プレビュー関連（完全対応）
    PREVIEW_MIN_SIZE: 1,
    PREVIEW_MAX_SIZE: 32,
    PREVIEW_DEFAULT_SIZE: 4,
    PREVIEW_CACHE_SIZE: 100,      // キャッシュサイズ制限
    PREVIEW_MAX_CACHE_AGE: 300000, // 5分のキャッシュ有効期間
    
    // 🚨 緊急修正: デフォルト値（標準化）
    DEFAULT_COLOR: 0x800000,      // ふたばマルーン
    DEFAULT_BRUSH_SIZE: 4,        
    DEFAULT_OPACITY: 0.85,        // 85%
    DEFAULT_PRESSURE: 0.5,        // 50%
    DEFAULT_SMOOTHING: 0.3,       // 30%
    DEFAULT_ACTIVE_PRESET: 'preset_4', // デフォルトアクティブプリセット
    
    // 🚨 緊急修正: パフォーマンス関連（60fps対応）
    PRESET_UPDATE_THROTTLE: 16,   // プリセット更新スロットル
    PERFORMANCE_UPDATE_INTERVAL: 1000,  // パフォーマンス監視間隔
    TARGET_FPS: 60,
    
    // ブラシサイズ制限
    MAX_BRUSH_SIZE: 500,
    MIN_BRUSH_SIZE: 0.1,
    
    // キャンバス設定
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 400,
    BG_COLOR: 0xf0e0d6,          // ふたばクリーム
    
    // 通知・UI設定
    NOTIFICATION_DURATION: 3000,
    NOTIFICATION_MAX_COUNT: 3,
    NOTIFICATION_POSITION: 'top-right',
    
    // 🆕 Phase1強化: ポップアップ専用設定（完全版）
    POPUP_CONFIG: {
        WIDTH: 320,
        HEIGHT: 480,
        BACKGROUND_COLOR: 0xF0E0D6,
        BORDER_COLOR: 0x800000,
        BORDER_WIDTH: 2,
        CORNER_RADIUS: 8,
        SHADOW: true,
        ANIMATION_DURATION: 200,
        CLOSE_ON_OUTSIDE: true,
        MODAL_OVERLAY_COLOR: 0x000000,
        MODAL_OVERLAY_ALPHA: 0.5,
        
        // ポップアップ内コンポーネント設定
        TITLE_HEIGHT: 32,
        PADDING: 16,
        BUTTON_HEIGHT: 32,
        SLIDER_HEIGHT: 24,
        SPACING: 12,
        
        // 🆕 スライダー専用設定
        SLIDER_TRACK_COLOR: 0xCCCCCC,
        SLIDER_HANDLE_COLOR: 0x800000,
        SLIDER_ACTIVE_COLOR: 0xAA5A56
    },
    
    // 🆕 Phase1強化: PixiJS拡張ライブラリ統合設定（完全版）
    LIBRARY_CONFIG: {
        // @pixi/ui設定
        UI_THEME: 'futaba',
        UI_BUTTON_STYLE: {
            backgroundColor: 0x800000,
            hoverColor: 0xaa5a56,
            textColor: 0xFFFFFF,
            borderRadius: 4,
            padding: 8,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14
        },
        
        // @pixi/layers設定
        LAYER_MAX_COUNT: 10,
        LAYER_BLEND_MODES: ['normal', 'multiply', 'screen', 'overlay', 'soft-light'],
        LAYER_OPACITY_RANGE: [0, 1],
        
        // @pixi/gif設定
        GIF_MAX_FRAMES: 60,
        GIF_DEFAULT_DELAY: 100,
        GIF_MAX_SIZE: { width: 800, height: 600 },
        GIF_QUALITY_LEVELS: ['low', 'medium', 'high'],
        
        // graphics系設定
        SMOOTH_GRAPHICS_ENABLED: true,
        GRAPHICS_EXTRAS_ENABLED: true,
        ANTI_ALIAS_QUALITY: 'high',
        
        // 🆕 拡張機能設定
        EXTENSION_TIMEOUT: 5000,     // 拡張ライブラリロードタイムアウト
        FALLBACK_MODE: true,         // フォールバックモード有効
        AUTO_RETRY: 3,               // 自動リトライ回数
        DEBUG_MODE: true             // デバッグモード
    },

    // 🆕 Phase1強化: ライブラリ有効化フラグ（状況対応）
    LIBRARY_FLAGS: {
        ENABLE_PIXI_UI: true,
        ENABLE_PIXI_LAYERS: true,
        ENABLE_PIXI_GIF: false,        // Phase5で有効化予定
        ENABLE_SMOOTH_GRAPHICS: true,
        ENABLE_GRAPHICS_EXTRAS: true,
        ENABLE_EXTENSIONS_AUTO_LOAD: true,  // 自動読み込み
        ENABLE_FALLBACK_UI: true       // フォールバック UI
    },
    
    // 🆕 Phase1強化: キャッシュ・メモリ管理設定
    CACHE_CONFIG: {
        PREVIEW_CACHE_SIZE: 100,
        BRUSH_CACHE_SIZE: 50,
        HISTORY_CACHE_SIZE: 200,
        TEXTURE_CACHE_SIZE: 150,
        MAX_MEMORY_USAGE_MB: 256,
        GC_INTERVAL: 30000,           // 30秒間隔でガベージコレクション
        AUTO_CLEANUP: true
    },
    
    // 🆕 Phase1強化: 描画・レンダリング設定
    RENDERING_CONFIG: {
        ANTI_ALIAS: true,
        RESOLUTION: window.devicePixelRatio || 1,
        PRESERVE_DRAWING_BUFFER: true,
        POWER_PREFERENCE: 'default',
        FAIL_IF_MAJOR_PERFORMANCE_CAVEAT: false,
        
        // ベクター描画設定
        VECTOR_PRECISION: 0.1,
        CURVE_SEGMENTS: 32,
        LINE_CAP: 'round',
        LINE_JOIN: 'round'
    }
};

// ==== Phase2: UI専用設定（CONFIG統合対応）====
window.UI_CONFIG = {
    // スライダー設定（CONFIG参照）
    SLIDER_HANDLE_SIZE: 16,
    SLIDER_TRACK_HEIGHT: 4,
    SLIDER_THROTTLE_MS: window.CONFIG.SLIDER_UPDATE_THROTTLE,
    
    // プレビュー設定（CONFIG参照）
    SIZE_PREVIEW_MIN: window.CONFIG.PREVIEW_MIN_SIZE,
    SIZE_PREVIEW_MAX: window.CONFIG.PREVIEW_MAX_SIZE,
    SIZE_PREVIEW_FRAME_SIZE: 24,
    
    // ポップアップ設定（CONFIG参照）
    POPUP_FADE_TIME: window.CONFIG.POPUP_FADE_TIME,
    POPUP_Z_INDEX: 1000,
    
    // プリセット更新設定（CONFIG参照）
    PRESET_UPDATE_DELAY: window.CONFIG.PRESET_UPDATE_THROTTLE,
    
    // 通知設定（CONFIG参照）
    NOTIFICATION_POSITION: window.CONFIG.NOTIFICATION_POSITION,
    NOTIFICATION_MAX_COUNT: window.CONFIG.NOTIFICATION_MAX_COUNT,
    NOTIFICATION_DURATION: window.CONFIG.NOTIFICATION_DURATION
};

// ==== Phase3: UIイベント定数（拡張版）====
window.UI_EVENTS = {
    // スライダーイベント
    SLIDER_CHANGE: 'slider:change',
    SLIDER_START: 'slider:start',
    SLIDER_END: 'slider:end',
    SLIDER_LIVE_UPDATE: 'slider:live:update',
    
    // プリセットイベント
    PRESET_SELECT: 'preset:select',
    PRESET_CHANGE: 'preset:change',
    PRESET_RESET: 'preset:reset',
    PRESET_LIVE_UPDATE: 'preset:live:update',
    
    // ツールイベント
    TOOL_CHANGE: 'tool:change',
    BRUSH_SETTINGS_CHANGE: 'brush:settings:change',
    
    // ポップアップイベント
    POPUP_SHOW: 'popup:show',
    POPUP_HIDE: 'popup:hide',
    POPUP_TOGGLE: 'popup:toggle',
    
    // パフォーマンスイベント
    PERFORMANCE_UPDATE: 'performance:update',
    MEMORY_WARNING: 'memory:warning',
    CACHE_CLEANUP: 'cache:cleanup',
    
    // 履歴イベント
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_RECORD: 'history:record',
    
    // 🆕 拡張ライブラリイベント
    EXTENSION_LOADED: 'extension:loaded',
    EXTENSION_ERROR: 'extension:error',
    EXTENSION_FALLBACK: 'extension:fallback'
};

// ==== Phase4: 設定値バリデーション（強化版）====
window.CONFIG_VALIDATION = {
    /**
     * ブラシサイズの妥当性チェック
     */
    validateBrushSize: function(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return window.CONFIG.DEFAULT_BRUSH_SIZE;
        return Math.max(window.CONFIG.MIN_BRUSH_SIZE, Math.min(window.CONFIG.MAX_BRUSH_SIZE, numSize));
    },
    
    /**
     * 透明度の妥当性チェック（0-1範囲）
     */
    validateOpacity: function(opacity) {
        const numOpacity = parseFloat(opacity);
        if (isNaN(numOpacity)) return window.CONFIG.DEFAULT_OPACITY;
        return Math.max(0, Math.min(1, numOpacity));
    },
    
    /**
     * 透明度パーセンテージの妥当性チェック（0-100範囲）
     */
    validateOpacityPercent: function(opacityPercent) {
        const numOpacity = parseFloat(opacityPercent);
        if (isNaN(numOpacity)) return window.CONFIG.DEFAULT_OPACITY * 100;
        return Math.max(0, Math.min(100, numOpacity));
    },
    
    /**
     * プレビューサイズの妥当性チェック
     */
    validatePreviewSize: function(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return window.CONFIG.PREVIEW_MIN_SIZE;
        return Math.max(window.CONFIG.PREVIEW_MIN_SIZE, Math.min(window.CONFIG.PREVIEW_MAX_SIZE, numSize));
    },
    
    /**
     * 🆕 プリセット妥当性チェック（強化版）
     */
    validatePreset: function(preset) {
        if (!preset || typeof preset !== 'object') return null;
        
        return {
            id: preset.id || `preset_${preset.size || 4}`,
            name: preset.name || 'デフォルト',
            size: this.validateBrushSize(preset.size || 4),
            opacity: this.validateOpacity(preset.opacity || 0.85),
            color: typeof preset.color === 'number' ? preset.color : window.CONFIG.DEFAULT_COLOR
        };
    },
    
    /**
     * SIZE_PRESETS配列の妥当性チェック
     */
    validateSizePresets: function(presets) {
        if (!Array.isArray(presets) || presets.length === 0) {
            console.warn('SIZE_PRESETS無効 → デフォルト値使用');
            return window.CONFIG.SIZE_PRESETS;
        }
        
        return presets.map(preset => this.validatePreset(preset)).filter(p => p !== null);
    },
    
    /**
     * キャンバスサイズの妥当性チェック
     */
    validateCanvasSize: function(width, height) {
        const numWidth = parseInt(width, 10);
        const numHeight = parseInt(height, 10);
        
        return {
            width: isNaN(numWidth) ? window.CONFIG.CANVAS_WIDTH : Math.max(100, Math.min(4000, numWidth)),
            height: isNaN(numHeight) ? window.CONFIG.CANVAS_HEIGHT : Math.max(100, Math.min(4000, numHeight))
        };
    },
    
    /**
     * 🆕 色値の妥当性チェック
     */
    validateColor: function(color) {
        if (typeof color === 'number' && color >= 0 && color <= 0xFFFFFF) {
            return color;
        }
        
        if (typeof color === 'string' && /^#[0-9A-F]{6}$/i.test(color)) {
            return parseInt(color.substring(1), 16);
        }
        
        return window.CONFIG.DEFAULT_COLOR;
    }
};

// ==== Phase5: プレビュー計算ユーティリティ（強化版）====
window.PREVIEW_UTILS = {
    /**
     * 20px制限を考慮したプレビューサイズ計算（強化版）
     */
    calculatePreviewSize: function(actualSize) {
        const size = parseFloat(actualSize);
        if (isNaN(size) || size <= 0) return window.CONFIG.PREVIEW_MIN_SIZE;
        
        // より精密な計算ロジック
        if (size <= 32) {
            // 線形スケール（32px以下）
            const normalizedSize = Math.min(1.0, size / 32);
            const result = Math.max(window.CONFIG.PREVIEW_MIN_SIZE, 
                                   Math.min(window.CONFIG.PREVIEW_MAX_SIZE, 
                                          normalizedSize * window.CONFIG.PREVIEW_MAX_SIZE));
            return Math.round(result * 10) / 10; // 小数点1桁まで
        } else {
            // 対数スケール（32px超）
            const logScale = Math.log(size / 32) / Math.log(window.CONFIG.MAX_BRUSH_SIZE / 32);
            const compressedScale = logScale * 0.25; // より圧縮
            const result = Math.min(window.CONFIG.PREVIEW_MAX_SIZE, 
                                   window.CONFIG.PREVIEW_MAX_SIZE * (0.75 + compressedScale));
            return Math.round(result * 10) / 10;
        }
    },
    
    /**
     * プレビュー色の透明度適用（RGBA形式）
     */
    applyOpacityToColor: function(color, opacity) {
        const validColor = window.CONFIG_VALIDATION.validateColor(color);
        const validOpacity = window.CONFIG_VALIDATION.validateOpacity(opacity);
        
        const r = (validColor >> 16) & 0xFF;
        const g = (validColor >> 8) & 0xFF;
        const b = validColor & 0xFF;
        
        return `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
    },
    
    /**
     * 🆕 色をCSS hex形式に変換
     */
    colorToHex: function(color) {
        const validColor = window.CONFIG_VALIDATION.validateColor(color);
        return `#${validColor.toString(16).padStart(6, '0').toUpperCase()}`;
    },
    
    /**
     * 🆕 プレビュー枠サイズ計算（余白込み）
     */
    calculateFrameSize: function(previewSize) {
        const size = parseFloat(previewSize);
        const padding = 4; // 余白
        return Math.max(24, size + padding * 2); // 最小24px
    }
};

// ==== Phase6: デフォルト設定のエクスポート（統合版）====
window.DEFAULT_SETTINGS = {
    brushSize: window.CONFIG.DEFAULT_BRUSH_SIZE,
    opacity: window.CONFIG.DEFAULT_OPACITY,
    color: window.CONFIG.DEFAULT_COLOR,
    pressure: window.CONFIG.DEFAULT_PRESSURE,
    smoothing: window.CONFIG.DEFAULT_SMOOTHING,
    
    // プリセット関連
    activePreset: window.CONFIG.DEFAULT_ACTIVE_PRESET,
    presets: window.CONFIG.SIZE_PRESETS
};

// ==== Phase7: ふたば☆ちゃんねる配色定義（拡張版）====
window.FUTABA_COLORS = {
    // 基本色
    MAROON: 0x800000,           // 主線・基調色
    LIGHT_MAROON: 0xaa5a56,     // セカンダリ・ボタン
    MEDIUM: 0xcf9c97,           // アクセント・ホバー
    LIGHT_MEDIUM: 0xe9c2ba,     // 境界線・分離線
    CREAM: 0xf0e0d6,            // キャンバス背景
    BACKGROUND: 0xffffee,       // アプリ背景
    
    // 🆕 UI拡張色
    TEXT_PRIMARY: 0x000000,     // メインテキスト
    TEXT_SECONDARY: 0x666666,   // サブテキスト
    BORDER: 0xcccccc,           // 境界線
    DISABLED: 0x999999,         // 無効状態
    SUCCESS: 0x008000,          // 成功色
    WARNING: 0xff8c00,          // 警告色
    ERROR: 0xff0000,            // エラー色
    
    // プレビュー専用色
    PREVIEW_FRAME: 0xe0e0e0,    // プレビュー枠
    PREVIEW_ACTIVE: 0x800000    // アクティブプレビュー枠
};

// ==== Phase8: デバッグ・テスト用設定（拡張版）====
window.DEBUG_CONFIG = {
    ENABLE_LOGGING: true,
    LOG_PERFORMANCE: true,
    LOG_HISTORY: true,
    LOG_EXTENSIONS: true,
    SHOW_PREVIEW_BOUNDS: false,
    ENABLE_CONFIG_VALIDATION: true,
    
    // 🆕 詳細デバッグ設定
    LOG_SLIDER_EVENTS: false,
    LOG_PRESET_CHANGES: true,
    LOG_CACHE_OPERATIONS: false,
    PERFORMANCE_ALERT_THRESHOLD: 30, // FPS閾値
    MEMORY_ALERT_THRESHOLD_MB: 200   // メモリ使用量閾値
};

// ==== Phase9: CONFIG完整性確認システム（強化版）====
window.validateConfigIntegrity = function() {
    const requiredKeys = [
        // 基本設定
        'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE', 'PREVIEW_CACHE_SIZE',
        'DEFAULT_COLOR', 'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY',
        
        // スロットル・タイミング
        'PRESET_UPDATE_THROTTLE', 'SLIDER_UPDATE_THROTTLE', 'POPUP_FADE_TIME',
        'TARGET_FPS', 'PERFORMANCE_UPDATE_INTERVAL',
        
        // 拡張機能
        'POPUP_CONFIG', 'LIBRARY_CONFIG', 'LIBRARY_FLAGS', 
        'CACHE_CONFIG', 'RENDERING_CONFIG'
    ];
    
    const report = { 
        valid: true, 
        missing: [], 
        present: [],
        warnings: [],
        arrayChecks: {},
        typeChecks: {}
    };
    
    // 必須キー確認
    requiredKeys.forEach(key => {
        if (window.CONFIG[key] === undefined) {
            report.missing.push(key);
            report.valid = false;
        } else {
            report.present.push(key);
        }
    });
    
    // 🆕 配列型チェック
    if (window.CONFIG.SIZE_PRESETS) {
        const isArray = Array.isArray(window.CONFIG.SIZE_PRESETS);
        const hasItems = isArray && window.CONFIG.SIZE_PRESETS.length > 0;
        
        report.arrayChecks.SIZE_PRESETS = {
            isArray: isArray,
            hasItems: hasItems,
            count: isArray ? window.CONFIG.SIZE_PRESETS.length : 0
        };
        
        if (!isArray) {
            report.warnings.push('SIZE_PRESETS が配列でない');
            report.valid = false;
        }
        
        if (!hasItems) {
            report.warnings.push('SIZE_PRESETS が空配列');
            report.valid = false;
        }
    }
    
    // 🆕 数値型チェック
    const numericKeys = ['TARGET_FPS', 'PREVIEW_CACHE_SIZE', 'PRESET_UPDATE_THROTTLE'];
    numericKeys.forEach(key => {
        if (window.CONFIG[key] !== undefined) {
            const isNumber = typeof window.CONFIG[key] === 'number';
            const isPositive = isNumber && window.CONFIG[key] > 0;
            
            report.typeChecks[key] = {
                isNumber: isNumber,
                isPositive: isPositive,
                value: window.CONFIG[key]
            };
            
            if (!isNumber) {
                report.warnings.push(`${key} が数値でない`);
            } else if (!isPositive) {
                report.warnings.push(`${key} が正の数でない`);
            }
        }
    });
    
    // レポート出力
    if (report.missing.length > 0) {
        console.warn('⚠️ 不足CONFIG項目:', report.missing);
    }
    
    if (report.warnings.length > 0) {
        console.warn('⚠️ CONFIG警告:', report.warnings);
    }
    
    if (report.valid) {
        console.log('✅ 全必須CONFIG項目確認完了');
    }
    
    return report;
};

// ==== Phase10: 安全CONFIG取得関数（完全版）====
window.safeConfigGet = function(key, defaultValue = null) {
    try {
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn(`safeConfigGet: CONFIG未初期化 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // ドット記法サポート（例：'POPUP_CONFIG.WIDTH'）
        const keys = key.split('.');
        let value = window.CONFIG;
        
        for (const k of keys) {
            if (value === null || value === undefined || !(k in value)) {
                console.warn(`safeConfigGet: キー不存在 (${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            value = value[k];
        }
        
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${key}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
};

// ==== Phase11: PixiJS拡張ライブラリ統合サポート====
window.PIXI_EXTENSIONS_INTEGRATION = {
    /**
     * 拡張ライブラリの利用可能性チェック
     */
    checkAvailability: function() {
        const status = {
            pixiExtensions: typeof window.PixiExtensions !== 'undefined',
            features: {},
            fallbackMode: false
        };
        
        if (status.pixiExtensions) {
            // 各機能の確認
            const features = ['ui', 'layers', 'gif', 'smooth', 'graphics'];
            features.forEach(feature => {
                try {
                    status.features[feature] = window.PixiExtensions.hasFeature(feature);
                } catch (error) {
                    status.features[feature] = false;
                }
            });
        } else {
            // フォールバックモード
            status.fallbackMode = window.safeConfigGet('LIBRARY_FLAGS.ENABLE_FALLBACK_UI', true);
            console.warn('⚠️ PixiExtensions未利用可能 - フォールバックモード:', status.fallbackMode ? '有効' : '無効');
        }
        
        return status;
    },
    
    /**
     * 設定値の拡張ライブラリ対応調整
     */
    adjustConfigForExtensions: function() {
        const status = this.checkAvailability();
        
        if (!status.pixiExtensions || status.fallbackMode) {
            // 拡張機能フラグを無効化
            if (window.CONFIG.LIBRARY_FLAGS) {
                Object.keys(window.CONFIG.LIBRARY_FLAGS).forEach(flag => {
                    if (flag.startsWith