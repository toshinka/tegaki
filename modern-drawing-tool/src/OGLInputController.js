import PointerTracker from 'pointer-tracker';

/**
 * OGLInputController - マウス・ペンタブレット専用入力処理（Phase1基盤）
 * タッチデバイス非対応・デスクトップ環境特化
 */
export class OGLInputController {
    constructor(oglCore, eventStore) {
        this.oglCore = oglCore;
        this.eventStore = eventStore;
        this.canvas = oglCore.canvas;
        
        // 入力状態
        this.isPointerDown = false;
        this.currentPointer = null;
        this.pointerHistory = [];
        this.maxHistorySize = 10;
        
        // キャンバス座標変換
        this.canvasTransform = {
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0
        };
        
        // PointerTracker設定（マウス・ペンタブレット専用）
        this.pointerTracker = null;
        
        // 入力フィルタリング
        this.inputFilter = {
            minDistance: 1.0,
            pressureSmoothing: 0.3,
            velocitySmoothing: 0.5
        };
        
        // 筆圧検出
        this.pressureSupported = false;
        this.lastPressure = 1.0;
        
        this.initializePointerTracking();
        this.setupEventListeners();
    }
    
    // PointerTracker初期化（マウス・ペンタブレット専用）
    initializePointerTracking() {
        this.pointerTracker = new PointerTracker(this.canvas, {
            // タッチデバイス完全無効化
            start: (pointer, event) => {
                // タッチイベント排除
                if (event.pointerType === 'touch') {
                    console.warn('🚫 Touch input not supported - mouse/pen only');
                    return false;
                }
                
                return this.handlePointerStart(pointer, event);
            },
            move: (previousPointers, changedPointers, event) => {
                // タッチイベント排除
                if (event.pointerType === 'touch') {
                    return;
                }
                
                this.handlePointerMove(previousPointers, changedPointers, event);
            },
            end: (pointer, event) => {
                // タッチイベント排除
                if (event.pointerType === 'touch') {
                    return;
                }
                
                this.handlePointerEnd(pointer, event);
            }
        });
        
        console.log('✅ Pointer tracking initialized (mouse/pen only)');
    }
    
    // ポインター開始
    handlePointerStart(pointer, event) {
        if (this.isPointerDown) return false;
        
        this.isPointerDown = true;
        this.currentPointer = pointer;
        
        // 筆圧検出・サポート確認
        this.detectPressureSupport(event);
        const pressure = this.extractPressure(event);
        
        // キャンバス座標変換
        const canvasPoint = this.screenToCanvas(pointer.clientX, pointer.clientY);
        
        // 入力履歴記録
        this.addToHistory({
            point: canvasPoint,
            pressure,
            timestamp: Date.now(),
            type: 'start'
        });
        
        // OGL描画エンジンにストローク開始通知
        this.oglCore.startStroke(canvasPoint, pressure);
        
        event.preventDefault();
        return true;
    }
    
    // ポインター移動
    handlePointerMove(previousPointers, changedPointers, event) {
        if (!this.isPointerDown || !this.currentPointer) return;
        
        const pointer = changedPointers[0];
        if (!pointer) return;
        
        const pressure = this.extractPressure(event);
        const canvasPoint = this.screenToCanvas(pointer.clientX, pointer.clientY);
        
        // 入力フィルタリング適用
        if (this.shouldFilterInput(canvasPoint)) {
            return;
        }
        
        // 速度計算
        const velocity = this.calculateVelocity(canvasPoint);
        
        // 入力履歴記録
        this.addToHistory({
            point: canvasPoint,
            pressure,
            velocity,
            timestamp: Date.now(),
            type: 'move'
        });
        
        // OGL描画エンジンにストローク更新通知
        this.oglCore.updateStroke(canvasPoint, pressure);
        
        event.preventDefault();
    }
    
    // ポインター終了
    handlePointerEnd(pointer, event) {
        if (!this.isPointerDown) return;
        
        this.isPointerDown = false;
        
        const pressure = this.extractPressure(event);
        const canvasPoint = this.screenToCanvas(pointer.clientX, pointer.clientY);
        
        // 入力履歴記録
        this.addToHistory({
            point: canvasPoint,
            pressure,
            timestamp: Date.now(),
            type: 'end'
        });
        
        // OGL描画エンジンにストローク終了通知
        this.oglCore.endStroke();
        
        this.currentPointer = null;
        event.preventDefault();
    }
    
