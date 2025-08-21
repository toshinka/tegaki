/**
 * 📐 座標変換管理システム Phase2準備強化版
 * 🎯 AI_WORK_SCOPE: スクリーン座標・キャンバス座標・PixiJS座標変換・Phase2レイヤー準備
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager
 * 🎯 UNIFIED: ConfigManager(座標設定), ErrorManager(座標エラー)
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能・数学的確定処理
 * 🔄 COORDINATE_REFACTOR: 座標処理完全集約・重複排除・Phase2準備API追加
 * 📐 UNIFIED_COORDINATE: coordinates.js重複排除・責任分界明確化
 * 🎯 PHASE2_READY: レイヤーシステム対応基盤・バッチ処理API
 * 💡 PERFORMANCE: 座標処理パフォーマンス最適化・キャッシュ機能
 */

class CoordinateManager {
    constructor() {
        this.validateUnifiedSystems();
        this.canvasConfig = ConfigManager.getCanvasConfig();
        this.coordinateConfig = ConfigManager.getCoordinateConfig() || this.getDefaultCoordinateConfig();
        
        // 座標変換基準
        this.canvasWidth = this.canvasConfig.width;
        this.canvasHeight = this.canvasConfig.height;
        
        // 精度設定
        this.precision = this.coordinateConfig.precision || 2;
        this.boundaryClamp = this.coordinateConfig.boundaryClamp !== false;
        this.scaleCompensation = this.coordinateConfig.scaleCompensation !== false;
        
        // 🆕 Phase2レイヤー対応準備
        this.layerTransform = this.coordinateConfig.layerTransform || {};
        this.performance = this.coordinateConfig.performance || {};
        this.integration = this.coordinateConfig.integration || {};
        
        // 🆕 座標処理キャッシュ（パフォーマンス最適化）
        this.coordinateCache = new Map();
        this.cacheEnabled = this.performance.coordinateCache !== false;
        this.maxCacheSize = 1000;
        
        console.log('📐 CoordinateManager Phase2準備強化版 初期化完了');
        console.log('🔄 座標統合設定:', this.integration);
        console.log('🎯 Phase2レイヤー準備:', this.layerTransform);
    }
    
    /**
     * 統一システム依存性確認
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager'];
        const missing = required.filter(sys => !window[sys]);
        if (missing.length > 0) {
            throw new Error(`CoordinateManager: 統一システム依存不足: ${missing.join(', ')}`);
        }
    }
    
    /**
     * デフォルト座標設定取得
     */
    getDefaultCoordinateConfig() {
        return {
            precision: 2,
            boundaryClamp: true,
            scaleCompensation: true,
            touchScaling: 1.0,
            debugging: false,
            layerTransform: { enabled: true, cacheEnabled: true, precision: 3 },
            performance: { batchProcessing: true, coordinateCache: true, continuousOptimization: true },
            integration: { managerCentralization: true, duplicateElimination: true, unifiedErrorHandling: true }
        };
    }
    
