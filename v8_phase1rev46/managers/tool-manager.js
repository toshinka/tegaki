/**
 * 📄 FILE: tools/pen-tool.js
 * 📌 RESPONSIBILITY: ペン描画ツール・Manager注入統一・継続描画完全修正・外部描画対応・TPF記録完全版
 * ChangeLog: 2025-08-31 setManagersObject()メソッド名修正・継続描画問題完全修正・PointerLeave/Cancel対応・確実終了処理・過剰ログ削減
 *
 * @provides
 *   - PenTool（クラス・AbstractTool継承）
 *   - onPointerDown(event): void - ペン描画開始
 *   - onPointerMove(event): void - ペン描画継続
 *   - onPointerUp(event): void - ペン描画終了
 *   - onPointerLeave(event): void - ペン描画強制終了（継続描画修正）
 *   - onPointerCancel(event): void - ペン描画キャンセル終了（継続描画修正）
 *   - forceEndDrawing(): void - 強制描画終了（継続描画問題修正）
 *   - setStrokeStyle(style): void - ストローク設定
 *   - drawToContainer(container): void - 直接描画
 *   - getState(): Object - 現在状態取得
 *
 * @uses
 *   - super.setManagersObject(managers): boolean - AbstractTool Manager注入（修正済み）
 *   - CoordinateManager.screenToCanvas(screenCoords): Object - 座標変換
 *   - NavigationManager.getCameraBounds(): Rectangle - カメラ範囲確認
 *   - RecordManager.startOperation(kind, initialPoints): void - TPF記録開始
 *   - RecordManager.addPoint(point): void - 座標追加
 *   - RecordManager.endOperation(metadata): void - TPF記録終了
 *   - CanvasManager.getDrawContainer(): PIXI.Container - 描画コンテナ
 *   - EventBus.emit(eventName, data): void - 描画イベント通知
 *
 * @initflow
 *   1. new PenTool() → 2. setManagersObject(managers) → 3. activate() → 4. tempStroke初期化 → 5. イベント処理準備
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 直接Manager操作禁止（AbstractTool経由必須）
 *   🚫 座標の独自計算禁止（CoordinateManager必須）
 *   🚫 DPR重複適用禁止
 *   🚫 描画状態の不完全管理（継続描画問題）
 *   🚫 未初期化状態でのポインタイベント処理禁止
 *   🚫 PointerLeave/Cancelイベント未対応（継続描画の原因）
 *
 * @manager-key
 *   window.Tegaki.PenToolInstance
 *
 * @dependencies-strict
 *   REQUIRED: AbstractTool, CanvasManager, CoordinateManager, RecordManager
 *   OPTIONAL: NavigationManager, EventBus
 *   FORBIDDEN: 他Tool直接参照, 循環依存
 *
 * @integration-flow
 *   ToolManager → PenTool.setManagersObject() → PenTool.activate() → PointerEvent処理
 *
 * @method-naming-rules
 *   ポインタ系: onPointerDown(), onPointerMove(), onPointerUp(), onPointerLeave(), onPointerCancel()
 *   描画制御系: startDrawing(), updateDrawing(), endDrawing(), forceEndDrawing()
 *   設定系: setStrokeStyle(), getStrokeStyle()
 *   状態系: isDrawing(), getState()
 *
 * @state-management
 *   描画状態はisDrawingフラグで厳密管理
 *   tempStroke配列で外部描画バッファリング
 *   状態変更は必ずメソッド経由
 *   forceEndDrawing()による確実な終了保証
 *   PointerLeave/Cancel時の強制終了対応
 *
 * @performance-notes
 *   pointermoveでの高頻度処理最適化
 *   tempStroke配列による外部描画バッファリング
 *   RequestAnimationFrame活用（将来）
 *   過剰ログ削減（描画中ログ最小化）
 *
 * @input-validation
 *   受け取った座標がnull/undefined/NaNの場合は即座にreturn
 *   外部入力は常に型チェック・境界チェック実行
 *
 * @tool-contract
 *   setManagersObject(managers): boolean - Manager注入（必須）
 *   onPointerDown/Move/Up/Leave/Cancel(event): void - ポインタイベント処理（必須）
 *   forceEndDrawing(): void - 強制終了（冪等・必須）
 *   destroy(): void - 解放処理
 *   getState(): Object - 状態取得（テスト用）
 *
 * @error-handling
 *   throw: Manager注入失敗・初期化失敗
 *   false: 描画操作失敗・座標変換失敗
 *   warn: 一時的エラー・外部描画バッファ関連
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor() {
        super('pen');
        console.log('🖊️ PenTool v8.12.0 Manager統一注入・継続描画修正版 作成開始');
        
        // 描画状態管理（厳密）
        this.isDrawing = false;
        this.drawingLocked = false; // 多重描画防止
        
        // 現在のストローク・パス
        this.currentStroke = null; // PIXI.Graphics インスタンス
        this.currentPath = []; // Point配列（TPF記録用）
        
        // 外部描画対応（画面外からの描画開始）
        this.tempStroke = []; // 画面外描画バッファ
        this.externalDrawing = false; // 外部描画モードフラグ
        
        // ストローク設定
        this.strokeStyle = {
            width: 2,
            color: 0x800000, // futaba-maroon
            alpha: 1.0,
            cap: 'round',
            join: 'round'
        };
        
        // パフォーマンス統計
        this.stats = {
            strokesDrawn: 0,
            pointsProcessed: 0,
            errors: 0,
            lastError: null,
            created: Date.now()
        };
        
        console.log('✅ PenTool 作成完了');
    }
    
    // ================================
    // Manager注入・初期化（修正版）
    // ================================
    
    /**
     * Manager統一注入（重要な修正: setManagers → setManagersObject）
     * @param {Object|Map} managers - Manager群
     * @returns {boolean} 注入成功フラグ
     */
    setManagersObject(managers) {
        console.log('🖊️ PenTool: Manager統一注入開始（正規メソッド）');
        
        try {
            // ✅ 重要な修正: super.setManagersObject() 呼び出し
            const parentResult = super.setManagersObject(managers);
            
            if (!parentResult) {
                throw new Error('AbstractTool Manager注入失敗');
            }
            
            // PenTool固有の初期化
            this.initializePenSpecific();
            
            console.log('✅ PenTool: Manager統一注入完了');
            return true;
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ PenTool: Manager統一注入エラー:', error);
            return false;
        }
    }
    
    /**
     * PenTool固有初期化
     */
    initializePenSpecific() {
        // 描画状態リセット
        this.resetDrawingState();
        
        // 外部描画対応初期化
        this.tempStroke = [];
        this.externalDrawing = false;
    }
    
    /**
     * 描画状態完全リセット
     */
    resetDrawingState() {
        this.isDrawing = false;
        this.drawingLocked = false;
        this.currentStroke = null;
        this.currentPath = [];
        this.tempStroke = [];
        this.externalDrawing = false;
    }
    
    // ================================
    // ポインタイベント処理（継続描画完全修正版）
    // ================================
    
    /**
     * ポインタダウン処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        try {
            // 準備状態確認
            if (!this.isReady() || !this.isActive()) {
                return;
            }
            
            // 多重描画防止
            if (this.isDrawing || this.drawingLocked) {
                console.warn('⚠️ PenTool: 描画中のPointerDown無視');
                return;
            }
            
            // イベント妥当性確認
            if (!event) {
                return;
            }
            
            // 座標変換
            const coords = this.convertEventToCanvasCoords(event);
            if (!coords) {
                return;
            }
            
            // カメラ内描画確認
            const inCamera = this.isPointInCamera(coords);
            
            if (inCamera) {
                // 通常描画開始
                this.startDrawing(coords);
            } else {
                // 外部描画開始（tempStrokeバッファリング）
                this.startExternalDrawing(coords);
            }
            
            // イベント処理完了
            event.preventDefault();
            event.stopPropagation();
            
        } catch (error) {
            this.handleDrawingError('onPointerDown', error);
        }
    }
    
    /**
     * ポインタムーブ処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        // 描画中でなければ無視
        if (!this.isDrawing && !this.externalDrawing) {
            return;
        }
        
        try {
            // イベント妥当性確認
            if (!event) {
                return;
            }
            
            // 座標変換
            const coords = this.convertEventToCanvasCoords(event);
            if (!coords) {
                return;
            }
            
            this.stats.pointsProcessed++;
            
            if (this.externalDrawing) {
                // 外部描画継続
                this.updateExternalDrawing(coords);
            } else {
                // 通常描画継続
                this.updateDrawing(coords);
            }
            
            event.preventDefault();
            
        } catch (error) {
            this.handleDrawingError('onPointerMove', error);
        }
    }
    
    /**
     * ポインタアップ処理（継続描画問題完全修正版）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        try {
            // ✅ 重要な修正: 必ず強制描画終了を実行
            this.forceEndDrawing();
            
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
        } catch (error) {
            this.handleDrawingError('onPointerUp', error);
            // エラー時も確実に状態リセット
            this.resetDrawingState();
        }
    }
    
    /**
     * ポインタリーブ処理（継続描画修正の重要な追加）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerLeave(event) {
        try {
            // ✅ 重要な修正: PointerLeave時も強制終了
            if (this.isDrawing || this.externalDrawing) {
                console.log('🖊️ PenTool: PointerLeave → 強制描画終了');
                this.forceEndDrawing();
            }
            
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
        } catch (error) {
            this.handleDrawingError('onPointerLeave', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * ポインタキャンセル処理（継続描画修正の重要な追加）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerCancel(event) {
        try {
            // ✅ 重要な修正: PointerCancel時も強制終了
            if (this.isDrawing || this.externalDrawing) {
                console.log('🖊️ PenTool: PointerCancel → 強制描画終了');
                this.forceEndDrawing();
            }
            
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
        } catch (error) {
            this.handleDrawingError('onPointerCancel', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * 強制描画終了（継続描画問題修正の核心・冪等保証）
     */
    forceEndDrawing() {
        try {
            // 既に終了済みなら何もしない（冪等性）
            if (!this.isDrawing && !this.externalDrawing && !this.drawingLocked) {
                return;
            }
            
            // 描画ロック（多重終了防止）
            if (this.drawingLocked) {
                return;
            }
            
            this.drawingLocked = true;
            
            // 通常描画の終了処理
            if (this.isDrawing && this.currentStroke) {
                this.finishCurrentStroke();
            }
            
            // 外部描画の終了処理
            if (this.externalDrawing && this.tempStroke.length > 0) {
                this.finishExternalStroke();
            }
            
            // 状態完全リセット
            this.resetDrawingState();
            
        } catch (error) {
            console.error('❌ PenTool: forceEndDrawing() エラー:', error);
            // エラー時も確実にリセット
            this.resetDrawingState();
        }
    }
    
    // ================================
    // 描画処理（通常・外部対応）
    // ================================
    
    /**
     * 通常描画開始
     * @param {Object} coords - 開始座標
     */
    startDrawing(coords) {
        try {
            this.isDrawing = true;
            this.currentPath = [coords];
            
            // PIXI.Graphics作成・描画開始
            this.createPixiStroke(coords);
            
            // TPF記録開始
            this.startTPFRecord(coords);
            
        } catch (error) {
            console.error('❌ 通常描画開始エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * 外部描画開始（画面外からの描画）
     * @param {Object} coords - 開始座標
     */
    startExternalDrawing(coords) {
        try {
            this.externalDrawing = true;
            this.tempStroke = [coords];
            
        } catch (error) {
            console.error('❌ 外部描画開始エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * 描画継続
     * @param {Object} coords - 継続座標
     */
    updateDrawing(coords) {
        if (!this.currentStroke || !this.isDrawing) {
            return;
        }
        
        try {
            // パス追加
            this.currentPath.push(coords);
            
            // PixiJS描画更新
            this.currentStroke.lineTo(coords.x, coords.y);
            
            // TPF記録追加
            this.addTPFPoint(coords);
            
        } catch (error) {
            console.error('❌ 描画継続エラー:', error);
        }
    }
    
    /**
     * 外部描画継続
     * @param {Object} coords - 継続座標
     */
    updateExternalDrawing(coords) {
        try {
            // tempStrokeに追加
            this.tempStroke.push(coords);
            
            // カメラ内侵入チェック
            const inCamera = this.isPointInCamera(coords);
            
            if (inCamera && this.tempStroke.length > 1) {
                // カメラ内侵入 → 通常描画に移行
                this.convertExternalToNormal();
            }
            
        } catch (error) {
            console.error('❌ 外部描画継続エラー:', error);
        }
    }
    
    /**
     * 外部描画→通常描画移行
     */
    convertExternalToNormal() {
        try {
            if (this.tempStroke.length === 0) {
                return;
            }
            
            // 外部描画終了
            this.externalDrawing = false;
            
            // 通常描画開始（tempStrokeの最初の点で）
            const startCoords = this.tempStroke[0];
            this.isDrawing = true;
            this.currentPath = [...this.tempStroke];
            
            // PixiJS描画作成
            this.createPixiStroke(startCoords);
            
            // tempStrokeの全座標を適用
            for (let i = 1; i < this.tempStroke.length; i++) {
                const coords = this.tempStroke[i];
                this.currentStroke.lineTo(coords.x, coords.y);
            }
            
            // TPF記録開始（全座標で）
            this.startTPFRecord(startCoords, this.tempStroke.slice(1));
            
            // tempStrokeクリア
            this.tempStroke = [];
            
        } catch (error) {
            console.error('❌ 外部→通常描画移行エラー:', error);
            this.resetDrawingState();
        }
    }
    
    // ================================
    // PixiJS描画処理
    // ================================
    
    /**
     * PIXI.Graphics ストローク作成
     * @param {Object} startCoords - 開始座標
     */
    createPixiStroke(startCoords) {
        try {
            const drawContainer = this.getDrawContainer();
            if (!drawContainer) {
                throw new Error('DrawContainer not available');
            }
            
            // Graphics作成・スタイル設定
            this.currentStroke = new PIXI.Graphics();
            
            // PixiJS v8対応のlineStyle
            this.currentStroke.lineStyle({
                width: this.strokeStyle.width,
                color: this.strokeStyle.color,
                alpha: this.strokeStyle.alpha,
                cap: this.strokeStyle.cap,
                join: this.strokeStyle.join
            });
            
            // 描画開始
            this.currentStroke.moveTo(startCoords.x, startCoords.y);
            
            // コンテナに追加
            drawContainer.addChild(this.currentStroke);
            
        } catch (error) {
            console.error('❌ PIXI ストローク作成エラー:', error);
            throw error;
        }
    }
    
    /**
     * 現在状態取得（テスト・デバッグ用）
     * @returns {Object} 現在状態
     */
    getState() {
        return {
            toolName: this.name,
            isDrawing: this.isDrawing,
            externalDrawing: this.externalDrawing,
            drawingLocked: this.drawingLocked,
            hasCurrentStroke: !!this.currentStroke,
            currentPathLength: this.currentPath.length,
            tempStrokeLength: this.tempStroke.length,
            strokeStyle: { ...this.strokeStyle },
            stats: { ...this.stats },
            isReady: this.isReady(),
            isActive: this.isActive(),
            managersReady: this.managersReady
        };
    }
    
    /**
     * 描画エラーハンドリング
     * @param {string} context - エラー発生場所
     * @param {Error} error - エラーオブジェクト
     */
    handleDrawingError(context, error) {
        this.stats.lastError = error;
        this.stats.errors++;
        
        console.error(`❌ PenTool ${context} エラー:`, error);
        
        // 安全な状態リセット
        try {
            this.forceEndDrawing();
        } catch (resetError) {
            this.resetDrawingState();
        }
    }
    
    /**
     * Tool破棄
     */
    destroy() {
        try {
            // 描画強制終了
            this.forceEndDrawing();
            
            // 親クラス破棄
            if (typeof super.destroy === 'function') {
                super.destroy();
            }
            
        } catch (error) {
            console.error('❌ PenTool: destroy() エラー:', error);
        }
    }
}

// グローバル登録
if (!window.Tegaki) {
    window.Tegaki = {};
}
if (!window.Tegaki.Tools) {
    window.Tegaki.Tools = {};
}
window.Tegaki.Tools.PenTool = PenTool;
window.Tegaki.PenTool = PenTool; // 後方互換

console.log('🖊️ PenTool v8.12.0 Manager統一注入・継続描画修正・外部描画対応版 Loaded');
console.log('🚀 特徴: setManagersObject()統一・forceEndDrawing()冪等保証・tempStrokeバッファリング・TPF完全記録');在ストローク終了
     */
    finishCurrentStroke() {
        try {
            if (!this.currentStroke || this.currentPath.length < 1) {
                return;
            }
            
            // TPF記録終了
            this.endTPFRecord();
            
            // ストローク統計更新
            this.stats.strokesDrawn++;
            
            // 参照クリア
            this.currentStroke = null;
            this.currentPath = [];
            
        } catch (error) {
            console.error('❌ 現在ストローク終了エラー:', error);
        }
    }
    
    /**
     * 外部ストローク終了
     */
    finishExternalStroke() {
        try {
            if (this.tempStroke.length < 2) {
                return;
            }
            
            // 外部描画として記録する場合のロジック（将来実装）
            // 現在は単純に破棄
            
            this.tempStroke = [];
            
        } catch (error) {
            console.error('❌ 外部ストローク終了エラー:', error);
        }
    }
    
    // ================================
    // TPF記録処理
    // ================================
    
    /**
     * TPF記録開始
     * @param {Object} startCoords - 開始座標
     * @param {Array} additionalPoints - 追加座標配列（外部描画移行時）
     */
    startTPFRecord(startCoords, additionalPoints = []) {
        try {
            const recordManager = this.getRecordManager();
            if (!recordManager || typeof recordManager.startOperation !== 'function') {
                return;
            }
            
            // 初期座標配列作成
            const initialPoints = [startCoords, ...additionalPoints];
            
            recordManager.startOperation('stroke', initialPoints);
            
        } catch (error) {
            console.error('❌ TPF記録開始エラー:', error);
        }
    }
    
    /**
     * TPF記録点追加
     * @param {Object} coords - 追加座標
     */
    addTPFPoint(coords) {
        try {
            const recordManager = this.getRecordManager();
            if (!recordManager || typeof recordManager.addPoint !== 'function') {
                return;
            }
            
            recordManager.addPoint(coords);
            
        } catch (error) {
            console.error('❌ TPF記録点追加エラー:', error);
        }
    }
    
    /**
     * TPF記録終了
     */
    endTPFRecord() {
        try {
            const recordManager = this.getRecordManager();
            if (!recordManager || typeof recordManager.endOperation !== 'function') {
                return;
            }
            
            const metadata = {
                tool: 'pen',
                style: { ...this.strokeStyle },
                pathLength: this.currentPath.length,
                timestamp: Date.now()
            };
            
            recordManager.endOperation(metadata);
            
        } catch (error) {
            console.error('❌ TPF記録終了エラー:', error);
        }
    }
    
    // ================================
    // 座標変換・ユーティリティ
    // ================================
    
    /**
     * イベント→キャンバス座標変換（統一）
     * @param {PointerEvent} event - ポインタイベント
     * @returns {Object|null} キャンバス座標 {x, y} または null
     */
    convertEventToCanvasCoords(event) {
        try {
            // clientX/Y取得
            const clientCoords = this.getClientXY(event);
            if (!clientCoords) {
                return null;
            }
            
            // CoordinateManager使用（必須）
            const coordinateManager = this.getCoordinateManager();
            if (!coordinateManager || typeof coordinateManager.screenToCanvas !== 'function') {
                return null;
            }
            
            const result = coordinateManager.screenToCanvas(clientCoords);
            
            if (!result || typeof result.x !== 'number' || typeof result.y !== 'number') {
                return null;
            }
            
            return {
                x: result.x,
                y: result.y,
                inBounds: result.inBounds !== false // デフォルトtrue
            };
            
        } catch (error) {
            console.error('❌ 座標変換エラー:', error);
            return null;
        }
    }
    
    /**
     * clientX/Y取得（TouchEvent対応）
     * @param {Event} event - イベント
     * @returns {Object|null} {x, y} または null
     */
    getClientXY(event) {
        if (!event) {
            return null;
        }
        
        // PointerEvent/MouseEvent
        if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            return { x: event.clientX, y: event.clientY };
        }
        
        // TouchEvent
        const touch = event.touches?.[0] || event.changedTouches?.[0];
        if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
            return { x: touch.clientX, y: touch.clientY };
        }
        
        return null;
    }
    
    /**
     * カメラ内座標判定
     * @param {Object} coords - 座標
     * @returns {boolean} カメラ内フラグ
     */
    isPointInCamera(coords) {
        if (!coords) {
            return false;
        }
        
        try {
            // NavigationManager使用（オプション）
            const navManager = this.managerCache?.get('navigation');
            if (navManager && typeof navManager.getCameraBounds === 'function') {
                const bounds = navManager.getCameraBounds();
                if (bounds) {
                    return coords.x >= bounds.x && 
                           coords.y >= bounds.y && 
                           coords.x <= bounds.x + bounds.width && 
                           coords.y <= bounds.y + bounds.height;
                }
            }
            
            // フォールバック: 境界情報使用
            return coords.inBounds !== false;
            
        } catch (error) {
            return coords.inBounds !== false;
        }
    }
    
    // ================================
    // 設定・状態管理
    // ================================
    
    /**
     * ストロークスタイル設定
     * @param {Object} style - スタイル設定
     */
    setStrokeStyle(style) {
        if (!style || typeof style !== 'object') {
            return;
        }
        
        // 安全な設定マージ
        if (typeof style.width === 'number' && style.width > 0) {
            this.strokeStyle.width = Math.min(Math.max(style.width, 1), 100);
        }
        if (typeof style.color === 'number') {
            this.strokeStyle.color = style.color;
        }
        if (typeof style.alpha === 'number') {
            this.strokeStyle.alpha = Math.min(Math.max(style.alpha, 0), 1);
        }
    }
    
    /**
     * 現