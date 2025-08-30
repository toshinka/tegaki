/**
 * 📄 FILE: tools/pen-tool.js
 * 📌 RESPONSIBILITY: ペン描画Tool・座標変換統一・Graphics分離管理
 *
 * @provides
 *   - PenTool
 *   - onPointerDown(event)
 *   - onPointerMove(event) 
 *   - onPointerUp(event)
 *   - activate()
 *   - deactivate()
 *   - setManagers(managers)
 *
 * @uses
 *   - CanvasManager.getDrawContainer()
 *   - CanvasManager.createStrokeGraphics()
 *   - CanvasManager.addPermanentGraphics()
 *   - CanvasManager.getTemporaryGraphics()
 *   - CoordinateManager.clientToWorld()
 *   - RecordManager.addStroke()
 *   - PIXI.Graphics v8 API
 *
 * @initflow
 *   1. ToolManager作成 → 2. Manager注入 → 3. アクティブ化 → 4. 描画イベント処理
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 v7 Graphics API禁止
 *   🚫 Graphics.clear()による全消去禁止
 *   🚫 直接DOM座標使用禁止
 *
 * @manager-key
 *   window.Tegaki.PenToolInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager, CoordinateManager, RecordManager
 *   OPTIONAL: EventBus, ConfigManager
 *   FORBIDDEN: NavigationManager直接依存
 *
 * @integration-flow
 *   ToolManager → createTool → Manager統一注入 → アクティブ化
 *
 * @method-naming-rules
 *   イベント系: onPointerDown() / onPointerMove() / onPointerUp()
 *   内部処理: startStroke() / addStrokePoint() / endStroke()
 *   管理系: activate() / deactivate() / setManagers()
 *
 * @state-management
 *   状態は直接操作禁止・専用メソッド経由のみ
 *   Graphics分離管理でメモリリーク防止
 *
 * @performance-notes
 *   v8 Graphics・WebGPU対応・リアルタイム描画・60fps対応
 *   永続Graphics分離で描画消失防止
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor(toolName = 'pen') {
        super(toolName);
        console.log('🖊️ PenTool v8.12.0作成開始 - 座標ズレ・描画消失問題解決版');
        
        // v8描画状態
        this.currentStroke = null;
        this.isDrawing = false;
        this.strokePoints = [];
        
        // v8描画設定
        this.strokeWidth = 2.0;
        this.strokeColor = 0x800000; // --futaba-maroon
        this.strokeOpacity = 1.0;
        
        // v8機能フラグ
        this.v8FeaturesEnabled = false;
        
        // Manager参照（初期化時はnull）
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.eventBus = null;
        this.configManager = null;
        
        // Graphics関連（分離管理）
        this.currentStrokeGraphics = null; // 現在描画中のGraphics
        this.temporaryGraphics = null;     // リアルタイム描画用
        this.drawContainer = null;
        
        console.log('✅ PenTool v8.12.0作成完了 - 座標ズレ・描画消失問題解決版');
    }
    
    /**
     * Manager統一注入（Object形式）
     * CanvasManager, CoordinateManager, RecordManager必須確認
     */
    setManagers(managers) {
        console.log('🔧 PenTool Manager統一注入開始...');
        
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
            
            console.log('✅ PenTool: Manager統一注入完了');
            return true;
            
        } catch (error) {
            console.error('❌ PenTool: Manager統一注入失敗:', error);
            throw error;
        }
    }
    
    /**
     * Tool アクティブ化・v8描画機能初期化
     */
    activate() {
        console.log('🖊️ PenTool アクティブ化開始');
        
        try {
            // 親クラス アクティブ化
            super.activate();
            
            // Manager確認
            if (!this.canvasManager || !this.coordinateManager || !this.recordManager) {
                throw new Error('必須Manager未設定 - setManagers()を先に実行してください');
            }
            
            // v8描画機能初期化
            this.initializeV8DrawingFeatures();
            
            console.log('✅ PenTool アクティブ化完了');
            
        } catch (error) {
            console.error('❌ PenTool アクティブ化失敗:', error);
            throw error;
        }
    }
    
    /**
     * v8描画機能初期化（Graphics分離管理）
     */
    initializeV8DrawingFeatures() {
        try {
            // DrawContainer取得
            this.drawContainer = this.canvasManager.getDrawContainer();
            if (!this.drawContainer) {
                throw new Error('DrawContainer not available');
            }
            
            // 一時描画用Graphics取得
            this.temporaryGraphics = this.canvasManager.getTemporaryGraphics();
            if (!this.temporaryGraphics) {
                throw new Error('TemporaryGraphics not available');
            }
            
            // v8機能フラグ設定
            this.v8FeaturesEnabled = true;
            
            console.log('✅ PenTool v8描画機能初期化完了');
            
        } catch (error) {
            console.error('❌ PenTool v8描画機能初期化失敗:', error);
            this.v8FeaturesEnabled = false;
            throw error;
        }
    }
    
    // ========================================
    // TegakiApplication連携用 onPointerXxx メソッド
    // ========================================
    
    /**
     * 🖱️ ポインターダウン処理（座標変換統一版）
     */
    onPointerDown(event) {
        console.log('🖊️ PenTool.onPointerDown():', event);
        
        if (!this.v8FeaturesEnabled) {
            console.warn('⚠️ PenTool v8描画機能未準備 - 描画スキップ');
            return;
        }
        
        try {
            // 統一座標変換: DOM座標 → World座標
            const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
            this.startStroke(worldPoint);
            
        } catch (error) {
            console.error('❌ PenTool.onPointerDown エラー:', error);
        }
    }
    
    /**
     * 🖱️ ポインタームーブ処理（座標変換統一版）
     */
    onPointerMove(event) {
        if (!this.isDrawing || !this.v8FeaturesEnabled) {
            return;
        }
        
        try {
            // 統一座標変換: DOM座標 → World座標
            const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
            this.addStrokePoint(worldPoint);
            
        } catch (error) {
            console.error('❌ PenTool.onPointerMove エラー:', error);
        }
    }
    
    /**
     * 🖱️ ポインターアップ処理（座標変換統一版）
     */
    onPointerUp(event) {
        console.log('🖊️ PenTool.onPointerUp():', event);
        
        if (!this.isDrawing) {
            return;
        }
        
        try {
            // 統一座標変換: DOM座標 → World座標
            const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
            this.endStroke(worldPoint);
            
        } catch (error) {
            console.error('❌ PenTool.onPointerUp エラー:', error);
        }
    }
    
    // ========================================
    // 内部描画処理メソッド（Graphics分離版）
    // ========================================
    
    /**
     * 描画開始（Graphics分離・非破壊版）
     */
    startStroke(point) {
        if (!this.v8FeaturesEnabled) {
            console.warn('⚠️ PenTool v8描画機能未準備 - 描画スキップ');
            return;
        }
        
        try {
            console.log('🖊️ PenTool 描画開始:', point);
            
            // 描画状態初期化
            this.isDrawing = true;
            this.strokePoints = [point];
            
            // 新しいストローク用Graphics作成（描画消失防止）
            const strokeId = 'stroke_' + Date.now();
            this.currentStrokeGraphics = this.canvasManager.createStrokeGraphics(strokeId);
            
            // 一時Graphics初期化（リアルタイム描画用）
            this.canvasManager.clearTemporaryGraphics();
            
            // v8新API: moveTo() でパス開始
            this.temporaryGraphics.moveTo(point.x, point.y);
            this.currentStrokeGraphics.moveTo(point.x, point.y);
            
            // ストローク記録開始
            if (this.recordManager) {
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
                
                console.log('📝 PenTool ストローク記録開始:', this.currentStroke.id);
            }
            
        } catch (error) {
            console.error('❌ PenTool 描画開始失敗:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * 描画継続（リアルタイム・永続Graphics両対応）
     */
    addStrokePoint(point) {
        if (!this.isDrawing || !this.v8FeaturesEnabled) {
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
            console.error('❌ PenTool 描画継続失敗:', error);
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
            console.log('🖊️ PenTool 描画終了:', point);
            
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
                
                console.log('📝 PenTool ストローク完了:', {
                    id: this.current