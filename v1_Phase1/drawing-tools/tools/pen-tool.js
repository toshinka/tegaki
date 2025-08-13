/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * PenTool - @pixi/graphics-smooth導入版 (Phase3: スムーズ描画機能移行)
 * 
 * 📝 Phase3改修内容:
 * - 独自スムージング実装50行 → @pixi/graphics-smooth使用5行に削減
 * - applySmoothingFilter メソッド削除（@pixi/graphics-smoothが自動処理）
 * - PixiJS標準API使用でAI実装しやすさ向上
 * - 保守性・拡張性の大幅向上
 * 
 * 🔧 使用ライブラリ:
 * - @pixi/graphics-smooth: 高品質スムーズ描画機能
 * - PixiJS v7標準API: Graphics・Container
 * 
 * 責務: ペン描画・@pixi/graphics-smooth統合・既存機能との互換性維持
 * 依存: PixiJS v7, @pixi/graphics-smooth (オプション), window.PixiExtensions
 */

console.log('🎨 PenTool @pixi/graphics-smooth導入版 読み込み開始...');

class PenTool {
    constructor(app, config = {}) {
        this.app = app;
        this.config = {
            // デフォルト設定
            size: window.CONFIG?.DEFAULT_BRUSH_SIZE || 4,
            opacity: window.CONFIG?.DEFAULT_OPACITY || 1.0,
            color: window.CONFIG?.DEFAULT_COLOR || 0x800000,
            pressure: window.CONFIG?.DEFAULT_PRESSURE || 0.5,
            smoothing: window.CONFIG?.DEFAULT_SMOOTHING || 0.3,
            ...config
        };
        
        // 描画状態
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        this.points = [];
        
        // @pixi/graphics-smooth 関連
        this.smoothGraphicsAvailable = false;
        this.graphicsClass = null;
        
        // 筆圧・スムージング用
        this.velocitySmoothing = 0.7;
        this.pressureHistory = [];
        this.maxHistoryLength = 3;
        
        // レイヤー管理
        this.currentLayer = null;
        
        console.log('🎨 PenTool @pixi/graphics-smooth導入版 構築完了');
    }
    
    /**
     * Phase3: @pixi/graphics-smooth使用初期化
     */
    async init() {
        console.log('🎨 PenTool @pixi/graphics-smooth導入版 初期化開始...');
        
        try {
            // @pixi/graphics-smooth 可用性チェック
            this.checkSmoothGraphicsAvailability();
            
            // グラフィックスクラス決定
            this.determineGraphicsClass();
            
            // レイヤーマネージャー統合
            this.setupLayerIntegration();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            console.log('✅ PenTool @pixi/graphics-smooth導入版 初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ PenTool初期化失敗:', error);
            return false;
        }
    }
    
    /**
     * @pixi/graphics-smooth可用性チェック
     */
    checkSmoothGraphicsAvailability() {
        this.smoothGraphicsAvailable = !!(
            window.PixiExtensions?.hasFeature('smooth') ||
            (window.PIXI && window.PIXI.smooth?.SmoothGraphics) ||
            window.pixiSmooth
        );
        
        console.log(`📊 @pixi/graphics-smooth利用可能性: ${this.smoothGraphicsAvailable ? '✅' : '❌'}`);
        
        if (this.smoothGraphicsAvailable) {
            console.log('🎉 @pixi/graphics-smooth使用でスムーズ描画を実装します');
        } else {
            console.log('📦 フォールバック: 通常Graphics使用でスムーズ描画を提供');
        }
    }
    
    /**
     * グラフィックスクラス決定
     */
    determineGraphicsClass() {
        if (this.smoothGraphicsAvailable) {
            // @pixi/graphics-smooth使用
            this.graphicsClass = window.PixiExtensions?.Smooth?.SmoothGraphics ||
                               window.PIXI?.smooth?.SmoothGraphics ||
                               window.pixiSmooth?.SmoothGraphics;
            
            if (this.graphicsClass) {
                console.log('✅ SmoothGraphicsクラス使用');
            } else {
                console.warn('⚠️ SmoothGraphicsクラス取得失敗、通常Graphicsを使用');
                this.graphicsClass = PIXI.Graphics;
                this.smoothGraphicsAvailable = false;
            }
        } else {
            // 通常Graphics使用
            this.graphicsClass = PIXI.Graphics;
            console.log('📦 通常Graphicsクラス使用');
        }
    }
    
