/**
 * ==========================================================
 * @module ToolManager
 * @role   ツールの登録・切り替え・イベント中継管理
 * @depends MainController (イベント経由)
 * @provides
 *   - registerTool(toolInstance): ツールインスタンスを登録
 *   - setActiveTool(toolId): アクティブツールを設定
 *   - getActiveTool(): 現在のアクティブツールを取得
 *   - handleEvent(event): ツール関連イベントの処理
 * @notes
 *   - 各ツールはTool インターフェース（start, move, end）に従う。
 *   - ツール間の通信は主星を経由して行う。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class ToolManager {
        constructor() {
            this.name = 'ToolManager';
            this.mainApi = null;
            this.tools = {}; // toolId -> toolInstance
            this.active = null; // active tool id
        }

        register(mainApi) { 
            this.mainApi = mainApi;
            this._setupUIHandlers();
        }

        registerTool(toolInstance) {
            if(!toolInstance || !toolInstance.id) {
                if(global.MyApp.debug) {
                    console.warn('[ToolManager] Invalid tool instance');
                }
                return;
            }
            
            this.tools[toolInstance.id] = toolInstance;
            
            // ツールにmainApiを渡す
            if(toolInstance.register) {
                toolInstance.register(this.mainApi);
            }
            
            // 最初のツールをアクティブに設定
            if(!this.active) {
                this.active = toolInstance.id;
            }
            
            if(global.MyApp.debug) {
                console.log(`[ToolManager] Registered tool: ${toolInstance.id}`);
            }
        }

        setActiveTool(toolId) {
            if(this.tools[toolId]) {
                this.active = toolId;
                
                // UIの更新
                this._updateToolUI(toolId);
                
                // 主星に通知
                if(this.mainApi) {
                    this.mainApi.notify({
                        type: 'tools.toolSelect',
                        payload: { tool: toolId }
                    });
                }
                
                if(global.MyApp.debug) {
                    console.log(`[ToolManager] Active tool: ${toolId}`);
                }
            }
        }

        getActiveTool() {
            return this.tools[this.active];
        }

        handleEvent(event) {
            const tool = this.getActiveTool();
            if(tool && tool.handleEvent) {
                tool.handleEvent(event);
            }
        }

        handleToolStart(payload) {
            const { toolId } = payload;
            if(toolId) {
                this.setActiveTool(toolId);
            }
            
            const tool = this.getActiveTool();
            if(tool && tool.start) {
                tool.start(payload);
            }
        }

        _setupUIHandlers() {
            // ツールボタンのクリックハンドラー設定
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const toolId = this._getToolIdFromButton(button);
                    if(toolId) {
                        this.setActiveTool(toolId);
                    }
                });
            });
        }

        _getToolIdFromButton(button) {
            // ボタンIDからツールIDを抽出
            if(button.id === 'pen-tool') return 'brush';
            if(button.id === 'eraser-tool') return 'eraser';
            if(button.id === 'transform-tool') return 'transform';
            return null;
        }

        _updateToolUI(toolId) {
            // UIボタンの状態更新
            document.querySelectorAll('.tool-button').forEach(button => {
                button.classList.remove('active');
            });
            
            let buttonId = null;
            if(toolId === 'brush') buttonId = 'pen-tool';
            else if(toolId === 'eraser') buttonId = 'eraser-tool';
            else if(toolId === 'transform') buttonId = 'transform-tool';
            
            if(buttonId) {
                const button = document.getElementById(buttonId);
                if(button) {
                    button.classList.add('active');
                }
            }
        }

        // ツール設定の更新
        updateToolSettings(toolId, settings) {
            const tool = this.tools[toolId];
            if(tool && tool.updateSettings) {
                tool.updateSettings(settings);
            }
        }
    }

    global.MyApp.ToolManager = ToolManager;
})(window);