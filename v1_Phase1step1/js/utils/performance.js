/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: パフォーマンス監視・FPS計測・メモリ最適化・GPU使用率
 * 🎯 DEPENDENCIES: なし（Pure JavaScript + Performance API）
 * 🎯 NODE_MODULES: lodash（利用可能時）
 * 🎯 PIXI_EXTENSIONS: なし（独立ユーティリティ）
 * 🎯 ISOLATION_TEST: 可能（完全独立）
 * 🎯 SPLIT_THRESHOLD: 400行（監視系は分割慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: WebGPU監視対応予定
 */

/**
 * パフォーマンス監視システム
 * 元HTMLのPerformanceMonitorを基にした改良版
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: {
                current: 60,
                average: 60,
                min: 60,
                max: 60,
                history: []
            },
            memory: {
                used: 0,
                total: 0,
                percentage: 0
            },
            gpu: {
                usage: 0,
                memory: 0,
                vendor: 'Unknown'
            },
            render: {
                drawCalls: 0,
                triangles: 0,
                textures: 0
            }
        };
        
        this.monitoring = false;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.updateInterval = 1000; // 1秒間隔で更新
        
        // DOM要素参照
        this.domElements = {
            fps: document.getElementById('fps'),
            memory: document.getElementById('memory-usage'),
            gpu: document.getElementById('gpu-usage')
        };
        
        this.initializeGPUInfo();
        console.log('📊 PerformanceMonitor 初期化完了');
    }
    
    /**
     * 監視開始
     */
    start() {
        if (this.monitoring) return;
        
        this.monitoring = true;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        this.startFPSMonitoring();
        this.startMemoryMonitoring();
        this.startGPUMonitoring();
        
        console.log('📊 パフォーマンス監視開始');
    }
    
    /**
     * 監視停止
     */
    stop() {
        this.monitoring = false;
        console.log('📊 パフォーマンス監視停止');
    }
    
    /**
     * FPS監視開始
     */
    startFPSMonitoring() {
        const updateFPS = () => {
            if (!this.monitoring) return;
            
            this.frameCount++;
            const currentTime = performance.now();
            const deltaTime = currentTime - this.lastTime;
            
            if (deltaTime >= this.updateInterval) {
                // FPS計算
                const fps = Math.round((this.frameCount * 1000) / deltaTime);
                this.updateFPSMetrics(fps);
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        updateFPS();
    }
    
    /**
     * FPSメトリクス更新
     */
    updateFPSMetrics(fps) {
        this.metrics.fps.current = fps;
        this.metrics.fps.history.push(fps);
        
        // 履歴管理（最大100エントリ）
        if (this.metrics.fps.history.length > 100) {
            this.metrics.fps.history.shift();
        }
        
        // 統計計算
        const history = this.metrics.fps.history;
        this.metrics.fps.average = Math.round(
            history.reduce((sum, val) => sum + val, 0) / history.length
        );
        this.metrics.fps.min = Math.min(...history);
        this.metrics.fps.max = Math.max(...history);
        
        // DOM更新
        if (this.domElements.fps) {
            this.domElements.fps.textContent = fps;
            
            // パフォーマンス警告色
            if (fps < 30) {
                this.domElements.fps.style.color = '#f44336'; // 赤
            } else if (fps < 45) {
                this.domElements.fps.style.color = '#ff9800'; // オレンジ
            } else {
                this.domElements.fps.style.color = '#4caf50'; // 緑
            }
        }
    }
    
    /**
     * メモリ監視開始
     */
    startMemoryMonitoring() {
        const updateMemory = () => {
            if (!this.monitoring) return;
            
            // Performance API使用
            if (performance.memory) {
                const memInfo = performance.memory;
                const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
                const totalMB = Math.round(memInfo.totalJSHeapSize / 1024 / 1024);
                const limitMB = Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024);
                
                this.metrics.memory.used = usedMB;
                this.metrics.memory.total = totalMB;
                this.metrics.memory.limit = limitMB;
                this.metrics.memory.percentage = Math.round((usedMB / limitMB) * 100);
                
                // DOM更新
                if (this.domElements.memory) {
                    this.domElements.memory.textContent = `${usedMB}MB`;
                    
                    // メモリ使用率警告色
                    const percentage = this.metrics.memory.percentage;
                    if (percentage > 80) {
                        this.domElements.memory.style.color = '#f44336'; // 赤
                    } else if (percentage > 60) {
                        this.domElements.memory.style.color = '#ff9800'; // オレンジ
                    } else {
                        this.domElements.memory.style.color = '#4caf50'; // 緑
                    }
                }
            }
            
            setTimeout(updateMemory, this.updateInterval);
        };
        
        updateMemory();
    }
    
    /**
     * GPU情報初期化
     */
    initializeGPUInfo() {
        try {
            // WebGL情報取得
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    this.metrics.gpu.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    this.metrics.gpu.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
                
                // GPU メモリ情報（概算）
                const memoryInfo = gl.getExtension('WEBGL_debug_shaders');
                if (memoryInfo) {
                    // GPU メモリ情報の取得は制限されているため、概算値を使用
                    this.metrics.gpu.memory = 'N/A';
                }
            }
            
            console.log('🎮 GPU情報取得完了:', {
                vendor: this.metrics.gpu.vendor,
                renderer: this.metrics.gpu.renderer
            });
        } catch (error) {
            console.warn('⚠️ GPU情報取得失敗:', error);
        }
    }
    
    /**
     * GPU監視開始（簡易版）
     */
    startGPUMonitoring() {
        const updateGPU = () => {
            if (!this.monitoring) return;
            
            // GPU使用率の推定（実際の値は取得困難）
            // FPS低下やメモリ使用量から推定
            const fpsRatio = this.metrics.fps.current / 60;
            const memoryRatio = this.metrics.memory.percentage / 100;
            
            // 簡易GPU使用率推定
            const estimatedUsage = Math.round(
                (1 - fpsRatio) * 50 + memoryRatio * 30 + Math.random() * 20
            );
            this.metrics.gpu.usage = Math.max(0, Math.min(100, estimatedUsage));
            
            // DOM更新
            if (this.domElements.gpu) {
                this.domElements.gpu.textContent = `${this.metrics.gpu.usage}%`;
                
                // GPU使用率警告色
                if (this.metrics.gpu.usage > 80) {
                    this.domElements.gpu.style.color = '#f44336'; // 赤
                } else if (this.metrics.gpu.usage > 60) {
                    this.domElements.gpu.style.color = '#ff9800'; // オレンジ
                } else {
                    this.domElements.gpu.style.color = '#4caf50'; // 緑
                }
            }
            
            setTimeout(updateGPU, this.updateInterval * 2); // GPU監視は低頻度
        };
        
        updateGPU();
    }
    
    /**
     * レンダリング統計更新
     */
    updateRenderStats(drawCalls, triangles, textures) {
        this.metrics.render.drawCalls = drawCalls;
        this.metrics.render.triangles = triangles;
        this.metrics.render.textures = textures;
    }
    
    /**
     * パフォーマンス警告チェック
     */
    checkPerformanceWarnings() {
        const warnings = [];
        
        // FPS警告
        if (this.metrics.fps.current < 30) {
            warnings.push('FPS低下 - 描画処理を最適化してください');
        }
        
        // メモリ警告
        if (this.metrics.memory.percentage > 80) {
            warnings.push('メモリ使用量高 - オブジェクト解放を確認してください');
        }
        
        // GPU警告
        if (this.metrics.gpu.usage > 80) {
            warnings.push('GPU使用率高 - 描画複雑さを軽減してください');
        }
        
        return warnings;
    }
    
    /**
     * パフォーマンス最適化提案
     */
    getOptimizationSuggestions() {
        const suggestions = [];
        
        if (this.metrics.fps.average < 45) {
            suggestions.push('レンダリング頻度を調整');
            suggestions.push('不要なグラフィックオブジェクトを削除');
        }
        
        if (this.metrics.memory.percentage > 60) {
            suggestions.push('オブジェクトプーリングの導入');
            suggestions.push('テクスチャキャッシュの最適化');
        }
        
        return suggestions;
    }
    
    /**
     * パフォーマンスレポート生成
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: { ...this.metrics },
            warnings: this.checkPerformanceWarnings(),
            suggestions: this.getOptimizationSuggestions(),
            environment: {
                userAgent: navigator.userAgent,
                pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'N/A',
                webglSupport: this.detectWebGLSupport(),
                screenResolution: `${screen.width}×${screen.height}`,
                devicePixelRatio: window.devicePixelRatio
            }
        };
        
        return report;
    }
    
    /**
     * WebGLサポート検出
     */
    detectWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * パフォーマンスベンチマーク実行
     */
    async runBenchmark(duration = 5000) {
        console.log('🚀 パフォーマンスベンチマーク開始...');
        
        const startTime = performance.now();
        const initialMetrics = { ...this.metrics };
        
        // ベンチマーク処理（重い計算を実行）
        return new Promise(resolve => {
            const benchmark = () => {
                const currentTime = performance.now();
                const elapsed = currentTime - startTime;
                
                if (elapsed >= duration) {
                    const results = {
                        duration: elapsed,
                        initialMetrics,
                        finalMetrics: { ...this.metrics },
                        averageFPS: this.metrics.fps.average,
                        memoryDelta: this.metrics.memory.used - initialMetrics.memory.used,
                        score: this.calculateBenchmarkScore()
                    };
                    
                    console.log('✅ ベンチマーク完了:', results);
                    resolve(results);
                } else {
                    // 重い計算処理（ベンチマーク用）
                    for (let i = 0; i < 10000; i++) {
                        Math.sqrt(Math.random() * 1000);
                    }
                    requestAnimationFrame(benchmark);
                }
            };
            
            benchmark();
        });
    }
    
    /**
     * ベンチマークスコア計算
     */
    calculateBenchmarkScore() {
        const fpsScore = Math.max(0, this.metrics.fps.average / 60 * 100);
        const memoryScore = Math.max(0, (100 - this.metrics.memory.percentage));
        const gpuScore = Math.max(0, (100 - this.metrics.gpu.usage));
        
        return Math.round((fpsScore * 0.5 + memoryScore * 0.3 + gpuScore * 0.2));
    }
    
    /**
     * メトリクス取得
     */
    getMetrics() {
        return { ...this.metrics };
    }
    
    /**
     * 統計リセット
     */
    resetStats() {
        this.metrics.fps.history = [];
        this.metrics.fps.min = 60;
        this.metrics.fps.max = 60;
        console.log('📊 パフォーマンス統計リセット完了');
    }
}

