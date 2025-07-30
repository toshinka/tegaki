// UIController.js - 最終修正版: 冗長性削除・効率化・Facade Pattern完全対応
import { OGLSettingsUI } from './OGLSettingsUI.js';
import { debounce, throttle, clamp, memoize } from 'lodash-es';

export class UIController {
    constructor(facadeEngine) {
        this.facade = facadeEngine;
        this.core = facadeEngine.core;
        
        // 効率化: 単一オブジェクトで状態管理
        this.state = {
            controlPanel: null,
            statusInfo: null,
            actionButtons: null,
            shortcuts: {},
            keydownHandler: null,
            elements: new Map(),
            settingsUI: null
        };
        
        // lodash-es統合最適化関数（一括定義・メモリ効率化）
        this.optimized = {
            resize: debounce(this.handleResize.bind(this), 100),
            statusUpdate: throttle(this.updateStatusDisplay.bind(this), 100),
            keyString: memoize(this.getKeyString.bind(this), (e) => `${e.ctrlKey}-${e.shiftKey}-${e.altKey}-${e.key}`),
            settingSync: debounce(this.setupKeyboardShortcuts.bind(this), 50),
            controlUpdate: debounce((id, value) => this.updateControlValue(id, value), 50)
        };
        
        this.initialize();
    }
    
    // 統合初期化（効率化・段階的）
    initialize() {
        this.setupSettingsIntegration();
        this.setupDynamicUI();
        this.applyInitialConfiguration();
    }
    
    // 設定システム統合（効率化・エラー分離）
    setupSettingsIntegration() {
        const settingsManager = this.facade.getEnhancer('settings');
        if (!settingsManager) return;
        
        this.state.settingsUI = new OGLSettingsUI(settingsManager);
        
        // 設定変更監視（効率化・バッチ処理）
        const settingHandlers = {
            shortcuts: (shortcuts) => {
                this.state.shortcuts = shortcuts;
                this.optimized.settingSync();
            },
            ui: (uiSettings) => this.updateUIVisibility(uiSettings),
            drawing: (drawingSettings) => this.syncControlsWithSettings(drawingSettings)
        };
        
        Object.entries(settingHandlers).forEach(([type, handler]) => {
            settingsManager.onChange(type, handler);
        });
    }
    
    // UI動的生成（効率化・統合）
    setupDynamicUI() {
        this.createSidebarTools();
        this.createControlPanel();
        this.createActionButtons();
        this.createStatusInfo();
    }
    
