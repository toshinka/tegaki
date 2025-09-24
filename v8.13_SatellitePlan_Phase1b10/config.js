// ===== config.js =====
// グローバル設定として定義（AI作業性最適化）

// === 共通定数定義（PI参照統一） ===
const PI = Math.PI;
const TAU = 2 * PI;
const DEG_TO_RAD = PI / 180;
const RAD_TO_DEG = 180 / PI;

window.TEGAKI_CONFIG = {
    canvas: { 
        width: 400, 
        height: 400 
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
        minRotation: -PI, // ラジアン統一
        maxRotation: PI   // ラジアン統一
    },
    background: { 
        color: 0xf0e0d6 
    },
    history: { 
        maxSize: 10, 
        autoSaveInterval: 500 
    },
    // 改修Claude向けコメント：サムネイル品質設定
    thumbnail: {
        SIZE: 48,           // 最終サムネイルサイズ
        RENDER_SCALE: 3,    // 高解像度レンダリング倍率
        QUALITY: 'high'     // Canvas APIスムージング品質
    },
    debug: false,
    // 数学定数（統一参照）
    math: {
        PI: PI,
        TAU: TAU,
        DEG_TO_RAD: DEG_TO_RAD,
        RAD_TO_DEG: RAD_TO_DEG
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

// デバッグログ用ユーティリティ関数もグローバルに配置
window.TEGAKI_UTILS = {
    log: (...args) => {
        if (window.TEGAKI_CONFIG.debug) console.log(...args);
    },
    // 数学ユーティリティ（統一参照）
    degToRad: (degrees) => degrees * DEG_TO_RAD,
    radToDeg: (radians) => radians * RAD_TO_DEG,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    lerp: (a, b, t) => a + (b - a) * t,
    // 座標ユーティリティ
    distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    // PixiJS v8.13互換性チェック
    checkPixiVersion: () => {
        if (typeof PIXI === 'undefined') {
            console.error('PixiJS not loaded');
            return false;
        }
        const version = PIXI.VERSION;
        const majorVersion = parseInt(version.split('.')[0]);
        if (majorVersion < 8) {
            console.warn(`PixiJS version ${version} detected. v8.13+ recommended.`);
        }
        console.log(`PixiJS version ${version} loaded`);
        return true;
    }
};

// 初期化時のバージョンチェック
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // PixiJSロード後にバージョンチェック
        setTimeout(() => {
            window.TEGAKI_UTILS.checkPixiVersion();
        }, 100);
    });
}