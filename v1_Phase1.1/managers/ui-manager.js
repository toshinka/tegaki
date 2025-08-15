/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: UI系統括・@pixi/ui活用・ポップアップ・スライダー管理
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/utils/icon-manager.js
 * 🎯 NODE_MODULES: @pixi/ui@^1.2.4, @tabler/icons-react
 * 🎯 PIXI_EXTENSIONS: UI統合・ポップアップシステム
 * 🎯 ISOLATION_TEST: 可能（拡張ライブラリ依存）
 * 🎯 SPLIT_THRESHOLD: 500行（UI統合系・分割慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: 変更なし（UI専用）
 */

/**
 * UI統合管理システム
 * 元HTMLのUIControllerを基にした@pixi/ui統合改良版
 */
class UIManager {
    constructor() {
        this.activePopup = null;
        this.sliders = new Map();
        this.toolButtons = new Map();
        this.pixiUIAvailable = false;
        this.iconManager = null;
        
        // ツール設定
        this.toolSettings = {
            pen: {
                size: 16.0,
                opacity: 85.0,
                pressure: 50.0,
                smoothing: 30.0
            },
            eraser: {
                size: 20.0,
                opacity: 100.0
            }
        };
        
        console.log('🎨 UIManager 構築開始...');
    }
    
    /**
     * UI管理システム初期化
     */
    init() {
        console.group('🎨 UI統合システム初期化');
        
        try {
            // Step1: 拡張ライブラリ確認
            this.checkExtensions();
            
            // Step2: ツールボタン初期化
            this.setupToolButtons();
            
            // Step3: ポップアップシステム初期化
            this.setupPopups();
            
            // Step4: スライダーシステム初期化
            this.setupSliders();
            
            // Step5: プリセットシステム初期化
            this.setupPresets();
            
            // Step6: リサイズシステム初期化
            this.setupResize();
            
            // Step7: チェックボックス初期化
            this.setupCheckboxes();
            
            console.log('✅ UI統合システム初期化完了');
            
        } catch (error) {
            console.error('❌ UI統合システム初期化エラー:', error);
            throw error;
        } finally {
            console.groupEnd();
        }
        
        return this;
    }
    
    /**
     * 拡張ライブラリ確認
     */
    checkExtensions() {
        // @pixi/ui 確認
        this.pixiUIAvailable = window.PixiExtensions && 
                               window.PixiExtensions.hasFeature('ui');
        
        if (this.pixiUIAvailable) {
            console.log('✅ @pixi/ui 利用可能 - 高度なUI機能使用');
        } else {
            console.log('📦 @pixi/ui 未利用 - 基本UI機能使用');
        }
        
        // IconManager 確認
        this.iconManager = window.IconManager;
        if (this.iconManager) {
            console.log('✅ IconManager 利用可能 - アイコン管理統合');
        }
    }
    
    /**
     * ツールボタン初期化
     */
    setupToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach(button => {
            const toolId = button.id;
            this.toolButtons.set(toolId, {
                element: button,
                active: button.classList.contains('active'),
                disabled: button.classList.contains('disabled')
            });
            
            // イベントリスナー追加
            if (!button.classList.contains('disabled')) {
                button.addEventListener('click', (e) => {
                    this.handleToolClick(e.currentTarget);
                });
            }
        });
        
