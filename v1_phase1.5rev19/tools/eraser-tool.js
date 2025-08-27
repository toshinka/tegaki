/**
 * EraserTool Phase1.5 - 消しゴムツール（AbstractTool継承版）
 * 
 * 使用メソッド一覧:
 * ✅ window.Tegaki.AbstractTool (abstract-tool.js) - 継承
 * ✅ canvasManager.getDrawingLayer() (canvas-manager.js)
 * ✅ canvasManager.getPixiApp() (canvas-manager.js)
 * ✅ window.Tegaki.RecordManager.startDrawingAction() (record-manager.js)
 * ✅ window.Tegaki.RecordManager.endDrawingAction() (record-manager.js)
 * 
 * 消去フロー:
 * 1. 消去開始 → 消去範囲設定 → RecordManager記録開始
 * 2. 消去中 → 衝突検出 → オブジェクト削除 → 視覚フィードバック
 * 3. 消去終了 → 削除完了 → RecordManager記録終了
 * 
 * 依存関係: AbstractTool, CanvasManager, RecordManager
 */

// AbstractToolの存在確認
if (!window.Tegaki || !window.Tegaki.AbstractTool) {
    console.error('💀 EraserTool: AbstractTool が未ロード');
    throw new Error('AbstractTool must be loaded before EraserTool');
}

class EraserTool extends window.Tegaki.AbstractTool {
    constructor(canvasManager) {
        super(canvasManager, 'eraser');
        console.log('🧹 EraserTool Phase1.5 作成開始');
        
        // 消しゴム固有の設定
        this.settings = {
            size: 20,
            hardness: 1.0, // 0.0-1.0 (soft-hard)
            opacity: 1.0
        };
        
        // 消去状態
        this.erasingArea = null;
        this.erasedObjects = [];
        this.recordManager = window.Tegaki.RecordManager;
        
        console.log('✅ EraserTool Phase1.5 作成完了');
    }
    
    /**
     * 消去開始処理
     */
    onDrawStart(x, y, event) {
        console.log(`🧹 消去開始: (${x}, ${y})`);
        
        try {
            // 消去エリア作成
            this.createErasingArea(x, y);
            
            // 履歴記録開始
            if (this.recordManager && this.recordManager.startDrawingAction) {
                this.recordManager.startDrawingAction('eraser', {
                    startPoint: { x, y },
                    settings: { ...this.settings }
                });
            }
            
            // 初回消去実行
            this.performErase(x, y);
            
            console.log('✅ 消去開始処理完了');
            
        } catch (error) {
            console.error('💀 消去開始失敗:', error);
            if (this.errorManager) {
                this.errorManager.handleError(error, 'EraserTool.onDrawStart');
            }
        }
    }
    
    /**
     * 消去処理
     */
    onDraw(x, y, event) {
        if (!this.erasingArea) return;
        
        try {
            // 消去エリア移動
            this.updateErasingArea(x, y);
            
            // 消去実行
            this.performErase(x, y);
            
        } catch (error) {
            console.error('💀 消去失敗:', error);
            if (this.errorManager) {
                this.errorManager.handleError(error, 'EraserTool.onDraw');
            }
        }
    }
    
    /**
     * 消去終了処理
     */
    onDrawEnd(x, y, event) {
        console.log(`🧹 消去終了: (${x}, ${y})`);
        
        try {
            // 最終消去
            this.performErase(x, y);
            
            // 消去エリア削除
            this.removeErasingArea();
            
            // 履歴記録終了
            if (this.recordManager && this.recordManager.endDrawingAction) {
                this.recordManager.endDrawingAction({
                    endPoint: { x, y },
                    erasedObjects: this.erasedObjects
                });
            }
            
            console.log('✅ 消去終了処理完了:', this.erasedObjects.length, '個のオブジェクトを消去');
            
            // 状態リセット
            this.erasedObjects = [];
            
        } catch (error) {
            console.error('💀 消去終了失敗:', error);
            if (this.errorManager) {
                this.errorManager.handleError(error, 'EraserTool.onDrawEnd');
            }
        }
    }
    
    /**
     * 消去エリア作成
     */
    createErasingArea(x, y) {
        // PixiJS Graphics作成（消去範囲の視覚表示）
        this.erasingArea = new PIXI.Graphics();
        
        // 消去範囲スタイル（半透明の円）
        this.erasingArea.beginFill(0xff0000, 0.2);
        this.erasingArea.lineStyle(2, 0xff0000, 0.5);
        this.erasingArea.drawCircle(0, 0, this.settings.size);
        this.erasingArea.endFill();
        
        // 位置設定
        this.erasingArea.x = x;
        this.erasingArea.y = y;
        
        // レイヤーに追加（一時表示）
        const drawingLayer = this.canvasManager.getDrawingLayer();
        if (drawingLayer) {
            drawingLayer.addChild(this.erasingArea);
        }
        
        console.log('✅ 消去エリア作成完了:', this.settings.size);
    }
    
    /**
     * 消去エリア更新
     */
    updateErasingArea(x, y) {
        if (this.erasingArea) {
            this.erasingArea.x = x;
            this.erasingArea.y = y;
        }
    }
    
    /**
     * 消去エリア削除
     */
    removeErasingArea() {
        if (this.erasingArea && this.erasingArea.parent) {
            this.erasingArea.parent.removeChild(this.erasingArea);
            this.erasingArea.destroy();
            this.erasingArea = null;
        }
    }
    
