/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 定数定義システム - js/core/constants.js
 * Phase1.1 STEP1: SOLID原則準拠定数管理
 */

console.log('📐 定数定義システム読み込み開始...');

// ==== 名前空間確保 ====
window.FutabaDrawingTool = window.FutabaDrawingTool || {};
window.FutabaDrawingTool.Constants = {};

// ==== ツール種別定数 ====
window.FutabaDrawingTool.Constants.TOOLS = Object.freeze({
    PEN: 'pen',
    ERASER: 'eraser',
    FILL: 'fill', // Phase1.3対応予定
    SELECT: 'select', // Phase1.3対応予定
    PALETTE: 'palette', // Phase2対応予定
    DOWNLOAD: 'download', // Phase1.2対応予定
    RESIZE: 'resize',
    SETTINGS: 'settings' // Phase2対応予定
});

// ==== UI要素ID定数 ====
window.FutabaDrawingTool.Constants.UI_IDS = Object.freeze({
    // ツールボタン
    TOOLS: {
        PEN: 'pen-tool',
        ERASER: 'eraser-tool',
        FILL: 'fill-tool',
        SELECT: 'select-tool',
        PALETTE: 'palette-tool',
        DOWNLOAD: 'download-tool',
        RESIZE: 'resize-tool',
        SETTINGS: 'settings-tool'
    },
    
    // ポップアップ
    POPUPS: {
        PEN_SETTINGS: 'pen-settings',
        RESIZE_SETTINGS: 'resize-settings'
    },
    
    // スライダー
    SLIDERS: {
        PEN_SIZE: 'pen-size-slider',
        PEN_OPACITY: 'pen-opacity-slider',
        PEN_PRESSURE: 'pen-pressure-slider',
        PEN_SMOOTHING: 'pen-smoothing-slider'
    },
    
    // ステータス
    STATUS: {
        CANVAS_INFO: 'canvas-info',
        CURRENT_TOOL: 'current-tool',
        CURRENT_COLOR: 'current-color',
        COORDINATES: 'coordinates',
        PRESSURE_MONITOR: 'pressure-monitor',
        FPS: 'fps',
        GPU_USAGE: 'gpu-usage',
        MEMORY_USAGE: 'memory-usage'
    },
    
    // キャンバス
    CANVAS: {
        DRAWING_CANVAS: 'drawing-canvas',
        CANVAS_WIDTH: 'canvas-width',
        CANVAS_HEIGHT: 'canvas-height'
    }
});

// ==== アイコン名定数（@tabler/icons-react対応） ====
window.FutabaDrawingTool.Constants.ICONS = Object.freeze({
    // ツールアイコン
    PEN: 'brush', // IconBrush
    ERASER: 'eraser', // IconEraser
    FILL: 'bucket', // IconBucket
    SELECT: 'select', // IconSelect
    PALETTE: 'palette', // IconPalette
    DOWNLOAD: 'download', // IconDownload
    RESIZE: 'resize', // IconResize
    SETTINGS: 'settings', // IconSettings
    
    // UI要素アイコン
    CLOSE: 'x', // IconX
    MINIMIZE: 'minus', // IconMinus
    MAXIMIZE: 'maximize', // IconMaximize
    DRAG: 'grip-vertical', // IconGripVertical
    
    // 状態アイコン
    CHECKED: 'check', // IconCheck
    UNCHECKED: 'square', // IconSquare
    
    // 操作アイコン
    PLUS: 'plus', // IconPlus
    MINUS: 'minus', // IconMinus
    REFRESH: 'refresh', // IconRefresh
    UNDO: 'arrow-back-up', // IconArrowBackUp
    REDO: 'arrow-forward-up' // IconArrowForwardUp
});

