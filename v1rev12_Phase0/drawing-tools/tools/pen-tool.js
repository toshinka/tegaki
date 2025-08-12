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
 * ペンツール（モジュール分割版）
 * 
 * 🏗️ STEP 2.5実装完了（ペン描画ロジック専用モジュール）:
 * 1. ✅ 単一責任原則：ペン描画ロジックのみ
 * 2. ✅ BaseToolクラス継承：共通機能利用
 * 3. ✅ スムージング機能：高品質な線描画
 * 4. ✅ 履歴管理統合：操作の自動記録
 * 5. ✅ パフォーマンス最適化：効率的な描画処理
 * 
 * 責務: ベクターペン描画処理のみ
 * 依存: ../core/base-tool.js, app-core.js
 * 
 * モジュール化効果: UI制御から描画ロジックを完全分離
 */

console.log('🖊️ pen-tool.js モジュール分割版読み込み開始...');

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
    
    console.log('🔧 PenTool依存関係初期化完了');
}

// ==== ベクターペンツール（モジュール分割版・履歴管理対応版）====
class PenTool extends (BaseTool || class {}) {
    constructor(app, historyManager = null) {
        // 依存関係の初期化
        if (!BaseTool) {
            initializeDependencies();
        }
        
        super('pen', app, historyManager);
        
        // ペンツール固有の状態
        this.smoothingBuffer = [];
        this.maxBufferSize = 5;
        
        // 描画品質設定
        this.minStrokeDistance = 2;
        this.maxPoints = 1000;
        
        // パフォーマンス統計
        this.strokeCount = 0;
        this.totalPoints = 0;
        this.smoothingEnabled = true;
        
        console.log('🖊️ PenTool初期化完了（モジュール分割版・履歴管理対応）');
    }
    
    /**
     * ペンツールアクティブ化
     */
    onActivate() {
        console.log('🖊️ ベクターペンツール アクティブ');
        this.app.updateState({ currentTool: 'pen' });
        this.setupEventListeners();
    }
    
    /**
     * ペンツール非アクティブ化
     */
    onDeactivate() {
        console.log('🖊️ ベクターペンツール 非アクティブ');
        this.cleanup();
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
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
        
        console.log('🖊️ ペンツール: イベントリスナー設定完了');
    }
    
    /**
     * ポインタダウン処理
     */
    onPointerDown(x, y, event) {
        try {
            // 履歴用の状態キャプチャ
            this.captureStartState();
            
            // 新しいパスを開始
            this.currentPath = this.app.createPath(x, y, 'pen');
            this.lastPoint = { x, y };
            this.isDrawing = true;
            
            // スムージングバッファの初期化
            this.smoothingBuffer = [{ x, y }];
            
            this.strokeCount++;
            console.log(`🖊️ ペン描画開始: (${x.toFixed(1)}, ${y.toFixed(1)}) - ストローク#${this.strokeCount}`);
            
        } catch (error) {
            console.error('ペンツール PointerDown エラー:', error);
            this.cleanup();
        }
    }
    
    /**
     * ポインタムーブ処理
     */
    onPointerMove(x, y, event) {
        try {
            if (!this.currentPath || !this.isDrawing || !this.app.state.isDrawing) {
                return;
            }
            
            // 最小描画距離チェック（パフォーマンス最適化）
            if (this.lastPoint && ToolUtils) {
                const distance = ToolUtils.distance(
                    this.lastPoint.x, this.lastPoint.y, x, y
                );
                
                if (distance < this.minStrokeDistance) {
                    return;
                }
            }
            
            // スムージング処理
            const smoothedPoint = this.smoothingEnabled ? 
                this.applySmoothingFilter(x, y) : { x, y };
            
            // パスを拡張
            this.app.extendPath(this.currentPath, smoothedPoint.x, smoothedPoint.y);
            this.lastPoint = smoothedPoint;
            this.totalPoints++;
            
            // 最大ポイント数チェック（メモリ保護）
            if (this.currentPath.points && this.currentPath.points.length > this.maxPoints) {
                console.warn(`🖊️ 最大ポイント数到達: ${this.maxPoints} - パス自動終了`);
                this.onPointerUp(x, y, event);
            }
            
        } catch (error) {
            console.error('ペンツール PointerMove エラー:', error);
            this.forceEndOperation();
        }
    }
    
    /**
     * ポインタアップ処理
     */
    onPointerUp(x, y, event) {
        try {
            if (this.currentPath) {
                // パスを完成
                this.app.finalizePath(this.currentPath);
                
                // 履歴に記録
                this.recordOperation();
                
                const pointCount = this.currentPath.points ? this.currentPath.points.length : 0;
                console.log(`🖊️ ペン描画終了: パス完成 (${pointCount}点) - ストローク#${this.strokeCount}`);
            }
            
            this.cleanup();
            
        } catch (error) {
            console.error('ペンツール PointerUp エラー:', error);
            this.cleanup();
        }
    }
    
