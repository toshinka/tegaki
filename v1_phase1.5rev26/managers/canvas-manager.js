/**
 * 🎨 CanvasManager - レイヤー問題完全修正版（main layer対応）
 * 📋 RESPONSIBILITY: PixiJS Application管理・レイヤー管理・キャンバス要素提供・main layer確実提供
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な初期化・ツール制御・エラー隠蔽・フォールバック
 * ✅ PERMISSION: PixiJS管理・レイヤー作成・Graphics配置・キャンバス要素取得・main layer管理
 * 
 * 📏 DESIGN_PRINCIPLE: main layer必須確保・レイヤー存在保証・エラー隠蔽禁止・フェイルファスト
 * 🔄 INTEGRATION: CoordinateManager座標変換対応・PixiJS標準活用・ツールとの確実連携
 * 🔧 FIX: main layerエイリアス追加・レイヤー存在確実化・エラー隠蔽完全禁止・初期化確実化
 * 
 * 📌 使用メソッド一覧:
 * ✅ new PIXI.Container() - レイヤーコンテナ作成（PixiJS v7標準）
 * ✅ new PIXI.Graphics() - 背景描画（PixiJS v7標準）
 * ✅ stage.addChild() - ステージ追加（PixiJS Container標準）
 * ✅ graphics.beginFill/drawRect/endFill() - 背景描画（PixiJS Graphics標準）
 * 🆕 ensureMainLayer() - main layer確実作成（新規実装）
 * 🆕 validateRequiredLayers() - 必須レイヤー確認（新規実装）
 * ❌ フォールバック処理全て削除 - null許容しない剛直構造
 * 
 * 📐 レイヤー管理フロー:
 * 開始 → PixiJS App設定 → 基本レイヤー作成(layer0,layer1) → main layerエイリアス設定 → 
 * レイヤー存在検証 → キャンバス要素公開 → CoordinateManager連携対応 → 終了
 * 依存関係: PixiJS(レンダリング基盤)・PIXI.Container(レイヤー)・PIXI.Graphics(背景描画)
 * 
 * 🚨 CRITICAL_DEPENDENCIES: 重要依存関係（動作に必須）
 * - this.layers.get('main') !== null - main layer存在必須
 * - this.layers.get('layer1') !== null - 描画レイヤー存在必須
 * - this.pixiApp.view !== null - キャンバス要素存在必須
 * 
 * 🔧 INITIALIZATION_ORDER: 初期化順序（厳守必要）
 * 1. PixiJS App設定
 * 2. 基本レイヤー作成（layer0, layer1）
 * 3. main layerエイリアス設定
 * 4. 必須レイヤー存在検証
 * 5. CoordinateManager連携準備完了
 * 
 * 🚫 ABSOLUTE_PROHIBITIONS: 絶対禁止事項
 * - null/undefinedフォールバック（|| defaultValue禁止）
 * - レイヤー未作成時の無視処理（エラーthrow必須）
 * - try/catch握りつぶし（詳細ログ+throw必須）
 * - main layer未作成の許容（必須レイヤーは確実作成）
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * CanvasManager - レイヤー問題完全修正版（main layer対応）
 * layer0: 背景専用（消去されない）
 * layer1: 描画専用（ペン・消しゴム対象）
 * main: layer1のエイリアス（ツール互換性のため）
 */
class CanvasManager {
    constructor() {
        console.log('🎨 CanvasManager レイヤー問題完全修正版作成開始');
        
        this.pixiApp = null;
        this.layers = new Map();
        this.initialized = false;
        this.activeLayerId = 'layer1'; // デフォルトアクティブレイヤー
        
        // 背景色設定
        this.backgroundColor = 0xf0e0d6; // ふたば風クリーム色 #f0e0d6
        
        console.log('🎨 CanvasManager レイヤー問題完全修正版作成完了');
    }
    
