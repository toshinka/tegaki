/**
 * @file system/drawing/fill-tool.js
 * @description バケツツール - Phase 1: SDF距離場FloodFill完全修正版
 * 
 * 【修正内容】
 * ✅ WebGPU初期化タイミング修正 (window.webgpuDrawingLayer参照)
 * ✅ layer-system.jsに`getLayerByIndex()`メソッド追加対応
 * ✅ サムネイル更新イベント発行追加
 * ✅ 閉領域検出修正（全面塗りつぶし防止）
 * 
 * 【親ファイル (このファイルが依存)】
 * - system/event-bus.js (EventBus)
 * - system/layer-system.js (LayerManager - getLayerByIndex必須)
 * - system/drawing/brush-settings.js (BrushSettings)
 * - system/drawing/webgpu/webgpu-drawing-layer.js (WebGPUDrawingLayer)
 * - system/drawing/webgpu/webgpu-compute-sdf.js (ComputeSDF)
 * - system/history.js (History)
 * - config.js (TEGAKI_CONFIG)
 * 
 * 【子ファイル (このファイルに依存)】
 * - system/drawing/drawing-engine.js (canvas:pointerdown発行元)
 */

(function() {
    'use strict';

    class FillTool {
        constructor() {
            this.eventBus = window.TegakiEventBus;
            this.isActive = false;
            this.initialized = false;
            this.webgpuAvailable = false;
            this.lastClickLocalX = 0;
            this.lastClickLocalY = 0;
        }

        async initialize() {
            if (this.initialized) return;

            await this._checkWebGPUSupport();
            this._setupEventListeners();
            
            this.initialized = true;
        }

        async _checkWebGPUSupport() {
            if (!window.webgpuDrawingLayer) {
                return;
            }

            try {
                await window.webgpuDrawingLayer.initialize();
                this.webgpuAvailable = window.webgpuDrawingLayer.isInitialized() && 
                                       window.webgpuDrawingLayer.computeSDF;
            } catch (error) {
                this.webgpuAvailable = false;
            }
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            this.eventBus.on('tool:select', ({ tool }) => {
                this.isActive = (tool === 'fill');
            });

            this.eventBus.on('tool:changed', ({ tool }) => {
                this.isActive = (tool === 'fill');
            });

            this.eventBus.on('canvas:pointerdown', (event) => {
                if (!this.isActive) return;
                if (event.localX === undefined || event.localY === undefined) return;

                this.lastClickLocalX = event.localX;
                this.lastClickLocalY = event.localY;
                this.fill(event.localX, event.localY);
            });
        }

        async fill(localX, localY) {
            const layerManager = window.drawingApp?.layerManager || window.layerManager;
            if (!layerManager) {
                console.error('❌ FillTool: LayerManager not found');
                return;
            }

            const brushSettings = window.brushSettings;
            if (!brushSettings) {
                console.error('❌ FillTool: BrushSettings not found');
                return;
            }

            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.error('❌ FillTool: No active layer');
                return;
            }

            if (activeLayer.layerData.isBackground) {
                console.warn('⚠️ FillTool: Cannot fill background layer');
                return;
            }

            const fillColor = brushSettings.getColor();
            const fillAlpha = brushSettings.getOpacity();

            if (this.webgpuAvailable) {
                await this._fillLayerWithSDF(activeLayer, fillColor, fillAlpha, localX, localY, layerManager);
            } else {
                this._fillLayerLegacy(activeLayer, fillColor, fillAlpha, layerManager);
            }
        }

        async _fillLayerWithSDF(layer, color, alpha, localX, localY, layerManager) {
            const CONFIG = window.TEGAKI_CONFIG;
            const layerData = layer.layerData;

            const webgpuLayer = window.webgpuDrawingLayer;
            if (!webgpuLayer?.computeSDF) {
                this._fillLayerLegacy(layer, color, alpha, layerManager);
                return;
            }

            try {
                const maskTexture = await webgpuLayer.computeSDF.computeFloodFillMask(
                    layer,
                    localX,
                    localY,
                    2.0
                );

                const pathsBackup = this._clonePathsDataSafely(layerData.pathsData);

                this._clearLayerGraphics(layer, layerData);

                const fillGraphics = new PIXI.Graphics();
                fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                fillGraphics.fill({ color, alpha });

                const maskSprite = new PIXI.Sprite(maskTexture);
                fillGraphics.mask = maskSprite;
                layer.addChild(maskSprite);
                layer.addChild(fillGraphics);

                const pathData = {
                    id: `fill_sdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'fill',
                    tool: 'fill',
                    color,
                    alpha,
                    graphics: fillGraphics,
                    maskGraphics: maskSprite,
                    timestamp: Date.now(),
                    settings: { color, opacity: alpha, mode: 'fill-sdf' }
                };

                layerData.pathsData.push(pathData);

                this._registerHistory(layer, layerManager, pathsBackup, color, alpha, 'fill-sdf');

                // サムネイル更新イベント発行
                const layerIndex = layerManager.getActiveLayerIndex();
                layerManager.requestThumbnailUpdate(layerIndex);

                if (this.eventBus) {
                    this.eventBus.emit('layer:filled', {
                        layerId: layerData.id,
                        color, alpha,
                        method: 'sdf-floodfill'
                    });
                }

            } catch (error) {
                console.error('❌ FillTool: SDF FloodFill error:', error);
                this._fillLayerLegacy(layer, color, alpha, layerManager);
            }
        }

        _fillLayerLegacy(layer, color, alpha, layerManager) {
            const CONFIG = window.TEGAKI_CONFIG;
            const layerData = layer.layerData;

            const pathsBackup = this._clonePathsDataSafely(layerData.pathsData);
            this._clearLayerGraphics(layer, layerData);

            const fillGraphics = new PIXI.Graphics();
            fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            fillGraphics.fill({ color, alpha });

            const pathData = {
                id: `fill_legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'fill',
                tool: 'fill',
                color, alpha,
                graphics: fillGraphics,
                timestamp: Date.now(),
                settings: { color, opacity: alpha, mode: 'fill-legacy' }
            };

            layerData.pathsData.push(pathData);
            layer.addChild(fillGraphics);

            this._registerHistory(layer, layerManager, pathsBackup, color, alpha, 'fill-legacy');

            // サムネイル更新
            const layerIndex = layerManager.getActiveLayerIndex();
            layerManager.requestThumbnailUpdate(layerIndex);

            if (this.eventBus) {
                this.eventBus.emit('layer:filled', {
                    layerId: layerData.id,
                    color, alpha,
                    method: 'legacy-full'
                });
            }
        }

        _clearLayerGraphics(layer, layerData) {
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layerData.backgroundGraphics && child !== layerData.maskSprite) {
                    childrenToRemove.push(child);
                }
            }

            childrenToRemove.forEach(child => {
                layer.removeChild(child);
                if (child.destroy) {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            });

            layerData.pathsData = [];
        }

        _clonePathsDataSafely(pathsData) {
            if (!pathsData || pathsData.length === 0) return [];

            return pathsData.map(pathData => {
                const { graphics, maskGraphics, ...cloneable } = pathData;
                return cloneable;
            });
        }

        _registerHistory(layer, layerManager, pathsBackup, fillColor, fillAlpha, method) {
            if (!window.History || window.History._manager?.isApplying) return;

            const layerIndex = layerManager.getActiveLayerIndex();
            const layerId = layer.layerData.id;

            const entry = {
                name: `fill-layer-${method}`,
                do: () => {
                    const targetLayer = layerManager.getLayerByIndex ? 
                                       layerManager.getLayerByIndex(layerIndex) : 
                                       layerManager.getLayers()[layerIndex];
                    if (targetLayer) {
                        if (method === 'fill-sdf') {
                            this._fillLayerWithSDF(
                                targetLayer, fillColor, fillAlpha,
                                this.lastClickLocalX, this.lastClickLocalY,
                                layerManager
                            );
                        } else {
                            this._fillLayerLegacy(targetLayer, fillColor, fillAlpha, layerManager);
                        }
                    }
                },
                undo: () => {
                    const targetLayer = layerManager.getLayerByIndex ? 
                                       layerManager.getLayerByIndex(layerIndex) : 
                                       layerManager.getLayers()[layerIndex];
                    if (targetLayer) {
                        this._restoreLayer(targetLayer, pathsBackup, layerManager, layerIndex);
                    }
                },
                meta: { layerId, layerIndex, fillColor, fillAlpha, method }
            };

            window.History.push(entry);
        }

        _restoreLayer(layer, pathsBackup, layerManager, layerIndex) {
            if (!layer || !layer.layerData) return;

            const layerData = layer.layerData;
            this._clearLayerGraphics(layer, layerData);

            for (let pathData of pathsBackup) {
                try {
                    const rebuildSuccess = layerManager.rebuildPathGraphics(pathData);

                    if (rebuildSuccess && pathData.graphics) {
                        layerData.pathsData.push(pathData);
                        layer.addChild(pathData.graphics);
                    }
                } catch (error) {
                    console.error('❌ FillTool: Error restoring path:', error);
                }
            }

            layerManager.requestThumbnailUpdate(layerIndex);

            if (this.eventBus) {
                this.eventBus.emit('layer:restored', {
                    layerId: layerData.id,
                    layerIndex,
                    pathCount: pathsBackup.length
                });
            }
        }

        isToolActive() {
            return this.isActive;
        }

        destroy() {
            this.isActive = false;
            this.initialized = false;
        }
    }

    window.FillTool = new FillTool();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.FillTool.initialize();
        });
    } else {
        window.FillTool.initialize();
    }

    console.log('✅ fill-tool.js (Phase 1完全修正版) loaded');

})();