/**
 * UI Panels (Phase2)
 * PixiJS v8.13 対応版
 * レイヤーパネルとUI制御
 */
(function() {
    'use strict';

    class TegakiUI {
        constructor() {
            this.callbacks = {
                onLayerSelect: null,
                onLayerVisibilityToggle: null,
                onLayerDelete: null,
                onLayerRename: null
            };
            
            this.layersData = [];
            this.sortableInstance = null;
        }

        /**
         * コールバック設定
         */
        setCallbacks(callbacks) {
            Object.assign(this.callbacks, callbacks);
        }

        /**
         * レイヤーデータ更新
         */
        updateLayers(layersData) {
            this.layersData = layersData || [];
            this.renderLayerPanel();
        }

        /**
         * レイヤーパネル描画
         */
        renderLayerPanel() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';

            // レイヤーを逆順で表示（上が最前面）
            const reversedLayers = [...this.layersData].reverse();

            reversedLayers.forEach((layer, displayIndex) => {
                const actualIndex = this.layersData.length - 1 - displayIndex;
                const layerItem = this.createLayerItem(layer, actualIndex);
                layerList.appendChild(layerItem);
            });

            // SortableJS初期化
            this.initializeSortable();
        }

        /**
         * レイヤーアイテム作成
         */
        createLayerItem(layer, index) {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layer.active ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            layerItem.dataset.layerIndex = index;

            layerItem.innerHTML = `
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${layer.visible ? 
                            '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                            '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                    </svg>
                </div>
                <div class="layer-name">${layer.name}</div>
                <div class="layer-thumbnail">
                    <div class="layer-thumbnail-placeholder"></div>
                </div>
                <div class="layer-opacity">${Math.round((layer.opacity || 1) * 100)}%</div>
                <div class="layer-delete-button ${layer.locked ? 'disabled' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                    </svg>
                </div>
            `;

            // イベントリスナー追加
            this.setupLayerItemEvents(layerItem, layer, index);

            return layerItem;
        }

        /**
         * レイヤーアイテムイベント設定
         */
        setupLayerItemEvents(layerItem, layer, index) {
            // レイヤー選択
            layerItem.addEventListener('click', (e) => {
                const target = e.target.closest('[class*="layer-"]');
                if (target) {
                    const action = target.className;
                    if (action.includes('layer-visibility')) {
                        this.toggleLayerVisibility(index);
                        e.stopPropagation();
                    } else if (action.includes('layer-delete') && !layer.locked) {
                        this.deleteLayer(index);
                        e.stopPropagation();
                    } else {
                        this.selectLayer(index);
                    }
                } else {
                    this.selectLayer(index);
                }
            });

            // レイヤー名ダブルクリックで編集
            const layerName = layerItem.querySelector('.layer-name');
            if (layerName) {
                layerName.addEventListener('dblclick', (e) => {
                    this.editLayerName(layerName, layer, index);
                    e.stopPropagation();
                });
            }
        }

        /**
         * レイヤー選択
         */
        selectLayer(index) {
            if (this.callbacks.onLayerSelect) {
                this.callbacks.onLayerSelect(index);
            }
        }

        /**
         * レイヤー可視性切り替え
         */
        toggleLayerVisibility(index) {
            if (this.callbacks.onLayerVisibilityToggle) {
                this.callbacks.onLayerVisibilityToggle(index);
            }
        }

        /**
         * レイヤー削除
         */
        deleteLayer(index) {
            if (this.callbacks.onLayerDelete) {
                this.callbacks.onLayerDelete(index);
            }
        }

        /**
         * レイヤー名編集
         */
        editLayerName(nameElement, layer, index) {
            const currentName = layer.name;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'layer-name-input';
            input.style.cssText = `
                width: 100%;
                border: 1px solid #800000;
                border-radius: 3px;
                padding: 2px 4px;
                font-size: 12px;
                background: white;
                color: #2c1810;
            `;

            const finishEdit = () => {
                const newName = input.value.trim() || currentName;
                nameElement.textContent = newName;
                nameElement.style.display = '';
                
                if (newName !== currentName && this.callbacks.onLayerRename) {
                    this.callbacks.onLayerRename(index, newName);
                }
            };

            const cancelEdit = () => {
                nameElement.textContent = currentName;
                nameElement.style.display = '';
            };

            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            });

            nameElement.style.display = 'none';
            nameElement.parentNode.insertBefore(input, nameElement.nextSibling);
            input.focus();
            input.select();
        }

        /**
         * SortableJS初期化
         */
        initializeSortable() {
            const layerList = document.getElementById('layer-list');
            if (!layerList || !window.Sortable) return;

            // 既存のSortableインスタンスを破棄
            if (this.sortableInstance) {
                this.sortableInstance.destroy();
            }

            this.sortableInstance = window.Sortable.create(layerList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onEnd: (evt) => {
                    const fromIndex = evt.oldIndex;
                    const toIndex = evt.newIndex;
                    
                    if (fromIndex !== toIndex && this.callbacks.onLayerMove) {
                        // レイヤー順序は逆転表示なので計算調整
                        const actualFromIndex = this.layersData.length - 1 - fromIndex;
                        const actualToIndex = this.layersData.length - 1 - toIndex;
                        this.callbacks.onLayerMove(actualFromIndex, actualToIndex);
                    }
                }
            });
        }

        /**
         * レイヤー追加ボタンイベント設定
         */
        setupAddLayerButton(callback) {
            const addButton = document.getElementById('add-layer-btn');
            if (addButton) {
                addButton.addEventListener('click', callback);
            }
        }

        /**
         * ツールパネル設定
         */
        setupToolPanel(callbacks) {
            const penTool = document.getElementById('pen-tool');
            const eraserTool = document.getElementById('eraser-tool');

            if (penTool && callbacks.onToolSelect) {
                penTool.addEventListener('click', () => {
                    callbacks.onToolSelect('pen');
                    this.setActiveToolButton(penTool);
                });
            }

            if (eraserTool && callbacks.onToolSelect) {
                eraserTool.addEventListener('click', () => {
                    callbacks.onToolSelect('eraser');
                    this.setActiveToolButton(eraserTool);
                });
            }
        }

        /**
         * アクティブツールボタン設定
         */
        setActiveToolButton(activeButton) {
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }

        /**
         * ステータス更新
         */
        updateStatus(status) {
            // キャンバス情報
            if (status.canvas && status.canvas.width && status.canvas.height) {
                const canvasInfo = document.getElementById('canvas-info');
                if (canvasInfo) {
                    canvasInfo.textContent = `${status.canvas.width}×${status.canvas.height}px`;
                }
            }

            // 現在のツール
            if (status.currentTool) {
                const toolElement = document.getElementById('current-tool');
                if (toolElement) {
                    const toolNames = {
                        pen: 'ベクターペン',
                        eraser: '消しゴム'
                    };
                    toolElement.textContent = toolNames[status.currentTool] || status.currentTool;
                }
            }

            // 現在のレイヤー
            if (status.currentLayer) {
                const layerElement = document.getElementById('current-layer');
                if (layerElement) {
                    layerElement.textContent = status.currentLayer;
                }
            }

            // FPS
            if (status.fps !== undefined) {
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = status.fps;
                }
            }
        }

        /**
         * エラー表示
         */
        showError(title, message) {
            const errorPanel = document.getElementById('error-panel');
            if (!errorPanel) return;

            const errorTitle = errorPanel.querySelector('.error-title');
            const errorMessage = errorPanel.querySelector('.error-message');

            if (errorTitle) errorTitle.textContent = title;
            if (errorMessage) errorMessage.textContent = message;

            errorPanel.classList.add('show');

            // 5秒後に自動で隠す
            setTimeout(() => {
                errorPanel.classList.remove('show');
            }, 5000);
        }

        /**
         * エラー非表示
         */
        hideError() {
            const errorPanel = document.getElementById('error-panel');
            if (errorPanel) {
                errorPanel.classList.remove('show');
            }
        }

        /**
         * CSS追加
         */
        addStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .layer-name-input {
                    width: 100% !important;
                    border: 1px solid #800000 !important;
                    border-radius: 3px !important;
                    padding: 2px 4px !important;
                    font-size: 12px !important;
                    background: white !important;
                    color: #2c1810 !important;
                    outline: none !important;
                }
                
                .sortable-ghost {
                    opacity: 0.4;
                    background: rgba(128, 0, 0, 0.1);
                }
                
                .sortable-chosen {
                    background: rgba(128, 0, 0, 0.2);
                }
                
                .sortable-drag {
                    background: rgba(128, 0, 0, 0.15);
                    transform: rotate(5deg);
                }

                .layer-visibility {
                    grid-column: 1;
                    grid-row: 1 / 3;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 3px;
                    transition: all 0.2s ease;
                    align-self: center;
                }

                .layer-visibility:hover {
                    background: var(--futaba-light-medium);
                }

                .layer-visibility svg {
                    width: 16px;
                    height: 16px;
                    stroke: #800000;
                }

                .layer-visibility.hidden svg {
                    opacity: 0.3;
                }

                .layer-name {
                    grid-column: 2;
                    grid-row: 2;
                    font-size: 12px;
                    color: var(--text-primary);
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    align-self: end;
                    margin-bottom: 2px;
                    max-width: calc(100% - 8px);
                }

                .layer-thumbnail {
                    grid-column: 3;
                    grid-row: 1 / 3;
                    min-width: 24px;
                    max-width: 72px;
                    height: 48px;
                    background: var(--futaba-background);
                    border: 1px solid var(--futaba-light-medium);
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    align-self: center;
                    flex-shrink: 0;
                }

                .layer-opacity {
                    grid-column: 2;
                    grid-row: 1;
                    font-size: 10px;
                    color: var(--text-secondary);
                    align-self: start;
                    margin-top: 2px;
                }

                .layer-delete-button {
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    width: 16px;
                    height: 16px;
                    background: rgba(244, 67, 54, 0.8);
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.2s ease;
                }

                .layer-item:hover .layer-delete-button {
                    opacity: 1;
                }

                .layer-delete-button:hover {
                    background: rgba(244, 67, 54, 1);
                }

                .layer-delete-button svg {
                    width: 12px;
                    height: 12px;
                    stroke: white;
                    stroke-width: 2;
                }

                .layer-delete-button.disabled {
                    display: none;
                }
            `;
            
            document.head.appendChild(style);
        }

        /**
         * 破棄処理
         */
        destroy() {
            if (this.sortableInstance) {
                this.sortableInstance.destroy();
                this.sortableInstance = null;
            }
            
            this.callbacks = {};
            this.layersData = [];
        }
    }

    // インスタンス作成とグローバル公開
    const tegakiUI = new TegakiUI();
    
    // CSS追加
    tegakiUI.addStyles();
    
    window.TegakiUI = tegakiUI;
    
    console.log('✅ ui-panels.js loaded (Phase2)');
})();