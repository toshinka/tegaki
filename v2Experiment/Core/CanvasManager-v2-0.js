// CanvasManager-v2-0.js
class TegakiCanvasManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 16:42:59';
        
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
            position: { x: 0, y: 0 },
            zoom: {
                level: 1,
                min: 0.1,
                max: 16
            },
            pixelRatio: window.devicePixelRatio || 1
        };

        // 描画設定
        this.settings = {
            smoothing: true,
            pixelated: false,
            backgroundColor: '#ffffff',
            gridEnabled: false,
            gridSize: 32,
            gridColor: 'rgba(0, 0, 0, 0.1)',
            rulerEnabled: false,
            rulerSize: 20,
            rulerColor: '#666666'
        };

        // マウス/タッチ状態
        this.pointer = {
            isDown: false,
            isDragging: false,
            current: { x: 0, y: 0 },
            previous: { x: 0, y: 0 },
            pressure: 0,
            tilt: { x: 0, y: 0 },
            start: { x: 0, y: 0 }
        };

        // WebGL関連
        this.glContext = null;
        this.glPrograms = new Map();

        // パフォーマンス最適化
        this.renderRequest = null;
        this.updateRequest = null;
        this.lastRenderTime = 0;
        this.frameInterval = 1000 / 60; // 60fps

        this.initialize();
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

            // キャンバスの初期設定
            this.setupInitialState();

            console.log('Canvas Manager initialization completed');

        } catch (error) {
            console.error('Canvas Manager initialization failed:', error);
            throw error;
        }
    }

    async createMainCanvas() {
        this.mainCanvas = document.createElement('canvas');
        this.mainCanvas.width = this.state.width * this.state.pixelRatio;
        this.mainCanvas.height = this.state.height * this.state.pixelRatio;
        this.mainCanvas.style.width = `${this.state.width}px`;
        this.mainCanvas.style.height = `${this.state.height}px`;
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
        this.displayCanvas.width = this.state.width * this.state.pixelRatio;
        this.displayCanvas.height = this.state.height * this.state.pixelRatio;
        this.displayCanvas.style.width = `${this.state.width}px`;
        this.displayCanvas.style.height = `${this.state.height}px`;
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
                this.state.width * this.state.pixelRatio,
                this.state.height * this.state.pixelRatio
            );
        } else {
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCanvas.width = this.state.width * this.state.pixelRatio;
            this.offscreenCanvas.height = this.state.height * this.state.pixelRatio;
        }

        this.contexts.offscreen = this.offscreenCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });

        this.setupCanvasContext(this.contexts.offscreen);
    }

    async createTempCanvas() {
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = this.state.width * this.state.pixelRatio;
        this.tempCanvas.height = this.state.height * this.state.pixelRatio;
        
        this.contexts.temp = this.tempCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });

        this.setupCanvasContext(this.contexts.temp);
    }

    setupCanvasContext(ctx) {
        if (!ctx) return;

        ctx.scale(this.state.pixelRatio, this.state.pixelRatio);
        ctx.imageSmoothingEnabled = this.settings.smoothing;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    async initializeWebGL() {
        try {
            this.glContext = this.mainCanvas.getContext('webgl2', {
                premultipliedAlpha: false,
                preserveDrawingBuffer: true
            });

            if (!this.glContext) {
                this.glContext = this.mainCanvas.getContext('webgl', {
                    premultipliedAlpha: false,
                    preserveDrawingBuffer: true
                });
            }

            if (this.glContext) {
                await this.setupWebGLPrograms();
            }
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
            this.glContext = null;
        }
    }

    async setupWebGLPrograms() {
        // 基本的なシェーダープログラムの設定
        const basicVertexShader = `
            attribute vec4 aPosition;
            attribute vec2 aTexCoord;
            uniform vec2 uResolution;
            uniform vec2 uTranslate;
            uniform float uRotation;
            uniform float uScale;
            varying vec2 vTexCoord;
            
            void main() {
                vec2 position = aPosition.xy;
                
                // スケール
                position *= uScale;
                
                // 回転
                float s = sin(uRotation);
                float c = cos(uRotation);
                position = mat2(c, -s, s, c) * position;
                
                // 移動
                position += uTranslate;
                
                // NDC座標系に変換
                position = (position / uResolution) * 2.0 - 1.0;
                
                gl_Position = vec4(position, 0.0, 1.0);
                vTexCoord = aTexCoord;
            }
        `;

        const basicFragmentShader = `
            precision mediump float;
            
            uniform sampler2D uTexture;
            uniform float uOpacity;
            uniform vec4 uColorMult;
            uniform vec4 uColorAdd;
            
            varying vec2 vTexCoord;
            
            void main() {
                vec4 color = texture2D(uTexture, vTexCoord);
                color = color * uColorMult + uColorAdd;
                color.a *= uOpacity;
                gl_FragColor = color;
            }
        `;

        await this.createWebGLProgram('basic', basicVertexShader, basicFragmentShader);

        // その他の特殊効果用シェーダーの設定
        // ...
    }

    async createWebGLProgram(name, vertexSource, fragmentSource) {
        const gl = this.glContext;
        
        // シェーダーのコンパイル
        const vertexShader = await this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = await this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

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

        // プログラム情報の保存
        this.glPrograms.set(name, {
            program: program,
            attributes: {
                position: gl.getAttribLocation(program, 'aPosition'),
                texcoord: gl.getAttribLocation(program, 'aTexCoord')
            },
            uniforms: {
                resolution: gl.getUniformLocation(program, 'uResolution'),
                translate: gl.getUniformLocation(program, 'uTranslate'),
                rotation: gl.getUniformLocation(program, 'uRotation'),
                scale: gl.getUniformLocation(program, 'uScale'),
                texture: gl.getUniformLocation(program, 'uTexture'),
                opacity: gl.getUniformLocation(program, 'uOpacity'),
                colorMult: gl.getUniformLocation(program, 'uColorMult'),
                colorAdd: gl.getUniformLocation(program, 'uColorAdd')
            }
        });

        return program;
    }

    async compileShader(type, source) {
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
        // ウィンドウのリサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));

        // キャンバスイベント
        this.displayCanvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.displayCanvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.displayCanvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.displayCanvas.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
        this.displayCanvas.addEventListener('wheel', this.handleWheel.bind(this));

        // キーボードイベント
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    setupInitialState() {
        // キャンバスの初期位置とスケールの設定
        this.updateCanvasTransform();
        
        // 背景の描画
        this.clearCanvas('main');
        this.clearCanvas('display');
        
        // グリッドの描画（有効な場合）
        if (this.settings.gridEnabled) {
            this.drawGrid();
        }
        
        // ルーラーの描画（有効な場合）
        if (this.settings.rulerEnabled) {
            this.drawRuler();
        }
    }

    updateCanvasTransform() {
        const container = this.app.config.container;
        const rect = container.getBoundingClientRect();
        
        // スケールの計算
        const scaleX = rect.width / this.state.width;
        const scaleY = rect.height / this.state.height;
        this.state.scale = Math.min(scaleX, scaleY);

        // 位置の計算
        this.state.position.x = (rect.width - this.state.width * this.state.scale) / 2;
        this.state.position.y = (rect.height - this.state.height * this.state.scale) / 2;

        // 変換の適用
        const transform = `
            translate(${this.state.position.x}px, ${this.state.position.y}px)
            scale(${this.state.scale})
            rotate(${this.state.rotation}rad)
        `;

        this.mainCanvas.style.transform = transform;
        this.displayCanvas.style.transform = transform;
    }

    handleResize() {
        cancelAnimationFrame(this.renderRequest);
        cancelAnimationFrame(this.updateRequest);

        this.updateRequest = requestAnimationFrame(() => {
            this.updateCanvasTransform();
            this.render();
        });
    }

    handlePointerDown(event) {
        event.preventDefault();
        this.displayCanvas.setPointerCapture(event.pointerId);

        this.pointer.isDown = true;
        this.pointer.current = this.getPointerPosition(event);
        this.pointer.previous = { ...this.pointer.current };
        this.pointer.start = { ...this.pointer.current };
        this.pointer.pressure = event.pressure || 0.5;
        this.pointer.tilt = {
            x: event.tiltX || 0,
            y: event.tiltY || 0
        };

        // ツールマネージャーに通知
        this.app.getManager('tool').handlePointerDown({
            ...this.pointer.current,
            pressure: this.pointer.pressure,
            tilt: this.pointer.tilt,
            event
        });
    }

    handlePointerMove(event) {
        event.preventDefault();
        this.pointer.current = this.getPointerPosition(event);
        this.pointer.pressure = event.pressure || 0.5;
        this.pointer.tilt = {
            x: event.tiltX || 0,
            y: event.tiltY || 0
        };

        if (this.pointer.isDown) {
            // ツールマネージャーに通知
            this.app.getManager('tool').handlePointerMove({
                ...this.pointer.current,
                pressure: this.pointer.pressure,
                tilt: this.pointer.tilt,
                event
            });
        }

        this.pointer.previous = { ...this.pointer.current };
    }

    handlePointerUp(event) {
        event.preventDefault();
        this.displayCanvas.releasePointerCapture(event.pointerId);

        if (this.pointer.isDown) {
            this.pointer.current = this.getPointerPosition(event);
            
            // ツールマネージャーに通知
            this.app.getManager('tool').handlePointerUp({
                ...this.pointer.current,
                pressure: 0,
                tilt: { x: 0, y: 0 },
                event
            });
        }

        this.pointer.isDown = false;
        this.pointer.isDragging = false;
    }

    handlePointerCancel(event) {
        this.handlePointerUp(event);
    }

    handleWheel(event) {
        event.preventDefault();

        // Ctrl キーが押されている場合はズーム
        if (event.ctrlKey) {
            const delta = event.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(delta, event.clientX, event.clientY);
        }
        // それ以外はスクロール
        else {
            this.scroll(event.deltaX, event.deltaY);
        }
    }

    handleKeyDown(event) {
        // スペースキーでの移動モード
        if (event.code === 'Space') {
            this.displayCanvas.style.cursor = 'grab';
        }
    }

    handleKeyUp(event) {
        if (event.code === 'Space') {
            this.displayCanvas.style.cursor = 'default';
        }
    }

    getPointerPosition(event) {
        const rect = this.displayCanvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left - this.state.position.x) / this.state.scale,
            y: (event.clientY - rect.top - this.state.position.y) / this.state.scale
        };
    }

    zoom(factor, centerX, centerY) {
        const newZoom = Math.min(
            Math.max(
                this.state.zoom.level * factor,
                this.state.zoom.min
            ),
            this.state.zoom.max
        );

        if (newZoom !== this.state.zoom.level) {
            // ズーム中心点をキャンバス座標に変換
            const rect = this.displayCanvas.getBoundingClientRect();
            const x = (centerX - rect.left - this.state.position.x) / this.state.scale;
            const y = (centerY - rect.top - this.state.position.y) / this.state.scale;

            // 位置の調整
            this.state.position.x += (x * this.state.scale) * (1 - factor);
            this.state.position.y += (y * this.state.scale) * (1 - factor);

            this.state.zoom.level = newZoom;
            this.state.scale *= factor;

            this.updateCanvasTransform();
            this.render();
        }
    }

    scroll(deltaX, deltaY) {
        this.state.position.x -= deltaX;
        this.state.position.y -= deltaY;

        this.updateCanvasTransform();
        this.render();
    }

    rotate(angle) {
        this.state.rotation = (this.state.rotation + angle) % (Math.PI * 2);
        this.updateCanvasTransform();
        this.render();
    }

    drawGrid() {
        const ctx = this.contexts.display;
        const gridSize = this.settings.gridSize * this.state.scale;

        ctx.save();
        ctx.strokeStyle = this.settings.gridColor;
        ctx.lineWidth = 1;

        // 垂直線
        for (let x = 0; x <= this.state.width; x += this.settings.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.state.height);
            ctx.stroke();
        }

        // 水平線
        for (let y = 0; y <= this.state.height; y += this.settings.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.state.width, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawRuler() {
        const ctx = this.contexts.display;
        const rulerSize = this.settings.rulerSize;

        ctx.save();
        ctx.fillStyle = this.settings.rulerColor;
        ctx.strokeStyle = this.settings.rulerColor;
        ctx.lineWidth = 1;
        ctx.font = '10px sans-serif';

        // 水平ルーラー
        for (let x = 0; x <= this.state.width; x += rulerSize) {
            const isMainTick = x % (rulerSize * 5) === 0;
            const tickHeight = isMainTick ? 10 : 5;
            
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, tickHeight);
            ctx.stroke();

            if (isMainTick) {
                ctx.fillText(x.toString(), x + 2, tickHeight + 10);
            }
        }

        // 垂直ルーラー
        for (let y = 0; y <= this.state.height; y += rulerSize) {
            const isMainTick = y % (rulerSize * 5) === 0;
            const tickWidth = isMainTick ? 10 : 5;
            
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(tickWidth, y);
            ctx.stroke();

            if (isMainTick) {
                ctx.save();
                ctx.translate(tickWidth + 10, y + 3);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(y.toString(), 0, 0);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    render() {
        const now = performance.now();
        if (now - this.lastRenderTime < this.frameInterval) {
            this.renderRequest = requestAnimationFrame(() => this.render());
            return;
        }
        this.lastRenderTime = now;

        // メインキャンバスのクリア
        this.clearCanvas('main');

        // レイヤーの合成
        this.app.getManager('layer')?.compositeAll();

        // グリッドの描画
        if (this.settings.gridEnabled) {
            this.drawGrid();
        }

        // ルーラーの描画
        if (this.settings.rulerEnabled) {
            this.drawRuler();
        }

        // 次のフレームの予約
        this.renderRequest = requestAnimationFrame(() => this.render());
    }

    clearCanvas(type) {
        const ctx = this.contexts[type];
        if (ctx) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }

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

        this.updateCanvasTransform();
        this.render();
    }

    // リソース解放
    dispose() {
        // レンダリングループの停止
        cancelAnimationFrame(this.renderRequest);
        cancelAnimationFrame(this.updateRequest);

        // イベントリスナーの解除
        window.removeEventListener('resize', this.handleResize);
        this.displayCanvas.removeEventListener('pointerdown', this.handlePointerDown);
        this.displayCanvas.removeEventListener('pointermove', this.handlePointerMove);
        this.displayCanvas.removeEventListener('pointerup', this.handlePointerUp);
        this.displayCanvas.removeEventListener('pointercancel', this.handlePointerCancel);
        this.displayCanvas.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);

        // WebGLリソースの解放
        if (this.glContext) {
            for (const [_, program] of this.glPrograms) {
                this.glContext.deleteProgram(program.program);
            }
        }

        // キャンバスの解放
        for (const canvas of Object.values(this.contexts)) {
            if (canvas) {
                canvas.canvas.width = 0;
                canvas.canvas.height = 0;
            }
        }

        // 状態のリセット
        this.contexts = null;
        this.state = null;
        this.settings = null;
        this.pointer = null;
        this.glContext = null;
        this.glPrograms = null;
    }
}