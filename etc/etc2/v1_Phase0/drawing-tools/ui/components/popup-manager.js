executeCompleteHide(element) {
        const hideStyles = {
            display: 'none',
            visibility: 'hidden',
            opacity: '0',
            pointerEvents: 'none'
        };
        
        for (const [property, value] of Object.entries(hideStyles)) {
            element.style.setProperty(property, value, 'important');
        }
    }
    
    executeFadeIn(element, popupId, onComplete) {
        return requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${this.fadeTime}ms ease-out`;
                element.style.setProperty('opacity', '1', 'important');
                
                if (onComplete) {
                    setTimeout(onComplete, this.fadeTime);
                }
                
                console.log(`✨ ${popupId} フェードイン開始`);
            });
        });
    }
    
    executeFadeOut(element, popupId, onComplete) {
        element.style.transition = `opacity ${this.fadeTime}ms ease-out`;
        element.style.opacity = '0';
        
        return setTimeout(() => {
            this.executeCompleteHide(element);
            if (onComplete) {
                onComplete();
            }
            console.log(`🌫️ ${popupId} フェードアウト完了`);
        }, this.fadeTime);
    }
    
    cancelAnimation(popupId) {
        const animation = this.activeAnimations.get(popupId);
        if (animation) {
            if (typeof animation === 'number') {
                clearTimeout(animation);
            } else if (typeof animation === 'function') {
                // requestAnimationFrame のキャンセル（実装依存）
                try {
                    cancelAnimationFrame(animation);
                } catch (e) {
                    // キャンセル失敗は無視
                }
            }
            this.activeAnimations.delete(popupId);
        }
    }
    
    cancelAllAnimations() {
        for (const popupId of this.activeAnimations.keys()) {
            this.cancelAnimation(popupId);
        }
    }
    
    cleanup() {
        this.cancelAllAnimations();
    }
}

// ==== Phase 3: DOM要素作成ファクトリ（ファクトリパターン） ====
class PopupElementFactory {
    constructor(cssManager, errorHandler) {
        this.cssManager = cssManager;
        this.errorHandler = errorHandler;
        this.config = PopupConfigUtils.getPopupDefaults();
    }
    
    createPenSettingsPopup() {
        try {
            const popup = document.createElement('div');
            popup.id = 'pen-settings-popup';
            popup.className = 'popup pen-settings-popup';
            popup.style.cssText = this.cssManager.createPopupBaseStyle(
                this.config.fadeTime, 
                this.config.zIndexBase
            );
            
            popup.innerHTML = this.getPenSettingsContent();
            this.setupPopupEventHandlers(popup);
            
            document.body.appendChild(popup);
            console.log('✅ pen-settings-popup要素作成完了');
            
            return popup;
        } catch (error) {
            this.errorHandler.handleError(error, 'CreatePenSettingsPopup');
            return null;
        }
    }
    
    createOverlayElement() {
        try {
            const overlay = document.createElement('div');
            overlay.id = 'popup-overlay';
            overlay.className = 'popup-overlay';
            overlay.style.cssText = this.cssManager.createOverlayStyle(
                this.config.fadeTime, 
                this.config.zIndexBase - 1
            );
            
            document.body.appendChild(overlay);
            console.log('✅ ポップアップオーバーレイ作成完了');
            
            return overlay;
        } catch (error) {
            this.errorHandler.handleError(error, 'CreateOverlay');
            return null;
        }
    }
    
    getPenSettingsContent() {
        return `
            <div class="popup-header" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
                <h3 style="margin: 0; color: #800000; font-size: 18px;">🎨 ペン設定</h3>
            </div>
            <div class="popup-content">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">サイズ:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="pen-size-slider" min="1" max="100" value="4" 
                               style="flex: 1; height: 8px;">
                        <span id="pen-size-value" style="min-width: 40px; font-weight: bold;">4</span>px
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">透明度:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="pen-opacity-slider" min="0" max="100" value="100"
                               style="flex: 1; height: 8px;">
                        <span id="pen-opacity-value" style="min-width: 40px; font-weight: bold;">100</span>%
                    </div>
                </div>
                <div style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
                    💡 ホイールでサイズ調整、Rキーでプリセット選択も可能です
                </div>
            </div>
            <div class="popup-footer" style="margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #ddd;">
                <button class="close-popup-btn" style="
                    background: #800000; 
                    color: white; 
                    border: none; 
                    padding: 8px 15px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#a00000'" 
                   onmouseout="this.style.background='#800000'">閉じる</button>
            </div>
        `;
    }
    
    setupPopupEventHandlers(popup) {
        // クリック時の伝播防止
        popup.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        
        // 閉じるボタン機能
        const closeBtn = popup.querySelector('.close-popup-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.penToolUI) {
                    window.penToolUI.hidePopup('pen-settings');
                } else {
                    popup.style.display = 'none';
                }
            });
        }
    }
}

// ==== Phase 3: PopupManager本体クラス（完全リファクタリング版） ====
class PopupManager {
    constructor() {
        console.log('📦 PopupManager Phase 3初期化開始...');
        
        // Phase 3: 依存注入パターン採用
        this.config = PopupConfigUtils.getPopupDefaults();
        this.errorHandler = new PopupErrorHandler(this.config.maxErrors, 'PopupManager');
        this.cssManager = new PopupCSSManager(this.errorHandler);
        this.animationManager = new PopupAnimationManager(this.config.fadeTime, this.errorHandler);
        this.elementFactory = new PopupElementFactory(this.cssManager, this.errorHandler);
        
        // 状態管理（統合版）
        this.state = {
            activePopup: null,
            isInitialized: false,
            initializationAttempts: 0,
            domElementsReady: false,
            eventListenersReady: false
        };
        
        // ポップアップ管理
        this.popups = new Map();
        this.overlayElement = null;
        
        // 統計情報
        this.statistics = {
            showCount: 0,
            hideCount: 0,
            lastAction: null,
            lastActionTime: 0,
            operationTimes: new Map()
        };
        
        console.log('✅ PopupManager Phase 3初期化準備完了');
    }
    
    /**
     * Phase 3: 統合初期化システム（完全リファクタリング版）
     */
    async init() {
        try {
            console.log('🎯 PopupManager Phase 3初期化開始...');
            
            this.state.initializationAttempts++;
            
            if (this.state.initializationAttempts > this.config.retryAttempts) {
                throw new Error(`初期化試行回数上限 (${this.config.retryAttempts}) に達しました`);
            }
            
            // Phase 3: 段階的初期化プロセス
            await this.executeInitializationSteps();
            
            this.state.isInitialized = true;
            console.log('✅ PopupManager Phase 3初期化完了');
            
            return true;
            
        } catch (error) {
            this.errorHandler.handleError(error, 'Init');
            
            // リトライ処理
            if (this.state.initializationAttempts < this.config.retryAttempts) {
                console.log(`🔄 PopupManager初期化リトライ ${this.state.initializationAttempts}/${this.config.retryAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return await this.init();
            }
            
            throw error;
        }
    }
    
    async executeInitializationSteps() {
        const initSteps = [
            () => this.validateDOMReady(),
            () => this.setupPopupElements(),
            () => this.setupEventListeners(),
            () => this.setupOverlay(),
            () => this.validateInitialization()
        ];
        
        for (let i = 0; i < initSteps.length; i++) {
            try {
                await initSteps[i]();
            } catch (error) {
                throw new Error(`初期化ステップ ${i + 1} で失敗: ${error.message}`);
            }
        }
    }
    
    /**
     * Phase 3: DOM準備状態確認（統一処理）
     */
    async validateDOMReady() {
        console.log('📄 DOM準備状態確認中...');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('DOM準備タイムアウト'));
            }, this.config.initTimeout);
            
            const checkDOM = () => {
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    clearTimeout(timeout);
                    console.log('✅ DOM準備確認完了');
                    resolve();
                } else {
                    setTimeout(checkDOM, 100);
                }
            };
            
            checkDOM();
        });
    }
    
    /**
     * Phase 3: ポップアップ要素セットアップ（ファクトリパターン採用）
     */
    async setupPopupElements() {
        console.log('📋 ポップアップ要素セットアップ開始...');
        
        // ペン設定ポップアップ
        await this.setupPenSettingsPopup();
        
        // リサイズ設定ポップアップ（既存要素確認のみ）
        await this.setupExistingPopups();
        
        this.state.domElementsReady = true;
        console.log(`📋 ポップアップ要素セットアップ完了: ${this.popups.size}個`);
    }
    
    async setupPenSettingsPopup() {
        try {
            let penSettingsPopup = document.getElementById('pen-settings-popup');
            
            if (!penSettingsPopup) {
                console.log('🔧 pen-settings-popup要素が見つかりません → 作成します');
                penSettingsPopup = this.elementFactory.createPenSettingsPopup();
            }
            
            if (penSettingsPopup) {
                this.registerPopupElement('pen-settings', penSettingsPopup);
                console.log('✅ pen-settings-popup要素セットアップ完了');
            } else {
                throw new Error('pen-settings-popup要素作成失敗');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'SetupPenSettings');
        }
    }
    
    async setupExistingPopups() {
        const existingPopups = [
            { id: 'resize-settings-popup', name: 'resize-settings' }
        ];
        
        for (const popupInfo of existingPopups) {
            const element = document.getElementById(popupInfo.id);
            if (element) {
                this.registerPopupElement(popupInfo.name, element);
                console.log(`✅ ${popupInfo.id}要素確認完了`);
            }
        }
    }
    
    registerPopupElement(popupId, element) {
        // CSS検証・修正
        this.cssManager.validateAndFixPopupCSS(element, popupId);
        
        // ポップアップ登録
        this.popups.set(popupId, {
            element: element,
            visible: false,
            showCount: 0,
            hideCount: 0,
            lastOperation: null,
            operationTimes: []
        });
    }
    
    /**
     * Phase 3: イベントリスナーセットアップ（重複防止）
     */
    async setupEventListeners() {
        console.log('🎧 イベントリスナーセットアップ開始...');
        
        // ESCキーリスナー（重複防止）
        this.setupEscapeKeyListener();
        
        // ポップアップ内クリック伝播防止
        this.setupClickPropagationPrevention();
        
        this.state.eventListenersReady = true;
        console.log('✅ PopupManagerイベントリスナー設定完了');
    }
    
    setupEscapeKeyListener() {
        if (!document._popupEscListenerSet) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.state.activePopup) {
                    event.preventDefault();
                    this.hidePopup(this.state.activePopup);
                }
            });
            document._popupEscListenerSet = true;
            console.log('✅ ESCキーリスナー設定完了');
        }
    }
    
    setupClickPropagationPrevention() {
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            if (!element._clickListenerSet) {
                element.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                element._clickListenerSet = true;
                console.log(`✅ ${popupId} クリック伝播防止設定完了`);
            }
        }
    }
    
    /**
     * Phase 3: オーバーレイセットアップ（ファクトリパターン）
     */
    async setupOverlay() {
        console.log('🌫️ オーバーレイセットアップ開始...');
        
        try {
            this.overlayElement = document.getElementById('popup-overlay');
            
            if (!this.overlayElement) {
                this.overlayElement = this.elementFactory.createOverlayElement();
            }
            
            if (this.overlayElement) {
                this.setupOverlayEventHandlers();
                this.cssManager.validateAndFixPopupCSS(this.overlayElement, 'overlay');
            } else {
                throw new Error('オーバーレイ要素作成失敗');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'SetupOverlay');
        }
    }
    
    setupOverlayEventHandlers() {
        this.overlayElement.addEventListener('click', (event) => {
            event.preventDefault();
            if (this.state.activePopup) {
                this.hidePopup(this.state.activePopup);
            }
        });
    }
    
    /**
     * Phase 3: 初期化完了確認（詳細検証）
     */
    async validateInitialization() {
        console.log('🔍 初期化完了確認中...');
        
        const validationResults = {
            domElementsReady: this.state.domElementsReady,
            eventListenersReady: this.state.eventListenersReady,
            popupCount: this.popups.size,
            overlayElement: !!this.overlayElement,
            errorCount: this.errorHandler.errorCount
        };
        
        console.log('📊 初期化検証結果:', validationResults);
        
        // 必須要素確認
        const requiredPopups = ['pen-settings'];
        const missingPopups = requiredPopups.filter(id => !this.popups.has(id));
        
        if (missingPopups.length > 0) {
            throw new Error(`必須ポップアップ要素が不足: ${missingPopups.join(', ')}`);
        }
        
        if (!this.overlayElement) {
            throw new Error('オーバーレイ要素が作成されていません');
        }
        
        console.log('✅ 初期化完了確認成功');
    }
    
    /**
     * Phase 3: ポップアップ表示（統一処理・統計付き）
     */
    showPopup(popupId) {
        const startTime = performance.now();
        
        try {
            console.log(`📋 ポップアップ表示開始: ${popupId}`);
            
            if (!this.validateShowRequest(popupId)) {
                return false;
            }
            
            const popupInfo = this.popups.get(popupId);
            
            // 他のポップアップを閉じる
            this.hideOtherPopups(popupId);
            
            // 既に表示中の場合
            if (popupInfo.visible) {
                console.log(`ポップアップ既に表示中: ${popupId}`);
                return true;
            }
            
            // 表示実行
            const success = this.executeShow(popupId, popupInfo);
            
            if (success) {
                this.updateShowStatistics(popupId, startTime);
            }
            
            return success;
            
        } catch (error) {
            this.errorHandler.handleError(error, `popup_${popupId}_show`);
            return false;
        }
    }
    
    validateShowRequest(popupId) {
        if (!this.state.isInitialized) {
            console.warn('PopupManagerが初期化されていません');
            return false;
        }
        
        if (!this.popups.has(popupId)) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        return true;
    }
    
    hideOtherPopups(currentPopupId) {
        if (this.state.activePopup && this.state.activePopup !== currentPopupId) {
            this.hidePopup(this.state.activePopup);
        }
    }
    
    executeShow(popupId, popupInfo) {
        // オーバーレイ表示
        this.showOverlay();
        
        // アニメーション付き表示
        const success = this.animationManager.showWithAnimation(
            popupInfo.element, 
            popupId,
            () => {
                console.log(`✅ ${popupId} 表示アニメーション完了`);
            }
        );
        
        if (success) {
            // 状態更新
            popupInfo.visible = true;
            popupInfo.showCount++;
            popupInfo.lastOperation = 'show';
            this.state.activePopup = popupId;
        }
        
        return success;
    }
    
    updateShowStatistics(popupId, startTime) {
        const operationTime = performance.now() - startTime;
        
        this.statistics.showCount++;
        this.statistics.lastAction = 'show';
        this.statistics.lastActionTime = Date.now();
        
        const popupInfo = this.popups.get(popupId);
        popupInfo.operationTimes.push({
            operation: 'show',
            time: operationTime,
            timestamp: Date.now()
        });
        
        // 統計履歴制限
        if (popupInfo.operationTimes.length > 10) {
            popupInfo.operationTimes.shift();
        }
        
        console.log(`✅ ポップアップ表示完了: ${popupId} (${operationTime.toFixed(1)}ms)`);
    }
    
    /**
     * Phase 3: ポップアップ非表示（統一処理・統計付き）
     */
    hidePopup(popupId) {
        const startTime = performance.now();
        
        try {
            console.log(`❌ ポップアップ非表示開始: ${popupId}`);
            
            if (!this.validateHideRequest(popupId)) {
                return false;
            }
            
            const popupInfo = this.popups.get(popupId);
            
            // 既に非表示の場合
            if (!popupInfo.visible) {
                console.log(`ポップアップ既に非表示: ${popupId}`);
                return true;
            }
            
            // 非表示実行
            const success = this.executeHide(popupId, popupInfo);
            
            if (success) {
                this.updateHideStatistics(popupId, startTime);
            }
            
            return success;
            
        } catch (error) {
            this.errorHandler.handleError(error, `popup_${popupId}_hide`);
            return false;
        }
    }
    
    validateHideRequest(popupId) {
        if (!this.state.isInitialized) {
            console.warn('PopupManagerが初期化されていません');
            return false;
        }
        
        if (!this.popups.has(popupId)) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        return true;
    }
    
    executeHide(popupId, popupInfo) {
        // アニメーション付き非表示
        const success = this.animationManager.hideWithAnimation(
            popupInfo.element,
            popupId,
            () => {
                // アニメーション完了時の処理
                this.completeHideOperation(popupId, popupInfo);
            }
        );
        
        if (success) {
            // 即座に状態更新（アニメーション完了を待たない）
            popupInfo.visible = false;
            popupInfo.hideCount++;
            popupInfo.lastOperation = 'hide';
        }
        
        return success;
    }
    
    completeHideOperation(popupId, popupInfo) {
        // アクティブポップアップ更新
        if (this.state.activePopup === popupId) {
            this.state.activePopup = null;
            this.hideOverlay();
        }
        
        console.log(`🏁 ポップアップ非表示完了: ${popupId}`);
    }
    
    updateHideStatistics(popupId, startTime) {
        const operationTime = performance.now() - startTime;
        
        this.statistics.hideCount++;
        this.statistics.lastAction = 'hide';
        this.statistics.lastActionTime = Date.now();
        
        const popupInfo = this.popups.get(popupId);
        popupInfo.operationTimes.push({
            operation: 'hide',
            time: operationTime,
            timestamp: Date.now()
        });
        
        console.log(`✅ ポップアップ非表示開始: ${popupId} (${operationTime.toFixed(1)}ms)`);
    }
    
    /**
     * ポップアップトグル（統一処理）
     */
    togglePopup(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        if (popupInfo.visible) {
            return this.hidePopup(popupId);
        } else {
            return this.showPopup(popupId);
        }
    }
    
    /**
     * 全ポップアップ非表示（統一処理）
     */
    hideAllPopups() {
        try {
            let hiddenCount = 0;
            
            for (const [popupId, popupInfo] of this.popups) {
                if (popupInfo.visible) {
                    if (this.hidePopup(popupId)) {
                        hiddenCount++;
                    }
                }
            }
            
            if (hiddenCount > 0) {
                console.log(`📋 ${hiddenCount}個のポップアップを非表示にしました`);
            }
            
            return hiddenCount > 0;
            
        } catch (error) {
            this.errorHandler.handleError(error, 'HideAllPopups');
            return false;
        }
    }
    
    /**
     * Phase 3: オーバーレイ制御（統一処理）
     */
    showOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.visibility = 'visible';
            this.overlayElement.style.pointerEvents = 'auto';
            requestAnimationFrame(() => {
                this.overlayElement.style.opacity = '1';
            });
        }
    }
    
    hideOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '0';
            setTimeout(() => {
                if (this.overlayElement && !this.state.activePopup) {
                    this.overlayElement.style.visibility = 'hidden';
                    this.overlayElement.style.pointerEvents = 'none';
                }
            }, this.config.fadeTime);
        }
    }
    
    /**
     * Phase 3: 状態取得・統計（完全版）
     */
    getPopupState(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            return null;
        }
        
        const recentOperations = popupInfo.operationTimes.slice(-3);
        
        return {
            visible: popupInfo.visible,
            showCount: popupInfo.showCount,
            hideCount: popupInfo.hideCount,
            lastOperation: popupInfo.lastOperation,
            recentOperations: recentOperations,
            averageOperationTime: this.calculateAverageOperationTime(popupInfo.operationTimes),
            errorCount: this.errorHandler.getPopupErrorCount(popupId)
        };
    }
    
    calculateAverageOperationTime(operationTimes) {
        if (operationTimes.length === 0) return 0;
        
        const totalTime = operationTimes.reduce((sum, op) => sum + op.time, 0);
        return Math.round(totalTime / operationTimes.length * 100) / 100;
    }
    
    getStatus() {
        const popupStatuses = {};
        
        for (const [popupId, popupInfo] of this.popups) {
            popupStatuses[popupId] = this.getPopupState(popupId);
        }
        
        return {
            initialized: this.state.isInitialized,
            activePopup: this.state.activePopup,
            popupCount: this.popups.size,
            
            initialization: {
                attempts: this.state.initializationAttempts,
                maxAttempts: this.config.retryAttempts,
                domElementsReady: this.state.domElementsReady,
                eventListenersReady: this.state.eventListenersReady
            },
            
            statistics: {
                totalShows: this.statistics.showCount,
                totalHides: this.statistics.hideCount,
                lastAction: this.statistics.lastAction,
                lastActionTime: this.statistics.lastActionTime
            },
            
            errorStats: this.errorHandler.getStats(),
            
            popups: popupStatuses,
            
            config: this.config
        };
    }
    
    /**
     * ポップアップ登録（外部用）
     */
    registerPopup(popupId) {
        const element = document.getElementById(`${popupId}-popup`) || document.getElementById(popupId);
        if (element && !this.popups.has(popupId)) {
            this.registerPopupElement(popupId, element);
            console.log(`📋 外部ポップアップ登録: ${popupId}`);
            return true;
        }
        return false;
    }
    
    /**
     * Phase 3: デバッグ情報表示（完全版）
     */
    debug() {
        console.group('🔍 PopupManager Phase 3 デバッグ情報（DRY・SOLID準拠版）');
        
        const status = this.getStatus();
        
        console.log('基本情報:', {
            initialized: status.initialized,
            activePopup: status.activePopup,
            popupCount: status.popupCount
        });
        
        console.log('初期化詳細:', status.initialization);
        console.log('統計情報:', status.statistics);
        console.log('エラー統計:', status.errorStats);
        console.log('設定情報:', status.config);
        
        console.log('ポップアップ詳細状態:');
        for (const [popupId, popupState] of Object.entries(status.popups)) {
            console.log(`  ${popupId}:`, {
                visible: popupState.visible,
                shows: popupState.showCount,
                hides: popupState.hideCount,
                lastOperation: popupState.lastOperation,
                avgTime: `${popupState.averageOperationTime}ms`,
                errors: popupState.errorCount,
                recentOps: popupState.recentOperations.length
            });
        }
        
        // DOM要素状況確認
        console.log('DOM要素状況:', {
            overlay: !!this.overlayElement,
            popupElements: this.popups.size,
            penSettingsExists: !!document.getElementById('pen-settings-popup'),
            bodyChildren: document.body.children.length
        });
        
        // 各ポップアップ要素の詳細確認
        console.log('要素詳細確認:');
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            console.log(`  ${popupId}:`, {
                exists: !!element,
                id: element?.id,
                className: element?.className,
                display: element?.style.display,
                visibility: element?.style.visibility,
                opacity: element?.style.opacity,
                zIndex: element?.style.zIndex
            });
        }
        
        // CSS管理状況
        console.log('CSS管理状況:', {
            validatedElements: this.cssManager.validatedElements.size,
            activeAnimations: this.animationManager.activeAnimations.size
        });
        
        console.groupEnd();
    }
    
    /**
     * Phase 3: パフォーマンス統計
     */
    getPerformanceStats() {
        const popupPerformance = {};
        
        for (const [popupId, popupInfo] of this.popups) {
            const operations = popupInfo.operationTimes;
            
            if (operations.length > 0) {
                const showOps = operations.filter(op => op.operation === 'show');
                const hideOps = operations.filter(op => op.operation === 'hide');
                
                popupPerformance[popupId] = {
                    totalOperations: operations.length,
                    showOperations: showOps.length,
                    hideOperations: hideOps.length,
                    averageShowTime: showOps.length > 0 ? 
                        showOps.reduce((sum, op) => sum + op.time, 0) / showOps.length : 0,
                    averageHideTime: hideOps.length > 0 ? 
                        hideOps.reduce((sum, op) => sum + op.time, 0) / hideOps.length : 0,
                    lastOperationTime: operations[operations.length - 1]?.timestamp || 0
                };
            }
        }
        
        return {
            initialized: this.state.isInitialized,
            uptime: Date.now() - (this.statistics.lastActionTime || Date.now()),
            totalOperations: this.statistics.showCount + this.statistics.hideCount,
            errorRate: this.popups.size > 0 ? 
                this.errorHandler.errorCount / (this.statistics.showCount + this.statistics.hideCount + 1) : 0,
            popupPerformance: popupPerformance,
            memoryUsage: {
                popups: this.popups.size,
                validatedElements: this.cssManager.validatedElements.size,
                activeAnimations: this.animationManager.activeAnimations.size,
                errorLogSize: this.errorHandler.errorLog.length
            }
        };
    }
    
    /**
     * Phase 3: 完全クリーンアップ（統一版）
     */
    destroy() {
        try {
            console.log('🧹 PopupManager Phase 3 完全クリーンアップ開始...');
            
            const startTime = performance.now();
            
            // アクティブアニメーション停止
            this.animationManager.cleanup();
            
            // 全ポップアップ非表示
            this.hideAllPopups();
            
            // イベントリスナークリーンアップ
            this.cleanupEventListeners();
            
            // DOM要素クリーンアップ
            this.cleanupDOMElements();
            
            // 内部状態リセット
            this.resetInternalState();
            
            // 管理システムクリーンアップ
            this.cleanupManagementSystems();
            
            const endTime = performance.now();
            console.log(`✅ PopupManager Phase 3 完全クリーンアップ完了 (${(endTime - startTime).toFixed(1)}ms)`);
            
        } catch (error) {
            console.error('❌ PopupManager クリーンアップエラー:', error);
        }
    }
    
    cleanupEventListeners() {
        // ESCキーリスナーは他のPopupManagerでも使用される可能性があるため、
        // グローバルフラグのみリセット（実際のリスナー削除はしない）
        if (document._popupEscListenerSet) {
            console.log('🧹 ESCキーリスナー参照クリア');
        }
        
        // ポップアップ要素のイベントリスナークリア
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            if (element && element._clickListenerSet) {
                element._clickListenerSet = false;
                console.log(`🧹 ${popupId} イベントリスナークリア`);
            }
        }
    }
    
    cleanupDOMElements() {
        // オーバーレイ削除
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
            this.overlayElement = null;
            console.log('🧹 オーバーレイ削除完了');
        }
        
        // 動的作成されたポップアップ要素の削除
        // （既存のHTML要素は残す）
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            if (element && element.id === 'pen-settings-popup' && element.parentNode) {
                // pen-settings-popupは動的作成されるため削除
                element.parentNode.removeChild(element);
                console.log(`🧹 ${popupId} 動的要素削除完了`);
            }
        }
    }
    
    resetInternalState() {
        // 状態管理リセット
        this.state = {
            activePopup: null,
            isInitialized: false,
            initializationAttempts: 0,
            domElementsReady: false,
            eventListenersReady: false
        };
        
        // ポップアップ管理クリア
        this.popups.clear();
        
        // 統計情報リセット
        this.statistics = {
            showCount: 0,
            hideCount: 0,
            lastAction: null,
            lastActionTime: 0,
            operationTimes: new Map()
        };
        
        console.log('🔄 内部状態リセット完了');
    }
    
    cleanupManagementSystems() {
        // CSS管理システムクリーンアップ
        this.cssManager.cleanup();
        
        // アニメーション管理システムクリーンアップ
        this.animationManager.cleanup();
        
        // エラーハンドラーリセット
        this.errorHandler.reset();
        
        console.log('🧹 管理システムクリーンアップ完了');
    }
}

