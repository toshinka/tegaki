/**
 * 📐 座標変換管理システム（高DPI修正版）
 * 🎯 AI_WORK_SCOPE: スクリーン座標・キャンバス座標・PixiJS座標変換
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager
 * 🎯 UNIFIED: ConfigManager(キャンバス設定), ErrorManager(座標エラー)
 * 🔧 HIGHDPI_FIX: devicePixelRatio補正無効化・座標変換単純化
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
        
        // 🔧 高DPI修正: scaleCompensation を無効化
        this.scaleCompensation = false; // devicePixelRatio補正を無効化
        
        // 🔧 高DPI設定
        this.highDPIMode = this.coordinateConfig.highDPIMode !== false;
        this.forceSimpleCoordinates = this.coordinateConfig.forceSimpleCoordinates || false;
        
        console.log('📐 CoordinateManager 初期化完了（高DPI修正版）');
        console.log(`🔧 scaleCompensation: ${this.scaleCompensation} (高DPI修正により無効化)`);
        console.log(`📊 devicePixelRatio: ${window.devicePixelRatio || 1}`);
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
     * デフォルト座標設定取得（高DPI対応）
     */
    getDefaultCoordinateConfig() {
        return {
            precision: 2,
            boundaryClamp: true,
            scaleCompensation: false,     // 🔧 高DPI修正でデフォルト無効
            highDPIMode: true,            // 🔧 高DPI対応モード
            forceSimpleCoordinates: false,
            touchScaling: 1.0,
            debugging: false
        };
    }
    
    /**
     * 📐 スクリーン座標 → キャンバス座標変換（高DPI修正版）
     */
    screenToCanvas(screenX, screenY, canvasRect) {
        try {
            if (!canvasRect) {
                throw new Error('canvasRect が必要です');
            }
            
            if (typeof screenX !== 'number' || typeof screenY !== 'number') {
                throw new Error('screenX, screenY は数値である必要があります');
            }
            
            // 🔧 高DPI修正: シンプルな座標変換
            if (this.forceSimpleCoordinates) {
                const canvasX = this.applyPrecision(screenX - canvasRect.left);
                const canvasY = this.applyPrecision(screenY - canvasRect.top);
                return this.clampCoordinates(canvasX, canvasY);
            }
            
            // スケール比率計算
            const scaleX = this.canvasWidth / canvasRect.width;
            const scaleY = this.canvasHeight / canvasRect.height;
            
            // 基本変換実行
            let canvasX = (screenX - canvasRect.left) * scaleX;
            let canvasY = (screenY - canvasRect.top) * scaleY;
            
            // 🔧 高DPI修正: devicePixelRatio補正を削除
            // 従来のコード（削除）:
            // if (this.scaleCompensation) {
            //     const devicePixelRatio = window.devicePixelRatio || 1;
            //     if (devicePixelRatio !== 1) {
            //         canvasX /= devicePixelRatio;
            //         canvasY /= devicePixelRatio;
            //     }
            // }
            
            // 精度適用
            canvasX = this.applyPrecision(canvasX);
            canvasY = this.applyPrecision(canvasY);
            
            // 境界クランプ
            const result = this.clampCoordinates(canvasX, canvasY);
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 座標変換（高DPI修正版）: screen(${screenX}, ${screenY}) → canvas(${result.x}, ${result.y})`);
                console.log(`📊 スケール: ${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}`);
                console.log(`📊 Rect: ${canvasRect.left}, ${canvasRect.top}, ${canvasRect.width}x${canvasRect.height}`);
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
    
    /**
     * 📐 座標系設定更新（キャンバスリサイズ時・高DPI対応）
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
            
            console.log(`📐 座標系更新（高DPI修正版）: ${oldWidth}x${oldHeight} → ${width}x${height}`);
            console.log(`🔧 scaleCompensation: ${this.scaleCompensation} (無効化済み)`);
            
            // EventBus通知
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit('coordinate.canvas.resized', {
                    oldSize: { width: oldWidth, height: oldHeight },
                    newSize: { width, height },
                    highDPIMode: this.highDPIMode,
                    scaleCompensation: this.scaleCompensation,
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
            
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
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
     * 🔧 高DPI設定更新
     */
    updateHighDPISettings(settings) {
        try {
            if (typeof settings !== 'object' || !settings) {
                throw new Error('有効な設定オブジェクトが必要です');
            }
            
            const oldSettings = {
                scaleCompensation: this.scaleCompensation,
                highDPIMode: this.highDPIMode,
                forceSimpleCoordinates: this.forceSimpleCoordinates
            };
            
            // 設定更新
            if ('scaleCompensation' in settings) {
                this.scaleCompensation = !!settings.scaleCompensation;
            }
            if ('highDPIMode' in settings) {
                this.highDPIMode = !!settings.highDPIMode;
            }
            if ('forceSimpleCoordinates' in settings) {
                this.forceSimpleCoordinates = !!settings.forceSimpleCoordinates;
            }
            
            console.log('🔧 高DPI設定更新:', {
                old: oldSettings,
                new: {
                    scaleCompensation: this.scaleCompensation,
                    highDPIMode: this.highDPIMode,
                    forceSimpleCoordinates: this.forceSimpleCoordinates
                }
            });
            
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit('coordinate.highdpi.updated', {
                    oldSettings,
                    newSettings: settings,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            ErrorManager.showError('coordinate-highdpi', 
                `高DPI設定エラー: ${error.message}`, 
                { settings }
            );
        }
    }
    
    /**
     * 📐 座標管理状態取得（高DPI診断情報含む）
     */
    getCoordinateState() {
        return {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            precision: this.precision,
            boundaryClamp: this.boundaryClamp,
            scaleCompensation: this.scaleCompensation,
            highDPIMode: this.highDPIMode,
            forceSimpleCoordinates: this.forceSimpleCoordinates,
            devicePixelRatio: window.devicePixelRatio || 1,
            config: this.coordinateConfig,
            canvasConfig: this.canvasConfig,
            timestamp: Date.now()
        };
    }
    
    /**
     * 📐 座標変換テスト実行（高DPI対応版）
     */
    runCoordinateTest() {
        console.log('📐 座標変換テスト開始（高DPI修正版）...');
        
        const testCases = [
            { screen: { x: 0, y: 0 }, expected: 'origin' },
            { screen: { x: 100, y: 100 }, expected: 'mid-low' },
            { screen: { x: 200, y: 200 }, expected: 'center' },
            { screen: { x: 400, y: 400 }, expected: 'bottom-right' }
        ];
        
        // 🔧 高DPI環境での複数テストケース
        const devicePixelRatio = window.devicePixelRatio || 1;
        const mockRects = [
            { 
                name: '標準Rect',
                rect: { left: 0, top: 0, width: this.canvasWidth, height: this.canvasHeight }
            },
            {
                name: `高DPI Rect (DPR: ${devicePixelRatio})`,
                rect: { 
                    left: 0, 
                    top: 0, 
                    width: this.canvasWidth * devicePixelRatio, 
                    height: this.canvasHeight * devicePixelRatio 
                }
            }
        ];
        
        const results = [];
        
        mockRects.forEach(rectCase => {
            console.log(`🧪 テスト実行: ${rectCase.name}`);
            
            testCases.forEach((testCase, index) => {
                const result = this.screenToCanvas(testCase.screen.x, testCase.screen.y, rectCase.rect);
                results.push({
                    rectType: rectCase.name,
                    testIndex: index,
                    input: testCase.screen,
                    output: result,
                    expected: testCase.expected,
                    isValid: result.x >= 0 && result.x <= this.canvasWidth && 
                            result.y >= 0 && result.y <= this.canvasHeight
                });
            });
        });
        
        // 結果サマリー
        const validResults = results.filter(r => r.isValid);
        console.log(`📊 テスト結果: ${validResults.length}/${results.length} 成功 (${(validResults.length/results.length*100).toFixed(1)}%)`);
        console.log('📐 座標変換テスト結果:', results);
        
        return {
            results,
            summary: {
                total: results.length,
                valid: validResults.length,
                successRate: (validResults.length/results.length*100).toFixed(1) + '%',
                devicePixelRatio,
                scaleCompensation: this.scaleCompensation,
                highDPIMode: this.highDPIMode
            }
        };
    }
    
    /**
     * 🔧 高DPI診断実行
     */
    runHighDPIDiagnostics() {
        console.log('🔧 高DPI診断開始...');
        
        const diagnostics = {
            environment: {
                devicePixelRatio: window.devicePixelRatio || 1,
                userAgent: navigator.userAgent,
                platform: navigator.platform
            },
            coordinateManager: {
                scaleCompensation: this.scaleCompensation,
                highDPIMode: this.highDPIMode,
                forceSimpleCoordinates: this.forceSimpleCoordinates,
                canvasSize: { width: this.canvasWidth, height: this.canvasHeight }
            },
            testResults: this.runCoordinateTest()
        };
        
        // Canvas要素の情報取得
        const canvasElement = document.querySelector('#drawing-canvas canvas');
        if (canvasElement) {
            const computedStyle = getComputedStyle(canvasElement);
            diagnostics.canvasElement = {
                internalSize: { width: canvasElement.width, height: canvasElement.height },
                displaySize: { width: computedStyle.width, height: computedStyle.height },
                resolution: canvasElement.width / parseInt(computedStyle.width, 10)
            };
        }
        
        console.log('🔧 高DPI診断結果:', diagnostics);
        return diagnostics;
    }
    
    /**
     * 🔧 緊急座標リセット（問題発生時用）
     */
    emergencyCoordinateReset() {
        try {
            console.log('🚨 緊急座標リセット実行...');
            
            // 設定を最も安全な状態にリセット
            this.scaleCompensation = false;
            this.highDPIMode = true;
            this.forceSimpleCoordinates = true;
            this.precision = 2;
            this.boundaryClamp = true;
            
            console.log('✅ 緊急座標リセット完了');
            
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit('coordinate.emergency.reset', {
                    timestamp: Date.now(),
                    newState: this.getCoordinateState()
                });
            }
            
        } catch (error) {
            console.error('❌ 緊急座標リセット失敗:', error);
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.CoordinateManager = CoordinateManager;
    console.log('📐 CoordinateManager グローバル登録完了（高DPI修正版）');
} catch (error) {
            ErrorManager.showError('coordinate-convert', 
                `座標変換エラー: ${error.message}`, 
                { screenX, screenY, canvasRect: canvasRect ? 'valid' : 'null' }
            );
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * 🔧 座標境界クランプ処理
     */
    clampCoordinates(canvasX, canvasY) {
        if (this.boundaryClamp) {
            canvasX = Math.max(0, Math.min(this.canvasWidth, canvasX));
            canvasY = Math.max(0, Math.min(this.canvasHeight, canvasY));
        }
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * 📐 キャンバス座標 → PixiJS座標変換（高DPI対応）
     */
    canvasToPixi(canvasX, canvasY, pixiApp) {
        try {
            if (!pixiApp?.stage) {
                throw new Error('有効なPixiJSアプリが必要です');
            }
            
            if (typeof canvasX !== 'number' || typeof canvasY !== 'number') {
                throw new Error('canvasX, canvasY は数値である必要があります');
            }
            
            // 🔧 高DPI修正: resolution=1 前提での単純変換
            if (this.highDPIMode && pixiApp.renderer.resolution === 1) {
                // resolution=1の場合、キャンバス座標とPixiJS座標は1:1
                const pixiX = this.applyPrecision(canvasX);
                const pixiY = this.applyPrecision(canvasY);
                
                if (this.coordinateConfig.debugging) {
                    console.log(`📐 PixiJS座標変換（高DPI・単純）: canvas(${canvasX}, ${canvasY}) → pixi(${pixiX}, ${pixiY})`);
                }
                
                return { x: pixiX, y: pixiY };
            }
            
            // 従来のtoLocal変換（resolution≠1の場合のフォールバック）
            const globalPoint = new PIXI.Point(canvasX, canvasY);
            const localPoint = pixiApp.stage.toLocal(globalPoint);
            
            const pixiX = this.applyPrecision(localPoint.x);
            const pixiY = this.applyPrecision(localPoint.y);
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 PixiJS座標変換（toLocal）: canvas(${canvasX}, ${canvasY}) → pixi(${pixiX}, ${pixiY})`);
                console.log(`📊 PixiJS Resolution: ${pixiApp.renderer.resolution}`);
            }
            
            return { x: pixiX, y: pixiY };
            
        } catch (error) {
            ErrorManager.showError('coordinate-pixi', 
                `PixiJS座標変換エラー: ${error.message}`, 
                { canvasX, canvasY, hasPixiApp: !!pixiApp, resolution: pixiApp?.renderer?.resolution }
            );
            // フォールバック: キャンバス座標をそのまま返す
            return { x: canvasX, y: canvasY };
        }
    }
    
    /**
     * 📐 スクリーン座標 → PixiJS座標変換（高DPI対応直接変換）
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
     * 📐 PointerEvent → 座標情報抽出（高DPI対応統一処理）
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
            
            // 🔧 高DPI修正版の座標変換を使用
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
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 座標抽出（高DPI修正版）:`, result);
            }
            
            return result;
            
        }