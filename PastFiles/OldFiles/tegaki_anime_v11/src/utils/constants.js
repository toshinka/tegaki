// ========================================
// constants.js - 定数定義
// ========================================

(function() {
    'use strict';
    
    // デフォルトカラーパレット（配置.png準拠）
    const COLOR_PALETTE = [
        '#800000',  // アクティブペンカラー（デフォルト）
        '#aa5a56',
        '#cf9c97',
        '#e9c2ba',
        '#f0e0d6',  // キャンバス背景レイヤー0
        '#ffffff'   // 白
    ];
    
    // キャンバス設定
    const CANVAS_CONFIG = {
        WIDTH: 400,
        HEIGHT: 400,
        BACKGROUND_COLOR: '#f0e0d6',
        DEFAULT_PEN_COLOR: '#800000',
        DEFAULT_PEN_SIZE: 2,
        MIN_PEN_SIZE: 1,
        MAX_PEN_SIZE: 20
    };
    
    // アニメーション設定
    const ANIMATION_CONFIG = {
        DEFAULT_FRAME_COUNT: 3,
        DEFAULT_FRAME_DELAY: 200,  // ミリ秒
        MIN_FRAME_DELAY: 10,
        MAX_FRAME_DELAY: 2000,
        DEFAULT_LAYER_COUNT: 3  // フレームごとのレイヤー数
    };
    
    // ツール定義
    const TOOLS = {
        PEN: 'pen',
        ERASER: 'eraser',
        BUCKET: 'bucket'
    };
    
    // キーボードショートカット
    const KEYBOARD_SHORTCUTS = {
        UNDO: { key: 'z', ctrl: true },
        REDO: { key: 'y', ctrl: true },
        PEN_TOOL: { key: 'p' },
        ERASER_TOOL: { key: 'e' },
        BUCKET_TOOL: { key: 'g' },
        LAYER_UP: { key: 'q' },
        LAYER_DOWN: { key: 'w' }
    };
    
    // UI設定
    const UI_CONFIG = {
        SHORTCUT_PANEL_WIDTH: 180,
        CONTROL_PANEL_WIDTH: 180,
        LAYER_PANEL_WIDTH: 150,
        THUMBNAIL_SIZE: 60,
        LAYER_THUMBNAIL_SIZE: 50,
        PANEL_GAP: 10,
        PANEL_PADDING: 10,
        PANEL_BACKGROUND: 'rgba(240, 224, 214, 0.8)',
        PANEL_BORDER_COLOR: '#cf9c97',
        ACTIVE_COLOR: '#800000',
        INACTIVE_COLOR: '#aa5a56'
    };
    
    // エクスポート設定
    const EXPORT_CONFIG = {
        GIF_QUALITY: 10,
        GIF_WORKERS: 2,
        APNG_COMPRESSION: 0
    };
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.TegakiConstants = {
            COLOR_PALETTE,
            CANVAS_CONFIG,
            ANIMATION_CONFIG,
            TOOLS,
            KEYBOARD_SHORTCUTS,
            UI_CONFIG,
            EXPORT_CONFIG
        };
        console.log('✅ TegakiConstants loaded');
    }
})();