/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: SVGアイコン管理・@tabler/icons-react統合
 * 🎯 DEPENDENCIES: @tabler/icons-react
 * 🎯 NODE_MODULES: @tabler/icons-react@^3.0.0
 * 🎯 ISOLATION_TEST: 可能（独立機能）
 * 📋 PHASE_TARGET: Phase1
 * 🔧 修正内容: バケツ・破線□アイコン追加
 */

console.log('🎨 Icon Manager 読み込み開始 - @tabler/icons統合');

/**
 * Tabler Icons SVGアイコン統合管理
 * node_modules/@tabler/icons-react対応
 */
class IconManager {
    constructor() {
        this.icons = new Map();
        this.initialized = false;
        
        console.log('🎨 IconManager 構築開始');
        this.initializeIcons();
    }
    
    /**
     * 複数要素にアイコン一括設定
     * @param {Object} mapping - {elementId: iconName} の形式
     */
    setMultipleIcons(mapping) {
        let successCount = 0;
        
        Object.entries(mapping).forEach(([elementId, iconName]) => {
            const element = document.getElementById(elementId);
            if (element && this.setElementIcon(element, iconName)) {
                successCount++;
            }
        });
        
        console.log(`✅ アイコン一括設定完了 - ${successCount}個設定`);
        return successCount;
    }
    
    /**
     * ツールボタンアイコン更新（ふたば風対応）
     */
    updateToolButtonIcons() {
        const iconMapping = {
            'pen-tool': 'pen',
            'eraser-tool': 'eraser',
            'fill-tool': 'bucket',           // 🔧 修正: バケツアイコン
            'select-tool': 'selection-dashed', // 🔧 修正: 破線□アイコン
            'palette-tool': 'palette',
            'download-tool': 'download',
            'resize-tool': 'resize',
            'settings-tool': 'settings'
        };
        
        return this.setMultipleIcons(iconMapping);
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            initialized: this.initialized,
            totalIcons: this.icons.size,
            iconNames: this.getIconNames(),
            customIcons: ['bucket', 'selection-dashed'] // 追加されたカスタムアイコン
        };
    }
}

/**
 * アイコン管理ユーティリティ関数
 */

/**
 * アイコン名から SVG 取得（グローバル関数）
 * @param {string} name - アイコン名
 * @returns {string} - SVG文字列
 */
function getIcon(name) {
    if (typeof window.iconManager !== 'undefined') {
        return window.iconManager.getIcon(name);
    }
    
    console.warn('⚠️ IconManager未初期化 - getIcon()');
    return '';
}

/**
 * 要素にアイコン設定（グローバル関数）
 * @param {string|HTMLElement} element - 要素またはID
 * @param {string} iconName - アイコン名
 * @returns {boolean} - 成功可否
 */
function setIcon(element, iconName) {
    if (typeof window.iconManager === 'undefined') {
        console.warn('⚠️ IconManager未初期化 - setIcon()');
        return false;
    }
    
    // 文字列の場合は要素を取得
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    
    return window.iconManager.setElementIcon(element, iconName);
}

/**
 * ツールボタンアイコン更新（グローバル関数）
 * @returns {number} - 設定成功数
 */
function updateAllToolIcons() {
    if (typeof window.iconManager !== 'undefined') {
        return window.iconManager.updateToolButtonIcons();
    }
    
    console.warn('⚠️ IconManager未初期化 - updateAllToolIcons()');
    return 0;
}

// ==== グローバル公開・自動初期化 ====
console.log('📦 Icon Manager グローバル登録');

// インスタンス作成・グローバル公開
window.iconManager = new IconManager();

