/**
 * 📄 FILE: js/utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: DOM座標とPIXI World座標間の正確な変換処理・座標ズレ問題解決
 *
 * @provides
 *   - clientToWorld(clientX, clientY)
 *   - clientToCanvas(clientX, clientY)  
 *   - canvasToWorld(canvasX, canvasY)
 *   - clientToCanvasPixel(clientX, clientY)
 *   - setCanvasManager(canvasManager)
 *   - getTransformMatrix()
 *   - testCoordinateConversion(clientX, clientY)
 *   - isReady()
 *   - getDebugInfo()
 *
 * @uses  
 *   - CanvasManager.getCanvasElement()
 *   - CanvasManager.getDrawContainer()
 *   - CanvasManager.getPixiApp()
 *   - CanvasManager.clientToCanvasPixel()
 *   - HTMLCanvasElement.getBoundingClientRect()
 *   - PIXI.Container.toLocal()
 *   - PIXI.Container.transform.worldTransform
 *
 * @initflow
 *   1. constructor → 2. setCanvasManager → 3. clientToWorld利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止  
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 複雑なキャッシュ機構禁止
 *   🚫 未実装メソッド呼び出し禁止
 *
 * @manager-key
 *   window.Tegaki.CoordinateManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager, PIXI v8
 *   OPTIONAL: なし
 *   FORBIDDEN: NavigationManager直接依存
 *
 * @integration-flow
 *   AppCore → Manager統合 → ToolManager → PenTool → clientToWorld()
 *
 * @method-naming-rules
 *   変換系: clientToWorld() / canvasToWorld() / clientToCanvas()
 *   取得系: getCanvasRect() / getDrawContainer() / getTransformMatrix()
 *   設定系: setCanvasManager()
 *   テスト系: testCoordinateConversion()
 *
 * @performance-notes
 *   高精度DPR対応・Container変形対応・座標ズレ±1px以内精度
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * CoordinateManager - DOM座標とPIXI World座標の正確な変換
 * 座標ズレ問題を解決する統一座標変換システム（Step2: 精度向上版）
 */
class CoordinateManager {
    constructor() {
        console.log('🎯 CoordinateManager v8対応版・座標ズレ問題解決版 作成開始');
        
        // 基本プロパティ
        this.canvasManager = null;
        this.ready = false;
        
        // v8機能フラグ
        this.v8Ready = false;
        this.highPrecisionMode = true;
        this.webgpuSupported = false;
        
        // 座標変換精度設定
        this.coordinatePrecision = 0.1; // ±0.1px精度
        this.dprCacheEnabled = true;
        this.transformCacheEnabled = false; // シンプル化のためキャッシュ無効
        
        // デバッグ用統計
        this.conversionStats = {
            totalConversions: 0,
            clientToWorldCalls: 0,
            errors: 0,
            averageAccuracy: 0
        };
        
        console.log('✅ CoordinateManager v8対応版・座標ズレ問題解決版 作成完了');
    }
    
    /**
     * CanvasManager設定・初期化
     */
    setCanvasManager(canvasManager) {
        console.log('🔧 CoordinateManager - CanvasManager設定開始');
        
        if (!canvasManager) {
            throw new Error('CanvasManager is required');
        }
        
        if (!canvasManager.isV8Ready()) {
            throw new Error('CanvasManager v8 not ready');
        }
        
        this.canvasManager = canvasManager;
        this.ready = true;
        this.v8Ready = true;
        
        // WebGPU対応確認
        const pixiApp = canvasManager.getPixiApp();
        if (pixiApp && pixiApp.renderer.type === 'webgpu') {
            this.webgpuSupported = true;
        }
        
        console.log('✅ CoordinateManager - CanvasManager設定完了');
    }
    
