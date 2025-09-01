/**
 * @provides
 *   ・AbstractTool: 全Tool共通基底クラス
 *   ・setManagersObject(managers): Manager注入標準契約
 *   ・onPointerDown/Move/Up(event): ポインタイベント標準契約
 *   ・forceEndDrawing(): 強制終了契約
 *   ・destroy(): リソース解放契約
 *   ・getState(): 状態取得契約
 * 
 * @uses
 *   ・window.Tegaki.ErrorManager.log(level, message)
 *   ・CoordinateManager.eventToCanvas(event)
 *   ・CanvasManager.getDrawContainer()
 * 
 * @initflow
 *   ・1. new Tool() → constructor
 *   ・2. tool.setManagersObject(managers) → Manager注入
 *   ・3. tool.onPointer*() → イベントハンドリング開始
 * 
 * @forbids
 *   ・💀 双方向依存禁止
 *   ・🚫 座標直読み・独自処理禁止（CoordinateManager 経由必須）
 *   ・🚫 未実装メソッド呼び出し禁止
 *   ・🚫 console直書き禁止
 * 
 * @dependencies-strict
 *   ・必須: ErrorManager（ログ用）
 *   ・オプション: CoordinateManager, CanvasManager（setManagersObject注入）
 *   ・禁止: 他Tool系クラス
 * 
 * @logging-policy
 *   ・ErrorManager.log(level, message) 経由必須
 *   ・level: debug/info/warn/error/fatal のみ使用
 *   ・console直書き禁止
 * 
 * @coordinate-contract
 *   ・CoordinateManager を唯一のルートとする
 *   ・座標変換は Manager経由のみ
 *   ・Tool 側での直接座標計算禁止
 * 
 * @tool-contract
 *   ・setManagersObject(managers) -> boolean: 登録時の Manager 注入
 *   ・onPointerDown/Move/Up(origEvent): ポインタイベントハンドラ
 *   ・forceEndDrawing(): 終端保証（冪等性）
 *   ・destroy(): リソース解放
 *   ・getState(): 現在状態返却（テスト用）
 * 
 * @state-management
 *   ・状態変更は getter/setter または明示 API 経由のみ
 *   ・isDrawing 等のフラグは AbstractTool で一貫管理
 * 
 * @performance-notes
 *   ・pointermove では重い処理を避ける
 *   ・描画は requestAnimationFrame に集約
 *   ・大量スプライト生成時はバッファプール使用
 * 
 * @input-validation
 *   ・座標が null/undefined/NaN の場合は即座に return
 *   ・外部入力は常に型チェック実施
 */

// ChangeLog: 2025-09-01 Phase1.5緊急修正 - 構文エラー撲滅・基底クラス堅牢化

class AbstractTool {
    constructor() {
        // 基本状態管理
        this.isDrawing = false;
        this.isActive = false;
        this.toolName = 'abstract';
        
        // Manager注入状態
        this.managersObject = null;
        this.canvasManager = null;
        this.coordinateManager = null;
        this.errorManager = null;
        
        // 描画状態
        this.currentStroke = null;
        this.drawContainer = null;
        
        // 初期化状態追跡
        this._initializationState = {
            managersInjected: false,
            ready: false
        };
    }
    
