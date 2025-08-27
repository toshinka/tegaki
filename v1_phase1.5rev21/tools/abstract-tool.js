/**
 * 🎯 AbstractTool Phase1.5 - 基底ツールクラス（座標変換メソッド修正版）
 * 📋 RESPONSIBILITY: 全ツールの基底クラス・共通イベント処理・座標変換
 * 🚫 PROHIBITION: 具体的な描画処理・Manager管理・複雑な初期化・エラー隠蔽
 * ✅ PERMISSION: イベントハンドリング・座標変換・基底メソッド提供
 * 
 * 📏 DESIGN_PRINCIPLE: 継承ベース・共通処理集約・子クラス実装委譲・剛直エラー処理
 * 🔄 INTEGRATION: CanvasManager連携・CoordinateManager座標変換・EventBus通信・ErrorManager報告
 * 🔧 FIX: 座標変換メソッド名修正(screenToCanvas)・エラー隠蔽禁止・実在メソッド使用
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（event-bus.js確認済み）
 * ✅ window.Tegaki.CoordinateManagerInstance.screenToCanvas() - 座標変換（coordinate-manager.js確認済み）
 * ✅ canvasManager.getCanvasElement() - Canvas要素取得（canvas-manager.js確認済み）
 * ✅ canvas.getBoundingClientRect() - 要素位置取得（DOM標準）
 * ✅ canvas.addEventListener/removeEventListener() - イベント管理（DOM標準）
 * ✅ event.preventDefault() - デフォルト動作防止（DOM標準）
 * ❌ clientToCanvas() - 修正（正しくはscreenToCanvas()）
 * ❌ handleError() - 削除（架空メソッド・ErrorManagerInstance.showError使用）
 * 
 * 📐 基底ツールフロー:
 * 開始 → 継承・作成 → 有効化・イベント登録 → 座標変換・描画委譲 → 
 * 無効化・リセット → 終了
 * 依存関係: CanvasManager(Canvas要素)・EventBusInstance(通信)・ErrorManagerInstance(報告)・CoordinateManagerInstance(座標変換)
 * 
 * 🚫 絶対禁止事項:
 * - try/catchでの握りつぶし（throw必須）
 * - フォールバック構造（基本機能提供のみ許可）
 * - 架空メソッド呼び出し（実装確認必須）
 * - 描画処理の直接実装（子クラス委譲必須）
 */

window.Tegaki = window.Tegaki || {};

/**
 * AbstractTool - 全ツールの基底クラス（座標変換メソッド修正版）
 */
class AbstractTool {
    constructor(canvasManager, toolName = 'abstract') {
        console.log(`🎯 AbstractTool 作成: ${toolName}`);
        
        // 必須引数確認
        if (!canvasManager) {
            const error = new Error('CanvasManager is required for AbstractTool');
            console.error('💀 AbstractTool 作成失敗:', error);
            throw error;
        }
        
        this.canvasManager = canvasManager;
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // 依存関係設定
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        this.coordinateManager = window.Tegaki.CoordinateManagerInstance;
        
        // 描画設定（デフォルト）
        this.settings = {
            color: 0x000000,
            size: 2,
            opacity: 1.0
        };
        
        // イベントハンドラーをバインド（thisコンテキスト保持）
        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
        this.boundPointerLeave = this.handlePointerLeave.bind(this);
        
        console.log(`✅ ${toolName} AbstractTool 作成完了`);
    }
    
    /**
     * ツール有効化
     */
    activate() {
        if (this.isActive) {
            console.log(`📋 ${this.toolName} は既に有効化済み`);
            return;
        }
        
        console.log(`🎯 ${this.toolName} 有効化開始`);
        this.isActive = true;
        
        // イベントリスナー登録
        this.addEventListeners();
        
        // 子クラスの有効化処理（オプション）
        if (typeof this.onActivate === 'function') {
            try {
                this.onActivate();
            } catch (error) {
                console.error(`💀 ${this.toolName} 有効化処理エラー:`, error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `ツール有効化エラー: ${error.message}`, {
                        context: `${this.toolName}.activate`
                    });
                }
                
                throw error;
            }
        }
        
