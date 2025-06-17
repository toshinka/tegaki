// LayerManager-v2-0.js
class TegakiLayerManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 10:33:20';
        
        // レイヤー管理の状態
        this.state = {
            layers: [],
            currentLayer: null,
            maxLayers: 64,
            defaultWidth: 800,
            defaultHeight: 600,
            defaultOpacity: 1.0,
            defaultBlendMode: 'normal'
        };

        // レイヤーのキャッシュ
        this.cache = new Map();

        // オフスクリーンキャンバス
        this.offscreen = {
            composite: null,
            temp: null
        };

        // WebGLコンテキスト
        this.gl = null;
        this.glPrograms = new Map();

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Layer Manager at ${this.currentTimestamp}`);

        try {
            // オフスクリーンキャンバスの初期化
            await this.initializeOffscreenCanvases();

            // WebGLの初期化
            await this.initializeWebGL();

            // 基本レイヤーの作成
            await this.createDefaultLayer();

            console.log('Layer Manager initialization completed');

        } catch (error) {
            console.error('Layer Manager initialization failed:', error);
            throw error;
        }
    }

    async initializeOffscreenCanvases() {
        // 合成用キャンバス
        this.offscreen.composite = document.createElement('canvas');
        this.offscreen.composite.width = this.state.defaultWidth;
        this.offscreen.composite.height = this.state.defaultHeight;

        // 一時描画用キャンバス
        this.offscreen.temp = document.createElement('canvas');
        this.offscreen.temp.width = this.state.defaultWidth;
        this.offscreen.temp.height = this.state.defaultHeight;

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
            this.gl = this.offscreen.composite.getContext('webgl2');
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
        // 基本的な描画シェーダー
        await this.createShaderProgram('basic', `
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
            
            uniform sampler2D uTexture;
            uniform float uOpacity;
            
            out vec4 fragColor;
            
            void main() {
                vec4 color = texture(uTexture, vTexCoord);
                fragColor = vec4(color.rgb, color.a * uOpacity);
            }
        `);

        // ブレンドモード用シェーダー
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
            uniform int uBlendMode;
            uniform float uOpacity;
            
            out vec4 fragColor;
            
            vec4 blend(vec4 src, vec4 dst, int mode) {
                vec4 result;
                
                switch (mode) {
                    case 0: // normal
                        result = src;
                        break;
                    case 1: // multiply
                        result = src * dst;
                        break;
                    case 2: // screen
                        result = vec4(1.0) - (vec4(1.0) - src) * (vec4(1.0) - dst);
                        break;
                    case 3: // overlay
                        result = mix(
                            2.0 * src * dst,
                            vec4(1.0) - 2.0 * (vec4(1.0) - src) * (vec4(1.0) - dst),
                            step(vec4(0.5), dst)
                        );
                        break;
                    default:
                        result = src;
                }
                
                return vec4(result.rgb, result.a * uOpacity);
            }
            
            void main() {
                vec4 src = texture(uSource, vTexCoord);
                vec4 dst = texture(uDestination, vTexCoord);
                fragColor = blend(src, dst, uBlendMode);
            }
        `);
    }