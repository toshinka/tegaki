(function() {
    'use strict';
    
    if (typeof PIXI === 'undefined') {
        console.error('PIXI is not loaded');
        return;
    }

    console.log('PixiJS loaded:', PIXI.VERSION);
    
    // === 設定 ===
    const CONFIG = {
        canvas: { width: 400, height: 400 },
        pen: { size: 16, opacity: 0.85, color: 0x800000 },
        camera: {
            minScale: 0.1,
            maxScale: 5.0,
            initialScale: 1.0,
            wheelZoomSpeed: 0.1,
            wheelRotationSpeed: 0.05,
            keyRotationDegree: 15,
            keyMoveAmount: 10,
            dragMoveSpeed: 1.0,
            dragScaleSpeed: 0.01,
            dragRotationSpeed: 0.3
        },
        layer: {
            minX: -1000,
            maxX: 1000,
            minY: -1000,
            maxY: 1000,
            minScale: 0.1,
            maxScale: 3.0,
            minRotation: -180,
            maxRotation: 180
        },
        background: { color: 0xf0e0d6 },
        history: { maxSize: 10, autoSaveInterval: 500 },
        debug: false
    };
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === カメラシステム ===
    class CameraSystem {
        constructor(app) {
            this.app = app;
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.panSpeed = CONFIG.camera.dragMoveSpeed;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this.initialState = {
                position: null,
                scale: CONFIG.camera.initialScale,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
            
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
        }
        
        initializeCamera() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - CONFIG.canvas.width / 2;
            const initialY = centerY - CONFIG.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(CONFIG.camera.initialScale);
            
            this.initialState.position = { x: initialX, y: initialY };
        }
        
        resetCanvas() {
            this.worldContainer.position.set(
                this.initialState.position.x,
                this.initialState.position.y
            );
            this.worldContainer.scale.set(this.initialState.scale);
            this.worldContainer.rotation = 0;
            
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this.updateTransformDisplay();
        }
        
        setupEvents() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return;
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    this.isScaleRotateDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                } else if (this.isScaleRotateDragging) {
                    const dx = e.clientX - this.lastPoint.x;
                    const dy = e.clientY - this.lastPoint.y;
                    
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.rotation += (dx * CONFIG.camera.dragRotationSpeed);
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        
                        const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    } else {
                        const scaleFactor = 1 + (dy * CONFIG.camera.dragScaleSpeed);
                        const newScale = this.worldContainer.scale.x * scaleFactor;
                        
                        if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                            this.worldContainer.scale.set(newScale);
                            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                        }
                    }
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || this.spacePressed)) {
                    this.isDragging = false;
                    this.updateCursor();
                }
                if (this.isScaleRotateDragging && (e.button === 2 || this.spacePressed)) {
                    this.isScaleRotateDragging = false;
                    this.updateCursor();
                }
            });
            
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.vKeyPressed) return;
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                if (this.shiftPressed) {
                    const rotationDelta = e.deltaY < 0 ? 
                        CONFIG.camera.keyRotationDegree : -CONFIG.camera.keyRotationDegree;
                    
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    this.rotation += rotationDelta;
                    this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                } else {
                    const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                    const newScale = this.worldContainer.scale.x * scaleFactor;
                    
                    if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                        const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        
                        this.worldContainer.scale.set(newScale);
                        
                        const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    }
                }
                
                this.updateTransformDisplay();
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                    return;
                }
                
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                if (e.shiftKey) this.shiftPressed = true;
                
                if (this.vKeyPressed) return;
                
                if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const moveAmount = CONFIG.camera.keyMoveAmount;
                    switch(e.code) {
                        case 'ArrowDown':    this.worldContainer.y += moveAmount; break;
                        case 'ArrowUp':  this.worldContainer.y -= moveAmount; break;
                        case 'ArrowRight':  this.worldContainer.x += moveAmount; break;
                        case 'ArrowLeft': this.worldContainer.x -= moveAmount; break;
                    }
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                if (this.spacePressed && this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    switch(e.code) {
                        case 'ArrowUp':
                            const scaleUpFactor = 1 + CONFIG.camera.wheelZoomSpeed;
                            const newScaleUp = this.worldContainer.scale.x * scaleUpFactor;
                            if (newScaleUp <= CONFIG.camera.maxScale) {
                                this.worldContainer.scale.set(newScaleUp);
                                const newWorldCenterUp = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                                this.worldContainer.x += worldCenter.x - newWorldCenterUp.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterUp.y;
                            }
                            break;
                            
                        case 'ArrowDown':
                            const scaleDownFactor = 1 - CONFIG.camera.wheelZoomSpeed;
                            const newScaleDown = this.worldContainer.scale.x * scaleDownFactor;
                            if (newScaleDown >= CONFIG.camera.minScale) {
                                this.worldContainer.scale.set(newScaleDown);
                                const newWorldCenterDown = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                                this.worldContainer.x += worldCenter.x - newWorldCenterDown.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterDown.y;
                            }
                            break;
                            
                        case 'ArrowLeft':
                            this.rotation -= CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterLeft = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterLeft.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterLeft.y;
                            break;
                            
                        case 'ArrowRight':
                            this.rotation += CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterRight = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterRight.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterRight.y;
                            break;
                    }
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (e.shiftKey) {
                        this.verticalFlipped = !this.verticalFlipped;
                        this.worldContainer.scale.y *= -1;
                    } else {
                        this.horizontalFlipped = !this.horizontalFlipped;
                        this.worldContainer.scale.x *= -1;
                    }
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
                if (!e.shiftKey) this.shiftPressed = false;
            });
        }
        
        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
        }
        
        updateCursor() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            } else if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                this.app.canvas.style.cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                this.app.canvas.style.cursor = 'grab';
            } else {
                this.app.canvas.style.cursor = 'crosshair';
            }
        }
        
        screenToCanvasForDrawing(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        screenToCanvas(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        canvasToScreen(canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            return this.canvasContainer.toGlobal(canvasPoint);
        }
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= CONFIG.canvas.height + margin;
        }
        
        updateTransformDisplay() {
            const element = document.getElementById('transform-info');
            if (element) {
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = Math.abs(this.worldContainer.scale.x).toFixed(2);
                const r = Math.round(this.rotation % 360);
                element.textContent = `x:${x} y:${y} s:${s} r:${r}°`;
            }
        }
        
        drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }
    }

    // === 十字サイトシステム ===
    class CrosshairSystem {
        constructor(canvasContainer, layerManager, app) {
            this.canvasContainer = canvasContainer;
            this.layerManager = layerManager;
            this.app = app;
            this.crosshairElement = document.getElementById('crosshair-sight');
            this.isVisible = false;
            this.currentColor = '#800000';
            this.alternateColor = '#ffffff';
            this.setupDynamicStyles();
        }
        
        setupDynamicStyles() {
            if (!this.crosshairElement) return;
            
            this.crosshairElement.style.setProperty('--crosshair-color', this.currentColor);
            this.crosshairElement.style.setProperty('--crosshair-shadow', this.alternateColor);
        }
        
        show() {
            if (!this.crosshairElement) return;
            
            this.isVisible = true;
            this.crosshairElement.classList.add('show');
            this.updatePosition();
            this.updateColor();
        }
        
        hide() {
            if (!this.crosshairElement) return;
            
            this.isVisible = false;
            this.crosshairElement.classList.remove('show');
        }
        
        updatePosition() {
            if (!this.isVisible || !this.crosshairElement) return;
            
            const canvasCenterX = CONFIG.canvas.width / 2;
            const canvasCenterY = CONFIG.canvas.height / 2;
            
            const screenPos = this.canvasContainer.toGlobal({ x: canvasCenterX, y: canvasCenterY });
            
            const canvasRect = document.getElementById('drawing-canvas').getBoundingClientRect();
            const relativeX = screenPos.x - canvasRect.left;
            const relativeY = screenPos.y - canvasRect.top;
            
            this.crosshairElement.style.left = relativeX + 'px';
            this.crosshairElement.style.top = relativeY + 'px';
            this.crosshairElement.style.transform = 'translate(-50%, -50%)';
        }
        
        updateColor() {
            if (!this.crosshairElement) return;
            
            this.crosshairElement.style.setProperty('--crosshair-color', this.currentColor);
            this.crosshairElement.style.setProperty('--crosshair-shadow', this.alternateColor);
        }
    }

    // === レイヤー管理システム ===
    class LayerManager {
        constructor(canvasContainer, app, cameraSystem) {
            this.canvasContainer = canvasContainer;
            this.app = app;
            this.cameraSystem = cameraSystem;
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
            
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            this.layerTransformPanel = null;
            this.crosshairSystem = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
            this.initializeCrosshairSystem();
        }
        
        initializeCrosshairSystem() {
            this.crosshairSystem = new CrosshairSystem(this.canvasContainer, this, this.app);
        }
        
        setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            this.setupLayerSlider('layer-x-slider', CONFIG.layer.minX, CONFIG.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-y-slider', CONFIG.layer.minY, CONFIG.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-rotation-slider', CONFIG.layer.minRotation, CONFIG.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this.setupLayerSlider('layer-scale-slider', CONFIG.layer.minScale, CONFIG.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });
            
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
        }
        
        setupLayerSlider(sliderId, min, max, initial, callback) {
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
            if (!activeLayer) return;
            
            switch(property) {
                case 'x':
                    activeLayer.x = value;
                    break;
                case 'y':
                    activeLayer.y = value;
                    break;
                case 'rotation':
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = activeLayer.scale.x < 0;
                    const vFlipped = activeLayer.scale.y < 0;
                    activeLayer.scale.x = hFlipped ? -value : value;
                    activeLayer.scale.y = vFlipped ? -value : value;
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const canvasCenterX = CONFIG.canvas.width / 2;
            const canvasCenterY = CONFIG.canvas.height / 2;
            
            const currentPivotX = activeLayer.pivot.x || 0;
            const currentPivotY = activeLayer.pivot.y || 0;
            
            activeLayer.pivot.set(canvasCenterX, canvasCenterY);
            
            if (direction === 'horizontal') {
                activeLayer.scale.x *= -1;
            } else if (direction === 'vertical') {
                activeLayer.scale.y *= -1;
            }
            
            activeLayer.x += (canvasCenterX - currentPivotX);
            activeLayer.y += (canvasCenterY - currentPivotY);
            
            this.updateLayerTransformPanelValues();
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            const rotationSlider = document.getElementById('layer-rotation-slider');
            const scaleSlider = document.getElementById('layer-scale-slider');
            
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(activeLayer.x);
            }
            
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(activeLayer.y);
            }
            
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue((activeLayer.rotation * 180) / Math.PI);
            }
            
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(Math.abs(activeLayer.scale.x));
            }
        }
        
        setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey && !this.vKeyPressed) {
                    this.enterLayerMoveMode();
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'KeyV' && this.vKeyPressed) {
                    this.exitLayerMoveMode();
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (!this.isLayerMoveMode || e.button !== 0) return;
                
                this.isLayerDragging = true;
                this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                this.app.canvas.style.cursor = 'grabbing';
                e.preventDefault();
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (!this.isLayerDragging || !this.isLayerMoveMode) return;
                
                const dx = e.clientX - this.layerDragLastPoint.x;
                const dy = e.clientY - this.layerDragLastPoint.y;
                
                const activeLayer = this.getActiveLayer();
                if (activeLayer) {
                    activeLayer.x += dx / this.cameraSystem.worldContainer.scale.x;
                    activeLayer.y += dy / this.cameraSystem.worldContainer.scale.y;
                    
                    this.updateLayerTransformPanelValues();
                    this.requestThumbnailUpdate(this.activeLayerIndex);
                }
                
                this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging && e.button === 0) {
                    this.isLayerDragging = false;
                    this.app.canvas.style.cursor = 'grab';
                }
            });
        }
        
        enterLayerMoveMode() {
            this.vKeyPressed = true;
            this.isLayerMoveMode = true;
            
            this.cameraSystem.setVKeyPressed(true);
            this.cameraSystem.updateCursor();
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            if (this.crosshairSystem) {
                this.crosshairSystem.show();
            }
        }
        
        exitLayerMoveMode() {
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            
            this.cameraSystem.setVKeyPressed(false);
            this.cameraSystem.updateCursor();
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            if (this.crosshairSystem) {
                this.crosshairSystem.hide();
            }
        }
        
        createLayer(name = 'レイヤー', isBackground = false) {
            const layer = new PIXI.Container();
            layer.label = name;
            layer.layerData = {
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: [],
                backgroundGraphics: null,
                thumbnail: null
            };
            
            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            
            const index = this.layers.length;
            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            
            return { layer, index };
        }
        
        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
            }
        }
        
        getActiveLayer() {
            return this.layers[this.activeLayerIndex] || null;
        }
        
        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;
            
            layerList.innerHTML = '';
            
            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const item = document.createElement('div');
                item.className = 'layer-item';
                if (i === this.activeLayerIndex) {
                    item.classList.add('active');
                }
                
                const visibility = document.createElement('div');
                visibility.className = 'layer-visibility';
                if (!layer.layerData.visible) {
                    visibility.classList.add('hidden');
                }
                visibility.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                `;
                
                const opacity = document.createElement('div');
                opacity.className = 'layer-opacity';
                opacity.textContent = Math.round(layer.layerData.opacity * 100) + '%';
                
                const name = document.createElement('div');
                name.className = 'layer-name';
                name.textContent = layer.layerData.name;
                
                const thumbnail = document.createElement('div');
                thumbnail.className = 'layer-thumbnail';
                if (layer.layerData.thumbnail) {
                    const img = document.createElement('img');
                    img.src = layer.layerData.thumbnail;
                    thumbnail.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'layer-thumbnail-placeholder';
                    thumbnail.appendChild(placeholder);
                }
                
                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'layer-delete-button';
                deleteBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" x2="6" y1="6" y2="18"/>
                        <line x1="6" x2="18" y1="6" y2="18"/>
                    </svg>
                `;
                
                item.appendChild(visibility);
                item.appendChild(opacity);
                item.appendChild(name);
                item.appendChild(thumbnail);
                item.appendChild(deleteBtn);
                
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('.layer-delete-button') && !e.target.closest('.layer-visibility')) {
                        this.setActiveLayer(i);
                    }
                });
                
                visibility.addEventListener('click', () => {
                    layer.layerData.visible = !layer.layerData.visible;
                    layer.visible = layer.layerData.visible;
                    this.updateLayerPanelUI();
                });
                
                deleteBtn.addEventListener('click', () => {
                    if (this.layers.length > 1) {
                        this.deleteLayer(i);
                    }
                });
                
                layerList.appendChild(item);
            }
        }
        
        deleteLayer(index) {
            if (index >= 0 && index < this.layers.length && this.layers.length > 1) {
                const layer = this.layers[index];
                this.layersContainer.removeChild(layer);
                this.layers.splice(index, 1);
                
                if (this.activeLayerIndex >= index) {
                    this.activeLayerIndex = Math.max(0, this.activeLayerIndex - 1);
                }
                
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
            }
        }
        
        requestThumbnailUpdate(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                this.thumbnailUpdateQueue.add(layerIndex);
            }
        }
        
        processThumbnailUpdates() {
            if (this.thumbnailUpdateQueue.size === 0) return;
            
            const layerIndex = this.thumbnailUpdateQueue.values().next().value;
            this.thumbnailUpdateQueue.delete(layerIndex);
            
            const layer = this.layers[layerIndex];
            if (!layer) return;
            
            try {
                const renderTexture = PIXI.RenderTexture.create({
                    width: 48,
                    height: 48,
                    resolution: 1
                });
                
                const tempContainer = new PIXI.Container();
                tempContainer.scale.set(48 / Math.max(CONFIG.canvas.width, CONFIG.canvas.height));
                tempContainer.addChild(layer);
                
                this.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                layer.layerData.thumbnail = canvas.toDataURL();
                
                tempContainer.removeChild(layer);
                renderTexture.destroy();
                
                this.updateLayerPanelUI();
            } catch (error) {
                console.error('Thumbnail update failed:', error);
            }
        }
        
        updateStatusDisplay() {
            const layerElement = document.getElementById('current-layer');
            if (layerElement && this.activeLayerIndex >= 0) {
                const activeLayer = this.getActiveLayer();
                if (activeLayer) {
                    layerElement.textContent = activeLayer.layerData.name;
                }
            }
        }
    }

    // === 描画エンジン ===
    class DrawingEngine {
        constructor(cameraSystem, layerManager) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.addPathToActiveLayer(this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            if (activeLayer.x !== 0 || activeLayer.y !== 0 || 
                activeLayer.rotation !== 0 || activeLayer.scale.x !== 1 || activeLayer.scale.y !== 1) {
                
                const matrix = new PIXI.Matrix();
                matrix.translate(-activeLayer.x, -activeLayer.y);
                matrix.rotate(-activeLayer.rotation);
                matrix.scale(1/activeLayer.scale.x, 1/activeLayer.scale.y);
                
                const transformedGraphics = new PIXI.Graphics();
                path.points.forEach((point, index) => {
                    const transformedPoint = matrix.apply(point);
                    if (index === 0) {
                        transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                    } else {
                        transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                    }
                    transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                });
                
                path.graphics = transformedGraphics;
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
        }
    }

    // === インタラクション管理 ===
    class InteractionManager {
        constructor(app, drawingEngine, layerManager) {
            this.app = app;
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.setupKeyboardEvents();
            this.setupCanvasEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
            });
        }

        setupCanvasEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
            });

            this.app.canvas.addEventListener('pointerup', (e) => {
                if (e.button !== 0) return;
                this.drawingEngine.stopDrawing();
            });

            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });
        }

        switchTool(tool) {
            this.drawingEngine.setTool(tool);
            
            if (this.layerManager.isLayerMoveMode) {
                this.layerManager.exitLayerMoveMode();
            }
            
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }

            this.updateCursor();
        }

        updateCursor() {
            const tool = this.drawingEngine.currentTool;
            this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
        }

        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
    }

    // === UI制御 ===
    class UIController {
        constructor(drawingEngine, layerManager, app) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.activePopup = null;
            this.toolbarIconClickMode = false;
            this.setupEventDelegation();
            this.setupSliders();
            this.setupCanvasResize();
        }
        
        setupEventDelegation() {
            document.addEventListener('click', (e) => {
                const toolButton = e.target.closest('.tool-button');
                if (toolButton) {
                    this.toolbarIconClickMode = true;
                    this.handleToolClick(toolButton);
                    this.toolbarIconClickMode = false;
                    return;
                }

                const layerAddBtn = e.target.closest('#add-layer-btn');
                if (layerAddBtn) {
                    const layerCount = this.layerManager.layers.length;
                    const { layer, index } = this.layerManager.createLayer(`レイヤー${layerCount}`);
                    this.layerManager.setActiveLayer(index);
                    return;
                }

                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.layer-transform-panel') &&
                    !e.target.closest('.tool-button') &&
                    !e.target.closest('.layer-panel-container')) {
                    this.closeAllPopups();
                }
            });
        }

        handleToolClick(button) {
            const toolId = button.id;
            
            const toolMap = {
                'pen-tool': () => {
                    this.drawingEngine.setTool('pen');
                    
                    if (this.layerManager.isLayerMoveMode) {
                        this.layerManager.exitLayerMoveMode();
                    }
                    
                    if (!this.toolbarIconClickMode) {
                        this.togglePopup('pen-settings');
                    }
                    this.updateToolUI('pen');
                },
                'eraser-tool': () => {
                    this.drawingEngine.setTool('eraser');
                    
                    if (this.layerManager.isLayerMoveMode) {
                        this.layerManager.exitLayerMoveMode();
                    }
                    
                    this.closeAllPopups();
                    this.updateToolUI('eraser');
                },
                'resize-tool': () => {
                    this.togglePopup('resize-settings');
                }
            };
            
            const handler = toolMap[toolId];
            if (handler) handler();
        }

        updateToolUI(tool) {
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }
        }

        togglePopup(popupId) {
            const popup = document.getElementById(popupId);
            if (!popup) return;
            
            if (this.activePopup && this.activePopup !== popup) {
                this.activePopup.classList.remove('show');
            }
            
            const isVisible = popup.classList.contains('show');
            popup.classList.toggle('show', !isVisible);
            this.activePopup = isVisible ? null : popup;
        }

        closeAllPopups() {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.classList.remove('show');
            });
            this.activePopup = null;
        }

        setupSliders() {
            this.createSlider('pen-size-slider', 0.1, 100, CONFIG.pen.size, (value) => {
                this.drawingEngine.setBrushSize(value);
                return value.toFixed(1) + 'px';
            });
            
            this.createSlider('pen-opacity-slider', 0, 100, CONFIG.pen.opacity * 100, (value) => {
                this.drawingEngine.setBrushOpacity(value / 100);
                return value.toFixed(1) + '%';
            });
        }

        createSlider(sliderId, min, max, initial, callback) {
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
                valueDisplay.textContent = callback(value);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX));
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX));
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            update(initial);
        }

        setupCanvasResize() {
            const applyBtn = document.getElementById('apply-resize');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    
                    if (widthInput && heightInput) {
                        const newWidth = parseInt(widthInput.value);
                        const newHeight = parseInt(heightInput.value);
                        
                        if (newWidth > 0 && newHeight > 0) {
                            this.resizeCanvas(newWidth, newHeight);
                            this.closeAllPopups();
                        }
                    }
                });
            }
        }

        resizeCanvas(newWidth, newHeight) {
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            const cameraSystem = this.app.cameraSystem;
            if (cameraSystem && cameraSystem.canvasMask) {
                cameraSystem.canvasMask.clear();
                cameraSystem.canvasMask.rect(0, 0, newWidth, newHeight);
                cameraSystem.canvasMask.fill(0xffffff);
            }
            
            if (cameraSystem) {
                cameraSystem.drawCameraFrame();
            }
            
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${newWidth}×${newHeight}px`;
            }
            
            for (let i = 0; i < this.layerManager.layers.length; i++) {
                this.layerManager.requestThumbnailUpdate(i);
            }
        }
    }

    // === SortableJS統合 ===
    function initializeSortable(layerManager) {
        const layerList = document.getElementById('layer-list');
        if (layerList && typeof Sortable !== 'undefined') {
            Sortable.create(layerList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: function(evt) {
                    const fromIndex = layerManager.layers.length - 1 - evt.oldIndex;
                    const toIndex = layerManager.layers.length - 1 - evt.newIndex;
                    
                    if (fromIndex !== toIndex) {
                        const layer = layerManager.layers.splice(fromIndex, 1)[0];
                        layerManager.layers.splice(toIndex, 0, layer);
                        
                        layerManager.layersContainer.removeChild(layer);
                        layerManager.layersContainer.addChildAt(layer, toIndex);
                        
                        if (layerManager.activeLayerIndex === fromIndex) {
                            layerManager.activeLayerIndex = toIndex;
                        } else if (layerManager.activeLayerIndex > fromIndex && layerManager.activeLayerIndex <= toIndex) {
                            layerManager.activeLayerIndex--;
                        } else if (layerManager.activeLayerIndex < fromIndex && layerManager.activeLayerIndex >= toIndex) {
                            layerManager.activeLayerIndex++;
                        }
                        
                        layerManager.updateLayerPanelUI();
                    }
                }
            });
        }
    }

    // === メインアプリケーション ===
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.cameraSystem = null;
            this.layerManager = null;
            this.drawingEngine = null;
            this.interactionManager = null;
            this.uiController = null;
        }

        async initialize() {
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) {
                throw new Error('Canvas container not found');
            }

            this.pixiApp = new PIXI.Application();
            
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 1,
                antialias: true,
                eventMode: 'static',
                eventFeatures: {
                    move: true,
                    globalMove: true,
                    click: true,
                    wheel: true,
                }
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);

            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;

            this.cameraSystem = new CameraSystem(this.pixiApp);
            this.layerManager = new LayerManager(this.cameraSystem.canvasContainer, this.pixiApp, this.cameraSystem);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerManager);
            this.interactionManager = new InteractionManager(this.pixiApp, this.drawingEngine, this.layerManager);
            this.uiController = new UIController(this.drawingEngine, this.layerManager, this.pixiApp);

            this.pixiApp.cameraSystem = this.cameraSystem;

            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1);

            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();

            initializeSortable(this.layerManager);

            this.pixiApp.ticker.add(() => {
                this.layerManager.processThumbnailUpdates();
                if (this.layerManager.crosshairSystem && this.layerManager.isLayerMoveMode) {
                    this.layerManager.crosshairSystem.updatePosition();
                }
            });

            this.setupWindowResize();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();

            return true;
        }

        setupWindowResize() {
            window.addEventListener('resize', () => {
                const newWidth = window.innerWidth - 50;
                const newHeight = window.innerHeight;
                
                this.pixiApp.renderer.resize(newWidth, newHeight);
                this.pixiApp.canvas.style.width = `${newWidth}px`;
                this.pixiApp.canvas.style.height = `${newHeight}px`;
                
                this.cameraSystem.initializeCamera();
                this.cameraSystem.drawCameraFrame();
                
                if (this.layerManager.crosshairSystem && this.layerManager.isLayerMoveMode) {
                    this.layerManager.crosshairSystem.updatePosition();
                }
            });
        }

        updateCanvasInfo() {
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${CONFIG.canvas.width}×${CONFIG.canvas.height}px`;
            }
        }

        updateDPRInfo() {
            const element = document.getElementById('dpr-info');
            if (element) {
                element.textContent = (window.devicePixelRatio || 1).toFixed(1);
            }
        }

        startFPSMonitor() {
            let frameCount = 0;
            let lastTime = performance.now();

            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();

                if (currentTime - lastTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    const element = document.getElementById('fps');
                    if (element) {
                        element.textContent = fps;
                    }

                    frameCount = 0;
                    lastTime = currentTime;
                }

                requestAnimationFrame(updateFPS);
            };

            updateFPS();
        }
    }

    // === アプリケーション起動 ===
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            console.log('Initializing Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingApp = app;

            console.log('🎨 Drawing App initialized successfully!');

        } catch (error) {
            console.error('Failed to initialize Drawing App:', error);
        }
    });

})();