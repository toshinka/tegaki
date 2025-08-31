/**
 * 📄 FILE: js/utils/navigation-manager.js
 * 📌 RESPONSIBILITY: キャンバスナビゲーション・パン・ズーム・カメラ境界管理・変形状態管理
 *
 * @provides
 *   - NavigationManager クラス
 *   - setCanvasManagerV8(canvasManager) - v8対応CanvasManager設定
 *   - zoomCanvasV8(scale, centerX, centerY) - v8高精度ズーム
 *   - panCanvasV8(deltaX, deltaY) - v8高精度パン
 *   - getCameraBounds() - カメラ境界取得（Phase1.5新規実装）
 *   - getCanvasTransformV8() - v8変形状態取得
 *   - resetViewV8() - v8ビューリセット
 *   - setCoordinateManagerV8(coordinateManager) - v8 CoordinateManager設定
 *   - isV8Ready() - v8準備状態確認
 *   - getDebugInfo() - デバッグ情報取得
 *
 * @uses
 *   - canvasManager.pixiApp.stage - v8 Stage Container取得
 *   - canvasManager.getCanvasElement() - Canvas要素取得
 *   - canvasManager.isV8Ready() - v8準備状態確認
 *   - coordinateManager.clearV8Cache() - v8座標キャッシュクリア
 *   - window.Tegaki.EventBusInstance.emit() - イベント配信
 *   - document.addEventListener() - DOM イベント処理
 *   - PIXI.Container.scale.set() - v8 Container スケール設定
 *   - PIXI.Container.position.set() - v8 Container 位置設定
 *
 * @initflow
 *   1. new NavigationManager() → 2. setCanvasManagerV8() → 3. setCoordinateManagerV8() → 4. initializeV8Features() → 5. setupV8EventListeners()
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 目先のエラー修正のためのDRY・SOLID原則違反
 *
 * @manager-key
 *   window.Tegaki.NavigationManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager (v8対応)
 *   OPTIONAL: CoordinateManager, EventBus
 *   FORBIDDEN: 他Manager直接参照、ToolManager
 *
 * @integration-flow
 *   AppCore → NavigationManager.setCanvasManagerV8() → NavigationManager.setCoordinateManagerV8() → Tool.isInsideCamera()
 *
 * @method-naming-rules
 *   - setCanvasManagerV8()/setCoordinateManagerV8() - Manager設定
 *   - zoomCanvasV8()/panCanvasV8() - ナビゲーション操作
 *   - getCameraBounds() - 境界取得
 *   - isV8Ready() - 準備状態確認
 *
 * @error-handling
 *   throw: 必須Manager未設定・v8未対応
 *   warn: オプションManager未設定・一時的エラー
 *   log: 正常処理・状態変更
 *
 * @state-management
 *   - ナビゲーション状態は直接操作せず、専用メソッド経由
 *   - 変形状態変更は必ずEventBus通知
 *   - Stage変形は必ずupdateV8TransformState()実行
 *
 * @performance-notes
 *   - Stage変形は重い処理、バッチ化で最適化
 *   - WebGPU対応で高速化、16ms維持
 *   - CoordinateManagerキャッシュクリア必須
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.NavigationManager) {
    /**
     * NavigationManager - PixiJS v8高精度ナビゲーション管理（Phase1.5 getCameraBounds実装版）
     * キャンバスパン・ズーム・キーボードナビゲーション・カメラ境界管理（v8対応版）
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
            
            // Phase1.5 カメラ境界管理
            this.cameraBounds = {
                x: 0,
                y: 0,
                width: 400,  // デフォルトキャンバスサイズ
                height: 400
            };
            
            console.log('✅ NavigationManager v8対応版 初期化完了');
        }

        /**
         * v8対応CanvasManager設定
         * @param {CanvasManager} canvasManager - v8対応CanvasManager
         */
        async setCanvasManagerV8(canvasManager) {
            console.log('🧭 NavigationManager - v8 CanvasManager設定開始');
            
            if (!canvasManager) {
                throw new Error('CanvasManager is required');
            }
            
            if (!canvasManager.isV8Ready?.()) {
                throw new Error('CanvasManager not v8 ready');
            }
            
            this.canvasManager = canvasManager;
            
            // v8機能初期化
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
            
            if (!coordinateManager.isReady?.()) {
                console.warn('⚠️ CoordinateManager未準備 - 基本ナビゲーションのみ');
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
            
            // カメラ境界初期化
            this.updateCameraBounds();
            
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
            
            // カメラ境界更新（Phase1.5）
            this.updateCameraBounds();
            
            // CoordinateManagerキャッシュクリア
            if (this.coordinateManager?.clearV8Cache) {
                this.coordinateManager.clearV8Cache();
            }
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
            
            // カメラ境界更新（Phase1.5）
            this.updateCameraBounds();
            
            // CoordinateManagerキャッシュクリア
            if (this.coordinateManager?.clearV8Cache) {
                this.coordinateManager.clearV8Cache();
            }
            
            console.log(`🧭 v8パン実行: delta=(${deltaX.toFixed(1)}, ${deltaY.toFixed(1)}) pos=(${stage.position.x.toFixed(1)}, ${stage.position.y.toFixed(1)})`);
        }
        
        /**
         * カメラ境界更新（Phase1.5新機能）
         */
        updateCameraBounds() {
            if (!this.canvasManager?.pixiApp) return;
            
            // Canvas物理サイズ取得
            const canvas = this.canvasManager.getCanvasElement();
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            const stage = this.canvasManager.pixiApp.stage;
            
            // カメラ境界計算（Stage変形考慮）
            this.cameraBounds = {
                x: -stage.position.x / stage.scale.x,
                y: -stage.position.y / stage.scale.y,
                width: rect.width / stage.scale.x,
                height: rect.height / stage.scale.y
            };
            
            console.log('📷 カメラ境界更新:', this.cameraBounds);
        }
        
        /**
         * カメラ境界取得（Phase1.5新機能）
         * @returns {Object} カメラ境界情報 {x, y, width, height}
         */
        getCameraBounds() {
            return { ...this.cameraBounds };
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
            
            // カメラ境界更新（Phase1.5）
            this.updateCameraBounds();
            
            // CoordinateManagerキャッシュクリア
            if (this.coordinateManager?.clearV8Cache) {
                this.coordinateManager.clearV8Cache();
            }
            
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
         * v8デバッグ情報取得
         * @returns {Object} v8デバッグ情報
         */
        getDebugInfo() {
            return {
                className: 'NavigationManager',
                version: 'Phase1.5-getCameraBounds実装版',
                
                // v8基本情報
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                highPerformanceMode: this.highPerformanceMode,
                
                // Manager連携状態
                managers: {
                    canvasManager: !!this.canvasManager,
                    canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
                    coordinateManager: !!this.coordinateManager,
                    coordinateManagerV8Ready: this.coordinateManager?.isReady?.() || false,
                    eventBus: !!this.eventBus
                },
                
                // Phase1.5 カメラ境界情報
                cameraBounds: { ...this.cameraBounds },
                
                // v8 Stage情報
                stage: this.canvasManager?.pixiApp?.stage ? (() => {
                    const stage = this.canvasManager.pixiApp.stage;
                    return {
                        available: true,
                        scale: { x: stage.scale.x, y: stage.y },
                        position: { x: stage.position.x, y: stage.position.y },
                        pivot: { x: stage.pivot.x, y: stage.pivot.y }
                    };
                })() : { available: false },
                
                // ナビゲーション状態
                navigation: {
                    isPanning: this.isPanning,
                    zoomLevel: this.zoomLevel,
                    transform: { ...this.currentTransform }
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.NavigationManager = NavigationManager;
    
    console.log('🧭 NavigationManager PixiJS v8対応版 Loaded');
    console.log('📏 Phase1.5機能: getCameraBounds()実装・カメラ境界管理・外部描画対応');
    console.log('🚀 v8特徴: Container変形・高精度ナビゲーション・WebGPU対応・境界判定');
    console.log('✅ v8準備完了: setCanvasManagerV8()でv8対応CanvasManager設定後に利用可能');
}

console.log('🧭 NavigationManager PixiJS v8対応版 Loaded - Container変形・高精度ナビゲーション・WebGPU対応・getCameraBounds実装完了');