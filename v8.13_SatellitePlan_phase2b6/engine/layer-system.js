// ===== layer-system.js - Twin-Star Architecture Engine Star =====
// レイヤー管理・変形処理・履歴・クリップボード統合クラス
// PixiJS v8.13対応 / AI改修効率最大化

(function() {
    'use strict';

    // 依存関係チェック
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('layer-system.js requires config.js');
    }

    if (!window.CoordinateSystem) {
        throw new Error('layer-system.js requires coordinate-system.js');
    }

    // === レイヤー管理システム（完全版：変形・履歴・クリップボード統合） ===
    class LayerSystem {
        constructor(app, coordinateSystem) {
            this.app = app;
            this.coord = coordinateSystem;
            
            // レイヤーデータ
            this.layers = new Map();
            this.layerOrder = [];
            this.activeLayerId = null;
            this.layerCounter = 0;
            
            // レイヤーコンテナ（カメラシステムから取得）
            this.layersContainer = null;
            
            // レイヤー変形管理
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // 履歴管理
            this.history = [];
            this.historyIndex = -1;
            this.maxHistorySize = CONFIG.history?.maxSize || 50;
            
            // クリップボード
            this.clipboard = null;
            this.selection = null;
            
            // サムネイル更新キュー
            this.thumbnailUpdateQueue = new Set();
            
            // UI要素参照
            this.layerTransformPanel = null;
            
            // 初期化
            this.initialize();
        }

        initialize() {
            this.setupLayerTransformPanel();
            this.setupKeyboardEvents();
            this.setupMouseEvents();
            console.log('LayerSystem initialized');
        }

        // コンテナ設定（カメラシステムから呼び出し）
        setLayersContainer(container) {
            this.layersContainer = container;
        }

        // === レイヤー作成・削除・管理 ===
        createLayer(name, isBackground = false) {
            const id = `layer_${this.layerCounter++}`;
            
            const layer = {
                id: id,
                name: name || `Layer ${this.layers.size + 1}`,
                visible: true,
                opacity: 1.0,
                locked: false,
                isBackground: isBackground,
                
                // データ
                strokes: [],
                paths: [], // 既存互換性
                transform: {
                    position: { x: 0, y: 0 },
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    pivot: { x: 0, y: 0 }
                },
                
                // 表示用コンテナ
                container: new PIXI.Container(),
                
                // メタデータ
                created: Date.now(),
                modified: Date.now()
            };

            // 変形データ初期化
            this.layerTransforms.set(id, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            // 背景レイヤー特別処理
            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.container.addChild(bg);
                layer.backgroundGraphics = bg;
            }

            // 登録
            this.layers.set(id, layer);
            this.layerOrder.push(id);
            
            if (this.layersContainer) {
                this.layersContainer.addChild(layer.container);
            }

            // アクティブに設定
            this.setActiveLayer(id);

            // 履歴記録
            this.recordHistory('create', { layerId: id, layer: layer });

            // UI更新
            this.updateLayerPanelUI();
            this.updateStatusDisplay();

            return { layer, index: this.layerOrder.length - 1 };
        }

        deleteLayer(id) {
            if (this.layers.size <= 1) return; // 最後のレイヤーは削除不可

            const layer = this.layers.get(id);
            if (!layer) return;

            // コンテナ削除
            if (this.layersContainer && layer.container.parent === this.layersContainer) {
                this.layersContainer.removeChild(layer.container);
            }
            layer.container.destroy(true);

            // データ削除
            this.layers.delete(id);
            this.layerTransforms.delete(id);
            const index = this.layerOrder.indexOf(id);
            this.layerOrder.splice(index, 1);

            // アクティブレイヤー更新
            if (this.activeLayerId === id) {
                const newActiveIndex = Math.max(0, index - 1);
                const newActiveId = this.layerOrder[newActiveIndex];
                this.setActiveLayer(newActiveId);
            }

            // 履歴記録
            this.recordHistory('delete', { layerId: id, layer: layer });

            // UI更新
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
        }

        setActiveLayer(id) {
            if (!this.layers.has(id)) return;

            this.activeLayerId = id;
            this.updateLayerPanelUI();
            this.updateStatusDisplay();

            // レイヤー移動モードが有効な場合、スライダー値を更新
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
        }

        getActiveLayer() {
            return this.layers.get(this.activeLayerId);
        }

        getLayer(id) {
            return this.layers.get(id);
        }

        getAllLayers() {
            return this.layerOrder.map(id => this.layers.get(id));
        }

        // === レイヤー変形処理 ===
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }

            const transform = this.layerTransforms.get(layerId);
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;

            switch(property) {
                case 'x':
                    transform.x = value;
                    activeLayer.container.position.set(centerX + value, centerY + transform.y);
                    break;
                case 'y':
                    transform.y = value;
                    activeLayer.container.position.set(centerX + transform.x, centerY + value);
                    break;
                case 'rotation':
                    transform.rotation = value;
                    activeLayer.container.pivot.set(centerX, centerY);
                    activeLayer.container.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.container.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    
                    activeLayer.container.pivot.set(centerX, centerY);
                    activeLayer.container.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.container.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }

            this.requestThumbnailUpdate(this.getLayerIndex(layerId));
        }

        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.id;
            const transform = this.layerTransforms.get(layerId);
            if (!transform) return;

            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;

            activeLayer.container.pivot.set(centerX, centerY);
            activeLayer.container.position.set(centerX + transform.x, centerY + transform.y);

            if (direction === 'horizontal') {
                transform.scaleX *= -1;
                activeLayer.container.scale.x = transform.scaleX;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
                activeLayer.container.scale.y = transform.scaleY;
            }

            this.requestThumbnailUpdate(this.getLayerIndex(layerId));
        }

        // === レイヤー変形確定処理 ===
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.id;
            const transform = this.layerTransforms.get(layerId);

            if (this.isTransformNonDefault(transform)) {
                try {
                    // パスデータに変形を適用
                    this.applyTransformToLayerData(activeLayer, transform);

                    // 表示変形をリセット
                    activeLayer.container.position.set(0, 0);
                    activeLayer.container.rotation = 0;
                    activeLayer.container.scale.set(1, 1);
                    activeLayer.container.pivot.set(0, 0);

                    // 変形データをクリア
                    this.layerTransforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });

                    // 履歴記録
                    this.recordHistory('confirmTransform', { layerId: layerId });
                    
                    this.requestThumbnailUpdate(this.getLayerIndex(layerId));
                } catch (error) {
                    console.error('Transform confirmation failed:', error);
                }
            }
        }

        applyTransformToLayerData(layer, transform) {
            if (!layer.strokes && !layer.paths) return;

            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;

            // 変形行列作成
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);

            // ストロークに変形適用
            if (layer.strokes) {
                layer.strokes.forEach(stroke => {
                    if (stroke.points) {
                        stroke.points = stroke.points.map(point => matrix.apply(point));
                    }
                });
            }

            // パスに変形適用（互換性）
            if (layer.paths) {
                layer.paths.forEach(path => {
                    if (path.points) {
                        path.points = path.points.map(point => matrix.apply(point));
                    }
                });
            }

            // レイヤー再構築
            this.rebuildLayerGraphics(layer);
        }

        rebuildLayerGraphics(layer) {
            // 既存グラフィックスをクリア（背景は保護）
            const childrenToRemove = [];
            for (let child of layer.container.children) {
                if (child !== layer.backgroundGraphics) {
                    childrenToRemove.push(child);
                }
            }

            childrenToRemove.forEach(child => {
                layer.container.removeChild(child);
                if (child.destroy) {
                    child.destroy();
                }
            });

            // ストロークを再構築
            if (layer.strokes) {
                layer.strokes.forEach(stroke => {
                    this.rebuildStrokeGraphics(stroke, layer);
                });
            }

            // パスを再構築（互換性）
            if (layer.paths) {
                layer.paths.forEach(path => {
                    this.rebuildPathGraphics(path, layer);
                });
            }
        }

        rebuildStrokeGraphics(stroke, layer) {
            if (!stroke.points || stroke.points.length === 0) return;

            const graphics = new PIXI.Graphics();
            
            // ストロークを描画
            stroke.points.forEach(point => {
                graphics.circle(point.x, point.y, (stroke.size || 5) / 2);
                graphics.fill({
                    color: stroke.color || 0x800000,
                    alpha: stroke.opacity || 1.0
                });
            });

            stroke.graphics = graphics;
            layer.container.addChild(graphics);
        }

        rebuildPathGraphics(path, layer) {
            if (!path.points || path.points.length === 0) return;

            const graphics = new PIXI.Graphics();
            
            // パスを描画
            path.points.forEach(point => {
                graphics.circle(point.x, point.y, (path.size || 5) / 2);
                graphics.fill({
                    color: path.color || 0x800000,
                    alpha: path.opacity || 1.0
                });
            });

            path.graphics = graphics;
            layer.container.addChild(graphics);
        }

        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }

        // === レイヤー移動モード ===
        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;

            this.isLayerMoveMode = true;
            this.vKeyPressed = true;

            // パネル表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }

            this.updateCursor();
        }

        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;

            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;

            // パネル非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }

            this.updateCursor();
            
            // 変形確定
            this.confirmLayerTransform();
        }

        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }

        updateCursor() {
            if (this.vKeyPressed && this.app.canvas) {
                this.app.canvas.style.cursor = 'grab';
            }
        }

        // === 履歴管理 ===
        recordHistory(action, data) {
            // 現在位置より後の履歴を削除
            this.history = this.history.slice(0, this.historyIndex + 1);

            // 新規履歴追加
            this.history.push({
                action: action,
                data: data,
                timestamp: Date.now()
            });

            // サイズ制限
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
            } else {
                this.historyIndex++;
            }
        }

        undo() {
            if (this.historyIndex < 0) return;

            const entry = this.history[this.historyIndex];
            this.applyHistoryReverse(entry);
            this.historyIndex--;
        }

        redo() {
            if (this.historyIndex >= this.history.length - 1) return;

            this.historyIndex++;
            const entry = this.history[this.historyIndex];
            this.applyHistory(entry);
        }

        applyHistoryReverse(entry) {
            // 履歴の逆操作を実装
            switch(entry.action) {
                case 'create':
                    this.deleteLayer(entry.data.layerId);
                    break;
                case 'delete':
                    // レイヤーの復元処理
                    this.restoreLayer(entry.data.layer);
                    break;
                case 'stroke':
                    // ストロークの削除
                    this.removeStroke(entry.data.layerId, entry.data.stroke.id);
                    break;
            }
        }

        applyHistory(entry) {
            // 履歴の再適用を実装
            switch(entry.action) {
                case 'create':
                    this.restoreLayer(entry.data.layer);
                    break;
                case 'delete':
                    this.deleteLayer(entry.data.layerId);
                    break;
                case 'stroke':
                    // ストロークの追加
                    this.addStrokeToLayer(entry.data.layerId, entry.data.stroke);
                    break;
            }
        }

        // === クリップボード操作 ===
        copySelection() {
            const layer = this.getActiveLayer();
            if (!layer) return;

            if (this.selection) {
                // 選択範囲内のデータをコピー
                this.clipboard = this.getDataInSelection(layer, this.selection);
            } else {
                // レイヤー全体をコピー
                this.clipboard = this.deepCopyLayer(layer);
            }
        }

        paste() {
            if (!this.clipboard) return;

            const layer = this.getActiveLayer();
            if (!layer) return;

            // クリップボードデータをレイヤーに追加
            this.addClipboardDataToLayer(layer, this.clipboard);
            
            // 履歴記録
            this.recordHistory('paste', {
                layerId: layer.id,
                data: this.clipboard
            });
        }

        deepCopyLayer(layer) {
            return {
                strokes: layer.strokes ? layer.strokes.map(stroke => ({
                    ...stroke,
                    points: stroke.points ? [...stroke.points] : []
                })) : [],
                paths: layer.paths ? layer.paths.map(path => ({
                    ...path,
                    points: path.points ? [...path.points] : []
                })) : []
            };
        }

        // === UI関連処理 ===
        setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            // UI パネルの初期化は ui-core.js で実装
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // V キー: レイヤー移動モード切り替え
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }

                // Ctrl+Z: アンドゥ
                if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
                    this.undo();
                    e.preventDefault();
                }

                // Ctrl+Y: リドゥ
                if (e.ctrlKey && e.code === 'KeyY') {
                    this.redo();
                    e.preventDefault();
                }

                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC') {
                    this.copySelection();
                    e.preventDefault();
                }

                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV') {
                    this.paste();
                    e.preventDefault();
                }
            });
        }

        setupMouseEvents() {
            if (!this.app || !this.app.canvas) return;

            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    e.preventDefault();
                }
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    const dx = e.clientX - this.layerDragLastPoint.x;
                    const dy = e.clientY - this.layerDragLastPoint.y;

                    this.handleLayerDrag(dx, dy, e.shiftKey);
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                }
            });

            this.app.canvas.addEventListener('pointerup', () => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }

        handleLayerDrag(dx, dy, shiftPressed) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };

            if (shiftPressed) {
                // 拡縮・回転
                if (Math.abs(dy) > Math.abs(dx)) {
                    // 拡縮
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(CONFIG.layer.minScale, 
                                            Math.min(CONFIG.layer.maxScale, currentScale * scaleFactor));
                    
                    this.updateActiveLayerTransform('scale', newScale);
                } else {
                    // 回転
                    const rotationDelta = dx * 0.02;
                    this.updateActiveLayerTransform('rotation', transform.rotation + rotationDelta);
                }
            } else {
                // 移動
                this.updateActiveLayerTransform('x', transform.x + dx);
                this.updateActiveLayerTransform('y', transform.y + dy);
            }
        }

        // === レイヤーパネル UI ===
        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';

            // レイヤーを逆順で表示
            for (let i = this.layerOrder.length - 1; i >= 0; i--) {
                const layerId = this.layerOrder[i];
                const layer = this.layers.get(layerId);
                if (!layer) continue;

                const layerItem = this.createLayerItem(layer, i);
                layerList.appendChild(layerItem);
            }

            // サムネイル更新をキューに追加
            this.layerOrder.forEach((layerId, index) => {
                this.requestThumbnailUpdate(index);
            });
        }

        createLayerItem(layer, index) {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            layerItem.dataset.layerIndex = index;

            layerItem.innerHTML = `
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${layer.visible ? 
                            '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                            '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/>'}
                    </svg>
                </div>
                <div class="layer-name">${layer.name}</div>
                <div class="layer-thumbnail">
                    <div class="layer-thumbnail-placeholder"></div>
                </div>
            `;

            // イベントリスナー
            layerItem.addEventListener('click', (e) => {
                if (e.target.closest('.layer-visibility')) {
                    this.toggleLayerVisibility(layer.id);
                } else {
                    this.setActiveLayer(layer.id);
                }
            });

            return layerItem;
        }

        toggleLayerVisibility(layerId) {
            const layer = this.layers.get(layerId);
            if (!layer) return;

            layer.visible = !layer.visible;
            layer.container.visible = layer.visible;
            
            this.updateLayerPanelUI();
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerId) {
                const layer = this.layers.get(this.activeLayerId);
                statusElement.textContent = layer ? layer.name : '';
            }
        }

        updateLayerTransformPanelValues() {
            // UI パネルの値更新は ui-core.js で実装
        }

        // === サムネイル管理 ===
        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        }

        updateThumbnail(layerIndex) {
            const layerId = this.layerOrder[layerIndex];
            const layer = this.layers.get(layerId);
            if (!layer) return;

            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layerOrder.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // サムネイル生成
                const canvasAspectRatio = CONFIG.canvas.width / CONFIG.canvas.height;
                const maxSize = CONFIG.thumbnail?.SIZE || 48;
                
                let thumbnailWidth = maxSize;
                let thumbnailHeight = maxSize;
                
                if (canvasAspectRatio !== 1) {
                    if (canvasAspectRatio > 1) {
                        thumbnailHeight = maxSize / canvasAspectRatio;
                    } else {
                        thumbnailWidth = maxSize * canvasAspectRatio;
                    }
                }

                // レンダーテクスチャ作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: CONFIG.canvas.width * (CONFIG.thumbnail?.RENDER_SCALE || 2),
                    height: CONFIG.canvas.height * (CONFIG.thumbnail?.RENDER_SCALE || 2),
                    resolution: CONFIG.thumbnail?.RENDER_SCALE || 2
                });

                // レイヤーの一時的なコピーを作成してレンダリング
                const tempContainer = new PIXI.Container();
                
                // 現在の変形状態を保存
                const originalPos = { x: layer.container.position.x, y: layer.container.position.y };
                const originalScale = { x: layer.container.scale.x, y: layer.container.scale.y };
                const originalRotation = layer.container.rotation;
                const originalPivot = { x: layer.container.pivot.x, y: layer.container.pivot.y };

                // サムネイル用に変形をリセット
                layer.container.position.set(0, 0);
                layer.container.scale.set(1, 1);
                layer.container.rotation = 0;
                layer.container.pivot.set(0, 0);

                tempContainer.addChild(layer.container);
                tempContainer.scale.set(CONFIG.thumbnail?.RENDER_SCALE || 2);

                // レンダリング実行
                this.app.renderer.render(tempContainer, { renderTexture });

                // 変形状態を復元
                layer.container.position.set(originalPos.x, originalPos.y);
                layer.container.scale.set(originalScale.x, originalScale.y);
                layer.container.rotation = originalRotation;
                layer.container.pivot.set(originalPivot.x, originalPivot.y);

                // レイヤーを元のコンテナに戻す
                tempContainer.removeChild(layer.container);
                if (this.layersContainer) {
                    this.layersContainer.addChildAt(layer.container, layerIndex);
                }

                // Canvas APIで高品質ダウンスケール
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);

                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = CONFIG.thumbnail?.QUALITY || 'high';
                ctx.drawImage(sourceCanvas, 0, 0, Math.round(thumbnailWidth), Math.round(thumbnailHeight));

                // UI更新
                let img = thumbnail.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    thumbnail.innerHTML = '';
                    thumbnail.appendChild(img);
                }
                img.src = targetCanvas.toDataURL();
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';

                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();

            } catch (error) {
                console.warn('Thumbnail update failed:', error);
            }
        }

        // === ユーティリティメソッド ===
        getLayerIndex(layerId) {
            return this.layerOrder.indexOf(layerId);
        }

        addStrokeToLayer(layerId, stroke) {
            const layer = this.layers.get(layerId);
            if (!layer) return;

            layer.strokes = layer.strokes || [];
            layer.strokes.push(stroke);

            // グラフィックスを再構築
            this.rebuildStrokeGraphics(stroke, layer);
            
            this.requestThumbnailUpdate(this.getLayerIndex(layerId));
        }

        removeStroke(layerId, strokeId) {
            const layer = this.layers.get(layerId);
            if (!layer || !layer.strokes) return;

            const strokeIndex = layer.strokes.findIndex(s => s.id === strokeId);
            if (strokeIndex >= 0) {
                const stroke = layer.strokes[strokeIndex];
                
                // グラフィックスを削除
                if (stroke.graphics && stroke.graphics.parent) {
                    stroke.graphics.parent.removeChild(stroke.graphics);
                    stroke.graphics.destroy();
                }
                
                layer.strokes.splice(strokeIndex, 1);
                this.requestThumbnailUpdate(this.getLayerIndex(layerId));
            }
        }

        restoreLayer(layerData) {
            // レイヤーの復元処理
            const layer = {
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                locked: layerData.locked || false,
                isBackground: layerData.isBackground || false,
                
                strokes: layerData.strokes || [],
                paths: layerData.paths || [],
                transform: layerData.transform || {
                    position: { x: 0, y: 0 },
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    pivot: { x: 0, y: 0 }
                },
                
                container: new PIXI.Container(),
                created: layerData.created || Date.now(),
                modified: Date.now()
            };

            // 変形データ復元
            this.layerTransforms.set(layer.id, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            // 背景レイヤー復元
            if (layer.isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.container.addChild(bg);
                layer.backgroundGraphics = bg;
            }

            // データ登録
            this.layers.set(layer.id, layer);
            this.layerOrder.push(layer.id);
            
            if (this.layersContainer) {
                this.layersContainer.addChild(layer.container);
            }

            // グラフィックス復元
            this.rebuildLayerGraphics(layer);

            // UI更新
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
        }

        getDataInSelection(layer, selection) {
            // 選択範囲内のデータを取得（実装は用途に応じて）
            return this.deepCopyLayer(layer);
        }

        addClipboardDataToLayer(layer, clipboardData) {
            // クリップボードデータをレイヤーに追加
            if (clipboardData.strokes) {
                layer.strokes = layer.strokes || [];
                layer.strokes.push(...clipboardData.strokes.map(stroke => ({
                    ...stroke,
                    id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    points: stroke.points ? [...stroke.points] : []
                })));
            }

            if (clipboardData.paths) {
                layer.paths = layer.paths || [];
                layer.paths.push(...clipboardData.paths.map(path => ({
                    ...path,
                    id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    points: path.points ? [...path.points] : []
                })));
            }

            // グラフィックス再構築
            this.rebuildLayerGraphics(layer);
            this.requestThumbnailUpdate(this.getLayerIndex(layer.id));
        }

        // === レイヤー移動・並び替え（SortableJS連携用） ===
        moveLayer(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            
            const layerId = this.layerOrder[oldIndex];
            this.layerOrder.splice(oldIndex, 1);
            this.layerOrder.splice(newIndex, 0, layerId);
            
            // コンテナの並び替え
            if (this.layersContainer) {
                const layer = this.layers.get(layerId);
                if (layer && layer.container) {
                    this.layersContainer.removeChild(layer.container);
                    this.layersContainer.addChildAt(layer.container, newIndex);
                }
            }
            
            this.updateLayerPanelUI();
        }

        // === 互換性メソッド（既存コードとの互換性維持） ===
        addPathToLayer(layerIndex, path) {
            const layerId = this.layerOrder[layerIndex];
            if (!layerId) return;

            const layer = this.layers.get(layerId);
            if (!layer) return;

            layer.paths = layer.paths || [];
            layer.paths.push(path);
            
            if (path.graphics) {
                layer.container.addChild(path.graphics);
            }
            
            this.requestThumbnailUpdate(layerIndex);
        }

        // === パフォーマンス最適化 ===
        startBatchUpdate() {
            this._batchUpdating = true;
        }

        endBatchUpdate() {
            this._batchUpdating = false;
            this.updateLayerPanelUI();
            this.processThumbnailUpdates();
        }

        // === デバッグ・診断 ===
        getDebugInfo() {
            return {
                layerCount: this.layers.size,
                activeLayerId: this.activeLayerId,
                layerOrder: [...this.layerOrder],
                historyLength: this.history.length,
                historyIndex: this.historyIndex,
                transformCount: this.layerTransforms.size,
                isLayerMoveMode: this.isLayerMoveMode,
                thumbnailQueue: this.thumbnailUpdateQueue.size,
                hasClipboard: !!this.clipboard
            };
        }
    }

    // === グローバル公開 ===
    window.LayerSystem = LayerSystem;

    console.log('✅ layer-system.js loaded - Twin-Star Architecture Engine Star');

})();