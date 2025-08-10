/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev6
 * 設定統一管理システム - config.js (Phase2A: デフォルト値変更対応版)
 * 
 * 🔧 Phase2A修正内容:
 * 1. ✅ デフォルト値変更（ペンサイズ 16→4、透明度 85%→100%、最大サイズ 100→500）
 * 2. ✅ 設定値の統一管理（ハードコーディング解消）
 * 3. ✅ プリセット設定の整理
 * 4. ✅ UI設定・イベント定数の統一
 * 
 * Phase2A目標: デフォルト値変更 + 設定値統一管理の実現
 * 責務: 全設定値の定数化・整合性チェック・設定値分離
 * 依存: なし（最初に読み込まれる）
 */

// ==== 🆕 Phase2A: アプリケーション全体設定（デフォルト値変更対応） ====
export const CONFIG = {
    // 🔧 Phase2A: 描画設定デフォルト値変更
    DEFAULT_BRUSH_SIZE: 4,        // 16 → 4 に変更
    DEFAULT_OPACITY: 1.0,         // 0.85 → 1.0 (100%) に変更
    MAX_BRUSH_SIZE: 500,          // 100 → 500 に変更
    MIN_BRUSH_SIZE: 0.1,
    
    // 基本描画設定
    DEFAULT_COLOR: 0x800000,      // ふたばマルーン
    DEFAULT_PRESSURE: 0.5,        // 50%
    DEFAULT_SMOOTHING: 0.3,       // 30%
    
    // 🔧 Phase2A: プリセット設定（デフォルト値対応）
    SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
    DEFAULT_ACTIVE_PRESET: 'preset_4',  // デフォルトアクティブプリセット（4px）
    
    // キャンバス設定
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 400,
    BG_COLOR: 0xf0e0d6,          // ふたばクリーム
    
    // 🆕 Phase2A: パフォーマンス設定
    TARGET_FPS: 60,
    PERFORMANCE_UPDATE_INTERVAL: 1000,  // 1秒間隔
    MEMORY_WARNING_THRESHOLD: 100,      // 100MB
    
    // 🆕 Phase2A: プレビュー制限設定（外枠制限対応）
    PREVIEW_MIN_SIZE: 0.5,
    PREVIEW_MAX_SIZE: 20,        // 外枠制限：最大20px
    
    // UI設定
    POPUP_FADE_TIME: 300,
    NOTIFICATION_DURATION: 3000,
    SLIDER_UPDATE_THROTTLE: 16,   // 60fps相当
    PRESET_UPDATE_THROTTLE: 16    // 60fps相当
};

// ==== UI専用設定（コンポーネント用） ====
export const UI_CONFIG = {
    // スライダー設定
    SLIDER_HANDLE_SIZE: 16,
    SLIDER_TRACK_HEIGHT: 4,
    SLIDER_THROTTLE_MS: 16,      // 60fps相当
    
    // プレビュー設定（Phase2A: 外枠制限強化）
    SIZE_PREVIEW_MIN: CONFIG.PREVIEW_MIN_SIZE,
    SIZE_PREVIEW_MAX: CONFIG.PREVIEW_MAX_SIZE,
    SIZE_PREVIEW_FRAME_SIZE: 24, // プレビューフレームサイズ
    
    // ポップアップ設定
    POPUP_FADE_TIME: CONFIG.POPUP_FADE_TIME,
    POPUP_Z_INDEX: 1000,
    
    // プリセット更新設定
    PRESET_UPDATE_DELAY: CONFIG.PRESET_UPDATE_THROTTLE,
    
    // 通知設定
    NOTIFICATION_POSITION: 'top-right',
    NOTIFICATION_MAX_COUNT: 3
};

// ==== UIイベント定数（統一管理） ====
export const UI_EVENTS = {
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
    
    // 履歴イベント（Phase2A: 履歴管理連携）
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_RECORD: 'history:record'
};

// ==== 設定値バリデーション ====
export const CONFIG_VALIDATION = {
    /**
     * ブラシサイズの妥当性チェック（Phase2A: 拡大範囲対応）
     */
    validateBrushSize(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return CONFIG.DEFAULT_BRUSH_SIZE;
        return Math.max(CONFIG.MIN_BRUSH_SIZE, Math.min(CONFIG.MAX_BRUSH_SIZE, numSize));
    },
    
    /**
     * 透明度の妥当性チェック（Phase2A: 100%対応）
     */
    validateOpacity(opacity) {
        const numOpacity = parseFloat(opacity);
        if (isNaN(numOpacity)) return CONFIG.DEFAULT_OPACITY;
        return Math.max(0, Math.min(1, numOpacity));
    },
    
    /**
     * プレビューサイズの妥当性チェック（Phase2A: 制限強化）
     */
    validatePreviewSize(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return CONFIG.PREVIEW_MIN_SIZE;
        return Math.max(CONFIG.PREVIEW_MIN_SIZE, Math.min(CONFIG.PREVIEW_MAX_SIZE, numSize));
    },
    
    /**
     * キャンバスサイズの妥当性チェック
     */
    validateCanvasSize(width, height) {
        const numWidth = parseInt(width, 10);
        const numHeight = parseInt(height, 10);
        
        return {
            width: isNaN(numWidth) ? CONFIG.CANVAS_WIDTH : Math.max(100, Math.min(4000, numWidth)),
            height: isNaN(numHeight) ? CONFIG.CANVAS_HEIGHT : Math.max(100, Math.min(4000, numHeight))
        };
    }
};

