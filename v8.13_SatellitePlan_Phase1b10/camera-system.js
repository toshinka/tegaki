// ===== camera-system.js - カメラ・ビューポート制御システム（PixiJS v8.13対応） + 静的互換ラッパー =====
// core-engine.jsから分割 - 無限キャンバス対応の視点制御に特化
// レイヤー状態には一切影響を与えない純粋なビュー操作

/*
=== CameraSystemの責務 ===
- ビューポートのパン・ズーム・回転
- 無限キャンバスの視点制御
- 座標変換（screen↔world↔canvas）
- カメラフレーム・ガイドライン表示
- マウス・キーボード・タッチ操作のハンドリング
- カメラ状態の保存・復元

=== 重要な設計方針 ===
- レイヤー編集には一切関与しない
- レイヤーのTransformは変更しない
- 純粋なビュー座標変換のみ
- 他システムとの疎結合

=== APIデザイン ===
- init(app, worldContainer): 初期化（静的メソッド）
- panTo(x, y): 指定座標へパン
- panBy(dx, dy): 相対パン
- zoomTo(scale): 指定倍率へズーム
- zoomBy(factor): 相対ズーム
- resetView(): ビューリセット
- screenToWorld(x, y): screen→world座標変換
- worldToScreen(x, y): world→screen座標変換
- screenToCanvas(x, y): screen→canvas座標変換（描画用）
*/