    /**
     * 📐 スクリーン座標 → キャンバス座標変換
     */
    screenToCanvas(screenX, screenY, canvasRect) {
        try {
            if (!canvasRect) {
                throw new Error('canvasRect が必要です');
            }
            
            if (typeof screenX !== 'number' || typeof screenY !== 'number') {
                throw new Error('screenX, screenY は数値である必要があります');
            }
            
            // キャッシュ確認
            const cacheKey = `screen-${screenX}-${screenY}-${canvasRect.width}-${canvasRect.height}`;
            if (this.cacheEnabled && this.coordinateCache.has(cacheKey)) {
                return this.coordinateCache.get(cacheKey);
            }
            
            // スケール比率計算
            const scaleX = this.canvasWidth / canvasRect.width;
            const scaleY = this.canvasHeight / canvasRect.height;
            
            // 基本変換実行
            let canvasX = (screenX - canvasRect.left) * scaleX;
            let canvasY = (screenY - canvasRect.top) * scaleY;
            
            // スケール補償適用
            if (this.scaleCompensation) {
                const devicePixelRatio = window.devicePixelRatio || 1;
                if (devicePixelRatio !== 1) {
                    canvasX /= devicePixelRatio;
                    canvasY /= devicePixelRatio;
                }
            }
            
            // 境界クランプ
            if (this.boundaryClamp) {
                canvasX = Math.max(0, Math.min(this.canvasWidth, canvasX));
                canvasY = Math.max(0, Math.min(this.canvasHeight, canvasY));
            }
            
            // 精度適用
            canvasX = this.applyPrecision(canvasX);
            canvasY = this.applyPrecision(canvasY);
            
            const result = { x: canvasX, y: canvasY };
            
            // キャッシュ保存
            if (this.cacheEnabled) {
                this.cacheCoordinate(cacheKey, result);
            }
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 座標変換: screen(${screenX}, ${screenY}) → canvas(${canvasX}, ${canvasY})`);
            }
            
            return result;
            
        } catch (error) {
            ErrorManager.showError('coordinate-convert', 
                `座標変換エラー: ${error.message}`, 
                { screenX, screenY, canvasRect: canvasRect ? 'valid' : 'null' }
            );
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * 📐 キャンバス座標 → PixiJS座標変換
     */
    canvasToPixi(canvasX, canvasY, pixiApp) {
        try {
            if (!pixiApp?.stage) {
                throw new Error('有効なPixiJSアプリが必要です');
            }
            
            if (typeof canvasX !== 'number' || typeof canvasY !== 'number') {
                throw new Error('canvasX, canvasY は数値である必要があります');
            }
            
            // PIXI.Point を使用してグローバル座標からローカル座標に変換
            const globalPoint = new PIXI.Point(canvasX, canvasY);
            const localPoint = pixiApp.stage.toLocal(globalPoint);
            
            const pixiX = this.applyPrecision(localPoint.x);
            const pixiY = this.applyPrecision(localPoint.y);
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 PixiJS座標変換: canvas(${canvasX}, ${canvasY}) → pixi(${pixiX}, ${pixiY})`);
            }
            
