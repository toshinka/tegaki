// ColorManager-v2-0.js
class TegakiColorManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 13:24:14';
        
        // カラーマネージャーの状態
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

        this.initialize();
    }

    initialize() {
        console.log(`Initializing Color Manager at ${this.currentTimestamp}`);

        try {
            // デフォルトパレットの作成
            this.createDefaultPalette();
            console.log('Color Manager initialization completed');

        } catch (error) {
            console.error('Color Manager initialization failed:', error);
            throw error;
        }
    }

    createDefaultPalette() {
        // 基本色
        this.addToPalette('black', { r: 0, g: 0, b: 0, a: 1 });
        this.addToPalette('white', { r: 255, g: 255, b: 255, a: 1 });
        this.addToPalette('red', { r: 255, g: 0, b: 0, a: 1 });
        this.addToPalette('green', { r: 0, g: 255, b: 0, a: 1 });
        this.addToPalette('blue', { r: 0, g: 0, b: 255, a: 1 });

        // グレースケール
        for (let i = 1; i < 10; i++) {
            const value = Math.round(i * 25.5);
            this.addToPalette(`gray${i}0`, {
                r: value,
                g: value,
                b: value,
                a: 1
            });
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

    removeFromPalette(name) {
        return this.state.palette.delete(name);
    }

    getPaletteColor(name) {
        const entry = this.state.palette.get(name);
        return entry ? { r: entry.r, g: entry.g, b: entry.b, a: entry.a } : null;
    }

    getCurrentColor() {
        return { ...this.state.currentColor };
    }

    setCurrentColor(color) {
        this.state.previousColor = { ...this.state.currentColor };
        this.state.currentColor = {
            r: Math.round(Math.max(0, Math.min(255, color.r))),
            g: Math.round(Math.max(0, Math.min(255, color.g))),
            b: Math.round(Math.max(0, Math.min(255, color.b))),
            a: Math.max(0, Math.min(1, color.a))
        };
    }

    getPreviousColor() {
        return { ...this.state.previousColor };
    }

    swapColors() {
        const temp = { ...this.state.currentColor };
        this.state.currentColor = { ...this.state.previousColor };
        this.state.previousColor = temp;
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

    // HSV -> RGB変換
    hsvToRgb(hsv) {
        const key = `${hsv.h},${hsv.s},${hsv.v}`;
        if (this.cache.rgb.has(key)) {
            return { ...this.cache.rgb.get(key), a: hsv.a };
        }

        const h = hsv.h;
        const s = hsv.s / 100;
        const v = hsv.v / 100;

        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;

        let r = 0;
        let g = 0;
        let b = 0;

        if (h >= 0 && h < 60) {
            r = c; g = x; b = 0;
        } else if (h >= 60 && h < 120) {
            r = x; g = c; b = 0;
        } else if (h >= 120 && h < 180) {
            r = 0; g = c; b = x;
        } else if (h >= 180 && h < 240) {
            r = 0; g = x; b = c;
        } else if (h >= 240 && h < 300) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }

        const rgb = {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),*
