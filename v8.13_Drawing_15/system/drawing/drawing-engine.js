// ===== system/drawing/drawing-engine.js - Phase 4: マスクベース消しゴム統合版 =====
// 透明ペン方式・ベクター削除方式を完全削除
// マスクベース消しゴムに置き換え
// 消しゴム使用時は layerData.maskTexture に黒を描画するのみ

/**
 * DrawingEngine - ペン描画統合制御クラス (マスクベース消しゴム版)
 * 
 * Phase 4 改修:
 * - applyEraserEffect() 系メソッド全削除
 * - リアルタイム消去処理削除
 * - マスクベース消しゴムに統一
 * 
 * API:
 * - startDrawing(x, y, event)
 * - continueDrawing(x, y, event)
 * - stopDrawing()
 * - setTool(toolName)
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
        
        // ===== Phase 4: 消しゴムマスクレンダラー初期化 =====
        this.eraserRenderer = new window.EraserMaskRenderer(app);

        // BrushSettings参照を保持
        this.brushSettings = null;

        // 状態管理
        this.isDrawing = false;
        this.currentPreview = null;
        this.currentLayer = null;
        this.currentSettings = null;
        this.currentTool = 'pen';
        
        // ===== Phase 4: 消しゴムプレビュー用 Graphics =====
        this.eraserPreviewGraphics = null;
        
        // BrushSettings同期
        this._syncBrushSettingsToRuntime();
        
        // ツール切り替えイベント購読
        this._syncToolSelection();
    }

    /**
     * BrushSettings設定
     */
    setBrushSettings(brushSettings) {
        this.brushSettings = brushSettings;
        this._syncBrushSettingsToRuntime();
    }

    /**
     * BrushSettingsの値をリアルタイムに同期
     */
    _syncBrushSettingsToRuntime() {
        if (!this.eventBus) return;

        this.eventBus.on('brush:size-changed', ({ size }) => {
            // getBrushSettings()で都度参照する設計のため特に処理なし
        });

        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            // getBrushSettings()で都度参照する設計のため特に処理なし
        });

        this.eventBus.on('brush:color-changed', ({ color }) => {
            // getBrushSettings()で都度参照する設計のため特に処理なし
        });
    }

    /**
     * ツール切り替えイベントを購読
     */
    _syncToolSelection() {
        if (!this.eventBus) return;

        this.eventBus.on('tool:select', ({ tool }) => {
            this.setTool(tool);
        });
    }

    /**
     * 描画開始（PointerEvent対応）
     */
    startDrawing(x, y, event) {
        // アクティブレイヤー取得（PIXI.Container自体）
        this.currentLayer = this.layerSystem.getActiveLayer();
        if (!this.currentLayer || this.currentLayer.layerData?.locked) {
            return;
        }

        // ブラシ設定取得
        this.currentSettings = this.getBrushSettings();

        // PointerEventを直接渡す
        if (event && event.pointerType) {
            this.strokeRecorder.startStrokeFromEvent(event);
        } else {
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.startStroke(x, y, pressure);
        }

        this.isDrawing = true;

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('stroke:start', {
                layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
                settings: this.currentSettings,
                tool: this.currentTool
            });
        }

        // 初回プレビュー
        this.updatePreview();
        
        // ===== Phase 4: 消しゴムモード時プレビュー円表示 =====
        if (this.currentTool === 'eraser') {
            const points = this.strokeRecorder.getCurrentPoints();
            if (points.length > 0) {
                this.updateEraserPreview(points[0]);
            }
        }
    }

    /**
     * 描画継続（PointerEvent対応）
     */
    continueDrawing(x, y, event) {
        if (!this.isDrawing) return;

        // PointerEventを直接渡す
        if (event && event.pointerType) {
            const pressure = event.pressure || 0.5;
            this.strokeRecorder.addPointFromEvent(event, pressure);
        } else {
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.addPoint(x, y, pressure);
        }

        // ブラシ設定更新
        this.currentSettings = this.getBrushSettings();

        // プレビュー更新
        this.updatePreview();

        // ===== Phase 4: 消しゴムモード時プレビュー円更新 =====
        if (this.currentTool === 'eraser') {
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            if (currentPoints.length > 0) {
                this.updateEraserPreview(currentPoints[currentPoints.length - 1]);
            }
        }

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('stroke:point', {
                points: this.strokeRecorder.getCurrentPoints(),
                settings: this.currentSettings,
                tool: this.currentTool
            });
        }
    }

    /**
     * ===== Phase 4: 描画終了（マスクベース消しゴム対応） =====
     */
    stopDrawing() {
        if (!this.isDrawing) return;

        // ストローク記録終了
        const strokeData = this.strokeRecorder.endStroke();

        // プレビュー削除
        this.clearPreview();
        this.clearEraserPreview();

        // 現在のツール保存
        const tool = this.currentTool;

        // ===== Phase 4: 消しゴムツール時はマスクに描画 =====
        if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
            const activeLayer = this.currentLayer;
            const layerData = activeLayer.layerData;
            
            // マスク存在チェック
            if (layerData && layerData.hasMask()) {
                const eraserRadius = this.currentSettings.size / 2;
                
                // マスク描画前のスナップショット取得
                const maskSnapshotBefore = this.eraserRenderer.captureMaskSnapshot(layerData);
                
                // マスクに黒を描画（消去効果）
                const success = this.eraserRenderer.renderEraserToMask(
                    layerData,
                    strokeData.points,
                    eraserRadius
                );
                
                if (success) {
                    // マスク描画後のスナップショット取得
                    const maskSnapshotAfter = this.eraserRenderer.captureMaskSnapshot(layerData);
                    
                    // History記録
                    if (this.history && maskSnapshotBefore && maskSnapshotAfter) {
                        const layerId = layerData.id;
                        const entry = {
                            name: 'Erase',
                            do: async () => {
                                await this.eraserRenderer.restoreMaskSnapshot(layerData, maskSnapshotAfter);
                                if (this.eventBus) {
                                    this.eventBus.emit('layer:modified', { layerId, tool: 'eraser' });
                                }
                            },
                            undo: async () => {
                                await this.eraserRenderer.restoreMaskSnapshot(layerData, maskSnapshotBefore);
                                if (this.eventBus) {
                                    this.eventBus.emit('layer:modified', { layerId, tool: 'eraser' });
                                }
                            },
                            meta: {
                                type: 'erase',
                                layerId: layerId,
                                tool: 'eraser'
                            }
                        };
                        
                        this.history.push(entry);
                    }
                    
                    // レイヤー更新通知
                    if (this.eventBus) {
                        this.eventBus.emit('layer:modified', {
                            layerId: layerData.id,
                            tool: 'eraser'
                        });
                    }
                    
                    // サムネイル更新
                    this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                }
            }
        } else {
            // ===== ペンツール時: 確定描画 =====
            this.finalizeStroke(strokeData, tool);
        }

        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('stroke:end', {
                strokeData: strokeData,
                tool: tool
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
     * ===== Phase 4: 消しゴムプレビュー円を更新 =====
     * @param {Object} worldPos - ワールド座標 {x, y}
     */
    updateEraserPreview(worldPos) {
        if (!this.currentLayer) return;
        
        // Graphics 初回作成
        if (!this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics = new PIXI.Graphics();
            this.currentLayer.addChild(this.eraserPreviewGraphics);
        }
        
        const radius = this.currentSettings.size / 2;
        
        // EraserMaskRenderer でプレビュー描画
        this.eraserRenderer.renderEraserPreview(
            this.eraserPreviewGraphics,
            worldPos,
            radius
        );
    }
    
    /**
     * ===== Phase 4: 消しゴムプレビュー削除 =====
     */
    clearEraserPreview() {
        if (this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics.destroy({ children: true });
            this.eraserPreviewGraphics = null;
        }
    }

    /**
     * ストローク確定描画
     * @param {Object} strokeData - {points, isSingleDot}
     * @param {string} [tool] - ツール種別（'pen' or 'eraser'）明示的に指定
     */
    finalizeStroke(strokeData, tool = null) {
        if (!this.currentLayer || strokeData.points.length === 0) {
            return;
        }

        // ツール決定（明示指定 > currentTool > デフォルト 'pen'）
        const activeTool = tool || this.currentTool || 'pen';

        // 一時的にツールを設定（renderFinalStroke 内で使用）
        const originalTool = this.strokeRenderer.currentTool;
        this.strokeRenderer.setTool(activeTool);

        // 高品質レンダリング
        const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, this.currentSettings);

        // ツールを戻す
        this.strokeRenderer.setTool(originalTool);

        // Graphics にストロークポイント情報を附属させる
        strokeObject._strokePoints = strokeData.points;
        strokeObject._strokeOptions = {
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha
        };

        // StrokeData作成
        const strokeModel = new window.TegakiDataModels.StrokeData({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha,
            layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
            tool: activeTool
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
                layerId: layerId,
                tool: activeTool
            });
        }
    }

    /**
     * ブラシ設定取得（BrushSettings優先・都度参照）
     */
    getBrushSettings() {
        // BrushSettingsインスタンスから都度参照
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

        // フォールバック（futaba-maroon）
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
        // StrokeRendererにツール状態を反映
        if (this.strokeRenderer) {
            this.strokeRenderer.setTool(toolName);
        }
        
        // 消しゴムから別ツールへ切り替え時、プレビューを削除
        if (toolName !== 'eraser') {
            this.clearEraserPreview();
        }
    }

    /**
     * 描画中断（エスケープキーなど）
     */
    cancelStroke() {
        if (!this.isDrawing) return;

        this.clearPreview();
        this.clearEraserPreview();
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
        this.clearEraserPreview();
    }
}