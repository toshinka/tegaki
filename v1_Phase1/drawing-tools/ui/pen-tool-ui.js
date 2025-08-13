/**
 * PenToolUI - ポップアップ完全対応版: 図のようなポップアップ実装完了
 * 
 * 🔧 修正内容:
 * 1. ✅ 構文エラー修正・コード完全性確保
 * 2. ✅ プリセット連動ポップアップ完全実装
 * 3. ✅ スライダー連動プレビュー機能
 * 4. ✅ カスタムプリセット保存機能
 * 5. ✅ 全体プリセットリセット機能
 * 6. ✅ プレビューサイズ制限機能
 */

class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem.app;
        
        // 初期化状態管理
        this.isInitialized = false;
        this.initializationInProgress = false;
        this.toolActive = false;
        this.errorCount = 0;
        
        // プリセット管理
        this.presets = [
            { size: 1, opacity: 0.85 },
            { size: 2, opacity: 0.85 },
            { size: 4, opacity: 0.85 },
            { size: 100, opacity: 0.85 },
            { size: 16, opacity: 0.85 },
            { size: 32, opacity: 0.85 }
        ];
        this.selectedPresetIndex = 3; // 100.0px デフォルト選択
        
        // 現在の設定値
        this.currentSettings = {
            size: 100.0,
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3
        };
        
        // ポップアップ要素参照
        this.popupElement = null;
        this.isPopupVisible = false;
        
        console.log('🎨 PenToolUI (完全対応版) 初期化準備完了');
    }
    
    /**
     * 初期化
     */
    async init() {
        if (this.isInitialized) return true;
        if (this.initializationInProgress) return false;
        
        console.log('🎨 PenToolUI 完全対応版初期化開始...');
        this.initializationInProgress = true;
        
        try {
            // DOM要素準備待機
            await this.waitForDOMElements();
            
            // ポップアップ要素作成
            this.createPopupElement();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // プリセット初期化
            this.initializePresets();
            
            // 保存された設定読み込み
            this.loadSavedSettings();
            
            this.isInitialized = true;
            this.initializationInProgress = false;
            
            console.log('✅ PenToolUI 完全対応版初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ PenToolUI初期化失敗:', error);
            this.initializationInProgress = false;
            return false;
        }
    }
    
    /**
     * DOM要素準備待機
     */
    async waitForDOMElements() {
        return new Promise((resolve) => {
            const checkElements = () => {
                const penButton = document.getElementById('pen-tool-button');
                if (penButton) {
                    resolve();
                } else {
                    setTimeout(checkElements, 100);
                }
            };
            checkElements();
        });
    }
    
    /**
     * ポップアップ要素作成
     */
    createPopupElement() {
        // 既存のポップアップ削除
        const existing = document.getElementById('pen-settings-popup');
        if (existing) {
            existing.remove();
        }
        
        // 新しいポップアップ要素作成
        this.popupElement = document.createElement('div');
        this.popupElement.id = 'pen-settings-popup';
        this.popupElement.className = 'pen-settings-popup';
        
        this.popupElement.innerHTML = this.createPopupHTML();
        this.popupElement.style.cssText = this.getPopupCSS();
        
        document.body.appendChild(this.popupElement);
        console.log('✅ ポップアップ要素作成完了');
    }
    
    /**
     * ポップアップHTML生成
     */
    createPopupHTML() {
        return `
            <div class="popup-header">
                <h3>ベクターペンツール設定</h3>
            </div>
            <div class="popup-content">
                <!-- プリセット選択 -->
                <div class="preset-row">
                    ${this.presets.map((preset, index) => `
                        <div class="preset-item ${index === this.selectedPresetIndex ? 'selected' : ''}" data-index="${index}">
                            <div class="preset-preview">
                                <div class="preset-circle" style="width: ${Math.min(preset.size * 0.5, 20)}px; height: ${Math.min(preset.size * 0.5, 20)}px; opacity: ${preset.opacity};"></div>
                            </div>
                            <div class="preset-label">${preset.size}px</div>
                            <div class="preset-opacity">${Math.round(preset.opacity * 100)}%</div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- スライダー設定 -->
                <div class="slider-section">
                    <div class="slider-row">
                        <label>サイズ</label>
                        <div class="slider-container">
                            <button class="adjust-btn" data-action="decrease" data-target="size" data-value="-10">-10</button>
                            <button class="adjust-btn" data-action="decrease" data-target="size" data-value="-1">-1</button>
                            <button class="adjust-btn" data-action="decrease" data-target="size" data-value="-0.1">-0.1</button>
                            <input type="range" id="size-slider" min="0.1" max="500" step="0.1" value="${this.currentSettings.size}">
                            <button class="adjust-btn" data-action="increase" data-target="size" data-value="+0.1">+0.1</button>
                            <button class="adjust-btn" data-action="increase" data-target="size" data-value="+1">+1</button>
                            <button class="adjust-btn" data-action="increase" data-target="size" data-value="+10">+10</button>
                        </div>
                        <span class="value-display" id="size-value">${this.currentSettings.size.toFixed(1)}px</span>
                    </div>
                    
                    <div class="slider-row">
                        <label>不透明度</label>
                        <div class="slider-container">
                            <button class="adjust-btn" data-action="decrease" data-target="opacity" data-value="-10">-10</button>
                            <button class="adjust-btn" data-action="decrease" data-target="opacity" data-value="-1">-1</button>
                            <button class="adjust-btn" data-action="decrease" data-target="opacity" data-value="-0.1">-0.1</button>
                            <input type="range" id="opacity-slider" min="0" max="100" step="0.1" value="${this.currentSettings.opacity * 100}">
                            <button class="adjust-btn" data-action="increase" data-target="opacity" data-value="+0.1">+0.1</button>
                            <button class="adjust-btn" data-action="increase" data-target="opacity" data-value="+1">+1</button>
                            <button class="adjust-btn" data-action="increase" data-target="opacity" data-value="+10">+10</button>
                        </div>
                        <span class="value-display" id="opacity-value">${Math.round(this.currentSettings.opacity * 100)}%</span>
                    </div>
                    
                    <div class="slider-row">
                        <label>筆圧感度</label>
                        <div class="slider-container">
                            <button class="adjust-btn" data-action="decrease" data-target="pressure" data-value="-10">-10</button>
                            <button class="adjust-btn" data-action="decrease" data-target="pressure" data-value="-1">-1</button>
                            <button class="adjust-btn" data-action="decrease" data-target="pressure" data-value="-0.1">-0.1</button>
                            <input type="range" id="pressure-slider" min="0" max="100" step="0.1" value="${this.currentSettings.pressure * 100}">
                            <button class="adjust-btn" data-action="increase" data-target="pressure" data-value="+0.1">+0.1</button>
                            <button class="adjust-btn" data-action="increase" data-target="pressure" data-value="+1">+1</button>
                            <button class="adjust-btn" data-action="increase" data-target="pressure" data-value="+10">+10</button>
                        </div>
                        <span class="value-display" id="pressure-value">${Math.round(this.currentSettings.pressure * 100)}%</span>
                    </div>
                    
                    <div class="slider-row">
                        <label>線補正</label>
                        <div class="slider-container">
                            <button class="adjust-btn" data-action="decrease" data-target="smoothing" data-value="-10">-10</button>
                            <button class="adjust-btn" data-action="decrease" data-target="smoothing" data-value="-1">-1</button>
                            <button class="adjust-btn" data-action="decrease" data-target="smoothing" data-value="-0.1">-0.1</button>
                            <input type="range" id="smoothing-slider" min="0" max="100" step="0.1" value="${this.currentSettings.smoothing * 100}">
                            <button class="adjust-btn" data-action="increase" data-target="smoothing" data-value="+0.1">+0.1</button>
                            <button class="adjust-btn" data-action="increase" data-target="smoothing" data-value="+1">+1</button>
                            <button class="adjust-btn" data-action="increase" data-target="smoothing" data-value="+10">+10</button>
                        </div>
                        <span class="value-display" id="smoothing-value">${Math.round(this.currentSettings.smoothing * 100)}%</span>
                    </div>
                </div>
                
                <!-- オプション設定 -->
                <div class="options-section">
                    <div class="option-row">
                        <label><input type="checkbox" id="pressure-enabled" checked> 筆圧感度</label>
                        <span class="option-status">有効</span>
                    </div>
                    <div class="option-row">
                        <label><input type="checkbox" id="edge-smoothing"> エッジスムージング</label>
                        <span class="option-status">無効</span>
                    </div>
                    <div class="option-row">
                        <label><input type="checkbox" id="gpu-acceleration" checked> GPU加速</label>
                        <span class="option-status">有効</span>
                    </div>
                </div>
                
                <!-- ボタン -->
                <div class="button-row">
                    <button id="save-preset-btn" class="action-btn">プリセット保存</button>
                    <button id="reset-all-btn" class="action-btn reset-btn">全体リセット</button>
                    <button id="close-popup-btn" class="action-btn close-btn">閉じる</button>
                </div>
            </div>
        `;
    }
    
    /**
     * ポップアップCSS
     */
    getPopupCSS() {
        return `
            display: none;
            position: absolute;
            top: 60px;
            left: 20px;
            background: #f8f4f0;
            border: 3px solid #800000;
            border-radius: 12px;
            padding: 0;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            z-index: 10000;
            width: 600px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            user-select: none;
        `;
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // ペンボタンクリックイベント
        const penButton = document.getElementById('pen-tool-button');
        if (penButton) {
            penButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePopup();
            });
        }
        
        // ポップアップ内イベント
        this.popupElement.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // プリセット選択
            if (e.target.closest('.preset-item')) {
                const index = parseInt(e.target.closest('.preset-item').dataset.index);
                this.selectPreset(index);
            }
            
            // 調整ボタン
            if (e.target.classList.contains('adjust-btn')) {
                this.handleAdjustButton(e.target);
            }
            
            // アクションボタン
            if (e.target.id === 'save-preset-btn') {
                this.saveCurrentAsPreset();
            } else if (e.target.id === 'reset-all-btn') {
                this.resetAllPresets();
            } else if (e.target.id === 'close-popup-btn') {
                this.hidePopup();
            }
        });
        
        // スライダーイベント
        ['size', 'opacity', 'pressure', 'smoothing'].forEach(type => {
            const slider = this.popupElement.querySelector(`#${type}-slider`);
            if (slider) {
                slider.addEventListener('input', () => {
                    this.handleSliderChange(type, slider.value);
                });
            }
        });
        
        // チェックボックスイベント
        ['pressure-enabled', 'edge-smoothing', 'gpu-acceleration'].forEach(id => {
            const checkbox = this.popupElement.querySelector(`#${id}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.handleCheckboxChange(id, checkbox.checked);
                });
            }
        });
        
        // 外部クリックで閉じる
        document.addEventListener('click', (e) => {
            if (this.isPopupVisible && !this.popupElement.contains(e.target) && e.target.id !== 'pen-tool-button') {
                this.hidePopup();
            }
        });
        
        console.log('✅ イベントリスナー設定完了');
    }
    
    /**
     * プリセット初期化
     */
    initializePresets() {
        // CSSスタイル追加
        const style = document.createElement('style');
        style.textContent = `
            .pen-settings-popup .popup-header {
                background: #800000;
                color: white;
                padding: 12px 20px;
                border-radius: 9px 9px 0 0;
                margin: 0;
                font-size: 16px;
                font-weight: bold;
            }
            
            .pen-settings-popup .popup-header h3 {
                margin: 0;
                font-size: 16px;
            }
            
            .pen-settings-popup .popup-content {
                padding: 20px;
            }
            
            .pen-settings-popup .preset-row {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
                padding: 15px;
                background: #fff;
                border-radius: 8px;
                border: 1px solid #ddd;
            }
            
            .pen-settings-popup .preset-item {
                flex: 1;
                text-align: center;
                padding: 10px 8px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                border: 2px solid transparent;
            }
            
            .pen-settings-popup .preset-item:hover {
                background: #f0f8ff;
                border-color: #cce7ff;
            }
            
            .pen-settings-popup .preset-item.selected {
                background: #ffe6e6;
                border-color: #800000;
                color: #800000;
                font-weight: bold;
            }
            
            .pen-settings-popup .preset-preview {
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 5px;
            }
            
            .pen-settings-popup .preset-circle {
                background: #800000;
                border-radius: 50%;
                min-width: 2px;
                min-height: 2px;
                border: 1px solid rgba(128, 0, 0, 0.3);
            }
            
            .pen-settings-popup .preset-label {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 2px;
            }
            
            .pen-settings-popup .preset-opacity {
                font-size: 10px;
                color: #666;
            }
            
            .pen-settings-popup .slider-section {
                margin-bottom: 20px;
            }
            
            .pen-settings-popup .slider-row {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                gap: 10px;
            }
            
            .pen-settings-popup .slider-row label {
                min-width: 80px;
                font-weight: bold;
                color: #333;
            }
            
            .pen-settings-popup .slider-container {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .pen-settings-popup .adjust-btn {
                min-width: 35px;
                height: 24px;
                border: 1px solid #ccc;
                background: #f8f8f8;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.1s;
            }
            
            .pen-settings-popup .adjust-btn:hover {
                background: #e8e8e8;
                border-color: #999;
            }
            
            .pen-settings-popup .adjust-btn:active {
                background: #d8d8d8;
            }
            
            .pen-settings-popup input[type="range"] {
                flex: 1;
                margin: 0 10px;
                height: 6px;
                border-radius: 3px;
                background: linear-gradient(to right, #800000 0%, #ff6b6b 100%);
                outline: none;
                -webkit-appearance: none;
            }
            
            .pen-settings-popup input[type="range"]::-webkit-slider-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #800000;
                cursor: pointer;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                -webkit-appearance: none;
            }
            
            .pen-settings-popup .value-display {
                min-width: 60px;
                text-align: right;
                font-weight: bold;
                color: #800000;
                background: #fff;
                padding: 4px 8px;
                border-radius: 4px;
                border: 1px solid #ddd;
            }
            
            .pen-settings-popup .options-section {
                margin-bottom: 20px;
                padding: 15px;
                background: #f9f9f9;
                border-radius: 8px;
            }
            
            .pen-settings-popup .option-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .pen-settings-popup .option-row:last-child {
                margin-bottom: 0;
            }
            
            .pen-settings-popup .option-row label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            
            .pen-settings-popup .option-status {
                font-size: 12px;
                padding: 2px 8px;
                border-radius: 12px;
                background: #e8f5e8;
                color: #2d5a2d;
            }
            
            .pen-settings-popup .button-row {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .pen-settings-popup .action-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s;
            }
            
            .pen-settings-popup .action-btn:not(.reset-btn):not(.close-btn) {
                background: #800000;
                color: white;
            }
            
            .pen-settings-popup .action-btn:not(.reset-btn):not(.close-btn):hover {
                background: #a00000;
            }
            
            .pen-settings-popup .reset-btn {
                background: #ff6b47;
                color: white;
            }
            
            .pen-settings-popup .reset-btn:hover {
                background: #ff5533;
            }
            
            .pen-settings-popup .close-btn {
                background: #666;
                color: white;
            }
            
            .pen-settings-popup .close-btn:hover {
                background: #777;
            }
        `;
        
        document.head.appendChild(style);
        console.log('✅ プリセット初期化・スタイル適用完了');
    }
    
    /**
     * プリセット選択
     */
    selectPreset(index) {
        if (index < 0 || index >= this.presets.length) return;
        
        this.selectedPresetIndex = index;
        const preset = this.presets[index];
        
        // 設定値更新
        this.currentSettings.size = preset.size;
        this.currentSettings.opacity = preset.opacity;
        
        // UI更新
        this.updatePresetsUI();
        this.updateSlidersFromSettings();
        this.updatePreviewCircles();
        
        // 描画システムに反映
        this.applySettingsToDrawingSystem();
        
        console.log(`🎨 プリセット${index + 1}選択: ${preset.size}px, ${Math.round(preset.opacity * 100)}%`);
    }
    
    /**
     * プリセットUI更新
     */
    updatePresetsUI() {
        const presetItems = this.popupElement.querySelectorAll('.preset-item');
        presetItems.forEach((item, index) => {
            if (index === this.selectedPresetIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    /**
     * スライダー値を設定から更新
     */
    updateSlidersFromSettings() {
        const sizeSlider = this.popupElement.querySelector('#size-slider');
        const opacitySlider = this.popupElement.querySelector('#opacity-slider');
        const pressureSlider = this.popupElement.querySelector('#pressure-slider');
        const smoothingSlider = this.popupElement.querySelector('#smoothing-slider');
        
        if (sizeSlider) {
            sizeSlider.value = this.currentSettings.size;
            this.updateValueDisplay('size', this.currentSettings.size);
        }
        if (opacitySlider) {
            opacitySlider.value = this.currentSettings.opacity * 100;
            this.updateValueDisplay('opacity', this.currentSettings.opacity * 100);
        }
        if (pressureSlider) {
            pressureSlider.value = this.currentSettings.pressure * 100;
            this.updateValueDisplay('pressure', this.currentSettings.pressure * 100);
        }
        if (smoothingSlider) {
            smoothingSlider.value = this.currentSettings.smoothing * 100;
            this.updateValueDisplay('smoothing', this.currentSettings.smoothing * 100);
        }
    }
    
    /**
     * プレビュー円更新（サイズ制限付き）
     */
    updatePreviewCircles() {
        const presetItems = this.popupElement.querySelectorAll('.preset-item');
        presetItems.forEach((item, index) => {
            const circle = item.querySelector('.preset-circle');
            const preset = this.presets[index];
            
            // サイズ制限: 最大20px、最小2px
            let displaySize = preset.size * 0.5;
            displaySize = Math.max(2, Math.min(20, displaySize));
            
            circle.style.width = displaySize + 'px';
            circle.style.height = displaySize + 'px';
            circle.style.opacity = preset.opacity;
        });
    }
    
    /**
     * スライダー変更処理
     */
    handleSliderChange(type, value) {
        switch (type) {
            case 'size':
                this.currentSettings.size = parseFloat(value);
                this.updateValueDisplay('size', this.currentSettings.size);
                break;
            case 'opacity':
                this.currentSettings.opacity = parseFloat(value) / 100;
                this.updateValueDisplay('opacity', parseFloat(value));
                break;
            case 'pressure':
                this.currentSettings.pressure = parseFloat(value) / 100;
                this.updateValueDisplay('pressure', parseFloat(value));
                break;
            case 'smoothing':
                this.currentSettings.smoothing = parseFloat(value) / 100;
                this.updateValueDisplay('smoothing', parseFloat(value));
                break;
        }
        
        // 現在のプリセット更新
        if (this.selectedPresetIndex !== -1 && (type === 'size' || type === 'opacity')) {
            this.presets[this.selectedPresetIndex].size = this.currentSettings.size;
            this.presets[this.selectedPresetIndex].opacity = this.currentSettings.opacity;
            this.updatePreviewCircles();
        }
        
        // 描画システムに反映
        this.applySettingsToDrawingSystem();
    }
    
    /**
     * 調整ボタン処理
     */
    handleAdjustButton(button) {
        const target = button.dataset.target;
        const value = parseFloat(button.dataset.value);
        
        let currentValue = 0;
        let min = 0, max = 100, step = 0.1;
        
        switch (target) {
            case 'size':
                currentValue = this.currentSettings.size;
                min = 0.1;
                max = 500;
                break;
            case 'opacity':
                currentValue = this.currentSettings.opacity * 100;
                min = 0;
                max = 100;
                break;
            case 'pressure':
                currentValue = this.currentSettings.pressure * 100;
                min = 0;
                max = 100;
                break;
            case 'smoothing':
                currentValue = this.currentSettings.smoothing * 100;
                min = 0;
                max = 100;
                break;
        }
        
        let newValue = currentValue + value;
        newValue = Math.max(min, Math.min(max, newValue));
        
        const slider = this.popupElement.querySelector(`#${target}-slider`);
        if (slider) {
            slider.value = target === 'size' ? newValue : newValue;
            this.handleSliderChange(target, newValue);
        }
    }
    
    /**
     * 値表示更新
     */
    updateValueDisplay(type, value) {
        const display = this.popupElement.querySelector(`#${type}-value`);
        if (display) {
            switch (type) {
                case 'size':
                    display.textContent = value.toFixed(1) + 'px';
                    break;
                case 'opacity':
                case 'pressure':
                case 'smoothing':
                    display.textContent = Math.round(value) + '%';
                    break;
            }
        }
    }
    
    /**
     * チェックボックス変更処理
     */
    handleCheckboxChange(id, checked) {
        const statusSpan = this.popupElement.querySelector(`label[for="${id}"]`)?.parentElement?.querySelector('.option-status');
        if (statusSpan) {
            statusSpan.textContent = checked ? '有効' : '無効';
            statusSpan.style.background = checked ? '#e8f5e8' : '#f5e8e8';
            statusSpan.style.color = checked ? '#2d5a2d' : '#5a2d2d';
        }
        
        console.log(`🔧 ${id}: ${checked ? '有効' : '無効'}`);
    }
    
    /**
     * 現在の設定をプリセットとして保存
     */
    saveCurrentAsPreset() {
        const newPreset = {
            size: this.currentSettings.size,
            opacity: this.currentSettings.opacity
        };
        
        // 空いているプリセットスロットを探すか、最後に追加
        let targetIndex = this.presets.findIndex(p => p.size === newPreset.size && p.opacity === newPreset.opacity);
        
        if (targetIndex === -1) {
            // 新しいプリセットとして追加（最大6個）
            if (this.presets.length < 6) {
                this.presets.push(newPreset);
                targetIndex = this.presets.length - 1;
            } else {
                // 最後のプリセットを置き換え
                targetIndex = 5;
                this.presets[targetIndex] = newPreset;
            }
        }
        
        // UIを再作成
        this.recreatePresetRow();
        this.selectPreset(targetIndex);
        
        // ローカルストレージに保存
        this.saveSettingsToStorage();
        
        console.log(`💾 プリセット保存完了: ${newPreset.size}px, ${Math.round(newPreset.opacity * 100)}%`);
        
        // 一時的な保存通知
        this.showSaveNotification();
    }
    
    /**
     * 全プリセットリセット
     */
    resetAllPresets() {
        if (confirm('全てのプリセットを初期状態にリセットしますか？')) {
            this.presets = [
                { size: 1, opacity: 0.85 },
                { size: 2, opacity: 0.85 },
                { size: 4, opacity: 0.85 },
                { size: 100, opacity: 0.85 },
                { size: 16, opacity: 0.85 },
                { size: 32, opacity: 0.85 }
            ];
            
            this.selectedPresetIndex = 3;
            this.currentSettings = {
                size: 100.0,
                opacity: 0.85,
                pressure: 0.5,
                smoothing: 0.3
            };
            
            // UI更新
            this.recreatePresetRow();
            this.updateSlidersFromSettings();
            this.updatePreviewCircles();
            
            // ストレージから削除
            localStorage.removeItem('pen-tool-presets');
            localStorage.removeItem('pen-tool-settings');
            
            console.log('🔄 全プリセットリセット完了');
            
            // リセット通知
            this.showResetNotification();
        }
    }
    
    /**
     * プリセット行を再作成
     */
    recreatePresetRow() {
        const presetRow = this.popupElement.querySelector('.preset-row');
        if (presetRow) {
            presetRow.innerHTML = this.presets.map((preset, index) => `
                <div class="preset-item ${index === this.selectedPresetIndex ? 'selected' : ''}" data-index="${index}">
                    <div class="preset-preview">
                        <div class="preset-circle" style="width: ${Math.min(preset.size * 0.5, 20)}px; height: ${Math.min(preset.size * 0.5, 20)}px; opacity: ${preset.opacity};"></div>
                    </div>
                    <div class="preset-label">${preset.size}px</div>
                    <div class="preset-opacity">${Math.round(preset.opacity * 100)}%</div>
                </div>
            `).join('');
        }
    }
    
    /**
     * 保存通知表示
     */
    showSaveNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10001;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = '✅ プリセットを保存しました';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
    
    /**
     * リセット通知表示
     */
    showResetNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FF5722;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10001;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = '🔄 全プリセットをリセットしました';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }
    
    /**
     * 設定をローカルストレージに保存
     */
    saveSettingsToStorage() {
        try {
            localStorage.setItem('pen-tool-presets', JSON.stringify(this.presets));
            localStorage.setItem('pen-tool-settings', JSON.stringify(this.currentSettings));
            localStorage.setItem('pen-tool-selected-preset', this.selectedPresetIndex.toString());
        } catch (error) {
            console.warn('⚠️ 設定保存失敗:', error);
        }
    }
    
    /**
     * 保存された設定を読み込み
     */
    loadSavedSettings() {
        try {
            const savedPresets = localStorage.getItem('pen-tool-presets');
            const savedSettings = localStorage.getItem('pen-tool-settings');
            const savedSelectedPreset = localStorage.getItem('pen-tool-selected-preset');
            
            if (savedPresets) {
                const presets = JSON.parse(savedPresets);
                if (Array.isArray(presets) && presets.length > 0) {
                    this.presets = presets;
                }
            }
            
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (settings && typeof settings === 'object') {
                    this.currentSettings = { ...this.currentSettings, ...settings };
                }
            }
            
            if (savedSelectedPreset) {
                const index = parseInt(savedSelectedPreset);
                if (index >= 0 && index < this.presets.length) {
                    this.selectedPresetIndex = index;
                }
            }
            
            console.log('✅ 保存された設定を読み込み完了');
            
        } catch (error) {
            console.warn('⚠️ 設定読み込み失敗:', error);
        }
    }
    
    /**
     * 描画システムに設定を適用
     */
    applySettingsToDrawingSystem() {
        if (this.drawingToolsSystem && this.drawingToolsSystem.updateBrushSettings) {
            const settings = {
                size: this.currentSettings.size,
                opacity: this.currentSettings.opacity,
                pressure: this.currentSettings.pressure,
                smoothing: this.currentSettings.smoothing,
                color: 0x800000  // デフォルト色
            };
            
            this.drawingToolsSystem.updateBrushSettings(settings);
        }
        
        // 設定変更時は自動保存
        this.saveSettingsToStorage();
    }
    
    /**
     * ポップアップ表示切り替え
     */
    togglePopup() {
        if (this.isPopupVisible) {
            this.hidePopup();
        } else {
            this.showPopup();
        }
    }
    
    /**
     * ポップアップ表示
     */
    showPopup() {
        if (!this.isInitialized || !this.popupElement) {
            console.warn('⚠️ PenToolUI未初期化またはポップアップ要素なし');
            return false;
        }
        
        // ツール選択
        if (this.drawingToolsSystem && this.drawingToolsSystem.setTool) {
            this.drawingToolsSystem.setTool('pen');
        }
        
        // ポップアップ表示
        this.popupElement.style.display = 'block';
        this.isPopupVisible = true;
        this.toolActive = true;
        
        // 現在の設定でUI更新
        this.updateSlidersFromSettings();
        this.updatePreviewCircles();
        this.updatePresetsUI();
        
        // 位置調整（画面内に収める）
        this.adjustPopupPosition();
        
        console.log('📋 ペンツールポップアップ表示');
        return true;
    }
    
    /**
     * ポップアップ非表示
     */
    hidePopup() {
        if (this.popupElement) {
            this.popupElement.style.display = 'none';
            this.isPopupVisible = false;
        }
        console.log('❌ ペンツールポップアップ非表示');
    }
    
    /**
     * ポップアップ位置調整
     */
    adjustPopupPosition() {
        if (!this.popupElement) return;
        
        const rect = this.popupElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = 20;
        let top = 60;
        
        // 右端はみ出し調整
        if (rect.left + rect.width > viewportWidth - 20) {
            left = viewportWidth - rect.width - 20;
        }
        
        // 下端はみ出し調整
        if (rect.top + rect.height > viewportHeight - 20) {
            top = viewportHeight - rect.height - 20;
        }
        
        this.popupElement.style.left = Math.max(20, left) + 'px';
        this.popupElement.style.top = Math.max(20, top) + 'px';
    }
    
    /**
     * ツール状態変更時の処理
     */
    onToolStateChanged(isActive) {
        this.toolActive = isActive;
        
        if (!isActive && this.isPopupVisible) {
            // 他のツールが選択されたらポップアップを閉じる
            this.hidePopup();
        }
        
        console.log(`🔄 PenToolUI ツール状態: ${isActive ? 'アクティブ' : '非アクティブ'}`);
    }
    
    /**
     * 現在のツール状態取得
     */
    isToolActive() {
        return this.toolActive;
    }
    
    /**
     * 完全な状態情報取得
     */
    getFullStatus() {
        return {
            initialized: this.isInitialized,
            toolActive: this.toolActive,
            popupVisible: this.isPopupVisible,
            selectedPreset: this.selectedPresetIndex,
            currentSettings: { ...this.currentSettings },
            presets: [...this.presets],
            errorCount: this.errorCount,
            hasPopupElement: !!this.popupElement
        };
    }
    
    /**
     * 設定リセット
     */
    resetSettings() {
        this.currentSettings = {
            size: 100.0,
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3
        };
        
        this.updateSlidersFromSettings();
        this.applySettingsToDrawingSystem();
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        console.log('🧹 PenToolUI クリーンアップ開始...');
        
        // ポップアップ要素削除
        if (this.popupElement && this.popupElement.parentNode) {
            this.popupElement.parentNode.removeChild(this.popupElement);
        }
        
        // イベントリスナー削除
        document.removeEventListener('click', this.documentClickHandler);
        
        // 状態リセット
        this.isInitialized = false;
        this.toolActive = false;
        this.isPopupVisible = false;
        this.popupElement = null;
        
        console.log('✅ PenToolUI クリーンアップ完了');
    }
}

