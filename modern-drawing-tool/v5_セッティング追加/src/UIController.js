// Phase 1.5: 設定統合対応UIController（改良版・効率化）
import { OGLSettingsUI } from './OGLSettingsUI.js';

export class UIController {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.controlPanel = null;
        this.statusInfo = null;
        this.actionButtons = null;
        this.shortcuts = {};
        this.keydownHandler = null;
        
        // DOM要素キャッシュ（効率化）
        this.elements = new Map();
        
        this.setupDynamicUI();
        this.setupSettingsIntegration();
    }
    
    // 設定システム統合（効率化・安全性向上）
    setupSettingsIntegration() {
        if (!this.engine.settingsManager) return;
        
        const settings = this.engine.settingsManager;
        
        // 設定UI初期化
        this.settingsUI = new OGLSettingsUI(settings);
        
        // 設定変更監視（バッチ処理・効率化）
        settings.onChange('shortcuts', (shortcuts) => {
            this.shortcuts = shortcuts;
            this.setupKeyboardShortcuts();
        });
        
        settings.onChange('ui', (uiSettings) => {
            this.updateUIVisibility(uiSettings);
        });
        
        settings.onChange('drawing', (drawingSettings) => {
            this.syncControlsWithSettings(drawingSettings);
        });
        
        // 初期設定適用（効率化）
        this.applyInitialSettings(settings);
    }
    
    // 初期設定適用（新規・効率化）
    applyInitialSettings(settings) {
        this.shortcuts = settings.get('shortcuts');
        this.updateUIVisibility(settings.get('ui'));
        this.syncControlsWithSettings(settings.get('drawing'));
        this.setupKeyboardShortcuts();
    }
    
    // UI統合初期化（効率化・モジュール化）
    setupDynamicUI() {
        this.createSidebarTools();
        this.createControlPanel();
        this.createActionButtons();
        this.createStatusInfo();
    }
    
    // サイドバーツール生成（効率化）
    createSidebarTools() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        const penTool = this.createElement('div', {
            className: 'tool-button active',
            id: 'penTool',
            innerHTML: '✏️',
            title: 'ペンツール (P)',
            onclick: () => this.selectTool('pen')
        });
        
        sidebar.appendChild(penTool);
        this.elements.set('penTool', penTool);
    }
    
    // フローティングコントロールパネル生成（設定連動・効率化）
    createControlPanel() {
        this.controlPanel = this.createElement('div', {
            className: 'control-panel',
            style: this.getPanelStyles()
        });
        
        // 動的コントロール設定（設定配列化・効率化）
        const controlConfigs = [
            { 
                label: 'ペンサイズ', 
                id: 'penSize', 
                type: 'range',
                min: 1, 
                max: 50, 
                setting: 'drawing.penSize' 
            },
            { 
                label: '不透明度', 
                id: 'opacity', 
                type: 'range',
                min: 1, 
                max: 100, 
                setting: 'drawing.opacity',
                suffix: '%'
            },
            { 
                label: '筆圧感度', 
                id: 'pressure', 
                type: 'range',
                min: 0, 
                max: 100, 
                setting: 'drawing.pressureSensitivity',
                suffix: '%'
            },
            {
                label: '線間補間',
                id: 'smoothing',
                type: 'checkbox',
                setting: 'drawing.smoothing'
            }
        ];
        
        // バッチでコントロール生成（効率化）
        const fragment = document.createDocumentFragment();
        controlConfigs.forEach(config => {
            const group = this.createControlGroup(config);
            fragment.appendChild(group);
        });
        
        this.controlPanel.appendChild(fragment);
        document.body.appendChild(this.controlPanel);
        this.elements.set('controlPanel', this.controlPanel);
    }
    
    // 設定連動コントロールグループ作成（効率化・統合強化）
    createControlGroup(config) {
        const { label, id, type, min, max, setting, suffix = '' } = config;
        const group = this.createElement('div', { className: 'control-group' });
        
        // 設定から初期値取得（効率化）
        const settingValue = this.engine.settingsManager?.get(setting) ?? (type === 'checkbox' ? false : min || 0);
        
        if (type === 'checkbox') {
            return this.createCheckboxGroup(label, id, settingValue, setting);
        }
        
        // 範囲コントロール生成
        const labelDiv = this.createElement('div', { className: 'control-label' });
        labelDiv.appendChild(this.createElement('span', { textContent: label }));
        
        const input = this.createElement('input', {
            type: 'number',
            className: 'control-input',
            id: `${id}Input`,
            value: settingValue,
            min, max
        });
        labelDiv.appendChild(input);
        
        const slider = this.createElement('input', {
            type: 'range',
            className: 'control-slider',
            id: `${id}Slider`,
            min, max, value: settingValue
        });
        
        // 値表示追加（効率化）
        const valueDisplay = this.createElement('span', {
            className: 'value-display',
            textContent: `${settingValue}${suffix}`
        });
        
        // 双方向同期ハンドラー（効率化・デバウンス）
        const updateValue = this.debounce((newValue) => {
            const numValue = parseInt(newValue);
            input.value = slider.value = numValue;
            valueDisplay.textContent = `${numValue}${suffix}`;
            
            this.updateControlValue(id, numValue);
            this.engine.settingsManager?.set(setting, numValue);
        }, 50);
        
        slider.oninput = input.oninput = (e) => updateValue(e.target.value);
        
        // 設定変更監視（効率化）
        if (setting && this.engine.settingsManager) {
            this.engine.settingsManager.onChange(setting, (newValue) => {
                if (input.value != newValue) {
                    input.value = slider.value = newValue;
                    valueDisplay.textContent = `${newValue}${suffix}`;
                }
            });
        }
        
        // DOM構築
        group.appendChild(labelDiv);
        const sliderContainer = this.createElement('div', { className: 'slider-container' });
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        group.appendChild(sliderContainer);
        
        // 要素キャッシュ
        this.elements.set(`${id}Input`, input);
        this.elements.set(`${id}Slider`, slider);
        
        return group;
    }
    
    // 設定連動チェックボックス作成（効率化）
    createCheckboxGroup(label, id, defaultValue, setting) {
        const group = this.createElement('div', { className: 'control-group checkbox-group' });
        const settingValue = this.engine.settingsManager?.get(setting) ?? defaultValue;
        
        const labelElement = this.createElement('label', { className: 'control-label checkbox-label' });
        const checkbox = this.createElement('input', {
            type: 'checkbox',
            className: 'control-checkbox',
            id: `${id}Check`,
            checked: settingValue
        });
        
        // 変更ハンドラー（効率化）
        checkbox.onchange = (e) => {
            this.updateControlValue(id, e.target.checked);
            this.engine.settingsManager?.set(setting, e.target.checked);
        };
        
        // 設定変更監視
        if (setting && this.engine.settingsManager) {
            this.engine.settingsManager.onChange(setting, (newValue) => {
                if (checkbox.checked !== newValue) {
                    checkbox.checked = newValue;
                }
            });
        }
        
        labelElement.appendChild(checkbox);
        labelElement.appendChild(this.createElement('span', { textContent: label }));
        group.appendChild(labelElement);
        
        this.elements.set(`${id}Check`, checkbox);
        return group;
    }
    
    // アクションボタン生成（効率化・バッチ処理）
    createActionButtons() {
        this.actionButtons = this.createElement('div', {
            className: 'action-buttons',
            style: 'position: absolute; top: 10px; right: 15px; display: flex; gap: 8px;'
        });
        
        const buttonConfigs = [
            { text: '🗑️ クリア', action: () => this.engine.clear(), id: 'clearButton' },
            { text: '↶ 取り消し', action: () => this.engine.undo(), id: 'undoButton' }
        ];
        
        // バッチでボタン生成
        const fragment = document.createDocumentFragment();
        buttonConfigs.forEach(({ text, action, id }) => {
            const button = this.createActionButton(text, action);
            button.id = id;
            fragment.appendChild(button);
            this.elements.set(id, button);
        });
        
        this.actionButtons.appendChild(fragment);
        document.body.appendChild(this.actionButtons);
        this.elements.set('actionButtons', this.actionButtons);
    }
    
    // ステータス情報生成（効率化）
    createStatusInfo() {
        this.statusInfo = this.createElement('div', {
            className: 'status-info',
            id: 'statusInfo',
            style: `position: absolute; bottom: 15px; left: 75px; padding: 8px 12px;
                   background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(128, 0, 0, 0.2);
                   border-radius: 4px; font-size: 11px; color: var(--text-color);`
        });
        
        document.body.appendChild(this.statusInfo);
        this.elements.set('statusInfo', this.statusInfo);
    }
    
    // 動的キーボードショートカット設定（効率化・メモリリーク対策）
    setupKeyboardShortcuts() {
        // 既存リスナー削除
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        
        // ショートカットマップ生成（効率化）
        const shortcutMap = new Map();
        const shortcuts = this.shortcuts;
        
        // アクションマッピング（効率化）
        const actions = {
            [shortcuts.undo]: () => this.engine.undo(),
            [shortcuts.clear]: () => this.engine.clear(),
            [shortcuts.fullscreen]: () => this.toggleFullscreen(),
            [shortcuts.togglePanel]: () => this.toggleControlPanel(),
            [shortcuts.penSizeUp]: () => this.adjustPenSize(1),
            [shortcuts.penSizeDown]: () => this.adjustPenSize(-1),
            [shortcuts.opacityUp]: () => this.adjustOpacity(5),
            [shortcuts.opacityDown]: () => this.adjustOpacity(-5)
        };
        
        // マップ構築
        Object.entries(actions).forEach(([key, action]) => {
            if (key) shortcutMap.set(key, action);
        });
        
        // 新しいハンドラー（効率化）
        this.keydownHandler = (e) => {
            const key = this.getKeyString(e);
            const action = shortcutMap.get(key);
            
            if (action) {
                e.preventDefault();
                action();
            }
        };
        
        document.addEventListener('keydown', this.keydownHandler);
    }
    
    // ペンサイズ調整（効率化）
    adjustPenSize(delta) {
        const current = this.engine.settingsManager?.get('drawing.penSize') || 3;
        const newSize = Math.max(1, Math.min(50, current + delta));
        this.engine.settingsManager?.set('drawing.penSize', newSize);
    }
    
    // 不透明度調整（効率化）
    adjustOpacity(delta) {
        const current = this.engine.settingsManager?.get('drawing.opacity') || 100;
        const newOpacity = Math.max(1, Math.min(100, current + delta));
        this.engine.settingsManager?.set('drawing.opacity', newOpacity);
    }
    
    // キー文字列生成（効率化・キャッシュ）
    getKeyString(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        parts.push(event.key.toLowerCase());
        return parts.join('+');
    }
    
    // UI表示設定更新（効率化・バッチ処理）
    updateUIVisibility(uiSettings) {
        const visibilityMap = [
            ['controlPanel', uiSettings.showControlPanel],
            ['statusInfo', uiSettings.showStatusInfo],
            ['actionButtons', uiSettings.showActionButtons]
        ];
        
        visibilityMap.forEach(([elementKey, show]) => {
            const element = this.elements.get(elementKey);
            if (element) {
                element.style.display = show ? (elementKey === 'actionButtons' ? 'flex' : 'block') : 'none';
            }
        });
    }
    
    // コントロール同期（効率化・統合）
    syncControlsWithSettings(drawingSettings) {
        const syncMap = [
            ['penSizeInput', 'penSizeSlider', drawingSettings.penSize],
            ['opacityInput', 'opacitySlider', drawingSettings.opacity],
            ['pressureInput', 'pressureSlider', drawingSettings.pressureSensitivity],
            ['smoothingCheck', null, drawingSettings.smoothing]
        ];
        
        syncMap.forEach(([inputKey, sliderKey, value]) => {
            const input = this.elements.get(inputKey);
            const slider = sliderKey ? this.elements.get(sliderKey) : null;
            
            if (input && input.type === 'checkbox') {
                input.checked = value;
            } else if (input && input.value != value) {
                input.value = value;
                if (slider) slider.value = value;
            }
        });
    }
    
    // UI→エンジン連携制御（効率化・統合）
    updateControlValue(controlId, value) {
        const controlActions = {
            penSize: () => this.engine.setPenSize(parseInt(value)),
            opacity: () => this.engine.setOpacity(parseInt(value)),
            pressure: () => this.engine.setPressureSensitivity(parseInt(value)),
            smoothing: () => this.engine.setSmoothing(value)
        };
        
        const action = controlActions[controlId];
        if (action) action();
    }
    
    // ユーティリティメソッド群（効率化）
    createElement(tag, props = {}) {
        const el = document.createElement(tag);
        
        Object.entries(props).forEach(([key, value]) => {
            if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2), value);
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else {
                el[key] = value;
            }
        });
        
        return el;
    }
    
    // デバウンス関数（効率化・新規追加）
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // アクションボタン作成（効率化・統合）
    createActionButton(text, onClick) {
        const baseStyle = {
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid var(--main-color)',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'var(--main-color)'
        };
        
        const button = this.createElement('button', {
            className: 'action-button',
            innerHTML: text,
            onclick: onClick
        });
        
        Object.assign(button.style, baseStyle);
        
        // ホバー効果（効率化）
        const hoverHandlers = {
            mouseenter: () => {
                button.style.background = 'var(--main-color)';
                button.style.color = 'white';
            },
            mouseleave: () => {
                button.style.background = 'rgba(255, 255, 255, 0.9)';
                button.style.color = 'var(--main-color)';
            }
        };
        
        Object.entries(hoverHandlers).forEach(([event, handler]) => {
            button.addEventListener(event, handler);
        });
        
        return button;
    }
    
    // パネルスタイル取得（効率化・統合）
    getPanelStyles() {
        return `
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
    }
    
    // ツール選択（効率化）
    selectTool(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolElement = this.elements.get(`${tool}Tool`) || document.getElementById(`${tool}Tool`);
        toolElement?.classList.add('active');
    }
    
    // コントロールパネル切り替え（効率化）
    toggleControlPanel() {
        const panel = this.elements.get('controlPanel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            
            // 設定への反映
            this.engine.settingsManager?.set('ui.showControlPanel', !isVisible);
        }
    }
    
    // フルスクリーン切り替え（効率化）
    toggleFullscreen() {
        document.body.classList.toggle('fullscreen-drawing');
        const isFullscreen = document.body.classList.contains('fullscreen-drawing');
        
        // キャンバスリサイズ
        this.engine.resizeCanvas(
            isFullscreen ? window.innerWidth - 20 : 800,
            isFullscreen ? window.innerHeight - 20 : 600
        );
        
        // UI要素の表示制御（効率化）
        const elementsToHide = ['controlPanel', 'actionButtons'];
        elementsToHide.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.style.display = isFullscreen ? 'none' : 
                    (key === 'actionButtons' ? 'flex' : 'block');
            }
        });
    }
    
    // ステータス表示更新（効率化・テンプレート化）
    updateStatusDisplay(strokeCount, fps) {
        const statusElement = this.elements.get('statusInfo');
        if (statusElement) {
            const totalPoints = this.engine.strokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
            statusElement.textContent = `ストローク: ${strokeCount} | 点数: ${totalPoints} | FPS: ${fps}`;
        }
    }
    
    // 設定から同期（外部API・効率化）
    syncWithSettings(settings) {
        this.syncControlsWithSettings(settings);
    }
    
    // クリーンアップ（メモリリーク対策）
    destroy() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        
        this.elements.clear();
        this.settingsUI = null;
    }
}