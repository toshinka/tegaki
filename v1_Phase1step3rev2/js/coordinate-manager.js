/**
 * 🎯 CoordinateManager - 座標変換システム専用マネージャー
 * 🎨 ふたば☆お絵描きツール - キャンバス座標変換システム
 * 
 * 🎯 責任範囲:
 * - グローバル座標 ⇔ キャンバス座標変換
 * - キャンバス座標 ⇔ PixiJS座標変換
 * - 座標変換キャッシュシステム
 * - DPI・デバイス座標対応
 * - 変換精度管理
 * 
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager完全活用
 * 🎯 SOLID: 単一責任原則（座標変換のみ）・依存性逆転（統一システム経由）
 * ⚠⚠⚠ ESM禁止: import/export使用禁止・Pure JavaScript維持 ⚠⚠⚠
 */

/**
 * CoordinateManager - キャンバス座標変換システム
 */
class CoordinateManager {
    constructor(appCore) {
        if (!appCore) {
            throw new Error('CoordinateManager: AppCore依存関係が必要です');
        }
        
        this.appCore = appCore;
        this.isInitialized = false;
        
        // 座標設定（ConfigManager経由）
        this.config = this.loadCoordinateConfig();
        
        // 変換キャッシュシステム
        this.transformCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.maxCacheSize = this.config.cacheSize || 1000;
        
        // DPI・デバイス座標
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.canvasScale = { x: 1, y: 1 };
        
        // 座標統計
        this.stats = {
            transformations: 0,
            cacheHitRatio: 0,
            lastTransformTime: 0,
            averageTransformTime: 0,
            transformTimes: []
        };
        
        console.log('📍 CoordinateManager: 構築完了');
    }

    /**
     * 座標設定読み込み（ConfigManager統一）
     */
    loadCoordinateConfig() {
        if (window.ConfigManager) {
            // ConfigManager経由で設定取得
            const config = {
                enabled: window.ConfigManager.get('canvas.coordinates.enabled') ?? true,
                cacheSize: window.ConfigManager.get('canvas.coordinates.cacheSize') ?? 1000,
                precision: window.ConfigManager.get('canvas.coordinates.precision') ?? 2,
                dpiAware: window.ConfigManager.get('canvas.coordinates.dpiAware') ?? true,
                debugging: window.ConfigManager.get('canvas.coordinates.debugging') ?? false,
                performanceMode: window.ConfigManager.get('canvas.coordinates.performanceMode') || 'balanced',
                autoOptimize: window.ConfigManager.get('canvas.coordinates.autoOptimize') ?? true
            };
            
            // デフォルト設定確保
            if (!window.ConfigManager.get('canvas.coordinates')) {
                window.ConfigManager.set('canvas.coordinates', config);
            }
            
            return config;
        } else {
            // フォールバック設定
            console.warn('⚠️ ConfigManager未利用 - デフォルト座標設定使用');
            return {
                enabled: true,
                cacheSize: 1000,
                precision: 2,
                dpiAware: true,
                debugging: false,
                performanceMode: 'balanced',
                autoOptimize: true
            };
        }
    }

