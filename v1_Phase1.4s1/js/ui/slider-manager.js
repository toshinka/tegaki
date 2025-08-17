/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Phase A3: slider-manager.js 新規実装
 * 
 * 🎯 AI_WORK_SCOPE: スライダー統一管理・増減ボタン・プリセット連携・リアルタイム更新
 * 🎯 DEPENDENCIES: index.html（既存スライダーHTML構造）
 * 🎯 NODE_MODULES: lodash（値管理最適化）
 * 🎯 PIXI_EXTENSIONS: なし（DOM操作専用）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 
 * 📋 PHASE_TARGET: Phase1.4-A3 - スライダー統一管理システム
 * 📋 DRY_COMPLIANCE: ✅ 共通スライダー処理・イベント管理統一
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * Phase A3: スライダー統一管理システム
 * 🚨 実装機能:
 * 1. `pen-size`, `pen-opacity`, `pen-pressure`, `pen-smoothing` スライダー管理
 * 2. 増減ボタン（`-decrease-small`, `-decrease`, `-decrease-large` など）対応
 * 3. プリセットサイズボタン（`.size-preset-item`）連携
 * 4. リアルタイム値更新とUI反映
 * 5. コールバック機能でツール設定連携
 * 6. キーボードショートカット対応
 */
class SliderManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-A3';
        this.name = 'slider-manager';
        
        // スライダー管理
        this.sliders = new Map(); // slider-id -> SliderInfo
        this.presets = new Map(); // preset-group -> PresetInfo
        
        // スライダー設定定義
        this.sliderConfigs = {
            'pen-size': {
                min: 0.1,
                max: 100.0,
                default: 16.0,
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
                default: 85.0,
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
                default: 50.0,
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
                default: 30.0,
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
        
        // コールバック管理
        this.callbacks = {
            onChange: new Map(), // slider-id -> callback[]
            onPresetChange: new Map() // preset-group -> callback[]
        };
        
        // 拡張ライブラリ確認
        this.lodashAvailable = typeof window._ !== 'undefined';
        
        // イベントリスナー管理
        this.eventListeners = new Map(); // element -> listener
        
        console.log(`🎚️ SliderManager Phase A3構築 - ${this.version}`);
    }
    
    /**
     * 🚨 A3実装: 初期化・既存スライダー自動検出
     */
    initialize() {
        console.group(`🎚️ SliderManager Phase A3初期化 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: スライダー検出・設定
            this.discoverSliders();
            
            // Phase 2: 増減ボタン検出・設定
            this.setupIncrementButtons();
            
            // Phase 3: プリセット検出・設定
            this.discoverPresets();
            
            // Phase 4: キーボードショートカット設定
            this.setupKeyboardShortcuts();
            
            // Phase 5: 初期値設定
            this.setupInitialValues();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ SliderManager初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            console.error('❌ SliderManager初期化エラー:', error);
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🚨 A3実装: 既存スライダー自動検出
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
                console.error(`❌ スライダー検出エラー ${sliderId}:`, error);
            }
        });
        
        console.log(`✅ スライダー自動検出完了: ${discoveredCount}個`);
        
        if (discoveredCount > 0) {
            const sliderIds = Array.from(this.sliders.keys());
            console.log(`📋 検出されたスライダー: [${sliderIds.join(', ')}]`);
        }
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
     * 🚨 A3実装: スライダーイベント設定
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
            }
        };
        
        // ホイールイベント（微調整）
        const wheelHandler = (event) => {
            event.preventDefault();
            
            const config = sliderInfo.config;
            const delta = event.deltaY > 0 ? -config.step : config.step;
            
            this.adjustSliderValue(sliderId, delta);
        };
        
        // イベント登録
        slider.addEventListener('mousedown', mousedownHandler);
        document.addEventListener('mousemove', mousemoveHandler);
        document.addEventListener('mouseup', mouseupHandler);
        slider.addEventListener('wheel', wheelHandler, { passive: false });
        
        // イベント保存（クリーンアップ用）
        sliderInfo.events.mousedown = mousedownHandler;
        sliderInfo.events.mousemove = mousemoveHandler;
        sliderInfo.events.mouseup = mouseupHandler;
        sliderInfo.events.wheel = wheelHandler;
        
        console.log(`✅ スライダーイベント設定: ${sliderId}`);
    }
    
    /**
     * 🚨 A3実装: 増減ボタン検出・設定
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
     * 🚨 A3実装: プリセット検出・設定
     */
    discoverPresets() {
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
                };
                
                element.addEventListener('click', presetHandler);
                this.eventListeners.set(element, presetHandler);
                
                presetCount++;
                
            } catch (error) {
                console.error('❌ プリセット設定エラー:', error);
            }
        });
        
        console.log(`✅ プリセット設定完了: ${presetCount}個`);
    }
    
    /**
     * 🚨 A3実装: キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        console.log('⌨️ スライダーキーボードショートカット設定...');
        
        const keyboardHandler = (event) => {
            // ブラシサイズショートカット
            if (event.key === '[') {
                event.preventDefault();
                this.adjustSliderValue('pen-size', -1);
            } else if (event.key === ']') {
                event.preventDefault();
                this.adjustSliderValue('pen-size', 1);
            }
            // 不透明度ショートカット
            else if (event.key === '-' && event.ctrlKey) {
                event.preventDefault();
                this.adjustSliderValue('pen-opacity', -5);
            } else if (event.key === '=' && event.ctrlKey) {
                event.preventDefault();
                this.adjustSliderValue('pen-opacity', 5);
            }
        };
        
        document.addEventListener('keydown', keyboardHandler);
        this.eventListeners.set(document, keyboardHandler);
        
        console.log('✅ キーボードショートカット設定完了');
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
    // 🚨 A3実装: 公開API
    // ==========================================
    
    /**
     * スライダー値設定
     */
    setSliderValue(sliderId, value, triggerCallback = true) {
        const sliderInfo = this.sliders.get(sliderId);
        if (!sliderInfo) {
            console.warn(`⚠️ 不明なスライダー: ${sliderId}`);
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
            
            // UI更新
            this.updateSliderUI(sliderId);
            
            // コールバック実行
            if (triggerCallback) {
                this.triggerCallbacks(sliderId, constrainedValue);
            }
            
            return true;
            
        } catch (error) {
            console.error(`❌ スライダー値設定エラー ${sliderId}:`, error);
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
        return this.setSliderValue(sliderId, value);
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
    // 内部処理メソッド
    // ==========================================
    
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
                console.error(`❌ コールバック実行エラー ${sliderId}:`, error);
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
        
        // 設定マージ
        if (this.lodashAvailable) {
            sliderInfo.config = window._.merge({}, sliderInfo.config, newConfig);
        } else {
            sliderInfo.config = { ...sliderInfo.config, ...newConfig };
        }
        
        // UI更新
        this.updateSliderUI(sliderId);
        
        console.log(`🎚️ スライダー設定更新: ${sliderId}`, newConfig);
        return true;
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        const totalSliders = this.sliders.size;
        const activeSliders = Array.from(this.sliders.values())
            .filter(info => info.state.isDragging).length;
        
        return {
            total: totalSliders,
            active: activeSliders,
            callbacks: this.callbacks.onChange.size,
            lastUpdate: Math.max(...Array.from(this.sliders.values())
                .map(info => info.state.lastUpdateTime))
        };
    }
    
    /**
     * クリーンアップ
     */
    cleanup() {
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
        
        console.log('🎚️ SliderManager クリーンアップ完了');
    }
}

// 🚨 A3実装: グローバル公開（AI分業対応）
if (typeof window !== 'undefined') {
    window.SliderManager = SliderManager;
    console.log('✅ SliderManager Phase A3 グローバル公開完了');
}