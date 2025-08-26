/**
 * 🎯 AbstractTool - Phase1.5 ツール基底クラス（非破壊編集対応）
 * 📋 RESPONSIBILITY: 全ツール共通処理・非破壊編集・座標処理・RecordManager連携
 * 🚫 PROHIBITION: 具体的な描画実装・UI操作・Manager作成
 * ✅ PERMISSION: 共通処理・抽象メソッド定義・RecordManager活用・CoordinateManager活用
 * 
 * 📏 DESIGN_PRINCIPLE: 抽象基底クラス・共通処理集約・非破壊編集基盤・Phase1.5対応
 * 🔄 INTEGRATION: RecordManager + CoordinateManager との連携
 * 🎯 FEATURE: Undo/Redo対応・操作履歴管理・座標処理統合・Phase1.5基盤
 * 🆕 Phase1.5: 非破壊編集・操作記録・座標変換統合・ツール基底クラス確立
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AbstractTool) {
    /**
     * AbstractTool - Phase1.5 ツール基底クラス（非破壊編集対応）
     * 全ツールが継承する基底クラス・共通処理・非破壊編集・座標処理を提供
     */
    class AbstractTool {
        constructor(name, options = {}) {
            this.toolName = name;
            this.isActive = false;
            this.isDrawing = false;
            
            // Phase1.5 新Manager参照
            this.recordManager = null;      // 非破壊編集・Undo/Redo
            this.coordinateManager = null;  // 座標変換
            this.canvasManager = null;      // Canvas操作
            
            // 操作状態管理
            this.currentOperation = null;   // 現在の操作（ストローク等）
            this.operationId = 0;          // 操作ID生成用
            
            // 設定
            this.settings = {
                ...this.getDefaultSettings(),
                ...options
            };
            
            console.log(`🎯 AbstractTool "${name}" 作成完了（Phase1.5非破壊編集対応）`);
        }
        
        /**
         * 🆕 Phase1.5 Manager設定（必須）
         */
        setManagers(managers) {
            this.recordManager = managers.recordManager || null;
            this.coordinateManager = managers.coordinateManager || null;
            this.canvasManager = managers.canvasManager || null;
            
            console.log(`🔧 ${this.toolName}Tool Manager設定完了:`, {
                recordManager: !!this.recordManager,
                coordinateManager: !!this.coordinateManager,
                canvasManager: !!this.canvasManager
            });
        }
        
        /**
         * 🆕 RecordManager設定（単独）
         */
        setRecordManager(recordManager) {
            this.recordManager = recordManager;
            console.log(`🔄 ${this.toolName}Tool RecordManager設定完了`);
        }
        
        /**
         * 🆕 CoordinateManager設定（単独）
         */
        setCoordinateManager(coordinateManager) {
            this.coordinateManager = coordinateManager;
            console.log(`📐 ${this.toolName}Tool CoordinateManager設定完了`);
        }
        
        /**
         * CanvasManager設定（既存）
         */
        setCanvasManager(canvasManager) {
            this.canvasManager = canvasManager;
            console.log(`🎨 ${this.toolName}Tool CanvasManager設定完了`);
        }
        
        /**
         * ツール有効化
         */
        activate() {
            this.isActive = true;
            this.onActivate();
            console.log(`✅ ${this.toolName}Tool 有効化`);
        }
        
        /**
         * ツール無効化
         */
        deactivate() {
            this.isActive = false;
            this.isDrawing = false;
            
            // 描画中の操作を強制終了
            if (this.currentOperation) {
                this.forceEndOperation();
            }
            
            this.onDeactivate();
            console.log(`⏹️ ${this.toolName}Tool 無効化`);
        }
        
        /**
         * 🆕 ポインターダウン処理（非破壊編集対応）
         */
        onPointerDown(x, y, event) {
            if (!this.isActive) return;
            
            // 座標検証（CoordinateManager使用）
            if (!this.isValidCoordinate(x, y)) {
                console.warn(`⚠️ ${this.toolName}Tool: 無効な座標 (${x}, ${y})`);
                return;
            }
            
            // 描画開始処理
            this.isDrawing = true;
            
            // 🆕 操作開始記録
            this.startOperation(x, y, event);
            
            // 具体的な描画開始処理（継承クラスで実装）
            this.onDrawStart(x, y, event);
            
            console.log(`🎯 ${this.toolName}Tool 描画開始: (${Math.round(x)}, ${Math.round(y)})`);
        }
        
        /**
         * 🆕 ポインタームーブ処理（非破壊編集対応）
         */
        onPointerMove(x, y, event) {
            if (!this.isActive || !this.isDrawing) return;
            
            // 座標検証
            if (!this.isValidCoordinate(x, y)) {
                return; // 無効座標は無視（描画継続）
            }
            
            // 🆕 操作更新記録
            this.updateOperation(x, y, event);
            
            // 具体的な描画更新処理（継承クラスで実装）
            this.onDrawMove(x, y, event);
        }
        
        /**
         * 🆕 ポインターアップ処理（非破壊編集対応）
         */
        onPointerUp(x, y, event) {
            if (!this.isActive) return;
            
            if (this.isDrawing) {
                // 🆕 操作完了記録
                this.endOperation(x, y, event);
                
                // 具体的な描画終了処理（継承クラスで実装）
                this.onDrawEnd(x, y, event);
                
                console.log(`🏁 ${this.toolName}Tool 描画終了`);
            }
            
            this.isDrawing = false;
        }
        
        /**
         * 🆕 操作開始記録
         */
        startOperation(x, y, event) {
            if (!this.recordManager) {
                console.warn(`⚠️ ${this.toolName}Tool: RecordManager未設定 - 操作記録スキップ`);
                return;
            }
            
            // 操作ID生成
            this.operationId++;
            
            // 操作データ作成
            this.currentOperation = {
                id: `${this.toolName}_${this.operationId}_${Date.now()}`,
                tool: this.toolName,
                type: 'draw',
                startTime: Date.now(),
                startPoint: { x, y },
                points: [{ x, y, timestamp: Date.now() }],
                settings: { ...this.settings },
                graphics: null,  // 描画オブジェクト（後で設定）
                layerId: this.canvasManager?.getActiveLayerId() || 'default'
            };
            
            console.log(`🔄 ${this.toolName}Tool 操作開始記録:`, this.currentOperation.id);
        }
        
        /**
         * 🆕 操作更新記録
         */
        updateOperation(x, y, event) {
            if (!this.currentOperation) return;
            
            // ポイント追加（間引き処理付き）
            const lastPoint = this.currentOperation.points[this.currentOperation.points.length - 1];
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            
            // 最小距離フィルタ（パフォーマンス向上）
            if (distance > 2) {  // 2px以上移動時のみ記録
                this.currentOperation.points.push({
                    x, y,
                    timestamp: Date.now()
                });
            }
        }
        
        /**
         * 🆕 操作完了記録
         */
        endOperation(x, y, event) {
            if (!this.currentOperation || !this.recordManager) return;
            
            // 最終ポイント追加
            this.currentOperation.points.push({
                x, y,
                timestamp: Date.now()
            });
            
            // 操作完了
            this.currentOperation.endTime = Date.now();
            this.currentOperation.duration = this.currentOperation.endTime - this.currentOperation.startTime;
            
            // 🆕 RecordManagerに操作記録
            const operation = {
                id: this.currentOperation.id,
                type: 'tool_operation',
                toolName: this.toolName,
                data: { ...this.currentOperation },
                timestamp: Date.now(),
                
                // Undo/Redo関数
                undo: () => this.undoOperation(this.currentOperation),
                redo: () => this.redoOperation(this.currentOperation)
            };
            
            this.recordManager.recordOperation(operation);
            
            console.log(`📝 ${this.toolName}Tool 操作記録完了:`, operation.id);
            
            // 操作クリア
            this.currentOperation = null;
        }
        
        /**
         * 🆕 操作強制終了（ツール切り替え時等）
         */
        forceEndOperation() {
            if (!this.currentOperation) return;
            
            console.log(`⚠️ ${this.toolName}Tool 操作強制終了:`, this.currentOperation.id);
            
            // 未完了操作の処理（継承クラスで実装）
            this.onOperationForceEnd(this.currentOperation);
            
            // 操作クリア
            this.currentOperation = null;
        }
        
        /**
         * 🆕 操作取り消し（Undo）
         */
        undoOperation(operationData) {
            console.log(`↶ ${this.toolName}Tool 操作取り消し:`, operationData.id);
            
            // 描画オブジェクト削除
            if (operationData.graphics && this.canvasManager) {
                this.canvasManager.removeGraphicsFromLayer(operationData.graphics, operationData.layerId);
            }
            
            // 継承クラス固有のUndo処理
            this.onUndo(operationData);
        }
        
        /**
         * 🆕 操作やり直し（Redo）
         */
        redoOperation(operationData) {
            console.log(`↷ ${this.toolName}Tool 操作やり直し:`, operationData.id);
            
            // 描画オブジェクト復元
            if (operationData.graphics && this.canvasManager) {
                this.canvasManager.addGraphicsToLayer(operationData.graphics, operationData.layerId);
            }
            
            // 継承クラス固有のRedo処理
            this.onRedo(operationData);
        }
        
        /**
         * 🆕 座標検証（CoordinateManager使用）
         */
        isValidCoordinate(x, y) {
            // null/undefined チェック
            if (x == null || y == null) return false;
            
            // NaN チェック
            if (isNaN(x) || isNaN(y)) return false;
            
            // CoordinateManager使用の詳細検証（利用可能時）
            if (this.coordinateManager) {
                // キャンバス内または拡張描画エリア内かチェック
                return this.coordinateManager.isInsideCanvas(x, y) || 
                       this.coordinateManager.isInExtendedDrawArea(x, y);
            }
            
            // フォールバック：基本範囲チェック
            return x >= -50 && y >= -50 && x <= 850 && y <= 650;  // 拡張エリア含む
        }
        
        // =====================================
        // 抽象メソッド（継承クラスで実装必須）
        // =====================================
        
        /**
         * ツール有効化時の処理（抽象）
         */
        onActivate() {
            // 継承クラスで実装
        }
        
        /**
         * ツール無効化時の処理（抽象）
         */
        onDeactivate() {
            // 継承クラスで実装
        }
        
        /**
         * 描画開始処理（抽象）
         */
        onDrawStart(x, y, event) {
            throw new Error(`${this.toolName}Tool: onDrawStart must be implemented`);
        }
        
        /**
         * 描画更新処理（抽象）
         */
        onDrawMove(x, y, event) {
            throw new Error(`${this.toolName}Tool: onDrawMove must be implemented`);
        }
        
        /**
         * 描画終了処理（抽象）
         */
        onDrawEnd(x, y, event) {
            throw new Error(`${this.toolName}Tool: onDrawEnd must be implemented`);
        }
        
        /**
         * 未完了操作強制終了処理（抽象）
         */
        onOperationForceEnd(operationData) {
            // 継承クラスで必要に応じて実装
            console.log(`⚠️ ${this.toolName}Tool: 未完了操作強制終了`);
        }
        
        /**
         * Undo固有処理（抽象）
         */
        onUndo(operationData) {
            // 継承クラスで必要に応じて実装
        }
        
        /**
         * Redo固有処理（抽象）
         */
        onRedo(operationData) {
            // 継承クラスで必要に応じて実装
        }
        
        /**
         * デフォルト設定取得（抽象）
         */
        getDefaultSettings() {
            return {
                // 基本設定（継承クラスでオーバーライド）
                enabled: true,
                visible: true
            };
        }
        
        // =====================================
        // ユーティリティメソッド
        // =====================================
        
        /**
         * 設定取得
         */
        getSettings() {
            return { ...this.settings };
        }
        
        /**
         * 設定更新
         */
        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            this.onSettingsUpdate(this.settings);
            console.log(`⚙️ ${this.toolName}Tool 設定更新:`, newSettings);
        }
        
        /**
         * 設定更新時の処理（オーバーライド可能）
         */
        onSettingsUpdate(settings) {
            // 継承クラスで必要に応じて実装
        }
        
        /**
         * ツール状態取得
         */
        getState() {
            return {
                toolName: this.toolName,
                isActive: this.isActive,
                isDrawing: this.isDrawing,
                hasCurrentOperation: !!this.currentOperation,
                settings: this.getSettings(),
                
                // Manager状態
                managers: {
                    recordManager: !!this.recordManager,
                    coordinateManager: !!this.coordinateManager,
                    canvasManager: !!this.canvasManager
                }
            };
        }
        
        /**
         * 🆕 操作統計取得
         */
        getOperationStats() {
            if (!this.recordManager) return null;
            
            const history = this.recordManager.getHistory();
            const toolOperations = history.filter(op => op.toolName === this.toolName);
            
            return {
                totalOperations: toolOperations.length,
                averageDuration: toolOperations.length > 0 
                    ? toolOperations.reduce((sum, op) => sum + (op.data.duration || 0), 0) / toolOperations.length 
                    : 0,
                totalPoints: toolOperations.reduce((sum, op) => sum + (op.data.points?.length || 0), 0),
                lastOperation: toolOperations[toolOperations.length - 1]?.timestamp || null
            };
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                // 基本情報
                toolName: this.toolName,
                className: this.constructor.name,
                isActive: this.isActive,
                isDrawing: this.isDrawing,
                
                // 操作状態
                currentOperation: this.currentOperation ? {
                    id: this.currentOperation.id,
                    type: this.currentOperation.type,
                    pointCount: this.currentOperation.points.length,
                    duration: Date.now() - this.currentOperation.startTime
                } : null,
                
                // Manager接続状態
                managers: {
                    recordManager: !!this.recordManager,
                    coordinateManager: !!this.coordinateManager,
                    canvasManager: !!this.canvasManager
                },
                
                // 設定
                settings: this.getSettings(),
                
                // 統計
                operationStats: this.getOperationStats(),
                
                // Phase情報
                phase: '1.5',
                features: {
                    nonDestructiveEdit: !!this.recordManager,
                    coordinateTransform: !!this.coordinateManager,
                    operationRecording: true,
                    undoRedo: !!this.recordManager
                }
            };
        }
        
        /**
         * 🆕 Phase1.5機能確認
         */
        checkPhase15Features() {
            const results = {
                success: [],
                warning: [],
                error: []
            };
            
            // RecordManager確認
            if (this.recordManager) {
                if (typeof this.recordManager.recordOperation === 'function') {
                    results.success.push('RecordManager: 操作記録機能利用可能');
                } else {
                    results.error.push('RecordManager: recordOperation メソッド未実装');
                }
            } else {
                results.warning.push('RecordManager: 未設定（非破壊編集無効）');
            }
            
            // CoordinateManager確認
            if (this.coordinateManager) {
                if (typeof this.coordinateManager.isInsideCanvas === 'function') {
                    results.success.push('CoordinateManager: 座標変換機能利用可能');
                } else {
                    results.error.push('CoordinateManager: 座標変換メソッド未実装');
                }
            } else {
                results.warning.push('CoordinateManager: 未設定（基本座標処理使用）');
            }
            
            // CanvasManager確認
            if (this.canvasManager) {
                results.success.push('CanvasManager: 描画機能利用可能');
            } else {
                results.error.push('CanvasManager: 未設定（描画不可能）');
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AbstractTool = AbstractTool;
}

console.log('🎯 AbstractTool Phase1.5 非破壊編集対応版 Loaded');
console.log('📏 全ツール共通基底クラス・RecordManager統合・CoordinateManager統合');
console.log('🔄 操作記録・Undo/Redo・座標変換・Phase1.5基盤確立完了');