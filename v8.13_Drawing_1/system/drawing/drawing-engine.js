// system/drawing/drawing-engine.js
// Phase 1改修: ツール基盤統合版

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.eventBus = window.TegakiEventBus;
        this.canvas = app.canvas;

        // 新規: ツール基盤
        this.toolManager = new ToolManager(this);
        this.dataManager = new StrokeDataManager();

        // コンポーネント初期化
        this.pressureHandler = new PressureHandler();
        this.strokeRecorder = new StrokeRecorder(this.pressureHandler, this.cameraSystem);
        this.strokeRenderer = new StrokeRenderer(app);

        // BrushSettings参照を保持
        this.brushSettings = null;

        // 状態管理
        this.isDrawing = false;
        this.currentPreview = null;
        this.currentLayer = null;

        // リアルタイムブラシ設定同期
        this._syncBrushSettingsToRuntime();
        
        // ツール切り替えイベントを購読
        this._syncToolSelection();
        
        // ストロークデータ変更を購読（再描画トリガー）
        this._subscribeStrokeEvents();
    }

    setBrushSettings(brushSettings) {
        this.brushSettings = brushSettings;
        this._syncBrushSettingsToRuntime();
    }

    _syncBrushSettingsToRuntime() {
        if (!this.eventBus) return;
        this.eventBus.on('brush:size-changed', ({ size }) => {});
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {});
        this.eventBus.on('brush:color-changed', ({ color }) => {});
    }

    _syncToolSelection() {
        if (!this.eventBus) return;
        this.eventBus.on('tool:select', ({ tool }) => {
            if (this.toolManager.getCurrentToolName() !== tool) {
                this.toolManager.switchTool(tool);
            }
        });
    }

    _subscribeStrokeEvents() {
        if (!this.eventBus) return;
        
        this.eventBus.on('stroke:added', () => {
            this.requestRender();
        });
        
        this.eventBus.on('stroke:removed', () => {
            this.requestRender();
        });
        
        this.eventBus.on('stroke:updated', () => {
            this.requestRender();
        });
        
        this.eventBus.on('strokes:batchAdded', () => {
            this.requestRender();
        });
        
        this.eventBus.on('strokes:batchRemoved', () => {
            this.requestRender();
        });
    }

    // 新規: 再描画リクエスト
    requestRender() {
        // 現在は即座に再描画、Phase 5でRenderPipelineに移行
        if (this.currentLayer) {
            this.renderAllStrokes();
        }
    }

    // 新規: 全ストローク再描画（簡易実装）
    renderAllStrokes() {
        if (!this.currentLayer) return;
        
        // 既存の子要素をクリア（プレビュー以外）
        const childrenToRemove = this.currentLayer.children.filter(
            child => child !== this.currentPreview
        );
        childrenToRemove.forEach(child => {
            this.currentLayer.removeChild(child);
            child.destroy({ children: true });
        });
        
        // 全ストロークを再描画
        const allStrokes = this.dataManager.getAllStrokes();
        allStrokes.forEach(stroke => {
            const settings = {
                color: stroke.color || 0x800000,
                size: stroke.size || 3,
                alpha: stroke.alpha || 1.0
            };
            const strokeObject = this.strokeRenderer.renderFinalStroke(
                { points: stroke.points, isSingleDot: stroke.isSingleDot },
                settings
            );
            this.currentLayer.addChild(strokeObject);
        });
    }

    // 描画開始: ツールに委譲
    startDrawing(x, y, event) {
        this.currentLayer = this.layerSystem.getActiveLayer();
        if (!this.currentLayer || this.currentLayer.layerData?.locked) {
            return;
        }

        this.isDrawing = true;

        // ワールド座標取得（レイヤーローカル座標）
        const worldPos = this.cameraSystem.screenToLayer(x, y);
        const pressure = event?.pressure || 0.5;

        // ツールに委譲
        this.toolManager.delegatePointerDown(worldPos, pressure);

        if (this.eventBus) {
            this.eventBus.emit('stroke:start', {
                layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
                tool: this.toolManager.getCurrentToolName()
            });
        }
    }

    // 描画継続: ツールに委譲
    continueDrawing(x, y, event) {
        if (!this.isDrawing) return;

        const worldPos = this.cameraSystem.screenToLayer(x, y);
        const pressure = event?.pressure || 0.5;

        // ツールに委譲
        this.toolManager.delegatePointerMove(worldPos, pressure);
    }

    // 描画終了: ツールに委譲
    stopDrawing() {
        if (!this.isDrawing) return;

        const worldPos = { x: 0, y: 0 }; // 最終位置は不要
        const pressure = 0.5;

        // ツールに委譲
        this.toolManager.delegatePointerUp(worldPos, pressure);

        this.isDrawing = false;
        this.currentLayer = null;

        if (this.eventBus) {
            this.eventBus.emit('stroke:end', {
                tool: this.toolManager.getCurrentToolName()
            });
        }
    }

    // 以下、レガシー互換メソッド（Phase 2でPenToolに移行予定）
    
    updatePreview() {
        if (!this.currentLayer) return;
        this.clearPreview();

        const points = this.strokeRecorder.getCurrentPoints();
        if (points.length === 0) return;

        const settings = this.getBrushSettings();
        this.currentPreview = this.strokeRenderer.renderPreview(points, settings);
        this.currentLayer.addChild(this.currentPreview);
    }

    clearPreview() {
        if (this.currentPreview) {
            this.currentPreview.destroy({ children: true });
            this.currentPreview = null;
        }
    }

    finalizeStroke(strokeData) {
        if (!this.currentLayer || strokeData.points.length === 0) {
            return;
        }

        const settings = this.getBrushSettings();
        const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, settings);

        const strokeModel = new window.TegakiDataModels.StrokeData({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: settings.color,
            size: settings.size,
            alpha: settings.alpha,
            layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
            tool: this.toolManager.getCurrentToolName()
        });

        // DataManagerに追加
        const strokeId = this.dataManager.addStroke({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: settings.color,
            size: settings.size,
            alpha: settings.alpha
        });

        const targetLayer = this.currentLayer;
        const layerId = targetLayer.layerData?.id || targetLayer.label;

        const addStrokeCommand = {
            name: 'Add Stroke',
            do: () => {
                if (targetLayer && targetLayer.addChild) {
                    targetLayer.addChild(strokeObject);
                }
            },
            undo: () => {
                this.dataManager.removeStroke(strokeId);
                if (targetLayer && targetLayer.removeChild) {
                    targetLayer.removeChild(strokeObject);
                    strokeObject.destroy({ children: true });
                }
            },
            meta: {
                type: 'stroke',
                layerId: layerId,
                strokeData: strokeModel,
                strokeId: strokeId
            }
        };

        if (this.history && this.history.push) {
            this.history.push(addStrokeCommand);
        }

        if (this.eventBus) {
            this.eventBus.emit('layer:modified', {
                layerId: layerId,
                tool: this.toolManager.getCurrentToolName()
            });
        }
    }

    getBrushSettings() {
        if (this.brushSettings) {
            return this.brushSettings.getCurrentSettings();
        }

        if (window.brushSettings) {
            return {
                color: window.brushSettings.getColor(),
                size: window.brushSettings.getSize(),
                alpha: window.brushSettings.getAlpha ? window.brushSettings.getAlpha() : 1.0
            };
        }

        if (window.TegakiSettingsManager) {
            return {
                color: window.TegakiSettingsManager.get('pen.color') || 0x800000,
                size: window.TegakiSettingsManager.get('pen.size') || 3,
                alpha: window.TegakiSettingsManager.get('pen.opacity') || 1.0
            };
        }

        return {
            color: 0x800000,
            size: 3,
            alpha: 1.0
        };
    }

    setTool(toolName) {
        this.toolManager.switchTool(toolName);
        if (this.strokeRenderer) {
            this.strokeRenderer.setTool(toolName);
        }
    }

    cancelStroke() {
        if (!this.isDrawing) return;

        this.clearPreview();
        this.isDrawing = false;
        this.currentLayer = null;

        if (this.eventBus) {
            this.eventBus.emit('stroke:cancel');
        }
    }

    updateResolution() {
        this.strokeRenderer.updateResolution();
    }

    destroy() {
        this.clearPreview();
    }
}