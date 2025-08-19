/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Phase A2: popup-manager.js 新規実装
 * 
 * 🎯 AI_WORK_SCOPE: ポップアップ統一管理・ドラッグ機能・排他制御・Escapeキー対応
 * 🎯 DEPENDENCIES: index.html（既存ポップアップHTML構造）
 * 🎯 NODE_MODULES: lodash（要素管理最適化）
 * 🎯 PIXI_EXTENSIONS: なし（DOM操作専用）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 
 * 📋 PHASE_TARGET: Phase1.4-A2 - ポップアップ統一管理システム
 * 📋 DRY_COMPLIANCE: ✅ 共通ドラッグ処理・イベント管理統一
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * Phase A2: ポップアップ統一管理システム
 * 🚨 実装機能:
 * 1. 既存の `.popup-panel` 要素自動検出・管理
 * 2. ドラッグ機能（`.popup-title` をハンドルに使用）
 * 3. Escapeキーで全ポップアップ閉じる
 * 4. 排他制御（1つ表示時に他を自動非表示）
 * 5. Z-index管理で重なり順制御
 * 6. 設定保存・復元機能
 */
class PopupManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-A2';
        this.name = 'popup-manager';
        
        // ポップアップ管理
        this.popups = new Map(); // ID -> PopupInfo
        this.activePopup = null;
        this.baseZIndex = 1000;
        this.currentZIndex = this.baseZIndex;
        
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
        
        console.log(`🖼️ PopupManager Phase A2構築 - ${this.version}`);
    }
    
    /**
     * 🚨 A2実装: 初期化・既存ポップアップ自動検出
     */
    initialize() {
        console.group(`🖼️ PopupManager Phase A2初期化 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: DOM要素検出・登録
            this.discoverPopups();
            
            // Phase 2: イベントリスナー設定
            this.setupGlobalEventListeners();
            
            // Phase 3: 初期状態設定
            this.setupInitialState();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ PopupManager初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            console.error('❌ PopupManager初期化エラー:', error);
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🚨 A2実装: 既存ポップアップ自動検出
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
                this.setupPopupDrag(popupId);
                
                // 初期非表示設定
                this.hidePopup(popupId, false); // イベント発火なし
                
                discoveredCount++;
                
            } catch (error) {
                console.error('❌ ポップアップ検出エラー:', error);
            }
        });
        
        console.log(`✅ ポップアップ自動検出完了: ${discoveredCount}個`);
        
        // 検出結果表示
        if (discoveredCount > 0) {
            const popupIds = Array.from(this.popups.keys());
            console.log(`📋 検出されたポップアップ: [${popupIds.join(', ')}]`);
        }
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
            zIndex: this.baseZIndex,
            draggable: !!titleElement, // タイトル要素があればドラッグ可能
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
     * 🚨 A2実装: ポップアップドラッグ機能設定
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
     * 🚨 A2実装: グローバルイベントリスナー設定
     */
    setupGlobalEventListeners() {
        console.log('🎯 グローバルイベントリスナー設定...');
        
        // Escapeキー処理
        this.eventListeners.keydown = (event) => {
            if (event.key === 'Escape') {
                this.closeAllPopups();
                event.preventDefault();
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
                    this.savePopupPosition(popupId);
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
     * 🚨 A2実装: 初期状態設定
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
    // 🚨 A2実装: 公開API
    // ==========================================
    
    /**
     * ポップアップ表示（排他制御付き）
     */
    showPopup(popupId, exclusive = true) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            console.warn(`⚠️ 不明なポップアップID: ${popupId}`);
            return false;
        }
        
        try {
            // 排他制御
            if (exclusive && this.activePopup && this.activePopup !== popupId) {
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
            
            console.log(`🖼️ ポップアップ表示: ${popupId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ ポップアップ表示エラー ${popupId}:`, error);
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
            }
            
            if (fireEvents) {
                console.log(`🖼️ ポップアップ非表示: ${popupId}`);
            }
            return true;
            
        } catch (error) {
            console.error(`❌ ポップアップ非表示エラー ${popupId}:`, error);
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
     * 🚨 A2実装: 全ポップアップ閉じる（Escapeキー用）
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
        
        console.log(`✅ 全ポップアップ閉じる完了: ${closedCount}個`);
        return closedCount;
    }
    
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
    
    // ==========================================
    // ユーティリティメソッド
    // ==========================================
    
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
        
        // 表示状態復元（初期は非表示優先）
        // この時点では非表示状態を維持
    }
    
    /**
     * ポップアップ情報取得
     */
    getPopupInfo(popupId) {
        return this.popups.get(popupId) || null;
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
     * 統計情報取得
     */
    getStats() {
        const totalPopups = this.popups.size;
        const visiblePopups = Array.from(this.popups.values()).filter(info => info.visible).length;
        const draggablePopups = Array.from(this.popups.values()).filter(info => info.draggable).length;
        
        return {
            total: totalPopups,
            visible: visiblePopups,
            draggable: draggablePopups,
            activePopup: this.activePopup,
            currentZIndex: this.currentZIndex
        };
    }
    
    /**
     * クリーンアップ
     */
    cleanup() {
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
        
        console.log('🖼️ PopupManager クリーンアップ完了');
    }
}

// 🚨 A2実装: グローバル公開（AI分業対応）
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
    console.log('✅ PopupManager Phase A2 グローバル公開完了');
}