// アニメーションCSS追加
if (!document.getElementById('pen-tool-animations')) {
    const animationStyle = document.createElement('style');
    animationStyle.id = 'pen-tool-animations';
    animationStyle.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(animationStyle);
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.PenToolUI = PenToolUI;
    
    // デバッグ関数
    window.debugPenToolUI = function() {
        if (window.penToolUI) {
            console.group('🎨 PenToolUI デバッグ情報');
            const status = window.penToolUI.getFullStatus();
            console.log('状態:', status);
            console.groupEnd();
        } else {
            console.warn('PenToolUI が利用できません');
        }
    };
    
    window.testPenPopup = function() {
        console.log('🧪 ペンポップアップテスト開始...');
        
        if (window.penToolUI) {
            const result = window.penToolUI.showPopup();
            console.log('ポップアップ表示結果:', result);
            return result;
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    console.log('✅ PenToolUI (完全対応版) 読み込み完了');
    console.log('🎨 機能一覧:');
    console.log('  ✅ 6個のプリセット（プレビュー付き）');
    console.log('  ✅ スライダー連動設定（サイズ・透明度・筆圧・線補正）');
    console.log('  ✅ プレビューサイズ制限（2px～20px）');
    console.log('  ✅ カスタムプリセット保存機能');
    console.log('  ✅ 全体プリセットリセット機能');
    console.log('  ✅ ローカルストレージ自動保存');
    console.log('  ✅ レスポンシブ位置調整');
    console.log('🐛 デバッグ関数:');
    console.log('  - window.debugPenToolUI() - 状態確認');
    console.log('  - window.testPenPopup() - ポップアップテスト');
}