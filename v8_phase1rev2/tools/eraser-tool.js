/**
 * 🧹 EraserTool Phase1.5 - 消しゴムツール（シンプル実装版）
 * 📋 RESPONSIBILITY: 消去機能・既存描画削除・Phase1.5簡易実装
 * 🚫 PROHIBITION: 複雑な消去処理・Canvas管理・座標変換・エラー隠蔽
 * ✅ PERMISSION: 簡易消去・PixiJS hit-test・RecordManager連携・設定管理
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・シンプル実装・Phase2高度機能準備
 * 🔄 INTEGRATION: AbstractTool継承・CanvasManager連携・RecordManager記録・PixiJS活用
 * 🔧 FIX: AbstractTool継承確実化・簡易消去実装・Phase2拡張準備
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.AbstractTool(constructor) - 基底クラス継承（abstract-tool.js確認済み）
 * ✅ window.Tegaki.RecordManagerInstance.recordErase() - 消去記録（record-manager.js確認済み）
 * ✅ this.canvasManager.getLayer() - レイヤー取得（canvas-manager.js確認済み）
 * ✅ layer.children - 子要素配列（PixiJS Container標準）
 * ✅ graphics.containsPoint() - 点含有判定（PixiJS Graphics標準）
 * ✅ layer.removeChild() - 子要素削除（PixiJS Container標準）
 * ✅ super.onPointerDown/Move/Up() - 基底クラスメソッド（AbstractTool継承）
 * 
 * 📐 消去フロー:
 * 消去開始 → PointerDown処理 → hit-test判定 → 対象Graphics削除 → 
 * RecordManager記録 → 継続消去 → PointerUp完了 → 終了
 * 依存関係: AbstractTool(基底)・CanvasManager(レイヤー)・RecordManagerInstance(記録)・PixiJS hit-test
 * 
 * 🚫 絶対禁止事項:
 * - try/catchでの握りつぶし（throw必須）
 * - 独自座標変換（AbstractTool委譲必須）
 * - 複雑な消去アルゴリズム（Phase2で実装）
 * - 消去記録の省略（RecordManager連携必須）
 */

window.Tegaki = window.Tegaki || {};

/**
 * EraserTool - 消しゴムツール（シンプル実装版）
 */
class EraserTool extends window.Tegaki.AbstractTool {
    constructor(canvasManager) {
        super(canvasManager, 'eraser');
        console.log('🧹 EraserTool Phase1.5 作成開始 - シンプル実装版');
        
        // 消しゴム固有プロパティ
        this.isErasing = false;
        this.erasedItems = [];
        
        // RecordManager参照
        this.recordManager = window.Tegaki.RecordManagerInstance;
        if (!this.recordManager) {
            console.warn('⚠️ RecordManagerInstance not available - Undo/Redo機能が制限されます');
        }
        
        // 消しゴム設定
        this.eraserSettings = {
            size: 20,                 // 消しゴムサイズ（ピクセル）
            mode: 'object'            // 消去モード: 'object' | 'pixel'（Phase2で拡張）
        };
        
        console.log('✅ EraserTool 作成完了:', {
            toolName: this.toolName,
            hasCanvasManager: !!this.canvasManager,
            hasRecordManager: !!this.recordManager,
            eraserSettings: this.eraserSettings
        });
    }
    
