// ===== systems/drawing-clipboard.js - 改修版：GPT5案準拠・完全非破壊クリップボード =====
// クリップボード機能・非破壊コピー・ペースト・canonical座標統一
// PixiJS v8.13準拠・EventBus統合

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
            
            // GPT5案準拠：クリップボードデータ（canonical座標で保存）
            this.clipboardData = null;
            
            // 依存システム参照
            this.cameraSystem = null;
            this.drawingEngine = null;
            
            this.setupKeyboardEvents();
            this.setupEventBusListeners();
            
            console.log('ClipboardSystem: Initialized successfully');
        },

        // EventBusリスナー設定
        setupEventBusListeners: function() {
            // 将来の拡張用（選択範囲コピーなど）
            window.Tegaki.EventBus.on('clipboard:copy', (data) => {
                this.copy(data.bounds);
            });
            
            window.Tegaki.EventBus.on('clipboard:paste', (data) => {
                this.paste(data.position);
            });
        },

        // キーボードイベント設定
        setupKeyboardEvents: function() {
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

                // Ctrl+X: カット（将来実装用）
                if (e.ctrlKey && e.code === 'KeyX' && !e.altKey && !e.metaKey) {
                    // this.cutActiveLayer();
                    // e.preventDefault();
                }
            });
        },

        // === GPT5案準拠：非破壊コピー（canonical座標統一） ===
        copyActiveLayer: function() {
            if (!this.layerSystem) {
                console.warn('ClipboardSystem: LayerSystem not available');
                return null;
            }

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) {
                console.warn('ClipboardSystem: No active layer to copy');
                return null;
            }

            try {
                console.log('ClipboardSystem: Starting non-destructive copy');
                
                // GPT5案準拠：現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerSystem.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (this.layerSystem.isTransformNonDefault(currentTransform)) {
                    // 変形中の場合：仮想的に変形適用した座標を生成（canonical座標として保存）
                    console.log('ClipboardSystem: Layer has active transforms - generating virtual transformed paths');
                    pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
                } else {
                    // 未変形の場合：そのままcanonical座標として保存
                    console.log('ClipboardSystem: Layer has no transforms - copying original canonical paths');
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                // レイヤーデータのディープコピー
                const layerData = activeLayer.layerData;
                
                // 背景データのコピー（背景レイヤーの場合）
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: this.CONFIG.background.color,
                        width: this.CONFIG.canvas.width,
                        height: this.CONFIG.canvas.height
                    };
                }

                // GPT5案準拠：完全なパスデータをクリップボードに保存（canonical座標）
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyPaths(pathsToStore), // canonical座標でディープコピー
                        backgroundData: backgroundData
                    },
                    // GPT5案準拠：変形情報はリセット（ペースト時は初期状態・canonical座標として保存済み）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true, // 非破壊フラグ
                        hasTransforms: this.layerSystem.isTransformNonDefault(currentTransform),
                        canvasSize: { width: this.CONFIG.canvas.width, height: this.CONFIG.canvas.height }
                    },
                    timestamp: Date.now()
                };

                console.log(`ClipboardSystem: Non-destructive copy completed: ${pathsToStore.length} paths preserved in canonical coordinates`);
                console.log('ClipboardSystem: Copy metadata:', this.clipboardData.metadata);
                
                // EventBus通知
                window.Tegaki.EventBus.emit('clipboard:copied', {
                    layerId: layerId,
                    pathCount: pathsToStore.length,
                    hasTransforms: this.clipboardData.metadata.hasTransforms,
                    isNonDestructive: true
                });
                
                return this.clipboardData;
                
            } catch (error) {
                console.error('ClipboardSystem: Failed to copy layer non-destructively:', error);
                return null;
            }
        },

        // GPT5案準拠：現在の変形状態を適用した座標を仮想計算（canonical座標として生成）
        getTransformedPaths: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            // GPT5案準拠：変形行列作成（レイヤー変形をcanonical座標に適用）
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            // GPT5案準拠：パスに仮想変形を適用してcanonical座標として保存（元データは変更しない）
            return (layer.layerData.paths || []).map(path => ({
                id: `${path.id}_transformed_${Date.now()}`,
                points: (path.points || []).map(point => {
                    const transformedPoint = matrix.apply(point);
                    return { x: transformedPoint.x, y: transformedPoint.y }; // canonical座標
                }),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        },

        // GPT5案準拠：パスデータの完全ディープコピー（canonical座標保持）
        deepCopyPaths: function(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 新しいID生成
                points: (path.points || []).map(point => ({ 
                    x: point.x, y: point.y // canonical座標完全コピー
                })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        },

        // === GPT5案準拠：非破壊ペースト（canonical座標復元） ===
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
                
                // GPT5案準拠：非破壊コピーの検証
                if (!clipData.metadata?.isNonDestructive) {
                    console.warn('ClipboardSystem: Pasting potentially degraded data');
                } else {
                    console.log('ClipboardSystem: Pasting non-destructive canonical data:', clipData.metadata);
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

                // GPT5案準拠：パスデータ完全復元（canonical座標で復元）
                let addedPaths = 0;
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        let adjustedPoints = pathData.points;
                        
                        // 位置調整が指定されている場合（canonical座標での調整）
                        if (position && (position.x !== undefined || position.y !== undefined)) {
                            const offsetX = position.x || 0;
                            const offsetY = position.y || 0;
                            
                            adjustedPoints = pathData.points.map(point => ({
                                x: point.x + offsetX,
                                y: point.y + offsetY
                            }));
                        }
                        
                        // GPT5案準拠：canonical座標でパス作成
                        const newPath = {
                            id: pathData.id,
                            points: [...adjustedPoints], // canonical座標完全コピー
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null // 後で生成
                        };
                        
                        // パスGraphicsを生成（canonical座標から）
                        const rebuildSuccess = this.layerSystem.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            layer.layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                            addedPaths++;
                        }
                    }
                });

                // GPT5案準拠：レイヤー変形データを初期化（canonical座標と分離）
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

                console.log(`ClipboardSystem: Non-destructive paste completed: ${addedPaths} paths restored in canonical coordinates`);
                
                // EventBus通知
                window.Tegaki.EventBus.emit('clipboard:pasted', {
                    layerId: newLayerId,
                    layerName: layerName,
                    pathCount: addedPaths,
                    position: position,
                    isNonDestructive: true
                });
                
                return {
                    layer: layer,
                    index: index,
                    pathCount: addedPaths
                };
                
            } catch (error) {
                console.error('ClipboardSystem: Failed to paste layer non-destructively:', error);
                return null;
            }
        },

        // 基本コピー操作（外部API用）
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

            return this.copyActiveLayer();
        },

        // 基本ペースト操作（外部API用）
        paste: function(position = null) {
            if (!this.clipboardData) {
                console.warn('ClipboardSystem: No clipboard data to paste');
                return null;
            }

            return this.pasteLayer(position);
        },

        // 指定位置でのペースト
        pasteAt: function(x, y, options = {}) {
            return this.paste({ x, y, ...options });
        },

        // 選択範囲によるパスフィルタリング（将来実装用）
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

        // カット操作（将来実装用）
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
            window.Tegaki.EventBus.emit('clipboard:cut', {
                bounds: bounds,
                pathCount: clipboardData.metadata.pathCount
            });

            return clipboardData;
        },

        // 選択範囲内のパス削除（将来実装用）
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
            
            // EventBus通知
            window.Tegaki.EventBus.emit('layer:paths:changed', {
                layerId: activeLayer.layerData.id
            });
        },

        // アクティブレイヤーのクリア（将来実装用）
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
            
            // EventBus通知
            window.Tegaki.EventBus.emit('layer:paths:changed', {
                layerId: activeLayer.layerData.id
            });
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
            const hadContent = this.hasContent();
            this.clipboardData = null;
            
            if (hadContent) {
                // EventBus通知
                window.Tegaki.EventBus.emit('clipboard:cleared', {});
                console.log('ClipboardSystem: Clipboard cleared');
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
                isNonDestructive: this.clipboardData.metadata.isNonDestructive,
                canvasSize: this.clipboardData.metadata.canvasSize
            };
        },

        // データ検証
        validateClipboardData: function(data) {
            if (!data || typeof data !== 'object') return false;
            if (!data.layerData || !data.metadata) return false;
            if (!Array.isArray(data.layerData.paths)) return false;
            
            // パスデータの検証
            return data.layerData.paths.every(path => {
                return path.id && Array.isArray(path.points) &&
                       path.points.every(point => 
                           typeof point.x === 'number' && typeof point.y === 'number');
            });
        },

        // シリアライズ（セーブ・ロード対応）
        serialize: function() {
            return {
                clipboardData: this.clipboardData,
                timestamp: Date.now(),
                version: '2.0' // GPT5案準拠版
            };
        },

        // デシリアライズ（セーブ・ロード対応）
        deserialize: function(data) {
            if (!data || !data.clipboardData) {
                this.clipboardData = null;
                return false;
            }

            if (!this.validateClipboardData(data.clipboardData)) {
                console.warn('ClipboardSystem: Invalid clipboard data format');
                this.clipboardData = null;
                return false;
            }

            this.clipboardData = data.clipboardData;
            console.log('ClipboardSystem: Data deserialized successfully');
            return true;
        },

        // デバッグ用状態表示
        getDebugInfo: function() {
            return {
                hasContent: this.hasContent(),
                clipboardInfo: this.getClipboardInfo(),
                isValid: this.clipboardData ? this.validateClipboardData(this.clipboardData) : false,
                systemReferences: {
                    layerSystem: !!this.layerSystem,
                    cameraSystem: !!this.cameraSystem,
                    drawingEngine: !!this.drawingEngine
                }
            };
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
            console.log('ClipboardSystem: LayerSystem reference updated');
        }
    };

    // グローバル登録
    window.TegakiSystems.Register('ClipboardSystem', ClipboardSystem);

})();