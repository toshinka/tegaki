// ========================================
// tegaki_anime_core.js - メインクラス（統合）
// ========================================

(function() {
    'use strict';
    
    window.TegakiAnimeCore = class TegakiAnimeCore {
        constructor(container) {
            this.container = container;
            
            // 各モジュールのインスタンス
            this.canvasManager = null;
            this.layerManager = null;
            this.drawingEngine = null;
            this.historyManager = null;
            this.uiBuilder = null;
            this.keyboardManager = null;
            this.exportManager = null;
            
            // UI要素への参照
            this.frameThumbnails = null;
            this.layerPanel = null;
            this.toolButtons = null;
            this.colorButtons = null;
            
            // 設定
            this.frameDelay = 200;
            this.penSize = 2;
            this.eraserSize = 10;
            this.onionSkinEnabled = false;
            
            this.init();
        }
        
        /**
         * 初期化
         */
        init() {
            // 依存モジュールの存在確認
            if (!window.CanvasManager) {
                console.error('❌ CanvasManager not loaded');
                throw new Error('CanvasManager is required but not loaded');
            }
            if (!window.LayerManager) {
                console.error('❌ LayerManager not loaded');
                throw new Error('LayerManager is required but not loaded');
            }
            if (!window.DrawingEngine) {
                console.error('❌ DrawingEngine not loaded');
                throw new Error('DrawingEngine is required but not loaded');
            }
            if (!window.HistoryManager) {
                console.error('❌ HistoryManager not loaded');
                throw new Error('HistoryManager is required but not loaded');
            }
            if (!window.UIBuilder) {
                console.error('❌ UIBuilder not loaded');
                throw new Error('UIBuilder is required but not loaded');
            }
            if (!window.KeyboardManager) {
                console.error('❌ KeyboardManager not loaded');
                throw new Error('KeyboardManager is required but not loaded');
            }
            if (!window.ExportManager) {
                console.error('❌ ExportManager not loaded');
                throw new Error('ExportManager is required but not loaded');
            }
            
            console.log('✅ All modules verified');
            
            // モジュールの初期化
            this.canvasManager = new window.CanvasManager(400, 400, '#f0e0d6');
            this.layerManager = new window.LayerManager(3, 3, this.canvasManager);
            this.drawingEngine = new window.DrawingEngine(this.canvasManager);
            this.historyManager = new window.HistoryManager(3, 3, this.canvasManager);
            this.uiBuilder = new window.UIBuilder(this.container);
            this.keyboardManager = new window.KeyboardManager();
            this.exportManager = new window.ExportManager(this.layerManager, this.canvasManager);
            
            // UIの構築
            this.buildUI();
            
            // イベントの設定
            this.attachEvents();
            
            // キーボードショートカットの登録
            this.registerKeyboardShortcuts();
            
            // 初期表示
            this.loadCurrentLayer();
            this.updateAllThumbnails();
        }
        
        /**
         * UIの構築
         */
        buildUI() {
            // メインレイアウト
            this.uiBuilder.createMainLayout();
            
            // ショートカットパネル
            this.uiBuilder.createShortcutPanel();
            
            // キャンバスエリア（既に作成済みのキャンバスを使用）
            const canvas = this.canvasManager.canvas;
            const bgCanvas = this.canvasManager.bgCanvas;
            const centerArea = this.uiBuilder.createCanvasArea(canvas, bgCanvas);
            
            // フレームサムネイル
            const thumbnailData = this.uiBuilder.createFrameThumbnails(
                this.layerManager.frameCount,
                (index) => this.switchFrame(index)
            );
            this.frameThumbnails = thumbnailData.thumbnails;
            centerArea.appendChild(thumbnailData.container);
            
            // レイヤーパネル
            const layerPanelData = this.uiBuilder.createLayerPanel(
                this.layerManager.layerCountPerFrame,
                (index) => this.switchLayer(index)
            );
            this.layerPanel = layerPanelData.layers;
            
            // コントロールパネル
            this.uiBuilder.createControlPanel({
                onColorChange: (color) => this.setColor(color),
                onToolChange: (tool) => this.setTool(tool),
                onSizeChange: (size) => this.setPenSize(size),
                onEraserSizeChange: (size) => this.setEraserSize(size),
                onDelayChange: (delay) => this.setFrameDelay(delay),
                onAddFrame: () => this.addFrame(),
                onDeleteFrame: () => this.deleteFrame(),
                onPreview: () => this.previewAnimation(),
                onOnionSkinChange: (enabled) => this.setOnionSkin(enabled)
            });
            
            // 初期ハイライト
            this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, 0);
            this.uiBuilder.highlightLayerPanel(this.layerPanel, 1);
        }
        
        /**
         * イベントの設定
         */
        attachEvents() {
            const canvas = this.canvasManager.canvas;
            
            // マウスイベント
            canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            canvas.addEventListener('mouseup', () => this.handleMouseUp());
            canvas.addEventListener('mouseleave', () => this.handleMouseUp());
            
            // タッチイベント（モバイル対応）
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                canvas.dispatchEvent(mouseEvent);
            });
            
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                canvas.dispatchEvent(mouseEvent);
            });
            
            canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                const mouseEvent = new MouseEvent('mouseup', {});
                canvas.dispatchEvent(mouseEvent);
            });
        }
        
        /**
         * キーボードショートカットの登録
         */
        registerKeyboardShortcuts() {
            const km = this.keyboardManager;
            
            // Undo/Redo
            km.register('z', { ctrl: true }, () => this.undo(), 'Undo');
            km.register('y', { ctrl: true }, () => this.redo(), 'Redo');
            
            // フレーム切替（数字キー1-9）
            for (let i = 1; i <= 9; i++) {
                km.register(String(i), {}, () => {
                    if (i - 1 < this.layerManager.frameCount) {
                        this.switchFrame(i - 1);
                    }
                }, `Switch to frame ${i}`);
            }
            
            // レイヤー切替
            km.register('q', {}, () => this.switchToPreviousLayer(), 'Previous layer');
            km.register('w', {}, () => this.switchToNextLayer(), 'Next layer');
            
            // ツール切替
            km.register('p', {}, () => this.setTool('pen'), 'Pen tool');
            km.register('e', {}, () => this.setTool('eraser'), 'Eraser tool');
            km.register('g', {}, () => this.setTool('bucket'), 'Bucket tool');
            
            // キーボードマネージャーを有効化
            km.attach();
        }
        
        /**
         * マウスダウンハンドラ
         */
        handleMouseDown(e) {
            const shouldPushHistory = this.drawingEngine.startDrawing(e.clientX, e.clientY);
            
            // バケツツールの場合は即座に履歴に追加
            if (shouldPushHistory) {
                this.saveToHistory();
                this.updateCurrentLayerThumbnails();
            }
        }
        
        /**
         * マウスムーブハンドラ
         */
        handleMouseMove(e) {
            this.drawingEngine.draw(e.clientX, e.clientY);
        }
        
        /**
         * マウスアップハンドラ
         */
        handleMouseUp() {
            const shouldPushHistory = this.drawingEngine.stopDrawing();
            
            if (shouldPushHistory) {
                this.saveToHistory();
                this.updateCurrentLayerThumbnails();
            }
        }
        
        /**
         * 現在のレイヤーを読み込み
         */
        loadCurrentLayer() {
            const imageData = this.layerManager.getActiveLayerImageData();
            this.canvasManager.putImageData(imageData);
        }
        
        /**
         * 現在のレイヤーを保存
         */
        saveCurrentLayer() {
            const imageData = this.canvasManager.getImageData();
            this.layerManager.setActiveLayerImageData(imageData);
        }
        
        /**
         * 履歴に保存
         */
        saveToHistory() {
            const imageData = this.canvasManager.getImageData();
            this.historyManager.pushHistory(
                this.layerManager.activeFrameIndex,
                this.layerManager.activeLayerIndex,
                imageData
            );
        }
        
        /**
         * フレーム切替
         */
        switchFrame(frameIndex) {
            if (frameIndex === this.layerManager.activeFrameIndex) return;
            
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // フレームを切替
            this.layerManager.switchFrame(frameIndex);
            
            // 新しいフレームのレイヤーを読み込み
            this.loadCurrentLayer();
            
            // UIを更新
            this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, frameIndex);
            this.updateLayerPanelThumbnails();
        }
        
        /**
         * レイヤー切替
         */
        switchLayer(layerIndex) {
            if (layerIndex === this.layerManager.activeLayerIndex) return;
            
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // レイヤーを切替
            this.layerManager.switchLayer(layerIndex);
            
            // 新しいレイヤーを読み込み
            this.loadCurrentLayer();
            
            // UIを更新
            this.uiBuilder.highlightLayerPanel(this.layerPanel, layerIndex);
        }
        
        /**
         * 前のレイヤーに切替
         */
        switchToPreviousLayer() {
            const newIndex = this.layerManager.activeLayerIndex - 1;
            if (newIndex >= 0) {
                this.switchLayer(newIndex);
            }
        }
        
        /**
         * 次のレイヤーに切替
         */
        switchToNextLayer() {
            const newIndex = this.layerManager.activeLayerIndex + 1;
            if (newIndex < this.layerManager.layerCountPerFrame) {
                this.switchLayer(newIndex);
            }
        }
        
        /**
         * Undo
         */
        undo() {
            const imageData = this.historyManager.undo(
                this.layerManager.activeFrameIndex,
                this.layerManager.activeLayerIndex
            );
            
            if (imageData) {
                this.canvasManager.putImageData(imageData);
                this.layerManager.setActiveLayerImageData(imageData);
                this.updateCurrentLayerThumbnails();
            }
        }
        
        /**
         * Redo
         */
        redo() {
            const imageData = this.historyManager.redo(
                this.layerManager.activeFrameIndex,
                this.layerManager.activeLayerIndex
            );
            
            if (imageData) {
                this.canvasManager.putImageData(imageData);
                this.layerManager.setActiveLayerImageData(imageData);
                this.updateCurrentLayerThumbnails();
            }
        }
        
        /**
         * 色を設定
         */
        setColor(color) {
            this.drawingEngine.setColor(color);
        }
        
        /**
         * ツールを設定
         */
        setTool(tool) {
            this.drawingEngine.setTool(tool);
            
            // ツールに応じてサイズを切り替え
            if (tool === 'eraser') {
                this.drawingEngine.setSize(this.eraserSize);
            } else if (tool === 'pen') {
                this.drawingEngine.setSize(this.penSize);
            }
        }
        
        /**
         * ペンサイズを設定
         */
        setPenSize(size) {
            this.penSize = size;
            if (this.drawingEngine.currentTool === 'pen') {
                this.drawingEngine.setSize(size);
            }
        }
        
        /**
         * 消しゴムサイズを設定
         */
        setEraserSize(size) {
            this.eraserSize = size;
            if (this.drawingEngine.currentTool === 'eraser') {
                this.drawingEngine.setSize(size);
            }
        }
        
        /**
         * フレーム間隔を設定
         */
        setFrameDelay(delay) {
            this.frameDelay = delay;
        }
        
        /**
         * オニオンスキンを設定
         */
        setOnionSkin(enabled) {
            this.onionSkinEnabled = enabled;
            // TODO: オニオンスキン表示の実装
        }
        
        /**
         * フレームを追加
         */
        addFrame() {
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // フレームを追加
            this.layerManager.addFrame();
            this.historyManager.addFrame();
            
            // UIを再構築
            this.rebuildFrameThumbnails();
            
            // 新しいフレームに切り替え
            this.switchFrame(this.layerManager.frameCount - 1);
        }
        
        /**
         * フレームを削除
         */
        deleteFrame() {
            if (this.layerManager.frameCount <= 1) {
                alert('最後のフレームは削除できません');
                return;
            }
            
            const currentIndex = this.layerManager.activeFrameIndex;
            
            if (confirm(`フレーム ${currentIndex + 1} を削除しますか？`)) {
                this.layerManager.deleteFrame(currentIndex);
                this.historyManager.deleteFrame(currentIndex);
                
                // UIを再構築
                this.rebuildFrameThumbnails();
                
                // アクティブフレームを調整
                const newIndex = Math.min(currentIndex, this.layerManager.frameCount - 1);
                this.loadCurrentLayer();
                this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, newIndex);
                this.updateAllThumbnails();
            }
        }
        
        /**
         * フレームサムネイルを再構築
         */
        rebuildFrameThumbnails() {
            // 古いサムネイルコンテナを削除
            const oldContainer = this.frameThumbnails[0]?.parentElement;
            if (oldContainer) {
                oldContainer.remove();
            }
            
            // 新しいサムネイルを作成
            const thumbnailData = this.uiBuilder.createFrameThumbnails(
                this.layerManager.frameCount,
                (index) => this.switchFrame(index)
            );
            this.frameThumbnails = thumbnailData.thumbnails;
            
            // キャンバスエリアに追加
            const centerArea = this.uiBuilder.wrapper.children[1];
            centerArea.appendChild(thumbnailData.container);
            
            // サムネイルを更新
            this.updateAllThumbnails();
        }
        
        /**
         * 全サムネイルを更新
         */
        updateAllThumbnails() {
            for (let i = 0; i < this.layerManager.frameCount; i++) {
                this.updateFrameThumbnail(i);
            }
            this.updateLayerPanelThumbnails();
        }
        
        /**
         * フレームサムネイルを更新
         */
        updateFrameThumbnail(frameIndex) {
            const compositeData = this.layerManager.getCompositeImageData(frameIndex);
            if (compositeData && this.frameThumbnails[frameIndex]) {
                this.uiBuilder.updateFrameThumbnail(
                    this.frameThumbnails[frameIndex],
                    compositeData
                );
            }
        }
        
        /**
         * 現在のフレーム・レイヤーのサムネイルを更新
         */
        updateCurrentLayerThumbnails() {
            // フレームサムネイルを更新
            this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
            
            // レイヤーサムネイルを更新
            this.updateLayerPanelThumbnails();
        }
        
        /**
         * レイヤーパネルのサムネイルを更新
         */
        updateLayerPanelThumbnails() {
            const frame = this.layerManager.getActiveFrame();
            
            for (let i = 0; i < frame.layers.length; i++) {
                const layer = frame.layers[i];
                const layerCanvas = this.layerPanel[i].canvas;
                
                this.uiBuilder.updateLayerThumbnail(layerCanvas, layer.imageData);
            }
        }
        
        /**
         * アニメーションプレビュー
         */
        previewAnimation() {
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // プレビューウィンドウを作成
            const previewWindow = window.open('', 'Preview', 'width=420,height=420');
            
            if (!previewWindow) {
                alert('ポップアップがブロックされました。ブラウザの設定を確認してください。');
                return;
            }
            
            previewWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>アニメーションプレビュー</title>
                    <style>
                        body {
                            margin: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            background: #333;
                        }
                        canvas {
                            border: 2px solid #800000;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                        }
                    </style>
                </head>
                <body>
                    <canvas id="preview" width="400" height="400"></canvas>
                </body>
                </html>
            `);
            
            const previewCanvas = previewWindow.document.getElementById('preview');
            const previewCtx = previewCanvas.getContext('2d');
            
            let currentFrame = 0;
            const compositeFrames = this.layerManager.getCompositeFrames();
            
            const animate = () => {
                const imageData = compositeFrames[currentFrame];
                previewCtx.putImageData(imageData, 0, 0);
                
                currentFrame = (currentFrame + 1) % compositeFrames.length;
                
                setTimeout(() => {
                    if (!previewWindow.closed) {
                        animate();
                    }
                }, this.frameDelay);
            };
            
            previewWindow.onload = () => {
                animate();
            };
        }
        
        /**
         * APNGとしてエクスポート
         */
        async exportAsApng() {
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            try {
                const blob = await this.exportManager.exportAsApng(this.frameDelay);
                return blob;
            } catch (error) {
                console.error('APNG export error:', error);
                alert('APNG出力に失敗しました: ' + error.message);
                return null;
            }
        }
        
        /**
         * GIFとしてエクスポート
         */
        async exportAsGif(onProgress) {
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            try {
                const blob = await this.exportManager.exportAsGif(this.frameDelay, onProgress);
                return blob;
            } catch (error) {
                console.error('GIF export error:', error);
                alert('GIF出力に失敗しました: ' + error.message);
                return null;
            }
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            // キーボードマネージャーをデタッチ
            if (this.keyboardManager) {
                this.keyboardManager.destroy();
            }
            
            // 各モジュールを破棄
            if (this.canvasManager) this.canvasManager.destroy();
            if (this.layerManager) this.layerManager.destroy();
            if (this.drawingEngine) this.drawingEngine.destroy();
            if (this.historyManager) this.historyManager.destroy();
            if (this.uiBuilder) this.uiBuilder.destroy();
            if (this.exportManager) this.exportManager.destroy();
            
            // 参照をクリア
            this.canvasManager = null;
            this.layerManager = null;
            this.drawingEngine = null;
            this.historyManager = null;
            this.uiBuilder = null;
            this.keyboardManager = null;
            this.exportManager = null;
            this.frameThumbnails = null;
            this.layerPanel = null;
        }
    };
    
    console.log('✅ TegakiAnimeCore loaded');
})();