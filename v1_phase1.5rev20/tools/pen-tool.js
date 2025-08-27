/**
 * 🖊️ PenTool Phase1.5 - ペン描画ツール（RecordManager連携強化版）
 * 📋 RESPONSIBILITY: ペン描画機能・PIXI.Graphics管理・非破壊編集対応
 * 🚫 PROHIBITION: Canvas管理・座標変換・Manager管理・エラー隠蔽
 * ✅ PERMISSION: 描画処理・PixiJS活用・RecordManager連携・設定管理
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・PixiJS標準機能最大活用・非破壊編集対応
 * 🔄 INTEGRATION: AbstractTool継承・CanvasManager連携・RecordManager記録・EventBus通信
 * 🔧 FIX: AbstractTool継承確実化・RecordManager連携強化・PixiJS v7標準活用
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.AbstractTool(constructor) - 基底クラス継承（abstract-tool.js確認済み）
 * ✅ window.Tegaki.RecordManagerInstance.recordDraw() - 描画記録（record-manager.js確認済み）
 * ✅ this.canvasManager.getLayer() - レイヤー取得（canvas-manager.js確認済み）
 * ✅ new PIXI.Graphics() - 描画オブジェクト作成（PixiJS v7標準）
 * ✅ graphics.lineStyle() - 線スタイル設定（PixiJS v7標準）
 * ✅ graphics.moveTo() - 描画開始点設定（PixiJS v7標準）
 * ✅ graphics.lineTo() - 線描画（PixiJS v7標準）
 * ✅ layer.addChild() - レイヤー追加（PixiJS Container標準）
 * ✅ super.onPointerDown/Move/Up() - 基底クラスメソッド（AbstractTool継承）
 * 
 * 📐 ペン描画フロー:
 * 描画開始 → PointerDown処理 → Path作成・PixiJS描画開始 → PointerMove継続描画 → 
 * PointerUp完了 → RecordManager記録 → レイヤー配置 → 終了
 * 依存関係: AbstractTool(基底)・CanvasManager(レイヤー)・RecordManagerInstance(記録)・PIXI.Graphics(描画)
 * 
 * 🚫 絶対禁止事項:
 * - try/catchでの握りつぶし（throw必須）
 * - 独自座標変換（AbstractTool委譲必須）
 * - 独自Canvas管理（CanvasManager委譲必須）
 * - 描画記録の省略（RecordManager連携必須）
 */

window.Tegaki = window.Tegaki || {};

/**
 * PenTool - ペン描画ツール（RecordManager連携強化版）
 */
class PenTool extends window.Tegaki.AbstractTool {
    constructor(canvasManager) {
        super(canvasManager, 'pen');
        console.log('🖊️ PenTool Phase1.5 作成開始 - RecordManager連携強化版');
        
        // ペン固有プロパティ
        this.currentPath = null;
        this.points = [];
        this.isDrawing = false;
        
        // RecordManager参照
        this.recordManager = window.Tegaki.RecordManagerInstance;
        if (!this.recordManager) {
            console.warn('⚠️ RecordManagerInstance not available - Undo/Redo機能が制限されます');
        }
        
        // ペン設定（PixiJS v7対応）
        this.penSettings = {
            color: 0x800000,          // 濃い赤
            lineWidth: 4,             // 線幅
            alpha: 1.0,               // 不透明度
            lineCap: PIXI.LINE_CAP.ROUND,       // 線端形状
            lineJoin: PIXI.LINE_JOIN.ROUND      // 線結合形状
        };
        
        console.log('✅ PenTool 作成完了:', {
            toolName: this.toolName,
            hasCanvasManager: !!this.canvasManager,
            hasRecordManager: !!this.recordManager,
            penSettings: this.penSettings
        });
    }
    
