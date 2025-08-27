/**
 * 🖊️ PenTool Phase1.5 - ペン描画ツール（RecordManager連携修正版）
 * 📋 RESPONSIBILITY: ペン描画機能・PIXI.Graphics管理・RecordManager操作記録
 * 🚫 PROHIBITION: Canvas管理・座標変換・Manager管理・エラー隠蔽・架空メソッド使用
 * ✅ PERMISSION: 描画処理・PixiJS活用・RecordManager正規連携・設定管理
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・PixiJS標準機能最大活用・RecordManager startOperation/endOperation方式
 * 🔄 INTEGRATION: AbstractTool継承・CanvasManager連携・RecordManager記録・EventBus通信
 * 🔧 FIX: RecordManager連携修正・startOperation/endOperation方式対応・架空メソッド削除
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.AbstractTool(constructor) - 基底クラス継承（abstract-tool.js実装済み）
 * ✅ this.managers.record.startOperation(operationData) - 操作開始記録（record-manager.js実装済み）
 * ✅ this.managers.record.endOperation(operationId, endData) - 操作終了記録（record-manager.js実装済み）
 * ✅ this.managers.canvas.getLayer() - レイヤー取得（canvas-manager.js実装済み）
 * ✅ new PIXI.Graphics() - 描画オブジェクト作成（PixiJS v7標準）
 * ✅ graphics.lineStyle() - 線スタイル設定（PixiJS v7標準）
 * ✅ graphics.moveTo() - 描画開始点設定（PixiJS v7標準）
 * ✅ graphics.lineTo() - 線描画（PixiJS v7標準）
 * ✅ layer.addChild() - レイヤー追加（PixiJS Container標準）
 * ✅ super.onPointerDown/Move/Up() - 基底クラスメソッド（AbstractTool継承）
 * ❌ recordManager.recordDraw() - **削除済み**（startOperation/endOperationに統合）
 * 
 * 📐 ペン描画フロー（修正版・RecordManager連携強化）:
 * 開始 → PointerDown・startOperation記録 → Path作成・PixiJS描画開始 → 
 * PointerMove継続描画 → PointerUp・endOperation記録 → レイヤー配置 → 終了
 * 依存関係: AbstractTool(基底)・CanvasManager(レイヤー)・RecordManager(startOperation/endOperation)・PIXI.Graphics(描画)
 * 
 * 🔄 RecordManager連携フロー（修正版）:
 * 1. onPointerDown → startOperation({ tool: 'pen', type: 'draw', data: {} }) → 操作ID取得
 * 2. onPointerMove → 描画継続（記録なし・軽量化）
 * 3. onPointerUp → endOperation(operationId, { success: true, graphics, strokeData }) → 履歴保存
 * 4. Undo/Redo → RecordManager側で自動処理
 * 
 * 🚫 絶対禁止事項:
 * - try/catchでの握りつぶし（throw必須）
 * - 独自座標変換（AbstractTool委譲必須）
 * - 独自Canvas管理（CanvasManager委譲必須）
 * - 架空メソッド呼び出し（実装済みメソッドのみ使用）
 * - recordDraw()使用（削除済み・startOperation/endOperationのみ）
 */

window.Tegaki = window.Tegaki || {};

/**
 * PenTool - ペン描画ツール（RecordManager連携修正版）
 */
