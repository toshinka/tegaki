/**
 * 📄 FILE: js/utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: DOM座標とPIXI World座標間の正確な変換処理
 *
 * @provides
 *   - clientToWorld(clientX, clientY)
 *   - clientToCanvas(clientX, clientY)  
 *   - canvasToWorld(canvasX, canvasY)
 *   - setCanvasManager(canvasManager)
 *   - isReady()
 *   - getDebugInfo()
 *
 * @uses  
 *   - CanvasManager.getCanvasElement()
 *   - CanvasManager.getDrawContainer()
 *   - CanvasManager.getPixiApp()
 *   - HTMLCanvasElement.getBoundingClientRect()
 *   - PIXI.Container.toLocal()
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
 *   取得系: getCanvasRect() / getDrawContainer()
 *   設定系: setCanvasManager()
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * CoordinateManager - DOM座標とPIXI World座標の正確な変換
 * 座標ズレ問題を解決する統一座標変換システム
 */
class CoordinateManager {
    constructor() {
        console.log('🎯 CoordinateManager v8対応版 作成開始');
        
        // 基本プロパティ
        this.canvasManager = null;
        this.ready = false;
        
        // v8機能フラグ
        this.v8Ready = false;
        this.highPrecisionMode = true;
        this.webgpuSupported = false;
        
        console.log('✅ CoordinateManager v8対応版 作成完了');
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
     * DOM座標をPIXI World座標に変換（メイン変換API）
     * GPT5検診.txtの指摘を受けた修正版
     */
    clientToWorld(clientX, clientY) {
        if (!this.ready) {
            throw new Error('CoordinateManager not ready - call setCanvasManager() first');
        }
        
        try {
            // Step 1: DOM clientX/Y → Canvas backing pixel座標
            const canvasPoint = this.clientToCanvasPixel(clientX, clientY);
            
            // Step 2: Canvas pixel座標 → PIXI World座標  
            const worldPoint = this.canvasToWorld(canvasPoint.x, canvasPoint.y);
            
            return worldPoint;
            
        } catch (error) {
            console.error('❌ clientToWorld変換エラー:', error);
            throw error;
        }
    }
    
    /**
     * DOM座標をCanvas backing pixel座標に変換
     * devicePixelRatioを考慮した正確な変換
     */
    clientToCanvasPixel(clientX, clientY) {
        const canvas = this.canvasManager.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        // CSS表示サイズベースの座標計算
        const cssX = clientX - rect.left;
        const cssY = clientY - rect.top;
        
        // devicePixelRatioを考慮してbacking pixelに変換
        const dpr = window.devicePixelRatio || 1;
        const backingX = cssX * dpr;
        const backingY = cssY * dpr;
        
        return { x: backingX, y: backingY };
    }
    
    /**
     * Canvas座標をPIXI World座標に変換
     * Container transformを考慮した変換
     */
    canvasToWorld(canvasX, canvasY) {
        const drawContainer = this.canvasManager.getDrawContainer();
        
        if (!drawContainer || typeof drawContainer.toLocal !== 'function') {
            throw new Error('DrawContainer toLocal() method not available');
        }
        
        // PIXI.Container.toLocal()でContainer transformを考慮した変換
        const worldPoint = drawContainer.toLocal({ x: canvasX, y: canvasY });
        
        return { x: worldPoint.x, y: worldPoint.y };
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
     * Canvas境界矩形取得
     */
    getCanvasRect() {
        const canvas = this.canvasManager.getCanvasElement();
        return canvas.getBoundingClientRect();
    }
    
    /**
     * 座標変換テスト（デバッグ用）
     */
    testCoordinateConversion(clientX = 100, clientY = 100) {
        console.log('🧪 座標変換テスト開始');
        
        try {
            const canvasPixel = this.clientToCanvasPixel(clientX, clientY);
            const canvasLogical = this.clientToCanvas(clientX, clientY);
            const worldPoint = this.clientToWorld(clientX, clientY);
            
            const result = {
                success: true,
                client: { x: clientX, y: clientY },
                canvasPixel: canvasPixel,
                canvasLogical: canvasLogical,
                world: worldPoint,
                dpr: window.devicePixelRatio,
                canvasRect: this.getCanvasRect()
            };
            
            console.log('🧪 座標変換テスト結果:', result);
            return result;
            
        } catch (error) {
            console.error('❌ 座標変換テスト失敗:', error);
            return { success: false, error: error.message };
        }
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
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'CoordinateManager',
            ready: this.ready,
            v8Ready: this.v8Ready,
            webgpuSupported: this.webgpuSupported,
            highPrecisionMode: this.highPrecisionMode,
            canvasManager: !!this.canvasManager,
            canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
            dpr: window.devicePixelRatio || 1,
            canvas: this.canvasManager ? (() => {
                try {
                    const canvas = this.canvasManager.getCanvasElement();
                    const rect = canvas.getBoundingClientRect();
                    return {
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        top: rect.top
                    };
                } catch (error) {
                    return { error: error.message };
                }
            })() : null
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
}

// グローバル登録
window.Tegaki.CoordinateManager = CoordinateManager;
console.log('🎯 CoordinateManager v8対応版 Loaded');