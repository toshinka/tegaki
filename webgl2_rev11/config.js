/**
 * @file config.js - Perfect-Freehand形状補正ゼロ版
 * @description グローバル設定・キーマップ定義
 * 
 * 【改修内容】
 * ✅ smoothing: 0（形状変形なし）
 * ✅ streamline: 0（ストローク終了後の変形なし）
 * ✅ thinning: 0（線が太らない）
 * ✅ easing: t => t（補間停止）
 * ✅ simulatePressure: false（筆圧データをそのまま使用）
 * 
 * 【親依存】なし（最上位設定ファイル）
 * 【子依存】全システムファイル
 */

window.TEGAKI_CONFIG = {
    canvas: { 
        width: 400, 
        height: 400 
    },
    
    renderer: {
        resolution: 1,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true
    },
    
    pen: { 
        size: 10, 
        opacity: 0.85, 
        color: 0x800000,
        pressure: {
            baselineCalibration: true,
            baselineSampleCount: 5,
            minPhysicalWidth: 1.0,
            enableDevicePixelRatio: true
        }
    },
    
    BRUSH_DEFAULTS: {
        color: 0x800000,
        size: 10,
        opacity: 1.0,
        minWidth: 1,
        maxWidth: 10
    },
    
    /**
     * Perfect-Freehand: 形状補正ゼロ・ポリゴン化専用設定
     * 
     * 🎯 目的:
     * - ユーザーが描いた線をそのまま保持
     * - ストローク終了後に形が変わらない
     * - ベクター化・メッシュ生成の入口としてのみ機能
     */
    perfectFreehand: {
        size: 10,              // ブラシサイズ（動的に上書き）
        
        // 🔧 形状補正を完全停止
        smoothing: 0,          // 平滑化なし（描いた点列そのまま）
        streamline: 0,         // 線の慣性・遅れ補正なし
        thinning: 0,           // 筆圧による線幅増減を内部補正しない
        
        // 🔧 補間停止（1:1）
        easing: (t) => t,      // 点の位置がずれない
        
        // 🔧 筆圧推定ロジック停止
        simulatePressure: false, // 外部筆圧データをそのまま使用
        
        // キャップ設定
        last: true,
        start: {
            taper: 0,
            cap: true
        },
        end: {
            taper: 0,
            cap: true
        }
    },
    
    brush: {
        pressure: {
            enabled: true,
            sensitivity: 1.0,
            minSize: 0.3,
            maxSize: 1.0
        },
        smoothing: {
            enabled: true,
            strength: 0.4,
            thinning: 0
        },
        flow: {
            enabled: false,
            opacity: 1.0,
            sensitivity: 1.0,
            accumulation: false
        }
    },
    
    webgpu: {
        enabled: true,
        fallbackToWebGL: true,
        computeWorkgroupSize: [8, 8, 1],
        maxBufferSize: 256 * 1024 * 1024,
        sdf: {
            enabled: true,
            minPointsForGPU: 5,
            maxDistance: 64
        },
        msdf: {
            enabled: true,
            range: 4.0,
            threshold: 0.5,
            smoothness: 0.05
        },
        dynamicMarginFactor: 0.05,
        minMargin: 10
    },
    
    camera: {
        minScale: 0.1,
        maxScale: 5.0,
        initialScale: 1.0,
        wheelZoomSpeed: 0.1,
        wheelRotationSpeed: 0.05,
        keyRotationDegree: 15,
        keyMoveAmount: 10,
        dragMoveSpeed: 1.0,
        dragScaleSpeed: 0.01,
        dragRotationSpeed: 0.3
    },
    
    layer: {
        minX: -1000,
        maxX: 1000,
        minY: -1000,
        maxY: 1000,
        minScale: 0.1,
        maxScale: 30.0,
        minRotation: -180,
        maxRotation: 180,
        rotationLoop: true
    },
    
    background: { 
        color: 0xf0e0d6 
    },
    
    history: { 
        maxSize: 10, 
        autoSaveInterval: 500 
    },
    
    thumbnail: {
        SIZE: 48,
        RENDER_SCALE: 3,
        QUALITY: 'high'
    },
    
    animation: {
        defaultFPS: 12,
        maxCuts: 50,
        defaultCutDuration: 0.5,
        exportSettings: {
            maxWidth: 800,
            maxHeight: 800,
            quality: 10,
            workers: 2
        },
        timeline: {
            cutThumbnailWidth: 72,
            cutThumbnailHeight: 54,
            maxVisibleCuts: 10
        },
        playback: {
            loopByDefault: true,
            previewQuality: 'medium'
        }
    },
    
    debug: false,
    
    /**
     * Perfect-Freehand設定ヘルパー
     */
    getPerfectFreehandOptions: function(brushSize = 10) {
        return {
            ...this.perfectFreehand,
            size: brushSize
        };
    }
};

