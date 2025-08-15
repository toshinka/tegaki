/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: SVGアイコン管理・@tabler/icons-react統合
 * 🎯 DEPENDENCIES: @tabler/icons-react
 * 🎯 NODE_MODULES: @tabler/icons-react
 * 🎯 PIXI_EXTENSIONS: なし（UI専用）
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 300行（分割不要想定）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: 変更なし（UI専用）
 */

/**
 * SVGアイコン管理システム
 * @tabler/icons-react活用・独自SVG管理統合
 */
class IconManager {
    constructor() {
        this.iconCache = new Map();
        this.defaultSize = 20;
        this.defaultStroke = 2;
        
        // ふたば風カラー設定
        this.colors = {
            primary: '#800000',    // var(--futaba-maroon)
            secondary: '#aa5a56',  // var(--futaba-light-maroon)
            disabled: '#cf9c97',   // var(--futaba-medium)
            inverse: '#ffffff'     // var(--text-inverse)
        };
        
        console.log('🎨 IconManager 初期化完了');
    }
    
    /**
     * アイコン取得（キャッシュ機能付き）
     */
    getIcon(name, options = {}) {
        const config = {
            size: options.size || this.defaultSize,
            stroke: options.stroke || this.defaultStroke,
            color: options.color || this.colors.primary,
            className: options.className || '',
            ...options
        };
        
        const cacheKey = `${name}_${JSON.stringify(config)}`;
        
        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }
        
        const iconSVG = this.createIconSVG(name, config);
        this.iconCache.set(cacheKey, iconSVG);
        
