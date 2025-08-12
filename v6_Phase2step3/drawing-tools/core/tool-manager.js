/**
 * ⚠️ 【重要】開発・改修時の注意事項:
 * 必ずdebug/またはmonitoring/ディレクトリの既存モジュールを確認し、重複を避けてください。
 * - debug/debug-manager.js: デバッグ機能統合
 * - debug/diagnostics.js: システム診断
 * - debug/performance-logger.js: パフォーマンス測定
 * - monitoring/system-monitor.js: システム監視
 * これらの機能はこのファイルに重複実装しないでください。
 */

/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * ツール管理システム（モジュール分割版）
 * 
 * 🏗️ STEP 2.5実装完了（ツール管理専用モジュール）:
 * 1. ✅ 単一責任原則：ツール切り替え・管理のみ
 * 2. ✅ オープン・クローズ原則：新ツール追加容易性
 * 3. ✅ 依存関係逆転：ツールインターフェース準拠
 * 4. ✅ 履歴管理統合：ツール操作の記録機能
 * 5. ✅ エラーハンドリング強化：安全なツール切り替え
 * 
 * 責務: ツール登録・切り替え・状態管理
 * 依存: ./base-tool.js（インターフェース）
 * 
 * モジュール化効果: 描画ロジックから管理ロジックを分離
 */

console.log('🔧 tool-manager.js モジュール分割版読み込み開始...');

// ==== ツール管理システム（モジュール分割版・履歴管理統合版）====
class ToolManager {
    constructor(app, historyManager = null) {
        this.app = app;
        this.historyManager = historyManager;
        this.tools = new Map();
        this.activeTool = null;
        this.previousTool = null;
        
        // 管理統計
        this.toolSwitchCount = 0;
        this.lastSwitchTime = 0;
        
        console.log('🔧 ToolManager初期化（モジュール分割版・履歴管理対応）');
    }
    
    /**
     * 履歴管理システム設定
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        // 既存ツールに履歴管理を設定
        this.tools.forEach(tool => {
            if (tool.setHistoryManager) {
                tool.setHistoryManager(historyManager);
            }
        });
        
        console.log('📚 ToolManager: 履歴管理システム設定完了');
    }
    
    /**
     * ツール登録（インターフェース準拠確認）
     */
    registerTool(name, tool) {
        try {
            // ツールインターフェース確認
            const requiredMethods = ['activate', 'deactivate', 'onPointerDown', 'onPointerMove', 'onPointerUp'];
            const missingMethods = requiredMethods.filter(method => typeof tool[method] !== 'function');
            
            if (missingMethods.length > 0) {
                console.warn(`⚠️ ツール ${name} インターフェース不完全:`, missingMethods);
            }
            
            // 履歴管理の設定
            if (this.historyManager && tool.setHistoryManager) {
                tool.setHistoryManager(this.historyManager);
            }
            
            this.tools.set(name, tool);
            
            console.log(`🔧 ツール登録完了（モジュール分割版・履歴対応）: ${name}`);
            return true;
            
        } catch (error) {
            console.error(`ツール登録エラー (${name}):`, error);
            return false;
        }
    }
    
