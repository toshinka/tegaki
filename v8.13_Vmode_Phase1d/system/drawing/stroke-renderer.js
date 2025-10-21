/**
 * DrawingEngine - ペン描画統合制御クラス
 * 
 * 責務: ポインターイベント → 記録 → 描画 → 履歴のフロー制御
 * 
 * フロー:
 * pointerdown → stroke:start → プレビュー開始
 * pointermove → stroke:point → プレビュー更新
 * pointerup   → stroke:end   → 確定描画 + 履歴追加
 */

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;

        // コンポーネント初期化
        this.pressureHandler = new PressureHandler();
        this.strokeRecorder = new StrokeRecorder(this.pressureHandler, this.cameraSystem);
        this.strokeRenderer = new StrokeRenderer(app);

        // 状態管理
        this.isDrawing = false;
        this.currentPreview = null; // リアルタイムプレビュー用Graphics
        this.currentLayer = null;
        this.currentSettings = null;

        // イベント登録
        this.setupEventListeners();
    }

    /**
     * イベントリスナー登録
     */
    setupEventListeners() {
        const canvas = this.app.canvas;

        canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
    }

    /**
     * PointerDown処理 - ストローク開始
     */
    handlePointerDown(event) {
        // ツールモード確認
        if (window.stateManager && window.stateManager.state.tool !== 'pen') {
            return;
        }

        // アクティブレイヤー取得
        this.currentLayer = this.layerSystem.getActiveLayer();
        if (!this.currentLayer || this.currentLayer.locked) {
            return;
        }

        // ブラシ設定取得
        this.currentSettings = this.getBrushSettings();

        // ストローク記録開始
        const pressure = event.pressure || 0.5;
        this.strokeRecorder.startStroke(event.clientX, event.clientY, pressure);

        this.isDrawing = true;

        // EventBus通知
        EventBus.emit('stroke:start', {
            layerId: this.currentLayer.id,
            settings: this.currentSettings
        });

        // 初回プレビュー
        this.updatePreview();
    }

    /**
     * PointerMove処理 - ストローク記録 + プレビュー更新
     */
    handlePointerMove(event) {
        if (!this.isDrawing) return;

        // ポイント追加
        const pressure = event.pressure || 0.5;
        this.strokeRecorder.addPoint(event.clientX, event.clientY, pressure);

        // プレビュー更新
        this.updatePreview();

        // EventBus通知
        EventBus.emit('stroke:point', {
            points: this.strokeRecorder.getCurrentPoints(),
            settings: this.currentSettings
        });
    }

    /**
     * PointerUp処理 - ストローク確定
     */
    handlePointerUp(event) {
        if (!this.isDrawing) return;

        // 最終ポイント追加
        const pressure = event.pressure || 0.5;
        this.strokeRecorder.addPoint(event.clientX, event.clientY, pressure);

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
        EventBus.emit('stroke:end', {
            strokeData: strokeData
        });
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
        this.currentPreview = this.strokeRenderer.renderPreview(points, this.currentSettings);

        // レイヤーに追加
        this.currentLayer.container.addChild(this.currentPreview);
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
        if (!this.currentLayer || strokeData.points.length === 0) return;

        // 高品質レンダリング（Mesh方式）
        const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, this.currentSettings);

        // StrokeData作成
        const strokeModel = new window.TegakiDataModels.StrokeData({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha,
            layerId: this.currentLayer.id
        });

        // 履歴コマンド作成
        const addStrokeCommand = {
            name: 'Add Stroke',
            do: () => {
                this.currentLayer.container.addChild(strokeObject);
            },
            undo: () => {
                this.currentLayer.container.removeChild(strokeObject);
                strokeObject.destroy({ children: true });
            },
            meta: {
                type: 'stroke',
                layerId: this.currentLayer.id,
                strokeData: strokeModel
            }
        };

        // 履歴に追加
        this.history.push(addStrokeCommand);

        // レイヤー更新通知
        EventBus.emit('layer:modified', {
            layerId: this.currentLayer.id
        });
    }

    /**
     * ブラシ設定取得
     */
    getBrushSettings() {
        // BrushSettings または StateManager から取得
        if (window.brushSettings) {
            return {
                color: window.brushSettings.getColor(),
                size: window.brushSettings.getSize(),
                alpha: window.brushSettings.getAlpha ? window.brushSettings.getAlpha() : 1.0
            };
        }

        // フォールバック
        return {
            color: 0x000000,
            size: 5,
            alpha: 1.0
        };
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

        EventBus.emit('stroke:cancel');
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
        const canvas = this.app.canvas;
        canvas.removeEventListener('pointerdown', this.handlePointerDown);
        canvas.removeEventListener('pointermove', this.handlePointerMove);
        canvas.removeEventListener('pointerup', this.handlePointerUp);
        canvas.removeEventListener('pointercancel', this.handlePointerUp);
    }
}