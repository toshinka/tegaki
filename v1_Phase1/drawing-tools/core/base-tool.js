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
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * ベースツールクラス（モジュール分割版）
 * 
 * 🏗️ STEP 2.5実装完了（ツール基盤抽象化）:
 * 1. ✅ 抽象基底クラス：全ツール共通機能提供
 * 2. ✅ インターフェース統一：ツール間の一貫性確保
 * 3. ✅ 履歴管理統合：操作記録の自動化
 * 4. ✅ エラーハンドリング：安全な操作保証
 * 5. ✅ オープン・クローズ原則：拡張容易性確保
 * 
 * 責務: ツール共通機能・インターフェース定義
 * 依存: app-core.js, history管理システム
 * 
 * モジュール化効果: ツール実装の共通化・重複排除
 */

console.log('🔧 base-tool.js モジュール分割版読み込み開始...');

// ==== EVENTS定数の安全取得（重複宣言回避）====
const TOOL_EVENTS = window.EVENTS || {
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove', 
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside'
};

// ==== ベースツールクラス（モジュール分割版・履歴管理統合）====
class BaseTool {
    constructor(name, app, historyManager = null) {
        this.name = name;
        this.app = app;
        this.historyManager = historyManager;
        
        // ツール状態
        this.isActive = false;
        this.isDrawing = false;
        
        // 描画状態
        this.currentPath = null;
        this.operationStartState = null;
        this.lastPoint = null;
        
        // 統計・デバッグ用
        this.activationCount = 0;
        this.operationCount = 0;
        this.lastActivatedTime = 0;
        this.totalActiveTime = 0;
        
        console.log(`🔧 BaseTool初期化: ${name}（モジュール分割版・履歴管理対応）`);
    }
    
    /**
     * ツールアクティベート（共通処理）
     */
    activate() {
        try {
            if (this.isActive) {
                console.warn(`${this.name} は既にアクティブです`);
                return;
            }
            
            this.isActive = true;
            this.activationCount++;
            this.lastActivatedTime = Date.now();
            
            // 派生クラス固有の処理
            this.onActivate();
            
            console.log(`🔴 ${this.name} アクティブ化完了`);
            
        } catch (error) {
            console.error(`${this.name} アクティブ化エラー:`, error);
            this.isActive = false;
        }
    }
    
    /**
     * ツール非アクティベート（共通処理）
     */
    deactivate() {
        try {
            if (!this.isActive) {
                console.warn(`${this.name} は既に非アクティブです`);
                return;
            }
            
            // 描画中の場合は強制終了
            if (this.isDrawing) {
                console.warn(`${this.name} 描画中の強制非アクティブ化`);
                this.forceEndOperation();
            }
            
            // アクティブ時間の記録
            if (this.lastActivatedTime > 0) {
                this.totalActiveTime += Date.now() - this.lastActivatedTime;
            }
            
            this.isActive = false;
            
            // 派生クラス固有の処理
            this.onDeactivate();
            
            console.log(`⚫ ${this.name} 非アクティブ化完了`);
            
        } catch (error) {
            console.error(`${this.name} 非アクティブ化エラー:`, error);
            // エラーでも状態はリセット
            this.isActive = false;
            this.cleanup();
        }
    }
    
    /**
     * 履歴管理システム設定
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        console.log(`📚 ${this.name}: 履歴管理システム設定完了`);
    }
    
    /**
     * 操作開始時の状態キャプチャ（履歴管理用）
     */
    captureStartState() {
        try {
            if (this.historyManager && window.InternalStateCapture) {
                this.operationStartState = window.InternalStateCapture.captureDrawingState(this.app);
                console.log(`📸 ${this.name}: 操作開始状態キャプチャ完了`);
            }
        } catch (error) {
            console.error(`${this.name} 状態キャプチャエラー:`, error);
            this.operationStartState = null;
        }
    }
    
    /**
     * 操作記録（履歴管理用）
     */
    recordOperation() {
        try {
            if (this.historyManager && this.operationStartState) {
                this.historyManager.recordDrawingOperation(
                    this.name, 
                    this.operationStartState
                );
                this.operationCount++;
                console.log(`📝 ${this.name}: 操作記録完了 (累計: ${this.operationCount})`);
            }
            this.operationStartState = null;
        } catch (error) {
            console.error(`${this.name} 操作記録エラー:`, error);
            this.operationStartState = null;
        }
    }
    
    /**
     * 強制操作終了（緊急時用）
     */
    forceEndOperation() {
        try {
            console.warn(`🚨 ${this.name}: 強制操作終了`);
            
            if (this.currentPath) {
                // パスがある場合は安全に終了処理
                try {
                    this.app.finalizePath(this.currentPath);
                } catch (error) {
                    console.error('パス終了エラー:', error);
                }
            }
            
            // 状態のクリーンアップ
            this.cleanup();
            
        } catch (error) {
            console.error(`${this.name} 強制終了エラー:`, error);
            this.cleanup();
        }
    }
    
