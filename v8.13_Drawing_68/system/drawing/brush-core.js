// ===== system/drawing/brush-core.js - 描画修正版 =====
// BrushCore - ペン/消しゴム統合処理
// 修正: StrokeRenderer.renderFinalStroke() の呼び出しパラメータ修正

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
            this.strokeRecorder = null;
            this.strokeRenderer = null;
            
            // StrokeRecorder初期化
            if (window.StrokeRecorder && window.PressureHandler) {
                const pressureHandler = new window.PressureHandler();
                this.strokeRecorder = new window.StrokeRecorder(pressureHandler, this.cameraSystem);
            }
            
            // StrokeRenderer初期化
            if (window.StrokeRenderer) {
                this.strokeRenderer = new window.StrokeRenderer(this.app, this.layerSystem, this.cameraSystem);
            }
            
            // CoordinateSystem参照
            this.coordSystem = window.CoordinateSystem;
            
            console.log('[BrushCore] Initialized:', {
                hasRecorder: !!this.strokeRecorder,
                hasRenderer: !!this.strokeRenderer
            });
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
            
            // StrokeRendererにもツールを伝える
            if (this.strokeRenderer) {
                this.strokeRenderer.setTool(tool);
            }
            
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

            // NaNチェック
            if (isNaN(localX) || isNaN(localY)) {
                console.error('[BrushCore] Invalid coordinates:', { localX, localY });
                return;
            }

            this.isDrawing = true;
            this.currentPointerId = pointerId;

            // ブラシ設定取得（完全なフォールバック）
            let size = 10; // デフォルト
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
                } else if (typeof this.brushSettings.alpha === 'number') {
                    opacity = this.brushSettings.alpha;
                }
            }
            if (this.config) {
                if (this.config.brush?.defaultOpacity) opacity = this.config.brush.defaultOpacity;
                else if (this.config.pen?.opacity) opacity = this.config.pen.opacity;
            }

            // 現在のストローク情報を保存
            this.currentStroke = {
                size,
                color,
                opacity,
                tool: this.currentTool
            };

            // StrokeRecorder初期化
            if (this.strokeRecorder) {
                this.strokeRecorder.startStroke(localX, localY, pressure);
            }

            console.log(`[BrushCore] Stroke started:`, {
                position: `(${localX.toFixed(2)}, ${localY.toFixed(2)})`,
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

            // NaNチェック
            if (isNaN(localX) || isNaN(localY)) {
                console.error('[BrushCore] Invalid coordinates in addPoint:', { localX, localY });
                return;
            }

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
                console.warn('[BrushCore] endStroke: No active layer');
                this.isDrawing = false;
                return;
            }

            // ストローク確定
            if (!this.strokeRecorder) {
                console.error('[BrushCore] endStroke: strokeRecorder not available');
                this.isDrawing = false;
                return;
            }

            const strokeData = this.strokeRecorder.endStroke();
            
            console.log('[BrushCore] endStroke: strokeData received:', {
                hasData: !!strokeData,
                pointCount: strokeData?.points?.length || 0,
                isSingleDot: strokeData?.isSingleDot,
                firstPoint: strokeData?.points?.[0]
            });
            
            if (strokeData && strokeData.points && strokeData.points.length > 0) {
                console.log('[BrushCore] Finalizing stroke:', {
                    pointCount: strokeData.points.length,
                    isSingleDot: strokeData.isSingleDot
                });
                
                // ★重要：ここでペン/消しゴムを統一的に描画
                this._renderStroke(activeLayer, strokeData);
            } else {
                console.warn('[BrushCore] endStroke: No valid stroke data to render');
            }

            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;

            console.log('[BrushCore] Stroke ended');
        }

        /**
         * ストローク中断
         */
        cancelStroke(pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            if (this.strokeRecorder && this.strokeRecorder.isActive && this.strokeRecorder.isActive()) {
                // 記録を強制終了（描画はしない）
                this.strokeRecorder.isRecording = false;
                this.strokeRecorder.points = [];
            }

            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;

            console.log('[BrushCore] Stroke cancelled');
        }

        /**
         * ストローク描画（内部処理）
         * 修正: StrokeRenderer.renderFinalStroke() の正しい引数渡し
         */
        _renderStroke(layer, strokeData) {
            if (!this.strokeRenderer) {
                console.error('[BrushCore] StrokeRenderer not available');
                return;
            }

            if (!this.currentStroke) {
                console.error('[BrushCore] No current stroke settings');
                return;
            }

            console.log('[BrushCore] Rendering stroke:', {
                pointCount: strokeData.points?.length,
                tool: this.currentTool,
                settings: this.currentStroke
            });

            // 🔧 修正: StrokeRenderer.renderFinalStroke() の正しい呼び出し方
            // renderFinalStroke(strokeData, settings, targetGraphics)
            // settings = { color, size, alpha }
            const settings = {
                color: this.currentStroke.color,
                size: this.currentStroke.size,
                alpha: this.currentStroke.opacity // ★重要: alpha という名前で渡す
            };

            const strokeGraphics = this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings,
                null // 新しいGraphicsを作成
            );

            if (!strokeGraphics) {
                console.error('[BrushCore] Failed to render stroke');
                return;
            }

            console.log('[BrushCore] Stroke rendered successfully:', {
                graphicsType: strokeGraphics.constructor.name,
                childCount: strokeGraphics.children?.length,
                blendMode: strokeGraphics.blendMode
            });

            // レイヤーに追加
            layer.addChild(strokeGraphics);

            // パスデータをレイヤーに保存
            if (!layer.layerData.paths) {
                layer.layerData.paths = [];
            }
            
            layer.layerData.paths.push({
                id: `path_${Date.now()}_${Math.random()}`,
                points: strokeData.points,
                size: this.currentStroke.size,
                color: this.currentStroke.color,
                opacity: this.currentStroke.opacity,
                tool: this.currentTool,
                graphics: strokeGraphics,
                timestamp: Date.now()
            });

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
            if (window.History && (!window.History._manager || !window.History._manager.isApplying)) {
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

    console.log('✅ brush-core.js (描画修正版) loaded');
    console.log('   ✓ Pen/Eraser unified pipeline');
    console.log('   ✓ StrokeRenderer.renderFinalStroke() 引数修正');
    console.log('   ✓ NaN チェック追加');
    console.log('   ✓ SDF/MSDF-ready architecture');
})();