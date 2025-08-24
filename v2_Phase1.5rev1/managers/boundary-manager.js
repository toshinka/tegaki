/**
 * 🎨 Tegaki Project - Boundary Manager v12
 * 🎯 責務: 描画範囲制限・境界検知・ポインタートラッキング
 * 📐 依存: CanvasManager
 * 🔧 Phase: STEP3 - 機能拡張
 */

class BoundaryManager {
    constructor() {
        this.version = 'v12-step3';
        this.validateDependencies();
        
        // 基本プロパティ
        this.canvasElement = null;
        this.canvasManager = null;
        this.boundaryMargin = 20;
        
        // 境界状態
        this.isPointerInside = false;
        this.lastKnownPosition = { x: 0, y: 0 };
        this.boundaryArea = null;
        
        // 統計
        this.stats = {
            crossInCount: 0,
            crossOutCount: 0,
            totalMoveEvents: 0
        };
        
        console.log('🎯 BoundaryManager v12 構築完了');
    }
    
    /**
     * 依存関係確認
     */
    validateDependencies() {
        const required = ['CanvasManager'];
        const missing = required.filter(dep => !window[dep]);
        
        if (missing.length > 0) {
            throw new Error(`BoundaryManager依存関係エラー: ${missing.join(', ')}`);
        }
        
        console.log('✅ BoundaryManager依存関係確認完了');
    }
    
    /**
     * 初期化
     */
    initialize(canvasElement) {
        console.log('🎯 BoundaryManager初期化開始...');
        
        try {
            if (!canvasElement) {
                throw new Error('canvasElement は必須です');
            }
            
            this.canvasElement = canvasElement;
            
            // CanvasManager参照取得
            if (window.CanvasManager) {
                this.canvasManager = window.CanvasManager;
            }
            
            // 境界領域初期化
            this.initializeBoundaryArea();
            
            // イベントハンドラー設定
            this.setupEventHandlers();
            
            // 視覚的境界表示
            this.createBoundaryIndicator();
            
            console.log('✅ BoundaryManager初期化完了');
            return this;
            
        } catch (error) {
            console.error('❌ BoundaryManager初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('init-error', `BoundaryManager初期化失敗: ${error.message}`);
            }
            throw error;
        }
    }
    
    /**
     * 境界領域初期化
     */
    initializeBoundaryArea() {
        if (!this.canvasElement) {
            throw new Error('canvasElement が設定されていません');
        }
        
        const rect = this.canvasElement.getBoundingClientRect();
        
        this.boundaryArea = {
            left: rect.left - this.boundaryMargin,
            top: rect.top - this.boundaryMargin,
            right: rect.right + this.boundaryMargin,
            bottom: rect.bottom + this.boundaryMargin,
            width: rect.width + this.boundaryMargin * 2,
            height: rect.height + this.boundaryMargin * 2
        };
        
        console.log('📐 境界領域初期化完了:', this.boundaryArea);
    }
    
    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        // グローバルポインター移動監視
        document.addEventListener('pointermove', (event) => {
            this.handleGlobalPointerMove(event);
        });
        
        // キャンバス固有イベント
        this.canvasElement.addEventListener('pointerenter', (event) => {
            this.handleCanvasPointerEnter(event);
        });
        
