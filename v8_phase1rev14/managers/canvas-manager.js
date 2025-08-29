/**
 * 🚀 CanvasManager - PixiJS v8.12.0完全対応版（WebGPU・Container階層・リアルタイム描画・DPR制限対応・getDrawContainer追加）
 * 📋 RESPONSIBILITY: PixiJS v8 Application管理・WebGPU対応・Container階層レイヤー管理・v8機能フル活用・DPR制限・ToolManager連携
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な初期化・ツール制御・エラー隠蔽・フォールバック・DPR倍加処理・ToolManager逆参照
 * ✅ PERMISSION: v8 Application管理・WebGPU自動選択・Container階層管理・v8レンダラー制御・DPR制限適用・描画Container提供
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Application中心・WebGPU優先・Container階層によるレイヤー管理・リアルタイム対応・DPR制限・単方向依存
 * 🔄 INTEGRATION: AppCore→initializeV8Application→getDrawContainer提供→ToolManager連携・EventBus通知のみ
 * 🚀 V8_MIGRATION: 非同期初期化・WebGPU自動選択・Container階層・@pixi/layers削除対応・DPR制限機能・ToolManager単方向連携
 * 
 * 📌 提供メソッド一覧（v8対応・実装確認済み）:
 * ✅ async initializeV8Application(pixiApp) - v8 Application設定・レイヤー自動作成（修正版）
 * ✅ createV8DrawingContainer() - v8描画Container作成
 * ✅ getV8DrawingContainer() - v8描画Container取得（レガシー）
 * ✅ getDrawContainer() - v8描画Container取得（AppCore連携用・新規追加）🚨修正
 * ✅ resizeV8Canvas(width, height) - DPR制限対応キャンバスリサイズ（修正版）
 * ✅ addGraphicsToLayerV8(graphics, layerId) - v8 Graphics配置・即座反映
 * ✅ isV8Ready() - v8対応状況確認
 * ✅ getWebGPUStatus() - WebGPU使用状況取得
 * ✅ getV8DebugInfo() - v8専用デバッグ情報
 * 
 * 📌 他ファイル呼び出しメソッド一覧（実装確認済み）:
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（確認済み）
 * ✅ new PIXI.Application() - v8 Application作成（PixiJS v8.12.0）
 * ✅ new PIXI.Container() - Container作成（PixiJS v8.12.0）
 * ✅ new PIXI.Graphics() - Graphics作成（PixiJS v8.12.0）
 * ✅ await pixiApp.init() - v8非同期初期化（PixiJS v8.12.0）
 * 
 * 📐 v8初期化フロー（修正版）:
 * 開始 → v8 Application受信・確認 → WebGPU対応確認 → DPR制限設定 → 
 * Container階層作成(layer0,layer1,main) → v8描画Container作成・getDrawContainer準備🚨修正 → v8設定適用 → 
 * リアルタイム描画有効化 → 初期化完了通知 → 終了
 * 🚨修正済み依存関係: PixiJS v8.12.0(基盤)→CanvasManager完全初期化→getDrawContainer利用可能→AppCore→ToolManager連携
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係（動作に必須）
 * - this.pixiApp !== null - v8 Application設定完了必須
 * - this.rendererType !== null - WebGPU/WebGL確定必須
 * - this.layers.get('main') !== null - main layer存在必須
 * - this.webgpuSupported !== null - WebGPU対応状況確定必須
 * - this.v8DrawingContainer !== null - v8描画Container作成必須🚨修正
 * - getDrawContainer() method available - AppCore連携必須🚨新規追加
 * 
 * 🔧 V8_INITIALIZATION_ORDER: v8初期化順序（修正版・厳守必要）
 * 1. v8 Application受信・null確認
 * 2. WebGPU対応状況確認・記録
 * 3. DPR制限設定（max 2.0）・巨大キャンバス防止
 * 4. Container階層作成・zIndex設定
 * 5. v8描画Container作成・getDrawContainer準備🚨修正
 * 6. リアルタイム描画機能有効化
 * 7. 初期化完了フラグ設定・通知
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - v7 APIとの混在使用（PIXI.Application(options)等）
 * - @pixi/layers・@pixi/graphics-smooth使用継続
 * - WebGPU非対応時のフォールバック複雑化
 * - Container階層無視・従来レイヤー方式継続
 * - 🚨修正済み DPR未制限・巨大キャンバス生成許可
 * - v8機能を活用しない旧来処理継続
 * - ToolManagerへの逆参照・双方向依存🚨新規追加
 * 
 * 🔑 Manager登録キー: "canvas"（AppCore統一登録用）
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * CanvasManager - PixiJS v8.12.0完全対応版
 * WebGPU自動選択・Container階層・リアルタイム描画対応・DPR制限機能・AppCore連携強化
 */
