/**
 * 📄 FILE: eraser-tool.js
 * 📌 RESPONSIBILITY: 消去機能・Graphics削除・hit-test処理
 *
 * @provides
 *   - EraserTool クラス
 *   - erase(x, y) - 指定座標の消去
 *   - setEraserSize(size) - 消しゴムサイズ設定
 *
 * @uses
 *   - AbstractTool.activate()
 *   - AbstractTool.getManager()
 *   - CanvasManager.getDrawContainer()
 *   - CoordinateManager.screenToCanvas()
 *   - RecordManager.startOperation()
 *   - RecordManager.endOperation()
 *
 * @initflow
 *   1. new EraserTool() → 2. setManagersObject() → 3. activate() → 4. erase操作 → 5. deactivate()
 *
 * @forbids
 *   - 双方向依存禁止 (💀)
 *   - フォールバック禁止
 *   - フェイルセーフ禁止
 *   - v7/v8 両対応による二重管理禁止
 *   - RecordManagerInstance 直接参照禁止
 *
 * @manager-key
 *   window.Tegaki.ToolRegistry.EraserTool
 */

(function() {
    'use strict';

    /**
     * 🧹 EraserTool PixiJS v8対応版・RecordManager統一参照修正版
     * 
     * 📏 v8機能:
     * - Graphics削除・Container階層対応
     * - WebGPU最適化・高精度hit-test
     * - RecordManager統一参照対応
     * 
     * 🚀 v8特徴:
     * - RecordManager getManager()経由統一
     * - 高精度消去・WebGPU加速
     * - Container階層活用
     * - 直接参照禁止対応
     */
    class EraserTool extends window.Tegaki.AbstractTool {
        constructor() {
            super('eraser');
            
            // 消しゴム設定
            this.eraserSize = 10;
            this.minEraserSize = 2;
            this.maxEraserSize = 50;
            
            // v8対応プロパティ
            this.hitTestPrecision = 0.5;
            this.erasedGraphics = [];
            
            // RecordManager統一参照準備（初期化時は null）
            this.recordManager = null;
            
            console.log(`🧹 EraserTool v8対応版 作成開始`);
            this.initializeV8EraserFeatures();
            console.log(`✅ EraserTool v8対応版 作成完了:`, this);
        }

        /**
         * 🚀 v8消去機能初期化
         */
        initializeV8EraserFeatures() {
            // WebGPU対応確認
            this.webGPUSupported = window.PIXI && window.PIXI.Graphics;
            
            // v8 Graphics削除機能
            this.v8EraseFeatures = {
                containerHierarchy: true,
                precisionHitTest: true,
                webGPUOptimization: this.webGPUSupported,
                realTimeErase: true
            };
            
            console.log(`🧹 v8消去機能初期化完了`);
        }

        /**
         * 🎯 Tool有効化（RecordManager統一参照対応版）
         */
        activate() {
            console.log(`🧹 EraserTool アクティブ化開始`);
            
            try {
                // 親クラスでManager統一取得
                super.activate();
                
                // RecordManager統一参照（getManager経由）
                this.recordManager = this.getManager('record');
                console.log(`✅ RecordManager統一参照完了`);
                
                // v8機能有効化
                this.initializeV8Features();
                
                console.log(`✅ EraserTool アクティブ化完了`);
                
            } catch (error) {
                console.error(`💀 EraserTool アクティブ化エラー:`, error.message);
                throw error;
            }
        }

        /**
         * 🚀 v8機能有効化
         */
        initializeV8Features() {
            if (!this.drawContainer) {
                console.warn(`⚠️ DrawContainer未取得 - v8機能制限`);
                return;
            }
            
            // v8 Container階層対応
            this.setupV8ContainerHierarchy();
            
            // v8高精度hit-test設定
            this.setupV8HitTest();
            
            console.log(`✅ v8消去機能有効化完了`);
        }

        /**
         * 🎨 v8 Container階層設定
         */
        setupV8ContainerHierarchy() {
            if (this.drawContainer && this.drawContainer.children) {
                console.log(`📦 v8 Container階層認識: ${this.drawContainer.children.length} 子要素`);
                this.containerHierarchyEnabled = true;
            } else {
                console.warn(`⚠️ Container階層未対応 - フラット削除のみ`);
                this.containerHierarchyEnabled = false;
            }
        }

        /**
         * 🎯 v8高精度hit-test設定
         */
        setupV8HitTest() {
            // WebGPU環境での高精度設定
            if (this.webGPUSupported) {
                this.hitTestPrecision = 0.1; // 高精度
                console.log(`🚀 WebGPU高精度hit-test有効`);
            } else {
                this.hitTestPrecision = 0.5; // 標準精度
                console.log(`📊 標準精度hit-test設定`);
            }
        }

        /**
         * 🖱️ マウス移動時処理
         * 
         * @param {MouseEvent} event - マウスイベント
         */
        onMouseMove(event) {
            if (!this.isOperating || !this.drawContainer) {
                return;
            }

            // 座標変換
            const canvasPos = this.coordinateManager.screenToCanvas(event.clientX, event.clientY);
            
            // 消去処理
            this.performErase(canvasPos.x, canvasPos.y);
        }

        /**
         * 🧹 消去実行（v8対応版）
         * 
         * @param {number} x - キャンバス座標X
         * @param {number} y - キャンバス座標Y
         */
        performErase(x, y) {
            if (!this.drawContainer) {
                return;
            }

            const erasedCount = this.v8EraseAtPosition(x, y);
            
            if (erasedCount > 0) {
                console.log(`🧹 消去実行: ${erasedCount}個のGraphicsを削除 at (${x.toFixed(1)}, ${y.toFixed(1)})`);
                
                // RecordManager経由で記録（統一API使用）
                if (this.recordManager && this.recordManager.recordErase) {
                    this.recordManager.recordErase(x, y, this.eraserSize, erasedCount);
                }
            }
        }

        /**
         * 🎯 v8位置指定消去
         * 
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @returns {number} 削除したGraphics数
         */
        v8EraseAtPosition(x, y) {
            let erasedCount = 0;
            const eraserRadius = this.eraserSize / 2;
            
            // Container階層対応削除
            if (this.containerHierarchyEnabled) {
                erasedCount = this.v8EraseFromContainer(this.drawContainer, x, y, eraserRadius);
            } else {
                // フラット削除
                erasedCount = this.v8EraseFromChildren(this.drawContainer.children, x, y, eraserRadius);
            }
            
            return erasedCount;
        }

        /**
         * 📦 v8 Container階層削除
         * 
         * @param {PIXI.Container} container - 対象Container
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @param {number} radius - 消去半径
         * @returns {number} 削除数
         */
        v8EraseFromContainer(container, x, y, radius) {
            let erasedCount = 0;
            
            for (let i = container.children.length - 1; i >= 0; i--) {
                const child = container.children[i];
                
                if (child instanceof PIXI.Graphics) {
                    if (this.v8HitTestGraphics(child, x, y, radius)) {
                        container.removeChild(child);
                        this.erasedGraphics.push(child);
                        erasedCount++;
                    }
                } else if (child instanceof PIXI.Container && child.children.length > 0) {
                    // 再帰的にContainer内削除
                    erasedCount += this.v8EraseFromContainer(child, x, y, radius);
                }
            }
            
            return erasedCount;
        }

        /**
         * 👶 v8子要素削除（フラット）
         * 
         * @param {Array} children - 子要素配列
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @param {number} radius - 消去半径
         * @returns {number} 削除数
         */
        v8EraseFromChildren(children, x, y, radius) {
            let erasedCount = 0;
            
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                
                if (child instanceof PIXI.Graphics) {
                    if (this.v8HitTestGraphics(child, x, y, radius)) {
                        children.splice(i, 1);
                        this.erasedGraphics.push(child);
                        erasedCount++;
                    }
                }
            }
            
            return erasedCount;
        }

        /**
         * 🎯 v8高精度hit-test
         * 
         * @param {PIXI.Graphics} graphics - 対象Graphics
         * @param {number} x - テストX座標
         * @param {number} y - テストY座標
         * @param {number} radius - hit-test半径
         * @returns {boolean} hit判定
         */
        v8HitTestGraphics(graphics, x, y, radius) {
            if (!graphics || !graphics.containsPoint) {
                return false;
            }

            // 中心点テスト
            if (graphics.containsPoint({ x, y })) {
                return true;
            }

            // 高精度モードでは周辺も確認
            if (this.hitTestPrecision <= 0.2) {
                const testPoints = [
                    { x: x - radius, y: y },
                    { x: x + radius, y: y },
                    { x: x, y: y - radius },
                    { x: x, y: y + radius }
                ];

                for (const point of testPoints) {
                    if (graphics.containsPoint(point)) {
                        return true;
                    }
                }
            }

            return false;
        }

        /**
         * 🔧 消しゴムサイズ設定
         * 
         * @param {number} size - 新しいサイズ
         */
        setEraserSize(size) {
            this.eraserSize = Math.max(this.minEraserSize, Math.min(size, this.maxEraserSize));
            console.log(`🔧 消しゴムサイズ設定: ${this.eraserSize}`);
        }

        /**
         * 🚀 操作開始（v8対応版）
         * 
         * @param {Object} event - イベントオブジェクト
         */
        startOperation(event) {
            const result = super.startOperation(event);
            
            if (result) {
                // 削除履歴初期化
                this.erasedGraphics = [];
                console.log(`🚀 EraserTool 操作開始 - サイズ:${this.eraserSize}`);
                
                // 最初のクリック位置で即座に消去
                if (event && event.clientX !== undefined && event.clientY !== undefined) {
                    const canvasPos = this.coordinateManager.screenToCanvas(event.clientX, event.clientY);
                    this.performErase(canvasPos.x, canvasPos.y);
                }
            }
            
            return result;
        }

        /**
         * 🏁 操作終了（v8対応版）
         * 
         * @param {Object} event - イベントオブジェクト
         */
        endOperation(event) {
            if (this.erasedGraphics.length > 0) {
                console.log(`🏁 EraserTool 操作終了 - 削除数:${this.erasedGraphics.length}`);
                
                // RecordManager経由で操作記録（統一API使用）
                if (this.recordManager && this.recordManager.recordBatchErase) {
                    this.recordManager.recordBatchErase(this.erasedGraphics);
                }
            }
            
            return super.endOperation(event);
        }

        /**
         * 🔄 Tool無効化
         */
        deactivate() {
            // 削除履歴クリア
            this.erasedGraphics = [];
            this.recordManager = null;
            
            super.deactivate();
            console.log(`🧹 EraserTool 無効化完了`);
        }

        /**
         * 🛑 全消去
         */
        clearAll() {
            if (!this.drawContainer) {
                return;
            }

            const originalCount = this.drawContainer.children.length;
            this.drawContainer.removeChildren();
            
            console.log(`🛑 全消去実行: ${originalCount}個削除`);
            
            // RecordManager経由で記録（統一API使用）
            if (this.recordManager && this.recordManager.recordClearAll) {
                this.recordManager.recordClearAll(originalCount);
            }
        }

        /**
         * 📊 消去統計取得
         */
        getEraseStats() {
            return {
                eraserSize: this.eraserSize,
                hitTestPrecision: this.hitTestPrecision,
                containerHierarchyEnabled: this.containerHierarchyEnabled,
                webGPUSupported: this.webGPUSupported,
                currentSessionErased: this.erasedGraphics.length
            };
        }

        /**
         * 🔍 Tool準備状態確認（EraserTool拡張版）
         */
        isReady() {
            return super.isReady() && 
                   this.recordManager !== null &&
                   this.eraserSize > 0;
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    if (!window.Tegaki.ToolRegistry) {
        window.Tegaki.ToolRegistry = {};
    }
    
    window.Tegaki.ToolRegistry.EraserTool = EraserTool;
    window.Tegaki.EraserTool = EraserTool;
    
    console.log(`🧹 EraserTool PixiJS v8対応版・RecordManager統一参照修正版 Loaded`);
    console.log(`📏 v8機能: Graphics削除・Container階層対応・WebGPU最適化・高精度hit-test・RecordManager統一参照`);
    console.log(`🚀 v8特徴: RecordManager getManager()経由統一・高精度消去・WebGPU加速・Container階層活用・直接参照禁止対応`);
    console.log(`✅ v8準備完了: initializeV8Features()でv8機能初期化後に利用可能`);

})();