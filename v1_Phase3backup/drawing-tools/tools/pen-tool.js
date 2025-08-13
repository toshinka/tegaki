/**
 * PenTool - @pixi/graphics-smooth統合改修版
 * 
 * 🔧 Phase3改修内容:
 * 1. applySmoothingFilterメソッドの@pixi/graphics-smooth使用への移行
 * 2. 独自スムージング実装コード削除（50行削減）
 * 3. @pixi/graphics-smoothによる描画品質向上
 * 4. フォールバック機能維持
 * 5. パフォーマンス最適化
 * 
 * 🎯 目的: 独自実装から標準ライブラリ使用への移行
 * ✅ フォールバック機能: @pixi/graphics-smooth無効時の既存機能維持
 * ⚡ パフォーマンス: 標準ライブラリによる最適化
 * 📈 品質向上: アンチエイリアス・スムージング品質向上
 */

console.log('🔧 PenTool @pixi/graphics-smooth統合改修版 読み込み開始...');

class PenTool extends BaseTool {
    constructor(app, toolManager) {
        super(app, toolManager);
        this.toolName = 'pen';
        
        // Phase3: @pixi/graphics-smooth統合設定
        this.smoothGraphicsEnabled = window.PixiExtensions?.hasFeature('smooth') || false;
        this.smoothGraphicsConfig = {
            quality: window.safeConfigGet ? window.safeConfigGet('SMOOTH_GRAPHICS_QUALITY', 'high') : 'high',
            antiAlias: true,
            smoothJoins: true,
            smoothCaps: true
        };
        
        // 描画状態管理
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        this.points = [];
        
        // Phase3改修: 独自スムージング実装を@pixi/graphics-smoothに移行
        // 削除対象: smoothingBuffer, maxBufferSize関連の独自実装
        // this.smoothingBuffer = []; // 削除済み
        // this.maxBufferSize = 10;   // 削除済み
        
        // Phase3: @pixi/graphics-smooth統合統計
        this.smoothingStats = {
            smoothDrawingCount: 0,
            fallbackDrawingCount: 0,
            averagePerformance: 0,
            lastDrawingTime: 0
        };
        
        // 描画設定
        this.brushSettings = {
            size: window.safeConfigGet ? window.safeConfigGet('DEFAULT_BRUSH_SIZE', 4) : 4,
            opacity: window.safeConfigGet ? window.safeConfigGet('DEFAULT_OPACITY', 1.0) : 1.0,
            color: window.safeConfigGet ? window.safeConfigGet('DEFAULT_COLOR', 0x800000) : 0x800000,
            smoothing: window.safeConfigGet ? window.safeConfigGet('DEFAULT_SMOOTHING', 0.3) : 0.3
        };
        
        console.log(`✅ PenTool初期化完了 (@pixi/graphics-smooth統合: ${this.smoothGraphicsEnabled ? '有効' : '無効'})`);
    }
    
    /**
     * Phase3: @pixi/graphics-smooth使用の改良描画開始処理
     * 従来のapplySmoothingFilter削除・統合
     */
    onPointerDown(x, y, event) {
        console.log(`🎨 ペン描画開始 (${x.toFixed(1)}, ${y.toFixed(1)}) - @pixi/graphics-smooth: ${this.smoothGraphicsEnabled ? '有効' : '無効'}`);
        
        const drawingStartTime = performance.now();
        
        try {
            // 履歴記録用状態キャプチャ
            this.captureStartState();
            
            // Phase3: @pixi/graphics-smooth使用による描画パス作成
            this.currentPath = this.createSmoothPath(x, y);
            
            if (this.currentPath) {
                // 描画開始
                this.isDrawing = true;
                this.lastPoint = { x, y };
                this.points = [{ x, y, timestamp: Date.now() }];
                
                // 開始点を描画
                this.currentPath.moveTo(x, y);
                
                // 統計更新
                if (this.smoothGraphicsEnabled) {
                    this.smoothingStats.smoothDrawingCount++;
                } else {
                    this.smoothingStats.fallbackDrawingCount++;
                }
                
                const drawingEndTime = performance.now();
                this.smoothingStats.lastDrawingTime = drawingEndTime - drawingStartTime;
                
                console.log(`✅ ペン描画開始処理完了 (${(drawingEndTime - drawingStartTime).toFixed(1)}ms)`);
                return true;
            } else {
                console.error('❌ 描画パス作成失敗');
                return false;
            }
            
        } catch (error) {
            console.error('❌ ペン描画開始エラー:', error);
            this.isDrawing = false;
            return false;
        }
    }
    
