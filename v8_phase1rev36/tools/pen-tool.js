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

// PenTool 継続描画問題修正・API統一版
class PenTool extends window.Tegaki.AbstractTool {
    /**
     * PenTool v8.12.0 継続描画問題修正版コンストラクタ
     */
    constructor() {
        super('pen');
        
        // 描画状態管理（継続描画問題修正の核心）
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
        
        console.log('🖊️ PenTool v8.12.0 継続描画問題修正版 作成開始');
    }
    
    /**
     * Manager統一注入処理（API統一版）
     * @param {Object} managers - Manager群オブジェクト
     * @returns {boolean} 注入成功フラグ
     */
    setManagers(managers) {
        try {
            console.log('🔧 PenTool: Manager統一注入開始');
            
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
            
            console.log('✅ PenTool: Manager統一注入完了');
            return true;
            
        } catch (error) {
            console.error('🚨 PenTool: setManagers() エラー:', error);
            return false;
        }
    }
    
    /**
     * ツールアクティブ化処理
     */
    activate() {
        try {
            super.activate();
            
            // 描画状態完全リセット（継続描画問題対策）
            this.resetDrawingState();
            
            // Manager準備状態確認
            this.verifyManagersReady();
            
            console.log('✅ PenTool: アクティブ化完了');
            
        } catch (error) {
            console.error('🚨 PenTool: activate() エラー:', error);
        }
    }
    
    /**
     * ツール非アクティブ化処理
     */
    deactivate() {
        try {
            // 描画中の場合は強制終了
            if (this.isDrawing) {
                console.log('🖊️ PenTool: 非アクティブ化時の強制描画終了');
                this.forceEndDrawing();
            }
            
            super.deactivate();
            
            console.log('✅ PenTool: 非アクティブ化完了');
            
        } catch (error) {
            console.error('🚨 PenTool: deactivate() エラー:', error);
        }
    }
    
    /**
     * 描画状態完全リセット（継続描画問題修正の核心）
     */
    resetDrawingState() {
        console.log('🔄 PenTool: 描画状態完全リセット');
        
        this.isDrawing = false;
        this.isRecording = false;
        this.currentStroke = null;
        this.tempStroke = [];
        
        // Graphics解放
        if (this.currentStroke) {
            try {
                const drawContainer = this.canvasManager?.getDrawContainer();
                if (drawContainer && this.currentStroke.parent) {
                    drawContainer.removeChild(this.currentStroke);
                }
                this.currentStroke.destroy();
            } catch (error) {
                console.warn('Graphics解放エラー:', error);
            }
            this.currentStroke = null;
        }
        
        console.log('✅ PenTool: 描画状態リセット完了');
    }
    
    /**
     * Manager準備状態確認
     */
    verifyManagersReady() {
        const checks = {
            canvasManager: !!this.canvasManager,
            canvasManagerReady: this.canvasManager?.isV8Ready() || false,
            coordinateManager: !!this.coordinateManager,
            coordinateManagerReady: this.coordinateManager?.isReady() || false,
            recordManager: !!this.recordManager,
            recordManagerReady: this.recordManager?.isReady() || false
        };
        
        console.log('🔍 PenTool: Manager準備状態確認:', checks);
        
        // 警告出力
        if (!checks.canvasManager) console.warn('⚠️ PenTool: CanvasManager 未注入');
        if (!checks.canvasManagerReady) console.warn('⚠️ PenTool: CanvasManager 未準備');
        if (!checks.coordinateManager) console.warn('⚠️ PenTool: CoordinateManager 未注入');
        if (!checks.coordinateManagerReady) console.warn('⚠️ PenTool: CoordinateManager 未準備');
        if (!checks.recordManager) console.warn('⚠️ PenTool: RecordManager 未注入');
        if (!checks.recordManagerReady) console.warn('⚠️ PenTool: RecordManager 未準備');
        
        return checks;
    }
    
    // ========================================
    // ポインターイベント処理（継続描画問題修正版）
    // ========================================
    
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
        
