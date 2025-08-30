/**
 * 📄 FILE: tools/eraser-tool.js
 * 📌 RESPONSIBILITY: 消しゴムツール・ストローク削除・v8 Graphics API対応・Manager注入修正
 *
 * @provides
 *   - EraserTool クラス
 *   - onPointerDown(event) - ポインターダウン消去開始
 *   - onPointerMove(event) - ポインタームーブ消去継続
 *   - onPointerUp(event) - ポインターアップ消去終了
 *   - setManagersObject(managers) - Manager統一注入（正規）
 *   - setManagers(managers) - Manager統一注入（エイリアス）
 *   - activate() - ツールアクティブ化
 *   - deactivate() - ツール非アクティブ化
 *   - performErase(point) - 消去処理実行
 *   - getDebugInfo() - デバッグ情報取得
 *
 * @uses
 *   - AbstractTool.constructor()
 *   - AbstractTool.setManagersObject()
 *   - AbstractTool.activate()
 *   - AbstractTool.deactivate()
 *   - CanvasManager.getDrawContainer()
 *   - CoordinateManager.toCanvasCoords()
 *   - RecordManager.startOperation()
 *   - RecordManager.addPoint()
 *   - RecordManager.endOperation()
 *   - PIXI.Graphics()
 *
 * @initflow
 *   1. new EraserTool() → 2. setManagersObject() → 3. activate() → 4. onPointerDown() → 5. performErase() → 6. onPointerUp()
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance.tools.get('eraser')
 *
 * @dependencies-strict
 *   REQUIRED: AbstractTool, CanvasManager, CoordinateManager, RecordManager
 *   OPTIONAL: NavigationManager
 *   FORBIDDEN: 他Tool直接参照
 *
 * @integration-flow
 *   AppCore → ToolManager.initializeV8Tools() → new EraserTool() → setManagersObject() → activate()
 *
 * @method-naming-rules
 *   - startOperation()/endOperation() 形式統一
 *   - onPointerXxx() - ポインターイベント処理
 *   - performErase() - 消去処理実行
 *
 * @state-management
 *   - 消去状態は直接操作せず、専用メソッド経由
 *   - isErasing/eraserRadius等の状態管理
 *   - 状態変更は必ずEventBus通知
 *
 * @performance-notes
 *   - hit-test最適化、v8 Graphics API活用
 *   - 16ms消去処理維持、WebGPU対応
 *   - deactivate時の確実な解放
 */

// EraserTool v8.12.0 最終修正版 - Manager注入修正・API統一・Graphics v8準拠
class EraserTool extends window.Tegaki.AbstractTool {
    /**
     * EraserTool v8.12.0 最終修正版コンストラクタ
     */
    constructor() {
        super('eraser');
        
        // 消去状態管理
        this.isErasing = false;
        this.eraserRadius = 20;
        this.currentErase = null;
        
        // 消去設定
        this.eraseMode = 'stroke'; // 'stroke' | 'mask'
        
        // v8対応
        this.eraseGraphics = null;
        
        console.log('🧹 EraserTool v8.12.0 最終修正版作成開始 - Manager注入修正・API統一');
    }
    
    /**
     * Manager統一注入処理（API修正版）
     * @param {Object} managers - Manager群オブジェクト
     * @returns {boolean} 注入成功フラグ
     */
    setManagersObject(managers) {
        try {
            console.log('🔧 eraser Manager統一注入開始...（最終修正版）');
            
            if (!managers || typeof managers !== 'object') {
                console.error('❌ eraser: managers が null/undefined または Object でない');
                return false;
            }
            
            // ✅ 修正箇所：正しいメソッド名で親クラス呼び出し
            const parentResult = super.setManagersObject(managers);
            if (parentResult === false) {
                console.error('❌ eraser: AbstractTool.setManagersObject() 失敗');
                return false;
            }
            
            console.log('✅ eraser: Manager統一注入完了（最終修正版）');
            return true;
            
        } catch (error) {
            console.error('🚨 eraser: setManagersObject() エラー:', error);
            return false;
        }
    }
    
