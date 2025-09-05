/**
 * position-manager.js - PositionService 衛星
 * パン・ズーム管理、座標変換
 */

window.MyApp = window.MyApp || {};

window.MyApp.PositionService = class PositionService {
    constructor() {
        this.mainController = null;
        this.container = null;
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
        this.ticker = null;
        this.debug = false;
    }

    // 主星との接続
    async register(mainController) {
        this.mainController = mainController;
        this.debug = window.MyApp.config?.debug || false;
        
        try {
            await this.initialize();
            if (this.debug) console.log('[PositionService] Registered with MainController');
            return true;
        } catch (error) {
            this.reportError('POSITION_SERVICE_INIT_ERROR', 'Failed to initialize PositionService', {
                error: error.message
            });
            throw error;
        }
    }

    // ポジションサービス初期化
    async initialize() {
        this.container = document.getElementById('canvas-container');
        if (!this.container) {
            throw new Error('Canvas container not found');
        }

        // DrawingEngine のティッカーを取得
        const drawingEngine = this.mainController.getSatellite('DrawingEngine');
        if (drawingEngine && drawingEngine.app) {
            this.ticker = drawingEngine.app.ticker;
            this.ticker.add(() => this.updatePosition());
        }

        this.setupPointerEvents();
    }

    // ポインターイベント設定
    setupPointerEvents() {
        this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        
        this.handlers.move = (e) => this.onPointerMove(e);
        this.handlers.up = (e) => this.onPointerUp(e);
        this.handlers.cancel = (e) => this.onPointerCancel(e);
    }

    // ポインターダウンイベント
    onPointerDown(e) {
        if (!this.mainController.spacePressed) return;
        
        // ペン圧力チェック
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
        
        if (this.debug) console.log('[PositionService] Panning started');
    }

    // ポインタームーブイベント
    onPointerMove(e) {
        if (!this.state.panning || e.pointerId !== this.state.pointerId) return;
        if (!this.mainController.spacePressed) return;
        
        // ペン圧力チェック
        if (e.pointerType === 'pen' && e.pressure === 0) {
            return;
        }
        
        const dx = e.clientX - this.state.startX;
        const dy = e.clientY - this.state.startY;
        
        this.position.targetX += dx;
        this.position.targetY += dy;
        
        // 移動範囲制限
        const maxOffset = {
            x: (window.innerWidth - 310) / 2,
            y: window.innerHeight / 2
        };
        
        this.position.targetX = Math.max(
            -maxOffset.x * 2, 
            Math.min(maxOffset.x * 2, this.position.targetX)
        );
        this.position.targetY = Math.max(
            -maxOffset.y * 2, 
            Math.min(maxOffset.y * 2, this.position.targetY)
        );
        
        this.state.startX = e.clientX;
        this.state.startY = e.clientY;
        this.updateScheduled = true;
        this.updateStatusDisplay();
        
        e.preventDefault();
    }

    // ポインターアップイベント
    onPointerUp(e) {
        if (e.pointerId !== this.state.pointerId) return;
        this.stopPanning();
    }

    // ポインターキャンセルイベント
    onPointerCancel(e) {
        if (e.pointerId !== this.state.pointerId) return;
        this.stopPanning();
    }

    // パン終了
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
        
        if (this.debug) console.log('[PositionService] Panning stopped');
    }

    // 位置更新
    updatePosition() {
        if (!this.updateScheduled) return;
        
        const { x, y } = this.position;
        const { targetX, targetY } = this.position;
        
        if (x !== targetX || y !== targetY) {
            this.position.x = Math.round(targetX);
            this.position.y = Math.round(targetY);
            
            const viewportCenter = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            const offset = {
                x: viewportCenter.x + this.position.x,
                y: viewportCenter.y + this.position.y
            };
            
            this.container.style.transform = 
                `translate3d(${offset.x}px, ${offset.y}px, 0) translate(-50%, -50%)`;
            this.container.style.left = '0px';
            this.container.style.top = '0px';
        }
        
        this.updateScheduled = false;
    }

    // 矢印キーによる移動
    moveByArrows(dx, dy) {
        this.position.targetX += dx;
        this.position.targetY += dy;
        
        // 移動範囲制限
        const maxOffset = {
            x: (window.innerWidth - 310) / 2,
            y: window.innerHeight / 2
        };
        
        this.position.targetX = Math.max(
            -maxOffset.x * 2, 
            Math.min(maxOffset.x * 2, this.position.targetX)
        );
        this.position.targetY = Math.max(
            -maxOffset.y * 2, 
            Math.min(maxOffset.y * 2, this.position.targetY)
        );
        
        this.updateScheduled = true;
        this.updateStatusDisplay();
        
        if (this.debug) console.log(`[PositionService] Moved by arrows: ${dx}, ${dy}`);
    }

    // パン設定
    setPan(x, y) {
        this.position.targetX = x;
        this.position.targetY = y;
        this.updateScheduled = true;
        this.updateStatusDisplay();
        
        if (this.debug) console.log(`[PositionService] Pan set to: ${x}, ${y}`);
    }

    // ズーム設定（将来拡張用）
    setZoom(scale) {
        // 現在はズーム未実装だが、将来の拡張のためのAPI
        if (this.debug) console.log(`[PositionService] Zoom set to: ${scale} (not implemented)`);
    }

    // 位置リセット
    reset() {
        this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.state.panning = false;
        this.stopPanning();
        
        this.container.style.transform = 'translate(-50%, -50%)';
        this.container.style.left = '50%';
        this.container.style.top = '50%';
        
        this.updateStatusDisplay();
        
        if (this.debug) console.log('[PositionService] Position reset');
    }

    // キャンバス座標からワールド座標への変換
    canvasToWorld(point) {
        // 現在は1:1変換（ズーム未実装のため）
        return { 
            x: point.x - this.position.x, 
            y: point.y - this.position.y 
        };
    }

    // ワールド座標からキャンバス座標への変換
    worldToCanvas(point) {
        // 現在は1:1変換（ズーム未実装のため）
        return { 
            x: point.x + this.position.x, 
            y: point.y + this.position.y 
        };
    }

    // スクリーン座標からワールド座標への変換
    screenToWorld(x, y) {
        return { x: x, y: y };
    }

    // ワールド座標からスクリーン座標への変換
    worldToScreen(x, y) {
        return { x: x, y: y };
    }

    // ステータス表示更新
    updateStatusDisplay() {
        // MainController を通じて UI 更新を通知
        this.mainController.notify({
            type: 'ui_update',
            payload: {
                type: 'camera_position',
                data: {
                    x: Math.round(this.position.targetX),
                    y: Math.round(this.position.targetY)
                }
            }
        });
    }

    // 現在の位置取得
    getPosition() {
        return {
            x: this.position.x,
            y: this.position.y,
            targetX: this.position.targetX,
            targetY: this.position.targetY
        };
    }

    // パン状態取得
    getPanState() {
        return {
            panning: this.state.panning,
            pointerType: this.state.pointerType
        };
    }

    // ビューポート情報取得
    getViewport() {
        return {
            width: window.innerWidth - 310, // サイドバーを除く
            height: window.innerHeight,
            centerX: (window.innerWidth - 310) / 2,
            centerY: window.innerHeight / 2,
            canvasX: this.position.x,
            canvasY: this.position.y
        };
    }

    // 統計情報取得
    getStats() {
        return {
            position: this.getPosition(),
            panState: this.getPanState(),
            viewport: this.getViewport(),
            updateScheduled: this.updateScheduled
        };
    }

    // エラー報告ヘルパー
    reportError(code, message, context) {
        if (this.mainController) {
            this.mainController.notify({
                type: 'error',
                payload: { code, message, context }
            });
        } else {
            console.error(`[PositionService] ${code}: ${message}`, context);
        }
    }

    // 破棄処理
    destroy() {
        try {
            this.stopPanning();
            
            if (this.ticker) {
                this.ticker.remove(() => this.updatePosition());
                this.ticker = null;
            }
            
            this.container = null;
            this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
            this.state = { 
                panning: false, 
                startX: 0, 
                startY: 0,
                pointerId: null,
                pointerType: null
            };
            
            if (this.debug) console.log('[PositionService] Destroyed');
            
        } catch (error) {
            this.reportError('POSITION_DESTROY_ERROR', 'Failed to destroy position service', {
                error: error.message
            });
        }
    }
};