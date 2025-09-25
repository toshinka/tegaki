// ===== systems/drawing-clipboard.js - クリップボード機能システム =====
// 非破壊コピー・ペースト・選択範囲管理
// PixiJS v8.13準拠

(function() {
    'use strict';

    const ClipboardSystem = {
        name: 'ClipboardSystem',
        
        // 初期化
        init: function(opts) {
            console.log('ClipboardSystem: Initializing...');
            
            this.app = opts.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            this.layerSystem = opts.layerSystem;
            
            // クリップボードデータ
            this.clipboardData = null;
            
            // 依存システム参照
            this.cameraSystem = null;
            this.drawingEngine = null;
            
            this.setupKeyboardEvents();
            
            console.log('ClipboardSystem: Initialized successfully');
        },

        // キーボードイベント設定
        setupKeyboardEvents: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copy();
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.paste();
                    e.preventDefault();
                }
            });
        },

        // 基本コピー操作
        copy: function(bounds = null) {
            if (!this.layerSystem) {
                console.warn('ClipboardSystem: LayerSystem not available');
                return null;
            }

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) {
                console.warn('ClipboardSystem: No active layer to copy');
                return null;
            }

            return this.copyActiveLayer(bounds);
        },

        // アクティブレイヤーの非破壊コピー
        copyActiveLayer: function(bounds = null) {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return null;

            try {
                console.log('ClipboardSystem: Starting non-destructive copy');
                
                // 現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerSystem.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (this.layerSystem.isTransformNonDefault(currentTransform)) {
                    // 変形中の場合：仮想変形適用座標を生成
                    console.log('ClipboardSystem: Layer has transforms - generating virtual coordinates');
                    pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
                } else {
                    // 未変形の場合：そのままコピー
                    console.log('ClipboardSystem: Layer has no transforms - copying original paths');
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                // 選択範囲が指定されている場合のフィルタリング
                if (bounds) {
                    pathsToStore = this.filterPathsByBounds(pathsToStore, bounds);
                }
                
                // レイヤーデータのディープコピー
                const layerData = activeLayer.layerData;
                
                // 背景データのコピー
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: this.CONFIG.background.color
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
                        isNonDestructive: true,
                        hasTransforms: this.layerSystem.isTransformNonDefault(currentTransform),
                        bounds: bounds
                    },
                    timestamp: Date.now()
                };

                console.log(`ClipboardSystem: Copy completed - ${pathsToStore.length} paths preserved`);
                
                // EventBus通知
                if (window.Tegaki?.EventBus) {
                    window.Tegaki.EventBus.emit('clipboard.copied', {
                        layerId: layerId,
                        pathCount: pathsToStore.length,
                        hasTransforms: this.clipboardData.metadata.hasTransforms
                    });
                }
                
                return this.clipboardData;
                
            } catch (error) {
                console.error('ClipboardSystem: Copy failed:', error);
                return null;
            }
        },

        // 現在の変形状態を適用した座標を仮想計算
        getTransformedPaths: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            // 変形行列作成
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            // パスに仮想変形を適用（元データは変更しない）
            return (layer.layerData.paths || []).map(path => ({
                id: `${path.id}_transformed_${Date.now()}`,
                points: (path.points || []).map(point => matrix.apply(point)),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        },

        // 選択範囲によるパスフィルタリング
        filterPathsByBounds: function(paths, bounds) {
            return paths.filter(path => {
                if (!path.points || path.points.length === 0) return false;
                
                // パスの点が選択範囲内にあるかチェック
                return path.points.some(point => 
                    point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                    point.y >= bounds.y && point.y <= bounds.y + bounds.height
                );
            });
        },

        // パスデータの完全ディープコピー
        deepCopyPaths: function(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: (path.points || []).map(point => ({ x: point.x, y: point.y })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        },

        // カット操作
        cut: function(bounds = null) {
            const clipboardData = this.copy(bounds);
            if (!clipboardData) return null;

            // 選択範囲が指定されている場合、その部分を削除
            if (bounds) {
                this.deletePathsInBounds(bounds);
            } else {
                // レイヤー全体をカットする場合は内容をクリア
                this.clearActiveLayer();
            }

            // EventBus通知
            if (window.Tegaki?.EventBus) {
                window.Tegaki.EventBus.emit('clipboard.cut', {
                    bounds: bounds,
                    pathCount: clipboardData.metadata.pathCount
                });
            }

            return clipboardData;
        },

        // 基本ペースト操作
        paste: function(position = null) {
            if (!this.clipboardData) {
                console.warn('ClipboardSystem: No clipboard data to paste');
                return null;
            }

            return this.pasteLayer(position);
        },

        // レイヤーペースト（指定位置）
        pasteAt: function(x, y, options = {}) {
            return this.paste({ x, y, ...options });
        },

        // 非破壊レイヤーペースト
        pasteLayer: function(position = null) {
            if (!this.layerSystem) {
                console.warn('ClipboardSystem: LayerSystem not available');
                return null;
            }

            if (!this.clipboardData) {
                console.warn('ClipboardSystem: No clipboard data to paste');
                return null;
            }

            try {
                const clipData = this.clipboardData;
                
                // 非破壊コピーの検証
                if (!clipData.metadata?.isNonDestructive) {
                    console.warn('ClipboardSystem: Pasting potentially degraded data');
                } else {
                    console.log('ClipboardSystem: Pasting non-destructive data:', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = this.generateUniqueLayerName(clipData.layerData.name);

                // 新規レイヤーを作成
                const { layer, index } = this.layerSystem.createLayer(layerName, false);

                // 背景データが存在する場合は背景として再構築
                if (clipData.layerData.backgroundData) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, this.CONFIG.canvas.width, this.CONFIG.canvas.height);
                    bg.fill(clipData.layerData.backgroundData.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                    layer.layerData.isBackground = true;
                }

                // パスデータ完全復元
                let addedPaths = 0;
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        let adjustedPoints = pathData.points;
                        
                        // 位置調整が指定されている場合
                        if (position && (position.x !== undefined || position.y !== undefined)) {
                            const offsetX = position.x || 0;
                            const offsetY = position.y || 0;
                            
                            adjustedPoints = pathData.points.map(point => ({
                                x: point.x + offsetX,
                                y: point.y + offsetY
                            }));
                        }
                        
                        const newPath = {
                            id: pathData.id,
                            points: [...adjustedPoints],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null
                        };
                        
                        // パスGraphicsを生成
                        const rebuildSuccess = this.layerSystem.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            layer.layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                            addedPaths++;
                        }
                    }
                });

                // レイヤー変形データを初期化
                const newLayerId = layer.layerData.id;
                this.layerSystem.layerTransforms.set(newLayerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });

                // レイヤーの可視性と不透明度を復元
                layer.layerData.visible = clipData.layerData.visible;
                layer.layerData.opacity = clipData.layerData.opacity;
                layer.visible = clipData.layerData.visible;
                layer.alpha = clipData.layerData.opacity;

                // 新しいレイヤーをアクティブに設定
                this.layerSystem.setActiveLayer(index);
                
                // UI更新
                this.layerSystem.updateLayerPanelUI();
                this.layerSystem.updateStatusDisplay();
                
                // サムネイル更新
                this.layerSystem.requestThumbnailUpdate(index);

                console.log(`ClipboardSystem: Paste completed - ${addedPaths} paths restored`);
                
                // EventBus通知
                if (window.Tegaki?.EventBus) {
                    window.Tegaki.EventBus.emit('clipboard.pasted', {
                        layerId: newLayerId,
                        layerName: layerName,
                        pathCount: addedPaths,
                        position: position
                    });
                }
                
                return {
                    layer: layer,
                    index: index,
                    pathCount: addedPaths
                };
                
            } catch (error) {
                console.error('ClipboardSystem: Paste failed:', error);
                return null;
            }
        },

        // 選択範囲内のパス削除
        deletePathsInBounds: function(bounds) {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;

            const pathsToKeep = activeLayer.layerData.paths.filter(path => {
                if (!path.points || path.points.length === 0) return true;
                
                // パスが選択範囲外にある場合は保持
                return !path.points.some(point => 
                    point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                    point.y >= bounds.y && point.y <= bounds.y + bounds.height
                );
            });

            // 削除されるパスのGraphicsを削除
            activeLayer.layerData.paths.forEach(path => {
                if (!pathsToKeep.includes(path) && path.graphics) {
                    activeLayer.removeChild(path.graphics);
                    if (path.graphics.destroy) {
                        path.graphics.destroy();
                    }
                }
            });

            // パスリストを更新
            activeLayer.layerData.paths = pathsToKeep;
            
            // サムネイル更新
            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
        },

        // アクティブレイヤーのクリア
        clearActiveLayer: function() {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;

            // パスGraphicsを削除
            activeLayer.layerData.paths.forEach(path => {
                if (path.graphics) {
                    activeLayer.removeChild(path.graphics);
                    if (path.graphics.destroy) {
                        path.graphics.destroy();
                    }
                }
            });

            // パスリストをクリア（背景は保持）
            activeLayer.layerData.paths = [];
            
            // サムネイル更新
            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
        },

        // 一意なレイヤー名を生成
        generateUniqueLayerName: function(baseName) {
            let name = baseName;
            let counter = 1;
            
            while (this.layerSystem.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        },

        // クリップボード状態管理
        hasContent: function() {
            return this.clipboardData !== null;
        },

        clear: function() {
            this.clipboardData = null;
            
            // EventBus通知
            if (window.Tegaki?.EventBus) {
                window.Tegaki.EventBus.emit('clipboard.cleared', {});
            }
        },

        // クリップボード情報取得
        getClipboardInfo: function() {
            if (!this.clipboardData) return null;
            
            return {
                pathCount: this.clipboardData.metadata.pathCount,
                hasTransforms: this.clipboardData.metadata.hasTransforms,
                copiedAt: this.clipboardData.metadata.copiedAt,
                layerName: this.clipboardData.layerData.name,
                isNonDestructive: this.clipboardData.metadata.isNonDestructive
            };
        },

        // シリアライズ
        serialize: function() {
            return {
                clipboardData: this.clipboardData,
                timestamp: Date.now()
            };
        },

        // デシリアライズ
        deserialize: function(data) {
            if (data && data.clipboardData) {
                this.clipboardData = data.clipboardData;
                console.log('ClipboardSystem: Data deserialized successfully');
            } else {
                this.clipboardData = null;
            }
        },

        // 外部システム参照設定
        setCameraSystem: function(cameraSystem) {
            this.cameraSystem = cameraSystem;
        },

        setDrawingEngine: function(drawingEngine) {
            this.drawingEngine = drawingEngine;
        },

        setLayerSystem: function(layerSystem) {
            this.layerSystem = layerSystem;
        }
    };

    // グローバル登録
    window.TegakiSystems.Register('ClipboardSystem', ClipboardSystem);

})();