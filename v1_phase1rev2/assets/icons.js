/**
 * 🎯 TegakiIcons - アイコンファクトリー（完全カプセル化）
 * 📋 RESPONSIBILITY: SVG定義・生成・配置の完全管理
 * 🚫 PROHIBITION: ツール管理・複雑状態管理・動的変更
 * ✅ PERMISSION: 静的リソース提供・DOM操作・ふたば風スタイル適用
 * 
 * 📏 DESIGN_PRINCIPLE: ファクトリーパターン・静的リソース・1回作成で隔離
 * 🔄 INTEGRATION: TegakiApplication → TegakiIcons.replaceAllToolIcons() のみ
 */

window.Tegaki = window.Tegaki || {};

window.Tegaki.TegakiIcons = {
    // 🎨 SVG定義データ（node_modules から抽出）
    svgData: {
        // node_modules/@tabler/icons/icons/outline/book-download.svg
        download: {
            viewBox: "0 0 24 24",
            paths: [
                "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
                "M7,10 L12,15 L17,10", 
                "M12 15L12 3"
            ]
        },
        
        // node_modules/@tabler/icons/icons/outline/resize.svg
        resize: {
            viewBox: "0 0 24 24",
            paths: [
                "M3 3L21 3L21 21L3 21z",
                "M8 12L16 12",
                "M12 8L12 16"
            ]
        },
        
        // node_modules/lucide-static/icons/palette.svg
        palette: {
            viewBox: "0 0 24 24", 
            paths: [
                "M13.5 6.5C13.776 6.5 14 6.724 14 7C14 7.276 13.776 7.5 13.5 7.5C13.224 7.5 13 7.276 13 7C13 6.724 13.224 6.5 13.5 6.5z",
                "M17.5 10.5C17.776 10.5 18 10.724 18 11C18 11.276 17.776 11.5 17.5 11.5C17.224 11.5 17 11.276 17 11C17 10.724 17.224 10.5 17.5 10.5z", 
                "M8.5 7.5C8.776 7.5 9 7.724 9 8C9 8.276 8.776 8.5 8.5 8.5C8.224 8.5 8 8.276 8 8C8 7.724 8.224 7.5 8.5 7.5z",
                "M6.5 12.5C6.776 12.5 7 12.724 7 13C7 13.276 6.776 13.5 6.5 13.5C6.224 13.5 6 13.276 6 13C6 12.724 6.224 12.5 6.5 12.5z",
                "M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C12.926 22 13.648 21.254 13.648 20.312C13.648 19.875 13.468 19.477 13.211 19.187C12.921 18.898 12.773 18.535 12.773 18.062C12.773 17.157 13.479 16.394 14.441 16.394L16.437 16.394C19.488 16.394 21.992 13.891 21.992 10.84C21.965 6.012 17.461 2 12 2z"
            ]
        },
        
        // node_modules/lucide-static/icons/pencil-line.svg
        pen: {
            viewBox: "0 0 24 24",
            paths: [
                "M3 21L3 17C3 15.895 3.895 15 5 15L7 15C8.105 15 9 15.895 9 17L9 21L3 21z",
                "M21 3C13.5 3 8.2 8.8 8.2 13.2", 
                "M21 3C20.2 11.8 10.8 15.8 10.8 15.8",
                "M10.6 9C12.4 10.8 13.2 12.4 15 14.4"
            ]
        },
        
        // node_modules/lucide-static/icons/eraser.svg
        eraser: {
            viewBox: "0 0 24 24",
            paths: [
                "M20 20L9.5 20L5.29 15.7C4.9 15.31 4.9 14.68 5.29 14.29L15.29 4.29C15.68 3.9 16.31 3.9 16.7 4.29L21.7 9.29C22.09 9.68 22.09 10.31 21.7 10.7L11.5 20",
                "M18 13.3L11.7 7"
            ]
        },
        
        // node_modules/lucide-static/icons/paint-bucket.svg
        fill: {
            viewBox: "0 0 24 24",
            paths: [
                "M19 11L5 11M19 11C20.105 11 21 11.895 21 13L21 19C21 20.105 20.105 21 19 21L5 21C3.895 21 3 20.105 3 19L3 13C3 11.895 3.895 11 5 11M19 11L19 9C19 7.895 18.105 7 17 7M5 11L5 9C5 7.895 5.895 7 7 7M7 7L7 5C7 3.895 7.895 3 9 3L15 3C16.105 3 17 3.895 17 5L17 7M7 7L17 7"
            ]
        },
        
        // node_modules/lucide-static/icons/box-select.svg
        select: {
            viewBox: "0 0 24 24",
            paths: [
                "M4 4L20 4L20 20L4 20z",
                "M9 9L15 9L15 15L9 15z"
            ]
        },
        
        // node_modules/lucide-static/icons/layers.svg
        layers: {
            viewBox: "0 0 24 24",
            paths: [
                "M12 2L22 7L12 12L2 7L12 2z",
                "M2 17L12 22L22 17",
                "M2 12L12 17L22 12"
            ]
        },
        
        // node_modules/@tabler/icons/icons/outline/settings.svg
        settings: {
            viewBox: "0 0 24 24",
            paths: [
                "M12 15C13.657 15 15 13.657 15 12C15 10.343 13.657 9 12 9C10.343 9 9 10.343 9 12C9 13.657 10.343 15 12 15z",
                "M19.4 15C19.4 15 19.73 16.82 19.73 16.82L19.79 16.88C20.68 17.77 20.68 19.23 19.79 20.12C18.9 21.01 17.44 21.01 16.55 20.12L16.49 20.06C15.84 19.41 14.75 19.08 14.75 19.08C13.76 18.68 13.76 17.32 14.75 16.92C14.75 16.92 15.84 16.59 16.49 15.94L16.55 15.88C17.44 14.99 18.9 14.99 19.79 15.88C19.79 15.88 19.73 16.82 19.4 15zM19.4 15C19.4 15 19.4 21 19.4 21C19.4 22.1 18.5 23 17.4 23C16.3 23 15.4 22.1 15.4 21L15.4 20.91C15.4 19.26 14.09 17.95 12.44 17.95C10.79 17.95 9.48 19.26 9.48 20.91L9.48 21C9.48 22.1 8.58 23 7.48 23C6.38 23 5.48 22.1 5.48 21L5.48 20.91C5.48 19.26 4.17 17.95 2.52 17.95C0.87 17.95 -0.44 19.26 -0.44 20.91L-0.44 21C-0.44 22.1 -1.34 23 -2.44 23"
            ]
        }
    },

    // 🔗 ボタンID → アイコン名マッピング
    buttonMappings: {
        'download-tool': 'download',
        'resize-tool': 'resize',
        'palette-tool': 'palette', 
        'pen-tool': 'pen',
        'eraser-tool': 'eraser',
        'fill-tool': 'fill',
        'select-tool': 'select', 
        'layers-tool': 'layers',
        'settings-tool': 'settings'
    },

    /**
     * SVGアイコン要素作成
     * @param {string} iconName - アイコン名
     * @param {Object} options - オプション
     * @returns {SVGElement} - SVG要素
     * @throws {Error} - アイコン定義不明時
     */
    createIcon(iconName, options = {}) {
        const iconData = this.svgData[iconName];
        if (!iconData) {
            throw new Error(`Icon not defined: ${iconName}`);
        }

        // SVG要素作成
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', iconData.viewBox);
        svg.setAttribute('width', options.size || 20);
        svg.setAttribute('height', options.size || 20);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor'); 
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        
        // ふたば風統一クラス適用
        svg.classList.add('futaba-icon');

        // パス要素追加
        iconData.paths.forEach(pathData => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            svg.appendChild(path);
        });

        return svg;
    },

    /**
     * 特定ボタンのアイコン置換
     * @param {string} buttonId - ボタンID
     * @param {string} iconName - アイコン名
     */
    replaceButtonIcon(buttonId, iconName) {
        const button = document.getElementById(buttonId);
        if (!button) {
            throw new Error(`Button not found: ${buttonId}`);
        }

        // 既存SVG削除
        const existingSvg = button.querySelector('svg');
        if (existingSvg) {
            existingSvg.remove();
        }

        // 新アイコン配置
        const iconSvg = this.createIcon(iconName);
        button.appendChild(iconSvg);
        
        console.log(`✅ Icon replaced: ${buttonId} → ${iconName}`);
    },

    /**
     * 全ツールボタンアイコン一括置換（メイン機能）
     */
    replaceAllToolIcons() {
        let successCount = 0;
        let errorCount = 0;

        Object.entries(this.buttonMappings).forEach(([buttonId, iconName]) => {
            try {
                this.replaceButtonIcon(buttonId, iconName);
                successCount++;
            } catch (error) {
                console.error(`❌ Icon replacement failed: ${buttonId}`, error);
                errorCount++;
                throw error; // 上位でErrorManager経由処理
            }
        });

        console.log(`🎨 Icon internalization completed: ${successCount} success, ${errorCount} errors`);
    },

    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            iconCount: Object.keys(this.svgData).length,
            buttonMappingCount: Object.keys(this.buttonMappings).length,
            availableIcons: Object.keys(this.svgData),
            buttonMappings: this.buttonMappings
        };
    }
};