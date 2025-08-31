/**
 * EraserTool - PixiJS v8対応消しゴム修正版
 * 
 * @provides EraserTool, onPointerDown, onPointerMove, onPointerUp, eraseAtPoint
 * @uses CoordinateManager.toLocalFromCanvas, CanvasManager.getDrawContainer, RecordManager.recordErase
 * @initflow 1. AbstractTool 継承 → 2. Manager注入 → 3. activate() → 4. イベントハンドリング
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫Event座標の直読み🚫DPR重複適用🚫v7/v8両対応禁止
 * @manager-key window.Tegaki.ToolManager.tools.eraser
 * @dependencies-strict CoordinateManager(必須), CanvasManager(必須), RecordManager(必須)
 * @integration-flow ToolManager → EraserTool → AbstractTool
 * @method-naming-rules startOperation()/endOperation() 形式統一
 * @event-contract onPointerDown/Move/Up は原始イベントをそのまま受け渡す、clientX/Y主要ソース
 * @coordinate-contract CoordinateManager経由座標変換、Container変形対応
 * @state-management 消去状態は直接操作せず専用メソッド経由
 * @input-validation 座標null/undefined時は処理停止
 * @performance-notes hit-test最適化、Graphics削除効率化
 */

class EraserTool extends window.Tegaki.AbstractTool {
    constructor() {
        super('eraser');
        
        // 消去状態管理
        this.isErasing = false;
        this.eraseRadius = 10;
        this.eraseMode = 'graphics'; // 'graphics' | 'pixel'
        
        console.log('🧹 EraserTool v8.12.0 作成完了 - PixiJS v8対応・hit-test消去');
    }
    
    /**
     * PointerDown イベント処理 - 消去開始
     * @param {PointerEvent|MouseEvent|TouchEvent} e - 原始イベント
     */
    onPointerDown(e) {
        console.log('🧹 EraserTool: onPointerDown() 開始');
        
        // 入力検証
        if (!e) {
            console.warn('⚠️ EraserTool: イベントオブジェクトが null/undefined');
            return;
        }
        
        // 座標変換
        const coords = this.convertEventToCoords(e);
        if (!coords) {
            console.warn('🧹 EraserTool: 座標変換失敗 - 消去中断');
            return;
        }
        
        console.log('🧹 EraserTool: 消去開始', { x: coords.x, y: coords.y });
        
        // 消去状態開始
        this.isErasing = true;
        
        // 消去実行
        this.eraseAtPoint(coords);
        
        // イベント防止
        e.preventDefault();
    }
    
    /**
     * PointerMove イベント処理 - 消去継続
     * @param {PointerEvent|MouseEvent|TouchEvent} e - 原始イベント
     */
    onPointerMove(e) {
        if (!this.isErasing || !e) {
            return;
        }
        
        // 座標変換
        const coords = this.convertEventToCoords(e);
        if (!coords) {
            return;
        }
        
        // 消去実行
        this.eraseAtPoint(coords);
        
        e.preventDefault();
    }
    
    /**
     * PointerUp イベント処理 - 消去終了
     * @param {PointerEvent|MouseEvent|TouchEvent} e - 原始イベント
     */
    onPointerUp(e) {
        console.log(`🧹 EraserTool: onPointerUp() - isErasing: ${this.isErasing}`);
        
        if (!this.isErasing) {
            return;
        }
        
        // 消去終了
        this.isErasing = false;
        
        console.log('🧹 EraserTool: 消去完了');
        
        if (e) {
            e.preventDefault();
        }
    }
    
