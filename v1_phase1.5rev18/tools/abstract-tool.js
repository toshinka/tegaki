/**
 * AbstractTool Phase1.5 - 基底ツールクラス（確実なロード版）
 * 
 * 使用メソッド一覧:
 * ✅ window.Tegaki.ErrorManager.handleError() (error-manager.js)
 * ✅ window.Tegaki.EventBus.emit() (event-bus.js)
 * ✅ window.Tegaki.CoordinateManager.clientToCanvas() (coordinate-manager.js)
 * 
 * 処理フロー:
 * 1. 継承 → 子クラスが基本メソッドを実装
 * 2. 有効化 → イベントリスナー登録 → 描画準備
 * 3. 描画 → 座標変換 → Canvas操作 → 履歴記録
 * 4. 無効化 → イベントリスナー削除 → 状態リセット
 * 
 * 依存関係: ErrorManager, EventBus, CoordinateManager
 */

window.Tegaki = window.Tegaki || {};

class AbstractTool {
    constructor(canvasManager, toolName = 'abstract') {
        console.log(`🎯 AbstractTool 作成: ${toolName}`);
        
        this.canvasManager = canvasManager;
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // イベント参照
        this.eventBus = window.Tegaki.EventBus;
        this.errorManager = window.Tegaki.ErrorManager;
        this.coordinateManager = window.Tegaki.CoordinateManager;
        
        // 描画設定
        this.settings = {
            color: 0x000000,
            size: 2,
            opacity: 1.0
        };
        
        // イベントハンドラーをバインド
        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
        this.boundPointerLeave = this.handlePointerLeave.bind(this);
    }
    
    /**
     * ツール有効化
     */
    activate() {
        if (this.isActive) return;
        
        console.log(`🎯 ${this.toolName} 有効化`);
        this.isActive = true;
        
        // イベントリスナー登録
        this.addEventListeners();
        
        // 子クラスの有効化処理
        if (this.onActivate) {
            this.onActivate();
        }
        
        // イベント発火
        if (this.eventBus) {
            this.eventBus.emit('tool:activated', {
                toolName: this.toolName,
                tool: this
            });
        }
    }
    
    /**
     * ツール無効化
     */
    deactivate() {
        if (!this.isActive) return;
        
        console.log(`🎯 ${this.toolName} 無効化`);
        this.isActive = false;
        this.isDrawing = false;
        
        // イベントリスナー削除
        this.removeEventListeners();
        
        // 子クラスの無効化処理
        if (this.onDeactivate) {
            this.onDeactivate();
        }
        
        // イベント発火
        if (this.eventBus) {
            this.eventBus.emit('tool:deactivated', {
                toolName: this.toolName,
                tool: this
            });
        }
    }
    
    /**
     * イベントリスナー登録
     */
    addEventListeners() {
        const canvas = this.getCanvasElement();
        if (!canvas) {
            console.warn('🎯 Canvas要素が見つかりません');
            return;
        }
        
        canvas.addEventListener('pointerdown', this.boundPointerDown);
        canvas.addEventListener('pointermove', this.boundPointerMove);
        canvas.addEventListener('pointerup', this.boundPointerUp);
        canvas.addEventListener('pointerleave', this.boundPointerLeave);
        
        // タッチイベントのデフォルト動作を防止
        canvas.addEventListener('touchstart', this.preventDefaultTouch);
        canvas.addEventListener('touchmove', this.preventDefaultTouch);
        canvas.addEventListener('touchend', this.preventDefaultTouch);
    }
    
    /**
     * イベントリスナー削除
     */
    removeEventListeners() {
        const canvas = this.getCanvasElement();
        if (!canvas) return;
        
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        canvas.removeEventListener('pointermove', this.boundPointerMove);
        canvas.removeEventListener('pointerup', this.boundPointerUp);
        canvas.removeEventListener('pointerleave', this.boundPointerLeave);
        
        canvas.removeEventListener('touchstart', this.preventDefaultTouch);
        canvas.removeEventListener('touchmove', this.preventDefaultTouch);
        canvas.removeEventListener('touchend', this.preventDefaultTouch);
    }
    
    /**
     * タッチイベントのデフォルト動作を防止
     */
    preventDefaultTouch(event) {
        event.preventDefault();
    }
    
    /**
     * Canvas要素取得
     */
    getCanvasElement() {
        if (this.canvasManager && this.canvasManager.getCanvasElement) {
            return this.canvasManager.getCanvasElement();
        }
        return null;
    }
    
