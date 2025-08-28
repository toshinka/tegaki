/**
 * 🧹 EraserTool - PixiJS v8対応消しゴムツール
 * 📋 RESPONSIBILITY: v8対応消去機能・Graphics削除・高精度hit-test・Container階層対応
 * 🚫 PROHIBITION: 複雑な消去処理・Canvas管理・座標変換・エラー隠蔽・フォールバック
 * ✅ PERMISSION: v8 Graphics消去・Container階層操作・RecordManager v8連携・WebGPU最適化
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool v8継承・高精度消去・Container階層活用・WebGPU最適化
 * 🔄 INTEGRATION: AbstractTool v8継承・CanvasManager v8連携・RecordManager v8記録・PixiJS v8活用
 * 🎯 V8_FEATURE: v8 Graphics.containsPoint活用・Container階層対応・WebGPU加速・高精度消去
 * 
 * === v8消去フロー ===
 * 開始: onPointerDown → v8座標取得 → Container検索 → v8 Graphics hit-test → 削除実行
 * 継続: onPointerMove → v8リアルタイム消去 → Container即時更新 → WebGPU最適化
 * 終了: onPointerUp → v8消去完了 → RecordManager v8記録 → Container状態更新
 * 
 * === 提供メソッド ===
 * - async initializeV8Features() : v8機能初期化
 * - onPointerDown(x, y, event) : v8消去開始
 * - onPointerMove(x, y, event) : v8継続消去
 * - onPointerUp(x, y, event) : v8消去終了
 * - eraseAtPositionV8(x, y) : v8高精度消去実行
 * - checkCollisionV8(graphics, hitArea) : v8衝突判定
 * 
 * === 他ファイル呼び出しメソッド ===
 * - this.canvasManager.getLayer('main') : v8レイヤー取得
 * - this.canvasManager.removeGraphicsFromLayerV8() : v8 Graphics削除
 * - window.Tegaki.RecordManagerInstance.startOperationV8() : v8操作開始記録
 * - window.Tegaki.RecordManagerInstance.endOperationV8() : v8操作終了記録
 * - graphics.containsPoint() : PixiJS v8 hit-test
 * - layer.removeChild() : PixiJS v8 Container操作
 */

window.Tegaki = window.Tegaki || {};

/**
 * EraserTool - PixiJS v8対応消しゴムツール
 * v8 Graphics削除・Container階層対応・高精度消去を提供
 */
class EraserTool extends window.Tegaki.AbstractTool {
    constructor(canvasManager) {
        super(canvasManager, 'eraser');
        console.log('🧹 EraserTool v8対応版 作成開始');
        
        // v8消しゴム状態
        this.isErasing = false;
        this.erasedItems = [];
        this.currentOperation = null; // v8操作記録
        this.v8Ready = false;
        
        // v8消しゴム設定
        this.eraserSettings = {
            size: 20,                 // 消しゴムサイズ（ピクセル）
            mode: 'object',          // 消去モード: 'object' | 'pixel'
            sensitivity: 1.0,         // v8感度調整
            webgpuOptimized: false    // WebGPU最適化フラグ
        };
        
        // v8 Manager参照
        this.recordManager = window.Tegaki.RecordManagerInstance;
        if (!this.recordManager) {
            console.warn('⚠️ RecordManagerInstance not available - v8記録機能が制限されます');
        }
        
        console.log('✅ EraserTool v8対応版 作成完了:', {
            toolName: this.toolName,
            hasCanvasManager: !!this.canvasManager,
            hasRecordManager: !!this.recordManager,
            eraserSettings: this.eraserSettings
        });
    }
    
    /**
     * v8機能初期化（AbstractTool継承）
     */
    async initializeV8Features() {
        console.log('🧹 EraserTool v8機能初期化開始');
        
        // WebGPU対応確認
        if (this.canvasManager?.webgpuSupported) {
            this.eraserSettings.webgpuOptimized = true;
            this.eraserSettings.sensitivity = 1.2; // WebGPU高精度
            console.log('🚀 EraserTool: WebGPU最適化有効');
        }
        
        this.v8Ready = true;
        console.log('✅ EraserTool v8機能初期化完了');
    }
    
