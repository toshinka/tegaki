// ColorProcessor-v2-0.js
class TegakiColorProcessor {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 13:58:09';
        
        // カラー処理の状態
        this.state = {
            currentColor: { r: 0, g: 0, b: 0, a: 1 },
            previousColor: { r: 255, g: 255, b: 255, a: 1 },
            palette: new Map(),
            maxPaletteSize: 100,
            defaultGradientSteps: 32
        };

        // カラースペース変換用のキャッシュ
        this.cache = {
            rgb: new Map(),
            hsv: new Map(),
            hsl: new Map(),
            cmyk: new Map()
        };

        // CoreのColorManagerへの参照
        this.colorManager = this.app.colorManager;

        this.initialize();
    }

    initialize() {
        console.log(`Initializing Color Processor at ${this.currentTimestamp}`);

        try {
            // 拡張パレットの作成
            this.createExtendedPalette();
            // カラースペースキャッシュの初期化
            this.initializeCache();
            
            console.log('Color Processor initialization completed');

        } catch (error) {
            console.error('Color Processor initialization failed:', error);
            throw error;
        }
    }

    createExtendedPalette() {
        // 基本色
        this.addToPalette('process_black', { r: 0, g: 0, b: 0, a: 1 });
        this.addToPalette('process_white', { r: 255, g: 255, b: 255, a: 1 });

        // プロセスカラー
        this.addToPalette('process_cyan', { r: 0, g: 255, b: 255, a: 1 });
        this.addToPalette('process_magenta', { r: 255, g: 0, b: 255, a: 1 });
        this.addToPalette('process_yellow', { r: 255, g: 255, b: 0, a: 1 });

        // グレースケール
        for (let i = 1; i < 10; i++) {
            const value = Math.round(i * 25.5);
            this.addToPalette(`process_gray${i}0`, {
                r: value,
                g: value,
                b: value,
                a: 1
            });
        }
    }

    initializeCache() {
        // 基本的なRGBカラーのキャッシュを事前計算
        const basicColors = [
            { r: 0, g: 0, b: 0 },
            { r: 255, g: 255, b: 255 },
            { r: 255, g: 0, b: 0 },
            { r: 0, g: 255, b: 0 },
            { r: 0, g: 0, b: 255 }
        ];

        for (const color of basicColors) {
            this.rgbToHsv(color);
            this.rgbToHsl(color);
            this.rgbToCmyk(color);
        }
    }

    addToPalette(name, color) {
        if (this.state.palette.size >= this.state.maxPaletteSize) {
            // 最も古いエントリーを削除
            const firstKey = this.state.palette.keys().next().value;
            this.state.palette.delete(firstKey);
        }

        this.state.palette.set(name, {
            ...color,
            timestamp: Date.now()
        });
    }

    // RGB -> HSV変換
    rgbToHsv(rgb) {
        const key = `${rgb.r},${rgb.g},${rgb.b}`;
        if (this.cache.hsv.has(key)) {
            return { ...this.cache.hsv.get(key), a: rgb.a };
        }

        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        let s = max === 0 ? 0 : delta / max;
        let v = max;

        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }

            h = Math.round(h * 60);
            if (h < 0) h += 360;
        }

        const hsv = {
            h: h,
            s: Math.round(s * 100),
            v: Math.round(v * 100),
            a: rgb.a
        };

        this.cache.hsv.set(key, hsv);
        return hsv;
    }

    // RGB -> HSL変換
    rgbToHsl(rgb) {
        const key = `${rgb.r},${rgb.g},${rgb.b}`;
        if (this.cache.hsl.has(key)) {
            return { ...this.cache.hsl.get(key), a: rgb.a };
        }

        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (delta !== 0) {
            s = delta / (1 - Math.abs(2 * l - 1));
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }

            h = Math.round(h * 60);
            if (h < 0) h += 360;
        }

        const hsl = {
            h: h,
            s: Math.round(s * 100),
            l: Math.round(l * 100),
            a: rgb.a
        };

        this.cache.hsl.set(key, hsl);
        return hsl;
    }

    // RGB -> CMYK変換
    rgbToCmyk(rgb) {
        const key = `${rgb.r},${rgb.g},${rgb.b}`;
        if (this.cache.cmyk.has(key)) {
            return { ...this.cache.cmyk.get(key), a: rgb.a };
        }

        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;

        const k = 1 - Math.max(r, g, b);
        const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
        const](#)*

