/**
 * ============================================================================
 * ファイル名: system/drawing/fill-tool.js
 * 責務: バケツツール（塗りつぶし）のロジックを担当する
 * 依存: pixi.js, system/event-bus.js, config.js, system/history.js
 * 被依存: drawing-engine.js
 * 公開API: FillTool
 * イベント発火: layer:filled, layer:restored
 * イベント受信: tool:select, tool:changed, canvas:pointerdown
 * グローバル登録: window.FillTool
 * 実装状態: ♻️移植・ESM化
 * ============================================================================
 */

import { Graphics, Sprite } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';

export class FillTool {
    constructor() {
        this.eventBus = TegakiEventBus;
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
        const layerManager = window.layerManager;
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

            const fillGraphics = new Graphics();
            fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            fillGraphics.fill({ color, alpha });

            const maskSprite = new Sprite(maskTexture);
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

            if (!layerData.pathsData) layerData.pathsData = [];
            layerData.pathsData.push(pathData);

            this._registerHistory(layer, layerManager, pathsBackup, color, alpha, 'fill-sdf');

            const layerIndex = layerManager.getLayerIndex(layer);
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
        const app = layerManager.app;

        if (!layerData?.renderTexture || !app?.renderer) {
            console.error('❌ FillTool: No renderTexture or renderer');
            return;
        }

        // 塗りつぶし用の Graphics を生成して renderTexture に焼き込む
        const fillGraphics = new Graphics();
        fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        fillGraphics.fill({ color, alpha });

        app.renderer.render({
            container: fillGraphics,
            target: layerData.renderTexture,
            clear: false  // 既存内容の上に重ね塗り
        });

        fillGraphics.destroy({ children: true });

        // 履歴用のデータ保存（pathsData は互換性のために残す）
        const pathData = {
            id: `fill_legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'fill',
            tool: 'fill',
            color, alpha,
            timestamp: Date.now(),
            settings: { color, opacity: alpha, mode: 'fill-legacy' }
        };

        if (!layerData.pathsData) layerData.pathsData = [];
        layerData.pathsData.push(pathData);

        // サムネイル更新要求
        const layerIndex = layerManager.getLayerIndex(layer);
        const layerId = layerData.id;
        if (window.eventBus || window.TegakiEventBus) {
            const eb = window.eventBus || window.TegakiEventBus;
            eb.emit('thumbnail:layer-updated', {
                layerIndex,
                layerId,
                immediate: true
            });
        }

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
        const history = window.History;
        if (!history || history.isApplying) return;

        const layerIndex = layerManager.getLayerIndex(layer);
        const layerId = layer.layerData.id;

        const entry = {
            name: `fill-layer-${method}`,
            do: () => {
                const targetLayer = layerManager.getLayers()[layerIndex];
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
                const targetLayer = layerManager.getLayers()[layerIndex];
                if (targetLayer) {
                    this._restoreLayer(targetLayer, pathsBackup, layerManager, layerIndex);
                }
            },
            meta: { layerId, layerIndex, fillColor, fillAlpha, method }
        };

        history.push(entry);
    }

    _restoreLayer(layer, pathsBackup, layerManager, layerIndex) {
        if (!layer || !layer.layerData) return;

        const layerData = layer.layerData;
        this._clearLayerGraphics(layer, layerData);

        for (let pathData of pathsBackup) {
            try {
                const rebuildSuccess = layerManager.rebuildPathGraphics(pathData);

                if (rebuildSuccess && pathData.graphics) {
                    if (!layerData.pathsData) layerData.pathsData = [];
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

export const fillTool = new FillTool();

// 下位互換性のためにグローバルに登録
window.FillTool = fillTool;

// 初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        fillTool.initialize();
    });
} else {
    fillTool.initialize();
}

console.log('✅ fill-tool.js (ESM版) loaded');
