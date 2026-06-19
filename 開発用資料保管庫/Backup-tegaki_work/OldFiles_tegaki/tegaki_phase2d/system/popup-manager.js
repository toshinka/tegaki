/**
 * ============================================================================
 * ファイル名: system/popup-manager.js
 * 責務: ポップアップパネルの一元管理、初期化、表示・非表示、排他制御を担当する
 * 依存: system/event-bus.js
 * 被依存: ui-panels.js, export-popup.js等
 * 公開API: PopupManager
 * イベント発火: popup:*, popup:registered, popup:initialized, popup:show, popup:hide, popup:toggled, popup:all-hidden
 * イベント受信: なし
 * グローバル登録: window.PopupManager, window.TegakiPopupManager
 * 実装状態: ♻️移植
 * ============================================================================
 */

export class PopupManager {
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error('EventBus is required for PopupManager');
        }
        
        this.eventBus = eventBus;
        this.popups = new Map();
        this.activePopup = null;
        this.initializationQueue = [];
        
        console.log('✅ PopupManager initialized');
    }
    
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
            status: 'registered'
        };
        
        this.popups.set(name, popupData);
        this.initializationQueue.push(popupData);
        
        this.eventBus.emit('popup:registered', { name });
        
        console.log(`📋 Popup "${name}" registered (priority: ${popupData.config.priority})`);
        
        return true;
    }
    
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
        
        if (popupData.config.waitFor.length > 0) {
            const missingDeps = popupData.config.waitFor.filter(dep => {
                return !window[dep];
            });
            
            if (missingDeps.length > 0) {
                console.log(`⏳ Popup "${name}" waiting for: ${missingDeps.join(', ')}`);
                return false;
            }
        }
        
        popupData.status = 'initializing';
        
        try {
            const instance = new popupData.PopupClass(popupData.dependencies);
            
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
    
    initializeAll() {
        console.log('🔧 Initializing all popups...');
        
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
        
        if (deferred > 0) {
            this._setupDeferredInitialization();
        }
    }
    
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
    
    get(name) {
        const popupData = this.popups.get(name);
        
        if (!popupData) {
            console.warn(`⚠️ Popup "${name}" not registered`);
            return null;
        }
        
        if (popupData.status !== 'ready') {
            console.warn(`⚠️ Popup "${name}" not ready (status: ${popupData.status})`);
            this.initialize(name);
            return popupData.instance;
        }
        
        return popupData.instance;
    }
    
    show(name) {
        const instance = this.get(name);
        
        if (!instance) {
            console.error(`❌ Cannot show popup "${name}": not ready`);
            return false;
        }
        
        this.hideAll(name);
        
        instance.show();
        this.activePopup = name;
        
        this.eventBus.emit('popup:show', { name });
        
        console.log(`👁️ Popup "${name}" shown`);
        
        return true;
    }
    
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
        
        document.querySelectorAll('.popup-panel').forEach(popup => {
            const popupId = popup.id;
            
            if (exceptName === 'quickAccess' && popupId === 'quick-access-popup') {
                return;
            }
            
            if (exceptName && popupId === `${exceptName}-popup`) {
                return;
            }
            
            popup.classList.remove('show');
        });
        
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
        }
    }
    
    isVisible(name) {
        const instance = this.get(name);
        
        if (!instance) {
            return false;
        }
        
        return instance.isVisible === true;
    }
    
    isReady(name) {
        const popupData = this.popups.get(name);
        return popupData ? popupData.status === 'ready' : false;
    }
    
    getRegisteredPopups() {
        return Array.from(this.popups.keys());
    }
    
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
    
    getAllStatuses() {
        const statuses = [];
        
        this.popups.forEach((popupData, name) => {
            statuses.push(this.getStatus(name));
        });
        
        return statuses.sort((a, b) => a.priority - b.priority);
    }
}

// 下位互換性のためにグローバルに登録
window.TegakiPopupManager = PopupManager;
window.PopupManager = null; // CoreEngineで初期化
