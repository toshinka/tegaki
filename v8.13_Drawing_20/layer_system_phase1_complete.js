// ===== system/layer-system.js - Phase 1 マスク統合版 =====
// Step 1.2, 1.3, 1.4 完了
// 
// 【改修内容】
// 1. setApp()にマスク初期化処理追加
// 2. _applyMaskToLayerGraphics()新規追加
// 3. createLayer()にマスク初期化追加
// 4. deleteLayer()にマスク破棄・再初期化追加
//
// 【使用方法】
// 元のlayer-system.jsの該当箇所を以下のコードで置き換える

// ========================================
// setApp() メソッド（行873-882を置き換え）
// ========================================

setApp(app) {
    this.app = app;
    if (this.transform && !this.transform.app) {
        if (this.cameraSystem) {
            this.initTransform();
        }
    }
    
    // ===== Step 1.2: マスク初期化処理追加 =====
    if (app && app.renderer) {
        const layers = this.getLayers();
        for (const layer of layers) {
            if (layer.layerData && !layer.layerData.hasMask()) {
                const ok = layer.layerData.initializeMask(
                    this.config.canvas.width,
                    this.config.canvas.height,
                    app.renderer
                );
                if (ok && layer.layerData.maskSprite) {
                    layer.addChildAt(layer.layerData.maskSprite, 0);
                    this._applyMaskToLayerGraphics(layer);
                }
            }
        }
    }
}

// ========================================
// _applyMaskToLayerGraphics() 新規メソッド
// setApp()の直後に追加
// ========================================

/**
 * レイヤー内のGraphicsにマスクを適用
 * @param {PIXI.Container} layer - 対象レイヤー
 */
_applyMaskToLayerGraphics(layer) {
    if (!layer.layerData?.maskSprite) return;
    
    for (const child of layer.children) {
        if (child === layer.layerData.maskSprite || 
            child === layer.layerData.backgroundGraphics) {
            continue;
        }
        
        if (child instanceof PIXI.Graphics) {
            child.mask = layer.layerData.maskSprite;
        }
    }
}

// ========================================
// createLayer() メソッド改修
// 行686-738を以下で置き換え
// ========================================

createLayer(name, isBackground = false) {
    if (!this.currentCutContainer) return null;
    const layerModel = new window.TegakiDataModels.LayerModel({
        name: name || `レイヤー${this.currentCutContainer.children.length + 1}`,
        isBackground: isBackground
    });
    const layer = new PIXI.Container();
    layer.label = layerModel.id;
    layer.layerData = layerModel;
    if (this.transform) {
        this.transform.setTransform(layerModel.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    }
    
    // ===== Step 1.3: レイヤー作成時のマスク初期化 =====
    if (this.app?.renderer) {
        const ok = layerModel.initializeMask(
            this.config.canvas.width,
            this.config.canvas.height,
            this.app.renderer
        );
        if (ok && layerModel.maskSprite) {
            layer.addChild(layerModel.maskSprite);
        }
    }
    
    if (isBackground) {
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
        bg.fill(this.config.background.color);
        layer.addChild(bg);
        layer.layerData.backgroundGraphics = bg;
    }
    if (window.History && !window.History._manager.isApplying) {
        const entry = {
            name: 'layer-create',
            do: () => {
                this.currentCutContainer.addChild(layer);
                const layers = this.getLayers();
                this.setActiveLayer(layers.length - 1);
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
            },
            undo: () => {
                // ===== Step 1.3: undo時のマスク破棄 =====
                layer.layerData?.destroyMask();
                this.currentCutContainer.removeChild(layer);
                const layers = this.getLayers();
                if (this.activeLayerIndex >= layers.length) {
                    this.activeLayerIndex = Math.max(0, layers.length - 1);
                }
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
            },
            meta: { layerId: layerModel.id, name: layerModel.name }
        };
        window.History.push(entry);
    } else {
        this.currentCutContainer.addChild(layer);
        const layers = this.getLayers();
        this.setActiveLayer(layers.length - 1);
        this.updateLayerPanelUI();
        this.updateStatusDisplay();
    }
    if (this.eventBus) {
        this.eventBus.emit('layer:created', { layerId: layerModel.id, name: layerModel.name, isBackground });
    }
    const layers = this.getLayers();
    return { layer, index: layers.length - 1 };
}

// ========================================
// deleteLayer() メソッド改修
// 行887-954を以下で置き換え
// ========================================

deleteLayer(layerIndex) {
    const layers = this.getLayers();
    if (layerIndex < 0 || layerIndex >= layers.length) {
        return false;
    }
    const layer = layers[layerIndex];
    const layerId = layer.layerData?.id;
    if (layer.layerData?.isBackground) {
        return false;
    }
    try {
        const previousActiveIndex = this.activeLayerIndex;
        if (window.History && !window.History._manager.isApplying) {
            const entry = {
                name: 'layer-delete',
                do: () => {
                    // ===== Step 1.4: マスク破棄 =====
                    layer.layerData?.destroyMask();
                    this.currentCutContainer.removeChild(layer);
                    if (layerId && this.transform) {
                        this.transform.deleteTransform(layerId);
                    }
                    const remainingLayers = this.getLayers();
                    if (remainingLayers.length === 0) {
                        this.activeLayerIndex = -1;
                    } else if (this.activeLayerIndex >= remainingLayers.length) {
                        this.activeLayerIndex = remainingLayers.length - 1;
                    }
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    if (this.eventBus) {
                        this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                    }
                },
                undo: () => {
                    // ===== Step 1.4: undo時のマスク再初期化 =====
                    if (layer.layerData && this.app?.renderer) {
                        layer.layerData.initializeMask(
                            this.config.canvas.width,
                            this.config.canvas.height,
                            this.app.renderer
                        );
                        if (layer.layerData.maskSprite) {
                            layer.addChildAt(layer.layerData.maskSprite, 0);
                            this._applyMaskToLayerGraphics(layer);
                        }
                    }
                    this.currentCutContainer.addChildAt(layer, layerIndex);
                    this.activeLayerIndex = previousActiveIndex;
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                },
                meta: { layerId, layerIndex }
            };
            window.History.push(entry);
        } else {
            layer.layerData?.destroyMask();
            this.currentCutContainer.removeChild(layer);
            if (layerId && this.transform) {
                this.transform.deleteTransform(layerId);
            }
            const remainingLayers = this.getLayers();
            if (remainingLayers.length === 0) {
                this.activeLayerIndex = -1;
            } else if (this.activeLayerIndex >= remainingLayers.length) {
                this.activeLayerIndex = remainingLayers.length - 1;
            }
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            if (this.eventBus) {
                this.eventBus.emit('layer:deleted', { layerId, layerIndex });
            }
        }
        if (this.animationSystem?.generateCutThumbnail) {
            const cutIndex = this.animationSystem.getCurrentCutIndex();
            setTimeout(() => {
                this.animationSystem.generateCutThumbnail(cutIndex);
            }, 100);
        }
        return true;
    } catch (error) {
        return false;
    }
}

// ========================================
// 注意事項
// ========================================
// 
// 上記3つのメソッドと1つの新規メソッドを
// 元のlayer-system.jsの該当箇所に適用してください。
// 
// 他のメソッド（init, rebuildPathGraphics, addPathToActiveLayer等）は
// 既存のまま維持してください。
