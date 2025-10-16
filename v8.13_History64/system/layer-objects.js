// ===== system/layer-objects.js - PixiJS依存完全集約版 =====
// LayerSystemから分離されたPixiJS密結合層
// 責務: Container生成、Graphics描画、変形行列、サムネイル生成
// PixiJS v8.13完全準拠 | 他システムへの依存: なし

(function() {
    'use strict';

    // ========== BaseLayerFactory: レイヤーContainer生成 ==========
    class BaseLayerFactory {
        /**
         * LayerModelからPixi.Containerを生成
         * @param {LayerModel} layerModel - データモデル
         * @param {Object} config - 設定オブジェクト
         * @returns {PIXI.Container} 生成されたレイヤー
         */
        static createLayer(layerModel, config) {
            if (!layerModel || !config) {
                throw new Error('LayerModel and config required');
            }

            const layer = new PIXI.Container();
            layer.label = layerModel.id;
            layer.layerData = layerModel;

            // 背景レイヤーの場合はGraphics生成
            if (layerModel.isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, config.canvas.width, config.canvas.height);
                bg.fill(config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            return layer;
        }

        /**
         * 背景Graphics更新
         */
        static updateBackgroundGraphics(layer, config) {
            if (!layer.layerData?.isBackground || !layer.layerData.backgroundGraphics) {
                return false;
            }

            const bg = layer.layerData.backgroundGraphics;
            bg.clear();
            bg.rect(0, 0, config.canvas.width, config.canvas.height);
            bg.fill(config.background.color);
            return true;
        }

        /**
         * レイヤー可視性設定
         */
        static setLayerVisibility(layer, visible) {
            if (!layer || !layer.layerData) return false;
            layer.layerData.visible = visible;
            layer.visible = visible;
            return true;
        }

        /**
         * レイヤー不透明度設定
         */
        static setLayerOpacity(layer, opacity) {
            if (!layer || !layer.layerData) return false;
            layer.layerData.opacity = Math.max(0, Math.min(1, opacity));
            layer.alpha = layer.layerData.opacity;
            return true;
        }
    }

    // ========== PathGraphicsBuilder: ストローク描画 ==========
    class PathGraphicsBuilder {
        /**
         * パスからPixi.Graphicsを再構築
         * Perfect Freehand利用可能時は高品質描画、フォールバックは円連続
         */
        static rebuildPathGraphics(path) {
            try {
                // 既存Graphics完全破棄
                if (path.graphics) {
                    if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                        path.graphics.destroy({ 
                            children: true,
                            texture: false, 
                            baseTexture: false 
                        });
                    }
                    path.graphics = null;
                }
                
                path.graphics = new PIXI.Graphics();
                
                if (!path.points || !Array.isArray(path.points) || path.points.length === 0) {
                    return true;
                }
                
                // Perfect Freehand使用可能かつstrokeOptionsがある場合
                if (path.strokeOptions && typeof getStroke !== 'undefined') {
                    try {
                        const renderSize = path.size;
                        
                        const options = {
                            ...path.strokeOptions,
                            size: renderSize,
                            color: path.color,
                            alpha: path.opacity
                        };
                        
                        const outlinePoints = getStroke(path.points, options);
                        
                        if (outlinePoints && outlinePoints.length > 0) {
                            path.graphics.poly(outlinePoints);
                            path.graphics.fill({ 
                                color: path.color || 0x000000, 
                                alpha: path.opacity || 1.0 
                            });
                            return true;
                        }
                    } catch (pfError) {
                        // Perfect Freehand失敗時はフォールバック
                    }
                }
                
                // フォールバック: 円の連続描画
                for (let point of path.points) {
                    if (typeof point.x === 'number' && typeof point.y === 'number' &&
                        isFinite(point.x) && isFinite(point.y)) {
                        
                        path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                        path.graphics.fill({ 
                            color: path.color || 0x800000, 
                            alpha: path.opacity || 1.0 
                        });
                    }
                }
                
                return true;
                
            } catch (error) {
                path.graphics = null;
                return false;
            }
        }

        /**
         * パスを変形行列適用してGraphics生成（プレビュー用）
         */
        static createTransformedGraphics(path, matrix) {
            if (!path || !path.points || !matrix) {
                return null;
            }

            try {
                const transformedGraphics = new PIXI.Graphics();
                
                path.points.forEach((point) => {
                    try {
                        const transformedPoint = matrix.apply(point);
                        if (isFinite(transformedPoint.x) && isFinite(transformedPoint.y)) {
                            const pressure = point.pressure || 0.5;
                            const pressureAdjustedSize = path.size * (0.5 + pressure * 0.5);
                            
                            transformedGraphics.circle(
                                transformedPoint.x, 
                                transformedPoint.y, 
                                pressureAdjustedSize / 2
                            );
                            transformedGraphics.fill({ 
                                color: path.color, 
                                alpha: path.opacity 
                            });
                        }
                    } catch (transformError) {
                        // スキップ
                    }
                });
                
                return transformedGraphics;
            } catch (error) {
                return null;
            }
        }

        /**
         * パスGraphicsをレイヤーに追加
         */
        static addPathToLayer(layer, path) {
            if (!layer || !path || !path.graphics) return false;

            try {
                layer.addChild(path.graphics);
                if (layer.layerData && Array.isArray(layer.layerData.paths)) {
                    layer.layerData.paths.push(path);
                }
                return true;
            } catch (error) {
                return false;
            }
        }
    }

    // ========== LayerRenderer: サムネイル生成 ==========
    class LayerRenderer {
        /**
         * レイヤーサムネイル生成
         * 変形状態を保存→リセット→レンダリング→復元の流れ
         */
        static renderLayerThumbnail(layer, renderer, config, thumbnailSize) {
            if (!renderer || !layer || !config) {
                return null;
            }

            try {
                const { width: thumbnailWidth, height: thumbnailHeight } = thumbnailSize;
                
                const renderScale = config.thumbnail?.RENDER_SCALE || 2;
                const renderTexture = PIXI.RenderTexture.create({
                    width: config.canvas.width * renderScale,
                    height: config.canvas.height * renderScale,
                    resolution: renderScale
                });
                
                const tempContainer = new PIXI.Container();
                
                // レイヤーの変形状態を保存
                const originalState = {
                    pos: { x: layer.position.x, y: layer.position.y },
                    scale: { x: layer.scale.x, y: layer.scale.y },
                    rotation: layer.rotation,
                    pivot: { x: layer.pivot.x, y: layer.pivot.y }
                };
                
                // 変形をリセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(renderScale);
                
                // レンダリング
                renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // 変形状態を復元
                layer.position.set(originalState.pos.x, originalState.pos.y);
                layer.scale.set(originalState.scale.x, originalState.scale.y);
                layer.rotation = originalState.rotation;
                layer.pivot.set(originalState.pivot.x, originalState.pivot.y);
                
                tempContainer.removeChild(layer);
                
                // Canvas2Dでリサイズ
                const sourceCanvas = renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);
                
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = config.thumbnail?.QUALITY || 'high';
                ctx.drawImage(
                    sourceCanvas, 
                    0, 0, 
                    Math.round(thumbnailWidth), 
                    Math.round(thumbnailHeight)
                );
                
                const dataURL = targetCanvas.toDataURL();
                
                // クリーンアップ
                renderTexture.destroy();
                tempContainer.destroy();
                
                return dataURL;
                
            } catch (error) {
                return null;
            }
        }

        /**
         * サムネイルサイズ計算（アスペクト比維持）
         */
        static calculateThumbnailSize(canvasWidth, canvasHeight, maxWidth = 72, maxHeight = 48) {
            const canvasAspectRatio = canvasWidth / canvasHeight;
            let thumbnailWidth, thumbnailHeight;

            if (canvasAspectRatio >= 1) {
                if (maxHeight * canvasAspectRatio <= maxWidth) {
                    thumbnailWidth = maxHeight * canvasAspectRatio;
                    thumbnailHeight = maxHeight;
                } else {
                    thumbnailWidth = maxWidth;
                    thumbnailHeight = maxWidth / canvasAspectRatio;
                }
            } else {
                thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                thumbnailHeight = maxHeight;
            }
            
            return {
                width: Math.round(thumbnailWidth),
                height: Math.round(thumbnailHeight)
            };
        }

        /**
         * カットコンテナをRenderTextureにレンダリング
         */
        static renderCutToTexture(renderer, cutContainer, renderTexture) {
            if (!renderer || !cutContainer || !renderTexture) {
                return false;
            }

            try {
                renderer.render({
                    container: cutContainer,
                    target: renderTexture,
                    clear: true
                });
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * RenderTexture生成
         */
        static createRenderTexture(width, height) {
            try {
                return PIXI.RenderTexture.create({
                    width: width,
                    height: height
                });
            } catch (error) {
                return null;
            }
        }
    }

    // ========== TransformHelper: 変形行列操作 ==========
    class TransformHelper {
        /**
         * 変形パラメータから行列生成
         */
        static createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            return matrix;
        }

        /**
         * 逆変形行列生成
         */
        static createInverseTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-centerX - transform.x, -centerY - transform.y);
            matrix.rotate(-transform.rotation);
            matrix.scale(1 / transform.scaleX, 1 / transform.scaleY);
            matrix.translate(centerX, centerY);
            
            return matrix;
        }

        /**
         * ポイント配列を行列変換
         */
        static transformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
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

        /**
         * レイヤーContainerに変形を適用
         * CoordinateSystem APIがあれば委譲、なければ直接適用
         */
        static applyLayerTransform(layer, transform, centerX, centerY, coordAPI = null) {
            if (!layer || !transform) return false;

            // CoordinateSystem APIが利用可能な場合は委譲
            if (coordAPI?.applyLayerTransform) {
                coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
                return true;
            }

            // フォールバック: 直接適用
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + transform.x, centerY + transform.y);
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
            return true;
        }

        /**
         * 変形がデフォルト（変形なし）か判定
         */
        static isTransformDefault(transform) {
            if (!transform) return true;
            return (transform.x === 0 && transform.y === 0 && 
                    transform.rotation === 0 && 
                    Math.abs(transform.scaleX) === 1 && 
                    Math.abs(transform.scaleY) === 1);
        }

        /**
         * 変形パラメータをリセット
         */
        static createDefaultTransform() {
            return {
                x: 0,
                y: 0,
                rotation: 0,
                scaleX: 1,
                scaleY: 1
            };
        }
    }

    // ========== LayerGraphicsManager: レイヤー再構築 ==========
    class LayerGraphicsManager {
        /**
         * レイヤーを新しいパス配列で再構築
         * 既存Graphics破棄→新規パス追加
         */
        static rebuildLayer(layer, newPaths) {
            try {
                // 背景Graphics以外の子要素を削除
                const childrenToRemove = [];
                for (let child of layer.children) {
                    if (child !== layer.layerData.backgroundGraphics) {
                        childrenToRemove.push(child);
                    }
                }
                
                childrenToRemove.forEach(child => {
                    try {
                        layer.removeChild(child);
                        if (child.destroy && typeof child.destroy === 'function') {
                            child.destroy({ 
                                children: true, 
                                texture: false, 
                                baseTexture: false 
                            });
                        }
                    } catch (removeError) {
                        // スキップ
                    }
                });
                
                // パスをクリア
                layer.layerData.paths = [];
                
                // 新しいパスを追加
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        const rebuildSuccess = PathGraphicsBuilder.rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        }
                        
                    } catch (pathError) {
                        // スキップ
                    }
                }
                
                return addedCount > 0 || newPaths.length === 0;
                
            } catch (error) {
                return false;
            }
        }

        /**
         * レイヤーの全Graphics削除
         */
        static clearLayerGraphics(layer) {
            if (!layer || !layer.layerData) return false;

            try {
                const childrenToRemove = [];
                for (let child of layer.children) {
                    if (child !== layer.layerData.backgroundGraphics) {
                        childrenToRemove.push(child);
                    }
                }
                
                childrenToRemove.forEach(child => {
                    try {
                        layer.removeChild(child);
                        if (child.destroy && typeof child.destroy === 'function') {
                            child.destroy({ 
                                children: true, 
                                texture: false, 
                                baseTexture: false 
                            });
                        }
                    } catch (removeError) {
                        // スキップ
                    }
                });
                
                layer.layerData.paths = [];
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * レイヤーの全ストロークに変形を適用して再構築
         */
        static applyTransformToPaths(layer, transform, centerX, centerY) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }

            try {
                const matrix = TransformHelper.createTransformMatrix(transform, centerX, centerY);
                const transformedPaths = [];
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }
                    
                    const transformedPoints = TransformHelper.transformPoints(path.points, matrix);
                    
                    if (transformedPoints.length === 0) {
                        continue;
                    }
                    
                    const transformedPath = {
                        id: path.id,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        tool: path.tool,
                        isComplete: path.isComplete || true,
                        strokeOptions: path.strokeOptions,
                        graphics: null
                    };
                    
                    transformedPaths.push(transformedPath);
                }
                
                return LayerGraphicsManager.rebuildLayer(layer, transformedPaths);
                
            } catch (error) {
                return false;
            }
        }
    }

    // ========== ContainerHelper: Container階層操作 ==========
    class ContainerHelper {
        /**
         * レイヤーを親コンテナに追加
         */
        static addLayerToContainer(parentContainer, layer, index = -1) {
            if (!parentContainer || !layer) return false;

            try {
                if (index < 0 || index >= parentContainer.children.length) {
                    parentContainer.addChild(layer);
                } else {
                    parentContainer.addChildAt(layer, index);
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * レイヤーを親コンテナから削除
         */
        static removeLayerFromContainer(parentContainer, layer) {
            if (!parentContainer || !layer) return false;

            try {
                parentContainer.removeChild(layer);
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * レイヤーの階層位置変更
         */
        static reorderLayer(parentContainer, fromIndex, toIndex) {
            if (!parentContainer) return false;

            try {
                const layer = parentContainer.children[fromIndex];
                parentContainer.removeChildAt(fromIndex);
                parentContainer.addChildAt(layer, toIndex);
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * カットコンテナ生成
         */
        static createCutContainer(label = 'cut_container') {
            const container = new PIXI.Container();
            container.label = label;
            return container;
        }

        /**
         * レイヤー数取得
         */
        static getLayerCount(container) {
            return container ? container.children.length : 0;
        }
    }

    // ========== グローバル公開 ==========
    window.LayerObjects = {
        BaseLayerFactory,
        PathGraphicsBuilder,
        LayerRenderer,
        TransformHelper,
        LayerGraphicsManager,
        ContainerHelper
    };

})();

console.log('✅ layer-objects.js loaded (改修完了版)');
console.log('   📦 BaseLayerFactory: レイヤーContainer生成');
console.log('   🎨 PathGraphicsBuilder: ストローク描画');
console.log('   🖼️  LayerRenderer: サムネイル・RenderTexture');
console.log('   🔄 TransformHelper: 変形行列操作');
console.log('   🔧 LayerGraphicsManager: レイヤー再構築');
console.log('   📂 ContainerHelper: Container階層操作');
console.log('   ✨ PixiJS依存完全集約・LayerSystem分離完了');