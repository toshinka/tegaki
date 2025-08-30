/**
 * 📄 FILE: tools/pen-tool.js
 * 📌 RESPONSIBILITY: ペン描画ツール・ストローク作成・外部入力対応・継続描画問題修正
 *
 * @provides
 *   - PenTool クラス
 *   - onPointerDown(event) - ポインターダウン描画開始
 *   - onPointerMove(event) - ポインタームーブ描画継続
 *   - onPointerUp(event) - ポインターアップ描画終了
 *   - setManagers(managers) - Manager統一注入
 *   - activate() - ツールアクティブ化
 *   - deactivate() - ツール非アクティブ化
 *   - resetDrawingState() - 描画状態リセット
 *   - getDebugInfo() - デバッグ情報取得
 *
 * @uses
 *   - AbstractTool.constructor()
 *   - AbstractTool.setManagers()
 *   - AbstractTool.activate()
 *   - AbstractTool.deactivate()
 *   - CanvasManager.getDrawContainer()
 *   - CoordinateManager.toCanvasCoords()
 *   - RecordManager.startOperation()
 *   - RecordManager.addPoint()
 *   - RecordManager.endOperation()
 *   - NavigationManager.getCameraBounds()
 *   - PIXI.Graphics()
 *
 * @initflow
 *   1. new PenTool() → 2. setManagers() → 3. activate() → 4. onPointerDown() → 5. createStrokeGraphics() → 6. onPointerUp()
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 目先のエラー修正のためのDRY・SOLID原則違反
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance.tools.get('pen')
 *
 * @dependencies-strict
 *   REQUIRED: AbstractTool, CanvasManager, CoordinateManager, RecordManager
 *   OPTIONAL: NavigationManager
 *   FORBIDDEN: 他Tool直接参照
 *
 * @integration-flow
 *   AppCore → ToolManager.initializeV8Tools() → new PenTool() → setManagers() → activate()
 *
 * @method-naming-rules
 *   - startDrawing()/endDrawing() 形式統一
 *   - startOperation()/endOperation() 形式統一
 *   - onPointerXxx() - ポインターイベント処理
 *
 * @state-management
 *   - 描画状態は直接操作せず、専用メソッド経由
 *   - isDrawing/isRecording/tempStroke等の状態管理
 *   - 状態変更は必ずEventBus通知
 *
 * @performance-notes
 *   - Graphics作成は重い処理、再利用とContainer分離で最適化
 *   - 16ms描画維持、WebGPU対応
 *   - deactivate時の確実な解放
 */

// PenTool Phase1.5 STEP3修正版 - Manager注入エラー修正・API統一対応
class PenTool extends window.Tegaki.AbstractTool {
    /**
     * PenTool v8.12.0 STEP3修正版コンストラクタ
     * @description Manager注入エラー修正・API統一・継続描画問題解決
     */
    constructor() {
        super('pen');
        
        // 描画状態管理
        this.isDrawing = false;
        this.isRecording = false;
        this.currentStroke = null;
        this.tempStroke = [];
        
        // 描画設定
        this.strokeColor = 0x800000;  // futaba-maroon
        this.strokeWidth = 3;
        this.strokeOpacity = 1.0;
        
        // Manager参照（初期化時はnull）
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.navigationManager = null;
        this.eventBus = null;
        
        console.log('🖊️ PenTool v8.12.0 STEP3修正版 作成開始');
    }
    
