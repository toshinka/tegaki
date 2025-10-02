// ===== system/animation-system.js - Phase 1 Step 1.2: SSoT API明確化版 =====
// 【改修】DataUtils統合・読み取り専用API・copy-on-write実装
// 【改修】getFrame()は常にdeep cloneを返す
// 【改修】updateFrame()はcopy-on-writeで新しいオブジェクトを作成
// 【維持】既存機能はすべて保持
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
            
            // DataUtils参照（Phase 1 Step 1.1で追加）
            this.dataUtils = window.DataUtils;
            
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
            
            // Phase 1 Step 1.2: データ検証フラグ
            this.enableDataValidation = true;
        }
        
        init(layerSystem, app) {
            if (this.hasInitialized) return;
            
            this.layerSystem = layerSystem;
            this.app = app;
            
            if (!this.eventBus || !this.layerSystem?.layers) {
                console.error('Required dependencies not available');
                return;
            }
            
            // DataUtils利用可能性チェック
            if (!this.dataUtils) {
                console.warn('DataUtils not available - using fallback deep clone');
                this.dataUtils = {
                    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
                    validateLayerState: () => ({ valid: true, errors: [] }),
                    checkDataIntegrity: (data) => ({ valid: true, pointsCount: 0 })
                };
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
        
        // ===== Phase 1 Step 1.2: 新規追加API =====
        
        /**
         * Frameの読み取り専用取得（deep cloneを返す）
         * SSoTとして外部からの直接変更を防ぐ
         */
        getFrame(cutIndex, frameIndex = 0) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) {
                return null;
            }
            
            // 現在のシステムはCUT単位なのでframeIndex=0固定
            // 将来的に複数フレーム対応時にはcut.frames[frameIndex]を返す
            const frame = {
                index: frameIndex,
                cutId: cut.id,
                layers: cut.layers || []
            };
            
            // Deep cloneして返す（元データを保護）
            return this.dataUtils.deepClone(frame);
        }
        
        /**
         * Frameの更新（copy-on-write）
         * 新しいFrameオブジェクトを作成して内部参照を更新
         */
        updateFrame(cutIndex, frameIndex = 0, patch) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) {
                console.error(`Cut ${cutIndex} not found`);
                return null;
            }
            
            // 現在のFrameを取得（deep clone）
            const oldFrame = this.getFrame(cutIndex, frameIndex);
            if (!oldFrame) {
                return null;
            }
            
            // 検証（オプション）
            if (this.enableDataValidation && patch.layers) {
                const validation = this._validateLayersPatch(patch.layers);
                if (!validation.valid) {
                    console.error('Invalid layers patch:', validation.errors);
                    return null;
                }
            }
            
            // 新しいFrameを作成（copy-on-write）
            const newFrame = {
                ...oldFrame,
                ...patch
            };
            
            // CUTに反映
            if (patch.layers) {
                cut.layers = this.dataUtils.deepClone(patch.layers);
                this.cutLayerStates.set(cut.id, this.dataUtils.deepClone(patch.layers));
            }
            
            // イベント発火
            if (this.eventBus) {
                this.eventBus.emit('animation:frame:updated', {
                    cutIndex,
                    frameIndex,
                    cutId: cut.id,
                    newFrame: this.dataUtils.deepClone(newFrame)
                });
            }
            
            return this.dataUtils.deepClone(newFrame);
        }
        
        /**
         * レイヤーの部分更新
         */
        updateLayerInFrame(cutIndex, frameIndex, layerIndex, patch) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !cut.layers || layerIndex < 0 || layerIndex >= cut.layers.length) {
                console.error('Invalid layer index or cut not found');
                return null;
            }
            
            // 現在のレイヤーを取得（deep clone）
            const oldLayer = this.dataUtils.deepClone(cut.layers[layerIndex]);
            
            // 新しいレイヤーを作成（copy-on-write）
            const newLayer = {
                ...oldLayer,
                ...patch
            };
            
            // 検証
            if (this.enableDataValidation) {
                const validation = this.dataUtils.validateLayerState(newLayer);
                if (!validation.valid) {
                    console.error('Invalid layer state:', validation.errors);
                    return null;
                }
            }
            
            // 更新
            cut.layers[layerIndex] = this.dataUtils.deepClone(newLayer);
            
            // cutLayerStatesも更新
            const cutLayers = this.cutLayerStates.get(cut.id) || [];
            if (cutLayers[layerIndex]) {
                cutLayers[layerIndex] = this.dataUtils.deepClone(newLayer);
                this.cutLayerStates.set(cut.id, cutLayers);
            }
            
            // イベント発火
            if (this.eventBus) {
                this.eventBus.emit('animation:layer:updated', {
                    cutIndex,
                    frameIndex,
                    layerIndex,
                    layerId: newLayer.id
                });
            }
            
            return this.dataUtils.deepClone(newLayer);
        }
        
        /**
         * レイヤー削除
         */
        deleteLayerFromFrame(cutIndex, frameIndex, layerIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !cut.layers || layerIndex < 0 || layerIndex >= cut.layers.length) {
                return false;
            }
            
            // 最低1レイヤーは残す
            if (cut.layers.length <= 1) {
                console.warn('Cannot delete last layer');
                return false;
            }
            
            const deletedLayer = cut.layers[layerIndex];
            cut.layers.splice(layerIndex, 1);
            
            // cutLayerStatesも更新
            const cutLayers = this.cutLayerStates.get(cut.id) || [];
            if (cutLayers[layerIndex]) {
                cutLayers.splice(layerIndex, 1);
                this.cutLayerStates.set(cut.id, cutLayers);
            }
            
            // イベント発火
            if (this.eventBus) {
                this.eventBus.emit('animation:layer:deleted', {
                    cutIndex,
                    frameIndex,
                    layerIndex,
                    layerId: deletedLayer.id
                });
            }
            
            return true;
        }
        
        /**
         * Layersパッチの検証
         */
        _validateLayersPatch(layers) {
            if (!Array.isArray(layers)) {
                return { valid: false, errors: ['Layers must be array'] };
            }
            
            const errors = [];
            layers.forEach((layer, index) => {
                const validation = this.dataUtils.validateLayerState(layer);
                if (!validation.valid) {
                    errors.push(`Layer[${index}]: ${validation.errors.join(', ')}`);
                }
            });
            
            return {
                valid: errors.length === 0,
                errors
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
            
            // Phase 1 Step 1.2: DataUtilsを使用したdeep clone
            this.cutLayerStates.set(cutId, this.dataUtils.deepClone(independentLayers));
            
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
            
            // Phase 1 Step 1.2: DataUtilsを使用
            this.cutLayerStates.set(cutId, this.dataUtils.deepClone(initialLayers));
            
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
        
        // ===== Deep Copy関連 - Phase 1 Step 1.2: DataUtils統合 =====
        
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
                
                // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
                const independentPaths = originalLayer.layerData.paths ? 
                    this.dataUtils.deepClone(originalLayer.layerData.paths).map(path => ({
                        ...path,
                        id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                    })) : [];
                
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
        
        deepCloneCutLayers(cutLayers) {
            if (!cutLayers || !Array.isArray(cutLayers)) return [];
            
            // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
            return this.dataUtils.deepClone(cutLayers);
        }
        
        generateUniqueCutLayerId(cutId) {
            if (!this.cutLayerIdCounters.has(cutId)) {
                this.cutLayerIdCounters.set(cutId, 0);
            }
            
            const counter = this.cutLayerIdCounters.get(cutId);
            this.cutLayerIdCounters.set(cutId, counter + 1);
            
            return `${cutId}_layer_${counter}_${Date.now()}`;
        }
        
        // ===== CUT切替 =====
        
        switchToActiveCutSafely(cutIndex, resetTransform = false) {
            if (this.cutSwitchInProgress) {
                setTimeout(() => this.switchToActiveCutSafely(cutIndex, resetTransform), 50);
                return;
            }
            
            const targetCut = this.animationData.cuts[cutIndex];
            if (!targetCut || !this.layerSystem) return;
            
            this.cutSwitchInProgress = true;
            
            this.saveCutLayerStatesBeforeSwitch();
            this.animationData.playback.currentCutIndex = cutIndex;
            this.setActiveCut(cutIndex, resetTransform);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex, cutId: targetCut.id });
            }
            
            this.cutSwitchInProgress = false;
        }
        
        saveCutLayerStatesBeforeSwitch() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const currentIndependentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            
            // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
            currentCut.layers = this.dataUtils.deepClone(currentIndependentState);
            this.cutLayerStates.set(currentCut.id, this.dataUtils.deepClone(currentIndependentState));
        }
        
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const currentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            
            // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
            currentCut.layers = this.dataUtils.deepClone(currentState);
            this.cutLayerStates.set(currentCut.id, this.dataUtils.deepClone(currentState));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        setActiveCut(cutIndex, resetTransform = false) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            this.clearLayerSystemLayers();
            
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
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
        
        rebuildLayersFromCutData(cutLayers, resetTransform = false) {
            if (!cutLayers || !Array.isArray(cutLayers) || cutLayers.length === 0) {
                return;
            }
            
            cutLayers.forEach((cutLayerData, index) => {
                const layer = new PIXI.Container();
                layer.label = cutLayerData.id;
                
                // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
                layer.layerData = this.dataUtils.deepClone({
                    id: cutLayerData.id,
                    name: cutLayerData.name || `レイヤー${index + 1}`,
                    visible: cutLayerData.visible !== false,
                    opacity: cutLayerData.opacity || 1.0,
                    isBackground: cutLayerData.isBackground || false,
                    paths: []
                });
                
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
        
        rebuildPathFromData(pathData) {
            if (!pathData?.points || !Array.isArray(pathData.points) || pathData.points.length === 0) {
                return null;
            }
            
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
            
            // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
            return {
                id: pathData.id || ('path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
                points: this.dataUtils.deepClone(pathData.points),
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
            
            // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
            return {
                name: cutData.name,
                duration: cutData.duration,
                layers: this.dataUtils.deepClone(cutData.layers),
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
            
            // Phase 1 Step 1.2: DataUtilsのdeepCloneを使用
            this.cutLayerStates.set(cutId, this.dataUtils.deepClone(newLayers));
            
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
    console.log('✅ AnimationSystem Phase 1 Step 1.2: SSoT API明確化版 loaded');
    console.log('   - DataUtils統合完了');
    console.log('   - getFrame(): 読み取り専用API（deep clone返却）');
    console.log('   - updateFrame(): copy-on-write実装');
    console.log('   - updateLayerInFrame(): レイヤー部分更新');
    console.log('   - deleteLayerFromFrame(): レイヤー削除');
    console.log('   - データ検証機能追加');

})();