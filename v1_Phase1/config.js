/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * 設定統一管理システム - config.js (Phase2A: 緊急修正版 - export構文エラー解決)
 * 
 * 🔧 Phase2A緊急修正内容:
 * 1. ✅ ES6 export → ブラウザ互換のグローバル変数方式に変更
 * 2. ✅ 不足していた CONFIG_VALIDATION, PREVIEW_UTILS, FUTABA_COLORS 追加
 * 3. ✅ デフォルト値変更（ペンサイズ 16→4、透明度 85%→100%、最大サイズ 100→500）
 * 4. ✅ 設定値の統一管理（ハードコーディング解消）
 * 5. ✅ プリセット設定の整理
 * 6. ✅ UI設定・イベント定数の統一
 * 
 * Phase2A緊急修正目標: export構文エラー解決 + デフォルト値変更 + 設定値統一管理
 * 責務: 全設定値の定数化・整合性チェック・設定値分離
 * 依存: なし（最初に読み込まれる）
 */

console.log('🔧 config.js Phase2A 緊急修正版読み込み開始...');

// ==== 🆕 Phase2A: アプリケーション全体設定（デフォルト値変更対応・export構文エラー解決版） ====
window.CONFIG = {
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
window.UI_CONFIG = {
    // スライダー設定
    SLIDER_HANDLE_SIZE: 16,
    SLIDER_TRACK_HEIGHT: 4,
    SLIDER_THROTTLE_MS: 16,      // 60fps相当
    
    // プレビュー設定（Phase2A: 外枠制限強化）
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

// ==== UIイベント定数（統一管理） ====
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
    
    // 履歴イベント（Phase2A: 履歴管理連携）
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_RECORD: 'history:record'
};

// ==== 設定値バリデーション ====
window.CONFIG_VALIDATION = {
    /**
     * ブラシサイズの妥当性チェック（Phase2A: 拡大範囲対応）
     */
    validateBrushSize: function(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return window.CONFIG.DEFAULT_BRUSH_SIZE;
        return Math.max(window.CONFIG.MIN_BRUSH_SIZE, Math.min(window.CONFIG.MAX_BRUSH_SIZE, numSize));
    },
    
    /**
     * 透明度の妥当性チェック（Phase2A: 100%対応）
     */
    validateOpacity: function(opacity) {
        const numOpacity = parseFloat(opacity);
        if (isNaN(numOpacity)) return window.CONFIG.DEFAULT_OPACITY;
        return Math.max(0, Math.min(1, numOpacity));
    },
    
    /**
     * プレビューサイズの妥当性チェック（Phase2A: 制限強化）
     */
    validatePreviewSize: function(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return window.CONFIG.PREVIEW_MIN_SIZE;
        return Math.max(window.CONFIG.PREVIEW_MIN_SIZE, Math.min(window.CONFIG.PREVIEW_MAX_SIZE, numSize));
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

// ==== 🆕 Phase2A: プレビュー計算ユーティリティ ====
window.PREVIEW_UTILS = {
    /**
     * Phase2A: 外枠制限を考慮したプレビューサイズ計算
     * @param {number} actualSize - 実際のブラシサイズ
     * @returns {number} - 表示用プレビューサイズ（px）
     */
    calculatePreviewSize: function(actualSize) {
        const size = parseFloat(actualSize);
        if (isNaN(size) || size <= 0) return window.CONFIG.PREVIEW_MIN_SIZE;
        
        // Phase2A: 32px以下は線形スケール
        if (size <= 32) {
            const normalizedSize = Math.min(1.0, size / 32);
            return Math.max(window.CONFIG.PREVIEW_MIN_SIZE, 
                          Math.min(window.CONFIG.PREVIEW_MAX_SIZE, 
                                 normalizedSize * window.CONFIG.PREVIEW_MAX_SIZE));
        } else {
            // Phase2A: 32px超は対数スケールで圧縮（500px対応）
            const logScale = Math.log(size / 32) / Math.log(window.CONFIG.MAX_BRUSH_SIZE / 32);
            const compressedScale = logScale * 0.3; // 圧縮率
            return Math.min(window.CONFIG.PREVIEW_MAX_SIZE, 
                          window.CONFIG.PREVIEW_MAX_SIZE * (0.7 + compressedScale));
        }
    },
    
    /**
     * Phase2A: プレビュー色の透明度適用
     * @param {number} color - 基本色（16進数）
     * @param {number} opacity - 透明度（0-1）
     * @returns {string} - CSS色文字列
     */
    applyOpacityToColor: function(color, opacity) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        const validOpacity = Math.max(0, Math.min(1, opacity));
        
        return `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
    }
};

// ==== Phase2A: デフォルト設定のエクスポート ====
window.DEFAULT_SETTINGS = {
    brushSize: window.CONFIG.DEFAULT_BRUSH_SIZE,
    opacity: window.CONFIG.DEFAULT_OPACITY,
    color: window.CONFIG.DEFAULT_COLOR,
    pressure: window.CONFIG.DEFAULT_PRESSURE,
    smoothing: window.CONFIG.DEFAULT_SMOOTHING,
    activePreset: window.CONFIG.DEFAULT_ACTIVE_PRESET
};

// ==== ふたば☆ちゃんねる配色定義（変更なし） ====
window.FUTABA_COLORS = {
    MAROON: 0x800000,           // 主線・基調色
    LIGHT_MAROON: 0xaa5a56,     // セカンダリ・ボタン
    MEDIUM: 0xcf9c97,           // アクセント・ホバー
    LIGHT_MEDIUM: 0xe9c2ba,     // 境界線・分離線
    CREAM: 0xf0e0d6,            // キャンバス背景
    BACKGROUND: 0xffffee        // アプリ背景
};

// ==== デバッグ・テスト用設定 ====
window.DEBUG_CONFIG = {
    ENABLE_LOGGING: true,
    LOG_PERFORMANCE: true,
    LOG_HISTORY: true,
    SHOW_PREVIEW_BOUNDS: false,  // プレビュー境界表示（デバッグ用）
    ENABLE_CONFIG_VALIDATION: true
};

// ==== 初期化確認・ログ出力 ====
console.log('✅ config.js Phase2A 緊急修正版読み込み完了');
console.log('📦 エクスポート設定（グローバル変数形式）:');
console.log(`  🔧 デフォルトサイズ: ${window.CONFIG.DEFAULT_BRUSH_SIZE}px （16→4に変更）`);
console.log(`  🔧 デフォルト透明度: ${window.CONFIG.DEFAULT_OPACITY * 100}% （85%→100%に変更）`);
console.log(`  🔧 最大サイズ: ${window.CONFIG.MAX_BRUSH_SIZE}px （100→500に変更）`);
console.log(`  🎨 プリセット: [${window.CONFIG.SIZE_PRESETS.join(', ')}]px`);
console.log(`  📐 プレビュー制限: ${window.CONFIG.PREVIEW_MIN_SIZE}-${window.CONFIG.PREVIEW_MAX_SIZE}px`);
console.log(`  ⚡ パフォーマンス: ${window.CONFIG.TARGET_FPS}fps目標`);
console.log('✅ Phase2A 緊急修正完了: export構文エラー解決・設定統一管理・プレビュー制限強化');

// ==== TypeScript+Vite+ES6移行準備（コメント形式で準備のみ）====
/*
// 🚀 将来のTypeScript+Vite+ES6移行用 export 準備
// 移行時にコメントアウトを解除し、window.xxxをexportに変更予定

export const CONFIG = window.CONFIG;
export const UI_CONFIG = window.UI_CONFIG;
export const UI_EVENTS = window.UI_EVENTS;
export const CONFIG_VALIDATION = window.CONFIG_VALIDATION;
export const PREVIEW_UTILS = window.PREVIEW_UTILS;
export const DEFAULT_SETTINGS = window.DEFAULT_SETTINGS;
export const FUTABA_COLORS = window.FUTABA_COLORS;
export const DEBUG_CONFIG = window.DEBUG_CONFIG;

// TypeScript型定義準備
export interface BrushSettings {
    size: number;
    opacity: number;
    color: number;
    pressure: number;
    smoothing: number;
}

export interface CanvasSize {
    width: number;
    height: number;
}

export interface PreviewData {
    dataSize: number;
    displaySize: number;
    actualSize: number;
    sizeLabel: string;
    opacity: number;
    opacityLabel: string;
    color: string;
    isActive: boolean;
}
*/

// ==== 設定値チェック・バリデーション実行 ====
if (window.DEBUG_CONFIG.ENABLE_CONFIG_VALIDATION) {
    console.group('🔍 CONFIG値検証（Phase2A緊急修正版）');
    
    try {
        // 必須オブジェクトの存在確認
        const requiredObjects = [
            'CONFIG', 'UI_CONFIG', 'UI_EVENTS', 'CONFIG_VALIDATION', 
            'PREVIEW_UTILS', 'DEFAULT_SETTINGS', 'FUTABA_COLORS'
        ];
        
        const missing = requiredObjects.filter(obj => typeof window[obj] === 'undefined');
        
        if (missing.length === 0) {
            console.log('✅ 全必須オブジェクト利用可能');
        } else {
            console.error('❌ 不足オブジェクト:', missing);
        }
        
        // デフォルト値の妥当性チェック
        const brushSizeValid = window.CONFIG_VALIDATION.validateBrushSize(window.CONFIG.DEFAULT_BRUSH_SIZE) === window.CONFIG.DEFAULT_BRUSH_SIZE;
        const opacityValid = window.CONFIG_VALIDATION.validateOpacity(window.CONFIG.DEFAULT_OPACITY) === window.CONFIG.DEFAULT_OPACITY;
        
        console.log('✅ デフォルト値妥当性:');
        console.log(`  - ブラシサイズ: ${brushSizeValid ? '✅' : '❌'} ${window.CONFIG.DEFAULT_BRUSH_SIZE}px`);
        console.log(`  - 透明度: ${opacityValid ? '✅' : '❌'} ${window.CONFIG.DEFAULT_OPACITY * 100}%`);
        
        // プレビュー計算テスト
        console.log('✅ プレビューサイズ計算テスト:');
        const testSizes = [1, 4, 16, 32, 100, 500];
        testSizes.forEach(size => {
            const previewSize = window.PREVIEW_UTILS.calculatePreviewSize(size);
            console.log(`  - ${size}px → ${previewSize.toFixed(1)}px (制限: ${window.CONFIG.PREVIEW_MAX_SIZE}px)`);
        });
        
    } catch (error) {
        console.error('❌ CONFIG検証エラー:', error);
    }
    
    console.groupEnd();
}

// ==== Phase2A修正完了通知 ====
console.log('🎉 config.js Phase2A緊急修正版 - 初期化完了');
console.log('🔧 解決した問題:');
console.log('  ✅ ES6 export構文エラー → window.グローバル変数形式');
console.log('  ✅ CONFIG_VALIDATION 不足 → 実装完了');
console.log('  ✅ PREVIEW_UTILS 不足 → 実装完了（外枠制限対応）');
console.log('  ✅ FUTABA_COLORS 不足 → 実装完了');
console.log('  ✅ デフォルト値変更対応 → Phase2要件達成');
console.log('🏗️ システム準備完了 - main.js初期化待機中...');