// ===== system/drawing/brush-core.js - Phase 1: リアルタイムプレビュー対応版 =====
// BrushCore - ペン/消しゴム統合処理（SDF/MSDF準備完了）
// Phase 1改修: リアルタイムプレビュー・タブレットペン完全対応・即座反映

(function() {
    'use strict';

    /**
     * BrushCore - ペンと消しゴムの共通処理
     * Phase 1: リアルタイムプレビュー + 即座設定反映
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

            // プレビュー用Graphics
            this.previewGraphics = null;
            this.previewContainer = null;

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
            
            // イベントバス購読（設定変更の即座反映）
            this._subscribeToEvents();
            
            console.log('[BrushCore] Phase 1 Initialized:', {
                hasRecorder: !!this.strokeRecorder,
                hasRenderer: !!this.strokeRenderer,
                previewEnabled: true
            });
        }

        /**
         * イベント購読（設定変更の即座反映）
         */
        _subscribeToEvents() {
            if (!window.TegakiEventBus) return;

            // ブラシサイズ変更
            window.TegakiEventBus.on('brush:size-changed', (data) => {
                if (this.currentStroke) {
                    this.currentStroke.size = data.size;
                    this._updatePreview();
                }
            });

            // ブラシ色変更
            window.TegakiEventBus.on('brush:color-changed', (data) => {
                if (this.currentStroke && this.currentTool === 'pen') {
                    this.currentStroke.color = data.color;
                    this._updatePreview();
                }
            });

            // 不透明度変更
            window.TegakiEventBus.on('brush:opacity-changed', (data) => {
                if (this.currentStroke) {
                    this.currentStroke.opacity = data.opacity;
                    this._updatePreview();
                }
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
         * 現在のブラシ設定を取得
         */
        _getCurrentSettings() {
            let size = 10;
            let color = 0x800000;
            let opacity = 1.0;

            // BrushSettingsから取得
            if (this.brushSettings) {
                if (typeof this.brushSettings.size === 'number') {
                    size = this.brushSettings.size;
                } else if (typeof this.brushSettings.getSize === 'function') {
                    size = this.brushSettings.getSize();
                }

                if (this.currentTool === 'pen') {
                    if (typeof this.brushSettings.color === 'number') {
                        color = this.brushSettings.color;
                    } else if (typeof this.brushSettings.getColor === 'function') {
                        color = this.brushSettings.getColor();
                    }
                } else {
                    color = 0x000000;
                }

                if (typeof this.brushSettings.opacity === 'number') {
                    opacity = this.brushSettings.opacity;
                } else if (typeof this.brushSettings.getAlpha === 'function') {
                    opacity = this.brushSettings.getAlpha();
                } else if (typeof this.brushSettings.alpha === 'number') {
                    opacity = this.brushSettings.alpha;
                }
            }

            // Config フォールバック
            if (this.config?.brush) {
                size = this.config.brush.defaultSize || size;
                if (this.currentTool === 'pen') {
                    color = this.config.brush.defaultColor || color;
                }
                opacity = this.config.brush.defaultOpacity || opacity;
            }

            return { size, color, opacity };
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

            if (activeLayer.layerData.isBackground) {
                console.warn('[BrushCore] Cannot draw on background layer');
                return;
            }

            if (isNaN(localX) || isNaN(localY)) {
                console.error('[BrushCore] Invalid coordinates:', { localX, localY });
                return;
            }

            this.isDrawing = true;
            this.currentPointerId = pointerId;

            // 現在の設定を取得
            const settings = this._getCurrentSettings();
            this.currentStroke = {
                ...settings,
                tool: this.currentTool
            };

            // プレビューコンテナ初期化
            this._initPreviewContainer(activeLayer);

            // StrokeRecorder初期化
            if (this.strokeRecorder) {
                this.strokeRecorder.startStroke(localX, localY, pressure);
            }

            console.log(`[BrushCore] Stroke started:`, {
                position: `(${localX.toFixed(2)}, ${localY.toFixed(2)})`,
                tool: this.currentTool,
                size: settings.size,
                color: `0x${settings.color.toString(16)}`,
                opacity: settings.opacity,
                pressure
            });
        }

        /**
         * プレビューコンテナ初期化
         */
        _initPreviewContainer(layer) {
            // 既存のプレビューをクリア
            this._clearPreview();

            // 新しいプレビューGraphics作成
            this.previewGraphics = new PIXI.Graphics();
            
            // プレビューコンテナをレイヤーに追加
            layer.addChild(this.previewGraphics);
            this.previewContainer = layer;
        }

        /**
         * ストローク更新（リアルタイムプレビュー付き）
         */
        addPoint(localX, localY, pressure, pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            if (isNaN(localX) || isNaN(localY)) {
                console.error('[BrushCore] Invalid coordinates in addPoint:', { localX, localY });
                return;
            }

            // StrokeRecorderに記録
            if (this.strokeRecorder) {
                this.strokeRecorder.addPoint(localX, localY, pressure);
            }

            // リアルタイムプレビュー更新
            this._updatePreview();
        }

        /**
         * プレビュー更新（即座描画）
         */
        _updatePreview() {
            if (!this.previewGraphics || !this.strokeRecorder) return;

            // 現在の記録点を取得
            const points = this.strokeRecorder.points || [];
            if (points.length === 0) return;

            // Graphicsをクリアして再描画
            this.previewGraphics.clear();

            // StrokeRendererでプレビュー描画
            if (this.strokeRenderer && this.currentStroke) {
                const settings = {
                    color: this.currentStroke.color,
                    size: this.currentStroke.size,
                    alpha: this.currentStroke.opacity
                };

                this.strokeRenderer.renderPreview(
                    points,
                    settings,
                    this.previewGraphics
                );
            }
        }

        /**
         * プレビューをクリア
         */
        _clearPreview() {
            if (this.previewGraphics) {
                if (this.previewContainer && this.previewContainer.children.includes(this.previewGraphics)) {
                    this.previewContainer.removeChild(this.previewGraphics);
                }
                this.previewGraphics.destroy({ children: true });
                this.previewGraphics = null;
            }
            this.previewContainer = null;
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
                this._clearPreview();
                this.isDrawing = false;
                return;
            }

            if (!this.strokeRecorder) {
                console.error('[BrushCore] endStroke: strokeRecorder not available');
                this._clearPreview();
                this.isDrawing = false;
                return;
            }

            const strokeData = this.strokeRecorder.endStroke();
            
            if (strokeData && strokeData.points && strokeData.points.length > 0) {
                console.log('[BrushCore] Finalizing stroke:', {
                    pointCount: strokeData.points.length,
                    isSingleDot: strokeData.isSingleDot
                });
                
                // 確定ストロークを描画
                this._renderStroke(activeLayer, strokeData);
            }

            // プレビューをクリア
            this._clearPreview();

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

            if (this.strokeRecorder && this.strokeRecorder.isRecording) {
                this.strokeRecorder.isRecording = false;
                this.strokeRecorder.points = [];
            }

            this._clearPreview();

            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;

            console.log('[BrushCore] Stroke cancelled');
        }

        /**
         * ストローク描画（内部処理）
         */
        _renderStroke(layer, strokeData) {
            if (!this.strokeRenderer || !this.currentStroke) {
                console.error('[BrushCore] Cannot render stroke');
                return;
            }

            const settings = {
                color: this.currentStroke.color,
                size: this.currentStroke.size,
                alpha: this.currentStroke.opacity
            };

            const strokeGraphics = this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings,
                null
            );

            if (!strokeGraphics) {
                console.error('[BrushCore] Failed to render stroke');
                return;
            }

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
                this._recordHistory(layer, strokeGraphics);
            }
        }

        /**
         * History記録
         */
        _recordHistory(layer, graphics) {
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

    console.log('✅ brush-core.js (Phase 1: リアルタイムプレビュー対応版) loaded');
    console.log('   ✓ Real-time preview during stroke');
    console.log('   ✓ Immediate settings reflection (size/color/opacity)');
    console.log('   ✓ Pen/Eraser unified pipeline');
    console.log('   ✓ SDF/MSDF-ready architecture');
})();