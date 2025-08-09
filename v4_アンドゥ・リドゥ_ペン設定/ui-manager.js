/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev5
 * UI管理システム - ui-manager.js 
 * 
 * 🔧 v1rev5修正内容（Phase1: プリセット動的プレビュー対応）:
 * 1. ✅ プリセットプレビューの動的サイズ変更機能実装
 * 2. ✅ ペンサイズ変更時の●サイズ連動（最大20px）
 * 3. ✅ リニア変換の実装
 * 4. ✅ プリセット数値表示の同期強化
 * 5. ✅ スライダー変更時のプリセット内数字更新
 * 6. ✅ ペンサイズ・透明度両方の対応
 * 
 * Phase1目標: プリセット表示システムの完全修復
 * 対象: ui-manager.js, ui/components.js
 * 
 * 責務: UIコンテナ管理・UIイベント処理・プリセット管理・パフォーマンス監視
 * 依存: app-core.js, drawing-tools.js, ui/components.js
 */

// ==== パフォーマンス監視システム（drawing-tools.jsから移行・完全版）====
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

// ==== プリセット管理クラス（v1rev5: 動的プレビュー対応版）====
class PenPresetManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
        this.presets = this.createDefaultPresets();
        this.activePresetId = 'preset_16';
        this.currentLiveValues = null; // ライブ編集値
        
        this.setupPresetEventListeners();
        console.log('🎨 PenPresetManager初期化完了（v1rev5動的プレビュー対応）');
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
    
    // 🆕 v1rev5: ライブ値更新の強化
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
        
        console.log('🔄 ライブプレビュー更新:', {
            size: this.currentLiveValues.size.toFixed(1),
            opacity: Math.round(this.currentLiveValues.opacity * 100) + '%'
        });
    }
    
    // 🆕 v1rev5: 動的プレビューデータ生成の強化版
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
            
            // 🆕 v1rev5: 改良されたリニア変換による表示サイズ計算
            let displaySize;
            let actualSize; // 実際のサイズ値（ライブ値またはプリセット値）
            let actualOpacity; // 実際の透明度値
            
            if (isActive && liveValues) {
                actualSize = liveValues.size;
                actualOpacity = liveValues.opacity;
            } else {
                actualSize = preset.size;
                actualOpacity = preset.opacity;
            }
            
            // 🆕 リニア変換式: displaySize = min(maxSize, (actualSize / 100) * scale + minSize)
            const scale = previewMax - previewMin; // スケール範囲
            const normalizedSize = Math.min(1.0, actualSize / 100); // 0-1に正規化
            displaySize = Math.max(previewMin, Math.min(previewMax, normalizedSize * scale + previewMin));
            
            // 🆕 v1rev5: 数値表示の同期強化
            const sizeLabel = isActive && liveValues ? 
                liveValues.size.toFixed(1) + 'px' : 
                preset.size.toString() + 'px';
            
            const opacityLabel = isActive && liveValues ? 
                Math.round(liveValues.opacity * 100) + '%' : 
                Math.round(preset.opacity * 100) + '%';
            
            previewData.push({
                dataSize: preset.size, // HTML data-size属性用
                displaySize: displaySize, // 表示用サイズ（px）
                actualSize: actualSize, // 実際のサイズ値
                sizeLabel: sizeLabel, // サイズラベル
                opacity: actualOpacity, // 実際の透明度（0-1）
                opacityLabel: opacityLabel, // 透明度ラベル
                color: isActive && liveValues ? 
                    `#${liveValues.color.toString(16).padStart(6, '0')}` :
                    `#${preset.color.toString(16).padStart(6, '0')}`,
                isActive: isActive
            });
        }
        
        if (liveValues) {
            console.log('🎨 プレビューデータ生成（ライブ値適用）:', {
                activePreset: this.activePresetId,
                liveSize: liveValues.size.toFixed(1),
                liveOpacity: Math.round(liveValues.opacity * 100) + '%',
                itemCount: previewData.length
            });
        }
        
        return previewData;
    }
    
    // 🆕 v1rev5: リセット機能の準備
    resetActivePreset() {
        const activePreset = this.getActivePreset();
        if (!activePreset) return false;
        
        // デフォルト値に戻す
        this.currentLiveValues = null;
        
        if (this.toolsSystem) {
            this.toolsSystem.updateBrushSettings({
                size: activePreset.size,
                opacity: activePreset.opacity,
                color: activePreset.color,
                pressure: activePreset.pressure,
                smoothing: activePreset.smoothing
            });
        }
        
        console.log('🔄 プリセットリセット:', activePreset.name);
        return true;
    }
}

