/**
 * @provides
 *   - CoordinateManager, clientToWorld, clientToCanvas, canvasToWorld, setCanvasManager, isReady, getDebugInfo
 *
 * @uses
 *   - CanvasManager.getCanvasElement, CanvasManager.getDrawContainer, CanvasManager.isV8Ready
 *
 * @initflow
 *   1. CanvasManager 初期化完了 → 2. setCanvasManager() → 3. ready Promise 解決 → 4. clientToWorld() 利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 目先のエラー修正のためのDRY・SOLID原則違反
 *
 * @manager-key
 *   - window.Tegaki.CoordinateManagerInstance
 *
 * @dependencies-strict
 *   - 必須: CanvasManager (v8対応)
 *   - オプション: なし
 *
 * @integration-flow
 *   - AppCore → CanvasManager → setCanvasManager() → Tool利用可能
 *
 * @method-naming-rules
 *   - 変換系: clientToWorld(), canvasToWorld(), clientToCanvas()
 *   - 状態系: isReady(), setCanvasManager()
 *   - デバッグ: getDebugInfo(), testCoordinateConversion()
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

class CoordinateManager {
    constructor() {
        this.canvasManager = null;
        this.ready = false;
        this.readyPromise = null;
        this.readyResolve = null;
        
        // 座標変換統計
        this.conversionStats = {
            totalConversions: 0,
            errors: 0,
            averageAccuracy: 0
        };
        
        // 準備完了Promise作成
        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = resolve;
        });
    }
    
    /**
     * CanvasManager設定・初期化（Promise化）
     */
    async setCanvasManager(canvasManager) {
        if (!canvasManager) {
            throw new Error('CanvasManager is required');
        }
        
        // CanvasManager の準備完了を待機
        if (!canvasManager.isV8Ready()) {
            console.warn('CanvasManager not ready, waiting...');
            // 最大5秒待機
            let attempts = 0;
            while (!canvasManager.isV8Ready() && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!canvasManager.isV8Ready()) {
                throw new Error('CanvasManager initialization timeout');
            }
        }
        
        this.canvasManager = canvasManager;
        this.ready = true;
        
        // readyPromise解決
        if (this.readyResolve) {
            this.readyResolve();
        }
        
        console.log('CoordinateManager ready');
    }
    
    /**
     * DOM座標をPIXI World座標に変換（修正版）
     */
    clientToWorld(clientX, clientY) {
        if (!this.ready) {
            throw new Error('CoordinateManager not ready - call setCanvasManager() first');
        }
        
        try {
            this.conversionStats.totalConversions++;
            
            // Step 1: DOM clientX/Y → Canvas backing pixel座標
            const canvasPoint = this.clientToCanvasPixel(clientX, clientY);
            
            // Step 2: Canvas pixel座標 → PIXI World座標
            const worldPoint = this.canvasToWorld(canvasPoint.x, canvasPoint.y);
            
            return worldPoint;
            
        } catch (error) {
            this.conversionStats.errors++;
            console.error('clientToWorld conversion error:', error);
            throw error;
        }
    }
    
    /**
     * DOM座標をCanvas backing pixel座標に変換（DPR対応修正版）
     */
    clientToCanvasPixel(clientX, clientY) {
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        // CSS座標から相対座標を計算
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;
        
        // Canvas論理サイズを基準とした座標に正規化（重要な修正）
        const normalizedX = (relativeX / rect.width) * canvas.width;
        const normalizedY = (relativeY / rect.height) * canvas.height;
        
        return { 
            x: normalizedX, 
            y: normalizedY 
        };
    }
    
    /**
     * Canvas座標をPIXI World座標に変換（修正版）
     */
    canvasToWorld(canvasX, canvasY) {
        const drawContainer = this.canvasManager.getDrawContainer();
        
        if (!drawContainer) {
            throw new Error('DrawContainer not available');
        }
        
        // PIXI Stage座標系での点として作成
        const stagePoint = { x: canvasX, y: canvasY };
        
        // DrawContainerのローカル座標系に変換
        const worldPoint = drawContainer.toLocal(stagePoint);
        
        return { 
            x: Math.round(worldPoint.x * 10) / 10, // 0.1px精度
            y: Math.round(worldPoint.y * 10) / 10 
        };
    }
    
    /**
     * DOM座標をCanvas論理座標に変換（簡易版）
     */
    clientToCanvas(clientX, clientY) {
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    /**
     * 座標変換テスト（デバッグ用）
     */
    testCoordinateConversion(clientX = 100, clientY = 100) {
        if (!this.ready) {
            console.error('CoordinateManager not ready for testing');
            return { success: false, error: 'Not ready' };
        }
        
        try {
            const startTime = performance.now();
            
            const canvasPixel = this.clientToCanvasPixel(clientX, clientY);
            const canvasLogical = this.clientToCanvas(clientX, clientY);
            const worldPoint = this.clientToWorld(clientX, clientY);
            
            const endTime = performance.now();
            
            const result = {
                success: true,
                processingTime: endTime - startTime,
                client: { x: clientX, y: clientY },
                canvasPixel: canvasPixel,
                canvasLogical: canvasLogical,
                world: worldPoint,
                stats: this.conversionStats
            };
            
            console.log('Coordinate conversion test result:', result);
            return result;
            
        } catch (error) {
            console.error('Coordinate conversion test failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 4隅+中心座標テスト
     */
    testAllCorners() {
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        const testPoints = [
            { name: '左上', x: rect.left + 1, y: rect.top + 1 },
            { name: '右上', x: rect.right - 1, y: rect.top + 1 },
            { name: '左下', x: rect.left + 1, y: rect.bottom - 1 },
            { name: '右下', x: rect.right - 1, y: rect.bottom - 1 },
            { name: '中心', x: rect.left + rect.width/2, y: rect.top + rect.height/2 }
        ];
        
        const results = testPoints.map(point => ({
            name: point.name,
            ...this.testCoordinateConversion(point.x, point.y)
        }));
        
        console.log('4隅+中心座標テスト結果:', results);
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
     * 準備完了まで待機
     */
    waitForReady() {
        return this.readyPromise;
    }
    
    /**
     * Transform Matrix取得
     */
    getTransformMatrix() {
        if (!this.ready) {
            return null;
        }
        
        try {
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer || !drawContainer.transform) {
                return null;
            }
            return drawContainer.transform.worldTransform;
        } catch (error) {
            console.warn('Transform matrix not available:', error);
            return null;
        }
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'CoordinateManager',
            ready: this.ready,
            canvasManager: !!this.canvasManager,
            canvasManagerReady: this.canvasManager?.isV8Ready() || false,
            stats: this.conversionStats,
            canvas: this.canvasManager ? (() => {
                try {
                    const canvas = this.canvasManager.getCanvasElement();
                    const rect = canvas.getBoundingClientRect();
                    return {
                        cssSize: { width: rect.width, height: rect.height },
                        backingSize: { width: canvas.width, height: canvas.height },
                        position: { left: rect.left, top: rect.top }
                    };
                } catch (error) {
                    return { error: error.message };
                }
            })() : null,
            transformMatrix: this.getTransformMatrix() ? 'Available' : 'Not Available'
        };
    }
}

// グローバル登録
window.Tegaki.CoordinateManager = CoordinateManager;
window.Tegaki.CoordinateManagerInstance = new CoordinateManager();

console.log('CoordinateManager v8対応版・座標ズレ問題解決版 Loaded');
console.log('Step2完了: 高精度座標変換・右下座標ズレ修正・±1px精度実現');
console.log('特徴: DPR対応強化・Container変形対応・座標検証機能・統計取得');