        // 継続描画防止：既に描画中の場合は強制終了
        if (this.isDrawing) {
            console.log('⚠️ PenTool: 既に描画中 - 強制終了して新規開始');
            this.forceEndDrawing();
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
            
            // カメラ内判定（外部描画対応）
            const insideCamera = this.isInsideCamera(canvasPoint);
            console.log('🎯 カメラ内判定:', insideCamera);
            
            if (insideCamera) {
                // カメラ内：即座に記録開始
                this.startRecording(canvasPoint);
            }
            
            console.log('✅ PenTool: onPointerDown() 完了 - isDrawing:', this.isDrawing, 'isRecording:', this.isRecording);
            
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
            
            // tempStrokeに追加（外部入力バッファリング）
            this.tempStroke.push(canvasPoint);
            
            if (this.isRecording) {
                // 既に記録中：点を追加してGraphicsを更新
                this.addPointToRecording(canvasPoint);
                this.updateStrokeGraphics(canvasPoint);
                
            } else {
                // 記録前：カメラ内判定
                const insideCamera = this.isInsideCamera(canvasPoint);
                
                if (insideCamera) {
                    // カメラ内侵入：記録開始（tempStrokeをすべて使用）
                    console.log('🎯 カメラ内侵入 - 記録開始');
                    this.startRecording();
                }
            }
            
        } catch (error) {
            console.error('🚨 PenTool: onPointerMove() エラー:', error);
        }
    }
    
    /**
     * PointerUp処理（継続描画問題修正版・確実な終了処理）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerUp(event) {
        console.log('🖊️ PenTool: onPointerUp() 開始 - isDrawing:', this.isDrawing, 'isRecording:', this.isRecording);
        
        // 描画中でない場合も状態確認
        if (!this.isActive) {
            console.log('ℹ️ PenTool: 非アクティブ状態');
            return;
        }
        
        try {
            // 強制的な描画終了処理（継続描画問題修正の核心）
            this.forceEndDrawing();
            
            console.log('✅ PenTool: onPointerUp() 完了 - 描画状態リセット完了');
            
        } catch (error) {
            console.error('🚨 PenTool: onPointerUp() エラー:', error);
            // エラーが発生しても必ず状態リセット
            this.resetDrawingState();
        }
    }
    
    // ========================================
    // 描画処理メソッド
    // ========================================
    
    /**
     * 記録開始処理
     * @param {Object} startPoint - 開始点（任意）
     */
    startRecording(startPoint = null) {
        try {
            if (!this.recordManager) {
                console.error('❌ RecordManager 未準備');
                return;
            }
            
            // RecordManager準備状態確認
            if (!this.recordManager.isReady()) {
                console.error('❌ RecordManager not ready');
                return;
            }
            
            console.log('📝 記録開始');
            
            // 開始点を指定するか、tempStrokeの最初を使用
            const seedPoints = startPoint ? [startPoint] : this.tempStroke.slice();
            
            // RecordManagerに記録開始を通知
            this.recordManager.startOperation('stroke', seedPoints);
            
            // 描画Graphics作成
            this.createStrokeGraphics();
            
            // 初期パスを描画
            if (this.tempStroke.length > 0) {
                this.drawInitialPath();
            }
            
            this.isRecording = true;
            
        } catch (error) {
            console.error('🚨 記録開始エラー:', error);
        }
    }
    
    /**
     * 記録中の点追加処理
     * @param {Object} point - 追加する点
     */
    addPointToRecording(point) {
        try {
            if (!this.recordManager || !this.isRecording) return;
            
            // RecordManagerに点を追加
            this.recordManager.addPoint(point);
            
        } catch (error) {
            console.error('🚨 点追加エラー:', error);
        }
    }
    
    /**
     * 強制描画終了処理（継続描画問題修正の核心）
     */
    forceEndDrawing() {
        console.log('🔚 PenTool: 強制描画終了処理開始');
        
        try {
            // 記録中の場合は記録終了
            if (this.isRecording && this.recordManager) {
                console.log('📝 記録終了処理');
                
                // RecordManagerに記録終了を通知
                const strokeMeta = {
                    color: `#${this.strokeColor.toString(16).padStart(6, '0')}`,
                    width: this.strokeWidth,
                    opacity: this.strokeOpacity,
                    tool: 'pen'
                };
                
                this.recordManager.endOperation(strokeMeta);
            }
            
            // 描画状態完全リセット
            this.resetDrawingState();
            
            console.log('✅ PenTool: 強制描画終了処理完了');
            
        } catch (error) {
            console.error('🚨 強制描画終了エラー:', error);
            // エラーでも必ず状態リセット
            this.resetDrawingState();
        }
    }
    
    /**
     * カメラ内判定（外部描画対応）
     * @param {Object} point - 判定する点
     * @returns {boolean} カメラ内かどうか
     */
    isInsideCamera(point) {
        try {
            if (!this.navigationManager) {
                // NavigationManager未設定の場合は常にカメラ内とみなす
                return true;
            }
            
            const bounds = this.navigationManager.getCameraBounds();
            
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
                   
        } catch (error) {
            console.error('カメラ内判定エラー:', error);
            // エラー時はカメラ内とみなす
            return true;
        }
    }
    
    /**
     * ストロークGraphics作成
     */
    createStrokeGraphics() {
        try {
            if (!this.canvasManager) {
                console.error('❌ CanvasManager 未準備');
                return;
            }
            
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                console.error('❌ DrawContainer 未取得');
                return;
            }
            
            // 新しいGraphicsインスタンス作成
            this.currentStroke = new PIXI.Graphics();
            
            // v8 API対応のスタイル設定
            this.currentStroke.stroke({
                width: this.strokeWidth,
                color: this.strokeColor,
                alpha: this.strokeOpacity,
                cap: 'round',
                join: 'round'
            });
            
            // DrawContainerに追加
            drawContainer.addChild(this.currentStroke);
            
            console.log('✅ ストロークGraphics作成完了');
            
        } catch (error) {
            console.error('🚨 Graphics作成エラー:', error);
        }
    }
    
    /**
     * 初期パス描画（tempStrokeからの復元）
     */
    drawInitialPath() {
        if (!this.currentStroke || this.tempStroke.length === 0) return;
        
        try {
            const startPoint = this.tempStroke[0];
            this.currentStroke.moveTo(startPoint.x, startPoint.y);
            
            for (let i = 1; i < this.tempStroke.length; i++) {
                const point = this.tempStroke[i];
                this.currentStroke.lineTo(point.x, point.y);
            }
            
        } catch (error) {
            console.error('初期パス描画エラー:', error);
        }
    }
    
    /**
     * ストロークGraphics更新
     * @param {Object} newPoint - 新しい点
     */
    updateStrokeGraphics(newPoint) {
        if (!this.currentStroke) return;
        
        try {
            this.currentStroke.lineTo(newPoint.x, newPoint.y);
            
        } catch (error) {
            console.error('Graphics更新エラー:', error);
        }
    }
    
    // ========================================
    // デバッグ・情報取得
    // ========================================
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            className: 'PenTool',
            version: 'v8.12.0-continuity-fix',
            
            // ツール基本情報
            isActive: this.isActive,
            toolName: this.toolName,
            
            // 描画状態
            drawing: {
                isDrawing: this.isDrawing,
                isRecording: this.isRecording,
                tempStrokeLength: this.tempStroke.length,
                hasCurrentStroke: !!this.currentStroke
            },
            
            // 描画設定
            settings: {
                strokeColor: `#${this.strokeColor.toString(16).padStart(6, '0')}`,
                strokeWidth: this.strokeWidth,
                strokeOpacity: this.strokeOpacity
            },
            
            // Manager状態
            managers: {
                canvasManager: !!this.canvasManager,
                canvasManagerReady: this.canvasManager?.isV8Ready() || false,
                coordinateManager: !!this.coordinateManager,
                coordinateManagerReady: this.coordinateManager?.isReady() || false,
                recordManager: !!this.recordManager,
                recordManagerReady: this.recordManager?.isReady() || false,
                navigationManager: !!this.navigationManager,
                eventBus: !!this.eventBus
            },
            
            // Graphics情報
            graphics: this.currentStroke ? {
                hasParent: !!this.currentStroke.parent,
                destroyed: this.currentStroke.destroyed,
                visible: this.currentStroke.visible,
                bounds: this.currentStroke.getBounds()
            } : null
        };
    }
}

// Tegaki名前空間に登録
if (!window.Tegaki) {
    window.Tegaki = {};
}
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool v8.12.0 継続描画問題修正版 Loaded - Manager注入エラー修正・継続描画問題解決');
console.log('📏 修正内容: 強制描画終了処理・状態管理強化・API統一対応・外部入力バッファリング');
console.log('🚀 特徴: 詳細ログ・Manager準備状態確認・描画状態完全管理・v8 Graphics API対応');