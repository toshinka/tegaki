// ================================================================================
// system/animation-system.js - Phase 2: StateManager統合版
// ================================================================================
// 🎯 StateManagerからデータを読み取り専用で取得
// ✅ Command経由でのみデータ変更
// ✅ Playback状態管理とタイミング制御に専念

(function() {
    'use strict';
    
    // CUT用のPixi Containerラッパー（描画用のみ）
    class CutContainer {
        constructor(cutId, config) {
            this.id = cutId;
            this.container = new PIXI.Container();
            this.container.label = `cut_${cutId}`;
            this.container.sortableChildren = true;
            this.thumbnailCanvas = null;
            this.config = config;
        }
        
        destroy() {
            if (this.container) {
                this.container.destroy({ children: true });
            }
            this.thumbnailCanvas = null;
        }
    }
    
    class AnimationSystem {
        constructor(pixiApp, config, stateManager, eventBus) {
            this.app = pixiApp;
            this.config = config;
            this.stateManager = stateManager;
            this.eventBus = eventBus;
            
            // Pixi描画用コンテナマップ
            this.cutContainers = new Map();
            
            // Playback状態のみ管理
            this.playback = {
                isPlaying: false,
                startTime: 0,
                currentFrame: 0
            };
            
            this.playbackTimer = null;
            this.isAnimationMode = false;
            this.lastStoppedCutIndex = 0;
            
            // CUTクリップボード
            this.cutClipboard = {
                cutData: null,
                timestamp: null,
                sourceId: null
            };
            
            // 他システム参照
            this.layerSystem = null;
            this.cameraSystem = null;
            this.canvasContainer = null;
            
            this.coordAPI = window.CoordinateSystem;
            
            // StateManager変更監視
            this.stateManager.addListener((state, source) => {
                this.onStateChanged(state, source);
            });
            
            this.setupCanvasResizeListener();
            this.setupCutClipboardEvents();
        }
        
        // ===== StateManager変更監視 =====
        
        onStateChanged(state, source) {
            // CUT作成時
            if (source === 'cut:added') {
                this.syncCutsFromState(state);
                return;
            }
            
            // CUT削除時
            if (source === 'cut:removed') {
                this.syncCutsFromState(state);
                return;
            }
            
            // CUT並び替え時
            if (source === 'cut:reordered') {
                this.syncCutsFromState(state);
                return;
            }
            
            // CUT切り替え時
            if (source === 'active-cut:changed') {
                this.switchToActiveCut(state.currentCutIndex);
                return;
            }
            
            // History Undo/Redo時は完全再構築
            if (source === 'history:undo' || source === 'history:redo') {
                this.rebuildFromState(state);
                return;
            }
        }
        
        rebuildFromState(state) {
            // 既存のCUTコンテナを全削除
            this.cutContainers.forEach((cutContainer, cutId) => {
                if (this.canvasContainer && cutContainer.container.parent === this.canvasContainer) {
                    this.canvasContainer.removeChild(cutContainer.container);
                }
                cutContainer.destroy();
                
                if (this.layerSystem?.destroyCutRenderTexture) {
                    this.layerSystem.destroyCutRenderTexture(cutId);
                }
            });
            this.cutContainers.clear();
            
            // StateからCUTを再構築
            state.cuts.forEach((cutData) => {
                const cutContainer = this.createCutContainerFromData(cutData);
                this.cutContainers.set(cutData.id, cutContainer);
                
                if (this.canvasContainer) {
                    this.canvasContainer.addChild(cutContainer.container);
                    cutContainer.container.visible = false;
                }
                
                if (this.layerSystem?.createCutRenderTexture) {
                    this.layerSystem.createCutRenderTexture(cutData.id);
                }
            });
            
            // アクティブCUTを表示
            if (state.cuts.length > 0) {
                this.switchToActiveCut(state.currentCutIndex);
            }
        }
        
        syncCutsFromState(state) {
            // 既存のCUTと差分を確認
            const stateCutIds = new Set(state.cuts.map(c => c.id));
            const containerCutIds = new Set(this.cutContainers.keys());
            
            // 削除されたCUT
            containerCutIds.forEach(cutId => {
                if (!stateCutIds.has(cutId)) {
                    const cutContainer = this.cutContainers.get(cutId);
                    if (cutContainer) {
                        if (this.canvasContainer && cutContainer.container.parent === this.canvasContainer) {
                            this.canvasContainer.removeChild(cutContainer.container);
                        }
                        cutContainer.destroy();
                        
                        if (this.layerSystem?.destroyCutRenderTexture) {
                            this.layerSystem.destroyCutRenderTexture(cutId);
                        }
                    }
                    this.cutContainers.delete(cutId);
                }
            });
            
            // 追加されたCUT
            state.cuts.forEach((cutData, index) => {
                if (!this.cutContainers.has(cutData.id)) {
                    const cutContainer = this.createCutContainerFromData(cutData);
                    this.cutContainers.set(cutData.id, cutContainer);
                    
                    if (this.canvasContainer) {
                        this.canvasContainer.addChild(cutContainer.container);
                        cutContainer.container.visible = false;
                    }
                    
                    if (this.layerSystem?.createCutRenderTexture) {
                        this.layerSystem.createCutRenderTexture(cutData.id);
                    }
                    
                    // サムネイル生成
                    setTimeout(() => {
                        this.generateCutThumbnail(index);
                    }, 100);
                }
            });
        }
        
        createCutContainerFromData(cutData) {
            const cutContainer = new CutContainer(cutData.id, this.config);
            
            // レイヤーを再構築
            cutData.layers.forEach(layerData => {
                const pixiLayer = this.createPixiLayerFromData(layerData);
                cutContainer.container.addChild(pixiLayer);
            });
            
            return cutContainer;
        }
        
        createPixiLayerFromData(layerData) {
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            
            // Transform適用
            if (layerData.transform) {
                layer.position.set(layerData.transform.x, layerData.transform.y);
                layer.rotation = layerData.transform.rotation;
                layer.scale.set(layerData.transform.scaleX, layerData.transform.scaleY);
                layer.pivot.set(layerData.transform.pivotX, layerData.transform.pivotY);
            }
            
            layer.visible = layerData.visible;
            layer.alpha = layerData.opacity;
            
            // 背景レイヤー
            if (layerData.isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
            }
            
            // Pathsを描画
            if (layerData.paths && Array.isArray(layerData.paths)) {
                layerData.paths.forEach(pathData => {
                    const graphics = this.createGraphicsFromPath(pathData);
                    if (graphics) {
                        layer.addChild(graphics);
                    }
                });
            }
            
            return layer;
        }
        
        createGraphicsFromPath(pathData) {
            if (!pathData || !pathData.points || pathData.points.length === 0) {
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
            
            return graphics;
        }
        
        // ===== CUT取得（StateManagerから）=====
        
        getAllCuts() {
            return this.stateManager.getAllCuts();
        }
        
        getCurrentCut() {
            return this.stateManager.getCurrentCut();
        }
        
        getCurrentCutIndex() {
            return this.stateManager.getCurrentCutIndex();
        }
        
        getCutCount() {
            return this.stateManager.state.cuts.length;
        }
        
        getCutInfo(cutIndex) {
            const cutData = this.stateManager.getCut(cutIndex);
            if (!cutData) return null;
            
            const cutContainer = this.cutContainers.get(cutData.id);
            
            return {
                id: cutData.id,
                name: cutData.name,
                duration: cutData.duration,
                layerCount: cutData.layers.length,
                thumbnailCanvas: cutContainer?.thumbnailCanvas || null,
                isActive: cutIndex === this.stateManager.getCurrentCutIndex()
            };
        }
        
        // ===== CUT作成（Command経由）=====
        
        createNewBlankCut() {
            const cutData = {
                id: `cut_${Date.now()}`,
                name: `CUT${this.stateManager.state.cuts.length + 1}`,
                duration: 0.5,
                layers: [
                    {
                        id: `layer_${Date.now()}_bg`,
                        name: '背景',
                        visible: true,
                        opacity: 1.0,
                        isBackground: true,
                        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
                        paths: []
                    },
                    {
                        id: `layer_${Date.now() + 1}`,
                        name: 'レイヤー1',
                        visible: true,
                        opacity: 1.0,
                        isBackground: false,
                        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
                        paths: []
                    }
                ]
            };
            
            const command = new window.CreateCutCommand(
                this.stateManager,
                this.eventBus,
                cutData
            );
            
            window.History.executeCommand(command);
        }
        
        createNewCutFromCurrentLayers() {
            const currentLayers = this.stateManager.getCurrentLayers();
            
            const cutData = {
                id: `cut_${Date.now()}`,
                name: `CUT${this.stateManager.state.cuts.length + 1}`,
                duration: 0.5,
                layers: JSON.parse(JSON.stringify(currentLayers)) // Deep copy
            };
            
            const command = new window.CreateCutCommand(
                this.stateManager,
                this.eventBus,
                cutData
            );
            
            window.History.executeCommand(command);
        }
        
        createNewEmptyCut() {
            this.createNewBlankCut();
        }
        
        // ===== CUT削除（Command経由）=====
        
        deleteCut(cutIndex) {
            if (this.stateManager.state.cuts.length <= 1) {
                return false;
            }
            
            const command = new window.DeleteCutCommand(
                this.stateManager,
                this.eventBus,
                cutIndex
            );
            
            window.History.executeCommand(command);
            return true;
        }
        
        // ===== CUT切り替え =====
        
        switchToActiveCut(cutIndex) {
            const cuts = this.stateManager.getAllCuts();
            
            if (cutIndex < 0 || cutIndex >= cuts.length) {
                return;
            }
            
            // 全CUTを非表示
            this.cutContainers.forEach((cutContainer) => {
                cutContainer.container.visible = false;
            });
            
            const cutData = cuts[cutIndex];
            const cutContainer = this.cutContainers.get(cutData.id);
            
            if (cutContainer) {
                cutContainer.container.visible = true;
                
                // LayerSystemに現在のCUTコンテナを設定
                if (this.layerSystem) {
                    this.layerSystem.setCurrentCutContainer(cutContainer.container);
                }
                
                this.eventBus.emit('animation:cut-applied', { cutIndex, cutId: cutData.id });
            }
        }
        
        // ===== CUT並び替え（Command経由）=====
        
        reorderCuts(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            
            const command = new window.ReorderCutsCommand(
                this.stateManager,
                this.eventBus,
                oldIndex,
                newIndex
            );
            
            window.History.executeCommand(command);
        }
        
        // ===== CUT名前一括変更 =====
        
        renameCutsSequentially() {
            const cuts = this.stateManager.getAllCuts();
            
            cuts.forEach((cutData, index) => {
                const command = new window.UpdateCutCommand(
                    this.stateManager,
                    this.eventBus,
                    index,
                    { name: `CUT${index + 1}` }
                );
                window.History.executeCommand(command);
            });
        }
        
        // ===== CUT duration更新 =====
        
        updateCutDuration(cutIndex, duration) {
            const clampedDuration = Math.max(0.01, Math.min(10, duration));
            
            const command = new window.UpdateCutCommand(
                this.stateManager,
                this.eventBus,
                cutIndex,
                { duration: clampedDuration }
            );
            
            window.History.executeCommand(command);
        }
        
        retimeAllCuts(newDuration) {
            const cuts = this.stateManager.getAllCuts();
            const clampedDuration = Math.max(0.01, Math.min(10, newDuration));
            
            cuts.forEach((cutData, index) => {
                const command = new window.UpdateCutCommand(
                    this.stateManager,
                    this.eventBus,
                    index,
                    { duration: clampedDuration }
                );
                window.History.executeCommand(command);
            });
        }
        
        // ===== CUTクリップボード =====
        
        copyCurrent() {
            const currentCut = this.stateManager.getCurrentCut();
            if (!currentCut) return false;
            
            this.cutClipboard.cutData = JSON.parse(JSON.stringify(currentCut));
            this.cutClipboard.timestamp = Date.now();
            this.cutClipboard.sourceId = currentCut.id;
            
            this.eventBus.emit('cut:copied', {
                cutId: currentCut.id,
                cutName: currentCut.name
            });
            
            return true;
        }
        
        pasteRightAdjacent() {
            if (!this.cutClipboard.cutData) return false;
            
            const insertIndex = this.stateManager.getCurrentCutIndex() + 1;
            const pastedCutData = this.createCutDataFromClipboard(this.cutClipboard.cutData);
            
            const command = new window.CreateCutCommand(
                this.stateManager,
                this.eventBus,
                pastedCutData,
                insertIndex
            );
            
            window.History.executeCommand(command);
            
            this.eventBus.emit('cut:pasted-right-adjacent', {
                cutId: pastedCutData.id,
                cutIndex: insertIndex
            });
            
            return true;
        }
        
        pasteAsNew() {
            if (!this.cutClipboard.cutData) return false;
            
            const pastedCutData = this.createCutDataFromClipboard(this.cutClipboard.cutData);
            
            const command = new window.CreateCutCommand(
                this.stateManager,
                this.eventBus,
                pastedCutData
            );
            
            window.History.executeCommand(command);
            
            this.eventBus.emit('cut:pasted-new', {
                cutId: pastedCutData.id
            });
            
            return true;
        }
        
        createCutDataFromClipboard(clipboardData) {
            const baseName = clipboardData.name.replace(/_copy$/, '').replace(/\(\d+\)$/, '');
            
            let copyCount = 0;
            const cuts = this.stateManager.getAllCuts();
            for (const cut of cuts) {
                const cutBaseName = cut.name.replace(/\(\d+\)$/, '');
                if (cutBaseName === baseName) {
                    const match = cut.name.match(/\((\d+)\)$/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > copyCount) copyCount = num;
                    }
                }
            }
            
            const newName = `${baseName}(${copyCount + 1})`;
            
            return {
                id: `cut_${Date.now()}`,
                name: newName,
                duration: clipboardData.duration,
                layers: JSON.parse(JSON.stringify(clipboardData.layers))
            };
        }
        
        // ===== サムネイル生成 =====
        
        async generateCutThumbnail(cutIndex) {
            const cutData = this.stateManager.getCut(cutIndex);
            if (!cutData || !this.app?.renderer) return;
            
            const cutContainer = this.cutContainers.get(cutData.id);
            if (!cutContainer) return;
            
            // RenderTextureに描画
            if (this.layerSystem?.renderCutToTexture) {
                this.layerSystem.renderCutToTexture(cutData.id, cutContainer.container);
            }
            
            const renderTexture = this.layerSystem?.getCutRenderTexture?.(cutData.id);
            if (!renderTexture) return;
            
            const canvasSize = {
                width: this.config.canvas.width,
                height: this.config.canvas.height
            };
            
            const { thumbDisplayW, thumbDisplayH } = this.calculateThumbnailSize(
                canvasSize.width,
                canvasSize.height
            );
            
            const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
            
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbDisplayW;
            thumbCanvas.height = thumbDisplayH;
            
            const ctx = thumbCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            const srcAspect = sourceCanvas.width / sourceCanvas.height;
            const dstAspect = thumbDisplayW / thumbDisplayH;
            
            let drawW, drawH, offsetX = 0, offsetY = 0;
            
            if (srcAspect > dstAspect) {
                drawW = thumbDisplayW;
                drawH = thumbDisplayW / srcAspect;
                offsetY = (thumbDisplayH - drawH) / 2;
            } else {
                drawH = thumbDisplayH;
                drawW = thumbDisplayH * srcAspect;
                offsetX = (thumbDisplayW - drawW) / 2;
            }
            
            ctx.clearRect(0, 0, thumbDisplayW, thumbDisplayH);
            ctx.drawImage(
                sourceCanvas,
                0, 0, sourceCanvas.width, sourceCanvas.height,
                offsetX, offsetY, drawW, drawH
            );
            
            cutContainer.thumbnailCanvas = thumbCanvas;
            
            if (this.layerSystem?.clearCutThumbnailDirty) {
                this.layerSystem.clearCutThumbnailDirty(cutData.id);
            }
            
            this.eventBus.emit('animation:thumbnail-generated', {
                cutIndex,
                thumbSize: { width: thumbDisplayW, height: thumbDisplayH }
            });
        }
        
        calculateThumbnailSize(canvasWidth, canvasHeight) {
            const aspectRatio = canvasWidth / canvasHeight;
            
            const MAX_THUMB_WIDTH = 72;
            const MAX_THUMB_HEIGHT = 54;
            
            let thumbDisplayW, thumbDisplayH;
            
            if (aspectRatio >= MAX_THUMB_WIDTH / MAX_THUMB_HEIGHT) {
                thumbDisplayW = MAX_THUMB_WIDTH;
                thumbDisplayH = Math.round(MAX_THUMB_WIDTH / aspectRatio);
            } else {
                thumbDisplayH = MAX_THUMB_HEIGHT;
                thumbDisplayW = Math.round(MAX_THUMB_HEIGHT * aspectRatio);
            }
            
            return { thumbDisplayW, thumbDisplayH };
        }
        
        async regenerateAllThumbnails() {
            const cuts = this.stateManager.getAllCuts();
            
            for (let i = 0; i < cuts.length; i++) {
                await this.generateCutThumbnail(i);
                
                if (i < cuts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }
        
        // ===== Playback制御 =====
        
        play() {
            if (this.stateManager.state.cuts.length === 0) return;
            
            this.playback.isPlaying = true;
            this.playback.startTime = Date.now();
            this.startPlaybackLoop();
            
            this.eventBus.emit('animation:playback-started');
        }
        
        pause() {
            this.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.stateManager.getCurrentCutIndex();
            this.stopPlaybackLoop();
            
            this.eventBus.emit('animation:playback-paused');
        }
        
        stop() {
            this.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.stateManager.getCurrentCutIndex();
            this.stopPlaybackLoop();
            
            this.eventBus.emit('animation:playback-stopped');
        }
        
        togglePlayStop() {
            if (this.playback.isPlaying) {
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
            if (!this.playback.isPlaying) return;
            
            const currentCutIndex = this.stateManager.getCurrentCutIndex();
            const currentCut = this.stateManager.getCut(currentCutIndex);
            if (!currentCut) return;
            
            const elapsed = (Date.now() - this.playback.startTime) / 1000;
            
            if (elapsed >= currentCut.duration) {
                let nextIndex = currentCutIndex + 1;
                
                if (nextIndex >= this.stateManager.state.cuts.length) {
                    if (this.stateManager.state.settings.loop) {
                        nextIndex = 0;
                    } else {
                        this.stop();
                        return;
                    }
                }
                
                this.playback.startTime = Date.now();
                this.stateManager.setActiveCut(nextIndex);
                
                this.eventBus.emit('animation:cut-changed', {
                    cutIndex: nextIndex
                });
            }
        }
        
        goToPreviousFrame() {
            if (this.stateManager.state.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.playback.isPlaying = false;
            
            const currentIndex = this.stateManager.getCurrentCutIndex();
            let newIndex = currentIndex - 1;
            if (newIndex < 0) {
                newIndex = this.stateManager.state.cuts.length - 1;
            }
            
            this.stateManager.setActiveCut(newIndex);
            
            this.eventBus.emit('animation:frame-changed', {
                cutIndex: newIndex,
                direction: 'previous'
            });
        }
        
        goToNextFrame() {
            if (this.stateManager.state.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.playback.isPlaying = false;
            
            const currentIndex = this.stateManager.getCurrentCutIndex();
            let newIndex = currentIndex + 1;
            if (newIndex >= this.stateManager.state.cuts.length) {
                newIndex = 0;
            }
            
            this.stateManager.setActiveCut(newIndex);
            
            this.eventBus.emit('animation:frame-changed', {
                cutIndex: newIndex,
                direction: 'next'
            });
        }
        
        // ===== Playback状態取得 =====
        
        getPlaybackState() {
            return {
                isPlaying: this.playback.isPlaying,
                currentCutIndex: this.stateManager.getCurrentCutIndex(),
                loop: this.stateManager.state.settings.loop,
                cutsCount: this.stateManager.state.cuts.length
            };
        }
        
        getPlaybackTime() {
            if (!this.playback.isPlaying) {
                return 0;
            }
            
            const elapsed = (Date.now() - this.playback.startTime) / 1000;
            const currentCutIndex = this.stateManager.getCurrentCutIndex();
            
            let totalTime = 0;
            for (let i = 0; i < currentCutIndex; i++) {
                const cut = this.stateManager.getCut(i);
                totalTime += cut?.duration || 0;
            }