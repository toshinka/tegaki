/**
 * @file layer-panel-renderer.js - Phase 3: フォルダUI実装版
 * @description レイヤーパネルUI描画（フォルダ対応）
 * 
 * 【Phase 3 改修内容】
 * ✅ createFolderElement() - フォルダUI生成
 * ✅ createFolderEar() - 耳部分SVGアイコン生成
 * ✅ 階層表示（通常レイヤー/フォルダを左オフセット、フォルダ内レイヤーに左縦線）
 * ✅ フォルダ開閉アニメーション
 * ✅ フォルダサムネイル合成表示
 * 
 * 【依存関係】
 * ◆ 親ファイル (このファイルが依存):
 *   - layer-system.js (レイヤーデータ取得 - EventBus経由のみ)
 *   - thumbnail-system.js (サムネイル生成・サイズ計算)
 *   - event-bus.js (イベント通信)
 *   - config.js (設定値)
 * 
 * ◆ 子ファイル (このファイルに依存):
 *   なし (UI層・末端ファイル)
 */

(function() {
    'use strict';

    class LayerPanelRenderer {
        constructor(container, layerSystem, eventBus) {
            this.container = container;
            this.layerSystem = layerSystem;
            this.eventBus = eventBus;
            this.sortable = null;
            this._isInitialized = false;
            this._editingLayerIndex = -1;
            this._editingInput = null;
            this._updateTimeout = null;

            this._setupEventListeners();
            
            requestAnimationFrame(() => {
                this._initializeRender();
            });
        }

        _initializeRender() {
            if (this._isInitialized) return;
            
            const layers = this.layerSystem?.getLayers() || [];
            if (layers.length === 0) {
                setTimeout(() => this._initializeRender(), 50);
                return;
            }
            
            const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
            const animationSystem = window.animationSystem || null;
            this.render(layers, activeIndex, animationSystem);
            this._isInitialized = true;
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            this.eventBus.on('layer:panel-update-requested', () => this.requestUpdate());
            this.eventBus.on('layer:created', () => this.requestUpdate());
            this.eventBus.on('folder:created', () => this.requestUpdate());
            this.eventBus.on('folder:toggled', () => this.requestUpdate());
            this.eventBus.on('layer:added-to-folder', () => this.requestUpdate());
            this.eventBus.on('layer:removed-from-folder', () => this.requestUpdate());
            this.eventBus.on('layer:deleted', () => this.requestUpdate());
            this.eventBus.on('layer:activated', () => this.requestUpdate());
            this.eventBus.on('layer:visibility-changed', () => this.requestUpdate());
            this.eventBus.on('layer:opacity-changed', () => this.requestUpdate());
            this.eventBus.on('layer:background-color-changed', () => this.requestUpdate());
            this.eventBus.on('layer:name-changed', () => this.requestUpdate());
            this.eventBus.on('animation:frame-changed', () => this.requestUpdate());
            this.eventBus.on('camera:resized', () => this.updateAllThumbnails());
            
            this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
                if (data && typeof data.layerIndex === 'number') {
                    this._updateSingleThumbnail(data.layerIndex);
                }
            });

            this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
                if (this.layerSystem?.changeBackgroundLayerColor) {
                    this.layerSystem.changeBackgroundLayerColor(layerIndex, layerId);
                }
            });

            this.eventBus.on('ui:active-panel-changed', ({ activePanel }) => {
                this._updatePanelActiveState(activePanel === 'layer');
            });

            this.eventBus.on('ui:layer-selected', ({ layerIndex }) => {
                if (this.layerSystem?.setActiveLayer) {
                    this.layerSystem.setActiveLayer(layerIndex);
                }
            });
        }

        requestUpdate() {
            if (this._updateTimeout) return;
            this._updateTimeout = setTimeout(() => {
                this._updateTimeout = null;
                const layers = this.layerSystem?.getLayers() || [];
                const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
                const animationSystem = window.animationSystem || null;
                this.render(layers, activeIndex, animationSystem);
            }, 16);
        }

        render(layers, activeIndex, animationSystem = null) {
            if (!this.container) return;
            if (!layers || layers.length === 0) return;

            this.container.innerHTML = '';
            
            // 🔧 Phase 3.1: パネル高さ固定化（レイヤー数に関わらず一定）
            this.container.style.maxHeight = '600px';
            this.container.style.overflowY = 'auto';
            this.container.style.overflowX = 'hidden';

            const reversedLayers = [...layers].reverse();
            const reversedActiveIndex = layers.length - 1 - activeIndex;

            reversedLayers.forEach((layer, reversedIndex) => {
                const originalIndex = layers.length - 1 - reversedIndex;
                const isActive = reversedIndex === reversedActiveIndex;
                
                // 🆕 フォルダ内レイヤーが閉じたフォルダ内にある場合はスキップ
                if (layer.layerData?.parentId) {
                    const parentFolder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
                    if (parentFolder && parentFolder.layerData?.isFolder && !parentFolder.layerData.folderExpanded) {
                        return;
                    }
                }
                
                const layerElement = layer.layerData?.isFolder 
                    ? this.createFolderElement(layer, originalIndex, isActive, layers)
                    : this.createLayerElement(layer, originalIndex, isActive, animationSystem);
                    
                this.container.appendChild(layerElement);
            });

            this.initializeSortable();
        }

        // ================================================================================
        // 🆕 Phase 3: フォルダUI生成
        // ================================================================================

        createFolderElement(folder, index, isActive, allLayers) {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'layer-item folder-item';
            if (isActive) {
                folderDiv.classList.add('active');
            }
            folderDiv.dataset.layerIndex = index;
            folderDiv.dataset.isFolder = 'true';

            const isExpanded = folder.layerData.folderExpanded;
            const bgColor = isExpanded ? '#e9c2ba' : '#cf9c97';
            const indentLevel = this._calculateIndentLevel(folder, allLayers);
            const leftOffset = indentLevel * 12;

            folderDiv.style.cssText = `
                width:170px;
                min-height:48px;
                background-color:${bgColor};
                opacity:0.9;
                border:1px solid #e9c2ba;
                border-radius:4px;
                padding:5px 7px;
                margin-bottom:4px;
                margin-left:${leftOffset}px;
                cursor:grab;
                display:grid;
                grid-template-columns:90px 64px;
                grid-template-rows:14px 16px 14px;
                gap:1px 1px;
                align-items:center;
                position:relative;
                backdrop-filter:blur(8px);
                transition:all 0.2s ease;
                touch-action:none;
                user-select:none;
            `;

            if (isActive) {
                folderDiv.style.borderColor = '#ff6600';
                folderDiv.style.borderWidth = '2px';
                folderDiv.style.padding = '4px 6px';
            }

            // 耳部分
            const ear = this._createFolderEar(isExpanded);
            folderDiv.appendChild(ear);

            // 行1: 透明度コントロール（フォルダには不要だが配置保持）
            const row1 = document.createElement('div');
            row1.style.cssText = 'grid-column:1;grid-row:1;height:14px;';
            folderDiv.appendChild(row1);

            // 行2: 可視性アイコン + 開閉トグルアイコン
            const row2 = document.createElement('div');
            row2.style.cssText = 'grid-column:1;grid-row:2;display:flex;align-items:center;gap:4px;height:16px;';

            const visibilityIcon = this._createVisibilityIcon(folder, index);
            row2.appendChild(visibilityIcon);

            const toggleIcon = this._createFolderToggleIcon(folder, index, isExpanded);
            row2.appendChild(toggleIcon);

            for (let i = 0; i < 2; i++) {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'width:16px;height:16px;flex-shrink:0;';
                row2.appendChild(placeholder);
            }
            folderDiv.appendChild(row2);

            // 行3: フォルダ名
            const nameSpan = this._createLayerName(folder, index);
            folderDiv.appendChild(nameSpan);

            // サムネイル: フォルダ内レイヤーの合成
            const thumbnail = this.createFolderThumbnail(folder, index, allLayers);
            thumbnail.style.cssText = 'grid-column:2;grid-row:1/4;display:flex;align-items:center;justify-content:center;';
            folderDiv.appendChild(thumbnail);

            // 削除ボタン
            const deleteBtn = this._createDeleteButton(index);
            folderDiv.appendChild(deleteBtn);
            
            folderDiv.addEventListener('mouseenter', () => {
                deleteBtn.style.opacity = '1';
            });
            
            folderDiv.addEventListener('mouseleave', () => {
                deleteBtn.style.opacity = '0';
            });

            folderDiv.addEventListener('click', (e) => {
                if (e.target.closest('.layer-delete-button') ||
                    e.target.closest('.layer-visibility') ||
                    e.target.closest('.folder-toggle-icon') ||
                    e.target.closest('.layer-name') ||
                    this._editingLayerIndex >= 0) {
                    return;
                }

                if (window.stateManager) {
                    window.stateManager.setLastActivePanel('layer');
                }

                if (this.layerSystem?.setActiveLayer) {
                    this.layerSystem.setActiveLayer(index);
                }
            });

            return folderDiv;
        }

        /**
         * 🆕 フォルダの耳部分（左上SVGアイコン付き）
         */
        _createFolderEar(isExpanded) {
            const ear = document.createElement('div');
            ear.className = 'folder-ear';
            ear.style.cssText = `
                position:absolute;
                top:0;
                left:0;
                width:30px;
                height:14px;
                background-color:#cf9c97;
                border-radius:4px 0 4px 0;
                display:flex;
                align-items:center;
                justify-content:center;
                pointer-events:none;
            `;

            const iconSVG = isExpanded 
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;

            ear.innerHTML = iconSVG;
            return ear;
        }

        /**
         * 🆕 フォルダ開閉トグルアイコン
         */
        _createFolderToggleIcon(folder, index, isExpanded) {
            const toggleIcon = document.createElement('div');
            toggleIcon.className = 'folder-toggle-icon';
            toggleIcon.style.cssText = 'cursor:pointer;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
            
            toggleIcon.innerHTML = isExpanded
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
            
            toggleIcon.title = isExpanded ? 'フォルダを閉じる' : 'フォルダを開く';
            
            toggleIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem?.toggleFolderExpand) {
                    this.layerSystem.toggleFolderExpand(folder.layerData.id);
                }
            });
            
            return toggleIcon;
        }

        /**
         * 🆕 フォルダサムネイル生成（中のレイヤー合成）
         */
        createFolderThumbnail(folder, index, allLayers) {
            const maxWidth = 64;
            const maxHeight = 44;
            
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'layer-thumbnail folder-thumbnail';
            thumbnailContainer.dataset.layerIndex = index;
            
            thumbnailContainer.style.width = maxWidth + 'px';
            thumbnailContainer.style.height = maxHeight + 'px';
            thumbnailContainer.style.boxSizing = 'border-box';
            thumbnailContainer.style.border = '1px solid #cf9c97';
            thumbnailContainer.style.borderRadius = '2px';
            thumbnailContainer.style.overflow = 'hidden';
            thumbnailContainer.style.position = 'relative';
            thumbnailContainer.style.display = 'flex';
            thumbnailContainer.style.alignItems = 'center';
            thumbnailContainer.style.justifyContent = 'center';
            thumbnailContainer.style.flexShrink = '0';
            thumbnailContainer.style.backgroundColor = '#f5f5f5';
            
            if (window.ThumbnailSystem && folder) {
                this._generateFolderThumbnail(folder, allLayers, maxWidth, maxHeight)
                    .then(result => {
                        if (result && result.dataUrl) {
                            thumbnailContainer.style.width = result.width + 'px';
                            thumbnailContainer.style.height = result.height + 'px';
                            
                            const img = document.createElement('img');
                            img.src = result.dataUrl;
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.display = 'block';
                            img.style.objectFit = 'contain';
                            thumbnailContainer.innerHTML = '';
                            thumbnailContainer.appendChild(img);
                        }
                    })
                    .catch(() => {});
            }

            return thumbnailContainer;
        }

        /**
         * 🆕 フォルダ内レイヤー合成サムネイル生成
         */
        async _generateFolderThumbnail(folder, allLayers, maxWidth, maxHeight) {
            const children = this.layerSystem.getFolderChildren(folder.layerData.id);
            
            if (children.length === 0) {
                return null;
            }

            // ThumbnailSystemに委譲
            if (window.ThumbnailSystem?.generateFolderThumbnail) {
                return await window.ThumbnailSystem.generateFolderThumbnail(
                    children, 
                    maxWidth, 
                    maxHeight
                );
            }

            return null;
        }

        /**
         * 🆕 階層レベル計算（左オフセット用）
         */
        _calculateIndentLevel(layer, allLayers) {
            if (layer.layerData?.isBackground) return 0;
            
            // 🔧 修正: 通常レイヤー/フォルダは左にオフセットせず、フォルダ内だけ右にオフセット
            if (!layer.layerData?.parentId) return 0; // 通常レイヤー/フォルダは左端
            
            // フォルダ内レイヤーは右にオフセット
            return 1;
        }

        // ================================================================================
        // 既存メソッド（Phase 3対応版）
        // ================================================================================

        createLayerElement(layer, index, isActive, animationSystem) {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'layer-item';
            if (isActive) {
                layerDiv.classList.add('active');
            }
            layerDiv.dataset.layerIndex = index;

            const isBackground = layer.layerData?.isBackground || false;
            const allLayers = this.layerSystem?.getLayers() || [];
            const indentLevel = this._calculateIndentLevel(layer, allLayers);
            const leftOffset = indentLevel * 12;
            const hasParent = layer.layerData?.parentId;
            
            layerDiv.style.cssText = `
                width:170px;
                min-height:48px;
                background-color:#ffffee;
                opacity:0.9;
                border:1px solid #e9c2ba;
                border-radius:4px;
                padding:5px 7px;
                margin-bottom:4px;
                margin-left:${leftOffset}px;
                cursor:${isBackground ? 'default' : 'grab'};
                display:grid;
                grid-template-columns:90px 64px;
                grid-template-rows:14px 16px 14px;
                gap:1px 1px;
                align-items:center;
                position:relative;
                backdrop-filter:blur(8px);
                transition:all 0.2s ease;
                touch-action:none;
                user-select:none;
            `;

            if (isActive && !isBackground) {
                layerDiv.style.borderColor = '#ff6600';
                layerDiv.style.borderWidth = '2px';
                layerDiv.style.padding = '4px 6px';
            }

            // 🆕 フォルダ内レイヤーに左縦線を追加
            if (hasParent) {
                const verticalLine = document.createElement('div');
                verticalLine.className = 'folder-child-line';
                verticalLine.style.cssText = `
                    position:absolute;
                    left:-12px;
                    top:0;
                    width:2px;
                    height:100%;
                    background-color:#cf9c97;
                `;
                layerDiv.appendChild(verticalLine);
            }

            if (isBackground) {
                const row1 = document.createElement('div');
                row1.style.cssText = 'grid-column:1;grid-row:1;height:14px;';
                layerDiv.appendChild(row1);

                const row2 = document.createElement('div');
                row2.style.cssText = 'grid-column:1;grid-row:2;display:flex;align-items:center;gap:4px;height:16px;';

                const visibilityIcon = this._createVisibilityIcon(layer, index);
                row2.appendChild(visibilityIcon);

                const spacer = document.createElement('div');
                spacer.style.cssText = 'width:16px;height:16px;flex-shrink:0;';
                row2.appendChild(spacer);

                const bucketIcon = this._createBucketIcon(index, layer);
                row2.appendChild(bucketIcon);
                layerDiv.appendChild(row2);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'layer-name';
                nameSpan.textContent = '背景';
                nameSpan.style.cssText = `grid-column:1;grid-row:3;color:#800000;font-size:10px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:default;padding:0;height:14px;display:flex;align-items:center;`;
                layerDiv.appendChild(nameSpan);

                const thumbnail = this.createThumbnail(layer, index);
                thumbnail.style.cssText = 'grid-column:2;grid-row:1/4;display:flex;align-items:center;justify-content:center;';
                layerDiv.appendChild(thumbnail);

                layerDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });

                return layerDiv;
            }

            const row1 = document.createElement('div');
            row1.style.cssText = 'grid-column:1;grid-row:1;display:flex;align-items:center;gap:2px;justify-content:flex-start;height:14px;';

            const folderPlaceholder = document.createElement('div');
            folderPlaceholder.style.cssText = 'width:14px;height:14px;flex-shrink:0;';
            row1.appendChild(folderPlaceholder);

            const opacityContainer = this._createOpacityControl(layer, index);
            row1.appendChild(opacityContainer);
            layerDiv.appendChild(row1);

            const row2 = document.createElement('div');
            row2.style.cssText = 'grid-column:1;grid-row:2;display:flex;align-items:center;gap:4px;height:16px;';

            const visibilityIcon = this._createVisibilityIcon(layer, index);
            row2.appendChild(visibilityIcon);

            for (let i = 0; i < 3; i++) {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'width:16px;height:16px;flex-shrink:0;';
                row2.appendChild(placeholder);
            }
            layerDiv.appendChild(row2);

            const nameSpan = this._createLayerName(layer, index);
            layerDiv.appendChild(nameSpan);

            const thumbnail = this.createThumbnail(layer, index);
            thumbnail.style.cssText = 'grid-column:2;grid-row:1/4;display:flex;align-items:center;justify-content:center;';
            layerDiv.appendChild(thumbnail);

            const deleteBtn = this._createDeleteButton(index);
            layerDiv.appendChild(deleteBtn);
            
            layerDiv.addEventListener('mouseenter', () => {
                deleteBtn.style.opacity = '1';
            });
            
            layerDiv.addEventListener('mouseleave', () => {
                deleteBtn.style.opacity = '0';
            });

            layerDiv.addEventListener('click', (e) => {
                if (e.target.closest('.layer-delete-button') ||
                    e.target.closest('.layer-opacity-control button') ||
                    e.target.closest('.layer-visibility') ||
                    e.target.closest('.layer-name') ||
                    this._editingLayerIndex >= 0) {
                    return;
                }

                if (window.stateManager) {
                    window.stateManager.setLastActivePanel('layer');
                }

                if (this.layerSystem?.setActiveLayer) {
                    this.layerSystem.setActiveLayer(index);
                }
            });

            return layerDiv;
        }

        _createVisibilityIcon(layer, index) {
            const visibilityIcon = document.createElement('div');
            visibilityIcon.className = 'layer-visibility';
            visibilityIcon.style.cssText = 'cursor:pointer;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
            
            const isVisible = layer.layerData?.visible !== false;
            visibilityIcon.innerHTML = isVisible ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                </svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                    <path d="m2 2 20 20"/>
                </svg>`;
            
            visibilityIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem?.toggleLayerVisibility) {
                    this.layerSystem.toggleLayerVisibility(index);
                }
            });
            
            return visibilityIcon;
        }

        _createBucketIcon(index, layer) {
            const bucketIcon = document.createElement('div');
            bucketIcon.className = 'layer-background-color-button';
            bucketIcon.style.cssText = 'cursor:pointer;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
            bucketIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" 
                     viewBox="0 0 24 24" fill="none" stroke="#800000" 
                     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                    <path d="m5 2 5 5"/>
                    <path d="M2 13h15"/>
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                </svg>
            `;
            bucketIcon.title = '背景色を現在のペンカラーに変更';
            bucketIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.eventBus) {
                    this.eventBus.emit('ui:background-color-change-requested', {
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            });
            return bucketIcon;
        }

        _createOpacityControl(layer, index) {
            const opacityContainer = document.createElement('div');
            opacityContainer.className = 'layer-opacity-control';
            opacityContainer.style.cssText = 'display:flex;align-items:center;gap:2px;font-size:10px;user-select:none;';

            const decreaseBtn = document.createElement('button');
            decreaseBtn.textContent = '◀';
            decreaseBtn.style.cssText = 'padding:0;font-size:9px;line-height:1;height:12px;width:12px;cursor:pointer;border:none;background:transparent;color:#800000;flex-shrink:0;';
            decreaseBtn.title = '透明度 -10%';
            decreaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, -0.1);
            });

            const opacityValue = document.createElement('span');
            opacityValue.className = 'layer-opacity-value';
            const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
            opacityValue.style.cssText = 'min-width:30px;text-align:center;color:#800000;font-size:9px;font-weight:bold;flex-shrink:0;';

            const increaseBtn = document.createElement('button');
            increaseBtn.textContent = '▶';
            increaseBtn.style.cssText = 'padding:0;font-size:9px;line-height:1;height:12px;width:12px;cursor:pointer;border:none;background:transparent;color:#800000;flex-shrink:0;';
            increaseBtn.title = '透明度 +10%';
            increaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, 0.1);
            });

            opacityContainer.appendChild(decreaseBtn);
            opacityContainer.appendChild(opacityValue);
            opacityContainer.appendChild(increaseBtn);
            
            return opacityContainer;
        }

        _createLayerName(layer, index) {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
            nameSpan.style.cssText = `grid-column:1;grid-row:3;color:#800000;font-size:10px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:text;padding:0;height:14px;display:flex;align-items:center;`;
            
            let clickCount = 0;
            let clickTimer = null;
            
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                clickCount++;
                
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                    }, 300);
                } else if (clickCount === 2) {
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    
                    if (this._editingLayerIndex === -1) {
                        this._editLayerName(nameSpan, layer, index);
                    }
                }
            });
            
            return nameSpan;
        }

        _createDeleteButton(index) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'layer-delete-button';
            deleteBtn.style.cssText = 'position:absolute;top:3px;right:3px;padding:0;width:13px;height:13px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;border-radius:50%;background:#cf9c97;transition:background 0.2s,transform 0.1s,opacity 0.2s;z-index:10;opacity:0;';
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ffffee" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
            </svg>`;
            deleteBtn.title = 'レイヤーを削除';
            
            deleteBtn.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#800000';
                this.style.transform = 'scale(1.15)';
            });
            
            deleteBtn.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '#cf9c97';
                this.style.transform = 'scale(1)';
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem?.deleteLayer) {
                    this.layerSystem.deleteLayer(index);
                }
            });
            
            return deleteBtn;
        }

        createThumbnail(layer, index) {
            const maxWidth = 64;
            const maxHeight = 44;
            
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'layer-thumbnail';
            thumbnailContainer.dataset.layerIndex = index;
            
            thumbnailContainer.style.width = maxWidth + 'px';
            thumbnailContainer.style.height = maxHeight + 'px';
            thumbnailContainer.style.boxSizing = 'border-box';
            thumbnailContainer.style.border = '1px solid #cf9c97';
            thumbnailContainer.style.borderRadius = '2px';
            thumbnailContainer.style.overflow = 'hidden';
            thumbnailContainer.style.position = 'relative';
            thumbnailContainer.style.display = 'flex';
            thumbnailContainer.style.alignItems = 'center';
            thumbnailContainer.style.justifyContent = 'center';
            thumbnailContainer.style.flexShrink = '0';
            thumbnailContainer.style.backgroundColor = '#f5f5f5';
            
            if (window.ThumbnailSystem && layer) {
                window.ThumbnailSystem.generateLayerThumbnail(layer, index, maxWidth, maxHeight)
                    .then(result => {
                        if (result && result.dataUrl) {
                            thumbnailContainer.style.width = result.width + 'px';
                            thumbnailContainer.style.height = result.height + 'px';
                            
                            const img = document.createElement('img');
                            img.src = result.dataUrl;
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.display = 'block';
                            img.style.objectFit = 'contain';
                            thumbnailContainer.innerHTML = '';
                            thumbnailContainer.appendChild(img);
                        }
                    })
                    .catch(() => {});
            }

            return thumbnailContainer;
        }

        _editLayerName(nameSpan, layer, index) {
            if (layer.layerData?.isBackground || this._editingLayerIndex >= 0) {
                return;
            }

            this._editingLayerIndex = index;

            const originalName = nameSpan.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = originalName;
            input.style.cssText = `grid-column:${nameSpan.style.gridColumn};grid-row:${nameSpan.style.gridRow};color:#800000;font-size:10px;font-weight:bold;background:#fff;border:1px solid #800000;border-radius:2px;padding:1px 3px;width:100%;box-sizing:border-box;height:14px;`;

            nameSpan.replaceWith(input);
            this._editingInput = input;
            
            requestAnimationFrame(() => {
                input.focus();
                input.select();
            });

            const finishEdit = () => {
                if (this._editingLayerIndex !== index || !this._editingInput) return;
                
                this._editingLayerIndex = -1;
                const currentInput = this._editingInput;
                this._editingInput = null;

                const newName = currentInput.value.trim();
                if (newName && newName !== originalName) {
                    if (layer.layerData) {
                        layer.layerData.name = newName;
                    }
                    if (this.eventBus) {
                        this.eventBus.emit('layer:name-changed', {
                            layerIndex: index,
                            layerId: layer.layerData?.id,
                            oldName: originalName,
                            newName: newName
                        });
                    }
                }
                
                nameSpan.textContent = newName || originalName;
                currentInput.replaceWith(nameSpan);
            };

            input.addEventListener('blur', () => {
                setTimeout(() => finishEdit(), 150);
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    finishEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = originalName;
                    finishEdit();
                }
            });
            
            input.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        async _updateSingleThumbnail(layerIndex) {
            const layers = this.layerSystem?.getLayers() || [];
            if (layerIndex < 0 || layerIndex >= layers.length) return;

            const reversedIndex = layers.length - 1 - layerIndex;
            const layerItems = this.container.querySelectorAll('.layer-item');
            if (reversedIndex < 0 || reversedIndex >= layerItems.length) return;

            const thumbnailContainer = layerItems[reversedIndex].querySelector('.layer-thumbnail');
            if (!thumbnailContainer) return;

            const layer = layers[layerIndex];
            const maxWidth = 64;
            const maxHeight = 44;

            if (window.ThumbnailSystem) {
                try {
                    const result = await window.ThumbnailSystem.generateLayerThumbnail(layer, layerIndex, maxWidth, maxHeight);
                    if (result && result.dataUrl) {
                        thumbnailContainer.style.width = result.width + 'px';
                        thumbnailContainer.style.height = result.height + 'px';
                        
                        const img = document.createElement('img');
                        img.src = result.dataUrl;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.display = 'block';
                        img.style.objectFit = 'contain';
                        thumbnailContainer.innerHTML = '';
                        thumbnailContainer.appendChild(img);
                    }
                } catch (error) {}
            }
        }

        async updateAllThumbnails() {
            const layers = this.layerSystem?.getLayers() || [];
            for (let i = 0; i < layers.length; i++) {
                await this._updateSingleThumbnail(i);
            }
        }

        _adjustLayerOpacity(layerIndex, delta) {
            const layer = this.layerSystem.getLayers()[layerIndex];
            const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
            this._setLayerOpacity(layerIndex, newOpacity);
        }

        _setLayerOpacity(layerIndex, opacity) {
            if (this.layerSystem.setLayerOpacity) {
                this.layerSystem.setLayerOpacity(layerIndex, opacity);
            }

            const layers = this.layerSystem.getLayers();
            const reversedIndex = layers.length - 1 - layerIndex;
            const layerDiv = this.container.querySelectorAll('.layer-item')[reversedIndex];
            const opacityValue = layerDiv?.querySelector('.layer-opacity-value');
            if (opacityValue) {
                opacityValue.textContent = `${Math.round(opacity * 100)}%`;
            }
        }

        _updatePanelActiveState(isActive) {
            const activeLayer = this.container.querySelector('.layer-item.active');
            if (!activeLayer) return;

            if (isActive) {
                activeLayer.style.borderColor = '#ff6600';
            } else {
                activeLayer.style.borderColor = '#aa5a56';
            }
        }

        initializeSortable() {
            if (!window.Sortable) return;

            try {
                if (this.sortable) {
                    this.sortable.destroy();
                }

                this.sortable = window.Sortable.create(this.container, {
                    animation: 200,
                    easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    chosenClass: 'sortable-chosen',
                    forceFallback: false,
                    fallbackOnBody: false,
                    swapThreshold: 0.65,
                    delay: 0,
                    delayOnTouchOnly: false,

                    filter: (evt) => {
                        const item = evt.target.closest('.layer-item');
                        if (!item) return false;
                        const layerIndex = parseInt(item.dataset.layerIndex);
                        const layers = this.layerSystem?.getLayers() || [];
                        const layer = layers[layerIndex];
                        return layer?.layerData?.isBackground || false;
                    },

                    onChoose: (evt) => {
                        const item = evt.item;
                        item.style.cursor = 'grabbing';
                    },

                    onEnd: (evt) => {
                        evt.item.style.opacity = '';
                        evt.item.style.cursor = '';

                        if (this.layerSystem?.reorderLayers) {
                            const layers = this.layerSystem.getLayers();
                            const oldIndex = layers.length - 1 - evt.oldIndex;
                            const newIndex = layers.length - 1 - evt.newIndex;
                            this.layerSystem.reorderLayers(oldIndex, newIndex);
                        }
                    }
                });
            } catch (error) {}
        }

        destroy() {
            if (this.sortable) {
                this.sortable.destroy();
                this.sortable = null;
            }
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
            }
            this._editingLayerIndex = -1;
            this._editingInput = null;
        }
    }

    window.LayerPanelRenderer = LayerPanelRenderer;
})();

console.log('✅ layer-panel-renderer.js Phase 3: フォルダUI実装版 loaded');
console.log('   ✅ createFolderElement() - フォルダUI生成');
console.log('   ✅ createFolderEar() - 耳部分SVGアイコン');
console.log('   ✅ 階層表示（左オフセット + 縦線）');
console.log('   ✅ フォルダ開閉アニメーション');
console.log('   ✅ フォルダサムネイル合成対応');