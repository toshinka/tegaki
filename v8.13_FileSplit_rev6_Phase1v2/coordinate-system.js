// ===== coordinate-system.js - Phase 0: 座標変換統合 =====
// TEGAKI Twin-Star System の座標変換を一元管理
// PixiJS v8.13準拠の座標変換API統合

(function() {
    'use strict';

    /**
     * 座標空間定義:
     * - screen: ブラウザ画面座標 (clientX, clientY)
     * - world: ワールドコンテナ内座標 (カメラ変形適用前)
     * - canvas: キャンバス座標 (描画対象座標)
     * - layer: レイヤーローカル座標 (レイヤー変形適用前)
     */
    
    class CoordinateSystem {
        constructor() {
            this.app = null;
            this.cameraSystem = null;
        }
        
        // 初期化（CoreEngineから呼び出し）
        initialize(app, cameraSystem) {
            this.app = app;
            this.cameraSystem = cameraSystem;
        }
        
        // === ペン描画用座標変換（レイヤー変形考慮なし） ===
        
        /**
         * coord: screen -> canvas (描画用)
         * ペン描画時の座標変換。レイヤーの変形は考慮しない
         */
        screenToCanvasForDrawing(screenX, screenY) {
            if (!this.cameraSystem?.canvasContainer) {
                console.warn('CoordinateSystem: canvasContainer not available');
                return { x: screenX, y: screenY };
            }
            
            const globalPoint = { x: screenX, y: screenY };
            return this.cameraSystem.canvasContainer.toLocal(globalPoint);
        }
        
        // === レイヤー操作用座標変換（レイヤー変形考慮） ===
        
        /**
         * coord: screen -> world
         * レイヤー操作時の座標変換。カメラ変形のみ考慮
         */
        screenToWorld(screenX, screenY) {
            if (!this.app?.stage) {
                console.warn('CoordinateSystem: stage not available');
                return { x: screenX, y: screenY };
            }
            
            const globalPoint = { x: screenX, y: screenY };
            return this.app.stage.toLocal(globalPoint);
        }
        
        /**
         * coord: world -> layer
         * ワールド座標からレイヤーローカル座標への変換
         */
        worldToLayer(layer, worldX, worldY) {
            if (!layer || typeof layer.toLocal !== 'function') {
                console.warn('CoordinateSystem: invalid layer for coordinate conversion');
                return { x: worldX, y: worldY };
            }
            
            const worldPoint = { x: worldX, y: worldY };
            return layer.toLocal(worldPoint);
        }
        
        /**
         * coord: layer -> world
         * レイヤーローカル座標からワールド座標への変換
         */
        layerToWorld(layer, layerX, layerY) {
            if (!layer || typeof layer.toGlobal !== 'function') {
                console.warn('CoordinateSystem: invalid layer for coordinate conversion');
                return { x: layerX, y: layerY };
            }
            
            const layerPoint = { x: layerX, y: layerY };
            return layer.toGlobal(layerPoint);
        }
        
        /**
         * coord: world -> screen
         * ワールド座標からスクリーン座標への変換
         */
        worldToScreen(worldX, worldY) {
            if (!this.app?.stage) {
                console.warn('CoordinateSystem: stage not available');
                return { x: worldX, y: worldY };
            }
            
            const worldPoint = { x: worldX, y: worldY };
            return this.app.stage.toGlobal(worldPoint);
        }
        
        /**
         * coord: canvas -> screen
         * キャンバス座標からスクリーン座標への変換
         */
        canvasToScreen(canvasX, canvasY) {
            if (!this.cameraSystem?.canvasContainer) {
                console.warn('CoordinateSystem: canvasContainer not available');
                return { x: canvasX, y: canvasY };
            }
            
            const canvasPoint = { x: canvasX, y: canvasY };
            return this.cameraSystem.canvasContainer.toGlobal(canvasPoint);
        }
        
        // === 変形計算ユーティリティ ===
        
        /**
         * pivot考慮の変形計算
         * @param {Object} point - 変形対象の座標
         * @param {Object} pivot - 基準点座標
         * @param {Object} transform - 変形パラメータ {x, y, rotation, scaleX, scaleY}
         * @returns {Object} 変形後の座標
         */
        transformPointWithPivot(point, pivot, transform) {
            // PIXI.Matrix を使用した精密な変形計算
            const matrix = new PIXI.Matrix();
            
            // 変形順序: pivot中心に移動 → 変形 → 戻す → オフセット適用
            matrix.translate(-pivot.x, -pivot.y);
            matrix.scale(transform.scaleX || 1, transform.scaleY || 1);
            matrix.rotate(transform.rotation || 0);
            matrix.translate(pivot.x, pivot.y);
            matrix.translate(transform.x || 0, transform.y || 0);
            
            return matrix.apply(point);
        }
        
        /**
         * 変形行列作成
         * @param {Object} transform - 変形パラメータ
         * @param {Object} pivot - 基準点（省略時は原点）
         * @returns {PIXI.Matrix} 変形行列
         */
        createTransformMatrix(transform, pivot = {x: 0, y: 0}) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-pivot.x, -pivot.y);
            matrix.scale(transform.scaleX || 1, transform.scaleY || 1);
            matrix.rotate(transform.rotation || 0);
            matrix.translate(pivot.x, pivot.y);
            matrix.translate(transform.x || 0, transform.y || 0);
            
            return matrix;
        }
        
        // === 座標空間検証 ===
        
        /**
         * 拡張キャンバス範囲内かチェック
         * @param {Object} canvasPoint - キャンバス座標
         * @param {number} margin - 拡張マージン
         * @returns {boolean} 範囲内の場合true
         */
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            const CONFIG = window.TEGAKI_CONFIG;
            if (!CONFIG) {
                console.warn('CoordinateSystem: CONFIG not available');
                return false;
            }
            
            return canvasPoint.x >= -margin && 
                   canvasPoint.x <= CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && 
                   canvasPoint.y <= CONFIG.canvas.height + margin;
        }
        
        /**
         * 座標の妥当性検証
         * @param {Object} point - 検証する座標
         * @param {string} expectedSpace - 期待される座標空間名
         * @returns {boolean} 妥当な場合true
         */
        validateCoordinate(point, expectedSpace) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                console.warn(`CoordinateSystem: Invalid coordinate for ${expectedSpace}:`, point);
                return false;
            }
            
            if (!isFinite(point.x) || !isFinite(point.y)) {
                console.warn(`CoordinateSystem: Non-finite coordinate for ${expectedSpace}:`, point);
                return false;
            }
            
            return true;
        }
        
        // === デバッグ用座標情報 ===
        
        /**
         * 現在の座標情報をログ出力
         * @param {number} screenX - スクリーン座標X
         * @param {number} screenY - スクリーン座標Y
         */
        logCoordinateInfo(screenX, screenY) {
            if (!window.TEGAKI_CONFIG?.debug) return;
            
            const canvasPoint = this.screenToCanvasForDrawing(screenX, screenY);
            const worldPoint = this.screenToWorld(screenX, screenY);
            
            console.log('Coordinate System Debug Info:', {
                screen: { x: screenX, y: screenY },
                canvas: canvasPoint,
                world: worldPoint,
                timestamp: Date.now()
            });
        }
    }
    
    // === グローバル公開 ===
    window.CoordinateSystem = CoordinateSystem;
    
    // コンビニエンス関数もグローバルに公開
    window.CoordUtils = {
        // coord: screen -> canvas (描画用)
        screenToCanvas: (app, screenX, screenY) => {
            const coord = new CoordinateSystem();
            coord.initialize(app, app.cameraSystem);
            return coord.screenToCanvasForDrawing(screenX, screenY);
        },
        
        // coord: screen -> world (レイヤー操作用)
        screenToWorld: (app, screenX, screenY) => {
            const globalPoint = { x: screenX, y: screenY };
            return app.stage.toLocal(globalPoint);
        },
        
        // coord: world -> screen
        worldToScreen: (app, worldX, worldY) => {
            const worldPoint = { x: worldX, y: worldY };
            return app.stage.toGlobal(worldPoint);
        }
    };

})();