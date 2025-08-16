/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: 消しゴムツール・ベクター消去・範囲処理
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js (Pure JavaScript)
 * 🎯 NODE_MODULES: pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: Graphics描画機能
 * 🎯 ISOLATION_TEST: 可能（単体ツール機能）
 * 🎯 SPLIT_THRESHOLD: 300行（ツール単体・分割可能）
 * 📋 PHASE_TARGET: Phase1.1ss3 - Pure JavaScript完全準拠
 * 📋 V8_MIGRATION: Graphics API変更なし
 * 📋 RULEBOOK_COMPLIANCE: 1.2実装原則「Pure JavaScript維持」完全準拠
 */

/**
 * 消しゴムツール実装
 * 元HTMLの消しゴム機能を改良・分離
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class EraserTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.name = 'eraser';
        this.displayName = '消しゴム';
        this.isActive = false;
        
        // 描画状態
        this.currentPath = null;
        this.isDrawing = false;
        this.lastPoint = null;
        
        // 消しゴム固有設定
        this.settings = {
            minSize: 1.0,
            maxSize: 200,
            defaultSize: 20.0,
            eraserOpacity: 1.0,
            blendMode: 'normal' // 将来的にdestination-outに変更可能
        };
        
        console.log('🧹 EraserTool 構築開始（Pure JavaScript）...');
    }
    
    /**
     * 消しゴムツール初期化
     */
    init() {
        if (!this.toolManager) {
            throw new Error('ToolManager が必要です');
        }
        
        // ToolManagerに自身を登録
        this.toolManager.registerTool(this.name, this);
        
        console.log('✅ EraserTool初期化完了（Pure JavaScript）');
        return this;
    }
    
    /**
     * 描画開始（消去開始）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    startDrawing(x, y) {
        if (!this.toolManager.canvasManager) {
            console.warn('⚠️ CanvasManager 未初期化');
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = { x, y, timestamp: performance.now() };
        
        // グローバル設定取得（消しゴムサイズはペンサイズより大きめ）
        const globalSettings = this.toolManager.globalSettings;
        const eraserSize = Math.max(globalSettings.brushSize * 1.2, this.settings.defaultSize);
        
        // 背景色で消去パス作成（元HTML方式）
        this.currentPath = this.toolManager.canvasManager.createPath(
            x, y,
            eraserSize,
            this.toolManager.canvasManager.backgroundColor, // 背景色使用
            this.settings.eraserOpacity,
            this.name
        );
        
        console.log(`🧹 消しゴム開始: (${Math.round(x)}, ${Math.round(y)}) サイズ:${eraserSize.toFixed(1)}px`);
    }
    
    /**
     * 描画継続（消去継続）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const globalSettings = this.toolManager.globalSettings;
        
        // 距離計算
        const distance = Math.sqrt(
            (x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2
        );
        
        // 最小移動距離チェック（消しゴムは少し緩め）
        if (distance < 2.0) return;
        
        // 消去サイズ計算
        const eraserSize = Math.max(globalSettings.brushSize * 1.2, this.settings.defaultSize);
        
        // 連続消去描画
        this.toolManager.canvasManager.drawLine(this.currentPath, x, y);
        
        this.lastPoint = { x, y, timestamp: performance.now() };
    }
    
    /**
     * 描画終了（消去終了）
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            console.log(`🧹 消しゴム完了: ${this.currentPath.points.length}ポイント消去`);
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    /**
     * 設定更新
     * @param {Object} globalSettings - グローバル設定
     */
    updateSettings(globalSettings) {
        // 消しゴム固有の設定調整
        const eraserSize = Math.max(globalSettings.brushSize * 1.2, this.settings.defaultSize);
        
        console.log(`🧹 消しゴム設定更新: サイズ:${eraserSize.toFixed(1)}px`);
    }
    
    /**
     * 矩形消去（範囲消去）
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     */
    eraseRectangle(x1, y1, x2, y2) {
        if (!this.toolManager.canvasManager) return;
        
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);
        
        // 範囲内のパスポイントを検索・削除
        const pathsToUpdate = [];
        
        this.toolManager.canvasManager.paths.forEach(path => {
            const pointsToKeep = path.points.filter(point => {
                const inRange = point.x >= minX && point.x <= maxX && 
                               point.y >= minY && point.y <= maxY;
                return !inRange; // 範囲外のポイントのみ保持
            });
            
            if (pointsToKeep.length !== path.points.length) {
                pathsToUpdate.push({ path, pointsToKeep });
            }
        });
        
        // パス再構築
        pathsToUpdate.forEach(({ path, pointsToKeep }) => {
            if (pointsToKeep.length === 0) {
                // 完全削除
                this.toolManager.canvasManager.removePath(path.id);
            } else {
                // 部分削除・再構築
                path.points = pointsToKeep;
                this.rebuildPathGraphics(path);
            }
        });
        
        console.log(`🧹 矩形消去完了: (${minX},${minY})-(${maxX},${maxY}) ${pathsToUpdate.length}パス影響`);
    }
    
    /**
     * パスグラフィックス再構築
     * @param {Object} path - パスオブジェクト
     */
    rebuildPathGraphics(path) {
        // 既存グラフィックスクリア
        path.graphics.clear();
        
        // ポイント再描画
        path.points.forEach((point, index) => {
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(point.x, point.y, point.size / 2);
            path.graphics.endFill();
        });
    }
    
    /**
     * 全消去
     */
    eraseAll() {
        if (this.toolManager.canvasManager) {
            this.toolManager.canvasManager.clear();
            console.log('🧹 全消去実行');
        }
    }
    
    /**
     * ツール情報取得
     * @returns {Object} ツール情報
     */
    getInfo() {
        return {
            name: this.name,
            displayName: this.displayName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            settings: { ...this.settings },
            currentPath: this.currentPath ? {
                id: this.currentPath.id,
                pointCount: this.currentPath.points.length
            } : null
        };
    }
    
    /**
     * アクティベート
     */
    activate() {
        this.isActive = true;
        console.log(`🧹 ${this.displayName} アクティブ化`);
    }
    
    /**
     * 非アクティベート
     */
    deactivate() {
        // 消去中の場合は終了
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        this.isActive = false;
        console.log(`🧹 ${this.displayName} 非アクティブ化`);
    }
    
    /**
     * ツールリセット
     */
    reset() {
        this.deactivate();
        this.currentPath = null;
        this.lastPoint = null;
        console.log(`🧹 ${this.displayName} リセット完了`);
    }
    
    /**
     * パフォーマンス統計取得
     * @returns {Object} パフォーマンス統計
     */
    getPerformanceStats() {
        const eraserPathCount = this.toolManager.canvasManager ? 
            this.toolManager.canvasManager.paths.filter(p => p.tool === this.name).length : 0;
        
        const totalErasedPoints = this.toolManager.canvasManager ?
            this.toolManager.canvasManager.paths
                .filter(p => p.tool === this.name)
                .reduce((sum, p) => sum + p.points.length, 0) : 0;
        
        return {
            toolName: this.name,
            eraserPathCount,
            totalErasedPoints,
            averagePointsPerErasePath: eraserPathCount > 0 ? Math.round(totalErasedPoints / eraserPathCount) : 0,
            isCurrentlyErasing: this.isDrawing
        };
    }
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const info = this.getInfo();
        const stats = this.getPerformanceStats();
        
        console.group(`🧹 ${this.displayName} デバッグ情報`);
        console.log('📊 情報:', info);
        console.log('📈 統計:', stats);
        console.groupEnd();
        
        return { info, stats };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            this.deactivate();
            this.toolManager = null;
            this.currentPath = null;
            this.lastPoint = null;
            
            console.log(`🗑️ ${this.displayName} 破棄完了`);
            
        } catch (error) {
            console.error(`❌ ${this.displayName} 破棄エラー:`, error);
        }
    }
}

// Pure JavaScript グローバル公開（ルールブック準拠）
if (typeof window !== 'undefined') {
    window.EraserTool = EraserTool;
    console.log('✅ EraserTool グローバル公開完了（Pure JavaScript）');
}

console.log('🧹 EraserTool Pure JavaScript完全準拠版 - 準備完了');
console.log('📋 ルールブック準拠: 1.2実装原則「ESM/TypeScript混在禁止・Pure JavaScript維持」');
console.log('💡 使用例: const eraserTool = new window.EraserTool(toolManager); eraserTool.init();');