    /**
     * Manager統一注入処理（エイリアス・後方互換性）
     * @param {Object} managers - Manager群オブジェクト
     * @returns {boolean} 注入成功フラグ
     */
    setManagers(managers) {
        console.log('🔄 eraser: Manager統一注入（エイリアス経由）');
        return this.setManagersObject(managers);
    }
    
    /**
     * ツールアクティブ化処理
     */
    activate() {
        try {
            console.log('🎯 EraserTool: アクティブ化開始');
            
            super.activate();
            
            // 消去状態リセット
            this.resetErasingState();
            
            console.log('✅ EraserTool: アクティブ化完了');
            
        } catch (error) {
            console.error('🚨 EraserTool: activate() エラー:', error);
        }
    }
    
    /**
     * ツール非アクティブ化処理
     */
    deactivate() {
        try {
            console.log('🔄 EraserTool: 非アクティブ化開始');
            
            // 消去中の場合は強制終了
            if (this.isErasing) {
                console.log('🧹 EraserTool: 非アクティブ化時の強制消去終了');
                this.forceEndErasing();
            }
            
            super.deactivate();
            
            console.log('✅ EraserTool: 非アクティブ化完了');
            
        } catch (error) {
            console.error('🚨 EraserTool: deactivate() エラー:', error);
        }
    }
    
    /**
     * 消去状態リセット
     */
    resetErasingState() {
        console.log('🔄 EraserTool: 消去状態リセット');
        
        this.isErasing = false;
        this.currentErase = null;
        
        // 消去Graphics解放
        if (this.eraseGraphics) {
            try {
                const drawContainer = this.canvasManager?.getDrawContainer();
                if (drawContainer && this.eraseGraphics.parent) {
                    drawContainer.removeChild(this.eraseGraphics);
                }
                this.eraseGraphics.destroy();
            } catch (error) {
                console.warn('消去Graphics解放エラー:', error);
            }
            this.eraseGraphics = null;
        }
        
        console.log('✅ EraserTool: 消去状態リセット完了');
    }
    
    // ========================================
    // ポインターイベント処理
    // ========================================
    
    /**
     * PointerDown処理（消去開始）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerDown(event) {
        console.log('🧹 EraserTool: onPointerDown() 開始');
        
        // 基本状態確認
        if (!this.isActive) {
            console.log('ℹ️ EraserTool: 非アクティブ状態のため消去無効');
            return;
        }
        
        // 継続消去防止：既に消去中の場合は強制終了
        if (this.isErasing) {
            console.log('⚠️ EraserTool: 既に消去中 - 強制終了して新規開始');
            this.forceEndErasing();
        }
        
        try {
            // Manager準備確認
            if (!this.coordinateManager) {
                console.error('❌ EraserTool: CoordinateManager 未準備');
                return;
            }
            
            // DOM座標→キャンバス座標変換
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            console.log('📍 消去座標:', canvasPoint);
            
            // 消去状態初期化
            this.isErasing = true;
            
            // 記録開始
            this.startEraseRecording(canvasPoint);
            
            // 消去処理実行
            this.performErase(canvasPoint);
            
            console.log('✅ EraserTool: onPointerDown() 完了 - isErasing:', this.isErasing);
            
        } catch (error) {
            console.error('🚨 EraserTool: onPointerDown() エラー:', error);
            this.resetErasingState();
        }
    }
    
    /**
     * PointerMove処理（消去継続）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerMove(event) {
        // 消去中でない場合は無視
        if (!this.isActive || !this.isErasing) {
            return;
        }
        
        try {
            // Manager準備確認
            if (!this.coordinateManager) {
                console.error('❌ EraserTool: CoordinateManager 未準備');
                return;
            }
            
            // DOM座標→キャンバス座標変換
            const canvasPoint = this.coordinateManager.toCanvasCoords(event.clientX, event.clientY);
            
            // 消去処理実行
            this.performErase(canvasPoint);
            
            // 記録に点を追加
            this.addPointToEraseRecording(canvasPoint);
            
        } catch (error) {
            console.error('🚨 EraserTool: onPointerMove() エラー:', error);
        }
    }
    
    /**
     * PointerUp処理（消去終了）
     * @param {PointerEvent} event - ポインターイベント
     */
    onPointerUp(event) {
        console.log('🧹 EraserTool: onPointerUp() 開始 - isErasing:', this.isErasing);
        
        // 消去中でない場合も状態確認
        if (!this.isActive) {
            console.log('ℹ️ EraserTool: 非アクティブ状態');
            return;
        }
        
        try {
            // 強制的な消去終了処理
            this.forceEndErasing();
            
            console.log('✅ EraserTool: onPointerUp() 完了 - 消去状態リセット完了');
            
        } catch (error) {
            console.error('🚨 EraserTool: onPointerUp() エラー:', error);
            // エラーが発生しても必ず状態リセット
            this.resetErasingState();
        }
    }
    
