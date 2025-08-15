/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * アイコン管理システム - js/utils/icon-manager.js
 * Phase1.1 STEP1: @tabler/icons-react対応アイコンシステム（DRY原則準拠）
 */

console.log('🎭 アイコン管理システム読み込み開始...');

// ==== 名前空間確保 ====
window.FutabaDrawingTool = window.FutabaDrawingTool || {};
window.FutabaDrawingTool.IconManager = {};

// ==== @tabler/icons SVGデータ（CDN経由取得用） ====
// Phase1.1: 基本的なSVGパスを直接定義（車輪の再発明回避のため最小限）

/**
 * Tabler Icons SVGパスデータ
 * @tabler/icons-react から抽出した主要アイコンのSVGパス
 */
const TABLER_ICONS_PATHS = {
    // 描画ツール系
    brush: 'M3 21v-4a4 4 0 1 1 4 4h-4M21 3a16 16 0 0 0 -12.8 10.2M21 3a16 16 0 0 1 -10.2 12.8M10.6 9a9 9 0 0 1 4.4 4.4',
    eraser: 'M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20M18 13.3l-6.3-6.3',
    
    // UI操作系
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7,10 12,15 17,10M12 15V3',
    palette: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z M13.5 6.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z M17.5 10.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z M8.5 7.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z M6.5 12.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z',
    resize: 'M4 11V9a2 2 0 0 1 2-2h2M16 3h2a2 2 0 0 1 2 2v2M21 13v2a2 2 0 0 1-2 2h-2M8 21H6a2 2 0 0 1-2-2v-2',
    settings: 'M12 1L9 8H2l5.5 4L5 19l7-5 7 5-2.5-7L22 8h-7L12 1z',
    
    // ツール系
    bucket: 'M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10',
    select: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z',
    
    // 操作系
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    x: 'M18 6L6 18M6 6l12 12',
    check: 'M9 12l2 2 4-4',
    
    // 矢印系
    'arrow-back-up': 'M9 14L4 9l5-5M20 20v-7a4 4 0 0 0-4-4H4',
    'arrow-forward-up': 'M15 14l5-5-5-5M4 20v-7a4 4 0 0 1 4-4h12',
    
    // グリップ系
    'grip-vertical': 'M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M9 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M9 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M15 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M15 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'
};

/**
 * アイコンSVG要素作成（SOLID原則準拠）
 * @param {string} iconName - アイコン名
 * @param {Object} options - オプション設定
 * @returns {SVGElement|null} SVG要素
 */
window.FutabaDrawingTool.IconManager.createIcon = function(iconName, options = {}) {
    const {
        size = 20,
        color = 'currentColor',
        strokeWidth = 2,
        className = '',
        title = ''
    } = options;
    
    // パスデータ取得
    const pathData = TABLER_ICONS_PATHS[iconName];
    if (!pathData) {
        console.warn(`⚠️ アイコンが見つかりません: ${iconName}`);
        return this.createFallbackIcon(iconName, options);
    }
    
    try {
        // SVG要素作成
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', color);
        svg.setAttribute('stroke-width', strokeWidth);
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        
        if (className) {
            svg.className = className;
        }
        
        if (title) {
            const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            titleElement.textContent = title;
            svg.appendChild(titleElement);
        }
        
        // パスデータが複数の場合の処理
        const paths = pathData.split('M').filter(p => p.trim());
        
        if (paths.length > 1) {
            // 複数のパス（マルチパート）
            paths.forEach((pathStr, index) => {
                if (pathStr.trim()) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', (index === 0 ? '' : 'M') + pathStr);
                    svg.appendChild(path);
                }
            });
        } else {
            // 単一のパス
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            svg.appendChild(path);
        }
        
        return svg;
        
    } catch (error) {
        console.error(`❌ アイコン作成エラー: ${iconName}`, error);
        return this.createFallbackIcon(iconName, options);
    }
};

/**
 * フォールバックアイコン作成
 * @param {string} iconName - アイコン名
 * @param {Object} options - オプション設定
 * @returns {SVGElement} フォールバック用SVG要素
 */