    /**
     * Manager注入 - 全Tool共通契約
     * @param {Object} managers - 注入するManager群
     * @returns {boolean} - 注入成功フラグ
     */
    setManagersObject(managers) {
        try {
            if (!managers || typeof managers !== 'object') {
                this._logError('setManagersObject: Invalid managers object provided');
                return false;
            }
            
            // 必須Manager検証
            const requiredManagers = ['canvasManager', 'coordinateManager', 'errorManager'];
            const missing = requiredManagers.filter(name => !managers[name]);
            
            if (missing.length > 0) {
                this._logError(`setManagersObject: Missing required managers: ${missing.join(', ')}`);
                return false;
            }
            
            // Manager注入実行
            this.managersObject = managers;
            this.canvasManager = managers.canvasManager;
            this.coordinateManager = managers.coordinateManager;
            this.errorManager = managers.errorManager;
            
            // 注入後初期化
            this._initializationState.managersInjected = true;
            this._initializeAfterInjection();
            
            this._logDebug(`setManagersObject: Successfully injected managers for ${this.toolName}`);
            return true;
            
        } catch (error) {
            this._logError(`setManagersObject failed: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Manager注入後の内部初期化
     * @private
     */
    _initializeAfterInjection() {
        try {
            // DrawContainer取得
            if (this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function') {
                this.drawContainer = this.canvasManager.getDrawContainer();
            }
            
            // 準備完了
            this._initializationState.ready = true;
            
        } catch (error) {
            this._logError(`_initializeAfterInjection failed: ${error.message}`);
            this._initializationState.ready = false;
        }
    }
    
    /**
     * 座標変換ヘルパー
     * @param {Event} event - ポインタイベント
     * @returns {Object|null} - {x, y} または null
     */
    _getCanvasCoordinates(event) {
        if (!this.coordinateManager) {
            this._logError('_getCanvasCoordinates: CoordinateManager not available');
            return null;
        }
        
        if (!event) {
            this._logError('_getCanvasCoordinates: Invalid event provided');
            return null;
        }
        
        try {
            const coords = this.coordinateManager.eventToCanvas(event);
            
            // 座標値検証
            if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') {
                this._logError('_getCanvasCoordinates: Invalid coordinates returned');
                return null;
            }
            
            if (isNaN(coords.x) || isNaN(coords.y)) {
                this._logError('_getCanvasCoordinates: NaN coordinates detected');
                return null;
            }
            
            return coords;
            
        } catch (error) {
            this._logError(`_getCanvasCoordinates failed: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 準備状態確認
     * @returns {boolean} - Tool準備完了フラグ
     */
    isReady() {
        return this._initializationState.managersInjected && 
               this._initializationState.ready && 
               this.canvasManager && 
               this.coordinateManager && 
               this.drawContainer;
    }
    
    // ========================================
    // Tool契約インターフェース（サブクラスで実装必須）
    // ========================================
    
    /**
     * ポインタダウンイベント処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        if (!this.isReady()) {
            this._logWarn('onPointerDown: Tool not ready');
            return;
        }
        
        // サブクラスで実装
        this._logDebug(`onPointerDown called on ${this.toolName} (default implementation)`);
    }
    
    /**
     * ポインタムーブイベント処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        if (!this.isReady() || !this.isDrawing) {
            return;
        }
        
        // サブクラスで実装
        this._logDebug(`onPointerMove called on ${this.toolName} (default implementation)`);
    }
    
    /**
     * ポインタアップイベント処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        if (!this.isReady()) {
            this._logWarn('onPointerUp: Tool not ready');
            return;
        }
        
        // 基本的な終了処理
        this.isDrawing = false;
        this.currentStroke = null;
        
        this._logDebug(`onPointerUp called on ${this.toolName} (default implementation)`);
    }
    
    /**
     * 強制描画終了 - 冪等性保証
     */
    forceEndDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.currentStroke = null;
            this._logDebug(`forceEndDrawing: ${this.toolName} drawing force ended`);
        }
    }
    
    /**
     * リソース解放
     */
    destroy() {
        try {
            // 描画状態クリア
            this.forceEndDrawing();
            
            // Manager参照クリア
            this.managersObject = null;
            this.canvasManager = null;
            this.coordinateManager = null;
            this.errorManager = null;
            this.drawContainer = null;
            
            // 状態リセット
            this.isActive = false;
            this._initializationState = {
                managersInjected: false,
                ready: false
            };
            
            this._logDebug(`destroy: ${this.toolName} destroyed successfully`);
            
        } catch (error) {
            // ErrorManager参照が失われる可能性があるため console.error使用
            console.error(`AbstractTool.destroy failed: ${error.message}`);
        }
    }
    
    /**
     * 現在状態取得 - テスト用
     * @returns {Object} - 現在状態
     */
    getState() {
        return {
            toolName: this.toolName,
            isDrawing: this.isDrawing,
            isActive: this.isActive,
            isReady: this.isReady(),
            managersInjected: this._initializationState.managersInjected,
            hasManagers: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                errorManager: !!this.errorManager
            }
        };
    }
    
    // ========================================
    // ログヘルパー
    // ========================================
    
    _logDebug(message) {
        if (this.errorManager && typeof this.errorManager.log === 'function') {
            this.errorManager.log('debug', `[${this.toolName}] ${message}`);
        }
    }
    
    _logInfo(message) {
        if (this.errorManager && typeof this.errorManager.log === 'function') {
            this.errorManager.log('info', `[${this.toolName}] ${message}`);
        }
    }
    
    _logWarn(message) {
        if (this.errorManager && typeof this.errorManager.log === 'function') {
            this.errorManager.log('warn', `[${this.toolName}] ${message}`);
        }
    }
    
    _logError(message) {
        if (this.errorManager && typeof this.errorManager.log === 'function') {
            this.errorManager.log('error', `[${this.toolName}] ${message}`);
        }
    }
}

// ========================================
// グローバル登録 - 名前空間確保
// ========================================

// window.Tegaki名前空間確保
if (!window.Tegaki) {
    window.Tegaki = {};
}

// AbstractTool登録
window.Tegaki.AbstractTool = AbstractTool;

// 構文検証ヘルパー
AbstractTool.syntaxTest = function() {
    try {
        // 基本インスタンス作成テスト
        const testInstance = new AbstractTool();
        
        // 必須メソッド存在確認
        const requiredMethods = ['setManagersObject', 'onPointerDown', 'onPointerMove', 'onPointerUp', 'forceEndDrawing', 'destroy', 'getState'];
        const missing = requiredMethods.filter(method => typeof testInstance[method] !== 'function');
        
        if (missing.length > 0) {
            throw new Error(`Missing methods: ${missing.join(', ')}`);
        }
        
        // 後始末
        testInstance.destroy();
        
        return { success: true, message: 'AbstractTool syntax validation passed' };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// デバッグ用ログ
if (window.Tegaki && window.Tegaki.ErrorManager) {
    window.Tegaki.ErrorManager.log('info', 'AbstractTool loaded successfully - Phase1.5 fixed version');
} else {
    console.log('AbstractTool loaded successfully - Phase1.5 fixed version');
}