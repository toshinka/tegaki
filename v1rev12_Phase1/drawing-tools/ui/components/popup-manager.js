/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール
 * PopupManager Component - ポップアップ問題修正版
 * 
 * 🔧 修正内容:
 * 1. ✅ 強制表示機能追加（display/visibility/opacity）
 * 2. ✅ 初期化プロセス確認強化
 * 3. ✅ DOM要素検証・作成機能
 * 4. ✅ エラーハンドリング改善
 * 5. ✅ フェードアニメーション最適化
 * 
 * ⚡ STEP 4実装: ペンツール専用ポップアップ制御移譲
 * 🎯 目的: ui-manager.jsからポップアップ制御機能を完全分離
 * 
 * 📦 実装内容:
 * - ペンツール専用ポップアップ制御システム
 * - ui-manager.js非依存でのポップアップ動作
 * - ESCキー・外部クリック対応
 * - 状態同期・エラーハンドリング
 * 
 * 🏗️ 設計原則: SOLID・DRY準拠、単一責任、依存注入
 */

console.log('🔧 PopupManager Component (ポップアップ問題修正版) 読み込み開始...');

// ==== CONFIG値安全取得（utils.js統合）====
function safeConfigGet(key, defaultValue) {
    try {
        if (window.CONFIG && window.CONFIG[key] !== undefined && window.CONFIG[key] !== null) {
            return window.CONFIG[key];
        }
    } catch (error) {
        console.warn(`CONFIG.${key} アクセスエラー:`, error);
    }
    return defaultValue;
}

/**
 * PopupManagerコンポーネント（ポップアップ問題修正版）
 * ペンツール専用ポップアップ制御システム
 */
class PopupManager {
    constructor() {
        console.log('📦 PopupManager初期化開始（ポップアップ問題修正版）...');
        
        // 基本設定
        this.popupFadeTime = safeConfigGet('POPUP_FADE_TIME', 300);
        this.maxErrors = safeConfigGet('MAX_ERRORS', 10);
        
        // 状態管理
        this.activePopup = null;
        this.popupStates = new Map();
        this.errorCount = 0;
        this.isInitialized = false;
        
        // 修正: 初期化状態詳細管理
        this.initializationAttempts = 0;
        this.maxInitAttempts = 3;
        this.domElementsReady = false;
        this.eventListenersReady = false;
        
        // ポップアップ要素キャッシュ
        this.popupElements = new Map();
        this.overlayElement = null;
        
        // 統計・デバッグ情報
        this.showCount = 0;
        this.hideCount = 0;
        this.lastAction = null;
        this.lastActionTime = 0;
        
        // 修正: ポップアップ問題対応設定
        this.forceShowEnabled = true;
        this.cssValidationEnabled = true;
        this.animationFallbackEnabled = true;
        
        console.log('✅ PopupManager初期化完了（ポップアップ問題修正版）');
    }
    
