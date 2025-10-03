// ===== system/animation-system.js - Phase 2: CUT×Layer完全独立版 (修正版) =====
// 【修正完了】points配列の参照共有を完全排除
// 【修正完了】Deep Copy徹底強化: 新しいオブジェクト生成を保証
// PixiJS v8.13 対応

(function() {
    'use strict';
    
    class AnimationSystem {
        constructor() {
            this.animationData = this.createDefaultAnimation();
            this.layerSystem = null;
            this.cameraSystem = null;
            this.app = null;
            this.eventBus = window.TegakiEventBus;
            
            this.playbackTimer = null;
            this.isAnimationMode = false;
            this.initialCutCreated = false;
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            this.cutLayerIdCounters = new Map();
            this.cutLayerStates = new Map();
            
            this.cutClipboard = {
                cutData: null,
                timestamp: null,
                sourceId: null
            };
            
            this.coordAPI = window.CoordinateSystem;
        }
        
        init(layerSystem, app) {
            if (this.hasInitialized) return;
            
            this.layerSystem = layerSystem;
            this.app = app;
            
            if (!this.eventBus || !this.layerSystem?.layers) {
                console.error('Required dependencies not available');
                return;
            }
            
            this.layerSystem.animationSystem = this;
            this.setupCutClipboardEvents();
            this.setupLayerChangeListener();
            this.hasInitialized = true;
            
            setTimeout(() => {
                if (!this.initialCutCreated && !this.isInitializing) {
                    this.createInitialCutIfNeeded();
                }
            }, 150);
            
            setTimeout(() => {
                if (this.eventBus) {
                    this.eventBus.emit('animation:system-ready');
                    this.eventBus.emit('animation:initialized');
                }
            }, 200);
        }
        
        setupLayerChangeListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('layer:updated', () => {
                this.saveCutLayerStates();
            });
            
            this.eventBus.on('layer:visibility-changed', () => {
                this.saveCutLayerStates();
            });
            
            this.eventBus.on('layer:path-added', () => {
                this.saveCutLayerStates();
            });
        }
        
        setupCutClipboardEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('cut:copy-current', () => this.copyCurrent());
            this.eventBus.on('cut:paste-right-adjacent', () => this.pasteRightAdjacent());
            this.eventBus.on('cut:paste-new', () => this.pasteAsNew());
        }
        
        createDefaultAnimation() {
            const config = window.TEGAKI_CONFIG?.animation || {
                defaultCutDuration: 0.5
            };
            
            return {
                cuts: [],
                settings: {
                    loop: true
                },
                playback: {
                    isPlaying: false,
                    currentCutIndex: 0,
                    startTime: 0
                }
            };
        }
        
        // ===== CUT作成 =====
        
        createNewCutFromCurrentLayers() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const independentLayers = this.copyCurrentLayersToIndependentState(cutId);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG?.animation?.defaultCutDuration || 0.5,
                layers: independentLayers,
                thumbnailCanvas: null
            };
            
            this.animationData.cuts.push(cut);
            const newCutIndex = this.animationData.cuts.length - 1;
            
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(independentLayers));
            
            this.switchToActiveCutSafely(newCutIndex, false);
            
            setTimeout(async () => {
                await this.generateCutThumbnailOptimized(newCutIndex);
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-created', { 
                        cutId: cut.id, 
                        cutIndex: newCutIndex 
                    });
                }
            }, 100);
            
            return cut;
        }
        
        createNewBlankCut() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const initialLayers = [
                {
                    id: `${cutId}_layer_bg_${Date.now()}`,
                    name: '背景',
                    visible: true,
                    opacity: 1.0,
                    isBackground: true,
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    paths: [],
                    createdAt: Date.now(),
                    cutId: cutId
                },
                {
                    id: `${cutId}_layer_01_${Date.now() + 1}`,
                    name: 'レイヤー1',
                    visible: true,
                    opacity: 1.0,
                    isBackground: false,
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    paths: [],
                    createdAt: Date.now(),
                    cutId: cutId
                }
            ];
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG?.animation?.defaultCutDuration || 0.5,
                layers: initialLayers,
                thumbnailCanvas: null
            };
            
            this.animationData.cuts.push(cut);
            const newIndex = this.animationData.cuts.length - 1;
            
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(initialLayers));
            
            this.switchToActiveCutSafely(newIndex, false);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-created', { 
                    cutId: cut.id, 
                    cutIndex: newIndex 
                });
            }
            
            return cut;
        }
        
        createNewEmptyCut() {
            return this.createNewBlankCut();
        }
        
        // ===== Deep Copy関連 - 【修正】参照の共有を完全排除 =====
        
        /**
         * 【修正】LayerSystemの現在状態からCUT独立のLayerデータを生成
         * ★★★ paths配列・points配列を完全にDeep Copy（新しいオブジェクト生成） ★★★
         */
        copyCurrentLayersToIndependentState(cutId) {
            const independentLayers = [];
            
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                return independentLayers;
            }
            
            this.layerSystem.layers.forEach((originalLayer) => {
                if (!originalLayer?.layerData) return;
                
                const independentLayerId = this.generateUniqueCutLayerId(cutId);
                const originalTransform = this.layerSystem.layerTransforms.get(originalLayer.layerData.id) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                // ★★★ 【修正】paths配列を完全にDeep Copy（新しい配列・新しいオブジェクト） ★★★
                const independentPaths = originalLayer.layerData.paths ? 
                    originalLayer.layerData.paths.map(originalPath => {
                        // ★★★ 【修正】points配列もDeep Copy（map + 新しいオブジェクト） ★★★
                        const independentPoints = originalPath.points ? 
                            originalPath.points.map(point => {
                                // ★★★ 【重要】新しいオブジェクトとして生成 ★★★
                                return {
                                    x: Number(point.x),
                                    y: Number(point.y)
                                };
                            }) : [];
                        
                        // ★★★ 【修正】新しいpathオブジェクト生成（参照を持たない） ★★★
                        return {
                            id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            points: independentPoints,
                            size: originalPath.size || 16,
                            color: originalPath.color || 0x800000,
                            opacity: originalPath.opacity || 1.0,
                            tool: originalPath.tool || 'pen',
                            isComplete: originalPath.isComplete || true
                        };
                    }) : [];
                
                // ★★★ 【修正】新しいlayerDataオブジェクト生成（参照を持たない） ★★★
                const independentLayerData = {
                    id: independentLayerId,
                    name: originalLayer.layerData.name,
                    visible: originalLayer.layerData.visible !== false,
                    opacity: originalLayer.layerData.opacity || 1.0,
                    isBackground: originalLayer.layerData.isBackground || false,
                    transform: {
                        x: Number(originalTransform.x) || 0,
                        y: Number(originalTransform.y) || 0,
                        rotation: Number(originalTransform.rotation) || 0,
                        scaleX: Number(originalTransform.scaleX) || 1,
                        scaleY: Number(originalTransform.scaleY) || 1
                    },
                    paths: independentPaths,
                    createdAt: Date.now(),
                    cutId: cutId
                };
                
                independentLayers.push(independentLayerData);
            });
            
            return independentLayers;
        }
        
        /**
         * 【修正】CUT Layer配列のDeep Clone（バックアップ用）
         * ★★★ すべての階層で新しいオブジェクト・配列を生成 ★★★
         */
        deepCloneCutLayers(cutLayers) {
            if (!cutLayers || !Array.isArray(cutLayers)) return [];
            
            return cutLayers.map(layer => {
                // ★★★ 【修正】paths配列を新規作成（map = 新しい配列） ★★★
                const clonedPaths = layer.paths ? layer.paths.map(path => {
                    // ★★★ 【修正】points配列も新規作成（map = 新しい配列） ★★★
                    const clonedPoints = path.points ? path.points.map(p => {
                        // ★★★ 【重要】新しいオブジェクトとして生成 ★★★
                        return { 
                            x: Number(p.x), 
                            y: Number(p.y) 
                        };
                    }) : [];
                    
                    // ★★★ 【修正】新しいpathオブジェクト返却 ★★★
                    return {
                        id: path.id,
                        points: clonedPoints,
                        size: path.size || 16,
                        color: path.color || 0x800000,
                        opacity: path.opacity || 1.0,
                        tool: path.tool || 'pen',
                        isComplete: path.isComplete || true
                    };
                }) : [];
                
                // ★★★ 【修正】新しいlayerオブジェクト返却 ★★★
                return {
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity,
                    isBackground: layer.isBackground,
                    transform: {
                        x: Number(layer.transform?.x) || 0,
                        y: Number(layer.transform?.y) || 0,
                        rotation: Number(layer.transform?.rotation) || 0,
                        scaleX: Number(layer.transform?.scaleX) || 1,
                        scaleY: Number(layer.transform?.scaleY) || 1
                    },
                    paths: clonedPaths,
                    createdAt: layer.createdAt || Date.now(),
                    cutId: layer.cutId
                };
            });
        }
        
        generateUniqueCutLayerId(cutId) {
            if (!this.cutLayerIdCounters.has(cutId)) {
                this.cutLayerIdCounters.set(cutId, 0);
            }
            
            const counter = this.cutLayerIdCounters.get(cutId);
            this.cutLayerIdCounters.set(cutId, counter + 1);
            
            return `${cutId}_layer_${counter}_${Date.now()}`;
        }
        
        // ===== CUT切替 - 完全再構築による独立性確保 =====
        
        switchToActiveCutSafely(cutIndex, resetTransform = false) {
            if (this.cutSwitchInProgress) {
                setTimeout(() => this.switchToActiveCutSafely(cutIndex, resetTransform), 50);
                return;
            }
            
            const targetCut = this.animationData.cuts[cutIndex];
            if (!targetCut || !this.layerSystem) return;
            
            this.cutSwitchInProgress = true;
            
            // ★★★ Step 1: 切替前に現在CUTを保存（Deep Copy） ★★★
            this.saveCutLayerStatesBeforeSwitch();
            
            this.animationData.playback.currentCutIndex = cutIndex;
            
            // ★★★ Step 2: CUT切替・LayerSystem完全再構築 ★★★
            this.setActiveCut(cutIndex, resetTransform);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex, cutId: targetCut.id });
            }
            
            this.cutSwitchInProgress = false;
        }
        
        /**
         * CUT切替前の状態保存
         * ★★★ Deep Copyで完全独立保存（参照の共有を絶対にしない） ★★★
         */
        saveCutLayerStatesBeforeSwitch() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            // ★★★ LayerSystemから現在状態を取得してDeep Copy ★★★
            const currentIndependentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            
            // ★★★ CUTに保存（Deep Clone） ★★★
            currentCut.layers = this.deepCloneCutLayers(currentIndependentState);
            
            // ★★★ Mapにも保存（二重保存で安全性確保） ★★★
            this.cutLayerStates.set(currentCut.id, this.deepCloneCutLayers(currentIndependentState));
        }
        
        /**
         * CUT状態の保存（描画時などに呼ばれる）
         * ★★★ Deep Copyで完全独立保存（即時保存の原則） ★★★
         */
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            // ★★★ LayerSystemから現在状態を取得してDeep Copy ★★★
            const currentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            
            // ★★★ CUTに保存（Deep Clone） ★★★
            currentCut.layers = this.deepCloneCutLayers(currentState);
            
            // ★★★ Mapにも保存 ★★★
            this.cutLayerStates.set(currentCut.id, this.deepCloneCutLayers(currentState));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        /**
         * CUTデータからLayerSystemを再構築
         * ★★★ 完全にクリアして再構築（参照を持たない新規構造） ★★★
         */
        setActiveCut(cutIndex, resetTransform = false) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            // ★★★ Step 1: LayerSystemを完全クリア ★★★
            this.clearLayerSystemLayers();
            
            // ★★★ Step 2: Mapから取得（より新しい状態）★★★
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
            
            // ★★★ Step 3: 完全再構築（新しいPIXI.Container・新しいlayerData） ★★★
            this.rebuildLayersFromCutData(cutLayers, resetTransform);
            
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
        }
        
        clearLayerSystemLayers() {
            if (!this.layerSystem?.layers) return;
            
            const layersToDestroy = [...this.layerSystem.layers];
            
            layersToDestroy.forEach((layer) => {
                if (layer.layerData?.paths) {
                    layer.layerData.paths.forEach(path => {
                        if (path.graphics?.destroy) {
                            path.graphics.destroy();
                        }
                    });
                }
                
                if (layer.parent) {
                    layer.parent.removeChild(layer);
                }
                
                if (layer.destroy) {
                    layer.destroy({ children: true, texture: false, baseTexture: false });
                }
            });
            
            this.layerSystem.layers = [];
            this.layerSystem.layerTransforms.clear();
            this.layerSystem.activeLayerIndex = -1;
        }
        
        /**
         * 【修正】CUTデータからPIXI Layerを再構築
         * ★★★ 新しいPIXI.Containerと新しいlayerDataを作成（参照ゼロ） ★★★
         */
        rebuildLayersFromCutData(cutLayers, resetTransform = false) {
            if (!cutLayers || !Array.isArray(cutLayers) || cutLayers.length === 0) {
                return;
            }
            
            cutLayers.forEach((cutLayerData, index) => {
                // ★★★ 新しいPIXI.Container生成 ★★★
                const layer = new PIXI.Container();
                layer.label = cutLayerData.id;
                
                // ★★★ 【修正】新しいlayerDataオブジェクトを作成（Deep Copy） ★★★
                layer.layerData = {
                    id: cutLayerData.id,
                    name: cutLayerData.name || `レイヤー${index + 1}`,
                    visible: cutLayerData.visible !== false,
                    opacity: cutLayerData.opacity || 1.0,
                    isBackground: cutLayerData.isBackground || false,
                    paths: []  // ★★★ 空から開始（後で追加） ★★★
                };
                
                const transform = cutLayerData.transform || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                this.layerSystem.layerTransforms.set(cutLayerData.id, {
                    x: Number(transform.x) || 0,
                    y: Number(transform.y) || 0,
                    rotation: Number(transform.rotation) || 0,
                    scaleX: Number(transform.scaleX) || 1,
                    scaleY: Number(transform.scaleY) || 1
                });
                
                if (cutLayerData.isBackground) {
                    const bg = new PIXI.Graphics();
                    const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
                    const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
                    const bgColor = this.layerSystem.config?.background?.color || 0xF0E0D6;
                    
                    bg.rect(0, 0, canvasWidth, canvasHeight);
                    bg.fill(bgColor);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                }
                
                // ★★★ 【修正】paths再構築（新しいPIXI.Graphics生成） ★★★
                if (cutLayerData.paths && Array.isArray(cutLayerData.paths)) {
                    cutLayerData.paths.forEach(pathData => {
                        const reconstructedPath = this.rebuildPathFromData(pathData);
                        if (reconstructedPath) {
                            layer.layerData.paths.push(reconstructedPath);
                            layer.addChild(reconstructedPath.graphics);
                        }
                    });
                }
                
                layer.visible = cutLayerData.visible !== false;
                layer.alpha = cutLayerData.opacity || 1.0;
                
                if (!resetTransform && this.shouldApplyTransform(transform)) {
                    this.applyTransformToLayerFixed(layer, transform);
                } else {
                    layer.position.set(0, 0);
                    layer.pivot.set(0, 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                }
                
                this.layerSystem.layers.push(layer);
                this.layerSystem.layersContainer.addChild(layer);
            });
            
            if (this.layerSystem.layers.length > 0) {
                this.layerSystem.activeLayerIndex = Math.max(0, this.layerSystem.layers.length - 1);
            }
        }
        
        /**
         * 【修正】PathデータからPIXI.Graphicsを再構築
         * ★★★ 新しいPIXI.Graphics生成・points配列Deep Copy ★★★
         */
        rebuildPathFromData(pathData) {
            if (!pathData?.points || !Array.isArray(pathData.points) || pathData.points.length === 0) {
                return null;
            }
            
            // ★★★ 新しいPIXI.Graphics生成 ★★★
            const graphics = new PIXI.Graphics();
            
            pathData.points.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number' &&
                    isFinite(point.x) && isFinite(point.y)) {
                    graphics.circle(point.x, point.y, (pathData.size || 16) / 2);
                    graphics.fill({
                        color: pathData.color || 0x800000,
                        alpha: pathData.opacity || 1.0
                    });
                }
            });
            
            // ★★★ 【修正】新しいpathオブジェクト返却（points配列Deep Copy） ★★★
            return {
                id: pathData.id || ('path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
                // ★★★ 【重要】points配列をmapで新しいオブジェクトとして生成 ★★★
                points: pathData.points.map(p => ({
                    x: Number(p.x),
                    y: Number(p.y)
                })),
                size: pathData.size || 16,
                color: pathData.color || 0x800000,
                opacity: pathData.opacity || 1.0,
                tool: pathData.tool || 'pen',
                graphics: graphics
            };
        }
        
        shouldApplyTransform(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }
        
        applyTransformToLayerFixed(layer, transform) {
            if (!transform || !layer) return;
            
            const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1) {
                    layer.pivot.set(centerX, centerY);
                    layer.position.set(centerX + (transform.x || 0), centerY + (transform.y || 0));
                    layer.rotation = transform.rotation || 0;
                    layer.scale.set(transform.scaleX || 1, transform.scaleY || 1);
                } else {
                    layer.pivot.set(0, 0);
                    layer.position.set(transform.x || 0, transform.y || 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                }
            }
            
            if (this.layerSystem && layer.layerData) {
                this.layerSystem.layerTransforms.set(layer.layerData.id, {
                    x: transform.x || 0,
                    y: transform.y || 0,
                    rotation: transform.rotation || 0,
                    scaleX: transform.scaleX || 1,
                    scaleY: transform.scaleY || 1
                });
            }
        }
        
        // ===== サムネイル生成 =====
        
        async generateCutThumbnailOptimized(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem || !this.app?.renderer) return;
            
            const currentCutIndex = this.animationData.playback.currentCutIndex;
            let shouldRestoreOriginal = false;
            
            if (cutIndex !== currentCutIndex) {
                shouldRestoreOriginal = true;
                await this.temporarilyApplyCutStateForThumbnail(cutIndex);
            }
            
            await this._waitForRendererReady();
            const thumbnailCanvas = await this.generateLayerCompositeCanvasOptimized();
            
            if (thumbnailCanvas) {
                cut.thumbnailCanvas = thumbnailCanvas;
            }
            
            if (shouldRestoreOriginal) {
                await this.restoreOriginalCutStateAfterThumbnail(currentCutIndex);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
            }
        }
        
        async _waitForRendererReady() {
            if (!this.app?.renderer || !this.layerSystem?.layersContainer) {
                return;
            }
            
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    this.app.renderer.render(this.layerSystem.layersContainer);
                    requestAnimationFrame(() => resolve());
                });
            });
        }
        
        async temporarilyApplyCutStateForThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            this.clearLayerSystemLayers();
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
            this.rebuildLayersFromCutData(cutLayers, false);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        async restoreOriginalCutStateAfterThumbnail(originalCutIndex) {
            const originalCut = this.animationData.cuts[originalCutIndex];
            if (!originalCut) return;
            
            this.clearLayerSystemLayers();
            const originalLayers = this.cutLayerStates.get(originalCut.id) || originalCut.layers || [];
            this.rebuildLayersFromCutData(originalLayers, false);
            
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        async generateLayerCompositeCanvasOptimized() {
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                return this.createEmptyThumbnailCanvas();
            }
            
            const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
            const canvasAspectRatio = canvasWidth / canvasHeight;
            
            const maxThumbWidth = 72;
            const maxThumbHeight = 54;
            
            let thumbWidth, thumbHeight;
            
            if (canvasAspectRatio >= maxThumbWidth / maxThumbHeight) {
                thumbWidth = maxThumbWidth;
                thumbHeight = Math.round(maxThumbWidth / canvasAspectRatio);
            } else {
                thumbHeight = maxThumbHeight;
                thumbWidth = Math.round(maxThumbHeight * canvasAspectRatio);
            }
            
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = thumbWidth;
            compositeCanvas.height = thumbHeight;
            
            const ctx = compositeCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, thumbWidth, thumbHeight);
            
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                const layer = this.layerSystem.layers[i];
                
                if (!layer.visible || layer.layerData?.visible === false) continue;
                
                const layerCanvas = await this.renderLayerToCanvasOptimized(layer);
                
                if (layerCanvas) {
                    const opacity = layer.alpha * (layer.layerData?.opacity || 1.0);
                    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
                    ctx.drawImage(layerCanvas, 0, 0, thumbWidth, thumbHeight);
                    ctx.globalAlpha = 1.0;
                }
            }
            
            return compositeCanvas;
        }
        
        createEmptyThumbnailCanvas() {
            const canvas = document.createElement('canvas');
            canvas.width = 72;
            canvas.height = 54;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0e0d6';
            ctx.fillRect(0, 0, 72, 54);
            ctx.fillStyle = '#800000';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Empty', 36, 30);
            
            return canvas;
        }
        
        async renderLayerToCanvasOptimized(layer) {
            if (!this.app?.renderer || !layer) return null;
            
            const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
            
            const renderTexture = PIXI.RenderTexture.create({
                width: canvasWidth,
                height: canvasHeight,
                resolution: 1
            });
            
            const tempContainer = new PIXI.Container();
            const originalParent = layer.parent;
            const originalIndex = originalParent ? originalParent.getChildIndex(layer) : -1;
            
            if (originalParent) {
                originalParent.removeChild(layer);
            }
            
            tempContainer.addChild(layer);
            this.app.renderer.render({ container: tempContainer, target: renderTexture });
            const canvas = this.app.renderer.extract.canvas(renderTexture);
            
            tempContainer.removeChild(layer);
            if (originalParent && originalIndex !== -1) {
                originalParent.addChildAt(layer, originalIndex);
            } else if (originalParent) {
                originalParent.addChild(layer);
            }
            
            renderTexture.destroy();
            tempContainer.destroy();
            
            return canvas;
        }
        
        // ===== CUT クリップボード =====
        
        copyCurrent() {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return false;
            
            this.saveCutLayerStatesBeforeSwitch();
            this.cutClipboard.cutData = this.deepCopyCutData(currentCut);
            this.cutClipboard.timestamp = Date.now();
            this.cutClipboard.sourceId = currentCut.id;
            
            if (this.eventBus) {
                this.eventBus.emit('cut:copied', {
                    cutId: currentCut.id,
                    cutName: currentCut.name
                });
            }
            
            return true;
        }
        
        pasteRightAdjacent() {
            if (!this.cutClipboard.cutData) return false;
            
            const insertIndex = this.animationData.playback.currentCutIndex + 1;
            const pastedCut = this.createCutFromClipboard(this.cutClipboard.cutData);
            if (!pastedCut) return false;
            
            this.animationData.cuts.splice(insertIndex, 0, pastedCut);
            this.switchToActiveCutSafely(insertIndex, false);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:pasted-right-adjacent', {
                    cutId: pastedCut.id,
                    cutIndex: insertIndex
                });
            }
            
            return true;
        }
        
        pasteAsNew() {
            if (!this.cutClipboard.cutData) return false;
            
            const pastedCut = this.createCutFromClipboard(this.cutClipboard.cutData);
            if (!pastedCut) return false;
            
            this.animationData.cuts.push(pastedCut);
            const newIndex = this.animationData.cuts.length - 1;
            this.switchToActiveCutSafely(newIndex, false);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:pasted-new', {
                    cutId: pastedCut.id,
                    cutIndex: newIndex
                });
            }
            
            return true;
        }
        
        deepCopyCutData(cutData) {
            if (!cutData) return null;
            
            return {
                name: cutData.name,
                duration: cutData.duration,
                layers: this.deepCloneCutLayers(cutData.layers),
                thumbnailCanvas: null,
                originalId: cutData.id
            };
        }
        
        createCutFromClipboard(clipboardData) {
            if (!clipboardData) return null;
            
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const newLayers = clipboardData.layers.map(layerData => ({
                ...layerData,
                id: this.generateUniqueCutLayerId(cutId),
                cutId: cutId
            }));
            
            const cut = {
                id: cutId,
                name: clipboardData.name + '_copy',
                duration: clipboardData.duration,
                layers: newLayers,
                thumbnailCanvas: null
            };
            
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(newLayers));
            
            setTimeout(() => {
                const cutIndex = this.animationData.cuts.findIndex(c => c.id === cut.id);
                if (cutIndex !== -1) {
                    this.generateCutThumbnailOptimized(cutIndex);
                }
            }, 200);
            
            return cut;
        }
        
        // ===== CUT管理・プレイバック =====
        
        createInitialCutIfNeeded() {
            if (this.initialCutCreated || this.animationData.cuts.length > 0 || this.isInitializing) {
                return;
            }
            
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                return;
            }
            
            this.isInitializing = true;
            
            const initialCut = this.createNewCutFromCurrentLayers();
            this.initialCutCreated = true;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:initial-cut-created', { 
                    cutId: initialCut.id,
                    cutIndex: 0
                });
            }
            
            this.isInitializing = false;
        }
        
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return false;
            if (this.animationData.cuts.length <= 1) return false;
            
            const cut = this.animationData.cuts[cutIndex];
            
            this.cutLayerStates.delete(cut.id);
            this.cutLayerIdCounters.delete(cut.id);
            this.animationData.cuts.splice(cutIndex, 1);
            
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            if (this.animationData.cuts.length > 0) {
                const newIndex = Math.min(cutIndex, this.animationData.cuts.length - 1);
                this.switchToActiveCutSafely(newIndex, false);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            return true;
        }
        
        play() {
            if (this.animationData.cuts.length === 0) return;
            
            this.animationData.playback.isPlaying = true;
            this.animationData.playback.startTime = Date.now();
            this.startPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-started');
            }
        }
        
        pause() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.animationData.playback.currentCutIndex;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-paused');
            }
        }
        
        stop() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.animationData.playback.currentCutIndex;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-stopped');
            }
        }
        
        togglePlayStop() {
            if (this.animationData.playback.isPlaying) {
                this.stop();
            } else {
                this.play();
            }
        }
        
        startPlaybackLoop() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
            }
            
            const frameTime = 1000 / 12;
            
            this.playbackTimer = setInterval(() => {
                this.updatePlayback();
            }, frameTime);
        }
        
        stopPlaybackLoop() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
                this.playbackTimer = null;
            }
        }
        
        updatePlayback() {
            if (!this.animationData.playback.isPlaying) return;
            
            const currentCut = this.animationData.cuts[this.animationData.playback.currentCutIndex];
            if (!currentCut) return;
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            if (elapsed >= currentCut.duration) {
                this.animationData.playback.currentCutIndex++;
                
                if (this.animationData.playback.currentCutIndex >= this.animationData.cuts.length) {
                    if (this.animationData.settings.loop) {
                        this.animationData.playback.currentCutIndex = 0;
                    } else {
                        this.stop();
                        return;
                    }
                }
                
                this.animationData.playback.startTime = Date.now();
                this.switchToActiveCutSafely(this.animationData.playback.currentCutIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-changed', { 
                        cutIndex: this.animationData.playback.currentCutIndex 
                    });
                }
            }
        }
        
        goToPreviousFrame() {
            if (this.animationData.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentCutIndex - 1;
            if (newIndex < 0) {
                newIndex = this.animationData.cuts.length - 1;
            }
            
            this.animationData.playback.currentCutIndex = newIndex;
            this.switchToActiveCutSafely(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    cutIndex: newIndex, 
                    direction: 'previous' 
                });
            }
        }
        
        goToNextFrame() {
            if (this.animationData.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentCutIndex + 1;
            if (newIndex >= this.animationData.cuts.length) {
                newIndex = 0;
            }
            
            this.animationData.playback.currentCutIndex = newIndex;
            this.switchToActiveCutSafely(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    cutIndex: newIndex, 
                    direction: 'next' 
                });
            }
        }
        
        updateCutDuration(cutIndex, duration) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            cut.duration = Math.max(0.1, Math.min(10, duration));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-duration-changed', { 
                    cutIndex, 
                    duration: cut.duration 
                });
            }
        }
        
        addLayerToCurrentCut(layerData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            const cutLayerId = this.generateUniqueCutLayerId(currentCut.id);
            
            const cutLayerData = {
                id: cutLayerId,
                name: layerData.name || 'New Layer',
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                isBackground: layerData.isBackground || false,
                transform: layerData.transform || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                paths: layerData.paths || [],
                createdAt: Date.now(),
                cutId: currentCut.id
            };
            
            currentCut.layers.push(cutLayerData);
            
            const currentState = this.cutLayerStates.get(currentCut.id) || [];
            currentState.push({ ...cutLayerData });
            this.cutLayerStates.set(currentCut.id, currentState);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:layer-added-to-cut', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerId: cutLayerId
                });
            }
            
            return cutLayerData;
        }
        
        updateCurrentCutLayer(layerIndex, updateData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            if (layerIndex < 0 || layerIndex >= this.layerSystem.layers.length) return;
            
            const layer = this.layerSystem.layers[layerIndex];
            if (!layer?.layerData) return;
            
            this.saveCutLayerStates();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:current-cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex: layerIndex,
                    layerId: layer.layerData.id
                });
            }
            
            return this.getCurrentCut();
        }
        
        reorderCuts(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            if (oldIndex < 0 || oldIndex >= this.animationData.cuts.length) return;
            if (newIndex < 0 || newIndex >= this.animationData.cuts.length) return;
            
            const [movedCut] = this.animationData.cuts.splice(oldIndex, 1);
            this.animationData.cuts.splice(newIndex, 0, movedCut);
            
            if (this.animationData.playback.currentCutIndex === oldIndex) {
                this.animationData.playback.currentCutIndex = newIndex;
            } else if (oldIndex < this.animationData.playback.currentCutIndex && 
                       newIndex >= this.animationData.playback.currentCutIndex) {
                this.animationData.playback.currentCutIndex--;
            } else if (oldIndex > this.animationData.playback.currentCutIndex && 
                       newIndex <= this.animationData.playback.currentCutIndex) {
                this.animationData.playback.currentCutIndex++;
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cuts-reordered', { 
                    oldIndex, 
                    newIndex,
                    currentCutIndex: this.animationData.playback.currentCutIndex
                });
            }
        }
        
        updateSettings(settings) {
            if (!settings) return;
            Object.assign(this.animationData.settings, settings);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:settings-updated', { settings });
            }
        }
        
        // ===== Getters =====
        
        getAnimationData() { return this.animationData; }
        getCurrentCutIndex() { return this.animationData.playback.currentCutIndex; }
        getCutCount() { return this.animationData.cuts.length; }
        getCurrentCut() { return this.animationData.cuts[this.animationData.playback.currentCutIndex] || null; }
        getCurrentCutLayers() {
            const currentCut = this.getCurrentCut();
            return currentCut ? currentCut.layers : [];
        }
        hasInitialCut() { return this.animationData.cuts.length > 0; }
        getAllCuts() { return this.animationData.cuts; }
        
        getCutInfo(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return null;
            
            return {
                id: cut.id,
                name: cut.name,
                duration: cut.duration,
                layerCount: cut.layers?.length || 0,
                thumbnailCanvas: cut.thumbnailCanvas,
                isActive: cutIndex === this.animationData.playback.currentCutIndex
            };
        }
        
        getPlaybackState() {
            return {
                isPlaying: this.animationData.playback.isPlaying,
                currentCutIndex: this.animationData.playback.currentCutIndex,
                loop: this.animationData.settings.loop,
                cutsCount: this.animationData.cuts.length
            };
        }
        
        isInAnimationMode() { return this.isAnimationMode; }
        
        toggleAnimationMode() {
            this.isAnimationMode = !this.isAnimationMode;
            
            if (this.isAnimationMode) {
                this.createInitialCutIfNeeded();
                if (this.eventBus) {
                    this.eventBus.emit('animation:mode-entered');
                }
            } else {
                if (this.animationData.playback.isPlaying) {
                    this.stop();
                }
                if (this.eventBus) {
                    this.eventBus.emit('animation:mode-exited');
                }
            }
            
            return this.isAnimationMode;
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    console.log('✅ AnimationSystem Phase 2: CUT×Layer完全独立版 (Deep Copy修正版) loaded');

})();