// Phase 1.5B: OGL統一インタラクション向上統合ファイル
export class OGLInteractionEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.setupInteractionFeatures();
    }
    
    // インタラクション機能初期化
    setupInteractionFeatures() {
        this.setupMultiTouchSupport();
        this.setupGestureRecognition();
        this.setupInputOptimization();
        this.setupRealtimePreview();
    }
    
    // マルチタッチ対応設定
    setupMultiTouchSupport() {
        this.touchPoints = new Map();
        this.isMultiTouch = false;
        this.lastPinchDistance = 0;
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        
        this.setupMultiTouchListeners();
    }
    
    // マルチタッチイベントリスナー設定
    setupMultiTouchListeners() {
        if (!this.engine.canvas) return;
        
        this.engine.canvas.addEventListener('touchstart', this.handleMultiTouchStart.bind(this));
        this.engine.canvas.addEventListener('touchmove', this.handleMultiTouchMove.bind(this));
        this.engine.canvas.addEventListener('touchend', this.handleMultiTouchEnd.bind(this));
    }
    
    // マルチタッチ開始処理
    handleMultiTouchStart(event) {
        if (event.touches.length > 1) {
            this.isMultiTouch = true;
            
            // ピンチジェスチャー初期化
            if (event.touches.length === 2) {
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];
                this.lastPinchDistance = this.calculateDistance(touch1, touch2);
            }
            
            event.preventDefault();
        }
    }
    
    // マルチタッチ移動処理
    handleMultiTouchMove(event) {
        if (!this.isMultiTouch || event.touches.length < 2) return;
        
        if (event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = this.calculateDistance(touch1, touch2);
            
            // ピンチズーム処理
            if (this.lastPinchDistance > 0) {
                const zoomDelta = currentDistance / this.lastPinchDistance;
                this.handlePinchZoom(zoomDelta);
            }
            
            this.lastPinchDistance = currentDistance;
        }
        
        event.preventDefault();
    }
    
    // マルチタッチ終了処理
    handleMultiTouchEnd(event) {
        if (event.touches.length < 2) {
            this.isMultiTouch = false;
            this.lastPinchDistance = 0;
        }
    }
    
    // 距離計算
    calculateDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // ピンチズーム処理
    handlePinchZoom(zoomDelta) {
        const newZoom = this.zoomLevel * zoomDelta;
        this.zoomLevel = Math.max(0.1, Math.min(5.0, newZoom));
        
        // カメラのズーム調整
        if (this.engine.camera) {
            const scale = 1 / this.zoomLevel;
            this.engine.camera.orthographic({
                left: -this.engine.canvas.width / 2 * scale,
                right: this.engine.canvas.width / 2 * scale,
                bottom: -this.engine.canvas.height / 2 * scale,
                top: this.engine.canvas.height / 2 * scale,
                near: 0.1,
                far: 100
            });
        }
    }
    
    // ジェスチャー認識設定
    setupGestureRecognition() {
        this.gestureBuffer = [];
        this.gestureThreshold = 50; // ジェスチャー認識の最小距離
        this.setupGestureListeners();
    }
    
    // ジェスチャーリスナー設定
    setupGestureListeners() {
        if (!this.engine.canvas) return;
        
        // 右クリック（またはロングタップ）でコンテキストメニュー
        this.engine.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // ダブルタップでズームリセット
        let lastTapTime = 0;
        this.engine.canvas.addEventListener('pointerdown', (event) => {
            const currentTime = Date.now();
            if (currentTime - lastTapTime < 300) {
                this.handleDoubleTap(event);
            }
            lastTapTime = currentTime;
        });
    }
    
    // コンテキストメニュー処理
    handleContextMenu(event) {
        event.preventDefault();
        
        // 簡易コンテキストアクション
        if (this.engine.strokes.length > 0) {
            this.engine.undo();
        }
    }
    
    // ダブルタップ処理
    handleDoubleTap(event) {
        // ズームリセット
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        
        if (this.engine.camera) {
            this.engine.camera.orthographic({
                left: -this.engine.canvas.width / 2,
                right: this.engine.canvas.width / 2,
                bottom: -this.engine.canvas.height / 2,
                top: this.engine.canvas.height / 2,
                near: 0.1,
                far: 100
            });
        }
        
        event.preventDefault();
    }
    
    // 入力最適化設定
    setupInputOptimization() {
        this.inputBuffer = [];
        this.bufferSize = 3;
        this.lastInputTime = 0;
        this.inputThrottleMs = 16; // 60fps相当
    }
    
    // 入力最適化処理
    optimizeInput(event) {
        const currentTime = performance.now();
        
        // 入力スロットリング
        if (currentTime - this.lastInputTime < this.inputThrottleMs) {
            return null;
        }
        
        this.lastInputTime = currentTime;
        
        // 入力バッファリング
        this.inputBuffer.push({
            x: event.clientX,
            y: event.clientY,
            pressure: event.pressure || 0.5,
            timestamp: currentTime
        });
        
        if (this.inputBuffer.length > this.bufferSize) {
            this.inputBuffer.shift();
        }
        
        return this.inputBuffer[this.inputBuffer.length - 1];
    }
    
    // リアルタイムプレビュー設定
    setupRealtimePreview() {
        this.previewEnabled = true;
        this.previewOpacity = 0.7;
    }
    
    // プレビュー描画
    drawPreview(currentStroke) {
        if (!this.previewEnabled || !currentStroke) return;
        
        // 現在のストロークをプレビュー表示
        // 実装は基本的なものに留める
        if (currentStroke.mesh) {
            const originalOpacity = currentStroke.mesh.program.uniforms.uOpacity.value;
            currentStroke.mesh.program.uniforms.uOpacity.value = this.previewOpacity;
            
            // レンダリング後に不透明度を戻す
            setTimeout(() => {
                if (currentStroke.mesh) {
                    currentStroke.mesh.program.uniforms.uOpacity.value = originalOpacity;
                }
            }, 0);
        }
    }
    
    // インタラクション設定更新
    updateInteractionSettings(settings) {
        if (settings.multiTouchEnabled !== undefined) {
            this.isMultiTouchEnabled = settings.multiTouchEnabled;
        }
        
        if (settings.gestureEnabled !== undefined) {
            this.gestureEnabled = settings.gestureEnabled;
        }
        
        if (settings.previewEnabled !== undefined) {
            this.previewEnabled = settings.previewEnabled;
        }
    }
    
    // ズーム・パン状態取得
    getViewState() {
        return {
            zoom: this.zoomLevel,
            pan: { ...this.panOffset },
            isMultiTouch: this.isMultiTouch
        };
    }
    
    // ズーム・パン状態リセット
    resetViewState() {
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        this.isMultiTouch = false;
        
        if (this.engine.camera) {
            this.engine.camera.orthographic({
                left: -this.engine.canvas.width / 2,
                right: this.engine.canvas.width / 2,
                bottom: -this.engine.canvas.height / 2,
                top: this.engine.canvas.height / 2,
                near: 0.1,
                far: 100
            });
        }
    }
}