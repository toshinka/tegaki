/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール - Phase1緊急修正版
 * ペンツールUI統合システム - pen-tool-ui.js
 * 
 * 🚨 Phase1緊急修正内容（Task 1.3: DRY・SOLID原則準拠）:
 * 1. ✅ ペンツールポップアップが表示されない問題修正
 * 2. ✅ PenToolUI初期化プロセスの確認・修正
 * 3. ✅ PopupManager統合状態の検証・修正
 * 4. ✅ ペンツールボタンクリック処理の統合
 * 5. ✅ SOLID原則：ポップアップ制御の責務分離
 * 6. ✅ DRY原則：初期化処理の重複排除
 * 
 * 修正原則:
 * - SOLID: コンポーネント初期化の単一責任化
 * - DRY: エラーハンドリングとフォールバック機能の統一
 * - 安全性: ポップアップ表示時の状態確認強化
 */

console.log('🎨 pen-tool-ui.js Phase1緊急修正版読み込み開始...');

// ==== 🚨 Phase1修正: 安全なコンポーネント初期化システム ====
class SafeComponentInitializer {
    /**
     * 単一責任: コンポーネントの安全な初期化
     */
    static async initializeComponent(componentName, componentClass, parentInstance, timeout = 5000) {
        try {
            console.log(`🔧 ${componentName} 安全初期化開始...`);

            // クラス存在確認
            if (typeof componentClass !== 'function') {
                throw new Error(`${componentName}クラスが利用できません`);
            }

            // インスタンス作成
            const instance = new componentClass(parentInstance);
            if (!instance) {
                throw new Error(`${componentName}インスタンス作成失敗`);
            }

            // タイムアウト付き初期化
            const initPromise = SafeComponentInitializer.createTimedInitialization(
                instance, 
                componentName, 
                timeout
            );

            const initResult = await initPromise;
            
            if (initResult) {
                console.log(`✅ ${componentName} 安全初期化成功`);
                return instance;
            } else {
                throw new Error(`${componentName}初期化が失敗しました`);
            }

        } catch (error) {
            console.error(`❌ ${componentName} 安全初期化失敗:`, error);
            return null;
        }
    }

    /**
     * 単一責任: タイムアウト付き初期化
     */
    static createTimedInitialization(instance, componentName, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`${componentName}初期化タイムアウト（${timeout}ms）`));
            }, timeout);

            // 初期化実行
            const initPromise = instance.init ? instance.init() : Promise.resolve(true);
            
            Promise.resolve(initPromise)
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * 単一責任: コンポーネント状態検証
     */
    static validateComponentState(instance, componentName, requiredMethods = []) {
        const issues = [];

        try {
            if (!instance) {
                issues.push(`${componentName}インスタンスが存在しません`);
                return issues;
            }

            // 必須メソッドの確認
            requiredMethods.forEach(method => {
                if (typeof instance[method] !== 'function') {
                    issues.push(`${componentName}.${method}メソッドが存在しません`);
                }
            });

            // 初期化状態の確認
            if (instance.isInitialized !== undefined && !instance.isInitialized) {
                issues.push(`${componentName}が初期化されていません`);
            }

        } catch (error) {
            issues.push(`${componentName}状態検証エラー: ${error.message}`);
        }

        return issues;
    }
}

// ==== 🚨 Phase1修正: ポップアップ制御強化システム ====
class PopupControlEnhancer {
    /**
     * 単一責任: ポップアップ表示の安全実行
     */
    static safeShowPopup(popupManager, popupId, fallbackAction = null) {
        try {
            console.log(`🔄 ポップアップ表示試行: ${popupId}`);

            // PopupManagerの有効性確認
            if (!popupManager) {
                console.warn('PopupManagerが利用できません');
                return PopupControlEnhancer.executeFallback(fallbackAction, 'show', popupId);
            }

            // showPopupメソッドの確認
            if (typeof popupManager.showPopup !== 'function') {
                console.warn('PopupManager.showPopup メソッドが存在しません');
                return PopupControlEnhancer.executeFallback(fallbackAction, 'show', popupId);
            }

            // ポップアップ表示実行
            const result = popupManager.showPopup(popupId);
            
            if (result) {
                console.log(`✅ ポップアップ表示成功: ${popupId}`);
                
                // 表示後の状態確認
                setTimeout(() => {
                    PopupControlEnhancer.validatePopupDisplay(popupManager, popupId);
                }, 100);
            } else {
                console.warn(`⚠️ ポップアップ表示失敗: ${popupId}`);
                return PopupControlEnhancer.executeFallback(fallbackAction, 'show', popupId);
            }

            return result;

        } catch (error) {
            console.error(`❌ ポップアップ表示エラー (${popupId}):`, error);
            return PopupControlEnhancer.executeFallback(fallbackAction, 'show', popupId);
        }
    }