    /**
     * CoordinateManager初期化
     */
    initialize() {
        try {
            console.log('📍 CoordinateManager: 初期化開始...');
            
            if (!this.config.enabled) {
                console.log('⚠️ CoordinateManager: 無効化設定のためスキップ');
                return false;
            }
            
            // 座標変換システム初期化
            this.initializeCoordinateSystem();
            
            // キャッシュシステム初期化
            this.initializeCacheSystem();
            
            // EventBus統合
            this.initializeEventBusIntegration();
            
            // 統計システム初期化
            this.initializeStatsSystem();
            
            // DPI・デバイス対応
            if (this.config.dpiAware) {
                this.initializeDPISystem();
            }
            
            this.isInitialized = true;
            
            console.log('✅ CoordinateManager: 初期化完了');
            
            // EventBus完了通知
            this.safeEmitEvent('coordinate.manager.initialized', {
                config: this.config,
                dpiAware: this.config.dpiAware,
                devicePixelRatio: this.devicePixelRatio,
                timestamp: Date.now()
            });
            
            // StateManager状態更新
            this.safeUpdateState('coordinate.manager', {
                initialized: true,
                enabled: this.config.enabled,
                cacheSize: this.maxCacheSize,
                precision: this.config.precision
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ CoordinateManager初期化エラー:', error);
            
            this.safeShowError('coordinate-manager-init', 
                'CoordinateManager初期化エラー: ' + error.message,
                { config: this.config }
            );
            
            return false;
        }
    }

    /**
     * 座標変換システム初期化
     */
    initializeCoordinateSystem() {
        console.log('📐 座標変換システム初期化...');
        
        // 基本変換マトリクス設定
        this.setupTransformMatrix();
        
        // 座標精度設定
        this.precision = Math.pow(10, this.config.precision);
        
        console.log('✅ 座標変換システム設定完了');
    }

    /**
     * 変換マトリクス設定
     */
    setupTransformMatrix() {
        // AppCoreから基本情報取得
        if (this.appCore && this.appCore.app) {
            const canvas = this.appCore.getCanvas();
            
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                this.canvasRect = {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                };
                
                // スケール計算
                this.canvasScale = {
                    x: this.appCore.width / rect.width,
                    y: this.appCore.height / rect.height
                };
                
                console.log('📏 変換マトリクス設定:', {
                    canvasRect: this.canvasRect,
                    canvasScale: this.canvasScale,
                    devicePixelRatio: this.devicePixelRatio
                });
            }
        }
    }

    /**
     * キャッシュシステム初期化
     */
    initializeCacheSystem() {
        console.log('🗄️ キャッシュシステム初期化...');
        
        // キャッシュクリア
        this.transformCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // 自動最適化設定
        if (this.config.autoOptimize) {
            this.setupCacheOptimization();
        }
        
        console.log('✅ キャッシュシステム設定完了');
    }

    /**
     * キャッシュ最適化設定
     */
    setupCacheOptimization() {
        // 定期的なキャッシュクリーンアップ
        this.cacheCleanupInterval = setInterval(() => {
            this.optimizeCache();
        }, 30000); // 30秒間隔
        
        // キャッシュサイズ監視
        this.cacheSizeCheckInterval = setInterval(() => {
            if (this.transformCache.size > this.maxCacheSize * 1.2) {
                this.clearOldCache();
            }
        }, 5000); // 5秒間隔
    }

    /**
     * EventBus統合初期化
     */
    initializeEventBusIntegration() {
        if (!window.EventBus) {
            console.warn('⚠️ EventBus統合スキップ: EventBus未利用');
            return false;
        }
        
        try {
            // 座標関連イベント監視
            window.EventBus.on('canvas.coordinate.request', this.handleCoordinateRequest.bind(this));
            window.EventBus.on('coordinate.debug.toggle', this.handleDebugToggle.bind(this));
            window.EventBus.on('coordinate.cache.clear', this.handleCacheClear.bind(this));
            window.EventBus.on('coordinate.stats.request', this.handleStatsRequest.bind(this));
            
            console.log('✅ EventBus座標統合完了');
            return true;
            
        } catch (error) {
            console.error('❌ EventBus座標統合エラー:', error);
            return false;
        }
    }

    /**
     * 統計システム初期化
     */
    initializeStatsSystem() {
        // 統計リセット
        this.stats = {
            transformations: 0,
            cacheHitRatio: 0,
            lastTransformTime: 0,
            averageTransformTime: 0,
            transformTimes: [],
            startTime: Date.now()
        };
        
        console.log('📊 座標統計システム初期化完了');
    }

    /**
     * DPIシステム初期化
     */
    initializeDPISystem() {
        console.log('📱 DPIシステム初期化...');
        
        // デバイスPixelRatio監視
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // DPI変更監視
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia(`(resolution: ${this.devicePixelRatio}dppx)`);
            mediaQuery.addEventListener('change', () => {
                this.handleDPIChange();
            });
        }
        
        console.log('✅ DPIシステム設定完了: ' + this.devicePixelRatio + 'x');
    }

