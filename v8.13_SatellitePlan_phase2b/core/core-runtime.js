/**
 * Core Runtime (Phase2)
 * PixiJS v8.13 対応版
 * ランタイムユーティリティとグローバル管理
 */
(function() {
    'use strict';

    class TegakiRuntime {
        constructor() {
            this.version = '2.0.0-Phase2';
            this.startTime = Date.now();
            this.isInitialized = false;
            this.modules = new Map();
            this.eventBus = new EventTarget();
            this.performanceMonitor = null;
        }

        /**
         * 初期化
         */
        initialize() {
            console.log('🚀 TegakiRuntime initialization started');
            
            try {
                this.setupGlobalErrorHandling();
                this.initializePerformanceMonitor();
                this.setupModuleSystem();
                
                this.isInitialized = true;
                this.emit('runtime:initialized');
                
                console.log('✅ TegakiRuntime initialized');
                return true;
            } catch (error) {
                console.error('❌ TegakiRuntime initialization failed:', error);
                return false;
            }
        }

        /**
         * グローバルエラーハンドリング設定
         */
        setupGlobalErrorHandling() {
            // 既存のハンドラーを保存
            const originalErrorHandler = window.onerror;
            const originalRejectionHandler = window.onunhandledrejection;
            
            window.onerror = (message, source, lineno, colno, error) => {
                this.handleError('JavaScript Error', {
                    message, source, lineno, colno, error
                });
                
                // 元のハンドラーも実行
                if (originalErrorHandler) {
                    originalErrorHandler.call(window, message, source, lineno, colno, error);
                }
                
                return true; // エラーを処理済みとしてマーク
            };
            
            window.onunhandledrejection = (event) => {
                this.handleError('Unhandled Promise Rejection', {
                    reason: event.reason,
                    promise: event.promise
                });
                
                // 元のハンドラーも実行
                if (originalRejectionHandler) {
                    originalRejectionHandler.call(window, event);
                }
                
                event.preventDefault(); // デフォルトの処理を停止
            };
        }

        /**
         * エラーハンドリング
         */
        handleError(type, details) {
            const errorInfo = {
                type,
                details,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            // コンソール出力
            console.error(`[TegakiRuntime] ${type}:`, details);
            
            // エラーイベント発火
            this.emit('runtime:error', errorInfo);
        }

        /**
         * パフォーマンスモニター初期化
         */
        initializePerformanceMonitor() {
            this.performanceMonitor = {
                frameCount: 0,
                lastFPSUpdate: Date.now(),
                currentFPS: 0,
                memoryUsage: 0,
                startTime: Date.now()
            };
            
            // FPS計測
            this.startFPSMonitoring();
        }

        /**
         * FPS監視開始
         */
        startFPSMonitoring() {
            const updateFPS = () => {
                this.performanceMonitor.frameCount++;
                
                const now = Date.now();
                const elapsed = now - this.performanceMonitor.lastFPSUpdate;
                
                if (elapsed >= 1000) { // 1秒ごとに更新
                    this.performanceMonitor.currentFPS = Math.round(
                        (this.performanceMonitor.frameCount * 1000) / elapsed
                    );
                    this.performanceMonitor.frameCount = 0;
                    this.performanceMonitor.lastFPSUpdate = now;
                    
                    // メモリ使用量取得（可能な場合）
                    if (performance.memory) {
                        this.performanceMonitor.memoryUsage = Math.round(
                            performance.memory.usedJSHeapSize / 1024 / 1024
                        );
                    }
                    
                    this.emit('runtime:performance-update', {
                        fps: this.performanceMonitor.currentFPS,
                        memory: this.performanceMonitor.memoryUsage
                    });
                }
                
                requestAnimationFrame(updateFPS);
            };
            
            requestAnimationFrame(updateFPS);
        }

        /**
         * モジュールシステム設定
         */
        setupModuleSystem() {
            this.modules.set('config', window.CONFIG);
            this.modules.set('coordinateSystem', window.CoordinateSystem);
            console.log('✅ Module system initialized');
        }

        /**
         * モジュール登録
         */
        registerModule(name, module) {
            if (this.modules.has(name)) {
                console.warn(`⚠️ Module '${name}' is already registered`);
            }
            
            this.modules.set(name, module);
            this.emit('runtime:module-registered', { name, module });
            console.log(`✅ Module '${name}' registered`);
        }

        /**
         * モジュール取得
         */
        getModule(name) {
            return this.modules.get(name);
        }

        /**
         * イベント発火
         */
        emit(eventType, data = null) {
            const event = new CustomEvent(eventType, { detail: data });
            this.eventBus.dispatchEvent(event);
        }

        /**
         * イベントリスナー追加
         */
        on(eventType, listener) {
            this.eventBus.addEventListener(eventType, listener);
        }

        /**
         * イベントリスナー削除
         */
        off(eventType, listener) {
            this.eventBus.removeEventListener(eventType, listener);
        }

        /**
         * システム情報取得
         */
        getSystemInfo() {
            return {
                version: this.version,
                uptime: Date.now() - this.startTime,
                initialized: this.isInitialized,
                moduleCount: this.modules.size,
                performance: { ...this.performanceMonitor },
                environment: {
                    userAgent: navigator.userAgent,
                    pixelRatio: window.devicePixelRatio,
                    screenSize: {
                        width: window.screen.width,
                        height: window.screen.height
                    },
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    memory: performance.memory ? {
                        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                    } : null
                }
            };
        }

        /**
         * パフォーマンス情報取得
         */
        getPerformanceInfo() {
            return { ...this.performanceMonitor };
        }

        /**
         * メモリクリーンアップ
         */
        cleanup() {
            // PixiJSのテクスチャーキャッシュクリア
            if (window.PIXI && PIXI.utils && PIXI.utils.TextureCache) {
                const textureCache = PIXI.utils.TextureCache;
                Object.keys(textureCache).forEach(key => {
                    if (textureCache[key] && textureCache[key].destroy) {
                        textureCache[key].destroy(true);
                    }
                    delete textureCache[key];
                });
            }
            
            // Garbage Collection強制実行（可能な場合）
            if (window.gc) {
                window.gc();
            }
            
            this.emit('runtime:cleanup');
            console.log('✅ Runtime cleanup completed');
        }

        /**
         * デバッグ情報出力
         */
        debug() {
            const info = this.getSystemInfo();
            console.group('🔍 TegakiRuntime Debug Info');
            console.log('Version:', info.version);
            console.log('Uptime:', Math.round(info.uptime / 1000), 'seconds');
            console.log('Modules:', Array.from(this.modules.keys()));
            console.log('Performance:', info.performance);
            console.log('Environment:', info.environment);
            console.groupEnd();
        }

        /**
         * 破棄処理
         */
        destroy() {
            // クリーンアップ実行
            this.cleanup();
            
            // イベントリスナー全削除
            this.eventBus.removeEventListener('*', () => {});
            
            // モジュールクリア
            this.modules.clear();
            
            // 状態リセット
            this.isInitialized = false;
            
            console.log('✅ TegakiRuntime destroyed');
        }
    }

    /**
     * ユーティリティ関数群
     */
    const Utils = {
        /**
         * 深いオブジェクトコピー
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj);
            if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
            if (typeof obj === 'object') {
                const cloned = {};
                Object.keys(obj).forEach(key => {
                    cloned[key] = Utils.deepClone(obj[key]);
                });
                return cloned;
            }
        },

        /**
         * デバウンス関数
         */
        debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        /**
         * スロットル関数
         */
        throttle(func, delay) {
            let lastCall = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    return func.apply(this, args);
                }
            };
        },

        /**
         * UUID生成（簡易版）
         */
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        /**
         * 数値の範囲制限
         */
        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        },

        /**
         * 線形補間
         */
        lerp(start, end, t) {
            return start + (end - start) * t;
        },

        /**
         * 配列のシャッフル
         */
        shuffle(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        },

        /**
         * カラーコード変換
         */
        hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },

        /**
         * RGB to Hex変換
         */
        rgbToHex(r, g, b) {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        },

        /**
         * ファイルサイズフォーマット
         */
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        /**
         * 時間フォーマット
         */
        formatTime(ms) {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) {
                return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            } else if (minutes > 0) {
                return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
            } else {
                return `${seconds}s`;
            }
        },

        /**
         * プロミスタイムアウト
         */
        promiseTimeout(promise, ms) {
            return Promise.race([
                promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Promise timeout')), ms)
                )
            ]);
        },

        /**
         * 非同期スリープ
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * エラー情報抽出
         */
        extractErrorInfo(error) {
            return {
                name: error.name || 'Error',
                message: error.message || 'Unknown error',
                stack: error.stack || null,
                timestamp: Date.now()
            };
        }
    };

    /**
     * パフォーマンス測定ヘルパー
     */
    const Performance = {
        /**
         * 実行時間測定
         */
        async measure(name, func) {
            const start = performance.now();
            try {
                const result = await func();
                const end = performance.now();
                console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
                return result;
            } catch (error) {
                const end = performance.now();
                console.error(`[Performance] ${name} failed after ${(end - start).toFixed(2)}ms:`, error);
                throw error;
            }
        },

        /**
         * メモリ使用量取得
         */
        getMemoryUsage() {
            if (performance.memory) {
                return {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }
            return null;
        },

        /**
         * FPS計算
         */
        createFPSCounter() {
            let frames = 0;
            let lastTime = performance.now();
            let fps = 0;
            
            return {
                update() {
                    frames++;
                    const now = performance.now();
                    if (now >= lastTime + 1000) {
                        fps = Math.round((frames * 1000) / (now - lastTime));
                        frames = 0;
                        lastTime = now;
                    }
                    return fps;
                },
                
                getFPS() {
                    return fps;
                }
            };
        }
    };

    // ランタイムインスタンス作成
    const runtime = new TegakiRuntime();
    
    // グローバル公開
    window.TegakiRuntime = runtime;
    window.TegakiUtils = Utils;
    window.TegakiPerformance = Performance;

    // 自動初期化
    if (runtime.initialize()) {
        console.log('✅ core-runtime.js loaded');
    }
})();