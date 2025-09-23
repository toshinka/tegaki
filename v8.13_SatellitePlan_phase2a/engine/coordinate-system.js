// ===== engine/coordinate-system.js - Twin-Star Architecture =====
// 責任: 全座標変換の一元管理・各座標空間の統一API

(function() {
    'use strict';
    
    // 設定取得
    const CONFIG = window.TegakiConfig;
    const DEBUG_MODE = CONFIG?.debug || false;
    
    // === 座標空間検証システム ===
    class CoordinateValidator {
        static validatePoint(point, expectedSpace) {
            if (!DEBUG_MODE) return;
            
            if (!window.TegakiUtils.validatePoint(point)) {
                console.error('Invalid point:', point);
                return;
            }
            
            // デバッグモード時の座標空間タグ付け
            if (expectedSpace) {
                point._coordSpace = expectedSpace;
                point._timestamp = Date.now();
            }
        }
        
        static checkSpaceMismatch(point, expectedSpace) {
            if (!DEBUG_MODE) return;
            
            if (point._coordSpace && point._coordSpace !== expectedSpace) {
                console.warn(`Coordinate space mismatch: expected ${expectedSpace}, got ${point._coordSpace}`);
            }
        }
        
        static logTransform(from, to, fromSpace, toSpace) {
            if (!DEBUG_MODE) return;
            
            window.TegakiUtils.log(`coord: ${fromSpace} -> ${toSpace}`, 
                       `(${from.x.toFixed(1)}, ${from.y.toFixed(1)}) -> (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`);
        }
    }
    
    // === 統一座標変換システム（Twin-Star Architecture版） ===
    class CoordinateSystem {
        constructor(app) {
            this.app = app;
            
            // 内部参照キャッシュ（パフォーマンス最適化）
            this._referenceCache = {
                worldContainer: null,
                canvasContainer: null,
                lastCacheTime: 0,
                cacheValidDuration: 5000 // 5秒間キャッシュ有効
            };
            
            this.debugMode = DEBUG_MODE;
        }
        
        // === 基本変換メソッド ===
        
        // coord: screen -> world
        screenToWorld(screenX, screenY) {
            const point = new PIXI.Point(screenX, screenY);
            const worldPoint = this.app.stage.toLocal(point);
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform({x: screenX, y: screenY}, worldPoint, 'screen', 'world');
            
            return worldPoint;
        }
        
        // coord: world -> screen  
        worldToScreen(worldX, worldY) {
            const point = new PIXI.Point(worldX, worldY);
            const screenPoint = this.app.stage.toGlobal(point);
            
            CoordinateValidator.validatePoint(screenPoint, 'screen');
            CoordinateValidator.logTransform({x: worldX, y: worldY}, screenPoint, 'world', 'screen');
            
            return screenPoint;
        }
        
        // coord: world -> layer
        worldToLayer(layer, worldX, worldY) {
            const point = new PIXI.Point(worldX, worldY);
            const layerPoint = layer.container ? layer.container.toLocal(point) : layer.toLocal(point);
            
            CoordinateValidator.validatePoint(layerPoint, 'layer');
            CoordinateValidator.logTransform({x: worldX, y: worldY}, layerPoint, 'world', 'layer');
            
            return layerPoint;
        }
        
        // coord: layer -> world
        layerToWorld(layer, layerX, layerY) {
            const point = new PIXI.Point(layerX, layerY);
            const worldPoint = layer.container ? layer.container.toGlobal(point) : layer.toGlobal(point);
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform({x: layerX, y: layerY}, worldPoint, 'layer', 'world');
            
            return worldPoint;
        }
        
        // 汎用変形処理
        transformPoint(point, pivot, transform) {
            CoordinateValidator.validatePoint(point, 'input');
            CoordinateValidator.validatePoint(pivot, 'pivot');
            
            try {
                // pivot中心の変形を適用
                const dx = point.x - pivot.x;
                const dy = point.y - pivot.y;
                
                // 回転
                const cos = Math.cos(transform.rotation || 0);
                const sin = Math.sin(transform.rotation || 0);
                const rx = dx * cos - dy * sin;
                const ry = dx * sin + dy * cos;
                
                // スケール
                const scaleX = transform.scaleX || transform.scale || 1;
                const scaleY = transform.scaleY || transform.scale || 1;
                const sx = rx * scaleX;
                const sy = ry * scaleY;
                
                // 平行移動
                const result = {
                    x: sx + pivot.x + (transform.x || 0),
                    y: sy + pivot.y + (transform.y || 0)
                };
                
                CoordinateValidator.validatePoint(result, 'transformed');
                CoordinateValidator.logTransform(point, result, 'input', 'transformed');
                
                return result;
            } catch (error) {
                console.error('CoordinateSystem.transformPoint failed:', error);
                return point;
            }
        }
        
        // 変形行列作成
        createTransformMatrix(transform, centerX, centerY) {
            try {
                const matrix = new PIXI.Matrix();
                if (!transform) return matrix;
                
                matrix.translate(-centerX, -centerY);
                
                if (transform.rotation && transform.rotation !== 0) {
                    matrix.rotate(transform.rotation);
                }
                
                if (transform.scaleX !== undefined && transform.scaleY !== undefined) {
                    matrix.scale(transform.scaleX, transform.scaleY);
                } else if (transform.scale && transform.scale !== 1) {
                    matrix.scale(transform.scale, transform.scale);
                }
                
                matrix.translate(centerX, centerY);
                
                if (transform.x || transform.y) {
                    matrix.translate(transform.x || 0, transform.y || 0);
                }
                
                return matrix;
            } catch (error) {
                console.error('CoordinateSystem.createTransformMatrix failed:', error);
                return new PIXI.Matrix();
            }
        }
        
        // 逆変形行列作成
        createInverseTransformMatrix(transform, centerX, centerY) {
            try {
                const matrix = new PIXI.Matrix();
                if (!transform) return matrix;
                
                if (transform.x || transform.y) {
                    matrix.translate(-(transform.x || 0), -(transform.y || 0));
                }
                matrix.translate(-centerX, -centerY);
                
                if (transform.scaleX !== undefined && transform.scaleY !== undefined && 
                    transform.scaleX !== 0 && transform.scaleY !== 0) {
                    matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                } else if (transform.scale && transform.scale !== 0 && transform.scale !== 1) {
                    matrix.scale(1/transform.scale, 1/transform.scale);
                }
                
                if (transform.rotation && transform.rotation !== 0) {
                    matrix.rotate(-transform.rotation);
                }
                
                matrix.translate(centerX, centerY);
                
                return matrix;
            } catch (error) {
                console.error('CoordinateSystem.createInverseTransformMatrix failed:', error);
                return new PIXI.Matrix();
            }
        }
        
        // 行列を点に適用
        applyMatrix(point, matrix) {
            CoordinateValidator.validatePoint(point, 'input');
            
            try {
                if (!matrix || typeof matrix.apply !== 'function') {
                    console.warn('CoordinateSystem.applyMatrix: Invalid matrix:', matrix);
                    return point;
                }
                
                const result = matrix.apply(point);
                CoordinateValidator.validatePoint(result, 'transformed');
                CoordinateValidator.logTransform(point, result, 'input', 'transformed');
                return result;
            } catch (error) {
                console.error('CoordinateSystem.applyMatrix failed:', error);
                return point;
            }
        }
        
        // 座標系境界検証
        isPointInCanvasBounds(canvasPoint, margin = 0) {
            const config = CONFIG || { canvas: { defaultWidth: 400, defaultHeight: 400 } };
            return canvasPoint.x >= -margin && 
                   canvasPoint.x <= config.canvas.defaultWidth + margin &&
                   canvasPoint.y >= -margin && 
                   canvasPoint.y <= config.canvas.defaultHeight + margin;
        }
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return this.isPointInCanvasBounds(canvasPoint, margin);
        }
        
        // 座標変換精度テスト
        testCoordinateAccuracy(app) {
            if (!DEBUG_MODE) {
                console.log('CoordinateSystem.testCoordinateAccuracy: Requires DEBUG_MODE');
                return;
            }
            
            console.log('=== Coordinate System Accuracy Test ===');
            
            const testPoints = [
                { x: 0, y: 0 },
                { x: 100, y: 100 },
                { x: 200, y: 150 },
                { x: -50, y: 300 }
            ];
            
            testPoints.forEach((screenPoint, i) => {
                const worldPoint = this.screenToWorld(screenPoint.x, screenPoint.y);
                const backToScreen = this.worldToScreen(worldPoint.x, worldPoint.y);
                
                const accuracy = Math.sqrt(
                    Math.pow(screenPoint.x - backToScreen.x, 2) + 
                    Math.pow(screenPoint.y - backToScreen.y, 2)
                );
                
                console.log(`Test ${i+1}: accuracy = ${accuracy.toFixed(6)}px`);
                
                if (accuracy > 0.001) {
                    console.warn(`Low accuracy detected: ${accuracy}px`);
                }
            });
            
            console.log('=== Coordinate Accuracy Test completed ===');
        }
        
        // デバッグ用座標空間情報取得
        getCoordinateInfo(point) {
            if (!DEBUG_MODE) return null;
            
            return {
                coords: { x: point.x, y: point.y },
                space: point._coordSpace || 'unknown',
                timestamp: point._timestamp || null,
                isValid: window.TegakiUtils.validatePoint(point)
            };
        }
    }
    
    // === グローバル公開 ===
    window.CoordinateSystem = CoordinateSystem;
    
    // デバッグモード時の初期化ログ
    if (DEBUG_MODE) {
        console.log('✅ CoordinateSystem initialized (Twin-Star Architecture)');
        console.log('Available methods:', Object.getOwnPropertyNames(CoordinateSystem.prototype).filter(key => typeof CoordinateSystem.prototype[key] === 'function'));
    } else {
        console.log('✅ CoordinateSystem initialized (Production Mode)');
    }
    
})();