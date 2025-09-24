/**
 * Drawing & Clipboard System (Phase2 Separated)
 * PixiJS v8.13 対応版
 * 描画エンジンとクリップボード機能
 */
(function() {
    'use strict';

    class DrawingEngine {
        constructor() {
            this.pixiApp = null;
            this.worldContainer = null;
            this.layerManager = null;
            
            // 描画状態
            this.isDrawing = false;
            this.currentPath = null;
            this.currentTool = 'pen';
            this.brushSettings = {
                size: 5,
                color: 0x000000,
                opacity: 100
            };
            
            this.boundEvents = {
                pointerdown: null,
                pointermove: null,
                pointerup: null,
                pointerout: null
            };
        }

        /**
         * 初期化
         */
        async initialize(pixiApp, worldContainer, layerManager) {
            this.pixiApp = pixiApp;
            this.worldContainer = worldContainer;
            this.layerManager = layerManager;
            
            this.setupEventListeners();
            
            console.log('✅ DrawingEngine initialized');
        }

        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            if (!this.pixiApp?.canvas) return;
            
            const canvas = this.pixiApp.canvas;
            
            this.boundEvents.pointerdown = (e) => this.handlePointerDown(e);
            this.boundEvents.pointermove = (e) => this.handlePointerMove(e);
            this.boundEvents.pointerup = (e) => this.handlePointerUp(e);
            this.boundEvents.pointerout = (e) => this.handlePointerOut(e);
            
            canvas.addEventListener('pointerdown', this.boundEvents.pointerdown);
            canvas.addEventListener('pointermove', this.boundEvents.pointermove);
            canvas.addEventListener('pointerup', this.boundEvents.pointerup);
            canvas.addEventListener('pointerout', this.boundEvents.pointerout);
        }

        /**
         * ポインターダウン処理
         */
        handlePointerDown(e) {
            // レイヤー変形モード中は描画無効
            if (this.layerManager?.isInTransformMode()) return;
            
            // 左クリックのみ
            if (e.button !== 0) return;
            
            // キー修飾チェック（カメラ操作等の場合は描画しない）
            if (e.shiftKey || e.ctrlKey || e.altKey) return;
            
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            const worldPos = this.screenToWorld(screenX, screenY);
            
            this.startDrawing(worldPos.x, worldPos.y);
            
            e.preventDefault();
            this.pixiApp.canvas.setPointerCapture(e.pointerId);
        }

        /**
         * ポインタームーブ処理
         */
        handlePointerMove(e) {
            if (!this.isDrawing) return;
            
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            const worldPos = this.screenToWorld(screenX, screenY);
            
            this.continueDrawing(worldPos.x, worldPos.y);
        }

        /**
         * ポインターアップ処理
         */
        handlePointerUp(e) {
            if (!this.isDrawing) return;
            
            this.endDrawing();
            
            try {
                this.pixiApp.canvas.releasePointerCapture(e.pointerId);
            } catch (ex) {
                // ポインターキャプチャー解除失敗は無視
            }
        }

        /**
         * ポインターアウト処理
         */
        handlePointerOut(e) {
            if (this.isDrawing) {
                this.endDrawing();
            }
        }

        /**
         * 描画開始
         */
        startDrawing(x, y) {
            if (!this.layerManager) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            this.isDrawing = true;
            this.currentPath = {
                tool: this.currentTool,
                size: this.brushSettings.size,
                color: this.brushSettings.color,
                opacity: this.brushSettings.opacity,
                points: [{ x, y }]
            };
        }

        /**
         * 描画継続
         */
        continueDrawing(x, y) {
            if (!this.isDrawing || !this.currentPath) return;
            
            // 前の点との距離チェック（最適化）
            const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            
            if (distance > 2) { // 最小距離フィルター
                this.currentPath.points.push({ x, y });
                
                // リアルタイムプレビュー更新
                this.updateDrawingPreview();
            }
        }

        /**
         * 描画終了
         */
        endDrawing() {
            if (!this.isDrawing || !this.currentPath) return;
            
            this.isDrawing = false;
            
            // パスをレイヤーに追加
            if (this.currentPath.points.length >= 2) {
                this.layerManager.addPath(this.currentPath);
            }
            
            this.currentPath = null;
        }

        /**
         * 描画プレビュー更新
         */
        updateDrawingPreview() {
            if (!this.currentPath || !this.layerManager) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // 一時的なプレビュー描画（簡略化）
            const graphics = activeLayer.graphics;
            
            // 最後の線分のみを追加描画
            const points = this.currentPath.points;
            if (points.length >= 2) {
                const prevPoint = points[points.length - 2];
                const currPoint = points[points.length - 1];
                
                graphics.moveTo(prevPoint.x, prevPoint.y);
                graphics.lineTo(currPoint.x, currPoint.y);
                graphics.stroke({
                    width: this.currentPath.size,
                    color: this.currentPath.color,
                    alpha: this.currentPath.opacity / 100,
                    cap: 'round',
                    join: 'round'
                });
            }
        }

        /**
         * 座標変換: スクリーン → ワールド
         */
        screenToWorld(screenX, screenY) {
            if (window.CoordinateSystem) {
                return window.CoordinateSystem.screenToCanvas(this.pixiApp, screenX, screenY);
            }
            
            // フォールバック
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            return {
                x: screenX - rect.left,
                y: screenY - rect.top
            };
        }

        /**
         * ツール設定
         */
        setTool(tool) {
            this.currentTool = tool;
        }

        /**
         * ブラシ設定更新
         */
        setBrushSettings(settings) {
            if (settings.size !== undefined) {
                this.brushSettings.size = Math.max(1, Math.min(100, settings.size));
            }
            if (settings.color !== undefined) {
                this.brushSettings.color = settings.color;
            }
            if (settings.opacity !== undefined) {
                this.brushSettings.opacity = Math.max(0, Math.min(100, settings.opacity));
            }
        }

        /**
         * 現在のブラシ設定取得
         */
        getBrushSettings() {
            return { ...this.brushSettings };
        }

        /**
         * 描画状態取得
         */
        isCurrentlyDrawing() {
            return this.isDrawing;
        }

        /**
         * 破棄処理
         */
        destroy() {
            // 描画終了
            if (this.isDrawing) {
                this.endDrawing();
            }
            
            // イベントリスナー削除
            if (this.pixiApp?.canvas) {
                const canvas = this.pixiApp.canvas;
                
                if (this.boundEvents.pointerdown) {
                    canvas.removeEventListener('pointerdown', this.boundEvents.pointerdown);
                }
                if (this.boundEvents.pointermove) {
                    canvas.removeEventListener('pointermove', this.boundEvents.pointermove);
                }
                if (this.boundEvents.pointerup) {
                    canvas.removeEventListener('pointerup', this.boundEvents.pointerup);
                }
                if (this.boundEvents.pointerout) {
                    canvas.removeEventListener('pointerout', this.boundEvents.pointerout);
                }
            }
            
            // 参照クリア
            this.pixiApp = null;
            this.worldContainer = null;
            this.layerManager = null;
            this.currentPath = null;
        }
    }

    class ClipboardSystem {
        constructor() {
            this.copiedData = null;
            this.supportedFormats = ['image/png', 'image/jpeg', 'text/plain'];
        }

        /**
         * 初期化
         */
        async initialize() {
            console.log('✅ ClipboardSystem initialized');
        }

        /**
         * レイヤーデータコピー
         */
        async copyLayer(layer) {
            if (!layer) return false;
            
            try {
                this.copiedData = {
                    type: 'layer',
                    data: {
                        name: layer.name + ' - Copy',
                        paths: JSON.parse(JSON.stringify(layer.paths)), // ディープコピー
                        opacity: layer.opacity,
                        visible: layer.visible,
                        blendMode: layer.blendMode
                    }
                };
                
                console.log('✅ Layer copied to clipboard');
                return true;
            } catch (error) {
                console.error('❌ Failed to copy layer:', error);
                return false;
            }
        }

        /**
         * レイヤーデータペースト
         */
        async pasteLayer(layerManager) {
            if (!this.copiedData || this.copiedData.type !== 'layer' || !layerManager) {
                return null;
            }
            
            try {
                const newLayer = await layerManager.createLayer(this.copiedData.data.name);
                if (!newLayer) return null;
                
                // データ復元
                newLayer.paths = JSON.parse(JSON.stringify(this.copiedData.data.paths));
                newLayer.opacity = this.copiedData.data.opacity;
                newLayer.visible = this.copiedData.data.visible;
                newLayer.blendMode = this.copiedData.data.blendMode;
                
                // グラフィック再構築
                layerManager.rebuildPathGraphics(newLayer);
                layerManager.updateUI();
                
                console.log('✅ Layer pasted from clipboard');
                return newLayer;
            } catch (error) {
                console.error('❌ Failed to paste layer:', error);
                return null;
            }
        }

        /**
         * 画像データコピー（キャンバス全体）
         */
        async copyCanvasAsImage(pixiApp) {
            if (!pixiApp) return false;
            
            try {
                // レンダーテクスチャー作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: pixiApp.screen.width,
                    height: pixiApp.screen.height
                });
                
                // 現在の状態をレンダリング
                pixiApp.renderer.render(pixiApp.stage, { renderTexture });
                
                // Canvas要素として取得
                const canvas = pixiApp.renderer.extract.canvas(renderTexture);
                
                // Blob作成
                return new Promise((resolve) => {
                    canvas.toBlob(async (blob) => {
                        if (blob && navigator.clipboard) {
                            try {
                                await navigator.clipboard.write([
                                    new ClipboardItem({ 'image/png': blob })
                                ]);
                                console.log('✅ Canvas copied as image');
                                resolve(true);
                            } catch (error) {
                                console.error('❌ Failed to copy canvas as image:', error);
                                resolve(false);
                            }
                        } else {
                            resolve(false);
                        }
                        
                        // リソース解放
                        renderTexture.destroy(true);
                    }, 'image/png');
                });
            } catch (error) {
                console.error('❌ Failed to copy canvas:', error);
                return false;
            }
        }

        /**
         * 画像データペースト
         */
        async pasteImageFromClipboard(layerManager) {
            if (!navigator.clipboard || !layerManager) return false;
            
            try {
                const clipboardItems = await navigator.clipboard.read();
                
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            const blob = await clipboardItem.getType(type);
                            const success = await this.loadImageAsLayer(blob, layerManager);
                            if (success) {
                                console.log('✅ Image pasted from clipboard');
                                return true;
                            }
                        }
                    }
                }
                
                return false;
            } catch (error) {
                console.error('❌ Failed to paste image:', error);
                return false;
            }
        }

        /**
         * 画像をレイヤーとして読み込み
         */
        async loadImageAsLayer(blob, layerManager) {
            return new Promise((resolve) => {
                const img = new Image();
                
                img.onload = async () => {
                    try {
                        // 新しいレイヤー作成
                        const layer = await layerManager.createLayer('Pasted Image');
                        if (!layer) {
                            resolve(false);
                            return;
                        }
                        
                        // PixiJS テクスチャー作成
                        const texture = PIXI.Texture.from(img);
                        const sprite = PIXI.Sprite.from(texture);
                        sprite.eventMode = 'static';
                        
                        // レイヤーコンテナに追加
                        layer.container.addChild(sprite);
                        
                        // UI更新
                        layerManager.updateUI();
                        
                        URL.revokeObjectURL(img.src);
                        resolve(true);
                    } catch (error) {
                        console.error('❌ Failed to load image as layer:', error);
                        URL.revokeObjectURL(img.src);
                        resolve(false);
                    }
                };
                
                img.onerror = () => {
                    console.error('❌ Failed to load image');
                    URL.revokeObjectURL(img.src);
                    resolve(false);
                };
                
                img.src = URL.createObjectURL(blob);
            });
        }

        /**
         * クリップボードデータ確認
         */
        async checkClipboardContent() {
            if (!navigator.clipboard) return { hasText: false, hasImage: false };
            
            try {
                const clipboardItems = await navigator.clipboard.read();
                let hasText = false;
                let hasImage = false;
                
                for (const item of clipboardItems) {
                    if (item.types.includes('text/plain')) hasText = true;
                    for (const type of item.types) {
                        if (type.startsWith('image/')) hasImage = true;
                    }
                }
                
                return { hasText, hasImage };
            } catch (error) {
                return { hasText: false, hasImage: false };
            }
        }

        /**
         * テキストコピー
         */
        async copyText(text) {
            if (!navigator.clipboard || !text) return false;
            
            try {
                await navigator.clipboard.writeText(text);
                console.log('✅ Text copied to clipboard');
                return true;
            } catch (error) {
                console.error('❌ Failed to copy text:', error);
                return false;
            }
        }

        /**
         * テキストペースト
         */
        async pasteText() {
            if (!navigator.clipboard) return null;
            
            try {
                const text = await navigator.clipboard.readText();
                console.log('✅ Text pasted from clipboard');
                return text;
            } catch (error) {
                console.error('❌ Failed to paste text:', error);
                return null;
            }
        }

        /**
         * コピーデータクリア
         */
        clearCopiedData() {
            this.copiedData = null;
        }

        /**
         * コピーデータ有無確認
         */
        hasCopiedData() {
            return this.copiedData !== null;
        }

        /**
         * 破棄処理
         */
        destroy() {
            this.clearCopiedData();
        }
    }

    /**
     * 統合システムクラス
     */
    class DrawingClipboardSystem {
        constructor() {
            this.drawingEngine = new DrawingEngine();
            this.clipboardSystem = new ClipboardSystem();
        }

        /**
         * 初期化
         */
        async initialize(pixiApp, worldContainer, layerManager) {
            await this.drawingEngine.initialize(pixiApp, worldContainer, layerManager);
            await this.clipboardSystem.initialize();
            
            // キーボードショートカット設定
            this.setupShortcuts(layerManager);
            
            console.log('✅ DrawingClipboardSystem initialized');
        }

        /**
         * ショートカット設定
         */
        setupShortcuts(layerManager) {
            document.addEventListener('keydown', async (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.code) {
                        case 'KeyC':
                            if (e.shiftKey) {
                                // Ctrl+Shift+C: キャンバス全体をコピー
                                e.preventDefault();
                                await this.clipboardSystem.copyCanvasAsImage(this.drawingEngine.pixiApp);
                            } else {
                                // Ctrl+C: アクティブレイヤーをコピー
                                e.preventDefault();
                                const activeLayer = layerManager.getActiveLayer();
                                if (activeLayer) {
                                    await this.clipboardSystem.copyLayer(activeLayer);
                                }
                            }
                            break;
                            
                        case 'KeyV':
                            if (!e.shiftKey) { // V単体はレイヤー変形モードなので除外
                                // Ctrl+V: ペースト
                                e.preventDefault();
                                
                                // 画像ペーストを試行
                                const imageSuccess = await this.clipboardSystem.pasteImageFromClipboard(layerManager);
                                
                                // 画像ペーストに失敗した場合はレイヤーペーストを試行
                                if (!imageSuccess) {
                                    await this.clipboardSystem.pasteLayer(layerManager);
                                }
                            }
                            break;
                    }
                }
            });
        }

        /**
         * 描画エンジン取得
         */
        getDrawingEngine() {
            return this.drawingEngine;
        }

        /**
         * クリップボードシステム取得
         */
        getClipboardSystem() {
            return this.clipboardSystem;
        }

        /**
         * 描画ツール設定
         */
        setDrawingTool(tool) {
            this.drawingEngine.setTool(tool);
        }

        /**
         * ブラシ設定更新
         */
        setBrushSettings(settings) {
            this.drawingEngine.setBrushSettings(settings);
        }

        /**
         * ブラシ設定取得
         */
        getBrushSettings() {
            return this.drawingEngine.getBrushSettings();
        }

        /**
         * 破棄処理
         */
        destroy() {
            this.drawingEngine.destroy();
            this.clipboardSystem.destroy();
        }
    }

    // グローバル公開
    if (!window.TegakiDrawingClipboardSeparated) {
        window.TegakiDrawingClipboardSeparated = {};
    }
    window.TegakiDrawingClipboardSeparated.DrawingClipboardSystem = DrawingClipboardSystem;
    window.TegakiDrawingClipboardSeparated.DrawingEngine = DrawingEngine;
    window.TegakiDrawingClipboardSeparated.ClipboardSystem = ClipboardSystem;
    
    console.log('✅ drawing-clipboard.js loaded (Phase2 separated)');
})();