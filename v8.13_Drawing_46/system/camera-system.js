// ===== system/camera-system.js - Phase 1-3 + 座標変換修正版 =====

(function() {
    'use strict';

    class CameraSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this.initialState = {
                position: null,
                scale: 1.0,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            this.canvasMoveMode = false;
            
            this.worldContainer = null;
            this.canvasContainer = null;
            this.cameraFrame = null;
            this.guideLines = null;
            this.canvasMask = null;
            
            this.layerManager = null;
            this.drawingEngine = null;
        }

        init(stage, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            if (stage && stage.addChild) {
                this.app = { stage: stage };
            } else {
                throw new Error('Valid PIXI stage required for CameraSystem');
            }
            
            this.initialState.scale = this.config.camera.initialScale;
            
            this._createContainers();
            this._setupEvents();
            this.initializeCamera();
            this._drawCameraFrame();
        }

        _createContainers() {
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            this.app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.guideLines = new PIXI.Container();
            this.guideLines.label = 'guideLines';
            this.worldContainer.addChild(this.guideLines);
            this.createGuideLines();
            
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
        }

        createGuideLines() {
            this.guideLines.removeChildren();
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, this.config.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, this.config.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            this.guideLines.visible = false;
        }

        updateGuideLinesForCanvasResize() {
            this.createGuideLines();
            this._drawCameraFrame();
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            this.canvasMask.fill(0xffffff);
        }

        showGuideLines() {
            this.guideLines.visible = true;
        }

        hideGuideLines() {
            this.guideLines.visible = false;
        }

        initializeCamera() {
            const screen = this.app.stage?.parent?.screen || { width: 800, height: 600 };
            const centerX = screen.width / 2;
            const centerY = screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - this.config.canvas.width / 2;
            const initialY = centerY - this.config.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(this.config.camera.initialScale);
            
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
            
            this._emitTransformChanged();
        }

        // ========== Phase 1: 統一座標変換API（修正版） ==========
        
        /**
         * screen座標（clientX/Y）をworld座標に変換
         * 修正: renderer解像度取得方法を改善
         */
        screenClientToWorld(app, clientX, clientY) {
            const canvas = this._getSafeCanvas();
            if (!canvas) {
                return { x: clientX, y: clientY };
            }
            
            const rect = canvas.getBoundingClientRect();
            
            // DOM (CSS) 内の相対位置
            const canvasCssX = clientX - rect.left;
            const canvasCssY = clientY - rect.top;
            
            // ★修正: renderer解像度の正しい取得
            // app.stage.parent が実際の PIXI.Application インスタンス
            let rendererWidth = rect.width;
            let rendererHeight = rect.height;
            
            if (app?.stage?.parent) {
                const parent = app.stage.parent;
                // renderer.screen または renderer自体のwidth/heightを使用
                if (parent.renderer?.screen) {
                    rendererWidth = parent.renderer.screen.width;
                    rendererHeight = parent.renderer.screen.height;
                } else if (parent.screen) {
                    rendererWidth = parent.screen.width;
                    rendererHeight = parent.screen.height;
                } else if (parent.renderer) {
                    rendererWidth = parent.renderer.width || rect.width;
                    rendererHeight = parent.renderer.height || rect.height;
                }
            }
            
            // 内部ピクセルスケール（高DPI対応）
            const pixelScaleX = rendererWidth / rect.width;
            const pixelScaleY = rendererHeight / rect.height;
            const canvasPxX = canvasCssX * pixelScaleX;
            const canvasPxY = canvasCssY * pixelScaleY;

            // worldContainerのワールド変換の逆行列でworld座標に変換
            if (!this.worldContainer || !this.worldContainer.transform) {
                return { x: canvasPxX, y: canvasPxY };
            }
            
            const inv = this.worldContainer.transform.worldTransform.clone().invert();
            const p = inv.apply({ x: canvasPxX, y: canvasPxY });
            
            return { x: p.x, y: p.y };
        }

        // ========== Phase 3: resizeCanvas厳密実装 ==========
        
        resizeCanvas(newWidth, newHeight, alignOptions = { horizontal: 'center', vertical: 'center' }) {
            if (!this.app) return;
            
            window.TEGAKI_CONFIG.canvas.width = newWidth;
            window.TEGAKI_CONFIG.canvas.height = newHeight;

            if (this.app.stage && this.app.stage.parent && this.app.stage.parent.resize) {
                this.app.stage.parent.resize(newWidth, newHeight);
            }

            this.updateGuideLinesForCanvasResize();

            if (this.eventBus) {
                this.eventBus.emit('camera:transform-changed');
                this.eventBus.emit('camera:resized', { width: newWidth, height: newHeight });
                
                setTimeout(() => {
                    this.eventBus.emit('animation:thumbnails-need-update');
                }, 100);
            }
        }

        _setupEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            this._setupMouseEvents(canvas);
            this._setupKeyboardEvents();
        }

        _getSafeCanvas() {
            if (this.app.stage?.parent?.canvas) {
                return this.app.stage.parent.canvas;
            }
            if (this.app.stage?.parent?.view) {
                return this.app.stage.parent.view;
            }
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) {
                return canvasElements[0];
            }
            return null;
        }

        _setupMouseEvents(canvas) {
            canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return;
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    this.isDragging = true;
                    this.canvasMoveMode = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this._emitCursorChange('move');
                    this._emitCanvasMoveMode(true);
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    this.isScaleRotateDragging = true;
                    this.canvasMoveMode = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this._emitCursorChange('grab');
                    this._emitCanvasMoveMode(true);
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    const dx = (e.clientX - this.lastPoint.x) * this.config.camera.dragMoveSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.config.camera.dragMoveSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this._emitTransformChanged();
                } else if (this.isScaleRotateDragging) {
                    this._handleScaleRotateDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || !this.spacePressed)) {
                    this.isDragging = false;
                    this.canvasMoveMode = false;
                    this._emitCanvasMoveMode(false);
                    this._emitCursorUpdate();
                }
                if (this.isScaleRotateDragging && (e.button === 2 || !this.spacePressed)) {
                    this.isScaleRotateDragging = false;
                    this.canvasMoveMode = false;
                    this._emitCanvasMoveMode(false);
                    this._emitCursorUpdate();
                }
            });

            canvas.addEventListener('pointerenter', () => {
                this._emitCursorUpdate();
            });
            
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.vKeyPressed) return;
                
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (this.shiftPressed) {
                    this._handleWheelRotation(e, centerX, centerY);
                } else {
                    this._handleWheelZoom(e, centerX, centerY);
                }
                
                this._emitTransformChanged();
            });
        }

        _handleScaleRotateDrag(e) {
            const dx = e.clientX - this.lastPoint.x;
            const dy = e.clientY - this.lastPoint.y;
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            if (Math.abs(dx) > Math.abs(dy)) {
                this.rotation += (dx * this.config.camera.dragRotationSpeed);
                this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            } else {
                const scaleFactor = 1 + (-dy * this.config.camera.dragScaleSpeed);
                const newScale = this.worldContainer.scale.x * scaleFactor;
                
                if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                    this.worldContainer.scale.set(newScale);
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                }
            }
            
            this.lastPoint = { x: e.clientX, y: e.clientY };
            this._emitTransformChanged();
        }

        _handleWheelRotation(e, centerX, centerY) {
            const rotationDelta = e.deltaY < 0 ? 
                this.config.camera.keyRotationDegree : -this.config.camera.keyRotationDegree;
            
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            this.rotation += rotationDelta;
            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
            
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
        }

        _handleWheelZoom(e, centerX, centerY) {
            const scaleFactor = e.deltaY < 0 ? 1 + this.config.camera.wheelZoomSpeed : 1 - this.config.camera.wheelZoomSpeed;
            const newScale = this.worldContainer.scale.x * scaleFactor;
            
            if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                this.worldContainer.scale.set(newScale);
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            }
        }

        _setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                this._updateKeyStates(e);
                
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                    return;
                }
                
                if (e.code === 'Space' && !this.spacePressed) {
                    this.spacePressed = true;
                    this._emitCursorUpdate();
                    e.preventDefault();
                    return;
                }
                
                if (this.vKeyPressed) return;
                
                if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && 
                    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    return;
                }
                
                this._handleCameraMoveKeys(e);
                this._handleCameraTransformKeys(e);
                this._handleCameraFlipKeys(e);
            });
            
            document.addEventListener('keyup', (e) => {
                this._resetKeyStates(e);
            });
            
            window.addEventListener('blur', () => {
                this._resetAllKeyStates();
            });
            
            window.addEventListener('focus', () => {
                this._resetAllKeyStates();
            });
        }

        _updateKeyStates(e) {
            if (e.shiftKey) this.shiftPressed = true;
        }

        _resetKeyStates(e) {
            if (e.code === 'Space') {
                this.spacePressed = false;
                if (this.canvasMoveMode) {
                    this.canvasMoveMode = false;
                    this.isDragging = false;
                    this.isScaleRotateDragging = false;
                    this._emitCanvasMoveMode(false);
                }
                this._emitCursorUpdate();
            }
            if (!e.shiftKey) {
                this.shiftPressed = false;
            }
        }

        _resetAllKeyStates() {
            this.spacePressed = false;
            this.shiftPressed = false;
            if (this.canvasMoveMode) {
                this.canvasMoveMode = false;
                this.isDragging = false;
                this.isScaleRotateDragging = false;
                this._emitCanvasMoveMode(false);
            }
            this._emitCursorUpdate();
        }

        _handleCameraMoveKeys(e) {
            if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const moveAmount = this.config.camera.keyMoveAmount;
                switch(e.code) {
                    case 'ArrowDown':    this.worldContainer.y += moveAmount; break;
                    case 'ArrowUp':      this.worldContainer.y -= moveAmount; break;
                    case 'ArrowRight':   this.worldContainer.x += moveAmount; break;
                    case 'ArrowLeft':    this.worldContainer.x -= moveAmount; break;
                }
                this._emitTransformChanged();
                e.preventDefault();
            }
        }

        _handleCameraTransformKeys(e) {
            if (this.spacePressed && this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                switch(e.code) {
                    case 'ArrowUp':
                        this._scaleCamera(1 + this.config.camera.wheelZoomSpeed, worldCenter, centerX, centerY);
                        break;
                    case 'ArrowDown':
                        this._scaleCamera(1 - this.config.camera.wheelZoomSpeed, worldCenter, centerX, centerY);
                        break;
                    case 'ArrowLeft':
                        this._rotateCamera(-this.config.camera.keyRotationDegree, worldCenter, centerX, centerY);
                        break;
                    case 'ArrowRight':
                        this._rotateCamera(this.config.camera.keyRotationDegree, worldCenter, centerX, centerY);
                        break;
                }
                
                this._emitTransformChanged();
                e.preventDefault();
            }
        }

        _handleCameraFlipKeys(e) {
            if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
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
                
                this._emitTransformChanged();
                e.preventDefault();
            }
        }

        _scaleCamera(scaleFactor, worldCenter, centerX, centerY) {
            const newScale = this.worldContainer.scale.x * scaleFactor;
            if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                this.worldContainer.scale.set(newScale);
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            }
        }

        _rotateCamera(rotationDelta, worldCenter, centerX, centerY) {
            this.rotation += rotationDelta;
            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
        }

        _emitTransformChanged() {
            if (this.eventBus) {
                this.eventBus.emit('camera:transform-changed', {
                    x: Math.round(this.worldContainer.x),
                    y: Math.round(this.worldContainer.y),
                    scale: Math.abs(this.worldContainer.scale.x).toFixed(2),
                    rotation: Math.round(this.rotation % 360)
                });
            }
        }

        _emitCanvasMoveMode(active) {
            if (this.eventBus) {
                this.eventBus.emit('camera:canvas-move-mode', { active });
            }
        }

        _emitCursorUpdate() {
            if (!this.eventBus) return;
            
            let cursor = 'crosshair';
            
            if (this.vKeyPressed) {
                cursor = 'grab';
            } else if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                cursor = 'grab';
            } else {
                const tool = this.drawingEngine ? this.drawingEngine.currentTool : 'pen';
                cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            }
            
            this.eventBus.emit('camera:cursor-changed', { cursor });
        }

        _emitCursorChange(cursor) {
            if (this.eventBus) {
                this.eventBus.emit('camera:cursor-changed', { cursor });
            }
        }

        screenToLayer(screenX, screenY) {
            const canvas = this._getSafeCanvas();
            if (!canvas) {
                return this.canvasContainer.toLocal({ x: screenX, y: screenY });
            }
            
            const rect = canvas.getBoundingClientRect();
            const relativeX = screenX - rect.left;
            const relativeY = screenY - rect.top;
            
            return this.canvasContainer.toLocal({ x: relativeX, y: relativeY });
        }

        screenToCanvas(screenX, screenY) {
            return this.screenToLayer(screenX, screenY);
        }

        updateCoordinates(x, y) {
        }

        setZoom(level) {
            const clampedLevel = Math.max(this.config.camera.minScale, Math.min(this.config.camera.maxScale, level));
            this.worldContainer.scale.set(clampedLevel);
            this._emitTransformChanged();
        }

        pan(dx, dy) {
            this.worldContainer.x += dx;
            this.worldContainer.y += dy;
            this._emitTransformChanged();
        }

        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
            this._emitCursorUpdate();
        }

        toScreenCoords(worldX, worldY) {
            const canvasPoint = { x: worldX, y: worldY };
            return this.canvasContainer.toGlobal(canvasPoint);
        }

        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= this.config.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= this.config.canvas.height + margin;
        }

        updateCursor() {
            this._emitCursorUpdate();
        }

        switchTool(toolName) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(toolName);
            }
            
            if (this.layerManager && this.layerManager.isLayerMoveMode) {
                this.layerManager.exitLayerMoveMode();
            }
            
            if (this.eventBus) {
                this.eventBus.emit('camera:tool-switched', { tool: toolName });
            }

            this._emitCursorUpdate();
        }

        updateTransformDisplay() {
            this._emitTransformChanged();
        }

        _drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }

        getCameraFrameCenter() {
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            return this.worldContainer.toGlobal({ x: centerX, y: centerY });
        }

        isCanvasMoveMode() {
            return this.canvasMoveMode;
        }

        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    }

    window.TegakiCameraSystem = CameraSystem;

})();

console.log('✅ camera-system.js (Phase 1-3 + 座標変換修正版) loaded');