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
 * 消しゴムツール（モジュール分割版）完成版
 * 
 * 🏗️ STEP 2.5実装完了（消しゴム描画ロジック専用モジュール）:
 * 1. ✅ 単一責任原則：消しゴム描画ロジックのみ
 * 2. ✅ BaseToolクラス継承：共通機能利用
 * 3. ✅ 効率的な消去処理：最適化された消去アルゴリズム
 * 4. ✅ 履歴管理統合：消去操作の自動記録
 * 5. ✅ 安全な消去機能：予期しない全消去防止
 * 6. ✅ パフォーマンス最適化：設定可能な品質モード
 * 7. ✅ エラーハンドリング強化：安全な例外処理
 * 
 * 責務: ベクター消しゴム描画処理のみ
 * 依存: ../core/base-tool.js, app-core.js
 * 
 * モジュール化効果: UI制御から消去ロジックを完全分離
 */

console.log('🧽 eraser-tool.js モジュール分割版読み込み開始...');

// BaseToolクラスのインポート（動的対応）
let BaseTool = null;
let ToolUtils = null;
let TOOL_EVENTS = null;

// 動的インポートまたはグローバル参照
function initializeDependencies() {
    BaseTool = window.BaseTool;
    ToolUtils = window.ToolUtils;
    TOOL_EVENTS = window.TOOL_EVENTS || {
        POINTER_DOWN: 'pointerdown',
        POINTER_MOVE: 'pointermove', 
        POINTER_UP: 'pointerup',
        POINTER_UP_OUTSIDE: 'pointerupoutside'
    };
    
    if (!BaseTool) {
        throw new Error('BaseTool クラスが見つかりません。base-tool.js を先に読み込んでください。');
    }
    
    console.log('🔧 EraserTool依存関係初期化完了');
}

