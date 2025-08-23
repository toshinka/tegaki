/**
 * 📐 CoordinateManager - 入力座標の変換・補正システム
 * ✅ UNIFIED_SYSTEM: 統一座標変換・補正システム
 * 📋 RESPONSIBILITY: 「座標変換・平滑化・入力処理」専門
 * 
 * 📏 DESIGN_PRINCIPLE: Tool座標処理の統一窓口・バグ修正主戦場
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🚫 COORDINATE_BUG_PREVENTION: 0,0座標バグ対策強化
 * 
 * 依存: ErrorManager（基盤システム）
 * 公開: Tegaki.CoordinateManager, Tegaki.CoordinateManagerInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

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
        this.coordinatePrecision = 2; // 小数点以下桁数
        
        this._detectInputCapabilities();
    }

    /**
     * 座標変換統一API（改修手順書対応）
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {DOMRect} rect - キャンバス矩形
     * @returns {object} キャンバス座標
     */
    screenToCanvas(screenX, screenY, rect = null) {
        try {
            const targetRect = rect || this.canvasRect;
            
            if (!targetRect) {
                this._updateCanvasRect();
                if (!this.canvasRect) {
                    console.warn('[CoordinateManager] Canvas rect unavailable, using fallback');
                    return { x: screenX, y: screenY };
                }
            }
            
            const actualRect = targetRect || this.canvasRect;
            
            // 🚫 座標バグ修正: 正確な変換処理
            const canvasX = (screenX - actualRect.left - this.panX) / this.scale;
            const canvasY = (screenY - actualRect.top - this.panY) / this.scale;

            return {
                x: this.applyPrecision(canvasX),
                y: this.applyPrecision(canvasY)
            };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.screenToCanvas');
            } else {
                console.error('[CoordinateManager.screenToCanvas]', error);
            }
            return { x: 0, y: 0 };
        }
    }

    /**
     * キャンバス座標をPixiJS座標に変換（改修手順書対応）
     * @param {number} canvasX - キャンバス座標X
     * @param {number} canvasY - キャンバス座標Y  
     * @param {object} pixiApp - PixiJSアプリケーション
     * @returns {object} PixiJS座標
     */
    canvasToPixi(canvasX, canvasY, pixiApp = null) {
        try {
            // PixiJSの場合、通常はキャンバス座標がそのまま使用可能
            // 必要に応じてスケール調整
            const pixiX = this.applyPrecision(canvasX);
            const pixiY = this.applyPrecision(canvasY);

            return { x: pixiX, y: pixiY };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.canvasToPixi');
            } else {
                console.error('[CoordinateManager.canvasToPixi]', error);
            }
            return { x: 0, y: 0 };
        }
    }

    /**
     * PointerEventから座標抽出（改修手順書対応）
     * @param {PointerEvent} event - PointerEvent
     * @param {DOMRect} rect - キャンバス矩形
     * @param {object} app - PixiJSアプリケーション
     * @returns {object} 抽出された座標情報
     */
    extractPointerCoordinates(event, rect = null, app = null) {
        try {
            // スクリーン座標を取得
            const screenX = event.clientX;
            const screenY = event.clientY;
            
            // キャンバス座標に変換
            const canvasCoords = this.screenToCanvas(screenX, screenY, rect);
            
            // PixiJS座標に変換
            const pixiCoords = this.canvasToPixi(canvasCoords.x, canvasCoords.y, app);
            
            const coordinateInfo = {
                // 基本座標（各段階）
                screen: { x: screenX, y: screenY },
                canvas: canvasCoords,
                pixi: pixiCoords,
                
                // 最終利用座標（PixiJS用）
                x: pixiCoords.x,
                y: pixiCoords.y,
                
                // ポインター詳細情報
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                isPrimary: event.isPrimary,
                
                // 圧力・傾き情報（バグ修正強化）
                pressure: this._normalizePressure(event.pressure),
                tiltX: this.supportsTilt ? (event.tiltX || 0) : 0,
                tiltY: this.supportsTilt ? (event.tiltY || 0) : 0,
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
                coordinateInfo.smoothed = this._applySmoothingToPoint(coordinateInfo);
            }
            
            // 座標妥当性確認
            this.validateCoordinateIntegrity(coordinateInfo);
            
            // 履歴に追加
            this._addToHistory(coordinateInfo);
            
            return coordinateInfo;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.extractPointerCoordinates');
            } else {
                console.error('[CoordinateManager.extractPointerCoordinates]', error);
            }
            return this._createEmptyPointerInfo();
        }
    }

    /**
     * 精度適用（改修手順書対応）
     * @param {number} value - 座標値
     * @returns {number} 精度適用後の値
     */
    applyPrecision(value) {
        return parseFloat(value.toFixed(this.coordinatePrecision));
    }

    /**
     * 座標妥当性確認（改修手順書対応）
     * @param {object} coords - 座標オブジェクト
     * @returns {boolean} 妥当性
     */
    validateCoordinateIntegrity(coords) {
        try {
            const issues = [];
            
            // NaN・無限大チェック
            if (!isFinite(coords.x)) issues.push(`Invalid x coordinate: ${coords.x}`);
            if (!isFinite(coords.y)) issues.push(`Invalid y coordinate: ${coords.y}`);
            
            // 範囲チェック（巨大な値の検出）
            const maxCoord = 1000000; // 100万ピクセル上限
            if (Math.abs(coords.x) > maxCoord) issues.push(`X coordinate too large: ${coords.x}`);
            if (Math.abs(coords.y) > maxCoord) issues.push(`Y coordinate too large: ${coords.y}`);
            
            // 圧力値チェック
            if (coords.pressure !== undefined) {
                if (!isFinite(coords.pressure) || coords.pressure < 0 || coords.pressure > 1) {
                    issues.push(`Invalid pressure: ${coords.pressure}`);
                }
            }
            
            if (issues.length > 0) {
                console.warn('[CoordinateManager] Coordinate validation issues:', issues);
                return false;
            }
            
            return true;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.validateCoordinateIntegrity');
            }
            return false;
        }
    }

    /**
     * キャンバス要素を設定
     * @param {HTMLElement} canvasElement - キャンバス要素
     */
    setCanvasElement(canvasElement) {
        if (!canvasElement) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle('Canvas element is null', 'CoordinateManager.setCanvasElement');
            } else {
                console.error('[CoordinateManager] Canvas element is null');
            }
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
     * ブラウザ座標をキャンバス座標に変換（旧API互換）
     * @param {object} browserPoint - ブラウザ座標 {x, y}
     * @returns {object} キャンバス座標 {x, y}
     */
    transformPoint(browserPoint) {
        return this.screenToCanvas(browserPoint.x, browserPoint.y);
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
                x: this.applyPrecision(browserX),
                y: this.applyPrecision(browserY)
            };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.inverseTransformPoint');
            } else {
                console.error('[CoordinateManager.inverseTransformPoint]', error);
            }
            return { x: 0, y: 0 };
        }
    }

    /**
     * PointerEventから拡張座標情報を取得（旧API互換）
     * @param {PointerEvent} event - PointerEvent
     * @returns {object} 拡張座標情報
     */
    extractPointerInfo(event) {
        return this.extractPointerCoordinates(event, this.canvasRect, null);
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
            
            const canvasCoords = this.screenToCanvas(touch.clientX, touch.clientY);
            const pixiCoords = this.canvasToPixi(canvasCoords.x, canvasCoords.y);
            
            return {
                // 各段階の座標
                screen: { x: touch.clientX, y: touch.clientY },
                canvas: canvasCoords,
                pixi: pixiCoords,
                
                // 最終利用座標
                x: pixiCoords.x,
                y: pixiCoords.y,
                
                // タッチ情報
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
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.extractTouchInfo');
            } else {
                console.error('[CoordinateManager.extractTouchInfo]', error);
            }
            return this._createEmptyPointerInfo();
        }
    }

    /**
     * 座標の距離を計算（改修手順書対応）
     * @param {object} point1 - 座標1 {x, y}
     * @param {object} point2 - 座標2 {x, y}
     * @returns {number} 距離
     */
    calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return this.applyPrecision(Math.sqrt(dx * dx + dy * dy));
    }

    /**
     * 座標の角度を計算（改修手順書対応）
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
            x: this.applyPrecision(Math.max(bounds.minX, Math.min(bounds.maxX, point.x))),
            y: this.applyPrecision(Math.max(bounds.minY, Math.min(bounds.maxY, point.y)))
        };
    }

    /**
     * キャンバスサイズを更新（改修手順書対応）
     * @param {number} width - 幅
     * @param {number} height - 高さ
     */
    updateCanvasSize(width, height) {
        try {
            if (this.canvasElement) {
                this.canvasElement.width = width;
                this.canvasElement.height = height;
                this._updateCanvasRect();
                console.log(`[CoordinateManager] Canvas size updated: ${width}x${height}`);
            }
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.updateCanvasSize');
            }
        }
    }

    /**
     * 座標管理状態を取得（改修手順書対応）
     * @returns {object} 状態情報
     */
    getCoordinateState() {
        return {
            canvasRect: this.canvasRect,
            scale: this.scale,
            panX: this.panX,
            panY: this.panY,
            smoothingEnabled: this.smoothingEnabled,
            smoothingFactor: this.smoothingFactor,
            coordinatePrecision: this.coordinatePrecision,
            capabilities: this.getInputCapabilities(),
            historySize: this.pointHistory.length
        };
    }

    /**
     * 座標変換テスト（改修手順書対応）
     * @returns {object} テスト結果
     */
    runCoordinateTest() {
        try {
            const testResults = {
                passed: 0,
                failed: 0,
                issues: []
            };
            
            // テスト1: 基本座標変換
            const testCoords = { x: 100, y: 100 };
            const transformed = this.screenToCanvas(testCoords.x, testCoords.y);
            
            if (isFinite(transformed.x) && isFinite(transformed.y)) {
                testResults.passed++;
            } else {
                testResults.failed++;
                testResults.issues.push('Basic coordinate transformation failed');
            }
            
            // テスト2: 精度適用
            const precisionTest = this.applyPrecision(3.14159265359);
            const expectedDigits = this.coordinatePrecision;
            const actualDigits = (precisionTest.toString().split('.')[1] || '').length;
            
            if (actualDigits <= expectedDigits) {
                testResults.passed++;
            } else {
                testResults.failed++;
                testResults.issues.push(`Precision test failed: expected ${expectedDigits} digits, got ${actualDigits}`);
            }
            
            // テスト3: 座標妥当性チェック
            const validCoords = { x: 10, y: 20, pressure: 0.5 };
            const invalidCoords = { x: NaN, y: Infinity, pressure: 2.0 };
            
            if (this.validateCoordinateIntegrity(validCoords) && !this.validateCoordinateIntegrity(invalidCoords)) {
                testResults.passed++;
            } else {
                testResults.failed++;
                testResults.issues.push('Coordinate validation test failed');
            }
            
            testResults.success = testResults.failed === 0;
            return testResults;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.runCoordinateTest');
            }
            return { passed: 0, failed: 1, issues: ['Test execution failed'], success: false };
        }
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

    // ========================================
    // 内部メソッド
    // ========================================

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
            x: this.applyPrecision(smoothedX),
            y: this.applyPrecision(smoothedY)
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
            screen: { x: 0, y: 0 },
            canvas: { x: 0, y: 0 },
            pixi: { x: 0, y: 0 },
            x: 0, y: 0,
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

