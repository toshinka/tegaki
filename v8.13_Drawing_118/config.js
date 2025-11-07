// ===== config.js - 統合キーマップ完全版 (DRY/SOLID準拠) =====

window.TEGAKI_CONFIG = {
    canvas: { 
        width: 344, 
        height: 135 
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
        size: 3,
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
        maxScale: 3.0,
        minRotation: -180,
        maxRotation: 180
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

// ✅ 統一キーマップシステム (すべてのショートカットを一元管理)
window.TEGAKI_KEYMAP = {
    actions: {
        // === 基本操作 ===
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
        
        // === ツール切り替え ===
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
        
        // === レイヤー操作 ===
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
        LAYER_CLEAR: {
            key: 'Delete',
            ctrl: true,
            shift: false,
            description: 'レイヤークリア'
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
        
        // === レイヤー移動モード (V押下時) ===
        LAYER_MOVE_MODE_TOGGLE: {
            key: 'KeyV',
            ctrl: false,
            shift: false,
            repeat: false,
            description: 'レイヤー移動モード切替'
        },
        LAYER_MOVE_UP: {
            key: 'ArrowUp',
            vMode: true,
            shift: false,
            description: 'レイヤーを上に移動'
        },
        LAYER_MOVE_DOWN: {
            key: 'ArrowDown',
            vMode: true,
            shift: false,
            description: 'レイヤーを下に移動'
        },
        LAYER_MOVE_LEFT: {
            key: 'ArrowLeft',
            vMode: true,
            shift: false,
            description: 'レイヤーを左に移動'
        },
        LAYER_MOVE_RIGHT: {
            key: 'ArrowRight',
            vMode: true,
            shift: false,
            description: 'レイヤーを右に移動'
        },
        LAYER_SCALE_UP: {
            key: 'ArrowUp',
            vMode: true,
            shift: true,
            description: 'レイヤー拡大'
        },
        LAYER_SCALE_DOWN: {
            key: 'ArrowDown',
            vMode: true,
            shift: true,
            description: 'レイヤー縮小'
        },
        LAYER_ROTATE_LEFT: {
            key: 'ArrowLeft',
            vMode: true,
            shift: true,
            description: 'レイヤー左回転'
        },
        LAYER_ROTATE_RIGHT: {
            key: 'ArrowRight',
            vMode: true,
            shift: true,
            description: 'レイヤー右回転'
        },
        LAYER_FLIP_HORIZONTAL: {
            key: 'KeyH',
            vMode: true,
            shift: false,
            description: 'レイヤー水平反転'
        },
        LAYER_FLIP_VERTICAL: {
            key: 'KeyH',
            vMode: true,
            shift: true,
            description: 'レイヤー垂直反転'
        },
        
        // === レイヤー階層操作 (通常モード) ===
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
        
        // === カメラ操作 ===
        CAMERA_FLIP_HORIZONTAL: {
            key: 'KeyH',
            vMode: false,
            shift: false,
            ctrl: false,
            description: 'キャンバス水平反転'
        },
        CAMERA_FLIP_VERTICAL: {
            key: 'KeyH',
            vMode: false,
            shift: true,
            ctrl: false,
            description: 'キャンバス垂直反転'
        },
        CAMERA_RESET: {
            key: 'Digit0',
            ctrl: true,
            shift: false,
            description: 'カメラリセット'
        },
        
        // === アニメーション操作 ===
        GIF_PREV_FRAME: {
            key: 'ArrowLeft',
            ctrl: true,
            shift: false,
            vMode: false,
            description: '前のフレーム'
        },
        GIF_NEXT_FRAME: {
            key: 'ArrowRight',
            ctrl: true,
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
        
        // === UI操作 ===
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
    
    /**
     * イベントからアクション名を取得
     * @param {KeyboardEvent} event 
     * @param {Object} context - { vMode: boolean }
     * @returns {string|null} アクション名
     */
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
    
    /**
     * キーコードの表示名を取得
     */
    getKeyDisplayName(keyCode) {
        const displayNames = {
            'KeyP': 'P', 'KeyE': 'E', 'KeyV': 'V', 'KeyH': 'H',
            'KeyA': 'A', 'KeyN': 'N', 'KeyC': 'C', 'KeyL': 'L',
            'KeyZ': 'Z', 'KeyY': 'Y', 'KeyQ': 'Q', 'Comma': ',',
            'Digit0': '0', 'Plus': '+',
            'ArrowUp': '↑', 'ArrowDown': '↓',
            'ArrowLeft': '←', 'ArrowRight': '→',
            'Space': 'Space', 'Delete': 'Delete', 'Backspace': 'Backspace'
        };
        return displayNames[keyCode] || keyCode;
    },
    
    /**
     * アクションの説明とキーバインドを取得
     */
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

// === レガシー互換性維持 (将来削除予定) ===
window.TEGAKI_KEYCONFIG = {
    pen: 'KeyP',
    eraser: 'KeyE',
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

console.log('✅ config.js (統合キーマップ完全版 - DRY/SOLID準拠) loaded');