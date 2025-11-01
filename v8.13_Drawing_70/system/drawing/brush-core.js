// ===== system/drawing/brush-core.js - Phase 3-B: SDF完全統合版 =====
// BrushCore - ペン/消しゴム統合処理（SDF/MSDF完全対応）
// Phase 3-B改修: SDFプレビュー・Mesh描画完全統合

(function() {
    'use strict';

    /**
     * BrushCore - ペンと消しゴムの共通処理
     * Phase 3-B: SDF完全統合 + リアルタイムプレビュー
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

            // Phase 3-B: プレビュー用Container（GraphicsからContainerへ）
            this.previewContainer = null;
            this.previewObject = null; // Graphics または Mesh/Container
            this.previewParent = null;

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
            
            console.log('[BrushCore] Phase 3-B Initialized:', {
                hasRecorder: !!this.strokeRecorder,
                hasRenderer: !!this.strokeRenderer,
                hasMaskSupport: true,
                sdfEnabled: this.strokeRenderer?.sdfEnabled || false,
                previewEnabled: true
            });
        }

        /**
         * イベント購読（設定変更の即座反映）
         */
        _subscribeToEvents() {
            if (!window.TegakiEventBus) return;

            // ブラシサイズ変更（即座反映）
            window.TegakiEventBus.on('brush:size-changed', (data) => {
                if (this.currentStroke) {
                    this.currentStroke.size = data.size;
                    console.log('[BrushCore] Size updated during stroke:', data.size);
                }
                if (this.brushSettings && typeof this.brushSettings.setSize === 'function') {
                    this.brushSettings.setSize(data.size);
                }
                this._updatePreview();
            });

            // ブラシ色変更（即座反映）
            window.TegakiEventBus.on('brush:color-changed', (data) => {
                if (this.currentStroke && this.currentTool === 'pen') {
                    this.currentStroke.color = data.color;
                    console.log('[BrushCore] Color updated during stroke:', `0x${data.color.toString(16)}`);
                }
                if (this.brushSettings && typeof this.brushSettings.setColor === 'function') {
                    this.brushSettings.setColor(data.color);
                }
                this._updatePreview();
            });

            // 不透明度変更（即座反映）
            window.TegakiEventBus.on('brush:opacity-changed', (data) => {
                if (this.currentStroke) {
                    this.currentStroke.opacity = data.opacity;
                    console.log('[BrushCore] Opacity updated during stroke:', data.opacity);
                }
                if (this.brushSettings && typeof this.brushSettings.setAlpha === 'function') {
                    this.brushSettings.setAlpha(data.opacity);
                }
                this._updatePreview();
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
                    color = 0x000000; // 消しゴムは黒（マスク用）
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

            // マスク確保
            this._ensureLayerMask(activeLayer);

            this.isDrawing = true;
            this.currentPointerId = pointerId;

            // 現在の設定を取得
            const settings = this._getCurrentSettings();
            this.currentStroke = {
                ...settings,
                tool: this.currentTool,
                layerId: activeLayer.layerData.id
            };

            // Phase 3-B: プレビューコンテナ初期化
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
                pressure,
                sdfEnabled: this.strokeRenderer?.sdfEnabled || false
            });
        }

        /**
         * レイヤーマスクを確保（自動生成）
         */
        _ensureLayerMask(layer) {
            if (layer.layerData.hasMask()) {
                return; // 既に存在
            }

            console.log('[BrushCore] Initializing layer mask for:', layer.layerData.name);

            const success = layer.layerData.initializeMask(
                this.config.canvas.width,
                this.config.canvas.height,
                this.app.renderer
            );

            if (success && layer.layerData.maskSprite) {
                // maskSpriteはrenderable=falseなので表示されない
                if (!layer.children.includes(layer.layerData.maskSprite)) {
                    layer.addChildAt(layer.layerData.maskSprite, 0);
                }
                console.log('[BrushCore] Mask initialized successfully');
            } else {
                console.error('[BrushCore] Failed to initialize mask');
            }
        }

        /**
         * Phase 3-B: プレビューコンテナ初期化（Container対応）
         */
        _initPreviewContainer(layer) {
            // 既存のプレビューをクリア
            this._clearPreview();

            // Phase 3-B: GraphicsまたはContainerを作成
            // SDFの場合はContainer、レガシーの場合はGraphics
            if (this.strokeRenderer?.sdfEnabled && this.currentTool === 'pen') {
                this.previewObject = new PIXI.Container();
            } else {
                this.previewObject = new PIXI.Graphics();
            }
            
            // プレビューをレイヤーに追加
            layer.addChild(this.previewObject);
            this.previewParent = layer;
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
         * Phase 3-B: プレビュー更新（SDF対応）
         */
        _updatePreview() {
            if (!this.previewObject || !this.strokeRecorder || !this.isDrawing) return;

            // 現在の記録点を取得
            const points = this.strokeRecorder.points || [];
            if (points.length === 0) return;

            // 既存のプレビューをクリア
            if (this.previewObject instanceof PIXI.Graphics) {
                this.previewObject.clear();
            } else if (this.previewObject instanceof PIXI.Container) {
                // Container内の子要素を削除
                while (this.previewObject.children.length > 0) {
                    const child = this.previewObject.children[0];
                    this.previewObject.removeChild(child);
                    if (child.destroy) {
                        child.destroy({ children: true });
                    }
                }
            }

            // StrokeRendererでプレビュー描画
            if (this.strokeRenderer && this.currentStroke) {
                const settings = {
                    color: this.currentStroke.color,
                    size: this.currentStroke.size,
                    alpha: this.currentStroke.opacity
                };

                const result = this.strokeRenderer.renderPreview(
                    points,
                    settings,
                    this.previewObject
                );

                // renderPreviewが新しいオブジェクトを返す場合は置き換え
                if (result && result !== this.previewObject) {
                    if (this.previewParent && this.previewParent.children.includes(this.previewObject)) {
                        this.previewParent.removeChild(this.previewObject);
                    }
                    if (this.previewObject.destroy) {
                        this.previewObject.destroy({ children: true });
                    }
                    this.previewObject = result;
                    if (this.previewParent) {
                        this.previewParent.addChild(this.previewObject);
                    }
                }
            }
        }

        /**
         * プレビューをクリア
         */
        _clearPreview() {
            if (this.previewObject) {
                if (this.previewParent && this.previewParent.children.includes(this.previewObject)) {
                    this.previewParent.removeChild(this.previewObject);
                }
                this.previewObject.destroy({ children: true });
                this.previewObject = null;
            }
            this.previewParent = null;
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
                    isSingleDot: strokeData.isSingleDot,
                    tool: this.currentTool
                });
                
                // ツール別の確定処理
                if (this.currentTool === 'eraser') {
                    this._renderEraserStroke(activeLayer, strokeData);
                } else {
                    this._renderPenStroke(activeLayer, strokeData);
                }
            }

            // プレビューをクリア
            this._clearPreview();

            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;

            console.log('[BrushCore] Stroke ended');
        }

        /**
         * ペンストローク描画
         */
        _renderPenStroke(layer, strokeData) {
            if (!this.strokeRenderer || !this.currentStroke) {
                console.error('[BrushCore] Cannot render pen stroke');
                return;
            }

            const settings = {
                color: this.currentStroke.color,
                size: this.currentStroke.size,
                alpha: this.currentStroke.opacity
            };

            const strokeObject = this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings,
                null
            );

            if (!strokeObject) {
                console.error('[BrushCore] Failed to render pen stroke');
                return;
            }

            // レイヤーに追加
            layer.addChild(strokeObject);

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
                tool: 'pen',
                graphics: strokeObject,
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
                    tool: 'pen'
                });
            }

            // History記録
            if (window.History && (!window.History._manager || !window.History._manager.isApplying)) {
                this._recordPenHistory(layer, strokeObject);
            }
        }

        /**
         * 消しゴムストローク描画（マスクテクスチャへ）
         */
        _renderEraserStroke(layer, strokeData) {
            if (!this.strokeRenderer || !this.currentStroke) {
                console.error('[BrushCore] Cannot render eraser stroke');
                return;
            }

            if (!layer.layerData.hasMask()) {
                console.error('[BrushCore] Layer mask not available');
                return;
            }

            const settings = {
                color: 0xFFFFFF, // 白（マスク用）
                size: this.currentStroke.size,
                alpha: 1.0 // 完全不透明
            };

            // maskTextureに直接描画
            const success = this.strokeRenderer.renderToMask(
                layer.layerData.maskTexture,
                strokeData,
                settings
            );

            if (!success) {
                console.error('[BrushCore] Failed to render eraser stroke to mask');
                return;
            }

            console.log('[BrushCore] Eraser stroke rendered to mask');

            // サムネイル更新リクエスト
            const layerIndex = this.layerSystem.getLayerIndex(layer);
            if (layerIndex >= 0) {
                this.layerSystem.requestThumbnailUpdate(layerIndex);
            }

            // イベント発行
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('layer:eraser-applied', {
                    layerIndex,
                    layerId: layer.layerData.id
                });
            }

            // History記録（マスクスナップショット）
            if (window.History && (!window.History._manager || !window.History._manager.isApplying)) {
                this._recordEraserHistory(layer);
            }
        }

        /**
         * ペンHistory記録
         */
        _recordPenHistory(layer, graphics) {
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
                    tool: 'pen',
                    layerId: layer.layerData.id,
                    timestamp: Date.now()
                }
            };

            window.History.push(command);
        }

        /**
         * 消しゴムHistory記録（マスクスナップショット方式）
         */
        _recordEraserHistory(layer) {
            const layerIndex = this.layerSystem.getLayerIndex(layer);
            
            // 現在のマスクテクスチャをスナップショット
            const maskSnapshot = this._captureMaskSnapshot(layer.layerData.maskTexture);
            
            const command = {
                name: 'erase-stroke',
                do: () => {
                    // 既に適用済み（何もしない）
                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                undo: () => {
                    // スナップショットから復元
                    if (maskSnapshot) {
                        this._restoreMaskSnapshot(layer.layerData.maskTexture, maskSnapshot);
                    }
                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                meta: {
                    type: 'erase',
                    tool: 'eraser',
                    layerId: layer.layerData.id,
                    timestamp: Date.now()
                }
            };

            window.History.push(command);
        }

        /**
         * マスクスナップショット作成
         */
        _captureMaskSnapshot(maskTexture) {
            try {
                const canvas = this.app.renderer.extract.canvas(maskTexture);
                return canvas.toDataURL();
            } catch (error) {
                console.error('[BrushCore] Failed to capture mask snapshot:', error);
                return null;
            }
        }

        /**
         * マスクスナップショット復元
         */
        _restoreMaskSnapshot(maskTexture, snapshotDataURL) {
            try {
                const img = new Image();
                img.onload = () => {
                    const tempSprite = PIXI.Sprite.from(img);
                    this.app.renderer.render({
                        container: tempSprite,
                        target: maskTexture,
                        clear: true
                    });
                    tempSprite.destroy();
                };
                img.src = snapshotDataURL;
            } catch (error) {
                console.error('[BrushCore] Failed to restore mask snapshot:', error);
            }
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

    console.log('✅ brush-core.js (Phase 3-B: SDF完全統合版) loaded');
    console.log('   ✓ SDF preview with Container support');
    console.log('   ✓ Mesh-based final stroke rendering');
    console.log('   ✓ Automatic fallback to legacy Graphics');
    console.log('   ✓ Real-time settings reflection');
    console.log('   ✓ Mask-based eraser support');
    console.log('   ✓ Complete history support');
})();