// CanvasManager-v2-0.js
class TegakiCanvasManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 07:57:45';
        
        // キャンバス要素の管理
        this.mainCanvas = null;
        this.displayCanvas = null;
        this.offscreenCanvas = null;
        this.tempCanvas = null;

        // コンテキストの管理
        this.contexts = {
            main: null,
            display: null,
            offscreen: null,
            temp: null
        };

        // キャンバスの状態
        this.state = {
            width: app.config.width || 1920,
            height: app.config.height || 1080,
            scale: 1,
            rotation: 0,
            position: { x: 0, y: 0 }
        };

        // 描画設定
        this.settings = {
            smoothing: true,
            pixelated: false,
            backgroundColor: '#ffffff'
        };

        // WebGL関連
        this.glContext = null;
        this.glPrograms = new Map();
    }

    async initialize() {
        console.log(`Initializing Canvas Manager at ${this.currentTimestamp}`);

        try {
            // メインキャンバスの作成
            await this.createMainCanvas();

            // 表示用キャンバスの作成
            await this.createDisplayCanvas();

            // オフスクリーンキャンバスの作成
            await this.createOffscreenCanvas();

            // 一時キャンバスの作成
            await this.createTempCanvas();

            // WebGLコンテキストの初期化
            await this.initializeWebGL();

            // イベントリスナーの設定
            this.setupEventListeners();

            console.log('Canvas Manager initialization completed');

        } catch (error) {
            console.error('Canvas Manager initialization failed:', error);
            throw error;
        }
    }

    async createMainCanvas() {
        this.mainCanvas = document.createElement('canvas');
        this.mainCanvas.width = this.state.width;
        this.mainCanvas.height = this.state.height;
        this.mainCanvas.classList.add('tegaki-main-canvas');

        this.contexts.main = this.mainCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: true
        });

        this.setupCanvasContext(this.contexts.main);
        this.app.config.container.appendChild(this.mainCanvas);
    }

    async createDisplayCanvas() {
        this.displayCanvas = document.createElement('canvas');
        this.displayCanvas.width = this.state.width;
        this.displayCanvas.height = this.state.height;
        this.displayCanvas.classList.add('tegaki-display-canvas');

        this.contexts.display = this.displayCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });

        this.setupCanvasContext(this.contexts.display);
        this.app.config.container.appendChild(this.displayCanvas);
    }

    async createOffscreenCanvas() {
        if ('OffscreenCanvas' in window) {
            this.offscreenCanvas = new OffscreenCanvas(
                this.state.width,
                this.state.height
            );
        } else {
            this.offscreenCanvas = document.createElement('canvas');
        }

        this.offscreenCanvas.width = this.state.width;
        this.offscreenCanvas.height = this.state.height;

        this.contexts.offscreen = this.offscreenCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });

        this.setupCanvasContext(this.contexts.offscreen);
    }

    async createTempCanvas() {
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = this.state.width;
        this.tempCanvas.height = this.state.height;
        
        this.contexts.temp = this.tempCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });

        this.setupCanvasContext(this.contexts.temp);
    }

    setupCanvasContext(ctx) {
        if (!ctx) return;

        ctx.imageSmoothingEnabled = this.settings.smoothing;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    async initializeWebGL() {
        try {
            this.glContext = this.mainCanvas.getContext('webgl2');
            if (!this.glContext) {
                this.glContext = this.mainCanvas.getContext('webgl');
            }

            if (this.glContext) {
                await this.setupWebGLPrograms();
            }
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
        }
    }

    async setupWebGLPrograms() {
        // 基本的なシェーダープログラムの設定
        const basicVertexShader = `
            attribute vec4 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            
            void main() {
                gl_Position = aPosition;
                vTexCoord = aTexCoord;
            }
        `;

        const basicFragmentShader = `
            precision mediump float;
            uniform sampler2D uTexture;
            varying vec2 vTexCoord;
            
            void main() {
                gl_FragColor = texture2D(uTexture, vTexCoord);
            }
        `;

        this.glPrograms.set('basic', 
            this.createWebGLProgram(basicVertexShader, basicFragmentShader));
    }

    createWebGLProgram(vertexShaderSource, fragmentShaderSource) {
        const gl = this.glContext;
        
        // シェーダーのコンパイル
        const vertexShader = this.compileShader(
            gl.VERTEX_SHADER,
            vertexShaderSource
        );
        const fragmentShader = this.compileShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        );

        // プログラムの作成とリンク
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(
                'WebGL program linking failed: ' + 
                gl.getProgramInfoLog(program)
            );
        }

        return program;
    }

    compileShader(type, source) {
        const gl = this.glContext;
        const shader = gl.createShader(type);
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(
                'WebGL shader compilation failed: ' + 
                gl.getShaderInfoLog(shader)
            );
        }

        return shader;
    }

    setupEventListeners() {
        // キャンバスのリサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));

        // マウス/タッチイベント
        this.displayCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.displayCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.displayCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.displayCanvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.displayCanvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.displayCanvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    handleResize() {
        // コンテナのサイズに合わせてキャンバスをリサイズ
        const container = this.app.config.container;
        const rect = container.getBoundingClientRect();

        this.setCanvasSize(rect.width, rect.height);
        this.updateCanvasScale();
    }

    setCanvasSize(width, height) {
        this.state.width = width;
        this.state.height = height;

        // 全てのキャンバスのサイズを更新
        [this.mainCanvas, this.displayCanvas, this.tempCanvas].forEach(canvas => {
            if (canvas) {
                canvas.width = width;
                canvas.height = height;
                this.setupCanvasContext(canvas.getContext('2d'));
            }
        });

        // オフスクリーンキャンバスの更新
        if (this.offscreenCanvas) {
            if (this.offscreenCanvas instanceof OffscreenCanvas) {
                this.offscreenCanvas = new OffscreenCanvas(width, height);
            } else {
                this.offscreenCanvas.width = width;
                this.offscreenCanvas.height = height;
            }
            this.setupCanvasContext(this.contexts.offscreen);
        }
    }

    updateCanvasScale() {
        // キャンバスのスケールを計算
        const container = this.app.config.container;
        const rect = container.getBoundingClientRect();

        this.state.scale = Math.min(
            rect.width / this.state.width,
            rect.height / this.state.height
        );

        // スケールの適用
        this.mainCanvas.style.transform = `scale(${this.state.scale})`;
        this.displayCanvas.style.transform = `scale(${this.state.scale})`;
    }

    // マウス/タッチイベントハンドラー
    handleMouseDown(event) {
        const pos = this.getCanvasPosition(event);
        this.app.getManager('tool').handlePointerDown(pos);
    }

    handleMouseMove(event) {
        const pos = this.getCanvasPosition(event);
        this.app.getManager('tool').handlePointerMove(pos);
    }

    handleMouseUp(event) {
        const pos = this.getCanvasPosition(event);
        this.app.getManager('tool').handlePointerUp(pos);
    }

    handleTouchStart(event) {
        event.preventDefault();
        const pos = this.getTouchPosition(event.touches[0]);
        this.app.getManager('tool').handlePointerDown(pos);
    }

    handleTouchMove(event) {
        event.preventDefault();
        const pos = this.getTouchPosition(event.touches[0]);
        this.app.getManager('tool').handlePointerMove(pos);
    }

    handleTouchEnd(event) {
        event.preventDefault();
        const pos = this.getTouchPosition(event.changedTouches[0]);
        this.app.getManager('tool').handlePointerUp(pos);
    }

    getCanvasPosition(event) {
        const rect = this.displayCanvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) / this.state.scale,
            y: (event.clientY - rect.top) / this.state.scale
        };
    }

    getTouchPosition(touch) {
        const rect = this.displayCanvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left) / this.state.scale,
            y: (touch.clientY - rect.top) / this.state.scale
        };
    }

    // 状態管理
    getState() {
        return {
            ...this.state,
            settings: { ...this.settings }
        };
    }

    setState(state) {
        if (!state) return;

        this.state = { ...this.state, ...state };
        this.settings = { ...this.settings, ...state.settings };

        // キャンバスの更新
        this.setCanvasSize(this.state.width, this.state.height);
        this.updateCanvasScale();
    }

    // ユーティリティメソッド
    getContext(type) {
        return this.contexts[type] || null;
    }

    getCanvas(type) {
        switch (type) {
            case 'main': return this.mainCanvas;
            case 'display': return this.displayCanvas;
            case 'offscreen': return this.offscreenCanvas;
            case 'temp': return this.tempCanvas;
            default: return null;
        }
    }

    clearCanvas(type) {
        const ctx = this.getContext(type);
        if (ctx) {
            ctx.clearRect(0, 0, this.state.width, this.state.height);
        }
    }
}