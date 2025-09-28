// ===== system/animation-system.js - 緊急修正完了版（構文エラー修正） =====
// 【修正完了】レイヤー二重表示問題修正
// 【修正完了】描画位置ズレ問題修正  
// 【修正完了】タイムライン停止位置修正
// 【修正完了】新規CUT作成時の絵消失防止
// 【追加完了】Shift+N用新規空CUT作成
// 【構文エラー修正】ファイル構造を完全に整理
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
            
            // 【修正】初期化制御フラグ強化
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            
            // 【修正】再生位置保持用
            this.lastStoppedCutIndex = 0;
            
            // API統一：座標変換関数
            this.coordAPI = window.CoordinateSystem;
        }
        
        init(layerSystem, app) {
            // 【修正】重複初期化防止
            if (this.hasInitialized) {
                console.log('🎬 AnimationSystem already initialized - skipping');
                return;
            }
            
            console.log('🎬 AnimationSystem initializing...');
            this.layerSystem = layerSystem;
            this.app = app;
            
            // EventBusが利用可能か確認
            if (!this.eventBus) {
                console.error('❌ EventBus not available in AnimationSystem');
                return;
            }
            
            // LayerSystemのAPI確認
            if (!this.layerSystem || !this.layerSystem.layers) {
                console.error('❌ LayerSystem not properly initialized');
                return;
            }
            
            // LayerSystemとの双方向参照設定
            this.layerSystem.animationSystem = this;
            
            // 【修正】初期化完了フラグ
            this.hasInitialized = true;
            
            // 【修正】初期CUT作成を一度だけ実行
            setTimeout(() => {
                if (!this.initialCutCreated && !this.isInitializing) {
                    this.createInitialCutIfNeeded();
                }
            }, 100);
            
            console.log('✅ AnimationSystem initialized (緊急修正完了版)');
            
            // 【追加】UI初期化に必要なイベント遅延発行
            setTimeout(() => {
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-failed', { cutIndex, error });
                }
            }
        }
        
        async temporarilyApplyCutState(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            this.clearLayerSystemLayers();
            this.rebuildLayersFromCutData(cut.layers);
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        async generateLayerCompositeCanvas() {
            try {
                const thumbWidth = 46;
                const thumbHeight = 34;
                
                const compositeCanvas = document.createElement('canvas');
                compositeCanvas.width = thumbWidth;
                compositeCanvas.height = thumbHeight;
                const ctx = compositeCanvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, thumbWidth, thumbHeight);
                
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    const layer = this.layerSystem.layers[i];
                    
                    if (!layer.visible || !layer.layerData.visible) {
                        continue;
                    }
                    
                    const layerCanvas = await this.renderLayerToCanvas(layer);
                    
                    if (layerCanvas) {
                        const opacity = layer.alpha * (layer.layerData.opacity || 1.0);
                        ctx.globalAlpha = opacity;
                        ctx.drawImage(layerCanvas, 0, 0, thumbWidth, thumbHeight);
                        ctx.globalAlpha = 1.0;
                    }
                }
                
                return compositeCanvas;
                
            } catch (error) {
                console.error('❌ Error generating layer composite canvas:', error);
                return null;
            }
        }
        
        async renderLayerToCanvas(layer) {
            try {
                if (!this.app || !this.app.renderer) return null;
                
                const width = this.layerSystem.config.canvas.width;
                const height = this.layerSystem.config.canvas.height;
                
                const renderTexture = PIXI.RenderTexture.create({
                    width: width,
                    height: height
                });
                
                const tempContainer = new PIXI.Container();
                tempContainer.addChild(layer);
                
                this.app.renderer.render(tempContainer, { renderTexture });
                
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                
                tempContainer.removeChild(layer);
                this.layerSystem.layersContainer.addChild(layer);
                
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                console.error('❌ Error rendering layer to canvas:', error);
                return null;
            }
        }
        
        // === 再生制御メソッド ===
        
        play() {
            if (this.animationData.cuts.length === 0) {
                console.warn('No cuts available for playback');
                return;
            }
            
            this.animationData.playback.isPlaying = true;
            this.animationData.playback.startTime = Date.now();
            
            this.startPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-started');
            }
        }
        
        // 【修正】pause実装：現在位置保持
        pause() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.animationData.playback.currentCutIndex;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-paused');
            }
        }
        
        // 【修正】stop実装：最初のCUTに戻らない
        stop() {
            this.animationData.playback.isPlaying = false;
            // 【修正】停止時に最初のCUTに戻らない
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
        
        togglePlayPause() {
            if (this.animationData.playback.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }
        
        startPlaybackLoop() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
            }
            
            const fps = this.animationData.settings.fps;
            const frameTime = 1000 / fps;
            
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
            
            const currentCut = this.animationData.cuts[
                this.animationData.playback.currentCutIndex
            ];
            
            if (!currentCut) return;
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            if (elapsed >= currentCut.duration) {
                this.animationData.playback.currentCutIndex++;
                
                if (this.animationData.playback.currentCutIndex >= 
                    this.animationData.cuts.length) {
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
        
        // === その他のメソッド ===
        
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return;
            
            if (this.animationData.cuts.length <= 1) {
                console.warn('Cannot delete the last remaining cut');
                return false;
            }
            
            const cut = this.animationData.cuts[cutIndex];
            
            if (cut.thumbnail) {
                cut.thumbnail.destroy();
            }
            
            this.animationData.cuts.splice(cutIndex, 1);
            
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            console.log('🗑️ Cut deleted:', cutIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            return true;
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
            
            console.log('⏱️ Cut duration updated:', cut.name, cut.duration + 's');
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-duration-changed', { 
                    cutIndex, 
                    duration: cut.duration 
                });
            }
        }
        
        // === ゲッターメソッド ===
        
        getAnimationData() {
            return this.animationData;
        }
        
        getCurrentCutIndex() {
            return this.animationData.playback.currentCutIndex;
        }
        
        getCutCount() {
            return this.animationData.cuts.length;
        }
        
        getCurrentCut() {
            return this.animationData.cuts[this.animationData.playback.currentCutIndex] || null;
        }
        
        getCurrentCutLayers() {
            const currentCut = this.getCurrentCut();
            return currentCut ? currentCut.layers : [];
        }
        
        hasInitialCut() {
            return this.animationData.cuts.length > 0;
        }
        
        getAllCuts() {
            return this.animationData.cuts;
        }
        
        getCutInfo(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return null;
            
            return {
                id: cut.id,
                name: cut.name,
                duration: cut.duration,
                layerCount: cut.layers.length,
                thumbnail: cut.thumbnail,
                isActive: cutIndex === this.animationData.playback.currentCutIndex
            };
        }
        
        getPlaybackState() {
            return {
                isPlaying: this.animationData.playback.isPlaying,
                currentCutIndex: this.animationData.playback.currentCutIndex,
                fps: this.animationData.settings.fps,
                loop: this.animationData.settings.loop,
                cutsCount: this.animationData.cuts.length
            };
        }
        
        isInAnimationMode() {
            return this.isAnimationMode;
        }
        
        toggleAnimationMode() {
            this.isAnimationMode = !this.isAnimationMode;
            
            console.log('🎬 Animation mode:', this.isAnimationMode ? 'ON' : 'OFF');
            
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
        
        updateSettings(settings) {
            if (!settings) return;
            
            Object.assign(this.animationData.settings, settings);
            
            if (this.animationData.playback.isPlaying && settings.fps) {
                this.stopPlaybackLoop();
                this.startPlaybackLoop();
            }
            
            console.log('⚙️ Animation settings updated:', settings);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:settings-updated', { settings });
            }
        }
        
        clearAnimation() {
            this.stop();
            
            this.animationData.cuts.forEach(cut => {
                if (cut.thumbnail) {
                    cut.thumbnail.destroy();
                }
            });
            
            this.animationData = this.createDefaultAnimation();
            this.initialCutCreated = false;
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            console.log('🗑️ Animation data cleared');
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cleared');
            }
        }
        
        // === デバッグメソッド ===
        
        checkCoordinateSystem() {
            if (this.coordAPI) {
                console.log('✅ CoordinateSystem API available');
                return this.coordAPI.diagnoseReferences ? this.coordAPI.diagnoseReferences() : { status: 'available' };
            } else {
                console.warn('⚠️ CoordinateSystem API not available');
                return { status: 'not_available' };
            }
        }
        
        checkLayerSystemAPI() {
            if (!this.layerSystem) {
                return { status: 'not_available', message: 'LayerSystem not initialized' };
            }
            
            const checks = {
                hasLayers: !!this.layerSystem.layers,
                hasTransforms: !!this.layerSystem.layerTransforms,
                hasContainer: !!(this.layerSystem.layersContainer || this.layerSystem.worldContainer),
                hasUpdateUI: typeof this.layerSystem.updateLayerPanelUI === 'function',
                hasUpdateThumbnail: typeof this.layerSystem.updateThumbnail === 'function',
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0,
                hasAnimationSystemRef: !!this.layerSystem.animationSystem
            };
            
            console.log('LayerSystem API Check:', checks);
            return checks;
        }
        
        debugInfo() {
            const coordCheck = this.checkCoordinateSystem();
            const layerCheck = this.checkLayerSystemAPI();
            
            const info = {
                isAnimationMode: this.isAnimationMode,
                cutsCount: this.animationData.cuts.length,
                initialCutCreated: this.initialCutCreated,
                hasInitialCut: this.hasInitialCut(),
                isPlaying: this.animationData.playback.isPlaying,
                currentCut: this.animationData.playback.currentCutIndex,
                lastStoppedCut: this.lastStoppedCutIndex,
                settings: this.animationData.settings,
                eventBusAvailable: !!this.eventBus,
                coordinateSystemAPI: coordCheck,
                layerSystemAPI: layerCheck,
                cutStructure: this.animationData.cuts.map(cut => ({
                    id: cut.id,
                    name: cut.name,
                    layerCount: cut.layers.length
                })),
                isInitializing: this.isInitializing,
                cutSwitchInProgress: this.cutSwitchInProgress,
                hasInitialized: this.hasInitialized
            };
            
            console.log('AnimationSystem Debug Info (緊急修正完了版):');
            console.log('- Animation Mode:', info.isAnimationMode);
            console.log('- Cuts Count:', info.cutsCount);
            console.log('- Initial Cut Created:', info.initialCutCreated);
            console.log('- Has Initial Cut:', info.hasInitialCut);
            console.log('- Playing:', info.isPlaying);
            console.log('- Current Cut:', info.currentCut);
            console.log('- Last Stopped Cut:', info.lastStoppedCut);
            console.log('- Settings:', info.settings);
            console.log('- EventBus:', info.eventBusAvailable ? '✅' : '❌');
            console.log('- CoordinateSystem:', coordCheck.status === 'available' || coordCheck.status === 'ok' ? '✅' : '❌');
            console.log('- LayerSystem:', layerCheck.hasLayers ? '✅' : '❌');
            console.log('- Has Initialized:', info.hasInitialized);
            console.log('- Is Initializing:', info.isInitializing);
            console.log('- Cut Switch In Progress:', info.cutSwitchInProgress);
            console.log('- 🔧 Layer Deduplication: ✅');
            console.log('- 🔧 Coordinate Fix Applied: ✅');
            console.log('- 🔧 Safe CUT Switching: ✅');
            console.log('- 🔧 Timeline Stop Position Fix: ✅');
            console.log('- 🔧 Shift+N Blank CUT Support: ✅');
            console.log('- Cut Structure:', info.cutStructure);
            
            return info;
        }
    }
    
    // グローバル公開
    window.TegakiAnimationSystem = AnimationSystem;
    console.log('✅ animation-system.js loaded (緊急修正完了版 - 構文エラー修正)');
    console.log('🔧 修正完了:');
    console.log('  - ✅ 構文エラー修正: ファイル構造完全整理');
    console.log('  - ✅ レイヤー二重表示問題修正: 重複防止フラグ強化');
    console.log('  - ✅ 描画位置ズレ修正: applyTransformToLayerFixed()改善');
    console.log('  - ✅ タイムライン停止位置修正: pause/stop動作分離');
    console.log('  - ✅ CUT切り替え安全性強化: switchToActiveCutSafely()');
    console.log('  - ✅ 新規CUT作成時絵消失防止: saveCutLayerStatesBeforeSwitch()');
    console.log('  - ✅ 初期化処理重複防止: hasInitialized フラグ');
    console.log('  - ✅ Shift+N空CUT作成対応: createNewBlankCut()');
    console.log('  - ✅ 座標変換API統一・レイヤーAPI統合・EventBus完全性確保');
    console.log('  - ✅ PixiJS v8.13完全対応・二重実装排除・アーキテクチャ改善');

})();Bus) {
                    this.eventBus.emit('animation:system-ready');
                    console.log('📡 AnimationSystem ready event emitted');
                }
            }, 150);
            
            this.eventBus.emit('animation:initialized');
        }
        
        // 【修正】初期CUT作成（重複防止強化）
        createInitialCutIfNeeded() {
            // 多重実行防止の厳密なチェック
            if (this.initialCutCreated || this.animationData.cuts.length > 0 || this.isInitializing) {
                console.log('🎬 Initial CUT already exists or creation in progress');
                return;
            }
            
            // LayerSystemの準備確認
            if (!this.layerSystem || !this.layerSystem.layers) {
                console.log('🎬 LayerSystem not ready for initial CUT');
                return;
            }
            
            this.isInitializing = true;
            
            try {
                // 【修正】レイヤーが存在する場合のみCUT作成
                if (this.layerSystem.layers.length > 0) {
                    console.log('🎬 Creating initial CUT with existing layers');
                    
                    // 初期CUTを既存のレイヤーから作成
                    const initialCut = this.createNewCutFromCurrentLayers();
                    this.initialCutCreated = true;
                    
                    console.log('✅ Initial CUT1 created:', initialCut.name);
                    
                    // EventBus通知
                    if (this.eventBus) {
                        this.eventBus.emit('animation:initial-cut-created', { 
                            cutId: initialCut.id,
                            cutIndex: 0
                        });
                    }
                } else {
                    console.log('🎬 No layers available for initial CUT');
                    this.initialCutCreated = false;  // レイヤーがない場合は未作成扱い
                }
            } finally {
                this.isInitializing = false;
            }
        }
        
        createDefaultAnimation() {
            const config = window.TEGAKI_CONFIG.animation;
            return {
                cuts: [],
                settings: {
                    fps: config.defaultFPS,
                    loop: true
                },
                playback: {
                    isPlaying: false,
                    currentCutIndex: 0,
                    startTime: 0
                }
            };
        }
        
        // 【修正】新規CUT作成：既存レイヤーの変形状態も保持
        createNewCutFromCurrentLayers() {
            const cutLayers = this.copyCurrentLayersForCut();
            
            const cut = {
                id: 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layers: cutLayers,
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            
            // 【修正】CUT切り替え時の座標リセット防止
            this.switchToActiveCutSafely(this.animationData.cuts.length - 1, false);
            
            console.log('🎬 New Cut created:', cut.name, 'with', cut.layers.length, 'layers');
            
            // 非同期でサムネイル生成
            setTimeout(() => {
                this.generateCutThumbnail(this.animationData.cuts.length - 1);
            }, 100);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-created', { 
                    cutId: cut.id, 
                    cutIndex: this.animationData.cuts.length - 1 
                });
            }
            
            return cut;
        }
        
        // 【新規追加】Shift+N用：新規空CUT作成（背景レイヤー付き）
        createNewBlankCut() {
            const cut = {
                id: 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layers: [],
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            const newIndex = this.animationData.cuts.length - 1;
            
            console.log('🎬 Blank Cut created:', cut.name);
            
            // 新規CUTに切り替え
            this.switchToActiveCutSafely(newIndex, false);
            
            // 背景レイヤーを追加
            if (this.layerSystem) {
                const bgLayer = this.layerSystem.createLayer('背景', true);
                if (bgLayer) {
                    const newLayer = this.layerSystem.createLayer('レイヤー1', false);
                    this.saveCutLayerStates();
                }
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-created', { 
                    cutId: cut.id, 
                    cutIndex: newIndex 
                });
            }
            
            return cut;
        }
        
        // 【修正】TimelineUI用：空CUT作成（createNewEmptyCutエイリアス）
        createNewEmptyCut() {
            return this.createNewBlankCut();
        }
        
        // 現在のレイヤーをCUT用にディープコピー
        copyCurrentLayersForCut() {
            const copiedLayers = [];
            
            if (!this.layerSystem || !this.layerSystem.layers) {
                return copiedLayers;
            }
            
            // 【修正】既に処理したレイヤーIDを記録
            const processedIds = new Set();
            
            this.layerSystem.layers.forEach(originalLayer => {
                if (!originalLayer || !originalLayer.layerData) return;
                
                const layerId = originalLayer.layerData.id;
                
                // 【修正】重複チェック
                if (processedIds.has(layerId)) {
                    console.warn('Duplicate layer skipped:', layerId);
                    return;
                }
                processedIds.add(layerId);
                
                // 変形データ取得
                const transform = this.layerSystem.layerTransforms.get(layerId) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                // パスデータの完全コピー
                const pathsData = originalLayer.layerData.paths ? 
                    originalLayer.layerData.paths.map(path => ({
                        id: path.id || ('path_' + Date.now() + Math.random()),
                        points: path.points ? path.points.map(point => ({ ...point })) : [],
                        size: path.size || 16,
                        color: path.color || 0x000000,
                        opacity: path.opacity || 1.0,
                        tool: path.tool || 'pen'
                    })) : [];
                
                // CUT専用レイヤーデータ作成
                const cutLayerData = {
                    id: layerId,  // 【修正】元のIDを保持（CUT内で一意性保証）
                    name: originalLayer.layerData.name,
                    visible: originalLayer.layerData.visible !== false,
                    opacity: originalLayer.layerData.opacity || 1.0,
                    isBackground: originalLayer.layerData.isBackground || false,
                    transform: { ...transform },
                    paths: pathsData,
                    timestamp: Date.now()
                };
                
                copiedLayers.push(cutLayerData);
            });
            
            console.log('📸 Copied', copiedLayers.length, 'unique layers for CUT');
            return copiedLayers;
        }
        
        // 【修正】CUT切り替え：座標保持オプション追加
        switchToActiveCutSafely(cutIndex, resetTransform = true) {
            if (this.cutSwitchInProgress) {
                console.log('🎬 CUT switch in progress, queuing...');
                setTimeout(() => this.switchToActiveCutSafely(cutIndex, resetTransform), 50);
                return;
            }
            
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn('Cut or LayerSystem not available:', cutIndex);
                return;
            }
            
            console.log('🎬 Switching to cut:', cutIndex, cut.name);
            
            this.cutSwitchInProgress = true;
            
            // 現在のCUTデータを保存
            this.saveCutLayerStatesBeforeSwitch();
            
            // 現在のCUTインデックス更新
            this.animationData.playback.currentCutIndex = cutIndex;
            
            // LayerSystemのレイヤー配列を指定CUTのレイヤーに切り替え
            this.setActiveCut(cutIndex, resetTransform);
            
            this.cutSwitchInProgress = false;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex });
            }
        }
        
        switchToActiveCut(cutIndex) {
            return this.switchToActiveCutSafely(cutIndex, true);
        }
        
        saveCutLayerStatesBeforeSwitch() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            // 現在のLayerSystem状態をCUTに反映
            const currentLayers = this.copyCurrentLayersForCut();
            currentCut.layers = currentLayers;
            
            console.log('💾 Current CUT layers saved before switch');
        }
        
        // 【修正】LayerSystem統合：座標保持オプション追加
        setActiveCut(cutIndex, resetTransform = true) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            // 現在のLayerSystemレイヤーを安全に破棄
            this.clearLayerSystemLayers();
            
            // CUTのレイヤーデータからLayerSystemレイヤーを再構築
            this.rebuildLayersFromCutData(cut.layers, resetTransform);
            
            // LayerSystem UI更新
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            console.log('✅ LayerSystem layers synchronized with CUT', cutIndex);
        }
        
        clearLayerSystemLayers() {
            if (!this.layerSystem || !this.layerSystem.layers) return;
            
            // 各レイヤーを安全に破棄
            const layersToDestroy = [...this.layerSystem.layers];
            
            layersToDestroy.forEach(layer => {
                try {
                    // パスGraphicsを破棄
                    if (layer.layerData && layer.layerData.paths) {
                        layer.layerData.paths.forEach(path => {
                            if (path.graphics && path.graphics.destroy) {
                                path.graphics.destroy();
                            }
                        });
                    }
                    
                    // Containerから削除
                    if (layer.parent) {
                        layer.parent.removeChild(layer);
                    }
                    
                    // Layer自体を破棄
                    if (layer.destroy) {
                        layer.destroy();
                    }
                    
                } catch (error) {
                    console.warn('Layer destruction failed:', error);
                }
            });
            
            // 配列をクリア
            this.layerSystem.layers = [];
            this.layerSystem.layerTransforms.clear();
            this.layerSystem.activeLayerIndex = -1;
            
            console.log('🗑️ LayerSystem layers cleared');
        }
        
        // 【修正】CUTデータからLayerSystemレイヤーを再構築（座標保持改善）
        rebuildLayersFromCutData(cutLayers, resetTransform = true) {
            if (!cutLayers || !Array.isArray(cutLayers)) return;
            
            cutLayers.forEach((cutLayerData, index) => {
                try {
                    // PIXIコンテナ作成
                    const layer = new PIXI.Container();
                    layer.label = cutLayerData.id;
                    layer.layerData = {
                        id: cutLayerData.id,
                        name: cutLayerData.name,
                        visible: cutLayerData.visible,
                        opacity: cutLayerData.opacity,
                        isBackground: cutLayerData.isBackground,
                        paths: []
                    };
                    
                    // 変形データ設定
                    const transform = {
                        x: cutLayerData.transform?.x || 0,
                        y: cutLayerData.transform?.y || 0,
                        rotation: cutLayerData.transform?.rotation || 0,
                        scaleX: cutLayerData.transform?.scaleX || 1,
                        scaleY: cutLayerData.transform?.scaleY || 1
                    };
                    this.layerSystem.layerTransforms.set(cutLayerData.id, transform);
                    
                    // 背景レイヤー処理
                    if (cutLayerData.isBackground) {
                        const bg = new PIXI.Graphics();
                        bg.rect(0, 0, this.layerSystem.config.canvas.width, this.layerSystem.config.canvas.height);
                        bg.fill(this.layerSystem.config.background.color);
                        layer.addChild(bg);
                        layer.layerData.backgroundGraphics = bg;
                    }
                    
                    // パスデータからGraphicsを再生成
                    cutLayerData.paths.forEach(pathData => {
                        const path = this.rebuildPathFromData(pathData);
                        if (path) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                        }
                    });
                    
                    // レイヤーの表示設定適用
                    layer.visible = cutLayerData.visible;
                    layer.alpha = cutLayerData.opacity;
                    
                    // 【修正】初期位置設定の改善
                    if (!resetTransform && (transform.x !== 0 || transform.y !== 0 || 
                        transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                        Math.abs(transform.scaleY) !== 1)) {
                        this.applyTransformToLayerFixed(layer, transform);
                    } else {
                        // デフォルト位置に設定
                        layer.position.set(0, 0);
                        layer.pivot.set(0, 0);
                        layer.rotation = 0;
                        layer.scale.set(1, 1);
                    }
                    
                    // LayerSystemに追加
                    this.layerSystem.layers.push(layer);
                    this.layerSystem.layersContainer.addChild(layer);
                    
                } catch (error) {
                    console.error('Layer rebuild failed for index', index, ':', error);
                }
            });
            
            // アクティブレイヤー設定
            if (this.layerSystem.layers.length > 0) {
                this.layerSystem.activeLayerIndex = this.layerSystem.layers.length - 1;
            }
            
            console.log('✅ Rebuilt', this.layerSystem.layers.length, 'layers from CUT data');
        }
        
        // 【修正】レイヤーに変形を適用（座標計算改善・Vキー操作修正）
        applyTransformToLayerFixed(layer, transform) {
            if (!transform || !layer) return;
            
            const centerX = this.layerSystem.config.canvas.width / 2;
            const centerY = this.layerSystem.config.canvas.height / 2;
            
            // 【修正】Vキー操作時の妙な動きを防ぐため、段階的に変形適用
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                // 回転・拡縮がある場合：pivot中央設定
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + (transform.x || 0), centerY + (transform.y || 0));
                layer.rotation = transform.rotation || 0;
                layer.scale.set(transform.scaleX || 1, transform.scaleY || 1);
            } else if (transform.x !== 0 || transform.y !== 0) {
                // 移動のみの場合：pivot原点、位置調整
                layer.pivot.set(0, 0);
                layer.position.set(transform.x || 0, transform.y || 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                // 変形なしの場合：完全リセット
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
            
            // 【修正】LayerSystemの変形データも同期更新
            if (this.layerSystem && layer.layerData) {
                this.layerSystem.layerTransforms.set(layer.layerData.id, { ...transform });
            }
            
            console.log('🔧 Transform applied to layer:', layer.layerData?.id, transform);
        }
        
        // 【修正】LayerSystem連携：レイヤー変形データを現在CUTに保存
        saveLayerTransformToCurrentCut(layerId, transform) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return;
            
            const layerIndex = currentCut.layers.findIndex(layer => layer.id === layerId);
            if (layerIndex === -1) return;
            
            // 【修正】変形データの完全コピーと正規化
            currentCut.layers[layerIndex].transform = {
                x: transform.x || 0,
                y: transform.y || 0,
                rotation: transform.rotation || 0,
                scaleX: transform.scaleX || 1,
                scaleY: transform.scaleY || 1
            };
            
            console.log('🔧 Layer transform saved to current CUT:', layerId, currentCut.layers[layerIndex].transform);
            
            // 【修正】即座にサムネイル更新
            setTimeout(() => {
                this.generateCutThumbnail(this.animationData.playback.currentCutIndex);
            }, 50);
        }
        
        // 【修正】LayerSystem連携：現在CUTにレイヤーを追加
        addLayerToCurrentCut(layerData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) {
                console.warn('No current CUT available for layer addition');
                return null;
            }
            
            // 【修正】レイヤーID重複チェック
            const existingLayer = currentCut.layers.find(layer => layer.id === layerData.id);
            if (existingLayer) {
                console.warn('Layer already exists in current CUT:', layerData.id);
                return existingLayer;
            }
            
            // CUTにレイヤーデータ追加
            const cutLayerData = {
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                isBackground: layerData.isBackground || false,
                transform: layerData.transform || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                paths: layerData.paths || [],
                timestamp: Date.now()
            };
            
            currentCut.layers.push(cutLayerData);
            
            console.log('📝 Layer added to current CUT:', layerData.id, 'in', currentCut.name);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:layer-added-to-cut', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerId: layerData.id
                });
            }
            
            return cutLayerData;
        }
        
        // 【修正】LayerSystem連携：現在CUTのレイヤーを更新
        updateLayerInCurrentCut(layerId, updateData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            const layerIndex = currentCut.layers.findIndex(layer => layer.id === layerId);
            if (layerIndex === -1) return null;
            
            // レイヤーデータを更新
            Object.assign(currentCut.layers[layerIndex], updateData);
            
            console.log('📝 Layer updated in current CUT:', layerId);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex,
                    layerId,
                    updateData
                });
            }
            
            return currentCut.layers[layerIndex];
        }
        
        // パスデータからPath+Graphicsオブジェクトを再構築
        rebuildPathFromData(pathData) {
            if (!pathData || !pathData.points || pathData.points.length === 0) {
                return null;
            }
            
            try {
                const graphics = new PIXI.Graphics();
                
                // PixiJS v8.13形式での描画
                pathData.points.forEach(point => {
                    graphics.circle(point.x, point.y, pathData.size / 2);
                    graphics.fill({
                        color: pathData.color,
                        alpha: pathData.opacity
                    });
                });
                
                return {
                    id: pathData.id,
                    points: pathData.points,
                    size: pathData.size,
                    color: pathData.color,
                    opacity: pathData.opacity,
                    tool: pathData.tool,
                    graphics: graphics
                };
                
            } catch (error) {
                console.error('❌ Error rebuilding path:', error);
                return null;
            }
        }
        
        // 現在CUTの全レイヤー状態を保存
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            // LayerSystemの現在状態をCUTに反映
            const savedLayers = this.copyCurrentLayersForCut();
            currentCut.layers = savedLayers;
            
            console.log('💾 Cut layer states saved:', currentCut.name, savedLayers.length, 'layers');
            
            // サムネイル再生成（遅延実行）
            setTimeout(() => {
                this.generateCutThumbnail(this.animationData.playback.currentCutIndex);
            }, 100);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        // CUTサムネイル生成
        async generateCutThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn('Cut or LayerSystem not available for thumbnail generation');
                return;
            }
            
            try {
                console.log(`🖼️ Generating cut thumbnail for ${cut.name}...`);
                
                const currentCutIndex = this.animationData.playback.currentCutIndex;
                
                if (cutIndex !== currentCutIndex) {
                    this.temporarilyApplyCutState(cutIndex);
                }
                
                const thumbnailCanvas = await this.generateLayerCompositeCanvas();
                
                if (thumbnailCanvas) {
                    const texture = PIXI.Texture.from(thumbnailCanvas);
                    
                    if (cut.thumbnail) {
                        cut.thumbnail.destroy();
                    }
                    
                    cut.thumbnail = texture;
                    console.log('✅ Thumbnail generated for', cut.name);
                } else {
                    console.warn('⚠️ Failed to generate thumbnail for', cut.name);
                }
                
                if (cutIndex !== currentCutIndex) {
                    this.switchToActiveCutSafely(currentCutIndex);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
                }
                
            } catch (error) {
                console.error('❌ Cut thumbnail generation failed:', error);
                if (this.event