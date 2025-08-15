/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: SVGアイコン管理・Tabler Icons活用・動的アイコン生成
 * 🎯 DEPENDENCIES: なし（Pure JavaScript・独立動作）
 * 🎯 NODE_MODULES: なし（SVG文字列ベース実装）
 * 🎯 PIXI_EXTENSIONS: なし
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能（アイコン生成のみ）
 * 🎯 SPLIT_THRESHOLD: 200行以下維持（ユーティリティのため簡潔性重視）
 * 📋 PHASE_TARGET: Phase1.1
 * 📋 V8_MIGRATION: なし（SVG変更不要）
 * 
 * 📝 Note: @tabler/icons-react は React専用のため、SVG文字列として直接定義
 */

console.log('🎨 SVGアイコン管理システム読み込み開始...');

// ==== SVGアイコン管理システム ====
class IconManager {
    constructor() {
        this.icons = new Map();
        this.initialized = false;
        this.defaultSize = 20;
        this.defaultStrokeWidth = 2;
        
        // アイコン読み込み
        this.loadTablerIcons();
        this.initialized = true;
    }
    
    /**
     * Tabler Icons SVG定義読み込み
     * よく使用されるアイコンをSVG文字列として定義
     */
    loadTablerIcons() {
        console.log('📦 Tabler Icons読み込み中...');
        
        // ツール系アイコン
        this.icons.set('download', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `);
        
        this.icons.set('resize', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M8 12h8"/>
                <path d="M12 8v8"/>
            </svg>
        `);
        
        this.icons.set('palette', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="13.5" cy="6.5" r=".5"/>
                <circle cx="17.5" cy="10.5" r=".5"/>
                <circle cx="8.5" cy="7.5" r=".5"/>
                <circle cx="6.5" cy="12.5" r=".5"/>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
        `);
        
        this.icons.set('pen', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21v-4a4 4 0 1 1 4 4h-4"/>
                <path d="M21 3a16 16 0 0 0 -12.8 10.2"/>
                <path d="M21 3a16 16 0 0 1 -10.2 12.8"/>
                <path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>
            </svg>
        `);
        
        this.icons.set('eraser', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20"/>
                <path d="M18 13.3l-6.3-6.3"/>
            </svg>
        `);
        
        this.icons.set('fill', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"/>
            </svg>
        `);
        
        this.icons.set('select', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                <path d="M9 9h6v6H9z"/>
            </svg>
        `);
        
        this.icons.set('settings', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        `);
        
        // UI系アイコン
        this.icons.set('plus', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        `);
        
        this.icons.set('minus', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        `);
        
        this.icons.set('check', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20,6 9,17 4,12"/>
            </svg>
        `);
        
        this.icons.set('x', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        `);
        
        // レイヤー系アイコン（Phase2予告）
        this.icons.set('layers', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12,2 2,7 12,12 22,7 12,2"/>
                <polyline points="2,17 12,22 22,17"/>
                <polyline points="2,12 12,17 22,12"/>
            </svg>
        `);
        
        this.icons.set('eye', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `);
        
        this.icons.set('eye-off', `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `);
        
        console.log(`✅ Tabler Icons読み込み完了: ${this.icons.size}個`);
    }
    
    /**
     * アイコン取得（主要API）
     * 指定名のSVGアイコンを取得・カスタマイズ対応
     */
    getIcon(name, options = {}) {
        const iconSVG = this.icons.get(name.toLowerCase());
        if (!iconSVG) {
            console.warn(`⚠️ アイコン '${name}' が見つかりません`);
            return this.getFallbackIcon(options);
        }
        
        return this.customizeIcon(iconSVG, options);
    }
    
    /**
     * SVGアイコンカスタマイズ
     * サイズ・色・ストローク幅の動的変更
     */
    customizeIcon(svgString, options = {}) {
        const {
            size = this.defaultSize,
            color = 'currentColor',
            strokeWidth = this.defaultStrokeWidth,
            className = '',
            title = ''
        } = options;
        
        // SVG属性の動的更新
        let customizedSVG = svgString
            .replace(/width="[^"]*"/, `width="${size}"`)
            .replace(/height="[^"]*"/, `height="${size}"`)
            .replace(/stroke="currentColor"/, `stroke="${color}"`)
            .replace(/stroke-width="2"/, `stroke-width="${strokeWidth}"`);
        
        // クラス・タイトル追加
        if (className) {
            customizedSVG = customizedSVG.replace('<svg', `<svg class="${className}"`);
        }
        
        if (title) {
            customizedSVG = customizedSVG.replace('><', `><title>${title}</title><`);
        }
        
        return customizedSVG.trim();
    }
    
