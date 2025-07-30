// Phase 1.5B: OGL統一インタラクション向上統合ファイル (mitt統合・効率化版)
export class OGLInteractionEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.eventBus = oglEngine.eventBus; // mitt統合イベントバス活用
        this.setupInteractionFeatures();
        this.setupEventBusIntegration();
    }
    
    // インタラクション機能初期化
    setupInteractionFeatures() {
        this.setupMultiTouchSupport();
        this.setupGestureRecognition();
        this.setupInputOptimization();
        this.setupRealtimePreview();
    }
    
    // mittイベントバス統合設定（新規・効率化）
    setupEventBusIntegration() {
        // 描画状態変更の監視・応答
        this.eventBus.on('drawing.start', this.onDrawingStart.bind(this));
        this.eventBus.on('drawing.update', this.onDrawingUpdate.bind(this));
        this.eventBus.on('drawing.complete', this.onDrawingComplete.bind(this));
        
        // 設定変更の監視
        this.eventBus.on('settings.changed', this.onSettingsChanged.bind(this));
        
        // インタラクション状態の通知設定
        this.setupInteractionEventEmission();
    }
    
    // インタラクション状態通知設定（新規・mitt活用）
    setupInteractionEventEmission() {
        // マルチタッチ状態変更通知
        this.notifyMultiTouchState = (state) => {
            this.eventBus.emit('interaction.multitouch', {
                isActive: state,
                touchCount: this.touchPoints.size,
                zoomLevel: this.zoomLevel
            });
        };
        
        // ジェスチャー認識通知
        this.notifyGesture = (gestureType, data) => {
            this.eventBus.emit('interaction.gesture', {
                type: gestureType,
                data: data,
                timestamp: performance.now()
            });
        };
        
        // 入力最適化状態通知
        this.notifyInputOptimization = (stats) => {
            this.eventBus.emit('interaction.input.stats', stats);
        };
    }
    
    // 描画開始時の処理（mitt連携・効率化）
    onDrawingStart(data) {
        // マルチタッチ中は描画無効化
        if (this.isMultiTouch) {
            this.eventBus.emit('interaction.drawing.blocked', {
                reason: 'multitouch_active',
                touchCount: this.touchPoints.size
            });
            return;
        }
        
        // プレビュー開始
        if (this.previewEnabled) {
            this.startPreview(data.stroke);
        }
    }
    
    // 描画更新時の処理（mitt連携）
    onDrawingUpdate(data) {
        if (this.previewEnabled && !this.isMultiTouch) {
            this.updatePreview(data.stroke, data.newPoint);
        }
        
        // 入力統計更新
        this.updateInputStats(data.newPoint);
    }
    
    // 描画完了時の処理（mitt連携）
    onDrawingComplete(data) {
        if (this.previewEnabled) {
            this.endPreview();
        }
        
        // 入力統計の最終通知
        this.notifyInputOptimization(this.getInputStats());
    }
    
    // 設定変更時の処理（mitt連携・効率化）
    onSettingsChanged(data) {
        if (data.type === 'interaction') {
            this.updateInteractionSettings(data.settings);
            
            // 設定変更をログ出力（デバッグ用）
            console.log('Interaction settings updated:', data.settings);
        }
    }
    
    // マルチタッチ対応設定（mitt通知統合・効率化）
    setupMultiTouchSupport() {
        this.touchPoints = new Map();
        this.isMultiTouch = false;
        this.lastPinchDistance = 0;
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        
        this.setupMultiTouchListeners();
    }
    
    // マルチタッチイベントリスナー設定（mitt通知統合）
    setupMultiTouchListeners() {
        if (!this.engine.canvas) return;
        
        const canvas = this.engine.canvas;
        
        // タッチイベントの統合処理（効率化）
        const touchEvents = [
            ['touchstart', this.handleMultiTouchStart.bind(this)],
            ['touchmove', this.handleMultiTouchMove.bind(this)],
            ['touchend', this.handleMultiTouchEnd.bind(this)],
            ['touchcancel', this.handleMultiTouchEnd.bind(this)]
        ];
        
        // バッチでイベントリスナー登録（効率化）
        touchEvents.forEach(([event, handler]) => {
            canvas.addEventListener(event, handler, { passive: false });
        });
    }
    
    // マルチタッチ開始処理（mitt通知統合・効率化）
    handleMultiTouchStart(event) {
        const touchCount = event.touches.length;
        
        if (touchCount > 1) {
            const wasMultiTouch = this.isMultiTouch;
            this.isMultiTouch = true;
            
            // 状態変更通知（mitt）
            if (!wasMultiTouch) {
                this.notifyMultiTouchState(true);
            }
            
            // ピンチジェスチャー初期化
            if (touchCount === 2) {
                const [touch1, touch2] = event.touches;
                this.lastPinchDistance = this.calculateDistance(touch1, touch2);
                
                // ピンチ開始通知
                this.notifyGesture('pinch_start', {
                    initialDistance: this.lastPinchDistance,
                    centerPoint: this.calculateCenter(touch1, touch2)
                });
            }
            
            event.preventDefault();
        }
    }
    
    // マルチタッチ移動処理（mitt通知統合・効率化）
    handleMultiTouchMove(event) {
        if (!this.isMultiTouch || event.touches.length < 2) return;
        
        if (event.touches.length === 2) {
            const [touch1, touch2] = event.touches;
            const currentDistance = this.calculateDistance(touch1, touch2);
            
            // ピンチズーム処理
            if (this.lastPinchDistance > 0) {
                const zoomDelta = currentDistance / this.lastPinchDistance;
                const oldZoom = this.zoomLevel;
                
                this.handlePinchZoom(zoomDelta);
                
                // ズーム変更通知（mitt）
                if (Math.abs(this.zoomLevel - oldZoom) > 0.01) {
                    this.notifyGesture('pinch_zoom', {
                        zoomLevel: this.zoomLevel,
                        zoomDelta: zoomDelta,
                        centerPoint: this.calculateCenter(touch1, touch2)
                    });
                }
            }
            
            this.lastPinchDistance = currentDistance;
        }
        
        event.preventDefault();
    }
    
    // マルチタッチ終了処理（mitt通知統合・効率化）
    handleMultiTouchEnd(event) {
        const touchCount = event.touches.length;
        
        if (touchCount < 2) {
            const wasMultiTouch = this.isMultiTouch;
            this.isMultiTouch = false;
            this.lastPinchDistance = 0;
            
            // 状態変更通知（mitt）
            if (wasMultiTouch) {
                this.notifyMultiTouchState(false);
                this.notifyGesture('pinch_end', {
                    finalZoom: this.zoomLevel
                });
            }
        }
    }
    
    // 中心点計算（新規・効率化）
    calculateCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }
    
    // 距離計算（効率化）
    calculateDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // ピンチズーム処理（カメラ統合・効率化）
    handlePinchZoom(zoomDelta) {
        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.max(0.1, Math.min(5.0, this.zoomLevel * zoomDelta));
        
        // カメラのズーム調整（効率化）
        if (this.engine.camera && this.zoomLevel !== oldZoom) {
            this.updateCameraProjection();
        }
    }
    
    // カメラ投影更新（独立メソッド化・効率化）
    updateCameraProjection() {
        const scale = 1 / this.zoomLevel;
        const canvas = this.engine.canvas;
        
        this.engine.camera.orthographic({
            left: -canvas.width / 2 * scale,
            right: canvas.width / 2 * scale,
            bottom: -canvas.height / 2 * scale,
            top: canvas.height / 2 * scale,
            near: 0.1,
            far: 100
        });
        
        // カメラ更新通知（mitt）
        this.eventBus.emit('interaction.camera.updated', {
            zoom: this.zoomLevel,
            scale: scale
        });
    }
    
    // ジェスチャー認識設定（mitt通知統合・効率化）
    setupGestureRecognition() {
        this.gestureBuffer = [];
        this.gestureThreshold = 50;
        this.lastTapTime = 0;
        this.setupGestureListeners();
    }
    
    // ジェスチャーリスナー設定（mitt通知統合・効率化）
    setupGestureListeners() {
        if (!this.engine.canvas) return;
        
        const canvas = this.engine.canvas;
        
        // 右クリック処理（mitt通知）
        canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.handleContextMenu(event);
        });
        
        // ダブルタップ検出（mitt通知・効率化）
        canvas.addEventListener('pointerdown', (event) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastTapTime;
            
            if (timeDiff < 300) {
                this.handleDoubleTap(event);
            }
            
            this.lastTapTime = currentTime;
        });
    }
    
    // コンテキストメニュー処理（mitt通知統合）
    handleContextMenu(event) {
        // コンテキストアクション実行
        if (this.engine.strokes.length > 0) {
            this.engine.undo();
            
            // ジェスチャー通知
            this.notifyGesture('context_menu', {
                action: 'undo',
                position: { x: event.clientX, y: event.clientY }
            });
        }
    }
    
    // ダブルタップ処理（mitt通知統合・効率化）
    handleDoubleTap(event) {
        // ズームリセット
        const oldZoom = this.zoomLevel;
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        
        if (this.engine.camera) {
            this.updateCameraProjection();
        }
        
        // ダブルタップ通知
        this.notifyGesture('double_tap', {
            action: 'zoom_reset',
            oldZoom: oldZoom,
            newZoom: this.zoomLevel,
            position: { x: event.clientX, y: event.clientY }
        });
        
        event.preventDefault();
    }
    
    // 入力最適化設定（統計機能強化・効率化）
    setupInputOptimization() {
        this.inputBuffer = [];
        this.bufferSize = 3;
        this.lastInputTime = 0;
        this.inputThrottleMs = 16; // 60fps相当
        
        // 入力統計（新規）
        this.inputStats = {
            totalInputs: 0,
            throttledInputs: 0,
            averageInterval: 0,
            lastResetTime: performance.now()
        };
    }
    
    // 入力最適化処理（統計機能統合・効率化）
    optimizeInput(event) {
        const currentTime = performance.now();
        this.inputStats.totalInputs++;
        
        // 入力スロットリング
        if (currentTime - this.lastInputTime < this.inputThrottleMs) {
            this.inputStats.throttledInputs++;
            return null; // スロットリング適用
        }
        
        // 平均間隔更新
        if (this.lastInputTime > 0) {
            const interval = currentTime - this.lastInputTime;
            this.inputStats.averageInterval = 
                (this.inputStats.averageInterval * 0.9) + (interval * 0.1);
        }
        
        this.lastInputTime = currentTime;
        
        // 入力バッファリング（効率化）
        const inputData = {
            x: event.clientX,
            y: event.clientY,
            pressure: event.pressure || 0.5,
            timestamp: currentTime
        };
        
        this.inputBuffer.push(inputData);
        if (this.inputBuffer.length > this.bufferSize) {
            this.inputBuffer.shift();
        }
        
        return inputData;
    }
    
    // 入力統計更新（新規・mitt連携）
    updateInputStats(point) {
        // 5秒ごとに統計をリセット・通知
        if (point.timestamp - this.inputStats.lastResetTime > 5000) {
            this.notifyInputOptimization(this.getInputStats());
            this.resetInputStats();
        }
    }
    
    // 入力統計取得（新規）
    getInputStats() {
        const stats = { ...this.inputStats };
        const currentTime = performance.now();
        const timespan = currentTime - stats.lastResetTime;
        
        return {
            ...stats,
            timespan: timespan,
            inputRate: stats.totalInputs / (timespan / 1000),
            throttleRate: stats.throttledInputs / stats.totalInputs || 0
        };
    }
    
    // 入力統計リセット（新規）
    resetInputStats() {
        this.inputStats = {
            totalInputs: 0,
            throttledInputs: 0,
            averageInterval: 0,
            lastResetTime: performance.now()
        };
    }
    
    // リアルタイムプレビュー設定（mitt統合・効率化）
    setupRealtimePreview() {
        this.previewEnabled = true;
        this.previewOpacity = 0.7;
        this.previewStroke = null;
    }
    
    // プレビュー開始（新規・mitt連携）
    startPreview(stroke) {
        if (!this.previewEnabled) return;
        
        this.previewStroke = stroke;
        this.eventBus.emit('interaction.preview.start', {
            stroke: stroke,
            opacity: this.previewOpacity
        });
    }
    
    // プレビュー更新（新規・mitt連携）
    updatePreview(stroke, newPoint) {
        if (!this.previewEnabled || !this.previewStroke) return;
        
        this.eventBus.emit('interaction.preview.update', {
            stroke: stroke,
            newPoint: newPoint,
            opacity: this.previewOpacity
        });
    }
    
    // プレビュー終了（新規・mitt連携）
    endPreview() {
        if (!this.previewEnabled) return;
        
        this.eventBus.emit('interaction.preview.end', {
            stroke: this.previewStroke
        });
        
        this.previewStroke = null;
    }
    
    // プレビュー描画（既存機能維持・効率化）
    drawPreview(currentStroke) {
        if (!this.previewEnabled || !currentStroke) return;
        
        // 現在のストロークをプレビュー表示
        if (currentStroke.mesh) {
            const originalOpacity = currentStroke.mesh.program.uniforms.uOpacity.value;
            currentStroke.mesh.program.uniforms.uOpacity.value = this.previewOpacity;
            
            // レンダリング後に不透明度を戻す（非同期・効率化）
            requestAnimationFrame(() => {
                if (currentStroke.mesh && currentStroke.mesh.program) {
                    currentStroke.mesh.program.uniforms.uOpacity.value = originalOpacity;
                }
            });
        }
    }
    
    // インタラクション設定更新（mitt通知統合・効率化）
    updateInteractionSettings(settings) {
        let hasChanges = false;
        
        // 設定更新（変更検出・効率化）
        if (settings.multiTouchEnabled !== undefined && 
            settings.multiTouchEnabled !== this.isMultiTouchEnabled) {
            this.isMultiTouchEnabled = settings.multiTouchEnabled;
            hasChanges = true;
        }
        
        if (settings.gestureEnabled !== undefined && 
            settings.gestureEnabled !== this.gestureEnabled) {
            this.gestureEnabled = settings.gestureEnabled;
            hasChanges = true;
        }
        
        if (settings.previewEnabled !== undefined && 
            settings.previewEnabled !== this.previewEnabled) {
            this.previewEnabled = settings.previewEnabled;
            hasChanges = true;
        }
        
        if (settings.inputThrottleMs !== undefined && 
            settings.inputThrottleMs !== this.inputThrottleMs) {
            this.inputThrottleMs = settings.inputThrottleMs;
            hasChanges = true;
        }
        
        // 変更通知（mitt）
        if (hasChanges) {
            this.eventBus.emit('interaction.settings.updated', {
                settings: settings,
                timestamp: performance.now()
            });
        }
    }
    
    // ズーム・パン状態取得（効率化）
    getViewState() {
        return {
            zoom: this.zoomLevel,
            pan: { ...this.panOffset },
            isMultiTouch: this.isMultiTouch,
            touchCount: this.touchPoints.size,
            inputStats: this.getInputStats()
        };
    }
    
    // ズーム・パン状態リセット（mitt通知統合・効率化）
    resetViewState() {
        const oldState = this.getViewState();
        
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        this.isMultiTouch = false;
        this.touchPoints.clear();
        
        if (this.engine.camera) {
            this.updateCameraProjection();
        }
        
        // リセット通知（mitt）
        this.eventBus.emit('interaction.view.reset', {
            oldState: oldState,
            newState: this.getViewState()
        });
    }
    
    // クリーンアップ（メモリリーク対策・mitt統合）
    destroy() {
        // mittイベントリスナー削除
        if (this.eventBus) {
            this.eventBus.off('drawing.start', this.onDrawingStart);
            this.eventBus.off('drawing.update', this.onDrawingUpdate);
            this.eventBus.off('drawing.complete', this.onDrawingComplete);
            this.eventBus.off('settings.changed', this.onSettingsChanged);
        }
        
        // 統計リセット
        this.resetInputStats();
        
        // その他のクリーンアップ
        this.inputBuffer = [];
        this.touchPoints.clear();
        this.previewStroke = null;
    }
}