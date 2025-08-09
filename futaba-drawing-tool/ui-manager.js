/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev3
 * UI管理システム - ui-manager.js 
 * 
 * 🔧 v1rev3修正内容（Rulebook準拠責務分離版）:
 * 1. PerformanceMonitor追加（drawing-tools.jsから移行）
 * 2. パフォーマンス監視とUI統合
 * 3. 責務をUI統合管理に明確化
 * 
 * 責務: UIコンテナ管理・UIイベント処理・プリセット管理・パフォーマンス監視
 * 依存: app-core.js, drawing-tools.js, ui/components.js
 */

// ==== パフォーマンス監視システム（drawing-tools.jsから移行）====
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.stats = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0
        };
        this.updateCallbacks = new Set(); // UI更新コールバック
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        const update = (currentTime) => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const deltaTime = currentTime - this.lastTime;
            
            // 1秒ごとにFPS計算
            if (deltaTime >= 1000) {
                this.stats.fps = Math.round((this.frameCount * 1000) / deltaTime);
                this.stats.frameTime = Math.round(deltaTime / this.frameCount * 100) / 100;
                
                this.updateUI();
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        requestAnimationFrame(update);
        console.log('📊 パフォーマンス監視開始（UI統合版）');
    }
    
    stop() {
        this.isRunning = false;
        console.log('📊 パフォーマンス監視停止');
    }
    
    updateUI() {
        // FPS表示更新
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = this.stats.fps;
        }
        
        // メモリ使用量表示
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement && performance.memory) {
            const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
            memoryElement.textContent = usedMB + 'MB';
            this.stats.memoryUsage = usedMB;
        }
        
        // GPU使用率（ダミー値）
        const gpuElement = document.getElementById('gpu-usage');
        if (gpuElement) {
            const gpuUsage = Math.round(40 + Math.random() * 20);
            gpuElement.textContent = gpuUsage + '%';
        }
        
        // 登録されたコールバックを実行
        this.updateCallbacks.forEach(callback => {
            try {
                callback(this.stats);
            } catch (error) {
                console.warn('パフォーマンス監視コールバックエラー:', error);
            }
        });
    }
    
    addUpdateCallback(callback) {
        this.updateCallbacks.add(callback);
    }
    
    removeUpdateCallback(callback) {
        this.updateCallbacks.delete(callback);
    }
    
    getStats() {
        return { ...this.stats };
    }
}

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

// ==== メインUI管理クラス（v1.9修正版）====
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
        
        // 🆕 パフォーマンス監視システム（drawing-tools.jsから移行）
        this.performanceMonitor = new PerformanceMonitor();
        
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
            console.log('🎯 UIManager初期化開始（v1.9修正版・パフォーマンス監視統合）...');
            
            // 依存コンポーネントのチェック
            this.checkDependencies();
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // 🆕 パフォーマンス監視開始
            this.setupPerformanceMonitoring();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了（v1.9修正版）');
            console.log('🔧 修正項目:');
            console.log('  - PerformanceMonitor統合（drawing-tools.jsから移行）');
            console.log('  - パフォーマンス監視とUI統合');
            console.log('  - 責務をUI統合管理に明確化');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== パフォーマンス監視セットアップ（新規）====
    
    setupPerformanceMonitoring() {
        // パフォーマンス監視開始
        this.performanceMonitor.start();
        
        // 履歴管理システムとの統合コールバック
        this.performanceMonitor.addUpdateCallback((stats) => {
            if (this.historyManager && this.historyManager.getStats) {
                const historyStats = this.historyManager.getStats();
                
                // メモリ統計にも履歴管理のメモリ使用量を含める
                const totalMemoryMB = stats.memoryUsage + (historyStats.memoryUsageMB || 0);
                
                const memoryElement = document.getElementById('memory-usage');
                if (memoryElement) {
                    memoryElement.textContent = totalMemoryMB.toFixed(1) + 'MB';
                }
            }
        });
        
        console.log('📊 パフォーマンス監視統合完了');
    }
    
    // ==== パフォーマンス関連API（新規）====
    
    /**
     * パフォーマンス統計の取得
     */
    getPerformanceStats() {
        const baseStats = this.performanceMonitor.getStats();
        const appStats = this.app.getStats ? this.app.getStats() : {};
        const historyStats = this.historyManager ? this.historyManager.getStats() : null;
        const toolsStats = this.toolsSystem.getSystemStats ? this.toolsSystem.getSystemStats() : {};
        
        return {
            ...baseStats,
            ...appStats,
            history: historyStats,
            tools: {
                currentTool: toolsStats.currentTool,
                initialized: toolsStats.initialized
            }
        };
    }
    
    /**
     * パフォーマンス監視の開始/停止
     */
    setPerformanceMonitoring(enabled) {
        if (enabled) {
            this.performanceMonitor.start();
        } else {
            this.performanceMonitor.stop();
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
            { id: 'pen-smoothing-increase', slider: 'pen-smoothing-slider', delta: