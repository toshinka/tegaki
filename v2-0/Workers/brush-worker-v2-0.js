// brush-worker-v2-0.js
class TegakiBrushWorker {
    constructor() {
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 10:15:16';
        
        // ワーカーの設定
        this.settings = {
            defaultSize: 5,
            defaultOpacity: 1.0,
            defaultFlow: 1.0,
            defaultHardness: 0.8,
            defaultSpacing: 0.1,
            maxSize: 1000,
            minSize: 1
        };

        // オフスクリーンキャンバス
        this.canvas = new OffscreenCanvas(512, 512);
        this.ctx = this.canvas.getContext('2d', {
            alpha: true,
            willReadFrequently: true
        });

        // ブラシジェネレータ
        this.generators = new Map();
        this.initializeGenerators();

        // メッセージハンドラの設定
        self.onmessage = this.handleMessage.bind(this);
    }

    initializeGenerators() {
        // 円形ブラシ
        this.generators.set('circle', (options) => {
            const ctx = this.ctx;
            const size = options.size || this.settings.defaultSize;
            const hardness = options.hardness || this.settings.defaultHardness;
            
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            const gradient = ctx.createRadialGradient(
                256, 256, 0,
                256, 256, 256
            );
            
            gradient.addColorStop(0, `rgba(255, 255, 255, ${options.opacity || 1.0})`);
            gradient.addColorStop(hardness, `rgba(255, 255, 255, ${(options.opacity || 1.0) * 0.5})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(256, 256, 256, 0, Math.PI * 2);
            ctx.fill();
        });

        // ソフトブラシ
        this.generators.set('soft', (options) => {
            const ctx = this.ctx;
            const size = options.size || this.settings.defaultSize;
            const hardness = options.hardness || 0.5;
            
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            const gradient = ctx.createRadialGradient(
                256, 256, 0,
                256, 256, 256
            );
            
            gradient.addColorStop(0, `rgba(255, 255, 255, ${options.opacity || 0.7})`);
            gradient.addColorStop(hardness * 0.8, `rgba(255, 255, 255, ${(options.opacity || 0.7) * 0.3})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(256, 256, 256, 0, Math.PI * 2);
            ctx.fill();
        });

        // ハードブラシ
        this.generators.set('hard', (options) => {
            const ctx = this.ctx;
            const size = options.size || this.settings.defaultSize;
            
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            ctx.fillStyle = `rgba(255, 255, 255, ${options.opacity || 1.0})`;
            ctx.beginPath();
            ctx.arc(256, 256, 256, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    handleMessage(e) {
        const { type, name, options, settings } = e.data;

        try {
            switch (type) {
                case 'init':
                    this.settings = { ...this.settings, ...settings };
                    self.postMessage({ type: 'init', success: true });
                    break;

                case 'generate':
                    const generator = this.generators.get(name);
                    if (!generator) {
                        throw new Error(`Unknown brush type: ${name}`);
                    }

                    generator(options);
                    const imageData = this.ctx.getImageData(
                        0, 0,
                        this.canvas.width,
                        this.canvas.height
                    );

                    self.postMessage({
                        type: 'generate',
                        name: name,
                        imageData: imageData
                    }, [imageData.data.buffer]);
                    break;

                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
        } catch (error) {
            self.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }

    dispose() {
        // リソースの解放
        this.canvas.width = 0;
        this.canvas.height = 0;
        this.ctx = null;
        this.canvas = null;
        this.generators.clear();
        this.generators = null;
        this.settings = null;
    }
}

// ワーカーのインスタンス化
const worker = new TegakiBrushWorker();