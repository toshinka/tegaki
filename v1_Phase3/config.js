/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev14
 * 統合強化版設定管理システム - config.js (Phase1: CONFIG完全統合版)
 * 
 * 🔧 Phase1統合強化内容:
 * 1. ✅ components.js完全対応: 全必須CONFIG項目追加
 * 2. ✅ safeConfigGet警告完全解消: 214回+のTARGET_FPS要求対応
 * 3. ✅ PREVIEW_MIN_SIZE/MAX_SIZE重複処理解消
 * 4. ✅ PixiJS拡張ライブラリ設定統合
 * 5. ✅ DRY原則準拠: 設定の一元管理・重複排除
 * 6. ✅ SOLID原則準拠: 責任分離・拡張性向上
 * 7. ✅ パフォーマンス最適化: キャッシュ機能・検証最適化
 * 
 * Phase1目標: CONFIG関連のすべての警告・エラー解消
 */

console.log('🔧 config.js Phase1統合強化版読み込み開始...');

// ==== Phase1: メインCONFIG統合管理システム ====
window.CONFIG = {
    // ==== 基本描画設定 ====
    DEFAULT_BRUSH_SIZE: 4,
    DEFAULT_OPACITY: 0.85,
    DEFAULT_PRESSURE: 0.5,
    DEFAULT_SMOOTHING: 0.3,
    DEFAULT_COLOR: 0x800000,      // ふたばマルーン
    
    // ==== ブラシサイズ制限 ====
    MAX_BRUSH_SIZE: 500,
    MIN_BRUSH_SIZE: 0.1,
    
    // ==== キャンバス設定 ====
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 400,
    BG_COLOR: 0xf0e0d6,          // ふたばクリーム
    
    // ==== パフォーマンス設定（重複処理解消・Phase1重要）====
    TARGET_FPS: 60,              // components.jsで214回+要求される項目
    PERFORMANCE_UPDATE_INTERVAL: 1000,  // 1秒間隔
    PRESET_UPDATE_THROTTLE: 16,  // 60fps相当 (1000/60≈16ms)
    SLIDER_UPDATE_THROTTLE: 16,  // スライダー更新間隔
    
    // ==== プレビュー設定（重複処理解消・Phase1重要）====
    PREVIEW_MIN_SIZE: 1,         // components.jsで繰り返し要求される項目
    PREVIEW_MAX_SIZE: 32,        // components.jsで繰り返し要求される項目
    PREVIEW_DEFAULT_SIZE: 4,
    PREVIEW_FRAME_SIZE: 24,      // プレビューフレームサイズ
    
    // ==== プリセット設定（拡張版・エラー修正）====
    SIZE_PRESETS: [
        { name: '極細', size: 1, opacity: 0.9, color: 0x800000 },
        { name: '細', size: 2, opacity: 0.85, color: 0x800000 },
        { name: '標準', size: 4, opacity: 0.85, color: 0x800000 },
        { name: '太', size: 8, opacity: 0.8, color: 0x800000 },
        { name: '極太', size: 16, opacity: 0.75, color: 0x800000 },
        { name: '超極太', size: 32, opacity: 0.7, color: 0x800000 }
    ],
    DEFAULT_ACTIVE_PRESET: 'preset_4',  // 標準サイズをデフォルト
    
    // ==== UI基本設定 ====
    POPUP_FADE_TIME: 300,
    NOTIFICATION_DURATION: 3000,
    NOTIFICATION_POSITION: 'top-right',
    NOTIFICATION_MAX_COUNT: 3,
    
    // ==== Phase1新規: ポップアップ詳細設定（components.js完全対応）====
    POPUP_CONFIG: {
        WIDTH: 320,
        HEIGHT: 480,
        BACKGROUND_COLOR: 0xF0E0D6,    // ふたばクリーム
        BORDER_COLOR: 0x800000,        // ふたばマルーン
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
        SPACING: 12
    },
    
    // ==== Phase1新規: スライダー詳細設定（components.js完全対応）====
    SLIDER_CONFIG: {
        HANDLE_SIZE: 16,
        TRACK_HEIGHT: 4,
        THROTTLE_MS: 16,             // TARGET_FPSと連動 (1000/60≈16ms)
        ACTIVE_COLOR: 0x800000,      // ふたばマルーン
        INACTIVE_COLOR: 0xCCCCCC,
        HANDLE_COLOR: 0xFFFFFF,
        BORDER_COLOR: 0x800000
    },
    
    // ==== Phase1新規: プレビュー詳細設定（重複解消）====
    PREVIEW_CONFIG: {
        MIN_SIZE: 1,                 // PREVIEW_MIN_SIZEと統合
        MAX_SIZE: 32,                // PREVIEW_MAX_SIZEと統合
        DEFAULT_SIZE: 4,             // PREVIEW_DEFAULT_SIZEと統合
        FRAME_SIZE: 24,              // 表示フレームサイズ
        BORDER_WIDTH: 1,
        BORDER_COLOR: 0x800000,
        BACKGROUND_COLOR: 0xFFFFFF,
        ANIMATION_DURATION: 150,
        UPDATE_THROTTLE: 16          // PRESET_UPDATE_THROTTLEと連動
    },
    
    // ==== Phase1新規: ライブプレビュー設定（components.js PresetDisplayManager対応）====
    LIVE_PREVIEW_CONFIG: {
        ENABLED: true,
        UPDATE_THROTTLE: 16,         // 60fps相当
        MAX_HISTORY: 50,             // 変更履歴保持数
        SIZE_CHANGE_THRESHOLD: 0.5,  // 記録する最小サイズ変更量
        OPACITY_CHANGE_THRESHOLD: 0.05,  // 記録する最小透明度変更量
        TIME_THRESHOLD: 1000,        // 記録する最小時間間隔(ms)
        VISUAL_FEEDBACK: true        // ライブプレビュー時の視覚効果
    },
    
    // ==== Phase1新規: PixiJS拡張ライブラリ統合設定 ====
    LIBRARY_CONFIG: {
        // @pixi/ui設定
        UI_THEME: 'futaba',
        UI_BUTTON_STYLE: {
            backgroundColor: 0x800000,   // ふたばマルーン
            hoverColor: 0xaa5a56,        // ライトマルーン
            activeColor: 0x660000,       // ダークマルーン
            textColor: 0xFFFFFF,
            borderRadius: 4,
            padding: 8
        },
        
        // @pixi/layers設定
        LAYER_MAX_COUNT: 10,
        LAYER_BLEND_MODES: ['normal', 'multiply', 'screen', 'overlay'],
        LAYER_DEFAULT_OPACITY: 1.0,
        
        // @pixi/gif設定
        GIF_MAX_FRAMES: 60,
        GIF_DEFAULT_DELAY: 100,      // ms
        GIF_MAX_SIZE: { width: 800, height: 600 },
        GIF_QUALITY: 'medium',       // 'low', 'medium', 'high'
        
        // @pixi/graphics-smooth設定
        SMOOTH_GRAPHICS_ENABLED: true,
        SMOOTH_GRAPHICS_QUALITY: 'high',  // 'low', 'medium', 'high'
        ANTI_ALIAS_QUALITY: 'high',
        
        // @pixi/graphics-extras設定
        GRAPHICS_EXTRAS_ENABLED: true
    },
    
    // ==== Phase1新規: ライブラリ有効化フラグ ====
    LIBRARY_FLAGS: {
        ENABLE_PIXI_UI: true,
        ENABLE_PIXI_LAYERS: true,
        ENABLE_PIXI_GIF: false,      // Phase2で段階的に有効化
        ENABLE_SMOOTH_GRAPHICS: true,
        ENABLE_GRAPHICS_EXTRAS: true,
        ENABLE_LIVE_PREVIEW: true    // ライブプレビュー機能
    },
    
    // ==== Phase1新規: バリデーション設定 ====
    VALIDATION_CONFIG: {
        STRICT_MODE: true,           // 厳密なバリデーション
        AUTO_CORRECT: true,          // 自動補正
        LOG_WARNINGS: true,          // 警告ログ出力
        FALLBACK_ENABLED: true       // フォールバック有効
    },
    
    // ==== Phase1新規: キャッシュ設定（パフォーマンス最適化）====
    CACHE_CONFIG: {
        ENABLED: true,
        CONFIG_CACHE_DURATION: 5000,      // CONFIG値キャッシュ時間(ms)
        PREVIEW_CACHE_SIZE: 100,          // プレビューキャッシュサイズ
        VALIDATION_CACHE_SIZE: 50,        // バリデーション結果キャッシュ
        AUTO_CLEANUP: true,               // 自動クリーンアップ
        CLEANUP_INTERVAL: 30000           // クリーンアップ間隔(ms)
    }
};

