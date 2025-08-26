/**
 * 🎨 CanvasManager - Graphics削除メソッド追加版
 * 
 * 📋 使用メソッド一覧（依存確認済み ✅）
 * - new PIXI.Container() - PixiJS標準コンテナ
 * - new PIXI.Graphics() - PixiJS標準Graphics
 * - container.addChild() - PixiJS標準子要素追加
 * - container.removeChild() - PixiJS標準子要素削除
 * - pixiApp.stage.addChild() - PixiJS標準ステージ追加
 * - graphics.beginFill() / endFill() - PixiJS標準塗りつぶし
 * 
 * 📋 RESPONSIBILITY: PixiJS Application管理とレイヤー管理・Graphics操作
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な初期化・フォールバック
 * ✅ PERMISSION: PixiJS受け取り・レイヤー作成・Graphics配置・Graphics削除
 * 
 * 📏 DESIGN_PRINCIPLE: 背景レイヤー(0) + 描画レイヤー(1) の分離構造
 * 🔄 INTEGRATION: RecordManager連携・PenTool連携・PixiJS標準機能活用
 * 
 * 🎨 CANVAS_DISPLAY: キャンバス表示の流れ
 * 1. bootstrap.js → TegakiApplication作成 → CanvasManager初期化
 * 2. CanvasManager.setPixiApp() → PixiJS設定・レイヤー作成
 * 3. createLayerStructure() → layer0(背景) + layer1(描画) 作成
 * 4. addGraphicsToLayer() → 即座に画面表示
 * 5. removeGraphicsFromLayer() → Undo/Redo用削除
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.CanvasManager) {
    /**
     * CanvasManager - Graphics削除メソッド追加版
     * レイヤー0: 背景専用（消しゴムで消去されない）
     * レイヤー1: 描画専用（ペン描画・消しゴム対象）
     */
    class CanvasManager {
        constructor() {
            console.log('🎨 CanvasManager Graphics削除メソッド追加版 作成');
            
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
            
            console.log('✅ CanvasManager - レイヤー分離構造完成・Graphics操作対応');
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
         * 🎯 Graphicsをレイヤーに配置（即時表示・PenTool用）
         * 
         * @param {PIXI.Graphics} graphics - 追加するGraphics
         * @param {string} layerId - 対象レイヤーID（省略時はアクティブレイヤー）
         */
        addGraphicsToLayer(graphics, layerId = null) {
            if (!graphics) {
                throw new Error('Graphics object is required');
            }
            
            if (!(graphics instanceof PIXI.Graphics)) {
                throw new Error('Must be PIXI.Graphics instance');
            }
            
            // layerIdが指定されていない場合はアクティブレイヤーを使用
            const targetLayerId = layerId || this.activeLayerId;
            
            let layer = this.layers.get(targetLayerId);
            if (!layer) {
                console.log(`📦 Layer ${targetLayerId} not found - creating...`);
                layer = this.createLayer(targetLayerId);
            }
            
            // Graphics を Layer に追加（即座に画面表示）
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
         * 🎯 Graphicsをレイヤーから削除（Undo/Redo用）
         * 
         * @param {PIXI.Graphics} graphics - 削除するGraphics
         * @param {string} layerId - 対象レイヤーID（省略時は全レイヤーから検索）
         * @returns {boolean} 削除成功フラグ
         */
        removeGraphicsFromLayer(graphics, layerId = null) {
            if (!graphics) {
                console.warn('⚠️ Graphics object is required for removal');
                return false;
            }
            
            if (!(graphics instanceof PIXI.Graphics)) {
                console.warn('⚠️ Must be PIXI.Graphics instance for removal');
                return false;
            }
            
            let targetLayers = [];
            
            if (layerId) {
                // 特定レイヤーから削除
                const layer = this.layers.get(layerId);
                if (layer) {
                    targetLayers = [{ id: layerId, layer }];
                }
            } else {
                // 全レイヤーから検索して削除
                targetLayers = Array.from(this.layers.entries()).map(([id, layer]) => ({ id, layer }));
            }
            
            let removed = false;
            
            for (const { id, layer } of targetLayers) {
                // 背景レイヤーからの削除は禁止
                if (id === 'layer0') {
                    continue;
                }
                
                try {
                    // Graphicsが実際にこのレイヤーの子かチェック
                    if (layer.children.includes(graphics)) {
                        layer.removeChild(graphics);
                        console.log(`🗑️ Graphics removed from layer: ${id} (remaining children: ${layer.children.length})`);
                        removed = true;
                        break; // 1つのレイヤーから削除したら終了
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to remove Graphics from layer ${id}:`, error.message);
                }
            }
            
            if (!removed) {
                console.warn('⚠️ Graphics not found in any layer for removal');
            }
            
            return removed;
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
         * レイヤー内Graphics数取得
         */
        getLayerGraphicsCount(layerId) {
            const layer = this.layers.get(layerId);
            return layer ? layer.children.length : 0;
        }
        
        /**
         * 全レイヤーGraphics数取得
         */
        getTotalGraphicsCount() {
            let total = 0;
            this.layers.forEach((layer, layerId) => {
                if (layerId !== 'layer0') { // 背景レイヤーは除外
                    total += layer.children.length;
                }
            });
            return total;
        }
        
        /**
         * レイヤー内の全Graphics取得
         */
        getLayerGraphics(layerId) {
            const layer = this.layers.get(layerId);
            return layer ? [...layer.children] : [];
        }
        
        /**
         * Graphics検索（レイヤー横断）
         */
        findGraphicsInLayers(predicate) {
            const results = [];
            
            this.layers.forEach((layer, layerId) => {
                if (layerId !== 'layer0') { // 背景レイヤーは除外
                    layer.children.forEach(child => {
                        if (child instanceof PIXI.Graphics && predicate(child)) {
                            results.push({
                                graphics: child,
                                layerId: layerId,
                                layer: layer
                            });
                        }
                    });
                }
            });
            
            return results;
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
         * 背景色変更
         */
        setBackgroundColor(color) {
            if (typeof color === 'string') {
                this.backgroundColor = parseInt(color.replace('#', ''), 16);
            } else if (typeof color === 'number') {
                this.backgroundColor = color;
            } else {
                console.warn('⚠️ Invalid background color:', color);
                return;
            }
            
            // 背景レイヤーの色を更新
            const backgroundLayer = this.getBackgroundLayer();
            if (backgroundLayer && backgroundLayer.children.length > 0) {
                const backgroundGraphics = backgroundLayer.children[0];
                if (backgroundGraphics instanceof PIXI.Graphics) {
                    backgroundGraphics.clear();
                    backgroundGraphics.beginFill(this.backgroundColor, 1.0);
                    backgroundGraphics.drawRect(0, 0, this.pixiApp.screen.width, this.pixiApp.screen.height);
                    backgroundGraphics.endFill();
                }
            }
            
            console.log(`🎨 Background color changed: 0x${this.backgroundColor.toString(16)}`);
        }
        
        /**
         * レイヤー可視性設定
         */
        setLayerVisibility(layerId, visible) {
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.visible = visible;
                console.log(`👁️ Layer ${layerId} visibility: ${visible}`);
            } else {
                console.warn(`⚠️ Layer not found: ${layerId}`);
            }
        }
        
        /**
         * レイヤー透明度設定
         */
        setLayerAlpha(layerId, alpha) {
            if (alpha < 0 || alpha > 1) {
                console.warn(`⚠️ Invalid alpha value: ${alpha} (must be 0-1)`);
                return;
            }
            
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.alpha = alpha;
                console.log(`🔅 Layer ${layerId} alpha: ${alpha}`);
            } else {
                console.warn(`⚠️ Layer not found: ${layerId}`);
            }
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            const layerDetails = {};
            this.layers.forEach((layer, layerId) => {
                layerDetails[layerId] = {
                    childrenCount: layer.children.length,
                    visible: layer.visible,
                    alpha: layer.alpha,
                    zIndex: layer.zIndex,
                    sortableChildren: layer.sortableChildren
                };
            });
            
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
                } : null,
                layerDetails,
                totalGraphicsCount: this.getTotalGraphicsCount()
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
        
        /**
         * 🆕 Phase1.5機能テスト
         */
        testCanvasManagerFeatures() {
            const results = { success: [], error: [], warning: [] };
            
            try {
                // レイヤー作成テスト
                if (this.layers.has('layer0') && this.layers.has('layer1')) {
                    results.success.push('CanvasManager: 基本レイヤー存在確認');
                } else {
                    results.error.push('CanvasManager: 基本レイヤー不足');
                }
                
                // Graphics追加・削除テスト
                const testGraphics = new PIXI.Graphics();
                testGraphics.beginFill(0xff0000);
                testGraphics.drawCircle(0, 0, 5);
                testGraphics.endFill();
                
                try {
                    this.addGraphicsToLayer(testGraphics);
                    const layerGraphicsCount = this.getLayerGraphicsCount(this.activeLayerId);
                    
                    if (layerGraphicsCount > 0) {
                        results.success.push('CanvasManager: Graphics追加機能正常');
                        
                        // 削除テスト
                        const removeSuccess = this.removeGraphicsFromLayer(testGraphics);
                        if (removeSuccess) {
                            results.success.push('CanvasManager: Graphics削除機能正常');
                        } else {
                            results.error.push('CanvasManager: Graphics削除機能異常');
                        }
                    } else {
                        results.error.push('CanvasManager: Graphics追加機能異常');
                    }
                } catch (error) {
                    results.error.push(`CanvasManager: Graphics操作エラー: ${error.message}`);
                }
                
                // レイヤー管理テスト
                const originalLayerId = this.activeLayerId;
                try {
                    this.setActiveLayer('layer1');
                    if (this.getActiveLayerId() === 'layer1') {
                        results.success.push('CanvasManager: アクティブレイヤー設定正常');
                    } else {
                        results.error.push('CanvasManager: アクティブレイヤー設定異常');
                    }
                } finally {
                    this.setActiveLayer(originalLayerId); // 復元
                }
                
                // PixiJS連携テスト
                if (this.pixiApp && this.pixiApp.stage && this.pixiApp.renderer) {
                    results.success.push('CanvasManager: PixiJS連携正常');
                } else {
                    results.error.push('CanvasManager: PixiJS連携異常');
                }
                
            } catch (error) {
                results.error.push(`CanvasManager機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.CanvasManager = CanvasManager;
    
    console.log('🎨 CanvasManager Graphics削除メソッド追加版 Loaded - RecordManager連携・Undo/Redo対応');
} else {
    console.log('⚠️ CanvasManager already defined - skipping redefinition');
}

console.log('🎨 canvas-manager.js loaded - Graphics削除メソッド・Phase1.5完全対応・レイヤー管理強化完了');