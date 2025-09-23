// ===== config.js - Fixed Version =====
// グローバル設定として定義（AI作業性最適化）

// 修正1: window.TegakiConfig を window.TEGAKI_CONFIG に統一
window.TEGAKI_CONFIG = {
    canvas: { 
        width: 400, 
        height: 400,
        // 修正2: coordinate-system.js で参照される defaultWidth/Height を追加
        defaultWidth: 400,
        defaultHeight: 400
    },
    pen: { 
        size: 5, 
        opacity: 0.85, 
        color: 0x800000 
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
    // 修正3: カラー設定を追加（camera-system.js で参照）
    colors: {
        futabaMaroon: 0x800000,
        futabaLightMaroon: 0xaa5a56,
        futabaMedium: 0xcf9c97,
        futabaLightMedium: 0xe9c2ba,
        futabaCream: 0xf0e0d6,
        futabaBackground: 0xffffee
    },
    // 修正4: サムネイル品質設定
    thumbnail: {
        SIZE: 48,           // 最終サムネイルサイズ
        RENDER_SCALE: 3,    // 高解像度レンダリング倍率
        QUALITY: 'high'     // Canvas APIスムージング品質
    },
    debug: false
};

// 修正5: ショートカット設定（ui-state.js 用）
window.TEGAKI_SHORTCUTS = {
    pen: 'KeyP',
    eraser: 'KeyE',
    layerMode: 'KeyV',
    canvasReset: 'Digit0',
    horizontalFlip: 'KeyH'
};

// 修正6: 色設定（文字列形式）
window.TEGAKI_COLORS = {
    futabaMaroon: '#800000',
    futabaLightMaroon: '#aa5a56',
    futabaMedium: '#cf9c97',
    futabaLightMedium: '#e9c2ba',
    futabaCream: '#f0e0d6',
    futabaBackground: '#ffffee'
};

// デバッグログ用ユーティリティ関数もグローバルに配置
window.TEGAKI_UTILS = {
    log: (...args) => {
        if (window.TEGAKI_CONFIG.debug) console.log(...args);
    }
};

// 修正7: coordinate-system.js で使用される TegakiUtils を追加
window.TegakiUtils = {
    validatePoint: (point) => {
        return point && 
               typeof point.x === 'number' && 
               typeof point.y === 'number' && 
               isFinite(point.x) && 
               isFinite(point.y);
    },
    
    log: (...args) => {
        if (window.TEGAKI_CONFIG.debug) console.log(...args);
    },
    
    clamp: (value, min, max) => {
        return Math.max(min, Math.min(max, value));
    }
};

// 修正8: レガシー互換性のため、TegakiConfig も公開
window.TegakiConfig = window.TEGAKI_CONFIG;

console.log('✅ Fixed config.js loaded - All reference issues resolved');