    // ==========================================
    // 🎯 座標変換メインシステム
    // ==========================================

    /**
     * グローバル座標 → キャンバス座標変換
     */
    globalToCanvas(globalX, globalY) {
        const startTime = performance.now();
        
        try {
            // キャッシュチェック
            const cacheKey = `g2c_${globalX}_${globalY}`;
            if (this.transformCache.has(cacheKey)) {
                this.cacheHits++;
                this.updateCacheHitRatio();
                return this.transformCache.get(cacheKey);
            }
            
            this.cacheMisses++;
            
            // 変換実行
            const canvas = this.appCore.getCanvas();
            if (!canvas) {
                return { x: globalX, y: globalY };
            }
            
            const rect = canvas.getBoundingClientRect();
            
            let canvasX = globalX - rect.left;
            let canvasY = globalY - rect.top;
            
            // DPI補正
            if (this.config.dpiAware && this.devicePixelRatio !== 1) {
                canvasX *= this.devicePixelRatio;
                canvasY *= this.devicePixelRatio;
            }
            
            // 精度調整
            const result = {
                x: Math.round(canvasX * this.precision) / this.precision,
                y: Math.round(canvasY * this.precision) / this.precision
            };
            
            // キャッシュ保存
            this.setCacheValue(cacheKey, result);
            
            // 統計更新
            this.updateTransformStats(startTime);
            
            if (this.config.debugging) {
                console.log('📍 グローバル→キャンバス変換:', {
                    input: { x: globalX, y: globalY },
                    output: result,
                    rect: rect,
                    time: (performance.now() - startTime).toFixed(2) + 'ms'
                });
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ グローバル→キャンバス変換エラー:', error);
            this.safeShowError('coordinate-global-canvas', 
                'グローバル→キャンバス変換エラー: ' + error.message,
                { globalX, globalY }
            );
            
            return { x: globalX, y: globalY };
        }
    }

    /**
     * キャンバス座標 → PixiJS座標変換
     */
    canvasToPixi(canvasX, canvasY) {
        const startTime = performance.now();
        
        try {
            // キャッシュチェック
            const cacheKey = `c2p_${canvasX}_${canvasY}`;
            if (this.transformCache.has(cacheKey)) {
                this.cacheHits++;
                this.updateCacheHitRatio();
                return this.transformCache.get(cacheKey);
            }
            
            this.cacheMisses++;
            
            // 基本変換（現在は1:1マッピング）
            let pixiX = canvasX;
            let pixiY = canvasY;
            
            // スケール適用
            if (this.canvasScale.x !== 1 || this.canvasScale.y !== 1) {
                pixiX *= this.canvasScale.x;
                pixiY *= this.canvasScale.y;
            }
            
            // 精度調整
            const result = {
                x: Math.round(pixiX * this.precision) / this.precision,
                y: Math.round(pixiY * this.precision) / this.precision
            };
            
            // キャッシュ保存
            this.setCacheValue(cacheKey, result);
            
            // 統計更新
            this.updateTransformStats(startTime);
            
            if (this.config.debugging) {
                console.log('📍 キャンバス→PixiJS変換:', {
                    input: { x: canvasX, y: canvasY },
                    output: result,
                    scale: this.canvasScale,
                    time: (performance.now() - startTime).toFixed(2) + 'ms'
                });
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ キャンバス→PixiJS変換エラー:', error);
            this.safeShowError('coordinate-canvas-pixi', 
                'キャンバス→PixiJS変換エラー: ' + error.message,
                { canvasX, canvasY }
            );
            
            return { x: canvasX, y: canvasY };
        }
    }

    /**
     * PixiJS座標 → キャンバス座標変換
     */
    pixiToCanvas(pixiX, pixiY) {
        const startTime = performance.now();
        
        try {
            // キャッシュチェック
            const cacheKey = `p2c_${pixiX}_${pixiY}`;
            if (this.transformCache.has(cacheKey)) {
                this.cacheHits++;
                this.updateCacheHitRatio();
                return this.transformCache.get(cacheKey);
            }
            
            this.cacheMisses++;
            
            // 逆変換実行
            let canvasX = pixiX;
            let canvasY = pixiY;
            
            // スケール逆適用
            if (this.canvasScale.x !== 1 || this.canvasScale.y !== 1) {
                canvasX /= this.canvasScale.x;
                canvasY /= this.canvasScale.y;
            }
            
            // 精度調整
            const result = {
                x: Math.round(canvasX * this.precision) / this.precision,
                y: Math.round(canvasY * this.precision) / this.precision
            };
            
            // キャッシュ保存
            this.setCacheValue(cacheKey, result);
            
            // 統計更新
            this.updateTransformStats(startTime);
            
            return result;
            
        } catch (error) {
            console.error('❌ PixiJS→キャンバス変換エラー:', error);
            return { x: pixiX, y: pixiY };
        }
    }

    /**
     * グローバル座標 → PixiJS座標変換（統合）
     */
    globalToPixi(globalX, globalY) {
        try {
            // 2段階変換
            const canvasCoord = this.globalToCanvas(globalX, globalY);
            const pixiCoord = this.canvasToPixi(canvasCoord.x, canvasCoord.y);
            
            return pixiCoord;
            
        } catch (error) {
            console.error('❌ グローバル→PixiJS変換エラー:', error);
            return { x: globalX, y: globalY };
        }
    }

    /**
     * PixiJS座標 → グローバル座標変換（統合）
     */
    pixiToGlobal(pixiX, pixiY) {
        try {
            // 2段階逆変換
            const canvasCoord = this.pixiToCanvas(pixiX, pixiY);
            const globalCoord = this.canvasToGlobal(canvasCoord.x, canvasCoord.y);
            
            return globalCoord;
            
        } catch (error) {
            console.error('❌ PixiJS→グローバル変換エラー:', error);
            return { x: pixiX, y: pixiY };
        }
    }

    /**
     * キャンバス座標 → グローバル座標変換
     */
    canvasToGlobal(canvasX, canvasY) {
        try {
            const canvas = this.appCore.getCanvas();
            if (!canvas) {
                return { x: canvasX, y: canvasY };
            }
            
            const rect = canvas.getBoundingClientRect();
            
            let globalX = canvasX + rect.left;
            let globalY = canvasY + rect.top;
            
            // DPI補正（逆）
            if (this.config.dpiAware && this.devicePixelRatio !== 1) {
                globalX /= this.devicePixelRatio;
                globalY /= this.devicePixelRatio;
            }
            
            return {
                x: Math.round(globalX * this.precision) / this.precision,
                y: Math.round(globalY * this.precision) / this.precision
            };
            
        } catch (error) {
            console.error('❌ キャンバス→グローバル変換エラー:', error);
            return { x: canvasX, y: canvasY };
        }
    }

    // ==========================================
    // 🎯 キャッシュ管理システム
    // ==========================================

    /**
     * キャッシュ値設定
     */
    setCacheValue(key, value) {
        // キャッシュサイズ制限
        if (this.transformCache.size >= this.maxCacheSize) {
            this.clearOldCache();
        }
        
        this.transformCache.set(key, value);
    }

    /**
     * 古いキャッシュクリア
     */
    clearOldCache() {
        const entries = Array.from(this.transformCache.entries());
        const removeCount = Math.floor(this.maxCacheSize * 0.2); // 20%削除
        
        // 古い順に削除
        for (let i = 0; i < removeCount && entries.length > 0; i++) {
            this.transformCache.delete(entries[i][0]);
        }
        
        if (this.config.debugging) {
            console.log('🗑️ 古いキャッシュクリア:', removeCount + '件削除');
        }
    }

    /**
     * キャッシュ最適化
     */
    optimizeCache() {
        const hitRatio = this.cacheHits / (this.cacheHits + this.cacheMisses);
        
        // ヒット率が低い場合はキャッシュをクリア
        if (hitRatio < 0.3 && this.transformCache.size > 100) {
            this.clearCache();
            console.log('🔄 キャッシュ最適化: 低ヒット率によりクリア');
        }
        
        // 統計更新
        this.updateCacheHitRatio();
    }

    /**
     * キャッシュヒット率更新
     */
    updateCacheHitRatio() {
        const total = this.cacheHits + this.cacheMisses;
        if (total > 0) {
            this.stats.cacheHitRatio = this.cacheHits / total;
        }
    }

    /**
     * キャッシュクリア
     */
    clearCache() {
        this.transformCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.stats.cacheHitRatio = 0;
        
        console.log('🗑️ 座標変換キャッシュクリア完了');
        
        this.safeEmitEvent('coordinate.cache.cleared', {
            timestamp: Date.now()
        });
    }

    // ==========================================
    // 🎯 統計・パフォーマンス管理
    // ==========================================

    /**
     * 変換統計更新
     */
    updateTransformStats(startTime) {
        const transformTime = performance.now() - startTime;
        
        this.stats.transformations++;
        this.stats.lastTransformTime = transformTime;
        this.stats.transformTimes.push(transformTime);
        
        // 平均計算（最新100件）
        if (this.stats.transformTimes.length > 100) {
            this.stats.transformTimes = this.stats.transformTimes.slice(-100);
        }
        
        const sum = this.stats.transformTimes.reduce((a, b) => a + b, 0);
        this.stats.averageTransformTime = sum / this.stats.transformTimes.length;
    }

    /**
     * リサイズ処理
     */
    handleResize(newWidth, newHeight) {
        try {
            console.log('📏 CoordinateManager: リサイズ対応', newWidth + 'x' + newHeight);
            
            // 変換マトリクス再計算
            this.setupTransformMatrix();
            
            // キャッシュクリア（座標系変更のため）
            this.clearCache();
            
            // StateManager状態更新
            this.safeUpdateState('coordinate.dimensions', {
                width: newWidth,
                height: newHeight,
                canvasScale: this.canvasScale,
                lastUpdate: Date.now()
            });
            
            console.log('✅ CoordinateManager: リサイズ完了');
            
        } catch (error) {
            console.error('❌ CoordinateManagerリサイズエラー:', error);
        }
    }

    /**
     * DPI変更処理
     */
    handleDPIChange() {
        const newDPI = window.devicePixelRatio || 1;
        
        if (newDPI !== this.devicePixelRatio) {
            console.log('📱 DPI変更検出:', this.devicePixelRatio + 'x → ' + newDPI + 'x');
            
            this.devicePixelRatio = newDPI;
            this.clearCache(); // DPI変更により座標系が変わるためキャッシュクリア
            
            this.safeEmitEvent('coordinate.dpi.changed', {
                oldDPI: this.devicePixelRatio,
                newDPI: newDPI,
                timestamp: Date.now()
            });
        }
    }

    // ==========================================
    // 🎯 EventBusイベントハンドラー
    // ==========================================

    /**
     * 座標リクエストハンドラー
     */
    handleCoordinateRequest(data) {
        try {
            if (data.action === 'getStats') {
                this.safeEmitEvent('coordinate.stats.response', this.getStats());
            } else if (data.action === 'clearCache') {
                this.clearCache();
            } else if (data.action === 'transform' && data.from && data.to) {
                const result = this.performTransform(data.from, data.to, data.x, data.y);
                this.safeEmitEvent('coordinate.transform.response', {
                    requestId: data.requestId,
                    result: result
                });
            }
        } catch (error) {
            console.error('❌ 座標リクエスト処理エラー:', error);
        }
    }

    /**
     * 座標変換実行
     */
    performTransform(from, to, x, y) {
        const transformKey = from + '2' + to;
        
        switch (transformKey) {
            case 'global2canvas':
                return this.globalToCanvas(x, y);
            case 'canvas2pixi':
                return this.canvasToPixi(x, y);
            case 'pixi2canvas':
                return this.pixiToCanvas(x, y);
            case 'canvas2global':
                return this.canvasToGlobal(x, y);
            case 'global2pixi':
                return this.globalToPixi(x, y);
            case 'pixi2global':
                return this.pixiToGlobal(x, y);
            default:
                throw new Error('未対応の変換: ' + transformKey);
        }
    }

    /**
     * デバッグ切り替えハンドラー
     */
    handleDebugToggle(data) {
        this.config.debugging = !this.config.debugging;
        
        console.log('🔍 CoordinateManager デバッグモード:', this.config.debugging ? '有効' : '無効');
        
        this.safeEmitEvent('coordinate.debug.toggled', {
            debugging: this.config.debugging,
            timestamp: Date.now()
        });
    }

    /**
     * キャッシュクリアハンドラー
     */
    handleCacheClear(data) {
        this.clearCache();
        
        this.safeEmitEvent('coordinate.cache.cleared', {
            requestId: data.requestId,
            timestamp: Date.now()
        });
    }

    /**
     * 統計リクエストハンドラー
     */
    handleStatsRequest(data) {
        const stats = this.getStats();
        
        this.safeEmitEvent('coordinate.stats.response', {
            requestId: data.requestId,
            stats: stats,
            timestamp: Date.now()
        });
    }

    // ==========================================
    // 🎯 診断・統計システム
    // ==========================================

    /**
     * CoordinateManager診断実行
     */
    diagnose() {
        console.group('🔍 CoordinateManager診断実行');
        
        const diagnosis = {
            system: {
                initialized: this.isInitialized,
                enabled: this.config.enabled,
                precision: this.config.precision,
                dpiAware: this.config.dpiAware
            },
            cache: {
                size: this.transformCache.size,
                maxSize: this.maxCacheSize,
                hitRatio: this.stats.cacheHitRatio,
                hits: this.cacheHits,
                misses: this.cacheMisses
            },
            performance: this.getStats(),
            coordinate: {
                devicePixelRatio: this.devicePixelRatio,
                canvasScale: this.canvasScale,
                canvasRect: this.canvasRect
            },
            config: this.config,
            appCore: {
                available: !!this.appCore,
                pixiApp: !!this.appCore?.app,
                canvas: !!this.appCore?.getCanvas()
            },
            unifiedSystems: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus,
                stateManager: !!window.StateManager
            }
        };
        
        console.log('📊 CoordinateManager診断結果:', diagnosis);
        
        // 問題検出
        const issues = [];
        
        if (!diagnosis.system.initialized) {
            issues.push('CoordinateManagerが初期化されていません');
        }
        
        if (!diagnosis.system.enabled) {
            issues.push('座標システムが無効化されています');
        }
        
        if (!diagnosis.appCore.available) {
            issues.push('AppCore依存関係が利用できません');
        }
        
        if (diagnosis.cache.hitRatio < 0.5 && diagnosis.cache.size > 100) {
            issues.push('キャッシュヒット率が低下しています');
        }
        
        if (!diagnosis.unifiedSystems.eventBus) {
            issues.push('EventBus統合が不完全です');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ CoordinateManager正常動作中');
        }
        
        console.groupEnd();
        
        return diagnosis;
    }

    /**
     * CoordinateManager統計取得
     */
    getStats() {
        const runtime = Date.now() - (this.stats.startTime || Date.now());
        
        return {
            runtime: {
                uptime: runtime,
                initialized: this.isInitialized,
                enabled: this.config.enabled
            },
            performance: {
                transformations: this.stats.transformations,
                averageTransformTime: Math.round(this.stats.averageTransformTime * 1000) / 1000,
                lastTransformTime: Math.round(this.stats.lastTransformTime * 1000) / 1000,
                transformSamples: this.stats.transformTimes.length
            },
            cache: {
                size: this.transformCache.size,
                maxSize: this.maxCacheSize,
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hitRatio: Math.round(this.stats.cacheHitRatio * 1000) / 10 // パーセンテージ
            },
            coordinate: {
                devicePixelRatio: this.devicePixelRatio,
                precision: this.config.precision,
                canvasScale: this.canvasScale,
                dpiAware: this.config.dpiAware
            },
            config: {
                debugging: this.config.debugging,
                performanceMode: this.config.performanceMode,
                autoOptimize: this.config.autoOptimize
            }
        };
    }

    /**
     * 統計リセット
     */
    resetStats() {
        this.stats = {
            transformations: 0,
            cacheHitRatio: 0,
            lastTransformTime: 0,
            averageTransformTime: 0,
            transformTimes: [],
            startTime: Date.now()
        };
        
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        console.log('📊 CoordinateManager統計リセット完了');
        
        this.safeEmitEvent('coordinate.stats.reset', {
            timestamp: Date.now()
        });
    }

    /**
     * デバッグモード切り替え
     */
    toggleDebug() {
        this.config.debugging = !this.config.debugging;
        
        if (window.ConfigManager) {
            window.ConfigManager.set('canvas.coordinates.debugging', this.config.debugging);
        }
        
        console.log('🔍 CoordinateManagerデバッグモード:', this.config.debugging ? '有効' : '無効');
        
        return this.config.debugging;
    }

    /**
     * 精度テスト実行
     */
    testAccuracy() {
        console.group('🎯 CoordinateManager精度テスト');
        
        const testPoints = [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
            { x: 400, y: 300 },
            { x: 800, y: 600 }
        ];
        
        const results = [];
        
        for (const point of testPoints) {
            try {
                // 往復変換テスト
                const canvas = this.globalToCanvas(point.x, point.y);
                const pixi = this.canvasToPixi(canvas.x, canvas.y);
                const backCanvas = this.pixiToCanvas(pixi.x, pixi.y);
                const backGlobal = this.canvasToGlobal(backCanvas.x, backCanvas.y);
                
                const error = {
                    x: Math.abs(point.x - backGlobal.x),
                    y: Math.abs(point.y - backGlobal.y)
                };
                
                results.push({
                    input: point,
                    output: backGlobal,
                    error: error,
                    accurate: error.x < 1 && error.y < 1
                });
                
                console.log('📍 テストポイント:', point, '→', backGlobal, 'エラー:', error);
                
            } catch (error) {
                console.error('❌ 精度テストエラー:', error);
                results.push({
                    input: point,
                    error: error.message,
                    accurate: false
                });
            }
        }
        
        const accurateCount = results.filter(r => r.accurate).length;
        const accuracy = (accurateCount / results.length) * 100;
        
        console.log('📊 精度テスト結果:', accuracy + '% (' + accurateCount + '/' + results.length + ')');
        console.groupEnd();
        
        return {
            accuracy: accuracy,
            results: results,
            passed: accuracy >= 95
        };
    }

    /**
     * 初期化状態確認
     */
    isReady() {
        return this.isInitialized && this.config.enabled && !!this.appCore;
    }

    // ==========================================
    // 🎯 統一システム安全呼び出しヘルパー
    // ==========================================

    /**
     * EventBus安全emit
     */
    safeEmitEvent(eventName, data) {
        try {
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit(eventName, data);
            }
        } catch (error) {
            console.warn('⚠️ EventBus emit失敗: ' + eventName, error);
        }
    }