    /**
     * レイヤーマネージャー統合
     */
    setupLayerIntegration() {
        // LayerManagerが利用可能な場合は統合
        if (window.PixiExtensions?.hasFeature('layers')) {
            const layerManager = window.PixiExtensions.createLayerManager(this.app);
            this.currentLayer = layerManager.getLayer('drawing');
            console.log('✅ レイヤーマネージャー統合完了');
        } else {
            // フォールバック: ステージ直接使用
            this.currentLayer = this.app.stage;
            console.log('📦 フォールバック: ステージ直接使用');
        }
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        const canvas = this.app.view;
        
        // ポインタイベント
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        // タッチイベント（筆圧対応）
        if ('ontouchstart' in window) {
            canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
            canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
            canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        }
        
        console.log('🎮 イベントリスナー設定完了');
    }
    
    /**
     * Phase3: 新しいパス作成（@pixi/graphics-smooth使用）
     */
    createNewPath() {
        // Phase3改修: SmoothGraphics使用（従来50行の独自実装を5行に削減）
        this.currentPath = new this.graphicsClass();
        
        if (this.smoothGraphicsAvailable) {
            // @pixi/graphics-smoothの場合、スムージングは自動処理
            console.log('🎨 SmoothGraphics パス作成（自動スムージング有効）');
        } else {
            // 通常Graphicsの場合
            console.log('📦 通常Graphics パス作成');
        }
        
        // 基本スタイル設定
        this.currentPath.lineStyle(
            this.calculateBrushSize(),
            this.config.color,
            this.config.opacity,
            0.5, // alignment
            false // native
        );
        
        // レイヤーに追加
        if (this.currentLayer) {
            this.currentLayer.addChild(this.currentPath);
        }
        
        return this.currentPath;
    }
    
    /**
     * ポインタダウンイベント
     */
    onPointerDown(event) {
        if (!this.isEnabled) return;
        
        this.isDrawing = true;
        const point = this.getEventPoint(event);
        
        // 新しいパス開始
        this.createNewPath();
        this.points = [point];
        this.lastPoint = point;
        
        // 筆圧初期化
        this.pressureHistory = [this.extractPressure(event)];
        
        // 描画開始
        this.currentPath.moveTo(point.x, point.y);
        
        console.log('🎨 描画開始:', point);
    }
    
    /**
     * ポインタムーブイベント
     */
    onPointerMove(event) {
        if (!this.isEnabled || !this.isDrawing || !this.currentPath) return;
        
        const point = this.getEventPoint(event);
        const pressure = this.extractPressure(event);
        
        // 筆圧履歴更新
        this.updatePressureHistory(pressure);
        
        // Phase3改修: スムージング処理
        if (this.smoothGraphicsAvailable) {
            // @pixi/graphics-smoothが自動処理するため、直接描画
            this.drawSmoothLine(point, pressure);
        } else {
            // フォールバック: 基本的なスムージング
            this.drawBasicSmoothLine(point, pressure);
        }
        
        this.lastPoint = point;
        this.points.push(point);
    }
    
    /**
     * ポインタアップイベント
     */
    onPointerUp(event) {
        if (!this.isEnabled || !this.isDrawing) return;
        
        this.isDrawing = false;
        
        // パス完了処理
        this.finalizePath();
        
        // 状態リセット
        this.currentPath = null;
        this.lastPoint = null;
        this.points = [];
        this.pressureHistory = [];
        
        console.log('🎨 描画終了');
    }
    
