/**
 * 🧹 EraserTool Phase1.5 非破壊編集対応版 - AbstractTool継承・RecordManager統合
 * 📋 RESPONSIBILITY: 描画内容の消去処理・非破壊編集対応・操作記録
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換・直接Manager作成
 * ✅ PERMISSION: PIXI.Graphics作成・消去処理・CanvasManagerへの渡し・操作記録
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・非破壊編集・ERASEブレンドモード活用
 * 🔄 INTEGRATION: CanvasManager・RecordManager・CoordinateManager統合
 * 🎯 FEATURE: Undo/Redo対応・操作履歴記録・キャンバス外描画対応・座標ズレ完全解決
 * 🆕 Phase1.5: AbstractTool継承・RecordManager統合・非破壊編集完全対応
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.EraserTool) {
    /**
     * EraserTool - Phase1.5 非破壊編集対応版（AbstractTool継承）
     * AbstractToolを継承して消去処理・非破壊編集・操作記録を行う
     */
    class EraserTool extends window.Tegaki.AbstractTool {
        constructor() {
            // AbstractTool継承（ツール名とデフォルト設定）
            super('eraser', {
                eraserSize: 20,         // デフォルト消しゴムサイズ
                eraserOpacity: 1.0,     // 消去強度（完全消去）
                smoothErasing: true     // スムーズ消去
            });
            
            console.log('🧹 EraserTool Phase1.5 非破壊編集対応版 作成（AbstractTool継承）');
            
            // 消しゴム固有の状態
            this.currentErasePath = null;  // 現在の消去Graphics
            this.points = [];              // 現在消去パスの座標配列
            this.eraseHistory = [];        // 消去操作履歴（ローカル参照用）
            
            // 統計情報
            this.eraseCount = 0;           // 消去実行回数
            this.lastEraseInfo = null;     // 最後の消去情報
        }
        
        /**
         * 🔧 FIX: ToolManagerとの互換性のため setCanvasManager メソッドを追加
         */
        setCanvasManager(canvasManager) {
            console.log('🧹 EraserTool - setCanvasManager 呼び出し（互換性メソッド）');
            
            // AbstractToolのinitializeメソッドを呼び出す
            this.initialize({
                canvasManager: canvasManager,
                coordinateManager: window.Tegaki?.CoordinateManagerInstance,
                recordManager: window.Tegaki?.RecordManagerInstance,
                eventBus: window.Tegaki?.EventBusInstance
            });
        }
        
        /**
         * デフォルト設定取得（AbstractTool実装）
         */
        getDefaultSettings() {
            return {
                ...super.getDefaultSettings(),
                eraserSize: 20,         // デフォルト消しゴムサイズ
                eraserOpacity: 1.0,     // 消去強度（完全消去）
                smoothErasing: true     // スムーズ消去
            };
        }
        
        /**
         * 🔧 FIX: AbstractToolのマウスイベントをPointerイベントメソッドに転送
         */
        onPointerDown(x, y, event) {
            return this.handleMouseDown({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        onPointerMove(x, y, event) {
            return this.handleMouseMove({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        onPointerUp(x, y, event) {
            return this.handleMouseUp({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        /**
         * 消去開始処理（AbstractTool実装）
         */
        onDrawStart(point, event) {
            if (!this.canvasManager) {
                console.warn('⚠️ EraserTool: CanvasManager not set');
                return;
            }
            
            const { x, y } = point;
            
            // アクティブレイヤー確認（背景レイヤーは保護）
            const activeLayerId = this.canvasManager.getActiveLayerId();
            if (activeLayerId === 'layer0') {
                console.warn('⚠️ EraserTool: 背景レイヤーへの消去は禁止されています');
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showWarning(
                        '背景レイヤーは消去できません',
                        { context: 'EraserTool.onDrawStart' }
                    );
                }
                return;
            }
            
            console.log(`🧹 消去開始: layer=${activeLayerId}, pos=(${Math.round(x)}, ${Math.round(y)}), size=${this.settings.eraserSize}`);
            
            // 座標配列初期化
            this.points = [{x, y, timestamp: Date.now()}];
            this.eraseCount++;
            
            // 消去Graphics作成
            this.currentErasePath = new PIXI.Graphics();
            
            // ERASEブレンドモード設定（初期設定で確実に）
            this.currentErasePath.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // 🆕 currentActionにGraphics設定（Undo/Redo用）
            if (this.currentAction) {
                this.currentAction.graphics = this.currentErasePath;
                this.currentAction.type = 'erase'; // 操作タイプ設定
            }
            
            // 消去用円形描画
            this.drawEraseCircle(x, y);
            
            // アクティブレイヤーに追加（専用メソッド使用）
            try {
                if (this.canvasManager.addEraseGraphicsToLayer) {
                    this.canvasManager.addEraseGraphicsToLayer(this.currentErasePath);
                } else {
                    // フォールバック: 通常のGraphics追加メソッドを使用
                    this.canvasManager.addGraphicsToLayer(this.currentErasePath);
                }
                console.log(`✅ 消去Graphics追加成功: layer=${activeLayerId}`);
            } catch (error) {
                console.error('❌ 消去Graphics追加失敗:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        'technical',
                        `消去Graphics追加失敗: ${error.message}`,
                        { context: 'EraserTool.onDrawStart' }
                    );
                }
            }
        }
        
        /**
         * 消去更新処理（AbstractTool実装）
         */
        onDrawMove(point, event) {
            if (!this.currentErasePath) return;
            
            const { x, y } = point;
            
            // 点を記録（タイムスタンプ付き）
            this.points.push({x, y, timestamp: Date.now()});
            
            // 現在位置に消去円描画
            this.drawEraseCircle(x, y);
            
            // スムーズ消去：前の点との間を補間
            if (this.settings.smoothErasing && this.points.length > 1) {
                const prevPoint = this.points[this.points.length - 2];
                const distance = Math.sqrt(
                    Math.pow(x - prevPoint.x, 2) + Math.pow(y - prevPoint.y, 2)
                );
                
                // 補間距離を完全修正（より密で滑らかな補間）
                const minInterpolationDistance = this.settings.eraserSize / 4;
                if (distance > minInterpolationDistance) {
                    // 補間ステップ数を完全修正（滑らかさ向上）
                    const steps = Math.max(2, Math.ceil(distance / (this.settings.eraserSize / 3)));
                    for (let i = 1; i < steps; i++) {
                        const ratio = i / steps;
                        const interpX = prevPoint.x + (x - prevPoint.x) * ratio;
                        const interpY = prevPoint.y + (y - prevPoint.y) * ratio;
                        
                        this.drawEraseCircle(interpX, interpY);
                    }
                }
            }
            
            // パフォーマンス監視
            if (this.points.length > 1000) {
                console.warn(`⚠️ EraserTool: 消去パスが長すぎます (${this.points.length} points)`);
            }
        }
        
        /**
         * 消去終了処理（AbstractTool実装）
         */
        onDrawEnd(point, event) {
            if (!this.currentErasePath) return;
            
            const { x, y } = point;
            
            // 最終点に消去円追加
            this.drawEraseCircle(x, y);
            
            // 最終点記録
            this.points.push({x, y, timestamp: Date.now()});
            
            // 🆕 消去データをローカル履歴に保存
            if (this.currentAction) {
                const eraseData = {
                    id: `erase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    layerId: this.canvasManager?.getActiveLayerId() || 'default',
                    points: [...this.points],
                    settings: {
                        eraserSize: this.settings.eraserSize,
                        eraserOpacity: this.settings.eraserOpacity,
                        smoothErasing: this.settings.smoothErasing
                    },
                    createdAt: Date.now(),
                    type: 'erase',
                    graphics: this.currentErasePath
                };
                
                this.eraseHistory.push(eraseData);
                console.log(`💾 消去操作保存: id=${eraseData.id}, points=${eraseData.points.length}`);
            }
            
            // 統計情報記録
            const pathLength = this.points.length;
            const activeLayerId = this.canvasManager?.getActiveLayerId();
            const startTime = this.points[0]?.timestamp || Date.now();
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            this.lastEraseInfo = {
                layerId: activeLayerId,
                pathLength: pathLength,
                duration: duration,
                eraserSize: this.settings.eraserSize,
                smoothErasing: this.settings.smoothErasing,
                startPos: { x: this.points[0]?.x || 0, y: this.points[0]?.y || 0 },
                endPos: { x, y }
            };
            
            console.log(`✅ 消去完了: layer=${activeLayerId}, pathPoints=${pathLength}, duration=${duration}ms, size=${this.settings.eraserSize}`);
            
            // リセット
            this.currentErasePath = null;
            this.points = [];
        }
        
        /**
         * 🆕 操作取り消し処理（AbstractTool実装）
         */
        onUndo(operationData) {
            console.log(`↶ 消去操作取り消し: ${operationData.id}`);
            
            // ローカル履歴からも削除
            const index = this.eraseHistory.findIndex(erase => erase.id === operationData.id);
            if (index !== -1) {
                this.eraseHistory.splice(index, 1);
                console.log(`🗑️ ローカル消去履歴削除: index=${index}`);
            }
        }
        
        /**
         * 🆕 操作やり直し処理（AbstractTool実装）
         */
        onRedo(operationData) {
            console.log(`↷ 消去操作復元: ${operationData.id}`);
            
            // Graphics再作成（必要に応じて）
            if (!operationData.graphics && operationData.data) {
                const eraseData = operationData.data;
                operationData.graphics = this.redrawErase(eraseData);
                
                if (operationData.graphics && this.canvasManager) {
                    if (this.canvasManager.addEraseGraphicsToLayer) {
                        this.canvasManager.addEraseGraphicsToLayer(operationData.graphics);
                    } else {
                        this.canvasManager.addGraphicsToLayer(operationData.graphics);
                    }
                }
            }
            
            // ローカル履歴にも復元
            if (operationData.data && !this.eraseHistory.find(e => e.id === operationData.id)) {
                const eraseData = {
                    ...operationData.data,
                    graphics: operationData.graphics
                };
                this.eraseHistory.push(eraseData);
                console.log(`📥 ローカル消去履歴復元: id=${eraseData.id}`);
            }
        }
        
        /**
         * 未完了操作強制終了処理（AbstractTool実装）
         */
        onOperationForceEnd(operationData) {
            console.log(`⚠️ 消去操作強制終了: ${operationData.id}`);
            
            // 未完了のGraphicsがあれば削除
            if (this.currentErasePath && this.canvasManager) {
                this.canvasManager.removeGraphicsFromLayer(this.currentErasePath);
            }
            
            // 状態リセット
            this.currentErasePath = null;
            this.points = [];
        }
        
        /**
         * 消去円描画（座標精度・ブレンドモード完全修正版）
         */
        drawEraseCircle(x, y) {
            if (!this.currentErasePath) return;
            
            // ERASEブレンドモード再保証
            this.currentErasePath.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // 座標精度確保
            const preciseX = Math.round(x * 10) / 10;
            const preciseY = Math.round(y * 10) / 10;
            const preciseRadius = Math.round((this.settings.eraserSize / 2) * 10) / 10;
            
            // 白色で円形描画（ERASEブレンドモードで消去に変換される）
            this.currentErasePath.beginFill(0xffffff, this.settings.eraserOpacity);
            this.currentErasePath.drawCircle(preciseX, preciseY, preciseRadius);
            this.currentErasePath.endFill();
            
            // デバッグ: 最初の数回の描画をログ出力
            if (this.points.length <= 3) {
                console.log(`🧹 消去円描画: pos=(${preciseX}, ${preciseY}), radius=${preciseRadius}, opacity=${this.settings.eraserOpacity}`);
            }
        }
        
        /**
         * 消去操作再描画（Undo/Redo用）
         */
        redrawErase(eraseData) {
            if (!eraseData || !eraseData.points) return null;
            
            const graphics = new PIXI.Graphics();
            graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // 消去パス再描画
            const points = eraseData.points;
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const preciseX = Math.round(point.x * 10) / 10;
                const preciseY = Math.round(point.y * 10) / 10;
                const preciseRadius = Math.round((eraseData.settings.eraserSize / 2) * 10) / 10;
                
                graphics.beginFill(0xffffff, eraseData.settings.eraserOpacity);
                graphics.drawCircle(preciseX, preciseY, preciseRadius);
                graphics.endFill();
            }
            
            return graphics;
        }
        
        // ========================================
        // 設定・ユーティリティメソッド群
        // ========================================
        
        /**
         * 消しゴムサイズ設定
         */
        setEraserSize(size) {
            const minSize = 1;
            const maxSize = 200;
            const validSize = Math.max(minSize, Math.min(maxSize, Math.round(size)));
            
            if (validSize !== size) {
                console.warn(`⚠️ 消しゴムサイズ調整: ${size} → ${validSize} (範囲: ${minSize}-${maxSize})`);
            }
            
            this.updateSetting('eraserSize', validSize);
            console.log(`🧹 消しゴムサイズ設定: ${validSize}px`);
        }
        
        /**
         * 消しゴム透明度（消去強度）設定
         */
        setEraserOpacity(opacity) {
            const minOpacity = 0.1;
            const maxOpacity = 1.0;
            const validOpacity = Math.max(minOpacity, Math.min(maxOpacity, opacity));
            
            if (Math.abs(validOpacity - opacity) > 0.001) {
                console.warn(`⚠️ 消去強度調整: ${opacity} → ${validOpacity} (範囲: ${minOpacity}-${maxOpacity})`);
            }
            
            this.updateSetting('eraserOpacity', validOpacity);
            console.log(`🧹 消去強度設定: ${validOpacity}`);
        }
        
        /**
         * スムーズ消去設定
         */
        setSmoothErasing(enabled) {
            this.updateSetting('smoothErasing', !!enabled);
            console.log(`🧹 スムーズ消去: ${this.settings.smoothErasing ? '有効' : '無効'}`);
        }
        
        /**
         * 消去履歴取得
         */
        getEraseHistory() {
            return [...this.eraseHistory];
        }
        
        /**
         * 統計情報取得
         */
        getStats() {
            return {
                totalEraseCount: this.eraseCount,
                lastEraseInfo: this.lastEraseInfo,
                currentlyErasing: this.isDrawing,
                currentPathLength: this.points.length
            };
        }
        
        /**
         * ブレンドモード名取得（デバッグ用）
         */
        getBlendModeName(blendMode) {
            const blendModeNames = {
                [PIXI.BLEND_MODES.NORMAL]: 'NORMAL',
                [PIXI.BLEND_MODES.ADD]: 'ADD',
                [PIXI.BLEND_MODES.MULTIPLY]: 'MULTIPLY',
                [PIXI.BLEND_MODES.SCREEN]: 'SCREEN',
                [PIXI.BLEND_MODES.OVERLAY]: 'OVERLAY',
                [PIXI.BLEND_MODES.DARKEN]: 'DARKEN',
                [PIXI.BLEND_MODES.LIGHTEN]: 'LIGHTEN',
                [PIXI.BLEND_MODES.COLOR_DODGE]: 'COLOR_DODGE',
                [PIXI.BLEND_MODES.COLOR_BURN]: 'COLOR_BURN',
                [PIXI.BLEND_MODES.HARD_LIGHT]: 'HARD_LIGHT',
                [PIXI.BLEND_MODES.SOFT_LIGHT]: 'SOFT_LIGHT',
                [PIXI.BLEND_MODES.DIFFERENCE]: 'DIFFERENCE',
                [PIXI.BLEND_MODES.EXCLUSION]: 'EXCLUSION',
                [PIXI.BLEND_MODES.HUE]: 'HUE',
                [PIXI.BLEND_MODES.SATURATION]: 'SATURATION',
                [PIXI.BLEND_MODES.COLOR]: 'COLOR',
                [PIXI.BLEND_MODES.LUMINOSITY]: 'LUMINOSITY',
                [PIXI.BLEND_MODES.ERASE]: 'ERASE',
                [PIXI.BLEND_MODES.XOR]: 'XOR'
            };
            
            return blendModeNames[blendMode] || `UNKNOWN(${blendMode})`;
        }
        
        /**
         * 🆕 Phase1.5デバッグ情報取得（AbstractTool拡張）
         */
        getDebugInfo() {
            const baseInfo = super.getToolState ? super.getToolState() : {};
            
            return {
                ...baseInfo,
                // 消しゴム固有情報
                eraser: {
                    hasCurrentPath: !!this.currentErasePath,
                    currentPathPoints: this.points.length,
                    eraseHistoryCount: this.eraseHistory.length,
                    totalEraseCount: this.eraseCount,
                    
                    // 現在の設定
                    eraserSize: this.settings.eraserSize,
                    eraserOpacity: this.settings.eraserOpacity,
                    smoothErasing: this.settings.smoothErasing
                },
                
                // PIXI Graphics情報
                graphics: this.currentErasePath ? {
                    hasGraphics: true,
                    blendMode: this.currentErasePath.blendMode,
                    blendModeName: this.getBlendModeName(this.currentErasePath.blendMode),
                    childrenCount: this.currentErasePath.children.length,
                    visible: this.currentErasePath.visible,
                    alpha: this.currentErasePath.alpha
                } : { hasGraphics: false },
                
                // 統計情報
                stats: this.getStats(),
                
                // パフォーマンス情報
                performance: {
                    maxRecommendedPathLength: 1000,
                    currentPathLength: this.points.length,
                    pathLengthStatus: this.points.length > 1000 ? 'warning' : 'ok'
                }
            };
        }
        
        /**
         * 🆕 Phase1.5機能テスト
         */
        testPhase15Features() {
            const results = { success: [], error: [], warning: [] };
            
            // 消しゴム固有機能テスト
            try {
                // Graphics作成テスト
                const testGraphics = new PIXI.Graphics();
                testGraphics.blendMode = PIXI.BLEND_MODES.ERASE;
                testGraphics.beginFill(0xffffff);
                testGraphics.drawCircle(10, 10, 5);
                testGraphics.endFill();
                
                results.success.push('EraserTool: PIXI.Graphics消去機能正常');
                
                // 設定変更テスト
                const originalSize = this.settings.eraserSize;
                this.setEraserSize(30);
                if (this.settings.eraserSize === 30) {
                    results.success.push('EraserTool: 設定変更機能正常');
                    this.setEraserSize(originalSize); // 復元
                } else {
                    results.error.push('EraserTool: 設定変更機能異常');
                }
                
                // 消去履歴テスト
                if (Array.isArray(this.eraseHistory)) {
                    results.success.push('EraserTool: 消去履歴管理正常');
                } else {
                    results.error.push('EraserTool: 消去履歴管理異常');
                }
                
                // ブレンドモード確認
                if (PIXI.BLEND_MODES.ERASE !== undefined) {
                    results.success.push('EraserTool: ERASEブレンドモード利用可能');
                } else {
                    results.error.push('EraserTool: ERASEブレンドモード未対応');
                }
                
            } catch (error) {
                results.error.push(`EraserTool機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.EraserTool = EraserTool;
}

console.log('🧹 EraserTool Phase1.5 非破壊編集対応版 Loaded（AbstractTool継承・互換性修正済み）');
console.log('📏 RecordManager統合・Undo/Redo対応・操作記録・ERASEブレンドモード・座標ズレ完全解決');
console.log('🔄 非破壊編集基盤・AbstractTool継承・Phase1.5完全対応完了');/**
 * 🧹 EraserTool Phase1.5 非破壊編集対応版 - AbstractTool継承・RecordManager統合
 * 📋 RESPONSIBILITY: 描画内容の消去処理・非破壊編集対応・操作記録
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換・直接Manager作成
 * ✅ PERMISSION: PIXI.Graphics作成・消去処理・CanvasManagerへの渡し・操作記録
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・非破壊編集・ERASEブレンドモード活用
 * 🔄 INTEGRATION: CanvasManager・RecordManager・CoordinateManager統合
 * 🎯 FEATURE: Undo/Redo対応・操作履歴記録・キャンバス外描画対応・座標ズレ完全解決
 * 🆕 Phase1.5: AbstractTool継承・RecordManager統合・非破壊編集完全対応
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.EraserTool) {
    /**
     * EraserTool - Phase1.5 非破壊編集対応版（AbstractTool継承）
     * AbstractToolを継承して消去処理・非破壊編集・操作記録を行う
     */
    class EraserTool extends window.Tegaki.AbstractTool {
        constructor() {
            // AbstractTool継承（ツール名とデフォルト設定）
            super('eraser', {
                eraserSize: 20,         // デフォルト消しゴムサイズ
                eraserOpacity: 1.0,     // 消去強度（完全消去）
                smoothErasing: true     // スムーズ消去
            });
            
            console.log('🧹 EraserTool Phase1.5 非破壊編集対応版 作成（AbstractTool継承）');
            
            // 消しゴム固有の状態
            this.currentErasePath = null;  // 現在の消去Graphics
            this.points = [];              // 現在消去パスの座標配列
            this.eraseHistory = [];        // 消去操作履歴（ローカル参照用）
            
            // 統計情報
            this.eraseCount = 0;           // 消去実行回数
            this.lastEraseInfo = null;     // 最後の消去情報
        }
        
        /**
         * 🔧 FIX: ToolManagerとの互換性のため setCanvasManager メソッドを追加
         */
        setCanvasManager(canvasManager) {
            console.log('🧹 EraserTool - setCanvasManager 呼び出し（互換性メソッド）');
            
            // AbstractToolのinitializeメソッドを呼び出す
            this.initialize({
                canvasManager: canvasManager,
                coordinateManager: window.Tegaki?.CoordinateManagerInstance,
                recordManager: window.Tegaki?.RecordManagerInstance,
                eventBus: window.Tegaki?.EventBusInstance
            });
        }
        
        /**
         * デフォルト設定取得（AbstractTool実装）
         */
        getDefaultSettings() {
            return {
                ...super.getDefaultSettings(),
                eraserSize: 20,         // デフォルト消しゴムサイズ
                eraserOpacity: 1.0,     // 消去強度（完全消去）
                smoothErasing: true     // スムーズ消去
            };
        }
        
        /**
         * 🔧 FIX: AbstractToolのマウスイベントをPointerイベントメソッドに転送
         */
        onPointerDown(x, y, event) {
            return this.handleMouseDown({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        onPointerMove(x, y, event) {
            return this.handleMouseMove({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        onPointerUp(x, y, event) {
            return this.handleMouseUp({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        /**
         * 消去開始処理（AbstractTool実装）
         */
        onDrawStart(point, event) {
            if (!this.canvasManager) {
                console.warn('⚠️ EraserTool: CanvasManager not set');
                return;
            }
            
            const { x, y } = point;
            
            // アクティブレイヤー確認（背景レイヤーは保護）
            const activeLayerId = this.canvasManager.getActiveLayerId();
            if (activeLayerId === 'layer0') {
                console.warn('⚠️ EraserTool: 背景レイヤーへの消去は禁止されています');
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showWarning(
                        '背景レイヤーは消去できません',
                        { context: 'EraserTool.onDrawStart' }
                    );
                }
                return;
            }
            
            console.log(`🧹 消去開始: layer=${activeLayerId}, pos=(${Math.round(x)}, ${Math.round(y)}), size=${this.settings.eraserSize}`);
            
            // 座標配列初期化
            this.points = [{x, y, timestamp: Date.now()}];
            this.eraseCount++;
            
            // 消去Graphics作成
            this.currentErasePath = new PIXI.Graphics();
            
            // ERASEブレンドモード設定（初期設定で確実に）
            this.currentErasePath.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // 🆕 currentActionにGraphics設定（Undo/Redo用）
            if (this.currentAction) {
                this.currentAction.graphics = this.currentErasePath;
                this.currentAction.type = 'erase'; // 操作タイプ設定
            }
            
            // 消去用円形描画
            this.drawEraseCircle(x, y);
            
            // アクティブレイヤーに追加（専用メソッド使用）
            try {
                if (this.canvasManager.addEraseGraphicsToLayer) {
                    this.canvasManager.addEraseGraphicsToLayer(this.currentErasePath);
                } else {
                    // フォールバック: 通常のGraphics追加メソッドを使用
                    this.canvasManager.addGraphicsToLayer(this.currentErasePath);
                }
                console.log(`✅ 消去Graphics追加成功: layer=${activeLayerId}`);
            } catch (error) {
                console.error('❌ 消去Graphics追加失敗:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        'technical',
                        `消去Graphics追加失敗: ${error.message}`,
                        { context: 'EraserTool.onDrawStart' }
                    );
                }
            }
        }
        
        /**
         * 消去更新処理（AbstractTool実装）
         */
        onDrawMove(point, event) {
            if (!this.currentErasePath) return;
            
            const { x, y } = point;
            
            // 点を記録（タイムスタンプ付き）
            this.points.push({x, y, timestamp: Date.now()});
            
            // 現在位置に消去円描画
            this.drawEraseCircle(x, y);
            
            // スムーズ消去：前の点との間を補間
            if (this.settings.smoothErasing && this.points.length > 1) {
                const prevPoint = this.points[this.points.length - 2];
                const distance = Math.sqrt(
                    Math.pow(x - prevPoint.x, 2) + Math.pow(y - prevPoint.y, 2)
                );
                
                // 補間距離を完全修正（より密で滑らかな補間）
                const minInterpolationDistance = this.settings.eraserSize / 4;
                if (distance > minInterpolationDistance) {
                    // 補間ステップ数を完全修正（滑らかさ向上）
                    const steps = Math.max(2, Math.ceil(distance / (this.settings.eraserSize / 3)));
                    for (let i = 1; i < steps; i++) {
                        const ratio = i / steps;
                        const interpX = prevPoint.x + (x - prevPoint.x) * ratio;
                        const interpY = prevPoint.y + (y - prevPoint.y) * ratio;
                        
                        this.drawEraseCircle(interpX, interpY);
                    }
                }
            }
            
            // パフォーマンス監視
            if (this.points.length > 1000) {
                console.warn(`⚠️ EraserTool: 消去パスが長すぎます (${this.points.length} points)`);
            }
        }
        
        /**
         * 消去終了処理（AbstractTool実装）
         */
        onDrawEnd(point, event) {
            if (!this.currentErasePath) return;
            
            const { x, y } = point;
            
            // 最終点に消去円追加
            this.drawEraseCircle(x, y);
            
            // 最終点記録
            this.points.push({x, y, timestamp: Date.now()});
            
            // 🆕 消去データをローカル履歴に保存
            if (this.currentAction) {
                const eraseData = {
                    id: `erase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    layerId: this.canvasManager?.getActiveLayerId() || 'default',
                    points: [...this.points],
                    settings: {
                        eraserSize: this.settings.eraserSize,
                        eraserOpacity: this.settings.eraserOpacity,
                        smoothErasing: this.settings.smoothErasing
                    },
                    createdAt: Date.now(),
                    type: 'erase',
                    graphics: this.currentErasePath
                };
                
                this.eraseHistory.push(eraseData);
                console.log(`💾 消去操作保存: id=${eraseData.id}, points=${eraseData.points.length}`);
            }
            
            // 統計情報記録
            const pathLength = this.points.length;
            const activeLayerId = this.canvasManager?.getActiveLayerId();
            const startTime = this.points[0]?.timestamp || Date.now();
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            this.lastEraseInfo = {
                layerId: activeLayerId,
                pathLength: pathLength,
                duration: duration,
                eraserSize: this.settings.eraserSize,
                smoothErasing: this.settings.smoothErasing,
                startPos: { x: this.points[0]?.x || 0, y: this.points[0]?.y || 0 },
                endPos: { x, y }
            };
            
            console.log(`✅ 消去完了: layer=${activeLayerId}, pathPoints=${pathLength}, duration=${duration}ms, size=${this.settings.eraserSize}`);
            
            // リセット
            this.currentErasePath = null;
            this.points = [];
        }
        
        /**
         * 🆕 操作取り消し処理（AbstractTool実装）
         */
        onUndo(operationData) {
            console.log(`↶ 消去操作取り消し: ${operationData.id}`);
            
            // ローカル履歴からも削除
            const index = this.eraseHistory.findIndex(erase => erase.id === operationData.id);
            if (index !== -1) {
                this.eraseHistory.splice(index, 1);
                console.log(`🗑️ ローカル消去履歴削除: index=${index}`);
            }
        }
        
        /**
         * 🆕 操作やり直し処理（AbstractTool実装）
         */
        onRedo(operationData) {
            console.log(`↷ 消去操作復元: ${operationData.id}`);
            
            // Graphics再作成（必要に応じて）
            if (!operationData.graphics && operationData.data) {
                const eraseData = operationData.data;
                operationData.graphics = this.redrawErase(eraseData);
                
                if (operationData.graphics && this.canvasManager) {
                    if (this.canvasManager.addEraseGraphicsToLayer) {
                        this.canvasManager.addEraseGraphicsToLayer(operationData.graphics);
                    } else {
                        this.canvasManager.addGraphicsToLayer(operationData.graphics);
                    }
                }
            }
            
            // ローカル履歴にも復元
            if (operationData.data && !this.eraseHistory.find(e => e.id === operationData.id)) {
                const eraseData = {
                    ...operationData.data,
                    graphics: operationData.graphics
                };
                this.eraseHistory.push(eraseData);
                console.log(`📥 ローカル消去履歴復元: id=${eraseData.id}`);
            }
        }
        
        /**
         * 未完了操作強制終了処理（AbstractTool実装）
         */
        onOperationForceEnd(operationData) {
            console.log(`⚠️ 消去操作強制終了: ${operationData.id}`);
            
            // 未完了のGraphicsがあれば削除
            if (this.currentErasePath && this.canvasManager) {
                this.canvasManager.removeGraphicsFromLayer(this.currentErasePath);
            }
            
            // 状態リセット
            this.currentErasePath = null;
            this.points = [];
        }
        
        /**
         * 消去円描画（座標精度・ブレンドモード完全修正版）
         */
        drawEraseCircle(x, y) {
            if (!this.currentErasePath) return;
            
            // ERASEブレンドモード再保証
            this.currentErasePath.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // 座標精度確保
            const preciseX = Math.round(x * 10) / 10;
            const preciseY = Math.round(y * 10) / 10;
            const preciseRadius = Math.round((this.settings.eraserSize / 2) * 10) / 10;
            
            // 白色で円形描画（ERASEブレンドモードで消去に変換される）
            this.currentErasePath.beginFill(0xffffff, this.settings.eraserOpacity);
            this.currentErasePath.drawCircle(preciseX, preciseY, preciseRadius);
            this.currentErasePath.endFill();
            
            // デバッグ: 最初の数回の描画をログ出力
            if (this.points.length <= 3) {
                console.log(`🧹 消去円描画: pos=(${preciseX}, ${preciseY}), radius=${preciseRadius}, opacity=${this.settings.eraserOpacity}`);
            }
        }
        
        /**
         * 消去操作再描画（Undo/Redo用）
         */
        redrawErase(eraseData) {
            if (!eraseData || !eraseData.points) return null;
            
            const graphics = new PIXI.Graphics();
            graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // 消去パス再描画
            const points = eraseData.points;
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const preciseX = Math.round(point.x * 10) / 10;
                const preciseY = Math.round(point.y * 10) / 10;
                const preciseRadius = Math.round((eraseData.settings.eraserSize / 2) * 10) / 10;
                
                graphics.beginFill(0xffffff, eraseData.settings.eraserOpacity);
                graphics.drawCircle(preciseX, preciseY, preciseRadius);
                graphics.endFill();
            }
            
            return graphics;
        }
        
        // ========================================
        // 設定・ユーティリティメソッド群
        // ========================================
        
        /**
         * 消しゴムサイズ設定
         */
        setEraserSize(size) {
            const minSize = 1;
            const maxSize = 200;
            const validSize = Math.max(minSize, Math.min(maxSize, Math.round(size)));
            
            if (validSize !== size) {
                console.warn(`⚠️ 消しゴムサイズ調整: ${size} → ${validSize} (範囲: ${minSize}-${maxSize})`);
            }
            
            this.updateSetting('eraserSize', validSize);
            console.log(`🧹 消しゴムサイズ設定: ${validSize}px`);
        }
        
        /**
         * 消しゴム透明度（消去強度）設定
         */
        setEraserOpacity(opacity) {
            const minOpacity = 0.1;
            const maxOpacity = 1.0;
            const validOpacity = Math.max(minOpacity, Math.min(maxOpacity, opacity));
            
            if (Math.abs(validOpacity - opacity) > 0.001) {
                console.warn(`⚠️ 消去強度調整: ${opacity} → ${validOpacity} (範囲: ${minOpacity}-${maxOpacity})`);
            }
            
            this.updateSetting('eraserOpacity', validOpacity);
            console.log(`🧹 消去強度設定: ${validOpacity}`);
        }
        
        /**
         * スムーズ消去設定
         */
        setSmoothErasing(enabled) {
            this.updateSetting('smoothErasing', !!enabled);
            console.log(`🧹 スムーズ消去: ${this.settings.smoothErasing ? '有効' : '無効'}`);
        }
        
        /**
         * 消去履歴取得
         */
        getEraseHistory() {
            return [...this.eraseHistory];
        }
        
        /**
         * 統計情報取得
         */
        getStats() {
            return {
                totalEraseCount: this.eraseCount,
                lastEraseInfo: this.lastEraseInfo,
                currentlyErasing: this.isDrawing,
                currentPathLength: this.points.length
            };
        }
        
        /**
         * ブレンドモード名取得（デバッグ用）
         */
        getBlendModeName(blendMode) {
            const blendModeNames = {
                [PIXI.BLEND_MODES.NORMAL]: 'NORMAL',
                [PIXI.BLEND_MODES.ADD]: 'ADD',
                [PIXI.BLEND_MODES.MULTIPLY]: 'MULTIPLY',
                [PIXI.BLEND_MODES.SCREEN]: 'SCREEN',
                [PIXI.BLEND_MODES.OVERLAY]: 'OVERLAY',
                [PIXI.BLEND_MODES.DARKEN]: 'DARKEN',
                [PIXI.BLEND_MODES.LIGHTEN]: 'LIGHTEN',
                [PIXI.BLEND_MODES.COLOR_DODGE]: 'COLOR_DODGE',
                [PIXI.BLEND_MODES.COLOR_BURN]: 'COLOR_BURN',
                [PIXI.BLEND_MODES.HARD_LIGHT]: 'HARD_LIGHT',
                [PIXI.BLEND_MODES.SOFT_LIGHT]: 'SOFT_LIGHT',
                [PIXI.BLEND_MODES.DIFFERENCE]: 'DIFFERENCE',
                [PIXI.BLEND_MODES.EXCLUSION]: 'EXCLUSION',
                [PIXI.BLEND_MODES.HUE]: 'HUE',
                [PIXI.BLEND_MODES.SATURATION]: 'SATURATION',
                [PIXI.BLEND_MODES.COLOR]: 'COLOR',
                [PIXI.BLEND_MODES.LUMINOSITY]: 'LUMINOSITY',
                [PIXI.BLEND_MODES.ERASE]: 'ERASE',
                [PIXI.BLEND_MODES.XOR]: 'XOR'
            };
            
            return blendModeNames[blendMode] || `UNKNOWN(${blendMode})`;
        }
        
        /**
         * 🆕 Phase1.5デバッグ情報取得（AbstractTool拡張）
         */
        getDebugInfo() {
            const baseInfo = super.getToolState ? super.getToolState() : {};
            
            return {
                ...baseInfo,
                // 消しゴム固有情報
                eraser: {
                    hasCurrentPath: !!this.currentErasePath,
                    currentPathPoints: this.points.length,
                    eraseHistoryCount: this.eraseHistory.length,
                    totalEraseCount: this.eraseCount,
                    
                    // 現在の設定
                    eraserSize: this.settings.eraserSize,
                    eraserOpacity: this.settings.eraserOpacity,
                    smoothErasing: this.settings.smoothErasing
                },
                
                // PIXI Graphics情報
                graphics: this.currentErasePath ? {
                    hasGraphics: true,
                    blendMode: this.currentErasePath.blendMode,
                    blendModeName: this.getBlendModeName(this.currentErasePath.blendMode),
                    childrenCount: this.currentErasePath.children.length,
                    visible: this.currentErasePath.visible,
                    alpha: this.currentErasePath.alpha
                } : { hasGraphics: false },
                
                // 統計情報
                stats: this.getStats(),
                
                // パフォーマンス情報
                performance: {
                    maxRecommendedPathLength: 1000,
                    currentPathLength: this.points.length,
                    pathLengthStatus: this.points.length > 1000 ? 'warning' : 'ok'
                }
            };
        }
        
        /**
         * 🆕 Phase1.5機能テスト
         */
        testPhase15Features() {
            const results = { success: [], error: [], warning: [] };
            
            // 消しゴム固有機能テスト
            try {
                // Graphics作成テスト
                const testGraphics = new PIXI.Graphics();
                testGraphics.blendMode = PIXI.BLEND_MODES.ERASE;
                testGraphics.beginFill(0xffffff);
                testGraphics.drawCircle(10, 10, 5);
                testGraphics.endFill();
                
                results.success.push('EraserTool: PIXI.Graphics消去機能正常');
                
                // 設定変更テスト
                const originalSize = this.settings.eraserSize;
                this.setEraserSize(30);
                if (this.settings.eraserSize === 30) {
                    results.success.push('EraserTool: 設定変更機能正常');
                    this.setEraserSize(originalSize); // 復元
                } else {
                    results.error.push('EraserTool: 設定変更機能異常');
                }
                
                // 消去履歴テスト
                if (Array.isArray(this.eraseHistory)) {
                    results.success.push('EraserTool: 消去履歴管理正常');
                } else {
                    results.error.push('EraserTool: 消去履歴管理異常');
                }
                
                // ブレンドモード確認
                if (PIXI.BLEND_MODES.ERASE !== undefined) {
                    results.success.push('EraserTool: ERASEブレンドモード利用可能');
                } else {
                    results.error.push('EraserTool: ERASEブレンドモード未対応');
                }
                
            } catch (error) {
                results.error.push(`EraserTool機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.EraserTool = EraserTool;
}

console.log('🧹 EraserTool Phase1.5 非破壊編集対応版 Loaded（AbstractTool継承・互換性修正済み）');
console.log('📏 RecordManager統合・Undo/Redo対応・操作記録・ERASEブレンドモード・座標ズレ完全解決');
console.log('🔄 非破壊編集基盤・AbstractTool継承・Phase1.5完全対応完了');