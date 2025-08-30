/**
 * 📄 FILE: managers/canvas-manager.js
 * 📌 RESPONSIBILITY: PixiJS v8 Application管理・Container階層・Graphics分離管理
 *
 * @provides
 *   - initializeV8Application(pixiApp)
 *   - getDrawContainer()
 *   - createStrokeGraphics(strokeId)
 *   - addPermanentGraphics(graphics)
 *   - clearTemporaryGraphics()
 *   - clientToCanvasPixel(clientX, clientY)
 *   - getCanvasElement()
 *   - isV8Ready()
 *   - getPixiApp()
 *
 * @uses
 *   - PIXI.Application
 *   - PIXI.Container
 *   - PIXI.Graphics
 *   - window.Tegaki.ErrorManagerInstance.showError
 *   - HTMLCanvasElement.getBoundingClientRect
 *
 * @initflow
 *   1. constructor → 2. initializeV8Application → 3. createV8DrawingContainer → 
 *   4. getDrawContainer利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8両対応二重管理禁止
 *   🚫 過度なconsole.log禁止
 *
 * @manager-key
 *   window.Tegaki.CanvasManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0
 *   OPTIONAL: ErrorManager, EventBus
 *   FORBIDDEN: Tool直接依存
 *
 * @integration-flow
 *   AppCore → initializeV8Application → ToolManager注入可能
 *
 * @method-naming-rules
 *   初期化系: initializeV8Application()
 *   取得系: getDrawContainer() / getCanvasElement()
 *   作成系: createStrokeGraphics() / addPermanentGraphics()
 *   座標系: clientToCanvasPixel()
 *
 * @error-handling
 *   初期化失敗時は例外スロー、フォールバック禁止
 *
 * @performance-notes
 *   WebGPU対応、DPR制限で巨大キャンバス防止、Container階層最適化
 *   Graphics分離でメモリリーク防止
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * CanvasManager - PixiJS v8.12.0完全対応版
 * Graphics分離管理・座標変換支援・描画消失問題解決版
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
        
        // Graphics管理（描画消失問題解決用）
        this.permanentGraphics = new Map(); // strokeId -> Graphics
        this.temporaryGraphics = null;
        this.graphicsIdCounter = 0;
        
        // v8専用プロパティ
        this.rendererType = null;
        this.webgpuSupported = null;
        this.v8DrawingContainer = null;
        
        // DPR制限設定
        this.maxDPR = 2.0;
        this.effectiveDPR = 1.0;
        
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
            
            // Step 2: DPR制限設定
            this.applyDPRLimit();
            
            // Step 3: キャンバスサイズを400x400に設定
            this.resizeV8Canvas(this.defaultWidth, this.defaultHeight);
            
            // Step 4: Container階層作成
            this.createV8DrawingContainer();
            
            // Step 5: Graphics管理システム初期化
            this.initializeGraphicsManagement();
            
            // Step 6: 完全初期化完了
            this.v8Ready = true;
            this.initialized = true;
            
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
     * DPR制限適用（巨大キャンバス防止）
     */
    applyDPRLimit() {
        const deviceDPR = window.devicePixelRatio || 1;
        this.effectiveDPR = Math.min(deviceDPR, this.maxDPR);
        
        if (this.pixiApp?.renderer) {
            this.pixiApp.renderer.resolution = this.effectiveDPR;
        }
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
    }
    
    /**
     * Graphics管理システム初期化（描画消失問題解決用）
     */
    initializeGraphicsManagement() {
        // 一時描画用Graphics作成
        this.temporaryGraphics = new PIXI.Graphics();
        this.temporaryGraphics.name = 'temporaryGraphics';
        
        // 描画コンテナに追加（最前面）
        if (this.v8DrawingContainer) {
            this.v8DrawingContainer.addChild(this.temporaryGraphics);
        }
        
        console.log('✅ Graphics管理システム初期化完了');
    }
    
    /**
     * v8描画Container取得（確実版・AppCore連携用）
     */
    getDrawContainer() {
        if (!this.v8Ready) {
            throw new Error('CanvasManager not fully initialized');
        }
        
        if (!this.v8DrawingContainer) {
            throw new Error('v8 Drawing Container not available - initialization failed');
        }
        
        return this.v8DrawingContainer;
    }
    
    /**
     * ストローク専用Graphics作成（描画消失問題解決）
     */
    createStrokeGraphics(strokeId) {
        if (!strokeId) {
            strokeId = 'stroke_' + (++this.graphicsIdCounter) + '_' + Date.now();
        }
        
        const graphics = new PIXI.Graphics();
        graphics.name = strokeId;
        
        // 永続Graphicsとして記録
        this.permanentGraphics.set(strokeId, graphics);
        
        return graphics;
    }
    
    /**
     * 永続Graphics追加（確定描画用）
     */
    addPermanentGraphics(graphics) {
        if (!graphics) {
            throw new Error('Graphics object is required');
        }
        
        if (!this.v8DrawingContainer) {
            throw new Error('Drawing container not available');
        }
        
        // 描画コンテナに追加（永続レイヤー）
        this.v8DrawingContainer.addChild(graphics);
        
        // 一時Graphicsを最前面に維持
        if (this.temporaryGraphics && this.temporaryGraphics.parent) {
            this.v8DrawingContainer.setChildIndex(
                this.temporaryGraphics, 
                this.v8DrawingContainer.children.length - 1
            );
        }
        
        return true;
    }
    
    /**
     * 一時Graphics取得（リアルタイム描画用）
     */
    getTemporaryGraphics() {
        return this.temporaryGraphics;
    }
    
    /**
     * 一時Graphicsクリア（新しい描画開始時）
     */
    clearTemporaryGraphics() {
        if (this.temporaryGraphics) {
            this.temporaryGraphics.clear();
        }
    }
    
    /**
     * DOM座標をCanvas backing pixel座標に変換（座標ズレ問題解決用）
     */
    clientToCanvasPixel(clientX, clientY) {
        const canvas = this.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        // CSS表示サイズベースの座標計算
        const cssX = clientX - rect.left;
        const cssY = clientY - rect.top;
        
        // devicePixelRatioを考慮してbacking pixelに変換
        const dpr = this.effectiveDPR;
        const backingX = cssX * dpr;
        const backingY = cssY * dpr;
        
        return { x: backingX, y: backingY };
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
               !!this.pixiApp && 
               !!this.rendererType &&
               !!this.v8DrawingContainer &&
               this.layers.has('main') &&
               this.layers.has('layer0') &&
               this.layers.has('layer1') &&
               !!this.temporaryGraphics;
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
     * アクティブレイヤークリア（永続Graphicsは保持）
     */
    clear() {
        // 一時Graphicsのみクリア
        this.clearTemporaryGraphics();
        
        // 永続Graphics全削除（必要に応じて）
        if (confirm('全ての描画を削除しますか？')) {
            this.clearAllPermanentGraphics();
        }
    }
    
    /**
     * 全永続Graphicsクリア
     */
    clearAllPermanentGraphics() {
        for (const [strokeId, graphics] of this.permanentGraphics) {
            if (graphics.parent) {
                graphics.parent.removeChild(graphics);
            }
            graphics.destroy();
        }
        this.permanentGraphics.clear();
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
            graphicsInfo: {
                permanentGraphicsCount: this.permanentGraphics.size,
                temporaryGraphicsReady: !!this.temporaryGraphics,
                graphicsIdCounter: this.graphicsIdCounter
            },
            drawContainerInfo: {
                v8DrawingContainer: !!this.v8DrawingContainer,
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
                effectiveDPR: this.effectiveDPR,
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
console.log('🚀 CanvasManager v8.12.0完全対応版 Loaded - Graphics分離管理・座標変換支援・描画消失問題解決版');