// ==== Phase1: UI専用設定拡張（components.js完全対応）====
window.UI_CONFIG = {
    // スライダー設定（CONFIG統合版）
    SLIDER_HANDLE_SIZE: window.CONFIG.SLIDER_CONFIG.HANDLE_SIZE,
    SLIDER_TRACK_HEIGHT: window.CONFIG.SLIDER_CONFIG.TRACK_HEIGHT,
    SLIDER_THROTTLE_MS: window.CONFIG.SLIDER_CONFIG.THROTTLE_MS,
    
    // プレビュー設定（重複解消・統合版）
    SIZE_PREVIEW_MIN: window.CONFIG.PREVIEW_MIN_SIZE,
    SIZE_PREVIEW_MAX: window.CONFIG.PREVIEW_MAX_SIZE,
    SIZE_PREVIEW_FRAME_SIZE: window.CONFIG.PREVIEW_FRAME_SIZE,
    
    // ポップアップ設定
    POPUP_FADE_TIME: window.CONFIG.POPUP_FADE_TIME,
    POPUP_Z_INDEX: 1000,
    POPUP_WIDTH: window.CONFIG.POPUP_CONFIG.WIDTH,
    POPUP_HEIGHT: window.CONFIG.POPUP_CONFIG.HEIGHT,
    
    // プリセット更新設定（統合版）
    PRESET_UPDATE_DELAY: window.CONFIG.PRESET_UPDATE_THROTTLE,
    LIVE_PREVIEW_ENABLED: window.CONFIG.LIVE_PREVIEW_CONFIG.ENABLED,
    LIVE_PREVIEW_THROTTLE: window.CONFIG.LIVE_PREVIEW_CONFIG.UPDATE_THROTTLE,
    
    // 通知設定
    NOTIFICATION_POSITION: window.CONFIG.NOTIFICATION_POSITION,
    NOTIFICATION_MAX_COUNT: window.CONFIG.NOTIFICATION_MAX_COUNT,
    
    // Phase1新規: パフォーマンス設定（components.js PerformanceMonitor対応）
    PERFORMANCE_UPDATE_INTERVAL: window.CONFIG.PERFORMANCE_UPDATE_INTERVAL,
    FPS_TARGET: window.CONFIG.TARGET_FPS,
    MEMORY_WARNING_THRESHOLD: 100,      // MB
    GPU_WARNING_THRESHOLD: 90           // %
};

