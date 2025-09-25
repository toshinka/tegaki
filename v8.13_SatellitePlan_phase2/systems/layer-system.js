// ===== systems/layer-system.js - レイヤー管理システム =====
// レイヤー作成・削除・変形・並べ替えを統合管理
// PixiJS v8.13準拠・非破壊変形対応

(function() {
    'use strict';

    const LayerSystem = {
        name: 'LayerSystem',
        
        // 初期化
        init: function(opts) {
            console.log('LayerSystem: Initializing...');
            
            this.app = opts.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            this.rootContainer = opts.rootContainer;
            
            // レイヤー管理
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            // レイヤーコンテナ作成
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.rootContainer.addChild(this.layersContainer);
            
            // レイヤー変形データ
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // レイヤー移動モード
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // 依存システム参照
            this.cameraSystem = null;
            this.drawingEngine = null;
            
            // UI要素
            this.layerTransformPanel = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
            
            console.log('LayerSystem: Initialized successfully');
        },

        // レイヤー作成
        createLayer: function(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            // 変形データを初期化
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.CONFIG.canvas.width, this.CONFIG.canvas.height);
                bg.fill(this.CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            
            // EventBus通知
            if (window.Tegaki?.EventBus) {
                window.Tegaki.EventBus.emit('layer.created', {
                    layerId: layerId,
                    name: name,
                    index: this.layers.length - 1
                });
            }
            
            return { layer, index: this.layers.length - 1 };
        },

        // レイヤー削除
        removeLayer: function(layerIndex) {
            if (this.layers.length <= 1) return false;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return false;

            const layer = this.layers[layerIndex];
            const layerId = layer.layerData.id;
            
            // パスのGraphics削除
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            // 変形データ削除
            this.layerTransforms.delete(layerId);

            // レイヤー削除
            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            // アクティブインデックス調整
            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            // EventBus通知
            if (window.Tegaki?.EventBus) {
                window.Tegaki.EventBus.emit('layer.removed', {
                    layerId: layerId,
                    index: layerIndex
                });
            }

            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            return true;
        },

        // レイヤー取得
        getLayer: function(layerId) {
            return this.layers.find(layer => layer.layerData.id === layerId);
        },

        // 全レイヤー取得
        getAllLayers: function() {
            return this.layers.slice();
        },

        // レイヤー順序変更
        moveLayer: function(fromIndex, toIndex) {
            if (fromIndex < 0 || fromIndex >= this.layers.length) return false;
            if (toIndex < 0 || toIndex >= this.layers.length) return false;
            if (fromIndex === toIndex) return false;

            // 配列内で移動
            const layer = this.layers.splice(fromIndex, 1)[0];
            this.layers.splice(toIndex, 0, layer);

            // PixiJS Container内で移動
            this.layersContainer.removeChild(layer);
            this.layersContainer.addChildAt(layer, toIndex);

            // アクティブインデックス調整
            if (this.activeLayerIndex === fromIndex) {
                this.activeLayerIndex = toIndex;
            } else if (fromIndex < this.activeLayerIndex && toIndex >= this.activeLayerIndex) {
                this.activeLayerIndex--;
            } else if (fromIndex > this.activeLayerIndex && toIndex <= this.activeLayerIndex) {
                this.activeLayerIndex++;
            }

            // EventBus通知
            if (window.Tegaki?.EventBus) {
                window.Tegaki.EventBus.emit('layer.reordered', {
                    layerId: layer.layerData.id,
                    fromIndex: fromIndex,
                    toIndex: toIndex
                });
            }

            this.updateLayerPanelUI();
            return true;
        },

        // アクティブレイヤー設定
        setActiveLayer: function(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                // レイヤー移動モードが有効な場合、スライダー値を更新
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                
                // EventBus通知
                if (window.Tegaki?.EventBus) {
                    const layer = this.layers[index];
                    window.Tegaki.EventBus.emit('layer.activeChanged', {
                        layerId: layer.layerData.id,
                        index: index
                    });
                }
            }
        },

        // アクティブレイヤー取得
        getActiveLayer: function() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        },

        // レイヤー変形
        transformLayer: function(layerId, transform) {
            const layer = this.getLayer(layerId);
            if (!layer) return false;

            // 変形データ更新
            this.layerTransforms.set(layerId, { ...transform });

            // 表示変形適用
            this.applyVisualTransform(layer, transform);

            // EventBus通知
            if (window.Tegaki?.EventBus) {
                window.Tegaki.EventBus.emit('layer.transformed', {
                    layerId: layerId,
                    transform: transform
                });
            }

            return true;
        },

        // 表示変形適用
        applyVisualTransform: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;

            layer.pivot.set(centerX, centerY);
            layer.position.set(centerX + transform.x, centerY + transform.y);
            layer.rotation = transform.rotation;
            layer.scale.set(transform.scaleX, transform.scaleY);
        },

        // レイヤー移動モード管理
        toggleLayerMoveMode: function() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        },

        enterLayerMoveMode: function() {
            if (this.isLayerMoveMode) return;

            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(true);
            }

            // パネル表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }

            // ガイドライン表示
            if (this.cameraSystem) {
                this.cameraSystem.showGuideLines();
            }

            this.updateCursor();
        },

        exitLayerMoveMode: function() {
            if (!this.isLayerMoveMode) return;

            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(false);
            }

            // パネル非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }

            // ガイドライン非表示
            if (this.cameraSystem) {
                this.cameraSystem.hideGuideLines();
            }

            this.updateCursor();

            // V解除時に自動確定
            this.confirmLayerTransform();
        },

        // 変形確定（非破壊版）
        confirmLayerTransform: function() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);

            if (this.isTransformNonDefault(transform)) {
                try {
                    console.log('LayerSystem: Non-destructive transform confirmation started');
                    
                    const success = this.safeApplyTransformToPaths(activeLayer, transform);
                    
                    if (success) {
                        // 表示transform をリセット
                        activeLayer.position.set(0, 0);
                        activeLayer.rotation = 0;
                        activeLayer.scale.set(1, 1);
                        activeLayer.pivot.set(0, 0);

                        // 変形データクリア
                        this.layerTransforms.set(layerId, {
                            x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                        });

                        this.requestThumbnailUpdate(this.activeLayerIndex);
                        console.log('LayerSystem: Transform confirmed successfully');
                    }
                } catch (error) {
                    console.error('LayerSystem: Transform confirmation error:', error);
                }
            }
        },

        // 安全なパス変形適用
        safeApplyTransformToPaths: function(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }

            try {
                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
                const matrix = this.createTransformMatrix(transform, centerX, centerY);

                const transformedPaths = [];
                let successCount = 0;

                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];

                    if (!path || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }

                    const transformedPoints = this.safeTransformPoints(path.points, matrix);
                    if (transformedPoints.length === 0) continue;

                    const transformedPath = {
                        id: path.id,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete || true,
                        graphics: null
                    };

                    transformedPaths.push(transformedPath);
                    successCount++;
                }

                if (successCount === 0) return false;

                return this.safeRebuildLayer(layer, transformedPaths);
            } catch (error) {
                console.error('LayerSystem: safeApplyTransformToPaths error:', error);
                return false;
            }
        },

        // 変形行列作成
        createTransformMatrix: function(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            return matrix;
        },

        // 安全な座標変形
        safeTransformPoints: function(points, matrix) {
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
                        transformedPoints.push({
                            x: transformed.x,
                            y: transformed.y
                        });
                    }
                } catch (transformError) {
                    console.warn('LayerSystem: Point transform failed:', transformError);
                }
            }

            return transformedPoints;
        },

        // 安全なレイヤー再構築
        safeRebuildLayer: function(layer, newPaths) {
            try {
                // 既存描画要素削除（背景は保護）
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
                            child.destroy({ children: true, texture: false, baseTexture: false });
                        }
                    } catch (removeError) {
                        console.warn('LayerSystem: Failed to remove child:', removeError);
                    }
                });

                // 新しいパスデータ設定
                layer.layerData.paths = [];

                // パス再生成・追加
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];

                    try {
                        const rebuildSuccess = this.rebuildPathGraphics(path);

                        if (rebuildSuccess && path.graphics) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        }
                    } catch (pathError) {
                        console.error('LayerSystem: Error adding path:', pathError);
                    }
                }

                return addedCount > 0 || newPaths.length === 0;
            } catch (error) {
                console.error('LayerSystem: safeRebuildLayer error:', error);
                return false;
            }
        },

        // パスGraphics再生成
        rebuildPathGraphics: function(path) {
            try {
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy();
                        }
                    } catch (destroyError) {
                        console.warn('LayerSystem: Graphics destroy failed:', destroyError);
                    }
                    path.graphics = null;
                }

                path.graphics = new PIXI.Graphics();

                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
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
                }

                return true;
            } catch (error) {
                console.error('LayerSystem: rebuildPathGraphics error:', error);
                path.graphics = null;
                return false;
            }
        },

        // 変形が初期状態以外かチェック
        isTransformNonDefault: function(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 ||
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        },

        // レイヤー操作設定
        setupLayerOperations: function() {
            document.addEventListener('keydown', (e) => {
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }

                if (this.vKeyPressed && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.moveActiveLayer(e.code);
                    e.preventDefault();
                }

                if (this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.transformActiveLayer(e.code);
                    e.preventDefault();
                }

                if (this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (e.shiftKey) {
                        this.flipActiveLayer('vertical');
                    } else {
                        this.flipActiveLayer('horizontal');
                    }
                    e.preventDefault();
                }
            });

            // ドラッグ操作
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    this.handleLayerDrag(e);
                }
            });

            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        },

        // レイヤードラッグ処理
        handleLayerDrag: function(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const dx = e.clientX - this.layerDragLastPoint.x;
            const dy = e.clientY - this.layerDragLastPoint.y;

            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
            const adjustedDx = dx / worldScale;
            const adjustedDy = dy / worldScale;

            const layerId = activeLayer.layerData.id;

            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }

            const transform = this.layerTransforms.get(layerId);

            if (e.shiftKey) {
                this.handleShiftDrag(activeLayer, transform, dx, dy);
            } else {
                // 通常移動
                transform.x += adjustedDx;
                transform.y += adjustedDy;

                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
                activeLayer.position.set(centerX + transform.x, centerY + transform.y);

                this.updateSliderValue('layer-x-slider', transform.x);
                this.updateSliderValue('layer-y-slider', transform.y);
            }

            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // Shift+ドラッグ処理
        handleShiftDrag: function(activeLayer, transform, dx, dy) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;

            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);

            if (Math.abs(dy) > Math.abs(dx)) {
                // 拡縮（上ドラッグ→拡大、下ドラッグ→縮小）
                const scaleFactor = 1 + (dy * -0.01);
                const currentScale = Math.abs(transform.scaleX);
                const newScale = Math.max(this.CONFIG.layer.minScale, Math.min(this.CONFIG.layer.maxScale, currentScale * scaleFactor));

                transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                activeLayer.scale.set(transform.scaleX, transform.scaleY);

                this.updateSliderValue('layer-scale-slider', newScale);
            } else {
                // 回転（右ドラッグ→右回転）
                transform.rotation += (dx * 0.02);
                activeLayer.rotation = transform.rotation;

                this.updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI);
            }
        },

        // スライダー値更新
        updateSliderValue: function(sliderId, value) {
            const slider = document.getElementById(sliderId);
            if (slider && slider.updateValue) {
                slider.updateValue(value);
            }
        },

        // キーボード移動
        moveActiveLayer: function(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);
            const moveAmount = 5;

            switch(keyCode) {
                case 'ArrowUp': transform.y -= moveAmount; break;
                case 'ArrowDown': transform.y += moveAmount; break;
                case 'ArrowLeft': transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }

            this.updateLayerPosition(activeLayer, transform);
            this.updateSliderValue('layer-x-slider', transform.x);
            this.updateSliderValue('layer-y-slider', transform.y);
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // キーボード変形
        transformActiveLayer: function(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);

            this.setLayerPivotAndPosition(activeLayer, transform);

            switch(keyCode) {
                case 'ArrowUp':
                    this.scaleLayer(activeLayer, transform, 1.1);
                    break;
                case 'ArrowDown':
                    this.scaleLayer(activeLayer, transform, 0.9);
                    break;
                case 'ArrowLeft':
                    this.rotateLayer(activeLayer, transform, -15);
                    break;
                case 'ArrowRight':
                    this.rotateLayer(activeLayer, transform, 15);
                    break;
            }

            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // レイヤー反転
        flipActiveLayer: function(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);

            this.setLayerPivotAndPosition(activeLayer, transform);

            if (direction === 'horizontal') {
                transform.scaleX *= -1;
                activeLayer.scale.x = transform.scaleX;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
                activeLayer.scale.y = transform.scaleY;
            }

            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // 変形データ取得または作成
        getOrCreateTransform: function(layerId) {
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            return this.layerTransforms.get(layerId);
        },

        // レイヤー位置更新
        updateLayerPosition: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            layer.position.set(centerX + transform.x, centerY + transform.y);
        },

        // ピボットと位置設定
        setLayerPivotAndPosition: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            layer.pivot.set(centerX, centerY);
            layer.position.set(centerX + transform.x, centerY + transform.y);
        },

        // レイヤー拡縮
        scaleLayer: function(layer, transform, scaleFactor) {
            const currentScale = Math.abs(transform.scaleX);
            const newScale = Math.max(this.CONFIG.layer.minScale, 
                                    Math.min(this.CONFIG.layer.maxScale, currentScale * scaleFactor));

            transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
            transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
            layer.scale.set(transform.scaleX, transform.scaleY);

            this.updateSliderValue('layer-scale-slider', newScale);
        },

        // レイヤー回転
        rotateLayer: function(layer, transform, degrees) {
            transform.rotation += (degrees * Math.PI) / 180;
            layer.rotation = transform.rotation;

            this.updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI);
        },

        // 変形パネル設定
        setupLayerTransformPanel: function() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            if (!this.layerTransformPanel) return;

            this.setupLayerSlider('layer-x-slider', this.CONFIG.layer.minX, this.CONFIG.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });

            this.setupLayerSlider('layer-y-slider', this.CONFIG.layer.minY, this.CONFIG.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });

            this.setupLayerSlider('layer-rotation-slider', this.CONFIG.layer.minRotation, this.CONFIG.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });

            this.setupLayerSlider('layer-scale-slider', this.CONFIG.layer.minScale, this.CONFIG.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });

            // 反転ボタン
            this.setupFlipButtons();
        },

        // スライダー設定
        setupLayerSlider: function(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue, fromSlider = false) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;

                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value, fromSlider);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX), true);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX), true);
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        },

        // 反転ボタン設定
        setupFlipButtons: function() {
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');

            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('horizontal');
                });
            }

            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('vertical');
                });
            }
        },

        // レイヤー変形更新
        updateActiveLayerTransform: function(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;

            switch(property) {
                case 'x':
                    transform.x = value;
                    activeLayer.position.set(centerX + value, centerY + transform.y);
                    break;
                case 'y':
                    transform.y = value;
                    activeLayer.position.set(centerX + transform.x, centerY + value);
                    break;
                case 'rotation':
                    transform.rotation = value;
                    this.setLayerPivotAndPosition(activeLayer, transform);
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;

                    this.setLayerPivotAndPosition(activeLayer, transform);
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }

            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // 変形パネル値更新
        updateLayerTransformPanelValues: function() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };

            this.updateSliderValue('layer-x-slider', transform.x);
            this.updateSliderValue('layer-y-slider', transform.y);
            this.updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI);
            this.updateSliderValue('layer-scale-slider', Math.abs(transform.scaleX));

            this.updateFlipButtons();
        },

        // 反転ボタン更新
        updateFlipButtons: function() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');

            if (flipHorizontalBtn) {
                if (activeLayer.scale.x < 0) {
                    flipHorizontalBtn.classList.add('active');
                } else {
                    flipHorizontalBtn.classList.remove('active');
                }
            }

            if (flipVerticalBtn) {
                if (activeLayer.scale.y < 0) {
                    flipVerticalBtn.classList.add('active');
                } else {
                    flipVerticalBtn.classList.remove('active');
                }
            }
        },

        // カーソル更新
        updateCursor: function() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            }
        },

        // サムネイル更新
        requestThumbnailUpdate: function(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        },

        processThumbnailUpdates: function() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        },

        // サムネイル更新
        updateThumbnail: function(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;

            if (panelIndex < 0 || panelIndex >= layerItems.length) return;

            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                const canvasAspectRatio = this.CONFIG.canvas.width / this.CONFIG.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = 48;
                const maxWidth = 72;

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

                thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
                thumbnail.style.height = Math.round(thumbnailHeight) + '