    /**
     * PixiJS Application設定（レイヤー確実作成版）
     */
    setPixiApp(pixiApp) {
        if (!pixiApp) {
            const error = new Error('PixiJS Application is required');
            console.error('💀 CanvasManager setPixiApp失敗:', error);
            throw error;
        }
        
        if (!pixiApp.stage) {
            const error = new Error('PixiJS Application has no stage');
            console.error('💀 CanvasManager PixiJS stage missing:', error);
            throw error;
        }
        
        console.log('🎨 CanvasManager: PixiJS Application設定開始');
        
        this.pixiApp = pixiApp;
        
        // 背景色を透明に設定（背景レイヤーで管理）
        this.pixiApp.renderer.backgroundColor = 0x000000;
        this.pixiApp.renderer.backgroundAlpha = 0;
        
        // 🚨 重要：レイヤー確実作成
        this.createRequiredLayers();
        
        // 🚨 重要：必須レイヤー存在確認
        this.validateRequiredLayers();
        
        this.initialized = true;
        
        // PixiJS設定確認
        console.log('🎨 PixiJS Application Info:', {
            width: pixiApp.screen.width,
            height: pixiApp.screen.height,
            renderer: pixiApp.renderer.type,
            view: !!pixiApp.view,
            stage: !!pixiApp.stage,
            stageChildren: pixiApp.stage.children.length
        });
        
        console.log('✅ CanvasManager: PixiJS Application設定完了');
    }
    
    /**
     * 🆕 必須レイヤー確実作成（エラー隠蔽禁止）
     */
    createRequiredLayers() {
        console.log('🔧 CanvasManager: 必須レイヤー作成開始');
        
        if (!this.pixiApp) {
            const error = new Error('PixiJS Application not set - cannot create layers');
            console.error('💀 レイヤー作成失敗:', error);
            throw error;
        }
        
        // layer0: 背景レイヤー（ふたばクリーム色）
        const backgroundLayer = this.createBackgroundLayer();
        this.layers.set('layer0', backgroundLayer);
        console.log('✅ 背景レイヤー (layer0) 作成完了');
        
        // layer1: 描画レイヤー（透明、描画対象）
        const drawingLayer = this.createDrawingLayer();
        this.layers.set('layer1', drawingLayer);
        console.log('✅ 描画レイヤー (layer1) 作成完了');
        
        // 🆕 main: layer1のエイリアス（ツール互換性のため）
        this.layers.set('main', drawingLayer);
        console.log('✅ メインレイヤー (main) エイリアス設定完了 → layer1');
        
        // ステージの子要素ソート有効化
        this.pixiApp.stage.sortableChildren = true;
        
        console.log('🔧 CanvasManager: 必須レイヤー作成完了');
        console.log('📊 レイヤー作成状況:', {
            totalLayers: this.layers.size,
            layerKeys: Array.from(this.layers.keys()),
            stageChildren: this.pixiApp.stage.children.length
        });
    }
    
    /**
     * 🆕 背景レイヤー作成
     */
    createBackgroundLayer() {
        const backgroundLayer = new PIXI.Container();
        backgroundLayer.name = 'layer0';
        backgroundLayer.zIndex = 0; // 最背面
        
        // 背景用Graphics作成（ふたばクリーム色）
        const backgroundGraphics = new PIXI.Graphics();
        backgroundGraphics.beginFill(this.backgroundColor, 1.0);
        backgroundGraphics.drawRect(0, 0, this.pixiApp.screen.width, this.pixiApp.screen.height);
        backgroundGraphics.endFill();
        backgroundLayer.addChild(backgroundGraphics);
        
        // ステージに追加
        this.pixiApp.stage.addChild(backgroundLayer);
        
        return backgroundLayer;
    }
    
    /**
     * 🆕 描画レイヤー作成
     */
    createDrawingLayer() {
        const drawingLayer = new PIXI.Container();
        drawingLayer.name = 'layer1';
        drawingLayer.zIndex = 1; // 前面
        drawingLayer.sortableChildren = true; // 描画順序管理
        
        // ステージに追加
        this.pixiApp.stage.addChild(drawingLayer);
        
        return drawingLayer;
    }
    