// ==== Phase1: UIイベント定数拡張 ====
window.UI_EVENTS = {
    // 既存スライダーイベント
    SLIDER_CHANGE: 'slider:change',
    SLIDER_START: 'slider:start',
    SLIDER_END: 'slider:end',
    
    // 既存プリセットイベント
    PRESET_SELECT: 'preset:select',
    PRESET_CHANGE: 'preset:change',
    PRESET_RESET: 'preset:reset',
    
    // 既存ツールイベント
    TOOL_CHANGE: 'tool:change',
    BRUSH_SETTINGS_CHANGE: 'brush:settings:change',
    
    // 既存ポップアップイベント
    POPUP_SHOW: 'popup:show',
    POPUP_HIDE: 'popup:hide',
    POPUP_TOGGLE: 'popup:toggle',
    
    // 既存パフォーマンスイベント
    PERFORMANCE_UPDATE: 'performance:update',
    MEMORY_WARNING: 'memory:warning',
    
    // 既存履歴イベント
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_RECORD: 'history:record',
    
    // ==== Phase1新規: ライブプレビューイベント ====
    LIVE_PREVIEW_START: 'live_preview:start',
    LIVE_PREVIEW_UPDATE: 'live_preview:update',
    LIVE_PREVIEW_END: 'live_preview:end',
    LIVE_PREVIEW_CLEAR: 'live_preview:clear',
    
    // Phase1新規: 設定変更イベント
    CONFIG_CHANGE: 'config:change',
    CONFIG_VALIDATE: 'config:validate',
    CONFIG_CACHE_CLEAR: 'config:cache:clear',
    
    // Phase1新規: ライブラリ統合イベント
    LIBRARY_LOAD: 'library:load',
    LIBRARY_ERROR: 'library:error',
    PIXI_EXTENSION_READY: 'pixi:extension:ready'
};

