/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール - Phase1緊急修正版
 * ツール管理システム - tool-manager.js
 * 
 * 🚨 Phase1緊急修正内容（Task 1.2: DRY・SOLID原則準拠）:
 * 1. ✅ 消しゴムツール切り替えが不可能な問題修正
 * 2. ✅ ツールアクティベーション処理のデバッグ強化
 * 3. ✅ イベントリスナー設定の確認・修正
 * 4. ✅ ツール状態とUI状態の同期確保
 * 5. ✅ DRY原則：ツール切り替えロジックの共通化
 * 
 * 修正原則:
 * - SOLID: ツール管理の単一責任徹底
 * - DRY: 状態同期処理の重複排除
 * - 安全性: ツール切り替え時の例外処理強化
 */

console.log('🔧 tool-manager.js Phase1緊急修正版読み込み開始...');

// ==== 🚨 Phase1修正: 安全なツール状態管理システム ====
class SafeToolStateManager {
    /**
     * 単一責任: ツール状態の安全な検証
     */
    static validateToolState(tool, toolName) {
        const issues = [];
        
        try {
            if (!tool) {
                issues.push(`ツール ${toolName} が存在しません`);
                return issues;
            }

            // 必須メソッドの確認
            const requiredMethods = ['activate', 'deactivate', 'onPointerDown', 'onPointerMove', 'onPointerUp'];
            const missingMethods = requiredMethods.filter(method => typeof tool[method] !== 'function');
            
            if (missingMethods.length > 0) {
                issues.push(`ツール ${toolName} に必須メソッドが不足: ${missingMethods.join(', ')}`);
            }

            // プロパティの確認
            if (tool.name && tool.name !== toolName) {
                issues.push(`ツール名不整合: 期待=${toolName}, 実際=${tool.name}`);
            }

        } catch (error) {
            issues.push(`ツール ${toolName} 検証中にエラー: ${error.message}`);
        }
        
        return issues;
    }

    /**
     * 単一責任: ツールアクティベーションの安全実行
     */
    static safeActivateTool(tool, toolName) {
        try {
            console.log(`🔄 ツールアクティベーション実行: ${toolName}`);

            // アクティベーション前の状態確認
            if (tool.isActive) {
                console.warn(`⚠️ ツール ${toolName} は既にアクティブです`);
                return true;
            }

            // アクティベーション実行
            if (typeof tool.activate === 'function') {
                tool.activate();
                
                // アクティベーション後の状態確認
                const postActivationCheck = SafeToolStateManager.validatePostActivation(tool, toolName);
                if (postActivationCheck.length > 0) {
                    console.warn(`⚠️ ツール ${toolName} アクティベーション後の問題:`, postActivationCheck);
                }
                
                console.log(`✅ ツール ${toolName} アクティベーション成功`);
                return true;
            } else {
                console.error(`❌ ツール ${toolName} にactivateメソッドがありません`);
                return false;
            }

        } catch (error) {
            console.error(`❌ ツール ${toolName} アクティベーション失敗:`, error);
            return false;
        }
    }

    /**
     * 単一責任: ツール非アクティベーションの安全実行
     */
    static safeDeactivateTool(tool, toolName) {
        try {
            console.log(`🔄 ツール非アクティベーション実行: ${toolName}`);

            // 非アクティベーション前の状態確認
            if (!tool.isActive) {
                console.log(`ℹ️ ツール ${toolName} は既に非アクティブです`);
                return true;
            }

            // 非アクティベーション実行
            if (typeof tool.deactivate === 'function') {
                tool.deactivate();
                console.log(`✅ ツール ${toolName} 非アクティベーション成功`);
                return true;
            } else {
                console.error(`❌ ツール ${toolName} にdeactivateメソッドがありません`);
                return false;
            }

        } catch (error) {
            console.error(`❌ ツール ${toolName} 非アクティベーション失敗:`, error);
            return false;
        }
    }

