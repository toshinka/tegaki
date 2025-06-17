// BrushEngine-v2-0.js
class TegakiBrushEngine {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 16:59:11';

        // ブラシ状態
        this.state = {
            isActive: false,
            currentStroke: null,
            worker: null,
            workerBusy: false,
            workerQueue: [],
            brushCache: new Map(),
            textureCache: new Map(),
            maxCacheSize: 64
        };

        // ブラシワーカー設定
        this.workerConfig = {
            enabled: true,
            maxWorkers: navigator.hardwareConcurrency || 4,
            chunkSize: 1000
        };

        // レンダリング設定
        this.renderConfig = {
            useWebGL: true,
            antialias: true,
            subpixelRendering: true,
            pressureCurve: 'quadratic',
            tiltInfluence: 0.5,
            rotationInfluence: 0.3
        };

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Brush Engine at ${this.currentTimestamp}`);

        try {
            // WebGLのサポート確認
            this.checkWebGLSupport();

            // ブラシワーカーの初期化
            await this.initializeWorker();

            // キャッシュの初期化
            this.initializeCache();

            // デフォルトブラシの生成
            await this.generateDefaultBrushes();

            console.log('Brush Engine initialization completed');

        } catch (error) {
            console.error('Brush Engine initialization failed:', error);
            throw error;
        }
    }

    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            
            if (!gl) {
                this.renderConfig.useWebGL = false;
                console.warn('WebGL not supported, falling back to Canvas2D');
            }
            
            canvas.width = canvas.height = 1;
        } catch (error) {
            this.renderConfig.useWebGL = false;
            console.warn('WebGL initialization failed:', error);
        }
    }

    async initializeWorker() {
        if (!this.workerConfig.enabled) return;

        try {
            this.state.worker = new Worker('../Workers/brush-worker-v2-0.js');
            
            this.state.worker.onmessage = (event) => {
                const { type, data } = event.data;
                this.handleWorkerMessage(type, data);
            };

            this.state.worker.onerror = (error) => {
                console.error('Brush Worker error:', error);
                this.workerConfig.enabled = false;
            };

        } catch (error) {
            console.warn('Failed to initialize Brush Worker:', error);
            this.workerConfig.enabled = false;
        }
    }

    initializeCache() {
        // ブラシキャッシュの初期化
        this.state.brushCache = new Map();
        
        // テクスチャキャッシュの初期化
        this.state.textureCache = new Map();
    }

    async generateDefaultBrushes() {
        // 円形ブラシ
        await this.generateCircleBrush();
        
        // ペンブラシ
        await this.generatePenBrush();
        
        // エアブラシ
        await this.generateAirbrush();
        
        // テクスチャブラシ
        await this.generateTextureBrush();
    }

    async generateCircleBrush() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        this.state.brushCache.set('circle', canvas);
    }

    async generatePenBrush() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(size/4, size/4);
        ctx.quadraticCurveTo(size/2, size/2, size*3/4, size*3/4);
        ctx.stroke();
        
        this.state.brushCache.set('pen', canvas);
    }

    async generateAirbrush() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(size, size);
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            const x = (i/4) % size;
            const y = Math.floor((i/4) / size);
            const distance = Math.sqrt(
                Math.pow(x - size/2, 2) + 
                Math.pow(y - size/2, 2)
            );
            
            const alpha = Math.max(0, 1 - distance/(size/2));
            const noise = Math.random() * 0.3;
            
            imageData.data[i] = 255;
            imageData.data[i+1] = 255;
            imageData.data[i+2] = 255;
            imageData.data[i+3] = Math.floor((alpha + noise) * 255);
        }
        
        ctx.putImageData(imageData, 0, 0);
        this.state.brushCache.set('airbrush', canvas);
    }

    async generateTextureBrush() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(size, size);
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = Math.random();
            
            imageData.data[i] = 255;
            imageData.data[i+1] = 255;
            imageData.data[i+2] = 255;
            imageData.data[i+3] = Math.floor(noise * 255);
        }
        
        ctx.putImageData(imageData, 0, 0);
        this.state.brushCache.set('texture', canvas);
    }

    startStroke(options) {
        const {
            context,
            color,
            size,
            flow,
            hardness,
            spacing,
            angle,
            roundness,
            scattering,
            jitter,
            point
        } = options;

        this.state.isActive = true;
        this.state.currentStroke = {
            points: [point],
            color,
            size,
            flow,
            hardness,
            spacing,
            angle,
            roundness,
            scattering,
            jitter,
            context
        };

        this.renderStrokeSegment(point, point);
    }

    continueStroke(options) {
        const { point } = options;
        
        if (!this.state.isActive || !this.state.currentStroke) return;

        const lastPoint = this.state.currentStroke.points[
            this.state.currentStroke.points.length - 1
        ];

        this.state.currentStroke.points.push(point);
        this.renderStrokeSegment(lastPoint, point);
    }

    endStroke(options) {
        const { point } = options;
        
        if (!this.state.isActive || !this.state.currentStroke) return;

        const lastPoint = this.state.currentStroke.points[
            this.state.currentStroke.points.length - 1
        ];

        this.renderStrokeSegment(lastPoint, point);

        if (this.workerConfig.enabled && this.state.currentStroke.points.length > this.workerConfig.chunkSize) {
            this.processStrokeWithWorker(this.state.currentStroke);
        }

        this.state.isActive = false;
        this.state.currentStroke = null;
    }

    renderStrokeSegment(startPoint, endPoint) {
        if (!this.state.currentStroke) return;

        const {
            context,
            color,
            size,
            flow,
            hardness,
            spacing,
            angle,
            roundness,
            scattering,
            jitter
        } = this.state.currentStroke;

        const distance = Math.hypot(
            endPoint.x - startPoint.x,
            endPoint.y - startPoint.y
        );

        const steps = Math.max(1, Math.ceil(distance / (size * spacing)));
        const stepX = (endPoint.x - startPoint.x) / steps;
        const stepY = (endPoint.y - startPoint.y) / steps;

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pressure = this.interpolatePressure(
                startPoint.pressure,
                endPoint.pressure,
                t
            );

            const x = startPoint.x + stepX * i +
                (Math.random() - 0.5) * scattering * size;
            const y = startPoint.y + stepY * i +
                (Math.random() - 0.5) * scattering * size;

            const tiltX = this.interpolateTilt(
                startPoint.tilt.x,
                endPoint.tilt.x,
                t
            );
            const tiltY = this.interpolateTilt(
                startPoint.tilt.y,
                endPoint.tilt.y,
                t
            );

            this.renderBrushDab({
                context,
                x,
                y,
                color,
                size: size * (1 + (Math.random() - 0.5) * jitter),
                flow: flow * pressure,
                hardness,
                angle: angle + (Math.random() - 0.5) * jitter * Math.PI,
                roundness,
                tiltX,
                tiltY
            });
        }
    }

    renderBrushDab(options) {
        if (this.renderConfig.useWebGL) {
            this.renderBrushDabWebGL(options);
        } else {
            this.renderBrushDabCanvas2D(options);
        }
    }

    renderBrushDabCanvas2D(options) {
        const {
            context,
            x,
            y,
            color,
            size,
            flow,
            hardness,
            angle,
            roundness,
            tiltX,
            tiltY
        } = options;

        const brush = this.state.brushCache.get('circle');
        if (!brush) return;

        context.save();

        // 変形の適用
        context.translate(x, y);
        context.rotate(angle + Math.atan2(tiltY, tiltX) * this.renderConfig.tiltInfluence);
        context.scale(1, roundness);
        context.scale(
            size * (1 + Math.abs(tiltX) * this.renderConfig.tiltInfluence),
            size * (1 + Math.abs(tiltY) * this.renderConfig.tiltInfluence)
        );

        // ブレンドモードとアルファの設定
        context.globalAlpha = flow;
        context.globalCompositeOperation = 'source-over';

        // ブラシの描画
        context.drawImage(
            brush,
            -0.5,
            -0.5,
            1,
            1
        );

        context.restore();
    }

    renderBrushDabWebGL(options) {
        // WebGL実装は省略（実際の実装ではここにWebGLレンダリングコードが入ります）
    }

    interpolatePressure(start, end, t) {
        switch (this.renderConfig.pressureCurve) {
            case 'linear':
                return start + (end - start) * t;
            case 'quadratic':
                return start + (end - start) * (t * t);
            case 'cubic':
                return start + (end - start) * (t * t * t);
            default:
                return start + (end - start) * t;
        }
    }

    interpolateTilt(start, end, t) {
        return start + (end - start) * t;
    }

    processStrokeWithWorker(stroke) {
        if (!this.workerConfig.enabled || this.state.workerBusy) {
            this.state.workerQueue.push(stroke);
            return;
        }

        this.state.workerBusy = true;
        
        const strokeData = {
            points: stroke.points,
            color: stroke.color,
            size: stroke.size,
            flow: stroke.flow,
            hardness: stroke.hardness,
            spacing: stroke.spacing,
            angle: stroke.angle,
            roundness: stroke.roundness,
            scattering: stroke.scattering,
            jitter: stroke.jitter
        };

        this.state.worker.postMessage({
            type: 'process-stroke',
            data: strokeData
        });
    }

    handleWorkerMessage(type, data) {
        switch (type) {
            case 'stroke-processed':
                this.applyProcessedStroke(data);
                break;
            case 'worker-ready':
                console.log('Brush Worker is ready');
                break;
            case 'worker-error':
                console.error('Brush Worker error:', data);
                break;
        }

        this.state.workerBusy = false;
        
        if (this.state.workerQueue.length > 0) {
            const nextStroke = this.state.workerQueue.shift();
            this.processStrokeWithWorker(nextStroke);
        }
    }

    applyProcessedStroke(data) {
        // ワーカーからの処理結果を適用
        if (!this.state.currentStroke) return;

        const { context } = this.state.currentStroke;
        const imageData = new ImageData(
            new Uint8ClampedArray(data.buffer),
            data.width,
            data.height
        );

        context.putImageData(imageData, 0, 0);
    }

    dispose() {
        // ワーカーの終了
        if (this.state.worker) {
            this.state.worker.terminate();
            this.state.worker = null;
        }

        // キャッシュのクリア
        for (const canvas of this.state.brushCache.values()) {
            canvas.width = canvas.height = 0;
        }
        this.state.brushCache.clear();

        for (const texture of this.state.textureCache.values()) {
            texture.dispose();
        }
        this.state.textureCache.clear();

        // 状態のリセット
        this.state = null;
    }
}