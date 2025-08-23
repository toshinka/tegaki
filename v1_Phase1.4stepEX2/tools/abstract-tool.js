/**
 * 🖊️ AbstractTool - 統一ツール基底クラス
 * ✅ DRAWING_AUTHORITY: 描画処理の主導権保持
 * 🔧 COORDINATE_CONTROL: 座標変換・moveTo/lineTo制御
 * 📋 RESPONSIBILITY: 「ツール基底」としての統一インターフェース
 * 
 * 📏 DESIGN_PRINCIPLE: ユーザー入力 → 座標処理 → Graphics生成 → CanvasManagerに配置
 * 🎯 ARCHITECTURE: 1ファイル1ツール設計・AbstractTool継承必須
 * 🚫 COORDINATE_BUG_NOTES: 座標処理責任をTool側に集約・0,0バグ対策
 * 
 * 座標バグ修正における重要な設計:
 * - 座標変換はCoordinateManager経由でTool側が完全制御
 * - CanvasManagerは配置のみ、描画処理は一切行わない
 * - Graphics生成から配置まで一気通貫でTool側が管理
 */

// Tegaki名前空間初期化（Phase1.4stepEX準拠）
window.Tegaki = window.Tegaki || {};

class AbstractTool {
    constructor(toolName, defaultSettings = {}) {
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // ツール設定（継承先でカスタマイズ可能）
        this.settings = {
            size: 3,
            color: '#000000',
            opacity: 1.0,
            pressureSensitive: false,
            smoothing: 0.3,
            ...defaultSettings
        };

        // 現在のストローク情報
        this.currentStroke = {
            points: [],
            startTime: null,
            endTime: null,
            graphics: null
        };

        // 前回の座標（座標バグ修正の重要な要素）
        this.lastPoint = null;
        this.lastValidPoint = null; // 0,0バグ回避用

        // Canvas・Coordinate統合参照
        this.canvasManager = null;
        this.coordinateManager = null;
        this.assignedLayer = null;
    }

    // ========================================
    // 必須実装メソッド（継承先で実装必須）
    // ========================================

    /**
     * ストローク開始処理（継承先で実装必須）
     * @abstract
     * @protected
     * @param {object} point - 座標点 {x, y, pressure?, timestamp}
     */
    _onStrokeStart(point) {
        throw new Error(`_onStrokeStart must be implemented in ${this.constructor.name}`);
    }

    /**
     * 点追加処理（継承先で実装必須）
     * @abstract
     * @protected
     * @param {object} point - 座標点
     */
    _onPointAdd(point) {
        throw new Error(`_onPointAdd must be implemented in ${this.constructor.name}`);
    }

    /**
     * ストローク終了処理（継承先で実装必須）
     * @abstract
     * @protected
     * @param {object} point - 座標点
     */
    _onStrokeEnd(point) {
        throw new Error(`_onStrokeEnd must be implemented in ${this.constructor.name}`);
    }

    // ========================================
    // 統一インターフェース（ToolManager用）
    // ========================================

