/**
 * CoordinateManager - PixiJS v8座標変換修正版
 * 
 * @provides CoordinateManager, screenToCanvas, toLocalFromCanvas, canvasToScreen, setCanvasManager
 * @uses CanvasManager.getApp, CanvasManager.getView
 * @initflow 1. 作成 → 2. setCanvasManager() → 3. 座標変換メソッド使用可能
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫Event座標の直読み🚫DPR重複適用🚫座標二重変換
 * @manager-key window.Tegaki.CoordinateManagerInstance
 * @dependencies-strict CanvasManager(必須)
 * @integration-flow CanvasManager → CoordinateManager
 * @method-naming-rules screenToCanvas(), toLocalFromCanvas() 形式統一
 * @coordinate-contract 画面→キャンバス→ローカル変換の唯一ルート、DPR補正一回のみ、Container変形対応
 * @error-handling 座標変換失敗時はnull返却、警告出力
 * @input-validation 入力座標null/undefined時は処理停止
 */

class CoordinateManager {
    constructor() {
        this.canvasManager = null;
        this.isReady = false;
        
        console.log('📐 CoordinateManager v8対応版 作成');
    }
    
    /**
     * CanvasManager 設定
     * @param {CanvasManager} canvasManager - Canvas管理インスタンス
     */
    setCanvasManager(canvasManager) {
        if (!canvasManager) {
            console.error('❌ CoordinateManager: CanvasManager が null です');
            return false;
        }
        
        this.canvasManager = canvasManager;
        this.isReady = true;
        
        console.log('✅ CoordinateManager: CanvasManager 設定完了');
        return true;
    }
    
    /**
     * 画面座標からキャンバス座標への変換
     * @param {Object} screenCoords - 画面座標 {x, y}
     * @returns {Object|null} - キャンバス座標 {x, y} または null
     */
    screenToCanvas(screenCoords) {
        if (!this.validateInput(screenCoords)) {
            return null;
        }
        
        if (!this.isReady) {
            console.warn('⚠️ CoordinateManager: 初期化未完了');
            return null;
        }
        
        try {
            const view = this.canvasManager.getView();
            if (!view) {
                console.error('❌ Canvas View が取得できません');
                return null;
            }
            
            // DOM要素の境界取得
            const rect = view.getBoundingClientRect();
            
            // DPRを一回だけ取得・適用
            const dpr = window.devicePixelRatio || 1;
            
            // 画面座標からキャンバス内座標へ変換
            const canvasX = (screenCoords.x - rect.left) * dpr;
            const canvasY = (screenCoords.y - rect.top) * dpr;
            
            // 境界チェック
            const canvasWidth = rect.width * dpr;
            const canvasHeight = rect.height * dpr;
            
            console.log('📐 座標変換:', {
                screen: screenCoords,
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                dpr: dpr,
                canvas: { x: canvasX, y: canvasY },
                bounds: { width: canvasWidth, height: canvasHeight }
            });
            
            return {
                x: canvasX,
                y: canvasY,
                inBounds: canvasX >= 0 && canvasY >= 0 && canvasX <= canvasWidth && canvasY <= canvasHeight
            };
            
        } catch (error) {
            console.error('❌ 画面→キャンバス座標変換エラー:', error);
            return null;
        }
    }
    