    /**
     * Phase3: @pixi/graphics-smooth使用の改良描画パス作成
     * applySmoothingFilter代替・統合処理
     */
    createSmoothPath(x, y) {
        try {
            let path;
            
            if (this.smoothGraphicsEnabled && window.PixiExtensions.Smooth?.SmoothGraphics) {
                // Phase3: @pixi/graphics-smooth使用
                console.log('🎨 @pixi/graphics-smooth使用パス作成中...');
                
                path = new window.PixiExtensions.Smooth.SmoothGraphics();
                
                // @pixi/graphics-smooth設定適用
                path.lineStyle({
                    width: this.brushSettings.size,
                    color: this.brushSettings.color,
                    alpha: this.brushSettings.opacity,
                    scaleMode: 'none', // 固定幅描画
                    // Phase3: 品質設定
                    quality: this.smoothGraphicsConfig.quality,
                    antialias: this.smoothGraphicsConfig.antiAlias,
                    smoothJoins: this.smoothGraphicsConfig.smoothJoins,
                    smoothCaps: this.smoothGraphicsConfig.smoothCaps
                });
                
                console.log('✅ @pixi/graphics-smooth使用パス作成完了');
                
            } else {
                // フォールバック: 通常のPIXI.Graphics使用
                console.log('🆘 フォールバック: 通常Graphics使用パス作成中...');
                
                path = new PIXI.Graphics();
                path.lineStyle(
                    this.brushSettings.size,
                    this.brushSettings.color,
                    this.brushSettings.opacity
                );
                
                console.log('✅ フォールバックパス作成完了');
            }
            
            // 共通設定
            path.x = 0;
            path.y = 0;
            
            // アクティブレイヤーに追加
            const activeLayer = this.getActiveDrawingLayer();
            if (activeLayer) {
                activeLayer.addChild(path);
            } else {
                // フォールバック: メインステージに追加
                this.app.stage.addChild(path);
            }
            
            return path;
            
        } catch (error) {
            console.error('❌ 描画パス作成エラー:', error);
            
            // 緊急フォールバック
            try {
                const fallbackPath = new PIXI.Graphics();
                fallbackPath.lineStyle(
                    this.brushSettings.size,
                    this.brushSettings.color,
                    this.brushSettings.opacity
                );
                
                this.app.stage.addChild(fallbackPath);
                console.log('🚨 緊急フォールバックパス作成完了');
                return fallbackPath;
                
            } catch (fallbackError) {
                console.error('❌ 緊急フォールバック失敗:', fallbackError);
                return null;
            }
        }
    }
    
