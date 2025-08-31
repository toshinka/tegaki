/**
 * 📄 FILE: tools/eraser-tool.js
 * 📌 RESPONSIBILITY: 消しゴムツール・Graphics削除・Manager統一注入・座標変換・記録機能
 *
 * ChangeLog: 2025-08-31 Manager注入メソッド追加・setManagersObject実装・継続描画修正・API統一
 *
 * @provides
 *   - EraserTool（クラス・AbstractTool継承）
 *   - setManagersObject(managers): boolean - Manager統一注入（追加）
 *   - onPointerDown(event): void - 消去開始
 *   - onPointerMove(event): void - 消去継続
 *   - onPointerUp(event): void - 消去終了
 *   - onPointerLeave(event): void - 消去強制終了（追加）
 *   - onPointerCancel(event): void - 消去キャンセル終了（追加）
 *   - eraseAtPoint(coords): void - 指定座標消去
 *   - setEraseRadius(radius): void - 消去半径設定
 *   - setEraseMode(mode): void - 消去モード設定
 *   - getState(): Object - 現在状態取得
 *
 * @uses
 *   - super.setManagersObject(managers): boolean - AbstractTool Manager注入
 *   - CoordinateManager.screenToCanvas(screenCoords): Object - 座標変換
 *   - CanvasManager.getDrawContainer(): PIXI.Container - 描画コンテナ取得
 *   - RecordManager.recordErase(eraseData): void - 消去記録
 *   - EventBus.emit(eventName, data): void - 消去イベント通知
 *
 * @initflow
 *   1. new EraserTool() → 2. setManagersObject(managers) → 3. activate() → 4. 消去準備完了 → 5. イベント処理
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 直接Manager操作禁止（AbstractTool経由必須）
 *   🚫 座標の独自計算禁止（CoordinateManager必須）
 *   🚫 DPR重複適用禁止
 *   🚫 消去状態の不完全管理（継続描画問題）
 *   🚫 未初期化状態でのポインタイベント処理禁止
 *   🚫 PointerLeave/Cancelイベント未対応
 *
 * @manager-key
 *   window.Tegaki.EraserToolInstance
 *
 * @dependencies-strict
 *   REQUIRED: AbstractTool, CanvasManager, CoordinateManager
 *   OPTIONAL: RecordManager, EventBus
 *   FORBIDDEN: 他Tool直接参照, 循環依存
 *
 * @integration-flow
 *   ToolManager → EraserTool.setManagersObject() → EraserTool.activate() → PointerEvent処理
 *
 * @method-naming-rules
 *   ポインタ系: onPointerDown(), onPointerMove(), onPointerUp(), onPointerLeave(), onPointerCancel()
 *   消去制御系: startErasing(), updateErasing(), endErasing(), forceEndErasing()
 *   設定系: setEraseRadius(), setEraseMode(), getEraseRadius()
 *   状態系: isErasing(), getState()
 *
 * @state-management
 *   消去状態はisErasingフラグで厳密管理
 *   状態変更は必ずメソッド経由
 *   forceEndErasing()による確実な終了保証
 *   PointerLeave/Cancel時の強制終了対応
 *
 * @performance-notes
 *   pointermoveでの高頻度hit-test最適化
 *   Graphics削除の効率化
 *   境界判定の高速化
 *
 * @input-validation
 *   受け取った座標がnull/undefined/NaNの場合は即座にreturn
 *   外部入力は常に型チェック・境界チェック実行
 *
 * @tool-contract
 *   setManagersObject(managers): boolean - Manager注入（必須）
 *   onPointerDown/Move/Up/Leave/Cancel(event): void - ポインタイベント処理（必須）
 *   forceEndErasing(): void - 強制終了（冪等・必須）
 *   destroy(): void - 解放処理
 *   getState(): Object - 状態取得（テスト用）
 *
 * @error-handling
 *   throw: Manager注入失敗・初期化失敗
 *   false: 消去操作失敗・座標変換失敗
 *   warn: 一時的エラー・hit-test関連
 */

class EraserTool extends window.Tegaki.AbstractTool {
    constructor() {
        super('eraser');
        console.log('🧹 EraserTool v8.12.0 作成開始 - Manager注入対応版');
        
        // 消去状態管理（厳密）
        this.isErasing = false;
        this.erasingLocked = false; // 多重消去防止
        
        // 消去設定
        this.eraseRadius = 10;
        this.eraseMode = 'graphics'; // 'graphics' | 'pixel'
        
        // 統計情報
        this.stats = {
            objectsErased: 0,
            eraseSessions: 0,
            errors: 0,
            lastError: null,
            created: Date.now()
        };
        
        console.log('✅ EraserTool 作成完了');
    }
    
