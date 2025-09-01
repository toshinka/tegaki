/**
 * @provides
 *   ・EraserTool: 消しゴム機能完全実装
 *   ・setManagersObject(managers): Manager注入実装
 *   ・onPointerDown/Move/Up(event): 消しゴムイベント処理
 *   ・forceEndDrawing(): 消しゴム処理強制終了
 *   ・destroy(): EraserTool専用リソース解放
 *   ・getState(): 消しゴム状態取得
 * 
 * @uses
 *   ・window.Tegaki.AbstractTool: 基底クラス継承
 *   ・CoordinateManager.eventToCanvas(event): 座標変換
 *   ・CanvasManager.getDrawContainer(): 描画コンテナ取得
 *   ・CanvasManager.createStrokeGraphics(): PIXI.Graphics作成
 *   ・ErrorManager.log(level, message): ログ出力
 * 
 * @initflow
 *   ・1. new EraserTool() → AbstractTool.constructor → 基本状態初期化
 *   ・2. setManagersObject(managers) → Manager注入 → drawContainer設定
 *   ・3. onPointerDown → 消去開始 → PIXI.Graphics作成・ERASE設定
 *   ・4. onPointerMove → 消去継続 → circle描画でERASE適用
 *   ・5. onPointerUp → 消去確定 → 状態リセット
 * 
 * @forbids
 *   ・💀 双方向依存禁止
 *   ・🚫 座標直読み・独自処理禁止（CoordinateManager 経由必須）
 *   ・🚫 未実装メソッド呼び出し禁止
 *   ・🚫 console直書き禁止
 *   ・🚫 PixiJS v7構文使用禁止（v8のみ）
 * 
 * @dependencies-strict
 *   ・必須: AbstractTool, CoordinateManager, CanvasManager, ErrorManager
 *   ・オプション: EventBus（消去完了通知）
 *   ・禁止: 他Tool系クラス、ToolManager
 * 
 * @logging-policy
 *   ・ErrorManager.log(level, message) 経由必須
 *   ・level: debug/info/warn/error/fatal のみ使用
 *   ・console直書き禁止
 * 
 * @coordinate-contract
 *   ・CoordinateManager を唯一のルートとする
 *   ・座標変換は eventToCanvas(event) 経由のみ
 *   ・Tool 側での直接座標計算禁止
 * 
 * @tool-contract
 *   ・setManagersObject(managers) -> boolean: Manager 注入実装
 *   ・onPointerDown/Move/Up(origEvent): 消しゴム処理実装
 *   ・forceEndDrawing(): 消去中断処理実装（冪等性）
 *   ・destroy(): リソース解放実装
 *   ・getState(): 消しゴム状態返却実装
 * 
 * @state-management
 *   ・isDrawing: AbstractTool継承・消去中フラグ
 *   ・currentEraser: 現在消去中のPIXI.Graphics
 *   ・eraserSettings: 消しゴム設定（サイズ・透明度）
 * 
 * @performance-notes
 *   ・pointermove では circle作成のみ実行
 *   ・ERASE blendMode はGPU加速利用
 *   ・消去確定時のみ重い処理実行
 * 
 * @input-validation
 *   ・座標が null/undefined/NaN の場合は即座に return
 *   ・Manager未注入時は処理スキップ
 *   ・描画中でない場合の onPointerMove は無視
 * 
 * @pixi-v8-contract
 *   ・new PIXI.Graphics() 使用
 *   ・graphics.circle(x, y, radius).fill(color) v8新API使用
 *   ・graphics.blendMode = PIXI.BLEND_MODES.ERASE 継続利用
 *   ・container.addChild(graphics) 継続利用
 */

// ChangeLog: 2025-09-01 Phase1.5緊急修正 - 構文エラー撲滅・PixiJS v8対応

class EraserTool extends window.Tegaki.AbstractTool {
    constructor() {
        super();
        
        // Tool識別
        this.toolName = 'eraser';
        
        // 消しゴム設定
        this.eraserSettings = {
            size: 20,      // 消しゴムサイズ（直径）
            alpha: 1.0,    // 消去強度
            color: '#ffffff' // ERASE用の色（実際は見えない）
        };
        
        // 消去追跡
        this.erasePoints = [];
        this.lastPoint = null;
        this.minMoveDistance = 2.0;  // ペンより大きめ（パフォーマンス）
        
        // 消去専用Graphics（連続使用）
        this.currentEraser = null;
        
        this._logDebug('EraserTool constructed');
    }
    
    /**
     * Manager注入実装 - AbstractToolを拡張
     * @param {Object} managers - 注入するManager群
     * @returns {boolean} - 注入成功フラグ
     */
    setManagersObject(managers) {
        // 親クラスのManager注入実行
        const success = super.setManagersObject(managers);
        
        if (success) {
            this._logInfo('EraserTool managers injection completed successfully');
            
            // 消しゴム固有の初期化
            this._initializeEraserSpecific();
        }
        
        return success;
    }
    
