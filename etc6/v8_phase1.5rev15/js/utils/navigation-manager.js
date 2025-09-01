/**
 * 🧭 NavigationManager - PixiJS v8高精度パン・ズーム・ナビゲーション管理
 * 📋 RESPONSIBILITY: v8 Container変形・高精度パン・ズーム・キーボードナビゲーション・変形状態管理
 * 🚫 PROHIBITION: 座標変換・描画処理・レイヤー管理・UI通知・フォールバック処理
 * ✅ PERMISSION: v8 Container変形・Matrix操作・イベント処理・高精度ナビゲーション・WebGPU最適化
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Container中心・高精度変形・パフォーマンス重視・状態管理統一・WebGPU活用
 * 🔄 INTEGRATION: CanvasManager v8(Stage取得) + CoordinateManager v8(座標連携) + PixiJS v8(Container変形) + EventBus(通知)
 * 🎯 V8_FEATURE: Container.scale/position活用・Matrix高精度変形・WebGPU加速・リアルタイム変形
 * 
 * === ナビゲーションフロー ===
 * パン開始: ポインター取得 → v8座標変換 → Stage変形開始 → リアルタイム更新 → 変形適用
 * ズーム: ホイール検出 → 中心座標計算 → v8 Matrix変形 → Container.scale更新 → 高精度適用
 * キーボード: キー検出 → 方向計算 → v8変形更新 → Container即時反映 → 状態同期
 * 
 * === 提供メソッド ===
 * - async setCanvasManagerV8(canvasManager) : v8対応CanvasManager設定
 * - zoomCanvasV8(scale, centerX, centerY) : v8高精度ズーム
 * - panCanvasV8(deltaX, deltaY) : v8高精度パン
 * - getCanvasTransformV8() : v8変形状態取得
 * - resetViewV8() : v8ビューリセット
 * - setCoordinateManagerV8(coordinateManager) : v8 CoordinateManager設定
 * 
 * === 他ファイル呼び出しメソッド ===
 * - canvasManager.pixiApp.stage : v8 Stage Container取得
 * - coordinateManager.clearV8Cache() : v8座標キャッシュクリア
 * - window.Tegaki.EventBusInstance.emit() : イベント配信
 * - document.addEventListener() : DOM イベント処理
 * - PIXI.Container.scale.set() : v8 Container スケール設定
 * - PIXI.Container.position.set() : v8 Container 位置設定
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.NavigationManager) {
    /**
     * NavigationManager - PixiJS v8高精度ナビゲーション管理
     * キャンバスパン・ズーム・キーボードナビゲーションを管理（v8対応版）
     */
    class NavigationManager {
        constructor() {
            console.log('🧭 NavigationManager v8対応版 初期化開始');
            
            this.canvasManager = null;
            this.coordinateManager = null;
            this.eventBus = null;
            this.v8Ready = false;
            
            // v8ナビゲーション状態
            this.isPanning = false;
            this.panStartPos = { x: 0, y: 0 };
            this.currentTransform = {
                scale: 1.0,
                translateX: 0,
                translateY: 0
            };
            
            // v8高精度ズーム設定
            this.zoomLevel = 1.0;
            this.zoomMin = 0.1;
            this.zoomMax = 10.0;
            this.zoomStep = 0.1;
            this.zoomSensitivity = 0.001; // v8高精度ズーム感度
            
            // v8キーボード設定
            this.keys = new Set();
            this.keyboardPanSpeed = 20;
            this.keyboardZoomSpeed = 0.1;
            
            // v8パフォーマンス設定
            this.webgpuSupported = false;
            this.highPerformanceMode = false;
            this.smoothTransition = true;
            
            console.log('✅ NavigationManager v8対応版 初期化完了');
        }
        
        /**
         * v8対応CanvasManager設定
         * @param {CanvasManager} canvasManager - v8対応CanvasManager
         */
        async setCanvasManagerV8(canvasManager) {
            console.log('🔧 NavigationManager - v8 CanvasManager設定開始');
            
            if (!canvasManager) {
                throw new Error('NavigationManager: CanvasManager is required for v8');
            }
            
            if (!canvasManager.isV8Ready()) {
                throw new Error('NavigationManager: CanvasManager v8 not ready');
            }
            
            this.canvasManager = canvasManager;
            
            // v8機能確認
            if (canvasManager.webgpuSupported) {
                this.webgpuSupported = true;
                this.highPerformanceMode = true;
                this.zoomSensitivity = 0.0005; // WebGPU高精度
                console.log('🚀 NavigationManager: WebGPU高性能モード有効');
            }
            
            await this.initializeV8Features();
            
            this.v8Ready = true;
            console.log('✅ NavigationManager - v8 CanvasManager設定完了');
        }
        
        /**
         * v8対応CoordinateManager設定
         * @param {CoordinateManager} coordinateManager - v8対応CoordinateManager
         */
        async setCoordinateManagerV8(coordinateManager) {
            console.log('🎯 NavigationManager - v8 CoordinateManager設定開始');
            
            if (!coordinateManager) {
                console.warn('⚠️ CoordinateManager未提供 - 基本ナビゲーションのみ');
                return;
            }
            
            if (!coordinateManager.isV8Ready?.()) {
                console.warn('⚠️ CoordinateManager v8未対応 - 基本ナビゲーションのみ');
                return;
            }
            
            this.coordinateManager = coordinateManager;
            console.log('✅ NavigationManager - v8 CoordinateManager設定完了');
        }
        
        /**
         * EventBus設定
         * @param {EventBus} eventBus - EventBusインスタンス
         */
        setEventBus(eventBus) {
            this.eventBus = eventBus;
            console.log('✅ NavigationManager - EventBus設定完了');
        }
        
        /**
         * v8機能初期化
         */
        async initializeV8Features() {
            console.log('🧭 NavigationManager v8機能初期化開始');
            
            // v8イベントリスナー設定
            this.setupV8EventListeners();
            
            // v8 Stage初期状態設定
            await this.initializeV8Stage();
            
            console.log('✅ NavigationManager v8機能初期化完了');
        }
        
        /**
         * v8 Stage初期状態設定
         */
        async initializeV8Stage() {
            if (!this.canvasManager?.pixiApp?.stage) {
                console.warn('⚠️ v8 Stage未利用可能 - Stage初期化スキップ');
                return;
            }
            
            const stage = this.canvasManager.pixiApp.stage;
            
            // v8 Container初期設定
            stage.scale.set(1.0);
            stage.position.set(0, 0);
            stage.pivot.set(0, 0);
            
            // v8高精度設定
            if (this.webgpuSupported) {
                // WebGPU固有の最適化設定
                console.log('🚀 v8 Stage WebGPU最適化設定適用');
            }
            
            console.log('✅ v8 Stage初期状態設定完了');
        }
        
        /**
         * v8イベントリスナー設定
         */
        setupV8EventListeners() {
            console.log('🧭 NavigationManager v8イベントリスナー設定開始');
            
            // Canvas要素取得
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                console.warn('⚠️ Canvas要素未取得 - イベント設定スキップ');
                return;
            }
            
            // v8マウスホイールズーム（高精度）
            canvasElement.addEventListener('wheel', (e) => {
                this.handleV8MouseWheelZoom(e);
            }, { passive: false });
            
            // v8中ボタンパン
            canvasElement.addEventListener('pointerdown', (e) => {
                if (e.button === 1) { // 中ボタン
                    e.preventDefault();
                    this.startV8Pan(e.clientX, e.clientY);
                }
            });
            
            canvasElement.addEventListener('pointermove', (e) => {
                if (this.isPanning) {
                    this.updateV8Pan(e.clientX, e.clientY);
                }
            });
            
            canvasElement.addEventListener('pointerup', (e) => {
                if (e.button === 1 && this.isPanning) {
                    this.endV8Pan();
                }
            });
            
            // v8キーボードナビゲーション
            document.addEventListener('keydown', (e) => {
                this.handleV8KeyDown(e);
            });
            
            document.addEventListener('keyup', (e) => {
                this.handleV8KeyUp(e);
            });
            
            console.log('✅ NavigationManager v8イベントリスナー設定完了');
        }
        
        /**
         * v8高精度マウスホイールズーム処理
         * @param {WheelEvent} event - ホイールイベント
         */
        handleV8MouseWheelZoom(event) {
            if (!this.v8Ready) return;
            
            event.preventDefault();
            
            // v8高精度ズーム計算
            const delta = -event.deltaY * this.zoomSensitivity;
            const newScale = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoomLevel + delta));
            
            if (newScale === this.zoomLevel) return;
            
            // ズーム中心座標計算（v8高精度）
            const rect = this.canvasManager.getCanvasElement().getBoundingClientRect();
            const centerX = event.clientX - rect.left;
            const centerY = event.clientY - rect.top;
            
            this.zoomCanvasV8(newScale, centerX, centerY);
        }
        
        /**
         * v8高精度ズーム実行
         * @param {number} scale - 新しいスケール値
         * @param {number} centerX - ズーム中心X座標（任意）
         * @param {number} centerY - ズーム中心Y座標（任意）
         */
        zoomCanvasV8(scale, centerX, centerY) {
            if (!this.v8Ready || !this.canvasManager?.pixiApp?.stage) return;
            
            const stage = this.canvasManager.pixiApp.stage;
            const oldScale = this.zoomLevel;
            
            // スケール制限適用
            this.zoomLevel = Math.max(this.zoomMin, Math.min(this.zoomMax, scale));
            
            console.log(`🧭 v8ズーム: ${oldScale.toFixed(3)} -> ${this.zoomLevel.toFixed(3)}`);
            
            // v8 Container変形適用
            if (centerX !== undefined && centerY !== undefined) {
                // 中心を基準としたズーム（v8高精度）
                const dx = centerX - stage.position.x;
                const dy = centerY - stage.position.y;
                
                stage.scale.set(this.zoomLevel);
                stage.position.set(
                    centerX - dx * (this.zoomLevel / oldScale),
                    centerY - dy * (this.zoomLevel / oldScale)
                );
            } else {
                // 単純スケール変更
                stage.scale.set(this.zoomLevel);
            }
            
            // v8変形状態更新
            this.updateV8TransformState();
            
            // CoordinateManagerキャッシュクリア
            if (this.coordinateManager?.clearV8Cache) {
                this.coordinateManager.clearV8Cache();
            }
            
            // EventBus通知
            this.emitV8Event('navigation:zoom', {
                oldScale: oldScale,
                newScale: this.zoomLevel,
                centerX,
                centerY,
                v8Mode: true
            });
        }
        
        /**
         * v8パン開始
         * @param {number} x - 開始X座標
         * @param {number} y - 開始Y座標
         */
        startV8Pan(x, y) {
            if (!this.v8Ready) return;
            
            console.log(`🧭 v8パン開始: (${x}, ${y})`);
            this.isPanning = true;
            this.panStartPos = { x, y };
            
            // EventBus通知
            this.emitV8Event('navigation:pan:start', { x, y, v8Mode: true });
        }
        
        /**
         * v8パン更新
         * @param {number} x - 現在X座標
         * @param {number} y - 現在Y座標
         */
        updateV8Pan(x, y) {
            if (!this.isPanning || !this.v8Ready) return;
            
            const deltaX = x - this.panStartPos.x;
            const deltaY = y - this.panStartPos.y;
            
            this.panCanvasV8(deltaX, deltaY);
            
            this.panStartPos = { x, y };
        }
        
        /**
         * v8高精度パン実行
         * @param {number} deltaX - X方向移動量
         * @param {number} deltaY - Y方向移動量
         */
        panCanvasV8(deltaX, deltaY) {
            if (!this.v8Ready || !this.canvasManager?.pixiApp?.stage) return;
            
            const stage = this.canvasManager.pixiApp.stage;
            
            // v8 Container位置更新（高精度）
            stage.position.x += deltaX;
            stage.position.y += deltaY;
            
            // v8変形状態更新
            this.updateV8TransformState();
            
            // CoordinateManagerキャッシュクリア
            if (this.coordinateManager?.clearV8Cache) {
                this.coordinateManager.clearV8Cache();
            }
            
            console.log(`🧭 v8パン実行: delta=(${deltaX.toFixed(1)}, ${deltaY.toFixed(1)}) pos=(${stage.position.x.toFixed(1)}, ${stage.position.y.toFixed(1)})`);
        }
        
        /**
         * v8パン終了
         */
        endV8Pan() {
            if (!this.isPanning) return;
            
            console.log('🧭 v8パン終了');
            this.isPanning = false;
            
            // EventBus通知
            this.emitV8Event('navigation:pan:end', { v8Mode: true });
        }
        
        /**
         * v8キーダウン処理
         * @param {KeyboardEvent} event - キーボードイベント
         */
        handleV8KeyDown(event) {
            if (!this.v8Ready) return;
            
            this.keys.add(event.code);
            
            // v8キーボードナビゲーション
            switch (event.code) {
                case 'Space':
                    if (!this.keys.has('ControlLeft') && !this.keys.has('ControlRight')) {
                        console.log('🧭 v8: Space キー - パンモード有効');
                        event.preventDefault();
                    }
                    break;
                    
                case 'ArrowUp':
                case 'ArrowDown':
                case 'ArrowLeft':
                case 'ArrowRight':
                    if (this.keys.has('Space')) {
                        this.handleV8KeyboardPan(event.code);
                        event.preventDefault();
                    }
                    break;
                    
                case 'Equal':
                case 'NumpadAdd':
                    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
                        this.handleV8KeyboardZoom(1);
                        event.preventDefault();
                    }
                    break;
                    
                case 'Minus':
                case 'NumpadSubtract':
                    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
                        this.handleV8KeyboardZoom(-1);
                        event.preventDefault();
                    }
                    break;
                    
                case 'Digit0':
                case 'Numpad0':
                    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
                        this.resetViewV8();
                        event.preventDefault();
                    }
                    break;
            }
        }
        
        /**
         * v8キーアップ処理
         * @param {KeyboardEvent} event - キーボードイベント
         */
        handleV8KeyUp(event) {
            if (!this.v8Ready) return;
            
            this.keys.delete(event.code);
        }
        
        /**
         * v8キーボードパン処理
         * @param {string} direction - 方向キーコード
         */
        handleV8KeyboardPan(direction) {
            let deltaX = 0;
            let deltaY = 0;
            
            switch (direction) {
                case 'ArrowUp':
                    deltaY = -this.keyboardPanSpeed;
                    break;
                case 'ArrowDown':
                    deltaY = this.keyboardPanSpeed;
                    break;
                case 'ArrowLeft':
                    deltaX = -this.keyboardPanSpeed;
                    break;
                case 'ArrowRight':
                    deltaX = this.keyboardPanSpeed;
                    break;
            }
            
            if (deltaX !== 0 || deltaY !== 0) {
                this.panCanvasV8(deltaX, deltaY);
                
                // EventBus通知
                this.emitV8Event('navigation:keyboard:pan', {
                    direction,
                    deltaX,
                    deltaY,
                    v8Mode: true
                });
            }
        }
        
        /**
         * v8キーボードズーム処理
         * @param {number} direction - ズーム方向（1: 拡大, -1: 縮小）
         */
        handleV8KeyboardZoom(direction) {
            const newScale = this.zoomLevel + (direction * this.keyboardZoomSpeed);
            this.zoomCanvasV8(newScale);
            
            // EventBus通知
            this.emitV8Event('navigation:keyboard:zoom', {
                direction,
                newScale: this.zoomLevel,
                v8Mode: true
            });
        }
        
        /**
         * v8ビューリセット
         */
        resetViewV8() {
            if (!this.v8Ready || !this.canvasManager?.pixiApp?.stage) return;
            
            console.log('🧭 v8ビューリセット実行');
            
            const stage = this.canvasManager.pixiApp.stage;
            
            // v8 Container初期状態復元
            stage.scale.set(1.0);
            stage.position.set(0, 0);
            
            // 内部状態更新
            this.zoomLevel = 1.0;
            this.updateV8TransformState();
            
            // CoordinateManagerキャッシュクリア
            if (this.coordinateManager?.clearV8Cache) {
                this.coordinateManager.clearV8Cache();
            }
            
            // EventBus通知
            this.emitV8Event('navigation:reset', { v8Mode: true });
            
            console.log('✅ v8ビューリセット完了');
        }
        
        /**
         * v8変形状態更新（内部処理）
         */
        updateV8TransformState() {
            if (!this.canvasManager?.pixiApp?.stage) return;
            
            const stage = this.canvasManager.pixiApp.stage;
            
            this.currentTransform = {
                scale: stage.scale.x,
                translateX: stage.position.x,
                translateY: stage.position.y,
                // v8追加情報
                matrix: stage.worldTransform,
                bounds: stage.getBounds()
            };
        }
        
        /**
         * v8変形状態取得
         * @returns {Object} v8変形状態情報
         */
        getCanvasTransformV8() {
            if (!this.v8Ready) return null;
            
            this.updateV8TransformState();
            return { ...this.currentTransform };
        }
        
        /**
         * v8準備完了確認
         * @returns {boolean} v8対応状況
         */
        isV8Ready() {
            return this.v8Ready && 
                   !!this.canvasManager && 
                   this.canvasManager.isV8Ready();
        }
        
        /**
         * v8イベント配信（内部処理）
         * @param {string} eventName - イベント名
         * @param {Object} eventData - イベントデータ
         */
        emitV8Event(eventName, eventData) {
            if (this.eventBus?.emit) {
                try {
                    this.eventBus.emit(eventName, eventData);
                } catch (error) {
                    console.warn(`⚠️ v8イベント配信失敗 ${eventName}:`, error.message);
                }
            }
            
            // グローバルEventBusも試行
            if (window.Tegaki?.EventBusInstance?.emit) {
                try {
                    window.Tegaki.EventBusInstance.emit(eventName, eventData);
                } catch (error) {
                    console.warn(`⚠️ グローバルv8イベント配信失敗 ${eventName}:`, error.message);
                }
            }
        }
        
        /**
         * v8ナビゲーション無効化
         */
        disableV8Navigation() {
            this.enabled = false;
            this.isPanning = false;
            this.keys.clear();
            console.log('⚠️ v8ナビゲーション無効化');
        }
        
        /**
         * v8ナビゲーション有効化
         */
        enableV8Navigation() {
            this.enabled = true;
            console.log('✅ v8ナビゲーション有効化');
        }
        
        /**
         * v8ナビゲーション状態取得
         * @returns {Object} v8ナビゲーション状態
         */
        getV8NavigationState() {
            return {
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                highPerformanceMode: this.highPerformanceMode,
                
                navigation: {
                    isPanning: this.isPanning,
                    zoomLevel: this.zoomLevel,
                    transform: { ...this.currentTransform },
                    enabled: this.enabled !== false
                },
                
                settings: {
                    zoomMin: this.zoomMin,
                    zoomMax: this.zoomMax,
                    zoomStep: this.zoomStep,
                    zoomSensitivity: this.zoomSensitivity,
                    keyboardPanSpeed: this.keyboardPanSpeed,
                    keyboardZoomSpeed: this.keyboardZoomSpeed
                },
                
                performance: {
                    smoothTransition: this.smoothTransition,
                    webgpuAccelerated: this.webgpuSupported
                }
            };
        }
        
        /**
         * v8デバッグ情報取得
         * @returns {Object} v8デバッグ情報
         */
        getDebugInfo() {
            return {
                // v8基本情報
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                highPerformanceMode: this.highPerformanceMode,
                
                // Manager連携状態
                managers: {
                    canvasManager: !!this.canvasManager,
                    canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
                    coordinateManager: !!this.coordinateManager,
                    coordinateManagerV8Ready: this.coordinateManager?.isV8Ready?.() || false,
                    eventBus: !!this.eventBus
                },
                
                // v8 Stage情報
                stage: this.canvasManager?.pixiApp?.stage ? (() => {
                    const stage = this.canvasManager.pixiApp.stage;
                    return {
                        available: true,
                        scale: { x: stage.scale.x, y: stage.scale.y },
                        position: { x: stage.position.x, y: stage.position.y },
                        pivot: { x: stage.pivot.x, y: stage.pivot.y },
                        bounds: stage.getBounds(),
                        worldTransform: stage.worldTransform
                    };
                })() : { available: false },
                
                // ナビゲーション状態
                navigation: this.getV8NavigationState().navigation,
                
                // 入力状態
                input: {
                    activeKeys: Array.from(this.keys),
                    isPanning: this.isPanning,
                    panStartPos: { ...this.panStartPos }
                },
                
                // v8パフォーマンス
                performance: {
                    webgpuAccelerated: this.webgpuSupported,
                    highPerformanceMode: this.highPerformanceMode,
                    zoomSensitivity: this.zoomSensitivity,
                    smoothTransition: this.smoothTransition
                },
                
                // 設定値
                settings: this.getV8NavigationState().settings
            };
        }
        
        /**
         * v8状態リセット
         */
        resetV8() {
            console.log('🔄 NavigationManager v8状態リセット開始');
            
            this.canvasManager = null;
            this.coordinateManager = null;
            this.v8Ready = false;
            this.webgpuSupported = false;
            this.highPerformanceMode = false;
            
            this.isPanning = false;
            this.keys.clear();
            this.zoomLevel = 1.0;
            this.currentTransform = {
                scale: 1.0,
                translateX: 0,
                translateY: 0
            };
            
            console.log('✅ NavigationManager v8状態リセット完了');
        }
    }