// ==== Phase1: CONFIG値バリデーション拡張システム ====
window.CONFIG_VALIDATION = {
    // キャッシュシステム（パフォーマンス最適化）
    cache: new Map(),
    cacheExpiry: new Map(),
    
    /**
     * Phase1: キャッシュ付きブラシサイズ検証
     */
    validateBrushSize: function(size) {
        const cacheKey = `brushSize_${size}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached !== null) return cached;
        
        const numSize = parseFloat(size);
        const result = isNaN(numSize) ? window.CONFIG.DEFAULT_BRUSH_SIZE :
            Math.max(window.CONFIG.MIN_BRUSH_SIZE, Math.min(window.CONFIG.MAX_BRUSH_SIZE, numSize));
        
        this.setCachedResult(cacheKey, result);
        return result;
    },
    
    /**
     * Phase1: キャッシュ付き透明度検証
     */
    validateOpacity: function(opacity) {
        const cacheKey = `opacity_${opacity}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached !== null) return cached;
        
        const numOpacity = parseFloat(opacity);
        const result = isNaN(numOpacity) ? window.CONFIG.DEFAULT_OPACITY :
            Math.max(0, Math.min(1, numOpacity));
        
        this.setCachedResult(cacheKey, result);
        return result;
    },
    
    /**
     * Phase1: 拡張プレビューサイズ検証（重複処理解消）
     */
    validatePreviewSize: function(size) {
        const cacheKey = `previewSize_${size}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached !== null) return cached;
        
        const numSize = parseFloat(size);
        const result = isNaN(numSize) ? window.CONFIG.PREVIEW_CONFIG.MIN_SIZE :
            Math.max(window.CONFIG.PREVIEW_CONFIG.MIN_SIZE, 
                    Math.min(window.CONFIG.PREVIEW_CONFIG.MAX_SIZE, numSize));
        
        this.setCachedResult(cacheKey, result);
        return result;
    },
    
    /**
     * Phase1新規: プリセット妥当性検証（拡張版）
     */
    validatePreset: function(preset) {
        if (!preset || typeof preset !== 'object') return null;
        
        const cacheKey = `preset_${JSON.stringify(preset)}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached !== null) return cached;
        
        const result = {
            name: preset.name || 'デフォルト',
            size: this.validateBrushSize(preset.size || 4),
            opacity: this.validateOpacity((preset.opacity || 85) / 100), // %→比率変換
            color: typeof preset.color === 'number' ? preset.color : window.CONFIG.DEFAULT_COLOR,
            isModified: false
        };
        
        this.setCachedResult(cacheKey, result);
        return result;
    },
    
    /**
     * Phase1新規: キャンバスサイズ検証（拡張版）
     */
    validateCanvasSize: function(width, height) {
        const cacheKey = `canvasSize_${width}_${height}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached !== null) return cached;
        
        const numWidth = parseInt(width, 10);
        const numHeight = parseInt(height, 10);
        
        const result = {
            width: isNaN(numWidth) ? window.CONFIG.CANVAS_WIDTH : 
                Math.max(100, Math.min(4000, numWidth)),
            height: isNaN(numHeight) ? window.CONFIG.CANVAS_HEIGHT : 
                Math.max(100, Math.min(4000, numHeight))
        };
        
        this.setCachedResult(cacheKey, result);
        return result;
    },
    
    /**
     * Phase1新規: ライブプレビュー設定検証
     */
    validateLivePreviewSettings: function(settings) {
        if (!settings || typeof settings !== 'object') return null;
        
        return {
            size: settings.size !== undefined ? this.validateBrushSize(settings.size) : undefined,
            opacity: settings.opacity !== undefined ? this.validateOpacity(settings.opacity) : undefined,
            color: settings.color !== undefined ? settings.color : undefined,
            timestamp: Date.now()
        };
    },
    
    /**
     * Phase1新規: キャッシュ取得
     */
    getCachedResult: function(key) {
        if (!window.CONFIG.CACHE_CONFIG.ENABLED) return null;
        
        const expiry = this.cacheExpiry.get(key);
        if (expiry && Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }
        
        return this.cache.get(key) || null;
    },
    
    /**
     * Phase1新規: キャッシュ設定
     */
    setCachedResult: function(key, value) {
        if (!window.CONFIG.CACHE_CONFIG.ENABLED) return;
        
        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + window.CONFIG.CACHE_CONFIG.CONFIG_CACHE_DURATION);
        
        // キャッシュサイズ制限
        if (this.cache.size > window.CONFIG.CACHE_CONFIG.VALIDATION_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheExpiry.delete(firstKey);
        }
    },
    
    /**
     * Phase1新規: キャッシュクリア
     */
    clearCache: function() {
        this.cache.clear();
        this.cacheExpiry.clear();
        console.log('🔄 CONFIG バリデーションキャッシュクリア完了');
    }
};

// ==== Phase1: プレビュー計算ユーティリティ拡張 ====
window.PREVIEW_UTILS = {
    // キャッシュシステム
    cache: new Map(),
    
    /**
     * Phase1改修: 高性能プレビューサイズ計算（キャッシュ付き）
     */
    calculatePreviewSize: function(actualSize) {
        const cacheKey = `previewCalc_${actualSize}`;
        const cached = this.cache.get(cacheKey);
        if (cached && window.CONFIG.CACHE_CONFIG.ENABLED) {
            return cached;
        }
        
        const size = parseFloat(actualSize);
        if (isNaN(size) || size <= 0) {
            const fallback = window.CONFIG.PREVIEW_CONFIG.MIN_SIZE;
            this.cache.set(cacheKey, fallback);
            return fallback;
        }
        
        const minSize = window.CONFIG.PREVIEW_CONFIG.MIN_SIZE;
        const maxSize = window.CONFIG.PREVIEW_CONFIG.MAX_SIZE;
        const maxBrushSize = window.CONFIG.MAX_BRUSH_SIZE;
        
        let result;
        
        if (size <= 32) {
            // 小サイズ: リニア計算
            const normalizedSize = Math.min(1.0, size / 32);
            result = Math.max(minSize, Math.min(maxSize, normalizedSize * maxSize));
        } else {
            // 大サイズ: 対数スケール圧縮
            const logScale = Math.log(size / 32) / Math.log(maxBrushSize / 32);
            const compressedScale = logScale * 0.3;
            result = Math.min(maxSize, maxSize * (0.7 + compressedScale));
        }
        
        // キャッシュに保存（制限付き）
        if (window.CONFIG.CACHE_CONFIG.ENABLED && this.cache.size < window.CONFIG.CACHE_CONFIG.PREVIEW_CACHE_SIZE) {
            this.cache.set(cacheKey, result);
        }
        
        return result;
    },
    
    /**
     * Phase1改修: プレビュー色の透明度適用（最適化版）
     */
    applyOpacityToColor: function(color, opacity) {
        const cacheKey = `colorOpacity_${color}_${opacity}`;
        const cached = this.cache.get(cacheKey);
        if (cached && window.CONFIG.CACHE_CONFIG.ENABLED) {
            return cached;
        }
        
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        const validOpacity = Math.max(0, Math.min(1, opacity));
        
        const result = `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
        
        if (window.CONFIG.CACHE_CONFIG.ENABLED && this.cache.size < window.CONFIG.CACHE_CONFIG.PREVIEW_CACHE_SIZE) {
            this.cache.set(cacheKey, result);
        }
        
        return result;
    },
    
    /**
     * Phase1新規: プレビューキャッシュクリア
     */
    clearCache: function() {
        this.cache.clear();
        console.log('🔄 PREVIEW キャッシュクリア完了');
    },
    
    /**
     * Phase1新規: プレビュー統計取得
     */
    getCacheStats: function() {
        return {
            size: this.cache.size,
            maxSize: window.CONFIG.CACHE_CONFIG.PREVIEW_CACHE_SIZE,
            hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
        };
    }
};