    // ================================
    // Manager注入・初期化（追加実装）
    // ================================
    
    /**
     * Manager統一注入（重要な追加: PenToolと統一）
     * @param {Object|Map} managers - Manager群
     * @returns {boolean} 注入成功フラグ
     */
    setManagersObject(managers) {
        console.log('🧹 EraserTool: Manager統一注入開始（正規メソッド）');
        
        try {
            // ✅ 重要な修正: super.setManagersObject() 呼び出し
            const parentResult = super.setManagersObject(managers);
            
            if (!parentResult) {
                throw new Error('AbstractTool Manager注入失敗');
            }
            
            // EraserTool固有の初期化
            this.initializeEraserSpecific();
            
            console.log('✅ EraserTool: Manager統一注入完了');
            return true;
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ EraserTool: Manager統一注入エラー:', error);
            return false;
        }
    }
    
    /**
     * EraserTool固有初期化
     */
    initializeEraserSpecific() {
        // 消去状態リセット
        this.resetErasingState();
    }
    
    /**
     * 消去状態完全リセット
     */
    resetErasingState() {
        this.isErasing = false;
        this.erasingLocked = false;
    }
    
    // ================================
    // ポインタイベント処理（継続描画完全修正版）
    // ================================
    
    /**
     * ポインタダウン処理 - 消去開始
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        try {
            // 準備状態確認
            if (!this.isReady() || !this.isActive()) {
                return;
            }
            
            // 多重消去防止
            if (this.isErasing || this.erasingLocked) {
                console.warn('⚠️ EraserTool: 消去中のPointerDown無視');
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
            
            console.log('🧹 EraserTool: 消去開始', { x: coords.x, y: coords.y });
            
            // 消去状態開始
            this.isErasing = true;
            this.stats.eraseSessions++;
            
            // 消去実行
            this.eraseAtPoint(coords);
            
            // イベント処理完了
            event.preventDefault();
            event.stopPropagation();
            
        } catch (error) {
            this.handleErasingError('onPointerDown', error);
        }
    }
    
    /**
     * ポインタムーブ処理 - 消去継続
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        // 消去中でなければ無視
        if (!this.isErasing) {
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
            
            // 消去実行
            this.eraseAtPoint(coords);
            
            event.preventDefault();
            
        } catch (error) {
            this.handleErasingError('onPointerMove', error);
        }
    }
    
    /**
     * ポインタアップ処理（継続描画問題完全修正版）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        try {
            // ✅ 重要な修正: 必ず強制消去終了を実行
            this.forceEndErasing();
            
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
        } catch (error) {
            this.handleErasingError('onPointerUp', error);
            // エラー時も確実に状態リセット
            this.resetErasingState();
        }
    }
    
    /**
     * ポインタリーブ処理（継続描画修正の重要な追加）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerLeave(event) {
        try {
            // ✅ 重要な修正: PointerLeave時も強制終了
            if (this.isErasing) {
                console.log('🧹 EraserTool: PointerLeave → 強制消去終了');
                this.forceEndErasing();
            }
            
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
        } catch (error) {
            this.handleErasingError('onPointerLeave', error);
            this.resetErasingState();
        }
    }
    
    /**
     * ポインタキャンセル処理（継続描画修正の重要な追加）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerCancel(event) {
        try {
            // ✅ 重要な修正: PointerCancel時も強制終了
            if (this.isErasing) {
                console.log('🧹 EraserTool: PointerCancel → 強制消去終了');
                this.forceEndErasing();
            }
            
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
        } catch (error) {
            this.handleErasingError('onPointerCancel', error);
            this.resetErasingState();
        }
    }
    
    /**
     * 強制消去終了（継続描画問題修正の核心・冪等保証）
     */
    forceEndErasing() {
        try {
            // 既に終了済みなら何もしない（冪等性）
            if (!this.isErasing && !this.erasingLocked) {
                return;
            }
            
            // 消去ロック（多重終了防止）
            if (this.erasingLocked) {
                return;
            }
            
            this.erasingLocked = true;
            
            // 状態完全リセット
            this.resetErasingState();
            
            console.log('🧹 EraserTool: 消去完了');
            
        } catch (error) {
            console.error('❌ EraserTool: forceEndErasing() エラー:', error);
            // エラー時も確実にリセット
            this.resetErasingState();
        }
    }
    