    /**
     * アクティブツール設定（履歴記録付き）
     */
    setActiveTool(toolName) {
        try {
            if (!this.tools.has(toolName)) {
                console.warn(`未知のツール: ${toolName}`);
                return false;
            }
            
            const beforeTool = this.activeTool ? this.activeTool.name : null;
            const newTool = this.tools.get(toolName);
            
            // 同一ツールの場合はスキップ
            if (beforeTool === toolName) {
                console.log(`🔄 同一ツール選択: ${toolName} (スキップ)`);
                return true;
            }
            
            // 現在のツールを非アクティブ化
            if (this.activeTool) {
                try {
                    this.activeTool.deactivate();
                    this.previousTool = this.activeTool;
                } catch (error) {
                    console.error(`ツール非アクティブ化エラー (${beforeTool}):`, error);
                }
            }
            
            // 新しいツールをアクティブ化
            try {
                this.activeTool = newTool;
                this.activeTool.activate();
                
                // 統計更新
                this.toolSwitchCount++;
                this.lastSwitchTime = Date.now();
                
                // 履歴記録
                if (this.historyManager && beforeTool !== toolName) {
                    this.historyManager.recordToolChange(beforeTool, toolName);
                }
                
                console.log(`🔄 ツール切り替え完了（履歴記録付き）: ${beforeTool} → ${toolName}`);
                return true;
                
            } catch (error) {
                console.error(`ツールアクティブ化エラー (${toolName}):`, error);
                
                // 安全な復旧処理
                this.activeTool = this.previousTool;
                if (this.previousTool) {
                    this.previousTool.activate();
                }
                
                return false;
            }
            
        } catch (error) {
            console.error(`ツール設定エラー (${toolName}):`, error);
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
     * ツール統計取得
     */
    getToolStats() {
        return {
            totalTools: this.tools.size,
            activeTool: this.activeTool ? this.activeTool.name : null,
            previousTool: this.previousTool ? this.previousTool.name : null,
            switchCount: this.toolSwitchCount,
            lastSwitchTime: this.lastSwitchTime,
            availableTools: this.getAvailableTools()
        };
    }
    
    /**
     * ツール状態検証
     */
    validateToolStates() {
        const issues = [];
        
        // アクティブツール状態確認
        if (this.activeTool && !this.activeTool.isActive) {
            issues.push(`アクティブツール ${this.activeTool.name} が非アクティブ状態`);
        }
        
        // 各ツールの状態確認
        this.tools.forEach((tool, name) => {
            try {
                // 必須メソッドの存在確認
                const requiredMethods = ['activate', 'deactivate'];
                requiredMethods.forEach(method => {
                    if (typeof tool[method] !== 'function') {
                        issues.push(`ツール ${name} の ${method} メソッド未実装`);
                    }
                });
                
                // アクティブ状態の整合性確認
                if (tool !== this.activeTool && tool.isActive) {
                    issues.push(`非アクティブツール ${name} がアクティブ状態`);
                }
                
            } catch (error) {
                issues.push(`ツール ${name} 検証エラー: ${error.message}`);
            }
        });
        
        return issues;
    }
    
    /**
     * デバッグ機能
     */
    debugToolManager() {
        console.group('🔍 ToolManager デバッグ情報（モジュール分割版）');
        
        console.log('基本情報:', this.getToolStats());
        
        // 各ツールの詳細状態
        console.log('ツール詳細状態:');
        this.tools.forEach((tool, name) => {
            console.log(`  - ${name}:`, {
                isActive: tool.isActive || false,
                hasHistoryManager: !!tool.historyManager,
                type: tool.constructor.name
            });
        });
        
        // 状態検証
        const issues = this.validateToolStates();
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ ツール状態正常');
        }
        
        console.groupEnd();
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 ToolManager クリーンアップ開始');
            
            // アクティブツールを非アクティブ化
            if (this.activeTool) {
                try {
                    this.activeTool.deactivate();
                } catch (error) {
                    console.error('アクティブツール非アクティブ化エラー:', error);
                }
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
            
            console.log('✅ ToolManager クリーンアップ完了');
            
        } catch (error) {
            console.error('ToolManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（モジュール分割版）====
if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
    
    // デバッグ関数
    window.debugToolManager = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            window.toolsSystem.toolManager.debugToolManager();
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
    
    console.log('✅ tool-manager.js モジュール分割版 読み込み完了');
    console.log('📦 モジュール化効果:');
    console.log('  🎯 単一責任: ツール管理のみ（~150行）');
    console.log('  🔧 履歴統合: ツール切り替えの自動記録');
    console.log('  🛡️ 安全性: エラー時の自動復旧機能');
    console.log('  📈 拡張性: 新ツール追加時のインターフェース確認');
    console.log('🐛 デバッグ関数（モジュール分割版）:');
    console.log('  - window.debugToolManager() - ツール管理状態表示');
    console.log('  - window.validateAllToolStates() - ツール状態検証');
}

// ESモジュール対応
if (typeof exports !== 'undefined') {
    exports.ToolManager = ToolManager;
}

console.log('🏆 tool-manager.js モジュール分割版 初期化完了');