class CanvasManager {
    constructor() {
        console.log('🚀 CanvasManager v8.12.0対応版作成開始');
        
        this.pixiApp = null;
        this.layers = new Map();
        this.initialized = false;
        this.v8Ready = false;
        this.activeLayerId = 'layer1'; // デフォルトアクティブレイヤー
        
        // v8専用プロパティ
        this.rendererType = null; // 'webgpu' | 'webgl'
        this.webgpuSupported = null; // WebGPU対応状況
        this.v8Features = {
            webgpuEnabled: false,
            containerHierarchy: false,
            realtimeDrawing: false,
            asyncInitialization: false,
            dprLimited: false, // 🚨 修正: DPR制限機能追加
            drawContainerReady: false // 🚨 新規追加: getDrawContainer準備状況
        };
        
        // 🚨 修正: DPR制限設定
        this.maxDPR = 2.0; // DPR制限値
        this.effectiveDPR = 1.0; // 実際に使用するDPR値
        
        // v8描画Container（ToolManager連携用）
        this.v8DrawingContainer = null;
        
        // 背景色設定（ふたばクリーム）
        this.backgroundColor = 0xf0e0d6; // #f0e0d6
        
        console.log('🚀 CanvasManager v8.12.0対応版作成完了');
    }
    
    /**
     * 🚨 修正版 - v8 Application設定・レイヤー自動作成（AppCore連携用）
     */
    async initializeV8Application(pixiApp) {
        if (!pixiApp) {
            throw new Error('v8 PixiJS Application is required');
        }
        
        if (!pixiApp.stage) {
            throw new Error('v8 PixiJS Application has no stage');
        }
        
        console.log('🚀 CanvasManager: v8 Application設定開始');
        
        this.pixiApp = pixiApp;
        this.rendererType = pixiApp.renderer.type;
        
        // WebGPU状況確認
        this.webgpuSupported = this.rendererType === 'webgpu';
        if (this.webgpuSupported) {
            this.v8Features.webgpuEnabled = true;
            console.log('📊 WebGPU renderer confirmed');
        } else {
            console.log('📊 WebGL renderer confirmed');
        }
        
        // 🚨 修正: DPR制限設定
        this.applyDPRLimit();
        
        // v8レイヤー自動作成
        this.createV8DrawingContainer();
        
        // リアルタイム描画準備
        this.enableRealtimeDrawing();
        
        this.v8Ready = true;
        this.initialized = true;
        
        // v8設定完了通知
        this.notifyV8Initialization();
        
        console.log('✅ CanvasManager: v8 Application設定完了');
    }
    
    /**
     * 🚨 修正: DPR制限適用（巨大キャンバス防止）
     */
    applyDPRLimit() {
        const deviceDPR = window.devicePixelRatio || 1;
        this.effectiveDPR = Math.min(deviceDPR, this.maxDPR);
        
        console.log(`🔧 DPR制限適用: ${deviceDPR} → ${this.effectiveDPR} (max: ${this.maxDPR})`);
        
        // レンダラーの解像度をDPR制限値に設定
        if (this.pixiApp?.renderer) {
            this.pixiApp.renderer.resolution = this.effectiveDPR;
            console.log(`✅ レンダラー解像度設定: ${this.effectiveDPR}`);
        }
        
        this.v8Features.dprLimited = true;
    }
    
