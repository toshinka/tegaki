/**
 * CoordinateUnification - 座標系統一管理クラス
 * 
 * 責務:
 * - 描画点（paths）と表示（PixiJS層）の座標を常に同期
 * - リサイズ・移動などの変形操作を描画データに即座に反映
 * - 二重座標系の排除により、ペン位置と描画位置の乖離を根絶
 * 
 * 原則:
 * - "Single Source of Truth": pathsデータが主、PixiJS層は投影
 * - 変形確定不要: 常にリアルタイム反映
 * - 座標基準統一: canvasContainer.toLocal()のみを座標変換の正式API
 */

(function() {
    'use strict';

    class CoordinateUnification {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;
            
            // レイヤー別の統合変形状態
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // 依存システム
            this.layerSystem = null;
            this.cameraSystem = null;
            this.canvasContainer = null;
            
            // 座標キャッシュ（パフォーマンス最適化）
            this.coordinateCache = new Map();
            this.cacheVersion = 0;
        }

        // ===== 初期化 =====
        
        init(layerSystem, cameraSystem, canvasContainer) {
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.canvasContainer = canvasContainer;
            
            this._setupEventListeners();
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            // レイヤー移動・回転・スケールイベント -> リアルタイム座標更新
            this.eventBus.on('layer:transform-updated', ({ layer, transform }) => {
                this._syncTransformToLayer(layer, transform);
            });

            // リサイズイベント -> 座標キャッシュ無効化
            this.eventBus.on('canvas:resize', () => {
                this.clearCoordinateCache();
            });

            // カメラ変形イベント -> 座標キャッシュ無効化
            this.eventBus.on('camera:transform-changed', () => {
                this.clearCoordinateCache();
            });
        }

        // ===== スクリーン → キャンバス座標変換（レイヤー無視） =====

        /**
         * スクリーン座標をキャンバスローカル座標に変換
         * （レイヤー変形の影響を受けない基本座標）
         */
        screenToCanvasLocal(screenX, screenY) {
            const cacheKey = `s2c_${screenX}_${screenY}_${this.cacheVersion}`;
            
            if (this.coordinateCache.has(cacheKey)) {
                return this.coordinateCache.get(cacheKey);
            }

            if (!this.cameraSystem?.canvasContainer) {
                return { x: screenX, y: screenY };
            }

            const canvas = this._getSafeCanvas();
            if (!canvas) {
                return { x: screenX, y: screenY };
            }

            const rect = canvas.getBoundingClientRect();
            const relativeX = screenX - rect.left;
            const relativeY = screenY - rect.top;

            const point = this.cameraSystem.canvasContainer.toLocal({ 
                x: relativeX, 
                y: relativeY 
            });

            const result = { x: point.x, y: point.y };
            this.coordinateCache.set(cacheKey, result);
            
            return result;
        }

        /**
         * スクリーン座標をレイヤーローカル座標に変換
         * （レイヤー変形の影響を含む）
         */
        screenToLayerLocal(screenX, screenY, layer) {
            if (!layer) {
                return this.screenToCanvasLocal(screenX, screenY);
            }

            const canvasLocal = this.screenToCanvasLocal(screenX, screenY);
            return this._canvasLocalToLayerLocal(canvasLocal.x, canvasLocal.y, layer);
        }

        // ===== キャンバス座標 → レイヤーローカル座標 =====

        /**
         * キャンバスローカル座標をレイヤーローカル座標に変換
         */
        canvasLocalToLayerLocal(canvasX, canvasY, layer) {
            if (!layer) {
                return { x: canvasX, y: canvasY };
            }

            return this._canvasLocalToLayerLocal(canvasX, canvasY, layer);
        }

        _canvasLocalToLayerLocal(canvasX, canvasY, layer) {
            if (!layer || !layer.transform) {
                return { x: canvasX, y: canvasY };
            }

            try {
                const point = layer.transform.worldTransform.clone().invert()
                    .apply({ x: canvasX, y: canvasY });
                return { x: point.x, y: point.y };
            } catch (error) {
                return { x: canvasX, y: canvasY };
            }
        }

        // ===== レイヤーローカル座標 → キャンバス座標 =====

        /**
         * レイヤーローカル座標をキャンバスローカル座標に変換
         */
        layerLocalToCanvasLocal(layerX, layerY, layer) {
            if (!layer || !layer.transform) {
                return { x: layerX, y: layerY };
            }

            try {
                const point = layer.transform.worldTransform
                    .apply({ x: layerX, y: layerY });
                return { x: point.x, y: point.y };
            } catch (error) {
                return { x: layerX, y: layerY };
            }
        }

        // ===== 変形操作（描画データ同期版） =====

        /**
         * レイヤーを移動し、同時にpaths座標を更新
         * （変形確定不要 - リアルタイム反映）
         */
        moveLayer(layer, deltaX, deltaY) {
            if (!layer?.layerData) return false;

            const layerId = layer.layerData.id;
            this._ensureTransform(layerId);
            const transform = this.layerTransforms.get(layerId);

            transform.x += deltaX;
            transform.y += deltaY;

            this._applyTransformToPixiLayer(layer, transform);
            this._applyTransformToPaths(layer, transform);
            this._emitLayerTransformUpdated(layer, transform);

            this.clearCoordinateCache();
            return true;
        }

        /**
         * レイヤーをスケール（中央基準）し、paths座標を更新
         */
        scaleLayer(layer, newScale, fromCenter = true) {
            if (!layer?.layerData) return false;

            const layerId = layer.layerData.id;
            this._ensureTransform(layerId);
            const transform = this.layerTransforms.get(layerId);

            const hFlipped = transform.scaleX < 0;
            const vFlipped = transform.scaleY < 0;
            transform.scaleX = hFlipped ? -newScale : newScale;
            transform.scaleY = vFlipped ? -newScale : newScale;

            if (fromCenter) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                this._applyTransformToPixiLayer(layer, transform, centerX, centerY);
            } else {
                this._applyTransformToPixiLayer(layer, transform);
            }

            this._applyTransformToPaths(layer, transform, fromCenter);
            this._emitLayerTransformUpdated(layer, transform);

            this.clearCoordinateCache();
            return true;
        }

        /**
         * レイヤーを回転（中央基準）し、paths座標を更新
         */
        rotateLayer(layer, rotationDelta, fromCenter = true) {
            if (!layer?.layerData) return false;

            const layerId = layer.layerData.id;
            this._ensureTransform(layerId);
            const transform = this.layerTransforms.get(layerId);

            transform.rotation += rotationDelta;

            if (fromCenter) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                this._applyTransformToPixiLayer(layer, transform, centerX, centerY);
            } else {
                this._applyTransformToPixiLayer(layer, transform);
            }

            this._applyTransformToPaths(layer, transform, fromCenter);
            this._emitLayerTransformUpdated(layer, transform);

            this.clearCoordinateCache();
            return true;
        }

        /**
         * レイヤーを反転し、paths座標を更新
         */
        flipLayer(layer, direction) {
            if (!layer?.layerData) return false;

            const layerId = layer.layerData.id;
            this._ensureTransform(layerId);
            const transform = this.layerTransforms.get(layerId);

            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }

            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;

            this._applyTransformToPixiLayer(layer, transform, centerX, centerY);
            this._applyTransformToPaths(layer, transform, true);
            this._emitLayerTransformUpdated(layer, transform);

            this.clearCoordinateCache();
            return true;
        }

        /**
         * 変形を確定（PixiJS層リセット）し、paths座標を正規化
         * （最終段階のみ、通常は不要）
         */
        confirmTransform(layer) {
            if (!layer?.layerData) return false;

            const layerId = layer.layerData.id;
            const transform = this.layerTransforms.get(layerId);

            if (!this._isTransformNonDefault(transform)) {
                return false;
            }

            // paths座標に変形を焼き込み
            if (!this._applyTransformToPaths(layer, transform, true)) {
                return false;
            }

            // PixiJS層をリセット
            layer.position.set(0, 0);
            layer.rotation = 0;
            layer.scale.set(1, 1);
            layer.pivot.set(0, 0);

            // 変形状態をリセット
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (this.eventBus) {
                this.eventBus.emit('layer:transform-confirmed', {
                    layerId: layerId,
                    layer: layer
                });
            }

            this.clearCoordinateCache();
            return true;
        }

        // ===== 内部処理 =====

        /**
         * PixiJS層に変形を適用
         */
        _applyTransformToPixiLayer(layer, transform, pivotX = 0, pivotY = 0) {
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(pivotX, pivotY);
                layer.position.set(pivotX + transform.x, pivotY + transform.y);
                layer.rotation = transform.rotation;
                layer.scale.set(transform.scaleX, transform.scaleY);
            } else if (transform.x !== 0 || transform.y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(transform.x, transform.y);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
        }

        /**
         * paths座標に変形を適用
         */
        _applyTransformToPaths(layer, transform, centerBased = true) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }

            try {
                const pivotX = centerBased ? this.config.canvas.width / 2 : 0;
                const pivotY = centerBased ? this.config.canvas.height / 2 : 0;

                const matrix = this._createTransformMatrix(transform, pivotX, pivotY);

                const transformedPaths = [];
                for (let path of layer.layerData.paths) {
                    if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }

                    const transformedPoints = this._transformPoints(path.points, matrix);
                    if (transformedPoints.length === 0) continue;

                    transformedPaths.push({
                        id: path.id,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        tool: path.tool,
                        isComplete: path.isComplete || true,
                        strokeOptions: path.strokeOptions,
                        graphics: null
                    });
                }

                layer.layerData.paths = transformedPaths;
                return true;
            } catch (error) {
                return false;
            }
        }

        _createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            return matrix;
        }

        _transformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let point of points) {
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    continue;
                }

                try {
                    const transformed = matrix.apply(point);
                    
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
                        
                        const newPoint = {
                            x: transformed.x,
                            y: transformed.y
                        };
                        
                        if (point.pressure !== undefined) {
                            newPoint.pressure = point.pressure;
                        }
                        
                        transformedPoints.push(newPoint);
                    }
                } catch (transformError) {
                    continue;
                }
            }
            
            return transformedPoints;
        }

        _syncTransformToLayer(layer, transform) {
            if (!layer?.layerData) return;

            const layerId = layer.layerData.id;
            this.layerTransforms.set(layerId, { ...transform });

            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;

            this._applyTransformToPixiLayer(layer, transform, centerX, centerY);
            this._applyTransformToPaths(layer, transform, true);
        }

        _ensureTransform(layerId) {
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
        }

        _isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }

        _emitLayerTransformUpdated(layer, transform) {
            if (this.eventBus) {
                this.eventBus.emit('coordinate:layer-transform-synced', {
                    layer: layer,
                    transform: transform,
                    layerId: layer.layerData.id
                });
            }
        }

        _getSafeCanvas() {
            if (this.cameraSystem?.app?.stage?.parent?.canvas) {
                return this.cameraSystem.app.stage.parent.canvas;
            }
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) {
                return canvasElements[0];
            }
            return null;
        }

        // ===== ユーティリティ =====

        getTransform(layerId) {
            return this.layerTransforms.get(layerId) || null;
        }

        setTransform(layerId, transform) {
            this.layerTransforms.set(layerId, { ...transform });
        }

        deleteTransform(layerId) {
            this.layerTransforms.delete(layerId);
        }

        clearCoordinateCache() {
            this.coordinateCache.clear();
            this.cacheVersion++;
        }

        destroy() {
            this.layerTransforms.clear();
            this.coordinateCache.clear();
        }
    }

    window.TegakiCoordinateUnification = CoordinateUnification;

})();