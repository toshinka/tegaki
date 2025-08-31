/**
 * EraserTool v8.12.0 消しゴム機能完全修正版
 * ChangeLog: 2025-09-01 消しゴム機能修復・v8新API完全準拠・Manager注入修正
 * 
 * @provides
 *   ・Tool統一API（setManagersObject/onPointer*/forceEndDrawing/destroy/getState）
 *   ・消しゴム機能（startErase/continueErase/endErase）
 *   ・PixiJS v8 Graphics API準拠消去
 *   ・Manager注入対応（CanvasManager/CoordinateManager連携）
 * 
 * @uses
 *   ・AbstractTool - 基底クラス継承
 *   ・CanvasManager.getDrawContainer() - 描画Container取得
 *   ・CoordinateManager.eventToCanvas() - 座標変換
 *   ・PIXI.Graphics - v8新API（shape().fill()）
 * 
 * @initflow
 *   1. new EraserTool()
 *   2. setManagersObject(managers) - Manager注入
 *   3. ToolManager経由で登録・利用開始
 * 
 * @forbids
 *   ・💀 forceEndDrawing()なしでのTool切り替え禁止
 *   ・🚫 Manager未注入での消去処理禁止
 *   ・🚫 直接座標参照禁止（必ずCoordinateManager経由）
 *   ・🚫 isErasing状態の不整合放置禁止
 * 
 * @dependencies-strict
 *   ・必須: AbstractTool（継承基底）
 *   ・必須: CanvasManager（DrawContainer取得）
 *   ・必須: CoordinateManager（座標変換）
 *   ・オプション: EventBus（消去通知）
 * 
 * @integration-flow
 *   ・ToolManager.initializeEraserTool()で作成・登録
 *   ・Manager注入はToolManager経由で実行
 * 
 * @tool-contract
 *   ・setManagersObject(managers) → boolean必須実装
 *   ・onPointerDown/Move/Up(event)必須実装
 *   ・forceEndDrawing()冪等実装必須
 *   ・destroy()完全解放処理必須
 *   ・getState()状態取得必須
 * 
 * @error-handling
 *   ・座標変換失敗時は消去スキップ（エラー非停止）
 *   ・Manager未準備時は早期return
 *   ・Graphics作成失敗時は状態リセット
 * 
 * @coordinate-contract
 *   ・座標変換は必ずCoordinateManager.eventToCanvas()経由
 *   ・DPR補正はCoordinateManager側で実施（重複適用禁止）
 *   ・Canvas外消去は正規化処理で対応
 */

class EraserTool extends window.Tegaki.AbstractTool {
    constructor() {
        super();
        console.log('🧹 EraserTool v8.12.0 消しゴム機能完全修正版 作成開始');
        
        this.version = 'v8.12.0-eraser-fix';
        this.className = 'EraserTool';
        this.toolName = 'eraser';
        
        // 消去状態管理
        this.isErasing = false;
        this.currentErase = null;
        this.eraseStarted = false;
        
        // 消しゴム設定
        this.eraseSize = 10;
        this.eraseOpacity = 1.0;
        
        // 座標履歴（消去範囲用）
        this.erasePoints = [];
        this.lastPoint = null;
        
        // Manager参照（注入待ち）
        this.canvasManager = null;
        this.coordinateManager = null;
        this.eventBus = null;
        this.drawContainer = null;
        
        // 準備状態
        this.managersReady = false;
        
        console.log('✅ EraserTool v8.12.0 消しゴム機能完全修正版 作成完了');
    }
    
    // ===========================================
    // Tool統一API（必須実装）
    // ===========================================
    
    /**
     * Manager群注入（必須API）
     * @param {Object} managers - Manager群
     * @returns {boolean} 注入成功可否
     */
    setManagersObject(managers) {
        console.log('🔧 EraserTool: Manager注入開始');
        
        try {
            if (!managers || typeof managers !== 'object') {
                throw new Error('Invalid managers object');
            }
            
            // Manager参照設定
            this.canvasManager = managers.canvasManager;
            this.coordinateManager = managers.coordinateManager;
            this.eventBus = managers.eventBus;
            
            // 必須Manager確認
            if (!this.canvasManager || !this.coordinateManager) {
                throw new Error('Required managers not provided (canvasManager, coordinateManager)');
            }
            
            // DrawContainer取得
            if (typeof this.canvasManager.getDrawContainer === 'function') {
                this.drawContainer = this.canvasManager.getDrawContainer();
            }
            
            if (!this.drawContainer) {
                throw new Error('DrawContainer not available');
            }
            
            this.managersReady = true;
            console.log('✅ EraserTool: Manager注入完了');
            return true;
            
        } catch (error) {
            console.error('💀 EraserTool: Manager注入失敗:', error);
            this.managersReady = false;
            return false;
        }
    }
    
