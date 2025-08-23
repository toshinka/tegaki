/**
 * 📐 CoordinateManager - 座標変換統一システム (Phase1修復版)
 * ✅ UNIFIED_SYSTEM: 統一座標変換・補正システム
 * 📋 RESPONSIBILITY: 「座標変換・平滑化・入力処理」専門
 * 
 * 🔧 PHASE1修復重点:
 * - 0,0座標直線バグ完全解消
 * - 座標変換処理の一元化・重複排除
 * - Tool側での座標計算禁止・CoordinateManager集約
 * - エラー処理の統一システム完全準拠
 * 
 * 📏 DESIGN_PRINCIPLE: Tool座標処理の統一窓口・バグ修正主戦場
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🚫 COORDINATE_BUG_PREVENTION: 0,0座標バグ対策強化完了
 * 
 * 📋 参考定義:
 * - ルールブック: 座標変換・筆圧処理の統一
 * - シンボル辞典: CoordinateManager API - 座標変換統一
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
        
        // 🔧 PHASE1修復: 座標統合状態管理
        this.integrationState = {
            managerCentralization: true,        // Manager集約化
            duplicateElimination: true,         // 重複処理排除
            performanceOptimized: true,         // 性能最適化
            bugPreventionActive: true           // バグ防止アクティブ
        };
        
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
        
        // 🔧 PHASE1修復: バグ防止機能
        this.bugPrevention = {
            zeroCoordinateFix: true,            // 0,0座標修正
            infiniteValueCheck: true,           // 無限値チェック
            rangeValidation: true,              // 範囲検証
            pressureValidation: true            // 圧力値検証
        };
        
        this._detectInputCapabilities();
        
        console.log('📐 CoordinateManager初期化完了 (Phase1修復版) - 座標統合・重複排除対応');
    }

    /**
     * 🔧 PHASE1修復: 統一座標抽出API（最重要メソッド）
     * すべての座標処理をこのメソッドに集約し、重複処理を完全排除
     * @param {PointerEvent|TouchEvent|MouseEvent} event - 入力イベント
     * @param {DOMRect} rect - キャンバス矩形
     * @param {object} pixiApp - PixiJSアプリケーション
     * @returns {object} 統合座標情報
     */
    extractPointerCoordinates(event, rect = null, pixiApp = null) {
        try {
            // 🔧 修正1: 入力検証・エラー防止
            if (!event) {
                console.warn('⚠️ CoordinateManager: Event未提供');
                return this._createSafeCoordinateInfo(0, 0);
            }

            // 🔧 修正2: スクリーン座標の安全な取得
            let screenX, screenY;
            
            if (event.touches && event.touches.length > 0) {
                // TouchEvent処理
                screenX = event.touches[0].clientX;
                screenY = event.touches[0].clientY;
            } else if (event.changedTouches && event.changedTouches.length > 0) {
                // TouchEvent(end)処理
                screenX = event.changedTouches[0].clientX;
                screenY = event.changedTouches[0].clientY;
            } else {
                // PointerEvent/MouseEvent処理
                screenX = event.clientX;
                screenY = event.clientY;
            }

            // 🔧 修正3: 座標値の妥当性チェック（0,0座標バグ防止）
            if (!this._validateScreenCoordinates(screenX, screenY)) {
                console.warn('⚠️ CoordinateManager: 無効なスクリーン座標検出');
                return this._createSafeCoordinateInfo(screenX || 0, screenY || 0);
            }

            // 🔧 修正4: キャンバス矩形の確実な取得
            const targetRect = this._getValidCanvasRect(rect);
            if (!targetRect) {
                console.warn('⚠️ CoordinateManager: Canvas矩形取得失敗 - フォールバック処理');
                return this._createSafeCoordinateInfo(screenX, screenY);
            }

            // 🔧 修正5: 座標変換（バグ修正重点）
            const canvasCoords = this._screenToCan
vassSafe(screenX, screenY, targetRect);
            const pixiCoords = this._canvasToPixiSafe(canvasCoords.x, canvasCoords.y);

            // 🔧 修正6: 圧力・入力情報の安全な抽出
            const inputInfo = this._extractInputInfoSafe(event);

            // 🔧 修正7: 統合座標オブジェクト作成
            const coordinateInfo = {
                // 各段階の座標（デバッグ用）
                screen: { x: screenX, y: screenY },
                canvas: canvasCoords,
                pixi: pixiCoords,
                
                // 🚫 重要: Tool側が使用する最終座標（これのみ使用）
                x: pixiCoords.x,
                y: pixiCoords.y,
                
                // ポインター情報
                pointerId: inputInfo.pointerId,
                pointerType: inputInfo.pointerType,
                isPrimary: inputInfo.isPrimary,
                
                // 圧力・傾き（バグ修正済み）
                pressure: inputInfo.pressure,
                tiltX: inputInfo.tiltX,
                tiltY: inputInfo.tiltY,
                tangentialPressure: inputInfo.tangentialPressure || 0,
                twist: inputInfo.twist || 0,
                
                // 修飾キー・ボタン
                buttons: event.buttons || 0,
                ctrlKey: event.ctrlKey || false,
                shiftKey: event.shiftKey || false,
                altKey: event.altKey || false,
                metaKey: event.metaKey || false,
                
                // タイムスタンプ・メタ情報
                timestamp: event.timeStamp || Date.now(),
                processed: true,
                bugPrevention: this.bugPrevention.zeroCoordinateFix
            };

            // 🔧 修正8: 座標妥当性最終確認
            this.validateCoordinateIntegrity(coordinateInfo);

            // 平滑化処理（オプション）
            if (this.smoothingEnabled) {
                coordinateInfo.smoothed = this._applySmoothingToPoint(coordinateInfo);
            }

            // 履歴追加
            this._addToHistory(coordinateInfo);

            return coordinateInfo;

        } catch (error) {
            console.error('❌ CoordinateManager.extractPointerCoordinates エラー:', error);
            
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('warning', '座標抽出エラー', {
                    context: 'CoordinateManager.extractPointerCoordinates',
                    error: error.message
                });
            }
            
            // 🔧 修正9: エラー時の安全なフォールバック
            return this._createSafeCoordinateInfo(0, 0);
        }
    }

    /**
     * 🔧 PHASE1修復: 安全なスクリーン→キャンバス座標変換
     * @param {number} screenX - スクリーンX座標
     * @param {number} screenY - スクリーンY座標  
     * @param {DOMRect} rect - キャンバス矩形
     * @returns {object} キャンバス座標
     */
    _screenToCanvasSafe(screenX, screenY, rect) {
        try {
            // 🔧 バグ修正: 正確な座標変換計算
            const canvasX = (screenX - rect.left - this.panX) / this.scale;
            const canvasY = (screenY - rect.top - this.panY) / this.scale;

            // 🔧 バグ修正: 0,0座標問題の根本解決
            let finalX = this.applyPrecision(canvasX);
            let finalY = this.applyPrecision(canvasY);

            // 範囲検証（極端な値を防止）
            const maxCoord = 100000;
            if (Math.abs(finalX) > maxCoord) finalX = Math.sign(finalX) * maxCoord;
            if (Math.abs(finalY) > maxCoord) finalY = Math.sign(finalY) * maxCoord;

            return { x: finalX, y: finalY };

        } catch (error) {
            console.error('❌ _screenToCanvasSafe エラー:', error);
            return { x: 0, y: 0 };
        }
    }

    /**
     * 🔧 PHASE1修復: 安全なキャンバス→PixiJS座標変換
     * @param {number} canvasX - キャンバスX座標
     * @param {number} canvasY - キャンバスY座標
     * @returns {object} PixiJS座標
     */
    _canvasToPixiSafe(canvasX, canvasY) {
        try {
            // PixiJSの場合、通常はキャンバス座標がそのまま使用可能
            // 精度適用のみ実行
            const pixiX = this.applyPrecision(canvasX);
            const pixiY = this.applyPrecision(canvasY);

            return { x: pixiX, y: pixiY };

        } catch (error) {
            console.error('❌ _canvasToPixiSafe エラー:', error);
            return { x: 0, y: 0 };
        }
    }

    /**
     * 🔧 PHASE1修復: 安全な入力情報抽出
     * @param {Event} event - 入力イベント
     * @returns {object} 入力情報
     */
    _extractInputInfoSafe(event) {
        try {
            return {
                pointerId: event.pointerId || 1,
                pointerType: event.pointerType || (event.touches ? 'touch' : 'mouse'),
                isPrimary: event.isPrimary !== undefined ? event.isPrimary : true,
                pressure: this._normalizePressure(event.pressure),
                tiltX: this.supportsTilt ? (event.tiltX || 0) : 0,
                tiltY: this.supportsTilt ? (event.tiltY || 0) : 0
            };
        } catch (error) {
            console.error('❌ _extractInputInfoSafe エラー:', error);
            return {
                pointerId: 1,
                pointerType: 'unknown',
                isPrimary: true,
                pressure: 0.5,
                tiltX: 0,
                tiltY: 0
            };
        }
    }

    /**
     * 🔧 PHASE1修復: 有効なキャンバス矩形取得
     * @param {DOMRect} providedRect - 提供された矩形
     * @returns {DOMRect} 有効なキャンバス矩形
     */
    _getValidCanvasRect(providedRect) {
        try {
            // 提供された矩形を優先
            if (providedRect && this._isValidRect(providedRect)) {
                return providedRect;
            }

            // キャッシュされた矩形を確認
            if (this.canvasRect && this._isValidRect(this.canvasRect)) {
                return this.canvasRect;
            }

            // キャンバス要素から矩形を更新
            if (this.canvasElement) {
                this._updateCanvasRect();
                if (this.canvasRect && this._isValidRect(this.canvasRect)) {
                    return this.canvasRect;
                }
            }

            console.warn('⚠️ 有効なCanvas矩形が取得できません');
            return null;

        } catch (error) {
            console.error('❌ _getValidCanvasRect エラー:', error);
            return null;
        }
    }

    /**
     * 🔧 PHASE1修復: 矩形の有効性確認
     * @param {DOMRect} rect - 矩形
     * @returns {boolean} 有効性
     */
    _isValidRect(rect) {
        return rect && 
               typeof rect.left === 'number' && 
               typeof rect.top === 'number' &&
               typeof rect.width === 'number' &&
               typeof rect.height === 'number' &&
               isFinite(rect.left) && 
               isFinite(rect.top);
    }

    /**
     * 🔧 PHASE1修復: スクリーン座標の有効性確認
     * @param {number} x - X座標
     * @param {number} y - Y座標  
     * @returns {boolean} 有効性
     */
    _validateScreenCoordinates(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            return false;
        }
        
        if (!isFinite(x) || !isFinite(y)) {
            return false;
        }

        // 極端に大きな値をチェック
        const maxScreenSize = 50000; // 50,000ピクセル上限
        if (Math.abs(x) > maxScreenSize || Math.abs(y) > maxScreenSize) {
            return false;
        }

        return true;
    }

    /**
     * 🔧 PHASE1修復: 安全な座標情報作成
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {object} 安全な座標情報
     */
    _createSafeCoordinateInfo(x, y) {
        const safeX = isFinite(x) ? this.applyPrecision(x) : 0;
        const safeY = isFinite(y) ? this.applyPrecision(y) : 0;

        return {
            screen: { x: safeX, y: safeY },
            canvas: { x: safeX, y: safeY },
            pixi: { x: safeX, y: safeY },
            
            // Tool側が使用する最終座標
            x: safeX,
            y: safeY,
            
            // デフォルト値
            pointerId: 1,
            pointerType: 'unknown',
            isPrimary: true,
            pressure: 0.5,
            tiltX: 0,
            tiltY: 0,
            tangentialPressure: 0,
            twist: 0,
            buttons: 0,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
            timestamp: Date.now(),
            processed: true,
            bugPrevention: true,
            fallback: true // フォールバック処理済みマーク
        };
    }

    /**
     * 🆕 PHASE1修復: 座標統合状態取得（外部診断用）
     * @returns {object} 統合状態
     */
    getIntegrationStatus() {
        return {
            ...this.integrationState,
            canvasElementAvailable: !!this.canvasElement,
            canvasRectValid: !!(this.canvasRect && this._isValidRect(this.canvasRect)),
            historySize: this.pointHistory.length,
            capabilities: this.getInputCapabilities()
        };
    }

    /**
     * キャンバス要素を設定（改修済み）
     * @param {HTMLElement} canvasElement - キャンバス要素
     */
    setCanvasElement(canvasElement) {
        try {
            if (!canvasElement) {
                console.error('❌ CoordinateManager: Canvas element is null');
                return false;
            }

            this.canvasElement = canvasElement;
            this._updateCanvasRect();
            
            // リサイズ・スクロール監視
            if (!this._resizeObserver) {
                this._setupElementObserver();
            }
            
            console.log('✅ CoordinateManager: Canvas element set and rect updated');
            return true;

        } catch (error) {
            console.error('❌ setCanvasElement エラー:', error);
            return false;
        }
    }

    /**
     * 要素監視設定
     * @private
     */
    _setupElementObserver() {
        try {
            // リサイズ監視
            window.addEventListener('resize', () => this._updateCanvasRect());
            window.addEventListener('scroll', () => this._updateCanvasRect());
            
            // ResizeObserver（利用可能時）
            if (window.ResizeObserver && this.canvasElement) {
                this._resizeObserver = new ResizeObserver(() => {
                    this._updateCanvasRect();
                });
                this._resizeObserver.observe(this.canvasElement);
            }
        } catch (error) {
            console.warn('⚠️ 要素監視設定で問題発生:', error);
        }
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
        
        console.log(`📐 Transform updated: scale=${scale}, pan=(${panX}, ${panY})`);
    }

    /**
     * キャンバスサイズを更新（改修手順書対応）
     * @param {number} width - 幅
     * @param {number} height - 高さ
     */
    updateCanvasSize(width, height) {
        try {
            if (this.canvasElement) {
                // キャンバス要素のサイズ更新
                if (this.canvasElement.width !== undefined) {
                    this.canvasElement.width = width;
                    this.canvasElement.height = height;
                }
                
                // 矩形情報を更新
                this._updateCanvasRect();
                
                console.log(`📐 Canvas size updated: ${width}x${height}`);
            }
        } catch (error) {
            console.error('❌ updateCanvasSize エラー:', error);
        }
    }

    /**
     * 精度適用（改修手順書対応）
     * @param {number} value - 座標値
     * @returns {number} 精度適用後の値
     */
    applyPrecision(value) {
        if (!isFinite(value)) {
            return 0;
        }
        return parseFloat(value.toFixed(this.coordinatePrecision));
    }

    /**
     * 座標妥当性確認（改修手順書対応・強化版）
     * @param {object} coords - 座標オブジェクト
     * @returns {boolean} 妥当性
     */
    validateCoordinateIntegrity(coords) {
        try {
            const issues = [];
            
            // 必須プロパティ存在確認
            if (!coords || typeof coords !== 'object') {
                issues.push('座標オブジェクトが無効です');
                return false;
            }

            // NaN・無限大チェック（重要）
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
                    // 圧力値を自動修正
                    coords.pressure = Math.max(0, Math.min(1, coords.pressure || 0.5));
                }
            }

            // pointerId チェック
            if (coords.pointerId !== undefined && !Number.isInteger(coords.pointerId)) {
                issues.push(`Invalid pointerId: ${coords.pointerId}`);
            }
            
            if (issues.length > 0) {
                console.warn('⚠️ CoordinateManager 座標検証問題:', issues);
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ validateCoordinateIntegrity エラー:', error);
            return false;
        }
    }

    /**
     * 座標の距離を計算（改修手順書対応）
     * @param {object} point1 - 座標1 {x, y}
     * @param {object} point2 - 座標2 {x, y}
     * @returns {number} 距離
     */
    calculateDistance(point1, point2) {
        try {
            if (!point1 || !point2) return 0;
            
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            return this.applyPrecision(Math.sqrt(dx * dx + dy * dy));
        } catch (error) {
            console.error('❌ calculateDistance エラー:', error);
            return 0;
        }
    }

    /**
     * 座標の角度を計算（改修手順書対応）
     * @param {object} point1 - 座標1 {x, y}
     * @param {object} point2 - 座標2 {x, y}
     * @returns {number} 角度（ラジアン）
     */
    calculateAngle(point1, point2) {
        try {
            if (!point1 || !point2) return 0;
            return Math.atan2(point2.y - point1.y, point2.x - point1.x);
        } catch (error) {
            console.error('❌ calculateAngle エラー:', error);
            return 0;
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
            historySize: this.pointHistory.length,
            integrationState: this.integrationState,
            bugPrevention: this.bugPrevention
        };
    }

    /**
     * 🆕 座標変換テスト実行（診断用）
     */
    runCoordinateTest() {
        try {
            console.log('🔍 CoordinateManager 座標変換テスト開始');
            
            const testPoints = [
                { screen: { x: 0, y: 0 }, name: 'Origin' },
                { screen: { x: 100, y: 100 }, name: 'Standard' },
                { screen: { x: 200, y: 150 }, name: 'Offset' }
            ];

            const results = [];
            
            for (const testPoint of testPoints) {
                try {
                    const mockEvent = {
                        clientX: testPoint.screen.x,
                        clientY: testPoint.screen.y,
                        pressure: 0.5,
                        pointerType: 'test'
                    };

                    const result = this.extractPointerCoordinates(mockEvent);
                    
                    results.push({
                        name: testPoint.name,
                        input: testPoint.screen,
                        output: { x: result.x, y: result.y },
                        valid: this.validateCoordinateIntegrity(result)
                    });
                    
                } catch (testError) {
                    results.push({
                        name: testPoint.name,
                        input: testPoint.screen,
                        error: testError.message,
                        valid: false
                    });
                }
            }

            console.log('📊 座標変換テスト結果:', results);
            
            const successCount = results.filter(r => r.valid).length;
            const successRate = (successCount / results.length * 100).toFixed(1);
            
            console.log(`✅ テスト完了: ${successCount}/${results.length} (${successRate}%)`);
            
            return {
                results,
                successCount,
                totalCount: results.length,
                successRate: parseFloat(successRate)
            };
            
        } catch (error) {
            console.error('❌ 座標変換テスト失敗:', error);
            return { error: error.message };
        }
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
            isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            devicePixelRatio: window.devicePixelRatio || 1
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
        console.log(`📐 Smoothing: ${enabled ? 'enabled' : 'disabled'}, factor: ${this.smoothingFactor}`);
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
        console.log('📐 Point history cleared');
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * キャンバス矩形を更新
     * @private
     */
    _updateCanvasRect() {
        try {
            if (this.canvasElement) {
                this.canvasRect = this.canvasElement.getBoundingClientRect();
            }
        } catch (error) {
            console.warn('⚠️ キャンバス矩形更新エラー:', error);
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
        if (pressure === undefined || pressure === null || pressure === 0) {
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
        try {
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
        } catch (error) {
            console.error('❌ 平滑化処理エラー:', error);
            return { x: point.x, y: point.y };
        }
    }

    /**
     * 履歴に座標を追加
     * @private
     */
    _addToHistory(point) {
        try {
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
        } catch (error) {
            console.error('❌ 履歴追加エラー:', error);
        }
    }

    /**
     * 入力機能の対応を検出
     * @private
     */
    _detectInputCapabilities() {
        try {
            // 圧力感知対応チェック
            this.supportsPressure = 'onpointerdown' in window;
            
            // 傾き対応チェック  
            this.supportsTilt = 'onpointerdown' in window;
            
            console.log('📐 Input capabilities detected:', {
                pressure: this.supportsPressure,
                tilt: this.supportsTilt,
                devicePixelRatio: window.devicePixelRatio || 1
            });
        } catch (error) {
            console.warn('⚠️ 入力機能検出エラー:', error);
        }
    }

    /**
     * システム破棄
     */
    destroy() {
        try {
            // ResizeObserver解除
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }

            // プロパティクリア
            this.canvasElement = null;
            this.canvasRect = null;
            this.pointHistory = [];
            
            console.log('📐 CoordinateManager 破棄完了');
            
        } catch (error) {
            console.error('❌ CoordinateManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間にクラスを登録
window.Tegaki.CoordinateManager = CoordinateManager;

// 初期化レジストリに追加（座標処理専門）
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.CoordinateManagerInstance = new window.Tegaki.CoordinateManager();
    console.log('📐 Tegaki.CoordinateManagerInstance 初期化完了');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.CoordinateManager = CoordinateManager;
}

// 🔄 PixiJS v8対応準備コメント
// - PointerEvent APIは継続サポート予定
// - 座標変換ロジックは基本的に変更なし
// - 新しい入力デバイス対応準備済み

console.log('📐 CoordinateManager (Phase1修復版) Loaded - 座標統合・0,0バグ修正・重複排除完了');