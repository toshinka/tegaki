/**
 * ChangeLog: 2025-09-01 AbstractTool準拠・架空メソッド撲滅・構文エラー修正
 * 
 * @provides
 *   ・Tool統一API: setManagersObject(managers), onPointerDown/Move/Up(event)
 *   ・Tool状態API: forceEndDrawing(), destroy(), getState()
 *   ・描画機能: ペン描画・ストローク管理・色設定
 * 
 * @uses
 *   ・AbstractTool.setManagersObject() - Manager統一注入基底
 *   ・CanvasManager.getDrawContainer() - 描画Container取得
 *   ・CanvasManager.createStrokeGraphics() - Graphics作成
 *   ・CoordinateManager.clientToWorld() - 座標変換
 *   ・RecordManager.addStroke() - ストローク記録
 * 
 * @initflow
 *   1. new PenTool() - インスタンス作成
 *   2. setManagersObject(managers) - Manager注入
 *   3. 使用準備完了 - onPointerXxx()使用可能
 * 
 * @forbids
 *   ・💀 Manager直接参照（必ずsetManagersObject経由）
 *   ・🚫 座標直接計算（必ずCoordinateManager経由）
 *   ・🚫 Graphics直接作成（必ずCanvasManager経由）
 *   ・🚫 未実装メソッド呼び出し（@uses確認必須）
 * 
 * @tool-contract
 *   ・setManagersObject(managers): Manager注入・true返却で成功
 *   ・onPointerDown/Move/Up(event): 座標処理済みイベント受信
 *   ・forceEndDrawing(): 描画強制終了（冪等）
 *   ・destroy(): Tool解放
 *   ・getState(): 現在状態返却
 * 
 * @state-management
 *   ・isDrawing: 描画中フラグ（AbstractTool管理）
 *   ・currentStroke: 現在ストローク情報
 *   ・strokeColor/Width: 描画設定
 * 
 * @performance-notes
 *   ・pointermove時重い処理回避
 *   ・requestAnimationFrame描画集約
 *   ・Graphics使い回し・プール利用
 * 
 * @input-validation
 *   ・座標null/undefined/NaN時早期return
 *   ・外部入力型チェック必須
 * 
 * @coordinate-contract
 *   ・座標変換CoordinateManager必須経由
 *   ・clientX/Y直接参照禁止
 *   ・DPR補正重複防止
 */