// Tegaki名前空間にクラスを登録
Tegaki.CoordinateManager = CoordinateManager;

// 初期化レジストリに追加（座標処理専門）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.CoordinateManagerInstance = new Tegaki.CoordinateManager();
    console.log('[CoordinateManager] ✅ Tegaki.CoordinateManagerInstance 初期化完了');
});

console.log('[CoordinateManager] ✅ Tegaki名前空間統一・レジストリ登録完了');/**
 * 📐 CoordinateManager - 入力座標の変換・補正システム
 * ✅ UNIFIED_SYSTEM: 統一座標変換・補正システム
 * 📋 RESPONSIBILITY: 「座標変換・平滑化・入力処理」専門
 * 
 * 📏 DESIGN_PRINCIPLE: Tool座標処理の統一窓口・バグ修正主戦場
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🚫 COORDINATE_BUG_PREVENTION: 0,0座標バグ対策強化
 * 
 * 依存: ErrorManager（基盤システム）
 * 公開: Tegaki.CoordinateManager, Tegaki.CoordinateManagerInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

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
        this.coordinatePrecision = 2; // 小数点以下桁数
        
        this._detectInputCapabilities();
    }

    /**
     * 座標変換統一API（改修手順書対応）
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {DOMRect} rect - キャンバス矩形
     * @returns {object} キャンバス座標
     */
    screenToCanvas(screenX, screenY, rect = null) {
        try {
            const targetRect = rect || this.canvasRect;
            
            if (!targetRect) {
                this._updateCanvasRect();
                if (!this.canvasRect) {
                    console.warn('[CoordinateManager] Canvas rect unavailable, using fallback');
                    return { x: screenX, y: screenY };
                }
            }
            
            const actualRect = targetRect || this.canvasRect;
            
            // 🚫 座標バグ修正: 正確な変換処理
            const canvasX = (screenX - actualRect.left - this.panX) / this.scale;
            const canvasY = (screenY - actualRect.top - this.panY) / this.scale;

            return {
                x: this.applyPrecision(canvasX),
                y: this.applyPrecision(canvasY)
            };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.screenToCanvas');
            } else {
                console.error('[CoordinateManager.screenToCanvas]', error);
            }
            return { x: 0, y: 0 };
        }
    }

    /**
     * キャンバス座標をPixiJS座標に変換（改修手順書対応）
     * @param {number} canvasX - キャンバス座標X
     * @param {number} canvasY - キャンバス座標Y  
     * @param {object} pixiApp - PixiJSアプリケーション
     * @returns {object} PixiJS座標
     */
    canvasToPixi(canvasX, canvasY, pixiApp = null) {
        try {
            // PixiJSの場合、通常はキャンバス座標がそのまま使用可能
            // 必要に応じてスケール調整
            const pixiX = this.applyPrecision(canvasX);
            const pixiY = this.applyPrecision(canvasY);

            return { x: pixiX, y: pixiY };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.canvasToPixi');
            } else {
                console.error('[CoordinateManager.canvasToPixi]', error);
            }
            return { x: 0, y: 0 };
        }
    }

    /**
     * PointerEventから座標抽出（改修手順書対応）
     * @param {PointerEvent} event - PointerEvent
     * @param {DOMRect} rect - キャンバス矩形
     * @param {object} app - PixiJSアプリケーション
     * @returns {object} 抽出された座標情報
     */
    extractPointerCoordinates(event, rect = null, app = null) {
        try {
            // スクリーン座標を取得
            const screenX = event.clientX;
            const screenY = event.clientY;
            
            // キャンバス座標に変換
            const canvasCoords = this.screenToCanvas(screenX, screenY, rect);
            
            // PixiJS座標に変換
            const pixiCoords = this.canvasToPixi(canvasCoords.x, canvasCoords.y, app);
            
            const coordinateInfo = {
                // 基本座標（各段階）
                screen: { x: screenX, y: screenY },
                canvas: canvasCoords,
                pixi: pixiCoords,
                
                // 最終利用座標（PixiJS用）
                x: pixiCoords.x,
                y: pixiCoords.y,
                
                // ポインター詳細情報
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                isPrimary: event.isPrimary,
                
                // 圧力・傾き情報（バグ修正強化）
                pressure: this._normalizePressure(event.pressure),
                tiltX: this.supportsTilt ? (event.tiltX || 0) : 0,
                tiltY: this.supportsTilt ? (event.tiltY || 0) : 0,
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
                coordinateInfo.smoothed = this._applySmoothingToPoint(coordinateInfo);
            }
            
            // 座標妥当性確認
            this.validateCoordinateIntegrity(coordinateInfo);
            
            // 履歴に追加
            this._addToHistory(coordinateInfo);
            
            return coordinateInfo;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.extractPointerCoordinates');
            } else {
                console.error('[CoordinateManager.extractPointerCoordinates]', error);
            }
            return this._createEmptyPointerInfo();
        }
    }

    /**
     * 精度適用（改修手順書対応）
     * @param {number} value - 座標値
     * @returns {number} 精度適用後の値
     */
    applyPrecision(value) {
        return parseFloat(value.toFixed(this.coordinatePrecision));
    }

    /**
     * 座標妥当性確認（改修手順書対応）
     * @param {object} coords - 座標オブジェクト
     * @returns {boolean} 妥当性
     */
    validateCoordinateIntegrity(coords) {
        try {
            const issues = [];
            
            // NaN・無限大チェック
            if (!isFinite(coords.x)) issues.push(`Invalid x coordinate: ${coords.x}`);
            if (!isFinite(coords.y)) issues.push(`Invalid y coordinate: ${coords.y}`);
            
            // 範囲チェック（巨大な値の検出）
            const maxCoord = 1000000; // 100万ピクセル上限
            if (Math.abs(coords.x) > maxCoord) issues.push(`X coordinate too large: ${coords.x}`);
            if (Math.abs(coords.y) > maxCoord) issues.push(`Y coordinate too large: ${coords.y}`);
            
            // 圧力値チェック
            if (coords.pressure !== undefined) {
                if (!isFinite(coords.pressure) || coords.pressure < 0 || coords.pressure > 1) {
                    issues.push(`Invalid pressure: ${coords.pressure}`);
                }
            }
            
            if (issues.length > 0) {
                console.warn('[CoordinateManager] Coordinate validation issues:', issues);
                return false;
            }
            
            return true;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.validateCoordinateIntegrity');
            }
            return false;
        }
    }

    /**
     * キャンバス要素を設定
     * @param {HTMLElement} canvasElement - キャンバス要素
     */
    setCanvasElement(canvasElement) {
        if (!canvasElement) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle('Canvas element is null', 'CoordinateManager.setCanvasElement');
            } else {
                console.error('[CoordinateManager] Canvas element is null');
            }
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
     * ブラウザ座標をキャンバス座標に変換（旧API互換）
     * @param {object} browserPoint - ブラウザ座標 {x, y}
     * @returns {object} キャンバス座標 {x, y}
     */
    transformPoint(browserPoint) {
        return this.screenToCanvas(browserPoint.x, browserPoint.y);
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
                x: this.applyPrecision(browserX),
                y: this.applyPrecision(browserY)
            };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.inverseTransformPoint');
            } else {
                console.error('[CoordinateManager.inverseTransformPoint]', error);
            }
            return { x: 0, y: 0 };
        }
    }

    /**
     * PointerEventから拡張座標情報を取得（旧API互換）
     * @param {PointerEvent} event - PointerEvent
     * @returns {object} 拡張座標情報
     */
    extractPointerInfo(event) {
        return this.extractPointerCoordinates(event, this.canvasRect, null);
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
            
            const canvasCoords = this.screenToCanvas(touch.clientX, touch.clientY);
            const pixiCoords = this.canvasToPixi(canvasCoords.x, canvasCoords.y);
            
            return {
                // 各段階の座標
                screen: { x: touch.clientX, y: touch.clientY },
                canvas: canvasCoords,
                pixi: pixiCoords,
                
                // 最終利用座標
                x: pixiCoords.x,
                y: pixiCoords.y,
                
                // タッチ情報
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
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.extractTouchInfo');
            } else {
                console.error('[CoordinateManager.extractTouchInfo]', error);
            }
            return this._createEmptyPointerInfo();
        }
    }

    /**
     * 座標の距離を計算（改修手順書対応）
     * @param {object} point1 - 座標1 {x, y}
     * @param {object} point2 - 座標2 {x, y}
     * @returns {number} 距離
     */
    calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return this.applyPrecision(Math.sqrt(dx * dx + dy * dy));
    }

    /**
     * 座標の角度を計算（改修手順書対応）
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
            x: this.applyPrecision(Math.max(bounds.minX, Math.min(bounds.maxX, point.x))),
            y: this.applyPrecision(Math.max(bounds.minY, Math.min(bounds.maxY, point.y)))
        };
    }

    /**
     * キャンバスサイズを更新（改修手順書対応）
     * @param {number} width - 幅
     * @param {number} height - 高さ
     */
    updateCanvasSize(width, height) {
        try {
            if (this.canvasElement) {
                this.canvasElement.width = width;
                this.canvasElement.height = height;
                this._updateCanvasRect();
                console.log(`[CoordinateManager] Canvas size updated: ${width}x${height}`);
            }
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.updateCanvasSize');
            }
        }
    }

    /**
     * 座標管理状態を取得（改修手順書対応）
     * @returns {object} 状態情報
     */
    getCoordinateState() {
        return {
            canvasRect: this.canvasRect,
            scale: this.scale,
            panX: this.panX,
            panY: this.panY,
            smoothingEnabled: this.smoothingEnabled,
            smoothingFactor: this.smoothingFactor,
            coordinatePrecision: this.coordinatePrecision,
            capabilities: this.getInputCapabilities(),
            historySize: this.pointHistory.length
        };
    }

    /**
     * 座標変換テスト（改修手順書対応）
     * @returns {object} テスト結果
     */
    runCoordinateTest() {
        try {
            const testResults = {
                passed: 0,
                failed: 0,
                issues: []
            };
            
            // テスト1: 基本座標変換
            const testCoords = { x: 100, y: 100 };
            const transformed = this.screenToCanvas(testCoords.x, testCoords.y);
            
            if (isFinite(transformed.x) && isFinite(transformed.y)) {
                testResults.passed++;
            } else {
                testResults.failed++;
                testResults.issues.push('Basic coordinate transformation failed');
            }
            
            // テスト2: 精度適用
            const precisionTest = this.applyPrecision(3.14159265359);
            const expectedDigits = this.coordinatePrecision;
            const actualDigits = (precisionTest.toString().split('.')[1] || '').length;
            
            if (actualDigits <= expectedDigits) {
                testResults.passed++;
            } else {
                testResults.failed++;
                testResults.issues.push(`Precision test failed: expected ${expectedDigits} digits, got ${actualDigits}`);
            }
            
            // テスト3: 座標妥当性チェック
            const validCoords = { x: 10, y: 20, pressure: 0.5 };
            const invalidCoords = { x: NaN, y: Infinity, pressure: 2.0 };
            
            if (this.validateCoordinateIntegrity(validCoords) && !this.validateCoordinateIntegrity(invalidCoords)) {
                testResults.passed++;
            } else {
                testResults.failed++;
                testResults.issues.push('Coordinate validation test failed');
            }
            
            testResults.success = testResults.failed === 0;
            return testResults;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'CoordinateManager.runCoordinateTest');
            }
            return { passed: 0, failed: 1, issues: ['Test execution failed'], success: false };
        }
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

    // ========================================
    // 内部メソッド
    // ========================================

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
            x: this.applyPrecision(smoothedX),
            y: this.applyPrecision(smoothedY)
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
            screen: { x: 0, y: 0 },
            canvas: { x: 0, y: 0 },
            pixi: { x: 0, y: 0 },
            x: 0, y: 0,
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

// Tegaki名前空間にクラスを登録
Tegaki.CoordinateManager = CoordinateManager;

// 初期化レジストリに追加（座標処理専門）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.CoordinateManagerInstance = new Tegaki.CoordinateManager();
    console.log('[CoordinateManager] ✅ Tegaki.CoordinateManagerInstance 初期化完了');
});

console.log('[CoordinateManager] ✅ Tegaki名前空間統一・レジストリ登録完了');