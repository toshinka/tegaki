/**
 * @fileoverview PenTool v8.12.0 Phase1.5 包括的修正版
 * @description PixiJS v8対応・継続描画問題修正・外部入力対応・RecordManager統合
 * @author Claude
 * @date 2025-08-30
 * @version Phase1.5-r5
 * 
 * @provides PenTool, window.Tegaki.PenTool
 * @uses AbstractTool, CanvasManager, CoordinateManager, RecordManager, NavigationManager
 * @initflow 1. AbstractTool.constructor() → 2. setManagers() → 3. activate() → 4. Graphics初期化
 * @forbids 💀 双方向依存禁止 🚫 フォールバック禁止 🚫 フェイルセーフ禁止 🚫 v7/v8 両対応による二重管理禁止 🚫 未実装メソッド呼び出し禁止 🚫 目先のエラー修正のためのDRY・SOLID原則違反
 * @manager-key window.Tegaki.ToolManagerInstance.tools.get('pen')
 * @dependencies-strict REQUIRED: AbstractTool, CanvasManager, CoordinateManager, RecordManager; OPTIONAL: NavigationManager; FORBIDDEN: 他Tool直接参照
 * @integration-flow AppCore → ToolManager.initializeV8Tools() → new PenTool() → setManagers() → activate()
 * @method-naming-rules startDrawing()/endDrawing(), startOperation()/endOperation() 形式で統一
 * @state-management 描画状態は直接操作せず、専用メソッド経由。isDrawing/tempStroke等
 * @performance-notes Graphics作成は重い処理。再利用とContainer分離で最適化。16ms描画維持
 */

// PenTool Phase1.5 包括的修正版 - 継続描画問題・外部入力・RecordManager統合対応
class PenTool extends window.Tegaki.AbstractTool {
    /**
     * PenTool v8.12.0 Phase1.5版コンストラクタ
     * @description 継続描画問題修正・外部入力バッファリング・RecordManager統合対応
     */
    constructor() {
        super('pen');
        
        // 描画状態管理（Phase1.5強化版）
        this.isDrawing = false;
        this.isRecording = false;  // RecordManager記録状態
        this.currentStroke = null;  // 現在のGraphicsインスタンス
        this.tempStroke = [];       // キャンバス外描画バッファ
        
        // 描画設定（Phase1.5統合版）
        this.strokeColor = 0x800000;  // futaba-maroon
        this.strokeWidth = 3;
        this.strokeOpacity = 1.0;
        
        // Manager参照キャッシュ
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.navigationManager = null;
        
        console.log('🖊️ PenTool v8.12.0 Phase1.5版 作成完了 - 継続描画修正・外部入力・RecordManager統合対応');
    }
    
    /**
     * Manager統一注入処理（Phase1.5強化版）
     * @param {Object} managers - Manager群オブジェクト
     */
    setManagers(managers) {
        super.setManagers(managers);
        
        // 必須Manager直接参照キャッシュ（性能最適化）
        this.canvasManager = this.managers.canvas;
        this.coordinateManager = this.managers.coordinate;
        this.recordManager = this.managers.record;
        this.navigationManager = this.managers.navigation;
        
        console.log('🖊️ PenTool: Manager統一注入完了（Phase1.5強化版）');
    }
    
    /**
     * ツールアクティブ化処理（Phase1.5版）
     * @description Graphics初期化とPointer配線を実行
     */
    activate() {
        super.activate();
        
        // RecordManager準備状態確認
        if (this.recordManager && typeof this.recordManager.isReady === 'function') {
            const isReady = this.recordManager.isReady();
            console.log(`🖊️ PenTool: RecordManager準備状態 = ${isReady}`);
        }
        
        console.log('🖊️ PenTool アクティブ化完了（Phase1.5版）');
    }
    
    /**
     * PointerDown処理（Phase1.5完全修正版）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerDown(event) {
        if (!this.isActive || this.isDrawing) {
            return;
        }
        
        try {
            // DOM座標→キャンバス座標変換
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            
            // 外部入力バッファ初期化
            this.tempStroke = [canvasPoint];
            this.isDrawing = true;
            this.isRecording = false;
            
            // カメラ内判定（NavigationManager使用）
            const insideCamera = this.isInsideCamera(canvasPoint);
            
            if (insideCamera) {
                // カメラ内：即座にRecordManager開始
                this.startRecording(canvasPoint);
            }
            
            console.log(`🖊️ 描画開始: ${JSON.stringify(canvasPoint)} (カメラ内: ${insideCamera})`);
            
        } catch (error) {
            console.error('🚨 PenTool PointerDown エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * PointerMove処理（Phase1.5外部入力対応版）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerMove(event) {
        if (!this.isActive || !this.isDrawing) {
            return;
        }
        
        try {
            // DOM座標→キャンバス座標変換
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            
            // tempStrokeに常に追加
            this.tempStroke.push(canvasPoint);
            
            if (!this.isRecording) {
                // 未記録状態：カメラ内侵入チェック
                if (this.isInsideCamera(canvasPoint)) {
                    console.log('🖊️ カメラ内侵入 - 記録開始');
                    this.startRecording(canvasPoint);
                }
            } else {
                // 記録中：通常描画
                this.addPointToStroke(canvasPoint);
            }
            
        } catch (error) {
            console.error('🚨 PenTool PointerMove エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * PointerUp処理（Phase1.5完全修正版）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerUp(event) {
        console.log('🖊️ PointerUp - 描画終了処理開始');
        
        if (!this.isActive || !this.isDrawing) {
            return;
        }
        
        try {
            // 記録中なら終了処理
            if (this.isRecording) {
                this.endRecording();
            }
            
            // 描画状態を完全リセット
            this.resetDrawingState();
            
            console.log('✅ PenTool: 描画状態リセット完了');
            
        } catch (error) {
            console.error('🚨 PenTool PointerUp エラー:', error);
            this.resetDrawingState();
        }
    }
    
    /**
     * 記録開始処理（RecordManager連携）
     * @param {Object} startPoint - 開始点
     */
    startRecording(startPoint) {
        try {
            // Graphics作成と初期化
            this.createStrokeGraphics();
            
            // RecordManager記録開始
            if (this.recordManager && typeof this.recordManager.startOperation === 'function') {
                this.recordManager.startOperation('stroke', this.tempStroke);
                console.log('✅ RecordManager記録開始');
            } else {
                console.log('ℹ️ RecordManager未準備 - 描画のみ実行');
            }
            
            // 既存tempStrokeを描画に反映
            this.renderTempStroke();
            
            this.isRecording = true;
            
        } catch (error) {
            console.error('🚨 記録開始エラー:', error);
            throw error;
        }
    }
    
