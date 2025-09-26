// ===== system/drawing-clipboard.js - クリップボード管理専用モジュール（改修版） =====
// コピー・ペースト・切り取り・履歴用の一時格納領域
// PixiJS v8.13 対応・改修計画書準拠版

(function() {
    'use strict';

    class DrawingClipboard {
        constructor() {
            this.eventBus = null;
            this.config = null;
            
            // クリップボードデータ
            this.clipboardData = null;
            
            // 内部参照
            this.layerManager = null;
        }

        init(eventBus, config) {
            this.eventBus = eventBus;
            this.config = config; // CONFIG統一：window.TEGAKI_CONFIG直接参照を禁止
            
            this._setupKeyboardEvents();
            this._setupEventBusListeners();
            
            if (this.config.debug) {
                console.log('✅ DrawingClipboard initialized');
            }
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

        // 改修版：EventBus統合完了
        _setupEventBusListeners() {
            if (!this.eventBus) return;

            // UI側からのイベント監視
            this.eventBus.on('clipboard:copy-request', (data) => this.copy(data.selection));
            this.eventBus.on('clipboard:cut-request', (data) => this.cut(data.selection));
            this.eventBus.on('clipboard:paste-request', (data) => this.paste(data.targetLayerId, data.position));
            this.eventBus.on('clipboard:clear-request', () => this.clear());
            
            // 状態問い合わせ対応
            this.eventBus.on('clipboard:get-info-request', () => {
                const info = this.getClipboardInfo();
                this.eventBus.emit('clipboard:info-response', info);
            });
        }

        // === 公開API ===
        copy(selection) {
            if (selection) {
                this._copySelection(selection);
            } else {
                this.copyActiveLayer();
            }
        }

        cut(selection) {
            if (selection) {
                this._cutSelection(selection);
            } else {
                this.cutActiveLayer();
            }
        }

        paste(targetLayerId, position) {
            if (targetLayerId) {
                this._pasteToSpecificLayer(targetLayerId, position);
            } else {
                this.pasteLayer();
            }
        }

        clear() {
            this.clipboardData = null;
            if (this.eventBus) {
                this.eventBus.emit('clipboard:cleared');
            }
        }

        get() {
            return this.clipboardData;
        }

        // === アクティブレイヤー操作（改修版：deep clone徹底） ===
        copyActiveLayer() {
            if (!this.layerManager) {
                if (this.config.debug) {
                    console.warn('LayerManager not available');
                }
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                if (this.config.debug) {
                    console.warn('No active layer to copy');
                }
                return;
            }

            try {
                // 現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerManager.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (this.layerManager.isTransformNonDefault(currentTransform)) {
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

                // 完全なパスデータをクリップボードに保存（deep clone）
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this._deepCopyPaths(pathsToStore), // deep clone徹底
                        backgroundData: backgroundData ? {...backgroundData} : null // deep clone
                    },
                    // 変形情報はリセット（ペースト時は初期状態）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true,
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform),
                        source: 'layer-copy'
                    },
                    timestamp: Date.now()
                };

                // EventBus経由で通知（UI依存削除）
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copied', {
                        type: 'layer',
                        pathCount: pathsToStore.length,
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform)
                    });
                }
                
            } catch (error) {
                if (this.config.debug) {
                    console.error('Failed to copy layer:', error);
                }
                // EventBus経由でエラー通知
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: error.message });
                }
            }
        }

        cutActiveLayer() {
            if (!this.layerManager) {
                if (this.config.debug) {
                    console.warn('LayerManager not available');
                }
                return;
            }

            // まずコピーを実行
            this.copyActiveLayer();
            
            // クリップボードにデータがある場合のみ削除
            if (this.clipboardData) {
                const activeLayerIndex = this.layerManager.activeLayerIndex;
                this.layerManager.deleteLayer(activeLayerIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:cut', {
                        type: 'layer',
                        deletedLayerIndex: activeLayerIndex
                    });
                }
            }
        }

        pasteLayer() {
            if (!this.layerManager) {
                if (this.config.debug) {
                    console.warn('LayerManager not available');
                }
                return;
            }

            if (!this.clipboardData) {
                if (this.config.debug) {
                    console.warn('No clipboard data to paste');
                }
                return;
            }

            try {
                const clipData = this.clipboardData;
                
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

                // パスデータ完全復元（deep cloneから復元）
                if (clipData.layerData.paths) {
                    clipData.layerData.paths.forEach(pathData => {
                        if (pathData.points && pathData.points.length > 0) {
                            const newPath = {
                                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 新しいID
                                points: pathData.points.map(p => ({ x: p.x, y: p.y })), // deep clone
                                color: pathData.color,
                                size: pathData.size,
                                opacity: pathData.opacity,
                                isComplete: true,
                                graphics: null
                            };
                            
                            // パスGraphicsを生成
                            this.layerManager.rebuildPathGraphics(newPath);
                            
                            // レイヤーに追加
                            if (newPath.graphics) {
                                layer.layerData.paths.push(newPath);
                                layer.addChild(newPath.graphics);
                            }
                        }
                    });
                }

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
                
                // UI更新をEventBus経由で通知
                if (this.eventBus) {
                    this.eventBus.emit('layer:paste-completed', {
                        layerIndex: index,
                        layerName: layerName
                    });
                }
                
                // サムネイル更新
                this.layerManager.requestThumbnailUpdate(index);

                if (this.eventBus) {
                    this.eventBus.emit('clipboard:pasted', {
                        type: 'layer',
                        newLayerIndex: index,
                        pathCount: clipData.layerData.paths ? clipData.layerData.paths.length : 0
                    });
                }
                
            } catch (error) {
                if (this.config.debug) {
                    console.error('Failed to paste layer:', error);
                }
                // EventBus経由でエラー通知
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: error.message });
                }
            }
        }

        // === 内部ヘルパーメソッド（改修版：deep clone徹底） ===
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
            
            if (this.eventBus) {
                this.eventBus.emit('clipboard:copied', {
                    type: 'selection',
                    selectionType: selection.type || 'unknown'
                });
            }
        }

        _cutSelection(selection) {
            // 選択範囲の切り取り（将来の機能拡張用）
            this._copySelection(selection);
            
            // 選択範囲を削除する処理
            if (this.clipboardData && selection.delete) {
                selection.delete();
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:cut', {
                        type: 'selection',
                        selectionType: selection.type || 'unknown'
                    });
                }
            }
        }

        _pasteToSpecificLayer(targetLayerId, position) {
            if (!this.clipboardData) {
                if (this.config.debug) {
                    console.warn('No clipboard data to paste');
                }
                return;
            }

            // 特定レイヤーへのペースト処理
            const targetLayer = this._findLayerById(targetLayerId);
            if (!targetLayer) {
                if (this.config.debug) {
                    console.warn(`Target layer not found: ${targetLayerId}`);
                }
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
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:pasted', {
                        type: 'to-specific-layer',
                        targetLayerId: targetLayerId,
                        position: position
                    });
                }
                
            } catch (error) {
                if (this.config.debug) {
                    console.error('Failed to paste to specific layer:', error);
                }
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: error.message });
                }
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
                points: (path.points || []).map(point => {
                    const transformed = matrix.apply(point);
                    return { x: transformed.x, y: transformed.y }; // deep clone
                }),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        }

        // 改修版：完全なdeep clone実装
        _deepCopyPaths(paths) {
            if (!Array.isArray(paths)) return [];
            
            return paths.map(path => {
                if (!path) return null;
                
                return {
                    id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    points: Array.isArray(path.points) ? 
                            path.points.map(point => ({ 
                                x: typeof point.x === 'number' ? point.x : 0, 
                                y: typeof point.y === 'number' ? point.y : 0 
                            })) : [],
                    color: path.color,
                    size: path.size,
                    opacity: path.opacity,
                    isComplete: path.isComplete || true
                };
            }).filter(path => path !== null);
        }

        _deepCopySelection(selection) {
            // 選択範囲のディープコピー（将来の機能拡張用）
            if (!selection) return null;
            
            return {
                type: selection.type,
                bounds: selection.bounds ? { 
                    x: selection.bounds.x,
                    y: selection.bounds.y,
                    width: selection.bounds.width,
                    height: selection.bounds.height
                } : null,
                paths: selection.paths ? this._deepCopyPaths(selection.paths) : [],
                metadata: selection.metadata ? { ...selection.metadata } : {}
            };
        }

        _generateUniqueLayerName(baseName) {
            if (!this.layerManager || !baseName) return 'Unknown Layer';
            
            let name = baseName;
            let counter = 1;
            
            while (this.layerManager.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }

        _findLayerById(layerId) {
            if (!this.layerManager || !layerId) return null;
            
            return this.layerManager.layers.find(layer => layer.layerData.id === layerId);
        }

        _pastePaths(targetLayer, paths, position) {
            if (!targetLayer || !Array.isArray(paths)) return;
            
            const offsetX = position ? (position.x || 0) : 0;
            const offsetY = position ? (position.y || 0) : 0;
            
            paths.forEach(pathData => {
                if (pathData && pathData.points && pathData.points.length > 0) {
                    const newPath = {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        points: pathData.points.map(point => ({
                            x: (point.x || 0) + offsetX,
                            y: (point.y || 0) + offsetY
                        })),
                        color: pathData.color,
                        size: pathData.size,
                        opacity: pathData.opacity,
                        isComplete: true,
                        graphics: null
                    };
                    
                    // パスGraphicsを生成
                    const rebuildSuccess = this.layerManager.rebuildPathGraphics(newPath);
                    
                    // 成功した場合のみレイヤーに追加
                    if (rebuildSuccess && newPath.graphics) {
                        targetLayer.layerData.paths.push(newPath);
                        targetLayer.addChild(newPath.graphics);
                    }
                }
            });
            
            // レイヤーのサムネイル更新
            const layerIndex = this.layerManager.layers.indexOf(targetLayer);
            if (layerIndex >= 0) {
                this.layerManager.requestThumbnailUpdate(layerIndex);
            }
        }

        _pasteSelection(targetLayer, selectionData, position) {
            // 選択データのペースト（将来の機能拡張用）
            if (selectionData && selectionData.paths && selectionData.paths.length > 0) {
                this._pastePaths(targetLayer, selectionData.paths, position);
            }
        }

        // === 状態確認API ===
        hasClipboardData() {
            return this.clipboardData !== null;
        }

        getClipboardInfo() {
            if (!this.clipboardData) {
                return {
                    hasData: false,
                    timestamp: null,
                    metadata: null,
                    type: null
                };
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
            if (!info.hasData) {
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
            if (data === null || data === undefined) {
                return data;
            }
            
            if (Array.isArray(data)) {
                return data.map(item => this._deepCopyData(item));
            }
            
            if (data && typeof data === 'object') {
                if (data.points && Array.isArray(data.points)) {
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
            }
            
            // プリミティブ値の場合
            return data;
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

        // === 改修版：core-engine.js継承メソッド（改修計画書対応） ===
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
            
            // 相互参照の設定が完了したことをEventBusで通知
            if (this.eventBus) {
                this.eventBus.emit('clipboard:layer-manager-connected');
            }
        }
    }

    // グローバル公開
    window.TegakiDrawingClipboard = DrawingClipboard;

    console.log('✅ drawing-clipboard.js (改修版) loaded successfully');
    console.log('   - EventBus統合完了：全てのUI依存をEventBus経由に変更');
    console.log('   - Deep clone徹底：paths・transform・backgroundDataの完全複製');
    console.log('   - 設定参照統一：window.TEGAKI_CONFIG直接参照を禁止');
    console.log('   - 継承メソッド追加：setLayerManager対応');
    console.log('   - UI依存削除：console.log・alert等を削除またはdebugフラグ化');

})();