    /**
     * 修正: PopupManager初期化（ポップアップ問題修正版）
     */
    async init() {
        try {
            console.log('🎯 PopupManager初期化開始（ポップアップ問題修正版）...');
            
            this.initializationAttempts++;
            
            if (this.initializationAttempts > this.maxInitAttempts) {
                throw new Error(`初期化試行回数上限 (${this.maxInitAttempts}) に達しました`);
            }
            
            // 修正: 段階的初期化プロセス
            await this.validateDOMReady();
            await this.setupPopupElements();
            await this.setupEventListeners();
            await this.setupOverlay();
            
            // 修正: 初期化完了確認
            await this.validateInitialization();
            
            this.isInitialized = true;
            console.log('✅ PopupManager初期化完了（ポップアップ問題修正版）');
            
            return true;
            
        } catch (error) {
            console.error('❌ PopupManager初期化エラー（ポップアップ問題修正版）:', error);
            this.handleError(error);
            
            // 修正: リトライ処理
            if (this.initializationAttempts < this.maxInitAttempts) {
                console.log(`🔄 PopupManager初期化リトライ ${this.initializationAttempts}/${this.maxInitAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return await this.init();
            }
            
            throw error;
        }
    }
    
    /**
     * 修正: DOM準備状態確認
     */
    async validateDOMReady() {
        console.log('📄 DOM準備状態確認中...');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('DOM準備タイムアウト'));
            }, 5000);
            
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
     * 修正: ポップアップ要素セットアップ（要素作成機能付き）
     */
    async setupPopupElements() {
        console.log('📋 ポップアップ要素セットアップ開始（修正版）...');
        
        // ペン設定ポップアップ
        await this.setupPenSettingsPopup();
        
        // リサイズ設定ポップアップ
        await this.setupResizeSettingsPopup();
        
        this.domElementsReady = true;
        console.log(`📋 ポップアップ要素セットアップ完了: ${this.popupElements.size}個`);
    }
    
    /**
     * 修正: ペン設定ポップアップセットアップ（要素作成機能付き）
     */
    async setupPenSettingsPopup() {
        let penSettingsPopup = document.getElementById('pen-settings-popup');
        
        if (!penSettingsPopup) {
            console.log('🔧 pen-settings-popup要素が見つかりません → 作成します');
            penSettingsPopup = this.createPenSettingsPopup();
        }
        
        if (penSettingsPopup) {
            // 修正: CSS強制適用
            this.validateAndFixPopupCSS(penSettingsPopup, 'pen-settings');
            
            this.popupElements.set('pen-settings', penSettingsPopup);
            this.popupStates.set('pen-settings', {
                visible: false,
                element: penSettingsPopup,
                fadeTimeout: null,
                showCount: 0,
                hideCount: 0,
                cssValidated: true
            });
            
            console.log('✅ pen-settings-popup要素セットアップ完了');
        } else {
            console.error('❌ pen-settings-popup要素作成失敗');
        }
    }
    
    /**
     * 修正: ペン設定ポップアップ要素作成
     */
    createPenSettingsPopup() {
        const popup = document.createElement('div');
        popup.id = 'pen-settings-popup';
        popup.className = 'popup pen-settings-popup';
        
        // 修正: 確実な表示用CSS設定
        popup.style.cssText = `
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
            z-index: 10000;
            min-width: 300px;
            max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            visibility: hidden;
            opacity: 0;
            transition: opacity ${this.popupFadeTime}ms ease-out;
        `;
        
        popup.innerHTML = `
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
        
        // クリック時の伝播防止
        popup.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        
        // 閉じるボタン機能
        const closeBtn = popup.querySelector('.close-popup-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hidePopup('pen-settings');
            });
        }
        
        document.body.appendChild(popup);
        console.log('✅ pen-settings-popup要素作成完了');
        
        return popup;
    }
    
    /**
     * 修正: リサイズ設定ポップアップセットアップ
     */
    async setupResizeSettingsPopup() {
        const resizeSettingsPopup = document.getElementById('resize-settings-popup');
        if (resizeSettingsPopup) {
            this.validateAndFixPopupCSS(resizeSettingsPopup, 'resize-settings');
            
            this.popupElements.set('resize-settings', resizeSettingsPopup);
            this.popupStates.set('resize-settings', {
                visible: false,
                element: resizeSettingsPopup,
                fadeTimeout: null,
                showCount: 0,
                hideCount: 0,
                cssValidated: true
            });
            
            console.log('✅ resize-settings-popup要素確認完了');
        }
    }
    
    /**
     * 修正: ポップアップCSS検証・修正
     */
    validateAndFixPopupCSS(element, popupId) {
        if (!this.cssValidationEnabled) return;
        
        const computedStyle = window.getComputedStyle(element);
        
        // 必須スタイルの確認・修正
        const requiredStyles = {
            position: 'fixed',
            zIndex: '10000'
        };
        
        let modified = false;
        
        for (const [property, expectedValue] of Object.entries(requiredStyles)) {
            const currentValue = computedStyle.getPropertyValue(property);
            if (currentValue !== expectedValue) {
                element.style.setProperty(property, expectedValue, 'important');
                modified = true;
            }
        }
        
        if (modified) {
            console.log(`🔧 ${popupId} CSS修正完了`);
        }
    }
    
    /**
     * 修正: イベントリスナーセットアップ（強化版）
     */
    async setupEventListeners() {
        console.log('🎧 イベントリスナーセットアップ開始（修正版）...');
        
        // ESCキーでポップアップを閉じる（重複削除）
        if (!document._popupEscListenerSet) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.activePopup) {
                    event.preventDefault();
                    this.hidePopup(this.activePopup);
                }
            });
            document._popupEscListenerSet = true;
            console.log('✅ ESCキーリスナー設定完了');
        }
        
        // ポップアップ内クリック時の伝播防止
        for (const [popupId, element] of this.popupElements) {
            if (!element._clickListenerSet) {
                element.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                element._clickListenerSet = true;
                console.log(`✅ ${popupId} クリック伝播防止設定完了`);
            }
        }
        
        this.eventListenersReady = true;
        console.log('🎧 PopupManagerイベントリスナー設定完了（修正版）');
    }
    
    /**
     * 修正: オーバーレイセットアップ（強化版）
     */
    async setupOverlay() {
        console.log('🌫️ オーバーレイセットアップ開始（修正版）...');
        
        // 既存オーバーレイ確認
        this.overlayElement = document.getElementById('popup-overlay');
        
        if (!this.overlayElement) {
            // オーバーレイ作成
            this.overlayElement = document.createElement('div');
            this.overlayElement.id = 'popup-overlay';
            this.overlayElement.className = 'popup-overlay';
            this.overlayElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: opacity ${this.popupFadeTime}ms ease-out,
                           visibility ${this.popupFadeTime}ms ease-out;
                pointer-events: none;
            `;
            
            // オーバーレイクリックで閉じる
            this.overlayElement.addEventListener('click', (event) => {
                event.preventDefault();
                if (this.activePopup) {
                    this.hidePopup(this.activePopup);
                }
            });
            
            document.body.appendChild(this.overlayElement);
            console.log('🌫️ ポップアップオーバーレイ作成完了');
        }
        
        // 修正: オーバーレイCSS検証
        this.validateOverlayCSS();
    }
    
    /**
     * 修正: オーバーレイCSS検証
     */
    validateOverlayCSS() {
        if (this.overlayElement) {
            const computedStyle = window.getComputedStyle(this.overlayElement);
            
            if (computedStyle.position !== 'fixed') {
                this.overlayElement.style.position = 'fixed';
                console.log('🔧 オーバーレイposition修正');
            }
            
            if (parseInt(computedStyle.zIndex) < 9999) {
                this.overlayElement.style.zIndex = '9999';
                console.log('🔧 オーバーレイz-index修正');
            }
        }
    }
    
    /**
     * 修正: 初期化完了確認
     */
    async validateInitialization() {
        console.log('🔍 初期化完了確認中...');
        
        const validationResults = {
            domElementsReady: this.domElementsReady,
            eventListenersReady: this.eventListenersReady,
            popupElementsCount: this.popupElements.size,
            popupStatesCount: this.popupStates.size,
            overlayElement: !!this.overlayElement
        };
        
        console.log('📊 初期化検証結果:', validationResults);
        
        const requiredElements = ['pen-settings'];
        const missingElements = requiredElements.filter(id => !this.popupElements.has(id));
        
        if (missingElements.length > 0) {
            throw new Error(`必須ポップアップ要素が不足: ${missingElements.join(', ')}`);
        }
        
        if (!this.overlayElement) {
            throw new Error('オーバーレイ要素が作成されていません');
        }
        
        console.log('✅ 初期化完了確認成功');
    }
    
    /**
     * 修正: ポップアップ表示（強制表示機能付き）
     */
    showPopup(popupId) {
        try {
            console.log(`📋 ポップアップ表示開始: ${popupId} (修正版)`);
            
            if (!this.isInitialized) {
                console.warn('PopupManagerが初期化されていません');
                return false;
            }
            
            const popupState = this.popupStates.get(popupId);
            if (!popupState) {
                console.warn(`ポップアップが見つかりません: ${popupId}`);
                return false;
            }
            
            // 他のポップアップを閉じる
            if (this.activePopup && this.activePopup !== popupId) {
                this.hidePopup(this.activePopup);
            }
            
            // 既に表示中の場合
            if (popupState.visible) {
                console.log(`ポップアップ既に表示中: ${popupId}`);
                return true;
            }
            
            // フェードアウトタイマークリア
            if (popupState.fadeTimeout) {
                clearTimeout(popupState.fadeTimeout);
                popupState.fadeTimeout = null;
            }
            
            // オーバーレイ表示
            this.showOverlay();
            
            // 修正: 強制表示処理
            const element = popupState.element;
            
            // 段階的表示処理
            this.forceShowElement(element);
            
            // フェードイン
            if (this.animationFallbackEnabled) {
                this.performFadeIn(element);
            } else {
                element.style.opacity = '1';
            }
            
            // 状態更新
            popupState.visible = true;
            popupState.showCount++;
            this.activePopup = popupId;
            this.showCount++;
            this.lastAction = 'show';
            this.lastActionTime = Date.now();
            
            console.log(`✅ ポップアップ表示完了: ${popupId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ ポップアップ表示エラー (${popupId}):`, error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * 修正: 要素強制表示
     */
    forceShowElement(element) {
        if (!this.forceShowEnabled) return;
        
        // 修正: 全ての表示関連プロパティを強制設定
        const forceStyles = {
            display: 'block',
            visibility: 'visible',
            opacity: '0',
            pointerEvents: 'auto'
        };
        
        for (const [property, value] of Object.entries(forceStyles)) {
            element.style.setProperty(property, value, 'important');
        }
        
        console.log('🔧 要素強制表示処理完了');
    }
    
    /**
     * 修正: フェードイン処理
     */
    performFadeIn(element) {
        // フェードイン用タイマー
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${this.popupFadeTime}ms ease-out`;
                element.style.setProperty('opacity', '1', 'important');
                
                console.log('✨ フェードイン開始');
            });
        });
    }
    
    /**
     * 修正: ポップアップ非表示（改善版）
     */
    hidePopup(popupId) {
        try {
            console.log(`❌ ポップアップ非表示開始: ${popupId} (修正版)`);
            
            if (!this.isInitialized) {
                console.warn('PopupManagerが初期化されていません');
                return false;
            }
            
            const popupState = this.popupStates.get(popupId);
            if (!popupState) {
                console.warn(`ポップアップが見つかりません: ${popupId}`);
                return false;
            }
            
            // 既に非表示の場合
            if (!popupState.visible) {
                console.log(`ポップアップ既に非表示: ${popupId}`);
                return true;
            }
            
            const element = popupState.element;
            
            // フェードアウト
            element.style.transition = `opacity ${this.popupFadeTime}ms ease-out`;
            element.style.opacity = '0';
            
            // フェードアウト完了後に非表示
            popupState.fadeTimeout = setTimeout(() => {
                this.completeHideAnimation(popupId, popupState, element);
            }, this.popupFadeTime);
            
            // 統計更新
            this.hideCount++;
            this.lastAction = 'hide';
            this.lastActionTime = Date.now();
            
            console.log(`✅ ポップアップ非表示開始: ${popupId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ ポップアップ非表示エラー (${popupId}):`, error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * 修正: 非表示アニメーション完了処理
     */
    completeHideAnimation(popupId, popupState, element) {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.pointerEvents = 'none';
        
        // 状態更新
        popupState.visible = false;
        popupState.hideCount++;
        popupState.fadeTimeout = null;
        
        // アクティブポップアップ更新
        if (this.activePopup === popupId) {
            this.activePopup = null;
            this.hideOverlay();
        }
        
        console.log(`🏁 ポップアップ非表示完了: ${popupId}`);
    }
    
    /**
     * ポップアップトグル
     */
    togglePopup(popupId) {
        const popupState = this.popupStates.get(popupId);
        if (!popupState) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        if (popupState.visible) {
            return this.hidePopup(popupId);
        } else {
            return this.showPopup(popupId);
        }
    }
    
    /**
     * 全ポップアップ非表示
     */
    hideAllPopups() {
        try {
            let hiddenCount = 0;
            
            for (const [popupId, popupState] of this.popupStates) {
                if (popupState.visible) {
                    this.hidePopup(popupId);
                    hiddenCount++;
                }
            }
            
            if (hiddenCount > 0) {
                console.log(`📋 ${hiddenCount}個のポップアップを非表示にしました`);
            }
            
            return hiddenCount > 0;
            
        } catch (error) {
            console.error('❌ 全ポップアップ非表示エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * オーバーレイ表示
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
    
    /**
     * オーバーレイ非表示
     */
    hideOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '0';
            setTimeout(() => {
                if (this.overlayElement && !this.activePopup) {
                    this.overlayElement.style.visibility = 'hidden';
                    this.overlayElement.style.pointerEvents = 'none';
                }
            }, this.popupFadeTime);
        }
    }
    
    /**
     * ポップアップ状態取得
     */
    getPopupState(popupId) {
        const popupState = this.popupStates.get(popupId);
        if (!popupState) {
            return null;
        }
        
        return {
            visible: popupState.visible,
            showCount: popupState.showCount,
            hideCount: popupState.hideCount,
            hasFadeTimeout: !!popupState.fadeTimeout,
            cssValidated: popupState.cssValidated || false
        };
    }
    
    /**
     * 修正: 全ポップアップ状態取得（詳細版）
     */
    getStatus() {
        const popupStatuses = {};
        
        for (const [popupId, popupState] of this.popupStates) {
            popupStatuses[popupId] = this.getPopupState(popupId);
        }
        
        return {
            initialized: this.isInitialized,
            activePopup: this.activePopup,
            popupCount: this.popupStates.size,
            errorCount: this.errorCount,
            
            // 修正: 初期化詳細状況追加
            initialization: {
                attempts: this.initializationAttempts,
                maxAttempts: this.maxInitAttempts,
                domElementsReady: this.domElementsReady,
                eventListenersReady: this.eventListenersReady
            },
            
            // 修正: ポップアップ問題対応設定
            popupFix: {
                forceShowEnabled: this.forceShowEnabled,
                cssValidationEnabled: this.cssValidationEnabled,
                animationFallbackEnabled: this.animationFallbackEnabled
            },
            
            statistics: {
                totalShows: this.showCount,
                totalHides: this.hideCount,
                lastAction: this.lastAction,
                lastActionTime: this.lastActionTime
            },
            popups: popupStatuses
        };
    }
    
    /**
     * エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`PopupManager: 最大エラー数 (${this.maxErrors}) に達しました。`);
            return;
        }
        
        console.warn(`PopupManager エラー ${this.errorCount}/${this.maxErrors}:`, error);
    }
    
    /**
     * 修正: デバッグ情報表示（詳細版）
     */
    debug() {
        console.group('🔍 PopupManager デバッグ情報（ポップアップ問題修正版）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            activePopup: this.activePopup,
            popupCount: this.popupStates.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`
        });
        
        console.log('初期化詳細:', {
            attempts: `${this.initializationAttempts}/${this.maxInitAttempts}`,
            domElementsReady: this.domElementsReady,
            eventListenersReady: this.eventListenersReady
        });
        
        console.log('ポップアップ問題対応設定:', {
            forceShowEnabled: this.forceShowEnabled,
            cssValidationEnabled: this.cssValidationEnabled,
            animationFallbackEnabled: this.animationFallbackEnabled
        });
        
        console.log('統計情報:', {
            totalShows: this.showCount,
            totalHides: this.hideCount,
            lastAction: this.lastAction,
            lastActionTime: this.lastActionTime ? new Date(this.lastActionTime).toLocaleTimeString() : 'なし'
        });
        
        console.log('ポップアップ状態:');
        for (const [popupId, popupState] of this.popupStates) {
            const elementInfo = {
                visible: popupState.visible,
                shows: popupState.showCount,
                hides: popupState.hideCount,
                hasFadeTimeout: !!popupState.fadeTimeout,
                element: !!popupState.element,
                cssValidated: popupState.cssValidated || false
            };
            
            if (popupState.element) {
                const computedStyle = window.getComputedStyle(popupState.element);
                elementInfo.currentDisplay = computedStyle.display;
                elementInfo.currentVisibility = computedStyle.visibility;
                elementInfo.currentOpacity = computedStyle.opacity;
            }
            
            console.log(`  ${popupId}:`, elementInfo);
        }
        
        console.log('DOM要素状況:', {
            overlay: !!this.overlayElement,
            popupElements: this.popupElements.size,
            penSettingsExists: !!document.getElementById('pen-settings-popup'),
            bodyChildren: document.body.children.length
        });
        
        // 修正: ポップアップ要素詳細確認
        console.log('要素詳細確認:');
        const penSettings = document.getElementById('pen-settings-popup');
        if (penSettings) {
            console.log('  pen-settings-popup:', {
                id: penSettings.id,
                className: penSettings.className,
                display: penSettings.style.display,
                visibility: penSettings.style.visibility,
                opacity: penSettings.style.opacity,
                zIndex: penSettings.style.zIndex,
                position: penSettings.style.position
            });
        } else {
            console.log('  pen-settings-popup: 要素が見つかりません');
        }
        
        console.groupEnd();
    }
    
    /**
     * 修正: クリーンアップ（強化版）
     */
    destroy() {
        try {
            console.log('🧹 PopupManager クリーンアップ開始（ポップアップ問題修正版）...');
            
            // 全ポップアップ非表示
            this.hideAllPopups();
            
            // フェードタイマークリア
            for (const popupState of this.popupStates.values()) {
                if (popupState.fadeTimeout) {
                    clearTimeout(popupState.fadeTimeout);
                    popupState.fadeTimeout = null;
                }
            }
            
            // 修正: イベントリスナークリーンアップ
            if (document._popupEscListenerSet) {
                // ESCキーリスナーは他のPopupManagerでも使用される可能性があるため、
                // グローバルフラグのみリセット（実際のリスナー削除はしない）
                console.log('🧹 ESCキーリスナー参照クリア');
            }
            
            // ポップアップ要素のイベントリスナークリア
            for (const [popupId, element] of this.popupElements) {
                if (element._clickListenerSet) {
                    element._clickListenerSet = false;
                    console.log(`🧹 ${popupId} イベントリスナークリア`);
                }
            }
            
            // オーバーレイ削除
            if (this.overlayElement && this.overlayElement.parentNode) {
                this.overlayElement.parentNode.removeChild(this.overlayElement);
                this.overlayElement = null;
                console.log('🧹 オーバーレイ削除完了');
            }
            
            // 参照クリア
            this.popupStates.clear();
            this.popupElements.clear();
            this.activePopup = null;
            this.isInitialized = false;
            this.domElementsReady = false;
            this.eventListenersReady = false;
            
            console.log('✅ PopupManager クリーンアップ完了（ポップアップ問題修正版）');
            
        } catch (error) {
            console.error('❌ PopupManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（ポップアップ問題修正版）====
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
    
    // 修正: ポップアップ問題修正版デバッグ関数
    window.debugPopupManagerFixed = function() {
        if (window.penToolUI && window.penToolUI.components?.popupManager) {
            window.penToolUI.components.popupManager.debug();
        } else if (window.uiManager && window.uiManager.popupManager) {
            window.uiManager.popupManager.debug();
        } else {
            console.warn('PopupManager が利用できません');
            
            // フォールバック: 直接要素確認
            console.group('🔍 PopupManager フォールバック確認');
            const penSettings = document.getElementById('pen-settings-popup');
            console.log('pen-settings-popup要素:', {
                exists: !!penSettings,
                display: penSettings ? penSettings.style.display : 'N/A',
                visibility: penSettings ? penSettings.style.visibility : 'N/A',
                opacity: penSettings ? penSettings.style.opacity : 'N/A'
            });
            console.groupEnd();
        }
    };
    
    window.showPenSettingsFixed = function() {
        console.log('🧪 ペン設定表示テスト（修正版）開始...');
        
        if (window.penToolUI && window.penToolUI.components?.popupManager) {
            const result = window.penToolUI.components.popupManager.showPopup('pen-settings');
            console.log('PopupManager経由結果:', result);
            return result;
        } else {
            // フォールバック表示
            const penSettings = document.getElementById('pen-settings-popup');
            if (penSettings) {
                penSettings.style.display = 'block';
                penSettings.style.visibility = 'visible';
                penSettings.style.opacity = '1';
                console.log('フォールバック表示実行');
                return true;
            } else {
                console.warn('pen-settings-popup要素が見つかりません');
                return false;
            }
        }
    };
    
    window.hidePenSettingsFixed = function() {
        console.log('❌ ペン設定非表示テスト（修正版）開始...');
        
        if (window.penToolUI && window.penToolUI.components?.popupManager) {
            const result = window.penToolUI.components.popupManager.hidePopup('pen-settings');
            console.log('PopupManager経由結果:', result);
            return result;
        } else {
            // フォールバック非表示
            const penSettings = document.getElementById('pen-settings-popup');
            if (penSettings) {
                penSettings.style.display = 'none';
                penSettings.style.visibility = 'hidden';
                penSettings.style.opacity = '0';
                console.log('フォールバック非表示実行');
                return true;
            } else {
                console.warn('pen-settings-popup要素が見つかりません');
                return false;
            }
        }
    };
    
    window.hideAllPopupsFixed = function() {
        console.log('📋 全ポップアップ非表示テスト（修正版）開始...');
        
        if (window.penToolUI && window.penToolUI.components?.popupManager) {
            return window.penToolUI.components.popupManager.hideAllPopups();
        } else if (window.uiManager && window.uiManager.hideAllPopups) {
            return window.uiManager.hideAllPopups();
        } else {
            console.warn('PopupManager が利用できません');
            return false;
        }
    };
    
    // 修正: ポップアップ要素強制作成関数
    window.createPenSettingsPopupForced = function() {
        console.log('🔧 pen-settings-popup強制作成開始...');
        
        const existing = document.getElementById('pen-settings-popup');
        if (existing) {
            console.log('⚠️ pen-settings-popup既に存在します');
            return existing;
        }
        
        // PopupManagerインスタンスを作成して要素作成
        const tempManager = new PopupManager();
        const popup = tempManager.createPenSettingsPopup();
        
        console.log('✅ pen-settings-popup強制作成完了');
        return popup;
    };
    
    console.log('✅ PopupManager Component (ポップアップ問題修正版) 読み込み完了');
    console.log('📦 エクスポートクラス: PopupManager（ポップアップ問題修正版）');
    console.log('🔧 修正内容:');
    console.log('  ✅ 強制表示機能追加（display/visibility/opacity）');
    console.log('  ✅ 初期化プロセス確認強化・リトライ処理');
    console.log('  ✅ DOM要素検証・自動作成機能');
    console.log('  ✅ エラーハンドリング改善・詳細ログ');
    console.log('  ✅ フェードアニメーション最適化・フォールバック');
    console.log('  ✅ CSS検証・修正機能');
    console.log('🎯 機能: ペンツール専用ポップアップ制御（問題修正版）');
    console.log('🔧 特徴: ui-manager.js非依存・ESC/外部クリック対応・状態同期・強制表示');
    console.log('🐛 デバッグ関数（ポップアップ問題修正版）:');
    console.log('  - window.debugPopupManagerFixed() - PopupManager詳細表示（修正版）');
    console.log('  - window.showPenSettingsFixed() - ペン設定表示（修正版）');
    console.log('  - window.hidePenSettingsFixed() - ペン設定非表示（修正版）');
    console.log('  - window.hideAllPopupsFixed() - 全ポップアップ非表示（修正版）');
    console.log('  - window.createPenSettingsPopupForced() - ポップアップ要素強制作成');
}

console.log('🏆 PopupManager Component (ポップアップ問題修正版) 初期化完了');/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール
 * PopupManager Component - ポップアップ問題修正版
 * 
 * 🔧 修正内容:
 * 1. ✅ 強制表示機能追加（display/visibility/opacity）
 * 2. ✅ 初期化プロセス確認強化
 * 3. ✅ DOM要素検証・作成機能
 * 4. ✅ エラーハンドリング改善
 * 5. ✅ フェードアニメーション最適化
 * 
 * ⚡ STEP 4実装: ペンツール専用ポップアップ制御移譲
 * 🎯 目的: ui-manager.jsからポップアップ制御機能を完全分離
 * 
 * 📦 実装内容:
 * - ペンツール専用