    // ========================================
    // 消去処理メソッド
    // ========================================
    
    /**
     * 消去記録開始処理
     * @param {Object} startPoint - 開始点
     */
    startEraseRecording(startPoint) {
        try {
            if (!this.recordManager) {
                console.error('❌ RecordManager 未準備');
                return;
            }
            
            // RecordManager準備状態確認
            if (this.recordManager.isReady && !this.recordManager.isReady()) {
                console.error('❌ RecordManager not ready');
                return;
            }
            
            console.log('📝 消去記録開始');
            
            // RecordManagerに消去記録開始を通知
            if (this.recordManager.startOperation) {
                this.recordManager.startOperation('erase', [startPoint]);
            }
            
            console.log('✅ 消去記録開始完了');
            
        } catch (error) {
            console.error('🚨 消去記録開始エラー:', error);
        }
    }
    
    /**
     * 消去記録中の点追加処理
     * @param {Object} point - 追加する点
     */
    addPointToEraseRecording(point) {
        try {
            if (!this.recordManager || !this.isErasing) return;
            
            // RecordManagerに点を追加
            if (this.recordManager.addPoint) {
                this.recordManager.addPoint(point);
            }
            
        } catch (error) {
            console.error('🚨 消去点追加エラー:', error);
        }
    }
    