    /**
     * 消しゴム固有初期化
     * @private
     */
    _initializeEraserSpecific() {
        try {
            // 現在は追加の初期化なし
            // 将来的に消しゴム設定永続化等を実装
            this._logDebug('EraserTool specific initialization completed');
            
        } catch (error) {
            this._logError(`_initializeEraserSpecific failed: ${error.message}`);
        }
    }
    
    /**
     * ポインタダウン - 消去開始
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        if (!this.isReady()) {
            this._logWarn('onPointerDown: EraserTool not ready');
            return;
        }
        
        try {
            // 座標変換
            const canvasCoords = this._getCanvasCoordinates(event);
            if (!canvasCoords) {
                this._logError('onPointerDown: Failed to get canvas coordinates');
                return;
            }
            
            // 消去開始
            this._startErasing(canvasCoords.x, canvasCoords.y);
            
            this._logDebug(`onPointerDown: Erasing started at (${canvasCoords.x}, ${canvasCoords.y})`);
            
        } catch (error) {
            this._logError(`onPointerDown failed: ${error.message}`);
            this.forceEndDrawing();
        }
    }
    
    /**
     * ポインタムーブ - 消去継続
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        if (!this.isReady() || !this.isDrawing) {
            return;
        }
        
        try {
            // 座標変換
            const canvasCoords = this._getCanvasCoordinates(event);
            if (!canvasCoords) {
                return; // 座標取得失敗時は無視
            }
            
            // 最小移動距離チェック（パフォーマンス向上）
            if (this.lastPoint && this._getDistance(this.lastPoint, canvasCoords) < this.minMoveDistance) {
                return;
            }
            
            // 消去継続
            this._continueErasing(canvasCoords.x, canvasCoords.y);
            
        } catch (error) {
            this._logError(`onPointerMove failed: ${error.message}`);
            this.forceEndDrawing();
        }
    }
    
    /**
     * ポインタアップ - 消去終了
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        if (!this.isReady()) {
            this._logWarn('onPointerUp: EraserTool not ready');
            return;
        }
        
        try {
            if (this.isDrawing) {
                // 最終座標処理
                const canvasCoords = this._getCanvasCoordinates(event);
                if (canvasCoords) {
                    this._continueErasing(canvasCoords.x, canvasCoords.y);
                }
                
                // 消去確定
                this._finalizeErasing();
                
                this._logDebug('onPointerUp: Erasing finalized');
            }
            
        } catch (error) {
            this._logError(`onPointerUp failed: ${error.message}`);
        } finally {
            // 必ず状態リセット
            this._resetErasingState();
        }
    }
    
    /**
     * 消去開始処理
     * @param {number} x - Canvas X座標
     * @param {number} y - Canvas Y座標
     * @private
     */
    _startErasing(x, y) {
        try {
            // PIXI.Graphics作成（v8対応）
            if (this.canvasManager && typeof this.canvasManager.createStrokeGraphics === 'function') {
                this.currentEraser = this.canvasManager.createStrokeGraphics();
            } else {
                // フォールバック: 直接PIXI.Graphics作成
                this.currentEraser = new PIXI.Graphics();
            }
            
            // ERASE blendMode設定（v8継続利用）
            this.currentEraser.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // コンテナに追加
            this.drawContainer.addChild(this.currentEraser);
            
            // 最初の消去実行
            this._eraseAtPoint(x, y);
            
            // 状態更新
            this.isDrawing = true;
            this.erasePoints = [{x, y}];
            this.lastPoint = {x, y};
            
        } catch (error) {
            this._logError(`_startErasing failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 消去継続処理
     * @param {number} x - Canvas X座標
     * @param {number} y - Canvas Y座標
     * @private
     */
    _continueErasing(x, y) {
        try {
            if (!this.currentEraser) {
                this._logError('_continueErasing: No current eraser');
                return;
            }
            
            // 指定座標で消去実行
            this._eraseAtPoint(x, y);
            
            // 追跡情報更新
            this.erasePoints.push({x, y});
            this.lastPoint = {x, y};
            
        } catch (error) {
            this._logError(`_continueErasing failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 指定座標での消去実行
     * @param {number} x - Canvas X座標
     * @param {number} y - Canvas Y座標
     * @private
     */
    _eraseAtPoint(x, y) {
        try {
            const radius = this.eraserSettings.size / 2;
            
            // 円形消去（PixiJS v8新API）
            this.currentEraser
                .circle(x, y, radius)
                .fill({
                    color: this.eraserSettings.color,
                    alpha: this.eraserSettings.alpha
                });
            
        } catch (error) {
            this._logError(`_eraseAtPoint failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 消去確定処理
     * @private
     */
    _finalizeErasing() {
        try {
            if (this.currentEraser && this.erasePoints.length > 0) {
                // 将来的にはここで記録・Undo対応等を実装
                this._logInfo(`Erasing finalized with ${this.erasePoints.length} points`);
                
                // EventBus通知（利用可能な場合）
                if (this.managersObject && this.managersObject.eventBus) {
                    this.managersObject.eventBus.emit('erase:completed', {
                        tool: 'eraser',
                        points: this.erasePoints,
                        settings: {...this.eraserSettings}
                    });
                }
            }
            
        } catch (error) {
            this._logError(`_finalizeErasing failed: ${error.message}`);
        }
    }
    
    /**
     * 消去状態リセット
     * @private
     */
    _resetErasingState() {
        this.isDrawing = false;
        this.currentEraser = null;
        this.erasePoints = [];
        this.lastPoint = null;
    }
    
    /**
     * 強制消去終了 - 冪等性保証
     */
    forceEndDrawing() {
        try {
            if (this.isDrawing) {
                this._logWarn('forceEndDrawing: Forcing eraser to end');
                
                // 現在の消去が存在する場合は保持
                if (this.currentEraser && this.erasePoints.length > 0) {
                    this._finalizeErasing();
                }
            }
            
        } catch (error) {
            this._logError(`forceEndDrawing failed: ${error.message}`);
        } finally {
            // 必ず状態リセット
            this._resetErasingState();
        }
    }
    
    /**
     * 消しゴム設定更新
     * @param {Object} settings - 新しい消しゴム設定
     */
    updateEraserSettings(settings) {
        try {
            if (settings && typeof settings === 'object') {
                this.eraserSettings = {...this.eraserSettings, ...settings};
                this._logInfo(`Eraser settings updated: ${JSON.stringify(this.eraserSettings)}`);
            }
        } catch (error) {
            this._logError(`updateEraserSettings failed: ${error.message}`);
        }
    }
    
    /**
     * 距離計算ヘルパー
     * @param {Object} point1 - 座標1 {x, y}
     * @param {Object} point2 - 座標2 {x, y}
     * @returns {number} - 距離
     * @private
     */
    _getDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * リソース解放 - AbstractToolを拡張
     */
    destroy() {
        try {
            // 消去状態クリア
            this.forceEndDrawing();
            
            // 消しゴム固有リソースクリア
            this.eraserSettings = null;
            this.erasePoints = [];
            this.lastPoint = null;
            
            // 親クラスのdestroy実行
            super.destroy();
            
            this._logDebug('EraserTool destroyed successfully');
            
        } catch (error) {
            // ErrorManager参照が失われる可能性があるため console.error使用
            console.error(`EraserTool.destroy failed: ${error.message}`);
        }
    }
    
    /**
     * 現在状態取得 - AbstractToolを拡張
     * @returns {Object} - 現在状態
     */
    getState() {
        const baseState = super.getState();
        
        return {
            ...baseState,
            eraserSettings: {...this.eraserSettings},
            erasePointsCount: this.erasePoints ? this.erasePoints.length : 0,
            hasCurrentEraser: !!this.currentEraser,
            lastPoint: this.lastPoint ? {...this.lastPoint} : null
        };
    }
}

// ========================================
// グローバル登録 - 名前空間確保
// ========================================

// EraserTool登録
if (!window.Tegaki) {
    window.Tegaki = {};
}

window.Tegaki.EraserTool = EraserTool;

// 構文検証ヘルパー
EraserTool.syntaxTest = function() {
    try {
        // 基本インスタンス作成テスト
        const testInstance = new EraserTool();
        
        // 継承確認
        if (!(testInstance instanceof window.Tegaki.AbstractTool)) {
            throw new Error('EraserTool does not extend AbstractTool correctly');
        }
        
        // 必須メソッド存在確認
        const requiredMethods = ['setManagersObject', 'onPointerDown', 'onPointerMove', 'onPointerUp', 'forceEndDrawing', 'destroy', 'getState', 'updateEraserSettings'];
        const missing = requiredMethods.filter(method => typeof testInstance[method] !== 'function');
        
        if (missing.length > 0) {
            throw new Error(`Missing methods: ${missing.join(', ')}`);
        }
        
        // 消しゴム設定確認
        if (!testInstance.eraserSettings || typeof testInstance.eraserSettings !== 'object') {
            throw new Error('Invalid eraserSettings initialization');
        }
        
        // 後始末
        testInstance.destroy();
        
        return { success: true, message: 'EraserTool syntax validation passed' };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// デバッグ用ログ
if (window.Tegaki && window.Tegaki.ErrorManager) {
    window.Tegaki.ErrorManager.log('info', 'EraserTool loaded successfully - Phase1.5 fixed version');
} else {
    console.log('EraserTool loaded successfully - Phase1.5 fixed version');
}