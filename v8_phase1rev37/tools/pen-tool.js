/**
 * 📄 FILE: tools/pen-tool.js
 * 📌 RESPONSIBILITY: ペンツール・描画機能・座標変換・RecordManager問題修正版
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
 *   🚫 未実装メソッド呼び出し禁止
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
 *   ToolManager → PenTool.activate → PointerEvent → toCanvasCoords → Graphics描画 → RecordManager記録
 *
 * @method-naming-rules
 *   イベント系: onPointerXxx()
 *   描画系: startDrawing(), continueDrawing(), endDrawing()
 *   状態系: resetDrawingState(), forceEndDrawing()
 *   取得系: getCurrentStroke(), getDebugInfo()
 *
 * @error-handling
 *   throw: Manager未準備, 重大描画エラー
 *   warn: 座標変換失敗, RecordManager記録失敗
 *   log: 正常描画処理, 状態変更
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
 */

(function() {
    'use strict';

    /**
     * PenTool - 座標変換・RecordManager問題修正版
     * NaN座標問題解決・Manager準備状態確認強化・描画継続問題修正
     */
    class PenTool extends window.Tegaki.AbstractTool {
        constructor() {
            super('pen');
            
            console.log('🖊️ PenTool v8.12.0 最終修正版 作成開始');
            
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
            
            console.log('✅ PenTool Manager統一注入完了');
        }
        
        /**
         * Manager統一注入（修正版・座標変換準備確認）
         */
        setManagersObject(managers) {
            console.log('🔧 PenTool Manager注入開始');
            
            // 親クラスのManager注入実行
            const parentResult = super.setManagersObject(managers);
            
            if (!parentResult) {
                console.error('❌ PenTool: 親クラスManager注入失敗');
                return false;
            }
            
            console.log('🔍 PenTool: Manager準備状態確認:', this.getDebugInfo().managers);
            console.log('✅ PenTool: Manager統一注入完了（修正版）');
            
            return true;
        }
        
        // ========================================
        // Tool状態管理（修正版）
        // ========================================
        
        /**
         * PenTool有効化
         */
        async activate() {
            console.log('🎯 PenTool: アクティブ化開始');
            
            try {
                // 親クラスのactivate実行
                await super.activate();
                
                // 描画状態完全リセット
                this.resetDrawingState();
                
                console.log('✅ PenTool: アクティブ化完了');
                
            } catch (error) {
                console.error('❌ PenTool: activate() エラー:', error);
                throw error;
            }
        }
        
        /**
         * PenTool無効化
         */
        async deactivate() {
            console.log('🔄 PenTool: 非アクティブ化開始');
            
            try {
                // 進行中の描画強制終了
                if (this.isDrawing) {
                    this.forceEndDrawing();
                }
                
                // 親クラスのdeactivate実行
                await super.deactivate();
                
                console.log('✅ PenTool: 非アクティブ化完了');
                
            } catch (error) {
                console.error('❌ PenTool: deactivate() エラー:', error);
            }
        }
        
        /**
         * 描画状態完全リセット（修正版）
         */
        resetDrawingState() {
            console.log('🔄 PenTool: 描画状態完全リセット');
            
            try {
                // 描画フラグリセット
                this.isDrawing = false;
                this.isRecording = false;
                this.outsideDrawing = false;
                
                // データクリア
                this.currentStroke = null;
                this.currentGraphics = null;
                this.tempStrokeBuffer = [];
                
                console.log('✅ PenTool: 描画状態リセット完了');
                
            } catch (error) {
                console.error('❌ PenTool: 描画状態リセットエラー:', error);
            }
        }
        
        // ========================================
        // ポインタイベント処理（修正版）
        // ========================================
        
        /**
         * ポインタダウン処理（座標変換・RecordManager問題修正版）
         */
        onPointerDown(event) {
            console.log('🖊️ PenTool: onPointerDown() 開始');
            
            try {
                // アクティブ状態確認
                if (!this.isActive()) {
                    console.warn('⚠️ PenTool: 非アクティブ状態 - 描画無効');
                    return;
                }
                
                // 既に描画中の場合は強制終了
                if (this.isDrawing) {
                    console.warn('⚠️ PenTool: 既に描画中 - 強制終了して新規開始');
                    this.forceEndDrawing();
                }
                
                // 座標変換（NaN問題修正版）
                const coords = this.convertEventToCoords(event);
                if (!coords) {
                    console.error('❌ PenTool: 座標変換失敗 - 描画中断');
                    return;
                }
                
                console.log('📍 変換座標:', coords);
                
                // カメラ境界判定（Phase1.5では常にtrue）
                const inCamera = this.isInCameraBounds(coords);
                console.log('🎯 カメラ内判定:', inCamera);
                
                // 描画開始
                this.startDrawing(coords, inCamera);
                
                console.log(`✅ PenTool: onPointerDown() 完了 - isDrawing: ${this.isDrawing} isRecording: ${this.isRecording} outsideDrawing: ${this.outsideDrawing}`);
                
            } catch (error) {
                console.error('❌ PenTool: onPointerDown() エラー:', error);
                this.forceEndDrawing();
            }
        }
        
        /**
         * ポインタムーブ処理（修正版）
         */
        onPointerMove(event) {
            if (!this.isDrawing) {
                return; // 描画中でない場合はスキップ
            }
            
            try {
                // 座標変換
                const coords = this.convertEventToCoords(event);
                if (!coords) {
                    console.warn('⚠️ PenTool: onPointerMove座標変換失敗 - スキップ');
                    return;
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
            console.log(`🖊️ PenTool: onPointerUp() 開始 - isDrawing: ${this.isDrawing} isRecording: ${this.isRecording}`);
            
            try {
                // 描画中でない場合も強制終了実行（安全性確保）
                this.forceEndDrawing();
                
                console.log('✅ PenTool: onPointerUp() 完了 - 描画状態リセット完了');
                
            } catch (error) {
                console.error('❌ PenTool: onPointerUp() エラー:', error);
                // エラー時も必ず描画状態リセット
                this.resetDrawingState();
            }
        }
        
        // ========================================
        // 座標変換・境界判定（修正版）
        // ========================================
        
        /**
         * イベント座標をCanvas座標に変換（NaN問題修正版）
         * 
         * @param {PointerEvent} event - ポインタイベント
         * @returns {{x: number, y: number}|null} 変換座標（失敗時null）
         */
        convertEventToCoords(event) {
            try {
                // CoordinateManager取得
                const coordinateManager = this.getCoordinateManager();
                if (!coordinateManager) {
                    console.warn('⚠️ CoordinateManager未準備');
                    this.coordinateErrors++;
                    return null;
                }
                
                // CoordinateManager準備確認
                if (!coordinateManager.isReady()) {
                    console.warn('⚠️ CoordinateManager not ready');
                    this.coordinateErrors++;
                    return null;
                }
                
                // クライアント座標取得・検証
                const clientX = event.clientX;
                const clientY = event.clientY;
                
                if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
                    console.warn(`⚠️ 無効なクライアント座標: x=${clientX}, y=${clientY}`);
                    this.coordinateErrors++;
                    return null;
                }
                
                // 座標変換実行
                const coords = coordinateManager.toCanvasCoords(clientX, clientY);
                
                // 結果検証（NaN防止）
                if (!coords || !Number.isFinite(coords.x) || !Number.isFinite(coords.y)) {
                    console.warn(`⚠️ 座標変換結果NaN: x=${coords?.x}, y=${coords?.y}`);
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
         * 
         * @param {{x: number, y: number}} coords - 座標
         * @returns {boolean} 境界内フラグ
         */
        isInCameraBounds(coords) {
            // Phase1.5では全描画域がカメラ内
            return coords && Number.isFinite(coords.x) && Number.isFinite(coords.y);
        }
        
        // ========================================
        // 描画処理（修正版）
        // ========================================
        
        /**
         * 描画開始（RecordManager問題修正版）
         * 
         * @param {{x: number, y: number}} coords - 開始座標
         * @param {boolean} inCamera - カメラ内フラグ
         */
        startDrawing(coords, inCamera) {
            console.log('🚀 PenTool: 描画開始処理');
            
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
                
                console.log(`✅ ストローク初期化完了: ${this.currentStroke.id}`);
                
                if (inCamera) {
                    // カメラ内描画：Graphics作成・RecordManager記録開始
                    this.startRecording();
                    this.createGraphics();
                } else {
                    // カメラ外描画：バッファに蓄積
                    this.tempStrokeBuffer = [coords];
                    console.log('📦 外部描画バッファ開始');
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
            console.log('🎬 PenTool: RecordManager記録開始');
            
            try {
                const recordManager = this.getRecordManager();
                if (!recordManager) {
                    console.warn('⚠️ RecordManager未取得');
                    return;
                }
                
                // RecordManager準備状態確認（修正版）
                if (!recordManager.isReady()) {
                    console.warn('❌ RecordManager not ready');
                    this.recordingErrors++;
                    return;
                }
                
                // 記録開始（互換性維持）
                const operation = recordManager.startOperation('stroke', this.currentStroke.points);
                if (operation) {
                    this.isRecording = true;
                    console.log(`✅ RecordManager記録開始: ${operation.id}`);
                } else {
                    console.warn('⚠️ RecordManager startOperation失敗');
                }
                
            } catch (error) {
                console.error('❌ RecordManager記録開始エラー:', error);
                this.recordingErrors++;
            }
        }
        
        /**
         * Graphics作成・初期描画
         */
        createGraphics() {
            console.log('🎨 PenTool: Graphics作成開始');
            
            try {
                const drawContainer = this.getDrawContainer();
                if (!drawContainer) {
                    console.warn('⚠️ DrawContainer未取得');
                    return;
                }
                
                // Graphics作成（PIXI v8準拠）
                this.currentGraphics = new PIXI.Graphics();
                this.currentGraphics.lineStyle({
                    width: this.width,
                    color: this.color,
                    alpha: this.opacity,
                    cap: PIXI.LINE_CAP.ROUND,
                    join: PIXI.LINE_JOIN.ROUND
                });
                
                // 開始点設定
                const startPoint = this.currentStroke.points[0];
                this.currentGraphics.moveTo(startPoint.x, startPoint.y);
                
                // Container追加（v8では必須）
                drawContainer.addChild(this.currentGraphics);
                
                console.log('✅ Graphics作成・Container追加完了');
                
            } catch (error) {
                console.error('❌ Graphics作成エラー:', error);
            }
        }
        
        /**
         * 描画継続処理
         * 
         * @param {{x: number, y: number}} coords - 座標
         */
        continueDrawing(coords) {
            try {
                if (!this.currentStroke) {
                    console.warn('⚠️ currentStroke未初期化');
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
                        console.log('📦 外部→内部描画切り替え');
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
            console.log('🏁 PenTool: 描画終了処理');
            
            try {
                if (!this.currentStroke) {
                    console.warn('⚠️ currentStroke未初期化');
                    return;
                }
                
                // ストローク完成
                this.currentStroke.ended = Date.now();
                this.currentStroke.duration = this.currentStroke.ended - this.currentStroke.started;
                
                // RecordManager記録完了
                if (this.isRecording) {
                    const recordManager = this.getRecordManager();
                    if (recordManager && recordManager.isReady()) {
                        const result = recordManager.endOperation({
                            tool: 'pen',
                            color: this.color,
                            width: this.width
                        });
                        
                        if (result) {
                            console.log(`✅ RecordManager記録完了: ${result.id}`);
                        }
                    }
                }
                
                // 統計更新
                this.strokeCount++;
                this.lastDrawTime = Date.now();
                
                console.log(`✅ 描画終了完了 - ストローク数: ${this.strokeCount}`);
                
            } catch (error) {
                console.error('❌ 描画終了エラー:', error);
            }
        }
        
        /**
         * 強制描画終了処理（描画継続問題修正の核心）
         */
        forceEndDrawing() {
            console.log('🔚 PenTool: 強制描画終了処理開始');
            
            try {
                // 記録中の場合は終了処理実行
                if (this.isDrawing && this.currentStroke) {
                    this.endDrawing();
                }
                
                // 状態完全リセット（確実な停止保証）
                this.resetDrawingState();
                
                console.log('✅ PenTool: 強制描画終了処理完了');
                
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
         * 
         * @returns {Object|null} 現在のストローク
         */
        getCurrentStroke() {
            return this.currentStroke;
        }
        
        /**
         * PenTool専用デバッグ情報取得
         * 
         * @returns {Object} 詳細デバッグ情報
         */
        getDebugInfo() {
            const baseInfo = super.getDebugInfo();
            
            return {
                ...baseInfo,
                toolSpecific: {
                    className: 'PenTool',
                    version: 'v8-coordinate-record-fix',
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

    console.log('🖊️ PenTool 座標変換・RecordManager問題修正版 Loaded - NaN座標防止・Manager準備確認強化・描画継続問題完全修正');

})();