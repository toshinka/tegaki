/**
 * 🎨 CanvasManager - 座標・背景色修正版
 * 📋 RESPONSIBILITY: PixiJS Application管理とレイヤー管理のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な初期化
 * ✅ PERMISSION: PixiJS受け取り・レイヤー作成・Graphics配置
 * 
 * 📏 DESIGN_PRINCIPLE: 背景レイヤー(0) + 描画レイヤー(1) の分離構造
 * 🔄 INTEGRATION: 車輪の再発明回避・PixiJSの標準機能活用
 * 🔧 FIX: 座標変換問題・背景色修正・Canvas配置修正
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.CanvasManager) {
    /**
     * CanvasManager - 座標・背景色修正版
     * レイヤー0: 背景専用（消しゴムで消去されない）
     * レイヤー1: 描画専用（ペン描画・消しゴム対象）
     */
    class CanvasManager {
        constructor() {
            console.log('🎨 CanvasManager レイヤー分離版作成（確認強化版）');
            
            this.pixiApp = null;
            this.layers = new Map();
            this.initialized = false;
            this.activeLayerId = 'layer1'; // デフォルトアクティブレイヤー
            
            // 🔧 背景レイヤー用の背景色設定
            this.backgroundColor = 0xf0e0d6; // ふたば風クリーム色 #f0e0d6
        }
        
        /**
         * PixiJS Application設定（レイヤー分離対応）
         */
        setPixiApp(pixiApp) {
            if (!pixiApp) {
                throw new Error('PixiJS Application is required');
            }
            
            if (!pixiApp.stage) {
                throw new Error('PixiJS Application has no stage');
            }
            
            this.pixiApp = pixiApp;
            
            // 🔧 背景色を透明に設定（背景レイヤーで管理）
            this.pixiApp.renderer.backgroundColor = 0x000000; // 完全透明（アルファ0）
            this.pixiApp.renderer.backgroundAlpha = 0;
            
            this.initialized = true;
            
            // レイヤー分離構造作成
            this.createLayerStructure();
            
            // PixiJSの設定確認
            console.log('🎨 PixiJS Application Info:', {
                width: pixiApp.screen.width,
                height: pixiApp.screen.height,
                renderer: pixiApp.renderer.type,
                view: !!pixiApp.view,
                stage: !!pixiApp.stage,
                stageChildren: pixiApp.stage.children.length
            });
            
            console.log('✅ CanvasManager - レイヤー分離構造完成・確認済み');
        }
        
        /**
         * レイヤー分離構造作成（背景色修正版）
         * layer0: 背景専用（固定、消去対象外、ふたばクリーム色）
         * layer1: 描画専用（ペン・消しゴム対象、透明）
         */
        createLayerStructure() {
            if (!this.pixiApp) {
                throw new Error('PixiJS Application not set');
            }
            
            // 🎨 レイヤー0: 背景レイヤー（ふたばクリーム色で塗りつぶし）
            const backgroundLayer = new PIXI.Container();
            backgroundLayer.name = 'layer0';
            backgroundLayer.zIndex = 0; // 背景なので最背面
            
            // 背景用のGraphicsを作成してふたばクリーム色で塗りつぶし
            const backgroundGraphics = new PIXI.Graphics();
            backgroundGraphics.beginFill(this.backgroundColor, 1.0); // ふたばクリーム #f0e0d6
            backgroundGraphics.drawRect(0, 0, this.pixiApp.screen.width, this.pixiApp.screen.height);
            backgroundGraphics.endFill();
            backgroundLayer.addChild(backgroundGraphics);
            
            this.pixiApp.stage.addChild(backgroundLayer);
            this.layers.set('layer0', backgroundLayer);
            
            console.log('✅ 背景レイヤー (layer0) 作成完了: {name: \'layer0\', zIndex: 0, parent: true}');
            
            // 🎨 レイヤー1: アクティブ描画レイヤー（透明、描画対象）
            const activeLayer = new PIXI.Container();
            activeLayer.name = 'layer1';
            activeLayer.zIndex = 1; // 描画なので前面
            activeLayer.sortableChildren = true; // 描画順序管理
            this.pixiApp.stage.addChild(activeLayer);
            this.layers.set('layer1', activeLayer);
            
            console.log('✅ 描画レイヤー (layer1) 作成完了: {name: \'layer1\', zIndex: 1, sortableChildren: true, parent: true}');
            
            // ステージの子要素ソート有効化
            this.pixiApp.stage.sortableChildren = true;
            
            // 🔧 レイヤー作成確認ログ（強化版）
            const layer0Exists = this.layers.has('layer0');
            const layer1Exists = this.layers.has('layer1');
            const layer0InStage = this.pixiApp.stage.children.includes(this.layers.get('layer0'));
            const layer1InStage = this.pixiApp.stage.children.includes(this.layers.get('layer1'));
            
            console.log('✅ レイヤー作成確認完了: {totalLayers: ' + this.layers.size + ', layer0Exists: ' + layer0Exists + ', layer1Exists: ' + layer1Exists + ', layer0InStage: ' + layer0InStage + ', layer1InStage: ' + layer1InStage + ', stageChildren: ' + this.pixiApp.stage.children.length + '}');
        }
        
        /**
         * レイヤー作成（汎用）
         */
        createLayer(layerId) {
            if (!this.pixiApp) {
                throw new Error('PixiJS Application not set');
            }
            
            if (this.layers.has(layerId)) {
                console.log(`⚠️ Layer ${layerId} already exists - returning existing`);
                return this.layers.get(layerId);
            }
            
            // Container作成（Graphics用コンテナ）
            const layer = new PIXI.Container();
            layer.name = layerId;
            layer.sortableChildren = true; // 描画順序管理
            layer.zIndex = this.layers.size; // 作成順にzIndex設定
            
            // ステージに追加
            this.pixiApp.stage.addChild(layer);
            this.layers.set(layerId, layer);
            
            console.log(`✅ Layer created: ${layerId} (zIndex: ${layer.zIndex})`);
            return layer;
        }
        
        /**
         * Graphicsをレイヤーに配置（アクティブレイヤー優先）
         */
        addGraphicsToLayer(graphics, layerId = null) {
            if (!graphics) {
                throw new Error('Graphics object is required');
            }
            
            // layerIdが指定されていない場合はアクティブレイヤーを使用
            const targetLayerId = layerId || this.activeLayerId;
            
            let layer = this.layers.get(targetLayerId);
            if (!layer) {
                console.log(`📦 Layer ${targetLayerId} not found - creating...`);
                layer = this.createLayer(targetLayerId);
            }
            
            // Graphics を Layer に追加
            layer.addChild(graphics);
            
            console.log(`✅ Graphics added to layer: ${targetLayerId} (layer children: ${layer.children.length})`);
            
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
                throw new Error(`Layer ${layerId} does not exist`);
            }
            
            this.activeLayerId = layerId;
            console.log(`🎯 Active layer set to: ${layerId}`);
        }
        
        /**
         * アクティブレイヤー取得
         */
        getActiveLayer() {
            return this.layers.get(this.activeLayerId);
        }
        
        /**
         * アクティブレイヤーID取得
         */
        getActiveLayerId() {
            return this.activeLayerId;
        }
        
        /**
         * レイヤー取得
         */
        getLayer(layerId) {
            return this.layers.get(layerId) || null;
        }
        
        /**
         * メインレイヤー取得（互換性維持）
         */
        getMainLayer() {
            return this.getLayer('layer1') || this.getActiveLayer();
        }
        
        /**
         * 背景レイヤー取得
         */
        getBackgroundLayer() {
            return this.getLayer('layer0');
        }
        
        /**
         * 描画レイヤー取得
         */
        getDrawingLayer() {
            return this.getLayer('layer1');
        }
        
        /**
         * アクティブレイヤークリア（背景は保護）
         */
        clear() {
            const activeLayer = this.getActiveLayer();
            if (activeLayer && this.activeLayerId !== 'layer0') {
                activeLayer.removeChildren();
                console.log(`🧹 Active layer cleared: ${this.activeLayerId}`);
            } else {
                console.log('⚠️ 背景レイヤーのクリアは禁止されています');
            }
        }
        
        /**
         * 全描画レイヤークリア（背景は保護）
         */
        clearAllDrawingLayers() {
            this.layers.forEach((layer, layerId) => {
                if (layerId !== 'layer0') { // 背景レイヤーは保護
                    layer.removeChildren();
                    console.log(`🧹 Drawing layer cleared: ${layerId}`);
                }
            });
            
            console.log('✅ All drawing layers cleared (background protected)');
        }
        
        /**
         * 特定レイヤークリア
         */
        clearLayer(layerId) {
            if (layerId === 'layer0') {
                console.warn('⚠️ 背景レイヤー(layer0)のクリアは禁止されています');
                return;
            }
            
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.removeChildren();
                console.log(`🧹 Layer cleared: ${layerId}`);
            } else {
                console.warn(`⚠️ Layer not found: ${layerId}`);
            }
        }
        
        /**
         * 消去用Graphics配置（ERASEブレンドモード専用）
         */
        addEraseGraphicsToLayer(graphics, layerId = null) {
            if (!graphics) {
                throw new Error('Erase Graphics object is required');
            }
            
            // layerIdが指定されていない場合はアクティブレイヤーを使用
            const targetLayerId = layerId || this.activeLayerId;
            
            // 背景レイヤーへの消去は禁止
            if (targetLayerId === 'layer0') {
                console.warn('⚠️ 背景レイヤーへの消去は禁止されています');
                return;
            }
            
            let layer = this.layers.get(targetLayerId);
            if (!layer) {
                console.log(`📦 Layer ${targetLayerId} not found - creating...`);
                layer = this.createLayer(targetLayerId);
            }
            
            // 🧹 ERASEブレンドモード設定（必須）
            graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // Graphics を Layer に追加
            layer.addChild(graphics);
            
            console.log(`🧹 Erase Graphics added to layer: ${targetLayerId} (layer children: ${layer.children.length})`);
            
            // デバッグ情報
            console.log('🔧 Erase Graphics Info:', {
                visible: graphics.visible,
                alpha: graphics.alpha,
                blendMode: graphics.blendMode,
                x: graphics.x,
                y: graphics.y,
                width: graphics.width,
                height: graphics.height
            });
        }
        
        /**
         * キャンバスサイズ変更（背景レイヤー更新付き）
         */
        resizeCanvas(width, height) {
            if (!this.pixiApp) {
                throw new Error('PixiJS Application not set');
            }
            
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
            
            console.log(`📏 Canvas resized: ${width}x${height}`);
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp,
                layerCount: this.layers.size,
                layerNames: Array.from(this.layers.keys()),
                activeLayer: this.activeLayerId,
                stageChildren: this.pixiApp?.stage.children.length || 0,
                backgroundColor: '0x' + this.backgroundColor.toString(16),
                canvasSize: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height
                } : null
            };
        }
        
        /**
         * PixiJS Application取得（他クラス用）
         */
        getPixiApp() {
            return this.pixiApp;
        }
        
        /**
         * 初期化状態確認
         */
        isReady() {
            return this.initialized && !!this.pixiApp && !!this.pixiApp.stage;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.CanvasManager = CanvasManager;
    
    console.log('🎨 CanvasManager レイヤー分離版（確認強化版） Loaded');
} else {
    console.log('⚠️ CanvasManager already defined - skipping redefinition');
}

console.log('🎨 canvas-manager.js loaded - レイヤー分離構造完成（確認強化版）');