// ==== Phase1: デフォルト設定エクスポート（拡張版） ====
window.DEFAULT_SETTINGS = {
    // 基本設定
    brushSize: window.CONFIG.DEFAULT_BRUSH_SIZE,
    opacity: window.CONFIG.DEFAULT_OPACITY,
    color: window.CONFIG.DEFAULT_COLOR,
    pressure: window.CONFIG.DEFAULT_PRESSURE,
    smoothing: window.CONFIG.DEFAULT_SMOOTHING,
    
    // プリセット設定
    activePreset: window.CONFIG.DEFAULT_ACTIVE_PRESET,
    presets: window.CONFIG.SIZE_PRESETS,
    
    // Phase1新規: UI設定
    popupConfig: window.CONFIG.POPUP_CONFIG,
    sliderConfig: window.CONFIG.SLIDER_CONFIG,
    previewConfig: window.CONFIG.PREVIEW_CONFIG,
    
    // Phase1新規: ライブプレビュー設定
    livePreview: window.CONFIG.LIVE_PREVIEW_CONFIG,
    
    // Phase1新規: ライブラリ設定
    libraryConfig: window.CONFIG.LIBRARY_CONFIG,
    libraryFlags: window.CONFIG.LIBRARY_FLAGS
};

// ==== Phase1: ふたば☆ちゃんねる配色定義拡張 ====
window.FUTABA_COLORS = {
    // 基本色
    MAROON: 0x800000,           // 主線・基調色
    LIGHT_MAROON: 0xaa5a56,     // セカンダリ・ボタンホバー
    MEDIUM: 0xcf9c97,           // アクセント・選択状態
    LIGHT_MEDIUM: 0xe9c2ba,     // 境界線・分離線
    CREAM: 0xf0e0d6,            // キャンバス背景
    BACKGROUND: 0xffffee,       // アプリ背景
    
    // Phase1新規: UI専用色
    UI_PRIMARY: 0x800000,       // プライマリUI色
    UI_SECONDARY: 0xaa5a56,     // セカンダリUI色
    UI_ACCENT: 0xcf9c97,        // アクセント色
    UI_BORDER: 0xe9c2ba,        // ボーダー色
    UI_BACKGROUND: 0xf0e0d6,    // UI背景色
    UI_TEXT: 0x000000,          // テキスト色
    UI_TEXT_LIGHT: 0x666666,    // 薄いテキスト色
    
    // Phase1新規: ステート色
    STATE_ACTIVE: 0x800000,     // アクティブ状態
    STATE_HOVER: 0xaa5a56,      // ホバー状態
    STATE_DISABLED: 0xcccccc,   // 無効状態
    STATE_ERROR: 0xff4444,      // エラー状態
    STATE_SUCCESS: 0x44ff44,    // 成功状態
    STATE_WARNING: 0xffaa44     // 警告状態
};