    /**
     * 消去実行
     */
    performErase(x, y) {
        try {
            const drawingLayer = this.canvasManager.getDrawingLayer();
            if (!drawingLayer) return;
            
            const eraseRadius = this.settings.size;
            const erasedInThisAction = [];
            
            // レイヤー内の全子オブジェクトをチェック
            for (let i = drawingLayer.children.length - 1; i >= 0; i--) {
                const child = drawingLayer.children[i];
                
                // 消去エリアは除外
                if (child === this.erasingArea) continue;
                
                // 衝突判定
                if (this.isObjectInEraseArea(child, x, y, eraseRadius)) {
                    // オブジェクトを削除
                    drawingLayer.removeChild(child);
                    
                    // 削除記録
                    erasedInThisAction.push({
                        object: child,
                        position: { x: child.x, y: child.y },
                        timestamp: Date.now()
                    });
                    
                    // Graphicsを破棄
                    if (child.destroy) {
                        child.destroy();
                    }
                }
            }
            
            // 削除したオブジェクトを履歴に追加
            this.erasedObjects.push(...erasedInThisAction);
            
            // 画面更新
            if (erasedInThisAction.length > 0) {
                const pixiApp = this.canvasManager.getPixiApp();
                if (pixiApp) {
                    pixiApp.render();
                }
            }
            
        } catch (error) {
            console.error('💀 消去実行失敗:', error);
        }
    }
    
    /**
     * オブジェクトが消去範囲内かチェック
     */
    isObjectInEraseArea(pixiObject, eraseX, eraseY, eraseRadius) {
        try {
            // オブジェクトの境界ボックス取得
            const bounds = pixiObject.getBounds();
            
            // 境界ボックスの中心点計算
            const objCenterX = bounds.x + bounds.width / 2;
            const objCenterY = bounds.y + bounds.height / 2;
            
            // 距離計算
            const distance = Math.sqrt(
                Math.pow(eraseX - objCenterX, 2) + 
                Math.pow(eraseY - objCenterY, 2)
            );
            
            // 消去範囲内かチェック
            const threshold = eraseRadius + Math.min(bounds.width, bounds.height) / 2;
            return distance < threshold;
            
        } catch (error) {
            console.error('💀 衝突判定失敗:', error);
            return false;
        }
    }
    
    /**
     * 消しゴム設定更新
     */
    onSettingsUpdate(newSettings) {
        console.log('🧹 消しゴム設定更新:', newSettings);
        
        // サイズ設定
        if (newSettings.size !== undefined) {
            this.settings.size = Math.max(5, Math.min(100, newSettings.size));
        }
        
        // 硬さ設定
        if (newSettings.hardness !== undefined) {
            this.settings.hardness = Math.max(0, Math.min(1, newSettings.hardness));
        }
        
        // 透明度設定
        if (newSettings.opacity !== undefined) {
            this.settings.opacity = Math.max(0, Math.min(1, newSettings.opacity));
        }
        
        console.log('✅ 消しゴム設定更新完了:', this.settings);
    }
    
    /**
     * 有効化時処理
     */
    onActivate() {
        console.log('🧹 消しゴムツール有効化');
        
        // カーソルスタイル変更
        const canvas = this.getCanvasElement();
        if (canvas) {
            canvas.style.cursor = 'grab';
        }
    }
    
    /**
     * 無効化時処理
     */
    onDeactivate() {
        console.log('🧹 消しゴムツール無効化');
        
        // 消去エリア削除
        this.removeErasingArea();
        
        // 状態リセット
        this.erasedObjects = [];
        
        // カーソルスタイルリセット
        const canvas = this.getCanvasElement();
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    }
    
    /**
     * ホバー処理（消去範囲プレビュー）
     */
    onHover(x, y, event) {
        // TODO: 消去範囲のプレビュー表示
    }
    
    /**
     * リセット処理
     */
    onReset() {
        this.removeErasingArea();
        this.erasedObjects = [];
        console.log('🧹 消しゴムツール リセット完了');
    }
    
    /**
     * 全消去（特殊機能）
     */
    eraseAll() {
        try {
            console.log('🧹 全消去実行');
            
            const drawingLayer = this.canvasManager.getDrawingLayer();
            if (!drawingLayer) return;
            
            const allObjects = [];
            
            // 全オブジェクト削除
            for (let i = drawingLayer.children.length - 1; i >= 0; i--) {
                const child = drawingLayer.children[i];
                drawingLayer.removeChild(child);
                
                allObjects.push({
                    object: child,
                    position: { x: child.x, y: child.y },
                    timestamp: Date.now()
                });
                
                if (child.destroy) {
                    child.destroy();
                }
            }
            
            // 履歴記録
            if (this.recordManager && this.recordManager.recordAction) {
                this.recordManager.recordAction('eraseAll', {
                    erasedObjects: allObjects
                });
            }
            
            // 画面更新
            const pixiApp = this.canvasManager.getPixiApp();
            if (pixiApp) {
                pixiApp.render();
            }
            
            console.log('✅ 全消去完了:', allObjects.length, '個のオブジェクトを削除');
            
        } catch (error) {
            console.error('💀 全消去失敗:', error);
        }
    }
    
    /**
     * 消しゴム情報取得
     */
    getEraserInfo() {
        return {
            name: this.toolName,
            settings: { ...this.settings },
            isActive: this.isActive,
            isErasing: this.isDrawing,
            erasedCount: this.erasedObjects.length
        };
    }
}

// グローバル公開（最重要）
window.Tegaki.EraserTool = EraserTool;
console.log('🧹 EraserTool Phase1.5 Loaded - AbstractTool継承確実版');