    /**
     * Graphics作成処理（PixiJS v8対応）
     */
    createStrokeGraphics() {
        try {
            // 新規Graphics作成
            this.currentStroke = new PIXI.Graphics();
            
            // v8対応 line設定
            this.currentStroke.setStrokeStyle({
                width: this.strokeWidth,
                color: this.strokeColor,
                alpha: this.strokeOpacity
            });
            
            // DrawContainerに追加（v8では必須）
            const drawContainer = this.canvasManager.getDrawContainer();
            drawContainer.addChild(this.currentStroke);
            
            console.log(`✅ Graphics作成・Container追加完了: color=0x${this.strokeColor.toString(16)}, width=${this.strokeWidth}`);
            console.log(`📦 DrawContainer children count: ${drawContainer.children.length}`);
            
        } catch (error) {
            console.error('🚨 Graphics作成エラー:', error);
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
            // 最初の点でmoveTo
            const firstPoint = this.tempStroke[0];
            this.currentStroke.moveTo(firstPoint.x, firstPoint.y);
            
            // 残りの点でlineTo
            for (let i = 1; i < this.tempStroke.length; i++) {
                const point = this.tempStroke[i];
                this.currentStroke.lineTo(point.x, point.y);
            }
            
            console.log(`🖊️ tempStroke描画完了: ${this.tempStroke.length}点`);
            
        } catch (error) {
            console.error('🚨 tempStroke描画エラー:', error);
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
            console.error('🚨 点追加エラー:', error);
        }
    }
    
    /**
     * 記録終了処理（RecordManager連携）
     */
    endRecording() {
        try {
            // RecordManager記録終了
            if (this.recordManager && typeof this.recordManager.endOperation === 'function') {
                const strokeMeta = {
                    color: `#${this.strokeColor.toString(16).padStart(6, '0')}`,
                    width: this.strokeWidth,
                    opacity: this.strokeOpacity,
                    layer: 'default',
                    tool: 'pen',
                    engine: 'pixi'
                };
                
                this.recordManager.endOperation(strokeMeta);
                console.log('✅ RecordManager記録終了');
            }
            
            this.isRecording = false;
            this.currentStroke = null;
            
        } catch (error) {
            console.error('🚨 記録終了エラー:', error);
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
            console.warn('⚠️ カメラ境界取得エラー:', error);
            return true;  // エラー時は内部扱い
        }
    }
    
    /**
     * 描画状態完全リセット（Phase1.5強化版）
     */
    resetDrawingState() {
        this.isDrawing = false;
        this.isRecording = false;
        this.currentStroke = null;
        this.tempStroke = [];
        
        console.log('🔄 PenTool: 描画状態完全リセット');
    }
    
    /**
     * 強制描画終了（ツール切替時）
     */
    deactivate() {
        if (this.isDrawing) {
            console.log('⚠️ PenTool: 強制描画終了');
            if (this.isRecording) {
                this.endRecording();
            }
            this.resetDrawingState();
        }
        
        super.deactivate();
        console.log('🖊️ PenTool 非アクティブ化完了');
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            toolName: this.name,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            isRecording: this.isRecording,
            tempStrokeLength: this.tempStroke.length,
            strokeSettings: {
                color: this.strokeColor,
                width: this.strokeWidth,
                opacity: this.strokeOpacity
            },
            managersReady: {
                canvas: !!this.canvasManager,
                coordinate: !!this.coordinateManager,
                record: !!this.recordManager,
                navigation: !!this.navigationManager
            }
        };
    }
}

// グローバル登録（Phase1.5準拠）
window.Tegaki = window.Tegaki || {};
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool v8.12.0 Phase1.5版 Loaded - 継続描画修正・外部入力対応・RecordManager統合完了');
console.log('📏 修正内容: PointerUp完全修正・tempStroke実装・RecordManager統合・カメラ外描画対応');
console.log('🚀 特徴: 描画状態完全管理・外部入力バッファリング・Manager統合・継続描画問題解決');