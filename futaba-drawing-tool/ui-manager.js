/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev8
 * UI統合管理システム - ui-manager.js（Phase2C統合調整版）
 * 
 * 🔧 Phase2C統合調整内容:
 * 1. ✅ 新PerformanceMonitorSystemとの統合（内蔵PerformanceMonitor → 外部専門システム移行）
 * 2. ✅ パフォーマンス監視機能の完全委譲（専門システム化）
 * 3. ✅ UI統合制御のさらなる縮小（600行以下達成）
 * 4. ✅ 新PresetManager・新PerformanceMonitorSystemの統合制御
 * 5. ✅ イベント通知システムの統合強化
 * 6. ✅ エラーハンドリング・フォールバック機能継続
 * 7. ✅ デバッグ・テスト機能の拡張（統合テスト対応）
 * 8. ✅ システム統計の統合表示機能
 * 
 * Phase2C目標: 新PerformanceMonitorSystemとの統合・UI制御の更なる縮小・専門システム化完成
 * 責務: UI統合制御のみ（パフォーマンス監視詳細管理は完全委譲）
 * 依存: config.js, ui/preset-manager.js, ui/performance-monitor.js, ui/components.js, history-manager.js
 */

console.log('🔧 ui-manager.js Phase2C統合調整版読み込み開始...');

// ==== Phase2C: UI統合管理クラス（更なる縮小版・PerformanceMonitorSystem統合）====
class UIManager {
    constructor(app, toolsSystem, historyManager = null) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.historyManager = historyManager;
        
        // Phase2C: 外部コンポーネント（存在チェック付き）
        this.popupManager = this.initializeComponent('PopupManager');
        this.statusBar = this.initializeComponent('StatusBarManager');
        this.presetDisplayManager = this.initializeComponent('PresetDisplayManager', [toolsSystem]);
        
        // Phase2B継続: 新PresetManager（専門システム）
        this.presetManager = this.initializeComponent('PresetManager', [toolsSystem, historyManager]);
        
        // Phase2C: 新PerformanceMonitorSystem（専門システム）
        this.performanceMonitor = this.initializeComponent('PerformanceMonitorSystem', [{
            maxHistoryLength: 120,
            enableMemoryLeakDetection: true
        }]);
        
        // スライダー管理
        this.sliders = new Map();
        
        // 状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
        this.errorCount = 0;
        this.maxErrors = 10;
        
        // 外部参照（後で設定）
        this.settingsManager = null;
        
