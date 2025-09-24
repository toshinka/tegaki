/**
 * UI Panels (Phase2)
 * PixiJS v8.13 対応版
 * レイヤーパネルとツールパネルのUI管理
 */
(function() {
    'use strict';

    class UIManager {
        constructor() {
            this.callbacks = {
                onLayerSelect: null,
                onLayerVisibilityToggle: null,
                onLayerDelete: null,
                onLayerRename: null,
                onLayerMove: null
            };
            
            this.elements = {
                layersList: null,
                toolPanel: null,
                statusInfo: null
            };
            
            this.layersData = [];
        }

        /**
         * 初期化
         */
        initialize() {
            this.cacheElements();
            this.setupEventListeners();
            console.log('✅ UIManager initialized');
        }

        /**
         * DOM要素キャッシュ
         */
        cacheElements() {
            this.elements.layersList = document.getElementById('layers-list');
            this.elements.toolPanel = document.getElementById('tool-panel');
            this.elements.statusInfo = document.getElementById('status-info');
        }

        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            // レイヤーリストのイベント委譲
            if (this.elements.layersList) {
                this.elements.layersList.addEventListener('click', (e) => {
                    this.handleLayerListClick(e);
                });
                
                this.elements.layersList.addEventListener('dblclick', (e) => {
                    this.handleLayerListDoubleClick(e);
                });
            }
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
            this.renderLayersList();
        }

        /**
         * レイヤーリスト描画
         */
        renderLayersList() {
            if (!this.elements.layersList) return;

            const html = this.layersData.map((layer, index) => {
                return `
                    <div class="layer-item ${layer.active ? 'active' : ''}" 
                         data-layer-index="${index}" 
                         data-layer-id="${layer.id}">
                        
                        <!-- 可視性ボタン -->
                        <button class="layer-visibility-btn" 
                                data-action="toggle-visibility"
                                title="${layer.visible ? '非表示' : '表示'}">
                            ${layer.visible ? '👁' : '🚫'}
                        </button>
                        
                        <!-- レイヤー名 -->
                        <div class="layer-name" data-action="select">
                            ${this.escapeHtml(layer.name)}
                        </div>
                        
                        <!-- コントロール -->
                        <div class="layer-controls">
                            <!-- 不透明度 -->
                            <input type="range" 
                                   class="layer-opacity-slider" 
                                   min="0" max="100" 
                                   value="${Math.round(layer.opacity * 100)}"
                                   data-action="opacity"
                                   title="不透明度: ${Math.round(layer.opacity * 100)}%">
                            
                            <!-- 削除ボタン -->
                            <button class="layer-delete-btn" 
                                    data-action="delete"
                                    title="削除" 
                                    ${this.layersData.length <= 1 ? 'disabled' : ''}>
                                🗑
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            this.elements.layersList.innerHTML = html;
        }

        /**
         * レイヤーリストクリックハンドリング
         */
        handleLayerListClick(e) {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;

            const index = parseInt(layerItem.dataset.layerIndex);
            const action = e.target.dataset.action;

            switch (action) {
                case 'select':
                    if (this.callbacks.onLayerSelect) {
                        this.callbacks.onLayerSelect(index);
                    }
                    break;

                case 'toggle-visibility':
                    e.stopPropagation();
                    if (this.callbacks.onLayerVisibilityToggle) {
                        this.callbacks.onLayerVisibilityToggle(index);
                    }
                    break;

                case 'delete':
                    e.stopPropagation();
                    if (this.callbacks.onLayerDelete && this.layersData.length > 1) {
                        if (confirm('このレイヤーを削除しますか？')) {
                            this.callbacks.onLayerDelete(index);
                        }
                    }
                    break;

                case 'opacity':
                    e.stopPropagation();
                    const opacity = parseFloat(e.target.value) / 100;
                    if (this.callbacks.onLayerOpacity) {
                        this.callbacks.onLayerOpacity(index, opacity);
                    }
                    // ツールチップ更新
                    e.target.title = `不透明度: ${Math.round(opacity * 100)}%`;
                    break;

                default:
                    // レイヤー選択（デフォルト）
                    if (this.callbacks.onLayerSelect) {
                        this.callbacks.onLayerSelect(index);
                    }
                    break;
            }
        }

        /**
         * レイヤーリストダブルクリックハンドリング
         */
        handleLayerListDoubleClick(e) {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;

            const layerName = layerItem.querySelector('.layer-name');
            if (!layerName || e.target !== layerName) return;

            const index = parseInt(layerItem.dataset.layerIndex);
            this.startLayerNameEdit(index, layerName);
        }

        /**
         * レイヤー名編集開始
         */
        startLayerNameEdit(index, nameElement) {
            const currentName = nameElement.textContent.trim();
            
            // 入力フィールド作成
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'layer-name-input';
            input.style.cssText = `
                width: 100%;
                background: transparent;
                border: 1px solid #0078d4;
                color: inherit;
                font: inherit;
                padding: 2px 4px;
                border-radius: 2px;
            `;

            // 編集終了処理
            const finishEdit = () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    if (this.callbacks.onLayerRename) {
                        this.callbacks.onLayerRename(index, newName);
                    }
                }
                
                nameElement.textContent = newName || currentName;
                nameElement.style.display = '';
                input.remove();
            };

            // イベント設定
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    finishEdit();
                } else if (e.key === 'Escape') {
                    nameElement.style.display = '';
                    input.remove();
                }
            });

            // DOM操作
            nameElement.style.display = 'none';
            nameElement.parentNode.insertBefore(input, nameElement);
            input.focus();
            input.select();
        }

        /**
         * ステータス情報更新
         */
        updateStatus(message) {
            if (this.elements.statusInfo) {
                this.elements.statusInfo.textContent = message;
            }
        }

        /**
         * ツール状態更新
         */
        updateToolState(toolState) {
            // ツールボタンの状態更新
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            const activeToolBtn = document.getElementById(`${toolState.activeTool}-tool`);
            if (activeToolBtn) {
                activeToolBtn.classList.add('active');
            }

            // ブラシ設定の同期
            if (toolState.brushSettings) {
                const brushSize = document.getElementById('brush-size');
                const brushSizeValue = document.getElementById('brush-size-value');
                const brushColor = document.getElementById('brush-color');
                const brushOpacity = document.getElementById('brush-opacity');
                const opacityValue = document.getElementById('opacity-value');

                if (brushSize && brushSizeValue) {
                    brushSize.value = toolState.brushSettings.size;
                    brushSizeValue.textContent = toolState.brushSettings.size;
                }

                if (brushColor) {
                    brushColor.value = this.colorToHex(toolState.brushSettings.color);
                }

                if (brushOpacity && opacityValue) {
                    brushOpacity.value = toolState.brushSettings.opacity;
                    opacityValue.textContent = toolState.brushSettings.opacity;
                }
            }
        }

        /**
         * カメラ情報表示
         */
        updateCameraInfo(cameraInfo) {
            if (window.CONFIG?.DEBUG?.SHOW_CAMERA_INFO && this.elements.statusInfo) {
                const info = `x:${Math.round(cameraInfo.x)} y:${Math.round(cameraInfo.y)} zoom:${Math.round(cameraInfo.zoom * 100)}%`;
                this.updateStatus(info);
            }
        }

        /**
         * エラー表示
         */
        showError(message, duration = 5000) {
            const errorDiv = document.getElementById('error-display');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, duration);
            }
        }

        /**
         * 成功メッセージ表示
         */
        showSuccess(message, duration = 3000) {
            // 成功メッセージ用の要素があれば表示
            const successDiv = document.getElementById('success-display');
            if (successDiv) {
                successDiv.textContent = message;
                successDiv.style.display = 'block';
                
                setTimeout(() => {
                    successDiv.style.display = 'none';
                }, duration);
            }
        }

        /**
         * 色値をHexに変換
         */
        colorToHex(color) {
            if (typeof color === 'string') return color;
            if (typeof color === 'number') {
                return '#' + color.toString(16).padStart(6, '0');
            }
            return '#000000';
        }

        /**
         * HTMLエスケープ
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * レスポンシブ対応
         */
        handleResize() {
            // モバイル対応など
            const isMobile = window.CONFIG?.ENVIRONMENT?.IS_MOBILE;
            const layersPanel = document.getElementById('layers-panel');
            const toolPanel = document.getElementById('tool-panel');

            if (isMobile) {
                if (layersPanel) {
                    layersPanel.style.width = '200px';
                }
                if (toolPanel) {
                    toolPanel.style.width = '180px';
                }
            }
        }

        /**
         * キーボードショートカット表示
         */
        showKeyboardShortcuts() {
            const shortcuts = window.CONFIG?.SHORTCUTS;
            if (!shortcuts) return;

            const shortcutList = Object.entries(shortcuts).map(([action, key]) => {
                return `<li><strong>${this.formatKeycode(key)}:</strong> ${this.formatActionName(action)}</li>`;
            }).join('');

            const helpHtml = `
                <div id="shortcuts-help" style="
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #3a3a3a;
                    border: 1px solid #555;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                    color: white;
                    z-index: 10000;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                ">
                    <h3>キーボードショートカット</h3>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${shortcutList}
                    </ul>
                    <button onclick="document.getElementById('shortcuts-help').remove()" 
                            style="float: right; padding: 5px 10px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        閉じる
                    </button>
                </div>
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" 
                     onclick="document.getElementById('shortcuts-help').remove(); this.remove();"></div>
            `;

            document.body.insertAdjacentHTML('beforeend', helpHtml);
        }

        /**
         * キーコード表示用フォーマット
         */
        formatKeycode(keycode) {
            return keycode
                .replace('Key', '')
                .replace('Ctrl+', 'Ctrl + ')
                .replace('Shift+', 'Shift + ')
                .replace('Alt+', 'Alt + ');
        }

        /**
         * アクション名表示用フォーマット
         */
        formatActionName(action) {
            const actionNames = {
                PEN_TOOL: 'ペンツール',
                ERASER_TOOL: '消しゴムツール',
                CAMERA_RESET: 'カメラリセット',
                CAMERA_PAN: 'カメラパン',
                TRANSFORM_MODE: '変形モード',
                NEW_LAYER: '新しいレイヤー',
                DELETE_LAYER: 'レイヤー削除',
                COPY_LAYER: 'レイヤーコピー',
                COPY_CANVAS: 'キャンバスコピー',
                PASTE: 'ペースト',
                GRID_TOGGLE: 'グリッド表示切替',
                FULLSCREEN: 'フルスクリーン'
            };

            return actionNames[action] || action;
        }

        /**
         * 破棄処理
         */
        destroy() {
            // イベントリスナー削除は不要（DOM要素と一緒に削除される）
            this.callbacks = {};
            this.layersData = [];
            this.elements = {};
        }
    }

    // UIManagerインスタンス作成
    const uiManager = new UIManager();

    // グローバル公開
    window.TegakiUI = uiManager;

    // 初期化（DOM読み込み後）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            uiManager.initialize();
        });
    } else {
        uiManager.initialize();
    }

    console.log('✅ ui-panels.js loaded');
})();