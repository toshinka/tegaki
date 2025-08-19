/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Task 1-B先行実装: slider-manager.js 重複排除・統一システム完全統合版
 * 🎯 DRY・SOLID原則完全準拠・スライダー統一管理
 * 
 * 🎯 AI_WORK_SCOPE: スライダー統一管理・増減ボタン・プリセット連携
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, EventBus（統一システム完全依存）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🚨 重複排除内容: 設定値統一・エラー処理統一・EventBus完全移行・冗長コード削除
 */

class SliderManager {
    constructor() {
        this.version = 'v1.0-Phase1-DRY-SOLID';
        this.validateUnifiedSystems();
        this.initializeConfig();
        
        // スライダー管理
        this.sliders = new Map();
        this.callbacks = { onChange: new Map() };
        this.throttleTimers = new Map();
        
        console.log('✅ 増減ボタン設定完了: ' + buttonCount + '個');
    }
    
    /**
     * プリセット検出・設定
     */
    discoverPresets() {
        if (!this.uiConfig.enablePresets) return;
        
        console.log('🔍 プリセット検出・設定開始...');
        
        const presetElements = document.querySelectorAll('.size-preset-item');
        let presetCount = 0;
        
        presetElements.forEach(element => {
            try {
                const sizeValue = parseFloat(element.dataset.size);
                if (!sizeValue || isNaN(sizeValue)) return;
                
                const presetHandler = () => {
                    this.applyPreset('pen-size', sizeValue);
                    this.updatePresetVisualState(element);
                    
                    window.EventBus.safeEmit('preset.selected', {
                        sliderId: 'pen-size',
                        presetValue: sizeValue,
                        element: element
                    });
                };
                
                element.addEventListener('click', presetHandler);
                presetCount++;
                
            } catch (error) {
                window.ErrorManager.showError('warning', 'プリセット設定エラー: ' + error.message);
            }
        });
        
        console.log('✅ プリセット設定完了: ' + presetCount + '個');
    }
    
    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        console.log('⌨️ スライダーキーボードショートカット設定...');
        
        const keyboardHandler = (event) => {
            let handled = false;
            
            // ブラシサイズショートカット
            if (event.key === '[') {
                event.preventDefault();
                this.adjustSliderValue('pen-size', -1);
                handled = true;
            } else if (event.key === ']') {
                event.preventDefault();
                this.adjustSliderValue('pen-size', 1);
                handled = true;
            }
            // 不透明度ショートカット
            else if (event.key === '-' && event.ctrlKey) {
                event.preventDefault();
                this.adjustSliderValue('pen-opacity', -5);
                handled = true;
            } else if (event.key === '=' && event.ctrlKey) {
                event.preventDefault();
                this.adjustSliderValue('pen-opacity', 5);
                handled = true;
            }
            
            if (handled) {
                window.EventBus.safeEmit('slider.keyboard.shortcut', {
                    key: event.key,
                    ctrlKey: event.ctrlKey
                });
            }
        };
        
