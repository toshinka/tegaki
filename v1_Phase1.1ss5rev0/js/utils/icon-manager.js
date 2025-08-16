pen: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 21v-4a4 4 0 1 1 4 4h-4"/>
                    <path d="M21 3a16 16 0 0 0 -12.8 10.2"/>
                    <path d="M21 3a16 16 0 0 1 -10.2 12.8"/>
                    <path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>
                </svg>
            `,
            
            eraser: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20"/>
                    <path d="M18 13.3l-6.3-6.3"/>
                </svg>
            `,
            
            palette: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="13.5" cy="6.5" r=".5"/>
                    <circle cx="17.5" cy="10.5" r=".5"/>
                    <circle cx="8.5" cy="7.5" r=".5"/>
                    <circle cx="6.5" cy="12.5" r=".5"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                </svg>
            `,
            
            download: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            `,
            
            settings: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
            `,
            
            resize: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 14.76V3a1 1 0 0 0-1-1H6.5a1 1 0 0 0-.7.29L2.29 5.8A1 1 0 0 0 2 6.5V18a1 1 0 0 0 1 1h11.24"/>
                    <path d="M15 15h5l-5 5"/>
                    <path d="M20 15v4"/>
                </svg>
            `
        });
        
        console.log(`✅ 内蔵アイコンセット初期化完了 - ${this.iconSets.size}セット`);
    }
    
    /**
     * 🎯 STEP5: テーマシステム初期化
     */
    initializeThemeSystem() {
        console.log('🎨 テーマシステム初期化開始...');
        
        // デフォルトテーマ
        this.themes.available.set('default', {
            name: 'デフォルト',
            colors: {
                primary: 'currentColor',
                secondary: '#666666',
                accent: '#0066cc',
                error: '#ff4444'
            },
            strokeWidth: 2,
            size: 24
        });
        
        // ふたば☆ちゃんねる風テーマ
        this.themes.available.set('futaba', {
            name: 'ふたば☆ちゃんねる',
            colors: {
                primary: '#800000',
                secondary: '#cf9c97',
                accent: '#f0e0d6',
                error: '#cc0000'
            },
            strokeWidth: 2,
            size: 20
        });
        
        // ダークテーマ
        this.themes.available.set('dark', {
            name: 'ダーク',
            colors: {
                primary: '#ffffff',
                secondary: '#cccccc',
                accent: '#66b3ff',
                error: '#ff6666'
            },
            strokeWidth: 2,
            size: 24
        });
        
        // 高コントラストテーマ
        this.themes.available.set('high-contrast', {
            name: '高コントラスト',
            colors: {
                primary: '#000000',
                secondary: '#666666',
                accent: '#0000ff',
                error: '#ff0000'
            },
            strokeWidth: 3,
            size: 28
        });
        
        console.log(`✅ テーマシステム初期化完了 - ${this.themes.available.size}テーマ`);
    }
    
    /**
     * 🎯 STEP5: @tabler/icons統合（利用可能時）
     */
    integrateTablerIcons() {
        console.log('📦 @tabler/icons統合確認...');
        
        // @tabler/icons-react の確認（将来対応）
        if (typeof window.TablerIcons !== 'undefined') {
            console.log('✅ @tabler/icons検出 - 統合開始');
            this.loadTablerIconsSet();
        } else {
            console.log('⚠️ @tabler/icons未検出 - 内蔵アイコンのみ使用');
        }
        
        // 📋 V8_MIGRATION: 動的インポート対応予定
        /* V8移行時対応:
         * const tablerIcons = await import('@tabler/icons');
         * this.integrateExternalIconSet('tabler', tablerIcons);
         */
    }
    
    /**
     * 🎯 STEP5: カスタムアイコン読み込み
     */
    loadCustomIcons() {
        console.log('🔧 カスタムアイコン読み込み開始...');
        
        // localStorage からカスタムアイコン読み込み
        try {
            const customIconsData = localStorage.getItem('custom-icons');
            if (customIconsData) {
                const customIcons = JSON.parse(customIconsData);
                Object.entries(customIcons).forEach(([name, svg]) => {
                    this.customIcons.set(name, svg);
                });
                
                console.log(`✅ カスタムアイコン読み込み完了 - ${this.customIcons.size}個`);
            }
        } catch (error) {
            console.warn('⚠️ カスタムアイコン読み込みエラー:', error);
        }
    }
    
    /**
     * 🎯 STEP5: パフォーマンス最適化
     */
    optimizeIcons() {
        if (!this.customization.optimization) return;
        
        console.log('⚡ アイコン最適化開始...');
        
        // SVG最適化（基本的なクリーンアップ）
        const optimizeCount = this.optimizeAllSVGs();
        
        // キャッシュ最適化
        this.optimizeCache();
        
        console.log(`✅ アイコン最適化完了 - ${optimizeCount}個最適化`);
    }
    
    /**
     * 🎯 STEP5: SVG最適化
     */
    optimizeAllSVGs() {
        let optimizedCount = 0;
        
        // 内蔵アイコンセット最適化
        this.iconSets.forEach((iconSet, setName) => {
            Object.entries(iconSet).forEach(([iconName, svg]) => {
                const optimized = this.optimizeSVG(svg);
                if (optimized !== svg) {
                    iconSet[iconName] = optimized;
                    optimizedCount++;
                }
            });
        });
        
        // カスタムアイコン最適化
        this.customIcons.forEach((svg, name) => {
            const optimized = this.optimizeSVG(svg);
            if (optimized !== svg) {
                this.customIcons.set(name, optimized);
                optimizedCount++;
            }
        });
        
        return optimizedCount;
    }
    
    /**
     * 🎯 STEP5: 単一SVG最適化
     */
    optimizeSVG(svg) {
        if (!svg || typeof svg !== 'string') return svg;
        
        return svg
            .replace(/\s+/g, ' ') // 余分な空白削除
            .replace(/>\s+</g, '><') // タグ間空白削除
            .replace(/\s*([\/>])/g, '$1') // タグ前空白削除
            .trim();
    }
    
    /**
     * 🎯 STEP5: キャッシュ最適化
     */
    optimizeCache() {
        // 使用頻度の低いアイコンをキャッシュから削除
        const maxCacheSize = 100;
        
        if (this.loading.cache.size > maxCacheSize) {
            const entries = Array.from(this.loading.cache.entries());
            const sorted = entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
            
            // 古いエントリを削除
            const toDelete = sorted.slice(0, entries.length - maxCacheSize);
            toDelete.forEach(([key]) => {
                this.loading.cache.delete(key);
            });
            
            console.log(`🗑️ キャッシュクリーンアップ - ${toDelete.length}個削除`);
        }
    }
    
    // ==========================================
    // 🎯 STEP5: アイコンセット管理システム
    // ==========================================
    
    /**
     * アイコンセット登録
     */
    registerIconSet(setName, icons) {
        this.iconSets.set(setName, icons);
        
        // 個別アイコンとしても登録
        Object.entries(icons).forEach(([iconName, svg]) => {
            this.icons.set(iconName, svg);
        });
        
        console.log(`📦 アイコンセット登録: ${setName} (${Object.keys(icons).length}個)`);
    }
    
    /**
     * アイコンセット削除
     */
    unregisterIconSet(setName) {
        const iconSet = this.iconSets.get(setName);
        if (!iconSet) return false;
        
        // 個別アイコンも削除
        Object.keys(iconSet).forEach(iconName => {
            this.icons.delete(iconName);
        });
        
        this.iconSets.delete(setName);
        console.log(`🗑️ アイコンセット削除: ${setName}`);
        
        return true;
    }
    
    /**
     * アイコンセット一覧取得
     */
    getIconSets() {
        const sets = [];
        
        this.iconSets.forEach((icons, setName) => {
            sets.push({
                name: setName,
                iconCount: Object.keys(icons).length,
                icons: Object.keys(icons)
            });
        });
        
        return sets;
    }
    
    // ==========================================
    // 🎯 STEP5: テーマ管理システム
    // ==========================================
    
    /**
     * テーマ設定
     */
    setTheme(themeName) {
        if (!this.themes.available.has(themeName)) {
            console.warn(`⚠️ テーマが見つかりません: ${themeName}`);
            return false;
        }
        
        const oldTheme = this.themes.current;
        this.themes.current = themeName;
        
        // テーマ適用
        this.applyCurrentTheme();
        
        console.log(`🎨 テーマ変更: ${oldTheme} → ${themeName}`);
        
        return true;
    }
    
    /**
     * 現在のテーマ適用
     */
    applyCurrentTheme() {
        const theme = this.themes.available.get(this.themes.current);
        if (!theme) return;
        
        // CSS変数設定
        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([colorName, colorValue]) => {
            root.style.setProperty(`--icon-${colorName}`, colorValue);
        });
        
        root.style.setProperty('--icon-stroke-width', theme.strokeWidth.toString());
        root.style.setProperty('--icon-size', `${theme.size}px`);
        
        // カスタムCSS適用
        this.applyCustomCSS();
    }
    
    /**
     * カスタムCSS適用
     */
    applyCustomCSS() {
        let styleElement = document.getElementById('icon-custom-styles');
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'icon-custom-styles';
            document.head.appendChild(styleElement);
        }
        
        styleElement.textContent = this.themes.customCSS;
    }
    
    /**
     * 色オーバーライド設定
     */
    setColorOverride(iconName, color) {
        this.themes.colorOverrides.set(iconName, color);
        console.log(`🎨 色オーバーライド: ${iconName} → ${color}`);
    }
    
    /**
     * 色オーバーライド削除
     */
    removeColorOverride(iconName) {
        const removed = this.themes.colorOverrides.delete(iconName);
        if (removed) {
            console.log(`🗑️ 色オーバーライド削除: ${iconName}`);
        }
        return removed;
    }
    
    // ==========================================
    // 🎯 STEP5: 動的読み込みシステム
    // ==========================================
    
    /**
     * 非同期アイコン読み込み
     */
    async loadIconAsync(iconName, source = null) {
        const cacheKey = `${iconName}:${source || 'default'}`;
        
        // キャッシュチェック
        if (this.loading.cache.has(cacheKey)) {
            const cached = this.loading.cache.get(cacheKey);
            cached.lastUsed = Date.now();
            this.performance.cacheHits++;
            return cached.svg;
        }
        
        this.performance.cacheMisses++;
        
        try {
            let svg = null;
            
            if (source) {
                // 外部ソースから読み込み
                svg = await this.loadFromExternalSource(iconName, source);
            } else {
                // 内蔵アイコンから検索
                svg = this.getIcon(iconName);
            }
            
            if (svg) {
                // キャッシュに保存
                this.loading.cache.set(cacheKey, {
                    svg,
                    loadedAt: Date.now(),
                    lastUsed: Date.now(),
                    source: source || 'builtin'
                });
                
                this.loading.loaded.add(cacheKey);
            } else {
                this.loading.failed.add(cacheKey);
            }
            
            return svg;
            
        } catch (error) {
            console.error(`❌ アイコン読み込みエラー (${iconName}):`, error);
            this.loading.failed.add(cacheKey);
            return null;
        }
    }
    
    /**
     * 外部ソースからアイコン読み込み（将来実装）
     */
    async loadFromExternalSource(iconName, source) {
        // 将来実装: CDN、API、ファイルシステムからの読み込み
        console.log(`📡 外部アイコン読み込み: ${iconName} from ${source}`);
        return null;
    }
    
    /**
     * アイコンプリロード
     */
    async preloadIcons(iconNames) {
        console.log(`📦 アイコンプリロード開始: ${iconNames.length}個`);
        
        const loadPromises = iconNames.map(iconName => 
            this.loadIconAsync(iconName).catch(error => {
                console.warn(`⚠️ プリロード失敗: ${iconName}`, error);
                return null;
            })
        );
        
        const results = await Promise.all(loadPromises);
        const successCount = results.filter(result => result !== null).length;
        
        console.log(`✅ アイコンプリロード完了: ${successCount}/${iconNames.length}個`);
        
        return successCount;
    }
    
    // ==========================================
    // 🎯 STEP5: 基本アイコン操作システム
    // ==========================================
    
    /**
     * アイコン取得（拡張版）
     */
    getIcon(name, options = {}) {
        const startTime = performance.now();
        
        // キャッシュチェック
        const cacheKey = this.generateCacheKey(name, options);
        if (this.loading.cache.has(cacheKey)) {
            const cached = this.loading.cache.get(cacheKey);
            cached.lastUsed = Date.now();
            this.performance.cacheHits++;
            this.performance.renderTime += performance.now() - startTime;
            return cached.svg;
        }
        
        this.performance.cacheMisses++;
        
        // アイコン検索順序: カスタム → 内蔵 → アイコンセット
        let svg = null;
        
        // 1. カスタムアイコン
        if (this.customIcons.has(name)) {
            svg = this.customIcons.get(name);
        }
        // 2. 内蔵アイコン
        else if (this.icons.has(name)) {
            svg = this.icons.get(name);
        }
        // 3. アイコンセットから検索
        else {
            svg = this.findIconInSets(name);
        }
        
        if (!svg) {
            console.warn(`⚠️ アイコン '${name}' が見つかりません`);
            this.performance.renderTime += performance.now() - startTime;
            return this.getFallbackIcon(name);
        }
        
        // オプション適用
        if (Object.keys(options).length > 0) {
            svg = this.applyIconOptions(svg, options);
        }
        
        // テーマ適用
        svg = this.applyThemeToIcon(svg, name);
        
        // キャッシュに保存
        this.loading.cache.set(cacheKey, {
            svg,
            loadedAt: Date.now(),
            lastUsed: Date.now(),
            source: 'processed'
        });
        
        this.performance.renderTime += performance.now() - startTime;
        return svg;
    }
    
    /**
     * アイコンセットから検索
     */
    findIconInSets(name) {
        for (const [setName, iconSet] of this.iconSets) {
            if (iconSet[name]) {
                return iconSet[name];
            }
        }
        return null;
    }
    
    /**
     * フォールバックアイコン取得
     */
    getFallbackIcon(name) {
        // 基本的な□アイコンを返す
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <text x="12" y="16" text-anchor="middle" font-size="8" fill="currentColor">?</text>
            </svg>
        `;
    }
    
    /**
     * アイコンオプション適用
     */
    applyIconOptions(svg, options) {
        let processedSvg = svg;
        
        // サイズ変更
        if (options.size) {
            processedSvg = processedSvg.replace(
                /width="[^"]*"|height="[^"]*"/g,
                `width="${options.size}" height="${options.size}"`
            );
        }
        
        // 色変更
        if (options.color) {
            processedSvg = processedSvg.replace(
                /stroke="[^"]*"/g,
                `stroke="${options.color}"`
            );
        }
        
        // ストローク幅変更
        if (options.strokeWidth) {
            processedSvg = processedSvg.replace(
                /stroke-width="[^"]*"/g,
                `stroke-width="${options.strokeWidth}"`
            );
        }
        
        return processedSvg;
    }
    
    /**
     * テーマ適用
     */
    applyThemeToIcon(svg, iconName) {
        // 色オーバーライドチェック
        if (this.themes.colorOverrides.has(iconName)) {
            const overrideColor = this.themes.colorOverrides.get(iconName);
            svg = svg.replace(/stroke="currentColor"/g, `stroke="${overrideColor}"`);
        }
        
        // 現在のテーマ適用
        const theme = this.themes.available.get(this.themes.current);
        if (theme && this.themes.current !== 'default') {
            svg = svg.replace(
                /stroke-width="2"/g,
                `stroke-width="${theme.strokeWidth}"`
            );
        }
        
        return svg;
    }
    
    /**
     * キャッシュキー生成
     */
    generateCacheKey(name, options) {
        const optionsStr = Object.keys(options).length > 0 ? 
            JSON.stringify(options) : '';
        return `${name}:${this.themes.current}:${optionsStr}`;
    }
    
    /**
     * HTML要素にアイコン設定（拡張版）
     */
    setElementIcon(element, iconName, options = {}) {
        if (!element) {
            console.warn('⚠️ 要素が指定されていません');
            return false;
        }
        
        const iconSvg = this.getIcon(iconName, options);
        if (iconSvg) {
            // アニメーション適用
            if (this.customization.animations && options.animate !== false) {
                element.style.transition = 'opacity 0.2s ease';
                element.style.opacity = '0';
                
                setTimeout(() => {
                    element.innerHTML = iconSvg;
                    element.style.opacity = '1';
                }, 100);
            } else {
                element.innerHTML = iconSvg;
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 複数要素にアイコン一括設定（拡張版）
     */
    setMultipleIcons(mapping, options = {}) {
        let successCount = 0;
        
        Object.entries(mapping).forEach(([elementId, iconName]) => {
            const element = typeof elementId === 'string' ? 
                document.getElementById(elementId) : elementId;
                
            if (element && this.setElementIcon(element, iconName, options)) {
                successCount++;
            }
        });
        
        console.log(`✅ アイコン一括設定完了 - ${successCount}個設定`);
        return successCount;
    }
    
    /**
     * ツールボタンアイコン更新（拡張版）
     */
    updateToolButtonIcons(theme = null) {
        const iconMapping = {
            'pen-tool': 'pen',
            'eraser-tool': 'eraser',
            'fill-tool': 'bucket',
            'select-tool': 'selection-dashed',
            'palette-tool': 'palette',
            'download-tool': 'download',
            'resize-tool': 'resize',
            'settings-tool': 'settings'
        };
        
        const options = {};
        if (theme) {
            const themeData = this.themes.available.get(theme);
            if (themeData) {
                options.color = themeData.colors.primary;
                options.size = themeData.size;
                options.strokeWidth = themeData.strokeWidth;
            }
        }
        
        return this.setMultipleIcons(iconMapping, options);
    }
    
    // ==========================================
    // 🎯 STEP5: カスタムアイコン管理システム
    // ==========================================
    
    /**
     * カスタムアイコン追加
     */
    addCustomIcon(name, svg) {
        if (!name || !svg) {
            console.warn('⚠️ アイコン名またはSVGが無効です');
            return false;
        }
        
        // SVG最適化
        const optimizedSvg = this.optimizeSVG(svg);
        
        this.customIcons.set(name, optimizedSvg);
        this.saveCustomIconsToStorage();
        
        console.log(`➕ カスタムアイコン追加: ${name}`);
        return true;
    }
    
    /**
     * カスタムアイコン削除
     */
    removeCustomIcon(name) {
        const removed = this.customIcons.delete(name);
        if (removed) {
            this.saveCustomIconsToStorage();
            console.log(`🗑️ カスタムアイコン削除: ${name}`);
        }
        return removed;
    }
    
    /**
     * カスタムアイコンをストレージに保存
     */
    saveCustomIconsToStorage() {
        try {
            const customIconsData = Object.fromEntries(this.customIcons);
            localStorage.setItem('custom-icons', JSON.stringify(customIconsData));
            console.log(`💾 カスタムアイコン保存完了 - ${/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: アイコン管理・動的読み込み・テーマ対応・カスタマイズ・@tabler統合
 * 🎯 DEPENDENCIES: なし（独立ユーティリティ）
 * 🎯 NODE_MODULES: @tabler/icons-react（計画追加）
 * 🎯 PIXI_EXTENSIONS: なし
 * 🎯 ISOLATION_TEST: ✅ 完全独立テスト可能
 * 🎯 SPLIT_THRESHOLD: 200行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5 - JavaScript機能分割完了・AI分業基盤確立
 * 📋 V8_MIGRATION: SVG最適化・WebGPUテクスチャ対応・動的インポート
 * 📋 PERFORMANCE_TARGET: アイコン読み込み50ms以下・メモリ効率化
 * 📋 DRY_COMPLIANCE: ✅ 共通処理統合・重複コード排除・ライブラリ活用
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * アイコン管理システム（STEP5機能拡張版）
 * 動的読み込み・テーマ対応・カスタマイズ・@tabler/icons統合
 * Pure JavaScript完全準拠・AI分業対応
 */
class IconManager {
    constructor() {
        this.version = 'v1.0-Phase1.1ss5';
        
        // 🎯 STEP5: アイコン管理システム
        this.icons = new Map();
        this.customIcons = new Map();
        this.iconSets = new Map();
        this.initialized = false;
        
        // 🎯 STEP5: テーマ対応システム
        this.themes = {
            current: 'default',
            available: new Map(),
            customCSS: '',
            colorOverrides: new Map()
        };
        
        // 🎯 STEP5: 動的読み込みシステム
        this.loading = {
            queue: [],
            loaded: new Set(),
            failed: new Set(),
            cache: new Map()
        };
        
        // 🎯 STEP5: カスタマイズシステム
        this.customization = {
            defaultSize: 24,
            defaultStrokeWidth: 2,
            defaultColor: 'currentColor',
            animations: true,
            optimization: true
        };
        
        // 🎯 STEP5: パフォーマンス監視
        this.performance = {
            loadTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            renderTime: 0,
            totalIcons: 0
        };
        
        console.log(`🎨 IconManager STEP5構築開始 - ${this.version}`);
        this.initialize();
    }
    
    /**
     * 🎯 STEP5: アイコン管理システム初期化
     */
    initialize() {
        console.group(`🎨 IconManager STEP5初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 内蔵アイコンセット初期化
            this.initializeBuiltinIcons();
            
            // Phase 2: テーマシステム初期化
            this.initializeThemeSystem();
            
            // Phase 3: @tabler/icons統合（利用可能時）
            this.integrateTablerIcons();
            
            // Phase 4: カスタムアイコン読み込み
            this.loadCustomIcons();
            
            // Phase 5: パフォーマンス最適化
            this.optimizeIcons();
            
            const initTime = performance.now() - startTime;
            this.performance.loadTime = initTime;
            
            this.initialized = true;
            console.log(`✅ IconManager STEP5初期化完了 - ${initTime.toFixed(2)}ms`);
            console.log(`📊 アイコン統計: ${this.icons.size}個登録`);
            
        } catch (error) {
            console.error('❌ IconManager STEP5初期化エラー:', error);
            
            // フォールバック初期化
            this.fallbackInitialize();
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 STEP5: 内蔵アイコンセット初期化
     */
    initializeBuiltinIcons() {
        console.log('🏗️ 内蔵アイコンセット初期化開始...');
        
        // ふたば☆ちゃんねる風カスタムアイコン
        this.registerIconSet('futaba-custom', {
            // バケツアイコン（塗りつぶし用）
            bucket: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                    <path d="m5 2 5 5"/>
                    <path d="M2 13h15"/>
                    <path d="M7 21V10.5"/>
                </svg>
            `,
            
            // 破線□アイコン（範囲選択用）
            'selection-dashed': `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
            `,
            
            // ふたば☆ちゃんねる風ペンアイコン
            'pen-futaba': `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 21v-4a4 4 0 1 1 4 4h-4"/>
                    <path d="M21 3a16 16 0 0 0 -12.8 10.2"/>
                    <path d="M21 3a16 16 0 0 1 -10.2 12.8"/>
                    <path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>
                </svg>
            `
        });
        
        // 基本ツールアイコンセット
        this.registerIconSet('tools-basic', {
            pen: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 21v-4a4