    /**
     * 単一責任: アクティベーション後の状態検証
     */
    static validatePostActivation(tool, toolName) {
        const issues = [];

        try {
            // アクティブ状態の確認
            if (!tool.isActive) {
                issues.push(`ツール ${toolName} がアクティベーション後もisActive=falseのまま`);
            }

            // イベントリスナー設定の確認（可能な場合）
            if (tool.app && tool.app.layers && tool.app.layers.drawingLayer) {
                const layer = tool.app.layers.drawingLayer;
                if (!layer.eventMode || layer.eventMode === 'none') {
                    issues.push(`描画レイヤーのeventModeが設定されていない`);
                }
            }

        } catch (error) {
            issues.push(`アクティベーション後検証エラー: ${error.message}`);
        }

        return issues;
    }
}

// ==== 🚨 Phase1修正: UI同期システム ====
class ToolUISync {
    /**
     * 単一責任: ツールボタンUIの状態同期
     */
    static syncToolButtonState(activeToolName) {
        try {
            console.log(`🔄 ツールボタン同期: ${activeToolName}`);

            // 全ツールボタンを非アクティブに
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });

            // アクティブツールボタンをアクティブに
            const activeButton = document.getElementById(`${activeToolName}-tool`);
            if (activeButton) {
                activeButton.classList.add('active');
                activeButton.setAttribute('aria-pressed', 'true');
                console.log(`✅ ツールボタン ${activeToolName} をアクティブに設定`);
                return true;
            } else {
                console.warn(`⚠️ ツールボタン ${activeToolName}-tool が見つかりません`);
                return false;
            }

        } catch (error) {
            console.error('❌ ツールボタン同期エラー:', error);
            return false;
        }
    }

    /**
     * 単一責任: ツール状態表示の更新
     */
    static updateToolStatusDisplay(toolName, toolStats) {
        try {
            // UIManagerがある場合はステータスバーを更新
            if (window.uiManager && window.uiManager.updateStatusBar) {
                window.uiManager.updateStatusBar({ 
                    tool: toolName,
                    toolStats: toolStats
                });
            }

            // ツール情報表示要素の更新
            const toolInfoElement = document.getElementById('current-tool-info');
            if (toolInfoElement) {
                toolInfoElement.textContent = `現在のツール: ${toolName}`;
            }

            return true;

        } catch (error) {
            console.error('❌ ツール状態表示更新エラー:', error);
            return false;
        }
    }

    /**
     * 単一責任: ツール固有UI要素の表示制御
     */
    static toggleToolSpecificUI(toolName) {
        try {
            console.log(`🔄 ツール固有UI切り替え: ${toolName}`);

            // 全ツール固有UI要素を非表示
            const toolUIElements = document.querySelectorAll('[data-tool-ui]');
            toolUIElements.forEach(element => {
                element.style.display = 'none';
            });

            // アクティブツールのUI要素を表示
            const activeToolUI = document.querySelector(`[data-tool-ui="${toolName}"]`);
            if (activeToolUI) {
                activeToolUI.style.display = 'block';
                console.log(`✅ ツール固有UI ${toolName} を表示`);
            }

            return true;

        } catch (error) {
            console.error('❌ ツール固有UI切り替えエラー:', error);
            return false;
        }
    }
}

// ==== メインツール管理クラス（Phase1緊急修正版）====
class ToolManager {
    constructor(app, historyManager = null) {
        this.app = app;
        this.historyManager = historyManager;
        this.tools = new Map();
        this.activeTool = null;
        this.previousTool = null;
        
        // 🚨 Phase1修正: 詳細な管理統計
        this.toolSwitchCount = 0;
        this.lastSwitchTime = 0;
        this.switchErrors = [];
        this.activationAttempts = new Map();
        
        console.log('🔧 ToolManager初期化（Phase1緊急修正版・消しゴム対応）');
    }

