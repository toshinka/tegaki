/**
 * 🎯 AbstractTool - Phase1.5スタブ実装版
 * 📋 RESPONSIBILITY: 全ツール基底クラス・共通処理・操作記録統合
 * 🚫 PROHIBITION: 具体的描画処理・ツール固有機能・UI制御
 * ✅ PERMISSION: 基本ツール動作・EventBus通信・RecordManager連携・座標処理
 * 
 * 📏 DESIGN_PRINCIPLE: 単一継承・共通処理統一・操作記録統合・状態管理
 * 🔄 INTEGRATION: Phase1.5基盤・RecordManager連携・CoordinateManager活用
 * 🎯 Phase1.5: ツール基底・操作記録・Phase2変形準備
 * 
 * 🔄 TOOL_ACTIVATION_FLOW: ツール有効化の正しい流れ
 * 1. ToolManager.selectTool(toolName) → currentTool設定
 * 2. ToolManager → currentTool.activate() 呼び出し
 * 3. AbstractTool.activate() → this.active = true + onActivate()
 * 4. PointerEvent → ツール.onPointerDown() → this.active確認 → 描画開始
 * 5. 前ツールがある場合は deactivate() → this.active = false
 */

(function() {
    'use strict';
    
    /**
     * AbstractTool - 全ツール基底クラス
     */
    class AbstractTool {
        constructor(name, options = {}) {
            console.log(`🎯 AbstractTool Phase1.5スタブ実装 - ${name} 初期化開始`);
            
            this.name = name;
            this.id = options.id || name.toLowerCase();
            this.displayName = options.displayName || name;
            
            // 🔧 CRITICAL: ツール状態（Phase1.5基盤）
            this.active = false;      // 🚨 アクティブ状態 - activate()で true, deactivate()で false
            this.enabled = true;      // 有効/無効状態
            this.busy = false;        // 処理中フラグ
            
            // Manager参照（Phase1.5基盤）
            this.canvasManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventBus = null;
            
            // 描画状態（Phase1.5基盤）
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            // 操作記録（Phase1.5基盤）
            this.recordActions = true;
            this.currentAction = null;
            
            // ツール設定（継承先でカスタマイズ）
            this.settings = {
                color: '#800000',
                size: 3,
                opacity: 1.0,
                pressure: false,
                ...options.settings
            };
            
            this.initializeComplete = false;
            
            console.log(`🎯 AbstractTool ${name} スタブ実装完了`);
        }
        
        /**
         * 初期化（Phase1.5スタブ - Manager連携準備）
         */
        initialize(managers = {}) {
            console.log(`🎯 AbstractTool ${this.name} 初期化 - Phase1.5スタブ版`);
            
            // Phase1.5: Manager参照設定（スタブ）
            this.canvasManager = managers.canvasManager;
            this.coordinateManager = managers.coordinateManager;
            this.recordManager = managers.recordManager;
            this.eventBus = managers.eventBus;
            
            // Phase1.5: 基本設定確認（スタブ）
            if (!this.canvasManager) {
                console.warn(`⚠️ AbstractTool ${this.name}: CanvasManager未提供 - Phase1.5開発中`);
            }
            
            if (!this.coordinateManager) {
                console.warn(`⚠️ AbstractTool ${this.name}: CoordinateManager未提供 - Phase1.5開発中`);
            }
            
            // Phase1.5: EventBus連携準備（スタブ）
            this.setupEventBusListeners();
            
            this.initializeComplete = true;
            console.log(`✅ AbstractTool ${this.name} 初期化完了 - Phase1.5スタブ版`);
            
            return true;
        }
        
        /**
         * EventBus連携設定（Phase1.5スタブ実装）
         */
        setupEventBusListeners() {
            if (!this.eventBus) return;
            
            console.log(`🎯 AbstractTool ${this.name} EventBus連携設定 - Phase1.5スタブ`);
            
            // Phase1.5: ツール有効/無効切り替えイベント準備（スタブ）
            this.eventBus.on(`tool:${this.id}:enable`, () => {
                this.setEnabled(true);
            });
            
            this.eventBus.on(`tool:${this.id}:disable`, () => {
                this.setEnabled(false);
            });
            
            // Phase1.5: 設定変更イベント準備（スタブ）
            this.eventBus.on(`tool:${this.id}:setting`, (data) => {
                this.updateSetting(data.key, data.value);
            });
        }
        
        /**
         * 🔧 CRITICAL FIX: ツールアクティベート（Phase1.5スタブ実装）
         */
        activate() {
            if (this.active) {
                console.log(`🎯 AbstractTool ${this.name} 既にアクティブ`);
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} アクティベート - Phase1.5スタブ`);
            
            this.active = true; // 🚨 重要: アクティブフラグ設定
            this.onActivate();
            
            // Phase1.5: EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('tool:activated', {
                    tool: this.name,
                    id: this.id
                });
            }
        }
        
        /**
         * 🔧 CRITICAL FIX: ツールデアクティベート（Phase1.5スタブ実装）
         */
        deactivate() {
            if (!this.active) {
                console.log(`🎯 AbstractTool ${this.name} 既に非アクティブ`);
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} デアクティベート - Phase1.5スタブ`);
            
            // Phase1.5: 進行中の操作中断（スタブ）
            if (this.isDrawing) {
                this.finishDrawing();
            }
            
            this.active = false; // 🚨 重要: アクティブフラグ解除
            this.onDeactivate();
            
            // Phase1.5: EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('tool:deactivated', {
                    tool: this.name,
                    id: this.id
                });
            }
        }
        
        /**
         * マウスダウン処理（Phase1.5スタブ実装）
         */
        handleMouseDown(event) {
            // 🔧 CRITICAL: アクティブ状態確認を最優先
            if (!this.active) {
                console.warn(`⚠️ AbstractTool ${this.name} not active, ignoring mouse down`);
                return false;
            }
            
            if (!this.enabled || this.busy) {
                console.warn(`⚠️ AbstractTool ${this.name} not enabled or busy, ignoring mouse down`);
                return false;
            }
            
            // Phase1.5: 座標変換（CoordinateManager連携準備）
            const point = this.transformPoint(event.clientX, event.clientY);
            
            console.log(`🎯 AbstractTool ${this.name} マウスダウン: (${point.x}, ${point.y}) - Phase1.5スタブ`);
            
            // Phase1.5: 描画開始（スタブ）
            this.startDrawing(point, event);
            
            // Phase1.5: 操作記録開始（スタブ）
            this.startAction('draw', point);
            
            return true;
        }
        
        /**
         * マウス移動処理（Phase1.5スタブ実装）
         */
        handleMouseMove(event) {
            if (!this.active || !this.enabled) {
                return false;
            }
            
            // Phase1.5: 座標変換（CoordinateManager連携準備）
            const point = this.transformPoint(event.clientX, event.clientY);
            
            if (this.isDrawing) {
                // Phase1.5: 描画継続（スタブ）
                this.continueDrawing(point, event);
                
                // Phase1.5: 操作記録更新（スタブ）
                this.updateAction(point);
            }
            
            return this.isDrawing;
        }
        
        /**
         * マウスアップ処理（Phase1.5スタブ実装）
         */
        handleMouseUp(event) {
            if (!this.active || !this.enabled || !this.isDrawing) {
                return false;
            }
            
            // Phase1.5: 座標変換（CoordinateManager連携準備）
            const point = this.transformPoint(event.clientX, event.clientY);
            
            console.log(`🎯 AbstractTool ${this.name} マウスアップ: (${point.x}, ${point.y}) - Phase1.5スタブ`);
            
            // Phase1.5: 描画終了（スタブ）
            this.finishDrawing(point, event);
            
            // Phase1.5: 操作記録終了（スタブ）
            this.finishAction(point);
            
            return true;
        }
        
        /**
         * 座標変換（Phase1.5スタブ実装）
         */
        transformPoint(clientX, clientY) {
            // Phase1.5: CoordinateManager連携（スタブ - 詳細実装で置き換え）
            if (this.coordinateManager) {
                return this.coordinateManager.clientToCanvas(clientX, clientY);
            }
            
            // Phase1.5: フォールバック座標変換（スタブ）
            const canvas = this.canvasManager?.getCanvas();
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            }
            
            return { x: clientX, y: clientY };
        }
        
        /**
         * 描画開始（継承先で実装）
         */
        startDrawing(point, event) {
            console.log(`🎯 AbstractTool ${this.name} 描画開始 - Phase1.5スタブ`);
            this.isDrawing = true;
            this.lastPoint = point;
            this.onDrawStart(point, event);
        }
        
        /**
         * 描画継続（継承先で実装）
         */
        continueDrawing(point, event) {
            this.lastPoint = point;
            this.onDrawMove(point, event);
        }
        
        /**
         * 描画終了（継承先で実装）
         */
        finishDrawing(point, event) {
            console.log(`🎯 AbstractTool ${this.name} 描画終了 - Phase1.5スタブ`);
            this.isDrawing = false;
            this.currentStroke = null;
            this.onDrawEnd(point, event);
        }
        
        /**
         * 操作記録開始（Phase1.5スタブ実装）
         */
        startAction(actionType, point) {
            if (!this.recordActions || !this.recordManager) {
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} 操作記録開始: ${actionType} - Phase1.5スタブ`);
            
            this.currentAction = {
                type: actionType,
                tool: this.name,
                startPoint: point,
                startTime: Date.now(),
                settings: { ...this.settings },
                points: [point]
            };
        }
        
        /**
         * 操作記録更新（Phase1.5スタブ実装）
         */
        updateAction(point) {
            if (!this.currentAction || !this.recordManager) {
                return;
            }
            
            this.currentAction.points.push(point);
            this.currentAction.lastPoint = point;
        }
        
        /**
         * 操作記録終了（Phase1.5スタブ実装）
         */
        finishAction(point) {
            if (!this.currentAction || !this.recordManager) {
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} 操作記録終了 - Phase1.5スタブ`);
            
            this.currentAction.endPoint = point;
            this.currentAction.endTime = Date.now();
            this.currentAction.duration = this.currentAction.endTime - this.currentAction.startTime;
            
            // Phase1.5: RecordManager連携（スタブ）
            this.recordManager.recordAction({
                type: 'tool_action',
                description: `${this.displayName}: ${this.currentAction.type}`,
                data: this.currentAction,
                undoData: this.createUndoData()
            });
            
            this.currentAction = null;
        }
        
        /**
         * Undo データ作成（継承先で実装）
         */
        createUndoData() {
            // Phase1.5: スタブ実装（詳細実装で置き換え）
            return {
                tool: this.name,
                action: 'undo',
                timestamp: Date.now()
            };
        }
        
        /**
         * 設定更新（Phase1.5スタブ実装）
         */
        updateSetting(key, value) {
            if (this.settings.hasOwnProperty(key)) {
                const oldValue = this.settings[key];
                this.settings[key] = value;
                
                console.log(`🎯 AbstractTool ${this.name} 設定更新: ${key} = ${value} (was: ${oldValue}) - Phase1.5スタブ`);
                
                // Phase1.5: EventBus通知（スタブ）
                if (this.eventBus) {
                    this.eventBus.emit('tool:setting:changed', {
                        tool: this.name,
                        key,
                        value,
                        oldValue
                    });
                }
                
                this.onSettingChanged(key, value, oldValue);
            }
        }
        
        /**
         * 有効/無効設定（Phase1.5スタブ実装）
         */
        setEnabled(enabled) {
            if (this.enabled !== enabled) {
                console.log(`🎯 AbstractTool ${this.name} 有効状態変更: ${this.enabled} -> ${enabled} - Phase1.5スタブ`);
                
                if (!enabled && this.isDrawing) {
                    this.finishDrawing();
                }
                
                this.enabled = enabled;
                this.onEnabledChanged(enabled);
                
                // Phase1.5: EventBus通知（スタブ）
                if (this.eventBus) {
                    this.eventBus.emit('tool:enabled:changed', {
                        tool: this.name,
                        enabled
                    });
                }
            }
        }
        
        // ========== 継承先でオーバーライドするメソッド ==========
        
        /**
         * アクティベート時処理（継承先で実装）
         */
        onActivate() {
            // 継承先で実装
        }
        
        /**
         * デアクティベート時処理（継承先で実装）
         */
        onDeactivate() {
            // 継承先で実装
        }
        
        /**
         * 描画開始時処理（継承先で実装）
         */
        onDrawStart(point, event) {
            // 継承先で実装
        }
        
        /**
         * 描画移動時処理（継承先で実装）
         */
        onDrawMove(point, event) {
            // 継承先で実装
        }
        
        /**
         * 描画終了時処理（継承先で実装）
         */
        onDrawEnd(point, event) {
            // 継承先で実装
        }
        
        /**
         * 設定変更時処理（継承先で実装）
         */
        onSettingChanged(key, value, oldValue) {
            // 継承先で実装
        }
        
        /**
         * 有効状態変更時処理（継承先で実装）
         */
        onEnabledChanged(enabled) {
            // 継承先で実装
        }
        
        /**
         * 現在の状態取得（Phase1.5スタブ実装）
         */
        getToolState() {
            return {
                name: this.name,
                id: this.id,
                displayName: this.displayName,
                active: this.active,
                enabled: this.enabled,
                busy: this.busy,
                isDrawing: this.isDrawing,
                settings: { ...this.settings },
                initialized: this.initializeComplete
            };
        }
        
        /**
         * Phase1.5ステータス確認
         */
        getPhase15Status() {
            return {
                phase: 'Phase1.5',
                implementation: 'stub',
                tool: this.name,
                features: {
                    basicDrawing: 'stub',
                    coordinateTransform: this.coordinateManager ? 'connected' : 'disconnected',
                    operationRecording: this.recordManager ? 'connected' : 'disconnected',
                    eventBusIntegration: this.eventBus ? 'connected' : 'disconnected',
                    settingsManagement: 'stub'
                },
                state: this.getToolState(),
                nextStep: 'DetailedImplementation - 具体的描画処理・Undo/Redo統合・パフォーマンス最適化'
            };
        }
    }
    
    // Tegaki名前空間にAbstractToolを公開
    if (typeof window.Tegaki === 'undefined') {
        window.Tegaki = {};
    }
    
    window.Tegaki.AbstractTool = AbstractTool;
    
    console.log('🎯 AbstractTool Phase1.5スタブ実装 - 名前空間登録完了');
    console.log('🔧 次のステップ: 詳細実装・RecordManager統合・CoordinateManager活用・継承ツール更新');
    
})()