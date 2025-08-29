/**
 * 🚀 CanvasManager - PixiJS v8.12.0完全対応版（400x400デフォルト・コンソール出力削減版）
 * 
 * @provides getDrawContainer, initializeV8Application, createV8DrawingContainer, 
 *           addGraphicsToLayerV8, resizeV8Canvas, isV8Ready, getV8DebugInfo, 
 *           getLayer, getMainLayer, getCanvasElement, clear
 * @uses window.Tegaki.ErrorManagerInstance.showError, window.Tegaki.EventBusInstance.emit,
 *       PIXI.Application, PIXI.Container, PIXI.Graphics
 * @initflow 1. constructor → 2. initializeV8Application → 3. createV8DrawingContainer → 
 *           4. validateV8Layers → 5. getDrawContainer利用可能
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫フェイルセーフ禁止 🚫v7/v8両対応二重管理禁止
 * @manager-key window.Tegaki.CanvasManagerInstance
 * @dependencies-strict PixiJS v8.12.0(必須), ErrorManager(オプション), EventBus(オプション)
 * @integration-flow AppCore → initializeV8Application → ToolManager注入可能
 * @method-naming-rules initializeV8Application()/getDrawContainer()標準
 * @error-handling 初期化失敗時は例外スロー、フォールバック禁止
 * @performance-notes WebGPU対応、DPR制限で巨大キャンバス防止、Container階層最適化
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * CanvasManager - PixiJS v8.12.0完全対応版
 * 400x400デフォルトサイズ・コンソール出力削減・描画機能修正版
 */
class CanvasManager {
    constructor() {
        console.log('CanvasManager: constructed (v8 friendly)');
        
        // 基本プロパティ
        this.pixiApp = null;
        this.layers = new Map();
        this.initialized = false;
        this.v8Ready = false;
        this.activeLayerId = 'layer1';
        
        // デフォルトキャンバスサイズ（400x400固定）
        this.defaultWidth = 400;
        this.defaultHeight = 400;
        
        // 初期化状態管理
        this.initializationSteps = {
            applicationSet: false,
            layersCreated: false,
            drawContainerReady: false,
            validated: false,
            complete: false
        };
        
        // v8専用プロパティ
        this.rendererType = null;
        this.webgpuSupported = null;
        this.v8Features = {
            webgpuEnabled: false,
            containerHierarchy: false,
            realtimeDrawing: false,
            asyncInitialization: false,
            dprLimited: false,
            drawContainerReady: false
        };
        
        // DPR制限設定
        this.maxDPR = 2.0;
        this.effectiveDPR = 1.0;
        
        // v8描画Container（ToolManager連携用）
        this.v8DrawingContainer = null;
        
        // 背景色設定（ふたばクリーム）
        this.backgroundColor = 0xf0e0d6; // #f0e0d6
    }
    
    /**
     * v8 Application設定・完全初期化（400x400サイズ対応）
     */
    async initializeV8Application(pixiApp) {
        if (!pixiApp) {
            throw new Error('v8 PixiJS Application is required');
        }
        
        if (!pixiApp.stage) {
            throw new Error('v8 PixiJS Application has no stage');
        }
        
        try {
            // Step 1: Application設定
            this.pixiApp = pixiApp;
            this.rendererType = pixiApp.renderer.type;
            this.webgpuSupported = this.rendererType === 'webgpu';
            this.initializationSteps.applicationSet = true;
            
            // Step 2: DPR制限設定
            this.applyDPRLimit();
            
            // Step 3: キャンバスサイズを400x400に設定
            this.resizeV8Canvas(this.defaultWidth, this.defaultHeight);
            
            // Step 4: Container階層作成
            this.createV8DrawingContainer();
            this.initializationSteps.layersCreated = true;
            
            // Step 5: DrawContainer準備完了確認
            if (!this.v8DrawingContainer) {
                throw new Error('DrawContainer creation failed');
            }
            this.v8Features.drawContainerReady = true;
            this.initializationSteps.drawContainerReady = true;
            
            // Step 6: レイヤー検証
            this.validateV8Layers();
            this.initializationSteps.validated = true;
            
            // Step 7: リアルタイム描画設定
            this.enableRealtimeDrawing();
            
            // Step 8: 完全初期化完了
            this.v8Ready = true;
            this.initialized = true;
            this.initializationSteps.complete = true;
            
            // 最終確認
            this.verifyFullInitialization();
            
            // DOM要素のサイズも確実に設定
            if (this.pixiApp.canvas) {
                this.pixiApp.canvas.style.width = this.defaultWidth + 'px';
                this.pixiApp.canvas.style.height = this.defaultHeight + 'px';
            }
            
            console.log(`CanvasManager: initialization complete (logical ${this.defaultWidth}x${this.defaultHeight}, DPR ${this.effectiveDPR})`);
            
        } catch (error) {
            console.error('💀 CanvasManager初期化エラー:', error);
            this.handleV8InitializationError(error);
            throw error;
        }
    }
    