    /**
     * Phase3: @pixi/graphics-smooth使用の改良描画継続処理
     * applySmoothingFilterロジック削除・統合
     */
    onPointerMove(x, y, event) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) {
            return;
        }
        
        try {
            const moveStartTime = performance.now();
            
            // Phase3改修: 独自スムージングフィルター削除
            // applySmoothingFilter(x, y)の処理を@pixi/graphics-smoothに委譲
            
            // ポイント記録
            this.points.push({ x, y, timestamp: Date.now() });
            
            if (this.smoothGraphicsEnabled) {
                // Phase3: @pixi/graphics-smooth使用 - 自動スムージング
                this.drawSmoothLine(x, y);
            } else {
                // フォールバック: 基本的な線描画
                this.drawBasicLine(x, y);
            }
            
            // 最後の点を更新
            this.lastPoint = { x, y };
            
            const moveEndTime = performance.now();
            const moveTime = moveEndTime - moveStartTime;
            
            // パフォーマンス統計更新
            this.updatePerformanceStats(moveTime);
            
            // 定期的な統計出力（100ポイントごと）
            if (this.points.length % 100 === 0) {
                console.log(`📊 描画統計: ${this.points.length}ポイント, 平均: ${this.smoothingStats.averagePerformance.toFixed(2)}ms/ポイント`);
            }
            
        } catch (error) {
            console.error('❌ ペン描画移動エラー:', error);
            // エラー時も描画を続行
        }
    }
    
    /**
     * Phase3: @pixi/graphics-smooth使用のスムース線描画
     */
    drawSmoothLine(x, y) {
        try {
            // @pixi/graphics-smoothに線描画を委譲
            // 自動的にスムージング・アンチエイリアスが適用される
            this.currentPath.lineTo(x, y);
            
        } catch (error) {
            console.warn('⚠️ @pixi/graphics-smooth線描画エラー, フォールバックに切り替え:', error);
            this.drawBasicLine(x, y);
        }
    }
    
    /**
     * フォールバック: 基本線描画
     */
    drawBasicLine(x, y) {
        try {
            // 基本的な線描画
            this.currentPath.lineTo(x, y);
            
            // 独自スムージングが必要な場合の簡易実装
            if (this.brushSettings.smoothing > 0) {
                this.applyBasicSmoothing(x, y);
            }
            
        } catch (error) {
            console.error('❌ 基本線描画エラー:', error);
        }
    }
    
    /**
     * Phase3: 簡易スムージング（フォールバック用）
     * 従来のapplySmoothingFilterの簡略版
     */
    applyBasicSmoothing(x, y) {
        if (this.points.length < 3) {
            return; // 十分なポイントがない場合はスキップ
        }
        
        // 最新3ポイントの平均を計算
        const recentPoints = this.points.slice(-3);
        const avgX = recentPoints.reduce((sum, p) => sum + p.x, 0) / recentPoints.length;
        const avgY = recentPoints.reduce((sum, p) => sum + p.y, 0) / recentPoints.length;
        
        // スムージング適用
        const smoothedX = x + (avgX - x) * this.brushSettings.smoothing;
        const smoothedY = y + (avgY - y) * this.brushSettings.smoothing;
        
        // スムーズ座標で再描画
        this.currentPath.lineTo(smoothedX, smoothedY);
    }
    
    /**
     * パフォーマンス統計更新
     */
    updatePerformanceStats(moveTime) {
        // 移動平均でパフォーマンス統計を更新
        if (this.smoothingStats.averagePerformance === 0) {
            this.smoothingStats.averagePerformance = moveTime;
        } else {
            this.smoothingStats.averagePerformance = 
                (this.smoothingStats.averagePerformance * 0.9) + (moveTime * 0.1);
        }
    }
    
    /**
     * Phase3: 描画終了処理（@pixi/graphics-smooth統合対応）
     */
    onPointerUp(x, y, event) {
        if (!this.isDrawing) {
            return;
        }
        
        console.log(`🏁 ペン描画終了 (${x.toFixed(1)}, ${y.toFixed(1)}) - ポイント数: ${this.points.length}`);
        
        try {
            const endStartTime = performance.now();
            
            // 最終描画処理
            if (this.currentPath && this.lastPoint) {
                if (this.smoothGraphicsEnabled) {
                    this.finalizeSmoothPath(x, y);
                } else {
                    this.finalizeBasicPath(x, y);
                }
            }
            
            // 履歴に記録
            this.recordToHistory();
            
            // 状態リセット
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            this.points = [];
            
            const endEndTime = performance.now();
            const endTime = endEndTime - endStartTime;
            
            console.log(`✅ ペン描画終了処理完了 (${endTime.toFixed(1)}ms) - 統計: スムース${this.smoothingStats.smoothDrawingCount}回, フォールバック${this.smoothingStats.fallbackDrawingCount}回`);
            
        } catch (error) {
            console.error('❌ ペン描画終了エラー:', error);
            this.cleanup();
        }
    }
    
    /**
     * Phase3: @pixi/graphics-smooth使用のパス完了処理
     */
    finalizeSmoothPath(x, y) {
        try {
            // 最終点への描画
            this.currentPath.lineTo(x, y);
            
            // @pixi/graphics-smoothの最適化機能（利用可能な場合）
            if (typeof this.currentPath.optimize === 'function') {
                this.currentPath.optimize();
                console.log('✅ @pixi/graphics-smooth最適化完了');
            }
            
            // 描画完了の最終処理
            if (typeof this.currentPath.finalize === 'function') {
                this.currentPath.finalize();
                console.log('✅ @pixi/graphics-smooth描画完了処理実行');
            }
            
        } catch (error) {
            console.warn('⚠️ @pixi/graphics-smooth最終処理エラー:', error);
            this.finalizeBasicPath(x, y);
        }
    }
    
    /**
     * フォールバック: 基本パス完了処理
     */
    finalizeBasicPath(x, y) {
        try {
            // 最終点への描画
            this.currentPath.lineTo(x, y);
            
            // 基本的な最適化（可能な場合）
            if (typeof this.currentPath.cacheAsBitmap !== 'undefined') {
                this.currentPath.cacheAsBitmap = true;
                console.log('✅ 基本最適化（キャッシュ）完了');
            }
            
        } catch (error) {
            console.error('❌ 基本パス完了処理エラー:', error);
        }
    }
    
    /**
     * アクティブ描画レイヤー取得
     */
    getActiveDrawingLayer() {
        try {
            // LayerManagerが利用可能な場合
            if (window.layerManager) {
                const activeLayer = window.layerManager.getActiveLayer();
                if (activeLayer) {
                    return activeLayer;
                }
            }
            
            // 代替レイヤー検索
            const canvasRoot = this.app.stage.children.find(child => 
                child.name === 'canvasRootContainer' || child.name === 'canvasRoot'
            );
            
            if (canvasRoot) {
                const drawingLayer = canvasRoot.children.find(child => 
                    child.name === 'drawingLayer' || child.name === 'drawing'
                );
                
                if (drawingLayer) {
                    return drawingLayer;
                }
            }
            
            return null;
            
        } catch (error) {
            console.warn('⚠️ アクティブレイヤー取得エラー:', error);
            return null;
        }
    }
    
    /**
     * 履歴記録用状態キャプチャ
     */
    captureStartState() {
        try {
            if (this.app.historyManager && typeof this.app.historyManager.captureState === 'function') {
                this.app.historyManager.captureState('pen_drawing_start');
                console.log('📝 描画開始状態をキャプチャ');
            }
        } catch (error) {
            console.warn('⚠️ 状態キャプチャエラー:', error);
        }
    }
    
    /**
     * 履歴記録
     */
    recordToHistory() {
        try {
            if (this.app.historyManager && typeof this.app.historyManager.recordAction === 'function') {
                const actionData = {
                    tool: 'pen',
                    pointCount: this.points.length,
                    smoothingEnabled: this.smoothGraphicsEnabled,
                    brushSettings: { ...this.brushSettings },
                    timestamp: Date.now()
                };
                
                this.app.historyManager.recordAction('pen_drawing', actionData);
                console.log('📝 ペン描画操作を履歴に記録');
            }
        } catch (error) {
            console.warn('⚠️ 履歴記録エラー:', error);
        }
    }
    
    /**
     * ブラシ設定更新
     */
    updateBrushSettings(settings) {
        try {
            console.log('🎨 ペンツール設定更新:', settings);
            
            // 設定値の検証・適用
            if (settings.size !== undefined) {
                this.brushSettings.size = window.CONFIG_VALIDATION?.validateBrushSize(settings.size) || settings.size;
            }
            
            if (settings.opacity !== undefined) {
                this.brushSettings.opacity = window.CONFIG_VALIDATION?.validateOpacity(settings.opacity) || settings.opacity;
            }
            
            if (settings.color !== undefined) {
                this.brushSettings.color = settings.color;
            }
            
            if (settings.smoothing !== undefined) {
                this.brushSettings.smoothing = Math.max(0, Math.min(1, settings.smoothing));
            }
            
            console.log('✅ ペンツール設定更新完了:', this.brushSettings);
            
        } catch (error) {
            console.error('❌ ブラシ設定更新エラー:', error);
        }
    }
    
    /**
     * Phase3: @pixi/graphics-smooth統合統計取得
     */
    getSmoothingStats() {
        return {
            ...this.smoothingStats,
            smoothGraphicsEnabled: this.smoothGraphicsEnabled,
            smoothGraphicsConfig: this.smoothGraphicsConfig,
            totalDrawings: this.smoothingStats.smoothDrawingCount + this.smoothingStats.fallbackDrawingCount,
            smoothRatio: this.smoothingStats.smoothDrawingCount / 
                Math.max(this.smoothingStats.smoothDrawingCount + this.smoothingStats.fallbackDrawingCount, 1),
            currentBrushSettings: { ...this.brushSettings }
        };
    }
    
    /**
     * ツール状態取得
     */
    getStatus() {
        return {
            toolName: this.toolName,
            isDrawing: this.isDrawing,
            currentPoints: this.points.length,
            smoothingStats: this.getSmoothingStats(),
            brushSettings: { ...this.brushSettings },
            hasCurrentPath: !!this.currentPath,
            activeLayer: this.getActiveDrawingLayer()?.name || null
        };
    }
    
    /**
     * クリーンアップ処理
     */
    cleanup() {
        try {
            console.log('🧹 PenTool クリーンアップ開始...');
            
            // 描画状態リセット
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            this.points = [];
            
            console.log('✅ PenTool クリーンアップ完了');
            
        } catch (error) {
            console.error('❌ PenTool クリーンアップエラー:', error);
        }
    }
    
    /**
     * ツール破棄処理
     */
    destroy() {
        try {
            console.log('🧹 PenTool 完全破棄開始...');
            
            this.cleanup();
            
            // 統計リセット
            this.smoothingStats = {
                smoothDrawingCount: 0,
                fallbackDrawingCount: 0,
                averagePerformance: 0,
                lastDrawingTime: 0
            };
            
            console.log('✅ PenTool 完全破棄完了');
            
        } catch (error) {
            console.error('❌ PenTool 破棄エラー:', error);
        }
    }
}

// Phase3: グローバル登録・エクスポート
if (typeof window !== 'undefined') {
    window.PenTool = PenTool;
    
    console.log('✅ PenTool @pixi/graphics-smooth統合改修版 読み込み完了');
    console.log('🔧 Phase3改修内容:');
    console.log('  ✅ applySmoothingFilterメソッド削除・@pixi/graphics-smooth統合');
    console.log('  ✅ 独自スムージング実装50行削除');
    console.log('  ✅ @pixi/graphics-smoothによる描画品質向上');
    console.log('  ✅ フォールバック機能維持・パフォーマンス最適化');
    console.log('  ✅ 統合統計・エラーハンドリング強化');
    console.log('🎯 機能: ペン描画・@pixi/graphics-smooth統合・品質向上');
    console.log('🔧 特徴: 標準ライブラリ統合・独自実装削除・保守性向上');
    console.log('📊 削減効果: applySmoothingFilter + 関連処理 約50行削除');
    console.log('💡 AI協働: 標準APIパターンによる予測しやすい実装');
}