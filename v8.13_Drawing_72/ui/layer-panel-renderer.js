// ===== ui/layer-panel-renderer.js - Phase 2完全修正版 =====
// Phase 1: 既存実装（基本レンダリング）
// Phase 2: layer:transform-updated 購読・GSAP連携・サムネイル即座更新
// Phase 2完全修正: イベント優先度・DOM検索堅牢化・throttle最適化

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map();
        
        // Phase 2: 個別レイヤー更新のthrottle管理
        this.layerUpdateTimers = new Map();
        this.layerUpdateThrottle = 50; // 50ms
        
        // Phase 2完全修正: 更新キュー管理
        this.updateQueue = new Set();
        this.isProcessingQueue = false;
        
        // Phase 2: GSAP統合チェック
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
        console.log('✅ LayerPanelRenderer initialized (Phase 2完全修正版)');
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // ★★★ Phase 2完全修正: layer:transform-updated を最優先購読 ★★★
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId, transform, immediate } = data || {};
            
            if (layerIndex === undefined && !layerId) {
                console.warn('[Panel] transform-updated: no layerIndex/layerId');
                return;
            }
            
            console.log(`🔄 [Panel] Transform updated - layer ${layerIndex || layerId}, immediate=${immediate}`);
            
            // immediate フラグがある場合はthrottleをスキップ
            if (immediate) {
                this._updateLayerByIndexOrIdImmediate(layerIndex, layerId);
                return;
            }
            
            // throttle: 同じレイヤーの連続更新を 50ms 間隔に制限
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
        
        // thumbnail:layer-updated 購読（汎用・優先度低）
        this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
            const { layerIndex, layerId, immediate } = data || {};
            
            console.log(`📸 [Panel] Thumbnail update request - immediate=${immediate}`);
            
            // immediate フラグがある場合は throttle をスキップ
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
        
        // ペン描画完了時
        this.eventBus.on('layer:path-added', ({ layerIndex }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log(`✏️ [Panel] Path added to layer ${layerIndex}`);
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラ変形時
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                console.log('🎥 [Panel] Camera transform changed');
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // リサイズ時
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

    // ★★★ Phase 2完全修正: immediate更新（throttleバイパス・GSAP同期） ★★★
    _updateLayerByIndexOrIdImmediate(layerIndex, layerId) {
        if (this.gsapAvailable) {
            // GPU反映保証のため1フレーム遅延
            gsap.delayedCall(0.016, () => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        } else {
            requestAnimationFrame(() => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        }
    }
    
    // ★★★ Phase 2完全修正: throttled更新（GSAP同期） ★★★
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

    // ★★★ Phase 2完全修正: 実際の更新処理（DOM検索堅牢化） ★★★
    _doUpdateLayerByIndexOrId(layerIndex, layerId) {
        if (layerIndex !== undefined) {
            console.log(`🎬 [Panel] Updating layer ${layerIndex} thumbnail`);
            this.updateLayerThumbnail(layerIndex);
        } else if (layerId) {
            // layerId → layerIndex 解決
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
    
    // ★★★ Phase 2完全修正: immediate更新（単一レイヤー） ★★★
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
        
        // ★★★ Phase 2完全修正: data-layer-index 属性を確実に設定 ★★★
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
        
        // ★★★ Phase 2完全修正: data-layer-index を確実に設定 ★★★
        thumbnail.dataset.layerIndex = String(index);

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
        
        // ★★★ Phase 2完全修正: data-layer-index を確実に設定 ★★★
        img.dataset.layerIndex = String(index);

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成
        this._generateAndDisplayThumbnail(layer, index, img);

        return thumbnail;
    }

    /**
     * サムネイル非同期生成と表示
     * Phase 2: ThumbnailSystem.canvasToDataURL() 統一使用
     */
    async _generateAndDisplayThumbnail(layer, index, img) {
        try {
            // ★★★ Phase 2完全修正: ThumbnailSystem初期化確認 ★★★
            if (!window.ThumbnailSystem) {
                console.warn('[Panel] ThumbnailSystem not initialized');
                return;
            }
            
            if (!window.ThumbnailSystem.isInitialized) {
                console.warn('[Panel] ThumbnailSystem not yet initialized');
                return;
            }

            // サムネイル生成
            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,
                64
            );

            if (!bitmap) {
                console.warn(`[Panel] Failed to generate thumbnail for layer ${index}`);
                return;
            }

            // Phase 2: ThumbnailSystem の canvasToDataURL() を使用
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

    /**
     * 指定レイヤーのサムネイル更新
     * Phase 2完全修正: DOM検索の堅牢化・キャッシュクリア
     */
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
        
        // ★★★ Phase 2完全修正: ThumbnailSystem初期化確認 ★★★
        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) {
            console.warn('[Panel] ThumbnailSystem not ready');
            return;
        }
        
        // Phase 2: サムネイル更新前にキャッシュをクリア
        if (layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
            console.log(`✓ [Panel] Layer ${layerIndex} cache invalidated`);
        }
        
        // ★★★ Phase 2完全修正: DOM要素検索の堅牢化（複数方法で試行） ★★★
        let layerDiv = null;
        
        // 方法1: data-layer-index で検索
        layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );
        
        // 方法2: data-layer-id で検索
        if (!layerDiv && layer.layerData?.id) {
            layerDiv = this.container.querySelector(
                `.layer-item[data-layer-id="${layer.layerData.id}"]`
            );
        }
        
        // 方法3: 逆順でindex計算
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
        const img = thumbnail?.querySelector('img');
        
        if (!img) {
            console.warn(`[Panel] Thumbnail image element not found for layer ${layerIndex}`);
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

        // ★★★ Phase 2完全修正: ThumbnailSystem初期化確認 ★★★
        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) {
            console.warn('[Panel] ThumbnailSystem not ready - deferring update');
            
            // 100ms後に再試行
            setTimeout(() => {
                this.updateAllThumbnails();
            }, 100);
            return;
        }

        // Phase 2: 全キャッシュクリア
        window.ThumbnailSystem.clearAllCache();
        console.log('✓ [Panel] All thumbnail caches cleared');

        // 全レイヤーを順番に更新
        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
            
            // 負荷分散
            if (i < layers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        console.log(`✅ [Panel] All ${layers.length} layer thumbnails updated`);
    }

    /**
     * Sortable.js 初期化（ドラッグ&ドロップ機能）
     */
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
        
        // 更新キューをクリア
        this.updateQueue.clear();
        
        console.log('✓ LayerPanelRenderer destroyed');
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 2完全修正版) loaded');
console.log('   ✓ イベント優先度設定・throttle最適化');
console.log('   ✓ DOM検索の堅牢化（3つの方法で試行）');
console.log('   ✓ ThumbnailSystem初期化確認強化');
console.log('   ✓ immediate フラグ対応・GSAP delayedCall 同期');