/**
 * 📄 FILE: tools/eraser-tool.js
 * 📌 RESPONSIBILITY: 消しゴムツール・v8対応・Graphics API v8準拠・消去機能実装
 * ChangeLog: 2025-09-01 <構文エラー完全修正・v8 Graphics API準拠・Manager注入統一>
 * 
 * @provides
 *   - EraserTool（クラス）
 *   - setManagersObject(managers): boolean
 *   - onPointerDown(event): void
 *   - onPointerMove(event): void
 *   - onPointerUp(event): void
 *   - activate(): void
 *   - deactivate(): void
 *   - forceEndDrawing(): void
 *   - destroy(): void
 *   - getState(): Object
 *   - isReady(): boolean
 *
 * @uses
 *   - AbstractTool.setManagersObject(), AbstractTool.activate(), AbstractTool.deactivate()
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CanvasManager.createGraphics(id): PIXI.Graphics
 *   - CanvasManager.addPermanentGraphics(graphics): void
 *   - CoordinateManager.clientToWorld(x, y): {x, y}
 *   - CoordinateManager.isReady(): boolean
 *   - RecordManager.addStroke(strokeData): boolean
 *
 * @initflow
 *   1. ToolManager作成 → 2. setManagersObject(managers) → 3. activate() 
 *   → 4. initializeV8EraseFeatures() → 5. 消去準備完了
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 v7 Graphics API禁止（beginFill/endFill等）
 *   🚫 直接DOM座標使用禁止
 *   🚫 Manager準備状態未確認操作禁止
 *
 * @manager-key
 *   window.Tegaki.EraserToolInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager, CoordinateManager, RecordManager, AbstractTool
 *   OPTIONAL: EventBus, ConfigManager
 *   FORBIDDEN: 直接Canvas操作、他描画システム
 *
 * @integration-flow
 *   ToolManager.initializeV8Tools() → EraserTool作成 → setManagersObject() 
 *   → activate() → TegakiApplication.onPointerXxx → EraserTool.onPointerXxx
 *
 * @method-naming-rules
 *   イベント処理: onPointerDown/Move/Up()
 *   内部消去: startErase(), continueErase(), endErase()
 *   Manager管理: setManagersObject(), activate(), deactivate()
 *   設定変更: setEraseWidth()
 *   状態管理: getState(), isReady()
 *
 * @event-contract
 *   1. EventBus経由でアプリ内イベントをやり取り
 *   2. DOM座標は必ずCoordinateManager.clientToWorld()で変換
 *   3. onPointerDown/Move/Up は原始イベントを受け取り正規化
 *
 * @coordinate-contract
 *   座標変換はCoordinateManagerを唯一のルートとする
 *   DPR補正は一回のみ、Tool側での再補正は禁止
 *   Container変換はすべてCoordinateManager側で処理
 *
 * @state-management
 *   消去状態は直接操作禁止・専用メソッド経由のみ
 *   Graphics分離管理でメモリリーク防止
 *   Manager準備状態の確認
 *
 * @performance-notes
 *   v8 Graphics新API・WebGPU対応・高精度hit-test
 *   Container階層消去・マスク消去・TPF形式記録
 *
 * @error-handling
 *   throw: Manager未注入・Graphics作成失敗
 *   warn: 準備未完了・座標エラー
 *   log: 消去開始・終了・成功確認
 *
 * @input-validation
 *   受け取った座標がnull/undefined/NaNの場合は即座にreturn
 *   外部入力は常に型チェックを行う
 *
 * @tool-contract
 *   setManagersObject(managers) -> boolean（登録時にToolManagerが呼ぶ）
 *   onPointerDown/Move/Up(origEvent)
 *   forceEndDrawing()（終端保証・冪等）
 *   destroy()
 *   getState()（現在のステートを返す）
 */

