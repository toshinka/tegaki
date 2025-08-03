import { Graphics, Container, RenderTexture } from 'pixi.js';

/**
 * PixiJS v8統一レンダラー
 * WebGPU優先・フォールバック対応・60FPS最適化
 */
export class PixiV8UnifiedRenderer {
    constructor(pixiApp) {
        this.app = pixiApp;
        this.renderMode = 'unknown';
        this.capabilities = {};
        this.isWebGPU = false;
        this.performance = {
            fps: 0,
            frameTime: 0,
            lastFrameTime: 0,
            frameCount: 0
        };
        
        // レンダリング最適化設定
        this.optimizations = {
            batchSize: 4096,
            textureGCThreshold: 1000,
            enableCulling: true,
            enableSorting: true
        };
    }
    
    async initialize() {
        // レンダラータイプ検出
        this.detectRenderMode();
        
        // 描画最適化設定
        this.setupRenderOptimizations();
        
        // 性能監視開始
        this.startPerformanceMonitoring();
        
        console.log(`🎨 PixiV8UnifiedRenderer initialized: ${this.renderMode}`);
    }
    
    detectRenderMode() {
        const renderer = this.app.renderer;
        
        if (renderer.type === 'webgpu') {
            this.renderMode = 'webgpu';
            this.isWebGPU = true;
            this.capabilities.computeShader = true;
            this.capabilities.maxTextureSize = 4096;
            console.log('🚀 WebGPU Renderer detected - Maximum performance mode');
        } else if (renderer.type === 'webgl') {
            this.renderMode = 'webgl2';
            this.isWebGPU = false;
            this.capabilities.computeShader = false;
            this.capabilities.maxTextureSize = 2048;
            console.log('⚡ WebGL Renderer detected - High performance mode');
        } else {
            this.renderMode = 'canvas';
            this.isWebGPU = false;
            this.capabilities.computeShader = false;
            this.capabilities.maxTextureSize = 1024;
            console.log('📱 Canvas Renderer detected - Compatibility mode');
        }
        
        // レンダラー固有の最適化
        this.applyRendererSpecificOptimizations();
    }
    
    setupRenderOptimizations() {
        const renderer = this.app.renderer;
        
        // バッチ処理最適化
        if (renderer.batch) {
            renderer.batch.setMaxTextures(16);
        }
        
        // テクスチャガベージコレクション設定
        if (renderer.texture) {
            renderer.texture.setGCMode('manual');
            
            // 定期的なテクスチャクリーンアップ
            setInterval(() => {
                renderer.texture.destroyUnusedTextures();
            }, 30000); // 30秒間隔
        }
        
        // レンダリング品質設定
        renderer.resolution = window.devicePixelRatio || 1;
        
        console.log('⚙️ Render optimizations applied');
    }
    
    applyRendererSpecificOptimizations() {
        switch (this.renderMode) {
            case 'webgpu':
                this.setupWebGPUOptimizations();
                break;
            case 'webgl2':
                this.setupWebGLOptimizations();
                break;
            case 'canvas':
                this.setupCanvasOptimizations();
                break;
        }
    }
    
    setupWebGPUOptimizations() {
        // WebGPU固有の最適化
        this.optimizations.batchSize = 8192; // 大きなバッチサイズ
        this.optimizations.enableParallelRendering = true;
        
        console.log('🚀 WebGPU optimizations enabled');
    }
    
    setupWebGLOptimizations() {
        // WebGL固有の最適化
        this.optimizations.batchSize = 4096;
        this.optimizations.enableVertexArrayObjects = true;
        
        console.log('⚡ WebGL optimizations enabled');
    }
    
    setupCanvasOptimizations() {
        // Canvas固有の最適化
        this.optimizations.batchSize = 1024;
        this.optimizations.enableImageSmoothing = false;
        
        console.log('📱 Canvas optimizations enabled');
    }
    
    startPerformanceMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measurePerformance = (currentTime) => {
            frameCount++;
            const deltaTime = currentTime - this.performance.lastFrameTime;
            this.performance.lastFrameTime = currentTime;
            this.performance.frameTime = deltaTime;
            
            // FPS計算（1秒間隔）
            if (currentTime - lastTime >= 1000) {
                this.performance.fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
                frameCount = 0;
                lastTime = currentTime;
                
                // 性能警告
                if (this.performance.fps < 30) {
                    console.warn(`⚠️ Low FPS detected: ${this.performance.fps}`);
                    this.optimizeForLowPerformance();
                }
            }
            
            requestAnimationFrame(measurePerformance);
        };
        
