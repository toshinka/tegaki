// ===== ui/layer-panel-renderer.js - タブレットペン完全対応版 =====
// Phase 5: Sortable.js を PointerEvent ベースに置き換え
// 
// 【改修内容】
// - Sortable.js 依存を削除
// - PointerEvent ベースのドラッグ&ドロップ実装
// - タブレットペン・タッチ・マウス全対応
// - setPointerCapture/releasePointerCapture 使用

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
        
        // Phase 5: ドラッグ状態管理
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            draggedIndex: null,
            startY: 0,
            currentY: 0,
            pointerId: null,
            placeholder: null
        };
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
        
        // Phase 5: コンテナにスタイル追加
        this.container.style.touchAction = 'none';
        this.container.style.userSelect = 'none';
        
        this._setupEventListeners();
        console.log('✅ LayerPanelRenderer initialized (Phase 5: タブレットペン対応)');
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

        // Phase 5: Sortable.js の代わりに PointerEvent ベースのドラッグを設定
        this._setupPointerDrag();
    }

    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;
        
        // Phase 3: data-layer-index 属性を追加（非アクティブレイヤー更新用）
        layerDiv.dataset.layerIndex = index;
        
        // Phase 5: ドラッグ可能にする
        layerDiv.style.touchAction = 'none';
        layerDiv.style.cursor = 'grab';

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

        // クリックイベント（チェックボックス以外）
        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox && !this.dragState.isDragging) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:layer-selected', { 
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            }
        });

        // チェックボックスイベント
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
     * Phase 5: PointerEvent ベースのドラッグ＆ドロップ実装
     * タブレットペン・タッチ・マウス全対応
     */
    _setupPointerDrag() {
        if (!this.container) return;

        // コンテナに PointerEvent ハンドラを設定
        this.container.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.container.addEventListener('pointermove', this._onPointerMove.bind(this));
        this.container.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.container.addEventListener('pointercancel', this._onPointerCancel.bind(this));

        console.log('✓ PointerEvent-based drag initialized');
    }

    /**
     * PointerDown: ドラッグ開始
     */
    _onPointerDown(e) {
        // チェックボックスやサムネイルはスキップ
        if (e.target.type === 'checkbox' || e.target.classList.contains('layer-thumbnail')) {
            return;
        }

        // layer-item を探す
        const layerItem = e.target.closest('.layer-item');
        if (!layerItem) return;

        // 背景レイヤーはドラッグ不可
        const layerIndex = parseInt(layerItem.dataset.layerIndex);
        const layers = this.layerSystem?.getLayers?.();
        if (layers && layers[layerIndex]?.layerData?.isBackground) {
            return;
        }

        // ドラッグ状態初期化
        this.dragState.isDragging = true;
        this.dragState.draggedElement = layerItem;
        this.dragState.draggedIndex = layerIndex;
        this.dragState.startY = e.clientY;
        this.dragState.currentY = e.clientY;
        this.dragState.pointerId = e.pointerId;

        // setPointerCapture でイベント捕捉
        this.container.setPointerCapture(e.pointerId);

        // ドラッグ中のスタイル
        layerItem.style.opacity = '0.5';
        layerItem.style.cursor = 'grabbing';

        // プレースホルダー作成
        this._createPlaceholder(layerItem);

        console.log(`🖱️ Drag started: Layer ${layerIndex}`);
    }

    /**
     * PointerMove: ドラッグ中
     */
    _onPointerMove(e) {
        if (!this.dragState.isDragging) return;
        if (e.pointerId !== this.dragState.pointerId) return;

        this.dragState.currentY = e.clientY;

        const draggedElement = this.dragState.draggedElement;
        if (!draggedElement) return;

        // ドラッグ要素を移動
        const deltaY = this.dragState.currentY - this.dragState.startY;
        draggedElement.style.transform = `translateY(${deltaY}px)`;

        // プレースホルダー位置更新
        this._updatePlaceholderPosition(e.clientY);
    }

    /**
     * PointerUp: ドラッグ終了
     */
    _onPointerUp(e) {
        if (!this.dragState.isDragging) return;
        if (e.pointerId !== this.dragState.pointerId) return;

        this._finalizeDrag();

        // releasePointerCapture
        this.container.releasePointerCapture(e.pointerId);
    }

    /**
     * PointerCancel: ドラッグキャンセル
     */
    _onPointerCancel(e) {
        if (!this.dragState.isDragging) return;
        if (e.pointerId !== this.dragState.pointerId) return;

        this._cancelDrag();

        // releasePointerCapture
        this.container.releasePointerCapture(e.pointerId);
    }

    /**
     * プレースホルダー作成
     */
    _createPlaceholder(layerItem) {
        const placeholder = document.createElement('div');
        placeholder.className = 'layer-item-placeholder';
        placeholder.style.height = `${layerItem.offsetHeight}px`;
        placeholder.style.border = '2px dashed #888';
        placeholder.style.backgroundColor = 'rgba(0,0,0,0.1)';
        placeholder.style.boxSizing = 'border-box';

        // layerItem の次に挿入
        layerItem.parentNode.insertBefore(placeholder, layerItem.nextSibling);

        this.dragState.placeholder = placeholder;
    }

    /**
     * プレースホルダー位置更新
     */
    _updatePlaceholderPosition(clientY) {
        const placeholder = this.dragState.placeholder;
        if (!placeholder) return;

        const layerItems = Array.from(this.container.querySelectorAll('.layer-item'));
        
        // 現在のY座標に最も近い layer-item を探す
        let closestItem = null;
        let closestDistance = Infinity;

        for (const item of layerItems) {
            if (item === this.dragState.draggedElement) continue;

            const rect = item.getBoundingClientRect();
            const itemCenterY = rect.top + rect.height / 2;
            const distance = Math.abs(clientY - itemCenterY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
            }
        }

        if (closestItem) {
            const rect = closestItem.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();
            
            // clientY が item の上半分なら前に、下半分なら後ろに
            if (clientY < rect.top + rect.height / 2) {
                closestItem.parentNode.insertBefore(placeholder, closestItem);
            } else {
                closestItem.parentNode.insertBefore(placeholder, closestItem.nextSibling);
            }
        }
    }

    /**
     * ドラッグ確定
     */
    _finalizeDrag() {
        const draggedElement = this.dragState.draggedElement;
        const placeholder = this.dragState.placeholder;

        if (!draggedElement || !placeholder) {
            this._cancelDrag();
            return;
        }

        // プレースホルダーの位置にドラッグ要素を移動
        placeholder.parentNode.insertBefore(draggedElement, placeholder);
        placeholder.remove();

        // スタイルリセット
        draggedElement.style.opacity = '';
        draggedElement.style.transform = '';
        draggedElement.style.cursor = 'grab';

        // 新しいインデックスを計算
        const layerItems = Array.from(this.container.querySelectorAll('.layer-item'));
        const newIndex = layerItems.indexOf(draggedElement);
        const oldIndex = this.dragState.draggedIndex;

        console.log(`🔄 Drag finalized: ${oldIndex} → ${newIndex}`);

        // レイヤー順序変更
        if (this.layerSystem?.reorderLayers && oldIndex !== newIndex) {
            this.layerSystem.reorderLayers(oldIndex, newIndex);
        }

        // ドラッグ状態リセット
        this._resetDragState();
    }

    /**
     * ドラッグキャンセル
     */
    _cancelDrag() {
        const draggedElement = this.dragState.draggedElement;
        const placeholder = this.dragState.placeholder;

        if (draggedElement) {
            draggedElement.style.opacity = '';
            draggedElement.style.transform = '';
            draggedElement.style.cursor = 'grab';
        }

        if (placeholder) {
            placeholder.remove();
        }

        console.log('❌ Drag cancelled');

        this._resetDragState();
    }

    /**
     * ドラッグ状態リセット
     */
    _resetDragState() {
        this.dragState.isDragging = false;
        this.dragState.draggedElement = null;
        this.dragState.draggedIndex = null;
        this.dragState.startY = 0;
        this.dragState.currentY = 0;
        this.dragState.pointerId = null;
        this.dragState.placeholder = null;
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
        
        // ドラッグ状態クリア
        this._resetDragState();
        
        // イベントリスナー削除
        if (this.container) {
            this.container.removeEventListener('pointerdown', this._onPointerDown);
            this.container.removeEventListener('pointermove', this._onPointerMove);
            this.container.removeEventListener('pointerup', this._onPointerUp);
            this.container.removeEventListener('pointercancel', this._onPointerCancel);
        }
        
        // canvas キャッシュをクリア
        this.thumbnailCanvases.clear();
        
        console.log('✓ LayerPanelRenderer destroyed');
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 5: タブレットペン完全対応版) loaded');
console.log('   ✓ PointerEvent ベース実装（Sortable.js 不要）');
console.log('   ✓ タブレットペン・タッチ・マウス全対応');
console.log('   ✓ setPointerCapture/releasePointerCapture 実装');
console.log('   ✓ ドラッグ中のビジュアルフィードバック');
console.log('   ✓ 背景レイヤードラッグ防止');