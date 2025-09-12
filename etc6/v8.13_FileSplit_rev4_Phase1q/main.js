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

    // === カメラシステム（改修版：座標変換修正・ペン描画ズレ対策） ===
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
            
            // 初期状態の記憶（Ctrl+0リセット用）
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
            
            // キー状態管理
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
            
            // === マウス操作 ===
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    // Space + ドラッグ: 移動
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    // Shift + Space + ドラッグ: 拡縮・回転
                    this.isScaleRotateDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    // 移動
                    const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                } else if (this.isScaleRotateDragging) {
                    // 拡縮・回転
                    const dx = e.clientX - this.lastPoint.x;
                    const dy = e.clientY - this.lastPoint.y;
                    
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // 水平方向優先: 回転
                        this.rotation += (dx * CONFIG.camera.dragRotationSpeed);
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        
                        const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    } else {
                        // 垂直方向優先: 拡縮
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
            
            // === マウスホイール操作 ===
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                if (this.shiftPressed) {
                    // Shift + ホイール: 回転
                    const rotationDelta = e.deltaY < 0 ? 
                        CONFIG.camera.keyRotationDegree : -CONFIG.camera.keyRotationDegree;
                    
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    this.rotation += rotationDelta;
                    this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                } else {
                    // ホイール: 拡縮
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
            
            // === キーボード操作 ===
            document.addEventListener('keydown', (e) => {
                // Ctrl+0: キャンバスリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                    return;
                }
                
                // キー状態更新
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                if (e.shiftKey) this.shiftPressed = true;
                
                // 以下、レイヤー操作中（V押下中）は処理しない
                if (this.vKeyPressed) return;
                
                // === キャンバス移動: Space + 方向キー ===
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
                
                // === キャンバス拡縮・回転: Shift + Space + 方向キー ===
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
                
                // === キャンバス反転: H / Shift+H（レイヤー操作中以外） ===
                if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (e.shiftKey) {
                        // Shift+H: 垂直反転
                        this.verticalFlipped = !this.verticalFlipped;
                        this.worldContainer.scale.y *= -1;
                    } else {
                        // H: 水平反転
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
        
        // レイヤー操作システムからの呼び出し用
        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
        }
        
        updateCursor() {
            if (this.vKeyPressed) {
                // レイヤー操作中
                this.app.canvas.style.cursor = 'grab';
            } else if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                this.app.canvas.style.cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                this.app.canvas.style.cursor = 'grab';
            } else {
                this.app.canvas.style.cursor = 'crosshair';
            }
        }
        
        // 改修版：ペン描画用のキャンバス座標変換（レイヤー変形を考慮しない）
        screenToCanvasForDrawing(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        // レイヤー操作用の座標変換（レイヤー変形を考慮）
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

    // === 十字サイトシステム（改修版：動的色変更・レイヤー追従） ===
    class CrosshairSystem {
        constructor(canvasContainer, layerManager) {
            this.canvasContainer = canvasContainer;
            this.layerManager = layerManager;
            this.crosshairElement = document.getElementById('crosshair-sight');
            this.isVisible = false;
            
            // 動的色変更用
            this.currentColor = '#800000';
            this.alternateColor = '#ffffff';
            
            this.setupDynamicStyles();
        }
        
        setupDynamicStyles() {
            if (!this.crosshairElement) return;
            
            // 動的スタイル更新用のCSS変数を設定
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
        
        // 改修版：レイヤー位置に追従
        updatePosition() {
            if (!this.isVisible || !this.crosshairElement) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                // アクティブレイヤーがない場合はキャンバス中央
                this.crosshairElement.style.left = '50%';
                this.crosshairElement.style.top = '50%';
                return;
            }
            
            // レイヤーの現在位置を取得（キャンバス座標）
            const layerCenterX = CONFIG.canvas.width / 2 + activeLayer.x;
            const layerCenterY = CONFIG.canvas.height / 2 + activeLayer.y;
            
            // キャンバス座標をスクリーン座標に変換
            const screenPos = this.canvasContainer.toGlobal({ x: layerCenterX, y: layerCenterY });
            
            // ビューポート相対位置に変換
            const canvasRect = document.getElementById('drawing-canvas').getBoundingClientRect();
            const relativeX = screenPos.x - canvasRect.left;
            const relativeY = screenPos.y - canvasRect.top;
            
            this.crosshairElement.style.left = relativeX + 'px';
            this.crosshairElement.style.top = relativeY + 'px';
            this.crosshairElement.style.transform = 'translate(-50%, -50%)';
        }
        
        // 動的色変更（背景色に応じて視認性確保）
        updateColor() {
            if (!this.crosshairElement) return;
            
            // 簡易的な色判定（実際の背景色サンプリングは重いので固定切り替え）
            const useAlternate = Math.random() > 0.5; // 実装簡素化のための仮処理
            
            if (useAlternate) {
                this.crosshairElement.style.setProperty('--crosshair-color', this.alternateColor);
                this.crosshairElement.style.setProperty('--crosshair-shadow', this.currentColor);
            } else {
                this.crosshairElement.style.setProperty('--crosshair-color', this.currentColor);
                this.crosshairElement.style.setProperty('--crosshair-shadow', this.alternateColor);
            }
        }
    }

    // === レイヤー管理システム（改修版：十字軸追従・V解除確定） ===
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
            
            // レイヤー移動モード関連（改修版）
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // UI要素
            this.layerTransformPanel = null;
            this.crosshairSystem = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
            this.initializeCrosshairSystem();
        }
        
        initializeCrosshairSystem() {
            this.crosshairSystem = new CrosshairSystem(this.canvasContainer, this);
        }
        
        setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            // スライダー設定
            this.setupLayerSlider('layer-x-slider', CONFIG.layer.minX, CONFIG.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                this.crosshairSystem?.updatePosition(); // 十字位置更新
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-y-slider', CONFIG.layer.minY, CONFIG.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                this.crosshairSystem?.updatePosition(); // 十字位置更新
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
            
            // 反転ボタン
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

            // 外部からの値更新用
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
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            const pivot = { x: centerX, y: centerY };
            activeLayer.pivot.set(pivot.x, pivot.y);
            activeLayer.position.set(pivot.x, pivot.y);
            
            if (direction === 'horizontal') {
                activeLayer.scale.x *= -1;
            } else if (direction === 'vertical') {
                activeLayer.scale.y *= -1;
            }
            
            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateFlipButtons() {
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
        }
        
        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // X位置スライダー更新
            const xSlider = document.getElementById('layer-x-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(activeLayer.x);
            }
            
            // Y位置スライダー更新
            const ySlider = document.getElementById('layer-y-slider');
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(activeLayer.y);
            }
            
            // 回転スライダー更新
            const rotationSlider = document.getElementById('layer-rotation-slider');
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue(activeLayer.rotation * 180 / Math.PI);
            }
            
            // 拡縮スライダー更新
            const scaleSlider = document.getElementById('layer-scale-slider');
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(Math.abs(activeLayer.scale.x));
            }
            
            this.updateFlipButtons();
        }
        
        // 改修版：Vキートグル方式でのレイヤー移動モード
        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }
        
        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            this.cameraSystem.setVKeyPressed(true);
            
            // パネルと十字サイト表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            if (this.crosshairSystem) {
                this.crosshairSystem.show();
            }
            
            this.updateCursor();
        }
        
        // 改修版：V解除が確定（確定ボタン削除）
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            this.cameraSystem.setVKeyPressed(false);
            
            // パネルと十字サイト非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            if (this.crosshairSystem) {
                this.crosshairSystem.hide();
            }
            
            this.updateCursor();
            
            // 改修版：V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
        }
        
        // 改修版：レイヤー変形の確定処理（ペンズレ対策）
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // レイヤーのtransformが初期状態でない場合、描画をベイクして初期化
            if (activeLayer.x !== 0 || activeLayer.y !== 0 || 
                activeLayer.rotation !== 0 || Math.abs(activeLayer.scale.x) !== 1 || Math.abs(activeLayer.scale.y) !== 1) {
                
                try {
                    // レイヤー内容をRenderTextureに描画
                    const renderTexture = PIXI.RenderTexture.create({
                        width: CONFIG.canvas.width,
                        height: CONFIG.canvas.height,
                        resolution: 1
                    });
                    
                    this.app.renderer.render(activeLayer, { renderTexture });
                    
                    // 既存のコンテンツを削除
                    activeLayer.removeChildren();
                    
                    // RenderTextureをSpriteとして追加
                    const sprite = new PIXI.Sprite(renderTexture);
                    activeLayer.addChild(sprite);
                    
                    // Transformを初期化
                    activeLayer.position.set(0, 0);
                    activeLayer.rotation = 0;
                    activeLayer.scale.set(1, 1);
                    activeLayer.pivot.set(0, 0);
                    
                    // パスデータもクリア（新しい描画システム用）
                    if (activeLayer.layerData) {
                        activeLayer.layerData.paths = [];
                    }
                    
                    // 反転ボタンもリセット
                    this.updateFlipButtons();
                    
                    log('Layer transform confirmed and baked');
                    
                } catch (error) {
                    console.warn('Failed to confirm layer transform:', error);
                }
            }
        }
        
        setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                // 改修版：Vキートグル方式
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }
                
                // Pキー: ペンツールに切り替え（レイヤー移動モード終了）
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // Eキー: 消しゴムツールに切り替え（レイヤー移動モード終了）
                if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // === V + 方向キー: アクティブレイヤー移動 ===
                if (this.vKeyPressed && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.moveActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // === V + Shift + 方向キー: アクティブレイヤー拡縮・回転 ===
                if (this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.transformActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // === V + H / V + Shift + H: アクティブレイヤー反転 ===
                if (this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        // 修正版：常にキャンバス中央を基準点として反転
                        const centerX = CONFIG.canvas.width / 2;
                        const centerY = CONFIG.canvas.height / 2;
                        
                        // 現在の位置を保持
                        const currentX = activeLayer.x;
                        const currentY = activeLayer.y;
                        
                        // 一時的にpivotとpositionを調整
                        activeLayer.pivot.set(centerX, centerY);
                        activeLayer.position.set(centerX + currentX, centerY + currentY);
                        
                        if (e.shiftKey) {
                            // V + Shift + H: 垂直反転
                            activeLayer.scale.y *= -1;
                        } else {
                            // V + H: 水平反転
                            activeLayer.scale.x *= -1;
                        }
                        
                        this.updateFlipButtons();
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                        
                        // 十字位置も更新
                        this.crosshairSystem?.updatePosition();
                    }
                    e.preventDefault();
                }
            });
            
            // === V + ドラッグ: アクティブレイヤー移動・変形 ===
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
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        const dx = e.clientX - this.layerDragLastPoint.x;
                        const dy = e.clientY - this.layerDragLastPoint.y;
                        
                        const worldScale = this.cameraSystem.worldContainer.scale.x;
                        const adjustedDx = dx / worldScale;
                        const adjustedDy = dy / worldScale;
                        
                        if (e.shiftKey) {
                            // V + Shift + ドラッグ: 拡縮・回転
                            if (Math.abs(dx) > Math.abs(dy)) {
                                // 水平方向優先: 拡縮
                                const scaleFactor = 1 + (dx * 0.01);
                                const currentScale = Math.abs(activeLayer.scale.x);
                                const newScale = Math.max(CONFIG.layer.minScale, Math.min(CONFIG.layer.maxScale, currentScale * scaleFactor));
                                
                                activeLayer.scale.x = activeLayer.scale.x < 0 ? -newScale : newScale;
                                activeLayer.scale.y = activeLayer.scale.y < 0 ? -newScale : newScale;
                                
                                // スライダー更新
                                const scaleSlider = document.getElementById('layer-scale-slider');
                                if (scaleSlider && scaleSlider.updateValue) {
                                    scaleSlider.updateValue(newScale);
                                }
                            } else {
                                // 垂直方向優先: 回転
                                activeLayer.rotation += (dy * 0.02);
                                
                                // スライダー更新
                                const rotationSlider = document.getElementById('layer-rotation-slider');
                                if (rotationSlider && rotationSlider.updateValue) {
                                    rotationSlider.updateValue(activeLayer.rotation * 180 / Math.PI);
                                }
                            }
                        } else {
                            // V + ドラッグ: 移動
                            activeLayer.x += adjustedDx;
                            activeLayer.y += adjustedDy;
                            
                            // スライダー更新
                            const xSlider = document.getElementById('layer-x-slider');
                            const ySlider = document.getElementById('layer-y-slider');
                            if (xSlider && xSlider.updateValue) {
                                xSlider.updateValue(activeLayer.x);
                            }
                            if (ySlider && ySlider.updateValue) {
                                ySlider.updateValue(activeLayer.y);
                            }
                            
                            // 十字位置更新
                            this.crosshairSystem?.updatePosition();
                        }
                        
                        this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                    }
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }
        
        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const moveAmount = 5;
            switch(keyCode) {
                case 'ArrowUp':    activeLayer.y -= moveAmount; break;
                case 'ArrowDown':  activeLayer.y += moveAmount; break;
                case 'ArrowLeft':  activeLayer.x -= moveAmount; break;
                case 'ArrowRight': activeLayer.x += moveAmount; break;
            }
            
            // スライダー値更新
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(activeLayer.x);
            }
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(activeLayer.y);
            }
            
            // 十字位置更新
            this.crosshairSystem?.updatePosition();
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            const pivot = { x: centerX, y: centerY };
            activeLayer.pivot.set(pivot.x, pivot.y);
            activeLayer.position.set(pivot.x, pivot.y);
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(activeLayer.scale.x);
                    const newScaleUp = Math.min(CONFIG.layer.maxScale, currentScaleUp * scaleUpFactor);
                    activeLayer.scale.x = activeLayer.scale.x < 0 ? -newScaleUp : newScaleUp;
                    activeLayer.scale.y = activeLayer.scale.y < 0 ? -newScaleUp : newScaleUp;
                    
                    // スライダー更新
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp && scaleSliderUp.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown': // 縮小
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(activeLayer.scale.x);
                    const newScaleDown = Math.max(CONFIG.layer.minScale, currentScaleDown * scaleDownFactor);
                    activeLayer.scale.x = activeLayer.scale.x < 0 ? -newScaleDown : newScaleDown;
                    activeLayer.scale.y = activeLayer.scale.y < 0 ? -newScaleDown : newScaleDown;
                    
                    // スライダー更新
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown && scaleSliderDown.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft': // 左回転
                    activeLayer.rotation -= (15 * Math.PI) / 180; // 15度
                    
                    // スライダー更新
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft && rotationSliderLeft.updateValue) {
                        rotationSliderLeft.updateValue(activeLayer.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight': // 右回転
                    activeLayer.rotation += (15 * Math.PI) / 180; // 15度
                    
                    // スライダー更新
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight && rotationSliderRight.updateValue) {
                        rotationSliderRight.updateValue(activeLayer.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateCursor() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            }
        }

        createLayer(name, isBackground = false) {
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

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            return { layer, index: this.layers.length - 1 };
        }

        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                // レイヤー移動モードが有効な場合、スライダー値を更新
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                    this.crosshairSystem?.updatePosition();
                }
            }
        }

        getActiveLayer() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        }

        addPathToLayer(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        }

        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            
            const panelIndex = this.layers.length - 1 - layerIndex;
            if (panelIndex >= 0 && panelIndex < layerItems.length) {
                const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
                if (thumbnail) {
                    try {
                        const renderTexture = PIXI.RenderTexture.create({
                            width: 48, 
                            height: 48,
                            resolution: 1
                        });
                        
                        const tempContainer = new PIXI.Container();
                        const scaleX = 48 / CONFIG.canvas.width;
                        const scaleY = 48 / CONFIG.canvas.height;
                        const scale = Math.min(scaleX, scaleY);
                        
                        const layerClone = new PIXI.Container();
                        layerClone.position.copyFrom(layer.position);
                        layerClone.scale.copyFrom(layer.scale);
                        layerClone.rotation = layer.rotation;
                        layerClone.pivot.copyFrom(layer.pivot);
                        
                        layer.children.forEach(child => {
                            if (child instanceof PIXI.Graphics) {
                                const clone = child.clone();
                                layerClone.addChild(clone);
                            } else if (child instanceof PIXI.Sprite) {
                                const clone = new PIXI.Sprite(child.texture);
                                clone.position.copyFrom(child.position);
                                clone.scale.copyFrom(child.scale);
                                clone.rotation = child.rotation;
                                clone.pivot.copyFrom(child.pivot);
                                layerClone.addChild(clone);
                            }
                        });
                        
                        layerClone.scale.x *= scale;
                        layerClone.scale.y *= scale;
                        tempContainer.addChild(layerClone);
                        
                        this.app.renderer.render(tempContainer, { renderTexture });
                        
                        const canvas = this.app.renderer.extract.canvas(renderTexture);
                        const dataURL = canvas.toDataURL();
                        
                        let img = thumbnail.querySelector('img');
                        if (!img) {
                            img = document.createElement('img');
                            thumbnail.innerHTML = '';
                            thumbnail.appendChild(img);
                        }
                        img.src = dataURL;
                        
                        renderTexture.destroy();
                        tempContainer.destroy();
                        
                    } catch (error) {
                        console.warn('Thumbnail update failed:', error);
                    }
                }
            }
        }

        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';

            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${i === this.activeLayerIndex ? 'active' : ''}`;
                layerItem.dataset.layerId = layer.layerData.id;
                layerItem.dataset.layerIndex = i;

                layerItem.innerHTML = `
                    <div class="layer-visibility ${layer.layerData.visible ? '' : 'hidden'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${layer.layerData.visible ? 
                                '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                                '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                        </svg>
                    </div>
                    <div class="layer-opacity">100%</div>
                    <div class="layer-name">${layer.layerData.name}</div>
                    <div class="layer-thumbnail">
                        <div class="layer-thumbnail-placeholder"></div>
                    </div>
                    <div class="layer-delete-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                        </svg>
                    </div>
                `;

                layerItem.addEventListener('click', (e) => {
                    const target = e.target.closest('[class*="layer-"]');
                    if (target) {
                        const action = target.className;
                        if (action.includes('layer-visibility')) {
                            this.toggleLayerVisibility(i);
                            e.stopPropagation();
                        } else if (action.includes('layer-delete')) {
                            this.deleteLayer(i);
                            e.stopPropagation();
                        } else {
                            this.setActiveLayer(i);
                        }
                    } else {
                        this.setActiveLayer(i);
                    }
                });

                layerList.appendChild(layerItem);
            }
            
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        }

        toggleLayerVisibility(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();
            }
        }

        deleteLayer(layerIndex) {
            if (this.layers.length <= 1) return;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            this.updateLayerPanelUI();
            this.updateStatusDisplay();
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        }
    }

    // === 描画エンジン（改修版：ペン描画位置ズレ対策） ===
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

            // 改修版：レイヤー変形を考慮しないキャンバス座標変換を使用
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

            // 改修版：レイヤーのTransformを考慮して描画位置を調整
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
        
        // 改修版：アクティブレイヤーのTransformを考慮してパスを追加
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // レイヤーがtransformされている場合、逆変換を適用
            if (activeLayer.x !== 0 || activeLayer.y !== 0 || 
                activeLayer.rotation !== 0 || activeLayer.scale.x !== 1 || activeLayer.scale.y !== 1) {
                
                // 逆変換行列を作成
                const matrix = new PIXI.Matrix();
                matrix.translate(-activeLayer.x, -activeLayer.y);
                matrix.rotate(-activeLayer.rotation);
                matrix.scale(1/activeLayer.scale.x, 1/activeLayer.scale.y);
                
                // パスの座標を逆変換
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
            
            // レイヤー移動モードを終了
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

    // === UI制御（改修版：パネル操作最適化） ===
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
            this.setupPanelStyles();
        }
        
        // 改修版：パネルスタイル設定（十字色・パネル背景）
        setupPanelStyles() {
            // 十字サイトの動的色変更用CSS変数追加
            const crosshairStyle = document.createElement('style');
            crosshairStyle.textContent = `
                .crosshair-sight {
                    --crosshair-color: #800000;
                    --crosshair-shadow: #ffffff;
                }
                
                .crosshair-sight::before,
                .crosshair-sight::after {
                    background: var(--crosshair-color);
                    box-shadow: 0 0 2px var(--crosshair-shadow);
                }
                
                .layer-transform-panel {
                    background: rgba(240, 224, 214, 0.95) !important;
                    backdrop-filter: blur(12px);
                    top: 20px !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                }
                
                .layer-transform-panel.show {
                    animation: slideDown 0.25s ease-out;
                }
                
                @keyframes slideDown {
                    from { 
                        opacity: 0; 
                        transform: translateX(-50%) translateY(-15px) scale(0.95); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateX(-50%) translateY(0) scale(1); 
                    }
                }
                
                .panel-sections {
                    grid-template-columns: 1fr 1fr auto !important;
                    min-width: 480px !important;
                }
                
                .flip-button {
                    padding: 4px 6px !important;
                    font-size: 10px !important;
                    white-space: nowrap !important;
                    min-width: auto !important;
                    width: auto !important;
                }
                
                .panel-section-title {
                    display: none !important;
                }
                
                .flip-section {
                    gap: 2px !important;
                }
            `;
            document.head.appendChild(crosshairStyle);
            
            // 反転ボタンのテキスト変更
            setTimeout(() => {
                const flipHBtn = document.getElementById('flip-horizontal-btn');
                const flipVBtn = document.getElementById('flip-vertical-btn');
                if (flipHBtn) flipHBtn.textContent = '水平反転';
                if (flipVBtn) flipVBtn.textContent = '垂直反転';
            }, 100);
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
                    
                    // レイヤー移動モードを終了
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
                    
                    // レイヤー移動モードを終了
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
            
            console.log(`Canvas resized to ${newWidth}x${newHeight}`);
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
            
            const dpr = window.devicePixelRatio || 1;
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
            console.log('Initializing Compact Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingApp = app;

            console.log('🎨 Compact Drawing App initialized successfully!');
            console.log('📋 最終改修完了項目:');
            console.log('  - ✅ パネル3セクション化（位置・変形・反転）');
            console.log('  - ✅ 確定ボタン削除・V解除自動確定');
            console.log('  - ✅ 反転ボタンテキスト変更（水平反転・垂直反転）');
            console.log('  - ✅ パネル固定配置・半透過背景');
            console.log('  - ✅ 十字サイト動的色変更・レイヤー追従');
            console.log('  - ✅ 十字軸レイヤー位置追従実装');

        } catch (error) {
            console.error('Failed to initialize Compact Drawing App:', error);
        }
    });

})();