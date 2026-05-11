/**
 * @file config.js - v8.14.0 DPR=1固定化版
 * @description グローバル設定・キーマップ定義
 * 
 * 【v8.14.0 改修内容 - Phase 1: DPR=1固定化】
 * 🚨 重要: renderer.resolution を devicePixelRatio から 1 へ固定
 * 理由: 描画時解像度と出力時解像度の一致を保証
 * 方針: DPR=1固定 + 出力時任意解像度スケーリング（Sketchbook方式）
 * 
 * 🚨 後続Claude担当者への警告:
 * - devicePixelRatio を使用した DPR 倍加は厳禁
 * - 本ツールは GPU/WebGPU ベースの PC 優位設計（Retina対応不要）
 * - 解像度制御は出力時のみで行う（export-manager.js 参照）
 * 
 * 【v8.13.15 改修内容】
 * 🎨 TOOL_FILL: Gキー → 塗りつぶしツール追加
 * 
 * 【v8.13.14 改修内容】
 * 🔧 Phase 3: LAYER_DELETE (Ctrl+Delete)、LAYER_CUT (Ctrl+X) 追加
 * 🔧 Phase 3: FRAME_PREV/NEXT (←→) 単体キー化、Ctrl不要に
 * 🔧 Phase 4: GIF_PREV_FRAME / GIF_NEXT_FRAME 削除
 * 🧹 LAYER_CLEAR 削除 (LAYER_DELETE に統合)
 * 📝 ヘッダー依存関係明記
 * 
 * 【親ファイル (このファイルが依存)】
 * なし（最上位設定ファイル）
 * 
 * 【子ファイル (このファイルに依存)】
 * - core-initializer.js (PIXI.Application初期化でresolution参照)
 * - core-engine.js (システム全体の設定参照)
 * - 全システムファイル (window.TEGAKI_CONFIG参照)
 * - keyboard-handler.js (window.TEGAKI_KEYMAP参照)
 * - camera-system.js, layer-system.js等
 */

