/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Task 1-A-5: popup-manager.js 統一システム統合版
 * 
 * 🎯 AI_WORK_SCOPE: ポップアップ統一管理・ドラッグ機能・排他制御・Escapeキー対応
 * 🎯 DEPENDENCIES: 
 *    - ConfigManager（設定値統合）
 *    - ErrorManager（エラー処理統一）
 *    - EventBus（疎結合通信）
 * 🎯 NODE_MODULES: lodash（要素管理最適化）
 * 🎯 PIXI_EXTENSIONS: なし（DOM操作専用）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 
 * 📋 PHASE_TARGET: Phase1.4-A5 - 統一システム完全統合
 * 📋 DRY_COMPLIANCE: ✅ 統一システム活用・重複コード排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 * 📋 UNIFIED_SYSTEMS: ✅ ConfigManager + ErrorManager + EventBus
 */

/**
 * Task 1-A-5: ポップアップ統一管理システム（統一システム統合版）
 * 🚨 統合機能:
 * 1. ConfigManager統合: 設定値の一元管理
 * 2. ErrorManager統合: エラー処理の統一
 * 3. EventBus統合: 疎結合イベント通信
 * 4. 既存の `.popup-panel` 要素自動検出・管理
 * 5. ドラッグ機能（`.popup-title` をハンドルに使用）
 * 6. Escapeキーで全ポップアップ閉じる
 * 7. 排他制御（1つ表示時に他を自動非表示）
 * 8. Z-index管理で重なり順制御
 * 9. 設定保存・復元機能
 */
class PopupManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-A5-Unified';
        this.name = 'popup-manager';
        
        // 🚨 統一システム依存性確認
        this.configManager = window.ConfigManager;
        this.errorManager = window.ErrorManager;
        this.eventBus = window.EventBus;
        
        if (!this.configManager || !this.errorManager || !this.eventBus) {
            this._handleMissingDependencies();
        }
        
        // ポップアップ管理
        this.popups = new Map(); // ID -> PopupInfo
        this.activePopup = null;
        
        // 🚨 ConfigManager統合: 設定値の取得
        this.config = {
            baseZIndex: this._getConfig('ui.popup.baseZIndex', 1000),
            animationDuration: this._getConfig('ui.popup.animationDuration', 300),
            dragEnabled: this._getConfig('ui.popup.dragEnabled', true),
            exclusiveMode: this._getConfig('ui.popup.exclusiveMode', true),
            escapeToClose: this._getConfig('ui.popup.escapeToClose', true),
            autosavePosition: this._getConfig('ui.popup.autosavePosition', true)
        };
        
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
        
        // 設定保存（localStorage代替 - メモリ保存）
        this.settings = {
            positions: {}, // popup-id -> { x, y }
            visibility: {}, // popup-id -> boolean
            zIndexOrder: [] // popup-id順
        };
        
        // 拡張ライブラリ確認
        this.lodashAvailable = typeof window._ !== 'undefined';
        
        // イベントリスナー管理
        this.eventListeners = {
            keydown: null,
            mousemove: null,
            mouseup: null,
            resize: null
        };
        
        console.log(`🖼️ PopupManager 統一システム統合版構築 - ${this.version}`);
    }
    
    /**
     * 🚨 統一システム統合: 初期化
     */
    initialize() {
        console.group(`🖼️ PopupManager 統一システム統合初期化 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存性最終確認
            this._validateUnifiedSystems();
            
            // Phase 2: DOM要素検出・登録
            this.discoverPopups();
            
            // Phase 3: イベントリスナー設定
            this.setupGlobalEventListeners();
            
            // Phase 4: 初期状態設定
            this.setupInitialState();
            
            // Phase 5: EventBus統合
            this._setupEventBusIntegration();
            
            const initTime = performance.now() - startTime;
            
            // 🚨 EventBus統合: 初期化完了イベント発行
            this._emitEvent('POPUP_MANAGER_INITIALIZED', {
                popupCount: this.popups.size,
                initTime: initTime
            });
            
            console.log(`✅ PopupManager統一システム統合初期化完了 - ${initTime.toFixed(2)}ms`);
            return this;
            
        } catch (error) {
            // 🚨 ErrorManager統合: エラー処理の統一
            this._showError('error', `PopupManager初期化エラー: ${error.message}`, {
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
                alert(`PopupManager: ${errorMsg}\n\n統一システムが正しく初期化されていません。`);
            }
            
            throw new Error(errorMsg);
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 🚨 統一システム統合: 既存ポップアップ自動検出
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
                
                // ドラッグ機能設定
                if (this.config.dragEnabled) {
                    this.setupPopupDrag(popupId);
                }
                
                // 初期非表示設定
                this.hidePopup(popupId, false); // イベント発火なし
                
                discoveredCount++;
                
            } catch (error) {
                // 🚨 ErrorManager統合
                this._showError('warning', `ポップアップ検出エラー: ${error.message}`);
            }
        });
        
        console.log(`✅ ポップアップ自動検出完了: ${discoveredCount}個`);
        
        // 検出結果表示
        if (discoveredCount > 0) {
            const popupIds = Array.from(this.popups.keys());
            console.log(`📋 検出されたポップアップ: [${popupIds.join(', ')}]`);
        }
        
        // 🚨 EventBus統合: 検出完了イベント
        this._emitEvent('POPUP_DISCOVERY_COMPLETED', {
            discoveredCount,
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
            size: this.getElementSize(element),
            dragHandlers: {
                mousedown: null,
                mousemove: null,
                mouseup: null
            }
        };
    }
    
    /**
     * 🚨 統一システム統合: ポップアップドラッグ機能設定
     */
    setupPopupDrag(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo || !popupInfo.draggable) return;
        
        const titleElement = popupInfo.titleElement;
        
        // マウスダウンイベント
        popupInfo.dragHandlers.mousedown = (event) => {
            event.preventDefault();
            
            this.dragState.isDragging = true;
            this.dragState.currentPopup = popupId;
            
            const rect = popupInfo.element.getBoundingClientRect();
            this.dragState.offsetX = event.clientX - rect.left;
            this.dragState.offsetY = event.clientY - rect.top;
            this.dragState.startX = event.clientX;
            this.dragState.startY = event.clientY;
            
            // ポップアップを前面に移動
            this.bringToFront(popupId);
            
            // カーソル変更
            titleElement.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            
            // 🚨 EventBus統合: ドラッグ開始イベント
            this._emitEvent('POPUP_DRAG_STARTED', { popupId });
            
            console.log(`🖱️ ドラッグ開始: ${popupId}`);
        };
        
        // イベント登録
        titleElement.addEventListener('mousedown', popupInfo.dragHandlers.mousedown);
        
        // ドラッグハンドル表示
        titleElement.style.cursor = 'grab';
        titleElement.style.userSelect = 'none';
        
        console.log(`✅ ドラッグ設定完了: ${popupId}`);
    }
    
    /**
     * 🚨 統一システム統合: グローバルイベントリスナー設定
     */
    setupGlobalEventListeners() {
        console.log('🎯 グローバルイベントリスナー設定...');
        
        // Escapeキー処理
        this.eventListeners.keydown = (event) => {
            if (event.key === 'Escape' && this.config.escapeToClose) {
                const closedCount = this.closeAllPopups();
                if (closedCount > 0) {
                    event.preventDefault();
                }
            }
        };
        
        // マウス移動処理（ドラッグ用）
        this.eventListeners.mousemove = (event) => {
            if (!this.dragState.isDragging || !this.dragState.currentPopup) return;
            
            const popupInfo = this.popups.get(this.dragState.currentPopup);
            if (!popupInfo) return;
            
            const newX = event.clientX - this.dragState.offsetX;
            const newY = event.clientY - this.dragState.offsetY;
            
            // ビューポート境界チェック
            const constrainedPos = this.constrainToViewport(newX, newY, popupInfo);
            
            // 位置更新
            this.setPopupPosition(this.dragState.currentPopup, constrainedPos.x, constrainedPos.y);
        };
        
        // マウスアップ処理（ドラッグ終了）
        this.eventListeners.mouseup = (event) => {
            if (this.dragState.isDragging) {
                const popupId = this.dragState.currentPopup;
                
                // ドラッグ状態リセット
                this.dragState.isDragging = false;
                this.dragState.currentPopup = null;
                
                // カーソル復元
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                if (popupId) {
                    const popupInfo = this.popups.get(popupId);
                    if (popupInfo && popupInfo.titleElement) {
                        popupInfo.titleElement.style.cursor = 'grab';
                    }
                    
                    // 位置保存
                    if (this.config.autosavePosition) {
                        this.savePopupPosition(popupId);
                    }
                    
                    // 🚨 EventBus統合: ドラッグ終了イベント
                    this._emitEvent('POPUP_DRAG_ENDED', { popupId });
                    
                    console.log(`🖱️ ドラッグ終了: ${popupId}`);
                }
            }
        };
        
        // ウィンドウリサイズ処理
        this.eventListeners.resize = () => {
            this.handleWindowResize();
        };
        
        // イベント登録
        document.addEventListener('keydown', this.eventListeners.keydown);
        document.addEventListener('mousemove', this.eventListeners.mousemove);
        document.addEventListener('mouseup', this.eventListeners.mouseup);
        window.addEventListener('resize', this.eventListeners.resize);
        
        console.log('✅ グローバルイベントリスナー設定完了');
    }
    
    /**
     * 🚨 統一システム統合: EventBus統合設定
     */
    _setupEventBusIntegration() {
        // 標準イベントリスナー設定
        if (this.eventBus && this.eventBus.Events) {
            // UI関連イベントのリスナー設定例
            this.eventBus.on(this.eventBus.Events.POPUP_OPENED, (data) => {
                console.log('📡 EventBus: POPUP_OPENED受信', data);
            });
            
            this.eventBus.on(this.eventBus.Events.POPUP_CLOSED, (data) => {
                console.log('📡 EventBus: POPUP_CLOSED受信', data);
            });
        }
        
        console.log('✅ EventBus統合設定完了');
    }
    
    /**
     * 初期状態設定
     */
    setupInitialState() {
        console.log('🎯 初期状態設定...');
        
        // すべてのポップアップを非表示に
        this.popups.forEach((popupInfo, popupId) => {
            this.hidePopup(popupId, false); // イベント発火なし
        });
        
        // 保存された位置・状態復元
        this.restorePopupSettings();
        
        console.log('✅ 初期状態設定完了');
    }
    
    // ==========================================
    // 🚨 統一システム統合: 公開API
    // ==========================================
    
    /**
     * ポップアップ表示（排他制御付き）
     */
    showPopup(popupId, exclusive = null) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            this._showError('warning', `不明なポップアップID: ${popupId}`);
            return false;
        }
        
        try {
            // 🚨 ConfigManager統合: 排他制御設定
            const useExclusive = exclusive !== null ? exclusive : this.config.exclusiveMode;
            
            // 排他制御
            if (useExclusive && this.activePopup && this.activePopup !== popupId) {
                this.hidePopup(this.activePopup);
            }
            
            // 表示
            popupInfo.element.style.display = 'block';
            popupInfo.visible = true;
            this.activePopup = popupId;
            
            // 前面に移動
            this.bringToFront(popupId);
            
            // 設定保存
            this.settings.visibility[popupId] = true;
            
            // 🚨 EventBus統合: ポップアップ表示イベント
            this._emitEvent('POPUP_OPENED', {
                popupId,
                title: popupInfo.title,
                position: popupInfo.position
            });
            
            console.log(`🖼️ ポップアップ表示: ${popupId}`);
            return true;
            
        } catch (error) {
            this._showError('error', `ポップアップ表示エラー ${popupId}: ${error.message}`);
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
            // 非表示
            popupInfo.element.style.display = 'none';
            popupInfo.visible = false;
            
            // アクティブポップアップ更新
            if (this.activePopup === popupId) {
                this.activePopup = null;
            }
            
            // 設定保存
            if (fireEvents) {
                this.settings.visibility[popupId] = false;
                
                // 🚨 EventBus統合: ポップアップ非表示イベント
                this._emitEvent('POPUP_CLOSED', {
                    popupId,
                    title: popupInfo.title
                });
            }
            
            if (fireEvents) {
                console.log(`🖼️ ポップアップ非表示: ${popupId}`);
            }
            return true;
            
        } catch (error) {
            this._showError('error', `ポップアップ非表示エラー ${popupId}: ${error.message}`);
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
     * 🚨 統一システム統合: 全ポップアップ閉じる（Escapeキー用）
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
        
        // 🚨 EventBus統合: 全ポップアップ閉じるイベント
        this._emitEvent('ALL_POPUPS_CLOSED', { closedCount });
        
        console.log(`✅ 全ポップアップ閉じる完了: ${closedCount}個`);
        return closedCount;
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
            console.error(`PopupManager ${type.toUpperCase()}:`, message);
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
        const message = 'PopupManager: 統一システム依存性不足\n必要: ConfigManager, ErrorManager, EventBus';
        console.error('❌', message);
        
        // フォールバック設定
        this.configManager = null;
        this.errorManager = null;
        this.eventBus = null;
    }
    
    // ==========================================
    // 既存ユーティリティメソッド（統合版）
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
        
        // Z-index順序記録
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
        
        popupInfo.element.style.left = `${x}px`;
        popupInfo.element.style.top = `${y}px`;
        
        popupInfo.position = { x, y };
        
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
        
        // 境界制限
        const constrainedX = Math.max(0, Math.min(viewportWidth - popupWidth, x));
        const constrainedY = Math.max(0, Math.min(viewportHeight - popupHeight, y));
        
        return { x: constrainedX, y: constrainedY };
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        // すべての表示中ポップアップを境界内に調整
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
        // 位置復元
        Object.entries(this.settings.positions).forEach(([popupId, position]) => {
            this.setPopupPosition(popupId, position.x, position.y);
        });
    }
    
    /**
     * 統計情報取得（統合版）
     */
    getStats() {
        const totalPopups = this.popups.size;
        const visiblePopups = Array.from(this.popups.values()).filter(info => info.visible).length;
        const draggablePopups = Array.from(this.popups.values()).filter(info => info.draggable).length;
        
        return {
            version: this.version,
            unifiedSystems: {
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                eventBus: !!this.eventBus
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
        
        // ポップアップ状態チェック
        if (stats.total === 0) {
            warnings.push('ポップアップ未検出');
        }
        
        if (stats.currentZIndex > 2000) {
            warnings.push(`Z-index値が大きすぎる: ${stats.currentZIndex}`);
            recommendations.push('Z-indexをリセットしてください');
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
     * 🚨 統一システム統合: 設定更新
     */
    updateConfig(newConfig) {
        try {
            // ConfigManagerに設定を保存
            if (this.configManager) {
                Object.entries(newConfig).forEach(([key, value]) => {
                    this.configManager.set(`ui.popup.${key}`, value);
                });
            }
            
            // ローカル設定更新
            this.config = { ...this.config, ...newConfig };
            
            // 設定変更イベント
            this._emitEvent('POPUP_CONFIG_UPDATED', newConfig);
            
            console.log('✅ PopupManager設定更新完了', newConfig);
            return true;
            
        } catch (error) {
            this._showError('error', `設定更新エラー: ${error.message}`);
            return false;
        }
    }
    
    /**
     * クリーンアップ（統合版）
     */
    cleanup() {
        try {
            // イベントリスナー削除
            if (this.eventListeners.keydown) {
                document.removeEventListener('keydown', this.eventListeners.keydown);
            }
            if (this.eventListeners.mousemove) {
                document.removeEventListener('mousemove', this.eventListeners.mousemove);
            }
            if (this.eventListeners.mouseup) {
                document.removeEventListener('mouseup', this.eventListeners.mouseup);
            }
            if (this.eventListeners.resize) {
                window.removeEventListener('resize', this.eventListeners.resize);
            }
            
            // ポップアップ別イベントリスナー削除
            this.popups.forEach((popupInfo) => {
                if (popupInfo.dragHandlers.mousedown && popupInfo.titleElement) {
                    popupInfo.titleElement.removeEventListener('mousedown', popupInfo.dragHandlers.mousedown);
                }
            });
            
            // EventBusのリスナー削除（必要に応じて）
            if (this.eventBus) {
                // 特定のイベントタイプのリスナーを削除する場合
                // this.eventBus.offAll('POPUP_OPENED');
            }
            
            // 🚨 EventBus統合: クリーンアップ完了イベント
            this._emitEvent('POPUP_MANAGER_CLEANUP', {
                totalPopups: this.popups.size,
                version: this.version
            });
            
            console.log('🖼️ PopupManager クリーンアップ完了（統一システム統合版）');
            
        } catch (error) {
            this._showError('warning', `PopupManagerクリーンアップエラー: ${error.message}`);
        }
    }
}

// 🚨 統一システム統合: グローバル公開（AI分業対応）
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
    
    console.log('✅ PopupManager 統一システム統合版 グローバル公開完了');
    console.log('💡 使用例: const pm = new PopupManager(); pm.initialize();');
    console.log('🔧 デバッグ: window.testPopupManager() で動作確認');
}