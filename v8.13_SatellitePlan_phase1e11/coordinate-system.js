// ===== coordinate-system.js - Phase2準備版：安全参照実装 =====
// GPT5指摘の脆弱なlabel検索を修正・明示的参照による安全化・パフォーマンス最適化

/*
=== Phase2準備版 座標系モジュール ===

【主要修正内容】
- 脆弱なlabel検索の安全化（GPT5指摘対応）
- 明示的参照による高速化
- CoreRuntime連携による安定性向上
- パフォーマンス最適化

【修正パターン】
変更前（脆弱）:
  const worldContainer = app.stage.children.find(child => child.label === 'worldContainer');

変更後（安全）:
  const worldContainer = this._worldContainer || this.getWorldContainer();

【座標空間】
- screen: ブラウザスクリーン座標（マウス・タッチイベント）
- world: ワールド座標（カメラ変形適用後）
- canvas: キャンバス座標（描画用、レイヤー変形なし）
- layer: レイヤーローカル座標（レイヤー変形考慮）

【CoreRuntime連携】
- CoreRuntime.init()時に安全な参照が自動設定される
- setContainers()で明示的参照を提供
- フォールバック時は警告ログを出力
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
    
    // === 統一座標変換システム（安全参照版） ===
    const CoordinateSystem = {
        
        // === 内部参照（CoreRuntimeから設定） ===
        _worldContainer: null,
        _canvasContainer: null,
        _app: null,
        
        // === 参照キャッシュ（パフォーマンス最適化） ===
        _referenceCache: {
            worldContainer: null,
            canvasContainer: null,
            lastCacheTime: 0,
            cacheValidDuration: 5000 // 5秒間キャッシュ有効
        },
        
        // === CoreRuntimeからの安全参照設定 ===
        setContainers(containers) {
            this._worldContainer = containers.worldContainer;
            this._canvasContainer = containers.canvasContainer;
            this._app = containers.app;
            
            // キャッシュクリア
            this._referenceCache.worldContainer = null;
            this._referenceCache.canvasContainer = null;
            this._referenceCache.lastCacheTime = 0;
            
            if (DEBUG_MODE) {
                console.log('CoordinateSystem: Safe container references set');
                console.log('   - worldContainer:', !!this._worldContainer);
                console.log('   - canvasContainer:', !!this._canvasContainer);
                console.log('   - app:', !!this._app);
            }
        },
        
        // === 安全なWorldContainer取得（キャッシュ付き） ===
        getWorldContainer() {
            // 明示的参照が利用可能な場合
            if (this._worldContainer) {
                return this._worldContainer;
            }
            
            // キャッシュチェック
            const now = Date.now();
            if (this._referenceCache.worldContainer && 
                (now - this._referenceCache.lastCacheTime) < this._referenceCache.cacheValidDuration) {
                return this._referenceCache.worldContainer;
            }
            
            // フォールバック検索（警告付き）
            if (DEBUG_MODE) {
                console.warn('CoordinateSystem: Using fallback worldContainer search (performance impact)');
            }
            
            const worldContainer = this._app?.stage.children.find(child => child.label === 'worldContainer') || null;
            
            // キャッシュ更新
            this._referenceCache.worldContainer = worldContainer;
            this._referenceCache.lastCacheTime = now;
            
            if (!worldContainer && DEBUG_MODE) {
                console.error('CoordinateSystem: worldContainer not found');
            }
            
            return worldContainer;
        },
        
        // === 安全なCanvasContainer取得（キャッシュ付き） ===
        getCanvasContainer() {
            // 明示的参照が利用可能な場合
            if (this._canvasContainer) {
                return this._canvasContainer;
            }
            
            // キャッシュチェック
            const now = Date.now();
            if (this._referenceCache.canvasContainer && 
                (now - this._referenceCache.lastCacheTime) < this._referenceCache.cacheValidDuration) {
                return this._referenceCache.canvasContainer;
            }
            
            // フォールバック検索（警告付き）
            if (DEBUG_MODE) {
                console.warn('CoordinateSystem: Using fallback canvasContainer search (performance impact)');
            }
            
            const worldContainer = this.getWorldContainer();
            const canvasContainer = worldContainer?.children.find(child => child.label === 'canvasContainer') || null;
            
            // キャッシュ更新
            this._referenceCache.canvasContainer = canvasContainer;
            this._referenceCache.lastCacheTime = now;
            
            if (!canvasContainer && DEBUG_MODE) {
                console.error('CoordinateSystem: canvasContainer not found');
            }
            
            return canvasContainer;
        },
        
        // === screen -> canvas (描画用・レイヤー変形を考慮しない) ===
        screenToCanvas(app, screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            CoordinateValidator.validatePoint(globalPoint, 'screen');
            
            // ✅ 安全参照使用
            const canvasContainer = this.getCanvasContainer();
            const canvasPoint = canvasContainer ? canvasContainer.toLocal(globalPoint) : globalPoint;
            
            CoordinateValidator.validatePoint(canvasPoint, 'canvas');
            CoordinateValidator.logTransform(globalPoint, canvasPoint, 'screen', 'canvas');
            
            return canvasPoint;
        },
        
        // === screen -> world (レイヤー操作用・カメラ変形考慮) ===
        screenToWorld(app, screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            CoordinateValidator.validatePoint(globalPoint, 'screen');
            
            // ✅ 安全参照使用
            const worldContainer = this.getWorldContainer();
            const worldPoint = worldContainer ? worldContainer.toLocal(globalPoint) : globalPoint;
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform(globalPoint, worldPoint, 'screen', 'world');
            
            return worldPoint;
        },
        
        // === world -> screen ===
        worldToScreen(app, worldX, worldY) {
            const worldPoint = { x: worldX, y: worldY };
            CoordinateValidator.validatePoint(worldPoint, 'world');
            
            // ✅ 安全参照使用
            const worldContainer = this.getWorldContainer();
            const screenPoint = worldContainer ? worldContainer.toGlobal(worldPoint) : worldPoint;
            
            CoordinateValidator.validatePoint(screenPoint, 'screen');
            CoordinateValidator.logTransform(worldPoint, screenPoint, 'world', 'screen');
            
            return screenPoint;
        },
        
        // === canvas -> world ===
        canvasToWorld(app, canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            CoordinateValidator.validatePoint(canvasPoint, 'canvas');
            
            // ✅ 安全参照使用
            const canvasContainer = this.getCanvasContainer();
            const worldPoint = canvasContainer ? canvasContainer.toGlobal(canvasPoint) : canvasPoint;
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform(canvasPoint, worldPoint, 'canvas', 'world');
            
            return worldPoint;
        },
        
        // === world -> layer (レイヤー変形考慮) ===
        worldToLayer(layer, worldX, worldY) {
            const worldPoint = { x: worldX, y: worldY };
            CoordinateValidator.validatePoint(worldPoint, 'world');
            
            if (!layer || typeof layer.toLocal !== 'function') {
                console.warn('CoordinateSystem.worldToLayer: Invalid layer object');
                return worldPoint;
            }
            
            const layerPoint = layer.toLocal(worldPoint);
            
            CoordinateValidator.validatePoint(layerPoint, 'layer');
            CoordinateValidator.logTransform(worldPoint, layerPoint, 'world', 'layer');
            
            return layerPoint;
        },
        
        // === layer -> world ===
        layerToWorld(layer, layerX, layerY) {
            const layerPoint = { x: layerX, y: layerY };
            CoordinateValidator.validatePoint(layerPoint, 'layer');
            
            if (!layer || typeof layer.toGlobal !== 'function') {
                console.warn('CoordinateSystem.layerToWorld: Invalid layer object');
                return layerPoint;
            }
            
            const worldPoint = layer.toGlobal(layerPoint);
            
            CoordinateValidator.validatePoint(worldPoint, 'world');
            CoordinateValidator.logTransform(layerPoint, worldPoint, 'layer', 'world');
            
            return worldPoint;
        },
        
        // === core-engine.jsから呼び出される互換メソッド ===
        globalToLocal(container, globalPoint) {
            CoordinateValidator.validatePoint(globalPoint, 'global');
            
            if (!container || typeof container.toLocal !== 'function') {
                console.warn('CoordinateSystem.globalToLocal: Invalid container:', container);
                return globalPoint;
            }
            
            try {
                const localPoint = container.toLocal(globalPoint);
                CoordinateValidator.validatePoint(localPoint, 'local');
                CoordinateValidator.logTransform(globalPoint, localPoint, 'global', 'local');
                return localPoint;
            } catch (error) {
                console.error('CoordinateSystem.globalToLocal conversion failed:', error);
                return globalPoint;
            }
        },
        
        localToGlobal(container, localPoint) {
            CoordinateValidator.validatePoint(localPoint, 'local');
            
            if (!container || typeof container.toGlobal !== 'function') {
                console.warn('CoordinateSystem.localToGlobal: Invalid container:', container);
                return localPoint;
            }
            
            try {
                const globalPoint = container.toGlobal(localPoint);
                CoordinateValidator.validatePoint(globalPoint, 'global');
                CoordinateValidator.logTransform(localPoint, globalPoint, 'local', 'global');
                return globalPoint;
            } catch (error) {
                console.error('CoordinateSystem.localToGlobal conversion failed:', error);
                return localPoint;
            }
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
                console.error('CoordinateSystem.transformPoint failed:', error);
                return point; // 座標変換は例外的にフォールバック許可
            }
        },
        
        // === 変形行列作成（core-engine.jsから使用） ===
        createTransformMatrix(transform, centerX, centerY) {
            try {
                if (!window.PIXI || !PIXI.Matrix) {
                    console.error('CoordinateSystem.createTransformMatrix: PIXI.Matrix not available');
                    return new PIXI.Matrix();
                }
                
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
        },
        
        // === 逆変形行列作成 ===
        createInverseTransformMatrix(transform, centerX, centerY) {
            try {
                if (!window.PIXI || !PIXI.Matrix) {
                    console.error('CoordinateSystem.createInverseTransformMatrix: PIXI.Matrix not available');
                    return new PIXI.Matrix();
                }
                
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
        },
        
        // === 行列を点に適用 ===
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
                console.error('CoordinateSystem.inverseTransformPoint failed:', error);
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
                console.log('CoordinateSystem.testCoordinateAccuracy: Requires DEBUG_MODE');
                return;
            }
            
            console.log('=== Coordinate System Accuracy Test (Safe References) ===');
            
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
            
            console.log('=== Safe References Test completed ===');
        },
        
        // === 参照状態の診断 ===
        diagnoseReferences() {
            const diagnosis = {
                safeReferences: {
                    worldContainer: !!this._worldContainer,
                    canvasContainer: !!this._canvasContainer,
                    app: !!this._app
                },
                fallbackAvailable: {
                    worldContainer: !!(this._app?.stage?.children),
                    canvasContainer: !!this.getWorldContainer()?.children
                },
                cache: {
                    worldContainer: !!this._referenceCache.worldContainer,
                    canvasContainer: !!this._referenceCache.canvasContainer,
                    cacheAge: Date.now() - this._referenceCache.lastCacheTime
                }
            };
            
            if (DEBUG_MODE) {
                console.log('CoordinateSystem Reference Diagnosis:', diagnosis);
                
                // 推奨事項
                if (!diagnosis.safeReferences.worldContainer || !diagnosis.safeReferences.canvasContainer) {
                    console.warn('⚠️  Safe references not set - performance impact possible');
                    console.log('💡 Recommendation: Call CoreRuntime.init() to set safe references');
                }
                
                if (diagnosis.cache.cacheAge > this._referenceCache.cacheValidDuration) {
                    console.log('ℹ️  Reference cache expired - will refresh on next access');
                }
            }
            
            return diagnosis;
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
        console.log('✅ CoordinateSystem initialized (Safe References Edition)');
        console.log('   - Safe reference support added');
        console.log('   - Performance cache implemented');  
        console.log('   - Fallback with warnings');
        console.log('Available methods:', Object.keys(CoordinateSystem).filter(key => typeof CoordinateSystem[key] === 'function'));
    } else {
        console.log('✅ CoordinateSystem initialized (Safe References, Production Mode)');
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