// ==== CSS クラス名定数 ====
window.FutabaDrawingTool.Constants.CSS_CLASSES = Object.freeze({
    // 状態クラス
    ACTIVE: 'active',
    DISABLED: 'disabled',
    CHECKED: 'checked',
    DRAGGING: 'dragging',
    SHOW: 'show',
    HIDDEN: 'hidden',
    
    // コンポーネントクラス
    TOOL_BUTTON: 'tool-button',
    POPUP_PANEL: 'popup-panel',
    SLIDER_CONTAINER: 'slider-container',
    SETTING_GROUP: 'setting-group',
    SIZE_PRESET_ITEM: 'size-preset-item',
    
    // レイアウトクラス
    MAIN_LAYOUT: 'main-layout',
    SIDEBAR: 'sidebar',
    CANVAS_AREA: 'canvas-area',
    STATUS_PANEL: 'status-panel'
});

// ==== イベント名定数 ====
window.FutabaDrawingTool.Constants.EVENTS = Object.freeze({
    // マウス・ポインターイベント
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove',
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside',
    
    // カスタムイベント
    TOOL_CHANGED: 'tool-changed',
    SIZE_CHANGED: 'size-changed',
    OPACITY_CHANGED: 'opacity-changed',
    CANVAS_RESIZED: 'canvas-resized',
    DRAWING_STARTED: 'drawing-started',
    DRAWING_ENDED: 'drawing-ended',
    
    // システムイベント
    CONFIG_UPDATED: 'config-updated',
    PERFORMANCE_UPDATE: 'performance-update'
});

// ==== 数値定数 ====
window.FutabaDrawingTool.Constants.VALUES = Object.freeze({
    // 描画設定
    MIN_BRUSH_SIZE: 0.1,
    MAX_BRUSH_SIZE: 100.0,
    DEFAULT_BRUSH_SIZE: 16.0,
    
    MIN_OPACITY: 0.0,
    MAX_OPACITY: 1.0,
    DEFAULT_OPACITY: 0.85,
    
    MIN_PRESSURE: 0.0,
    MAX_PRESSURE: 1.0,
    DEFAULT_PRESSURE: 0.5,
    
    MIN_SMOOTHING: 0.0,
    MAX_SMOOTHING: 1.0,
    DEFAULT_SMOOTHING: 0.3,
    
    // キャンバス設定
    MIN_CANVAS_SIZE: 100,
    MAX_CANVAS_SIZE: 4096,
    DEFAULT_CANVAS_WIDTH: 400,
    DEFAULT_CANVAS_HEIGHT: 400,
    
    // パフォーマンス設定
    TARGET_FPS: 60,
    MIN_DRAW_DISTANCE: 1.5,
    MAX_PATH_POINTS: 1000,
    
    // UI設定
    ANIMATION_DURATION: 300, // ms
    SLIDER_HANDLE_SIZE: 16,
    SLIDER_TRACK_HEIGHT: 6,
    
    // Z-Index 管理
    Z_INDEX: {
        CANVAS: 1,
        UI: 50,
        POPUP: 2000,
        MODAL: 3000,
        TOOLTIP: 4000
    }
});

// ==== 色定数（16進数表記） ====
window.FutabaDrawingTool.Constants.COLORS = Object.freeze({
    // ふたば風カラーパレット
    FUTABA: {
        MAROON: 0x800000,
        LIGHT_MAROON: 0xaa5a56,
        MEDIUM: 0xcf9c97,
        LIGHT_MEDIUM: 0xe9c2ba,
        CREAM: 0xf0e0d6,
        BACKGROUND: 0xffffee
    },
    
    // テキストカラー
    TEXT: {
        PRIMARY: 0x2c1810,
        SECONDARY: 0x5d4037,
        INVERSE: 0xffffff
    },
    
    // システムカラー
    SYSTEM: {
        SUCCESS: 0x4caf50,
        WARNING: 0xff9800,
        ERROR: 0xf44336,
        INFO: 0x2196f3
    }
});

