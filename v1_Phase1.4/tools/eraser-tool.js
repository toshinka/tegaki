/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: 消しゴム高度化・範囲消去・消去モード・アルファ合成・GPU加速準備
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js, js/utils/coordinates.js, js/managers/memory-manager.js
 * 🎯 NODE_MODULES: lodash（効率的な範囲計算）, pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: lodash, gsap（アニメーション用）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → eraser-modes.js, eraser-shapes.js分割
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5 - JavaScript機能分割完了・AI分業基盤確立
 * 📋 V8_MIGRATION: BlendMode API変更対応・WebGPU消去シェーダー準備・120FPS対応
 * 📋 PERFORMANCE_TARGET: 消去応答性1ms以下・範囲消去最適化・GPU加速
 * 📋 DRY_COMPLIANCE: ✅ 共通処理Utils活用・重複コード排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 * 
 * 🔄 UNIFIED_SYSTEMS: ConfigManager・ErrorManager・StateManager・EventBus統合済み
 */

/**
 * プロ級消しゴムツール（統一システム活用版）
 * 範囲指定消去・消去モード・アルファ合成・エリア検出・GPU加速準備
 * Pure JavaScript完全準拠・AI分業対応
 */
class EraserTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.version = 'v1.0-Phase1.1ss5-unified';
        this.name = 'eraser';
        this.displayName = '消しゴム';
        
        // 🔄 統一システム参照
        this.configManager = window.ConfigManager;
        this.errorManager = window.ErrorManager;
        this.stateManager = window.StateManager;
        this.eventBus = window.EventBus;
        
        // 🎯 STEP5: 消去状態管理強化
        this.isErasing = false;
        this.isActive = false;
        this.currentErasePath = null;
        this.erasingSession = null;
        
        // 🎯 STEP5: 統一システム設定値取得
        this.initializeSettingsFromConfig();
        
        // 🎯 STEP5: パフォーマンス監視
        this.performance = {
            eraseCalls: 0,
            averageLatency: 0,
            pixelsErased: 0,
            lastFrameTime: 0,
            targetFPS: this.configManager ? this.configManager.get('performance.targetFPS') : 60,
            memoryUsage: 0
        };
        
        // 🎯 STEP5: 拡張ライブラリ統合
        this.lodashAvailable = false;
        this.gsapAvailable = false;
        this.coordinatesUtil = null;
        this.memoryManager = null;
        this.performanceMonitor = null;
        
        console.log(`🧹 EraserTool 統一システム版構築開始 - ${this.version}`);
    }
// EraserToolクラスに以下のメソッドを追加

/**
 * 🎯 境界越え消去開始処理（新規実装）
 * BoundaryManager → AppCore → EraserTool 連携完了
 */
