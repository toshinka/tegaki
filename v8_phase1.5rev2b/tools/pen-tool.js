/**
 * @provides
 *   ・PenTool: ペン描画機能完全実装
 *   ・setManagersObject(managers): Manager注入実装
 *   ・onPointerDown/Move/Up(event): ペン描画イベント処理
 *   ・forceEndDrawing(): ペン描画強制終了
 *   ・destroy(): PenTool専用リソース解放
 *   ・getState(): ペン状態取得
 * 
 * @uses
 *   ・window.Tegaki.AbstractTool: 基底クラス継承
 *   ・CoordinateManager.eventToCanvas(event): 座標変換
 *   ・CanvasManager.getDrawContainer(): 描画コンテナ取得
 *   ・CanvasManager.createStrokeGraphics(): PIXI.Graphics作成
 *   ・ErrorManager.log(level, message): ログ出力
 * 
 * @initflow
 *   ・1. new PenTool() → AbstractTool.constructor → 基本状態初期化
 *   ・2. setManagersObject(managers) → Manager注入 → drawContainer設定
 *   ・3. onPointerDown → 描画開始 → PIXI.Graphics作成・配置
 *   ・4. onPointerMove → 座標追加 → lineTo連続実行
 *   ・5. onPointerUp → 描画確定 → 状態リセット
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
 *   ・オプション: EventBus（描画完了通知）
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
 *   ・onPointerDown/Move/Up(origEvent): ペン描画処理実装
 *   ・forceEndDrawing(): 描画中断処理実装（冪等性）
 *   ・destroy(): リソース解放実装
 *   ・getState(): ペン状態返却実装
 * 
 * @state-management
 *   ・isDrawing: AbstractTool継承・ペン描画中フラグ
 *   ・currentStroke: 現在描画中のPIXI.Graphics
 *   ・penSettings: ペン設定（色・太さ・透明度）
 * 
 * @performance-notes
 *   ・pointermove では座標変換のみ実行
 *   ・PIXI.Graphics.lineTo は軽量操作
 *   ・描画確定時のみ重い処理実行
 * 
 * @input-validation
 *   ・座標が null/undefined/NaN の場合は即座に return
 *   ・Manager未注入時は処理スキップ
 *   ・描画中でない場合の onPointerMove は無視
 * 
 * @pixi-v8-contract
 *   ・new PIXI.Graphics() 使用
 *   ・graphics.stroke({...}) v8新API使用
 *   ・graphics.moveTo(x, y) / lineTo(x, y) 継続利用
 *   ・container.addChild(graphics) 継続利用
 */

// ChangeLog: 2025-09-01 Phase1.5緊急修正 - 構文エラー撲滅・PixiJS v8対応

class PenTool extends window.Tegaki.AbstractTool {
    constructor() {
        super();
        
        // Tool識別
        this.toolName = 'pen';
        
        // ペン設定（futaba-maroon デフォルト）
        this.penSettings = {
            color: '#800000',  // futaba-maroon
            width: 2,
            alpha: 1.0,
            cap: 'round',
            join: 'round'
        };
        
        // 描画追跡
        this.strokePoints = [];
        this.lastPoint = null;
        this.minMoveDistance = 1.0;  // パフォーマンス制御
        
        this._logDebug('PenTool constructed');
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
            this._logInfo('PenTool managers injection completed successfully');
            
            // ペン固有の初期化
            this._initializePenSpecific();
        }
        