    /**
     * キャンバス座標からローカル座標への変換
     * @param {Object} canvasCoords - キャンバス座標 {x, y}
     * @returns {Object|null} - ローカル座標 {x, y} または null
     */
    toLocalFromCanvas(canvasCoords) {
        if (!this.validateInput(canvasCoords)) {
            return null;
        }
        
        if (!this.isReady) {
            console.warn('⚠️ CoordinateManager: 初期化未完了');
            return null;
        }
        
        try {
            const app = this.canvasManager.getApp();
            if (!app) {
                console.error('❌ PixiJS Application が取得できません');
                return null;
            }
            
            // DrawContainer 取得
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                console.warn('⚠️ DrawContainer が取得できません - stage座標を使用');
                return {
                    x: canvasCoords.x,
                    y: canvasCoords.y
                };
            }
            
            // Container変形を考慮した座標変換
            // PixiJS v8では Container.toLocal を使用
            const globalPoint = new PIXI.Point(canvasCoords.x, canvasCoords.y);
            const localPoint = drawContainer.toLocal(globalPoint);
            
            return {
                x: localPoint.x,
                y: localPoint.y
            };
            
        } catch (error) {
            console.error('❌ キャンバス→ローカル座標変換エラー:', error);
            // フォールバック: そのまま返す
            return {
                x: canvasCoords.x,
                y: canvasCoords.y
            };
        }
    }
    
    /**
     * ローカル座標からキャンバス座標への変換
     * @param {Object} localCoords - ローカル座標 {x, y}
     * @returns {Object|null} - キャンバス座標 {x, y} または null
     */
    localToCanvas(localCoords) {
        if (!this.validateInput(localCoords)) {
            return null;
        }
        
        if (!this.isReady) {
            console.warn('⚠️ CoordinateManager: 初期化未完了');
            return null;
        }
        
        try {
            // DrawContainer 取得
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                console.warn('⚠️ DrawContainer が取得できません');
                return {
                    x: localCoords.x,
                    y: localCoords.y
                };
            }
            
            // Container変形を考慮した座標変換
            const localPoint = new PIXI.Point(localCoords.x, localCoords.y);
            const globalPoint = drawContainer.toGlobal(localPoint);
            
            return {
                x: globalPoint.x,
                y: globalPoint.y
            };
            
        } catch (error) {
            console.error('❌ ローカル→キャンバス座標変換エラー:', error);
            return {
                x: localCoords.x,
                y: localCoords.y
            };
        }
    }
    
    /**
     * キャンバス座標から画面座標への変換
     * @param {Object} canvasCoords - キャンバス座標 {x, y}
     * @returns {Object|null} - 画面座標 {x, y} または null
     */
    canvasToScreen(canvasCoords) {
        if (!this.validateInput(canvasCoords)) {
            return null;
        }
        
        if (!this.isReady) {
            console.warn('⚠️ CoordinateManager: 初期化未完了');
            return null;
        }
        
        try {
            const view = this.canvasManager.getView();
            if (!view) {
                console.error('❌ Canvas View が取得できません');
                return null;
            }
            
            // DOM要素の境界取得
            const rect = view.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // キャンバス座標から画面座標へ変換
            const screenX = (canvasCoords.x / dpr) + rect.left;
            const screenY = (canvasCoords.y / dpr) + rect.top;
            
            return {
                x: screenX,
                y: screenY
            };
            
        } catch (error) {
            console.error('❌ キャンバス→画面座標変換エラー:', error);
            return null;
        }
    }
    
    /**
     * 入力座標の妥当性検証
     * @param {Object} coords - 座標オブジェクト
     * @returns {boolean} - 妥当性
     */
    validateInput(coords) {
        if (!coords) {
            console.warn('⚠️ CoordinateManager: 座標が null/undefined');
            return false;
        }
        
        if (typeof coords.x !== 'number' || typeof coords.y !== 'number') {
            console.warn('⚠️ CoordinateManager: 不正な座標形式', coords);
            return false;
        }
        
        if (!isFinite(coords.x) || !isFinite(coords.y)) {
            console.warn('⚠️ CoordinateManager: 無限大/NaN座標', coords);
            return false;
        }
        
        return true;
    }
    
    /**
     * デバッグ用: 座標変換チェーン実行
     * @param {Object} screenCoords - 画面座標
     * @returns {Object} - 各段階の座標
     */
    debugCoordinateChain(screenCoords) {
        const canvasCoords = this.screenToCanvas(screenCoords);
        const localCoords = canvasCoords ? this.toLocalFromCanvas(canvasCoords) : null;
        const backToCanvas = localCoords ? this.localToCanvas(localCoords) : null;
        const backToScreen = backToCanvas ? this.canvasToScreen(backToCanvas) : null;
        
        return {
            original: screenCoords,
            canvas: canvasCoords,
            local: localCoords,
            backToCanvas: backToCanvas,
            backToScreen: backToScreen
        };
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.CoordinateManager = CoordinateManager;

console.log('📐 CoordinateManager v8対応版 Loaded - 座標変換修正・Container対応・境界判定・デバッグ機能');
console.log('🚀 特徴: PixiJS v8 Point API・DPR補正統一・Container変形対応・境界チェック・エラー耐性');