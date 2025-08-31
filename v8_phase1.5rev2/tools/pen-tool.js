/**
 * 📄 FILE: tools/pen-tool.js
 * 📌 RESPONSIBILITY: ペン描画ツール・非破壊描画・座標ズレ完全解決版・継続描画問題修正版
 * ChangeLog: 2025-08-31 <Manager注入API修正・継続描画問題解決・外部描画対応>
 * 
 * @provides
 *   - PenTool（クラス）
 *   - onPointerDown(event): void
 *   - onPointerMove(event): void  
 *   - onPointerUp(event): void
 *   - activate(): Promise<void>
 *   - deactivate(): void
 *   - setManagersObject(managers): Promise<boolean>
 *   - startStroke(point): void
 *   - addStrokePoint(point): void
 *   - endStroke(point?): void
 *   - forceEndDrawing(): void
 *   - setStrokeWidth(width): void
 *   - setStrokeColor(color): void
 *   - setStrokeOpacity(opacity): void
 *   - waitForReady(): Promise<void>
 *   - getDebugInfo(): Object
 *
 * @uses
 *   - AbstractTool.setManagersObject(), AbstractTool.activate(), AbstractTool.deactivate()
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CanvasManager.createStrokeGraphics(strokeId): PIXI.Graphics
 *   - CanvasManager.addPermanentGraphics(graphics): boolean
 *   - CanvasManager.getTemporaryGraphics(): PIXI.Graphics
 *   - CanvasManager.clearTemporaryGraphics(): void
 *   - CanvasManager.isV8Ready(): boolean
 *   - CoordinateManager.clientToWorld(x, y): {x, y}
 *   - CoordinateManager.isReady(): boolean
 *   - CoordinateManager.waitForReady(): Promise<void>
 *   - RecordManager.addStroke(strokeData): boolean
 *
 * @initflow
 *   1. ToolManager作成 → 2. setManagersObject(managers) → 3. waitForManagersReady()
 *   → 4. activate() → 5. initializeV8DrawingFeatures() → 6. 描画準備完了
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 Graphics.clear()全消去禁止（描画消失原因）
 *   🚫 直接DOM座標使用禁止
 *   🚫 Manager準備状態未確認描画禁止
 *   🚫 継続描画（マウス離しても描画が続く）禁止
 *
 * @manager-key
 *   window.Tegaki.PenToolInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager（v8Ready）, CoordinateManager（ready）, RecordManager, AbstractTool
 *   OPTIONAL: EventBus, ConfigManager
 *   FORBIDDEN: 直接Canvas操作、他描画システム
 *
 * @integration-flow
 *   ToolManager.initializeV8Tools() → PenTool作成 → setManagersObject() 
 *   → activate() → TegakiApplication.onPointerXxx → PenTool.onPointerXxx
 *
 * @method-naming-rules
 *   イベント処理: onPointerDown/Move/Up()
 *   内部描画: startStroke(), addStrokePoint(), endStroke()
 *   Manager管理: setManagersObject(), waitForReady()
 *   設定変更: setStrokeWidth/Color/Opacity()
 *   状態管理: activate(), deactivate(), isReadyForDrawing()
 *
 * @state-management
 *   描画状態は直接操作禁止・専用メソッド経由のみ
 *   Graphics分離管理でメモリリーク防止
 *   イベントキューイングで初期化競合回避
 *   Manager準備状態の段階的確認
 *   継続描画防止のための確実な状態リセット
 *
 * @performance-notes
 *   v8 Graphics新API・WebGPU対応・リアルタイム描画
 *   永続Graphics分離で描画消失防止・60fps維持
 *   座標変換統一で計算効率化・メモリ使用量最適化
 *
 * @error-handling
 *   throw: Manager未注入・座標変換失敗・Graphics作成失敗
 *   warn: 準備未完了・イベントキューイング・座標エラー
 *   queue: 初期化完了前イベント・Manager準備待機
 *
 * @testing-hooks
 *   - getDebugInfo(): 詳細状態・Manager準備状況・描画統計
 *   - isReadyForDrawing(): 描画準備確認
 *   - testCoordinate(x, y): 座標変換テスト
 */

