// ===== system/drawing-clipboard.js - 非破壊コピー&ペースト専用モジュール（改修完了版） =====
// レイヤーの非破壊的コピー・ペースト機能
// PixiJS v8.13 対応・改修版LayerSystem完全対応版
// 【改修完了】改修版LayerSystemの変形行列順序に対応

(function() {
    'use strict';

    class DrawingClipboard {
        constructor() {
            this.clipboardData = null;
            this.eventBus = null;
            this.config = null;
            this.layerManager = null;
            
            this._setupKeyboardEvents();
        }

        init(eventBus, config) {
            console.log('DrawingClipboard: Initializing...');
            
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            this._setupEventBusListeners();
            
            console.log('✅ DrawingClipboard initialized (改修完了版)');
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('clipboard:copy-request', () => {
                this.copyActiveLayer();
            });
            
            this.eventBus.on('clipboard:paste-request', () => {
                this.pasteLayer();
            });
            
            this.eventBus.on('clipboard:get-info-request', () => {
                this.eventBus.emit('clipboard:info-response', {
                    hasData: this.hasClipboardData(),
                    summary: this.getClipboardSummary()
                });
            });
        }

        _setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }

        // 改修版：アクティブレイヤーのコピー（改修版LayerSystem対応）
        copyActiveLayer() {
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: 'LayerManager not available' });
                }
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: 'No active layer' });
                }
                return;
            }

            try {
                console.log('Non-destructive copy started (改修完了版)');
                
                // 現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerManager.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (this.layerManager.isTransformNonDefault(currentTransform)) {
                    // 変形中の場合：仮想的に変形適用した座標を生成
                    console.log('Layer has active transforms - generating virtual transformed paths');
                    pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
                } else {
                    // 未変形の場合：そのままコピー
                    console.log('Layer has no transforms - copying original paths');
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                // レイヤーデータのディープコピー
                const layerData = activeLayer.layerData;
                
                // 背景データのコピー（背景レイヤーの場合）
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: this.config.background.color
                    };
                }

                // 完全なパスデータをクリップボードに保存
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyPaths(pathsToStore),
                        backgroundData: backgroundData
                    },
                    // 変形情報はリセット（ペースト時は初期状態）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true, // 非破壊フラグ
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform),
                        systemVersion: 'v8.13_改修完了版'
                    },
                    timestamp: Date.now()
                };

                console.log(`Non-destructive copy completed: ${pathsToStore.length} paths preserved`);
                console.log('Copy metadata:', this.clipboardData.metadata);
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-success', {
                        pathCount: pathsToStore.length,
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform)
                    });
                }
                
            } catch (error) {
                console.error('Failed to copy layer non-destructively:', error);
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: error.message });
                }
            }
        }

        // 【改修版】現在の変形状態を適用した座標を仮想計算（改修版変形行列順序対応）
        getTransformedPaths(layer, transform) {
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            // 【改修】改修版LayerSystemの変形行列順序に合わせた計算
            const matrix = new PIXI.Matrix();
            
            // 改修版LayerSystemと同じ順序で変形行列を作成
            // 1. 基準点を原点に移動
            matrix.translate(-centerX, -centerY);
            // 2. スケール適用
            matrix.scale(transform.scaleX, transform.scaleY);
            // 3. 回転適用
            matrix.rotate(transform.rotation);
            // 4. 位置移動（基準点＋オフセット）
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            // パスに仮想変形を適用（元データは変更しない）
            return (layer.layerData.paths || []).map((path, index) => {
                try {
                    const transformedPoints = (path.points || []).map(point => {
                        try {
                            return matrix.apply(point);
                        } catch (pointError) {
                            console.warn(`Point transform failed for path ${index}, point:`, point, pointError);
                            return point; // 変形に失敗した場合は元の座標を使用
                        }
                    }).filter(point => isFinite(point.x) && isFinite(point.y));
                    
                    return {
                        id: `${path.id}_transformed_${Date.now()}_${index}`,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete
                    };
                } catch (pathError) {
                    console.warn(`Path transform failed for path ${index}:`, pathError);
                    // 変形に失敗した場合は元のパスを返す
                    return {
                        id: `${path.id}_fallback_${Date.now()}_${index}`,
                        points: path.points || [],
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete
                    };
                }
            });
        }

        // パスデータの完全ディープコピー
        deepCopyPaths(paths) {
            return (paths || []).map((path, index) => {
                try {
                    return {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`, // 新しいID
                        points: (path.points || []).map(point => ({ 
                            x: Number(point.x) || 0, 
                            y: Number(point.y) || 0 
                        })), // 座標完全コピー・数値検証
                        color: path.color,
                        size: Number(path.size) || 16,
                        opacity: Number(path.opacity) || 1.0,
                        isComplete: Boolean(path.isComplete)
                    };
                } catch (pathError) {
                    console.warn(`Deep copy failed for path ${index}:`, pathError);
                    return null;
                }
            }).filter(path => path !== null); // null要素を除外
        }

        // 改修版：レイヤーのペースト（改修版LayerSystem対応）
        pasteLayer() {
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'LayerManager not available' });
                }
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'No clipboard data' });
                }
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                // 非破壊コピーの検証
                if (!clipData.metadata?.isNonDestructive) {
                    console.warn('Pasting potentially degraded data');
                } else {
                    console.log('Pasting non-destructive data (改修完了版):', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, this.layerManager);

                // 新規レイヤーを作成
                const { layer, index } = this.layerManager.createLayer(layerName, false);

                // 背景データが存在する場合は背景として再構築
                if (clipData.layerData.backgroundData) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                    bg.fill(clipData.layerData.backgroundData.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                    layer.layerData.isBackground = true;
                }

                // パスデータ完全復元
                let restoredCount = 0;
                clipData.layerData.paths.forEach((pathData, pathIndex) => {
                    try {
                        if (pathData.points && pathData.points.length > 0) {
                            const newPath = {
                                id: pathData.id,
                                points: [...pathData.points], // 座標完全コピー
                                color: pathData.color,
                                size: pathData.size,
                                opacity: pathData.opacity,
                                isComplete: true,
                                graphics: null // 後で生成
                            };
                            
                            // 【改修版対応】パスGraphicsを生成
                            const rebuildSuccess = this.layerManager.rebuildPathGraphics(newPath);
                            
                            if (rebuildSuccess && newPath.graphics) {
                                // レイヤーに追加
                                layer.layerData.paths.push(newPath);
                                layer.addChild(newPath.graphics);
                                restoredCount++;
                            } else {
                                console.warn(`Failed to rebuild graphics for path ${pathIndex}`);
                            }
                        }
                    } catch (pathError) {
                        console.error(`Error restoring path ${pathIndex}:`, pathError);
                    }
                });

                // レイヤー変形データを初期化
                const newLayerId = layer.layerData.id;
                this.layerManager.layerTransforms.set(newLayerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });

                // レイヤーの可視性と不透明度を復元
                layer.layerData.visible = clipData.layerData.visible;
                layer.layerData.opacity = clipData.layerData.opacity;
                layer.visible = clipData.layerData.visible;
                layer.alpha = clipData.layerData.opacity;

                // 新しいレイヤーをアクティブに設定
                this.layerManager.setActiveLayer(index);
                
                // UI更新
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                
                // サムネイル更新
                this.layerManager.requestThumbnailUpdate(index);

                console.log(`Non-destructive paste completed: ${restoredCount}/${clipData.layerData.paths.length} paths restored`);
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-success', {
                        layerName: layerName,
                        pathCount: restoredCount,
                        totalPaths: clipData.layerData.paths.length
                    });
                }
                
            } catch (error) {
                console.error('Failed to paste layer non-destructively:', error);
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: error.message });
                }
            }
        }

        // 一意なレイヤー名を生成
        generateUniqueLayerName(baseName, layerManager) {
            let name = baseName;
            let counter = 1;
            
            while (layerManager.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }

        // クリップボードデータの有無を確認
        hasClipboardData() {
            return this.clipboardData !== null;
        }

        // クリップボードデータの概要を取得
        getClipboardSummary() {
            if (!this.clipboardData) {
                return null;
            }

            const data = this.clipboardData;
            return {
                layerName: data.layerData.name,
                pathCount: data.layerData.paths.length,
                hasBackground: Boolean(data.layerData.backgroundData),
                hasTransforms: data.metadata?.hasTransforms || false,
                copiedAt: data.metadata?.copiedAt || data.timestamp,
                systemVersion: data.metadata?.systemVersion || 'unknown'
            };
        }

        // クリップボードデータをクリア
        clearClipboard() {
            this.clipboardData = null;
            if (this.eventBus) {
                this.eventBus.emit('clipboard:cleared');
            }
        }

        // 内部参照設定用（CoreEngineから呼び出し）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

    // グローバル公開
    window.TegakiDrawingClipboard = DrawingClipboard;

    console.log('✅ drawing-clipboard.js (改修完了版) loaded successfully');
    console.log('   - 【改修】改修版LayerSystemの変形行列順序に完全対応');
    console.log('   - 【改修】非破壊的コピー・ペースト機能の安全性向上');
    console.log('   - EventBus統合完了');
    console.log('   - エラーハンドリング強化');
    console.log('   - PixiJS v8.13対応');

})();