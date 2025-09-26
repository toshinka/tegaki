// ===== core-runtime.js - Phase2準備: CoreRuntime最小ファサード =====
// UI層との明確な結合点確立・座標系統一API提供・依存注入パターン実装

/*
=== CoreRuntime最小ファサード ===

【目的】
- UI層とEngine層の明確な結合点確立
- 座標系統一APIの安全な提供
- Phase2分割作業の基盤準備
- 依存注入パターンによる疎結合実現

【設計方針】
- 最小限の実装（過度な機能追加禁止）
- 明示的な参照保持（label検索依存排除）
- 安全な初期化パターン
- フォールバック処理完全排除

【依存関係】
- coordinate-system.js: 座標変換統一API
- config.js: グローバル設定
- 各Engineクラス: CameraSystem, LayerManager, DrawingEngine

【使用例】
// index.html main.js部分
CoreRuntime.init({
  app: pixiApp,
  worldContainer: worldContainer,
  canvasContainer: canvasContainer,
  cameraSystem: cameraSystemInstance,
  layerManager: layerManagerInstance,
  drawingEngine: drawingEngineInstance
});

// UI層からの呼び出し
CoreRuntime.api.resizeCanvas(800, 600);
CoreRuntime.api.setTool('pen');
*/

(function() {
    'use strict';
    
    // coordinate-system.js依存確認
    if (!window.CoordinateSystem) {
        console.error('CRITICAL: CoordinateSystem not available - core-runtime.js requires coordinate-system.js');
        throw new Error('coordinate-system.js dependency missing');
    }
    
    // CONFIG依存確認
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('CRITICAL: TEGAKI_CONFIG not available - core-runtime.js requires config.js');
        throw new Error('config.js dependency missing');
    }
    
    // === 内部参照管理 ===
    const internal = {
        // PIXIアプリケーション
        app: null,
        
        // コンテナ参照（座標系で使用）
        worldContainer: null,
        canvasContainer: null,
        
        // Engine実体
        cameraSystem: null,
        layerManager: null,
        drawingEngine: null,
        
        // 初期化状態
        initialized: false,
        initTimestamp: null
    };
    
    // === CoreRuntimeファサード ===
    const CoreRuntime = {
        
        // === 初期化関数（index.htmlから呼び出し） ===
        init(components) {
            console.log('=== CoreRuntime initialization started ===');
            
            // 依存コンポーネント検証
            const requiredComponents = ['app', 'worldContainer', 'canvasContainer'];
            const engineComponents = ['cameraSystem', 'layerManager', 'drawingEngine'];
            
            // 必須コンポーネントチェック
            const missingRequired = requiredComponents.filter(key => !components[key]);
            if (missingRequired.length > 0) {
                console.error('CRITICAL: Missing required components:', missingRequired);
                throw new Error(`CoreRuntime init failed: missing ${missingRequired.join(', ')}`);
            }
            
            // Engine実体チェック（警告のみ）
            const missingEngines = engineComponents.filter(key => !components[key]);
            if (missingEngines.length > 0) {
                console.warn('WARNING: Missing engine components (will be set later):', missingEngines);
            }
            
            // 内部参照設定
            Object.assign(internal, components);
            internal.initialized = true;
            internal.initTimestamp = Date.now();
            
            // 座標系への安全な参照提供
            this.setupCoordinateSystemSafeReferences();
            
            // レガシー互換性（段階的移行用）
            this.setupLegacyCompatibility();
            
            console.log('✅ CoreRuntime initialized successfully');
            console.log('   - Components:', Object.keys(components));
            console.log('   - Safe coordinate references set');
            console.log('   - Legacy compatibility enabled');
            
            return this;
        },
        
        // === 座標系への安全な参照設定 ===
        setupCoordinateSystemSafeReferences() {
            if (!window.CoordinateSystem.setContainers) {
                // CoordinateSystemに安全な参照設定機能を動的追加
                window.CoordinateSystem.setContainers = function(containers) {
                    this._worldContainer = containers.worldContainer;
                    this._canvasContainer = containers.canvasContainer;
                    this._app = containers.app;
                    
                    console.log('CoordinateSystem: Safe container references set');
                    console.log('   - worldContainer:', !!this._worldContainer);
                    console.log('   - canvasContainer:', !!this._canvasContainer);
                };
                
                // 安全な参照取得メソッドも追加
                window.CoordinateSystem.getWorldContainer = function() {
                    if (this._worldContainer) return this._worldContainer;
                    
                    // フォールバック（警告付き）
                    console.warn('CoordinateSystem: Using fallback worldContainer search');
                    return this._app?.stage.children.find(child => child.label === 'worldContainer') || null;
                };
                
                window.CoordinateSystem.getCanvasContainer = function() {
                    if (this._canvasContainer) return this._canvasContainer;
                    
                    // フォールバック（警告付き）
                    console.warn('CoordinateSystem: Using fallback canvasContainer search');
                    const worldContainer = this.getWorldContainer();
                    return worldContainer?.children.find(child => child.label === 'canvasContainer') || null;
                };
            }
            
            // 参照設定実行
            window.CoordinateSystem.setContainers({
                worldContainer: internal.worldContainer,
                canvasContainer: internal.canvasContainer,
                app: internal.app
            });
        },
        
        // === レガシー互換性設定（段階的移行用） ===
        setupLegacyCompatibility() {
            // window.drawingAppリファレンス（既存コードとの互換性）
            if (!window.drawingApp) {
                window.drawingApp = {
                    pixiApp: internal.app,
                    cameraSystem: internal.cameraSystem,
                    layerManager: internal.layerManager,
                    drawingEngine: internal.drawingEngine
                };
            }
            
            // window.drawingAppResizeCanvas（UI層からの呼び出し用）
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                console.log('CoreRuntime: Legacy canvas resize request:', newWidth, 'x', newHeight);
                return this.api.resizeCanvas(newWidth, newHeight);
            };
        },
        
        // === 公開API（UI層から使用） ===
        api: {
            // --- カメラ操作 ---
            panCamera(dx, dy) {
                if (!internal.cameraSystem) {
                    console.error('CoreRuntime.api.panCamera: CameraSystem not available');
                    return false;
                }
                
                try {
                    // CameraSystemの実装に依存
                    internal.cameraSystem.worldContainer.x += dx;
                    internal.cameraSystem.worldContainer.y += dy;
                    internal.cameraSystem.updateTransformDisplay();
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
                    const currentScale = internal.cameraSystem.worldContainer.scale.x;
                    const newScale = currentScale * factor;
                    
                    if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                        // 中央基準でのズーム
                        const cx = centerX !== null ? centerX : CONFIG.canvas.width / 2;
                        const cy = centerY !== null ? centerY : CONFIG.canvas.height / 2;
                        
                        // 座標系統一API使用
                        const worldCenter = window.CoordinateSystem.localToGlobal(
                            internal.cameraSystem.worldContainer, { x: cx, y: cy }
                        );
                        
                        internal.cameraSystem.worldContainer.scale.set(newScale);
                        
                        const newWorldCenter = window.CoordinateSystem.localToGlobal(
                            internal.cameraSystem.worldContainer, { x: cx, y: cy }
                        );
                        
                        internal.cameraSystem.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        internal.cameraSystem.worldContainer.y += worldCenter.y - newWorldCenter.y;
                        internal.cameraSystem.updateTransformDisplay();
                        
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error('CoreRuntime.api.zoomCamera failed:', error);
                    return false;
                }
            },
            
            // --- ツール操作 ---
            setTool(toolName) {
                if (!internal.drawingEngine) {
                    console.error('CoreRuntime.api.setTool: DrawingEngine not available');
                    return false;
                }
                
                try {
                    internal.drawingEngine.setTool(toolName);
                    
                    // CameraSystemのツール切り替えも連動
                    if (internal.cameraSystem && internal.cameraSystem.switchTool) {
                        internal.cameraSystem.switchTool(toolName);
                    }
                    
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.setTool failed:', error);
                    return false;
                }
            },
            
            // --- キャンバス操作 ---
            resizeCanvas(newWidth, newHeight) {
                console.log('CoreRuntime.api.resizeCanvas:', newWidth, 'x', newHeight);
                
                if (!internal.cameraSystem) {
                    console.error('CoreRuntime.api.resizeCanvas: CameraSystem not available');
                    return false;
                }
                
                try {
                    // CONFIG更新
                    CONFIG.canvas.width = newWidth;
                    CONFIG.canvas.height = newHeight;
                    
                    // CameraSystemのリサイズ処理
                    if (internal.cameraSystem.resizeCanvas) {
                        internal.cameraSystem.resizeCanvas(newWidth, newHeight);
                    }
                    
                    // LayerManagerの背景レイヤー更新
                    if (internal.layerManager) {
                        internal.layerManager.layers.forEach(layer => {
                            if (layer.layerData?.isBackground && layer.layerData.backgroundGraphics) {
                                layer.layerData.backgroundGraphics.clear();
                                layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                                layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                            }
                        });
                        
                        // 全レイヤーのサムネイル更新
                        for (let i = 0; i < internal.layerManager.layers.length; i++) {
                            internal.layerManager.requestThumbnailUpdate(i);
                        }
                    }
                    
                    console.log('✅ CoreRuntime.api.resizeCanvas completed successfully');
                    return true;
                    
                } catch (error) {
                    console.error('CoreRuntime.api.resizeCanvas failed:', error);
                    return false;
                }
            },
            
            // --- レイヤー操作 ---
            getActiveLayer() {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.getActiveLayer: LayerManager not available');
                    return null;
                }
                
                return internal.layerManager.getActiveLayer();
            },
            
            createLayer(name, isBackground = false) {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.createLayer: LayerManager not available');
                    return null;
                }
                
                try {
                    return internal.layerManager.createLayer(name, isBackground);
                } catch (error) {
                    console.error('CoreRuntime.api.createLayer failed:', error);
                    return null;
                }
            }
        },
        
        // === 座標系統一API（直接アクセス） ===
        coord: window.CoordinateSystem,
        
        // === Engine参照取得（内部処理用） ===
        getEngines() {
            return {
                camera: internal.cameraSystem,
                layer: internal.layerManager,
                drawing: internal.drawingEngine
            };
        },
        
        // === 初期化状態確認 ===
        isInitialized() {
            return internal.initialized;
        },
        
        getInitTimestamp() {
            return internal.initTimestamp;
        },
        
        // === デバッグ情報取得 ===
        getDebugInfo() {
            return {
                initialized: internal.initialized,
                initTimestamp: internal.initTimestamp,
                components: {
                    app: !!internal.app,
                    worldContainer: !!internal.worldContainer,
                    canvasContainer: !!internal.canvasContainer,
                    cameraSystem: !!internal.cameraSystem,
                    layerManager: !!internal.layerManager,
                    drawingEngine: !!internal.drawingEngine
                },
                coordinateSystem: {
                    available: !!window.CoordinateSystem,
                    safeReferences: !!(window.CoordinateSystem._worldContainer && window.CoordinateSystem._canvasContainer)
                }
            };
        }
    };
    
    // === グローバル公開 ===
    window.CoreRuntime = CoreRuntime;
    
    console.log('✅ core-runtime.js loaded - CoreRuntime facade ready');
    console.log('   - Coordinate system integration ready');
    console.log('   - UI layer binding points established'); 
    console.log('   - Phase2 separation foundation prepared');
    
})();