        return success;
    }
    
    /**
     * ペン固有初期化
     * @private
     */
    _initializePenSpecific() {
        try {
            // 現在は追加の初期化なし
            // 将来的にペン設定永続化やプリセット読み込み等を実装
            this._logDebug('PenTool specific initialization completed');
            
        } catch (error) {
            this._logError(`_initializePenSpecific failed: ${error.message}`);
        }
    }
    
    /**
     * ポインタダウン - 描画開始
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        if (!this.isReady()) {
            this._logWarn('onPointerDown: PenTool not ready');
            return;
        }
        
        try {
            // 座標変換
            const canvasCoords = this._getCanvasCoordinates(event);
            if (!canvasCoords) {
                this._logError('onPointerDown: Failed to get canvas coordinates');
                return;
            }
            
            // 描画開始
            this._startDrawing(canvasCoords.x, canvasCoords.y);
            
            this._logDebug(`onPointerDown: Drawing started at (${canvasCoords.x}, ${canvasCoords.y})`);
            
        } catch (error) {
            this._logError(`onPointerDown failed: ${error.message}`);
            this.forceEndDrawing();
        }
    }
    
    /**
     * ポインタムーブ - 描画継続
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
            
            // 描画継続
            this._continueDrawing(canvasCoords.x, canvasCoords.y);
            
        } catch (error) {
            this._logError(`onPointerMove failed: ${error.message}`);
            this.forceEndDrawing();
        }
    }
    
    /**
     * ポインタアップ - 描画終了
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        if (!this.isReady()) {
            this._logWarn('onPointerUp: PenTool not ready');
            return;
        }
        
        try {
            if (this.isDrawing) {
                // 最終座標処理
                const canvasCoords = this._getCanvasCoordinates(event);
                if (canvasCoords) {
                    this._continueDrawing(canvasCoords.x, canvasCoords.y);
                }
                
                // 描画確定
                this._finalizeDrawing();
                
                this._logDebug('onPointerUp: Drawing finalized');
            }
            
        } catch (error) {
            this._logError(`onPointerUp failed: ${error.message}`);
        } finally {
            // 必ず状態リセット
            this._resetDrawingState();
        }
    }
    
    /**
     * 描画開始処理
     * @param {number} x - Canvas X座標
     * @param {number} y - Canvas Y座標
     * @private
     */
    _startDrawing(x, y) {
        try {
            // PIXI.Graphics作成（v8対応）
            if (this.canvasManager && typeof this.canvasManager.createStrokeGraphics === 'function') {
                this.currentStroke = this.canvasManager.createStrokeGraphics();
            } else {
                // フォールバック: 直接PIXI.Graphics作成
                this.currentStroke = new PIXI.Graphics();
            }
            
            // ペン設定適用（PixiJS v8新API）
            this.currentStroke.stroke({
                color: this.penSettings.color,
                width: this.penSettings.width,
                alpha: this.penSettings.alpha,
                cap: this.penSettings.cap,
                join: this.penSettings.join
            });
            
            // 描画開始点設定
            this.currentStroke.moveTo(x, y);
            
            // コンテナに追加
            this.drawContainer.addChild(this.currentStroke);
            
            // 状態更新
            this.isDrawing = true;
            this.strokePoints = [{x, y}];
            this.lastPoint = {x, y};
            
        } catch (error) {
            this._logError(`_startDrawing failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 描画継続処理
     * @param {number} x - Canvas X座標
     * @param {number} y - Canvas Y座標
     * @private
     */
    _continueDrawing(x, y) {
        try {
            if (!this.currentStroke) {
                this._logError('_continueDrawing: No current stroke');
                return;
            }
            
            // 線描画（v8継続利用可能）
            this.currentStroke.lineTo(x, y);
            
            // 追跡情報更新
            this.strokePoints.push({x, y});
            this.lastPoint = {x, y};
            
        } catch (error) {
            this._logError(`_continueDrawing failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 描画確定処理
     * @private
     */
    _finalizeDrawing() {
        try {
            if (this.currentStroke && this.strokePoints.length > 0) {
                // 将来的にはここで記録・Undo対応等を実装
                this._logInfo(`Drawing finalized with ${this.strokePoints.length} points`);
                
                // EventBus通知（利用可能な場合）
                if (this.managersObject && this.managersObject.eventBus) {
                    this.managersObject.eventBus.emit('stroke:completed', {
                        tool: 'pen',
                        points: this.strokePoints,
                        settings: {...this.penSettings}
                    });
                }
            }
            
        } catch (error) {
            this._logError(`_finalizeDrawing failed: ${error.message}`);
        }
    }
    
    /**
     * 描画状態リセット
     * @private
     */
    _resetDrawingState() {
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokePoints = [];
        this.lastPoint = null;
    }
    
    /**
     * 強制描画終了 - 冪等性保証
     */
    forceEndDrawing() {
        try {
            if (this.isDrawing) {
                this._logWarn('forceEndDrawing: Forcing pen drawing to end');
                
                // 現在のストロークが存在する場合は保持
                if (this.currentStroke && this.strokePoints.length > 0) {
                    this._finalizeDrawing();
                }
            }
            
        } catch (error) {
            this._logError(`forceEndDrawing failed: ${error.message}`);
        } finally {
            // 必ず状態リセット
            this._resetDrawingState();
        }
    }
    
    /**
     * ペン設定更新
     * @param {Object} settings - 新しいペン設定
     */
    updatePenSettings(settings) {
        try {
            if (settings && typeof settings === 'object') {
                this.penSettings = {...this.penSettings, ...settings};
                this._logInfo(`Pen settings updated: ${JSON.stringify(this.penSettings)}`);
            }
        } catch (error) {
            this._logError(`updatePenSettings failed: ${error.message}`);
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
            // 描画状態クリア
            this.forceEndDrawing();
            
            // ペン固有リソースクリア
            this.penSettings = null;
            this.strokePoints = [];
            this.lastPoint = null;
            
            // 親クラスのdestroy実行
            super.destroy();
            
            this._logDebug('PenTool destroyed successfully');
            
        }