// ==== エラーメッセージ定数 ====
window.FutabaDrawingTool.Constants.MESSAGES = Object.freeze({
    ERROR: {
        CANVAS_INIT_FAILED: 'キャンバスの初期化に失敗しました',
        PIXI_NOT_FOUND: 'PixiJS ライブラリが見つかりません',
        INVALID_TOOL: '無効なツールが指定されました',
        INVALID_SIZE: 'サイズ値が範囲外です',
        POPUP_NOT_FOUND: 'ポップアップが見つかりません',
        SLIDER_INIT_FAILED: 'スライダーの初期化に失敗しました'
    },
    
    WARNING: {
        FEATURE_NOT_AVAILABLE: '機能が利用できません（Phase対応予定）',
        PERFORMANCE_LOW: 'パフォーマンスが低下しています',
        MEMORY_HIGH: 'メモリ使用量が高くなっています',
        BROWSER_NOT_SUPPORTED: 'お使いのブラウザは一部機能をサポートしていない可能性があります'
    },
    
    INFO: {
        TOOL_CHANGED: 'ツールを切り替えました',
        CANVAS_RESIZED: 'キャンバスサイズを変更しました',
        SETTINGS_SAVED: '設定を保存しました',
        DRAWING_COMPLETE: '描画が完了しました'
    }
});

// ==== Phase対応定数 ====
window.FutabaDrawingTool.Constants.PHASES = Object.freeze({
    CURRENT: '1.1',
    
    FEATURES: {
        '1.1': ['basic-drawing', 'ui-system', 'fetch-api', 'icon-system'],
        '1.2': ['advanced-drawing', 'layer-system', 'export-system'],
        '1.3': ['popup-enhancement', 'tool-expansion', 'user-preferences'],
        '2.0': ['pixi-libraries', 'gif-export', 'advanced-ui', 'plugin-system']
    },
    
    COMPATIBILITY: {
        PIXI_V7: '1.1',
        PIXI_V8: '2.0', // 将来対応
        MODERN_BROWSERS: '1.1',
        MOBILE_SUPPORT: '1.3' // Phase1.3でモバイル対応強化予定
    }
});

// ==== デバッグ用定数 ====
window.FutabaDrawingTool.Constants.DEBUG = Object.freeze({
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    
    PERFORMANCE_METRICS: {
        FPS: 'fps',
        MEMORY: 'memory',
        CANVAS_SIZE: 'canvasSize',
        ACTIVE_PATHS: 'activePaths',
        GPU_USAGE: 'gpuUsage'
    }
});

// ==== バリデーション用正規表現 ====
window.FutabaDrawingTool.Constants.REGEX = Object.freeze({
    HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    POSITIVE_NUMBER: /^\d+\.?\d*$/,
    CANVAS_SIZE: /^[1-9]\d*$/,
    VERSION: /^\d+\.\d+\.\d+$/
});

// ==== ローカライゼーション対応定数 ====
window.FutabaDrawingTool.Constants.LOCALIZATION = Object.freeze({
    DEFAULT_LANGUAGE: 'ja',
    
    TOOL_NAMES: {
        ja: {
            [window.FutabaDrawingTool.Constants.TOOLS.PEN]: 'ベクターペン',
            [window.FutabaDrawingTool.Constants.TOOLS.ERASER]: '消しゴム',
            [window.FutabaDrawingTool.Constants.TOOLS.FILL]: '塗りつぶし',
            [window.FutabaDrawingTool.Constants.TOOLS.SELECT]: '範囲選択',
            [window.FutabaDrawingTool.Constants.TOOLS.PALETTE]: 'カラーパレット',
            [window.FutabaDrawingTool.Constants.TOOLS.DOWNLOAD]: 'ダウンロード',
            [window.FutabaDrawingTool.Constants.TOOLS.RESIZE]: 'リサイズ',
            [window.FutabaDrawingTool.Constants.TOOLS.SETTINGS]: '設定'
        },
        
        en: {
            [window.FutabaDrawingTool.Constants.TOOLS.PEN]: 'Vector Pen',
            [window.FutabaDrawingTool.Constants.TOOLS.ERASER]: 'Eraser',
            [window.FutabaDrawingTool.Constants.TOOLS.FILL]: 'Fill',
            [window.FutabaDrawingTool.Constants.TOOLS.SELECT]: 'Select',
            [window.FutabaDrawingTool.Constants.TOOLS.PALETTE]: 'Palette',
            [window.FutabaDrawingTool.Constants.TOOLS.DOWNLOAD]: 'Download',
            [window.FutabaDrawingTool.Constants.TOOLS.RESIZE]: 'Resize',
            [window.FutabaDrawingTool.Constants.TOOLS.SETTINGS]: 'Settings'
        }
    }
});

