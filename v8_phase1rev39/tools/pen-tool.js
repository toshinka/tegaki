/**
 * 📄 FILE: tools/pen-tool.js
 * 📌 RESPONSIBILITY: ペンツール・PixiJS v8完全対応・原始イベント処理版
 *
 * @provides
 *   - PenTool クラス（AbstractTool継承）
 *   - onPointerDown(event): void - ペン描画開始
 *   - onPointerMove(event): void - ペン描画継続
 *   - onPointerUp(event): void - ペン描画終了
 *   - forceEndDrawing(): void - 強制描画終了
 *   - resetDrawingState(): void - 描画状態リセット
 *
 * @uses
 *   - AbstractTool.setManagersObject(managers): boolean
 *   - AbstractTool.getDrawContainer(): PIXI.Container
 *   - CoordinateManager.toCanvasCoords(clientX, clientY): {x, y}
 *   - RecordManager.addStroke(strokeData): boolean
 *   - PIXI.Graphics（v8）描画処理
 *
 * @initflow
 *   1. constructor → 2. setManagersObject → 3. activate → 4. onPointerDown → 5. 描画開始
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 座標変換NaN結果許可禁止
 *   🚫 RecordManager未準備状態での記録試行禁止
 *   🚫 描画状態継続問題許可禁止
 *   🚫 v7 API使用禁止（LINE_CAP等）
 *   🚫 独自イベントオブジェクト受け取り禁止
 *
 * @manager-key
 *   window.Tegaki.PenToolInstance
 *
 * @dependencies-strict
 *   REQUIRED: AbstractTool, CanvasManager, CoordinateManager, RecordManager
 *   OPTIONAL: EventBus
 *   FORBIDDEN: 他Tool直接参照, ToolManager直接参照
 *
 * @integration-flow
 *   ToolManager → PenTool.activate → PointerEvent → 原始座標取得 → CoordinateManager → Graphics描画 → RecordManager記録
 *
 * @method-naming-rules
 *   イベント系: onPointerXxx()
 *   描画系: startDrawing(), continueDrawing(), endDrawing()
 *   状態系: resetDrawingState(), forceEndDrawing()
 *   取得系: getCurrentStroke(), getDebugInfo()
 *
 * @event-contract
 *   ・onPointerDown/Move/Up は原始PointerEvent を受け取る
 *   ・event.clientX/Y から座標を直接取得
 *   ・TouchEvent の場合は touches[0] を使用
 *   ・座標変換は CoordinateManager に完全移譲
 *
 * @coordinate-contract
 *   ・画面座標→キャンバス座標の変換は CoordinateManager 経由
 *   ・DPR 補正は CoordinateManager 内で実行
 *   ・Container 変形は CoordinateManager が自動処理
 *
 * @input-validation
 *   ・event.clientX/Y が undefined の場合は処理を停止
 *   ・座標変換結果が NaN の場合は描画を中断
 *   ・Manager 未準備状態では描画を実行しない
 *
 * @error-handling
 *   throw: Manager未準備, 重大描画エラー
 *   warn: 座標変換失敗, RecordManager記録失敗（重要時のみ）
 *   log: 初期化完了, 重大エラー（最低限のみ）
 *
 * @state-management
 *   - 描画状態は必ず専用メソッド経由で変更
 *   - Manager準備状態と描画状態を分離管理
 *   - 異常終了からの自動回復機能
 *
 * @performance-notes
 *   座標変換高頻度処理最適化
 *   Graphics更新バッチ処理
 *   RecordManager記録遅延なし
 *   console.log削減による性能向上
 */