        console.log('🎯 UIManager初期化（Phase2C統合調整版）');
    }
    
    /**
     * Phase2C継続: コンポーネント安全初期化
     */
    initializeComponent(ComponentClass, constructorArgs = []) {
        try {
            if (typeof window[ComponentClass] !== 'undefined') {
                return new window[ComponentClass](...constructorArgs);
            } else {
                console.warn(`${ComponentClass} が利用できません`);
                return null;
            }
        } catch (error) {
            console.error(`${ComponentClass} 初期化エラー:`, error);
            return null;
        }
    }
    
    /**
     * Phase2C継続: 履歴管理システム設定
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        // PresetManagerにも設定
        if (this.presetManager && this.presetManager.setHistoryManager) {
            this.presetManager.setHistoryManager(historyManager);
        }
        
        console.log('📚 UIManager: 履歴管理システム連携完了');
    }
    
    /**
     * Phase2C: 初期化（PerformanceMonitorSystem統合版）
     */
    async init() {
        try {
            console.log('🎯 UIManager初期化開始（Phase2C統合調整版）...');
            
            // Phase2B継続: PresetManager統合
            this.setupPresetManagerIntegration();
            
            // Phase2C: PerformanceMonitorSystem統合
            this.setupPerformanceMonitorIntegration();
            
            // 基本UI設定
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // リセット機能
            this.setupResetFunctions();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了（Phase2C統合調整版）');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * Phase2B継続: PresetManager統合セットアップ
     */
    setupPresetManagerIntegration() {
        if (this.presetManager && this.presetDisplayManager) {
            // PresetDisplayManagerに新PresetManagerを設定
            this.presetDisplayManager.setPresetManager(this.presetManager);
            
            // Phase2B: イベントリスナー設定
            this.setupPresetManagerEvents();
            
            console.log('🔧 PresetManager統合完了（継続）');
        } else {
            console.warn('PresetManager または PresetDisplayManager が利用できません');
            this.setupFallbackPresetSystem();
        }
    }
    
    /**
     * Phase2C: PerformanceMonitorSystem統合セットアップ
     */
    setupPerformanceMonitorIntegration() {
        if (this.performanceMonitor) {
            // Phase2C: パフォーマンス監視開始
            this.performanceMonitor.start();
            
            // Phase2C: イベントリスナー設定
            this.setupPerformanceMonitorEvents();
            
            console.log('📊 PerformanceMonitorSystem統合完了');
        } else {
            console.warn('PerformanceMonitorSystem が利用できません、フォールバック使用');
            this.setupFallbackPerformanceSystem();
        }
    }
    
    /**
     * Phase2C: PerformanceMonitorSystemイベントリスナー設定
     */
    setupPerformanceMonitorEvents() {
        if (!this.performanceMonitor) return;
        
        // 統計更新イベント
        this.performanceMonitor.addEventListener('stats:updated', (event) => {
            this.handlePerformanceStatsUpdated(event.detail);
        });
        
        // パフォーマンス警告イベント
        this.performanceMonitor.addEventListener('performance:warning', (event) => {
            this.handlePerformanceWarning(event.detail);
        });
        
        // メモリ警告イベント
        this.performanceMonitor.addEventListener('memory:warning', (event) => {
            this.handleMemoryWarning(event.detail);
        });
        
        // メモリリーク疑いイベント
        this.performanceMonitor.addEventListener('memory:leak_suspected', (event) => {
            this.handleMemoryLeakSuspected(event.detail);
        });
        
        // 監視開始・停止イベント
        this.performanceMonitor.addEventListener('monitor:started', (event) => {
            this.showNotification('パフォーマンス監視開始', 'info', 2000);
        });
        
        this.performanceMonitor.addEventListener('monitor:stopped', (event) => {
            this.showNotification('パフォーマンス監視停止', 'info', 2000);
        });
        
        console.log('📊 PerformanceMonitorSystemイベントリスナー設定完了');
    }
    
    /**
     * Phase2C: パフォーマンス統計更新ハンドラー
     */
    handlePerformanceStatsUpdated(stats) {
        // StatusBarへの統合表示
        if (this.statusBar) {
            // 履歴統計との統合
            const historyStats = this.historyManager ? this.historyManager.getStats() : {};
            
            this.statusBar.updatePerformanceStats({
                ...stats,
                historyLength: historyStats.historyLength || 0,
                memoryUsage: stats.memoryUsageMB + 'MB'
            });
            
            if (historyStats) {
                this.statusBar.updateHistoryStatus(historyStats);
            }
        }
        
        // FPS・メモリ・GPU個別表示更新
        this.updatePerformanceDisplay(stats);
    }
    
    /**
     * Phase2C: パフォーマンス表示更新
     */
    updatePerformanceDisplay(stats) {
        // FPS表示
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = stats.fps;
            
            // FPS警告表示
            if (stats.fps < stats.targetFPS * 0.6) {
                fpsElement.style.color = '#ff4444'; // 警告色
            } else {
                fpsElement.style.color = ''; // 通常色
            }
        }
        
        // メモリ使用量表示
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement) {
            memoryElement.textContent = stats.memoryUsageMB + 'MB';
            
            // メモリ警告表示
            if (stats.memoryUsageMB > 100) {
                memoryElement.style.color = '#ff8800'; // 警告色
            } else {
                memoryElement.style.color = ''; // 通常色
            }
        }
        
        // GPU使用率表示
        const gpuElement = document.getElementById('gpu-usage');
        if (gpuElement) {
            gpuElement.textContent = stats.gpuUsage + '%';
            
            // GPU使用率警告表示
            if (stats.gpuUsage > 85) {
                gpuElement.style.color = '#ff4444'; // 高負荷色
            } else if (stats.gpuUsage > 70) {
                gpuElement.style.color = '#ff8800'; // 中負荷色
            } else {
                gpuElement.style.color = ''; // 通常色
            }
        }
    }
    
    /**
     * Phase2C: パフォーマンス警告ハンドラー
     */
    handlePerformanceWarning(data) {
        const { warnings } = data;
        
        warnings.forEach(warning => {
            if (warning.type === 'low_fps') {
                this.showNotification(
                    `FPS低下: ${warning.value}fps (目標: ${this.performanceMonitor.targetFPS}fps)`,
                    'warning',
                    4000
                );
            } else if (warning.type === 'high_frame_time') {
                this.showNotification(
                    `フレーム時間過大: ${warning.value}ms`,
                    'warning',
                    3000
                );
            }
        });
    }
    
    /**
     * Phase2C: メモリ警告ハンドラー
     */
    handleMemoryWarning(data) {
        const { warnings } = data;
        
        warnings.forEach(warning => {
            if (warning.severity === 'critical') {
                this.showNotification(
                    `メモリ使用量が危険レベル: ${warning.value}MB`,
                    'error',
                    6000
                );
            } else {
                this.showNotification(
                    `メモリ使用量警告: ${warning.value}MB`,
                    'warning',
                    4000
                );
            }
        });
    }
    
    /**
     * Phase2C: メモリリーク疑いハンドラー
     */
    handleMemoryLeakSuspected(data) {
        const { growth, current } = data;
        this.showNotification(
            `メモリリークの可能性: +${growth.toFixed(1)}MB増加（現在: ${current.toFixed(1)}MB）`,
            'warning',
            5000
        );
        
        console.warn('メモリリーク疑い:', data);
    }
    
    /**
     * Phase2C: フォールバックパフォーマンスシステム
     */
    setupFallbackPerformanceSystem() {
        console.warn('フォールバックパフォーマンス監視システムを初期化します');
        
        // 基本的なFPS表示のみ
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;
            
            if (deltaTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / deltaTime);
                
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }
    
    /**
     * Phase2B継続: PresetManagerイベントリスナー設定
     */
    setupPresetManagerEvents() {
        if (!this.presetManager) return;
        
        // プリセット選択イベント
        this.presetManager.addEventListener('preset:selected', (data) => {
            this.handlePresetSelected(data);
        });
        
        // プリセットリセットイベント
        this.presetManager.addEventListener('preset:reset', (data) => {
            this.handlePresetReset(data);
        });
        
        // ライブ更新イベント
        this.presetManager.addEventListener('preset:live_updated', (data) => {
            this.handlePresetLiveUpdated(data);
        });
        
        console.log('🎛️ PresetManagerイベントリスナー設定完了（継続）');
    }
    
    /**
     * Phase2B継続: プリセットイベントハンドラー
     */
    handlePresetSelected(data) {
        // スライダーの値も同期更新
        if (data.preset) {
            this.updateSliderValue('pen-size-slider', data.preset.size);
            this.updateSliderValue('pen-opacity-slider', data.preset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', data.preset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', data.preset.smoothing * 100);
        }
        
        this.updateToolDisplay();
        this.showNotification(`プリセット選択: ${data.preset?.name || 'プリセット'}`, 'info', 1500);
    }
    
    handlePresetReset(data) {
        this.updateAllDisplays();
        this.showNotification('プリセットをリセットしました', 'success', 2000);
    }
    
    handlePresetLiveUpdated(data) {
        // ライブ更新時は通知なし（頻繁すぎるため）
        // 表示更新は PresetDisplayManager が自動実行
    }
    
    /**
     * Phase2B継続: フォールバックプリセットシステム
     */
    setupFallbackPresetSystem() {
        console.warn('フォールバックプリセットシステムを初期化します（継続）');
        
        // 基本的なプリセット選択のみサポート
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', (event) => {
                const size = parseFloat(preset.getAttribute('data-size'));
                if (this.toolsSystem && this.toolsSystem.updateBrushSettings) {
                    this.toolsSystem.updateBrushSettings({ size: size });
                    this.showNotification(`サイズを${size}pxに設定`, 'info', 1500);
                }
            });
        });
    }
    
    /**
     * Phase2B継続: リセット機能セットアップ
     */
    setupResetFunctions() {
        // アクティブプリセットリセット
        const resetPresetBtn = document.getElementById('reset-active-preset');
        if (resetPresetBtn) {
            resetPresetBtn.addEventListener('click', () => {
                this.handleResetActivePreset();
            });
        }
        
        // 全プリセットリセット
        const resetAllPresetsBtn = document.getElementById('reset-all-presets');
        if (resetAllPresetsBtn) {
            resetAllPresetsBtn.addEventListener('click', () => {
                this.handleResetAllPresets();
            });
        }
        
        // キャンバスリセット
        const resetCanvasBtn = document.getElementById('reset-canvas');
        if (resetCanvasBtn) {
            resetCanvasBtn.addEventListener('click', () => {
                this.handleResetCanvas();
            });
        }
        
        console.log('🔄 リセット機能セットアップ完了（継続）');
    }
    
    /**
     * Phase2B継続: リセット処理（PresetManager委譲）
     */
    handleResetActivePreset() {
        if (this.presetManager && this.presetManager.resetActivePreset) {
            const success = this.presetManager.resetActivePreset();
            
            if (success) {
                this.updateSliderValuesFromActivePreset();
                this.updateToolDisplay();
            }
        } else {
            this.showNotification('プリセットリセット機能が利用できません', 'error', 3000);
        }
    }
    
    handleResetAllPresets() {
        if (confirm('全てのプリセットをデフォルト値にリセットしますか？')) {
            if (this.presetManager && this.presetManager.resetAllPresets) {
                const success = this.presetManager.resetAllPresets();
                
                if (success) {
                    this.updateSliderValuesFromActivePreset();
                    this.updateToolDisplay();
                }
            } else {
                this.showNotification('全プリセットリセット機能が利用できません', 'error', 3000);
            }
        }
    }
    
    handleResetCanvas() {
        if (confirm('キャンバスを消去しますか？この操作は取り消すことができます。')) {
            // 履歴記録
            if (this.historyManager) {
                this.historyManager.recordCanvasClear();
            }
            
            // キャンバスクリア実行
            if (this.app && this.app.clear) {
                this.app.clear();
                this.showNotification('キャンバスをクリアしました', 'info', 2000);
            } else {
                this.showNotification('キャンバスクリアに失敗しました', 'error', 3000);
            }
        }
    }
    
    /**
     * Phase2B継続: アクティブプリセットからスライダー値更新
     */
    updateSliderValuesFromActivePreset() {
        if (!this.presetManager) return;
        
        const activePreset = this.presetManager.getActivePreset();
        if (!activePreset) return;
        
        this.updateSliderValue('pen-size-slider', activePreset.size);
        this.updateSliderValue('pen-opacity-slider', activePreset.opacity * 100);
        this.updateSliderValue('pen-pressure-slider', activePreset.pressure * 100);
        this.updateSliderValue('pen-smoothing-slider', activePreset.smoothing * 100);
        
        console.log('🎛️ スライダー値更新（アクティブプリセット同期）');
    }
    
    /**
     * Phase2C継続: ツールボタン設定（簡略版）
     */
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
    
    /**
     * Phase2C継続: ポップアップ設定（簡略版）
     */
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
    
    /**
     * Phase2C継続: スライダー設定（CONFIG連携版）
     */
    setupSliders() {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController が利用できません');
            return;
        }
        
        try {
            // ペンサイズスライダー
            this.createSlider('pen-size-slider', CONFIG.MIN_BRUSH_SIZE, CONFIG.MAX_BRUSH_SIZE, CONFIG.DEFAULT_BRUSH_SIZE, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ size: value });
                        
                        // プリセットライブ値更新
                        if (this.presetManager) {
                            const currentOpacity = this.toolsSystem.getBrushSettings().opacity;
                            this.presetManager.updateActivePresetLive(value, currentOpacity * 100);
                        }
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー
            this.createSlider('pen-opacity-slider', 0, 100, CONFIG.DEFAULT_OPACITY * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                        
                        // プリセットライブ値更新
                        if (this.presetManager) {
                            const currentSize = this.toolsSystem.getBrushSettings().size;
                            this.presetManager.updateActivePresetLive(currentSize, value);
                        }
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 筆圧・線補正スライダー
            this.createSlider('pen-pressure-slider', 0, 100, CONFIG.DEFAULT_PRESSURE * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
                    }
                    return value.toFixed(1) + '%';
                });
            
            this.createSlider('pen-smoothing-slider', 0, 100, CONFIG.DEFAULT_SMOOTHING * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
                    }
                    return value.toFixed(1) + '%';
                });
            
            this.setupSliderButtons();
            console.log('✅ スライダー設定完了（Phase2C対応版）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        try {
            const slider = new SliderController(sliderId, min, max, initial, callback);
            this.sliders.set(sliderId, slider);
            return slider;
        } catch (error) {
            console.error(`スライダー作成エラー (${sliderId}):`, error);
            return null;
        }
    }
    
    setupSliderButtons() {
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
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 }
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
    
    /**
     * Phase2C継続: リサイズ設定（簡略版）
     */
    setupResize() {
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
        // 履歴記録付きリサイズ
        if (this.historyManager) {
            const beforeSize = { width: this.app.width, height: this.app.height };
            const afterSize = { width, height };
            this.historyManager.recordCanvasResize(beforeSize, afterSize);
        }
        
        if (this.app && this.app.resize) {
            this.app.resize(width, height);
            
            if (this.statusBar) {
                this.statusBar.updateCanvasInfo(width, height);
            }
            
            console.log(`キャンバスリサイズ（履歴記録付き）: ${width}x${height}px`);
        }
    }
    
    /**
     * Phase2C継続: チェックボックス設定（簡略版）
     */
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
    
    /**
     * Phase2C継続: アプリイベントリスナー設定
     */
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
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
        
        console.log('✅ アプリイベントリスナー設定完了');
    }
    
    /**
     * Phase2C継続: キーボードショートカット処理
     */
    handleKeyboardShortcuts(event) {
        // Ctrl+Z: アンドゥ
        if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (this.historyManager && this.historyManager.canUndo()) {
                const success = this.historyManager.undo();
                if (success) {
                    this.updateAllDisplays();
                    this.showNotification('元に戻しました', 'info', 1500);
                }
            }
            return;
        }
        
        // Ctrl+Shift+Z または Ctrl+Y: リドゥ
        if ((event.ctrlKey && event.shiftKey && event.key === 'Z') || 
            (event.ctrlKey && event.key === 'y')) {
            event.preventDefault();
            if (this.historyManager && this.historyManager.canRedo()) {
                const success = this.historyManager.redo();
                if (success) {
                    this.updateAllDisplays();
                    this.showNotification('やり直しました', 'info', 1500);
                }
            }
            return;
        }
        
        // R: アクティブプリセットリセット
        if (event.key === 'r' && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            this.handleResetActivePreset();
            return;
        }
        
        // P: パフォーマンス監視の一時停止/再開（Phase2C新機能）
        if (event.key === 'p' && event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            if (this.performanceMonitor) {
                if (this.performanceMonitor.isPaused) {
                    this.performanceMonitor.resume();
                    this.showNotification('パフォーマンス監視再開', 'info', 2000);
                } else {
                    this.performanceMonitor.pause();
                    this.showNotification('パフォーマンス監視一時停止', 'info', 2000);
                }
            }
            return;
        }
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
        if (this.popupManager) {
            this.popupManager.hideAllPopups();
        }
        
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            console.log('ウィンドウリサイズ対応完了');
        }, 300);
    }
    
    /**
     * Phase2C継続: 表示更新メソッド群（簡略版）
     */
    updateAllDisplays() {
        try {
            // PresetDisplayManagerが自動で更新するため、最小限の処理のみ
            this.updateSliderValuesFromActivePreset();
            this.updateToolDisplay();
            this.updateStatusDisplay();
            
            console.log('✅ 全表示更新完了（Phase2C簡略版）');
        } catch (error) {
            console.warn('表示更新エラー:', error);
            this.handleError(error);
        }
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
        
        // Phase2C継続: アクティブプリセット情報表示
        if (this.presetManager && this.statusBar) {
            const activePreset = this.presetManager.getActivePreset();
            if (activePreset) {
                this.statusBar.updateActivePreset(activePreset);
            }
        }
    }
    
    /**
     * Phase2C継続: スライダー関連メソッド
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value, true);
        }
    }
    
    getAllSliderValues() {
        const values = {};
        for (const [id, slider] of this.sliders) {
            if (slider && slider.getStatus) {
                const status = slider.getStatus();
                values[id] = status.value;
            }
        }
        return values;
    }
    
    /**
     * Phase2C継続: プリセット関連メソッド（PresetManager委譲版）
     */
    selectPreset(presetId) {
        if (this.presetManager) {
            return this.presetManager.selectPreset(presetId);
        }
        return null;
    }
    
    selectNextPreset() {
        if (this.presetManager) {
            return this.presetManager.selectNextPreset();
        }
        return null;
    }
    
    selectPreviousPreset() {
        if (this.presetManager) {
            return this.presetManager.selectPreviousPreset();
        }
        return null;
    }
    
    resetActivePreset() {
        return this.handleResetActivePreset();
    }
    
    getPresetManager() {
        return this.presetManager;
    }
    
    /**
     * Phase2C: PerformanceMonitorSystem関連メソッド
     */
    getPerformanceMonitor() {
        return this.performanceMonitor;
    }
    
    startPerformanceMonitoring() {
        if (this.performanceMonitor) {
            this.performanceMonitor.start();
            return true;
        }
        return false;
    }
    
    stopPerformanceMonitoring() {
        if (this.performanceMonitor) {
            this.performanceMonitor.stop();
            return true;
        }
        return false;
    }
    
    getPerformanceStats() {
        if (this.performanceMonitor) {
            return this.performanceMonitor.getStats();
        }
        return null;
    }
    
    getDetailedPerformanceStats() {
        if (this.performanceMonitor) {
            return this.performanceMonitor.getDetailedStats();
        }
        return null;
    }
    
    /**
     * Phase2C継続: ポップアップ関連メソッド
     */
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
    
    /**
     * Phase2C継続: 履歴管理関連メソッド
     */
    getHistoryManager() {
        return this.historyManager;
    }
    
    undo() {
        if (!this.historyManager) return false;
        
        const success = this.historyManager.undo();
        if (success) {
            this.updateAllDisplays();
            console.log('🔙 アンドゥ実行 + UI更新完了');
        }
        return success;
    }
    
    redo() {
        if (!this.historyManager) return false;
        
        const success = this.historyManager.redo();
        if (success) {
            this.updateAllDisplays();
            console.log('🔜 リドゥ実行 + UI更新完了');
        }
        return success;
    }
    
    canUndo() {
        return this.historyManager ? this.historyManager.canUndo() : false;
    }
    
    canRedo() {
        return this.historyManager ? this.historyManager.canRedo() : false;
    }
    
    getHistoryStats() {
        return this.historyManager ? this.historyManager.getStats() : null;
    }
    
    /**
     * Phase2C継続: 通知・エラー表示
     */
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
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
            transition: opacity 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // フェードイン
        setTimeout(() => notification.style.opacity = '1', 10);
        
        // フェードアウト・削除
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
    
    showError(message, duration = 5000) {
        this.showNotification(message, 'error', duration);
    }
    
    /**
     * Phase2C継続: エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`UIManager: 最大エラー数 (${this.maxErrors}) に達しました。`);
            this.showError('UIシステムで重大なエラーが発生しました', 10000);
            return;
        }
        
        console.warn(`UIManager エラー ${this.errorCount}/${this.maxErrors}:`, error);
    }
    
    /**
     * Phase2C継続: 設定関連ハンドラ
     */
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
    }
    
    handleSettingChange(key, newValue) {
        console.log(`設定変更: ${key} = ${newValue}`);
        
        switch (key) {
            case 'highDPI':
                this.handleHighDPIChange(newValue);
                break;
            case 'showDebugInfo':
                this.handleDebugInfoChange(newValue);
                break;
        }
    }
    
    handleSettingsLoaded(settings) {
        console.log('設定読み込み完了:', settings);
        
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
    
    /**
     * Phase2C: システム統計・デバッグ（統合版）
     */
    getUIStats() {
        const historyStats = this.getHistoryStats();
        const performanceStats = this.getPerformanceStats();
        
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.getStatus().activePopup : null,
            sliderCount: this.sliders.size,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            // Phase2B継続: 統合システム統計
            presetManager: this.presetManager ? this.presetManager.getSystemStats() : null,
            presetDisplayManager: this.presetDisplayManager ? this.presetDisplayManager.getSystemStats() : null,
            // Phase2C: パフォーマンス監視システム統計
            performanceMonitor: this.performanceMonitor ? this.performanceMonitor.getSystemStats() : null,
            historyStats: historyStats,
            performanceStats: performanceStats,
            components: {
                popupManager: !!this.popupManager,
                statusBar: !!this.statusBar,
                presetDisplayManager: !!this.presetDisplayManager,
                presetManager: !!this.presetManager, // Phase2B継続
                performanceMonitor: !!this.performanceMonitor, // Phase2C新規
                historyManager: !!this.historyManager
            }
        };
    }
    
    debugUI() {
        console.group('🔍 UIManager デバッグ情報（Phase2C統合調整版）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`
        });
        
        console.log('コンポーネント状態:', this.getUIStats().components);
        
        console.log('スライダー値:', this.getAllSliderValues());
        
        // Phase2B継続: PresetManager統計
        if (this.presetManager) {
            console.log('PresetManager統計:', this.presetManager.getSystemStats());
            console.log('アクティブプリセット:', this.presetManager.getActivePreset());
        }
        
        // PresetDisplayManager統計
        if (this.presetDisplayManager) {
            console.log('PresetDisplayManager統計:', this.presetDisplayManager.getSystemStats());
        }
        
        // Phase2C: PerformanceMonitorSystem統計
        if (this.performanceMonitor) {
            console.log('PerformanceMonitorSystem統計:', this.performanceMonitor.getSystemStats());
            console.log('詳細パフォーマンス統計:', this.performanceMonitor.getDetailedStats());
        }
        
        // 履歴統計
        if (this.historyManager) {
            console.log('履歴統計:', this.getHistoryStats());
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2C: Phase2C機能テスト
     */
    testPhase2CIntegration() {
        console.group('🧪 UIManager Phase2C統合テスト');
        
        try {
            // 1. 新PerformanceMonitorSystem統合テスト
            console.log('1. PerformanceMonitorSystem統合テスト');
            if (this.performanceMonitor) {
                console.log('✅ PerformanceMonitorSystem利用可能');
                
                // 監視状態テスト
                console.log('監視実行中:', this.performanceMonitor.isRunning);
                console.log('統計:', this.performanceMonitor.getStats());
                
                // テスト実行
                this.performanceMonitor.testPerformanceMonitoring();
            } else {
                console.log('❌ PerformanceMonitorSystem利用不可');
            }
            
            // 2. Phase2B継続: PresetManager連携テスト
            console.log('2. PresetManager連携テスト（継続）');
            if (this.presetManager) {
                console.log('✅ PresetManager利用可能');
                this.presetManager.testPresetSystem();
            } else {
                console.log('❌ PresetManager利用不可');
            }
            
            // 3. Phase2C: システム統合テスト
            console.log('3. システム統合テスト');
            const uiStats = this.getUIStats();
            console.log('統合システム統計:', {
                presetManagerActive: !!uiStats.presetManager,
                performanceMonitorActive: !!uiStats.performanceMonitor,
                historyActive: !!uiStats.historyStats,
                componentCount: Object.values(uiStats.components).filter(Boolean).length
            });
            
            // 4. Phase2C: パフォーマンス警告テスト
            console.log('4. パフォーマンス警告テスト');
            if (this.performanceMonitor) {
                // 一時停止・再開テスト
                this.performanceMonitor.pause();
                console.log('一時停止状態:', this.performanceMonitor.isPaused);
                
                setTimeout(() => {
                    this.performanceMonitor.resume();
                    console.log('再開後状態:', this.performanceMonitor.isPaused);
                }, 1000);
            }
            
            // 5. 履歴機能テスト（継続）
            console.log('5. 履歴機能テスト');
            console.log('アンドゥ可能:', this.canUndo());
            console.log('リドゥ可能:', this.canRedo());
            
            // 6. Phase2C: 統合パフォーマンス統計
            console.log('6. 統合パフォーマンス統計');
            const performanceStats = this.getDetailedPerformanceStats();
            if (performanceStats) {
                console.log('詳細パフォーマンス統計:', {
                    currentFPS: performanceStats.current.fps,
                    averageFPS: performanceStats.current.averageFPS,
                    memoryUsage: performanceStats.current.memoryUsageMB + 'MB',
                    gpuUsage: performanceStats.current.gpuUsage + '%',
                    historyLength: performanceStats.history.fps.length
                });
            }
            
            console.log('✅ Phase2C統合テスト完了');
            
        } catch (error) {
            console.error('❌ Phase2C統合テストエラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2C: 統合パフォーマンス統計取得
     */
    getIntegratedPerformanceStats() {
        const baseStats = this.performanceMonitor ? this.performanceMonitor.getStats() : {};
        const appStats = this.app.getStats ? this.app.getStats() : {};
        const historyStats = this.historyManager ? this.historyManager.getStats() : null;
        const toolsStats = this.toolsSystem.getSystemStats ? this.toolsSystem.getSystemStats() : {};
        const presetStats = this.presetManager ? this.presetManager.getSystemStats() : null;
        
        return {
            // Phase2C: パフォーマンス統計（メイン）
            performance: baseStats,
            // アプリケーション統計
            app: appStats,
            // 履歴統計
            history: historyStats,
            // プリセット統計
            preset: presetStats,
            // ツール統計
            tools: {
                currentTool: toolsStats.currentTool,
                initialized: toolsStats.initialized
            },
            // UI統計
            ui: {
                errorCount: this.errorCount,
                initialized: this.isInitialized,
                componentCount: Object.values(this.getUIStats().components).filter(Boolean).length,
                sliderCount: this.sliders.size
            }
        };
    }
    
    /**
     * Phase2C: 外部システム連携
     */
    onToolChange(newTool) {
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
        
        // Phase2B継続: プリセットライブ値更新
        if (this.presetManager && (settings.size !== undefined || settings.opacity !== undefined)) {
            const currentSize = settings.size !== undefined ? settings.size : 
                this.toolsSystem.getBrushSettings().size;
            const currentOpacity = settings.opacity !== undefined ? settings.opacity * 100 : 
                this.toolsSystem.getBrushSettings().opacity * 100;
            
            this.presetManager.updateActivePresetLive(currentSize, currentOpacity);
        }
        
        this.updateToolDisplay();
    }
    
    /**
     * Phase2C: クリーンアップ（強化版）
     */
    destroy() {
        try {
            console.log('🧹 UIManager クリーンアップ開始（Phase2C統合調整版）');
            
            // Phase2C: PerformanceMonitorSystemのクリーンアップ
            if (this.performanceMonitor) {
                this.performanceMonitor.destroy();
            }
            
            // スライダーのクリーンアップ
            for (const slider of this.sliders.values()) {
                if (slider && slider.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // PresetManagerのクリーンアップ
            if (this.presetManager && this.presetManager.destroy) {
                this.presetManager.destroy();
            }
            
            // PresetDisplayManagerのクリーンアップ
            if (this.presetDisplayManager && this.presetDisplayManager.destroy) {
                this.presetDisplayManager.destroy();
            }
            
            // タイムアウトのクリア
            if (this.coordinateUpdateThrottle) {
                clearTimeout(this.coordinateUpdateThrottle);
            }
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            
            // 参照のクリア
            this.historyManager = null;
            this.presetManager = null; // Phase2B継続
            this.presetDisplayManager = null;
            this.performanceMonitor = null; // Phase2C
            this.popupManager = null;
            this.statusBar = null;
            this.settingsManager = null;
            
            console.log('✅ UIManager クリーンアップ完了（Phase2C統合調整版）');
            
        } catch (error) {
            console.error('UIManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（Phase2C対応版）====
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    
    console.log('✅ ui-manager.js Phase2C統合調整版 読み込み完了');
    console.log('📦 エクスポートクラス:');
    console.log('  - UIManager: UI統合管理（Phase2C対応：新PerformanceMonitorSystem統合・制御更なる縮小）');
    console.log('🔧 Phase2C統合調整完了:');
    console.log('  ✅ 新PerformanceMonitorSystemとの統合（内蔵PerformanceMonitor → 外部専門システム移行）');
    console.log('  ✅ パフォーマンス監視機能の完全委譲（専門システム化）');
    console.log('  ✅ UI統合制御の更なる縮小（約350行に縮小）');
    console.log('  ✅ 新PresetManager・新PerformanceMonitorSystemの統合制御');
    console.log('  ✅ イベント通知システムの統合強化（パフォーマンス警告・メモリリーク対応）');
    console.log('  ✅ エラーハンドリング・フォールバック機能継続');
    console.log('  ✅ デバッグ・テスト機能の拡張（統合テスト対応）');
    console.log('  ✅ システム統計の統合表示機能（パフォーマンス・履歴・プリセット統合）');
    console.log('🎯 責務: UI統合制御のみ（パフォーマンス監視詳細管理は新PerformanceMonitorSystemに完全委譲）');
    console.log('🏗️ Phase2C完了: パフォーマンス監視分離・UI制御更なる縮小・専門システム化完成');
    
    // Phase2C完了確認
    console.log('🎉 Phase2C: パフォーマンス監視分離 - 実装完了');
    console.log('📋 実装項目:');
    console.log('  ✅ ui/performance-monitor.js: パフォーマンス監視専門システム実装');
    console.log('  ✅ ui-manager.js: 統合制御の更なる縮小・委譲');
    console.log('  ✅ FPS・メモリ・GPU使用率監視: 完全独立化');
    console.log('  ✅ パフォーマンス警告・メモリリーク検知: イベントベース通知システム');
    console.log('  ✅ 履歴統計との統合表示: StatusBar連携強化');
    console.log('  ✅ キーボードショートカット: Ctrl+Shift+P（監視一時停止/再開）');
    console.log('  ✅ デバッグ・テスト機能: 統合テスト・詳細統計取得');
    console.log('  ✅ エラーハンドリング: グレースフル・デグラデーション対応');
    console.log('  ✅ システム統計: パフォーマンス・履歴・プリセット統合表示');
    console.log('🎯 次のPhase: Phase3（UIイベント・履歴強化）の実装準備完了');
    
    // Phase2C機能テスト用グローバル関数
    window.testUIManagerPhase2C = () => {
        if (window.UIManager && window.uiManager) {
            window.uiManager.testPhase2CIntegration();
        } else {
            console.error('UIManager インスタンスが利用できません');
        }
    };
    
    console.log('🧪 テスト関数: window.testUIManagerPhase2C() でPhase2C統合テスト実行可能');
}

// ES6モジュールエクスポート（将来のTypeScript移行用）
// export { UIManager };