/**
 * layer-manager.js - LayerService 衛星
 * レイヤー生成/削除/移動、Stage管理
 */

window.MyApp = window.MyApp || {};

window.MyApp.LayerService = class LayerService {
    constructor() {
        this.mainController = null;
        this.layers = new Map();
        this.activeLayerId = null;
        this.nextLayerId = 1;
        this.debug = false;
        this.dragState = {
            dragging: false,
            dragItem: null,
            startY: 0,
            offset: 0
        };
    }

    // 主星との接続
    async register(mainController) {
        this.mainController = mainController;
        this.debug = window.MyApp.config?.debug || false;
        
        try {
            await this.initialize();
            if (this.debug) console.log('[LayerService] Registered with MainController');
            return true;
        } catch (error) {
            this.reportError('LAYER_SERVICE_INIT_ERROR', 'Failed to initialize LayerService', {
                error: error.message
            });
            throw error;
        }
    }

    // レイヤーサービス初期化
    async initialize() {
        // 背景レイヤー作成
        this.createBackgroundLayer();
        
        // 初期レイヤー作成
        const firstLayer = this.createLayer('レイヤー1');
        this.setActiveLayer(firstLayer.id);
    }

    // 背景レイヤー作成
    createBackgroundLayer() {
        const layerId = 0;
        const layerName = '背景';
        
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        
        // 背景グラフィック作成
        const backgroundGraphics = new PIXI.Graphics();
        backgroundGraphics.rect(0, 0, window.MyApp.config.canvas.width, window.MyApp.config.canvas.height);
        backgroundGraphics.fill(0xf0e0d6); // futaba-cream color
        container.addChild(backgroundGraphics);
        
        // 一時描画用グラフィック
        const tempGraphics = new PIXI.Graphics();
        container.addChild(tempGraphics);
        
        const layer = {
            id: layerId,
            name: layerName,
            container: container,
            visible: true,
            strokes: [],
            isBackground: true,
            backgroundGraphics: backgroundGraphics,
            tempGraphics: tempGraphics
        };
        
        this.layers.set(layerId, layer);
        
        // DrawingEngineのワールドコンテナに追加
        const drawingEngine = this.mainController.getSatellite('DrawingEngine');
        if (drawingEngine && drawingEngine.containers.world) {
            drawingEngine.containers.world.addChild(container);
        }
        
        this.activeLayerId = layerId;
        return layer;
    }

    // レイヤー作成
    createLayer(name = null) {
        const layerId = this.nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        
        // 一時描画用グラフィック
        const tempGraphics = new PIXI.Graphics();
        container.addChild(tempGraphics);
        
        const layer = {
            id: layerId,
            name: layerName,
            container: container,
            visible: true,
            strokes: [],
            isBackground: false,
            tempGraphics: tempGraphics
        };
        
        this.layers.set(layerId, layer);
        
        // DrawingEngineのワールドコンテナに追加
        const drawingEngine = this.mainController.getSatellite('DrawingEngine');
        if (drawingEngine && drawingEngine.containers.world) {
            drawingEngine.containers.world.addChild(container);
        }
        
        // レイヤー作成を通知
        this.mainController.notify({
            type: 'layer_created',
            payload: { layerId, layerName, recordHistory: true }
        });
        
        if (this.debug) console.log(`[LayerService] Created layer: ${layerName} (${layerId})`);
        
        return layer;
    }

    // レイヤー削除
    removeLayer(layerId) {
        try {
            if (layerId === 0) {
                throw new Error('Cannot delete background layer');
            }
            
            if (this.layers.size <= 2) {
                throw new Error('Must have at least one non-background layer');
            }
            
            const layer = this.layers.get(layerId);
            if (!layer || layer.isBackground) {
                throw new Error(`Layer ${layerId} not found or is background`);
            }
            
            // ストローク削除
            layer.strokes.forEach(stroke => {
                if (stroke.graphics) {
                    stroke.graphics.destroy();
                }
            });
            
            // コンテナ削除
            const drawingEngine = this.mainController.getSatellite('DrawingEngine');
            if (drawingEngine && drawingEngine.containers.world) {
                drawingEngine.containers.world.removeChild(layer.container);
            }
            layer.container.destroy();
            
            this.layers.delete(layerId);
            
            // アクティブレイヤーが削除された場合は別のレイヤーを選択
            if (this.activeLayerId === layerId) {
                const remainingLayers = Array.from(this.layers.keys()).filter(id => id !== 0);
                this.activeLayerId = remainingLayers[remainingLayers.length - 1] || 0;
            }
            
            // レイヤー削除を通知
            this.mainController.notify({
                type: 'layer_deleted',
                payload: { layerId, recordHistory: true }
            });
            
            if (this.debug) console.log(`[LayerService] Removed layer: ${layerId}`);
            
        } catch (error) {
            this.reportError('LAYER_REMOVE_ERROR', `Failed to remove layer ${layerId}`, {
                layerId, error: error.message
            });
        }
    }

    // レイヤー順序変更
    reorderLayer(fromIndex, toIndex) {
        try {
            const layerIds = Array.from(this.layers.keys()).filter(id => id !== 0).reverse();
            
            if (fromIndex < 0 || fromIndex >= layerIds.length ||
                toIndex < 0 || toIndex >= layerIds.length ||
                fromIndex === toIndex) {
                throw new Error('Invalid layer indices');
            }
            
            const fromLayerId = layerIds[fromIndex];
            const layer = this.layers.get(fromLayerId);
            
            if (!layer) {
                throw new Error(`Layer ${fromLayerId} not found`);
            }
            
            // DrawingEngineでの順序変更
            const drawingEngine = this.mainController.getSatellite('DrawingEngine');
            if (drawingEngine && drawingEngine.containers.world) {
                drawingEngine.containers.world.removeChild(layer.container);
                drawingEngine.containers.world.addChildAt(layer.container, toIndex + 1); // +1 for background
            }
            
            // レイヤー順序変更を通知
            this.mainController.notify({
                type: 'layer_reordered',
                payload: { fromIndex, toIndex, layerId: fromLayerId, recordHistory: true }
            });
            
            if (this.debug) console.log(`[LayerService] Reordered layer ${fromLayerId}: ${fromIndex} -> ${toIndex}`);
            
        } catch (error) {
            this.reportError('LAYER_REORDER_ERROR', 'Failed to reorder layer', {
                fromIndex, toIndex, error: error.message
            });
        }
    }

    // アクティブレイヤー設定
    setActiveLayer(layerId) {
        if (!this.layers.has(layerId)) {
            this.reportError('LAYER_NOT_FOUND', `Layer ${layerId} not found`, { layerId });
            return false;
        }
        
        this.activeLayerId = layerId;
        
        // UI更新を通知
        this.mainController.notify({
            type: 'ui_update',
            payload: { type: 'active_layer', data: { layerId } }
        });
        
        if (this.debug) console.log(`[LayerService] Active layer set to: ${layerId}`);
        return true;
    }

    // レイヤー可視性切り替え
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            this.reportError('LAYER_NOT_FOUND', `Layer ${layerId} not found`, { layerId });
            return;
        }
        
        layer.visible = !layer.visible;
        layer.container.visible = layer.visible;
        
        // レイヤー可視性変更を通知
        this.mainController.notify({
            type: 'layer_visibility_changed',
            payload: { layerId, visible: layer.visible, recordHistory: true }
        });
        
        if (this.debug) console.log(`[LayerService] Layer ${layerId} visibility: ${layer.visible}`);
    }

    // レイヤー取得
    getLayer(layerId) {
        return this.layers.get(layerId);
    }

    // アクティブレイヤー取得
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }

    // 全レイヤー取得
    getAllLayers() {
        return Array.from(this.layers.values());
    }

    // ストローク追加
    addStroke(layerId, strokeData) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            this.reportError('LAYER_NOT_FOUND', `Layer ${layerId} not found`, { layerId });
            return;
        }
        
        layer.strokes.push(strokeData);
        
        // グラフィックをレイヤーに追加
        if (strokeData.graphics) {
            layer.container.addChild(strokeData.graphics);
        }
        
        if (this.debug) console.log(`[LayerService] Added stroke to layer ${layerId}`);
    }

    // ストローク削除
    removeStroke(layerId, strokeId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            this.reportError('LAYER_NOT_FOUND', `Layer ${layerId} not found`, { layerId });
            return;
        }
        
        const strokeIndex = layer.strokes.findIndex(stroke => stroke.id === strokeId);
        if (strokeIndex === -1) {
            this.reportError('STROKE_NOT_FOUND', `Stroke ${strokeId} not found in layer ${layerId}`, {
                layerId, strokeId
            });
            return;
        }
        
        const stroke = layer.strokes[strokeIndex];
        
        // グラフィック削除
        if (stroke.graphics) {
            layer.container.removeChild(stroke.graphics);
            stroke.graphics.destroy();
        }
        
        // 配列から削除
        layer.strokes.splice(strokeIndex, 1);
        
        if (this.debug) console.log(`[LayerService] Removed stroke ${strokeId} from layer ${layerId}`);
    }

    // レイヤークリア
    clearLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            this.reportError('LAYER_NOT_FOUND', `Layer ${layerId} not found`, { layerId });
            return;
        }
        
        // 全ストローク削除
        layer.strokes.forEach(stroke => {
            if (stroke.graphics) {
                layer.container.removeChild(stroke.graphics);
                stroke.graphics.destroy();
            }
        });
        
        layer.strokes = [];
        
        // 一時描画もクリア
        if (layer.tempGraphics) {
            layer.tempGraphics.clear();
        }
        
        if (this.debug) console.log(`[LayerService] Cleared layer ${layerId}`);
    }

    // 背景レイヤーサイズ更新
    updateBackgroundSize(width, height) {
        const backgroundLayer = this.layers.get(0);
        if (backgroundLayer && backgroundLayer.backgroundGraphics) {
            backgroundLayer.backgroundGraphics.clear();
            backgroundLayer.backgroundGraphics.rect(0, 0, width, height);
            backgroundLayer.backgroundGraphics.fill(0xf0e0d6);
        }
        
        if (this.debug) console.log(`[LayerService] Updated background size: ${width}x${height}`);
    }

    // レイヤーメタデータ設定
    setLayerMeta(layerId, meta) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            this.reportError('LAYER_NOT_FOUND', `Layer ${layerId} not found`, { layerId });
            return;
        }
        
        // メタデータをレイヤーにマージ
        Object.assign(layer, meta);
        
        if (this.debug) console.log(`[LayerService] Updated layer ${layerId} meta:`, meta);
    }

    // 履歴アクション適用
    applyHistoryAction(actionData, isUndo) {
        try {
            switch (actionData.type) {
                case 'layer_created':
                    if (isUndo) {
                        this.removeLayer(actionData.layerId);
                    } else {
                        this.createLayer(actionData.layerName);
                    }
                    break;
                    
                case 'layer_deleted':
                    if (isUndo) {
                        // レイヤー復元 (実装複雑なため、現状は警告のみ)
                        console.warn('[LayerService] Layer restoration not yet implemented');
                    }
                    break;
                    
                case 'layer_visibility_changed':
                    this.toggleLayerVisibility(actionData.layerId);
                    break;
                    
                case 'layer_reordered':
                    if (isUndo) {
                        this.reorderLayer(actionData.toIndex, actionData.fromIndex);
                    } else {
                        this.reorderLayer(actionData.fromIndex, actionData.toIndex);
                    }
                    break;
            }
        } catch (error) {
            this.reportError('HISTORY_ACTION_ERROR', 'Failed to apply layer history action', {
                actionData, isUndo, error: error.message
            });
        }
    }

    // レイヤー統計取得
    getStats() {
        const stats = {
            totalLayers: this.layers.size,
            activeLayerId: this.activeLayerId,
            totalStrokes: 0,
            visibleLayers: 0
        };
        
        this.layers.forEach(layer => {
            stats.totalStrokes += layer.strokes.length;
            if (layer.visible) stats.visibleLayers++;
        });
        
        return stats;
    }

    // エラー報告ヘルパー
    reportError(code, message, context) {
        if (this.mainController) {
            this.mainController.notify({
                type: 'error',
                payload: { code, message, context }
            });
        } else {
            console.error(`[LayerService] ${code}: ${message}`, context);
        }
    }
};