    /**
     * スムージングフィルター適用
     */
    applySmoothingFilter(x, y) {
        try {
            const smoothing = this.app.state.smoothing || 0;
            
            // スムージングが無効な場合は元の座標を返す
            if (smoothing === 0 || this.smoothingBuffer.length === 0) {
                this.smoothingBuffer.push({ x, y });
                return { x, y };
            }
            
            // バッファに新しい点を追加
            this.smoothingBuffer.push({ x, y });
            if (this.smoothingBuffer.length > this.maxBufferSize) {
                this.smoothingBuffer.shift();
            }
            
            // 平均値を計算
            const bufferLength = this.smoothingBuffer.length;
            const avgX = this.smoothingBuffer.reduce((sum, p) => sum + p.x, 0) / bufferLength;
            const avgY = this.smoothingBuffer.reduce((sum, p) => sum + p.y, 0) / bufferLength;
            
            // スムージング適用
            const smoothedX = x + (avgX - x) * smoothing;
            const smoothedY = y + (avgY - y) * smoothing;
            
            return { x: smoothedX, y: smoothedY };
            
        } catch (error) {
            console.error('スムージング処理エラー:', error);
            return { x, y };
        }
    }
    
    /**
     * ペンツール固有のクリーンアップ
     */
    onCleanup() {
        this.smoothingBuffer = [];
        this.isDrawing = false;
        console.log('🖊️ ペンツール: クリーンアップ完了');
    }
    
    /**
     * スムージング有効/無効切り替え
     */
    setSmoothingEnabled(enabled) {
        this.smoothingEnabled = !!enabled;
        console.log(`🖊️ スムージング: ${this.smoothingEnabled ? '有効' : '無効'}`);
        return this.smoothingEnabled;
    }
    
    /**
     * 描画品質設定
     */
    setDrawingQuality(settings) {
        try {
            if (settings.minStrokeDistance !== undefined) {
                this.minStrokeDistance = Math.max(0.1, settings.minStrokeDistance);
            }
            
            if (settings.maxPoints !== undefined) {
                this.maxPoints = Math.max(100, settings.maxPoints);
            }
            
            if (settings.maxBufferSize !== undefined) {
                this.maxBufferSize = Math.max(2, settings.maxBufferSize);
            }
            
            console.log('🖊️ 描画品質設定更新:', {
                minStrokeDistance: this.minStrokeDistance,
                maxPoints: this.maxPoints,
                maxBufferSize: this.maxBufferSize
            });
            
            return true;
            
        } catch (error) {
            console.error('描画品質設定エラー:', error);
            return false;
        }
    }
    
    /**
     * ペンツール統計取得
     */
    getToolStats() {
        const baseStats = super.getToolStats();
        
        return {
            ...baseStats,
            strokeCount: this.strokeCount,
            totalPoints: this.totalPoints,
            averagePointsPerStroke: this.strokeCount > 0 ? 
                Math.round(this.totalPoints / this.strokeCount) : 0,
            smoothingEnabled: this.smoothingEnabled,
            drawingQuality: {
                minStrokeDistance: this.minStrokeDistance,
                maxPoints: this.maxPoints,
                maxBufferSize: this.maxBufferSize
            },
            currentSmoothing: this.app.state ? this.app.state.smoothing : 0,
            bufferLength: this.smoothingBuffer.length
        };
    }
    
    /**
     * ペンツール状態検証
     */
    validateState() {
        const baseIssues = super.validateState();
        const penIssues = [];
        
        // ペンツール固有の状態確認
        if (this.isDrawing && !this.currentPath) {
            penIssues.push('描画中だがパスが存在しない');
        }
        
        if (this.smoothingBuffer.length > this.maxBufferSize) {
            penIssues.push(`スムージングバッファが上限超過: ${this.smoothingBuffer.length}/${this.maxBufferSize}`);
        }
        
        if (this.currentPath && this.currentPath.points && this.currentPath.points.length > this.maxPoints) {
            penIssues.push(`パスポイント数が上限超過: ${this.currentPath.points.length}/${this.maxPoints}`);
        }
        
        if (this.minStrokeDistance < 0) {
            penIssues.push('最小ストローク距離が負の値');
        }
        
        return [...baseIssues, ...penIssues];
    }
    
