// ===== ui/layer-panel-renderer.js - タブレットペン完全対応版 =====
// Phase 4: タブレットペン対応のドラッグ&ドロップ機能実装
// 修正: setPointerCapture/releasePointerCapture 適切に実装
// 修正: ドラッグ開始判定を厳密化

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
        
        // Phase 4: ドラッグ状態管理
        this.dragState = {
            active: false,
            element: null,
            startY: 0,
            currentY: 0,
            placeholder: null,
            originalIndex: -1,
            pointerId: null
        };
        
        // Bound メソッドを事前作成
        this._boundHandlePointerMove = this._handlePointerMove.bind(this);
        this._boundHandlePointerUp = this._handlePointerUp.bind(this);
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
        layerDiv.dataset.layerIndex = index;
        
        // タブレットペン対応: touch-action を none に設定
        layerDiv.style.touchAction = 'none';

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
            if (e.target !== checkbox && !this.dragState.active) {
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

    // ===== Phase 4: ドラッグ&ドロップ機能実装 =====
    
    /**
     * ドラッグ&ドロップ初期化
     * PointerEvent ベースでマウス・タッチ・ペンに対応
     */
    initializeSortable() {
        if (!this.container) return;

        const layerItems = this.container.querySelectorAll('.layer-item');
        
        layerItems.forEach(item => {
            // PointerEvent でドラッグ開始
            item.addEventListener('pointerdown', this._handlePointerDown.bind(this), { passive: false });
            
            // ドラッグ中のカーソルスタイル
            item.style.cursor = 'grab';
        });
    }

    /**
     * ポインターダウン処理（ドラッグ開始判定）
     */
    _handlePointerDown(e) {
        // チェックボックスクリック時はドラッグしない
        if (e.target.classList.contains('layer-visibility-toggle')) {
            return;
        }

        const item = e.currentTarget;
        
        // ドラッグ状態初期化
        this.dragState = {
            active: false,
            element: item,
            startY: e.clientY,
            currentY: e.clientY,
            placeholder: null,
            originalIndex: parseInt(item.dataset.layerIndex, 10),
            pointerId: e.pointerId
        };

        // ポインター移動・終了イベントをグローバルに登録
        document.addEventListener('pointermove', this._boundHandlePointerMove, { passive: false });
        document.addEventListener('pointerup', this._boundHandlePointerUp, { passive: false });
        document.addEventListener('pointercancel', this._boundHandlePointerUp, { passive: false });

        // ポインターをキャプチャ
        try {
            item.setPointerCapture(e.pointerId);
        } catch (err) {
            console.warn('setPointerCapture failed:', err);
        }

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * ポインター移動処理（ドラッグ中）
     */
    _handlePointerMove(e) {
        if (!this.dragState.element) return;
        
        // 異なるポインターIDは無視
        if (e.pointerId !== this.dragState.pointerId) return;

        const deltaY = Math.abs(e.clientY - this.dragState.startY);

        // 5px以上移動したらドラッグ開始
        if (!this.dragState.active && deltaY > 5) {
            this._startDrag();
        }

        if (this.dragState.active) {
            this.dragState.currentY = e.clientY;
            this._updateDragPosition(e.clientY);
            this._updateDropTarget(e.clientY);
        }

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * ポインター終了処理（ドラッグ終了）
     */
    _handlePointerUp(e) {
        // 異なるポインターIDは無視
        if (e.pointerId !== this.dragState.pointerId) return;
        
        if (this.dragState.active) {
            this._endDrag();
        }

        // ポインターキャプチャを解放
        if (this.dragState.element && this.dragState.pointerId !== null) {
            try {
                this.dragState.element.releasePointerCapture(this.dragState.pointerId);
            } catch (err) {
                console.warn('releasePointerCapture failed:', err);
            }
        }

        // イベントリスナーをクリア
        document.removeEventListener('pointermove', this._boundHandlePointerMove);
        document.removeEventListener('pointerup', this._boundHandlePointerUp);
        document.removeEventListener('pointercancel', this._boundHandlePointerUp);

        this.dragState = {
            active: false,
            element: null,
            startY: 0,
            currentY: 0,
            placeholder: null,
            originalIndex: -1,
            pointerId: null
        };

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * ドラッグ開始処理
     */
    _startDrag() {
        const item = this.dragState.element;
        
        this.dragState.active = true;

        // プレースホルダー作成
        const placeholder = document.createElement('div');
        placeholder.className = 'layer-item-placeholder';
        placeholder.style.height = `${item.offsetHeight}px`;
        placeholder.style.border = '2px dashed #666';
        placeholder.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        placeholder.style.margin = '2px 0';
        placeholder.style.pointerEvents = 'none';
        
        this.dragState.placeholder = placeholder;

        // ドラッグ要素のスタイル
        const rect = item.getBoundingClientRect();
        item.style.position = 'fixed';
        item.style.zIndex = '10000';
        item.style.width = `${item.offsetWidth}px`;
        item.style.opacity = '0.8';
        item.style.cursor = 'grabbing';
        item.style.pointerEvents = 'none';
        item.style.top = `${rect.top}px`;
        item.style.left = `${rect.left}px`;

        // プレースホルダーを元の位置に挿入
        item.parentNode.insertBefore(placeholder, item.nextSibling);
    }

    /**
     * ドラッグ位置更新
     */
    _updateDragPosition(clientY) {
        const item = this.dragState.element;
        const offsetY = clientY - this.dragState.startY;
        const startRect = this.dragState.placeholder?.getBoundingClientRect() || item.getBoundingClientRect();

        item.style.top = `${startRect.top + offsetY}px`;
    }

    /**
     * ドロップターゲット更新（プレースホルダー移動）
     */
    _updateDropTarget(clientY) {
        const placeholder = this.dragState.placeholder;
        if (!placeholder) return;
        
        const items = Array.from(this.container.querySelectorAll('.layer-item:not([style*="position: fixed"])'));

        let targetItem = null;

        for (const item of items) {
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            if (clientY < midY) {
                targetItem = item;
                break;
            }
        }

        if (targetItem && targetItem !== placeholder) {
            this.container.insertBefore(placeholder, targetItem);
        } else if (!targetItem && placeholder.parentNode) {
            // 最後尾に移動
            this.container.appendChild(placeholder);
        }
    }

    /**
     * ドラッグ終了処理
     */
    _endDrag() {
        const item = this.dragState.element;
        const placeholder = this.dragState.placeholder;

        if (!item || !placeholder) return;

        // プレースホルダーの位置にレイヤーを移動
        const allItems = Array.from(this.container.querySelectorAll('.layer-item, .layer-item-placeholder'));
        const newIndex = allItems.indexOf(placeholder);

        // スタイルをリセット
        item.style.position = '';
        item.style.zIndex = '';
        item.style.width = '';
        item.style.opacity = '';
        item.style.cursor = 'grab';
        item.style.pointerEvents = '';
        item.style.top = '';
        item.style.left = '';

        // プレースホルダーを実際のレイヤーに置き換え
        placeholder.parentNode.replaceChild(item, placeholder);

        // レイヤー順序を更新
        this._reorderLayers(newIndex);
    }

    /**
     * レイヤー順序を更新
     */
    _reorderLayers(newVisualIndex) {
        if (!this.layerSystem) return;

        const layers = this.layerSystem.getLayers();
        const oldIndex = this.dragState.originalIndex;

        // 表示順序は逆順（上が最後尾）なので変換
        const oldLayerIndex = layers.length - 1 - oldIndex;
        const newLayerIndex = layers.length - 1 - newVisualIndex;

        if (oldLayerIndex === newLayerIndex) return;

        // レイヤーを移動
        const [movedLayer] = layers.splice(oldLayerIndex, 1);
        layers.splice(newLayerIndex, 0, movedLayer);

        // EventBus 通知
        if (this.eventBus) {
            this.eventBus.emit('layer:reordered', {
                fromIndex: oldLayerIndex,
                toIndex: newLayerIndex,
                layerId: movedLayer.layerData?.id
            });
        }

        // UI再レンダリング
        const activeIndex = this.layerSystem.getActiveLayerIndex();
        this.render(layers, activeIndex, this.animationSystem);
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
        
        // ドラッグイベントリスナーをクリア
        document.removeEventListener('pointermove', this._boundHandlePointerMove);
        document.removeEventListener('pointerup', this._boundHandlePointerUp);
        document.removeEventListener('pointercancel', this._boundHandlePointerUp);
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 4完全版) loaded');
console.log('   ✓ PointerEvent ベース実装（タブレットペン完全対応）');
console.log('   ✓ touch-action: none 設定');
console.log('   ✓ setPointerCapture/releasePointerCapture 実装');