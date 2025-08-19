* 🎯 CoordinateManager - 座標変換システム専用マネージャー
 * 🎨 ふたば☆お絵描きツール - 座標変換・スケーリングシステム
 * 
 * 🎯 責任範囲:
 * - キャンバス⇔PixiJS座標変換
 * - グローバル⇔ローカル座標変換
 * - スケーリング・オフセット対応
 * - 座標変換キャッシュシステム
 * - 高精度座標計算
 * 
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager完全活用
 * 🎯 SOLID: 単一責任原則（座標変換のみ）・依存性逆転（統一システム経由）
 * ⚠⚠⚠ ESM禁止: import/export使用禁止・Pure JavaScript維持 ⚠⚠⚠
 */

/**
 * CoordinateManager - 座標変換システム
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
        
        // 座標変換システム
        this.transformSystem = {
            canvasToPixi: null,
            pixiToCanvas: null,
            globalToCanvas: null,
            canvasToGlobal: null,
            globalToPixi: null,
            pixiToGlobal: null
        };
        
        // キャッシュシステム
        this.cache = {
            enabled: this.config.cachingEnabled,
            maxSize: this.config.cacheMaxSize || 1000,
            transforms: new Map(),
            hits: 0,
            misses: 0
        };
        
        // スケール・オフセットシステム
        this.viewport = {
            scale: { x: 1.0, y: 1.0 },
            offset: { x: 0, y: 0 },
            rotation: 0,
            lastUpdate: Date.now()
        };
        
        // 統計・診断
        this.stats = {
            transformations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageTransformTime: 0,
            transformTimes: [],
            lastTransformTime: 0,
            startTime: Date.now()
        };
        
        console.log('📍 CoordinateManager: 構築完了');
    }

    /**
     * 座標設定読み込み（ConfigManager統一）
     */
    loadCoordinateConfig() {
        if (window.ConfigManager) {
            const config = {
                enabled: window.ConfigManager.get('canvas.coordinates.enabled') ?? true,
                cachingEnabled: window.ConfigManager.get('canvas.coordinates.cachingEnabled') ?? true,
                cacheMaxSize: window.ConfigManager.get('canvas.coordinates.cacheMaxSize') || 1000,
                precision: window.ConfigManager.get('canvas.coordinates.precision') || 'high',
                scalingSupport: window.ConfigManager.get('canvas.coordinates.scalingSupport') ?? true,
                rotationSupport: window.ConfigManager.get('canvas.coordinates.rotationSupport') ?? false,
                debugging: window.ConfigManager.get('canvas.coordinates.debugging') ?? false,
                performanceMode: window.ConfigManager.get('canvas.coordinates.performanceMode') || 'balanced',
                transformTimeout: window.ConfigManager.get('canvas.coordinates.transformTimeout') || 100
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
                cachingEnabled: true,
                cacheMaxSize: 1000,
                precision: 'high',
                scalingSupport: true,
                rotationSupport: false,
                debugging: false,
                performanceMode: 'balanced',
                transformTimeout: 100
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
            this.initializeTransformSystem();
            
            // キャッシュシステム初期化
            if (this.config.cachingEnabled) {
                this.initializeCacheSystem();
            }
            
            // ビューポートシステム初期化
            if (this.config.scalingSupport) {
                this.initializeViewportSystem();
            }
            
            // EventBus統合
            this.initializeEventBusIntegration();
            
            // 統計システム初期化
            this.initializeStatsSystem();
            
            this.isInitialized = true;
            
            console.log('✅ CoordinateManager: 初期化完了');
            
            // EventBus完了通知
            this.safeEmitEvent('coordinate.manager.initialized', {
                config: this.config,
                caching: this.cache.enabled,
                viewport: this.viewport,
                timestamp: Date.now()
            });
            
            // StateManager状態更新
            this.safeUpdateState('coordinate.manager', {
                initialized: true,
                enabled: this.config.enabled,
                caching: this.cache.enabled
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
    initializeTransformSystem() {
        console.log('🔄 座標変換システム初期化...');
        
        // 基本変換関数設定
        this.transformSystem = {
            canvasToPixi: this.createCanvasToPixiTransform(),
            pixiToCanvas: this.createPixiToCanvasTransform(),
            globalToCanvas: this.createGlobalToCanvasTransform(),
            canvasToGlobal: this.createCanvasToGlobalTransform(),
            globalToPixi: this.createGlobalToPixiTransform(),
            pixiToGlobal: this.createPixiToGlobalTransform()
        };
        
        console.log('✅ 座標変換システム初期化完了');
    }

    /**
     * キャッシュシステム初期化
     */
    initializeCacheSystem() {
        console.log('💾 座標キャッシュシステム初期化...');
        
        this.cache = {
            enabled: true,
            maxSize: this.config.cacheMaxSize,
            transforms: new Map(),
            hits: 0,
            misses: 0,
            lastCleanup: Date.now()
        };
        
        // 定期クリーンアップ設定
        if (this.config.performanceMode === 'memory-optimized') {
            setInterval(() => {
                this.cleanupCache();
            }, 30000); // 30秒ごと
        }
        
        console.log('✅ 座標キャッシュシステム初期化完了');
    }

    /**
     * ビューポートシステム初期化
     */
    initializeViewportSystem() {
        console.log('🔍 ビューポートシステム初期化...');
        
        this.viewport = {
            scale: { x: 1.0, y: 1.0 },
            offset: { x: 0, y: 0 },
            rotation: this.config.rotationSupport ? 0 : null,
            bounds: {
                minScale: 0.1,
                maxScale: 10.0,
                maxOffset: 5000
            },
            lastUpdate: Date.now()
        };
        
        console.log('✅ ビューポートシステム初期化完了');
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
            window.EventBus.on('coordinate.transform.request', this.handleTransformRequest.bind(this));
            window.EventBus.on('coordinate.viewport.update', this.handleViewportUpdate.bind(this));
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
        this.stats = {
            transformations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageTransformTime: 0,
            transformTimes: [],
            lastTransformTime: 0,
            startTime: Date.now(),
            errorCount: 0,
            lastError: null
        };
        
        console.log('📊 座標統計システム初期化完了');
    }

    // ==========================================
    // 🎯 基本座標変換関数群
    // ==========================================

    /**
     * キャンバス→PixiJS座標変換関数作成
     */
    createCanvasToPixiTransform() {
        return (canvasX, canvasY) => {
            const startTime = performance.now();
            
            try {
                // キャッシュ確認
                if (this.cache.enabled) {
                    const cacheKey = 'c2p_' + canvasX.toFixed(2) + '_' + canvasY.toFixed(2);
                    if (this.cache.transforms.has(cacheKey)) {
                        this.stats.cacheHits++;
                        return this.cache.transforms.get(cacheKey);
                    }
                }
                
                // 基本変換（現在はほぼ同一座標系）
                let pixiX = canvasX;
                let pixiY = canvasY;
                
                // スケール・オフセット適用
                if (this.config.scalingSupport) {
                    pixiX = (canvasX - this.viewport.offset.x) / this.viewport.scale.x;
                    pixiY = (canvasY - this.viewport.offset.y) / this.viewport.scale.y;
                }
                
                // 回転適用
                if (this.config.rotationSupport && this.viewport.rotation !== 0) {
                    const cos = Math.cos(this.viewport.rotation);
                    const sin = Math.sin(this.viewport.rotation);
                    const rotatedX = pixiX * cos - pixiY * sin;
                    const rotatedY = pixiX * sin + pixiY * cos;
                    pixiX = rotatedX;
                    pixiY = rotatedY;
                }
                
                const result = { x: pixiX, y: pixiY };
                
                // キャッシュ保存
                if (this.cache.enabled) {
                    const cacheKey = 'c2p_' + canvasX.toFixed(2) + '_' + canvasY.toFixed(2);
                    this.addToCache(cacheKey, result);
                    this.stats.cacheMisses++;
                }
                
                // 統計更新
                this.updateTransformStats(performance.now() - startTime);
                
                return result;
                
            } catch (error) {
                this.handleTransformError('canvasToPixi', error, { canvasX, canvasY });
                return { x: canvasX, y: canvasY }; // フォールバック
            }
        };
    }

    /**
     * PixiJS→キャンバス座標変換関数作成
     */
    createPixiToCanvasTransform() {
        return (pixiX, pixiY) => {
            const startTime = performance.now();
            
            try {
                // キャッシュ確認
                if (this.cache.enabled) {
                    const cacheKey = 'p2c_' + pixiX.toFixed(2) + '_' + pixiY.toFixed(2);
                    if (this.cache.transforms.has(cacheKey)) {
                        this.stats.cacheHits++;
                        return this.cache.transforms.get(cacheKey);
                    }
                }
                
                let canvasX = pixiX;
                let canvasY = pixiY;
                
                // 回転逆変換
                if (this.config.rotationSupport && this.viewport.rotation !== 0) {
                    const cos = Math.cos(-this.viewport.rotation);
                    const sin = Math.sin(-this.viewport.rotation);
                    const rotatedX = canvasX * cos - canvasY * sin;
                    const rotatedY = canvasX * sin + canvasY * cos;
                    canvasX = rotatedX;
                    canvasY = rotatedY;
                }
                
                // スケール・オフセット逆変換
                if (this.config.scalingSupport) {
                    canvasX = canvasX * this.viewport.scale.x + this.viewport.offset.x;
                    canvasY = canvasY * this.viewport.scale.y + this.viewport.offset.y;
                }
                
                const result = { x: canvasX, y: canvasY };
                
                // キャッシュ保存
                if (this.cache.enabled) {
                    const cacheKey = 'p2c_' + pixiX.toFixed(2) + '_' + pixiY.toFixed(2);
                    this.addToCache(cacheKey, result);
                    this.stats.cacheMisses++;
                }
                
                // 統計更新
                this.updateTransformStats(performance.now() - startTime);
                
                return result;
                
            } catch (error) {
                this.handleTransformError('pixiToCanvas', error, { pixiX, pixiY });
                return { x: pixiX, y: pixiY }; // フォールバック
            }
        };
    }

    /**
     * グローバル→キャンバス座標変換関数作成
     */
    createGlobalToCanvasTransform() {
        return (globalX, globalY) => {
            const startTime = performance.now();
            
            try {
                const canvas = this.appCore.getCanvas();
                if (!canvas) {
                    throw new Error('キャンバス要素が取得できません');
                }
                
                // キャッシュ確認（キャンバス位置変化考慮）
                if (this.cache.enabled) {
                    const rect = canvas.getBoundingClientRect();
                    const cacheKey = 'g2c_' + globalX + '_' + globalY + '_' + 
                                    rect.left.toFixed(0) + '_' + rect.top.toFixed(0);
                    if (this.cache.transforms.has(cacheKey)) {
                        this.stats.cacheHits++;
                        return this.cache.transforms.get(cacheKey);
                    }
                }
                
                const rect = canvas.getBoundingClientRect();
                const canvasX = globalX - rect.left;
                const canvasY = globalY - rect.top;
                
                const result = { x: canvasX, y: canvasY };
                
                // キャッシュ保存
                if (this.cache.enabled) {
                    const cacheKey = 'g2c_' + globalX + '_' + globalY + '_' + 
                                    rect.left.toFixed(0) + '_' + rect.top.toFixed(0);
                    this.addToCache(cacheKey, result);
                    this.stats.cacheMisses++;
                }
                
                // 統計更新
                this.updateTransformStats(performance.now() - startTime);
                
                return result;
                
            } catch (error) {
                this.handleTransformError('globalToCanvas', error, { globalX, globalY });
                return { x: globalX, y: globalY }; // フォールバック
            }
        };
    }

    /**
     * キャンバス→グローバル座標変換関数作成
     */
    createCanvasToGlobalTransform() {
        return (canvasX, canvasY) => {
            const startTime = performance.now();
            
            try {
                const canvas = this.appCore.getCanvas();
                if (!canvas) {
                    throw new Error('キャンバス要素が取得できません');
                }
                
                const rect = canvas.getBoundingClientRect();
                const globalX = canvasX + rect.left;
                const globalY = canvasY + rect.top;
                
                const result = { x: globalX, y: globalY };
                
                // 統計更新
                this.updateTransformStats(performance.now() - startTime);
                
                return result;
                
            } catch (error) {
                this.handleTransformError('canvasToGlobal', error, { canvasX, canvasY });
                return { x: canvasX, y: canvasY }; // フォールバック
            }
        };
    }

    /**
     * グローバル→PixiJS座標変換関数作成
     */
    createGlobalToPixiTransform() {
        return (globalX, globalY) => {
            try {
                // グローバル→キャンバス→PixiJS
                const canvasCoord = this.transformSystem.globalToCanvas(globalX, globalY);
                return this.transformSystem.canvasToPixi(canvasCoord.x, canvasCoord.y);
                
            } catch (error) {
                this.handleTransformError('globalToPixi', error, { globalX, globalY });
                return { x: globalX, y: globalY }; // フォールバック
            }
        };
    }

    /**
     * PixiJS→グローバル座標変換関数作成
     */
    createPixiToGlobalTransform() {
        return (pixiX, pixiY) => {
            try {
                // PixiJS→キャンバス→グローバル
                const canvasCoord = this.transformSystem.pixiToCanvas(pixiX, pixiY);
                return this.transformSystem.canvasToGlobal(canvasCoord.x, canvasCoord.y);
                
            } catch (error) {
                this.handleTransformError('pixiToGlobal', error, { pixiX, pixiY });
                return { x: pixiX, y: pixiY }; // フォールバック
            }
        };
    }

    // ==========================================
    // 🎯 公開座標変換API
    // ==========================================

    /**
     * キャンバス→PixiJS座標変換
     */
    canvasToPixi(x, y) {
        if (!this.isInitialized || !this.transformSystem.canvasToPixi) {
            return { x, y };
        }
        return this.transformSystem.canvasToPixi(x, y);
    }

    /**
     * PixiJS→キャンバス座標変換
     */
    pixiToCanvas(x, y) {
        if (!this.isInitialized || !this.transformSystem.pixiToCanvas) {
            return { x, y };
        }
        return this.transformSystem.pixiToCanvas(x, y);
    }

    /**
     * グローバル→キャンバス座標変換
     */
    globalToCanvas(x, y) {
        if (!this.isInitialized || !this.transformSystem.globalToCanvas) {
            return { x, y };
        }
        return this.transformSystem.globalToCanvas(x, y);
    }

    /**
     * キャンバス→グローバル座標変換
     */
    canvasToGlobal(x, y) {
        if (!this.isInitialized || !this.transformSystem.canvasToGlobal) {
            return { x, y };
        }
        return this.transformSystem.canvasToGlobal(x, y);
    }

    /**
     * グローバル→PixiJS座標変換
     */
    globalToPixi(x, y) {
        if (!this.isInitialized || !this.transformSystem.globalToPixi) {
            return { x, y };
        }
        return this.transformSystem.globalToPixi(x, y);
    }

    /**
     * PixiJS→グローバル座標変換
     */
    pixiToGlobal(x, y) {
        if (!this.isInitialized || !this.transformSystem.pixiToGlobal) {
            return { x, y };
        }
        return this.transformSystem.pixiToGlobal(x, y);
    }

    /**
     * 汎用座標変換
     */
    transform(x, y, fromSpace, toSpace) {
        const validSpaces = ['canvas', 'pixi', 'global'];
        
        if (!validSpaces.includes(fromSpace) || !validSpaces.includes(toSpace)) {
            throw new Error('無効な座標空間: ' + fromSpace + ' → ' + toSpace);
        }
        
        if (fromSpace === toSpace) {
            return { x, y };
        }
        
        // 変換パス決定
        const transformKey = fromSpace + 'To' + toSpace.charAt(0).toUpperCase() + toSpace.slice(1);
        
        if (this.transformSystem[transformKey]) {
            return this.transformSystem[transformKey](x, y);
        }
        
        // 間接変換
        if (fromSpace === 'canvas' && toSpace === 'global') {
            return this.canvasToGlobal(x, y);
        } else if (fromSpace === 'global' && toSpace === 'canvas') {
            return this.globalToCanvas(x, y);
        } else {
            // 多段変換（global → canvas → pixi等）
            const intermediateCoord = this.transform(x, y, fromSpace, 'canvas');
            return this.transform(intermediateCoord.x, intermediateCoord.y, 'canvas', toSpace);
        }
    }

    // ==========================================
    // 🎯 ビューポート・スケーリングシステム
    // ==========================================

    /**
     * ビューポートスケール設定
     */
    setScale(scaleX, scaleY) {
        if (!this.config.scalingSupport) {
            console.warn('⚠️ スケーリングサポートが無効です');
            return false;
        }
        
        try {
            // スケール制限
            const minScale = this.viewport.bounds.minScale;
            const maxScale = this.viewport.bounds.maxScale;
            
            scaleX = Math.max(minScale, Math.min(maxScale, scaleX));
            scaleY = scaleY !== undefined ? Math.max(minScale, Math.min(maxScale, scaleY)) : scaleX;
            
            this.viewport.scale.x = scaleX;
            this.viewport.scale.y = scaleY;
            this.viewport.lastUpdate = Date.now();
            
            // キャッシュクリア
            this.clearTransformCache();
            
            // EventBus通知
            this.safeEmitEvent('coordinate.viewport.scaled', {
                scale: { x: scaleX, y: scaleY },
                timestamp: this.viewport.lastUpdate
            });
            
            console.log('📏 ビューポートスケール設定:', scaleX, scaleY);
            
            return true;
            
        } catch (error) {
            this.handleTransformError('setScale', error, { scaleX, scaleY });
            return false;
        }
    }

    /**
     * ビューポートオフセット設定
     */
    setOffset(offsetX, offsetY) {
        if (!this.config.scalingSupport) {
            console.warn('⚠️ スケーリングサポートが無効です');
            return false;
        }
        
        try {
            // オフセット制限
            const maxOffset = this.viewport.bounds.maxOffset;
            
            offsetX = Math.max(-maxOffset, Math.min(maxOffset, offsetX));
            offsetY = Math.max(-maxOffset, Math.min(maxOffset, offsetY));
            
            this.viewport.offset.x = offsetX;
            this.viewport.offset.y = offsetY;
            this.viewport.lastUpdate = Date.now();
            
            // キャッシュクリア
            this.clearTransformCache();
            
            // EventBus通知
            this.safeEmitEvent('coordinate.viewport.offset', {
                offset: { x: offsetX, y: offsetY },
                timestamp: this.viewport.lastUpdate
            });
            
            console.log('📐 ビューポートオフセット設定:', offsetX, offsetY);
            
            return true;
            
        } catch (error) {
            this.handleTransformError('setOffset', error, { offsetX, offsetY });
            return false;
        }
    }

    /**
     * ビューポート回転設定
     */
    setRotation(rotation) {
        if (!this.config.rotationSupport) {
            console.warn('⚠️ 回転サポートが無効です');
            return false;
        }
        
        try {
            // 回転角度正規化
            rotation = rotation % (Math.PI * 2);
            if (rotation < 0) rotation += Math.PI * 2;
            
            this.viewport.rotation = rotation;
            this.viewport.lastUpdate = Date.now();
            
            // キャッシュクリア
            this.clearTransformCache();
            
            // EventBus通知
            this.safeEmitEvent('coordinate.viewport.rotated', {
                rotation: rotation,
                degrees: (rotation * 180 / Math.PI).toFixed(2),
                timestamp: this.viewport.lastUpdate
            });
            
            console.log('🔄 ビューポート回転設定:', (rotation * 180 / Math.PI).toFixed(2) + '度');
            
            return true;
            
        } catch (error) {
            this.handleTransformError('setRotation', error, { rotation });
            return false;
        }
    }

    /**
     * ビューポートリセット
     */
    resetViewport() {
        try {
            this.viewport.scale = { x: 1.0, y: 1.0 };
            this.viewport.offset = { x: 0, y: 0 };
            if (this.config.rotationSupport) {
                this.viewport.rotation = 0;
            }
            this.viewport.lastUpdate = Date.now();
            
            // キャッシュクリア
            this.clearTransformCache();
            
            // EventBus通知
            this.safeEmitEvent('coordinate.viewport.reset', {
                viewport: this.viewport,
                timestamp: Date.now()
            });
            
            console.log('🔄 ビューポートリセット完了');
            
            return true;
            
        } catch (error) {
            this.handleTransformError('resetViewport', error);
            return false;
        }
    }

    // ==========================================
    // 🎯 キャッシュシステム
    // ==========================================

    /**
     * キャッシュに追加
     */
    addToCache(key, value) {
        if (!this.cache.enabled) return;
        
        try {
            // キャッシュサイズ制限
            if (this.cache.transforms.size >= this.cache.maxSize) {
                // LRU的に古いエントリを削除
                const firstKey = this.cache.transforms.keys().next().value;
                this.cache.transforms.delete(firstKey);
            }
            
            this.cache.transforms.set(key, value);
            
        } catch (error) {
            console.warn('⚠️ キャッシュ追加エラー:', error);
        }
    }

    /**
     * 座標変換キャッシュクリア
     */
    clearTransformCache() {
        if (this.cache.enabled) {
            this.cache.transforms.clear();
            this.cache.hits = 0;
            this.cache.misses = 0;
            
            console.log('🧹 座標変換キャッシュクリア完了');
        }
    }

    /**
     * キャッシュクリーンアップ
     */
    cleanupCache() {
        if (!this.cache.enabled) return;
        
        try {
            const now = Date.now();
            const cleanupInterval = 60000; // 1分
            
            if (now - this.cache.lastCleanup > cleanupInterval) {
                // パフォーマンスモードに応じてクリーンアップ
                if (this.config.performanceMode === 'memory-optimized') {
                    // メモリ優先: キャッシュサイズを半分に
                    const entries = Array.from(this.cache.transforms.entries());
                    const keepCount = Math.floor(entries.length / 2);
                    
                    this.cache.transforms.clear();
                    
                    for (let i = entries.length - keepCount; i < entries.length; i++) {
                        if (entries[i]) {
                            this.cache.transforms.set(entries[i][0], entries[i][1]);
                        }
                    }
                    
                    console.log('🧹 メモリ優先キャッシュクリーンアップ:', keepCount + '件保持');
                    
                } else if (this.config.performanceMode === 'speed-optimized') {
                    // 速度優先: キャッシュ保持
                    console.log('🏃 速度優先モード: キャッシュクリーンアップスキップ');
                }
                
                this.cache.lastCleanup = now;
            }
            
        } catch (error) {
            console.error('❌ キャッシュクリーンアップエラー:', error);
        }
    }

    // ==========================================
    // 🎯 リサイズ・EventBusハンドラー
    // ==========================================

    /**
     * リサイズ処理
     */
    handleResize(newWidth, newHeight) {
        try {
            console.log('📏 CoordinateManager: リサイズ対応', newWidth + 'x' + newHeight);
            
            // キャッシュクリア（キャンバスサイズ変更のため）
            this.clearTransformCache();
            
            // 座標変換システム再初期化（必要に応じて）
            if (this.config.scalingSupport) {
                // ビューポート境界更新
                this.viewport.bounds.maxOffset = Math.max(newWidth, newHeight) * 2;
            }
            
            // StateManager状態更新
            this.safeUpdateState('coordinate.canvas', {
                width: newWidth,
                height: newHeight,
                lastResize: Date.now()
            });
            
            // EventBus通知
            this.safeEmitEvent('coordinate.canvas.resized', {
                width: newWidth,
                height: newHeight,
                cacheCleared: true,
                timestamp: Date.now()
            });
            
            console.log('✅ CoordinateManager: リサイズ完了');
            
        } catch (error) {
            console.error('❌ CoordinateManagerリサイズエラー:', error);
        }
    }

    /**
     * 座標変換リクエストハンドラー
     */
    handleTransformRequest(data) {
        try {
            if (!data.x || !data.y || !data.from || !data.to) {
                throw new Error('座標変換リクエストに必須パラメーターがありません');
            }
            
            const result = this.transform(data.x, data.y, data.from, data.to);
            
            this.safeEmitEvent('coordinate.transform.response', {
                requestId: data.requestId,
                result: result,
                from: data.from,
                to: data.to,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ 座標変換リクエスト処理エラー:', error);
            
            this.safeEmitEvent('coordinate.transform.error', {
                requestId: data.requestId,
                error: error.message,
                data: data,
                timestamp: Date.now()
            });
        }
    }

    /**
     * ビューポート更新ハンドラー
     */
    handleViewportUpdate(data) {
        try {
            if (data.scale) {
                this.setScale(data.scale.x, data.scale.y);
            }
            
            if (data.offset) {
                this.setOffset(data.offset.x, data.offset.y);
            }
            
            if (data.rotation !== undefined) {
                this.setRotation(data.rotation);
            }
            
            if (data.reset) {
                this.resetViewport();
            }
            
        } catch (error) {
            console.error('❌ ビューポート更新エラー:', error);
        }
    }

    /**
     * キャッシュクリアハンドラー
     */
    handleCacheClear(data) {
        try {
            this.clearTransformCache();
            
            this.safeEmitEvent('coordinate.cache.cleared', {
                requestId: data.requestId,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('/**
 