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
            
            // プレビュー状態
            this.isPreviewMode = false;
            this.previewIntervalId = null;
            this.previewFrameIndex = 0;
            this.savedCanvasState = null;
            
            this.init();
        }
        
        /**
         * 初期化
         */
        init() {
            // 依存モジュールの存在確認
            const requiredModules = [
                'CanvasManager', 'LayerManager', 'DrawingEngine', 
                'HistoryManager', 'UIBuilder', 'KeyboardManager', 'ExportManager'
            ];
            
            for (const moduleName of requiredModules) {
                if (!window[moduleName]) {
                    console.error(`❌ ${moduleName} not loaded`);
                    throw new Error(`${moduleName} is required but not loaded`);
                }
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
            
            // フレームサムネイル（コントロールボタン付き）
            const thumbnailData = this.uiBuilder.createFrameThumbnails(
                this.layerManager.frameCount,
                (index) => this.switchFrame(index),
                () => this.addFrame(),
                () => this.deleteFrame(),
                () => this.copyFrame()
            );
            this.frameThumbnails = thumbnailData.thumbnails;
            centerArea.appendChild(thumbnailData.container);
            
            // レイヤーパネル（不透明度と表示ON/OFFコールバック追加）
            const layerPanelData = this.uiBuilder.createLayerPanel(
                this.layerManager.layerCountPerFrame,
                this.layerManager.activeFrameIndex,
                (index) => this.switchLayer(index),
                (index) => this.toggleLayerVisibility(index),
                (index, delta) => this.adjustLayerOpacity(index, delta)
            );
            this.layerPanel = layerPanelData.layers;
            
            // コントロールパネル
            this.uiBuilder.createControlPanel({
                onColorChange: (color) => this.setColor(color),
                onToolChange: (tool) => this.setTool(tool),
                onSizeChange: (size) => this.setPenSize(size),
                onEraserSizeChange: (size) => this.setEraserSize(size),
                onDelayChange: (delay) => this.setFrameDelay(delay),
                onPreview: () => this.togglePreview(),
                onOnionSkinChange: (enabled) => this.setOnionSkin(enabled)
            });
            
            // 初期ハイライト
            this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, 0);
            this.uiBuilder.highlightLayerPanel(this.layerPanel, 1);
            
            // レイヤーの表示状態を初期化
            this.updateLayerVisibilityUI();
        }
        
        /**
         * レイヤーの表示/非表示を切り替え
         */
        toggleLayerVisibility(layerIndex) {
            const frame = this.layerManager.getActiveFrame();
            const layer = frame.layers[layerIndex];
            layer.visible = !layer.visible;
            
            // UIを更新
            this.uiBuilder.updateLayerVisibility(this.layerPanel, layerIndex, layer.visible);
            
            // フレームサムネイルを更新
            this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
            
            // 現在編集中のレイヤーの表示を切り替えた場合は再読み込み
            if (layerIndex === this.layerManager.activeLayerIndex) {
                this.loadCurrentLayer();
            }
        }
        
        /**
         * レイヤーの不透明度を調整
         */
        adjustLayerOpacity(layerIndex, delta) {
            const frame = this.layerManager.getActiveFrame();
            const layer = frame.layers[layerIndex];
            
            // deltaが100未満の場合は相対的な変更、100以上の場合は絶対値
            if (Math.abs(delta) < 100) {
                layer.opacity = Math.max(0, Math.min(1, layer.opacity + (delta / 100)));
            } else {
                layer.opacity = Math.max(0, Math.min(1, delta / 100));
            }
            
            // UIを更新
            this.uiBuilder.updateLayerOpacity(this.layerPanel, layerIndex, layer.opacity);
            
            // フレームサムネイルを更新
            this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
        }
        
        /**
         * レイヤーの表示状態UIを更新
         */
        updateLayerVisibilityUI() {
            const frame = this.layerManager.getActiveFrame();
            frame.layers.forEach((layer, i) => {
                this.uiBuilder.updateLayerVisibility(this.layerPanel, i, layer.visible);
                this.uiBuilder.updateLayerOpacity(this.layerPanel, i, layer.opacity);
            });
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
            
            // オニオンスキン切替
            km.register('o', {}, () => {
                this.setOnionSkin(!this.onionSkinEnabled);
                const checkbox = document.getElementById('onion-skin-check');
                if (checkbox) checkbox.checked = this.onionSkinEnabled;
            }, 'Toggle onion skin');
            
            // キーボードマネージャーを有効化
            km.attach();
        }
        
        /**
         * マウスダウンハンドラ
         */
        handleMouseDown(e) {
            if (this.isPreviewMode) return; // プレビュー中は描画不可
            
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
            if (this.isPreviewMode) return; // プレビュー中は描画不可
            this.drawingEngine.draw(e.clientX, e.clientY);
        }
        
        /**
         * マウスアップハンドラ
         */
        handleMouseUp() {
            if (this.isPreviewMode) return; // プレビュー中は描画不可
            
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
            if (this.isPreviewMode) return; // プレビュー中は切替不可
            
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // フレームを切替
            this.layerManager.switchFrame(frameIndex);
            
            // 新しいフレームのレイヤーを読み込み
            this.loadCurrentLayer();
            
            // UIを更新
            this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, frameIndex);
            this.updateLayerPanelThumbnails();
            this.updateLayerVisibilityUI();
            this.uiBuilder.updateLayerPanelHeader(frameIndex);
        }
        
        /**
         * レイヤー切替
         */
        switchLayer(layerIndex) {
            if (layerIndex === this.layerManager.activeLayerIndex) return;
            if (this.isPreviewMode) return; // プレビュー中は切替不可
            
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
            if (this.isPreviewMode) return; // プレビュー中は操作不可
            
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
            if (this.isPreviewMode) return; // プレビュー中は操作不可
            
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
         * プレビューモードの切り替え
         */
        togglePreview() {
            if (this.isPreviewMode) {
                this.stopPreview();
            } else {
                this.startPreview();
            }
        }
        
        /**
         * プレビュー開始
         */
        startPreview() {
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            this.isPreviewMode = true;
            this.previewFrameIndex = 0;
            
            // 合成フレームを取得
            const compositeFrames = this.layerManager.getCompositeFrames();
            
            // アニメーション開始
            this.previewIntervalId = setInterval(() => {
                const imageData = compositeFrames[this.previewFrameIndex];
                this.canvasManager.putImageData(imageData);
                
                this.previewFrameIndex = (this.previewFrameIndex + 1) % compositeFrames.length;
            }, this.frameDelay);
            
            console.log('✅ Preview started');
        }
        
        /**
         * プレビュー停止
         */
        stopPreview() {
            if (this.previewIntervalId) {
                clearInterval(this.previewIntervalId);
                this.previewIntervalId = null;
            }
            
            this.isPreviewMode = false;
            
            // 元のレイヤーを復元
            this.loadCurrentLayer();
            
            console.log('✅ Preview stopped');
        }
        
        /**
         * フレームを追加
         */
        addFrame() {
            if (this.isPreviewMode) return; // プレビュー中は操作不可
            
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // 現在のフレームの右に新しいフレームを挿入
            this.layerManager.addFrameAfter(this.layerManager.activeFrameIndex);
            this.historyManager.addFrame();
            
            // UIを再構築
            this.rebuildFrameThumbnails();
            
            // 新しいフレームに切り替え
            this.switchFrame(this.layerManager.activeFrameIndex + 1);
        }
        
        /**
         * フレームをコピー
         */
        copyFrame() {
            if (this.isPreviewMode) return; // プレビュー中は操作不可
            
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
            // 現在のフレームをコピー
            this.layerManager.copyFrameAfter(this.layerManager.activeFrameIndex);
            this.historyManager.addFrame();
            
            // UIを再構築
            this.rebuildFrameThumbnails();
            
            // 新しいフレームに切り替え
            this.switchFrame(this.layerManager.activeFrameIndex + 1);
        }
        
        /**
         * フレームを削除
         */
        deleteFrame() {
            if (this.isPreviewMode) return; // プレビュー中は操作不可
            
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
            const oldContainer = this.frameThumbnails[0]?.parentElement?.parentElement;
            if (oldContainer) {
                oldContainer.remove();
            }
            
            // 新しいサムネイルを作成
            const thumbnailData = this.uiBuilder.createFrameThumbnails(
                this.layerManager.frameCount,
                (index) => this.switchFrame(index),
                () => this.addFrame(),
                () => this.deleteFrame(),
                () => this.copyFrame()
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
            // 現在のレイヤーを保存
            this.saveCurrentLayer();
            
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
         * APNGとしてエクスポート
         */
        async exportAsApng() {
            // プレビューを停止
            if (this.isPreviewMode) {
                this.stopPreview();
            }
            
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
            // プレビューを停止
            if (this.isPreviewMode) {
                this.stopPreview();
            }
            
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
            // プレビューを停止
            if (this.isPreviewMode) {
                this.stopPreview();
            }
            
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