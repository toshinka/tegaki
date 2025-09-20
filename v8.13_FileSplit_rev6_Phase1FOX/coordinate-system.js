// ===== coordinate-system.js =====
// Phase 0.1: 座標系統一と明示的変換API
// PixiJS v8.13に最適化された座標変換システム

window.CoordinateSystem = {
    /**
     * スクリーン座標をワールド座標に変換
     * coord: screen -> world
     * @param {PIXI.Application} app 
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {{x: number, y: number}}
     */
    screenToWorld(app, screenX, screenY) {
        // coord: screen -> world
        const point = new PIXI.Point(screenX, screenY);
        return app.stage.toLocal(point);
    },
    
    /**
     * スクリーン座標をキャンバス座標に変換（描画用）
     * coord: screen -> canvas (drawing)
     * @param {Object} canvasContainer
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {{x: number, y: number}}
     */
    screenToCanvas(canvasContainer, screenX, screenY) {
        // coord: screen -> canvas
        const globalPoint = { x: screenX, y: screenY };
        return canvasContainer.toLocal(globalPoint);
    },
    
    /**
     * ワールド座標をレイヤー座標に変換
     * coord: world -> layer
     * @param {PIXI.Container} layer 
     * @param {number} worldX 
     * @param {number} worldY 
     * @returns {{x: number, y: number}}
     */
    worldToLayer(layer, worldX, worldY) {
        // coord: world -> layer
        const worldPoint = new PIXI.Point(worldX, worldY);
        return layer.toLocal(worldPoint);
    },
    
    /**
     * レイヤー座標をワールド座標に変換
     * coord: layer -> world
     * @param {PIXI.Container} layer 
     * @param {number} layerX 
     * @param {number} layerY 
     * @returns {{x: number, y: number}}
     */
    layerToWorld(layer, layerX, layerY) {
        // coord: layer -> world
        const layerPoint = { x: layerX, y: layerY };
        return layer.toGlobal(layerPoint);
    },
    
    /**
     * キャンバス座標をスクリーン座標に変換
     * coord: canvas -> screen
     * @param {Object} canvasContainer
     * @param {number} canvasX 
     * @param {number} canvasY 
     * @returns {{x: number, y: number}}
     */
    canvasToScreen(canvasContainer, canvasX, canvasY) {
        // coord: canvas -> screen
        const canvasPoint = { x: canvasX, y: canvasY };
        return canvasContainer.toGlobal(canvasPoint);
    },
    
    /**
     * 変形行列を作成（pivot考慮）
     * @param {Object} transform - { x, y, rotation, scaleX, scaleY }
     * @param {number} pivotX
     * @param {number} pivotY
     * @returns {PIXI.Matrix}
     */
    createTransformMatrix(transform, pivotX, pivotY) {
        const matrix = new PIXI.Matrix();
        
        // 変形順序: pivot移動 → 変形適用 → pivot戻し
        matrix.translate(pivotX + transform.x, pivotY + transform.y);
        matrix.rotate(transform.rotation);
        matrix.scale(transform.scaleX, transform.scaleY);
        matrix.translate(-pivotX, -pivotY);
        
        return matrix;
    },
    
    /**
     * 点に変形を適用
     * @param {{x: number, y: number}} point 
     * @param {PIXI.Matrix} matrix 
     * @returns {{x: number, y: number}}
     */
    transformPoint(point, matrix) {
        return matrix.apply(point);
    },
    
    /**
     * 点のバッチ変形（パフォーマンス最適化）
     * @param {Array<{x: number, y: number}>} points 
     * @param {PIXI.Matrix} matrix 
     * @returns {Array<{x: number, y: number}>}
     */
    transformPoints(points, matrix) {
        const transformed = [];
        
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            
            // 座標検証
            if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                !isFinite(point.x) || !isFinite(point.y)) {
                console.warn(`Invalid point at index ${i}:`, point);
                continue;
            }
            
            // 変形適用
            const result = matrix.apply(point);
            
            // 結果検証
            if (typeof result.x === 'number' && typeof result.y === 'number' &&
                isFinite(result.x) && isFinite(result.y)) {
                transformed.push({ x: result.x, y: result.y });
            }
        }
        
        return transformed;
    },
    
    /**
     * 境界ボックス計算
     * @param {Array<{x: number, y: number}>} points 
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    calculateBounds(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const point of points) {
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    },
    
    /**
     * 点が矩形内にあるかチェック
     * @param {{x: number, y: number}} point 
     * @param {{x: number, y: number, width: number, height: number}} rect 
     * @param {number} margin 
     * @returns {boolean}
     */
    isPointInRect(point, rect, margin = 0) {
        return point.x >= rect.x - margin && 
               point.x <= rect.x + rect.width + margin &&
               point.y >= rect.y - margin && 
               point.y <= rect.y + rect.height + margin;
    },
    
    /**
     * 座標空間の検証（デバッグ用）
     * @param {{x: number, y: number, _coordSpace?: string}} point 
     * @param {string} expectedSpace 
     */
    validateCoordSpace(point, expectedSpace) {
        if (window.TEGAKI_CONFIG?.debug) {
            if (!point._coordSpace) {
                console.warn(`Point has no coordinate space tag, expected ${expectedSpace}`);
            } else if (point._coordSpace !== expectedSpace) {
                console.error(`Coordinate space mismatch! Expected ${expectedSpace}, got ${point._coordSpace}`);
            }
        }
    },
    
    /**
     * 座標空間タグ付け（デバッグ用）
     * @param {{x: number, y: number}} point 
     * @param {string} space 
     * @returns {{x: number, y: number, _coordSpace: string}}
     */
    tagCoordSpace(point, space) {
        if (window.TEGAKI_CONFIG?.debug) {
            return { ...point, _coordSpace: space };
        }
        return point;
    }
};