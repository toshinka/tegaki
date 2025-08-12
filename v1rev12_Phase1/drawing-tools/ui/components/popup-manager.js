/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール
 * PopupManager Component - drawing-tools/ui/components/popup-manager.js
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

console.log('🔧 PopupManager Component (STEP 4) 読み込み開始...');

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
 * PopupManagerコンポーネント
 * ペンツール専用ポップアップ制御システム
 */
class PopupManager {
    constructor() {
        console.log('📦 PopupManager初期化開始...');
        
        // 基本設定
        this.popupFadeTime = safeConfigGet('POPUP_FADE_TIME', 300);
        this.maxErrors = safeConfigGet('MAX_ERRORS', 10);
        
        // 状態管理
        this.activePopup = null;
        this.popupStates = new Map();
        this.errorCount = 0;
        this.isInitialized = false;
        
        // ポップアップ要素キャッシュ
        this.popupElements = new Map();
        this.overlayElement = null;
        
        // 統計・デバッグ情報
        this.showCount = 0;
        this.hideCount = 0;
        this.lastAction = null;
        this.lastActionTime = 0;
        
        console.log('✅ PopupManager初期化完了');
    }
    
    /**
     * PopupManager初期化
     */
    init() {
        try {
            console.log('🎯 PopupManager初期化開始...');
            
            this.setupPopupElements();
            this.setupEventListeners();
            this.setupOverlay();
            
            this.isInitialized = true;
            console.log('✅ PopupManager初期化完了');
            
        } catch (error) {
            console.error('❌ PopupManager初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * ポップアップ要素セットアップ
     */
    setupPopupElements() {
        // ペン設定ポップアップ
        const penSettingsPopup = document.getElementById('pen-settings-popup');
        if (penSettingsPopup) {
            this.popupElements.set('pen-settings', penSettingsPopup);
            this.popupStates.set('pen-settings', {
                visible: false,
                element: penSettingsPopup,
                fadeTimeout: null,
                showCount: 0,
                hideCount: 0
            });
        }
        
        // リサイズ設定ポップアップ
        const resizeSettingsPopup = document.getElementById('resize-settings-popup');
        if (resizeSettingsPopup) {
            this.popupElements.set('resize-settings', resizeSettingsPopup);
            this.popupStates.set('resize-settings', {
                visible: false,
                element: resizeSettingsPopup,
                fadeTimeout: null,
                showCount: 0,
                hideCount: 0
            });
        }
        
        console.log(`📋 ポップアップ要素検出: ${this.popupElements.size}個`);
    }
    
    /**
     * イベントリスナーセットアップ
     */
    setupEventListeners() {
        // ESCキーでポップアップを閉じる
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.activePopup) {
                this.hidePopup(this.activePopup);
            }
        });
        
        // ポップアップ内クリック時の伝播防止
        for (const [popupId, element] of this.popupElements) {
            element.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
        
        console.log('🎧 PopupManagerイベントリスナー設定完了');
    }
    
    /**
     * オーバーレイセットアップ
     */
    setupOverlay() {
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
            this.overlayElement.addEventListener('click', () => {
                if (this.activePopup) {
                    this.hidePopup(this.activePopup);
                }
            });
            
            document.body.appendChild(this.overlayElement);
            console.log('🌫️ ポップアップオーバーレイ作成完了');
        }
    }
    
    /**
     * ポップアップ表示
     */
    showPopup(popupId) {
        try {
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
            
            // ポップアップ表示
            const element = popupState.element;
            element.style.display = 'block';
            element.style.opacity = '0';
            element.style.visibility = 'visible';
            element.style.pointerEvents = 'auto';
            
            // フェードイン
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${this.popupFadeTime}ms ease-out`;
                element.style.opacity = '1';
            });
            
            // 状態更新
            popupState.visible = true;
            popupState.showCount++;
            this.activePopup = popupId;
            this.showCount++;
            this.lastAction = 'show';
            this.lastActionTime = Date.now();
            
            console.log(`✅ ポップアップ表示: ${popupId}`);
            return true;
            
        } catch (error) {
            console.error(`ポップアップ表示エラー (${popupId}):`, error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * ポップアップ非表示
     */
    hidePopup(popupId) {
        try {
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
                
            }, this.popupFadeTime);
            
            // 統計更新
            this.hideCount++;
            this.lastAction = 'hide';
            this.lastActionTime = Date.now();
            
            console.log(`❌ ポップアップ非表示: ${popupId}`);
            return true;
            
        } catch (error) {
            console.error(`ポップアップ非表示エラー (${popupId}):`, error);
            this.handleError(error);
            return false;
        }
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
            console.error('全ポップアップ非表示エラー:', error);
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
            hasFadeTimeout: !!popupState.fadeTimeout
        };
    }
    
    /**
     * 全ポップアップ状態取得
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
     * デバッグ情報表示
     */
    debug() {
        console.group('🔍 PopupManager デバッグ情報');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            activePopup: this.activePopup,
            popupCount: this.popupStates.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`
        });
        