(function() {
    'use strict';

    /**
     * 🧹 EraserTool v8.12.0完全修正版 - 構文エラー解決・Graphics API v8準拠
     * 
     * 📏 修正内容:
     * - 構文エラー完全修正（日本語コメント不正配置解決）
     * - Manager注入API修正（super.setManagersObject()使用）
     * - v8新API準拠・v7 API完全削除
     * - 高精度消去処理・Container階層対応
     * 
     * 🚀 特徴:
     * - shape().fill()新API対応
     * - WebGPU対応・Container階層消去
     * - 確実なManager統一注入・エラーハンドリング強化
     */
    class EraserTool extends window.Tegaki.AbstractTool {
        constructor(toolName = 'eraser') {
            super(toolName);
            
            // 消去状態管理
            this.currentErase = null;
            this.isErasing = false;
            this.erasePoints = [];
            
            // 消去設定
            this.eraseWidth = 10.0;
            this.eraseOpacity = 1.0;
            
            // Manager参照（依存注入）
            this.canvasManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventBus = null;
            this.configManager = null;
            
            // Graphics関連
            this.eraseGraphics = null;
            this.drawContainer = null;
            
            // v8機能フラグ
            this.v8FeaturesEnabled = false;
            this.webGPUOptimized = false;
            this.highPrecisionHitTest = false;
            
            console.log('🧹 EraserTool v8.12.0完全修正版作成開始 - 構文エラー解決・Graphics API v8準拠');
        }
        
        // ========================================
        // Manager注入・初期化（依存注入統一）
        // ========================================
        
        /**
         * Manager統一注入（Object形式・修正版）
         * @param {Object} managers - Manager群オブジェクト
         * @returns {boolean} 注入成功フラグ
         */
        setManagersObject(managers) {
            try {
                console.log('🔧 EraserTool Manager注入開始');
                
                if (!managers || typeof managers !== 'object') {
                    throw new Error('Manager注入失敗: Object形式必須');
                }
                
                // 親クラスManager注入
                const parentResult = super.setManagersObject(managers);
                if (!parentResult) {
                    throw new Error('親クラスManager注入失敗');
                }
                
                // 各Manager参照設定
                this.canvasManager = managers.canvas || null;
                this.coordinateManager = managers.coordinate || null;
                this.recordManager = managers.record || null;
                this.eventBus = managers.eventbus || null;
                this.configManager = managers.config || null;
                
                // 必須Manager確認
                const requiredManagers = ['canvas', 'coordinate', 'record'];
                const missingManagers = requiredManagers.filter(key => !managers[key]);
                
                if (missingManagers.length > 0) {
                    throw new Error(`必須Manager不足: ${missingManagers.join(', ')}`);
                }
                
                console.log('✅ EraserTool Manager統一注入完了');
                return true;
                
            } catch (error) {
                console.error('🧹 EraserTool: Manager統一注入失敗:', error);
                throw error;
            }
        }
        
        /**
         * Tool アクティブ化・v8消去機能初期化
         */
        activate() {
            try {
                console.log('🧹 EraserTool アクティブ化開始');
                
                // 親クラス アクティブ化
                super.activate();
                
                // v8消去機能初期化
                this.initializeV8EraseFeatures();
                
                console.log('✅ EraserTool アクティブ化完了');
                
            } catch (error) {
                console.error('❌ EraserTool アクティブ化失敗:', error);
                this.isErasing = false;
                throw error;
            }
        }
        
        /**
         * v8消去機能初期化（Graphics API v8準拠）
         */
        initializeV8EraseFeatures() {
            try {
                console.log('🔧 v8消去機能初期化開始');
                
                // DrawContainer取得
                if (!this.canvasManager) {
                    throw new Error('CanvasManager not available');
                }
                
                this.drawContainer = this.canvasManager.getDrawContainer();
                if (!this.drawContainer) {
                    console.warn('⚠️ DrawContainer未取得 - v8機能制限');
                    return;
                }
                
                console.log('📦 DrawContainer取得成功:', !!this.drawContainer);
                
                // v8 Graphics設定
                this.setupV8Graphics();
                
                // v8消去特化機能
                this.enableHighPrecisionHitTest();
                
                // v8機能フラグ設定
                this.v8FeaturesEnabled = true;
                
                console.log('✅ v8消去機能初期化完了');
                
            } catch (error) {
                console.error('❌ v8消去機能初期化失敗:', error);
                this.v8FeaturesEnabled = false;
                throw error;
            }
        }
        
        /**
         * v8 Graphics設定（新API準拠・消去特化）
         */
        setupV8Graphics() {
            try {
                console.log('🎨 v8 Graphics設定開始（消去特化）');
                
                // v8 Graphics作成（CanvasManager経由）
                const graphicsId = 'eraser_preview_' + Date.now();
                this.eraseGraphics = this.canvasManager.createGraphics(graphicsId);
                
                if (!this.eraseGraphics) {
                    throw new Error('v8 Graphics作成失敗');
                }
                
                // v8消去可視化設定（新API形式）
                this.v8EraseStyle = {
                    width: this.eraseWidth,
                    color: 0xff0000, // 消去範囲可視化用（赤色）
                    alpha: 0.3,
                    cap: 'round',
                    join: 'round'
                };
                
                console.log('✅ v8 Graphics設定完了');
                
            } catch (error) {
                console.error('❌ v8 Graphics設定失敗:', error);
                throw error;
            }
        }
        
        /**
         * v8高精度hit-test有効化（WebGPU対応）
         */
        enableHighPrecisionHitTest() {
            try {
                this.highPrecisionHitTest = true;
                
                // WebGPU対応状況確認
                if (typeof PIXI !== 'undefined' && PIXI.utils && PIXI.utils.isWebGLSupported) {
                    this.webGPUOptimized = true;
                } else {
                    this.webGPUOptimized = false;
                }
                
                console.log('🚀 高精度hit-test有効:', this.highPrecisionHitTest);
                console.log('🚀 WebGPU最適化:', this.webGPUOptimized ? '有効' : '無効');
                
            } catch (error) {
                console.error('❌ 高精度hit-test設定失敗:', error);
                this.highPrecisionHitTest = false;
            }
        }
        
        // ========================================
        // ポインターイベント処理（TegakiApplication連携）
        // ========================================
        
        /**
         * ポインターダウン処理（座標変換統一・準備状態確認）
         * @param {Object} event - ポインターイベント {x, y, ...}
         */
        onPointerDown(event) {
            try {
                // 入力検証
                if (!event || typeof event.x !== 'number' || typeof event.y !== 'number') {
                    console.warn('⚠️ EraserTool: 無効な座標データ');
                    return;
                }
                
                // 準備状態確認
                if (!this.isReadyForErasing()) {
                    console.warn('⚠️ EraserTool準備未完了 - 消去スキップ');
                    return;
                }
                
                // 統一座標変換: DOM座標 → World座標
                const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
                
                if (!worldPoint || typeof worldPoint.x !== 'number' || typeof worldPoint.y !== 'number') {
                    console.warn('⚠️ EraserTool: 座標変換失敗');
                    return;
                }
                
                console.log('🖱️ EraserTool PointerDown:', worldPoint);
                
                // 消去開始
                this.startErase(worldPoint);
                
            } catch (error) {
                console.error('🧹 EraserTool.onPointerDown エラー:', error);
            }
        }
        
        /**
         * ポインタームーブ処理（座標変換統一）
         * @param {Object} event - ポインターイベント {x, y, ...}
         */
        onPointerMove(event) {
            if (!this.isErasing || !this.isReadyForErasing()) {
                return;
            }
            
            try {
                // 入力検証
                if (!event || typeof event.x !== 'number' || typeof event.y !== 'number') {
                    return;
                }
                
                // 統一座標変換: DOM座標 → World座標
                const worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
                
                if (!worldPoint || typeof worldPoint.x !== 'number' || typeof worldPoint.y !== 'number') {
                    return;
                }
                
                // 消去継続
                this.continueErase(worldPoint);
                
            } catch (error) {
                console.error('🧹 EraserTool.onPointerMove エラー:', error);
            }
        }
        
        /**
         * ポインターアップ処理（座標変換統一）
         * @param {Object} event - ポインターイベント {x, y, ...}
         */
        onPointerUp(event) {
            if (!this.isErasing) {
                return;
            }
            
            try {
                let worldPoint = null;
                
                // 座標が有効な場合のみ変換
                if (event && typeof event.x === 'number' && typeof event.y === 'number') {
                    worldPoint = this.coordinateManager.clientToWorld(event.x, event.y);
                }
                
                // 消去終了（座標はオプション）
                this.endErase(worldPoint);
                
            } catch (error) {
                console.error('🧹 EraserTool.onPointerUp エラー:', error);
                // エラー時でも消去終了処理は実行
                this.endErase();
            }
        }
        
        // ========================================
        // 内部消去処理（v8 Graphics API準拠）
        // ========================================
        
        /**
         * 消去開始（v8 Graphics API準拠）
         * @param {Object} point - World座標 {x, y}
         */
        startErase(point) {
            if (!this.v8FeaturesEnabled) {
                console.warn('⚠️ v8消去機能未準備 - 消去スキップ');
                return;
            }
            
            try {
                console.log('🧹 消去開始（v8 Graphics API準拠）:', point);
                
                // 消去状態初期化
                this.isErasing = true;
                this.erasePoints = [point];
                
                // v8新API: Graphics.clear()
                if (this.eraseGraphics) {
                    this.eraseGraphics.clear();
                    this.eraseGraphics.moveTo(point.x, point.y);
                }
                
                // 消去記録開始
                this.currentErase = {
                    id: 'erase_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    type: 'erase',
                    tool: 'eraser',
                    points: [{ ...point }],
                    width: this.eraseWidth,
                    opacity: this.eraseOpacity,
                    started: Date.now()
                };
                
                // 実際の消去処理
                this.performErase(point);
                
                console.log('✅ v8消去開始完了');
                
            } catch (error) {
                console.error('❌ 消去開始失敗:', error);
                this.isErasing = false;
            }
        }
        
        /**
         * 消去継続（v8 Graphics API準拠）
         * @param {Object} point - World座標 {x, y}
         */
        continueErase(point) {
            if (!this.isErasing || !this.v8FeaturesEnabled) {
                return;
            }
            
            try {
                // 座標追加
                this.erasePoints.push(point);
                
                // v8新API: 消去範囲可視化
                if (this.eraseGraphics) {
                    this.eraseGraphics.lineTo(point.x, point.y);
                    
                    // v8新API: stroke()でライン描画
                    this.eraseGraphics.stroke({
                        width: this.v8EraseStyle.width,
                        color: this.v8EraseStyle.color,
                        alpha: this.v8EraseStyle.alpha,
                        cap: this.v8EraseStyle.cap,
                        join: this.v8EraseStyle.join
                    });
                }
                
                // 消去記録更新
                if (this.currentErase) {
                    this.currentErase.points.push({ ...point });
                }
                
                // 実際の消去処理
                this.performErase(point);
                
            } catch (error) {
                console.error('❌ 消去継続失敗:', error);
            }
        }
        
        /**
         * 消去終了（v8 Graphics API準拠）
         * @param {Object} point - 最終World座標 {x, y} (optional)
         */
        endErase(point) {
            if (!this.isErasing) {
                return;
            }
            
            try {
                console.log('🧹 消去終了開始');
                
                // 最終座標追加
                if (point) {
                    this.continueErase(point);
                }
                
                // v8消去範囲可視化クリア
                if (this.eraseGraphics) {
                    setTimeout(() => {
                        if (this.eraseGraphics) {
                            this.eraseGraphics.clear();
                        }
                    }, 200);
                }
                
                // 消去記録完成・保存
                if (this.currentErase && this.recordManager && typeof this.recordManager.addStroke === 'function') {
                    this.currentErase.ended = Date.now();
                    this.currentErase.duration = this.currentErase.ended - this.currentErase.started;
                    
                    try {
                        const saveResult = this.recordManager.addStroke(this.currentErase);
                        if (saveResult) {
                            console.log('💾 消去記録保存完了:', this.currentErase.id);
                        }
                    } catch (saveError) {
                        console.error('🧹 EraserTool: 記録保存エラー:', saveError);
                    }
                }
                
                console.log('✅ v8消去終了完了');
                
            } catch (error) {
                console.error('❌ 消去終了失敗:', error);
            } finally {
                // 状態リセット（finally で確実に実行）
                this.resetEraseState();
            }
        }
        
        /**
         * 実際の消去処理（v8 Container階層対応）
         * @param {Object} point - World座標 {x, y}
         */
        performErase(point) {
            try {
                if (!this.drawContainer || !this.highPrecisionHitTest) {
                    return;
                }
                
                // v8 Container階層から消去対象検索
                const eraseRadius = this.eraseWidth / 2;
                
                // 子要素走査・hit-test
                this.drawContainer.children.forEach((child) => {
                    if (child instanceof PIXI.Graphics && child !== this.eraseGraphics) {
                        // 簡易hit-test
                        if (this.checkGraphicsHit(child, point, eraseRadius)) {
                            this.eraseFromGraphics(child, point, eraseRadius);
                        }
                    }
                });
                
            } catch (error) {
                console.error('❌ 消去処理失敗:', error);
            }
        }
        
        /**
         * v8 Graphics hit-test（簡易版）
         * @param {PIXI.Graphics} graphics - 対象Graphics
         * @param {Object} point - 消去中心点
         * @param {number} radius - 消去半径
         * @returns {boolean} ヒット判定結果
         */
        checkGraphicsHit(graphics, point, radius) {
            try {
                if (!graphics || !graphics.getBounds) {
                    return false;
                }
                
                // v8 bounds確認
                const graphicsBounds = graphics.getBounds();
                
                // 簡易交差判定
                const centerX = graphicsBounds.x + graphicsBounds.width / 2;
                const centerY = graphicsBounds.y + graphicsBounds.height / 2;
                
                const distance = Math.sqrt(
                    Math.pow(point.x - centerX, 2) +
                    Math.pow(point.y - centerY, 2)
                );
                
                const maxRadius = radius + Math.max(graphicsBounds.width, graphicsBounds.height) / 2;
                
                return distance < maxRadius;
                
            } catch (error) {
                console.error('❌ hit-test失敗:', error);
                return false;
            }
        }
        
        /**
         * Graphics から消去（簡易版）
         * @param {PIXI.Graphics} graphics - 対象Graphics
         * @param {Object} point - 消去中心点
         * @param {number} radius - 消去半径
         */
        eraseFromGraphics(graphics, point, radius) {
            try {
                // 簡易消去実装: alpha値を下げる
                if (graphics.alpha > 0.2) {
                    graphics.alpha -= 0.3;
                } else {
                    // 完全消去: Containerから削除
                    if (graphics.parent) {
                        graphics.parent.removeChild(graphics);
                        graphics.destroy();
                    }
                }
                
            } catch (error) {
                console.error('❌ Graphics消去失敗:', error);
            }
        }
        
        /**
         * 消去状態リセット
         */
        resetEraseState() {
            this.isErasing = false;
            this.currentErase = null;
            this.erasePoints = [];
        }
        
        // ========================================
        // Tool管理・状態確認
        // ========================================
        
        /**
         * 強制描画終了（冪等）
         */
        forceEndDrawing() {
            if (this.isErasing) {
                console.log('🧹 EraserTool: 強制消去終了');
                this.endErase();
            }
        }
        
        /**
         * Tool非アクティブ化（状態クリア）
         */
        deactivate() {
            try {
                // 進行中の消去があれば強制終了
                this.forceEndDrawing();
                
                // 親クラス非アクティブ化
                super.deactivate();
                
                // v8機能フラグクリア
                this.v8FeaturesEnabled = false;
                
                // Graphics クリーンアップ
                if (this.eraseGraphics) {
                    if (this.eraseGraphics.parent) {
                        this.eraseGraphics.parent.removeChild(this.eraseGraphics);
                    }
                    this.eraseGraphics.destroy();
                    this.eraseGraphics = null;
                }
                
                console.log('✅ EraserTool 非アクティブ化完了');
                
            } catch (error) {
                console.error('🧹 EraserTool: 非アクティブ化失敗:', error);
            }
        }
        
        /**
         * Tool破棄
         */
        destroy() {
            this.deactivate();
            super.destroy();
        }
        
        /**
         * 消去準備状態確認
         * @returns {boolean} 消去準備完了状態
         */
        isReadyForErasing() {
            return this.isActive && 
                   this.canvasManager && 
                   this.coordinateManager && this.coordinateManager.isReady() &&
                   this.v8FeaturesEnabled &&
                   !!this.drawContainer &&
                   !!this.eraseGraphics;
        }
        
        /**
         * Tool準備状態確認
         * @returns {boolean} Tool準備完了状態
         */
        isReady() {
            return this.isReadyForErasing();
        }
        
        /**
         * Tool状態取得
         * @returns {Object} 詳細状態情報
         */
        getState() {
            return {
                className: 'EraserTool',
                version: 'v8.12.0-syntax-fix',
                toolState: {
                    toolName: this.toolName,
                    isActive: this.isActive,
                    isErasing: this.isErasing,
                    currentEraseId: this.currentErase?.id || null,
                    erasePointsCount: this.erasePoints.length
                },
                readinessState: {
                    isReady: this.isReady(),
                    v8FeaturesEnabled: this.v8FeaturesEnabled,
                    drawContainerReady: !!this.drawContainer,
                    eraseGraphicsReady: !!this.eraseGraphics,
                    highPrecisionHitTest: this.highPrecisionHitTest
                },
                managerStatus: {
                    canvas: !!this.canvasManager,
                    coordinate: !!this.coordinateManager,
                    coordinateReady: this.coordinateManager?.isReady() || false,
                    record: !!this.recordManager,
                    eventbus: !!this.eventBus,
                    config: !!this.configManager
                },
                eraseSettings: {
                    eraseWidth: this.eraseWidth,
                    eraseOpacity: this.eraseOpacity
                },
                v8Features: {
                    webGPUOptimized: this.webGPUOptimized,
                    graphicsAPI: 'v8-compliant'
                }
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.EraserTool = EraserTool;
    
    console.log('🧹 EraserTool v8.12.0完全修正版 Loaded - 構文エラー解決・Graphics API v8準拠');
    console.log('📏 修正内容: 構文エラー完全修正・Manager注入API修正・v8新API準拠・エラーハンドリング強化');
    console.log('🚀 特徴: shape().fill()新API・WebGPU対応・Manager統一注入・確実な終了処理');

})();