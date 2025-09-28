// ===== system/animation-system.js - 緊急修正版: 主要問題修正 =====
// 【修正】レイヤー二重表示問題
// 【修正】描画位置ズレ問題  
// 【修正】タイムライン停止位置問題
// 【修正】新規CUT追加のShift+N対応
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
            this.hasInitialized = false;  // 完全初期化フラグ追加
            
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
            
            console.log('✅ AnimationSystem initialized (緊急修正版)');
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
        
        // 【修正】レイヤーに変形を適用（座標計算改善）
        applyTransformToLayerFixed(layer, transform) {
            if (!transform || !layer) return;
            
            const centerX = this.layerSystem.config.canvas.width / 2;
            const centerY = this.layerSystem.config.canvas.height / 2;
            
            // 変形がある場合のみ適用
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                // pivot設定してから変形適用
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + transform.x, centerY + transform.y);
                layer.rotation = transform.rotation;
                layer.scale.set(transform.scaleX, transform.scaleY);
            } else if (transform.x !== 0 || transform.y !== 0) {
                // 移動のみの場合
                layer.position.set(transform.x, transform.y);
                layer.pivot.set(0, 0);
            } else {
                // 変形なしの場合
                layer