    /**
     * ErrorManager安全エラー表示
     */
    safeShowError(type, message, data) {
        try {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError(type, message, data);
            } else {
                console.error('❌ ' + type + ': ' + message, data);
            }
        } catch (error) {
            console.error('❌ ' + type + ': ' + message, data, error);
        }
    }

    /**
     * StateManager安全状態更新
     */
    safeUpdateState(key, value) {
        try {
            if (window.StateManager && typeof window.StateManager.updateState === 'function') {
                window.StateManager.updateState(key, value);
            }
        } catch (error) {
            console.warn('⚠️ StateManager更新失敗: ' + key, error);
        }
    }

    /**
     * CoordinateManager破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ CoordinateManager: 破棄処理開始...');
            
            // インターバルクリア
            if (this.cacheCleanupInterval) {
                clearInterval(this.cacheCleanupInterval);
                this.cacheCleanupInterval = null;
            }
            
            if (this.cacheSizeCheckInterval) {
                clearInterval(this.cacheSizeCheckInterval);
                this.cacheSizeCheckInterval = null;
            }
            
            // EventBusリスナー削除
            if (window.EventBus) {
                window.EventBus.off('canvas.coordinate.request', this.handleCoordinateRequest);
                window.EventBus.off('coordinate.debug.toggle', this.handleDebugToggle);
                window.EventBus.off('coordinate.cache.clear', this.handleCacheClear);
                window.EventBus.off('coordinate.stats.request', this.handleStatsRequest);
            }
            
            // キャッシュクリア
            this.transformCache.clear();
            
            // 状態クリア
            this.isInitialized = false;
            this.cacheHits = 0;
            this.cacheMisses = 0;
            
            console.log('✅ CoordinateManager: 破棄処理完了');
            
        } catch (error) {
            console.error('❌ CoordinateManager破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 グローバル診断・テストコマンド
// ==========================================

/**
 * CoordinateManager診断コマンド
 */
