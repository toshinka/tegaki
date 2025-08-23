/**
 * AbstractTool - ツール共通の抽象クラス
 * 
 * 責務:
 * - ツール共通のストローク管理
 * - 共通ユーティリティの提供
 * - ツールライフサイクル管理
 * 
 * 依存: ErrorManager
 * 公開: window.AbstractTool
 */

class AbstractTool {
    constructor(name, options = {}) {
        if (this.constructor === AbstractTool) {
            throw new Error('AbstractTool cannot be instantiated directly');
        }

        this.name = name;
        this.isActive = false;
        this.isDrawing = false;
        
        // 現在のストローク情報
        this.currentStroke = {
            id: null,
            points: [],
            startTime: null,
            endTime: null,
            style: null
        };
        
        // ツール設定
        this.settings = {
            size: 3,
            color: '#000000',
            opacity: 1.0,
            ...options
        };
        
        // パフォーマンス設定
        this.performanceOptions = {
            maxPointsPerStroke: 10000,
            pointThrottleDistance: 1.0,
            enableSmoothing: true,
            smoothingFactor: 0.3
        };
        
        // 統計情報
        this.stats = {
            strokeCount: 0,
            totalPoints: 0,
            averageStrokeLength: 0,
            lastStrokeTime: null
        };
    }

