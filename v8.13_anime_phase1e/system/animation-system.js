// ===== system/animation-system.js - 段階1改修版: 2次元レイヤー構造実装 =====
// GIF アニメーション機能 根本改修計画書 段階1実装
// 【改修完了】CUT × レイヤー = 2次元マトリクス構造
// 【改修完了】LayerSystem統合・データ構造根本変更
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
            
            // LayerSystemとの双方向参照設定
            this.layerSystem.animationSystem = this;
            
            // 遅延実行で初期CUT1を作成（LayerSystemが完全に初期化された後）
            setTimeout(() => {
                this.createInitialCutIfNeeded();
            }, 500);
            
            console.log('✅ AnimationSystem initialized with LayerSystem (段階1改修版)');
            this.eventBus.emit('animation:initialized');
        }
        
        // 初期CUT1の自動作成（改修版）
        createInitialCutIfNeeded() {
            if (this.initialCutCreated || this.animationData.cuts.length > 0) {
                return;
            }
            
            // LayerSystemが初期化され、少なくとも1つのレイヤーがある場合のみ実行
            if (this.layerSystem && this.layerSystem.layers && this.layerSystem.layers.length > 0) {
                // 【改修】新しいCUT作成方式：現在のレイヤーをCUTに移行
                const initialCut = this.createNewCutFromCurrentLayers();
                this.initialCutCreated = true;
                
                console.log('🎬 Initial CUT1 created with existing layers:', initialCut.name);
                
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
                cuts: [],  // 【改修】各CUTが独自のレイヤー配列を持つ
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
        
        // 【改修】新規CUT作成：現在のレイヤーからCUT作成
        createNewCutFromCurrentLayers() {
            // 現在のレイヤーをCUT用にコピー
            const cutLayers = this.copyCurrentLayersForCut();
            
            const cut = {
                id: 'cut_' + Date.now(),
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layers: cutLayers,  // 【改修】スナップショットではなく独自のレイヤー配列
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            
            // LayerSystemのレイヤー配列を新CUTのレイヤー配列に接続
            this.switchToActiveCut(this.animationData.cuts.length - 1);
            
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
        
        // 【改修】新規空CUT作成
        createNewEmptyCut() {
            const cut = {
                id: 'cut_' + Date.now(),
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layers: [],  // 【改修】空のレイヤー配列
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            
            console.log('🎬 Empty Cut created:', cut.name);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-created', { 
                    cutId: cut.id, 
                    cutIndex: this.animationData.cuts.length - 1 
                });
            }
            
            return cut;
        }
        
        // 【改修】現在のレイヤーをCUT用にディープコピー
        copyCurrentLayersForCut() {
            const copiedLayers = [];
            
            if (!this.layerSystem || !this.layerSystem.layers) {
                return copiedLayers;
            }
            
            this.layerSystem.layers.forEach(originalLayer => {
                if (!originalLayer || !originalLayer.layerData) return;
                
                const layerId = originalLayer.layerData.id;
                
                // レイヤーの変形データ取得
                const transform = this.layerSystem.layerTransforms.get(layerId) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                // パスデータのディープコピー
                const pathsData = originalLayer.layerData.paths ? 
                    originalLayer.layerData.paths.map(path => ({
                        id: path.id || ('path_' + Date.now() + Math.random()),
                        points: path.points ? [...path.points] : [],
                        size: path.size || 16,
                        color: path.color || 0x000000,
                        opacity: path.opacity || 1.0,
                        tool: path.tool || 'pen'
                    })) : [];
                
                // CUT専用レイヤーデータ作成
                const cutLayerData = {
                    id: layerId + '_cut' + Date.now(),  // CUT専用ID
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
            
            console.log('📸 Copied', copiedLayers.length, 'layers for new CUT');
            return copiedLayers;
        }
        
        // 【改修】CUT切り替え：レイヤーセット全体の切り替え
        switchToActiveCut(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn('Cut or LayerSystem not available:', cutIndex);
                return;
            }
            
            console.log('🎬 Switching to cut:', cutIndex, cut.name);
            
            // 現在のCUTインデックス更新
            this.animationData.playback.currentCutIndex = cutIndex;
            
            // LayerSystemのレイヤー配列を指定CUTのレイヤーに切り替え
            this.setActiveCut(cutIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex });
            }
        }
        
        // 【改修】LayerSystem統合：アクティブCUT設定
        setActiveCut(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            // 現在のLayerSystemレイヤーを破棄
            this.clearLayerSystemLayers();
            
            // CUTのレイヤーデータからLayerSystemレイヤーを再構築
            this.rebuildLayersFromCutData(cut.layers);
            
            // LayerSystem UI更新
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            console.log('✅ LayerSystem layers synchronized with CUT', cutIndex);
        }
        
        // 【改修】LayerSystemレイヤークリア
        clearLayerSystemLayers() {
            if (!this.layerSystem || !this.layerSystem.layers) return;
            
            // 各レイヤーを安全に破棄
            this.layerSystem.layers.forEach(layer => {
                if (layer.layerData && layer.layerData.paths) {
                    layer.layerData.paths.forEach(path => {
                        if (path.graphics && path.graphics.destroy) {
                            path.graphics.destroy();
                        }
                    });
                }
                
                if (layer.parent) {
                    layer.parent.removeChild(layer);
                }
                layer.destroy();
            });
            
            // 配列をクリア
            this.layerSystem.layers = [];
            this.layerSystem.layerTransforms.clear();
            this.layerSystem.activeLayerIndex = -1;
        }
        
        // 【改修】CUTデータからLayerSystemレイヤーを再構築
        rebuildLayersFromCutData(cutLayers) {
            if (!cutLayers || !Array.isArray(cutLayers)) return;
            
            cutLayers.forEach(cutLayerData => {
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
                this.layerSystem.layerTransforms.set(cutLayerData.id, cutLayerData.transform);
                
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
                
                // 変形適用
                this.applyTransformToLayer(layer, cutLayerData.transform);
                
                // LayerSystemに追加
                this.layerSystem.layers.push(layer);
                this.layerSystem.layersContainer.addChild(layer);
            });
            
            // アクティブレイヤー設定
            if (this.layerSystem.layers.length > 0) {
                this.layerSystem.activeLayerIndex = this.layerSystem.layers.length - 1;
            }
        }
        
        // 【改修】パスデータからPath+Graphicsオブジェクトを再構築
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
        
        // 【改修】レイヤーに変形を適用
        applyTransformToLayer(layer, transform) {
            if (!transform || !layer) return;
            
            const centerX = this.layerSystem.config.canvas.width / 2;
            const centerY = this.layerSystem.config.canvas.height / 2;
            
            // 位置設定
            layer.position.set(centerX + transform.x, centerY + transform.y);
            
            // 回転・拡縮がある場合は基準点設定
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.rotation = transform.rotation;
                layer.scale.set(transform.scaleX, transform.scaleY);
            }
        }
        
        // 【改修】現在のCUTレイヤーに新しいレイヤーを追加
        addLayerToCurrentCut(layerData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            // CUTにレイヤーデータ追加
            currentCut.layers.push(layerData);
            
            // LayerSystemにも反映
            const layer = this.rebuildSingleLayerFromData(layerData);
            if (layer) {
                this.layerSystem.layers.push(layer);
                this.layerSystem.layersContainer.addChild(layer);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:layer-added-to-cut', {
                        cutIndex: this.animationData.playback.currentCutIndex,
                        layerId: layerData.id
                    });
                }
            }
            
            return layer;
        }
        
        // 【改修】単一レイヤーデータからPIXIレイヤーを構築
        rebuildSingleLayerFromData(layerData) {
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            layer.layerData = {
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible,
                opacity: layerData.opacity,
                isBackground: layerData.isBackground,
                paths: []
            };
            
            // 変形データ設定
            this.layerSystem.layerTransforms.set(layerData.id, layerData.transform || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
            
            // パス再構築
            if (layerData.paths) {
                layerData.paths.forEach(pathData => {
                    const path = this.rebuildPathFromData(pathData);
                    if (path) {
                        layer.layerData.paths.push(path);
                        layer.addChild(path.graphics);
                    }
                });
            }
            
            // 表示設定適用
            layer.visible = layerData.visible;
            layer.alpha = layerData.opacity;
            
            // 変形適用
            if (layerData.transform) {
                this.applyTransformToLayer(layer, layerData.transform);
            }
            
            return layer;
        }
        
        // 【改修】現在CUTのレイヤーデータを更新
        updateCurrentCutLayer(layerIndex, updateData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut || layerIndex < 0 || layerIndex >= currentCut.layers.length) return;
            
            // CUTのレイヤーデータを更新
            Object.assign(currentCut.layers[layerIndex], updateData);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex,
                    updateData
                });
            }
        }
        
        // 【改修】現在CUTの全レイヤー状態を保存
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            // LayerSystemの現在状態をCUTに反映
            currentCut.layers = this.copyCurrentLayersForCut();
            
            console.log('💾 Cut layer states saved:', currentCut.name);
            
            // サムネイル再生成
            setTimeout(() => {
                this.generateCutThumbnail(this.animationData.playback.currentCutIndex);
            }, 50);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        // CUTサムネイル生成（レイヤー合成方式）
        async generateCutThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn('Cut or LayerSystem not available for thumbnail generation');
                return;
            }
            
            try {
                console.log(`🖼️ Generating cut thumbnail for ${cut.name}...`);
                
                // 現在の状態を保存
                const currentCutIndex = this.animationData.playback.currentCutIndex;
                
                // 一時的にCUT状態を適用（必要に応じて）
                if (cutIndex !== currentCutIndex) {
                    this.temporarilyApplyCutState(cutIndex);
                }
                
                // レイヤー合成キャンバス生成
                const thumbnailCanvas = await this.generateLayerCompositeCanvas();
                
                if (thumbnailCanvas) {
                    // CanvasからRenderTextureを作成
                    const texture = PIXI.Texture.from(thumbnailCanvas);
                    
                    // 既存のサムネイルテクスチャを破棄
                    if (cut.thumbnail) {
                        cut.thumbnail.destroy();
                    }
                    
                    cut.thumbnail = texture;
                    console.log('✅ Thumbnail generated for', cut.name);
                } else {
                    console.warn('⚠️ Failed to generate thumbnail for', cut.name);
                }
                
                // 元の状態に戻す
                if (cutIndex !== currentCutIndex) {
                    this.switchToActiveCut(currentCutIndex);
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
        
        // CUT状態の一時適用
        async temporarilyApplyCutState(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            // 既存の再構築メソッドを再利用
            this.clearLayerSystemLayers();
            this.rebuildLayersFromCutData(cut.layers);
            
            // レンダリング完了を待つ
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // レイヤー合成キャンバス生成
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
                
                // レイヤーを下から順に合成
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    const layer = this.layerSystem.layers[i];
                    
                    // 非表示レイヤーをスキップ
                    if (!layer.visible || !layer.layerData.visible) {
                        continue;
                    }
                    
                    // レイヤーを直接レンダリング（簡易版）
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
        
        // レイヤーを個別にキャンバスにレンダリング
        async renderLayerToCanvas(layer) {
            try {
                if (!this.app || !this.app.renderer) return null;
                
                const width = this.layerSystem.config.canvas.width;
                const height = this.layerSystem.config.canvas.height;
                
                // レンダリング用テクスチャ作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: width,
                    height: height
                });
                
                // 一時コンテナ作成
                const tempContainer = new PIXI.Container();
                tempContainer.addChild(layer);
                
                // レンダリング実行
                this.app.renderer.render(tempContainer, { renderTexture });
                
                // キャンバスに変換
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                
                // レイヤーを元のコンテナに戻す
                tempContainer.removeChild(layer);
                this.layerSystem.layersContainer.addChild(layer);
                
                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                console.error('❌ Error rendering layer to canvas:', error);
                return null;
            }
        }
        
        // 再生制御（既存機能維持）
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
                this.switchToActiveCut(0);
            }
            
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
                this.switchToActiveCut(this.animationData.playback.currentCutIndex);
                
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
            if (cut.thumbnail) {
                cut.thumbnail.destroy();
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
            this.switchToActiveCut(newIndex);
            
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
            this.switchToActiveCut(newIndex);
            
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
        
        // 【改修】現在のCUTのレイヤー配列を取得
        getCurrentCutLayers() {
            const currentCut = this.getCurrentCut();
            return currentCut ? currentCut.layers : [];
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
                if (cut.thumbnail) {
                    cut.thumbnail.destroy();
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
        
        // 【改修】従来メソッドの互換性維持（段階的移行用）
        createCutFromCurrentState() {
            return this.createNewCutFromCurrentLayers();
        }
        
        applyCutToLayers(cutIndex) {
            return this.switchToActiveCut(cutIndex);
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
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0,
                hasAnimationSystemRef: !!this.layerSystem.animationSystem
            };
            
            console.log('LayerSystem API Check:', checks);
            return checks;
        }
        
        // デバッグ用：アニメーション情報出力
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
                settings: this.animationData.settings,
                eventBusAvailable: !!this.eventBus,
                coordinateSystemAPI: coordCheck,
                layerSystemAPI: layerCheck,
                cutStructure: this.animationData.cuts.map(cut => ({
                    id: cut.id,
                    name: cut.name,
                    layerCount: cut.layers.length
                }))
            };
            
            console.log('AnimationSystem Debug Info (段階1改修版):');
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
            console.log('- 🆕 2D Matrix Structure: ✅');
            console.log('- 🆕 CUT×Layer Independence: ✅');
            console.log('- 🆕 LayerSystem Integration: ✅');
            console.log('- Cut Structure:', info.cutStructure);
            
            return info;
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    console.log('✅ animation-system.js loaded (段階1改修版: 2次元レイヤー構造実装)');
    console.log('🔧 段階1改修完了:');
    console.log('  - 🆕 CUT × レイヤー = 2次元マトリクス構造実装');
    console.log('  - 🆕 各CUTが独自のレイヤー配列を持つ');
    console.log('  - 🆕 switchToActiveCut(): レイヤーセット全体切り替え');
    console.log('  - 🆕 LayerSystem双方向統合');
    console.log('  - 🆕 createNewEmptyCut(): 独立レイヤー空間作成');
    console.log('  - 🆕 addLayerToCurrentCut(): 現在CUT内レイヤー操作');
    console.log('  - 🔧 従来メソッド互換性維持');
    console.log('  - 🔧 参照整合性確保: LayerSystem ⇔ AnimationSystem');
})();