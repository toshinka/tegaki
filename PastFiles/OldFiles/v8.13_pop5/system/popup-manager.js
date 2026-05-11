// ===== system/popup-manager.js =====
// 責務: ポップアップの一元管理
// - 初期化・登録の統一
// - 参照管理の統一
// - 排他制御の実装
// - EventBus統合

window.TegakiPopupManager = class PopupManager {
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error('EventBus is required for PopupManager');
        }
        
        this.eventBus = eventBus;
        this.popups = new Map(); // name -> { instance, PopupClass, dependencies, config, status }
        this.activePopup = null;
        this.initializationQueue = [];
        
        console.log('✅ PopupManager initialized');
    }
    
    /**
     * ポップアップを登録
     * @param {string} name - ポップアップ識別名
     * @param {class} PopupClass - ポップアップクラス
     * @param {object} dependencies - 依存オブジェクト
     * @param {object} config - 設定 { priority, waitFor }
     */
    register(name, PopupClass, dependencies = {}, config = {}) {
        if (this.popups.has(name)) {
            console.warn(`⚠️ Popup "${name}" is already registered`);
            return false;
        }
        
        const popupData = {
            name,
            PopupClass,
            dependencies,
            config: {
                priority: config.priority || 99,
                waitFor: config.waitFor || []
            },
            instance: null,
            status: 'registered' // registered -> initializing -> ready -> failed
        };
        
        this.popups.set(name, popupData);
        this.initializationQueue.push(popupData);
        
        this.eventBus.emit('popup:registered', { name });
        
        console.log(`📋 Popup "${name}" registered (priority: ${popupData.config.priority})`);
        
        return true;
    }
    
    /**
     * 個別ポップアップを初期化
     * @param {string} name - ポップアップ識別名
     * @returns {boolean} 初期化成功/失敗
     */
    initialize(name) {
        const popupData = this.popups.get(name);
        
        if (!popupData) {
            console.error(`❌ Popup "${name}" not registered`);
            return false;
        }
        
        if (popupData.status === 'ready') {
            console.log(`✅ Popup "${name}" already initialized`);
            return true;
        }
        
        // 依存関係チェック
        if (popupData.config.waitFor.length > 0) {
            const missingDeps = popupData.config.waitFor.filter(dep => {
                // グローバル変数の存在チェック
                return !window[dep];
            });
            
            if (missingDeps.length > 0) {
                console.log(`⏳ Popup "${name}" waiting for: ${missingDeps.join(', ')}`);
                return false;
            }
        }
        
        popupData.status = 'initializing';
        
        try {
            // インスタンス生成
            const instance = new popupData.PopupClass(popupData.dependencies);
            
            // 必須メソッドの確認
            if (typeof instance.show !== 'function' || 
                typeof instance.hide !== 'function' || 
                typeof instance.toggle !== 'function') {
                throw new Error(`Popup "${name}" missing required methods (show/hide/toggle)`);
            }
            
            popupData.instance = instance;
            popupData.status = 'ready';
            
            this.eventBus.emit('popup:initialized', { name });
            
            console.log(`✅ Popup "${name}" initialized successfully`);
            
            return true;
            
        } catch (error) {
            popupData.status = 'failed';
            this.eventBus.emit('popup:initialization-failed', { name, error: error.message });
            
            console.error(`❌ Popup "${name}" initialization failed:`, error);
            
            return false;
        }
    }
    
    /**
     * すべてのポップアップを優先順位順に初期化
     */
    initializeAll() {
        console.log('🔧 Initializing all popups...');
        
        // 優先順位でソート
        this.initializationQueue.sort((a, b) => a.config.priority - b.config.priority);
        
        let initialized = 0;
        let deferred = 0;
        
        this.initializationQueue.forEach(popupData => {
            const success = this.initialize(popupData.name);
            if (success) {
                initialized++;
            } else {
                deferred++;
            }
        });
        
        console.log(`📊 Popup initialization: ${initialized} ready, ${deferred} deferred`);
        
        // 遅延初期化が必要なポップアップのリトライ設定
        if (deferred > 0) {
            this._setupDeferredInitialization();
        }
    }
    
    /**
     * 遅延初期化のリトライ処理
     * @private
     */
    _setupDeferredInitialization() {
        const maxRetries = 20;
        let retryCount = 0;
        
        const retryInitialization = () => {
            let stillWaiting = false;
            
            this.popups.forEach((popupData, name) => {
                if (popupData.status === 'registered') {
                    const success = this.initialize(name);
                    if (!success) {
                        stillWaiting = true;
                    }
                }
            });
            
            retryCount++;
            
            if (stillWaiting && retryCount < maxRetries) {
                setTimeout(retryInitialization, 200);
            } else if (stillWaiting) {
                console.warn(`⚠️ Some popups failed to initialize after ${maxRetries} retries`);
                this.popups.forEach((popupData, name) => {
                    if (popupData.status === 'registered') {
                        console.warn(`  - "${name}" still waiting for: ${popupData.config.waitFor.join(', ')}`);
                    }
                });
            } else {
                console.log('✅ All deferred popups initialized');
            }
        };
        
        setTimeout(retryInitialization, 200);
    }
    
    /**
     * ポップアップインスタンスを取得
     * @param {string} name - ポップアップ識別名
     * @returns {object|null} ポップアップインスタンス
     */
    get(name) {
        const popupData = this.popups.get(name);
        
        if (!popupData) {
            console.warn(`⚠️ Popup "${name}" not registered`);
            return null;
        }
        
        if (popupData.status !== 'ready') {
            console.warn(`⚠️ Popup "${name}" not ready (status: ${popupData.status})`);
            // リトライ試行
            this.initialize(name);
            return popupData.instance; // null の可能性あり
        }
        
        return popupData.instance;
    }
    
    /**
     * ポップアップを表示（排他制御付き）
     * @param {string} name - ポップアップ識別名
     */
    show(name) {
        const instance = this.get(name);
        
        if (!instance) {
            console.error(`❌ Cannot show popup "${name}": not ready`);
            return false;
        }
        
        // 他のポップアップを閉じる
        this.hideAll(name);
        
        // 表示
        instance.show();
        this.activePopup = name;
        
        this.eventBus.emit('popup:show', { name });
        
        console.log(`👁️ Popup "${name}" shown`);
        
        return true;
    }
    
    /**
     * ポップアップを非表示
     * @param {string} name - ポップアップ識別名
     */
    hide(name) {
        const instance = this.get(name);
        
        if (!instance) {
            return false;
        }
        
        instance.hide();
        
        if (this.activePopup === name) {
            this.activePopup = null;
        }
        
        this.eventBus.emit('popup:hide', { name });
        
        console.log(`🙈 Popup "${name}" hidden`);
        
        return true;
    }
    
    /**
     * ポップアップの表示/非表示を切り替え
     * @param {string} name - ポップアップ識別名
     */
    toggle(name) {
        const instance = this.get(name);
        
        if (!instance) {
            console.error(`❌ Cannot toggle popup "${name}": not ready`);
            return false;
        }
        
        const wasVisible = this.isVisible(name);
        
        if (wasVisible) {
            this.hide(name);
        } else {
            this.show(name);
        }
        
        this.eventBus.emit('popup:toggled', { name, isVisible: !wasVisible });
        
        return true;
    }
    
    /**
     * すべてのポップアップを閉じる
     * @param {string} exceptName - 除外するポップアップ名
     */
    hideAll(exceptName = null) {
        let hiddenCount = 0;
        
        this.popups.forEach((popupData, name) => {
            if (name !== exceptName && popupData.instance) {
                if (this.isVisible(name)) {
                    popupData.instance.hide();
                    hiddenCount++;
                }
            }
        });
        
        // DOM直接操作でも確実に閉じる
        document.querySelectorAll('.popup-panel').forEach(popup => {
            if (popup.id !== `${exceptName}-popup`) {
                popup.classList.remove('show');
            }
        });
        
        // リサイズポップアップも対象
        const resizePopup = document.getElementById('resize-settings');
        if (resizePopup && exceptName !== 'resize') {
            resizePopup.classList.remove('show');
        }
        
        if (exceptName !== null) {
            this.activePopup = exceptName;
        } else {
            this.activePopup = null;
        }
        
        if (hiddenCount > 0) {
            this.eventBus.emit('popup:all-hidden', { exceptName, hiddenCount });
            console.log(`🙈 Closed ${hiddenCount} popups (except: ${exceptName || 'none'})`);
        }
    }
    
    /**
     * ポップアップが表示されているか確認
     * @param {string} name - ポップアップ識別名
     * @returns {boolean}
     */
    isVisible(name) {
        const instance = this.get(name);
        
        if (!instance) {
            return false;
        }
        
        return instance.isVisible === true;
    }
    
    /**
     * ポップアップが初期化済みか確認
     * @param {string} name - ポップアップ識別名
     * @returns {boolean}
     */
    isReady(name) {
        const popupData = this.popups.get(name);
        return popupData ? popupData.status === 'ready' : false;
    }
    
    /**
     * 登録されているポップアップ一覧を取得
     * @returns {Array} ポップアップ名の配列
     */
    getRegisteredPopups() {
        return Array.from(this.popups.keys());
    }
    
    /**
     * ポップアップの状態情報を取得
     * @param {string} name - ポップアップ識別名
     * @returns {object|null}
     */
    getStatus(name) {
        const popupData = this.popups.get(name);
        
        if (!popupData) {
            return null;
        }
        
        return {
            name,
            status: popupData.status,
            isVisible: this.isVisible(name),
            priority: popupData.config.priority,
            waitFor: popupData.config.waitFor
        };
    }
    
    /**
     * すべてのポップアップの状態を取得（デバッグ用）
     * @returns {Array}
     */
    getAllStatuses() {
        const statuses = [];
        
        this.popups.forEach((popupData, name) => {
            statuses.push(this.getStatus(name));
        });
        
        return statuses.sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * 診断情報を出力
     */
    diagnose() {
        console.log('=== PopupManager Diagnostics ===');
        console.log('Registered popups:', this.getRegisteredPopups().length);
        console.log('Active popup:', this.activePopup || 'none');
        console.log('\nPopup statuses:');
        
        const statuses = this.getAllStatuses();
        statuses.forEach(status => {
            const icon = status.status === 'ready' ? '✅' : 
                        status.status === 'failed' ? '❌' : 
                        status.status === 'initializing' ? '⏳' : '📋';
            const visibleIcon = status.isVisible ? '👁️' : '🙈';
            
            console.log(`  ${icon} ${visibleIcon} ${status.name} (priority: ${status.priority}, status: ${status.status})`);
            
            if (status.waitFor && status.waitFor.length > 0) {
                console.log(`      Waiting for: ${status.waitFor.join(', ')}`);
            }
        });
        
        console.log('================================');
    }
};

// グローバル公開
window.PopupManager = null; // インスタンスは後で設定

console.log('✅ popup-manager.js loaded');