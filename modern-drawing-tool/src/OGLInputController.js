// OGLInputController.js - 入力処理統合（Phase1基盤・封印対象）

/**
 * 🔥 OGL統一入力処理（Phase1基盤・封印対象）
 * 責務: マウス・ペンタブレット専用、キャンバス座標変換精密化、入力イベント管理・競合回避
 */
export class OGLInputController {
    constructor(oglEngine, eventStore) {
        this.engine = oglEngine;
        this.eventStore = eventStore;
        this.canvas = oglEngine.canvas;
        
        // 入力状態管理
        this.isPointerDown = false;
        this.isDrawing = false;
        this.currentStrokeId = null;
        this.lastPointerPosition = null;
        this.pointerStartTime = null;
        
        // 座標変換設定
        this.canvasTransform = {
            scale: 1.0,
            rotation: 0,
            translateX: 0,
            translateY: 0
        };
        
        // 筆圧・速度計算
        this.pressureHistory = [];
        this.velocityHistory = [];
        this.maxHistoryLength = 5;
        
        // デバイス判定
        this.inputDevice = 'mouse';
        this.supportsPressure = false;
        
        // イベントリスナー参照保持（削除用）
        this.boundEventHandlers = {};
        
        console.log('✅ OGLInputController初期化完了');
    }
    
    /**
     * 入力リスニング開始
     */
    startListening() {
        // Pointer Events API使用（マウス・ペンタブレット統一）
        this.boundEventHandlers = {
            pointerdown: this.handlePointerDown.bind(this),
            pointermove: this.handlePointerMove.bind(this),
            pointerup: this.handlePointerUp.bind(this),
            pointercancel: this.handlePointerCancel.bind(this),
            pointerleave: this.handlePointerLeave.bind(this),
            wheel: this.handleWheel.bind(this),
            contextmenu: this.handleContextMenu.bind(this)
        };
        
        // イベントリスナー登録
        Object.entries(this.boundEventHandlers).forEach(([eventType, handler]) => {
            this.canvas.addEventListener(eventType, handler, { passive: false });
        });
        
        // キャンバスフォーカス設定
        this.canvas.tabIndex = 0;
        this.canvas.style.outline = 'none';
        
        console.log('🎮 OGL入力リスニング開始');
    }
    
    /**
     * 入力リスニング停止
     */
    stopListening() {
        Object.entries(this.boundEventHandlers).forEach(([eventType, handler]) => {
            this.canvas.removeEventListener(eventType, handler);
        });
        
        this.boundEventHandlers = {};
        console.log('🎮 OGL入力リスニング停止');
    }
    
    /**
     * PointerDown処理
     */
    handlePointerDown(event) {
        event.preventDefault();
        
        // デバイス判定
        this.detectInputDevice(event);
        
        // 座標変換
        const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
        const pressure = this.getPressure(event);
        
        this.isPointerDown = true;
        this.isDrawing = true;
        this.lastPointerPosition = canvasPoint;
        this.pointerStartTime = Date.now();
        
        // 筆圧・速度履歴リセット
        this.pressureHistory = [pressure];
        this.velocityHistory = [0];
        
        // ストローク開始
        this.currentStrokeId = this.engine.startStroke(canvasPoint, pressure);
        
        // イベント発火
        this.eventStore.emit(this.eventStore.eventTypes.INPUT_START, {
            point: canvasPoint,
            pressure,
            device: this.inputDevice,
            strokeId: this.currentStrokeId
        });
        
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_START, {
            strokeId: this.currentStrokeId,
            point: canvasPoint,
            pressure,
            tool: this.engine.currentTool
        });
        