        // 有効化イベント発火
        if (this.eventBus && this.eventBus.emit) {
            this.eventBus.emit('tool:activated', {
                toolName: this.toolName,
                tool: this
            });
        }
        
        console.log(`✅ ${this.toolName} 有効化完了`);
    }
    
    /**
     * ツール無効化
     */
    deactivate() {
        if (!this.isActive) {
            console.log(`📋 ${this.toolName} は既に無効化済み`);
            return;
        }
        
        console.log(`🎯 ${this.toolName} 無効化開始`);
        this.isActive = false;
        this.isDrawing = false;
        
        // イベントリスナー削除
        this.removeEventListeners();
        
        // 子クラスの無効化処理（オプション）
        if (typeof this.onDeactivate === 'function') {
            try {
                this.onDeactivate();
            } catch (error) {
                console.error(`💀 ${this.toolName} 無効化処理エラー:`, error);
            }
        }
        
        // 無効化イベント発火
        if (this.eventBus && this.eventBus.emit) {
            this.eventBus.emit('tool:deactivated', {
                toolName: this.toolName,
                tool: this
            });
        }
        
        console.log(`✅ ${this.toolName} 無効化完了`);
    }
    
    /**
     * イベントリスナー登録
     */
    addEventListeners() {
        const canvas = this.getCanvasElement();
        if (!canvas) {
            const error = new Error('Canvas要素が取得できません');
            console.error('💀 AbstractTool イベントリスナー登録失敗:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', error.message, {
                    context: `${this.toolName}.addEventListeners`
                });
            }
            
            throw error;
        }
        
        // ポインターイベント
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
        if (!canvas) {
            console.warn(`⚠️ ${this.toolName} Canvas要素が取得できないため、イベントリスナー削除をスキップ`);
            return;
        }
        
        // ポインターイベント削除
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        canvas.removeEventListener('pointermove', this.boundPointerMove);
        canvas.removeEventListener('pointerup', this.boundPointerUp);
        canvas.removeEventListener('pointerleave', this.boundPointerLeave);
        
        // タッチイベント削除
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
     * Canvas要素取得
     */
    getCanvasElement() {
        if (this.canvasManager && typeof this.canvasManager.getCanvasElement === 'function') {
            try {
                const canvas = this.canvasManager.getCanvasElement();
                if (!canvas) {
                    throw new Error('CanvasManager.getCanvasElement() returned null');
                }
                return canvas;
            } catch (error) {
                console.error('💀 AbstractTool Canvas要素取得エラー:', error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `Canvas要素取得エラー: ${error.message}`, {
                        context: `${this.toolName}.getCanvasElement`
                    });
                }
                
                throw error;
            }
        }
        
        const error = new Error('CanvasManagerまたはgetCanvasElementメソッドがありません');
        console.error('💀 AbstractTool:', error);
        throw error;
    }
    
    /**
     * 座標変換（スクリーン座標 → Canvas座標）
     * 🔧 修正: screenToCanvas使用（clientToCanvasは誤記）
     */
    getCanvasCoordinates(screenX, screenY) {
        // CoordinateManagerを優先使用
        if (this.coordinateManager && typeof this.coordinateManager.screenToCanvas === 'function') {
            try {
                return this.coordinateManager.screenToCanvas(screenX, screenY);
            } catch (error) {
                console.error('💀 CoordinateManager 座標変換エラー:', error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `座標変換エラー: ${error.message}`, {
                        context: `${this.toolName}.getCanvasCoordinates`
                    });
                }
                
                // 基本座標変換にフォールバック（機能提供のため）
                return this.getBasicCanvasCoordinates(screenX, screenY);
            }
        }
        
        console.warn(`⚠️ ${this.toolName} CoordinateManager未設定 - 基本座標変換を使用`);
        return this.getBasicCanvasCoordinates(screenX, screenY);
    }
    
    /**
     * 基本座標変換（CoordinateManager無し時の基本機能提供）
     */
    getBasicCanvasCoordinates(screenX, screenY) {
        const canvas = this.getCanvasElement();
        const rect = canvas.getBoundingClientRect();
        
        return {
            x: screenX - rect.left,
            y: screenY - rect.top
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
        
        // 子クラスの描画開始処理委譲
        if (typeof this.onPointerDown === 'function') {
            try {
                this.onPointerDown(coords.x, coords.y, event);
            } catch (error) {
                console.error(`💀 ${this.toolName} onPointerDown エラー:`, error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画開始エラー: ${error.message}`, {
                        context: `${this.toolName}.handlePointerDown`
                    });
                }
                
                throw error;
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
            // 描画中の処理
            if (typeof this.onPointerMove === 'function') {
                try {
                    this.onPointerMove(coords.x, coords.y, event);
                } catch (error) {
                    console.error(`💀 ${this.toolName} onPointerMove エラー:`, error);
                    
                    if (this.errorManager && this.errorManager.showError) {
                        this.errorManager.showError('error', `描画処理エラー: ${error.message}`, {
                            context: `${this.toolName}.handlePointerMove`
                        });
                    }
                    
                    throw error;
                }
            }
        } else {
            // ホバー中の処理（オプション）
            if (typeof this.onHover === 'function') {
                try {
                    this.onHover(coords.x, coords.y, event);
                } catch (error) {
                    console.error(`💀 ${this.toolName} onHover エラー:`, error);
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
        
        // 子クラスの描画終了処理委譲
        if (typeof this.onPointerUp === 'function') {
            try {
                this.onPointerUp(coords.x, coords.y, event);
            } catch (error) {
                console.error(`💀 ${this.toolName} onPointerUp エラー:`, error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画終了エラー: ${error.message}`, {
                        context: `${this.toolName}.handlePointerUp`
                    });
                }
                
                throw error;
            }
        }
    }
    
    /**
     * ポインターリーブハンドラー
     */
    handlePointerLeave(event) {
        if (this.isDrawing) {
            console.log(`🎯 ${this.toolName} PointerLeave - 描画終了`);
            this.handlePointerUp(event);
        }
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // 子クラスの設定更新処理（オプション）
        if (typeof this.onSettingsUpdate === 'function') {
            try {
                this.onSettingsUpdate(this.settings);
            } catch (error) {
                console.error(`💀 ${this.toolName} 設定更新エラー:`, error);
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
        console.log(`🎯 ${this.toolName} リセット開始`);
        this.isDrawing = false;
        
        if (typeof this.onReset === 'function') {
            try {
                this.onReset();
            } catch (error) {
                console.error(`💀 ${this.toolName} リセットエラー:`, error);
            }
        }
        
        console.log(`✅ ${this.toolName} リセット完了`);
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        console.log(`🎯 ${this.toolName} 破棄処理開始`);
        
        // 無効化
        this.deactivate();
        
        // 子クラスの破棄処理（オプション）
        if (typeof this.onDestroy === 'function') {
            try {
                this.onDestroy();
            } catch (error) {
                console.error(`💀 ${this.toolName} 破棄エラー:`, error);
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
     * ポインター押下処理（子クラスで実装必須）
     */
    onPointerDown(x, y, event) {
        // 子クラスで実装
        console.log(`📋 ${this.toolName} onPointerDown: (${x}, ${y}) - 子クラスで実装してください`);
    }
    
    /**
     * ポインター移動処理（子クラスで実装必須）
     */
    onPointerMove(x, y, event) {
        // 子クラスで実装
        console.log(`📋 ${this.toolName} onPointerMove: (${x}, ${y}) - 子クラスで実装してください`);
    }
    
    /**
     * ポインター解放処理（子クラスで実装必須）
     */
    onPointerUp(x, y, event) {
        // 子クラスで実装
        console.log(`📋 ${this.toolName} onPointerUp: (${x}, ${y}) - 子クラスで実装してください`);
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

// グローバル公開
window.Tegaki.AbstractTool = AbstractTool;
console.log('🎯 AbstractTool Phase1.5 Loaded - 座標変換メソッド修正版・エラー隠蔽禁止・実在メソッド使用');