// ========================================
// tegaki_anime_core.js - メインクラス（改修版）
// バケツツール対応・オニオンスキンレベル対応
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
            this.onionSkinLevel = 0; // 0:無効, 1-3:表示数
            
            // ペンスロット（3つ）
            this.penSlots = [
                { size: 2, active: true },
                { size: 5, active: false },
                { size: 10, active: false }
            ];
            this.activePenSlotIndex = 0;
            
            // 消しゴムスロット（3つ）
            this.eraserSlots = [
                { size: 10, active: true },
                { size: 20, active: false },
                { size: 30, active: false }
            ];
            this.activeEraserSlotIndex = 0;
            
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
            
            // 初期表示（合成表示で開始）
            this.saveInitialHistory();
            this.loadCurrentFrameComposite();
            this.updateAllThumbnails();
        }
        
        /**
         * 初期履歴を保存
         */
        saveInitialHistory() {
            for (let f = 0; f < this.layerManager.frameCount; f++) {
                for (let l = 0; l < this.layerManager.layerCountPerFrame; l++) {
                    const imageData = this.layerManager.getLayerImageData(f, l);
                    if (imageData) {
                        this.historyManager.pushHistory(f, l, imageData);
                    }
                }
            }
        }
        
        /**
         * UIの構築
         */
        buildUI() {
            // メインレイアウト
            this.uiBuilder.createMainLayout();
            
            // ショートカットパネル
            this.uiBuilder.createShortcutPanel();
            
            // キャンバスエリア
            const canvas = this.canvasManager.canvas;
            const bgCanvas = this.canvasManager.bgCanvas;
            const centerArea = this.uiBuilder.createCanvasArea(canvas, bgCanvas);
            
            // フレームサムネイル
            const thumbnailData = this.uiBuilder.createFrameThumbnails(
                this.layerManager.frameCount,
                (index) => this.switchFrame(index),
                () => this.addFrame(),
                () => this.deleteFrame(),
                () => this.copyFrame()
            );
            this.frameThumbnails = thumbnailData.thumbnails;
            centerArea.appendChild(thumbnailData.container);
            
            // レイヤーパネル
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
                onDelayChange: (delay) => this.setFrameDelay(delay),
                onPreview: () => this.togglePreview(),
                onOnionSkinChange: (level) => this.setOnionSkin(level),
                penSlots: this.penSlots,
                onPenSlotClick: (index) => this.switchPenSlotDirect(index),
                onPenSizeChange: (delta) => this.adjustPenSize(delta),
                eraserSlots: this.eraserSlots,
                onEraserSlotClick: (index) => this.switchEraserSlotDirect(index),
                onEraserSizeChange: (delta) => this.adjustEraserSize(delta)
            });
            
            // 初期ハイライト
            this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, 0);
            this.uiBuilder.highlightLayerPanel(this.layerPanel, 1);
            
            // レイヤーの表示状態を初期化
            this.updateLayerVisibilityUI();
        }
        
        /**
         * ペンスロット直接切替
         */
        switchPenSlotDirect(index) {
            if (index === this.activePenSlotIndex) return;
            
            this.penSlots[this.activePenSlotIndex].active = false;
            this.activePenSlotIndex = index;
            this.penSlots[this.activePenSlotIndex].active = true;
            
            const newSize = this.penSlots[this.activePenSlotIndex].size;
            this.setPenSize(newSize);
            
            this.uiBuilder.updatePenSlots(this.penSlots, this.activePenSlotIndex);
        }
        
        /**
         * ペンスロット切替（[/]キー用）
         */
        switchPenSlot(direction) {
            if (this.drawingEngine.currentTool !== 'pen') return;
            
            this.penSlots[this.activePenSlotIndex].active = false;
            
            this.activePenSlotIndex = 
                (this.activePenSlotIndex + direction + this.penSlots.length) 
                % this.penSlots.length;
            
            this.penSlots[this.activePenSlotIndex].active = true;
            
            const newSize = this.penSlots[this.activePenSlotIndex].size;
            this.setPenSize(newSize);
            
            this.uiBuilder.updatePenSlots(this.penSlots, this.activePenSlotIndex);
        }
        
        /**
         * ペンサイズ調整
         */
        adjustPenSize(delta) {
            const newSize = Math.max(1, Math.min(20, 
                this.penSlots[this.activePenSlotIndex].size + delta));
            
            this.penSlots[this.activePenSlotIndex].size = newSize;
            this.setPenSize(newSize);
            
            this.uiBuilder.updatePenSlots(this.penSlots, this.activePenSlotIndex);
        }
        
        /**
         * 消しゴムスロット直接切替
         */
        switchEraserSlotDirect(index) {
            if (index === this.activeEraserSlotIndex) return;
            
            this.eraserSlots[this.activeEraserSlotIndex].active = false;
            this.activeEraserSlotIndex = index;
            this.eraserSlots[this.activeEraserSlotIndex].active = true;
            
            const newSize = this.eraserSlots[this.activeEraserSlotIndex].size;
            this.setEraserSize(newSize);
            
            this.uiBuilder.updateEraserSlots(this.eraserSlots, this.activeEraserSlotIndex);
        }
        
        /**
         * 消しゴムスロット切替（[/]キー用）
         */
        switchEraserSlot(direction) {
            if (this.drawingEngine.currentTool !== 'eraser') return;
            
            this.eraserSlots[this.activeEraserSlotIndex].active = false;
            
            this.activeEraserSlotIndex = 
                (this.activeEraserSlotIndex + direction + this.eraserSlots.length) 
                % this.eraserSlots.length;
            
            this.eraserSlots[this.activeEraserSlotIndex].active = true;
            
            const newSize = this.eraserSlots[this.activeEraserSlotIndex].size;
            this.setEraserSize(newSize);
            
            this.uiBuilder.updateEraserSlots(this.eraserSlots, this.activeEraserSlotIndex);
        }
        
        /**
         * 消しゴムサイズ調整
         */
        adjustEraserSize(delta) {
            const newSize = Math.max(1, Math.min(50, 
                this.eraserSlots[this.activeEraserSlotIndex].size + delta));
            
            this.eraserSlots[this.activeEraserSlotIndex].size = newSize;
            this.setEraserSize(newSize);
            
            this.uiBuilder.updateEraserSlots(this.eraserSlots, this.activeEraserSlotIndex);
        }
        
        /**
         * レイヤーの表示/非表示を切り替え
         */
        toggleLayerVisibility(layerIndex) {
            const frame = this.layerManager.getActiveFrame();
            const layer = frame.layers[layerIndex];
            layer.visible = !layer.visible;
            
            this.uiBuilder.updateLayerVisibility(this.layerPanel, layerIndex, layer.visible);
            this.refreshDisplay();
        }
        
        /**
         * レイヤーの不透明度を調整
         */
        adjustLayerOpacity(layerIndex, delta) {
            const frame = this.layerManager.getActiveFrame();
            const layer = frame.layers[layerIndex];
            
            if (Math.abs(delta) < 100) {
                layer.opacity = Math.max(0, Math.min(1, layer.opacity + (delta / 100)));
            } else {
                layer.opacity = Math.max(0, Math.min(1, delta / 100));
            }
            
            this.uiBuilder.updateLayerOpacity(this.layerPanel, layerIndex, layer.opacity);
            this.refreshDisplay();
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
            
            canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            canvas.addEventListener('mouseup', () => this.handleMouseUp());
            canvas.addEventListener('mouseleave', () => this.handleMouseUp());
            
            // タッチイベント
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
            km.register('i', {}, () => this.setTool('eyedropper'), 'Eyedropper tool');
            
            // スロット切替
            km.register('[', {}, () => {
                if (this.drawingEngine.currentTool === 'pen') {
                    this.switchPenSlot(-1);
                } else if (this.drawingEngine.currentTool === 'eraser') {
                    this.switchEraserSlot(-1);
                }
            }, 'Previous tool slot');
            
            km.register(']', {}, () => {
                if (this.drawingEngine.currentTool === 'pen') {
                    this.switchPenSlot(1);
                } else if (this.drawingEngine.currentTool === 'eraser') {
                    this.switchEraserSlot(1);
                }
            }, 'Next tool slot');
            
            // オニオンスキン切替（0→1→2→3→0）
            km.register('o', {}, () => {
                this.onionSkinLevel = (this.onionSkinLevel + 1) % 4;
                this.setOnionSkin(this.onionSkinLevel);
                // UIのボタンを更新
                const btn = document.getElementById(`onion-btn-${this.onionSkinLevel}`);
                if (btn) btn.click();
            }, 'Toggle onion skin');
            
            km.attach();
        }
        
        /**
         * マウスダウンハンドラ
         */
        handleMouseDown(e) {
            if (this.isPreviewMode) return;
            
            this.loadCurrentLayerOnly();
            
            const shouldPushHistory = this.drawingEngine.startDrawing(e.clientX, e.clientY);
            
            if (shouldPushHistory) {
                this.handleDrawingComplete();
            }
        }
        
        /**
         * マウスムーブハンドラ
         */
        handleMouseMove(e) {
            if (this.isPreviewMode) return;
            this.drawingEngine.draw(e.clientX, e.clientY);
        }
        
        /**
         * マウスアップハンドラ
         */
        handleMouseUp() {
            if (this.isPreviewMode) return;
            
            const shouldPushHistory = this.drawingEngine.stopDrawing();
            
            if (shouldPushHistory) {
                this.handleDrawingComplete();
            }
        }
        
        /**
         * 描画完了時の統一処理
         */
        handleDrawingComplete() {
            this.saveCurrentLayerFromCanvas();
            
            const imageData = this.layerManager.getActiveLayerImageData();
            this.historyManager.pushHistory(
                this.layerManager.activeFrameIndex,
                this.layerManager.activeLayerIndex,
                imageData
            );
            
            this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
            this.updateLayerPanelThumbnails();
            
            this.loadCurrentFrameComposite();
        }
        
        /**
         * 現在のレイヤーのみをキャンバスに表示
         */
        loadCurrentLayerOnly() {
            const imageData = this.layerManager.getActiveLayerImageData();
            this.canvasManager.clearCanvas();
            this.canvasManager.putImageData(imageData);
        }
        
        /**
         * キャンバスの内容を現在のレイヤーに保存
         */
        saveCurrentLayerFromCanvas() {
            const imageData = this.canvasManager.getImageData();
            this.layerManager.setActiveLayerImageData(imageData);
        }
        
        /**
         * 現在のフレームの合成表示をキャンバスに読み込み
         */
        loadCurrentFrameComposite() {
            const compositeData = this.layerManager.getCompositeImageData(
                this.layerManager.activeFrameIndex
            );
            if (compositeData) {
                this.canvasManager.clearCanvas();
                this.canvasManager.putImageData(compositeData);
            }
        }
        
        /**
         * 表示を更新
         */
        refreshDisplay() {
            if (!this.drawingEngine.isDrawing) {
                this.loadCurrentFrameComposite();
                this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
                this.updateLayerPanelThumbnails();
            }
        }
        
        /**
         * フレーム切替
         */
        switchFrame(frameIndex) {
            if (frameIndex === this.layerManager.activeFrameIndex) return;
            if (this.isPreviewMode) return;
            
            this.layerManager.switchFrame(frameIndex);
            this.loadCurrentFrameComposite();
            
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
            if (this.isPreviewMode) return;
            
            this.layerManager.switchLayer(layerIndex);
            this.loadCurrentFrameComposite();
            
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
            if (this.isPreviewMode) return;
            
            const imageData = this.historyManager.undo(
                this.layerManager.activeFrameIndex,
                this.layerManager.activeLayerIndex
            );
            
            if (imageData) {
                this.layerManager.setActiveLayerImageData(imageData);
                
                this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
                this.updateLayerPanelThumbnails();
                
                this.loadCurrentFrameComposite();
            }
        }
        
        /**
         * Redo
         */
        redo() {
            if (this.isPreviewMode) return;
            
            const imageData = this.historyManager.redo(
                this.layerManager.activeFrameIndex,
                this.layerManager.activeLayerIndex
            );
            
            if (imageData) {
                this.layerManager.setActiveLayerImageData(imageData);
                
                this.updateFrameThumbnail(this.layerManager.activeFrameIndex);
                this.updateLayerPanelThumbnails();
                
                this.loadCurrentFrameComposite();
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
                const size = this.eraserSlots[this.activeEraserSlotIndex].size;
                this.drawingEngine.setSize(size);
            } else if (tool === 'pen') {
                const size = this.penSlots[this.activePenSlotIndex].size;
                this.drawingEngine.setSize(size);
            }
            
            // UIのツールボタンを更新
            if (this.uiBuilder.toolButtons) {
                const toolIndex = tool === 'pen' ? 0 : tool === 'eraser' ? 1 : 2;
                this.uiBuilder.highlightToolButton(this.uiBuilder.toolButtons, toolIndex);
            }
        }
        
        /**
         * ペンサイズを設定
         */
        setPenSize(size) {
            if (this.drawingEngine.currentTool === 'pen') {
                this.drawingEngine.setSize(size);
            }
        }
        
        /**
         * 消しゴムサイズを設定
         */
        setEraserSize(size) {
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
         * オニオンスキンを設定（レベル対応）
         */
        setOnionSkin(level) {
            this.onionSkinLevel = level;
            console.log(`オニオンスキンレベル: ${level}`);
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
            this.isPreviewMode = true;
            this.previewFrameIndex = 0;
            
            const compositeFrames = this.layerManager.getCompositeFrames();
            
            this.previewIntervalId = setInterval(() => {
                const imageData = compositeFrames[this.previewFrameIndex];
                if (imageData) {
                    this.canvasManager.clearCanvas();
                    this.canvasManager.putImageData(imageData);
                }
                
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
            this.loadCurrentFrameComposite();
            
            console.log('✅ Preview stopped');
        }
        
        /**
         * フレームを追加
         */
        addFrame() {
            if (this.isPreviewMode) return;
            
            this.layerManager.addFrameAfter(this.layerManager.activeFrameIndex);
            this.historyManager.addFrame();
            
            const newFrameIndex = this.layerManager.activeFrameIndex + 1;
            for (let l = 0; l < this.layerManager.layerCountPerFrame; l++) {
                const imageData = this.layerManager.getLayerImageData(newFrameIndex, l);
                if (imageData) {
                    this.historyManager.pushHistory(newFrameIndex, l, imageData);
                }
            }
            
            this.rebuildFrameThumbnails();
            this.switchFrame(newFrameIndex);
        }
        
        /**
         * フレームをコピー
         */
        copyFrame() {
            if (this.isPreviewMode) return;
            
            this.layerManager.copyFrameAfter(this.layerManager.activeFrameIndex);
            this.historyManager.addFrame();
            
            const newFrameIndex = this.layerManager.activeFrameIndex + 1;
            for (let l = 0; l < this.layerManager.layerCountPerFrame; l++) {
                const imageData = this.layerManager.getLayerImageData(newFrameIndex, l);
                if (imageData) {
                    this.historyManager.pushHistory(newFrameIndex, l, imageData);
                }
            }
            
            this.rebuildFrameThumbnails();
            this.switchFrame(newFrameIndex);
        }
        
        /**
         * フレームを削除
         */
        deleteFrame() {
            if (this.isPreviewMode) return;
            
            if (this.layerManager.frameCount <= 1) {
                alert('最後のフレームは削除できません');
                return;
            }
            
            const currentIndex = this.layerManager.activeFrameIndex;
            
            if (confirm(`フレーム ${currentIndex + 1} を削除しますか？`)) {
                this.layerManager.deleteFrame(currentIndex);
                this.historyManager.deleteFrame(currentIndex);
                
                this.rebuildFrameThumbnails();
                
                const newIndex = Math.min(currentIndex, this.layerManager.frameCount - 1);
                this.layerManager.activeFrameIndex = newIndex;
                this.loadCurrentFrameComposite();
                this.uiBuilder.highlightFrameThumbnail(this.frameThumbnails, newIndex);
                this.updateAllThumbnails();
                this.updateLayerVisibilityUI();
            }
        }
        
        /**
         * フレームサムネイルを再構築
         */
        rebuildFrameThumbnails() {
            const oldContainer = this.frameThumbnails[0]?.parentElement?.parentElement;
            if (oldContainer) {
                oldContainer.remove();
            }
            
            const thumbnailData = this.uiBuilder.createFrameThumbnails(
                this.layerManager.frameCount,
                (index) => this.switchFrame(index),
                () => this.addFrame(),
                () => this.deleteFrame(),
                () => this.copyFrame()
            );
            this.frameThumbnails = thumbnailData.thumbnails;
            
            const centerArea = this.uiBuilder.wrapper.children[0].children[1];
            centerArea.appendChild(thumbnailData.container);
            
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
            if (frameIndex < 0 || frameIndex >= this.layerManager.frameCount) return;
            if (!this.frameThumbnails[frameIndex]) return;
            
            const compositeData = this.layerManager.getCompositeImageData(frameIndex);
            if (compositeData) {
                this.uiBuilder.updateFrameThumbnail(
                    this.frameThumbnails[frameIndex],
                    compositeData
                );
            }
        }
        
        /**
         * レイヤーパネルのサムネイルを更新
         */
        updateLayerPanelThumbnails() {
            const frame = this.layerManager.getActiveFrame();
            if (!frame) return;
            
            for (let i = 0; i < frame.layers.length; i++) {
                const layer = frame.layers[i];
                if (this.layerPanel[i] && this.layerPanel[i].canvas) {
                    this.uiBuilder.updateLayerThumbnail(
                        this.layerPanel[i].canvas,
                        layer.imageData
                    );
                }
            }
        }
        
        /**
         * APNGとしてエクスポート
         */
        async exportAsApng() {
            if (this.isPreviewMode) {
                this.stopPreview();
            }
            
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
            if (this.isPreviewMode) {
                this.stopPreview();
            }
            
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
            if (this.isPreviewMode) {
                this.stopPreview();
            }
            
            if (this.keyboardManager) {
                this.keyboardManager.destroy();
            }
            
            if (this.canvasManager) this.canvasManager.destroy();
            if (this.layerManager) this.layerManager.destroy();
            if (this.drawingEngine) this.drawingEngine.destroy();
            if (this.historyManager) this.historyManager.destroy();
            if (this.uiBuilder) this.uiBuilder.destroy();
            if (this.exportManager) this.exportManager.destroy();
            
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
    
    console.log('✅ TegakiAnimeCore (改修版) loaded');
})();