if (typeof window !== 'undefined') {
    window.diagnoseCoordinateManager = function() {
        const coordinateManager = window.coordinateManager || 
                                 window.futabaDrawingTool?.appCore?.coordinateManager ||
                                 window.appCore?.coordinateManager;
        
        if (!coordinateManager || typeof coordinateManager.diagnose !== 'function') {
            return {
                error: 'CoordinateManagerが利用できません',
                coordinateManager: !!coordinateManager,
                diagnoseMethod: !!coordinateManager?.diagnose
            };
        }
        
        return coordinateManager.diagnose();
    };

    /**
     * CoordinateManager統計取得コマンド
     */
    window.getCoordinateManagerStats = function() {
        const coordinateManager = window.coordinateManager || 
                                 window.futabaDrawingTool?.appCore?.coordinateManager ||
                                 window.appCore?.coordinateManager;
        
        if (!coordinateManager || typeof coordinateManager.getStats !== 'function') {
            return { error: 'CoordinateManager統計が利用できません' };
        }
        
        return coordinateManager.getStats();
    };

    /**
     * CoordinateManager精度テストコマンド
     */
    window.testCoordinateAccuracy = function() {
        const coordinateManager = window.coordinateManager || 
                                 window.futabaDrawingTool?.appCore?.coordinateManager ||
                                 window.appCore?.coordinateManager;
        
        if (!coordinateManager || typeof coordinateManager.testAccuracy !== 'function') {
            return { error: 'CoordinateManager精度テストが利用できません' };
        }
        
        return coordinateManager.testAccuracy();
    };

    /**
     * CoordinateManagerデバッグ切り替えコマンド
     */
    window.toggleCoordinateManagerDebug = function() {
        const coordinateManager = window.coordinateManager || 
                                 window.futabaDrawingTool?.appCore?.coordinateManager ||
                                 window.appCore?.coordinateManager;
        
        if (!coordinateManager || typeof coordinateManager.toggleDebug !== 'function') {
            return { error: 'CoordinateManagerが利用できません' };
        }
        
        const debugging = coordinateManager.toggleDebug();
        
        return {
            debugging: debugging,
            message: 'CoordinateManagerデバッグモード: ' + (debugging ? '有効' : '無効')
        };
    };
}

console.log('🎯 CoordinateManager座標変換システム専用実装完了');
console.log('✅ 実装項目:');
console.log('  - グローバル⇔キャンバス⇔PixiJS座標変換システム');
console.log('  - 座標変換キャッシュシステム');
console.log('  - DPI・デバイス座標対応');
console.log('  - 座標変換精度管理・統計システム');
console.log('  - EventBus完全統合・座標イベント通知');
console.log('  - 統一システム完全活用（ConfigManager・ErrorManager・StateManager）');
console.log('  - DRY・SOLID原則完全準拠');
console.log('  - 診断・統計・テストコマンド: window.diagnoseCoordinateManager等');