    /**
     * 🚨 修正版 - v8描画Container作成（ToolManager連携強化・getDrawContainer準備）
     */
    createV8DrawingContainer() {
        console.log('🎨 v8 Container階層レイヤー作成開始');
        
        if (!this.pixiApp?.stage) {
            throw new Error('v8 Application stage not available for layer creation');
        }
        
        // ステージのContainer機能有効化
        this.pixiApp.stage.sortableChildren = true;
        this.pixiApp.stage.interactiveChildren = true;
        
        // layer0: 背景レイヤー（v8 Container）
        const backgroundLayer = this.createLayerV8('layer0', { 
            zIndex: 0, 
            background: true,
            color: this.backgroundColor
        });
        console.log('✅ v8背景レイヤー (layer0) 作成完了');
        
        // layer1: 描画レイヤー（v8 Container）
        const drawingLayer = this.createLayerV8('layer1', { 
            zIndex: 1, 
            drawing: true,
            sortableChildren: true
        });
        console.log('✅ v8描画レイヤー (layer1) 作成完了');
        
        // main: layer1のエイリアス（v7互換性）
        this.layers.set('main', drawingLayer);
        console.log('✅ v8メインレイヤー (main) エイリアス設定完了 → layer1');
        
        // 🚨 修正: v8描画Container設定（ToolManager連携用・getDrawContainer準備）
        this.v8DrawingContainer = drawingLayer;
        this.v8Features.drawContainerReady = true;
        console.log('✅ v8描画Container設定完了（ToolManager連携用・getDrawContainer準備完了）');
        
        // v8レイヤー検証
        this.validateV8Layers();
        
        console.log('🎨 v8 Container階層レイヤー作成完了');
        
        this.v8Features.containerHierarchy = true;
    }
    
    /**
     * 🚨 新規追加 - v8描画Container取得（AppCore連携用・標準メソッド名）
     */
    getDrawContainer() {
        if (!this.v8DrawingContainer) {
            throw new Error('v8 Drawing Container not available - call initializeV8Application() first');
        }
        
        if (!this.v8Features.drawContainerReady) {
            throw new Error('v8 Drawing Container not ready - initialization in progress');
        }
        
        console.log('📦 v8描画Container取得完了（AppCore連携用）');
        return this.v8DrawingContainer;
    }
    
    /**
     * 🚨 修正版 - v8描画Container取得（ToolManager連携用・レガシー名維持）
     */
    getV8DrawingContainer() {
        // 新しいgetDrawContainer()に委譲
        return this.getDrawContainer();
    }
    
    /**
     * 🚀 v8 Container レイヤー作成（高度なオプション対応）
     */
    createLayerV8(layerId, options = {}) {
        console.log(`🎨 v8レイヤー作成: ${layerId}`);
        
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
        
        // 背景レイヤーの場合は背景Graphics作成
        if (options.background && options.color !== undefined) {
            const backgroundGraphics = this.createBackgroundGraphicsV8(options.color);
            layer.addChild(backgroundGraphics);
        }
        
        // ステージに追加・zIndex適用
        this.pixiApp.stage.addChild(layer);
        this.layers.set(layerId, layer);
        
        // v8: Container階層自動ソート
        this.pixiApp.stage.sortChildren();
        
        console.log(`✅ v8レイヤー作成完了: ${layerId} (zIndex: ${layer.zIndex})`);
        return layer;
    }
    
    /**
     * 🚀 v8背景Graphics作成
     */
    createBackgroundGraphicsV8(color) {
        const graphics = new PIXI.Graphics();
        
        // v8新記法：fill設定
        graphics.rect(0, 0, this.pixiApp.screen.width, this.pixiApp.screen.height);
        graphics.fill({ color: color, alpha: 1.0 });
        
        return graphics;
    }
    
