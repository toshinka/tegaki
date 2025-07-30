// Phase 1.5: UI動的生成・DOM制御統合ファイル（UI完全分離）
export class UIController {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.controlPanel = null;
        this.statusInfo = null;
        this.actionButtons = null;
        
        this.setupDynamicUI();
    }
    
    // UI統合初期化
    setupDynamicUI() {
        this.createSidebarTools();
        this.createControlPanel();
        this.createActionButtons();
        this.createStatusInfo();
        this.setupKeyboardShortcuts();
    }
    
    // サイドバーツール生成
    createSidebarTools() {
        const sidebar = document.getElementById('sidebar');
        
        const penTool = document.createElement('div');
        penTool.className = 'tool-button active';
        penTool.id = 'penTool';
        penTool.innerHTML = '✏️';
        penTool.title = 'ペンツール (P)';
        
        penTool.addEventListener('click', () => {
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            penTool.classList.add('active');
        });
        
        sidebar.appendChild(penTool);
    }
    
    // フローティングコントロールパネル生成
    createControlPanel() {
        this.controlPanel = document.createElement('div');
        this.controlPanel.className = 'control-panel';
        this.controlPanel.style.cssText = `
            position: absolute;
            top: 15px;
            left: 75px;
            width: 320px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(128, 0, 0, 0.2);
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
            backdrop-filter: blur(10px);
        `;
        
        // ペンサイズコントロール
        const penSizeGroup = this.createControlGroup('ペンサイズ', 'penSize', 3, 1, 50);
        this.controlPanel.appendChild(penSizeGroup);
        
        // 不透明度コントロール
        const opacityGroup = this.createControlGroup('不透明度', 'opacity', 100, 1, 100);
        this.controlPanel.appendChild(opacityGroup);
        
        // 筆圧感度コントロール
        const pressureGroup = this.createControlGroup('筆圧感度', 'pressure', 50, 0, 100);
        this.controlPanel.appendChild(pressureGroup);
        
        // スムージングコントロール
        const smoothingGroup = this.createCheckboxGroup('線間補間', 'smoothing', true);
        this.controlPanel.appendChild(smoothingGroup);
        
        document.body.appendChild(this.controlPanel);
    }
    
    // コントロールグループ作成
    createControlGroup(label, id, defaultValue, min, max) {
        const group = document.createElement('div');
        group.className = 'control-group';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'control-label';
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'control-input';
        input.id = `${id}Input`;
        input.value = defaultValue;
        input.min = min;
        input.max = max;
        
        labelDiv.appendChild(labelSpan);
        labelDiv.appendChild(input);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'control-slider';
        slider.id = `${id}Slider`;
        slider.min = min;
        slider.max = max;
        slider.value = defaultValue;
        
        // イベントリスナー設定
        const updateValue = (value) => {
            input.value = value;
            slider.value = value;
            this.updateControlValue(id, value);
        };
        
        slider.addEventListener('input', (e) => updateValue(e.target.value));
        input.addEventListener('input', (e) => updateValue(e.target.value));
        
        group.appendChild(labelDiv);
        group.appendChild(slider);
        
        return group;
    }
    
    // チェックボックスグループ作成
    createCheckboxGroup(label, id, defaultValue) {
        const group = document.createElement('div');
        group.className = 'control-group';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'control-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'control-checkbox';
        checkbox.id = `${id}Check`;
        checkbox.checked = defaultValue;
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        
        checkbox.addEventListener('change', (e) => {
            this.updateControlValue(id, e.target.checked);
        });
        
        labelDiv.appendChild(checkbox);
        labelDiv.appendChild(labelSpan);
        group.appendChild(labelDiv);
        
        return group;
    }
    
    // アクションボタン生成
    createActionButtons() {
        this.actionButtons = document.createElement('div');
        this.actionButtons.className = 'action-buttons';
        this.actionButtons.style.cssText = `
            position: absolute;
            top: 10px;
            right: 15px;
            display: flex;
            gap: 8px;
        `;
        
        // クリアボタン
        const clearButton = this.createActionButton('🗑️ クリア', () => this.engine.clear());
        clearButton.id = 'clearButton';
        
        // 取り消しボタン  
        const undoButton = this.createActionButton('↶ 取り消し', () => this.engine.undo());
        undoButton.id = 'undoButton';
        
        this.actionButtons.appendChild(clearButton);
        this.actionButtons.appendChild(undoButton);
        
        document.body.appendChild(this.actionButtons);
    }
    
    // アクションボタン作成
    createActionButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'action-button';
        button.innerHTML = text;
        button.style.cssText = `
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid var(--main-color);
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s ease;
            color: var(--main-color);
        `;
        
        button.addEventListener('click', onClick);
        button.addEventListener('mouseenter', () => {
            button.style.background = 'var(--main-color)';
            button.style.color = 'white';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.color = 'var(--main-color)';
        });
        
        return button;
    }
    
    // ステータス情報生成
    createStatusInfo() {
        this.statusInfo = document.createElement('div');
        this.statusInfo.className = 'status-info';
        this.statusInfo.id = 'statusInfo';
        this.statusInfo.style.cssText = `
            position: absolute;
            bottom: 15px;
            left: 75px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(128, 0, 0, 0.2);
            border-radius: 4px;
            font-size: 11px;
            color: var(--text-color);
        `;
        
        document.body.appendChild(this.statusInfo);
    }
    
    // キーボードショートカット設定
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'p':
                    e.preventDefault();
                    // ペンツール選択
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.engine.undo();
                    }
                    break;
                case 'c':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.engine.clear();
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'tab':
                    e.preventDefault();
                    this.toggleControlPanel();
                    break;
            }
        });
    }
    
    // UI→エンジン連携制御
    updateControlValue(controlId, value) {
        switch(controlId) {
            case 'penSize':
                this.engine.setPenSize(parseInt(value));
                break;
            case 'opacity':
                this.engine.setOpacity(parseInt(value));
                break;
            case 'pressure':
                this.engine.setPressureSensitivity(parseInt(value));
                break;
            case 'smoothing':
                this.engine.setSmoothing(value);
                break;
        }
    }
    
    // コントロールパネル表示切り替え
    toggleControlPanel() {
        if (this.controlPanel) {
            this.controlPanel.style.display = 
                this.controlPanel.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // フルスクリーンモード切り替え
    toggleFullscreen() {
        document.body.classList.toggle('fullscreen-drawing');
        
        const isFullscreen = document.body.classList.contains('fullscreen-drawing');
        
        if (isFullscreen) {
            this.engine.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
            if (this.controlPanel) this.controlPanel.style.display = 'none';
            if (this.actionButtons) this.actionButtons.style.display = 'none';
        } else {
            this.engine.resizeCanvas(800, 600);
            if (this.controlPanel) this.controlPanel.style.display = 'block';
            if (this.actionButtons) this.actionButtons.style.display = 'flex';
        }
    }
    
    // ステータス表示更新（エンジンから呼び出し）
    updateStatusDisplay(strokeCount, fps) {
        if (this.statusInfo) {
            const totalPoints = this.engine.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
            this.statusInfo.textContent = `ストローク: ${strokeCount} | 点数: ${totalPoints} | FPS: ${fps}`;
        }
    }
}