    /**
     * 描画開始処理（PointerDown時）
     */
    onPointerDown(x, y, event) {
        try {
            console.log(`🖊️ PenTool 描画開始: (${x}, ${y})`);
            
            // 新しい描画パス開始
            this.startNewPath(x, y);
            this.isDrawing = true;
            
            console.log(`✅ PenTool 描画開始完了: pathId=${this.currentPath ? 'created' : 'null'}`);
            
        } catch (error) {
            console.error('💀 PenTool 描画開始エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ペン描画開始エラー: ${error.message}`, {
                    context: 'PenTool.onPointerDown'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * 描画継続処理（PointerMove時）
     */
    onPointerMove(x, y, event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        try {
            // 点を追加して線を描画
            this.addPointToPath(x, y);
            
        } catch (error) {
            console.error('💀 PenTool 描画継続エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ペン描画継続エラー: ${error.message}`, {
                    context: 'PenTool.onPointerMove'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * 描画終了処理（PointerUp時）
     */
    onPointerUp(x, y, event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        try {
            console.log(`🖊️ PenTool 描画終了: (${x}, ${y})`);
            
            // 最終点を追加
            this.addPointToPath(x, y);
            
            // 描画を確定・記録
            this.finalizePath();
            
            this.isDrawing = false;
            console.log(`✅ PenTool 描画終了完了: points=${this.points.length}`);
            
        } catch (error) {
            console.error('💀 PenTool 描画終了エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ペン描画終了エラー: ${error.message}`, {
                    context: 'PenTool.onPointerUp'
                });
            }
            
            this.isDrawing = false;
            this.currentPath = null;
            throw error;
        }
    }
    
    /**
     * 新しい描画パス開始
     */
    startNewPath(x, y) {
        // PixiJS Graphics作成
        this.currentPath = new PIXI.Graphics();
        
        // 線スタイル設定（PixiJS v7準拠）
        this.currentPath.lineStyle({
            width: this.penSettings.lineWidth,
            color: this.penSettings.color,
            alpha: this.penSettings.alpha,
            cap: this.penSettings.lineCap,
            join: this.penSettings.lineJoin
        });
        
        // 描画開始点設定
        this.currentPath.moveTo(x, y);
        
        // 点配列初期化
        this.points = [{ x, y }];
        
        console.log(`🖊️ 新規パス作成完了: 開始点(${x}, ${y})`);
    }
    
    /**
     * パスに点を追加
     */
    addPointToPath(x, y) {
        if (!this.currentPath) return;
        
        // 線を描画
        this.currentPath.lineTo(x, y);
        
        // 点を記録
        this.points.push({ x, y });
        
        console.log(`🖊️ 点追加: (${x}, ${y}) - 総点数: ${this.points.length}`);
    }
    
    /**
     * パスを確定・レイヤー配置・記録
     */
    finalizePath() {
        if (!this.currentPath) return;
        
        try {
            // メインレイヤーに追加
            const mainLayer = this.canvasManager.getLayer('main');
            if (!mainLayer) {
                throw new Error('Main layer not found');
            }
            
            mainLayer.addChild(this.currentPath);
            console.log(`✅ パスをメインレイヤーに追加完了`);
            
            // RecordManagerに記録（Undo/Redo対応）
            if (this.recordManager && typeof this.recordManager.recordDraw === 'function') {
                this.recordManager.recordDraw(this.currentPath, 'main');
                console.log(`✅ RecordManager記録完了 - Undo/Redo対応`);
            } else {
                console.warn('⚠️ RecordManager記録スキップ - Undo/Redo機能が制限されます');
            }
            
            // 描画完了イベント発火
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit('pen:drawComplete', {
                    pathId: this.currentPath.id || 'unknown',
                    pointCount: this.points.length,
                    layerId: 'main'
                });
            }
            
            // クリーンアップ
            this.currentPath = null;
            this.points = [];
            
            console.log(`✅ パス確定・記録完了`);
            
        } catch (error) {
            console.error('💀 パス確定エラー:', error);
            
            // エラー時のクリーンアップ
            if (this.currentPath && this.currentPath.parent) {
                this.currentPath.parent.removeChild(this.currentPath);
            }
            this.currentPath = null;
            this.points = [];
            
            throw error;
        }
    }
    
    /**
     * ペン設定更新
     */
    setPenColor(color) {
        if (typeof color === 'string') {
            // 文字列カラーを16進数に変換
            this.penSettings.color = parseInt(color.replace('#', ''), 16);
        } else if (typeof color === 'number') {
            this.penSettings.color = color;
        } else {
            throw new Error('Invalid color format');
        }
        
        console.log(`🖊️ ペン色変更: ${this.penSettings.color.toString(16)}`);
    }
    
    setPenWidth(width) {
        if (typeof width !== 'number' || width <= 0) {
            throw new Error('Invalid pen width');
        }
        
        this.penSettings.lineWidth = width;
        console.log(`🖊️ ペン幅変更: ${width}`);
    }
    
    setPenOpacity(opacity) {
        if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
            throw new Error('Invalid opacity value (0-1)');
        }
        
        this.penSettings.alpha = opacity;
        console.log(`🖊️ ペン不透明度変更: ${opacity}`);
    }
    
    /**
     * 設定更新処理（AbstractToolからの委譲）
     */
    onSettingsUpdate(settings) {
        try {
            if (settings.color !== undefined) {
                this.setPenColor(settings.color);
            }
            if (settings.size !== undefined) {
                this.setPenWidth(settings.size);
            }
            if (settings.opacity !== undefined) {
                this.setPenOpacity(settings.opacity);
            }
            
            console.log(`🖊️ PenTool 設定更新完了:`, this.penSettings);
            
        } catch (error) {
            console.error('💀 PenTool 設定更新エラー:', error);
            throw error;
        }
    }
    
    /**
     * 現在のペン設定取得
     */
    getPenSettings() {
        return { ...this.penSettings };
    }
    
    /**
     * 有効化時処理
     */
    onActivate() {
        console.log('🖊️ PenTool 有効化 - ペン描画モード開始');
        
        // ペン専用の初期化処理があれば実行
        this.resetDrawingState();
    }
    
    /**
     * 無効化時処理
     */
    onDeactivate() {
        console.log('🖊️ PenTool 無効化 - 描画中の場合は中断');
        
        // 描画中の場合は強制終了
        if (this.isDrawing && this.currentPath) {
            try {
                this.finalizePath();
            } catch (error) {
                console.error('💀 PenTool 無効化時の描画中断エラー:', error);
                this.resetDrawingState();
            }
        }
        
        this.resetDrawingState();
    }
    
    /**
     * リセット処理
     */
    onReset() {
        console.log('🖊️ PenTool リセット - 描画状態クリア');
        this.resetDrawingState();
    }
    
    /**
     * 描画状態リセット
     */
    resetDrawingState() {
        this.isDrawing = false;
        this.currentPath = null;
        this.points = [];
        console.log('✅ PenTool 描画状態リセット完了');
    }
    
    /**
     * 破棄処理
     */
    onDestroy() {
        console.log('🖊️ PenTool 破棄処理開始');
        
        // 描画中の処理を安全に終了
        this.resetDrawingState();
        
        // RecordManager参照をクリア
        this.recordManager = null;
        
        console.log('✅ PenTool 破棄処理完了');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'PenTool',
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            hasCurrentPath: !!this.currentPath,
            pointCount: this.points.length,
            hasCanvasManager: !!this.canvasManager,
            hasRecordManager: !!this.recordManager,
            penSettings: this.penSettings
        };
    }
}

// グローバル公開
window.Tegaki.PenTool = PenTool;
console.log('🖊️ PenTool Phase1.5 Loaded - RecordManager連携強化版・PixiJS v7標準活用・非破壊編集対応');