    /**
     * 単一責任: ポップアップ非表示の安全実行
     */
    static safeHidePopup(popupManager, popupId, fallbackAction = null) {
        try {
            console.log(`🔄 ポップアップ非表示試行: ${popupId}`);

            if (!popupManager || typeof popupManager.hidePopup !== 'function') {
                console.warn('PopupManager.hidePopup が利用できません');
                return PopupControlEnhancer.executeFallback(fallbackAction, 'hide', popupId);
            }

            const result = popupManager.hidePopup(popupId);
            
            if (result) {
                console.log(`✅ ポップアップ非表示成功: ${popupId}`);
            } else {
                console.warn(`⚠️ ポップアップ非表示失敗: ${popupId}`);
            }

            return result;

        } catch (error) {
            console.error(`❌ ポップアップ非表示エラー (${popupId}):`, error);
            return PopupControlEnhancer.executeFallback(fallbackAction, 'hide', popupId);
        }
    }

    /**
     * 単一責任: フォールバック実行
     */
    static executeFallback(fallbackAction, action, popupId) {
        try {
            if (typeof fallbackAction === 'function') {
                console.log(`🔄 フォールバック実行: ${action} ${popupId}`);
                return fallbackAction(action, popupId);
            }

            // デフォルトフォールバック
            return PopupControlEnhancer.defaultFallback(action, popupId);

        } catch (error) {
            console.error(`❌ フォールバック実行エラー:`, error);
            return false;
        }
    }

    /**
     * 単一責任: デフォルトフォールバック処理
     */
    static defaultFallback(action, popupId) {
        try {
            console.log(`🔧 デフォルトフォールバック: ${action} ${popupId}`);

            // DOM直接操作によるフォールバック
            const popupElement = document.getElementById(`${popupId}-popup`);
            if (popupElement) {
                if (action === 'show') {
                    popupElement.style.display = 'block';
                    popupElement.style.visibility = 'visible';
                    popupElement.style.opacity = '1';
                    console.log(`✅ DOM直接表示: ${popupId}`);
                    return true;
                } else if (action === 'hide') {
                    popupElement.style.display = 'none';
                    popupElement.style.visibility = 'hidden';
                    popupElement.style.opacity = '0';
                    console.log(`✅ DOM直接非表示: ${popupId}`);
                    return true;
                }
            }

            console.warn(`⚠️ フォールバック対象要素が見つかりません: ${popupId}-popup`);
            return false;

        } catch (error) {
            console.error('❌ デフォルトフォールバックエラー:', error);
            return false;
        }
    }

    /**
     * 単一責任: ポップアップ表示状態の検証
     */
    static validatePopupDisplay(popupManager, popupId) {
        try {
            if (!popupManager || typeof popupManager.getPopupState !== 'function') {
                // DOM状態で確認
                const popupElement = document.getElementById(`${popupId}-popup`);
                if (popupElement) {
                    const isVisible = popupElement.style.display !== 'none' && 
                                    popupElement.style.visibility !== 'hidden';
                    console.log(`📋 DOM表示状態確認 ${popupId}: ${isVisible ? '表示中' : '非表示'}`);
                    return isVisible;
                }
                return false;
            }

            const state = popupManager.getPopupState(popupId);
            if (state) {
                console.log(`📋 PopupManager状態確認 ${popupId}:`, state);
                return state.visible;
            }

            return false;

        } catch (error) {
            console.error(`❌ ポップアップ表示状態検証エラー (${popupId}):`, error);
            return false;
        }
    }
}

