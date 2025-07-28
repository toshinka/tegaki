// src/engine/OGLInputProcessor.js - OGL統合入力処理システム
// v5.2 OGL統一 - Pointer Events API統合専門

// OGL統一入力設定
const OGL_INPUT_CONFIG = {
    // ポインター感度設定
    pointer: {
        pressureMultiplier: 1.0,
        smoothingFactor: 0.8,
        minPressure: 0.1,
        maxPressure: 1.0,
        sampleRate: 60 // FPS
    },
    
    // 描画制御
    drawing: {
        minDistance: 2.0, // ピクセル
        maxPoints: 10000,
        simplificationThreshold: 1.5
    },
    
    // 入力デバウンス
    debounce: {
        strokeStart: 10, // ms
        strokeEnd: 50,   // ms
        toolSwitch: 100  // ms
    }
};

export class OGLInputProcessor {
    constructor(canvas, oglEngine) {
        console.log('🎮 OGL統合入力処理システム構築開始...');
        
        this.canvas = canvas;
        this.oglEngine = oglEngine;
        
        // OGL統一制御状態
        this.isDrawing = false;
        this.currentStrokeId = null;
        this.lastPoint = null;
        this.strokePoints = [];
        
        // 入力状態管理
        this.pointerState = {
            isPressed: false,
            currentPressure: 0,
            lastTimestamp: 0,
            totalPoints: 0
        };
        
        // イベントリスナー管理
        this.eventListeners = new Map();
        this.isEnabled = false;
        
        // パフォーマンス制御
        this.inputThrottle = null;
        this.strokeBuffer = [];
        
        console.log('✅ OGL統合入力処理システム構築完了');
    }

    // === OGL統一入力初期化 ===
    initialize() {
        console.log('🚀 OGL統合入力システム初期化...');
        
        try {
            // Pointer Events API設定（モダンブラウザ標準）
            this.setupPointerEvents();
            
            // OGL統一制御イベント
            this.setupOGLControlEvents();
            
            // パフォーマンス最適化
            this.setupPerformanceOptimization();
            
            this.isEnabled = true;
            console.log('✅ OGL統合入力システム初期化完了');
            
        } catch (error) {
            console.error('❌ 入力システム初期化エラー:', error);
            throw error;
        }
    }

    setupPointerEvents() {
        console.log('👆 Pointer Events API設定...');
        
        // ポインターダウン（描画開始）
        const onPointerDown = (event) => {
            event.preventDefault();
            this.handleOGLDrawStart(event);
        };
        
        // ポインタームーブ（描画継続）
        const onPointerMove = (event) => {
            event.preventDefault();
            if (this.isDrawing) {
                this.handleOGLDrawContinue(event);
            }
        };
        
        // ポインターアップ（描画終了）
        const onPointerUp = (event) => {
            event.preventDefault();
            this.handleOGLDrawEnd(event);
        };
        
        // ポインターキャンセル
        const onPointerCancel = (event) => {
            event.preventDefault();
            this.handleOGLDrawCancel(event);
        };

        // イベント登録
        this.canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
        this.canvas.addEventListener('pointermove', onPointerMove, { passive: false });
        this.canvas.addEventListener('pointerup', onPointerUp, { passive: false });
        this.canvas.addEventListener('pointercancel', onPointerCancel, { passive: false });

        // リスナー管理用保存
        this.eventListeners.set('pointerdown', onPointerDown);
        this.eventListeners.set('pointermove', onPointerMove);
        this.eventListeners.set('pointerup', onPointerUp);
        this.eventListeners.set('pointercancel', onPointerCancel);

        // タッチアクション制御（スクロール防止）
        this.canvas.style.touchAction = 'none';
        
        console.log('✅ Pointer Events API設定完了');
    }