    // サイドバー生成（効率化）
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
        this.state.elements.set('penTool', penTool);
    }
    
    // コントロールパネル生成（効率化・設定連動）
    createControlPanel() {
        this.state.controlPanel = this.createElement('div', {
            className: 'control-panel',
            style: `position: absolute; top: 15px; left: 75px; width: 320px;
                   background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(128, 0, 0, 0.2);
                   border-radius: 8px; padding: 16px; box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
                   backdrop-filter: blur(10px);`
        });
        
        // コントロール設定（効率化・配列化）
        const controls = [
            { label: 'ペンサイズ', id: 'penSize', min: 1, max: 50, setting: 'drawing.penSize' },
            { label: '不透明度', id: 'opacity', min: 1, max: 100, setting: 'drawing.opacity', suffix: '%' },
            { label: '筆圧感度', id: 'pressure', min: 0, max: 100, setting: 'drawing.pressureSensitivity', suffix: '%' },
            { label: '線間補間', id: 'smoothing', type: 'checkbox', setting: 'drawing.smoothing' }
        ];
        
        const fragment = document.createDocumentFragment();
        controls.forEach(config => fragment.appendChild(this.createControlGroup(config)));
        
        this.state.controlPanel.appendChild(fragment);
        document.body.appendChild(this.state.controlPanel);
        this.state.elements.set('controlPanel', this.state.controlPanel);
    }
    
    // コントロールグループ作成（効率化・設定連動）
    createControlGroup(config) {
        const { label, id, type = 'range', min = 0, max = 100, setting, suffix = '' } = config;
        const settingsManager = this.facade.getEnhancer('settings');
        const settingValue = settingsManager?.get(setting) ?? (type === 'checkbox' ? false : min);
        
        if (type === 'checkbox') {
            return this.createCheckboxControl(label, id, settingValue, setting);
        }
        
        // 範囲コントロール生成（効率化）
        const group = this.createElement('div', { className: 'control-group' });
        const labelDiv = this.createElement('div', { className: 'control-label' });
        
        labelDiv.appendChild(this.createElement('span', { textContent: label }));
        
        const input = this.createElement('input', {
            type: 'number', className: 'control-input', id: `${id}Input`,
            value: settingValue, min, max
        });
        
        const slider = this.createElement('input', {
            type: 'range', className: 'control-slider', id: `${id}Slider`,
            min, max, value: settingValue
        });
        
        const valueDisplay = this.createElement('span', {
            className: 'value-display', textContent: `${settingValue}${suffix}`
        });
        
        // lodash-es最適化ハンドラー（効率化）
        const updateValue = (newValue) => {
            const clampedValue = clamp(parseInt(newValue), min, max);
            input.value = slider.value = clampedValue;
            valueDisplay.textContent = `${clampedValue}${suffix}`;
            
            this.optimized.controlUpdate(id, clampedValue);
            settingsManager?.set(setting, clampedValue);
        };
        
        slider.oninput = input.oninput = (e) => updateValue(e.target.value);
        
        // 設定変更監視
        settingsManager?.onChange(setting, (newValue) => {
            if (input.value != newValue) {
                input.value = slider.value = newValue;
                valueDisplay.textContent = `${newValue}${suffix}`;
            }
        });
        
        labelDiv.appendChild(input);
        group.appendChild(labelDiv);
        
        const sliderContainer = this.createElement('div', { className: 'slider-container' });
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        group.appendChild(sliderContainer);
        
        // 要素キャッシュ
        this.state.elements.set(`${id}Input`, input);
        this.state.elements.set(`${id}Slider`, slider);
        
        return group;
    }
    
    // チェックボックス作成（効率化）
    createCheckboxControl(label, id, defaultValue, setting) {
        const group = this.createElement('div', { className: 'control-group checkbox-group' });
        const settingsManager = this.facade.getEnhancer('settings');
        const settingValue = settingsManager?.get(setting) ?? defaultValue;
        
        const labelElement = this.createElement('label', { className: 'control-label checkbox-label' });
        const checkbox = this.createElement('input', {
            type: 'checkbox', className: 'control-checkbox', id: `${id}Check`, checked: settingValue
        });
        
        checkbox.onchange = (e) => {
            this.optimized.controlUpdate(id, e.target.checked);
            settingsManager?.set(setting, e.target.checked);
        };
        
        // 設定変更監視
        settingsManager?.onChange(setting, (newValue) => {
            if (checkbox.checked !== newValue) checkbox.checked = newValue;
        });
        
        labelElement.appendChild(checkbox);
        labelElement.appendChild(this.createElement('span', { textContent: label }));
        group.appendChild(labelElement);
        
        this.state.elements.set(`${id}Check`, checkbox);
        return group;
    }
    
    // アクションボタン生成（効率化・統合）
    createActionButtons() {
        this.state.actionButtons = this.createElement('div', {
            className: 'action-buttons',
            style: 'position: absolute; top: 10px; right: 15px; display: flex; gap: 8px;'
        });
        
        const buttons = [
            { text: '🗑️ クリア', action: () => this.facade.clear(), id: 'clearButton' },
            { text: '↶ 取り消し', action: () => this.facade.undo(), id: 'undoButton' }
        ];
        
        const fragment = document.createDocumentFragment();
        buttons.forEach(({ text, action, id }) => {
            const button = this.createActionButton(text, action);
            button.id = id;
            fragment.appendChild(button);
            this.state.elements.set(id, button);
        });
        
        this.state.actionButtons.appendChild(fragment);
        document.body.appendChild(this.state.actionButtons);
        this.state.elements.set('actionButtons', this.state.actionButtons);
    }
    
    // ステータス情報生成（効率化）
    createStatusInfo() {
        this.state.statusInfo = this.createElement('div', {
            className: 'status-info', id: 'statusInfo',
            style: `position: absolute; bottom: 15px; left: 75px; padding: 8px 12px;
                   background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(128, 0, 0, 0.2);
                   border-radius: 4px; font-size: 11px; color: var(--text-color);`
        });
        
        document.body.appendChild(this.state.statusInfo);
        this.state.elements.set('statusInfo', this.state.statusInfo);
    }
    
    // 初期設定適用（効率化・統合）
    applyInitialConfiguration() {
        const settingsManager = this.facade.getEnhancer('settings');
        if (!settingsManager) return;
        
        this.state.shortcuts = settingsManager.get('shortcuts');
        this.updateUIVisibility(settingsManager.get('ui'));
        this.syncControlsWithSettings(settingsManager.get('drawing'));
        this.setupKeyboardShortcuts();
    }
    
    // キーボードショートカット設定（lodash-es memoize活用・効率化）
    setupKeyboardShortcuts() {
        if (this.state.keydownHandler) {
            document.removeEventListener('keydown', this.state.keydownHandler);
        }
        
        const shortcutMap = new Map();
        const shortcuts = this.state.shortcuts;
        
        // アクションマッピング（効率化）
        const actions = {
            [shortcuts.undo]: () => this.facade.undo(),
            [shortcuts.clear]: () => this.facade.clear(),
            [shortcuts.fullscreen]: () => this.toggleFullscreen(),
            [shortcuts.togglePanel]: () => this.toggleControlPanel(),
            [shortcuts.penSizeUp]: () => this.adjustPenSize(1),
            [shortcuts.penSizeDown]: () => this.adjustPenSize(-1),
            [shortcuts.opacityUp]: () => this.adjustOpacity(5),
            [shortcuts.opacityDown]: () => this.adjustOpacity(-5)
        };
        
        Object.entries(actions).forEach(([key, action]) => {
            if (key) shortcutMap.set(key, action);
        });
        
        this.state.keydownHandler = (e) => {
            const key = this.optimized.keyString(e);
            const action = shortcutMap.get(key);
            if (action) {
                e.preventDefault();
                action();
            }
        };
        
        document.addEventListener('keydown', this.state.keydownHandler);
    }
    
    // パラメータ調整（lodash-es clamp活用・効率化）
    adjustPenSize(delta) {
        const settingsManager = this.facade.getEnhancer('settings');
        const current = settingsManager?.get('drawing.penSize') || 3;
        settingsManager?.set('drawing.penSize', clamp(current + delta, 1, 50));
    }
    
    adjustOpacity(delta) {
        const settingsManager = this.facade.getEnhancer('settings');
        const current = settingsManager?.get('drawing.opacity') || 100;
        settingsManager?.set('drawing.opacity', clamp(current + delta, 1, 100));
    }
    
    // UI表示制御（効率化・バッチ処理）
    updateUIVisibility(uiSettings) {
        const visibilityConfig = [
            ['controlPanel', uiSettings.showControlPanel, 'block'],
            ['statusInfo', uiSettings.showStatusInfo, 'block'],
            ['actionButtons', uiSettings.showActionButtons, 'flex']
        ];
        
        visibilityConfig.forEach(([elementKey, show, displayType]) => {
            const element = this.state.elements.get(elementKey);
            if (element) element.style.display = show ? displayType : 'none';
        });
    }
    
    // コントロール同期（効率化・統合）
    syncControlsWithSettings(drawingSettings) {
        const syncConfig = [
            ['penSizeInput', 'penSizeSlider', drawingSettings.penSize],
            ['opacityInput', 'opacitySlider', drawingSettings.opacity],
            ['pressureInput', 'pressureSlider', drawingSettings.pressureSensitivity],
            ['smoothingCheck', null, drawingSettings.smoothing]
        ];
        
        syncConfig.forEach(([inputKey, sliderKey, value]) => {
            const input = this.state.elements.get(inputKey);
            if (!input) return;
            
            if (input.type === 'checkbox') {
                input.checked = value;
            } else if (input.value != value) {
                input.value = value;
                const slider = this.state.elements.get(sliderKey);
                if (slider) slider.value = value;
            }
        });
    }
    
    // コントロール値更新（Facade経由・効率化）
    updateControlValue(controlId, value) {
        const actions = {
            penSize: () => this.facade.setPenSize(parseInt(value)),
            opacity: () => this.facade.setOpacity(parseInt(value)),
            pressure: () => this.facade.setPressureSensitivity(parseInt(value)),
            smoothing: () => this.facade.setSmoothing(value)
        };
        
        actions[controlId]?.();
    }
    
    // ユーティリティ（効率化・統合）
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
    
    createActionButton(text, onClick) {
        const button = this.createElement('button', {
            className: 'action-button',
            innerHTML: text,
            onclick: onClick,
            style: `padding: 6px 12px; background: rgba(255, 255, 255, 0.9);
                   border: 1px solid var(--main-color); border-radius: 4px;
                   fontSize: 11px; cursor: pointer; transition: all 0.2s ease;
                   color: var(--main-color);`
        });
        
        // ホバー効果
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
    
    // キー文字列生成（memoize活用）
    getKeyString(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        parts.push(event.key.toLowerCase());
        return parts.join('+');
    }
    
    // 機能メソッド（効率化・統合）
    selectTool(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolElement = this.state.elements.get(`${tool}Tool`) || document.getElementById(`${tool}Tool`);
        toolElement?.classList.add('active');
    }
    
    toggleControlPanel() {
        const panel = this.state.elements.get('controlPanel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            
            const settingsManager = this.facade.getEnhancer('settings');
            settingsManager?.set('ui.showControlPanel', !isVisible);
        }
    }
    
    toggleFullscreen() {
        document.body.classList.toggle('fullscreen-drawing');
        const isFullscreen = document.body.classList.contains('fullscreen-drawing');
        
        if (isFullscreen) {
            this.optimized.resize();
            window.addEventListener('resize', this.optimized.resize);
        } else {
            window.removeEventListener('resize', this.optimized.resize);
            this.facade.resizeCanvas(800, 600);
        }
        
        ['controlPanel', 'actionButtons'].forEach(key => {
            const element = this.state.elements.get(key);
            if (element) {
                element.style.display = isFullscreen ? 'none' : 
                    (key === 'actionButtons' ? 'flex' : 'block');
            }
        });
    }
    
    handleResize() {
        if (document.body.classList.contains('fullscreen-drawing')) {
            this.facade.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
        }
    }
    
    // ステータス表示更新（throttle活用・効率化）
    updateStatusDisplay(strokeCount, fps) {
        const statusElement = this.state.elements.get('statusInfo');
        if (statusElement) {
            const totalPoints = this.core.strokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
            statusElement.textContent = `ストローク: ${strokeCount} | 点数: ${totalPoints} | FPS: ${fps}`;
        }
    }
    
    // 外部API
    syncWithSettings(settings) { this.syncControlsWithSettings(settings); }
    
    // クリーンアップ（効率化・メモリリーク対策）
    destroy() {
        if (this.state.keydownHandler) {
            document.removeEventListener('keydown', this.state.keydownHandler);
        }
        
        // lodash-es関数クリーンアップ
        ['resize', 'statusUpdate', 'settingSync', 'controlUpdate'].forEach(key => {
            const fn = this.optimized[key];
            if (fn?.cancel) fn.cancel();
        });
        
        if (this.optimized.keyString?.cache) {
            this.optimized.keyString.cache.clear();
        }
        
        window.removeEventListener('resize', this.optimized.resize);
        
        // 状態クリア
        this.state.elements.clear();
        this.state.settingsUI = null;
        this.state = null;
        this.optimized = null;
    }
}