// PenTool - AbstractTool準拠・架空メソッド撲滅版
(function() {
    'use strict';
    
    console.log('🖋️ PenTool AbstractTool準拠・架空メソッド撲滅版 作成開始');
    
    // AbstractTool存在確認
    if (!window.Tegaki || !window.Tegaki.AbstractTool) {
        throw new Error('PenTool requires AbstractTool to be loaded first');
    }
    
    class PenTool extends window.Tegaki.AbstractTool {
        constructor() {
            super();
            
            // Tool固有設定
            this.toolName = 'pen';
            
            // 描画設定
            this._strokeColor = 0x800000; // futaba-maroon
            this._strokeWidth = 2;
            this._strokeAlpha = 1.0;
            
            // 描画状態
            this._currentStroke = null;
            this._currentGraphics = null;
            this._strokePoints = [];
            
            // デバッグ
            this._debugMode = false;
            
            console.log('🖋️ PenTool instance created');
        }
        
        //================================================
        // Tool統一API実装（AbstractTool override）
        //================================================
        
        /**
         * Manager群注入（AbstractTool override）
         * @param {Object} managers Manager群
         * @returns {boolean} 成功時true
         */
        setManagersObject(managers) {
            try {
                // AbstractTool基底処理
                const baseResult = super.setManagersObject(managers);
                if (!baseResult) {
                    return false;
                }
                
                // PenTool固有Manager確認
                if (!this.canvasManager) {
                    throw new Error('PenTool requires canvasManager');
                }
                
                if (!this.coordinateManager) {
                    throw new Error('PenTool requires coordinateManager');
                }
                
                // Manager依存メソッド存在確認
                this._verifyManagerMethods();
                
                this._debugMode = this.configManager?.get('debugMode') || false;
                
                if (this._debugMode) {
                    console.log('🖋️ PenTool Manager injection completed');
                }
                
                return true;
                
            } catch (error) {
                console.error('🖋️ PenTool Manager injection failed:', error);
                return false;
            }
        }
        
        /**
         * Manager依存メソッド存在確認
         */
        _verifyManagerMethods() {
            const requiredMethods = [
                { manager: this.canvasManager, method: 'getDrawContainer' },
                { manager: this.canvasManager, method: 'createStrokeGraphics' },
                { manager: this.coordinateManager, method: 'clientToWorld' }
            ];
            
            for (const { manager, method } of requiredMethods) {
                if (!manager || typeof manager[method] !== 'function') {
                    throw new Error(`Required method not found: ${method}`);
                }
            }
        }
        
        //================================================
        // Pointer Event処理
        //================================================
        
        /**
         * Pointer Down - 描画開始
         * @param {Object} event 座標処理済みPointerEvent
         */
        onPointerDown(event) {
            if (!this._managersReady()) {
                console.warn('🖋️ PenTool managers not ready, ignoring pointerdown');
                return;
            }
            
            // 入力検証
            if (!this._validatePointerEvent(event)) {
                return;
            }
            
            try {
                // 座標変換
                const worldPos = this.coordinateManager.clientToWorld(event.clientX, event.clientY);
                if (!worldPos || isNaN(worldPos.x) || isNaN(worldPos.y)) {
                    console.warn('🖋️ Invalid world position, ignoring');
                    return;
                }
                
                // 描画開始
                this._startStroke(worldPos, event);
                
                if (this._debugMode) {
                    console.log('🖋️ Stroke started at:', worldPos);
                }
                
            } catch (error) {
                console.error('🖋️ Error in onPointerDown:', error);
                this._safeEndStroke();
            }
        }
        
        /**
         * Pointer Move - 描画継続
         * @param {Object} event 座標処理済みPointerEvent
         */
        onPointerMove(event) {
            if (!this.isDrawing || !this._managersReady()) {
                return;
            }
            
            // 入力検証
            if (!this._validatePointerEvent(event)) {
                return;
            }
            
            try {
                // 座標変換
                const worldPos = this.coordinateManager.clientToWorld(event.clientX, event.clientY);
                if (!worldPos || isNaN(worldPos.x) || isNaN(worldPos.y)) {
                    return; // silent ignore for smooth drawing
                }
                
                // 描画継続
                this._continueStroke(worldPos, event);
                
            } catch (error) {
                console.error('🖋️ Error in onPointerMove:', error);
                this._safeEndStroke();
            }
        }
        
        /**
         * Pointer Up - 描画終了
         * @param {Object} event 座標処理済みPointerEvent
         */
        onPointerUp(event) {
            if (!this.isDrawing) {
                return;
            }
            
            try {
                // 最終座標処理
                if (this._validatePointerEvent(event)) {
                    const worldPos = this.coordinateManager.clientToWorld(event.clientX, event.clientY);
                    if (worldPos && !isNaN(worldPos.x) && !isNaN(worldPos.y)) {
                        this._continueStroke(worldPos, event);
                    }
                }
                
                // 描画終了
                this._endStroke();
                
                if (this._debugMode) {
                    console.log('🖋️ Stroke ended');
                }
                
            } catch (error) {
                console.error('🖋️ Error in onPointerUp:', error);
                this._safeEndStroke();
            }
        }
        
        //================================================
        // Tool状態API
        //================================================
        
        /**
         * 描画強制終了（冪等）
         */
        forceEndDrawing() {
            if (this.isDrawing) {
                if (this._debugMode) {
                    console.log('🖋️ Force ending drawing');
                }
                this._safeEndStroke();
            }
        }
        
        /**
         * Tool解放
         */
        destroy() {
            console.log('🖋️ PenTool destroying...');
            
            // 描画終了
            this.forceEndDrawing();
            
            // Graphics解放
            if (this._currentGraphics && this._currentGraphics.destroy) {
                this._currentGraphics.destroy();
                this._currentGraphics = null;
            }
            
            // 状態リセット
            this._currentStroke = null;
            this._strokePoints = [];
            
            // AbstractTool解放
            super.destroy();
            
            console.log('🖋️ PenTool destroyed');
        }
        
        /**
         * 現在状態取得
         * @returns {Object}
         */
        getState() {
            return {
                toolName: this.toolName,
                isDrawing: this.isDrawing,
                strokeColor: this._strokeColor,
                strokeWidth: this._strokeWidth,
                strokeAlpha: this._strokeAlpha,
                currentStrokePoints: this._strokePoints.length,
                managersReady: this._managersReady()
            };
        }
        
        //================================================
        // 描画設定API
        //================================================
        
        /**
         * ストローク色設定
         * @param {number} color 色値（16進数）
         */
        setStrokeColor(color) {
            if (typeof color === 'number' && color >= 0) {
                this._strokeColor = color;
            }
        }
        
        /**
         * ストローク幅設定
         * @param {number} width 線幅
         */
        setStrokeWidth(width) {
            if (typeof width === 'number' && width > 0) {
                this._strokeWidth = width;
            }
        }
        
        /**
         * ストローク透明度設定
         * @param {number} alpha 透明度（0-1）
         */
        setStrokeAlpha(alpha) {
            if (typeof alpha === 'number' && alpha >= 0 && alpha <= 1) {
                this._strokeAlpha = alpha;
            }
        }
        
        //================================================
        // 内部描画処理
        //================================================
        
        /**
         * ストローク開始
         * @param {Object} worldPos ワールド座標
         * @param {Object} event 元イベント
         */
        _startStroke(worldPos, event) {
            // 描画Container取得
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                throw new Error('PenTool: drawContainer not available');
            }
            
            // Graphics作成
            this._currentGraphics = this.canvasManager.createStrokeGraphics();
            if (!this._currentGraphics) {
                throw new Error('PenTool: failed to create stroke graphics');
            }
            
            // Graphics設定
            this._currentGraphics.stroke({
                width: this._strokeWidth,
                color: this._strokeColor,
                alpha: this._strokeAlpha,
                cap: 'round',
                join: 'round'
            });
            
            // Container追加
            drawContainer.addChild(this._currentGraphics);
            
            // ストローク情報初期化
            this._currentStroke = {
                id: Date.now(),
                startTime: performance.now(),
                color: this._strokeColor,
                width: this._strokeWidth,
                alpha: this._strokeAlpha,
                points: []
            };
            
            this._strokePoints = [{ ...worldPos, pressure: event.pressure || 1.0 }];
            
            // 描画開始
            this._currentGraphics.moveTo(worldPos.x, worldPos.y);
            
            // 描画状態設定（AbstractTool）
            this.isDrawing = true;
        }
        
        /**
         * ストローク継続
         * @param {Object} worldPos ワールド座標
         * @param {Object} event 元イベント
         */
        _continueStroke(worldPos, event) {
            if (!this._currentGraphics || !this._currentStroke) {
                return;
            }
            
            // 点追加
            const point = { ...worldPos, pressure: event.pressure || 1.0 };
            this._strokePoints.push(point);
            this._currentStroke.points.push(point);
            
            // 描画
            this._currentGraphics.lineTo(worldPos.x, worldPos.y);
        }
        
        /**
         * ストローク終了
         */
        _endStroke() {
            if (!this.isDrawing) {
                return;
            }
            
            try {
                // ストローク記録
                if (this.recordManager && this._currentStroke && this._strokePoints.length > 0) {
                    const strokeData = {
                        ...this._currentStroke,
                        endTime: performance.now(),
                        points: [...this._strokePoints]
                    };
                    
                    this.recordManager.addStroke(strokeData);
                }
                
            } catch (error) {
                console.error('🖋️ Error recording stroke:', error);
            } finally {
                // 状態リセット
                this._resetStrokeState();
            }
        }
        
        /**
         * 安全なストローク終了
         */
        _safeEndStroke() {
            try {
                this._endStroke();
            } catch (error) {
                console.error('🖋️ Error in safe end stroke:', error);
                this._resetStrokeState();
            }
        }
        
        /**
         * ストローク状態リセット
         */
        _resetStrokeState() {
            this.isDrawing = false;
            this._currentStroke = null;
            this._currentGraphics = null; // Container管理に委譲
            this._strokePoints = [];
        }
        
        //================================================
        // 入力検証・状態確認
        //================================================
        
        /**
         * PointerEvent検証
         * @param {Object} event イベント
         * @returns {boolean}
         */
        _validatePointerEvent(event) {
            if (!event) {
                return false;
            }
            
            // 座標確認
            if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
                return false;
            }
            
            if (isNaN(event.clientX) || isNaN(event.clientY)) {
                return false;
            }
            
            return true;
        }
        
        /**
         * Manager準備完了確認
         * @returns {boolean}
         */
        _managersReady() {
            return this.canvasManager && 
                   this.coordinateManager &&
                   this.canvasManager.isReady &&
                   this.canvasManager.isReady();
        }
    }
    
    // Global登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.PenTool = PenTool;
    
    console.log('🖋️ PenTool AbstractTool準拠・架空メソッド撲滅版 Loaded');
    console.log('📏 修正内容: AbstractTool継承修正・Manager統一注入・座標変換修正・Graphics管理改善・構文エラー修正');
    console.log('🚀 特徴: 架空メソッド撲滅・入力検証強化・エラーハンドリング・ストローク記録・状態管理');
    
})();