        console.log('統計情報:', {
            totalShows: this.showCount,
            totalHides: this.hideCount,
            lastAction: this.lastAction,
            lastActionTime: this.lastActionTime ? new Date(this.lastActionTime).toLocaleTimeString() : 'なし'
        });
        
        console.log('ポップアップ状態:');
        for (const [popupId, popupState] of this.popupStates) {
            console.log(`  ${popupId}:`, {
                visible: popupState.visible,
                shows: popupState.showCount,
                hides: popupState.hideCount,
                hasFadeTimeout: !!popupState.fadeTimeout,
                element: !!popupState.element
            });
        }
        
        console.log('DOM要素状況:', {
            overlay: !!this.overlayElement,
            popupElements: this.popupElements.size
        });
        
        console.groupEnd();
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 PopupManager クリーンアップ開始...');
            
            // 全ポップアップ非表示
            this.hideAllPopups();
            
            // フェードタイマークリア
            for (const popupState of this.popupStates.values()) {
                if (popupState.fadeTimeout) {
                    clearTimeout(popupState.fadeTimeout);
                    popupState.fadeTimeout = null;
                }
            }
            
            // オーバーレイ削除
            if (this.overlayElement && this.overlayElement.parentNode) {
                this.overlayElement.parentNode.removeChild(this.overlayElement);
                this.overlayElement = null;
            }
            
            // 参照クリア
            this.popupStates.clear();
            this.popupElements.clear();
            this.activePopup = null;
            this.isInitialized = false;
            
            console.log('✅ PopupManager クリーンアップ完了');
            
        } catch (error) {
            console.error('PopupManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート ====
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
    
    // デバッグ関数
    window.debugPopupManager = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI && 
            window.drawingToolsSystem.penToolUI.popupManager) {
            window.drawingToolsSystem.penToolUI.popupManager.debug();
        } else {
            console.warn('PopupManager が利用できません');
        }
    };
    
    window.showPenSettings = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI && 
            window.drawingToolsSystem.penToolUI.popupManager) {
            return window.drawingToolsSystem.penToolUI.popupManager.showPopup('pen-settings');
        } else {
            console.warn('PopupManager が利用できません');
            return false;
        }
    };
    
    window.hidePenSettings = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI && 
            window.drawingToolsSystem.penToolUI.popupManager) {
            return window.drawingToolsSystem.penToolUI.popupManager.hidePopup('pen-settings');
        } else {
            console.warn('PopupManager が利用できません');
            return false;
        }
    };
    
    window.hideAllPopups = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI && 
            window.drawingToolsSystem.penToolUI.popupManager) {
            return window.drawingToolsSystem.penToolUI.popupManager.hideAllPopups();
        } else {
            console.warn('PopupManager が利用できません');
            return false;
        }
    };
    
    console.log('✅ PopupManager Component (STEP 4) 読み込み完了');
    console.log('📦 エクスポートクラス: PopupManager');
    console.log('🎯 機能: ペンツール専用ポップアップ制御');
    console.log('🔧 特徴: ui-manager.js非依存・ESC/外部クリック対応・状態同期');
    console.log('🐛 デバッグ関数:');
    console.log('  - window.debugPopupManager() - PopupManager詳細表示');
    console.log('  - window.showPenSettings() - ペン設定表示');
    console.log('  - window.hidePenSettings() - ペン設定非表示');
    console.log('  - window.hideAllPopups() - 全ポップアップ非表示');
}

console.log('🏆 PopupManager Component (STEP 4) 初期化完了');