    // ================================
    // 消去処理（hit-test・Graphics削除）
    // ================================
    
    /**
     * 指定座標での消去実行
     * @param {Object} coords - キャンバス座標 {x, y}
     */
    eraseAtPoint(coords) {
        if (!coords) {
            return;
        }
        
        try {
            const drawContainer = this.getDrawContainer();
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
                this.stats.objectsErased += eraseCount;
                
                // RecordManager に記録
                this.recordEraseOperation(coords, eraseCount);
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
    
    // ================================
    // 座標変換・ユーティリティ
    // ================================
    
    /**
     * イベント→キャンバス座標変換（PenToolと統一）
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
                inBounds: result.inBounds !== false
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
    
    // ================================
    // 記録・統計
    // ================================
    
    /**
     * 消去操作記録
     * @param {Object} coords - 消去座標
     * @param {number} count - 消去オブジェクト数
     */
    recordEraseOperation(coords, count) {
        try {
            const recordManager = this.getRecordManager();
            if (!recordManager || typeof recordManager.recordErase !== 'function') {
                return;
            }
            
            const eraseData = {
                type: 'erase',
                tool: 'eraser',
                position: coords,
                radius: this.eraseRadius,
                count: count,
                timestamp: Date.now()
            };
            
            recordManager.recordErase(eraseData);
            
        } catch (error) {
            console.error('❌ 消去記録エラー:', error);
        }
    }
    
    // ================================
    // 設定・状態管理
    // ================================
    
    /**
     * 消去半径設定
     * @param {number} radius - 消去半径
     */
    setEraseRadius(radius) {
        if (typeof radius === 'number' && radius > 0) {
            this.eraseRadius = Math.min(Math.max(radius, 1), 100);
            console.log(`🧹 消去半径設定: ${this.eraseRadius}px`);
        }
    }
    
    /**
     * 消去半径取得
     * @returns {number} 現在の消去半径
     */
    getEraseRadius() {
        return this.eraseRadius;
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
     * 現在状態取得（テスト・デバッグ用）
     * @returns {Object} 現在状態
     */
    getState() {
        return {
            toolName: this.name,
            isErasing: this.isErasing,
            erasingLocked: this.erasingLocked,
            eraseRadius: this.eraseRadius,
            eraseMode: this.eraseMode,
            stats: { ...this.stats },
            isReady: this.isReady(),
            isActive: this.isActive(),
            managersReady: this.managersReady
        };
    }
    
    /**
     * 消去エラーハンドリング
     * @param {string} context - エラー発生場所
     * @param {Error} error - エラーオブジェクト
     */
    handleErasingError(context, error) {
        this.stats.lastError = error;
        this.stats.errors++;
        
        console.error(`❌ EraserTool ${context} エラー:`, error);
        
        // 安全な状態リセット
        try {
            this.forceEndErasing();
        } catch (resetError) {
            this.resetErasingState();
        }
    }
    
    /**
     * Tool有効化処理
     */
    async activate() {
        await super.activate();
        console.log('🧹 EraserTool アクティブ化完了');
    }
    
    /**
     * Tool無効化処理
     */
    async deactivate() {
        // 消去中の場合は強制終了
        if (this.isErasing) {
            this.forceEndErasing();
        }
        
        await super.deactivate();
        console.log('🧹 EraserTool 無効化完了');
    }
    
    /**
     * Tool破棄
     */
    destroy() {
        try {
            // 消去強制終了
            this.forceEndErasing();
            
            // 親クラス破棄
            if (typeof super.destroy === 'function') {
                super.destroy();
            }
            
        } catch (error) {
            console.error('❌ EraserTool: destroy() エラー:', error);
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
window.Tegaki.Tools.EraserTool = EraserTool;
window.Tegaki.EraserTool = EraserTool; // 後方互換

console.log('🧹 EraserTool v8.12.0 Manager注入対応版 Loaded - PixiJS v8対応・setManagersObject実装・継続描画修正完了');
console.log('🚀 特徴: Graphics境界判定・距離ベース消去・Container階層対応・エラー耐性・記録機能・Manager統一注入');