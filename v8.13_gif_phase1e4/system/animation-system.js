// ===== system/animation-system.js - 完全2次元マトリクス改修版 =====
// 【最高優先改修】CUT×レイヤー 2次元マトリクス 完全独立性実現
// 【根本解決】サムネイル生成時のCUT状態完全分離
// 【座標系統一】CoordinateSystem API 統合
// PixiJS v8.13 対応・計画書完全準拠版

(function() {
    'use strict';
    
    class AnimationSystem {
        constructor() {
            this.animationData = this.createDefaultAnimation();
            this.layerSystem = null;
            this.cameraSystem = null;
            this.app = null;
            this.eventBus = window.TegakiEventBus;
            
            // プレイバック制御
            this.playbackTimer = null;
            this.isAnimationMode = false;
            this.initialCutCreated = false;
            
            // CUT切り替え制御
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            // CUT独立性保証
            this.cutLayerIdCounters = new Map();
            this.cutLayerStates = new Map(); // cutId -> 完全独立レイヤー状態
            
            // CUT クリップボード
            this.cutClipboard = {
                cutData: null,
                timestamp: null,
                sourceId: null
            };
            
            // 【統一】座標変換API参照
            this.coordAPI = window.CoordinateSystem;
            if (!this.coordAPI) {
                console.warn('CoordinateSystem not available - some features may be limited');
            }
        }
        
        init(layerSystem, app) {
            if (this.hasInitialized) {
                console.warn('AnimationSystem already initialized');
                return;
            }
            
            console.log('🎬 AnimationSystem: 完全2次元マトリクス改修版 初期化開始...');
            
            this.layerSystem = layerSystem;
            this.app = app;
            
            if (!this.eventBus) {
                console.error('EventBus not available');
                return;
            }
            
            if (!this.layerSystem?.layers) {
                console.error('LayerSystem not properly initialized');
                return;
            }
            
            // 【統合】双方向参照設定
            this.layerSystem.animationSystem = this;
            
            // イベント設定
            this.setupCutClipboardEvents();
            this.setupLayerChangeListener();
            
            this.hasInitialized = true;
            
            // 初期CUT作成（遅延）
            setTimeout(() => {
                if (!this.initialCutCreated && !this.isInitializing) {
                    this.createInitialCutIfNeeded();
                }
            }, 150);
            
            // システム準備通知
            setTimeout(() => {
                if (this.eventBus) {
                    this.eventBus.emit('animation:system-ready');
                    this.eventBus.emit('animation:initialized');
                }
            }, 200);
            
            console.log('✅ AnimationSystem: 完全2次元マトリクス改修版 初期化完了');
        }
        
        // 【新規】レイヤー変更リスナー - 自動CUT状態保存
        setupLayerChangeListener() {
            if (!this.eventBus) return;
            
            // レイヤー描画・変更時に自動保存
            this.eventBus.on('layer:path-added', () => {
                this.saveCutLayerStates();
            });
            
            this.eventBus.on('layer:updated', () => {
                this.saveCutLayerStates();
            });
            
            this.eventBus.on('layer:visibility-changed', () => {
                this.saveCutLayerStates();
            });
            
            // 描画完了時の自動保存
            this.eventBus.on('drawing:stroke-completed', () => {
                setTimeout(() => {
                    this.saveCutLayerStates();
                    this.generateCutThumbnailOptimized(this.animationData.playback.currentCutIndex);
                }, 50);
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
                defaultFPS: 12,
                defaultCutDuration: 0.5
            };
            
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
        
        // 【改修】完全独立CUT作成 - 2次元マトリクス実現
        createNewCutFromCurrentLayers() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // 【重要】現在のレイヤー状態を完全独立でコピー
            const independentLayers = this.copyCurrentLayersToIndependentState(cutId);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG?.animation?.defaultCutDuration || 0.5,
                layers: independentLayers,
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            const newCutIndex = this.animationData.cuts.length - 1;
            
            // 【重要】CUT独立状態をマップに保存
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(independentLayers));
            
            // CUT切り替え
            this.switchToActiveCutSafely(newCutIndex, false);
            
            // サムネイル生成
            setTimeout(async () => {
                await this.generateCutThumbnailOptimized(newCutIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-created', { 
                        cutId: cut.id, 
                        cutIndex: newCutIndex 
                    });
                }
            }, 100);
            
            console.log(`🎬 新規CUT作成: ${cut.name} (${cutId})`);
            return cut;
        }
        
        // 【改修】空のCUT作成 - 基本レイヤーのみ
        createNewBlankCut() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG?.animation?.defaultCutDuration || 0.5,
                layers: [],
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            const newIndex = this.animationData.cuts.length - 1;
            
            // 空のCUT状態を保存
            this.cutLayerStates.set(cutId, []);
            
            this.switchToActiveCutSafely(newIndex, false);
            
            // デフォルトレイヤー作成
            if (this.layerSystem) {
                // レイヤー作成時は自動的にCUT状態が更新される
                this.layerSystem.createLayer('背景', true);
                this.layerSystem.createLayer('レイヤー1', false);
            }
            
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
        
        // 【核心改修】完全独立レイヤーコピー - 2次元マトリクス実現
        copyCurrentLayersToIndependentState(cutId) {
            const independentLayers = [];
            
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                return independentLayers;
            }
            
            this.layerSystem.layers.forEach((originalLayer, layerIndex) => {
                if (!originalLayer?.layerData) return;
                
                // 【重要】CUT専用の完全独立レイヤーID生成
                const independentLayerId = this.generateUniqueCutLayerId(cutId);
                
                // 【重要】レイヤー変形状態の取得
                const originalTransform = this.layerSystem.layerTransforms.get(originalLayer.layerData.id) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                // 【重要】パスデータの完全独立コピー（ディープクローン）
                const independentPaths = originalLayer.layerData.paths ? 
                    originalLayer.layerData.paths.map(originalPath => {
                        // ポイント配列の完全コピー
                        const independentPoints = originalPath.points ? 
                            originalPath.points.map(point => ({
                                x: Number(point.x),
                                y: Number(point.y)
                            })) : [];
                        
                        return {
                            id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            points: independentPoints,
                            size: originalPath.size || 16,
                            color: originalPath.color || 0x800000,
                            opacity: originalPath.opacity || 1.0,
                            tool: originalPath.tool || 'pen',
                            // graphics は保存しない（復元時に再生成）
                            isComplete: originalPath.isComplete || true
                        };
                    }) : [];
                
                // 【重要】完全独立レイヤーデータ作成
                const independentLayerData = {
                    id: independentLayerId,
                    name: originalLayer.layerData.name || `レイヤー${layerIndex + 1}`,
                    visible: originalLayer.layerData.visible !== false,
                    opacity: originalLayer.layerData.opacity || 1.0,
                    isBackground: originalLayer.layerData.isBackground || false,
                    // 変形状態の独立コピー
                    transform: {
                        x: Number(originalTransform.x) || 0,
                        y: Number(originalTransform.y) || 0,
                        rotation: Number(originalTransform.rotation) || 0,
                        scaleX: Number(originalTransform.scaleX) || 1,
                        scaleY: Number(originalTransform.scaleY) || 1
                    },
                    // パスデータの独立コピー
                    paths: independentPaths,
                    // CUT作成時のタイムスタンプ
                    createdAt: Date.now(),
                    // 親CUT参照（デバッグ用）
                    cutId: cutId
                };
                
                independentLayers.push(independentLayerData);
            });
            
            console.log(`🔄 独立レイヤーコピー完了: ${independentLayers.length} layers for CUT ${cutId}`);
            return independentLayers;
        }
        
        // 【改修】CUT独立ID生成 - 衝突完全回避
        generateUniqueCutLayerId(cutId) {
            if (!this.cutLayerIdCounters.has(cutId)) {
                this.cutLayerIdCounters.set(cutId, 0);
            }
            
            const counter = this.cutLayerIdCounters.get(cutId);
            this.cutLayerIdCounters.set(cutId, counter + 1);
            
            return `${cutId}_layer_${counter}_${Date.now()}`;
        }
        
        // 【改修】CUT切り替え - 完全状態分離
        switchToActiveCutSafely(cutIndex, resetTransform = false) {
            if (this.cutSwitchInProgress) {
                setTimeout(() => this.switchToActiveCutSafely(cutIndex, resetTransform), 50);
                return;
            }
            
            const targetCut = this.animationData.cuts[cutIndex];
            if (!targetCut || !this.layerSystem) {
                console.warn(`Cannot switch to CUT ${cutIndex}: invalid target or LayerSystem`);
                return;
            }
            
            this.cutSwitchInProgress = true;
            
            console.log(`🎬 CUT切り替え開始: ${cutIndex} (${targetCut.name})`);
            
            try {
                // 【重要】現在のCUT状態を保存
                this.saveCutLayerStatesBeforeSwitch();
                
                // プレイバック状態更新
                this.animationData.playback.currentCutIndex = cutIndex;
                
                // 【重要】CUT状態を完全復元
                this.setActiveCut(cutIndex, resetTransform);
                
                console.log(`✅ CUT切り替え完了: ${cutIndex} (${targetCut.name})`);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-applied', { cutIndex, cutId: targetCut.id });
                }
                
            } catch (error) {
                console.error('CUT切り替えエラー:', error);
            } finally {
                this.cutSwitchInProgress = false;
            }
        }
        
        // 【改修】現在CUT状態保存 - 完全独立性保証
        saveCutLayerStatesBeforeSwitch() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            console.log(`💾 CUT状態保存開始: ${currentCut.name}`);
            
            // 【重要】現在のレイヤー状態を独立状態に変換
            const currentIndependentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            
            // CUT内のレイヤー配列を更新
            currentCut.layers = currentIndependentState;
            
            // 【重要】独立状態マップも更新
            this.cutLayerStates.set(currentCut.id, this.deepCloneCutLayers(currentIndependentState));
            
            console.log(`✅ CUT状態保存完了: ${currentCut.name} (${currentIndependentState.length} layers)`);
        }
        
        // 【改修】CUT状態設定 - 完全復元
        setActiveCut(cutIndex, resetTransform = false) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) {
                console.warn(`setActiveCut: Invalid cut ${cutIndex}`);
                return;
            }
            
            console.log(`🔄 CUT状態復元開始: ${cut.name}`);
            
            // 【重要】既存レイヤーを完全クリア
            this.clearLayerSystemLayers();
            
            // 【重要】CUT独立状態からレイヤーを完全復元
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
            this.rebuildLayersFromCutData(cutLayers, resetTransform);
            
            // UI更新
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            console.log(`✅ CUT状態復元完了: ${cut.name} (${cutLayers.length} layers)`);
        }
        
        // 【改修】レイヤーシステム完全クリア
        clearLayerSystemLayers() {
            if (!this.layerSystem?.layers) return;
            
            console.log(`🗑️ レイヤーシステムクリア開始: ${this.layerSystem.layers.length} layers`);
            
            // 【重要】既存レイヤーの完全破棄
            const layersToDestroy = [...this.layerSystem.layers];
            
            layersToDestroy.forEach((layer, index) => {
                try {
                    // パスグラフィックスの破棄
                    if (layer.layerData?.paths) {
                        layer.layerData.paths.forEach(path => {
                            if (path.graphics?.destroy) {
                                path.graphics.destroy();
                            }
                        });
                    }
                    
                    // コンテナから削除
                    if (layer.parent) {
                        layer.parent.removeChild(layer);
                    }
                    
                    // レイヤー破棄
                    if (layer.destroy) {
                        layer.destroy({ children: true, texture: false, baseTexture: false });
                    }
                } catch (error) {
                    console.warn(`Layer ${index} destruction failed:`, error);
                }
            });
            
            // 【重要】LayerSystemの状態をリセット
            this.layerSystem.layers = [];
            this.layerSystem.layerTransforms.clear();
            this.layerSystem.activeLayerIndex = -1;
            
            console.log('✅ レイヤーシステムクリア完了');
        }
        
        // 【改修】CUT独立データからレイヤー復元 - 完全再構築
        rebuildLayersFromCutData(cutLayers, resetTransform = false) {
            if (!cutLayers || !Array.isArray(cutLayers) || cutLayers.length === 0) {
                console.log('復元対象レイヤーなし');
                return;
            }
            
            console.log(`🔨 レイヤー復元開始: ${cutLayers.length} layers`);
            
            cutLayers.forEach((cutLayerData, index) => {
                try {
                    // 【重要】新しいPIXIコンテナ作成
                    const layer = new PIXI.Container();
                    layer.label = cutLayerData.id;
                    
                    // 【重要】レイヤーデータの完全復元
                    layer.layerData = {
                        id: cutLayerData.id,
                        name: cutLayerData.name || `レイヤー${index + 1}`,
                        visible: cutLayerData.visible !== false,
                        opacity: cutLayerData.opacity || 1.0,
                        isBackground: cutLayerData.isBackground || false,
                        paths: []
                    };
                    
                    // 【重要】変形状態の復元
                    const transform = cutLayerData.transform || {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    };
                    
                    // LayerSystemの変形マップに登録
                    this.layerSystem.layerTransforms.set(cutLayerData.id, {
                        x: Number(transform.x) || 0,
                        y: Number(transform.y) || 0,
                        rotation: Number(transform.rotation) || 0,
                        scaleX: Number(transform.scaleX) || 1,
                        scaleY: Number(transform.scaleY) || 1
                    });
                    
                    // 背景グラフィックス復元
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
                    
                    // 【重要】パスデータの復元
                    if (cutLayerData.paths && Array.isArray(cutLayerData.paths)) {
                        cutLayerData.paths.forEach(pathData => {
                            const reconstructedPath = this.rebuildPathFromData(pathData);
                            if (reconstructedPath) {
                                layer.layerData.paths.push(reconstructedPath);
                                layer.addChild(reconstructedPath.graphics);
                            }
                        });
                    }
                    
                    // レイヤー表示設定
                    layer.visible = cutLayerData.visible !== false;
                    layer.alpha = cutLayerData.opacity || 1.0;
                    
                    // 【重要】変形適用
                    if (!resetTransform && this.shouldApplyTransform(transform)) {
                        this.applyTransformToLayerFixed(layer, transform);
                    } else {
                        // デフォルト状態
                        layer.position.set(0, 0);
                        layer.pivot.set(0, 0);
                        layer.rotation = 0;
                        layer.scale.set(1, 1);
                    }
                    
                    // LayerSystemに登録
                    this.layerSystem.layers.push(layer);
                    this.layerSystem.layersContainer.addChild(layer);
                    
                    console.log(`✅ レイヤー復元完了: ${cutLayerData.name} (${cutLayerData.paths?.length || 0} paths)`);
                    
                } catch (error) {
                    console.error(`Layer ${index} rebuild failed:`, error);
                }
            });
            
            // アクティブレイヤー設定
            if (this.layerSystem.layers.length > 0) {
                this.layerSystem.activeLayerIndex = Math.max(0, this.layerSystem.layers.length - 1);
            }
            
            console.log(`✅ 全レイヤー復元完了: ${this.layerSystem.layers.length} layers`);
        }
        
        // 【改修】パス復元 - PixiJS v8.13対応
        rebuildPathFromData(pathData) {
            if (!pathData?.points || !Array.isArray(pathData.points) || pathData.points.length === 0) {
                return null;
            }
            
            try {
                const graphics = new PIXI.Graphics();
                
                // PixiJS v8.13 円描画方式
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
                
                return {
                    id: pathData.id || ('path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
                    points: [...pathData.points],
                    size: pathData.size || 16,
                    color: pathData.color || 0x800000,
                    opacity: pathData.opacity || 1.0,
                    tool: pathData.tool || 'pen',
                    graphics: graphics
                };
                
            } catch (error) {
                console.error('Path rebuild failed:', error);
                return null;
            }
        }
        
        // 変形適用判定
        shouldApplyTransform(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }
        
        // 【改修】レイヤー変形適用 - 座標系統一
        applyTransformToLayerFixed(layer, transform) {
            if (!transform || !layer) return;
            
            const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            
            // 【統一】座標変換API使用
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                // フォールバック：直接適用
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
            
            // LayerSystemの変形マップに保存
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
        
        // 【改修】CUT状態保存 - 自動実行
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            // 【重要】現在の状態を独立状態に変換
            const currentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            currentCut.layers = currentState;
            
            // 独立状態マップも更新
            this.cutLayerStates.set(currentCut.id, this.deepCloneCutLayers(currentState));
            
            // サムネイル更新（非同期）
            setTimeout(() => {
                this.generateCutThumbnailOptimized(this.animationData.playback.currentCutIndex);
            }, 100);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        // 【改修】サムネイル生成 - CUT状態完全分離
        async generateCutThumbnailOptimized(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem || !this.app?.renderer) {
                console.warn(`Thumbnail generation skipped for cut ${cutIndex}: missing dependencies`);
                return;
            }
            
            console.log(`🖼️ サムネイル生成開始: CUT ${cutIndex} (${cut.name})`);
            
            try {
                const currentCutIndex = this.animationData.playback.currentCutIndex;
                let shouldRestoreOriginal = false;
                
                // 【重要】他のCUTのサムネイル生成時は一時的状態変更
                if (cutIndex !== currentCutIndex) {
                    shouldRestoreOriginal = true;
                    await this.temporarilyApplyCutStateForThumbnail(cutIndex);
                }
                
                // 【改修】キャンバス比率対応サムネイル生成
                const thumbnailCanvas = await this.generateLayerCompositeCanvasOptimized();
                
                if (thumbnailCanvas) {
                    // 古いテクスチャを破棄
                    if (cut.thumbnail) {
                        cut.thumbnail.destroy();
                    }
                    
                    // 新しいテクスチャ作成
                    cut.thumbnail = PIXI.Texture.from(thumbnailCanvas);
                    
                    console.log(`✅ サムネイル生成完了: CUT ${cutIndex}`);
                } else {
                    console.warn(`サムネイル生成失敗: CUT ${cutIndex}`);
                }
                
                // 【重要】元のCUT状態に復元
                if (shouldRestoreOriginal) {
                    await this.restoreOriginalCutStateAfterThumbnail(currentCutIndex);
                }
                
                // 生成完了通知
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
                }
                
            } catch (error) {
                console.error(`Thumbnail generation error for cut ${cutIndex}:`, error);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-failed', { cutIndex, error: error.message });
                }
            }
        }
        
        // サムネイル生成用一時CUT状態適用
        async temporarilyApplyCutStateForThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            console.log(`📋 一時CUT状態適用: ${cut.name} (サムネイル用)`);
            
            // 現在のレイヤーを完全クリア
            this.clearLayerSystemLayers();
            
            // 対象CUTの状態を復元
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
            this.rebuildLayersFromCutData(cutLayers, false);
            
            // レンダリング安定化待機
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // サムネイル生成後の元状態復元
        async restoreOriginalCutStateAfterThumbnail(originalCutIndex) {
            const originalCut = this.animationData.cuts[originalCutIndex];
            if (!originalCut) return;
            
            console.log(`🔄 元CUT状態復元: ${originalCut.name} (サムネイル後)`);
            
            // 元のCUT状態を完全復元
            this.clearLayerSystemLayers();
            const originalLayers = this.cutLayerStates.get(originalCut.id) || originalCut.layers || [];
            this.rebuildLayersFromCutData(originalLayers, false);
            
            // UI更新
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            // 復元完了待機
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 【改修】キャンバス比率対応合成Canvas生成
        async generateLayerCompositeCanvasOptimized() {
            try {
                if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                    return this.createEmptyThumbnailCanvas();
                }
                
                // 【重要】プロジェクトキャンバス設定取得
                const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
                const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
                const canvasAspectRatio = canvasWidth / canvasHeight;
                
                // タイムライン用サムネイルサイズ計算
                const maxThumbWidth = 72;
                const maxThumbHeight = 54;
                
                let thumbWidth, thumbHeight;
                
                // 【重要】アスペクト比維持計算
                if (canvasAspectRatio >= maxThumbWidth / maxThumbHeight) {
                    // 横長キャンバス対応
                    thumbWidth = maxThumbWidth;
                    thumbHeight = Math.round(maxThumbWidth / canvasAspectRatio);
                } else {
                    // 縦長キャンバス対応  
                    thumbHeight = maxThumbHeight;
                    thumbWidth = Math.round(maxThumbHeight * canvasAspectRatio);
                }
                
                // 高品質レンダリング用Canvas作成
                const compositeCanvas = document.createElement('canvas');
                compositeCanvas.width = thumbWidth;
                compositeCanvas.height = thumbHeight;
                
                const ctx = compositeCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, thumbWidth, thumbHeight);
                
                // 【重要】レイヤー順序でレンダリング（背景→前景）
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    const layer = this.layerSystem.layers[i];
                    
                    // 非表示レイヤーはスキップ
                    if (!layer.visible || layer.layerData?.visible === false) continue;
                    
                    try {
                        // レイヤーを個別Canvas化
                        const layerCanvas = await this.renderLayerToCanvasOptimized(layer);
                        
                        if (layerCanvas) {
                            // レイヤー不透明度適用
                            const opacity = layer.alpha * (layer.layerData?.opacity || 1.0);
                            ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
                            
                            // キャンバスサイズに合わせて描画
                            ctx.drawImage(layerCanvas, 0, 0, thumbWidth, thumbHeight);
                            ctx.globalAlpha = 1.0;
                        }
                        
                    } catch (layerError) {
                        console.warn(`Layer ${i} rendering failed for thumbnail:`, layerError);
                    }
                }
                
                console.log(`🖼️ 合成Canvas生成完了: ${thumbWidth}x${thumbHeight} (ratio: ${canvasAspectRatio.toFixed(2)})`);
                return compositeCanvas;
                
            } catch (error) {
                console.error('Composite canvas generation failed:', error);
                return this.createEmptyThumbnailCanvas();
            }
        }
        
        // 空のサムネイル用Canvas作成
        createEmptyThumbnailCanvas() {
            const canvas = document.createElement('canvas');
            canvas.width = 72;
            canvas.height = 54;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0e0d6';
            ctx.fillRect(0, 0, 72, 54);
            
            // "Empty CUT"テキスト
            ctx.fillStyle = '#800000';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Empty CUT', 36, 30);
            
            return canvas;
        }
        
        // 【改修】レイヤー個別レンダリング - PixiJS v8.13 multiView警告対策
        async renderLayerToCanvasOptimized(layer) {
            try {
                if (!this.app?.renderer || !layer) return null;
                
                const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
                const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
                
                // 【重要】multiView警告対策：高解像度RenderTexture作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: canvasWidth,
                    height: canvasHeight,
                    resolution: 1
                });
                
                // 【重要】一時コンテナで分離レンダリング
                const tempContainer = new PIXI.Container();
                
                // レイヤーの親子関係を安全に操作
                const originalParent = layer.parent;
                const originalIndex = originalParent ? originalParent.getChildIndex(layer) : -1;
                
                // 一時的に親から分離
                if (originalParent) {
                    originalParent.removeChild(layer);
                }
                
                tempContainer.addChild(layer);
                
                // PixiJS v8.13 レンダリング方式
                this.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // Canvasを抽出
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                
                // レイヤーを元の位置に復元
                tempContainer.removeChild(layer);
                if (originalParent && originalIndex !== -1) {
                    originalParent.addChildAt(layer, originalIndex);
                } else if (originalParent) {
                    originalParent.addChild(layer);
                }
                
                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                console.error('Layer canvas rendering failed:', error);
                return null;
            }
        }
        
        // 【追加】ディープクローン - CUT状態完全独立保証
        deepCloneCutLayers(cutLayers) {
            if (!cutLayers || !Array.isArray(cutLayers)) return [];
            
            return cutLayers.map(layer => ({
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
                paths: layer.paths ? layer.paths.map(path => ({
                    id: path.id,
                    points: path.points ? path.points.map(p => ({ x: p.x, y: p.y })) : [],
                    size: path.size || 16,
                    color: path.color || 0x800000,
                    opacity: path.opacity || 1.0,
                    tool: path.tool || 'pen',
                    isComplete: path.isComplete || true
                })) : [],
                createdAt: layer.createdAt || Date.now(),
                cutId: layer.cutId
            }));
        }
        
        // ===== CUT クリップボード機能 =====
        
        copyCurrent() {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return false;
            
            // 最新状態を保存してからコピー
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
            
            console.log(`📋 CUTコピー完了: ${currentCut.name}`);
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
            
            console.log(`📋 CUT右隣ペースト完了: ${pastedCut.name} at index ${insertIndex}`);
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
            
            console.log(`📋 CUT新規ペースト完了: ${pastedCut.name} at index ${newIndex}`);
            return true;
        }
        
        deepCopyCutData(cutData) {
            if (!cutData) return null;
            
            return {
                name: cutData.name,
                duration: cutData.duration,
                layers: this.deepCloneCutLayers(cutData.layers),
                thumbnail: null, // サムネイルは再生成
                originalId: cutData.id
            };
        }
        
        createCutFromClipboard(clipboardData) {
            if (!clipboardData) return null;
            
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // レイヤーIDを新規CUT用に再生成
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
                thumbnail: null
            };
            
            // 独立状態マップに保存
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(newLayers));
            
            // サムネイル生成（非同期）
            setTimeout(() => {
                const cutIndex = this.animationData.cuts.findIndex(c => c.id === cut.id);
                if (cutIndex !== -1) {
                    this.generateCutThumbnailOptimized(cutIndex);
                }
            }, 200);
            
            return cut;
        }
        
        getCutClipboardInfo() {
            return {
                hasCutData: !!this.cutClipboard.cutData,
                timestamp: this.cutClipboard.timestamp,
                sourceId: this.cutClipboard.sourceId,
                layerCount: this.cutClipboard.cutData?.layers?.length || 0
            };
        }
        
        clearCutClipboard() {
            this.cutClipboard.cutData = null;
            this.cutClipboard.timestamp = null;
            this.cutClipboard.sourceId = null;
            
            if (this.eventBus) {
                this.eventBus.emit('cut:clipboard-cleared');
            }
        }
        
        // ===== CUT管理・プレイバック制御 =====
        
        createInitialCutIfNeeded() {
            if (this.initialCutCreated || this.animationData.cuts.length > 0 || this.isInitializing) {
                return;
            }
            
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                console.log('LayerSystem not ready for initial CUT creation');
                return;
            }
            
            this.isInitializing = true;
            
            try {
                console.log('🎬 初期CUT作成開始...');
                const initialCut = this.createNewCutFromCurrentLayers();
                this.initialCutCreated = true;
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:initial-cut-created', { 
                        cutId: initialCut.id,
                        cutIndex: 0
                    });
                }
                
                console.log('✅ 初期CUT作成完了:', initialCut.name);
            } catch (error) {
                console.error('Initial CUT creation failed:', error);
            } finally {
                this.isInitializing = false;
            }
        }
        
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) {
                console.warn(`Invalid cut index for deletion: ${cutIndex}`);
                return false;
            }
            
            if (this.animationData.cuts.length <= 1) {
                console.warn('Cannot delete last remaining cut');
                return false;
            }
            
            const cut = this.animationData.cuts[cutIndex];
            console.log(`🗑️ CUT削除開始: ${cut.name}`);
            
            // リソース解放
            if (cut.thumbnail) {
                cut.thumbnail.destroy();
            }
            
            // 独立状態マップからも削除
            this.cutLayerStates.delete(cut.id);
            this.cutLayerIdCounters.delete(cut.id);
            
            // CUT配列から削除
            this.animationData.cuts.splice(cutIndex, 1);
            
            // アクティブCUTインデックス調整
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            // 削除後のCUTに切り替え
            if (this.animationData.cuts.length > 0) {
                const newIndex = Math.min(cutIndex, this.animationData.cuts.length - 1);
                this.switchToActiveCutSafely(newIndex, false);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            console.log(`✅ CUT削除完了: ${cut.name}`);
            return true;
        }
        
        // プレイバック制御
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
        
        // ===== CUT・レイヤー管理API =====
        
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
            
            // CUT専用レイヤーID生成
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
            
            // CUT内レイヤー配列に追加
            currentCut.layers.push(cutLayerData);
            
            // 独立状態マップも更新
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
            
            const layerId = layer.layerData.id;
            
            // 現在の状態を保存
            this.saveCutLayerStates();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:current-cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex: layerIndex,
                    layerId: layerId
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
            
            // アクティブCUTインデックス調整
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
            
            if (this.animationData.playback.isPlaying && settings.fps) {
                this.stopPlaybackLoop();
                this.startPlaybackLoop();
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:settings-updated', { settings });
            }
        }
        
        // ===== 状態・データ取得API =====
        
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
        
        // ===== アニメーションモード制御 =====
        
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
        
        clearAnimation() {
            this.stop();
            
            // 全CUTのリソース解放
            this.animationData.cuts.forEach(cut => {
                if (cut.thumbnail) {
                    cut.thumbnail.destroy();
                }
            });
            
            // 状態リセット
            this.animationData = this.createDefaultAnimation();
            this.initialCutCreated = false;
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            // マップ類クリア
            this.cutLayerIdCounters.clear();
            this.cutLayerStates.clear();
            this.clearCutClipboard();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cleared');
            }
        }
        
        // ===== システム診断・デバッグ =====
        
        checkCoordinateSystem() {
            if (this.coordAPI) {
                return this.coordAPI.diagnoseReferences ? 
                    this.coordAPI.diagnoseReferences() : 
                    { status: 'available', version: 'unknown' };
            } else {
                return { status: 'not_available', issue: 'CoordinateSystem not loaded' };
            }
        }
        
        checkLayerSystemAPI() {
            if (!this.layerSystem) {
                return { status: 'not_available', issue: 'LayerSystem reference missing' };
            }
            
            return {
                status: 'available',
                hasLayers: !!this.layerSystem.layers,
                hasTransforms: !!this.layerSystem.layerTransforms,
                hasContainer: !!(this.layerSystem.layersContainer || this.layerSystem.worldContainer),
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0,
                hasAnimationSystemRef: !!this.layerSystem.animationSystem,
                transformMapSize: this.layerSystem.layerTransforms ? this.layerSystem.layerTransforms.size : 0
            };
        }
        
        checkEventBusIntegration() {
            if (!this.eventBus) {
                return { status: 'not_available', issue: 'EventBus reference missing' };
            }
            
            const requiredEvents = [
                'layer:path-added', 'layer:updated', 'layer:visibility-changed',
                'drawing:stroke-completed', 'animation:cut-created', 'animation:cut-applied'
            ];
            
            return {
                status: 'available',
                eventBusType: this.eventBus.constructor.name,
                requiredEvents: requiredEvents,
                hasEmit: typeof this.eventBus.emit === 'function',
                hasOn: typeof this.eventBus.on === 'function'
            };
        }
        
        // 総合システム診断
        diagnoseSystem() {
            const diagnosis = {
                timestamp: new Date().toISOString(),
                animationSystem: {
                    initialized: this.hasInitialized,
                    cutsCount: this.animationData.cuts.length,
                    currentCutIndex: this.animationData.playback.currentCutIndex,
                    isPlaying: this.animationData.playback.isPlaying,
                    cutLayerStatesSize: this.cutLayerStates.size,
                    cutLayerIdCountersSize: this.cutLayerIdCounters.size
                },
                coordinateSystem: this.checkCoordinateSystem(),
                layerSystem: this.checkLayerSystemAPI(),
                eventBus: this.checkEventBusIntegration(),
                pixiJS: {
                    hasApp: !!this.app,
                    hasRenderer: !!(this.app?.renderer),
                    rendererType: this.app?.renderer?.type,
                    canvasSize: this.app?.renderer ? {
                        width: this.app.renderer.width,
                        height: this.app.renderer.height
                    } : null
                }
            };
            
            // 問題検出
            const issues = [];
            
            if (!this.hasInitialized) issues.push('AnimationSystem not initialized');
            if (diagnosis.coordinateSystem.status === 'not_available') issues.push('CoordinateSystem missing');
            if (diagnosis.layerSystem.status === 'not_available') issues.push('LayerSystem missing');
            if (diagnosis.eventBus.status === 'not_available') issues.push('EventBus missing');
            if (!this.app?.renderer) issues.push('PixiJS renderer missing');
            
            diagnosis.issues = issues;
            diagnosis.healthScore = Math.max(0, 100 - (issues.length * 20));
            
            return diagnosis;
        }
        
        debugInfo() {
            const info = {
                // 基本状態
                isAnimationMode: this.isAnimationMode,
                cutsCount: this.animationData.cuts.length,
                initialCutCreated: this.initialCutCreated,
                isPlaying: this.animationData.playback.isPlaying,
                currentCut: this.animationData.playback.currentCutIndex,
                
                // CUT独立性状態
                cutLayerStatesSize: this.cutLayerStates.size,
                cutLayerIdCountersSize: this.cutLayerIdCounters.size,
                
                // クリップボード状態
                cutClipboard: this.getCutClipboardInfo(),
                
                // システム連携状態
                hasLayerSystem: !!this.layerSystem,
                hasEventBus: !!this.eventBus,
                hasCoordAPI: !!this.coordAPI,
                
                // CUT詳細
                cuts: this.animationData.cuts.map((cut, index) => ({
                    index,
                    id: cut.id,
                    name: cut.name,
                    duration: cut.duration,
                    layersCount: cut.layers?.length || 0,
                    hasThumbnail: !!cut.thumbnail,
                    hasIndependentState: this.cutLayerStates.has(cut.id)
                }))
            };
            
            return info;
        }
        
        // デバッグ出力
        logDebugInfo() {
            console.log('🔍 AnimationSystem Debug Info:');
            console.log('=====================================');
            
            const info = this.debugInfo();
            const diagnosis = this.diagnoseSystem();
            
            console.log('📊 Basic Status:');
            console.log(`  - Initialized: ${info.hasLayerSystem && info.hasEventBus ? '✅' : '❌'}`);
            console.log(`  - Animation Mode: ${info.isAnimationMode ? '✅' : '❌'}`);
            console.log(`  - CUTs Count: ${info.cutsCount}`);
            console.log(`  - Current CUT: ${info.currentCut + 1}/${info.cutsCount}`);
            console.log(`  - Playing: ${info.isPlaying ? '▶️' : '⏹️'}`);
            
            console.log('🎬 CUT Independence:');
            console.log(`  - Cut Layer States: ${info.cutLayerStatesSize}`);
            console.log(`  - Cut ID Counters: ${info.cutLayerIdCountersSize}`);
            
            console.log('🔗 System Integration:');
            console.log(`  - LayerSystem: ${info.hasLayerSystem ? '✅' : '❌'}`);
            console.log(`  - EventBus: ${info.hasEventBus ? '✅' : '❌'}`);
            console.log(`  - CoordAPI: ${info.hasCoordAPI ? '✅' : '❌'}`);
            
            console.log('🏥 Health Check:');
            console.log(`  - Health Score: ${diagnosis.healthScore}%`);
            if (diagnosis.issues.length > 0) {
                console.log('  - Issues:', diagnosis.issues);
            } else {
                console.log('  - Status: All systems operational ✅');
            }
            
            console.log('🎞️ CUT Details:');
            info.cuts.forEach(cut => {
                console.log(`  - CUT${cut.index + 1}: ${cut.name} (${cut.layersCount} layers, ${cut.hasThumbnail ? '🖼️' : '❌'} thumbnail)`);
            });
            
            console.log('=====================================');
            
            return { info, diagnosis };
        }
    }
    
    // グローバル公開
    window.TegakiAnimationSystem = AnimationSystem;
    
    console.log('✅ animation-system.js loaded (完全2次元マトリクス改修版)');
    console.log('🔧 改修完了項目:');
    console.log('  🆕 CUT×レイヤー 完全独立2次元マトリクス実現');
    console.log('  🆕 cutLayerStates Map: CUT状態完全分離');
    console.log('  🆕 copyCurrentLayersToIndependentState(): 完全独立コピー');
    console.log('  🆕 generateCutThumbnailOptimized(): CUT状態分離対応');
    console.log('  🆕 temporarilyApplyCutStateForThumbnail(): 一時状態変更');
    console.log('  🆕 generateLayerCompositeCanvasOptimized(): キャンバス比率対応');
    console.log('  🆕 renderLayerToCanvasOptimized(): PixiJS v8.13 multiView対応');
    console.log('  🆕 deepCloneCutLayers(): ディープクローン実装');
    console.log('  🔧 saveCutLayerStatesBeforeSwitch(): 切り替え前完全保存');
    console.log('  🔧 rebuildLayersFromCutData(): 完全復元');
    console.log('  🔧 clearLayerSystemLayers(): 完全クリア');
    console.log('  🔧 applyTransformToLayerFixed(): 座標系API統一');
    console.log('  🔧 setupLayerChangeListener(): 自動状態保存');
    console.log('  🔧 diagnoseSystem(): 総合システム診断');
    console.log('  ✅ CoordinateSystem API統合');
    console.log('  ✅ EventBus完全統合');
    console.log('  ✅ PixiJS v8.13 完全対応');

})();