    /**
     * 履歴管理システム設定
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        this.tools.forEach(tool => {
            if (tool.setHistoryManager) {
                tool.setHistoryManager(historyManager);
            }
        });
        
        console.log('📚 ToolManager: 履歴管理システム設定完了');
    }

    /**
     * 🚨 Phase1修正: 強化されたツール登録
     */
    registerTool(name, tool) {
        try {
            console.log(`🔧 ツール登録開始: ${name}`);

            // 🚨 Phase1修正: 詳細な検証
            const validationIssues = SafeToolStateManager.validateToolState(tool, name);
            if (validationIssues.length > 0) {
                console.warn(`⚠️ ツール ${name} 登録時の問題:`, validationIssues);
                // 警告は出すが、登録は継続する（後方互換性）
            }

            // ツール名の設定（不足している場合）
            if (!tool.name) {
                tool.name = name;
            }

            // 履歴管理の設定
            if (this.historyManager && tool.setHistoryManager) {
                tool.setHistoryManager(this.historyManager);
            }

            // 🚨 Phase1修正: 初期状態設定
            if (tool.isActive === undefined) {
                tool.isActive = false;
            }

            this.tools.set(name, tool);
            this.activationAttempts.set(name, { count: 0, lastAttempt: 0 });
            
            console.log(`✅ ツール登録完了（Phase1修正版）: ${name}`);
            
            // 🚨 Phase1修正: 消しゴムツール登録の特別処理
            if (name === 'eraser') {
                console.log('🧽 消しゴムツール特別初期化実行');
                this.initializeEraserTool(tool);
            }
            
            return true;
            
        } catch (error) {
            console.error(`❌ ツール登録エラー (${name}):`, error);
            this.switchErrors.push({
                type: 'registration',
                tool: name,
                error: error.message,
                timestamp: Date.now()
            });
            return false;
        }
    }

    /**
     * 🚨 Phase1修正: 消しゴムツール特別初期化
     */
    initializeEraserTool(eraserTool) {
        try {
            // 消しゴムツール固有の初期化処理
            if (eraserTool.setEraseMode) {
                eraserTool.setEraseMode('normal');
            }

            if (eraserTool.optimizePerformance) {
                eraserTool.optimizePerformance('balanced');
            }

            console.log('✅ 消しゴムツール特別初期化完了');

        } catch (error) {
            console.error('❌ 消しゴムツール特別初期化エラー:', error);
        }
    }

    /**
     * 🚨 Phase1修正: 強化されたアクティブツール設定
     */
    setActiveTool(toolName) {
        try {
            console.log(`🔄 ツール切り替え開始: ${toolName}`);

            // 🚨 Phase1修正: 詳細な事前確認
            if (!this.tools.has(toolName)) {
                const availableTools = Array.from(this.tools.keys());
                console.error(`❌ 未知のツール: ${toolName}, 利用可能: [${availableTools.join(', ')}]`);
                return false;
            }

            const beforeTool = this.activeTool ? this.activeTool.name : null;
            const newTool = this.tools.get(toolName);

            // 同一ツールの場合はスキップ
            if (beforeTool === toolName) {
                console.log(`🔄 同一ツール選択: ${toolName} (スキップ)`);
                return true;
            }

            // 🚨 Phase1修正: アクティベーション試行回数記録
            const attempts = this.activationAttempts.get(toolName);
            attempts.count++;
            attempts.lastAttempt = Date.now();

            // 現在のツールを安全に非アクティブ化
            let deactivationSuccess = true;
            if (this.activeTool) {
                deactivationSuccess = SafeToolStateManager.safeDeactivateTool(
                    this.activeTool, 
                    beforeTool
                );
                
                if (deactivationSuccess) {
                    this.previousTool = this.activeTool;
                }
            }

            // 新しいツールを安全にアクティブ化
            const activationSuccess = SafeToolStateManager.safeActivateTool(newTool, toolName);

            if (activationSuccess) {
                this.activeTool = newTool;
                
                // 🚨 Phase1修正: UI同期処理
                ToolUISync.syncToolButtonState(toolName);
                ToolUISync.updateToolStatusDisplay(toolName, newTool.getToolStats?.());
                ToolUISync.toggleToolSpecificUI(toolName);

                // 統計更新
                this.toolSwitchCount++;
                this.lastSwitchTime = Date.now();

                // 履歴記録
                if (this.historyManager && beforeTool !== toolName) {
                    this.historyManager.recordToolChange(beforeTool, toolName);
                }

                console.log(`✅ ツール切り替え完了（Phase1修正版）: ${beforeTool} → ${toolName}`);
                
                // 🚨 Phase1修正: 消しゴムツール切り替え成功通知
                if (toolName === 'eraser') {
                    console.log('🧽 消しゴムツール切り替え成功 - イベントリスナー確認中...');
                    this.validateEraserToolActivation(newTool);
                }
                
                return true;
                
            } else {
                // アクティベーション失敗時の復旧処理
                console.error(`❌ ツール ${toolName} アクティベーション失敗`);
                
                this.switchErrors.push({
                    type: 'activation',
                    tool: toolName,
                    error: 'アクティベーション失敗',
                    timestamp: Date.now()
                });

                // 前のツールに戻す
                if (this.previousTool && deactivationSuccess) {
                    console.log(`🔄 前のツール ${beforeTool} に復旧試行`);
                    SafeToolStateManager.safeActivateTool(this.previousTool, beforeTool);
                    this.activeTool = this.previousTool;
                }
                
                return false;
            }
            
        } catch (error) {
            console.error(`❌ ツール切り替えエラー (${toolName}):`, error);
            
            this.switchErrors.push({
                type: 'exception',
                tool: toolName,
                error: error.message,
                timestamp: Date.now()
            });
            
            return false;
        }
    }

