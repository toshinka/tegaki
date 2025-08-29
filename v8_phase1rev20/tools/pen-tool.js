/**
 * @provides PenTool, initializePenToolV8
 * @uses CanvasManager.getDrawContainer, CoordinateManager.toCanvasCoords, RecordManager.addStroke, EventBus.emit
 * @initflow 1. ToolManager作成 → 2. Manager注入 → 3. アクティブ化 → 4. 描画イベント処理
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫v7/v8二重管理禁止 🚫v7 Graphics API禁止
 * @manager-key window.Tegaki.PenToolInstance
 * @dependencies-strict 必須: CanvasManager, CoordinateManager, RecordManager / オプション: EventBus, ConfigManager
 * @integration-flow ToolManager → createTool → Manager統一注入 → アクティブ化
 * @method-naming-rules startStroke()/addPoint()/endStroke()統一
 * @state-management 状態は直接操作禁止・専用メソッド経由のみ
 * @performance-notes v8 Graphics・WebGPU対応・リアルタイム描画・60fps対応
 * 
 * PenTool PixiJS v8完全対応版 - コンストラクタエラー修正・描画機能修正版
 * - v8 Graphics API完全準拠（rect().fill()形式）
 * - v7 API完全削除（beginFill/endFill等禁止）
 * - WebGPU対応・リアルタイム描画
 * - TPF形式ストローク保存準備
 * - Manager統一注入完全対応
 * - コンストラクタでのCanvasManager必須条件を削除
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor(toolName = 'pen') {
        super(toolName);
        
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
        this.realtimeDrawingEnabled = false;
        this.webGPUOptimized = false;
        
        // Manager参照（初期化時はnull）
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.eventBus = null;
        this.configManager = null;
        
        // Graphics関連
        this.graphics = null;
        this.drawContainer = null;
        
        console.log('🖊️ PenTool v8.12.0作成完了 - コンストラクタエラー修正版');
    }
    
    /**
     * ✅確認済み: Manager統一注入（Object形式）
     * CanvasManager, CoordinateManager, RecordManager必須確認
     */
    setManagers(managers) {
        console.log('🔧 pen Manager統一注入開始...');
        
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
            
            console.log('✅ pen: Manager統一注入完了');
            return true;
            
        } catch (error) {
            console.error('❌ pen: Manager統一注入失敗:', error);
            throw error;
        }
    }
    
    /**
     * AbstractToolとの互換性メソッド
     */
    setManagersObject(managers) {
        return this.setManagers(managers);
    }
    
    /**
     * ✅確認済み: Tool アクティブ化・v8描画機能初期化
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
     * 🚀 v8描画機能初期化（Graphics API v8準拠）
     */
    initializeV8DrawingFeatures() {
        try {
            // DrawContainer取得
            if (!this.canvasManager) {
                throw new Error('CanvasManager not available');
            }
            
            this.drawContainer = this.canvasManager.getDrawContainer();
            if (!this.drawContainer) {
                throw new Error('DrawContainer not available');
            }
            
            // v8 Graphics設定（新API準拠）
            this.setupV8Graphics();
            
            // v8リアルタイム描画有効化
            this.enableRealtimeDrawing();
            
            // v8機能フラグ設定
            this.v8FeaturesEnabled = true;
            
            console.log('✅ v8描画機能初期化完了');
            
        } catch (error) {
            console.error('❌ v8描画機能初期化失敗:', error);
            this.v8FeaturesEnabled = false;
            throw error;
        }
    }
    
    /**
     * 🎨 v8 Graphics設定（新API準拠・v7 API完全削除）
     */
    setupV8Graphics() {
        try {
            // v8 Graphics作成（新API）
            this.graphics = new PIXI.Graphics();
            
            // v8描画設定（新形式）
            this.v8StrokeStyle = {
                width: this.strokeWidth,
                color: this.strokeColor,
                alpha: this.strokeOpacity,
                cap: 'round',
                join: 'round'
            };
            
            // Container追加
            if (this.drawContainer && this.graphics) {
                this.drawContainer.addChild(this.graphics);
                console.log('📦 Graphics追加完了: Container → Graphics');
            }
            
            console.log('✅ v8 Graphics設定完了');
            
        } catch (error) {
            console.error('❌ v8 Graphics設定失敗:', error);
            throw error;
        }
    }
    
    /**
     * ⚡ v8リアルタイム描画有効化
     */
    enableRealtimeDrawing() {
        try {
            this.realtimeDrawingEnabled = true;
            this.webGPUOptimized = !!window.PIXI?.Graphics;
            
            console.log('⚡ v8リアルタイム描画有効');
            
        } catch (error) {
            console.error('❌ リアルタイム描画設定失敗:', error);
        }
    }
    
    /**
     * 🖊️ 描画開始（v8 Graphics API準拠）
     */
    startStroke(point) {
        if (!this.v8FeaturesEnabled || !this.graphics) {
            console.warn('⚠️ v8描画機能未準備 - 描画スキップ');
            return;
        }
        
        try {
            // 描画状態初期化
            this.isDrawing = true;
            this.strokePoints = [point];
            
            // v8新API: Graphics.clear() → Graphics.moveTo()
            this.graphics.clear();
            this.graphics.moveTo(point.x, point.y);
            
            // ストローク記録開始
            if (this.recordManager) {
                this.currentStroke = {
                    id: 'stroke_' + Date.now(),
                    type: 'stroke',
                    tool: 'pen',
                    points: [point],
                    color: this.strokeColor,
                    width: this.strokeWidth,
                    opacity: this.strokeOpacity,
                    started: Date.now()
                };
            }
            
        } catch (error) {
            console.error('❌ 描画開始失敗:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * ➡️ 描画継続（v8 Graphics API準拠）
     */
    addStrokePoint(point) {
        if (!this.isDrawing || !this.v8FeaturesEnabled || !this.graphics) {
            return;
        }
        
        try {
            // 座標追加
            this.strokePoints.push(point);
            
            // v8新API: Graphics.lineTo() → stroke()
            this.graphics.lineTo(point.x, point.y);
            
            // v8新API: stroke()でライン描画
            this.graphics.stroke(this.v8StrokeStyle);
            
            // ストローク記録更新
            if (this.currentStroke) {
                this.currentStroke.points.push(point);
            }
            
        } catch (error) {
            console.error('❌ 描画継続失敗:', error);
        }
    }
    
    /**
     * ✅ 描画終了（v8 Graphics API準拠・TPF形式保存）
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
            
            // v8最終描画確定
            if (this.graphics && this.v8FeaturesEnabled) {
                this.graphics.stroke(this.v8StrokeStyle);
            }
            
            // TPF形式ストローク完成・保存
            if (this.currentStroke && this.recordManager) {
                this.currentStroke.ended = Date.now();
                this.currentStroke.duration = this.currentStroke.ended - this.currentStroke.started;
                
                // TPF形式保存
                this.recordManager.addStroke(this.currentStroke);
            }
            
            // 状態リセット
            this.isDrawing = false;
            this.currentStroke = null;
            this.strokePoints = [];
            
        } catch (error) {
            console.error('❌ 描画終了失敗:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * 🖱️ マウスダウンイベント（v8対応）
     */
    handlePointerDown(event) {
        try {
            if (!this.coordinateManager) {
                console.warn('⚠️ CoordinateManager未準備');
                return;
            }
            
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            this.startStroke(canvasPoint);
            
        } catch (error) {
            console.error('❌ PointerDown処理失敗:', error);
        }
    }
    
    /**
     * 🖱️ マウス移動イベント（v8対応）
     */
    handlePointerMove(event) {
        if (!this.isDrawing || !this.coordinateManager) {
            return;
        }
        
        try {
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            this.addStrokePoint(canvasPoint);
            
        } catch (error) {
            console.error('❌ PointerMove処理失敗:', error);
        }
    }
    
    /**
     * 🖱️ マウスアップイベント（v8対応）
     */
    handlePointerUp(event) {
        if (!this.isDrawing) {
            return;
        }
        
        try {
            let canvasPoint = null;
            
            if (this.coordinateManager) {
                canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            }
            
            this.endStroke(canvasPoint);
            
        } catch (error) {
            console.error('❌ PointerUp処理失敗:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * 🔄 Tool無効化
     */
    deactivate() {
        try {
            // 描画中断
            if (this.isDrawing) {
                this.endStroke(null);
            }
            
            // Graphics清理
            if (this.graphics && this.drawContainer) {
                this.drawContainer.removeChild(this.graphics);
                this.graphics.destroy();
                this.graphics = null;
            }
            
            // 状態リセット
            this.v8FeaturesEnabled = false;
            this.realtimeDrawingEnabled = false;
            this.isDrawing = false;
            this.currentStroke = null;
            this.strokePoints = [];
            
            // 親クラス無効化
            super.deactivate();
            
        } catch (error) {
            console.error('❌ Tool無効化失敗:', error);
        }
    }
    
    /**
     * 📊 v8描画状態取得
     */
    getDrawingStatus() {
        return {
            v8FeaturesEnabled: this.v8FeaturesEnabled,
            realtimeDrawingEnabled: this.realtimeDrawingEnabled,
            webGPUOptimized: this.webGPUOptimized,
            isDrawing: this.isDrawing,
            strokePoints: this.strokePoints.length,
            graphics: !!this.graphics,
            drawContainer: !!this.drawContainer
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            drawingStatus: this.getDrawingStatus(),
            managers: {
                canvas: !!this.canvasManager,
                coordinate: !!this.coordinateManager,
                record: !!this.recordManager,
                eventbus: !!this.eventBus,
                config: !!this.configManager
            }
        };
    }
}

// PenTool v8初期化関数
function initializePenToolV8() {
    console.log('🖊️ PenTool v8完全対応版初期化開始');
    
    try {
        const penTool = new PenTool();
        
        // グローバル登録
        window.Tegaki = window.Tegaki || {};
        window.Tegaki.PenTool = PenTool;
        window.Tegaki.PenToolInstance = penTool;
        
        console.log('✅ PenTool v8完全対応版初期化完了');
        return penTool;
        
    } catch (error) {
        console.error('❌ PenTool v8初期化失敗:', error);
        throw error;
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.Tegaki = window.Tegaki || {};
    window.Tegaki.PenTool = PenTool;
    window.Tegaki.initializePenToolV8 = initializePenToolV8;
    
    console.log('🖊️ PenTool v8.12.0コンストラクタエラー修正版 Loaded');
}