    /**
     * v8消去開始処理（PointerDown時）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerDown(x, y, event) {
        try {
            console.log(`🧹 EraserTool v8消去開始: (${x}, ${y})`);
            
            this.isErasing = true;
            this.erasedItems = [];
            
            // v8操作記録開始
            if (this.recordManager?.startOperationV8) {
                this.currentOperation = this.recordManager.startOperationV8({
                    tool: 'eraser',
                    type: 'erase_operation',
                    data: {
                        startPosition: { x, y },
                        eraserSize: this.eraserSettings.size,
                        mode: this.eraserSettings.mode
                    },
                    layerId: 'main'
                });
            }
            
            // v8指定位置の要素を消去
            this.eraseAtPositionV8(x, y);
            
            console.log(`✅ EraserTool v8消去開始完了`);
            
        } catch (error) {
            console.error('💀 EraserTool v8消去開始エラー:', error);
            
            if (this.errorManager?.showError) {
                this.errorManager.showError('error', `v8消しゴム開始エラー: ${error.message}`, {
                    context: 'EraserTool.onPointerDown',
                    v8Mode: true
                });
            }
            
            throw error;
        }
    }
    
    /**
     * v8消去継続処理（PointerMove時）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerMove(x, y, event) {
        if (!this.isErasing) return;
        
        try {
            // v8ドラッグ中の連続消去
            this.eraseAtPositionV8(x, y);
            
        } catch (error) {
            console.error('💀 EraserTool v8消去継続エラー:', error);
            
            if (this.errorManager?.showError) {
                this.errorManager.showError('error', `v8消しゴム継続エラー: ${error.message}`, {
                    context: 'EraserTool.onPointerMove',
                    v8Mode: true
                });
            }
            
            throw error;
        }
    }
    
    /**
     * v8消去終了処理（PointerUp時）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerUp(x, y, event) {
        if (!this.isErasing) return;
        
        try {
            console.log(`🧹 EraserTool v8消去終了: (${x}, ${y})`);
            
            // v8最終位置で消去
            this.eraseAtPositionV8(x, y);
            
            // v8消去操作を記録
            this.recordV8EraseOperation();
            
            this.isErasing = false;
            console.log(`✅ EraserTool v8消去終了完了: 消去数=${this.erasedItems.length}`);
            
        } catch (error) {
            console.error('💀 EraserTool v8消去終了エラー:', error);
            
            if (this.errorManager?.showError) {
                this.errorManager.showError('error', `v8消しゴム終了エラー: ${error.message}`, {
                    context: 'EraserTool.onPointerUp',
                    v8Mode: true
                });
            }
            
            this.isErasing = false;
            this.erasedItems = [];
            this.currentOperation = null;
            throw error;
        }
    }
    
    /**
     * v8指定位置での消去処理
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    eraseAtPositionV8(x, y) {
        try {
            // v8メインレイヤー取得
            const mainLayer = this.canvasManager.getLayer('main');
            if (!mainLayer) {
                throw new Error('Main layer not found for v8 erasing');
            }
            
            // v8 Container階層検索（コピー作成で削除による配列変更回避）
            const children = mainLayer.children.slice();
            let erasedCount = 0;
            
            // v8高精度hit-test実行
            for (const child of children) {
                if (this.shouldEraseItemV8(child, x, y)) {
                    this.eraseItemV8(child, mainLayer);
                    erasedCount++;
                }
            }
            
            if (erasedCount > 0) {
                console.log(`🧹 v8位置(${x}, ${y})で${erasedCount}個のアイテムを消去`);
            }
            
        } catch (error) {
            console.error('💀 v8指定位置消去エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8アイテム消去判定
     * @param {PIXI.DisplayObject} item - 判定対象アイテム
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {boolean} 消去対象フラグ
     */
    shouldEraseItemV8(item, x, y) {
        try {
            // v8 Graphics の場合、containsPoint で高精度判定
            if (item instanceof PIXI.Graphics) {
                const point = new PIXI.Point(x, y);
                
                // v8高精度containsPoint活用
                const contained = item.containsPoint(point);
                
                // WebGPU最適化時の感度調整
                if (this.eraserSettings.webgpuOptimized && !contained) {
                    // 消しゴムサイズを考慮した範囲判定
                    const hitArea = new PIXI.Rectangle(
                        x - this.eraserSettings.size / 2,
                        y - this.eraserSettings.size / 2,
                        this.eraserSettings.size,
                        this.eraserSettings.size
                    );
                    
                    return this.checkCollisionV8(item, hitArea);
                }
                
                return contained;
            }
            
            // v8その他のDisplayObjectの場合、bounds判定
            if (item.getBounds) {
                const bounds = item.getBounds();
                return bounds.contains(x, y);
            }
            
            // v8判定できない場合は消去しない
            return false;
            
        } catch (error) {
            console.error('💀 v8消去判定エラー:', error);
            return false; // エラー時は安全側で消去しない
        }
    }
    