    /**
     * 完全初期化確認（修正版）
     */
    verifyFullInitialization() {
        const checks = {
            pixiApp: !!this.pixiApp,
            stage: !!this.pixiApp?.stage,
            rendererType: !!this.rendererType,
            v8DrawingContainer: !!this.v8DrawingContainer,
            layerMain: this.layers.has('main'),
            layer0: this.layers.has('layer0'),
            layer1: this.layers.has('layer1'),
            getDrawContainerMethod: typeof this.getDrawContainer === 'function',
            drawContainerReady: this.v8Features.drawContainerReady,
            v8Ready: this.v8Ready,
            allStepsComplete: Object.values(this.initializationSteps).every(step => step === true)
        };
        
        const failedChecks = Object.entries(checks)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
        
        if (failedChecks.length > 0) {
            throw new Error(`CanvasManager initialization incomplete: ${failedChecks.join(', ')}`);
        }
    }
    
    /**
     * DPR制限適用（巨大キャンバス防止）
     */
    applyDPRLimit() {
        const deviceDPR = window.devicePixelRatio || 1;
        this.effectiveDPR = Math.min(deviceDPR, this.maxDPR);
        
        if (this.pixiApp?.renderer) {
            this.pixiApp.renderer.resolution = this.effectiveDPR;
        }
        
        this.v8Features.dprLimited = true;
    }
    
    /**
     * v8描画Container作成（確実化版）
     */
    createV8DrawingContainer() {
        console.log('CanvasManager: layers created (layer0, layer1, interactionOverlay)');
        
        if (!this.pixiApp?.stage) {
            throw new Error('v8 Application stage not available for layer creation');
        }
        
        // ステージのContainer機能有効化
        this.pixiApp.stage.sortableChildren = true;
        this.pixiApp.stage.interactiveChildren = true;
        
        // layer0: 背景レイヤー
        const backgroundLayer = this.createLayerV8('layer0', { 
            zIndex: 0, 
            background: true,
            color: this.backgroundColor
        });
        
        // layer1: 描画レイヤー
        const drawingLayer = this.createLayerV8('layer1', { 
            zIndex: 1, 
            drawing: true,
            sortableChildren: true
        });
        
        // interactionOverlay: インタラクション用レイヤー
        const interactionLayer = this.createLayerV8('interactionOverlay', {
            zIndex: 2,
            interactive: true
        });
        
        // main: layer1のエイリアス
        this.layers.set('main', drawingLayer);
        
        // v8描画Container設定（確実化）
        this.v8DrawingContainer = drawingLayer;
        
        if (!this.v8DrawingContainer) {
            throw new Error('v8DrawingContainer assignment failed');
        }
        
        // レイヤー検証（基本）
        this.validateLayerCreation();
        
        this.v8Features.containerHierarchy = true;
    }
    
    /**
     * レイヤー作成検証（即座実行）
     */
    validateLayerCreation() {
        if (!this.layers.has('layer0')) {
            throw new Error('layer0 creation failed');
        }
        if (!this.layers.has('layer1')) {
            throw new Error('layer1 creation failed');
        }
        if (!this.layers.has('main')) {
            throw new Error('main layer alias creation failed');
        }
        if (this.layers.get('main') !== this.layers.get('layer1')) {
            throw new Error('main layer alias verification failed');
        }
    }
    
    /**
     * v8描画Container取得（確実版・AppCore連携用）
     */
    getDrawContainer() {
        // 初期化状態確認
        if (!this.initializationSteps.complete) {
            const incompleteSteps = Object.entries(this.initializationSteps)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            throw new Error(`CanvasManager not fully initialized. Incomplete steps: ${incompleteSteps.join(', ')}`);
        }
        
        if (!this.v8DrawingContainer) {
            throw new Error('v8 Drawing Container not available - initialization failed');
        }
        
        if (!this.v8Features.drawContainerReady) {
            throw new Error('v8 Drawing Container not ready - initialization in progress');
        }
        
        // Container有効性確認
        if (!this.v8DrawingContainer.stage && !this.v8DrawingContainer.parent) {
            throw new Error('v8 Drawing Container not attached to stage');
        }
        
        return this.v8DrawingContainer;
    }
    
