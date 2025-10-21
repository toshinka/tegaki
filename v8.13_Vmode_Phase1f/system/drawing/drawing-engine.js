/**
 * DrawingEngine - ペン描画統合制御クラス (Phase 1: PointerEvent対応版)
 * 
 * 責務: ポインターイベント → 記録 → 描画 → 履歴のフロー制御
 *       + tiltX/Y, twistデータの取得と活用
 * 
 * API:
 * - startDrawing(x, y, event)
 * - continueDrawing(x, y, event)
 * - stopDrawing()
 */

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.eventBus = window.TegakiEventBus;

        // コンポーネント初期化
        this.pressureHandler = new PressureHandler();
        this.strokeRecorder = new StrokeRecorder(this.pressureHandler, this.cameraSystem);
        this.strokeRenderer = new StrokeRenderer(app);

        // 🆕 Phase 1: BrushSettings参照を保持
        this.brushSettings = null;

        // 状態管理
        this.isDrawing = false;
        this.currentPreview = null;
        this.currentLayer = null;
        this.currentSettings = null;
        this.currentTool = 'pen';
    }

    /**
     * 🆕 Phase 1: BrushSettings設定
     */
    setBrushSettings(brushSettings) {
        this.brushSettings = brushSettings;
    }

    /**
     * 🆕 Phase 1: 描画開始（PointerEvent対応）
     */
    startDrawing(x, y, event) {
        // ツールモード確認
        if (window.stateManager && window.stateManager.state.tool !== 'pen') {
            return;
        }

        // アクティブレイヤー取得（PIXI.Container自体）
        this.currentLayer = this.layerSystem.getActiveLayer();
        if (!this.currentLayer || this.currentLayer.layerData?.locked) {
            return;
        }

        // ブラシ設定取得
        this.currentSettings = this.getBrushSettings();

        // 🆕 Phase 1: PointerEventを直接渡す
        if (event && event.pointerType) {
            // PointerEvent対応メソッドを使用
            this.strokeRecorder.startStrokeFromEvent(event);
        } else {
            // レガシー互換（マウスなど）
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.startStroke(x, y, pressure);
        }

        this.isDrawing = true;

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('stroke:start', {
                layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
                settings: this.currentSettings
            });
        }

        // 初回プレビュー
        this.updatePreview();
    }

    /**
     * 🆕 Phase 1: 描画継続（PointerEvent対応）
     */
    continueDrawing(x, y, event) {
        if (!this.isDrawing) return;

        // 🆕 Phase 1: PointerEventを直接渡す
        if (event && event.pointerType) {
            const pressure = event.pressure || 0.5;
            this.strokeRecorder.addPointFromEvent(event, pressure);
        } else {
            // レガシー互換
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.addPoint(x, y, pressure);
        }

        // プレビュー更新
        this.updatePreview();

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('stroke:point', {
                points: this.strokeRecorder.getCurrentPoints(),
                settings: this.currentSettings
            });
        }
    }

    /**
     * 描画終了（core-runtime互換API）
     */
    stopDrawing() {
        if (!this.isDrawing) return;

        // ストローク記録終了
        const strokeData = this.strokeRecorder.endStroke();

        // プレビュー削除
        this.clearPreview();

        // 確定描画
        this.finalizeStroke(strokeData);

        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('stroke:end', {
                strokeData: strokeData
            });
        }
    }

    /**
     * リアルタイムプレビュー更新
     */
    updatePreview() {
        if (!this.currentLayer) return;

        // 既存プレビュー削除
        this.clearPreview();

        // プレビュー描画
        const points = this.strokeRecorder.getCurrentPoints();
        if (points.length === 0) return;

        this.currentPreview = this.strokeRenderer.renderPreview(points, this.currentSettings);

        // レイヤー（PIXI.Container自体）に追加
        this.currentLayer.addChild(this.currentPreview);
    }

    /**
     * プレビュー削除
     */
    clearPreview() {
        if (this.currentPreview) {
            this.currentPreview.destroy({ children: true });
            this.currentPreview = null;
        }
    }

    /**
     * ストローク確定描画
     */
    finalizeStroke(strokeData) {
        if (!this.currentLayer || strokeData.points.length === 0) {
            return;
        }

        // 高品質レンダリング（筆圧反映版）
        const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, this.currentSettings);

        // StrokeData作成
        const strokeModel = new window.TegakiDataModels.StrokeData({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha,
            layerId: this.currentLayer.layerData?.id || this.currentLayer.label
        });

        // 履歴コマンド作成（レイヤー参照をクロージャで確実に保持）
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
                if (targetLayer && targetLayer.removeChild) {
                    targetLayer.removeChild(strokeObject);
                    strokeObject.destroy({ children: true });
                }
            },
            meta: {
                type: 'stroke',
                layerId: layerId,
                strokeData: strokeModel
            }
        };

        // 履歴に追加
        if (this.history && this.history.push) {
            this.history.push(addStrokeCommand);
        }

        // レイヤー更新通知
        if (this.eventBus) {
            this.eventBus.emit('layer:modified', {
                layerId: layerId
            });
        }
    }

    /**
     * 🆕 Phase 1: ブラシ設定取得（BrushSettings優先）
     */
    getBrushSettings() {
        // 🆕 Phase 1: BrushSettingsインスタンスから取得
        if (this.brushSettings) {
            return this.brushSettings.getCurrentSettings();
        }

        // レガシー互換: グローバルから取得
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

        // 🆕 Phase 1: フォールバック（futaba-maroon）
        return {
            color: 0x800000,
            size: 3,
            alpha: 1.0
        };
    }

    /**
     * ツール設定
     */
    setTool(toolName) {
        this.currentTool = toolName;
    }

    /**
     * 描画中断（エスケープキーなど）
     */
    cancelStroke() {
        if (!this.isDrawing) return;

        this.clearPreview();
        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;

        if (this.eventBus) {
            this.eventBus.emit('stroke:cancel');
        }
    }

    /**
     * 解像度更新（ウィンドウリサイズ時）
     */
    updateResolution() {
        this.strokeRenderer.updateResolution();
    }

    /**
     * クリーンアップ
     */
    destroy() {
        this.clearPreview();
    }
}