    setupOGLControlEvents() {
        console.log('🎛️ OGL統一制御イベント設定...');
        
        // コンテキストメニュー無効化
        const onContextMenu = (event) => {
            event.preventDefault();
        };
        
        // 右クリック制御
        const onMouseDown = (event) => {
            if (event.button === 2) { // 右クリック
                event.preventDefault();
            }
        };

        this.canvas.addEventListener('contextmenu', onContextMenu);
        this.canvas.addEventListener('mousedown', onMouseDown);
        
        this.eventListeners.set('contextmenu', onContextMenu);
        this.eventListeners.set('mousedown', onMouseDown);
        
        console.log('✅ OGL統一制御イベント設定完了');
    }

    setupPerformanceOptimization() {
        console.log('⚡ パフォーマンス最適化設定...');
        
        // 入力スロットリング設定
        this.inputThrottle = this.createThrottledHandler(
            this.processOGLInput.bind(this),
            1000 / OGL_INPUT_CONFIG.pointer.sampleRate // 60FPS
        );
        
        console.log('✅ パフォーマンス最適化設定完了');
    }

    // === OGL統一描画制御 ===
    handleOGLDrawStart(event) {
        if (this.isDrawing) {
            console.warn('⚠️ 描画中に新規描画開始試行');
            return;
        }

        const point = this.extractOGLPoint(event);
        
        console.log(`🖊️ OGL描画開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) 筆圧=${point.pressure.toFixed(2)}`);

        try {
            // OGL統一エンジン経由で描画開始
            this.currentStrokeId = this.oglEngine.startStroke(
                point.x, 
                point.y, 
                point.pressure
            );

            // 状態更新
            this.isDrawing = true;
            this.lastPoint = point;
            this.strokePoints = [point];
            
            // ポインター状態更新
            this.pointerState.isPressed = true;
            this.pointerState.currentPressure = point.pressure;
            this.pointerState.lastTimestamp = event.timeStamp;
            this.pointerState.totalPoints = 1;

            // ポインターキャプチャ
            this.canvas.setPointerCapture(event.pointerId);

        } catch (error) {
            console.error('❌ OGL描画開始エラー:', error);
            this.resetDrawingState();
        }
    }

    handleOGLDrawContinue(event) {
        if (!this.isDrawing || !this.currentStrokeId) {
            return;
        }

        const point = this.extractOGLPoint(event);
        
        // 距離チェック（パフォーマンス最適化）
        if (this.lastPoint && this.calculateDistance(this.lastPoint, point) < OGL_INPUT_CONFIG.drawing.minDistance) {
            return;
        }

        try {
            // OGL統一エンジン経由で描画継続
            this.oglEngine.continueStroke(
                this.currentStrokeId,
                point.x,
                point.y,
                point.pressure
            );

            // 状態更新
            this.lastPoint = point;
            this.strokePoints.push(point);
            this.pointerState.totalPoints++;

            // ポイント数制限チェック
            if (this.strokePoints.length > OGL_INPUT_CONFIG.drawing.maxPoints) {
                console.warn('⚠️ ストロークポイント数上限到達、描画終了');
                this.handleOGLDrawEnd(event);
            }

        } catch (error) {
            console.error('❌ OGL描画継続エラー:', error);
            this.handleOGLDrawEnd(event);
        }
    }

    handleOGLDrawEnd(event) {
        if (!this.isDrawing || !this.currentStrokeId) {
            return;
        }

        console.log(`🖊️ OGL描画終了: ストロークID=${this.currentStrokeId}, ポイント数=${this.strokePoints.length}`);

        try {
            // OGL統一エンジン経由で描画終了
            this.oglEngine.endStroke(this.currentStrokeId);

            console.log(`✅ 描画完了: 総ポイント数=${this.pointerState.totalPoints}`);

        } catch (error) {
            console.error('❌ OGL描画終了エラー:', error);
        } finally {
            // 状態リセット
            this.resetDrawingState();
            
            // ポインターキャプチャ解除
            if (event?.pointerId) {
                this.canvas.releasePointerCapture(event.pointerId);
            }
        }
    }

