// ui/ToolPanel.js - OGL統一エンジン版ツールパネル
// v5.2 OGL統一アーキテクチャ準拠

export class ToolPanel {
    constructor(toolStore) {
        this.toolStore = toolStore;
        this.currentTool = 'pen';
        this.controlElements = new Map();
        
        this.initialize();
    }

    initialize() {
        console.log('🎨 ToolPanel初期化開始 (OGL統一版)');
        
        // ツールボタンの初期化
        this.initializeToolButtons();
        
        // コントロールパネルの初期化
        this.initializeControlPanels();
        
        // ToolStoreとの連携
        this.setupToolStoreIntegration();
        
        console.log('✅ ToolPanel初期化完了');
    }

    initializeToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach(button => {
            const toolName = button.dataset.tool;
            if (!toolName) return;

            // ツールボタンクリックイベント
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectTool(toolName);
            });

            // ホバーエフェクト
            button.addEventListener('mouseenter', () => {
                this.showToolPreview(toolName);
            });

            button.addEventListener('mouseleave', () => {
                this.hideToolPreview();
            });

            console.log(`🔧 ツールボタン初期化: ${toolName}`);
        });
    }

    initializeControlPanels() {
        // ペンコントロールパネル
        this.initializePenControls();
        
        // 消しゴムコントロールパネル
        this.initializeEraserControls();
        
        // デフォルトでペンコントロールを表示
        this.showControlPanel('pen');
    }

    initializePenControls() {
        const penControls = {
            sizeSlider: document.getElementById('penSizeSlider'),
            sizeValue: document.getElementById('penSizeValue'),
            opacitySlider: document.getElementById('penOpacitySlider'),
            opacityValue: document.getElementById('penOpacityValue')
        };

        // サイズコントロール
        if (penControls.sizeSlider && penControls.sizeValue) {
            this.setupSliderSync(
                penControls.sizeSlider, 
                penControls.sizeValue, 
                'pen', 
                'size',
                { min: 1, max: 50, default: 3 }
            );
        }

        // 不透明度コントロール
        if (penControls.opacitySlider && penControls.opacityValue) {
            this.setupSliderSync(
                penControls.opacitySlider, 
                penControls.opacityValue, 
                'pen', 
                'opacity',
                { min: 1, max: 100, default: 100 }
            );
        }

        this.controlElements.set('pen', penControls);
        console.log('🖊️ ペンコントロール初期化完了');
    }

    initializeEraserControls() {
        const eraserControls = {
            sizeSlider: document.getElementById('eraserSizeSlider'),
            sizeValue: document.getElementById('eraserSizeValue')
        };

        // サイズコントロール
        if (eraserControls.sizeSlider && eraserControls.sizeValue) {
            this.setupSliderSync(
                eraserControls.sizeSlider, 
                eraserControls.sizeValue, 
                'eraser', 
                'size',
                { min: 1, max: 100, default: 10 }
            );
        }

        this.controlElements.set('eraser', eraserControls);
        console.log('🧽 消しゴムコントロール初期化完了');
    }

    setupSliderSync(slider, valueInput, toolName, property, options) {
        if (!slider || !valueInput) return;

        // スライダー → 数値入力の同期
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            valueInput.value = value;
            this.notifyToolPropertyChange(toolName, property, value);
        });

        // 数値入力 → スライダーの同期
        valueInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value) || options.default;
            value = Math.max(options.min, Math.min(options.max, value));
            
            slider.value = value;
            e.target.value = value;
            this.notifyToolPropertyChange(toolName, property, value);
        });
    }

    setupToolStoreIntegration() {
        if (!this.toolStore) return;

        // ToolStoreの変更を監視
        this.toolStore.addEventListener('toolChanged', (event) => {
            const { tool, properties } = event.detail;
            this.updateToolUI(tool);
            this.updateControlValues(tool, properties);
        });

        this.toolStore.addEventListener('propertyChanged', (event) => {
            const { tool, property, value } = event.detail;
            this.updateControlValue(tool, property, value);
        });

        console.log('🔗 ToolStore連携設定完了');
    }

    // === ツール選択（OGL統一エンジン連携） ===
    selectTool(toolName) {
        try {
            console.log(`🔧 ツール選択要求: ${toolName}`);
            
            // UI状態更新
            this.updateToolButtons(toolName);
            this.showControlPanel(toolName);
            
            // ToolStore経由でOGLエンジンに通知
            if (this.toolStore) {
                this.toolStore.setCurrentTool(toolName);
            }
            
            // カスタムイベント発火（メインアプリ用）
            this.dispatchToolChangeEvent(toolName);
            
            this.currentTool = toolName;
            console.log(`✅ ツール選択完了: ${toolName}`);
            
        } catch (error) {
            console.error(`❌ ツール選択エラー (${toolName}):`, error);
        }
    }

    updateToolButtons(selectedTool) {
        document.querySelectorAll('.tool-button').forEach(button => {
            const toolName = button.dataset.tool;
            if (toolName === selectedTool) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    showControlPanel(toolName) {
        // 全てのコントロールパネルを非表示
        document.querySelectorAll('.control-panel').forEach(panel => {
            panel.classList.remove('visible');
        });

        // 選択されたツールのコントロールパネルを表示
        const controlPanel = document.getElementById(`${toolName}Controls`);
        if (controlPanel) {
            controlPanel.classList.add('visible');
        }
    }

    // === ツールプロパティ変更通知 ===
    notifyToolPropertyChange(toolName, property, value) {
        try {
            // ToolStore経由でOGLエンジンに通知
            if (this.toolStore) {
                this.toolStore.setToolProperty(toolName, property, value);
            }
            
            // カスタムイベント発火（メインアプリ用）
            this.dispatchPropertyChangeEvent(toolName, property, value);
            
        } catch (error) {
            console.error(`❌ プロパティ変更通知エラー (${toolName}.${property}=${value}):`, error);
        }
    }

    // === UI更新 ===
    updateToolUI(toolName) {
        this.updateToolButtons(toolName);
        this.showControlPanel(toolName);
        this.currentTool = toolName;
    }

    updateControlValues(toolName, properties) {
        if (!properties) return;

        const controls = this.controlElements.get(toolName);
        if (!controls) return;

        Object.entries(properties).forEach(([property, value]) => {
            this.updateControlValue(toolName, property, value);
        });
    }

    updateControlValue(toolName, property, value) {
        const controls = this.controlElements.get(toolName);
        if (!controls) return;

        try {
            // サイズプロパティの更新
            if (property === 'size') {
                if (controls.sizeSlider) controls.sizeSlider.value = value;
                if (controls.sizeValue) controls.sizeValue.value = value;
            }
            
            // 不透明度プロパティの更新
            if (property === 'opacity') {
                if (controls.opacitySlider) controls.opacitySlider.value = value;
                if (controls.opacityValue) controls.opacityValue.value = value;
            }
            
        } catch (error) {
            console.error(`❌ コントロール値更新エラー (${toolName}.${property}=${value}):`, error);
        }
    }

    // === ツールプレビュー ===
    showToolPreview(toolName) {
        // 将来的な機能: ツールプレビュー表示
        console.log(`👀 ツールプレビュー: ${toolName}`);
    }

    hideToolPreview() {
        // 将来的な機能: ツールプレビュー非表示
    }

    // === カスタムイベント ===
    dispatchToolChangeEvent(toolName) {
        const event = new CustomEvent('toolPanelToolChange', {
            detail: { tool: toolName }
        });
        document.dispatchEvent(event);
    }

    dispatchPropertyChangeEvent(toolName, property, value) {
        const event = new CustomEvent('toolPanelPropertyChange', {
            detail: { tool: toolName, property, value }
        });
        document.dispatchEvent(event);
    }

    // === ツール設定取得 ===
    getCurrentTool() {
        return this.currentTool;
    }

    getToolSettings(toolName) {
        const controls = this.controlElements.get(toolName);
        if (!controls) return {};

        const settings = {};
        
        if (controls.sizeSlider) {
            settings.size = parseInt(controls.sizeSlider.value);
        }
        
        if (controls.opacitySlider) {
            settings.opacity = parseInt(controls.opacitySlider.value);
        }
        
        return settings;
    }

    // === キーボードショートカット対応 ===
    handleKeyboardShortcut(key) {
        switch (key.toLowerCase()) {
            case 'p':
                this.selectTool('pen');
                return true;
            case 'e':
                this.selectTool('eraser');
                return true;
            default:
                return false;
        }
    }

    // === 廃棄処理 ===
    dispose() {
        try {
            // イベントリスナーのクリーンアップ
            this.controlElements.clear();
            
            console.log('🧹 ToolPanel廃棄完了');
        } catch (error) {
            console.error('❌ ToolPanel廃棄エラー:', error);
        }
    }

    // === デバッグ用 ===
    getStatus() {
        return {
            currentTool: this.currentTool,
            controlsCount: this.controlElements.size,
            toolStoreConnected: !!this.toolStore
        };
    }
}