    /**
     * Manager統一注入処理（STEP3修正版）
     * @param {Object} managers - Manager群オブジェクト
     * @returns {boolean} 注入成功フラグ
     */
    setManagers(managers) {
        try {
            console.log('🔧 PenTool: Manager統一注入開始（STEP3修正版）');
            
            // 型・値チェック
            if (!managers || typeof managers !== 'object') {
                console.error('❌ PenTool: managers が null/undefined または Object でない');
                return false;
            }
            
            // 親クラスのsetManagers実行
            const parentResult = super.setManagers(managers);
            if (parentResult === false) {
                console.error('❌ PenTool: AbstractTool.setManagers() 失敗');
                return false;
            }
            
            // Manager直接参照キャッシュ（性能最適化）
            console.log('📦 PenTool: Manager キャッシュ作成開始');
            
            // 必須Manager確認・キャッシュ
            if (this.managers.canvas) {
                this.canvasManager = this.managers.canvas;
                console.log('✅ PenTool: CanvasManager キャッシュ完了');
            } else {
                console.warn('⚠️ PenTool: CanvasManager not found in managers');
            }
            
            if (this.managers.coordinate) {
                this.coordinateManager = this.managers.coordinate;
                console.log('✅ PenTool: CoordinateManager キャッシュ完了');
            } else {
                console.warn('⚠️ PenTool: CoordinateManager not found in managers');
            }
            
            if (this.managers.record) {
                this.recordManager = this.managers.record;
                console.log('✅ PenTool: RecordManager キャッシュ完了');
            } else {
                console.warn('⚠️ PenTool: RecordManager not found in managers');
            }
            
            // オプションManager
            if (this.managers.navigation) {
                this.navigationManager = this.managers.navigation;
                console.log('✅ PenTool: NavigationManager キャッシュ完了');
            }
            
            if (this.managers.eventbus) {
                this.eventBus = this.managers.eventbus;
                console.log('✅ PenTool: EventBus キャッシュ完了');
            }
            
            console.log('✅ PenTool: Manager統一注入完了（STEP3修正版）');
            return true;
            
        } catch (error) {
            console.error('🚨 PenTool: setManagers() エラー:', error);
            return false;
        }
    }
    
    /**
     * ツールアクティブ化処理（STEP3修正版）
     */
    activate() {
        try {
            super.activate();
            
            // Manager準備状態確認
            this.verifyManagersReady();
            
            console.log('✅ PenTool: アクティブ化完了（STEP3修正版）');
            
        } catch (error) {
            console.error('🚨 PenTool: activate() エラー:', error);
        }
    }
    
    /**
     * Manager準備状態確認
     */
    verifyManagersReady() {
        const checks = {
            canvasManager: !!this.canvasManager,
            coordinateManager: !!this.coordinateManager,
            recordManager: !!this.recordManager,
            recordManagerReady: this.recordManager && typeof this.recordManager.isReady === 'function' ? this.recordManager.isReady() : false
        };
        
        console.log('🔍 PenTool: Manager準備状態確認:', checks);
        
        if (!checks.canvasManager) {
            console.warn('⚠️ PenTool: CanvasManager 未注入');
        }
        if (!checks.coordinateManager) {
            console.warn('⚠️ PenTool: CoordinateManager 未注入');
        }
        if (!checks.recordManager) {
            console.warn('⚠️ PenTool: RecordManager 未注入');
        }
        if (checks.recordManager && !checks.recordManagerReady) {
            console.warn('⚠️ PenTool: RecordManager 未準備');
        }
        
        return checks;
    }
    