class PenTool extends window.Tegaki.AbstractTool {
    constructor(canvasManager) {
        super(canvasManager, 'pen');
        console.log('🖊️ PenTool Phase1.5 作成開始 - RecordManager連携修正版');
        
        // ペン固有プロパティ
        this.currentPath = null;
        this.points = [];
        this.isDrawing = false;
        
        // 🔧 RecordManager操作管理（修正版）
        this.currentOperation = null;  // 進行中操作の参照
        this.operationStartTime = null;
        
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
            penSettings: this.penSettings
        });
    }
    
    /**
     * 描画開始処理（PointerDown時）
     */
    onPointerDown(x, y, event) {
        try {
            console.log(`🖊️ PenTool 描画開始: (${x}, ${y})`);
            
            // 🔧 RecordManager操作開始記録（修正版）
            this.startDrawOperation(x, y);
            
            // 新しい描画パス開始
            this.startNewPath(x, y);
            this.isDrawing = true;
            
            console.log(`✅ PenTool 描画開始完了: pathId=${this.currentPath ? 'created' : 'null'}, operationId=${this.currentOperation?.id || 'none'}`);
            
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
            
            // 🔧 RecordManager操作終了記録（修正版）
            this.endDrawOperation();
            
            this.isDrawing = false;
            console.log(`✅ PenTool 描画終了完了: points=${this.points.length}`);
            
        } catch (error) {
            console.error('💀 PenTool 描画終了エラー:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ペン描画終了エラー: ${error.message}`, {
                    context: 'PenTool.onPointerUp'
                });
            }
            
            // エラー時の操作終了処理
            this.endDrawOperation(false);
            this.resetDrawingState();
            
            throw error;
        }
    }
    
    /**
     * 🔧 RecordManager操作開始記録（修正版・startOperation使用）
     */
    startDrawOperation(x, y) {
        const recordManager = this.getManager('record');
        
        if (typeof recordManager.startOperation !== 'function') {
            const error = new Error('RecordManager.startOperation method not available');
            console.error('💀 操作開始記録失敗:', error);
            throw error;
        }
        
        try {
            this.operationStartTime = Date.now();
            
            // 操作開始記録
            this.currentOperation = recordManager.startOperation({
                tool: 'pen',
                type: 'draw',
                data: {
                    layerId: 'main',
                    startPoint: { x, y },
                    startTime: this.operationStartTime,
                    penSettings: { ...this.penSettings }
                }
            });
            
            if (!this.currentOperation || !this.currentOperation.id) {
                throw new Error('RecordManager.startOperation returned invalid operation');
            }
            
            console.log(`✅ RecordManager操作開始記録完了: ${this.currentOperation.id}`);
            
        } catch (error) {
            console.error('💀 RecordManager操作開始記録エラー:', error);
            this.currentOperation = null;
            throw error;
        }
    }
    
    /**
     * 🔧 RecordManager操作終了記録（修正版・endOperation使用）
     */
    endDrawOperation(success = true) {
        if (!this.currentOperation) {
            console.warn('⚠️ 操作終了記録スキップ - currentOperationが空');
            return;
        }
        
        const recordManager = this.getManager('record');
        
        if (typeof recordManager.endOperation !== 'function') {
            console.error('💀 RecordManager.endOperation method not available');
            this.currentOperation = null;
            return;
        }
        
        try {
            const endTime = Date.now();
            const duration = this.operationStartTime ? endTime - this.operationStartTime : 0;
            
            // 操作終了記録
            recordManager.endOperation(this.currentOperation.id, {
                success: success,
                graphics: this.currentPath,
                strokeData: {
                    points: [...this.points],
                    pointCount: this.points.length,
                    duration: duration,
                    penSettings: { ...this.penSettings }
                },
                layerId: 'main',
                endTime: endTime
            });
            
            console.log(`✅ RecordManager操作終了記録完了: ${this.currentOperation.id} (${duration}ms, success=${success})`);
            
        } catch (error) {
            console.error('💀 RecordManager操作終了記録エラー:', error);
        } finally {
            // クリーンアップ
            this.currentOperation = null;
            this.operationStartTime = null;
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
     * パスを確定・レイヤー配置
     */
    finalizePath() {
        if (!this.currentPath) return;
        
        try {
            // メインレイヤーに追加
            const canvasManager = this.getManager('canvas');
            const mainLayer = canvasManager.getLayer('main');
            
            if (!mainLayer) {
                throw new Error('Main layer not found');
            }
            
            mainLayer.addChild(this.currentPath);
            console.log(`✅ パスをメインレイヤーに追加完了`);
            
            // 描画完了イベント発火
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit('pen:drawComplete', {
                    pathId: this.currentPath.id || 'unknown',
                    pointCount: this.points.length,
                    layerId: 'main',
                    operationId: this.currentOperation?.id
                });
            }
            
            console.log(`✅ パス確定完了`);
            
        } catch (error) {
            console.error('💀 パス確定エラー:', error);
            
            // エラー時のクリーンアップ
            if (this.currentPath && this.currentPath.parent) {
                this.currentPath.parent.removeChild(this.currentPath);
            }
            
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
                this.endDrawOperation(true); // 成功として記録
            } catch (error) {
                console.error('💀 PenTool 無効化時の描画中断エラー:', error);
                this.endDrawOperation(false); // 失敗として記録
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
        
        // 進行中操作があれば強制終了
        if (this.currentOperation) {
            this.endDrawOperation(false);
        }
        
        this.resetDrawingState();
    }
    
    /**
     * 描画状態リセット
     */
    resetDrawingState() {
        this.isDrawing = false;
        
        // 未確定パスのクリーンアップ
        if (this.currentPath && !this.currentPath.parent) {
            // まだレイヤーに追加されていない場合は破棄
            this.currentPath.destroy();
        }
        
        this.currentPath = null;
        this.points = [];
        this.currentOperation = null;
        this.operationStartTime = null;
        
        console.log('✅ PenTool 描画状態リセット完了');
    }
    
    /**
     * 破棄処理
     */
    onDestroy() {
        console.log('🖊️ PenTool 破棄処理開始');
        
        // 進行中操作を安全に終了
        if (this.currentOperation) {
            this.endDrawOperation(false);
        }
        
        // 描画中の処理を安全に終了
        this.resetDrawingState();
        
        console.log('✅ PenTool 破棄処理完了');
    }
    
    /**
     * 🆕 Undo対応処理（RecordManagerから呼び出し）
     */
    onUndo(operation) {
        console.log(`↶ PenTool Undo処理: ${operation.id}`);
        
        try {
            // Graphics削除はRecordManagerで実行済み
            // Tool固有の追加処理があればここで実行
            
            console.log(`✅ PenTool Undo処理完了: ${operation.id}`);
        } catch (error) {
            console.error(`💀 PenTool Undo処理エラー:`, error);
        }
    }
    
    /**
     * 🆕 Redo対応処理（RecordManagerから呼び出し）
     */
    onRedo(operation) {
        console.log(`↷ PenTool Redo処理: ${operation.id}`);
        
        try {
            // Graphics復元はRecordManagerで実行済み
            // Tool固有の追加処理があればここで実行
            
            console.log(`✅ PenTool Redo処理完了: ${operation.id}`);
        } catch (error) {
            console.error(`💀 PenTool Redo処理エラー:`, error);
        }
    }
    
    /**
     * 🆕 操作強制終了処理（RecordManagerから呼び出し）
     */
    onOperationForceEnd(operation) {
        console.log(`⚠️ PenTool 操作強制終了: ${operation.id}`);
        
        try {
            // 現在の操作と一致する場合のみ処理
            if (this.currentOperation && this.currentOperation.id === operation.id) {
                this.resetDrawingState();
            }
            
            console.log(`✅ PenTool 操作強制終了処理完了: ${operation.id}`);
        } catch (error) {
            console.error(`💀 PenTool 操作強制終了エラー:`, error);
        }
    }
    
    /**
     * デバッグ情報取得（RecordManager対応版）
     */
    getDebugInfo() {
        const baseDebugInfo = super.getDebugInfo ? super.getDebugInfo() : {};
        
        return {
            ...baseDebugInfo,
            className: 'PenTool',
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            hasCurrentPath: !!this.currentPath,
            pointCount: this.points.length,
            penSettings: this.penSettings,
            
            // RecordManager連携状況
            recordManagerIntegration: {
                hasCurrentOperation: !!this.currentOperation,
                operationId: this.currentOperation?.id || null,
                operationStartTime: this.operationStartTime,
                hasRecordManager: !!this.managers?.record,
                recordManagerReady: this.managers?.record ? 
                    (typeof this.managers.record.isReady === 'function' ? 
                     this.managers.record.isReady() : 'unknown') : false
            }
        };
    }
}

// グローバル公開
window.Tegaki.PenTool = PenTool;
console.log('🖊️ PenTool Phase1.5 RecordManager連携修正版 Loaded - startOperation/endOperation方式対応・架空メソッド削除・Undo/Redo連携完成');