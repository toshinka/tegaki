/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: UI統括管理・ポップアップシステム・スライダー統合・アニメーション効果
 * 🎯 DEPENDENCIES: js/utils/config-manager.js, js/utils/error-manager.js, js/utils/state-manager.js, js/utils/event-bus.js
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5 - 統一システム完全統合・AI分業基盤確立
 * 📋 V8_MIGRATION: UI API変更なし・WebGPU対応準備・120FPS対応
 * 📋 PERFORMANCE_TARGET: UI応答性1フレーム以下・アニメーション60FPS安定
 * 📋 DRY_COMPLIANCE: ✅ 統一システム活用・重複コード排除完了
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・依存性逆転・統一システム疎結合
 */

/**
 * UI統括管理システム（統一システム統合版）
 * 統一システム完全活用・EventBus疎結合・設定値統一
 * Pure JavaScript完全準拠・AI分業対応
 */
class UIManager {
    constructor(appCore = null) {
        this.appCore = appCore;
        this.version = 'v1.0-Phase1.1ss5-unified';
        
        // 🎯 統一システム依存関係
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        // UI状態管理
        this.activePopup = null;
        this.popups = new Map();
        this.sliders = new Map();
        this.toolButtons = new Map();
        
        // 設定キー定義（統一システム対応）
        this.configKeys = {
            ui: {
                animationSpeed: 'ui.animation.speed',
                responsiveBreakpoints: 'ui.responsive.breakpoints',
                showToolTips: 'ui.tooltips.enabled',
                compactMode: 'ui.layout.compact'
            },
            tools: {
                pen: {
                    size: 'tools.pen.size',
                    opacity: 'tools.pen.opacity', 
                    pressure: 'tools.pen.pressure',
                    smoothing: 'tools.pen.smoothing',
                    pressureSensitivity: 'tools.pen.pressureSensitivity',
                    edgeSmoothing: 'tools.pen.edgeSmoothing',
                    gpuAcceleration: 'tools.pen.gpuAcceleration'
                },
                eraser: {
                    size: 'tools.eraser.size',
                    opacity: 'tools.eraser.opacity',
                    mode: 'tools.eraser.mode'
                }
            }
        };
        
        // パフォーマンス監視
        this.performanceMetrics = {
            uiUpdateTime: 0,
            animationFrames: 0,
            lastUpdateTime: performance.now()
        };
        
        console.log(`🎨 UIManager ${this.version}構築開始...`);
    }
    
