// ===== system/drawing-clipboard.js - Phase4改修版: CTRL+V挙動変更 =====
// CHG: CTRL+V挙動を「新規レイヤー作成」→「アクティブレイヤー上書き」に変更

/*
=== Phase4改修完了ヘッダー ===

【改修内容】
✅ pasteToActiveLayer()メソッド追加
✅ CTRL+VキーバインドをpasteToActiveLayer()に変更
✅ 上書き前の履歴保存機能追加
✅ 既存pasteLayer()メソッドは維持（互換性確保）

【変更箇所】
- _setupKeyboardEvents内のCTRL+Vハンドラー変更
- pasteToActiveLayer()メソッド新規追加
- 履歴記録機能追加

=== Phase4改修完了ヘッダー終了 ===
*/

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
            
            console.log('✅ DrawingClipboard initialized (Phase4改修版)');
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('clipboard:copy-request', () => {
                this.copyActiveLayer();
            });
            
            // CHG: Phase4改修 - 新規レイヤーペーストイベント追加
            this.eventBus.on('clipboard:paste-request', () => {
                this.pasteLayer(); // 従来の新規レイヤーペースト
            });
            
            // CHG: Phase4改修 - アクティブレイヤー上書きペーストイベント追加
            this.eventBus.on('clipboard:paste-to-active-request', () => {
                this.pasteToActiveLayer(); // 新機能：アクティブレイヤー上書き
            });
            
            this.eventBus.on('clipboard:get-info-request', () => {
                this.eventBus.emit('clipboard:info-response', {
                    hasData: this.hasClipboardData(),
                    summary: this.getClipboardSummary()
                });
            });
        }

        // CHG: Phase4改修 - CTRL+Vをアクティブレイヤー上書きに変更
        _setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー（変更なし）
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                // CHG: Ctrl+V: アクティブレイヤー上書きペースト（変更）
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteToActiveLayer(); // CHG: 新メソッドを呼び出し
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
                console.log('Non-destructive copy started (Phase4改修版)');
                
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
                        systemVersion: 'v8.13_Phase4改修版'
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

        // CHG: Phase4改修 - 新メソッド：アクティブレイヤーに上書きペースト
        pasteToActiveLayer() {
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

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to paste to');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'No active layer' });
                }
                return;
            }

            try {
                const layerId = activeLayer.layerData.id;
                console.log('🎨 Phase4改修: Pasting to active layer (overwrite mode):', layerId);
                
                // CHG: 履歴保存（破壊的操作のため）
                const previousLayerData = this.createLayerSnapshot(activeLayer);
                this.recordHistory({
                    type: 'paste-replace',
                    layerId: layerId,
                    previousData: previousLayerData,
                    newData: this.clipboardData
                });
                
                // CHG: 既存レイヤー内容を完全消去
                this.clearActiveLayer(activeLayer);
                
                // CHG: クリップボードデータをアクティブレイヤーに適用
                this.applyClipboardToLayer(activeLayer, this.clipboardData);
                
                // UI更新
                const activeIndex = this.layerManager.activeLayerIndex;
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                this.layerManager.requestThumbnailUpdate(activeIndex);

                console.log('✅ Phase4改修: Active layer paste completed (overwrite mode)');
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-to-active-success', {
                        layerId: layerId,
                        pathCount: this.clipboardData.layerData.paths.length,
                        mode: 'overwrite'
                    });
                    
                    // レイヤー内容変更通知
                    this.eventBus.emit('layer:content-changed', { layerId: layerId });
                }
                
            } catch (error) {
                console.error('Failed to paste to active layer:', error);
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: error.message });
                }
            }
        }

        // CHG: Phase4改修 - レイヤースナップショット作成（履歴用）
        createLayerSnapshot(layer) {
            const layerData = layer.layerData;
            const layerId = layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            return {
                id: layerId,
                name: layerData.name,
                visible: layerData.visible,
                opacity: layerData.opacity,
                isBackground: layerData.isBackground || false,
                paths: this.deepCopyPaths(layerData.paths || []),
                transform: transform ? {...transform} : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                backgroundData: layerData.isBackground ? {
                    isBackground: true,
                    color: this.config.background.color
                } : null,
                timestamp: Date.now()
            };
        }

        // CHG: Phase4改修 - アクティブレイヤー内容消去
        clearActiveLayer(layer) {
            const layerData = layer.layerData;
            
            // 既存のパスGraphicsを破棄
            (layerData.paths || []).forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });
            
            // 背景Graphics破棄（背景レイヤーの場合）
            if (layerData.backgroundGraphics && layerData.backgroundGraphics.destroy) {
                layerData.backgroundGraphics.destroy();
                layerData.backgroundGraphics = null;
            }
            
            // レイヤーの子要素をすべて削除
            layer.removeChildren();
            
            // パス配列をクリア
            layerData.paths = [];
            
            // 変形をリセット
            const layerId = layerData.id;
            this.layerManager.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
            
            console.log('🧹 Active layer cleared:', layerId);
        }

        // CHG: Phase4改修 - クリップボードデータをレイヤーに適用
        applyClipboardToLayer(layer, clipboardData) {
            const layerData = layer.layerData;
            const clipData = clipboardData.layerData;
            
            // レイヤープロパティ適用（名前以外）
            layerData.visible = clipData.visible;
            layerData.opacity = clipData.opacity;
            layer.visible = clipData.visible;
            layer.alpha = clipData.opacity;
            
            // 背景データ復元
            if (clipData.backgroundData) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(clipData.backgroundData.color);
                layer.addChild(bg);
                layerData.backgroundGraphics = bg;
                layerData.isBackground = true;
            }
            
            // パスデータ復元
            let restoredCount = 0;
            clipData.paths.forEach((pathData, pathIndex) => {
                try {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id + '_pasted_' + Date.now(),
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null
                        };
                        
                        // パスGraphicsを生成
                        const rebuildSuccess = this.layerManager.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                            restoredCount++;
                        } else {
                            console.warn(`Failed to rebuild graphics for path ${pathIndex}`);
                        }
                    }
                } catch (pathError) {
                    console.error(`Error applying path ${pathIndex}:`, pathError);
                }
            });
            
            console.log(`Applied clipboard data: ${restoredCount}/${clipData.paths.length} paths restored`);
        }

        // CHG: Phase4改修 - 履歴記録
        recordHistory(historyEntry) {
            if (window.History && window.History.push) {
                const command = {
                    undo: () => {
                        this.restoreLayerFromSnapshot(historyEntry.layerId, historyEntry.previousData);
                    },
                    redo: () => {
                        this.restoreLayerFromClipboard(historyEntry.layerId, historyEntry.newData);
                    },
                    meta: {
                        type: historyEntry.type,
                        layerId: historyEntry.layerId,
                        timestamp: Date.now()
                    }
                };
                
                window.History.push(command);
                console.log('📝 History recorded:', historyEntry.type);
            } else {
                console.warn('History system not available');
            }
        }

        // CHG: Phase4改修 - スナップショットからレイヤー復元（Undo用）
        restoreLayerFromSnapshot(layerId, snapshotData) {
            const layer = this.layerManager.layers.find(l => l.layerData.id === layerId);
            if (!layer) {
                console.warn('Cannot restore - layer not found:', layerId);
                return;
            }
            
            // レイヤーをクリア
            this.clearActiveLayer(layer);
            
            // スナップショットデータを適用
            this.applySnapshotToLayer(layer, snapshotData);
            
            // UI更新
            const layerIndex = this.layerManager.layers.indexOf(layer);
            this.layerManager.updateLayerPanelUI();
            this.layerManager.requestThumbnailUpdate(layerIndex);
            
            console.log('🔄 Layer restored from snapshot:', layerId);
        }

        // CHG: Phase4改修 - クリップボードからレイヤー復元（Redo用）
        restoreLayerFromClipboard(layerId, clipboardData) {
            const layer = this.layerManager.layers.find(l => l.layerData.id === layerId);
            if (!layer) {
                console.warn('Cannot restore - layer not found:', layerId);
                return;
            }
            
            // レイヤーをクリア
            this.clearActiveLayer(layer);
            
            // クリップボードデータを適用
            this.applyClipboardToLayer(layer, clipboardData);
            
            // UI更新
            const layerIndex = this.layerManager.layers.indexOf(layer);
            this.layerManager.updateLayerPanelUI();
            this.layerManager.requestThumbnailUpdate(layerIndex);
            
            console.log('🔄 Layer restored from clipboard:', layerId);
        }

        // CHG: Phase4改修 - スナップショットデータをレイヤーに適用
        applySnapshotToLayer(layer, snapshotData) {
            const layerData = layer.layerData;
            
            // レイヤープロパティ復元
            layerData.visible = snapshotData.visible;
            layerData.opacity = snapshotData.opacity;
            layerData.isBackground = snapshotData.isBackground;
            layer.visible = snapshotData.visible;
            layer.alpha = snapshotData.opacity;
            
            // 変形復元
            this.layerManager.layerTransforms.set(layerData.id, {...snapshotData.transform});
            
            // 背景データ復元
            if (snapshotData.backgroundData) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(snapshotData.backgroundData.color);
                layer.addChild(bg);
                layerData.backgroundGraphics = bg;
                layerData.isBackground = true;
            }
            
            // パスデータ復元
            snapshotData.paths.forEach((pathData, pathIndex) => {
                try {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: pathData.isComplete,
                            graphics: null
                        };
                        
                        const rebuildSuccess = this.layerManager.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                        }
                    }
                } catch (pathError) {
                    console.error(`Error restoring path ${pathIndex}:`, pathError);
                }
            });
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

        // 従来の新規レイヤーペースト（互換性維持）
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
                    console.log('Pasting non-destructive data (Phase4改修版):', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, this.layerManager);

                // 新規レイヤーを作成
                const { layer, index } = this.layerManager.createLayer(layerName, false);

                // クリップボードデータを新規レイヤーに適用
                this.applyClipboardToLayer(layer, clipData);

                // 新しいレイヤーをアクティブに設定
                this.layerManager.setActiveLayer(index);
                
                // UI更新
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                
                // サムネイル更新
                this.layerManager.requestThumbnailUpdate(index);

                console.log(`Non-destructive paste completed (new layer): ${clipData.layerData.paths.length} paths restored`);
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-success', {
                        layerName: layerName,
                        pathCount: clipData.layerData.paths.length,
                        mode: 'new-layer'
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
        
        // CHG: Phase4改修 - 公開API追加
        get() {
            return this.clipboardData;
        }
        
        // CHG: Phase4改修 - デバッグ情報
        getDebugInfo() {
            return {
                hasClipboardData: this.hasClipboardData(),
                summary: this.getClipboardSummary(),
                eventBusAvailable: !!this.eventBus,
                layerManagerAvailable: !!this.layerManager,
                phase: 'Phase4-CTRL+V-Behavior-Changed',
                newFeatures: {
                    pasteToActiveLayer: 'available',
                    historyRecording: window.History ? 'available' : 'not-available',
                    overwriteMode: 'implemented'
                }
            };
        }
    }

    // グローバル公開
    window.TegakiDrawingClipboard = DrawingClipboard;
    
    // CHG: Phase4改修 - グローバル参照追加（LayerSystemから呼び出し用）
    window.DrawingClipboard = {
        get: () => window.drawingClipboard?.get() || null,
        pasteToActiveLayer: () => window.drawingClipboard?.pasteToActiveLayer() || false,
        pasteAsNewLayer: () => window.drawingClipboard?.pasteLayer() || false
    };

    console.log('✅ drawing-clipboard.js Phase4改修版 loaded successfully');
    console.log('   - ✅ CTRL+V behavior changed to overwrite active layer');
    console.log('   - ✅ pasteToActiveLayer() method added');
    console.log('   - ✅ History recording for destructive operations');
    console.log('   - ✅ Backward compatibility maintained (pasteLayer)');
    console.log('   - 🔧 New global API: DrawingClipboard.pasteToActiveLayer()');

})();