// ==== 🆕 Phase2A: プレビュー計算ユーティリティ ====
export const PREVIEW_UTILS = {
    /**
     * Phase2A: 外枠制限を考慮したプレビューサイズ計算
     * @param {number} actualSize - 実際のブラシサイズ
     * @returns {number} - 表示用プレビューサイズ（px）
     */
    calculatePreviewSize(actualSize) {
        const size = parseFloat(actualSize);
        if (isNaN(size) || size <= 0) return CONFIG.PREVIEW_MIN_SIZE;
        
        // Phase2A: 32px以下は線形スケール
        if (size <= 32) {
            const normalizedSize = Math.min(1.0, size / 32);
            return Math.max(CONFIG.PREVIEW_MIN_SIZE, 
                          Math.min(CONFIG.PREVIEW_MAX_SIZE, 
                                 normalizedSize * CONFIG.PREVIEW_MAX_SIZE));
        } else {
            // Phase2A: 32px超は対数スケールで圧縮（500px対応）
            const logScale = Math.log(size / 32) / Math.log(CONFIG.MAX_BRUSH_SIZE / 32);
            const compressedScale = logScale * 0.3; // 圧縮率
            return Math.min(CONFIG.PREVIEW_MAX_SIZE, 
                          CONFIG.PREVIEW_MAX_SIZE * (0.7 + compressedScale));
        }
    },
    
    /**
     * Phase2A: プレビュー色の透明度適用
     * @param {number} color - 基本色（16進数）
     * @param {number} opacity - 透明度（0-1）
     * @returns {string} - CSS色文字列
     */
    applyOpacityToColor(color, opacity) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        const validOpacity = Math.max(0, Math.min(1, opacity));
        
        return `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
    }
};

// ==== Phase2A: デフォルト設定のエクスポート ====
export const DEFAULT_SETTINGS = {
    brushSize: CONFIG.DEFAULT_BRUSH_SIZE,
    opacity: CONFIG.DEFAULT_OPACITY,
    color: CONFIG.DEFAULT_COLOR,
    pressure: CONFIG.DEFAULT_PRESSURE,
    smoothing: CONFIG.DEFAULT_SMOOTHING,
    activePreset: CONFIG.DEFAULT_ACTIVE_PRESET
};

// ==== ふたば☆ちゃんねる配色定義（変更なし） ====
export const FUTABA_COLORS = {
    MAROON: 0x800000,           // 主線・基調色
    LIGHT_MAROON: 0xaa5a56,     // セカンダリ・ボタン
    MEDIUM: 0xcf9c97,           // アクセント・ホバー
    LIGHT_MEDIUM: 0xe9c2ba,     // 境界線・分離線
    CREAM: 0xf0e0d6,            // キャンバス背景
    BACKGROUND: 0xffffee        // アプリ背景
};

// ==== デバッグ・テスト用設定 ====
export const DEBUG_CONFIG = {
    ENABLE_LOGGING: true,
    LOG_PERFORMANCE: true,
    LOG_HISTORY: true,
    SHOW_PREVIEW_BOUNDS: false,  // プレビュー境界表示（デバッグ用）
    ENABLE_CONFIG_VALIDATION: true
};

// ==== グローバル登録（後方互換性） ====
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.UI_CONFIG = UI_CONFIG;
    window.UI_EVENTS = UI_EVENTS;
    window.CONFIG_VALIDATION = CONFIG_VALIDATION;
    window.PREVIEW_UTILS = PREVIEW_UTILS;
    window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.FUTABA_COLORS = FUTABA_COLORS;
    
    console.log('🎯 config.js 読み込み完了（Phase2A: デフォルト値変更対応版）');
    console.log('📦 エクスポート設定:');
    console.log(`  🔧 デフォルトサイズ: ${CONFIG.DEFAULT_BRUSH_SIZE}px （16→4に変更）`);
    console.log(`  🔧 デフォルト透明度: ${CONFIG.DEFAULT_OPACITY * 100}% （85%→100%に変更）`);
    console.log(`  🔧 最大サイズ: ${CONFIG.MAX_BRUSH_SIZE}px （100→500に変更）`);
    console.log(`  🎨 プリセット: [${CONFIG.SIZE_PRESETS.join(', ')}]px`);
    console.log(`  📐 プレビュー制限: ${CONFIG.PREVIEW_MIN_SIZE}-${CONFIG.PREVIEW_MAX_SIZE}px`);
    console.log(`  ⚡ パフォーマンス: ${CONFIG.TARGET_FPS}fps目標`);
    console.log('✅ Phase2A 実装完了: デフォルト値変更・設定統一管理・プレビュー制限強化');
}

// ==== ES6モジュールエクスポート（将来のTypeScript移行用）====
// export { CONFIG, UI_CONFIG, UI_EVENTS, CONFIG_VALIDATION, PREVIEW_UTILS, DEFAULT_SETTINGS, FUTABA_COLORS };