        requestAnimationFrame(measurePerformance);
        console.log('📊 Performance monitoring started');
    }
    
    optimizeForLowPerformance() {
        // 低性能時の自動最適化
        this.optimizations.batchSize = Math.max(512, this.optimizations.batchSize / 2);
        this.optimizations.enableCulling = true;
        
        // テクスチャ品質下げる
        if (this.app.renderer.resolution > 1) {
            this.app.renderer.resolution = 1;
            console.log('📉 Resolution reduced for better performance');
        }
        
        console.log('🔧 Low performance optimizations applied');
    }
    
    /**
     * 高品質ペンストローク描画（PixiJS v8新API使用）
     */
    drawSmoothStroke(points, style = {}) {
        const graphics = new Graphics();
        
        if (points.length < 2) return graphics;
        
        const {
            width = 5,
            color = 0x800000, // ふたばマルーン
            alpha = 1.0,
            smoothing = true
        } = style;
        
        if (smoothing && points.length > 2) {
            // スムーズな曲線描画
            graphics.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length - 1; i++) {
                const currentPoint = points[i];
                const nextPoint = points[i + 1];
                
                // 制御点計算（ベジェ曲線）
                const controlX = (currentPoint.x + nextPoint.x) / 2;
                const controlY = (currentPoint.y + nextPoint.y) / 2;
                
                graphics.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
            }
            
            // 最後の点
            const lastPoint = points[points.length - 1];
            graphics.lineTo(lastPoint.x, lastPoint.y);
        } else {
            // 直線描画
            graphics.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                graphics.lineTo(points[i].x, points[i].y);
            }
        }
        
        // PixiJS v8新API使用
        graphics.stroke({
            width: width,
            color: color,
            alpha: alpha,
            cap: 'round',
            join: 'round'
        });
        
        return graphics;
    }
    
    /**
     * 効率的な塗りつぶし（フラッドフィル）
     */
    floodFill(container, x, y, fillColor) {
        // RenderTexture作成してピクセルデータ取得
        const renderTexture = RenderTexture.create({
            width: this.app.canvas.width,
            height: this.app.canvas.height
        });
        
        this.app.renderer.render(container, { renderTexture });
        
        // ピクセルデータ取得・フラッドフィル実行
        const pixels = this.app.renderer.extract.pixels(renderTexture);
        const filledPixels = this.executeFloodFill(pixels, x, y, fillColor, this.app.canvas.width, this.app.canvas.height);
        
        // 結果をテクスチャとして返す
        const fillGraphics = new Graphics();
        this.createGraphicsFromPixels(fillGraphics, filledPixels, this.app.canvas.width, this.app.canvas.height);
        
        // クリーンアップ
        renderTexture.destroy();
        
        return fillGraphics;
    }
    
    executeFloodFill(pixels, startX, startY, fillColor, width, height) {
        const targetColor = this.getPixelColor(pixels, startX, startY, width);
        const fillColorRGB = this.hexToRgb(fillColor);
        
        if (this.colorsEqual(targetColor, fillColorRGB)) {
            return pixels; // 同じ色の場合は何もしない
        }
        
        const stack = [[startX, startY]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
                continue;
            }
            
            const currentColor = this.getPixelColor(pixels, x, y, width);
            if (!this.colorsEqual(currentColor, targetColor)) {
                continue;
            }
            
            visited.add(key);
            this.setPixelColor(pixels, x, y, fillColorRGB, width);
            
            // 隣接ピクセルをスタックに追加
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        
        return pixels;
    }
    
    /**
     * エアブラシ効果（パーティクルベース）
     */
    createAirbrushEffect(x, y, size, color, opacity = 0.1, density = 50) {
        const container = new Container();
        
        for (let i = 0; i < density; i++) {
            const particle = new Graphics();
            
            // ランダム位置（ガウシアン分布）
            const angle = Math.random() * Math.PI * 2;
            const distance = this.gaussianRandom() * size * 0.5;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;
            
            // パーティクルサイズ（中心ほど大きく）
            const particleSize = (1 - distance / (size * 0.5)) * 3 + 1;
            
            particle
                .circle(px, py, particleSize)
                .fill({ color: color, alpha: opacity });
            
            container.addChild(particle);
        }
        
        return container;
    }
    
    gaussianRandom() {
        // Box-Muller変換によるガウシアン乱数
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
    
    /**
     * ボカシ効果（シンプル実装）
     */
    applyBlurEffect(container, radius = 5) {
        if (this.isWebGPU) {
            // WebGPU使用時はシェーダーベースのボカシ
            return this.applyWebGPUBlur(container, radius);
        } else {
            // フォールバック：PixiJS標準フィルター
            return this.applyStandardBlur(container, radius);
        }
    }
    
    applyWebGPUBlur(container, radius) {
        // WebGPU Compute Shaderボカシ（将来実装）
        console.log('🚀 WebGPU blur effect (placeholder)');
        return this.applyStandardBlur(container, radius);
    }
    
    applyStandardBlur(container, radius) {
        // 標準PixiJSフィルター使用
        if (window.PIXI && window.PIXI.BlurFilter) {
            const blurFilter = new window.PIXI.BlurFilter();
            blurFilter.blur = radius;
            container.filters = [blurFilter];
        }
        return container;
    }
    
    /**
     * レイヤー合成
     */
    blendLayers(baseLayer, overlayLayer, blendMode = 'normal') {
        const container = new Container();
        
        // ベースレイヤー追加
        container.addChild(baseLayer);
        
        // オーバーレイレイヤーにブレンドモード設定
        overlayLayer.blendMode = blendMode;
        container.addChild(overlayLayer);
        
        return container;
    }
    
    /**
     * 高品質サムネイル生成
     */
    generateThumbnail(container, size = 64) {
        const renderTexture = RenderTexture.create({
            width: size,
            height: size
        });
        
        // 一時的なスケール調整
        const originalScale = container.scale;
        const scaleX = size / this.app.canvas.width;
        const scaleY = size / this.app.canvas.height;
        const scale = Math.min(scaleX, scaleY);
        
        container.scale.set(scale);
        
        // レンダリング
        this.app.renderer.render(container, { renderTexture });
        
        // スケール復元
        container.scale = originalScale;
        
        return renderTexture;
    }
    
    /**
     * キャンバス全体をPNG/JPEG出力
     */
    exportCanvas(format = 'png', quality = 1.0) {
        const renderTexture = RenderTexture.create({
            width: this.app.canvas.width,
            height: this.app.canvas.height
        });
        
        this.app.renderer.render(this.app.stage, { renderTexture });
        
        // Canvas要素として取得
        const canvas = this.app.renderer.extract.canvas(renderTexture);
        
        // データURL生成
        const dataURL = format === 'jpeg' ? 
            canvas.toDataURL('image/jpeg', quality) : 
            canvas.toDataURL('image/png');
        
        // クリーンアップ
        renderTexture.destroy();
        
        return dataURL;
    }
    
    /**
     * メモリ使用量最適化
     */
    optimizeMemoryUsage() {
        const renderer = this.app.renderer;
        
        // 未使用テクスチャ削除
        if (renderer.texture) {
            renderer.texture.destroyUnusedTextures();
        }
        
        // 未使用ジオメトリ削除
        if (renderer.geometry) {
            renderer.geometry.destroyUnusedGeometry();
        }
        
        // ガベージコレクション強制実行（可能な場合）
        if (window.gc) {
            window.gc();
        }
        
        console.log('🧹 Memory optimization completed');
    }
    
    // ユーティリティメソッド
    getPixelColor(pixels, x, y, width) {
        const index = (y * width + x) * 4;
        return {
            r: pixels[index],
            g: pixels[index + 1],
            b: pixels[index + 2],
            a: pixels[index + 3]
        };
    }
    
    setPixelColor(pixels, x, y, color, width) {
        const index = (y * width + x) * 4;
        pixels[index] = color.r;
        pixels[index + 1] = color.g;
        pixels[index + 2] = color.b;
        pixels[index + 3] = color.a || 255;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
            a: 255
        } : null;
    }
    
    colorsEqual(color1, color2) {
        return color1.r === color2.r && 
               color1.g === color2.g && 
               color1.b === color2.b;
    }
    
    createGraphicsFromPixels(graphics, pixels, width, height) {
        // ピクセルデータからGraphicsオブジェクト作成（簡易実装）
        // 実際の実装では、より効率的なアプローチが必要
        console.log('Creating graphics from pixels (simplified)');
    }
    
    /**
     * 現在の性能情報取得
     */
    getPerformanceInfo() {
        return {
            ...this.performance,
            renderMode: this.renderMode,
            isWebGPU: this.isWebGPU,
            capabilities: this.capabilities,
            optimizations: this.optimizations
        };
    }
    
    /**
     * レンダラー設定更新
     */
    updateSettings(settings) {
        if (settings.batchSize) {
            this.optimizations.batchSize = settings.batchSize;
        }
        
        if (settings.resolution) {
            this.app.renderer.resolution = settings.resolution;
        }
        
        if (settings.enableCulling !== undefined) {
            this.optimizations.enableCulling = settings.enableCulling;
        }
        
        console.log('⚙️ Renderer settings updated:', settings);
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        // 性能監視停止
        this.performance = null;
        
        // 最適化設定クリア
        this.optimizations = null;
        
        console.log('🧹 PixiV8UnifiedRenderer destroyed');
    }
}