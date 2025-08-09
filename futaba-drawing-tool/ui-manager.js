/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.7
 * UI管理システム - ui-manager.js
 * 
 * 責務: UIコンテナ管理・UIイベント処理・プリセット管理
 * 依存: app-core.js, drawing-tools.js, ui/components.js
 * 
 * 修正版: PenPresetManager重複削除・依存関係整理
 */

// ==== プリセット管理クラス ====
class PenPresetManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
        this.presets = this.createDefaultPresets();
        this.activePresetId = 'preset_16';
        this.currentLiveValues = null; // ライブ編集値
        
        this.setupPresetEventListeners();
        console.log('🎨 PenPresetManager初期化完了');
    }
    
    createDefaultPresets() {
        // UI_CONFIGが利用可能な場合は使用、そうでなければフォールバック
        const sizes = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SIZE_PRESETS) ? 
            UI_CONFIG.SIZE_PRESETS : [1, 2, 4, 8, 16, 32];
        const presets = new Map();
        
        sizes.forEach((size, index) => {
            const presetId = `preset_${size}`;
            presets.set(presetId, {
                id: presetId,
                size: size,
                opacity: 0.85,
                color: 0x800000,
                pressure: 0.5,
                smoothing: 0.3,
                name: `サイズ${size}`,
                isDefault: true
            });
        });
        
        return presets;
    }
    
    setupPresetEventListeners() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                const presetId = `preset_${size}`;
                this.selectPreset(presetId);
            });
        });
    }
    
    selectPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            console.warn(`プリセットが見つかりません: ${presetId}`);
            return null;
        }
        
        this.activePresetId = presetId;
        this.currentLiveValues = null; // ライブ値をリセット
        
        // ツールシステムに設定を適用
        if (this.toolsSystem) {
            this.toolsSystem.updateBrushSettings({
                size: preset.size,
                opacity: preset.opacity,
                color: preset.color,
                pressure: preset.pressure,
                smoothing: preset.smoothing
            });
        }
        
        console.log(`プリセット選択: ${preset.name} (${preset.size}px)`);
        return preset;
    }
    
    selectPreviousPreset() {
        const presetIds = Array.from(this.presets.keys());
        const currentIndex = presetIds.indexOf(this.activePresetId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : presetIds.length - 1;
        
        return this.selectPreset(presetIds[prevIndex]);
    }
    
    selectNextPreset() {
        const presetIds = Array.from(this.presets.keys());
        const currentIndex = presetIds.indexOf(this.activePresetId);
        const nextIndex = currentIndex < presetIds.length - 1 ? currentIndex + 1 : 0;
        
        return this.selectPreset(presetIds[nextIndex]);
    }
    
    getActivePreset() {
        return this.presets.get(this.activePresetId);
    }
    
    getActivePresetId() {
        return this.activePresetId;
    }
    
    getPresetIdBySize(size) {
        for (const [id, preset] of this.presets) {
            if (Math.abs(preset.size - size) < 0.1) {
                return id;
            }
        }
        return null;
    }
    
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.currentLiveValues) {
            this.currentLiveValues = {
                size: size,
                opacity: opacity / 100,
                color: color || this.getActivePreset()?.color || 0x800000
            };
        } else {
            this.currentLiveValues.size = size;
            this.currentLiveValues.opacity = opacity / 100;
            if (color !== null) {
                this.currentLiveValues.color = color;
            }
        }
    }
    
    generatePreviewData() {
        const previewData = [];
        const activePreset = this.getActivePreset();
        const liveValues = this.currentLiveValues;
        
        // UI_CONFIGのフォールバック値を使用
        const previewMin = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SIZE_PREVIEW_MIN) ? 
            UI_CONFIG.SIZE_PREVIEW_MIN : 0.5;
        const previewMax = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SIZE_PREVIEW_MAX) ? 
            UI_CONFIG.SIZE_PREVIEW_MAX : 20;
        
        for (const preset of this.presets.values()) {
            const isActive = preset.id === this.activePresetId;
            
            // 表示サイズ計算（UIプレビュー用）
            let displaySize;
            if (isActive && liveValues) {
                displaySize = Math.max(
                    previewMin,
                    Math.min(previewMax, (liveValues.size / 100) * 19.5 + 0.5)
                );
            } else {
                displaySize = Math.max(
                    previewMin,
                    Math.min(previewMax, (preset.size / 100) * 19.5 + 0.5)
                );
            }
            
            previewData.push({
                dataSize: preset.size,
                size: displaySize,
                label: isActive && liveValues ? liveValues.size.toFixed(1) : preset.size.toString(),
                opacity: isActive && liveValues ? liveValues.opacity : preset.opacity,
                opacityLabel: isActive && liveValues ? 
                    Math.round(liveValues.opacity * 100) + '%' : 
                    Math.round(preset.opacity * 100) + '%',
                color: isActive && liveValues ? 
                    `#${liveValues.color.toString(16).padStart(6, '0')}` :
                    `#${preset.color.toString(16).padStart(6, '0')}`,
                isActive: isActive
            });
        }
        
        return previewData;
    }
}