    /**
     * 🚀 リアルタイム描画機能有効化
     */
    enableRealtimeDrawing() {
        console.log('⚡ v8リアルタイム描画機能有効化');
        
        if (!this.pixiApp?.ticker) {
            console.warn('⚠️ PixiJS Ticker not available');
            return;
        }
        
        // v8: 高フレームレート設定
        this.pixiApp.ticker.maxFPS = 60;
        this.pixiApp.ticker.minFPS = 30;
        
        // v8: レンダラー最適化
        if (this.pixiApp.renderer) {
            this.pixiApp.renderer.clearBeforeRender = true;
            this.pixiApp.renderer.preserveDrawingBuffer = false;
        }
        
        console.log('✅ v8リアルタイム描画機能有効化完了');
        this.v8Features.realtimeDrawing = true;
    }
    
    /**
     * 🚀 v8レイヤー検証（getDrawContainer準備確認追加）
     */
    validateV8Layers() {
        console.log('🔍 v8レイヤー検証開始');
        
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
        
        // 🚨 新規追加: getDrawContainer()メソッド利用可能確認
        if (typeof this.getDrawContainer !== 'function') {
            throw new Error('getDrawContainer() method not available');
        }
        
        // 🚨 新規追加: getDrawContainer()実行確認
        try {
            const testContainer = this.getDrawContainer();
            if (!testContainer) {
                throw new Error('getDrawContainer() returns null');
            }
            console.log('✅ getDrawContainer()メソッド動作確認完了');
        } catch (error) {
            throw new Error(`getDrawContainer() validation failed: ${error.message}`);
        }
        
        console.log('✅ v8レイヤー検証完了');
    }
    
    /**
     * 🚀 v8 Graphics配置（即座反映・リアルタイム対応）
     */
    addGraphicsToLayerV8(graphics, layerId = null) {
        if (!graphics) {
            throw new Error('v8 Graphics object is required');
        }
        
        if (!this.v8Ready) {
            throw new Error('CanvasManager v8 not ready - call initializeV8Application() first');
        }
        
        // layerIdが指定されていない場合はアクティブレイヤーを使用
        const targetLayerId = layerId || this.activeLayerId;
        
        let layer = this.layers.get(targetLayerId);
        if (!layer) {
            if (targetLayerId === 'main') {
                throw new Error('v8 main layer not found - initialization failed');
            }
            
            // レイヤーが見つからない場合は作成
            console.log(`📦 v8レイヤー自動作成: ${targetLayerId}`);
            layer = this.createLayerV8(targetLayerId);
        }
        
        // v8: Graphics即座配置
        layer.addChild(graphics);
        
        // v8: Container階層自動ソート（zIndex適用）
        if (layer.sortableChildren) {
            layer.sortChildren();
        }
        
        console.log(`✅ v8 Graphics配置完了: ${targetLayerId} (children: ${layer.children.length})`);
        
        // v8描画デバッグ情報
        console.log('🔧 v8 Graphics Info:', {
            visible: graphics.visible,
            alpha: graphics.alpha,
            bounds: graphics.getBounds(),
            layerZIndex: layer.zIndex,
            rendererType: this.rendererType
        });
    }
    
    /**
     * 🚨 修正版 - キャンバスサイズ変更（DPR制限対応）
     */
    resizeV8Canvas(width, height) {
        if (!this.pixiApp) {
            throw new Error('v8 PixiJS Application not available - cannot resize');
        }
        
        console.log(`🎨 v8キャンバスサイズ変更開始: ${width}x${height}`);
        
        // 🚨 修正: DPR制限適用（巨大キャンバス防止）
        const deviceDPR = window.devicePixelRatio || 1;
        const limitedDPR = Math.min(deviceDPR, this.maxDPR);
        
        console.log(`🔧 DPR制限: デバイス ${deviceDPR} → 使用 ${limitedDPR}`);
        
        // v8: レンダラーサイズ変更（論理サイズ・DPR制限適用）
        this.pixiApp.renderer.resize(width, height);
        
        // レンダラー解像度をDPR制限値に設定
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
        
        console.log(`✅ v8キャンバスサイズ変更完了: ${width}x${height} (DPR: ${limitedDPR})`);
    }
    