    /**
     * 🚨 Phase1修正: 消しゴムツールアクティベーション検証
     */
    validateEraserToolActivation(eraserTool) {
        try {
            console.log('🔍 消しゴムツールアクティベーション検証開始');

            const validationResults = {
                isActive: eraserTool.isActive === true,
                hasApp: !!eraserTool.app,
                hasLayers: !!(eraserTool.app && eraserTool.app.layers && eraserTool.app.layers.drawingLayer),
                eventModeSet: false,
                hitAreaSet: false
            };

            if (validationResults.hasLayers) {
                const layer = eraserTool.app.layers.drawingLayer;
                validationResults.eventModeSet = layer.eventMode === 'static';
                validationResults.hitAreaSet = !!layer.hitArea;
            }

            console.log('🔍 消しゴムツール検証結果:', validationResults);

            // 問題がある場合は修正を試行
            if (!validationResults.eventModeSet && validationResults.hasLayers) {
                console.log('🔧 drawingLayerのeventMode設定を修正');
                eraserTool.app.layers.drawingLayer.eventMode = 'static';
            }

            const allValid = Object.values(validationResults).every(v => v === true);
            console.log(allValid ? '✅ 消しゴムツールアクティベーション検証成功' : '⚠️ 消しゴムツールアクティベーション検証で問題検出');

            return allValid;

        } catch (error) {
            console.error('❌ 消しゴムツールアクティベーション検証エラー:', error);
            return false;
        }
    }

    /**
     * アクティブツール取得
     */
    getActiveTool() {
        return this.activeTool;
    }

    /**
     * 前のツール取得
     */
    getPreviousTool() {
        return this.previousTool;
    }

    /**
     * 前のツールに切り替え
     */
    switchToPreviousTool() {
        if (this.previousTool) {
            return this.setActiveTool(this.previousTool.name);
        }
        
        console.warn('前のツールが存在しません');
        return false;
    }

    /**
     * 利用可能ツール一覧取得
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }

    /**
     * ツール存在確認
     */
    hasTool(toolName) {
        return this.tools.has(toolName);
    }

    /**
     * ツール取得
     */
    getTool(toolName) {
        return this.tools.get(toolName) || null;
    }

    /**
     * 全ツール取得（デバッグ用）
     */
    getAllTools() {
        return new Map(this.tools);
    }

    /**
     * 🚨 Phase1修正: 拡張されたツール統計取得
     */
    getToolStats() {
        return {
            totalTools: this.tools.size,
            activeTool: this.activeTool ? this.activeTool.name : null,
            previousTool: this.previousTool ? this.previousTool.name : null,
            switchCount: this.toolSwitchCount,
            lastSwitchTime: this.lastSwitchTime,
            availableTools: this.getAvailableTools(),
            switchErrorCount: this.switchErrors.length,
            activationAttempts: Object.fromEntries(this.activationAttempts)
        };
    }

