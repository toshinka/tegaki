// ===== systems/drawing-clipboard.js - 完全版：非破壊コピペ =====
// GPT5案.txt準拠：ClipboardSystem.copyLayerCanonical()とpasteAsNewLayer()実装
// canonical座標でコピー・ペースト、変形状態は初期化
// CONFIG定義整合性チェック済み

(function() {
    'use strict';

    const ClipboardSystem = {
        name: 'ClipboardSystem',
        
        init: function(opts) {
            console.log('ClipboardSystem: Initializing with canonical coordinates...');
            
            this.app = opts.app;
            this.layerSystem = opts.layerSystem;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // 定義チェック：CONFIG必須項目の検証
            if (!this.CONFIG || !this.CONFIG.canvas || !this.CONFIG.background) {
                console.error('ClipboardSystem: Missing required CONFIG definitions');
                return;
            }
            
            this.clipboardData = null;
            
            // システム参照
            this.cameraSystem = null;
            this.drawingEngine = null;
            
            this.setupKeyboardEvents();
            
            console.log('ClipboardSystem: Initialized with non-destructive copy/paste');
        },

        setupKeyboardEvents: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyLayerCanonical(this.layerSystem.activeLayerIndex);
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteAsNewLayer();
                    e.preventDefault();
                }
            });
        },

        // === GPT5案準拠：ClipboardSystem.copyLayerCanonical() ===
        copyLayerCanonical: function(layerIndex) {
            /* 
            GPT5案：必ずLayerSystem.getLayerCanonicalPaths(layerId)を呼んで
            canonicalパスを保存する
            */
            if (!this.layerSystem) {
                console.warn('ClipboardSystem: LayerSystem not available');
                return;
            }

            if (layerIndex < 0 || layerIndex >= this.layerSystem.layers.length) {
                console.warn('ClipboardSystem: Invalid layer index for copy');
                return;
            }

            const layer = this.layerSystem.layers[layerIndex];
            if (!layer) {
                console.warn('ClipboardSystem: No layer to copy');
                return;
            }

            try {
                console.log('ClipboardSystem: Non-destructive copy started');
                
                const layerId = layer.layerData.id;
                
                // GPT5案準拠：canonical座標パスを取得
                const canonicalPaths = this.layerSystem.getLayerCanonicalPaths(layerId);
                
                console.log(`ClipboardSystem: Retrieved ${canonicalPaths.length} canonical paths`);
                
                // レイヤーデータのディープコピー
                const layerData = layer.layerData;
                
                // 背景データのコピー（背景レイヤーの場合）
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: this.CONFIG.background.color
                    };
                }

                // GPT5案準拠：canonical座標をクリップボードに保存
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyCanonicalPaths(canonicalPaths),
                        backgroundData: backgroundData
                    },
                    // GPT5案：変形情報はリセット（ペースト時は初期状態）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: canonicalPaths.length,
                        isCanonical: true, // canonical座標フラグ
                        source: 'LayerSystem.getLayerCanonicalPaths'
                    },
                    timestamp: Date.now()
                };

                console.log(`ClipboardSystem: Canonical copy completed: ${canonicalPaths.length} paths preserved`);
                console.log('ClipboardSystem: Copy metadata:', this.clipboardData.metadata);
                
                // EventBus通知
                if (window.Tegaki && window.Tegaki.EventBus) {
                    window.Tegaki.EventBus.emit('clipboard:copied', {
                        layerId: layerId,
                        pathCount: canonicalPaths.length,
                        isCanonical: true
                    });
                }
                
            } catch (error) {
                console.error('ClipboardSystem: Failed to copy layer canonically:', error);
            }
        },

        // === GPT5案準拠：ClipboardSystem.pasteAsNewLayer() ===
        pasteAsNewLayer: function(atPosition, name) {
            /* 
            GPT5案：復元後にレイヤーtransformを(0,0,1,1,0)にしておく。
            rebuildPathGraphics()はcanonical点列を前提にGraphicsを作る。
            */
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
                
                // canonical座標の検証
                if (!clipData.metadata?.isCanonical) {
                    console.warn('ClipboardSystem: Pasting potentially non-canonical data');
                } else {
                    console.log('ClipboardSystem: Pasting canonical data:', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = name || this.generateUniqueLayerName(
                    clipData.layerData.name, 
                    this.layerSystem
                );

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

                // GPT5案準拠：canonical座標パスデータ完全復元
                let restoredPathCount = 0;
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            points: [...pathData.points], // canonical座標完全コピー
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null // 後で生成
                        };
                        
                        // GPT5案準拠：rebuildPathGraphicsはcanonical点列前提
                        const rebuildSuccess = this.layerSystem.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            // レイヤーに追加
                            layer.layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                            restoredPathCount++;
                        } else {
                            console.warn(`ClipboardSystem: Failed to rebuild graphics for path ${newPath.id}`);
                        }
                    }
                });

                // GPT5案準拠：レイヤー変形データを初期化
                const newLayerId = layer.layerData.id;
                this.layerSystem.layerTransforms.set(newLayerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });

                // レイヤーの可視性と不透明度を復元
                layer.layerData.visible = clipData.layerData.visible;
                layer.layerData.opacity = clipData.layerData.opacity;
                layer.visible = clipData.layerData.visible;
                layer.alpha = clipData.layerData.opacity;

                // 位置調整（指定された場合）
                if (atPosition) {
                    const transform = this.layerSystem.layerTransforms.get(newLayerId);
                    transform.x = atPosition.x || 0;
                    transform.y = atPosition.y || 0;
                    
                    const centerX = this.CONFIG.canvas.width / 2;
                    const centerY = this.CONFIG.canvas.height / 2;
                    layer.position.set(centerX + transform.x, centerY + transform.y);
                }

                // 新しいレイヤーをアクティブに設定
                this.layerSystem.setActiveLayer(index);
                
                // UI更新
                this.layerSystem.updateLayerPanelUI();
                this.layerSystem.updateStatusDisplay();
                
                // サムネイル更新
                this.layerSystem.requestThumbnailUpdate(index);

                // EventBus通知
                if (window.Tegaki && window.Tegaki.EventBus) {
                    window.Tegaki.EventBus.emit('clipboard:pasted', {
                        layerId: newLayerId,
                        layerIndex: index,
                        pathCount: restoredPathCount,
                        originalPathCount: clipData.layerData.paths.length
                    });
                }

                console.log(`ClipboardSystem: Canonical paste completed: ${restoredPathCount}/${clipData.layerData.paths.length} paths restored`);
                
                return { layer, index };
                
            } catch (error) {
                console.error('ClipboardSystem: Failed to paste layer canonically:', error);
                return null;
            }
        },

        // GPT5案準拠：canonical座標パスの完全ディープコピー
        deepCopyCanonicalPaths: function(paths) {
            /* 
            GPT5案：deepCopyPaths()でcanonical座標を完全保存
            */
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 新しいID
                points: (path.points || []).map(point => ({ 
                    x: point.x, 
                    y: point.y 
                })), // canonical座標完全コピー
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        },

        // 一意なレイヤー名を生成
        generateUniqueLayerName: function(baseName, layerSystem) {
            let name = baseName;
            let counter = 1;
            
            while (layerSystem.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        },

        // アクティブレイヤーのコピー（便利関数）
        copyActiveLayer: function() {
            if (!this.layerSystem) return;
            
            if (this.layerSystem.activeLayerIndex >= 0) {
                this.copyLayerCanonical(this.layerSystem.activeLayerIndex);
            } else {
                console.warn('ClipboardSystem: No active layer to copy');
            }
        },

        // 特定位置にペースト（便利関数）
        pasteAtPosition: function(x, y, name) {
            const result = this.pasteAsNewLayer({ x, y }, name);
            
            if (result && result.layer) {
                // ペースト後の位置調整は既にpasteAsNewLayerで実行済み
                console.log(`ClipboardSystem: Pasted at position (${x}, ${y})`);
            }
            
            return result;
        },

        // クリップボードデータ情報取得
        getClipboardInfo: function() {
            if (!this.clipboardData) {
                return {
                    hasData: false,
                    pathCount: 0,
                    isCanonical: false,
                    layerName: null,
                    copiedAt: null,
                    isBackground: false
                };
            }
            
            return {
                hasData: true,
                pathCount: this.clipboardData.metadata.pathCount,
                isCanonical: this.clipboardData.metadata.isCanonical,
                layerName: this.clipboardData.layerData.name,
                copiedAt: this.clipboardData.metadata.copiedAt,
                isBackground: this.clipboardData.layerData.backgroundData?.isBackground || false,
                age: Date.now() - this.clipboardData.metadata.copiedAt
            };
        },

        // クリップボードクリア
        clearClipboard: function() {
            this.clipboardData = null;
            console.log('ClipboardSystem: Clipboard cleared');
            
            if (window.Tegaki && window.Tegaki.EventBus) {
                window.Tegaki.EventBus.emit('clipboard:cleared', {});
            }
        },

        // クリップボード有効性チェック
        hasValidClipboardData: function() {
            if (!this.clipboardData) return false;
            
            const info = this.getClipboardInfo();
            // 1時間以上古いデータは無効とする（任意の制限）
            const maxAge = 60 * 60 * 1000; // 1 hour in milliseconds
            
            return info.hasData && info.age < maxAge;
        },

        // レイヤー複製（同一レイヤーのコピー）
        duplicateLayer: function(layerIndex) {
            if (!this.layerSystem) return null;
            
            // 現在のクリップボード保存
            const originalClipboard = this.clipboardData;
            
            // 指定レイヤーをコピー
            this.copyLayerCanonical(layerIndex);
            
            // ペースト（複製）
            const result = this.pasteAsNewLayer();
            
            // 元のクリップボード復元
            this.clipboardData = originalClipboard;
            
            return result;
        },

        // 外部システム参照設定
        setCameraSystem: function(cameraSystem) {
            this.cameraSystem = cameraSystem;
        },

        setDrawingEngine: function(drawingEngine) {
            this.drawingEngine = drawingEngine;
        },

        // デバッグ用：クリップボード状態取得
        getDebugInfo: function() {
            const info = this.getClipboardInfo();
            return {
                ...info,
                clipboardDataExists: !!this.clipboardData,
                systemReferences: {
                    layerSystem: !!this.layerSystem,
                    cameraSystem: !!this.cameraSystem,
                    drawingEngine: !!this.drawingEngine
                },
                configValid: !!(this.CONFIG && this.CONFIG.canvas && this.CONFIG.background)
            };
        },

        // 廃止予定：非canonical版（後方互換性のみ）
        copyActiveLayerLegacy: function() {
            console.warn('ClipboardSystem: copyActiveLayerLegacy is deprecated, use copyLayerCanonical instead');
            // GPT5案では使用禁止
            return false;
        },

        getTransformedPathsLegacy: function(layer, transform) {
            console.warn('ClipboardSystem: getTransformedPathsLegacy is deprecated');
            // GPT5案では使用禁止
            return [];
        }
    };

    // グローバル登録
    if (window.TegakiSystems) {
        window.TegakiSystems.Register('ClipboardSystem', ClipboardSystem);
    } else {
        console.error('ClipboardSystem: TegakiSystems not available for registration');
    }

})();// ===== systems/drawing-clipboard.js - 改修版：非破壊コピペ =====
// GPT5案.txt準拠：ClipboardSystem.copyLayerCanonical()とpasteAsNewLayer()実装
// canonical座標でコピー・ペースト、変形状態は初期化