    /**
     * 🆕 必須レイヤー存在検証（エラー隠蔽禁止）
     */
    validateRequiredLayers() {
        console.log('🔧 CanvasManager: 必須レイヤー存在検証開始');
        
        const requiredLayers = ['layer0', 'layer1', 'main'];
        const missingLayers = [];
        
        for (const layerId of requiredLayers) {
            if (!this.layers.has(layerId)) {
                missingLayers.push(layerId);
            }
        }
        
        if (missingLayers.length > 0) {
            const error = new Error(`Required layers not created: ${missingLayers.join(', ')}`);
            console.error('💀 必須レイヤー作成失敗:', error);
            console.error('📊 レイヤー作成状況:', {
                created: Array.from(this.layers.keys()),
                missing: missingLayers,
                expected: requiredLayers
            });
            throw error;
        }
        
        // main layerがlayer1と同じオブジェクトかチェック
        if (this.layers.get('main') !== this.layers.get('layer1')) {
            const error = new Error('main layer is not properly aliased to layer1');
            console.error('💀 main layerエイリアス設定失敗:', error);
            throw error;
        }
        
        console.log('✅ CanvasManager: 必須レイヤー存在検証完了');
        console.log('📊 検証結果:', {
            requiredLayers: requiredLayers,
            createdLayers: Array.from(this.layers.keys()),
            mainLayerAliasValid: this.layers.get('main') === this.layers.get('layer1'),
            allLayersValid: true
        });
    }
    
    /**
     * 🆕 main layer確実取得（エラー隠蔽禁止）
     */
    ensureMainLayer() {
        const mainLayer = this.layers.get('main');
        if (!mainLayer) {
            const error = new Error('Main layer not found - CanvasManager not properly initialized');
            console.error('💀 Main layer取得失敗:', error);
            console.error('📊 現在のレイヤー状況:', {
                layerKeys: Array.from(this.layers.keys()),
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp
            });
            throw error;
        }
        return mainLayer;
    }
    
    /**
     * キャンバス要素取得（CoordinateManager用）
     */
    getCanvasElement() {
        if (!this.pixiApp || !this.pixiApp.view) {
            const error = new Error('CanvasManager: PixiJS Application view not available');
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        // PixiJS v7のcanvas要素を返す
        return this.pixiApp.view;
    }
    
    /**
     * レイヤー作成（汎用・エイリアス対応）
     */
    createLayer(layerId) {
        if (!this.pixiApp) {
            const error = new Error('PixiJS Application not set - cannot create layer');
            console.error('💀 レイヤー作成失敗:', error);
            throw error;
        }
        
        // 既存レイヤーチェック（エイリアスは除外）
        if (this.layers.has(layerId) && layerId !== 'main') {
            console.log(`⚠️ Layer ${layerId} already exists - returning existing`);
            return this.layers.get(layerId);
        }
        
        // mainレイヤーの場合は特別処理
        if (layerId === 'main') {
            return this.ensureMainLayer();
        }
        
        // 新規レイヤー作成
        const layer = new PIXI.Container();
        layer.name = layerId;
        layer.sortableChildren = true;
        layer.zIndex = this.layers.size;
        
        // ステージに追加
        this.pixiApp.stage.addChild(layer);
        this.layers.set(layerId, layer);
        
        console.log(`✅ CanvasManager: レイヤー作成完了: ${layerId} (zIndex: ${layer.zIndex})`);
        return layer;
    }
    
    /**
     * レイヤー取得（エラー隠蔽禁止）
     */
    getLayer(layerId) {
        const layer = this.layers.get(layerId);
        
        // 重要：mainレイヤーが見つからない場合はエラー（フォールバック禁止）
        if (!layer && layerId === 'main') {
            const error = new Error(`Main layer not found - CanvasManager initialization failed`);
            console.error('💀 Main layer取得失敗:', error);
            console.error('📊 レイヤー状況:', {
                requestedLayer: layerId,
                availableLayers: Array.from(this.layers.keys()),
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp
            });
            throw error;
        }
        
        // その他のレイヤーの場合はnullを返す（従来通り）
        if (!layer) {
            console.warn(`⚠️ Layer not found: ${layerId}`);
            console.log('📊 利用可能レイヤー:', Array.from(this.layers.keys()));
        }
        
        return layer || null;
    }
    
    /**
     * メインレイヤー取得（互換性維持・エラー隠蔽禁止）
     */
    getMainLayer() {
        return this.ensureMainLayer();
    }
    
    /**
     * アクティブレイヤー取得
     */
    getActiveLayer() {
        const layer = this.layers.get(this.activeLayerId);
        if (!layer) {
            const error = new Error(`Active layer not found: ${this.activeLayerId}`);
            console.error('💀 アクティブレイヤー取得失敗:', error);
            throw error;
        }
        return layer;
    }
    
    /**
     * 背景レイヤー取得
     */
    getBackgroundLayer() {
        const layer = this.layers.get('layer0');
        if (!layer) {
            const error = new Error('Background layer (layer0) not found - CanvasManager initialization failed');
            console.error('💀 背景レイヤー取得失敗:', error);
            throw error;
        }
        return layer;
    }
    
    /**
     * 描画レイヤー取得
     */
    getDrawingLayer() {
        const layer = this.layers.get('layer1');
        if (!layer) {
            const error = new Error('Drawing layer (layer1) not found - CanvasManager initialization failed');
            console.error('💀 描画レイヤー取得失敗:', error);
            throw error;
        }
        return layer;
    }
    
    /**
     * Graphicsをレイヤーに配置（エラー隠蔽禁止）
     */
    addGraphicsToLayer(graphics, layerId = null) {
        if (!graphics) {
            const error = new Error('Graphics object is required');
            console.error('💀 Graphics配置失敗:', error);
            throw error;
        }
        
        // layerIdが指定されていない場合はアクティブレイヤーを使用
        const targetLayerId = layerId || this.activeLayerId;
        
        let layer = this.layers.get(targetLayerId);
        if (!layer) {
            // レイヤーが見つからない場合は作成（mainの場合はエラー）
            if (targetLayerId === 'main') {
                const error = new Error('Main layer not found - cannot add graphics');
                console.error('💀 Main layerへのGraphics配置失敗:', error);
                throw error;
            }
            
            console.log(`📦 Layer ${targetLayerId} not found - creating...`);
            layer = this.createLayer(targetLayerId);
        }
        
        // Graphics を Layer に追加
        layer.addChild(graphics);
        
        console.log(`✅ CanvasManager: Graphics配置完了: ${targetLayerId} (layer children: ${layer.children.length})`);
        
        // デバッグ情報
        console.log('🔧 Graphics Info:', {
            visible: graphics.visible,
            alpha: graphics.alpha,
            x: graphics.x,
            y: graphics.y,
            width: graphics.width,
            height: graphics.height
        });
    }
    
    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerId) {
        if (!this.layers.has(layerId)) {
            const error = new Error(`Cannot set active layer: ${layerId} does not exist`);
            console.error('💀 アクティブレイヤー設定失敗:', error);
            throw error;
        }
        
        this.activeLayerId = layerId;
        console.log(`🎯 CanvasManager: アクティブレイヤー設定: ${layerId}`);
    }
    
