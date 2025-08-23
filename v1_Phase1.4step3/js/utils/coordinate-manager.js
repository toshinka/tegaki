/**
 * CoordinateManager - 入力座標の変換・補正システム
 * 
 * 責務:
 * - ブラウザ座標 → Canvas座標変換
 * - タブレットペン・タッチ入力対応
 * - 座標補正・平滑化処理
 * 
 * 依存: ErrorManager
 * 公開: window.CoordinateManager
 */

class CoordinateManager {
    constructor() {
        this.canvasElement = null;
        this.canvasRect = null;
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        
        // 座標履歴（平滑化用）
        this.pointHistory = [];
        this.maxHistorySize = 5;
        
        // タッチ・ペン対応
        this.supportsPressure = false;
        this.supportsTilt = false;
        
        // 変換オプション
        this.smoothingEnabled = true;
        this.smoothingFactor = 0.3;
        this.pressureNormalization = true;
        
        this._detectInputCapabilities();
    }

    /**
     * キャンバス要素を設定
     * @param {HTMLElement} canvasElement - キャンバス要素
     */
    setCanvasElement(canvasElement) {
        if (!canvasElement) {
            window.ErrorManager?.handleError('Canvas element is null', 'CoordinateManager.setCanvasElement');
            return false;
        }

        this.canvasElement = canvasElement;
        this._updateCanvasRect();
        
        // リサイズ監視
        window.addEventListener('resize', () => this._updateCanvasRect());
        window.addEventListener('scroll', () => this._updateCanvasRect());
        
        console.log('[CoordinateManager] Canvas element set and rect updated');
        return true;
    }

    /**
     * 変換パラメーターを設定
     * @param {number} scale - スケール値
     * @param {number} panX - X方向パン値
     * @param {number} panY - Y方向パン値
     */
    setTransform(scale = 1.0, panX = 0, panY = 0) {
        this.scale = scale;
        this.panX = panX;
        this.panY = panY;
    }

    /**
     * ブラウザ座標をキャンバス座標に変換
     * @param {object} browserPoint - ブラウザ座標 {x, y}
     * @returns {object} キャンバス座標 {x, y}
     */
    transformPoint(browserPoint) {
        try {
            if (!this.canvasElement || !this.canvasRect) {
                this._updateCanvasRect();
            }

            if (!this.canvasRect) {
                window.ErrorManager?.handleError('Canvas rect not available', 'CoordinateManager.transformPoint');
                return { x: 0, y: 0 };
            }

            // ブラウザ座標からキャンバス座標への変換
            const canvasX = (browserPoint.x - this.canvasRect.left - this.panX) / this.scale;
            const canvasY = (browserPoint.y - this.canvasRect.top - this.panY) / this.scale;

            return {
                x: canvasX,
                y: canvasY
            };
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CoordinateManager.transformPoint');
            return { x: 0, y: 0 };
        }
    }

    /**
     * キャンバス座標をブラウザ座標に変換（逆変換）
     * @param {object} canvasPoint - キャンバス座標 {x, y}
     * @returns {object} ブラウザ座標 {x, y}
     */
    inverseTransformPoint(canvasPoint) {
        try {
            if (!this.canvasRect) {
                this._updateCanvasRect();
            }

            const browserX = canvasPoint.x * this.scale + this.panX + this.canvasRect.left;
            const browserY = canvasPoint.y * this.scale + this.panY + this.canvasRect.top;

            return {
                x: browserX,
                y: browserY
            };
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CoordinateManager.inverseTransformPoint');
            return { x: 0, y: 0 };
        }
    }

    /**
     * PointerEventから拡張座標情報を取得
     * @param {PointerEvent} event - PointerEvent
     * @returns {object} 拡張座標情報
     */
    extractPointerInfo(event) {
        try {
            const browserPoint = {
                x: event.clientX,
                y: event.clientY
            };
            
            const canvasPoint = this.transformPoint(browserPoint);
            
            const pointerInfo = {
                // 基本座標
                x: canvasPoint.x,
                y: canvasPoint.y,
                browserX: browserPoint.x,
                browserY: browserPoint.y,
                
                // ポインター情報
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                isPrimary: event.isPrimary,
                
                // 圧力・傾き情報
                pressure: this._normalizePressure(event.pressure),
                tiltX: this.supportsTilt ? event.tiltX || 0 : 0,
                tiltY: this.supportsTilt ? event.tiltY || 0 : 0,
                tangentialPressure: event.tangentialPressure || 0,
                twist: event.twist || 0,
                
                // ボタン・修飾キー
                buttons: event.buttons,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                
                // タイムスタンプ
                timestamp: event.timeStamp || Date.now()
            };
            
            // 平滑化処理
            if (this.smoothingEnabled) {
                pointerInfo.smoothed = this._applySmoothingToPoint(pointerInfo);
            }
            
            // 履歴に追加
            this._addToHistory(pointerInfo);
            
            return pointerInfo;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CoordinateManager.extractPointerInfo');
            return this._createEmptyPointerInfo();
        }
    }