// ==== メインUI管理クラス ====
class UIManager {
    constructor(app, toolsSystem) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        
        // 外部コンポーネント（ui/components.jsから）- 存在チェック付き
        this.popupManager = (typeof PopupManager !== 'undefined') ? new PopupManager() : null;
        this.statusBar = (typeof StatusBarManager !== 'undefined') ? new StatusBarManager() : null;
        this.presetDisplayManager = (typeof PresetDisplayManager !== 'undefined') ? 
            new PresetDisplayManager(toolsSystem) : null;
        
        // 内部管理システム
        this.penPresetManager = new PenPresetManager(toolsSystem);
        
        // スライダー管理
        this.sliders = new Map();
        
        // 状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
        
        // 外部参照（後で設定）
        this.historyManager = null;
        this.settingsManager = null;
    }
    
    async init() {
        try {
            console.log('🎯 UIManager初期化開始...');
            
            // 依存コンポーネントのチェック
            this.checkDependencies();
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 依存関係チェック ====
    
    checkDependencies() {
        const missing = [];
        
        if (typeof PopupManager === 'undefined') missing.push('PopupManager');
        if (typeof StatusBarManager === 'undefined') missing.push('StatusBarManager');
        if (typeof PresetDisplayManager === 'undefined') missing.push('PresetDisplayManager');
        if (typeof SliderController === 'undefined') missing.push('SliderController');
        
        if (missing.length > 0) {
            console.warn('⚠️ UIManager: 一部依存コンポーネントが見つかりません:', missing);
            console.warn('ui/components.js が正しく読み込まれているか確認してください');
        } else {
            console.log('✅ UIManager: 全依存コンポーネントが利用可能');
        }
    }
    
    // ==== 外部システム依存設定 ====
    
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
    }
    
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
    }
    
    // ==== ツールボタン設定 ====
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // 履歴記録（ツール変更前の状態を保存）
        let beforeTool = null;
        if (this.historyManager && this.toolsSystem) {
            beforeTool = this.toolsSystem.getCurrentTool();
        }
        
        // ツール切り替え
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button, beforeTool);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button, beforeTool);
        }
        
        // ポップアップ表示/非表示
        if (popupId && this.popupManager) {
            this.popupManager.togglePopup(popupId);
        }
    }
    
    setActiveTool(toolName, button, beforeTool = null) {
        // ツールシステムに切り替えを依頼
        if (this.toolsSystem.setTool(toolName)) {
            // 履歴記録
            if (this.historyManager && beforeTool && beforeTool !== toolName) {
                this.historyManager.recordToolChange(beforeTool, toolName);
            }
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => 
                btn.classList.remove('active'));
            if (button) {
                button.classList.add('active');
            }
            
            if (this.statusBar) {
                this.statusBar.updateCurrentTool(toolName);
            }
        }
    }
    
    // ==== ポップアップ設定 ====
    
    setupPopups() {
        if (!this.popupManager) {
            console.warn('PopupManager が利用できません');
            return;
        }
        
        // ポップアップの登録
        this.popupManager.registerPopup('pen-settings');
        this.popupManager.registerPopup('resize-settings');
        
        console.log('✅ ポップアップ設定完了');
    }
    
    // ==== スライダー設定 ====
    
    setupSliders() {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController が利用できません');
            return;
        }
        
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ size: value });
                this.penPresetManager.updateActivePresetLive(value, value * 85 / 16); // 概算不透明度
                this.updatePresetsDisplay();
            }
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                const currentSize = this.toolsSystem.getBrushSettings().size;
                this.penPresetManager.updateActivePresetLive(currentSize, value);
                this.updatePresetsDisplay();
            }
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
        console.log('✅ スライダー設定完了');
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController is not available');
            return null;
        }
        
        const slider = new SliderController(sliderId, min, max, initial, callback);
        this.sliders.set(sliderId, slider);
        return slider;
    }
    
    setupSliderButtons() {
        // スライダー調整ボタンのセットアップ
        const buttonConfigs = [
            // ペンサイズ
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            
            // 不透明度
            { id: 'pen-opacity-decrease-small', slider: 'pen-opacity-slider', delta: -0.1 },
            { id: 'pen-opacity-decrease', slider: 'pen-opacity-slider', delta: -1 },
            { id: 'pen-opacity-decrease-large', slider: 'pen-opacity-slider', delta: -10 },
            { id: 'pen-opacity-increase-small', slider: 'pen-opacity-slider', delta: 0.1 },
            { id: 'pen-opacity-increase', slider: 'pen-opacity-slider', delta: 1 },
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 },
            
            // 筆圧
            { id: 'pen-pressure-decrease-small', slider: 'pen-pressure-slider', delta: -0.1 },
            { id: 'pen-pressure-decrease', slider: 'pen-pressure-slider', delta: -1 },
            { id: 'pen-pressure-decrease-large', slider: 'pen-pressure-slider', delta: -10 },
            { id: 'pen-pressure-increase-small', slider: 'pen-pressure-slider', delta: 0.1 },
            { id: 'pen-pressure-increase', slider: 'pen-pressure-slider', delta: 1 },
            { id: 'pen-pressure-increase-large', slider: 'pen-pressure-slider', delta: 10 },
            
            // 線補正
            { id: 'pen-smoothing-decrease-small', slider: 'pen-smoothing-slider', delta: -0.1 },
            { id: 'pen-smoothing-decrease', slider: 'pen-smoothing-slider', delta: -1 },
            { id: 'pen-smoothing-decrease-large', slider: 'pen-smoothing-slider', delta: -10 },
            { id: 'pen-smoothing-increase-small', slider: 'pen-smoothing-slider', delta: 0.1 },
            { id: 'pen-smoothing-increase', slider: 'pen-smoothing-slider', delta: 1 },
            { id: 'pen-smoothing-increase-large', slider: 'pen-smoothing-slider', delta: 10 }
        ];
        
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    const slider = this.sliders.get(config.slider);
                    if (slider) {
                        slider.adjustValue(config.delta);
                    }
                });
            }
        });
    }
    
    // ==== リサイズ設定 ====
    
    setupResize() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', () => {
                const [width, height] = button.getAttribute('data-size').split(',').map(Number);
                this.setCanvasSize(width, height);
            });
        });
        
        // 適用ボタン
        const applyButton = document.getElementById('apply-resize');
        const applyCenterButton = document.getElementById('apply-resize-center');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize(false));
        }
        
        if (applyCenterButton) {
            applyCenterButton.addEventListener('click', () => this.applyResize(true));
        }
        
        console.log('✅ リサイズ機能設定完了');
    }
    
    setCanvasSize(width, height) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput) widthInput.value = width;
        if (heightInput) heightInput.value = height;
    }
    
    applyResize(centerContent) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) {
                console.warn('リサイズ入力要素が見つかりません');
                return;
            }
            
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
                console.warn('無効なサイズが指定されました');
                return;
            }
            
            // 履歴記録（リサイズ前の状態）
            if (this.historyManager) {
                const beforeSize = { 
                    width: this.app.width || this.app.app?.screen?.width, 
                    height: this.app.height || this.app.app?.screen?.height 
                };
                const afterSize = { width, height };
                this.historyManager.recordCanvasResize(beforeSize, afterSize);
            }
            
            this.app.resize(width, height, centerContent);
            
            if (this.statusBar) {
                this.statusBar.updateCanvasInfo(width, height);
            }
            
            if (this.popupManager) {
                this.popupManager.hideAllPopups();
            }
            
            console.log(`Canvas resized to ${width}x${height}px (center: ${centerContent})`);
            
        } catch (error) {
            console.error('リサイズエラー:', error);
        }
    }
    
    // ==== チェックボックス設定 ====
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
                
                // チェックボックスの状態変更を通知
                const checkboxId = checkbox.id;
                const isChecked = checkbox.classList.contains('checked');
                
                console.log(`チェックボックス変更: ${checkboxId} = ${isChecked}`);
                
                this.handleCheckboxChange(checkboxId, isChecked);
            });
        });
        
        console.log('✅ チェックボックス設定完了');
    }
    
    handleCheckboxChange(checkboxId, isChecked) {
        // 将来の機能実装用のプレースホルダー
        switch (checkboxId) {
            case 'pressure-sensitivity':
                console.log('筆圧感度:', isChecked);
                break;
            case 'edge-smoothing':
                console.log('エッジスムージング:', isChecked);
                break;
            case 'gpu-acceleration':
                console.log('GPU加速:', isChecked);
                break;
        }
    }
    
    // ==== アプリイベントリスナー設定 ====
    
    setupAppEventListeners() {
        // EVENTSが定義されていない場合の安全な実装
        const EVENTS = (typeof window !== 'undefined' && window.EVENTS) ? window.EVENTS : {
            CANVAS_READY: 'canvas_ready',
            TOOL_CHANGED: 'tool_changed',
            POINTER_MOVE: 'pointermove',
            POINTER_UP: 'pointerup'
        };
        
        // アプリケーション側のイベントを監視
        if (this.app.on) {
            this.app.on(EVENTS.CANVAS_READY, (data) => {
                console.log('Canvas ready event received');
                this.updateAllDisplays();
            });
            
            this.app.on(EVENTS.TOOL_CHANGED, (data) => {
                console.log('Tool changed event received:', data.state?.currentTool);
                if (this.statusBar) {
                    this.statusBar.updateCurrentTool(data.state?.currentTool);
                    this.statusBar.updateCurrentColor(data.state?.brushColor);
                }
            });
        }
        
        // 描画レイヤーのマウス移動イベント
        if (this.app.layers && this.app.layers.drawingLayer && this.app.layers.drawingLayer.on) {
            this.app.layers.drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
                const point = this.app.getLocalPointerPosition ? 
                    this.app.getLocalPointerPosition(event) : { x: 0, y: 0 };
                this.updateCoordinatesThrottled(point.x, point.y);
                
                // 筆圧モニター更新（描画中のみ）
                if (this.app.state?.isDrawing && this.statusBar) {
                    const pressure = Math.min(100, (this.app.state.pressure || 0) * 100 + Math.random() * 20);
                    this.statusBar.updatePressureMonitor(pressure);
                }
            });
            
            this.app.layers.drawingLayer.on(EVENTS.POINTER_UP, () => {
                if (this.statusBar) {
                    this.statusBar.updatePressureMonitor(0);
                }
            });
        }
        
        console.log('✅ アプリイベントリスナー設定完了');
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        const throttleTime = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SLIDER_UPDATE_THROTTLE) ?
            UI_CONFIG.SLIDER_UPDATE_THROTTLE : 16;
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            if (this.statusBar) {
                this.statusBar.updateCoordinates(x, y);
            }
        }, throttleTime);
    }
    
    updateAllDisplays() {
        // 初期状態の表示更新
        if (this.app.getStats) {
            const stats = this.app.getStats();
            if (this.statusBar) {
                this.statusBar.updateCanvasInfo(stats.width, stats.height);
            }
        }
        
        if (this.toolsSystem.getBrushSettings) {
            const brushSettings = this.toolsSystem.getBrushSettings();
            if (this.statusBar) {
                this.statusBar.updateCurrentColor(brushSettings.color);
            }
        }
        
        if (this.toolsSystem.getCurrentTool) {
            const currentTool = this.toolsSystem.getCurrentTool();
            if (this.statusBar) {
                this.statusBar.updateCurrentTool(currentTool);
            }
        }
        
        // プリセット表示更新
        this.updatePresetsDisplay();
        
        console.log('✅ 全ディスプレイ更新完了');
    }
    
    updatePresetsDisplay() {
        if (this.presetDisplayManager) {
            this.presetDisplayManager.updatePresetsDisplay();
        }
    }
    
    // ==== 公開API ====
    
    showPopup(popupId) {
        return this.popupManager ? this.popupManager.showPopup(popupId) : false;
    }
    
    hidePopup(popupId) {
        return this.popupManager ? this.popupManager.hidePopup(popupId) : false;
    }
    
    hideAllPopups() {
        if (this.popupManager) {
            this.popupManager.hideAllPopups();
        }
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value);
        }
    }
    
    updateStatusBar(updates) {
        if (!this.statusBar) return;
        
        if (updates.canvasInfo) {
            this.statusBar.updateCanvasInfo(updates.canvasInfo.width, updates.canvasInfo.height);
        }
        
        if (updates.tool) {
            this.statusBar.updateCurrentTool(updates.tool);
        }
        
        if (updates.color) {
            this.statusBar.updateCurrentColor(updates.color);
        }
        
        if (updates.coordinates) {
            this.statusBar.updateCoordinates(updates.coordinates.x, updates.coordinates.y);
        }
        
        if (updates.pressure !== undefined) {
            this.statusBar.updatePressureMonitor(updates.pressure);
        }
        
        if (updates.performance) {
            this.statusBar.updatePerformanceStats(updates.performance);
        }
    }
    
    // ==== プリセット管理API ====
    
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    // ==== 設定変更ハンドラー ====
    
    handleSettingChange(key, newValue) {
        // 設定管理システムからの通知を処理
        const SETTING_TYPES = (typeof window !== 'undefined' && window.SETTING_TYPES) ? 
            window.SETTING_TYPES : null;
        
        if (!SETTING_TYPES) return;
        
        switch (key) {
            case SETTING_TYPES.SHOW_COORDINATES:
                const coordElement = document.getElementById('coordinates');
                if (coordElement) {
                    coordElement.style.display = newValue ? 'block' : 'none';
                }
                break;
                
            case SETTING_TYPES.SHOW_PRESSURE:
                const pressureElement = document.getElementById('pressure-monitor');
                if (pressureElement) {
                    pressureElement.style.display = newValue ? 'block' : 'none';
                }
                break;
        }
    }
    
    handleSettingsLoaded(settings) {
        // 設定読み込み完了時の処理
        console.log('⚙️ UIManager: 設定読み込み完了');
        
        const SETTING_TYPES = (typeof window !== 'undefined' && window.SETTING_TYPES) ? 
            window.SETTING_TYPES : null;
        
        // 設定に基づいてUI要素の表示/非表示を設定
        if (SETTING_TYPES && settings) {
            this.handleSettingChange(SETTING_TYPES.SHOW_COORDINATES, settings[SETTING_TYPES.SHOW_COORDINATES]);
            this.handleSettingChange(SETTING_TYPES.SHOW_PRESSURE, settings[SETTING_TYPES.SHOW_PRESSURE]);
        }
    }
    
    // ==== エラー・通知表示 ====
    
    showError(message, duration = 5000) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.parentNode.removeChild(errorDiv);
                    }
                }, 300);
            }
        }, duration);
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#f44336'
        };
        
        const notificationDiv = document.createElement('div');
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        notificationDiv.textContent = message;
        document.body.appendChild(notificationDiv);
        
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notificationDiv.parentNode) {
                        notificationDiv.parentNode.removeChild(notificationDiv);
                    }
                }, 300);
            }
        }, duration);
    }
    
    // ==== デバッグ情報 ====
    
    getUIStats() {
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.activePopup : null,
            sliderCount: this.sliders.size,
            popupCount: this.popupManager ? this.popupManager.popups.size : 0,
            presetManager: {
                activePresetId: this.penPresetManager.getActivePresetId(),
                hasLiveValues: !!this.penPresetManager.currentLiveValues,
                presetCount: this.penPresetManager.presets.size
            }
        };
    }
    
    // ==== デバッグ関数 ====
    
    debugUI() {
        console.group('🎭 UI管理デバッグ情報');
        console.log('📊 UI統計:', this.getUIStats());
        console.log('🎨 プリセット情報:', {
            activePreset: this.penPresetManager.getActivePreset(),
            liveValues: this.penPresetManager.currentLiveValues,
            presetCount: this.penPresetManager.presets.size
        });
        console.log('📱 スライダー情報:', Array.from(this.sliders.keys()));
        console.log('📋 ポップアップ情報:', {
            registered: this.popupManager ? Array.from(this.popupManager.popups.keys()) : [],
            active: this.popupManager ? this.popupManager.activePopup : null
        });
        console.groupEnd();
    }
    
    // ==== クリーンアップ ====
    
    destroy() {
        // タイマークリア
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        // スライダーのクリーンアップ
        this.sliders.forEach(slider => {
            if (slider.destroy) {
                slider.destroy();
            }
        });
        
        // 参照クリア
        this.historyManager = null;
        this.settingsManager = null;
        
        console.log('🎭 UIManager destroyed');
    }
}

// ==== CSS アニメーション追加 ====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
if (!document.head.querySelector('style[data-ui-animations]')) {
    style.setAttribute('data-ui-animations', 'true');
    document.head.appendChild(style);
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    window.PenPresetManager = PenPresetManager;
    
    console.log('🎭 ui-manager.js v1.6 読み込み完了（修正版）');
    console.log('📦 利用可能クラス: UIManager, PenPresetManager');
    console.log('🔗 依存: ui/components.js (SliderController, PopupManager, StatusBarManager)');
    console.log('✅ 重複問題解決・依存チェック追加');
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     UIManager,
//     PenPresetManager
// };