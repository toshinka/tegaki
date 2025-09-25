/**
 * Layer System - レイヤー管理・変形確定・パス管理
 * 責務: レイヤー管理・変形確定・パス管理
 */

(function() {
    'use strict';
    
    class LayerSystem {
        constructor(coreEngine) {
            this.coreEngine = coreEngine;
            this.app = coreEngine.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // レイヤー管理
            this.layers = new Map();
            this.layerOrder = [];
            this.activeLayerId = null;
            this.layerIdCounter = 0;
            
            // レイヤー変形管理
            this.layerTransforms = new Map();
            this.isTransforming = false;
            this.transformingLayerId = null;
            
            // 描画状態管理
            this.currentPath = null;
            this.isDrawing = false;
            
            this.setupEventListeners();
            
            if (this.CONFIG?.debug) {
                console.log('✅ LayerSystem initialized');
            }
        }
        
        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            // キャンバスリサイズイベント
            window.Tegaki.EventBus.on('canvas:resize', (data) => {
                this.handleCanvasResize(data.width, data.height);
            });
        }
        
        // ========================================
        // レイヤー基本操作
        // ========================================
        
        /**
         * レイヤー作成
         * @param {string} name - レイヤー名
         * @param {string} type - レイヤータイプ ('drawing', 'background')
         * @returns {Object} 作成されたレイヤー
         */
        createLayer(name = 'New Layer', type = 'drawing') {
            const layerId = `layer_${++this.layerIdCounter}`;
            
            // PixiJS Container作成
            const container = new PIXI.Container();
            
            // レイヤーデータ作成
            const layer = {
                id: layerId,
                name: name,
                type: type,
                container: container,
                visible: true,
                opacity: 1.0,
                blendMode: 'normal',
                layerData: {
                    paths: [], // canonical座標でのパスデータ
                    metadata: {
                        createdAt: Date.now(),
                        modifiedAt: Date.now()
                    }
                }
            };
            
            // Container設定
            container.eventMode = 'static';
            container.name = `Layer_${layerId}`;
            
            // レイヤー登録
            this.layers.set(layerId, layer);
            this.layerOrder.push(layerId);
            
            // 変形状態初期化
            this.layerTransforms.set(layerId, this.identityTransform());
            
            // Containerを階層に追加
            const containers = this.cameraSystem?.getContainers();
            if (containers?.canvas) {
                containers.canvas.addChild(container);
            }
            
            // EventBus発行
            window.Tegaki.EventBus.emit('layer:created', {
                layerId: layerId,
                name: name,
                type: type,
                layerIndex: this.layerOrder.length - 1
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Layer created: ${name} (${layerId})`);
            }
            
            return layer;
        }
        
        /**
         * レイヤー削除
         * @param {string} layerId - レイヤーID
         */
        removeLayer(layerId) {
            const layer = this.layers.get(layerId);
            if (!layer) return;
            
            // アクティブレイヤー調整
            if (this.activeLayerId === layerId) {
                const currentIndex = this.layerOrder.indexOf(layerId);
                const nextIndex = Math.max(0, currentIndex - 1);
                const nextLayerId = this.layerOrder[nextIndex];
                this.setActiveLayer(nextLayerId !== layerId ? nextLayerId : null);
            }
            
            // Container削除
            layer.container.parent?.removeChild(layer.container);
            layer.container.destroy();
            
            // データ削除
            this.layers.delete(layerId);
            this.layerTransforms.delete(layerId);
            this.layerOrder = this.layerOrder.filter(id => id !== layerId);
            
            // EventBus発行
            window.Tegaki.EventBus.emit('layer:removed', {layerId});
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Layer removed: ${layerId}`);
            }
        }
        
        /**
         * レイヤー取得（ID指定）
         * @param {string} layerId - レイヤーID
         * @returns {Object|null} レイヤー
         */
        getLayerById(layerId) {
            return this.layers.get(layerId) || null;
        }
        
        /**
         * 全レイヤー取得
         * @returns {Array} レイヤー配列（表示順序）
         */
        getAllLayers() {
            return this.layerOrder.map(id => this.layers.get(id)).filter(Boolean);
        }
        
        /**
         * アクティブレイヤー取得
         * @returns {Object|null} アクティブレイヤー
         */
        getActiveLayer() {
            return this.activeLayerId ? this.layers.get(this.activeLayerId) : null;
        }
        
        /**
         * アクティブレイヤー設定
         * @param {string} layerId - レイヤーID
         */
        setActiveLayer(layerId) {
            if (layerId && !this.layers.has(layerId)) return;
            
            const oldActiveId = this.activeLayerId;
            this.activeLayerId = layerId;
            
            // EventBus発行
            window.Tegaki.EventBus.emit('layer:active:changed', {
                oldLayerId: oldActiveId,
                newLayerId: layerId
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Active layer changed: ${layerId}`);
            }
        }
        
        // ========================================
        // レイヤー順序管理
        // ========================================
        
        /**
         * レイヤー順序変更
         * @param {string} layerId - レイヤーID
         * @param {number} newIndex - 新しいインデックス
         */
        setLayerOrder(layerId, newIndex) {
            const currentIndex = this.layerOrder.indexOf(layerId);
            if (currentIndex === -1 || newIndex < 0 || newIndex >= this.layerOrder.length) {
                return;
            }
            
            // 配列順序変更
            this.layerOrder.splice(currentIndex, 1);
            this.layerOrder.splice(newIndex, 0, layerId);
            
            // Container順序更新
            this.updateContainerOrder();
            
            // EventBus発行
            window.Tegaki.EventBus.emit('layer:order:changed', {
                layerId: layerId,
                oldIndex: currentIndex,
                newIndex: newIndex
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Layer order changed: ${layerId} ${currentIndex} → ${newIndex}`);
            }
        }
        
        /**
         * Container表示順序更新
         */
        updateContainerOrder() {
            const containers = this.cameraSystem?.getContainers();
            if (!containers?.canvas) return;
            
            // 全てのレイヤーContainerを一旦削除
            this.layers.forEach(layer => {
                if (layer.container.parent) {
                    layer.container.parent.removeChild(layer.container);
                }
            });
            
            // 順序通りに再追加
            this.layerOrder.forEach(layerId => {
                const layer = this.layers.get(layerId);
                if (layer) {
                    containers.canvas.addChild(layer.container);
                }
            });
        }
        
        // ========================================
        // レイヤー変形管理（最重要）
        // ========================================
        
        /**
         * 単位変形取得
         * @returns {Object} 単位変形
         */
        identityTransform() {
            return {
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                skewX: 0,
                skewY: 0
            };
        }
        
        /**
         * 変形が単位変形か判定
         * @param {Object} transform - 変形
         * @returns {boolean} 単位変形か
         */
        isIdentityTransform(transform) {
            return transform.x === 0 && transform.y === 0 &&
                   transform.scaleX === 1 && transform.scaleY === 1 &&
                   transform.rotation === 0 && transform.skewX === 0 && transform.skewY === 0;
        }
        
        /**
         * レイヤー変形開始
         * @param {string} layerId - レイヤーID
         */
        startLayerTransform(layerId) {
            const layer = this.layers.get(layerId);
            if (!layer) return;
            
            this.isTransforming = true;
            this.transformingLayerId = layerId;
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Transform started: ${layerId}`);
            }
        }
        
        /**
         * レイヤー変形更新
         * @param {string} layerId - レイヤーID
         * @param {Object} transform - 変形データ
         */
        updateLayerTransform(layerId, transform) {
            const layer = this.layers.get(layerId);
            if (!layer) return;
            
            // 変形データ保存
            this.layerTransforms.set(layerId, {...transform});
            
            // Container変形適用（表示用）
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            layer.container.position.set(transform.x, transform.y);
            layer.container.scale.set(transform.scaleX, transform.scaleY);
            layer.container.rotation = transform.rotation;
            layer.container.skew.set(transform.skewX, transform.skewY);
            layer.container.pivot.set(centerX, centerY);
        }
        
        /**
         * レイヤー変形確定（非破壊・最重要実装）
         * @param {string} layerId - レイヤーID
         */
        confirmLayerTransform(layerId) {
            const layer = this.layers.get(layerId);
            const transform = this.layerTransforms.get(layerId);
            
            if (!layer || !transform) return;
            
            // 単位変形の場合は処理不要
            if (this.isIdentityTransform(transform)) {
                this.isTransforming = false;
                this.transformingLayerId = null;
                return;
            }
            
            // アンカー中心でのMatrix作成
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            const matrix = this.buildTransformMatrix(transform, centerX, centerY);
            
            // パス座標に変形を焼き込み（非破壊）
            layer.layerData.paths.forEach(path => {
                if (path.points && Array.isArray(path.points)) {
                    path.points = path.points.map(pt => {
                        // Matrixを適用して新しい座標を計算
                        return matrix.apply(pt);
                    });
                }
            });
            
            // Container transform 完全リセット（重要）
            this.layerTransforms.set(layerId, this.identityTransform());
            layer.container.setTransform(0, 0, 1, 1, 0);
            layer.container.pivot.set(0, 0);
            layer.container.skew.set(0, 0);
            
            // Container内容をクリア
            layer.container.removeChildren();
            
            // Graphics再構築
            this.rebuildLayerGraphics(layer);
            
            // 変形状態リセット
            this.isTransforming = false;
            this.transformingLayerId = null;
            
            // メタデータ更新
            layer.layerData.metadata.modifiedAt = Date.now();
            
            // EventBus発行
            window.Tegaki.EventBus.emit('layer:transform:confirmed', {
                layerId: layerId,
                layerIndex: this.layerOrder.indexOf(layerId)
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Transform confirmed: ${layerId}`);
            }
        }
        
        /**
         * レイヤー変形キャンセル
         * @param {string} layerId - レイヤーID
         */
        cancelLayerTransform(layerId) {
            const layer = this.layers.get(layerId);
            if (!layer) return;
            
            // 変形状態リセット
            this.layerTransforms.set(layerId, this.identityTransform());
            layer.container.setTransform(0, 0, 1, 1, 0);
            layer.container.pivot.set(0, 0);
            layer.container.skew.set(0, 0);
            
            this.isTransforming = false;
            this.transformingLayerId = null;
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Transform cancelled: ${layerId}`);
            }
        }
        
        /**
         * 変形Matrix構築
         * @param {Object} transform - 変形データ
         * @param {number} anchorX - アンカーX座標
         * @param {number} anchorY - アンカーY座標
         * @returns {PIXI.Matrix} 変形Matrix
         */
        buildTransformMatrix(transform, anchorX, anchorY) {
            const matrix = new PIXI.Matrix();
            
            // アンカー原点移動 → 変形 → アンカー復帰の順序
            matrix.translate(-anchorX, -anchorY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.skew(transform.skewX, transform.skewY);
            matrix.translate(anchorX + transform.x, anchorY + transform.y);
            
            return matrix;
        }
        
        // ========================================
        // パス管理・Graphics再構築
        // ========================================
        
        /**
         * レイヤーのcanonical座標パス取得
         * @param {string} layerId - レイヤーID
         * @returns {Array} canonical座標でのパス配列
         */
        getLayerCanonicalPaths(layerId) {
            const layer = this.layers.get(layerId);
            return layer ? layer.layerData.paths : [];
        }
        
        /**
         * レイヤーにパス追加
         * @param {Object} layer - レイヤー
         * @param {Object} path - パス（canonical座標）
         */
        addPathToLayer(layer, path) {
            if (!layer || !path) return;
            
            layer.layerData.paths.push(path);
            
            // Graphics作成・追加
            this.rebuildPathGraphics(path);
            layer.container.addChild(path.graphics);
            
            // メタデータ更新
            layer.layerData.metadata.modifiedAt = Date.now();
        }
        
        /**
         * パスのGraphics再構築
         * @param {Object} path - パス
         */
        rebuildPathGraphics(path) {
            if (!path || !path.points || !Array.isArray(path.points)) return;
            
            // 既存Graphics削除
            if (path.graphics) {
                path.graphics.destroy();
            }
            
            // 新しいGraphics作成
            const graphics = new PIXI.Graphics();
            
            if (path.points.length > 0) {
                // パス描画（canonical座標で描画）
                graphics.moveTo(path.points[0].x, path.points[0].y);
                
                for (let i = 1; i < path.points.length; i++) {
                    graphics.lineTo(path.points[i].x, path.points[i].y);
                }
                
                // スタイル適用
                graphics.stroke({
                    width: path.size || 2,
                    color: path.color || 0x000000,
                    alpha: path.opacity || 1.0
                });
            }
            
            // Graphics設定（position は {0,0} 固定）
            graphics.position.set(0, 0);
            path.graphics = graphics;
        }
        
        /**
         * レイヤーGraphics完全再構築
         * @param {Object} layer - レイヤー
         */
        rebuildLayerGraphics(layer) {
            if (!layer) return;
            
            // 既存Graphics全削除
            layer.container.removeChildren();
            
            // 全パスのGraphics再構築・追加
            layer.layerData.paths.forEach(path => {
                this.rebuildPathGraphics(path);
                if (path.graphics) {
                    layer.container.addChild(path.graphics);
                }
            });
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Layer graphics rebuilt: ${layer.id}`);
            }
        }
        
        // ========================================
        // 描画機能統合
        // ========================================
        
        /**
         * 描画開始
         * @param {string} layerId - レイヤーID
         * @param {Object} canvasPoint - キャンバス座標での点
         */
        startDrawing(layerId, canvasPoint) {
            const layer = this.layers.get(layerId);
            if (!layer) return;
            
            // 新しいパス開始
            this.currentPath = {
                points: [canvasPoint], // canonical座標で保存
                color: 0x000000, // TODO: ブラシ設定から取得
                size: 2,         // TODO: ブラシ設定から取得
                opacity: 1.0,
                timestamp: Date.now()
            };
            
            this.isDrawing = true;
            
            if (this.CONFIG?.debug) {
                console.log(`✏️ Drawing started on ${layerId}`);
            }
        }
        
        /**
         * 描画継続
         * @param {string} layerId - レイヤーID
         * @param {Object} canvasPoint - キャンバス座標での点
         */
        continueDrawing(layerId, canvasPoint) {
            if (!this.isDrawing || !this.currentPath) return;
            
            // 点を追加（canonical座標）
            this.currentPath.points.push(canvasPoint);
            
            // リアルタイム描画更新
            if (this.currentPath.graphics) {
                this.rebuildPathGraphics(this.currentPath);
            } else {
                this.rebuildPathGraphics(this.currentPath);
                const layer = this.layers.get(layerId);
                if (layer) {
                    layer.container.addChild(this.currentPath.graphics);
                }
            }
        }
        
        /**
         * 描画終了
         * @param {string} layerId - レイヤーID
         */
        endDrawing(layerId) {
            if (!this.isDrawing || !this.currentPath) return;
            
            const layer = this.layers.get(layerId);
            if (layer && this.currentPath.points.length > 1) {
                // パスをレイヤーに確定追加
                layer.layerData.paths.push(this.currentPath);
                
                // EventBus発行
                window.Tegaki.EventBus.emit('layer:paths:changed', {
                    layerId: layerId,
                    pathCount: layer.layerData.paths.length
                });
            }
            
            // 描画状態リセット
            this.currentPath = null;
            this.isDrawing = false;
            
            if (this.CONFIG?.debug) {
                console.log(`✏️ Drawing ended on ${layerId}`);
            }
        }
        
        // ========================================
        // キャンバスリサイズ対応
        // ========================================
        
        /**
         * キャンバスリサイズハンドラ
         * @param {number} width - 新しい幅
         * @param {number} height - 新しい高さ
         */
        handleCanvasResize(width, height) {
            this.resizeCanvas(width, height);
        }
        
        /**
         * キャンバスサイズ変更
         * @param {number} width - 幅
         * @param {number} height - 高さ
         */
        resizeCanvas(width, height) {
            // 背景レイヤーの特別処理
            this.layers.forEach(layer => {
                if (layer.type === 'background') {
                    // 背景レイヤーのサイズ調整処理
                    // TODO: 必要に応じて背景パターンの再生成
                }
            });
            
            if (this.CONFIG?.debug) {
                console.log(`📐 Layer canvas resized: ${width}x${height}`);
            }
        }
        
        // ========================================
        // 状態取得・診断
        // ========================================
        
        /**
         * システム状態取得（デバッグ用）
         */
        getState() {
            if (!this.CONFIG?.debug) return null;
            
            return {
                layerCount: this.layers.size,
                activeLayerId: this.activeLayerId,
                isTransforming: this.isTransforming,
                transformingLayerId: this.transformingLayerId,
                isDrawing: this.isDrawing,
                layerOrder: this.layerOrder,
                layers: Array.from(this.layers.entries()).map(([id, layer]) => ({
                    id,
                    name: layer.name,
                    type: layer.type,
                    pathCount: layer.layerData.paths.length,
                    transform: this.layerTransforms.get(id)
                }))
            };
        }
    }

    // システム登録
    window.TegakiSystems.Register('LayerSystem', LayerSystem);
    
    if (window.TEGAKI_CONFIG?.debug) {
        console.log('✅ layer-system.js loaded');
    }

})();