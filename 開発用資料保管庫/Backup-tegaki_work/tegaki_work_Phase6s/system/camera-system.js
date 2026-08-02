/**
 * ============================================================================
 * ファイル名: system/camera-system.js
 * 責務: カメラ制御（ズーム、パン、回転、反転）を担当する
 * 依存: config.js, system/event-bus.js, coordinate-system.js, pixi.js
 * 被依存: core-initializer.js, keyboard-handler.js等
 * 公開API: CameraSystem
 * イベント発火: camera:transform-changed, camera:canvas-move-mode, camera:cursor-changed, camera:resized
 * イベント受信: keyboard:vkey-state-changed, camera:flip-horizontal, camera:flip-vertical, camera:reset
 * グローバル登録: window.TegakiCameraSystem
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { Container, Graphics } from 'pixi.js';
import { TEGAKI_CONFIG } from '../config.js';
import { TegakiEventBus } from './event-bus.js';
import { coordinateSystem } from '../coordinate-system.js';

export class CameraSystem {
    constructor() {
        this.app = null;
        this.config = null;
        this.eventBus = null;
        this.coordinateSystem = null;
        
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
        this.dragTrigger = null; // [指示書] ドラッグ起点の追跡 ('space' | 'rightButton')
        this.dragPointerId = null;
        
        this.worldContainer = null;
        this.canvasContainer = null;
        this.cameraFrame = null;
        this.guideLines = null;
        this.canvasMask = null;
        
        this.layerManager = null;
        this.drawingEngine = null;
    }

    init(stage, eventBus, config) {
        this.eventBus = eventBus || TegakiEventBus;
        this.config = config || TEGAKI_CONFIG;
        this.coordinateSystem = coordinateSystem;
        
        if (stage && stage.addChild) {
            this.app = { stage: stage };
        } else {
            throw new Error('Valid PIXI stage required for CameraSystem');
        }
        
        this.initialState.scale = this.config.camera.initialScale;
        
        this._createContainers();
        this._setupEvents();
        this._setupEventBusListeners();
        this.initializeCamera();
        this._drawCameraFrame();
        this._setupCheckerPattern();
    }

    _setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // Vキー状態の同期
        this.eventBus.on('keyboard:vkey-state-changed', ({ pressed }) => {
            this.vKeyPressed = pressed;
            this._emitCursorUpdate();
        });
        
        // カメラ水平反転
        this.eventBus.on('camera:flip-horizontal', () => {
            this._toggleViewFlip('horizontal');
            this._emitTransformChanged();
        });
        
        // カメラ垂直反転
        this.eventBus.on('camera:flip-vertical', () => {
            this._toggleViewFlip('vertical');
            this._emitTransformChanged();
        });
        
        // カメラリセット
        this.eventBus.on('camera:reset', () => {
            this.resetCanvas();
        });
    }

    _setupCheckerPattern() {
        const attachChecker = () => {
            if (window.layerManager?.attachCheckerPatternToWorld) {
                window.layerManager.attachCheckerPatternToWorld(this.canvasContainer);
            } else {
                setTimeout(attachChecker, 100);
            }
        };
        attachChecker();
    }

    _createContainers() {
        this.worldContainer = new Container();
        this.worldContainer.label = 'worldContainer';
        this.app.stage.addChild(this.worldContainer);
        
        this.canvasContainer = new Container();
        this.canvasContainer.label = 'canvasContainer';
        this.worldContainer.addChild(this.canvasContainer);
        
        this.cameraFrame = new Graphics();
        this.cameraFrame.label = 'cameraFrame';
        this.worldContainer.addChild(this.cameraFrame);
        
        this.guideLines = new Container();
        this.guideLines.label = 'guideLines';
        this.worldContainer.addChild(this.guideLines);
        this.createGuideLines();
        
        this.canvasMask = new Graphics();
        this.canvasMask.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
        this.canvasMask.fill(0xffffff);
        this.worldContainer.addChild(this.canvasMask);
        this.canvasContainer.mask = this.canvasMask;
    }

    createGuideLines() {
        this.guideLines.removeChildren();
        
        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        
        const verticalLine = new Graphics();
        verticalLine.rect(centerX - 0.5, 0, 1, this.config.canvas.height);
        verticalLine.fill({ color: 0x800000, alpha: 0.8 });
        this.guideLines.addChild(verticalLine);
        
        const horizontalLine = new Graphics();
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
        const screen = this.app.renderer?.screen || this.app.screen || { width: window.innerWidth, height: window.innerHeight };
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

    _getCanvasCenterStagePoint() {
        const localX = this.config.canvas.width / 2;
        const localY = this.config.canvas.height / 2;
        const pivot = this.worldContainer.pivot || { x: 0, y: 0 };
        const scaleX = this.worldContainer.scale?.x ?? 1;
        const scaleY = this.worldContainer.scale?.y ?? 1;
        const rotation = this.worldContainer.rotation || 0;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const scaledX = (localX - pivot.x) * scaleX;
        const scaledY = (localY - pivot.y) * scaleY;

        return {
            x: this.worldContainer.x + (scaledX * cos) - (scaledY * sin),
            y: this.worldContainer.y + (scaledX * sin) + (scaledY * cos)
        };
    }

    _preserveCanvasCenter(updateTransform) {
        const before = this._getCanvasCenterStagePoint();
        updateTransform();
        const after = this._getCanvasCenterStagePoint();
        this.worldContainer.x += before.x - after.x;
        this.worldContainer.y += before.y - after.y;
    }

    _getScaleMagnitude() {
        return Math.abs(this.worldContainer.scale?.x || this.config.camera.initialScale);
    }

    _applyScaleMagnitude(scaleMagnitude) {
        const horizontalSign = this.horizontalFlipped ? -1 : 1;
        const verticalSign = this.verticalFlipped ? -1 : 1;
        this.worldContainer.scale.set(
            scaleMagnitude * horizontalSign,
            scaleMagnitude * verticalSign
        );
    }

    _toggleViewFlip(direction) {
        this._preserveCanvasCenter(() => {
            if (direction === 'horizontal') {
                this.horizontalFlipped = !this.horizontalFlipped;
            } else if (direction === 'vertical') {
                this.verticalFlipped = !this.verticalFlipped;
            }
            this._applyScaleMagnitude(this._getScaleMagnitude());
        });
    }

    screenClientToWorld(clientX, clientY) {
        if (!this.worldContainer) {
            return { x: clientX, y: clientY };
        }
        
        const worldPoint = this.worldContainer.toLocal({ x: clientX, y: clientY });
        return { x: worldPoint.x, y: worldPoint.y };
    }
    
    worldToScreen(worldX, worldY) {
        if (!this.worldContainer) {
            return { x: worldX, y: worldY };
        }
        
        const worldTransform = this.worldContainer.transform.worldTransform;
        const screenPoint = worldTransform.apply({ x: worldX, y: worldY });
        
        return { x: screenPoint.x, y: screenPoint.y };
    }

    resizeCanvas(newWidth, newHeight, alignOptions = { horizontal: 'center', vertical: 'center' }) {
        if (!this.app) return;
        
        const oldWidth = this.config.canvas.width;
        const oldHeight = this.config.canvas.height;
        
        this.config.canvas.width = newWidth;
        this.config.canvas.height = newHeight;
        
        this.updateGuideLinesForCanvasResize();
        
        if (this.coordinateSystem && typeof this.coordinateSystem.clearCache === 'function') {
            this.coordinateSystem.clearCache();
        }

        // [指示書] リサイズ後のセンタリング
        this.centerCanvasOnScreen();
        
        if (this.eventBus) {
            this.eventBus.emit('camera:resized', { 
                width: newWidth, 
                height: newHeight,
                oldWidth,
                oldHeight,
                align: alignOptions
            });
            
            this.eventBus.emit('camera:transform-changed');
        }
    }

    /**
     * [指示書] キャンバス中心を画面中央へ合わせる
     */
    centerCanvasOnScreen() {
        if (!this.worldContainer) return;
        const screen = this.app.renderer?.screen || this.app.screen || { width: window.innerWidth, height: window.innerHeight };
        const canvasCenterGlobal = this._getCanvasCenterStagePoint();
        
        // 画面中央との差分を worldContainer の位置に加算
        this.worldContainer.x += (screen.width / 2) - canvasCenterGlobal.x;
        this.worldContainer.y += (screen.height / 2) - canvasCenterGlobal.y;
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

            // [修正] ペン入力でもSpaceキーが押されている場合はカメラ移動を許可する。
            // Spaceなしの場合は、ペンは描画エンジンへ通すために無視する。
            if (e.pointerType === 'pen' && !this.spacePressed) return;

            const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

            if ((isMouseSecondaryButton || this.spacePressed) && !this.shiftPressed) {
                this.isDragging = true;
                this.canvasMoveMode = true;
                this.dragTrigger = this.spacePressed ? 'space' : 'rightButton';
                this.dragPointerId = e.pointerId;
                this.lastPoint = { x: e.clientX, y: e.clientY };
                this._emitCursorChange('move');
                this._emitCanvasMoveMode(true);
                e.preventDefault();
            } else if ((isMouseSecondaryButton || this.spacePressed) && this.shiftPressed) {
                this.isScaleRotateDragging = true;
                this.canvasMoveMode = true;
                this.dragTrigger = this.spacePressed ? 'space' : 'rightButton';
                this.dragPointerId = e.pointerId;
                this.lastPoint = { x: e.clientX, y: e.clientY };
                this._emitCursorChange('grab');
                this._emitCanvasMoveMode(true);
                e.preventDefault();
            }
        });
        
        canvas.addEventListener('pointermove', (e) => {
            if (this.dragPointerId !== null && e.pointerId !== this.dragPointerId) {
                return;
            }

            // [指示書] Space起点のドラッグ中にSpaceが離されたら中断
            if (this.dragTrigger === 'space' && !this.spacePressed) {
                this._stopDragging();
                return;
            }

            // Space+ドラッグは接触/左ボタンが残っている間だけ継続する。
            // (ペン入力の場合は pressure が 0 になっても pointerup が来るまで継続させたいケースもあるが、
            //  基本的には e.buttons === 0 で判定して安全に中断する)
            if (this.dragTrigger === 'space' && e.buttons === 0) {
                this._stopDragging();
                return;
            }

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
            if (this.dragPointerId !== null && e.pointerId !== this.dragPointerId) {
                return;
            }

            const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

            if (this.isDragging && (this.dragTrigger === 'space' || isMouseSecondaryButton || !this.spacePressed)) {
                this._stopDragging();
            }
            if (this.isScaleRotateDragging && (this.dragTrigger === 'space' || isMouseSecondaryButton || !this.spacePressed)) {
                this._stopDragging();
            }
        });

        canvas.addEventListener('pointercancel', (e) => {
            if (this.dragPointerId === null || e.pointerId === this.dragPointerId) {
                this._stopDragging();
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
            
            if (!this.spacePressed && this.shiftPressed) {
                this._handleWheelRotation(e, centerX, centerY);
                this._emitTransformChanged();
                return;
            }
            
            if (this.spacePressed && !this.shiftPressed) {
                this._handleWheelZoom(e, centerX, centerY);
                this._emitTransformChanged();
                return;
            }
            
            if (this.spacePressed && this.shiftPressed) {
                this._handleWheelRotation(e, centerX, centerY);
                this._emitTransformChanged();
                return;
            }
            
            if (!this.spacePressed && !this.shiftPressed) {
                this._handleWheelZoom(e, centerX, centerY);
                this._emitTransformChanged();
                return;
            }
        });
    }

    _stopDragging() {
        this.isDragging = false;
        this.isScaleRotateDragging = false;
        this.canvasMoveMode = false;
        this.dragTrigger = null;
        this.dragPointerId = null;
        this._emitCanvasMoveMode(false);
        this._emitCursorUpdate();
    }

    _handleScaleRotateDrag(e) {
        const dx = e.clientX - this.lastPoint.x;
        const dy = e.clientY - this.lastPoint.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            this._rotateCamera(dx * this.config.camera.dragRotationSpeed);
        } else {
            const scaleFactor = 1 + (-dy * this.config.camera.dragScaleSpeed);
            const newScale = this._getScaleMagnitude() * scaleFactor;
            
            if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                this._preserveCanvasCenter(() => this._applyScaleMagnitude(newScale));
            }
        }
        
        this.lastPoint = { x: e.clientX, y: e.clientY };
        this._emitTransformChanged();
    }

    _handleWheelRotation(e, centerX, centerY) {
        const rotationDelta = e.deltaY < 0 ? 
            this.config.camera.keyRotationDegree : -this.config.camera.keyRotationDegree;
        this._rotateCamera(rotationDelta);
    }

    _handleWheelZoom(e, centerX, centerY) {
        const scaleFactor = e.deltaY < 0 ? 1 + this.config.camera.wheelZoomSpeed : 1 - this.config.camera.wheelZoomSpeed;
        const newScale = this._getScaleMagnitude() * scaleFactor;
        
        if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
            this._preserveCanvasCenter(() => this._applyScaleMagnitude(newScale));
        }
    }

    _setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            this._updateKeyStates(e);
            
            if (e.ctrlKey && e.code === 'Digit0' && !this.vKeyPressed) {
                this.resetCanvas();
                e.preventDefault();
                return;
            }
            
            if (e.code === 'Space' && !this.spacePressed) {
                this.spacePressed = true;
                // [指示書] keydown単体では canvasMoveMode = true にしない。
                // 実際に pointerdown (Space+Click) した時にモード開始する。
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
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                // [指示書] Spaceを離した瞬間にドラッグ終了
                if (this.dragTrigger === 'space') {
                    this._stopDragging();
                }
                this._emitCursorUpdate();
            }
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
        if (!e.shiftKey) {
            this.shiftPressed = false;
        }
    }

    _resetAllKeyStates() {
        this.spacePressed = false;
        this.shiftPressed = false;
        this._stopDragging();
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
            switch(e.code) {
                case 'ArrowUp':
                    this._scaleCamera(1 + this.config.camera.wheelZoomSpeed);
                    break;
                case 'ArrowDown':
                    this._scaleCamera(1 - this.config.camera.wheelZoomSpeed);
                    break;
                case 'ArrowLeft':
                    this._rotateCamera(-this.config.camera.keyRotationDegree);
                    break;
                case 'ArrowRight':
                    this._rotateCamera(this.config.camera.keyRotationDegree);
                    break;
            }
            
            this._emitTransformChanged();
            e.preventDefault();
        }
    }

    _scaleCamera(scaleFactor) {
        const newScale = this._getScaleMagnitude() * scaleFactor;
        if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
            this._preserveCanvasCenter(() => this._applyScaleMagnitude(newScale));
        }
    }

    _rotateCamera(rotationDelta) {
        this._preserveCanvasCenter(() => {
            this.rotation += rotationDelta;
            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
        });
    }

    _emitTransformChanged() {
        if (this.eventBus) {
            this.eventBus.emit('camera:transform-changed', {
                x: Math.round(this.worldContainer.x),
                y: Math.round(this.worldContainer.y),
                scale: Math.abs(this.worldContainer.scale.x).toFixed(2),
                rotation: Math.round(this.rotation % 360),
                horizontalFlipped: !!this.horizontalFlipped,
                verticalFlipped: !!this.verticalFlipped
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
            const currentTool = window.CoreRuntime?.api?.tool?.get();
            cursor = currentTool === 'eraser' ? 'cell' : 'crosshair';
        }
        
        this.eventBus.emit('camera:cursor-changed', { cursor });
    }

    _emitCursorChange(cursor) {
        if (this.eventBus) {
            this.eventBus.emit('camera:cursor-changed', { cursor });
        }
    }

    screenToLayer(screenX, screenY) {
        return this.canvasContainer.toLocal({ x: screenX, y: screenY });
    }

    screenToCanvas(screenX, screenY) {
        return this.screenToLayer(screenX, screenY);
    }

    setZoom(level) {
        const clampedLevel = Math.max(this.config.camera.minScale, Math.min(this.config.camera.maxScale, level));
        this._preserveCanvasCenter(() => this._applyScaleMagnitude(clampedLevel));
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
        const canvasPoint = this.coordinateSystem?.worldToCanvas?.(worldX, worldY);
        return canvasPoint
            ? { x: canvasPoint.canvasX, y: canvasPoint.canvasY }
            : { x: worldX, y: worldY };
    }

    isPointInExtendedCanvas(canvasPoint, margin = 50) {
        return canvasPoint.x >= -margin && canvasPoint.x <= this.config.canvas.width + margin &&
               canvasPoint.y >= -margin && canvasPoint.y <= this.config.canvas.height + margin;
    }

    updateCursor() {
        this._emitCursorUpdate();
    }

    updateTransformDisplay() {
        this._emitTransformChanged();
    }

    _drawCameraFrame() {
        this.cameraFrame.clear();
    }

    get cameraFrameBounds() {
        return {
            x: 0,
            y: 0,
            width: this.config.canvas.width,
            height: this.config.canvas.height
        };
    }

    getCameraFrameCenter() {
        return this._getCanvasCenterStagePoint();
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

// 下位互換性のためにグローバルに登録
window.TegakiCameraSystem = CameraSystem;
