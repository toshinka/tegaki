// ===== config.js - キーマッピング完全一元管理版 + Phase 1対応 =====
// 🎯 改修内容: すべてのショートカットをアクション中心の設計に統一
// 🔥 Phase 1: Pointer Events API & Simplify.js 設定追加

window.TEGAKI_CONFIG = {
    canvas: { 
        width: 344, 
        height: 135 
    },
    pen: { 
        size: 15, 
        opacity: 0.85, 
        color: 0x800000,
        // 🔥 Phase 1: Pointer Events API設定
        useTiltForSize: true,      // ペンの傾きでサイズ調整（Apple Pencil等）
        useTiltForOpacity: true,   // ペンの傾きで不透明度調整
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
    // 🔥 Phase 1: Simplify.js設定
    simplify: {
        tolerance: 1.0,         // 0.5-2.0推奨（低いほど精密、高いほど圧縮）
        highQuality: true       // Ramer-Douglas-Peuckerアルゴリズム使用
    },
    debug: false
};

// =============================================================================
// 🎯 キーマッピング完全一元管理システム
// =============================================================================

window.TEGAKI_KEYMAP = {
    // アクション定義（単一責任の原則）
    actions: {
        // === History操作 ===
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
        
        // === ツール切り替え ===
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
        
        // === レイヤー操作 ===
        LAYER_CREATE: {
            key: 'KeyL',
            ctrl: true,
            shift: false,
            alt: false,
            description: 'レイヤー追加'
        },
        LAYER_CLEAR: {
            key: 'Delete',
            ctrl: false,
            shift: false,
            alt: false,
            description: 'レイヤークリア'
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
        
        // === レイヤー移動モード ===
        LAYER_MOVE_MODE_TOGGLE: {
            key: 'KeyV',
            ctrl: false,
            shift: false,
            alt: false,
            repeat: false,
            description: 'レイヤー移動モード切替'
        },
        
        // === レイヤー階層移動（素の方向キー） ===
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
        
        // === レイヤー移動（Vモード時の方向キー） ===
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
        
        // === レイヤー変形（Vモード + Shift） ===
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
        
        // === カメラ反転（通常時：V非押下） ===
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
        
        // === レイヤー反転（Vモード時） ===
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
        
        // === GIF/アニメーション操作 ===
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
    
    // =============================================================================
    // 🎯 キー解決エンジン（コンテキスト対応）
    // =============================================================================
    
    getAction(event, context = {}) {
        const { vMode = false } = context;
        const { code, ctrlKey, metaKey, shiftKey, altKey, repeat } = event;
        
        // macOS対応（Cmd = Ctrl扱い）
        const ctrl = ctrlKey || metaKey;
        
        // すべてのアクションを検索
        for (const [actionName, config] of Object.entries(this.actions)) {
            // 複数キーバインド対応（REDO等）
            const configs = Array.isArray(config) ? config : [config];
            
            for (const cfg of configs) {
                // キーコード一致チェック
                if (cfg.key !== code) continue;
                
                // 修飾キーチェック
                if (cfg.ctrl !== undefined && cfg.ctrl !== ctrl) continue;
                if (cfg.shift !== undefined && cfg.shift !== shiftKey) continue;
                if (cfg.alt !== undefined && cfg.alt !== altKey) continue;
                
                // Vモードチェック
                if (cfg.vMode !== undefined && cfg.vMode !== vMode) continue;
                
                // リピートチェック
                if (cfg.repeat !== undefined && cfg.repeat !== repeat) continue;
                
                // すべての条件が一致
                return actionName;
            }
        }
        
        return null;
    },
    
    // =============================================================================
    // 🎯 デバッグ・UI支援機能
    // =============================================================================
    
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
        
        console.table(mappings);
    },
    
    getKeyDisplayName(keyCode) {
        const displayNames = {
            'KeyP': 'P',
            'KeyE': 'E',
            'KeyV': 'V',
            'KeyH': 'H',
            'KeyA': 'A',
            'KeyN': 'N',
            'KeyC': 'C',
            'KeyL': 'L',
            'KeyZ': 'Z',
            'KeyY': 'Y',
            'Digit0': '0',
            'Plus': '+',
            'ArrowUp': '↑',
            'ArrowDown': '↓',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'Space': 'Space',
            'Delete': 'Delete'
        };
        
        return displayNames[keyCode] || keyCode;
    },
    
    getActionDescription(actionName) {
        const config = this.actions[actionName];
        if (!config) return null;
        
        const cfg = Array.isArray(config) ? config[0] : config;
        return cfg.description || actionName;
    },
    
    // 将来のUI設定画面用データ取得
    getUIConfigData() {
        const categories = {
            'History操作': ['UNDO', 'REDO'],
            'ツール': ['TOOL_PEN', 'TOOL_ERASER'],
            'レイヤー基本': ['LAYER_CREATE', 'LAYER_CLEAR', 'LAYER_COPY', 'LAYER_PASTE'],
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

// =============================================================================
// 🎯 レガシー互換性維持（段階的移行用）
// =============================================================================

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

// レガシーマネージャー（後方互換性）
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
        
        // レガシー形式に変換
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

// =============================================================================
// 🎯 初期化ログ
// =============================================================================

console.log('✅ config.js (Phase 1対応完全版) loaded');
console.log('   🎯 アクション中心設計: すべてのショートカットをTEGAKI_KEYMAPで管理');
console.log('   🔥 Phase 1対応: Pointer Events API & Simplify.js設定追加');
console.log('   🔥 useTiltForSize: ペンの傾きでサイズ調整（デフォルト: true）');
console.log('   🔥 useTiltForOpacity: ペンの傾きで不透明度調整（デフォルト: true）');
console.log('   🔥 Simplify tolerance: ' + window.TEGAKI_CONFIG.simplify.tolerance + ' (0.5-2.0推奨)');
console.log('   🎯 コンテキスト対応: vMode, Ctrl, Shift, Alt を柔軟に処理');
console.log('   🎯 デバッグ支援: window.TEGAKI_KEYMAP.debugShowMapping() でマッピング一覧表示');