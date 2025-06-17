// ColorProcessor-v2-0.js
class TegakiColorProcessor {
    constructor(manager) {  // managerを受け取る
        this.coreManager = manager;  // 直接参照を保存
        
        // 参照の更新
        this.coreManager = this.app.coreColorManager;
        
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
        const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
        const y = k === 1 ? 0 : (1 - b - k) / (1 - k);

        const cmyk = {
            c: Math.round(c * 100),
            m: Math.round(m * 100),
            y: Math.round(y * 100),
            k: Math.round(k * 100),
            a: rgb.a
        };

        this.cache.cmyk.set(key, cmyk);
        return cmyk;
    }

    // カラースペース間の相互変換メソッド
    convertColor(color, fromSpace, toSpace) {
        let rgb;
        
        // 最初にRGBに変換
        switch (fromSpace) {
            case 'rgb':
                rgb = color;
                break;
            case 'hsv':
                rgb = this.hsvToRgb(color);
                break;
            case 'hsl':
                rgb = this.hslToRgb(color);
                break;
            case 'cmyk':
                rgb = this.cmykToRgb(color);
                break;
            default:
                throw new Error(`Unsupported color space: ${fromSpace}`);
        }

        // 目的のスペースに変換
        switch (toSpace) {
            case 'rgb':
                return rgb;
            case 'hsv':
                return this.rgbToHsv(rgb);
            case 'hsl':
                return this.rgbToHsl(rgb);
            case 'cmyk':
                return this.rgbToCmyk(rgb);
            default:
                throw new Error(`Unsupported color space: ${toSpace}`);
        }
    }

    // HSL -> RGB変換
    hslToRgb(hsl) {
        const h = hsl.h;
        const s = hsl.s / 100;
        const l = hsl.l / 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;

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

        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255),
            a: hsl.a
        };
    }

    // CMYK -> RGB変換
    cmykToRgb(cmyk) {
        const c = cmyk.c / 100;
        const m = cmyk.m / 100;
        const y = cmyk.y / 100;
        const k = cmyk.k / 100;

        return {
            r: Math.round(255 * (1 - c) * (1 - k)),
            g: Math.round(255 * (1 - m) * (1 - k)),
            b: Math.round(255 * (1 - y) * (1 - k)),
            a: cmyk.a
        };
    }

    // グラデーション生成機能
    generateGradient(startColor, endColor, steps = this.state.defaultGradientSteps) {
        const colors = [];
        const start = this.convertColor(startColor, 'rgb', 'hsl');
        const end = this.convertColor(endColor, 'rgb', 'hsl');

        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const hsl = {
                h: this.interpolateHue(start.h, end.h, t),
                s: start.s + (end.s - start.s) * t,
                l: start.l + (end.l - start.l) * t,
                a: start.a + (end.a - start.a) * t
            };
            colors.push(this.convertColor(hsl, 'hsl', 'rgb'));
        }

        return colors;
    }

    // 色相の補間（360度周りの最短経路）
    interpolateHue(h1, h2, t) {
        const diff = h2 - h1;
        if (Math.abs(diff) <= 180) {
            return h1 + diff * t;
        } else if (diff > 180) {
            return h1 + (diff - 360) * t;
        } else {
            return h1 + (diff + 360) * t;
        }
    }

    // カラーハーモニー生成
    generateColorHarmony(baseColor, type = 'complementary') {
        const hsl = this.convertColor(baseColor, 'rgb', 'hsl');
        const harmony = [baseColor];

        switch (type) {
            case 'complementary':
                harmony.push(this.rotateHue(hsl, 180));
                break;
            case 'analogous':
                harmony.push(this.rotateHue(hsl, -30));
                harmony.push(this.rotateHue(hsl, 30));
                break;
            case 'triadic':
                harmony.push(this.rotateHue(hsl, 120));
                harmony.push(this.rotateHue(hsl, 240));
                break;
            case 'split-complementary':
                harmony.push(this.rotateHue(hsl, 150));
                harmony.push(this.rotateHue(hsl, 210));
                break;
            case 'tetradic':
                harmony.push(this.rotateHue(hsl, 90));
                harmony.push(this.rotateHue(hsl, 180));
                harmony.push(this.rotateHue(hsl, 270));
                break;
            default:
                throw new Error(`Unsupported harmony type: ${type}`);
        }

        return harmony.map(color => this.convertColor(color, 'hsl', 'rgb'));
    }

    // 色相の回転
    rotateHue(hsl, degrees) {
        return {
            h: (hsl.h + degrees + 360) % 360,
            s: hsl.s,
            l: hsl.l,
            a: hsl.a
        };
    }

    // カラーブレンド機能
    blendColors(color1, color2, mode = 'normal', opacity = 1) {
        const c1 = this.convertColor(color1, 'rgb', 'rgb');
        const c2 = this.convertColor(color2, 'rgb', 'rgb');

        let result;
        switch (mode) {
            case 'multiply':
                result = {
                    r: (c1.r * c2.r) / 255,
                    g: (c1.g * c2.g) / 255,
                    b: (c1.b * c2.b) / 255
                };
                break;
            case 'screen':
                result = {
                    r: 255 - ((255 - c1.r) * (255 - c2.r)) / 255,
                    g: 255 - ((255 - c1.g) * (255 - c2.g)) / 255,
                    b: 255 - ((255 - c1.b) * (255 - c2.b)) / 255
                };
                break;
            case 'overlay':
                result = {
                    r: this.overlayChannel(c1.r, c2.r),
                    g: this.overlayChannel(c1.g, c2.g),
                    b: this.overlayChannel(c1.b, c2.b)
                };
                break;
            default: // normal
                result = c2;
        }

        return {
            r: Math.round(result.r),
            g: Math.round(result.g),
            b: Math.round(result.b),
            a: opacity
        };
    }

    // オーバーレイブレンドモードの計算
    overlayChannel(a, b) {
        return a < 128 ?
            (2 * a * b) / 255 :
            255 - (2 * (255 - a) * (255 - b)) / 255;
    }

    // リソース解放
    dispose() {
        // キャッシュのクリア
        for (const cache of Object.values(this.cache)) {
            cache.clear();
        }

        // 状態のリセット
        this.state = null;
        this.cache = null;
        this.colorManager = null;
    }
}