// DOMContentLoaded後に自動でアイコン更新
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('🎨 Icon Manager 自動アイコン更新開始');
        
        // 少し遅らせてDOM要素が確実に存在するようにする
        setTimeout(() => {
            try {
                const updatedCount = updateAllToolIcons();
                console.log(`✅ ツールボタンアイコン自動更新完了 - ${updatedCount}個更新`);
                console.log('🎨 新しいアイコン: バケツ(塗りつぶし)、破線□(範囲選択)');
                
                // 統計表示
                const stats = window.iconManager.getStats();
                console.log('📊 Icon Manager統計:', stats);
                
            } catch (error) {
                console.warn('⚠️ アイコン自動更新でエラー:', error.message);
            }
        }, 500);
    });
}

// ==== Phase1完了・アイコン統合完了 ====
console.log('🎉 Icon Manager 初期化完了');
console.log('🎨 @tabler/icons統合 - バケツ・破線□アイコン追加');
console.log('💡 使用方法例:');
console.log('  getIcon("bucket") - バケツアイコンSVG取得');
console.log('  setIcon("fill-tool", "bucket") - 要素にアイコン設定');
console.log('  updateAllToolIcons() - 全ツールアイコン更新'); アイコン初期化
     */
    initializeIcons() {
        // 🔧 修正: @tabler/icons-react からのSVGアイコン定義
        
        // バケツアイコン（塗りつぶし用）
        this.icons.set('bucket', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                <path d="m5 2 5 5"/>
                <path d="M2 13h15"/>
                <path d="M7 21V10.5"/>
            </svg>
        `);
        
        // 破線□アイコン（範囲選択用）
        this.icons.set('selection-dashed', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
        `);
        
        // ペンアイコン（既存）
        this.icons.set('pen', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21v-4a4 4 0 1 1 4 4h-4"/>
                <path d="M21 3a16 16 0 0 0 -12.8 10.2"/>
                <path d="M21 3a16 16 0 0 1 -10.2 12.8"/>
                <path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>
            </svg>
        `);
        
        // 消しゴムアイコン（既存）
        this.icons.set('eraser', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20"/>
                <path d="M18 13.3l-6.3-6.3"/>
            </svg>
        `);
        
        // パレットアイコン（既存）
        this.icons.set('palette', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="13.5" cy="6.5" r=".5"/>
                <circle cx="17.5" cy="10.5" r=".5"/>
                <circle cx="8.5" cy="7.5" r=".5"/>
                <circle cx="6.5" cy="12.5" r=".5"/>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
        `);
        
        // ダウンロードアイコン（既存）
        this.icons.set('download', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `);
        
        // リサイズアイコン（既存）
        this.icons.set('resize', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M8 12h8"/>
                <path d="M12 8v8"/>
            </svg>
        `);
        
        // 設定アイコン（既存）
        this.icons.set('settings', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        `);
        
        this.initialized = true;
        console.log(`✅ IconManager初期化完了 - ${this.icons.size}個のアイコン登録`);
    }
    
    /**
     * アイコン取得
     * @param {string} name - アイコン名
     * @returns {string} - SVGアイコン文字列
     */
    getIcon(name) {
        if (!this.initialized) {
            console.warn('⚠️ IconManager未初期化');
            return '';
        }
        
        const icon = this.icons.get(name);
        if (!icon) {
            console.warn(`⚠️ アイコン '${name}' が見つかりません`);
            return '';
        }
        
        return icon.trim();
    }
    
    /**
     * アイコン名一覧取得
     * @returns {Array<string>} - アイコン名配列
     */
    getIconNames() {
        return Array.from(this.icons.keys());
    }
    
    /**
     * アイコン存在チェック
     * @param {string} name - アイコン名
     * @returns {boolean} - 存在するかどうか
     */
    hasIcon(name) {
        return this.icons.has(name);
    }
    
    /**
     * HTML要素にアイコン設定
     * @param {HTMLElement} element - 対象要素
     * @param {string} iconName - アイコン名
     */
    setElementIcon(element, iconName) {
        if (!element) {
            console.warn('⚠️ 要素が指定されていません');
            return false;
        }
        
        const iconSvg = this.getIcon(iconName);
        if (iconSvg) {
            element.innerHTML = iconSvg;
            return true;
        }
        
        return false;
    }
    
    /**
     *