    /**
     * 🚨 Phase1修正: 詳細なツール状態検証
     */
    validateToolStates() {
        const issues = [];
        
        try {
            // アクティブツール状態確認
            if (this.activeTool) {
                const activeToolIssues = SafeToolStateManager.validateToolState(
                    this.activeTool, 
                    this.activeTool.name
                );
                issues.push(...activeToolIssues);

                if (!this.activeTool.isActive) {
                    issues.push(`アクティブツール ${this.activeTool.name} が非アクティブ状態`);
                }
            }

            // 各ツールの状態確認
            this.tools.forEach((tool, name) => {
                try {
                    const toolIssues = SafeToolStateManager.validateToolState(tool, name);
                    issues.push(...toolIssues);
                    
                    // アクティブ状態の整合性確認
                    if (tool !== this.activeTool && tool.isActive) {
                        issues.push(`非アクティブツール ${name} がアクティブ状態`);
                    }

                    // 🚨 Phase1修正: 消しゴムツール固有の検証
                    if (name === 'eraser') {
                        const eraserIssues = this.validateEraserToolState(tool);
                        issues.push(...eraserIssues);
                    }
                    
                } catch (error) {
                    issues.push(`ツール ${name} 検証エラー: ${error.message}`);
                }
            });

            // UI同期状態の確認
            const uiIssues = this.validateUISync();
            issues.push(...uiIssues);
            
        } catch (error) {
            issues.push(`ToolManager検証エラー: ${error.message}`);
        }
        
        return issues;
    }

    /**
     * 🚨 Phase1修正: 消しゴムツール固有の状態検証
     */
    validateEraserToolState(eraserTool) {
        const issues = [];

        try {
            if (!eraserTool) return issues;

            // 消しゴムツール固有のプロパティ確認
            if (eraserTool.eraserSize === undefined || eraserTool.eraserSize <= 0) {
                issues.push('消しゴムツールのeraserSizeが無効');
            }

            if (eraserTool.eraseMode && !['normal', 'precise', 'broad'].includes(eraserTool.eraseMode)) {
                issues.push(`消しゴムツールの無効なeraseMode: ${eraserTool.eraseMode}`);
            }

            // 必須メソッドの確認
            const eraserMethods = ['performEraseOperation', 'setEraseMode', 'getEffectiveEraseRadius'];
            eraserMethods.forEach(method => {
                if (typeof eraserTool[method] !== 'function') {
                    issues.push(`消しゴムツールの ${method} メソッドが未実装`);
                }
            });

        } catch (error) {
            issues.push(`消しゴムツール検証エラー: ${error.message}`);
        }

        return issues;
    }

    /**
     * 🚨 Phase1修正: UI同期状態の検証
     */
    validateUISync() {
        const issues = [];

        try {
            if (!this.activeTool) return issues;

            const activeToolName = this.activeTool.name;
            
            // アクティブツールボタンの確認
            const activeButton = document.getElementById(`${activeToolName}-tool`);
            if (activeButton) {
                if (!activeButton.classList.contains('active')) {
                    issues.push(`アクティブツール ${activeToolName} のボタンがactiveクラス未設定`);
                }
                
                if (activeButton.getAttribute('aria-pressed') !== 'true') {
                    issues.push(`アクティブツール ${activeToolName} のボタンがaria-pressed未設定`);
                }
            } else {
                issues.push(`アクティブツール ${activeToolName} のボタンが見つからない`);
            }

            // 他のツールボタンが非アクティブかどうか確認
            document.querySelectorAll('.tool-button').forEach(btn => {
                const btnId = btn.id;
                const btnToolName = btnId.replace('-tool', '');
                
                if (btnToolName !== activeToolName && btn.classList.contains('active')) {
                    issues.push(`非アクティブツール ${btnToolName} のボタンがactiveクラス設定済み`);
                }
            });

        } catch (error) {
            issues.push(`UI同期検証エラー: ${error.message}`);
        }

        return issues;
    }

    /**
     * 🚨 Phase1修正: エラー履歴の取得
     */
    getSwitchErrors() {
        return [...this.switchErrors];
    }

    /**
     * 🚨 Phase1修正: エラー履歴のクリア
     */
    clearSwitchErrors() {
        this.switchErrors = [];
        console.log('✅ ツール切り替えエラー履歴をクリアしました');
    }