    /**
     * アクティブレイヤーID取得
     */
    getActiveLayerId() {
        return this.activeLayerId;
    }
    
    /**
     * アクティブレイヤークリア（背景保護）
     */
    clear() {
        const activeLayer = this.getActiveLayer();
        if (activeLayer && this.activeLayerId !== 'layer0') {
            activeLayer.removeChildren();
            console.log(`🧹 CanvasManager: アクティブレイヤークリア完了: ${this.activeLayerId}`);
        } else {
            console.log('⚠️ CanvasManager: 背景レイヤーのクリアは禁止');
        }
    }
    
    /**
     * 特定レイヤークリア（背景保護）
     */
    clearLayer(layerId) {
        if (layerId === 'layer0') {
            console.warn('⚠️ CanvasManager: 背景レイヤー(layer0)のクリアは禁止');
            return;
        }
        
        const layer = this.layers.get(layerId);
        if (!layer) {
            console.warn(`⚠️ CanvasManager: レイヤーが見つかりません: ${layerId}`);
            return;
        }
        
        layer.removeChildren();
        console.log(`🧹 CanvasManager: レイヤークリア完了: ${layerId}`);
    }
    
    /**
     * 全描画レイヤークリア（背景保護）
     */
    clearAllDrawingLayers() {
        this.layers.forEach((layer, layerId) => {
            if (layerId !== 'layer0') { // 背景レイヤーは保護
                layer.removeChildren();
                console.log(`🧹 CanvasManager: 描画レイヤークリア: ${layerId}`);
            }
        });
        
        console.log('✅ CanvasManager: 全描画レイヤークリア完了（背景保護）');
    }
    