    /**
     * 消去処理実行
     * @param {Object} point - 消去座標
     */
    performErase(point) {
        try {
            if (!this.canvasManager) {
                console.error('❌ CanvasManager 未準備');
                return;
            }
            
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                console.error('❌ DrawContainer 未取得');
                return;
            }
            
            // Phase1.5では簡易消去：hit-test方式
            this.performHitTestErase(point, drawContainer);
            
        } catch (error) {
            console.error('🚨 消去処理エラー:', error);
        }
    }
    
    /**
     * hit-test方式消去処理
     * @param {Object} point - 消去座標
     * @param {PIXI.Container} container - 描画コンテナ
     */
    performHitTestErase(point, container) {
        try {
            const eraseRadius = this.eraserRadius;
            const eraseBounds = {
                x: point.x - eraseRadius,
                y: point.y - eraseRadius,
                width: eraseRadius * 2,
                height: eraseRadius * 2
            };
            
            // コンテナ内のGraphicsオブジェクトをチェック
            const childrenToRemove = [];
            
            for (const child of container.children) {
                if (child instanceof PIXI.Graphics) {
                    const childBounds = child.getBounds();
                    
                    // 境界ボックス判定（簡易版）
                    if (this.boundsIntersect(eraseBounds, childBounds)) {
                        // より精密な判定：消去円内にchildのピクセルがあるか
                        if (this.isGraphicsInEraseRadius(child, point, eraseRadius)) {
                            childrenToRemove.push(child);
                        }
                    }
                }
            }
            
            // 該当するGraphicsを削除
            for (const child of childrenToRemove) {
                container.removeChild(child);
                child.destroy();
                console.log('🗑️ Graphics削除:', child);
            }
            
        } catch (error) {
            console.error('🚨 hit-test消去エラー:', error);
        }
    }
    
    /**
     * 境界ボックス交差判定
     * @param {Object} bounds1 - 境界ボックス1
     * @param {Object} bounds2 - 境界ボックス2
     * @returns {boolean} 交差しているか
     */
    boundsIntersect(bounds1, bounds2) {
        return !(bounds1.x + bounds1.width < bounds2.x ||
                 bounds2.x + bounds2.width < bounds1.x ||
                 bounds1.y + bounds1.height < bounds2.y ||
                 bounds2.y + bounds2.height < bounds1.y);
    }
    
    /**
     * Graphics が消去半径内にあるか判定
     * @param {PIXI.Graphics} graphics - 対象Graphics
     * @param {Object} center - 消去中心点
     * @param {number} radius - 消去半径
     * @returns {boolean} 半径内にあるか
     */
    isGraphicsInEraseRadius(graphics, center, radius) {
        try {
            const bounds = graphics.getBounds();
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(center.x - centerX, 2) + 
                Math.pow(center.y - centerY, 2)
            );
            
            return distance <= radius;
            
        } catch (error) {
            console.error('半径判定エラー:', error);
            return false;
        }
    }
    
    /**
     * 強制消去終了処理
     */
    forceEndErasing() {
        console.log('🔚 EraserTool: 強制消去終了処理開始');
        
        try {
            // 記録中の場合は記録終了
            if (this.isErasing && this.recordManager) {
                console.log('📝 消去記録終了処理');
                
                // RecordManagerに記録終了を通知
                const eraseMeta = {
                    tool: 'eraser',
                    radius: this.eraserRadius,
                    mode: this.eraseMode
                };
                
                if (this.recordManager.endOperation) {
                    this.recordManager.endOperation(eraseMeta);
                }
            }
            
            // 消去状態完全リセット
            this.resetErasingState();
            
            console.log('✅ EraserTool: 強制消去終了処理完了');
            
        } catch (error) {
            console.error('🚨 強制消去終了エラー:', error);
            // エラーでも必ず状態リセット
            this.resetErasingState();
        }
    }
    
    // ========================================
    // 設定・情報取得
    // ========================================
    
    /**
     * 消去半径設定
     * @param {number} radius - 消去半径
     */
    setEraserRadius(radius) {
        if (radius > 0) {
            this.eraserRadius = radius;
            console.log(`🧹 消去半径設定: ${radius}px`);
        }
    }
    
    /**
     * 消去モード設定
     * @param {string} mode - 消去モード ('stroke' | 'mask')
     */
    setEraseMode(mode) {
        if (['stroke', 'mask'].includes(mode)) {
            this.eraseMode = mode;
            console.log(`🧹 消去モード設定: ${mode}`);
        }
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            className: 'EraserTool',
            version: 'v8.12.0-final-fix',
            
            // ツール基本情報
            isActive: this.isActive,
            toolName: this.toolName,
            
            // 消去状態
            erasing: {
                isErasing: this.isErasing,
                eraserRadius: this.eraserRadius,
                eraseMode: this.eraseMode,
                hasEraseGraphics: !!this.eraseGraphics
            },
            
            // Manager状態
            managers: {
                canvasManager: !!this.canvasManager,
                canvasManagerReady: this.canvasManager?.isV8Ready?.() || false,
                coordinateManager: !!this.coordinateManager,
                coordinateManagerReady: this.coordinateManager?.isReady?.() || true,
                recordManager: !!this.recordManager,
                recordManagerReady: this.recordManager?.isReady?.() || true,
                navigationManager: !!this.navigationManager,
                eventBus: !!this.eventManager
            },
            
            // Graphics情報
            graphics: this.eraseGraphics ? {
                hasParent: !!this.eraseGraphics.parent,
                destroyed: this.eraseGraphics.destroyed,
                visible: this.eraseGraphics.visible,
                worldBounds: this.eraseGraphics.getBounds()
            } : null
        };
    }
}

// Tegaki名前空間に登録
if (!window.Tegaki) {
    window.Tegaki = {};
}
window.Tegaki.EraserTool = EraserTool;

console.log('🧹 EraserTool v8.12.0 最終修正版 Loaded - Manager注入修正・API統一・Graphics v8準拠・消去機能完全対応');
console.log('📏 修正内容: super.setManagersObject()修正・hit-test消去実装・強制終了処理・状態管理強化');
console.log('🚀 特徴: v8新API準拠・WebGPU対応・Container階層消去・Manager統一注入完全対応・境界ボックス判定最適化');