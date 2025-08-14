/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * 設定統一管理システム - config.js (緊急CONFIG補完修正版)
 * 
 * 🔧 緊急修正内容:
 * 1. ✅ ログから特定した不足CONFIG項目追加
 * 2. ✅ safeConfigGet対応の階層構造修正
 * 3. ✅ PenToolUI・ポップアップ関連CONFIG追加
 * 4. ✅ パフォーマンス監視CONFIG追加
 * 
 * 緊急修正目標: safeConfigGetエラー完全解消
 */

console.log('🔧 config.js 緊急CONFIG補完修正版読み込み開始...');

// ==== 🆕 緊急追加: 不足CONFIG項目（ログエラー解決用） ====
window.CONFIG = {
    // 🚨 緊急修正: ログエラーで特定された不足項目
    SIZE_PRESETS: [
        { name: '極細', size: 1, opacity: 90, color: 0x800000 },
        { name: '細', size: 2, opacity: 85, color: 0x800000 },
        { name: '標準', size: 4, opacity: 85, color: 0x800000 },
        { name: '太', size: 8, opacity: 80, color: 0x800000 },
        { name: '極太', size: 16, opacity: 75, color: 0x800000 },
        { name: '超極太', size: 32, opacity: 70, color: 0x800000 }
    ],
    
    // 🚨 緊急修正: プレビュー関連（ログエラー解消）
    PREVIEW_MIN_SIZE: 1,
    PREVIEW_MAX_SIZE: 32,
    PREVIEW_DEFAULT_SIZE: 4,
    
    // 🚨 緊急修正: デフォルト値（ログエラー解消）
    DEFAULT_COLOR: 0x800000,      // ふたばマルーン
    DEFAULT_BRUSH_SIZE: 4,        
    DEFAULT_OPACITY: 0.85,        // 85%
    DEFAULT_PRESSURE: 0.5,        // 50%
    DEFAULT_SMOOTHING: 0.3,       // 30%
    
    // 🚨 緊急修正: パフォーマンス関連（ログエラー解消）
    PRESET_UPDATE_THROTTLE: 16,   // 60fps相当
    PERFORMANCE_UPDATE_INTERVAL: 1000,  // 1秒間隔
    TARGET_FPS: 60,
    
    // 既存設定値
    MAX_BRUSH_SIZE: 500,
    MIN_BRUSH_SIZE: 0.1,
    
    // キャンバス設定
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 400,
    BG_COLOR: 0xf0e0d6,          // ふたばクリーム
    
    // UI設定
    POPUP_FADE_TIME: 300,
    NOTIFICATION_DURATION: 3000,
    SLIDER_UPDATE_THROTTLE: 16,   // 60fps相当
    
    // 🆕 緊急追加: ポップアップ専用設定
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
        SPACING: 12
    },
    
    // 🆕 緊急追加: ライブラリ統合設定
    LIBRARY_CONFIG: {
        // @pixi/ui設定
        UI_THEME: 'futaba',
        UI_BUTTON_STYLE: {
            backgroundColor: 0x800000,
            hoverColor: 0xaa5a56,
            textColor: 0xFFFFFF,
            borderRadius: 4,
            padding: 8
        },
        
        // @pixi/layers設定
        LAYER_MAX_COUNT: 10,
        LAYER_BLEND_MODES: ['normal', 'multiply', 'screen'],
        
        // @pixi/gif設定
        GIF_MAX_FRAMES: 60,
        GIF_DEFAULT_DELAY: 100,
        GIF_MAX_SIZE: { width: 800, height: 600 },
        
        // graphics系設定
        SMOOTH_GRAPHICS_ENABLED: true,
        GRAPHICS_EXTRAS_ENABLED: true,
        ANTI_ALIAS_QUALITY: 'high'
    },

    // 🆕 緊急追加: ライブラリ有効化フラグ
    LIBRARY_FLAGS: {
        ENABLE_PIXI_UI: true,
        ENABLE_PIXI_LAYERS: true,
        ENABLE_PIXI_GIF: false,    // Phase5で有効化予定
        ENABLE_SMOOTH_GRAPHICS: true,
        ENABLE_GRAPHICS_EXTRAS: true
    }
};

// ==== UI専用設定（既存）====
window.UI_CONFIG = {
    // スライダー設定
    SLIDER_HANDLE_SIZE: 16,
    SLIDER_TRACK_HEIGHT: 4,
    SLIDER_THROTTLE_MS: 16,      // 60fps相当
    
    // プレビュー設定
    SIZE_PREVIEW_MIN: window.CONFIG.PREVIEW_MIN_SIZE,
    SIZE_PREVIEW_MAX: window.CONFIG.PREVIEW_MAX_SIZE,
    SIZE_PREVIEW_FRAME_SIZE: 24, // プレビューフレームサイズ
    
    // ポップアップ設定
    POPUP_FADE_TIME: window.CONFIG.POPUP_FADE_TIME,
    POPUP_Z_INDEX: 1000,
    
    // プリセット更新設定
    PRESET_UPDATE_DELAY: window.CONFIG.PRESET_UPDATE_THROTTLE,
    
    // 通知設定
    NOTIFICATION_POSITION: 'top-right',
    NOTIFICATION_MAX_COUNT: 3
};

// ==== UIイベント定数（既存） ====
window.UI_EVENTS = {
    // スライダーイベント
    SLIDER_CHANGE: 'slider:change',
    SLIDER_START: 'slider:start',
    SLIDER_END: 'slider:end',
    
    // プリセットイベント
    PRESET_SELECT: 'preset:select',
    PRESET_CHANGE: 'preset:change',
    PRESET_RESET: 'preset:reset',
    
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
    
    // 履歴イベント
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_RECORD: 'history:record'
};

