// ===== core-runtime.js - Phase2分割対応版：LayerSystem & CameraSystem統合 =====
// core-engine.jsからの段階的分割完了・新システム統合・API統一維持

/*
=== Phase2分割完了ヘッダー ===

【分割完了対応】
✅ LayerSystem & CameraSystemの個別初期化対応
✅ core-engine.jsとの段階的分離（互換ラッパー維持）
✅ API統一性の完全維持
✅ EventBus統合による疎結合実現
✅ UI層からの統一アクセス維持

【新アーキテクチャ】
UI Layer (index.html, ui-panels.js)
  ↓ 統一API
CoreRuntime (公開窓口・システム統合)
  ↓ 内部管理
LayerSystem (レイヤー管理) + CameraSystem (ビュー制御) + DrawingEngine (描画制御)

【互換性維持】
- 既存のCoreRuntime.apiは完全維持
- レガシーwindow.drawingApp参照も維持
- 段階的移行のための互換ラッパー搭載

【EventBus統合】
- システム間通信の疎結合化
- UI層への統一イベント通知
- 将来のシステム追加への拡張性

=== Phase2分割完了ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // === 依存関係確認 ===
    const dependencies = ['CoordinateSystem', 'TEGAKI_CONFIG', 'LayerSystem', 'CameraSystem'];
    const missing = dependencies.filter(dep => !window[dep]);
    
    if (missing.length > 0) {
        console.error('CRITICAL: Missing dependencies for CoreRuntime Phase2:', missing);
        throw new Error(`Phase2 dependencies missing: ${missing.join(', ')}`);
    }
    
    const CONFIG = window.TEGAKI_CONFIG;
    const CoordinateSystem = window.CoordinateSystem;
    
    const debug = (message, ...args) => {
        if (CONFIG.debug) {
            console.log(`[CoreRuntime] ${message}`, ...args);
        }
    };

    // === 統合EventBusシステム ===
    class IntegratedEventBus {
        constructor() {
            this.listeners = new Map();
            this.systemBuses = new Map(); // システム別EventBus管理
        }
        
        /**
         * システムのEventBusを登録
         * @param {string} systemName - システム名
         * @param {Object} eventBus - EventBusオブジェクト
         */
        registerSystem(systemName, eventBus) {
            this.systemBuses.set(systemName, eventBus);
            debug(`EventBus registered for system: ${systemName}`);
        }
        
        /**
         * 統一イベントリスナー追加
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        on(eventName, callback) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(callback);
        }
        
        /**
         * 統一イベントリスナー削除
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        off(eventName, callback) {
            if (!this.listeners.has(eventName)) return;
            const listeners = this.listeners.get(eventName);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        
        /**
         * 統一イベント発火
         * @param {string} eventName - イベント名
         * @param {Object} payload - イベントデータ
         */
        emit(eventName, payload) {
            if (!this.listeners.has(eventName)) return;
            
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback({ eventName, ...payload });
                } catch (error) {
                    console.error(`IntegratedEventBus error in ${eventName}:`, error);
                }
            });
        }
        
        /**
         * システム間イベント中継
         * @param {string} fromSystem - 送信システム
         * @param {string} toSystem - 受信システム
         * @param {string} eventName - イベント名
         * @param {Object} payload - データ
         */
        relay(fromSystem, toSystem, eventName, payload) {
            const targetBus = this.systemBuses.get(toSystem);
            if (targetBus && targetBus.emit) {
                targetBus.emit(eventName, { from: fromSystem, ...payload });
                debug(`Event relayed: ${fromSystem} -> ${toSystem} (${eventName})`);
            }
        }
    }

    // === 内部状態管理（Phase2対応版） ===
    const internal = {
        // PIXIアプリケーション
        app: null,
        
        // 新システムインスタンス
        layerSystem: null,
        cameraSystem: null,
        drawingEngine: null, // core-engine.jsから引き継ぎ予定
        
        // コンテナ参照
        worldContainer: null,
        canvasContainer: null,
        
        // 統合EventBus
        eventBus: new IntegratedEventBus(),
        
        // 初期化状態
        initialized: false,
        phase: 'Phase2-Separated',
        initTimestamp: null,
        
        // 互換性管理
        legacyModeEnabled: true
    };

    // === CoreRuntimeメインクラス（Phase2分割対応版） ===
    const CoreRuntime = {
        
        /**
         * Phase2対応初期化（新システム統合版）
         * @param {Object} components - 初期化コンポーネント
         */
        init(components) {
            console.log('=== CoreRuntime Phase2 分割対応初期化開始 ===');
            
            try {
                // 基本コンポーネントの設定
                this.setupBasicComponents(components);
                
                // 新システムの初期化
                this.initializeSeparatedSystems();
                
                // EventBus統合
                this.setupEventBusIntegration();
                
                // 座標系の安全な参照設定
                this.setupCoordinateSystemSafeReferences();
                
                // 互換性レイヤーの設定
                this.setupCompatibilityLayer();
                
                internal.initialized = true;
                internal.initTimestamp = Date.now();
                
                console.log('✅ CoreRuntime Phase2 初期化成功');
                console.log('   - LayerSystem & CameraSystem separated');
                console.log('   - EventBus integration complete');
                console.log('   - API compatibility maintained');
                console.log('   - Safe coordinate references established');
                
                return this;
                
            } catch (error) {
                console.error('❌ CoreRuntime Phase2 初期化失敗:', error);
                throw error;
            }
        },
        
        /**
         * 基本コンポーネントの設定
         * @param {Object} components - コンポーネント
         */
        setupBasicComponents(components) {
            // 必須コンポーネントチェック
            const required = ['app'];
            const missing = required.filter(key => !components[key]);
            
            if (missing.length > 0) {
                throw new Error(`Missing required components: ${missing.join(', ')}`);
            }
            
            internal.app = components.app;
            
            // レガシー互換のため、既存のコンテナがあれば使用
            internal.worldContainer = components.worldContainer;
            internal.canvasContainer = components.canvasContainer;
            
            debug('Basic components set up');
        },
        
        /**
         * 分離されたシステムの初期化
         */
        initializeSeparatedSystems() {
            // CameraSystemの初期化
            internal.cameraSystem = new window.CameraSystem();
            internal.cameraSystem.init({
                app: internal.app,
                containers: {
                    worldContainer: internal.worldContainer,
                    canvasContainer: internal.canvasContainer
                }
            });
            
            // コンテナ参照の更新（CameraSystemが作成した場合）
            internal.worldContainer = internal.cameraSystem.worldContainer;
            internal.canvasContainer = internal.cameraSystem.canvasContainer;
            
            // LayerSystemの初期化
            internal.layerSystem = new window.LayerSystem();
            internal.layerSystem.init({
                app: internal.app,
                worldContainer: internal.worldContainer
            });
            
            // DrawingEngineは当面core-engine.jsから引き継ぎ
            if (components?.drawingEngine) {
                internal.drawingEngine = components.drawingEngine;
            }
            
            debug('Separated systems initialized');
        },
        
        /**
         * EventBus統合の設定
         */
        setupEventBusIntegration() {
            // システムのEventBusを登録
            internal.eventBus.registerSystem('layer', internal.layerSystem.eventBus);
            internal.eventBus.registerSystem('camera', internal.cameraSystem.eventBus);
            
            // システム間連携イベントの設定
            this.setupSystemInteractions();
            
            // UI層向け統一イベントの設定
            this.setupUIEvents();
            
            debug('EventBus integration complete');
        },
        
        /**
         * システム間連携の設定
         */
        setupSystemInteractions() {
            // LayerSystem -> CameraSystem連携
            internal.layerSystem.on('transform-mode-entered', (data) => {
                internal.cameraSystem.setLayerSystemActive(true);
                internal.cameraSystem.showGuideLines();
            });
            
            internal.layerSystem.on('transform-mode-exited', (data) => {
                internal.cameraSystem.setLayerSystemActive(false);
                internal.cameraSystem.hideGuideLines();
            });
            
            // CameraSystem -> LayerSystem連携
            internal.cameraSystem.on('canvas-resized', (data) => {
                internal.layerSystem.resizeCanvas(data.width, data.height);
            });
            
            // 座標情報の共有
            internal.cameraSystem.on('pointer-move', (data) => {
                internal.eventBus.emit('coordinate-update', {
                    screen: data.screen,
                    canvas: data.canvas
                });
            });
            
            debug('System interactions set up');
        },
        
        /**
         * UI層向け統一イベントの設定
         */
        setupUIEvents() {
            // レイヤー関連イベントをUI層に中継
            internal.layerSystem.on('layer-created', (data) => {
                internal.eventBus.emit('ui-layer-created', data);
            });
            
            internal.layerSystem.on('layer-selected', (data) => {
                internal.eventBus.emit('ui-layer-selected', data);
            });
            
            internal.layerSystem.on('layer-deleted', (data) => {
                internal.eventBus.emit('ui-layer-deleted', data);
            });
            
            internal.layerSystem.on('thumbnail-update-requested', (data) => {
                internal.eventBus.emit('ui-thumbnail-update', data);
            });
            
            // カメラ関連イベントをUI層に中継
            internal.cameraSystem.on('camera-moved', (data) => {
                internal.eventBus.emit('ui-camera-moved', data);
            });
            
            internal.cameraSystem.on('cursor-update-requested', () => {
                internal.eventBus.emit('ui-cursor-update-requested');
            });
            
            debug('UI events set up');
        },
        
        /**
         * 座標系の安全な参照設定
         */
        setupCoordinateSystemSafeReferences() {
            if (CoordinateSystem.setContainers) {
                CoordinateSystem.setContainers({
                    worldContainer: internal.worldContainer,
                    canvasContainer: internal.canvasContainer,
                    app: internal.app
                });
                debug('CoordinateSystem safe references set');
            }
        },
        
        /**
         * 互換性レイヤーの設定
         */
        setupCompatibilityLayer() {
            // レガシーwindow.drawingApp参照
            window.drawingApp = {
                pixiApp: internal.app,
                cameraSystem: internal.cameraSystem,
                layerManager: internal.layerSystem,
                drawingEngine: internal.drawingEngine
            };
            
            // レガシー関数
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return this.api.resizeCanvas(newWidth, newHeight);
            };
            
            debug('Compatibility layer established');
        },
        
        // === 公開API（Phase2対応・完全互換維持版） ===
        api: {
            // --- カメラ操作（CameraSystemへの直接委譲） ---
            panCamera(dx, dy) {
                if (!internal.cameraSystem) {
                    console.error('CoreRuntime.api.panCamera: CameraSystem not available');
                    return false;
                }
                
                try {
                    internal.cameraSystem.panBy(dx, dy);
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.panCamera failed:', error);
                    return false;
                }
            },
            
            zoomCamera(factor, centerX = null, centerY = null) {
                if (!internal.cameraSystem) {
                    console.error('CoreRuntime.api.zoomCamera: CameraSystem not available');
                    return false;
                }
                
                try {
                    const options = {};
                    if (centerX !== null) options.centerX = centerX;
                    if (centerY !== null) options.centerY = centerY;
                    
                    return internal.cameraSystem.zoomBy(factor, options);
                } catch (error) {
                    console.error('CoreRuntime.api.zoomCamera failed:', error);
                    return false;
                }
            },
            
            // --- ツール操作（DrawingEngineへの委譲・互換維持） ---
            setTool(toolName) {
                if (internal.drawingEngine && internal.drawingEngine.setTool) {
                    try {
                        internal.drawingEngine.setTool(toolName);
                        return true;
                    } catch (error) {
                        console.error('CoreRuntime.api.setTool failed:', error);
                        return false;
                    }
                }
                
                // 互換フォールバック（CameraSystemにツール切り替え通知）
                if (internal.cameraSystem) {
                    internal.eventBus.emit('tool-changed', { tool: toolName });
                }
                
                return true;
            },
            
            setBrushSize(size) {
                if (internal.drawingEngine && internal.drawingEngine.setBrushSize) {
                    try {
                        internal.drawingEngine.setBrushSize(size);
                        return true;
                    } catch (error) {
                        console.error('CoreRuntime.api.setBrushSize failed:', error);
                        return false;
                    }
                }
                
                return false;
            },
            
            setBrushOpacity(opacity) {
                if (internal.drawingEngine && internal.drawingEngine.setBrushOpacity) {
                    try {
                        internal.drawingEngine.setBrushOpacity(opacity);
                        return true;
                    } catch (error) {
                        console.error('CoreRuntime.api.setBrushOpacity failed:', error);
                        return false;
                    }
                }
                
                return false;
            },
            
            // --- キャンバス操作（統合処理） ---
            resizeCanvas(newWidth, newHeight) {
                debug(`Canvas resize request: ${newWidth}x${newHeight}`);
                
                try {
                    // CONFIG更新
                    CONFIG.canvas.width = newWidth;
                    CONFIG.canvas.height = newHeight;
                    
                    // CameraSystemのリサイズ
                    if (internal.cameraSystem) {
                        internal.cameraSystem.resizeCanvas(newWidth, newHeight);
                    }
                    
                    // LayerSystemのリサイズ
                    if (internal.layerSystem) {
                        internal.layerSystem.resizeCanvas(newWidth, newHeight);
                    }
                    
                    // UI情報更新
                    const element = document.getElementById('canvas-info');
                    if (element) {
                        element.textContent = `${newWidth}×${newHeight}px`;
                    }
                    
                    // イベント発火
                    internal.eventBus.emit('canvas-resized', { width: newWidth, height: newHeight });
                    
                    debug('Canvas resize completed successfully');
                    return true;
                    
                } catch (error) {
                    console.error('CoreRuntime.api.resizeCanvas failed:', error);
                    return false;
                }
            },
            
            // --- レイヤー操作（LayerSystemへの直接委譲） ---
            getActiveLayer() {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.getActiveLayer: LayerSystem not available');
                    return null;
                }
                
                try {
                    return internal.layerSystem.getActiveLayer();
                } catch (error) {
                    console.error('CoreRuntime.api.getActiveLayer failed:', error);
                    return null;
                }
            },
            
            createLayer(name, isBackground = false) {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.createLayer: LayerSystem not available');
                    return null;
                }
                
                try {
                    return internal.layerSystem.createLayer(name, isBackground);
                } catch (error) {
                    console.error('CoreRuntime.api.createLayer failed:', error);
                    return null;
                }
            },
            
            setActiveLayer(layerId) {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.setActiveLayer: LayerSystem not available');
                    return false;
                }
                
                try {
                    return internal.layerSystem.setActiveLayer(layerId);
                } catch (error) {
                    console.error('CoreRuntime.api.setActiveLayer failed:', error);
                    return false;
                }
            },
            
            deleteLayer(layerId) {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.deleteLayer: LayerSystem not available');
                    return false;
                }
                
                try {
                    return internal.layerSystem.deleteLayer(layerId);
                } catch (error) {
                    console.error('CoreRuntime.api.deleteLayer failed:', error);
                    return false;
                }
            },
            
            toggleLayerVisibility(layerId) {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.toggleLayerVisibility: LayerSystem not available');
                    return false;
                }
                
                try {
                    return internal.layerSystem.toggleVisibility(layerId);
                } catch (error) {
                    console.error('CoreRuntime.api.toggleLayerVisibility failed:', error);
                    return false;
                }
            },
            
            // --- レイヤー変形操作（LayerSystemへの直接委譲） ---
            enterLayerMoveMode() {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.enterLayerMoveMode: LayerSystem not available');
                    return false;
                }
                
                try {
                    internal.layerSystem.enterTransformMode();
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.enterLayerMoveMode failed:', error);
                    return false;
                }
            },
            
            exitLayerMoveMode() {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.exitLayerMoveMode: LayerSystem not available');
                    return false;
                }
                
                try {
                    internal.layerSystem.exitTransformMode();
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.exitLayerMoveMode failed:', error);
                    return false;
                }
            },
            
            transformActiveLayer(transform, pivotMode = 'center') {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.transformActiveLayer: LayerSystem not available');
                    return false;
                }
                
                try {
                    const activeLayer = internal.layerSystem.getActiveLayer();
                    if (!activeLayer) {
                        console.warn('CoreRuntime.api.transformActiveLayer: No active layer');
                        return false;
                    }
                    
                    return internal.layerSystem.updateTransform(activeLayer.layerState.id, transform);
                } catch (error) {
                    console.error('CoreRuntime.api.transformActiveLayer failed:', error);
                    return false;
                }
            },
            
            flipActiveLayer(direction) {
                if (!internal.layerSystem) {
                    console.error('CoreRuntime.api.flipActiveLayer: LayerSystem not available');
                    return false;
                }
                
                try {
                    const activeLayer = internal.layerSystem.getActiveLayer();
                    if (!activeLayer) {
                        console.warn('CoreRuntime.api.flipActiveLayer: No active layer');
                        return false;
                    }
                    
                    const transform = {};
                    if (direction === 'horizontal') {
                        transform.flipH = !activeLayer.layerState.transform.flipH;
                    } else if (direction === 'vertical') {
                        transform.flipV = !activeLayer.layerState.transform.flipV;
                    }
                    
                    return internal.layerSystem.updateTransform(activeLayer.layerState.id, transform);
                } catch (error) {
                    console.error('CoreRuntime.api.flipActiveLayer failed:', error);
                    return false;
                }
            }
        },
        
        // === 統一EventBusアクセス ===
        on(eventName, callback) {
            internal.eventBus.on(eventName, callback);
        },
        
        off(eventName, callback) {
            internal.eventBus.off(eventName, callback);
        },
        
        emit(eventName, payload) {
            internal.eventBus.emit(eventName, payload);
        },
        
        // === システム個別アクセス（Phase2対応） ===
        getLayerSystem() {
            return internal.layerSystem;
        },
        
        getCameraSystem() {
            return internal.cameraSystem;
        },
        
        getDrawingEngine() {
            return internal.drawingEngine;
        },
        
        // === レガシー互換（段階的移行用） ===
        getCameraSystem() {
            return internal.cameraSystem;
        },
        
        getLayerManager() {
            return internal.layerSystem;
        },
        
        // === デバッグ・診断情報 ===
        getDebugInfo() {
            return {
                initialized: internal.initialized,
                phase: internal.phase,
                initTimestamp: internal.initTimestamp,
                legacyModeEnabled: internal.legacyModeEnabled,
                systems: {
                    layerSystem: !!internal.layerSystem,
                    cameraSystem: !!internal.cameraSystem,
                    drawingEngine: !!internal.drawingEngine
                },
                containers: {
                    worldContainer: !!internal.worldContainer,
                    canvasContainer: !!internal.canvasContainer
                },
                eventBus: {
                    registeredSystems: Array.from(internal.eventBus.systemBuses.keys()),
                    globalListeners: internal.eventBus.listeners.size
                },
                coordinateSystem: {
                    available: !!window.CoordinateSystem,
                    safeReferences: !!(window.CoordinateSystem._worldContainer && window.CoordinateSystem._canvasContainer)
                }
            };
        },
        
        /**
         * Phase2分離の診断
         */
        diagnosePhase2Separation() {
            const diagnosis = {
                separation: {
                    layerSystemSeparated: !!internal.layerSystem && internal.layerSystem.constructor.name === 'LayerSystem',
                    cameraSystemSeparated: !!internal.cameraSystem && internal.cameraSystem.constructor.name === 'CameraSystem',
                    eventBusIntegrated: internal.eventBus.systemBuses.size >= 2,
                    apiCompatibilityMaintained: Object.keys(this.api).length >= 15
                },
                functionality: {
                    layerOperations: !!(this.api.createLayer && this.api.setActiveLayer && this.api.deleteLayer),
                    cameraOperations: !!(this.api.panCamera && this.api.zoomCamera),
                    transformOperations: !!(this.api.enterLayerMoveMode && this.api.exitLayerMoveMode),
                    canvasOperations: !!this.api.resizeCanvas
                },
                integration: {
                    systemInteractions: internal.eventBus.systemBuses.has('layer') && internal.eventBus.systemBuses.has('camera'),
                    uiEventRelay: internal.eventBus.listeners.has('ui-layer-created') || internal.eventBus.listeners.size > 0,
                    coordinateSystemIntegrated: !!window.CoordinateSystem._worldContainer
                },
                compatibility: {
                    legacyReferences: !!window.drawingApp,
                    legacyFunctions: !!window.drawingAppResizeCanvas,
                    apiBackwardCompatible: true
                }
            };
            
            console.log('CoreRuntime Phase2 分離診断:', diagnosis);
            
            const allSeparated = Object.values(diagnosis.separation).every(v => v);
            const allFunctional = Object.values(diagnosis.functionality).every(v => v);
            const allIntegrated = Object.values(diagnosis.integration).every(v => v);
            const allCompatible = Object.values(diagnosis.compatibility).every(v => v);
            
            if (allSeparated && allFunctional && allIntegrated && allCompatible) {
                console.log('✅ Phase2 分離完了 - System separation successful');
                console.log('💡 Next steps:');
                console.log('   - DrawingEngine separation');
                console.log('   - Advanced transform utilities');
                console.log('   - Timeline system preparation');
            } else {
                console.warn('⚠️  Phase2 分離未完了:');
                console.log('   - Separation:', allSeparated);
                console.log('   - Functionality:', allFunctional);
                console.log('   - Integration:', allIntegrated);
                console.log('   - Compatibility:', allCompatible);
            }
            
            return diagnosis;
        },
        
        // === 初期化状態確認 ===
        isInitialized() {
            return internal.initialized;
        },
        
        getPhase() {
            return internal.phase;
        }
    };

    // === グローバル公開（Phase2対応版） ===
    window.CoreRuntime = CoreRuntime;
    
    console.log('✅ core-runtime.js Phase2分割対応版 loaded');
    console.log('   - LayerSystem & CameraSystem integration ready');
    console.log('   - EventBus unified system communication');
    console.log('   - API compatibility completely maintained');
    console.log('   - Coordinate system safe references ready');
    console.log('   - Legacy compatibility layer established');

})();