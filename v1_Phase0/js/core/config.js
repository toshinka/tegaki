/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 設定管理システム - js/core/config.js
 * Phase1.1 STEP1: 基盤設定・DRY原則準拠
 */

console.log('🔧 設定管理システム読み込み開始...');

// ==== アプリケーション基本設定 ====
window.FutabaDrawingTool = window.FutabaDrawingTool || {};

window.FutabaDrawingTool.Config = {
    // アプリケーション情報
    app: {
        name: 'ふたば☆ちゃんねる風ベクターお絵描きツール',
        version: '1.0.0',
        phase: 'Phase1.1',
        buildDate: new Date().toISOString(),
        author: 'Futaba Drawing Tool Team'
    },
    
    // キャンバス設定
    canvas: {
        defaultWidth: 400,
        defaultHeight: 400,
        minWidth: 100,
        maxWidth: 4096,
        minHeight: 100,
        maxHeight: 4096,
        backgroundColor: 0xf0e0d6, // ふたばクリーム
        resolution: 1, // PixiJS v7/v8 対応固定値
        autoDensity: false // devicePixelRatio問題回避
    },
    
    // ツール設定
    tools: {
        pen: {
            defaultSize: 16.0,
            minSize: 0.1,
            maxSize: 100.0,
            defaultOpacity: 0.85,
            minOpacity: 0.0,
            maxOpacity: 1.0,
            defaultPressure: 0.5,
            minPressure: 0.0,
            maxPressure: 1.0,
            defaultSmoothing: 0.3,
            minSmoothing: 0.0,
            maxSmoothing: 1.0,
            defaultColor: 0x800000, // ふたばマルーン
            pressureSensitivity: true,
            edgeSmoothing: true,
            gpuAcceleration: true
        },
        
        eraser: {
            defaultSize: 16.0,
            minSize: 0.1,
            maxSize: 100.0,
            opacity: 1.0 // 消しゴムは常に完全不透明
        }
    },
    
    // UI設定
    ui: {
        popups: {
            draggable: true,
            fadeAnimation: true,
            animationDuration: 300, // ms
            defaultPositions: {
                penSettings: { x: 60, y: 100 },
                resizeSettings: { x: 60, y: 150 }
            }
        },
        
        sliders: {
            handleSize: 16,
            trackHeight: 6,
            updateThrottle: 16 // ~60fps
        },
        
        presets: {
            sizes: [1, 2, 4, 8, 16, 32], // デフォルトサイズプリセット
            canvasSizes: [
                { width: 400, height: 400, label: '400×400' },
                { width: 600, height: 600, label: '600×600' },
                { width: 800, height: 600, label: '800×600' }
            ]
        }
    },
    
    // パフォーマンス設定
    performance: {
        fps: {
            target: 60,
            monitor: true,
            updateInterval: 1000 // ms
        },
        
        drawing: {
            minDistance: 1.5, // ピクセル - 描画点間の最小距離
            maxPathPoints: 1000, // パスごとの最大点数
            smoothingSteps: 3 // スムージング計算ステップ数
        },
        
        memory: {
            maxPaths: 1000, // 最大パス保持数
            autoCleanup: true,
            cleanupThreshold: 800 // パス数がこれを超えると自動クリーンアップ
        }
    },
    
    // Phase対応設定
    phases: {
        current: '1.1',
        features: {
            '1.1': ['basic-drawing', 'ui-system', 'fetch-api'],
            '1.2': ['advanced-drawing', 'layer-system'],
            '1.3': ['popup-enhancement', 'tool-expansion'],
            '2.0': ['pixi-libraries', 'gif-export', 'advanced-ui']
        }
    },
    
    // デバッグ・開発設定
    debug: {
        enabled: true, // 本番では false に
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        showPerformanceStats: true,
        showCanvasInfo: true,
        verboseLogging: false
    },
    
    // PixiJS設定
    pixi: {
        version: '7.4.2', // 現在使用バージョン
        targetVersion: '8.0.0', // 将来対応バージョン
        extensions: {
            // Phase2で使用予定の@pixiライブラリ
            ui: { enabled: false, version: '^1.2.4' },
            layers: { enabled: false, version: '^2.1.0' },
            gif: { enabled: false, version: '^2.1.1' },
            'graphics-smooth': { enabled: false, version: '^2.0.0' },
            'graphics-extras': { enabled: false, version: '^2.0.0' }
        }
    },
    
    // 色設定（ふたば風カラーパレット）
    colors: {
        futaba: {
            maroon: 0x800000,
            lightMaroon: 0xaa5a56,
            medium: 0xcf9c97,
            lightMedium: 0xe9c2ba,
            cream: 0xf0e0d6,
            background: 0xffffee
        },
        
        text: {
            primary: 0x2c1810,
            secondary: 0x5d4037,
            inverse: 0xffffff
        }
    }
};

