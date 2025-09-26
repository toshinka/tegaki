// ===== coordinate-system.js - Phase0統一座標変換システム =====
// PixiJS v8.13最適化・デバッグ機能統合・変形行列統一処理

/*
=== Phase 0.1 座標系モジュール ===

【目的】
- 座標変換の統一API提供
- 座標空間の明示化（// coord: source -> destination）
- デバッグ用の座標空間検証機能
- 変形行列の統一処理（レイヤー変形・カメラ変形対応）

【対応座標空間】
- screen: ブラウザスクリーン座標（マウス・タッチイベント）
- world: ワールド座標（カメラ変形適用後）
- canvas: キャンバス座標（描画用、レイヤー変形なし）
- layer: レイヤーローカル座標（レイヤー変形考慮）

【使用パターン】
- CoordinateSystem.screenToCanvas(app, screenX, screenY) // coord: screen -> canvas
- CoordinateSystem.screenToWorld(app, screenX, screenY)  // coord: screen -> world
- CoordinateSystem.worldToLayer(layer, worldX, worldY)   // coord: world -> layer
- CoordinateSystem.transformPoint(point, pivot, transform) // 統一変形処理
*/

(function() {
    'use strict';
    
    // デバッグモード検出
    const DEBUG_MODE = window.TEGAKI_CONFIG?.debug || false;
    
    // === 座標空間検証システム ===
    class CoordinateValidator {
        static validatePoint(point, expectedSpace) {
            if (!DEBUG_MODE) return;
            
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                console.error('Invalid point:', point);
                return;
            }
            
            if (!isFinite(point.x) || !isFinite(point.y)) {
                console.error('Point contains invalid numbers:', point);
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
            
            console.log(`coord: ${fromSpace} -> ${toSpace}`, 
                       `(${from.x.toFixed(1)}, ${from.y.toFixed(1)}) -> (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`);
        }
    }
    
    // === 統一座標変換システム ===
    const CoordinateSystem = {
        
        // === screen -> canvas (描画用・レイヤー変形を考慮しない) ===
        screenToCanvas(app, screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            CoordinateValidator.validatePoint(globalPoint, 'screen');
            
            // CameraSystemのcanvasContainerへの変換を使用
            const canvasPoint = app.stage.children
                .find(child => child.label === 'worldContainer')
                ?.children.find(child => child.label === 'canvasContainer')
                ?.toLocal(globalPoint) || globalPoint;
            
            CoordinateValidator.validatePoint(canvasPoint, 'canvas');
            CoordinateValidator.logTransform(globalPoint, canvasPoint, 'screen', 'canvas');
            
            return canvasPoint;
        },
        
        // === screen -> world (レイヤー操作用・カメラ変形考慮) ===
        screenToWorld(app, screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            CoordinateValidator.validatePoint(globalPoint, 'screen');
            
            // WorldContainerへの変換
            const worldContainer = app.stage.children.find(child => child.label === 'worldContainer');
            const worldPoint = worldContainer ? worldContainer.toLocal(globalPoint) : globalPoint;
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform(globalPoint, worldPoint, 'screen', 'world');
            
            return worldPoint;
        },
        
        // === world -> screen ===
        worldToScreen(app, worldX, worldY) {
            const worldPoint = { x: worldX, y: worldY };
            CoordinateValidator.validatePoint(worldPoint, 'world');
            
            const worldContainer = app.stage.children.find(child => child.label === 'worldContainer');
            const screenPoint = worldContainer ? worldContainer.toGlobal(worldPoint) : worldPoint;
            
            CoordinateValidator.validatePoint(screenPoint, 'screen');
            CoordinateValidator.logTransform(worldPoint, screenPoint, 'world', 'screen');
            
            return screenPoint;
        },
        
        // === canvas -> world ===
        canvasToWorld(app, canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            CoordinateValidator.validatePoint(canvasPoint, 'canvas');
            
            const canvasContainer = app.stage.children
                .find(child => child.label === 'worldContainer')
                ?.children.find(child => child.label === 'canvasContainer');
            
            const worldPoint = canvasContainer ? canvasContainer.toGlobal(canvasPoint) : canvasPoint;
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform(canvasPoint, worldPoint, 'canvas', 'world');
            
            return worldPoint;
        },
        
        // === world -> layer (レイヤー変形考慮) ===
        worldToLayer(layer, worldX, worldY) {
            const worldPoint = { x: worldX, y: worldY };
            CoordinateValidator.validatePoint(worldPoint, 'world');
            
            const layerPoint = layer.toLocal(worldPoint);
            
            CoordinateValidator.validatePoint(layerPoint, 'layer');
            CoordinateValidator.logTransform(worldPoint, layerPoint, 'world', 'layer');
            
            return layerPoint;
        },
        
        // === layer -> world ===
        layerToWorld(layer, layerX, layerY) {
            const layerPoint = { x: layerX, y: layerY };
            CoordinateValidator.validatePoint(layerPoint, 'layer');
            
            const worldPoint = layer.toGlobal(layerPoint);
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform(layerPoint, worldPoint, 'layer', 'world');
            
            return worldPoint;
        },
        
        // === 統一変形処理 (pivot考慮) ===
        transformPoint(point, pivot, transform) {
            CoordinateValidator.validatePoint(point, 'input');
            CoordinateValidator.validatePoint(pivot, 'pivot');
            
            try {
                // PixiJS v8.13の変形行列を使用
                const matrix = new PIXI.Matrix();
                
                // 変形の順序: pivot移動 -> 回転・拡縮 -> pivot戻し -> 平行移動
                matrix.translate(-pivot.x, -pivot.y);
                
                if (transform.rotation && transform.rotation !== 0) {
                    matrix.rotate(transform.rotation);
                }
                
                if (transform.scaleX && transform.scaleY) {
                    matrix.scale(transform.scaleX, transform.scaleY);
                } else if (transform.scale) {
                    matrix.scale(transform.scale, transform.scale);
                }
                
                matrix.translate(pivot.x, pivot.y);
                
                if (transform.x || transform.y) {
                    matrix.translate(transform.x || 0, transform.y || 0);
                }
                
                const transformedPoint = matrix.apply(point);
                
                CoordinateValidator.validatePoint(transformedPoint, 'transformed');
                CoordinateValidator.logTransform(point, transformedPoint, 'input', 'transformed');
                
                return transformedPoint;
                
            } catch (error) {
                console.error('Transform failed:', error);
                return point; // フォールバック禁止だが、座標変換は例外
            }
        },
        
        // === 逆変形処理 ===
        inverseTransformPoint(point, pivot, transform) {
            CoordinateValidator.validatePoint(point, 'transformed');
            
            try {
                const matrix = new PIXI.Matrix();
                
                // 逆変形の順序（順変形の逆順）
                if (transform.x || transform.y) {
                    matrix.translate(-(transform.x || 0), -(transform.y || 0));
                }
                
                matrix.translate(-pivot.x, -pivot.y);
                
                if (transform.scaleX && transform.scaleY) {
                    matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                } else if (transform.scale && transform.scale !== 0) {
                    matrix.scale(1/transform.scale, 1/transform.scale);
                }
                
                if (transform.rotation && transform.rotation !== 0) {
                    matrix.rotate(-transform.rotation);
                }
                
                matrix.translate(pivot.x, pivot.y);
                
                const originalPoint = matrix.apply(point);
                
                CoordinateValidator.validatePoint(originalPoint, 'original');
                CoordinateValidator.logTransform(point, originalPoint, 'transformed', 'original');
                
                return originalPoint;
                
            } catch (error) {
                console.error('Inverse transform failed:', error);
                return point;
            }
        },
        
        // === 座標系境界検証 ===
        isPointInCanvasBounds(canvasPoint, margin = 0) {
            if (!window.TEGAKI_CONFIG) return true;
            
            const config = window.TEGAKI_CONFIG;
            return canvasPoint.x >= -margin && 
                   canvasPoint.x <= config.canvas.width + margin &&
                   canvasPoint.y >= -margin && 
                   canvasPoint.y <= config.canvas.height + margin;
        },
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return this.isPointInCanvasBounds(canvasPoint, margin);
        },
        
        // === デバッグ用座標空間情報取得 ===
        getCoordinateInfo(point) {
            if (!DEBUG_MODE) return null;
            
            return {
                coords: { x: point.x, y: point.y },
                space: point._coordSpace || 'unknown',
                timestamp: point._timestamp || null,
                isValid: isFinite(point.x) && isFinite(point.y)
            };
        },
        
        // === 座標変換精度テスト ===
        testCoordinateAccuracy(app) {
            if (!DEBUG_MODE) {
                console.log('Coordinate accuracy test requires DEBUG_MODE');
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
                // 往復変換テスト
                const canvasPoint = this.screenToCanvas(app, screenPoint.x, screenPoint.y);
                const worldPoint = this.screenToWorld(app, screenPoint.x, screenPoint.y);
                const backToScreen = this.worldToScreen(app, worldPoint.x, worldPoint.y);
                
                const accuracy = Math.sqrt(
                    Math.pow(screenPoint.x - backToScreen.x, 2) + 
                    Math.pow(screenPoint.y - backToScreen.y, 2)
                );
                
                console.log(`Test ${i+1}: accuracy = ${accuracy.toFixed(6)}px`);
                
                if (accuracy > 0.001) {
                    console.warn(`Low accuracy detected: ${accuracy}px`);
                }
            });
            
            console.log('=== Test completed ===');
        },
        
        // === レガシー互換性ブリッジ ===
        // 段階的移行のため、既存メソッドにアクセサを提供
        deprecatedScreenToCanvasForDrawing(app, screenX, screenY) {
            if (DEBUG_MODE) {
                console.warn('DEPRECATED: Use CoordinateSystem.screenToCanvas() instead');
            }
            
            // coord: screen -> canvas
            return this.screenToCanvas(app, screenX, screenY);
        }
    };
    
    // === グローバル公開 ===
    window.CoordinateSystem = CoordinateSystem;
    
    // デバッグモード時の初期化ログ
    if (DEBUG_MODE) {
        console.log('✅ CoordinateSystem initialized with debug features');
        console.log('Available methods:', Object.keys(CoordinateSystem));
    } else {
        console.log('✅ CoordinateSystem initialized (production mode)');
    }
    
    // 自動整合性チェック（PixiJS読み込み後）
    if (typeof PIXI !== 'undefined') {
        setTimeout(() => {
            if (window.drawingApp?.pixiApp) {
                CoordinateSystem.testCoordinateAccuracy(window.drawingApp.pixiApp);
            }
        }, 1000);
    }
    
})();