    /**
     * フォールバックアイコン生成
     * 未定義アイコン時の代替表示
     */
    getFallbackIcon(options = {}) {
        const { size = this.defaultSize } = options;
        
        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        `.trim();
    }
    
    /**
     * DOM要素作成
     * SVG文字列からDOM要素作成
     */
    createIconElement(name, options = {}) {
        const svgString = this.getIcon(name, options);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = svgString;
        return tempDiv.firstElementChild;
    }
    
    /**
     * アイコンボタン作成
     * アイコン付きボタンのヘルパー関数
     */
    createIconButton(iconName, options = {}) {
        const {
            buttonClass = 'icon-button',
            iconOptions = {},
            onClick = null,
            title = '',
            disabled = false
        } = options;
        
        const button = document.createElement('button');
        button.className = buttonClass;
        button.innerHTML = this.getIcon(iconName, iconOptions);
        
        if (title) {
            button.title = title;
            button.setAttribute('aria-label', title);
        }
        
        if (disabled) {
            button.disabled = true;
        }
        
        if (onClick && typeof onClick === 'function') {
            button.addEventListener('click', onClick);
        }
        
        return button;
    }
    
    /**
     * 利用可能アイコン一覧取得
     * 外部からのアイコン確認用
     */
    getAvailableIcons() {
        return Array.from(this.icons.keys()).sort();
    }
    
    /**
     * アイコン存在確認
     * 指定アイコンの存在チェック
     */
    hasIcon(name) {
        return this.icons.has(name.toLowerCase());
    }
    
    /**
     * カスタムアイコン追加
     * 独自SVGアイコンの追加
     */
    addCustomIcon(name, svgString) {
        if (typeof svgString !== 'string' || !svgString.includes('<svg')) {
            console.error(`❌ 無効なSVG文字列: ${name}`);
            return false;
        }
        
        this.icons.set(name.toLowerCase(), svgString.trim());
        console.log(`✅ カスタムアイコン '${name}' を追加しました`);
        return true;
    }
    
    /**
     * アイコン統計取得
     * システム統計・使用状況確認
     */
    getStats() {
        return {
            totalIcons: this.icons.size,
            initialized: this.initialized,
            categories: {
                tools: ['download', 'resize', 'palette', 'pen', 'eraser', 'fill', 'select', 'settings'].filter(name => this.hasIcon(name)).length,
                ui: ['plus', 'minus', 'check', 'x'].filter(name => this.hasIcon(name)).length,
                layers: ['layers', 'eye', 'eye-off'].filter(name => this.hasIcon(name)).length
            },
            defaultSize: this.defaultSize,
            defaultStrokeWidth: this.defaultStrokeWidth
        };
    }
    
    /**
     * デバッグ・テスト関数
     * アイコン表示テスト・確認用
     */
    debug() {
        console.group('🎨 IconManager デバッグ情報');
        
        const stats = this.getStats();
        console.log('統計情報:', stats);
        
        console.log('利用可能アイコン:');
        const icons = this.getAvailableIcons();
        icons.forEach(name => {
            console.log(`  🎯 ${name}`);
        });
        
        console.groupEnd();
    }
}

// ==== グローバル公開・初期化 ====
// Pure JavaScript形式でグローバル公開（ESM禁止準拠）
const iconManager = new IconManager();
window.IconManager = iconManager;

// ヘルパー関数の公開（簡単アクセス用）
window.getIcon = (name, options) => iconManager.getIcon(name, options);
window.createIconElement = (name, options) => iconManager.createIconElement(name, options);
window.createIconButton = (iconName, options) => iconManager.createIconButton(iconName, options);

// ==== Phase1.1完了マーカー ====
console.log('✅ Phase1.1 STEP6: SVGアイコン管理システム実装完了');
console.log('📊 機能概要:');
console.log(`  🎯 ${iconManager.getStats().totalIcons}個のTablerアイコン定義済み`);
console.log('  🎨 動的カスタマイズ（サイズ・色・ストローク幅）');
console.log('  🔧 DOM要素・ボタン生成ヘルパー');
console.log('  ➕ カスタムアイコン追加対応');
console.log('💡 使用方法:');
console.log('  window.getIcon("pen", {size: 24, color: "#800000"});');
console.log('  window.createIconButton("settings", {onClick: handler});');
console.log('📋 次のステップ: managers/ui-manager.js でアイコン統合');