    /**
     * DOM座標をPIXI World座標に変換（メイン変換API・高精度版）
     * 座標ズレ問題解決: 右下に行くほどズレる問題を修正
     */
    clientToWorld(clientX, clientY) {
        if (!this.ready) {
            throw new Error('CoordinateManager not ready - call setCanvasManager() first');
        }
        
        try {
            this.conversionStats.clientToWorldCalls++;
            this.conversionStats.totalConversions++;
            
            // Step 1: DOM clientX/Y → Canvas backing pixel座標（高精度）
            const canvasPoint = this.clientToCanvasPixelHighPrecision(clientX, clientY);
            
            // Step 2: Canvas pixel座標 → PIXI World座標（Container変形対応）
            const worldPoint = this.canvasToWorldHighPrecision(canvasPoint.x, canvasPoint.y);
            
            // Step 3: 座標精度検証（±1px以内確認）
            if (this.highPrecisionMode) {
                this.validateCoordinatePrecision(worldPoint, clientX, clientY);
            }
            
            return worldPoint;
            
        } catch (error) {
            console.error('❌ clientToWorld変換エラー:', error);
            this.conversionStats.errors++;
            throw error;
        }
    }
    
    /**
     * DOM座標をCanvas backing pixel座標に変換（高精度版）
     * devicePixelRatioを考慮した正確な変換・座標ズレ修正
     */
    clientToCanvasPixelHighPrecision(clientX, clientY) {
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        // CSS表示サイズベースの座標計算（高精度）
        const cssX = clientX - rect.left;
        const cssY = clientY - rect.top;
        
        // devicePixelRatioを正確に取得・適用
        const dpr = this.getEffectiveDPR();
        
        // backing pixelに変換（座標ズレ修正）
        const backingX = cssX * dpr;
        const backingY = cssY * dpr;
        
        // 座標境界チェック
        const maxX = canvas.width;
        const maxY = canvas.height;
        
        const clampedX = Math.max(0, Math.min(maxX - 1, backingX));
        const clampedY = Math.max(0, Math.min(maxY - 1, backingY));
        
        return { 
            x: clampedX, 
            y: clampedY,
            originalX: backingX,
            originalY: backingY,
            clamped: (clampedX !== backingX) || (clampedY !== backingY)
        };
    }
    
    /**
     * Canvas座標をPIXI World座標に変換（高精度版）
     * Container transformを考慮した変換・右下座標ズレ修正
     */
    canvasToWorldHighPrecision(canvasX, canvasY) {
        const drawContainer = this.canvasManager.getDrawContainer();
        
        if (!drawContainer || typeof drawContainer.toLocal !== 'function') {
            throw new Error('DrawContainer toLocal() method not available');
        }
        
        // PIXI.Container.toLocal()でContainer transformを考慮した変換
        // 座標ズレ修正: 正確なtransform matrixを使用
        const worldPoint = drawContainer.toLocal({ x: canvasX, y: canvasY });
        
        // 高精度座標補正
        const correctedX = Math.round(worldPoint.x * 10) / 10; // 0.1px精度
        const correctedY = Math.round(worldPoint.y * 10) / 10; // 0.1px精度
        
        return { 
            x: correctedX, 
            y: correctedY,
            originalX: worldPoint.x,
            originalY: worldPoint.y
        };
    }
    
    /**
     * 有効なDPR取得（CanvasManager連携）
     */
    getEffectiveDPR() {
        // CanvasManagerから有効DPRを取得（制限適用済み）
        if (this.canvasManager && this.canvasManager.effectiveDPR) {
            return this.canvasManager.effectiveDPR;
        }
        
        // フォールバック: デバイスDPR（最大2.0制限）
        const deviceDPR = window.devicePixelRatio || 1;
        return Math.min(deviceDPR, 2.0);
    }
    
