/**
 * OGLInteractionEnhancer.js - Phase1.5仮UI (Phase1動作確認用)
 * 最小UI統合・ペンツール起動・基本操作確認・Phase2への橋渡し役
 * v2.0 OGL統一制約準拠・Fresco風仮UI・動作確認最優先
 */

import { PenIcon, EraserIcon, DownloadIcon, SettingsIcon, PaletteIcon, CircleIcon } from '@phosphor-icons/react';
import chroma from 'chroma-js';
import { debounce } from 'lodash-es';

// === 基本ツールアイコン動的生成（150行） ===

/**
 * Fresco風仮サイドバー生成システム
 * Phase2完全版への橋渡し・動作確認用最小UI
 */
class TemporarySidebar {
    constructor(app, eventBus) {
        this.app = app;
        this.eventBus = eventBus;
        this.drawingCore = null;
        this.historyController = null;
        this.inputController = null;
        
        // UI状態
        this.currentTool = 'pen';
        this.sidebarVisible = true;
        
        // DOM要素
        this.sidebar = null;
        this.toolButtons = new Map();
        
        this.initializeTemporarySidebar();
    }
    
    /**
     * 仮サイドバー初期化
     */
    initializeTemporarySidebar() {
        this.createSidebarStructure();
        this.setupToolButtons();
        this.setupEventListeners();
        this.applyFrescoStyling();
        
        console.log('🎨 Phase1.5仮サイドバー初期化完了');
    }
    
    /**
     * サイドバー構造作成
     */
    createSidebarStructure() {
        // 既存のsidebarを取得または作成
        this.sidebar = document.getElementById('sidebar');
        if (!this.sidebar) {
            this.sidebar = document.createElement('div');
            this.sidebar.id = 'sidebar';
            document.body.appendChild(this.sidebar);
        }
        
        this.sidebar.innerHTML = '';
        this.sidebar.className = 'fresco-sidebar';
        
        // ツールグループ作成
        const toolGroup = document.createElement('div');
        toolGroup.className = 'tool-group';
        this.sidebar.appendChild(toolGroup);
        
        // 設定グループ作成
        const settingsGroup = document.createElement('div');
        settingsGroup.className = 'settings-group';
        this.sidebar.appendChild(settingsGroup);
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        const toolGroup = this.sidebar.querySelector('.tool-group');
        const settingsGroup = this.sidebar.querySelector('.settings-group');
        
        // 基本ツール定義
        const tools = [
            { id: 'pen', icon: PenIcon, label: 'ペン', group: 'tool' },
            { id: 'eraser', icon: EraserIcon, label: '消しゴム', group: 'tool' },
            { id: 'color', icon: PaletteIcon, label: '色選択', group: 'tool' }
        ];
        
        const settings = [
            { id: 'download', icon: DownloadIcon, label: 'ダウンロード', group: 'settings' },
            { id: 'settings', icon: SettingsIcon, label: '設定', group: 'settings' }
        ];
        
        // ツールボタン生成
        tools.forEach(tool => {
            const button = this.createToolButton(tool);
            toolGroup.appendChild(button);
            this.toolButtons.set(tool.id, button);
        });
        
        // 設定ボタン生成
        settings.forEach(setting => {
            const button = this.createToolButton(setting);
            settingsGroup.appendChild(button);
            this.toolButtons.set(setting.id, button);
        });
        
        // デフォルトペン選択
        this.selectTool('pen');
    }
    
    /**
     * ツールボタン作成
     */
    createToolButton(toolConfig) {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.dataset.tool = toolConfig.id;
        button.title = toolConfig.label;
        
        // PhosphorアイコンReact → DOM変換
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'tool-icon';
        
        // アイコンSVG作成（簡易実装）
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '24');
        iconSvg.setAttribute('height', '24');
        iconSvg.setAttribute('viewBox', '0 0 256 256');
        iconSvg.innerHTML = this.getIconPath(toolConfig.icon.name || toolConfig.id);
        
        iconWrapper.appendChild(iconSvg);
        button.appendChild(iconWrapper);
        
        // ラベル追加（ツールチップ用）
        const label = document.createElement('span');
        label.className = 'tool-label';
        label.textContent = toolConfig.label;
        button.appendChild(label);
        
