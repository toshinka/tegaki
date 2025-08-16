/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🎯 DEPENDENCIES: js/app-core.js, js/managers/* (Pure JavaScript)
 * 🎯 NODE_MODULES: pixi.js@^7.4.3（ローカル読み込み）
 * 🎯 PIXI_EXTENSIONS: libs/pixi-extensions.js統合基盤活用
 * 🎯 ISOLATION_TEST: ❌ 全体統括のため
 * 🎯 SPLIT_THRESHOLD: 150行（超過時分割検討）
 * 📋 PHASE_TARGET: Phase1.1ss3 - Pure JavaScript完全準拠
 * 📋 V8_MIGRATION: Application.init() 対応予定
 * 📋 RULEBOOK_COMPLIANCE: 1.2実装原則「Pure JavaScript維持」完全準拠
 */

/**
 * アプリケーション動的読み込みシステム
 * ルールブック2.4 Pure JavaScript読み込みパターン準拠
 */
class AppLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.loadQueue = [];
        this.isInitialized = false;
    }
    
    /**
     * 動的スクリプト読み込み
     * @param {string} src - スクリプトパス
     * @returns {Promise}
     */
    async loadScript(src) {
        if (this.loadedScripts.has(src)) {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.loadedScripts.add(src);
                console.log(`✅ ${src} 読み込み完了`);
                resolve();
            };
            script.onerror = (error) => {
                console.error(`❌ ${src} 読み込み失敗:`, error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * 必須コンポーネント読み込み
     */
    async loadCoreComponents() {
        console.log('🔧 コアコンポーネント読み込み開始...');
        
        // 依存関係順で読み込み
        const coreScripts = [
            'js/utils/coordinates.js',
            'js/utils/performance.js', 
            'js/utils/icon-manager.js',
            'js/app-core.js'
        ];
        
        for (const script of coreScripts) {
            await this.loadScript(script);
        }
        
        console.log('✅ コアコンポーネント読み込み完了');
    }
    
    /**
     * 管理システム読み込み
     */
    async loadManagers() {
        console.log('🔧 管理システム読み込み開始...');
        
        const managerScripts = [
            'js/managers/canvas-manager.js',
            'js/managers/tool-manager.js',
            'js/managers/ui-manager.js'
        ];
        
        for (const script of managerScripts) {
            await this.loadScript(script);
        }
        
        console.log('✅ 管理システム読み込み完了');
    }
    
    /**
     * 描画ツール読み込み
     */
    async loadTools() {
        console.log('🔧 描画ツール読み込み開始...');
        
        const toolScripts = [
            'js/tools/pen-tool.js',
            'js/tools/eraser-tool.js'
        ];
        
        for (const script of toolScripts) {
            await this.loadScript(script);
        }
        
        console.log('✅ 描画ツール読み込み完了');
    }
    
    /**
     * アプリケーション初期化
     */
    async init() {
        try {
            console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
            console.log('📋 Phase1.1ss3: Pure JavaScript完全準拠版');
            console.log('🚀 起動開始...');
            
            // PixiJS拡張ライブラリ初期化確認
            if (!window.PixiExtensions) {
                throw new Error('PixiExtensions が読み込まれていません');
            }
            
            await window.PixiExtensions.initialize();
            console.log('✅ PixiJS拡張ライブラリ初期化完了');
            
            // 段階的コンポーネント読み込み
            await this.loadCoreComponents();
            await this.loadManagers();
            await this.loadTools();
            
            // メインアプリケーション起動
            await this.startMainApplication();
            
            this.isInitialized = true;
            console.log('🎉 アプリケーション起動完了！');
            
        } catch (error) {
            console.error('❌ アプリケーション起動失敗:', error);
            this.showErrorMessage(error);
            throw error;
        }
    }
    
    /**
     * メインアプリケーション起動
     */
    async startMainApplication() {
        console.log('🔧 メインアプリケーション初期化...');
        
        // AppCore 初期化
        if (!window.AppCore) {
            throw new Error('AppCore クラスが読み込まれていません');
        }
        
        const appCore = new window.AppCore();
        await appCore.init();
        
        // グローバル参照として保存
        window.futabaDrawingTool = new FutabaDrawingTool(appCore);
        await window.futabaDrawingTool.init();
        
        console.log('✅ メインアプリケーション初期化完了');
    }
    
    /**
     * エラーメッセージ表示
     */
    showErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: monospace;
            font-size: 12px;
        `;
        
        errorDiv.innerHTML = `
            <strong>エラーが発生しました:</strong><br>
            ${error.message || error}
            <br><br>
            <button onclick="this.parentNode.remove()" 
                    style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">
                閉じる
            </button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 5秒後自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

/**
 * メインアプリケーションクラス
 * 元HTMLのFutabaDrawingToolを分割構造で再実装
 * DRY原則: 共通初期化処理の統合
 * SOLID原則: 単一責任 - アプリケーション統括のみ
 */
class FutabaDrawingTool {
    constructor(appCore) {
        this.version = 'v1.0-Phase1.1ss3-PureJS';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 主要コンポーネント
        this.appCore = appCore;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.performanceMonitor = null;
        
        console.log(`🎨 ${this.version} 構築完了`);
    }
    
    /**
     * アプリケーション初期化
     * 元HTMLのinitメソッドを分割構造で再実装
     */
    async init() {
        try {
            console.log('🔧 Phase1.1ss3 Pure JavaScript構造での初期化開始');
            
            // Step 1: キャンバス管理システム初期化  
            await this.initializeCanvasManager();
            
            // Step 2: ツール管理システム初期化
            await this.initializeToolManager();
            
            // Step 3: UI管理システム初期化
            await this.initializeUIManager();
            
            // Step 4: イベントハンドリング設定
            this.setupEventHandlers();
            
            // Step 5: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 6: 初期状態設定
            this.setupInitialState();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('✅ Phase1.1ss3 Pure JavaScript初期化完了！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            console.log('📊 Pure JavaScript構造対応状況:');
            console.log('  - CanvasManager: PixiJS描画エンジン統合');
            console.log('  - ToolManager: ペン・消しゴムツール分離');
            console.log('  - UIManager: インターフェース統括');
            console.log('  - ルールブック準拠: ESM禁止・Pure JavaScript完全準拠');
            
        } catch (error) {
            console.error('❌ 初期化失敗:', error);
            this.showErrorMessage(error);
            throw error;
        }
    }
    
    /**
     * キャンバス管理システム初期化
     */
    async initializeCanvasManager() {
        if (!window.CanvasManager) {
            throw new Error('CanvasManager クラスが読み込まれていません');
        }
        
        this.canvasManager = new window.CanvasManager();
        await this.canvasManager.init('drawing-canvas');
        console.log('✅ CanvasManager初期化完了');
    }
    
    /**
     * ツール管理システム初期化
     */
    async initializeToolManager() {
        if (!window.ToolManager) {
            throw new Error('ToolManager クラスが読み込まれていません');
        }
        
        this.toolManager = new window.ToolManager();
        this.toolManager.init(this.canvasManager);
        
        // 個別ツール登録
        if (window.PenTool) {
            const penTool = new window.PenTool(this.toolManager);
            penTool.init();
        }
        
        if (window.EraserTool) {
            const eraserTool = new window.EraserTool(this.toolManager);
            eraserTool.init();
        }
        
        console.log('✅ ToolManager初期化完了');
    }
    
    /**
     * UI管理システム初期化
     */
    async initializeUIManager() {
        if (!window.UIManager) {
            throw new Error('UIManager クラスが読み込まれていません');
        }
        
        this.uiManager = new window.UIManager(this.toolManager);
        this.uiManager.init();
        
        console.log('✅ UIManager初期化完了');
    }
    
    /**
     * イベントハンドリング設定
     * 元HTMLのsetupCanvasEventsを統合
     */
    setupEventHandlers() {
        if (!this.canvasManager.app) {
            console.warn('⚠️ キャンバスアプリケーション未初期化');
            return;
        }
        
        // PointerDown: 描画開始
        this.canvasManager.app.stage.on('pointerdown', (event) => {
            if (this.uiManager.activePopup) return; // ポップアップ表示中は無視
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        // PointerMove: 描画継続・座標更新
        this.canvasManager.app.stage.on('pointermove', (event) => {
            const point = this.canvasManager.getLocalPointerPosition(event);
            
            // 座標表示更新（元HTML機能維持）
            this.updateCoordinateDisplay(point.x, point.y);
            
            // 筆圧モニター更新（簡易実装）
            if (this.toolManager.isDrawing) {
                this.updatePressureMonitor();
            }
            
            // 描画継続
            if (!this.uiManager.activePopup) {
                this.toolManager.continueDrawing(point.x, point.y);
            }
        });
        
        // PointerUp: 描画終了
        this.canvasManager.app.stage.on('pointerup', () => {
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // PointerUpOutside: キャンバス外での描画終了
        this.canvasManager.app.stage.on('pointerupoutside', () => {
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // リサイズイベント統合
        this.setupResizeHandlers();
        
        console.log('✅ イベントハンドリング設定完了');
    }
    
    /**
     * リサイズハンドラー設定（元HTML機能統合）
     */
    setupResizeHandlers() {
        document.getElementById('apply-resize')?.addEventListener('click', () => {
            this.applyCanvasResize(false);
        });
        
        document.getElementById('apply-resize-center')?.addEventListener('click', () => {
            this.applyCanvasResize(true);
        });
    }
    
    /**
     * キャンバスリサイズ適用（元HTML機能）
     * @param {boolean} centerContent - 中央寄せフラグ
     */
    applyCanvasResize(centerContent) {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        
        if (width && height) {
            this.canvasManager.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.uiManager.closeAllPopups();
        }
    }
    
    /**
     * パフォーマンス監視開始（元HTML機能統合）
     */
    startPerformanceMonitoring() {
        // 元HTMLのPerformanceMonitorクラス機能を統合
        this.performanceMonitor = {
            frameCount: 0,
            lastTime: performance.now()
        };
        
        const updatePerformance = () => {
            this.performanceMonitor.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.performanceMonitor.lastTime >= 1000) {
                const fps = Math.round((this.performanceMonitor.frameCount * 1000) / 
                    (currentTime - this.performanceMonitor.lastTime));
                
                const fpsElement = document.getElementById('fps');
                if (fpsElement) fpsElement.textContent = fps;
                
                this.performanceMonitor.frameCount = 0;
                this.performanceMonitor.lastTime = currentTime;
            }
            
            requestAnimationFrame(updatePerformance);
        };
        
        updatePerformance();
        console.log('✅ パフォーマンス監視開始');
    }
    
    /**
     * 初期状態設定（元HTML機能維持）
     */
    setupInitialState() {
        // 初期ツール設定
        if (this.toolManager.setTool) {
            this.toolManager.setTool('pen');
        }
        
        // 初期キャンバス情報更新
        this.updateCanvasInfo();
        
        // 初期色設定表示
        const colorElement = document.getElementById('current-color');
        if (colorElement) colorElement.textContent = '#800000';
        
        const toolElement = document.getElementById('current-tool');
        if (toolElement) toolElement.textContent = 'ベクターペン';
    }
    
    /**
     * 座標表示更新（元HTML機能）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    updateCoordinateDisplay(x, y) {
        const coordinatesElement = document.getElementById('coordinates');
        if (coordinatesElement) {
            coordinatesElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    /**
     * 筆圧モニター更新（元HTML機能）
     */
    updatePressureMonitor() {
        const pressure = Math.min(100, 
            this.toolManager.globalSettings.pressure * 100 + Math.random() * 20);
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    /**
     * 筆圧モニターリセット（元HTML機能）
     */
    resetPressureMonitor() {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = '0.0%';
        }
    }
    
    /**
     * キャンバス情報更新（元HTML機能）
     */
    updateCanvasInfo() {
        const state = this.canvasManager.getCanvasState();
        const infoElement = document.getElementById('canvas-info');
        if (infoElement) {
            infoElement.textContent = `${state.width}×${state.height}px`;
        }
    }
    
    /**
     * エラーメッセージ表示
     * @param {Error} error - エラーオブジェクト
     */
    showErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: monospace;
            font-size: 12px;
        `;
        
        errorDiv.innerHTML = `
            <strong>エラーが発生しました:</strong><br>
            ${error.message || error}
            <br><br>
            <button onclick="this.parentNode.remove()" 
                    style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">
                閉じる
            </button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 5秒後自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    /**
     * アプリケーション状態取得（デバッグ用）
     */
    getAppState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            canvasState: this.canvasManager?.getCanvasState(),
            toolState: this.toolManager?.getDrawingState(),
            performanceInfo: this.canvasManager?.getPerformanceInfo()
        };
    }
    
    /**
     * ツール設定更新（UIManagerからの通知用）
     */
    updateToolSettings(settings) {
        if (this.toolManager && this.toolManager.updateGlobalSettings) {
            this.toolManager.updateGlobalSettings(settings);
        }
    }
    
    /**
     * キャンバスリサイズ（UIManagerからの通知用）
     */
    resize(width, height, centerContent) {
        if (this.canvasManager) {
            this.canvasManager.resize(width, height, centerContent);
            this.updateCanvasInfo();
        }
    }
}

/**
 * アプリケーション起動
 * ルールブック準拠：Pure JavaScript・DOMContentLoaded使用
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // AppLoader使用でPure JavaScript読み込みパターン実行
        const loader = new AppLoader();
        await loader.init();
        
        console.log('🎉 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('✅ Pure JavaScript完全準拠版 - 起動完了！');
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // フォールバック表示（ふたば風デザイン維持）
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:2px solid #aa5a56;border-radius:16px;">
                    <h2>🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p>申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <p style="font-family:monospace;font-size:12px;color:#666;margin:16px 0;">${error.message}</p>
                    <button onclick="location.reload()" 
                            style="background:#800000;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">
                        再読み込み
                    </button>
                </div>
            </div>
        `;
    }
});

// デバッグ用グローバル公開
window.AppLoader = AppLoader;
window.FutabaDrawingTool = FutabaDrawingTool;

console.log('🎨 main.js Pure JavaScript完全準拠版 - 準備完了');
console.log('📋 ルールブック準拠: 1.2実装原則「ESM/TypeScript混在禁止・Pure JavaScript維持」');
console.log('💡 使用例: window.futabaDrawingTool.getAppState() でアプリ状態確認可能');