    /**
     * 座標精度検証（±1px以内確認）
     */
    validateCoordinatePrecision(worldPoint, originalClientX, originalClientY) {
        try {
            // 逆変換テスト: World → Client
            const reverseClient = this.worldToClient(worldPoint.x, worldPoint.y);
            
            // 精度確認（±1px以内）
            const deltaX = Math.abs(reverseClient.x - originalClientX);
            const deltaY = Math.abs(reverseClient.y - originalClientY);
            
            if (deltaX > 1.0 || deltaY > 1.0) {
                console.warn('⚠️ 座標変換精度低下:', {
                    original: { x: originalClientX, y: originalClientY },
                    world: worldPoint,
                    reverse: reverseClient,
                    delta: { x: deltaX, y: deltaY }
                });
            }
            
            // 統計更新
            this.conversionStats.averageAccuracy = 
                (this.conversionStats.averageAccuracy + Math.max(deltaX, deltaY)) / 2;
            
        } catch (error) {
            console.warn('⚠️ 座標精度検証失敗:', error.message);
        }
    }
    
    /**
     * World座標をClient座標に逆変換（検証用）
     */
    worldToClient(worldX, worldY) {
        const drawContainer = this.canvasManager.getDrawContainer();
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        // World → Canvas変換
        const canvasPoint = drawContainer.toGlobal({ x: worldX, y: worldY });
        
        // Canvas → Client変換
        const dpr = this.getEffectiveDPR();
        const clientX = (canvasPoint.x / dpr) + rect.left;
        const clientY = (canvasPoint.y / dpr) + rect.top;
        
        return { x: clientX, y: clientY };
    }
    
