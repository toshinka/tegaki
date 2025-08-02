/**
 * PixiJS統一座標システム v3.2
 * PixiJS自然座標系活用による座標問題完全根絶
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';

/**
 * PixiJS統一座標管理クラス
 * 座標変換レイヤー不要・PixiJS標準座標系の自然活用
 */
export class PixiCoordinateUnifier {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        this.stage = pixiApp.stage;
        
        // PixiJS自然座標系情報（変換不要）
        this.viewport = {
            width: pixiApp.view.width,
            height: pixiApp.view.height,
            scale: 1.0,
            offsetX: 0,
            offsetY: 0
        };
        
        // PixiJS標準座標系（左上原点・Y軸下向き）
        this.coordinateSystem = {
            origin: 'top-left',
            yDirection: 'down',
            unified: true,
            pixiNative: true
        };
        
        // 座標変換統計（デバッグ用）
        this.stats = {
            totalTransforms: 0,
            screenToPixiCalls: 0,
            pixiToScreenCalls: 0,
            errorCount: 0
        };
        
        this.isReady = false;
        this.initialize();
    }
    
    /**
     * 初期化: PixiJS統一座標系設定
     */
    initialize() {
        try {
            // PixiJS InteractionManager設定
            this.setupPixiInteraction();
            
            // 座標系デバッグ表示設定
            this.setupCoordinateDebug();
            
            // ビューポート監視設定
            this.setupViewportMonitoring();
            
            this.isReady = true;
            console.log('📐 PixiJS統一座標システム初期化完了');
            
        } catch (error) {
            console.error('❌ PixiJS座標統一初期化エラー:', error);
            this.stats.errorCount++;
        }
    }
    
    /**
     * PixiJS InteractionManager設定
     */
    setupPixiInteraction() {
        // PixiJS統一インタラクション有効化
        this.stage.interactive = true;
        this.stage.hitArea = new PIXI.Rectangle(0, 0, this.viewport.width, this.viewport.height);
        
        // デバッグ用座標表示
        this.stage.on('pointermove', (event) => {
            this.handlePointerMove(event);
        });
        
        console.log('🎯 PixiJS InteractionManager統一設定完了');
    }
    
    /**
     * 座標デバッグ表示設定
     */
    setupCoordinateDebug() {
        if (process.env.NODE_ENV === 'development') {
            // デバッグ用座標グリッド（PixiJS Graphics活用）
            this.debugGrid = new PIXI.Graphics();
            this.drawCoordinateGrid();
            this.stage.addChild(this.debugGrid);
            
            // 座標情報表示テキスト
            this.debugText = new PIXI.Text('座標: (0, 0)', {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0x800000,
                stroke: 0xffffff,
                strokeThickness: 1
            });
            this.debugText.x = 10;
            this.debugText.y = 10;
            this.stage.addChild(this.debugText);
        }
    }
    
    /**
     * PixiJS座標デバッググリッド描画
     */
    drawCoordinateGrid() {
        this.debugGrid.clear();
        this.debugGrid.lineStyle(1, 0xaa5a56, 0.3);
        
        const gridSize = 50;
        const width = this.viewport.width;
        const height = this.viewport.height;
        
        // 垂直グリッド線
        for (let x = 0; x <= width; x += gridSize) {
            this.debugGrid.moveTo(x, 0);
            this.debugGrid.lineTo(x, height);
        }
        
        // 水平グリッド線
        for (let y = 0; y <= height; y += gridSize) {
            this.debugGrid.moveTo(0, y);
            this.debugGrid.lineTo(width, y);
        }
        
        // 原点マーカー（左上）
        this.debugGrid.lineStyle(3, 0x800000, 0.8);
        this.debugGrid.drawCircle(0, 0, 5);
        
        // 中心マーカー
        this.debugGrid.lineStyle(2, 0xf0e0d6, 0.6);
        this.debugGrid.drawCircle(width / 2, height / 2, 3);
    }
    
    /**
     * ビューポート監視設定
     */
    setupViewportMonitoring() {
        // リサイズ監視
        window.addEventListener('resize', () => {
            this.updateViewport();
        });
        
        // DevicePixelRatio変更監視
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            mediaQuery.addEventListener('change', () => {
                this.handleDPRChange();
            });
        }
    }
    
    /**
     * スクリーン座標→PixiJS座標変換（直接変換・誤差なし）
     */
    screenToPixi(screenX, screenY) {
        this.stats.screenToPixiCalls++;
        
        try {
            // PixiJS標準API活用（最も正確）
            const globalPoint = new PIXI.Point(screenX, screenY);
            const pixiPoint = this.stage.toLocal(globalPoint);
            
            this.stats.totalTransforms++;
            
            return {
                x: pixiPoint.x,
                y: pixiPoint.y,
                source: 'pixi-native',
                accurate: true
            };
            
        } catch (error) {
            console.error('❌ スクリーン→PixiJS座標変換エラー:', error);
            this.stats.errorCount++;
            
            // フォールバック: 基本的な変換
            return {
                x: screenX - this.viewport.offsetX,
                y: screenY - this.viewport.offsetY,
                source: 'fallback',
                accurate: false
            };
        }
    }
    
    /**
     * PixiJS座標→スクリーン座標変換
     */
    pixiToScreen(pixiX, pixiY) {
        this.stats.pixiToScreenCalls++;
        
        try {
            // PixiJS標準API活用
            const pixiPoint = new PIXI.Point(pixiX, pixiY);
            const globalPoint = this.stage.toGlobal(pixiPoint);
            
            this.stats.totalTransforms++;
            
            return {
                x: globalPoint.x,
                y: globalPoint.y,
                source: 'pixi-native',
                accurate: true
            };
            
        } catch (error) {
            console.error('❌ PixiJS→スクリーン座標変換エラー:', error);
            this.stats.errorCount++;
            
            // フォールバック
            return {
                x: pixiX + this.viewport.offsetX,
                y: pixiY + this.viewport.offsetY,
                source: 'fallback',
                accurate: false
            };
        }
    }
    
    /**
     * グローバル座標→ローカル座標変換（PixiJS Container対応）
     */
    globalToLocal(globalPoint, container) {
        try {
            if (container && container.toLocal) {
                return container.toLocal(globalPoint, this.stage);
            }
            
            return this.screenToPixi(globalPoint.x, globalPoint.y);
            
        } catch (error) {
            console.error('❌ グローバル→ローカル座標変換エラー:', error);
            this.stats.errorCount++;
            return { x: 0, y: 0, source: 'error', accurate: false };
        }
    }
    
    /**
     * ベクター座標保持（非破壊変換）
     */
    preserveVectorCoordinates(points, transform) {
        try {
            return points.map((point, index) => {
                const originalPoint = { ...point };
                let transformedPoint = { ...point };
                
                if (transform && typeof transform.apply === 'function') {
                    const pixiPoint = new PIXI.Point(point.x, point.y);
                    transform.apply(pixiPoint, pixiPoint);
                    transformedPoint = {
                        x: pixiPoint.x,
                        y: pixiPoint.y
                    };
                }
                
                return {
                    ...originalPoint, // 元データ完全保持
                    transformed: transformedPoint,
                    original: originalPoint,
                    index: index,
                    preserved: true,
                    timestamp: Date.now()
                };
            });
            
        } catch (error) {
            console.error('❌ ベクター座標保持エラー:', error);
            this.stats.errorCount++;
            return points; // 元データそのまま返却
        }
    }
    
    /**
     * ポインターイベント処理（座標デバッグ）
     */
    handlePointerMove(event) {
        if (this.debugText) {
            const localPos = event.data.getLocalPosition(this.stage);
            this.debugText.text = `座標: (${Math.round(localPos.x)}, ${Math.round(localPos.y)})`;
            
            // EventStore経由で座標情報発信
            this.eventStore.emit('coordinate:update', {
                pixi: { x: localPos.x, y: localPos.y },
                screen: { x: event.data.global.x, y: event.data.global.y },
                unified: true
            });
        }
    }
    
    /**
     * ビューポート更新
     */
    updateViewport() {
        try {
            const oldViewport = { ...this.viewport };
            
            this.viewport.width = this.app.view.width;
            this.viewport.height = this.app.view.height;
            
            // PixiJS側も更新
            this.app.renderer.resize(this.viewport.width, this.viewport.height);
            
            // デバッググリッド再描画
            if (this.debugGrid) {
                this.drawCoordinateGrid();
            }
            
            // ヒットエリア更新
            this.stage.hitArea = new PIXI.Rectangle(0, 0, this.viewport.width, this.viewport.height);
            
            // EventStore通知
            this.eventStore.emit('viewport:updated', {
                old: oldViewport,
                new: this.viewport,
                pixiNative: true
            });
            
            console.log('📐 PixiJS統一ビューポート更新:', this.viewport);
            
        } catch (error) {
            console.error('❌ ビューポート更新エラー:', error);
            this.stats.errorCount++;
        }
    }
    
    /**
     * DevicePixelRatio変更処理
     */
    handleDPRChange() {
        try {
            const newDPR = window.devicePixelRatio || 1;
            this.app.renderer.resolution = newDPR;
            this.updateViewport();
            
            console.log('📐 DevicePixelRatio更新:', newDPR);
            
        } catch (error) {
            console.error('❌ DPR変更処理エラー:', error);
            this.stats.errorCount++;
        }
    }
    
    /**
     * 座標変換処理（PixiJS Matrix活用）
     */
    applyTransform(points, matrix) {
        try {
            if (!matrix || !Array.isArray(points)) {
                return points;
            }
            
            return points.map(point => {
                const pixiPoint = new PIXI.Point(point.x, point.y);
                matrix.apply(pixiPoint, pixiPoint);
                
                return {
                    ...point,
                    x: pixiPoint.x,
                    y: pixiPoint.y,
                    transformed: true,
                    matrix: matrix.clone()
                };
            });
            
        } catch (error) {
            console.error('❌ 座標変換処理エラー:', error);
            this.stats.errorCount++;
            return points;
        }
    }
    
    /**
     * 座標境界チェック
     */
    isWithinBounds(x, y) {
        return x >= 0 && x <= this.viewport.width && 
               y >= 0 && y <= this.viewport.height;
    }
    
    /**
     * 座標クランプ処理
     */
    clampCoordinates(x, y) {
        return {
            x: Math.max(0, Math.min(this.viewport.width, x)),
            y: Math.max(0, Math.min(this.viewport.height, y)),
            clamped: x < 0 || x > this.viewport.width || y < 0 || y > this.viewport.height
        };
    }
    
    /**
     * システム情報取得
     */
    getInfo() {
        return {
            system: 'PixiJS統一座標系',
            origin: this.coordinateSystem.origin,
            yDirection: this.coordinateSystem.yDirection,
            viewport: this.viewport,
            pixiNative: this.coordinateSystem.pixiNative,
            unified: this.coordinateSystem.unified,
            ready: this.isReady
        };
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            ...this.stats,
            accuracy: this.stats.errorCount === 0 ? 100 : 
                Math.max(0, 100 - (this.stats.errorCount / this.stats.totalTransforms * 100)),
            efficiency: 'pixi-native-optimized'
        };
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.isReady && this.app && this.stage;
    }
    
    /**
     * デバッグ表示切り替え
     */
    toggleDebugDisplay() {
        if (this.debugGrid) {
            this.debugGrid.visible = !this.debugGrid.visible;
        }
        if (this.debugText) {
            this.debugText.visible = !this.debugText.visible;
        }
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            if (this.debugGrid) {
                this.debugGrid.destroy();
            }
            if (this.debugText) {
                this.debugText.destroy();
            }
            
            console.log('📐 PixiJS統一座標システム破棄完了');
            
        } catch (error) {
            console.error('❌ 座標システム破棄エラー:', error);
        }
    }
}