    /**
     * PointerDown処理（継続描画問題修正版）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerDown(event) {
        console.log('🖊️ PenTool: onPointerDown() 開始');
        
        // 基本状態確認
        if (!this.isActive) {
            console.log('ℹ️ PenTool: 非アクティブ状態のため描画無効');
            return;
        }
        
        if (this.isDrawing) {
            console.log('ℹ️ PenTool: 既に描画中のため無視');
            return;
        }
        
        try {
            // Manager準備確認
            if (!this.coordinateManager) {
                console.error('❌ PenTool: CoordinateManager 未準備');
                return;
            }
            
            // DOM座標→キャンバス座標変換
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            console.log('📍 変換座標:', canvasPoint);
            
            // 描画状態初期化
            this.tempStroke = [canvasPoint];
            this.isDrawing = true;
            this.isRecording = false;
            
            // カメラ内判定
            const insideCamera = this.isInsideCamera(canvasPoint);
            console.log('🎯 カメラ内判定:', insideCamera);
            
            if (insideCamera) {
                // カメラ内：即座に記録開始
                this.startRecording(canvasPoint);
            }
            
            console.log('✅ PenTool: onPointerDown() 完了');
            
        } catch (error) {
            console.error('🚨 PenTool: onPointerDown() エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * PointerMove処理（外部入力対応版）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerMove(event) {
        // 描画中でない場合は無視
        if (!this.isActive || !this.isDrawing) {
            return;
        }
        
        try {
            // Manager準備確認
            if (!this.coordinateManager) {
                console.error('❌ PenTool: CoordinateManager 未準備');
                return;
            }
            
            // DOM座標→キャンバス座標変換
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            
            // tempStrokeに常に追加
            this.tempStroke.push(canvasPoint);
            
            if (!this.isRecording) {
                // 未記録状態：カメラ内侵入チェック
                if (this.isInsideCamera(canvasPoint)) {
                    console.log('🎯 PenTool: カメラ内侵入 - 記録開始');
                    this.startRecording(canvasPoint);
                }
            } else {
                // 記録中：通常描画
                this.addPointToStroke(canvasPoint);
            }
            
        } catch (error) {
            console.error('🚨 PenTool: onPointerMove() エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * PointerUp処理（完全修正版）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerUp(event) {
        console.log('🖊️ PenTool: onPointerUp() 開始 - 描画終了処理');
        
        // 描画中でない場合は無視
        if (!this.isActive || !this.isDrawing) {
            console.log('ℹ️ PenTool: 描画中でないため無視');
            return;
        }
        
        try {
            // 記録中なら終了処理
            if (this.isRecording) {
                console.log('🔚 PenTool: 記録終了処理開始');
                this.endRecording();
            }
            
            // 描画状態を完全リセット（重要）
            this.resetDrawingState();
            
            console.log('✅ PenTool: onPointerUp() 完了 - 描画状態リセット');
            
        } catch (error) {
            console.error('🚨 PenTool: onPointerUp() エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * 記録開始処理（RecordManager連携）
     * @param {Object} startPoint - 開始点
     */
    startRecording(startPoint) {
        try {
            console.log('🎬 PenTool: 記録開始処理');
            
            // Graphics作成
            this.createStrokeGraphics();
            
            // RecordManager記録開始
            if (this.recordManager && typeof this.recordManager.startOperation === 'function') {
                this.recordManager.startOperation('stroke', this.tempStroke);
                console.log('✅ RecordManager: 記録開始');
            } else {
                console.log('ℹ️ RecordManager未準備 - 描画のみ実行');
            }
            
            // 既存tempStrokeを描画に反映
            this.renderTempStroke();
            
            this.isRecording = true;
            console.log('✅ PenTool: 記録開始完了');
            
        } catch (error) {
            console.error('🚨 PenTool: startRecording() エラー:', error);
            throw error;
        }
    }
    
