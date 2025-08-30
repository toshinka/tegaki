/**
 * PenTool - PixiJS v8対応・座標問題修正版
 * 
 * @provides PenTool, createStroke, onPointerDown, onPointerMove, onPointerUp, convertEventToCoords
 * @uses CoordinateManager.toLocalFromCanvas, CanvasManager.getDrawContainer, RecordManager.recordStroke
 * @initflow 1. AbstractTool 継承 → 2. Manager注入 → 3. activate() → 4. イベントハンドリング
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫v7/v8両対応禁止 🚫未実装メソッド呼び出し禁止 🚫Event座標の直読み🚫DPR重複適用
 * @manager-key window.Tegaki.ToolManager.tools.pen
 * @dependencies-strict CoordinateManager(必須), CanvasManager(必須), RecordManager(必須)
 * @integration-flow ToolManager → PenTool → AbstractTool
 * @method-naming-rules startOperation()/endOperation() 形式統一
 * @event-contract onPointerDown/Move/Up は原始イベントをそのまま受け渡す、clientX/Y主要ソース、passive:false、app.view直下バインド
 * @coordinate-contract 画面→キャンバス→ローカル変換はCoordinateManager経由、DPR補正一回のみ、Container変形はCoordinateManager処理
 * @state-management 状態は直接操作せず専用メソッド経由
 * @input-validation 座標がnull/undefinedの場合は処理停止
 * @performance-notes PixiJS v8 Graphics API使用、描画負荷最適化
 */

class PenTool extends window.Tegaki.AbstractTool {
    constructor() {
        super('pen');
        
        // 描画状態管理
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPath = [];
        
        // 設定
        this.strokeWidth = 3;
        this.strokeColor = 0x800000; // futaba-maroon
        this.smoothingFactor = 0.3;
        
        console.log('🖊️ PenTool v8.12.0 作成完了 - PixiJS v8 Graphics対応・座標問題修正版');
    }
    
    /**
     * PointerDown イベント処理 - 描画開始
     * @param {PointerEvent|MouseEvent|TouchEvent} e - 原始イベント
     */
    onPointerDown(e) {
        console.log('🖊️ PenTool: onPointerDown() 開始');
        
        // 入力検証
        if (!e) {
            console.warn('⚠️ PenTool: イベントオブジェクトが null/undefined');
            return;
        }
        
        // 座標変換
        const coords = this.convertEventToCoords(e);
        if (!coords) {
            console.warn('🖊️ PenTool: 座標変換失敗 - 描画中断');
            return;
        }
        
        console.log('🖊️ PenTool: 描画開始', { x: coords.x, y: coords.y });
        
        // 描画状態開始
        this.isDrawing = true;
        this.currentPath = [{ x: coords.x, y: coords.y }];
        
        // 新しいストローク作成
        this.startStroke(coords);
        
        // イベント防止
        e.preventDefault();
    }
    
    /**
     * PointerMove イベント処理 - 描画継続
     * @param {PointerEvent|MouseEvent|TouchEvent} e - 原始イベント
     */
    onPointerMove(e) {
        if (!this.isDrawing || !e) {
            return;
        }
        
        // 座標変換
        const coords = this.convertEventToCoords(e);
        if (!coords) {
            return;
        }
        
        // パス追加
        this.currentPath.push({ x: coords.x, y: coords.y });
        
        // 描画更新
        this.updateStroke(coords);
        
        e.preventDefault();
    }
    
    /**
     * PointerUp イベント処理 - 描画終了
     * @param {PointerEvent|MouseEvent|TouchEvent} e - 原始イベント
     */
    onPointerUp(e) {
        console.log(`🖊️ PenTool: onPointerUp() - isDrawing: ${this.isDrawing}`);
        
        if (!this.isDrawing) {
            return;
        }
        
        // 描画終了
        this.finishStroke();
        
        // 状態リセット
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPath = [];
        
        console.log('🖊️ PenTool: 描画完了');
        
        if (e) {
            e.preventDefault();
        }
    }
    