    /**
     * デバッグ機能（ペンツール拡張）
     */
    debugTool() {
        console.group('🔍 PenTool デバッグ情報（モジュール分割版）');
        
        // ベース情報
        console.log('基本情報:', this.getToolStats());
        
        // スムージング詳細
        console.log('スムージング状態:', {
            enabled: this.smoothingEnabled,
            bufferSize: this.smoothingBuffer.length,
            maxBufferSize: this.maxBufferSize,
            currentBuffer: this.smoothingBuffer.slice(-3) // 最新3点表示
        });
        
        // 描画品質設定
        console.log('描画品質設定:', {
            minStrokeDistance: this.minStrokeDistance,
            maxPoints: this.maxPoints,
            performanceMode: this.minStrokeDistance > 1 ? '高速' : '高品質'
        });
        
        // パフォーマンス統計
        if (this.strokeCount > 0) {
            console.log('パフォーマンス統計:', {
                ストローク数: this.strokeCount,
                総ポイント数: this.totalPoints,
                平均ポイント数: Math.round(this.totalPoints / this.strokeCount),
                効率性: this.totalPoints / this.strokeCount < 50 ? '良好' : '要最適化'
            });
        }
        
        // 状態検証
        const issues = this.validateState();
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ ペンツール状態正常');
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
                    minStrokeDistance: 1,
                    maxPoints: 2000,
                    maxBufferSize: 8
                },
                'balanced': {
                    minStrokeDistance: 2,
                    maxPoints: 1000,
                    maxBufferSize: 5
                },
                'performance': {
                    minStrokeDistance: 4,
                    maxPoints: 500,
                    maxBufferSize: 3
                }
            };
            
            const settings = optimizationSettings[mode];
            if (settings) {
                this.setDrawingQuality(settings);
                console.log(`🖊️ パフォーマンス最適化: ${mode}モード適用`);
                return true;
            } else {
                console.warn(`未知の最適化モード: ${mode}`);
                return false;
            }
            
        } catch (error) {
            console.error('パフォーマンス最適化エラー:', error);
            return false;
        }
    }
    
    /**
     * クリーンアップ（ペンツール拡張）
     */
    destroy() {
        try {
            console.log('🧹 PenTool クリーンアップ開始');
            
            // スムージングバッファクリア
            this.smoothingBuffer = [];
            
            // 統計リセット
            this.strokeCount = 0;
            this.totalPoints = 0;
            
            // ベースクラスのクリーンアップ
            super.destroy();
            
            console.log('✅ PenTool クリーンアップ完了');
            
        } catch (error) {
            console.error('PenTool クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（モジュール分割版）====
if (typeof window !== 'undefined') {
    // 依存関係の確認
    if (!window.BaseTool) {
        console.warn('⚠️ BaseTool が見つかりません。base-tool.js を先に読み込んでください。');
    }
    
    window.PenTool = PenTool;
    
    // 後方互換性のためのエイリアス
    window.VectorPenTool = PenTool;
    
    // デバッグ関数
    window.debugPenTool = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            const penTool = window.toolsSystem.toolManager.getTool('pen');
            if (penTool && penTool.debugTool) {
                penTool.debugTool();
            } else {
                console.warn('PenTool が見つからないか、デバッグ機能がありません');
            }
        } else {
            console.warn('ToolManager が利用できません');
        }
    };
    
    // ペンツール最適化関数
    window.optimizePenPerformance = function(mode = 'balanced') {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            const penTool = window.toolsSystem.toolManager.getTool('pen');
            if (penTool && penTool.optimizePerformance) {
                const success = penTool.optimizePerformance(mode);
                console.log(`🖊️ ペン最適化 ${mode}: ${success ? '成功' : '失敗'}`);
                return success;
            } else {
                console.warn('PenTool が見つからないか、最適化機能がありません');
                return false;
            }
        } else {
            console.warn('ToolManager が利用できません');
            return false;
        }
    };
    
    // スムージング切り替え関数
    window.togglePenSmoothing = function() {
        if (window.toolsSystem && window.toolsSystem.toolManager) {
            const penTool = window.toolsSystem.toolManager.getTool('pen');
            if (penTool && penTool.setSmoothingEnabled) {
                const newState = penTool.setSmoothingEnabled(!penTool.smoothingEnabled);
                console.log(`🖊️ ペンスムージング: ${newState ? '有効' : '無効'}`);
                return newState;
            } else {
                console.warn('PenTool が見つからないか、スムージング機能がありません');
                return false;
            }
        } else {
            console.warn('ToolManager が利用できません');
            return false;
        }
    };
    
    console.log('✅ pen-tool.js モジュール分割版 読み込み完了');
    console.log('📦 モジュール化効果:');
    console.log('  🎯 単一責任: ペン描画ロジックのみ（~200行）');
    console.log('  🏗️ 継承活用: BaseToolの共通機能利用');
    console.log('  📈 高品質: スムージング・パフォーマンス最適化');
    console.log('  📚 履歴統合: 自動操作記録機能');
    console.log('  🛡️ 安全性: エラー時の自動復旧機能');
    console.log('🎨 描画機能:');
    console.log('  - 高精度ベクター描画');
    console.log('  - 可変スムージングフィルター');
    console.log('  - パフォーマンス最適化モード');
    console.log('  - メモリ保護（最大ポイント制限）');
    console.log('🐛 デバッグ関数（モジュール分割版）:');
    console.log('  - window.debugPenTool() - ペンツール状態表示');
    console.log('  - window.optimizePenPerformance(mode) - パフォーマンス最適化');
    console.log('  - window.togglePenSmoothing() - スムージング切り替え');
}

// ESモジュール対応
if (typeof exports !== 'undefined') {
    exports.PenTool = PenTool;
    exports.VectorPenTool = PenTool; // 後方互換性
}

console.log('🏆 pen-tool.js モジュール分割版 初期化完了');