(function() {
    'use strict';

    /**
     * PenTool - PixiJS v8完全対応・原始イベント処理版
     */
    class PenTool extends window.Tegaki.AbstractTool {
        constructor() {
            super('pen');
            
            // ペンツール専用設定
            this.color = 0x800000;        // ふたばマルーン
            this.width = 2.0;             // ペン太さ
            this.opacity = 1.0;           // 不透明度
            
            // 描画状態管理（修正版）
            this.isDrawing = false;       // 描画中フラグ
            this.isRecording = false;     // 記録中フラグ
            this.outsideDrawing = false;  // 画面外描画フラグ
            
            // 描画データ
            this.currentStroke = null;    // 現在のストローク
            this.currentGraphics = null;  // 現在のGraphicsオブジェクト
            this.tempStrokeBuffer = [];   // 外部描画バッファ
            
            // 統計・デバッグ
            this.strokeCount = 0;
            this.lastDrawTime = 0;
            this.coordinateErrors = 0;
            this.recordingErrors = 0;
        }
        
        /**
         * Manager統一注入（修正版）
         */
        setManagersObject(managers) {
            // 親クラスのManager注入実行
            const parentResult = super.setManagersObject(managers);
            
            if (!parentResult) {
                console.error('❌ PenTool: 親クラスManager注入失敗');
                return false;
            }
            
            return true;
        }
        
        // ========================================
        // Tool状態管理（修正版）
        // ========================================
        
        /**
         * PenTool有効化
         */
        async activate() {
            try {
                // 親クラスのactivate実行
                await super.activate();
                
                // 描画状態完全リセット
                this.resetDrawingState();
                
            } catch (error) {
                console.error('❌ PenTool: activate() エラー:', error);
                throw error;
            }
        }
        
        /**
         * PenTool無効化
         */
        async deactivate() {
            try {
                // 進行中の描画強制終了
                if (this.isDrawing) {
                    this.forceEndDrawing();
                }
                
                // 親クラスのdeactivate実行
                await super.deactivate();
                
            } catch (error) {
                console.error('❌ PenTool: deactivate() エラー:', error);
            }
        }
        
        /**
         * 描画状態完全リセット（修正版）
         */
        resetDrawingState() {
            try {
                // 描画フラグリセット
                this.isDrawing = false;
                this.isRecording = false;
                this.outsideDrawing = false;
                
                // データクリア
                this.currentStroke = null;
                this.currentGraphics = null;
                this.tempStrokeBuffer = [];
                
            } catch (error) {
                console.error('❌ PenTool: 描画状態リセットエラー:', error);
            }
        }
        
        // ========================================
        // ポインタイベント処理（原始DOMイベント対応）
        // ========================================
        
        /**
         * ポインタダウン処理（原始DOMイベント対応）
         * 🔥 修正の核心：原始DOMイベントから直接 clientX/Y を取得
         */
        onPointerDown(event) {
            try {
                // アクティブ状態確認
                if (!this.isActive()) {
                    return;
                }
                
                // 既に描画中の場合は強制終了
                if (this.isDrawing) {
                    this.forceEndDrawing();
                }
                
                // 🔥 原始イベントから座標取得
                const clientX = this.getClientX(event);
                const clientY = this.getClientY(event);
                
                if (clientX === null || clientY === null) {
                    console.warn('⚠️ PenTool: クライアント座標取得失敗');
                    return;
                }
                
                // 座標変換
                const coords = this.convertClientCoordsToCanvas(clientX, clientY);
                if (!coords) {
                    console.warn('⚠️ PenTool: 座標変換失敗');
                    return;
                }
                
                // カメラ境界判定（Phase1.5では常にtrue）
                const inCamera = this.isInCameraBounds(coords);
                
                // 描画開始
                this.startDrawing(coords, inCamera);
                
            } catch (error) {
                console.error('❌ PenTool: onPointerDown() エラー:', error);
                this.forceEndDrawing();
            }
        }
        
        /**
         * ポインタムーブ処理（原始DOMイベント対応）
         */
        onPointerMove(event) {
            if (!this.isDrawing) {
                return; // 描画中でない場合はスキップ
            }
            
            try {
                // 🔥 原始イベントから座標取得
                const clientX = this.getClientX(event);
                const clientY = this.getClientY(event);
                
                if (clientX === null || clientY === null) {
                    return; // Move では警告せず静かにスキップ
                }
                
                // 座標変換
                const coords = this.convertClientCoordsToCanvas(clientX, clientY);
                if (!coords) {
                    return; // 変換失敗時も静かにスキップ
                }
                
                // 描画継続
                this.continueDrawing(coords);
                
            } catch (error) {
                console.error('❌ PenTool: onPointerMove() エラー:', error);
            }
        }
        
        /**
         * ポインタアップ処理（描画継続問題修正版）
         */
        onPointerUp(event) {
            try {
                // 🔥 重要：常に強制終了を実行（確実な描画停止）
                this.forceEndDrawing();
                
            } catch (error) {
                console.error('❌ PenTool: onPointerUp() エラー:', error);
                // エラー時も必ず描画状態リセット
                this.resetDrawingState();
            }
        }
        
        // ========================================
        // 座標取得・変換処理（原始イベント対応）
        // ========================================
        
        /**
         * 原始イベントから clientX を取得
         * PointerEvent/MouseEvent/TouchEvent 対応
         */
        getClientX(event) {
            if (!event) return null;
            
            // PointerEvent / MouseEvent
            if (typeof event.clientX === 'number') {
                return event.clientX;
            }
            
            // TouchEvent
            const touch = event.touches?.[0] || event.changedTouches?.[0];
            if (touch && typeof touch.clientX === 'number') {
                return touch.clientX;
            }
            
            return null;
        }
        
        /**
         * 原始イベントから clientY を取得
         * PointerEvent/MouseEvent/TouchEvent 対応
         */
        getClientY(event) {
            if (!event) return null;
            
            // PointerEvent / MouseEvent
            if (typeof event.clientY === 'number') {
                return event.clientY;
            }
            
            // TouchEvent
            const touch = event.touches?.[0] || event.changedTouches?.[0];
            if (touch && typeof touch.clientY === 'number') {
                return touch.clientY;
            }
            
            return null;
        }
        
        /**
         * クライアント座標をCanvas座標に変換（NaN問題修正版）
         */
        convertClientCoordsToCanvas(clientX, clientY) {
            try {
                // CoordinateManager取得
                const coordinateManager = this.getCoordinateManager();
                if (!coordinateManager) {
                    this.coordinateErrors++;
                    return null;
                }
                
                // CoordinateManager準備確認
                if (!coordinateManager.isReady()) {
                    this.coordinateErrors++;
                    return null;
                }
                
                // 座標変換実行
                const coords = coordinateManager.toCanvasCoords(clientX, clientY);
                
                // 結果検証（NaN防止）
                if (!coords || !Number.isFinite(coords.x) || !Number.isFinite(coords.y)) {
                    this.coordinateErrors++;
                    return null;
                }
                
                return coords;
                
            } catch (error) {
                console.error('❌ 座標変換エラー:', error);
                this.coordinateErrors++;
                return null;
            }
        }
        
        /**
         * カメラ境界内判定（Phase1.5では常にtrue）
         */
        isInCameraBounds(coords) {
            // Phase1.5では全描画域がカメラ内
            return coords && Number.isFinite(coords.x) && Number.isFinite(coords.y);
        }
        
        // ========================================
        // 描画処理（PixiJS v8対応）
        // ========================================
        
        /**
         * 描画開始（RecordManager問題修正版）
         */
        startDrawing(coords, inCamera) {
            try {
                // 描画状態設定
                this.isDrawing = true;
                this.outsideDrawing = !inCamera;
                
                // ストローク初期化
                this.currentStroke = {
                    id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    points: [{ x: coords.x, y: coords.y, time: 0, pressure: 0.5 }],
                    started: Date.now(),
                    tool: 'pen',
                    color: this.color,
                    width: this.width,
                    opacity: this.opacity
                };
                
                if (inCamera) {
                    // カメラ内描画：Graphics作成・RecordManager記録開始
                    this.startRecording();
                    this.createGraphics();
                } else {
                    // カメラ外描画：バッファに蓄積
                    this.tempStrokeBuffer = [coords];
                }
                
            } catch (error) {
                console.error('❌ 描画開始エラー:', error);
                this.resetDrawingState();
            }
        }
        
        /**
         * RecordManager記録開始（修正版・準備状態確認強化）
         */
        startRecording() {
            try {
                const recordManager = this.getRecordManager();
                if (!recordManager) {
                    return;
                }
                
                // RecordManager準備状態確認（修正版）
                if (!recordManager.isReady()) {
                    this.recordingErrors++;
                    return;
                }
                
                // 記録開始（互換性維持）
                const operation = recordManager.startOperation('stroke', this.currentStroke.points);
                if (operation) {
                    this.isRecording = true;
                }
                
            } catch (error) {
                console.error('❌ RecordManager記録開始エラー:', error);
                this.recordingErrors++;
            }
        }
        
        /**
         * Graphics作成・初期描画（PixiJS v8対応）
         * 🔥 修正の核心：v8では文字列を使用
         */
        createGraphics() {
            try {
                const drawContainer = this.getDrawContainer();
                if (!drawContainer) {
                    return;
                }
                
                // Graphics作成（PIXI v8準拠）
                this.currentGraphics = new PIXI.Graphics();
                
                // 🔥 v8では文字列を使用（定数は廃止）
                this.currentGraphics.lineStyle({
                    width: this.width,
                    color: this.color,
                    alpha: this.opacity,
                    cap: 'round',     // v8: 文字列使用
                    join: 'round'     // v8: 文字列使用
                });
                
                // 開始点設定
                const startPoint = this.currentStroke.points[0];
                this.currentGraphics.moveTo(startPoint.x, startPoint.y);
                
                // Container追加（v8では必須）
                drawContainer.addChild(this.currentGraphics);
                
            } catch (error) {
                console.error('❌ Graphics作成エラー:', error);
            }
        }
        
        /**
         * 描画継続処理
         */
        continueDrawing(coords) {
            try {
                if (!this.currentStroke) {
                    return;
                }
                
                // 座標をストロークに追加
                const point = {
                    x: coords.x,
                    y: coords.y,
                    time: Date.now() - this.currentStroke.started,
                    pressure: 0.5
                };
                
                this.currentStroke.points.push(point);
                
                // Graphics更新
                if (this.currentGraphics && this.isRecording) {
                    this.currentGraphics.lineTo(coords.x, coords.y);
                }
                
                // RecordManager座標追加
                if (this.isRecording) {
                    const recordManager = this.getRecordManager();
                    if (recordManager && recordManager.isReady()) {
                        recordManager.addPoint(point);
                    }
                }
                
                // 外部バッファ管理
                if (this.outsideDrawing) {
                    this.tempStrokeBuffer.push(coords);
                    
                    // カメラ内侵入チェック（Phase1.5では省略）
                    const inCamera = this.isInCameraBounds(coords);
                    if (inCamera && !this.isRecording) {
                        this.startRecording();
                        this.createGraphics();
                        this.outsideDrawing = false;
                    }
                }
                
            } catch (error) {
                console.error('❌ 描画継続エラー:', error);
            }
        }
        
        /**
         * 描画終了処理（RecordManager記録完了）
         */
        endDrawing() {
            try {
                if (!this.currentStroke) {
                    return;
                }
                
                // ストローク完成
                this.currentStroke.ended = Date.now();
                this.currentStroke.duration = this.currentStroke.ended - this.currentStroke.started;
                
                // RecordManager記録完了
                if (this.isRecording) {
                    const recordManager = this.getRecordManager();
                    if (recordManager && recordManager.isReady()) {
                        recordManager.endOperation({
                            tool: 'pen',
                            color: this.color,
                            width: this.width
                        });
                    }
                }
                
                // 統計更新
                this.strokeCount++;
                this.lastDrawTime = Date.now();
                
            } catch (error) {
                console.error('❌ 描画終了エラー:', error);
            }
        }
        
        /**
         * 強制描画終了処理（描画継続問題修正の核心）
         */
        forceEndDrawing() {
            try {
                // 記録中の場合は終了処理実行
                if (this.isDrawing && this.currentStroke) {
                    this.endDrawing();
                }
                
                // 状態完全リセット（確実な停止保証）
                this.resetDrawingState();
                
            } catch (error) {
                console.error('❌ PenTool: 強制描画終了エラー:', error);
                // エラー時も状態リセット実行
                this.resetDrawingState();
            }
        }
        
        // ========================================
        // 状態取得・デバッグ機能
        // ========================================
        
        /**
         * 現在のストローク取得
         */
        getCurrentStroke() {
            return this.currentStroke;
        }
        
        /**
         * PenTool専用デバッグ情報取得
         */
        getDebugInfo() {
            const baseInfo = super.getDebugInfo();
            
            return {
                ...baseInfo,
                toolSpecific: {
                    className: 'PenTool',
                    version: 'v8-complete-fix',
                    settings: {
                        color: `#${this.color.toString(16).padStart(6, '0')}`,
                        width: this.width,
                        opacity: this.opacity
                    },
                    drawing: {
                        isDrawing: this.isDrawing,
                        isRecording: this.isRecording,
                        outsideDrawing: this.outsideDrawing,
                        currentStrokePoints: this.currentStroke?.points?.length || 0,
                        tempBufferSize: this.tempStrokeBuffer.length
                    },
                    statistics: {
                        strokeCount: this.strokeCount,
                        lastDrawTime: this.lastDrawTime,
                        coordinateErrors: this.coordinateErrors,
                        recordingErrors: this.recordingErrors
                    },
                    graphics: {
                        currentGraphicsExists: !!this.currentGraphics,
                        drawContainerExists: !!this.getDrawContainer()
                    }
                }
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.PenTool = PenTool;

})();