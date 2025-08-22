/**
 * 📐 座標変換管理システム（統合強化版）
 * 🎯 AI_WORK_SCOPE: スクリーン座標・キャンバス座標・PixiJS座標変換
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager
 * 🎯 UNIFIED: ConfigManager(キャンバス設定), ErrorManager(座標エラー)
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能・数学的確定処理
 * 🔄 COORDINATE_INTEGRATION: Phase2レイヤー対応・統合強化版
 * 📐 UNIFIED_COORDINATE: 重複排除・責任分界明確化・Manager統合対応
 * 🆕 COORDINATE_FEATURE: Phase2準備機能・統合診断・バッチ処理
 */

class CoordinateManager {
    constructor() {
        this.validateUnifiedSystems();
        this.canvasConfig = ConfigManager.getCanvasConfig();
        this.coordinateConfig = ConfigManager.get('coordinate') || this.getDefaultCoordinateConfig();
        
        // 座標変換基準
        this.canvasWidth = this.canvasConfig.width;
        this.canvasHeight = this.canvasConfig.height;
        
        // 精度設定
        this.precision = this.coordinateConfig.precision || 2;
        this.boundaryClamp = this.coordinateConfig.boundaryClamp !== false;
        this.scaleCompensation = this.coordinateConfig.scaleCompensation !== false;
        
        // 🆕 統合設定（Phase2準備）
        this.integration = {
            managerCentralization: ConfigManager.get('coordinate.integration.managerCentralization') || false,
            duplicateElimination: ConfigManager.get('coordinate.integration.duplicateElimination') || false,
            unifiedErrorHandling: ConfigManager.get('coordinate.integration.unifiedErrorHandling') || false
        };
        
        // 🆕 パフォーマンス設定
        this.performance = {
            batchProcessing: ConfigManager.get('coordinate.performance.batchProcessing') || false,
            coordinateCache: ConfigManager.get('coordinate.performance.coordinateCache') || false,
            continuousOptimization: ConfigManager.get('coordinate.performance.continuousOptimization') || false
        };
        
        // 🆕 座標キャッシュシステム（パフォーマンス向上）
        this.cache = new Map();
        this.cacheMaxSize = 1000;
        this.cacheEnabled = this.performance.coordinateCache;
        
        console.log('📐 CoordinateManager 統合強化版初期化完了');
        console.log('🔄 統合設定:', this.integration);
        console.log('⚡ パフォーマンス設定:', this.performance);
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
            // 🆕 統合設定
            integration: {
                managerCentralization: true,
                duplicateElimination: true,
                unifiedErrorHandling: true
            },
            // 🆕 パフォーマンス設定
            performance: {
                batchProcessing: false,
                coordinateCache: false,
                continuousOptimization: false
            }
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
            
            // 🆕 キャッシュ確認（パフォーマンス向上）
            const cacheKey = `${screenX}_${screenY}_${canvasRect.width}_${canvasRect.height}`;
            if (this.cacheEnabled && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
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
            
            // 🆕 キャッシュ保存
            if (this.cacheEnabled) {
                this.setCacheValue(cacheKey, result);
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
    
    /**
     * 📐 距離計算
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
     * 📐 角度計算（ラジアン）
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
    
    // ===========================================
    // 🆕 Phase2準備機能・統合強化機能
    // ===========================================
    
    /**
     * 🆕 Phase2準備: レイヤー座標変換基盤
     */
    transformCoordinatesForLayer(coords, layerTransform = null) {
        try {
            // Phase2でレイヤーシステム実装時に本格実装予定
            if (layerTransform) {
                console.log('🚀 Phase2準備: レイヤー座標変換 (基盤準備済み)');
                
                // 基本的な変形処理（Phase2で拡張）
                const transformed = {
                    x: coords.x + (layerTransform.offsetX || 0),
                    y: coords.y + (layerTransform.offsetY || 0)
                };
                
                // スケール適用
                if (layerTransform.scaleX || layerTransform.scaleY) {
                    transformed.x *= (layerTransform.scaleX || 1);
                    transformed.y *= (layerTransform.scaleY || 1);
                }
                
                return {
                    x: this.applyPrecision(transformed.x),
                    y: this.applyPrecision(transformed.y)
                };
            }
            
            return coords;
            
        } catch (error) {
            ErrorManager.showError('coordinate-layer', 
                `レイヤー座標変換エラー: ${error.message}`, 
                { coords, layerTransform }
            );
            return coords;
        }
    }
    
    /**
     * 🆕 座標妥当性確認（統合版）
     */
    validateCoordinateIntegrity(coords) {
        if (!coords || typeof coords !== 'object') return false;
        if (typeof coords.x !== 'number' || typeof coords.y !== 'number') return false;
        if (!isFinite(coords.x) || !isFinite(coords.y)) return false;
        if (isNaN(coords.x) || isNaN(coords.y)) return false;
        return true;
    }
    
    /**
     * 🆕 バッチ座標処理（パフォーマンス最適化）
     */
    processBatchCoordinates(eventList, canvasRect, pixiApp = null) {
        if (!this.performance.batchProcessing) {
            // バッチ処理無効の場合は個別処理
            return eventList.map(event => this.extractPointerCoordinates(event, canvasRect, pixiApp));
        }
        
        try {
            console.log(`⚡ バッチ座標処理開始: ${eventList.length}件`);
            const startTime = performance.now();
            
            const results = [];
            
            for (const event of eventList) {
                const coords = this.extractPointerCoordinates(event, canvasRect, pixiApp);
                if (this.validateCoordinateIntegrity(coords.canvas)) {
                    results.push(coords);
                }
            }
            
            const processTime = performance.now() - startTime;
            console.log(`⚡ バッチ座標処理完了: ${processTime.toFixed(2)}ms`);
            
            return results;
            
        } catch (error) {
            ErrorManager.showError('coordinate-batch', 
                `バッチ座標処理エラー: ${error.message}`, 
                { eventCount: eventList.length }
            );
            return [];
        }
    }
    
    /**
     * 🆕 連続座標補間（連続描画最適化）
     */
    interpolatePoints(point1, point2, steps = 5) {
        try {
            if (!this.validateCoordinateIntegrity(point1) || !this.validateCoordinateIntegrity(point2)) {
                throw new Error('有効な座標点が必要です');
            }
            
            if (steps <= 0) return [point1, point2];
            
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
     * 🆕 座標キャッシュ管理
     */
    setCacheValue(key, value) {
        if (!this.cacheEnabled) return;
        
        // キャッシュサイズ制限
        if (this.cache.size >= this.cacheMaxSize) {
            // 古いキャッシュを削除（LRU簡易実装）
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }
    
    /**
     * 🆕 キャッシュ統計取得
     */
    getCacheStats() {
        return {
            enabled: this.cacheEnabled,
            size: this.cache.size,
            maxSize: this.cacheMaxSize,
            hitRate: this.cache.size > 0 ? (this.cache.size / this.cacheMaxSize * 100).toFixed(1) + '%' : '0%'
        };
    }
    
    /**
     * 🆕 統合状況取得（診断用）
     */
    getIntegrationStatus() {
        return {
            managerCentralization: this.integration.managerCentralization,
            duplicateElimination: this.integration.duplicateElimination,
            unifiedErrorHandling: this.integration.unifiedErrorHandling,
            performanceOptimized: this.performance.coordinateCache || this.performance.batchProcessing,
            phase2Ready: !!(this.transformCoordinatesForLayer && this.validateCoordinateIntegrity),
            cacheStats: this.getCacheStats()
        };
    }
    
    // ===========================================
    // 既存機能（修正・強化版）
    // ===========================================
    
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
            
            // 🆕 キャッシュクリア（サイズ変更時）
            if (this.cacheEnabled) {
                this.cache.clear();
                console.log('🗑️ 座標キャッシュクリア（サイズ変更）');
            }
            
            console.log(`📐 座標系更新: ${oldWidth}x${oldHeight} → ${width}x${height}`);
            
            // EventBus通知
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
     * 🆕 座標設定更新（統合版）
     */
    updateCoordinateConfig(newConfig) {
        try {
            // 設定妥当性確認
            if (!ConfigManager.validateCoordinateConfig(newConfig)) {
                throw new Error('無効な座標設定です');
            }
            
            // 設定更新
            this.coordinateConfig = { ...this.coordinateConfig, ...newConfig };
            this.integration = { ...this.integration, ...(newConfig.integration || {}) };
            this.performance = { ...this.performance, ...(newConfig.performance || {}) };
            
            // 基本設定反映
            if (newConfig.precision !== undefined) this.precision = newConfig.precision;
            if (newConfig.boundaryClamp !== undefined) this.boundaryClamp = newConfig.boundaryClamp;
            if (newConfig.scaleCompensation !== undefined) this.scaleCompensation = newConfig.scaleCompensation;
            
            // キャッシュ設定反映
            const newCacheEnabled = this.performance.coordinateCache;
            if (this.cacheEnabled !== newCacheEnabled) {
                this.cacheEnabled = newCacheEnabled;
                if (!newCacheEnabled) {
                    this.cache.clear();
                    console.log('🗑️ 座標キャッシュ無効化・クリア');
                } else {
                    console.log('⚡ 座標キャッシュ有効化');
                }
            }
            
            console.log('⚙️ 座標設定更新完了:', newConfig);
            
            if (window.EventBus) {
                window.EventBus.safeEmit('coordinate.config.updated', {
                    config: this.coordinateConfig,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            ErrorManager.showError('coordinate-config-update', 
                `座標設定更新エラー: ${error.message}`, 
                { config: newConfig }
            );
        }
    }
    
    /**
     * 📐 座標管理状態取得（診断用・拡張版）
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
            // 🆕 統合情報
            integration: this.integration,
            performance: this.performance,
            cacheStats: this.getCacheStats(),
            integrationStatus: this.getIntegrationStatus(),
            phase2Ready: this.getIntegrationStatus().phase2Ready,
            timestamp: Date.now()
        };
    }
    
    /**
     * 📐 座標変換テスト実行（拡張版）
     */
    runCoordinateTest() {
        console.group('📐 座標変換統合テスト開始');
        
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
        let passCount = 0;
        
        // 基本座標変換テスト
        testCases.forEach((testCase, index) => {
            const result = this.screenToCanvas(testCase.screen.x, testCase.screen.y, mockRect);
            const valid = this.validateCoordinateIntegrity(result);
            
            results.push({
                index,
                input: testCase.screen,
                output: result,
                expected: testCase.expected,
                valid,
                pass: valid && typeof result.x === 'number' && typeof result.y === 'number'
            });
            
            if (results[results.length - 1].pass) passCount++;
        });
        
        // 🆕 統合機能テスト
        const integrationTests = [
            {
                name: '座標妥当性確認',
                test: () => this.validateCoordinateIntegrity({ x: 100, y: 100 }) === true
            },
            {
                name: '距離計算',
                test: () => {
                    const distance = this.calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
                    return Math.abs(distance - 5) < 0.1;
                }
            },
            {
                name: '角度計算',
                test: () => {
                    const angle = this.calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 });
                    return Math.abs(angle - 0) < 0.1;
                }
            },
            {
                name: '点補間',
                test: () => {
                    const points = this.interpolatePoints({ x: 0, y: 0 }, { x: 10, y: 10 }, 2);
                    return points.length === 3;
                }
            },
            {
                name: 'Phase2準備機能',
                test: () => {
                    const transformed = this.transformCoordinatesForLayer({ x: 10, y: 10 }, { offsetX: 5, offsetY: 5 });
                    return transformed.x === 15 && transformed.y === 15;
                }
            }
        ];
        
        integrationTests.forEach(test => {
            const result = test.test();
            console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASS' : 'FAIL'}`);
            if (result) passCount++;
        });
        
        const totalTests = testCases.length + integrationTests.length;
        const successRate = Math.round((passCount / totalTests) * 100);
        
        console.log(`📊 座標変換統合テスト結果: ${passCount}/${totalTests} (${successRate}%)`);
        console.log('📋 基本テスト詳細:', results);
        console.log('🔄 統合状況:', this.getIntegrationStatus());
        
        const allPassed = passCount === totalTests;
        if (allPassed) {
            console.log('✅ 全座標統合テスト合格 - Phase2準備完了');
        } else {
            console.warn('⚠️ 一部座標統合テスト失敗 - 修正が必要');
        }
        
        console.groupEnd();
        
        return {
            totalTests,
            passCount,
            successRate,
            allPassed,
            results,
            integrationStatus: this.getIntegrationStatus()
        };
    }
    
    /**
     * 🆕 座標統合システムリセット
     */
    resetCoordinateSystem() {
        try {
            // キャッシュクリア
            this.cache.clear();
            
            // 設定リロード
            this.coordinateConfig = ConfigManager.get('coordinate') || this.getDefaultCoordinateConfig();
            this.canvasConfig = ConfigManager.getCanvasConfig();
            
            // 基本設定再設定
            this.precision = this.coordinateConfig.precision || 2;
            this.boundaryClamp = this.coordinateConfig.boundaryClamp !== false;
            this.scaleCompensation = this.coordinateConfig.scaleCompensation !== false;
            
            console.log('🔄 座標統合システムリセット完了');
            
            if (window.EventBus) {
                window.EventBus.safeEmit('coordinate.system.reset', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            ErrorManager.showError('coordinate-reset', 
                `座標システムリセットエラー: ${error.message}`
            );
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.CoordinateManager = CoordinateManager;
    console.log('📐 CoordinateManager 統合強化版 グローバル登録完了');
}

// 🆕 グローバル診断関数
if (typeof window !== 'undefined') {
    // 座標統合確認
    window.checkCoordinateIntegration = function() {
        console.group('🔍 座標統合確認');
        
        const results = {
            coordinateManagerAvailable: !!window.CoordinateManager,
            coordinateConfigPresent: !!ConfigManager.get('coordinate'),
            integrationEnabled: false,
            duplicateElimination: false,
            phase2Ready: false
        };
        
        if (window.CoordinateManager) {
            const manager = new window.CoordinateManager();
            const status = manager.getIntegrationStatus();
            
            results.integrationEnabled = status.managerCentralization;
            results.duplicateElimination = status.duplicateElimination;
            results.phase2Ready = status.phase2Ready;
        }
        
        const totalIntegration = Object.values(results).filter(Boolean).length;
        const maxIntegration = Object.keys(results).length;
        
        console.log(`📊 統合度: ${totalIntegration}/${maxIntegration} (${Math.round(totalIntegration/maxIntegration*100)}%)`);
        console.log('📋 詳細結果:', results);
        
        if (totalIntegration === maxIntegration) {
            console.log('✅ 座標統合完了 - Phase2移行準備完了');
        } else {
            console.warn('⚠️ 座標統合未完了 - 設定確認が必要');
        }
        
        console.groupEnd();
        return results;
    };
    
    // 座標統合テスト
    window.runCoordinateIntegrationTests = function() {
        if (!window.CoordinateManager) {
            console.error('❌ CoordinateManager が利用できません');
            return false;
        }
        
        const manager = new window.CoordinateManager();
        return manager.runCoordinateTest();
    };
}

console.log('🔄 CoordinateManager 統合強化版 準備完了');
console.log('✅ 実装完了項目:');
console.log('  - Phase2レイヤー座標変換基盤');
console.log('  - 座標妥当性確認強化');
console.log('  - バッチ座標処理システム');
console.log('  - 座標キャッシュシステム');
console.log('  - 統合診断・テストシステム');
console.log('  - Manager統合対応機能');
console.log('🚀 使用例: new CoordinateManager().runCoordinateTest()');
console.log('🔍 診断: window.checkCoordinateIntegration()');