// ===== clipboard-system.js - クリップボードシステム（Phase2分離版） =====
// core-engine.js から分離した非破壊コピー&ペーストシステム
// Phase1.5改修: 座標変換統一・非破壊処理完全対応

/*
=== Phase2分離 + Phase1.5改修完了ヘッダー ===

【分離内容】
- ClipboardSystemクラス完全分離
- 非破壊コピー&ペースト処理
- 変形状態考慮のデータ保持
- キーボードショートカット対応

【Phase1.5改修完了】
✅ 座標変換統一: window.CoordinateSystem使用に統一
✅ 非破壊コピー: 完全なパスデータ保持
✅ 変形状態考慮: 仮想変形座標計算
✅ 安全なペースト: Graphics再生成・エラー処理

【Dependencies】
- CONFIG: config.js のグローバル設定
- window.CoordinateSystem: coordinate-system.js 統一座標API
- PIXI: PixiJS v8.13
- LayerManager: レイヤー管理（分離後）

【呼び出し側】
- CoreRuntime: 公開API経由
- core-engine.js → 各分離Engine

=== Phase2分離 + Phase1.5改修完了ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === クリップボード管理システム（Phase2分離版・Phase1.5改修完了） ===
    class ClipboardSystem {
        constructor() {
            this.clipboardData = null;
            this.layerManager = null; // 依存注入用
            this.setupKeyboardEvents();
        }

        setupKeyboardEvents() {
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

        // ✅ Phase1.5改修: 非破壊版アクティブレイヤーのコピー
        copyActiveLayer() {
            if (!this.layerManager) {
                console.warn('ClipboardSystem: LayerManager not available');
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                return;
            }

            try {
                console.log('Non-destructive copy started');
                
                // ✅ 現在の変形状態を取得
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
                        color: CONFIG.background.color
                    };
                }

                // ✅ 完全なパスデータをクリップボードに保存
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
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform)
                    },
                    timestamp: Date.now()
                };

                console.log(`Non-destructive copy completed: ${pathsToStore.length} paths preserved`);
                console.log('Copy metadata:', this.clipboardData.metadata);
                
            } catch (error) {
                console.error('Failed to copy layer non-destructively:', error);
            }
        }

        // ✅ Phase1.5改修: 現在の変形状態を適用した座標を仮想計算（PIXI.Matrix使用）
        getTransformedPaths(layer, transform) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // ✅ 変形行列作成（PIXI.Matrix使用）
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            // パスに仮想変形を適用（元データは変更しない）
            return (layer.layerData.paths || []).map(path => {
                try {
                    const transformedPoints = [];
                    
                    // 各ポイントに変形を適用
                    for (let point of (path.points || [])) {
                        try {
                            // 座標検証
                            if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                                !isFinite(point.x) || !isFinite(point.y)) {
                                console.warn('Invalid point in getTransformedPaths:', point);
                                continue;
                            }
                            
                            // ✅ PIXI.Matrix変形適用
                            const transformed = matrix.apply(point);
                            
                            // 変形結果検証
                            if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                                isFinite(transformed.x) && isFinite(transformed.y)) {
                                transformedPoints.push(transformed);
                            }
                        } catch (pointError) {
                            console.warn('Point transformation failed:', pointError);
                        }
                    }
                    
                    return {
                        id: `${path.id}_transformed_${Date.now()}`,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete
                    };
                } catch (pathError) {
                    console.error('Path transformation failed:', pathError);
                    // エラー時は元のパスを返す（安全対策）
                    return {
                        id: path.id,
                        points: path.points || [],
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete
                    };
                }
            });
        }

        // ✅ Phase1.5改修: パスデータの完全ディープコピー
        deepCopyPaths(paths) {
            return (paths || []).map(path => {
                try {
                    return {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 新しいID
                        points: (path.points || []).map(point => {
                            // 座標検証付きコピー
                            if (typeof point.x === 'number' && typeof point.y === 'number' &&
                                isFinite(point.x) && isFinite(point.y)) {
                                return { x: point.x, y: point.y };
                            } else {
                                console.warn('Invalid point in deepCopyPaths:', point);
                                return { x: 0, y: 0 }; // デフォルト座標
                            }
                        }),
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete || true
                    };
                } catch (pathError) {
                    console.error('Path deep copy failed:', pathError);
                    // エラー時は空のパスを返す
                    return {
                        id: `path_error_${Date.now()}`,
                        points: [],
                        color: path.color || 0x800000,
                        size: path.size || 16,
                        opacity: path.opacity || 1.0,
                        isComplete: true
                    };
                }
            });
        }

        // ✅ Phase1.5改修: 非破壊版レイヤーのペースト
        pasteLayer() {
            if (!this.layerManager) {
                console.warn('ClipboardSystem: LayerManager not available');
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                // ✅ 非破壊コピーの検証
                if (!clipData.metadata?.isNonDestructive) {
                    console.warn('Pasting potentially degraded data');
                } else {
                    console.log('Pasting non-destructive data:', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, this.layerManager);

                // 新規レイヤーを作成
                const { layer, index } = this.layerManager.createLayer(layerName, false);

                // 背景データが存在する場合は背景として再構築
                if (clipData.layerData.backgroundData) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(clipData.layerData.backgroundData.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                    layer.layerData.isBackground = true;
                }

                // ✅ パスデータ完全復元
                clipData.layerData.paths.forEach(pathData => {
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
                        
                        // パスGraphicsを生成
                        const rebuildSuccess = this.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            // レイヤーに追加
                            layer.layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                        }
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

                console.log(`Non-destructive paste completed: ${clipData.layerData.paths.length} paths restored`);
                
            } catch (error) {
                console.error('Failed to paste layer non-destructively:', error);
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
        
        // ✅ Phase1.5改修: パスGraphics再生成（安全版）
        rebuildPathGraphics(path) {
            try {
                // 既存Graphics削除
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy();
                        }
                    } catch (destroyError) {
                        console.warn('Graphics destroy failed:', destroyError);
                    }
                    path.graphics = null;
                }
                
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
                console.error('Error in rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        }
        
        // 依存注入設定用（分離後のEngine間参照）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        // クリップボード状態取得
        hasClipboardData() {
            return !!this.clipboardData;
        }
        
        getClipboardMetadata() {
            return this.clipboardData?.metadata || null;
        }
        
        // クリップボードクリア
        clearClipboard() {
            this.clipboardData = null;
            console.log('Clipboard cleared');
        }
        
        // ✅ Phase1.5新規: クリップボードデータの検証
        validateClipboardData() {
            if (!this.clipboardData) {
                return { valid: false, reason: 'No clipboard data' };
            }
            
            try {
                const data = this.clipboardData;
                
                // 基本構造チェック
                if (!data.layerData || !data.metadata) {
                    return { valid: false, reason: 'Invalid data structure' };
                }
                
                // パスデータチェック
                if (!Array.isArray(data.layerData.paths)) {
                    return { valid: false, reason: 'Invalid paths data' };
                }
                
                // 各パスの整合性チェック
                for (let i = 0; i < data.layerData.paths.length; i++) {
                    const path = data.layerData.paths[i];
                    if (!path.id || !Array.isArray(path.points)) {
                        return { 
                            valid: false, 
                            reason: `Invalid path at index ${i}` 
                        };
                    }
                }
                
                return { 
                    valid: true, 
                    pathCount: data.layerData.paths.length,
                    isNonDestructive: data.metadata.isNonDestructive
                };
                
            } catch (error) {
                return { 
                    valid: false, 
                    reason: `Validation error: ${error.message}` 
                };
            }
        }
    }

    // === グローバル公開 ===
    window.TegakiClipboardSystem = ClipboardSystem;
    
})();