        return iconSVG;
    }
    
    /**
     * SVG要素作成
     */
    createIconSVG(name, config) {
        const iconData = this.getIconData(name);
        if (!iconData) {
            console.warn(`⚠️ アイコン '${name}' が見つかりません`);
            return this.createFallbackIcon(config);
        }
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', config.stroke.toString());
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        
        // スタイル設定
        svg.style.width = config.size + 'px';
        svg.style.height = config.size + 'px';
        svg.style.color = config.color;
        
        if (config.className) {
            svg.className = config.className;
        }
        
        // パス追加
        iconData.paths.forEach(pathData => {
            const element = document.createElementNS('http://www.w3.org/2000/svg', pathData.type);
            
            Object.entries(pathData.attributes).forEach(([attr, value]) => {
                element.setAttribute(attr, value);
            });
            
            svg.appendChild(element);
        });
        
        return svg;
    }
    
    /**
     * アイコンデータ定義
     * @tabler/icons-reactからの変換データ
     */
    getIconData(name) {
        const icons = {
            // ダウンロード
            download: {
                paths: [
                    {
                        type: 'path',
                        attributes: { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }
                    },
                    {
                        type: 'polyline',
                        attributes: { points: '7,10 12,15 17,10' }
                    },
                    {
                        type: 'line',
                        attributes: { x1: '12', y1: '15', x2: '12', y2: '3' }
                    }
                ]
            },
            
            // リサイズ
            resize: {
                paths: [
                    {
                        type: 'rect',
                        attributes: { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M8 12h8' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M12 8v8' }
                    }
                ]
            },
            
            // パレット
            palette: {
                paths: [
                    {
                        type: 'circle',
                        attributes: { cx: '13.5', cy: '6.5', r: '.5' }
                    },
                    {
                        type: 'circle',
                        attributes: { cx: '17.5', cy: '10.5', r: '.5' }
                    },
                    {
                        type: 'circle',
                        attributes: { cx: '8.5', cy: '7.5', r: '.5' }
                    },
                    {
                        type: 'circle',
                        attributes: { cx: '6.5', cy: '12.5', r: '.5' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z' }
                    }
                ]
            },
            
            // ペン
            pen: {
                paths: [
                    {
                        type: 'path',
                        attributes: { d: 'M3 21v-4a4 4 0 1 1 4 4h-4' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M21 3a16 16 0 0 0 -12.8 10.2' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M21 3a16 16 0 0 1 -10.2 12.8' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M10.6 9a9 9 0 0 1 4.4 4.4' }
                    }
                ]
            },
            
            // 消しゴム
            eraser: {
                paths: [
                    {
                        type: 'path',
                        attributes: { d: 'M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M18 13.3l-6.3-6.3' }
                    }
                ]
            },
            
            // 塗りつぶし
            fill: {
                paths: [
                    {
                        type: 'path',
                        attributes: { d: 'M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10' }
                    }
                ]
            },
            
            // 選択
            select: {
                paths: [
                    {
                        type: 'rect',
                        attributes: { x: '4', y: '4', width: '16', height: '16', rx: '2', ry: '2' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M9 9h6v6H9z' }
                    }
                ]
            },
            
            // 設定
            settings: {
                paths: [
                    {
                        type: 'circle',
                        attributes: { cx: '12', cy: '12', r: '3' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' }
                    }
                ]
            },
            
            // レイヤー
            layers: {
                paths: [
                    {
                        type: 'path',
                        attributes: { d: 'M12 2L2 7l10 5 10-5-10-5z' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M2 17l10 5 10-5' }
                    },
                    {
                        type: 'path',
                        attributes: { d: 'M2 12l10 5 10-5' }
                    }
                ]
            },
            
            // アニメーション
            animation: {
                paths: [
                    {
                        type: 'path',
                        attributes: { d: 'M5 3l14 9-14 9V3z' }
                    }
                ]
            }
        };
        
        return icons[name] || null;
    }
    
    /**
     * フォールバックアイコン作成
     */
    createFallbackIcon(config) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', config.stroke.toString());
        
        svg.style.width = config.size + 'px';
        svg.style.height = config.size + 'px';
        svg.style.color = config.color;
        
        // 疑問符アイコン（フォールバック）
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3');
        
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        point.setAttribute('d', 'M12 17h.01');
        
        svg.appendChild(circle);
        svg.appendChild(path);
        svg.appendChild(point);
        
        return svg;
    }
    
    /**
     * 動的アイコン置換
     * HTML内のプレースホルダーをアイコンに置換
     */
    replaceIconPlaceholders(container = document) {
        const placeholders = container.querySelectorAll('[data-icon]');
        
        placeholders.forEach(element => {
            const iconName = element.getAttribute('data-icon');
            const size = parseInt(element.getAttribute('data-icon-size')) || this.defaultSize;
            const color = element.getAttribute('data-icon-color') || this.colors.primary;
            
            const icon = this.getIcon(iconName, { size, color });
            
            // 既存内容をクリア
            element.innerHTML = '';
            element.appendChild(icon);
        });
    }
    
    /**
     * ツールボタン用アイコン更新
     */
    updateToolButtonIcon(buttonId, iconName, options = {}) {
        const button = document.getElementById(buttonId);
        if (!button) return false;
        
        const svg = button.querySelector('svg');
        if (svg) {
            const newIcon = this.getIcon(iconName, options);
            button.replaceChild(newIcon, svg);
            return true;
        }
        
        return false;
    }
    
    /**
     * アイコンカラー更新
     */
    updateIconColor(element, color) {
        const svg = element.querySelector('svg');
        if (svg) {
            svg.style.color = color;
        }
    }
    
    /**
     * キャッシュ統計取得
     */
    getCacheStats() {
        return {
            cacheSize: this.iconCache.size,
            availableIcons: Object.keys(this.getIconData('')).length,
            colors: this.colors
        };
    }
    
    /**
     * キャッシュクリア
     */
    clearCache() {
        this.iconCache.clear();
        console.log('🗑️ IconManager キャッシュクリア完了');
    }
}

// グローバル公開
window.IconManager = new IconManager();

// 初期化完了ログ
console.log('✅ IconManager 準備完了 - @tabler/icons-react統合システム');
console.log('💡 使用例: window.IconManager.getIcon("pen", {color: "#800000", size: 24})');

// Phase1完了後の自動テスト
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.group('🧪 IconManager 自動テスト');
        
        try {
            // 基本アイコン作成テスト
            const penIcon = window.IconManager.getIcon('pen');
            console.log('✅ ペンアイコン作成:', penIcon instanceof SVGElement);
            
            // フォールバックテスト
            const unknownIcon = window.IconManager.getIcon('unknown');
            console.log('✅ フォールバックアイコン作成:', unknownIcon instanceof SVGElement);
            
            // キャッシュテスト
            const stats = window.IconManager.getCacheStats();
            console.log('✅ キャッシュ統計:', stats);
            
            console.log('🎉 IconManager テスト完了');
        } catch (error) {
            console.error('❌ IconManager テストエラー:', error);
        }
        
        console.groupEnd();
    }, 500);
}