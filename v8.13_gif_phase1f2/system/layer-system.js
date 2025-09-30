// ===== system/layer-system.js - Phase 2改修版: AnimationSystem連携簡潔化 =====
// 【改修】描画完了後の確実なAnimationSystem連携
// 【改修】独自サムネイル生成削除、AnimationSystemに一本化
// 【維持】Layer操作・Transform管理・EventBus統合
// PixiJS v8.13 対応

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerTransforms = new Map();
            
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            this.layersContainer = null;
            this.canvasContainer = null;
            this.layerTransformPanel = null;
            
            this.cameraSystem = null;
            this.animationSystem = null;
            
            this.coordAPI = window.CoordinateSystem;
        }

        init(canvasContainer, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            this.canvasContainer = canvasContainer;
            
            if (!this.canvasContainer?.addChild) {
                throw new Error('Valid PIXI.Container required');
            }
            
            if (!this.eventBus) {
                throw new Error('EventBus required');
            }
            
            this._createContainers();
            this._setupLayerOperations();
            this._setupLayerTransformPanel();
            this._setupAnimationSystemIntegration();
        }

        _createContainers() {
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
        }
        
        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            
            this.eventBus.on('animation:cut-applied', (data) => {
                setTimeout(() => {
                    this._syncLayersContainerFromAnimationSystem();
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    
                    if (this.isLayerMoveMode) {
                        this.updateLayerTransformPanelValues();
                    }
                }, 100);
            });
            
            this.eventBus.on('animation:cut-created', () => {
                setTimeout(() => {
                    this._syncLayersContainerFromAnimationSystem();
                    this.updateLayerPanelUI();
                }, 100);
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                setTimeout(() => {
                    this._syncLayersContainerFromAnimationSystem();
                    this.updateLayerPanelUI();
                }, 100);
            });
        }
        
        _establishAnimationSystemConnection() {
            if (window.TegakiAnimationSystem && !this.animationSystem) {
                const possibleInstances = [
                    window.animationSystem,
                    window.coreEngine?.animationSystem,
                    window.TegakiCoreEngine?.animationSystem
                ];
                
                for (let instance of possibleInstances) {
                    if (instance && typeof instance.getCurrentCut === 'function') {
                        this.animationSystem = instance;
                        break;
                    }
                }
                
                if (this.animationSystem && this.animationSystem.layerSystem !== this) {
                    this.animationSystem.layerSystem = this;
                }
            }
        }

        _syncLayersContainerFromAnimationSystem() {
            if (!this.animationSystem) return;
            
            while (this.layersContainer.children.length > 0) {
                this.layersContainer.removeChildAt(0);
            }
            
            const currentLayers = this.animationSystem.getCurrentCutLayers();
            
            if (!currentLayers || currentLayers.length === 0) {
                this.layers = [];
                this.activeLayerIndex = -1;
                return;
            }
            
            this.layers = [];
            
            currentLayers.forEach((layerData, index) => {
                const layer = new PIXI.Container();
                layer.label = layerData.id;
                layer.layerData = layerData;
                
                if (layerData.transform) {
                    this.layerTransforms.set(layerData.id, {
                        x: layerData.transform.x || 0,
                        y: layerData.transform.y || 0,
                        rotation: layerData.transform.rotation || 0,
                        scaleX: layerData.transform.scaleX || 1,
                        scaleY: layerData.transform.scaleY || 1
                    });
                    
                    this._applyTransformToLayerFromData(layer, layerData.transform);
                }
                
                if (layerData.isBackground) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                    bg.fill(this.config.background.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                }
                
                if (layerData.paths && Array.isArray(layerData.paths)) {
                    layerData.paths.forEach(pathData => {
                        const path = this._rebuildPathFromData(pathData);
                        if (path) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                        }
                    });
                }
                
                layer.visible = layerData.visible !== false;
                layer.alpha = layerData.opacity || 1.0;
                
                this.layers.push(layer);
                this.layersContainer.addChild(layer);
            });
            
            if (this.layers.length > 0) {
                this.activeLayerIndex = Math.max(0, Math.min(this.activeLayerIndex, this.layers.length - 1));
            } else {
                this.activeLayerIndex = -1;
            }
        }

        _applyTransformToLayerFromData(layer, transform) {
            if (!transform) return;
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(layer, transform, centerX, centerY);
            }
        }

        _rebuildPathFromData(pathData) {
            if (!pathData?.points || !Array.isArray(pathData.points) || pathData.points.length === 0) {
                return null;
            }
            
            const graphics = new PIXI.Graphics();
            
            pathData.points.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number' &&
                    isFinite(point.x) && isFinite(point.y)) {
                    graphics.circle(point.x, point.y, (pathData.size || 16) / 2);
                    graphics.fill({
                        color: pathData.color || 0x800000,
                        alpha: pathData.opacity || 1.0
                    });
                }
            });
            
            return {
                id: pathData.id || ('path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
                points: [...pathData.points],
                size: pathData.size || 16,
                color: pathData.color || 0x800000,
                opacity: pathData.opacity || 1.0,
                tool: pathData.tool || 'pen',
                graphics: graphics,
                isComplete: pathData.isComplete || true
            };
        }

        _setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            if (!this.layerTransformPanel) return;
            
            this._setupLayerSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this._setupLayerSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });
            
            document.getElementById('flip-horizontal-btn')?.addEventListener('click', () => {
                this.flipActiveLayer('horizontal');
            });
            
            document.getElementById('flip-vertical-btn')?.addEventListener('click', () => {
                this.flipActiveLayer('vertical');
            });
        }

        _setupLayerSlider(sliderId, min, max, initial, callback) {
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
        }
        
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
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
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
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

        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            this.updateFlipButtons();
            
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', activeLayer.scale.x < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', activeLayer.scale.y < 0);
            }
        }

        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
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
            
            this.updateFlipButtons();
        }

        _setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                const keyConfig = window.TEGAKI_KEYCONFIG_MANAGER;
                if (!keyConfig) return;
                
                const action = keyConfig.getActionForKey(e.code, {
                    vPressed: this.vKeyPressed,
                    shiftPressed: e.shiftKey
                });
                
                if (!action) return;
                
                switch(action) {
                    case 'layerMode':
                        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (!this.vKeyPressed) {
                                this.enterLayerMoveMode();
                            }
                            e.preventDefault();
                        }
                        break;
                        
                    case 'gifPrevFrame':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.animationSystem?.goToPreviousFrame) {
                                this.animationSystem.goToPreviousFrame();
                            }
                            e.preventDefault();
                        }
                        break;
                        
                    case 'gifNextFrame':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.animationSystem?.goToNextFrame) {
                                this.animationSystem.goToNextFrame();
                            }
                            e.preventDefault();
                        }
                        break;
                    
                    case 'layerUp':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            this.moveActiveLayerHierarchy('up');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerDown':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            this.moveActiveLayerHierarchy('down');
                            e.preventDefault();
                        }
                        break;
                    
                    case 'pen':
                    case 'eraser':
                        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.isLayerMoveMode) {
                                this.exitLayerMoveMode();
                            }
                            e.preventDefault();
                        }
                        break;
                    
                    case 'layerMoveUp':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowUp');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveDown':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowDown');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveLeft':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowLeft');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveRight':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowRight');
                            e.preventDefault();
                        }
                        break;
                    
                    case 'layerScaleUp':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowUp');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerScaleDown':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowDown');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerRotateLeft':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowLeft');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerRotateRight':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowRight');
                            e.preventDefault();
                        }
                        break;
                    
                    case 'horizontalFlip':
                        if (this.vKeyPressed && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (e.shiftKey) {
                                this.flipActiveLayer('vertical');
                            } else {
                                this.flipActiveLayer('horizontal');
                            }
                            e.preventDefault();
                        }
                        break;
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'KeyV' && this.vKeyPressed) {
                    this.exitLayerMoveMode();
                    e.preventDefault();
                }
            });
            
            window.addEventListener('blur', () => {
                if (this.vKeyPressed) {
                    this.exitLayerMoveMode();
                }
            });
            
            this._setupLayerDragEvents();
        }

        moveActiveLayerHierarchy(direction) {
            if (this.layers.length <= 1) return;
            
            const currentIndex = this.activeLayerIndex;
            let newIndex;
            
            if (direction === 'up') {
                newIndex = Math.min(currentIndex + 1, this.layers.length - 1);
            } else if (direction === 'down') {
                newIndex = Math.max(currentIndex - 1, 0);
            } else {
                return;
            }
            
            if (newIndex !== currentIndex) {
                this.setActiveLayer(newIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:hierarchy-moved', { 
                        direction, 
                        oldIndex: currentIndex, 
                        newIndex 
                    });
                }
            }
        }

        _setupLayerDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    this._handleLayerDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }

        _getSafeCanvas() {
            if (this.app?.canvas) return this.app.canvas;
            if (this.app?.view) return this.app.view;
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) return canvasElements[0];
            return null;
        }

        _handleLayerDrag(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;

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
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(this.config.layer.minScale, 
                        Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                    
                    transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                    transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                    
                    const scaleSlider = document.getElementById('layer-scale-slider');
                    if (scaleSlider?.updateValue) {
                        scaleSlider.updateValue(newScale);
                    }
                } else {
                    transform.rotation += (dx * 0.02);
                    
                    const rotationSlider = document.getElementById('layer-rotation-slider');
                    if (rotationSlider?.updateValue) {
                        rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                    }
                }
                
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
                } else {
                    this._applyTransformDirect(activeLayer, transform, centerX, centerY);
                }
            } else {
                transform.x += adjustedDx;
                transform.y += adjustedDy;
                
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
                } else {
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                }
                
                const xSlider = document.getElementById('layer-x-slider');
                const ySlider = document.getElementById('layer-y-slider');
                if (xSlider?.updateValue) xSlider.updateValue(transform.x);
                if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            }
            
            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(true);
                this.cameraSystem.showGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            this.updateCursor();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-entered');
            }
        }
        
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
                this.cameraSystem.hideGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            this.updateCursor();
            this.confirmLayerTransform();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-exited');
            }
        }

        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const moveAmount = 5;
            
            switch(keyCode) {
                case 'ArrowUp':    transform.y -= moveAmount; break;
                case 'ArrowDown':  transform.y += moveAmount; break;
                case 'ArrowLeft':  transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            }
            
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider?.updateValue) xSlider.updateValue(transform.x);
            if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(keyCode) {
                case 'ArrowUp':
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(transform.scaleX);
                    const newScaleUp = Math.min(this.config.layer.maxScale, currentScaleUp * scaleUpFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp?.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown':
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(transform.scaleX);
                    const newScaleDown = Math.max(this.config.layer.minScale, currentScaleDown * scaleDownFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown?.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft':
                    transform.rotation -= (15 * Math.PI) / 180;
                    
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft?.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight':
                    transform.rotation += (15 * Math.PI) / 180;
                    
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight?.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            if (this.isTransformNonDefault(transform)) {
                const success = this.safeApplyTransformToPaths(activeLayer, transform);
                
                if (success) {
                    activeLayer.position.set(0, 0);
                    activeLayer.rotation = 0;
                    activeLayer.scale.set(1, 1);
                    activeLayer.pivot.set(0, 0);
                    
                    this.layerTransforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });
                    
                    this.updateFlipButtons();
                    
                    if (this.animationSystem?.saveCutLayerStates) {
                        this.animationSystem.saveCutLayerStates();
                    }
                    
                    if (this.eventBus) {
                        this.eventBus.emit('layer:transform-confirmed', { layerId });
                    }
                }
            }
        }

        safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            const matrix = this.createTransformMatrix(transform, centerX, centerY);
            const transformedPaths = [];
            
            for (let i = 0; i < layer.layerData.paths.length; i++) {
                const path = layer.layerData.paths[i];
                
                if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                    continue;
                }
                
                const transformedPoints = this.safeTransformPoints(path.points, matrix);
                
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
                    graphics: null
                };
                
                transformedPaths.push(transformedPath);
            }
            
            return this.safeRebuildLayer(layer, transformedPaths);
        }

        createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            return matrix;
        }

        safeTransformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    continue;
                }
                
                const transformed = matrix.apply(point);
                
                if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                    isFinite(transformed.x) && isFinite(transformed.y)) {
                    transformedPoints.push({
                        x: transformed.x,
                        y: transformed.y
                    });
                }
            }
            
            return transformedPoints;
        }

        safeRebuildLayer(layer, newPaths) {
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layer.layerData.backgroundGraphics) {
                    childrenToRemove.push(child);
                }
            }
            
            childrenToRemove.forEach(child => {
                layer.removeChild(child);
                if (child.destroy && typeof child.destroy === 'function') {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            });
            
            layer.layerData.paths = [];
            
            let addedCount = 0;
            for (let i = 0; i < newPaths.length; i++) {
                const path = newPaths[i];
                
                const rebuildSuccess = this.rebuildPathGraphics(path);
                
                if (rebuildSuccess && path.graphics) {
                    layer.layerData.paths.push(path);
                    layer.addChild(path.graphics);
                    addedCount++;
                }
            }
            
            return addedCount > 0 || newPaths.length === 0;
        }

        rebuildPathGraphics(path) {
            if (path.graphics) {
                if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                    path.graphics.destroy();
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
        }

        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }

        updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            if (this.vKeyPressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }

        createLayer(name, isBackground = false) {
            const layerCounter = Date.now();
            const layer = new PIXI.Container();
            const layerId = `layer_${layerCounter}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name || `レイヤー${this.layers.length + 1}`,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            this.setActiveLayer(this.layers.length - 1);
            
            if (this.