/**
 * 📐 座標変換管理システム（座標ズレ修正版）
 * 🎯 AI_WORK_SCOPE: スクリーン座標・キャンバス座標・PixiJS座標変換
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager
 * 🎯 UNIFIED: ConfigManager(キャンバス設定), ErrorManager(座標エラー)
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能・数学的確定処理
 * 🔧 DRAWING_FIX: 高DPI補償調整・座標ズレ修正・境界越え対応
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
        
        // 🔧 高DPI制御フラグ（app-core.jsの高DPI無効化に連携）
        this.enableHighDPI = this.coordinateConfig.enableHighDPI !== false;
        
        console.log('📐 CoordinateManager 初期化完了（座標ズレ修正版・統一システム統合）');
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
            enableHighDPI: false  // 🔧 デフォルトで高DPI無効化（ふたば☆ちゃんねる投稿用）
        };
    }
    
    /**
     * 📐 スクリーン座標 → キャンバス座標変換（座標ズレ修正版）
     * 🔧 DRAWING_FIX: 高DPI補償を条件付きで無効化
     */
    screenToCanvas(screenX, screenY, canvasRect) {
        try {
            if (!canvasRect) {
                throw new Error('canvasRect が必要です');
            }
            
            if (typeof screenX !== 'number' || typeof screenY !== 'number') {
                throw new Error('screenX, screenY は数値である必要があります');
            }
            
            // スケール比率計算
            const scaleX = this.canvasWidth / canvasRect.width;
            const scaleY = this.canvasHeight / canvasRect.height;
            
            // 基本変換実行
            let canvasX = (screenX - canvasRect.left) * scaleX;
            let canvasY = (screenY - canvasRect.top) * scaleY;
            
            // 🔧 高DPI補償処理修正（座標ズレ修正）
            if (this.scaleCompensation) {
                const devicePixelRatio = window.devicePixelRatio || 1;
                
                // 高DPI有効化フラグがtrueかつdevicePixelRatio !== 1の場合のみ補償実行
                // app-core.jsでresolution=1固定のため、通常は補償をスキップ
                if (devicePixelRatio !== 1 && this.enableHighDPI) {
                    canvasX /= devicePixelRatio;
                    canvasY /= devicePixelRatio;
                    
                    if (this.coordinateConfig.debugging) {
                        console.log(`📐 高DPI補償実行: ratio=${devicePixelRatio}, 補償後座標(${canvasX}, ${canvasY})`);
                    }
                } else {
                    if (this.coordinateConfig.debugging) {
                        console.log(`📐 高DPI補償スキップ: ratio=${devicePixelRatio}, enableHighDPI=${this.enableHighDPI}`);
                    }
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
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 座標変換（修正版）: screen(${screenX}, ${screenY}) → canvas(${canvasX}, ${canvasY})`);
            }
            
            return { x: canvasX, y: canvasY };
            
        } catch (error) {
            ErrorManager.showError('coordinate-convert', 
                `座標変換エラー: ${error.message}`, 
                { screenX, screenY, canvasRect: canvasRect ? 'valid' : 'null' }
            );
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * 📐 キャンバス座標 → PixiJS座標変換（修正版）
     * 🔧 DRAWING_FIX: 高DPI無効化に対応したPixiJS座標変換
     */
    canvasToPixi(canvasX, canvasY, pixiApp) {
        try {
            if (!pixiApp?.stage) {
                throw new Error('有効なPixiJSアプリが必要です');
            }
            
            if (typeof canvasX !== 'number' || typeof canvasY !== 'number') {
                throw new Error('canvasX, canvasY は数値である必要があります');
            }
            
            // 🔧 高DPI無効化対応: resolution=1固定のため直接座標変換
            // PIXI.Point を使用してグローバル座標からローカル座標に変換
            const globalPoint = new PIXI.Point(canvasX, canvasY);
            const localPoint = pixiApp.stage.toLocal(globalPoint);
            
            const pixiX = this.applyPrecision(localPoint.x);
            const pixiY = this.applyPrecision(localPoint.y);
            
            if (this.coordinateConfig.debugging) {
                console.log(`📐 PixiJS座標変換（高DPI修正版）: canvas(${canvasX}, ${canvasY}) → pixi(${pixiX}, ${pixiY})`);
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
     * 📐 スクリーン座標 → PixiJS座標変換（直接変換・修正版）
     * 🔧 DRAWING_FIX: 高DPI修正対応の直接変換
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
     * 📐 PointerEvent → 座標情報抽出（統一処理・修正版）
     * 🔧 DRAWING_FIX: 境界越え描画対応・座標抽出強化
     */
    extractPointerCoordinates(event, canvasRect, pixiApp = null) {
        try {
            if (!event) {
                throw new Error('event が必要です');
            }
            
            // PointerEventからの座標取得（複数のケースに対応・強化版）
            const originalEvent = event.data?.originalEvent || event.originalEvent || event;
            
            let screenX, screenY;
            
            // 🔧 座標抽出を強化（境界越え描画対応）
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
            } else if (typeof event.x === 'number' && typeof event.y === 'number') {
                // イベント直接座標
                screenX = event.x;
                screenY = event.y;
            } else {
                throw new Error('有効な座標情報が見つかりません');
            }
            
            // 高DPI修正版座標変換実行
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
     * 📐 イベントから筆圧抽出（強化版）
     * 🔧 DRAWING_FIX: 筆圧抽出精度向上
     */
    extractPressure(event, originalEvent) {
        try {
            // 複数のソースから筆圧を取得（優先順位順）
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
            
            // PointerEventのforceプロパティ
            if (typeof originalEvent?.webkitForce === 'number') {
                return Math.min(1, Math.max(0, originalEvent.webkitForce));
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
     * 📐 レイヤー境界計算（Phase2準備）
     * 🆕 新規メソッド: レイヤーシステム対応
     */
    calculateLayerBounds(layerOptions = {}) {
        try {
            const { 
                x = 0, 
                y = 0, 
                width = this.canvasWidth, 
                height = this.canvasHeight,
                padding = 0 
            } = layerOptions;
            
            return {
                left: this.applyPrecision(x - padding),
                top: this.applyPrecision(y - padding),
                right: this.applyPrecision(x + width + padding),
                bottom: this.applyPrecision(y + height + padding),
                width: width + padding * 2,
                height: height + padding * 2
            };
            
        } catch (error) {
            ErrorManager.showError('coordinate-layer-bounds', 
                `レイヤー境界計算エラー: ${error.message}`, 
                { layerOptions }
            );
            return {
                left: 0, top: 0,
                right: this.canvasWidth, bottom: this.canvasHeight,
                width: this.canvasWidth, height: this.canvasHeight
            };
        }
    }
    
    /**
     * 📐 変形による境界計算（Phase2準備）
     * 🆕 新規メソッド: レイヤー変形対応
     */
    applyTransformToBounds(bounds, transform) {
        try {
            if (!bounds || !transform) {
                throw new Error('有効な境界と変形が必要です');
            }
            
            const { scale = 1, rotation = 0, translateX = 0, translateY = 0 } = transform;
            
            // 簡単な変形適用（Phase2で拡張予定）
            const centerX = (bounds.left + bounds.right) / 2;
            const centerY = (bounds.top + bounds.bottom) / 2;
            const halfWidth = (bounds.width * scale) / 2;
            const halfHeight = (bounds.height * scale) / 2;
            
            return {
                left: this.applyPrecision(centerX - halfWidth + translateX),
                top: this.applyPrecision(centerY - halfHeight + translateY),
                right: this.applyPrecision(centerX + halfWidth + translateX),
                bottom: this.applyPrecision(centerY + halfHeight + translateY),
                width: bounds.width * scale,
                height: bounds.height * scale
            };
            
        } catch (error) {
            ErrorManager.showError('coordinate-transform-bounds', 
                `変形境界計算エラー: ${error.message}`, 
                { bounds, transform }
            );
            return bounds; // フォールバック: 元の境界を返す
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
     * 📐 高DPI設定更新（修正版）
     * 🔧 DRAWING_FIX: 高DPI制御フラグ更新
     */
    updateHighDPIEnabled(enabled) {
        try {
            const oldValue = this.enableHighDPI;
            this.enableHighDPI = Boolean(enabled);
            
            console.log(`📐 高DPI設定更新: ${oldValue} → ${this.enableHighDPI}`);
            
            EventBus.safeEmit('coordinate.highdpi.updated', {
                oldValue,
                newValue: this.enableHighDPI,
                timestamp: Date.now()
            });
            
        } catch (error) {
            ErrorManager.showError('coordinate-highdpi', 
                `高DPI設定エラー: ${error.message}`, 
                { enabled }
            );
        }
    }
    
    /**
     * 📐 座標系設定更新（キャンバスリサイズ時・修正版）
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
            
            console.log(`📐 座標系更新（修正版）: ${oldWidth}x${oldHeight} → ${width}x${height}`);
            
            // EventBus通知
            EventBus.safeEmit('coordinate.canvas.resized', {
                oldSize: { width: oldWidth, height: oldHeight },
                newSize: { width, height },
                timestamp: Date.now()
            });
            
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
            
            EventBus.safeEmit('coordinate.precision.updated', {
                oldPrecision,
                newPrecision,
                timestamp: Date.now()
            });
            
        } catch (error) {
            ErrorManager.showError('coordinate-precision', 
                `精度設定エラー: ${error.message}`, 
                { precision: newPrecision }
            );
        }
    }
    
    /**
     * 📐 座標管理状態取得（診断用・修正版）
     */
    getCoordinateState() {
        return {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            precision: this.precision,
            boundaryClamp: this.boundaryClamp,
            scaleCompensation: this.scaleCompensation,
            enableHighDPI: this.enableHighDPI,  // 🔧 高DPI状態追加
            devicePixelRatio: window.devicePixelRatio || 1,
            config: this.coordinateConfig,
            canvasConfig: this.canvasConfig,
            timestamp: Date.now()
        };
    }
    
    /**
     * 📐 座標変換テスト実行（修正版）
     * 🔧 DRAWING_FIX: 高DPI修正対応テスト
     */
    runCoordinateTest() {
        console.log('📐 座標変換テスト開始（高DPI修正版）...');
        
        const testCases = [
            { screen: { x: 0, y: 0 }, expected: 'origin' },
            { screen: { x: 100, y: 100 }, expected: 'mid-low' },
            { screen: { x: this.canvasWidth/2, y: this.canvasHeight/2 }, expected: 'center' },
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
            results.push({
                index,
                input: testCase.screen,
                output: result,
                expected: testCase.expected,
                highDPI: this.enableHighDPI,
                devicePixelRatio: window.devicePixelRatio || 1
            });
        });
        
        console.log('📐 座標変換テスト結果（高DPI修正版）:', results);
        
        // 高DPI設定確認
        console.log(`📐 高DPI設定状況: enabled=${this.enableHighDPI}, devicePixelRatio=${window.devicePixelRatio || 1}`);
        
        return results;
    }
    
    /**
     * 📐 境界越えテスト（新規追加）
     * 🆕 DRAWING_FIX: 境界越え描画対応テスト
     */
    runBoundaryTest(boundaryMargin = 20) {
        console.log('📐 境界越えテスト開始...');
        
        const testCases = [
            // キャンバス外の座標
            { screen: { x: -10, y: 50 }, expected: '左境界越え' },
            { screen: { x: this.canvasWidth + 10, y: 50 }, expected: '右境界越え' },
            { screen: { x: 50, y: -10 }, expected: '上境界越え' },
            { screen: { x: 50, y: this.canvasHeight + 10 }, expected: '下境界越え' },
            // 境界マージン内
            { screen: { x: -5, y: -5 }, expected: '左上境界マージン内' },
            { screen: { x: this.canvasWidth + 5, y: this.canvasHeight + 5 }, expected: '右下境界マージン内' }
        ];
        
        const mockRect = { 
            left: -boundaryMargin, 
            top: -boundaryMargin, 
            width: this.canvasWidth + boundaryMargin * 2, 
            height: this.canvasHeight + boundaryMargin * 2 
        };
        
        const results = [];
        
        testCases.forEach((testCase, index) => {
            // 境界クランプを一時的に無効にしてテスト
            const originalClamp = this.boundaryClamp;
            this.boundaryClamp = false;
            
            const result = this.screenToCanvas(testCase.screen.x, testCase.screen.y, mockRect);
            
            this.boundaryClamp = originalClamp;
            
            results.push({
                index,
                input: testCase.screen,
                output: result,
                expected: testCase.expected,
                inBounds: this.isPointInBounds(result, {
                    left: 0, top: 0,
                    right: this.canvasWidth, bottom: this.canvasHeight
                })
            });
        });
        
        console.log('📐 境界越えテスト結果:', results);
        return results;
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.CoordinateManager = CoordinateManager;
    console.log('📐 CoordinateManager グローバル登録完了（座標ズレ修正版・高DPI対応）');
}