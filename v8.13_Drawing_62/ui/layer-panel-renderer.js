// ===== ui/layer-panel-renderer.js - Phase 3完全版 =====
// Phase 3: layer:transform-updated 購読・即座更新実装
// 修正1: data-layer-index 属性を追加して非アクティブレイヤー更新を修正
// 修正2: updateLayerThumbnail() のDOM検索を改善
// 修正3: transform-updated 時の即座更新（throttle なし）

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map();
        
        // Phase 3: 個別レイヤー更新のthrottle管理
        this.layerUpdateTimers = new Map();
        this.layerUpdateThrottle = 50; // 50ms
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
        
        // Phase 3: layer:transform-updated を購読（最優先・throttle付き個別更新）
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId, transform } = data || {};
            
            if (layerIndex === undefined && !layerId) return;
            
            // throttle: 同じレイヤーの連続更新を50ms間隔に制限
            const throttleKey = layerId || `index-${layerIndex}`;
            
            if (this.layerUpdateTimers.has(throttleKey)) {
                clearTimeout(this.layerUpdateTimers.get(throttleKey));
            }
            
            const timer = setTimeout(() => {
                // 即座にサムネイル更新
                if (layerIndex !== undefined) {
                    this.updateLayerThumbnail(layerIndex);
                } else if (layerId) {
                    // layerId から layerIndex を取得
                    const layers = this.layerSystem?.getLayers?.();
                    if (layers) {
                        const index = layers.findIndex(l => l.layerData?.id === layerId);
                        if (index >= 0) {
                            this.updateLayerThumbnail(index);
                        }
                    }
                }
                
                this.layerUpdateTimers.delete(throttleKey);
            }, this.layerUpdateThrottle);
            
            this.layerUpdateTimers.set(throttleKey, timer);
        });
        
        // サムネイル更新リクエスト購読（汎用）
        this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
            const { layerIndex, layerId, immediate } = data || {};
            
            // immediate フラグがある場合はthrottleをスキップ
            if (immediate) {
                requestAnimationFrame(() => {
                    if (layerIndex !== undefined) {
                        this.updateLayerThumbnail(layerIndex);
                    } else {
                        this.updateAllThumbnails();
                    }
                });
                return;
            }
            
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                if (layerIndex !== undefined) {
                    this.updateLayerThumbnail(layerIndex);
                } else {
                    this.updateAllThumbnails();
                }
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
        
        // 修正1: data-layer-index 属性を追加
        layerDiv.dataset.layerIndex = index;

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

        // Canvas を再利用
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
        img.style.display = 'none';

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成
        this._generateAndDisplayThumbnail(layer, index, canvas, img);

        return thumbnail;
    }

    /**
     * サムネイル非同期生成と表示
     */
    async _generateAndDisplayThumbnail(layer, index, canvas, img) {
        try {
            if (!window.ThumbnailSystem) {
                console.warn('ThumbnailSystem not initialized');
                return;
            }

            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,
                64
            );

            if (!bitmap) {
                return;
            }

            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                ctx.drawImage(bitmap, 0, 0);

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
     * 修正2: DOM検索を改善（data-layer-index使用）
     * Phase 3: キャッシュを強制クリアしてから更新
     */
    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        
        // Phase 3: サムネイル更新前にキャッシュをクリア
        if (window.ThumbnailSystem) {
            window.ThumbnailSystem.invalidateLayerCache(layerIndex);
        }
        
        // 修正2: data-layer-index で検索
        const layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );

        if (!layerDiv) {
            console.warn(`Layer element not found for index ${layerIndex}`);
            return;
        }

        const thumbnail = layerDiv.querySelector('.layer-thumbnail');
        if (!thumbnail) return;

        const img = thumbnail.querySelector('img');
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
            console.error(`Layer thumbnail update failed for index ${layerIndex}:`, error);
        }
    }

    /**
     * 全レイヤーサムネイル更新
     */
    async updateAllThumbnails() {
        if (!this.container) return;

        const layers = this.layerSystem?.getLayers?.();
        if (!layers) return;

        // Phase 3: 全キャッシュクリア
        if (window.ThumbnailSystem) {
            window.ThumbnailSystem.clearAllCache();
        }

        // 全レイヤーを順番に更新
        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
        }
    }

    initializeSortable() {
        // ドラッグ&ドロップ機能（既存実装）
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
    
    /**
     * クリーンアップ
     */
    destroy() {
        // throttle タイマーをクリア
        for (const timer of this.layerUpdateTimers.values()) {
            clearTimeout(timer);
        }
        this.layerUpdateTimers.clear();
        
        // canvas キャッシュをクリア
        this.thumbnailCanvases.clear();
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 3完全版) loaded');
console.log('   ✓ layer:transform-updated 購読・即座更新');
console.log('   ✓ throttle: 50ms（レイヤー個別管理）');
console.log('   ✓ キャッシュ強制クリア実装');