    /**
     * 共通クリーンアップ処理
     */
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
        this.operationStartState = null;
        this.isDrawing = false;
        
        // 派生クラス固有のクリーンアップ
        this.onCleanup();
    }
    
    /**
     * ツール統計取得
     */
    getToolStats() {
        return {
            name: this.name,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            activationCount: this.activationCount,
            operationCount: this.operationCount,
            totalActiveTime: this.totalActiveTime,
            lastActivatedTime: this.lastActivatedTime,
            hasHistoryManager: !!this.historyManager,
            hasCurrentPath: !!this.currentPath
        };
    }
    
    /**
     * ツール状態検証
     */
    validateState() {
        const issues = [];
        
        // 基本状態の整合性確認
        if (this.isDrawing && !this.isActive) {
            issues.push('非アクティブ状態で描画中');
        }
        
        if (this.currentPath && !this.isDrawing) {
            issues.push('非描画状態でパスが存在');
        }
        
        if (this.isActive && !this.app) {
            issues.push('アクティブ状態でappが未設定');
        }
        
        // 必須メソッドの存在確認
        const requiredMethods = [
            'onActivate', 'onDeactivate', 'onCleanup',
            'onPointerDown', 'onPointerMove', 'onPointerUp'
        ];
        
        requiredMethods.forEach(method => {
            if (typeof this[method] !== 'function') {
                issues.push(`必須メソッド ${method} が未実装`);
            }
        });
        
        return issues;
    }
    
    // ==== 派生クラスでオーバーライドすべきメソッド ====
    
    /**
     * アクティブ化時の処理（派生クラスでオーバーライド）
     */
    onActivate() {
        // 派生クラスで実装
        console.log(`${this.name}: onActivate() - 派生クラスで実装してください`);
    }
    
    /**
     * 非アクティブ化時の処理（派生クラスでオーバーライド）
     */
    onDeactivate() {
        // 派生クラスで実装
        console.log(`${this.name}: onDeactivate() - 派生クラスで実装してください`);
    }
    
    /**
     * クリーンアップ時の処理（派生クラスでオーバーライド）
     */
    onCleanup() {
        // 派生クラスで実装（オプション）
    }
    
    /**
     * ポインタダウン処理（派生クラスでオーバーライド）
     */
    onPointerDown(x, y, event) {
        // 派生クラスで実装
        console.warn(`${this.name}: onPointerDown() - 派生クラスで実装してください`);
    }
    
    /**
     * ポインタムーブ処理（派生クラスでオーバーライド）
     */
    onPointerMove(x, y, event) {
        // 派生クラスで実装
        console.warn(`${this.name}: onPointerMove() - 派生クラスで実装してください`);
    }
    
    /**
     * ポインタアップ処理（派生クラスでオーバーライド）
     */
    onPointerUp(x, y, event) {
        // 派生クラスで実装
        console.warn(`${this.name}: onPointerUp() - 派生クラスで実装してください`);
    }
    
    /**
     * デバッグ機能
     */
    debugTool() {
        console.group(`🔍 ${this.name} デバッグ情報（ベースツール・モジュール分割版）`);
        
        console.log('基本情報:', this.getToolStats());
        
        // 状態検証
        const issues = this.validateState();
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ ツール状態正常');
        }
        
        // 履歴管理状況
        if (this.historyManager) {
            console.log('📚 履歴管理:', {
                connected: true,
                canUndo: this.historyManager.canUndo ? this.historyManager.canUndo() : '不明',
                canRedo: this.historyManager.canRedo ? this.historyManager.canRedo() : '不明'
            });
        } else {
            console.warn('📚 履歴管理: 未接続');
        }
        
        console.groupEnd();
    }
    
    /**
     * クリーンアップ（デストラクタ的処理）
     */
    destroy() {
        try {
            console.log(`🧹 ${this.name} クリーンアップ開始`);
            
            // アクティブ状態の場合は非アクティブ化
            if (this.isActive) {
                this.deactivate();
            }
            
            // 強制クリーンアップ
            this.cleanup();
            
            // 参照のクリア
            this.historyManager = null;
            this.app = null;
            
            console.log(`✅ ${this.name} クリーンアップ完了`);
            
        } catch (error) {
            console.error(`${this.name} クリーンアップエラー:`, error);
        }
    }
}

