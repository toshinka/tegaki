/**
 * Position Manager Satellite
 * キャンバスの位置・パン操作・スペースキー制御の責務を担う衛星モジュール
 */

window.FutabaPositionManager = (function() {
    'use strict';
    
    class PositionController {
        constructor(containerElement) {
            this.container = containerElement;
            this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
            this.state = { 
                panning: false, 
                startX: 0, 
                startY: 0,
                pointerId: null,
                pointerType: null
            };
            this.handlers = { move: null, up: null, cancel: null };
            this.updateScheduled = false;
            this.spacePressed = false;
            this.initialized = false;
        }
        
        initialize(ticker) {
            this.ticker = ticker;
            this.ticker.add(() => this.updatePosition());
            this.setupPointerEvents();
            
            // Set initial position properly
            this.setInitialPosition();
            this.initialized = true;
        }
        
        setInitialPosition() {
            // Calculate proper center position accounting for sidebar
            const sidebarWidth = 50;
            const availableWidth = window.innerWidth - sidebarWidth;
            const centerX = sidebarWidth + (availableWidth / 2);
            const centerY = window.innerHeight / 2;
            
            // Reset container transform and position
            this.container.style.left = `${centerX}px`;
            this.container.style.top = `${centerY}px`;
            this.container.style.transform = 'translate(-50%, -50%)';
            
            // Reset internal position tracking
            this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
        }
        
        setupPointerEvents() {
            this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
            
            this.handlers.move = (e) => this.onPointerMove(e);
            this.handlers.up = (e) => this.onPointerUp(e);
            this.handlers.cancel = (e) => this.onPointerCancel(e);
        }
        
        onPointerDown(e) {
            if (!this.spacePressed) return;
            
            if (e.pointerType === 'pen' && e.pressure === 0) {
                return;
            }
            
            this.state.panning = true;
            this.state.startX = e.clientX;
            this.state.startY = e.clientY;
            this.state.pointerId = e.pointerId;
            this.state.pointerType = e.pointerType;
            
            this.container.setPointerCapture(e.pointerId);
            
            this.container.addEventListener('pointermove', this.handlers.move);
            this.container.addEventListener('pointerup', this.handlers.up);
            this.container.addEventListener('pointercancel', this.handlers.cancel);
            
            e.preventDefault();
        }
        
        onPointerMove(e) {
            if (!this.state.panning || e.pointerId !== this.state.pointerId) return;
            if (!this.spacePressed) return;
            
            if (e.pointerType === 'pen' && e.pressure === 0) {
                return;
            }
            
            const dx = e.clientX - this.state.startX;
            const dy = e.clientY - this.state.startY;
            
            this.position.targetX += dx;
            this.position.targetY += dy;
            
            // Set reasonable bounds
            const maxOffset = 1000;
            this.position.targetX = Math.max(-maxOffset, Math.min(maxOffset, this.position.targetX));
            this.position.targetY = Math.max(-maxOffset, Math.min(maxOffset, this.position.targetY));
            
            this.state.startX = e.clientX;
            this.state.startY = e.clientY;
            this.updateScheduled = true;
            
            e.preventDefault();
        }
        
        onPointerUp(e) {
            if (e.pointerId !== this.state.pointerId) return;
            this.stopPanning();
        }
        
        onPointerCancel(e) {
            if (e.pointerId !== this.state.pointerId) return;
            this.stopPanning();
        }
        
        updatePosition() {
            if (!this.updateScheduled || !this.initialized) return;
            
            const { x, y } = this.position;
            const { targetX, targetY } = this.position;
            
            if (x !== targetX || y !== targetY) {
                this.position.x = Math.round(targetX);
                this.position.y = Math.round(targetY);
                
                // Calculate center position accounting for sidebar
                const sidebarWidth = 50;
                const availableWidth = window.innerWidth - sidebarWidth;
                const baseCenterX = sidebarWidth + (availableWidth / 2);
                const baseCenterY = window.innerHeight / 2;
                
                // Apply offset to base center position
                const finalX = baseCenterX + this.position.x;
                const finalY = baseCenterY + this.position.y;
                
                this.container.style.left = `${finalX}px`;
                this.container.style.top = `${finalY}px`;
                this.container.style.transform = 'translate(-50%, -50%)';
            }
            
            this.updateScheduled = false;
        }
        
        stopPanning() {
            this.state.panning = false;
            
            if (this.state.pointerId && this.container.hasPointerCapture(this.state.pointerId)) {
                this.container.releasePointerCapture(this.state.pointerId);
            }
            
            this.container.removeEventListener('pointermove', this.handlers.move);
            this.container.removeEventListener('pointerup', this.handlers.up);
            this.container.removeEventListener('pointercancel', this.handlers.cancel);
            
            this.state.pointerId = null;
            this.state.pointerType = null;
        }
        
        setSpacePressed(pressed) {
            this.spacePressed = pressed;
            if (!pressed) {
                this.stopPanning();
            }
        }
        
        moveByArrows(dx, dy) {
            this.position.targetX += dx;
            this.position.targetY += dy;
            
            const maxOffset = 1000;
            this.position.targetX = Math.max(-maxOffset, Math.min(maxOffset, this.position.targetX));
            this.position.targetY = Math.max(-maxOffset, Math.min(maxOffset, this.position.targetY));
            
            this.updateScheduled = true;
        }
        
        reset() {
            this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
            this.state.panning = false;
            this.stopPanning();
            
            // Reset to initial position
            this.setInitialPosition();
        }
        
        getPosition() {
            return {
                x: Math.round(this.position.targetX),
                y: Math.round(this.position.targetY)
            };
        }
        
        screenToWorld(x, y) {
            return { x: x, y: y };
        }
        
        worldToScreen(x, y) {
            return { x: x, y: y };
        }
    }
    
    class PositionManager {
        constructor() {
            this.mainAPI = null;
            this.controller = null;
            this.ticker = null;
        }
        
        async register(mainAPI) {
            this.mainAPI = mainAPI;
            
            try {
                const container = document.getElementById('canvas-container');
                if (!container) {
                    throw new Error('Canvas container not found');
                }
                
                this.controller = new PositionController(container);
                
                // Get drawing engine ticker
                const drawingEngineProxy = mainAPI.getSatellite('drawingEngine');
                if (drawingEngineProxy) {
                    const engine = await drawingEngineProxy.request('getEngine');
                    if (engine && engine.app && engine.app.ticker) {
                        this.ticker = engine.app.ticker;
                        this.controller.initialize(this.ticker);
                    }
                }
                
                // Setup event listeners
                this.setupEventListeners();
                
                this.mainAPI.notify('position.ready');
                return true;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_POSITION_INIT_FAILED', 'Position manager initialization failed', error);
                throw error;
            }
        }
        
        setupEventListeners() {
            // Setup arrow key handlers
            this.setupArrowKeyHandlers();
        }
        
        setupArrowKeyHandlers() {
            const arrowMoveMap = {
                'ArrowLeft': [10, 0],
                'ArrowRight': [-10, 0],
                'ArrowUp': [0, 10],
                'ArrowDown': [0, -10]
            };
            
            document.addEventListener('keydown', (e) => {
                if (this.controller.spacePressed && arrowMoveMap[e.code]) {
                    const [dx, dy] = arrowMoveMap[e.code];
                    this.moveByArrows(dx, dy);
                    this.updatePositionDisplay();
                    e.preventDefault();
                }
            });
        }
        
        // Public API for main controller
        setSpacePressed(pressed) {
            if (this.controller) {
                this.controller.setSpacePressed(pressed);
                this.updateSpaceState(pressed);
            }
        }
        
        moveByArrows(dx, dy) {
            if (this.controller) {
                this.controller.moveByArrows(dx, dy);
                this.updatePositionDisplay();
            }
        }
        
        resetPosition() {
            try {
                if (this.controller) {
                    this.controller.reset();
                    this.updatePositionDisplay();
                }
            } catch (error) {
                this.mainAPI.notifyError('ERR_POSITION_RESET', 'Failed to reset position', error);
            }
        }
        
        getPosition() {
            return this.controller ? this.controller.getPosition() : { x: 0, y: 0 };
        }
        
        getSpaceState() {
            return {
                pressed: this.controller ? this.controller.spacePressed : false
            };
        }
        
        screenToWorld(x, y) {
            return this.controller ? this.controller.screenToWorld(x, y) : { x, y };
        }
        
        worldToScreen(x, y) {
            return this.controller ? this.controller.worldToScreen(x, y) : { x, y };
        }
        
        updateSpaceState(pressed) {
            // Notify other satellites about space state change
            this.mainAPI.notify('position.spaceStateChange', { pressed });
        }
        
        updatePositionDisplay() {
            const position = this.getPosition();
            const uiProxy = this.mainAPI.getSatellite('uiManager');
            if (uiProxy) {
                try {
                    uiProxy.request('updateCameraPosition', position);
                } catch (error) {
                    // Non-critical error
                }
            }
        }
        
        // Event handlers called by main
        handleSpaceDown() {
            this.setSpacePressed(true);
        }
        
        handleSpaceUp() {
            this.setSpacePressed(false);
        }
        
        handleHomeKey() {
            this.resetPosition();
        }
        
        // Cleanup
        destroy() {
            if (this.controller) {
                this.controller.stopPanning();
            }
            
            this.mainAPI = null;
            this.controller = null;
            this.ticker = null;
        }
    }
    
    return PositionManager;
})();