        console.log(`🖱️ PointerDown: ${this.inputDevice}`, canvasPoint);
    }
    
    /**
     * PointerMove処理
     */
    handlePointerMove(event) {
        event.preventDefault();
        
        const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
        const pressure = this.getPressure(event);
        
        // 速度計算
        const velocity = this.calculateVelocity(canvasPoint);
        
        // 筆圧・速度履歴更新
        this.updateHistory(pressure, velocity);
        
        if (this.isDrawing && this.currentStrokeId) {
            // ストローク追加
            this.engine.addStrokePoint(canvasPoint, pressure);
            
            // イベント発火
            this.eventStore.emit(this.eventStore.eventTypes.INPUT_MOVE, {
                point: canvasPoint,
                pressure,
                velocity,
                device: this.inputDevice,
                strokeId: this.currentStrokeId
            });
            
            this.eventStore.emit(this.eventStore.eventTypes.STROKE_UPDATE, {
                strokeId: this.currentStrokeId,
                point: canvasPoint,
                pressure,
                velocity
            });
        }
        
        this.lastPointerPosition = canvasPoint;
    }
    
    /**
     * PointerUp処理
     */
    handlePointerUp(event) {
        event.preventDefault();
        
        if (this.isDrawing && this.currentStrokeId) {
            const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
            const pressure = this.getPressure(event);
            
            // ストローク終了
            const strokeId = this.engine.endStroke();
            
            // イベント発火
            this.eventStore.emit(this.eventStore.eventTypes.INPUT_END, {
                point: canvasPoint,
                pressure,
                device: this.inputDevice,
                strokeId: strokeId,
                duration: Date.now() - this.pointerStartTime
            });
            
            this.eventStore.emit(this.eventStore.eventTypes.STROKE_COMPLETE, {
                strokeId: strokeId,
                point: canvasPoint,
                pressure,
                tool: this.engine.currentTool
            });
            
            console.log(`🖱️ PointerUp: ストローク完了 ${strokeId}`);
        }
        
        this.resetInputState();
    }
    
    /**
     * PointerCancel処理
     */
    handlePointerCancel(event) {
        event.preventDefault();
        
        if (this.isDrawing && this.currentStrokeId) {
            // ストロークキャンセル
            this.engine.removeStroke(this.currentStrokeId);
            
            this.eventStore.emit(this.eventStore.eventTypes.INPUT_CANCEL, {
                strokeId: this.currentStrokeId,
                device: this.inputDevice
            });
            
            console.log(`🖱️ PointerCancel: ストロークキャンセル ${this.currentStrokeId}`);
        }
        
        this.resetInputState();
    }
    
    /**
     * PointerLeave処理
     */
    handlePointerLeave(event) {
        // キャンバス外に出た場合の処理
        if (this.isDrawing) {
            this.handlePointerUp(event);
        }
    }
    
    /**
     * Wheel処理（将来のズーム機能用）
     */
    handleWheel(event) {
        event.preventDefault();
        
        // Phase2でキャンバス変形機能実装時に使用
        console.log('🖱️ Wheel:', event.deltaY);
    }
    
    /**
     * ContextMenu無効化
     */
    handleContextMenu(event) {
        event.preventDefault();
    }
    
    /**
     * 入力デバイス判定
     */
    detectInputDevice(event) {
        switch (event.pointerType) {
            case 'pen':
                this.inputDevice = 'pen';
                this.supportsPressure = true;
                break;
            case 'mouse':
                this.inputDevice = 'mouse';
                this.supportsPressure = false;
                break;
            case 'touch':
                // タッチデバイス非対応（規約準拠）
                console.warn('🚨 タッチデバイス非対応');
                return;
            default:
                this.inputDevice = 'mouse';
                this.supportsPressure = false;
        }
        
        console.log(`🎮 入力デバイス: ${this.inputDevice}`, { 
            supportsPressure: this.supportsPressure 
        });
    }
    
    /**
     * スクリーン座標→キャンバス座標変換
     */
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        let canvasX = (screenX - rect.left) * scaleX;
        let canvasY = (screenY - rect.top) * scaleY;
        
        // キャンバス変形適用（Phase2でキャンバス操作実装時に使用）
        // const transform = this.canvasTransform;
        // 現在は恒等変換
        
        return {
            x: canvasX,
            y: canvasY
        };
    }
    
    /**
     * 筆圧取得
     */
    getPressure(event) {
        if (this.supportsPressure && typeof event.pressure === 'number') {
            // ペンタブレット筆圧（0.0-1.0）
            return Math.max(0.1, Math.min(1.0, event.pressure));
        } else {
            // マウスの場合は固定値
            return 1.0;
        }
    }
    
    /**
     * 速度計算
     */
    calculateVelocity(currentPoint) {
        if (!this.lastPointerPosition) return 0;
        
        const dx = currentPoint.x - this.lastPointerPosition.x;
        const dy = currentPoint.y - this.lastPointerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const timeNow = Date.now();
        const timeDelta = timeNow - (this.lastMoveTime || timeNow);
        
        this.lastMoveTime = timeNow;
        
        return timeDelta > 0 ? distance / timeDelta : 0;
    }
    
    /**
     * 筆圧・速度履歴更新
     */
    updateHistory(pressure, velocity) {
        this.pressureHistory.push(pressure);
        this.velocityHistory.push(velocity);
        
        if (this.pressureHistory.length > this.maxHistoryLength) {
            this.pressureHistory.shift();
        }
        if (this.velocityHistory.length > this.maxHistoryLength) {
            this.velocityHistory.shift();
        }
    }
    
    /**
     * 平均筆圧取得
     */
    getAveragePressure() {
        if (this.pressureHistory.length === 0) return 1.0;
        
        const sum = this.pressureHistory.reduce((a, b) => a + b, 0);
        return sum / this.pressureHistory.length;
    }
    
    /**
     * 平均速度取得
     */
    getAverageVelocity() {
        if (this.velocityHistory.length === 0) return 0;
        
        const sum = this.velocityHistory.reduce((a, b) => a + b, 0);
        return sum / this.velocityHistory.length;
    }
    
    /**
     * 入力状態リセット
     */
    resetInputState() {
        this.isPointerDown = false;
        this.isDrawing = false;
        this.currentStrokeId = null;
        this.lastPointerPosition = null;
        this.pointerStartTime = null;
        this.lastMoveTime = null;
    }
    
    /**
     * キャンバス変形設定（Phase2で使用）
     */
    setCanvasTransform(transform) {
        this.canvasTransform = { ...this.canvasTransform, ...transform };
        console.log('📐 キャンバス変形設定:', this.canvasTransform);
    }
    
    /**
     * 入力状態取得
     */
    getInputState() {
        return {
            isPointerDown: this.isPointerDown,
            isDrawing: this.isDrawing,
            currentStrokeId: this.currentStrokeId,
            inputDevice: this.inputDevice,
            supportsPressure: this.supportsPressure,
            averagePressure: this.getAveragePressure(),
            averageVelocity: this.getAverageVelocity()
        };
    }
}