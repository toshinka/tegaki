// BrushEngine-v2-0.js
class TegakiBrushEngine {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 08:54:18';
        
        // ブラシエンジンの状態
        this.state = {
            isInitialized: false,
            isProcessing: false,
            currentBrush: null,
            brushCache: new Map(),
            strokeBuffer: null,
            lastPoint: null,
            points: []
        };

        // ブラシの設定
        this.settings = {
            defaultSize: 5,
            defaultOpacity: 1.0,
            defaultFlow: 1.0,
            defaultHardness: 0.8,
            defaultSpacing: 0.1,
            maxSize: 1000,
            minSize: 1,
            cacheTTL: 300000, // 5分
            maxCacheSize: 100 * 1024 * 1024  // 100MB
        };

        // オフスクリーンキャンバス
        this.offscreen = {
            brush: null,
            stroke: null,
            temp: null
        };

        // WebGLコンテキスト
        this.gl = null;
        this.glPrograms = new Map();

        // ワーカー
        this.workers = new Map();

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Brush Engine at ${this.currentTimestamp}`);

        try {
            // オフスクリーンキャンバスの初期化
            await this.initializeOffscreenCanvases();

            // WebGLの初期化
            await this.initializeWebGL();

            // ブラシワーカーの初期化
            await this.initializeWorkers();

            // 基本ブラシの生成
            await this.generateBasicBrushes();

            this.state.isInitialized = true;
            console.log('Brush Engine initialization completed');

        } catch (error) {
            console.error('Brush Engine initialization failed:', error);
            throw error;
        }
    }

    async initializeOffscreenCanvases() {
        // ブラシテクスチャ用キャンバス
        this.offscreen.brush = document.createElement('canvas');
        this.offscreen.brush.width = 512;
        this.offscreen.brush.height = 512;

        // ストローク用キャンバス
        this.offscreen.stroke = document.createElement('canvas');
        this.offscreen.stroke.width = this.app.config.width;
        this.offscreen.stroke.height = this.app.config.height;

        // 一時描画用キャンバス
        this.offscreen.temp = document.createElement('canvas');
        this.offscreen.temp.width = this.app.config.width;
        this.offscreen.temp.height = this.app.config.height;

        // コンテキストの設定
        for (const canvas of Object.values(this.offscreen)) {
            const ctx = canvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
                willReadFrequently: true
            });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }
    }

    async initializeWebGL() {
        try {
            this.gl = this.offscreen.brush.getContext('webgl2');
            if (!this.gl) {
                throw new Error('WebGL2 not supported');
            }

            // シェーダープログラムの初期化
            await this.initializeShaders();

            console.log('WebGL initialization completed');
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
            // フォールバック: 2Dキャンバスを使用
            this.gl = null;
        }
    }

    async initializeShaders() {
        // 基本的なブラシシェーダー
        await this.createShaderProgram('brush', `
            #version 300 es
            precision highp float;
            
            in vec2 position;
            in vec2 texcoord;
            
            uniform vec2 uScale;
            uniform vec2 uTranslate;
            
            out vec2 vTexCoord;
            
            void main() {
                vec2 pos = position * uScale + uTranslate;
                gl_Position = vec4(pos, 0.0, 1.0);
                vTexCoord = texcoord;
            }
        `, `
            #version 300 es
            precision highp float;
            
            in vec2 vTexCoord;
            
            uniform sampler2D uTexture;
            uniform float uHardness;
            uniform float uOpacity;
            
            out vec4 fragColor;
            
            void main() {
                float dist = length(vTexCoord - vec2(0.5));
                float alpha = smoothstep(0.5, 0.5 * uHardness, dist);
                vec4 color = texture(uTexture, vTexCoord);
                fragColor = vec4(color.rgb, color.a * alpha * uOpacity);
            }
        `);

        // 混合用シェーダー
        await this.createShaderProgram('blend', `
            #version 300 es
            precision highp float;
            
            in vec2 position;
            in vec2 texcoord;
            
            out vec2 vTexCoord;
            
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
                vTexCoord = texcoord;
            }
        `, `
            #version 300 es
            precision highp float;
            
            in vec2 vTexCoord;
            
            uniform sampler2D uSource;
            uniform sampler2D uDestination;
            uniform float uFlow;
            
            out vec4 fragColor;
            
            void main() {
                vec4 src = texture(uSource, vTexCoord);
                vec4 dst = texture(uDestination, vTexCoord);
                fragColor = mix(dst, src, src.a * uFlow);
            }
        `);
    }

    async createShaderProgram(name, vertexSource, fragmentSource) {
        const gl = this.gl;
        
        // シェーダーのコンパイル
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        // シェーダープログラムの作成
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        // エラーチェック
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            throw new Error(`Could not compile WebGL program: ${info}`);
        }

        // プログラム情報の保存
        this.glPrograms.set(name, {
            program: program,
            attributes: {
                position: gl.getAttribLocation(program, 'position'),
                texcoord: gl.getAttribLocation(program, 'texcoord')
            },
            uniforms: {
                uScale: gl.getUniformLocation(program, 'uScale'),
                uTranslate: gl.getUniformLocation(program, 'uTranslate'),
                uTexture: gl.getUniformLocation(program, 'uTexture'),
                uHardness: gl.getUniformLocation(program, 'uHardness'),
                uOpacity: gl.getUniformLocation(program, 'uOpacity'),
                uFlow: gl.getUniformLocation(program, 'uFlow')
            }
        });
    }

    async initializeWorkers() {
        // ブラシ生成ワーカー
        this.workers.set('brush', new Worker('../Workers/brush-worker-v2-0.js'));
        
        // ストローク処理ワーカー
        this.workers.set('stroke', new Worker('../Workers/stroke-worker-v2-0.js'));

        // ワーカーの初期化
        for (const [name, worker] of this.workers) {
            worker.postMessage({
                type: 'init',
                settings: this.settings,
                timestamp: this.currentTimestamp
            });
        }
    }

    async generateBasicBrushes() {
        // 基本的な円形ブラシ
        await this.generateBrush('circle', {
            size: this.settings.defaultSize,
            hardness: this.settings.defaultHardness,
            opacity: this.settings.defaultOpacity,
            flow: this.settings.defaultFlow,
            spacing: this.settings.defaultSpacing
        });

        // ソフトブラシ
        await this.generateBrush('soft', {
            size: this.settings.defaultSize,
            hardness: 0.5,
            opacity: 0.7,
            flow: 0.8,
            spacing: 0.15
        });

        // ハードブラシ
        await this.generateBrush('hard', {
            size: this.settings.defaultSize,
            hardness: 1.0,
            opacity: 1.0,
            flow: 1.0,
            spacing: 0.05
        });
    }
