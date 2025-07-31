// OGLInputController.js - OGL統一入力処理（Phase1基盤・450-550行）

/**
 * 🎯 OGL統一入力処理コントローラー
 * ポインター入力・デバイス対応・キャンバス座標変換精密化
 */
export class OGLInputController {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.canvas = oglEngine.canvas;
        
        // 入力状態
        this.isPointerDown = false;
        this.isRightClick = false;
        this.lastPointerPos = { x: 0, y: 0 };
        this.pointerHistory = [];
        
        // デバイス情報
        this.deviceType = this.detectDeviceType();
        this.supportsPressure = false;
        this.supportsHover = false;
        
        // 座標変換キャッシュ
        this.canvasRect = null;
        this.canvasScale = 1.0;
        this.canvasOffset = { x: 0, y: 0 };
        
        // タッチ・ペン対応
        this.activeTouches = new Map();
        this.isPenInput = false;
        
        // イベントリスナー参照（削除用）
        this.boundEvents = {};
        
        // Phase2以降拡張予定
        // this.gestureProcessor = null;        // Phase2でジェスチャー追加
        // this.multiTouchHandler = null;       // Phase2でマルチタッチ追加
        // this.keyboardModifiers = {};         // Phase2でキー修飾追加
        
        console.log(`🎯 OGL入力コントローラー初期化 - デバイス: ${this.deviceType}`);
    }
    
    /**
     * 📱 デバイス種別検出
     */
    detectDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hasPointer = 'onpointerdown' in window;
        
        if (hasPointer) {
            this.supportsPressure = true;
            this.supportsHover = true;
        }
        
        if (userAgent.includes('mobile') || userAgent.includes('tablet')) {
            return hasTouch ? 'touch' : 'mobile';
        } else if (hasTouch) {
            return 'hybrid'; // タッチ対応PC
        } else {
            return 'desktop';
        }
    }
    
    /**
     * 🎧 イベントリスナー開始
     */
    startListening() {
        try {
            // キャンバス座標キャッシュ更新
            this.updateCanvasRect();
            
            // Modern Pointer Events API優先
            if ('onpointerdown' in window) {
                this.setupPointerEvents();
            } else {
                // フォールバック: Mouse + Touch
                this.setupMouseEvents();
                this.setupTouchEvents();
            }
            
            // 共通イベント
            this.setupCommonEvents();
            
            console.log('🎧 OGL入力リスナー開始 - Modern API使用');
            
        } catch (error) {
            console.error('🚨 入力リスナー開始エラー:', error);
        }
    }
    
    /**
     * 🖱️ Pointer Events API設定（最新標準）
     */
    setupPointerEvents() {
        // Pointer Down
        this.boundEvents.pointerdown = (e) => this.handlePointerDown(e);
        this.canvas.addEventListener('pointerdown', this.boundEvents.pointerdown);
        
        // Pointer Move
        this.boundEvents.pointermove = (e) => this.handlePointerMove(e);
        this.canvas.addEventListener('pointermove', this.boundEvents.pointermove);
        
        // Pointer Up
        this.boundEvents.pointerup = (e) => this.handlePointerUp(e);
        this.canvas.addEventListener('pointerup', this.boundEvents.pointerup);
        this.canvas.addEventListener('pointercancel', this.boundEvents.pointerup);
        
        // Pointer Leave（キャンバス外でのリリース対応）
        this.boundEvents.pointerleave = (e) => this.handlePointerLeave(e);
        this.canvas.addEventListener('pointerleave', this.boundEvents.pointerleave);
        
        // ホバー（Phase2でツールプレビュー等に活用）
        if (this.supportsHover) {
            this.boundEvents.pointerenter = (e) => this.handlePointerHover(e, true);
            this.boundEvents.pointerout = (e) => this.handlePointerHover(e, false);
            this.canvas.addEventListener('pointerenter', this.boundEvents.pointerenter);
            this.canvas.addEventListener('pointerout', this.boundEvents.pointerout);
        }
        
        // Touch Action無効化（ブラウザのデフォルト動作防止）
        this.canvas.style.touchAction = 'none';
    }
    
    /**
     * 🖱️ マウスイベント設定（フォールバック）
     */
    setupMouseEvents() {
        this.boundEvents.mousedown = (e) => this.handleMouseDown(e);
        this.boundEvents.mousemove = (e) => this.handleMouseMove(e);
        this.boundEvents.mouseup = (e) => this.handleMouseUp(e);
        this.boundEvents.mouseleave = (e) => this.handleMouseLeave(e);
        
        this.canvas.addEventListener('mousedown', this.boundEvents.mousedown);
        this.canvas.addEventListener('mousemove', this.boundEvents.mousemove);
        this.canvas.addEventListener('mouseup', this.boundEvents.mouseup);
        this.canvas.addEventListener('mouseleave', this.boundEvents.mouseleave);
        
        // 右クリックコンテキストメニュー無効化
        this.boundEvents.contextmenu = (e) => e.preventDefault();
        this.canvas.addEventListener('contextmenu', this.boundEvents.contextmenu);
    }
    
    /**
     * 👆 タッチイベント設定（フォールバック）
     */
    setupTouchEvents() {
        this.boundEvents.touchstart = (e) => this.handleTouchStart(e);
        this.boundEvents.touchmove = (e) => this.handleTouchMove(e);
        this.boundEvents.touchend = (e) => this.handleTouchEnd(e);
        this.boundEvents.touchcancel = (e) => this.handleTouchEnd(e);
        
        this.canvas.addEventListener('touchstart', this.boundEvents.touchstart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundEvents.touchmove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundEvents.touchend, { passive: false });
        this.canvas.addEventListener('touchcancel', this.boundEvents.touchcancel, { passive: false });
    }
    
    /**
     * 🔧 共通イベント設定
     */
    setupCommonEvents() {
        // リサイズ対応
        this.boundEvents.resize = () => this.updateCanvasRect();
        window.addEventListener('resize', this.boundEvents.resize);
        
        // ページ離脱時のクリーンアップ
        this.boundEvents.beforeunload = () => this.cleanup();
        window.addEventListener('beforeunload', this.boundEvents.beforeunload);
    }
    
    /**
     * 📐 キャンバス座標変換精密化
     */
    updateCanvasRect() {
        this.canvasRect = this.canvas.getBoundingClientRect();
        this.canvasScale = this.canvas.width / this.canvasRect.width;
        this.canvasOffset = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2
        };
    }
    
    /**
     * 🎯 座標変換（ブラウザ→OGL）
     */
    transformCoordinates(clientX, clientY) {
        if (!this.canvasRect) this.updateCanvasRect();
        
        // ブラウザ座標 → キャンバス座標
        const canvasX = (clientX - this.canvasRect.left) * this.canvasScale;
        const canvasY = (clientY - this.canvasRect.top) * this.canvasScale;
        
        // キャンバス座標 → OGL座標（中央原点・Y軸反転）
        const oglX = canvasX - this.canvasOffset.x;
        const oglY = -(canvasY - this.canvasOffset.y);
        
        return { x: oglX, y: oglY };
    }
    
    /**
     * 🖱️ Pointer Down処理
     */
    handlePointerDown(e) {
        e.preventDefault();
        
        this.isPointerDown = true;
        this.isRightClick = e.button === 2;
        this.isPenInput = e.pointerType === 'pen';
        
        const coords = this.transformCoordinates(e.clientX, e.clientY);
        const pressure = this.extractPressure(e);
        
        this.lastPointerPos = coords;
        this.pointerHistory = [{ ...coords, pressure, timestamp: Date.now() }];
        
        // 右クリック以外で描画開始
        if (!this.isRightClick) {
            this.engine.startStroke(coords.x, coords.y, pressure);
        }
        
        // Phase2以降でツール別処理追加
        this.logInputEvent('pointer_down', { coords, pressure, pointerType: e.pointerType });
    }
    
    /**
     * 🖱️ Pointer Move処理
     */
    handlePointerMove(e) {
        e.preventDefault();
        
        const coords = this.transformCoordinates(e.clientX, e.clientY);
        const pressure = this.extractPressure(e);
        
        // 履歴更新
        this.pointerHistory.push({ ...coords, pressure, timestamp: Date.now() });
        if (this.pointerHistory.length > 10) {
            this.pointerHistory.shift(); // 履歴サイズ制限
        }
        
        // 描画中の場合
        if (this.isPointerDown && !this.isRightClick) {
            this.engine.updateStroke(coords.x, coords.y, pressure);
        }
        
        // ホバー処理（Phase2で活用）
        else if (this.supportsHover) {
            // Phase2でツールプレビュー等実装予定
        }
        
        this.lastPointerPos = coords;
    }
    
    /**
     * 🖱️ Pointer Up処理
     */
    handlePointerUp(e) {
        e.preventDefault();
        
        if (this.isPointerDown && !this.isRightClick) {
            this.engine.endStroke();
        }
        
        this.isPointerDown = false;
        this.isRightClick = false;
        this.isPenInput = false;
        
        this.logInputEvent('pointer_up', { 
            coords: this.lastPointerPos,
            historyLength: this.pointerHistory.length 
        });
    }
    
    /**
     * 🚪 Pointer Leave処理
     */
    handlePointerLeave(e) {
        if (this.isPointerDown) {
            this.handlePointerUp(e);
        }
    }
    
    /**
     * 🏠 Pointer Hover処理（Phase2で活用）
     */
    handlePointerHover(e, isEnter) {
        // Phase2でツールプレビュー、カーソル変更等実装予定
        if (isEnter) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    /**
     * 🖱️ マウスイベント処理（フォールバック）
     */
    handleMouseDown(e) {
        this.handlePointerDown({
            ...e,
            pointerId: 1,
            pointerType: 'mouse',
            pressure: 1.0
        });
    }
    
    handleMouseMove(e) {
        this.handlePointerMove({
            ...e,
            pointerId: 1,
            pointerType: 'mouse',
            pressure: 1.0
        });
    }
    
    handleMouseUp(e) {
        this.handlePointerUp({
            ...e,
            pointerId: 1,
            pointerType: 'mouse'
        });
    }
    
    handleMouseLeave(e) {
        this.handlePointerLeave({
            ...e,
            pointerId: 1,
            pointerType: 'mouse'
        });
    }
    
    /**
     * 👆 タッチイベント処理（フォールバック）
     */
    handleTouchStart(e) {
        e.preventDefault();
        
        for (const touch of e.changedTouches) {
            this.activeTouches.set(touch.identifier, touch);
            
            // プライマリタッチのみ描画
            if (this.activeTouches.size === 1) {
                this.handlePointerDown({
                    ...touch,
                    pointerId: touch.identifier,
                    pointerType: 'touch',
                    pressure: 1.0,
                    button: 0
                });
            }
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        for (const touch of e.changedTouches) {
            if (this.activeTouches.has(touch.identifier)) {
                this.activeTouches.set(touch.identifier, touch);
                
                // プライマリタッチのみ描画
                if (this.activeTouches.size === 1) {
                    this.handlePointerMove({
                        ...touch,
                        pointerId: touch.identifier,
                        pointerType: 'touch',
                        pressure: 1.0
                    });
                }
            }
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        for (const touch of e.changedTouches) {
            if (this.activeTouches.has(touch.identifier)) {
                // プライマリタッチのみ描画終了
                if (this.activeTouches.size === 1) {
                    this.handlePointerUp({
                        ...touch,
                        pointerId: touch.identifier,
                        pointerType: 'touch'
                    });
                }
                
                this.activeTouches.delete(touch.identifier);
            }
        }
    }
    
    /**
     * 💪 筆圧抽出
     */
    extractPressure(e) {
        // Pointer Events APIの筆圧
        if (e.pressure !== undefined && e.pressure > 0) {
            return Math.max(0.1, Math.min(1.0, e.pressure));
        }
        
        // ペン入力の場合のデフォルト
        if (this.isPenInput || e.pointerType === 'pen') {
            return 0.8;
        }
        
        // その他のデフォルト
        return 1.0;
    }
    
    /**
     * 📊 入力統計取得
     */
    getInputStats() {
        return {
            deviceType: this.deviceType,
            supportsPressure: this.supportsPressure,
            supportsHover: this.supportsHover,
            isPointerDown: this.isPointerDown,
            isPenInput: this.isPenInput,
            activeTouches: this.activeTouches.size,
            historyLength: this.pointerHistory.length
        };
    }
    
    /**
     * 📝 入力イベントログ（開発用）
     */
    logInputEvent(eventType, data) {
        if (import.meta.env?.DEV) {
            console.log(`🎯 Input Event: ${eventType}`, {
                timestamp: Date.now(),
                ...data
            });
        }
    }
    
    /**
     * 🧹 イベントリスナー削除・クリーンアップ
     */
    cleanup() {
        try {
            // 全イベントリスナー削除
            Object.entries(this.boundEvents).forEach(([event, handler]) => {
                if (event === 'resize' || event === 'beforeunload') {
                    window.removeEventListener(event, handler);
                } else {
                    this.canvas.removeEventListener(event, handler);
                }
            });
            
            // 参照クリア
            this.boundEvents = {};
            this.activeTouches.clear();
            this.pointerHistory = [];
            
            console.log('🧹 OGL入力コントローラー クリーンアップ完了');
            
        } catch (error) {
            console.error('🚨 入力コントローラー クリーンアップエラー:', error);
        }
    }
    
    // Phase2以降拡張予定機能
    
    /**
     * Phase2: ジェスチャー処理追加予定
     */
    /*
    initializeGestureProcessor() {
        // Phase2で実装: ピンチ・ズーム・回転等
        // this.gestureProcessor = new GestureProcessor();
    }
    
    handleGesture(gestureType, gestureData) {
        // Phase2で実装: ジェスチャー別処理
    }
    */
    
    /**
     * Phase2: マルチタッチ処理追加予定
     */
    /*
    initializeMultiTouchHandler() {
        // Phase2で実装: マルチタッチサポート
        // this.multiTouchHandler = new MultiTouchHandler();
    }
    
    handleMultiTouch(touches) {
        // Phase2で実装: 複数指による操作
    }
    */
    
    /**
     * Phase2: キーボード修飾キー統合予定
     */
    /*
    setupKeyboardModifiers() {
        // Phase2で実装: Shift/Ctrl/Alt等の修飾キー
        // this.keyboardModifiers = new KeyboardModifierHandler();
    }
    */
}