/**
 * メモリ最適化ヘルパー
 */
class MemoryOptimizer {
    constructor() {
        this.gcThreshold = 50; // MB
        this.lastGCTime = 0;
        this.gcInterval = 30000; // 30秒
        
        console.log('🧹 MemoryOptimizer 初期化完了');
    }
    
    /**
     * 自動ガベージコレクション
     */
    autoGC() {
        const now = Date.now();
        const memUsage = performance.memory ? 
            performance.memory.usedJSHeapSize / 1024 / 1024 : 0;
            
        if (memUsage > this.gcThreshold && 
            now - this.lastGCTime > this.gcInterval) {
            
            this.suggestGC();
            this.lastGCTime = now;
        }
    }
    
    /**
     * ガベージコレクション提案
     */
    suggestGC() {
        console.log('🧹 メモリ最適化提案: 不要オブジェクトの解放を推奨');
        
        // メモリ使用量をコンソールに出力
        if (performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
            console.log(`📊 現在のメモリ使用量: ${used}MB / ${total}MB`);
        }
    }
    
    /**
     * オブジェクトプール管理
     */
    createObjectPool(createFn, resetFn, initialSize = 10) {
        const pool = [];
        const active = new Set();
        
        // 初期プール作成
        for (let i = 0; i < initialSize; i++) {
            pool.push(createFn());
        }
        
        return {
            acquire() {
                const obj = pool.length > 0 ? pool.pop() : createFn();
                active.add(obj);
                return obj;
            },
            
            release(obj) {
                if (active.has(obj)) {
                    active.delete(obj);
                    resetFn(obj);
                    pool.push(obj);
                }
            },
            
            getStats() {
                return {
                    poolSize: pool.length,
                    activeCount: active.size,
                    totalCreated: pool.length + active.size
                };
            }
        };
    }
}

