/**
 * ChangeLog: 2025-09-01 AbstractTool準拠・架空メソッド撲滅・構文エラー修正
 * 
 * @provides
 *   ・Tool統一API: setManagersObject(managers), onPointerDown/Move/Up(event)
 *   ・Tool状態API: forceEndDrawing(), destroy(), getState()
 *   ・消去機能: 消去描画・ストローク管理・サイズ設定
 * 
 * @uses
 *   ・AbstractTool.setManagersObject() - Manager統一注入基底
 *   ・CanvasManager.getDrawContainer() - 描画Container取得
 *   ・CanvasManager.createStrokeGraphics() - Graphics作成
 *   ・CoordinateManager.clientToWorld() - 座標変換
 *   ・RecordManager.addStroke() - ストローク記録
 * 
 * @initflow
 *   1. new EraserTool() - インスタンス作成
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
 *   ・eraserSize: 消去サイズ
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

// EraserTool - AbstractTool準拠・架空メソッド撲滅版
(function() {
    'use strict';
    
    console.log('🧹 EraserTool AbstractTool準拠・架空メソッド撲滅版 作成開始');
    
    // AbstractTool存在確認
    if (!window.Tegaki || !window.Tegaki.AbstractTool) {
        throw new Error('EraserTool requires AbstractTool to be loaded first');
    }
    
    class EraserTool extends window.Tegaki.AbstractTool {
        constructor() {
            super();
            
            // Tool固有設定
            this.toolName = 'eraser';
            
            // 消去設定
            this._eraserSize = 10;
            this._eraserOpacity = 1.0;
            
            // 描画状態
            this._currentStroke = null;
            this._currentGraphics = null;
            this._strokePoints = [];
            
            // デバッグ
            this._debugMode = false;
            
            console.log('🧹 EraserTool instance created');
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
                
                // EraserTool固有Manager確認
                if (!this.canvasManager) {
                    throw new Error('EraserTool requires canvasManager');
                }
                
                if (!this.coordinateManager) {
                    throw new Error('EraserTool requires coordinateManager');
                }
                
                // Manager依存メソッド存在確認
                this._verifyManagerMethods();
                
                this._debugMode = this.configManager?.get('debugMode') || false;
                
                if (this._debugMode) {
                    console.log('🧹 EraserTool Manager injection completed');
                }
                
                return true;
                
            } catch (error) {
                console.error('🧹 EraserTool Manager injection failed:', error);
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
         * Pointer Down - 消去開始
         * @param {Object} event 座標処理済みPointerEvent
         */
        onPointerDown(event) {
            if (!this._managersReady()) {
                console.warn('🧹 EraserTool managers not ready, ignoring pointerdown');
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
                    console.warn('🧹 Invalid world position, ignoring');
                    return;
                }
                
                // 消去開始
                this._startErase(worldPos, event);
                
                if (this._debugMode) {
                    console.log('🧹 Erase started at:', worldPos);
                }
                
            } catch (error) {
                console.error('🧹 Error in onPointerDown:', error);
                this._safeEndErase();
            }
        }
        
        /**
         * Pointer Move - 消去継続
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
                    return; // silent ignore for smooth erasing
                }
                
                // 消去継続
                this._continueErase(worldPos, event);
                
            } catch (error) {
                console.error('🧹 Error in onPointerMove:', error);
                this._safeEndErase();
            }
        }
        
        /**
         * Pointer Up - 消去終了
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
                        this._continueErase(worldPos, event);
                    }
                }
                
                // 消去終了
                this._endErase();
                
                if (this._debugMode) {
                    console.log('🧹 Erase ended');
                }
                
            } catch (error) {
                console.error('🧹 Error in onPointerUp:', error);
                this._safeEndErase();
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
                    console.log('🧹 Force ending erasing');
                }
                this._safeEndErase();
            }
        }
        
        /**
         * Tool解放
         */
        destroy() {
            console.log('🧹 EraserTool destroying...');
            
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
            
            console.log('🧹 EraserTool destroyed');
        }
        
        /**
         * 現在状態取得
         * @returns {Object}
         */
        getState() {
            return {
                toolName: this.toolName,
                isDrawing: this.isDrawing,
                eraserSize: this._eraserSize,
                eraserOpacity: this._eraserOpacity,
                currentStrokePoints: this._strokePoints.length,
                managersReady: this._managersReady()
            };
        }
        
        //================================================
        // 消去設定API
        //================================================
        
        /**
         * 消去サイズ設定
         * @param {number} size 消去サイズ
         */
        setEraserSize(size) {
            if (typeof size === 'number' && size > 0) {
                this._eraserSize = size;
            }
        }
        
        /**
         * 消去透明度設定
         * @param {number} opacity 透明度（0-1）
         */
        setEraserOpacity(opacity) {
            if (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) {
                this._eraserOpacity = opacity;
            }
        }
        
        //================================================
        // 内部消去処理
        //================================================
        
        /**
         * 消去開始
         * @param {Object} worldPos ワールド座標
         * @param {Object} event 元イベント
         */
        _startErase(worldPos, event) {
            // 描画Container取得
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                throw new Error('EraserTool: drawContainer not available');
            }
            
            // Graphics作成
            this._currentGraphics = this.canvasManager.createStrokeGraphics();
            if (!this._currentGraphics) {
                throw new Error('EraserTool: failed to create stroke graphics');
            }
            
            // 消去設定（PixiJS v8のBlendMode使用）
            this._currentGraphics.blendMode = 'destination-out'; // 消去ブレンドモード
            
            // Graphics設定
            this._currentGraphics.stroke({
                width: this._eraserSize,
                color: 0xFFFFFF, // 色は関係ないが設定
                alpha: this._eraserOpacity,
                cap: 'round',
                join: 'round'
            });
            
            // Container追加
            drawContainer.addChild(this._currentGraphics);
            
            // ストローク情報初期化
            this._currentStroke = {
                id: Date.now(),
                startTime: performance.now(),
                type: 'erase',
                size: this._eraserSize,
                opacity: this._eraserOpacity,
                points: []
            };
            
            this._strokePoints = [{ ...worldPos, pressure: event.pressure || 1.0 }];
            
            // 消去開始
            this._currentGraphics.moveTo(worldPos.x, worldPos.y);
            
            // 描画状態設定（AbstractTool）
            this.isDrawing = true;
        }
        
        /**
         * 消去継続
         * @param {Object} worldPos ワールド座標
         * @param {Object} event 元イベント
         */
        _continueErase(worldPos, event) {
            if (!this._currentGraphics || !this._currentStroke) {
                return;
            }
            
            // 点追加
            const point = { ...worldPos, pressure: event.pressure || 1.0 };
            this._strokePoints.push(point);
            this._currentStroke.points.push(point);
            
            // 消去
            this._currentGraphics.lineTo(worldPos.x, worldPos.y);
        }
        
        /**
         * 消去終了
         */
        _endErase() {
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
                console.error('🧹 Error recording erase stroke:', error);
            } finally {
                // 状態リセット
                this._resetEraseState();
            }
        }
        
        /**
         * 安全な消去終了
         */
        _safeEndErase() {
            try {
                this._endErase();
            } catch (error) {
                console.error('🧹 Error in safe end erase:', error);
                this._resetEraseState();
            }
        }
        
        /**
         * 消去状態リセット
         */
        _resetEraseState() {
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
    
    window.Tegaki.EraserTool = EraserTool;
    
    console.log('🧹 EraserTool AbstractTool準拠・架空メソッド撲滅版 Loaded');
    console.log('📏 修正内容: AbstractTool継承修正・Manager統一注入・消去ブレンドモード・Graphics管理改善・構文エラー修正');
    console.log('🚀 特徴: 架空メソッド撲滅・入力検証強化・エラーハンドリング・消去記録・状態管理・destination-out対応');
    
})();