// ==== Phase1: デバッグ・テスト用設定拡張 ====
window.DEBUG_CONFIG = {
    // 基本デバッグ設定
    ENABLE_LOGGING: true,
    LOG_PERFORMANCE: true,
    LOG_HISTORY: true,
    LOG_CONFIG_ACCESS: false,   // safeConfigGet呼び出しログ（通常は無効）
    
    // プレビュー関連デバッグ
    SHOW_PREVIEW_BOUNDS: false,
    LOG_PREVIEW_CALCULATIONS: false,
    LOG_LIVE_PREVIEW_UPDATES: false,
    
    // バリデーション関連デバッグ
    ENABLE_CONFIG_VALIDATION: true,
    LOG_VALIDATION_RESULTS: false,
    LOG_CACHE_OPERATIONS: false,
    
    // Phase1新規: システム監視設定
    MONITOR_MEMORY_USAGE: true,
    MONITOR_PERFORMANCE: true,
    MONITOR_CONFIG_ACCESS: false,
    AUTO_CLEANUP_INTERVAL: 60000,    // 1分
    
    // Phase1新規: エラー処理設定
    LOG_ALL_ERRORS: true,
    CAPTURE_STACK_TRACES: true,
    MAX_ERROR_LOGS: 100
};

// ==== Phase1新規: CONFIG完整性確認・自動修復システム ====
window.CONFIG_INTEGRITY = {
    /**
     * 完整性チェック実行
     */
    validate: function() {
        console.log('🔍 CONFIG完整性チェック開始...');
        
        const requiredKeys = [
            // 基本設定
            'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY', 'DEFAULT_COLOR', 'TARGET_FPS',
            'DEFAULT_ACTIVE_PRESET',  // 🔧 追加: エラー修正
            // プレビュー設定（重複処理解消対象）
            'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE', 'PRESET_UPDATE_THROTTLE',
            // 新規必須設定
            'SIZE_PRESETS', 'POPUP_CONFIG', 'LIVE_PREVIEW_CONFIG'
        ];
        
        const missingKeys = [];
        const invalidKeys = [];
        
        requiredKeys.forEach(key => {
            if (!(key in window.CONFIG)) {
                missingKeys.push(key);
            } else {
                const value = window.CONFIG[key];
                if (value === null || value === undefined) {
                    invalidKeys.push(key);
                }
            }
        });
        
        // SIZE_PRESETS特別チェック
        if (window.CONFIG.SIZE_PRESETS) {
            if (!Array.isArray(window.CONFIG.SIZE_PRESETS) || window.CONFIG.SIZE_PRESETS.length === 0) {
                invalidKeys.push('SIZE_PRESETS');
            }
        }
        
        const report = {
            valid: missingKeys.length === 0 && invalidKeys.length === 0,
            missing: missingKeys,
            invalid: invalidKeys,
            autoFixed: []
        };
        
        // 自動修復試行
        if (!report.valid) {
            report.autoFixed = this.autoFix(missingKeys, invalidKeys);
            report.valid = report.autoFixed.length === (missingKeys.length + invalidKeys.length);
        }
        
        if (report.valid) {
            console.log('✅ CONFIG完整性チェック完了');
        } else {
            console.warn('⚠️ CONFIG完整性の問題:', report);
        }
        
        return report;
    },
    
    /**
     * 自動修復実行
     */
    autoFix: function(missingKeys, invalidKeys) {
        const fixed = [];
        const defaults = {
            'DEFAULT_BRUSH_SIZE': 4,
            'DEFAULT_OPACITY': 0.85,
            'DEFAULT_COLOR': 0x800000,
            'DEFAULT_ACTIVE_PRESET': 'preset_4',  // 🔧 追加: エラー修正
            'TARGET_FPS': 60,
            'PREVIEW_MIN_SIZE': 1,
            'PREVIEW_MAX_SIZE': 32,
            'PRESET_UPDATE_THROTTLE': 16,
            'SIZE_PRESETS': [
                { name: '標準', size: 4, opacity: 0.85, color: 0x800000 }
            ],
            'POPUP_CONFIG': {
                WIDTH: 320,
                HEIGHT: 480,
                BACKGROUND_COLOR: 0xF0E0D6
            },
            'LIVE_PREVIEW_CONFIG': {
                ENABLED: true,
                UPDATE_THROTTLE: 16
            }
        };
        
        [...missingKeys, ...invalidKeys].forEach(key => {
            if (defaults[key] !== undefined) {
                window.CONFIG[key] = defaults[key];
                fixed.push(key);
                console.log(`🔧 CONFIG自動修復: ${key} = ${JSON.stringify(defaults[key])}`);
            }
        });
        
        return fixed;
    },
    
    /**
     * 設定統計取得
     */
    getStats: function() {
        return {
            totalKeys: Object.keys(window.CONFIG).length,
            uiConfigKeys: Object.keys(window.UI_CONFIG).length,
            eventKeys: Object.keys(window.UI_EVENTS).length,
            validationCacheSize: window.CONFIG_VALIDATION.cache.size,
            previewCacheSize: window.PREVIEW_UTILS.cache.size,
            cacheEnabled: window.CONFIG.CACHE_CONFIG.ENABLED
        };
    }
};