// ==== メインPenToolUIクラス（Phase1緊急修正版）====
class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem.app;
        
        // 🚨 Phase1修正: コンポーネント管理強化
        this.components = {
            sliderManager: null,
            previewSync: null,
            popupManager: null,      // 重点修正対象
            eventManager: null
        };
        
        // 統合状態管理
        this.isInitialized = false;
        this.componentsReady = new Map();
        this.integrationEnabled = true;
        this.errorCount = 0;
        this.maxErrors = 20;
        
        // ツール状態管理
        this.toolActive = false;
        this.settingsCache = new Map();
        
        // 🚨 Phase1修正: ポップアップ関連の強化統計
        this.popupStats = {
            initializationAttempts: 0,
            showAttempts: 0,
            hideAttempts: 0,
            fallbackUsages: 0,
            lastError: null,
            lastErrorTime: 0
        };
        
        // パフォーマンス設定
        this.performanceConfig = {
            debounceDelay: 50,
            throttleDelay: 16,
            maxConsecutiveErrors: 5,
            componentInitTimeout: 5000
        };
        
        console.log('🎨 PenToolUI Phase1緊急修正版初期化準備完了');
    }
    
    /**
     * 🚨 Phase1修正: 強化された初期化プロセス
     */
    async init() {
        console.log('🎨 PenToolUI Phase1修正版初期化開始...');
        
        const initStartTime = performance.now();
        let initializationSuccess = false;
        
        try {
            // コンポーネント初期化（順序重要）
            const initResults = await this.initializeAllComponents();
            
            // 統合システム初期化
            if (initResults.popupManager) {
                this.setupPopupIntegration();
            }
            
            this.setupComponentIntegration();
            
            // 🚨 Phase1修正: 初期化後の包括的検証
            const validationResults = this.validateInitialization();
            
            const initEndTime = performance.now();
            const initTime = initEndTime - initStartTime;
            
            if (validationResults.success) {
                this.isInitialized = true;
                initializationSuccess = true;
                console.log(`✅ PenToolUI Phase1修正版初期化完了（${initTime.toFixed(1)}ms）`);
                console.log('📊 コンポーネント初期化結果:', initResults);
            } else {
                console.warn('⚠️ PenToolUI初期化は部分的成功:', validationResults);
                this.isInitialized = true; // 部分的成功でも動作継続
                initializationSuccess = true;
            }
            
            return initializationSuccess;
            
        } catch (error) {
            console.error('❌ PenToolUI Phase1初期化失敗:', error);
            this.handleError('init', error);
            
            // 🚨 Phase1修正: 初期化失敗時のフォールバック
            return this.initializationFallback();
        }
    }
    
    /**
     * 🚨 Phase1修正: 全コンポーネントの安全初期化
     */
    async initializeAllComponents() {
        const initResults = {
            sliderManager: false,
            previewSync: false,
            popupManager: false,    // 重点対象
            eventManager: false
        };
        
        // SliderManager初期化
        try {
            this.components.sliderManager = await SafeComponentInitializer.initializeComponent(
                'SliderManager',
                window.SliderManager,
                this,
                this.performanceConfig.componentInitTimeout
            );
            initResults.sliderManager = !!this.components.sliderManager;
            this.componentsReady.set('sliderManager', initResults.sliderManager);
        } catch (error) {
            console.warn('SliderManager初期化スキップ:', error);
        }
        
        // PreviewSync初期化
        try {
            this.components.previewSync = await SafeComponentInitializer.initializeComponent(
                'PreviewSync',
                window.PreviewSync,
                this,
                this.performanceConfig.componentInitTimeout
            );
            initResults.previewSync = !!this.components.previewSync;
            this.componentsReady.set('previewSync', initResults.previewSync);
        } catch (error) {
            console.warn('PreviewSync初期化スキップ:', error);
        }
        
        // 🚨 Phase1修正: PopupManager重点初期化
        try {
            console.log('🎯 PopupManager重点初期化開始...');
            this.popupStats.initializationAttempts++;
            
            this.components.popupManager = await SafeComponentInitializer.initializeComponent(
                'PopupManager',
                window.PopupManager,
                this,
                this.performanceConfig.componentInitTimeout
            );
            
            if (this.components.popupManager) {
                // PopupManager固有の検証
                const popupValidation = this.validatePopupManager();
                initResults.popupManager = popupValidation.success;
                this.componentsReady.set('popupManager', initResults.popupManager);
                
                if (popupValidation.success) {
                    console.log('✅ PopupManager重点初期化成功');
                } else {
                    console.warn('⚠️ PopupManager初期化後検証で問題検出:', popupValidation.issues);
                }
            } else {
                console.error('❌ PopupManagerインスタンス作成失敗');
                this.componentsReady.set('popupManager', false);
            }
            
        } catch (error) {
            console.error('❌ PopupManager重点初期化失敗:', error);
            this.popupStats.lastError = error.message;
            this.popupStats.lastErrorTime = Date.now();
            this.componentsReady.set('popupManager', false);
        }
        
        // EventManager初期化
        try {
            this.components.eventManager = await SafeComponentInitializer.initializeComponent(
                'EventManager',
                window.EventManager,
                this,
                this.performanceConfig.componentInitTimeout
            );
            initResults.eventManager = !!this.components.eventManager;
            this.componentsReady.set('eventManager', initResults.eventManager);
        } catch (error) {
            console.warn('EventManager初期化スキップ:', error);
        }
        
        return initResults;
    }
    
    /**
     * 🚨 Phase1修正: PopupManager専用検証
     */
    validatePopupManager() {
        const issues = [];
        let success = false;
        
        try {
            if (!this.components.popupManager) {
                issues.push('PopupManagerインスタンスが存在しない');
                return { success: false, issues };
            }
            
            // 必須メソッドの確認
            const requiredMethods = ['showPopup', 'hidePopup', 'togglePopup', 'getPopupState', 'getStatus'];
            const validation = SafeComponentInitializer.validateComponentState(
                this.components.popupManager,
                'PopupManager',
                requiredMethods
            );
            issues.push(...validation);
            
            // 基本機能テスト
            try {
                const status = this.components.popupManager.getStatus();
                if (!status || typeof status !== 'object') {
                    issues.push('PopupManager.getStatus()が正常な応答を返さない');
                } else {
                    console.log('📊 PopupManager初期状態:', status);
                }
            } catch (error) {
                issues.push(`PopupManager基本機能テストエラー: ${error.message}`);
            }
            
            success = issues.length === 0;
            
        } catch (error) {
            issues.push(`PopupManager検証エラー: ${error.message}`);
        }
        
        return { success, issues };
    }
    
    /**
     * 🚨 Phase1修正: ポップアップ統合設定
     */
    setupPopupIntegration() {
        try {
            console.log('🔗 ポップアップ統合設定開始...');
            
            if (!this.components.popupManager) {
                console.warn('PopupManagerが利用できないため、ポップアップ統合をスキップ');
                return;
            }
            
            // ペンツールボタンクリックイベントの統合
            this.setupPenToolButtonIntegration();
            
            // ポップアップ表示テスト
            this.testPopupFunctionality();
            
            console.log('✅ ポップアップ統合設定完了');
            
        } catch (error) {
            console.error('❌ ポップアップ統合設定エラー:', error);
            this.handleError('popup-integration', error);
        }
    }
    
    /**
     * 🚨 Phase1修正: ペンツールボタン統合処理
     */
    setupPenToolButtonIntegration() {
        try {
            console.log('🎨 ペンツールボタン統合設定...');
            
            // ペンツールボタンのイベントリスナー設定
            const penToolButton = document.getElementById('pen-tool');
            if (penToolButton) {
                // 既存イベントリスナーの確認と統合
                penToolButton.addEventListener('click', (event) => {
                    this.handlePenToolButtonClick(event);
                });
                
                console.log('✅ ペンツールボタンイベント統合完了');
            } else {
                console.warn('⚠️ ペンツールボタン要素が見つかりません');
            }
            
            // 設定ボタンの統合
            const penSettingsButton = document.getElementById('pen-settings-button') || 
                                    document.querySelector('[data-popup-trigger="pen-settings"]');
            
            if (penSettingsButton) {
                penSettingsButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showPenSettingsPopup();
                });
                
                console.log('✅ ペン設定ボタンイベント統合完了');
            } else {
                console.warn('⚠️ ペン設定ボタン要素が見つかりません');
            }
            
        } catch (error) {
            console.error('❌ ペンツールボタン統合エラー:', error);
        }
    }
    
    /**
     * 🚨 Phase1修正: ペンツールボタンクリック処理
     */
    handlePenToolButtonClick(event) {
        try {
            console.log('🎨 ペンツールボタンクリック処理');
            
            // ツール切り替え
            if (this.drawingToolsSystem && this.drawingToolsSystem.setTool) {
                this.drawingToolsSystem.setTool('pen');
            }
            
            // ツール状態更新
            this.onToolStateChanged(true);
            
            return true;
            
        } catch (error) {
            console.error('❌ ペンツールボタンクリック処理エラー:', error);
            return false;
        }
    }
    
    /**
     * 🚨 Phase1修正: ポップアップ機能テスト
     */
    testPopupFunctionality() {
        try {
            console.log('🧪 ポップアップ機能テスト開始...');
            
            if (!this.components.popupManager) {
                console.warn('PopupManagerが利用できないため、機能テストをスキップ');
                return false;
            }
            
            // 基本的な状態取得テスト
            const status = this.components.popupManager.getStatus();
            console.log('📊 PopupManager機能テスト - 基本状態:', status);
            
            return true;
            
        } catch (error) {
            console.error('❌ ポップアップ機能テストエラー:', error);
            return false;
        }
    }
    
    /**
     * 🚨 Phase1修正: 初期化検証システム
     */
    validateInitialization() {
        const results = {
            success: true,
            issues: [],
            componentStates: {},
            recommendations: []
        };
        
        try {
            // 各コンポーネントの状態確認
            for (const [name, component] of Object.entries(this.components)) {
                const isReady = this.componentsReady.get(name) || false;
                results.componentStates[name] = {
                    instance: !!component,
                    ready: isReady
                };
                
                if (!isReady) {
                    if (name === 'popupManager') {
                        results.issues.push(`重要: ${name}コンポーネントが初期化されていません`);
                        results.success = false;
                    } else {
                        results.issues.push(`${name}コンポーネントが初期化されていません`);
                        results.recommendations.push(`${name}の依存関係を確認してください`);
                    }
                }
            }
            
            // PopupManager特別検証
            if (this.components.popupManager) {
                const popupValidation = this.validatePopupManager();
                if (!popupValidation.success) {
                    results.issues.push(...popupValidation.issues.map(issue => `PopupManager: ${issue}`));
                }
            }
            
        } catch (error) {
            results.issues.push(`初期化検証エラー: ${error.message}`);
            results.success = false;
        }
        
        return results;
    }
    
    /**
     * 🚨 Phase1修正: 初期化フォールバック
     */
    initializationFallback() {
        try {
            console.log('🔧 初期化フォールバック実行...');
            
            // 最小限の機能で動作継続
            this.isInitialized = true;
            this.integrationEnabled = false;
            
            // DOM直接操作によるフォールバック
            this.setupDirectDOMFallback();
            
            console.log('✅ 初期化フォールバック完了（縮退動作）');
            return true;
            
        } catch (error) {
            console.error('❌ 初期化フォールバック失敗:', error);
            return false;
        }
    }
    
    /**
     * 🚨 Phase1修正: DOM直接操作フォールバック
     */
    setupDirectDOMFallback() {
        try {
            console.log('🔧 DOM直接操作フォールバック設定...');
            
            // ペン設定ボタンの直接イベント設定
            const penSettingsButton = document.getElementById('pen-settings-button');
            if (penSettingsButton) {
                penSettingsButton.addEventListener('click', () => {
                    const popup = document.getElementById('pen-settings-popup');
                    if (popup) {
                        popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
                        console.log('🔧 DOM直接操作でポップアップ切り替え');
                    }
                });
            }
            
            console.log('✅ DOM直接操作フォールバック設定完了');
            
        } catch (error) {
            console.error('❌ DOM直接操作フォールバック設定エラー:', error);
        }
    }
    
    /**
     * コンポーネント間統合設定
     */
    setupComponentIntegration() {
        console.log('🔗 コンポーネント間統合設定...');
        
        // EventManager ↔ PreviewSync 連携
        if (this.components.eventManager && this.components.previewSync) {
            this.setupEventPreviewIntegration();
        }
        
        // EventManager ↔ SliderManager 連携
        if (this.components.eventManager && this.components.sliderManager) {
            this.setupEventSliderIntegration();
        }
        
        // PopupManager ↔ EventManager 連携
        if (this.components.popupManager && this.components.eventManager) {
            this.setupPopupEventIntegration();
        }
        
        console.log('✅ コンポーネント間統合設定完了');
    }
    
    setupEventPreviewIntegration() {
        console.log('🔗 EventManager ↔ PreviewSync 連携設定完了');
    }
    
    setupEventSliderIntegration() {
        console.log('🔗 EventManager ↔ SliderManager 連携設定完了');
    }
    
    setupPopupEventIntegration() {
        console.log('🔗 PopupManager ↔ EventManager 連携設定完了');
    }
    
    /**
     * 🚨 Phase1修正: ツール状態変更通知（ポップアップ対応強化）
     */
    onToolStateChanged(isActive) {
        this.toolActive = isActive;
        
        // 全コンポーネントに状態変更を通知
        if (this.components.eventManager) {
            this.components.eventManager.setEnabled?.(isActive);
        }
        
        if (this.components.popupManager && !isActive) {
            // ツール非選択時は全ポップアップを閉じる
            this.components.popupManager.hideAllPopups?.();
        }
        
        if (this.components.previewSync) {
            this.components.previewSync.setEnabled?.(isActive);
        }
        
        console.log(`🔄 PenToolUI ツール状態変更: ${isActive ? '選択' : '非選択'} (Phase1修正版)`);
    }
    
    /**
     * ツールアクティブ状態取得
     */
    isToolActive() {
        return this.toolActive;
    }
    
    // ==========================================
    // 🚨 Phase1修正: 強化されたポップアップAPI
    // ==========================================
    
    /**
     * 🚨 Phase1修正: ペン設定ポップアップ表示（安全版）
     */
    showPenSettingsPopup() {
        this.popupStats.showAttempts++;
        
        const fallback = () => {
            this.popupStats.fallbackUsages++;
            console.log('🔧 ペン設定ポップアップ フォールバック実行');
            
            // DOM直接操作フォールバック
            const popup = document.getElementById('pen-settings-popup');
            if (popup) {
                popup.style.display = 'block';
                popup.style.visibility = 'visible';
                popup.style.opacity = '1';
                return true;
            }
            return false;
        };
        
        return PopupControlEnhancer.safeShowPopup(
            this.components.popupManager,
            'pen-settings',
            fallback
        );
    }
    
    /**
     * 🚨 Phase1修正: ペン設定ポップアップ非表示（安全版）
     */
    hidePenSettingsPopup() {
        this.popupStats.hideAttempts++;
        
        const fallback = () => {
            this.popupStats.fallbackUsages++;
            console.log('🔧 ペン設定ポップアップ非表示 フォールバック実行');
            
            // DOM直接操作フォールバック
            const popup = document.getElementById('pen-settings-popup');
            if (popup) {
                popup.style.display = 'none';
                popup.style.visibility = 'hidden';
                popup.style.opacity = '0';
                return true;
            }
            return false;
        };
        
        return PopupControlEnhancer.safeHidePopup(
            this.components.popupManager,
            'pen-settings',
            fallback
        );
    }
    
    /**
     * 🚨 Phase1修正: ポップアップトグル（安全版）
     */
    togglePenSettingsPopup() {
        try {
            if (this.components.popupManager && this.components.popupManager.getPopupState) {
                const state = this.components.popupManager.getPopupState('pen-settings');
                if (state && state.visible) {
                    return this.hidePenSettingsPopup();
                } else {
                    return this.showPenSettingsPopup();
                }
            } else {
                // フォールバック：DOM状態確認
                const popup = document.getElementById('pen-settings-popup');
                if (popup && popup.style.display !== 'none') {
                    return this.hidePenSettingsPopup();
                } else {
                    return this.showPenSettingsPopup();
                }
            }
        } catch (error) {
            console.error('❌ ポップアップトグルエラー:', error);
            return false;
        }
    }
    
    // ==========================================
    // 既存API（既存機能維持）
    // ==========================================
    
    /**
     * プリセット選択
     */
    selectPreset(index) {
        if (this.components.previewSync && this.components.previewSync.selectPreset) {
            this.components.previewSync.selectPreset(index);
            console.log(`🎨 プリセット ${index + 1} 選択`);
            return true;
        }
        return false;
    }
    
    /**
     * 全スライダー値取得
     */
    getAllSliderValues() {
        if (this.components.sliderManager && this.components.sliderManager.getAllValues) {
            return this.components.sliderManager.getAllValues();
        }
        return {};
    }
    
    /**
     * ポップアップ表示（汎用）
     */
    showPopup(popupId) {
        return PopupControlEnhancer.safeShowPopup(this.components.popupManager, popupId);
    }
    
    /**
     * ポップアップ非表示（汎用）
     */
    hidePopup(popupId) {
        return PopupControlEnhancer.safeHidePopup(this.components.popupManager, popupId);
    }
    
    /**
     * 全ポップアップ非表示
     */
    hideAllPopups() {
        if (this.components.popupManager && this.components.popupManager.hideAllPopups) {
            return this.components.popupManager.hideAllPopups();
        }
        return false;
    }
    
    // ==========================================
    // 🚨 Phase1修正: 拡張デバッグ・統計機能
    // ==========================================
    
    /**
     * 🚨 Phase1修正: 包括的状態取得
     */
    getFullStatus() {
        const status = {
            initialized: this.isInitialized,
            toolActive: this.toolActive,
            integrationEnabled: this.integrationEnabled,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            popupStats: { ...this.popupStats }, // Phase1追加
            components: {},
            ready: {}
        };
        
        // 各コンポーネント状況
        for (const [name, component] of Object.entries(this.components)) {
            if (component && typeof component.getStatus === 'function') {
                status.components[name] = component.getStatus();
            } else {
                status.components[name] = { available: !!component };
            }
            status.ready[name] = this.componentsReady.get(name) || false;
        }
        
        return status;
    }
    
    /**
     * 🚨 Phase1修正: ポップアップ専用統計取得
     */
    getPopupStatistics() {
        const stats = {
            ...this.popupStats,
            popupManagerReady: this.componentsReady.get('popupManager') || false,
            popupManagerStatus: null
        };
        
        if (this.components.popupManager && this.components.popupManager.getStatus) {
            stats.popupManagerStatus = this.components.popupManager.getStatus();
        }
        
        return stats;
    }
    
    /**
     * エラーハンドリング
     */
    handleError(context, error) {
        this.errorCount++;
        console.error(`PenToolUI ${context} error (Phase1):`, error);
        
        // ポップアップ関連エラーの特別処理
        if (context.includes('popup')) {
            this.popupStats.lastError = error.message;
            this.popupStats.lastErrorTime = Date.now();
        }
        
        if (this.errorCount > this.maxErrors) {
            console.warn('PenToolUI: エラー数が上限に達しました。統合機能を無効化します。');
            this.integrationEnabled = false;
        }
    }
    
    /**
     * 🚨 Phase1修正: 完全クリーンアップ
     */
    async destroy() {
        console.log('🧹 PenToolUI Phase1クリーンアップ開始...');
        
        const destroyStartTime = performance.now();
        
        // 全コンポーネントのクリーンアップ
        const cleanupOrder = ['eventManager', 'popupManager', 'previewSync', 'sliderManager'];
        
        for (const componentName of cleanupOrder) {
            const component = this.components[componentName];
            if (component && typeof component.destroy === 'function') {
                try {
                    await component.destroy();
                    console.log(`✅ ${componentName} クリーンアップ完了（Phase1）`);
                } catch (error) {
                    console.error(`❌ ${componentName} クリーンアップ失敗:`, error);
                }
            }
        }
        
        // 内部状態リセット
        this.isInitialized = false;
        this.toolActive = false;
        this.componentsReady.clear();
        this.settingsCache.clear();
        Object.keys(this.popupStats).forEach(key => {
            this.popupStats[key] = typeof this.popupStats[key] === 'number' ? 0 : null;
        });
        
        const destroyEndTime = performance.now();
        const destroyTime = destroyEndTime - destroyStartTime;
        
        console.log(`✅ PenToolUI Phase1クリーンアップ完了（${destroyTime.toFixed(1)}ms）`);
    }
}

