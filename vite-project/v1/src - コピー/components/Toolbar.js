// components/Toolbar.js - ツールバー + 制御パネル

/**
 * ツールバー＋制御パネル統合管理クラス
 */
export class Toolbar {
    constructor(appState) {
        this.appState = appState;
        this.setupEventListeners();
        console.log('✅ Toolbar initialized');
    }
    
    /**
     * 制御パネル・ツールバーのイベントリスナー設定
     */
    setupEventListeners() {
        this.setupPenSizeControls();
        this.setupOpacityControls();
        this.setupToolButtons();
    }
    
    /**
     * ペンサイズ制御設定
     */
    setupPenSizeControls() {
        const penSizeSlider = document.getElementById('penSizeSlider');
        const penSizeValue = document.getElementById('penSizeValue');
        
        if (penSizeSlider) {
            penSizeSlider.addEventListener('input', (e) => {
                const newSize = parseInt(e.target.value);
                this.appState.setState({ penSize: newSize });
                if (penSizeValue) penSizeValue.value = newSize;
            });
        }
        
        if (penSizeValue) {
            penSizeValue.addEventListener('change', (e) => {
                const newSize = parseInt(e.target.value);
                this.appState.setState({ penSize: newSize });
                if (penSizeSlider) penSizeSlider.value = newSize;
            });
        }
    }
    
    /**
     * 透明度制御設定
     */
    setupOpacityControls() {
        const penOpacitySlider = document.getElementById('penOpacitySlider');
        const penOpacityValue = document.getElementById('penOpacityValue');
        
        if (penOpacitySlider) {
            penOpacitySlider.addEventListener('input', (e) => {
                const newOpacity = parseInt(e.target.value);
                this.appState.setState({ penOpacity: newOpacity });
                if (penOpacityValue) penOpacityValue.value = newOpacity;
            });
        }
        
        if (penOpacityValue) {
            penOpacityValue.addEventListener('change', (e) => {
                const newOpacity = parseInt(e.target.value);
                this.appState.setState({ penOpacity: newOpacity });
                if (penOpacitySlider) penOpacitySlider.value = newOpacity;
            });
        }
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.target.getAttribute('data-tool');
                if (tool) {
                    this.selectTool(tool);
                }
            });
        });
    }
    
    /**
     * ツール選択処理
     */
    selectTool(toolName) {
        // ツール状態更新
        this.appState.setState({ currentTool: toolName });
        
        // UI更新（アクティブ状態）
        this.updateToolButtonStates(toolName);
        
        console.log(`🔧 Tool selected: ${toolName}`);
    }
    
    /**
     * ツールボタンのアクティブ状態更新
     */
    updateToolButtonStates(activeTool) {
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach(button => {
            const tool = button.getAttribute('data-tool');
            if (tool === activeTool) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    /**
     * 制御パネル表示/非表示切り替え
     */
    toggleControlPanel(visible) {
        const controlPanel = document.getElementById('penControls');
        if (controlPanel) {
            controlPanel.style.display = visible ? 'block' : 'none';
        }
    }
    
    /**
     * ツール固有の制御パネル表示
     */
    showToolControls(toolName) {
        // 現在はペンツールのみなので、ペン制御パネルを表示
        if (toolName === 'pen') {
            this.toggleControlPanel(true);
        } else {
            this.toggleControlPanel(false);
        }
    }
}