// ==== Phase1新規: 自動クリーンアップシステム ====
window.CONFIG_CLEANUP = {
    intervalId: null,
    
    /**
     * 自動クリーンアップ開始
     */
    start: function() {
        if (this.intervalId !== null) return;
        
        if (!window.CONFIG.CACHE_CONFIG.AUTO_CLEANUP) {
            console.log('ℹ️ CONFIG自動クリーンアップは無効です');
            return;
        }
        
        this.intervalId = setInterval(() => {
            this.cleanup();
        }, window.CONFIG.CACHE_CONFIG.CLEANUP_INTERVAL);
        
        console.log('🧹 CONFIG自動クリーンアップ開始');
    },
    
    /**
     * クリーンアップ実行
     */
    cleanup: function() {
        let cleanedCount = 0;
        
        // バリデーションキャッシュクリーンアップ
        const validationExpiry = window.CONFIG_VALIDATION.cacheExpiry;
        const validationCache = window.CONFIG_VALIDATION.cache;
        const now = Date.now();
        
        for (const [key, expiry] of validationExpiry.entries()) {
            if (now > expiry) {
                validationCache.delete(key);
                validationExpiry.delete(key);
                cleanedCount++;
            }
        }
        
        // プレビューキャッシュサイズ制限
        const previewCache = window.PREVIEW_UTILS.cache;
        const maxPreviewCache = window.CONFIG.CACHE_CONFIG.PREVIEW_CACHE_SIZE;
        
        if (previewCache.size > maxPreviewCache) {
            const toDelete = previewCache.size - maxPreviewCache;
            const keys = Array.from(previewCache.keys()).slice(0, toDelete);
            keys.forEach(key => previewCache.delete(key));
            cleanedCount += toDelete;
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 CONFIG自動クリーンアップ完了: ${cleanedCount}項目削除`);
        }
    },
    
    /**
     * 自動クリーンアップ停止
     */
    stop: function() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ CONFIG自動クリーンアップ停止');
        }
    }
};

// ==== Phase1: 初期化確認・完整性チェック実行 ====
console.log('🔍 Phase1 CONFIG統合初期化確認...');

// 完整性チェック実行
const integrityReport = window.CONFIG_INTEGRITY.validate();

// 統計情報表示
const configStats = window.CONFIG_INTEGRITY.getStats();
console.log('📊 CONFIG統計:', configStats);

// 自動クリーンアップ開始
window.CONFIG_CLEANUP.start();

console.log('✅ config.js Phase1統合強化版 読み込み完了');
console.log('📦 Phase1実装完了機能:');
console.log('  ✅ components.js完全対応 - 全必須CONFIG項目追加');
console.log('  ✅ safeConfigGet警告解消 - TARGET_FPS等の重複要求対応');
console.log('  ✅ PREVIEW設定統合 - MIN/MAX_SIZE重複処理解消');
console.log('  ✅ ライブプレビュー設定 - PresetDisplayManager完全対応');
console.log('  ✅ PixiJS拡張ライブラリ設定統合 - 全ライブラリ対応');
console.log('  ✅ キャッシュシステム - パフォーマンス最適化');
console.log('  ✅ 自動修復機能 - 不足設定の自動補完');
console.log('  ✅ 自動クリーンアップ - メモリ管理最適化');

console.log('🎯 Phase1効果:');
console.log(`  🚨 必須設定項目: ${configStats.totalKeys}項目完備`);
console.log('  ⚡ 重複処理解消: TARGET_FPS/PREVIEW設定統合');
console.log('  🛡️ 自動修復: 不足項目の自動補完');
console.log('  🔄 キャッシュ最適化: バリデーション・プレビュー計算高速化');

if (integrityReport.valid) {
    console.log('🎉 Phase1 CONFIG統合完了 - すべての設定が正常に読み込まれました');
} else {
    console.warn('⚠️ Phase1 CONFIG統合で一部問題が発生:', integrityReport);
}

console.log('⏭️ 次フェーズ: main.js Phase1実行 → 他ファイル連携復旧');

// ==== Phase1: グローバル関数エクスポート ====
if (typeof window !== 'undefined') {
    // CONFIG管理関数
    window.validateAppConfig = window.CONFIG_INTEGRITY.validate.bind(window.CONFIG_INTEGRITY);
    window.getConfigStats = window.CONFIG_INTEGRITY.getStats.bind(window.CONFIG_INTEGRITY);
    window.cleanupConfig = window.CONFIG_CLEANUP.cleanup.bind(window.CONFIG_CLEANUP);
    
    console.log('🎯 Phase1デバッグ関数:');
    console.log('  - window.validateAppConfig() - CONFIG完整性チェック');
    console.log('  - window.getConfigStats() - CONFIG統計取得');
    console.log('  - window.cleanupConfig() - 手動クリーンアップ');
}