window.FutabaDrawingTool.IconManager.createFallbackIcon = function(iconName, options = {}) {
    const { size = 20, color = 'currentColor' } = options;
    
    // 簡単な矩形フォールバック
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', color);
    svg.setAttribute('stroke-width', '2');
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '3');
    rect.setAttribute('y', '3');
    rect.setAttribute('width', '18');
    rect.setAttribute('height', '18');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');
    
    svg.appendChild(rect);
    
    // アイコン名を中央に配置（デバッグ用）
    if (window.FutabaDrawingTool?.Config?.debug?.enabled) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '12');
        text.setAttribute('y', '16');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '6');
        text.setAttribute('fill', color);
        text.textContent = iconName.charAt(0).toUpperCase();
        svg.appendChild(text);
    }
    
    return svg;
};

/**
 * DOM要素へのアイコン注入（DRY原則準拠）
 * @param {Element|string} target - 対象要素またはセレクタ
 * @param {string} iconName - アイコン名
 * @param {Object} options - オプション設定
 * @returns {boolean} 注入成功フラグ
 */
window.FutabaDrawingTool.IconManager.injectIcon = function(target, iconName, options = {}) {
    try {
        // 対象要素取得
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) {
            console.warn(`⚠️ 対象要素が見つかりません: ${target}`);
            return false;
        }
        
        // アイコン作成
        const icon = this.createIcon(iconName, options);
        if (!icon) {
            return false;
        }
        
        // 既存のアイコンを削除してから注入
        element.innerHTML = '';
        element.appendChild(icon);
        
        // デバッグログ
        if (window.FutabaDrawingTool?.Config?.debug?.verboseLogging) {
            console.log(`🎭 アイコン注入: ${iconName} → ${target}`);
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ アイコン注入エラー: ${iconName}`, error);
        return false;
    }
};

/**
 * プレースホルダー要素の一括アイコン変換
 * data-icon属性を持つ要素を自動的にアイコンに変換
 */
window.FutabaDrawingTool.IconManager.initializeAllIcons = function() {
    console.log('🔄 プレースホルダーアイコンの初期化開始...');
    
    const placeholders = document.querySelectorAll('[data-icon]');
    let successCount = 0;
    let totalCount = placeholders.length;
    
    placeholders.forEach((placeholder, index) => {
        try {
            const iconName = placeholder.getAttribute('data-icon');
            const size = parseInt(placeholder.getAttribute('data-icon-size')) || 20;
            const color = placeholder.getAttribute('data-icon-color') || 'currentColor';
            const strokeWidth = parseInt(placeholder.getAttribute('data-icon-stroke')) || 2;
            
            const success = this.injectIcon(placeholder, iconName, {
                size,
                color,
                strokeWidth,
                title: placeholder.getAttribute('title') || iconName
            });
            
            if (success) {
                successCount++;
                // data-icon属性を削除（重複処理防止）
                placeholder.removeAttribute('data-icon');
            }
            
        } catch (error) {
            console.error(`❌ プレースホルダー処理エラー [${index}]:`, error);
        }
    });
    
    console.log(`✅ アイコン初期化完了: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
    return { success: successCount, total: totalCount };
};

/**
 * 動的アイコン更新（ツール切り替え時等に使用）
 * @param {Element|string} target - 対象要素
 * @param {string} newIconName - 新しいアイコン名
 * @param {Object} options - オプション設定
 * @returns {boolean} 更新成功フラグ
 */
window.FutabaDrawingTool.IconManager.updateIcon = function(target, newIconName, options = {}) {
    // 既存のアイコンをフェードアウト → 新アイコンをフェードインする効果付き
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return false;
    
    if (options.animated && window.FutabaDrawingTool?.Config?.ui?.popups?.fadeAnimation) {
        // アニメーション付き更新
        element.style.opacity = '0.5';
        element.style.transition = 'opacity 0.2s ease';
        
        setTimeout(() => {
            const success = this.injectIcon(element, newIconName, options);
            if (success) {
                element.style.opacity = '1';
                setTimeout(() => {
                    element.style.transition = '';
                }, 200);
            }
        }, 100);
        
        return true;
    } else {
        // 即座に更新
        return this.injectIcon(element, newIconName, options);
    }
};

/**
 * アイコンキャッシュ管理（パフォーマンス向上）
 */
window.FutabaDrawingTool.IconManager.Cache = {
    _cache: new Map(),
    
    /**
     * キャッシュからアイコン取得
     * @param {string} iconName - アイコン名
     * @param {Object} options - オプション設定
     * @returns {SVGElement|null} キャッシュされたアイコン（複製）
     */
    get: function(iconName, options = {}) {
        const cacheKey = `${iconName}_${JSON.stringify(options)}`;
        const cached = this._cache.get(cacheKey);
        
        if (cached) {
            // SVG要素を複製して返す（DOMノードの重複使用を防ぐ）
            return cached.cloneNode(true);
        }
        
        return null;
    },
    
    /**
     * アイコンをキャッシュに保存
     * @param {string} iconName - アイコン名
     * @param {Object} options - オプション設定
     * @param {SVGElement} svgElement - SVG要素
     */
    set: function(iconName, options, svgElement) {
        const cacheKey = `${iconName}_${JSON.stringify(options)}`;
        this._cache.set(cacheKey, svgElement.cloneNode(true));
        
        // キャッシュサイズ制限（メモリ使用量制御）
        if (this._cache.size > 100) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
    },
    
    /**
     * キャッシュクリア
     */
    clear: function() {
        this._cache.clear();
        console.log('🧹 アイコンキャッシュをクリアしました');
    },
    
    /**
     * キャッシュ統計取得
     * @returns {Object} キャッシュ統計
     */
    getStats: function() {
        return {
            size: this._cache.size,
            maxSize: 100,
            usage: `${Math.round((this._cache.size / 100) * 100)}%`
        };
    }
};

// キャッシュ機能統合版のcreateIcon（パフォーマンス向上版）
const originalCreateIcon = window.FutabaDrawingTool.IconManager.createIcon;
window.FutabaDrawingTool.IconManager.createIcon = function(iconName, options = {}) {
    // キャッシュから取得試行
    const cached = this.Cache.get(iconName, options);
    if (cached) {
        return cached;
    }
    
    // 新規作成
    const icon = originalCreateIcon.call(this, iconName, options);
    if (icon) {
        // キャッシュに保存
        this.Cache.set(iconName, options, icon);
    }
    
    return icon;
};

/**
 * アイコンシステム統計取得（デバッグ用）
 * @returns {Object} システム統計
 */
window.FutabaDrawingTool.IconManager.getSystemStats = function() {
    return {
        availableIcons: Object.keys(TABLER_ICONS_PATHS).length,
        totalIconsInDOM: document.querySelectorAll('svg').length,
        pendingPlaceholders: document.querySelectorAll('[data-icon]').length,
        cacheStats: this.Cache.getStats(),
        systemReady: typeof TABLER_ICONS_PATHS === 'object' && Object.keys(TABLER_ICONS_PATHS).length > 0
    };
};

// ==== 初期化処理 ====

// DOMContentLoaded 時にプレースホルダーを自動変換
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.FutabaDrawingTool.IconManager.initializeAllIcons();
    });
} else {
    // すでにDOMが読み込み済みの場合
    setTimeout(() => {
        window.FutabaDrawingTool.IconManager.initializeAllIcons();
    }, 0);
}

// ==== 初期化ログ ====
console.log('✅ アイコン管理システム初期化完了');
console.log(`🎭 利用可能アイコン数: ${Object.keys(TABLER_ICONS_PATHS).length}個`);

// デバッグモード時の詳細統計
if (window.FutabaDrawingTool?.Config?.debug?.enabled) {
    setTimeout(() => {
        const stats = window.FutabaDrawingTool.IconManager.getSystemStats();
        console.log('📊 アイコンシステム統計:', stats);
        
        if (stats.pendingPlaceholders > 0) {
            console.warn(`⚠️ 未処理のプレースホルダーが ${stats.pendingPlaceholders}個 存在します`);
        }
    }, 100);
}

// グローバルエイリアス（利便性向上）
window.IconManager = window.FutabaDrawingTool.IconManager;