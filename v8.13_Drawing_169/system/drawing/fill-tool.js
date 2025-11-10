/**
 * @file system/drawing/fill-tool.js
 * @description バケツツール - Phase 1: SDF距離場FloodFill実装
 * 
 * 【設計方針】
 * ✅ GPU Compute PassによるSDF距離場ベースFloodFill
 * ✅ クリック位置から境界検出し、閉領域を塗りつぶし
 * ✅ PixiJS Graphicsのマスク機能で描画
 * ✅ History対応（Undo/Redo可能）
 * 
 * 【Phase 1実装内容】
 * - SDF距離場を用いた領域判定
 * - GPU Compute Passでのマスク生成
 * - PixiJS Textureマスクによる塗りつぶし
 * 
 * 【親ファイル (このファイルが依存)】
 * - system/event-bus.js (EventBus)
 * - system/layer-system.js (LayerManager)
 * - system/drawing/brush-settings.js (BrushSettings)
 * - system/drawing/webgpu/webgpu-compute-sdf.js (WebGPUComputeSDF - Phase 1追加メソッド)
 * - system/history.js (History)
 * - config.js (TEGAKI_CONFIG)
 * 
 * 【子ファイル (このファイルに依存)】
 * - system/drawing/drawing-engine.js (canvas:pointerdown イベント発行元)
 * - system/drawing/brush-core.js (BrushCore.setMode 経由でツール切り替え)
 * - ui/keyboard-handler.js (Gキー → tool:select イベント)
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

            // WebGPU対応チェック
            await this._checkWebGPUSupport();

            this._setupEventListeners();
            this.initialized = true;
        }

        async _checkWebGPUSupport() {
            if (!window.WebGPUCapabilities) {
                console.warn('⚠️ FillTool: WebGPUCapabilities not found');
                return;
            }

            const support = await window.WebGPUCapabilities.checkSupport();
            this.webgpuAvailable = support.supported;

            if (!this.webgpuAvailable) {
                console.warn('⚠️ FillTool: WebGPU not supported, falling back to simple fill');
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

        /**
         * 塗りつぶし実行（Phase 1: SDF FloodFill）
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         */
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

            // WebGPU利用可能ならSDF FloodFill、不可なら従来方式
            if (this.webgpuAvailable) {
                await this._fillLayerWithSDF(activeLayer, fillColor, fillAlpha, localX, localY, layerManager);
            } else {
                this._fillLayerLegacy(activeLayer, fillColor, fillAlpha, layerManager);
            }
        }

        /**
         * Phase 1: SDF距離場ベースFloodFill
         */
        async _fillLayerWithSDF(layer, color, alpha, localX, localY, layerManager) {
            const CONFIG = window.TEGAKI_CONFIG;
            const layerData = layer.layerData;

            // WebGPU ComputeSDFインスタンス取得
            const webgpuLayer = window.webgpuDrawingLayer;
            if (!webgpuLayer || !webgpuLayer.computeSDF) {
                console.warn('⚠️ FillTool: WebGPU ComputeSDF not available');
                this._fillLayerLegacy(layer, color, alpha, layerManager);
                return;
            }

            try {
                // GPU Compute PassでFloodFillマスク生成
                const maskTexture = await webgpuLayer.computeSDF.computeFloodFillMask(
                    layer,
                    localX,
                    localY,
                    2.0  // threshold（Phase 2で設定可能に）
                );

                // 既存パスデータのバックアップ
                const pathsBackup = this._clonePathsDataSafely(layerData.pathsData);

                // 既存描画を削除
                this._clearLayerGraphics(layer, layerData);

                // 塗りつぶしGraphics作成
                const fillGraphics = new PIXI.Graphics();
                fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                fillGraphics.fill({ color, alpha });

                // マスク適用
                const maskSprite = new PIXI.Sprite(maskTexture);
                fillGraphics.mask = maskSprite;
                layer.addChild(maskSprite);
                layer.addChild(fillGraphics);

                // パスデータ記録
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

                // History登録
                this._registerHistory(layer, layerManager, pathsBackup, color, alpha, 'fill-sdf');

                // サムネイル更新
                layerManager.requestThumbnailUpdate(layerManager.activeLayerIndex);

                // イベント発行
                if (this.eventBus) {
                    this.eventBus.emit('layer:filled', {
                        layerId: layerData.id,
                        color, alpha,
                        method: 'sdf-floodfill'
                    });
                }

            } catch (error) {
                console.error('❌ FillTool: SDF FloodFill error:', error);
                // フォールバック
                this._fillLayerLegacy(layer, color, alpha, layerManager);
            }
        }

        /**
         * 従来方式（全面塗りつぶし）
         */
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

            layerManager.requestThumbnailUpdate(layerManager.activeLayerIndex);

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

            const layerIndex = layerManager.activeLayerIndex;
            const layerId = layer.layerData.id;

            const entry = {
                name: `fill-layer-${method}`,
                do: () => {
                    const targetLayer = layerManager.getLayerByIndex(layerIndex);
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
                    const targetLayer = layerManager.getLayerByIndex(layerIndex);
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

    console.log('✅ fill-tool.js (Phase 1: SDF FloodFill対応版) loaded');
    console.log('   ✓ GPU Compute Pass FloodFill');
    console.log('   ✓ SDF距離場ベース領域判定');
    console.log('   ✓ フォールバック対応');

})();