    /**
     * v8 Containerレイヤー作成（400x400サイズ対応）
     */
    createLayerV8(layerId, options = {}) {
        const layer = new PIXI.Container();
        layer.name = layerId;
        layer.sortableChildren = options.sortableChildren !== false;
        layer.interactiveChildren = options.interactiveChildren !== false;
        layer.zIndex = options.zIndex ?? this.layers.size;
        
        // v8高度なContainer機能設定
        if (options.mask) layer.mask = options.mask;
        if (options.filters) layer.filters = options.filters;
        if (options.blendMode) layer.blendMode = options.blendMode;
        if (options.alpha !== undefined) layer.alpha = options.alpha;
        if (options.visible !== undefined) layer.visible = options.visible;
        
        // 背景レイヤーの場合は背景Graphics作成（400x400固定）
        if (options.background && options.color !== undefined) {
            const backgroundGraphics = new PIXI.Graphics();
            backgroundGraphics.rect(0, 0, this.defaultWidth, this.defaultHeight);
            backgroundGraphics.fill({ color: options.color, alpha: 1.0 });
            
            layer.addChild(backgroundGraphics);
        }
        
        // ステージに追加
        this.pixiApp.stage.addChild(layer);
        this.layers.set(layerId, layer);
        
        // Container階層自動ソート
        this.pixiApp.stage.sortChildren();
        
        return layer;
    }
    
    /**
     * リアルタイム描画機能有効化
     */
    enableRealtimeDrawing() {
        if (!this.pixiApp?.ticker) {
            console.warn('⚠️ PixiJS Ticker not available');
            return;
        }
        
        this.pixiApp.ticker.maxFPS = 60;
        this.pixiApp.ticker.minFPS = 30;
        
        if (this.pixiApp.renderer) {
            this.pixiApp.renderer.clearBeforeRender = true;
            this.pixiApp.renderer.preserveDrawingBuffer = false;
        }
        
        this.v8Features.realtimeDrawing = true;
    }
    
    /**
     * v8レイヤー検証（完全版）
     */
    validateV8Layers() {
        const requiredLayers = ['layer0', 'layer1', 'main'];
        const missingLayers = [];
        
        for (const layerId of requiredLayers) {
            if (!this.layers.has(layerId)) {
                missingLayers.push(layerId);
            }
        }
        
        if (missingLayers.length > 0) {
            throw new Error(`v8 Required layers missing: ${missingLayers.join(', ')}`);
        }
        
        // main layerエイリアス確認
        if (this.layers.get('main') !== this.layers.get('layer1')) {
            throw new Error('v8 main layer alias validation failed');
        }
        
        // v8描画Container確認
        if (!this.v8DrawingContainer) {
            throw new Error('v8 Drawing Container not set');
        }
        
        // getDrawContainer()メソッド利用可能確認
        if (typeof this.getDrawContainer !== 'function') {
            throw new Error('getDrawContainer() method not available');
        }
    }
    
    /**
     * v8 Graphics配置（即座反映・リアルタイム対応）
     */
    addGraphicsToLayerV8(graphics, layerId = null) {
        if (!graphics) {
            throw new Error('v8 Graphics object is required');
        }
        
        if (!this.isV8Ready()) {
            throw new Error('CanvasManager v8 not ready - call initializeV8Application() first');
        }
        
        const targetLayerId = layerId || this.activeLayerId;
        
        let layer = this.layers.get(targetLayerId);
        if (!layer) {
            if (targetLayerId === 'main') {
                throw new Error('v8 main layer not found - initialization failed');
            }
            
            layer = this.createLayerV8(targetLayerId);
        }
        
        layer.addChild(graphics);
        
        if (layer.sortableChildren) {
            layer.sortChildren();
        }
    }
    
    /**
     * キャンバスサイズ変更（400x400デフォルト・DPR制限対応）
     */
    resizeV8Canvas(width = 400, height = 400) {
        if (!this.pixiApp) {
            throw new Error('v8 PixiJS Application not available - cannot resize');
        }
        
        const deviceDPR = window.devicePixelRatio || 1;
        const limitedDPR = Math.min(deviceDPR, this.maxDPR);
        
        this.pixiApp.renderer.resize(width, height);
        this.pixiApp.renderer.resolution = limitedDPR;
        this.effectiveDPR = limitedDPR;
        
        // 背景レイヤーサイズ更新
        const backgroundLayer = this.layers.get('layer0');
        if (backgroundLayer && backgroundLayer.children.length > 0) {
            const backgroundGraphics = backgroundLayer.children[0];
            if (backgroundGraphics instanceof PIXI.Graphics) {
                backgroundGraphics.clear();
                backgroundGraphics.rect(0, 0, width, height);
                backgroundGraphics.fill({ color: this.backgroundColor, alpha: 1.0 });
            }
        }
        
        // DOM要素のサイズも更新
        if (this.pixiApp.canvas) {
            this.pixiApp.canvas.style.width = width + 'px';
            this.pixiApp.canvas.style.height = height + 'px';
        }
    }
    
