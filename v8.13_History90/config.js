// ===== config.js - P/E+ドラッグ機能対応版 =====

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
            enableDevicePixelRatio: true,
            filter: {
                enabled: true,
                minAlpha: 0.3,
                maxAlpha: 0.9,
                shortDistanceThreshold: 5.0,
                longDistanceThreshold: 20.0
            },
            featherCurve: {
                enabled: true,
                ultraLowThreshold: 0.1,
                ultraLowCompression: 0.01,
                midThreshold: 0.3,
                midValue: 0.1,
                highPower: 2.0
            },
            ultraFineStart: {
                threshold: 0.05,
                multiplier: 0.01,
                power: 8
            }
        }
    },
    eraser: {
        size: 20,
        opacity: 1.0
    },
    // 🆕 tools構造（ToolSizeManager用）
    tools: {
        pen: {
            defaultSize: 10,
            defaultOpacity: 0.85
        },
        eraser: {
            defaultSize: 20,
            defaultOpacity: 1.0
        }
    },
    // 🆕 サイズスロット設定（1〜9キーで選択可能）
    sizeSlots: {
        pen: [2, 4, 6, 8, 12, 16, 24, 36, 50],
        eraser: [10, 15, 20, 30, 40, 50, 60, 80, 100]
    },
    // 🆕 ドラッグ調整の感度設定
    dragAdjustment: {
        size: {
            sensitivity: 0.1,
            min: 0.1,
            max: 100
        },
        opacity: {
            sensitivity: 0.005,
            min: 0.0,
            max: 1.0
        },
        // 🆕 視覚フィードバック設定
        visual: {
            textColor: '#ffffff',
            fontSize: 12,
            showValues: true,
            animationDuration: 150
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

window.TEGAKI_KEYMAP = {
    actions: {
        UNDO: {
            key: 'KeyZ',
            ctrl: true,
            shift: false,
            alt: false,
            description: '元に戻す'
        },
        REDO: [
            { key: 'KeyY', ctrl: true, shift: false, alt: false, description: 'やり直し' },
            { key: 'KeyZ', ctrl: true, shift: true, alt: false, description: 'やり直し' }
        ],
        TOOL_PEN: {
            key: 'KeyP',
            ctrl: false,
            shift: false,
            alt: false,
            description: 'ペンツール'
        },
        TOOL_ERASER: {
            key: 'KeyE',
            ctrl: false,
            shift: false,
            alt: false,
            description: '消しゴムツール'
        },
        SETTINGS_OPEN: {
            key: 'Comma',
            ctrl: true,
            shift: false,
            alt: false,
            description: '設定を開く'
        },
        LAYER_CREATE: {
            key: 'KeyL',
            ctrl: true,
            shift: false,
            alt: false,
            description: 'レイヤー追加'
        },
        LAYER_DELETE_DRAWINGS: [
            { 
                key: 'Delete', 
                ctrl: false, 
                shift: false, 
                alt: false, 
                description: 'アクティブレイヤーの絵を削除' 
            },
            { 
                key: 'Backspace', 
                ctrl: false, 
                shift: false, 
                alt: false, 
                description: 'アクティブレイヤーの絵を削除' 
            }
        ],
        LAYER_CLEAR: {
            key: 'Delete',
            ctrl: true,
            shift: false,
            alt: false,
            description: 'レイヤークリア(Ctrl+Del)'
        },
        LAYER_COPY: {
            key: 'KeyC',
            ctrl: true,
            shift: false,
            alt: false,
            description: 'レイヤーコピー'
        },
        LAYER_PASTE: {
            key: 'KeyV',
            ctrl: true,
            shift: false,
            alt: false,
            description: 'レイヤーペースト'
        },
        LAYER_MOVE_MODE_TOGGLE: {
            key: 'KeyV',
            ctrl: false,
            shift: false,
            alt: false,
            repeat: false,
            description: 'レイヤー移動モード切替'
        },
        LAYER_HIERARCHY_UP: {
            key: 'ArrowUp',
            ctrl: false,
            shift: false,
            alt: false,
            vMode: false,
            description: 'レイヤー階層を上へ'
        },
        LAYER_HIERARCHY_DOWN: {
            key: 'ArrowDown',
            ctrl: false,
            shift: false,
            alt: false,
            vMode: false,
            description: 'レイヤー階層を下へ'
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
        GIF_PREV_FRAME: {
            key: 'ArrowLeft',
            ctrl: false,
            shift: false,
            alt: false,
            vMode: false,
            description: '前のフレーム'
        },
        GIF_NEXT_FRAME: {
            key: 'ArrowRight',
            ctrl: false,
            shift: false,
            alt: false,
            vMode: false,
            description: '次のフレーム'
        },
        GIF_PLAY_PAUSE: {
            key: 'Space',
            ctrl: true,
            shift: false,
            alt: false,
            description: '再生/停止'
        },
        GIF_TOGGLE_TIMELINE: {
            key: 'KeyA',
            ctrl: false,
            shift: true,
            alt: false,
            description: 'タイムライン表示切替'
        },
        GIF_CREATE_CUT: {
            key: 'KeyN',
            ctrl: false,
            shift: true,
            alt: false,
            description: '新規CUT作成'
        },
        GIF_COPY_CUT: {
            key: 'KeyC',
            ctrl: false,
            shift: true,
            alt: false,
            description: 'CUTコピー&ペースト'
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
    
    debugShowMapping() {
        const mappings = [];
        
        for (const [actionName, config] of Object.entries(this.actions)) {
            const configs = Array.isArray(config) ? config : [config];
            
            configs.forEach(cfg => {
                const modifiers = [];
                if (cfg.ctrl) modifiers.push('Ctrl');
                if (cfg.shift) modifiers.push('Shift');
                if (cfg.alt) modifiers.push('Alt');
                if (cfg.vMode) modifiers.push('V');
                
                mappings.push({
                    Action: actionName,
                    Key: this.getKeyDisplayName(cfg.key),
                    Modifiers: modifiers.join('+') || 'none',
                    Description: cfg.description || ''
                });
            });
        }
    },
    
    getKeyDisplayName(keyCode) {
        const displayNames = {
            'KeyP': 'P', 'KeyE': 'E', 'KeyV': 'V', 'KeyH': 'H', 'KeyA': 'A', 'KeyN': 'N', 'KeyC': 'C', 'KeyL': 'L', 'KeyZ': 'Z', 'KeyY': 'Y',
            'Comma': ',', 'Digit0': '0', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9',
            'Plus': '+', 'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
            'Space': 'Space', 'Delete': 'Delete', 'Backspace': 'Backspace'
        };
        return displayNames[keyCode] || keyCode;
    },
    
    getActionDescription(actionName) {
        const config = this.actions[actionName];
        if (!config) return null;
        const cfg = Array.isArray(config) ? config[0] : config;
        return cfg.description || actionName;
    },
    
    getUIConfigData() {
        const categories = {
            'History操作': ['UNDO', 'REDO'],
            'ツール': ['TOOL_PEN', 'TOOL_ERASER'],
            '設定': ['SETTINGS_OPEN'],
            'レイヤー基本': ['LAYER_CREATE', 'LAYER_DELETE_DRAWINGS', 'LAYER_CLEAR', 'LAYER_COPY', 'LAYER_PASTE'],
            'レイヤー階層': ['LAYER_HIERARCHY_UP', 'LAYER_HIERARCHY_DOWN'],
            'レイヤー移動モード': ['LAYER_MOVE_MODE_TOGGLE'],
            'レイヤー移動': ['LAYER_MOVE_UP', 'LAYER_MOVE_DOWN', 'LAYER_MOVE_LEFT', 'LAYER_MOVE_RIGHT'],
            'レイヤー変形': ['LAYER_SCALE_UP', 'LAYER_SCALE_DOWN', 'LAYER_ROTATE_LEFT', 'LAYER_ROTATE_RIGHT'],
            'カメラ反転': ['CAMERA_FLIP_HORIZONTAL', 'CAMERA_FLIP_VERTICAL'],
            'レイヤー反転': ['LAYER_FLIP_HORIZONTAL', 'LAYER_FLIP_VERTICAL'],
            'GIF/アニメーション': ['GIF_PREV_FRAME', 'GIF_NEXT_FRAME', 'GIF_PLAY_PAUSE', 'GIF_TOGGLE_TIMELINE', 'GIF_CREATE_CUT', 'GIF_COPY_CUT']
        };
        
        return Object.entries(categories).map(([category, actions]) => ({
            category,
            actions: actions.map(action => {
                const config = this.actions[action];
                const cfg = Array.isArray(config) ? config[0] : config;
                
                return {
                    action,
                    description: cfg.description,
                    key: this.getKeyDisplayName(cfg.key),
                    modifiers: [
                        cfg.ctrl && 'Ctrl',
                        cfg.shift && 'Shift',
                        cfg.alt && 'Alt',
                        cfg.vMode && 'V'
                    ].filter(Boolean)
                };
            })
        }));
    }
};

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
    gifPlayPause: 'Space',
    layerMoveUp: 'ArrowUp',
    layerMoveDown: 'ArrowDown',
    layerMoveLeft: 'ArrowLeft',
    layerMoveRight: 'ArrowRight',
    layerScaleUp: 'ArrowUp',
    layerScaleDown: 'ArrowDown',
    layerRotateLeft: 'ArrowLeft',
    layerRotateRight: 'ArrowRight'
};

window.TEGAKI_KEYCONFIG_MANAGER = {
    getActionForKey(keyCode, modifiers = {}) {
        const event = {
            code: keyCode,
            ctrlKey: modifiers.ctrlPressed || false,
            metaKey: false,
            shiftKey: modifiers.shiftPressed || false,
            altKey: modifiers.altPressed || false,
            repeat: false
        };
        
        const context = {
            vMode: modifiers.vPressed || false
        };
        
        const action = window.TEGAKI_KEYMAP.getAction(event, context);
        
        const legacyMap = {
            'TOOL_PEN': 'pen',
            'TOOL_ERASER': 'eraser',
            'LAYER_MOVE_MODE_TOGGLE': 'layerMode',
            'LAYER_HIERARCHY_UP': 'layerUp',
            'LAYER_HIERARCHY_DOWN': 'layerDown',
            'GIF_PREV_FRAME': 'gifPrevFrame',
            'GIF_NEXT_FRAME': 'gifNextFrame',
            'LAYER_MOVE_UP': 'layerMoveUp',
            'LAYER_MOVE_DOWN': 'layerMoveDown',
            'LAYER_MOVE_LEFT': 'layerMoveLeft',
            'LAYER_MOVE_RIGHT': 'layerMoveRight',
            'LAYER_SCALE_UP': 'layerScaleUp',
            'LAYER_SCALE_DOWN': 'layerScaleDown',
            'LAYER_ROTATE_LEFT': 'layerRotateLeft',
            'LAYER_ROTATE_RIGHT': 'layerRotateRight',
            'CAMERA_FLIP_HORIZONTAL': 'horizontalFlip',
            'LAYER_FLIP_HORIZONTAL': 'horizontalFlip'
        };
        
        return legacyMap[action] || action;
    }
};

window.TEGAKI_SHORTCUTS = {
    pen: 'KeyP',
    eraser: 'KeyE',
    layerMode: 'KeyV',
    canvasReset: 'Digit0',
    horizontalFlip: 'KeyH'
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

console.log('✅ config.js (P/E+ドラッグ機能対応版) loaded');
console.log('   🆕 tools: ペン/消しゴムのデフォルト設定追加');
console.log('   🆕 sizeSlots: サイズスロット設定追加');
console.log('   🆕 dragAdjustment: ドラッグ調整感度設定追加');
console.log('   🆕 dragAdjustment.visual: 視覚フィードバック設定追加');