    /**
     * Phase3: スムーズライン描画（@pixi/graphics-smooth使用）
     */
    drawSmoothLine(point, pressure) {
        if (!this.lastPoint) return;
        
        // 筆圧による線幅調整
        const dynamicSize = this.calculateDynamicBrushSize(pressure);
        
        if (this.smoothGraphicsAvailable) {
            // @pixi/graphics-smooth使用: 高品質スムージング
            this.currentPath.lineStyle(
                dynamicSize,
                this.config.color,
                this.config.opacity,
                0.5,
                false
            );
            
            this.currentPath.lineTo(point.x, point.y);
            
        } else {
            // フォールバック: 基本スムージング
            this.drawBasicSmoothLine(point, pressure);
        }
    }
    
    /**
     * フォールバック: 基本スムージング描画
     */
    drawBasicSmoothLine(point, pressure) {
        if (!this.lastPoint || this.points.length < 2) {
            this.currentPath.lineTo(point.x, point.y);
            return;
        }
        
        // 簡単な2点間補間
        const smoothness = this.config.smoothing;
        const dx = point.x - this.lastPoint.x;
        const dy = point.y - this.lastPoint.y;
        
        const smoothedX = this.lastPoint.x + dx * (1 - smoothness);
        const smoothedY = this.lastPoint.y + dy * (1 - smoothness);
        
        // 筆圧による線幅調整
        const dynamicSize = this.calculateDynamicBrushSize(pressure);
        
        this.currentPath.lineStyle(
            dynamicSize,
            this.config.color,
            this.config.opacity,
            0.5,
            false
        );
        
        this.currentPath.lineTo(smoothedX, smoothedY);
    }
    
    /**
     * 筆圧履歴更新
     */
    updatePressureHistory(pressure) {
        this.pressureHistory.push(pressure);
        
        // 履歴サイズ制限
        if (this.pressureHistory.length > this.maxHistoryLength) {
            this.pressureHistory.shift();
        }
    }
    
    /**
     * 筆圧による動的ブラシサイズ計算
     */
    calculateDynamicBrushSize(pressure = 0.5) {
        const baseBrushSize = this.calculateBrushSize();
        const pressureSensitivity = this.config.pressure;
        
        // 筆圧履歴の平均を使用（スムージング効果）
        const avgPressure = this.pressureHistory.length > 0 ?
            this.pressureHistory.reduce((a, b) => a + b) / this.pressureHistory.length :
            pressure;
        
        // 筆圧感度を適用
        const pressureMultiplier = 1 - pressureSensitivity * (1 - avgPressure);
        
        return Math.max(0.1, baseBrushSize * pressureMultiplier);
    }
    
    /**
     * 基本ブラシサイズ計算
     */
    calculateBrushSize() {
        const validSize = window.CONFIG_VALIDATION?.validateBrushSize(this.config.size) || this.config.size;
        return Math.max(0.1, validSize);
    }
    
    /**
     * イベントから座標取得
     */
    getEventPoint(event) {
        const rect = this.app.view.getBoundingClientRect();
        const scale = this.app.view.width / rect.width; // DPR考慮
        
        let clientX, clientY;
        
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        return {
            x: (clientX - rect.left) * scale,
            y: (clientY - rect.top) * scale
        };
    }
    
    /**
     * イベントから筆圧取得
     */
    extractPressure(event) {
        let pressure = 0.5; // デフォルト
        
        // PointerEvent筆圧
        if (event.pressure !== undefined) {
            pressure = event.pressure;
        }
        // Touch筆圧（一部デバイス）
        else if (event.touches && event.touches.length > 0 && event.touches[0].force !== undefined) {
            pressure = event.touches[0].force;
        }
        
        return Math.max(0.1, Math.min(1.0, pressure));
    }
    
    /**
     * タッチイベント（筆圧対応）
     */
    onTouchStart(event) {
        event.preventDefault();
        this.onPointerDown(event);
    }
    
    onTouchMove(event) {
        event.preventDefault();
        this.onPointerMove(event);
    }
    