    handleOGLDrawCancel(event) {
        console.log('🚫 OGL描画キャンセル');
        
        if (this.isDrawing && this.currentStrokeId) {
            // 描画を強制終了
            this.handleOGLDrawEnd(event);
        }
        
        this.resetDrawingState();
    }

    // === OGL統一座標・筆圧処理 ===
    extractOGLPoint(event) {
        // キャンバス座標系への変換
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        // 筆圧の正規化（Pointer Events標準）
        let pressure = event.pressure || 1.0;
        pressure = Math.max(
            OGL_INPUT_CONFIG.pointer.minPressure,
            Math.min(OGL_INPUT_CONFIG.pointer.maxPressure, pressure)
        );
        
        return {
            x: x,
            y: y,
            pressure: pressure,
            timestamp: event.timeStamp,
            pointerId: event.pointerId,
            pointerType: event.pointerType
        };
    }

    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + 
            Math.pow(point2.y - point1.y, 2)
        );
    }

    // === 状態管理 ===
    resetDrawingState() {
        this.isDrawing = false;
        this.currentStrokeId = null;
        this.lastPoint = null;
        this.strokePoints = [];
        
        this.pointerState.isPressed = false;
        this.pointerState.currentPressure = 0;
        this.pointerState.totalPoints = 0;
    }

    // === パフォーマンス最適化 ===
    createThrottledHandler(handler, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return handler.apply(this, args);
            }
        };
    }

    processOGLInput(inputData) {
        // 高頻度入力の処理最適化
        if (this.strokeBuffer.length > 0) {
            // バッファリングされた入力をまとめて処理
            const batchPoints = [...this.strokeBuffer];
            this.strokeBuffer = [];
            
            batchPoints.forEach(point => {
                if (this.isDrawing && this.currentStrokeId) {
                    this.oglEngine.continueStroke(
                        this.currentStrokeId,
                        point.x,
                        point.y,
                        point.pressure
                    );
                }
            });
        }
    }

    // === 制御API ===
    enable() {
        this.isEnabled = true;
        console.log('✅ OGL統合入力システム有効化');
    }

    disable() {
        this.isEnabled = false;
        
        // 描画中の場合は強制終了
        if (this.isDrawing) {
            this.handleOGLDrawCancel();
        }
        
        console.log('⏹️ OGL統合入力システム無効化');
    }

    isInputEnabled() {
        return this.isEnabled;
    }

    getCurrentDrawingState() {
        return {
            isDrawing: this.isDrawing,
            strokeId: this.currentStrokeId,
            pointCount: this.strokePoints.length,
            currentPressure: this.pointerState.currentPressure,
            enabled: this.isEnabled
        };
    }

    // === 廃棄処理 ===
    dispose() {
        console.log('🧹 OGL統合入力システム廃棄開始...');

        try {
            // 描画強制終了
            if (this.isDrawing) {
                this.handleOGLDrawCancel();
            }

            // イベントリスナー削除
            this.eventListeners.forEach((listener, eventType) => {
                this.canvas.removeEventListener(eventType, listener);
            });
            this.eventListeners.clear();

            // スロットリング解除
            this.inputThrottle = null;

            // 状態クリア
            this.resetDrawingState();
            this.strokeBuffer = [];

            // キャンバススタイルリセット
            this.canvas.style.touchAction = 'auto';

            this.isEnabled = false;

            console.log('✅ OGL統合入力システム廃棄完了');

        } catch (error) {
            console.error('❌ 入力システム廃棄エラー:', error);
        }
    }

    // === デバッグ ===
    getDebugInfo() {
        return {
            isDrawing: this.isDrawing,
            currentStrokeId: this.currentStrokeId,
            strokePoints: this.strokePoints.length,
            pointerState: { ...this.pointerState },
            isEnabled: this.isEnabled,
            eventListeners: this.eventListeners.size,
            config: OGL_INPUT_CONFIG
        };
    }

    logInputState() {
        console.log('🎮 OGL統合入力状態:', this.getDebugInfo());
    }
}