    /**
     * 消去開始処理（PointerDown時）
     */
    onPointerDown(x, y, event) {
        try {
            console.log(`🧹 EraserTool 消去開始: (${x}, ${y})`);
            
            this.isErasing = true;
            this.erasedItems = [];
            
            // 指定位置の要素を消去
            this.eraseAtPosition(x, y);
            
            console.log(`✅ EraserTool 消去開始完了`);
            
        } catch (error) {
            console.error('💀 EraserTool 消去開始エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `消しゴム開始エラー: ${error.message}`, {
                    context: 'EraserTool.onPointerDown'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * 消去継続処理（PointerMove時）
     */
    onPointerMove(x, y, event) {
        if (!this.isErasing) return;
        
        try {
            // ドラッグ中の連続消去
            this.eraseAtPosition(x, y);
            
        } catch (error) {
            console.error('💀 EraserTool 消去継続エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `消しゴム継続エラー: ${error.message}`, {
                    context: 'EraserTool.onPointerMove'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * 消去終了処理（PointerUp時）
     */
    onPointerUp(x, y, event) {
        if (!this.isErasing) return;
        
        try {
            console.log(`🧹 EraserTool 消去終了: (${x}, ${y})`);
            
            // 最終位置で消去
            this.eraseAtPosition(x, y);
            
            // 消去操作を記録
            this.recordEraseOperation();
            
            this.isErasing = false;
            console.log(`✅ EraserTool 消去終了完了: 消去数=${this.erasedItems.length}`);
            
        } catch (error) {
            console.error('💀 EraserTool 消去終了エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `消しゴム終了エラー: ${error.message}`, {
                    context: 'EraserTool.onPointerUp'
                });
            }
            
            this.isErasing = false;
            this.erasedItems = [];
            throw error;
        }
    }
    
    /**
     * 指定位置での消去処理
     */
    eraseAtPosition(x, y) {
        try {
            // メインレイヤー取得
            const mainLayer = this.canvasManager.getLayer('main');
            if (!mainLayer) {
                throw new Error('Main layer not found');
            }
            
            // レイヤー内の子要素を確認
            const children = mainLayer.children.slice(); // コピーを作成（削除による配列変更回避）
            let erasedCount = 0;
            
            for (const child of children) {
                if (this.shouldEraseItem(child, x, y)) {
                    this.eraseItem(child, mainLayer);
                    erasedCount++;
                }
            }
            
            if (erasedCount > 0) {
                console.log(`🧹 位置(${x}, ${y})で${erasedCount}個のアイテムを消去`);
            }
            
        } catch (error) {
            console.error('💀 指定位置消去エラー:', error);
            throw error;
        }
    }
    
    /**
     * アイテム消去判定
     */
    shouldEraseItem(item, x, y) {
        try {
            // PixiJS Graphics の場合、containsPoint で判定
            if (item instanceof PIXI.Graphics) {
                const point = new PIXI.Point(x, y);
                return item.containsPoint(point);
            }
            
            // その他の DisplayObject の場合、境界ボックスで判定
            if (item.getBounds) {
                const bounds = item.getBounds();
                return bounds.contains(x, y);
            }
            
            // 判定できない場合は消去しない
            return false;
            
        } catch (error) {
            console.error('💀 消去判定エラー:', error);
            return false; // エラー時は安全側で消去しない
        }
    }
    
    /**
     * アイテム消去実行
     */
    eraseItem(item, layer) {
        try {
            // レイヤーから削除
            layer.removeChild(item);
            
            // 消去記録に追加
            this.erasedItems.push({
                item: item,
                layer: layer,
                timestamp: Date.now()
            });
            
            console.log(`🧹 アイテム消去: ${item.constructor.name}`);
            
        } catch (error) {
            console.error('💀 アイテム消去実行エラー:', error);
            throw error;
        }
    }
    
    /**
     * 消去操作をRecordManagerに記録
     */
    recordEraseOperation() {
        if (this.erasedItems.length === 0) {
            console.log('📋 消去対象なし - 記録スキップ');
            return;
        }
        
        try {
            if (this.recordManager && typeof this.recordManager.recordErase === 'function') {
                const eraseInfo = {
                    erasedItems: this.erasedItems.map(record => ({
                        itemId: record.item.id || 'unknown',
                        layerId: 'main',
                        itemType: record.item.constructor.name,
                        timestamp: record.timestamp
                    })),
                    eraserSize: this.eraserSettings.size,
                    totalErased: this.erasedItems.length
                };
                
                this.recordManager.recordErase(eraseInfo);
                console.log(`✅ RecordManager消去記録完了 - ${this.erasedItems.length}個`);
            } else {
                console.warn('⚠️ RecordManager消去記録スキップ - Undo/Redo機能が制限されます');
            }
            
            // 消去完了イベント発火
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit('eraser:eraseComplete', {
                    erasedCount: this.erasedItems.length,
                    layerId: 'main'
                });
            }
            
        } catch (error) {
            console.error('💀 消去記録エラー:', error);
            throw error;
        }
    }
    
    /**
     * 消しゴムサイズ設定
     */
    setEraserSize(size) {
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('Invalid eraser size');
        }
        
        this.eraserSettings.size = size;
        console.log(`🧹 消しゴムサイズ変更: ${size}`);
    }
    
    /**
     * 設定更新処理（AbstractToolからの委譲）
     */
    onSettingsUpdate(settings) {
        try {
            if (settings.size !== undefined) {
                this.setEraserSize(settings.size);
            }
            
            console.log(`🧹 EraserTool 設定更新完了:`, this.eraserSettings);
            
        } catch (error) {
            console.error('💀 EraserTool 設定更新エラー:', error);
            throw error;
        }
    }
    
    /**
     * 現在の消しゴム設定取得
     */
    getEraserSettings() {
        return { ...this.eraserSettings };
    }
    
    /**
     * 有効化時処理
     */
    onActivate() {
        console.log('🧹 EraserTool 有効化 - 消しゴムモード開始');
        this.resetErasingState();
    }
    
    /**
     * 無効化時処理
     */
    onDeactivate() {
        console.log('🧹 EraserTool 無効化 - 消去中の場合は記録');
        
        // 消去中の場合は記録して終了
        if (this.isErasing && this.erasedItems.length > 0) {
            try {
                this.recordEraseOperation();
            } catch (error) {
                console.error('💀 EraserTool 無効化時の記録エラー:', error);
                this.resetErasingState();
            }
        }
        
        this.resetErasingState();
    }
    
    /**
     * リセット処理
     */
    onReset() {
        console.log('🧹 EraserTool リセット - 消去状態クリア');
        this.resetErasingState();
    }
    
    /**
     * 消去状態リセット
     */
    resetErasingState() {
        this.isErasing = false;
        this.erasedItems = [];
        console.log('✅ EraserTool 消去状態リセット完了');
    }
    
    /**
     * 破棄処理
     */
    onDestroy() {
        console.log('🧹 EraserTool 破棄処理開始');
        
        // 消去中の処理を安全に終了
        this.resetErasingState();
        
        // RecordManager参照をクリア
        this.recordManager = null;
        
        console.log('✅ EraserTool 破棄処理完了');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'EraserTool',
            toolName: this.toolName,
            isActive: this.isActive,
            isErasing: this.isErasing,
            erasedItemsCount: this.erasedItems.length,
            hasCanvasManager: !!this.canvasManager,
            hasRecordManager: !!this.recordManager,
            eraserSettings: this.eraserSettings
        };
    }
}

// グローバル公開
window.Tegaki.EraserTool = EraserTool;
console.log('🧹 EraserTool Phase1.5 Loaded - シンプル実装版・RecordManager連携・PixiJS hit-test活用');