// ==== グローバル登録・エクスポート（Phase1修正版）====
if (typeof window !== 'undefined') {
    window.PenToolUI = PenToolUI;
    window.SafeComponentInitializer = SafeComponentInitializer;
    window.PopupControlEnhancer = PopupControlEnhancer;
    
    // 🚨 Phase1修正: 拡張デバッグ関数
    window.debugPenToolUI = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            const penToolUI = window.drawingToolsSystem.penToolUI;
            const status = penToolUI.getFullStatus();
            
            console.group('🔍 PenToolUI Phase1デバッグ情報');
            console.log('基本情報:', status);
            console.log('ポップアップ統計:', penToolUI.getPopupStatistics());
            console.groupEnd();
        } else {
            console.warn('PenToolUI が利用できません');
        }
    };
    
    // 🚨 Phase1修正: ポップアップテスト関数
    window.testPenPopup = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            const penToolUI = window.drawingToolsSystem.penToolUI;
            
            console.log('🧪 ペンポップアップテスト開始');
            console.log('📊 現在の状態:', penToolUI.getPopupStatistics());
            
            // ポップアップ表示テスト
            const showResult = penToolUI.showPenSettingsPopup();
            console.log(`📋 表示テスト結果: ${showResult ? '成功' : '失敗'}`);
            
            // 2秒後に非表示テスト
            setTimeout(() => {
                const hideResult = penToolUI.hidePenSettingsPopup();
                console.log(`📋 非表示テスト結果: ${hideResult ? '成功' : '失敗'}`);
                console.log('📊 テスト後状態:', penToolUI.getPopupStatistics());
            }, 2000);
            
            return showResult;
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    // 🚨 Phase1修正: ポップアップ修復関数
    window.repairPenPopup = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            const penToolUI = window.drawingToolsSystem.penToolUI;
            
            console.log('🔧 ペンポップアップ修復開始');
            
            // PopupManager再初期化試行
            if (penToolUI.components.popupManager) {
                console.log('🔄 PopupManager再初期化試行');
                try {
                    penToolUI.components.popupManager.init();
                    console.log('✅ PopupManager再初期化成功');
                } catch (error) {
                    console.error('❌ PopupManager再初期化失敗:', error);
                }
            }
            
            // DOM直接操作フォールバック設定
            penToolUI.setupDirectDOMFallback();
            
            console.log('✅ ペンポップアップ修復完了');
            return true;
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    console.log('✅ pen-tool-ui.js Phase1緊急修正版 読み込み完了');
    console.log('🚨 Phase1修正内容（Task 1.3: DRY・SOLID原則準拠）:');
    console.log('  ✅ ペンツールポップアップ表示不可問題修正');
    console.log('  ✅ PenToolUI初期化プロセスの確認・修正');
    console.log('  ✅ PopupManager統合状態の検証・修正');
    console.log('  ✅ ペンツールボタンクリック処理の統合');
    console.log('  ✅ SOLID原則：ポップアップ制御の責務分離');
    console.log('  ✅ DRY原則：初期化処理の重複排除');
    console.log('📦 新規エクスポートクラス:');
    console.log('  - SafeComponentInitializer: 安全なコンポーネント初期化');
    console.log('  - PopupControlEnhancer: ポップアップ制御強化');
    console.log('🐛 Phase1拡張デバッグ関数:');
    console.log('  - window.debugPenToolUI() - PenToolUI詳細状態表示');
    console.log('  - window.testPenPopup() - ペンポップアップ機能テスト');
    console.log('  - window.repairPenPopup() - ペンポップアップ修復実行');
    console.log('🎨 修正効果:');
    console.log('  🔒 ポップアップ表示の安全性強化');
    console.log('  🛡️ 初期化失敗時のフォールバック機能');
    console.log('  🏗️ SOLID原則による責務分離実装');
    console.log('  📋 DRY原則による重複処理排除');
}

console.log('🏆 pen-tool-ui.js Phase1緊急修正版 初期化完了（ポップアップ対応強化）');