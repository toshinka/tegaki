/**
 * Coordinate System - PixiJS v8.13対応修正版
 * 座標変換・座標系統一管理
 */
(function() {
    'use strict';
    
    class CoordinateSystem {
        constructor() {
            // コンテナ参照
            this.app = null;
            this.worldContainer = null;
            this.canvasContainer = null;
            
            // 座標変換キャッシュ
            this.transformCache = new Map();
            this.cacheVersion = 0;
            
            console.log('✅ CoordinateSystem created');
        }
        
        /**
         * コンテナ参照設定（CoreEngineから呼び出し）
         */
        setContainers(containers) {
            this.app = containers.app;
            this.worldContainer = containers.worldContainer;
            this.canvasContainer = containers.canvasContainer;
            
            // キャッシュクリア
            this.invalidateCache();
            
            console.log('✅ CoordinateSystem containers set');
        }
        
        /**
         * スクリーン座標からキャンバス座標に変換
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         * @returns {Object} {x, y} キャンバス座標
         */
        screenToCanvas(screenX, screenY) {
            if (!this.canvasContainer) {
                console.warn('canvasContainer not available, returning raw coordinates');
                return { x: screenX, y: screenY };
            }
            
            try {
                const globalPoint = { x: screenX, y: screenY };
                return this.canvasContainer.toLocal(globalPoint);
            } catch (error) {
                console.warn('screenToCanvas conversion failed:', error);
                return { x: screenX, y: screenY };
            }
        }
        
        /**
         * キャンバス座標からスクリーン座標に変換
         * @param {number} canvasX - キャンバスX座標
         * @param {number} canvasY - キャンバスY座標
         * @returns {Object} {x, y} スクリーン座標
         */
        canvasToScreen(canvasX, canvasY) {
            if (!this.canvasContainer) {
                console.warn('canvasContainer not available, returning raw coordinates');
                return { x: canvasX, y: canvasY };
            }
            
            try {
                const canvasPoint = { x: canvasX, y: canvasY };
                return this.canvasContainer.toGlobal(canvasPoint);
            } catch (error) {
                console.warn('canvasToScreen conversion failed:', error);
                return { x: canvasX, y: canvasY };
            }
        }
        
        /**
         * ワールド座標からキャンバス座標に変換
         * @param {number} worldX - ワールドX座標
         * @param {number} worldY - ワールドY座標
         * @returns {Object} {x, y} キャンバス座標
         */
        worldToCanvas(worldX, worldY) {
            if (!this.worldContainer || !this.canvasContainer) {
                console.warn('containers not available, returning raw coordinates');
                return { x: worldX, y: worldY };
            }
            
            try {
                const worldPoint = { x: worldX, y: worldY };
                const globalPoint = this.worldContainer.toGlobal(worldPoint);
                return this.canvasContainer.toLocal(globalPoint);
            } catch (error) {
                console.warn('worldToCanvas conversion failed:', error);
                return { x: worldX, y: worldY };
            }
        }
        
        /**
         * キャンバス座標からワールド座標に変換
         * @param {number} canvasX - キャンバスX座標
         * @param {number} canvasY - キャンバスY座標
         * @returns {Object} {x, y} ワールド座標
         */
        canvasToWorld(canvasX, canvasY) {
            if (!this.worldContainer || !this.canvasContainer) {
                console.warn('containers not available, returning raw coordinates');
                return { x: canvasX, y: canvasY };
            }
            
            try {
                const canvasPoint = { x: canvasX, y: canvasY };
                const globalPoint = this.canvasContainer.toGlobal(canvasPoint);
                return this.worldContainer.toLocal(globalPoint);
            } catch (error) {
                console.warn('canvasToWorld conversion failed:', error);
                return { x: canvasX, y: canvasY };
            }
        }
        
        /**
         * 描画用座標変換（レイヤー変形を考慮しない）
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         * @returns {Object} {x, y} 描画座標
         */
        screenToDrawing(screenX, screenY) {
            return this.screenToCanvas(screenX, screenY);
        }
        
        /**
         * レイヤー座標変換（レイヤー変形を考慮）
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         * @param {PIXI.Container} layer - 対象レイヤー
         * @returns {Object} {x, y} レイヤーローカル座標
         */
        screenToLayer(screenX, screenY, layer) {
            if (!layer) {
                return this.screenToCanvas(screenX, screenY);
            }
            
            try {
                const globalPoint = { x: screenX, y: screenY };
                return layer.toLocal(globalPoint);
            } catch (error) {
                console.warn('screenToLayer conversion failed:', error);
                return this.screenToCanvas(screenX, screenY);
            }
        }
        
        /**
         * レイヤー座標からスクリーン座標に変換
         * @param {number} layerX - レイヤーX座標
         * @param {number} layerY - レイヤーY座標
         * @param {PIXI.Container} layer - 対象レイヤー
         * @returns {Object} {x, y} スクリーン座標
         */
        layerToScreen(layerX, layerY, layer) {
            if (!layer) {
                return this.canvasToScreen(layerX, layerY);
            }
            
            try {
                const layerPoint = { x: layerX, y: layerY };
                return layer.toGlobal(layerPoint);
            } catch (error) {
                console.warn('layerToScreen conversion failed:', error);
                return this.canvasToScreen(layerX, layerY);
            }
        }
        
        /**
         * 点がキャンバス範囲内かチェック
         * @param {Object} point - {x, y} キャンバス座標
         * @param {number} margin - マージン（デフォルト: 0）
         * @returns {boolean} 範囲内かどうか
         */
        isPointInCanvas(point, margin = 0) {
            const config = window.TEGAKI_CONFIG;
            if (!config) return true;
            
            return point.x >= -margin && 
                   point.x <= config.canvas.width + margin &&
                   point.y >= -margin && 
                   point.y <= config.canvas.height + margin;
        }
        
        /**
         * 点が拡張キャンバス範囲内かチェック
         * @param {Object} point - {x, y} キャンバス座標
         * @param {number} extendMargin - 拡張マージン（デフォルト: 50）
         * @returns {boolean} 拡張範囲内かどうか
         */
        isPointInExtendedCanvas(point, extendMargin = 50) {
            return this.isPointInCanvas(point, extendMargin);
        }
        
        /**
         * 矩形がキャンバス範囲と重なっているかチェック
         * @param {Object} rect - {x, y, width, height} 矩形
         * @returns {boolean} 重なっているかどうか
         */
        isRectOverlappingCanvas(rect) {
            const config = window.TEGAKI_CONFIG;
            if (!config) return true;
            
            return rect.x < config.canvas.width &&
                   rect.x + rect.width > 0 &&
                   rect.y < config.canvas.height &&
                   rect.y + rect.height > 0;
        }
        
        /**
         * キャンバスの中心座標を取得
         * @returns {Object} {x, y} キャンバス中心座標
         */
        getCanvasCenter() {
            const config = window.TEGAKI_CONFIG;
            if (!config) return { x: 200, y: 200 };
            
            return {
                x: config.canvas.width / 2,
                y: config.canvas.height / 2
            };
        }
        
        /**
         * キャンバスの境界矩形を取得
         * @returns {Object} {x, y, width, height} キャンバス境界
         */
        getCanvasBounds() {
            const config = window.TEGAKI_CONFIG;
            if (!config) return { x: 0, y: 0, width: 400, height: 400 };
            
            return {
                x: 0,
                y: 0,
                width: config.canvas.width,
                height: config.canvas.height
            };
        }
        
        /**
         * スクリーン境界矩形を取得
         * @returns {Object} {x, y, width, height} スクリーン境界
         */
        getScreenBounds() {
            if (!this.app) {
                return { x: 0, y: 0, width: 800, height: 600 };
            }
            
            return {
                x: 0,
                y: 0,
                width: this.app.screen.width,
                height: this.app.screen.height
            };
        }
        
        /**
         * 距離計算
         * @param {Object} point1 - {x, y} 点1
         * @param {Object} point2 - {x, y} 点2
         * @returns {number} 距離
         */
        getDistance(point1, point2) {
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        /**
         * 角度計算（ラジアン）
         * @param {Object} from - {x, y} 開始点
         * @param {Object} to - {x, y} 終了点
         * @returns {number} 角度（ラジアン）
         */
        getAngle(from, to) {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            return Math.atan2(dy, dx);
        }
        
        /**
         * 角度計算（度）
         * @param {Object} from - {x, y} 開始点
         * @param {Object} to - {x, y} 終了点
         * @returns {number} 角度（度）
         */
        getAngleDegrees(from, to) {
            return this.getAngle(from, to) * 180 / Math.PI;
        }
        
        /**
         * 点を回転
         * @param {Object} point - {x, y} 回転する点
         * @param {Object} center - {x, y} 回転中心
         * @param {number} angle - 回転角度（ラジアン）
         * @returns {Object} {x, y} 回転後の点
         */
        rotatePoint(point, center, angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            
            return {
                x: center.x + dx * cos - dy * sin,
                y: center.y + dx * sin + dy * cos
            };
        }
        
        /**
         * 点をスケール
         * @param {Object} point - {x, y} スケールする点
         * @param {Object} center - {x, y} スケール中心
         * @param {number} scaleX - X方向スケール
         * @param {number} scaleY - Y方向スケール
         * @returns {Object} {x, y} スケール後の点
         */
        scalePoint(point, center, scaleX, scaleY = scaleX) {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            
            return {
                x: center.x + dx * scaleX,
                y: center.y + dy * scaleY
            };
        }
        
        /**
         * 変形行列を適用
         * @param {Object} point - {x, y} 変形する点
         * @param {PIXI.Matrix} matrix - 変形行列
         * @returns {Object} {x, y} 変形後の点
         */
        applyMatrix(point, matrix) {
            if (!matrix) return point;
            
            try {
                return matrix.apply(point);
            } catch (error) {
                console.warn('Matrix application failed:', error);
                return point;
            }
        }
        
        /**
         * 変形行列を作成
         * @param {Object} transform - {x, y, rotation, scaleX, scaleY}
         * @param {Object} pivot - {x, y} 変形基点
         * @returns {PIXI.Matrix} 変形行列
         */
        createTransformMatrix(transform, pivot = { x: 0, y: 0 }) {
            const matrix = new PIXI.Matrix();
            
            // 変形の順序: 移動 → 回転 → スケール → 移動戻し
            matrix.translate(pivot.x + transform.x, pivot.y + transform.y);
            if (transform.rotation) matrix.rotate(transform.rotation);
            if (transform.scaleX !== 1 || transform.scaleY !== 1) {
                matrix.scale(transform.scaleX, transform.scaleY);
            }
            matrix.translate(-pivot.x, -pivot.y);
            
            return matrix;
        }
        
        /**
         * 逆変形行列を作成
         * @param {Object} transform - {x, y, rotation, scaleX, scaleY}
         * @param {Object} pivot - {x, y} 変形基点
         * @returns {PIXI.Matrix} 逆変形行列
         */
        createInverseTransformMatrix(transform, pivot = { x: 0, y: 0 }) {
            const matrix = this.createTransformMatrix(transform, pivot);
            return matrix.invert();
        }
        
        /**
         * 座標の正規化
         * @param {Object} point - {x, y} 正規化する点
         * @param {Object} bounds - {width, height} 正規化基準
         * @returns {Object} {x, y} 正規化された点（0-1の範囲）
         */
        normalizePoint(point, bounds) {
            return {
                x: point.x / bounds.width,
                y: point.y / bounds.height
            };
        }
        
        /**
         * 正規化座標から実座標に変換
         * @param {Object} normalizedPoint - {x, y} 正規化された点
         * @param {Object} bounds - {width, height} 変換基準
         * @returns {Object} {x, y} 実座標
         */
        denormalizePoint(normalizedPoint, bounds) {
            return {
                x: normalizedPoint.x * bounds.width,
                y: normalizedPoint.y * bounds.height
            };
        }
        
        /**
         * キャッシュの無効化
         */
        invalidateCache() {
            this.transformCache.clear();
            this.cacheVersion++;
        }
        
        /**
         * キャッシュされた変換の取得
         * @param {string} key - キャッシュキー
         * @returns {*} キャッシュされた値
         */
        getCachedTransform(key) {
            return this.transformCache.get(key);
        }
        
        /**
         * 変換をキャッシュ
         * @param {string} key - キャッシュキー
         * @param {*} value - キャッシュする値
         */
        setCachedTransform(key, value) {
            this.transformCache.set(key, value);
        }
        
        /**
         * デバッグ情報の取得
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                hasApp: !!this.app,
                hasWorldContainer: !!this.worldContainer,
                hasCanvasContainer: !!this.canvasContainer,
                cacheSize: this.transformCache.size,
                cacheVersion: this.cacheVersion,
                canvasBounds: this.getCanvasBounds(),
                screenBounds: this.getScreenBounds(),
                canvasCenter: this.getCanvasCenter()
            };
        }
    }
    
    // シングルトンインスタンスを作成してグローバル公開
    const coordinateSystem = new CoordinateSystem();
    window.CoordinateSystem = coordinateSystem;
    
    console.log('✅ coordinate-system.js loaded');
})();