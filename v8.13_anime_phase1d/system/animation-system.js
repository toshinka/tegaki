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
            
            // スナップショット管理
            this.backupSnapshots = [];
            
            // API統一：座標変換関数
            this.coordAPI = window.CoordinateSystem;
        }
        
        init(layerSystem, app) {
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
            
            // 遅延実行で初期CUT1を作成（LayerSystemが完全に初期化された後）
            setTimeout(() => {
                this.createInitialCutIfNeeded();
            }, 500);
            
            console.log('✅ AnimationSystem initialized with LayerSystem');
            this.eventBus.emit('animation:initialized');
        }
        
        // 初期CUT1の自動作成
        createInitialCutIfNeeded() {
            if (this.initialCutCreated || this.animationData.cuts.length > 0) {
                return;
            }
            
            // LayerSystemが初期化され、少なくとも1つのレイヤーがある場合のみ実行
            if (this.layerSystem && this.layerSystem.layers && this.layerSystem.layers.length > 0) {
                const initialCut = this.createCutFromCurrentState();
                this.initialCutCreated = true;
                
                console.log('🎬 Initial CUT1 automatically created:', initialCut.name);
                
                // EventBus通知
                if (this.eventBus) {
                    this.eventBus.emit('animation:initial-cut-created', { 
                        cutId: initialCut.id,
                        cutIndex: 0
                    });
                }
            } else {
                // LayerSystemがまだ準備できていない場合は再試行
                setTimeout(() => {
                    this.createInitialCutIfNeeded();
                }, 200);
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
            
            console.log('🎬 Cut created:', cut.name);
            
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
        
        // 現在のキャンバス状態をCUTに保存
        saveCutFromCurrentState(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            // 現在のレイヤー状態でスナップショットを更新
            cut.layerSnapshots = this.captureAllLayerStates();
            
            console.log('💾 Cut state updated:', cut.name);
            
            // サムネイルを再生成
            setTimeout(() => {
                this.generateCutThumbnail(cutIndex);
            }, 50);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex,
                    cutId: cut.id
                });
            }
        }
        
        // 全レイヤー状態をキャプチャ（API統一版）
        captureAllLayerStates() {
            const snapshots = [];
            
            if (!this.layerSystem || !this.layerSystem.layers) {
                console.warn('LayerSystem not available for capture');
                return snapshots;
            }
            
            this.layerSystem.layers.forEach(layer => {
                if (!layer || !layer.layerData) return;
                
                const layerId = layer.layerData.id;
                
                // LayerSystem統一API使用
                const transform = this.layerSystem.layerTransforms.get(layerId) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                // パスデータのディープコピー（非破壊保存）
                const pathsData = layer.layerData.paths ? layer.layerData.paths.map(path => ({
                    id: path.id || ('path_' + Date.now() + Math.random()),
                    points: path.points ? [...path.points] : [],
                    size: path.size || 16,
                    color: path.color || 0x000000,
                    opacity: path.opacity || 1.0,
                    tool: path.tool || 'pen'
                })) : [];
                
                snapshots.push({
                    layerId: layerId,
                    visible: layer.layerData.visible !== false,
                    opacity: layer.layerData.opacity || 1.0,
                    transform: { ...transform },
                    pathsData: pathsData,
                    timestamp: Date.now()
                });
            });
            
            console.log('📸 Captured', snapshots.length, 'layer states');
            return snapshots;
        }
        
        // CUTを適用（レイヤー状態を復元）- API統一版
        applyCutToLayers(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn('Cut or LayerSystem not available:', cutIndex);
                return;
            }
            
            console.log('🎬 Applying cut:', cutIndex, cut.name);
            
            // 現在の状態をバックアップ
            this.backupSnapshots = this.captureAllLayerStates();
            
            // LayerSystem API統一：レイヤー状態適用
            cut.layerSnapshots.forEach(snapshot => {
                this.applySnapshotToLayer(snapshot);
            });
            
            // 現在のCUTインデックス更新
            this.animationData.playback.currentCutIndex = cutIndex;
            
            // UI更新（LayerSystem API使用）
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex });
            }
        }
        
        // スナップショットをレイヤーに適用（API統一）
        applySnapshotToLayer(snapshot) {
            const layer = this.layerSystem.layers.find(
                l => l.layerData && l.layerData.id === snapshot.layerId
            );
            
            if (!layer) {
                console.warn('Layer not found for snapshot:', snapshot.layerId);
                return;
            }
            
            // 基本プロパティ適用
            layer.layerData.visible = snapshot.visible;
            layer.visible = snapshot.visible;
            layer.layerData.opacity = snapshot.opacity;
            layer.alpha = snapshot.opacity;
            
            // LayerSystem API統一：変形適用
            this.layerSystem.layerTransforms.set(
                snapshot.layerId, 
                { ...snapshot.transform }
            );
            
            // CoordinateSystem API使用：座標変換適用
            if (this.coordAPI && this.coordAPI.worldToScreen) {
                const screenPos = this.coordAPI.worldToScreen(
                    snapshot.transform.x, 
                    snapshot.transform.y
                );
                layer.position.set(screenPos.x, screenPos.y);
            } else {
                // フォールバック：中央基準
                const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
                const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
                layer.position.set(
                    centerX + snapshot.transform.x,
                    centerY + snapshot.transform.y
                );
            }
            
            layer.rotation = snapshot.transform.rotation;
            layer.scale.set(
                snapshot.transform.scaleX,
                snapshot.transform.scaleY
            );
            
            // パスデータ復元
            this.restoreLayerPaths(layer, snapshot.pathsData);
        }
        
        // パスデータから描画を復元（PixiJS v8.13対応）
        restoreLayerPaths(layer, pathsData) {
            if (!layer || !pathsData) return;
            
            // 既存の描画をクリア（背景Graphics以外）
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
            
            // LayerData更新
            layer.layerData.paths = [];
            
            // パスデータからGraphicsを再生成
            pathsData.forEach(pathData => {
                if (!pathData.points || pathData.points.length === 0) return;
                
                const graphics = new PIXI.Graphics();
                
                // PixiJS v8.13形式での描画
                pathData.points.forEach(point => {
                    graphics.circle(point.x, point.y, pathData.size / 2);
                    graphics.fill({
                        color: pathData.color,
                        alpha: pathData.opacity
                    });
                });
                
                layer.addChild(graphics);
                
                // LayerDataに追加
                layer.layerData.paths.push({
                    ...pathData,
                    graphics: graphics
                });
            });
        }
        
        // 【段階1修正版】レイヤーサムネイル活用方式でのCUTサムネイル生成
        async generateCutThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn('Cut or LayerSystem not available for thumbnail generation');
                return;
            }
            
            try {
                console.log(`🖼️ Generating cut thumbnail for ${cut.name} using layer composite method...`);
                
                // 現在の状態を保存
                const currentSnapshots = this.captureAllLayerStates();
                const currentCutIndex = this.animationData.playback.currentCutIndex;
                
                // CUT状態を一時的に適用
                this.temporarilyApplyCutState(cutIndex);
                
                // 【修正版】レイヤーサムネイル技術を活用したサムネイル生成
                const thumbnailCanvas = await this.generateLayerCompositeCanvas();
                
                if (thumbnailCanvas) {
                    // CanvasからRenderTextureを作成
                    const texture = PIXI.Texture.from(thumbnailCanvas);
                    
                    // 既存のサムネイルテクスチャを破棄
                    if (cut.thumbnailTexture) {
                        cut.thumbnailTexture.destroy();
                    }
                    
                    cut.thumbnailTexture = texture;
                    console.log('✅ Layer composite thumbnail generated for', cut.name);
                } else {
                    console.warn('⚠️ Failed to generate layer composite thumbnail for', cut.name);
                }
                
                // 元の状態に戻す
                if (currentCutIndex !== cutIndex) {
                    this.restoreFromSnapshots(currentSnapshots);
                    this.animationData.playback.currentCutIndex = currentCutIndex;
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
                }
                
            } catch (error) {
                console.error('❌ Cut thumbnail generation failed:', error);
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-failed', { cutIndex, error });
                }
            }
        }
        
        // 【段階1新規】CUT状態の一時適用（非同期対応）
        async temporarilyApplyCutState(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            // スナップショットを適用
            cut.layerSnapshots.forEach(snapshot => {
                this.applySnapshotToLayer(snapshot);
            });
            
            // レイヤーサムネイル更新を強制実行
            if (this.layerSystem.processThumbnailUpdates) {
                this.layerSystem.processThumbnailUpdates();
            }
            
            // すべてのレイヤーのサムネイル更新をリクエスト
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            // サムネイル生成完了を待つ
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 【段階1新規】レイヤーサムネイル技術を活用した合成キャンバス生成
        async generateLayerCompositeCanvas() {
            try {
                const thumbWidth = 46;
                const thumbHeight = 34;
                
                // 合成用キャンバス作成
                const compositeCanvas = document.createElement('canvas');
                compositeCanvas.width = thumbWidth;
                compositeCanvas.height = thumbHeight;
                const ctx = compositeCanvas.getContext('2d');
                
                // 高品質レンダリング設定
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // 背景をクリア（透明）
                ctx.clearRect(0, 0, thumbWidth, thumbHeight);
                
                // レイヤーを下から順に合成（layerSystemの順序に従う）
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    const layer = this.layerSystem.layers[i];
                    
                    // 非表示レイヤーをスキップ
                    if (!layer.visible || !layer.layerData.visible) {
                        continue;
                    }
                    
                    // レイヤーサムネイルを取得
                    const layerThumbnailCanvas = await this.getLayerThumbnailCanvas(i);
                    
                    if (layerThumbnailCanvas) {
                        // レイヤー不透明度を適用して合成
                        const opacity = layer.alpha * (layer.layerData.opacity || 1.0);
                        ctx.globalAlpha = opacity;
                        
                        // レイヤーサムネイルを合成
                        ctx.drawImage(layerThumbnailCanvas, 0, 0, thumbWidth, thumbHeight);
                        
                        // 不透明度をリセット
                        ctx.globalAlpha = 1.0;
                    }
                }
                
                return compositeCanvas;
                
            } catch (error) {
                console.error('❌ Error generating layer composite canvas:', error);
                return null;
            }
        }
        
        // 【段階1新規】LayerSystemのサムネイル機能を活用してレイヤーサムネイルを取得
        async getLayerThumbnailCanvas(layerIndex) {
            try {
                // LayerSystemのupdateThumbnailを呼び出してサムネイル更新
                if (this.layerSystem.updateThumbnail) {
                    this.layerSystem.updateThumbnail(layerIndex);
                }
                
                // DOM上のレイヤーサムネイルを取得
                const layerItems = document.querySelectorAll('.layer-item');
                const panelIndex = this.layerSystem.layers.length - 1 - layerIndex;
                
                if (panelIndex < 0 || panelIndex >= layerItems.length) {
                    return null;
                }
                
                const thumbnailElement = layerItems[panelIndex].querySelector('.layer-thumbnail img');
                
                if (!thumbnailElement) {
                    return null;
                }
                
                // img要素からCanvasに変換
                const canvas = document.createElement('canvas');
                canvas.width = 46;
                canvas.height = 34;
                const ctx = canvas.getContext('2d');
                
                // 画像が読み込まれるまで待機
                if (!thumbnailElement.complete) {
                    await new Promise(resolve => {
                        thumbnailElement.onload = resolve;
                        thumbnailElement.onerror = resolve;
                    });
                }
                
                // 画像をキャンバスに描画
                ctx.drawImage(thumbnailElement, 0, 0, 46, 34);
                
                return canvas;
                
            } catch (error) {
                console.error('❌ Error getting layer thumbnail canvas:', error);
                return null;
            }
        }
        
        // スナップショットから状態復元（非同期対応）
        async restoreFromSnapshots(snapshots) {
            if (!snapshots || !this.layerSystem) return;
            
            snapshots.forEach(snapshot => {
                this.applySnapshotToLayer(snapshot);
            });
            
            // UI更新
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            // レンダリング完了を待つ
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        // 再生制御（メソッド名修正）
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
        
        pause() {
            this.animationData.playback.isPlaying = false;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-paused');
            }
        }
        
        stop() {
            this.animationData.playback.isPlaying = false;
            this.animationData.playback.currentCutIndex = 0;
            this.stopPlaybackLoop();
            
            // 最初のCUTに戻す
            if (this.animationData.cuts.length > 0) {
                this.applyCutToLayers(0);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-stopped');
            }
        }
        
        // 【修正】再生/停止トグル（core-engine.jsで参照されているメソッド名に対応）
        togglePlayStop() {
            if (this.animationData.playback.isPlaying) {
                this.stop();
            } else {
                this.play();
            }
        }
        
        // 【修正】再生/一時停止トグル（別名メソッド追加）
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
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-changed', { 
                        cutIndex: this.animationData.playback.currentCutIndex 
                    });
                }
            }
        }
        
        // CUT削除（最後のCUT削除防止）
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return;
            
            // 最後の1つのCUTは削除を防ぐ
            if (this.animationData.cuts.length <= 1) {
                console.warn('Cannot delete the last remaining cut');
                return false;
            }
            
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
            
            console.log('🗑️ Cut deleted:', cutIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            return true;
        }
        
        // CUT順序変更
        reorderCuts(oldIndex, newIndex) {
            if (oldIndex === newIndex || 
                oldIndex < 0 || oldIndex >= this.animationData.cuts.length ||
                newIndex < 0 || newIndex >= this.animationData.cuts.length) return;
            
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
            
            console.log('🔄 Cuts reordered:', oldIndex, '=>', newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cuts-reordered', { oldIndex, newIndex });
            }
        }
        
        // CUT時間変更
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
            this.applyCutToLayers(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    cutIndex: newIndex, 
                    direction: 'next' 
                });
            }
        }
        
        // アニメーションモード切り替え
        toggleAnimationMode() {
            this.isAnimationMode = !this.isAnimationMode;
            
            console.log('🎬 Animation mode:', this.isAnimationMode ? 'ON' : 'OFF');
            
            if (this.isAnimationMode) {
                // アニメーションモード開始時に初期CUTを確保
                this.createInitialCutIfNeeded();
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:mode-entered');
                }
            } else {
                // アニメーションモード終了時は再生停止
                if (this.animationData.playback.isPlaying) {
                    this.stop();
                }
                if (this.eventBus) {
                    this.eventBus.emit('animation:mode-exited');
                }
            }
            
            return this.isAnimationMode;
        }
        
        // アニメーション設定更新
        updateSettings(settings) {
            if (!settings) return;
            
            Object.assign(this.animationData.settings, settings);
            
            // 再生中の場合、タイマーを再開
            if (this.animationData.playback.isPlaying && settings.fps) {
                this.stopPlaybackLoop();
                this.startPlaybackLoop();
            }
            
            console.log('⚙️ Animation settings updated:', settings);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:settings-updated', { settings });
            }
        }
        
        // 現在のアニメーションデータを取得
        getAnimationData() {
            return this.animationData;
        }
        
        // 現在のCUTインデックスを取得
        getCurrentCutIndex() {
            return this.animationData.playback.currentCutIndex;
        }
        
        // CUT総数を取得
        getCutCount() {
            return this.animationData.cuts.length;
        }
        
        // 現在のCUT情報を取得
        getCurrentCut() {
            return this.animationData.cuts[this.animationData.playback.currentCutIndex] || null;
        }
        
        // 初期状態かどうかを確認
        hasInitialCut() {
            return this.animationData.cuts.length > 0;
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
            this.initialCutCreated = false;
            
            console.log('🗑️ Animation data cleared');
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cleared');
            }
        }
        
        // 座標系チェック（デバッグ用）
        checkCoordinateSystem() {
            if (this.coordAPI) {
                console.log('✅ CoordinateSystem API available');
                return this.coordAPI.diagnoseReferences();
            } else {
                console.warn('⚠️ CoordinateSystem API not available');
                return { status: 'not_available' };
            }
        }
        
        // LayerSystem連携チェック（デバッグ用）
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
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0
            };
            
            console.log('LayerSystem API Check:', checks);
            return checks;
        }
        
        // 【段階1修正版】サムネイル品質チェック（デバッグ用）
        debugThumbnailGeneration(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) {
                console.log('❌ Cut not found:', cutIndex);
                return;
            }
            
            console.log('🔍 Thumbnail Debug for', cut.name);
            console.log('  - Has thumbnail texture:', !!cut.thumbnailTexture);
            console.log('  - Layer snapshots count:', cut.layerSnapshots.length);
            console.log('  - LayerSystem available:', !!this.layerSystem);
            console.log('  - LayerSystem updateThumbnail available:', !!this.layerSystem?.updateThumbnail);
            
            // レイヤー状態確認
            if (this.layerSystem?.layers) {
                console.log('  - Active layers:', this.layerSystem.layers.length);
                this.layerSystem.layers.forEach((layer, i) => {
                    console.log(`    Layer ${i}:`, {
                        visible: layer.visible,
                        pathCount: layer.layerData?.paths?.length || 0,
                        transform: this.layerSystem.layerTransforms.get(layer.layerData?.id)
                    });
                });
            }
            
            // DOM上のレイヤーサムネイル確認
            const layerItems = document.querySelectorAll('.layer-item');
            console.log('  - DOM layer items:', layerItems.length);
            layerItems.forEach((item, i) => {
                const img = item.querySelector('.layer-thumbnail img');
                console.log(`    DOM Layer ${i}:`, {
                    hasImage: !!img,
                    imageSrc: img ? img.src.substring(0, 50) + '...' : 'none'
                });
            });
        }
        
        // 修正版デバッグ用：アニメーション情報出力
        debugInfo() {
            const coordCheck = this.checkCoordinateSystem();
            const layerCheck = this.checkLayerSystemAPI();
            
            const info = {
                isAnimationMode: this.isAnimationMode,
                cutsCount: this.animationData.cuts.length,
                initialCutCreated: this.initialCutCreated,
                hasInitialCut: this.hasInitialCut(),
                isPlaying: this.animationData.playbook.isPlaying,
                currentCut: this.animationData.playback.currentCutIndex,
                settings: this.animationData.settings,
                eventBusAvailable: !!this.eventBus,
                coordinateSystemAPI: coordCheck,
                layerSystemAPI: layerCheck
            };
            
            console.log('AnimationSystem Debug Info (段階1修正版):');
            console.log('- Animation Mode:', info.isAnimationMode);
            console.log('- Cuts Count:', info.cutsCount);
            console.log('- Initial Cut Created:', info.initialCutCreated);
            console.log('- Has Initial Cut:', info.hasInitialCut);
            console.log('- Playing:', info.isPlaying);
            console.log('- Current Cut:', info.currentCut);
            console.log('- Settings:', info.settings);
            console.log('- EventBus:', info.eventBusAvailable ? '✅' : '❌');
            console.log('- CoordinateSystem:', coordCheck.status || '❌');
            console.log('- LayerSystem:', layerCheck.hasLayers ? '✅' : '❌');
            console.log('- 🆕 Layer Composite Thumbnail: ✅');
            console.log('- 🆕 Method Name Fixes: ✅');
            
            return info;
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    console.log('✅ animation-system.js loaded (段階1修正版: レイヤーサムネイル活用方式)');
    console.log('🔧 段階1修正内容:');
    console.log('  - generateLayerCompositeCanvas(): LayerSystemサムネイル技術活用');
    console.log('  - getLayerThumbnailCanvas(): DOM上のレイヤーサムネイル取得');
    console.log('  - togglePlayPause(): メソッド名不整合修正');
    console.log('  - レンダラー参照エラー修正（PixiJS直接レンダリング回避）');
    console.log('  - キャンバスリサイズ耐性: LayerSystemサムネイル継承');
    console.log('  - 高品質合成: imageSmoothingQuality=high');
})();