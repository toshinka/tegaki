// ===== system/popup-manager.js =====
// 責務: ポップアップの一元管理
// ✅ 修正: hideAll()でquickAccessを確実に除外（name照合に統一）

window.TegakiPopupManager = class PopupManager {
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error('EventBus is required for PopupManager');
        }
        
        this.eventBus = eventBus;
        this.popups = new Map();
        this.activePopup = null;
        this.initializationQueue = [];
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
        
        return true;
    }
    
    initialize(name) {
        const popupData = this.popups.get(name);
        
        if (!popupData) {
            console.error(`❌ Popup "${name}" not registered`);
            return false;
        }
        
        if (popupData.status === 'ready') {
            return true;
        }
        
        if (popupData.config.waitFor.length > 0) {
            const missingDeps = popupData.config.waitFor.filter(dep => {
                return !window[dep];
            });
            
            if (missingDeps.length > 0) {
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
            
            return true;
            
        } catch (error) {
            popupData.status = 'failed';
            this.eventBus.emit('popup:initialization-failed', { name, error: error.message });
            
            console.error(`❌ Popup "${name}" initialization failed:`, error);
            
            return false;
        }
    }
    
    initializeAll() {
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
            }
        };
        
        setTimeout(retryInitialization, 200);
    }
    
    get(name) {
        const popupData = this.popups.get(name);
        
        if (!popupData) {
            return null;
        }
        
        if (popupData.status !== 'ready') {
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
        
        // ✅ 修正: exceptName として name を渡す
        this.hideAll(name);
        
        instance.show();
        this.activePopup = name;
        
        this.eventBus.emit('popup:show', { name });
        
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
    
    // ✅ 修正: exceptName の照合をname基準に統一
    hideAll(exceptName = null) {
        let hiddenCount = 0;
        
        // ✅ 1. Mapに登録されたインスタンス経由で非表示（name照合）
        this.popups.forEach((popupData, name) => {
            // ✅ name で照合
            if (name === exceptName) {
                return;
            }
            
            if (popupData.instance && popupData.status === 'ready') {
                if (this.isVisible(name)) {
                    popupData.instance.hide();
                    hiddenCount++;
                }
            }
        });
        
        // ✅ 2. DOM直接操作でも確実に閉じる（name→id変換）
        document.querySelectorAll('.popup-panel').forEach(popup => {
            const popupId = popup.id;
            
            // ✅ exceptName から期待されるIDを生成
            let exceptId = null;
            if (exceptName) {
                // quickAccess → quick-access-popup
                // resize → resize-settings
                // settings → settings-popup など
                if (exceptName === 'quickAccess') {
                    exceptId = 'quick-access-popup';
                } else if (exceptName === 'resize') {
                    exceptId = 'resize-settings';
                } else {
                    exceptId = `${exceptName}-popup`;
                }
            }
            
            // ✅ 除外対象のIDは非表示にしない
            if (popupId === exceptId) {
                return;
            }
            
            popup.classList.remove('show');
        });
        
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

window.PopupManager = null;