        console.log(`🔧 ツールボタン初期化完了: ${toolButtons.length}個`);
    }
    
    /**
     * ツールクリック処理
     */
    handleToolClick(button) {
        const toolId = button.id;
        const popupId = button.getAttribute('data-popup');
        
        // ツール切り替え処理
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen');
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser');
        }
        
        // ポップアップ表示処理
        if (popupId) {
            this.togglePopup(popupId);
        }
        
        console.log(`🔧 ツール操作: ${toolId}`);
    }
    
    /**
     * アクティブツール設定
     */
    setActiveTool(tool) {
        // 全ツールボタンの非アクティブ化
        this.toolButtons.forEach((toolData, toolId) => {
            toolData.element.classList.remove('active');
            toolData.active = false;
        });
        
        // 指定ツールのアクティブ化
        const toolButtonId = tool + '-tool';
        const toolData = this.toolButtons.get(toolButtonId);
        if (toolData) {
            toolData.element.classList.add('active');
            toolData.active = true;
        }
        
        // ツール名表示更新
        const toolNames = { 
            pen: 'ベクターペン', 
            eraser: '消しゴム',
            fill: '塗りつぶし',
            select: '範囲選択'
        };
        const toolNameElement = document.getElementById('current-tool');
        if (toolNameElement) {
            toolNameElement.textContent = toolNames[tool] || tool;
        }
        
        console.log(`🎯 アクティブツール: ${tool}`);
    }
    
    /**
     * ポップアップシステム初期化
     */
    setupPopups() {
        const popups = document.querySelectorAll('.popup-panel.draggable');
        
        popups.forEach(popup => {
            this.makeDraggable(popup);
        });
        
        // クリックアウトサイドで閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button')) {
                this.closeAllPopups();
            }
        });
        
        console.log(`📋 ポップアップシステム初期化完了: ${popups.length}個`);
    }
    
    /**
     * ポップアップ表示切り替え
     */
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        // 他のポップアップを閉じる
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        // ポップアップ表示切り替え
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
        
        console.log(`📋 ポップアップ ${popupId}: ${isVisible ? '非表示' : '表示'}`);
    }
    
    /**
     * ドラッグ可能化
     */
    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        popup.addEventListener('mousedown', (e) => {
            if (e.target === popup || e.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(
                    e.clientX - dragOffset.x, 
                    window.innerWidth - popup.offsetWidth
                ));
                const y = Math.max(0, Math.min(
                    e.clientY - dragOffset.y, 
                    window.innerHeight - popup.offsetHeight
                ));
                
                popup.style.left = x + 'px';
                popup.style.top = y + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }
    
    /**
     * スライダーシステム初期化
     */
    setupSliders() {
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.toolSettings.pen.size = value;
            this.updateSizePresets();
            this.broadcastToolSettingChange('size', value);
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.toolSettings.pen.opacity = value;
            this.updateSizePresets();
            this.broadcastToolSettingChange('opacity', value / 100);
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            this.toolSettings.pen.pressure = value;
            this.broadcastToolSettingChange('pressure', value / 100);
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            this.toolSettings.pen.smoothing = value;
            this.broadcastToolSettingChange('smoothing', value / 100);
            return value.toFixed(1) + '%';
        });
        
        // スライダーボタン初期化
        this.setupSliderButtons();
        
        console.log(`🎚️ スライダーシステム初期化完了: ${this.sliders.size}個`);
    }
    
    /**
     * スライダー作成
     */
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        const sliderData = {
            value: initial,
            min, max, callback,
            track, handle, valueDisplay,
            isDragging: false
        };
        
        this.sliders.set(sliderId, sliderData);
        
        const updateSlider = (value) => {
            sliderData.value = Math.max(min, Math.min(max, value));
            const percentage = ((sliderData.value - min) / (max - min)) * 100;
            
            if (track) track.style.width = percentage + '%';
            if (handle) handle.style.left = percentage + '%';
            if (valueDisplay) valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = (clientX - rect.left) / rect.width;
            return min + (percentage * (max - min));
        };
        
        // イベントリスナー
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (sliderData.isDragging) {
                updateSlider(getValueFromPosition(e.clientX));
            }
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
        });
        
        // 初期値設定
        updateSlider(initial);
    }
    
    /**
     * スライダーボタン初期化
     */
    setupSliderButtons() {
        const adjustValue = (sliderId, delta) => {
            const slider = this.sliders.get(sliderId);
            if (slider) {
                const newValue = slider.value + delta;
                const clampedValue = Math.max(slider.min, Math.min(slider.max, newValue));
                slider.value = clampedValue;
                
                const percentage = ((clampedValue - slider.min) / (slider.max - slider.min)) * 100;
                if (slider.track) slider.track.style.width = percentage + '%';
                if (slider.handle) slider.handle.style.left = percentage + '%';
                if (slider.valueDisplay) {
                    slider.valueDisplay.textContent = slider.callback(clampedValue);
                }
            }
        };
        
        // 各スライダーの調整ボタンを設定
        const sliderButtons = [
            // ペンサイズ
            ['pen-size-decrease-small', 'pen-size-slider', -0.1],
            ['pen-size-decrease', 'pen-size-slider', -1],
            ['pen-size-decrease-large', 'pen-size-slider', -10],
            ['pen-size-increase-small', 'pen-size-slider', 0.1],
            ['pen-size-increase', 'pen-size-slider', 1],
            ['pen-size-increase-large', 'pen-size-slider', 10],
            
            // 不透明度
            ['pen-opacity-decrease-small', 'pen-opacity-slider', -0.1],
            ['pen-opacity-decrease', 'pen-opacity-slider', -1],
            ['pen-opacity-decrease-large', 'pen-opacity-slider', -10],
            ['pen-opacity-increase-small', 'pen-opacity-slider', 0.1],
            ['pen-opacity-increase', 'pen-opacity-slider', 1],
            ['pen-opacity-increase-large', 'pen-opacity-slider', 10],
            
            // 筆圧
            ['pen-pressure-decrease-small', 'pen-pressure-slider', -0.1],
            ['pen-pressure-decrease', 'pen-pressure-slider', -1],
            ['pen-pressure-decrease-large', 'pen-pressure-slider', -10],
            ['pen-pressure-increase-small', 'pen-pressure-slider', 0.1],
            ['pen-pressure-increase', 'pen-pressure-slider', 1],
            ['pen-pressure-increase-large', 'pen-pressure-slider', 10],
            
            // 線補正
            ['pen-smoothing-decrease-small', 'pen-smoothing-slider', -0.1],
            ['pen-smoothing-decrease', 'pen-smoothing-slider', -1],
            ['pen-smoothing-decrease-large', 'pen-smoothing-slider', -10],
            ['pen-smoothing-increase-small', 'pen-smoothing-slider', 0.1],
            ['pen-smoothing-increase', 'pen-smoothing-slider', 1],
            ['pen-smoothing-increase-large', 'pen-smoothing-slider', 10]
        ];
        
        sliderButtons.forEach(([buttonId, sliderId, delta]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue(sliderId, delta);
                    if (sliderId === 'pen-size-slider' || sliderId === 'pen-opacity-slider') {
                        this.updateSizePresets();
                    }
                });
            }
        });
    }
    
    /**
     * プリセットシステム初期化
     */
    setupPresets() {
        const presets = document.querySelectorAll('.size-preset-item');
        
        presets.forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.updateSliderValue('pen-size-slider', size);
                this.updateSizePresets();
                this.broadcastToolSettingChange('size', size);
            });
        });
        
        // 初期プリセット更新
        this.updateSizePresets();
        
        console.log(`🎯 プリセットシステム初期化完了: ${presets.length}個`);
    }
    
    /**
     * サイズプリセット更新
     */
    updateSizePresets() {
        const currentSize = this.toolSettings.pen.size;
        const currentOpacity = this.toolSettings.pen.opacity;
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            // アクティブ状態更新
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            if (circle) {
                // 円サイズ更新（0.5-20pxの範囲）
                let circleSize;
                if (isActive) {
                    circleSize = Math.max(0.5, Math.min(20, (currentSize / 100) * 19.5 + 0.5));
                } else {
                    circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
                }
                
                circle.style.width = circleSize + 'px';
                circle.style.height = circleSize + 'px';
                circle.style.opacity = currentOpacity / 100;
            }
            
            if (label) {
                label.textContent = isActive ? currentSize.toFixed(1) : presetSize.toString();
            }
            
            if (percent) {
                percent.textContent = Math.round(currentOpacity) + '%';
            }
        });
    }
    
    /**
     * リサイズシステム初期化
     */
    setupResize() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [width, height] = btn.getAttribute('data-size').split(',').map(Number);
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                if (widthInput) widthInput.value = width;
                if (heightInput) heightInput.value = height;
            });
        });
        
        // 適用ボタン
        const applyButton = document.getElementById('apply-resize');
        const applyCenterButton = document.getElementById('apply-resize-center');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => {
                this.applyResize(false);
            });
        }
        
        if (applyCenterButton) {
            applyCenterButton.addEventListener('click', () => {
                this.applyResize(true);
            });
        }
        
        console.log('📏 リサイズシステム初期化完了');
    }
    
    /**
     * チェックボックス初期化
     */
    setupCheckboxes() {
        const checkboxes = document.querySelectorAll('.checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
                
                const checkboxId = checkbox.id;
                const isChecked = checkbox.classList.contains('checked');
                
                this.handleCheckboxChange(checkboxId, isChecked);
            });
        });
        
        console.log(`☑️ チェックボックス初期化完了: ${checkboxes.length}個`);
    }
    
    /**
     * チェックボックス変更処理
     */
    handleCheckboxChange(checkboxId, isChecked) {
        console.log(`☑️ チェックボックス変更: ${checkboxId} = ${isChecked}`);
        
        switch (checkboxId) {
            case 'pressure-sensitivity':
                this.broadcastToolSettingChange('pressureSensitivity', isChecked);
                break;
            case 'edge-smoothing':
                this.broadcastToolSettingChange('edgeSmoothing', isChecked);
                break;
            case 'gpu-acceleration':
                this.broadcastToolSettingChange('gpuAcceleration', isChecked);
                break;
        }
    }
    
    /**
     * スライダー値更新
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.value = value;
            const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
            if (slider.track) slider.track.style.width = percentage + '%';
            if (slider.handle) slider.handle.style.left = percentage + '%';
            if (slider.valueDisplay) {
                slider.valueDisplay.textContent = slider.callback(value);
            }
        }
    }
    
    /**
     * リサイズ適用
     */
    applyResize(centerContent) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            this.broadcastCanvasResize(width, height, centerContent);
            this.closeAllPopups();
        }
    }
    
    /**
     * 全ポップアップ閉じる
     */
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    /**
     * ツール設定変更ブロードキャスト
     */
    broadcastToolSettingChange(setting, value) {
        // AppCoreに設定変更を通知
        if (window.futabaDrawingTool && window.futabaDrawingTool.updateToolSettings) {
            const settings = {};
            
            switch (setting) {
                case 'size':
                    settings.brushSize = value;
                    break;
                case 'opacity':
                    settings.opacity = value;
                    break;
                case 'pressure':
                    settings.pressure = value;
                    break;
                case 'smoothing':
                    settings.smoothing = value;
                    break;
            }
            
            window.futabaDrawingTool.updateToolSettings(settings);
        }
        
        console.log(`🔧 ツール設定変更: ${setting} = ${value}`);
    }
    
    /**
     * キャンバスリサイズブロードキャスト
     */
    broadcastCanvasResize(width, height, centerContent) {
        // AppCoreにリサイズ指示
        if (window.futabaDrawingTool && window.futabaDrawingTool.resize) {
            window.futabaDrawingTool.resize(width, height, centerContent);
        }
        
        console.log(`📏 キャンバスリサイズ: ${width}×${height}px ${centerContent ? '(中央寄せ)' : ''}`);
    }
    
    /**
     * UI状態取得
     */
    getStatus() {
        return {
            pixiUIAvailable: this.pixiUIAvailable,
            activePopup: this.activePopup?.id || null,
            sliderCount: this.sliders.size,
            toolButtonCount: this.toolButtons.size,
            toolSettings: { ...this.toolSettings }
        };
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    console.log('✅ UIManager グローバル公開完了');
}

console.log('🎨 UIManager 準備完了 - UI統合システム');
console.log('💡 使用例: const uiManager = new UIManager(); uiManager.init();');