window.TEGAKI_CONFIG = {
    canvas: { 
        width: 400, 
        height: 400 
    },
    
    /**
     * 🚨 Phase 1改修: renderer設定
     * resolution: 1 固定（devicePixelRatio 参照を削除）
     * 
     * 【設計思想】
     * - 描画時は常に等倍（DPR=1）で処理
     * - 出力時に任意解像度でスケーリング（export-manager.js で制御）
     * - ユーザーの期待値と出力結果を一致させる
     * 
     * 【影響】
     * - 全描画処理が軽量化
     * - Retina画面で若干の粗さが出る可能性（許容範囲）
     * - 出力品質は settings-manager.js の exportResolution で制御
     */
    renderer: {
        resolution: 1,  // 旧: window.devicePixelRatio || 1
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
    perfectFreehand: {
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true,
        easing: (t) => t,
        start: { taper: 0, easing: (t) => t, cap: true },
        end: { taper: 0, easing: (t) => t, cap: true }
    },
    BRUSH_DEFAULTS: {
        color: 0x800000,
        size: 10,
        opacity: 1.0,
        minWidth: 1,
        maxWidth: 10
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
        }
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
    debug: false
};

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
        // 🎨 v8.13.15: 塗りつぶしツール (Gキー)
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
        FRAME_PREV: {
            key: 'ArrowLeft',
            ctrl: false,
            shift: false,
            vMode: false,
            description: '前のフレーム'
        },
        FRAME_NEXT: {
            key: 'ArrowRight',
            ctrl: false,
            shift: false,
            vMode: false,
            description: '次のフレーム'
        },
        GIF_PLAY_PAUSE: {
            key: 'Space',
            ctrl: true,
            shift: false,
            description: '再生/停止'
        },
        GIF_TOGGLE_TIMELINE: {
            key: 'KeyA',
            ctrl: false,
            shift: true,
            description: 'タイムライン表示切替'
        },
        GIF_CREATE_FRAME: {
            key: 'KeyN',
            ctrl: false,
            shift: true,
            description: '新規フレーム作成'
        },
        GIF_COPY_FRAME: {
            key: 'KeyC',
            ctrl: false,
            shift: true,
            description: 'フレームコピー'
        },
        SETTINGS_OPEN: {
            key: 'Comma',
            ctrl: true,
            shift: false,
            description: '設定を開く'
        },
        EXPORT_TOGGLE: {
            key: 'KeyE',
            ctrl: true,
            shift: false,
            description: 'エクスポート'
        },
        QUICK_ACCESS_TOGGLE: {
            key: 'KeyQ',
            ctrl: false,
            shift: false,
            description: 'クイックアクセス'
        }
    },
    
    getAction(event, context = {}) {
        const { vMode = false } = context;
        const { code, ctrlKey, metaKey, shiftKey, altKey, repeat } = event;
        const ctrl = ctrlKey || metaKey;
        
        for (const [actionName, config] of Object.entries(this.actions)) {
            const configs = Array.isArray(config) ? config : [config];
            
            for (const cfg of configs) {
                if (cfg.key !== code) continue;
                if (cfg.ctrl !== undefined && cfg.ctrl !== ctrl) continue;
                if (cfg.shift !== undefined && cfg.shift !== shiftKey) continue;
                if (cfg.alt !== undefined && cfg.alt !== altKey) continue;
                if (cfg.vMode !== undefined && cfg.vMode !== vMode) continue;
                if (cfg.repeat !== undefined && cfg.repeat !== repeat) continue;
                
                return actionName;
            }
        }
        
        return null;
    },
    
    getKeyDisplayName(keyCode) {
        const displayNames = {
            'KeyP': 'P', 'KeyE': 'E', 'KeyV': 'V', 'KeyH': 'H',
            'KeyA': 'A', 'KeyN': 'N', 'KeyC': 'C', 'KeyL': 'L',
            'KeyZ': 'Z', 'KeyY': 'Y', 'KeyQ': 'Q', 'KeyX': 'X',
            'KeyG': 'G',
            'Comma': ',', 'Digit0': '0', 'Plus': '+',
            'ArrowUp': '↑', 'ArrowDown': '↓',
            'ArrowLeft': '←', 'ArrowRight': '→',
            'Space': 'Space', 'Delete': 'Delete', 'Backspace': 'Backspace'
        };
        return displayNames[keyCode] || keyCode;
    },
    
    getShortcutList() {
        const list = [];
        for (const [actionName, config] of Object.entries(this.actions)) {
            const configs = Array.isArray(config) ? config : [config];
            const keys = configs.map(cfg => {
                const parts = [];
                if (cfg.ctrl) parts.push('Ctrl');
                if (cfg.shift) parts.push('Shift');
                if (cfg.alt) parts.push('Alt');
                if (cfg.vMode) parts.push('V +');
                parts.push(this.getKeyDisplayName(cfg.key));
                return parts.join('+');
            });
            list.push({
                action: actionName,
                keys: keys,
                description: configs[0].description
            });
        }
        return list;
    }
};

window.TEGAKI_KEYCONFIG = {
    pen: 'KeyP',
    eraser: 'KeyE',
    fill: 'KeyG',
    layerMode: 'KeyV',
    canvasReset: 'Digit0',
    horizontalFlip: 'KeyH',
    layerUp: 'ArrowUp',
    layerDown: 'ArrowDown',
    gifPrevFrame: 'ArrowLeft',
    gifNextFrame: 'ArrowRight',
    gifToggleAnimation: 'KeyA',
    gifAddCut: 'Plus',
    gifPlayPause: 'Space'
};

window.TEGAKI_COLORS = {
    futabaMaroon: '#800000',
    futabaLightMaroon: '#aa5a56',
    futabaMedium: '#cf9c97',
    futabaLightMedium: '#e9c2ba',
    futabaCream: '#f0e0d6',
    futabaBackground: '#ffffee'
};

window.TEGAKI_UTILS = {
    log: (...args) => {
        if (window.TEGAKI_CONFIG.debug) console.log(...args);
    }
};

console.log('✅ config.js v8.14.0 loaded (Phase 1: DPR=1固定化)');
console.log('   🚨 renderer.resolution = 1 (devicePixelRatio参照を削除)');