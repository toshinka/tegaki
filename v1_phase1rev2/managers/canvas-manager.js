/**
 * 🎨 CanvasManager - PixiJS連携改善版
 * 📋 RESPONSIBILITY: PixiJS Application管理とレイヤー管理のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な初期化
 * ✅ PERMISSION: PixiJS受け取り・レイヤー作成・Graphics配置
 * 
 * 📏 DESIGN_PRINCIPLE: シンプル・確実・PixiJS専門
 * 🔄 INTEGRATION: 車輪の再発明回避・PixiJSの標準機能活用
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.CanvasManager) {
    /**
     * CanvasManager - PixiJS連携改善版
     * PixiJS Application管理の専任
     */
    class CanvasManager {
        constructor() {
            console.log('🎨 CanvasManager PixiJS連携改善版作成');
            
            this.pixiApp = null;
            this.layers = new Map();
            this.initialized = false;
        }
        
        /**
         * PixiJS Application設定（確実な連携）
         */
        setPixiApp(pixiApp) {
            if (!pixiApp) {
                throw new Error('PixiJS Application is required');
            }
            
            if (!pixiApp.stage) {
                throw new Error('PixiJS Application has no stage');
            }
            
            this.pixiApp = pixiApp;
            this.initialized = true;
            
            // デフォルトレイヤー作成
            this.createLayer('main');
            
            // PixiJSの設定確認
            console.log('🎨 PixiJS Application Info:', {
                width: pixiApp.screen.width,
                height: pixiApp.screen.height,
                renderer: pixiApp.renderer.type,
                view: !!pixiApp.view,
                stage: !!pixiApp.stage,
                stageChildren: pixiApp.stage.children.length
            });
            
            console.log('✅ CanvasManager - PixiApp設定完了');
        }
        
        /**
         * レイヤー作成（シンプル版）
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
            
            // ステージに追加
            this.pixiApp.stage.addChild(layer);
            this.layers.set(layerId, layer);
            
            console.log(`✅ Layer created: ${layerId} (children: ${this.pixiApp.stage.children.length})`);
            return layer;
        }
        
        /**
         * Graphicsをレイヤーに配置（確実な配置）
         */
        addGraphicsToLayer(graphics, layerId = 'main') {
            if (!graphics) {
                throw new Error('Graphics object is required');
            }
            
            let layer = this.layers.get(layerId);
            if (!layer) {
                console.log(`📦 Layer ${layerId} not found - creating...`);
                layer = this.createLayer(layerId);
            }
            
            // Graphics を Layer に追加
            layer.addChild(graphics);
            
            console.log(`✅ Graphics added to layer: ${layerId} (layer children: ${layer.children.length})`);
            
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
         * レイヤー取得
         */
        getLayer(layerId) {
            return this.layers.get(layerId) || null;
        }
        
        /**
         * メインレイヤー取得（便利メソッド）
         */
        getMainLayer() {
            return this.getLayer('main');
        }
        
        /**
         * 全レイヤークリア
         */
        clear() {
            this.layers.forEach((layer, layerId) => {
                layer.removeChildren();
                console.log(`🧹 Layer cleared: ${layerId}`);
            });
            
            console.log('✅ All layers cleared');
        }
        
        /**
         * 特定レイヤークリア
         */
        clearLayer(layerId) {
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.removeChildren();
                console.log(`🧹 Layer cleared: ${layerId}`);
            } else {
                console.warn(`⚠️ Layer not found: ${layerId}`);
            }
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
                stageChildren: this.pixiApp?.stage.children.length || 0,
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
    
    console.log('🎨 CanvasManager PixiJS連携改善版 Loaded');
} else {
    console.log('⚠️ CanvasManager already defined - skipping redefinition');
}

console.log('🎨 canvas-manager.js loaded - PixiJS連携改善完了');