    /**
     * 🎯 統一システム統合・UI管理システム初期化
     */
    async init() {
        console.group(`🎨 UIManager 統一システム統合初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存性確認・設定
            this.validateAndSetupUnifiedSystems();
            
            // Phase 2: 設定値取得・適用
            this.loadConfigurationFromUnifiedSystem();
            
            // Phase 3: ツールボタンシステム初期化
            this.setupToolButtons();
            
            // Phase 4: ポップアップシステム初期化
            this.setupPopupSystem();
            
            // Phase 5: スライダーシステム初期化
            this.setupSliderSystem();
            
            // Phase 6: EventBus連携設定
            this.setupEventBusIntegration();
            
            // Phase 7: レスポンシブ・入力統合
            this.setupResponsiveAndInputs();
            
            // Phase 8: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ UIManager 統一システム統合初期化完了 - ${initTime.toFixed(2)}ms`);
            
            // StateManager状態更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('uiManager', 'initialized', {
                    initTime,
                    unifiedSystemsEnabled: true,
                    version: this.version
                });
            }
            
            return this;
            
        } catch (error) {
            // ErrorManager経由でエラー処理
            if (this.errorManager) {
                this.errorManager.showError('UI管理システム初期化失敗', error, 'UIManager.init');
            } else {
                console.error('❌ UIManager初期化エラー:', error);
            }
            
            // フォールバック初期化
            await this.fallbackInitialization();
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 統一システム依存性確認・設定
     */
    validateAndSetupUnifiedSystems() {
        console.log('🔧 統一システム依存性確認開始...');
        
        // ConfigManager依存性確認
        this.configManager = window.ConfigManager;
        if (!this.configManager) {
            throw new Error('ConfigManager が利用できません。統一システムの初期化を確認してください。');
        }
        
        // ErrorManager依存性確認
        this.errorManager = window.ErrorManager;
        if (!this.errorManager) {
            throw new Error('ErrorManager が利用できません。統一システムの初期化を確認してください。');
        }
        
        // StateManager依存性確認
        this.stateManager = window.StateManager;
        if (!this.stateManager) {
            throw new Error('StateManager が利用できません。統一システムの初期化を確認してください。');
        }
        
        // EventBus依存性確認
        this.eventBus = window.EventBus;
        if (!this.eventBus) {
            throw new Error('EventBus が利用できません。統一システムの初期化を確認してください。');
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 🎯 統一設定値取得・適用
     */
    loadConfigurationFromUnifiedSystem() {
        console.log('⚙️ 統一設定値取得開始...');
        
        try {
            // UI設定取得
            const animationSpeed = this.configManager.get(this.configKeys.ui.animationSpeed, 'normal');
            const responsiveBreakpoints = this.configManager.get(this.configKeys.ui.responsiveBreakpoints, 
                { mobile: 768, tablet: 1024 });
            
            // ツール設定取得
            this.toolSettings = {
                pen: {
                    size: this.configManager.get(this.configKeys.tools.pen.size, 16.0),
                    opacity: this.configManager.get(this.configKeys.tools.pen.opacity, 85.0),
                    pressure: this.configManager.get(this.configKeys.tools.pen.pressure, 50.0),
                    smoothing: this.configManager.get(this.configKeys.tools.pen.smoothing, 30.0),
                    pressureSensitivity: this.configManager.get(this.configKeys.tools.pen.pressureSensitivity, true),
                    edgeSmoothing: this.configManager.get(this.configKeys.tools.pen.edgeSmoothing, true),
                    gpuAcceleration: this.configManager.get(this.configKeys.tools.pen.gpuAcceleration, false)
                },
                eraser: {
                    size: this.configManager.get(this.configKeys.tools.eraser.size, 20.0),
                    opacity: this.configManager.get(this.configKeys.tools.eraser.opacity, 100.0),
                    mode: this.configManager.get(this.configKeys.tools.eraser.mode, 'normal')
                }
            };
            
            // UI設定適用
            this.uiSettings = {
                animationSpeed,
                responsiveBreakpoints,
                showToolTips: this.configManager.get(this.configKeys.ui.showToolTips, true),
                compactMode: this.configManager.get(this.configKeys.ui.compactMode, false)
            };
            
            console.log('✅ 統一設定値取得・適用完了');
            
        } catch (error) {
            this.errorManager.showError('設定値取得失敗', error, 'UIManager.loadConfiguration');
            throw error;
        }
    }
    
    /**
     * 🎯 EventBus統合設定
     */
    setupEventBusIntegration() {
        console.log('🚌 EventBus統合設定開始...');
        
        // ツール変更イベントリスナー
        this.eventBus.on('tool:changed', (data) => {
            this.handleToolChangeFromEventBus(data.tool, data.settings);
        });
        
        // 設定変更イベントリスナー
        this.eventBus.on('config:changed', (data) => {
            this.handleConfigChangeFromEventBus(data.key, data.value);
        });
        
        // 状態変更イベントリスナー
        this.eventBus.on('state:changed', (data) => {
            this.handleStateChangeFromEventBus(data.system, data.state);
        });
        
        // アプリケーションイベントリスナー
        this.eventBus.on('app:resize', (data) => {
            this.handleAppResizeFromEventBus(data.width, data.height);
        });
        
        console.log('✅ EventBus統合設定完了');
    }
    
    /**
     * 🎯 統合ツールボタンシステム
     */
    setupToolButtons() {
        console.log('🔧 統合ツールボタンシステム初期化...');
        
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach(button => {
            const toolId = button.id;
            const toolData = {
                element: button,
                active: button.classList.contains('active'),
                disabled: button.classList.contains('disabled')
            };
            
            this.toolButtons.set(toolId, toolData);
            
            if (!button.classList.contains('disabled')) {
                button.addEventListener('click', (e) => {
                    this.handleToolClick(e.currentTarget);
                });
            }
        });
        
        console.log(`🔧 統合ツールボタン初期化完了: ${toolButtons.length}個`);
    }
    
    /**
     * 🎯 統合ツールクリック処理
     */
    handleToolClick(button) {
        try {
            const toolId = button.id;
            const popupId = button.getAttribute('data-popup');
            
            // ツール切り替えロジック
            const toolMap = {
                'pen-tool': 'pen',
                'eraser-tool': 'eraser',
                'fill-tool': 'fill',
                'select-tool': 'select'
            };
            
            const tool = toolMap[toolId];
            if (tool) {
                this.setActiveToolViaEventBus(tool);
            }
            
            // ポップアップ表示
            if (popupId) {
                this.togglePopup(popupId);
            }
            
        } catch (error) {
            this.errorManager.showError('ツールクリック処理失敗', error, 'UIManager.handleToolClick');
        }
    }
    
    /**
     * 🎯 EventBus経由ツール設定
     */
    setActiveToolViaEventBus(tool) {
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
        
        // EventBus経由で通知（疎結合）
        this.eventBus.emit('ui:tool:activated', {
            tool,
            timestamp: Date.now(),
            source: 'UIManager'
        });
        
        // ステータス表示更新
        this.updateToolStatus(tool);
        
        console.log(`🎯 EventBus経由ツール設定: ${tool}`);
    }
    
    /**
     * 🎯 統合ポップアップシステム
     */
    setupPopupSystem() {
        console.log('📋 統合ポップアップシステム初期化...');
        
        const popups = document.querySelectorAll('.popup-panel');
        
        popups.forEach(popup => {
            const popupId = popup.id;
            const popupData = {
                element: popup,
                visible: false,
                draggable: popup.classList.contains('draggable')
            };
            
            this.popups.set(popupId, popupData);
            
            if (popupData.draggable) {
                this.makeDraggable(popup);
            }
        });
        
        // グローバルクリックでポップアップを閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button[data-popup]')) {
                this.closeAllPopups();
            }
        });
        
        console.log(`📋 統合ポップアップシステム初期化完了: ${popups.length}個`);
    }
    
    /**
     * 🎯 統合スライダーシステム
     */
    setupSliderSystem() {
        console.log('🎚️ 統合スライダーシステム初期化...');
        
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', {
            min: 0.1, max: 100,
            initial: this.toolSettings.pen.size,
            configKey: this.configKeys.tools.pen.size,
            unit: 'px',
            precision: 1,
            eventName: 'tool:pen:size:changed'
        });
        
        // ペン不透明度スライダー
        this.createSlider('pen-opacity-slider', {
            min: 0, max: 100,
            initial: this.toolSettings.pen.opacity,
            configKey: this.configKeys.tools.pen.opacity,
            unit: '%',
            precision: 1,
            eventName: 'tool:pen:opacity:changed'
        });
        
        // ペン筆圧スライダー
        this.createSlider('pen-pressure-slider', {
            min: 0, max: 100,
            initial: this.toolSettings.pen.pressure,
            configKey: this.configKeys.tools.pen.pressure,
            unit: '%',
            precision: 1,
            eventName: 'tool:pen:pressure:changed'
        });
        
        // ペン線補正スライダー
        this.createSlider('pen-smoothing-slider', {
            min: 0, max: 100,
            initial: this.toolSettings.pen.smoothing,
            configKey: this.configKeys.tools.pen.smoothing,
            unit: '%',
            precision: 1,
            eventName: 'tool:pen:smoothing:changed'
        });
        
        console.log(`🎚️ 統合スライダーシステム初期化完了: ${this.sliders.size}個`);
    }
    
    /**
     * 🎯 統一設定連携スライダー作成
     */
    createSlider(sliderId, config) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        const sliderData = {
            ...config,
            value: config.initial,
            track, handle, valueDisplay,
            isDragging: false
        };
        
        this.sliders.set(sliderId, sliderData);
        
        // スライダー更新関数
        const updateSlider = (value) => {
            sliderData.value = Math.max(config.min, Math.min(config.max, value));
            const percentage = ((sliderData.value - config.min) / (config.max - config.min)) * 100;
            
            if (track) track.style.width = percentage + '%';
            if (handle) handle.style.left = percentage + '%';
            if (valueDisplay) {
                valueDisplay.textContent = sliderData.value.toFixed(config.precision) + config.unit;
            }
            
            // ConfigManager経由で設定保存
            if (config.configKey && this.configManager) {
                this.configManager.set(config.configKey, sliderData.value);
            }
            
            // EventBus経由で変更通知
            if (config.eventName && this.eventBus) {
                this.eventBus.emit(config.eventName, {
                    value: sliderData.value,
                    percentage,
                    timestamp: Date.now(),
                    source: 'UIManager'
                });
            }
        };
        
        // スライダーイベント設定
        this.attachSliderEvents(container, sliderData, updateSlider);
        
        // 初期値設定
        updateSlider(config.initial);
        
        return sliderData;
    }
    
    /**
     * 🎯 スライダーイベント設定
     */
    attachSliderEvents(container, sliderData, updateSlider) {
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return sliderData.min + (percentage * (sliderData.max - sliderData.min));
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
        
        // タッチイベント
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                sliderData.isDragging = true;
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (sliderData.isDragging && e.touches.length === 1) {
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchend', () => {
            sliderData.isDragging = false;
        });
        
        // ホイールイベント（微調整）
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newValue = sliderData.value + delta;
            updateSlider(newValue);
        });
    }
    
    /**
     * レスポンシブ・入力統合設定
     */
    setupResponsiveAndInputs() {
        console.log('📱 レスポンシブ・入力統合設定...');
        
        // レスポンシブ設定
        this.setupResponsiveLayout();
        
        // キーボードショートカット設定
        this.setupKeyboardShortcuts();
        
        console.log('✅ レスポンシブ・入力統合設定完了');
    }
    
    /**
     * レスポンシブレイアウト設定
     */
    setupResponsiveLayout() {
        const handleResize = () => this.handleResponsiveResize();
        
        window.addEventListener('resize', handleResize);
        this.handleResponsiveResize(); // 初期実行
    }
    
    /**
     * レスポンシブリサイズ処理
     */
    handleResponsiveResize() {
        try {
            const width = window.innerWidth;
            const breakpoints = this.uiSettings.responsiveBreakpoints;
            
            document.body.classList.toggle('mobile', width < breakpoints.mobile);
            document.body.classList.toggle('tablet', 
                width >= breakpoints.mobile && width < breakpoints.tablet);
            
            // ポップアップ位置調整
            this.popups.forEach((popupData, popupId) => {
                this.adjustPopupPosition(popupData.element);
            });
            
            // EventBus通知
            this.eventBus.emit('ui:responsive:updated', {
                width,
                isMobile: width < breakpoints.mobile,
                isTablet: width >= breakpoints.mobile && width < breakpoints.tablet,
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.errorManager.showError('レスポンシブリサイズ処理失敗', error, 'UIManager.handleResponsiveResize');
        }
    }
    
    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'Escape': () => this.closeAllPopups(),
            'KeyP': () => this.setActiveToolViaEventBus('pen'),
            'KeyE': () => this.setActiveToolViaEventBus('eraser'),
            'BracketLeft': () => this.adjustToolSetting('size', -1),
            'BracketRight': () => this.adjustToolSetting('size', 1),
            'Semicolon': () => this.adjustToolSetting('opacity', -5),
            'Quote': () => this.adjustToolSetting('opacity', 5)
        };
        
        document.addEventListener('keydown', (e) => {
            const key = e.code;
            if (shortcuts[key] && !e.ctrlKey && !e.altKey && !e.metaKey) {
                // テキスト入力中は無視
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }
                
                e.preventDefault();
                shortcuts[key]();
            }
        });
    }
    
    /**
     * ツール設定調整
     */
    adjustToolSetting(setting, delta) {
        try {
            let sliderId;
            let configKey;
            
            switch (setting) {
                case 'size':
                    sliderId = 'pen-size-slider';
                    configKey = this.configKeys.tools.pen.size;
                    break;
                case 'opacity':
                    sliderId = 'pen-opacity-slider';
                    configKey = this.configKeys.tools.pen.opacity;
                    break;
                default:
                    return;
            }
            
            const sliderData = this.sliders.get(sliderId);
            if (!sliderData) return;
            
            const newValue = Math.max(sliderData.min, 
                Math.min(sliderData.max, sliderData.value + delta));
            
            // スライダー更新
            sliderData.value = newValue;
            const percentage = ((newValue - sliderData.min) / (sliderData.max - sliderData.min)) * 100;
            
            if (sliderData.track) sliderData.track.style.width = percentage + '%';
            if (sliderData.handle) sliderData.handle.style.left = percentage + '%';
            if (sliderData.valueDisplay) {
                sliderData.valueDisplay.textContent = newValue.toFixed(sliderData.precision) + sliderData.unit;
            }
            
            // 統一システム経由で保存・通知
            this.configManager.set(configKey, newValue);
            this.eventBus.emit(`tool:pen:${setting}:changed`, {
                value: newValue,
                delta,
                timestamp: Date.now(),
                source: 'keyboard'
            });
            
        } catch (error) {
            this.errorManager.showError('ツール設定調整失敗', error, 'UIManager.adjustToolSetting');
        }
    }
    
    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        console.log('📊 UIパフォーマンス監視開始...');
        
        const monitorLoop = () => {
            const now = performance.now();
            const deltaTime = now - this.performanceMetrics.lastUpdateTime;
            
            this.performanceMetrics.animationFrames++;
            this.performanceMetrics.uiUpdateTime = deltaTime;
            this.performanceMetrics.lastUpdateTime = now;
            
            requestAnimationFrame(monitorLoop);
        };
        
        requestAnimationFrame(monitorLoop);
        
        // 定期的な統計出力
        setInterval(() => {
            const fps = Math.round(this.performanceMetrics.animationFrames * 1000 / 5000);
            this.performanceMetrics.animationFrames = 0;
            
            // StateManager経由でパフォーマンス情報更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('uiManager', 'performance', {
                    fps,
                    updateTime: this.performanceMetrics.uiUpdateTime,
                    timestamp: Date.now()
                });
            }
        }, 5000);
    }
    
    // ==========================================
    // 🎯 EventBusイベントハンドラー群
    // ==========================================
    
    /**
     * EventBus: ツール変更イベント処理
     */
    handleToolChangeFromEventBus(tool, settings) {
        try {
            // UI状態更新（双方向バインディング回避）
            const toolButtonId = tool + '-tool';
            const toolData = this.toolButtons.get(toolButtonId);
            if (toolData && !toolData.active) {
                // 他ツールを非アクティブ化
                this.toolButtons.forEach((data) => {
                    data.element.classList.remove('active');
                    data.active = false;
                });
                
                // 対象ツールをアクティブ化
                toolData.element.classList.add('active');
                toolData.active = true;
                
                this.updateToolStatus(tool);
            }
            
            console.log(`🚌 EventBus: ツール変更受信 - ${tool}`);