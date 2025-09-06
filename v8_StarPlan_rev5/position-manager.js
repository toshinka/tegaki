/**
 * ファイル名: position-manager.js
 * @provides PositionManager, パン・ズーム機能, 座標変換
 * @requires MainController API, DrawingEngine
 * PositionManager衛星 - パン・ズーム管理、座標変換、ペン対応
 * 星型分離版 v8rev8 - 修正版（PIXI座標系統一・type付きイベント対応）
 */

window.PositionManager = class PositionManager {
    constructor() {
        this.container = null;
        this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.zoom = { current: 1.0, target: 1.0, min: 0.1, max: 5.0 };
        this.state = { 
            panning: false, 
            startX: 0, 
            startY: 0,
            pointerId: null,
            pointerType: null
        }
};;
        this.handlers = { move: null, up: null, cancel: null };
        this.updateScheduled = false;
        this.mainApi = null;
        this.ticker = null;
        this.drawingEngine = null; // PIXIコンテナ操作のため
    }
    
    async register(mainApi) {
        this.mainApi = mainApi;
    }
    
    async initialize(ticker = null) {
        try {
            this.container = document.getElementById('canvas-container');
            if (!this.container) {
                throw new Error('Canvas container not found');
            }
            
            this.ticker = ticker;
            if (this.ticker) {
                this.ticker.add(() => this.updatePosition());
            }
            
            // DrawingEngineインスタンスの取得
            this.drawingEngine = this.mainApi?.getSatellite?.('engine') || window.DrawingEngineInstance;
            
            this.setupPointerEvents();
            this.log('PositionManager initialized successfully');
            
        } catch (error) {
            this.reportError('POSITION_INIT_ERROR', 'Failed to initialize position manager', error);
            throw error;
        }
    }
    
    setupPointerEvents() {
        this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        
        this.handlers.move = (e) => this.onPointerMove(e);
        this.handlers.up = (e) => this.onPointerUp(e);
        this.handlers.cancel = (e) => this.onPointerCancel(e);
        
        // ホイールズーム対応
        this.container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        this.log('Pointer events setup completed');
    }
    
    onPointerDown(e) {
        try {
            // MainController への参照修正
            const spacePressed = window.futabaApp?.getSpacePressed?.() || false;
            if (!spacePressed) return;
            
            // ペン入力の圧力チェック
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
            this.log(`Pan started with ${e.pointerType}`);
            
        } catch (error) {
            this.reportError('PAN_START_ERROR', 'Failed to start panning', error);
        }
    }
    
    onPointerMove(e) {
        if (!this.state.panning || e.pointerId !== this.state.pointerId) return;
        
        try {
            // MainController への参照修正
            const spacePressed = window.futabaApp?.getSpacePressed?.() || false;
            if (!spacePressed) return;
            
            // ペン入力の圧力チェック
            if (e.pointerType === 'pen' && e.pressure === 0) {
                return;
            }
            
            const dx = e.clientX - this.state.startX;
            const dy = e.clientY - this.state.startY;
            
            this.position.targetX += dx;
            this.position.targetY += dy;
            
            // 移動制限
            const maxOffset = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            this.position.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, this.position.targetX));
            this.position.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, this.position.targetY));
            
            this.state.startX = e.clientX;
            this.state.startY = e.clientY;
            this.updateScheduled = true;
            this.updateStatusDisplay();
            
            e.preventDefault();
            
        } catch (error) {
            this.reportError('PAN_MOVE_ERROR', 'Failed to update pan position', error);
        }
    }
    
    onPointerUp(e) {
        if (e.pointerId !== this.state.pointerId) return;
        this.stopPanning();
    }
    
    onPointerCancel(e) {
        if (e.pointerId !== this.state.pointerId) return;
        this.stopPanning();
    }
    
    onWheel(e) {
        try {
            // Ctrl + ホイールでズーム
            if (e.ctrlKey) {
                e.preventDefault();
                
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = this.zoom.target * delta;
                
                this.setZoom(newZoom, e.offsetX, e.offsetY);
            }
        } catch (error) {
            this.reportError('WHEEL_ERROR', 'Wheel event handling failed', error);
        }
    }
    
    setZoom(zoom, centerX = null, centerY = null) {
        try {
            const oldZoom = this.zoom.target;
            this.zoom.target = Math.max(this.zoom.min, Math.min(this.zoom.max, zoom));
            
            // ズーム中心点を考慮した位置調整
            if (centerX !== null && centerY !== null) {
                const config = this.mainApi?.getConfig() || {};
                const canvasWidth = config.canvas?.width || 400;
                const canvasHeight = config.canvas?.height || 400;
                
                const zoomRatio = this.zoom.target / oldZoom;
                const centerWorldX = centerX - canvasWidth / 2;
                const centerWorldY = centerY - canvasHeight / 2;
                
                this.position.targetX += centerWorldX * (1 - zoomRatio);
                this.position.targetY += centerWorldY * (1 - zoomRatio);
            }
            
            this.updateScheduled = true;
            this.log(`Zoom changed to ${this.zoom.target.toFixed(2)}`);
            
        } catch (error) {
            this.reportError('ZOOM_ERROR', 'Failed to set zoom', error);
        }
    }
    
    // 修正版: PIXIコンテナ操作を追加したupdatePosition
    updatePosition() {
        if (!this.updateScheduled) return;
        
        try {
            const { targetX, targetY } = this.position;
            const { current: currentZoom, target: targetZoom } = this.zoom;

            // 補間（必要なら）
            this.position.x = Math.round(targetX);
            this.position.y = Math.round(targetY);
            if (Math.abs(this.zoom.current - targetZoom) > 0.001) {
                this.zoom.current += (targetZoom - this.zoom.current) * 0.1;
                if (Math.abs(this.zoom.current - targetZoom) < 0.001) this.zoom.current = targetZoom;
            }

            // DrawingEngine のコンテナに適用する（mainApi 経由で drawing engine を取得）
            if (this.drawingEngine && this.drawingEngine.getApi) {
                const api = this.drawingEngine.getApi();
                const containers = api.getContainers(); // { camera, world, ui }
                if (containers && containers.camera) {
                    // camera 側の transform を更新（ワールドの中心合わせなどは適宜調整）
                    containers.camera.x = this.position.x;
                    containers.camera.y = this.position.y;
                    containers.camera.scale.set(this.zoom.current);
                }
            } else {
                // フォールバック：従来の DOM transform（暫定）
                const viewportCenter = { x: (window.innerWidth - 310) / 2, y: window.innerHeight / 2 };
                const offset = { x: viewportCenter.x + this.position.x, y: viewportCenter.y + this.position.y };
                this.container.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) translate(-50%, -50%) scale(${this.zoom.current})`;
            }

            this.updateScheduled = false;
            
        } catch (error) {
            this.reportError('UPDATE_POSITION_ERROR', 'Failed to update position', error);
            this.updateScheduled = false;
        }
    }
    
    stopPanning() {
        try {
            this.state.panning = false;
            
            if (this.state.pointerId && this.container.hasPointerCapture(this.state.pointerId)) {
                this.container.releasePointerCapture(this.state.pointerId);
            }
            
            this.container.removeEventListener('pointermove', this.handlers.move);
            this.container.removeEventListener('pointerup', this.handlers.up);
            this.container.removeEventListener('pointercancel', this.handlers.cancel);
            
            this.state.pointerId = null;
            this.state.pointerType = null;
            
            this.log('Pan stopped');
            
        } catch (error) {
            this.reportError('PAN_STOP_ERROR', 'Failed to stop panning', error);
        }
    }
    
    moveByArrows(dx, dy) {
        try {
            this.position.targetX += dx;
            this.position.targetY += dy;
            
            // 移動制限
            const maxOffset = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            this.position.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, this.position.targetX));
            this.position.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, this.position.targetY));
            
            this.updateScheduled = true;
            this.updateStatusDisplay();
            
            this.log(`Moved by arrow keys: dx=${dx}, dy=${dy}`);
            
        } catch (error) {
            this.reportError('ARROW_MOVE_ERROR', 'Failed to move by arrows', error);
        }
    }
    
    reset() {
        try {
            this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
            this.zoom = { current: 1.0, target: 1.0, min: 0.1, max: 5.0 };
            this.state.panning = false;
            this.stopPanning();
            
            // PIXIコンテナもリセット
            if (this.drawingEngine && this.drawingEngine.getApi) {
                const api = this.drawingEngine.getApi();
                const containers = api.getContainers();
                if (containers && containers.camera) {
                    containers.camera.x = 0;
                    containers.camera.y = 0;
                    containers.camera.scale.set(1);
                }
            } else {
                // フォールバック
                this.container.style.transform = 'translate(-50%, -50%) scale(1)';
                this.container.style.left = '50%';
                this.container.style.top = '50%';
            }
            
            this.updateStatusDisplay();
            this.log('Position reset');
            
        } catch (error) {
            this.reportError('RESET_ERROR', 'Failed to reset position', error);
        }
    }
    
    // 修正版座標変換（PIXIのtoLocalを使用推奨だが、まず従来版を維持）
    screenToWorld(x, y) {
        try {
            // PIXIの座標変換を使用する場合
            if (this.drawingEngine && this.drawingEngine.getApi) {
                const api = this.drawingEngine.getApi();
                const containers = api.getContainers();
                if (containers && containers.camera) {
                    const rect = this.container.getBoundingClientRect();
                    const localX = x - rect.left;
                    const localY = y - rect.top;
                    
                    // PIXI の toLocal を使って変換
                    const worldPoint = containers.camera.toLocal({ x: localX, y: localY });
                    return { x: worldPoint.x, y: worldPoint.y };
                }
            }
            
            // フォールバック：従来の座標変換
            const rect = this.container.getBoundingClientRect();
            const zoom = this.zoom.current;
            
            const canvasX = (x - rect.left) / zoom;
            const canvasY = (y - rect.top) / zoom;
            
            return { x: canvasX, y: canvasY };
            
        } catch (error) {
            this.reportError('COORD_TRANSFORM_ERROR', 'Screen to world transform failed', error);
            return { x: x, y: y };
        }
    }
    
    worldToScreen(x, y) {
        try {
            // PIXIの座標変換を使用する場合
            if (this.drawingEngine && this.drawingEngine.getApi) {
                const api = this.drawingEngine.getApi();
                const containers = api.getContainers();
                if (containers && containers.camera) {
                    const screenPoint = containers.camera.toGlobal({ x, y });
                    const rect = this.container.getBoundingClientRect();
                    return { 
                        x: screenPoint.x + rect.left, 
                        y: screenPoint.y + rect.top 
                    };
                }
            }
            
            // フォールバック：従来の座標変換
            const rect = this.container.getBoundingClientRect();
            const zoom = this.zoom.current;
            
            const screenX = rect.left + x * zoom;
            const screenY = rect.top + y * zoom;
            
            return { x: screenX, y: screenY };
            
        } catch (error) {
            this.reportError('COORD_TRANSFORM_ERROR', 'World to screen transform failed', error);
            return { x: x, y: y };
        }
    }
    
    // ビューポート情報取得
    getViewport() {
        const config = this.mainApi?.getConfig() || {};
        const canvasWidth = config.canvas?.width || 400;
        const canvasHeight = config.canvas?.height || 400;
        
        return {
            x: -this.position.x / this.zoom.current,
            y: -this.position.y / this.zoom.current,
            width: canvasWidth / this.zoom.current,
            height: canvasHeight / this.zoom.current,
            zoom: this.zoom.current
        };
    }
    
    // 特定の範囲にフィット
    fitToView(x, y, width, height, padding = 20) {
        try {
            const config = this.mainApi?.getConfig() || {};
            const canvasWidth = config.canvas?.width || 400;
            const canvasHeight = config.canvas?.height || 400;
            
            // 必要なズーム値を計算
            const zoomX = (canvasWidth - padding * 2) / width;
            const zoomY = (canvasHeight - padding * 2) / height;
            const targetZoom = Math.min(zoomX, zoomY, this.zoom.max);
            
            // 中心位置を計算
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            this.zoom.target = Math.max(this.zoom.min, targetZoom);
            this.position.targetX = -centerX * this.zoom.target + canvasWidth / 2;
            this.position.targetY = -centerY * this.zoom.target + canvasHeight / 2;
            
            this.updateScheduled = true;
            this.log(`Fit to view: zoom=${this.zoom.target.toFixed(2)}`);
            
        } catch (error) {
            this.reportError('FIT_VIEW_ERROR', 'Failed to fit to view', error);
        }
    }
    
    updateStatusDisplay() {
        const element = document.getElementById('camera-position');
        if (element) {
            element.textContent = `x: ${Math.round(this.position.targetX)}, y: ${Math.round(this.position.targetY)}`;
        }
        
        // ズーム情報も表示する場合
        const zoomElement = document.getElementById('camera-zoom');
        if (zoomElement) {
            zoomElement.textContent = `${Math.round(this.zoom.current * 100)}%`;
        }
    }
    
    // 位置統計情報
    getPositionStats() {
        return {
            position: { ...this.position },
            zoom: { ...this.zoom },
            panning: this.state.panning,
            pointerType: this.state.pointerType
        };
    }
    
    // ユーティリティメソッド
    log(message, ...args) {
        const config = this.mainApi?.getConfig();
        if (config?.debug) {
            console.log(`[PositionManager] ${message}`, ...args);
        }
    }
    
    reportError(code, message, error) {
        this.mainApi?.notify({
            type: 'error',
            code,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            source: 'PositionManager'
        });
    }
    
    // Public API
    getApi() {
        return {
            setZoom: (zoom, centerX, centerY) => this.setZoom(zoom, centerX, centerY),
            moveByArrows: (dx, dy) => this.moveByArrows(dx, dy),
            reset: () => this.reset(),
            screenToWorld: (x, y) => this.screenToWorld(x, y),
            worldToScreen: (x, y) => this.worldToScreen(x, y),
            getViewport: () => this.getViewport(),
            fitToView: (x, y, width, height, padding) => this.fitToView(x, y, width, height, padding),
            getStats: () => this.getPositionStats(),
            stopPanning: () => this.stopPanning()
        };
    }