    /**
     * v8衝突判定（WebGPU最適化対応）
     * @param {PIXI.Graphics} graphics - Graphics オブジェクト
     * @param {PIXI.Rectangle} hitArea - 判定範囲
     * @returns {boolean} 衝突フラグ
     */
    checkCollisionV8(graphics, hitArea) {
        try {
            const graphicsBounds = graphics.getBounds();
            
            // v8高精度境界判定
            const intersects = (
                hitArea.x < graphicsBounds.x + graphicsBounds.width &&
                hitArea.x + hitArea.width > graphicsBounds.x &&
                hitArea.y < graphicsBounds.y + graphicsBounds.height &&
                hitArea.y + hitArea.height > graphicsBounds.y
            );
            
            return intersects;
            
        } catch (error) {
            console.error('💀 v8衝突判定エラー:', error);
            return false;
        }
    }
    
    /**
     * v8アイテム消去実行
     * @param {PIXI.DisplayObject} item - 消去対象アイテム
     * @param {PIXI.Container} layer - 親レイヤー
     */
    eraseItemV8(item, layer) {
        try {
            // v8 Container から削除
            layer.removeChild(item);
            
            // v8消去記録に追加
            this.erasedItems.push({
                item: item,
                layer: layer,
                layerId: 'main',
                timestamp: Date.now(),
                // v8追加情報
                itemType: item.constructor.name,
                bounds: item.getBounds(),
                v8Erased: true
            });
            
            console.log(`🧹 v8アイテム消去: ${item.constructor.name}`);
            
        } catch (error) {
            console.error('💀 v8アイテム消去実行エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8消去操作をRecordManagerに記録
     */
    recordV8EraseOperation() {
        if (this.erasedItems.length === 0) {
            console.log('📋 v8消去対象なし - 記録スキップ');
            
            // 操作終了記録（失敗として）
            if (this.currentOperation && this.recordManager?.endOperationV8) {
                this.recordManager.endOperationV8(this.currentOperation.id, {
                    success: false,
                    reason: 'no-items-erased'
                });
            }
            
            return;
        }
        
        try {
            // v8操作終了記録
            if (this.currentOperation && this.recordManager?.endOperationV8) {
                const eraseData = {
                    success: true,
                    erasedItems: this.erasedItems.map(record => ({
                        itemId: record.item.id || 'unknown',
                        layerId: record.layerId,
                        itemType: record.itemType,
                        bounds: record.bounds,
                        timestamp: record.timestamp,
                        v8Mode: true
                    })),
                    totalErased: this.erasedItems.length,
                    eraserSettings: { ...this.eraserSettings },
                    webgpuOptimized: this.eraserSettings.webgpuOptimized
                };
                
                this.recordManager.endOperationV8(this.currentOperation.id, {
                    success: true,
                    strokeData: eraseData
                });
                
                console.log(`✅ RecordManager v8消去記録完了 - ${this.erasedItems.length}個`);
            }
            
            // v8消去完了イベント配信
            if (this.eventBus?.emit) {
                this.eventBus.emit('eraser:eraseCompleteV8', {
                    erasedCount: this.erasedItems.length,
                    layerId: 'main',
                    v8Mode: true,
                    webgpuOptimized: this.eraserSettings.webgpuOptimized,
                    operationId: this.currentOperation?.id
                });
            }
            
        } catch (error) {
            console.error('💀 v8消去記録エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8消しゴムサイズ設定
     * @param {number} size - 新しいサイズ
     */
    setEraserSizeV8(size) {
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('Invalid v8 eraser size');
        }
        
        this.eraserSettings.size = size;
        
        // WebGPU最適化時の感度調整
        if (this.eraserSettings.webgpuOptimized) {
            this.eraserSettings.sensitivity = Math.max(0.8, Math.min(1.5, size / 20));
        }
        
        console.log(`🧹 v8消しゴムサイズ変更: ${size} (感度: ${this.eraserSettings.sensitivity})`);
    }
    
    /**
     * v8設定更新処理（AbstractToolからの委譲）
     * @param {Object} settings - 新しい設定
     */
    onSettingsUpdate(settings) {
        try {
            if (settings.size !== undefined) {
                this.setEraserSizeV8(settings.size);
            }
            
            if (settings.mode !== undefined) {
                this.eraserSettings.mode = settings.mode;
            }
            
            if (settings.sensitivity !== undefined) {
                this.eraserSettings.sensitivity = settings.sensitivity;
            }
            
            console.log(`🧹 EraserTool v8設定更新完了:`, this.eraserSettings);
            
        } catch (error) {
            console.error('💀 EraserTool v8設定更新エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8 Undo処理（RecordManagerから呼び出し）
     * @param {Object} operation - Undo対象操作
     */
    onUndoV8(operation) {
        try {
            console.log(`↶ EraserTool v8 Undo実行: ${operation.id}`);
            
            // v8消去されたアイテムを復元
            if (operation.strokeData?.erasedItems) {
                const mainLayer = this.canvasManager.getLayer('main');
                if (mainLayer) {
                    operation.strokeData.erasedItems.forEach(erasedRecord => {
                        // 実際の復元は RecordManager が Graphics を管理
                        console.log(`🔄 v8消去アイテム復元準備: ${erasedRecord.itemType}`);
                    });
                }
            }
            
            console.log(`✅ EraserTool v8 Undo処理完了`);
            
        } catch (error) {
            console.error('💀 EraserTool v8 Undo処理エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8 Redo処理（RecordManagerから呼び出し）
     * @param {Object} operation - Redo対象操作
     */
    onRedoV8(operation) {
        try {
            console.log(`↷ EraserTool v8 Redo実行: ${operation.id}`);
            
            // v8再消去処理
            if (operation.strokeData?.erasedItems) {
                console.log(`🔄 v8再消去実行: ${operation.strokeData.totalErased}個`);
                // 実際の再消去は RecordManager が Graphics を管理
            }
            
            console.log(`✅ EraserTool v8 Redo処理完了`);
            
        } catch (error) {
            console.error('💀 EraserTool v8 Redo処理エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8操作強制終了処理（ツール切り替え時など）
     * @param {Object} operation - 強制終了対象操作
     */
    onOperationForceEndV8(operation) {
        try {
            console.log(`⚠️ EraserTool v8操作強制終了: ${operation.id}`);
            
            // 進行中の消去を安全に終了
            if (this.isErasing && this.currentOperation?.id === operation.id) {
                // 現在までの消去を記録
                if (this.erasedItems.length > 0) {
                    this.recordV8EraseOperation();
                }
                
                this.resetV8ErasingState();
            }
            
            console.log(`✅ EraserTool v8操作強制終了処理完了`);
            
        } catch (error) {
            console.error('💀 EraserTool v8操作強制終了エラー:', error);
            this.resetV8ErasingState();
        }
    }
    
    /**
     * v8現在の消しゴム設定取得
     * @returns {Object} v8消しゴム設定
     */
    getV8EraserSettings() {
        return {
            ...this.eraserSettings,
            v8Ready: this.v8Ready,
            webgpuSupported: this.canvasManager?.webgpuSupported || false
        };
    }
    
    /**
     * v8有効化時処理
     */
    onActivate() {
        console.log('🧹 EraserTool v8有効化 - 消しゴムモード開始');
        this.resetV8ErasingState();
        
        // WebGPU最適化確認
        if (this.canvasManager?.webgpuSupported && !this.eraserSettings.webgpuOptimized) {
            this.eraserSettings.webgpuOptimized = true;
            console.log('🚀 EraserTool v8: WebGPU最適化自動有効化');
        }
    }
    
    /**
     * v8無効化時処理
     */
    onDeactivate() {
        console.log('🧹 EraserTool v8無効化 - 消去中の場合は記録');
        
        // v8消去中の場合は記録して終了
        if (this.isErasing && this.erasedItems.length > 0) {
            try {
                this.recordV8EraseOperation();
            } catch (error) {
                console.error('💀 EraserTool v8無効化時の記録エラー:', error);
                this.resetV8ErasingState();
            }
        }
        
        this.resetV8ErasingState();
    }
    
    /**
     * v8リセット処理
     */
    onReset() {
        console.log('🧹 EraserTool v8リセット - 消去状態クリア');
        this.resetV8ErasingState();
    }
    
    /**
     * v8消去状態リセット
     */
    resetV8ErasingState() {
        this.isErasing = false;
        this.erasedItems = [];
        this.currentOperation = null;
        console.log('✅ EraserTool v8消去状態リセット完了');
    }
    
    /**
     * v8破棄処理
     */
    onDestroy() {
        console.log('🧹 EraserTool v8破棄処理開始');
        
        // v8消去中の処理を安全に終了
        this.resetV8ErasingState();
        
        // v8 Manager参照をクリア
        this.recordManager = null;
        this.v8Ready = false;
        
        console.log('✅ EraserTool v8破棄処理完了');
    }
    
    /**
     * v8準備完了確認
     * @returns {boolean} v8対応状況
     */
    isV8Ready() {
        return this.v8Ready && 
               !!this.canvasManager && 
               this.canvasManager.isV8Ready();
    }
    
    /**
     * v8デバッグ情報取得
     * @returns {Object} v8デバッグ情報
     */
    getDebugInfo() {
        return {
            // 基本情報
            className: 'EraserTool',
            toolName: this.toolName,
            v8Ready: this.v8Ready,
            
            // 状態情報
            isActive: this.isActive,
            isErasing: this.isErasing,
            erasedItemsCount: this.erasedItems.length,
            currentOperationId: this.currentOperation?.id || null,
            
            // Manager連携
            hasCanvasManager: !!this.canvasManager,
            canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
            hasRecordManager: !!this.recordManager,
            recordManagerV8Ready: this.recordManager?.isV8Ready?.() || false,
            
            // v8設定
            eraserSettings: { ...this.eraserSettings },
            
            // v8パフォーマンス
            performance: {
                webgpuSupported: this.canvasManager?.webgpuSupported || false,
                webgpuOptimized: this.eraserSettings.webgpuOptimized,
                highPrecisionMode: this.eraserSettings.webgpuOptimized,
                rendererType: this.canvasManager?.pixiApp?.renderer?.type || 'unknown'
            },
            
            // v8操作履歴（最新のみ）
            recentErasedItems: this.erasedItems.slice(-3).map(item => ({
                itemType: item.itemType,
                layerId: item.layerId,
                timestamp: item.timestamp,
                v8Mode: item.v8Erased
            })),
            
            // v8機能状態
            v8Features: {
                highPrecisionHitTest: true,
                containerHierarchySupport: true,
                webgpuOptimization: this.eraserSettings.webgpuOptimized,
                recordManagerV8Integration: !!this.recordManager?.isV8Ready
            }
        };
    }
    
    /**
     * v8機能テスト
     * @returns {Object} v8機能テスト結果
     */
    testV8EraserFeatures() {
        const results = { success: [], error: [], warning: [] };
        
        try {
            // v8初期化テスト
            if (this.v8Ready) {
                results.success.push('EraserTool v8: 初期化正常');
            } else {
                results.error.push('EraserTool v8: 初期化異常');
            }
            
            // v8設定テスト
            const originalSize = this.eraserSettings.size;
            this.setEraserSizeV8(30);
            if (this.eraserSettings.size === 30) {
                results.success.push('EraserTool v8: サイズ設定正常');
            } else {
                results.error.push('EraserTool v8: サイズ設定異常');
            }
            this.setEraserSizeV8(originalSize); // 復元
            
            // WebGPU対応テスト
            if (this.canvasManager?.webgpuSupported) {
                if (this.eraserSettings.webgpuOptimized) {
                    results.success.push('EraserTool v8: WebGPU最適化正常');
                } else {
                    results.warning.push('EraserTool v8: WebGPU最適化未有効');
                }
            } else {
                results.warning.push('EraserTool v8: WebGPU非対応環境');
            }
            
            // RecordManager v8連携テスト
            if (this.recordManager?.isV8Ready?.()) {
                results.success.push('EraserTool v8: RecordManager連携正常');
            } else {
                results.warning.push('EraserTool v8: RecordManager v8連携未完了');
            }
            
        } catch (error) {
            results.error.push(`EraserTool v8機能テストエラー: ${error.message}`);
        }
        
        return results;
    }
    
    /**
     * v8状態リセット
     */
    resetV8() {
        console.log('🔄 EraserTool v8状態リセット開始');
        
        this.resetV8ErasingState();
        this.v8Ready = false;
        this.eraserSettings.webgpuOptimized = false;
        this.eraserSettings.sensitivity = 1.0;
        
        console.log('✅ EraserTool v8状態リセット完了');
    }
}

// グローバル公開
window.Tegaki.EraserTool = EraserTool;
console.log('🧹 EraserTool PixiJS v8対応版 Loaded');
console.log('📏 v8機能: Graphics削除・Container階層対応・WebGPU最適化・高精度hit-test');
console.log('🚀 v8特徴: RecordManager v8統合・高精度消去・WebGPU加速・Container階層活用');
console.log('✅ v8準備完了: initializeV8Features()でv8機能初期化後に利用可能');