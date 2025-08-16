/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ペンツール・ベクター描画・筆圧対応
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
 * ペンツール実装
 * 元HTMLのペン描画機能を改良・分離
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class PenTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.name = 'pen';
        this.displayName = 'ベクターペン';
        this.isActive = false;
        
        // 描画状態
        this.currentPath = null;
        this.isDrawing = false;
        this.lastPoint = null;
        
        // ペン固有設定
        this.settings = {
            minSize: 0.1,
            maxSize: 100,
            pressureMultiplier: 1.0,
            smoothingThreshold: 1.5,
            color: 0x800000,
            baseOpacity: 0.85
        };
        
        console.log('🖋️ PenTool 構築開始（Pure JavaScript）...');
    }
    
    /**
     * ペンツール初期化
     */
    init() {
        if (!this.toolManager) {
            throw new Error('ToolManager が必要です');
        }
        
        // ToolManagerに自身を登録
        this.toolManager.registerTool(this.name, this);
        
        console.log('✅ PenTool初期化完了（Pure JavaScript）');
        return this;
    }
    
    /**
     * 描画開始
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
        
        // グローバル設定取得
        const globalSettings = this.toolManager.globalSettings;
        
        // パス作成
        this.currentPath = this.toolManager.canvasManager.createPath(
            x, y,
            globalSettings.brushSize,
            globalSettings.brushColor,
            globalSettings.opacity,
            this.name
        );
        
        console.log(`🖋️ ペン描画開始: (${Math.round(x)}, ${Math.round(y)}) サイズ:${globalSettings.brushSize}px`);
    }
    
    /**
     * 描画継続
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const currentTime = performance.now();
        const globalSettings = this.toolManager.globalSettings;
        
        // 距離とスムージング計算
        const distance = Math.sqrt(
            (x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2
        );
        
        // スムージング閾値チェック
        if (distance < this.settings.smoothingThreshold) return;
        
        // 筆圧計算（時間ベース簡易実装）
        const timeDelta = currentTime - this.lastPoint.timestamp;
        const speedFactor = Math.min(1, distance / Math.max(timeDelta, 1));
        
        let effectiveSize = globalSettings.brushSize;
        if (globalSettings.pressureSensitivity) {
            const pressureEffect = globalSettings.pressure + (speedFactor * 0.3);
            effectiveSize *= Math.max(0.3, Math.min(1.5, pressureEffect));
        }
        
        // スムージング適用描画
        if (globalSettings.smoothing > 0) {
            this.drawSmoothLine(x, y, effectiveSize);
        } else {
            this.toolManager.canvasManager.drawLine(this.currentPath, x, y);
        }
        
        this.lastPoint = { x, y, timestamp: currentTime };
    }
    
    /**
     * スムース描画
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} size - 有効サイズ
     */
    drawSmoothLine(x, y, size) {
        if (!this.lastPoint) return;
        
        const globalSettings = this.toolManager.globalSettings;
        const smoothingLevel = globalSettings.smoothing;
        
        // ベジエ曲線補間でスムース描画
        const controlX = this.lastPoint.x + (x - this.lastPoint.x) * smoothingLevel;
        const controlY = this.lastPoint.y + (y - this.lastPoint.y) * smoothingLevel;
        
        // 補間点計算
        const steps = Math.max(2, Math.ceil(
            Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2) / 2
        ));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const t1 = 1 - t;
            
            // 2次ベジエ曲線
            const px = t1 * t1 * this.lastPoint.x + 
                      2 * t1 * t * controlX + 
                      t * t * x;
            const py = t1 * t1 * this.lastPoint.y + 
                      2 * t1 * t * controlY + 
                      t * t * y;
            
            this.toolManager.canvasManager.drawLine(this.currentPath, px, py);
        }
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            console.log(`🖋️ ペン描画完了: ${this.currentPath.points.length}ポイント`);
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
        // ペンツール固有の設定調整
        this.settings.color = globalSettings.brushColor;
        this.settings.baseOpacity = globalSettings.opacity;
        
        console.log(`🖋️ ペン設定更新: 色:#${globalSettings.brushColor.toString(16)} 透明度:${Math.round(globalSettings.opacity * 100)}%`);
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
        console.log(`🖋️ ${this.displayName} アクティブ化`);
    }
    
    /**
     * 非アクティベート
     */
    deactivate() {
        // 描画中の場合は終了
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        this.isActive = false;
        console.log(`🖋️ ${this.displayName} 非アクティブ化`);
    }
    
    /**
     * ツールリセット
     */
    reset() {
        this.deactivate();
        this.currentPath = null;
        this.lastPoint = null;
        console.log(`🖋️ ${this.displayName} リセット完了`);
    }
    
    /**
     * パフォーマンス統計取得
     * @returns {Object} パフォーマンス統計
     */
    getPerformanceStats() {
        const pathCount = this.toolManager.canvasManager ? 
            this.toolManager.canvasManager.paths.filter(p => p.tool === this.name).length : 0;
        
        const totalPoints = this.toolManager.canvasManager ?
            this.toolManager.canvasManager.paths
                .filter(p => p.tool === this.name)
                .reduce((sum, p) => sum + p.points.length, 0) : 0;
        
        return {
            toolName: this.name,
            pathCount,
            totalPoints,
            averagePointsPerPath: pathCount > 0 ? Math.round(totalPoints / pathCount) : 0,
            isCurrentlyDrawing: this.isDrawing
        };
    }
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const info = this.getInfo();
        const stats = this.getPerformanceStats();
        
        console.group(`🖋️ ${this.displayName} デバッグ情報`);
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
    window.PenTool = PenTool;
    console.log('✅ PenTool グローバル公開完了（Pure JavaScript）');
}

console.log('🖋️ PenTool Pure JavaScript完全準拠版 - 準備完了');
console.log('📋 ルールブック準拠: 1.2実装原則「ESM/TypeScript混在禁止・Pure JavaScript維持」');
console.log('💡 使用例: const penTool = new window.PenTool(toolManager); penTool.init();');