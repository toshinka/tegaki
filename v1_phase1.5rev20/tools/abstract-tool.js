/**
 * 🎯 AbstractTool Phase1.5 - 基底ツールクラス（架空メソッド完全修正版）
 * 📋 RESPONSIBILITY: 全ツールの基底クラス・共通イベント処理・座標変換
 * 🚫 PROHIBITION: 具体的な描画処理・Manager管理・複雑な初期化
 * ✅ PERMISSION: イベントハンドリング・座標変換・基底メソッド提供
 * 
 * 📏 DESIGN_PRINCIPLE: 継承ベース・共通処理集約・子クラス実装委譲
 * 🔄 INTEGRATION: CanvasManager連携・CoordinateManager座標変換・EventBus通信・ErrorManager報告
 * 🔧 FIX: EventBus・ErrorManagerインスタンス参照修正・架空メソッド削除・エラー隠蔽禁止
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（実在メソッド）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（実在メソッド）
 * ✅ window.Tegaki.CoordinateManagerInstance.clientToCanvas() - 座標変換（実在メソッド）
 * ✅ canvasManager.getCanvasElement() - Canvas要素取得（実在メソッド）
 * ❌ handleError() - 削除（架空メソッド）
 * 
 * 📐 基底ツールフロー:
 * 開始 → 継承・作成 → 有効化・イベント登録 → 座標変換・描画委譲 → 無効化・リセット → 終了
 * 依存関係: CanvasManager(Canvas要素)・EventBusInstance(通信)・ErrorManagerInstance(報告)・CoordinateManagerInstance(座標変換)
 */

window.Tegaki = window.Tegaki || {};

/**
 * AbstractTool - 全ツールの基底クラス（架空メソッド完全修正版）
 */
class AbstractTool {
    constructor(canvasManager, toolName = 'abstract') {
        console.log(`🎯 AbstractTool 作成: ${toolName}`);
        
        this.canvasManager = canvasManager;
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // 🔧 修正: インスタンス参照（クラス参照ではなく）
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        this.coordinateManager = window.Tegaki.CoordinateManagerInstance;
        
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
        
        // 🔧 修正: 実在メソッド使用
        if (this.eventBus && this.eventBus.emit) {
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
        
        // 🔧 修正: 実在メソッド使用
        if (this.eventBus && this.eventBus.emit) {
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
            console.error('❌ AbstractTool: Canvas要素が取得できません');
            
            // 🔧 修正: 実在メソッド使用（架空のhandleErrorではなく）
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', 'Canvas要素が取得できません', {
                    context: `${this.toolName}.addEventListeners`
                });
            }
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
        
        console.log(`✅ ${this.toolName} イベントリスナー登録完了`);
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
        
        console.log(`✅ ${this.toolName} イベントリスナー削除完了`);
    }
    
    /**
     * タッチイベントのデフォルト動作を防止
     */
    preventDefaultTouch(event) {
        event.preventDefault();
    }
    
    /**
     * Canvas要素取得（実在メソッド確認済み）
     */
    getCanvasElement() {
        if (this.canvasManager && typeof this.canvasManager.getCanvasElement === 'function') {
            try {
                return this.canvasManager.getCanvasElement();
            } catch (error) {
                console.error('❌ AbstractTool: Canvas要素取得エラー:', error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `Canvas要素取得エラー: ${error.message}`, {
                        context: `${this.toolName}.getCanvasElement`
                    });
                }
                return null;
            }
        }
        
        console.warn('⚠️ AbstractTool: CanvasManagerまたはgetCanvasElementメソッドがありません');
        return null;
    }
    
    /**
     * 座標変換（クライアント → Canvas）
     */
    getCanvasCoordinates(clientX, clientY) {
        if (this.coordinateManager && typeof this.coordinateManager.clientToCanvas === 'function') {
            try {
                return this.coordinateManager.clientToCanvas(clientX, clientY);
            } catch (error) {
                console.error('❌ AbstractTool: 座標変換エラー:', error);
                
                // フォールバック座標変換（エラー隠蔽ではなく、基本機能提供）
                const canvas = this.getCanvasElement();
                if (!canvas) return { x: 0, y: 0 };
                
                const rect = canvas.getBoundingClientRect();
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            }
        }
        
        // 基本座標変換（CoordinateManagerが無い場合）
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
            try {
                this.onDrawStart(coords.x, coords.y, event);
            } catch (error) {
                console.error(`❌ ${this.toolName} onDrawStart エラー:`, error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画開始エラー: ${error.message}`, {
                        context: `${this.toolName}.handlePointerDown`
                    });
                }
            }
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
                try {
                    this.onDraw(coords.x, coords.y, event);
                } catch (error) {
                    console.error(`❌ ${this.toolName} onDraw エラー:`, error);
                    
                    // 🔧 修正: 実在メソッド使用
                    if (this.errorManager && this.errorManager.showError) {
                        this.errorManager.showError('error', `描画エラー: ${error.message}`, {
                            context: `${this.toolName}.handlePointerMove`
                        });
                    }
                }
            }
        } else {
            // ホバー
            if (this.onHover) {
                try {
                    this.onHover(coords.x, coords.y, event);
                } catch (error) {
                    console.error(`❌ ${this.toolName} onHover エラー:`, error);
                }
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
            try {
                this.onDrawEnd(coords.x, coords.y, event);
            } catch (error) {
                console.error(`❌ ${this.toolName} onDrawEnd エラー:`, error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画終了エラー: ${error.message}`, {
                        context: `${this.toolName}.handlePointerUp`
                    });
                }
            }
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
            try {
                this.onSettingsUpdate(this.settings);
            } catch (error) {
                console.error(`❌ ${this.toolName} 設定更新エラー:`, error);
            }
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
            try {
                this.onReset();
            } catch (error) {
                console.error(`❌ ${this.toolName} リセットエラー:`, error);
            }
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
            try {
                this.onDestroy();
            } catch (error) {
                console.error(`❌ ${this.toolName} 破棄エラー:`, error);
            }
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
console.log('🎯 AbstractTool Phase1.5 Loaded - 基底ツールクラス架空メソッド完全修正版');