    /**
     * タッチイベントから座標情報を取得
     * @param {TouchEvent} event - TouchEvent
     * @param {number} touchIndex - タッチインデックス（デフォルト: 0）
     * @returns {object} 座標情報
     */
    extractTouchInfo(event, touchIndex = 0) {
        try {
            const touches = event.touches;
            const changedTouches = event.changedTouches;
            const touch = touches[touchIndex] || changedTouches[touchIndex];
            
            if (!touch) {
                return this._createEmptyPointerInfo();
            }
            
            const browserPoint = {
                x: touch.clientX,
                y: touch.clientY
            };
            
            const canvasPoint = this.transformPoint(browserPoint);
            
            return {
                x: canvasPoint.x,
                y: canvasPoint.y,
                browserX: browserPoint.x,
                browserY: browserPoint.y,
                pointerId: touch.identifier,
                pointerType: 'touch',
                isPrimary: touchIndex === 0,
                pressure: 0.5, // タッチは圧力固定
                tiltX: 0,
                tiltY: 0,
                tangentialPressure: 0,
                twist: 0,
                buttons: 1,
                ctrlKey: event.ctrlKey || false,
                shiftKey: event.shiftKey || false,
                altKey: event.altKey || false,
                metaKey: event.metaKey || false,
                timestamp: event.timeStamp || Date.now(),
                touchCount: touches.length
            };
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CoordinateManager.extractTouchInfo');
            return this._createEmptyPointerInfo();
        }
    }

    /**
     * 座標の距離を計算
     * @param {object} point1 - 座標1 {x, y}
     * @param {object} point2 - 座標2 {x, y}
     * @returns {number} 距離
     */
    calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 座標の角度を計算
     * @param {object} point1 - 座標1 {x, y}
     * @param {object} point2 - 座標2 {x, y}
     * @returns {number} 角度（ラジアン）
     */
    calculateAngle(point1, point2) {
        return Math.atan2(point2.y - point1.y, point2.x - point1.x);
    }

    /**
     * 座標を指定範囲内にクランプ
     * @param {object} point - 座標 {x, y}
     * @param {object} bounds - 範囲 {minX, minY, maxX, maxY}
     * @returns {object} クランプされた座標
     */
    clampPoint(point, bounds) {
        return {
            x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y))
        };
    }

    /**
     * 平滑化設定を更新
     * @param {boolean} enabled - 平滑化有効/無効
     * @param {number} factor - 平滑化係数（0-1）
     */
    setSmoothingOptions(enabled, factor = 0.3) {
        this.smoothingEnabled = enabled;
        this.smoothingFactor = Math.max(0, Math.min(1, factor));
        console.log(`[CoordinateManager] Smoothing: ${enabled ? 'enabled' : 'disabled'}, factor: ${this.smoothingFactor}`);
    }

    /**
     * 座標履歴を取得
     * @param {number} limit - 取得件数制限
     * @returns {Array} 座標履歴
     */
    getPointHistory(limit = null) {
        return limit ? this.pointHistory.slice(-limit) : [...this.pointHistory];
    }

    /**
     * 座標履歴をクリア
     */
    clearHistory() {
        this.pointHistory = [];
    }

    /**
     * 入力機能の対応状況を取得
     * @returns {object} 対応状況
     */
    getInputCapabilities() {
        return {
            supportsPressure: this.supportsPressure,
            supportsTilt: this.supportsTilt,
            hasPointerEvents: 'onpointerdown' in window,
            hasTouchEvents: 'ontouchstart' in window,
            isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0
        };
    }

    /**
     * キャンバス矩形を更新
     * @private
     */
    _updateCanvasRect() {
        if (this.canvasElement) {
            this.canvasRect = this.canvasElement.getBoundingClientRect();
        }
    }

    /**
     * 圧力値を正規化
     * @private
     */
    _normalizePressure(pressure) {
        if (!this.pressureNormalization) {
            return pressure;
        }
        
        // 圧力値が未定義または0の場合はデフォルト値
        if (pressure === undefined || pressure === 0) {
            return 0.5;
        }
        
        // 0-1の範囲にクランプ
        return Math.max(0, Math.min(1, pressure));
    }

    /**
     * 座標に平滑化を適用
     * @private
     */
    _applySmoothingToPoint(point) {
        if (this.pointHistory.length === 0) {
            return { x: point.x, y: point.y };
        }
        
        const lastPoint = this.pointHistory[this.pointHistory.length - 1];
        const smoothedX = lastPoint.x + (point.x - lastPoint.x) * this.smoothingFactor;
        const smoothedY = lastPoint.y + (point.y - lastPoint.y) * this.smoothingFactor;
        
        return {
            x: smoothedX,
            y: smoothedY
        };
    }

    /**
     * 履歴に座標を追加
     * @private
     */
    _addToHistory(point) {
        this.pointHistory.push({
            x: point.x,
            y: point.y,
            pressure: point.pressure,
            timestamp: point.timestamp
        });
        
        // 履歴サイズ制限
        if (this.pointHistory.length > this.maxHistorySize) {
            this.pointHistory.shift();
        }
    }

    /**
     * 空のポインター情報を作成
     * @private
     */
    _createEmptyPointerInfo() {
        return {
            x: 0, y: 0, browserX: 0, browserY: 0,
            pointerId: -1, pointerType: 'unknown', isPrimary: false,
            pressure: 0, tiltX: 0, tiltY: 0, tangentialPressure: 0, twist: 0,
            buttons: 0, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
            timestamp: Date.now()
        };
    }

    /**
     * 入力機能の対応を検出
     * @private
     */
    _detectInputCapabilities() {
        // 圧力感知対応チェック
        this.supportsPressure = 'onpointerdown' in window;
        
        // 傾き対応チェック
        this.supportsTilt = 'onpointerdown' in window;
        
        console.log('[CoordinateManager] Input capabilities detected:', {
            pressure: this.supportsPressure,
            tilt: this.supportsTilt
        });
    }
}

// グローバルインスタンスを作成・公開
window.CoordinateManager = new CoordinateManager();

console.log('[CoordinateManager] Initialized and registered to window.CoordinateManager');