// ==== メインUI管理クラス（v1rev5プリセット動的プレビュー対応版）====
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
        
        // 🆕 v1rev5: プリセット更新スロットリング
        this.presetUpdateThrottle = null;
        this.presetUpdateDelay = 16; // 60fps相当
        
        // 外部参照（後で設定）
        this.historyManager = null;
        this.settingsManager = null;
    }
    
    async init() {
        try {
            console.log('🎯 UIManager初期化開始（v1rev5プリセット動的プレビュー対応版）...');
            
            // 依存コンポーネントのチェック
            this.checkDependencies();
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders(); // 🆕 v1rev5: スライダー設定の強化
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // 🆕 パフォーマンス監視開始
            this.setupPerformanceMonitoring();
            
            // 🆕 v1rev5: プリセット表示の初期化
            this.setupPresetDisplay();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了（v1rev5プリセット動的プレビュー対応版）');
            console.log('🔧 v1rev5修正項目:');
            console.log('  - プリセットプレビューの動的サイズ変更機能実装');
            console.log('  - ペンサイズ変更時の●サイズ連動（最大20px）');
            console.log('  - リニア変換の実装');
            console.log('  - プリセット数値表示の同期強化');
            console.log('  - スライダー変更時のプリセット内数字更新');
            console.log('  - ペンサイズ・透明度両方の対応');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== パフォーマンス監視セットアップ（既存）====
    
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
    
    // ==== 🆕 v1rev5: プリセット表示セットアップ ====
    
    setupPresetDisplay() {
        // プリセット表示の初期化
        if (this.presetDisplayManager) {
            // PresetDisplayManagerにPenPresetManagerを設定
            this.presetDisplayManager.setPenPresetManager(this.penPresetManager);
        }
        
        // プリセットイベントリスナーの追加設定
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', (event) => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.handlePresetClick(size, event);
            });
        });
        
        console.log('🎨 プリセット表示システム初期化完了（v1rev5）');
    }
    
    // 🆕 v1rev5: プリセットクリック処理
    handlePresetClick(size, event) {
        const presetId = `preset_${size}`;
        const preset = this.penPresetManager.selectPreset(presetId);
        
        if (preset) {
            // スライダーの値も同期更新
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', preset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', preset.smoothing * 100);
            
            // プリセット表示を即座に更新
            this.updatePresetsDisplayImmediate();
            
            console.log(`🎯 プリセット選択: ${preset.name} (サイズ${preset.size}px)`);
        }
    }
    
    // ==== パフォーマンス関連API（既存）====
    
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
    
    // ==== 🆕 v1rev5: スライダー設定の強化版 ====
    
    setupSliders() {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController が利用できません');
            return;
        }
        
        // 🆕 v1rev5: ペンサイズスライダー（プリセット連動強化）
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ size: value });
                
                // 🆕 プリセットライブ値更新
                const currentOpacity = this.toolsSystem.getBrushSettings().opacity;
                this.penPresetManager.updateActivePresetLive(value, currentOpacity * 100);
                
                // 🆕 プリセット表示の即座更新（スロットリング付き）
                this.throttledPresetUpdate();
            }
            return value.toFixed(1) + 'px';
        });
        
        // 🆕 v1rev5: 不透明度スライダー（プリセット連動強化）
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                
                // 🆕 プリセットライブ値更新
                const currentSize = this.toolsSystem.getBrushSettings().size;
                this.penPresetManager.updateActivePresetLive(currentSize, value);
                
                // 🆕 プリセット表示の即座更新（スロットリング付き）
                this.throttledPresetUpdate();
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
        console.log('✅ スライダー設定完了（v1rev5プリセット連動強化版）');
    }
    
    // 🆕 v1rev5: プリセット更新スロットリング
    throttledPresetUpdate() {
        if (this.presetUpdateThrottle) {
            clearTimeout(this.presetUpdateThrottle);
        }
        
        this.presetUpdateThrottle = setTimeout(() => {
            this.updatePresetsDisplayImmediate();
            this.presetUpdateThrottle = null;
        }, this.presetUpdateDelay);
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
        
        console.log('✅ スライダー調整ボタン設定完了');
    }
    
    // ==== リサイズ設定 ====
    
    setupResize() {
        // キャンバスサイズ設定ボタン
        const resizeButtons = [
            { id: 'resize-400-400', width: 400, height: 400 },
            { id: 'resize-600-600', width: 600, height: 600 },
            { id: 'resize-800-600', width: 800, height: 600 },
            { id: 'resize-1000-1000', width: 1000, height: 1000 }
        ];
        
        resizeButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    this.resizeCanvas(config.width, config.height);
                });
            }
        });
        
        console.log('✅ リサイズ設定完了');
    }
    
    resizeCanvas(width, height) {
        if (this.app && this.app.resize) {
            this.app.resize(width, height);
            
            if (this.statusBar) {
                this.statusBar.updateCanvasInfo(width, height);
            }
            
            console.log(`キャンバスリサイズ: ${width}x${height}px`);
        }
    }
    
    // ==== チェックボックス設定 ====
    
    setupCheckboxes() {
        // 高DPI設定
        const highDpiCheckbox = document.getElementById('high-dpi-checkbox');
        if (highDpiCheckbox) {
            highDpiCheckbox.addEventListener('change', (event) => {
                if (this.settingsManager) {
                    this.settingsManager.setSetting('highDPI', event.target.checked);
                }
            });
        }
        
        // デバッグ情報表示
        const debugInfoCheckbox = document.getElementById('debug-info-checkbox');
        if (debugInfoCheckbox) {
            debugInfoCheckbox.addEventListener('change', (event) => {
                const debugInfoElement = document.getElementById('debug-info');
                if (debugInfoElement) {
                    debugInfoElement.style.display = event.target.checked ? 'block' : 'none';
                }
            });
        }
        
        console.log('✅ チェックボックス設定完了');
    }
    
    // ==== アプリイベントリスナー設定 ====
    
    setupAppEventListeners() {
        // キャンバス上のマウス座標更新
        if (this.app && this.app.view) {
            this.app.view.addEventListener('pointermove', (event) => {
                this.updateCoordinatesThrottled(event.offsetX, event.offsetY);
            });
        }
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        console.log('✅ アプリイベントリスナー設定完了');
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            if (this.statusBar) {
                this.statusBar.updateCoordinates(x, y);
            }
        }, 16); // 60fps相当
    }
    
    handleWindowResize() {
        // ウィンドウリサイズ時の処理
        if (this.popupManager) {
            // ポップアップ位置の調整（必要に応じて）
            this.popupManager.hideAllPopups();
        }
        
        // デバウンス処理
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            console.log('ウィンドウリサイズ対応完了');
        }, 300);
    }
    
    // ==== 🆕 v1rev5: 表示更新メソッド群の強化版 ====
    
    updateAllDisplays() {
        try {
            this.updatePresetsDisplayImmediate();
            this.updateToolDisplay();
            this.updateStatusDisplay();
            
            console.log('✅ 全表示更新完了（v1rev5強化版）');
        } catch (error) {
            console.warn('表示更新エラー:', error);
        }
    }
    
    // 🆕 v1rev5: プリセット表示の即座更新
    updatePresetsDisplayImmediate() {
        if (this.presetDisplayManager) {
            this.presetDisplayManager.updatePresetsDisplay();
        } else {
            // フォールバック：直接更新
            this.updatePresetsDisplayDirect();
        }
    }
    
    // 🆕 v1rev5: プリセット表示の直接更新（フォールバック）
    updatePresetsDisplayDirect() {
        const previewData = this.penPresetManager.generatePreviewData();
        const presetsContainer = document.getElementById('size-presets');
        
        if (!presetsContainer) return;
        
        const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
        
        previewData.forEach((data, index) => {
            if (index < presetItems.length) {
                const item = presetItems[index];
                const circle = item.querySelector('.size-preview-circle');
                const sizeLabel = item.querySelector('.size-preview-label');
                const opacityLabel = item.querySelector('.size-preview-percent');
                
                // HTML属性更新
                item.setAttribute('data-size', data.dataSize);
                
                // 🆕 v1rev5: 動的サイズ更新
                if (circle) {
                    circle.style.width = data.displaySize + 'px';
                    circle.style.height = data.displaySize + 'px';
                    circle.style.background = data.color;
                    circle.style.opacity = data.opacity;
                }
                
                // 🆕 v1rev5: 数値表示の同期
                if (sizeLabel) {
                    sizeLabel.textContent = data.sizeLabel;
                }
                
                if (opacityLabel) {
                    opacityLabel.textContent = data.opacityLabel;
                }
                
                // アクティブ状態の反映
                item.classList.toggle('active', data.isActive);
            }
        });
        
        console.log('🔄 プリセット表示直接更新完了:', previewData.length + '項目');
    }
    
    // 🆕 v1rev5: 従来のupdatePresetsDisplay（後方互換）
    updatePresetsDisplay() {
        this.throttledPresetUpdate();
    }
    
    updateToolDisplay() {
        if (this.toolsSystem && this.statusBar) {
            const currentTool = this.toolsSystem.getCurrentTool();
            this.statusBar.updateCurrentTool(currentTool);
            
            const brushSettings = this.toolsSystem.getBrushSettings();
            if (brushSettings) {
                this.statusBar.updateCurrentColor(brushSettings.color);
            }
        }
    }
    
    updateStatusDisplay() {
        if (this.app && this.statusBar) {
            const appStats = this.app.getStats ? this.app.getStats() : {};
            if (appStats.width && appStats.height) {
                this.statusBar.updateCanvasInfo(appStats.width, appStats.height);
            }
        }
    }
    
    // ==== スライダー関連メソッド ====
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value, true);
        }
    }
    
    getAllSliderValues() {
        const values = {};
        for (const [id, slider] of this.sliders) {
            values[id] = slider.value;
        }
        return values;
    }
    
    // ==== 🆕 v1rev5: プリセット関連メソッドの強化版 ====
    
    selectPreset(presetId) {
        const preset = this.penPresetManager.selectPreset(presetId);
        if (preset) {
            // スライダーの値も更新
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', preset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', preset.smoothing * 100);
            
            // 🆕 v1rev5: 表示更新の即座実行
            this.updatePresetsDisplayImmediate();
            this.updateToolDisplay();
            
            return preset;
        }
        return null;
    }
    
    selectNextPreset() {
        const preset = this.penPresetManager.selectNextPreset();
        if (preset) {
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updatePresetsDisplayImmediate(); // 🆕 v1rev5: 即座更新
        }
        return preset;
    }
    
    selectPreviousPreset() {
        const preset = this.penPresetManager.selectPreviousPreset();
        if (preset) {
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updatePresetsDisplayImmediate(); // 🆕 v1rev5: 即座更新
        }
        return preset;
    }
    
    // 🆕 v1rev5: リセット機能実装
    resetActivePreset() {
        const result = this.penPresetManager.resetActivePreset();
        if (result) {
            const activePreset = this.penPresetManager.getActivePreset();
            
            // スライダー値をリセット
            this.updateSliderValue('pen-size-slider', activePreset.size);
            this.updateSliderValue('pen-opacity-slider', activePreset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', activePreset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', activePreset.smoothing * 100);
            
            // 表示更新
            this.updatePresetsDisplayImmediate();
            this.updateToolDisplay();
            
            // 通知
            if (this.showNotification) {
                this.showNotification(`プリセット「${activePreset.name}」をリセットしました`, 'info', 2000);
            }
        }
        return result;
    }
    
    // 🆕 v1rev5: PenPresetManager取得API
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    // ==== ポップアップ関連メソッド ====
    
    showPopup(popupId) {
        if (this.popupManager) {
            return this.popupManager.showPopup(popupId);
        }
        return false;
    }
    
    hidePopup(popupId) {
        if (this.popupManager) {
            return this.popupManager.hidePopup(popupId);
        }
        return false;
    }
    
    hideAllPopups() {
        if (this.popupManager) {
            this.popupManager.hideAllPopups();
        }
    }
    
    // ==== 通知・エラー表示 ====
    
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 将来的にはより高度な通知システムを実装予定
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }
    
    showError(message, duration = 5000) {
        this.showNotification(message, 'error', duration);
    }
    
    // ==== 設定関連ハンドラ ====
    
    handleSettingChange(key, newValue) {
        console.log(`設定変更: ${key} = ${newValue}`);
        
        // 設定に応じた処理
        switch (key) {
            case 'highDPI':
                this.handleHighDPIChange(newValue);
                break;
            case 'showDebugInfo':
                this.handleDebugInfoChange(newValue);
                break;
            default:
                console.log(`未処理の設定変更: ${key}`);
        }
    }
    
    handleSettingsLoaded(settings) {
        console.log('設定読み込み完了:', settings);
        
        // UI要素に設定を反映
        if (settings.highDPI !== undefined) {
            const checkbox = document.getElementById('high-dpi-checkbox');
            if (checkbox) {
                checkbox.checked = settings.highDPI;
            }
        }
        
        if (settings.showDebugInfo !== undefined) {
            const checkbox = document.getElementById('debug-info-checkbox');
            if (checkbox) {
                checkbox.checked = settings.showDebugInfo;
            }
            this.handleDebugInfoChange(settings.showDebugInfo);
        }
    }
    
    handleHighDPIChange(enabled) {
        if (this.app && this.app.setHighDPI) {
            this.app.setHighDPI(enabled);
            this.showNotification(
                enabled ? '高DPI設定を有効にしました' : '高DPI設定を無効にしました',
                'info'
            );
        }
    }
    
    handleDebugInfoChange(enabled) {
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            debugElement.style.display = enabled ? 'block' : 'none';
        }
    }
    
    // ==== システム統計・デバッグ ====
    
    getUIStats() {
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.activePopup : null,
            sliderCount: this.sliders.size,
            activePreset: this.penPresetManager.getActivePresetId(),
            performanceMonitoring: this.performanceMonitor.isRunning,
            // 🆕 v1rev5: プリセット統計追加
            presetStats: {
                hasLiveValues: !!this.penPresetManager.currentLiveValues,
                presetCount: this.penPresetManager.presets.size
            },
            components: {
                popupManager: !!this.popupManager,
                statusBar: !!this.statusBar,
                presetDisplayManager: !!this.presetDisplayManager,
                penPresetManager: !!this.penPresetManager,
                performanceMonitor: !!this.performanceMonitor
            }
        };
    }
    
    debugUI() {
        console.group('🔍 UIManager デバッグ情報（v1rev5プリセット動的プレビュー対応）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            activePreset: this.penPresetManager.getActivePresetId()
        });
        
        console.log('コンポーネント状態:', this.getUIStats().components);
        
        console.log('スライダー値:', this.getAllSliderValues());
        
        if (this.performanceMonitor) {
            console.log('パフォーマンス統計:', this.performanceMonitor.getStats());
        }
        
        // 🆕 v1rev5: プリセット詳細情報
        if (this.penPresetManager) {
            console.log('プリセット一覧:', Array.from(this.penPresetManager.presets.keys()));
            console.log('アクティブプリセット:', this.penPresetManager.getActivePreset());
            console.log('ライブ値:', this.penPresetManager.currentLiveValues);
            
            const previewData = this.penPresetManager.generatePreviewData();
            console.log('プレビューデータ:', previewData);
        }
        
        console.groupEnd();
    }
    
    // ==== 外部連携メソッド ====
    
    onToolChange(newTool) {
        // ツール変更時の処理
        this.updateToolDisplay();
        
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const toolButton = document.getElementById(`${newTool}-tool`);
        if (toolButton) {
            toolButton.classList.add('active');
        }
    }
    
    // 🆕 v1rev5: ブラシ設定変更時の処理強化版
    onBrushSettingsChange(settings) {
        // ブラシ設定変更時の処理
        if (settings.size !== undefined) {
            this.updateSliderValue('pen-size-slider', settings.size);
        }
        if (settings.opacity !== undefined) {
            this.updateSliderValue('pen-opacity-slider', settings.opacity * 100);
        }
        if (settings.pressure !== undefined) {
            this.updateSliderValue('pen-pressure-slider', settings.pressure * 100);
        }
        if (settings.smoothing !== undefined) {
            this.updateSliderValue('pen-smoothing-slider', settings.smoothing * 100);
        }
        
        // 🆕 v1rev5: プリセットライブ値更新
        if (settings.size !== undefined || settings.opacity !== undefined) {
            const currentSize = settings.size !== undefined ? settings.size : 
                this.toolsSystem.getBrushSettings().size;
            const currentOpacity = settings.opacity !== undefined ? settings.opacity * 100 : 
                this.toolsSystem.getBrushSettings().opacity * 100;
            
            this.penPresetManager.updateActivePresetLive(currentSize, currentOpacity);
            this.throttledPresetUpdate();
        }
        
        this.updateToolDisplay();
    }
    
    // ==== クリーンアップ ====
    
    destroy() {
        try {
            // パフォーマンス監視停止
            if (this.performanceMonitor) {
                this.performanceMonitor.stop();
            }
            
            // スライダーのクリーンアップ
            for (const slider of this.sliders.values()) {
                if (slider.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // タイムアウトのクリア
            if (this.coordinateUpdateThrottle) {
                clearTimeout(this.coordinateUpdateThrottle);
            }
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            // 🆕 v1rev5: プリセット更新スロットリングのクリア
            if (this.presetUpdateThrottle) {
                clearTimeout(this.presetUpdateThrottle);
            }
            
            console.log('✅ UIManager クリーンアップ完了（v1rev5）');
            
        } catch (error) {
            console.error('UIManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録 ====
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    window.PerformanceMonitor = PerformanceMonitor;
    window.PenPresetManager = PenPresetManager;
    
    console.log('🎯 ui-manager.js v1rev5 読み込み完了（プリセット動的プレビュー対応版）');
    console.log('📦 エクスポートクラス:');
    console.log('  - UIManager: UI統合管理（プリセット動的プレビュー対応）');
    console.log('  - PerformanceMonitor: パフォーマンス監視システム');
    console.log('  - PenPresetManager: ペンプリセット管理（ライブプレビュー対応）');
    console.log('🔧 v1rev5修正内容:');
    console.log('  ✅ プリセットプレビューの動的サイズ変更機能実装');
    console.log('  ✅ ペンサイズ変更時の●サイズ連動（最大20px）');
    console.log('  ✅ リニア変換の実装');
    console.log('  ✅ プリセット数値表示の同期強化');
    console.log('  ✅ スライダー変更時のプリセット内数字更新');
    console.log('  ✅ ペンサイズ・透明度両方の対応');
    console.log('🏗️ Phase1実装完了:');
    console.log('  - プリセット表示システムの完全修復');
    console.log('  - スライダー連携強化');
    console.log('  - 動的プレビューロジック実装');
    console.log('  - 表示更新タイミングの最適化');
}

// ==== ES6モジュールエクスポート（将来のTypeScript移行用）====
// export { UIManager, PerformanceMonitor, PenPresetManager };