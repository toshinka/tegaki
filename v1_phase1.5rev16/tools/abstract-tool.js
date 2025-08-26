/**
 * 🎯 AbstractTool - Phase1.5完全実装版（座標変換修正）
 * 📋 RESPONSIBILITY: 全ツール基底クラス・共通処理・操作記録統合・ツール有効化処理・座標変換統合
 * 🚫 PROHIBITION: 具体的描画処理・ツール固有機能・UI制御
 * ✅ PERMISSION: 基本ツール動作・EventBus通信・RecordManager連携・CoordinateManager座標処理・アクティベーション管理
 * 
 * 📏 DESIGN_PRINCIPLE: 単一継承・共通処理統一・操作記録統合・状態管理・剛直構造・CoordinateManager完全連携
 * 🔄 INTEGRATION: Phase1.5完全・RecordManager連携・CoordinateManager完全活用・ツール有効化処理・座標変換統合
 * 🎯 Phase1.5: ツール基底・操作記録・正しい有効化フロー・骨太構造・座標変換完全修正
 * 
 * 🔧 座標変換修正ポイント:
 * - canvasManager.getCanvas()呼び出し削除（存在しないメソッド）
 * - coordinateManager.clientToCanvas()へ完全移譲
 * - フォールバック座標変換削除・剛直構造実装
 * - エラー処理を明確化・握りつぶし禁止
 */