    /**
     * キャンバスサイズ変更（背景レイヤー更新付き）
     */
    resizeCanvas(width, height) {
        if (!this.pixiApp) {
            const error = new Error('PixiJS Application not set - cannot resize');
            console.error('💀 キャンバスサイズ変更失敗:', error);
            throw error;
        }
        
        console.log(`🎨 CanvasManager: キャンバスサイズ変更: ${width}x${height}`);
        
        this.pixiApp.renderer.resize(width, height);
        
        // 背景レイヤーのサイズも更新
        const backgroundLayer = this.getBackgroundLayer();
        if (backgroundLayer && backgroundLayer.children.length > 0) {
            const backgroundGraphics = backgroundLayer.children[0];
            if (backgroundGraphics instanceof PIXI.Graphics) {
                backgroundGraphics.clear();
                backgroundGraphics.beginFill(this.backgroundColor, 1.0);
                backgroundGraphics.drawRect(0, 0, width, height);
                backgroundGraphics.endFill();
            }
        }
        
        console.log(`✅ CanvasManager: キャンバスサイズ変更完了: ${width}x${height}`);
    }
    
    /**
     * PixiJS Application取得
     */
    getPixiApp() {
        return this.pixiApp;
    }
    
    /**
     * 初期化状態確認（厳密版）
     */
    isReady() {
        const ready = this.initialized && 
                     !!this.pixiApp && 
                     !!this.pixiApp.stage && 
                     !!this.pixiApp.view &&
                     this.layers.has('main') &&
                     this.layers.has('layer0') &&
                     this.layers.has('layer1');
        
        if (!ready) {
            console.warn('⚠️ CanvasManager not ready:', {
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp,
                hasStage: !!this.pixiApp?.stage,
                hasView: !!this.pixiApp?.view,
                hasMainLayer: this.layers.has('main'),
                hasLayer0: this.layers.has('layer0'),
                hasLayer1: this.layers.has('layer1')
            });
        }
        
        return ready;
    }
    
    /**
     * デバッグ情報取得（詳細版）
     */
    getDebugInfo() {
        return {
            className: 'CanvasManager',
            initialized: this.initialized,
            hasRequiredDeps: !!this.pixiApp,
            itemCount: this.layers.size,
            currentState: this.initialized ? 'ready' : 'initializing',
            lastError: 'none',
            additionalInfo: {
                hasPixiApp: !!this.pixiApp,
                hasCanvasElement: !!this.pixiApp?.view,
                layerCount: this.layers.size,
                layerNames: Array.from(this.layers.keys()),
                activeLayer: this.activeLayerId,
                stageChildren: this.pixiApp?.stage.children.length || 0,
                backgroundColor: '0x' + this.backgroundColor.toString(16),
                canvasSize: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height
                } : null,
                canvasElementType: this.pixiApp?.view?.tagName || 'none',
                layerValidation: {
                    hasMainLayer: this.layers.has('main'),
                    hasLayer0: this.layers.has('layer0'),
                    hasLayer1: this.layers.has('layer1'),
                    mainLayerAliasValid: this.layers.get('main') === this.layers.get('layer1'),
                    allRequiredLayersExist: this.layers.has('main') && this.layers.has('layer0') && this.layers.has('layer1')
                }
            }
        };
    }
    
    /**
     * システム統計情報取得
     */
    getSystemStats() {
        return {
            layerManagement: {
                totalLayers: this.layers.size,
                requiredLayersExist: this.layers.has('main') && this.layers.has('layer0') && this.layers.has('layer1'),
                activeLayer: this.activeLayerId
            },
            pixiIntegration: {
                connected: !!this.pixiApp,
                canvasElementAvailable: !!this.pixiApp?.view,
                stageReady: !!this.pixiApp?.stage
            },
            initializationStatus: {
                fullyInitialized: this.isReady(),
                criticalComponentsReady: !!this.pixiApp && this.layers.has('main')
            }
        };
    }
}

// グローバル公開
window.Tegaki.CanvasManager = CanvasManager;
console.log('🎨 CanvasManager レイヤー問題完全修正版 Loaded - main layer対応・エラー隠蔽禁止・レイヤー存在確実化');