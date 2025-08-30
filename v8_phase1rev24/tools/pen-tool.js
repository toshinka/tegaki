/**
 * @provides PenTool, initializePenToolV8
 * @uses CanvasManager.getDrawContainer, CoordinateManager.toCanvasCoords, RecordManager.addStroke, EventBus.emit
 * @initflow 1. ToolManager作成 → 2. Manager注入 → 3. アクティブ化 → 4. 描画イベント処理
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫v7/v8二重管理禁止 🚫v7 Graphics API禁止
 * @manager-key window.Tegaki.PenToolInstance
 * @dependencies-strict 必須: CanvasManager, CoordinateManager, RecordManager / オプション: EventBus, ConfigManager
 * @integration-flow ToolManager → createTool → Manager統一注入 → アクティブ化
 * @method-naming-rules onPointerDown()/onPointerMove()/onPointerUp()統一、startStroke()/addPoint()/endStroke()内部処理
 * @state-management 状態は直接操作禁止・専用メソッド経由のみ
 * @performance-notes v8 Graphics・WebGPU対応・リアルタイム描画・60fps対応
 * 
 * PenTool PixiJS v8完全対応版 - onPointerXxxメソッド追加・描画機能修正版
 * - v8 Graphics API完全準拠（stroke()形式）
 * - v7 API完全削除（beginFill/endFill等禁止）
 * - WebGPU対応・リアルタイム描画
 * - TPF形式ストローク保存準備
 * - Manager統一注入完全対応
 * - TegakiApplication連携対応（onPointerXxxメソッド実装）
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor(toolName = 'pen') {
        super(toolName);
        console.log('🖊️ PenTool v8.12.0作成開始 - onPointerXxx対応版');
        
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
        
        console.log('✅ PenTool v8.12.0作成完了 - onPointerXxx対応版');
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
     * AbstractToolとの互換性メソッド
     */
    setManagersObject(managers) {
        return this.setManagers(managers);
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
     * v8描画機能初期化（Graphics API v8準拠）
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
            
            console.log('✅ PenTool v8描画機能初期化完了');
            
        } catch (error) {
            console.error('❌ PenTool v8描画機能初期化失敗:', error);
            this.v8FeaturesEnabled = false;
            throw error;
        }
    }
    
    /**
     * v8 Graphics設定（新API準拠・v7 API完全削除）
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
                console.log('📦 PenTool Graphics追加完了: Container → Graphics');
            }
            
            console.log('✅ PenTool v8 Graphics設定完了');
            
        } catch (error) {
            console.error('❌ PenTool v8 Graphics設定失敗:', error);
            throw error;
        }
    }
    
    /**
     * v8リアルタイム描画有効化
     */
    enableRealtimeDrawing() {
        try {
            this.realtimeDrawingEnabled = true;
            this.webGPUOptimized = !!window.PIXI?.Graphics;
            
            console.log('⚡ PenTool v8リアルタイム描画有効');
            
        } catch (error) {
            console.error('❌ PenTool リアルタイム描画設定失敗:', error);
        }
    }
    
    // ========================================
    // TegakiApplication連携用 onPointerXxx メソッド
    // ========================================
    
    /**
     * 🖱️ ポインターダウン処理（TegakiApplication→ToolManager→PenTool）
     * @param {Object} event - {x, y, originalEvent}
     */
    onPointerDown(event) {
        console.log('🖊️ PenTool.onPointerDown():', event);
        
        if (!this.v8FeaturesEnabled) {
            console.warn('⚠️ PenTool v8描画機能未準備 - 描画スキップ');
            return;
        }
        
        try {
            const point = { x: event.x, y: event.y };
            this.startStroke(point);
            
        } catch (error) {
            console.error('❌ PenTool.onPointerDown エラー:', error);
        }
    }
    
    /**
     * 🖱️ ポインタームーブ処理（TegakiApplication→ToolManager→PenTool）
     * @param {Object} event - {x, y, originalEvent}
     */
    onPointerMove(event) {
        if (!this.isDrawing || !this.v8FeaturesEnabled) {
            return;
        }
        
        try {
            const point = { x: event.x, y: event.y };
            this.addStrokePoint(point);
            
        } catch (error) {
            console.error('❌ PenTool.onPointerMove エラー:', error);
        }
    }
    
    /**
     * 🖱️ ポインターアップ処理（TegakiApplication→ToolManager→PenTool）
     * @param {Object} event - {x, y, originalEvent}
     */
    onPointerUp(event) {
        console.log('🖊️ PenTool.onPointerUp():', event);
        
        if (!this.isDrawing) {
            return;
        }
        
        try {
            const point = { x: event.x, y: event.y };
            this.endStroke(point);
            
        } catch (error) {
            console.error('❌ PenTool.onPointerUp エラー:', error);
        }
    }
    
    // ========================================
    // 内部描画処理メソッド
    // ========================================
    
    /**
     * 描画開始（v8 Graphics API準拠）
     */
    startStroke(point) {
        if (!this.v8FeaturesEnabled || !this.graphics) {
            console.warn('⚠️ PenTool v8描画機能未準備 - 描画スキップ');
            return;
        }
        
        try {
            console.log('🖊️ PenTool 描画開始:', point);
            
            // 描画状態初期化
            this.isDrawing = true;
            this.strokePoints = [point];
            
            // v8新API: Graphics.clear() → moveTo()
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
                
                console.log('📝 PenTool ストローク記録開始:', this.currentStroke.id);
            }
            
        } catch (error) {
            console.error('❌ PenTool 描画開始失敗:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * 描画継続（v8 Graphics API準拠）
     */
    addStrokePoint(point) {
        if (!this.isDrawing || !this.v8FeaturesEnabled || !this.graphics) {
            return;
        }
        
        try {
            // 座標追加
            this.strokePoints.push(point);
            
            // v8新API: lineTo() → stroke()
            this.graphics.lineTo(point.x, point.y);
            this.graphics.stroke(this.v8StrokeStyle);
            
            // ストローク記録更新
            if (this.currentStroke) {
                this.currentStroke.points.push(point);
            }
            
        } catch (error) {
            console.error('❌ PenTool 描画継続失敗:', error);
        }
    }
    
    /**
     * 描画終了（v8 Graphics API準拠・TPF形式保存）
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
            
            // v8最終描画確定
            if (this.graphics && this.v8FeaturesEnabled) {
                this.graphics.stroke(this.v8StrokeStyle);
            }
            
            // TPF形式ストローク完成・保存
            if (this.currentStroke && this.recordManager) {
                this.currentStroke.ended = Date.now();
                this.currentStroke.duration = this.currentStroke.ended - this.currentStroke.started;
                
                console.log('📝 PenTool ストローク完了:', {
                    id: this.currentStroke.id,
                    points: this.currentStroke.points.length,
                    duration: this.currentStroke.duration
                });
                
                // TPF形式保存（RecordManager利用可能な場合）
                if (typeof this.recordManager.addStroke === 'function') {
                    this.recordManager.addStroke(this.currentStroke);
                } else {
                    console.warn('⚠️ RecordManager.addStroke() not available');
                }
            }
            
            // 描画状態リセット
            this.isDrawing = false;
            this.currentStroke = null;
            this.strokePoints = [];
            
        } catch (error) {
            console.error('❌ PenTool 描画終了失敗:', error);
            this.isDrawing = false;
            this.currentStroke = null;
        }
    }
    
    // ========================================
    // Tool管理・設定メソッド
    // ========================================
    
    /**
     * Tool無効化
     */
    deactivate() {
        console.log('🖊️ PenTool 無効化');
        
        // 進行中描画の強制終了
        if (this.isDrawing) {
            this.endStroke(null);
        }
        
        // Graphics削除
        if (this.graphics && this.drawContainer) {
            this.drawContainer.removeChild(this.graphics);
            this.graphics.destroy();
            this.graphics = null;
        }
        
        // 状態リセット
        this.v8FeaturesEnabled = false;
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokePoints = [];
        
        // 親クラス無効化
        super.deactivate();
        
        console.log('✅ PenTool 無効化完了');
    }
    
    /**
     * ストロークスタイル更新
     */
    updateStrokeStyle(style) {
        if (style.width !== undefined) {
            this.strokeWidth = style.width;
        }
        if (style.color !== undefined) {
            this.strokeColor = style.color;
        }
        if (style.opacity !== undefined) {
            this.strokeOpacity = style.opacity;
        }
        
        // v8スタイル更新
        this.v8StrokeStyle = {
            width: this.strokeWidth,
            color: this.strokeColor,
            alpha: this.strokeOpacity,
            cap: 'round',
            join: 'round'
        };
        
        console.log('🎨 PenTool スタイル更新:', this.v8StrokeStyle);
    }
    
    /**
     * Tool状態取得
     */
    getState() {
        return {
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            v8FeaturesEnabled: this.v8FeaturesEnabled,
            realtimeDrawingEnabled: this.realtimeDrawingEnabled,
            webGPUOptimized: this.webGPUOptimized,
            strokePoints: this.strokePoints.length,
            strokeStyle: this.v8StrokeStyle,
            hasManagers: !!this.managers,
            hasGraphics: !!this.graphics,
            hasDrawContainer: !!this.drawContainer
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'PenTool',
            version: 'v8.12.0',
            state: this.getState(),
            managers: {
                canvas: !!this.canvasManager,
                coordinate: !!this.coordinateManager,
                record: !!this.recordManager,
                eventbus: !!this.eventBus,
                config: !!this.configManager
            },
            currentStroke: this.currentStroke ? {
                id: this.currentStroke.id,
                points: this.currentStroke.points.length,
                started: this.currentStroke.started
            } : null
        };
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.v8FeaturesEnabled && 
               !!this.canvasManager && 
               !!this.coordinateManager && 
               !!this.recordManager && 
               !!this.graphics && 
               !!this.drawContainer;
    }
}

// グローバル登録
if (!window.Tegaki) {
    window.Tegaki = {};
}

window.Tegaki.PenTool = PenTool;
console.log('🖊️ PenTool v8.12.0完全対応版 Loaded - onPointerXxx対応・描画機能修正版');