        return button;
    }
    
    /**
     * アイコンパス取得（簡易実装）
     */
    getIconPath(iconName) {
        const icons = {
            pen: '<path d="M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31l83.67-83.66,3.48-3.48h0L227.32,96A16,16,0,0,0,227.32,73.37ZM192,108.69,147.32,64l24-24L216,84.69Z"/>',
            eraser: '<path d="M225,80.4,183.6,39a16,16,0,0,0-22.62,0L38.83,161.17a16,16,0,0,0,0,22.63L80,225a16,16,0,0,0,22.63,0L225,102.63A16,16,0,0,0,225,80.4ZM192,91.31,164.69,64,192,36.69,219.31,64Z"/>',
            color: '<path d="M200.77,53.89A103.28,103.28,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43.61,28.27,83.82,74.18,97.11a8,8,0,0,0,9.82-7.72V208a40,40,0,0,1,40-40h32a40,40,0,0,1,40,40v9.38a8,8,0,0,0,9.81,7.72c45.91-13.29,74.19-53.5,74.19-97.1A103.28,103.28,0,0,0,200.77,53.89Z"/>',
            download: '<path d="M240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a16,16,0,0,1,16-16H80a8,8,0,0,1,0,16H32V200H224V136H176a8,8,0,0,1,0-16h48A16,16,0,0,1,240,136ZM85.66,77.66,120,43.31V128a8,8,0,0,0,16,0V43.31l34.34,34.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,77.66Z"/>',
            settings: '<path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3.18-3.18L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.49A107.6,107.6,0,0,0,73.89,34.5a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3.18,3.18L40.54,70.05a8,8,0,0,0-6,3.93,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.49,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.48,1.56,3.18,3.18L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3.18-3.18L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Z"/>'
        };
        return icons[iconName] || icons.pen;
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // ツールボタンクリック
        this.sidebar.addEventListener('click', (e) => {
            const button = e.target.closest('.tool-button');
            if (button) {
                const toolId = button.dataset.tool;
                this.handleToolClick(toolId);
            }
        });
        
        // ツールボタンホバー
        this.sidebar.addEventListener('mouseenter', (e) => {
            const button = e.target.closest('.tool-button');
            if (button) {
                this.showTooltip(button);
            }
        }, true);
        
        this.sidebar.addEventListener('mouseleave', (e) => {
            const button = e.target.closest('.tool-button');
            if (button) {
                this.hideTooltip(button);
            }
        }, true);
    }
    
    /**
     * ツールクリック処理
     */
    handleToolClick(toolId) {
        switch (toolId) {
            case 'pen':
            case 'eraser':
                this.selectTool(toolId);
                break;
            case 'color':
                this.showColorPicker();
                break;
            case 'download':
                this.downloadCanvas();
                break;
            case 'settings':
                this.showSettings();
                break;
        }
    }
    
    /**
     * ツール選択
     */
    selectTool(toolId) {
        this.currentTool = toolId;
        
        // ボタン状態更新
        this.toolButtons.forEach((button, id) => {
            button.classList.toggle('active', id === toolId);
        });
        
        // 描画コアにツール設定
        if (this.drawingCore) {
            this.drawingCore.selectTool(toolId);
        }
        
        // イベント発火
        this.eventBus.emit('tool:selected', { toolId, toolName: toolId });
        
        console.log(`🔧 ツール選択: ${toolId}`);
    }
    
    /**
     * ツールチップ表示
     */
    showTooltip(button) {
        const tooltip = button.querySelector('.tool-label');
        if (tooltip) {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(60px)';
        }
    }
    
    /**
     * ツールチップ非表示
     */
    hideTooltip(button) {
        const tooltip = button.querySelector('.tool-label');
        if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(50px)';
        }
    }
    
    /**
     * Fresco風スタイル適用
     */
    applyFrescoStyling() {
        const style = document.createElement('style');
        style.textContent = `
            .fresco-sidebar {
                position: fixed;
                left: 0;
                top: 0;
                width: 64px;
                height: 100vh;
                background: linear-gradient(135deg, #2a2a2a 0%, #252525 100%);
                border-right: 1px solid #444444;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px 0;
                z-index: 1000;
                box-shadow: 2px 0 8px rgba(0,0,0,0.3);
            }
            
            .tool-group, .settings-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 20px;
            }
            
            .settings-group {
                margin-top: auto;
                margin-bottom: 20px;
            }
            
            .tool-button {
                width: 44px;
                height: 44px;
                background: transparent;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: all 200ms ease-out;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .tool-button:hover {
                background: rgba(255,255,255,0.1);
                transform: scale(1.05);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
            
            .tool-button.active {
                background: rgba(0,122,204,0.2);
                border-left: 2px solid #007acc;
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,122,204,0.3);
            }
            
            .tool-icon svg {
                width: 24px;
                height: 24px;
                fill: #888888;
                transition: fill 200ms ease-out;
            }
            
            .tool-button:hover .tool-icon svg {
                fill: #cccccc;
            }
            
            .tool-button.active .tool-icon svg {
                fill: #ffffff;
            }
            
            .tool-label {
                position: absolute;
                left: 50px;
                top: 50%;
                transform: translateY(-50%) translateX(50px);
                background: rgba(42,42,42,0.95);
                color: #ffffff;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: all 200ms ease-out;
                backdrop-filter: blur(8px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .tool-label::before {
                content: '';
                position: absolute;
                left: -4px;
                top: 50%;
                transform: translateY(-50%);
                width: 0;
                height: 0;
                border-top: 4px solid transparent;
                border-bottom: 4px solid transparent;
                border-right: 4px solid rgba(42,42,42,0.95);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 描画コア連携設定
     */
    connectDrawingCore(drawingCore) {
        this.drawingCore = drawingCore;
        console.log('🔗 描画コア連携完了');
    }
    
    /**
     * 履歴コントローラー連携設定
     */
    connectHistoryController(historyController) {
        this.historyController = historyController;
        console.log('🔗 履歴コントローラー連携完了');
    }
    
    /**
     * 入力コントローラー連携設定
     */
    connectInputController(inputController) {
        this.inputController = inputController;
        console.log('🔗 入力コントローラー連携完了');
    }
}

// === ペンツール最小ポップアップ（100行） ===

/**
 * ペンツール設定ポップアップ（仮実装）
 */
class PenToolPopup {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.popup = null;
        this.isVisible = false;
        
        // ペン設定
        this.penSettings = {
            size: 2.0,
            opacity: 1.0,
            pressure: true
        };
        
        this.setupPenPopup();
    }
    
    /**
     * ペンポップアップ設定
     */
    setupPenPopup() {
        this.createPopupStructure();
        this.setupSliders();
        this.applyPopupStyling();
        
        // ツール選択監視
        this.eventBus.on('tool:selected', (event) => {
            if (event.toolId === 'pen') {
                this.show();
            } else {
                this.hide();
            }
        });
    }
    
    /**
     * ポップアップ構造作成
     */
    createPopupStructure() {
        this.popup = document.createElement('div');
        this.popup.className = 'pen-popup';
        this.popup.innerHTML = `
            <div class="popup-header">
                <span class="popup-title">ペン設定</span>
            </div>
            <div class="popup-content">
                <div class="setting-row">
                    <label>サイズ</label>
                    <input type="range" id="pen-size" min="1" max="20" value="2" step="0.5">
                    <span class="value-display">2px</span>
                </div>
                <div class="setting-row">
                    <label>不透明度</label>
                    <input type="range" id="pen-opacity" min="0" max="1" value="1" step="0.1">
                    <span class="value-display">100%</span>
                </div>
                <div class="setting-row">
                    <label>筆圧感度</label>
                    <input type="checkbox" id="pen-pressure" checked>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.popup);
    }
    
    /**
     * スライダー設定
     */
    setupSliders() {
        const sizeSlider = this.popup.querySelector('#pen-size');
        const opacitySlider = this.popup.querySelector('#pen-opacity');
        const pressureCheck = this.popup.querySelector('#pen-pressure');
        
        // サイズスライダー
        sizeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.penSettings.size = value;
            this.popup.querySelector('.setting-row:nth-child(1) .value-display').textContent = `${value}px`;
            this.updatePenSettings();
        });
        
        // 不透明度スライダー
        opacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.penSettings.opacity = value;
            this.popup.querySelector('.setting-row:nth-child(2) .value-display').textContent = `${Math.round(value * 100)}%`;
            this.updatePenSettings();
        });
        
        // 筆圧チェック
        pressureCheck.addEventListener('change', (e) => {
            this.penSettings.pressure = e.target.checked;
            this.updatePenSettings();
        });
    }
    
    /**
     * ペン設定更新
     */
    updatePenSettings() {
        this.eventBus.emit('pen:settings-changed', this.penSettings);
    }
    
    /**
     * ポップアップ表示
     */
    show() {
        this.popup.classList.add('visible');
        this.isVisible = true;
    }
    
    /**
     * ポップアップ非表示
     */
    hide() {
        this.popup.classList.remove('visible');
        this.isVisible = false;
    }
    
    /**
     * ポップアップスタイル適用
     */
    applyPopupStyling() {
        const style = document.createElement('style');
        style.textContent = `
            .pen-popup {
                position: fixed;
                left: 84px;
                top: 80px;
                width: 220px;
                background: rgba(42,42,42,0.95);
                border-radius: 12px;
                padding: 16px;
                backdrop-filter: blur(8px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                opacity: 0;
                transform: translateX(-20px);
                pointer-events: none;
                transition: all 250ms ease-out;
                z-index: 1001;
            }
            
            .pen-popup.visible {
                opacity: 1;
                transform: translateX(0);
                pointer-events: auto;
            }
            
            .popup-header {
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid #444444;
            }
            
            .popup-title {
                color: #ffffff;
                font-size: 14px;
                font-weight: 600;
            }
            
            .popup-content {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .setting-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .setting-row label {
                color: #cccccc;
                font-size: 12px;
                min-width: 60px;
            }
            
            .setting-row input[type="range"] {
                flex: 1;
                height: 4px;
                background: #444444;
                border-radius: 2px;
                outline: none;
                -webkit-appearance: none;
            }
            
            .setting-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                background: #007acc;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .setting-row input[type="checkbox"] {
                width: 16px;
                height: 16px;
                accent-color: #007acc;
            }
            
            .value-display {
                color: #888888;
                font-size: 11px;
                min-width: 40px;
                text-align: right;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// === 簡易色選択（円形ピッカー）（100行） ===

/**
 * 簡易色選択ポップアップ（仮実装）
 */
class SimpleColorPicker {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.popup = null;
        this.isVisible = false;
        this.currentColor = '#000000';
        
        // ふたば☆ちゃんねる色パレット
        this.futabaColors = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
            '#FFDBAC', '#F4C2A1', '#E8A584', '#C8956D', '#A0845C',
            '#FFFFEE', '#F0E0D6', '#E0D0C4', '#D0C0B2', '#C0B0A0',
            '#800080', '#4A4A4A', '#2F4F4F', '#5C5C5C', '#3A3A3A'
        ];
        
        this.setupColorPicker();
    }
    
    /**
     * 色選択ポップアップ設定
     */
    setupColorPicker() {
        this.createColorPopup();
        this.setupColorPalette();
        this.applyColorPickerStyling();
    }
    
    /**
     * 色ポップアップ作成
     */
    createColorPopup() {
        this.popup = document.createElement('div');
        this.popup.className = 'color-popup';
        this.popup.innerHTML = `
            <div class="popup-header">
                <span class="popup-title">色選択</span>
            </div>
            <div class="color-palette"></div>
            <div class="current-color">
                <div class="color-preview"></div>
                <input type="color" id="custom-color" value="#000000">
            </div>
        `;
        
        document.body.appendChild(this.popup);
    }
    
    /**
     * カラーパレット設定
     */
    setupColorPalette() {
        const palette = this.popup.querySelector('.color-palette');
        const colorPreview = this.popup.querySelector('.color-preview');
        const customColor = this.popup.querySelector('#custom-color');
        
        // ふたば色パレット生成
        this.futabaColors.forEach(color => {
            const colorSample = document.createElement('div');
            colorSample.className = 'color-sample';
            colorSample.style.backgroundColor = color;
            colorSample.dataset.color = color;
            
            colorSample.addEventListener('click', () => {
                this.selectColor(color);
            });
            
            palette.appendChild(colorSample);
        });
        
        // カスタム色選択
        customColor.addEventListener('input', (e) => {
            this.selectColor(e.target.value);
        });
        
        // 初期色設定
        this.selectColor(this.currentColor);
    }
    
    /**
     * 色選択
     */
    selectColor(color) {
        this.currentColor = color;
        
        // プレビュー更新
        const colorPreview = this.popup.querySelector('.color-preview');
        colorPreview.style.backgroundColor = color;
        
        // カスタム色入力更新
        const customColor = this.popup.querySelector('#custom-color');
        customColor.value = color;
        
        // アクティブ色サンプル表示
        this.popup.querySelectorAll('.color-sample').forEach(sample => {
            sample.classList.toggle('active', sample.dataset.color === color);
        });
        
        // イベント発火
        this.eventBus.emit('color:changed', { color });
        
        console.log(`🎨 色選択: ${color}`);
    }
    
    /**
     * ポップアップ表示
     */
    show() {
        this.popup.classList.add('visible');
        this.isVisible = true;
    }
    
    /**
     * ポップアップ非表示
     */
    hide() {
        this.popup.classList.remove('visible');
        this.isVisible = false;
    }
    
    /**
     * 色ピッカースタイル適用
     */
    applyColorPickerStyling() {
        const style = document.createElement('style');
        style.textContent = `
            .color-popup {
                position: fixed;
                left: 84px;
                top: 200px;
                width: 280px;
                background: rgba(42,42,42,0.95);
                border-radius: 12px;
                padding: 16px;
                backdrop-filter: blur(8px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                opacity: 0;
                transform: translateX(-20px);
                pointer-events: none;
                transition: all 250ms ease-out;
                z-index: 1001;
            }
            
            .color-popup.visible {
                opacity: 1;
                transform: translateX(0);
                pointer-events: auto;
            }
            
            .color-palette {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
                margin-bottom: 16px;
            }
            
            .color-sample {
                width: 32px;
                height: 32px;
                border-radius: 4px;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 150ms ease-out;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .color-sample:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
            
            .color-sample.active {
                border-color: #007acc;
                transform: scale(1.15);
                box-shadow: 0 4px 12px rgba(0,122,204,0.4);
            }
            
            .current-color {
                display: flex;
                align-items: center;
                gap: 12px;
                padding-top: 12px;
                border-top: 1px solid #444444;
            }
            
            .color-preview {
                width: 40px;
                height: 40px;
                border-radius: 6px;
                border: 2px solid #444444;
                background: #000000;
            }
            
            #custom-color {
                flex: 1;
                height: 40px;
                border: none;
                border-radius: 6px;
                background: transparent;
                cursor: pointer;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// === キャンバスサイズ調整UI（50行） ===

/**
 * キャンバスサイズ調整（仮実装）
 */
class CanvasSizeController {
    constructor(app, eventBus) {
        this.app = app;
        this.eventBus = eventBus;
        
        this.setupCanvasControls();
    }
    
    /**
     * キャンバス制御設定
     */
    setupCanvasControls() {
        // キャンバス領域調整
        this.adjustCanvasLayout();
        
        // リサイズ監視
        const resizeHandler = debounce(() => {
            this.adjustCanvasLayout();
        }, 100);
        
        window.addEventListener('resize', resizeHandler);
        
        console.log('📐 キャンバスサイズ制御初期化完了');
    }
    
    /**
     * キャンバスレイアウト調整
     */
    adjustCanvasLayout() {
        const canvas = document.getElementById('drawingCanvas');
        const canvasArea = document.getElementById('canvasArea');
        
        if (!canvas || !canvasArea) return;
        
        // サイドバー幅を考慮
        const sidebarWidth = 64;
        const padding = 40;
        
        const rect = canvasArea.getBoundingClientRect();
        const availableWidth = rect.width - sidebarWidth - padding;
        const availableHeight = rect.height - padding;
        
        // 最大サイズ制限
        const maxWidth = Math.min(availableWidth, 1200);
        const maxHeight = Math.min(availableHeight, 800);
        
        // キャンバスサイズ更新
        canvas.style.width = `${maxWidth}px`;
        canvas.style.height = `${maxHeight}px`;
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        
        // キャンバス中央配置
        canvasArea.style.paddingLeft = `${sidebarWidth}px`;
        canvasArea.style.display = 'flex';
        canvasArea.style.alignItems = 'center';
        canvasArea.style.justifyContent = 'center';
        
        // OGLエンジンビューポート更新
        if (this.app.engine) {
            this.app.engine.updateViewport();
        }
        
        console.log(`📐 キャンバスサイズ調整: ${maxWidth}×${maxHeight}`);
    }
}

// === 動作確認用最小機能（100行） ===

/**
 * Phase1.5統合制御システム
 * 各コンポーネント連携・動作確認・Phase2橋渡し
 */
export class OGLInteractionEnhancer {
    constructor(app) {
        this.app = app;
        this.eventBus = app.eventBus;
        
        // UI コンポーネント
        this.sidebar = null;
        this.penPopup = null;
        this.colorPicker = null;
        this.canvasController = null;
        
        // 連携オブジェクト
        this.drawingCore = null;
        this.inputController = null;
        this.historyController = null;
        this.shortcutController = null;
        
        // 初期化状態
        this.initialized = false;
        
        this.initializeInteractionEnhancer();
    }
    
    /**
     * インタラクション拡張初期化
     */
    async initializeInteractionEnhancer() {
        try {
            await this.initializeUIComponents();
            await this.setupComponentConnections();
            await this.setupEventHandlers();
            await this.loadExternalComponents();
            
            this.initialized = true;
            this.eventBus.emit('interaction:initialized');
            
            console.log('🚀 Phase1.5インタラクション拡張初期化完了');
        } catch (error) {
            console.error('❌ インタラクション拡張初期化エラー:', error);
        }
    }
    
    /**
     * UIコンポーネント初期化
     */
    async initializeUIComponents() {
        // サイドバー初期化
        this.sidebar = new TemporarySidebar(this.app, this.eventBus);
        
        // ペンポップアップ初期化
        this.penPopup = new PenToolPopup(this.eventBus);
        
        // 色選択初期化
        this.colorPicker = new SimpleColorPicker(this.eventBus);
        
        // キャンバス制御初期化
        this.canvasController = new CanvasSizeController(this.app, this.eventBus);
        
        console.log('🎨 UIコンポーネント初期化完了');
    }
    
    /**
     * コンポーネント連携設定
     */
    async setupComponentConnections() {
        // 遅延読み込み対応
        const waitForComponent = (componentName, timeout = 5000) => {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    const component = this.app[componentName];
                    if (component) {
                        clearInterval(checkInterval);
                        resolve(component);
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(null);
                }, timeout);
            });
        };
        
        // 描画コア連携
        this.drawingCore = await waitForComponent('drawingCore');
        if (this.drawingCore) {
            this.sidebar.connectDrawingCore(this.drawingCore);
        }
        
        // 入力コントローラー連携
        this.inputController = await waitForComponent('inputController');
        if (this.inputController) {
            this.sidebar.connectInputController(this.inputController);
        }
        
        // 履歴コントローラー連携
        this.historyController = await waitForComponent('historyController');
        if (this.historyController) {
            this.sidebar.connectHistoryController(this.historyController);
        }
        
        console.log('🔗 コンポーネント連携設定完了');
    }
    
    /**
     * イベントハンドラー設定
     */
    async setupEventHandlers() {
        // 色選択表示制御
        this.eventBus.on('tool:selected', (event) => {
            if (event.toolId === 'color') {
                this.colorPicker.show();
            } else {
                this.colorPicker.hide();
            }
        });
        
        // ペン設定変更
        this.eventBus.on('pen:settings-changed', (settings) => {
            if (this.drawingCore && this.drawingCore.penTool) {
                this.drawingCore.penTool.updateConfig({
                    width: settings.size,
                    opacity: settings.opacity,
                    pressureEnabled: settings.pressure
                });
            }
        });
        
        // 色変更
        this.eventBus.on('color:changed', (event) => {
            if (this.drawingCore && this.drawingCore.penTool) {
                this.drawingCore.penTool.updateConfig({
                    color: event.color
                });
            }
        });
        
        // ショートカット統合
        this.eventBus.on('shortcut:keydown', (e) => {
            this.handleShortcuts(e);
        });
        
        console.log('⚡ イベントハンドラー設定完了');
    }
    
    /**
     * 外部コンポーネント読み込み
     */
    async loadExternalComponents() {
        try {
            // 描画コア動的読み込み
            if (!this.app.drawingCore) {
                const { OGLDrawingCore } = await import('./OGLDrawingCore.js');
                this.app.drawingCore = new OGLDrawingCore(this.app.engine);
                this.drawingCore = this.app.drawingCore;
                this.sidebar.connectDrawingCore(this.drawingCore);
            }
            
            // 入力コントローラー動的読み込み
            if (!this.app.inputController) {
                const { OGLInputController } = await import('./OGLInputController.js');
                this.app.inputController = new OGLInputController(this.app.engine, this.eventBus);
                this.inputController = this.app.inputController;
                this.sidebar.connectInputController(this.inputController);
            }
            
            console.log('📦 外部コンポーネント読み込み完了');
        } catch (error) {
            console.warn('⚠️ 外部コンポーネント読み込み失敗:', error.message);
        }
    }
    
    /**
     * ショートカット処理
     */
    handleShortcuts(e) {
        // 基本ツールショートカット
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
            switch (e.key) {
                case 'b':
                case 'B':
                    this.sidebar.selectTool('pen');
                    e.preventDefault();
                    break;
                case 'e':
                case 'E':
                    this.sidebar.selectTool('eraser');
                    e.preventDefault();
                    break;
                case 'i':
                case 'I':
                    this.sidebar.handleToolClick('color');
                    e.preventDefault();
                    break;
            }
        }
        
        // システムショートカット
        if (e.ctrlKey) {
            switch (e.key) {
                case 's':
                case 'S':
                    this.sidebar.downloadCanvas();
                    e.preventDefault();
                    break;
            }
        }
    }
    
    /**
     * ダウンロード機能（仮実装）
     */
    downloadCanvas() {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) return;
        
        try {
            // WebGL → 2D Canvas変換（基本実装）
            const downloadCanvas = document.createElement('canvas');
            downloadCanvas.width = canvas.width;
            downloadCanvas.height = canvas.height;
            
            const ctx = downloadCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0);
            
            // ダウンロード実行
            const link = document.createElement('a');
            link.download = `drawing_${new Date().getTime()}.png`;
            link.href = downloadCanvas.toDataURL();
            link.click();
            
            console.log('💾 キャンバスダウンロード実行');
        } catch (error) {
            console.error('❌ ダウンロードエラー:', error);
        }
    }
    
    /**
     * 設定画面表示（仮実装）
     */
    showSettings() {
        alert('設定機能はPhase2で実装予定です');
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // イベントリスナー解除
        this.eventBus.off('tool:selected');
        this.eventBus.off('pen:settings-changed');
        this.eventBus.off('color:changed');
        this.eventBus.off('shortcut:keydown');
        
        // DOM要素削除
        if (this.sidebar && this.sidebar.sidebar) {
            this.sidebar.sidebar.remove();
        }
        if (this.penPopup && this.penPopup.popup) {
            this.penPopup.popup.remove();
        }
        if (this.colorPicker && this.colorPicker.popup) {
            this.colorPicker.popup.remove();
        }
        
        console.log('🗑️ Phase1.5インタラクション拡張解放完了');
    }
}

// Phase1.5統合用の追加メソッド
TemporarySidebar.prototype.downloadCanvas = function() {
    if (this.app && typeof this.app.downloadCanvas === 'function') {
        this.app.downloadCanvas();
    } else {
        // フォールバック実装
        const canvas = document.getElementById('drawingCanvas');
        if (canvas) {http://localhost:3001/
            const link = document.createElement('a');
            link.download = `drawing_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    }
};

TemporarySidebar.prototype.showColorPicker = function() {
    this.eventBus.emit('tool:selected', { toolId: 'color' });
};

TemporarySidebar.prototype.showSettings = function() {
    alert('設定機能はPhase2で実装予定です');
};

// モジュールエクスポート（Phase1.5専用）
export { TemporarySidebar, PenToolPopup, SimpleColorPicker, CanvasSizeController };