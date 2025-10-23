/**
 * DrawingEngine - ペン描画統合制御クラス (消しゴムツール対応版 Phase 1)
 * 
 * 改修:
 * - ツール切り替え時にstrokeRendererのsetTool()を呼び出し
 * - EventBus 'tool:select' を購読してツール状態を同期
 * - 消しゴム効果の適用メソッドを追加
 * 
 * API:
 * - startDrawing(x, y, event)
 * - continueDrawing(x, y, event)
 * - stopDrawing()
 * - applyEraserEffect(eraserPath) [NEW Phase 1]
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

        // BrushSettings参照を保持
        this.brushSettings = null;

        // 状態管理
        this.isDrawing = false;
        this.currentPreview = null;
        this.currentLayer = null;
        this.currentSettings = null;
        this.currentTool = 'pen';
        
        // リアルタイムブラシ設定同期
        this._syncBrushSettingsToRuntime();
        
        // ツール切り替えイベントを購読
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

        // 描画途中にブラシ設定が変わる可能性があるため、都度更新
        this.currentSettings = this.getBrushSettings();

        // プレビュー更新
        this.updatePreview();

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
     * 描画終了（core-runtime互換API）
     */
    stopDrawing() {
        if (!this.isDrawing) return;

        // ストローク記録終了
        const strokeData = this.strokeRecorder.endStroke();

        // プレビュー削除
        this.clearPreview();

        // 現在のツール保存（strokeRenderer が参照できるように）
        const tool = this.currentTool;

        // 消しゴムツール時: 消去効果を適用
        if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
            this.applyEraserEffect(strokeData);
        } else {
            // ペンツール時: 確定描画（消しゴムの分割描画でも透明ペンを使用）
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

        // ✅ 一時的にツールを設定（renderFinalStroke 内で使用）
        const originalTool = this.strokeRenderer.currentTool;
        this.strokeRenderer.setTool(activeTool);

        // 高品質レンダリング（プレビュー同一計算式）
        const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, this.currentSettings);

        // ツールを戻す
        this.strokeRenderer.setTool(originalTool);

        // ✅ Graphics にストロークポイント情報を附属させる（消しゴムで参照可能に）
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
            name: activeTool === 'eraser' ? 'Erase' : 'Add Stroke',
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
                type: activeTool === 'eraser' ? 'erase' : 'stroke',
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
     * ===== Phase 1 新規追加メソッド START =====
     */

    /**
     * 消しゴム効果を適用
     * eraserPath（消しゴム軌跡）で既存ストロークを削除・分割
     */
    applyEraserEffect(eraserPath) {
        const eraserPoints = eraserPath.points;
        if (!eraserPoints || eraserPoints.length === 0) return;

        const eraserRadius = this.currentSettings.size / 2;
        const activeLayer = this.currentLayer;
        if (!activeLayer) return;

        const VectorOps = window.TegakiDrawing?.VectorOperations;
        if (!VectorOps) return;

        // レイヤーから全描画オブジェクトを取得
        const allChildren = activeLayer.children || [];
        const modifications = []; // { graphics, points, segments }

        // 各描画オブジェクトに対して消去判定
        for (let childIndex = 0; childIndex < allChildren.length; childIndex++) {
            const graphics = allChildren[childIndex];

            // Graphics オブジェクトのみを処理（背景除外）
            if (!graphics || !graphics.geometry || graphics.label?.includes('background')) {
                continue;
            }

            // Graphics から元のストロークポイント情報を取得
            // 既存システムでは strokeData が Graphics に附属している可能性がある
            let sourcePoints = graphics._strokePoints;

            // ない場合は layerData.paths から検索
            if (!sourcePoints && activeLayer.layerData?.paths) {
                for (const path of activeLayer.layerData.paths) {
                    if (path.graphics === graphics && path.points) {
                        sourcePoints = path.points;
                        break;
                    }
                }
            }

            // ポイント配列がない場合スキップ
            if (!sourcePoints || sourcePoints.length === 0) continue;

            // 消しゴム軌跡上の各点で交差判定
            let hasIntersection = false;
            for (const eraserPoint of eraserPoints) {
                if (VectorOps.testCircleStrokeIntersection(
                    eraserPoint,
                    eraserRadius,
                    sourcePoints
                )) {
                    hasIntersection = true;
                    break;
                }
            }

            if (hasIntersection) {
                // 分割実行
                const segments = this.splitPathByEraserTrail(
                    sourcePoints,
                    eraserPoints,
                    eraserRadius
                );
                if (segments.length > 0) {
                    modifications.push({ 
                        graphics: graphics, 
                        points: sourcePoints,
                        segments: segments,
                        childIndex: childIndex
                    });
                }
            }
        }

        // 変更を適用
        this.applyPathModifications(modifications);
    }

    /**
     * 消しゴムの軌跡全体でパスを分割
     */
    splitPathByEraserTrail(sourcePoints, eraserPoints, eraserRadius) {
        const VectorOps = window.TegakiDrawing?.VectorOperations;
        if (!VectorOps) return [];

        let remainingSegments = [sourcePoints];

        // 消しゴムの各点で順次分割
        for (const eraserPoint of eraserPoints) {
            const newSegments = [];

            for (const segment of remainingSegments) {
                const splits = VectorOps.splitStrokeByCircle(
                    segment,
                    eraserPoint,
                    eraserRadius,
                    2 // 最小ポイント数
                );
                newSegments.push(...splits);
            }

            remainingSegments = newSegments.length > 0 ? newSegments : remainingSegments;
        }

        return remainingSegments;
    }

    /**
     * パス変更の適用とHistory記録
     */
    applyPathModifications(modifications) {
        const activeLayer = this.currentLayer;
        if (!activeLayer || modifications.length === 0) return;

        const removedGraphics = [];
        const addedGraphics = [];

        // 元のパスを削除、分割後のパスを作成
        for (const { graphics, points, segments } of modifications) {
            removedGraphics.push(graphics);

            // UIから削除
            activeLayer.removeChild(graphics);
            graphics.destroy({ children: true });

            // 分割後のパスを追加
            for (const segmentPoints of segments) {
                if (segmentPoints.length < 2) continue;

                // 新しいGraphicsを作成してレンダリング
                const newGraphics = new PIXI.Graphics();

                // 元のパスの属性を継承（Graphics に附属していれば）
                const strokeOptions = graphics._strokeOptions || {
                    color: 0x000000,
                    alpha: 1.0,
                    size: 5
                };

                // StrokeRenderer で描画
                if (this.strokeRenderer) {
                    this.strokeRenderer.renderFinalStroke(
                        { points: segmentPoints, isSingleDot: false },
                        strokeOptions,
                        newGraphics
                    );
                }

                // ポイント情報を Graphics に附属させる（後で参照可能に）
                newGraphics._strokePoints = segmentPoints;
                newGraphics._strokeOptions = strokeOptions;

                activeLayer.addChild(newGraphics);
                addedGraphics.push(newGraphics);
            }
        }

        // History記録
        if (this.history && removedGraphics.length > 0) {
            const layerIndex = this.layerSystem.activeLayerIndex;
            const command = {
                name: 'Erase',
                undo: () => {
                    const layer = this.layerSystem.layers[layerIndex];
                    if (!layer) return;

                    // 追加したGraphicsを削除
                    for (const g of addedGraphics) {
                        if (layer.children.includes(g)) {
                            layer.removeChild(g);
                            g.destroy({ children: true });
                        }
                    }

                    // 元のGraphicsを復元
                    for (const g of removedGraphics) {
                        layer.addChild(g);
                    }

                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                do: () => {
                    const layer = this.layerSystem.layers[layerIndex];
                    if (!layer) return;

                    // 元のGraphicsを削除
                    for (const g of removedGraphics) {
                        if (layer.children.includes(g)) {
                            layer.removeChild(g);
                            g.destroy({ children: true });
                        }
                    }

                    // 分割後を追加
                    for (const g of addedGraphics) {
                        if (!layer.children.includes(g)) {
                            layer.addChild(g);
                        }
                    }

                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                meta: { type: 'erase', layerIndex }
            };

            this.history.push(command);
        }

        this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);

        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('layer:erased', {
                layerId: activeLayer.layerData?.id,
                pathsRemoved: removedGraphics.length,
                segmentsCreated: addedGraphics.length
            });
        }
    }

    /**
     * ===== Phase 1 新規追加メソッド END =====
     */

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