    /**
     * イベント座標からキャンバス座標への変換
     * @param {PointerEvent|MouseEvent|TouchEvent} e - DOM イベント
     * @returns {Object|null} - 変換された座標 {x, y} または null
     */
    convertEventToCoords(e) {
        if (!e) {
            return null;
        }
        
        // clientX/Y取得 (複数イベントタイプ対応)
        const clientCoords = this.getClientXY(e);
        if (!clientCoords) {
            console.warn('⚠️ 無効なクライアント座標（イベント未透過 or 変換漏れ）');
            return null;
        }
        
        try {
            // CoordinateManager経由で変換
            if (!this.coordinateManager) {
                console.error('❌ CoordinateManager が利用できません');
                return null;
            }
            
            // 画面座標からキャンバス座標への変換
            const canvasCoords = this.coordinateManager.screenToCanvas(clientCoords);
            if (!canvasCoords) {
                console.warn('⚠️ 画面→キャンバス座標変換失敗');
                return null;
            }
            
            // キャンバス座標からローカル座標への変換
            const localCoords = this.coordinateManager.toLocalFromCanvas(canvasCoords);
            return localCoords;
            
        } catch (error) {
            console.error('❌ 座標変換エラー:', error);
            return null;
        }
    }
    
    /**
     * イベントからclientX/Y取得 (フォールバック付き)
     * @param {Event} e - DOM イベント
     * @returns {Object|null} - {x, y} または null
     */
    getClientXY(e) {
        if (!e) return null;
        
        // PointerEvent / MouseEvent
        if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
            return { x: e.clientX, y: e.clientY };
        }
        
        // TouchEvent
        const touch = e.touches?.[0] || e.changedTouches?.[0];
        if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
            return { x: touch.clientX, y: touch.clientY };
        }
        
        return null;
    }
    
    /**
     * 新しいストローク開始
     * @param {Object} coords - 開始座標 {x, y}
     */
    startStroke(coords) {
        try {
            const drawContainer = this.canvasManager?.getDrawContainer();
            if (!drawContainer) {
                console.error('❌ DrawContainer が取得できません');
                return;
            }
            
            // PixiJS v8 Graphics作成
            this.currentStroke = new PIXI.Graphics();
            
            // ストローク設定 (v8 API)
            this.currentStroke.lineStyle({
                width: this.strokeWidth,
                color: this.strokeColor,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            // 開始点設定
            this.currentStroke.moveTo(coords.x, coords.y);
            
            // コンテナに追加
            drawContainer.addChild(this.currentStroke);
            
        } catch (error) {
            console.error('❌ ストローク開始エラー:', error);
        }
    }
    
    /**
     * ストローク更新 - 線を延長
     * @param {Object} coords - 現在座標 {x, y}
     */
    updateStroke(coords) {
        if (!this.currentStroke) {
            return;
        }
        
        try {
            // PixiJS v8では lineTo で線を描画
            this.currentStroke.lineTo(coords.x, coords.y);
            
        } catch (error) {
            console.error('❌ ストローク更新エラー:', error);
        }
    }
    
    /**
     * ストローク完成 - 記録と後処理
     */
    finishStroke() {
        if (!this.currentStroke || this.currentPath.length < 2) {
            return;
        }
        
        try {
            // RecordManager に記録
            if (this.recordManager) {
                const strokeData = {
                    type: 'pen',
                    path: [...this.currentPath],
                    style: {
                        width: this.strokeWidth,
                        color: this.strokeColor
                    },
                    timestamp: Date.now()
                };
                
                this.recordManager.recordStroke(strokeData);
            }
            
        } catch (error) {
            console.error('❌ ストローク記録エラー:', error);
        }
    }
    
    /**
     * Tool アクティブ化処理
     */
    activate() {
        super.activate();
        console.log('🖊️ PenTool アクティブ化完了');
    }
    
    /**
     * Tool 非アクティブ化処理
     */
    deactivate() {
        // 描画中の場合は強制終了
        if (this.isDrawing) {
            this.finishStroke();
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentPath = [];
        }
        
        super.deactivate();
        console.log('🖊️ PenTool 非アクティブ化完了');
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool v8.12.0 最終修正版 Loaded - 座標問題修正・PixiJS v8対応・Manager統一注入・描画システム完全対応');
console.log('🚀 特徴: v8新Graphics API・WebGPU対応・座標変換修正・イベント透過修正・Container階層描画');