        document.addEventListener('keydown', keyboardHandler);
        console.log('✅ キーボードショートカット設定完了');
    }
    
    /**
     * EventBus統合設定
     */
    setupEventBusIntegration() {
        window.EventBus.on('slider.setValue', (data) => {
            if (data.sliderId && data.value !== undefined) {
                this.setSliderValue(data.sliderId, data.value);
            }
        });
        
        window.EventBus.on('slider.adjustValue', (data) => {
            if (data.sliderId && data.delta !== undefined) {
                this.adjustSliderValue(data.sliderId, data.delta);
            }
        });
        
        console.log('✅ EventBus統合設定完了');
    }
    
    /**
     * 初期値設定
     */
    setupInitialValues() {
        this.sliders.forEach((sliderInfo, sliderId) => {
            this.setSliderValue(sliderId, sliderInfo.config.default, false);
        });
        
        console.log('✅ スライダー初期値設定完了');
    }
    
    // ==========================================
    // 🚨 重複排除: 公開API（統一版）
    // ==========================================
    
    /**
     * スライダー値設定
     */
    setSliderValue(sliderId, value, triggerCallback = true) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) {
            window.ErrorManager.showError('warning', '不明なスライダー: ' + sliderId);
            return false;
        }
        
        try {
            const config = sliderInfo.config;
            
            // 値の制約
            const constrainedValue = Math.max(config.min, Math.min(config.max, value));
            
            // 状態更新
            sliderInfo.state.currentValue = constrainedValue;
            sliderInfo.state.displayValue = this.formatDisplayValue(constrainedValue, config);
            sliderInfo.state.lastUpdateTime = performance.now();
            
            // UI更新（スロットル処理）
            this.throttledUIUpdate(sliderId);
            
            // コールバック実行
            if (triggerCallback) {
                this.triggerCallbacks(sliderId, constrainedValue);
            }
            
            // EventBus統合: スライダー値変更イベント
            if (triggerCallback) {
                window.EventBus.safeEmit('slider.value.changed', {
                    sliderId: sliderId,
                    value: this.getSliderValue(sliderId, true),
                    displayValue: constrainedValue
                });
            }
            
            return true;
            
        } catch (error) {
            window.ErrorManager.showError('error', 'スライダー値設定エラー ' + sliderId + ': ' + error.message);
            return false;
        }
    }
    
    /**
     * スライダー値取得
     */
    getSliderValue(sliderId, useMultiplier = true) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return null;
        
        let value = sliderInfo.state.currentValue;
        
        // 値乗数適用（0-1範囲の場合）
        if (useMultiplier && sliderInfo.config.valueMultiplier) {
            value *= sliderInfo.config.valueMultiplier;
        }
        
        return value;
    }
    
    /**
     * スライダー値調整
     */
    adjustSliderValue(sliderId, delta) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return false;
        
        const currentValue = sliderInfo.state.currentValue;
        const newValue = currentValue + delta;
        
        return this.setSliderValue(sliderId, newValue);
    }
    
    /**
     * プリセット適用
     */
    applyPreset(sliderId, value) {
        console.log('🎚️ プリセット適用: ' + sliderId + ' = ' + value);
        
        const result = this.setSliderValue(sliderId, value);
        
        if (result) {
            window.EventBus.safeEmit('preset.applied', {
                sliderId: sliderId,
                presetValue: value,
                finalValue: this.getSliderValue(sliderId)
            });
        }
        
        return result;
    }
    
    /**
     * コールバック登録
     */
    addChangeCallback(sliderId, callback) {
        if (!this.callbacks.onChange.has(sliderId)) {
            this.callbacks.onChange.set(sliderId, []);
        }
        
        this.callbacks.onChange.get(sliderId).push(callback);
        console.log('📞 コールバック登録: ' + sliderId);
    }
    
    /**
     * コールバック削除
     */
    removeChangeCallback(sliderId, callback) {
        const callbacks = this.callbacks.onChange.get(sliderId);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    // ==========================================
    // 内部処理メソッド
    // ==========================================
    
    /**
     * スロットル処理付きUI更新
     */
    throttledUIUpdate(sliderId) {
        // 既存のタイマーをクリア
        if (this.throttleTimers.has(sliderId)) {
            clearTimeout(this.throttleTimers.get(sliderId));
        }
        
        // 新しいタイマーを設定
        const timer = setTimeout(() => {
            this.updateSliderUI(sliderId);
            this.throttleTimers.delete(sliderId);
        }, this.uiConfig.updateThrottle);
        
        this.throttleTimers.set(sliderId, timer);
    }
    
    /**
     * イベントからスライダー更新
     */
    updateSliderFromEvent(sliderId, event) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return;
        
        const sliderRect = sliderInfo.elements.slider.getBoundingClientRect();
        const sliderWidth = sliderRect.width;
        const clickX = event.clientX - sliderRect.left;
        
        // 位置から値を計算
        const ratio = Math.max(0, Math.min(1, clickX / sliderWidth));
        const config = sliderInfo.config;
        const newValue = config.min + (config.max - config.min) * ratio;
        
        this.setSliderValue(sliderId, newValue);
    }
    
    /**
     * スライダーUI更新
     */
    updateSliderUI(sliderId) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return;
        
        const { track, handle, value } = sliderInfo.elements;
        const config = sliderInfo.config;
        const currentValue = sliderInfo.state.currentValue;
        
        // ハンドル位置計算
        const ratio = (currentValue - config.min) / (config.max - config.min);
        const percentage = Math.max(0, Math.min(100, ratio * 100));
        
        // ハンドル位置更新
        if (handle) {
            handle.style.left = percentage + '%';
        }
        
        // トラック塗りつぶし更新
        if (track) {
            track.style.width = percentage + '%';
        }
        
        // 値表示更新
        if (value) {
            value.textContent = sliderInfo.state.displayValue;
        }
    }
    
    /**
     * 表示値フォーマット
     */
    formatDisplayValue(value, config) {
        const precision = config.precision || 1;
        const unit = config.unit || '';
        
        return value.toFixed(precision) + unit;
    }
    
    /**
     * スライダー値確定
     */
    finalizeSliderValue(sliderId) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return;
        
        // 最終的なコールバック実行
        this.triggerCallbacks(sliderId, sliderInfo.state.currentValue);
        
        console.log('🎚️ スライダー値確定: ' + sliderId + ' = ' + sliderInfo.state.displayValue);
    }
    
    /**
     * コールバック実行
     */
    triggerCallbacks(sliderId, value) {
        const callbacks = this.callbacks.onChange.get(sliderId);
        if (!callbacks || callbacks.length === 0) return;
        
        // 内部値取得（乗数適用）
        const internalValue = this.getSliderValue(sliderId, true);
        
        callbacks.forEach(callback => {
            try {
                callback({
                    sliderId: sliderId,
                    value: internalValue,
                    displayValue: value,
                    timestamp: performance.now()
                });
            } catch (error) {
                window.ErrorManager.showError('warning', 'コールバック実行エラー ' + sliderId + ': ' + error.message);
            }
        });
    }
    
    /**
     * プリセット視覚状態更新
     */
    updatePresetVisualState(activeElement) {
        // 他のプリセットのactive状態をクリア
        const allPresets = document.querySelectorAll('.size-preset-item');
        allPresets.forEach(preset => preset.classList.remove('active'));
        
        // アクティブプリセット設定
        if (activeElement) {
            activeElement.classList.add('active');
        }
    }
    
    /**
     * 全スライダー値取得
     */
    getAllValues() {
        const values = {};
        
        this.sliders.forEach((sliderInfo, sliderId) => {
            values[sliderId] = {
                raw: sliderInfo.state.currentValue,
                internal: this.getSliderValue(sliderId, true),
                display: sliderInfo.state.displayValue
            };
        });
        
        return values;
    }
    
    /**
     * スライダー設定更新
     */
    updateSliderConfig(sliderId, newConfig) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return false;
        
        try {
            // 設定マージ
            sliderInfo.config = { ...sliderInfo.config, ...newConfig };
            
            // ConfigManagerへの保存
            if (window.ConfigManager) {
                Object.entries(newConfig).forEach(([key, value]) => {
                    const configPath = this.getSliderConfigPath(sliderId, key);
                    if (configPath) {
                        window.ConfigManager.set(configPath, value);
                    }
                });
            }
            
            // UI更新
            this.updateSliderUI(sliderId);
            
            window.EventBus.safeEmit('slider.config.updated', { sliderId: sliderId, newConfig: newConfig });
            
            console.log('🎚️ スライダー設定更新: ' + sliderId, newConfig);
            return true;
            
        } catch (error) {
            window.ErrorManager.showError('error', 'スライダー設定更新エラー ' + sliderId + ': ' + error.message);
            return false;
        }
    }
    
    /**
     * スライダー設定パス取得
     */
    getSliderConfigPath(sliderId, configKey) {
        const pathMap = {
            'pen-size': {
                'min': 'drawing.pen.minSize',
                'max': 'drawing.pen.maxSize',
                'default': 'drawing.pen.defaultSize'
            },
            'pen-opacity': {
                'default': 'drawing.pen.defaultOpacity'
            },
            'pen-pressure': {
                'default': 'drawing.pen.defaultPressure'
            },
            'pen-smoothing': {
                'default': 'drawing.pen.defaultSmoothing'
            }
        };
        
        return pathMap[sliderId] && pathMap[sliderId][configKey] || null;
    }
    
    /**
     * 🚨 重複排除: 健全性チェック（統一版）
     */
    healthCheck() {
        const stats = this.getStats();
        const warnings = [];
        const recommendations = [];
        
        if (!stats.unifiedSystems.configManager) {
            warnings.push('ConfigManager未接続');
            recommendations.push('ConfigManagerを初期化してください');
        }
        
        if (!stats.unifiedSystems.errorManager) {
            warnings.push('ErrorManager未接続');
            recommendations.push('ErrorManagerを初期化してください');
        }
        
        if (!stats.unifiedSystems.eventBus) {
            warnings.push('EventBus未接続');
            recommendations.push('EventBusを初期化してください');
        }
        
        if (stats.total === 0) {
            warnings.push('スライダー未検出');
        }
        
        if (stats.callbacks > 50) {
            warnings.push('コールバック数が多すぎる: ' + stats.callbacks);
            recommendations.push('不要なコールバックを削除してください');
        }
        
        const healthy = warnings.length === 0;
        
        return {
            healthy: healthy,
            stats: stats,
            warnings: warnings,
            recommendations: recommendations,
            timestamp: Date.now()
        };
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        const totalSliders = this.sliders.size;
        const activeSliders = Array.from(this.sliders.values())
            .filter(info => info.state.isDragging).length;
        const totalCallbacks = Array.from(this.callbacks.onChange.values())
            .reduce((sum, callbacks) => sum + callbacks.length, 0);
        
        return {
            version: this.version,
            unifiedSystems: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus
            },
            total: totalSliders,
            active: activeSliders,
            callbacks: totalCallbacks,
            lastUpdate: Math.max(...Array.from(this.sliders.values())
                .map(info => info.state.lastUpdateTime)),
            config: { ...this.uiConfig }
        };
    }
    
    /**
     * クリーンアップ
     */
    cleanup() {
        try {
            // スロットルタイマークリア
            this.throttleTimers.forEach(timer => clearTimeout(timer));
            this.throttleTimers.clear();
            
            window.EventBus.safeEmit('slider.manager.cleanup', {
                totalSliders: this.sliders.size,
                version: this.version
            });
            
            console.log('🎚️ SliderManager クリーンアップ完了（DRY・SOLID準拠版）');
            
        } catch (error) {
            window.ErrorManager.showError('warning', 'SliderManagerクリーンアップエラー: ' + error.message);
        }
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.SliderManager = SliderManager;
    
    // デバッグ用ヘルパー関数
    window.testSliderManager = () => {
        if (window.SliderManager) {
            const manager = new SliderManager();
            manager.initialize();
            return manager.healthCheck();
        }
        return { error: 'SliderManager未初期化' };
    };
    
    window.getSliderStats = () => {
        if (window.sliderManager) {
            return window.sliderManager.getStats();
        }
        return { error: 'SliderManagerインスタンス未作成' };
    };
    
    window.getAllSliderValues = () => {
        if (window.sliderManager) {
            return window.sliderManager.getAllValues();
        }
        return { error: 'SliderManagerインスタンス未作成' };
    };
    
    console.log('✅ SliderManager DRY・SOLID準拠版 グローバル公開完了');
    console.log('💡 使用例: const sm = new SliderManager(); sm.initialize();');
    console.log('🔧 デバッグ: window.testSliderManager() で動作確認');
    console.log('📊 値確認: window.getAllSliderValues() でスライダー値一覧取得');
}🎚️ SliderManager 構築完了（DRY・SOLID準拠版）');
    }
    
    /**
     * 🚨 統一システム依存性確認（必須前提条件）
     */
    validateUnifiedSystems() {
        const requiredSystems = ['ConfigManager', 'ErrorManager', 'EventBus'];
        const missing = requiredSystems.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error('SliderManager統一システム依存性エラー: ' + missing.join(', '));
        }
        
        console.log('✅ SliderManager統一システム依存性確認完了');
    }
    
    /**
     * 🚨 重複排除: ConfigManager統一設定読み込み
     */
    initializeConfig() {
        const drawingConfig = window.ConfigManager.getDrawingConfig();
        const uiConfig = window.ConfigManager.getUIConfig();
        
        this.sliderConfigs = {
            'pen-size': {
                min: drawingConfig.pen.minSize,
                max: drawingConfig.pen.maxSize,
                default: drawingConfig.pen.defaultSize,
                step: 0.1,
                precision: 1,
                unit: 'px',
                increments: { small: 0.1, medium: 1, large: 10 }
            },
            'pen-opacity': {
                min: 0.0,
                max: 100.0,
                default: drawingConfig.pen.defaultOpacity * 100,
                step: 0.1,
                precision: 1,
                unit: '%',
                valueMultiplier: 0.01,
                increments: { small: 0.1, medium: 1, large: 10 }
            },
            'pen-pressure': {
                min: 0.0,
                max: 100.0,
                default: drawingConfig.pen.defaultPressure * 100,
                step: 0.1,
                precision: 1,
                unit: '%',
                valueMultiplier: 0.01,
                increments: { small: 0.1, medium: 1, large: 10 }
            },
            'pen-smoothing': {
                min: 0.0,
                max: 100.0,
                default: drawingConfig.pen.defaultSmoothing * 100,
                step: 0.1,
                precision: 1,
                unit: '%',
                valueMultiplier: 0.01,
                increments: { small: 0.1, medium: 1, large: 10 }
            }
        };
        
        this.uiConfig = {
            updateThrottle: uiConfig.slider?.updateThrottle || 16,
            enableKeyboard: uiConfig.slider?.enableKeyboard || true,
            enableWheel: uiConfig.slider?.enableWheel || true,
            enablePresets: uiConfig.slider?.enablePresets || true
        };
    }
    
    /**
     * 🚨 重複排除: 統一初期化
     */
    initialize() {
        console.log('🎚️ SliderManager 統一初期化開始（DRY・SOLID準拠版）');
        
        try {
            this.discoverSliders();
            this.setupIncrementButtons();
            this.discoverPresets();
            
            if (this.uiConfig.enableKeyboard) {
                this.setupKeyboardShortcuts();
            }
            
            this.setupInitialValues();
            this.setupEventBusIntegration();
            
            window.EventBus.safeEmit('slider.manager.initialized', {
                sliderCount: this.sliders.size,
                version: this.version
            });
            
            console.log('✅ SliderManager統一初期化完了: ' + this.sliders.size + '個のスライダー');
            return this;
            
        } catch (error) {
            window.ErrorManager.showError('error', 'SliderManager初期化エラー: ' + error.message, {
                showReload: true
            });
            return this;
        }
    }
    
    /**
     * 既存スライダー自動検出
     */
    discoverSliders() {
        console.log('🔍 既存スライダー自動検出開始...');
        
        let discoveredCount = 0;
        
        Object.keys(this.sliderConfigs).forEach(sliderId => {
            try {
                const sliderElement = document.getElementById(sliderId + '-slider');
                if (!sliderElement) {
                    console.warn('⚠️ スライダー要素未検出: ' + sliderId);
                    return;
                }
                
                const trackElement = sliderElement.querySelector('.slider-track');
                const handleElement = sliderElement.querySelector('.slider-handle');
                const valueElement = sliderElement.parentNode.querySelector('.slider-value');
                
                const config = this.sliderConfigs[sliderId];
                const sliderInfo = this.createSliderInfo(sliderId, sliderElement, trackElement, handleElement, valueElement, config);
                
                this.sliders.set(sliderId, sliderInfo);
                this.setupSliderEvents(sliderId);
                
                discoveredCount++;
                
            } catch (error) {
                window.ErrorManager.showError('warning', 'スライダー検出エラー ' + sliderId + ': ' + error.message);
            }
        });
        
        console.log('✅ スライダー自動検出完了: ' + discoveredCount + '個');
        
        window.EventBus.safeEmit('slider.discovery.completed', {
            discoveredCount: discoveredCount,
            sliderIds: Array.from(this.sliders.keys())
        });
    }
    
    /**
     * スライダー情報作成
     */
    createSliderInfo(sliderId, sliderElement, trackElement, handleElement, valueElement, config) {
        const currentValue = config.default;
        
        return {
            id: sliderId,
            config: { ...config },
            elements: {
                slider: sliderElement,
                track: trackElement,
                handle: handleElement,
                value: valueElement
            },
            state: {
                currentValue: currentValue,
                displayValue: this.formatDisplayValue(currentValue, config),
                isDragging: false,
                lastUpdateTime: 0
            }
        };
    }
    
    /**
     * 🚨 重複排除: スライダーイベント設定
     */
    setupSliderEvents(sliderId) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo || !sliderInfo.elements.slider) return;
        
        const { slider, handle } = sliderInfo.elements;
        
        // マウスダウン（ドラッグ開始）
        const mousedownHandler = (event) => {
            event.preventDefault();
            sliderInfo.state.isDragging = true;
            
            this.updateSliderFromEvent(sliderId, event);
            
            if (handle) {
                handle.classList.add('dragging');
            }
            
            document.body.style.userSelect = 'none';
            window.EventBus.safeEmit('slider.drag.started', { sliderId: sliderId });
        };
        
        // マウス移動（ドラッグ中）
        const mousemoveHandler = (event) => {
            if (!sliderInfo.state.isDragging) return;
            this.updateSliderFromEvent(sliderId, event);
        };
        
        // マウスアップ（ドラッグ終了）
        const mouseupHandler = (event) => {
            if (sliderInfo.state.isDragging) {
                sliderInfo.state.isDragging = false;
                
                if (handle) {
                    handle.classList.remove('dragging');
                }
                
                document.body.style.userSelect = '';
                this.finalizeSliderValue(sliderId);
                
                window.EventBus.safeEmit('slider.drag.ended', { 
                    sliderId: sliderId, 
                    value: this.getSliderValue(sliderId) 
                });
            }
        };
        
        // ホイールイベント（微調整）
        const wheelHandler = (event) => {
            if (!this.uiConfig.enableWheel) return;
            
            event.preventDefault();
            
            const config = sliderInfo.config;
            const delta = event.deltaY > 0 ? -config.step : config.step;
            
            this.adjustSliderValue(sliderId, delta);
        };
        
        // イベント登録
        slider.addEventListener('mousedown', mousedownHandler);
        document.addEventListener('mousemove', mousemoveHandler);
        document.addEventListener('mouseup', mouseupHandler);
        
        if (this.uiConfig.enableWheel) {
            slider.addEventListener('wheel', wheelHandler, { passive: false });
        }
        
        console.log('✅ スライダーイベント設定: ' + sliderId);
    }
    
    /**
     * 🚨 重複排除: 増減ボタン検出・設定
     */
    setupIncrementButtons() {
        console.log('🔍 増減ボタン検出・設定開始...');
        
        let buttonCount = 0;
        
        this.sliders.forEach((sliderInfo, sliderId) => {
            const config = sliderInfo.config;
            const increments = config.increments;
            
            Object.entries(increments).forEach(([incrementType, incrementValue]) => {
                // 減少ボタン
                const decreaseButton = document.getElementById(sliderId + '-decrease-' + incrementType);
                if (decreaseButton) {
                    const decreaseHandler = () => {
                        this.adjustSliderValue(sliderId, -incrementValue);
                        
                        window.EventBus.safeEmit('slider.button.clicked', {
                            sliderId: sliderId,
                            action: 'decrease',
                            increment: incrementType,
                            value: this.getSliderValue(sliderId)
                        });
                    };
                    decreaseButton.addEventListener('click', decreaseHandler);
                    buttonCount++;
                }
                
                // 増加ボタン
                const increaseButton = document.getElementById(sliderId + '-increase-' + incrementType);
                if (increaseButton) {
                    const increaseHandler = () => {
                        this.adjustSliderValue(sliderId, incrementValue);
                        
                        window.EventBus.safeEmit('slider.button.clicked', {
                            sliderId: sliderId,
                            action: 'increase',
                            increment: incrementType,
                            value: this.getSliderValue(sliderId)
                        });
                    };
                    increaseButton.addEventListener('click', increaseHandler);
                    buttonCount++;
                }
            });
        });
        
        console.log('