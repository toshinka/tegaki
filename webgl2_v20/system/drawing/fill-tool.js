/**
 * ================================================================================
 * fill-tool.js - WebGPU競合修正版
 * ================================================================================
 * 
 * 【修正内容】
 * ❌ 独自WebGPU初期化を削除
 * ✅ 既存の window.webgpuDrawingLayer を参照のみ
 * ✅ デバイス破棄問題を解決
 * 
 * 【依存Parents】
 * - event-bus.js
 * - layer-system.js
 * - brush-settings.js
 * - webgpu-drawing-layer.js (参照のみ)
 * 
 * 【依存Children】
 * - drawing-engine.js
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class FillTool {
        constructor() {
            this.eventBus = window.TegakiEventBus;
            this.isActive = false;
            this.initialized = false;
            this.lastClickLocalX = 0;
            this.lastClickLocalY = 0;
        }

        async initialize() {
            if (this.initialized) return;

            this._setupEventListeners();
            this.initialized = true;
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
                console.error('[FillTool] LayerManager not found');
                return;
            }

            const brushSettings = window.brushSettings;
            if (!brushSettings) {
                console.error('[FillTool] BrushSettings not found');
                return;
            }

            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.error('[FillTool] No active layer');
                return;
            }

            if (activeLayer.layerData.isBackground) {
                console.warn('[FillTool] Cannot fill background layer');
                return;
            }

            const fillColor = brushSettings.getColor();
            const fillAlpha = brushSettings.getOpacity();

            // WebGPU利用可能性チェック（初期化は行わない）
            const webgpuAvailable = window.webgpuDrawingLayer?.isInitialized() &&
                                   window.webgpuComputeSDF?.initialized;

            if (webgpuAvailable) {
                await this._fillLayerWithSDF(activeLayer, fillColor, fillAlpha, localX, localY, layerManager);
            } else {
                this._fillLayerLegacy(activeLayer, fillColor, fillAlpha, layerManager);
            }
        }

        async _fillLayerWithSDF(layer, color, alpha, localX, localY, layerManager) {
            const CONFIG = window.TEGAKI_CONFIG;
            const layerData = layer.layerData;

            const webgpuComputeSDF = window.webgpuComputeSDF;
            if (!webgpuComputeSDF?.initialized) {
                this._fillLayerLegacy(layer, color, alpha, layerManager);
                return;
            }

            try {
                // SDF FloodFill実装（将来実装）
                // 現在はLegacy実装にフォールバック
                console.warn('[FillTool] SDF FloodFill not yet implemented, using legacy');
                this._fillLayerLegacy(layer, color, alpha, layerManager);

            } catch (error) {
                console.error('[FillTool] SDF FloodFill error:', error);
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
                id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
                        this._fillLayerLegacy(targetLayer, fillColor, fillAlpha, layerManager);
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
                    console.error('[FillTool] Error restoring path:', error);
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

    console.log('✅ fill-tool.js (WebGPU競合修正版) loaded');
    console.log('   ❌ 独自WebGPU初期化を削除');
    console.log('   ✅ 既存インスタンス参照のみ');

})();