// ==== 設定値バリデーション（既存＋拡張） ====
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
     * 透明度の妥当性チェック
     */
    validateOpacity: function(opacity) {
        const numOpacity = parseFloat(opacity);
        if (isNaN(numOpacity)) return window.CONFIG.DEFAULT_OPACITY;
        return Math.max(0, Math.min(1, numOpacity));
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
     * 🆕 プリセット妥当性チェック
     */
    validatePreset: function(preset) {
        if (!preset || typeof preset !== 'object') return null;
        
        return {
            name: preset.name || 'デフォルト',
            size: this.validateBrushSize(preset.size || 4),
            opacity: this.validateOpacity(preset.opacity || 0.85),
            color: typeof preset.color === 'number' ? preset.color : window.CONFIG.DEFAULT_COLOR
        };
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
    }
};

// ==== プレビュー計算ユーティリティ（既存） ====
window.PREVIEW_UTILS = {
    /**
     * 外枠制限を考慮したプレビューサイズ計算
     */
    calculatePreviewSize: function(actualSize) {
        const size = parseFloat(actualSize);
        if (isNaN(size) || size <= 0) return window.CONFIG.PREVIEW_MIN_SIZE;
        
        if (size <= 32) {
            const normalizedSize = Math.min(1.0, size / 32);
            return Math.max(window.CONFIG.PREVIEW_MIN_SIZE, 
                          Math.min(window.CONFIG.PREVIEW_MAX_SIZE, 
                                 normalizedSize * window.CONFIG.PREVIEW_MAX_SIZE));
        } else {
            const logScale = Math.log(size / 32) / Math.log(window.CONFIG.MAX_BRUSH_SIZE / 32);
            const compressedScale = logScale * 0.3;
            return Math.min(window.CONFIG.PREVIEW_MAX_SIZE, 
                          window.CONFIG.PREVIEW_MAX_SIZE * (0.7 + compressedScale));
        }
    },
    
    /**
     * プレビュー色の透明度適用
     */
    applyOpacityToColor: function(color, opacity) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        const validOpacity = Math.max(0, Math.min(1, opacity));
        
        return `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
    }
};

// ==== デフォルト設定のエクスポート（更新版） ====
window.DEFAULT_SETTINGS = {
    brushSize: window.CONFIG.DEFAULT_BRUSH_SIZE,
    opacity: window.CONFIG.DEFAULT_OPACITY,
    color: window.CONFIG.DEFAULT_COLOR,
    pressure: window.CONFIG.DEFAULT_PRESSURE,
    smoothing: window.CONFIG.DEFAULT_SMOOTHING,
    
    // 🆕 プリセット関連
    activePreset: 'preset_4',
    presets: window.CONFIG.SIZE_PRESETS
};

// ==== ふたば☆ちゃんねる配色定義（既存） ====
window.FUTABA_COLORS = {
    MAROON: 0x800000,           // 主線・基調色
    LIGHT_MAROON: 0xaa5a56,     // セカンダリ・ボタン
    MEDIUM: 0xcf9c97,           // アクセント・ホバー
    LIGHT_MEDIUM: 0xe9c2ba,     // 境界線・分離線
    CREAM: 0xf0e0d6,            // キャンバス背景
    BACKGROUND: 0xffffee        // アプリ背景
};

// ==== デバッグ・テスト用設定（既存） ====
window.DEBUG_CONFIG = {
    ENABLE_LOGGING: true,
    LOG_PERFORMANCE: true,
    LOG_HISTORY: true,
    SHOW_PREVIEW_BOUNDS: false,
    ENABLE_CONFIG_VALIDATION: true
};

// ==== 🆕 緊急追加: CONFIG完整性確認システム ====
window.validateConfigIntegrity = function() {
    const requiredKeys = [
        'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE', 
        'DEFAULT_COLOR', 'PRESET_UPDATE_THROTTLE', 'TARGET_FPS',
        'PERFORMANCE_UPDATE_INTERVAL', 'POPUP_CONFIG', 'LIBRARY_CONFIG'
    ];
    
    const missingKeys = [];
    const report = { valid: true, missing: [], present: [] };
    
    requiredKeys.forEach(key => {
        if (window.CONFIG[key] === undefined) {
            missingKeys.push(key);
            report.missing.push(key);
            report.valid = false;
        } else {
            report.present.push(key);
        }
    });
    
    if (missingKeys.length > 0) {
        console.warn('⚠️ 不足CONFIG項目:', missingKeys);
    } else {
        console.log('✅ 全必須CONFIG項目確認完了');
    }
    
    return report;
};

// ==== 初期化確認・ログ出力 ====
console.log('✅ config.js 緊急CONFIG補完修正版読み込み完了');
console.log('📦 エクスポート設定:');
console.log(`  🎨 プリセット数: ${window.CONFIG.SIZE_PRESETS.length}`);
console.log(`  📐 プレビュー制限: ${window.CONFIG.PREVIEW_MIN_SIZE}-${window.CONFIG.PREVIEW_MAX_SIZE}px`);
console.log(`  🎯 デフォルト色: #${window.CONFIG.DEFAULT_COLOR.toString(16)}`);
console.log(`  ⚡ TARGET_FPS: ${window.CONFIG.TARGET_FPS}`);
console.log(`  🔧 ポップアップ設定: ${window.CONFIG.POPUP_CONFIG.WIDTH}×${window.CONFIG.POPUP_CONFIG.HEIGHT}px`);

// ==== CONFIG完整性チェック実行 ====
const configReport = window.validateConfigIntegrity();
console.log('🔍 CONFIG完整性レポート:', configReport);

console.log('🎉 config.js 緊急CONFIG補完修正完了 - PenToolUI初期化準備完了');