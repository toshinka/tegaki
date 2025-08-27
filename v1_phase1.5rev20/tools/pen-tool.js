/**
 * PenTool Phase1.5 - ペン描画ツール（AbstractTool継承版）
 * 
 * 使用メソッド一覧:
 * ✅ window.Tegaki.AbstractTool (abstract-tool.js) - 継承
 * ✅ canvasManager.getDrawingLayer() (canvas-manager.js)
 * ✅ canvasManager.getPixiApp() (canvas-manager.js)
 * ✅ window.Tegaki.RecordManager.startDrawingAction() (record-manager.js)
 * ✅ window.Tegaki.RecordManager.endDrawingAction() (record-manager.js)
 * 
 * 描画フロー:
 * 1. 描画開始 → Graphics作成 → RecordManager記録開始
 * 2. 描画中 → 線を継続描画 → 座標追加
 * 3. 描画終了 → Graphics完成 → レイヤーに追加 → RecordManager記録終了
 * 
 * 依存関係: AbstractTool, CanvasManager, RecordManager
 */

// AbstractToolの存在確認
if (!window.Tegaki || !window.Tegaki.AbstractTool) {
    console.error('💀 PenTool: AbstractTool が未ロード');
    throw new Error('AbstractTool must be loaded before PenTool');
}

class PenTool extends window.Tegaki.AbstractTool {
    constructor(canvasManager) {
        super(canvasManager, 'pen');
        console.log('🖊️ PenTool Phase1.5 作成開始');
        
        // ペン固有の設定
        this.settings = {
            color: 0x000000,
            size: 3,
            opacity: 1.0,
            smoothing: true
        };
        
        // 描画状態
        this.currentGraphics = null;
        this.currentPath = [];
        this.recordManager = window.Tegaki.RecordManager;
        
        console.log('✅ PenTool Phase1.5 作成完了');
    }
    
    /**
     * 描画開始処理
     */
    onDrawStart(x, y, event) {
        console.log(`🖊️ ペン描画開始: (${x}, ${y})`);
        
        try {
            // Graphics作成
            this.createNewGraphics();
            
            // 描画開始点設定
            this.currentGraphics.moveTo(x, y);
            this.currentPath = [{ x, y }];
            
            // 履歴記録開始
            if (this.recordManager && this.recordManager.startDrawingAction) {
                this.recordManager.startDrawingAction('pen', {
                    startPoint: { x, y },
                    settings: { ...this.settings }
                });
            }
            
            console.log('✅ ペン描画開始処理完了');
            
        } catch (error) {
            console.error('💀 ペン描画開始失敗:', error);
            if (this.errorManager) {
                this.errorManager.handleError(error, 'PenTool.onDrawStart');
            }
        }
    }
    
    /**
     * 描画処理
     */
    onDraw(x, y, event) {
        if (!this.currentGraphics) return;
        
        try {
            // 線を描画
            this.currentGraphics.lineTo(x, y);
            
            // パス記録
            this.currentPath.push({ x, y });
            
            // スムージング適用（オプション）
            if (this.settings.smoothing && this.currentPath.length > 2) {
                this.applySmoothLine();
            }
            
        } catch (error) {
            console.error('💀 ペン描画失敗:', error);
            if (this.errorManager) {
                this.errorManager.handleError(error, 'PenTool.onDraw');
            }
        }
    }
    
    /**
     * 描画終了処理
     */
    onDrawEnd(x, y, event) {
        console.log(`🖊️ ペン描画終了: (${x}, ${y})`);
        
        try {
            if (this.currentGraphics) {
                // 最終点まで描画
                this.currentGraphics.lineTo(x, y);
                this.currentPath.push({ x, y });
                
                // 描画レイヤーに追加
                this.addGraphicsToLayer();
                
                // 履歴記録終了
                if (this.recordManager && this.recordManager.endDrawingAction) {
                    this.recordManager.endDrawingAction({
                        endPoint: { x, y },
                        path: this.currentPath,
                        graphics: this.currentGraphics
                    });
                }
                
                console.log('✅ ペン描画終了処理完了');
            }
            
            // 状態リセット
            this.currentGraphics = null;
            this.currentPath = [];
            
        } catch (error) {
            console.error('💀 ペン描画終了失敗:', error);
            if (this.errorManager) {
                this.errorManager.handleError(error, 'PenTool.onDrawEnd');
            }
        }
    }
    
