/**
 * @file config.js - Phase 7.5.1: Qキー対応版
 * @description グローバル設定・キーマップ定義
 * 
 * 【Phase 7.5.1改修内容】
 * ✅ POPUP_QUICK_ACCESS を Space → KeyQ に変更
 * ✅ Spaceキーを将来のパン移動用に予約
 * ✅ Phase 7.5全機能継承（流量高速補償）
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
     * Phase 7: 描画処理設定（最適化版）
     */
    drawing: {
        /**
         * ポイント補間設定（カエルの卵完全対策）
         * Phase 7: 閾値を2.5pxに引き下げ
         */
        interpolation: {
            enabled: true,           // 補間有効化
            threshold: 2.5,          // 補間閾値（ピクセル）※Phase 7: 5.0→2.5に強化
            maxSteps: 15,            // 最大分割数 ※Phase 7: 10→15に増加
            adaptiveSpeed: true      // 速度適応補間 ※Phase 7: 新規追加
        }
    },
    
    /**
     * Phase 4-7.5: ブラシ設定統合
     */
    brush: {
        /**
         * Phase 5: ツールモード拡張
         * 水彩/エアブラシは内部基盤のみ（UI実装は将来）
         */
        modes: {
            pen: { 
                enabled: true,
                label: 'ペン'
            },
            eraser: { 
                enabled: true,
                label: '消しゴム'
            },
            fill: {
                enabled: true,
                label: '塗りつぶし'
            },
            // Phase 5: 将来実装用（内部基盤のみ）
            airbrush: { 
                enabled: false,
                label: 'エアブラシ'
            },
            watercolor: { 
                enabled: false,
                label: '水彩'
            }
        },
        
        // 筆圧設定
        pressure: {
            enabled: true,
            sensitivity: 1.0,
            minSize: 0.0,
            maxSize: 1.0
        },
        
        // 補正設定
        smoothing: {
            enabled: true,
            strength: 0.45,
            thinning: 0
        },
        
        // 流量（フロー）設定
        flow: {
            enabled: true,
            opacity: 1.0,
            sensitivity: 1.0,
            accumulation: false,
            // Phase 7.5: 高速ストローク補償（竹の節問題対策）
            highSpeedCompensation: true,   // 高速時の透明度補償
            minOpacityGuarantee: 0.9,      // 最低不透明度保証（0.0～1.0）
            speedThreshold: 2.0             // 高速判定閾値（px/ms）
        },
        
        /**
         * Phase 5: エアブラシ設定（将来実装用）
         * パーティクルベースの描画システム
         */
        airbrush: {
            radius: 20,           // スプレー半径
            density: 0.5,         // パーティクル密度（0.0～1.0）
            scatter: 1.0,         // 拡散度（0.0～2.0）
            hardness: 0.5,        // エッジの硬さ（0.0～1.0）
            flowRate: 0.3,        // 流量（0.0～1.0）
            buildUp: true,        // 重ね塗り蓄積
            spacing: 0.1          // スタンプ間隔（0.01～1.0）
        },
        
        /**
         * Phase 5: 水彩設定（将来実装用）
         * 流体シミュレーションベースの描画システム
         */
        watercolor: {
            wetness: 0.8,         // 湿り具合（0.0～1.0）
            bleeding: 0.3,        // にじみ度（0.0～1.0）
            dryTime: 2.0,         // 乾燥時間（秒）
            dilution: 0.5,        // 薄め具合（0.0～1.0）
            blending: 0.7,        // 混色度（0.0～1.0）
            textureStrength: 0.4  // テクスチャ強度（0.0～1.0）
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
    
    debug: false
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
        // Phase 7.5.1: Space → KeyQ に変更（QuickのQ）
        POPUP_QUICK_ACCESS: {
            key: 'KeyQ',
            ctrl: false,
            shift: false,
            description: 'クイックアクセスメニュー'
        },
        // Phase 7.5.1: Spaceキーは将来のパン移動用に予約
        // CAMERA_PAN_MODE: {
        //     key: 'Space',
        //     ctrl: false,
        //     shift: false,
        //     description: 'パン移動モード'
        // },
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
    },
    
    /**
     * Phase 6: キーマップヘルパーメソッド
     */
    getAction(event, options = {}) {
        const { vMode = false } = options;
        
        for (const [actionName, binding] of Object.entries(this.actions)) {
            const bindings = Array.isArray(binding) ? binding : [binding];
            
            for (const b of bindings) {
                if (b.key !== event.code) continue;
                
                const ctrlMatch = (b.ctrl || false) === (event.ctrlKey || event.metaKey || false);
                const shiftMatch = (b.shift || false) === (event.shiftKey || false);
                const altMatch = (b.alt || false) === (event.altKey || false);
                const vModeMatch = (b.vMode === undefined) || (b.vMode === vMode);
                
                if (ctrlMatch && shiftMatch && altMatch && vModeMatch) {
                    return actionName;
                }
            }
        }
        
        return null;
    },
    
    getShortcutList() {
        const list = [];
        for (const [actionName, binding] of Object.entries(this.actions)) {
            const bindings = Array.isArray(binding) ? binding : [binding];
            bindings.forEach(b => {
                list.push({
                    action: actionName,
                    description: b.description || actionName,
                    shortcut: this._formatShortcut(b)
                });
            });
        }
        return list;
    },
    
    _formatShortcut(binding) {
        const parts = [];
        if (binding.ctrl) parts.push('Ctrl');
        if (binding.shift) parts.push('Shift');
        if (binding.alt) parts.push('Alt');
        if (binding.vMode) parts.push('V+');
        parts.push(this._formatKey(binding.key));
        return parts.join('+');
    },
    
    _formatKey(key) {
        const keyMap = {
            'KeyA': 'A', 'KeyB': 'B', 'KeyC': 'C', 'KeyD': 'D',
            'KeyE': 'E', 'KeyF': 'F', 'KeyG': 'G', 'KeyH': 'H',
            'KeyI': 'I', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L',
            'KeyM': 'M', 'KeyN': 'N', 'KeyO': 'O', 'KeyP': 'P',
            'KeyQ': 'Q', 'KeyR': 'R', 'KeyS': 'S', 'KeyT': 'T',
            'KeyU': 'U', 'KeyV': 'V', 'KeyW': 'W', 'KeyX': 'X',
            'KeyY': 'Y', 'KeyZ': 'Z',
            'Digit0': '0', 'Digit1': '1', 'Digit2': '2',
            'ArrowUp': '↑', 'ArrowDown': '↓',
            'ArrowLeft': '←', 'ArrowRight': '→',
            'Space': 'Space', 'Delete': 'Del', 'Backspace': 'BS'
        };
        return keyMap[key] || key;
    }
};

console.log('✅ config.js Phase 7.5.1 loaded (Qキー対応版)');
console.log('   ✅ POPUP_QUICK_ACCESS: Space → KeyQ に変更');
console.log('   ⚙️ Spaceキーは将来のパン移動用に予約');
console.log('   ✅ Phase 7.5全機能継承（流量高速補償）');