    /**
     * 指定座標での消去実行
     * @param {Object} coords - ローカル座標 {x, y}
     */
    eraseAtPoint(coords) {
        if (!coords) {
            return;
        }
        
        try {
            const drawContainer = this.canvasManager?.getDrawContainer();
            if (!drawContainer) {
                console.error('❌ DrawContainer が取得できません');
                return;
            }
            
            // hit-test で消去対象を検出
            const toErase = [];
            
            for (let i = drawContainer.children.length - 1; i >= 0; i--) {
                const child = drawContainer.children[i];
                
                // Graphics オブジェクトのみ対象
                if (!(child instanceof PIXI.Graphics)) {
                    continue;
                }
                
                // 範囲内チェック
                if (this.isPointInRange(child, coords)) {
                    toErase.push(child);
                }
            }
            
            // 消去実行
            let eraseCount = 0;
            for (const graphics of toErase) {
                try {
                    drawContainer.removeChild(graphics);
                    graphics.destroy();
                    eraseCount++;
                } catch (error) {
                    console.warn('⚠️ Graphics削除エラー:', error);
                }
            }
            
            if (eraseCount > 0) {
                console.log(`🧹 消去完了: ${eraseCount}個のオブジェクト`);
                
                // RecordManager に記録
                if (this.recordManager) {
                    const eraseData = {
                        type: 'erase',
                        position: coords,
                        radius: this.eraseRadius,
                        count: eraseCount,
                        timestamp: Date.now()
                    };
                    
                    this.recordManager.recordErase?.(eraseData);
                }
            }
            
        } catch (error) {
            console.error('❌ 消去処理エラー:', error);
        }
    }
    
    /**
     * Graphics オブジェクトが消去範囲内かチェック
     * @param {PIXI.Graphics} graphics - Graphics オブジェクト
     * @param {Object} coords - 中心座標 {x, y}
     * @returns {boolean} - 範囲内かどうか
     */
    isPointInRange(graphics, coords) {
        if (!graphics || !coords) {
            return false;
        }
        
        try {
            // PixiJS v8 の getBounds() を使用
            const bounds = graphics.getBounds();
            
            // 消去範囲と境界の重複チェック
            const eraseLeft = coords.x - this.eraseRadius;
            const eraseRight = coords.x + this.eraseRadius;
            const eraseTop = coords.y - this.eraseRadius;
            const eraseBottom = coords.y + this.eraseRadius;
            
            // 矩形重複判定
            const overlaps = !(
                eraseRight < bounds.left ||
                eraseLeft > bounds.right ||
                eraseBottom < bounds.top ||
                eraseTop > bounds.bottom
            );
            
            if (overlaps) {
                // より詳細な距離チェック
                const centerX = bounds.x + bounds.width / 2;
                const centerY = bounds.y + bounds.height / 2;
                const distance = Math.sqrt(
                    Math.pow(coords.x - centerX, 2) + 
                    Math.pow(coords.y - centerY, 2)
                );
                
                return distance <= this.eraseRadius + Math.max(bounds.width, bounds.height) / 2;
            }
            
            return false;
            
        } catch (error) {
            console.warn('⚠️ 範囲判定エラー:', error);
            return false;
        }
    }
    
    /**
     * イベント座標からキャンバス座標への変換 (PenToolと同様)
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
     * 消去半径設定
     * @param {number} radius - 消去半径
     */
    setEraseRadius(radius) {
        if (typeof radius === 'number' && radius > 0) {
            this.eraseRadius = radius;
            console.log(`🧹 消去半径設定: ${radius}px`);
        }
    }
    
    /**
     * 消去モード設定
     * @param {string} mode - 消去モード ('graphics' | 'pixel')
     */
    setEraseMode(mode) {
        if (['graphics', 'pixel'].includes(mode)) {
            this.eraseMode = mode;
            console.log(`🧹 消去モード設定: ${mode}`);
        }
    }
    
    /**
     * Tool アクティブ化処理
     */
    activate() {
        super.activate();
        console.log('🧹 EraserTool アクティブ化完了');
    }
    
    /**
     * Tool 非アクティブ化処理
     */
    deactivate() {
        // 消去中の場合は強制終了
        if (this.isErasing) {
            this.isErasing = false;
        }
        
        super.deactivate();
        console.log('🧹 EraserTool 非アクティブ化完了');
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.EraserTool = EraserTool;

console.log('🧹 EraserTool v8.12.0 最終修正版 Loaded - PixiJS v8対応・hit-test消去・座標変換修正・Manager統一注入完全対応');
console.log('🚀 特徴: Graphics境界判定・距離ベース消去・Container階層対応・エラー耐性・記録機能');