    /**
     * 🚨 Phase1修正: 強制的なツール状態修復
     */
    forceRepairToolStates() {
        try {
            console.log('🔧 ツール状態強制修復開始');

            let repairedCount = 0;

            // アクティブツールの修復
            if (this.activeTool) {
                const activeToolName = this.activeTool.name;
                
                // isActiveフラグの修復
                if (!this.activeTool.isActive) {
                    console.log(`🔧 アクティブツール ${activeToolName} のisActiveフラグを修復`);
                    this.activeTool.isActive = true;
                    repairedCount++;
                }

                // UI同期の修復
                ToolUISync.syncToolButtonState(activeToolName);
                ToolUISync.updateToolStatusDisplay(activeToolName, this.activeTool.getToolStats?.());
                repairedCount++;
            }

            // 非アクティブツールの修復
            this.tools.forEach((tool, name) => {
                if (tool !== this.activeTool && tool.isActive) {
                    console.log(`🔧 非アクティブツール ${name} のisActiveフラグを修復`);
                    tool.isActive = false;
                    repairedCount++;
                }
            });

            // 消しゴムツールの特別修復
            const eraserTool = this.tools.get('eraser');
            if (eraserTool && eraserTool === this.activeTool) {
                console.log('🧽 消しゴムツール特別修復実行');
                this.validateEraserToolActivation(eraserTool);
                repairedCount++;
            }

            console.log(`✅ ツール状態強制修復完了: ${repairedCount}項目修復`);
            return repairedCount;

        } catch (error) {
            console.error('❌ ツール状態強制修復エラー:', error);
            return 0;
        }
    }

    /**
     * 🚨 Phase1修正: 拡張デバッグ機能
     */
    debugToolManager() {
        console.group('🔍 ToolManager Phase1デバッグ情報（消しゴム対応版）');
        
        console.log('基本情報:', this.getToolStats());
        
        // 各ツールの詳細状態
        console.log('ツール詳細状態:');
        this.tools.forEach((tool, name) => {
            console.log(`  - ${name}:`, {
                isActive: tool.isActive || false,
                hasHistoryManager: !!tool.historyManager,
                type: tool.constructor.name,
                hasApp: !!tool.app,
                hasValidateState: typeof tool.validateState === 'function'
            });
            
            // 🚨 Phase1修正: 消しゴムツール特別デバッグ
            if (name === 'eraser' && tool.getToolStats) {
                console.log(`    消しゴム統計:`, tool.getToolStats());
            }
        });
        
        // 状態検証
        const issues = this.validateToolStates();
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
            
            // 自動修復の提案
            console.log('🔧 自動修復を実行する場合: toolManager.forceRepairToolStates()');
        } else {
            console.log('✅ ツール状態正常');
        }

        // エラー履歴
        if (this.switchErrors.length > 0) {
            console.warn('❌ ツール切り替えエラー履歴:', this.switchErrors);
        }

        // UI同期状態
        const uiIssues = this.validateUISync();
        if (uiIssues.length > 0) {
            console.warn('⚠️ UI同期問題:', uiIssues);
        } else {
            console.log('✅ UI同期正常');
        }
        
