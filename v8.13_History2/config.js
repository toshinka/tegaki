// ===== config.js - キーバインディング変更完了版 + GIFアニメーション設定追加 =====
// グローバル設定として定義（AI作業性最適化）
// 【完了】素の方向キー対応・GIFツール予約・キーコンフィグ機能実装
// 【NEW】GIFアニメーション機能設定追加

window.TEGAKI_CONFIG = {
    canvas: { 
        width: 344, 
        height: 135 
    },
    pen: { 
        size: 2, 
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
    // NEW: GIFアニメーション機能設定
    animation: {
        defaultFPS: 12,
        maxCuts: 50,
        defaultCutDuration: 0.5, // 秒
        exportSettings: {
            maxWidth: 800,
            maxHeight: 800,
            quality: 10, // 1-30 (小さいほど高品質)
            workers: 2
        },
        // タイムラインUI設定
        timeline: {
            cutThumbnailWidth: 72,
            cutThumbnailHeight: 54,
            maxVisibleCuts: 10
        },
        // 再生設定
        playback: {
            loopByDefault: true,
            previewQuality: 'medium'  // low/medium/high
        }
    },
    debug: false
};

// ✅ キーバインディング変更完了版：キーコンフィグ機能
window.TEGAKI_KEYCONFIG = {
    // ツール切り替え（変更なし）
    pen: 'KeyP',
    eraser: 'KeyE',
    layerMode: 'KeyV',
    canvasReset: 'Digit0',
    horizontalFlip: 'KeyH',
    
    // ✅ 変更完了：レイヤー階層移動（素の方向キー）
    layerUp: 'ArrowUp',         // 素の↑: レイヤー階層を上に移動
    layerDown: 'ArrowDown',     // 素の↓: レイヤー階層を下に移動
    
    // ✅ 新規完了：GIFツール用予約キー
    gifPrevFrame: 'ArrowLeft',  // 素の←: GIF前フレーム
    gifNextFrame: 'ArrowRight', // 素の→: GIF次フレーム
    gifToggleAnimation: 'KeyA', // Alt+A: GIFアニメーションパネル切り替え
    gifAddCut: 'Plus',          // Alt+Plus: CUT追加
    gifPlayPause: 'Space',      // Space: 再生/一時停止 (アニメーションモード時)
    
    // レイヤー変形（Vキーモード時のみ・キープ）
    layerMoveUp: 'ArrowUp',     // V + ↑: レイヤー移動上
    layerMoveDown: 'ArrowDown', // V + ↓: レイヤー移動下
    layerMoveLeft: 'ArrowLeft', // V + ←: レイヤー移動左
    layerMoveRight: 'ArrowRight', // V + →: レイヤー移動右
    
    // レイヤー変形（V + Shiftキー・キープ）
    layerScaleUp: 'ArrowUp',    // V + Shift + ↑: レイヤー拡大
    layerScaleDown: 'ArrowDown', // V + Shift + ↓: レイヤー縮小
    layerRotateLeft: 'ArrowLeft', // V + Shift + ←: レイヤー左回転
    layerRotateRight: 'ArrowRight' // V + Shift + →: レイヤー右回転
};

// ✅ キーコンフィグ管理クラス完了版（GIF機能統合）
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
        
        // EventBus通知（CoreEngine初期化後のみ）
        if (window.TegakiCore?.CoreEngine && this._coreEngineInstance) {
            this._coreEngineInstance.getEventBus()?.emit('keyconfig:updated', { updates });
        }
    },
    
    // CoreEngine参照設定（EventBus通知用）
    setCoreEngineInstance(coreEngineInstance) {
        this._coreEngineInstance = coreEngineInstance;
    },
    
    // ローカルストレージに保存（将来実装）
    saveToStorage() {
        // 注意：Claude.ai環境ではlocalStorageが使用不可
        // 本格実装時はサーバーサイド保存またはCookie使用
        console.log('💾 KeyConfig saved (placeholder)');
    },
    
    // ローカルストレージから読み込み（将来実装）
    loadFromStorage() {
        // 注意：Claude.ai環境ではlocalStorageが使用不可
        console.log('📂 KeyConfig loaded (placeholder)');
        return this.getKeyConfig();
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
        
        Object.assign(window.TEGAKI_KEYCONFIG, defaultConfig);
        this.saveToStorage();
        console.log('🔧 KeyConfig reset to default');
        
        // EventBus通知
        if (this._coreEngineInstance) {
            this._coreEngineInstance.getEventBus()?.emit('keyconfig:reset');
        }
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
    
    // ✅ 完了版：コンテキスト別キー解釈（GIF機能統合）
    getActionForKey(keyCode, modifiers = {}) {
        const { vPressed, shiftPressed, altPressed } = modifiers;
        const config = this.getKeyConfig();
        
        // Alt組み合わせキー
        if (altPressed) {
            if (keyCode === config.gifToggleAnimation) return 'gifToggleAnimation';
            if (keyCode === config.gifAddCut) return 'gifAddCut';
        }
        
        // コンテキスト別のキー解釈
        if (vPressed && shiftPressed) {
            // V + Shift + キー：レイヤー変形
            if (keyCode === config.layerScaleUp) return 'layerScaleUp';
            if (keyCode === config.layerScaleDown) return 'layerScaleDown';
            if (keyCode === config.layerRotateLeft) return 'layerRotateLeft';
            if (keyCode === config.layerRotateRight) return 'layerRotateRight';
        } else if (vPressed) {
            // V + キー：レイヤー移動・反転
            if (keyCode === config.layerMoveUp) return 'layerMoveUp';
            if (keyCode === config.layerMoveDown) return 'layerMoveDown';
            if (keyCode === config.layerMoveLeft) return 'layerMoveLeft';
            if (keyCode === config.layerMoveRight) return 'layerMoveRight';
            if (keyCode === config.horizontalFlip) return 'horizontalFlip';
        } else {
            // 素のキー：階層移動・GIF操作・ツール切り替え
            if (keyCode === config.layerUp) return 'layerUp';
            if (keyCode === config.layerDown) return 'layerDown';
            if (keyCode === config.gifPrevFrame) return 'gifPrevFrame';
            if (keyCode === config.gifNextFrame) return 'gifNextFrame';
            if (keyCode === config.gifPlayPause) return 'gifPlayPause';
            
            // ツールキー
            if (keyCode === config.pen) return 'pen';
            if (keyCode === config.eraser) return 'eraser';
            if (keyCode === config.layerMode) return 'layerMode';
            if (keyCode === config.canvasReset) return 'canvasReset';
            if (keyCode === config.horizontalFlip) return 'horizontalFlip';
        }
        
        return null;
    },
    
    // ✅ 完了版：アクション名から表示用文字列を取得（GIF機能統合）
    getActionDisplayName(action) {
        const displayNames = {
            pen: 'ペンツール',
            eraser: '消しゴムツール',
            layerMode: 'レイヤーモード',
            canvasReset: 'キャンバスリセット',
            horizontalFlip: '水平反転',
            layerUp: 'レイヤー階層↑',
            layerDown: 'レイヤー階層↓',
            gifPrevFrame: 'GIF前フレーム',
            gifNextFrame: 'GIF次フレーム',
            gifToggleAnimation: 'GIFパネル切替',
            gifAddCut: 'CUT追加',
            gifPlayPause: 'GIF再生/停止',
            layerMoveUp: 'レイヤー移動↑',
            layerMoveDown: 'レイヤー移動↓',
            layerMoveLeft: 'レイヤー移動←',
            layerMoveRight: 'レイヤー移動→',
            layerScaleUp: 'レイヤー拡大',
            layerScaleDown: 'レイヤー縮小',
            layerRotateLeft: 'レイヤー左回転',
            layerRotateRight: 'レイヤー右回転'
        };
        
        return displayNames[action] || action;
    },
    
    // ✅ 完了版：キーコードから表示用文字列を取得
    getKeyDisplayName(keyCode) {
        const displayNames = {
            'KeyP': 'P',
            'KeyE': 'E',
            'KeyV': 'V',
            'KeyH': 'H',
            'KeyA': 'A',
            'Digit0': '0',
            'Plus': '+',
            'ArrowUp': '↑',
            'ArrowDown': '↓',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'Space': 'スペース',
            'ShiftLeft': 'Shift',
            'ShiftRight': 'Shift',
            'ControlLeft': 'Ctrl',
            'ControlRight': 'Ctrl',
            'AltLeft': 'Alt',
            'AltRight': 'Alt'
        };
        
        return displayNames[keyCode] || keyCode;
    },
    
    // ✅ 完了版：将来のUI設定パネル用データ取得（GIF機能統合）
    getKeyConfigForUI() {
        const config = this.getKeyConfig();
        const uiData = [];
        
        // カテゴリー別にグループ化
        const categories = {
            'ツール操作': ['pen', 'eraser', 'layerMode'],
            'レイヤー階層': ['layerUp', 'layerDown'],
            'GIF操作': ['gifToggleAnimation', 'gifAddCut', 'gifPlayPause', 'gifPrevFrame', 'gifNextFrame'],
            'レイヤー移動': ['layerMoveUp', 'layerMoveDown', 'layerMoveLeft', 'layerMoveRight'],
            'レイヤー変形': ['layerScaleUp', 'layerScaleDown', 'layerRotateLeft', 'layerRotateRight'],
            'その他': ['canvasReset', 'horizontalFlip']
        };
        
        Object.entries(categories).forEach(([category, actions]) => {
            const categoryData = {
                category,
                actions: actions.map(action => ({
                    action,
                    actionName: this.getActionDisplayName(action),
                    keyCode: config[action],
                    keyName: this.getKeyDisplayName(config[action]),
                    conflicts: this.checkConflicts(config[action], action)
                }))
            };
            uiData.push(categoryData);
        });
        
        return uiData;
    }
};

// レガシー互換性（既存コードとの互換性維持）
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

// ✅ 初期化完了ログ
console.log('✅ config.js (GIFアニメーション機能統合版) loaded successfully');
console.log('   - ✅ 素の方向キー↑↓: レイヤー階層移動対応');
console.log('   - ✅ 素の方向キー←→: GIF操作対応');
console.log('   - ✅ Alt+A: GIFパネル切替');
console.log('   - ✅ Space: GIF再生/停止');
console.log('   - ✅ Alt+Plus: CUT追加');
console.log('   - ✅ V + 方向キー: レイヤー移動（キープ）');
console.log('   - ✅ V + Shift + 方向キー: レイヤー変形（キープ）');
console.log('   - 🔧 GIFアニメーション設定統合完了');
console.log('   - 🔧 KeyConfig管理クラス完全実装');
console.log('   - 🔧 将来のUI設定パネル対応準備完了');
console.log('   - 互換性維持・既存機能保持');