// ===== ui/layer-panel-renderer.js - Phase 5-7完全版v2 =====
// Phase 5: 背景レイヤー色変更機能 + 固定化
// Phase 6: レイヤー透明度UI（ボタンのみ、ドラッグ無効）
// Phase 7: レイヤードラッグレスポンス改善
// 追加: レイヤー名左寄せ、ダブルクリック編集、背景固定化

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
        this.debugEnabled = false;
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
        
        // Phase 5: 背景レイヤー色変更リクエスト
        this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
            if (this.layerSystem && this.layerSystem.changeBackgroundLayerColor) {
                this.layerSystem.changeBackgroundLayerColor(layerIndex, layerId);
            }
        });
        
        // Phase 6: レイヤー透明度変更リクエスト
        this.eventBus.on('ui:layer-opacity-change-requested', ({ layerIndex, opacity }) => {
            if (this.layerSystem && this.layerSystem.setLayerOpacity) {
                this.layerSystem.setLayerOpacity(layerIndex, opacity);
            }
        });
        
        // レイヤー名変更リクエスト
        this.eventBus.on('ui:layer-name-change-requested', ({ layerIndex, newName }) => {
            if (this.layerSystem) {
                const layers = this.layerSystem.getLayers();
                const layer = layers[layerIndex];
                if (layer && layer.layerData) {
                    layer.layerData.name = newName;
                    this.updateLayerPanelUI();
                }
            }
        });
        
        // レイヤー変形更新
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId, immediate } = data || {};
            
            if (layerIndex === undefined && !layerId) return;
            
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
        
        // サムネイル更新リクエスト
        this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
            const { layerIndex, layerId, immediate } = data || {};
            
            if (immediate) {
                if (layerIndex !== undefined) {
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
        
        // 描画イベント
        this.eventBus.on('layer:path-added', ({ layerIndex }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラ変形
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラリサイズ
        this.eventBus.on('camera:resized', ({ width, height }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // Phase 6: 透明度変更通知を受けてUI更新
        this.eventBus.on('layer:opacity-changed', ({ data }) => {
            const { layerIndex, opacity } = data || {};
            if (layerIndex === undefined) return;
            
            this._updateOpacityDisplay(layerIndex, opacity);
        });
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
            this.updateLayerThumbnail(layerIndex);
        } else if (layerId) {
            const layers = this.layerSystem?.getLayers?.();
            if (layers) {
                const index = layers.findIndex(l => l.layerData?.id === layerId);
                if (index >= 0) {
                    this.updateLayerThumbnail(index);
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

    // Phase 6: 透明度表示を更新
    _updateOpacityDisplay(layerIndex, opacity) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;
        
        const layer = layers[layerIndex];
        
        let layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );
        
        if (!layerDiv && layer.layerData?.id) {
            layerDiv = this.container.querySelector(
                `.layer-item[data-layer-id="${layer.layerData.id}"]`
            );
        }
        
        if (!layerDiv) return;
        
        const opacityValue = layerDiv.querySelector('.layer-opacity-value');
        if (opacityValue) {
            opacityValue.textContent = `${Math.round(opacity * 100)}%`;
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
        const isBackground = layer.layerData?.isBackground;
        
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        if (isBackground) {
            layerDiv.classList.add('background-layer');
        }
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;
        layerDiv.dataset.layerIndex = String(index);

        // 表示/非表示チェックボックス
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'layer-visibility-toggle';
        checkbox.checked = layer.visible !== false;
        checkbox.style.gridColumn = '1';
        checkbox.style.gridRow = '1 / 3';
        layerDiv.appendChild(checkbox);

        // Phase 5 & 6: 背景レイヤーと一般レイヤーでUI分岐
        if (isBackground) {
            // Phase 5: 背景レイヤー - バケツアイコン追加
            const bucketIcon = document.createElement('div');
            bucketIcon.className = 'layer-background-color-button';
            bucketIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" 
                     viewBox="0 0 24 24" fill="none" stroke="#800000" 
                     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                    <path d="m5 2 5 5"/>
                    <path d="M2 13h15"/>
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                </svg>
            `;
            bucketIcon.style.gridColumn = '2';
            bucketIcon.style.gridRow = '1';
            bucketIcon.style.cursor = 'pointer';
            bucketIcon.style.display = 'flex';
            bucketIcon.style.alignItems = 'center';
            bucketIcon.style.justifyContent = 'flex-start';
            bucketIcon.style.paddingLeft = '4px';
            bucketIcon.title = '背景色を変更（現在のペンカラー）';
            
            bucketIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.eventBus) {
                    this.eventBus.emit('ui:background-color-change-requested', {
                        layerIndex: index,
                        layerId: layer.layerData.id
                    });
                }
            });
            
            layerDiv.appendChild(bucketIcon);
        } else {
            // Phase 6: 一般レイヤー - 透明度調整UI（ボタンのみ）
            const opacityContainer = document.createElement('div');
            opacityContainer.className = 'layer-opacity-control';
            opacityContainer.style.gridColumn = '2';
            opacityContainer.style.gridRow = '1';
            opacityContainer.style.display = 'flex';
            opacityContainer.style.alignItems = 'center';
            opacityContainer.style.gap = '2px';
            opacityContainer.style.fontSize = '11px';
            opacityContainer.style.justifyContent = 'flex-start';
            opacityContainer.style.paddingLeft = '4px';
            
            // ◀ ボタン
            const decreaseBtn = document.createElement('button');
            decreaseBtn.textContent = '◀';
            decreaseBtn.className = 'layer-opacity-decrease';
            decreaseBtn.style.padding = '0 3px';
            decreaseBtn.style.cursor = 'pointer';
            decreaseBtn.style.border = 'none';
            decreaseBtn.style.background = 'transparent';
            decreaseBtn.style.lineHeight = '1';
            decreaseBtn.style.height = '100%';
            decreaseBtn.title = '透明度 -10%';
            
            decreaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, -0.1);
            });
            
            // 透明度表示（ドラッグ無効）
            const opacityValue = document.createElement('span');
            opacityValue.className = 'layer-opacity-value';
            opacityValue.textContent = `${Math.round((layer.alpha || 1.0) * 100)}%`;
            opacityValue.style.userSelect = 'none';
            opacityValue.style.minWidth = '35px';
            opacityValue.style.textAlign = 'center';
            opacityValue.style.cursor = 'default';
            
            // ▶ ボタン
            const increaseBtn = document.createElement('button');
            increaseBtn.textContent = '▶';
            increaseBtn.className = 'layer-opacity-increase';
            increaseBtn.style.padding = '0 3px';
            increaseBtn.style.cursor = 'pointer';
            increaseBtn.style.border = 'none';
            increaseBtn.style.background = 'transparent';
            increaseBtn.style.lineHeight = '1';
            increaseBtn.style.height = '100%';
            increaseBtn.title = '透明度 +10%';
            
            increaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, 0.1);
            });
            
            opacityContainer.appendChild(decreaseBtn);
            opacityContainer.appendChild(opacityValue);
            opacityContainer.appendChild(increaseBtn);
            layerDiv.appendChild(opacityContainer);
        }

        // レイヤー名（左寄せ、ダブルクリック編集）
        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `Layer ${index}`;
        nameSpan.style.gridColumn = '2';
        nameSpan.style.gridRow = '2';
        nameSpan.style.textAlign = 'left';
        nameSpan.style.paddingLeft = '4px';
        nameSpan.style.cursor = 'text';
        nameSpan.title = 'ダブルクリックで名前変更';
        
        // ダブルクリックで名前編集
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this._editLayerName(nameSpan, index);
        });
        
        layerDiv.appendChild(nameSpan);

        // サムネイル
        const thumbnail = this.createThumbnail(layer, index);
        layerDiv.appendChild(thumbnail);

        // Phase 5: 背景レイヤーは削除ボタンを非表示
        if (!isBackground) {
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'layer-delete-button';
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" 
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                     stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                </svg>
            `;
            deleteBtn.style.gridColumn = '4';
            deleteBtn.style.gridRow = '1 / 3';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.title = 'レイヤー削除';
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem && this.layerSystem.deleteLayer) {
                    this.layerSystem.deleteLayer(index);
                }
            });
            
            layerDiv.appendChild(deleteBtn);
        }

        // レイヤー選択イベント
        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox && 
                !e.target.closest('.layer-opacity-control') && 
                !e.target.closest('.layer-background-color-button') &&
                !e.target.closest('.layer-delete-button') &&
                !e.target.closest('.layer-name')) {
                if (this.eventBus) {
                    this.eventBus.emit('ui:layer-selected', { 
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            }
        });

        // 表示切替イベント
        checkbox.addEventListener('change', (e) => {
            layer.visible = e.target.checked;
            if (this.eventBus) {
                this.eventBus.emit('ui:layer-visibility-changed', {
                    layerIndex: index,
                    visible: e.target.checked,
                    layerId: layer.layerData?.id
                });
            }
        });

        return layerDiv;
    }

    // レイヤー名編集
    _editLayerName(nameSpan, layerIndex) {
        const currentName = nameSpan.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.style.gridColumn = '2';
        input.style.gridRow = '2';
        input.style.border = '1px solid var(--futaba-maroon)';
        input.style.borderRadius = '2px';
        input.style.padding = '0 4px';
        input.style.fontSize = '11px';
        input.style.width = '100%';
        
        nameSpan.style.display = 'none';
        nameSpan.parentElement.appendChild(input);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            const newName = input.value.trim() || currentName;
            nameSpan.textContent = newName;
            nameSpan.style.display = '';
            input.remove();
            
            if (newName !== currentName && this.eventBus) {
                this.eventBus.emit('ui:layer-name-change-requested', {
                    layerIndex,
                    newName
                });
            }
        };
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                nameSpan.style.display = '';
                input.remove();
            }
        });
    }

    // Phase 6: 透明度調整（ボタン用）
    _adjustLayerOpacity(layerIndex, delta) {
        const layers = this.layerSystem?.getLayers?.();
        const layer = layers?.[layerIndex];
        if (!layer) return;
        
        const currentOpacity = layer.alpha || 1.0;
        const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
        this._setLayerOpacity(layerIndex, newOpacity);
    }

    // Phase 6: 透明度設定（統一処理）
    _setLayerOpacity(layerIndex, opacity) {
        if (this.eventBus) {
            this.eventBus.emit('ui:layer-opacity-change-requested', {
                layerIndex,
                opacity
            });
        }
    }

    createThumbnail(layer, index) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';
        thumbnail.dataset.layerIndex = String(index);
        thumbnail.style.borderRadius = '0';

        // 背景レイヤーの場合は色見本を表示
        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            swatch.style.backgroundColor = '#F0E0D6';
            thumbnail.appendChild(swatch);
            return thumbnail;
        }

        // 通常レイヤー: 必ず<img>要素を作成
        const img = document.createElement('img');
        img.alt = `Layer ${index} thumbnail`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none';
        img.dataset.layerIndex = String(index);
        img.dataset.layerId = layer.layerData?.id || `layer-${index}`;

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成・表示
        requestAnimationFrame(() => {
            this._generateAndDisplayThumbnail(layer, index, img);
        });

        return thumbnail;
    }

    async _generateAndDisplayThumbnail(layer, index, img) {
        try {
            if (!window.ThumbnailSystem) return;
            
            if (!window.ThumbnailSystem.isInitialized) {
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

            if (!bitmap) return;

            const dataURL = window.ThumbnailSystem.canvasToDataURL(bitmap);
            
            if (dataURL) {
                img.src = dataURL;
                img.style.display = 'block';
            }

        } catch (error) {
            // エラー時は無視
        }
    }

    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        
        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) return;
        
        // キャッシュ無効化
        if (layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
        }
        
        // DOM要素検索
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

        if (!layerDiv) return;

        const thumbnail = layerDiv.querySelector('.layer-thumbnail');
        let img = thumbnail?.querySelector('img');
        
        // <img>が無い場合は作成
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
        }

        if (!img) {
            // 再試行メカニズム
            const retryKey = `layer_${layerIndex}`;
            const retryCount = this._retryCounters.get(retryKey) || 0;
            
            if (retryCount < this._maxRetries) {
                this._retryCounters.set(retryKey, retryCount + 1);
                
                setTimeout(() => {
                    this.updateLayerThumbnail(layerIndex);
                }, 100 * (retryCount + 1));
                
                return;
            } else {
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
            setTimeout(() => {
                this.updateAllThumbnails();
            }, 100);
            return;
        }

        // キャッシュクリア
        window.ThumbnailSystem.clearAllCache();

        // 全レイヤーのサムネイルを更新
        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
            
            if (i < layers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    updateLayerPanelUI() {
        if (!this.layerSystem) return;
        const layers = this.layerSystem.getLayers();
        const activeIndex = this.layerSystem.activeLayerIndex;
        this.render(layers, activeIndex, this.animationSystem);
    }

    // Phase 7: レイヤードラッグレスポンス改善 + 背景レイヤー固定化
    initializeSortable() {
        if (!window.Sortable) return;
        
        try {
            if (this.sortable) {
                this.sortable.destroy();
            }

            this.sortable = Sortable.create(this.container, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                chosenClass: 'sortable-chosen',
                forceFallback: true,
                fallbackOnBody: true,
                swapThreshold: 0.65,
                
                // 背景レイヤーはドラッグ無効
                filter: '.background-layer',
                
                onChoose: (evt) => {
                    evt.item.style.opacity = '0.5';
                },
                
                onStart: (evt) => {
                    evt.item.style.cursor = 'grabbing';
                },
                
                onEnd: (evt) => {
                    evt.item.style.opacity = '';
                    evt.item.style.cursor = '';
                    
                    if (this.layerSystem?.reorderLayers) {
                        this.layerSystem.reorderLayers(evt.oldIndex, evt.newIndex);
                    }
                }
            });
        } catch (error) {
            // エラー時は無視
        }
    }

    setDebugMode(enabled) {
        this.debugEnabled = enabled;
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
    }
};

console.log('✅ ui/layer-panel-renderer.js Phase 5-7完全版v2 loaded');
console.log('   Phase 5: 背景レイヤー色変更UI + 固定化');
console.log('   Phase 6: レイヤー透明度UI（ボタンのみ）');
console.log('   Phase 7: ドラッグレスポンス改善');
console.log('   追加: レイヤー名左寄せ、ダブルクリック編集、背景ホバー無効');