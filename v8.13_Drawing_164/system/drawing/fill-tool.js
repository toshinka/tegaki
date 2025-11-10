/**
 * @file system/drawing/fill-tool.js
 * @description バケツツール - レイヤー単位の塗りつぶし機能
 * 
 * 【責務】
 * - Gキー押下で塗りつぶしツールに切り替え
 * - クリック位置のレイヤーを指定色で塗りつぶし
 * - History対応（Undo/Redo可能）
 * 
 * 【親ファイル (このファイルが依存)】
 * - system/event-bus.js (EventBus)
 * - system/layer-system.js (LayerManager)
 * - system/drawing/brush-settings.js (BrushSettings)
 * - system/history.js (History)
 * - coordinate-system.js (座標変換)
 * 
 * 【子ファイル (このファイルに依存)】
 * - system/drawing/brush-core.js (BrushCore.setMode経由)
 * - ui/keyboard-handler.js (Gキー → TOOL_FILL)
 * - core-runtime.js (api.tool.set('fill'))
 */

(function() {
    'use strict';

    class FillTool {
        constructor() {
            this.eventBus = window.TegakiEventBus;
            this.isActive = false;
            this.initialized = false;
            this.clickHandler = null;
        }

        initialize() {
            if (this.initialized) return;

            this._setupEventListeners();
            this.initialized = true;
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            // ツール切り替えイベント
            this.eventBus.on('tool:select', ({ tool }) => {
                const wasActive = this.isActive;
                this.isActive = (tool === 'fill');

                // ツールがアクティブになった時のみキャンバスイベントを登録
                if (this.isActive && !wasActive) {
                    this._registerCanvasEvents();
                } else if (!this.isActive && wasActive) {
                    this._unregisterCanvasEvents();
                }
            });

            // tool:changed イベントにも対応
            this.eventBus.on('tool:changed', ({ tool }) => {
                const wasActive = this.isActive;
                this.isActive = (tool === 'fill');

                if (this.isActive && !wasActive) {
                    this._registerCanvasEvents();
                } else if (!this.isActive && wasActive) {
                    this._unregisterCanvasEvents();
                }
            });
        }

        /**
         * キャンバスクリックイベントを登録
         */
        _registerCanvasEvents() {
            if (this.clickHandler) return;

            this.clickHandler = (event) => {
                if (!this.isActive) return;
                if (!event.localX || !event.localY) return;
                this.fill(event.localX, event.localY);
            };

            if (this.eventBus) {
                this.eventBus.on('canvas:pointerdown', this.clickHandler);
            }
        }

        /**
         * キャンバスクリックイベントを解除
         */
        _unregisterCanvasEvents() {
            if (!this.clickHandler) return;

            if (this.eventBus) {
                this.eventBus.off('canvas:pointerdown', this.clickHandler);
            }

            this.clickHandler = null;
        }

        /**
         * 塗りつぶし実行
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         */
        fill(localX, localY) {
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

            // 塗りつぶし色を取得
            const fillColor = brushSettings.getColor();
            const fillAlpha = brushSettings.getOpacity();

            // 既存のグラフィックスを保存（Undo用）
            const pathsBackup = activeLayer.layerData.paths ? 
                structuredClone(activeLayer.layerData.paths) : [];

            // 塗りつぶし実行
            this._fillLayer(activeLayer, fillColor, fillAlpha);

            // History登録
            if (window.History && !window.History._manager?.isApplying) {
                const layerIndex = layerManager.activeLayerIndex;
                const layerId = activeLayer.layerData.id;

                const entry = {
                    name: 'fill-layer',
                    do: () => {
                        const layer = layerManager.getLayerByIndex(layerIndex);
                        if (layer) {
                            this._fillLayer(layer, fillColor, fillAlpha);
                        }
                    },
                    undo: () => {
                        const layer = layerManager.getLayerByIndex(layerIndex);
                        if (layer) {
                            this._restoreLayer(layer, pathsBackup, layerManager, layerIndex);
                        }
                    },
                    meta: { 
                        layerId,
                        layerIndex,
                        fillColor,
                        fillAlpha
                    }
                };

                window.History.push(entry);
            }

            // サムネイル更新
            layerManager.requestThumbnailUpdate(layerManager.activeLayerIndex);

            // イベント発行
            if (this.eventBus) {
                this.eventBus.emit('layer:filled', {
                    layerId: activeLayer.layerData.id,
                    color: fillColor,
                    alpha: fillAlpha
                });
            }
        }

        /**
         * レイヤーを塗りつぶし
         * @param {PIXI.Container} layer - 対象レイヤー
         * @param {number} color - 塗りつぶし色 (0xRRGGBB)
         * @param {number} alpha - 透明度 (0.0-1.0)
         */
        _fillLayer(layer, color, alpha) {
            if (!layer || !layer.layerData) return;

            const layerData = layer.layerData;
            const CONFIG = window.TEGAKI_CONFIG;
            if (!CONFIG) return;

            // 既存の描画を削除（背景とマスク以外）
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layerData.backgroundGraphics && 
                    child !== layerData.maskSprite) {
                    childrenToRemove.push(child);
                }
            }

            childrenToRemove.forEach(child => {
                try {
                    layer.removeChild(child);
                    if (child.destroy && typeof child.destroy === 'function') {
                        child.destroy({ children: true, texture: false, baseTexture: false });
                    }
                } catch (error) {
                    console.error('❌ FillTool: Error removing child:', error);
                }
            });

            // パスデータをクリア
            layerData.paths = [];

            // 塗りつぶし矩形を作成
            const fillGraphics = new PIXI.Graphics();
            fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            fillGraphics.fill({ color, alpha });

            // パスデータとして記録
            const pathData = {
                type: 'fill',
                color,
                alpha,
                graphics: fillGraphics,
                timestamp: Date.now()
            };

            layerData.paths.push(pathData);
            layer.addChild(fillGraphics);
        }

        /**
         * レイヤーを復元（Undo用）
         * @param {PIXI.Container} layer - 対象レイヤー
         * @param {Array} pathsBackup - バックアップされたパスデータ
         * @param {Object} layerManager - LayerManager
         * @param {number} layerIndex - レイヤーインデックス
         */
        _restoreLayer(layer, pathsBackup, layerManager, layerIndex) {
            if (!layer || !layer.layerData || !pathsBackup) return;

            const layerData = layer.layerData;

            // 既存の描画を削除
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layerData.backgroundGraphics && 
                    child !== layerData.maskSprite) {
                    childrenToRemove.push(child);
                }
            }

            childrenToRemove.forEach(child => {
                try {
                    layer.removeChild(child);
                    if (child.destroy && typeof child.destroy === 'function') {
                        child.destroy({ children: true, texture: false, baseTexture: false });
                    }
                } catch (error) {}
            });

            // パスデータをクリア
            layerData.paths = [];

            // バックアップから復元
            for (let pathData of pathsBackup) {
                try {
                    const rebuildSuccess = layerManager.rebuildPathGraphics(pathData);

                    if (rebuildSuccess && pathData.graphics) {
                        layerData.paths.push(pathData);
                        layer.addChild(pathData.graphics);
                    }
                } catch (error) {
                    console.error('❌ FillTool: Error restoring path:', error);
                }
            }

            // サムネイル更新
            layerManager.requestThumbnailUpdate(layerIndex);

            // イベント発行
            if (this.eventBus) {
                this.eventBus.emit('layer:restored', {
                    layerId: layerData.id,
                    layerIndex,
                    pathCount: pathsBackup.length
                });
            }
        }

        /**
         * ツールがアクティブかどうか
         * @returns {boolean}
         */
        isToolActive() {
            return this.isActive;
        }

        /**
         * 破棄処理
         */
        destroy() {
            this._unregisterCanvasEvents();
            this.isActive = false;
            this.initialized = false;
        }
    }

    // グローバルに登録
    window.FillTool = new FillTool();

    // 初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.FillTool.initialize();
        });
    } else {
        window.FillTool.initialize();
    }

    console.log('✅ fill-tool.js loaded (Event Fixed)');

})();