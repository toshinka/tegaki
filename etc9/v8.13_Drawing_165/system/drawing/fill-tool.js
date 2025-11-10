/**
 * @file system/drawing/fill-tool.js
 * @description バケツツール - SDF/MSDFベクターアーキテクチャ対応版
 * 
 * 【設計方針】
 * ✅ ラスターベース FloodFill を排除
 * ✅ レイヤー全面をベクター矩形で塗りつぶし
 * ✅ GPU SDF/MSDF構造と整合性を保つ
 * ✅ History対応（Undo/Redo可能）
 * ✅ structuredClone エラー回避（Graphics オブジェクトを除外）
 * 
 * 【責務】
 * - Gキー押下で塗りつぶしツールに切り替え
 * - クリック時にレイヤー全面を指定色で塗りつぶし
 * - PixiJS Graphics による完全ベクター描画
 * 
 * 【親ファイル (このファイルが依存)】
 * - system/event-bus.js (EventBus)
 * - system/layer-system.js (LayerManager)
 * - system/drawing/brush-settings.js (BrushSettings)
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
                this.isActive = (tool === 'fill');
            });

            this.eventBus.on('tool:changed', ({ tool }) => {
                this.isActive = (tool === 'fill');
            });

            // キャンバスクリックイベント
            this.eventBus.on('canvas:pointerdown', (event) => {
                if (!this.isActive) return;
                if (!event.localX || !event.localY) return;

                this.fill(event.localX, event.localY);
            });
        }

        /**
         * 塗りつぶし実行
         * @param {number} localX - Local座標X（未使用だが互換性のため保持）
         * @param {number} localY - Local座標Y（未使用だが互換性のため保持）
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

            // 塗りつぶし色を取得（現在のBrushSettings から）
            const fillColor = brushSettings.getColor();
            const fillAlpha = brushSettings.getOpacity();

            // 🔧 structuredClone エラー回避: Graphics を除外してバックアップ
            const pathsBackup = this._clonePathsDataSafely(activeLayer.layerData.pathsData);

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
         * 🔧 structuredClone 対応: Graphics オブジェクトを除外してクローン
         * @param {Array} pathsData - パスデータ配列
         * @returns {Array} クローン可能なデータのみの配列
         */
        _clonePathsDataSafely(pathsData) {
            if (!pathsData || pathsData.length === 0) return [];

            return pathsData.map(pathData => {
                const { graphics, ...cloneable } = pathData;
                return cloneable;
            });
        }

        /**
         * レイヤーを全面塗りつぶし（ベクター矩形）
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
                layer.removeChild(child);
                if (child.destroy) {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            });

            // パスデータをクリア
            layerData.pathsData = [];

            // 塗りつぶし矩形を作成（PixiJS v8 API）
            const fillGraphics = new PIXI.Graphics();
            fillGraphics.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            fillGraphics.fill({ color, alpha });

            // パスデータとして記録
            const pathData = {
                id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'fill',
                tool: 'fill',
                color,
                alpha,
                graphics: fillGraphics,
                timestamp: Date.now(),
                settings: { color, opacity: alpha, mode: 'fill' }
            };

            layerData.pathsData.push(pathData);
            layer.addChild(fillGraphics);
        }

        /**
         * レイヤーを復元（Undo用）
         * @param {PIXI.Container} layer - 対象レイヤー
         * @param {Array} pathsBackup - バックアップされたパスデータ（Graphics除外済み）
         * @param {Object} layerManager - LayerManager
         * @param {number} layerIndex - レイヤーインデックス
         */
        _restoreLayer(layer, pathsBackup, layerManager, layerIndex) {
            if (!layer || !layer.layerData) return;

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
                layer.removeChild(child);
                if (child.destroy) {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            });

            // パスデータをクリア
            layerData.pathsData = [];

            // バックアップから復元（Graphics は rebuildPathGraphics で再生成）
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

    console.log('✅ fill-tool.js (structuredClone対応版) loaded');
    console.log('   ✓ Graphics オブジェクト除外バックアップ');
    console.log('   ✓ BrushSettings 色反映');

})();