    /**
     * 座標変換（クライアント → Canvas）
     */
    getCanvasCoordinates(clientX, clientY) {
        if (this.coordinateManager && this.coordinateManager.clientToCanvas) {
            return this.coordinateManager.clientToCanvas(clientX, clientY);
        }
        
        // フォールバック: 基本的な座標変換
        const canvas = this.getCanvasElement();
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    /**
     * ポインターダウンハンドラー
     */
    handlePointerDown(event) {
        event.preventDefault();
        
        if (!this.isActive) return;
        
        console.log(`🎯 ${this.toolName} PointerDown`);
        this.isDrawing = true;
        
        const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
        
        // 子クラスの描画開始処理
        if (this.onDrawStart) {
            this.onDrawStart(coords.x, coords.y, event);
        }
    }
    
    /**
     * ポインタームーブハンドラー
     */
    handlePointerMove(event) {
        event.preventDefault();
        
        if (!this.isActive) return;
        
        const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
        
        if (this.isDrawing) {
            // 描画中
            if (this.onDraw) {
                this.onDraw(coords.x, coords.y, event);
            }
        } else {
            // ホバー
            if (this.onHover) {
                this.onHover(coords.x, coords.y, event);
            }
        }
    }
    
    /**
     * ポインターアップハンドラー
     */
    handlePointerUp(event) {
        event.preventDefault();
        
        if (!this.isActive || !this.isDrawing) return;
        
        console.log(`🎯 ${this.toolName} PointerUp`);
        this.isDrawing = false;
        
        const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
        
        // 子クラスの描画終了処理
        if (this.onDrawEnd) {
            this.onDrawEnd(coords.x, coords.y, event);
        }
    }
    
    /**
     * ポインターリーブハンドラー
     */
    handlePointerLeave(event) {
        if (this.isDrawing) {
            this.handlePointerUp(event);
        }
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // 子クラスの設定更新処理
        if (this.onSettingsUpdate) {
            this.onSettingsUpdate(this.settings);
        }
        
        console.log(`🎯 ${this.toolName} 設定更新:`, this.settings);
    }
    
    /**
     * ツール名取得
     */
    getName() {
        return this.toolName;
    }
    
    /**
     * 有効状態取得
     */
    isActiveTool() {
        return this.isActive;
    }
    
    /**
     * 描画中状態取得
     */
    isCurrentlyDrawing() {
        return this.isDrawing;
    }
    
    /**
     * リセット
     */
    reset() {
        this.isDrawing = false;
        
        if (this.onReset) {
            this.onReset();
        }
        
        console.log(`🎯 ${this.toolName} リセット完了`);
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        console.log(`🎯 ${this.toolName} 破棄処理開始`);
        
        this.deactivate();
        
        if (this.onDestroy) {
            this.onDestroy();
        }
        
        // 参照をクリア
        this.canvasManager = null;
        this.eventBus = null;
        this.errorManager = null;
        this.coordinateManager = null;
        
        console.log(`✅ ${this.toolName} 破棄処理完了`);
    }
    
    // === 子クラスでオーバーライドする抽象メソッド ===
    
    /**
     * 描画開始処理（子クラスで実装）
     */
    onDrawStart(x, y, event) {
        // 子クラスで実装
    }
    
    /**
     * 描画処理（子クラスで実装）
     */
    onDraw(x, y, event) {
        // 子クラスで実装
    }
    
    /**
     * 描画終了処理（子クラスで実装）
     */
    onDrawEnd(x, y, event) {
        // 子クラスで実装
    }
    
    /**
     * ホバー処理（子クラスで実装・オプション）
     */
    onHover(x, y, event) {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 有効化時処理（子クラスで実装・オプション）
     */
    onActivate() {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 無効化時処理（子クラスで実装・オプション）
     */
    onDeactivate() {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 設定更新時処理（子クラスで実装・オプション）
     */
    onSettingsUpdate(settings) {
        // 子クラスで実装（オプション）
    }
    
    /**
     * リセット時処理（子クラスで実装・オプション）
     */
    onReset() {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 破棄時処理（子クラスで実装・オプション）
     */
    onDestroy() {
        // 子クラスで実装（オプション）
    }
}

// グローバル公開（最重要）
window.Tegaki.AbstractTool = AbstractTool;
console.log('🎯 AbstractTool Phase1.5 Loaded - 基底ツールクラス確実ロード版');