(function() {
    'use strict';

    const ClipboardSystem = {
        name: 'ClipboardSystem',
        
        init: function(opts) {
            console.log('ClipboardSystem: Initializing with canonical coordinates...');
            
            this.app = opts.app;
            this.layerSystem = opts.layerSystem;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            this.clipboardData = null;
            
            // システム参照
            this.cameraSystem = null;
            this.drawingEngine = null;
            
            this.setupKeyboardEvents();
            
            console.log('ClipboardSystem: Initialized with non-destructive copy/paste');
        },

        setupKeyboardEvents: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyLayerCanonical(this.layerSystem.activeLayerIndex);
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteAsNewLayer();
                    e.preventDefault();
                }
            });
        },

        // === GPT5案準拠：ClipboardSystem.copyLayerCanonical() ===
        copyLayerCanonical: function(layerIndex) {
            /* 
            GPT5案：必ずLayerSystem.getLayerCanonicalPaths(layerId)を呼んで
            canonicalパスを保存する
            */
            if (!this.layerSystem) {
                console.warn('ClipboardSystem: LayerSystem not available');
                return;
            }

            if (layerIndex < 0 || layerIndex >= this.layerSystem.layers.length) {
                console.warn('ClipboardSystem: Invalid layer index for copy');
                return;
            }

            const layer = this.layerSystem.layers[layerIndex];
            if (!layer) {
                console.warn('ClipboardSystem: No layer to copy');
                return;
            }

            try {
                console.log('ClipboardSystem: Non-destructive copy started');
                
                const layerId = layer.layerData.id;
                
                // GPT5案準拠：canonical座標パスを取得
                const canonicalPaths = this.layerSystem.getLayerCanonicalPaths(layerId);
                
                console.log(`ClipboardSystem: Retrieved ${canonicalPaths.length} canonical paths`);
                
                // レイヤーデータのディープコピー
                const layerData = layer.layerData;
                
                // 背景データのコピー（背景レイヤーの場合）
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: this.CONFIG.background.color
                    };
                }

                // GPT5案準拠：canonical座標をクリップボードに保存
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyCanonicalPaths(canonicalPaths),
                        backgroundData: backgroundData
                    },
                    // GPT5案：変形情報はリセット（ペースト時は初期状態）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: canonicalPaths.length,
                        isCanonical: true, // canonical座標フラグ
                        source: 'LayerSystem.getLayerCanonicalPaths'
                    },
                    timestamp: Date.now()
                };

                console.log(`ClipboardSystem: Canonical copy completed: ${canonicalPaths.length} paths preserved`);
                console.log('ClipboardSystem: Copy metadata:', this.clipboardData.metadata);
                
            } catch (error) {
                console.error('ClipboardSystem: Failed to copy layer canonically:', error);
            }
        },

        // === GPT5案準拠：ClipboardSystem.pasteAsNewLayer() ===
        pasteAsNewLayer: function(atPosition, name) {
            /* 
            GPT5案：復元後にレイヤーtransformを(0,0,1,1,0)にしておく。
            rebuildPathGraphics()はcanonical点列を前提にGraphicsを作る。
            */
            if (!this.layerSystem) {
                console.warn('ClipboardSystem: LayerSystem not available');
                return;
            }

            if (!this.clipboardData) {
                console.warn('ClipboardSystem: No clipboard data to paste');
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                // canonical座標の検証
                if (!clipData.metadata?.isCanonical) {
                    console.warn('ClipboardSystem: Pasting potentially non-canonical data');
                } else {
                    console.log('ClipboardSystem: Pasting canonical data:', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = name || this.generateUniqueLayerName(
                    clipData.layerData.name, 
                    this.layerSystem
                );

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

                // GPT5案準拠：canonical座標パスデータ完全復元
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            points: [...pathData.points], // canonical座標完全コピー
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null // 後で生成
                        };
                        
                        // GPT5案準拠：rebuildPathGraphicsはcanonical点列前提
                        const rebuildSuccess = this.layerSystem.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            // レイヤーに追加
                            layer.layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                        } else {
                            console.warn(`ClipboardSystem: Failed to rebuild graphics for path`);
                        }
                    }
                });

                // GPT5案準拠：レイヤー変形データを初期化
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

                // EventBus通知
                window.Tegaki.EventBus.emit('layer:pasted', {
                    layerId: newLayerId,
                    layerIndex: index,
                    pathCount: clipData.layerData.paths.length
                });

                console.log(`ClipboardSystem: Canonical paste completed: ${clipData.layerData.paths.length} paths restored`);
                
                return { layer, index };
                
            } catch (error) {
                console.error('ClipboardSystem: Failed to paste layer canonically:', error);
                return null;
            }
        },

        // GPT5案準拠：canonical座標パスの完全ディープコピー
        deepCopyCanonicalPaths: function(paths) {
            /* 
            GPT5案：deepCopyPaths()でcanonical座標を完全保存
            */
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 新しいID
                points: (path.points || []).map(point => ({ 
                    x: point.x, 
                    y: point.y 
                })), // canonical座標完全コピー
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        },

        // 一意なレイヤー名を生成
        generateUniqueLayerName: function(baseName, layerSystem) {
            let name = baseName;
            let counter = 1;
            
            while (layerSystem.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        },

        // アクティブレイヤーのコピー（便利関数）
        copyActiveLayer: function() {
            if (this.layerSystem.activeLayerIndex >= 0) {
                this.copyLayerCanonical(this.layerSystem.activeLayerIndex);
            }
        },

        // 特定位置にペースト（便利関数）
        pasteAtPosition: function(x, y, name) {
            const result = this.pasteAsNewLayer({ x, y }, name);
            
            if (result && result.layer) {
                // ペースト後の位置調整
                const layerId = result.layer.layerData.id;
                const transform = this.layerSystem.layerTransforms.get(layerId);
                
                if (transform) {
                    transform.x = x || 0;
                    transform.y = y || 0;
                    
                    const centerX = this.CONFIG.canvas.width / 2;
                    const centerY = this.CONFIG.canvas.height / 2;
                    result.layer.position.set(centerX + transform.x, centerY + transform.y);
                    
                    this.layerSystem.requestThumbnailUpdate(result.index);
                }
            }
            
            return result;
        },

        // クリップボードデータ情報取得
        getClipboardInfo: function() {
            if (!this.clipboardData) {
                return null;
            }
            
            return {
                hasData: true,
                pathCount: this.clipboardData.metadata.pathCount,
                isCanonical: this.clipboardData.metadata.isCanonical,
                layerName: this.clipboardData.layerData.name,
                copiedAt: this.clipboardData.metadata.copiedAt,
                isBackground: this.clipboardData.layerData.backgroundData?.isBackground || false
            };
        },

        // クリップボードクリア
        clearClipboard: function() {
            this.clipboardData = null;
            console.log('ClipboardSystem: Clipboard cleared');
        },

        // 外部システム参照設定
        setCameraSystem: function(cameraSystem) {
            this.cameraSystem = cameraSystem;
        },

        setDrawingEngine: function(drawingEngine) {
            this.drawingEngine = drawingEngine;
        },

        // 廃止予定：非canonical版（後方互換性のみ）
        copyActiveLayerLegacy: function() {
            console.warn('ClipboardSystem: copyActiveLayerLegacy is deprecated, use copyLayerCanonical instead');
            // 変形状態考慮の旧版実装（GPT5案では廃止推奨）
            // 実装は省略（使用禁止）
        },

        getTransformedPathsLegacy: function(layer, transform) {
            console.warn('ClipboardSystem: getTransformedPathsLegacy is deprecated');
            // 仮想変形座標計算（GPT5案では廃止推奨）
            // 実装は省略（使用禁止）
            return [];
        }
    };

    // グローバル登録
    window.TegakiSystems.Register('ClipboardSystem', ClipboardSystem);

})();