/**
 * 🎨 CanvasManager - レイヤー分離版（レイヤー作成確認強化）
 * 📋 RESPONSIBILITY: PixiJS Application管理とレイヤー管理のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な初期化
 * ✅ PERMISSION: PixiJS受け取り・レイヤー作成・Graphics配置
 * 
 * 📏 DESIGN_PRINCIPLE: 背景レイヤー(0) + 描画レイヤー(1) の分離構造
 * 🔄 INTEGRATION: 車輪の再発明回避・PixiJSの標準機能活用
 * 🔧 FIX: レイヤー作成確認の強化・エラー詳細化
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.CanvasManager) {
    /**
     * CanvasManager - レイヤー分離版（確認強化版）
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
        }
        
        /**
         * PixiJS Application設定（レイヤー作成確認強化版）
         */
        setPixiApp(pixiApp) {
            if (!pixiApp) {
                throw new Error('PixiJS Application is required');
            }
            
            if (!pixiApp.stage) {
                throw new Error('PixiJS Application has no stage');
            }
            
            this.pixiApp = pixiApp;
            
            // レイヤー分離構造作成
            this.createLayerStructure();
            
            // レイヤー作成確認（重要：エラーで停止）
            this.verifyLayerCreation();
            
            this.initialized = true;
            
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
         * レイヤー分離構造作成（確認強化版）
         * layer0: 背景専用（固定、消去対象外）
         * layer1: 描画専用（ペン・消しゴム対象）
         */
        createLayerStructure() {
            if (!this.pixiApp) {
                throw new Error('PixiJS Application not set');
            }
            
            try {
                // レイヤー0: 背景レイヤー（消去されない）
                const backgroundLayer = new PIXI.Container();
                backgroundLayer.name = 'layer0';
                backgroundLayer.zIndex = 0; // 背景なので最背面
                this.pixiApp.stage.addChild(backgroundLayer);
                this.layers.set('layer0', backgroundLayer);
                
                console.log('✅ 背景レイヤー (layer0) 作成完了:', {
                    name: backgroundLayer.name,
                    zIndex: backgroundLayer.zIndex,
                    parent: backgroundLayer.parent === this.pixiApp.stage
                });
                
                // レイヤー1: アクティブ描画レイヤー（消去対象）
                const activeLayer = new PIXI.Container();
                activeLayer.name = 'layer1';
                activeLayer.zIndex = 1; // 描画なので前面
                activeLayer.sortableChildren = true; // 描画順序管理
                this.pixiApp.stage.addChild(activeLayer);
                this.layers.set('layer1', activeLayer);
                
                console.log('✅ 描画レイヤー (layer1) 作成完了:', {
                    name: activeLayer.name,
                    zIndex: activeLayer.zIndex,
                    sortableChildren: activeLayer.sortableChildren,
                    parent: activeLayer.parent === this.pixiApp.stage
                });
                
                // ステージの子要素ソート有効化
                this.pixiApp.stage.sortableChildren = true;
                
            } catch (error) {
                console.error('❌ レイヤー構造作成エラー:', error);
                throw new Error(`Layer structure creation failed: ${error.message}`);
            }
        }
        
        /**
         * レイヤー作成確認（重要：ToolManager初期化前に実行）
         */
        verifyLayerCreation() {
            // Map確認
            if (this.layers.size !== 2) {
                throw new Error(`Expected 2 layers, got ${this.layers.size}`);
            }
            
            // layer0確認
            const layer0 = this.layers.get('layer0');
            if (!layer0) {
                throw new Error('Background layer (layer0) not found in layers Map');
            }
            
            if (layer0.parent !== this.pixiApp.stage) {
                throw new Error('Background layer (layer0) not attached to stage');
            }
            
            // layer1確認
            const layer1 = this.layers.get('layer1');
            if (!layer1) {
                throw new Error('Drawing layer (layer1) not found in layers Map');
            }
            
            if (layer1.parent !== this.pixiApp.stage) {
                throw new Error('Drawing layer (layer1) not attached to stage');
            }
            
            // Stage子要素確認
            const stageChildren = this.pixiApp.stage.children;
            if (stageChildren.length < 2) {
                throw new Error(`Stage should have at least 2 children, got ${stageChildren.length}`);
            }
            
            // レイヤー順序確認
            const layer0Index = stageChildren.indexOf(layer0);
            const layer1Index = stageChildren.indexOf(layer1);
            
            if (layer0Index === -1) {
                throw new Error('Background layer (layer0) not found in stage children');
            }
            
            if (layer1Index === -1) {
                throw new Error('Drawing layer (layer1) not found in stage children');
            }
            
            console.log('✅ レイヤー作成確認完了:', {
                totalLayers: this.layers.size,
                layer0Exists: !!layer0,
                layer1Exists: !!layer1,
                layer0InStage: layer0Index !== -1,
                layer1InStage: layer1Index !== -1,
                stageChildren: stageChildren.length,
                activeLayerId: this.activeLayerId
            });
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
                height: graphics.height,
                targetLayer: targetLayerId
            });
        }
        
        /**
         * アクティブレイヤー設定（存在確認強化）
         */
        setActiveLayer(layerId) {
            if (!this.layers.has(layerId)) {
                throw new Error(`Layer ${layerId} does not exist`);
            }
            
            const layer = this.layers.get(layerId);
            if (!layer.parent) {
                throw new Error(`Layer ${layerId} is not attached to stage`);
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
         * アクティブレイヤーの描画要素に対してマスク処理（真の消去用）
         */
        eraseFromActiveLayer(graphics) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer || this.activeLayerId === 'layer0') {
                console.warn('⚠️ 背景レイヤーへの消去は禁止されています');
                return;
            }
            
            // 消去用Graphicsを作成（反転マスクとして使用）
            graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            activeLayer.addChild(graphics);
            
            console.log(`🧹 Erase graphics applied to active layer: ${this.activeLayerId}`);
        }
        
        /**
         * キャンバスサイズ変更
         */
        resizeCanvas(width, height) {
            if (!this.pixiApp) {
                throw new Error('PixiJS Application not set');
            }
            
            this.pixiApp.renderer.resize(width, height);
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
                layerDetails: Array.from(this.layers.entries()).map(([id, layer]) => ({
                    id,
                    name: layer.name,
                    zIndex: layer.zIndex,
                    children: layer.children.length,
                    attached: layer.parent === this.pixiApp?.stage
                })),
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
         * 初期化状態確認（強化版）
         */
        isReady() {
            return this.initialized && 
                   !!this.pixiApp && 
                   !!this.pixiApp.stage &&
                   this.layers.has('layer0') &&
                   this.layers.has('layer1') &&
                   this.layers.get('layer0').parent === this.pixiApp.stage &&
                   this.layers.get('layer1').parent === this.pixiApp.stage;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.CanvasManager = CanvasManager;
    
    console.log('🎨 CanvasManager レイヤー分離版（確認強化版） Loaded');
} else {
    console.log('⚠️ CanvasManager already defined - skipping redefinition');
}

console.log('🎨 canvas-manager.js loaded - レイヤー分離構造完成（確認強化版）');