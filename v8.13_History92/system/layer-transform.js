// ===== system/layer-transform.js - Phase 1: 変形機能の独立化 =====

(function() {
    'use strict';

    /**
     * LayerTransform - レイヤー変形機能を管理
     * 
     * 責務:
     * - レイヤー移動・回転・拡大縮小・反転
     * - Vキーモード管理
     * - 変形パネル制御
     * - ドラッグ操作
     * - 変形確定・座標変換
     */
    class LayerTransform {
        constructor(config, coordAPI) {
            this.config = config;
            this.coordAPI = coordAPI;
            
            // 変形状態管理
            this.transforms = new Map(); // layerId -> {x, y, rotation, scaleX, scaleY}
            this.isVKeyPressed = false;
            this.isDragging = false;
            this.dragLastPoint = { x: 0, y: 0 };
            
            // UI要素
            this.transformPanel = null;
            
            // 依存関係
            this.app = null;
            this.cameraSystem = null;
            
            // コールバック
            this.onTransformComplete = null;
            this.onTransformUpdate = null;
        }

        // ========== 初期化 ==========
        
        init(app, cameraSystem) {
            this.app = app;
            this.cameraSystem = cameraSystem;
            
            this._setupTransformPanel();
            this._setupDragEvents();
        }

        // ========== モード制御 ==========
        
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
            
            // 変形確定
            if (activeLayer) {
                this.confirmTransform(activeLayer);
            }
        }
        
        toggleMoveMode(activeLayer) {
            if (this.isVKeyPressed) {
                this.exitMoveMode(activeLayer);
            } else {
                this.enterMoveMode();
            }
        }

        // ========== 変形操作 ==========
        
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
                    transform.x = value;
                    break;
                case 'y':
                    transform.y = value;
                    break;
                case 'rotation':
                    transform.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    break;
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            
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
        }

        flipLayer(layer, direction) {
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
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        // ========== 変形確定 ==========
        
        confirmTransform(layer) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (this._isTransformNonDefault(transform)) {
                const success = this.applyTransformToPaths(layer, transform);
                
                if (success) {
                    layer.position.set(0, 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                    layer.pivot.set(0, 0);
                    
                    this.transforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });
                    
                    this.updateFlipButtons(layer);
                    
                    if (this.onTransformComplete) {
                        this.onTransformComplete(layer);
                    }
                }
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
                
                // レイヤーのPathsを置き換え（外部で再構築を実行する）
                layer.layerData.paths = transformedPaths;
                return true;
                
            } catch (error) {
                return false;
            }
        }

        // ========== 内部処理 ==========
        
        _setupTransformPanel() {
            this.transformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.transformPanel) {
                return;
            }
            
            this._setupSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                return Math.round(value) + 'px';
            });
            
            this._setupSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                return Math.round(value) + 'px';
            });
            
            this._setupSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                return Math.round(value) + '°';
            });
            
            this._setupSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
                return value.toFixed(2) + 'x';
            });
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    if (this.onFlipRequest) {
                        this.onFlipRequest('horizontal');
                    }
                });
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    if (this.onFlipRequest) {
                        this.onFlipRequest('vertical');
                    }
                });
            }
        }

        _setupSlider(sliderId, min, max, initial, formatCallback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = formatCallback(value);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                const newValue = getValue(e.clientX);
                update(newValue);
                
                if (this.onSliderChange) {
                    this.onSliderChange(sliderId, newValue);
                }
                
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) {
                    const newValue = getValue(e.clientX);
                    update(newValue);
                    
                    if (this.onSliderChange) {
                        this.onSliderChange(sliderId, newValue);
                    }
                }
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            container.updateValue = (newValue) => {
                update(newValue);
            };

            update(initial);
        }
        
        _setupDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.isVKeyPressed && e.button === 0) {
                    this.isDragging = true;
                    this.dragLastPoint = { x: e.clientX, y: e.clientY };
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

        _handleDrag(e) {
            if (this.onDragRequest) {
                const dx = e.clientX - this.dragLastPoint.x;
                const dy = e.clientY - this.dragLastPoint.y;
                this.dragLastPoint = { x: e.clientX, y: e.clientY };
                
                this.onDragRequest(dx, dy, e.shiftKey);
            }
        }

        _getSafeCanvas() {
            if (this.app?.canvas) return this.app.canvas;
            if (this.app?.view) return this.app.view;
            
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) {
                return canvasElements[0];
            }
            return null;
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

        _isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }

        _updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            if (this.isVKeyPressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }

        // ========== UI更新 ==========
        
        updateTransformPanelValues(layer) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            ['x', 'y', 'rotation', 'scale'].forEach(prop => {
                const slider = document.getElementById(`layer-${prop}-slider`);
                if (slider?.updateValue) {
                    let value = transform[prop];
                    if (prop === 'rotation') value = value * 180 / Math.PI;
                    if (prop === 'scale') value = Math.abs(transform.scaleX);
                    slider.updateValue(value);
                }
            });
            
            this.updateFlipButtons(layer);
        }
        
        updateFlipButtons(layer) {
            if (!layer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', layer.scale.x < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', layer.scale.y < 0);
            }
        }

        // ========== アクセサ ==========
        
        getTransform(layerId) {
            return this.transforms.get(layerId) || null;
        }
        
        setTransform(layerId, transform) {
            this.transforms.set(layerId, transform);
        }
        
        deleteTransform(layerId) {
            this.transforms.delete(layerId);
        }
    }

    window.TegakiLayerTransform = LayerTransform;

})();

console.log('✅ layer-transform.js loaded');