// ==== 設定管理ヘルパー関数 ====

/**
 * 安全な設定値取得（SOLID原則準拠）
 * @param {string} keyPath - ドット記法での設定キーパス (例: 'canvas.defaultWidth')
 * @param {*} defaultValue - デフォルト値
 * @returns {*} 設定値
 */
window.FutabaDrawingTool.safeConfigGet = function(keyPath, defaultValue = null) {
    try {
        const keys = keyPath.split('.');
        let current = window.FutabaDrawingTool.Config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current !== undefined ? current : defaultValue;
    } catch (error) {
        if (window.FutabaDrawingTool.Config.debug.enabled) {
            console.warn(`⚠️ 設定取得エラー: ${keyPath}`, error);
        }
        return defaultValue;
    }
};

/**
 * 設定値の動的更新
 * @param {string} keyPath - ドット記法での設定キーパス
 * @param {*} value - 新しい値
 * @returns {boolean} 更新成功フラグ
 */
window.FutabaDrawingTool.safeConfigSet = function(keyPath, value) {
    try {
        const keys = keyPath.split('.');
        const lastKey = keys.pop();
        let current = window.FutabaDrawingTool.Config;
        
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        if (window.FutabaDrawingTool.Config.debug.enabled) {
            console.log(`🔧 設定更新: ${keyPath} ${oldValue} → ${value}`);
        }
        
        return true;
    } catch (error) {
        console.error(`❌ 設定更新エラー: ${keyPath}`, error);
        return false;
    }
};

/**
 * 設定妥当性検証
 * @returns {Object} 検証結果
 */
window.FutabaDrawingTool.validateConfig = function() {
    const results = {
        valid: true,
        errors: [],
        warnings: []
    };
    
    const config = window.FutabaDrawingTool.Config;
    
    // 必須設定チェック
    if (!config.canvas || typeof config.canvas.defaultWidth !== 'number') {
        results.errors.push('canvas.defaultWidth は数値である必要があります');
        results.valid = false;
    }
    
    if (!config.tools || !config.tools.pen) {
        results.errors.push('tools.pen 設定が必要です');
        results.valid = false;
    }
    
    // 値範囲チェック
    if (config.canvas.defaultWidth < config.canvas.minWidth || 
        config.canvas.defaultWidth > config.canvas.maxWidth) {
        results.warnings.push(`canvas.defaultWidth が範囲外です: ${config.canvas.defaultWidth}`);
    }
    
    // PixiJS バージョンチェック
    if (typeof PIXI !== 'undefined' && PIXI.VERSION !== config.pixi.version) {
        results.warnings.push(`PixiJS バージョン不一致: 期待値=${config.pixi.version}, 実際=${PIXI.VERSION}`);
    }
    
    return results;
};

// ==== Phase対応機能チェック ====

/**
 * 現在のPhaseで利用可能な機能かチェック
 * @param {string} feature - 機能名
 * @returns {boolean} 利用可能フラグ
 */
window.FutabaDrawingTool.isFeatureAvailable = function(feature) {
    const currentPhase = window.FutabaDrawingTool.Config.phases.current;
    const phaseFeatures = window.FutabaDrawingTool.Config.phases.features[currentPhase] || [];
    return phaseFeatures.includes(feature);
};

/**
 * 設定のエクスポート（開発・デバッグ用）
 * @returns {string} JSON形式の設定
 */
window.FutabaDrawingTool.exportConfig = function() {
    return JSON.stringify(window.FutabaDrawingTool.Config, null, 2);
};

// ==== 初期化ログ ====
console.log('✅ 設定管理システム初期化完了');
console.log(`📦 アプリケーション: ${window.FutabaDrawingTool.Config.app.name} v${window.FutabaDrawingTool.Config.app.version}`);
console.log(`🔄 フェーズ: ${window.FutabaDrawingTool.Config.phases.current}`);
console.log(`🎯 デバッグモード: ${window.FutabaDrawingTool.Config.debug.enabled ? '有効' : '無効'}`);

// 設定妥当性検証実行
const validation = window.FutabaDrawingTool.validateConfig();
if (!validation.valid) {
    console.error('❌ 設定検証エラー:', validation.errors);
} else if (validation.warnings.length > 0) {
    console.warn('⚠️ 設定検証警告:', validation.warnings);
} else {
    console.log('✅ 設定検証: 問題なし');
}

// グローバル関数エイリアス（後方互換性・利便性向上）
window.safeConfigGet = window.FutabaDrawingTool.safeConfigGet;
window.safeConfigSet = window.FutabaDrawingTool.safeConfigSet;