// ===== system/drawing-clipboard.js - クリップボード管理専用モジュール =====
// コピー・ペースト・切り取り・履歴用の一時格納領域
// PixiJS v8.13 対応

(function() {
    'use strict';

    class DrawingClipboard {
        constructor() {
            this.eventBus = null;
            this.config = null;
            
            // クリップボードデータ
            this.clipboardData = null;
            
            // 内部参照
            this.layerSystem = null;
        }

        init(eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            this._setupKeyboardEvents();
            
            // EventBus監視
            this.eventBus.on('ui:copy', (selection) => this.copy(selection));
            this.eventBus.on('ui:cut', (selection) => this.cut(selection));
            this.eventBus.on('ui:paste', ({ targetLayerId, position }) => this.paste(targetLayerId, position));
            this.eventBus.on('ui:clear-clipboard', () => this.clear());
            
            console.log('✅ DrawingClipboard initialized');
        }

        _setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                // Ctrl+X: 切り取り
                if (e.ctrlKey && e.code === 'KeyX' && !e.altKey && !e.metaKey) {
                    this.cutActiveLayer();
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }

        // === 公開API ===
        copy(selection) {
            // 汎用コピー処理
            if (selection) {
                this._copySelection(selection);
            } else {
                this.copyActiveLayer();
            }
        }

        cut(selection) {
            // 汎用切り取り処理
            if (selection) {
                this._cutSelection(selection);
            } else {
                this.cutActiveLayer();
            }
        }

        paste(targetLayerId, position) {
            // 汎用ペースト処理
            if (targetLayerId) {
                this._pasteToSpecificLayer(targetLayerId, position);
            } else {
                this.pasteLayer();
            }
        }

        clear() {
            this.clipboardData = null;
            this.eventBus.emit('clipboard:cleared');
        }

        get() {
            return this.clipboardData;
        }

        // === アクティブレイヤー操作 ===
        copyActiveLayer() {
            if (!this.layerSystem) {
                console.warn('LayerSystem not available');
                return;
            }

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                return;
            }

            try {
                // 現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerSystem.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (this.layerSystem.isTransformNonDefault(currentTransform)) {
                    // 変形中の場合：仮想的に変形適用した座標を生成
                    pathsToStore = this._getTransformedPaths(activeLayer, currentTransform);
                } else {
                    // 未変形の場合：そのままコピー
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                // レイヤーデータのディープコピー
                const layerData = activeLayer.layerData;
                
                // 背景データのコピー
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
                        paths: this._deepCopyPaths(pathsToStore),
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
                        source: 'layer-copy'
                    },
                    timestamp: Date.now()
                };

                this.eventBus.emit('clipboard:copied', {
                    type: 'layer',
                    pathCount: pathsToStore.length,
                    hasTransforms: this.layerSystem.isTransformNonDefault(currentTransform)
                });
                
            } catch (error) {
                console.error('Failed to copy layer:', error);
            }
        }

        cutActiveLayer() {
            if (!this.layerSystem) {
                console.warn('LayerSystem not available');
                return;
            }

            // まずコピーを実行
            this.copyActiveLayer();
            
            // クリップボードにデータがある場合のみ削除
            if (this.clipboardData) {
                const activeLayerIndex = this.layerSystem.activeLayerIndex;
                this.layerSystem.deleteLayer(activeLayerIndex);
                
                this.eventBus.emit('clipboard:cut', {
                    type: 'layer',
                    deletedLayerIndex: activeLayerIndex
                });
            }
        }

        pasteLayer() {
            if (!this.layerSystem) {
                console.warn('LayerSystem not available');
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                // 一意なレイヤー名を生成
                const layerName = this._generateUniqueLayerName(clipData.layerData.name);

                // 新規レイヤーを作成
                const { layer, index } = this.layerSystem.createLayer(layerName, false);

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
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null
                        };
                        
                        // パスGraphicsを生成
                        this.layerSystem.rebuildPathGraphics(newPath);
                        
                        // レイヤーに追加
                        layer.layerData.paths.push(newPath);
                        layer.addChild(newPath.graphics);
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

                this.eventBus.emit('clipboard:pasted', {
                    type: 'layer',
                    newLayerIndex: index,
                    pathCount: clipData.layerData.paths.length
                });
                
            } catch (error) {
                console.error('Failed to paste layer:', error);
            }
        }

        // === 内部ヘルパーメソッド ===
        _copySelection(selection) {
            // 選択範囲のコピー（将来の機能拡張用）
            this.clipboardData = {
                selectionData: this._deepCopySelection(selection),
                metadata: {
                    copiedAt: Date.now(),
                    source: 'selection-copy',
                    selectionType: selection.type || 'unknown'
                },
                timestamp: Date.now()
            };
            
            this.eventBus.emit('clipboard:copied', {
                type: 'selection',
                selectionType: selection.type || 'unknown'
            });
        }

        _cutSelection(selection) {
            // 選択範囲の切り取り（将来の機能拡張用）
            this._copySelection(selection);
            
            // 選択範囲を削除する処理
            if (this.clipboardData && selection.delete) {
                selection.delete();
                
                this.eventBus.emit('clipboard:cut', {
                    type: 'selection',
                    selectionType: selection.type || 'unknown'
                });
            }
        }

        _pasteToSpecificLayer(targetLayerId, position) {
            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                return;
            }

            // 特定レイヤーへのペースト処理
            const targetLayer = this._findLayerById(targetLayerId);
            if (!targetLayer) {
                console.warn(`Target layer not found: ${targetLayerId}`);
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                if (clipData.layerData) {
                    // レイヤーデータを特定レイヤーに追加
                    this._pastePaths(targetLayer, clipData.layerData.paths, position);
                } else if (clipData.selectionData) {
                    // 選択データを特定レイヤーに追加
                    this._pasteSelection(targetLayer, clipData.selectionData, position);
                }
                
                this.eventBus.emit('clipboard:pasted', {
                    type: 'to-specific-layer',
                    targetLayerId: targetLayerId,
                    position: position
                });
                
            } catch (error) {
                console.error('Failed to paste to specific layer:', error);
            }
        }

        _getTransformedPaths(layer, transform) {
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
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
        }

        _deepCopyPaths(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: (path.points || []).map(point => ({ x: point.x, y: point.y })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        }

        _deepCopySelection(selection) {
            // 選択範囲のディープコピー（将来の機能拡張用）
            return {
                type: selection.type,
                bounds: selection.bounds ? { ...selection.bounds } : null,
                paths: selection.paths ? this._deepCopyPaths(selection.paths) : [],
                metadata: selection.metadata ? { ...selection.metadata } : {}
            };
        }

        _generateUniqueLayerName(baseName) {
            if (!this.layerSystem) return baseName;
            
            let name = baseName;
            let counter = 1;
            
            while (this.layerSystem.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }

        _findLayerById(layerId) {
            if (!this.layerSystem) return null;
            
            return this.layerSystem.layers.find(layer => layer.layerData.id === layerId);
        }

        _pastePaths(targetLayer, paths, position) {
            const offsetX = position ? position.x : 0;
            const offsetY = position ? position.y : 0;
            
            paths.forEach(pathData => {
                if (pathData.points && pathData.points.length > 0) {
                    const newPath = {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        points: pathData.points.map(point => ({
                            x: point.x + offsetX,
                            y: point.y + offsetY
                        })),
                        color: pathData.color,
                        size: pathData.size,
                        opacity: pathData.opacity,
                        isComplete: true,
                        graphics: null
                    };
                    
                    // パスGraphicsを生成
                    this.layerSystem.rebuildPathGraphics(newPath);
                    
                    // レイヤーに追加
                    targetLayer.layerData.paths.push(newPath);
                    targetLayer.addChild(newPath.graphics);
                }
            });
            
            // レイヤーのサムネイル更新
            const layerIndex = this.layerSystem.layers.indexOf(targetLayer);
            if (layerIndex >= 0) {
                this.layerSystem.requestThumbnailUpdate(layerIndex);
            }
        }

        _pasteSelection(targetLayer, selectionData, position) {
            // 選択データのペースト（将来の機能拡張用）
            if (selectionData.paths && selectionData.paths.length > 0) {
                this._pastePaths(targetLayer, selectionData.paths, position);
            }
        }

        // === 状態確認API ===
        hasClipboardData() {
            return this.clipboardData !== null;
        }

        getClipboardInfo() {
            if (!this.clipboardData) {
                return null;
            }
            
            return {
                hasData: true,
                timestamp: this.clipboardData.timestamp,
                metadata: this.clipboardData.metadata,
                type: this.clipboardData.layerData ? 'layer' : 
                      this.clipboardData.selectionData ? 'selection' : 'unknown'
            };
        }

        getClipboardSummary() {
            const info = this.getClipboardInfo();
            if (!info) {
                return 'クリップボードは空です';
            }
            
            const elapsed = Date.now() - info.timestamp;
            const timeStr = elapsed < 1000 ? '今' : `${Math.floor(elapsed / 1000)}秒前`;
            
            if (info.type === 'layer') {
                const pathCount = this.clipboardData.metadata.pathCount || 0;
                return `レイヤー (${pathCount}パス) - ${timeStr}`;
            } else if (info.type === 'selection') {
                return `選択範囲 - ${timeStr}`;
            }
            
            return `不明なデータ - ${timeStr}`;
        }

        // === Undo/Redo拡張用の基盤API ===
        createHistoryEntry(operation, data) {
            // 将来のUndo/Redo機能拡張用
            return {
                operation: operation,
                data: this._deepCopyData(data),
                timestamp: Date.now(),
                id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
        }

        _deepCopyData(data) {
            // データの種類に応じたディープコピー
            if (Array.isArray(data)) {
                return data.map(item => this._deepCopyData(item));
            } else if (data && typeof data === 'object') {
                if (data.points) {
                    // パスデータの場合
                    return {
                        ...data,
                        points: data.points.map(point => ({ x: point.x, y: point.y }))
                    };
                } else {
                    // 一般的なオブジェクトの場合
                    const copy = {};
                    for (const key in data) {
                        if (data.hasOwnProperty(key)) {
                            copy[key] = this._deepCopyData(data[key]);
                        }
                    }
                    return copy;
                }
            } else {
                // プリミティブ値の場合
                return data;
            }
        }

        // === デバッグ用API ===
        debugGetClipboardData() {
            if (this.config.debug) {
                console.log('Current clipboard data:', this.clipboardData);
            }
            return this.clipboardData;
        }

        debugClearClipboard() {
            if (this.config.debug) {
                console.log('Debug: Clearing clipboard');
                this.clear();
            }
        }

        // === 内部参照設定 ===
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
    }

    // グローバル公開
    window.TegakiDrawingClipboard = DrawingClipboard;

})();