    /**
     * v8初期化エラーハンドリング
     */
    handleV8InitializationError(error) {
        console.error('💀 v8初期化エラー:', error);
        
        if (window.Tegaki?.ErrorManagerInstance?.showError) {
            window.Tegaki.ErrorManagerInstance.showError(
                'PixiJS v8初期化失敗', 
                error.message
            );
        }
    }
    
    /**
     * v8対応状況確認（完全版）
     */
    isV8Ready() {
        return this.v8Ready && 
               this.initialized &&
               this.initializationSteps.complete &&
               !!this.pixiApp && 
               !!this.rendererType &&
               !!this.v8DrawingContainer &&
               this.layers.has('main') &&
               this.layers.has('layer0') &&
               this.layers.has('layer1') &&
               this.v8Features.dprLimited &&
               this.v8Features.drawContainerReady &&
               typeof this.getDrawContainer === 'function';
    }
    
    /**
     * レイヤー取得
     */
    getLayer(layerId) {
        const layer = this.layers.get(layerId);
        
        if (!layer && layerId === 'main') {
            throw new Error('v8 main layer not found - CanvasManager not initialized');
        }
        
        return layer || null;
    }
    
    /**
     * メインレイヤー取得
     */
    getMainLayer() {
        const mainLayer = this.layers.get('main');
        if (!mainLayer) {
            throw new Error('v8 main layer not found - initialization failed');
        }
        return mainLayer;
    }
    
    /**
     * キャンバス要素取得
     */
    getCanvasElement() {
        if (!this.pixiApp?.canvas) {
            throw new Error('v8 CanvasManager: canvas element not available');
        }
        return this.pixiApp.canvas;
    }
    
    /**
     * アクティブレイヤークリア
     */
    clear() {
        const activeLayer = this.layers.get(this.activeLayerId);
        if (activeLayer && this.activeLayerId !== 'layer0') {
            activeLayer.removeChildren();
        }
    }
    
    /**
     * WebGPU使用状況取得
     */
    getWebGPUStatus() {
        return {
            supported: this.webgpuSupported,
            active: this.rendererType === 'webgpu',
            rendererType: this.rendererType
        };
    }
    
    /**
     * v8専用デバッグ情報（簡略版）
     */
    getV8DebugInfo() {
        return {
            className: 'CanvasManager',
            version: 'v8.12.0',
            v8Ready: this.v8Ready,
            initialized: this.initialized,
            pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
            rendererInfo: {
                type: this.rendererType,
                webgpuSupported: this.webgpuSupported,
                webgpuActive: this.rendererType === 'webgpu'
            },
            drawContainerInfo: {
                v8DrawingContainer: !!this.v8DrawingContainer,
                drawContainerReady: this.v8Features.drawContainerReady,
                getDrawContainerMethod: typeof this.getDrawContainer === 'function'
            },
            layerInfo: {
                totalLayers: this.layers.size,
                layerNames: Array.from(this.layers.keys()),
                activeLayer: this.activeLayerId,
                mainLayerValid: this.layers.get('main') === this.layers.get('layer1')
            },
            canvasInfo: this.pixiApp ? {
                width: this.pixiApp.screen.width,
                height: this.pixiApp.screen.height,
                resolution: this.pixiApp.renderer.resolution,
                backgroundColor: '0x' + this.backgroundColor.toString(16),
                defaultSize: `${this.defaultWidth}x${this.defaultHeight}`
            } : null
        };
    }
    
    /**
     * v7互換デバッグ情報
     */
    getDebugInfo() {
        return this.getV8DebugInfo();
    }
    
    /**
     * 初期化状態確認
     */
    isReady() {
        return this.isV8Ready();
    }
    
    /**
     * PixiJS Application取得
     */
    getPixiApp() {
        return this.pixiApp;
    }
}

// グローバル公開
window.Tegaki.CanvasManager = CanvasManager;
console.log('🚀 CanvasManager v8.12.0完全対応版 Loaded - 400x400デフォルト・コンソール削減・描画修正版');