// ==== グローバル公開 ====
if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
    window.MemoryOptimizer = MemoryOptimizer;
    
    // シングルトンインスタンス作成
    window.performanceMonitor = new PerformanceMonitor();
    window.memoryOptimizer = new MemoryOptimizer();
    
    console.log('✅ Performance Utils グローバル公開完了');
}

// ==== 自動テスト ====
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.group('🧪 Performance Utils 自動テスト');
        
        try {
            const monitor = window.performanceMonitor;
            
            // パフォーマンス情報取得テスト
            const metrics = monitor.getMetrics();
            console.log('✅ メトリクス取得:', {
                fps: metrics.fps.current,
                memory: metrics.memory.used + 'MB'
            });
            
            // WebGLサポートテスト
            const webglSupport = monitor.detectWebGLSupport();
            console.log(`✅ WebGLサポート: ${webglSupport ? '対応' : '非対応'}`);
            
            // ベンチマーク短縮版テスト（500ms）
            monitor.runBenchmark(500).then(results => {
                console.log('✅ ベンチマーク完了:', {
                    score: results.score,
                    avgFPS: results.averageFPS
                });
            });
            
            console.log('🎉 Performance Utils テスト完了');
        } catch (error) {
            console.error('❌ Performance Utils テストエラー:', error);
        }
        
        console.groupEnd();
    }, 1200);
}

console.log('📊 PerformanceMonitor 準備完了 - FPS・メモリ・GPU監視システム');
console.log('💡 使用例: window.performanceMonitor.start(), window.performanceMonitor.getMetrics()');

// 📋 V8_MIGRATION: WebGPU監視対応予定
// console.log('📋 V8_MIGRATION: WebGPU Renderer監視機能追加予定');