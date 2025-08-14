/**
 * 🎯 AI_WORK_SCOPE: UI統括管理・ポップアップ・スライダー・プリセット制御
 * 🎯 DEPENDENCIES: app-core.js
 * 🎯 CDN_USAGE: @pixi/ui（オプション）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: @pixi/ui v8対応準備
 * 📋 PERFORMANCE_TARGET: 高速UI応答・60FPS維持
 */

export class UIManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.activePopup = null;
        this.sliders = new Map();
        this.draggableElements = new Set();
        this.isInitialized = false;
    }

    async init() {
        console.log('🎛️ UIManager初期化中...');
        
        try {
            // 基本UI要素初期化
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupPresets();
            this.setupCheckboxes();
            this.setupResizeControls();
            
            // @pixi/ui統合（利用可能な場合）
            await this.setupPixiUI();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }

    setupToolButtons() {
        console.log('🔧 ツールボタンセットアップ中...');
        
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolButtonClick(e.currentTarget);
            });
        });
    }

    handleToolButtonClick(button) {
        const toolId = button.id;
        const popupId = button.getAttribute('data-popup');
        
        // ツール選択処理
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button);
        } else if (toolId === 'resize-tool') {
            // リサイズツールは選択状態にしない
        }
        
        // ポップアップ表示
        if (popupId) {
            this.togglePopup(popupId);
        }
    }

    setActiveTool(tool, buttonElement) {
        // 既存のアクティブ状態をクリア
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 新しいアクティブ状態を設定
        buttonElement.classList.add('active');
        
        // ツール名表示更新
        const toolNames = {
            'pen': 'ベクターペン',
            'eraser': '消しゴム'
        };
        
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolNames[tool] || tool;
        }
        
        // ToolManagerに通知
        const toolManager = this.appCore.getManager('tool');
        if (toolManager) {
            toolManager.setTool(tool);
        }
    }

    setupPopups() {
        console.log('💭 ポップアップセットアップ中...');
        
        // ドラッグ可能なポップアップの設定
        document.querySelectorAll('.popup-panel.draggable').forEach(popup => {
            this.makeDraggable(popup);
            this.draggableElements.add(popup);
        });
        
        // クリック外でポップアップを閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && !e.target.closest('.tool-button')) {
                this.closeAllPopups();
            }
        });
    }

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
    }

    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }

    isActivePopup() {
        return this.activePopup !== null;
    }

    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const handleMouseDown = (e) => {
            if (e.target === popup || e.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            }
        };
        
        const handleMouseMove = (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - popup.offsetWidth));
                const y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - popup.offsetHeight));
                
                popup.style.left = x + 'px';
                popup.style.top = y + 'px';
            }
        };
        
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        };
        
        popup.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    setupSliders() {
        console.log('🎚️ スライダーセットアップ中...');
        
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.notifyToolManager('setBrushSize', value);
            this.updateSizePresets();
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.notifyToolManager('setOpacity', value / 100);
            this.updateSizePresets();
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            this.notifyToolManager('setPressure', value / 100);
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            this.notifyToolManager('setSmoothing', value / 100);
            return value.toFixed(1) + '%';
        });
        
        // スライダーボタンセットアップ
        this.setupSliderButtons();
    }

    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
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
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        // マウスイベント
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

    setupSliderButtons() {
        const adjustValue = (sliderId, delta) => {
            const slider = this.sliders.get(sliderId);
            if (slider) {
                const newValue = slider.value + delta;
                const clampedValue = Math.max(slider.min, Math.min(slider.max, newValue));
                slider.value = clampedValue;
                
                const percentage = ((clampedValue - slider.min) / (slider.max - slider.min)) * 100;
                slider.track.style.width = percentage + '%';
                slider.handle.style.left = percentage + '%';
                slider.valueDisplay.textContent = slider.callback(clampedValue);
            }
        };
        
        // ボタンイベント設定
        const buttons = [
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            // 他のスライダーボタンも同様に設定...
        ];
        
        buttons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                element.addEventListener('click', () => {
                    adjustValue(btn.slider, btn.delta);
                    if (btn.slider === 'pen-size-slider') {
                        this.updateSizePresets();
                    }
                });
            }
        });
    }

    setupPresets() {
        console.log('🎯 プリセットセットアップ中...');
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.updateSliderValue('pen-size-slider', size);
                this.notifyToolManager('setBrushSize', size);
                this.updateSizePresets();
            });
        });
    }

    updateSizePresets() {
        const sizeSlider = this.sliders.get('pen-size-slider');
        const opacitySlider = this.sliders.get('pen-opacity-slider');
        
        if (!sizeSlider || !opacitySlider) return;
        
        const currentSize = sizeSlider.value;
        const currentOpacity = Math.round(opacitySlider.value);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            // アクティブ状態の更新
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円のサイズ更新（0.5-20pxの範囲で線形変換）
            let circleSize;
            if (isActive) {
                circleSize = Math.max(0.5, Math.min(20, (currentSize / 100) * 19.5 + 0.5));
                label.textContent = currentSize.toFixed(1);
            } else {
                circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
                label.textContent = presetSize.toString();
            }
            
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            circle.style.opacity = opacitySlider.value / 100;
            
            percent.textContent = currentOpacity + '%';
        });
    }

    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.value = value;
            const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
            slider.track.style.width = percentage + '%';
            slider.handle.style.left = percentage + '%';
            slider.valueDisplay.textContent = slider.callback(value);
        }
    }

    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
            });
        });
    }

    setupResizeControls() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [width, height] = btn.getAttribute('data-size').split(',').map(Number);
                document.getElementById('canvas-width').value = width;
                document.getElementById('canvas-height').value = height;
            });
        });
        
        // 適用ボタン
        document.getElementById('apply-resize')?.addEventListener('click', () => {
            this.applyResize(false);
        });
        
        document.getElementById('apply-resize-center')?.addEventListener('click', () => {
            this.applyResize(true);
        });
    }

    applyResize(centerContent) {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        
        if (width && height) {
            this.appCore.resizeCanvas(width, height, centerContent);
            this.closeAllPopups();
        }
    }

    async setupPixiUI() {
        if (window.PIXI_UI) {
            console.log('🎨 @pixi/ui統合中...');
            // 将来の@pixi/ui統合実装予定地
            console.log('ℹ️ @pixi/ui統合は将来のPhaseで実装予定');
        }
    }

    notifyToolManager(method, ...args) {
        const toolManager = this.appCore.getManager('tool');
        if (toolManager && typeof toolManager[method] === 'function') {
            toolManager[method](...args);
        }
    }

    // パブリックAPI
    getSliderValue(sliderId) {
        const slider = this.sliders.get(sliderId);
        return slider ? slider.value : null;
    }

    setSliderValue(sliderId, value) {
        this.updateSliderValue(sliderId, value);
    }
}