    /**
     * PointerDownイベント処理（統一インターフェース）
     * @param {PointerEvent} event - ポインターイベント
     * @param {CanvasManager} canvasManager - CanvasManager参照
     * @param {CoordinateManager} coordinateManager - CoordinateManager参照
     */
    onPointerDown(event, canvasManager, coordinateManager) {
        try {
            if (!this.isActive) {
                console.warn(`[${this.toolName}Tool] Tool not active, ignoring PointerDown`);
                return;
            }

            // 統合参照設定
            this.canvasManager = canvasManager;
            this.coordinateManager = coordinateManager;

            // 座標抽出・検証（座標バグ修正の核心）
            const point = this.extractAndValidateCoordinates(event);
            if (!point) {
                console.warn(`[${this.toolName}Tool] Invalid coordinates, ignoring PointerDown`);
                return;
            }

            // ストローク開始
            this.isDrawing = true;
            this.currentStroke.startTime = performance.now();
            this.currentStroke.points = [point];
            this.currentStroke.graphics = this.createGraphicsForCanvas();
            
            // 重要：前回座標をリセット（0,0バグ防止）
            this.lastPoint = point;
            this.lastValidPoint = point;

            // 継承先の開始処理実行
            this._onStrokeStart(point);

            // 統一システム経由での通知
            if (Tegaki.EventBusInstance) {
                Tegaki.EventBusInstance.safeEmit('tool:stroke_started', {
                    toolName: this.toolName,
                    point: point
                });
            }

            console.log(`[${this.toolName}Tool] Stroke started at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.onPointerDown`);
            } else {
                console.error(`[${this.toolName}Tool.onPointerDown]`, error);
            }
        }
    }

    /**
     * PointerMoveイベント処理（統一インターフェース）
     * @param {PointerEvent} event - ポインターイベント
     * @param {CanvasManager} canvasManager - CanvasManager参照
     * @param {CoordinateManager} coordinateManager - CoordinateManager参照
     */
    onPointerMove(event, canvasManager, coordinateManager) {
        try {
            if (!this.isActive || !this.isDrawing) {
                return;
            }

            // 統合参照更新
            this.canvasManager = canvasManager;
            this.coordinateManager = coordinateManager;

            // 座標抽出・検証
            const point = this.extractAndValidateCoordinates(event);
            if (!point) {
                return;
            }

            // 座標差分チェック（微小移動フィルタ）
            if (this.lastPoint && this._calculateDistance(point, this.lastPoint) < 0.5) {
                return; // 微小移動は無視
            }

            // ストロークに追加
            this.currentStroke.points.push(point);
            this.lastPoint = point;
            this.lastValidPoint = point; // 有効座標として記録

            // 継承先の点追加処理実行
            this._onPointAdd(point);

            // 統一システム経由での通知
            if (Tegaki.EventBusInstance) {
                Tegaki.EventBusInstance.safeEmit('tool:stroke_updated', {
                    toolName: this.toolName,
                    point: point,
                    totalPoints: this.currentStroke.points.length
                });
            }
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.onPointerMove`);
            } else {
                console.error(`[${this.toolName}Tool.onPointerMove]`, error);
            }
        }
    }

    /**
     * PointerUpイベント処理（統一インターフェース）
     * @param {PointerEvent} event - ポインターイベント
     * @param {CanvasManager} canvasManager - CanvasManager参照
     * @param {CoordinateManager} coordinateManager - CoordinateManager参照
     */
    onPointerUp(event, canvasManager, coordinateManager) {
        try {
            if (!this.isActive || !this.isDrawing) {
                return;
            }

            // 統合参照更新
            this.canvasManager = canvasManager;
            this.coordinateManager = coordinateManager;

            // 最終座標取得
            const point = this.extractAndValidateCoordinates(event) || this.lastValidPoint;
            
            // ストローク終了
            this.currentStroke.endTime = performance.now();
            this.isDrawing = false;

            // 継承先の終了処理実行
            this._onStrokeEnd(point);

            // Graphics最終配置（CanvasManager委譲）
            this._finalizeStrokeToCanvas();

            // 統一システム経由での通知
            if (Tegaki.EventBusInstance) {
                Tegaki.EventBusInstance.safeEmit('tool:stroke_completed', {
                    toolName: this.toolName,
                    pointCount: this.currentStroke.points.length,
                    duration: this.currentStroke.endTime - this.currentStroke.startTime
                });
            }

            console.log(`[${this.toolName}Tool] Stroke completed with ${this.currentStroke.points.length} points`);

            // ストローク情報リセット
            this._resetStroke();
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.onPointerUp`);
            } else {
                console.error(`[${this.toolName}Tool.onPointerUp]`, error);
            }
        }
    }

    /**
     * PointerCancelイベント処理（統一インターフェース）
     * @param {PointerEvent} event - ポインターイベント
     * @param {CanvasManager} canvasManager - CanvasManager参照
     * @param {CoordinateManager} coordinateManager - CoordinateManager参照
     */
    onPointerCancel(event, canvasManager, coordinateManager) {
        try {
            if (this.isDrawing) {
                this.isDrawing = false;
                
                // 現在のGraphicsを削除（キャンセル処理）
                if (this.currentStroke.graphics && this.assignedLayer) {
                    this.assignedLayer.removeChild(this.currentStroke.graphics);
                }
                
                this._resetStroke();
                
                // 統一システム経由での通知
                if (Tegaki.EventBusInstance) {
                    Tegaki.EventBusInstance.safeEmit('tool:stroke_cancelled', {
                        toolName: this.toolName
                    });
                }
                
                console.log(`[${this.toolName}Tool] Stroke cancelled`);
            }
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.onPointerCancel`);
            } else {
                console.error(`[${this.toolName}Tool.onPointerCancel]`, error);
            }
        }
    }

    // ========================================
    // ツール制御メソッド
    // ========================================

    /**
     * ツール有効化
     */
    activate() {
        try {
            this.isActive = true;
            
            // 継承先の有効化処理
            if (typeof this._onActivate === 'function') {
                this._onActivate();
            }
            
            console.log(`[${this.toolName}Tool] Tool activated`);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.activate`);
            } else {
                console.error(`[${this.toolName}Tool.activate]`, error);
            }
        }
    }

    /**
     * ツール無効化
     */
    deactivate() {
        try {
            this.isActive = false;
            this.isDrawing = false;
            
            // 継承先の無効化処理
            if (typeof this._onDeactivate === 'function') {
                this._onDeactivate();
            }
            
            // 現在のストロークをクリア
            this._resetStroke();
            
            console.log(`[${this.toolName}Tool] Tool deactivated`);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.deactivate`);
            } else {
                console.error(`[${this.toolName}Tool.deactivate]`, error);
            }
        }
    }

    /**
     * 設定更新
     * @param {object} newSettings - 新しい設定オブジェクト
     */
    updateSettings(newSettings = {}) {
        try {
            const oldSettings = { ...this.settings };
            this.settings = { ...this.settings, ...newSettings };
            
            // 継承先の設定更新処理
            if (typeof this._onSettingsUpdate === 'function') {
                this._onSettingsUpdate(this.settings, oldSettings);
            }
            
            console.log(`[${this.toolName}Tool] Settings updated:`, newSettings);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.updateSettings`);
            } else {
                console.error(`[${this.toolName}Tool.updateSettings]`, error);
            }
        }
    }

    /**
     * 単一設定更新
     * @param {string} key - 設定キー
     * @param {*} value - 設定値
     */
    updateSetting(key, value) {
        this.updateSettings({ [key]: value });
    }

    /**
     * 設定取得
     * @returns {object}
     */
    getSettings() {
        return { ...this.settings };
    }

    // ========================================
    // 座標処理メソッド（座標バグ修正の核心）
    // ========================================

    /**
     * 座標抽出・検証（座標バグ修正の重要メソッド）
     * @param {PointerEvent} event - ポインターイベント
     * @returns {object|null} 検証済み座標 {x, y, pressure?, timestamp}
     */
    extractAndValidateCoordinates(event) {
        try {
            if (!this.coordinateManager) {
                throw new Error('CoordinateManager not available');
            }

            // CoordinateManager経由で座標抽出（統一処理）
            const coords = this.coordinateManager.extractPointerCoordinates(event);
            if (!coords || !this._validateCoordinateIntegrity(coords)) {
                return null;
            }

            // タイムスタンプ追加
            coords.timestamp = performance.now();

            // 筆圧情報追加
            if (event.pressure !== undefined && event.pressure > 0) {
                coords.pressure = event.pressure;
            } else {
                coords.pressure = 0.5; // デフォルト筆圧
            }

            return coords;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.extractAndValidateCoordinates`);
            } else {
                console.error(`[${this.toolName}Tool.extractAndValidateCoordinates]`, error);
            }
            return null;
        }
    }

    /**
     * Canvas用Graphics作成（CanvasManager統合用）
     * @returns {PIXI.Graphics}
     */
    createGraphicsForCanvas() {
        const graphics = new PIXI.Graphics();
        
        // ツール用レイヤーに即座に配置
        if (this.canvasManager && this.toolName) {
            const layer = this.canvasManager.getLayerForTool(this.toolName);
            if (layer) {
                layer.addChild(graphics);
                this.assignedLayer = layer;
            }
        }
        
        return graphics;
    }

    /**
     * Canvas接続設定（ToolManager統合用）
     * @param {CanvasManager} canvasManager - CanvasManager
     * @param {PIXI.Container} layer - 割り当てレイヤー
     */
    attachToCanvas(canvasManager, layer) {
        this.canvasManager = canvasManager;
        this.assignedLayer = layer;
        console.log(`[${this.toolName}Tool] Attached to canvas layer: ${layer?.name || 'unknown'}`);
    }

    // ========================================
    // 内部メソッド（座標バグ修正支援）
    // ========================================

    /**
     * 座標妥当性確認（0,0バグ対策）
     * @private
     */
    _validateCoordinateIntegrity(coords) {
        // 基本妥当性
        if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') {
            return false;
        }

        // NaN・Infinityチェック
        if (!isFinite(coords.x) || !isFinite(coords.y)) {
            return false;
        }

        // 0,0座標の検証強化（重要な0,0バグ対策）
        if (coords.x === 0 && coords.y === 0) {
            // 明示的に0,0を指定した場合以外は無効とする
            if (!this.lastValidPoint) {
                console.warn(`[${this.toolName}Tool] Suspicious 0,0 coordinate detected, rejecting`);
                return false;
            }
        }

        // 座標範囲チェック（キャンバス外座標を排除）
        if (this.canvasManager) {
            const viewInfo = this.canvasManager.getViewInfo();
            if (viewInfo && (
                coords.x < -1000 || coords.x > viewInfo.canvasWidth + 1000 ||
                coords.y < -1000 || coords.y > viewInfo.canvasHeight + 1000)) {
                console.warn(`[${this.toolName}Tool] Coordinate out of reasonable range: (${coords.x}, ${coords.y})`);
                return false;
            }
        }

        return true;
    }

    /**
     * ストロークのCanvas配置を最終化
     * @private
     */
    _finalizeStrokeToCanvas() {
        if (this.currentStroke.graphics && this.canvasManager) {
            // 既にレイヤーに配置済みなので、CanvasManagerは何もしない
            // （責務分離：配置はTool側が完了、CanvasManagerはレイヤー管理のみ）
            
            // 統一システム経由での状態更新
            if (Tegaki.StateManagerInstance) {
                Tegaki.StateManagerInstance.setState('canvas.hasContent', true);
                Tegaki.StateManagerInstance.setState('canvas.isDirty', true);
            }
        }
    }

    /**
     * ストローク情報リセット
     * @private
     */
    _resetStroke() {
        this.currentStroke = {
            points: [],
            startTime: null,
            endTime: null,
            graphics: null
        };
        this.lastPoint = null;
        // lastValidPointは保持（次回座標検証用）
    }

    /**
     * 2点間距離計算
     * @private
     */
    _calculateDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 統計情報取得
     * @returns {object}
     */
    getStats() {
        return {
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            settings: this.getSettings(),
            currentStroke: {
                pointCount: this.currentStroke.points.length,
                isActive: this.isDrawing,
                duration: this.isDrawing ? 
                    performance.now() - this.currentStroke.startTime : 
                    (this.currentStroke.endTime - this.currentStroke.startTime) || 0
            }
        };
    }

    /**
     * ツールリセット
     */
    reset() {
        try {
            this.isDrawing = false;
            this._resetStroke();
            
            // 継承先のリセット処理
            if (typeof this._onReset === 'function') {
                this._onReset();
            }
            
            console.log(`[${this.toolName}Tool] Tool reset completed`);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `${this.toolName}Tool.reset`);
            } else {
                console.error(`[${this.toolName}Tool.reset]`, error);
            }
        }
    }

    // ========================================
    // オプション継承メソッド（継承先でオーバーライド可能）
    // ========================================

    /**
     * 有効化時処理（継承先でオーバーライド）
     * @protected
     */
    _onActivate() {
        // 継承先で必要に応じて実装
    }

    /**
     * 無効化時処理（継承先でオーバーライド）
     * @protected
     */
    _onDeactivate() {
        // 継承先で必要に応じて実装
    }

    /**
     * 設定更新時処理（継承先でオーバーライド）
     * @protected
     * @param {object} newSettings - 新しい設定
     * @param {object} oldSettings - 古い設定
     */
    _onSettingsUpdate(newSettings, oldSettings) {
        // 継承先で必要に応じて実装
    }

    /**
     * リセット時処理（継承先でオーバーライド）
     * @protected
     */
    _onReset() {
        // 継承先で必要に応じて実装
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.AbstractTool = AbstractTool;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    // AbstractToolは基底クラスなのでインスタンス化はしない
    console.log('[AbstractTool] ✅ Registered to Tegaki namespace as base class');
});

console.log('[AbstractTool] ✅ Tegaki名前空間統一・レジストリ登録完了');