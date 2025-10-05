// ===== core-runtime.js - 緊急修正版 (循環参照チェック追加) =====
// 🔧 Phase 1: safeAddChild実装でスタックオーバーフロー解消

(function() {
    'use strict';
    
    // 依存確認
    if (!window.CoordinateSystem) {
        console.error('CoreRuntime: coordinate-system.js dependency missing');
        return;
    }
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('CoreRuntime: config.js dependency missing');
        return;
    }
    
    // === 循環参照チェック関数（Phase 1: 最優先修正） ===
    function isAncestor(potentialAncestor, child) {
        let cur = potentialAncestor;
        let depth = 0;
        const MAX_DEPTH = 100;
        
        while (cur && depth < MAX_DEPTH) {
            if (cur === child) return true;
            cur = cur.parent;
            depth++;
        }
        
        if (depth >= MAX_DEPTH) {
            console.error('isAncestor: MAX_DEPTH exceeded - possible infinite loop');
            return true; // 安全のため true を返す
        }
        
        return false;
    }
    
    function safeAddChild(parent, child) {
        if (!parent || !child) {
            console.error('safeAddChild: invalid arguments', { parent, child });
            return false;
        }
        
        // 自己参照チェック
        if (parent === child) {
            console.error('safeAddChild: cannot add container to itself');
            return false;
        }
        
        // 循環参照チェック
        if (isAncestor(child, parent)) {
            console.error('safeAddChild: circular reference detected');
            console.error('  parent:', parent.label || parent.name || parent);
            console.error('  child:', child.label || child.name || child);
            return false;
        }
        
        try {
            parent.addChild(child);
            return true;
        } catch (error) {
            console.error('safeAddChild: addChild failed', error);
            return false;
        }
    }
    
    // === CoreRuntime: Project/CUT管理とCUT切替機能 ===
    const CoreRuntime = {
        // Project構造
        project: {
            canvasSize: { w: CONFIG.canvas.width, h: CONFIG.canvas.height },
            DPR: window.devicePixelRatio || 1,
            renderer: null,
            stage: null,
            cuts: [],
            activeCutId: null
        },
        
        // 内部参照
        internal: {
            app: null,
            worldContainer: null,
            canvasContainer: null,
            cameraSystem: null,
            layerManager: null,
            drawingEngine: null,
            initialized: false
        },
        
        // === 初期化 (Phase 1: 引数チェック強化) ===
        init(options) {
            if (!options || !options.app) {
                console.error('CoreRuntime.init: Invalid options. Required: app');
                return false;
            }
            
            // 必須パラメータの検証
            if (!options.worldContainer || !options.canvasContainer) {
                console.error('CoreRuntime.init: worldContainer and canvasContainer are required');
                return false;
            }
            
            if (!options.cameraSystem || !options.layerManager || !options.drawingEngine) {
                console.error('CoreRuntime.init: cameraSystem, layerManager, and drawingEngine are required');
                return false;
            }
            
            // 内部参照を設定
            Object.assign(this.internal, options);
            this.project.renderer = options.app?.renderer;
            this.project.stage = options.app?.stage;
            this.internal.initialized = true;
            
            this.setupCoordinateSystem();
            
            // デフォルトCUT作成
            const defaultCut = this.createCut({ name: 'CUT1' });
            this.switchCut(defaultCut.id);
            
            this.setupLegacyCompatibility();
            
            console.log('✅ CoreRuntime initialized successfully');
            return true;
        },
        
        setupCoordinateSystem() {
            if (window.CoordinateSystem?.setContainers) {
                window.CoordinateSystem.setContainers({
                    worldContainer: this.internal.worldContainer,
                    canvasContainer: this.internal.canvasContainer,
                    app: this.internal.app
                });
            }
        },
        
        setupLegacyCompatibility() {
            window.drawingApp = {
                pixiApp: this.internal.app,
                cameraSystem: this.internal.cameraSystem,
                layerManager: this.internal.layerManager,
                drawingEngine: this.internal.drawingEngine
            };
            
            window.drawingAppResizeCanvas = (w, h) => {
                return this.updateCanvasSize(w, h);
            };
        },
        
        // === CUT作成 ===
        createCut(opts = {}) {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const w = Math.round(this.project.canvasSize.w);
            const h = Math.round(this.project.canvasSize.h);
            
            const cut = {
                id: cutId,
                name: opts.name || `CUT${this.project.cuts.length + 1}`,
                width: w,
                height: h,
                container: new PIXI.Container(),
                layers: [],
                renderTexture: PIXI.RenderTexture.create({
                    width: Math.round(w * this.project.DPR),
                    height: Math.round(h * this.project.DPR)
                }),
                needsThumbnailUpdate: false
            };
            
            cut.container.label = cutId;
            this.project.cuts.push(cut);
            
            return cut;
        },
        
        // === CUT切替（Phase 1: safeAddChild使用） ===
        switchCut(cutId) {
            const newCut = this.getCutById(cutId);
            if (!newCut) {
                console.error('switchCut: Cut not found', cutId);
                return false;
            }
            
            const oldCut = this.getActiveCut();
            
            // 古いCUTを削除
            if (oldCut && this.project.stage) {
                try {
                    this.project.stage.removeChild(oldCut.container);
                } catch (error) {
                    console.error('switchCut: Failed to remove old cut', error);
                }
            }
            
            // 新しいCUTを追加（Phase 1: 循環参照チェック）
            if (this.project.stage) {
                const success = safeAddChild(this.project.stage, newCut.container);
                if (!success) {
                    console.error('switchCut: Failed to add new cut (circular reference?)');
                    // フォールバック: 古いCUTを戻す
                    if (oldCut) {
                        safeAddChild(this.project.stage, oldCut.container);
                    }
                    return false;
                }
            }
            
            this.project.activeCutId = cutId;
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('cut:switched', { 
                    cutId, 
                    cutName: newCut.name 
                });
            }
            
            return true;
        },
        
        // === CUT取得 ===
        getCutById(cutId) {
            return this.project.cuts.find(c => c.id === cutId);
        },
        
        getActiveCut() {
            return this.project.activeCutId ? 
                this.getCutById(this.project.activeCutId) : null;
        },
        
        // === サムネイル生成 ===
        renderCutToTexture(cutId) {
            const cut = this.getCutById(cutId);
            if (!cut || !this.project.renderer) return null;
            
            try {
                this.project.renderer.render({
                    container: cut.container,
                    target: cut.renderTexture
                });
                
                cut.needsThumbnailUpdate = false;
                return cut.renderTexture;
            } catch (error) {
                console.error('RenderTexture生成エラー:', error);
                return null;
            }
        },
        
        // === dataURL取得 ===
        extractCutDataURL(cutId) {
            const renderTexture = this.renderCutToTexture(cutId);
            if (!renderTexture || !this.project.renderer) return '';
            
            try {
                const canvas = this.project.renderer.extract.canvas(renderTexture);
                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('dataURL取得エラー:', error);
                return '';
            }
        },
        
        // === 背景レイヤー更新ヘルパー ===
        updateBackgroundLayerSize(layer, width, height) {
            if (!layer?.layerData?.isBackground) return false;
            if (!layer.layerData.backgroundGraphics) return false;
            
            const bg = layer.layerData.backgroundGraphics;
            bg.clear();
            bg.rect(0, 0, width, height);
            bg.fill(CONFIG.background.color || 0xF0E0D6);
            
            return true;
        },
        
        // === キャンバスサイズ変更 ===
        updateCanvasSize(w, h) {
            this.project.canvasSize = { w, h };
            
            const animationSystem = window.animationSystem || window.TegakiAnimationSystem;
            const currentCutIndex = animationSystem?.getCurrentCutIndex?.() ?? 0;
            
            // CoreRuntime管理のCUTを更新
            this.project.cuts.forEach(cut => {
                if (cut.renderTexture) {
                    cut.renderTexture.destroy(true);
                }
                
                cut.width = w;
                cut.height = h;
                cut.renderTexture = PIXI.RenderTexture.create({
                    width: Math.round(w * this.project.DPR),
                    height: Math.round(h * this.project.DPR)
                });
                cut.needsThumbnailUpdate = true;
            });
            
            // AnimationSystem管理のCUTを更新
            if (animationSystem?.animationData?.cuts) {
                animationSystem.animationData.cuts.forEach((cut, cutIndex) => {
                    if (cut.container && cut.container.children) {
                        cut.container.children.forEach(layer => {
                            if (layer.layerData?.isBackground) {
                                this.updateBackgroundLayerSize(layer, w, h);
                            }
                        });
                    }
                    
                    if (this.internal.layerManager?.renderCutToTexture) {
                        this.internal.layerManager.renderCutToTexture(cut.id, cut.container);
                    }
                    
                    if (cutIndex === currentCutIndex) {
                        setTimeout(() => {
                            if (animationSystem.generateCutThumbnail) {
                                animationSystem.generateCutThumbnail(cutIndex);
                            }
                        }, 50);
                    } else {
                        setTimeout(() => {
                            if (animationSystem.generateCutThumbnail) {
                                animationSystem.generateCutThumbnail(cutIndex);
                            }
                        }, 100 + cutIndex * 50);
                    }
                });
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('camera:resized', { width: w, height: h });
                setTimeout(() => {
                    window.TegakiEventBus.emit('animation:thumbnails-need-update');
                }, 200);
            }
            
            CONFIG.canvas.width = w;
            CONFIG.canvas.height = h;
            
            if (this.internal.cameraSystem?.resizeCanvas) {
                this.internal.cameraSystem.resizeCanvas(w, h);
            }
            
            if (this.internal.layerManager?.updateLayerPanelUI) {
                setTimeout(() => {
                    this.internal.layerManager.updateLayerPanelUI();
                }, 100);
            }
            
            return true;
        },
        
        // === レンダーループ用API ===
        updateThumbnails() {
            this.project.cuts.forEach((cut, index) => {
                if (cut.needsThumbnailUpdate) {
                    this.renderCutToTexture(cut.id);
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('cut:thumbnail-updated', { 
                            cutId: cut.id, 
                            cutIndex: index 
                        });
                    }
                }
            });
        },
        
        // === 描画完了通知 ===
        markCutDirty(cutId) {
            const cut = cutId ? this.getCutById(cutId) : this.getActiveCut();
            if (cut) {
                cut.needsThumbnailUpdate = true;
            }
        },
        
        // === デバッグ情報 ===
        getDebugInfo() {
            return {
                initialized: this.internal.initialized,
                cutsCount: this.project.cuts.length,
                activeCutId: this.project.activeCutId,
                canvasSize: this.project.canvasSize,
                DPR: this.project.DPR,
                cuts: this.project.cuts.map(c => ({
                    id: c.id,
                    name: c.name,
                    layerCount: c.layers.length,
                    needsUpdate: c.needsThumbnailUpdate
                }))
            };
        },
        
        // === 既存API互換性 ===
        api: {
            setTool(toolName) {
                if (CoreRuntime.internal.drawingEngine?.setTool) {
                    CoreRuntime.internal.drawingEngine.setTool(toolName);
                    if (CoreRuntime.internal.cameraSystem?.switchTool) {
                        CoreRuntime.internal.cameraSystem.switchTool(toolName);
                    }
                    return true;
                }
                return false;
            },
            
            setBrushSize(size) {
                if (CoreRuntime.internal.drawingEngine?.setBrushSize) {
                    CoreRuntime.internal.drawingEngine.setBrushSize(size);
                    return true;
                }
                return false;
            },
            
            setBrushOpacity(opacity) {
                if (CoreRuntime.internal.drawingEngine?.setBrushOpacity) {
                    CoreRuntime.internal.drawingEngine.setBrushOpacity(opacity);
                    return true;
                }
                return false;
            },
            
            panCamera(dx, dy) {
                if (CoreRuntime.internal.cameraSystem) {
                    CoreRuntime.internal.cameraSystem.worldContainer.x += dx;
                    CoreRuntime.internal.cameraSystem.worldContainer.y += dy;
                    CoreRuntime.internal.cameraSystem.updateTransformDisplay();
                    return true;
                }
                return false;
            },
            
            zoomCamera(factor, centerX = null, centerY = null) {
                if (!CoreRuntime.internal.cameraSystem) return false;
                
                const currentScale = CoreRuntime.internal.cameraSystem.worldContainer.scale.x;
                const newScale = currentScale * factor;
                
                if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                    const cx = centerX !== null ? centerX : CONFIG.canvas.width / 2;
                    const cy = centerY !== null ? centerY : CONFIG.canvas.height / 2;
                    
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        CoreRuntime.internal.cameraSystem.worldContainer, { x: cx, y: cy }
                    );
                    
                    CoreRuntime.internal.cameraSystem.worldContainer.scale.set(newScale);
                    
                    const newWorldCenter = window.CoordinateSystem.localToGlobal(
                        CoreRuntime.internal.cameraSystem.worldContainer, { x: cx, y: cy }
                    );
                    
                    CoreRuntime.internal.cameraSystem.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    CoreRuntime.internal.cameraSystem.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    CoreRuntime.internal.cameraSystem.updateTransformDisplay();
                    
                    return true;
                }
                return false;
            },
            
            resizeCanvas(w, h) {
                return CoreRuntime.updateCanvasSize(w, h);
            },
            
            getActiveLayer() {
                return CoreRuntime.internal.layerManager?.getActiveLayer() || null;
            },
            
            createLayer(name, isBackground = false) {
                if (CoreRuntime.internal.layerManager) {
                    const result = CoreRuntime.internal.layerManager.createLayer(name, isBackground);
                    if (result) {
                        CoreRuntime.internal.layerManager.updateLayerPanelUI();
                        CoreRuntime.internal.layerManager.updateStatusDisplay();
                    }
                    return result;
                }
                return null;
            },
            
            setActiveLayer(index) {
                if (CoreRuntime.internal.layerManager) {
                    CoreRuntime.internal.layerManager.setActiveLayer(index);
                    return true;
                }
                return false;
            },
            
            enterLayerMoveMode() {
                if (CoreRuntime.internal.layerManager?.enterLayerMoveMode) {
                    CoreRuntime.internal.layerManager.enterLayerMoveMode();
                    return true;
                }
                return false;
            },
            
            exitLayerMoveMode() {
                if (CoreRuntime.internal.layerManager?.exitLayerMoveMode) {
                    CoreRuntime.internal.layerManager.exitLayerMoveMode();
                    return true;
                }
                return true;
            }
        },
        
        coord: window.CoordinateSystem,
        
        getEngines() {
            return {
                camera: this.internal.cameraSystem,
                layer: this.internal.layerManager,
                drawing: this.internal.drawingEngine
            };
        },
        
        getCameraSystem() { return this.internal.cameraSystem; },
        getLayerManager() { return this.internal.layerManager; },
        getDrawingEngine() { return this.internal.drawingEngine; },
        
        isInitialized() { return this.internal.initialized; }
    };
    
    window.CoreRuntime = CoreRuntime;
    
    console.log('✅ core-runtime.js (緊急修正版) loaded');
    console.log('  - 🔥 safeAddChild実装');
    console.log('  - 🔥 循環参照チェック追加');
    console.log('  - 🔥 スタックオーバーフロー対策完了');
})();