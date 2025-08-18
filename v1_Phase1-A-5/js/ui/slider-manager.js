/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Task 1-A-5: slider-manager.js 統一システム統合版
 * 
 * 🎯 AI_WORK_SCOPE: スライダー統一管理・増減ボタン・プリセット連携・リアルタイム更新
 * 🎯 DEPENDENCIES: 
 *    - ConfigManager（設定値統合）
 *    - ErrorManager（エラー処理統一）
 *    - EventBus（疎結合通信）
 * 🎯 NODE_MODULES: lodash（値管理最適化）
 * 🎯 PIXI_EXTENSIONS: なし（DOM操作専用）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 
 * 📋 PHASE_TARGET: Phase1.4-A5 - 統一システム完全統合
 * 📋 DRY_COMPLIANCE: ✅ 統一システム活用・重複コード排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 * 📋 UNIFIED_SYSTEMS: ✅ ConfigManager + ErrorManager + EventBus
 */

/**
 * Task 1-A-5: スライダー統一管理システム（統一システム統合版）
 * 🚨 統合機能:
 * 1. ConfigManager統合: スライダー設定値の一元管理
 * 2. ErrorManager統合: エラー処理の統一
 * 3. EventBus統合: 疎結合イベント通信
 * 4. `pen-size`, `pen-opacity`, `pen-pressure`, `pen-smoothing` スライダー管理
 * 5. 増減ボタン（`-decrease-small`, `-decrease`, `-decrease-large` など）対応
 * 6. プリセットサイズボタン（`.size-preset-item`）連携
 * 7. リアルタイム値更新とUI反映
 * 8. コールバック機能でツール設定連携
 * 9. キーボードショートカット対応
 */
class SliderManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-A5-Unified';
        this.name = 'slider-manager';
        
        // 🚨 統一システム依存性確認
        this.configManager = window.ConfigManager;
        this.errorManager = window.ErrorManager;
        this.eventBus = window.EventBus;
        
        if (!this.configManager || !this.errorManager || !this.eventBus) {
            this._handleMissingDependencies();
        }
        
        // スライダー管理
        this.sliders = new Map(); // slider-id -> SliderInfo
        this.presets = new Map(); // preset-group -> PresetInfo
        
        // 🚨 ConfigManager統合: スライダー設定定義
        this.sliderConfigs = this._buildSliderConfigs();
        
        // 🚨 ConfigManager統合: UI設定
        this.uiConfig = {
            updateThrottle: this._getConfig('ui.slider.updateThrottle', 16), // 約60FPS
            keyboardShortcuts: this._getConfig('ui.keyboard.shortcuts', {}),
            precision: this._getConfig('ui.slider.precision', { size: 1, percentage: 1 }),
            enableKeyboard: this._getConfig('ui.slider.enableKeyboard', true),
            enableWheel: this._getConfig('ui.slider.enableWheel', true),
            enablePresets: this._getConfig('ui.slider.enablePresets', true)
        };
        
        // コールバック管理
        this.callbacks = {
            onChange: new Map(), // slider-id -> callback[]
            onPresetChange: new Map() // preset-group -> callback[]
        };
        
        // 拡張ライブラリ確認
        this.lodashAvailable = typeof window._ !== 'undefined';
        
        // イベントリスナー管理
        this.eventListeners = new Map(); // element -> listener
        
        // スロットル処理用
        this.throttleTimers = new Map();
        
        console.log(`🎚️ SliderManager 統一システム統合版構築 - ${this.version}`);
    }
    
    /**
     * 🚨 ConfigManager統合: スライダー設定構築
     */
    _buildSliderConfigs() {
        return {
            'pen-size': {
                min: this._getConfig('drawing.pen.minSize', 0.1),
                max: this._getConfig('drawing.pen.maxSize', 100.0),
                default: this._getConfig('drawing.pen.defaultSize', 16.0),
                step: 0.1,
                precision: 1,
                unit: 'px',
                increments: {
                    small: 0.1,
                    medium: 1,
                    large: 10
                }
            },
            'pen-opacity': {
                min: 0.0,
                max: 100.0,
                default: this._getConfig('drawing.pen.defaultOpacity', 0.85) * 100, // 内部は0-1、表示は0-100
                step: 0.1,
                precision: 1,
                unit: '%',
                valueMultiplier: 0.01, // 内部値は0-1
                increments: {
                    small: 0.1,
                    medium: 1,
                    large: 10
                }
            },
            'pen-pressure': {
                min: 0.0,
                max: 100.0,
                default: this._getConfig('drawing.pen.defaultPressure', 0.5) * 100, // 内部は0-1、表示は0-100
                step: 0.1,
                precision: 1,
                unit: '%',
                valueMultiplier: 0.01, // 内部値は0-1
                increments: {
                    small: 0.1,
                    medium: 1,
                    large: 10
                }
            },
            'pen-smoothing': {
                min: 0.0,
                max: 100.0,
                default: this._getConfig('drawing.pen.defaultSmoothing', 0.3) * 100, // 内部は0-1、表示は0-100
                step: 0.1,
                precision: 1,
                unit: '%',
                valueMultiplier: 0.01, // 内部値は0-1
                increments: {
                    small: 0.1,
                    medium: 1,
                    large: 10
                }
            }
        };
    }
    
    /**
     * 🚨 統一システム統合: 初期化
     */
    initialize() {
        console.group(`🎚️ SliderManager 統一システム統合初期化 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存性最終確認
            this._validateUnifiedSystems();
            
            // Phase 2: スライダー検出・設定
            this.discoverSliders();
            
            // Phase 3: 増減ボタン検出・設定
            this.setupIncrementButtons();
            
            // Phase 4: プリセット検出・設定
            this.discoverPresets();
            
            // Phase 5: キーボードショートカット設定
            if (this.uiConfig.enableKeyboard) {
                this.setupKeyboardShortcuts();
            }
            
            // Phase 6: 初期値設定
            this.setupInitialValues();
            
            // Phase 7: EventBus統合
            this._setupEventBusIntegration();
            
            const initTime = performance.now() - startTime;
            
            // 🚨 EventBus統合: 初期化完了イベント発行
            this._emitEvent('SLIDER_MANAGER_INITIALIZED', {
                sliderCount: this.sliders.size,
                initTime: initTime
            });
            
            console.log(`✅ SliderManager統一システム統合初期化完了 - ${initTime.toFixed(2)}ms`);
            return this;
            
        } catch (error) {
            // 🚨 ErrorManager統合: エラー処理の統一
            this._showError('error', `SliderManager初期化エラー: ${error.message}`, {
                showReload: true,
                additionalInfo: error.stack
            });
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🚨 統一システム統合: 依存性確認
     */
    _validateUnifiedSystems() {
        const missingDeps = [];
        
        if (!this.configManager) missingDeps.push('ConfigManager');
        if (!this.errorManager) missingDeps.push('ErrorManager');
        if (!this.eventBus) missingDeps.push('EventBus');
        
        if (missingDeps.length > 0) {
            const errorMsg = `統一システム依存性不足: ${missingDeps.join(', ')}`;
            console.error('❌', errorMsg);
            
            // フォールバックエラー処理
            if (typeof alert !== 'undefined') {
                alert(`SliderManager: ${errorMsg}\n\n統一システムが正しく初期化されていません。`);
            }
            
            throw new Error(errorMsg);
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 🚨 統一システム統合: 既存スライダー自動検出
     */
    discoverSliders() {
        console.log('🔍 既存スライダー自動検出開始...');
        
        let discoveredCount = 0;
        
        Object.keys(this.sliderConfigs).forEach(sliderId => {
            try {
                const sliderElement = document.getElementById(`${sliderId}-slider`);
                const trackElement = document.getElementById(`${sliderId}-track`);
                const handleElement = document.getElementById(`${sliderId}-handle`);
                const valueElement = document.getElementById(`${sliderId}-value`);
                
                if (!sliderElement) {
                    console.warn(`⚠️ スライダー要素未検出: ${sliderId}`);
                    return;
                }
                
                const config = this.sliderConfigs[sliderId];
                const sliderInfo = this.createSliderInfo(sliderId, sliderElement, trackElement, handleElement, valueElement, config);
                
                this.sliders.set(sliderId, sliderInfo);
                
                // イベントリスナー設定
                this.setupSliderEvents(sliderId);
                
                discoveredCount++;
                
            } catch (error) {
                // 🚨 ErrorManager統合
                this._showError('warning', `スライダー検出エラー ${sliderId}: ${error.message}`);
            }
        });
        
        console.log(`✅ スライダー自動検出完了: ${discoveredCount}個`);
        
        if (discoveredCount > 0) {
            const sliderIds = Array.from(this.sliders.keys());
            console.log(`📋 検出されたスライダー: [${sliderIds.join(', ')}]`);
        }
        
        // 🚨 EventBus統合: 検出完了イベント
        this._emitEvent('SLIDER_DISCOVERY_COMPLETED', {
            discoveredCount,
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
            },
            events: {
                mousedown: null,
                mousemove: null,
                mouseup: null,
                wheel: null
            }
        };
    }
    
    /**
     * 🚨 統一システム統合: スライダーイベント設定
     */
    setupSliderEvents(sliderId) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo || !sliderInfo.elements.slider) return;
        
        const { slider, track, handle } = sliderInfo.elements;
        
        // マウスダウン（ドラッグ開始）
        const mousedownHandler = (event) => {
            event.preventDefault();
            sliderInfo.state.isDragging = true;
            
            // ハンドル位置更新
            this.updateSliderFromEvent(sliderId, event);
            
            // ドラッグ状態の視覚フィードバック
            if (handle) {
                handle.classList.add('dragging');
            }
            
            document.body.style.userSelect = 'none';
            
            // 🚨 EventBus統合: スライダードラッグ開始イベント
            this._emitEvent('SLIDER_DRAG_STARTED', { sliderId });
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
                
                // 最終値確定
                this.finalizeSliderValue(sliderId);
                
                // 🚨 EventBus統合: スライダードラッグ終了イベント
                this._emitEvent('SLIDER_DRAG_ENDED', { sliderId, value: this.getSliderValue(sliderId) });
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
        
        // イベント保存（クリーンアップ用）
        sliderInfo.events.mousedown = mousedownHandler;
        sliderInfo.events.mousemove = mousemoveHandler;
        sliderInfo.events.mouseup = mouseupHandler;
        sliderInfo.events.wheel = wheelHandler;
        
        console.log(`✅ スライダーイベント設定: ${sliderId}`);
    }
    
    /**
     * 🚨 統一システム統合: 増減ボタン検出・設定
     */
    setupIncrementButtons() {
        console.log('🔍 増減ボタン検出・設定開始...');
        
        let buttonCount = 0;
        
        this.sliders.forEach((sliderInfo, sliderId) => {
            const config = sliderInfo.config;
            const increments = config.increments;
            
            // 各増減タイプの処理
            Object.entries(increments).forEach(([incrementType, incrementValue]) => {
                // 減少ボタン
                const decreaseButton = document.getElementById(`${sliderId}-decrease-${incrementType}`);
                if (decreaseButton) {
                    const decreaseHandler = () => {
                        this.adjustSliderValue(sliderId, -incrementValue);
                        
                        // 🚨 EventBus統合: ボタン操作イベント
                        this._emitEvent('SLIDER_BUTTON_CLICKED', {
                            sliderId,
                            action: 'decrease',
                            increment: incrementType,
                            value: this.getSliderValue(sliderId)
                        });
                    };
                    decreaseButton.addEventListener('click', decreaseHandler);
                    this.eventListeners.set(decreaseButton, decreaseHandler);
                    buttonCount++;
                }
                
                // 増加ボタン
                const increaseButton = document.getElementById(`${sliderId}-increase-${incrementType}`);
                if (increaseButton) {
                    const increaseHandler = () => {
                        this.adjustSliderValue(sliderId, incrementValue);
                        
                        // 🚨 EventBus統合: ボタン操作イベント
                        this._emitEvent('SLIDER_BUTTON_CLICKED', {
                            sliderId,
                            action: 'increase',
                            increment: incrementType,
                            value: this.getSliderValue(sliderId)
                        });
                    };
                    increaseButton.addEventListener('click', increaseHandler);
                    this.eventListeners.set(increaseButton, increaseHandler);
                    buttonCount++;
                }
            });
        });
        
        console.log(`✅ 増減ボタン設定完了: ${buttonCount}個`);
    }
    
    /**
     * 🚨 統一システム統合: プリセット検出・設定
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
                    
                    // 🚨 EventBus統合: プリセット選択イベント
                    this._emitEvent('PRESET_SELECTED', {
                        sliderId: 'pen-size',
                        presetValue: sizeValue,
                        element: element
                    });
                };
                
                element.addEventListener('click', presetHandler);
                this.eventListeners.set(element, presetHandler);
                
                presetCount++;
                
            } catch (error) {
                this._showError('warning', `プリセット設定エラー: ${error.message}`);
            }
        });
        
        console.log(`✅ プリセット設定完了: ${presetCount}個`);
    }
    
    /**
     * 🚨 統一システム統合: キーボードショートカット設定
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
            
            // 🚨 EventBus統合: キーボードショートカットイベント
            if (handled) {
                this._emitEvent('SLIDER_KEYBOARD_SHORTCUT', {
                    key: event.key,
                    ctrlKey: event.ctrlKey,
                    timestamp: Date.now()
                });
            }
        };
        
        document.addEventListener('keydown', keyboardHandler);
        this.eventListeners.set(document, keyboardHandler);
        
        console.log('✅ キーボードショートカット設定完了');
    }
    
    /**
     * 🚨 統一システム統合: EventBus統合設定
     */
    _setupEventBusIntegration() {
        // 標準イベントリスナー設定
        if (this.eventBus && this.eventBus.Events) {
            // スライダー関連イベントのリスナー設定
            this.eventBus.on(this.eventBus.Events.SLIDER_CHANGED, (data) => {
                console.log('📡 EventBus: SLIDER_CHANGED受信', data);
            });
            
            this.eventBus.on(this.eventBus.Events.PRESET_SELECTED, (data) => {
                console.log('📡 EventBus: PRESET_SELECTED受信', data);
            });
            
            // ツール変更イベントのリスナー（スライダー設定の更新用）
            this.eventBus.on(this.eventBus.Events.TOOL_CHANGED, (data) => {
                this._handleToolChange(data);
            });
        }
        
        console.log('✅ EventBus統合設定完了');
    }
    
    /**
     * ツール変更時の処理
     */
    _handleToolChange(data) {
        // ツールが変更された場合、そのツールに応じたスライダー値を表示
        if (data && data.toolType) {
            console.log(`🎚️ ツール変更に応じたスライダー更新: ${data.toolType}`);
            // 必要に応じてスライダー値を更新
        }
    }
    
    /**
     * 初期値設定
     */
    setupInitialValues() {
        console.log('🎯 スライダー初期値設定...');
        
        this.sliders.forEach((sliderInfo, sliderId) => {
            this.setSliderValue(sliderId, sliderInfo.config.default, false);
        });
        
        console.log('✅ スライダー初期値設定完了');
    }
    
    // ==========================================
    // 🚨 統一システム統合: 公開API
    // ==========================================
    
    /**
     * スライダー値設定
     */
    setSliderValue(sliderId, value, triggerCallback = true) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) {
            this._showError('warning', `不明なスライダー: ${sliderId}`);
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
            this._throttledUIUpdate(sliderId);
            
            // コールバック実行
            if (triggerCallback) {
                this.triggerCallbacks(sliderId, constrainedValue);
            }
            
            // 🚨 EventBus統合: スライダー値変更イベント
            if (triggerCallback) {
                this._emitEvent('SLIDER_VALUE_CHANGED', {
                    sliderId,
                    value: this.getSliderValue(sliderId, true),
                    displayValue: constrainedValue,
                    timestamp: performance.now()
                });
            }
            
            return true;
            
        } catch (error) {
            this._showError('error', `スライダー値設定エラー ${sliderId}: ${error.message}`);
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
        console.log(`🎚️ プリセット適用: ${sliderId} = ${value}`);
        
        const result = this.setSliderValue(sliderId, value);
        
        if (result) {
            // 🚨 EventBus統合: プリセット適用イベント
            this._emitEvent('PRESET_APPLIED', {
                sliderId,
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
        console.log(`📞 コールバック登録: ${sliderId}`);
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
    // 🚨 統一システム統合: 内部処理メソッド
    // ==========================================
    
    /**
     * スロットル処理付きUI更新
     */
    _throttledUIUpdate(sliderId) {
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
            handle.style.left = `${percentage}%`;
        }
        
        // トラック塗りつぶし更新
        if (track) {
            track.style.width = `${percentage}%`;
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
        
        return `${value.toFixed(precision)}${unit}`;
    }
    
    /**
     * スライダー値確定
     */
    finalizeSliderValue(sliderId) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) return;
        
        // 最終的なコールバック実行（必要に応じて）
        this.triggerCallbacks(sliderId, sliderInfo.state.currentValue);
        
        console.log(`🎚️ スライダー値確定: ${sliderId} = ${sliderInfo.state.displayValue}`);
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
                    sliderId,
                    value: internalValue,
                    displayValue: value,
                    timestamp: performance.now()
                });
            } catch (error) {
                this._showError('warning', `コールバック実行エラー ${sliderId}: ${error.message}`);
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
    
    // ==========================================
    // 🚨 統一システム統合: 内部ヘルパーメソッド
    // ==========================================
    
    /**
     * 🚨 ConfigManager統合: 設定値取得ヘルパー
     */
    _getConfig(path, defaultValue) {
        if (this.configManager) {
            const value = this.configManager.get(path);
            return value !== undefined ? value : defaultValue;
        }
        return defaultValue;
    }
    
    /**
     * 🚨 ErrorManager統合: エラー表示ヘルパー
     */
    _showError(type, message, options = {}) {
        if (this.errorManager) {
            this.errorManager.showError(type, message, options);
        } else {
            // フォールバック
            console.error(`SliderManager ${type.toUpperCase()}:`, message);
        }
    }
    
    /**
     * 🚨 EventBus統合: イベント発行ヘルパー
     */
    _emitEvent(eventType, data = null) {
        if (this.eventBus) {
            this.eventBus.safeEmit(eventType, data);
        }
    }
    
    /**
     * 統一システム依存性不足処理
     */
    _handleMissingDependencies() {
        const message = 'SliderManager: 統一システム依存性不足\n必要: ConfigManager, ErrorManager, EventBus';
        console.error('❌', message);
        
        // フォールバック設定
        this.configManager = null;
        this.errorManager = null;
        this.eventBus = null;
    }
    
    // ==========================================
    // 統合版追加メソッド
    // ==========================================
    
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
            if (this.lodashAvailable) {
                sliderInfo.config = window._.merge({}, sliderInfo.config, newConfig);
            } else {
                sliderInfo.config = { ...sliderInfo.config, ...newConfig };
            }
            
            // ConfigManagerへの保存（パスが存在する場合）
            if (this.configManager) {
                Object.entries(newConfig).forEach(([key, value]) => {
                    const configPath = this._getSliderConfigPath(sliderId, key);
                    if (configPath) {
                        this.configManager.set(configPath, value);
                    }
                });
            }
            
            // UI更新
            this.updateSliderUI(sliderId);
            
            // 🚨 EventBus統合: 設定更新イベント
            this._emitEvent('SLIDER_CONFIG_UPDATED', { sliderId, newConfig });
            
            console.log(`🎚️ スライダー設定更新: ${sliderId}`, newConfig);
            return true;
            
        } catch (error) {
            this._showError('error', `スライダー設定更新エラー ${sliderId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * スライダー設定パス取得
     */
    _getSliderConfigPath(sliderId, configKey) {
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
     * 🚨 統一システム統合: 健全性チェック
     */
    healthCheck() {
        const stats = this.getStats();
        const warnings = [];
        const recommendations = [];
        
        // 統一システム依存性チェック
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
        
        // スライダー状態チェック
        if (stats.total === 0) {
            warnings.push('スライダー未検出');
        }
        
        if (stats.active > stats.total) {
            warnings.push('アクティブスライダー数異常');
        }
        
        // コールバック数チェック
        if (stats.callbacks > 50) {
            warnings.push(`コールバック数が多すぎる: ${stats.callbacks}`);
            recommendations.push('不要なコールバックを削除してください');
        }
        
        const healthy = warnings.length === 0;
        
        return {
            healthy,
            stats,
            warnings,
            recommendations,
            timestamp: Date.now()
        };
    }
    
    /**
     * 統計情報取得（統合版）
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
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                eventBus: !!this.eventBus
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
     * クリーンアップ（統合版）
     */
    cleanup() {
        try {
            // スロットルタイマークリア
            this.throttleTimers.forEach(timer => clearTimeout(timer));
            this.throttleTimers.clear();
            
            // イベントリスナー削除
            this.eventListeners.forEach((listener, element) => {
                try {
                    if (element === document) {
                        document.removeEventListener('keydown', listener);
                    } else {
                        element.removeEventListener('click', listener);
                    }
                } catch (error) {
                    console.error('❌ イベントリスナー削除エラー:', error);
                }
            });
            
            // スライダー専用イベント削除
            this.sliders.forEach((sliderInfo) => {
                const { slider } = sliderInfo.elements;
                const events = sliderInfo.events;
                
                if (slider && events.mousedown) {
                    slider.removeEventListener('mousedown', events.mousedown);
                }
                if (events.mousemove) {
                    document.removeEventListener('mousemove', events.mousemove);
                }
                if (events.mouseup) {
                    document.removeEventListener('mouseup', events.mouseup);
                }
                if (slider && events.wheel) {
                    slider.removeEventListener('wheel', events.wheel);
                }
            });
            
            // EventBusのリスナー削除（必要に応じて）
            if (this.eventBus) {
                // 特定のイベントタイプのリスナーを削除する場合
                // this.eventBus.offAll('SLIDER_CHANGED');
            }
            
            // 🚨 EventBus統合: クリーンアップ完了イベント
            this._emitEvent('SLIDER_MANAGER_CLEANUP', {
                totalSliders: this.sliders.size,
                version: this.version
            });
            
            console.log('🎚️ SliderManager クリーンアップ完了（統一システム統合版）');
            
        } catch (error) {
            this._showError('warning', `SliderManagerクリーンアップエラー: ${error.message}`);
        }
    }
}

// 🚨 統一システム統合: グローバル公開（AI分業対応）
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
    
    console.log('✅ SliderManager 統一システム統合版 グローバル公開完了');
    console.log('💡 使用例: const sm = new SliderManager(); sm.initialize();');
    console.log('🔧 デバッグ: window.testSliderManager() で動作確認');
    console.log('📊 値確認: window.getAllSliderValues() でスライダー値一覧取得');
}