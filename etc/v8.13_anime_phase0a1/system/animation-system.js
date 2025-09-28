(function() {
    'use strict';
    
    class AnimationSystem {
        constructor() {
            this.animationData = this.createDefaultAnimation();
            this.layerSystem = null;
            this.cameraSystem = null;
            this.app = null;
            this.eventBus = null;
            this.playbackTimer = null;
            this.isAnimationMode = false;
            
            // スナップショット管理
            this.backupSnapshots = [];
        }
        
        init(layerSystem, cameraSystem, app, eventBus) {
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.app = app;
            this.eventBus = eventBus;
            
            console.log('✅ AnimationSystem initialized');
        }
        
        createDefaultAnimation() {
            return {
                cuts: [],
                settings: {
                    fps: window.TEGAKI_CONFIG.animation.defaultFPS,
                    loop: window.TEGAKI_CONFIG.animation.playback.loopByDefault
                },
                playback: {
                    isPlaying: false,
                    currentCutIndex: 0,
                    startTime: 0
                }
            };
        }
        
        // CUT作成（現在のレイヤー状態をキャプチャ）
        createCutFromCurrentState() {
            const cut = {
                id: 'cut_' + Date.now(),
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layerSnapshots: this.captureAllLayerStates(),
                thumbnailTexture: null
            };
            
            this.animationData.cuts.push(cut);
            
            // 非同期でサムネイル生成
            setTimeout(() => {
                this.generateCutThumbnail(this.animationData.cuts.length - 1);
            }, 100);
            
            this.eventBus.emit('animation:cut-created', { 
                cutId: cut.id, 
                cutIndex: this.animationData.cuts.length - 1 
            });
            
            return cut;
        }
        
        // 全レイヤー状態をキャプチャ
        captureAllLayerStates() {
            const snapshots = [];
            
            if (!this.layerSystem.layers) return snapshots;
            
            this.layerSystem.layers.forEach(layer => {
                const layerId = layer.layerData.id;
                const transform = this.layerSystem.layerTransforms.get(layerId) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                // パスデータのディープコピー（非破壊保存）
                const pathsData = layer.layerData.paths ? layer.layerData.paths.map(path => ({
                    ...path,
                    points: [...path.points],
                    graphics: null // Graphicsは再生成するので保存しない
                })) : [];
                
                snapshots.push({
                    layerId: layerId,
                    visible: layer.layerData.visible,
                    opacity: layer.layerData.opacity,
                    transform: { ...transform },
                    pathsData: pathsData
                });
            });
            
            return snapshots;
        }
        
        // CUTを適用（レイヤー状態を復元）
        applyCutToLayers(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            console.log('Applying cut:', cutIndex, cut.name);
            
            // 現在の状態をバックアップ（元に戻すため）
            this.backupSnapshots = this.captureAllLayerStates();
            
            // 一時的にイベント抑制
            const originalEmit = this.eventBus.emit;
            this.eventBus.emit = () => {};
            
            try {
                cut.layerSnapshots.forEach(snapshot => {
                    const layer = this.layerSystem.layers.find(
                        l => l.layerData.id === snapshot.layerId
                    );
                    
                    if (!layer) return;
                    
                    // 可視性・透明度適用
                    layer.layerData.visible = snapshot.visible;
                    layer.visible = snapshot.visible;
                    layer.layerData.opacity = snapshot.opacity;
                    layer.alpha = snapshot.opacity;
                    
                    // 変形適用
                    this.layerSystem.layerTransforms.set(
                        snapshot.layerId, 
                        { ...snapshot.transform }
                    );
                    
                    // パスデータ復元（非破壊）
                    this.restoreLayerPaths(layer, snapshot.pathsData);
                    
                    // 表示位置更新
                    const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
                    const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
                    layer.position.set(
                        centerX + snapshot.transform.x,
                        centerY + snapshot.transform.y
                    );
                    layer.rotation = snapshot.transform.rotation;
                    layer.scale.set(
                        snapshot.transform.scaleX,
                        snapshot.transform.scaleY
                    );
                });
                
                // 現在のCUTインデックス更新
                this.animationData.playback.currentCutIndex = cutIndex;
                
            } finally {
                // イベント復元
                this.eventBus.emit = originalEmit;
            }
            
            // UI更新
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            this.eventBus.emit('animation:cut-applied', { cutIndex });
        }
        
        // パスデータから描画を復元
        restoreLayerPaths(layer, pathsData) {
            // 既存のGraphicsをクリア（背景Graphics以外）
            const childrenToRemove = [];
            layer.children.forEach(child => {
                if (child !== layer.layerData.backgroundGraphics) {
                    childrenToRemove.push(child);
                }
            });
            
            childrenToRemove.forEach(child => {
                layer.removeChild(child);
                if (child.destroy) child.destroy();
            });
            
            // パスデータからGraphicsを再生成
            layer.layerData.paths = pathsData.map(pathData => {
                const graphics = new PIXI.Graphics();
                
                // パス描画（PixiJS v8.13形式）
                pathData.points.forEach(point => {
                    graphics.circle(point.x, point.y, pathData.size / 2);
                    graphics.fill({
                        color: pathData.color,
                        alpha: pathData.opacity
                    });
                });
                
                layer.addChild(graphics);
                
                return {
                    ...pathData,
                    graphics: graphics
                };
            });
        }
        
        // サムネイル生成（遅延処理）
        async generateCutThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            try {
                // 現在の状態を保存
                const currentSnapshots = this.captureAllLayerStates();
                
                // CUT状態を適用
                this.applyCutToLayers(cutIndex);
                
                // 少し待ってからレンダリング
                setTimeout(() => {
                    try {
                        // RenderTexture作成（小サイズ）
                        const thumbWidth = window.TEGAKI_CONFIG.animation.timeline.cutThumbnailWidth;
                        const thumbHeight = window.TEGAKI_CONFIG.animation.timeline.cutThumbnailHeight;
                        
                        const renderTexture = PIXI.RenderTexture.create({
                            width: thumbWidth,
                            height: thumbHeight,
                            resolution: 1
                        });
                        
                        // レンダリング
                        if (this.layerSystem.layersContainer) {
                            this.app.renderer.render({
                                container: this.layerSystem.layersContainer,
                                target: renderTexture
                            });
                        }
                        
                        cut.thumbnailTexture = renderTexture;
                        
                        // 元の状態に戻す
                        this.restoreFromSnapshots(currentSnapshots);
                        
                        this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
                        
                    } catch (error) {
                        console.error('Thumbnail generation failed:', error);
                        this.eventBus.emit('animation:thumbnail-failed', { cutIndex, error });
                    }
                }, 50);
                
            } catch (error) {
                console.error('Cut application for thumbnail failed:', error);
            }
        }
        
        // スナップショットから状態復元
        restoreFromSnapshots(snapshots) {
            if (!snapshots) return;
            
            snapshots.forEach(snapshot => {
                const layer = this.layerSystem.layers.find(
                    l => l.layerData.id === snapshot.layerId
                );
                
                if (!layer) return;
                
                // 可視性・透明度復元
                layer.layerData.visible = snapshot.visible;
                layer.visible = snapshot.visible;
                layer.layerData.opacity = snapshot.opacity;
                layer.alpha = snapshot.opacity;
                
                // 変形復元
                this.layerSystem.layerTransforms.set(
                    snapshot.layerId,
                    { ...snapshot.transform }
                );
                
                // パスデータ復元
                this.restoreLayerPaths(layer, snapshot.pathsData);
                
                // 表示位置復元
                const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
                const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
                layer.position.set(
                    centerX + snapshot.transform.x,
                    centerY + snapshot.transform.y
                );
                layer.rotation = snapshot.transform.rotation;
                layer.scale.set(
                    snapshot.transform.scaleX,
                    snapshot.transform.scaleY
                );
            });
        }
        
        // 再生制御
        play() {
            if (this.animationData.cuts.length === 0) return;
            
            this.animationData.playback.isPlaying = true;
            this.animationData.playback.startTime = Date.now();
            
            this.startPlaybackLoop();
            this.eventBus.emit('animation:playback-started');
        }
        
        pause() {
            this.animationData.playback.isPlaying = false;
            this.stopPlaybackLoop();
            this.eventBus.emit('animation:playback-paused');
        }
        
        stop() {
            this.animationData.playback.isPlaying = false;
            this.animationData.playback.currentCutIndex = 0;
            this.stopPlaybackLoop();
            
            // 最初のCUTに戻す
            if (this.animationData.cuts.length > 0) {
                this.applyCutToLayers(0);
            }
            
            this.eventBus.emit('animation:playback-stopped');
        }
        
        startPlaybackLoop() {
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
            const currentCut = this.animationData.cuts[
                this.animationData.playback.currentCutIndex
            ];
            
            if (!currentCut) return;
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            if (elapsed >= currentCut.duration) {
                // 次のCUTへ
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
                this.applyCutToLayers(this.animationData.playback.currentCutIndex);
                
                this.eventBus.emit('animation:cut-changed', { 
                    cutIndex: this.animationData.playback.currentCutIndex 
                });
            }
        }
        
        // CUT削除
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return;
            
            const cut = this.animationData.cuts[cutIndex];
            
            // RenderTextureを破棄
            if (cut.thumbnailTexture) {
                cut.thumbnailTexture.destroy();
            }
            
            // 配列から削除
            this.animationData.cuts.splice(cutIndex, 1);
            
            // 再生中の場合、インデックス調整
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            this.eventBus.emit('animation:cut-deleted', { cutIndex });
        }
        
        // CUT順序変更
        reorderCuts(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            
            const cuts = this.animationData.cuts;
            const [movedCut] = cuts.splice(oldIndex, 1);
            cuts.splice(newIndex, 0, movedCut);
            
            // 再生中のインデックス調整
            if (this.animationData.playback.currentCutIndex === oldIndex) {
                this.animationData.playback.currentCutIndex = newIndex;
            } else if (this.animationData.playback.currentCutIndex > oldIndex && 
                       this.animationData.playback.currentCutIndex <= newIndex) {
                this.animationData.playback.currentCutIndex--;
            } else if (this.animationData.playback.currentCutIndex < oldIndex && 
                       this.animationData.playback.currentCutIndex >= newIndex) {
                this.animationData.playback.currentCutIndex++;
            }
            
            this.eventBus.emit('animation:cuts-reordered', { oldIndex, newIndex });
        }
        
        // CUT時間変更
        updateCutDuration(cutIndex, duration) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            cut.duration = Math.max(0.1, Math.min(10, duration));
            
            this.eventBus.emit('animation:cut-duration-changed', { 
                cutIndex, 
                duration: cut.duration 
            });
        }
        
        // フレーム移動（キーボード操作用）
        goToPreviousFrame() {
            if (this.animationData.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentCutIndex - 1;
            if (newIndex < 0) {
                newIndex = this.animationData.cuts.length - 1;
            }
            
            this.animationData.playback.currentCutIndex = newIndex;
            this.applyCutToLayers(newIndex);
            
            this.eventBus.emit('animation:frame-changed', { 
                cutIndex: newIndex, 
                direction: 'previous' 
            });
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
            this.applyCutToLayers(newIndex);
            
            this.eventBus.emit('animation:frame-changed', { 
                cutIndex: newIndex, 
                direction: 'next' 
            });
        }
        
        // 再生/一時停止トグル
        togglePlayPause() {
            if (this.animationData.playback.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }
        
        // アニメーションモード切り替え
        toggleAnimationMode() {
            this.isAnimationMode = !this.isAnimationMode;
            
            if (this.isAnimationMode) {
                this.eventBus.emit('animation:mode-entered');
            } else {
                // アニメーションモード終了時は再生停止
                if (this.animationData.playback.isPlaying) {
                    this.stop();
                }
                this.eventBus.emit('animation:mode-exited');
            }
            
            return this.isAnimationMode;
        }
        
        // アニメーション設定更新
        updateSettings(settings) {
            Object.assign(this.animationData.settings, settings);
            
            // 再生中の場合、タイマーを再開
            if (this.animationData.playback.isPlaying) {
                this.stopPlaybackLoop();
                this.startPlaybackLoop();
            }
            
            this.eventBus.emit('animation:settings-updated', { settings });
        }
        
        // 現在のアニメーションデータを取得
        getAnimationData() {
            return this.animationData;
        }
        
        // アニメーションデータをクリア
        clearAnimation() {
            // 再生停止
            this.stop();
            
            // RenderTextureを破棄
            this.animationData.cuts.forEach(cut => {
                if (cut.thumbnailTexture) {
                    cut.thumbnailTexture.destroy();
                }
            });
            
            // データリセット
            this.animationData = this.createDefaultAnimation();
            
            this.eventBus.emit('animation:cleared');
        }
        
        // デバッグ用：アニメーション情報出力
        debugInfo() {
            console.log('AnimationSystem Debug Info:');
            console.log('- Animation Mode:', this.isAnimationMode);
            console.log('- Cuts Count:', this.animationData.cuts.length);
            console.log('- Playing:', this.animationData.playback.isPlaying);
            console.log('- Current Cut:', this.animationData.playback.currentCutIndex);
            console.log('- Settings:', this.animationData.settings);
            
            return {
                isAnimationMode: this.isAnimationMode,
                cutsCount: this.animationData.cuts.length,
                isPlaying: this.animationData.playback.isPlaying,
                currentCut: this.animationData.playback.currentCutIndex,
                settings: this.animationData.settings
            };
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    console.log('✅ animation-system.js loaded');
})();