    onTouchEnd(event) {
        event.preventDefault();
        this.onPointerUp(event);
    }
    
    /**
     * パス完了処理
     */
    finalizePath() {
        if (!this.currentPath) return;
        
        // 履歴システム統合
        if (window.historyManager && window.historyManager.recordAction) {
            window.historyManager.recordAction({
                type: 'pen-draw',
                target: this.currentPath,
                layer: this.currentLayer
            });
        }
        
        console.log('✅ パス完了・履歴記録');
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        Object.assign(this.config, newSettings);
        console.log('⚙️ ペンツール設定更新:', this.config);
    }
    
    /**
     * 現在の設定取得
     */
    getSettings() {
        return { ...this.config };
    }
    
    /**
     * ツール有効/無効切り替え
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (!enabled && this.isDrawing) {
            // 描画中の強制終了
            this.onPointerUp({ clientX: 0, clientY: 0 });
        }
        
        console.log(`🎨 ペンツール: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * ツールアクティブ状態取得
     */
    isActive() {
        return this.isEnabled && !this.isDrawing;
    }
    
    /**
     * 描画中状態取得
     */
    getDrawingState() {
        return {
            isDrawing: this.isDrawing,
            currentPath: !!this.currentPath,
            pointsCount: this.points.length,
            lastPressure: this.pressureHistory[this.pressureHistory.length - 1] || 0
        };
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            smoothGraphicsAvailable: this.smoothGraphicsAvailable,
            graphicsClass: this.graphicsClass?.name || 'Unknown',
            layerIntegrated: !!this.currentLayer,
            currentSettings: this.config,
            drawingState: this.getDrawingState()
        };
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        console.log('🧹 PenTool クリーンアップ開始...');
        
        // イベントリスナー削除
        const canvas = this.app.view;
        if (canvas) {
            canvas.removeEventListener('pointerdown', this.onPointerDown);
            canvas.removeEventListener('pointermove', this.onPointerMove);
            canvas.removeEventListener('pointerup', this.onPointerUp);
            
            if ('ontouchstart' in window) {
                canvas.removeEventListener('touchstart', this.onTouchStart);
                canvas.removeEventListener('touchmove', this.onTouchMove);
                canvas.removeEventListener('touchend', this.onTouchEnd);
            }
        }
        
        // 描画状態リセット
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        this.points = [];
        this.pressureHistory = [];
        
        console.log('✅ PenTool クリーンアップ完了');
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.PenTool = PenTool;
    
    // デバッグ関数
    window.testSmoothPen = function() {
        console.group('🧪 PenTool @pixi/graphics-smooth導入版 テスト');
        
        if (window.app) {
            const penTool = new PenTool(window.app);
            
            penTool.init().then(success => {
                if (success) {
                    console.log('✅ 初期化成功');
                    console.log('📊 統計:', penTool.getStats());
                    
                    // 設定テスト
                    penTool.updateSettings({ size: 10, opacity: 0.8 });
                    console.log('⚙️ 設定更新テスト完了');
                    
                    // 有効化テスト
                    penTool.setEnabled(true);
                    console.log('🎨 ツール有効化テスト完了');
                } else {
                    console.error('❌ 初期化失敗');
                }
            });
        } else {
            console.warn('⚠️ PixiJS app が利用できません');
        }
        
        console.groupEnd();
    };
    
    console.log('✅ PenTool @pixi/graphics-smooth導入版 読み込み完了');
    console.log('📦 Phase3改修効果:');
    console.log('  ✅ 独自スムージング実装50行 → @pixi/graphics-smooth使用5行に削減');
    console.log('  ✅ applySmoothingFilter メソッド削除（自動処理化）');
    console.log('  ✅ PixiJS標準API使用でAI実装しやすさ向上');
    console.log('  ✅ @pixi/graphics-smooth + フォールバックのハイブリッド対応');
    console.log('  ✅ 既存機能との完全互換性維持');
    console.log('🧪 テスト関数: window.testSmoothPen()');
}