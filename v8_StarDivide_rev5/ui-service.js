_createLayerPanel() {
            // 元のレイヤーパネルUIを再現
            const layerPanel = document.createElement('div');
            layerPanel.id = 'layer-panel';
            layerPanel.style.cssText = `
                position: fixed;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                pointer-events: none;
            `;
            
            // 追加ボタン（元のSVGアイコンを使用）
            const addButton = document.createElement('div');
            addButton.id = 'add-layer-btn';
            addButton.className = 'layer-add-button';
            addButton.title = 'レイヤー追加';
            addButton.style.cssText = `
                width: 36px;
                height: 36px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-light-medium);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(128, 0, 0, 0.1);
                pointer-events: all;
            `;
            addButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="15" x2="15" y1="12" y2="18"/>
                    <line x1="12" x2="18" y1="15" y2="15"/>
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
            `;
            
            const layerList = document.createElement('div');
            layerList.id = 'layer-list';
            lay/**
 * ==========================================================
 * @module UIService
 * @role   UI管理・ユーザーインタラクション・エラー表示
 * @depends MainController (イベント経由)
 * @provides
 *   - showError(message): エラーメッセージ表示
 *   - updateToolUI(toolId): ツールUI更新
 *   - updateLayerPanel(layerData): レイヤーパネル更新
 * @notes
 *   - DOM生成・操作を一元管理する。
 *   - ユーザー操作は主星に通知して処理を委譲する。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class UIService {
        constructor() {
            this.name = 'UIService';
            this.mainApi = null;
            this.panels = {
                layers: null,
                status: null,
                popup: null
            };
        }

        register(mainApi) {
            this.mainApi = mainApi;
            global.MyApp.UIServiceInstance = this;
            
            this._createLayerPanel();
            this._createStatusPanel();
            this._setupToolHandlers();
            
            if(global.MyApp.debug) {
                console.log('[UIService] UI components initialized');
            }
        }

        _createLayerPanel() {
            // レイヤーパネルの作成
            const layerPanel = document.createElement('div');
            layerPanel.id = 'layer-panel';
            layerPanel.style.cssText = `
                position: fixed;
                right: 20px;
                top: 20px;
                width: 200px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-light-medium);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(128, 0, 0, 0.1);
                z-index: 1000;
                font-size: 12px;
            `;
            
            layerPanel.innerHTML = `
                <div class="panel-header" style="font-weight: bold; margin-bottom: 8px; color: var(--futaba-maroon);">
                    レイヤー
                    <button id="add-layer-btn" style="float: right; padding: 2px 6px; font-size: 10px;">+</button>
                </div>
                <div id="layer-list" style="max-height: 200px; overflow-y: auto;">
                    <!-- レイヤーリストがここに動的生成される -->
                </div>
            `;
            
            document.body.appendChild(layerPanel);
            this.panels.layers = layerPanel;
            
            // レイヤー追加ボタンのイベントハンドラー
            const addBtn = document.getElementById('add-layer-btn');
            if(addBtn) {
                addBtn.addEventListener('click', () => {
                    if(this.mainApi) {
                        this.mainApi.notify({
                            type: 'layers.createRequest',
                            payload: { name: `レイヤー${Date.now()}` }
                        });
                    }
                });
            }
        }

        _createStatusPanel() {
            // ステータスパネルの作成
            const statusPanel = document.createElement('div');
            statusPanel.id = 'status-panel';
            statusPanel.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 70px;
                right: 20px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-light-medium);
                border-radius: 8px;
                padding: 8px 16px;
                font-family: monospace;
                font-size: 11px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 12px rgba(128, 0, 0, 0.1);
                z-index: 50;
            `;
            
            statusPanel.innerHTML = `
                <div class="status-left">
                    <span>Tool: </span><span id="current-tool">ベクターペン</span>
                    <span style="margin-left: 16px;">Layer: </span><span id="current-layer">レイヤー1</span>
                </div>
                <div class="status-right">
                    <span>Pos: </span><span id="coordinates">x: 0, y: 0</span>
                </div>
            `;
            
            document.body.appendChild(statusPanel);
            this.panels.status = statusPanel;
        }

        _setupToolHandlers() {
            // 既存のツールボタンにイベントハンドラーを追加
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const toolId = this._getToolIdFromElement(button);
                    if(toolId && this.mainApi) {
                        this.mainApi.notify({
                            type: 'tools.toolSelect',
                            payload: { tool: toolId }
                        });
                        this._updateToolButtons(toolId);
                    }
                });
            });
        }

        _getToolIdFromElement(element) {
            // ボタンIDからツールIDへのマッピング
            if(element.id === 'pen-tool') return 'brush';
            if(element.id === 'eraser-tool') return 'eraser';
            if(element.id === 'transform-tool') return 'transform';
            if(element.id === 'resize-tool') return 'resize';
            return null;
        }

        _updateToolButtons(activeToolId) {
            // ツールボタンのアクティブ状態を更新
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            let buttonId = null;
            if(activeToolId === 'brush') buttonId = 'pen-tool';
            else if(activeToolId === 'eraser') buttonId = 'eraser-tool';
            else if(activeToolId === 'transform') buttonId = 'transform-tool';
            else if(activeToolId === 'resize') buttonId = 'resize-tool';
            
            if(buttonId) {
                const activeBtn = document.getElementById(buttonId);
                if(activeBtn) {
                    activeBtn.classList.add('active');
                }
            }
        }

        updateLayerPanel(layerData) {
            const layerList = document.getElementById('layer-list');
            if(!layerList) return;
            
            // レイヤーリストを動的生成
            layerList.innerHTML = '';
            
            layerData.forEach((layer, index) => {
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${layer.active ? 'active' : ''}`;
                layerItem.style.cssText = `
                    padding: 6px 8px;
                    margin: 2px 0;
                    background: ${layer.active ? 'var(--futaba-light-medium)' : 'var(--futaba-background)'};
                    border: 1px solid var(--futaba-light-medium);
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                
                layerItem.innerHTML = `
                    <span class="layer-name">${layer.name}</span>
                    <span class="layer-visibility" style="cursor: pointer;">${layer.visible ? '👁️' : '👁️‍🗨️'}</span>
                `;
                
                // レイヤー選択イベント
                layerItem.addEventListener('click', (e) => {
                    if(e.target.classList.contains('layer-visibility')) {
                        // 可視性切り替え
                        if(this.mainApi) {
                            this.mainApi.notify({
                                type: 'layers.visibilityToggle',
                                payload: { layerId: layer.id }
                            });
                        }
                    } else {
                        // レイヤー選択
                        if(this.mainApi) {
                            this.mainApi.notify({
                                type: 'layers.setActive',
                                payload: { layerId: layer.id }
                            });
                        }
                    }
                });
                
                layerList.appendChild(layerItem);
            });
        }

        updateCurrentTool(toolName) {
            const element = document.getElementById('current-tool');
            if(element) {
                const toolNames = {
                    'brush': 'ベクターペン',
                    'eraser': '消しゴム', 
                    'transform': '変形',
                    'resize': 'リサイズ'
                };
                element.textContent = toolNames[toolName] || toolName;
            }
        }

        updateCurrentLayer(layerName) {
            const element = document.getElementById('current-layer');
            if(element) {
                element.textContent = layerName || '不明';
            }
        }

        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if(element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }

        showError(message) {
            // エラーメッセージの表示
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: var(--futaba-maroon);
                color: white;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 300px;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
            `;
            
            // CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
            errorDiv.innerHTML = `
                <strong>⚠️ エラー</strong><br>
                <small>${message}</small>
            `;
            
            document.body.appendChild(errorDiv);
            
            // 5秒後に自動削除
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.style.animation = 'slideIn 0.3s ease-in reverse';
                    setTimeout(() => {
                        errorDiv.parentNode.removeChild(errorDiv);
                        document.head.removeChild(style);
                    }, 300);
                }
            }, 5000);
            
            if(global.MyApp.debug) {
                console.log(`[UIService] Error displayed: ${message}`);
            }
        }

        showPopup(content, title = '情報', type = 'info') {
            // ポップアップ表示（将来の機能拡張用）
            const popup = document.createElement('div');
            popup.className = 'popup-overlay';
            popup.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            popup.innerHTML = `
                <div class="popup-content" style="
                    background: var(--futaba-cream);
                    padding: 24px;
                    border-radius: 12px;
                    max-width: 400px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 16px 0; color: var(--futaba-maroon);">${title}</h3>
                    <div style="margin-bottom: 16px;">${content}</div>
                    <button class="popup-close" style="
                        padding: 8px 16px;
                        background: var(--futaba-maroon);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">閉じる</button>
                </div>
            `;
            
            // 閉じるボタンのイベントハンドラー
            popup.querySelector('.popup-close').addEventListener('click', () => {
                document.body.removeChild(popup);
            });
            
            // オーバーレイクリックで閉じる
            popup.addEventListener('click', (e) => {
                if(e.target === popup) {
                    document.body.removeChild(popup);
                }
            });
            
            document.body.appendChild(popup);
            this.panels.popup = popup;
        }

        hidePopup() {
            this.hideAllPopups();
        }

        // 座標更新のためのマウス追跡
        startCoordinateTracking() {
            const canvas = document.querySelector('canvas');
            if(!canvas) return;
            
            canvas.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.updateCoordinates(x, y);
            });
        }

        // UIサービス初期化完了後の処理
        finishInitialization() {
            this.startCoordinateTracking();
            
            // 初期状態の設定
            this.updateCurrentTool('brush');
            this.updateCurrentLayer('レイヤー1');
            
            // ポップアップ外クリックで閉じる処理
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.tool-button')) {
                    this.hideAllPopups();
                }
            });
            
            if(global.MyApp.debug) {
                console.log('[UIService] Initialization completed');
            }
        }

        destroy() {
            // クリーンアップ
            if(this.panels.layers && this.panels.layers.parentNode) {
                this.panels.layers.parentNode.removeChild(this.panels.layers);
            }
            if(this.panels.status && this.panels.status.parentNode) {
                this.panels.status.parentNode.removeChild(this.panels.status);
            }
            this.hidePopup();
            
            this.mainApi = null;
            this.panels = {};
        }
    }

    global.MyApp.UIService = UIService;
})(window);