// キーマップ定義
window.TEGAKI_KEYMAP = {
    actions: {
        UNDO: {
            key: 'KeyZ',
            ctrl: true,
            shift: false,
            description: '元に戻す'
        },
        REDO: [
            { key: 'KeyY', ctrl: true, shift: false, description: 'やり直し' },
            { key: 'KeyZ', ctrl: true, shift: true, description: 'やり直し' }
        ],
        TOOL_PEN: {
            key: 'KeyP',
            ctrl: false,
            shift: false,
            description: 'ペンツール'
        },
        TOOL_ERASER: {
            key: 'KeyE',
            ctrl: false,
            shift: false,
            description: '消しゴムツール'
        },
        TOOL_FILL: {
            key: 'KeyG',
            ctrl: false,
            shift: false,
            description: '塗りつぶしツール'
        },
        LAYER_CREATE: {
            key: 'KeyL',
            ctrl: true,
            shift: false,
            description: 'レイヤー追加'
        },
        LAYER_DELETE_DRAWINGS: [
            { key: 'Delete', ctrl: false, shift: false, description: 'レイヤーの絵を削除' },
            { key: 'Backspace', ctrl: false, shift: false, description: 'レイヤーの絵を削除' }
        ],
        LAYER_DELETE: {
            key: 'Delete',
            ctrl: true,
            shift: false,
            description: 'アクティブレイヤー削除'
        },
        LAYER_COPY: {
            key: 'KeyC',
            ctrl: true,
            shift: false,
            description: 'レイヤーコピー'
        },
        LAYER_PASTE: {
            key: 'KeyV',
            ctrl: true,
            shift: false,
            description: 'レイヤーペースト'
        },
        LAYER_CUT: {
            key: 'KeyX',
            ctrl: true,
            shift: false,
            description: 'レイヤー切り取り'
        },
        LAYER_RESET: {
            key: 'Digit0',
            ctrl: true,
            shift: false,
            vMode: true,
            description: 'レイヤー位置・サイズリセット'
        },
        LAYER_MOVE_UP: {
            key: 'ArrowUp',
            vMode: true,
            shift: false,
            ctrl: false,
            description: 'レイヤーを上に移動'
        },
        LAYER_MOVE_DOWN: {
            key: 'ArrowDown',
            vMode: true,
            shift: false,
            ctrl: false,
            description: 'レイヤーを下に移動'
        },
        LAYER_MOVE_LEFT: {
            key: 'ArrowLeft',
            vMode: true,
            shift: false,
            ctrl: false,
            description: 'レイヤーを左に移動'
        },
        LAYER_MOVE_RIGHT: {
            key: 'ArrowRight',
            vMode: true,
            shift: false,
            ctrl: false,
            description: 'レイヤーを右に移動'
        },
        LAYER_SCALE_UP: {
            key: 'ArrowUp',
            vMode: true,
            shift: true,
            ctrl: false,
            description: 'レイヤー拡大'
        },
        LAYER_SCALE_DOWN: {
            key: 'ArrowDown',
            vMode: true,
            shift: true,
            ctrl: false,
            description: 'レイヤー縮小'
        },
        LAYER_ROTATE_LEFT: {
            key: 'ArrowLeft',
            vMode: true,
            shift: true,
            ctrl: false,
            description: 'レイヤー左回転'
        },
        LAYER_ROTATE_RIGHT: {
            key: 'ArrowRight',
            vMode: true,
            shift: true,
            ctrl: false,
            description: 'レイヤー右回転'
        },
        LAYER_FLIP_HORIZONTAL: {
            key: 'KeyH',
            vMode: true,
            shift: false,
            ctrl: false,
            alt: false,
            description: 'レイヤー水平反転'
        },
        LAYER_FLIP_VERTICAL: {
            key: 'KeyH',
            vMode: true,
            shift: true,
            ctrl: false,
            alt: false,
            description: 'レイヤー垂直反転'
        },
        LAYER_HIERARCHY_UP: {
            key: 'ArrowUp',
            ctrl: false,
            shift: false,
            vMode: false,
            description: 'レイヤー選択を上へ'
        },
        LAYER_HIERARCHY_DOWN: {
            key: 'ArrowDown',
            ctrl: false,
            shift: false,
            vMode: false,
            description: 'レイヤー選択を下へ'
        },
        LAYER_ORDER_UP: {
            key: 'ArrowUp',
            ctrl: true,
            shift: false,
            vMode: false,
            description: 'レイヤー順序を上げる'
        },
        LAYER_ORDER_DOWN: {
            key: 'ArrowDown',
            ctrl: true,
            shift: false,
            vMode: false,
            description: 'レイヤー順序を下げる'
        },
        CAMERA_FLIP_HORIZONTAL: {
            key: 'KeyH',
            vMode: false,
            shift: false,
            ctrl: false,
            alt: false,
            description: 'キャンバス水平反転'
        },
        CAMERA_FLIP_VERTICAL: {
            key: 'KeyH',
            vMode: false,
            shift: true,
            ctrl: false,
            alt: false,
            description: 'キャンバス垂直反転'
        },
        CAMERA_RESET: {
            key: 'Digit0',
            ctrl: true,
            shift: false,
            vMode: false,
            description: 'カメラリセット'
        },
        TOGGLE_V_MODE: {
            key: 'KeyV',
            ctrl: false,
            shift: false,
            description: 'レイヤー移動モード切替'
        },
        POPUP_SETTINGS: {
            key: 'KeyS',
            ctrl: true,
            shift: false,
            description: '設定を開く'
        },
        POPUP_QUICK_ACCESS: {
            key: 'Space',
            ctrl: false,
            shift: false,
            description: 'クイックアクセスメニュー'
        },
        POPUP_ALBUM: {
            key: 'KeyA',
            ctrl: true,
            shift: false,
            description: 'アルバムを開く'
        },
        POPUP_EXPORT: {
            key: 'KeyE',
            ctrl: true,
            shift: false,
            description: 'エクスポート'
        }
    },
    
    modifiers: {
        CTRL: 'Control',
        SHIFT: 'Shift',
        ALT: 'Alt'
    }
};

console.log('✅ config.js - Perfect-Freehand形状補正ゼロ版 loaded');
console.log('   ✅ smoothing: 0（形状変形なし）');
console.log('   ✅ streamline: 0（終了後変形なし）');
console.log('   ✅ thinning: 0（線が太らない）');
console.log('   ✅ easing: t=>t（補間停止）');