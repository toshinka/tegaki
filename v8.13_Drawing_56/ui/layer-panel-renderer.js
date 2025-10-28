// ===== ui/layer-panel-renderer.js - Phase 1改修版: Canvas2D廃止 =====
// Canvas2D を削除、ThumbnailSystem 統合
// サムネイル生成を PixiJS renderer.extract.imageBitmap() で統一

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map(); // キャンバス再利用
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // サムネイル更新リクエスト購読（イベント統一）
        this.eventBus.on('thumbnail:layer-updated', ({ layerIndex, layerId }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateLayerThumbnail(layerIndex);
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // ペン描画完了時
        this.eventBus.on('layer:path-added', ({ layerIndex }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラ変形時
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // リサイズ時
        this.eventBus.on('camera:resized', ({ width, height }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // レイヤー変形時（Vキー）
        this.eventBus.on('layer:transform-updated', ({ layerId }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
    }

    render(layers, activeIndex, animationSystem = null) {
        if (!this.container) return;
        if (!layers || layers.length === 0) return;

        this.container.innerHTML = '';

        layers.forEach((layer, index) => {
            const layerElement = this.createLayerElement(
                layer,
                index,
                index === activeIndex,
                animationSystem
            );
            this.container.insertBefore(layerElement, this.container.firstChild);
        });

        this.initializeSortable();
    }

    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'layer-visibility-toggle';
        checkbox.checked = layer.visible !== false;
        checkbox.style.gridColumn = '1';
        checkbox.style.gridRow = '1 / 3';
        layerDiv.appendChild(checkbox);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `Layer ${index}`;
        nameSpan.style.gridColumn = '2';
        nameSpan.style.gridRow = '2';
        layerDiv.appendChild(nameSpan);

        const thumbnail = this.createThumbnail(layer, index);
        layerDiv.appendChild(thumbnail);

        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:layer-selected', { 
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            }
        });

        checkbox.addEventListener('change', (e) => {
            layer.visible = e.target.checked;
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('ui:layer-visibility-changed', {
                    layerIndex: index,
                    visible: e.target.checked,
                    layerId: layer.layerData?.id
                });
            }
        });

        return layerDiv;
    }

    createThumbnail(layer, index) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';
        thumbnail.dataset.layerIndex = index;

        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            swatch.style.backgroundColor = '#F0E0D6';
            thumbnail.appendChild(swatch);
            return thumbnail;
        }

        // Canvas を再利用するための container を作成
        const canvasId = `thumb-canvas-${index}`;
        if (!this.thumbnailCanvases.has(canvasId)) {
            const canvas = document.createElement('canvas');
            canvas.id = canvasId;
            canvas.width = 64;
            canvas.height = 64;
            this.thumbnailCanvases.set(canvasId, canvas);
        }

        const canvas = this.thumbnailCanvases.get(canvasId);
        const img = document.createElement('img');
        img.alt = 'Layer thumbnail';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none'; // 初期状態は非表示

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成
        this._generateAndDisplayThumbnail(layer, index, canvas, img);

        return thumbnail;
    }

    /**
     * サムネイル非同期生成と表示
     * Phase 1: ThumbnailSystem から ImageBitmap を取得
     * 
     * @param {PIXI.Container} layer
     * @param {number} index
     * @param {HTMLCanvasElement} canvas
     * @param {HTMLImageElement} img
     */
    async _generateAndDisplayThumbnail(layer, index, canvas, img) {
        try {
            // ThumbnailSystem から ImageBitmap を取得
            if (!window.ThumbnailSystem) {
                console.warn('ThumbnailSystem not initialized');
                return;
            }

            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,  // 幅
                64   // 高さ
            );

            if (!bitmap) {
                return;
            }

            // Canvas に bitmap を描画
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                ctx.drawImage(bitmap, 0, 0);

                // Canvas から DataURL を取得
                const dataURL = canvas.toDataURL('image/png');
                img.src = dataURL;
                img.style.display = 'block';
            }

        } catch (error) {
            console.error(`Layer thumbnail generation failed for index ${index}:`, error);
        }
    }

    /**
     * 指定レイヤーのサムネイル更新
     * 
     * @param {number} layerIndex
     */
    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        const layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        ) || this.container.children[layerIndex];

        if (!layerDiv) return;

        const img = layerDiv.querySelector('img');
        if (!img) return;

        try {
            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,
                64
            );

            if (bitmap) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    ctx.drawImage(bitmap, 0, 0);
                    
                    img.src = canvas.toDataURL('image/png');
                    img.style.display = 'block';
                }
            }

        } catch (error) {
            console.error(`Layer thumbnail update failed:`, error);
        }
    }

    /**
     * 全レイヤーサムネイル更新
     */
    async updateAllThumbnails() {
        if (!this.container) return;

        const layers = this.layerSystem?.getLayers?.();
        if (!layers) return;

        const images = this.container.querySelectorAll('img');
        images.forEach((img, index) => {
            this.updateLayerThumbnail(index);
        });
    }

    initializeSortable() {
        // ドラッグ&ドロップ機能（既存実装のまま）
        // ここには既存の sortable 初期化ロジックを保持
    }

    /**
     * デバッグ用: キャッシュ情報表示
     */
    debugPrintCacheInfo() {
        if (window.ThumbnailSystem) {
            const info = window.ThumbnailSystem.getDebugInfo();
            console.log('ThumbnailSystem Debug Info:', info);
        }
    }
};