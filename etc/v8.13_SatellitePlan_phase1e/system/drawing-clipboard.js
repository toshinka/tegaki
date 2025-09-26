// ===== system/drawing-clipboard.js - クリップボード管理専用モジュール =====
// コピー・ペースト・切り取り・履歴用の一時格納領域
// PixiJS v8.13 対応

(function() {
    'use strict';

    class DrawingClipboard {
        constructor() {
            this.clipboardData = null;
            this.eventBus = null;
            this.config = null;
            this.layerManager = null;
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
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
                
                // Ctrl+X: カット（将来実装用）
                if (e.ctrlKey && e.code === 'KeyX' && !e.altKey && !e.metaKey) {
                    this.cutActiveLayer();
                    e.preventDefault();
                }
            });
        }

        // === 公開API ===
        copy(selection) {
            if (selection && selection.layerId) {
                this.copyLayerById(selection.layerId);
            } else {
                this.copyActiveLayer();
            }
        }

        cut(selection) {
            if (selection && selection.layerId) {
                this.cutLayerById(selection.layerId);
            } else {
                this.cutActiveLayer();
            }
        }

        paste(targetLayerId, position) {
            if (targetLayerId) {
                this.pasteToLayer(targetLayerId, position);
            } else {
                this.pasteLayer(position);
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
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                return;
            }

            try {
                this._copyLayerNonDestructive(activeLayer);
            } catch (error) {
                console.error('Failed to copy active layer:', error);
            }
        }

        cutActiveLayer() {
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to cut');
                return;
            }

            try {
                // まずコピー
                this._copyLayerNonDestructive(activeLayer);
                
                // 元レイヤーのパスをクリア（カット動作）
                this._clearLayerPaths(activeLayer);
                
                this.eventBus.emit('clipboard:cut', { 
                    layerId: activeLayer.layerData.id,
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.error('Failed to cut active layer:', error);
            }
        }

        pasteLayer(position) {
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                return;
            }

            try {
                this._pasteLayerNonDestructive(position);
            } catch (error) {
                console.error('Failed to paste layer:', error);
            }
        }

        // === ID指定レイヤー操作 ===
        copyLayerById(layerId) {
            if (!this.layerManager) return;

            const layer = this.layerManager.layers.find(l => l.layerData.id === layerId);
            if (!layer) {
                console.warn('Layer not found:', layerId);
                return;
            }

            try {
                this._copyLayerNonDestructive(layer);
            } catch (error) {
                console.error('Failed to copy layer by ID:', error);
            }
        }

        cutLayerById(layerId) {
            if (!this.layerManager) return;

            const layer = this.layerManager.layers.find(l => l.layerData.id === layerId);
            if (!layer) {
                console.warn('Layer not found:', layerId);
                return;
            }

            try {
                this._copyLayerNonDestructive(layer);
                this._clearLayerPaths(layer);
                
                this.eventBus.emit('clipboard:cut', { 
                    layerId: layerId,
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.error('Failed to cut layer by ID:', error);
            }
        }

        pasteToLayer(targetLayerId, position) {
            if (!this.layerManager || !this.clipboardData) return;

            const targetLayer = this.layerManager.layers.find(l => l.layerData.id === targetLayerId);
            if (!targetLayer) {
                console.warn('Target layer not found:', targetLayerId);
                return;
            }

            try {
                this._pastePathsToLayer(targetLayer, position);
            } catch (error) {
                console.error('Failed to paste to specific layer:', error);
            }
        }

        // === 内部実装 ===
        _copyLayerNonDestructive(layer) {
            const layerId = layer.layerData.id;
            const currentTransform = this.layerManager.layerTransforms.get(layerId);
            
            let pathsToStore;
            
            if (this.layerManager._isTransformNonDefault && this.layerManager._isTransformNonDefault(currentTransform)) {
                // 変形中の場合：仮想的に変形適用した座標を生成
                pathsToStore = this._getTransformedPaths(layer, currentTransform);
            } else {
                // 未変形の場合：そのままコピー
                pathsToStore = layer.layerData.paths || [];
            }
            
            // レイヤーデータのディープコピー
            const layerData = layer.layerData;
            
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
                    hasTransforms: this.layerManager._isTransformNonDefault && this.layerManager._isTransformNonDefault(currentTransform)
                },
                timestamp: Date.now()
            };

            this.eventBus.emit('clipboard:copied', { 
                layerId, 
                pathCount: pathsToStore.length,
                hasTransforms: this.clipboardData.metadata.hasTransforms
            });
        }

        // 現在の変形状態を適用した座標を仮想計算
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
                points: (path.points || []).map(point => {
                    try {
                        return matrix.apply(point);
                    } catch (e) {
                        return { x: point.x, y: point.y };
                    }
                }),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        }

        // パスデータの完全ディープコピー
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

        _pasteLayerNonDestructive(position) {
            const clipData = this.clipboardData;
            
            // 非破壊コピーの検証
            if (!clipData.metadata?.isNonDestructive) {
                console.warn('Pasting potentially degraded data');
            }
            
            // 一意なレイヤー名を生成
            const layerName = this._generateUniqueLayerName(clipData.layerData.name);

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
            this._restorePathsToLayer(layer, clipData.layerData.paths, position);

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

            this.eventBus.emit('clipboard:pasted', { 
                newLayerId,
                pathCount: clipData.layerData.paths.length,
                originalId: clipData.metadata.originalId
            });
        }

        _pastePathsToLayer(targetLayer, position) {
            const clipData = this.clipboardData;
            
            // パスデータを対象レイヤーに追加
            clipData.layerData.paths.forEach(pathData => {
                if (pathData.points && pathData.points.length > 0) {
                    const newPath = {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        points: this._adjustPathPosition(pathData.points, position),
                        color: pathData.color,
                        size: pathData.size,
                        opacity: pathData.opacity,
                        isComplete: true,
                        graphics: null
                    };
                    
                    // パスGraphicsを生成
                    this._rebuildPathGraphics(newPath);
                    
                    // レイヤーに追加
                    if (newPath.graphics) {
                        targetLayer.layerData.paths.push(newPath);
                        targetLayer.addChild(newPath.graphics);
                    }
                }
            });
            
            // サムネイル更新
            const layerIndex = this.layerManager.layers.indexOf(targetLayer);
            if (layerIndex >= 0) {
                this.layerManager.requestThumbnailUpdate(layerIndex);
            }
            
            this.eventBus.emit('clipboard:pasted-to-layer', { 
                targetLayerId: targetLayer.layerData.id,
                pathCount: clipData.layerData.paths.length
            });
        }

        _adjustPathPosition(points, position) {
            if (!position || (position.x === 0 && position.y === 0)) {
                return [...points];
            }
            
            return points.map(point => ({
                x: point.x + position.x,
                y: point.y + position.y
            }));
        }

        _restorePathsToLayer(layer, pathsData, position) {
            pathsData.forEach(pathData => {
                if (pathData.points && pathData.points.length > 0) {
                    const newPath = {
                        id: pathData.id,
                        points: this._adjustPathPosition(pathData.points, position),
                        color: pathData.color,
                        size: pathData.size,
                        opacity: pathData.opacity,
                        isComplete: true,
                        graphics: null
                    };
                    
                    // パスGraphicsを生成
                    this._rebuildPathGraphics(newPath);
                    
                    // レイヤーに追加
                    if (newPath.graphics) {
                        layer.layerData.paths.push(newPath);
                        layer.addChild(newPath.graphics);
                    }
                }
            });
        }

        _rebuildPathGraphics(path) {
            try {
                // 新しいGraphics作成
                path.graphics = new PIXI.Graphics();
                
                // パスの点から描画を再構築
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    for (let point of path.points) {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
                            path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                            path.graphics.fill({ 
                                color: path.color || 0x800000, 
                                alpha: path.opacity || 1.0 
                            });
                        }
                    }
                }
                
                return true;
                
            } catch (error) {
                console.error('Error in _rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        }

        _clearLayerPaths(layer) {
            // 既存のパスGraphicsを削除
            layer.layerData.paths.forEach(path => {
                if (path.graphics) {
                    try {
                        layer.removeChild(path.graphics);
                        if (path.graphics.destroy) {
                            path.graphics.destroy();
                        }
                    } catch (error) {
                        console.warn('Failed to destroy path graphics:', error);
                    }
                }
            });
            
            // パスデータをクリア
            layer.layerData.paths = [];
            
            // サムネイル更新
            const layerIndex = this.layerManager.layers.indexOf(layer);
            if (layerIndex >= 0) {
                this.layerManager.requestThumbnailUpdate(layerIndex);
            }
        }

        _generateUniqueLayerName(baseName) {
            if (!this.layerManager) return baseName;
            
            let name = baseName;
            let counter = 1;
            
            while (this.layerManager.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }

        // === ユーティリティメソッド ===
        hasData() {
            return this.clipboardData !== null;
        }

        getDataInfo() {
            if (!this.clipboardData) return null;
            
            return {
                layerName: this.clipboardData.layerData.name,
                pathCount: this.clipboardData.layerData.paths.length,
                hasBackground: !!this.clipboardData.layerData.backgroundData,
                isNonDestructive: this.clipboardData.metadata.isNonDestructive,
                hasTransforms: this.clipboardData.metadata.hasTransforms,
                copiedAt: this.clipboardData.metadata.copiedAt
            };
        }

        // データの検証
        validateClipboardData() {
            if (!this.clipboardData) return { valid: false, errors: ['No clipboard data'] };
            
            const errors = [];
            const data = this.clipboardData;
            
            if (!data.layerData) {
                errors.push('Missing layer data');
            } else {
                if (!data.layerData.name) {
                    errors.push('Missing layer name');
                }
                if (!Array.isArray(data.layerData.paths)) {
                    errors.push('Invalid paths data');
                }
            }
            
            if (!data.metadata) {
                errors.push('Missing metadata');
            }
            
            if (!data.timestamp) {
                errors.push('Missing timestamp');
            }
            
            return {
                valid: errors.length === 0,
                errors: errors,
                pathCount: data.layerData?.paths?.length || 0,
                isNonDestructive: data.metadata?.isNonDestructive || false
            };
        }

        // 統計情報
        getStatistics() {
            const info = this.getDataInfo();
            if (!info) return null;
            
            const validation = this.validateClipboardData();
            
            return {
                ...info,
                validation: validation,
                dataSize: JSON.stringify(this.clipboardData).length,
                ageMs: Date.now() - info.copiedAt
            };
        }

        // デバッグ用：クリップボードデータをコンソール出力
        debugPrint() {
            if (!this.clipboardData) {
                console.log('DrawingClipboard: No data');
                return;
            }
            
            const stats = this.getStatistics();
            console.log('DrawingClipboard Debug Info:', {
                ...stats,
                clipboardData: this.clipboardData
            });
        }

        // 内部参照設定
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

    // グローバル公開
    window.TegakiDrawingClipboard = DrawingClipboard;

})();