    // 筆圧検出・サポート確認
    detectPressureSupport(event) {
        if (event.pressure !== undefined && event.pressure > 0) {
            if (!this.pressureSupported) {
                this.pressureSupported = true;
                console.log('✅ Pressure sensitivity detected');
                this.eventStore.emit(this.eventStore.eventTypes.ENGINE_READY, {
                    pressureSupported: true
                });
            }
        }
    }
    
    // 筆圧抽出・スムージング
    extractPressure(event) {
        let pressure = 1.0;
        
        if (this.pressureSupported && event.pressure !== undefined) {
            pressure = Math.max(0.1, Math.min(1.0, event.pressure));
            
            // 筆圧スムージング適用
            const smoothing = this.inputFilter.pressureSmoothing;
            pressure = this.lastPressure + (pressure - this.lastPressure) * (1 - smoothing);
        }
        
        this.lastPressure = pressure;
        return pressure;
    }
    
    // スクリーン座標からキャンバス座標変換
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left) - this.canvas.width / 2;
        const y = -((screenY - rect.top) - this.canvas.height / 2); // Y軸反転
        
        // キャンバス変換適用
        const cos = Math.cos(-this.canvasTransform.rotation);
        const sin = Math.sin(-this.canvasTransform.rotation);
        
        const scaledX = (x - this.canvasTransform.offsetX) / this.canvasTransform.scale;
        const scaledY = (y - this.canvasTransform.offsetY) / this.canvasTransform.scale;
        
        return {
            x: scaledX * cos - scaledY * sin,
            y: scaledX * sin + scaledY * cos
        };
    }
    
    // キャンバス座標からスクリーン座標変換
    canvasToScreen(canvasX, canvasY) {
        const cos = Math.cos(this.canvasTransform.rotation);
        const sin = Math.sin(this.canvasTransform.rotation);
        
        const rotatedX = canvasX * cos - canvasY * sin;
        const rotatedY = canvasX * sin + canvasY * cos;
        
        const scaledX = rotatedX * this.canvasTransform.scale + this.canvasTransform.offsetX;
        const scaledY = rotatedY * this.canvasTransform.scale + this.canvasTransform.offsetY;
        
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: scaledX + this.canvas.width / 2 + rect.left,
            y: -scaledY + this.canvas.height / 2 + rect.top
        };
    }
    
    // 入力フィルタリング判定
    shouldFilterInput(point) {
        if (this.pointerHistory.length === 0) return false;
        
        const lastPoint = this.pointerHistory[this.pointerHistory.length - 1].point;
        const distance = Math.sqrt(
            Math.pow(point.x - lastPoint.x, 2) +
            Math.pow(point.y - lastPoint.y, 2)
        );
        
        return distance < this.inputFilter.minDistance;
    }
    
    // 速度計算
    calculateVelocity(currentPoint) {
        if (this.pointerHistory.length < 2) return { x: 0, y: 0, magnitude: 0 };
        
        const prevEntry = this.pointerHistory[this.pointerHistory.length - 1];
        const timeDelta = Date.now() - prevEntry.timestamp;
        
        if (timeDelta === 0) return { x: 0, y: 0, magnitude: 0 };
        
        const deltaX = currentPoint.x - prevEntry.point.x;
        const deltaY = currentPoint.y - prevEntry.point.y;
        
        const velocity = {
            x: deltaX / timeDelta,
            y: deltaY / timeDelta,
            magnitude: Math.sqrt(deltaX * deltaX + deltaY * deltaY) / timeDelta
        };
        
        // 速度スムージング
        if (prevEntry.velocity) {
            const smoothing = this.inputFilter.velocitySmoothing;
            velocity.x = prevEntry.velocity.x + (velocity.x - prevEntry.velocity.x) * (1 - smoothing);
            velocity.y = prevEntry.velocity.y + (velocity.y - prevEntry.velocity.y) * (1 - smoothing);
            velocity.magnitude = prevEntry.velocity.magnitude + (velocity.magnitude - prevEntry.velocity.magnitude) * (1 - smoothing);
        }
        
        return velocity;
    }
    
    // キャンバス変換設定
    setCanvasTransform(transform) {
        this.canvasTransform = { ...this.canvasTransform, ...transform };
        
        this.eventStore.emit(this.eventStore.eventTypes.CANVAS_TRANSFORM, {
            transform: this.canvasTransform
        });
    }
    
    // キャンバス移動
    moveCanvas(deltaX, deltaY) {
        this.canvasTransform.offsetX += deltaX;
        this.canvasTransform.offsetY += deltaY;
        
        this.eventStore.emit(this.eventStore.eventTypes.CANVAS_TRANSFORM, {
            transform: this.canvasTransform,
            type: 'move'
        });
    }
    
    // キャンバス拡縮
    scaleCanvas(scaleFactor, centerX = 0, centerY = 0) {
        const newScale = Math.max(0.1, Math.min(10.0, this.canvasTransform.scale * scaleFactor));
        const scaleChange = newScale / this.canvasTransform.scale;
        
        // 中心点を基準とした拡縮
        this.canvasTransform.offsetX = centerX + (this.canvasTransform.offsetX - centerX) * scaleChange;
        this.canvasTransform.offsetY = centerY + (this.canvasTransform.offsetY - centerY) * scaleChange;
        this.canvasTransform.scale = newScale;
        
        this.eventStore.emit(this.eventStore.eventTypes.CANVAS_TRANSFORM, {
            transform: this.canvasTransform,
            type: 'scale'
        });
    }
    
    // キャンバス回転
    rotateCanvas(deltaRotation) {
        this.canvasTransform.rotation += deltaRotation;
        
        // 0-2π範囲正規化
        while (this.canvasTransform.rotation < 0) {
            this.canvasTransform.rotation += Math.PI * 2;
        }
        while (this.canvasTransform.rotation >= Math.PI * 2) {
            this.canvasTransform.rotation -= Math.PI * 2;
        }
        
        this.eventStore.emit(this.eventStore.eventTypes.CANVAS_TRANSFORM, {
            transform: this.canvasTransform,
            type: 'rotate'
        });
    }
    
    // キャンバスリセット
    resetCanvas() {
        this.canvasTransform = {
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0
        };
        
        this.eventStore.emit(this.eventStore.eventTypes.CANVAS_RESET, {
            transform: this.canvasTransform
        });
    }
    
    // 入力履歴記録
    addToHistory(entry) {
        this.pointerHistory.push(entry);
        if (this.pointerHistory.length > this.maxHistorySize) {
            this.pointerHistory.shift();
        }
    }
    
    // 入力履歴取得
    getInputHistory(count = 5) {
        return this.pointerHistory.slice(-count);
    }
    
    // 追加イベントリスナー設定
    setupEventListeners() {
        // コンテキストメニュー無効化
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // ドラッグ無効化
        this.canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
        
        // 選択無効化
        this.canvas.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
        
        // ホイールイベント（拡縮）
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const canvasPoint = this.screenToCanvas(e.clientX, e.clientY);
            this.scaleCanvas(scaleFactor, canvasPoint.x, canvasPoint.y);
        }, { passive: false });
    }
    
    // 入力フィルター設定更新
    updateInputFilter(filterConfig) {
        this.inputFilter = { ...this.inputFilter, ...filterConfig };
        console.log('✅ Input filter updated:', this.inputFilter);
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            isPointerDown: this.isPointerDown,
            pressureSupported: this.pressureSupported,
            canvasTransform: this.canvasTransform,
            historySize: this.pointerHistory.length,
            inputFilter: this.inputFilter,
            currentPointer: this.currentPointer ? {
                x: this.currentPointer.clientX,
                y: this.currentPointer.clientY
            } : null
        };
    }
    
    // クリーンアップ
    destroy() {
        if (this.pointerTracker) {
            this.pointerTracker.stop();
        }
        
        this.pointerHistory = [];
        this.currentPointer = null;
        this.isPointerDown = false;
        
        console.log('✅ Input controller destroyed');
    }
}