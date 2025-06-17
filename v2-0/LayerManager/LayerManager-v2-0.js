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
                uTexture: gl.getUniformLocation(program, 'uTexture'),
                uSource: gl.getUniformLocation(program, 'uSource'),
                uDestination: gl.getUniformLocation(program, 'uDestination'),
                uBlendMode: gl.getUniformLocation(program, 'uBlendMode'),
                uOpacity: gl.getUniformLocation(program, 'uOpacity')
            }
        });
    }

    async createDefaultLayer() {
        const layer = {
            id: `layer_${Date.now()}`,
            name: 'Background',
            visible: true,
            opacity: this.state.defaultOpacity,
            blendMode: this.state.defaultBlendMode,
            locked: false,
            canvas: document.createElement('canvas'),
            texture: null
        };

        // キャンバスの初期化
        layer.canvas.width = this.state.defaultWidth;
        layer.canvas.height = this.state.defaultHeight;
        
        const ctx = layer.canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);

        // テクスチャの作成
        if (this.gl) {
            layer.texture = this.createLayerTexture(layer.canvas);
        }

        // レイヤーの追加
        this.state.layers.push(layer);
        this.state.currentLayer = layer;

        return layer;
    }

    createLayerTexture(canvas) {
        const gl = this.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            canvas
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        return texture;
    }

    addLayer(options = {}) {
        if (this.state.layers.length >= this.state.maxLayers) {
            throw new Error('Maximum number of layers reached');
        }

        const layer = {
            id: `layer_${Date.now()}`,
            name: options.name || `Layer ${this.state.layers.length + 1}`,
            visible: options.visible !== undefined ? options.visible : true,
            opacity: options.opacity || this.state.defaultOpacity,
            blendMode: options.blendMode || this.state.defaultBlendMode,
            locked: options.locked || false,
            canvas: document.createElement('canvas'),
            texture: null
        };

        // キャンバスの初期化
        layer.canvas.width = this.state.defaultWidth;
        layer.canvas.height = this.state.defaultHeight;
        
        const ctx = layer.canvas.getContext('2d');
        ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

        if (options.data) {
            ctx.putImageData(options.data, 0, 0);
        }

        // テクスチャの作成
        if (this.gl) {
            layer.texture = this.createLayerTexture(layer.canvas);
        }

        // レイヤーの追加
        const index = options.index !== undefined ? 
            Math.min(options.index, this.state.layers.length) : 
            this.state.layers.length;
        
        this.state.layers.splice(index, 0, layer);
        this.state.currentLayer = layer;

        return layer;
    }

    removeLayer(layerId) {
        const index = this.state.layers.findIndex(layer => layer.id === layerId);
        if (index === -1) return false;

        const layer = this.state.layers[index];
        
        // WebGLリソースの解放
        if (this.gl && layer.texture) {
            this.gl.deleteTexture(layer.texture);
        }

        // キャンバスの解放
        layer.canvas.width = 0;
        layer.canvas.height = 0;
        layer.canvas = null;

        // レイヤーの削除
        this.state.layers.splice(index, 1);

        // 現在のレイヤーの更新
        if (this.state.currentLayer.id === layerId) {
            this.state.currentLayer = this.state.layers[
                Math.min(index, this.state.layers.length - 1)
            ];
        }

        return true;
    }

    getLayer(layerId) {
        return this.state.layers.find(layer => layer.id === layerId);
    }

    getCurrentLayer() {
        return this.state.currentLayer;
    }

    setCurrentLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (layer) {
            this.state.currentLayer = layer;
            return true;
        }
        return false;
    }

    updateLayerTexture(layer) {
        if (!this.gl || !layer.texture) return;

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            layer.canvas
        );
    }

    compositeLayer(layer, destination) {
        if (!layer.visible || layer.opacity === 0) return;

        if (this.gl) {
            this.compositeLayerWebGL(layer, destination);
        } else {
            this.compositeLayerCanvas(layer, destination);
        }
    }

    compositeLayerWebGL(layer, destination) {
        const gl = this.gl;
        const program = this.glPrograms.get('blend');

        gl.useProgram(program.program);

        // ソーステクスチャ（レイヤー）
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        gl.uniform1i(program.uniforms.uSource, 0);

        // デスティネーションテクスチャ
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, destination);
        gl.uniform1i(program.uniforms.uDestination, 1);

        // ブレンドモードとオパシティの設定
        gl.uniform1i(program.uniforms.uBlendMode, this.getBlendModeIndex(layer.blendMode));
        gl.uniform1f(program.uniforms.uOpacity, layer.opacity);

        // 描画
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    compositeLayerCanvas(layer, destination) {
        const ctx = this.offscreen.composite.getContext('2d');
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;
        ctx.drawImage(layer.canvas, 0, 0);
    }

    compositeAll() {
        const gl = this.gl;
        const composite = this.offscreen.composite;
        
        if (gl) {
            gl.viewport(0, 0, composite.width, composite.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else {
            const ctx = composite.getContext('2d');
            ctx.clearRect(0, 0, composite.width, composite.height);
        }

        // 下から順にレイヤーを合成
        for (const layer of this.state.layers) {
            this.compositeLayer(layer, composite);
        }

        return composite;
    }

    getBlendModeIndex(mode) {
        const modes = {
            'normal': 0,
            'multiply': 1,
            'screen': 2,
            'overlay': 3
        };
        return modes[mode] || 0;
    }

    moveLayer(layerId, newIndex) {
        const currentIndex = this.state.layers.findIndex(layer => layer.id === layerId);
        if (currentIndex === -1) return false;

        const layer = this.state.layers[currentIndex];
        this.state.layers.splice(currentIndex, 1);
        this.state.layers.splice(
            Math.min(newIndex, this.state.layers.length),
            0,
            layer
        );

        return true;
    }

    setLayerVisibility(layerId, visible) {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.visible = visible;
            return true;
        }
        return false;
    }

    setLayerOpacity(layerId, opacity) {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.opacity = Math.max(0, Math.min(1, opacity));
            return true;
        }
        return false;
    }

    setLayerBlendMode(layerId, blendMode) {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.blendMode = blendMode;
            return true;
        }
        return false;
    }

    dispose() {
        // WebGLリソースの解放
        if (this.gl) {
            for (const [_, program] of this.glPrograms) {
                this.gl.deleteProgram(program.program);
            }
            for (const layer of this.state.layers) {
                if (layer.texture) {
                    this.gl.deleteTexture(layer.texture);
                }
            }
        }

        // キャンバスの解放
        for (const canvas of Object.values(this.offscreen)) {
            canvas.width = 0;
            canvas.height = 0;
        }
        for (const layer of this.state.layers) {
            if (layer.canvas) {
                layer.canvas.width = 0;
                layer.canvas.height = 0;
            }
        }

        // 状態のリセット
        this.state = null;
        this.cache.clear();
        this.cache = null;
        this.offscreen = null;
        this.gl = null;
        this.glPrograms = null;
    }
}