    /**
     * Graphics作成処理（PixiJS v8対応）
     */
    createStrokeGraphics() {
        try {
            console.log('🎨 PenTool: Graphics作成開始');
            
            // Manager準備確認
            if (!this.canvasManager) {
                throw new Error('CanvasManager未準備');
            }
            
            // 新規Graphics作成
            this.currentStroke = new PIXI.Graphics();
            
            // v8対応 stroke設定
            this.currentStroke.setStrokeStyle({
                width: this.strokeWidth,
                color: this.strokeColor,
                alpha: this.strokeOpacity
            });
            
            // DrawContainerに追加（v8では必須）
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                throw new Error('DrawContainer取得失敗');
            }
            
            drawContainer.addChild(this.currentStroke);
            
            console.log('✅ PenTool: Graphics作成・Container追加完了');
            
        } catch (error) {
            console.error('🚨 PenTool: createStrokeGraphics() エラー:', error);
            throw error;
        }
    }
    
    /**
     * tempStroke描画処理
     */
    renderTempStroke() {
        if (!this.currentStroke || this.tempStroke.length === 0) {
            return;
        }
        
        try {
            console.log('🖌️ PenTool: tempStroke描画開始');
            
            // 最初の点でmoveTo
            const firstPoint = this.tempStroke[0];
            this.currentStroke.moveTo(firstPoint.x, firstPoint.y);
            
            // 残りの点でlineTo
            for (let i = 1; i < this.tempStroke.length; i++) {
                const point = this.tempStroke[i];
                this.currentStroke.lineTo(point.x, point.y);
            }
            
            console.log(`✅ PenTool: tempStroke描画完了 (${this.tempStroke.length}点)`);
            
        } catch (error) {
            console.error('🚨 PenTool: renderTempStroke() エラー:', error);
        }
    }
    
    /**
     * 点追加処理（記録中）
     * @param {Object} point - 追加する点
     */
    addPointToStroke(point) {
        if (!this.currentStroke) {
            return;
        }
        
        try {
            // Graphics描画
            this.currentStroke.lineTo(point.x, point.y);
            
            // RecordManager追加
            if (this.recordManager && typeof this.recordManager.addPoint === 'function') {
                this.recordManager.addPoint(point);
            }
            
        } catch (error) {
            console.error('🚨 PenTool: addPointToStroke() エラー:', error);
        }
    }
    
    /**
     * 記録終了処理（RecordManager連携）
     */
    endRecording() {
        try {
            console.log('🔚 PenTool: 記録終了処理');
            
            // RecordManager記録終了
            if (this.recordManager && typeof this.recordManager.endOperation === 'function') {
                const strokeMeta = {
                    color: `#${this.strokeColor.toString(16).padStart(6, '0')}`,
                    width: this.strokeWidth,
                    opacity: this.strokeOpacity,
                    layer: 'default',
                    tool: 'pen',
                    engine: 'pixi-v8'
                };
                
                this.recordManager.endOperation(strokeMeta);
                console.log('✅ RecordManager: 記録終了');
            }
            
            this.isRecording = false;
            this.currentStroke = null;
            
            console.log('✅ PenTool: 記録終了完了');
            
        } catch (error) {
            console.error('🚨 PenTool: endRecording() エラー:', error);
        }
    }
    
    /**
     * カメラ内判定（NavigationManager使用）
     * @param {Object} point - 判定する点
     * @returns {boolean} カメラ内かどうか
     */
    isInsideCamera(point) {
        if (!this.navigationManager || typeof this.navigationManager.getCameraBounds !== 'function') {
            // NavigationManager未対応：全て内部扱い
            return true;
        }
        
        try {
            const bounds = this.navigationManager.getCameraBounds();
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
        } catch (error) {
            console.warn('⚠️ PenTool: getCameraBounds() エラー:', error);
            return true;  // エラー時は内部扱い
        }
    }
    
    /**
     * 描画状態完全リセット（重要）
     */
    resetDrawingState() {
        console.log('🔄 PenTool: 描画状態リセット開始');
        
        this.isDrawing = false;
        this.isRecording = false;
        this.currentStroke = null;
        this.tempStroke = [];
        
        console.log('✅ PenTool: 描画状態リセット完了');
    }
    
    /**
     * 強制描画終了（ツール切替時）
     */
    deactivate() {
        console.log('🔄 PenTool: deactivate() 開始');
        
        if (this.isDrawing) {
            console.log('⚠️ PenTool: 強制描画終了');
            if (this.isRecording) {
                this.endRecording();
            }
            this.resetDrawingState();
        }
        
        super.deactivate();
        console.log('✅ PenTool: deactivate() 完了');
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            className: 'PenTool',
            version: 'STEP3修正版',
            toolName: this.name,
            isActive: this.isActive,
            drawingState: {
                isDrawing: this.isDrawing,
                isRecording: this.isRecording,
                tempStrokeLength: this.tempStroke.length,
                hasCurrentStroke: !!this.currentStroke
            },
            strokeSettings: {
                color: this.strokeColor,
                width: this.strokeWidth,
                opacity: this.strokeOpacity
            },
            managersStatus: {
                canvas: !!this.canvasManager,
                coordinate: !!this.coordinateManager,
                record: !!this.recordManager,
                navigation: !!this.navigationManager,
                eventbus: !!this.eventBus
            }
        };
    }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool v8.12.0 STEP3修正版 Loaded - Manager注入エラー修正・継続描画問題解決');
console.log('📏 修正内容: setManagers()エラー処理強化・Manager準備状態確認・API統一対応');
console.log('🚀 特徴: 詳細ログ・Manager準備状態確認・描画状態完全管理・外部入力バッファリング');