(function() {
    'use strict';
    
    // === 設定とユーティリティ ===
    const CONFIG = window.TEGAKI_CONFIG;
    const CoordinateSystem = window.CoordinateSystem;
    
    if (!CONFIG) {
        throw new Error('TEGAKI_CONFIG is required for CameraSystem');
    }
    
    const debug = (message, ...args) => {
        if (CONFIG.debug) {
            console.log(`[CameraSystem] ${message}`, ...args);
        }
    };

    // === EventBusシンプル実装 ===
    class SimpleEventBus {
        constructor() {
            this.listeners = new Map();
        }
        
        on(eventName, callback) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(callback);
        }
        
        off(eventName, callback) {
            if (!this.listeners.has(eventName)) return;
            const listeners = this.listeners.get(eventName);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        
        emit(eventName, payload) {
            if (!this.listeners.has(eventName)) return;
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`CameraSystem EventBus error in ${eventName}:`, error);
                }
            });
        }
    }

    // === カメラ状態管理 ===
    class CameraState {
        constructor() {
            this.position = { x: 0, y: 0 };
            this.scale = CONFIG.camera.initialScale;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            this.bounds = null; // カメラ移動制限（将来用）
        }
        
        /**
         * カメラ状態をJSON形式にシリアライズ
         */
        serialize() {
            return {
                position: { ...this.position },
                scale: this.scale,
                rotation: this.rotation,
                horizontalFlipped: this.horizontalFlipped,
                verticalFlipped: this.verticalFlipped,
                bounds: this.bounds
            };
        }
        
        /**
         * JSON形式からカメラ状態を復元
         */
        static deserialize(data) {
            const state = new CameraState();
            state.position = data.position || { x: 0, y: 0 };
            state.scale = data.scale || CONFIG.camera.initialScale;
            state.rotation = data.rotation || 0;
            state.horizontalFlipped = data.horizontalFlipped || false;
            state.verticalFlipped = data.verticalFlipped || false;
            state.bounds = data.bounds || null;
            return state;
        }
        
        /**
         * 初期状態へのリセット
         */
        reset() {
            this.position = { x: 0, y: 0 };
            this.scale = CONFIG.camera.initialScale;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            this.bounds = null;
        }
    }

    // === メインCameraSystemクラス ===
    class CameraSystemInstance {
        constructor() {
            this.app = null;
            this.worldContainer = null;
            this.canvasContainer = null;
            
            this.state = new CameraState();
            this.initialState = new CameraState();
            
            this.eventBus = new SimpleEventBus();
            
            // 操作状態管理
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPointerPos = { x: 0, y: 0 };
            
            // キー状態管理
            this.keysPressed = new Set();
            this.spacePressed = false;
            this.shiftPressed = false;
            
            // 外部システム連携
            this.layerSystemActive = false; // レイヤー操作モード検出用
            
            // 設定
            this.panSpeed = CONFIG.camera.dragMoveSpeed;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            this.rotationSpeed = CONFIG.camera.dragRotationSpeed;
            this.scaleSpeed = CONFIG.camera.dragScaleSpeed;
        }
        
        /**
         * CameraSystemの初期化
         * @param {PIXI.Application} app - PixiJSアプリケーション
         * @param {PIXI.Container} worldContainer - ワールドコンテナ
         */
        init(app, worldContainer) {
            this.app = app;
            this.worldContainer = worldContainer;
            
            // CanvasContainerの設定または作成
            this.canvasContainer = this.worldContainer.children.find(child => child.name === 'canvasContainer');
            if (!this.canvasContainer) {
                this.canvasContainer = new PIXI.Container();
                this.canvasContainer.name = 'canvasContainer';
                this.worldContainer.addChild(this.canvasContainer);
            }
            
            // CoordinateSystemに安全参照を設定
            if (CoordinateSystem && CoordinateSystem.setContainers) {
                CoordinateSystem.setContainers({
                    app: this.app,
                    worldContainer: this.worldContainer,
                    canvasContainer: this.canvasContainer
                });
            }
            
            // イベントハンドラーの設定
            this.setupEventHandlers();
            
            // 初期カメラ位置の設定
            this.initializeCamera();
            
            debug('CameraSystem initialized');
            return this;
        }
        
        /**
         * 初期カメラ位置の設定
         */
        initializeCamera() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            // キャンバスを画面中央に配置
            const initialX = centerX - CONFIG.canvas.width / 2;
            const initialY = centerY - CONFIG.canvas.height / 2;
            
            this.state.position.x = initialX;
            this.state.position.y = initialY;
            
            // 初期状態を保存
            this.initialState.position = { ...this.state.position };
            this.initialState.scale = this.state.scale;
            
            // WorldContainerに適用
            this.applyStateToWorldContainer();
            
            debug('Camera initialized at', this.state.position);
        }
        
        /**
         * カメラ状態をWorldContainerに適用
         */
        applyStateToWorldContainer() {
            this.worldContainer.position.set(this.state.position.x, this.state.position.y);
            this.worldContainer.scale.set(
                this.state.scale * (this.state.horizontalFlipped ? -1 : 1),
                this.state.scale * (this.state.verticalFlipped ? -1 : 1)
            );
            this.worldContainer.rotation = this.state.rotation;
            
            // UI更新通知
            this.eventBus.emit('camera-moved', {
                position: { ...this.state.position },
                scale: this.state.scale,
                rotation: this.state.rotation
            });
        }
        
        /**
         * ビューのリセット
         */
        resetView() {
            this.state.position = { ...this.initialState.position };
            this.state.scale = this.initialState.scale;
            this.state.rotation = 0;
            this.state.horizontalFlipped = false;
            this.state.verticalFlipped = false;
            
            this.applyStateToWorldContainer();
            
            debug('Camera reset to initial state');
        }
        
        /**
         * イベントハンドラーの設定
         */
        setupEventHandlers() {
            // リサイズ処理
            window.addEventListener('resize', () => {
                const screenWidth = window.innerWidth - 50;
                const screenHeight = window.innerHeight;
                
                this.app.renderer.resize(screenWidth, screenHeight);
                if (this.app.canvas) {
                    this.app.canvas.style.width = `${screenWidth}px`;
                    this.app.canvas.style.height = `${screenHeight}px`;
                }
                
                // カメラ位置の再計算
                this.initializeCamera();
                
                this.eventBus.emit('window-resized', { width: screenWidth, height: screenHeight });
            });
            
            debug('Camera event handlers set up');
        }
        
        /**
         * イベントリスナー追加
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        on(eventName, callback) {
            this.eventBus.on(eventName, callback);
        }
        
        /**
         * イベントリスナー削除
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        off(eventName, callback) {
            this.eventBus.off(eventName, callback);
        }
        
        /**
         * デバッグ情報取得
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                state: this.state.serialize(),
                interactions: {
                    isDragging: this.isDragging,
                    isScaleRotateDragging: this.isScaleRotateDragging,
                    layerSystemActive: this.layerSystemActive,
                    spacePressed: this.spacePressed,
                    shiftPressed: this.shiftPressed
                },
                containers: {
                    worldContainer: !!this.worldContainer,
                    canvasContainer: !!this.canvasContainer
                }
            };
        }
    }

    // === 静的CameraSystem（シングルトンパターン） ===
    let cameraSystemInstance = null;
    
    const CameraSystem = {
        /**
         * 静的初期化メソッド（互換性ラッパー）
         * @param {PIXI.Application} app - PixiJSアプリケーション
         * @param {PIXI.Container} worldContainer - ワールドコンテナ
         * @returns {CameraSystemInstance}
         */
        init(app, worldContainer) {
            if (cameraSystemInstance) {
                console.warn('CameraSystem already initialized');
                return cameraSystemInstance;
            }
            
            cameraSystemInstance = new CameraSystemInstance();
            cameraSystemInstance.init(app, worldContainer);
            
            debug('CameraSystem static wrapper initialized');
            return cameraSystemInstance;
        },
        
        /**
         * インスタンス取得
         * @returns {CameraSystemInstance|null}
         */
        getInstance() {
            return cameraSystemInstance;
        },
        
        /**
         * ビューリセット（静的メソッド）
         */
        resetView() {
            if (!cameraSystemInstance) {
                console.error('CameraSystem not initialized');
                return;
            }
            cameraSystemInstance.resetView();
        },
        
        /**
         * イベントリスナー追加（静的メソッド）
         * @param {string} eventName
         * @param {Function} callback
         */
        on(eventName, callback) {
            if (!cameraSystemInstance) {
                console.error('CameraSystem not initialized');
                return;
            }
            cameraSystemInstance.on(eventName, callback);
        },
        
        /**
         * イベントリスナー削除（静的メソッド）
         * @param {string} eventName
         * @param {Function} callback
         */
        off(eventName, callback) {
            if (!cameraSystemInstance) {
                console.error('CameraSystem not initialized');
                return;
            }
            cameraSystemInstance.off(eventName, callback);
        }
    };

    // === グローバル公開 ===
    window.CameraSystem = CameraSystem;
    window.CameraSystemInstance = CameraSystemInstance;
    window.CameraState = CameraState;

    debug('CameraSystem module loaded (with static compatibility wrapper)');

})();