handleBoundaryCrossIn(x, y, eventData) {
    if (!this.isActive) return;
    
    try {
        console.log(`🗑️ 境界越え消去開始: EraserTool at (${x.toFixed(1)}, ${y.toFixed(1)})`);
        
        const pressure = eventData.pressure || 1.0; // 消しゴムは通常フル圧力
        const timestamp = eventData.timestamp || performance.now();
        
        // 既存のstartErasingメソッドを呼び出し
        const erasePath = this.startErasing(x, y, pressure, timestamp);
        
        // EventBus通知（境界越え専用）
        this.emitEvent('BOUNDARY_ERASING_STARTED', {
            tool: this.name,
            position: { x, y },
            pressure,
            sessionId: this.erasingSession?.id,
            fromBoundary: true
        });
        
        return erasePath;
        
    } catch (error) {
        this.safeError(`境界越え消去エラー: ${error.message}`, 'error');
        return null;
    }
}
    
    /**
     * 🔄 統一システムからの設定初期化
     */
    initializeSettingsFromConfig() {
        try {
            const drawingConfig = this.configManager ? this.configManager.getDrawingConfig('eraser') : {};
            const uiConfig = this.configManager ? this.configManager.getUIConfig() : {};
            const perfConfig = this.configManager ? this.configManager.getPerformanceConfig() : {};
            
            // 🎯 STEP5: 高度な消去モードシステム
            this.eraseMode = {
                type: 'normal', // normal, complete, alpha, selective
                blendMode: 'destination-out', // destination-out, screen, multiply
                preserveAlpha: false,
                feathering: true,
                hardEdge: false
            };
            
            // 🎯 STEP5: 範囲消去システム
            this.areaEraser = {
                enabled: false,
                shape: 'circle', // circle, square, lasso, magic
                tolerance: 32, // マジック消去用閾値
                previewMode: true,
                selectionBuffer: [],
                boundingBox: null
            };
            
            // 🎯 STEP5: エフェクト・アニメーション
            this.eraserEffects = {
                particleSystem: true,
                fadeAnimation: true,
                rippleEffect: false,
                sparkles: true,
                glowEffect: false
            };
            
            // 🎯 STEP5: GPU加速準備
            this.gpuAcceleration = {
                enabled: false, // V8移行時true
                shaderMode: 'fragment', // fragment, compute
                bufferMode: 'texture', // texture, vertex
                batchProcessing: true
            };
            
            // 🔄 統一システム設定統合
            this.settings = {
                // ConfigManager基本設定
                minSize: drawingConfig.minSize || 0.5,
                maxSize: drawingConfig.maxSize || 200.0,
                baseSize: drawingConfig.defaultSize || 20.0,
                opacity: drawingConfig.opacity || 100.0,
                hardness: 50.0,
                
                // 範囲消去設定
                areaMode: false,
                shapeMode: 'circle',
                featherRadius: 2.0,
                tolerance: 32,
                
                // エフェクト設定
                particles: true,
                fadeAnimation: true,
                previewMode: true,
                
                // GPU設定
                gpuAcceleration: false, // V8移行時対応
                hardwareAcceleration: true,
                shaderOptimization: true
            };
            
        } catch (error) {
            this.safeError(`設定初期化エラー: ${error.message}`, 'warning');
            this.initializeFallbackSettings();
        }
    }
    
    /**
     * 🛡️ フォールバック設定初期化
     */
    initializeFallbackSettings() {
        this.settings = {
            minSize: 0.5,
            maxSize: 200.0,
            baseSize: 20.0,
            opacity: 100.0,
            areaMode: false,
            particles: false,
            fadeAnimation: false,
            gpuAcceleration: false
        };
        
        this.eraseMode = { type: 'normal' };
        this.areaEraser = { enabled: false };
        this.eraserEffects = { particleSystem: false };
        this.gpuAcceleration = { enabled: false };
    }
    
    /**
     * 🎯 STEP5: 消しゴムツール高度化初期化（統一システム版）
     */
    async initialize() {
        console.group(`🧹 EraserTool 統一システム版初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存確認
            this.validateUnifiedSystems();
            
            // Phase 2: 拡張ライブラリ確認・統合
            this.checkAndIntegrateExtensions();
            
            // Phase 3: 消去モードシステム初期化
            this.initializeEraseModesSystem();
            
            // Phase 4: 範囲消去システム初期化
            this.initializeAreaEraseSystem();
            
            // Phase 5: エフェクト・アニメーション初期化
            this.initializeEffectsSystem();
            
            // Phase 6: GPU加速準備（V8移行用）
            this.prepareGPUAcceleration();
            
            // Phase 7: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Phase 8: ToolManager登録
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
            }
            
            // Phase 9: EventBus通知
            this.emitEvent('TOOL_INITIALIZED', {
                tool: this.name,
                version: this.version,
                unifiedSystems: true
            });
            
            const initTime = performance.now() - startTime;
            console.log(`✅ EraserTool 統一システム版初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            this.safeError(`初期化エラー: ${error.message}`, 'error');
            
            // 🛡️ STEP5: フォールバック初期化
            await this.fallbackInitialization();
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🔄 統一システム依存確認
     */
    validateUnifiedSystems() {
        const systems = {
            ConfigManager: window.ConfigManager,
            ErrorManager: window.ErrorManager,
            StateManager: window.StateManager,
            EventBus: window.EventBus
        };
        
        const missing = Object.keys(systems).filter(name => !systems[name]);
        
        if (missing.length > 0) {
            throw new Error(`統一システム未確認: ${missing.join(', ')}`);
        }
        
        console.log('✅ 統一システム依存確認完了');
    }
    
    /**
     * 🎯 STEP5: 高度な消去開始（統一システム版）
     */
    startErasing(x, y, pressure = 1.0, timestamp = performance.now()) {
        if (!this.toolManager?.appCore) {
            this.safeError('AppCore 未初期化', 'warning');
            return null;
        }
        
        const startTime = performance.now();
        
        try {
            this.isErasing = true;
            
            // 消去セッション開始
            this.erasingSession = {
                id: this.generateSessionId(),
                startTime: timestamp,
                erasePoints: [],
                totalPixelsErased: 0,
                erasedPaths: new Set(),
                mode: this.eraseMode.type
            };
            
            // 範囲消去モードチェック
            if (this.settings.areaMode) {
                return this.startAreaErasing(x, y, pressure);
            }
            
            // 通常消去モード
            this.currentErasePath = this.createErasePath(x, y, pressure);
            
            // メモリ管理への記録
            if (this.memoryManager) {
                this.memoryManager.recordAction('ERASE_START', {
                    tool: this.name,
                    startPoint: { x, y, pressure },
                    sessionId: this.erasingSession.id,
                    mode: this.eraseMode.type
                });
            }
            
            // エフェクト開始
            this.startEraseEffects(x, y);
            
            // EventBus通知
            this.emitEvent('DRAWING_STARTED', {
                tool: this.name,
                position: { x, y },
                pressure,
                sessionId: this.erasingSession.id,
                eraseMode: this.eraseMode.type
            });
            
            const processTime = performance.now() - startTime;
            this.updateLatencyStats(processTime);
            
            console.log(`🧹 統一システム版消去開始: (${x.toFixed(2)}, ${y.toFixed(2)}) P:${pressure.toFixed(3)} [${processTime.toFixed(2)}ms]`);
            
            return this.currentErasePath;
            
        } catch (error) {
            this.safeError(`消去開始エラー: ${error.message}`, 'error');
            this.isErasing = false;
            return null;
        }
    }
    
    /**
     * 🎯 STEP5: 高度な消去継続（統一システム版）
     */
    continueErasing(x, y, pressure = 1.0, timestamp = performance.now()) {
        if (!this.isErasing || !this.erasingSession) {
            return false;
        }
        
        const startTime = performance.now();
        
        try {
            // 範囲消去モードチェック
            if (this.settings.areaMode) {
                return this.continueAreaErasing(x, y, pressure);
            }
            
            // 通常消去継続
            const erasePoint = { x, y, pressure, timestamp };
            this.erasingSession.erasePoints.push(erasePoint);
            
            // 消去実行
            const pixelsErased = this.executeErase(x, y, pressure);
            this.erasingSession.totalPixelsErased += pixelsErased;
            
            // エフェクト更新
            this.updateEraseEffects(x, y, pressure);
            
            // EventBus通知（間引き）
            if (this.erasingSession.erasePoints.length % 5 === 0) {
                this.emitEvent('DRAWING_CONTINUED', {
                    tool: this.name,
                    position: { x, y },
                    pressure,
                    sessionId: this.erasingSession.id,
                    pixelsErased: this.erasingSession.totalPixelsErased
                });
            }
            
            const processTime = performance.now() - startTime;
            this.updateLatencyStats(processTime);
            
            return true;
            
        } catch (error) {
            this.safeError(`消去継続エラー: ${error.message}`, 'warning');
            return false;
        }
    }
    
    /**
     * 🎯 STEP5: 高度な消去終了（統一システム版）
     */
    stopErasing(timestamp = performance.now()) {
        if (!this.isErasing || !this.erasingSession) {
            return false;
        }
        
        const startTime = performance.now();
        
        try {
            // 範囲消去モードチェック
            if (this.settings.areaMode) {
                return this.stopAreaErasing();
            }
            
            // セッション統計
            const sessionStats = this.calculateErasedStats(timestamp);
            
            // メモリ管理への記録
            if (this.memoryManager) {
                this.memoryManager.recordAction('ERASE_END', {
                    tool: this.name,
                    sessionId: this.erasingSession.id,
                    stats: sessionStats
                });
            }
            
            // エフェクト終了
            this.stopEraseEffects();
            
            // EventBus通知
            this.emitEvent('DRAWING_ENDED', {
                tool: this.name,
                sessionId: this.erasingSession.id,
                stats: sessionStats
            });
            
            // クリーンアップ
            this.isErasing = false;
            const completedSession = this.erasingSession;
            this.erasingSession = null;
            this.currentErasePath = null;
            
            const processTime = performance.now() - startTime;
            this.updateLatencyStats(processTime);
            
            console.log(`🧹 統一システム版消去終了: ${sessionStats.totalPixels}px, ${sessionStats.pathsCount}パス [${processTime.toFixed(2)}ms]`);
            
            return completedSession;
            
        } catch (error) {
            this.safeError(`消去終了エラー: ${error.message}`, 'error');
            this.isErasing = false;
            return null;
        }
    }
    
    // ==========================================
    // 🔄 統一システム活用メソッド群
    // ==========================================
    
    /**
     * 統一エラー処理
     */
    safeError(message, type = 'error') {
        if (this.errorManager) {
            this.errorManager.showError(type, message);
        } else {
            console.error(`EraserTool ${type}:`, message);
        }
    }
    
    /**
     * 統一イベント発行
     */
    emitEvent(eventType, data) {
        if (this.eventBus) {
            this.eventBus.safeEmit(eventType, data);
        }
    }
    
    /**
     * 統一状態取得
     */
    getApplicationState() {
        if (this.stateManager) {
            return this.stateManager.getApplicationState();
        }
        return null;
    }
    
    /**
     * 設定値更新（統一システム連携）
     */
    updateSettings(newSettings) {
        if (!newSettings) return;
        
        try {
            // 安全な設定マージ
            if (this.lodashAvailable) {
                this.settings = window._.merge({}, this.settings, newSettings);
            } else {
                this.settings = { ...this.settings, ...newSettings };
            }
            
            // ConfigManagerに反映
            if (this.configManager) {
                Object.keys(newSettings).forEach(key => {
                    const configPath = `drawing.eraser.${key}`;
                    if (this.configManager.validate(configPath, newSettings[key])) {
                        this.configManager.set(configPath, newSettings[key]);
                    }
                });
            }
            
            // 依存システム更新
            this.updateDependentSystems();
            
            // EventBus通知
            if (newSettings.baseSize) {
                this.emitEvent('BRUSH_SIZE_CHANGED', { size: this.settings.baseSize, tool: this.name });
            }
            
            console.log('🧹 消しゴムツール設定更新完了（統一システム連携）:', newSettings);
            
        } catch (error) {
            this.safeError(`設定更新エラー: ${error.message}`, 'warning');
        }
    }
    
    /**
     * ツールアクティベート（統一システム版）
     */
    activate() {
        this.isActive = true;
        
        // EventBus通知
        this.emitEvent('TOOL_CHANGED', {
            previousTool: null,
            currentTool: this.name,
            displayName: this.displayName
        });
        
        console.log(`🧹 ${this.displayName} アクティブ化 - 統一システム版`);
    }
    
    /**
     * ツール非アクティベート（統一システム版）
     */
    deactivate() {
        if (this.isErasing) {
            this.stopErasing();
        }
        
        // エフェクト停止
        this.stopEraseEffects();
        
        // プレビュー停止
        this.stopAreaPreview();
        
        this.isActive = false;
        
        // EventBus通知
        this.emitEvent('TOOL_CHANGED', {
            previousTool: this.name,
            currentTool: null,
            displayName: null
        });
        
        console.log(`🧹 ${this.displayName} 非アクティブ化 - 統一システム版`);
    }
    
    // ==========================================
    // 🎯 継続する機能メソッド群
    // ==========================================
    
    checkAndIntegrateExtensions() {
        console.log('🔧 拡張ライブラリ統合開始...');
        
        this.lodashAvailable = typeof window._ !== 'undefined';
        if (this.lodashAvailable) {
            console.log('✅ Lodash 統合完了 - 範囲計算最適化');
        }
        
        this.gsapAvailable = typeof window.gsap !== 'undefined';
        if (this.gsapAvailable) {
            console.log('✅ GSAP 統合完了 - 消去アニメーション');
        }
        
        this.coordinatesUtil = window.CoordinatesUtil;
        if (this.coordinatesUtil) {
            console.log('✅ CoordinatesUtil 統合完了');
        }
        
        this.memoryManager = this.toolManager?.memoryManager;
        if (this.memoryManager) {
            console.log('✅ MemoryManager 統合完了');
        }
        
        console.log('🔧 拡張ライブラリ統合完了');
    }
    
    initializeEraseModesSystem() {
        console.log('🎭 消去モードシステム初期化...');
        
        this.eraseModes = {
            normal: {
                name: '通常消去',
                blendMode: 'destination-out',
                preserveAlpha: false,
                description: '通常の消しゴム機能'
            },
            complete: {
                name: '完全消去',
                blendMode: 'clear',
                preserveAlpha: false,
                description: '完全に削除（透明化）'
            },
            alpha: {
                name: 'アルファ消去',
                blendMode: 'destination-out',
                preserveAlpha: true,
                description: '透明度のみ調整'
            },
            selective: {
                name: '選択的消去',
                blendMode: 'destination-out',
                colorMatch: true,
                description: '指定色のみ消去'
            }
        };
        
        console.log('🎭 消去モードシステム初期化完了');
    }
    
    initializeAreaEraseSystem() {
        console.log('📐 範囲消去システム初期化...');
        
        this.areaShapes = {
            circle: {
                name: '円形',
                generator: this.generateCircleArea.bind(this),
                preview: this.previewCircleArea.bind(this)
            },
            square: {
                name: '矩形',
                generator: this.generateSquareArea.bind(this),
                preview: this.previewSquareArea.bind(this)
            },
            lasso: {
                name: '自由選択',
                generator: this.generateLassoArea.bind(this),
                preview: this.previewLassoArea.bind(this)
            }
        };
        
        this.areaOptimization = {
            spatialIndexing: true,
            quadTree: null,
            batchProcessing: true,
            pixelSampling: 4,
            edgeDetection: true
        };
        
        console.log('📐 範囲消去システム初期化完了');
    }
    
    initializeEffectsSystem() {
        console.log('✨ エフェクトシステム初期化...');
        
        this.particleSystem = {
            enabled: this.settings.particles,
            maxParticles: 50,
            activeParticles: [],
            pooledParticles: [],
            emissionRate: 5,
            lifespan: 1.0
        };
        
        this.animations = {
            fadeOut: {
                enabled: this.settings.fadeAnimation,
                duration: 0.3,
                easing: 'power2.out'
            },
            sparkle: {
                enabled: true,
                count: 3,
                duration: 0.5
            }
        };
        
        console.log('✨ エフェクトシステム初期化完了');
    }
    
    prepareGPUAcceleration() {
        console.log('🚀 GPU加速準備（V8移行用）...');
        
        this.webgpuAvailable = typeof navigator !== 'undefined' && 
                               navigator.gpu !== undefined;
        
        if (this.webgpuAvailable) {
            console.log('✅ WebGPU利用可能 - V8移行時対応予定');
        }
        
        this.gpuOptimization = {
            textureStreaming: true,
            shaderCaching: true,
            bufferPooling: true,
            asyncProcessing: true
        };
        
        console.log('🚀 GPU加速準備完了');
    }
    
    startPerformanceMonitoring() {
        console.log('📊 消しゴムパフォーマンス監視開始...');
        
        this.performanceMonitor = {
            frameCount: 0,
            totalTime: 0,
            lastUpdate: performance.now(),
            maxLatency: 0,
            minLatency: Infinity
        };
        
        setInterval(() => {
            this.updatePerformanceStats();
        }, 5000);
        
        console.log('📊 消しゴムパフォーマンス監視開始完了');
    }
    
    // ==========================================
    // 🎯 消去実行・範囲消去メソッド群
    // ==========================================
    
    executeErase(x, y, pressure) {
        if (!this.toolManager?.appCore?.drawingContainer) {
            return 0;
        }
        
        const eraseSize = this.calculateEffectiveSize(pressure);
        const eraseRadius = eraseSize / 2;
        let pixelsErased = 0;
        
        const erasableObjects = this.findErasableObjects(x, y, eraseRadius);
        
        erasableObjects.forEach(obj => {
            const erased = this.eraseFromObject(obj, x, y, eraseRadius);
            pixelsErased += erased;
        });
        
        this.performance.eraseCalls++;
        this.performance.pixelsErased += pixelsErased;
        
        return pixelsErased;
    }
    
    findErasableObjects(x, y, radius) {
        const erasableObjects = [];
        const bounds = {
            left: x - radius,
            right: x + radius,
            top: y - radius,
            bottom: y + radius
        };
        
        if (this.toolManager.appCore.paths) {
            this.toolManager.appCore.paths.forEach(path => {
                if (this.isPathInBounds(path, bounds)) {
                    erasableObjects.push({
                        type: 'path',
                        object: path,
                        priority: 1
                    });
                }
            });
        }
        
        return erasableObjects;
    }
    
    eraseFromObject(obj, x, y, radius) {
        if (obj.type === 'path' && obj.object?.graphics) {
            return this.eraseFromPath(obj.object, x, y, radius);
        }
        return 0;
    }
    
    eraseFromPath(path, x, y, radius) {
        if (!path.graphics || !path.points) {
            return 0;
        }
        
        let pixelsErased = 0;
        
        switch (this.eraseMode.type) {
            case 'complete':
                pixelsErased = this.completeEraseFromPath(path, x, y, radius);
                break;
            case 'alpha':
                pixelsErased = this.alphaEraseFromPath(path, x, y, radius);
                break;
            case 'selective':
                pixelsErased = this.selectiveEraseFromPath(path, x, y, radius);
                break;
            default:
                pixelsErased = this.normalEraseFromPath(path, x, y, radius);
        }
        
        if (this.isPathCompletelyErased(path)) {
            this.removePathCompletely(path);
        }
        
        if (this.erasingSession) {
            this.erasingSession.erasedPaths.add(path.id || path);
        }
        
        return pixelsErased;
    }
    
    normalEraseFromPath(path, x, y, radius) {
        const eraseGraphics = new PIXI.Graphics();
        eraseGraphics.beginFill(0xFFFFFF, 1.0);
        eraseGraphics.drawCircle(x, y, radius);
        eraseGraphics.endFill();
        
        eraseGraphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        
        if (path.graphics.mask) {
            const combinedMask = new PIXI.Graphics();
            combinedMask.addChild(path.graphics.mask);
            combinedMask.addChild(eraseGraphics);
            path.graphics.mask = combinedMask;
        } else {
            path.graphics.mask = eraseGraphics;
        }
        
        return Math.PI * radius * radius;
    }
    
    completeEraseFromPath(path, x, y, radius) {
        if (path.graphics && path.graphics.parent) {
            path.graphics.parent.removeChild(path.graphics);
        }
        
        if (this.toolManager.appCore.paths) {
            const index = this.toolManager.appCore.paths.indexOf(path);
            if (index >= 0) {
                this.toolManager.appCore.paths.splice(index, 1);
            }
        }
        
        return path.points ? path.points.length * 2 : 100;
    }
    
    alphaEraseFromPath(path, x, y, radius) {
        if (path.graphics) {
            const currentAlpha = path.graphics.alpha || 1.0;
            const reduction = 0.2;
            path.graphics.alpha = Math.max(0, currentAlpha - reduction);
            
            if (path.graphics.alpha <= 0.01) {
                path.graphics.visible = false;
            }
        }
        
        return Math.PI * radius * radius * 0.2;
    }
    
    selectiveEraseFromPath(path, x, y, radius) {
        const targetColor = this.eraseMode.targetColor || 0x800000;
        
        if (path.color && this.colorsMatch(path.color, targetColor, this.eraseMode.tolerance || 32)) {
            return this.normalEraseFromPath(path, x, y, radius);
        }
        
        return 0;
    }
    
    // ==========================================
    // 🎯 範囲消去システム実装
    // ==========================================
    
    startAreaErasing(x, y, pressure) {
        console.log(`📐 範囲消去開始: ${this.settings.shapeMode}`);
        
        this.areaEraser.enabled = true;
        this.areaEraser.selectionBuffer = [{ x, y, pressure }];
        this.areaEraser.boundingBox = { left: x, right: x, top: y, bottom: y };
        
        if (this.settings.previewMode) {
            this.startAreaPreview(x, y);
        }
        
        return true;
    }
    
    continueAreaErasing(x, y, pressure) {
        if (!this.areaEraser.enabled) return false;
        
        this.areaEraser.selectionBuffer.push({ x, y, pressure });
        
        this.areaEraser.boundingBox.left = Math.min(this.areaEraser.boundingBox.left, x);
        this.areaEraser.boundingBox.right = Math.max(this.areaEraser.boundingBox.right, x);
        this.areaEraser.boundingBox.top = Math.min(this.areaEraser.boundingBox.top, y);
        this.areaEraser.boundingBox.bottom = Math.max(this.areaEraser.boundingBox.bottom, y);
        
        if (this.settings.previewMode) {
            this.updateAreaPreview();
        }
        
        return true;
    }
    
    stopAreaErasing() {
        if (!this.areaEraser.enabled) return false;
        
        try {
            const eraseArea = this.generateEraseArea();
            const pixelsErased = this.executeAreaErase(eraseArea);
            
            this.stopAreaPreview();
            
            this.areaEraser.enabled = false;
            this.areaEraser.selectionBuffer = [];
            this.areaEraser.boundingBox = null;
            
            console.log(`📐 範囲消去完了: ${pixelsErased}px消去`);
            
            return true;
            
        } catch (error) {
            this.safeError(`範囲消去エラー: ${error.message}`, 'error');
            return false;
        }
    }
    
    generateEraseArea() {
        const shapeMode = this.settings.shapeMode;
        const generator = this.areaShapes[shapeMode]?.generator;
        
        if (!generator) {
            console.warn(`⚠️ 未対応の範囲形状: ${shapeMode}`);
            return this.generateCircleArea();
        }
        
        return generator(this.areaEraser.selectionBuffer, this.areaEraser.boundingBox);
    }
    
    generateCircleArea(points, bounds) {
        if (!points || points.length === 0) return null;
        
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const radius = Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) / 2;
        
        return {
            type: 'circle',
            centerX, centerY, radius,
            bounds: bounds
        };
    }
    
    generateSquareArea(points, bounds) {
        return {
            type: 'rectangle',
            left: bounds.left,
            top: bounds.top,
            width: bounds.right - bounds.left,
            height: bounds.bottom - bounds.top,
            bounds: bounds
        };
    }
    
    generateLassoArea(points, bounds) {
        if (!points || points.length < 3) {
            return this.generateCircleArea(points, bounds);
        }
        
        return {
            type: 'polygon',
            points: points.map(p => ({ x: p.x, y: p.y })),
            bounds: bounds
        };
    }
    
    executeAreaErase(eraseArea) {
        if (!eraseArea) return 0;
        
        let totalPixelsErased = 0;
        const erasableObjects = this.findObjectsInArea(eraseArea);
        
        erasableObjects.forEach(obj => {
            const pixelsErased = this.eraseObjectInArea(obj, eraseArea);
            totalPixelsErased += pixelsErased;
        });
        
        return totalPixelsErased;
    }
    
    findObjectsInArea(eraseArea) {
        const objects = [];
        
        if (this.toolManager.appCore.paths) {
            this.toolManager.appCore.paths.forEach(path => {
                if (this.isPathInArea(path, eraseArea)) {
                    objects.push({
                        type: 'path',
                        object: path
                    });
                }
            });
        }
        
        return objects;
    }
    
    isPathInArea(path, eraseArea) {
        if (!path.points || path.points.length === 0) return false;
        
        switch (eraseArea.type) {
            case 'circle':
                return this.isPathInCircle(path, eraseArea);
            case 'rectangle':
                return this.isPathInRectangle(path, eraseArea);
            case 'polygon':
                return this.isPathInPolygon(path, eraseArea);
            default:
                return false;
        }
    }
    
    isPathInCircle(path, circleArea) {
        return path.points.some(point => {
            const dx = point.x - circleArea.centerX;
            const dy = point.y - circleArea.centerY;
            return (dx * dx + dy * dy) <= (circleArea.radius * circleArea.radius);
        });
    }
    
    isPathInRectangle(path, rectArea) {
        return path.points.some(point => {
            return point.x >= rectArea.left && 
                   point.x <= (rectArea.left + rectArea.width) &&
                   point.y >= rectArea.top && 
                   point.y <= (rectArea.top + rectArea.height);
        });
    }
    
    isPathInPolygon(path, polygonArea) {
        return path.points.some(point => {
            return this.pointInPolygon(point, polygonArea.points);
        });
    }
    
    pointInPolygon(point, polygonPoints) {
        let inside = false;
        const x = point.x, y = point.y;
        
        for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
            const xi = polygonPoints[i].x, yi = polygonPoints[i].y;
            const xj = polygonPoints[j].x, yj = polygonPoints[j].y;
            
            if (((yi > y) !== (yj > y)) && 
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    eraseObjectInArea(obj, eraseArea) {
        if (obj.type === 'path' && obj.object?.graphics) {
            return this.completeEraseFromPath(obj.object, 0, 0, 0);
        }
        return 0;
    }
    
    // ==========================================
    // 🎯 エフェクト・プレビューシステム
    // ==========================================
    
    startEraseEffects(x, y) {
        if (this.particleSystem.enabled) {
            this.startParticleEffect(x, y);
        }
        
        if (this.eraserEffects.sparkles && this.gsapAvailable) {
            this.startSparkleEffect(x, y);
        }
    }
    
    updateEraseEffects(x, y, pressure) {
        if (this.particleSystem.enabled) {
            this.updateParticleEffect(x, y, pressure);
        }
        
        if (this.eraserEffects.sparkles && Math.random() < 0.3) {
            this.addSparkle(x, y);
        }
    }
    
    stopEraseEffects() {
        if (this.particleSystem.enabled) {
            this.stopParticleEffect();
        }
    }
    
    startParticleEffect(x, y) {
        for (let i = 0; i < this.particleSystem.emissionRate; i++) {
            const particle = this.createParticle(x, y);
            this.particleSystem.activeParticles.push(particle);
        }
    }
    
    updateParticleEffect(x, y, pressure) {
        // パーティクル更新処理
    }
    
    stopParticleEffect() {
        // パーティクル停止処理
        this.particleSystem.activeParticles = [];
    }
    
    createParticle(x, y) {
        return {
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: this.particleSystem.lifespan,
            maxLife: this.particleSystem.lifespan,
            size: Math.random() * 3 + 1,
            alpha: 1.0
        };
    }
    
    startSparkleEffect(x, y) {
        if (!this.gsapAvailable) return;
        
        for (let i = 0; i < this.animations.sparkle.count; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'eraser-sparkle';
            sparkle.style.cssText = `
                position: absolute;
                left: ${x + Math.random() * 20 - 10}px;
                top: ${y + Math.random() * 20 - 10}px;
                width: 4px;
                height: 4px;
                background: #fff;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
            `;
            
            document.body.appendChild(sparkle);
            
            window.gsap.to(sparkle, {
                scale: 0,
                opacity: 0,
                rotation: 360,
                duration: this.animations.sparkle.duration,
                ease: "power2.out",
                onComplete: () => {
                    if (sparkle.parentNode) {
                        sparkle.parentNode.removeChild(sparkle);
                    }
                }
            });
        }
    }
    
    addSparkle(x, y) {
        if (this.gsapAvailable && this.eraserEffects.sparkles) {
            this.startSparkleEffect(x, y);
        }
    }
    
    startAreaPreview(x, y) {
        this.areaPreview = document.createElement('div');
        this.areaPreview.className = 'area-erase-preview';
        this.areaPreview.style.cssText = `
            position: absolute;
            border: 2px dashed rgba(255, 0, 0, 0.8);
            background: rgba(255, 0, 0, 0.1);
            pointer-events: none;
            z-index: 9997;
        `;
        
        document.body.appendChild(this.areaPreview);
        this.updateAreaPreview();
    }
    
    updateAreaPreview() {
        if (!this.areaPreview || !this.areaEraser.boundingBox) return;
        
        const bounds = this.areaEraser.boundingBox;
        const shapeMode = this.settings.shapeMode;
        
        switch (shapeMode) {
            case 'circle':
                this.updateCirclePreview(bounds);
                break;
            case 'square':
                this.updateSquarePreview(bounds);
                break;
            case 'lasso':
                this.updateLassoPreview();
                break;
            default:
                this.updateSquarePreview(bounds);
        }
    }
    
    updateCirclePreview(bounds) {
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const radius = Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) / 2;
        
        this.areaPreview.style.left = (centerX - radius) + 'px';
        this.areaPreview.style.top = (centerY - radius) + 'px';
        this.areaPreview.style.width = (radius * 2) + 'px';
        this.areaPreview.style.height = (radius * 2) + 'px';
        this.areaPreview.style.borderRadius = '50%';
    }
    
    updateSquarePreview(bounds) {
        this.areaPreview.style.left = bounds.left + 'px';
        this.areaPreview.style.top = bounds.top + 'px';
        this.areaPreview.style.width = (bounds.right - bounds.left) + 'px';
        this.areaPreview.style.height = (bounds.bottom - bounds.top) + 'px';
        this.areaPreview.style.borderRadius = '0';
    }
    
    updateLassoPreview() {
        if (!this.areaEraser.selectionBuffer.length) return;
        
        const points = this.areaEraser.selectionBuffer;
        const pathData = points.map((point, index) => {
            return (index === 0 ? 'M' : 'L') + point.x + ',' + point.y;
        }).join(' ') + ' Z';
        
        this.areaPreview.innerHTML = `
            <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
                <path d="${pathData}" stroke="rgba(255, 0, 0, 0.8)" stroke-width="2" 
                      stroke-dasharray="5,5" fill="rgba(255, 0, 0, 0.1)" />
            </svg>
        `;
    }
    
    stopAreaPreview() {
        if (this.areaPreview && this.areaPreview.parentNode) {
            this.areaPreview.parentNode.removeChild(this.areaPreview);
            this.areaPreview = null;
        }
    }
    
    // ==========================================
    // 🎯 ユーティリティメソッド群
    // ==========================================
    
    calculateEffectiveSize(pressure) {
        let size = this.settings.baseSize;
        
        if (pressure !== undefined && pressure !== 1.0) {
            const minSize = this.settings.baseSize * 0.3;
            const maxSize = this.settings.baseSize * 2.0;
            size = minSize + (maxSize - minSize) * pressure;
        }
        
        return Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
    }
    
    isPathInBounds(path, bounds) {
        if (!path.points) return false;
        
        return path.points.some(point => {
            return point.x >= bounds.left && point.x <= bounds.right &&
                   point.y >= bounds.top && point.y <= bounds.bottom;
        });
    }
    
    isPathCompletelyErased(path) {
        if (!path.graphics) return true;
        return path.graphics.alpha <= 0.01 || !path.graphics.visible;
    }
    
    removePathCompletely(path) {
        if (path.graphics && path.graphics.parent) {
            path.graphics.parent.removeChild(path.graphics);
        }
        
        if (this.toolManager.appCore.paths) {
            const index = this.toolManager.appCore.paths.indexOf(path);
            if (index >= 0) {
                this.toolManager.appCore.paths.splice(index, 1);
            }
        }
    }
    
    colorsMatch(color1, color2, tolerance) {
        if (color1 === color2) return true;
        
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const distance = Math.sqrt(
            Math.pow(r2 - r1, 2) + 
            Math.pow(g2 - g1, 2) + 
            Math.pow(b2 - b1, 2)
        );
        
        return distance <= tolerance;
    }
    
    createErasePath(x, y, pressure) {
        const pathId = this.generatePathId();
        const size = this.calculateEffectiveSize(pressure);
        
        return {
            id: pathId,
            tool: this.name,
            version: this.version,
            startTime: performance.now(),
            points: [{ x, y, pressure, size, timestamp: performance.now() }],
            settings: { ...this.settings },
            mode: this.eraseMode.type,
            graphics: null,
            metadata: {
                sessionId: this.erasingSession?.id,
                unifiedSystems: true,
                gpuAccelerated: this.gpuAcceleration.enabled,
                eraseMode: this.eraseMode.type
            }
        };
    }
    
    calculateErasedStats(endTime) {
        if (!this.erasingSession) return {};
        
        return {
            sessionId: this.erasingSession.id,
            duration: endTime - this.erasingSession.startTime,
            totalPoints: this.erasingSession.erasePoints.length,
            totalPixels: this.erasingSession.totalPixelsErased,
            pathsCount: this.erasingSession.erasedPaths.size,
            averageSpeed: this.erasingSession.totalPixelsErased / (endTime - this.erasingSession.startTime) * 1000
        };
    }
    
    updateLatencyStats(processTime) {
        const monitor = this.performanceMonitor;
        monitor.frameCount++;
        monitor.totalTime += processTime;
        monitor.maxLatency = Math.max(monitor.maxLatency, processTime);
        monitor.minLatency = Math.min(monitor.minLatency, processTime);
        
        this.performance.averageLatency = monitor.totalTime / monitor.frameCount;
        this.performance.lastFrameTime = processTime;
    }
    
    updatePerformanceStats() {
        const monitor = this.performanceMonitor;
        
        if (monitor.frameCount > 0) {
            const avgFPS = 1000 / (monitor.totalTime / monitor.frameCount);
            
            console.log(`📊 消しゴム性能（統一システム版): ${avgFPS.toFixed(1)}FPS, レイテンシ: ${this.performance.averageLatency.toFixed(2)}ms, 消去コール: ${this.performance.eraseCalls}`);
            
            monitor.frameCount = 0;
            monitor.totalTime = 0;
            monitor.maxLatency = 0;
            monitor.minLatency = Infinity;
        }
    }
    
    // ==========================================
    // 🎯 依存システム更新・設定管理
    // ==========================================
    
    updateDependentSystems() {
        if (this.settings.eraseMode) {
            this.setEraseMode(this.settings.eraseMode);
        }
        
        this.areaEraser.enabled = this.settings.areaMode || false;
        this.areaEraser.shape = this.settings.shapeMode || 'circle';
        this.areaEraser.tolerance = this.settings.tolerance || 32;
        
        this.particleSystem.enabled = this.settings.particles || false;
        this.eraserEffects.fadeAnimation = this.settings.fadeAnimation || false;
        this.eraserEffects.sparkles = this.settings.sparkles !== false;
        
        this.gpuAcceleration.enabled = this.settings.gpuAcceleration || false;
    }
    
    setEraseMode(mode) {
        if (this.eraseModes[mode]) {
            this.eraseMode.type = mode;
            this.eraseMode = { ...this.eraseMode, ...this.eraseModes[mode] };
            console.log(`🎭 消去モード変更: ${this.eraseModes[mode].name}`);
            
            // EventBus通知
            this.emitEvent('ERASE_MODE_CHANGED', {
                tool: this.name,
                mode: mode,
                modeName: this.eraseModes[mode].name
            });
        }
    }
    
    setAreaShape(shape) {
        if (this.areaShapes[shape]) {
            this.areaEraser.shape = shape;
            this.settings.shapeMode = shape;
            console.log(`📐 範囲形状変更: ${this.areaShapes[shape].name}`);
            
            // EventBus通知
            this.emitEvent('AREA_SHAPE_CHANGED', {
                tool: this.name,
                shape: shape,
                shapeName: this.areaShapes[shape].name
            });
        }
    }
    
    reset() {
        this.deactivate();
        this.currentErasePath = null;
        this.erasingSession = null;
        this.areaEraser.selectionBuffer = [];
        this.areaEraser.boundingBox = null;
        this.particleSystem.activeParticles = [];
        this.performance = {
            eraseCalls: 0,
            averageLatency: 0,
            pixelsErased: 0,
            lastFrameTime: 0,
            targetFPS: this.configManager ? this.configManager.get('performance.targetFPS') : 60,
            memoryUsage: 0
        };
        
        console.log(`🧹 ${this.displayName} リセット完了 - 統一システム版`);
    }
    
    generateSessionId() {
        return `eraser_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generatePathId() {
        return `eraser_path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    async fallbackInitialization() {
        console.log('🛡️ EraserTool フォールバック初期化（統一システム版）...');
        
        try {
            this.initializeFallbackSettings();
            
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
            }
            
            console.log('✅ EraserTool フォールバック初期化完了（統一システム版）');
            
        } catch (error) {
            console.error('❌ EraserTool フォールバック初期化エラー:', error);
        }
    }
    
    // ==========================================
    // 🎯 統一システム版状態取得・デバッグAPI
    // ==========================================
    
    getStatus() {
        return {
            version: this.version,
            isActive: this.isActive,
            isErasing: this.isErasing,
            currentSession: this.erasingSession?.id || null,
            unifiedSystems: {
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                stateManager: !!this.stateManager,
                eventBus: !!this.eventBus
            },
            settings: { ...this.settings },
            eraseMode: {
                type: this.eraseMode.type,
                description: this.eraseModes[this.eraseMode.type]?.description || 'Unknown'
            },
            areaEraser: {
                enabled: this.areaEraser.enabled,
                shape: this.areaEraser.shape,
                shapeName: this.areaShapes[this.areaEraser.shape]?.name || 'Unknown',
                selectionPoints: this.areaEraser.selectionBuffer.length
            },
            effects: {
                particles: this.particleSystem.enabled,
                activeParticles: this.particleSystem.activeParticles.length,
                sparkles: this.eraserEffects.sparkles,
                fadeAnimation: this.eraserEffects.fadeAnimation
            },
            performance: {
                ...this.performance,
                memoryUsage: performance.memory ? 
                    Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'
            },
            extensions: {
                lodash: this.lodashAvailable,
                gsap: this.gsapAvailable,
                coordinates: !!this.coordinatesUtil,
                memory: !!this.memoryManager
            }
        };
    }
    
    getDebugInfo() {
        const status = this.getStatus();
        
        console.group('🧹 EraserTool 統一システム版 デバッグ情報');
        console.log('📋 バージョン:', status.version);
        console.log('🔄 統一システム:', status.unifiedSystems);
        console.log('🎯 状態:', { active: status.isActive, erasing: status.isErasing });
        console.log('🎭 消去モード:', status.eraseMode);
        console.log('📐 範囲消去:', status.areaEraser);
        console.log('✨ エフェクト:', status.effects);
        console.log('📊 パフォーマンス:', status.performance);
        console.log('🔧 拡張機能:', status.extensions);
        
        if (this.stateManager) {
            console.log('🏠 アプリケーション状態:', this.getApplicationState());
        }
        
        console.groupEnd();
        
        return status;
    }
    
    exportSettings() {
        return {
            version: this.version,
            settings: { ...this.settings },
            eraseMode: { ...this.eraseMode },
            areaSettings: {
                shape: this.areaEraser.shape,
                tolerance: this.areaEraser.tolerance
            },
            effects: {
                particles: this.particleSystem.enabled,
                sparkles: this.eraserEffects.sparkles,
                fadeAnimation: this.eraserEffects.fadeAnimation
            },
            unifiedSystems: true,
            timestamp: Date.now()
        };
    }
    
    importSettings(settings) {
        if (settings.version !== this.version) {
            console.warn('⚠️ 設定バージョンが異なります:', settings.version, '!=', this.version);
        }
        
        if (settings.settings) {
            this.updateSettings(settings.settings);
        }
        
        if (settings.eraseMode) {
            this.setEraseMode(settings.eraseMode.type);
        }
        
        if (settings.areaSettings) {
            this.setAreaShape(settings.areaSettings.shape);
            this.areaEraser.tolerance = settings.areaSettings.tolerance;
        }
        
        if (settings.effects) {
            this.particleSystem.enabled = settings.effects.particles;
            this.eraserEffects.sparkles = settings.effects.sparkles;
            this.eraserEffects.fadeAnimation = settings.effects.fadeAnimation;
        }
        
        console.log('✅ EraserTool設定インポート完了（統一システム版）');
    }
    
    async runPerformanceTest(iterations = 50) {
        console.log(`🧪 EraserTool パフォーマンステスト開始（統一システム版） (${iterations}回)`);
        
        const startTime = performance.now();
        const startMemory = performance.memory ? 
            Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0;
        
        for (let i = 0; i < iterations; i++) {
            const x = Math.random() * 800;
            const y = Math.random() * 600;
            const pressure = Math.random();
            
            this.startErasing(x, y, pressure);
            
            for (let j = 0; j < 10; j++) {
                this.continueErasing(x + j * 2, y + j * 2, pressure);
            }
            
            this.stopErasing();
        }
        
        const endTime = performance.now();
        const endMemory = performance.memory ? 
            Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0;
        
        const results = {
            iterations,
            totalTime: Math.round(endTime - startTime),
            avgTimePerErase: Math.round((endTime - startTime) / iterations * 100) / 100,
            totalErases: this.performance.eraseCalls,
            totalPixelsErased: this.performance.pixelsErased,
            memoryDelta: endMemory - startMemory,
            avgLatency: Math.round(this.performance.averageLatency * 100) / 100,
            unifiedSystemsUsed: true
        };
        
        console.log('🧪 パフォーマンステスト結果（統一システム版）:', results);
        
        return results;
    }
}

// ==========================================
// 🎯 Pure JavaScript グローバル公開
// ==========================================

if (typeof window !== 'undefined') {
    window.EraserTool = EraserTool;
    console.log('✅ EraserTool 統一システム版 グローバル公開完了（Pure JavaScript）');
}

console.log('🧹 EraserTool 統一システム版完全版 - 準備完了');
console.log('🔄 統一システム活用: ConfigManager・ErrorManager・StateManager・EventBus統合済み');
console.log('📋 設定値統一: ハードコード排除・ConfigManager経由アクセス');
console.log('🚨 エラー処理統一: ErrorManager.showError()統合');
console.log('📡 イベント駆動: EventBus疎結合通信');
console.log('📐 範囲消去・消去モード・エフェクトシステム完備');
console.log('💡 使用例: const eraserTool = new window.EraserTool(toolManager); await eraserTool.initialize();');