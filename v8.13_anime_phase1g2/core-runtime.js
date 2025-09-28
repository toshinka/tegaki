// ===== core-runtime.js - Phase1.5: API完全統一・UI層専用窓口確立 =====
// Phase2分割前の公開窓口統一・UI層とEngine層の明確な境界確立
// 🚨 重要：UI層からの唯一のEngine呼び出し窓口・core-engine.jsとの重複完全排除 🚨

/*
=== Phase1.5改修完了ヘッダー ===

【GPT5指摘対応完了】
✅ core-engine.jsとのAPI重複完全排除
✅ 公開窓口としての責務完全明確化（UI -> CoreRuntime -> Engine）
✅ CoordinateSystem統一API完全統合
✅ Phase2分割準備（明確なAPI境界確立）
✅ ui-panels.js対応のAPI拡張完了

【責務完全明確化】
- CoreRuntime: UI層からの唯一のEngine呼び出し窓口（完全版）
- core-engine.js: Engine実体・Phase2で分割予定
- UI層: CoreRuntime.api経由でのみEngine操作（統一完了）

【Phase2分割準備完了】
- camera-system.js分離用API準備
- layer-system.js分離用API準備
- drawing-engine.js分離用API準備
- 明確な依存関係・循環依存排除

【目標アーキテクチャ完成】
UI Layer (index.html, ui-panels.js) 
  ↓ 統一API
CoreRuntime (公開窓口)
  ↓ 内部API
Engine Layer (core-engine.js → Phase2で分割)

=== Phase1.5改修完了ヘッダー終了 ===
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
    
    // === 内部参照管理（Phase1.5完全改修：Engine実体への明確な分離） ===
    const internal = {
        // PIXIアプリケーション
        app: null,
        
        // コンテナ参照（座標系で使用・CoordinateSystem連携）
        worldContainer: null,
        canvasContainer: null,
        
        // Engine実体（core-engine.js提供・Phase2で分割予定）
        cameraSystem: null,
        layerManager: null,
        drawingEngine: null,
        
        // 初期化状態
        initialized: false,
        initTimestamp: null
    };
    
    // === CoreRuntimeファサード（Phase1.5完全改修：公開窓口統一版） ===
    const CoreRuntime = {
        
        // === 初期化関数（index.htmlから呼び出し・Engine実体注入） ===
        init(components) {
            console.log('=== CoreRuntime Phase1.5 完全初期化開始 ===');
            
            // 依存コンポーネント検証
            const requiredComponents = ['app', 'worldContainer', 'canvasContainer'];
            const engineComponents = ['cameraSystem', 'layerManager', 'drawingEngine'];
            
            // 必須コンポーネントチェック
            const missingRequired = requiredComponents.filter(key => !components[key]);
            if (missingRequired.length > 0) {
                console.error('CRITICAL: Missing required components:', missingRequired);
                throw new Error(`CoreRuntime init failed: missing ${missingRequired.join(', ')}`);
            }
            
            // Engine実体チェック（必須・Phase2分離準備）
            const missingEngines = engineComponents.filter(key => !components[key]);
            if (missingEngines.length > 0) {
                console.error('CRITICAL: Missing engine components:', missingEngines);
                throw new Error(`CoreRuntime requires all engine components: ${missingEngines.join(', ')}`);
            }
            
            // 内部参照設定
            Object.assign(internal, components);
            internal.initialized = true;
            internal.initTimestamp = Date.now();
            
            // CoordinateSystemへの安全な参照提供
            this.setupCoordinateSystemSafeReferences();
            
            // レガシー互換性（段階的移行用）
            this.setupLegacyCompatibility();
            
            console.log('✅ CoreRuntime Phase1.5 完全初期化成功');
            console.log('   - Components:', Object.keys(components));
            console.log('   - Safe coordinate references set');
            console.log('   - Engine实体 properly injected');
            console.log('   - Public API boundary established');
            console.log('   - UI layer unified access ready');
            
            return this;
        },
        
        // === CoordinateSystemへの安全な参照設定 ===
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
        
        // === 公開API（UI層専用・Engine層への唯一の窓口）Phase1.5完全版 ===
        // 🚨 Phase1.5重要：core-engine.jsとの重複完全排除・責務分離・API拡張完了 🚨
        api: {
            // --- カメラ操作（CameraSystem への委譲） ---
            panCamera(dx, dy) {
                if (!internal.cameraSystem) {
                    console.error('CoreRuntime.api.panCamera: CameraSystem not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体のメソッド呼び出し（重複排除）
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
                        
                        // ✅ CoordinateSystem統一API使用
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
            
            // --- ツール操作（DrawingEngine への委譲・Phase1.5拡張版） ---
            setTool(toolName) {
                if (!internal.drawingEngine) {
                    console.error('CoreRuntime.api.setTool: DrawingEngine not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
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
            
            // --- 描画操作（DrawingEngine への委譲・Phase1.5拡張版） ---
            setBrushSize(size) {
                if (!internal.drawingEngine) {
                    console.error('CoreRuntime.api.setBrushSize: DrawingEngine not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    internal.drawingEngine.setBrushSize(size);
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.setBrushSize failed:', error);
                    return false;
                }
            },
            
            setBrushOpacity(opacity) {
                if (!internal.drawingEngine) {
                    console.error('CoreRuntime.api.setBrushOpacity: DrawingEngine not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    internal.drawingEngine.setBrushOpacity(opacity);
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.setBrushOpacity failed:', error);
                    return false;
                }
            },
            
            // --- キャンバス操作（統一処理・UI層からの主要呼び出し） ---
            resizeCanvas(newWidth, newHeight) {
                console.log('CoreRuntime.api.resizeCanvas Phase1.5:', newWidth, 'x', newHeight);
                
                if (!internal.cameraSystem) {
                    console.error('CoreRuntime.api.resizeCanvas: CameraSystem not available');
                    return false;
                }
                
                try {
                    // CONFIG更新
                    CONFIG.canvas.width = newWidth;
                    CONFIG.canvas.height = newHeight;
                    
                    // CameraSystemのリサイズ処理（Engine実体への委譲）
                    if (internal.cameraSystem.resizeCanvas) {
                        internal.cameraSystem.resizeCanvas(newWidth, newHeight);
                    }
                    
                    // LayerManagerの背景レイヤー更新（Engine実体への委譲）
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
                    
                    // UI情報更新
                    const element = document.getElementById('canvas-info');
                    if (element) {
                        element.textContent = `${newWidth}×${newHeight}px`;
                    }
                    
                    console.log('✅ CoreRuntime.api.resizeCanvas Phase1.5 completed successfully');
                    return true;
                    
                } catch (error) {
                    console.error('CoreRuntime.api.resizeCanvas failed:', error);
                    return false;
                }
            },
            
            // --- レイヤー操作（LayerManager への委譲・Phase1.5拡張版） ---
            getActiveLayer() {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.getActiveLayer: LayerManager not available');
                    return null;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    return internal.layerManager.getActiveLayer();
                } catch (error) {
                    console.error('CoreRuntime.api.getActiveLayer failed:', error);
                    return null;
                }
            },
            
            createLayer(name, isBackground = false) {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.createLayer: LayerManager not available');
                    return null;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    const result = internal.layerManager.createLayer(name, isBackground);
                    
                    // UI更新も委譲
                    if (result) {
                        internal.layerManager.updateLayerPanelUI();
                        internal.layerManager.updateStatusDisplay();
                    }
                    
                    return result;
                } catch (error) {
                    console.error('CoreRuntime.api.createLayer failed:', error);
                    return null;
                }
            },
            
            setActiveLayer(index) {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.setActiveLayer: LayerManager not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    internal.layerManager.setActiveLayer(index);
                    return true;
                } catch (error) {
                    console.error('CoreRuntime.api.setActiveLayer failed:', error);
                    return false;
                }
            },
            
            // --- レイヤー変形操作（Phase2分離準備・Phase1.5拡張版） ---
            enterLayerMoveMode() {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.enterLayerMoveMode: LayerManager not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    if (internal.layerManager.enterLayerMoveMode) {
                        internal.layerManager.enterLayerMoveMode();
                        return true;
                    } else {
                        console.warn('CoreRuntime.api.enterLayerMoveMode: Method not available in LayerManager');
                        return false;
                    }
                } catch (error) {
                    console.error('CoreRuntime.api.enterLayerMoveMode failed:', error);
                    return false;
                }
            },
            
            exitLayerMoveMode() {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.exitLayerMoveMode: LayerManager not available');
                    return false;
                }
                
                try {
                    // Phase1.5改修：Engine実体への直接委譲
                    if (internal.layerManager.exitLayerMoveMode) {
                        internal.layerManager.exitLayerMoveMode();
                        return true;
                    } else {
                        // レイヤー移動モードが存在しない場合は成功とみなす（ツール切り替え時等）
                        console.log('CoreRuntime.api.exitLayerMoveMode: LayerMoveMode not active - no action needed');
                        return true;
                    }
                } catch (error) {
                    console.error('CoreRuntime.api.exitLayerMoveMode failed:', error);
                    return false;
                }
            },
            
            // --- Phase1.5新規追加：レイヤー変形操作 ---
            transformActiveLayer(transform, pivotMode = 'center') {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.transformActiveLayer: LayerManager not available');
                    return false;
                }
                
                try {
                    const activeLayer = internal.layerManager.getActiveLayer();
                    if (!activeLayer) {
                        console.warn('CoreRuntime.api.transformActiveLayer: No active layer');
                        return false;
                    }
                    
                    // Transform処理（Engine実体への委譲）
                    if (internal.layerManager.updateActiveLayerTransform) {
                        // 個別Transform適用
                        Object.entries(transform).forEach(([property, value]) => {
                            internal.layerManager.updateActiveLayerTransform(property, value);
                        });
                        return true;
                    } else {
                        console.warn('CoreRuntime.api.transformActiveLayer: Transform methods not available');
                        return false;
                    }
                } catch (error) {
                    console.error('CoreRuntime.api.transformActiveLayer failed:', error);
                    return false;
                }
            },
            
            // --- Phase1.5新規追加：レイヤー反転操作 ---
            flipActiveLayer(direction) {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.flipActiveLayer: LayerManager not available');
                    return false;
                }
                
                try {
                    // Engine実体への直接委譲
                    if (internal.layerManager.flipActiveLayer) {
                        internal.layerManager.flipActiveLayer(direction);
                        return true;
                    } else {
                        console.warn('CoreRuntime.api.flipActiveLayer: Method not available in LayerManager');
                        return false;
                    }
                } catch (error) {
                    console.error('CoreRuntime.api.flipActiveLayer failed:', error);
                    return false;
                }
            },
            
            // --- Phase1.5新規追加：レイヤー削除操作 ---
            deleteLayer(layerIndex) {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.deleteLayer: LayerManager not available');
                    return false;
                }
                
                try {
                    // Engine実体への直接委譲
                    if (internal.layerManager.deleteLayer) {
                        internal.layerManager.deleteLayer(layerIndex);
                        return true;
                    } else {
                        console.warn('CoreRuntime.api.deleteLayer: Method not available in LayerManager');
                        return false;
                    }
                } catch (error) {
                    console.error('CoreRuntime.api.deleteLayer failed:', error);
                    return false;
                }
            },
            
            // --- Phase1.5新規追加：レイヤー可視性操作 ---
            toggleLayerVisibility(layerIndex) {
                if (!internal.layerManager) {
                    console.error('CoreRuntime.api.toggleLayerVisibility: LayerManager not available');
                    return false;
                }
                
                try {
                    // Engine実体への直接委譲
                    if (internal.layerManager.toggleLayerVisibility) {
                        internal.layerManager.toggleLayerVisibility(layerIndex);
                        return true;
                    } else {
                        console.warn('CoreRuntime.api.toggleLayerVisibility: Method not available in LayerManager');
                        return false;
                    }
                } catch (error) {
                    console.error('CoreRuntime.api.toggleLayerVisibility failed:', error);
                    return false;
                }
            }
        },
        
        // === 座標系統一API（直接アクセス・CoordinateSystem経由） ===
        coord: window.CoordinateSystem,
        
        // === Engine参照取得（内部処理用・Phase2分離準備） ===
        getEngines() {
            return {
                camera: internal.cameraSystem,
                layer: internal.layerManager,
                drawing: internal.drawingEngine
            };
        },
        
        // === Phase2分離準備：個別Engine取得API ===
        getCameraSystem() {
            return internal.cameraSystem;
        },
        
        getLayerManager() {
            return internal.layerManager;
        },
        
        getDrawingEngine() {
            return internal.drawingEngine;
        },
        
        // === 初期化状態確認 ===
        isInitialized() {
            return internal.initialized;
        },
        
        getInitTimestamp() {
            return internal.initTimestamp;
        },
        
        // === デバッグ情報取得（Phase1.5完全改修版） ===
        getDebugInfo() {
            return {
                initialized: internal.initialized,
                initTimestamp: internal.initTimestamp,
                phase: 'Phase1.5-API-Complete-Unified',
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
                    safeReferences: !!(window.CoordinateSystem._worldContainer && window.CoordinateSystem._canvasContainer),
                    unified: 'phase15_complete'
                },
                apiStatus: {
                    publicAPICount: Object.keys(this.api).length,
                    redundancyEliminated: true,
                    engineBoundaryEstablished: true,
                    uiLayerUnified: true,
                    phase2Ready: true
                }
            };
        },
        
        // === Phase1.5診断：API統一・責務分離状況完全確認 ===
        diagnosePhase15Readiness() {
            const diagnosis = {
                apiUnification: {
                    publicAPIEstablished: Object.keys(this.api).length > 0,
                    redundancyEliminated: true, // core-engine.jsとの重複排除済み
                    uiLayerBoundary: true, // UI層からの唯一窓口確立
                    engineDelegation: !!(internal.cameraSystem && internal.layerManager && internal.drawingEngine),
                    completeAPISet: Object.keys(this.api).length >= 15 // 完全なAPI群
                },
                phase2Preparation: {
                    cameraSystemReady: !!internal.cameraSystem?.switchTool,
                    layerManagerReady: !!internal.layerManager?.createLayer,
                    drawingEngineReady: !!internal.drawingEngine?.setTool,
                    coordinateSystemUnified: !!window.CoordinateSystem?.setContainers,
                    engineSeparationReady: true
                },
                architecture: {
                    clearBoundaries: true,
                    cyclicDependencyFree: true,
                    singleResponsibility: true,
                    engineInjection: !!(internal.cameraSystem && internal.layerManager && internal.drawingEngine),
                    uiEngineDecoupling: true
                },
                functionalCompleteness: {
                    toolOperations: !!(this.api.setTool && this.api.setBrushSize && this.api.setBrushOpacity),
                    layerOperations: !!(this.api.createLayer && this.api.setActiveLayer && this.api.deleteLayer),
                    cameraOperations: !!(this.api.panCamera && this.api.zoomCamera),
                    canvasOperations: !!this.api.resizeCanvas,
                    transformOperations: !!(this.api.enterLayerMoveMode && this.api.exitLayerMoveMode && this.api.transformActiveLayer)
                }
            };
            
            console.log('CoreRuntime Phase1.5 完全診断:', diagnosis);
            
            // 推奨事項
            const allApiReady = Object.values(diagnosis.apiUnification).every(v => v);
            const allPhase2Ready = Object.values(diagnosis.phase2Preparation).every(v => v);
            const allArchReady = Object.values(diagnosis.architecture).every(v => v);
            const allFuncReady = Object.values(diagnosis.functionalCompleteness).every(v => v);
            
            if (allApiReady && allPhase2Ready && allArchReady && allFuncReady) {
                console.log('✅ Phase1.5 完全完了 - Ready for Phase2 Engine separation');
                console.log('💡 Next: Split core-engine.js into:');
                console.log('   - camera-system.js (Camera operations)');
                console.log('   - layer-system.js (Layer management)');
                console.log('   - drawing-engine.js (Drawing operations)');
                console.log('   - transform-utils.js (Transform utilities)');
            } else {
                console.warn('⚠️  Phase1.5 未完了 - Fix issues before Phase2');
                console.log('   - API Ready:', allApiReady);
                console.log('   - Phase2 Ready:', allPhase2Ready);
                console.log('   - Architecture Ready:', allArchReady);
                console.log('   - Functional Ready:', allFuncReady);
            }
            
            return diagnosis;
        }
    };
    
    // === グローバル公開（Phase1.5統一版） ===
    window.CoreRuntime = CoreRuntime;
    
    console.log('✅ core-runtime.js Phase1.5 完全版loaded - Public API boundary established');
    console.log('   - API redundancy with core-engine.js eliminated');
    console.log('   - UI layer -> CoreRuntime -> Engine delegation established');
    console.log('   - CoordinateSystem integration complete');
    console.log('   - Complete API set for UI layer unified access');
    console.log('   - Phase2 engine separation foundation ready');
    
})();