(function() {
    'use strict';

    class PenTool extends window.Tegaki.AbstractTool {
        constructor(toolName = 'pen') {
            super(toolName);
            
            // 描画状態管理
            this.currentStroke = null;
            this.isDrawing = false;
            this.strokePoints = [];
            
            // 描画設定
            this.strokeWidth = 2.0;
            this.strokeColor = 0x800000; // --futaba-maroon
            this.strokeOpacity = 1.0;
            
            // Manager参照（依存注入）
            this.canvasManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventBus = null;
            this.configManager = null;
            
            // Graphics関連（描画消失問題解決用）
            this.currentStrokeGraphics = null;
            this.temporaryGraphics = null;
            this.drawContainer = null;
            
            // 初期化状態管理
            this.managersReady = false;
            this.v8FeaturesEnabled = false;
            this.readyPromise = null;
            this.readyResolve = null;
            
            // イベントキューイング（初期化順序対応）
            this.eventQueue = [];
            this.isProcessingQueue = false;
            this.maxQueueSize = 50;
            this.queueTimeoutMs = 5000;
            
            // 外部描画対応（tempStroke バッファリング）
            this.tempStroke = [];
            this.tempStrokeActive = false;
            
            // 描画統計
            this.drawingStats = {
                totalStrokes: 0,
                totalPoints: 0,
                averageStrokeLength: 0,
                lastStrokeTime: 0,
                queuedEvents: 0
            };
            
            // 準備完了Promise作成
            this.readyPromise = new Promise((resolve) => {
                this.readyResolve = resolve;
            });
        }
        
        // ========================================
        // Manager注入・初期化（依存注入統一）
        // ========================================
        
        /**
         * Manager統一注入（Object形式・準備完了確認付き）
         * 修正: super.setManagers() → super.setManagersObject() 
         * @param {Object} managers - Manager群オブジェクト
         * @returns {Promise<boolean>} 注入成功フラグ
         */
        async setManagersObject(managers) {
            try {
                console.log(`🔧 PenTool Manager注入開始`);
                
                if (!managers || typeof managers !== 'object') {
                    throw new Error('Manager注入失敗: Object形式必須');
                }
                
                // 親クラスManager注入（修正版）
                const parentResult = super.setManagersObject(managers);
                if (!parentResult) {
                    throw new Error('親クラスManager注入失敗');
                }
                
                // 各Manager参照設定
                this.canvasManager = managers.canvas || null;
                this.coordinateManager = managers.coordinate || null;
                this.recordManager = managers.record || null;
                this.eventBus = managers.eventbus || null;
                this.configManager = managers.config || null;
                
                // 必須Manager確認
                const requiredManagers = ['canvas', 'coordinate', 'record'];
                const missingManagers = requiredManagers.filter(key => !managers[key]);
                
                if (missingManagers.length > 0) {
                    throw new Error(`必須Manager不足: ${missingManagers.join(', ')}`);
                }
                
                // Manager準備完了待機
                await this.waitForManagersReady();
                
                this.managersReady = true;
                console.log(`✅ PenTool Manager統一注入完了`);
                
                // readyPromise解決
                if (this.readyResolve) {
                    this.readyResolve();
                }
                
                return true;
                
            } catch (error) {
                console.error('🖊️ PenTool: Manager統一注入失敗:', error);
                throw error;
            }
        }
        
        /**
         * Manager準備完了待機（段階的確認）
         */
        async waitForManagersReady() {
            // CanvasManager準備待機
            if (this.canvasManager) {
                if (!this.canvasManager.isV8Ready()) {
                    let attempts = 0;
                    const maxAttempts = 50;
                    
                    while (!this.canvasManager.isV8Ready() && attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                    }
                    
                    if (!this.canvasManager.isV8Ready()) {
                        throw new Error(`CanvasManager準備タイムアウト (${maxAttempts * 100}ms)`);
                    }
                }
            }
            
            // CoordinateManager準備待機
            if (this.coordinateManager) {
                if (!this.coordinateManager.isReady()) {
                    await this.coordinateManager.waitForReady();
                }
            }
            
            // RecordManager準備待機
            if (this.recordManager && typeof this.recordManager.isReady === 'function') {
                if (!this.recordManager.isReady()) {
                    let attempts = 0;
                    while (!this.recordManager.isReady() && attempts < 30) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                    }
                }
            }
        }
        
        /**
         * Tool アクティブ化・v8描画機能初期化
         */
        async activate() {
            try {
                // 親クラス アクティブ化
                super.activate();
                
                // Manager準備完了確認
                if (!this.managersReady) {
                    await this.readyPromise;
                }
                
                // v8描画機能初期化
                await this.initializeV8DrawingFeatures();
                
                // キューイングされたイベント処理
                await this.processEventQueue();
                
            } catch (error) {
                console.error('🖊️ PenTool: アクティブ化失敗:', error);
                throw error;
            }
        }
        
        /**
         * v8描画機能初期化（Graphics分離対応）
         */
        async initializeV8DrawingFeatures() {
            try {
                // DrawContainer取得
                this.drawContainer = this.canvasManager.getDrawContainer();
                if (!this.drawContainer) {
                    throw new Error('DrawContainer not available');
                }
                
                // TemporaryGraphics取得（リアルタイム描画用）
                this.temporaryGraphics = this.canvasManager.getTemporaryGraphics();
                if (!this.temporaryGraphics) {
                    throw new Error('TemporaryGraphics not available');
                }
                
                // v8機能フラグ設定
                this.v8FeaturesEnabled = true;
                
            } catch (error) {
                console.error('🖊️ PenTool: v8描画機能初期化失敗:', error);
                this.v8FeaturesEnabled = false;
                throw error;
            }
        }
        
        // ========================================
        // ポインターイベント処理（TegakiApplication連携）
        // ========================================
        
        /**
         * ポインターダウン処理（座標変換統一・準備状態確認）
         * @param {Object} event - ポインターイベント {x, y, ...}
         */
        onPointerDown(event) {
            try {
                // 準備状態確認
                if (!this.isReadyForDrawing()) {
                    this.queueEvent('pointerdown', event);
                    return;
                }
                
                // 統一座標変換: DOM座標 → World座標
                const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
                
                // 描画開始
                this.startStroke(worldPoint);
                
            } catch (error) {
                console.error('🖊️ PenTool.onPointerDown エラー:', error);
                this.handleCoordinateError(error, event);
            }
        }
        
        /**
         * ポインタームーブ処理（座標変換統一）
         * @param {Object} event - ポインターイベント {x, y, ...}
         */
        onPointerMove(event) {
            if (!this.isDrawing || !this.isReadyForDrawing()) {
                return;
            }
            
            try {
                // 統一座標変換: DOM座標 → World座標
                const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
                
                // 描画継続
                this.addStrokePoint(worldPoint);
                
            } catch (error) {
                console.error('🖊️ PenTool.onPointerMove エラー:', error);
            }
        }
        
        /**
         * ポインターアップ処理（座標変換統一・継続描画問題修正）
         * @param {Object} event - ポインターイベント {x, y, ...}
         */
        onPointerUp(event) {
            try {
                // 統一座標変換: DOM座標 → World座標
                const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
                
                // 描画終了（確実実行）
                this.endStroke(worldPoint);
                
            } catch (error) {
                console.error('🖊️ PenTool.onPointerUp エラー:', error);
                // エラー時でも描画終了処理は実行
                this.endStroke();
            } finally {
                // 継続描画問題修正: 確実な描画終了
                this.forceEndDrawing();
            }
        }
        
        // ========================================
        // 内部描画処理（非破壊Graphics分離版）
        // ========================================
        
        /**
         * 描画開始（非破壊・Graphics分離版・外部描画対応）
         * @param {Object} point - World座標 {x, y}
         */
        startStroke(point) {
            if (!this.isReadyForDrawing()) {
                return;
            }
            
            try {
                // 描画状態初期化
                this.isDrawing = true;
                this.strokePoints = [point];
                
                // 新しいストローク用Graphics作成（重要：個別Graphics）
                const strokeId = 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                this.currentStrokeGraphics = this.canvasManager.createStrokeGraphics(strokeId);
                
                // ✅ 一時Graphicsのみクリア（重要な修正）
                this.canvasManager.clearTemporaryGraphics();
                
                // v8新API: moveTo() でパス開始（両方のGraphicsに）
                this.temporaryGraphics.moveTo(point.x, point.y);
                this.currentStrokeGraphics.moveTo(point.x, point.y);
                
                // ストローク記録開始
                this.currentStroke = {
                    id: strokeId,
                    type: 'stroke',
                    tool: 'pen',
                    points: [{ ...point }],
                    color: this.strokeColor,
                    width: this.strokeWidth,
                    opacity: this.strokeOpacity,
                    started: Date.now()
                };
                
                // tempStroke初期化（外部描画対応）
                this.tempStroke = [point];
                this.tempStrokeActive = false;
                
            } catch (error) {
                console.error('🖊️ PenTool: 描画開始失敗:', error);
            }
        }
        
        /**
         * 描画継続（リアルタイム・永続Graphics両対応）
         * @param {Object} point - World座標 {x, y}
         */
        addStrokePoint(point) {
            if (!this.isDrawing || !this.isReadyForDrawing()) {
                return;
            }
            
            try {
                // 座標追加
                this.strokePoints.push(point);
                
                // v8新API: lineTo() → stroke() でリアルタイム描画
                // 一時Graphics: リアルタイム表示用
                this.temporaryGraphics.lineTo(point.x, point.y);
                this.temporaryGraphics.stroke({
                    width: this.strokeWidth,
                    color: this.strokeColor,
                    alpha: this.strokeOpacity,
                    cap: 'round',
                    join: 'round'
                });
                
                // 永続Graphics: 確定保存用（同期描画・重要）
                this.currentStrokeGraphics.lineTo(point.x, point.y);
                this.currentStrokeGraphics.stroke({
                    width: this.strokeWidth,
                    color: this.strokeColor,
                    alpha: this.strokeOpacity,
                    cap: 'round',
                    join: 'round'
                });
                
                // ストローク記録更新
                if (this.currentStroke) {
                    this.currentStroke.points.push({ ...point });
                }
                
                // tempStroke更新（外部描画対応）
                this.tempStroke.push(point);
                
                // 統計更新
                this.drawingStats.totalPoints++;
                
            } catch (error) {
                console.error('🖊️ PenTool: 描画継続失敗:', error);
            }
        }
        
        /**
         * 描画終了（永続Graphics確定・TPF保存・継続描画防止）
         * @param {Object} point - 最終World座標 {x, y} (optional)
         */
        endStroke(point) {
            if (!this.isDrawing) {
                return;
            }
            
            try {
                // 最終座標追加
                if (point) {
                    this.addStrokePoint(point);
                }
                
                // 永続Graphicsを描画コンテナに追加（描画保持・重要）
                if (this.currentStrokeGraphics) {
                    const success = this.canvasManager.addPermanentGraphics(this.currentStrokeGraphics);
                    if (success) {
                        console.log(`🖊️ PenTool: 永続Graphics追加成功 ID:${this.currentStroke?.id}`);
                    }
                }
                
                // 一時Graphicsクリア（次の描画準備・重要）
                this.canvasManager.clearTemporaryGraphics();
                
                // TPF形式ストローク完成・保存
                if (this.currentStroke && this.recordManager) {
                    this.currentStroke.ended = Date.now();
                    this.currentStroke.duration = this.currentStroke.ended - this.currentStroke.started;
                    
                    // RecordManager.addStroke()呼び出し
                    if (typeof this.recordManager.addStroke === 'function') {
                        try {
                            const saveResult = this.recordManager.addStroke(this.currentStroke);
                            if (saveResult) {
                                console.log(`🖊️ PenTool: TPF保存成功 ID:${this.currentStroke.id}`);
                            }
                        } catch (saveError) {
                            console.error('🖊️ PenTool: TPF保存エラー:', saveError);
                        }
                    }
                }
                
                // 統計更新
                this.drawingStats.totalStrokes++;
                this.drawingStats.lastStrokeTime = Date.now();
                if (this.strokePoints.length > 0) {
                    this.drawingStats.averageStrokeLength = 
                        (this.drawingStats.averageStrokeLength * (this.drawingStats.totalStrokes - 1) + 
                         this.strokePoints.length) / this.drawingStats.totalStrokes;
                }
                
            } catch (error) {
                console.error('🖊️ PenTool: 描画終了失敗:', error);
            } finally {
                // 描画状態リセット（finally で確実に実行・継続描画防止）
                this.resetStrokeState();
            }
        }
        
        /**
         * 強制描画終了（継続描画問題修正・確実実行）
         */
        forceEndDrawing() {
            if (!this.isDrawing) {
                return;
            }
            
            console.log('🛑 PenTool: 強制描画終了実行');
            
            try {
                // 現在の描画を終了
                this.endStroke();
            } catch (error) {
                console.error('🛑 PenTool: 強制描画終了エラー:', error);
            } finally {
                // 状態を確実にリセット
                this.resetStrokeState();
                console.log('✅ PenTool: 強制描画終了完了');
            }
        }
        
        /**
         * ストローク状態リセット（継続描画防止・確実実行）
         */
        resetStrokeState() {
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentStrokeGraphics = null;
            this.strokePoints = [];
            this.tempStroke = [];
            this.tempStrokeActive = false;
        }
        
        // ========================================
        // 初期化順序対応・イベントキューイング
        // ========================================
        
        /**
         * 描画準備状態確認（包括版）
         * @returns {boolean} 描画準備完了状態
         */
        isReadyForDrawing() {
            return this.managersReady && 
                   this.canvasManager?.isV8Ready() && 
                   this.coordinateManager?.isReady() && 
                   this.v8FeaturesEnabled &&
                   this.isActive &&
                   !!this.drawContainer &&
                   !!this.temporaryGraphics;
        }
        
        /**
         * イベントキューイング（初期化完了前のイベント保存）
         * @param {string} eventType - イベントタイプ
         * @param {Object} event - イベントオブジェクト
         */
        queueEvent(eventType, event) {
            // キューサイズ制限
            if (this.eventQueue.length >= this.maxQueueSize) {
                this.eventQueue.shift();
            }
            
            this.eventQueue.push({
                type: eventType,
                event: { ...event }, // イベントのコピーを作成
                timestamp: Date.now()
            });
            
            this.drawingStats.queuedEvents++;
            
            // 古いイベント削除
            const cutoffTime = Date.now() - this.queueTimeoutMs;
            this.eventQueue = this.eventQueue.filter(queuedEvent => 
                queuedEvent.timestamp > cutoffTime
            );
        }
        
        /**
         * キューイングされたイベント処理
         */
        async processEventQueue() {
            if (this.isProcessingQueue || this.eventQueue.length === 0) {
                return;
            }
            
            this.isProcessingQueue = true;
            
            try {
                let processedCount = 0;
                
                while (this.eventQueue.length > 0) {
                    const queuedEvent = this.eventQueue.shift();
                    
                    if (!this.isReadyForDrawing()) {
                        break;
                    }
                    
                    // イベントタイプに応じて処理
                    try {
                        switch (queuedEvent.type) {
                            case 'pointerdown':
                                this.onPointerDown(queuedEvent.event);
                                break;
                            case 'pointermove':
                                this.onPointerMove(queuedEvent.event);
                                break;
                            case 'pointerup':
                                this.onPointerUp(queuedEvent.event);
                                break;
                        }
                        processedCount++;
                    } catch (eventError) {
                        console.error('🖊️ PenTool: キューイベント処理エラー:', eventError);
                    }
                    
                    // 次のイベント処理前に少し待機
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
            } catch (error) {
                console.error('🖊️ PenTool: イベントキュー処理エラー:', error);
            } finally {
                this.isProcessingQueue = false;
            }
        }
        
        /**
         * 座標変換エラーハンドリング
         * @param {Error} error - エラーオブジェクト
         * @param {Object} event - 元のイベント
         */
        handleCoordinateError(error, event) {
            if (error.message.includes('not ready')) {
                // Manager未準備の場合はイベントをキューイング
                this.queueEvent('pointerdown', event);
            } else {
                // その他のエラーは報告
                console.error('🖊️ PenTool: 座標変換エラー:', error);
            }
        }
        
        // ========================================
        // Tool管理・設定変更
        // ========================================
        
        /**
         * Tool非アクティブ化（状態クリア・継続描画防止）
         */
        deactivate() {
            try {
                // 進行中の描画があれば強制終了
                if (this.isDrawing) {
                    this.forceEndDrawing();
                }
                
                // 親クラス非アクティブ化
                super.deactivate();
                
                // v8機能フラグクリア
                this.v8FeaturesEnabled = false;
                
                // イベントキュークリア
                this.eventQueue = [];
                this.isProcessingQueue = false;
                
                // tempStrokeクリア
                this.tempStroke = [];
                this.tempStrokeActive = false;
                
            } catch (error) {
                console.error('🖊️ PenTool: 非アクティブ化失敗:', error);
            }
        }
        
        /**
         * 描画設定変更メソッド群
         */
        setStrokeWidth(width) {
            this.strokeWidth = Math.max(0.5, Math.min(50, width));
        }
        
        setStrokeColor(color) {
            this.strokeColor = color;
        }
        
        setStrokeOpacity(opacity) {
            this.strokeOpacity = Math.max(0, Math.min(1, opacity));
        }
        
        // ========================================
        // 状態確認・デバッグ機能
        // ========================================
        
        /**
         * 準備完了まで待機
         * @returns {Promise<void>} 準備完了Promise
         */
        waitForReady() {
            if (this.isReadyForDrawing()) {
                return Promise.resolve();
            }
            return this.readyPromise;
        }
        
        /**
         * 座標変換テスト（デバッグ用）
         * @param {number} x - テスト用DOM座標X
         * @param {number} y - テスト用DOM座標Y
         * @returns {Object} 座標変換結果
         */
        testCoordinate(x, y) {
            try {
                if (!this.coordinateManager || !this.coordinateManager.isReady()) {
                    return { error: 'CoordinateManager not ready' };
                }
                
                const worldPoint = this.coordinateManager.clientToWorld(x, y);
                return {
                    input: { x, y },
                    world: worldPoint,
                    success: true
                };
                
            } catch (error) {
                return {
                    input: { x, y },
                    error: error.message,
                    success: false
                };
            }
        }
        
        /**
         * デバッグ情報取得（包括版）
         * @returns {Object} 詳細デバッグ情報
         */
        getDebugInfo() {
            return {
                className: 'PenTool',
                version: 'v8.12.0-continuity-fix',
                toolState: {
                    toolName: this.toolName,
                    isActive: this.isActive,
                    isDrawing: this.isDrawing,
                    currentStrokeId: this.currentStroke?.id || null,
                    strokePointsCount: this.strokePoints.length,
                    tempStrokeActive: this.tempStrokeActive,
                    tempStrokeLength: this.tempStroke.length
                },
                readinessState: {
                    managersReady: this.managersReady,
                    v8FeaturesEnabled: this.v8FeaturesEnabled,
                    readyForDrawing: this.isReadyForDrawing(),
                    drawContainerReady: !!this.drawContainer,
                    temporaryGraphicsReady: !!this.temporaryGraphics
                },
                managerStatus: {
                    canvas: !!this.canvasManager,
                    canvasReady: this.canvasManager?.isV8Ready() || false,
                    coordinate: !!this.coordinateManager,
                    coordinateReady: this.coordinateManager?.isReady() || false,
                    record: !!this.recordManager,
                    recordReady: this.recordManager?.isReady?.() || false,
                    eventbus: !!this.eventBus,
                    config: !!this.configManager
                },
                drawingSettings: {
                    strokeWidth: this.strokeWidth,
                    strokeColor: '0x' + this.strokeColor.toString(16),
                    strokeOpacity: this.strokeOpacity
                },
                eventQueue: {
                    queueLength: this.eventQueue.length,
                    isProcessing: this.isProcessingQueue,
                    maxQueueSize: this.maxQueueSize,
                    queueTimeoutMs: this.queueTimeoutMs
                },
                statistics: { ...this.drawingStats },
                graphicsInfo: {
                    currentStrokeGraphics: !!this.currentStrokeGraphics,
                    temporaryGraphics: !!this.temporaryGraphics,
                    drawContainer: !!this.drawContainer
                }
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.PenTool = PenTool;
    
    console.log('🖊️ PenTool v8.12.0 完全修正版 Loaded - Manager注入修正・継続描画問題解決・外部描画対応');

})();