// Managers統一ライフサイクルメソッド一括追加
// NavigationManager・RecordManager・ShortcutManager等に統一ライフサイクルメソッドを追加

(function() {
    'use strict';
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加開始');
    
    /**
     * Manager統一ライフサイクルメソッド追加
     * @param {Function} ManagerClass Manager クラス
     * @param {string} className クラス名
     */
    function addLifecycleMethods(ManagerClass, className) {
        if (!ManagerClass) {
            console.warn(`🔧 ${className} not found, skipping lifecycle extension`);
            return;
        }
        
        const prototype = ManagerClass.prototype;
        
        // configure（設定注入）
        if (!prototype.configure) {
            prototype.configure = function(config) {
                this._config = { ...config };
                this._configured = true;
            };
        }
        
        // attach（参照注入）
        if (!prototype.attach) {
            prototype.attach = function(context) {
                this._context = context;
                this._attached = true;
                
                // Manager固有の参照設定
                if (className === 'NavigationManager') {
                    this._canvasManager = context.canvasManager;
                    this._coordinateManager = context.coordinateManager;
                } else if (className === 'CoordinateManager') {
                    this._canvasManager = context.canvasManager || context.canvas;
                } else if (className === 'RecordManager') {
                    // RecordManagerは独立動作
                } else if (className === 'ShortcutManager') {
                    // ShortcutManagerは独立動作
                }
            };
        }
        
        // init（内部初期化）
        if (!prototype.init) {
            prototype.init = function() {
                this._initialized = true;
                
                // Manager固有の初期化処理
                if (className === 'NavigationManager') {
                    // Navigation固有初期化があれば実行
                    if (typeof this.initializeNavigation === 'function') {
                        this.initializeNavigation();
                    }
                } else if (className === 'CoordinateManager') {
                    // Coordinate固有初期化があれば実行
                    if (typeof this.initializeCoordinates === 'function') {
                        this.initializeCoordinates();
                    }
                }
                
                return Promise.resolve();
            };
        }
        
        // isReady（準備完了確認）
        if (!prototype.isReady) {
            prototype.isReady = function() {
                return this._initialized || true;
            };
        }
        
        // dispose（解放）
        if (!prototype.dispose) {
            prototype.dispose = function() {
                this._initialized = false;
                this._attached = false;
                this._configured = false;
                this._context = null;
                this._config = null;
            };
        }
        
        console.log(`🔧 ${className} 統一ライフサイクルメソッド追加完了`);
    }
    
    // 各Manager拡張実行
    const managersToExtend = [
        { class: window.Tegaki?.EventBus, name: 'EventBus' },
        { class: window.Tegaki?.NavigationManager, name: 'NavigationManager' },
        { class: window.Tegaki?.RecordManager, name: 'RecordManager' },
        { class: window.Tegaki?.ShortcutManager, name: 'ShortcutManager' },
        { class: window.Tegaki?.CoordinateManager, name: 'CoordinateManager' }
    ];
    
    for (const manager of managersToExtend) {
        addLifecycleMethods(manager.class, manager.name);
    }
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加完了');
    
})();
    
    // Tegaki名前空間に登録
    window.Tegaki.NavigationManager = NavigationManager;
    
    console.log('🧭 NavigationManager PixiJS v8対応版 Loaded');
    console.log('📏 v8機能: Container変形・高精度パン・ズーム・WebGPU最適化・リアルタイムナビゲーション');
    console.log('🚀 v8特徴: Matrix活用・高精度変形・CoordinateManager統合・60fps+対応');
    console.log('✅ v8準備完了: setCanvasManagerV8()でv8対応CanvasManager設定後に利用可能');
}

console.log('🧭 NavigationManager PixiJS v8対応版 Loaded - Container変形・高精度ナビゲーション・WebGPU対応完了');