    /**
     * 🚀 v8初期化完了通知
     */
    notifyV8Initialization() {
        // EventBusにv8初期化完了を通知
        if (window.Tegaki?.EventBusInstance?.emit) {
            window.Tegaki.EventBusInstance.emit('canvasManagerV8Ready', {
                rendererType: this.rendererType,
                webgpuSupported: this.webgpuSupported,
                features: this.v8Features,
                dprInfo: {
                    device: window.devicePixelRatio || 1,
                    effective: this.effectiveDPR,
                    limited: this.maxDPR
                },
                drawContainerReady: this.v8Features.drawContainerReady
            });
        }
        
        // v8ステータス表示更新
        if (window.updateV8Status) {
            window.updateV8Status(this.rendererType, this.webgpuSupported);
        }
        
        console.log('📡 v8初期化完了通知送信');
    }
    
    /**
     * 🚀 v8初期化エラーハンドリング
     */
    handleV8InitializationError(error) {
        console.error('💀 v8初期化エラー:', error);
        
        // ErrorManagerにエラー通知
        if (window.Tegaki?.ErrorManagerInstance?.showError) {
            window.Tegaki.ErrorManagerInstance.showError(
                'PixiJS v8初期化失敗', 
                error.message
            );
        }
        
        // v8ステータス表示エラー
        const statusEl = document.getElementById('v8-renderer-type');
        const dotEl = document.getElementById('v8-dot');
        if (statusEl && dotEl) {
            statusEl.textContent = 'v8 Error';
            dotEl.className = 'v8-dot error';
        }
    }
    
    /**
     * レイヤー取得（v7互換維持）
     */
    getLayer(layerId) {
        const layer = this.layers.get(layerId);
        
        if (!layer && layerId === 'main') {
            throw new Error('v8 main layer not found - CanvasManager not initialized');
        }
        
        if (!layer) {
            console.warn(`⚠️ v8レイヤー未発見: ${layerId}`);
            console.log('📊 利用可能v8レイヤー:', Array.from(this.layers.keys()));
        }
        
        return layer || null;
    }
    
    /**
     * メインレイヤー取得（v7互換）
     */
    getMainLayer() {
        const mainLayer = this.layers.get('main');
        if (!mainLayer) {
            throw new Error('v8 main layer not found - initialization failed');
        }
        return mainLayer;
    }
    
    /**
     * キャンバス要素取得（v8対応）
     */
    getCanvasElement() {
        if (!this.pixiApp?.canvas) {
            throw new Error('v8 CanvasManager: canvas element not available');
        }
        
        // PixiJS v8のcanvas要素を返す
        return this.pixiApp.canvas;
    }
    
    /**
     * アクティブレイヤークリア（v8対応・背景保護）
     */
    clear() {
        const activeLayer = this.layers.get(this.activeLayerId);
        if (activeLayer && this.activeLayerId !== 'layer0') {
            activeLayer.removeChildren();
            console.log(`🧹 v8アクティブレイヤークリア完了: ${this.activeLayerId}`);
        } else {
            console.log('⚠️ v8背景レイヤークリア禁止');
        }
    }
    