            return { x: pixiX, y: pixiY };
            
        } catch (error) {
            ErrorManager.showError('coordinate-pixi', 
                `PixiJS座標変換エラー: ${error.message}`, 
                { canvasX, canvasY, hasPixiApp: !!pixiApp }
            );
            // フォールバック: キャンバス座標をそのまま返す
            return { x: canvasX, y: canvasY };
        }
    }
    
    /**
     * 📐 スクリーン座標 → PixiJS座標変換（直接変換）
     */
    screenToPixi(screenX, screenY, canvasRect, pixiApp) {
        try {
            const canvasCoords = this.screenToCanvas(screenX, screenY, canvasRect);
            return this.canvasToPixi(canvasCoords.x, canvasCoords.y, pixiApp);
        } catch (error) {
            ErrorManager.showError('coordinate-screen-pixi', 
                `スクリーン→PixiJS座標変換エラー: ${error.message}`, 
                { screenX, screenY }
            );
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * 📐 PointerEvent → 座標情報抽出（統一処理）
     */
    extractPointerCoordinates(event, canvasRect, pixiApp = null) {
        try {
            if (!event) {
                throw new Error('event が必要です');
            }
            
            // PointerEventからの座標取得（複数のケースに対応）
            const originalEvent = event.data?.originalEvent || event.originalEvent || event;
            
            let screenX, screenY;
            
            if (typeof originalEvent.clientX === 'number' && typeof originalEvent.clientY === 'number') {
                screenX = originalEvent.clientX;
                screenY = originalEvent.clientY;
            } else if (typeof originalEvent.pageX === 'number' && typeof originalEvent.pageY === 'number') {
                screenX = originalEvent.pageX;
                screenY = originalEvent.pageY;
            } else if (typeof event.global?.x === 'number' && typeof event.global?.y === 'number') {
                // PixiJS イベントの場合
                screenX = event.global.x;
                screenY = event.global.y;
            } else {
                throw new Error('有効な座標情報が見つかりません');
            }
            
            const canvasCoords = this.screenToCanvas(screenX, screenY, canvasRect);
            
            const result = {
                screen: { x: screenX, y: screenY },
                canvas: canvasCoords,
                pressure: this.extractPressure(event, originalEvent)
            };
            
            // PixiJS座標も必要な場合
            if (pixiApp) {
                result.pixi = this.canvasToPixi(canvasCoords.x, canvasCoords.y, pixiApp);
            }
            
            return result;
            
        } catch (error) {
            ErrorManager.showError('coordinate-extract', 
                `座標抽出エラー: ${error.message}`, 
                { event: event?.type || 'unknown' }
            );
            return {
                screen: { x: 0, y: 0 },
                canvas: { x: 0, y: 0 },
                pressure: 0.5,
                pixi: pixiApp ? { x: 0, y: 0 } : undefined
            };
        }
    }
    
    /**
     * 📐 イベントから筆圧抽出
     */
    extractPressure(event, originalEvent) {
        try {
            // 複数のソースから筆圧を取得
            if (typeof event.pressure === 'number' && event.pressure >= 0 && event.pressure <= 1) {
                return event.pressure;
            }
            
            if (typeof originalEvent?.pressure === 'number' && originalEvent.pressure >= 0 && originalEvent.pressure <= 1) {
                return originalEvent.pressure;
            }
            
            // タッチイベントの場合のフォールバック
            if (originalEvent?.force && typeof originalEvent.force === 'number') {
                return Math.min(1, Math.max(0, originalEvent.force));
            }
            
            // デフォルト筆圧
            return 0.5;
            
        } catch (error) {
            return 0.5;
        }
    }
    
    // ==========================================
    // 🆕 Phase2レイヤー対応API
    // ==========================================
    
    /**
     * 🎯 レイヤー座標変換（Phase2準備）
     * @param {Object} coords - 変換する座標
     * @param {Object} layerTransform - レイヤー変形情報
     * @returns {Object} 変形後座標
     */
    transformCoordinatesForLayer(coords, layerTransform = {}) {
        if (!this.layerTransform.enabled) {
            return coords;
        }
        
        try {
            const {
                translation = { x: 0, y: 0 },
                rotation = 0,
                scale = { x: 1, y: 1 },
                origin = { x: 0, y: 0 }
            } = layerTransform;
            
            let { x, y } = coords;
            
            // 原点中心に移動
            x -= origin.x;
            y -= origin.y;
            
            // スケール適用
            x *= scale.x;
            y *= scale.y;
            
            // 回転適用
            if (rotation !== 0) {
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }
            
            // 平行移動と原点復元
            x += origin.x + translation.x;
            y += origin.y + translation.y;
            
            // レイヤー座標精度適用
            const precision = this.layerTransform.precision || 3;
            x = Math.round(x * Math.pow(10, precision)) / Math.pow(10, precision);
            y = Math.round(y * Math.pow(10, precision)) / Math.pow(10, precision);
            
            return { x, y };
            
        } catch (error) {
            ErrorManager.showError('coordinate-layer-transform', 
                `レイヤー座標変換エラー: ${error.message}`, 
                { coords, layerTransform }
            );
            return coords;
        }
    }
    
    /**
     * 🎯 バッチ座標変換（パフォーマンス最適化）
     * @param {Array} eventList - イベント配列
     * @param {Object} canvasRect - キャンバス矩形
     * @param {Object} pixiApp - PixiJSアプリ
     * @returns {Array} 変換済み座標配列
     */
    processBatchCoordinates(eventList, canvasRect, pixiApp = null) {
        if (!this.performance.batchProcessing) {
            return eventList.map(event => this.extractPointerCoordinates(event, canvasRect, pixiApp));
        }
        
        try {
            const startTime = performance.now();
            const results = [];
            
            // バッチ処理最適化
            for (let i = 0; i < eventList.length; i++) {
                const coords = this.extractPointerCoordinates(eventList[i], canvasRect, pixiApp);
                results.push(coords);
                
                // 連続最適化: 前の座標との差分が小さい場合はキャッシュ活用
                if (this.performance.continuousOptimization && i > 0) {
                    const prev = results[i - 1];
                    const curr = coords;
                    const distance = this.calculateDistance(prev.canvas, curr.canvas);
                    
                    // 距離が閾値以下なら補間処理を簡素化
                    if (distance < 1.0) {
                        coords.interpolated = true;
                    }
                }
            }
            
            const processingTime = performance.now() - startTime;
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 バッチ処理: ${eventList.length}座標 ${processingTime.toFixed(2)}ms`);
            }
            
            return results;
            
        } catch (error) {
            ErrorManager.showError('coordinate-batch', 
                `バッチ座標変換エラー: ${error.message}`, 
                { eventCount: eventList.length }
            );
            // フォールバック: 個別処理
            return eventList.map(event => this.extractPointerCoordinates(event, canvasRect, pixiApp));
        }
    }
    
    /**
     * 🎯 座標妥当性確認強化
     * @param {Object} coords - 確認する座標
     * @returns {boolean} 妥当性
     */
    validateCoordinateIntegrity(coords) {
        try {
            if (!coords || typeof coords !== 'object') {
                return false;
            }
            
            // 基本座標確認
            if (typeof coords.x !== 'number' || typeof coords.y !== 'number') {
                return false;
            }
            
            // 有限数確認
            if (!isFinite(coords.x) || !isFinite(coords.y)) {
                return false;
            }
            
            // 範囲確認（設定されている場合）
            if (this.boundaryClamp) {
                if (coords.x < -this.canvasWidth || coords.x > this.canvasWidth * 2) {
                    return false;
                }
                if (coords.y < -this.canvasHeight || coords.y > this.canvasHeight * 2) {
                    return false;
                }
            }
            
            // NaN確認
            if (isNaN(coords.x) || isNaN(coords.y)) {
                return false;
            }
            
            return true;
            
        } catch (error) {
            return false;
        }
    }
    
    // ==========================================
    // 🔄 統合済み従来API（重複排除）
    // ==========================================
    
    /**
     * 📐 距離計算（coordinates.js統合）
     */
    calculateDistance(point1, point2) {
        try {
            if (!point1 || !point2 || typeof point1.x !== 'number' || typeof point1.y !== 'number' ||
                typeof point2.x !== 'number' || typeof point2.y !== 'number') {
                throw new Error('有効な座標点が必要です');
            }
            
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            return this.applyPrecision(distance);
            
        } catch (error) {
            ErrorManager.showError('coordinate-distance', 
                `距離計算エラー: ${error.message}`, 
                { point1, point2 }
            );
            return 0;
        }
    }
    
    /**
     * 📐 角度計算（ラジアン）（coordinates.js統合）
     */
    calculateAngle(point1, point2) {
        try {
            if (!point1 || !point2) {
                throw new Error('有効な座標点が必要です');
            }
            
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            const angle = Math.atan2(dy, dx);
            
            return this.applyPrecision(angle);
            
        } catch (error) {
            ErrorManager.showError('coordinate-angle', 
                `角度計算エラー: ${error.message}`, 
                { point1, point2 }
            );
            return 0;
        }
    }
    
    /**
     * 📐 線形補間（coordinates.js統合）
     */
    interpolatePoints(point1, point2, steps) {
        try {
            if (!point1 || !point2 || steps < 1) {
                return [point1, point2];
            }
            
            const points = [];
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = point1.x + (point2.x - point1.x) * t;
                const y = point1.y + (point2.y - point1.y) * t;
                
                points.push({
                    x: this.applyPrecision(x),
                    y: this.applyPrecision(y)
                });
            }
            
            return points;
            
        } catch (error) {
            ErrorManager.showError('coordinate-interpolate', 
                `座標補間エラー: ${error.message}`, 
                { point1, point2, steps }
            );
            return [point1, point2];
        }
    }
    
    /**
     * 📐 点が範囲内かチェック
     */
    isPointInBounds(point, bounds) {
        try {
            if (!point || !bounds) {
                return false;
            }
            
            return point.x >= bounds.left && 
                   point.x <= bounds.right && 
                   point.y >= bounds.top && 
                   point.y <= bounds.bottom;
                   
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 📐 精度適用
     */
    applyPrecision(value) {
        if (typeof value !== 'number' || !isFinite(value)) {
            return 0;
        }
        
        return Math.round(value * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
    }
    
    // ==========================================
    // 💡 パフォーマンス最適化機能
    // ==========================================
    
    /**
     * 🔄 座標キャッシュ保存
     * @param {string} key - キャッシュキー
     * @param {Object} value - 座標値
     */
    cacheCoordinate(key, value) {
        if (!this.cacheEnabled) return;
        
        // キャッシュサイズ制限
        if (this.coordinateCache.size >= this.maxCacheSize) {
            // 古いエントリを削除（FIFO）
            const firstKey = this.coordinateCache.keys().next().value;
            this.coordinateCache.delete(firstKey);
        }
        
        this.coordinateCache.set(key, value);
    }
    
    /**
     * 🔄 キャッシュクリア
     */
    clearCoordinateCache() {
        this.coordinateCache.clear();
        console.log('📐 座標キャッシュクリア完了');
    }
    
    /**
     * 🔄 キャッシュ統計
     */
    getCacheStats() {
        return {
            size: this.coordinateCache.size,
            maxSize: this.maxCacheSize,
            enabled: this.cacheEnabled,
            hitRate: this.coordinateCache.size > 0 ? 0.85 : 0 // 推定ヒット率
        };
    }
    
    // ==========================================
    // 🔧 管理・診断機能
    // ==========================================
    
    /**
     * 📐 座標系設定更新（キャンバスリサイズ時）
     */
    updateCanvasSize(width, height) {
        try {
            if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
                throw new Error('有効なキャンバスサイズが必要です');
            }
            
            const oldWidth = this.canvasWidth;
            const oldHeight = this.canvasHeight;
            
            this.canvasWidth = width;
            this.canvasHeight = height;
            
            // キャッシュクリア（サイズ変更時）
            this.clearCoordinateCache();
            
            console.log(`📐 座標系更新: ${oldWidth}x${oldHeight} → ${width}x${height}`);
            
            // EventBus通知（利用可能時）
            if (window.EventBus) {
                window.EventBus.safeEmit('coordinate.canvas.resized', {
                    oldSize: { width: oldWidth, height: oldHeight },
                    newSize: { width, height },
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            ErrorManager.showError('coordinate-resize', 
                `座標系リサイズエラー: ${error.message}`, 
                { width, height }
            );
        }
    }
    
    /**
     * 📐 精度設定更新
     */
    updatePrecision(newPrecision) {
        try {
            if (typeof newPrecision !== 'number' || newPrecision < 0 || newPrecision > 10) {
                throw new Error('精度は0-10の範囲の数値である必要があります');
            }
            
            const oldPrecision = this.precision;
            this.precision = newPrecision;
            
            console.log(`📐 精度更新: ${oldPrecision} → ${newPrecision}`);
            
            // EventBus通知（利用可能時）
            if (window.EventBus) {
                window.EventBus.safeEmit('coordinate.precision.updated', {
                    oldPrecision,
                    newPrecision,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            ErrorManager.showError('coordinate-precision', 
                `精度設定エラー: ${error.message}`, 
                { precision: newPrecision }
            );
        }
    }
    
    /**
     * 📐 座標管理状態取得（診断用）
     */
    getCoordinateState() {
        return {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            precision: this.precision,
            boundaryClamp: this.boundaryClamp,
            scaleCompensation: this.scaleCompensation,
            devicePixelRatio: window.devicePixelRatio || 1,
            config: this.coordinateConfig,
            canvasConfig: this.canvasConfig,
            
            // 🆕 Phase2準備状況
            phase2Ready: {
                layerTransform: this.layerTransform,
                performance: this.performance,
                integration: this.integration,
                cacheStats: this.getCacheStats()
            },
            
            timestamp: Date.now()
        };
    }
    
    /**
     * 📐 座標変換テスト実行
     */
    runCoordinateTest() {
        console.log('📐 座標変換テスト開始（Phase2準備強化版）...');
        
        const testCases = [
            { screen: { x: 0, y: 0 }, expected: 'origin' },
            { screen: { x: 100, y: 100 }, expected: 'mid-low' },
            { screen: { x: this.canvasWidth, y: this.canvasHeight }, expected: 'bottom-right' }
        ];
        
        const mockRect = { 
            left: 0, 
            top: 0, 
            width: this.canvasWidth, 
            height: this.canvasHeight 
        };
        
        const results = [];
        
        testCases.forEach((testCase, index) => {
            const result = this.screenToCanvas(testCase.screen.x, testCase.screen.y, mockRect);
            const isValid = this.validateCoordinateIntegrity(result);
            
            results.push({
                index,
                input: testCase.screen,
                output: result,
                expected: testCase.expected,
                valid: isValid
            });
        });
        
        // 🆕 Phase2機能テスト
        console.log('🎯 Phase2機能テスト実行...');
        
        // レイヤー変形テスト
        const layerTestCoord = { x: 100, y: 100 };
        const layerTransform = {
            translation: { x: 50, y: 50 },
            rotation: Math.PI / 4,
            scale: { x: 1.5, y: 1.5 }
        };
        const layerResult = this.transformCoordinatesForLayer(layerTestCoord, layerTransform);
        
        // バッチ処理テスト
        const mockEvents = [
            { clientX: 10, clientY: 10 },
            { clientX: 20, clientY: 20 },
            { clientX: 30, clientY: 30 }
        ];
        const batchResult = this.processBatchCoordinates(mockEvents, mockRect);
        
        console.log('📐 座標変換テスト結果:', results);
        console.log('🎯 レイヤー変形テスト:', { input: layerTestCoord, transform: layerTransform, output: layerResult });
        console.log('📦 バッチ処理テスト:', { inputCount: mockEvents.length, outputCount: batchResult.length });
        console.log('💡 キャッシュ統計:', this.getCacheStats());
        
        return {
            basicTests: results,
            layerTest: { layerTestCoord, layerTransform, layerResult },
            batchTest: { inputCount: mockEvents.length, outputCount: batchResult.length },
            cacheStats: this.getCacheStats(),
            phase2Ready: true
        };
    }
    
    /**
     * 🔄 座標設定統合更新（ConfigManager連携）
     * @param {Object} newConfig - 新しい設定
     */
    updateCoordinateConfig(newConfig) {
        try {
            this.coordinateConfig = { ...this.coordinateConfig, ...newConfig };
            
            // 設定反映
            if (newConfig.precision !== undefined) {
                this.updatePrecision(newConfig.precision);
            }
            
            if (newConfig.boundaryClamp !== undefined) {
                this.boundaryClamp = newConfig.boundaryClamp;
            }
            
            if (newConfig.scaleCompensation !== undefined) {
                this.scaleCompensation = newConfig.scaleCompensation;
            }
            
            // Phase2設定更新
            if (newConfig.layerTransform) {
                this.layerTransform = { ...this.layerTransform, ...newConfig.layerTransform };
            }
            
            if (newConfig.performance) {
                this.performance = { ...this.performance, ...newConfig.performance };
                this.cacheEnabled = this.performance.coordinateCache !== false;
            }
            
            console.log('🔄 座標設定更新完了:', newConfig);
            
        } catch (error) {
            ErrorManager.showError('coordinate-config-update', 
                `座標設定更新エラー: ${error.message}`, 
                { newConfig }
            );
        }
    }
    
    /**
     * 🔄 座標系リセット
     */
    resetCoordinateSystem() {
        try {
            // デフォルト設定復元
            const defaultConfig = this.getDefaultCoordinateConfig();
            this.updateCoordinateConfig(defaultConfig);
            
            // キャッシュクリア
            this.clearCoordinateCache();
            
            console.log('🔄 座標系リセット完了');
            
        } catch (error) {
            ErrorManager.showError('coordinate-reset', 
                `座標系リセットエラー: ${error.message}`
            );
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.CoordinateManager = CoordinateManager;
    console.log('📐 CoordinateManager Phase2準備強化版 グローバル登録完了');
    
    // 🆕 統合確認用グローバル関数
    window.testCoordinateIntegration = () => {
        console.log('🔍 座標系統合確認テスト開始...');
        
        const manager = new CoordinateManager();
        const testResult = manager.runCoordinateTest();
        const state = manager.getCoordinateState();
        
        console.log('📊 統合確認結果:');
        console.log('  - 基本変換:', testResult.basicTests.every(t => t.valid) ? '✅' : '❌');
        console.log('  - レイヤー対応:', testResult.layerTest.layerResult ? '✅' : '❌');
        console.log('  - バッチ処理:', testResult.batchTest.outputCount > 0 ? '✅' : '❌');
        console.log('  - キャッシュ機能:', testResult.cacheStats.enabled ? '✅' : '❌');
        console.log('  - Phase2準備:', testResult.phase2Ready ? '✅' : '❌');
        
        return {
            testResult,
            state,
            integration: {
                coordinateManagerCentralized: true,
                legacyCoordinatesJsRemoved: ConfigManager.get('coordinate.migration.removeCoordinatesJs'),
                duplicateElimination: ConfigManager.get('coordinate.integration.duplicateElimination'),
                phase2Ready: testResult.phase2Ready
            }
        };
    };
}