        this.canvasElement.addEventListener('pointerleave', (event) => {
            this.handleCanvasPointerLeave(event);
        });
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        console.log('📡 BoundaryManager イベントハンドラー設定完了');
    }
    
    /**
     * 境界指示器作成
     */
    createBoundaryIndicator() {
        // 既存の指示器を削除
        const existing = document.querySelector('#boundary-indicator');
        if (existing) {
            existing.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.id = 'boundary-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: -${this.boundaryMargin}px;
            top: -${this.boundaryMargin}px;
            width: calc(100% + ${this.boundaryMargin * 2}px);
            height: calc(100% + ${this.boundaryMargin * 2}px);
            pointer-events: none;
            border: 2px dashed rgba(128, 0, 0, 0.3);
            box-sizing: border-box;
            z-index: -1;
            display: none;
        `;
        
        // キャンバス要素の親に追加
        const parent = this.canvasElement.parentElement;
        if (parent) {
            if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(indicator);
            console.log('🎯 境界指示器作成完了');
        }
    }
    
    /**
     * グローバルポインター移動処理
     */
    handleGlobalPointerMove(event) {
        this.stats.totalMoveEvents++;
        
        try {
            const coordinates = this.getPointerCoordinates(event);
            const wasInside = this.isPointerInside;
            
            // 境界内判定
            this.isPointerInside = this.isInsideBoundary(coordinates.screen);
            
            // 境界越え検知
            if (!wasInside && this.isPointerInside) {
                this.handleBoundaryCrossIn(coordinates, event);
            } else if (wasInside && !this.isPointerInside) {
                this.handleBoundaryCrossOut(coordinates, event);
            }
            
            // 位置更新
            this.lastKnownPosition = coordinates.screen;
            
            // 境界指示器表示切替
            this.updateBoundaryIndicator();
            
        } catch (error) {
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }
    
    /**
     * キャンバスポインター入場処理
     */
    handleCanvasPointerEnter(event) {
        try {
            const coordinates = this.getPointerCoordinates(event);
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('boundary:canvas-enter', {
                    coordinates,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎯 キャンバス入場:', coordinates.canvas);
            
        } catch (error) {
            console.warn('⚠️ キャンバス入場処理エラー:', error.message);
        }
    }
    
    /**
     * キャンバスポインター退場処理
     */
    handleCanvasPointerLeave(event) {
        try {
            const coordinates = this.getPointerCoordinates(event);
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('boundary:canvas-leave', {
                    coordinates,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎯 キャンバス退場:', coordinates.canvas);
            
        } catch (error) {
            console.warn('⚠️ キャンバス退場処理エラー:', error.message);
        }
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        try {
            console.log('🔄 ウィンドウリサイズ検出');
            
            // 境界領域再計算
            this.initializeBoundaryArea();
            
            // 境界指示器更新
            this.createBoundaryIndicator();
            
            console.log('✅ リサイズ処理完了');
            
        } catch (error) {
            console.error('❌ リサイズ処理エラー:', error);
        }
    }
    
    /**
     * ポインター座標取得
     */
    getPointerCoordinates(event) {
        try {
            const rect = this.canvasElement.getBoundingClientRect();
            
            const screen = {
                x: event.clientX,
                y: event.clientY
            };
            
            const canvas = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            return {
                screen,
                canvas,
                pressure: event.pressure || 0.5
            };
            
        } catch (error) {
            console.error('❌ 座標取得エラー:', error);
            return {
                screen: { x: 0, y: 0 },
                canvas: { x: 0, y: 0 },
                pressure: 0.5
            };
        }
    }
    
    /**
     * 境界内判定
     */
    isInsideBoundary(screenCoords) {
        if (!this.boundaryArea) return false;
        
        return screenCoords.x >= this.boundaryArea.left &&
               screenCoords.x <= this.boundaryArea.right &&
               screenCoords.y >= this.boundaryArea.top &&
               screenCoords.y <= this.boundaryArea.bottom;
    }
    
    /**
     * 境界越え（入る）処理
     */
    handleBoundaryCrossIn(coordinates, originalEvent) {
        try {
            this.stats.crossInCount++;
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('boundary:cross-in', {
                    coordinates,
                    eventType: originalEvent.type,
                    pointerId: originalEvent.pointerId,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎯 境界越え（入る）:', coordinates.canvas);
            
        } catch (error) {
            console.error('❌ 境界越え（入る）処理エラー:', error);
        }
    }
    
    /**
     * 境界越え（出る）処理
     */
    handleBoundaryCrossOut(coordinates, originalEvent) {
        try {
            this.stats.crossOutCount++;
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('boundary:cross-out', {
                    coordinates,
                    eventType: originalEvent.type,
                    pointerId: originalEvent.pointerId,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎯 境界越え（出る）:', coordinates.canvas);
            
        } catch (error) {
            console.error('❌ 境界越え（出る）処理エラー:', error);
        }
    }
    
    /**
     * 境界指示器表示更新
     */
    updateBoundaryIndicator() {
        const indicator = document.querySelector('#boundary-indicator');
        if (!indicator) return;
        
        // ポインターが境界付近にいる時のみ表示
        const showIndicator = this.shouldShowBoundaryIndicator();
        indicator.style.display = showIndicator ? 'block' : 'none';
    }
    
    /**
     * 境界指示器表示判定
     */
    shouldShowBoundaryIndicator() {
        if (!this.boundaryArea || !this.lastKnownPosition) return false;
        
        const pos = this.lastKnownPosition;
        const margin = 50; // 表示判定マージン
        
        // キャンバス近くにいる場合のみ表示
        return pos.x >= this.boundaryArea.left - margin &&
               pos.x <= this.boundaryArea.right + margin &&
               pos.y >= this.boundaryArea.top - margin &&
               pos.y <= this.boundaryArea.bottom + margin;
    }
    
    /**
     * 描画範囲制限チェック
     */
    isPointInDrawingArea(canvasPoint) {
        if (!this.canvasElement) return false;
        
        const rect = this.canvasElement.getBoundingClientRect();
        
        return canvasPoint.x >= 0 &&
               canvasPoint.x <= rect.width &&
               canvasPoint.y >= 0 &&
               canvasPoint.y <= rect.height;
    }
    
    /**
     * 描画点をキャンバス内に制限
     */
    clampPointToCanvas(canvasPoint) {
        if (!this.canvasElement) return canvasPoint;
        
        const rect = this.canvasElement.getBoundingClientRect();
        
        return {
            x: Math.max(0, Math.min(rect.width, canvasPoint.x)),
            y: Math.max(0, Math.min(rect.height, canvasPoint.y))
        };
    }
    
    /**
     * 境界マージン設定
     */
    setBoundaryMargin(margin) {
        this.boundaryMargin = Math.max(0, margin);
        this.initializeBoundaryArea();
        this.createBoundaryIndicator();
        
        console.log('📐 境界マージン更新:', this.boundaryMargin + 'px');
    }
    
    /**
     * キャンバスサイズ更新
     */
    updateCanvasSize() {
        try {
            this.initializeBoundaryArea();
            this.createBoundaryIndicator();
            console.log('📐 キャンバスサイズ更新完了');
            
        } catch (error) {
            console.error('❌ キャンバスサイズ更新エラー:', error);
        }
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            ...this.stats,
            isPointerInside: this.isPointerInside,
            lastKnownPosition: this.lastKnownPosition,
            boundaryMargin: this.boundaryMargin,
            boundaryArea: this.boundaryArea
        };
    }
    
    /**
     * デバッグ情報
     */
    getDebugInfo() {
        const stats = this.getStats();
        
        console.group('🎯 BoundaryManager デバッグ情報');
        console.log('📋 バージョン:', this.version);
        console.log('📊 統計:', {
            crossInCount: stats.crossInCount,
            crossOutCount: stats.crossOutCount,
            totalMoveEvents: stats.totalMoveEvents
        });
        console.log('🎯 境界状態:', {
            isPointerInside: stats.isPointerInside,
            boundaryMargin: stats.boundaryMargin
        });
        console.log('📐 境界領域:', stats.boundaryArea);
        console.groupEnd();
        
        return stats;
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ BoundaryManager破棄開始...');
            
            // イベントリスナー削除
            document.removeEventListener('pointermove', this.handleGlobalPointerMove);
            window.removeEventListener('resize', this.handleWindowResize);
            
            // 境界指示器削除
            const indicator = document.querySelector('#boundary-indicator');
            if (indicator) {
                indicator.remove();
            }
            
            // 参照クリア
            this.canvasElement = null;
            this.canvasManager = null;
            this.boundaryArea = null;
            
            console.log('✅ BoundaryManager破棄完了');
            
        } catch (error) {
            console.error('❌ BoundaryManager破棄エラー:', error);
        }
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.BoundaryManager = BoundaryManager;
    console.log('✅ BoundaryManager v12 グローバル公開完了');
}

console.log('🎯 BoundaryManager v12-step3 準備完了');
console.log('📋 STEP3実装: 描画範囲制限・境界検知・ポインタートラッキング');
console.log('💡 使用例: const boundaryManager = new window.BoundaryManager(); boundaryManager.initialize(canvasElement);');