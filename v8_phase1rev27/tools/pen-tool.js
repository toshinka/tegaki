/**
 * @provides
 *   - PenTool, onPointerDown, onPointerMove, onPointerUp, activate, deactivate, setManagers, startStroke, addStrokePoint, endStroke
 *
 * @uses
 *   - CanvasManager.getDrawContainer, CanvasManager.createStrokeGraphics, CanvasManager.addPermanentGraphics, CanvasManager.getTemporaryGraphics, CanvasManager.clearTemporaryGraphics, CoordinateManager.clientToWorld, CoordinateManager.isReady, RecordManager.addStroke, AbstractTool.activate, AbstractTool.deactivate
 *
 * @initflow
 *   1. ToolManager作成 → 2. Manager注入 → 3. 準備完了待機 → 4. アクティブ化 → 5. 描画イベント処理
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 Graphics.clear()による全消去禁止
 *   🚫 直接DOM座標使用禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 目先のエラー修正のためのDRY・SOLID原則違反
 *
 * @manager-key
 *   - window.Tegaki.PenToolInstance
 *
 * @dependencies-strict
 *   - 必須: CanvasManager, CoordinateManager, RecordManager, AbstractTool
 *   - オプション: EventBus, ConfigManager
 *
 * @integration-flow
 *   - ToolManager → createTool → Manager統一注入 → アクティブ化
 *
 * @method-naming-rules
 *   - イベント系: onPointerDown(), onPointerMove(), onPointerUp()
 *   - 内部処理: startStroke(), addStrokePoint(), endStroke()
 *   - 管理系: activate(), deactivate(), setManagers()
 *
 * @state-management
 *   - 状態は直接操作禁止・専用メソッド経由のみ
 *   - Graphics分離管理でメモリリーク防止
 *   - イベントキューイングで初期化競合回避
 *
 * @performance-notes
 *   - v8 Graphics・WebGPU対応・リアルタイム描画・60fps対応
 *   - 永続Graphics分離で描画消失防止
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor(toolName = 'pen') {
        super(toolName);
        
        // 描画状態
        this.currentStroke = null;
        this.isDrawing = false;
        this.strokePoints = [];
        
        // 描画設定
        this.strokeWidth = 2.0;
        this.strokeColor = 0x800000; // --futaba-maroon
        this.strokeOpacity = 1.0;
        
        // Manager参照
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.eventBus = null;
        this.configManager = null;
        
        // Graphics関連
        this.currentStrokeGraphics = null;
        this.temporaryGraphics = null;
        this.drawContainer = null;
        
        // 初期化状態管理
        this.managersReady = false;
        this.v8FeaturesEnabled = false;
        this.readyPromise = null;
        this.readyResolve = null;
        
        // イベントキュー（初期化完了前のイベント保存）
        this.eventQueue = [];
        this.isProcessingQueue = false;
        
        // 準備完了Promise作成
        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = resolve;
        });
    }
    
    /**
     * Manager統一注入（Object形式・準備完了確認付き）
     */
    async setManagers(managers) {
        try {
            if (!managers || typeof managers !== 'object') {
                throw new Error('Manager注入失敗: Object形式必須');
            }
            
            // Manager群をObject形式で保存
            this.managers = managers;
            
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
            
            // readyPromise解決
            if (this.readyResolve) {
                this.readyResolve();
            }
            
            console.log('PenTool: Manager統一注入完了');
            return true;
            
        } catch (error) {
            console.error('PenTool: Manager統一注入失敗:', error);
            throw error;
        }
    }
    
    /**
     * Manager準備完了待機
     */
    async waitForManagersReady() {
        // CanvasManager準備待機
        if (this.canvasManager && !this.canvasManager.isV8Ready()) {
            console.log('PenTool: CanvasManager準備待機中...');
            let attempts = 0;
            while (!this.canvasManager.isV8Ready() && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!this.canvasManager.isV8Ready()) {
                throw new Error('CanvasManager準備タイムアウト');
            }
        }
        
        // CoordinateManager準備待機
        if (this.coordinateManager && !this.coordinateManager.isReady()) {
            console.log('PenTool: CoordinateManager準備待機中...');
            await this.coordinateManager.waitForReady();
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
                console.log('PenTool: Manager準備待機中...');
                await this.readyPromise;
            }
            
            // v8描画機能初期化
            await this.initializeV8DrawingFeatures();
            
            // キューイングされたイベント処理
            await this.processEventQueue();
            
            console.log('PenTool アクティブ化完了');
            
        } catch (error) {
            console.error('PenTool アクティブ化失敗:', error);
            throw error;
        }
    }
    
    /**
     * v8描画機能初期化
     */
    async initializeV8DrawingFeatures() {
        try {
            // DrawContainer取得
            this.drawContainer = this.canvasManager.getDrawContainer();
            if (!this.drawContainer) {
                throw new Error('DrawContainer not available');
            }
            
            // TemporaryGraphics取得
            this.temporaryGraphics = this.canvasManager.getTemporaryGraphics();
            if (!this.temporaryGraphics) {
                throw new Error('TemporaryGraphics not available');
            }
            
            // v8機能フラグ設定
            this.v8FeaturesEnabled = true;
            
            console.log('PenTool v8描画機能初期化完了');
            
        } catch (error) {
            console.error('PenTool v8描画機能初期化失敗:', error);
            this.v8FeaturesEnabled = false;
            throw error;
        }
    }
    
    // ========================================
    // TegakiApplication連携用 onPointerXxx メソッド
    // ========================================
    
    /**
     * ポインターダウン処理（準備状態確認付き）
     */
    onPointerDown(event) {
        // 準備状態確認
        if (!this.isReadyForDrawing()) {
            console.warn('PenTool準備未完了 - イベントキューイング');
            this.queueEvent('pointerdown', event);
            return;
        }
        
        try {
            // 統一座標変換: DOM座標 → World座標
            const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
            this.startStroke(worldPoint);
            
        } catch (error) {
            console.error('PenTool.onPointerDown エラー:', error);
            this.handleCoordinateError(error, event);
        }
    }
    
    /**
     * ポインタームーブ処理
     */
    onPointerMove(event) {
        if (!this.isDrawing || !this.isReadyForDrawing()) {
            return;
        }
        
        try {
            // 統一座標変換: DOM座標 → World座標
            const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
            this.addStrokePoint(worldPoint);
            
        } catch (error) {
            console.error('PenTool.onPointerMove エラー:', error);
        }
    }
    
    /**
     * ポインターアップ処理
     */
    onPointerUp(event) {
        if (!this.isDrawing) {
            return;
        }
        
        try {
            // 統一座標変換: DOM座標 → World座標
            const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
            this.endStroke(worldPoint);
            
        } catch (error) {
            console.error('PenTool.onPointerUp エラー:', error);
        }
    }
    
    // ========================================
    // 内部描画処理メソッド（Graphics分離版）
    // ========================================
    
    /**
     * 描画開始（Graphics分離・非破壊版）
     */
    startStroke(point) {
        if (!this.isReadyForDrawing()) {
            console.warn('PenTool描画準備未完了');
            return;
        }
        
        try {
            // 描画状態初期化
            this.isDrawing = true;
            this.strokePoints = [point];
            
            // 新しいストローク用Graphics作成
            const strokeId = 'stroke_' + Date.now();
            this.currentStrokeGraphics = this.canvasManager.createStrokeGraphics(strokeId);
            
            // 一時Graphics初期化
            this.canvasManager.clearTemporaryGraphics();
            
            // v8新API: moveTo() でパス開始
            this.temporaryGraphics.moveTo(point.x, point.y);
            this.currentStrokeGraphics.moveTo(point.x, point.y);
            
            // ストローク記録開始
            this.currentStroke = {
                id: strokeId,
                type: 'stroke',
                tool: 'pen',
                points: [point],
                color: this.strokeColor,
                width: this.strokeWidth,
                opacity: this.strokeOpacity,
                started: Date.now()
            };
            
        } catch (error) {
            console.error('PenTool 描画開始失敗:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * 描画継続（リアルタイム・永続Graphics両対応）
     */
    addStrokePoint(point) {
        if (!this.isDrawing || !this.isReadyForDrawing()) {
            return;
        }
        
        try {
            // 座標追加
            this.strokePoints.push(point);
            
            // v8新API: lineTo() → stroke() でリアルタイム描画
            this.temporaryGraphics.lineTo(point.x, point.y);
            this.temporaryGraphics.stroke({
                width: this.strokeWidth,
                color: this.strokeColor,
                alpha: this.strokeOpacity,
                cap: 'round',
                join: 'round'
            });
            
            // 永続Graphicsにも同期描画
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
                this.currentStroke.points.push(point);
            }
            
        } catch (error) {
            console.error('PenTool 描画継続失敗:', error);
        }
    }
    
    /**
     * 描画終了（永続Graphics確定・TPF保存）
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
            
            // 永続Graphicsを描画コンテナに追加（描画保持）
            if (this.currentStrokeGraphics) {
                this.canvasManager.addPermanentGraphics(this.currentStrokeGraphics);
            }
            
            // 一時Graphicsクリア（次の描画準備）
            this.canvasManager.clearTemporaryGraphics();
            
            // TPF形式ストローク完成・保存
            if (this.currentStroke && this.recordManager) {
                this.currentStroke.ended = Date.now();
                this.currentStroke.duration = this.currentStroke.ended - this.currentStroke.started;
                
                // RecordManager.addStroke()呼び出し
                if (typeof this.recordManager.addStroke === 'function') {
                    this.recordManager.addStroke(this.currentStroke);
                } else {
                    console.warn('RecordManager.addStroke()未実装');
                }
            }
            
            // 描画状態リセット
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentStrokeGraphics = null;
            this.strokePoints = [];
            
        } catch (error) {
            console.error('PenTool 描画終了失敗:', error);
            
            // エラー時も状態リセット
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentStrokeGraphics = null;
            this.strokePoints = [];
        }
    }
    
    // ========================================
    // 初期化順序対応・イベントキューイング
    // ========================================
    
    /**
     * 描画準備状態確認
     */
    isReadyForDrawing() {
        return this.managersReady && 
               this.canvasManager?.isV8Ready() && 
               this.coordinateManager?.isReady() && 
               this.v8FeaturesEnabled &&
               this.isActive;
    }
    
    /**
     * イベントキューイング（初期化完了前のイベント保存）
     */
    queueEvent(eventType, event) {
        this.eventQueue.push({
            type: eventType,
            event: event,
            timestamp: Date.now()
        });
        
        // 5秒以上古いイベントは削除
        const cutoffTime = Date.now() - 5000;
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
            while (this.eventQueue.length > 0) {
                const queuedEvent = this.eventQueue.shift();
                
                if (!this.isReadyForDrawing()) {
                    console.warn('イベントキュー処理中に準備状態が変化');
                    break;
                }
                
                // イベントタイプに応じて処理
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
                
                // 次のイベント処理前に少し待機
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        } catch (error) {
            console.error('イベントキュー処理エラー:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }
    
    /**
     * 座標変換エラーハンドリング
     */
    handleCoordinateError(error, event) {
        if (error.message.includes('not ready')) {
            // Manager未準備の場合はイベントをキューイング
            this.queueEvent('pointerdown', event);
        } else {
            // その他のエラーは報告
            console.error('座標変換エラー:', error);
        }
    }
    
    // ========================================
    // Tool非アクティブ化・設定変更
    // ========================================
    
    /**
     * Tool非アクティブ化
     */
    deactivate() {
        try {
            // 進行中の描画があれば強制終了
            if (this.isDrawing) {
                console.warn('PenTool: 進行中描画を強制終了');
                this.endStroke();
            }
            
            // 親クラス非アクティブ化
            super.deactivate();
            
            // v8機能フラグクリア
            this.v8FeaturesEnabled = false;
            
            // イベントキュークリア
            this.eventQueue = [];
            
        } catch (error) {
            console.error('PenTool 非アクティブ化失敗:', error);
        }
    }
    
    /**
     * 描画設定変更
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
    
    /**
     * 準備完了まで待機
     */
    waitForReady() {
        return this.readyPromise;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            managersReady: this.managersReady,
            v8FeaturesEnabled: this.v8FeaturesEnabled,
            readyForDrawing: this.isReadyForDrawing(),
            currentStrokePoints: this.strokePoints.length,
            eventQueueLength: this.eventQueue.length,
            strokeSettings: {
                width: this.strokeWidth,
                color: '0x' + this.strokeColor.toString(16),
                opacity: this.strokeOpacity
            },
            managers: {
                canvas: !!this.canvasManager,
                canvasReady: this.canvasManager?.isV8Ready() || false,
                coordinate: !!this.coordinateManager,
                coordinateReady: this.coordinateManager?.isReady() || false,
                record: !!this.recordManager,
                eventbus: !!this.eventBus,
                config: !!this.configManager
            }
        };
    }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.PenTool = PenTool;
window.Tegaki.PenToolInstance = PenTool;

console.log('PenTool v8.12.0完全対応版・座標ズレ描画消失問題解決版 Loaded');
console.log('修正内容: 初期化順序確立・Manager準備状態確認・イベントキューイング・Graphics分離管理');
console.log('特徴: 座標変換統一・描画消失防止・TPF保存・v8完全対応・準備状態管理完成版');