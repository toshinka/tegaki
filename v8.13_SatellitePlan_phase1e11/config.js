// ===== config.js - キーコンフィグ対応版 =====
// グローバル設定として定義（AI作業性最適化）

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
    // 改修Claude向けコメント：サムネイル品質設定
    thumbnail: {
        SIZE: 48,           // 最終サムネイルサイズ
        RENDER_SCALE: 3,    // 高解像度レンダリング倍率
        QUALITY: 'high'     // Canvas APIスムージング品質
    },
    debug: false
};

// ✅ 新規追加：キーコンフィグ機能 - 将来のユーザー設定変更対応
window.TEGAKI_KEYCONFIG = {
    // ツール切り替え（変更なし）
    pen: 'KeyP',
    eraser: 'KeyE',
    layerMode: 'KeyV',
    canvasReset: 'Digit0',
    horizontalFlip: 'KeyH',
    
    // ✅ 変更：レイヤー階層移動（素の方向キー）
    layerUp: 'ArrowUp',         // 素の↑: レイヤー階層を上に移動
    layerDown: 'ArrowDown',     // 素の↓: レイヤー階層を下に移動
    
    // ✅ 新規：GIFツール用予約キー
    gifPrevFrame: 'ArrowLeft',  // 素の←: GIF前フレーム（将来実装）
    gifNextFrame: 'ArrowRight', // 素の→: GIF次フレーム（将来実装）
    
    // レイヤー変形（Vキーモード時のみ）
    layerMoveUp: 'ArrowUp',     // V + ↑: レイヤー移動上
    layerMoveDown: 'ArrowDown', // V + ↓: レイヤー移動下
    layerMoveLeft: 'ArrowLeft', // V + ←: レイヤー移動左
    layerMoveRight: 'ArrowRight', // V + →: レイヤー移動右
    
    // レイヤー変形（V + Shiftキー）
    layerScaleUp: 'ArrowUp',    // V + Shift + ↑: レイヤー拡大
    layerScaleDown: 'ArrowDown', // V + Shift + ↓: レイヤー縮小
    layerRotateLeft: 'ArrowLeft', // V + Shift + ←: レイヤー左回転
    layerRotateRight: 'ArrowRight' // V + Shift + →: レイヤー右回転
};

// ✅ キーコンフィグ管理クラス（将来のUI設定パネル用）
window.TEGAKI_KEYCONFIG_MANAGER = {
    // 現在のキーコンフィグを取得
    getKeyConfig() {
        return { ...window.TEGAKI_KEYCONFIG };
    },
    
    // キーコンフィグを更新（将来のUI設定用）
    updateKeyConfig(updates) {
        Object.assign(window.TEGAKI_KEYCONFIG, updates);
        this.saveToStorage();
        console.log('🔧 KeyConfig updated:', updates);
    },
    
    // ローカルストレージに保存（将来実装）
    saveToStorage() {
        // 注意：Claude.ai環境ではlocalStorageが使用不可
        // 本格実装時はサーバーサイド保存またはCookie使用
        console.log('💾 KeyConfig saved (placeholder)');
    },
    
    // デフォルト設定にリセット
    resetToDefault() {
        // デフォルト値で上書き
        const defaultConfig = {
            pen: 'KeyP',
            eraser: 'KeyE',
            layerMode: 'KeyV',
            canvasReset: 'Digit0',
            horizontalFlip: 'KeyH',
            layerUp: 'ArrowUp',
            layerDown: 'ArrowDown',
            gifPrevFrame: 'ArrowLeft',
            gifNextFrame: 'ArrowRight',
            layerMoveUp: 'ArrowUp',
            layerMoveDown: 'ArrowDown',
            layerMoveLeft: 'ArrowLeft',
            layerMoveRight: 'ArrowRight',
            layerScaleUp: 'ArrowUp',
            layerScaleDown: 'ArrowDown',
            layerRotateLeft: 'ArrowLeft',
            layerRotateRight: 'ArrowRight'
        };
        
        Object.assign(window.TEGAKI_KEYCONFIG, defaultConfig);
        this.saveToStorage();
        console.log('🔧 KeyConfig reset to default');
    },
    
    // キーの競合チェック（設定UI用）
    checkConflicts(newKey, targetAction) {
        const conflicts = [];
        const currentConfig = this.getKeyConfig();
        
        Object.entries(currentConfig).forEach(([action, key]) => {
            if (action !== targetAction && key === newKey) {
                conflicts.push(action);
            }
        });
        
        return conflicts;
    },
    
    // キーコードからアクション名を取得
    getActionForKey(keyCode, modifiers = {}) {
        const { vPressed, shiftPressed } = modifiers;
        const config = this.getKeyConfig();
        
        // コンテキスト別のキー解釈
        if (vPressed && shiftPressed) {
            // V + Shift + キー
            if (keyCode === config.layerScaleUp) return 'layerScaleUp';
            if (keyCode === config.layerScaleDown) return 'layerScaleDown';
            if (keyCode === config.layerRotateLeft) return 'layerRotateLeft';
            if (keyCode === config.layerRotateRight) return 'layerRotateRight';
        } else if (vPressed) {
            // V + キー
            if (keyCode === config.layerMoveUp) return 'layerMoveUp';
            if (keyCode === config.layerMoveDown) return 'layerMoveDown';
            if (keyCode === config.layerMoveLeft) return 'layerMoveLeft';
            if (keyCode === config.layerMoveRight) return 'layerMoveRight';
        } else {
            // 素のキー
            if (keyCode === config.layerUp) return 'layerUp';
            if (keyCode === config.layerDown) return 'layerDown';
            if (keyCode === config.gifPrevFrame) return 'gifPrevFrame';
            if (keyCode === config.gifNextFrame) return 'gifNextFrame';
            
            // ツールキー
            if (keyCode === config.pen) return 'pen';
            if (keyCode === config.eraser) return 'eraser';
            if (keyCode === config.layerMode) return 'layerMode';
            if (keyCode === config.canvasReset) return 'canvasReset';
            if (keyCode === config.horizontalFlip) return 'horizontalFlip';
        }
        
        return null;
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
    }
};