// ==== Phase2準備: PixiJS拡張ライブラリ定数 ====
window.FutabaDrawingTool.Constants.PIXI_EXTENSIONS = Object.freeze({
    UI: '@pixi/ui',
    LAYERS: '@pixi/layers',
    GIF: '@pixi/gif',
    GRAPHICS_SMOOTH: '@pixi/graphics-smooth',
    GRAPHICS_EXTRAS: '@pixi/graphics-extras',
    
    // CDN検出用グローバル変数名
    GLOBALS: {
        UI: ['__PIXI_UI__', 'PIXI_UI', 'PIXI.UI'],
        LAYERS: ['__PIXI_LAYERS__', 'PIXI_LAYERS', 'PIXI.display'],
        GIF: ['__PIXI_GIF__', 'PIXI_GIF', 'PIXI.AnimatedGIF'],
        SMOOTH: ['__PIXI_GRAPHICS_SMOOTH__', 'PIXI_SMOOTH', 'PIXI.smooth'],
        EXTRAS: ['__PIXI_GRAPHICS_EXTRAS__', 'PIXI_EXTRAS']
    }
});

// ==== ファイルパス定数（fetch API分割対応） ====
window.FutabaDrawingTool.Constants.PATHS = Object.freeze({
    // スタイルシート
    STYLES: {
        MAIN: './styles/main.css',
        THEMES: './styles/themes/', // Phase2対応予定
        RESPONSIVE: './styles/responsive.css' // Phase1.3対応予定
    },
    
    // JavaScript ファイル
    SCRIPTS: {
        // Phase1.1
        CORE: {
            CONFIG: './js/core/config.js',
            CONSTANTS: './js/core/constants.js',
            ERROR_HANDLER: './js/core/error-handler.js' // Phase1.2対応予定
        },
        
        // Phase1.2対応予定
        TOOLS: {
            DRAWING_ENGINE: './js/tools/drawing-engine.js',
            PEN_TOOL: './js/tools/pen-tool.js',
            ERASER_TOOL: './js/tools/eraser-tool.js'
        },
        
        // Phase1.3対応予定
        UI: {
            POPUP_SYSTEM: './js/ui/popup-system.js',
            SLIDER_SYSTEM: './js/ui/slider-system.js',
            STATUS_PANEL: './js/ui/status-panel.js'
        },
        
        // 共通ユーティリティ
        UTILS: {
            ICON_MANAGER: './js/utils/icon-manager.js',
            PERFORMANCE_MONITOR: './js/utils/performance-monitor.js', // Phase1.2対応予定
            DOM_HELPERS: './js/utils/dom-helpers.js' // Phase1.2対応予定
        },
        
        // メインファイル
        MAIN: './js/main.js'
    },
    
    // アセット
    ASSETS: {
        ICONS: './assets/icons/', // SVGアイコン用（将来対応）
        THEMES: './assets/themes/', // テーマファイル用（Phase2対応予定）
        FONTS: './assets/fonts/' // フォント用（Phase2対応予定）
    }
});

// ==== ヘルパー関数: 定数取得 ====

/**
 * ツール名の多言語対応取得
 * @param {string} toolType - ツール種別
 * @param {string} language - 言語コード（デフォルト: 'ja'）
 * @returns {string} ローカライズされたツール名
 */
window.FutabaDrawingTool.Constants.getToolName = function(toolType, language = 'ja') {
    const names = this.LOCALIZATION.TOOL_NAMES[language];
    return names?.[toolType] || toolType;
};

/**
 * 色定数をCSS形式で取得
 * @param {number} colorValue - 色の数値
 * @returns {string} CSS形式の色文字列
 */
window.FutabaDrawingTool.Constants.getColorCSS = function(colorValue) {
    return `#${colorValue.toString(16).padStart(6, '0')}`;
};

