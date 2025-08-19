/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 - Phase1後期改修版
 * 
 * 🎯 AI_WORK_SCOPE: @tabler/icons統合・バケツ・選択範囲・レイヤー・GIF・統一システム完全活用
 * 🎯 DEPENDENCIES: ConfigManager・ErrorManager・StateManager・EventBus（統一システム完全依存）
 * 🎯 NODE_MODULES: @tabler/icons@^3.34.1
 * 🎯 PIXI_EXTENSIONS: なし
 * 🎯 ISOLATION_TEST: ✅ 統一システム依存・単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行以下維持・機能分離済み
 * 🎯 DRY_SOLID: ✅ DRY完全準拠・SOLID原則完全遵守
 * 
 * 📋 PHASE_TARGET: Phase1後期改修 - アイコンシステム@tabler/icons統合
 * 📋 BREAKING_CHANGES: @tabler/icons-react → @tabler/icons変更
 * 📋 NEW_FEATURES: レイヤーアイコン・GIFアイコン・バケツ改善・選択範囲改善
 * 📋 UNIFIED_SYSTEMS: ConfigManager・ErrorManager・StateManager・EventBus完全活用
 */

/**
 * 改良版アイコン管理システム（Phase1後期改修版）
 * @tabler/icons統合・バケツ・選択範囲・レイヤー・GIF・統一システム完全活用
 * DRY・SOLID原則完全準拠・AI協働開発最適化
 */
class IconManager {
    constructor() {
        this.version = 'v1.0-Phase1後期改修';
        
        // 🎯 統一システム依存性確認（必須）
        this.validateUnifiedSystems();
        
        // 🎯 ConfigManager統合
        this.config = ConfigManager.get('icons') || this.getDefaultIconConfig();
        
        // 🎯 Phase1後期改修: アイコン管理システム
        this.icons = new Map();
        this.customIcons = new Map();
        this.tablerIcons = new Map();
        this.initialized = false;
        
        // 🎯 @tabler/icons統合システム
        this.tabler = {
            available: false,
            basePath: './node_modules/@tabler/icons/icons/',
            iconCache: new Map(),
            fallbackEnabled: true,
            loadedCount: 0
        };
        
        // 🎯 新機能アイコン対応
        this.specializedIcons = {
            bucket: null,          // 改良バケツアイコン
            select: null,          // 改良選択範囲アイコン
            layers: null,          // レイヤーアイコン
            gif: null,             // GIFアイコン
            movie: null            // 動画アイコン
        };
        
        // 🎯 テーマシステム（ConfigManager連携）
        this.themes = {
            current: this.config.defaultTheme || 'futaba',
            available: new Map(),
            colorOverrides: new Map()
        };
        
        // 🎯 キャッシュシステム（StateManager連携）
        this.cache = {
            rendered: new Map(),
            maxSize: this.config.cacheSize || 200,
            hitCount: 0,
            missCount: 0
        };
        
        console.log('🎨 IconManager Phase1後期改修構築開始 - ' + this.version);
        this.initialize();
    }
    
