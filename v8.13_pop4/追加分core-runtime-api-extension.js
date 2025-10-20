// ===== core-runtime.js PopupManager API拡張 =====
// 既存のcore-runtime.jsに以下のAPIを追加

// CoreRuntime.api オブジェクトに追加するメソッド群

/**
 * ポップアップを表示
 * @param {string} name - ポップアップ識別名 ('settings', 'album', 'export', 'quickAccess')
 * @returns {boolean} 成功/失敗
 */
showPopup: (name) => {
    if (!window.PopupManager) {
        console.error('PopupManager not initialized');
        return false;
    }
    return window.PopupManager.show(name);
},

/**
 * ポップアップを非表示
 * @param {string} name - ポップアップ識別名
 * @returns {boolean} 成功/失敗
 */
hidePopup: (name) => {
    if (!window.PopupManager) {
        console.error('PopupManager not initialized');
        return false;
    }
    return window.PopupManager.hide(name);
},

/**
 * ポップアップの表示/非表示を切り替え
 * @param {string} name - ポップアップ識別名
 * @returns {boolean} 成功/失敗
 */
togglePopup: (name) => {
    if (!window.PopupManager) {
        console.error('PopupManager not initialized');
        return false;
    }
    return window.PopupManager.toggle(name);
},

/**
 * すべてのポップアップを閉じる
 * @param {string} exceptName - 除外するポップアップ名（オプション）
 */
hideAllPopups: (exceptName = null) => {
    if (!window.PopupManager) {
        console.error('PopupManager not initialized');
        return;
    }
    window.PopupManager.hideAll(exceptName);
},

/**
 * ポップアップが表示されているか確認
 * @param {string} name - ポップアップ識別名
 * @returns {boolean}
 */
isPopupVisible: (name) => {
    if (!window.PopupManager) {
        return false;
    }
    return window.PopupManager.isVisible(name);
},

/**
 * ポップアップが初期化済みか確認
 * @param {string} name - ポップアップ識別名
 * @returns {boolean}
 */
isPopupReady: (name) => {
    if (!window.PopupManager) {
        return false;
    }
    return window.PopupManager.isReady(name);
},

/**
 * ポップアップインスタンスを取得
 * @param {string} name - ポップアップ識別名
 * @returns {object|null}
 */
getPopup: (name) => {
    if (!window.PopupManager) {
        return null;
    }
    return window.PopupManager.get(name);
},

/**
 * ポップアップの状態情報を取得
 * @param {string} name - ポップアップ識別名
 * @returns {object|null}
 */
getPopupStatus: (name) => {
    if (!window.PopupManager) {
        return null;
    }
    return window.PopupManager.getStatus(name);
},

/**
 * すべてのポップアップの状態を取得
 * @returns {Array}
 */
getAllPopupStatuses: () => {
    if (!window.PopupManager) {
        return [];
    }
    return window.PopupManager.getAllStatuses();
},

/**
 * PopupManager診断情報を出力
 */
diagnosePopups: () => {
    if (!window.PopupManager) {
        console.error('PopupManager not initialized');
        return;
    }
    window.PopupManager.diagnose();
}

// 使用例:
// CoreRuntime.api.showPopup('settings');
// CoreRuntime.api.togglePopup('export');
// CoreRuntime.api.hideAllPopups();
// CoreRuntime.api.isPopupVisible('album');
// CoreRuntime.api.diagnosePopups();