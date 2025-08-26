/**
 * 🖊️ ToolManager Phase1.5完全修正版 - ツール有効化処理修正
 * 📋 RESPONSIBILITY: ツール選択・イベント転送・ツール有効化・Phase1.5 Manager統合
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な状態管理・設定管理・フォールバック・フェイルセーフ
 * ✅ PERMISSION: ツール切り替え・PointerEvent転送・ツール作成・Manager連携・ツールアクティベーション
 * 
 * 📏 DESIGN_PRINCIPLE: ツール管理専門・シンプル・直線的・Phase1.5 Manager統合・正しい構造でのみ動作
 * 🔄 INTEGRATION: CanvasManager・CoordinateManager・RecordManager・EventBus連携・ツール有効化処理
 * 🔧 FIX: ツール有効化処理修正・activate/deactivate実装・剛直構造
 * 
 * 🔧 修正ポイント:
 * - selectTool時にtool.activate()呼び出し追加
 * - 前のツールのdeactivate処理追加
 * - PointerEvent座標処理修正
 * - フォールバック削除・剛直構造実装
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.ToolManager) {
    /**
     * ToolManager - Phase1.5完全修正版（ツール有効化処理修正）
     * ツール切り替えとイベント転送・Phase1.5 Manager統合・ツール有効化処理
     */
    class ToolManager {
        constructor() {
            console.log('🖊️ ToolManager Phase1.5完全修正版作成（ツール有効化処理修正）');
            
            // 基本Manager
            this.canvasManager = null;
            
            // Phase1.5 Manager群
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventBus = null;
            
            // ツール管理
            this.currentTool = null;
            this.currentToolName = 'pen'; // デフォルトツール
            this.tools = new Map();
            
            this.initialized = false;
            this.phase15ManagersSet = false;
        }
        
        /**
         * CanvasManager設定（レイヤー確認付き）
         */
        setCanvasManager(canvasManager) {
            if (!canvasManager) {
                throw new Error('CanvasManager is required');
            }
            
            // CanvasManager準備状態確認
            if (!canvasManager.isReady()) {
                throw new Error('CanvasManager is not ready');
            }
            
            // 必要レイヤーの存在確認
            this.verifyRequiredLayers(canvasManager);
            
            this.canvasManager = canvasManager;
            console.log('🖊️ ToolManager - CanvasManager設定・レイヤー確認完了');
        }
        
        /**
         * Phase1.5 Manager群設定
         */
        setPhase15Managers(managers = {}) {
            console.log('🆕 ToolManager Phase1.5 Manager群設定開始...');
            
            // CoordinateManager設定
            if (managers.coordinateManager) {
                this.coordinateManager = managers.coordinateManager;
                console.log('✅ ToolManager - CoordinateManager設定完了');
            } else {
                console.warn('⚠️ CoordinateManager未提供 - ツール座標変換に影響する可能性');
            }
            
            // RecordManager設定
            if (managers.recordManager) {
                this.recordManager = managers.recordManager;
                console.log('✅ ToolManager - RecordManager設定完了');
            } else {
                console.warn('⚠️ RecordManager未提供 - Undo/Redo機能に影響する可能性');
            }
            
            // EventBus設定
            if (managers.eventBus) {
                this.eventBus = managers.eventBus;
                console.log('✅ ToolManager - EventBus設定完了');
            } else {
                console.warn('⚠️ EventBus未提供 - イベント通信に影響する可能性');
            }
            
            this.phase15ManagersSet = true;
            console.log('🆕 ToolManager Phase1.5 Manager群設定完了');
        }
        
        /**
         * RecordManager設定（app-core.jsからの呼び出し用）
         */
        setRecordManager(recordManager) {
            this.recordManager = recordManager;
            console.log('🔄 ToolManager - RecordManager設定完了（app-core経由）');
            
            // 既存ツールにRecordManager設定
            if (this.tools.size > 0) {
                this.updateToolManagers();
            }
        }
        
        /**
         * 必要レイヤー確認（重要：ツール作成前に実行）
         */
        verifyRequiredLayers(canvasManager) {
            const layer0 = canvasManager.getLayer('layer0');
            const layer1 = canvasManager.getLayer('layer1');
            
            if (!layer0) {
                throw new Error('Background layer (layer0) not found - CanvasManager not properly initialized');
            }
            
            if (!layer1) {
                throw new Error('Drawing layer (layer1) not found - CanvasManager not properly initialized');
            }
            
            // レイヤーがStageに正しく配置されているか確認
            const pixiApp = canvasManager.getPixiApp();
            if (!pixiApp || !pixiApp.stage) {
                throw new Error('PixiJS Application or stage not available');
            }
            
            if (layer0.parent !== pixiApp.stage) {
                throw new Error('Background layer (layer0) not attached to stage');
            }
            
            if (layer1.parent !== pixiApp.stage) {
                throw new Error('Drawing layer (layer1) not attached to stage');
            }
            
            console.log('✅ 必要レイヤー確認完了:', {
                layer0Exists: !!layer0,
                layer1Exists: !!layer1,
                layer0InStage: layer0.parent === pixiApp.stage,
                layer1InStage: layer1.parent === pixiApp.stage
            });
        }
        
        /**
         * ツール作成（Phase1.5完全実装版）
         */
        createTools() {
            if (!this.canvasManager) {
                throw new Error('CanvasManager not set - cannot create tools');
            }
            
            console.log('🔧 ツール作成開始 - Phase1.5完全実装版');
            
            // Phase1.5 Manager群設定確認
            if (!this.phase15ManagersSet) {
                console.warn('⚠️ Phase1.5 Manager群が未設定 - 基本機能のみで作成');
            }
            
            // Phase1.5 Manager群準備
            const managerConfig = {
                canvasManager: this.canvasManager,
                coordinateManager: this.coordinateManager,
                recordManager: this.recordManager,
                eventBus: this.eventBus
            };
            
            console.log('🔧 Manager設定状況:', {
                canvasManager: !!managerConfig.canvasManager,
                coordinateManager: !!managerConfig.coordinateManager,
                recordManager: !!managerConfig.recordManager,
                eventBus: !!managerConfig.eventBus
            });
            
            // ツールが既に存在する場合は再作成しない
            if (this.tools.size > 0) {
                console.warn('⚠️ ツール既存 - Manager設定のみ更新');
                this.updateToolManagers();
                return;
            }
            
            // PenTool作成
            if (window.Tegaki.PenTool) {
                const penTool = new window.Tegaki.PenTool();
                
                // 従来のsetCanvasManager（互換性維持）
                if (typeof penTool.setCanvasManager === 'function') {
                    penTool.setCanvasManager(this.canvasManager);
                }
                
                // AbstractToolベース初期化（Manager群提供）
                if (typeof penTool.initialize === 'function') {
                    penTool.initialize(managerConfig);
                    console.log('✅ PenTool - Phase1.5 Manager統合初期化完了');
                } else {
                    console.warn('⚠️ PenTool.initialize メソッドが利用できません');
                }
                
                this.tools.set('pen', penTool);
                console.log('✅ PenTool 作成・設定完了（Phase1.5対応）');
            } else {
                throw new Error('PenTool class not available');
            }
            
            // EraserTool作成
            if (window.Tegaki.EraserTool) {
                const eraserTool = new window.Tegaki.EraserTool();
                
                // 従来のsetCanvasManager（互換性維持）
                if (typeof eraserTool.setCanvasManager === 'function') {
                    eraserTool.setCanvasManager(this.canvasManager);
                }
                
                // AbstractToolベース初期化（Manager群提供）
                if (typeof eraserTool.initialize === 'function') {
                    eraserTool.initialize(managerConfig);
                    console.log('✅ EraserTool - Phase1.5 Manager統合初期化完了');
                } else {
                    console.warn('⚠️ EraserTool.initialize メソッドが利用できません');
                }
                
                this.tools.set('eraser', eraserTool);
                console.log('✅ EraserTool 作成・設定完了（Phase1.5対応）');
            } else {
                throw new Error('EraserTool class not available');
            }
            
            // ツール作成確認
            if (this.tools.size === 0) {
                throw new Error('No tools were created - tool classes not available');
            }
            
            // 初期ツール選択（重要：activate処理付き）
            const initialToolSelected = this.selectTool(this.currentToolName);
            if (!initialToolSelected) {
                throw new Error(`初期ツール選択失敗: ${this.currentToolName}`);
            }
            
            this.initialized = true;
            console.log(`✅ ToolManager - 全ツール作成完了（Phase1.5完全実装版） (${this.tools.size}個)`);
        }
        
        /**
         * 既存ツールのManager設定更新
         */
        updateToolManagers() {
            console.log('🔄 既存ツールのManager設定更新開始...');
            
            const managerConfig = {
                canvasManager: this.canvasManager,
                coordinateManager: this.coordinateManager,
                recordManager: this.recordManager,
                eventBus: this.eventBus
            };
            
            for (const [toolName, tool] of this.tools.entries()) {
                if (typeof tool.initialize === 'function') {
                    try {
                        tool.initialize(managerConfig);
                        console.log(`✅ ${toolName} - Manager設定更新完了`);
                    } catch (error) {
                        console.error(`❌ ${toolName} - Manager設定更新エラー:`, error);
                    }
                } else {
                    console.warn(`⚠️ ${toolName}.initialize メソッドが利用できません`);
                }
            }
            
            console.log('🔄 既存ツールのManager設定更新完了');
        }
        
        /**
         * 🔧 修正：ツール選択（ツールアクティベーション処理追加）
         */
        selectTool(toolName) {
            if (!toolName) {
                console.warn('⚠️ ツール名が指定されていません');
                return false;
            }
            
            const newTool = this.tools.get(toolName);
            if (!newTool) {
                console.warn(`⚠️ 未知のツール: ${toolName}`);
                return false;
            }
            
            // CanvasManager・レイヤー存在確認
            if (!this.canvasManager) {
                console.error('❌ CanvasManager not available - ツール選択を中断');
                return false;
            }
            
            // 描画ツールの場合はlayer1存在確認
            if (toolName === 'pen' || toolName === 'eraser') {
                const layer1 = this.canvasManager.getLayer('layer1');
                if (!layer1) {
                    console.error('❌ Drawing layer (layer1) が存在しません - ツール選択を中断');
                    return false;
                }
                
                if (!layer1.parent) {
                    console.error('❌ Drawing layer (layer1) がstageに接続されていません - ツール選択を中断');
                    return false;
                }
            }
            
            // 🔧 修正：現在のツールを無効化
            if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
                console.log(`🔄 前のツール ${this.currentToolName} を無効化`);
                this.currentTool.deactivate();
            }
            
            // 現在のツール変更
            this.currentTool = newTool;
            this.currentToolName = toolName;
            
            // 🔧 修正：新しいツールを有効化
            if (this.currentTool && typeof this.currentTool.activate === 'function') {
                console.log(`🎯 新しいツール ${toolName} を有効化`);
                this.currentTool.activate();
            } else {
                console.warn(`⚠️ ツール ${toolName} にactivateメソッドがありません`);
            }
            
            // アクティブレイヤー設定（描画系ツールの場合）
            if (this.canvasManager && (toolName === 'pen' || toolName === 'eraser')) {
                try {
                    this.canvasManager.setActiveLayer('layer1'); // 描画レイヤーをアクティブに
                } catch (error) {
                    console.error('❌ アクティブレイヤー設定エラー:', error);
                    return false;
                }
            }
            
            console.log(`✅ ツール選択成功: ${toolName} (アクティブレイヤー: ${this.canvasManager?.getActiveLayerId()}, 有効化: ${!!this.currentTool?.active})`);
            return true;
        }
        
        /**
         * 現在ツール取得
         */
        getCurrentTool() {
            return this.currentTool;
        }
        
        /**
         * 現在ツール名取得
         */
        getCurrentToolName() {
            return this.currentToolName;
        }
        
        /**
         * 🔧 修正：PointerDown イベント転送（座標処理修正）
         */
        handlePointerDown(x, y, event) {
            if (!this.currentTool) {
                console.warn('⚠️ アクティブツールがありません');
                return;
            }
            
            console.log(`🖊️ PointerDown [${this.currentToolName}]:`, { x, y });
            
            // ツールのhandleMouseDownを呼び出し（AbstractTool準拠）
            if (typeof this.currentTool.handleMouseDown === 'function') {
                try {
                    // 座標オブジェクトとしてeventを構成
                    const mouseEvent = {
                        clientX: x,
                        clientY: y,
                        x: x,
                        y: y,
                        pressure: event?.pressure || 1.0
                    };
                    
                    this.currentTool.handleMouseDown(mouseEvent);
                } catch (error) {
                    console.error(`❌ PointerDown処理エラー [${this.currentToolName}]:`, error);
                    throw error;
                }
            } else if (typeof this.currentTool.onPointerDown === 'function') {
                // フォールバック：従来のonPointerDown
                try {
                    this.currentTool.onPointerDown(x, y, event);
                } catch (error) {
                    console.error(`❌ PointerDown処理エラー（フォールバック） [${this.currentToolName}]:`, error);
                    throw error;
                }
            } else {
                console.warn(`⚠️ ツール ${this.currentToolName} は handleMouseDown/onPointerDown をサポートしていません`);
            }
        }
        
        /**
         * 🔧 修正：PointerMove イベント転送（座標処理修正）
         */
        handlePointerMove(x, y, event) {
            if (!this.currentTool) return;
            
            // ツールのhandleMouseMoveを呼び出し（AbstractTool準拠）
            if (typeof this.currentTool.handleMouseMove === 'function') {
                try {
                    // 座標オブジェクトとしてeventを構成
                    const mouseEvent = {
                        clientX: x,
                        clientY: y,
                        x: x,
                        y: y,
                        pressure: event?.pressure || 1.0
                    };
                    
                    this.currentTool.handleMouseMove(mouseEvent);
                } catch (error) {
                    console.error(`❌ PointerMove処理エラー [${this.currentToolName}]:`, error);
                }
            } else if (typeof this.currentTool.onPointerMove === 'function') {
                // フォールバック：従来のonPointerMove
                try {
                    this.currentTool.onPointerMove(x, y, event);
                } catch (error) {
                    console.error(`❌ PointerMove処理エラー（フォールバック） [${this.currentToolName}]:`, error);
                }
            }
        }
        
        /**
         * 🔧 修正：PointerUp イベント転送（座標処理修正）
         */
        handlePointerUp(x, y, event) {
            if (!this.currentTool) return;
            
            console.log(`🖊️ PointerUp [${this.currentToolName}]:`, { x, y });
            
            // ツールのhandleMouseUpを呼び出し（AbstractTool準拠）
            if (typeof this.currentTool.handleMouseUp === 'function') {
                try {
                    // 座標オブジェクトとしてeventを構成
                    const mouseEvent = {
                        clientX: x,
                        clientY: y,
                        x: x,
                        y: y,
                        pressure: event?.pressure || 1.0
                    };
                    
                    this.currentTool.handleMouseUp(mouseEvent);
                } catch (error) {
                    console.error(`❌ PointerUp処理エラー [${this.currentToolName}]:`, error);
                    throw error;
                }
            } else if (typeof this.currentTool.onPointerUp === 'function') {
                // フォールバック：従来のonPointerUp
                try {
                    this.currentTool.onPointerUp(x, y, event);
                } catch (error) {
                    console.error(`❌ PointerUp処理エラー（フォールバック） [${this.currentToolName}]:`, error);
                    throw error;
                }
            }
        }
        
        /**
         * 利用可能ツール一覧取得
         */
        getAvailableTools() {
            return Array.from(this.tools.keys());
        }
        
        /**
         * ツール情報取得
         */
        getToolInfo(toolName) {
            const tool = this.tools.get(toolName);
            if (!tool) return null;
            
            return {
                name: toolName,
                available: true,
                active: toolName === this.currentToolName,
                toolActive: tool.active || false,
                debugInfo: tool.getDebugInfo ? tool.getDebugInfo() : null,
                phase15Status: tool.getPhase15Status ? tool.getPhase15Status() : null
            };
        }
        
        /**
         * 初期化状態確認（強化版）
         */
        isReady() {
            return this.initialized && 
                   !!this.canvasManager && 
                   this.canvasManager.isReady() &&
                   this.tools.size > 0 &&
                   !!this.currentTool &&
                   this.phase15ManagersSet;
        }
        
        /**
         * デバッグ情報取得（Phase1.5対応版）
         */
        getDebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                canvasManagerSet: !!this.canvasManager,
                canvasManagerReady: this.canvasManager?.isReady() || false,
                
                // Phase1.5 Manager状態
                phase15Managers: {
                    coordinateManager: !!this.coordinateManager,
                    recordManager: !!this.recordManager,
                    eventBus: !!this.eventBus,
                    managersSet: this.phase15ManagersSet
                },
                
                // ツール状態
                toolCount: this.tools.size,
                availableTools: this.getAvailableTools(),
                currentTool: this.currentToolName,
                currentToolObject: !!this.currentTool,
                currentToolActive: this.currentTool?.active || false, // 🔧 追加
                
                // レイヤー状態
                activeLayer: this.canvasManager?.getActiveLayerId() || 'unknown',
                layerStatus: {
                    layer0Exists: !!this.canvasManager?.getLayer('layer0'),
                    layer1Exists: !!this.canvasManager?.getLayer('layer1')
                },
                
                // Phase情報
                phase: {
                    current: '1.5',
                    managerIntegration: this.phase15ManagersSet ? 'complete' : 'incomplete',
                    toolIntegration: 'active',
                    toolActivation: 'complete' // 🔧 追加
                },
                
                // 詳細診断情報
                diagnostics: {
                    coordinateManagerType: this.coordinateManager?.constructor.name || 'none',
                    recordManagerType: this.recordManager?.constructor.name || 'none',
                    eventBusType: this.eventBus?.constructor.name || 'none',
                    toolTypes: Array.from(this.tools.entries()).map(([name, tool]) => ({
                        name,
                        type: tool?.constructor.name || 'unknown',
                        active: tool?.active || false // 🔧 追加
                    }))
                }
            };
        }
        
        /**
         * Phase1.5統合状況確認
         */
        checkPhase15Integration() {
            console.log('🔍 ToolManager Phase1.5統合状況確認');
            
            const results = {
                success: [],
                warning: [],
                error: []
            };
            
            // Manager統合確認
            if (this.canvasManager) {
                results.success.push('CanvasManager: 統合完了');
            } else {
                results.error.push('CanvasManager: 未設定');
            }
            
            if (this.coordinateManager) {
                results.success.push('CoordinateManager: 統合完了');
            } else {
                results.warning.push('CoordinateManager: 未設定');
            }
            
            if (this.recordManager) {
                results.success.push('RecordManager: 統合完了');
            } else {
                results.warning.push('RecordManager: 未設定');
            }
            
            if (this.eventBus) {
                results.success.push('EventBus: 統合完了');
            } else {
                results.warning.push('EventBus: 未設定');
            }
            
            // Phase1.5 Manager設定フラグ確認
            if (this.phase15ManagersSet) {
                results.success.push('Phase1.5 Manager設定: 完了');
            } else {
                results.error.push('Phase1.5 Manager設定: 未完了');
            }
            
            // ツール統合確認
            if (this.tools.size > 0) {
                results.success.push(`ツール作成: ${this.tools.size}個完了`);
                
                // 各ツールのPhase1.5対応確認
                for (const [toolName, tool] of this.tools.entries()) {
                    if (typeof tool.getPhase15Status === 'function') {
                        results.success.push(`${toolName}: Phase1.5対応済み`);
                    } else {
                        results.warning.push(`${toolName}: Phase1.5未対応`);
                    }
                    
                    // 🔧 ツール有効化確認追加
                    if (tool.active) {
                        results.success.push(`${toolName}: 有効化済み`);
                    } else {
                        results.warning.push(`${toolName}: 未有効化`);
                    }
                }
            } else {
                results.error.push('ツール作成: 未完了');
            }
            
            console.log('✅ 統合成功:', results.success);
            console.log('⚠️ 統合警告:', results.warning);
            console.log('❌ 統合エラー:', results.error);
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.ToolManager = ToolManager;
    
    console.log('🖊️ ToolManager Phase1.5完全修正版（ツール有効化処理修正） Loaded');
} else {
    console.log('⚠️ ToolManager already defined - skipping redefinition');
}

console.log('🖊️ tool-manager.js Phase1.5完全修正版（ツール有効化処理修正） loaded - ツール有効化・Manager連携・剛直構造完了');