// ===== ui/layer-panel-renderer.js - Step 2: DOM生成完全版 =====
// Step 2修正: <img>要素生成の確実化 + 初回サムネイル生成保証
// 修正箇所: createThumbnail()で必ず<img>を生成、再試行メカニズム継続

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map();
        
        this.layerUpdateTimers = new Map();
        this.layerUpdateThrottle = 50;
        
        this.updateQueue = new Set();
        this.isProcessingQueue = false;
        
        this._retryCounters = new Map();
        this._maxRetries = 3;
        
        this.gsapAvailable = typeof gsap !== 'undefined';
        if (this.gsapAvailable) {
            console.log('[LayerPanelRenderer] GSAP detected - using synchronized thumbnail updates');
        }
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
        
        this._setupEventListeners();
        console.log('✅ LayerPanelRenderer initialized (Step 2: DOM生成完全版)');
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId, transform, immediate } = data || {};
            
            if (layerIndex === undefined && !layerId) {
                console.warn('[Panel] transform-updated: no layerIndex/layerId');
                return;
            }
            
            console.log(`🔄 [Panel] Transform updated - layer ${layerIndex || layerId}, immediate=${immediate}`);
            
            if (immediate) {
                this._updateLayerByIndexOrIdImmediate(layerIndex, layerId);
                return;
            }
            
            const throttleKey = layerId || `index-${layerIndex}`;
            
            if (this.layerUpdateTimers.has(throttleKey)) {
                clearTimeout(this.layerUpdateTimers.get(throttleKey));
            }
            
            const timer = setTimeout(() => {
                this._updateLayerByIndexOrIdThrottled(layerIndex, layerId);
                this.layerUpdateTimers.delete(throttleKey);
            }, this.layerUpdateThrottle);
            
            this.layerUpdateTimers.set(throttleKey, timer);
        });
        
        this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
            const { layerIndex, layerId, immediate } = data || {};
            
            console.log(`📸 [Panel] Thumbnail update request - immediate=${immediate}`);
            
            if (immediate) {
                if (layerIndex !== undefined) {
                    console.log(`⚡ [Panel] Immediate update layer ${layerIndex}`);
                    this._updateLayerImmediate(layerIndex);
                } else {
                    this.updateAllThumbnails();
                }
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
        
        this.eventBus.on('layer:path-added', ({ layerIndex }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log(`✏️ [Panel] Path added to layer ${layerIndex}`);
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log('🎥 [Panel] Camera transform changed');
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        this.eventBus.on('camera:resized', ({ width, height }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log(`📐 [Panel] Canvas resized to ${width}x${height}`);
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        console.log('✓ Event listeners configured (transform-updated, thumbnail-updated, etc.)');
    }

    _updateLayerByIndexOrIdImmediate(layerIndex, layerId) {
        if (this.gsapAvailable) {
            gsap.delayedCall(0.016, () => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        } else {
            requestAnimationFrame(() => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        }
    }
    
    _updateLayerByIndexOrIdThrottled(layerIndex, layerId) {
        if (this.gsapAvailable) {
            gsap.delayedCall(0.016, () => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        } else {
            requestAnimationFrame(() => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        }
    }

    _doUpdateLayerByIndexOrId(layerIndex, layerId) {
        if (layerIndex !== undefined) {
            console.log(`🎬 [Panel] Updating layer ${layerIndex} thumbnail`);
            this.updateLayerThumbnail(layerIndex);
        } else if (layerId) {
            const layers = this.layerSystem?.getLayers?.();
            if (layers) {
                const index = layers.findIndex(l => l.layerData?.id === layerId);
                if (index >= 0) {
                    console.log(`🎬 [Panel] Updating layer ${index} thumbnail (by ID: ${layerId})`);
                    this.updateLayerThumbnail(index);
                } else {
                    console.warn(`[Panel] Layer not found by ID: ${layerId}`);
                }
            }
        }
    }
    
    _updateLayerImmediate(layerIndex) {
        if (this.gsapAvailable) {
            gsap.delayedCall(0.016, () => {
                this.updateLayerThumbnail(layerIndex);
            });
        } else {
            requestAnimationFrame(() => {
                this.updateLayerThumbnail(layerIndex);
            });
        }
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
        layerDiv.dataset.layerIndex = String(index);

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

        // ★★★ Step 2修正: サムネイル生成を確実に実行 ★★★
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

    // ★★★ Step 2修正: 必ず<img>を生成し、非同期でサムネイルを設定 ★★★
    createThumbnail(layer, index) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';
        thumbnail.dataset.layerIndex = String(index);

        // 背景レイヤーの場合は色見本を表示
        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            swatch.style.backgroundColor = '#F0E0D6';
            thumbnail.appendChild(swatch);
            console.log(`✓ [Panel] Background layer ${index} swatch created`);
            return thumbnail;
        }

        // 通常レイヤー: 必ず<img>要素を作成
        const img = document.createElement('img');
        img.alt = `Layer ${index} thumbnail`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none'; // 初期状態は非表示
        img.dataset.layerIndex = String(index);
        img.dataset.layerId = layer.layerData?.id || `layer-${index}`;

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成・表示（DOM追加後に実行）
        requestAnimationFrame(() => {
            this._generateAndDisplayThumbnail(layer, index, img);
        });

        console.log(`✓ [Panel] Layer ${index} thumbnail DOM created`);
        return thumbnail;
    }

    async _generateAndDisplayThumbnail(layer, index, img) {
        try {
            if (!window.ThumbnailSystem) {
                console.warn('[Panel] ThumbnailSystem not initialized');
                return;
            }
            
            if (!window.ThumbnailSystem.isInitialized) {
                console.warn('[Panel] ThumbnailSystem not yet initialized, retrying...');
                // ThumbnailSystemの初期化を待つ
                setTimeout(() => {
                    this._generateAndDisplayThumbnail(layer, index, img);
                }, 100);
                return;
            }

            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,
                64
            );

            if (!bitmap) {
                console.warn(`[Panel] Failed to generate thumbnail for layer ${index}`);
                return;
            }

            const dataURL = window.ThumbnailSystem.canvasToDataURL(bitmap);
            
            if (dataURL) {
                img.src = dataURL;
                img.style.display = 'block';
                console.log(`✓ [Panel] Layer ${index} thumbnail displayed`);
            } else {
                console.warn(`[Panel] Failed to convert bitmap to dataURL for layer ${index}`);
            }

        } catch (error) {
            console.error(`[Panel] Layer thumbnail generation failed for index ${index}:`, error);
        }
    }

    async updateLayerThumbnail(layerIndex) {
        if (!this.container) {
            console.warn('[Panel] Container not available');
            return;
        }
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) {
            console.warn(`[Panel] Layer ${layerIndex} not found in layerSystem`);
            return;
        }

        const layer = layers[layerIndex];
        
        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) {
            console.warn('[Panel] ThumbnailSystem not ready');
            return;
        }
        
        if (layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
            console.log(`✓ [Panel] Layer ${layerIndex} cache invalidated`);
        }
        
        // DOM要素検索（堅牢化）
        let layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );
        
        if (!layerDiv && layer.layerData?.id) {
            layerDiv = this.container.querySelector(
                `.layer-item[data-layer-id="${layer.layerData.id}"]`
            );
        }
        
        if (!layerDiv) {
            const allLayerDivs = this.container.querySelectorAll('.layer-item');
            const reverseIndex = allLayerDivs.length - 1 - layerIndex;
            if (reverseIndex >= 0 && reverseIndex < allLayerDivs.length) {
                layerDiv = allLayerDivs[reverseIndex];
            }
        }

        if (!layerDiv) {
            console.warn(`[Panel] Layer element not found for index ${layerIndex}`);
            return;
        }

        const thumbnail = layerDiv.querySelector('.layer-thumbnail');
        let img = thumbnail?.querySelector('img');
        
        // ★★★ Step 2修正: <img>が無い場合は作成 ★★★
        if (!img && thumbnail) {
            img = document.createElement('img');
            img.alt = `Layer ${layerIndex} thumbnail`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.display = 'none';
            img.dataset.layerIndex = String(layerIndex);
            img.dataset.layerId = layer.layerData?.id || `layer-${layerIndex}`;
            thumbnail.appendChild(img);
            console.log(`✓ [Panel] Created missing <img> for layer ${layerIndex}`);
        }

        if (!img) {
            // 再試行メカニズム
            const retryKey = `layer_${layerIndex}`;
            const retryCount = this._retryCounters.get(retryKey) || 0;
            
            if (retryCount < this._maxRetries) {
                this._retryCounters.set(retryKey, retryCount + 1);
                console.log(`[Panel] Thumbnail img not found for layer ${layerIndex}, retrying... (${retryCount + 1}/${this._maxRetries})`);
                
                setTimeout(() => {
                    this.updateLayerThumbnail(layerIndex);
                }, 100 * (retryCount + 1));
                
                return;
            } else {
                console.log(`[Panel] Thumbnail img unavailable for layer ${layerIndex} after ${this._maxRetries} retries - skipping`);
                this._retryCounters.delete(retryKey);
                return;
            }
        }

        // 成功時は再試行カウンターをクリア
        this._retryCounters.delete(`layer_${layerIndex}`);

        // サムネイル生成・表示
        await this._generateAndDisplayThumbnail(layer, layerIndex, img);
    }

    async updateAllThumbnails() {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers) return;

        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) {
            console.warn('[Panel] ThumbnailSystem not ready - deferring update');
            
            setTimeout(() => {
                this.updateAllThumbnails();
            }, 100);
            return;
        }

        window.ThumbnailSystem.clearAllCache();
        console.log('✓ [Panel] All thumbnail caches cleared');

        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
            
            if (i < layers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        console.log(`✅ [Panel] All ${layers.length} layer thumbnails updated`);
    }

    initializeSortable() {
        if (!window.Sortable) return;
        
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

    debugPrintCacheInfo() {
        if (window.ThumbnailSystem) {
            const info = window.ThumbnailSystem.getDebugInfo();
            console.log('ThumbnailSystem Debug Info:', info);
        }
    }
    
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
    
    destroy() {
        for (const timer of this.layerUpdateTimers.values()) {
            clearTimeout(timer);
        }
        this.layerUpdateTimers.clear();
        
        if (this.sortable) {
            this.sortable.destroy();
        }
        
        this.thumbnailCanvases.clear();
        this.updateQueue.clear();
        this._retryCounters.clear();
        
        console.log('✓ LayerPanelRenderer destroyed');
    }
};

console.log('✅ ui/layer-panel-renderer.js (Step 2: DOM生成完全版) loaded');
console.log('   ✓ createThumbnail() で必ず<img>要素を生成');
console.log('   ✓ 非同期サムネイル生成を requestAnimationFrame で保証');
console.log('   ✓ updateLayerThumbnail() で<img>欠損時に自動作成');