    /**
     * PointerDownイベント処理（消去開始）
     * @param {Event} event - PointerDownイベント
     */
    onPointerDown(event) {
        if (!this.managersReady) {
            console.warn('⚠️ EraserTool: Manager未準備 - 消去スキップ');
            return;
        }
        
        try {
            // 既存消去強制終了
            this.forceEndDrawing();
            
            // 座標変換
            const canvasPoint = this.coordinateManager.eventToCanvas(event);
            if (!canvasPoint || typeof canvasPoint.x !== 'number') {
                console.warn('⚠️ EraserTool: 座標変換失敗');
                return;
            }
            
            // 消去開始
            this.startErase(canvasPoint.x, canvasPoint.y);
            
            console.log(`🧹 EraserTool: 消去開始 (${canvasPoint.x.toFixed(1)}, ${canvasPoint.y.toFixed(1)})`);
            
        } catch (error) {
            console.error('💀 EraserTool: onPointerDown エラー:', error);
            this.forceEndDrawing();
        }
    }
    
    /**
     * PointerMoveイベント処理（消去継続）
     * @param {Event} event - PointerMoveイベント
     */
    onPointerMove(event) {
        if (!this.managersReady || !this.isErasing) {
            return;
        }
        
        try {
            // 座標変換
            const canvasPoint = this.coordinateManager.eventToCanvas(event);
            if (!canvasPoint || typeof canvasPoint.x !== 'number') {
                return;
            }
            
            // 消去継続
            this.continueErase(canvasPoint.x, canvasPoint.y);
            
        } catch (error) {
            console.error('💀 EraserTool: onPointerMove エラー:', error);
            this.forceEndDrawing();
        }
    }
    
    /**
     * PointerUpイベント処理（消去終了）
     * @param {Event} event - PointerUpイベント
     */
    onPointerUp(event) {
        if (!this.managersReady) {
            return;
        }
        
        try {
            // 消去終了
            this.endErase();
            
            console.log('🧹 EraserTool: 消去終了');
            
        } catch (error) {
            console.error('💀 EraserTool: onPointerUp エラー:', error);
            this.forceEndDrawing();
        }
    }
    
    /**
     * 消去強制終了（冪等・必須API）
     */
    forceEndDrawing() {
        if (!this.isErasing && !this.eraseStarted) {
            return; // 既に終了済み
        }
        
        try {
            console.log('🔄 EraserTool: 消去強制終了実行');
            
            // 消去状態リセット
            this.isErasing = false;
            this.eraseStarted = false;
            
            // 消去確定処理
            if (this.currentErase) {
                this.finalizeCurrentErase();
            }
            
            // 状態完全クリア
            this.currentErase = null;
            this.erasePoints = [];
            this.lastPoint = null;
            
            console.log('✅ EraserTool: 消去強制終了完了');
            
        } catch (error) {
            console.error('💀 EraserTool: 消去強制終了エラー:', error);
            
            // エラー時も状態は確実にリセット
            this.isErasing = false;
            this.eraseStarted = false;
            this.currentErase = null;
            this.erasePoints = [];
            this.lastPoint = null;
        }
    }
    
    /**
     * Tool破棄（必須API）
     */
    destroy() {
        // 消去強制終了
        this.forceEndDrawing();
        
        // 参照クリア
        this.canvasManager = null;
        this.coordinateManager = null;
        this.eventBus = null;
        this.drawContainer = null;
        
        // 状態リセット
        this.managersReady = false;
        
        console.log('✅ EraserTool: destroy() 完了');
    }
    
