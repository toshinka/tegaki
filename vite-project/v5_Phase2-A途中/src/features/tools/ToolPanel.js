// src/features/tools/ToolPanel.js

export class ToolPanel {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.toolStore = this.serviceContainer.resolve('ToolStore');
        this.toolEngineController = this.serviceContainer.resolve('ToolEngineController');
        
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        // ツールパネルのHTML要素を取得または作成
        this.toolPanel = document.getElementById('tool-panel');
        if (!this.toolPanel) {
            this.createToolPanel();
        }
        
        // 初期状態の設定
        this.updateActiveToolUI(this.toolStore.getCurrentTool());
    }

    createToolPanel() {
        // ツールパネルが存在しない場合は動的に作成
        this.toolPanel = document.createElement('div');
        this.toolPanel.id = 'tool-panel';
        this.toolPanel.className = 'tool-panel';
        
        this.toolPanel.innerHTML = `
            <div class="tool-buttons">
                <button id="pen-tool" class="tool-button active" data-tool="pen">
                    ペン
                </button>
                <button id="brush-tool" class="tool-button" data-tool="brush">
                    ブラシ
                </button>
                <button id="eraser-tool" class="tool-button" data-tool="eraser">
                    消しゴム
                </button>
            </div>
            <div class="tool-settings">
                <div class="setting-group">
                    <label for="penSizeSlider">サイズ:</label>
                    <input type="range" id="penSizeSlider" min="1" max="50" value="2" />
                    <span id="penSizeValue">2</span>
                </div>
                <div class="setting-group">
                    <label for="penOpacitySlider">透明度:</label>
                    <input type="range" id="penOpacitySlider" min="1" max="100" value="100" />
                    <span id="penOpacityValue">100%</span>
                </div>
            </div>
            <div class="canvas-controls">
                <button id="clear-canvas" class="control-button">
                    クリア
                </button>
            </div>
        `;
        
        // bodyに追加
        document.body.appendChild(this.toolPanel);
    }

    setupEventListeners() {
        // ツールボタンのイベントリスナー
        const toolButtons = this.toolPanel.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const toolName = e.target.dataset.tool;
                this.selectTool(toolName);
            });
        });

        // 設定スライダーのイベントリスナー
        const penSizeSlider = document.getElementById('penSizeSlider');
        const penSizeValue = document.getElementById('penSizeValue');
        
        if (penSizeSlider && penSizeValue) {
            penSizeSlider.addEventListener('input', (e) => {
                penSizeValue.textContent = e.target.value;
                this.updateToolSettings();
            });
        }

        const penOpacitySlider = document.getElementById('penOpacitySlider');
        const penOpacityValue = document.getElementById('penOpacityValue');
        
        if (penOpacitySlider && penOpacityValue) {
            penOpacitySlider.addEventListener('input', (e) => {
                penOpacityValue.textContent = e.target.value + '%';
                this.updateToolSettings();
            });
        }

        // クリアボタンのイベントリスナー
        const clearButton = document.getElementById('clear-canvas');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearCanvas();
            });
        }

        // ToolStoreの状態変更を監視
        this.toolStore.subscribe((toolName) => {
            this.updateActiveToolUI(toolName);
        });
    }

    selectTool(toolName) {
        try {
            this.toolStore.selectTool(toolName);
            console.log(`Tool selected: ${toolName}`);
        } catch (error) {
            console.error('Failed to select tool:', error);
        }
    }

    updateToolSettings() {
        if (this.toolEngineController) {
            this.toolEngineController.updateToolSettings();
        }
    }

    clearCanvas() {
        if (this.toolEngineController) {
            this.toolEngineController.clearCanvas();
        }
    }

    updateActiveToolUI(activeTool) {
        // すべてのツールボタンからactiveクラスを削除
        const toolButtons = this.toolPanel.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.classList.remove('active');
        });

        // アクティブなツールボタンにactiveクラスを追加
        const activeButton = this.toolPanel.querySelector(`[data-tool="${activeTool}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // パネルの表示/非表示切り替え
    toggle() {
        if (this.toolPanel) {
            this.toolPanel.style.display = 
                this.toolPanel.style.display === 'none' ? 'block' : 'none';
        }
    }

    // パネルを表示
    show() {
        if (this.toolPanel) {
            this.toolPanel.style.display = 'block';
        }
    }

    // パネルを非表示
    hide() {
        if (this.toolPanel) {
            this.toolPanel.style.display = 'none';
        }
    }

    // 現在の設定値を取得
    getCurrentSettings() {
        const penSizeSlider = document.getElementById('penSizeSlider');
        const penOpacitySlider = document.getElementById('penOpacitySlider');
        
        return {
            size: penSizeSlider ? parseInt(penSizeSlider.value) : 2,
            opacity: penOpacitySlider ? parseInt(penOpacitySlider.value) : 100
        };
    }

    // 設定値を更新
    updateSettings(settings) {
        if (settings.size !== undefined) {
            const penSizeSlider = document.getElementById('penSizeSlider');
            const penSizeValue = document.getElementById('penSizeValue');
            
            if (penSizeSlider && penSizeValue) {
                penSizeSlider.value = settings.size;
                penSizeValue.textContent = settings.size;
            }
        }

        if (settings.opacity !== undefined) {
            const penOpacitySlider = document.getElementById('penOpacitySlider');
            const penOpacityValue = document.getElementById('penOpacityValue');
            
            if (penOpacitySlider && penOpacityValue) {
                penOpacitySlider.value = settings.opacity;
                penOpacityValue.textContent = settings.opacity + '%';
            }
        }

        // 設定変更を反映
        this.updateToolSettings();
    }
}