    /**
     * 🚀 v8対応状況確認（修正版・getDrawContainer確認追加）
     */
    isV8Ready() {
        return this.v8Ready && 
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
     * 🚀 WebGPU使用状況取得
     */
    getWebGPUStatus() {
        return {
            supported: this.webgpuSupported,
            active: this.rendererType === 'webgpu',
            rendererType: this.rendererType
        };
    }
    
    /**
     * 🚨 修正版 - v8専用デバッグ情報（getDrawContainer情報追加）
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
            dprInfo: {
                device: window.devicePixelRatio || 1,
                maxLimit: this.maxDPR,
                effective: this.effectiveDPR,
                limited: this.v8Features.dprLimited
            },
            drawContainerInfo: {
                v8DrawingContainer: !!this.v8DrawingContainer,
                drawContainerReady: this.v8Features.drawContainerReady,
                getDrawContainerMethod: typeof this.getDrawContainer === 'function',
                getV8DrawingContainerMethod: typeof this.getV8DrawingContainer === 'function'
            },
            layerInfo: {
                totalLayers: this.layers.size,
                layerNames: Array.from(this.layers.keys()),
                activeLayer: this.activeLayerId,
                mainLayerValid: this.layers.get('main') === this.layers.get('layer1'),
                v8DrawingContainer: !!this.v8DrawingContainer
            },
            v8Features: this.v8Features,
            containerHierarchy: {
                stageChildren: this.pixiApp?.stage.children.length || 0,
                stageSortable: this.pixiApp?.stage.sortableChildren || false,
                stageInteractive: this.pixiApp?.stage.interactiveChildren || false
            },
            canvasInfo: this.pixiApp ? {
                width: this.pixiApp.screen.width,
                height: this.pixiApp.screen.height,
                resolution: this.pixiApp.renderer.resolution,
                backgroundColor: '0x' + this.backgroundColor.toString(16)
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
     * 初期化状態確認（v8対応）
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
    
    /**
     * アクティブレイヤー取得
     */
    getActiveLayer() {
        const layer = this.layers.get(this.activeLayerId);
        if (!layer) {
            throw new Error(`v8 Active layer not found: ${this.activeLayerId}`);
        }
        return layer;
    }
    
    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerId) {
        if (!this.layers.has(layerId)) {
            throw new Error(`v8 Cannot set active layer: ${layerId} does not exist`);
        }
        
        this.activeLayerId = layerId;
        console.log(`🎯 v8アクティブレイヤー設定: ${layerId}`);
    }
    
    /**
     * DPR制限設定変更
     */
    setMaxDPR(newMaxDPR) {
        if (newMaxDPR <= 0 || newMaxDPR > 4) {
            throw new Error('DPR limit must be between 0 and 4');
        }
        
        const oldMaxDPR = this.maxDPR;
        this.maxDPR = newMaxDPR;
        
        // 現在のDPRを再計算
        const deviceDPR = window.devicePixelRatio || 1;
        const newEffectiveDPR = Math.min(deviceDPR, this.maxDPR);
        
        console.log(`🔧 DPR制限変更: ${oldMaxDPR} → ${this.maxDPR}, 有効DPR: ${this.effectiveDPR} → ${newEffectiveDPR}`);
        
        // レンダラーがある場合は解像度を更新
        if (this.pixiApp?.renderer) {
            this.pixiApp.renderer.resolution = newEffectiveDPR;
            this.effectiveDPR = newEffectiveDPR;
            console.log(`✅ レンダラー解像度更新: ${newEffectiveDPR}`);
        }
    }
    
    /**
     * DPR情報取得
     */
    getDPRInfo() {
        return {
            device: window.devicePixelRatio || 1,
            maxLimit: this.maxDPR,
            effective: this.effectiveDPR,
            limited: this.v8Features.dprLimited,
            canvasSize: this.pixiApp ? {
                logical: { width: this.pixiApp.screen.width, height: this.pixiApp.screen.height },
                physical: { 
                    width: this.pixiApp.screen.width * this.effectiveDPR, 
                    height: this.pixiApp.screen.height * this.effectiveDPR 
                }
            } : null
        };
    }
}

// グローバル公開
window.Tegaki.CanvasManager = CanvasManager;
console.log('🚀 CanvasManager v8.12.0完全対応版 Loaded - WebGPU・Container階層・リアルタイム描画対応');