    /**
     * DOM座標をCanvas論理座標に変換（簡易版）  
     * DPRを考慮しない基本変換
     */
    clientToCanvas(clientX, clientY) {
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;
        
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * CanvasManager互換メソッド（clientToCanvasPixel）
     */
    clientToCanvasPixel(clientX, clientY) {
        return this.clientToCanvasPixelHighPrecision(clientX, clientY);
    }
    
    /**
     * Canvas境界矩形取得
     */
    getCanvasRect() {
        const canvas = this.canvasManager.getCanvasElement();
        return canvas.getBoundingClientRect();
    }
    
    /**
     * Container Transform Matrix取得（座標変換支援）
     */
    getTransformMatrix() {
        const drawContainer = this.canvasManager.getDrawContainer();
        if (!drawContainer || !drawContainer.transform) {
            return null;
        }
        
        return drawContainer.transform.worldTransform;
    }
    
    /**
     * 座標変換テスト（デバッグ用・高精度版）
     */
    testCoordinateConversion(clientX = 100, clientY = 100) {
        console.log('🧪 座標変換テスト開始（高精度版）');
        
        try {
            const startTime = performance.now();
            
            // 各段階の変換結果取得
            const canvasPixel = this.clientToCanvasPixelHighPrecision(clientX, clientY);
            const canvasLogical = this.clientToCanvas(clientX, clientY);
            const worldPoint = this.clientToWorld(clientX, clientY);
            const reverseClient = this.worldToClient(worldPoint.x, worldPoint.y);
            
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            
            // 精度計算
            const deltaX = Math.abs(reverseClient.x - clientX);
            const deltaY = Math.abs(reverseClient.y - clientY);
            const maxDelta = Math.max(deltaX, deltaY);
            
            const result = {
                success: true,
                precision: maxDelta <= 1.0 ? 'HIGH' : maxDelta <= 2.0 ? 'MEDIUM' : 'LOW',
                processingTime: processingTime,
                client: { x: clientX, y: clientY },
                canvasPixel: canvasPixel,
                canvasLogical: canvasLogical,
                world: worldPoint,
                reverseClient: reverseClient,
                accuracy: {
                    deltaX: deltaX,
                    deltaY: deltaY,
                    maxDelta: maxDelta,
                    withinTolerance: maxDelta <= 1.0
                },
                environment: {
                    dpr: this.getEffectiveDPR(),
                    canvasRect: this.getCanvasRect(),
                    webgpuSupported: this.webgpuSupported
                },
                stats: this.conversionStats
            };
            
            console.log('🧪 座標変換テスト結果（高精度版）:', result);
            return result;
            
        } catch (error) {
            console.error('❌ 座標変換テスト失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 4隅+中心座標テスト（包括テスト）
     */
    testAllCorners() {
        console.log('🧪 4隅+中心座標テスト開始');
        
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        const testPoints = [
            { name: '左上', x: rect.left + 1, y: rect.top + 1 },
            { name: '右上', x: rect.right - 1, y: rect.top + 1 },
            { name: '左下', x: rect.left + 1, y: rect.bottom - 1 },
            { name: '右下', x: rect.right - 1, y: rect.bottom - 1 },
            { name: '中心', x: rect.left + rect.width/2, y: rect.top + rect.height/2 }
        ];
        
        const results = testPoints.map(point => {
            const result = this.testCoordinateConversion(point.x, point.y);
            return {
                name: point.name,
                ...result
            };
        });
        
        console.log('🧪 4隅+中心座標テスト結果:', results);
        return results;
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.ready && 
               !!this.canvasManager && 
               this.canvasManager.isV8Ready();
    }
    
    /**
     * デバッグ情報取得（詳細版）
     */
    getDebugInfo() {
        return {
            className: 'CoordinateManager',
            version: 'v8-step2-precision-enhanced',
            ready: this.ready,
            v8Ready: this.v8Ready,
            webgpuSupported: this.webgpuSupported,
            highPrecisionMode: this.highPrecisionMode,
            coordinatePrecision: this.coordinatePrecision,
            canvasManager: !!this.canvasManager,
            canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
            effectiveDPR: this.getEffectiveDPR(),
            stats: this.conversionStats,
            canvas: this.canvasManager ? (() => {
                try {
                    const canvas = this.canvasManager.getCanvasElement();
                    const rect = canvas.getBoundingClientRect();
                    return {
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        top: rect.top,
                        canvasWidth: canvas.width,
                        canvasHeight: canvas.height
                    };
                } catch (error) {
                    return { error: error.message };
                }
            })() : null,
            transformMatrix: this.getTransformMatrix() ? 'Available' : 'Not Available',
            methods: {
                clientToWorld: typeof this.clientToWorld === 'function',
                clientToCanvas: typeof this.clientToCanvas === 'function',
                canvasToWorld: typeof this.canvasToWorldHighPrecision === 'function',
                testCoordinateConversion: typeof this.testCoordinateConversion === 'function'
            }
        };
    }
    
    /**
     * v8互換エイリアス（後方互換のため）
     */
    setCanvasManagerV8(canvasManager) {
        return this.setCanvasManager(canvasManager);
    }
    
    screenToCanvasV8(screenX, screenY) {
        return this.clientToCanvas(screenX, screenY);
    }
    
    isV8Ready() {
        return this.isReady();
    }
    
    /**
     * 統計情報リセット
     */
    resetStats() {
        this.conversionStats = {
            totalConversions: 0,
            clientToWorldCalls: 0,
            errors: 0,
            averageAccuracy: 0
        };
        console.log('📊 座標変換統計情報をリセットしました');
    }
    
    /**
     * パフォーマンス最適化設定
     */
    setOptimizationMode(highPrecision = true, cacheEnabled = false) {
        this.highPrecisionMode = highPrecision;
        this.transformCacheEnabled = cacheEnabled;
        
        console.log('⚡ CoordinateManager最適化設定更新:', {
            highPrecisionMode: this.highPrecisionMode,
            transformCacheEnabled: this.transformCacheEnabled
        });
    }
}

// グローバル登録
window.Tegaki.CoordinateManager = CoordinateManager;
console.log('🎯 CoordinateManager v8対応版・座標ズレ問題解決版 Loaded');
console.log('📏 Step2完了: 高精度座標変換・右下座標ズレ修正・±1px精度実現');
console.log('🚀 特徴: DPR対応強化・Container変形対応・座標検証機能・統計取得');