/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Task 1-B先行実装: popup-manager.js 重複排除・統一システム完全統合版
 * 🎯 DRY・SOLID原則完全準拠・ポップアップ統一管理
 * 
 * 🎯 AI_WORK_SCOPE: ポップアップ統一管理・ドラッグ機能・排他制御
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, EventBus（統一システム完全依存）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🚨 重複排除内容: 設定値統一・エラー処理統一・EventBus完全移行・冗長コード削除
 */

class PopupManager {
    constructor() {
        this.version = 'v1.0-Phase1-DRY-SOLID';
        this.validateUnifiedSystems();
        this.initializeConfig();
        
        // ポップアップ管理
        this.popups = new Map();
        this.activePopup = null;
        this.currentZIndex = this.config.baseZIndex;
        
        // ドラッグ管理
        this.dragState = {
            isDragging: false,
            currentPopup: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0
        };
        
        // 設定保存（メモリ内）
        this.settings = {
            positions: {},
            visibility: {},
            zIndexOrder: []
        };
        
        console.log('🖼️ PopupManager 構築完了（DRY・SOLID準拠版）');
    }
    
    /**
     * 🚨 統一システム依存性確認（必須前提条件）
     */
    validateUnifiedSystems() {
        const requiredSystems = ['ConfigManager', 'ErrorManager', 'EventBus'];
        const missing = requiredSystems.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error('PopupManager統一システム依存性エラー: ' + missing.join(', '));
        }
        