/**
 * Phase機能の利用可能性チェック
 * @param {string} feature - 機能名
 * @param {string} phase - Phase番号（デフォルト: 現在Phase）
 * @returns {boolean} 利用可能フラグ
 */
window.FutabaDrawingTool.Constants.isFeatureAvailable = function(feature, phase = this.PHASES.CURRENT) {
    const phaseFeatures = this.PHASES.FEATURES[phase] || [];
    return phaseFeatures.includes(feature);
};

/**
 * バリデーション実行
 * @param {string} type - バリデーション種別
 * @param {*} value - 検証値
 * @returns {boolean} バリデーション結果
 */
window.FutabaDrawingTool.Constants.validate = function(type, value) {
    switch (type) {
        case 'hexColor':
            return this.REGEX.HEX_COLOR.test(value);
        case 'positiveNumber':
            return this.REGEX.POSITIVE_NUMBER.test(value);
        case 'canvasSize':
            return this.REGEX.CANVAS_SIZE.test(value) && 
                   value >= this.VALUES.MIN_CANVAS_SIZE && 
                   value <= this.VALUES.MAX_CANVAS_SIZE;
        case 'brushSize':
            return typeof value === 'number' && 
                   value >= this.VALUES.MIN_BRUSH_SIZE && 
                   value <= this.VALUES.MAX_BRUSH_SIZE;
        case 'opacity':
            return typeof value === 'number' && 
                   value >= this.VALUES.MIN_OPACITY && 
                   value <= this.VALUES.MAX_OPACITY;
        default:
            return false;
    }
};

/**
 * エラーメッセージ取得
 * @param {string} category - カテゴリ（ERROR, WARNING, INFO）
 * @param {string} key - メッセージキー
 * @returns {string} エラーメッセージ
 */
window.FutabaDrawingTool.Constants.getMessage = function(category, key) {
    return this.MESSAGES[category]?.[key] || `未知のメッセージ: ${category}.${key}`;
};

/**
 * デバッグ用: 全定数の統計取得
 * @returns {Object} 統計情報
 */
window.FutabaDrawingTool.Constants.getStats = function() {
    const countKeys = (obj) => {
        let count = 0;
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                count += countKeys(obj[key]);
            } else {
                count++;
            }
        }
        return count;
    };
    
    return {
        totalConstants: countKeys(this),
        categories: {
            tools: Object.keys(this.TOOLS).length,
            uiIds: countKeys(this.UI_IDS),
            icons: Object.keys(this.ICONS).length,
            cssClasses: Object.keys(this.CSS_CLASSES).length,
            events: Object.keys(this.EVENTS).length,
            values: countKeys(this.VALUES),
            colors: countKeys(this.COLORS),
            messages: countKeys(this.MESSAGES),
            paths: countKeys(this.PATHS)
        },
        phase: this.PHASES.CURRENT,
        featuresCount: this.PHASES.FEATURES[this.PHASES.CURRENT]?.length || 0
    };
};

// ==== 初期化ログ ====
console.log('✅ 定数定義システム初期化完了');

// デバッグモード時の詳細ログ
if (window.FutabaDrawingTool?.Config?.debug?.enabled) {
    const stats = window.FutabaDrawingTool.Constants.getStats();
    console.log('📊 定数統計:', stats);
    console.log('🎯 利用可能機能:', window.FutabaDrawingTool.Constants.PHASES.FEATURES[window.FutabaDrawingTool.Constants.PHASES.CURRENT]);
    console.log('🎨 ふたば色パレット:', {
        maroon: window.FutabaDrawingTool.Constants.getColorCSS(window.FutabaDrawingTool.Constants.COLORS.FUTABA.MAROON),
        cream: window.FutabaDrawingTool.Constants.getColorCSS(window.FutabaDrawingTool.Constants.COLORS.FUTABA.CREAM),
        background: window.FutabaDrawingTool.Constants.getColorCSS(window.FutabaDrawingTool.Constants.COLORS.FUTABA.BACKGROUND)
    });
}

// グローバルエイリアス（利便性向上）
window.FutabaConstants = window.FutabaDrawingTool.Constants;