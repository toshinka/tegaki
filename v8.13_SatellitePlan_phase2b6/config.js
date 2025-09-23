// ===== config.js - 完全修正版（参照統一・API互換確保） =====
// 元版との完全互換性を保ちつつ、分割版の問題を解決

// === メイン設定オブジェクト ===
window.TEGAKI_CONFIG = {
    canvas: { 
        width: 400, 
        height: 400,
        // 分割版互換のため defaultWidth/Height も設定
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
    // 分割版互換のカラー設定
    colors: {
        futabaMaroon: 0x800000,
        futabaLightMaroon: 0xaa5a56,
        futabaMedium: 0xcf9c97,
        futabaLightMedium: 0xe9c2ba,
        futabaCream: 0xf0e0d6,
        futabaBackground: 0xffffee
    },
    // サムネイル設定
    thumbnail: {
        SIZE: 48,
        RENDER_SCALE: 3,
        QUALITY: 'high'
    },
    debug: false
};

// === レガシー互換性確保 ===
// 分割版で TegakiConfig 参照をしている箇所があるため
window.TegakiConfig = window.TEGAKI_CONFIG;

// === ショートカット設定 ===
window.TEGAKI_SHORTCUTS = {
    pen: 'KeyP',
    eraser: 'KeyE',
    layerMode: 'KeyV',
    canvasReset: 'Digit0',
    horizontalFlip: 'KeyH'
};

// === カラー設定（文字列形式・元版互換） ===
window.TEGAKI_COLORS = {
    futabaMaroon: '#800000',
    futabaLightMaroon: '#aa5a56',
    futabaMedium: '#cf9c97',
    futabaLightMedium: '#e9c2ba',
    futabaCream: '#f0e0d6',
    futabaBackground: '#ffffee'
};

// === ユーティリティ関数（元版互換 + 分割版対応） ===
window.TEGAKI_UTILS = {
    log: (...args) => {
        if (window.TEGAKI_CONFIG.debug) console.log(...args);
    },
    
    clamp: (value, min, max) => {
        return Math.max(min, Math.min(max, value));
    },
    
    validatePoint: (point) => {
        return point && 
               typeof point.x === 'number' && 
               typeof point.y === 'number' && 
               isFinite(point.x) && 
               isFinite(point.y);
    }
};

// === TegakiUtils（分割版互換） ===
window.TegakiUtils = window.TEGAKI_UTILS;

// === 設定検証・診断機能 ===
window.TEGAKI_UTILS.validateConfig = function() {
    const config = window.TEGAKI_CONFIG;
    const issues = [];
    
    // 必須設定チェック
    if (!config.canvas || !config.canvas.width || !config.canvas.height) {
        issues.push('Canvas size configuration missing');
    }
    
    if (!config.pen || typeof config.pen.size !== 'number') {
        issues.push('Pen configuration invalid');
    }
    
    if (!config.camera || !config.camera.minScale || !config.camera.maxScale) {
        issues.push('Camera configuration invalid');
    }
    
    // 互換性チェック
    if (!window.TegakiConfig) {
        issues.push('TegakiConfig reference missing');
    }
    
    if (!window.TEGAKI_SHORTCUTS) {
        issues.push('Shortcuts configuration missing');
    }
    
    if (issues.length > 0) {
        console.warn('Configuration issues found:', issues);
        return false;
    }
    
    console.log('✅ Configuration validation passed');
    return true;
};

// === 設定動的更新機能 ===
window.TEGAKI_UTILS.updateCanvasSize = function(width, height) {
    window.TEGAKI_CONFIG.canvas.width = width;
    window.TEGAKI_CONFIG.canvas.height = height;
    window.TEGAKI_CONFIG.canvas.defaultWidth = width;
    window.TEGAKI_CONFIG.canvas.defaultHeight = height;
    
    // TegakiConfig参照も更新
    window.TegakiConfig.canvas.width = width;
    window.TegakiConfig.canvas.height = height;
    window.TegakiConfig.canvas.defaultWidth = width;
    window.TegakiConfig.canvas.defaultHeight = height;
    
    console.log(`Config: Canvas size updated to ${width}x${height}`);
};

// === デバッグ情報取得 ===
window.TEGAKI_UTILS.getDebugInfo = function() {
    return {
        configVersion: '2.0-unified',
        mainConfig: !!window.TEGAKI_CONFIG,
        legacyConfig: !!window.TegakiConfig,
        shortcuts: !!window.TEGAKI_SHORTCUTS,
        colors: !!window.TEGAKI_COLORS,
        utils: !!window.TEGAKI_UTILS,
        legacyUtils: !!window.TegakiUtils,
        canvasSize: {
            width: window.TEGAKI_CONFIG?.canvas?.width,
            height: window.TEGAKI_CONFIG?.canvas?.height,
            defaultWidth: window.TEGAKI_CONFIG?.canvas?.defaultWidth,
            defaultHeight: window.TEGAKI_CONFIG?.canvas?.defaultHeight
        },
        references: {
            tegakiConfigRef: window.TEGAKI_CONFIG === window.TegakiConfig,
            utilsRef: window.TEGAKI_UTILS === window.TegakiUtils
        }
    };
};

// === 初期化確認 ===
(function() {
    console.log('✅ Fixed config.js loaded successfully');
    console.log('📋 Configuration status:');
    console.log(`   - TEGAKI_CONFIG: ${!!window.TEGAKI_CONFIG}`);
    console.log(`   - TegakiConfig (legacy): ${!!window.TegakiConfig}`);
    console.log(`   - TEGAKI_SHORTCUTS: ${!!window.TEGAKI_SHORTCUTS}`);
    console.log(`   - TEGAKI_COLORS: ${!!window.TEGAKI_COLORS}`);
    console.log(`   - TEGAKI_UTILS: ${!!window.TEGAKI_UTILS}`);
    console.log(`   - TegakiUtils (legacy): ${!!window.TegakiUtils}`);
    console.log(`   - Canvas size: ${window.TEGAKI_CONFIG.canvas.width}x${window.TEGAKI_CONFIG.canvas.height}`);
    
    // 自動設定検証
    const isValid = window.TEGAKI_UTILS.validateConfig();
    if (isValid) {
        console.log('🎉 Configuration is ready for both Phase1 and Phase2 compatibility!');
    } else {
        console.error('❌ Configuration validation failed - check warnings above');
    }
})();