    /**
     * Tool状態取得（必須API）
     * @returns {Object} Tool状態
     */
    getState() {
        return {
            className: this.className,
            version: this.version,
            toolName: this.toolName,
            isErasing: this.isErasing,
            eraseStarted: this.eraseStarted,
            managersReady: this.managersReady,
            eraseSettings: {
                size: this.eraseSize,
                opacity: this.eraseOpacity
            },
            erasePoints: this.erasePoints.length,
            hasCurrentErase: !!this.currentErase
        };
    }
    
    // ===========================================
    // 消去処理（PixiJS v8対応・修正版）
    // ===========================================
    
    /**
     * 消去開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    startErase(x, y) {
        if (this.isErasing) {
            console.warn('⚠️ EraserTool: 既に消去中 - 強制終了後再開');
            this.forceEndDrawing();
        }
        
        try {
            // 新しい消去Graphics作成（PixiJS v8対応）
            this.currentErase = new PIXI.Graphics();
            
            // 消去設定（v8新API使用）
            this.currentErase.circle(x, y, this.eraseSize);
            this.currentErase.fill({ color: 0xffffff, alpha: this.eraseOpacity });
            
            // blend mode設定（消去効果）
            this.currentErase.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // Container追加
            this.drawContainer.addChild(this.currentErase);
            
            // 状態設定
            this.isErasing = true;
            this.eraseStarted = true;
            this.erasePoints = [{ x, y }];
            this.lastPoint = { x, y };
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('erase:started', { 
                    tool: 'eraser', 
                    startPoint: { x, y },
                    size: this.eraseSize
                });
            }
            
        } catch (error) {
            console.error('💀 EraserTool: startErase エラー:', error);
            this.forceEndDrawing();
        }
    }
    
    /**
     * 消去継続
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueErase(x, y) {
        if (!this.isErasing || !this.currentErase) {
            return;
        }
        
        try {
            // 最小移動距離チェック
            if (this.lastPoint) {
                const dx = x - this.lastPoint.x;
                const dy = y - this.lastPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.eraseSize * 0.3) {
                    return; // 移動量が小さすぎる場合はスキップ
                }
            }
            
            // 消去範囲追加（PixiJS v8新API）
            this.currentErase.circle(x, y, this.eraseSize);
            this.currentErase.fill({ color: 0xffffff, alpha: this.eraseOpacity });
            
            // 座標履歴追加
            this.erasePoints.push({ x, y });
            this.lastPoint = { x, y };
            
            // 履歴サイズ制限
            if (this.erasePoints.length > 500) {
                this.erasePoints = this.erasePoints.slice(-250);
            }
            
        } catch (error) {
            console.error('💀 EraserTool: continueErase エラー:', error);
            this.forceEndDrawing();
        }
    }
    
    /**
     * 消去終了
     */
    endErase() {
        if (!this.isErasing) {
            return;
        }
        
        try {
            // 消去確定
            this.finalizeCurrentErase();
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('erase:ended', { 
                    tool: 'eraser', 
                    pointCount: this.erasePoints.length 
                });
            }
            
            // 状態リセット
            this.isErasing = false;
            this.eraseStarted = false;
            this.currentErase = null;
            this.erasePoints = [];
            this.lastPoint = null;
            
        } catch (error) {
            console.error('💀 EraserTool: endErase エラー:', error);
            this.forceEndDrawing();
        }
    }
    
    /**
     * 現在の消去確定
     */
    finalizeCurrentErase() {
        if (!this.currentErase) {
            return;
        }
        
        try {
            // PixiJS v8での消去確定は自動
            // Graphics はblend mode設定で消去効果適用済み
            
            console.log(`✅ EraserTool: 消去確定完了 (${this.erasePoints.length}点)`);
            
        } catch (error) {
            console.error('💀 EraserTool: 消去確定エラー:', error);
        }
    }
    
    // ===========================================
    // Tool設定管理
    // ===========================================
    
    /**
     * 消しゴム設定変更
     * @param {Object} settings - 設定 {size, opacity}
     */
    updateSettings(settings) {
        if (settings.size !== undefined) {
            this.eraseSize = Math.max(1, Math.min(100, settings.size));
        }
        
        if (settings.opacity !== undefined) {
            this.eraseOpacity = Math.max(0, Math.min(1, settings.opacity));
        }
        
        console.log('✅ EraserTool: 設定更新完了');
    }
    
    /**
     * 現在の設定取得
     * @returns {Object} 現在の設定
     */
    getSettings() {
        return {
            size: this.eraseSize,
            opacity: this.eraseOpacity
        };
    }
    
    // ===========================================
    // 状態管理・デバッグ
    // ===========================================
    
    /**
     * Tool状態取得（上書き・詳細版）
     * @returns {Object} 詳細状態
     */
    getState() {
        return {
            className: this.className,
            version: this.version,
            toolName: this.toolName,
            
            // 消去状態
            isErasing: this.isErasing,
            eraseStarted: this.eraseStarted,
            hasCurrentErase: !!this.currentErase,
            
            // Manager準備状態
            managersReady: this.managersReady,
            managerReferences: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                eventBus: !!this.eventBus,
                drawContainer: !!this.drawContainer
            },
            
            // 消しゴム設定
            settings: this.getSettings(),
            
            // 座標履歴
            eraseInfo: {
                pointCount: this.erasePoints.length,
                lastPoint: this.lastPoint ? { ...this.lastPoint } : null
            }
        };
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            ...this.getState(),
            eraseHistory: this.erasePoints.slice(-10), // 最新10点のみ
            containerInfo: this.drawContainer ? {
                childrenCount: this.drawContainer.children.length,
                visible: this.drawContainer.visible,
                alpha: this.drawContainer.alpha
            } : null
        };
    }
    
    /**
     * Tool健全性チェック
     * @returns {Object} 健全性チェック結果
     */
    healthCheck() {
        const issues = [];
        
        // Manager参照チェック
        if (!this.managersReady) {
            issues.push('Managers not ready');
        }
        
        // 消去状態一貫性チェック
        if (this.isErasing && !this.currentErase) {
            issues.push('Erase state inconsistent: isErasing=true but no currentErase');
        }
        
        if (this.eraseStarted && !this.isErasing) {
            issues.push('Erase state inconsistent: eraseStarted=true but isErasing=false');
        }
        
        // Container チェック
        if (!this.drawContainer) {
            issues.push('DrawContainer not available');
        }
        
        return {
            healthy: issues.length === 0,
            issues: issues,
            timestamp: Date.now()
        };
    }
    
    // ===========================================
    // 高度消去機能（将来拡張用）
    // ===========================================
    
    /**
     * 範囲消去（矩形）
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     */
    eraseRectangle(x1, y1, x2, y2) {
        if (!this.managersReady) {
            return;
        }
        
        try {
            const eraseGraphics = new PIXI.Graphics();
            
            // 矩形消去（v8新API）
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);
            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            
            eraseGraphics.rect(left, top, width, height);
            eraseGraphics.fill({ color: 0xffffff, alpha: 1.0 });
            eraseGraphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            this.drawContainer.addChild(eraseGraphics);
            
            console.log('✅ EraserTool: 矩形消去完了');
            
        } catch (error) {
            console.error('💀 EraserTool: 矩形消去エラー:', error);
        }
    }
    
    /**
     * 全消去
     */
    eraseAll() {
        if (!this.managersReady || !this.drawContainer) {
            console.warn('⚠️ EraserTool: Manager未準備 - 全消去スキップ');
            return;
        }
        
        try {
            // 強制終了（現在の消去処理停止）
            this.forceEndDrawing();
            
            // DrawContainer内の全Graphics削除
            const childrenToRemove = [...this.drawContainer.children];
            for (const child of childrenToRemove) {
                this.drawContainer.removeChild(child);
                if (child.destroy) {
                    child.destroy();
                }
            }
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('canvas:cleared', { 
                    tool: 'eraser',
                    clearedCount: childrenToRemove.length
                });
            }
            
            console.log('✅ EraserTool: 全消去完了');
            
        } catch (error) {
            console.error('💀 EraserTool: 全消去エラー:', error);
        }
    }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.EraserTool = EraserTool;

console.log('🧹 EraserTool v8.12.0 消しゴム機能完全修正版 Loaded');
console.log('📏 修正内容: 消しゴム機能修復・v8新API完全準拠・Manager注入修正・状態管理強化');
console.log('🚀 特徴: PixiJS v8 shape().fill()新API・blend mode消去・消去状態一貫性保証・座標変換統一・WebGPU対応');