        console.log('✅ PopupManager統一システム依存性確認完了');
    }
    
    /**
     * 🚨 重複排除: ConfigManager統一設定読み込み
     */
    initializeConfig() {
        const uiConfig = window.ConfigManager.getUIConfig();
        this.config = {
            baseZIndex: uiConfig.popup?.baseZIndex || 1000,
            animationDuration: uiConfig.popup?.animationDuration || 300,
            dragEnabled: uiConfig.popup?.dragEnabled || true,
            exclusiveMode: uiConfig.popup?.exclusiveMode || true,
            escapeToClose: uiConfig.popup?.escapeToClose || true,
            autosavePosition: uiConfig.popup?.autosavePosition || true
        };
    }
    
    /**
     * 🚨 重複排除: 統一初期化
     */
    initialize() {
        console.log('🖼️ PopupManager 統一初期化開始（DRY・SOLID準拠版）');
        
        try {
            this.discoverPopups();
            this.setupGlobalEventListeners();
            this.setupInitialState();
            this.setupEventBusIntegration();
            
            window.EventBus.safeEmit('popup.manager.initialized', {
                popupCount: this.popups.size,
                version: this.version
            });
            
            console.log('✅ PopupManager統一初期化完了: ' + this.popups.size + '個のポップアップ');
            return this;
            
        } catch (error) {
            window.ErrorManager.showError('error', 'PopupManager初期化エラー: ' + error.message, {
                showReload: true
            });
            return this;
        }
    }
    
    /**
     * 既存ポップアップ自動検出
     */
    discoverPopups() {
        console.log('🔍 既存ポップアップ自動検出開始...');
        
        const popupElements = document.querySelectorAll('.popup-panel');
        let discoveredCount = 0;
        
        popupElements.forEach(element => {
            try {
                const popupId = element.id;
                if (!popupId) {
                    console.warn('⚠️ IDのないポップアップを発見 - スキップ');
                    return;
                }
                
                const popupInfo = this.createPopupInfo(element);
                this.popups.set(popupId, popupInfo);
                
                if (this.config.dragEnabled) {
                    this.setupPopupDrag(popupId);
                }
                
                this.hidePopup(popupId, false);
                discoveredCount++;
                
            } catch (error) {
                window.ErrorManager.showError('warning', 'ポップアップ検出エラー: ' + error.message);
            }
        });
        
        console.log('✅ ポップアップ自動検出完了: ' + discoveredCount + '個');
        
        window.EventBus.safeEmit('popup.discovery.completed', {
            discoveredCount: discoveredCount,
            popupIds: Array.from(this.popups.keys())
        });
    }
    
    /**
     * ポップアップ情報作成
     */
    createPopupInfo(element) {
        const titleElement = element.querySelector('.popup-title');
        
        return {
            id: element.id,
            element: element,
            titleElement: titleElement,
            title: titleElement ? titleElement.textContent : element.id,
            visible: false,
            zIndex: this.config.baseZIndex,
            draggable: this.config.dragEnabled && !!titleElement,
            position: this.getElementPosition(element),
            size: this.getElementSize(element)
        };
    }
    
    /**
     * 🚨 重複排除: ポップアップドラッグ機能設定
     */
    setupPopupDrag(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo || !popupInfo.draggable) return;
        
        const titleElement = popupInfo.titleElement;
        
        const handleMouseDown = (event) => {
            event.preventDefault();
            
            this.dragState.isDragging = true;
            this.dragState.currentPopup = popupId;
            
            const rect = popupInfo.element.getBoundingClientRect();
            this.dragState.offsetX = event.clientX - rect.left;
            this.dragState.offsetY = event.clientY - rect.top;
            
            this.bringToFront(popupId);
            
            titleElement.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            
            window.EventBus.safeEmit('popup.drag.started', { popupId: popupId });
            console.log('🖱️ ドラッグ開始: ' + popupId);
        };
        
        titleElement.addEventListener('mousedown', handleMouseDown);
        titleElement.style.cursor = 'grab';
        titleElement.style.userSelect = 'none';
        
        console.log('✅ ドラッグ設定完了: ' + popupId);
    }
    
    /**
     * 🚨 重複排除: グローバルイベントリスナー設定
     */
    setupGlobalEventListeners() {
        console.log('🎯 グローバルイベントリスナー設定...');
        
        // Escapeキー処理
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.config.escapeToClose) {
                const closedCount = this.closeAllPopups();
                if (closedCount > 0) {
                    event.preventDefault();
                }
            }
        });
        
        // マウス移動処理（ドラッグ用）
        document.addEventListener('mousemove', (event) => {
            if (!this.dragState.isDragging || !this.dragState.currentPopup) return;
            
            const popupInfo = this.popups.get(this.dragState.currentPopup);
            if (!popupInfo) return;
            
            const newX = event.clientX - this.dragState.offsetX;
            const newY = event.clientY - this.dragState.offsetY;
            
            const constrainedPos = this.constrainToViewport(newX, newY, popupInfo);
            this.setPopupPosition(this.dragState.currentPopup, constrainedPos.x, constrainedPos.y);
        });
        
        // マウスアップ処理（ドラッグ終了）
        document.addEventListener('mouseup', (event) => {
            if (this.dragState.isDragging) {
                const popupId = this.dragState.currentPopup;
                
                this.dragState.isDragging = false;
                this.dragState.currentPopup = null;
                
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                if (popupId) {
                    const popupInfo = this.popups.get(popupId);
                    if (popupInfo && popupInfo.titleElement) {
                        popupInfo.titleElement.style.cursor = 'grab';
                    }
                    
                    if (this.config.autosavePosition) {
                        this.savePopupPosition(popupId);
                    }
                    
                    window.EventBus.safeEmit('popup.drag.ended', { popupId: popupId });
                    console.log('🖱️ ドラッグ終了: ' + popupId);
                }
            }
        });
        
        // ウィンドウリサイズ処理
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        console.log('✅ グローバルイベントリスナー設定完了');
    }
    
    /**
     * EventBus統合設定
     */
    setupEventBusIntegration() {
        window.EventBus.on('popup.show', (data) => {
            if (data.popupId) {
                this.showPopup(data.popupId);
            }
        });
        
        window.EventBus.on('popup.hide', (data) => {
            if (data.popupId) {
                this.hidePopup(data.popupId);
            }
        });
        
        window.EventBus.on('popup.closeAll', () => {
            this.closeAllPopups();
        });
        
        console.log('✅ EventBus統合設定完了');
    }
    
    /**
     * 初期状態設定
     */
    setupInitialState() {
        this.popups.forEach((popupInfo, popupId) => {
            this.hidePopup(popupId, false);
        });
        
        this.restorePopupSettings();
        
        console.log('✅ 初期状態設定完了');
    }
    
    // ==========================================
    // 🚨 重複排除: 公開API（統一版）
    // ==========================================
    
    /**
     * ポップアップ表示（排他制御付き）
     */
    showPopup(popupId, exclusive = null) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            window.ErrorManager.showError('warning', '不明なポップアップID: ' + popupId);
            return false;
        }
        
        try {
            const useExclusive = exclusive !== null ? exclusive : this.config.exclusiveMode;
            
            if (useExclusive && this.activePopup && this.activePopup !== popupId) {
                this.hidePopup(this.activePopup);
            }
            
            popupInfo.element.style.display = 'block';
            popupInfo.visible = true;
            this.activePopup = popupId;
            
            this.bringToFront(popupId);
            this.settings.visibility[popupId] = true;
            
            window.EventBus.safeEmit('popup.opened', {
                popupId: popupId,
                title: popupInfo.title,
                position: popupInfo.position
            });
            
            console.log('🖼️ ポップアップ表示: ' + popupId);
            return true;
            
        } catch (error) {
            window.ErrorManager.showError('error', 'ポップアップ表示エラー ' + popupId + ': ' + error.message);
            return false;
        }
    }
    
    /**
     * ポップアップ非表示
     */
    hidePopup(popupId, fireEvents = true) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) return false;
        
        try {
            popupInfo.element.style.display = 'none';
            popupInfo.visible = false;
            
            if (this.activePopup === popupId) {
                this.activePopup = null;
            }
            
            if (fireEvents) {
                this.settings.visibility[popupId] = false;
                
                window.EventBus.safeEmit('popup.closed', {
                    popupId: popupId,
                    title: popupInfo.title
                });
                
                console.log('🖼️ ポップアップ非表示: ' + popupId);
            }
            
            return true;
            
        } catch (error) {
            window.ErrorManager.showError('error', 'ポップアップ非表示エラー ' + popupId + ': ' + error.message);
            return false;
        }
    }
    
    /**
     * ポップアップ表示切り替え
     */
    togglePopup(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) return false;
        
        if (popupInfo.visible) {
            return this.hidePopup(popupId);
        } else {
            return this.showPopup(popupId);
        }
    }
    
    /**
     * 🚨 重複排除: 全ポップアップ閉じる
     */
    closeAllPopups() {
        console.log('🖼️ 全ポップアップ閉じる...');
        
        let closedCount = 0;
        this.popups.forEach((popupInfo, popupId) => {
            if (popupInfo.visible) {
                this.hidePopup(popupId);
                closedCount++;
            }
        });
        
        this.activePopup = null;
        
        window.EventBus.safeEmit('popup.all.closed', { closedCount: closedCount });
        
        console.log('✅ 全ポップアップ閉じる完了: ' + closedCount + '個');
        return closedCount;
    }
    
    // ==========================================
    // ユーティリティメソッド
    // ==========================================
    
    /**
     * ポップアップ前面移動
     */
    bringToFront(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) return false;
        
        this.currentZIndex++;
        popupInfo.zIndex = this.currentZIndex;
        popupInfo.element.style.zIndex = this.currentZIndex;
        
        this.settings.zIndexOrder = this.settings.zIndexOrder.filter(id => id !== popupId);
        this.settings.zIndexOrder.push(popupId);
        
        return true;
    }
    
    /**
     * ポップアップ位置設定
     */
    setPopupPosition(popupId, x, y) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) return false;
        
        popupInfo.element.style.left = x + 'px';
        popupInfo.element.style.top = y + 'px';
        popupInfo.position = { x: x, y: y };
        
        return true;
    }
    
    /**
     * 要素位置取得
     */
    getElementPosition(element) {
        const style = window.getComputedStyle(element);
        const left = parseInt(style.left) || 0;
        const top = parseInt(style.top) || 0;
        return { x: left, y: top };
    }
    
    /**
     * 要素サイズ取得
     */
    getElementSize(element) {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }
    
    /**
     * ビューポート制約
     */
    constrainToViewport(x, y, popupInfo) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const popupWidth = popupInfo.size.width;
        const popupHeight = popupInfo.size.height;
        
        const constrainedX = Math.max(0, Math.min(viewportWidth - popupWidth, x));
        const constrainedY = Math.max(0, Math.min(viewportHeight - popupHeight, y));
        
        return { x: constrainedX, y: constrainedY };
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        this.popups.forEach((popupInfo, popupId) => {
            if (popupInfo.visible) {
                const currentPos = this.getElementPosition(popupInfo.element);
                const constrainedPos = this.constrainToViewport(currentPos.x, currentPos.y, popupInfo);
                
                if (constrainedPos.x !== currentPos.x || constrainedPos.y !== currentPos.y) {
                    this.setPopupPosition(popupId, constrainedPos.x, constrainedPos.y);
                }
            }
        });
    }
    
    /**
     * ポップアップ位置保存
     */
    savePopupPosition(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (popupInfo) {
            this.settings.positions[popupId] = { ...popupInfo.position };
        }
    }
    
    /**
     * ポップアップ設定復元
     */
    restorePopupSettings() {
        Object.entries(this.settings.positions).forEach(([popupId, position]) => {
            this.setPopupPosition(popupId, position.x, position.y);
        });
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        const totalPopups = this.popups.size;
        const visiblePopups = Array.from(this.popups.values()).filter(info => info.visible).length;
        const draggablePopups = Array.from(this.popups.values()).filter(info => info.draggable).length;
        
        return {
            version: this.version,
            unifiedSystems: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus
            },
            total: totalPopups,
            visible: visiblePopups,
            draggable: draggablePopups,
            activePopup: this.activePopup,
            currentZIndex: this.currentZIndex,
            config: { ...this.config }
        };
    }
    
    /**
     * 全ポップアップ一覧取得
     */
    getAllPopups() {
        const popupList = [];
        this.popups.forEach((popupInfo, popupId) => {
            popupList.push({
                id: popupId,
                title: popupInfo.title,
                visible: popupInfo.visible,
                position: { ...popupInfo.position },
                draggable: popupInfo.draggable
            });
        });
        return popupList;
    }
    
    /**
     * アクティブポップアップ取得
     */
    getActivePopup() {
        return this.activePopup;
    }
    
    /**
     * ポップアップ情報取得
     */
    getPopupInfo(popupId) {
        return this.popups.get(popupId) || null;
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
            warnings.push('ポップアップ未検出');
        }
        
        if (stats.currentZIndex > 2000) {
            warnings.push('Z-index値が大きすぎる: ' + stats.currentZIndex);
            recommendations.push('Z-indexをリセットしてください');
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
     * 設定更新
     */
    updateConfig(newConfig) {
        try {
            if (window.ConfigManager) {
                Object.entries(newConfig).forEach(([key, value]) => {
                    window.ConfigManager.set('ui.popup.' + key, value);
                });
            }
            
            this.config = { ...this.config, ...newConfig };
            
            window.EventBus.safeEmit('popup.config.updated', newConfig);
            
            console.log('✅ PopupManager設定更新完了', newConfig);
            return true;
            
        } catch (error) {
            window.ErrorManager.showError('error', '設定更新エラー: ' + error.message);
            return false;
        }
    }
    
    /**
     * クリーンアップ
     */
    cleanup() {
        try {
            window.EventBus.safeEmit('popup.manager.cleanup', {
                totalPopups: this.popups.size,
                version: this.version
            });
            
            console.log('🖼️ PopupManager クリーンアップ完了（DRY・SOLID準拠版）');
            
        } catch (error) {
            window.ErrorManager.showError('warning', 'PopupManagerクリーンアップエラー: ' + error.message);
        }
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
    
    // デバッグ用ヘルパー関数
    window.testPopupManager = () => {
        if (window.PopupManager) {
            const manager = new PopupManager();
            manager.initialize();
            return manager.healthCheck();
        }
        return { error: 'PopupManager未初期化' };
    };
    
    window.getPopupStats = () => {
        if (window.popupManager) {
            return window.popupManager.getStats();
        }
        return { error: 'PopupManagerインスタンス未作成' };
    };
    
    console.log('✅ PopupManager DRY・SOLID準拠版 グローバル公開完了');
    console.log('💡 使用例: const pm = new PopupManager(); pm.initialize();');
    console.log('🔧 デバッグ: window.testPopupManager() で動作確認');
}