    /**
     * 新しいGraphics作成
     */
    createNewGraphics() {
        // PixiJS Graphics作成
        this.currentGraphics = new PIXI.Graphics();
        
        // スタイル設定
        this.currentGraphics.lineStyle({
            width: this.settings.size,
            color: this.settings.color,
            alpha: this.settings.opacity,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        console.log('✅ Graphics作成完了:', this.settings);
    }
    
    /**
     * Graphicsをレイヤーに追加
     */
    addGraphicsToLayer() {
        try {
            const drawingLayer = this.canvasManager.getDrawingLayer();
            if (drawingLayer && this.currentGraphics) {
                drawingLayer.addChild(this.currentGraphics);
                console.log('✅ Graphics をレイヤーに追加完了');
                
                // 画面更新
                const pixiApp = this.canvasManager.getPixiApp();
                if (pixiApp) {
                    pixiApp.render();
                }
            }
        } catch (error) {
            console.error('💀 Graphics レイヤー追加失敗:', error);
        }
    }
    
    /**
     * 線のスムージング適用
     */
    applySmoothLine() {
        if (this.currentPath.length < 3) return;
        
        try {
            const path = this.currentPath;
            const lastIndex = path.length - 1;
            
            if (lastIndex >= 2) {
                const p1 = path[lastIndex - 2];
                const p2 = path[lastIndex - 1];
                const p3 = path[lastIndex];
                
                // 制御点計算
                const cp1x = p1.x + (p2.x - p1.x) * 0.5;
                const cp1y = p1.y + (p2.y - p1.y) * 0.5;
                const cp2x = p2.x + (p3.x - p2.x) * 0.5;
                const cp2y = p2.y + (p3.y - p2.y) * 0.5;
                
                // 二次ベジェ曲線で描画
                this.currentGraphics.quadraticCurveTo(p2.x, p2.y, cp2x, cp2y);
            }
            
        } catch (error) {
            console.error('💀 スムージング失敗:', error);
        }
    }
    
    /**
     * ペン設定更新
     */
    onSettingsUpdate(newSettings) {
        console.log('🖊️ ペン設定更新:', newSettings);
        
        // 色設定
        if (newSettings.color !== undefined) {
            this.settings.color = newSettings.color;
        }
        
        // サイズ設定
        if (newSettings.size !== undefined) {
            this.settings.size = Math.max(1, Math.min(50, newSettings.size));
        }
        
        // 透明度設定
        if (newSettings.opacity !== undefined) {
            this.settings.opacity = Math.max(0, Math.min(1, newSettings.opacity));
        }
        
        // スムージング設定
        if (newSettings.smoothing !== undefined) {
            this.settings.smoothing = newSettings.smoothing;
        }
        
        console.log('✅ ペン設定更新完了:', this.settings);
    }
    
    /**
     * 有効化時処理
     */
    onActivate() {
        console.log('🖊️ ペンツール有効化');
        
        // カーソルスタイル変更
        const canvas = this.getCanvasElement();
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
    }
    
    /**
     * 無効化時処理
     */
    onDeactivate() {
        console.log('🖊️ ペンツール無効化');
        
        // 未完了の描画があれば強制終了
        if (this.currentGraphics && this.isDrawing) {
            this.addGraphicsToLayer();
        }
        
        // 状態リセット
        this.currentGraphics = null;
        this.currentPath = [];
        
        // カーソルスタイルリセット
        const canvas = this.getCanvasElement();
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    }
    
    /**
     * リセット処理
     */
    onReset() {
        this.currentGraphics = null;
        this.currentPath = [];
        console.log('🖊️ ペンツール リセット完了');
    }
    
    /**
     * プレビュー描画（オプション）
     */
    showPreview(x, y) {
        // TODO: ペン先のプレビュー表示
    }
    
    /**
     * ペン情報取得
     */
    getPenInfo() {
        return {
            name: this.toolName,
            settings: { ...this.settings },
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            currentPathLength: this.currentPath.length
        };
    }
}

// グローバル公開（最重要）
window.Tegaki.PenTool = PenTool;
console.log('🖊️ PenTool Phase1.5 Loaded - AbstractTool継承確実版');