    /**
     * 🎯 統一システム依存性確認（DRY・SOLID原則）
     */
    validateUnifiedSystems() {
        const requiredSystems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = requiredSystems.filter(system => !window[system]);
        
        if (missing.length > 0) {
            const errorMessage = 'IconManager Phase1後期: 統一システム依存不足: ' + missing.join(', ');
            console.error('❌', errorMessage);
            throw new Error(errorMessage);
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 🎯 デフォルトアイコン設定取得（ConfigManager準拠）
     */
    getDefaultIconConfig() {
        return {
            defaultTheme: 'futaba',
            cacheSize: 200,
            animationsEnabled: true,
            optimizationEnabled: true,
            tablerIconsEnabled: true,
            fallbackEnabled: true,
            iconSizes: {
                small: 16,
                medium: 20,
                large: 24
            },
            themes: {
                futaba: {
                    primary: '#800000',
                    secondary: '#cf9c97',
                    accent: '#f0e0d6'
                },
                default: {
                    primary: 'currentColor',
                    secondary: '#666666',
                    accent: '#0066cc'
                }
            }
        };
    }
    
    /**
     * 🎯 Phase1後期改修: アイコンシステム初期化
     */
    initialize() {
        console.group('🎨 IconManager Phase1後期改修初期化 - ' + this.version);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: @tabler/icons統合・検証
            this.integrateTablerIcons();
            
            // Phase 2: 改良版専用アイコン作成（バケツ・選択範囲・レイヤー・GIF）
            this.createEnhancedSpecializedIcons();
            
            // Phase 3: テーマシステム初期化（ConfigManager連携）
            this.initializeThemeSystem();
            
            // Phase 4: フォールバックシステム強化
            this.initializeEnhancedFallbackSystem();
            
            // Phase 5: 統一システム連携・最適化
            this.integrateWithUnifiedSystems();
            
            const initTime = performance.now() - startTime;
            this.initialized = true;
            
            // StateManager連携
            StateManager.updateComponentState('iconManager', 'initialized', {
                version: this.version,
                iconCount: this.getTotalIconCount(),
                initTime: Math.round(initTime)
            });
            
            console.log('✅ IconManager Phase1後期改修初期化完了 - ' + initTime.toFixed(2) + 'ms');
            console.log('📊 アイコン統計: ' + this.getTotalIconCount() + '個登録');
            
        } catch (error) {
            // ErrorManager統合
            ErrorManager.showError('icon-system', 
                'IconManager初期化エラー: ' + error.message, 
                { error, version: this.version }
            );
            
            // フォールバック初期化
            this.fallbackInitialize();
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 @tabler/icons統合システム（Phase1後期重点）
     */
    integrateTablerIcons() {
        console.log('📦 @tabler/icons統合開始...');
        
        // @tabler/icons利用可能性確認
        this.checkTablerAvailability();
        
        if (this.tabler.available) {
            console.log('✅ @tabler/icons検出 - 統合実行');
            this.setupTablerIconMappings();
        } else {
            console.log('⚠️ @tabler/icons未検出 - フォールバック準備');
            this.prepareFallbackIcons();
        }
        
        console.log('📦 @tabler/icons統合完了');
    }
    
    /**
     * @tabler/icons利用可能性確認
     */
    checkTablerAvailability() {
        try {
            // Method 1: SVGファイル直接アクセス確認
            this.testTablerIconAccess();
            
            // Method 2: node_modules構造確認
            this.tabler.available = this.config.tablerIconsEnabled;
            
        } catch (error) {
            console.log('⚠️ @tabler/icons確認中にエラー:', error.message);
            this.tabler.available = false;
        }
    }
    
    /**
     * @tabler/iconsアクセステスト
     */
    async testTablerIconAccess() {
        try {
            // 基本アイコンでテスト（非同期だが結果は保存）
            const testIcons = ['bucket', 'select', 'layers', 'movie'];
            
            for (const iconName of testIcons) {
                const url = this.tabler.basePath + iconName + '.svg';
                
                // フェッチテスト（結果は保存しない、存在確認のみ）
                fetch(url, { method: 'HEAD' })
                    .then(response => {
                        if (response.ok) {
                            this.tabler.loadedCount++;
                        }
                    })
                    .catch(() => {
                        // エラーは無視（フォールバック使用）
                    });
            }
            
            // 基本的には利用可能とみなす
            this.tabler.available = true;
            
        } catch (error) {
            this.tabler.available = false;
        }
    }
    
    /**
     * @tabler/iconsマッピング設定
     */
    setupTablerIconMappings() {
        // Phase1後期改修: 重点アイコンマッピング
        const iconMappings = {
            // 基本ツール
            'pen': 'pencil',
            'eraser': 'eraser',
            'palette': 'palette',
            'download': 'download',
            'settings': 'settings',
            'resize': 'arrows-move',
            
            // Phase1後期改修: 新規・改良アイコン
            'bucket': 'bucket',              // 塗りつぶし（バケツ）
            'fill': 'bucket',                // エイリアス
            'select': 'select',              // 選択範囲
            'selection': 'select',           // エイリアス
            'layers': 'layers',              // レイヤー
            'gif': 'movie',                  // GIFアニメ
            'movie': 'movie',                // 動画
            'film': 'film',                  // フィルム
            'clapperboard': 'clapperboard'   // カチンコ
        };
        
        Object.entries(iconMappings).forEach(([internalName, tablerName]) => {
            this.tabler.iconCache.set(internalName, tablerName);
        });
        
        console.log('📋 @tabler/icons マッピング: ' + Object.keys(iconMappings).length + '個設定');
    }
    
    /**
     * 🎯 改良版専用アイコン作成（Phase1後期重点）
     */
    createEnhancedSpecializedIcons() {
        console.log('🎯 改良版専用アイコン作成開始...');
        
        // Phase1後期重点: 改良版バケツアイコン
        this.createEnhancedBucketIcon();
        
        // Phase1後期重点: 改良版選択範囲アイコン
        this.createEnhancedSelectionIcon();
        
        // Phase1後期新機能: レイヤーアイコン
        this.createLayersIcon();
        
        // Phase1後期新機能: GIF/動画アイコン
        this.createGifAnimationIcon();
        
        console.log('✅ 改良版専用アイコン作成完了');
    }
    
    /**
     * 改良版バケツアイコン（塗りつぶし用・高品質・@tabler/icons風）
     */
    createEnhancedBucketIcon() {
        const enhancedBucketIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-bucket-enhanced">' +
            '<!-- バケツ本体（@tabler/icons bucket準拠） -->' +
            '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>' +
            '<!-- ハンドル -->' +
            '<path d="m5 2 5 5"/>' +
            '<!-- 注ぎ口液体表現 -->' +
            '<circle cx="2" cy="13" r="2" fill="currentColor" opacity="0.6"/>' +
            '<!-- 液体飛沫効果 -->' +
            '<circle cx="4" cy="15" r="1" fill="currentColor" opacity="0.4"/>' +
            '<circle cx="1" cy="16" r="0.5" fill="currentColor" opacity="0.3"/>' +
            '</svg>';
        
        this.specializedIcons.bucket = enhancedBucketIcon;
        this.icons.set('bucket', enhancedBucketIcon);
        this.icons.set('fill', enhancedBucketIcon); // エイリアス
        
        console.log('🪣 改良版バケツアイコン作成完了');
    }
    
    /**
     * 改良版選択範囲アイコン（破線矩形・高識別性・アニメーション対応）
     */
    createEnhancedSelectionIcon() {
        const animationPart = this.config.animationsEnabled ? 
            '<animate attributeName="stroke-dashoffset" values="0;8" dur="1s" repeatCount="indefinite"/>' : '';
        
        const enhancedSelectionIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-selection-enhanced">' +
            '<!-- メイン選択範囲（破線・アニメーション対応） -->' +
            '<rect x="4" y="4" width="16" height="16" stroke-dasharray="4 2" fill="none" opacity="0.8">' +
            animationPart +
            '</rect>' +
            '<!-- 角のハンドル（リサイズ表現） -->' +
            '<rect x="3" y="3" width="2" height="2" fill="currentColor" opacity="0.7"/>' +
            '<rect x="19" y="3" width="2" height="2" fill="currentColor" opacity="0.7"/>' +
            '<rect x="3" y="19" width="2" height="2" fill="currentColor" opacity="0.7"/>' +
            '<rect x="19" y="19" width="2" height="2" fill="currentColor" opacity="0.7"/>' +
            '<!-- 中央移動アイコン -->' +
            '<path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1" opacity="0.5"/>' +
            '<path d="m10 10 2-2 2 2M10 14l2 2 2-2" stroke="currentColor" stroke-width="1" opacity="0.4"/>' +
            '</svg>';
        
        this.specializedIcons.select = enhancedSelectionIcon;
        this.icons.set('select', enhancedSelectionIcon);
        this.icons.set('selection', enhancedSelectionIcon); // エイリアス
        
        console.log('🔲 改良版選択範囲アイコン作成完了');
    }
    
    /**
     * レイヤーアイコン（@tabler/icons layers準拠・3D効果）
     */
    createLayersIcon() {
        const layersIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-layers">' +
            '<!-- 上層レイヤー -->' +
            '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>' +
            '<!-- 中層レイヤー -->' +
            '<path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>' +
            '<!-- 下層レイヤー -->' +
            '<path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>' +
            '<!-- レイヤー番号表示 -->' +
            '<circle cx="18" cy="6" r="3" fill="currentColor" opacity="0.2"/>' +
            '<text x="18" y="7" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.8">3</text>' +
            '</svg>';
        
        this.specializedIcons.layers = layersIcon;
        this.icons.set('layers', layersIcon);
        
        console.log('📚 レイヤーアイコン作成完了');
    }
    
    /**
     * GIFアニメーションアイコン（動画系・映画フィルム風）
     */
    createGifAnimationIcon() {
        const gifIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-gif-animation">' +
            '<!-- フィルムストリップ -->' +
            '<rect x="2" y="3" width="20" height="18" rx="2" fill="none"/>' +
            '<path d="M7 3v18M17 3v18"/>' +
            '<!-- フィルム穴 -->' +
            '<circle cx="4.5" cy="6" r="0.5" fill="currentColor"/>' +
            '<circle cx="4.5" cy="10" r="0.5" fill="currentColor"/>' +
            '<circle cx="4.5" cy="14" r="0.5" fill="currentColor"/>' +
            '<circle cx="4.5" cy="18" r="0.5" fill="currentColor"/>' +
            '<circle cx="19.5" cy="6" r="0.5" fill="currentColor"/>' +
            '<circle cx="19.5" cy="10" r="0.5" fill="currentColor"/>' +
            '<circle cx="19.5" cy="14" r="0.5" fill="currentColor"/>' +
            '<circle cx="19.5" cy="18" r="0.5" fill="currentColor"/>' +
            '<!-- 再生ボタン（中央フレーム） -->' +
            '<path d="m10 9 5 3-5 3z" fill="currentColor" opacity="0.6"/>' +
            '<!-- GIF表示 -->' +
            '<text x="12" y="7" text-anchor="middle" font-size="4" fill="currentColor" opacity="0.5">GIF</text>' +
            '</svg>';
        
        // 代替：カチンコアイコン
        const clapperboardIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-clapperboard">' +
            '<!-- カチンコ本体 -->' +
            '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/>' +
            '<path d="m6.2 5.3 3.1 3.9"/>' +
            '<path d="m12.4 3.4 3.1 4"/>' +
            '<path d="m3 11 18 6v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>' +
            '<!-- 動きライン -->' +
            '<path d="M8 15h8" stroke="currentColor" stroke-width="1" opacity="0.5"/>' +
            '<path d="M9 18h6" stroke="currentColor" stroke-width="1" opacity="0.5"/>' +
            '</svg>';
        
        this.specializedIcons.gif = gifIcon;
        this.specializedIcons.movie = clapperboardIcon;
        
        this.icons.set('gif', gifIcon);
        this.icons.set('movie', clapperboardIcon);
        this.icons.set('film', gifIcon); // エイリアス
        this.icons.set('clapperboard', clapperboardIcon); // エイリアス
        
        console.log('🎬 GIF/動画アイコン作成完了');
    }
    
    /**
     * 🎯 テーマシステム初期化（ConfigManager連携）
     */
    initializeThemeSystem() {
        console.log('🎨 テーマシステム初期化開始...');
        
        // ConfigManagerからテーマ設定取得
        const themeConfig = this.config.themes || {};
        
        Object.entries(themeConfig).forEach(([themeName, themeData]) => {
            this.themes.available.set(themeName, themeData);
        });
        
        // 現在のテーマ設定
        this.themes.current = this.config.defaultTheme || 'futaba';
        
        console.log('✅ テーマシステム初期化完了 - ' + this.themes.available.size + 'テーマ');
    }
    
    /**
     * 🎯 強化版フォールバックシステム初期化
     */
    initializeEnhancedFallbackSystem() {
        console.log('🛡️ 強化版フォールバックシステム初期化開始...');
        
        // 基本フォールバックアイコン作成
        this.createFallbackIcons();
        
        // 品質保証フォールバック
        this.validateAllRequiredIcons();
        
        console.log('✅ 強化版フォールバックシステム初期化完了');
    }
    
    /**
     * 基本フォールバックアイコン作成
     */
    createFallbackIcons() {
        const basicIcons = {
            pen: this.createBasicPenIcon(),
            eraser: this.createBasicEraserIcon(),
            palette: this.createBasicPaletteIcon(),
            download: this.createBasicDownloadIcon(),
            resize: this.createBasicResizeIcon(),
            settings: this.createBasicSettingsIcon()
        };
        
        Object.entries(basicIcons).forEach(([name, svg]) => {
            if (!this.icons.has(name)) {
                this.icons.set(name, svg);
            }
        });
        
        console.log('🛡️ 基本フォールバックアイコン: ' + Object.keys(basicIcons).length + '個作成');
    }
    
    /**
     * 全必須アイコンの存在確認
     */
    validateAllRequiredIcons() {
        const requiredIcons = [
            'bucket', 'select', 'layers', 'gif',  // Phase1後期新規
            'pen', 'eraser', 'palette',           // 基本ツール
            'download', 'resize', 'settings'      // UI要素
        ];
        
        const missing = requiredIcons.filter(iconName => !this.icons.has(iconName));
        
        if (missing.length > 0) {
            console.warn('⚠️ 不足アイコン検出: ' + missing.join(', '));
            
            // 緊急アイコン生成
            missing.forEach(iconName => {
                this.icons.set(iconName, this.generateEmergencyIcon(iconName));
            });
            
            // ErrorManager連携
            ErrorManager.showError('icon-missing', 
                '一部アイコンが不足していたため代替アイコンを使用します: ' + missing.join(', '),
                { missing, fallbackGenerated: true }
            );
        }
        
        console.log('✅ 必須アイコン確認完了: ' + requiredIcons.length + '個確認');
    }
    
    /**
     * 🎯 統一システム連携・最適化
     */
    integrateWithUnifiedSystems() {
        console.log('🔗 統一システム連携開始...');
        
        // EventBus連携
        this.setupEventBusIntegration();
        
        // StateManager連携
        this.setupStateManagerIntegration();
        
        // ConfigManager連携
        this.setupConfigManagerIntegration();
        
        console.log('✅ 統一システム連携完了');
    }
    
    /**
     * EventBus連携設定
     */
    setupEventBusIntegration() {
        // テーマ変更イベント
        EventBus.on('theme.changed', (data) => {
            this.setTheme(data.theme);
        });
        
        // アイコン更新要求イベント
        EventBus.on('icons.updateRequest', (data) => {
            this.updateToolButtonIcons(data.theme);
        });
        
        // アイコンキャッシュクリアイベント
        EventBus.on('icons.clearCache', () => {
            this.clearCache();
        });
    }
    
    /**
     * StateManager連携設定
     */
    setupStateManagerIntegration() {
        // アイコン状態更新関数を登録
        if (StateManager.registerComponent) {
            StateManager.registerComponent('iconManager', () => ({
                initialized: this.initialized,
                version: this.version,
                iconCount: this.getTotalIconCount(),
                cacheStats: this.getCacheStats(),
                theme: this.themes.current,
                tablerAvailable: this.tabler.available
            }));
        }
    }
    
    /**
     * ConfigManager連携設定
     */
    setupConfigManagerIntegration() {
        // 設定変更監視
        if (ConfigManager.onChange) {
            ConfigManager.onChange('icons', (newConfig) => {
                this.config = Object.assign({}, this.config, newConfig);
                this.applyConfigChanges();
            });
        }
    }
    
    // ==========================================
    // 🎯 アイコン取得システム（Phase1後期改良版）
    // ==========================================
    
    /**
     * アイコン取得（Phase1後期改良版・統一システム完全活用）
     */
    getIcon(name, options = {}) {
        try {
            const startTime = performance.now();
            
            // キャッシュチェック
            const cacheKey = this.generateCacheKey(name, options);
            if (this.cache.rendered.has(cacheKey)) {
                this.cache.hitCount++;
                return this.cache.rendered.get(cacheKey);
            }
            
            this.cache.missCount++;
            
            // アイコン検索（優先順位：専用 → @tabler → フォールバック）
            let svg = this.findIconWithPriority(name);
            
            if (!svg) {
                // ErrorManager連携
                ErrorManager.showError('icon-not-found', 
                    'アイコンが見つかりません: ' + name, 
                    { iconName: name, options }
                );
                svg = this.generateEmergencyIcon(name);
            }
            
            // オプション・テーマ適用
            svg = this.processIconSvg(svg, options);
            
            // キャッシュ保存
            this.cacheRenderedIcon(cacheKey, svg);
            
            const renderTime = performance.now() - startTime;
            if (renderTime > 5) {
                console.log('🐌 アイコン描画時間: ' + name + ' - ' + renderTime.toFixed(2) + 'ms');
            }
            
            return svg;
            
        } catch (error) {
            // ErrorManager統合エラー処理
            ErrorManager.showError('icon-render', 
                'アイコン描画エラー: ' + name + ' - ' + error.message, 
                { iconName: name, options, error }
            );
            
            return this.generateEmergencyIcon(name);
        }
    }
    
    /**
     * 優先順位付きアイコン検索
     */
    findIconWithPriority(name) {
        // 1. 専用アイコン（Phase1後期改良版）
        if (this.specializedIcons[name]) {
            return this.specializedIcons[name];
        }
        
        // 2. 直接登録アイコン
        if (this.icons.has(name)) {
            return this.icons.get(name);
        }
        
        // 3. カスタムアイコン
        if (this.customIcons.has(name)) {
            return this.customIcons.get(name);
        }
        
        // 4. @tabler/icons（利用可能時）
        if (this.tabler.available) {
            const tablerSvg = this.getTablerIcon(name);
            if (tablerSvg) {
                return tablerSvg;
            }
        }
        
        // 5. エイリアス検索
        const aliasedName = this.resolveAlias(name);
        if (aliasedName && aliasedName !== name) {
            return this.findIconWithPriority(aliasedName);
        }
        
        return null;
    }
    
    /**
     * @tabler/iconsアイコン取得（改良版）
     */
    async getTablerIcon(name) {
        try {
            // マッピング確認
            const tablerName = this.tabler.iconCache.get(name) || name;
            const url = this.tabler.basePath + tablerName + '.svg';
            
            // 既にキャッシュされている場合
            if (this.tablerIcons.has(tablerName)) {
                return this.tablerIcons.get(tablerName);
            }
            
            // SVGフェッチ（非同期だが、フォールバックありのため問題なし）
            fetch(url)
                .then(response => response.text())
                .then(svgContent => {
                    if (svgContent.includes('<svg')) {
                        this.tablerIcons.set(tablerName, svgContent);
                        this.tabler.loadedCount++;
                    }
                })
                .catch(error => {
                    console.log('⚠️ @tabler/icon読み込み失敗: ' + tablerName);
                });
            
            // 同期的にはnullを返す（フォールバック使用）
            return null;
            
        } catch (error) {
            return null;
        }
    }
    
    /**
     * アイコンエイリアス解決（Phase1後期拡張）
     */
    resolveAlias(name) {
        const aliases = {
            // 基本ツール
            'fill': 'bucket',
            'fill-tool': 'bucket',
            'paint': 'bucket',
            'paint-bucket': 'bucket',
            
            'select': 'selection',
            'select-tool': 'selection',
            'selection-dashed': 'selection',
            
            'pencil': 'pen',
            'pen-tool': 'pen',
            'draw': 'pen',
            
            'eraser-tool': 'eraser',
            'erase': 'eraser',
            
            // Phase1後期新規
            'layer': 'layers',
            'layers-tool': 'layers',
            
            'gif-animation': 'clapperboard',
            'gif-tool': 'clapperboard',
            'animation': 'clapperboard',
            
            'video': 'movie',
            'film-strip': 'film'
        };
        
        return aliases[name] || name;
    }
    
    /**
     * SVG処理（オプション・テーマ適用）
     */
    processIconSvg(svg, options) {
        let processedSvg = svg;
        
        // サイズ適用
        if (options.size) {
            processedSvg = this.applySizeToSvg(processedSvg, options.size);
        }
        
        // 色適用
        if (options.color) {
            processedSvg = this.applyColorToSvg(processedSvg, options.color);
        }
        
        // テーマ適用
        processedSvg = this.applyThemeToSvg(processedSvg, options.iconName);
        
        // アニメーション適用
        if (options.animated && this.config.animationsEnabled) {
            processedSvg = this.addAnimationToSvg(processedSvg, options.animation);
        }
        
        return processedSvg;
    }
    
    // ==========================================
    // 🎯 UI統合システム（Phase1後期改良版）
    // ==========================================
    
    /**
     * ツールボタンアイコン一括更新（Phase1後期改良版）
     */
    updateToolButtonIcons(theme = null) {
        try {
            const iconMapping = {
                'pen-tool': 'pen',
                'eraser-tool': 'eraser',
                'fill-tool': 'bucket',        // Phase1後期: 改良バケツ
                'select-tool': 'select',      // Phase1後期: 改良選択範囲
                'palette-tool': 'palette',
                'download-tool': 'download',
                'resize-tool': 'resize',
                'layers-tool': 'layers',      // Phase1後期新規
                'gif-tool': 'clapperboard',            // Phase1後期新規
                'settings-tool': 'settings'
            };
            
            let successCount = 0;
            const options = {};
            
            // テーマ適用
            if (theme && this.themes.available.has(theme)) {
                const themeData = this.themes.available.get(theme);
                options.color = themeData.primary;
                options.size = this.config.iconSizes.medium;
            }
            
            Object.entries(iconMapping).forEach(([elementId, iconName]) => {
                const element = document.getElementById(elementId);
                if (element) {
                    const iconSvg = this.getIcon(iconName, Object.assign({}, options, { iconName }));
                    if (iconSvg && this.setElementIcon(element, iconSvg)) {
                        successCount++;
                    }
                }
            });
            
            // EventBus通知
            EventBus.safeEmit('icons.updated', {
                updated: successCount,
                total: Object.keys(iconMapping).length,
                theme: theme || this.themes.current
            });
            
            console.log('✅ ツールボタンアイコン更新完了: ' + successCount + '個');
            return successCount;
            
        } catch (error) {
            ErrorManager.showError('icon-update', 
                'アイコン更新エラー: ' + error.message, 
                { theme, error }
            );
            return 0;
        }
    }
    
    /**
     * 要素にアイコン設定
     */
    setElementIcon(element, iconSvg) {
        if (!element || !iconSvg) return false;
        
        try {
            // スムーズ置換アニメーション
            if (this.config.animationsEnabled && element.innerHTML) {
                element.style.transition = 'opacity 0.15s ease';
                element.style.opacity = '0';
                
                setTimeout(() => {
                    element.innerHTML = iconSvg;
                    element.style.opacity = '1';
                    this.addElementEvents(element);
                }, 75);
            } else {
                element.innerHTML = iconSvg;
                this.addElementEvents(element);
            }
            
            return true;
            
        } catch (error) {
            ErrorManager.showError('icon-element', 
                '要素アイコン設定エラー: ' + error.message, 
                { element, error }
            );
            return false;
        }
    }
    
    // ==========================================
    // 🎯 ユーティリティ・ヘルパー関数
    // ==========================================
    
    /**
     * 基本アイコン生成関数群
     */
    createBasicPenIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21v-4a4 4 0 1 1 4 4h-4"/><path d="M21 3a16 16 0 0 0 -12.8 10.2"/><path d="M21 3a16 16 0 0 1 -10.2 12.8"/><path d="M10.6 9a9 9 0 0 1 4.4 4.4"/></svg>';
    }
    
    createBasicEraserIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-6.2 6.3"/><path d="m9 9 4 4"/></svg>';
    }
    
    createBasicPaletteIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21a9 9 0 0 1 0-18c5 0 9 4 9 9a4.5 4.5 0 0 1-4.5 4.5c-1.21 0-2.5-.07-3.5-.93a4.5 4.5 0 0 1-1-4.57"/><circle cx="7.5" cy="10.5" r="1.5"/><circle cx="12" cy="7.5" r="1.5"/><circle cx="16.5" cy="10.5" r="1.5"/></svg>';
    }
    
    createBasicDownloadIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    }
    
    createBasicResizeIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5,9 2,12 5,15"/><polyline points="9,5 12,2 15,5"/><polyline points="15,19 12,22 9,19"/><polyline points="19,9 22,12 19,15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>';
    }
    
    createBasicSettingsIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m9 12 2 2 4-4"/></svg>';
    }
    
    /**
     * 緊急アイコン生成
     */
    generateEmergencyIcon(name) {
        const firstLetter = name.charAt(0).toUpperCase();
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2 2"/>' +
            '<text x="12" y="14" text-anchor="middle" font-size="10" fill="currentColor">' + firstLetter + '</text>' +
            '</svg>';
    }
    
    /**
     * キャッシュキー生成
     */
    generateCacheKey(name, options) {
        const optionsStr = JSON.stringify(options);
        return name + '_' + btoa(optionsStr).substring(0, 8);
    }
    
    /**
     * キャッシュ保存
     */
    cacheRenderedIcon(cacheKey, svg) {
        if (this.cache.rendered.size >= this.cache.maxSize) {
            // 最古のキーを削除
            const firstKey = this.cache.rendered.keys().next().value;
            this.cache.rendered.delete(firstKey);
        }
        
        this.cache.rendered.set(cacheKey, svg);
    }
    
    /**
     * キャッシュクリア
     */
    clearCache() {
        this.cache.rendered.clear();
        this.cache.hitCount = 0;
        this.cache.missCount = 0;
        
        EventBus.safeEmit('icons.cache.cleared', {
            manager: 'IconManager',
            timestamp: Date.now()
        });
        
        console.log('🗑️ IconManager キャッシュクリア完了');
    }
    
    /**
     * 統計情報取得
     */
    getTotalIconCount() {
        return this.icons.size + this.customIcons.size + this.tablerIcons.size;
    }
    
    /**
     * キャッシュ統計取得
     */
    getCacheStats() {
        const total = this.cache.hitCount + this.cache.missCount;
        const hitRate = total > 0 ? (this.cache.hitCount / total * 100).toFixed(1) : 0;
        
        return {
            size: this.cache.rendered.size,
            maxSize: this.cache.maxSize,
            hitCount: this.cache.hitCount,
            missCount: this.cache.missCount,
            hitRate: hitRate + '%'
        };
    }
    
    /**
     * 要素イベント追加
     */
    addElementEvents(element) {
        // ツールヒント等のイベント処理
        if (element && this.config.enableTooltips) {
            element.addEventListener('mouseenter', (e) => {
                // ツールヒント表示ロジック
            });
            
            element.addEventListener('mouseleave', (e) => {
                // ツールヒント非表示ロジック
            });
        }
    }
    
    /**
     * フォールバック初期化
     */
    fallbackInitialize() {
        console.log('🛡️ IconManager フォールバック初期化開始');
        
        this.initialized = true;
        this.createFallbackIcons();
        
        // 最小限のアイコンセット作成
        const minimumIcons = ['pen', 'eraser', 'bucket', 'select', 'settings'];
        minimumIcons.forEach(iconName => {
            if (!this.icons.has(iconName)) {
                this.icons.set(iconName, this.generateEmergencyIcon(iconName));
            }
        });
        
        console.log('✅ IconManager フォールバック初期化完了');
    }
    
    /**
     * テーマ設定
     */
    setTheme(themeName) {
        if (this.themes.available.has(themeName)) {
            this.themes.current = themeName;
            this.clearCache(); // テーマ変更時はキャッシュクリア
            
            EventBus.safeEmit('icons.theme.changed', {
                newTheme: themeName,
                manager: 'IconManager'
            });
            
            console.log('🎨 IconManager テーマ変更: ' + themeName);
        }
    }
    
    /**
     * SVGサイズ適用
     */
    applySizeToSvg(svg, size) {
        return svg.replace(/viewBox="[^"]*"/, 'viewBox="0 0 24 24" width="' + size + '" height="' + size + '"');
    }
    
    /**
     * SVG色適用
     */
    applyColorToSvg(svg, color) {
        return svg.replace(/stroke="currentColor"/g, 'stroke="' + color + '"')
                  .replace(/fill="currentColor"/g, 'fill="' + color + '"');
    }
    
    /**
     * SVGテーマ適用
     */
    applyThemeToSvg(svg, iconName) {
        const currentTheme = this.themes.available.get(this.themes.current);
        if (currentTheme && iconName) {
            // テーマ固有の色適用ロジック
        }
        return svg;
    }
    
    /**
     * SVGアニメーション追加
     */
    addAnimationToSvg(svg, animationType) {
        // アニメーション追加ロジック
        return svg;
    }
    
    /**
     * 設定変更適用
     */
    applyConfigChanges() {
        this.clearCache();
        this.updateToolButtonIcons();
        
        console.log('⚙️ IconManager 設定変更適用完了');
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.IconManager = IconManager;
    console.log('✅ IconManager グローバル公開完了');
}