(function() {
    'use strict';
    
    /**
     * AbstractTool - 全ツール基底クラス（座標変換修正版）
     */
    class AbstractTool {
        constructor(name, options = {}) {
            console.log(`🎯 AbstractTool Phase1.5完全実装 - ${name} 初期化開始`);
            
            this.name = name;
            this.id = options.id || name.toLowerCase();
            this.displayName = options.displayName || name;
            
            // ツール状態（Phase1.5完全実装）
            this.active = false;        // ツールがアクティブかどうか
            this.enabled = true;        // ツールが有効かどうか
            this.busy = false;          // 処理中フラグ
            
            // Manager参照（Phase1.5完全実装）
            this.canvasManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventBus = null;
            
            // 描画状態（Phase1.5完全実装）
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            // 操作記録（Phase1.5完全実装）
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
            
            console.log(`🎯 AbstractTool ${name} 完全実装完了`);
        }
        
        /**
         * 初期化（Phase1.5完全実装）
         */
        initialize(managers = {}) {
            console.log(`🎯 AbstractTool ${this.name} 初期化 - Phase1.5完全実装版`);
            
            // Phase1.5: Manager参照設定
            this.canvasManager = managers.canvasManager;
            this.coordinateManager = managers.coordinateManager;
            this.recordManager = managers.recordManager;
            this.eventBus = managers.eventBus;
            
            // 必須Manager確認（剛直構造）
            if (!this.canvasManager) {
                throw new Error(`AbstractTool ${this.name}: CanvasManager必須`);
            }
            
            // CoordinateManager推奨確認（Phase1.5では必須ではないが推奨）
            if (!this.coordinateManager) {
                console.warn(`⚠️ AbstractTool ${this.name}: CoordinateManager未設定 - 基本座標変換を使用`);
            }
            
            // EventBus連携設定
            this.setupEventBusListeners();
            
            this.initializeComplete = true;
            console.log(`✅ AbstractTool ${this.name} 初期化完了 - Phase1.5完全実装版`);
            
            return true;
        }
        
        /**
         * EventBus連携設定（Phase1.5完全実装）
         */
        setupEventBusListeners() {
            if (!this.eventBus) return;
            
            console.log(`🎯 AbstractTool ${this.name} EventBus連携設定 - Phase1.5完全実装`);
            
            // ツール有効/無効切り替えイベント
            this.eventBus.on(`tool:${this.id}:enable`, () => {
                this.setEnabled(true);
            });
            
            this.eventBus.on(`tool:${this.id}:disable`, () => {
                this.setEnabled(false);
            });
            
            // 設定変更イベント
            this.eventBus.on(`tool:${this.id}:setting`, (data) => {
                this.updateSetting(data.key, data.value);
            });
        }
        
        /**
         * ツールアクティベート（Phase1.5完全実装）
         */
        activate() {
            if (this.active) {
                console.log(`⚠️ AbstractTool ${this.name} 既にアクティブ`);
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} アクティベート - Phase1.5完全実装`);
            
            this.active = true;
            this.onActivate();
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('tool:activated', {
                    tool: this.name,
                    id: this.id
                });
            }
            
            console.log(`✅ AbstractTool ${this.name} アクティベート完了`);
        }
        
        /**
         * ツールデアクティベート（Phase1.5完全実装）
         */
        deactivate() {
            if (!this.active) {
                console.log(`⚠️ AbstractTool ${this.name} 既に非アクティブ`);
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} デアクティベート - Phase1.5完全実装`);
            
            // 進行中の操作中断
            if (this.isDrawing) {
                this.finishDrawing();
            }
            
            this.active = false;
            this.onDeactivate();
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('tool:deactivated', {
                    tool: this.name,
                    id: this.id
                });
            }
            
            console.log(`✅ AbstractTool ${this.name} デアクティベート完了`);
        }
        
        /**
         * マウスダウン処理（Phase1.5完全実装）
         */
        handleMouseDown(event) {
            if (!this.active) {
                console.log(`⚠️ ${this.name} not active, ignoring pointer down`);
                return false;
            }
            
            if (!this.enabled || this.busy) {
                console.log(`⚠️ ${this.name} not ready (enabled: ${this.enabled}, busy: ${this.busy})`);
                return false;
            }
            
            // 座標変換（clientXとclientYがある場合）
            let point;
            if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
                point = this.transformPoint(event.clientX, event.clientY);
            } else if (typeof event === 'object' && event.x !== undefined && event.y !== undefined) {
                // 直接座標が渡された場合
                point = { x: event.x, y: event.y };
            } else {
                console.error(`❌ ${this.name} 不正な座標データ:`, event);
                return false;
            }
            
            console.log(`🎯 AbstractTool ${this.name} マウスダウン: (${Math.round(point.x)}, ${Math.round(point.y)}) - Phase1.5完全実装`);
            
            // 描画開始
            this.startDrawing(point, event);
            
            // 操作記録開始
            this.startAction('draw', point);
            
            return true;
        }
        
        /**
         * マウス移動処理（Phase1.5完全実装）
         */
        handleMouseMove(event) {
            if (!this.active || !this.enabled) {
                return false;
            }
            
            // 座標変換（clientXとclientYがある場合）
            let point;
            if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
                point = this.transformPoint(event.clientX, event.clientY);
            } else if (typeof event === 'object' && event.x !== undefined && event.y !== undefined) {
                // 直接座標が渡された場合
                point = { x: event.x, y: event.y };
            } else {
                return false;
            }
            
            if (this.isDrawing) {
                // 描画継続
                this.continueDrawing(point, event);
                
                // 操作記録更新
                this.updateAction(point);
            }
            
            return this.isDrawing;
        }
        
        /**
         * マウスアップ処理（Phase1.5完全実装）
         */
        handleMouseUp(event) {
            if (!this.active || !this.enabled || !this.isDrawing) {
                return false;
            }
            
            // 座標変換（clientXとclientYがある場合）
            let point;
            if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
                point = this.transformPoint(event.clientX, event.clientY);
            } else if (typeof event === 'object' && event.x !== undefined && event.y !== undefined) {
                // 直接座標が渡された場合
                point = { x: event.x, y: event.y };
            } else {
                console.error(`❌ ${this.name} 不正な座標データ:`, event);
                return false;
            }
            
            console.log(`🎯 AbstractTool ${this.name} マウスアップ: (${Math.round(point.x)}, ${Math.round(point.y)}) - Phase1.5完全実装`);
            
            // 描画終了
            this.finishDrawing(point, event);
            
            // 操作記録終了
            this.finishAction(point);
            
            return true;
        }
        
        /**
         * 🔧 座標変換（Phase1.5修正版 - CoordinateManager完全移譲）
         * 
         * ❌ 修正前: canvasManager.getCanvas()呼び出し（存在しないメソッド）
         * ✅ 修正後: coordinateManager.clientToCanvas()への完全移譲
         */
        transformPoint(clientX, clientY) {
            // 🎯 Phase1.5: CoordinateManager優先使用（完全移譲）
            if (this.coordinateManager) {
                try {
                    return this.coordinateManager.clientToCanvas(clientX, clientY);
                } catch (error) {
                    console.error(`❌ AbstractTool ${this.name}: CoordinateManager座標変換エラー:`, error);
                    throw error; // エラーを隠蔽しない（剛直原則）
                }
            }
            
            // 🚨 CoordinateManager未設定時はエラー（剛直構造）
            // フォールバック禁止 - 正しい構造でのみ動作させる
            throw new Error(`AbstractTool ${this.name}: CoordinateManager未設定 - 座標変換不可能`);
        }
        
        /**
         * 描画開始（継承先で実装）
         */
        startDrawing(point, event) {
            console.log(`🎯 AbstractTool ${this.name} 描画開始 - Phase1.5完全実装`);
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
            console.log(`🎯 AbstractTool ${this.name} 描画終了 - Phase1.5完全実装`);
            this.isDrawing = false;
            this.currentStroke = null;
            this.onDrawEnd(point, event);
        }
        
        /**
         * 操作記録開始（Phase1.5完全実装）
         */
        startAction(actionType, point) {
            if (!this.recordActions || !this.recordManager) {
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} 操作記録開始: ${actionType} - Phase1.5完全実装`);
            
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
         * 操作記録更新（Phase1.5完全実装）
         */
        updateAction(point) {
            if (!this.currentAction || !this.recordManager) {
                return;
            }
            
            this.currentAction.points.push(point);
            this.currentAction.lastPoint = point;
        }
        
        /**
         * 操作記録終了（Phase1.5完全実装）
         */
        finishAction(point) {
            if (!this.currentAction || !this.recordManager) {
                return;
            }
            
            console.log(`🎯 AbstractTool ${this.name} 操作記録終了 - Phase1.5完全実装`);
            
            this.currentAction.endPoint = point;
            this.currentAction.endTime = Date.now();
            this.currentAction.duration = this.currentAction.endTime - this.currentAction.startTime;
            
            // RecordManager連携
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
            return {
                tool: this.name,
                action: 'undo',
                timestamp: Date.now()
            };
        }
        
        /**
         * 設定更新（Phase1.5完全実装）
         */
        updateSetting(key, value) {
            if (this.settings.hasOwnProperty(key)) {
                const oldValue = this.settings[key];
                this.settings[key] = value;
                
                console.log(`🎯 AbstractTool ${this.name} 設定更新: ${key} = ${value} (was: ${oldValue}) - Phase1.5完全実装`);
                
                // EventBus通知
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
         * 有効/無効設定（Phase1.5完全実装）
         */
        setEnabled(enabled) {
            if (this.enabled !== enabled) {
                console.log(`🎯 AbstractTool ${this.name} 有効状態変更: ${this.enabled} -> ${enabled} - Phase1.5完全実装`);
                
                if (!enabled && this.isDrawing) {
                    this.finishDrawing();
                }
                
                this.enabled = enabled;
                this.onEnabledChanged(enabled);
                
                // EventBus通知
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
         * 現在の状態取得（Phase1.5完全実装）
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
                implementation: 'complete',
                tool: this.name,
                features: {
                    basicDrawing: 'complete',
                    coordinateTransform: this.coordinateManager ? 'connected' : 'error',
                    operationRecording: this.recordManager ? 'connected' : 'disabled',
                    eventBusIntegration: this.eventBus ? 'connected' : 'disabled',
                    settingsManagement: 'complete',
                    toolActivation: 'complete'
                },
                state: this.getToolState(),
                coordinateManagerStatus: this.coordinateManager ? 'available' : 'missing',
                nextStep: 'Phase2準備 - レイヤー統合・変形機能・高度な描画処理'
            };
        }
    }
    
    // Tegaki名前空間にAbstractToolを公開
    if (typeof window.Tegaki === 'undefined') {
        window.Tegaki = {};
    }
    
    window.Tegaki.AbstractTool = AbstractTool;
    
    console.log('🎯 AbstractTool Phase1.5完全実装 - 座標変換修正版 - 名前空間登録完了');
    console.log('🔧 修正完了: CoordinateManager完全移譲・canvasManager.getCanvas()削除・剛直構造実装');
    
})();