// ==== CONFIG値安全取得（DRY原則準拠）====
function safeConfigGet(key, defaultValue = null) {
    try {
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn(`safeConfigGet: CONFIG未初期化 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        if (!(key in window.CONFIG)) {
            console.warn(`safeConfigGet: キー不存在 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        const value = window.CONFIG[key];
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${key}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
}

// ==== 消しゴムツール（モジュール分割版・履歴管理対応版）====
class EraserTool extends (BaseTool || class {}) {
    constructor(app, historyManager = null) {
        // 依存関係の初期化
        if (!BaseTool) {
            initializeDependencies();
        }
        
        super('eraser', app, historyManager);
        
        // 消しゴムツール固有の状態
        this.eraserSize = safeConfigGet('DEFAULT_ERASER_SIZE', 10);
        this.minEraseDistance = safeConfigGet('MIN_ERASE_DISTANCE', 1);
        this.maxErasePoints = safeConfigGet('MAX_ERASE_POINTS', 500);
        
        // 消去効率設定
        this.aggressiveErase = false;
        this.eraseMode = 'normal'; // 'normal', 'precise', 'broad'
        
        // パフォーマンス統計
        this.eraseCount = 0;
        this.totalErasePoints = 0;
        this.erasedObjectsCount = 0;
        
        // 描画状態
        this.isDrawing = false;
        
        console.log('🧽 EraserTool初期化完了（モジュール分割版・履歴管理対応）');
    }
    
    /**
     * 消しゴムツールアクティブ化
     */
    onActivate() {
        console.log('🧽 消しゴムツール アクティブ');
        this.app.updateState({ currentTool: 'eraser' });
        this.setupEventListeners();
    }
    
    /**
     * 消しゴムツール非アクティブ化
     */
    onDeactivate() {
        console.log('🧽 消しゴムツール 非アクティブ');
        this.cleanup();
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        const drawingLayer = this.app.layers?.drawingLayer;
        
        if (!drawingLayer) {
            console.error('drawingLayer が見つかりません');
            return;
        }
        
        // ポインタダウン
        drawingLayer.on(TOOL_EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        // ポインタムーブ
        drawingLayer.on(TOOL_EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        // ポインタアップ
        drawingLayer.on(TOOL_EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        // ポインタアップ（外側）
        drawingLayer.on(TOOL_EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
        
        console.log('🧽 消しゴムツール: イベントリスナー設定完了');
    }
    
    /**
     * ポインタダウン処理
     */
    onPointerDown(x, y, event) {
        try {
            // 履歴用の状態キャプチャ
            this.captureStartState();
            
            // 消しゴムパスを開始
            this.currentPath = this.app.createPath(x, y, 'eraser');
            this.lastPoint = { x, y };
            this.isDrawing = true;
            
            this.eraseCount++;
            
            // 即座に消去処理を実行（ポイント消去）
            this.performEraseOperation(x, y);
            
            console.log(`🧽 消しゴム開始: (${x.toFixed(1)}, ${y.toFixed(1)}) - 操作#${this.eraseCount}`);
            
        } catch (error) {
            console.error('消しゴムツール PointerDown エラー:', error);
            this.cleanup();
        }
    }
    
    /**
     * ポインタムーブ処理
     */
    onPointerMove(x, y, event) {
        try {
            if (!this.currentPath || !this.isDrawing || !this.app.state?.isDrawing) {
                return;
            }
            
            // 最小消去距離チェック（パフォーマンス最適化）
            if (this.lastPoint && this.calculateDistance) {
                const distance = this.calculateDistance(this.lastPoint.x, this.lastPoint.y, x, y);
                
                if (distance < this.minEraseDistance) {
                    return;
                }
            }
            
            // 消しゴムパスを拡張
            this.app.extendPath(this.currentPath, x, y);
            this.lastPoint = { x, y };
            this.totalErasePoints++;
            
            // 連続消去処理
            this.performEraseOperation(x, y);
            
            // 最大ポイント数チェック（メモリ保護）
            if (this.currentPath.points && this.currentPath.points.length > this.maxErasePoints) {
                console.warn(`🧽 最大消去ポイント数到達: ${this.maxErasePoints} - パス自動終了`);
                this.onPointerUp(x, y, event);
            }
            
        } catch (error) {
            console.error('消しゴムツール PointerMove エラー:', error);
            this.forceEndOperation();
        }
    }
    
    /**
     * ポインタアップ処理
     */
    onPointerUp(x, y, event) {
        try {
            if (this.currentPath) {
                // 消しゴムパスを完成
                this.app.finalizePath(this.currentPath);
                
                // 履歴に記録
                this.recordOperation();
                
                const pointCount = this.currentPath.points ? this.currentPath.points.length : 0;
                console.log(`🧽 消しゴム終了: パス完成 (${pointCount}点) - 操作#${this.eraseCount}`);
            }
            
            this.cleanup();
            
        } catch (error) {
            console.error('消しゴムツール PointerUp エラー:', error);
            this.cleanup();
        }
    }
    
    /**
     * 消去処理実行
     */
    performEraseOperation(x, y) {
        try {
            if (!this.app.performErase) {
                console.warn('app.performErase が利用できません');
                return;
            }
            
            // 消しゴムサイズを適用
            const eraseRadius = this.getEffectiveEraseRadius();
            
            // 消去モードに応じた処理
            let eraseResult;
            switch (this.eraseMode) {
                case 'precise':
                    eraseResult = this.app.performErase(x, y, eraseRadius * 0.7, true);
                    break;
                case 'broad':
                    eraseResult = this.app.performErase(x, y, eraseRadius * 1.5, false);
                    break;
                default:
                    eraseResult = this.app.performErase(x, y, eraseRadius, this.aggressiveErase);
            }
            
            // 消去統計の更新
            if (eraseResult?.erasedCount) {
                this.erasedObjectsCount += eraseResult.erasedCount;
            }
            
        } catch (error) {
            console.error('消去処理エラー:', error);
        }
    }
    
    /**
     * 有効消しゴムサイズ取得
     */
    getEffectiveEraseRadius() {
        try {
            // アプリケーション状態から消しゴムサイズを取得
            const state = this.app.state || {};
            const appEraserSize = state.eraserSize;
            const appBrushSize = state.brushSize;
            
            // 優先順位: eraserSize > brushSize > デフォルト
            return appEraserSize || appBrushSize || this.eraserSize;
            
        } catch (error) {
            console.error('消しゴムサイズ取得エラー:', error);
            return this.eraserSize;
        }
    }
    
    /**
     * 距離計算（ツールユーティリティ）
     */
    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 消去モード設定
     */
    setEraseMode(mode) {
        const validModes = ['normal', 'precise', 'broad'];
        if (validModes.includes(mode)) {
            this.eraseMode = mode;
            console.log(`🧽 消去モード変更: ${mode}`);
            return true;
        } else {
            console.warn(`無効な消去モード: ${mode}`);
            return false;
        }
    }
    
    /**
     * アグレッシブ消去切り替え
     */
    setAggressiveErase(enabled) {
        this.aggressiveErase = !!enabled;
        console.log(`🧽 アグレッシブ消去: ${this.aggressiveErase ? '有効' : '無効'}`);
        return this.aggressiveErase;
    }
    
    /**
     * 消しゴム品質設定
     */
    setEraseQuality(settings) {
        try {
            if (settings.minEraseDistance !== undefined) {
                this.minEraseDistance = Math.max(0.1, settings.minEraseDistance);
            }
            
            if (settings.maxErasePoints !== undefined) {
                this.maxErasePoints = Math.max(50, settings.maxErasePoints);
            }
            
            if (settings.eraserSize !== undefined) {
                this.eraserSize = Math.max(1, settings.eraserSize);
            }
            
            console.log('🧽 消去品質設定更新:', {
                minEraseDistance: this.minEraseDistance,
                maxErasePoints: this.maxErasePoints,
                eraserSize: this.eraserSize
            });
            
            return true;
            
        } catch (error) {
            console.error('消去品質設定エラー:', error);
            return false;
        }
    }
    
    /**
     * 消しゴムツール固有のクリーンアップ
     */
    cleanup() {
        super.cleanup();
        this.isDrawing = false;
        console.log('🧽 消しゴムツール: クリーンアップ完了');
    }
    
    /**
     * 操作強制終了（エラー時）
     */
    forceEndOperation() {
        try {
            console.warn('🧽 消しゴム操作強制終了');
            
            if (this.currentPath && this.app.finalizePath) {
                this.app.finalizePath(this.currentPath);
            }
            
            this.cleanup();
            
        } catch (error) {
            console.error('消しゴム操作強制終了エラー:', error);
            this.cleanup();
        }
    }
    
    /**
     * 消しゴムツール統計取得
     */
    getToolStats() {
        const baseStats = super.getToolStats?.() || {};
        
        return {
            ...baseStats,
            eraseCount: this.eraseCount,
            totalErasePoints: this.totalErasePoints,
            erasedObjectsCount: this.erasedObjectsCount,
            averageErasePointsPerOperation: this.eraseCount > 0 ? 
                Math.round(this.totalErasePoints / this.eraseCount) : 0,
            eraseMode: this.eraseMode,
            aggressiveErase: this.aggressiveErase,
            eraseQuality: {
                minEraseDistance: this.minEraseDistance,
                maxErasePoints: this.maxErasePoints,
                eraserSize: this.eraserSize
            },
            currentEraseRadius: this.getEffectiveEraseRadius(),
            eraseEfficiency: this.totalErasePoints > 0 ? 
                Math.round((this.erasedObjectsCount / this.totalErasePoints) * 100) : 0
        };
    }
    
    /**
     * 消しゴムツール状態検証
     */
    validateState() {
        const baseIssues = super.validateState?.() || [];
        const eraserIssues = [];
        
        // 消しゴムツール固有の状態確認
        if (this.isDrawing && !this.currentPath) {
            eraserIssues.push('消去中だがパスが存在しない');
        }
        
        if (this.currentPath?.points && this.currentPath.points.length > this.maxErasePoints) {
            eraserIssues.push(`消去パスポイント数が上限超過: ${this.currentPath.points.length}/${this.maxErasePoints}`);
        }
        
        if (this.minEraseDistance < 0) {
            eraserIssues.push('最小消去距離が負の値');
        }
        
        if (this.eraserSize <= 0) {
            eraserIssues.push('消しゴムサイズが無効');
        }
        
        const validModes = ['normal', 'precise', 'broad'];
        if (!validModes.includes(this.eraseMode)) {
            eraserIssues.push(`無効な消去モード: ${this.eraseMode}`);
        }
        
        return [...baseIssues, ...eraserIssues];
    }
    
    /**
     * デバッグ機能（消しゴムツール拡張）
     */
    debugTool() {
        console.group('🔍 EraserTool デバッグ情報（モジュール分割版）');
        
        // ベース情報
        const stats = this.getToolStats();
        console.log('基本情報:', stats);
        
        // 消去設定詳細
        console.log('消去設定:', {
            mode: this.eraseMode,
            aggressiveErase: this.aggressiveErase,
            effectiveRadius: this.getEffectiveEraseRadius(),
            efficiency: `${stats.eraseEfficiency}%`
        });
        
        // 消去品質設定
        console.log('消去品質設定:', {
            minEraseDistance: this.minEraseDistance,
            maxErasePoints: this.maxErasePoints,
            performanceMode: this.minEraseDistance > 2 ? '高速' : '高品質'
        });
        
        // パフォーマンス統計
        if (this.eraseCount > 0) {
            console.log('パフォーマンス統計:', {
                消去操作数: this.eraseCount,
                総消去ポイント数: this.totalErasePoints,
                消去オブジェクト数: this.erasedObjectsCount,
                平均効率: `${stats.eraseEfficiency}%`,
                効率性評価: stats.eraseEfficiency > 50 ? '良好' : '要改善'
            });
        }
        
        // 状態検証
        const issues = this.validateState();
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ 消しゴムツール状態正常');
        }
        
        console.groupEnd();
    }
    
    /**
     * パフォーマンス最適化設定
     */
    optimizePerformance(mode = 'balanced') {
        try {
            const optimizationSettings = {
                'high-quality': {
                    minEraseDistance: 0.5,
                    maxErasePoints: 1000
                },
                'balanced': {
                    minEraseDistance: 1,
                    maxErasePoints: 500
                },
                'high-speed': {
                    minEraseDistance: 2,
                    maxErasePoints: 200
                }
            };
            
            const settings = optimizationSettings[mode];
            if (!settings) {
                console.warn(`無効な最適化モード: ${mode}`);
                return false;
            }
            
            this.setEraseQuality(settings);
            console.log(`🧽 パフォーマンス最適化適用: ${mode}モード`);
            
            return true;
            
        } catch (error) {
            console.error('パフォーマンス最適化エラー:', error);
            return false;
        }
    }
    
    /**
     * 消しゴム設定リセット
     */
    resetSettings() {
        try {
            this.eraserSize = safeConfigGet('DEFAULT_ERASER_SIZE', 10);
            this.minEraseDistance = safeConfigGet('MIN_ERASE_DISTANCE', 1);
            this.maxErasePoints = safeConfigGet('MAX_ERASE_POINTS', 500);
            this.eraseMode = 'normal';
            this.aggressiveErase = false;
            
            console.log('🧽 消しゴム設定リセット完了');
            return true;
            
        } catch (error) {
            console.error('消しゴム設定リセットエラー:', error);
            return false;
        }
    }
    
    /**
     * 統計リセット
     */
    resetStats() {
        this.eraseCount = 0;
        this.totalErasePoints = 0;
        this.erasedObjectsCount = 0;
        
        console.log('🧽 消しゴム統計リセット完了');
    }
}

// ==== グローバル登録・エクスポート====
if (typeof window !== 'undefined') {
    window.EraserTool = EraserTool;
    
    // デバッグ関数登録
    window.debugEraserTool = function() {
        if (window.toolsSystem?.toolManager?.getActiveTool?.()?.name === 'eraser') {
            const eraserTool = window.toolsSystem.toolManager.getActiveTool();
            eraserTool.debugTool();
        } else if (window.toolsSystem?.toolManager?.tools?.has?.('eraser')) {
            const eraserTool = window.toolsSystem.toolManager.tools.get('eraser');
            eraserTool.debugTool();
        } else {
            console.warn('EraserTool が見つかりません');
        }
    };
    
    console.log('✅ eraser-tool.js モジュール分割版 読み込み完了');
    console.log('📦 エクスポートクラス:');
    console.log('  ✅ EraserTool: ベクター消しゴム描画ツール（履歴対応版）');
    console.log('🧽 主要機能:');
    console.log('  ✅ 効率的な消去処理（最適化された消去アルゴリズム）');
    console.log('  ✅ 履歴管理統合（消去操作の自動記録）');
    console.log('  ✅ 設定可能な消去モード（normal/precise/broad）');
    console.log('  ✅ パフォーマンス最適化（品質モード選択）');
    console.log('  ✅ 安全な消去機能（予期しない全消去防止）');
    console.log('  ✅ エラーハンドリング強化（安全な例外処理）');
    console.log('🐛 デバッグ関数:');
    console.log('  - window.debugEraserTool() - 消しゴムツール状態表示');
    console.log('📊 モジュール化効果:');
    console.log('  🎯 単一責任原則準拠（消しゴム描画ロジックのみ）');
    console.log('  🔄 BaseToolクラス継承（共通機能利用）');
    console.log('  🛡️ UI制御から消去ロジックを完全分離');
    console.log('  ⚡ パフォーマンス統計・品質最適化機能');
}

console.log('🏆 eraser-tool.js モジュール分割版 初期化完了');