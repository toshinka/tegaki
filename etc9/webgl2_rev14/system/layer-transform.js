/**
 * @file system/layer-transform.js - Phase 3: ベクター再計算対応版
 * @description レイヤートランスフォーム処理
 * 
 * 【Phase 3 新機能】
 * ✅ confirmTransform()でベクターメッシュ再生成
 * ✅ 拡大時のジャギー解消
 * ✅ Perfect-Freehandポリゴン再計算
 * 
 * 【親依存】
 * - event-bus.js (window.TegakiEventBus)
 * - coordinate-system.js (window.CoordinateSystem)
 * - config.js (window.TEGAKI_CONFIG)
 * - slider-utils.js (window.TegakiUI.SliderUtils)
 * - layer-system.js (レイヤー取得・再構築)
 * - stroke-renderer.js (メッシュ再生成)
 * 
 * 【子依存】
 * - core-runtime.js
 * - keyboard-handler.js
 */

(function() {
    'use strict';

    class LayerTransform {
        constructor(config, coordAPI) {
            this.config = config;
            this.coordAPI = coordAPI;
            this.coordinateSystem = null;
            
            this.transforms = new Map();
            this.isVKeyPressed = false;
            this.isDragging = false;
            this.isPanelDragging = false;
            this.panelDragPointerId = null;
            this.dragLastPoint = { x: 0, y: 0 };
            this.dragStartPoint = { x: 0, y: 0 };
            this.panelDragOffset = { x: 0, y: 0 };
            
            this.transformPanel = null;
            this.app = null;
            this.cameraSystem = null;
            this.eventBus = window.TegakiEventBus;
            
            this.onTransformComplete = null;
            this.onTransformUpdate = null;
            this.onFlipRequest = null;
            this.onDragRequest = null;
            this.onSliderChange = null;
            this.onRebuildRequired = null;
            this.onGetActiveLayer = null;
            
            this._lastEmitTime = 0;
            this._emitTimer = null;
            this._sliderInstances = new Map();
        }

        init(app, cameraSystem) {
            this.app = app;
            this.cameraSystem = cameraSystem;
            this.coordinateSystem = window.CoordinateSystem;
            
            this._setupTransformPanel();
            this._setupDragEvents();
            this._setupWheelEvents();
            this._setupEventListeners();
        }

        _setupEventListeners() {
            if (!this.eventBus) {
                setTimeout(() => {
                    this.eventBus = window.TegakiEventBus;
                    if (this.eventBus) {
                        this._setupEventListeners();
                    }
                }, 100);
                return;
            }
            
            this.eventBus.on('keyboard:vkey-state-changed', ({ pressed }) => {
                if (pressed) {
                    this.enterMoveMode();
                } else {
                    const activeLayer = this.onGetActiveLayer ? this.onGetActiveLayer() : null;
                    this.exitMoveMode(activeLayer);
                }
            });
            
            this.eventBus.on('layer:flip-by-key', (data) => {
                if (this.isVKeyPressed && this.onFlipRequest) {
                    this.onFlipRequest(data.direction);
                }
            });
            
            this.eventBus.on('layer:reset-transform', () => {
                if (this.isVKeyPressed) {
                    this.resetTransform();
                }
            });
        }

        enterMoveMode() {
            if (this.isVKeyPressed) return;
            
            this.isVKeyPressed = true;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(true);
                this.cameraSystem.showGuideLines();
            }
            
            if (this.transformPanel) {
                this.transformPanel.classList.add('show');
            }
            
            this._updateCursor();
            this._initializeTransformForActiveLayer();
        }
        
        exitMoveMode(activeLayer) {
            if (!this.isVKeyPressed) return;
            
            this.isVKeyPressed = false;
            this.isDragging = false;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
                this.cameraSystem.hideGuideLines();
            }
            
            if (this.transformPanel) {
                this.transformPanel.classList.remove('show');
            }
            
            this._updateCursor();
        }
        
        toggleMoveMode(activeLayer) {
            if (this.isVKeyPressed) {
                this.exitMoveMode(activeLayer);
            } else {
                this.enterMoveMode();
            }
        }
        
        _initializeTransformForActiveLayer() {
            if (!this.onGetActiveLayer) return;
            const activeLayer = this.onGetActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            this.updateTransformPanelValues(activeLayer);
            this.updateFlipButtons(activeLayer);
        }

        resetTransform() {
            if (!this.onGetActiveLayer) return;
            const activeLayer = this.onGetActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            this.transforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
            
            activeLayer.position.set(0, 0);
            activeLayer.rotation = 0;
            activeLayer.scale.set(1, 1);
            activeLayer.pivot.set(0, 0);
            
            this.updateTransformPanelValues(activeLayer);
            this.updateFlipButtons(activeLayer);
            this._emitTransformUpdated(layerId, activeLayer);
        }

        updateTransform(layer, property, value) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = Number(value) || 0;
                    break;
                case 'y':
                    transform.y = Number(value) || 0;
                    break;
                case 'rotation':
                    if (this.config.layer.rotationLoop) {
                        const maxRot = this.config.layer.maxRotation * Math.PI / 180;
                        let rot = Number(value) || 0;
                        while (rot > maxRot) rot -= (maxRot * 2);
                        while (rot < -maxRot) rot += (maxRot * 2);
                        transform.rotation = rot;
                    } else {
                        transform.rotation = Number(value) || 0;
                    }
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    const scaleVal = Math.max(this.config.layer.minScale, 
                                             Math.min(this.config.layer.maxScale, Number(value)));
                    transform.scaleX = hFlipped ? -scaleVal : scaleVal;
                    transform.scaleY = vFlipped ? -scaleVal : scaleVal;
                    break;
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }
        
        applyTransform(layer, transform, centerX, centerY) {
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(layer, transform, centerX, centerY);
            }
        }
        
        _applyTransformDirect(layer, transform, centerX, centerY) {
            const x = Number(transform.x) || 0;
            const y = Number(transform.y) || 0;
            const rotation = Number(transform.rotation) || 0;
            const scaleX = Number(transform.scaleX) || 1;
            const scaleY = Number(transform.scaleY) || 1;
            
            if (!isFinite(x) || !isFinite(y) || !isFinite(rotation) || 
                !isFinite(scaleX) || !isFinite(scaleY)) {
                return;
            }
            
            if (rotation !== 0 || Math.abs(scaleX) !== 1 || Math.abs(scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + x, centerY + y);
                layer.rotation = rotation;
                layer.scale.set(scaleX, scaleY);
            } else if (x !== 0 || y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(x, y);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
        }

        flipLayer(layer, direction, skipHistory = false) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateFlipButtons(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        moveLayer(layer, direction, amount = 5) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            
            switch(direction) {
                case 'ArrowUp':    transform.y -= amount; break;
                case 'ArrowDown':  transform.y += amount; break;
                case 'ArrowLeft':  transform.x -= amount; break;
                case 'ArrowRight': transform.x += amount; break;
            }
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        scaleLayer(layer, keyCode) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            let currentScale = Math.abs(transform.scaleX);
            let newScale;
            
            if (keyCode === 'ArrowUp') {
                newScale = Math.min(this.config.layer.maxScale, currentScale * 1.1);
            } else if (keyCode === 'ArrowDown') {
                newScale = Math.max(this.config.layer.minScale, currentScale * 0.9);
            } else {
                return;
            }
            
            const hFlipped = transform.scaleX < 0;
            const vFlipped = transform.scaleY < 0;
            transform.scaleX = hFlipped ? -newScale : newScale;
            transform.scaleY = vFlipped ? -newScale : newScale;
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        rotateLayer(layer, keyCode) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            const rotationAmount = (15 * Math.PI) / 180;
            
            if (keyCode === 'ArrowLeft') {
                transform.rotation -= rotationAmount;
            } else if (keyCode === 'ArrowRight') {
                transform.rotation += rotationAmount;
            } else {
                return;
            }
            
            if (this.config.layer.rotationLoop) {
                const maxRot = Math.PI;
                while (transform.rotation > maxRot) transform.rotation -= (maxRot * 2);
                while (transform.rotation < -maxRot) transform.rotation += (maxRot * 2);
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        /**
         * Phase 3: 変形確定時のベクター再計算
         */
        confirmTransform(layer, skipHistory = false) {
            if (!layer?.layerData) return false;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (!this._isTransformNonDefault(transform)) {
                return false;
            }
            
            const pathsBackup = structuredClone(layer.layerData.paths);
            const success = this.applyTransformToPaths(layer, transform);
            
            if (!success) return false;
            
            // Phase 3: メッシュ再生成
            this._regenerateMeshes(layer);
            
            layer.position.set(0, 0);
            layer.rotation = 0;
            layer.scale.set(1, 1);
            layer.pivot.set(0, 0);
            
            this.transforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
            
            if (this.onRebuildRequired) {
                this.onRebuildRequired(layer, layer.layerData.paths);
            }
            
            if (!skipHistory && this.onTransformComplete) {
                this.onTransformComplete(layer, pathsBackup);
            }
            
            this.updateFlipButtons(layer);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:transform-confirmed', {
                    layerId: layer.layerData.id,
                    meshCount: layer.children?.length || 0
                });
                
                const layerMgr = window.CoreRuntime?.internal?.layerManager;
                if (layerMgr) {
                    const layerIndex = layerMgr.getLayerIndex(layer);
                    
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'drawing',
                        action: 'transform-applied',
                        data: { layerIndex, layerId }
                    });
                    
                    this._lastEmitTime = performance.now();
                }
            }
            
            return true;
        }

        /**
         * Phase 3: メッシュ再生成
         * @private
         */
        _regenerateMeshes(layer) {
            if (!layer.children || !layer.layerData?.paths) return;
            
            const strokeRenderer = window.strokeRenderer;
            if (!strokeRenderer) {
                console.warn('[LayerTransform] StrokeRenderer not available');
                return;
            }
            
            let regeneratedCount = 0;
            
            // 全ての子メッシュを処理
            for (let i = layer.children.length - 1; i >= 0; i--) {
                const child = layer.children[i];
                
                // Pixi.Meshの判定
                if (child.constructor.name === 'fr' && child.geometry) {
                    // 対応するパスデータを検索
                    const pathData = layer.layerData.paths.find(p => p.graphics === child);
                    
                    if (pathData && pathData.points && pathData.points.length > 0) {
                        try {
                            // 新しいメッシュを生成
                            const newMesh = strokeRenderer._renderWithPerfectFreehand({
                                points: pathData.points
                            }, {
                                color: pathData.color,
                                size: pathData.size,
                                opacity: pathData.opacity
                            });
                            
                            if (newMesh) {
                                // 古いメッシュと置き換え
                                const index = layer.getChildIndex(child);
                                layer.addChildAt(newMesh, index);
                                layer.removeChild(child);
                                pathData.graphics = newMesh;
                                regeneratedCount++;
                            }
                        } catch (error) {
                            console.warn('[LayerTransform] Mesh regeneration failed:', error);
                        }
                    }
                }
            }
            
            if (regeneratedCount > 0) {
                console.log(`[LayerTransform] Regenerated ${regeneratedCount} meshes`);
            }
        }
        
        applyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                const matrix = this._createTransformMatrix(transform, centerX, centerY);
                const transformedPaths = [];
                
                for (let path of layer.layerData.paths) {
                    if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }
                    
                    const transformedPoints = this._transformPoints(path.points, matrix);
                    
                    if (transformedPoints.length === 0) {
                        continue;
                    }
                    
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
            const x = Number(transform.x) || 0;
            const y = Number(transform.y) || 0;
            const rotation = Number(transform.rotation) || 0;
            const scaleX = Number(transform.scaleX) || 1;
            const scaleY = Number(transform.scaleY) || 1;
            
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            
            return {
                a: scaleX * cos,
                b: scaleX * sin,
                c: -scaleY * sin,
                d: scaleY * cos,
                tx: -centerX * scaleX * cos + centerY * scaleY * sin + centerX + x,
                ty: -centerX * scaleX * sin - centerY * scaleY * cos + centerY + y
            };
        }
        
        _transformPoints(points, matrix) {
            return points.map(p => {
                const localX = Number(p.localX) || 0;
                const localY = Number(p.localY) || 0;
                
                return {
                    localX: matrix.a * localX + matrix.c * localY + matrix.tx,
                    localY: matrix.b * localX + matrix.d * localY + matrix.ty,
                    pressure: p.pressure || 0.5,
                    timestamp: p.timestamp || 0
                };
            });
        }
        
        _isTransformNonDefault(transform) {
            if (!transform) return false;
            return (
                Math.abs(transform.x) > 0.01 ||
                Math.abs(transform.y) > 0.01 ||
                Math.abs(transform.rotation) > 0.001 ||
                Math.abs(Math.abs(transform.scaleX) - 1) > 0.01 ||
                Math.abs(Math.abs(transform.scaleY) - 1) > 0.01
            );
        }
        
        _setupTransformPanel() {
            this.transformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.transformPanel) return;
            
            if (!this.transformPanel.querySelector('.panel-header')) {
                const header = document.createElement('div');
                header.className = 'panel-header';
                header.textContent = 'TRANSFORM';
                this.transformPanel.insertBefore(header, this.transformPanel.firstChild);
            }
            
            if (!window.TegakiUI?.SliderUtils) {
                return;
            }
            
            this._setupSlider('layer-x-slider', 'x', 
                this.config.layer.minX, this.config.layer.maxX, 0,
                (value) => Math.round(value) + 'px');
            
            this._setupSlider('layer-y-slider', 'y',
                this.config.layer.minY, this.config.layer.maxY, 0,
                (value) => Math.round(value) + 'px');
            
            this._setupSlider('layer-rotation-slider', 'rotation',
                this.config.layer.minRotation, this.config.layer.maxRotation, 0,
                (value) => Math.round(value) + '°');
            
            this._setupSlider('layer-scale-slider', 'scale',
                this.config.layer.minScale, this.config.layer.maxScale, 1.0,
                (value) => value.toFixed(2) + 'x');
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.removeAttribute('disabled');
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.removeAttribute('disabled');
            }
            
            this._setupPanelDrag();
        }

        _setupSlider(sliderId, property, min, max, initial, formatCallback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const sliderInstance = window.TegakiUI.SliderUtils.createSlider({
                container: sliderId,
                min: min,
                max: max,
                initial: initial,
                onChange: (value) => {
                    if (property === 'rotation' && this.config.layer.rotationLoop) {
                        while (value > max) value -= (max - min);
                        while (value < min) value += (max - min);
                    }
                    
                    const activeLayer = this.onGetActiveLayer ? this.onGetActiveLayer() : null;
                    if (activeLayer) {
                        const transformValue = property === 'rotation' 
                            ? (value * Math.PI / 180)
                            : value;
                        this.updateTransform(activeLayer, property, transformValue);
                    }
                },
                format: formatCallback
            });

            if (sliderInstance) {
                this._sliderInstances.set(sliderId, sliderInstance);
            }
        }

        _setupDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.isVKeyPressed && e.button === 0) {
                    if (!this.coordinateSystem) return;
                    
                    const world = this.coordinateSystem.screenClientToWorld(e.clientX, e.clientY);
                    
                    this.isDragging = true;
                    this.dragStartPoint = { x: world.worldX, y: world.worldY };
                    this.dragLastPoint = { x: world.worldX, y: world.worldY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging && this.isVKeyPressed) {
                    this._handleDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this._updateCursor();
                }
            });
        }

        _setupPanelDrag() {
            if (!this.transformPanel) return;
            
            const header = this.transformPanel.querySelector('.panel-header');
            if (!header) return;
            
            header.style.cursor = 'grab';
            header.style.touchAction = 'none';
            
            header.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.slider-container') || 
                    e.target.closest('.slider') ||
                    e.target.closest('.slider-track') ||
                    e.target.closest('.slider-handle') ||
                    e.target.closest('button')) {
                    return;
                }
                
                this.isPanelDragging = true;
                this.panelDragPointerId = e.pointerId;
                header.style.cursor = 'grabbing';
                
                const rect = this.transformPanel.getBoundingClientRect();
                this.panelDragOffset = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                
                if (header.setPointerCapture) {
                    try {
                        header.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
            
            document.addEventListener('pointermove', (e) => {
                if (!this.isPanelDragging) return;
                if (e.pointerId !== this.panelDragPointerId) return;
                
                const newLeft = e.clientX - this.panelDragOffset.x;
                const newTop = e.clientY - this.panelDragOffset.y;
                
                this.transformPanel.style.left = `${newLeft}px`;
                this.transformPanel.style.top = `${newTop}px`;
                this.transformPanel.style.transform = 'none';
                
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false, capture: true });
            
            document.addEventListener('pointerup', (e) => {
                if (!this.isPanelDragging) return;
                if (e.pointerId !== this.panelDragPointerId) return;
                
                this.isPanelDragging = false;
                this.panelDragPointerId = null;
                header.style.cursor = 'grab';
                
                if (header.releasePointerCapture) {
                    try {
                        header.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.stopPropagation();
            }, { capture: true });
            
            document.addEventListener('pointercancel', (e) => {
                if (!this.isPanelDragging) return;
                if (e.pointerId !== this.panelDragPointerId) return;
                
                this.isPanelDragging = false;
                this.panelDragPointerId = null;
                header.style.cursor = 'grab';
                
                e.stopPropagation();
            }, { capture: true });
        }

        _handleDrag(e) {
            if (!this.coordinateSystem) return;
            
            const world = this.coordinateSystem.screenClientToWorld(e.clientX, e.clientY);
            
            if (!isFinite(world.worldX) || !isFinite(world.worldY)) {
                return;
            }
            
            const dx = world.worldX - this.dragLastPoint.x;
            const dy = world.worldY - this.dragLastPoint.y;
            
            this.dragLastPoint = { x: world.worldX, y: world.worldY };
            
            if (this.onDragRequest) {
                this.onDragRequest(dx, dy, e.shiftKey);
            }
        }

        _setupWheelEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('wheel', (e) => {
                if (!this.isVKeyPressed) return;
                
                if (!this.onGetActiveLayer) return;
                const activeLayer = this.onGetActiveLayer();
                if (!activeLayer?.layerData) return;
                
                const layerId = activeLayer.layerData.id;
                
                if (!this.transforms.has(layerId)) {
                    this.transforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });
                }
                
                const transform = this.transforms.get(layerId);
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (e.shiftKey) {
                    const rotationDelta = e.deltaY > 0 ? 0.05 : -0.05;
                    transform.rotation += rotationDelta;
                    
                    if (this.config.layer.rotationLoop) {
                        const maxRot = Math.PI;
                        while (transform.rotation > maxRot) transform.rotation -= (maxRot * 2);
                        while (transform.rotation < -maxRot) transform.rotation += (maxRot * 2);
                    }
                } else {
                    const scaleDelta = e.deltaY > 0 ? 0.95 : 1.05;
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(
                        this.config.layer.minScale,
                        Math.min(this.config.layer.maxScale, currentScale * scaleDelta)
                    );
                    
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -newScale : newScale;
                    transform.scaleY = vFlipped ? -newScale : newScale;
                }
                
                this.applyTransform(activeLayer, transform, centerX, centerY);
                this.updateTransformPanelValues(activeLayer);
                this._emitTransformUpdated(layerId, activeLayer);
                
                if (this.onTransformUpdate) {
                    this.onTransformUpdate(activeLayer, transform);
                }
                
                e.preventDefault();
            }, { passive: false });
        }

        _emitTransformUpdated(layerId, layer) {
            if (this.eventBus) {
                const layerMgr = window.CoreRuntime?.internal?.layerManager;
                if (layerMgr && layer) {
                    const layerIndex = layerMgr.getLayerIndex(layer);
                    
                    this.eventBus.emit('layer:updated', {
                        component: 'layer',
                        action: 'transform-changed',
                        data: { layerIndex, layerId }
                    });
                }
            }
            
            const now = performance.now();
            if (this._lastEmitTime && (now - this._lastEmitTime) < 100) {
                if (this._emitTimer) {
                    clearTimeout(this._emitTimer);
                }
                this._emitTimer = setTimeout(() => {
                    this._emitTransformUpdateImmediate(layerId, layer);
                }, 100);
                return;
            }
            
            this._emitTransformUpdateImmediate(layerId, layer);
        }
        
        _emitTransformUpdateImmediate(layerId, layer) {
            if (!this.eventBus) return;
            
            const layerMgr = window.CoreRuntime?.internal?.layerManager;
            if (!layerMgr || !layer) return;
            
            const layerIndex = layerMgr.getLayerIndex(layer);
            const transform = this.transforms.get(layerId);
            
            if (!transform) return;
            
            const transformPayload = {
                x: Number(transform.x) || 0,
                y: Number(transform.y) || 0,
                scaleX: Number(transform.scaleX) || 1,
                scaleY: Number(transform.scaleY) || 1,
                rotation: Number(transform.rotation) || 0
            };
            
            this.eventBus.emit('layer:transform-updated', {
                component: 'layer',
                action: 'transform-updated',
                data: { layerIndex, layerId, transform: transformPayload }
            });
            
            this.eventBus.emit('thumbnail:layer-updated', {
                component: 'layer-transform',
                action: 'transform-changed',
                data: { layerIndex, layerId }
            });
            
            this._lastEmitTime = performance.now();
        }

        updateTransformPanelValues(layer) {
            if (!layer?.layerData || !this.transformPanel) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (!transform) return;
            
            const xSlider = this._sliderInstances.get('layer-x-slider');
            const ySlider = this._sliderInstances.get('layer-y-slider');
            const rotationSlider = this._sliderInstances.get('layer-rotation-slider');
            const scaleSlider = this._sliderInstances.get('layer-scale-slider');
            
            if (xSlider) {
                xSlider.setValue(transform.x);
            }
            
            if (ySlider) {
                ySlider.setValue(transform.y);
            }
            
            if (rotationSlider) {
                let rotationDeg = transform.rotation * 180 / Math.PI;
                
                if (this.config.layer.rotationLoop) {
                    const min = this.config.layer.minRotation;
                    const max = this.config.layer.maxRotation;
                    while (rotationDeg > max) rotationDeg -= (max - min);
                    while (rotationDeg < min) rotationDeg += (max - min);
                }
                
                rotationSlider.setValue(rotationDeg);
            }
            
            if (scaleSlider) {
                scaleSlider.setValue(Math.abs(transform.scaleX));
            }
        }

        updateFlipButtons(layer) {
            if (!layer?.layerData || !this.transformPanel) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (!transform) return;
            
            const flipHBtn = document.getElementById('flip-horizontal-btn');
            const flipVBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHBtn) {
                if (transform.scaleX < 0) {
                    flipHBtn.classList.add('active');
                } else {
                    flipHBtn.classList.remove('active');
                }
            }
            
            if (flipVBtn) {
                if (transform.scaleY < 0) {
                    flipVBtn.classList.add('active');
                } else {
                    flipVBtn.classList.remove('active');
                }
            }
        }

        _getSafeCanvas() {
            return this.app?.canvas || document.querySelector('canvas');
        }

        _updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            if (this.isVKeyPressed && !this.isDragging) {
                canvas.style.cursor = 'move';
            } else if (this.isDragging) {
                canvas.style.cursor = 'grabbing';
            } else {
                canvas.style.cursor = 'crosshair';
            }
        }

        getTransform(layerId) {
            return this.transforms.get(layerId);
        }

        setTransform(layerId, transform) {
            this.transforms.set(layerId, transform);
        }

        hasTransform(layerId) {
            return this.transforms.has(layerId);
        }

        clearTransform(layerId) {
            this.transforms.delete(layerId);
        }

        destroy() {
            if (this._emitTimer) {
                clearTimeout(this._emitTimer);
            }
            
            for (const [id, instance] of this._sliderInstances) {
                if (instance?.destroy) {
                    instance.destroy();
                }
            }
            this._sliderInstances.clear();
            
            this.transforms.clear();
        }
    }

    window.LayerTransform = LayerTransform;
    window.TegakiLayerTransform = LayerTransform;

    console.log(' ✅ layer-transform.js Phase 3 loaded');
    console.log('    ✅ confirmTransform()でベクターメッシュ再生成');
    console.log('    ✅ 拡大時のジャギー解消');

})();