// ==== Phase 3: グローバル登録・エクスポート（DRY・SOLID準拠版）====
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
    
    // Phase 3: 統合デバッグ関数
    window.debugPopupManagerPhase3 = function() {
        if (window.penToolUI && window.penToolUI.components?.get('popupManager')) {
            window.penToolUI.components.get('popupManager').debug();
        } else if (window.uiManager && window.uiManager.popupManager) {
            window.uiManager.popupManager.debug();
        } else {
            console.warn('PopupManager が利用できません');
            
            // フォールバック: 直接要素確認
            console.group('🔍 PopupManager フォールバック確認（Phase 3）');
            const penSettings = document.getElementById('pen-settings-popup');
            console.log('pen-settings-popup要素:', {
                exists: !!penSettings,
                display: penSettings ? penSettings.style.display : 'N/A',
                visibility: penSettings ? penSettings.style.visibility : 'N/A',
                opacity: penSettings ? penSettings.style.opacity : 'N/A',
                className: penSettings ? penSettings.className : 'N/A'
            });
            
            const overlay = document.getElementById('popup-overlay');
            console.log('popup-overlay要素:', {
                exists: !!overlay,
                display: overlay ? overlay.style.display : 'N/A'
            });
            
            console.groupEnd();
        }
    };
    
    // Phase 3: 個別テスト関数
    window.testPopupManagerPhase3 = function() {
        console.log('🧪 PopupManager Phase 3 テスト開始...');
        
        const popupManager = window.penToolUI?.components?.get('popupManager') || 
                           window.uiManager?.popupManager;
        
        if (popupManager) {
            console.log('PopupManager発見、テスト実行中...');
            
            // 基本状態確認
            const status = popupManager.getStatus();
            console.log('基本状態:', {
                initialized: status.initialized,
                popupCount: status.popupCount,
                activePopup: status.activePopup
            });
            
            // パフォーマンス統計
            const perfStats = popupManager.getPerformanceStats();
            console.log('パフォーマンス統計:', perfStats);
            
            // ポップアップ表示テスト
            console.log('ポップアップ表示テスト実行中...');
            const showResult = popupManager.showPopup('pen-settings');
            console.log('表示テスト結果:', showResult);
            
            // 2秒後に非表示テスト
            setTimeout(() => {
                console.log('ポップアップ非表示テスト実行中...');
                const hideResult = popupManager.hidePopup('pen-settings');
                console.log('非表示テスト結果:', hideResult);
            }, 2000);
            
            return status;
        } else {
            console.warn('PopupManager が利用できません');
            return null;
        }
    };
    
    // Phase 3: ポップアップ制御関数（改善版）
    window.showPenSettingsPhase3 = function() {
        console.log('🧪 ペン設定表示テスト（Phase 3版）開始...');
        
        const popupManager = window.penToolUI?.components?.get('popupManager') || 
                           window.uiManager?.popupManager;
        
        if (popupManager) {
            const result = popupManager.showPopup('pen-settings');
            console.log('PopupManager経由結果:', result);
            return result;
        } else {
            // 高度なフォールバック表示
            const penSettings = document.getElementById('pen-settings-popup');
            if (penSettings) {
                // CSS強制適用
                penSettings.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    z-index: 10000 !important;
                    background: white !important;
                    border: 2px solid #800000 !important;
                    padding: 20px !important;
                `;
                console.log('高度なフォールバック表示実行');
                return true;
            } else {
                console.warn('pen-settings-popup要素が見つかりません');
                return false;
            }
        }
    };
    
    window.hidePenSettingsPhase3 = function() {
        console.log('❌ ペン設定非表示テスト（Phase 3版）開始...');
        
        const popupManager = window.penToolUI?.components?.get('popupManager') || 
                           window.uiManager?.popupManager;
        
        if (popupManager) {
            const result = popupManager.hidePopup('pen-settings');
            console.log('PopupManager経由結果:', result);
            return result;
        } else {
            const penSettings = document.getElementById('pen-settings-popup');
            if (penSettings) {
                penSettings.style.display = 'none';
                penSettings.style.visibility = 'hidden';
                penSettings.style.opacity = '0';
                console.log('フォールバック非表示実行');
                return true;
            }
            return false;
        }
    };
    
    // Phase 3: パフォーマンス統計表示
    window.getPopupManagerPerformance = function() {
        const popupManager = window.penToolUI?.components?.get('popupManager') || 
                           window.uiManager?.popupManager;
        
        if (popupManager && typeof popupManager.getPerformanceStats === 'function') {
            const stats = popupManager.getPerformanceStats();
            console.log('📊 PopupManager パフォーマンス統計:', stats);
            return stats;
        } else {
            console.warn('PopupManager パフォーマンス統計が利用できません');
            return null;
        }
    };
    
    // Phase 3: エラー統計リセット
    window.resetPopupManagerErrors = function() {
        const popupManager = window.penToolUI?.components?.get('popupManager') || 
                           window.uiManager?.popupManager;
        
        if (popupManager && popupManager.errorHandler) {
            popupManager.errorHandler.reset();
            console.log('✅ PopupManager エラー統計リセット完了');
        } else {
            console.warn('PopupManager エラーハンドラーが利用できません');
        }
    };
    
    console.log('✅ PopupManager Component Phase 3 DRY・SOLID準拠クリーンアップ版 読み込み完了');
    console.log('📦 エクスポートクラス（Phase 3 完全リファクタリング版）:');
    console.log('  ✅ PopupManager: ポップアップ制御（完全クリーンアップ版）');
    console.log('  ✅ PopupErrorHandler: 統一エラーハンドリング');
    console.log('  ✅ PopupCSSManager: CSS管理・検証・修正システム');
    console.log('  ✅ PopupAnimationManager: アニメーション制御システム');
    console.log('  ✅ PopupElementFactory: DOM要素作成ファクトリ');
    console.log('  ✅ PopupConfigUtils: 設定値安全取得ユーティリティ');
    console.log('🔧 Phase 3 改善完了:');
    console.log('  ✅ DRY原則完全準拠（重複コード削除）');
    console.log('  ✅ SOLID原則完全準拠（S・O・L・I・D）');
    console.log('  ✅ エラーハンドリング統一・ポップアップ別統計');
    console.log('  ✅ CSS検証・修正システム統一');
    console.log('  ✅ アニメーション制御統一・キャンセル機能');
    console.log('  ✅ DOM要素作成ファクトリパターン採用');
    console.log('  ✅ パフォーマンス統計・監視機能');
    console.log('  ✅ 初期化プロセス最適化・リトライ機能');
    console.log('🎯 機能: ポップアップ制御・アニメーション・CSS管理・統計収集');
    console.log('🔧 特徴: 統一エラーハンドリング・パフォーマンス監視・自動CSS修正');
    console.log('🐛 デバッグ関数（Phase 3版）:');
    console.log('  - window.debugPopupManagerPhase3() - 完全デバッグ情報表示');
    console.log('  - window.testPopupManagerPhase3() - Phase 3機能テスト');
    console.log('  - window.showPenSettingsPhase3() - ペン設定表示（高度版）');
    console.log('  - window.hidePenSettingsPhase3() - ペン設定非表示（高度版）');
    console.log('  - window.getPopupManagerPerformance() - パフォーマンス統計表示');
    console.log('  - window.resetPopupManagerErrors() - エラー統計リセット');
    console.log('📊 統合システム（Phase 3）:');
    console.log('  ✅ 統一エラーハンドリング: ポップアップ別統計・閾値制御');
    console.log('  ✅ CSS管理システム: 自動検証・修正・スタイル統一');
    console.log('  ✅ アニメーション管理: フェード制御・キャンセル・統計');
    console.log('  ✅ 要素作成ファクトリ: DOM生成・イベント設定・構造化');
    console.log('  ✅ 設定管理: CONFIG安全取得・デフォルト値・検証');
    console.log('  ✅ パフォーマンス監視: 操作時間・メモリ使用量・統計分析');
    console.log('🏆 Phase 3達成: DRY・SOLID原則完全準拠・保守性最大化完成');
}

console.log('🏆 PopupManager Component Phase 3 DRY・SOLID準拠クリーンアップ版 初期化完了');/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール
 * PopupManager Component - Phase 3 DRY・SOLID準拠クリーンアップ版
 * 
 * 🔧 Phase 3 改善内容:
 * 1. ✅ DRY原則完全準拠（重複コード削除）
 * 2. ✅ SOLID原則完全準拠（単一責任・開放閉鎖・依存逆転）
 * 3. ✅ エラーハンドリング統一・強化
 * 4. ✅ 初期化プロセス最適化
 * 5. ✅ CSS検証・修正システム統一
 * 6. ✅ アニメーション制御統一
 * 
 * ⚡ Phase 3実装: 完全クリーンアップ・保守性最大化
 * 🎯 目的: ポップアップ制御機能の完全統一・エラー分離・品質向上
 * 
 * 📦 実装内容:
 * - 統一エラーハンドリング・統計収集
 * - CSS検証・修正システム
 * - アニメーション制御システム
 * - DOM要素作成・管理システム
 * 
 * 🏗️ 設計原則: SOLID・DRY準拠、単一責任、依存注入、ファクトリパターン
 */

console.log('🔧 PopupManager Component Phase 3 DRY・SOLID準拠クリーンアップ版読み込み開始...');

// ==== Phase 3: CONFIG値安全取得ユーティリティ（DRY原則） ====
class PopupConfigUtils {
    static safeGet(key, defaultValue) {
        try {
            if (window.CONFIG && window.CONFIG[key] !== undefined && window.CONFIG[key] !== null) {
                return window.CONFIG[key];
            }
        } catch (error) {
            console.warn(`CONFIG.${key} アクセスエラー:`, error);
        }
        return defaultValue;
    }
    
    static getPopupDefaults() {
        return {
            fadeTime: this.safeGet('POPUP_FADE_TIME', 300),
            maxErrors: this.safeGet('MAX_ERRORS', 10),
            initTimeout: this.safeGet('INIT_TIMEOUT', 5000),
            retryAttempts: this.safeGet('RETRY_ATTEMPTS', 3),
            zIndexBase: this.safeGet('POPUP_Z_INDEX_BASE', 10000)
        };
    }
}

// ==== Phase 3: 統一エラーハンドリング ====
class PopupErrorHandler {
    constructor(maxErrors = 10, context = 'PopupManager') {
        this.maxErrors = maxErrors;
        this.context = context;
        this.errorCount = 0;
        this.errorLog = [];
        this.popupErrors = new Map();
    }
    
    handleError(error, subContext = '') {
        this.errorCount++;
        const fullContext = subContext ? `${this.context}.${subContext}` : this.context;
        
        const errorInfo = {
            timestamp: Date.now(),
            context: fullContext,
            message: error.message || error,
            count: this.errorCount
        };
        
        this.errorLog.push(errorInfo);
        
        // ポップアップ別エラー統計
        if (subContext.startsWith('popup_')) {
            const popupId = subContext.replace('popup_', '');
            const currentCount = this.popupErrors.get(popupId) || 0;
            this.popupErrors.set(popupId, currentCount + 1);
        }
        
        if (this.errorCount > this.maxErrors) {
            console.error(`❌ ${fullContext}: 最大エラー数 (${this.maxErrors}) に達しました。`);
            return false;
        }
        
        console.warn(`⚠️ ${fullContext} エラー ${this.errorCount}/${this.maxErrors}:`, error);
        return true;
    }
    
    getPopupErrorCount(popupId) {
        return this.popupErrors.get(popupId) || 0;
    }
    
    getStats() {
        return {
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            popupErrors: Object.fromEntries(this.popupErrors),
            recentErrors: this.errorLog.slice(-5)
        };
    }
    
    reset() {
        this.errorCount = 0;
        this.errorLog = [];
        this.popupErrors.clear();
    }
}

// ==== Phase 3: CSS管理システム（単一責任原則） ====
class PopupCSSManager {
    constructor(errorHandler) {
        this.errorHandler = errorHandler;
        this.validatedElements = new Set();
    }
    
    validateAndFixPopupCSS(element, popupId) {
        try {
            if (this.validatedElements.has(element)) {
                return true; // 既に検証済み
            }
            
            const computedStyle = window.getComputedStyle(element);
            const fixes = this.getRequiredCSSFixes(computedStyle);
            
            this.applyCSSFixes(element, fixes);
            this.validatedElements.add(element);
            
            if (Object.keys(fixes).length > 0) {
                console.log(`🔧 ${popupId} CSS修正完了:`, fixes);
            }
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, `CSSValidation_${popupId}`);
            return false;
        }
    }
    
    getRequiredCSSFixes(computedStyle) {
        const fixes = {};
        const requiredStyles = {
            position: 'fixed',
            zIndex: '10000'
        };
        
        for (const [property, expectedValue] of Object.entries(requiredStyles)) {
            const currentValue = computedStyle.getPropertyValue(property);
            if (currentValue !== expectedValue) {
                fixes[property] = expectedValue;
            }
        }
        
        return fixes;
    }
    
    applyCSSFixes(element, fixes) {
        for (const [property, value] of Object.entries(fixes)) {
            element.style.setProperty(property, value, 'important');
        }
    }
    
    createPopupBaseStyle(fadeTime, zIndex) {
        return `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #800000;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: ${zIndex};
            min-width: 300px;
            max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            visibility: hidden;
            opacity: 0;
            transition: opacity ${fadeTime}ms ease-out;
        `;
    }
    
    createOverlayStyle(fadeTime, zIndex) {
        return `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${zIndex - 1};
            opacity: 0;
            visibility: hidden;
            transition: opacity ${fadeTime}ms ease-out,
                       visibility ${fadeTime}ms ease-out;
            pointer-events: none;
        `;
    }
    
    cleanup() {
        this.validatedElements.clear();
    }
}

// ==== Phase 3: アニメーション制御システム（開放閉鎖原則） ====
class PopupAnimationManager {
    constructor(fadeTime, errorHandler) {
        this.fadeTime = fadeTime;
        this.errorHandler = errorHandler;
        this.activeAnimations = new Map();
    }
    
    showWithAnimation(element, popupId, onComplete = null) {
        try {
            // 既存のアニメーションをキャンセル
            this.cancelAnimation(popupId);
            
            // 強制表示
            this.forceShowElement(element);
            
            // フェードイン実行
            const animation = this.executeFadeIn(element, popupId, onComplete);
            this.activeAnimations.set(popupId, animation);
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, `ShowAnimation_${popupId}`);
            return false;
        }
    }
    
    hideWithAnimation(element, popupId, onComplete = null) {
        try {
            // 既存のアニメーションをキャンセル
            this.cancelAnimation(popupId);
            
            // フェードアウト実行
            const animation = this.executeFadeOut(element, popupId, onComplete);
            this.activeAnimations.set(popupId, animation);
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, `HideAnimation_${popupId}`);
            return false;
        }
    }
    
    forceShowElement(element) {
        const forceStyles = {
            display: 'block',
            visibility: 'visible',
            opacity: '0',
            pointerEvents: 'auto'
        };
        
        for (const [property, value] of Object.entries(forceStyles)) {
            element.style.setProperty(property, value, 'important');
        }
    }
    
    executeCompleteHide(element) {
        const hideStyles = {
            display: 'none',
            visibility