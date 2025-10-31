// ===== system/drawing/brush-core.js =====
// BrushCore - ペン/消しゴム統合処理
// 将来のSDF/MSDF移行を見据えた設計

(function() {
    'use strict';

    /**
     * BrushCore - ペンと消しゴムの共通処理
     * ブレンドモード切替のみで描画/消去を実現
     */
    class BrushCore {
        constructor(app, layerSystem, cameraSystem, config) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.config = config || window.TEGAKI_CONFIG;

            // ブラシ設定
            this.brushSettings = null;
            
            // 現在のツール ('pen' | 'eraser')
            this.currentTool = 'pen';
            
            // ストローク状態
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentPointerId = null;

            // レンダラー参照
            this.strokeRecorder = window.StrokeRecorder ? new window.StrokeRecorder() : null;
            this.strokeRenderer = window.StrokeRenderer ? new window.StrokeRenderer() : null;
            
            // CoordinateSystem参照
            this.coordSystem = window.CoordinateSystem;
        }

        /**
         * ブラシ設定を設定
         */
        setBrushSettings(settings) {
            this.brushSettings = settings;
        }

        /**
         * ツールを切り替え
         */
        setTool(tool) {
            if (tool !== 'pen' && tool !== 'eraser') {
                console.warn(`[BrushCore] Invalid tool: ${tool}`);
                return;
            }
            
            this.currentTool = tool;
            console.log(`[BrushCore] Tool changed: ${tool}`);
            
            // イベント発行
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('tool:changed', { tool });
            }
        }

        /**
         * ストローク開始
         */
        startStroke(localX, localY, pressure, pointerId) {
            if (this.isDrawing) {
                console.warn('[BrushCore] Already drawing');
                return;
            }

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.warn('[BrushCore] No active layer');
                return;
            }

            // 背景レイヤーには描画不可
            if (activeLayer.layerData.isBackground) {
                console.warn('[BrushCore] Cannot draw on background layer');
                return;
            }

            this.isDrawing = true;
            this.currentPointerId = pointerId;

            // ブラシ設定取得（完全なフォールバック）
            let size = 3; // デフォルト
            let color = 0x800000; // デフォルト
            let opacity = 1.0; // デフォルト

            // Size取得
            if (this.brushSettings) {
                if (typeof this.brushSettings.size === 'number') {
                    size = this.brushSettings.size;
                } else if (typeof this.brushSettings.getSize === 'function') {
                    size = this.brushSettings.getSize();
                }
            }
            if (this.config) {
                if (this.config.brush?.defaultSize) size = this.config.brush.defaultSize;
                else if (this.config.pen?.size) size = this.config.pen.size;
            }

            // Color取得（消しゴムは常に黒）
            if (this.currentTool === 'pen') {
                if (this.brushSettings) {
                    if (typeof this.brushSettings.color === 'number') {
                        color = this.brushSettings.color;
                    } else if (typeof this.brushSettings.getColor === 'function') {
                        color = this.brushSettings.getColor();
                    }
                }
                if (this.config) {
                    if (this.config.brush?.defaultColor) color = this.config.brush.defaultColor;
                    else if (this.config.pen?.color) color = this.config.pen.color;
                }
            } else {
                color = 0x000000; // 消しゴムは黒
            }

            // Opacity取得
            if (this.brushSettings) {
                if (typeof this.brushSettings.opacity === 'number') {
                    opacity = this.brushSettings.opacity;
                } else if (typeof this.brushSettings.getAlpha === 'function') {
                    opacity = this.brushSettings.getAlpha();
                }
            }
            if (this.config) {
                if (this.config.brush?.defaultOpacity) opacity = this.config.brush.defaultOpacity;
                else if (this.config.pen?.opacity) opacity = this.config.pen.opacity;
            }

            // StrokeRecorder初期化
            if (this.strokeRecorder) {
                this.strokeRecorder.startStroke(localX, localY, pressure, {
                    size,
                    color,
                    opacity,
                    tool: this.currentTool
                });
            }

            console.log(`[BrushCore] Stroke started:`, {
                position: `(${localX}, ${localY})`,
                tool: this.currentTool,
                size,
                color: `0x${color.toString(16)}`,
                opacity,
                pressure
            });
        }

        /**
         * ストローク更新
         */
        addPoint(localX, localY, pressure, pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            if (this.strokeRecorder) {
                this.strokeRecorder.addPoint(localX, localY, pressure);
            }
        }

        /**
         * ストローク終了
         */
        endStroke(pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                this.isDrawing = false;
                return;
            }

            // ストローク確定
            if (this.strokeRecorder) {
                const strokeData = this.strokeRecorder.finalizeStroke();
                
                if (strokeData && strokeData.points && strokeData.points.length > 0) {
                    // ★重要：ここでペン/消しゴムを統一的に描画
                    this._renderStroke(activeLayer, strokeData);
                }
            }

            this.isDrawing = false;
            this.currentPointerId = null;

            console.log('[BrushCore] Stroke ended');
        }

        /**
         * ストローク中断
         */
        cancelStroke(pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            if (this.strokeRecorder) {
                this.strokeRecorder.cancelStroke();
            }

            this.isDrawing = false;
            this.currentPointerId = null;

            console.log('[BrushCore] Stroke cancelled');
        }

        /**
         * ストローク描画（内部処理）
         */
        _renderStroke(layer, strokeData) {
            if (!this.strokeRenderer) {
                console.error('[BrushCore] StrokeRenderer not available');
                return;
            }

            console.log('[BrushCore] Rendering stroke:', {
                pointCount: strokeData.points?.length,
                tool: this.currentTool,
                hasRenderer: !!this.strokeRenderer,
                rendererType: this.strokeRenderer.constructor.name
            });

            // ★ツールに応じてブレンドモード切替
            const blendMode = this.currentTool === 'pen' 
                ? PIXI.BLEND_MODES.NORMAL 
                : PIXI.BLEND_MODES.ERASE;

            // StrokeRendererで描画
            const strokeGraphics = this.strokeRenderer.renderFinalStroke(
                strokeData,
                layer,
                {
                    blendMode: blendMode,
                    applyMask: true // レイヤーマスク適用
                }
            );

            if (!strokeGraphics) {
                console.error('[BrushCore] Failed to render stroke');
                return;
            }

            console.log('[BrushCore] Stroke rendered successfully:', {
                graphicsType: strokeGraphics.constructor.name,
                childCount: strokeGraphics.children?.length
            });

            // レイヤーに追加
            layer.addChild(strokeGraphics);

            // パスデータをレイヤーに保存
            if (layer.layerData.paths) {
                layer.layerData.paths.push({
                    id: `path_${Date.now()}_${Math.random()}`,
                    points: strokeData.points,
                    size: strokeData.size,
                    color: strokeData.color,
                    opacity: strokeData.opacity,
                    tool: this.currentTool,
                    graphics: strokeGraphics,
                    timestamp: Date.now()
                });
            }

            // サムネイル更新リクエスト
            const layerIndex = this.layerSystem.getLayerIndex(layer);
            if (layerIndex >= 0) {
                this.layerSystem.requestThumbnailUpdate(layerIndex);
            }

            // イベント発行
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('layer:stroke-added', {
                    layerIndex,
                    layerId: layer.layerData.id,
                    tool: this.currentTool
                });
            }

            // History記録
            if (window.History && !window.History._manager?.isApplying) {
                this._recordHistory(layer, strokeGraphics, strokeData);
            }
        }

        /**
         * History記録
         */
        _recordHistory(layer, graphics, strokeData) {
            const layerIndex = this.layerSystem.getLayerIndex(layer);
            
            const command = {
                name: 'draw-stroke',
                do: () => {
                    if (!layer.children.includes(graphics)) {
                        layer.addChild(graphics);
                    }
                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                undo: () => {
                    if (layer.children.includes(graphics)) {
                        layer.removeChild(graphics);
                    }
                    if (graphics.destroy) {
                        graphics.destroy({ children: true });
                    }
                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                meta: {
                    type: 'stroke',
                    tool: this.currentTool,
                    layerId: layer.layerData.id,
                    timestamp: Date.now()
                }
            };

            window.History.push(command);
        }

        /**
         * 現在のツールを取得
         */
        getTool() {
            return this.currentTool;
        }

        /**
         * 描画中かどうか
         */
        getIsDrawing() {
            return this.isDrawing;
        }
    }

    // グローバル公開
    window.BrushCore = BrushCore;

    console.log('✅ brush-core.js loaded');
    console.log('   ✓ Pen/Eraser unified pipeline');
    console.log('   ✓ SDF/MSDF-ready architecture');
})();