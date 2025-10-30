// ===== ui/layer-panel-renderer.js - Phase 3-4 完全版 =====
// Phase 3: layer:transform-updated 購読・即座更新実装
// Phase 4: UI連携・キャッシュ統一・DataURL統一使用
// 
// 【改修内容】
// - layer:transform-updated イベント購読追加（Vモード対応）
// - ThumbnailSystem.canvasToDataURL() 統一使用
// - Canvas2D ctx.drawImage() の削除（DataURL使用に統一）
// - throttle 50ms で連続更新制御
// - immediate フラグで優先度制御

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map();
        
        // Phase 3-4: 個別レイヤー更新のthrottle管理
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
        console.log('✅ LayerPanelRenderer initialized (Phase 3-4)');
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // Phase 4: layer:transform-updated を購読（Vモード対応・最優先）
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId, transform } = data || {};
            
            if (layerIndex === undefined && !layerId) return;
            
            // throttle: 同じレイヤーの連続更新を 50ms 間隔に制限
            const throttleKey = layerId || `index-${layerIndex}`;
            
            if (this.layerUpdateTimers.has(throttleKey)) {
                clearTimeout(this.layerUpdateTimers.get(throttleKey));
            }
            
            const timer = setTimeout(() => {
                // 即座にサムネイル更新
                if (layerIndex !== undefined) {
                    console.log(`🎬 Panel: Updating layer ${layerIndex} thumbnail (transform)`);
                    this.updateLayerThumbnail(layerIndex);
                } else if (layerId) {
                    // layerId → layerIndex 解決
                    const layers = this.layerSystem?.getLayers?.();
                    if (layers) {
                        const index = layers.findIndex(l => l.layerData?.id === layerId);
                        if (index >= 0) {
                            console.log(`🎬 Panel: Updating layer ${index} thumbnail (by ID)`);
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
            
            // immediate フラグがある場合は throttle をスキップ
            if (immediate) {
                requestAnimationFrame(() => {
                    if (layerIndex !== undefined) {
                        console.log(`⚡ Panel: Immediate update layer ${layerIndex}`);
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
                console.log(`✏️ Panel: Path added to layer ${layerIndex}`);
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラ変形時
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log('🎥 Panel: Camera transform changed');
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // リサイズ時
        this.eventBus.on('camera:resized', ({ width, height }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log(`📐 Panel: Canvas resized to ${width}x${height}`);
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        console.log('✓ Event listeners configured (transform-updated, thumbnail-updated, etc.)');
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
        
        // Phase 3: data-layer-index 属性を追加（非アクティブレイヤー更新用）
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

        // img 要素（サムネイル表示用）
        const img = document.createElement('img');
        img.alt = 'Layer thumbnail';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none';
        img.dataset.layerIndex = index;

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成
        this._generateAndDisplayThumbnail(layer, index, img);

        return thumbnail;
    }

    /**
     * サムネイル非同期生成と表示
     * Phase 4: ThumbnailSystem.canvasToDataURL() 統一使用
     */
    async _generateAndDisplayThumbnail(layer, index, img) {
        try {
            if (!window.ThumbnailSystem) {
                console.warn('ThumbnailSystem not initialized');
                return;
            }

            // サムネイル生成
            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,
                64
            );

            if (!bitmap) {
                console.warn(`Failed to generate thumbnail for layer ${index}`);
                return;
            }

            // Phase 4: ThumbnailSystem の canvasToDataURL() を使用
            const dataURL = window.ThumbnailSystem.canvasToDataURL(bitmap);
            
            if (dataURL) {
                img.src = dataURL;
                img.style.display = 'block';
                console.log(`✓ Layer ${index} thumbnail displayed`);
            }

        } catch (error) {
            console.error(`Layer thumbnail generation failed for index ${index}:`, error);
        }
    }

    /**
     * 指定レイヤーのサムネイル更新
     * Phase 3-4: キャッシュを強制クリアしてから更新
     */
    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        
        // Phase 3-4: サムネイル更新前にキャッシュをクリア
        if (window.ThumbnailSystem && layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
            console.log(`✓ Layer ${layerIndex} cache invalidated`);
        }
        
        // Phase 3: data-layer-index で要素検索
        const layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );

        if (!layerDiv) {
            console.warn(`Layer element not found for index ${layerIndex}`);
            return;
        }

        const thumbnail = layerDiv.querySelector('.layer-thumbnail');
        const img = thumbnail?.querySelector('img');
        
        if (!img) {
            console.warn(`Thumbnail image element not found for layer ${layerIndex}`);
            return;
        }

        // サムネイル生成・表示
        await this._generateAndDisplayThumbnail(layer, layerIndex, img);
    }

    /**
     * 全レイヤーサムネイル更新
     */
    async updateAllThumbnails() {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers) return;

        // Phase 3-4: 全キャッシュクリア
        if (window.ThumbnailSystem) {
            window.ThumbnailSystem.clearAllCache();
            console.log('✓ All thumbnail caches cleared');
        }

        // 全レイヤーを順番に更新
        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
            
            // 負荷分散
            if (i < layers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        console.log(`✅ All ${layers.length} layer thumbnails updated`);
    }

    /**
     * Sortable.js 初期化（ドラッグ&ドロップ機能）
     */
    initializeSortable() {
        if (!window.Sortable) return;
        
        // 既存実装との互換性維持
        try {
            if (this.sortable) {
                this.sortable.destroy();
            }

            this.sortable = Sortable.create(this.container, {
                animation: 150,
                onEnd: (evt) => {
                    if (this.layerSystem?.reorderLayers) {
                        this.layerSystem.reorderLayers(evt.oldIndex, evt.newIndex);
                    }
                }
            });
        } catch (error) {
            console.warn('Sortable initialization failed:', error);
        }
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
     * レイヤー個別の詳細情報表示（デバッグ）
     */
    debugPrintLayerInfo(layerIndex) {
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) {
            console.error(`Layer ${layerIndex} not found`);
            return;
        }
        
        const layer = layers[layerIndex];
        console.log(`\n📋 Layer ${layerIndex} Debug Info:`);
        console.log(`  ID: ${layer.layerData?.id}`);
        console.log(`  Name: ${layer.layerData?.name}`);
        console.log(`  Visible: ${layer.visible}`);
        console.log(`  Opacity: ${layer.alpha}`);
        console.log(`  Position: (${layer.position.x}, ${layer.position.y})`);
        console.log(`  Scale: (${layer.scale.x}, ${layer.scale.y})`);
        console.log(`  Rotation: ${layer.rotation}`);
        console.log(`  IsBackground: ${layer.layerData?.isBackground}`);
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
        
        // Sortable クリーンアップ
        if (this.sortable) {
            this.sortable.destroy();
        }
        
        // canvas キャッシュをクリア
        this.thumbnailCanvases.clear();
        
        console.log('✓ LayerPanelRenderer destroyed');
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 3-4 完全版) loaded');
console.log('   ✓ Phase 3: layer:transform-updated 購読・即座更新');
console.log('   ✓ Phase 4: ThumbnailSystem.canvasToDataURL() 統一使用');
console.log('   ✓ throttle: 50ms（レイヤー個別管理）');
console.log('   ✓ Canvas2D ctx.drawImage() 削除');
console.log('   ✓ キャッシュ強制クリア実装');