        console.groupEnd();
    }

    /**
     * 🚨 Phase1修正: 消しゴムツール専用デバッグ
     */
    debugEraserTool() {
        const eraserTool = this.tools.get('eraser');
        if (!eraserTool) {
            console.warn('🧽 消しゴムツールが登録されていません');
            return;
        }

        console.group('🧽 消しゴムツール専用デバッグ');
        
        console.log('基本状態:', {
            isRegistered: true,
            isActive: eraserTool.isActive,
            isCurrentActive: eraserTool === this.activeTool,
            name: eraserTool.name
        });

        if (eraserTool.getToolStats) {
            console.log('消しゴム統計:', eraserTool.getToolStats());
        }

        if (eraserTool.validateState) {
            const eraserIssues = eraserTool.validateState();
            if (eraserIssues.length > 0) {
                console.warn('⚠️ 消しゴムツール内部問題:', eraserIssues);
            } else {
                console.log('✅ 消しゴムツール内部状態正常');
            }
        }

        // アクティベーション検証（アクティブな場合のみ）
        if (eraserTool === this.activeTool) {
            this.validateEraserToolActivation(eraserTool);
        }

        console.groupEnd();
    }

    /**
     * クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 ToolManager クリーンアップ開始（Phase1修正版）');
            
            // アクティブツールを安全に非アクティブ化
            if (this.activeTool) {
                SafeToolStateManager.safeDeactivateTool(this.activeTool, this.activeTool.name);
            }
            
            // 各ツールのクリーンアップ
            this.tools.forEach((tool, name) => {
                try {
                    if (tool.destroy) {
                        tool.destroy();
                    }
                } catch (error) {
                    console.error(`ツールクリーンアップエラー (${name}):`, error);
                }
            });
            
            // 状態のクリア
            this.tools.clear();
            this.activeTool = null;
            this.previousTool = null;
            this.historyManager = null;
            this.switchErrors = [];
            this.activationAttempts.clear();
            
            console.log('✅ ToolManager クリーンアップ完了（Phase1修正版）');
            
        } catch (error) {
            console.error('ToolManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（Phase1修正版）====
if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
    window.SafeToolStateManager = SafeToolStateManager;
    window.ToolUISync = ToolUISync;
    
    // 🚨 Phase1修正: 拡張デバッグ関数
    window.debugToolManager = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            window.toolsSystem.toolManager.debugToolManager();
        } else {
            console.warn('ToolManager が利用できません');
        }
    };

    // 🚨 Phase1修正: 消しゴムツール専用デバッグ関数
    window.debugEraserTool = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            window.toolsSystem.toolManager.debugEraserTool();
        } else {
            console.warn('ToolManager が利用できません');
        }
    };
    
    // ツール状態検証関数
    window.validateAllToolStates = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            const issues = window.toolsSystem.toolManager.validateToolStates();
            
            if (issues.length === 0) {
                console.log('✅ 全ツール状態正常');
                return true;
            } else {
                console.warn('⚠️ ツール状態に問題があります:', issues);
                return false;
            }
        } else {
            console.warn('ToolManager が利用できません');
            return false;
        }
    };

    // 🚨 Phase1修正: ツール状態強制修復関数
    window.forceRepairAllTools = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            return window.toolsSystem.toolManager.forceRepairToolStates();
        } else {
            console.warn('ToolManager が利用できません');
            return 0;
        }
    };

    // 🚨 Phase1修正: 消しゴムツール切り替えテスト関数
    window.testEraserSwitch = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            console.log('🧽 消しゴムツール切り替えテスト開始');
            const success = window.toolsSystem.toolManager.setActiveTool('eraser');
            
            if (success) {
                console.log('✅ 消しゴムツール切り替えテスト成功');
                window.toolsSystem.toolManager.debugEraserTool();
            } else {
                console.error('❌ 消しゴムツール切り替えテスト失敗');
            }
            
            return success;
        } else {
            console.warn('ToolManager が利用できません');
            return false;
        }
    };
    
    console.log('✅ tool-manager.js Phase1緊急修正版 読み込み完了');
    console.log('🚨 Phase1修正内容（Task 1.2: DRY・SOLID原則準拠）:');
    console.log('  ✅ 消しゴムツール切り替え不可問題修正');
    console.log('  ✅ ツールアクティベーション処理の安全性強化');
    console.log('  ✅ イベントリスナー設定の確認・修正機能追加');
    console.log('  ✅ ツール状態とUI状態の同期確保');
    console.log('  ✅ DRY原則：ツール切り替えロジックの共通化');
    console.log('📦 新規エクスポートクラス:');
    console.log('  - SafeToolStateManager: 安全なツール状態管理');
    console.log('  - ToolUISync: ツール-UI同期システム');
    console.log('🐛 Phase1拡張デバッグ関数:');
    console.log('  - window.debugToolManager() - 詳細ツール管理状態表示');
    console.log('  - window.debugEraserTool() - 消しゴムツール専用デバッグ');
    console.log('  - window.validateAllToolStates() - 全ツール状態検証');
    console.log('  - window.forceRepairAllTools() - ツール状態強制修復');
    console.log('  - window.testEraserSwitch() - 消しゴムツール切り替えテスト');
}

// ESモジュール対応
if (typeof exports !== 'undefined') {
    exports.ToolManager = ToolManager;
    exports.SafeToolStateManager = SafeToolStateManager;
    exports.ToolUISync = ToolUISync;
}

console.log('🏆 tool-manager.js Phase1緊急修正版 初期化完了（消しゴム対応）');