    /**
     * ストローク開始
     * @param {object} point - 開始点の座標情報
     * @returns {boolean} 成功/失敗
     */
    startStroke(point) {
        try {
            if (this.isDrawing) {
                console.log(`[${this.name}Tool] Reset completed`);
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.reset`);
        }
    }

    /**
     * パフォーマンスオプションを設定
     * @param {object} options - パフォーマンスオプション
     */
    setPerformanceOptions(options) {
        Object.assign(this.performanceOptions, options);
        console.log(`[${this.name}Tool] Performance options updated:`, this.performanceOptions);
    }

    // ========================================
    // 保護されたメソッド（継承クラスで利用）
    // ========================================

    /**
     * ストロークに点を追加（内部処理）
     * @protected
     */
    _addPointToStroke(point) {
        const processedPoint = {
            x: point.x,
            y: point.y,
            pressure: point.pressure || 0.5,
            tiltX: point.tiltX || 0,
            tiltY: point.tiltY || 0,
            timestamp: point.timestamp || Date.now()
        };

        // 平滑化処理
        if (this.performanceOptions.enableSmoothing && this.currentStroke.points.length > 0) {
            const smoothed = this._applySmoothingToPoint(processedPoint);
            processedPoint.smoothedX = smoothed.x;
            processedPoint.smoothedY = smoothed.y;
        }

        this.currentStroke.points.push(processedPoint);
    }

    /**
     * 点のスロットリング判定
     * @protected
     */
    _shouldThrottlePoint(point) {
        if (this.currentStroke.points.length === 0) {
            return false;
        }

        const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
        const distance = Math.sqrt(
            Math.pow(point.x - lastPoint.x, 2) + 
            Math.pow(point.y - lastPoint.y, 2)
        );

        return distance < this.performanceOptions.pointThrottleDistance;
    }

    /**
     * 点に平滑化を適用
     * @protected
     */
    _applySmoothingToPoint(point) {
        if (this.currentStroke.points.length === 0) {
            return { x: point.x, y: point.y };
        }

        const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
        const factor = this.performanceOptions.smoothingFactor;

        return {
            x: lastPoint.x + (point.x - lastPoint.x) * factor,
            y: lastPoint.y + (point.y - lastPoint.y) * factor
        };
    }

    /**
     * 統計情報を更新
     * @protected
     */
    _updateStats() {
        this.stats.strokeCount++;
        this.stats.totalPoints += this.currentStroke.points.length;
        this.stats.averageStrokeLength = this.stats.totalPoints / this.stats.strokeCount;
        this.stats.lastStrokeTime = Date.now();
    }

    /**
     * ストローク情報をリセット
     * @protected
     */
    _resetStroke() {
        this.currentStroke = {
            id: null,
            points: [],
            startTime: null,
            endTime: null,
            style: null
        };
    }

    /**
     * ストロークIDを生成
     * @protected
     */
    _generateStrokeId() {
        return `${this.name}_stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ========================================
    // 継承クラスでオーバーライドするメソッド
    // ========================================

    /**
     * ストローク開始時の処理（継承クラスでオーバーライド）
     * @protected
     * @param {object} point - 開始点
     */
    _onStrokeStart(point) {
        // 継承クラスで実装
    }

    /**
     * 点追加時の処理（継承クラスでオーバーライド）
     * @protected
     * @param {object} point - 追加点
     */
    _onPointAdd(point) {
        // 継承クラスで実装
    }

    /**
     * ストローク終了時の処理（継承クラスでオーバーライド）
     * @protected
     * @param {object} point - 終了点
     */
    _onStrokeEnd(point) {
        // 継承クラスで実装
    }

    /**
     * ツール有効化時の処理（継承クラスでオーバーライド）
     * @protected
     */
    _onActivate() {
        // 継承クラスで実装
    }

    /**
     * ツール無効化時の処理（継承クラスでオーバーライド）
     * @protected
     */
    _onDeactivate() {
        // 継承クラスで実装
    }

    /**
     * 設定更新時の処理（継承クラスでオーバーライド）
     * @protected
     * @param {object} newSettings - 新しい設定
     * @param {object} oldSettings - 古い設定
     */
    _onSettingsUpdate(newSettings, oldSettings) {
        // 継承クラスで実装
    }

    /**
     * リセット時の処理（継承クラスでオーバーライド）
     * @protected
     */
    _onReset() {
        // 継承クラスで実装
    }
}

// グローバルに公開
window.AbstractTool = AbstractTool;

console.log('[AbstractTool] Base class initialized and registered to window.AbstractTool');.warn(`[${this.name}Tool] Stroke already in progress`);
                return false;
            }

            // ストローク初期化
            this.currentStroke = {
                id: this._generateStrokeId(),
                points: [],
                startTime: Date.now(),
                endTime: null,
                style: { ...this.settings }
            };

            // 開始点を追加
            this._addPointToStroke(point);
            
            this.isDrawing = true;
            
            // 継承クラスの処理を呼び出し
            if (typeof this._onStrokeStart === 'function') {
                this._onStrokeStart(point);
            }

            console.log(`[${this.name}Tool] Stroke started:`, this.currentStroke.id);
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.startStroke`);
            return false;
        }
    }

    /**
     * ストロークに点を追加
     * @param {object} point - 座標情報
     * @returns {boolean} 成功/失敗
     */
    addPoint(point) {
        try {
            if (!this.isDrawing) {
                return false;
            }

            // 点数制限チェック
            if (this.currentStroke.points.length >= this.performanceOptions.maxPointsPerStroke) {
                console.warn(`[${this.name}Tool] Maximum points per stroke reached`);
                return false;
            }

            // スロットリング（距離ベース）
            if (this._shouldThrottlePoint(point)) {
                return true; // スキップするが成功扱い
            }

            // 点を追加
            this._addPointToStroke(point);
            
            // 継承クラスの処理を呼び出し
            if (typeof this._onPointAdd === 'function') {
                this._onPointAdd(point);
            }

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.addPoint`);
            return false;
        }
    }

    /**
     * ストローク終了
     * @param {object} point - 終了点の座標情報
     * @returns {boolean} 成功/失敗
     */
    endStroke(point) {
        try {
            if (!this.isDrawing) {
                return false;
            }

            // 終了点を追加
            if (point) {
                this._addPointToStroke(point);
            }

            // ストローク完了
            this.currentStroke.endTime = Date.now();
            this.isDrawing = false;

            // 統計更新
            this._updateStats();

            // 継承クラスの処理を呼び出し
            if (typeof this._onStrokeEnd === 'function') {
                this._onStrokeEnd(point);
            }

            // MemoryManagerに通知（将来実装）
            window.EventBus?.emit('tool:stroke-complete', {
                toolName: this.name,
                stroke: { ...this.currentStroke }
            });

            console.log(`[${this.name}Tool] Stroke ended:`, this.currentStroke.id);
            
            // ストロークをリセット
            this._resetStroke();
            
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.endStroke`);
            return false;
        }
    }

    /**
     * ツール有効化
     */
    activate() {
        try {
            if (this.isActive) {
                return true;
            }

            this.isActive = true;
            
            // 継承クラスの処理を呼び出し
            if (typeof this._onActivate === 'function') {
                this._onActivate();
            }

            console.log(`[${this.name}Tool] Activated`);
            
            window.EventBus?.emit('tool:activated', {
                toolName: this.name,
                settings: this.settings
            });
            
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.activate`);
            return false;
        }
    }

    /**
     * ツール無効化
     */
    deactivate() {
        try {
            if (!this.isActive) {
                return true;
            }

            // 描画中の場合は強制終了
            if (this.isDrawing) {
                this.endStroke();
            }

            this.isActive = false;
            
            // 継承クラスの処理を呼び出し
            if (typeof this._onDeactivate === 'function') {
                this._onDeactivate();
            }

            console.log(`[${this.name}Tool] Deactivated`);
            
            window.EventBus?.emit('tool:deactivated', {
                toolName: this.name
            });
            
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.deactivate`);
            return false;
        }
    }

    /**
     * ツール設定を取得
     * @returns {object} 設定オブジェクト
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * ツール設定を更新
     * @param {object} newSettings - 新しい設定
     * @returns {boolean} 成功/失敗
     */
    updateSettings(newSettings) {
        try {
            const oldSettings = { ...this.settings };
            
            // 設定を更新
            Object.assign(this.settings, newSettings);
            
            // 継承クラスの処理を呼び出し
            if (typeof this._onSettingsUpdate === 'function') {
                this._onSettingsUpdate(newSettings, oldSettings);
            }

            window.EventBus?.emit('tool:settings-updated', {
                toolName: this.name,
                newSettings: this.settings,
                oldSettings
            });

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, `${this.name}Tool.updateSettings`);
            return false;
        }
    }

    /**
     * 現在のストローク情報を取得
     * @returns {object|null} ストローク情報
     */
    getCurrentStroke() {
        return this.isDrawing ? { ...this.currentStroke } : null;
    }

    /**
     * ツール統計を取得
     * @returns {object} 統計情報
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * ツール統計をリセット
     */
    resetStats() {
        this.stats = {
            strokeCount: 0,
            totalPoints: 0,
            averageStrokeLength: 0,
            lastStrokeTime: null
        };
    }

    /**
     * ツールの状態をリセット
     */
    reset() {
        try {
            if (this.isDrawing) {
                this.endStroke();
            }
            
            this._resetStroke();
            this.resetStats();
            
            // 継承クラスの処理を呼び出し
            if (typeof this._onReset === 'function') {
                this._onReset();
            }
            
            console