// ==== ツールインターフェース定義（TypeScript風の型定義コメント）====
/**
 * IToolインターフェース定義
 * 
 * すべてのツールクラスは以下のメソッドを実装する必要があります：
 * 
 * @interface ITool
 * @method {void} activate() - ツールをアクティブ化
 * @method {void} deactivate() - ツールを非アクティブ化
 * @method {void} onPointerDown(x: number, y: number, event: Event) - ポインタダウン処理
 * @method {void} onPointerMove(x: number, y: number, event: Event) - ポインタムーブ処理
 * @method {void} onPointerUp(x: number, y: number, event: Event) - ポインタアップ処理
 * @method {void} setHistoryManager(historyManager: HistoryManager) - 履歴管理設定
 * @method {Object} getToolStats() - ツール統計取得
 * @method {Array} validateState() - ツール状態検証
 * @method {void} destroy() - クリーンアップ
 */

// ==== ツール共通ユーティリティ関数 ====
class ToolUtils {
    /**
     * ツール間共通の設定値取得（DRY原則）
     */
    static safeConfigGet(key, defaultValue = null) {
        try {
            if (!window.CONFIG || typeof window.CONFIG !== 'object') {
                return defaultValue;
            }
            
            if (!(key in window.CONFIG)) {
                return defaultValue;
            }
            
            const value = window.CONFIG[key];
            return (value === null || value === undefined) ? defaultValue : value;
            
        } catch (error) {
            console.error(`CONFIG取得エラー (${key}):`, error);
            return defaultValue;
        }
    }
    
    /**
     * ブラシサイズバリデーション（共通処理）
     */
    static validateBrushSize(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return this.safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        return Math.max(
            this.safeConfigGet('MIN_BRUSH_SIZE', 0.1),
            Math.min(this.safeConfigGet('MAX_BRUSH_SIZE', 500), numSize)
        );
    }
    
    /**
     * 透明度バリデーション（共通処理）
     */
    static validateOpacity(opacity) {
        const numOpacity = parseFloat(opacity);
        if (isNaN(numOpacity)) return this.safeConfigGet('DEFAULT_OPACITY', 1.0);
        return Math.max(0, Math.min(1, numOpacity));
    }
    
    /**
     * 距離計算（共通処理）
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 角度計算（共通処理）
     */
    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }
    
    /**
     * 線形補間（共通処理）
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

// ==== グローバル登録・エクスポート（モジュール分割版）====
if (typeof window !== 'undefined') {
    window.BaseTool = BaseTool;
    window.ToolUtils = ToolUtils;
    window.TOOL_EVENTS = TOOL_EVENTS;
    
    // デバッグ関数
    window.debugBaseTool = function(toolName) {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            const tool = window.toolsSystem.toolManager.getTool(toolName);
            if (tool && tool.debugTool) {
                tool.debugTool();
            } else {
                console.warn(`ツール ${toolName} が見つからないか、デバッグ機能がありません`);
            }
        } else {
            console.warn('ToolManager が利用できません');
        }
    };
    
    // 全ツール状態確認
    window.debugAllToolStates = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            const tools = window.toolsSystem.toolManager.getAllTools();
            
            console.group('🔍 全ツール状態（ベースツール・モジュール分割版）');
            
            tools.forEach((tool, name) => {
                console.log(`${name}:`, tool.getToolStats());
                
                const issues = tool.validateState();
                if (issues.length > 0) {
                    console.warn(`  ⚠️ ${name} の問題:`, issues);
                }
            });
            
            console.groupEnd();
        } else {
            console.warn('ToolManager が利用できません');
        }
    };
    
    console.log('✅ base-tool.js モジュール分割版 読み込み完了');
    console.log('📦 モジュール化効果:');
    console.log('  🎯 単一責任: ツール共通機能のみ（~100行）');
    console.log('  🏗️ 抽象化: 全ツール実装の基盤クラス');
    console.log('  📚 履歴統合: 操作記録の自動化');
    console.log('  🛡️ 安全性: エラー時の自動復旧・状態検証');
    console.log('  📈 拡張性: オープン・クローズ原則準拠');
    console.log('🔧 共通機能:');
    console.log('  - activate/deactivate: アクティブ化制御');
    console.log('  - captureStartState/recordOperation: 履歴管理');
    console.log('  - validateState: 状態検証');
    console.log('  - ToolUtils: 共通ユーティリティ');
    console.log('🐛 デバッグ関数（モジュール分割版）:');
    console.log('  - window.debugBaseTool(toolName) - 個別ツール状態表示');
    console.log('  - window.debugAllToolStates() - 全ツール状態表示');
}

// ESモジュール対応
if (typeof exports !== 'undefined') {
    exports.BaseTool = BaseTool;
    exports.ToolUtils = ToolUtils;
    exports.TOOL_EVENTS = TOOL_EVENTS;
}

console.log('🏆 base-tool.js モジュール分割版 初期化完了');